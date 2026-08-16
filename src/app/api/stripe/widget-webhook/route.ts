import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import {
  sendNewWidgetSubscriberNotification,
  sendWidgetLifecycleEmail,
} from "@/lib/email";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  readStripeWebhookBody,
  StripeWebhookBodyError,
} from "@/lib/stripePaymentSecurity";
import { createWidgetPublicKey } from "@/lib/widget/keys";
import { canonicalWidgetDomain } from "@/lib/widget/domain";

type InvoiceWithSubscription = Stripe.Invoice & {
  subscription?: string | Stripe.Subscription | null;
  parent?: {
    subscription_details?: {
      subscription?: string | Stripe.Subscription | null;
    };
  } | null;
};

type WidgetSubscriptionClient = {
  id: string;
  email: string;
  company_name: string;
  admin_suspended: boolean;
  status: string;
  stripe_customer_id: string | null;
  stripe_last_event_created: number | string | null;
};

type WidgetWebhookClaim = {
  processing_state: "processing" | "failed" | "processed";
  claim_token: string | null;
  claimed_at: string | null;
  attempt_count: number | string | null;
};

function objectId(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id ?? null;
}

function invoiceSubscriptionId(invoice: InvoiceWithSubscription) {
  return objectId(invoice.subscription) ||
    objectId(invoice.parent?.subscription_details?.subscription);
}

function localStatus(stripeStatus: Stripe.Subscription.Status) {
  if (stripeStatus === "active" || stripeStatus === "trialing") return "active";
  if (stripeStatus === "past_due") return "past_due";
  if (stripeStatus === "canceled" || stripeStatus === "incomplete_expired") {
    return "cancelled";
  }
  return "suspended";
}

const widgetClientIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WIDGET_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret) {
    return NextResponse.json(
      { error: "Widget webhook is not configured." },
      { status: 500 }
    );
  }
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
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const claimTime = new Date().toISOString();
  const claimToken = randomUUID();
  const claim = await admin
    .from("widget_webhook_events")
    .insert({
      event_id: event.id,
      event_type: event.type,
      processing_state: "processing",
      claim_token: claimToken,
      claimed_at: claimTime,
      attempt_count: 1,
      last_error: null,
      processed_at: claimTime,
    })
    .select("event_id")
    .maybeSingle();

  if (claim.error) {
    if (claim.error.code !== "23505") {
      return NextResponse.json(
        { error: "Widget webhook state is unavailable." },
        { status: 503 }
      );
    }
    const existing = await admin
      .from("widget_webhook_events")
      .select("processing_state, claim_token, claimed_at, attempt_count")
      .eq("event_id", event.id)
      .maybeSingle();
    if (existing.error || !existing.data) {
      return NextResponse.json(
        { error: "Widget webhook state is unavailable." },
        { status: 503 }
      );
    }
    if (existing.data.processing_state === "processed") {
      return NextResponse.json({ received: true, duplicate: true });
    }

    const staleBefore = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const previous = existing.data as WidgetWebhookClaim;
    let reclaimQuery = admin
      .from("widget_webhook_events")
      .update({
        processing_state: "processing",
        claim_token: claimToken,
        claimed_at: claimTime,
        event_type: event.type,
        attempt_count: Number(previous.attempt_count ?? 0) + 1,
        last_error: null,
      })
      .eq("event_id", event.id)
      .eq("processing_state", previous.processing_state);
    if (previous.processing_state === "processing") {
      reclaimQuery = reclaimQuery.lt("claimed_at", staleBefore);
      reclaimQuery = previous.claim_token
        ? reclaimQuery.eq("claim_token", previous.claim_token)
        : reclaimQuery.is("claim_token", null);
    }
    const reclaimed = await reclaimQuery.select("event_id").maybeSingle();
    if (reclaimed.error) {
      return NextResponse.json(
        { error: "Widget webhook state is unavailable." },
        { status: 503 }
      );
    }
    if (!reclaimed.data) {
      return NextResponse.json(
        { error: "Widget webhook processing is already in progress." },
        { status: 409, headers: { "Retry-After": "5" } }
      );
    }
  }

  const failClaim = async () => {
    await admin
      .from("widget_webhook_events")
      .update({
        processing_state: "failed",
        claim_token: null,
        last_error: "Widget webhook processing failed.",
      })
      .eq("event_id", event.id)
      .eq("processing_state", "processing")
      .eq("claim_token", claimToken);
  };

  const writeWebhookAudit = async (input: {
    clientId: string;
    effectKey: string;
    action: string;
    details: Record<string, unknown>;
  }) => {
    const audit = await admin
      .from("widget_audit_logs")
      .insert({
        client_id: input.clientId,
        source_event_id: event.id,
        effect_key: input.effectKey,
        action: input.action,
        details: input.details,
      })
      .select("details")
      .maybeSingle();
    if (audit.error && audit.error.code !== "23505") {
      throw new Error("Widget subscription audit could not be saved.");
    }
    if (audit.data) return audit.data.details as Record<string, unknown>;
    const existingAudit = await admin
      .from("widget_audit_logs")
      .select("details")
      .eq("source_event_id", event.id)
      .eq("effect_key", input.effectKey)
      .maybeSingle();
    if (existingAudit.error || !existingAudit.data) {
      throw new Error("Widget subscription audit could not be verified.");
    }
    return existingAudit.data.details as Record<string, unknown>;
  };

  const runWebhookEmailEffect = async (
    effectKey: string,
    send: (providerIdempotencyKey: string) => Promise<void>,
  ) => {
    const registered = await admin.from("widget_webhook_effects").insert({
      event_id: event.id,
      effect_key: effectKey,
      effect_state: "pending",
      attempt_count: 0,
    });
    if (registered.error && registered.error.code !== "23505") {
      throw new Error("Widget webhook effect state is unavailable.");
    }
    const current = await admin
      .from("widget_webhook_effects")
      .select("effect_state,attempt_count")
      .eq("event_id", event.id)
      .eq("effect_key", effectKey)
      .maybeSingle();
    if (current.error || !current.data) {
      throw new Error("Widget webhook effect state is unavailable.");
    }
    if (current.data.effect_state === "completed") return;

    const attemptCount = Number(current.data.attempt_count ?? 0) + 1;
    try {
      await send(`widget:${event.id}:${effectKey}`);
      const completedEffect = await admin
        .from("widget_webhook_effects")
        .update({
          effect_state: "completed",
          attempt_count: attemptCount,
          last_error: null,
          completed_at: new Date().toISOString(),
        })
        .eq("event_id", event.id)
        .eq("effect_key", effectKey)
        .eq("effect_state", "pending")
        .select("event_id")
        .maybeSingle();
      if (completedEffect.error || !completedEffect.data) {
        throw new Error("Widget webhook effect completion could not be saved.");
      }
    } catch (error) {
      await admin
        .from("widget_webhook_effects")
        .update({
          attempt_count: attemptCount,
          last_error: error instanceof Error ? error.message.slice(0, 500) : "Widget e-mail failed.",
        })
        .eq("event_id", event.id)
        .eq("effect_key", effectKey)
        .eq("effect_state", "pending");
      throw error;
    }
  };

  const reconcileSubscription = async (
    subscriptionId: string,
    fallbackSubscription?: Stripe.Subscription
  ) => {
    const clientResult = await admin
      .from("widget_clients")
      .select("id,email,company_name,admin_suspended,status,stripe_customer_id,stripe_last_event_created")
      .eq("stripe_subscription_id", subscriptionId)
      .maybeSingle();
    if (clientResult.error) {
      throw new Error("Widget subscription state could not be loaded.");
    }
    if (!clientResult.data) return;

    const client = clientResult.data as WidgetSubscriptionClient;
    if (event.created < Number(client.stripe_last_event_created ?? 0)) return;

    let subscription: Stripe.Subscription;
    try {
      subscription = await stripe.subscriptions.retrieve(subscriptionId);
    } catch (error) {
      if (!fallbackSubscription || event.type !== "customer.subscription.deleted") {
        throw error;
      }
      subscription = fallbackSubscription;
    }

    const customerId = objectId(subscription.customer);
    if (
      subscription.id !== subscriptionId ||
      subscription.metadata.product !== "vehicle_widget" ||
      subscription.metadata.widget_client_id !== client.id ||
      !customerId ||
      (client.stripe_customer_id && client.stripe_customer_id !== customerId)
    ) {
      throw new Error("Widget subscription ownership could not be verified.");
    }

    const stripeStatus = subscription.status;
    const resolvedStatus = client.admin_suspended
      ? "suspended"
      : localStatus(stripeStatus);
    const enabled = !client.admin_suspended && resolvedStatus === "active";
    const saved = await admin
      .from("widget_clients")
      .update({
        status: resolvedStatus,
        widget_enabled: enabled,
        stripe_subscription_status: stripeStatus,
        stripe_customer_id: customerId,
        stripe_last_event_created: event.created,
        stripe_last_event_id: event.id,
      })
      .eq("id", client.id)
      .eq("stripe_subscription_id", subscriptionId)
      .lte("stripe_last_event_created", event.created)
      .select("id,email,company_name")
      .maybeSingle();
    if (saved.error) {
      throw new Error("Widget subscription state could not be saved.");
    }
    if (!saved.data) return;
    const savedClient = saved.data;

    const auditDetails = await writeWebhookAudit({
      clientId: savedClient.id,
      effectKey: "subscription.reconciled",
      action: `stripe.${event.type}`,
      details: {
        stripe_subscription_id: subscriptionId,
        stripe_status: stripeStatus,
        stripe_event_id: event.id,
        notify_cancelled: resolvedStatus === "cancelled" && client.status !== "cancelled",
        notify_payment_failed: event.type === "invoice.payment_failed" && !enabled,
      },
    });

    if (auditDetails.notify_cancelled === true) {
      await runWebhookEmailEffect("customer.cancelled", (idempotencyKey) =>
        sendWidgetLifecycleEmail({
          customerEmail: savedClient.email,
          companyName: savedClient.company_name,
          event: "cancelled",
          idempotencyKey,
        })
      );
    } else if (auditDetails.notify_payment_failed === true) {
      await runWebhookEmailEffect("customer.payment_failed", (idempotencyKey) =>
        sendWidgetLifecycleEmail({
          customerEmail: savedClient.email,
          companyName: savedClient.company_name,
          event: "payment_failed",
          idempotencyKey,
        })
      );
    }
  };

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.product === "vehicle_widget") {
        const clientId = session.metadata.widget_client_id;
        if (!widgetClientIdPattern.test(clientId ?? "")) {
          throw new Error("Widget checkout metadata is invalid.");
        }
        const expectedClient = await admin
          .from("widget_clients")
          .select("id,user_id,email,allowed_domain,canonical_domain,status,admin_suspended,stripe_customer_id,stripe_subscription_id,stripe_checkout_session_id,stripe_last_event_created")
          .eq("id", clientId)
          .maybeSingle();
        if (expectedClient.error || !expectedClient.data) {
          throw new Error("Widget checkout client could not be verified.");
        }
        if (event.created < Number(expectedClient.data.stripe_last_event_created ?? 0)) {
          // A newer cancellation or subscription transition already won.
        } else {
          const subscriptionId = objectId(session.subscription);
          const customerId = objectId(session.customer);
          if (session.mode !== "subscription" || !subscriptionId || !customerId) {
            throw new Error("Widget checkout billing identifiers are invalid.");
          }
          const expectedActor = session.metadata.authenticated_user_id || null;
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const subscriptionActor = subscription.metadata.authenticated_user_id || null;
          const checkoutEmail = normalizeEmail(session.customer_details?.email);
          const existingBindingMatches =
            expectedClient.data.stripe_customer_id === customerId &&
            expectedClient.data.stripe_subscription_id === subscriptionId;
          const pristinePendingBinding =
            expectedClient.data.status === "pending" &&
            !expectedClient.data.stripe_customer_id &&
            !expectedClient.data.stripe_subscription_id;
          if (
            normalizeEmail(session.metadata.email) !== normalizeEmail(expectedClient.data.email) ||
            canonicalWidgetDomain(session.metadata.allowed_domain || "") !== expectedClient.data.canonical_domain ||
            (checkoutEmail && checkoutEmail !== normalizeEmail(expectedClient.data.email)) ||
            subscription.metadata.product !== "vehicle_widget" ||
            subscription.metadata.widget_client_id !== clientId ||
            (normalizeEmail(subscription.metadata.email) &&
              normalizeEmail(subscription.metadata.email) !== normalizeEmail(expectedClient.data.email)) ||
            canonicalWidgetDomain(subscription.metadata.allowed_domain || "") !== expectedClient.data.canonical_domain ||
            objectId(subscription.customer) !== customerId ||
            subscriptionActor !== expectedActor ||
            !expectedActor ||
            expectedClient.data.user_id !== expectedActor ||
            (expectedClient.data.stripe_checkout_session_id &&
              expectedClient.data.stripe_checkout_session_id !== session.id) ||
            (expectedClient.data.stripe_customer_id && expectedClient.data.stripe_customer_id !== customerId) ||
            (expectedClient.data.stripe_subscription_id && expectedClient.data.stripe_subscription_id !== subscriptionId) ||
            (!pristinePendingBinding && !existingBindingMatches)
          ) {
            throw new Error("Widget checkout ownership could not be verified.");
          }

          const stripeStatus = subscription.status;
          const activate = !expectedClient.data.admin_suspended &&
            session.payment_status === "paid" &&
            ["active", "trialing"].includes(stripeStatus);
          const checkoutStatus = expectedClient.data.admin_suspended
            ? "suspended"
            : activate
              ? "active"
              : session.payment_status === "paid"
                ? localStatus(stripeStatus)
                : "pending";
          let saveClient = admin
            .from("widget_clients")
            .update({
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              stripe_subscription_status: stripeStatus,
              status: checkoutStatus,
              widget_enabled: activate,
              checkout_pending_until: null,
              checkout_claim_token: null,
              checkout_claimed_at: null,
              stripe_last_event_created: event.created,
              stripe_last_event_id: event.id,
            })
            .eq("id", clientId)
            .eq("user_id", expectedActor)
            .eq("email", expectedClient.data.email)
            .eq("canonical_domain", expectedClient.data.canonical_domain)
            .eq("status", expectedClient.data.status)
            .eq("admin_suspended", expectedClient.data.admin_suspended)
            .lte("stripe_last_event_created", event.created);
          saveClient = expectedClient.data.stripe_customer_id
            ? saveClient.eq("stripe_customer_id", expectedClient.data.stripe_customer_id)
            : saveClient.is("stripe_customer_id", null);
          saveClient = expectedClient.data.stripe_subscription_id
            ? saveClient.eq("stripe_subscription_id", expectedClient.data.stripe_subscription_id)
            : saveClient.is("stripe_subscription_id", null);
          const saved = await saveClient
            .select("id,email,company_name")
            .maybeSingle();
          if (saved.error || !saved.data) {
            throw new Error("Widget checkout binding changed during reconciliation.");
          }
          const savedClient = saved.data;
          const sessionMetadata = session.metadata ?? {};

          const key = await admin
            .from("widget_api_keys")
            .select("id")
            .eq("client_id", clientId)
            .eq("is_active", true)
            .maybeSingle();
          if (key.error) throw new Error("Widget API key state could not be verified.");
          if (!key.data) {
            const insertedKey = await admin.from("widget_api_keys").insert({
              client_id: clientId,
              public_key: createWidgetPublicKey(),
            });
            if (insertedKey.error && insertedKey.error.code !== "23505") {
              throw new Error("Widget API key could not be created.");
            }
          }

          const auditDetails = await writeWebhookAudit({
            clientId,
            effectKey: "checkout.completed",
            action: "subscription.checkout_completed",
            details: {
              stripe_session_id: session.id,
              stripe_subscription_id: subscriptionId,
              stripe_event_id: event.id,
              active: activate,
              notify_activated: activate,
            },
          });
          if (auditDetails.notify_activated === true) {
            await runWebhookEmailEffect("customer.activated", (idempotencyKey) =>
              sendWidgetLifecycleEmail({
                customerEmail: savedClient.email,
                companyName: savedClient.company_name,
                event: "activated",
                idempotencyKey,
              })
            );
            await runWebhookEmailEffect("admin.new_subscriber", (idempotencyKey) =>
              sendNewWidgetSubscriberNotification({
                companyName: savedClient.company_name,
                customerEmail: savedClient.email,
                domain: sessionMetadata.allowed_domain || "-",
                subscriptionId,
                idempotencyKey,
              })
            );
          }
        }
      }
    } else if (
      event.type === "invoice.payment_succeeded" ||
      event.type === "invoice.payment_failed"
    ) {
      const invoice = event.data.object as InvoiceWithSubscription;
      const subscriptionId = invoiceSubscriptionId(invoice);
      if (subscriptionId) await reconcileSubscription(subscriptionId);
    } else if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const subscription = event.data.object as Stripe.Subscription;
      await reconcileSubscription(subscription.id, subscription);
    }

    const completed = await admin
      .from("widget_webhook_events")
      .update({
        processing_state: "processed",
        processed_at: new Date().toISOString(),
        claim_token: null,
        last_error: null,
      })
      .eq("event_id", event.id)
      .eq("processing_state", "processing")
      .eq("claim_token", claimToken)
      .select("event_id")
      .maybeSingle();
    if (completed.error || !completed.data) {
      throw new Error("Widget webhook completion could not be recorded.");
    }
    return NextResponse.json({ received: true });
  } catch {
    await failClaim();
    return NextResponse.json({ error: "Widget webhook processing failed." }, { status: 500 });
  }
}
