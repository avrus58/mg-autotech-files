import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { buildGrowthAttributionTouch } from "../src/lib/growth/attribution";
import type { GrowthCustomerSuccessReport, GrowthPerformanceRow } from "../src/lib/growth/types";
import {
  buildAdsPerformanceReport,
  getAdsConfigurationStatus,
} from "../src/lib/googleAds/readiness";
import {
  analyticsConsentStorageKey,
  createPrivateConversionId,
  measurementConsentStorageKey,
  readMeasurementConsentSnapshot,
  writeMeasurementConsent,
} from "../src/lib/publicAnalytics";

function projectFile(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

async function withWindow<T>(run: (storage: MemoryStorage) => T | Promise<T>) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: storage, crypto: globalThis.crypto },
  });
  try {
    return await run(storage);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "window", descriptor);
    else Reflect.deleteProperty(globalThis, "window");
  }
}

function performanceRow(input: Partial<GrowthPerformanceRow> & Pick<GrowthPerformanceRow, "key" | "label">): GrowthPerformanceRow {
  return {
    consentedVisitors: 0,
    registrations: 0,
    customersWithRequests: 0,
    orders: 0,
    repeatCustomers: 0,
    payingCustomers: 0,
    conversionRate: null,
    revenueByCurrency: [],
    ...input,
  };
}

test("legacy analytics consent never silently grants advertising measurement", async () => {
  await withWindow((storage) => {
    storage.setItem(analyticsConsentStorageKey, "granted");
    const snapshot = readMeasurementConsentSnapshot();
    assert.equal(snapshot.source, "legacy_granted");
    assert.equal(snapshot.needsDecision, true);
    assert.equal(snapshot.preferences.analytics, true);
    assert.equal(snapshot.preferences.advertising, false);
  });
});

test("Consent Mode v2 preferences persist analytics and advertising independently", async () => {
  await withWindow((storage) => {
    writeMeasurementConsent({ analytics: true, advertising: false });
    const snapshot = readMeasurementConsentSnapshot();
    assert.equal(snapshot.source, "v2");
    assert.equal(snapshot.needsDecision, false);
    assert.deepEqual(
      { analytics: snapshot.preferences.analytics, advertising: snapshot.preferences.advertising },
      { analytics: true, advertising: false }
    );
    assert.equal(storage.getItem(analyticsConsentStorageKey), "granted");
    assert.match(storage.getItem(measurementConsentStorageKey) ?? "", /consent-mode-v2/);
  });
});

test("conversion transaction IDs are stable hashes and never expose their source seed", async () => {
  await withWindow(async () => {
    const first = await createPrivateConversionId("purchase", "cs_live_private_payment_reference");
    const second = await createPrivateConversionId("purchase", "cs_live_private_payment_reference");
    assert.equal(first, second);
    assert.match(first ?? "", /^[a-f0-9]{64}$/);
    assert.doesNotMatch(first ?? "", /cs_live|private|payment/i);
  });
});

test("Google Ads click signals classify paid traffic without retaining raw click IDs", () => {
  const clickId = "private-google-click-id-must-not-be-stored";
  const touch = buildGrowthAttributionTouch({
    url: `https://file.mgautotech.de/services/stage-1?gclid=${clickId}&utm_campaign=stage1_de`,
    referrer: "https://www.google.de/",
    locale: "de-DE",
  });
  assert.equal(touch?.source, "google");
  assert.equal(touch?.medium, "cpc");
  assert.equal(touch?.campaign, "stage1_de");
  assert.doesNotMatch(JSON.stringify(touch), new RegExp(clickId));
  assert.equal(Object.hasOwn(touch ?? {}, "gclid"), false);
});

test("Ads readiness fails closed until every public conversion label is configured", () => {
  const keys = [
    "NEXT_PUBLIC_GOOGLE_ANALYTICS_ID",
    "NEXT_PUBLIC_GOOGLE_ADS_ID",
    "NEXT_PUBLIC_GOOGLE_ADS_REGISTRATION_LABEL",
    "NEXT_PUBLIC_GOOGLE_ADS_REQUEST_LABEL",
    "NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL",
  ] as const;
  const before = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID = "G-ABC1234567";
    process.env.NEXT_PUBLIC_GOOGLE_ADS_ID = "AW-123456789";
    process.env.NEXT_PUBLIC_GOOGLE_ADS_REGISTRATION_LABEL = "Register_123";
    process.env.NEXT_PUBLIC_GOOGLE_ADS_REQUEST_LABEL = "Request_123";
    delete process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL;
    assert.equal(getAdsConfigurationStatus().readyForVerifiedMeasurement, false);
    process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL = "Purchase_123";
    const ready = getAdsConfigurationStatus();
    assert.equal(ready.readyForVerifiedMeasurement, true);
    assert.equal(ready.personalizedAdvertising, false);
  } finally {
    for (const key of keys) {
      const value = before[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("admin report exposes aggregate paid results and no configuration values", () => {
  const report = buildAdsPerformanceReport({
    generatedAt: "2026-08-06T12:00:00.000Z",
    range: "30d",
    bySource: [performanceRow({ key: "google / cpc", label: "google / cpc", consentedVisitors: 10, orders: 2 })],
    byCampaign: [performanceRow({ key: "stage1_de", label: "stage1_de", registrations: 3, orders: 2 })],
  } as GrowthCustomerSuccessReport);

  assert.equal(report.paidSources.length, 1);
  assert.equal(report.campaigns.length, 1);
  assert.equal(report.measurementPolicy.rawClickIdsStored, false);
  assert.equal(report.measurementPolicy.customerIdentifiersExported, false);
  assert.doesNotMatch(JSON.stringify(report), /AW-\d+|service_role|private_key|client_secret/i);
});

test("verified conversion integration is ordered after business success and remains fail-soft", () => {
  const register = projectFile("src", "app", "register", "page.tsx");
  const callback = projectFile("src", "app", "auth", "callback", "page.tsx");
  const request = projectFile("src", "app", "new-request", "page.tsx");
  const payment = projectFile("src", "app", "payment", "success", "page.tsx");
  const confirmation = projectFile("src", "app", "api", "stripe", "confirm-session", "route.ts");
  const analytics = projectFile("src", "lib", "publicAnalytics.ts");

  assert.match(register, /isAlreadyVerified[\s\S]*?trackRegistrationCompleted\(\)/);
  assert.match(callback, /isRecentSignup \|\| isRecentEmailConfirmation[\s\S]*?trackRegistrationCompleted\(\)/);
  assert.match(request, /if \(error\) \{[\s\S]*?return;[\s\S]*?trackRequestSubmitted\(conversionAttemptId\)/);
  assert.match(confirmation, /session\.payment_status !== "paid"[\s\S]*?completeStripeCreditPurchase\(session\)[\s\S]*?conversion:/);
  assert.match(payment, /if \(!response\.ok\)[\s\S]*?return;[\s\S]*?trackPurchaseCompleted/);
  assert.match(analytics, /process\.env\.NEXT_PUBLIC_GOOGLE_ADS_ID/);
  assert.doesNotMatch(analytics, /customer_email|vehicle_brand|storage_path|file_name|order_id/i);
});
