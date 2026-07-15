import "server-only";

import type Stripe from "stripe";
import type { WidgetBillingSummary } from "@/lib/widget/customerTypes";
import type { WidgetClient } from "@/lib/widget/types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type WidgetBillingClient = Pick<
  WidgetClient,
  | "plan"
  | "status"
  | "monthly_price"
  | "currency"
  | "stripe_customer_id"
  | "stripe_subscription_id"
  | "stripe_subscription_status"
>;

type StripeObjectRef = string | { id: string } | null | undefined;

type SubscriptionItemLike = {
  current_period_start?: number | null;
  current_period_end?: number | null;
  quantity?: number | null;
  price?: {
    unit_amount?: number | null;
    currency?: string | null;
  } | null;
};

type SubscriptionLike = Stripe.Subscription & {
  collection_method?: string | null;
  cancel_at_period_end?: boolean;
  cancel_at?: number | null;
  ended_at?: number | null;
  items?: {
    data?: SubscriptionItemLike[];
  } | null;
};

type InvoiceLike = Stripe.Invoice & {
  subscription?: StripeObjectRef;
  parent?: {
    subscription_details?: {
      subscription?: StripeObjectRef;
    } | null;
  } | null;
  status_transitions?: {
    paid_at?: number | null;
  } | null;
  amount_paid?: number | null;
  currency?: string | null;
  status?: string | null;
  created?: number | null;
};

export function stripeObjectId(value: StripeObjectRef) {
  return typeof value === "string" ? value : value?.id ?? null;
}

export function unixToIso(value: number | null | undefined) {
  if (!value || !Number.isFinite(value)) return null;
  return new Date(value * 1000).toISOString();
}

export function daysUntilIso(value: string | null) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.ceil((timestamp - Date.now()) / MS_PER_DAY));
}

function moneyToCents(value: unknown) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return null;
  return Math.round(numberValue * 100);
}

function subscriptionItems(subscription: SubscriptionLike | null) {
  return subscription?.items?.data?.filter(Boolean) ?? [];
}

function subscriptionAmountCents(subscription: SubscriptionLike | null, client: WidgetBillingClient) {
  const amount = subscriptionItems(subscription).reduce((total, item) => {
    const unitAmount = Number(item.price?.unit_amount ?? 0);
    const quantity = Number(item.quantity ?? 1);
    if (!Number.isFinite(unitAmount) || !Number.isFinite(quantity)) return total;
    return total + unitAmount * Math.max(1, quantity);
  }, 0);
  return amount > 0 ? amount : moneyToCents(client.monthly_price);
}

function subscriptionCurrency(subscription: SubscriptionLike | null, client: WidgetBillingClient) {
  return (
    subscriptionItems(subscription).find((item) => item.price?.currency)?.price?.currency ??
    client.currency ??
    null
  )?.toLowerCase() ?? null;
}

function invoiceSubscriptionId(invoice: InvoiceLike) {
  return stripeObjectId(invoice.subscription) ?? stripeObjectId(invoice.parent?.subscription_details?.subscription);
}

function latestPaidInvoice(invoices: InvoiceLike[], subscriptionId: string | null) {
  return invoices
    .filter((invoice) => {
      if (subscriptionId && invoiceSubscriptionId(invoice) && invoiceSubscriptionId(invoice) !== subscriptionId) return false;
      return invoice.status === "paid" || Number(invoice.amount_paid ?? 0) > 0;
    })
    .sort((a, b) => {
      const aPaidAt = a.status_transitions?.paid_at ?? a.created ?? 0;
      const bPaidAt = b.status_transitions?.paid_at ?? b.created ?? 0;
      return bPaidAt - aPaidAt;
    })[0] ?? null;
}

