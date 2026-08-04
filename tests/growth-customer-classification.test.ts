import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  applyGrowthCustomerClassifications,
  buildFirstVerifiedRevenueJourney,
  buildRealCustomerSnapshot,
  classificationExcludesAnalytics,
  isGrowthCustomerClassification,
  normalizeGrowthCustomerClassificationRecord,
} from "../src/lib/growth/customerClassification";
import type { GrowthMetricInput } from "../src/lib/growth/metrics";
import type { GrowthCustomerClassificationRecord } from "../src/lib/growth/types";
import { isGrowthReminderEligible } from "../src/lib/growth/reminders";

function source(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

const startAt = new Date("2026-01-01T00:00:00.000Z");
const endAt = new Date("2026-01-31T23:59:59.999Z");

function metricFixture(): GrowthMetricInput {
  return {
    startAt,
    endAt,
    profiles: [
      { id: "real", customer_id: "MGA-REAL", role: "customer", created_at: "2026-01-02T00:00:00Z" },
      { id: "test", customer_id: "MGA-TEST", role: "customer", created_at: "2026-01-03T00:00:00Z" },
      { id: "unknown", customer_id: "MGA-UNKNOWN", role: "customer", created_at: "2026-01-04T00:00:00Z" },
    ],
    orders: [
      { id: "real-1", customer_id: "real", status: "completed", service_type: "Stage 1", vehicle_brand: "BMW", credits_required: 10, created_at: "2026-01-05T00:00:00Z" },
      { id: "real-2", customer_id: "real", status: "completed", service_type: "Stage 1", vehicle_brand: "BMW", credits_required: 10, created_at: "2026-01-20T00:00:00Z" },
      { id: "test-1", customer_id: "test", status: "completed", service_type: "Stage 2", vehicle_brand: "Audi", credits_required: 20, created_at: "2026-01-06T00:00:00Z" },
      { id: "unknown-1", customer_id: "unknown", status: "new", service_type: "TCU Tune", vehicle_brand: "Mercedes-Benz", credits_required: 12, created_at: "2026-01-07T00:00:00Z" },
    ],
    payments: [
      { id: "pay-real", user_id: "real", type: "purchase", amount_total: 21_000, currency: "eur", created_at: "2026-01-08T00:00:00Z" },
      { id: "pay-test", user_id: "test", type: "purchase", amount_total: 99_000, currency: "eur", created_at: "2026-01-09T00:00:00Z" },
    ],
    emails: [
      { event_type: "request_created", recipient_user_id: "real", status: "sent", delivery_status: "delivered", created_at: "2026-01-05T00:00:00Z" },
      { event_type: "request_created", recipient_user_id: "test", status: "sent", delivery_status: "delivered", created_at: "2026-01-06T00:00:00Z" },
    ],
    attribution: [
      { user_id: "real", first_source: "google", first_medium: "organic", first_campaign: null, first_term: null, first_landing_path: "/services/stage-1", first_country_code: "DE", first_seen_at: "2026-01-01T00:00:00Z" },
      { user_id: "test", first_source: "internal", first_medium: "test", first_campaign: null, first_term: null, first_landing_path: "/", first_country_code: "DE", first_seen_at: "2026-01-02T00:00:00Z" },
      { user_id: null, first_source: "google", first_medium: "organic", first_campaign: null, first_term: null, first_landing_path: "/", first_country_code: "FR", first_seen_at: "2026-01-03T00:00:00Z" },
    ],
    journeyEvents: [
      { event_type: "request_created", user_id: "real", order_id: "real-1", occurred_at: "2026-01-05T00:00:00Z" },
      { event_type: "request_created", user_id: "test", order_id: "test-1", occurred_at: "2026-01-06T00:00:00Z" },
    ],
  };
}

const classifications: GrowthCustomerClassificationRecord[] = [
  { userId: "real", classification: "real_customer", analyticsExcluded: false, reason: "Payment and request verified", verifiedAt: "2026-01-10T00:00:00Z" },
  { userId: "test", classification: "internal_test", analyticsExcluded: true, reason: "Known QA account", verifiedAt: "2026-01-10T00:00:00Z" },
];

test("customer classification uses explicit exact states and fail-closed row consistency", () => {
  assert.equal(isGrowthCustomerClassification("real_customer"), true);
  assert.equal(isGrowthCustomerClassification("probably_real"), false);
  assert.equal(classificationExcludesAnalytics("internal_test"), true);
  assert.equal(classificationExcludesAnalytics("staff_operated"), true);
  assert.equal(classificationExcludesAnalytics("real_customer"), false);
  assert.equal(normalizeGrowthCustomerClassificationRecord({
    user_id: "u1",
    classification: "internal_test",
    analytics_excluded: false,
  }), null);
  assert.deepEqual(normalizeGrowthCustomerClassificationRecord({
    user_id: "u1",
    classification: "internal_test",
    analytics_excluded: true,
    reason: " Known test account ",
    verified_at: "2026-01-01T00:00:00Z",
  }), {
    userId: "u1",
    classification: "internal_test",
    analyticsExcluded: true,
    reason: "Known test account",
    verifiedAt: "2026-01-01T00:00:00Z",
  });
});

test("excluded accounts are removed from every linked growth evidence stream", () => {
  const filtered = applyGrowthCustomerClassifications(metricFixture(), classifications);
  assert.deepEqual(filtered.profiles.map((row) => row.id), ["real", "unknown"]);
  assert.deepEqual(filtered.orders.map((row) => row.id), ["real-1", "real-2", "unknown-1"]);
  assert.deepEqual(filtered.payments.map((row) => row.id), ["pay-real"]);
  assert.equal(filtered.emails.some((row) => row.recipient_user_id === "test"), false);
  assert.equal(filtered.attribution.some((row) => row.user_id === "test"), false);
  assert.equal(filtered.attribution.some((row) => row.user_id === null), true);
  assert.equal(filtered.journeyEvents.some((row) => row.user_id === "test"), false);
});

test("real growth snapshot counts only explicitly verified real customers", () => {
  const snapshot = buildRealCustomerSnapshot({
    metricInput: metricFixture(),
    classifications,
    classificationReady: true,
  });
  assert.equal(snapshot.totalCustomerAccounts, 3);
  assert.equal(snapshot.verifiedRealCustomers, 1);
  assert.equal(snapshot.unreviewedCustomers, 1);
  assert.equal(snapshot.excludedInternalAccounts, 1);
  assert.equal(snapshot.customersWithRequests, 1);
  assert.equal(snapshot.repeatCustomers, 1);
  assert.equal(snapshot.orders, 2);
  assert.equal(snapshot.payingCustomers, 1);
  assert.equal(snapshot.revenue[0].amountMinor, 21_000);
});

test("first revenue journey requires verified-real evidence and never invents attribution", () => {
  const fixture = metricFixture();
  const available = buildFirstVerifiedRevenueJourney({
    profiles: fixture.profiles,
    orders: fixture.orders,
    firstPayment: fixture.payments[0],
    attribution: fixture.attribution,
    classifications,
  });
  assert.equal(available.status, "available");
  assert.equal(available.customerReference, "MGA-REAL");
  assert.equal(available.paymentAmountMinor, 21_000);
  assert.equal(available.attributionStatus, "consented_first_touch");
  assert.equal(available.source, "google");
  assert.equal(available.hoursRegistrationToRequest, 72);

  const withoutAttribution = buildFirstVerifiedRevenueJourney({
    profiles: fixture.profiles,
    orders: fixture.orders,
    firstPayment: fixture.payments[0],
    attribution: [],
    classifications,
  });
  assert.equal(withoutAttribution.status, "available");
  assert.equal(withoutAttribution.attributionStatus, "not_captured");
  assert.equal(withoutAttribution.source, null);

  const unreviewedPayment = buildFirstVerifiedRevenueJourney({
    profiles: fixture.profiles,
    orders: fixture.orders,
    firstPayment: fixture.payments[1],
    attribution: fixture.attribution,
    classifications,
  });
  assert.equal(unreviewedPayment.status, "no_verified_payment");

  const zeroValuePayment = buildFirstVerifiedRevenueJourney({
    profiles: fixture.profiles,
    orders: fixture.orders,
    firstPayment: { ...fixture.payments[0], amount_total: 0 },
    attribution: fixture.attribution,
    classifications,
  });
  assert.equal(zeroValuePayment.status, "no_verified_payment");
});

test("excluded accounts cannot become reminder candidates", () => {
  assert.equal(isGrowthReminderEligible({
    startedAt: "2026-02-08T00:00:00Z",
    now: new Date("2026-02-10T00:00:00Z"),
    preferenceEnabled: true,
    hasLaterOrder: false,
    hasReminderAction: false,
    email: "synthetic@example.com",
    role: "customer",
    accountStatus: "active",
    analyticsExcluded: true,
  }), false);
});

test("classification migration is additive, private, audited and never auto-promotes profiles", () => {
  const sql = source("scripts", "add-growth-customer-classification.sql");
  const verification = source("scripts", "verify-growth-customer-classification.sql");
  assert.doesNotMatch(sql, /\b(drop table|delete from|truncate|drop column)\b/i);
  for (const table of ["growth_customer_classifications", "growth_customer_classification_events"]) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
    assert.match(sql, new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`, "i"));
    assert.match(verification, new RegExp(table));
  }
  assert.match(sql, /grant all on table public\.growth_customer_classifications to service_role/i);
  assert.match(sql, /set_growth_customer_classification[\s\S]*pg_advisory_xact_lock/i);
  assert.match(sql, /insert into public\.growth_customer_classification_events/i);
  assert.match(sql, /analytics_excluded = true[\s\S]*return null/i);
  assert.doesNotMatch(sql, /insert into public\.growth_customer_classifications\s*\([^)]*\)\s*select/i);
  assert.doesNotMatch(sql, /update public\.profiles/i);
  assert.doesNotMatch(sql, /grant .* authenticated/i);
});

test("classification APIs are admin-only and customer/public routes expose no classification metadata", async () => {
  const listRoute = await import("../src/app/api/admin/growth/customers/route");
  const detailRoute = await import("../src/app/api/admin/growth/customers/[id]/route");
  assert.equal((await listRoute.GET(new Request("http://localhost/api/admin/growth/customers"))).status, 401);
  assert.equal((await detailRoute.PATCH(
    new Request("http://localhost/api/admin/growth/customers/00000000-0000-4000-8000-000000000001", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classification: "real_customer", reason: null }),
    }),
    { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000001" }) }
  )).status, 401);

  const listSource = source("src", "app", "api", "admin", "growth", "customers", "route.ts");
  const detailSource = source("src", "app", "api", "admin", "growth", "customers", "[id]", "route.ts");
  assert.match(listSource, /requireStaffPermission\(request, "customers\.manage"\)/);
  assert.match(detailSource, /requireStaffPermission\(request, "customers\.manage"\)/);
  assert.match(detailSource, /TextEncoder\(\)[\s\S]*2_048/);
  assert.match(detailSource, /set_growth_customer_classification/);

  const publicRoutes = [
    source("src", "app", "api", "growth", "journey", "route.ts"),
    source("src", "lib", "growth", "publicClient.ts"),
  ].join("\n");
  assert.doesNotMatch(publicRoutes, /growth_customer_classifications|analytics_excluded|internal_test|staff_operated/i);
});
