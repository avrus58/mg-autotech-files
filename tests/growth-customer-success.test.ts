import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  buildGrowthAttributionTouch,
  classifyGrowthSource,
  normalizeGrowthAttributionTouch,
  normalizeGrowthPath,
} from "../src/lib/growth/attribution";
import { hashGrowthVisitorId } from "../src/lib/growth/attributionServer";
import { buildGrowthMetrics } from "../src/lib/growth/metrics";
import {
  createGrowthRequestStartDeliveryController,
  growthJourneyClientDecision,
} from "../src/lib/growth/client";
import {
  isExplicitReminderJourneyMetadata,
  isGrowthReminderEligible,
} from "../src/lib/growth/reminders";
import { renderTransactionalEmailTemplate } from "../src/lib/email/templates";
import type { MeasurementConsentSnapshot } from "../src/lib/publicAnalytics";
import { isVerifiedRegistrationWindowOpen } from "../src/lib/registrationEligibility";
import { loadGrowthReportRows } from "../src/lib/growth/report";
import { growthJourneyAuthMode } from "../src/lib/growth/journeyAuth";
import {
  invalidateGrowthConsentOperations,
  subscribeGrowthConsentInvalidation,
} from "../src/lib/growth/consentLifecycle";

function source(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

function consentSnapshot(
  analytics: boolean,
  advertising: boolean,
  needsDecision = false,
): MeasurementConsentSnapshot {
  return {
    preferences: {
      analytics,
      advertising,
      version: "consent-mode-v2",
      updatedAt: new Date(0).toISOString(),
    },
    source: needsDecision ? "none" : "v2",
    needsDecision,
  };
}

test("growth reports use stable keyset cursors across head inserts and server caps", async () => {
  const endAt = "2026-08-28T12:00:07.000Z";
  const sourceRows = Array.from({ length: 7 }, (_, index) => {
    const sequence = 7 - index;
    const timestampSequence = sequence === 3 ? 4 : sequence;
    return {
      id: String(sequence).padStart(2, "0"),
      created_at: `2026-08-28T12:00:0${timestampSequence}.000Z`,
    };
  });
  let liveRows = [...sourceRows];
  const requestedCursors: Array<string | null> = [];
  const requestedLimits: number[] = [];
  let insertedHead = false;
  const complete = await loadGrowthReportRows({
    pageSize: 4,
    safetyLimit: 20,
    loadPage: async (cursor, limit) => {
      requestedCursors.push(cursor?.id ?? null);
      requestedLimits.push(limit);
      const serverCap = 2;
      const eligible = liveRows
        .filter((row) => row.created_at <= endAt)
        .filter((row) => {
          if (!cursor) return true;
          return row.created_at < cursor.orderValue ||
            (row.created_at === cursor.orderValue && row.id < cursor.id);
        });
      const data = eligible.slice(0, Math.min(limit, serverCap));
      if (!insertedHead) {
        insertedHead = true;
        liveRows = [
          {
            id: "08",
            created_at: "2026-08-28T12:00:08.000Z",
          },
          ...liveRows,
        ];
      }
      return {
        data,
        error: null,
      };
    },
    getCursor: (row) => ({ orderValue: row.created_at, id: row.id }),
  });

  assert.deepEqual(complete.data, sourceRows);
  assert.equal(complete.truncated, false);
  assert.deepEqual(requestedCursors, [null, "06", "04", "02", "01"]);
  assert.deepEqual(requestedLimits, [4, 4, 4, 4, 4]);
  assert.equal(complete.data.some((row) => row.id === "08"), false);
  assert.equal(new Set(complete.data.map((row) => row.id)).size, 7);

  const cappedPage = async (
    cursor: { orderValue: string; id: string } | null,
    limit: number
  ) => ({
    data: sourceRows
      .filter((row) => {
        if (!cursor) return true;
        return row.created_at < cursor.orderValue ||
          (row.created_at === cursor.orderValue && row.id < cursor.id);
      })
      .slice(0, Math.min(limit, 2)),
    error: null,
  });
  const truncated = await loadGrowthReportRows({
    pageSize: 4,
    safetyLimit: 5,
    loadPage: cappedPage,
    getCursor: (row) => ({ orderValue: row.created_at, id: row.id }),
  });
  assert.deepEqual(truncated.data, sourceRows.slice(0, 5));
  assert.equal(truncated.truncated, true);

  const secondPageError = { code: "08006", message: "synthetic page failure" };
  let pageCalls = 0;
  const failed = await loadGrowthReportRows({
    pageSize: 2,
    safetyLimit: 20,
    loadPage: async () => {
      pageCalls += 1;
      return pageCalls === 1
        ? { data: sourceRows.slice(0, 2), error: null }
        : { data: null, error: secondPageError };
    },
    getCursor: (row) => ({ orderValue: row.created_at, id: row.id }),
  });
  assert.deepEqual(failed.data, []);
  assert.equal(failed.error, secondPageError);
  assert.equal(failed.truncated, false);

  const report = source("src", "lib", "growth", "report.ts");
  assert.doesNotMatch(report, /\.range\(/);
  assert.match(report, /growthReportKeysetFilter/);
  assert.match(
    report,
    /from\("profiles"\)[\s\S]{0,300}\.lte\("created_at", endAtIso\)/
  );
  assert.match(
    report,
    /from\("orders"\)[\s\S]{0,300}\.lte\("created_at", endAtIso\)/
  );
  assert.match(report, /classificationReady = !classificationResult\.error && !classificationResult\.truncated/);
  assert.match(report, /if \(attributionResult\.truncated\)[\s\S]*?attributionSource = "error"/);
  assert.match(report, /if \(journeyResult\.truncated\)[\s\S]*?attributionSource = "error"/);
  assert.match(report, /coreBusiness:[\s\S]*?profilesResult\.truncated[\s\S]*?paymentReviewResult\.truncated/);
});

test("growth journey client sends only the consented action and never adds a visitor without analytics", () => {
  const none = consentSnapshot(false, false, true);
  const necessary = consentSnapshot(false, false);
  const analytics = consentSnapshot(true, false);
  const advertising = consentSnapshot(false, true);

  for (const snapshot of [none, necessary]) {
    assert.deepEqual(growthJourneyClientDecision("account_created", snapshot), {
      allowed: false,
      includeVisitorId: false,
      purpose: null,
      consentVersion: null,
    });
    assert.deepEqual(growthJourneyClientDecision("request_started", snapshot), {
      allowed: false,
      includeVisitorId: false,
      purpose: null,
      consentVersion: null,
    });
    assert.deepEqual(growthJourneyClientDecision("request_created", snapshot), {
      allowed: false,
      includeVisitorId: false,
      purpose: null,
      consentVersion: null,
    });
  }

  for (const action of ["account_created", "identity_linked", "request_started", "request_created"] as const) {
    assert.deepEqual(growthJourneyClientDecision(action, analytics), {
      allowed: true,
      includeVisitorId: true,
      purpose: "analytics",
      consentVersion: "consent-mode-v2",
    });
  }

  assert.deepEqual(growthJourneyClientDecision("account_created", advertising), {
    allowed: true,
    includeVisitorId: false,
    purpose: "advertising",
    consentVersion: "consent-mode-v2",
  });
  assert.deepEqual(growthJourneyClientDecision("identity_linked", advertising), {
    allowed: false,
    includeVisitorId: false,
    purpose: null,
    consentVersion: null,
  });
  assert.deepEqual(growthJourneyClientDecision("request_started", advertising), {
    allowed: false,
    includeVisitorId: false,
    purpose: null,
    consentVersion: null,
  });
  assert.deepEqual(growthJourneyClientDecision("request_created", advertising), {
    allowed: false,
    includeVisitorId: false,
    purpose: null,
    consentVersion: null,
  });

  for (const snapshot of [none, necessary, advertising]) {
    assert.deepEqual(
      growthJourneyClientDecision("request_started", snapshot, {
        reminderOptIn: true,
      }),
      {
        allowed: true,
        includeVisitorId: false,
        purpose: "reminder",
        consentVersion: "abandoned-request-v1",
      },
    );
  }
});

test("growth client gates before posting and omits non-consented visitor identifiers", () => {
  const client = source("src", "lib", "growth", "client.ts");
  const requestPage = source("src", "app", "new-request", "page.tsx");

  assert.match(client, /growthJourneyClientDecision\([\s\S]*?if \(!decision\.allowed \|\| !decision\.purpose \|\| !decision\.consentVersion\) return null/);
  assert.match(client, /request_started[\s\S]*?if \(!decision\.allowed \|\| !decision\.purpose \|\| !decision\.consentVersion\) \{[\s\S]*?accepted: false/);
  assert.match(client, /request_created[\s\S]*?if \(!decision\.allowed \|\| !decision\.purpose \|\| !decision\.consentVersion\) \{[\s\S]*?return Promise\.resolve\(false\)/);
  assert.match(client, /\.\.\.\(visitorId \? \{ visitorId \} : \{\}\)/);
  assert.doesNotMatch(client, /customerEmail|emailAddress|rawClick/i);
  assert.doesNotMatch(client, /const body = \{[\s\S]{0,500}\buserId\s*:/);
  assert.match(requestPage, /growthStartDelivery\.begin\([\s\S]*?abandonedReminderEnabled/);
  assert.match(client, /createGrowthRequestStartDeliveryController[\s\S]*?deliver\(attemptId, \{[\s\S]*?reminderOptIn: purpose === "reminder",[\s\S]*?expectedUserId,[\s\S]*?requestedPurpose: purpose/);
  assert.match(requestPage, /if \(enabled && growthAttemptIdRef\.current\)[\s\S]*?queueGrowthRequestStart\(true\)/);
});

test("consented attribution keeps only normalized customer-safe acquisition fields", () => {
  const touch = buildGrowthAttributionTouch({
    url: "https://file.mgautotech.de/en/services/stage-1?utm_source=Google&utm_medium=CPC&utm_campaign=stage1_en&utm_term=ecu+file&email=private@example.com",
    referrer: "https://www.google.de/search?q=private+query",
    locale: "en-GB",
  });
  assert.deepEqual(touch, {
    landingPath: "/en/services/stage-1",
    source: "google",
    medium: "cpc",
    campaign: "stage1_en",
    term: null,
    referrerHost: "google.de",
    locale: "en-gb",
  });
  assert.equal(JSON.stringify(touch).includes("private@example.com"), false);
  assert.equal(JSON.stringify(touch).includes("ecu file"), false);
  assert.equal(JSON.stringify(touch).includes("search?q"), false);
  assert.equal(normalizeGrowthPath("https://evil.example/private"), null);

  const displayClick = buildGrowthAttributionTouch({
    url: "https://file.mgautotech.de/services/stage-1?dclid=private-display-click",
    referrer: null,
    locale: "en-GB",
  });
  assert.equal(displayClick?.source, "google");
  assert.equal(displayClick?.medium, "cpc");
  assert.equal(JSON.stringify(displayClick).includes("private-display-click"), false);

  const privateCampaign = buildGrowthAttributionTouch({
    url: "https://file.mgautotech.de/services/stage-1?utm_source=google&utm_medium=cpc&utm_campaign=491712345678&utm_term=customer%40example.com",
    referrer: null,
    locale: "en-GB",
  });
  assert.equal(privateCampaign?.campaign, null);
  assert.equal(privateCampaign?.term, null);
  const nameShapedCampaign = buildGrowthAttributionTouch({
    url: "https://file.mgautotech.de/services/stage-1?utm_source=google&utm_medium=cpc&utm_campaign=alice_smith",
    referrer: null,
    locale: "en-GB",
  });
  assert.equal(nameShapedCampaign?.campaign, null);
  const arbitrarySourceAndMedium = buildGrowthAttributionTouch({
    url: "https://file.mgautotech.de/services/stage-1?utm_source=alice_smith&utm_medium=private_note&utm_campaign=stage1_en",
    referrer: null,
    locale: "en-GB",
  });
  assert.deepEqual(arbitrarySourceAndMedium, {
    landingPath: "/services/stage-1",
    source: "direct",
    medium: "none",
    campaign: null,
    term: null,
    referrerHost: null,
    locale: "en-gb",
  });
  assert.equal(
    normalizeGrowthAttributionTouch({
      landingPath: "/services/stage-1",
      source: "google",
      medium: "cpc",
      campaign: "customer@example.com",
      term: null,
      referrerHost: null,
      locale: "en-gb",
    }),
    null
  );
  assert.equal(
    normalizeGrowthAttributionTouch({
      landingPath: "/services/stage-1",
      source: "alice_smith",
      medium: "private_note",
      campaign: null,
      term: null,
      referrerHost: null,
      locale: "en-gb",
    }),
    null
  );
  assert.equal(
    normalizeGrowthAttributionTouch({
      landingPath: "/services/stage-1",
      source: "google",
      medium: "cpc",
      campaign: "alice_smith",
      term: null,
      referrerHost: null,
      locale: "en-gb",
    }),
    null
  );
  assert.deepEqual(
    normalizeGrowthAttributionTouch({
      landingPath: "/services/stage-1",
      source: "google",
      medium: "cpc",
      campaign: "file_service_uk_ie_en",
      term: "discarded-private-term",
      referrerHost: null,
      locale: "en-gb",
    }),
    {
      landingPath: "/services/stage-1",
      source: "google",
      medium: "cpc",
      campaign: "file_service_uk_ie_en",
      term: null,
      referrerHost: null,
      locale: "en-gb",
    }
  );
});

test("source classification is deterministic and stores hostname rather than referrer URL", () => {
  assert.deepEqual(classifyGrowthSource({}), { source: "direct", medium: "none", referrerHost: null });
  assert.deepEqual(
    classifyGrowthSource({ utmSource: "alice_smith", utmMedium: "private_note" }),
    { source: "direct", medium: "none", referrerHost: null }
  );
  assert.deepEqual(
    classifyGrowthSource({ referrer: "https://192.0.2.1/private" }),
    { source: "direct", medium: "none", referrerHost: null }
  );
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
  assert.equal(isExplicitReminderJourneyMetadata({
    purpose: "reminder",
    consent_version: "abandoned-request-v1",
  }), true);
  assert.equal(isExplicitReminderJourneyMetadata({
    purpose: "analytics",
    consent_version: "consent-mode-v2",
  }), false);
  assert.equal(isExplicitReminderJourneyMetadata(null), false);

  const route = source("src", "app", "api", "growth", "journey", "route.ts");
  const server = source("src", "lib", "growth", "server.ts");
  const reminders = source("src", "lib", "growth", "reminders.ts");
  assert.match(route, /recordGrowthJourneyEvent\(\{[\s\S]*?purpose: parsed\.data\.purpose,[\s\S]*?consentVersion: parsed\.data\.consentVersion/);
  assert.match(server, /safeMetadata\.purpose = input\.purpose/);
  assert.match(server, /safeMetadata\.consent_version = input\.consentVersion/);
  assert.match(reminders, /\.contains\("safe_metadata", \{[\s\S]*?purpose: "reminder",[\s\S]*?consent_version: "abandoned-request-v1"/);
  assert.match(reminders, /isExplicitReminderJourneyMetadata\(event\.safe_metadata\)/);
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
  const migration = source(
    "supabase",
    "migrations",
    "20260828000000_growth_attribution_integrity.sql"
  );
  const verifier = source("scripts", "verify-growth-customer-success-center.sql");
  assert.doesNotMatch(sql, /\b(drop table|delete from|truncate|drop column)\b/i);
  assert.doesNotMatch(migration, /\b(drop table|delete from|truncate|drop column)\b/i);
  for (const contract of [sql, migration]) {
    for (const table of [
      "growth_attribution_sessions",
      "growth_attribution_touch_receipts",
      "growth_journey_events",
      "growth_customer_preferences",
      "growth_reminder_actions",
    ]) {
      assert.match(
        contract,
        new RegExp(`alter table public\\.${table} enable row level security`, "i")
      );
    }
    assert.match(contract, /abandoned_request_reminders boolean not null default false/i);
    assert.match(contract, /link_growth_visitor_identity[\s\S]*pg_advisory_xact_lock/i);
    assert.match(contract, /record_growth_attribution_touch[\s\S]*p_receipt_hash/i);
    assert.match(contract, /p_campaign, p_campaign,\s*null, null,/i);
    assert.match(contract, /last_term = null/i);
    assert.doesNotMatch(contract, /p_term,\s*p_term/i);
    assert.match(contract, /visitor_hash_version[\s\S]*pre-v2-key-unknown[\s\S]*legacy-service-role-v1[\s\S]*dedicated-v2/i);
    assert.match(
      contract,
      /p_visitor_hash_version = 'pre-v2-key-unknown'[\s\S]*existing_hash_version is null[\s\S]*rejected_conflict/i
    );
    assert.match(contract, /reserve_growth_reminder_action[\s\S]*pg_advisory_xact_lock/i);
    assert.match(contract, /grant execute on function public\.reserve_growth_reminder_action[\s\S]*service_role/i);
    assert.match(
      contract,
      /MG assured customer growth_customer_preferences select boundary[\s\S]*as restrictive for select[\s\S]*current_customer_session_assured/i
    );
    for (const table of [
      "growth_attribution_sessions",
      "growth_attribution_touch_receipts",
      "growth_journey_events",
      "growth_customer_preferences",
      "growth_reminder_actions",
    ]) {
      assert.match(
        contract,
        new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`, "i")
      );
    }
  }
  assert.match(migration, /to_regprocedure\('public\.has_staff_permission\(text\)'\)/i);
  assert.match(
    migration,
    /MG assured customer growth_customer_preferences select boundary[\s\S]*as restrictive for select[\s\S]*current_customer_session_assured/i
  );
  assert.match(sql, /abandoned_request_reminders boolean not null default false/i);
  assert.match(sql, /security invoker[\s\S]*record_growth_attribution_touch|record_growth_attribution_touch[\s\S]*security invoker/i);
  assert.match(sql, /reserve_growth_reminder_action[\s\S]*pg_advisory_xact_lock/i);
  assert.match(sql, /created_at >= now\(\) - interval '30 days'/i);
  assert.match(sql, /coalesce\(account_status, 'active'\) not in \('blocked', 'disabled', 'suspended'\)/i);
  assert.doesNotMatch(sql, /grant select, insert, update on table public\.growth_customer_preferences to authenticated/i);
  assert.doesNotMatch(sql, /Customers can (create|update) own growth preferences/i);
  assert.doesNotMatch(sql, /raw_ip|ip_address|full_referrer|recipient_email|customer_notes|storage_path|filename/i);
  assert.match(sql, /revoke all on function public\.record_growth_attribution_touch[\s\S]*from public, anon, authenticated/i);
  assert.match(verifier, /growth_attribution_touch_receipts/);
  assert.match(
    verifier,
    /record_growth_attribution_touch\(text,text,text,uuid,text,text,text,text,text,text,text,text,text\)/
  );
  assert.match(
    verifier,
    /link_growth_visitor_identity\(text,text,uuid,timestamptz\)/
  );
  assert.match(verifier, /public_has_no_direct_dml/);
  assert.match(verifier, /authenticated_select_matches_contract/);
  assert.match(verifier, /browser_execute_revoked/);
  assert.match(verifier, /security_invoker/);
  assert.match(verifier, /bounded_search_path/);
  assert.match(verifier, /transaction_serialization_present/);
  assert.match(verifier, /trigger_function_browser_execute_revoked/);
  assert.match(verifier, /trigger_attachment_matches_contract/);
  assert.match(
    verifier,
    /tgrelid = pg_catalog\.to_regclass[\s\S]*tgfoid = trigger_function\.signature[\s\S]*tgtype = 19/i
  );
  assert.match(verifier, /legacy_rollback_bridge_safe/);
  assert.doesNotMatch(verifier, /legacy_rollback_bridge_not_needed/);
  assert.match(
    verifier,
    /signature is null or[\s\S]*has_function_privilege\('service_role', signature, 'EXECUTE'\)/i
  );
  assert.match(verifier, /preference_assurance_boundary/);
  assert.match(verifier, /staff_read_policy_matches_contract/);
  assert.match(verifier, /identity_linked_event_allowed/);
  assert.match(verifier, /journey_hash_versions_constrained/);
  assert.match(verifier, /receipt_hash_versions_constrained/);
  assert.match(verifier, /no_raw_visitor_or_click_id_columns/);
  assert.match(verifier, /unexpectedly_pending_receipts/);
  assert.match(verifier, /current_touch_rpc_discards_free_form_term/);
  assert.match(
    migration,
    /record_growth_attribution_touch\(text, uuid,[\s\S]*from public, anon, authenticated'[\s\S]*grant execute[\s\S]*to service_role/i
  );
});

test("journey hash-version bridge preserves rollback writes without changing current versions", () => {
  const migration = source(
    "supabase",
    "migrations",
    "20260829000000_growth_journey_legacy_hash_compat.sql"
  );
  const installer = source("scripts", "add-growth-customer-success-center.sql");
  const verifier = source("scripts", "verify-growth-journey-legacy-hash-compat.sql");

  for (const contract of [migration, installer]) {
    assert.match(
      contract,
      /alter table public\.growth_attribution_sessions[\s\S]*alter column visitor_hash_version set default 'pre-v2-key-unknown'/i
    );
    assert.match(
      contract,
      /create or replace function public\.record_growth_attribution_touch\([\s\S]*p_term text[\s\S]*p_campaign, p_campaign,[\s\S]*null, null,[\s\S]*last_term = null/i
    );
    assert.match(
      contract,
      /create or replace function public\.normalize_growth_journey_hash_version_compat\(\)[\s\S]*returns trigger[\s\S]*security invoker/i
    );
    assert.match(
      contract,
      /if new\.visitor_hash is not null and new\.visitor_hash_version is null then[\s\S]*new\.visitor_hash_version := 'pre-v2-key-unknown'/i
    );
    assert.doesNotMatch(contract, /new\.visitor_hash_version := null/i);
    assert.match(
      contract,
      /create trigger growth_journey_hash_version_compat[\s\S]*before insert on public\.growth_journey_events[\s\S]*execute function public\.normalize_growth_journey_hash_version_compat\(\)/i
    );
    assert.match(
      contract,
      /for each row[\s\S]*when \(new\.visitor_hash is not null and new\.visitor_hash_version is null\)/i
    );
  }

  assert.doesNotMatch(migration, /\b(drop table|delete from|truncate|drop column)\b/i);
  assert.match(verifier, /t\.tgrelid = 'public\.growth_journey_events'::pg_catalog\.regclass/i);
  assert.match(verifier, /t\.tgtype = 7/i);
  assert.match(verifier, /legacy omitted-version insert was not classified safely/i);
  assert.match(verifier, /hashless insert unexpectedly received a hash version/i);
  assert.match(verifier, /explicit current hash version was changed/i);
  assert.match(verifier, /when check_violation then/i);
  assert.match(verifier, /invalid hash\/version pair bypassed the relational check/i);
  assert.match(verifier, /invalid hash version bypassed the relational check/i);
  assert.match(verifier, /legacy RPC stored a search term despite the privacy contract/i);
  assert.match(verifier, /legacy_session_default_is_unknown/i);
  assert.match(verifier, /legacy_rpc_is_privacy_minimized_and_service_only/i);
  assert.match(
    verifier,
    /to_regprocedure\([\s\S]*record_growth_attribution_touch\(text,uuid,text,text,text,text,text,text,text,text,text\)[\s\S]*not p\.prosecdef[\s\S]*search_path[\s\S]*legacy_rpc_is_privacy_minimized_and_service_only/i
  );
  assert.match(verifier, /no_stored_search_terms/i);
  assert.match(verifier, /rollback;/i);
});

test("growth invalidation notifies mounted consumers and removes the listener cleanly", () => {
  let invalidations = 0;
  const unsubscribe = subscribeGrowthConsentInvalidation(() => {
    invalidations += 1;
  });
  invalidateGrowthConsentOperations();
  assert.equal(invalidations, 1);
  unsubscribe();
  invalidateGrowthConsentOperations();
  assert.equal(invalidations, 1);

  const analytics = source("src", "components", "analytics", "PublicAnalytics.tsx");
  assert.match(analytics, /subscribeGrowthConsentInvalidation/);
  for (const reset of [
    /lastPageViewRef\.current = ""/,
    /lastAttributionPathRef\.current = ""/,
    /initialAttributionTouchRef\.current = null/,
    /sentAttributionTouchesRef\.current = new Set<string>\(\)/,
  ]) assert.match(analytics, reset);
});

test("verified registration eligibility accepts only a fresh Auth account creation window", () => {
  const now = Date.parse("2026-08-28T12:00:00.000Z");
  const old = "2026-08-01T12:00:00.000Z";
  const fresh = "2026-08-28T11:45:00.000Z";
  assert.equal(isVerifiedRegistrationWindowOpen({
    created_at: old,
    email_confirmed_at: old,
    confirmed_at: old,
  }, now), false);
  assert.equal(isVerifiedRegistrationWindowOpen({
    created_at: old,
    email_confirmed_at: fresh,
    confirmed_at: null,
    email_change_sent_at: fresh,
    updated_at: fresh,
  }, now), false, "an old account's fresh e-mail change is not a registration");
  assert.equal(isVerifiedRegistrationWindowOpen({
    created_at: old,
    email_confirmed_at: old,
    confirmed_at: old,
    updated_at: fresh,
  }, now), false, "updated_at alone is not registration evidence");
  assert.equal(isVerifiedRegistrationWindowOpen({
    created_at: old,
    confirmation_sent_at: old,
    email_confirmed_at: fresh,
    confirmed_at: fresh,
    updated_at: fresh,
  }, now), true, "delayed first e-mail confirmation");
  assert.equal(isVerifiedRegistrationWindowOpen({
    created_at: fresh,
    email_confirmed_at: fresh,
    confirmed_at: fresh,
  }, now), true, "fresh Google/provider account");
  assert.equal(isVerifiedRegistrationWindowOpen({
    created_at: "2026-08-28T12:01:00.000Z",
    email_confirmed_at: null,
    confirmed_at: null,
  }, now), false, "future timestamps fail closed");

  const route = source("src", "app", "api", "growth", "journey", "route.ts");
  const eligibility = route.indexOf("!isCompletedCustomerRegistrationEligible(auth)");
  const record = route.indexOf("const result = await recordGrowthJourneyEvent");
  assert.ok(eligibility >= 0 && record > eligibility);
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
      purpose: "analytics",
      consentVersion: "consent-mode-v2",
      visitorId: null,
    }),
  }))).status, 401);
  assert.equal((await journeyRoute.POST(new Request("http://localhost/api/growth/journey", {
    method: "POST",
    body: JSON.stringify({ action: "request_started", padding: "x".repeat(9_000) }),
  }))).status, 413);
  assert.equal(growthJourneyAuthMode("account_created"), "verified-account");
  assert.equal(growthJourneyAuthMode("identity_linked"), "verified-account");
  for (const action of ["request_started", "request_created", "reminder_preference"] as const) {
    assert.equal(growthJourneyAuthMode(action), "verified-device", action);
  }
  assert.match(journeySource, /growthJourneyAuthMode\(parsed\.data\.action\)[\s\S]*?requireBaseApiUser\(request\)[\s\S]*?requireApiUser\(request\)/);
  assert.match(journeySource, /growth_customer_preferences[\s\S]*?abandoned_request_reminders[\s\S]*?consent_version[\s\S]*?revoked_at/);
  assert.doesNotMatch(journeySource, /export async function GET/);
  assert.doesNotMatch(reportType, /visitorHash|visitor_hash|recipientEmail|customerEmail|phone|sourceReference|storagePath|notes:/);
});

test("campaign outcomes use one first touch per customer and exclude pre-touch or out-of-range value", () => {
  const metrics = buildGrowthMetrics({
    startAt: new Date("2026-01-01T00:00:00.000Z"),
    endAt: new Date("2026-01-31T23:59:59.999Z"),
    profiles: [
      { id: "u1", role: "customer", created_at: "2025-10-01T00:00:00Z" },
      { id: "u2", role: "customer", created_at: "2025-11-01T00:00:00Z" },
    ],
    orders: [
      { id: "u1-before", customer_id: "u1", status: "completed", service_type: "Stage 1", vehicle_brand: "BMW", credits_required: 1, created_at: "2026-01-05T00:00:00Z" },
      { id: "u1-after", customer_id: "u1", status: "completed", service_type: "Stage 1", vehicle_brand: "BMW", credits_required: 1, created_at: "2026-01-11T00:00:00Z" },
      { id: "u1-later-period", customer_id: "u1", status: "completed", service_type: "Stage 1", vehicle_brand: "BMW", credits_required: 1, created_at: "2026-02-01T00:00:00Z" },
      { id: "u2-before", customer_id: "u2", status: "completed", service_type: "TCU", vehicle_brand: "Audi", credits_required: 1, created_at: "2026-01-11T00:00:00Z" },
      { id: "u2-after-1", customer_id: "u2", status: "completed", service_type: "TCU", vehicle_brand: "Audi", credits_required: 1, created_at: "2026-01-13T00:00:00Z" },
      { id: "u2-after-2", customer_id: "u2", status: "completed", service_type: "TCU", vehicle_brand: "Audi", credits_required: 1, created_at: "2026-01-14T00:00:00Z" },
    ],
    payments: [
      { id: "u1-before", user_id: "u1", status: "succeeded", amount_total: 9_000, currency: "eur", created_at: "2026-01-09T00:00:00Z" },
      { id: "u1-after", user_id: "u1", status: "succeeded", amount_total: 1_000, currency: "eur", created_at: "2026-01-12T00:00:00Z" },
      { id: "u1-later-period", user_id: "u1", status: "succeeded", amount_total: 8_000, currency: "eur", created_at: "2026-02-01T00:00:00Z" },
      { id: "u2-after", user_id: "u2", status: "succeeded", amount_total: 2_000, currency: "eur", created_at: "2026-01-13T00:00:00Z" },
    ],
    emails: [],
    attribution: [
      { user_id: "u1", first_source: "referral", first_medium: "referral", first_campaign: "older-campaign", first_term: null, first_landing_path: "/", first_country_code: "GB", first_seen_at: "2025-12-20T00:00:00Z" },
      { user_id: "u1", first_source: "google", first_medium: "cpc", first_campaign: "campaign-a", first_term: null, first_landing_path: "/services/stage-1", first_country_code: "GB", first_seen_at: "2026-01-10T00:00:00Z" },
      { user_id: "u1", first_source: "google", first_medium: "cpc", first_campaign: "campaign-b", first_term: null, first_landing_path: "/services/stage-2", first_country_code: "IE", first_seen_at: "2026-01-15T00:00:00Z" },
      { user_id: "u2", first_source: "google", first_medium: "cpc", first_campaign: "campaign-b", first_term: null, first_landing_path: "/services/tcu-tuning", first_country_code: "IE", first_seen_at: "2026-01-12T00:00:00Z" },
      { user_id: null, first_source: "google", first_medium: "cpc", first_campaign: "campaign-b", first_term: null, first_landing_path: "/file-service", first_country_code: "GB", first_seen_at: "2026-01-16T00:00:00Z" },
    ],
    journeyEvents: [],
  });

  const campaignA = metrics.byCampaign.find((row) => row.key === "campaign-a");
  const campaignB = metrics.byCampaign.find((row) => row.key === "campaign-b");
  assert.equal(campaignA?.registrations, 0);
  assert.equal(campaignA?.orders, 0);
  assert.deepEqual(campaignA?.revenueByCurrency, []);
  assert.equal(campaignB?.consentedVisitors, 3);
  assert.equal(campaignB?.registrations, 0);
  assert.equal(campaignB?.returningCustomers, 1);
  assert.equal(campaignB?.orders, 2);
  assert.equal(campaignB?.repeatCustomers, 1);
  assert.equal(campaignB?.revenueByCurrency[0]?.amountMinor, 2_000);
  assert.equal(
    metrics.byCampaign.reduce((sum, row) => sum + row.orders, 0),
    2
  );
});

test("an existing profile linked by a paid request is never reported as a registration", () => {
  const metrics = buildGrowthMetrics({
    startAt: new Date("2026-01-01T00:00:00.000Z"),
    endAt: new Date("2026-01-31T23:59:59.999Z"),
    profiles: [
      { id: "existing-user", role: "customer", created_at: "2025-06-01T00:00:00Z" },
    ],
    orders: [
      { id: "request-1", customer_id: "existing-user", status: "new", service_type: "Stage 1", vehicle_brand: "BMW", credits_required: 10, created_at: "2026-01-11T00:00:00Z" },
    ],
    payments: [],
    emails: [],
    attribution: [
      { user_id: "existing-user", first_source: "google", first_medium: "cpc", first_campaign: "uk_paid", first_term: null, first_landing_path: "/services/stage-1", first_country_code: "GB", first_seen_at: "2026-01-10T00:00:00Z" },
    ],
    journeyEvents: [
      { event_type: "request_created", user_id: "existing-user", order_id: "request-1", occurred_at: "2026-01-11T00:00:00Z" },
    ],
  });

  const campaign = metrics.byCampaign.find((row) => row.key === "uk_paid");
  assert.equal(campaign?.registrations, 0);
  assert.equal(campaign?.returningCustomers, 1);
  assert.equal(campaign?.orders, 1);
  assert.equal(metrics.funnel.visitorToRegistrationRate, 0);
});

test("a consented identity link attributes returning-customer payment without inventing a registration", () => {
  const metrics = buildGrowthMetrics({
    startAt: new Date("2026-01-01T00:00:00.000Z"),
    endAt: new Date("2026-01-31T23:59:59.999Z"),
    profiles: [
      { id: "returning-buyer", role: "customer", created_at: "2025-05-01T00:00:00Z" },
    ],
    orders: [],
    payments: [
      { id: "payment-1", user_id: "returning-buyer", status: "succeeded", amount_total: 5_000, currency: "eur", created_at: "2026-01-12T00:00:00Z" },
    ],
    emails: [],
    attribution: [
      { user_id: "returning-buyer", first_source: "google", first_medium: "cpc", first_campaign: "uk_paid", first_term: null, first_landing_path: "/file-service", first_country_code: "GB", first_seen_at: "2026-01-10T00:00:00Z" },
    ],
    journeyEvents: [
      { event_type: "identity_linked", user_id: "returning-buyer", order_id: null, occurred_at: "2026-01-10T00:01:00Z" },
    ],
  });

  const campaign = metrics.byCampaign.find((row) => row.key === "uk_paid");
  assert.equal(campaign?.registrations, 0);
  assert.equal(campaign?.returningCustomers, 1);
  assert.equal(campaign?.payingCustomers, 1);
  assert.equal(campaign?.revenueByCurrency[0]?.amountMinor, 5_000);
});

test("growth API rejects missing, forged, or purpose-mismatched consent assertions before auth", async () => {
  const journeyRoute = await import("../src/app/api/growth/journey/route");
  const attemptId = "00000000-0000-4000-8000-000000000001";
  const visitorId = "00000000-0000-4000-8000-000000000002";
  const orderId = "00000000-0000-4000-8000-000000000003";
  const invalidBodies = [
    { action: "account_created" },
    {
      action: "account_created",
      purpose: "advertising",
      consentVersion: "consent-mode-v2",
      visitorId: null,
    },
    {
      action: "account_created",
      purpose: "advertising",
      consentVersion: "consent-mode-v2",
      visitorId,
    },
    {
      action: "identity_linked",
      purpose: "advertising",
      consentVersion: "consent-mode-v2",
      visitorId,
    },
    {
      action: "identity_linked",
      purpose: "analytics",
      consentVersion: "consent-mode-v2",
    },
    {
      action: "request_started",
      attemptId,
      purpose: "analytics",
      consentVersion: "abandoned-request-v1",
    },
    {
      action: "request_started",
      attemptId,
      purpose: "reminder",
      consentVersion: "abandoned-request-v1",
      visitorId: null,
    },
    {
      action: "request_created",
      orderId,
      attemptId,
      purpose: "advertising",
      consentVersion: "consent-mode-v2",
    },
  ];
  for (const body of invalidBodies) {
    const result = await journeyRoute.POST(new Request("http://localhost/api/growth/journey", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }));
    assert.equal(result.status, 400, JSON.stringify(body));
  }
});

test("authenticated attribution linking is centralized, consented, auth-bound and provider-free", () => {
  const runtime = source("src", "components", "analytics", "GrowthIdentityLinkRuntime.tsx");
  const layout = source("src", "app", "layout.tsx");
  const boundary = source("src", "components", "analytics", "AccountRuntimeBoundary.tsx");
  const client = source("src", "lib", "growth", "client.ts");
  const server = source("src", "lib", "growth", "server.ts");
  const route = source("src", "app", "api", "growth", "journey", "route.ts");
  const migration = source("supabase", "migrations", "20260828000000_growth_attribution_integrity.sql");

  assert.match(layout, /<AccountRuntimeBoundary\s*\/>/);
  assert.doesNotMatch(layout, /GrowthIdentityLinkRuntime/);
  assert.match(boundary, /import\("@\/components\/analytics\/GrowthIdentityLinkRuntime"\)/);
  assert.match(boundary, /isAccountRuntimePath\(pathname\)/);
  assert.match(runtime, /getStableSession\(\)[\s\S]*recordGrowthIdentityLinked\(expectedUserId\)/);
  assert.match(runtime, /supabase\.auth\.onAuthStateChange/);
  assert.match(runtime, /inFlight[\s\S]*rerunRequested = true[\s\S]*void attempt\(\)/);
  assert.match(runtime, /measurementConsentChangedEvent/);
  assert.match(runtime, /window\.addEventListener\("online"/);
  assert.doesNotMatch(runtime, /gtag|trackRegistrationCompleted|trackPurchaseCompleted|user\.email/i);
  assert.match(client, /recordGrowthIdentityLinked[\s\S]*readExistingGrowthVisitorId\(\)[\s\S]*action: "identity_linked"/);
  assert.match(route, /identityLinkedSchema[\s\S]*purpose: z\.literal\("analytics"\)[\s\S]*visitorId: z\.string\(\)\.uuid\(\)/);
  assert.match(server, /identity_linked[\s\S]*analytics:consent-mode-v2/);
  assert.match(migration, /'identity_linked'/);
});

test("instrumentation is fail-soft and reminders have no automatic sender", () => {
  const requestPage = source("src", "app", "new-request", "page.tsx");
  const analytics = source("src", "components", "analytics", "PublicAnalytics.tsx");
  const reminderRoute = source("src", "app", "api", "admin", "growth", "reminders", "route.ts");
  const docs = source("docs", "growth-customer-success-center.md");
  assert.match(requestPage, /createGrowthRequestStartDeliveryController/);
  assert.match(requestPage, /onChangeCapture=\{markRequestStarted\}/);
  assert.match(requestPage, /requestStartTrackedRef\.current = true[\s\S]*growthStartDelivery\.begin/);
  assert.doesNotMatch(requestPage, /const meaningfulStart = Boolean\(/);
  assert.match(requestPage, /Promise\.all\([\s\S]*?trackRequestSubmitted\(conversionSeed\)[\s\S]*?recordGrowthRequestCreated/);
  assert.match(requestPage, /recordGrowthRequestCreated\([\s\S]*?growthAttemptIdRef\.current[\s\S]*?\.catch\(\(\) => false\)/);
  assert.match(requestPage, /abandonedReminderEnabled[\s\S]*useState\(false\)/);
  assert.match(analytics, /!preferences\?\.analytics/);
  assert.match(analytics, /preferences\.advertising/);
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
  assert.match(
    client,
    /removeOrInvalidateGrowthAttributionStorage\(\s*growthVisitorStorageKey,\s*""\s*\)/
  );
  assert.match(client, /growthAttributionRevocationStorageKey/);
  assert.match(analytics, /if \(!next\.analytics\) clearGrowthVisitorId\(\)/);
  assert.match(analytics, /@\/lib\/growth\/publicClient/);
  assert.doesNotMatch(client, /authGuards|supabase|service.role|service_role/i);
});

test("growth attribution preserves a memory-only first touch and retries only after consent", () => {
  const route = source("src", "app", "api", "growth", "journey", "route.ts");
  const server = source("src", "lib", "growth", "server.ts");
  const client = source("src", "lib", "growth", "publicClient.ts");
  const analytics = source("src", "components", "analytics", "PublicAnalytics.tsx");
  const captureBlock = client.slice(
    client.indexOf("export function captureGrowthAttributionTouch"),
    client.indexOf("async function performGrowthAttributionTouchDelivery")
  );

  assert.doesNotMatch(captureBlock, /localStorage|sessionStorage|fetch\(/);
  assert.match(client, /!analyticsAllowed\(\)[\s\S]*return false/);
  assert.match(analytics, /initialAttributionTouchRef/);
  assert.match(analytics, /selectGrowthAttributionTouchesForRoute/);
  assert.match(
    analytics,
    /const currentTouch = attributionPublicRoute[\s\S]*?\? captureGrowthAttributionTouch\(\)[\s\S]*?: null/
  );
  assert.match(analytics, /sentAttributionTouchesRef/);
  assert.match(analytics, /if \(!acknowledged\)[\s\S]*?break;[\s\S]*?sentAttributionTouchesRef\.current\.add\(key\)/);
  assert.match(analytics, /attempts <= 3/);
  assert.match(analytics, /addEventListener\("online", retryWhenOnline\)/);
  assert.match(client, /response\.json\(\)[\s\S]*?accepted === true/);
  assert.match(server, /GROWTH_ATTRIBUTION_HMAC_SECRET\?\.trim\(\)/);
  assert.match(server, /current === legacy/);
  assert.match(server, /current === serviceRole/);
  assert.match(server, /currentSecret\.length < 32/);
  assert.doesNotMatch(server, /GROWTH_ATTRIBUTION_HMAC_SECRET \|\| process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(server, /legacyGrowthSecret[\s\S]*GROWTH_ATTRIBUTION_LEGACY_HMAC_SECRET/);
  assert.match(server, /legacyGrowthSecret[\s\S]*SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(server, /currentGrowthHashVersion = "dedicated-v2"/);
  assert.match(server, /legacyGrowthHashVersion = "legacy-service-role-v1"/);
  assert.match(route, /const result = await recordGrowthAttributionTouchServer[\s\S]*?if \(!result\.ok\)[\s\S]*?temporarilyUnavailable/);
  assert.match(route, /const result = await recordGrowthJourneyEvent[\s\S]*?if \(!result\.ok\) return temporarilyUnavailable/);
  assert.doesNotMatch(route, /catch \{[\s\S]{0,160}accepted: true/);
  assert.match(server, /result\.error[\s\S]{0,120}!isOpaqueGrowthId\(result\.data\)/);
  assert.match(server, /if \(!isOpaqueGrowthId\(existing\.data\?\.id\)\)[\s\S]*?journey_not_recorded/);
  assert.doesNotMatch(analytics, /sessionStorage\.setItem\([^)]*attribution|localStorage\.setItem\([^)]*attribution/i);
});

test("a stored reminder opt-in resumes an interaction that happened before profile load", () => {
  const requestPage = source("src", "app", "new-request", "page.tsx");
  const client = source("src", "lib", "growth", "client.ts");
  const controllerBlock = client.match(
    /export function createGrowthRequestStartDeliveryController[\s\S]*?\r?\n}\r?\n\r?\nexport function recordGrowthRequestCreated/,
  )?.[0] ?? "";
  const profilePreferenceBlock = requestPage.match(
    /const preference = await supabase[\s\S]*?setProfileLoading\(false\);/,
  )?.[0] ?? "";

  assert.match(controllerBlock, /const inFlight = new Map/);
  assert.match(controllerBlock, /requestedPurpose: purpose/);
  assert.match(controllerBlock, /if \(reminderOptIn\) deliveries\.push\(queue\("reminder"\)\)/);
  assert.match(controllerBlock, /result\.accepted && result\.purpose === "analytics"[\s\S]*?analyticsRecorded = true/);
  assert.match(controllerBlock, /result\.accepted && result\.purpose === "reminder"[\s\S]*?reminderRecorded = true/);
  assert.match(profilePreferenceBlock, /reminderEnabled[\s\S]*?queueGrowthRequestStart\(true\)/);
  assert.equal((profilePreferenceBlock.match(/queueGrowthRequestStart\(true\)/g) ?? []).length, 1);
});

test("an undecided request start retries after consent and ACKs exactly once", async () => {
  let consentGranted = false;
  let deliveries = 0;
  let acknowledgements = 0;
  const controller = createGrowthRequestStartDeliveryController(async () => {
    deliveries += 1;
    if (!consentGranted) return { accepted: false, purpose: null };
    acknowledgements += 1;
    return { accepted: true, purpose: "analytics" };
  });

  assert.equal(await controller.begin(
    "11111111-1111-4111-8111-111111111111",
    false,
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
  ), false);
  consentGranted = true;
  assert.deepEqual(
    await Promise.all([
      controller.retryAfterConsent(),
      controller.retryAfterConsent(),
    ]),
    [true, true]
  );
  assert.equal(await controller.retryAfterConsent(), true);
  assert.equal(deliveries, 2);
  assert.equal(acknowledgements, 1);
  assert.equal(controller.hasRecorded(), true);
  assert.equal(controller.hasAnalyticsRecorded(), true);
});

test("a reminder ACK still permits one later analytics visitor-link replay", async () => {
  let analyticsGranted = false;
  const purposes: Array<string | null> = [];
  const controller = createGrowthRequestStartDeliveryController(async (_attemptId, options) => {
    const purpose = options.requestedPurpose === "reminder"
      ? "reminder"
      : analyticsGranted
        ? "analytics"
        : null;
    purposes.push(purpose);
    return { accepted: purpose !== null, purpose };
  });

  assert.equal(
    await controller.begin(
      "22222222-2222-4222-8222-222222222222",
      true,
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    ),
    true
  );
  assert.equal(controller.hasRecorded(), true);
  assert.equal(controller.hasAnalyticsRecorded(), false);
  analyticsGranted = true;
  assert.deepEqual(
    await Promise.all([
      controller.retryAfterConsent(),
      controller.retryAfterConsent(),
    ]),
    [true, true]
  );
  assert.deepEqual(purposes, [null, "reminder", "analytics"]);
  assert.equal(controller.hasAnalyticsRecorded(), true);
});

test("analytics and reminder request starts are delivered and deduped independently", async () => {
  const purposes: Array<string | null | undefined> = [];
  const controller = createGrowthRequestStartDeliveryController(async (_attemptId, options) => {
    purposes.push(options.requestedPurpose);
    return {
      accepted: true,
      purpose: options.requestedPurpose ?? null,
    };
  });

  assert.equal(
    await controller.begin(
      "33333333-3333-4333-8333-333333333333",
      true,
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
    ),
    true
  );
  assert.deepEqual(purposes, ["analytics", "reminder"]);
  assert.equal(await controller.retryAfterConsent(), true);
  assert.equal(await controller.requestReminder(), true);
  assert.deepEqual(purposes, ["analytics", "reminder"]);
});

test("a late reminder opt-in still records after Analytics already ACKed", async () => {
  const purposes: Array<string | null | undefined> = [];
  const controller = createGrowthRequestStartDeliveryController(async (_attemptId, options) => {
    purposes.push(options.requestedPurpose);
    return {
      accepted: true,
      purpose: options.requestedPurpose ?? null,
    };
  });

  assert.equal(
    await controller.begin(
      "44444444-4444-4444-8444-444444444444",
      false,
      "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
    ),
    true
  );
  assert.equal(await controller.requestReminder(), true);
  assert.deepEqual(purposes, ["analytics", "reminder"]);
});

test("Search Console demand remains aggregate and explicitly unlinked from customers", () => {
  const report = source("src", "lib", "growth", "report.ts");
  const ui = source("src", "app", "admin", "growth", "GrowthCustomerSuccessClient.tsx");
  assert.match(report, /Search Console queries are aggregate search-demand evidence and are never joined to individual customers/);
  assert.match(ui, /deliberately not attributed to a named or pseudonymous customer/);
  assert.doesNotMatch(report, /query.*customer_id|customer_id.*query/i);
});
