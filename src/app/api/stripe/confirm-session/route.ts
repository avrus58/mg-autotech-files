import { NextResponse } from "next/server";
import { checkAdaptiveRateLimit, rateLimitResponseHeaders } from "@/lib/abuseProtection";
import { requireApiUser } from "@/lib/apiAuth";
import {
  completeStripeCreditPurchase,
  StripeCreditPurchaseProcessingError,
  StripeCreditPurchaseReconciliationError,
} from "@/lib/stripeCreditPurchase";
import { getStripe } from "@/lib/stripe";
import {
  normalizeStripeCheckoutSessionId,
  stripeCreditPurchaseAbuseSubject,
  stripeCreditPurchaseOwnedBy,
} from "@/lib/stripePaymentSecurity";

const privateNoStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Authorization",
};
const confirmationWindowMs = 5 * 60 * 1000;
const accountConfirmationLimit = 20;
const sessionConfirmationLimit = 6;

export async function POST(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status, headers: privateNoStoreHeaders },
    );
  }

  const body = await request.json().catch(() => null);
  const sessionId = normalizeStripeCheckoutSessionId(
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as { sessionId?: unknown }).sessionId
      : null,
  );
  const accountRateLimit = await checkAdaptiveRateLimit({
    request,
    scope: "stripe-confirm-account",
    limit: accountConfirmationLimit,
    windowMs: confirmationWindowMs,
    suffix: stripeCreditPurchaseAbuseSubject(auth.user.id),
    includeClientIp: false,
  });
  const sessionRateLimit = accountRateLimit.allowed
    ? await checkAdaptiveRateLimit({
        request,
        scope: "stripe-confirm-session",
        limit: sessionConfirmationLimit,
        windowMs: confirmationWindowMs,
        suffix: stripeCreditPurchaseAbuseSubject(auth.user.id, sessionId),
      })
    : null;
  const rateLimit = accountRateLimit.allowed && sessionRateLimit
    ? sessionRateLimit
    : accountRateLimit;
  const activeLimit = accountRateLimit.allowed
    ? sessionConfirmationLimit
    : accountConfirmationLimit;
  const limitHeaders = {
    ...privateNoStoreHeaders,
    ...rateLimitResponseHeaders({
      result: rateLimit,
      limit: activeLimit,
      windowMs: confirmationWindowMs,
      blocked: !rateLimit.allowed,
    }),
  };
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many payment confirmation attempts. Please try again later." },
      { status: 429, headers: limitHeaders },
    );
  }
  if (!sessionId) {
    return NextResponse.json(
      { error: "Enter a valid Stripe checkout session." },
      { status: 400, headers: limitHeaders },
    );
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (
      session.mode !== "payment" ||
      !stripeCreditPurchaseOwnedBy(session.metadata, auth.user.id)
    ) {
      return NextResponse.json(
        { error: "This payment session is not linked to your account." },
        { status: 404, headers: limitHeaders },
      );
    }

    if (session.payment_status !== "paid") {
      return NextResponse.json(
        { error: "Payment is not completed yet.", paymentStatus: session.payment_status },
        { status: 409, headers: limitHeaders }
      );
    }

    const result = await completeStripeCreditPurchase(session);

    return NextResponse.json({
      success: true,
      credits: result.credits,
      replayed: result.replayed,
      paymentStatus: session.payment_status,
      conversion: {
        value: Number(session.amount_total ?? 0) / 100,
        currency: String(session.currency ?? "").toUpperCase(),
      },
    }, { headers: limitHeaders });
  } catch (error) {
    if (error instanceof StripeCreditPurchaseProcessingError) {
      return NextResponse.json(
        { error: "Payment confirmation is already in progress. Please try again shortly." },
        { status: 409, headers: { ...limitHeaders, "Retry-After": "3" } },
      );
    }
    if (error instanceof StripeCreditPurchaseReconciliationError) {
      return NextResponse.json(
        { error: "Payment was received but needs a safe reconciliation check. Please contact support if it does not appear shortly." },
        { status: 503, headers: limitHeaders },
      );
    }
    return NextResponse.json(
      { error: "Payment confirmation is temporarily unavailable. Please try again later." },
      { status: 503, headers: limitHeaders },
    );
  }
}
