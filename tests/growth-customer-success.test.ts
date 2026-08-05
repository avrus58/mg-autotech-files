import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  buildGrowthAttributionTouch,
  classifyGrowthSource,
  normalizeGrowthPath,
} from "../src/lib/growth/attribution";
import { hashGrowthVisitorId } from "../src/lib/growth/attributionServer";
import { buildGrowthMetrics } from "../src/lib/growth/metrics";
import { isGrowthReminderEligible } from "../src/lib/growth/reminders";
import { renderTransactionalEmailTemplate } from "../src/lib/email/templates";

function source(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

test("consented attribution keeps only normalized customer-safe acquisition fields", () => {
  const touch = buildGrowthAttributionTouch({
    url: "https://file.mgautotech.de/en/services/stage-1?utm_source=Google&utm_medium=CPC&utm_campaign=Workshop+Launch&utm_term=ecu+file&email=private@example.com",
    referrer: "https://www.google.de/search?q=private+query",
    locale: "en-GB",
  });
  assert.deepEqual(touch, {
    landingPath: "/en/services/stage-1",
    source: "google",
    medium: "cpc",
    campaign: "Workshop Launch",
    term: "ecu file",
    referrerHost: "google.de",
    locale: "en-gb",
  });
  assert.equal(JSON.stringify(touch).includes("private@example.com"), false);
  assert.equal(JSON.stringify(touch).includes("search?q"), false);
  assert.equal(normalizeGrowthPath("https://evil.example/private"), null);
});

test("source classification is deterministic and stores hostname rather than referrer URL", () => {
  assert.deepEqual(classifyGrowthSource({}), { source: "direct", medium: "none", referrerHost: null });
  assert.deepEqual(classifyGrowthSource({ referrer: "https://www.bing.com/search?q=ecu" }), {
    source: "bing",
    medium: "organic",
    referrerHost: "bing.com",
  });
  assert.deepEqual(classifyGrowthSource({ referrer: "https://example.org/path?customer=1" }), {
    source: "example.org",
    medium: "referral",
    referrerHost: "example.org",
  });
});

test("visitor identifiers are one-way HMAC fingerprints", () => {
  const visitor = "a2045883-4b18-4aa5-aac9-85dcda35a364";
  const first = hashGrowthVisitorId(visitor, "synthetic-test-secret-at-least-16");
  const second = hashGrowthVisitorId(visitor, "synthetic-test-secret-at-least-16");
  assert.equal(first, second);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(first.includes(visitor), false);
});

test("growth metrics join aggregate acquisition, requests, payments, retention and delivery safely", () => {
  const metrics = buildGrowthMetrics({
    startAt: new Date("2026-01-01T00:00:00.000Z"),
    endAt: new Date("2026-01-31T23:59:59.999Z"),
    profiles: [
      { id: "u1", customer_id: "MGA-1", role: "customer", country: "DE", created_at: "2026-01-02T00:00:00Z" },
      { id: "u2", customer_id: "MGA-2", role: "customer", country: "TR", created_at: "2026-01-03T00:00:00Z" },
      { id: "u3", customer_id: "MGA-3", role: "customer", country: "FR", created_at: "2026-01-04T00:00:00Z" },
      { id: "admin", role: "admin", created_at: "2026-01-01T00:00:00Z" },
    ],
    orders: [
      { id: "o1", customer_id: "u1", status: "completed", service_type: "Stage 1 + DTC OFF", vehicle_brand: "BMW", credits_required: 10, created_at: "2026-01-05T00:00:00Z" },
      { id: "o2", customer_id: "u1", status: "completed", service_type: "Stage 1", vehicle_brand: "BMW", credits_required: 8, created_at: "2026-01-20T00:00:00Z" },
      { id: "o3", customer_id: "u2", status: "new", service_type: "TCU Tune", vehicle_brand: "Mercedes-Benz", credits_required: 12, created_at: "2026-01-16T00:00:00Z" },
    ],
    payments: [
      { id: "p1", user_id: "u1", status: "succeeded", amount_total: 10_000, currency: "eur", created_at: "2026-01-06T00:00:00Z" },
      { id: "p2", user_id: "u2", status: "succeeded", amount_total: 5_000, currency: "eur", created_at: "2026-01-17T00:00:00Z" },
      { id: "p3", user_id: "u2", status: "failed", amount_total: 7_000, currency: "eur", created_at: "2026-01-18T00:00:00Z" },
      { id: "p4", user_id: "u1", type: "refund", amount_total: -2_000, currency: "eur", created_at: "2026-01-21T00:00:00Z" },
    ],
    emails: [
      { event_type: "request_abandoned_reminder", recipient_user_id: "u2", status: "sent", delivery_status: "delivered", created_at: "2026-01-15T00:00:00Z" },
      { event_type: "request_abandoned_reminder", recipient_user_id: "u1", status: "failed", delivery_status: "bounced", created_at: "2026-01-04T00:00:00Z" },
      { event_type: "request_created", recipient_user_id: "u1", status: "sent", delivery_status: "delivered", created_at: "2026-01-05T00:00:00Z" },
      { event_type: "request_created", recipient_user_id: "u2", status: "failed", delivery_status: "bounced", created_at: "2026-01-16T00:00:00Z" },
    ],
    attribution: [
      { user_id: "u1", locale: "de", first_source: "google", first_medium: "organic", first_campaign: null, first_term: null, first_landing_path: "/services/stage-1", first_country_code: "DE", first_seen_at: "2026-01-01T00:00:00Z" },
      { user_id: "u2", locale: "tr", first_source: "direct", first_medium: "none", first_campaign: null, first_term: null, first_landing_path: "/", first_country_code: "TR", first_seen_at: "2026-01-02T00:00:00Z" },
      { user_id: null, locale: "de-DE", first_source: "google", first_medium: "organic", first_campaign: null, first_term: null, first_landing_path: "/services/stage-1", first_country_code: "DE", first_seen_at: "2026-01-03T00:00:00Z" },
    ],
    journeyEvents: [],
  });

  assert.equal(metrics.funnel.consentedVisitors, 3);
  assert.equal(metrics.funnel.registrations, 3);
  assert.equal(metrics.funnel.customersWithRequests, 2);
  assert.equal(metrics.funnel.repeatCustomers, 1);
  assert.equal(metrics.retention.repeatCustomerRate, 0.5);
  assert.equal(metrics.revenue[0].grossAmountMinor, 15_000);
  assert.equal(metrics.revenue[0].refundedAmountMinor, 2_000);
  assert.equal(metrics.revenue[0].amountMinor, 13_000);
  assert.equal(metrics.revenue[0].refunds, 1);
  assert.equal(metrics.revenue[0].payingCustomers, 2);
  assert.equal(metrics.email.delivered, 2);
  assert.equal(metrics.email.reminderConversions, 1);
  assert.equal(metrics.byCountry.find((row) => row.key === "de")?.orders, 2);
  assert.equal(metrics.byLocale.find((row) => row.key === "de")?.orders, 2);
  assert.equal(metrics.byLocale.find((row) => row.key === "tr")?.registrations, 1);
  assert.equal(metrics.byBrand.find((row) => row.key === "bmw")?.repeatCustomers, 1);
  assert.equal(metrics.byService.find((row) => row.key === "stage 1")?.orders, 2);
  assert.equal(metrics.byService.find((row) => row.key === "dtc off")?.label, "DTC OFF");
});

test("service demand preserves human service names while splitting explicit separators", () => {
  const metrics = buildGrowthMetrics({
    startAt: new Date("2026-01-01T00:00:00.000Z"),
    endAt: new Date("2026-01-31T23:59:59.999Z"),
    profiles: [{ id: "u1", role: "customer", created_at: "2026-01-01T00:00:00Z" }],
    orders: [
      { id: "o1", customer_id: "u1", status: "completed", service_type: "Pop and Bangs + Stage 1", vehicle_brand: "BMW", credits_required: 10, created_at: "2026-01-02T00:00:00Z" },
    ],
    payments: [],
    emails: [],
    attribution: [],
    journeyEvents: [],
  });
  assert.equal(metrics.byService.find((row) => row.key === "pop and bangs")?.orders, 1);
  assert.equal(metrics.byService.find((row) => row.key === "stage 1")?.orders, 1);
  assert.equal(metrics.byService.some((row) => row.key === "pop" || row.key === "bangs"), false);
});

test("unfinished-request reminder remains opt-in, bounded, and single-action only", () => {
  const now = new Date("2026-02-10T12:00:00Z");
  const eligible = {
    startedAt: "2026-02-08T12:00:00Z",
    now,
    preferenceEnabled: true,
    hasLaterOrder: false,
    hasReminderAction: false,
    email: "synthetic@example.com",
    role: "customer",
    accountStatus: "active",
  };
  assert.equal(isGrowthReminderEligible(eligible), true);
  assert.equal(isGrowthReminderEligible({ ...eligible, preferenceEnabled: false }), false);
  assert.equal(isGrowthReminderEligible({ ...eligible, hasLaterOrder: true }), false);
  assert.equal(isGrowthReminderEligible({ ...eligible, hasReminderAction: true }), false);
  assert.equal(isGrowthReminderEligible({ ...eligible, startedAt: "2026-02-10T00:00:00Z" }), false);
  assert.equal(isGrowthReminderEligible({ ...eligible, role: "admin" }), false);
  assert.equal(isGrowthReminderEligible({ ...eligible, accountStatus: "blocked" }), false);
});

test("reminder templates are customer-safe in English, German, and Turkish", () => {
  for (const language of ["en", "de", "tr"] as const) {
    const rendered = renderTransactionalEmailTemplate("request_abandoned_reminder", {
      customerId: "MGA-TEST",
      dashboardUrl: "https://file.mgautotech.de/new-request",
      statusLabel: "Not submitted",
      customerName: "Synthetic Customer",
    }, language);
    assert.match(rendered.html, /MGA-TEST/);
    assert.match(rendered.text, /file\.mgautotech\.de\/new-request/);
    assert.doesNotMatch(`${rendered.html}${rendered.text}`, /internal note|storage path|raw hex|source_reference/i);
  }
});

test("growth database contract is additive, RLS-protected, and excludes direct identifiers", () => {
  const sql = source("scripts", "add-growth-customer-success-center.sql");
  assert.doesNotMatch(sql, /\b(drop table|delete from|truncate|drop column)\b/i);
  for (const table of ["growth_attribution_sessions", "growth_journey_events", "growth_customer_preferences", "growth_reminder_actions"]) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
  assert.match(sql, /revoke all on table public\.growth_attribution_sessions from anon, authenticated/i);
  assert.match(sql, /abandoned_request_reminders boolean not null default false/i);
  assert.match(sql, /security invoker[\s\S]*record_growth_attribution_touch|record_growth_attribution_touch[\s\S]*security invoker/i);
  assert.match(sql, /reserve_growth_reminder_action[\s\S]*pg_advisory_xact_lock/i);
  assert.match(sql, /created_at >= now\(\) - interval '30 days'/i);
  assert.match(sql, /coalesce\(account_status, 'active'\) not in \('blocked', 'disabled', 'suspended'\)/i);
  assert.doesNotMatch(sql, /grant select, insert, update on table public\.growth_customer_preferences to authenticated/i);
  assert.doesNotMatch(sql, /Customers can (create|update) own growth preferences/i);
  assert.doesNotMatch(sql, /raw_ip|ip_address|full_referrer|recipient_email|customer_notes|storage_path|filename/i);
  assert.match(sql, /revoke all on function public\.record_growth_attribution_touch[\s\S]*from public, anon, authenticated/i);
});

test("growth APIs enforce admin permissions and expose no public read endpoint", async () => {
  const adminRoute = await import("../src/app/api/admin/growth/route");
  const reminderRoute = await import("../src/app/api/admin/growth/reminders/route");
  const journeyRoute = await import("../src/app/api/growth/journey/route");
  const journeySource = source("src", "app", "api", "growth", "journey", "route.ts");
  const reportType = source("src", "lib", "growth", "types.ts");
  assert.equal((await adminRoute.GET(new Request("http://localhost/api/admin/growth"))).status, 401);
  assert.equal((await reminderRoute.POST(new Request("http://localhost/api/admin/growth/reminders", { method: "POST", body: "{}" }))).status, 401);
  assert.equal((await journeyRoute.POST(new Request("http://localhost/api/growth/journey", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "request_started",
      attemptId: "00000000-0000-4000-8000-000000000001",
      visitorId: null,
    }),
  }))).status, 401);
  assert.equal((await journeyRoute.POST(new Request("http://localhost/api/growth/journey", {
    method: "POST",
    body: JSON.stringify({ action: "request_started", padding: "x".repeat(9_000) }),
  }))).status, 413);
  assert.doesNotMatch(journeySource, /export async function GET/);
  assert.doesNotMatch(reportType, /visitorHash|visitor_hash|recipientEmail|customerEmail|phone|sourceReference|storagePath|notes:/);
});

