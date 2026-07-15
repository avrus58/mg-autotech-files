import type { WidgetClient } from "@/lib/widget/types";

export type CustomerWidgetClient = Omit<WidgetClient, "stripe_customer_id" | "stripe_subscription_id"> & {
  billing_profile_linked: boolean;
  subscription_linked: boolean;
};

export type WidgetBillingSummary = {
  billing_profile_linked: boolean;
  subscription_linked: boolean;
  source: "stripe" | "local" | "unlinked";
  plan: string | null;
  status: string | null;
  local_status: string | null;
  stripe_status: string | null;
  amount_due_cents: number | null;
  currency: string | null;
  last_payment_at: string | null;
  last_payment_amount_cents: number | null;
  next_payment_at: string | null;
  next_payment_amount_cents: number | null;
  current_period_start: string | null;
  current_period_end: string | null;
  days_until_next_payment: number | null;
  days_until_period_end: number | null;
  cancel_at_period_end: boolean;
  ends_at: string | null;
  collection_method: string | null;
  message: string | null;
  action: "manage_billing" | "view_plans" | "contact_support";
};
