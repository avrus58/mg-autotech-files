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
  | "email"
  | "plan"
  | "status"
  | "monthly_price"
  | "currency"
  | "stripe_customer_id"
  | "stripe_subscription_id"
  | "stripe_subscription_status"
>;

const SELECT_FIELDS =
  "id, email, plan, status, monthly_price, currency, stripe_customer_id, stripe_subscription_id, stripe_subscription_status";

class WidgetBillingOwnershipError extends Error {}

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
  if (!client.stripe_subscription_id) {
    return safeJson(buildLocalWidgetBillingSummary(client));
  }

  let stripe: Stripe;
  try {
    stripe = getStripe();
  } catch {
    return safeJson(buildLocalWidgetBillingSummary(client, "Stripe billing is not configured for live invoice lookup."));
  }

  try {
    const subscription = await retrieveSubscription(stripe, client.stripe_subscription_id);
    const stripeCustomerId = stripeObjectId(subscription.customer);
    if (
      subscription.metadata.product !== "vehicle_widget" ||
      subscription.metadata.widget_client_id !== client.id ||
      !stripeCustomerId ||
      (client.stripe_customer_id && client.stripe_customer_id !== stripeCustomerId)
    ) {
      throw new WidgetBillingOwnershipError();
    }

    const invoices = (await stripe.invoices.list({ customer: stripeCustomerId, limit: 10 })).data;

    return safeJson(buildStripeWidgetBillingSummary({ client, subscription, invoices }));
  } catch (error) {
    if (error instanceof WidgetBillingOwnershipError) {
      return NextResponse.json(
        { error: "Widget billing ownership could not be verified." },
        { status: 409, headers: { "Cache-Control": "private, no-store" } },
      );
    }
    return safeJson(buildLocalWidgetBillingSummary(client));
  }
}
