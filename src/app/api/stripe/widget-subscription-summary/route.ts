import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { requireApiUser } from "@/lib/apiAuth";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildLocalWidgetBillingSummary,
  buildStripeWidgetBillingSummary,
  buildUnlinkedWidgetBillingSummary,
  stripeObjectId,
} from "@/lib/widget/billingSummary";
import type { WidgetClient } from "@/lib/widget/types";

type WidgetBillingRow = Pick<
  WidgetClient,
  | "id"
  | "plan"
  | "status"
  | "monthly_price"
  | "currency"
  | "stripe_customer_id"
  | "stripe_subscription_id"
  | "stripe_subscription_status"
>;

const SELECT_FIELDS =
  "id, plan, status, monthly_price, currency, stripe_customer_id, stripe_subscription_id, stripe_subscription_status";

function safeJson(summary: unknown) {
  return NextResponse.json(
    { summary },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    }
  );
}

function normalizeClient(row: WidgetBillingRow): WidgetBillingRow {
  return {
    ...row,
    monthly_price: Number(row.monthly_price ?? 0),
    currency: (row.currency || "eur").toLowerCase(),
  };
}

async function retrieveSubscription(stripe: Stripe, subscriptionId: string) {
  return stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price", "latest_invoice"],
  }) as Promise<Stripe.Subscription>;
}

async function findLatestSubscription(stripe: Stripe, customerId: string) {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 5,
    expand: ["data.items.data.price", "data.latest_invoice"],
  });
  return subscriptions.data
    .sort((a, b) => (b.created ?? 0) - (a.created ?? 0))
    .find((subscription) => ["active", "trialing", "past_due", "canceled", "unpaid"].includes(subscription.status)) ?? null;
}

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = getSupabaseAdmin();
  const clientResult = await admin
    .from("widget_clients")
    .select(SELECT_FIELDS)
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (clientResult.error) {
    return NextResponse.json({ error: "Widget subscription summary could not be loaded." }, { status: 500 });
  }
  if (!clientResult.data) return safeJson(buildUnlinkedWidgetBillingSummary(null));

  const client = normalizeClient(clientResult.data as WidgetBillingRow);
  if (!client.stripe_customer_id && !client.stripe_subscription_id) {
    return safeJson(buildUnlinkedWidgetBillingSummary(client));
  }

  let stripe: Stripe;
  try {
    stripe = getStripe();
  } catch {
    return safeJson(buildLocalWidgetBillingSummary(client, "Stripe billing is not configured for live invoice lookup."));
  }

  try {
    let stripeCustomerId = client.stripe_customer_id;
    let subscription: Stripe.Subscription | null = null;

    if (client.stripe_subscription_id) {
      subscription = await retrieveSubscription(stripe, client.stripe_subscription_id);
      stripeCustomerId = stripeCustomerId ?? stripeObjectId(subscription.customer);
    }

    if (!subscription && stripeCustomerId) {
      subscription = await findLatestSubscription(stripe, stripeCustomerId);
    }

    if (!stripeCustomerId && subscription) {
      stripeCustomerId = stripeObjectId(subscription.customer);
    }

    const invoices = stripeCustomerId
      ? (await stripe.invoices.list({ customer: stripeCustomerId, limit: 10 })).data
      : [];

    return safeJson(buildStripeWidgetBillingSummary({ client, subscription, invoices }));
  } catch {
    return safeJson(buildLocalWidgetBillingSummary(client));
  }
}
