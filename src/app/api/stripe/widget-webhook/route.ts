import { NextResponse } from "next/server";
import Stripe from "stripe";
import { sendNewWidgetSubscriberNotification, sendWidgetLifecycleEmail } from "@/lib/email";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { createWidgetPublicKey } from "@/lib/widget/keys";

type InvoiceWithSubscription = Stripe.Invoice & {
  subscription?: string | Stripe.Subscription | null;
  parent?: { subscription_details?: { subscription?: string | Stripe.Subscription | null } } | null;
};

function objectId(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id ?? null;
}

function invoiceSubscriptionId(invoice: InvoiceWithSubscription) {
  return objectId(invoice.subscription) || objectId(invoice.parent?.subscription_details?.subscription);
}

function localStatus(stripeStatus: Stripe.Subscription.Status) {
  if (stripeStatus === "active" || stripeStatus === "trialing") return "active";
  if (stripeStatus === "past_due") return "past_due";
  if (stripeStatus === "canceled" || stripeStatus === "incomplete_expired") return "cancelled";
  return "suspended";
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WIDGET_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret) return NextResponse.json({ error: "Widget webhook secret is missing." }, { status: 500 });
  if (!signature) return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const handled = await admin.from("widget_webhook_events").select("event_id").eq("event_id", event.id).maybeSingle();
  if (handled.data) return NextResponse.json({ received: true, duplicate: true });

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.product === "vehicle_widget") {
        const clientId = session.metadata.widget_client_id;
        const subscriptionId = objectId(session.subscription);
        const customerId = objectId(session.customer);
        let stripeStatus: Stripe.Subscription.Status | null = null;
        if (subscriptionId) stripeStatus = (await getStripe().subscriptions.retrieve(subscriptionId)).status;
        const activate = session.payment_status === "paid" && (!stripeStatus || ["active", "trialing"].includes(stripeStatus));
        const profile = session.customer_details?.email
          ? await admin.from("profiles").select("id").eq("email", session.customer_details.email.toLowerCase()).limit(1).maybeSingle()
          : { data: null };
        const saved = await admin.from("widget_clients").update({
          user_id: profile.data?.id ?? undefined,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          stripe_subscription_status: stripeStatus ?? "active",
          status: activate ? "active" : "pending",
          domain_verified: activate,
          widget_enabled: true,
        }).eq("id", clientId).select("id, email, company_name").single();
        if (saved.error) throw saved.error;
        const key = await admin.from("widget_api_keys").select("id").eq("client_id", clientId).eq("is_active", true).maybeSingle();
        if (!key.data) await admin.from("widget_api_keys").insert({ client_id: clientId, public_key: createWidgetPublicKey() });
        await admin.from("widget_audit_logs").insert({ client_id: clientId, action: "subscription.checkout_completed", details: { stripe_session_id: session.id, stripe_subscription_id: subscriptionId, active: activate } });
        if (activate) await sendWidgetLifecycleEmail({ customerEmail: saved.data.email, companyName: saved.data.company_name, event: "activated" });
        if (activate) await sendNewWidgetSubscriberNotification({ companyName: saved.data.company_name, customerEmail: saved.data.email, domain: session.metadata.allowed_domain || "-", subscriptionId });
      }
    }

    if (event.type === "invoice.payment_succeeded" || event.type === "invoice.payment_failed") {
      const invoice = event.data.object as InvoiceWithSubscription;
      const subscriptionId = invoiceSubscriptionId(invoice);
      if (subscriptionId) {
        const failed = event.type === "invoice.payment_failed";
        let paymentUpdate = admin.from("widget_clients").update({ status: failed ? "suspended" : "active", widget_enabled: !failed, stripe_subscription_status: failed ? "past_due" : "active" }).eq("stripe_subscription_id", subscriptionId);
        if (!failed) paymentUpdate = paymentUpdate.eq("admin_suspended", false);
        const saved = await paymentUpdate.select("id, email, company_name").maybeSingle();
        if (saved.data) {
          await admin.from("widget_audit_logs").insert({ client_id: saved.data.id, action: failed ? "subscription.payment_failed" : "subscription.payment_succeeded", details: { stripe_invoice_id: invoice.id } });
          if (failed) await sendWidgetLifecycleEmail({ customerEmail: saved.data.email, companyName: saved.data.company_name, event: "payment_failed" });
        }
      }
    }

    if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
      const subscription = event.data.object as Stripe.Subscription;
      const status = event.type === "customer.subscription.deleted" ? "cancelled" : localStatus(subscription.status);
      let subscriptionUpdate = admin.from("widget_clients").update({
        status,
        widget_enabled: status === "active",
        stripe_subscription_status: subscription.status,
        stripe_customer_id: objectId(subscription.customer),
      }).eq("stripe_subscription_id", subscription.id);
      if (status === "active") subscriptionUpdate = subscriptionUpdate.eq("admin_suspended", false);
      const saved = await subscriptionUpdate.select("id, email, company_name").maybeSingle();
      if (saved.data) {
        await admin.from("widget_audit_logs").insert({ client_id: saved.data.id, action: `subscription.${subscription.status}`, details: { stripe_subscription_id: subscription.id } });
        if (status === "cancelled") await sendWidgetLifecycleEmail({ customerEmail: saved.data.email, companyName: saved.data.company_name, event: "cancelled" });
      }
    }

    await admin.from("widget_webhook_events").insert({ event_id: event.id, event_type: event.type });
    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Widget webhook processing failed." }, { status: 500 });
  }
}
