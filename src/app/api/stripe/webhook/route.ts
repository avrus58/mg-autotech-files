import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  safeAppendPaymentEvent,
  safeUpdatePaymentRecord,
} from "@/lib/paymentAudit";
import { completeStripeCreditPurchase } from "@/lib/stripeCreditPurchase";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  isRecognizedStripeCreditPurchaseMetadata,
  normalizeStripeCorrelationId,
  normalizeStripePaymentIntentId,
  readStripeWebhookBody,
  StripeWebhookBodyError,
} from "@/lib/stripePaymentSecurity";

type PaymentFailureRecord = {
  id: string;
  user_id: string | null;
  status: string;
  credits: number | string;
  amount_total: number | null;
  currency: string | null;
};

type CheckoutSessionRecord = PaymentFailureRecord & {
  payment_type: string;
  provider_payment_id: string | null;
  package_id: string | null;
  purchase_type: string | null;
  failure_code: string | null;
};

function stripeObjectId(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id ?? null;
}

async function updateExactAsyncCheckoutState(
  session: Stripe.Checkout.Session,
  state: "pending" | "failed",
  failureCode: string,
  failureMessage: string,
) {
  const metadata = session.metadata;
  if (!metadata || !isRecognizedStripeCreditPurchaseMetadata(metadata)) return null;
  const userId = metadata.user_id;
  const paymentIntent = normalizeStripePaymentIntentId(stripeObjectId(session.payment_intent));
  const credits = Number(metadata.credits ?? 0);
  if (!userId || !paymentIntent || !Number.isInteger(credits) || credits <= 0) return null;

  const admin = getSupabaseAdmin();
  const lookup = await admin
    .from("payment_records")
    .select("id,user_id,status,payment_type,credits,amount_total,currency,provider_payment_id,package_id,purchase_type,failure_code")
    .eq("provider", "stripe")
    .eq("external_id", session.id)
    .maybeSingle();
  if (lookup.error) throw new Error("Stripe checkout state could not be verified.");
  if (!lookup.data) return null;
  const record = lookup.data as CheckoutSessionRecord;
  if (
    record.user_id !== userId ||
    record.payment_type !== "credit_purchase" ||
    (record.provider_payment_id !== null && record.provider_payment_id !== paymentIntent) ||
    record.package_id !== (metadata.package_id ?? null) ||
    record.purchase_type !== (metadata.purchase_type ?? null) ||
    Number(record.credits) !== credits ||
    Number(record.amount_total ?? 0) !== Number(session.amount_total ?? 0) ||
    String(record.currency ?? "").toLowerCase() !== String(session.currency ?? "").toLowerCase()
  ) {
    throw new Error("Stripe checkout state did not match its payment record.");
  }

  if (record.status === "succeeded" || record.status === "refunded") {
    return { id: record.id, changed: false };
  }

  let update = admin
    .from("payment_records")
    .update({
      status: state,
      provider_payment_id: paymentIntent,
      failure_code: failureCode,
      failure_message: failureMessage,
    })
    .eq("id", record.id)
    .eq("provider", "stripe")
    .eq("external_id", session.id)
    .eq("user_id", userId);
  if (record.status === "requires_review" && record.failure_code === "stripe_payment_pending") {
    update = update.eq("status", "requires_review").eq("failure_code", "stripe_payment_pending");
  } else {
    update = update.eq("status", "pending");
  }
  const saved = await update.select("id").maybeSingle();
  if (saved.error) throw new Error("Stripe checkout state could not be recorded.");
  return { id: saved.data?.id ? String(saved.data.id) : record.id, changed: Boolean(saved.data) };
}

function paymentFailureRecordMatches(
  record: PaymentFailureRecord,
  intent: Stripe.PaymentIntent,
) {
  return record.user_id === intent.metadata.user_id &&
    Number(record.credits) === Number(intent.metadata.credits) &&
    Number(record.amount_total ?? 0) === intent.amount &&
    String(record.currency ?? "").toLowerCase() === intent.currency.toLowerCase();
}

