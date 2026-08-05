import type { WidgetCommercialHealth, WidgetCommercialMetrics } from "@/lib/widget/commercial";
import type { WidgetClient } from "@/lib/widget/types";

export type AdminWidgetClient = Omit<
  WidgetClient,
  "stripe_customer_id" | "stripe_subscription_id"
> & {
  billing_profile_linked: boolean;
  subscription_linked: boolean;
};

export type AdminWidgetClientListItem = AdminWidgetClient & {
  metrics: WidgetCommercialMetrics;
  commercial: WidgetCommercialHealth;
};

export type WidgetAdminOverview = {
  total_clients: number;
  active_clients: number;
  live_clients: number;
  onboarding_clients: number;
  attention_clients: number;
  paused_clients: number;
  churned_clients: number;
  pending_domain_requests: number;
  enquiries_this_month: number;
  failed_enquiries_this_month: number;
  blocked_this_month: number;
  active_plan_value: number;
  currency: string | null;
};

export type WidgetAdminClientListPayload = {
  clients: AdminWidgetClientListItem[];
  overview: WidgetAdminOverview;
  metrics_source: "database_aggregate" | "compatibility_fallback";
};
