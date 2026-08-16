import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  buildCustomerIntelligenceReport,
  calculateMedianFirstResponseMinutes,
  type CustomerIntelligenceInput,
} from "../src/lib/growth/customerIntelligence";

function source(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

function fixture(overrides: Partial<CustomerIntelligenceInput> = {}): CustomerIntelligenceInput {
  return {
    profile: {
      id: "00000000-0000-4000-8000-000000000101",
      customer_id: "MGA-TEST-101",
      email: "synthetic.customer@example.com",
      full_name: "Synthetic Customer",
      credit_balance: 24,
      account_type: "company",
      company_name: "Synthetic Workshop",
      phone: "+49 000 000000",
      city: "Berlin",
      country: "Germany",
      preferred_contact: "email",
      account_status: "active",
      created_at: "2026-01-02T09:00:00.000Z",
    },
    auth: {
      providers: ["google"],
      createdAt: "2026-01-02T09:00:00.000Z",
      lastSignInAt: "2026-02-10T08:00:00.000Z",
      emailConfirmedAt: "2026-01-02T09:01:00.000Z",
    },
    classification: {
      classification: "real_customer",
      analyticsExcluded: false,
      reason: "Synthetic verified customer fixture",
      verifiedAt: "2026-02-01T10:00:00.000Z",
    },
    attribution: [{
      first_landing_path: "/services/stage-1",
      last_landing_path: "/credit-prices",
      first_source: "google",
      last_source: "direct",
      first_medium: "organic",
      last_medium: "none",
      first_campaign: null,
      last_campaign: null,
      first_term: "stage 1 file service",
      last_term: null,
      first_referrer_host: "google.de",
      last_referrer_host: null,
      first_country_code: "DE",
      last_country_code: "DE",
      locale: "de",
      consent_version: "analytics-v1",
      touch_count: 3,
      first_seen_at: "2026-01-02T08:55:00.000Z",
      last_seen_at: "2026-02-10T07:55:00.000Z",
      identified_at: "2026-01-02T09:00:00.000Z",
    }],
    trackingStartedAt: "2026-01-01T00:00:00.000Z",
    orders: [
      {
        id: "00000000-0000-4000-8000-000000000201",
        vehicle_brand: "BMW",
        vehicle_model: "5 Series",
        vehicle_generation: "G30",
        vehicle_engine: "530d",
        vehicle_year: "2020",
        service_type: "Stage 1 + DTC OFF",
        credits_required: 12,
        status: "completed",
        ecu: "Bosch MD1",
        gearbox: null,
        read_method: "OBD",
        uploaded_file_name: "private-source.bin",
        created_at: "2026-01-03T09:00:00.000Z",
      },
      {
        id: "00000000-0000-4000-8000-000000000202",
        vehicle_brand: "BMW",
        vehicle_model: "3 Series",
        vehicle_generation: "G20",
        vehicle_engine: "320d",
        vehicle_year: "2021",
        service_type: "Stage 1",
        credits_required: 10,
        status: "in_progress",
        ecu: "Bosch MD1",
        gearbox: null,
        read_method: "Bench",
        uploaded_file_name: null,
        created_at: "2026-02-10T09:00:00.000Z",
      },
    ],
    ledger: [
      { id: "p1", user_id: "00000000-0000-4000-8000-000000000101", type: "purchase", amount_total: 21_000, currency: "eur", credits_delta: 50, balance_after: 50, created_at: "2026-01-02T10:00:00.000Z" },
      { id: "p2", user_id: "00000000-0000-4000-8000-000000000101", type: "refund", amount_total: -1_000, currency: "eur", credits_delta: -2, balance_after: 48, created_at: "2026-01-05T10:00:00.000Z" },
    ],
    payments: [
      { status: "succeeded", payment_type: "stripe", purchase_type: "credits", credits: 50, amount_total: 21_000, currency: "eur", credits_applied_at: "2026-01-02T10:01:00.000Z", refunded_at: null, created_at: "2026-01-02T10:00:00.000Z" },
    ],
    emails: [
      { event_type: "request_created", status: "sent", delivery_status: "delivered", created_at: "2026-01-03T09:01:00.000Z", sent_at: "2026-01-03T09:01:01.000Z", delivered_at: "2026-01-03T09:01:03.000Z", delayed_at: null, bounced_at: null, complained_at: null },
      { event_type: "request_completed", status: "failed", delivery_status: "bounced", created_at: "2026-01-04T09:00:00.000Z", sent_at: null, delivered_at: null, delayed_at: null, bounced_at: "2026-01-04T09:00:02.000Z", complained_at: null },
    ],
    messages: [
      { request_id: "00000000-0000-4000-8000-000000000201", sender_role: "customer", is_internal: false, visibility_status: "visible", created_at: "2026-01-03T10:00:00.000Z" },
      { request_id: "00000000-0000-4000-8000-000000000201", sender_role: "staff", is_internal: true, visibility_status: "visible", created_at: "2026-01-03T10:02:00.000Z" },
      { request_id: "00000000-0000-4000-8000-000000000201", sender_role: "staff", is_internal: false, visibility_status: "hidden", created_at: "2026-01-03T10:05:00.000Z" },
      { request_id: "00000000-0000-4000-8000-000000000201", sender_role: "staff", is_internal: false, visibility_status: "visible", created_at: "2026-01-03T10:15:00.000Z" },
    ],
    workEvents: [
      { request_id: "00000000-0000-4000-8000-000000000201", event_type: "request_completed", customer_visible: true, created_at: "2026-01-04T08:00:00.000Z" },
    ],
    journeyEvents: [
      { event_type: "request_created", order_id: "00000000-0000-4000-8000-000000000201", channel: "web", occurred_at: "2026-01-03T09:00:00.000Z" },
    ],
    preference: {
      abandoned_request_reminders: true,
      consent_version: "reminders-v1",
      consented_at: "2026-01-02T09:00:00.000Z",
      revoked_at: null,
    },
    sourceStates: {
      profile: "ready",
      authentication: "ready",
      classification: "ready",
      attribution: "ready",
      requests: "ready",
      revenueLedger: "ready",
      paymentOperations: "ready",
      emailDelivery: "ready",
      communication: "ready",
      workOrderTimeline: "ready",
      journeyEvents: "ready",
      communicationPreference: "ready",
    },
    now: new Date("2026-02-12T12:00:00.000Z"),
    ...overrides,
  };
}

test("customer intelligence joins consented acquisition, commercial and repeat-request evidence", () => {
  const report = buildCustomerIntelligenceReport(fixture());
  assert.equal(report.acquisition.status, "captured");
  assert.equal(report.acquisition.confidence, "consented_first_party");
  assert.equal(report.acquisition.firstTouch?.source, "google");
  assert.equal(report.acquisition.lastTouch?.source, "direct");
  assert.equal(report.acquisition.touchCount, 3);
  assert.equal(report.requests.total, 2);
  assert.equal(report.requests.repeatCustomer, true);
  assert.equal(report.requests.services.find((row) => row.label === "Stage 1")?.count, 2);
  assert.equal(report.requests.brands[0]?.label, "BMW");
  assert.equal(report.commercial.revenue[0]?.grossAmountMinor, 21_000);
  assert.equal(report.commercial.revenue[0]?.refundedAmountMinor, 1_000);
  assert.equal(report.commercial.revenue[0]?.amountMinor, 20_000);
  assert.equal(report.lifecycle.hoursRegistrationToFirstPayment, 1);
  assert.equal(report.communication.emailHealth, "attention");
  assert.equal(report.communication.reminderPreference, "enabled");
});

test("authentication provider is never inferred as acquisition source", () => {
  const report = buildCustomerIntelligenceReport(fixture({
    attribution: [],
    profile: { ...fixture().profile, created_at: "2025-12-01T00:00:00.000Z" },
  }));
  assert.equal(report.customer.authProviders.includes("google"), true);
  assert.equal(report.acquisition.status, "tracking_not_available_at_registration");
  assert.equal(report.acquisition.firstTouch, null);
  assert.equal(report.cohort.acquisitionSource, null);
  assert.match(report.acquisition.explanation, /cannot be reconstructed safely/i);
});

test("missing post-launch attribution remains unknown instead of being reconstructed", () => {
  const report = buildCustomerIntelligenceReport(fixture({ attribution: [] }));
  assert.equal(report.acquisition.status, "not_captured");
  assert.equal(report.acquisition.firstTouch, null);
  assert.match(report.acquisition.explanation, /not inferred from login, country or payment/i);
});

test("message response metrics ignore internal and hidden records", () => {
  const input = fixture();
  assert.equal(calculateMedianFirstResponseMinutes(input.messages), 15);
  const report = buildCustomerIntelligenceReport(input);
  assert.equal(report.communication.customerMessageCount, 1);
  assert.equal(report.communication.staffMessageCount, 1);
  assert.equal(report.communication.medianFirstResponseMinutes, 15);
  assert.equal(report.timeline.filter((item) => item.type === "message").length, 2);
});

test("customer intelligence projection contains summaries but no private payloads", () => {
  const input = fixture();
  input.messages.push({
    request_id: "00000000-0000-4000-8000-000000000201",
    sender_role: "staff",
    is_internal: true,
    visibility_status: "hidden",
    created_at: "2026-01-03T10:03:00.000Z",
    message: "PRIVATE INTERNAL NOTE",
    storage_path: "private/customer/file.bin",
    provider_message_id: "provider-secret-id",
  } as CustomerIntelligenceInput["messages"][number]);
  const serialized = JSON.stringify(buildCustomerIntelligenceReport(input));
  assert.doesNotMatch(serialized, /PRIVATE INTERNAL NOTE|private\/customer|provider-secret-id|private-source\.bin/i);
  assert.doesNotMatch(serialized, /visitor_hash|signed_url|storage_path|provider_message_id|raw hex|service_role/i);
  assert.match(serialized, /Message content remains outside the intelligence projection/);
});

test("profile completeness and deterministic recommendations remain explainable", () => {
  const input = fixture({
    classification: null,
    profile: { ...fixture().profile, phone: null, city: null, preferred_contact: null },
  });
  const report = buildCustomerIntelligenceReport(input);
  assert.equal(report.customer.profileCompleteness, 57);
  assert.deepEqual(report.customer.missingProfileFields, ["Phone", "City", "Preferred contact"]);
  assert.equal(report.recommendations[0]?.id, "verify-customer-truth");
  assert.match(report.recommendations.find((item) => item.id === "profile-completeness")?.detail ?? "", /collect only what the customer provides/i);
});

test("customer intelligence API is admin-only, read-only and private by construction", () => {
  const route = source("src", "app", "api", "admin", "growth", "customers", "[id]", "route.ts");
  const server = source("src", "lib", "growth", "customerIntelligenceServer.ts");
  const ui = source("src", "app", "admin", "growth", "customers", "[id]", "CustomerIntelligenceClient.tsx");
  assert.match(route, /export async function GET/);
  assert.match(route, /requireStaffPermissions\(request, customerIntelligencePermissions\)/);
  assert.match(route, /Cache-Control": "private, no-store/);
  assert.match(route, /X-Robots-Tag": "noindex, nofollow, noarchive/);
  assert.doesNotMatch(server, /\.(insert|update|upsert|delete|rpc)\(/);
  assert.doesNotMatch(server, /original_file_path|modified_file_path|storage_path|signed_url|provider_message_id|recipient_email|error_message|safe_metadata/);
  assert.doesNotMatch(ui, /message\.message|internal note content|raw binary|hex preview/i);
  assert.match(ui, /Read-only admin projection/);
});

test("anonymous customer intelligence API access is denied", async () => {
  const route = await import("../src/app/api/admin/growth/customers/[id]/route");
  const response = await route.GET(
    new Request("http://localhost/api/admin/growth/customers/00000000-0000-4000-8000-000000000101"),
    { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000101" }) }
  );
  assert.equal(response.status, 401);
  assert.match(response.headers.get("cache-control") ?? "", /private, no-store/);
  assert.match(response.headers.get("x-robots-tag") ?? "", /noindex/);
});

test("customer intelligence entry points are available from both growth and customer admin", () => {
  const quality = source("src", "app", "admin", "growth", "CustomerDataQualityPanel.tsx");
  const admin = source("src", "app", "admin", "page.tsx");
  assert.match(quality, /View Customer 360/);
  assert.match(quality, /\/admin\/growth\/customers\/\$\{row\.userId\}/);
  assert.match(admin, /Customer 360/);
  assert.match(admin, /\/admin\/growth\/customers\/\$\{customer\.id\}/);
});
