export const widgetLanguageCodes = [
  "de", "en", "tr", "fr", "es", "it", "nl", "pl", "ro", "pt", "ru", "ar",
] as const;

export type WidgetLanguage = (typeof widgetLanguageCodes)[number];
export type WidgetTheme = "light" | "dark" | "auto";
export type WidgetClientStatus = "pending" | "active" | "past_due" | "suspended" | "cancelled";

export type WidgetSettings = {
  id: string;
  widget_product_enabled: boolean;
  public_signup_enabled: boolean;
  checkout_enabled: boolean;
  demo_enabled: boolean;
  monthly_price: number;
  currency: string;
  default_language: WidgetLanguage;
  enabled_languages: WidgetLanguage[];
  require_domain_whitelist: boolean;
  show_mg_branding: boolean;
  usage_logging_enabled: boolean;
  default_monthly_usage_limit: number;
  allow_script_embed: boolean;
  allow_iframe_embed: boolean;
  created_at?: string;
  updated_at?: string;
};

export type WidgetClient = {
  id: string;
  user_id: string | null;
  company_name: string;
  email: string;
  website_domain: string;
  allowed_domain: string;
  allow_www_alias: boolean;
  allow_subdomains: boolean;
  domain_verified: boolean;
  status: WidgetClientStatus;
  admin_suspended: boolean;
  widget_enabled: boolean;
  plan: string;
  monthly_price: number;
  currency: string;
  widget_title: string;
  button_text: string;
  enquiry_email: string | null;
  whatsapp_number: string | null;
  email_enquiries_enabled: boolean;
  whatsapp_enquiries_enabled: boolean;
  main_color: string;
  button_text_color: string;
  difference_color: string;
  theme_mode: WidgetTheme;
  default_language: WidgetLanguage;
  allowed_languages: WidgetLanguage[];
  show_branding: boolean;
  allow_script_embed: boolean;
  allow_iframe_embed: boolean;
  can_edit_colours: boolean;
  can_edit_language: boolean;
  can_edit_contact: boolean;
  can_hide_branding: boolean;
  monthly_usage_limit: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_subscription_status: string | null;
  created_at: string;
  updated_at: string;
};

export type WidgetPublicConfig = Pick<
  WidgetClient,
  | "widget_title"
  | "button_text"
  | "main_color"
  | "button_text_color"
  | "difference_color"
  | "theme_mode"
  | "show_branding"
> & {
  language: WidgetLanguage;
  direction: "ltr" | "rtl";
  sessionToken: string;
  apiBaseUrl: string;
  allowedOrigin: string;
};

export type WidgetValidationResult = {
  valid: boolean;
  clientId?: string;
  client?: WidgetClient;
  settings?: WidgetSettings;
  language?: WidgetLanguage;
  requestDomain?: string;
  requestOrigin?: string;
  reason?: string;
};

export const defaultWidgetSettings: WidgetSettings = {
  id: "default",
  widget_product_enabled: true,
  public_signup_enabled: true,
  checkout_enabled: true,
  demo_enabled: true,
  monthly_price: 4.99,
  currency: "eur",
  default_language: "de",
  enabled_languages: [...widgetLanguageCodes],
  require_domain_whitelist: true,
  show_mg_branding: true,
  usage_logging_enabled: true,
  default_monthly_usage_limit: 5000,
  allow_script_embed: true,
  allow_iframe_embed: true,
};

export function isWidgetLanguage(value: unknown): value is WidgetLanguage {
  return typeof value === "string" && widgetLanguageCodes.includes(value as WidgetLanguage);
}

export function sanitizeWidgetLanguages(value: unknown, fallback: WidgetLanguage[] = ["en"]) {
  if (!Array.isArray(value)) return fallback;
  const values = [...new Set(value.filter(isWidgetLanguage))];
  return values.length ? values : fallback;
}
