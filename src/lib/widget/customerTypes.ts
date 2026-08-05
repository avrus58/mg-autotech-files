import type { WidgetClient } from "@/lib/widget/types";

export const WIDGET_CUSTOMER_CLIENT_FIELDS = [
  "id",
  "company_name",
  "email",
  "website_domain",
  "allowed_domain",
  "allow_www_alias",
  "allow_subdomains",
  "domain_verified",
  "status",
  "widget_enabled",
  "plan",
  "monthly_price",
  "currency",
  "widget_title",
  "button_text",
  "enquiry_email",
  "whatsapp_number",
  "email_enquiries_enabled",
  "whatsapp_enquiries_enabled",
  "main_color",
  "button_text_color",
  "difference_color",
  "theme_mode",
  "default_language",
  "allowed_languages",
  "show_branding",
  "allow_script_embed",
  "allow_iframe_embed",
  "can_edit_colours",
  "can_edit_language",
  "can_edit_contact",
  "can_hide_branding",
  "monthly_usage_limit",
  "stripe_subscription_status",
  "created_at",
  "updated_at",
].join(", ");

export type CustomerWidgetClient = Omit<
  WidgetClient,
  "stripe_customer_id" | "stripe_subscription_id" | "user_id" | "admin_suspended"
> & {
  billing_profile_linked: boolean;
  subscription_linked: boolean;
};

export type CustomerWidgetWorkspaceMetrics = {
  loads_this_month: number;
  enquiries_this_month: number;
  failed_enquiries_this_month: number;
  last_live_load_at: string | null;
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
