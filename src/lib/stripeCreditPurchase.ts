import type Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  safeAppendPaymentEvent,
  safeUpdatePaymentRecord,
  safeUpsertPaymentRecord,
} from "@/lib/paymentAudit";

export async function completeStripeCreditPurchase(
  session: Stripe.Checkout.Session,
  eventId?: string
) {
  if (session.payment_status !== "paid") {
    throw new Error(`Stripe payment status is ${session.payment_status}.`);
  }

  const userId = session.metadata?.user_id;
  const credits = Number(session.metadata?.credits ?? 0);
  if (!userId || !Number.isFinite(credits) || credits <= 0) {
    throw new Error("Missing or invalid Stripe checkout metadata.");
  }

  const paymentIntent =
    typeof session.payment_intent === "string" ? session.payment_intent : null;
  const recordId = await safeUpsertPaymentRecord({
    provider: "stripe",
    externalId: session.id,
    providerPaymentId: paymentIntent,
    userId,
    status: "pending",
    credits,
    amountTotal: session.amount_total ?? null,
    currency: session.currency,
    customerEmail: session.customer_email ?? session.metadata?.user_email ?? null,
    packageId: session.metadata?.package_id ?? null,
    purchaseType: session.metadata?.purchase_type ?? null,
    metadata: { stripe_session_id: session.id, livemode: session.livemode },
  });

  const admin = getSupabaseAdmin();
  const creditResult = await admin.rpc("add_credits_from_stripe", {
    p_user_id: userId,
    p_stripe_session_id: session.id,
    p_stripe_payment_intent: paymentIntent,
    p_customer_email: session.customer_email ?? session.metadata?.user_email ?? null,
    p_package_id: session.metadata?.package_id ?? null,
    p_credits: credits,
    p_amount_total: session.amount_total ?? null,
    p_currency: session.currency ?? null,
  });
  if (creditResult.error) throw new Error(creditResult.error.message);

  const profile = await admin
    .from("profiles")
    .select("credit_balance")
    .eq("id", userId)
    .single();
  if (profile.error) throw new Error(profile.error.message);

  const ledger = await admin.from("credit_transactions").upsert(
    {
      user_id: userId,
      type: "purchase",
      source_type: "stripe_checkout",
      source_id: session.id,
      credits_delta: credits,
      balance_after: Number(profile.data?.credit_balance ?? 0),
      description: `${credits} credits purchased via Stripe.`,
      amount_total: session.amount_total ?? null,
      currency: session.currency ?? null,
      metadata: {
        payment_record_id: recordId,
        stripe_session_id: session.id,
        stripe_payment_intent: paymentIntent,
        customer_email: session.customer_email ?? session.metadata?.user_email ?? null,
        package_id: session.metadata?.package_id ?? null,
        purchase_type: session.metadata?.purchase_type ?? null,
      },
    },
    { onConflict: "source_type,source_id", ignoreDuplicates: true }
  );
  if (ledger.error) throw new Error(ledger.error.message);

  const creditsAppliedAt = new Date().toISOString();
  await safeUpdatePaymentRecord("stripe", session.id, {
    status: "succeeded",
    provider_payment_id: paymentIntent,
    credits_applied_at: creditsAppliedAt,
    failure_code: null,
    failure_message: null,
  });
  await safeAppendPaymentEvent({
    paymentRecordId: recordId,
    provider: "stripe",
    externalEventId: eventId ?? null,
    eventType: "checkout_completed",
    status: "processed",
    message: "Stripe payment confirmed and credits reconciled.",
    payload: { session_id: session.id, payment_intent: paymentIntent },
  });

  return { credits, recordId, creditsAppliedAt };
}
