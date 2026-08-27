import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  buildGrowthAttributionTouch,
  growthAttributionTouchKey,
  uniqueGrowthAttributionTouches,
} from "../src/lib/growth/attribution";
import type { GrowthCustomerSuccessReport, GrowthPerformanceRow } from "../src/lib/growth/types";
import { recordGrowthAttributionTouch } from "../src/lib/growth/publicClient";
import {
  completePendingRegistrationHandoffs,
  createRegistrationAccountBinding,
  isVerifiedEmailRegistrationCallback,
  markRegistrationHandoffsPending,
  readPendingRegistrationHandoffs,
  readRegistrationSessionValue,
  REGISTRATION_HANDOFF_TTL_MS,
  removeRegistrationSessionValues,
  writeRegistrationSessionValue,
} from "../src/lib/registrationConversion";
import {
  buildAdsMeasurementHealth,
  buildAdsPerformanceReport,
  getAdsConfigurationStatus,
} from "../src/lib/googleAds/readiness";
import {
  buildGoogleAdsCampaignUrl,
  googleAdsLanguageDestinations,
} from "../src/lib/googleAds/campaignLinks";
import {
  analyticsConsentStorageKey,
  clearGoogleAdsConversionOutbox,
  createPrivateConversionId,
  denyGoogleMeasurement,
  googleAdsConversionOutboxStorageKey,
  initializeGoogleMeasurement,
  measurementConsentStorageKey,
  notifyGoogleMeasurementScriptFailed,
  notifyGoogleMeasurementScriptLoaded,
  readMeasurementConsentSnapshot,
  trackPurchaseCompleted,
  trackRegistrationCompleted,
  trackRequestSubmitted,
  writeMeasurementConsent,
} from "../src/lib/publicAnalytics";

function projectFile(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

class MemoryStorage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  keys() { return [...this.values.keys()]; }
}

