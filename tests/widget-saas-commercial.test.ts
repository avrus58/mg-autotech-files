import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  emptyWidgetCommercialMetrics,
  evaluateWidgetCommercialHealth,
  type WidgetCommercialClient,
} from "../src/lib/widget/commercial";
import {
  getWidgetIpHashSalt,
  getWidgetSessionSecret,
  validatePublicWidgetDomain,
  widgetRuntimeSecurityState,
} from "../src/lib/widget/security";

function source(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

function client(overrides: Partial<WidgetCommercialClient> = {}): WidgetCommercialClient {
  return {
    status: "active",
    widget_enabled: true,
    admin_suspended: false,
    domain_verified: true,
    monthly_usage_limit: 5000,
    stripe_subscription_status: "active",
    email_enquiries_enabled: true,
    enquiry_email: "leads@example.com",
    whatsapp_enquiries_enabled: false,
    whatsapp_number: null,
    ...overrides,
  };
}

test("widget domains accept exact public hostnames and reject internal or ambiguous hosts", () => {
  assert.deepEqual(validatePublicWidgetDomain("https://WWW.Example.com/path"), { valid: true, domain: "www.example.com" });
  for (const invalid of [
    "localhost",
    "127.0.0.1",
    "169.254.169.254",
    "metadata.google.internal",
    "widget.local",
    "*.example.com",
    "under_score.example.com",
    "example",
  ]) {
    assert.equal(validatePublicWidgetDomain(invalid).valid, false, invalid);
  }
});

test("widget session and privacy hashing require dedicated high-entropy configuration", () => {
  assert.throws(() => getWidgetSessionSecret({}), /at least 32 characters/);
  assert.throws(() => getWidgetIpHashSalt({ WIDGET_SESSION_SECRET: "short" }), /at least 32 characters/);
  assert.throws(() => getWidgetIpHashSalt({ WIDGET_SESSION_SECRET: "a".repeat(32) }), /WIDGET_IP_HASH_SALT/);
  assert.equal(getWidgetSessionSecret({ WIDGET_SESSION_SECRET: "a".repeat(32) }), "a".repeat(32));
  assert.equal(getWidgetIpHashSalt({ WIDGET_IP_HASH_SALT: "b".repeat(32) }), "b".repeat(32));
  assert.deepEqual(widgetRuntimeSecurityState({
    WIDGET_SESSION_SECRET: "a".repeat(32),
    WIDGET_IP_HASH_SALT: "b".repeat(32),
    SECURITY_DISTRIBUTED_RATE_LIMIT_ENABLED: "true",
    UPSTASH_REDIS_REST_URL: "https://redis.example.com",
    UPSTASH_REDIS_REST_TOKEN: "configured",
    SECURITY_RATE_LIMIT_SALT: "c".repeat(16),
  }), {
    dedicated_session_secret: true,
    dedicated_ip_hash_salt: true,
    distributed_rate_limit: true,
  });
});

test("commercial health distinguishes live, onboarding and critical accounts", () => {
  const liveMetrics = { ...emptyWidgetCommercialMetrics(), active_key_count: 1, usage_this_month: 80, enquiries_this_month: 3 };
  const live = evaluateWidgetCommercialHealth(client(), liveMetrics);
  assert.equal(live.stage, "live");
  assert.equal(live.level, "healthy");
  assert.equal(live.onboarding_completed, live.onboarding_total);

  const onboarding = evaluateWidgetCommercialHealth(client({ domain_verified: false }), { ...emptyWidgetCommercialMetrics(), active_key_count: 1 });
  assert.equal(onboarding.stage, "onboarding");
  assert.equal(onboarding.issues.some((issue) => issue.code === "domain_unverified"), true);

  const attention = evaluateWidgetCommercialHealth(client({ stripe_subscription_status: "past_due" }), { ...liveMetrics, failed_enquiries_this_month: 1 });
  assert.equal(attention.stage, "attention");
  assert.equal(attention.issues[0]?.severity, "critical");
  assert.equal(attention.issues.some((issue) => issue.code === "lead_delivery"), true);
});

test("commercial health reports usage risk without changing pricing or billing", () => {
  const health = evaluateWidgetCommercialHealth(client({ monthly_usage_limit: 100 }), {
    ...emptyWidgetCommercialMetrics(),
    active_key_count: 1,
    usage_this_month: 91,
  });
  assert.equal(health.usage_percent, 91);
  assert.equal(health.issues.some((issue) => issue.code === "usage_limit"), true);
});

test("admin widget APIs are permission protected and expose safe list projections", () => {
  const listRoute = source("src", "app", "api", "admin", "widget-clients", "route.ts");
  const detailRoute = source("src", "app", "api", "admin", "widget-clients", "[id]", "route.ts");
  const dataLoader = source("src", "lib", "widget", "adminData.ts");
  const types = source("src", "lib", "widget", "adminTypes.ts");

  assert.match(listRoute, /requireStaffPermission\(request, "widget\.manage"\)/);
  assert.match(detailRoute, /requireStaffPermission\(request, "widget\.manage"\)/g);
  assert.match(dataLoader, /widget_admin_commercial_metrics/);
  assert.match(dataLoader, /stripe_customer_id: _stripeCustomerId/);
  assert.match(dataLoader, /stripe_subscription_id: _stripeSubscriptionId/);
  assert.match(types, /billing_profile_linked/);
  assert.match(types, /subscription_linked/);
  assert.doesNotMatch(source("src", "app", "api", "admin", "widget-clients", "route.ts"), /public_key|stripe_customer_id|stripe_subscription_id/);
  assert.doesNotMatch(detailRoute, /select\("\*"\)/);
});

test("critical widget operations require reason, preserve Stripe ownership and reset domain evidence", () => {
  const route = source("src", "app", "api", "admin", "widget-clients", "[id]", "route.ts");
  assert.match(route, /actionsRequiringReason/);
  assert.match(route, /An audit reason is required/);
  assert.match(route, /Stripe-backed subscription cannot be cancelled locally/);
  assert.match(route, /domain_verified: false/);
  assert.match(route, /findDomainConflict/);
  assert.match(route, /widget_rotate_installation_key/);
  assert.match(route, /widget_resolve_domain_request/);
  assert.match(route, /could not be rotated atomically/);
  assert.match(route, /admin\.client_updated/);
  assert.match(route, /admin\.\$\{parsed\.data\.action\}/);
});

test("public checkout, domain changes and enquiries use abuse controls and exact domain collision checks", () => {
  const checkout = source("src", "app", "api", "stripe", "widget-checkout", "route.ts");
  const domain = source("src", "app", "api", "widget", "domain-change", "route.ts");
  const enquiry = source("src", "app", "api", "widget", "enquiry", "route.ts");
  for (const route of [checkout, domain, enquiry]) assert.match(route, /checkAdaptiveRateLimit/);
  assert.match(checkout, /validatePublicWidgetDomain/);
  assert.match(checkout, /Domain availability could not be verified/);
  assert.match(domain, /This domain is already linked to another widget subscription/);
  assert.match(domain, /This is already the active widget domain/);
  assert.match(enquiry, /widgetAbuseSubject/);
  assert.match(enquiry, /if \(recent\.error\)/);
  assert.doesNotMatch(enquiry, /missingEnquirySchema/);
  assert.doesNotMatch(checkout + domain, /clientResult\.error\.message|created\.error\.message/);
});

test("customer configuration rejects unsupported languages, empty lead channels and empty updates", () => {
  const customer = source("src", "app", "api", "widget", "client", "route.ts");
  const admin = source("src", "app", "api", "admin", "widget-clients", "[id]", "route.ts");
  for (const route of [customer, admin]) {
    assert.match(route, /z\.enum\(widgetLanguageCodes\)/);
    assert.match(route, /default language must remain/i);
    assert.match(route, /nextEnquiryEmail/);
    assert.match(route, /nextWhatsAppNumber/);
  }
  assert.match(customer, /No permitted widget settings were provided/);
  assert.match(admin, /No client settings were provided/);
});

test("live domain verification is evidence-based and not admin editable", () => {
  const validation = source("src", "lib", "widget", "validation.ts");
  const detailUi = source("src", "app", "admin", "widget-clients", "[id]", "page.tsx");
  assert.match(validation, /system\.live_origin_verified/);
  assert.match(validation, /eq\("domain_verified", false\)/);
  assert.match(validation, /if \(requestDomain\) await recordVerifiedOrigin/);
  assert.ok(validation.indexOf("if (requestDomain) await recordVerifiedOrigin") > validation.indexOf("withinRateLimit = await consumeWidgetRateLimit"));
  assert.match(validation, /return block\("usage_unavailable"/);
  assert.match(validation, /return block\("rate_limit_unavailable"/);
  assert.match(source("src", "lib", "widget", "usage.ts"), /if \(error\) throw error/);
  assert.doesNotMatch(detailUi, /label="Domain verified"/);
  assert.match(detailUi, /Waiting for first successful request/);
});

test("customer widget workspace excludes private identifiers and exposes only aggregate operational metrics", () => {
  const route = source("src", "app", "api", "widget", "client", "route.ts");
  const customerTypes = source("src", "lib", "widget", "customerTypes.ts");
  const dashboard = source("src", "components", "dashboard", "WidgetDashboardClient.tsx");
  assert.match(route, /WIDGET_CUSTOMER_CLIENT_FIELDS/);
  assert.match(route, /Object\.fromEntries\(safeFields\.map/);
  assert.match(route, /if \(claim\.error\) return \{ data: null, error: claim\.error \}/);
  assert.match(route, /if \(result\.error\) return result/);
  assert.match(route, /Widget ownership changed while the account was being linked/);
  assert.match(route, /loads_this_month/);
  assert.match(route, /failed_enquiries_this_month/);
  assert.match(route, /select\("id, requested_domain, status, created_at, resolved_at"\)/);
  assert.match(customerTypes, /CustomerWidgetWorkspaceMetrics/);
  assert.match(dashboard, /Installation readiness/);
  assert.match(dashboard, /Leads this month/);
  assert.doesNotMatch(dashboard, /stripe_customer_id|stripe_subscription_id|ip_hash|user_agent|admin_note|widget_audit_logs/);
});

test("global kill switch is confirmation protected and secrets are reported as booleans only", () => {
  const route = source("src", "app", "api", "admin", "widget-settings", "route.ts");
  const page = source("src", "app", "admin", "widget-settings", "page.tsx");
  assert.match(route, /DISABLE ALL WIDGETS/);
  assert.match(route, /widgetRuntimeSecurityState/);
  assert.match(route, /Domain allowlisting is required while public widget delivery is enabled/);
  assert.match(route, /Usage logging is required while commercial widget delivery is enabled/);
  assert.match(route, /At least one installation mode must remain enabled/);
  assert.match(page, /Emergency confirmation/);
  assert.match(page, /Secret values never leave the server/);
  assert.doesNotMatch(route + page, /WIDGET_SESSION_SECRET\s*[:=]|WIDGET_IP_HASH_SALT\s*[:=]|SUPABASE_SERVICE_ROLE_KEY/);
});

test("widget commercial SQL is additive, RLS-protected and closes default function grants", () => {
  const sql = source("scripts", "harden-widget-saas-commercial.sql");
  const verification = source("scripts", "verify-widget-saas-commercial.sql");
  assert.doesNotMatch(sql, /\b(drop|delete|truncate)\b/i);
  assert.match(sql, /security invoker/gi);
  assert.match(sql, /enable row level security/gi);
  assert.match(sql, /revoke all on table public\.widget_clients from public, anon, authenticated/);
  assert.match(sql, /revoke execute on function public\.widget_consume_rate_limit/);
  assert.match(sql, /to_regprocedure\('public\.cleanup_widget_operational_data\(\)'\)/);
  assert.match(sql, /alter function public\.touch_widget_updated_at\(\) set search_path = public/);
  assert.match(sql, /revoke execute on function public\.touch_widget_updated_at\(\)/);
  assert.match(sql, /widget_audit_logs_client_idx/);
  assert.match(sql, /widget_audit_logs_actor_user_idx/);
  assert.match(sql, /user_id = \(select auth\.uid\(\)\)/);
  assert.match(sql, /widget_admin_commercial_metrics/);
  assert.match(sql, /widget_clients_security_audit/);
  assert.match(sql, /widget_api_keys_lifecycle_audit/);
  assert.match(sql, /widget_clients_one_live_domain_idx/);
  assert.match(sql, /widget_api_keys_one_active_per_client_idx/);
  assert.match(sql, /widget_domain_requests_one_pending_per_client_idx/);
  assert.match(sql, /widget_rotate_installation_key/);
  assert.match(sql, /pk_mga_widget_\[A-Za-z0-9_-\]\{24\}/);
  assert.match(sql, /widget_resolve_domain_request/);
  assert.match(sql, /widget_settings_lifecycle_audit/);
  assert.match(verification, /has_function_privilege\('anon'/);
  assert.match(verification, /has_table_privilege\('authenticated'/);
  assert.doesNotMatch(verification, /\b(insert|update|delete|alter|drop|truncate)\b/i);
});

test("admin Widget SaaS UI exposes a commercial queue without unsafe one-click lifecycle mutations", () => {
  const list = source("src", "app", "admin", "widget-clients", "page.tsx");
  const detail = source("src", "app", "admin", "widget-clients", "[id]", "page.tsx");
  assert.match(list, /Widget SaaS Control Center/);
  assert.match(list, /Commercial action queue/);
  assert.match(list, /Needs attention/);
  assert.match(list, /Active plan value/);
  assert.doesNotMatch(list, /quickAction|copyEmbed|dashboard\.stripe\.com/);
  assert.match(detail, /Account health and next action/);
  assert.match(detail, /Security & install/);
  assert.match(detail, /Audited operation/);
  assert.match(detail, /Audit reason/);
  assert.match(source("src", "app", "api", "admin", "widget-clients", "[id]", "route.ts"), /Domain availability could not be verified/);
  assert.match(detail, /sm:grid-cols|xl:grid-cols/);
});