async function findExactPaymentFailureRecord(intent: Stripe.PaymentIntent) {
  if (!isRecognizedStripeCreditPurchaseMetadata(intent.metadata)) return null;
  const admin = getSupabaseAdmin();
  const direct = await admin
    .from("payment_records")
    .select("id,user_id,status,credits,amount_total,currency")
    .eq("provider", "stripe")
    .eq("payment_type", "credit_purchase")
    .eq("provider_payment_id", intent.id)
    .limit(2);
  if (!direct.error && direct.data?.length === 1) {
    const record = direct.data[0] as PaymentFailureRecord;
    return paymentFailureRecordMatches(record, intent) ? record : null;
  }

  const correlationId = normalizeStripeCorrelationId(
    intent.metadata.checkout_correlation_id,
  );
  if (!correlationId) return null;
  const correlated = await admin
    .from("payment_records")
    .select("id,user_id,status,credits,amount_total,currency")
    .eq("provider", "stripe")
    .eq("payment_type", "credit_purchase")
    .contains("metadata", { checkout_correlation_id: correlationId })
    .limit(2);
  if (correlated.error || correlated.data?.length !== 1) return null;
  const record = correlated.data[0] as PaymentFailureRecord;
  return paymentFailureRecordMatches(record, intent) ? record : null;
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature || signature.length > 4096) {
    return NextResponse.json({ error: "Missing or invalid Stripe signature." }, { status: 400 });
  }

  const stripe = getStripe();
  let rawBody: string;
  try {
    rawBody = await readStripeWebhookBody(request);
  } catch (error) {
    const status = error instanceof StripeWebhookBodyError ? error.status : 400;
    return NextResponse.json(
      { error: status === 413 ? "Stripe webhook body is too large." : "Invalid webhook body." },
      { status },
    );
  }
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      if (!isRecognizedStripeCreditPurchaseMetadata(session.metadata)) {
        await safeAppendPaymentEvent({
          provider: "stripe",
          externalEventId: event.id,
          eventType: event.type,
          status: "info",
          message: "Non-credit Stripe checkout event ignored by the credit webhook.",
          payload: { livemode: event.livemode },
        });
      } else if (session.payment_status === "paid") {
        await completeStripeCreditPurchase(session, event.id);
      } else {
        if (event.type === "checkout.session.async_payment_succeeded") {
          throw new Error("Stripe reported asynchronous payment success without paid status.");
        }
        const pending = await updateExactAsyncCheckoutState(
          session,
          "pending",
          "stripe_payment_pending",
          `Checkout completed with payment status ${session.payment_status}.`,
        );
        await safeAppendPaymentEvent({
          paymentRecordId: pending?.id ?? null,
          provider: "stripe",
          externalEventId: event.id,
          eventType: event.type,
          status: "received",
          message: `Checkout completed with payment status ${session.payment_status}.`,
          payload: { session_id: session.id },
        });
      }
    } else if (event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (!isRecognizedStripeCreditPurchaseMetadata(session.metadata)) {
        return NextResponse.json({ received: true, ignored: true });
      }
      const failed = await updateExactAsyncCheckoutState(
        session,
        "failed",
        "stripe_async_payment_failed",
        "Stripe reported that the asynchronous Checkout payment failed.",
      );
      await safeAppendPaymentEvent({
        paymentRecordId: failed?.id ?? null,
        provider: "stripe",
        externalEventId: event.id,
        eventType: event.type,
        status: failed?.changed ? "failed" : "info",
        message: failed?.changed
          ? "Stripe asynchronous Checkout payment failed."
          : "Stripe asynchronous payment failure did not change a terminal payment.",
        payload: { session_id: session.id },
      });
    } else if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (!isRecognizedStripeCreditPurchaseMetadata(session.metadata)) {
        return NextResponse.json({ received: true, ignored: true });
      }
      const recordId = await safeUpdatePaymentRecord("stripe", session.id, {
        status: "cancelled",
        failure_code: "checkout_expired",
        failure_message: "Stripe Checkout session expired before payment.",
      });
      await safeAppendPaymentEvent({
        paymentRecordId: recordId,
        provider: "stripe",
        externalEventId: event.id,
        eventType: event.type,
        status: "processed",
        message: "Stripe Checkout session expired.",
        payload: { session_id: session.id },
      });
    } else if (event.type === "payment_intent.payment_failed") {
      const intent = event.data.object as Stripe.PaymentIntent;
      if (!isRecognizedStripeCreditPurchaseMetadata(intent.metadata)) {
        return NextResponse.json({ received: true, ignored: true });
      }
      const adminMessage = intent.last_payment_error?.message || "Stripe payment failed.";
      const admin = getSupabaseAdmin();
      const candidate = await findExactPaymentFailureRecord(intent);
      let updatedRecordId: string | null = null;
      let stateChanged = false;
      if (candidate?.status === "pending") {
        const updated = await admin
          .from("payment_records")
          .update({
            provider_payment_id: intent.id,
            failure_code: intent.last_payment_error?.code || "payment_failed",
            failure_message: `Payment attempt failed; Stripe Checkout may still be retried. ${adminMessage}`,
          })
          .eq("id", candidate.id)
          .eq("provider", "stripe")
          .eq("user_id", intent.metadata.user_id)
          .eq("status", "pending")
          .select("id")
          .maybeSingle();
        if (updated.error) throw new Error("Stripe payment failure state could not be recorded.");
        updatedRecordId = updated.data?.id ? String(updated.data.id) : null;
        stateChanged = Boolean(updatedRecordId);
      }
      if (!candidate) {
        await safeAppendPaymentEvent({
          provider: "stripe",
          externalEventId: event.id,
          eventType: event.type,
          status: "received",
          message: "Stripe payment failure needs exact record reconciliation.",
          payload: { payment_intent: intent.id, decline_code: intent.last_payment_error?.decline_code || null },
        });
      } else {
        const binding = await admin
          .from("payment_records")
          .update({ provider_payment_id: intent.id })
          .eq("id", candidate.id)
          .eq("provider", "stripe")
          .eq("user_id", intent.metadata.user_id)
          .is("provider_payment_id", null);
        if (binding.error) throw new Error("Stripe payment failure binding could not be recorded.");
        await safeAppendPaymentEvent({
          paymentRecordId: updatedRecordId ?? candidate.id,
          provider: "stripe",
          externalEventId: event.id,
          eventType: event.type,
          status: stateChanged ? "failed" : "info",
          message: stateChanged ? "Stripe payment attempt failed; checkout remains pending for a safe retry." : "Stripe payment failure matched a record but no pending state was changed.",
          payload: { payment_intent: intent.id, decline_code: intent.last_payment_error?.decline_code || null },
        });
      }
    } else {
      await safeAppendPaymentEvent({
        provider: "stripe",
        externalEventId: event.id,
        eventType: event.type,
        status: "info",
        message: "Stripe event received; no credit action required.",
        payload: { livemode: event.livemode },
      });
    }
    return NextResponse.json({ received: true });
  } catch {
    await safeAppendPaymentEvent({
      provider: "stripe",
      externalEventId: event.id,
      eventType: event.type,
      status: "failed",
      message: "Stripe webhook processing failed.",
      payload: { livemode: event.livemode },
    });
    return NextResponse.json({ error: "Stripe webhook processing failed." }, { status: 500 });
  }
}