test("instrumentation is fail-soft and reminders have no automatic sender", () => {
  const requestPage = source("src", "app", "new-request", "page.tsx");
  const analytics = source("src", "components", "analytics", "PublicAnalytics.tsx");
  const reminderRoute = source("src", "app", "api", "admin", "growth", "reminders", "route.ts");
  const docs = source("docs", "growth-customer-success-center.md");
  assert.match(requestPage, /void recordGrowthRequestStarted/);
  assert.match(requestPage, /const meaningfulStart = Boolean\(/);
  assert.match(requestPage, /void recordGrowthRequestCreated/);
  assert.match(requestPage, /abandonedReminderEnabled[\s\S]*useState\(false\)/);
  assert.match(analytics, /consent !== "granted"/);
  assert.match(reminderRoute, /export async function POST/);
  assert.doesNotMatch(reminderRoute, /export async function GET|cron|schedule/i);
  assert.match(docs, /There is no automatic reminder cron job/);
  assert.match(docs, /30-day customer cooldown/i);
});

test("growth capture is bounded and consent revocation clears the local pseudonymous identifier", () => {
  const route = source("src", "app", "api", "growth", "journey", "route.ts");
  const client = source("src", "lib", "growth", "publicClient.ts");
  const analytics = source("src", "components", "analytics", "PublicAnalytics.tsx");
  assert.match(route, /request\.text\(\)/);
  assert.match(route, /TextEncoder\(\)\.encode\(rawBody\)\.byteLength > 8_192/);
  assert.match(client, /removeItem\(growthVisitorStorageKey\)/);
  assert.match(analytics, /next === "denied"[\s\S]*clearGrowthVisitorId\(\)/);
  assert.match(analytics, /@\/lib\/growth\/publicClient/);
  assert.doesNotMatch(client, /authGuards|supabase|service.role|service_role/i);
});

test("Search Console demand remains aggregate and explicitly unlinked from customers", () => {
  const report = source("src", "lib", "growth", "report.ts");
  const ui = source("src", "app", "admin", "growth", "GrowthCustomerSuccessClient.tsx");
  assert.match(report, /Search Console queries are aggregate search-demand evidence and are never joined to individual customers/);
  assert.match(ui, /deliberately not attributed to a named or pseudonymous customer/);
  assert.doesNotMatch(report, /query.*customer_id|customer_id.*query/i);
});
