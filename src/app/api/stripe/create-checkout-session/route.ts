import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { checkAdaptiveRateLimit, rateLimitResponseHeaders } from "@/lib/abuseProtection";
import { requireApiUser } from "@/lib/apiAuth";
import {
  CommercialPricingUnavailableError,
  getCreditPurchaseQuote,
  PaymentMethodUnavailableError,
  StaleCreditQuoteError,
} from "@/lib/commercialPolicy";
import {
  euroAmountToCents,
  isStripeEuroAmountSupported,
} from "@/lib/commercialPricing";
import { safeAppendPaymentEvent, safeUpsertPaymentRecord } from "@/lib/paymentAudit";
import { getStripe } from "@/lib/stripe";
import {
  STRIPE_CREDIT_PURCHASE_PRODUCT,
  stripeCreditPurchaseAbuseSubject,
} from "@/lib/stripePaymentSecurity";

function stripeObjectId(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id ?? null;
}

const privateNoStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Authorization",
};

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser(request);
    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status, headers: privateNoStoreHeaders },
      );
    }
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Invalid checkout request." },
        { status: 400, headers: privateNoStoreHeaders },
      );
    }
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const user = auth.user;
    const rateLimit = await checkAdaptiveRateLimit({
      request,
      scope: "stripe-credit-checkout",
      limit: 8,
      windowMs: 60 * 60 * 1000,
      suffix: stripeCreditPurchaseAbuseSubject(user.id),
      includeClientIp: false,
    });
    const limitHeaders = {
      ...privateNoStoreHeaders,
      ...rateLimitResponseHeaders({
        result: rateLimit,
        limit: 8,
        windowMs: 60 * 60 * 1000,
        blocked: !rateLimit.allowed,
      }),
    };
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many checkout attempts. Please try again later." },
        { status: 429, headers: limitHeaders },
      );
    }

    let selectedPackage;
    try {
      selectedPackage = await getCreditPurchaseQuote(user.id, body, "stripe");
    } catch (error) {
      if (error instanceof StaleCreditQuoteError) {
        return NextResponse.json(
          {
            error: "Credit prices changed. Review the refreshed quote before continuing.",
            code: error.code,
          },
          { status: 409, headers: limitHeaders },
        );
      }
      if (error instanceof PaymentMethodUnavailableError) {
        return NextResponse.json(
          { error: "Stripe checkout is not available for this account.", code: error.code },
          { status: 403, headers: limitHeaders },
        );
      }
      if (error instanceof CommercialPricingUnavailableError) {
        return NextResponse.json(
          {
            error: "Credit pricing is temporarily unavailable. No payment was started.",
            code: error.code,
          },
          { status: 503, headers: limitHeaders },
        );
      }
      return NextResponse.json(
        { error: "Credit checkout could not be prepared safely." },
        { status: 503, headers: limitHeaders },
      );
    }
    if (!selectedPackage) {
      return NextResponse.json(
        { error: "Credit package or valid custom credit amount is missing." },
        { status: 400, headers: limitHeaders },
      );
    }
    if (!isStripeEuroAmountSupported(selectedPackage.priceEuro)) {
      return NextResponse.json(
        {
          error: "This total is outside Stripe's supported EUR range. Choose Bank Transfer or change the amount.",
          code: "stripe_amount_unsupported",
        },
        { status: 422, headers: limitHeaders },
      );
    }
    const amountCents = euroAmountToCents(selectedPackage.priceEuro);

    const stripe = getStripe();
    const checkoutCorrelationId = randomUUID();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: user.email ?? undefined,
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `${selectedPackage.credits} MG AutoTech Credits`,
              description: selectedPackage.description,
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/payment/cancel`,
      metadata: {
        product: STRIPE_CREDIT_PURCHASE_PRODUCT,
        checkout_correlation_id: checkoutCorrelationId,
        user_id: user.id,
        user_email: user.email ?? "",
        package_id: selectedPackage.id,
        credits: String(selectedPackage.credits),
        price_euro: String(selectedPackage.priceEuro),
        unit_price_euro: String(selectedPackage.unitPriceEuro),
        purchase_type: selectedPackage.purchaseType,
        pricing_quote_id: selectedPackage.quoteId,
      },
      payment_intent_data: {
        metadata: {
          product: STRIPE_CREDIT_PURCHASE_PRODUCT,
          checkout_correlation_id: checkoutCorrelationId,
          user_id: user.id,
          credits: String(selectedPackage.credits),
          package_id: selectedPackage.id,
          purchase_type: selectedPackage.purchaseType,
          pricing_quote_id: selectedPackage.quoteId,
        },
      },
    });

    const recordId = await safeUpsertPaymentRecord({
      provider: "stripe",
      externalId: session.id,
      providerPaymentId: stripeObjectId(session.payment_intent),
      userId: user.id,
      status: "pending",
      paymentType: "credit_purchase",
      credits: selectedPackage.credits,
      amountTotal: amountCents,
      currency: "eur",
      customerEmail: user.email ?? null,
      packageId: selectedPackage.id,
      purchaseType: selectedPackage.purchaseType,
      metadata: {
        stripe_session_id: session.id,
        livemode: session.livemode,
        product: STRIPE_CREDIT_PURCHASE_PRODUCT,
        checkout_correlation_id: checkoutCorrelationId,
        pricing_quote_id: selectedPackage.quoteId,
      },
    });
    if (!recordId) {
      return NextResponse.json(
        { error: "Checkout could not be prepared safely. Please try again later." },
        { status: 503, headers: limitHeaders },
      );
    }
    await safeAppendPaymentEvent({
      paymentRecordId: recordId,
      provider: "stripe",
      eventType: "checkout_created",
      status: "info",
      message: "Stripe Checkout session created.",
      payload: { session_id: session.id },
    });

    return NextResponse.json({ url: session.url }, { headers: limitHeaders });
  } catch {
    await safeAppendPaymentEvent({
      provider: "stripe",
      eventType: "checkout_creation_failed",
      status: "failed",
      message: "Stripe checkout creation failed.",
    });

    return NextResponse.json(
      { error: "Could not create checkout session. Please try again later." },
      { status: 500, headers: privateNoStoreHeaders },
    );
  }
}
