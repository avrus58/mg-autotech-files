import "server-only";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  AdminWidgetClient,
  AdminWidgetClientListItem,
  WidgetAdminClientListPayload,
  WidgetAdminOverview,
} from "@/lib/widget/adminTypes";
import {
  emptyWidgetCommercialMetrics,
  evaluateWidgetCommercialHealth,
  type WidgetCommercialMetrics,
} from "@/lib/widget/commercial";
import { sanitizeWidgetLanguages } from "@/lib/widget/types";

export const WIDGET_ADMIN_CLIENT_FIELDS = [
  "id",
  "user_id",
  "company_name",
  "email",
  "website_domain",
  "allowed_domain",
  "allow_www_alias",
  "allow_subdomains",
  "domain_verified",
  "status",
  "admin_suspended",
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
  "stripe_customer_id",
  "stripe_subscription_id",
  "stripe_subscription_status",
  "created_at",
  "updated_at",
].join(", ");

type DatabaseMetricRow = Partial<WidgetCommercialMetrics> & { client_id: string };

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapMetrics(row?: Partial<DatabaseMetricRow> | null): WidgetCommercialMetrics {
  const empty = emptyWidgetCommercialMetrics();
  if (!row) return empty;
  return {
    usage_this_month: numberValue(row.usage_this_month),
    blocked_this_month: numberValue(row.blocked_this_month),
    enquiries_this_month: numberValue(row.enquiries_this_month),
    failed_enquiries_this_month: numberValue(row.failed_enquiries_this_month),
    pending_domain_request_count: numberValue(row.pending_domain_request_count),
    active_key_count: numberValue(row.active_key_count),
    last_allowed_at: row.last_allowed_at ?? null,
    last_blocked_at: row.last_blocked_at ?? null,
    last_enquiry_at: row.last_enquiry_at ?? null,
    latest_requested_domain: row.latest_requested_domain ?? null,
  };
}

function mapAdminClient(row: Record<string, unknown>): AdminWidgetClient {
  const stripeCustomerId = typeof row.stripe_customer_id === "string" ? row.stripe_customer_id : null;
  const stripeSubscriptionId = typeof row.stripe_subscription_id === "string" ? row.stripe_subscription_id : null;
  const { stripe_customer_id: _stripeCustomerId, stripe_subscription_id: _stripeSubscriptionId, ...safe } = row;
  void _stripeCustomerId;
  void _stripeSubscriptionId;
  return {
    ...safe,
    monthly_price: numberValue(row.monthly_price),
    monthly_usage_limit: numberValue(row.monthly_usage_limit),
    allowed_languages: sanitizeWidgetLanguages(row.allowed_languages),
    email_enquiries_enabled: row.email_enquiries_enabled === undefined
      ? Boolean(row.enquiry_email)
      : Boolean(row.email_enquiries_enabled),
    whatsapp_enquiries_enabled: row.whatsapp_enquiries_enabled === undefined
      ? Boolean(row.whatsapp_number)
      : Boolean(row.whatsapp_enquiries_enabled),
    billing_profile_linked: Boolean(stripeCustomerId || stripeSubscriptionId),
    subscription_linked: Boolean(stripeSubscriptionId),
  } as AdminWidgetClient;
}

