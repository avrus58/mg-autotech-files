import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCreditPurchaseQuote } from "@/lib/commercialPolicy";
import { safeAppendPaymentEvent, safeUpsertPaymentRecord } from "@/lib/paymentAudit";
import { getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const isPackagePurchase = Boolean(body.packageId);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Supabase environment variables are missing." },
        { status: 500 }
      );
    }

    const authorization = request.headers.get("authorization");

    if (!authorization) {
      return NextResponse.json(
        { error: "Missing authorization header." },
        { status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authorization,
        },
      },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      return NextResponse.json(
        { error: "You must be logged in to buy credits." },
        { status: 401 }
      );
    }

    const user = userData.user;

    if (!user.email_confirmed_at && !user.confirmed_at) {
      return NextResponse.json(
        { error: "Please verify your e-mail address before buying credits." },
        { status: 403 }
      );
    }

    let selectedPackage;
    try {
      selectedPackage = await getCreditPurchaseQuote(user.id, body, "stripe");
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Stripe is not available." }, { status: 403 });
    }
    if (!selectedPackage) {
      return NextResponse.json({ error: "Credit package or valid custom credit amount is missing." }, { status: 400 });
    }

    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email ?? undefined,
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `${selectedPackage.credits} MG AutoTech Credits`,
              description: selectedPackage.description,
            },
            unit_amount: selectedPackage.priceEuro * 100,
          },
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/payment/cancel`,
      metadata: {
        user_id: user.id,
        user_email: user.email ?? "",
        package_id: selectedPackage.id,
        credits: String(selectedPackage.credits),
        price_euro: String(selectedPackage.priceEuro),
        unit_price_euro: String(selectedPackage.unitPriceEuro),
        purchase_type: isPackagePurchase ? "package" : "custom",
      },
      payment_intent_data: {
        metadata: {
          user_id: user.id,
          credits: String(selectedPackage.credits),
          package_id: selectedPackage.id,
          purchase_type: isPackagePurchase ? "package" : "custom",
        },
      },
    });

    const recordId = await safeUpsertPaymentRecord({
      provider: "stripe",
      externalId: session.id,
      userId: user.id,
      status: "pending",
      credits: selectedPackage.credits,
      amountTotal: Math.round(selectedPackage.priceEuro * 100),
      currency: "eur",
      customerEmail: user.email ?? null,
      packageId: selectedPackage.id,
      purchaseType: isPackagePurchase ? "package" : "custom",
      metadata: { stripe_session_id: session.id, livemode: session.livemode },
    });
    await safeAppendPaymentEvent({
      paymentRecordId: recordId,
      provider: "stripe",
      eventType: "checkout_created",
      status: "info",
      message: "Stripe Checkout session created.",
      payload: { session_id: session.id },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not create checkout session.";

    await safeAppendPaymentEvent({
      provider: "stripe",
      eventType: "checkout_creation_failed",
      status: "failed",
      message,
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
