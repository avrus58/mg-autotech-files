import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  safeAppendPaymentEvent,
  safeUpdatePaymentRecord,
} from "@/lib/paymentAudit";
import { completeStripeCreditPurchase } from "@/lib/stripeCreditPurchase";
import { getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET is missing." }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });

  const stripe = getStripe();
  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook signature verification failed." },
      { status: 400 }
    );
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === "paid") {
        await completeStripeCreditPurchase(session, event.id);
      } else {
        await safeUpdatePaymentRecord("stripe", session.id, {
          status: "requires_review",
          failure_message: `Checkout completed with payment status ${session.payment_status}.`,
        });
        await safeAppendPaymentEvent({
          provider: "stripe",
          externalEventId: event.id,
          eventType: event.type,
          status: "failed",
          message: `Checkout completed with payment status ${session.payment_status}.`,
          payload: { session_id: session.id },
        });
      }
    } else if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
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
      const adminMessage = intent.last_payment_error?.message || "Stripe payment failed.";
      const { getSupabaseAdmin } = await import("@/lib/supabaseAdmin");
      const admin = getSupabaseAdmin();
      const candidate = await admin
        .from("payment_records")
        .select("id")
        .eq("provider", "stripe")
        .eq("user_id", intent.metadata?.user_id || "")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (candidate.data?.id) {
        await admin
          .from("payment_records")
          .update({
            status: "failed",
            provider_payment_id: intent.id,
            failure_code: intent.last_payment_error?.code || "payment_failed",
            failure_message: adminMessage,
          })
          .eq("id", candidate.data.id);
      }
      await safeAppendPaymentEvent({
        paymentRecordId: candidate.data?.id ?? null,
        provider: "stripe",
        externalEventId: event.id,
        eventType: event.type,
        status: "failed",
        message: adminMessage,
        payload: { payment_intent: intent.id, decline_code: intent.last_payment_error?.decline_code || null },
      });
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe webhook processing failed.";
    await safeAppendPaymentEvent({
      provider: "stripe",
      externalEventId: event.id,
      eventType: event.type,
      status: "failed",
      message,
      payload: { livemode: event.livemode },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