async function fallbackMetrics(clientId: string, since: string): Promise<WidgetCommercialMetrics> {
  const admin = getSupabaseAdmin();
  const [allowed, blocked, enquiries, failedEnquiries, keys, pendingDomains, latestAllowed, latestBlocked, latestEnquiry] = await Promise.all([
    admin.from("widget_access_logs").select("id", { count: "exact", head: true }).eq("client_id", clientId).eq("status", "allowed").in("path", ["/api/widget/config", "/embed/vehicle-selector"]).gte("created_at", since),
    admin.from("widget_access_logs").select("id", { count: "exact", head: true }).eq("client_id", clientId).eq("status", "blocked").gte("created_at", since),
    admin.from("widget_enquiries").select("id", { count: "exact", head: true }).eq("client_id", clientId).gte("created_at", since),
    admin.from("widget_enquiries").select("id", { count: "exact", head: true }).eq("client_id", clientId).eq("status", "delivery_failed").gte("created_at", since),
    admin.from("widget_api_keys").select("id", { count: "exact", head: true }).eq("client_id", clientId).eq("is_active", true),
    admin.from("widget_domain_change_requests").select("requested_domain, created_at").eq("client_id", clientId).eq("status", "pending").order("created_at", { ascending: false }).limit(20),
    admin.from("widget_access_logs").select("created_at").eq("client_id", clientId).eq("status", "allowed").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("widget_access_logs").select("created_at").eq("client_id", clientId).eq("status", "blocked").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("widget_enquiries").select("created_at").eq("client_id", clientId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const queries = [allowed, blocked, enquiries, failedEnquiries, keys, pendingDomains, latestAllowed, latestBlocked, latestEnquiry];
  const failed = queries.find((query) => query.error);
  if (failed?.error) throw failed.error;

  return {
    usage_this_month: allowed.count ?? 0,
    blocked_this_month: blocked.count ?? 0,
    enquiries_this_month: enquiries.count ?? 0,
    failed_enquiries_this_month: failedEnquiries.count ?? 0,
    active_key_count: keys.count ?? 0,
    pending_domain_request_count: pendingDomains.data?.length ?? 0,
    latest_requested_domain: pendingDomains.data?.[0]?.requested_domain ?? null,
    last_allowed_at: latestAllowed.data?.created_at ?? null,
    last_blocked_at: latestBlocked.data?.created_at ?? null,
    last_enquiry_at: latestEnquiry.data?.created_at ?? null,
  };
}

async function loadMetrics(clientIds: string[], since: string) {
  const admin = getSupabaseAdmin();
  const aggregate = await admin.rpc("widget_admin_commercial_metrics", { p_since: since });
  if (!aggregate.error && Array.isArray(aggregate.data)) {
    return {
      source: "database_aggregate" as const,
      metrics: new Map((aggregate.data as DatabaseMetricRow[]).map((row) => [row.client_id, mapMetrics(row)])),
    };
  }

  const metrics = new Map<string, WidgetCommercialMetrics>();
  for (let index = 0; index < clientIds.length; index += 10) {
    const batch = clientIds.slice(index, index + 10);
    const rows = await Promise.all(batch.map(async (clientId) => [clientId, await fallbackMetrics(clientId, since)] as const));
    rows.forEach(([clientId, value]) => metrics.set(clientId, value));
  }
  return { source: "compatibility_fallback" as const, metrics };
}

function overview(items: AdminWidgetClientListItem[]): WidgetAdminOverview {
  const active = items.filter((item) => item.status === "active" && item.widget_enabled && !item.admin_suspended);
  const activeCurrencies = [...new Set(active.map((item) => item.currency.toLowerCase()))];
  return {
    total_clients: items.length,
    active_clients: active.length,
    live_clients: items.filter((item) => item.commercial.stage === "live").length,
    onboarding_clients: items.filter((item) => ["prospect", "onboarding", "ready"].includes(item.commercial.stage)).length,
    attention_clients: items.filter((item) => item.commercial.stage === "attention").length,
    paused_clients: items.filter((item) => item.commercial.stage === "paused").length,
    churned_clients: items.filter((item) => item.commercial.stage === "churned").length,
    pending_domain_requests: items.reduce((sum, item) => sum + item.metrics.pending_domain_request_count, 0),
    enquiries_this_month: items.reduce((sum, item) => sum + item.metrics.enquiries_this_month, 0),
    failed_enquiries_this_month: items.reduce((sum, item) => sum + item.metrics.failed_enquiries_this_month, 0),
    blocked_this_month: items.reduce((sum, item) => sum + item.metrics.blocked_this_month, 0),
    active_plan_value: activeCurrencies.length === 1
      ? active.reduce((sum, item) => sum + item.monthly_price, 0)
      : 0,
    currency: activeCurrencies.length === 1 ? activeCurrencies[0] : null,
  };
}

export async function loadAdminWidgetClients(): Promise<WidgetAdminClientListPayload> {
  const admin = getSupabaseAdmin();
  const clients = await admin
    .from("widget_clients")
    .select(WIDGET_ADMIN_CLIENT_FIELDS)
    .order("created_at", { ascending: false })
    .limit(500);
  if (clients.error) throw clients.error;

  const rows = (clients.data ?? []) as unknown as Record<string, unknown>[];
  const clientIds = rows.map((row) => String(row.id));
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const metricResult = await loadMetrics(clientIds, monthStart.toISOString());
  const items = rows.map((row) => {
    const client = mapAdminClient(row);
    const metrics = metricResult.metrics.get(client.id) ?? emptyWidgetCommercialMetrics();
    return {
      ...client,
      metrics,
      commercial: evaluateWidgetCommercialHealth(client, metrics),
    } satisfies AdminWidgetClientListItem;
  });

  return {
    clients: items,
    overview: overview(items),
    metrics_source: metricResult.source,
  };
}

export function customerSafeAdminClient(row: Record<string, unknown>) {
  return mapAdminClient(row);
}