async function withWindow<T>(run: (storage: MemoryStorage) => T | Promise<T>) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: storage,
      crypto: globalThis.crypto,
      location: { pathname: "/new-request" },
    },
  });
  try {
    return await run(storage);
  } finally {
    clearGoogleAdsConversionOutbox();
    notifyGoogleMeasurementScriptFailed();
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

test("Consent Mode v2 queues default denied before any granted update", async () => {
  await withWindow(() => {
    denyGoogleMeasurement();
    writeMeasurementConsent({ analytics: true, advertising: true });
    initializeGoogleMeasurement({
      googleAnalyticsMeasurementId: "G-ABC1234567",
      googleAdsId: "AW-123456789",
      registrationLabel: "Register_123",
      requestLabel: "Request_123",
      purchaseLabel: "Purchase_123",
    });

    const queuedCommands = (
      globalThis.window as unknown as { dataLayer?: Array<ArrayLike<unknown>> }
    ).dataLayer ?? [];
    const dataLayer = queuedCommands.map((entry) => Array.from(entry));
    assert.deepEqual(dataLayer[0]?.slice(0, 2), ["consent", "default"]);
    assert.equal((dataLayer[0]?.[2] as { analytics_storage?: string }).analytics_storage, "denied");
    assert.equal((dataLayer[0]?.[2] as { ad_user_data?: string }).ad_user_data, "denied");
    assert.equal((dataLayer[0]?.[2] as { wait_for_update?: number }).wait_for_update, 500);
    assert.equal(dataLayer.filter((entry) => entry[0] === "consent" && entry[1] === "default").length, 1);
    const grantedUpdate = [...dataLayer].reverse().find((entry) => entry[0] === "consent" && entry[1] === "update");
    assert.equal((grantedUpdate?.[2] as { analytics_storage?: string }).analytics_storage, "granted");
    assert.equal((grantedUpdate?.[2] as { ad_storage?: string }).ad_storage, "granted");
    assert.equal((grantedUpdate?.[2] as { ad_personalization?: string }).ad_personalization, "denied");
  });
});

test("Google Ads conversions enter the tag queue before script load and dedupe after handoff callback", async () => {
  await withWindow(async (storage) => {
    const privateSeed = "private-order-reference-must-never-be-persisted";
    const configuration = {
      googleAnalyticsMeasurementId: "G-ABC1234567",
      googleAdsId: "AW-123456789",
      registrationLabel: "Register_123",
      requestLabel: "Request_123",
      purchaseLabel: "Purchase_123",
    };

    writeMeasurementConsent({ analytics: false, advertising: true });
    initializeGoogleMeasurement(configuration);
    notifyGoogleMeasurementScriptFailed();

    assert.equal(await trackRequestSubmitted(privateSeed), true);
    const persisted = storage.getItem(googleAdsConversionOutboxStorageKey) ?? "";
    assert.match(persisted, /[a-f0-9]{64}/);
    assert.doesNotMatch(persisted, new RegExp(privateSeed));

    const target = globalThis.window as unknown as {
      dataLayer?: Array<ArrayLike<unknown>>;
    };
    const commands = (target.dataLayer ?? []).map((entry) => Array.from(entry));
    const conversion = commands.find(
      (entry) => entry[0] === "event" && entry[1] === "conversion"
    );
    assert.ok(conversion);
    const params = conversion[2] as {
      send_to?: string;
      transaction_id?: string;
      page_location?: string;
      page_referrer?: string;
      event_callback?: () => void;
    };
    assert.equal(params.send_to, "AW-123456789/Request_123");
    assert.equal(params.page_location, "https://file.mgautotech.de/new-request");
    assert.equal(params.page_referrer, "");
    assert.match(params.transaction_id ?? "", /^[a-f0-9]{64}$/);
    assert.doesNotMatch(params.transaction_id ?? "", new RegExp(privateSeed));
    assert.equal(typeof params.event_callback, "function");
    assert.equal(await notifyGoogleMeasurementScriptLoaded(), 0);

    params.event_callback?.();
    assert.equal(storage.getItem(googleAdsConversionOutboxStorageKey), null);

    const beforeRepeat = commands.filter(
      (entry) => entry[0] === "event" && entry[1] === "conversion"
    ).length;
    assert.equal(await trackRequestSubmitted(privateSeed), false);
    const afterRepeat = (target.dataLayer ?? [])
      .map((entry) => Array.from(entry))
      .filter((entry) => entry[0] === "event" && entry[1] === "conversion")
      .length;
    assert.equal(afterRepeat, beforeRepeat);
  });
});

test("revoking advertising consent clears pending conversion retries", async () => {
  await withWindow(async (storage) => {
    writeMeasurementConsent({ analytics: false, advertising: true });
    initializeGoogleMeasurement({
      googleAnalyticsMeasurementId: "G-ABC1234567",
      googleAdsId: "AW-123456789",
      registrationLabel: "Register_123",
      requestLabel: "Request_123",
      purchaseLabel: "Purchase_123",
    });
    notifyGoogleMeasurementScriptFailed();
    assert.equal(await trackRequestSubmitted("pending-private-request"), true);
    assert.notEqual(storage.getItem(googleAdsConversionOutboxStorageKey), null);

    denyGoogleMeasurement();
    assert.notEqual(storage.getItem(googleAdsConversionOutboxStorageKey), null);

    writeMeasurementConsent({ analytics: true, advertising: false });
    assert.equal(storage.getItem(googleAdsConversionOutboxStorageKey), null);
  });
});

test("queued conversions survive a private-route transition and keep consent command ordering", async () => {
  await withWindow(async (storage) => {
    const target = globalThis.window as unknown as {
      location: { pathname: string };
      dataLayer?: Array<ArrayLike<unknown>>;
    };
    writeMeasurementConsent({ analytics: false, advertising: true });
    initializeGoogleMeasurement({
      googleAnalyticsMeasurementId: "G-ABC1234567",
      googleAdsId: "AW-123456789",
      registrationLabel: "Register_123",
      requestLabel: "Request_123",
      purchaseLabel: "Purchase_123",
    });
    notifyGoogleMeasurementScriptFailed();
    assert.equal(await trackRequestSubmitted("route-paused-request"), true);

    const beforePrivateRoute = (target.dataLayer ?? []).map((entry) => Array.from(entry));
    const conversionIndex = beforePrivateRoute.findIndex(
      (entry) => entry[0] === "event" && entry[1] === "conversion"
    );
    assert.ok(conversionIndex >= 0);

    target.location.pathname = "/dashboard";
    denyGoogleMeasurement();
    assert.equal(await notifyGoogleMeasurementScriptLoaded(), 0);
    assert.notEqual(storage.getItem(googleAdsConversionOutboxStorageKey), null);
    const afterPrivateRoute = (target.dataLayer ?? []).map((entry) => Array.from(entry));
    const grantedIndex = afterPrivateRoute.findIndex(
      (entry) =>
        entry[0] === "consent" &&
        entry[1] === "update" &&
        (entry[2] as { ad_storage?: string }).ad_storage === "granted"
    );
    const deniedIndex = afterPrivateRoute.findIndex(
      (entry, index) =>
        index > conversionIndex &&
        entry[0] === "consent" &&
        entry[1] === "update" &&
        (entry[2] as { ad_storage?: string }).ad_storage === "denied"
    );
    assert.ok(grantedIndex >= 0 && grantedIndex < conversionIndex);
    assert.ok(deniedIndex > conversionIndex);

    const conversion = afterPrivateRoute[conversionIndex];
    const params = conversion?.[2] as { event_callback?: () => void } | undefined;
    assert.equal(typeof params?.event_callback, "function");
    params?.event_callback?.();
    assert.equal(storage.getItem(googleAdsConversionOutboxStorageKey), null);
  });
});

test("verified conversion types use fixed non-sensitive canonical locations for GA4 and Ads", async () => {
  await withWindow(async () => {
    const target = globalThis.window as unknown as {
      dataLayer?: Array<ArrayLike<unknown>>;
      location: { pathname: string; href?: string; search?: string };
    };
    writeMeasurementConsent({ analytics: true, advertising: true });
    initializeGoogleMeasurement({
      googleAnalyticsMeasurementId: "G-ABC1234567",
      googleAdsId: "AW-123456789",
      registrationLabel: "Register_123",
      requestLabel: "Request_123",
      purchaseLabel: "Purchase_123",
    });
    notifyGoogleMeasurementScriptFailed();

    const callbackQuerySeed = "callback-code-must-never-reach-google";
    const paymentQuerySeed = "cs_live_payment-seed-must-never-reach-google";
    target.location.pathname = "/auth/callback";
    target.location.search = `?code=${callbackQuerySeed}&next=%2Fdashboard`;
    target.location.href = `https://file.mgautotech.de/auth/callback${target.location.search}`;
    assert.equal(
      await trackRegistrationCompleted(
        "2f37b710-4ced-4a04-8c83-3bcb0e5b1f55"
      ),
      true
    );
    target.location.pathname = "/new-request";
    target.location.search = "";
    target.location.href = "https://file.mgautotech.de/new-request";
    assert.equal(await trackRequestSubmitted("canonical-request-seed"), true);
    target.location.pathname = "/payment/success";
    target.location.search = `?session_id=${paymentQuerySeed}`;
    target.location.href = `https://file.mgautotech.de/payment/success${target.location.search}`;
    assert.equal(
      await trackPurchaseCompleted({
        anonymousPaymentSeed: paymentQuerySeed,
        value: 125,
        currency: "EUR",
      }),
      true
    );

    const conversions = (target.dataLayer ?? [])
      .map((entry) => Array.from(entry))
      .filter((entry) => entry[0] === "event" && entry[1] === "conversion");
    assert.equal(conversions.length, 3);
    const locations = new Map(
      conversions.map((entry) => {
        const params = entry[2] as {
          send_to?: string;
          page_location?: string;
          page_referrer?: string;
          transaction_id?: string;
          event_callback?: () => void;
        };
        assert.equal(params.page_referrer, "");
        assert.match(params.transaction_id ?? "", /^[a-f0-9]{64}$/);
        return [params.send_to, params.page_location];
      })
    );
    assert.deepEqual(
      Object.fromEntries(locations),
      {
        "AW-123456789/Register_123": "https://file.mgautotech.de/auth/callback",
        "AW-123456789/Request_123": "https://file.mgautotech.de/new-request",
        "AW-123456789/Purchase_123": "https://file.mgautotech.de/payment/success",
      }
    );

    const ga4Locations = new Map(
      (target.dataLayer ?? [])
        .map((entry) => Array.from(entry))
        .filter(
          (entry) =>
            entry[0] === "event" &&
            ["sign_up", "generate_lead", "purchase"].includes(String(entry[1]))
        )
        .map((entry) => {
          const params = entry[2] as {
            page_location?: string;
            page_referrer?: string;
            transaction_id?: string;
          };
          assert.equal(params.page_referrer, "");
          assert.match(params.transaction_id ?? "", /^[a-f0-9]{64}$/);
          return [entry[1], params.page_location];
        })
    );
    assert.deepEqual(Object.fromEntries(ga4Locations), {
      sign_up: "https://file.mgautotech.de/auth/callback",
      generate_lead: "https://file.mgautotech.de/new-request",
      purchase: "https://file.mgautotech.de/payment/success",
    });
    const serializedEvents = JSON.stringify(
      (target.dataLayer ?? [])
        .map((entry) => Array.from(entry))
        .filter((entry) => entry[0] === "event")
        .map((entry) => entry[2])
    );
    assert.doesNotMatch(serializedEvents, new RegExp(callbackQuerySeed));
    assert.doesNotMatch(serializedEvents, new RegExp(paymentQuerySeed));

    for (const entry of conversions) {
      (entry[2] as { event_callback?: () => void }).event_callback?.();
    }
  });
});

test("a late tag callback cannot recreate Ads measurement state after consent revocation", async () => {
  await withWindow(async (storage) => {
    const target = globalThis.window as unknown as {
      dataLayer?: Array<ArrayLike<unknown>>;
    };
    writeMeasurementConsent({ analytics: false, advertising: true });
    initializeGoogleMeasurement({
      googleAnalyticsMeasurementId: "G-ABC1234567",
      googleAdsId: "AW-123456789",
      registrationLabel: "Register_123",
      requestLabel: "Request_123",
      purchaseLabel: "Purchase_123",
    });
    notifyGoogleMeasurementScriptFailed();
    assert.equal(await trackRequestSubmitted("late-callback-request"), true);
    assert.equal(await notifyGoogleMeasurementScriptLoaded(), 0);
    const conversion = (target.dataLayer ?? [])
      .map((entry) => Array.from(entry))
      .find((entry) => entry[0] === "event" && entry[1] === "conversion");
    const params = conversion?.[2] as { event_callback?: () => void } | undefined;
    assert.equal(typeof params?.event_callback, "function");

    writeMeasurementConsent({ analytics: true, advertising: false });
    params?.event_callback?.();

    assert.equal(storage.getItem(googleAdsConversionOutboxStorageKey), null);
    assert.equal(storage.keys().some((key) => key.includes(":ads:")), false);
  });
});

test("a throwing gtag keeps the hashed conversion queued for retry", async () => {
  await withWindow(async (storage) => {
    const target = globalThis.window as unknown as {
      gtag?: (...args: unknown[]) => void;
    };
    writeMeasurementConsent({ analytics: true, advertising: true });
    initializeGoogleMeasurement({
      googleAnalyticsMeasurementId: "G-ABC1234567",
      googleAdsId: "AW-123456789",
      registrationLabel: "Register_123",
      requestLabel: "Request_123",
      purchaseLabel: "Purchase_123",
    });
    notifyGoogleMeasurementScriptFailed();
    target.gtag = () => {
      throw new Error("synthetic blocked tag");
    };

    assert.equal(await trackRequestSubmitted("throwing-gtag-request"), true);
    assert.equal(await notifyGoogleMeasurementScriptLoaded(), 0);
    assert.notEqual(storage.getItem(googleAdsConversionOutboxStorageKey), null);
    writeMeasurementConsent({ analytics: true, advertising: false });
  });
});

test("a synchronous tag handoff callback clears its retry timer and outbox", async () => {
  await withWindow(async (storage) => {
    const target = globalThis.window as unknown as {
      gtag?: (...args: unknown[]) => void;
    };
    writeMeasurementConsent({ analytics: false, advertising: true });
    initializeGoogleMeasurement({
      googleAnalyticsMeasurementId: "G-ABC1234567",
      googleAdsId: "AW-123456789",
      registrationLabel: "Register_123",
      requestLabel: "Request_123",
      purchaseLabel: "Purchase_123",
    });
    notifyGoogleMeasurementScriptFailed();
    target.gtag = (...args: unknown[]) => {
      if (args[0] === "event" && args[1] === "conversion") {
        (args[2] as { event_callback?: () => void }).event_callback?.();
      }
    };

    assert.equal(await trackRequestSubmitted("sync-callback-request"), true);
    assert.equal(await notifyGoogleMeasurementScriptLoaded(), 0);
    assert.equal(storage.getItem(googleAdsConversionOutboxStorageKey), null);
    writeMeasurementConsent({ analytics: true, advertising: false });
  });
});

test("captured attribution never sends before analytics consent", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return new Response(null, { status: 202 });
  }) as typeof fetch;
  try {
    await withWindow(async () => {
      const sent = await recordGrowthAttributionTouch({
        landingPath: "/services/stage-1",
        source: "google",
        medium: "organic",
        campaign: null,
        term: null,
        referrerHost: "google.de",
        locale: "de-de",
      });
      assert.equal(sent, false);
      assert.equal(fetchCalls, 0);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("registration conversion requires a stable server seed and creates no pre-consent storage", async () => {
  await withWindow(async (storage) => {
    const seed = "2f37b710-4ced-4a04-8c83-3bcb0e5b1f55";
    assert.equal(await trackRegistrationCompleted(seed), false);
    assert.equal(storage.getItem("mg_registration_conversion_seed_v1"), null);

    writeMeasurementConsent({ analytics: true, advertising: false });
    assert.equal(await trackRegistrationCompleted(null), false);
    assert.equal(storage.getItem("mg_registration_conversion_seed_v1"), null);
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

test("an opaque server registration seed stays stable across browsers without being stored or exposed", async () => {
  const opaqueEventSeed = "2f37b710-4ced-4a04-8c83-3bcb0e5b1f55";
  const transactionIds: string[] = [];

  for (const device of ["desktop", "mobile"]) {
    await withWindow(async (storage) => {
      const target = globalThis.window as unknown as {
        dataLayer?: Array<ArrayLike<unknown>>;
        location: { pathname: string };
      };
      target.location.pathname = "/auth/callback";
      writeMeasurementConsent({ analytics: true, advertising: true });
      initializeGoogleMeasurement({
        googleAnalyticsMeasurementId: "G-ABC1234567",
        googleAdsId: "AW-123456789",
        registrationLabel: "Register_123",
        requestLabel: "Request_123",
        purchaseLabel: "Purchase_123",
      });
      notifyGoogleMeasurementScriptFailed();

      assert.equal(await trackRegistrationCompleted(opaqueEventSeed), true, device);
      const conversion = (target.dataLayer ?? [])
        .map((entry) => Array.from(entry))
        .find((entry) => entry[0] === "event" && entry[1] === "conversion");
      const transactionId = String(
        (conversion?.[2] as { transaction_id?: unknown } | undefined)
          ?.transaction_id ?? ""
      );
      assert.match(transactionId, /^[a-f0-9]{64}$/);
      transactionIds.push(transactionId);

      const persisted = storage.keys()
        .map((key) => `${key}:${storage.getItem(key)}`)
        .join("\n");
      assert.doesNotMatch(persisted, new RegExp(opaqueEventSeed, "i"));
      assert.doesNotMatch(persisted, /@|customer_email|user_id/i);
      assert.equal(storage.getItem("mg_registration_conversion_seed_v1"), null);
    });
  }

  assert.equal(transactionIds.length, 2);
  assert.equal(transactionIds[0], transactionIds[1]);
});

test("a failed stable-seed lookup never falls back to a second registration identity", async () => {
  await withWindow(async (storage) => {
    const target = globalThis.window as unknown as {
      dataLayer?: Array<ArrayLike<unknown>>;
      location: { pathname: string };
    };
    target.location.pathname = "/auth/callback";
    writeMeasurementConsent({ analytics: true, advertising: true });
    initializeGoogleMeasurement({
      googleAnalyticsMeasurementId: "G-ABC1234567",
      googleAdsId: "AW-123456789",
      registrationLabel: "Register_123",
      requestLabel: "Request_123",
      purchaseLabel: "Purchase_123",
    });
    notifyGoogleMeasurementScriptFailed();

    assert.equal(await trackRegistrationCompleted(null), false);
    assert.equal(storage.getItem("mg_registration_conversion_seed_v1"), null);
    assert.equal(storage.getItem(googleAdsConversionOutboxStorageKey), null);

    assert.equal(
      await trackRegistrationCompleted(
        "2f37b710-4ced-4a04-8c83-3bcb0e5b1f55"
      ),
      true
    );
    const conversions = (target.dataLayer ?? [])
      .map((entry) => Array.from(entry))
      .filter((entry) => entry[0] === "event" && entry[1] === "conversion");
    assert.equal(conversions.length, 1);
  });
});

test("verified e-mail registration recognition survives late confirmation and rejects returning logins", () => {
  const firstConfirmation = {
    created_at: "2026-08-20T08:00:00.000Z",
    email_confirmed_at: "2026-08-27T18:00:00.000Z",
    last_sign_in_at: "2026-08-27T18:00:15.000Z",
    app_metadata: { provider: "email", providers: ["email"] },
  };

  assert.equal(isVerifiedEmailRegistrationCallback({
    user: firstConfirmation,
    hasAuthCode: true,
    nextPath: "/dashboard",
  }), true);
  assert.equal(isVerifiedEmailRegistrationCallback({
    user: {
      ...firstConfirmation,
      last_sign_in_at: "2026-08-27T20:00:00.000Z",
    },
    hasAuthCode: true,
    nextPath: "/dashboard",
  }), false);
  assert.equal(isVerifiedEmailRegistrationCallback({
    user: firstConfirmation,
    hasAuthCode: false,
    nextPath: "/dashboard",
  }), false);
  assert.equal(isVerifiedEmailRegistrationCallback({
    user: firstConfirmation,
    hasAuthCode: true,
    nextPath: "/reset-password",
  }), false);
  assert.equal(isVerifiedEmailRegistrationCallback({
    user: {
      ...firstConfirmation,
      app_metadata: { provider: "google", providers: ["google"] },
    },
    hasAuthCode: true,
    nextPath: "/dashboard",
  }), false);
});

test("registration callback storage helpers fail soft when browser storage is denied", () => {
  const blockedStorage = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); },
    removeItem() { throw new Error("blocked"); },
  };

  assert.equal(readRegistrationSessionValue(blockedStorage, "provider"), null);
  assert.equal(
    writeRegistrationSessionValue(blockedStorage, "provider", "google"),
    false
  );
  assert.doesNotThrow(() =>
    removeRegistrationSessionValues(blockedStorage, ["provider", "profile"])
  );
});

test("registration handoffs survive a failed first attempt and resume each side effect exactly once", async () => {
  const storage = new MemoryStorage();
  const keys = {
    conversion: "pending-conversion",
    notification: "pending-notification",
  } as const;
  const now = Date.parse("2026-08-28T09:00:00.000Z");
  const accountBinding = "a".repeat(64);
  const stableSeed = "2f37b710-4ced-4a04-8c83-3bcb0e5b1f55";
  let conversionLookups = 0;
  let conversionDeliveries = 0;
  let notificationDeliveries = 0;

  assert.equal(
    markRegistrationHandoffsPending(
      storage,
      keys,
      "google",
      accountBinding,
      now
    ),
    true
  );
  const persisted = storage.keys()
    .map((key) => `${key}:${storage.getItem(key)}`)
    .join("\n");
  assert.doesNotMatch(
    persisted,
    /@|gclid|gbraid|wbraid|2f37b710-4ced-4a04-8c83-3bcb0e5b1f55/i
  );

  const firstAttempt = await completePendingRegistrationHandoffs({
    storage,
    keys,
    accountBinding,
    now: now + 1_000,
    onConversion: async () => {
      conversionLookups += 1;
      return false;
    },
    onNotification: async (source) => {
      assert.equal(source, "google");
      notificationDeliveries += 1;
      return true;
    },
  });
  assert.deepEqual(firstAttempt, {
    conversionCompleted: false,
    notificationCompleted: true,
  });
  assert.notEqual(storage.getItem(keys.conversion), null);
  assert.equal(storage.getItem(keys.notification), null);

  const resumedAttempt = await completePendingRegistrationHandoffs({
    storage,
    keys,
    accountBinding,
    now: now + 2_000,
    onConversion: async () => {
      conversionLookups += 1;
      assert.equal(stableSeed, "2f37b710-4ced-4a04-8c83-3bcb0e5b1f55");
      conversionDeliveries += 1;
      return true;
    },
    onNotification: async () => {
      notificationDeliveries += 1;
      return true;
    },
  });
  assert.deepEqual(resumedAttempt, {
    conversionCompleted: true,
    notificationCompleted: true,
  });
  assert.equal(storage.getItem(keys.conversion), null);
  assert.equal(storage.getItem(keys.notification), null);

  await completePendingRegistrationHandoffs({
    storage,
    keys,
    accountBinding,
    now: now + 3_000,
    onConversion: async () => {
      conversionDeliveries += 1;
      return true;
    },
    onNotification: async () => {
      notificationDeliveries += 1;
      return true;
    },
  });
  assert.equal(conversionLookups, 2);
  assert.equal(conversionDeliveries, 1);
  assert.equal(notificationDeliveries, 1);
});

test("expired or malformed registration handoffs are removed without delivery", async () => {
  const storage = new MemoryStorage();
  const keys = {
    conversion: "pending-conversion",
    notification: "pending-notification",
  } as const;
  const now = Date.parse("2026-08-28T10:00:00.000Z");
  const accountBinding = "a".repeat(64);
  storage.setItem(
    keys.conversion,
    JSON.stringify({
      createdAt: now - REGISTRATION_HANDOFF_TTL_MS - 1,
      accountBinding,
    })
  );
  storage.setItem(keys.notification, "not-json");

  assert.deepEqual(
    readPendingRegistrationHandoffs(storage, keys, accountBinding, now),
    {
    conversion: false,
    notificationSource: null,
    }
  );
  assert.equal(storage.getItem(keys.conversion), null);
  assert.equal(storage.getItem(keys.notification), null);
});

test("registration handoffs are opaque-account-bound and cannot cross an account switch", async () => {
  const storage = new MemoryStorage();
  const keys = {
    conversion: "pending-conversion",
    notification: "pending-notification",
  } as const;
  const rawFirstUserId = "11111111-1111-4111-8111-111111111111";
  const rawSecondUserId = "22222222-2222-4222-8222-222222222222";
  const firstBinding = await createRegistrationAccountBinding(rawFirstUserId);
  const secondBinding = await createRegistrationAccountBinding(rawSecondUserId);
  assert.match(firstBinding ?? "", /^[a-f0-9]{64}$/);
  assert.match(secondBinding ?? "", /^[a-f0-9]{64}$/);
  assert.notEqual(firstBinding, secondBinding);

  assert.equal(
    markRegistrationHandoffsPending(
      storage,
      keys,
      "email",
      firstBinding ?? ""
    ),
    true
  );
  const persisted = storage.keys()
    .map((key) => `${key}:${storage.getItem(key)}`)
    .join("\n");
  assert.doesNotMatch(persisted, new RegExp(rawFirstUserId, "i"));
  assert.doesNotMatch(persisted, new RegExp(rawSecondUserId, "i"));

  let conversionCalls = 0;
  let notificationCalls = 0;
  const switchedAccountResult = await completePendingRegistrationHandoffs({
    storage,
    keys,
    accountBinding: secondBinding,
    onConversion: async () => {
      conversionCalls += 1;
      return true;
    },
    onNotification: async () => {
      notificationCalls += 1;
      return true;
    },
  });
  assert.deepEqual(switchedAccountResult, {
    conversionCompleted: true,
    notificationCompleted: true,
  });
  assert.equal(conversionCalls, 0);
  assert.equal(notificationCalls, 0);
  assert.equal(storage.getItem(keys.conversion), null);
  assert.equal(storage.getItem(keys.notification), null);
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

test("delayed consent preserves the original campaign touch before the current public route", () => {
  const firstTouch = buildGrowthAttributionTouch({
    url: "https://file.mgautotech.de/de/services/stage-1?utm_source=google&utm_medium=cpc&utm_campaign=stage1_de&gclid=private-click",
    referrer: "https://www.google.de/",
    locale: "de-DE",
  });
  const currentTouch = buildGrowthAttributionTouch({
    url: "https://file.mgautotech.de/de/how-it-works",
    referrer: "https://www.google.de/",
    locale: "de-DE",
  });
  const touches = uniqueGrowthAttributionTouches(firstTouch, currentTouch, firstTouch);

  assert.equal(touches.length, 2);
  assert.equal(touches[0]?.landingPath, "/de/services/stage-1");
  assert.equal(touches[0]?.campaign, "stage1_de");
  assert.equal(touches[1]?.landingPath, "/de/how-it-works");
  assert.equal(new Set(touches.map(growthAttributionTouchKey)).size, 2);
  assert.doesNotMatch(JSON.stringify(touches), /private-click/);
});

test("campaign URL builder keeps language, destination and UTM values on an allowlist", () => {
  const german = buildGoogleAdsCampaignUrl({
    locale: "de",
    destination: "stage1",
    campaign: "stage1_de",
    creative: "rsa_01",
  });
  const english = buildGoogleAdsCampaignUrl({
    locale: "en",
    destination: "file_service",
    campaign: "file_service_us",
  });

  assert.equal(
    german,
    "https://file.mgautotech.de/de/services/stage-1?utm_source=google&utm_medium=cpc&utm_campaign=stage1_de&utm_content=rsa_01"
  );
  assert.equal(
    english,
    "https://file.mgautotech.de/file-service?utm_source=google&utm_medium=cpc&utm_campaign=file_service_us"
  );
  assert.equal(googleAdsLanguageDestinations.length, 12);
  assert.equal(buildGoogleAdsCampaignUrl({ locale: "de", destination: "stage1", campaign: "customer@example.com" }), null);
  assert.equal(buildGoogleAdsCampaignUrl({ locale: "de", destination: "stage1", campaign: "ab" }), null);
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
    assert.equal(getAdsConfigurationStatus().configurationComplete, false);
    process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL = "Purchase_123";
    const ready = getAdsConfigurationStatus();
    assert.equal(ready.configurationComplete, true);
    assert.equal(ready.personalizedAdvertising, false);
  } finally {
    for (const key of keys) {
      const value = before[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("measurement health distinguishes configuration, traffic, request and revenue evidence", () => {
  const configured = {
    analyticsMeasurement: true,
    googleAdsTag: true,
    registrationConversion: true,
    requestConversion: true,
    purchaseConversion: true,
    consentModeV2: true as const,
    personalizedAdvertising: false as const,
    configurationComplete: true,
  };

  assert.equal(buildAdsMeasurementHealth({
    configuration: configured,
    consentedVisitors: 0,
    registrations: 0,
    requests: 0,
    payingCustomers: 0,
  }).status, "awaiting_consented_traffic");
  assert.equal(buildAdsMeasurementHealth({
    configuration: configured,
    consentedVisitors: 4,
    registrations: 1,
    requests: 0,
    payingCustomers: 0,
  }).status, "traffic_observed");
  assert.equal(buildAdsMeasurementHealth({
    configuration: configured,
    consentedVisitors: 4,
    registrations: 1,
    requests: 1,
    payingCustomers: 0,
  }).status, "requests_observed");
  const revenueHealth = buildAdsMeasurementHealth({
    configuration: configured,
    consentedVisitors: 4,
    registrations: 1,
    requests: 1,
    payingCustomers: 1,
  });
  assert.equal(revenueHealth.status, "verified_revenue_observed");
  assert.equal(revenueHealth.label, "Website revenue recorded");
  assert.match(revenueHealth.detail, /does not yet confirm.*Google Ads received/i);
  assert.equal(buildAdsMeasurementHealth({
    configuration: { ...configured, analyticsMeasurement: false, configurationComplete: false },
    consentedVisitors: 4,
    registrations: 1,
    requests: 1,
    payingCustomers: 1,
  }).status, "configuration_required");
});

test("admin report exposes aggregate paid results and no configuration values", () => {
  const report = buildAdsPerformanceReport({
    generatedAt: "2026-08-06T12:00:00.000Z",
    range: "30d",
    funnel: {
      consentedVisitors: 10,
      registrations: 3,
      customersWithRequests: 2,
      firstRequestCustomers: 2,
      repeatCustomers: 0,
      orders: 2,
      completedOrders: 1,
      payingCustomers: 1,
      visitorToRegistrationRate: 0.3,
      registrationToRequestRate: 2 / 3,
      requestToRepeatRate: 0,
      completionRate: 0.5,
    },
    bySource: [performanceRow({ key: "google / cpc", label: "google / cpc", consentedVisitors: 10, orders: 2 })],
    byCampaign: [performanceRow({ key: "stage1_de", label: "stage1_de", registrations: 3, orders: 2 })],
  } as GrowthCustomerSuccessReport);

  assert.equal(report.paidSources.length, 1);
  assert.equal(report.campaigns.length, 1);
  assert.equal(report.measurementPolicy.rawClickIdsStored, false);
  assert.equal(report.measurementPolicy.customerIdentifiersExported, false);
  assert.equal(report.deliveryVerification.status, "external_verification_required");
  assert.match(report.deliveryVerification.detail, /Google Ads has not confirmed receiving/i);
  assert.equal(report.measurementHealth.status, "configuration_required");
  assert.equal(report.measurementHealth.payingCustomers, 1);
  assert.equal(report.languageDestinations.length, 12);
  assert.doesNotMatch(JSON.stringify(report), /AW-\d+|service_role|private_key|client_secret/i);
});

test("admin Ads UI separates configuration from delivery and first-party outcomes", () => {
  const client = projectFile("src", "app", "admin", "ads-performance", "AdsPerformanceClient.tsx");

  assert.match(client, /Configuration complete/);
  assert.match(client, /Google Ads delivery not verified|deliveryVerification\.label/);
  assert.match(client, /Website results/);
  assert.match(client, /of 7 configured/);
  assert.doesNotMatch(client, /Measurement ready|of 7 verified/);
});

test("verified conversion integration is ordered after business success and remains fail-soft", () => {
  const register = projectFile("src", "app", "register", "page.tsx");
  const callback = projectFile("src", "app", "auth", "callback", "page.tsx");
  const completeProfile = projectFile("src", "app", "auth", "complete-profile", "page.tsx");
  const request = projectFile("src", "app", "new-request", "page.tsx");
  const payment = projectFile("src", "app", "payment", "success", "page.tsx");
  const confirmation = projectFile("src", "app", "api", "stripe", "confirm-session", "route.ts");
  const analytics = projectFile("src", "lib", "publicAnalytics.ts");

  assert.match(register, /isAlreadyVerified[\s\S]*?markRegistrationHandoffsPending[\s\S]*?completePendingRegistrationHandoffs[\s\S]*?recordGrowthAccountCreated\(\)[\s\S]*?trackRegistrationCompleted\(conversionSeed\)/);
  assert.match(callback, /isVerifiedEmailRegistrationCallback[\s\S]*?markRegistrationHandoffsPending[\s\S]*?completePendingRegistrationHandoffs[\s\S]*?recordGrowthAccountCreated\(\)[\s\S]*?trackRegistrationCompleted\(conversionSeed\)/);
  assert.doesNotMatch(callback, /isRecentSignup|isRecentEmailConfirmation|15 \* 60 \* 1000/);
  assert.doesNotMatch(callback, /window\.sessionStorage\.(?:getItem|setItem|removeItem)/);
  assert.equal(callback.match(/exchangeCodeForSession\(/g)?.length, 1);
  assert.ok(
    callback.indexOf("await trackRegistrationCompleted(conversionSeed)") <
      callback.indexOf("await startDeviceVerification()"),
    "registration conversion must be queued before a device-verification redirect"
  );
  assert.match(completeProfile, /readPendingRegistrationHandoffs[\s\S]*?clearPendingDraft\(\)[\s\S]*?completePendingRegistrationHandoffs[\s\S]*?trackRegistrationCompleted\(conversionSeed\)/);
  assert.doesNotMatch(completeProfile, /clearPendingDraft[\s\S]{0,250}removeItem\(OAUTH_REGISTRATION_(?:CONVERSION|NOTIFICATION)/);
  assert.match(request, /if \(error\) \{[\s\S]*?return;[\s\S]*?createdOrderId \|\| growthAttemptIdRef[\s\S]*?trackRequestSubmitted\(conversionSeed\)/);
  assert.match(confirmation, /session\.payment_status !== "paid"[\s\S]*?completeStripeCreditPurchase\(session\)[\s\S]*?conversion:/);
  assert.match(payment, /if \(!response\?\.ok\)[\s\S]*?return;[\s\S]*?trackPurchaseCompleted/);
  assert.match(analytics, /process\.env\.NEXT_PUBLIC_GOOGLE_ADS_ID/);
  assert.doesNotMatch(analytics, /customer_email|vehicle_brand|storage_path|file_name|order_id/i);
});

test("the account-created event exposes only its stable opaque row UUID", () => {
  const route = projectFile("src", "app", "api", "growth", "journey", "route.ts");
  const client = projectFile("src", "lib", "growth", "client.ts");
  const server = projectFile("src", "lib", "growth", "server.ts");

  assert.match(route, /action === "account_created"[\s\S]*conversionSeed: result\.id/);
  assert.doesNotMatch(route, /conversionSeed:\s*auth\.user\.(?:id|email)/);
  assert.match(client, /conversionSeed[\s\S]*\^\[0-9a-f\]/);
  assert.match(client, /for \(let attempt = 0; attempt < 2; attempt \+= 1\)/);
  assert.match(client, /Promise\.race\(\[attempts\(\), timeout\]\)/);
  assert.match(client, /}, 3_500\)/);
  assert.match(client, /controller\?\.abort\(\)/);
  assert.match(client, /export async function recordGrowthAccountCreated\(\) \{[\s\S]*try \{[\s\S]*catch \{[\s\S]*return null/);
  assert.doesNotMatch(client, /localStorage\.setItem\([^\n]*conversionSeed/);
  assert.match(server, /ignoreDuplicates: true[\s\S]*\.eq\("event_key", key\)[\s\S]*\.eq\("user_id", input\.userId\)/);
});