export function buildUnlinkedWidgetBillingSummary(client?: Partial<WidgetBillingClient> | null): WidgetBillingSummary {
  const localPrice = client ? moneyToCents(client.monthly_price) : null;
  return {
    billing_profile_linked: false,
    subscription_linked: false,
    source: "unlinked",
    plan: client?.plan ?? null,
    status: client?.status ?? null,
    local_status: client?.status ?? null,
    stripe_status: client?.stripe_subscription_status ?? null,
    amount_due_cents: localPrice,
    currency: client?.currency?.toLowerCase() ?? null,
    last_payment_at: null,
    last_payment_amount_cents: null,
    next_payment_at: null,
    next_payment_amount_cents: null,
    current_period_start: null,
    current_period_end: null,
    days_until_next_payment: null,
    days_until_period_end: null,
    cancel_at_period_end: false,
    ends_at: null,
    collection_method: null,
    message: "No Stripe billing profile is linked to this widget yet.",
    action: "view_plans",
  };
}

export function buildLocalWidgetBillingSummary(
  client: WidgetBillingClient,
  message = "Live Stripe billing details could not be loaded. Open the billing portal for exact invoice data."
): WidgetBillingSummary {
  const localAmount = moneyToCents(client.monthly_price);
  return {
    billing_profile_linked: Boolean(client.stripe_customer_id || client.stripe_subscription_id),
    subscription_linked: Boolean(client.stripe_subscription_id),
    source: "local",
    plan: client.plan,
    status: client.stripe_subscription_status ?? client.status,
    local_status: client.status,
    stripe_status: client.stripe_subscription_status,
    amount_due_cents: localAmount,
    currency: client.currency?.toLowerCase() ?? null,
    last_payment_at: null,
    last_payment_amount_cents: null,
    next_payment_at: null,
    next_payment_amount_cents: localAmount,
    current_period_start: null,
    current_period_end: null,
    days_until_next_payment: null,
    days_until_period_end: null,
    cancel_at_period_end: false,
    ends_at: null,
    collection_method: null,
    message,
    action: client.stripe_customer_id || client.stripe_subscription_id ? "manage_billing" : "view_plans",
  };
}

export function buildStripeWidgetBillingSummary({
  client,
  subscription,
  invoices,
}: {
  client: WidgetBillingClient;
  subscription: SubscriptionLike | null;
  invoices: InvoiceLike[];
}): WidgetBillingSummary {
  if (!subscription) return buildLocalWidgetBillingSummary(client, "No active Stripe subscription details were found for this widget.");
  const item = subscriptionItems(subscription)[0] ?? null;
  const subscriptionId = stripeObjectId(subscription.id);
  const lastInvoice = latestPaidInvoice(invoices, subscriptionId);
  const currentPeriodStart = unixToIso(item?.current_period_start);
  const currentPeriodEnd = unixToIso(item?.current_period_end);
  const cancelAtPeriodEnd = Boolean(subscription.cancel_at_period_end);
  const endsAt = unixToIso(subscription.cancel_at ?? subscription.ended_at ?? (cancelAtPeriodEnd ? item?.current_period_end : null));
  const activeLike = ["active", "trialing", "past_due"].includes(subscription.status);
  const amountDueCents = subscriptionAmountCents(subscription, client);
  const nextPaymentAt = activeLike && !cancelAtPeriodEnd ? currentPeriodEnd : null;

  return {
    billing_profile_linked: true,
    subscription_linked: true,
    source: "stripe",
    plan: client.plan,
    status: subscription.status,
    local_status: client.status,
    stripe_status: subscription.status,
    amount_due_cents: amountDueCents,
    currency: subscriptionCurrency(subscription, client),
    last_payment_at: unixToIso(lastInvoice?.status_transitions?.paid_at ?? lastInvoice?.created),
    last_payment_amount_cents: lastInvoice ? Number(lastInvoice.amount_paid ?? 0) : null,
    next_payment_at: nextPaymentAt,
    next_payment_amount_cents: nextPaymentAt ? amountDueCents : null,
    current_period_start: currentPeriodStart,
    current_period_end: currentPeriodEnd,
    days_until_next_payment: daysUntilIso(nextPaymentAt),
    days_until_period_end: daysUntilIso(currentPeriodEnd),
    cancel_at_period_end: cancelAtPeriodEnd,
    ends_at: endsAt,
    collection_method: subscription.collection_method ?? null,
    message: cancelAtPeriodEnd
      ? "This subscription is scheduled to end at the current period boundary."
      : null,
    action: "manage_billing",
  };
}
