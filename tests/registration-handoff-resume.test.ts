import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  get length() { return this.values.size; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
}

class MixedDurabilityStorage extends MemoryStorage {
  private writes = 0;

  override setItem(key: string, value: string) {
    this.writes += 1;
    if (this.writes === 2) throw new Error("session storage quota reached");
    super.setItem(key, value);
  }
}

type TestWindow = EventTarget & {
  localStorage: MemoryStorage;
  sessionStorage: MemoryStorage;
  location: {
    hostname: string;
    pathname: string;
    search: string;
    replace: (destination: string) => void;
  };
  crypto: Crypto;
  dataLayer?: Array<IArguments | unknown[]>;
  gtag?: (...args: unknown[]) => void;
  __mgAutotechStableSession?: unknown;
  __mgAutotechAuthMemoryListenerReady?: boolean;
};

type TestDocument = EventTarget & { visibilityState: DocumentVisibilityState };

function testSession(userId: string) {
  return {
    access_token: `access-${userId}`,
    refresh_token: `refresh-${userId}`,
    expires_in: 3_600,
    expires_at: Math.floor(Date.now() / 1_000) + 3_600,
    token_type: "bearer",
    user: {
      id: userId,
      aud: "authenticated",
      role: "authenticated",
      email: "customer@example.invalid",
      created_at: "2026-08-28T10:00:00.000Z",
      app_metadata: {},
      user_metadata: {},
      identities: [],
    },
  };
}

async function waitUntil(predicate: () => boolean, message: string) {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => globalThis.setTimeout(resolve, 5));
  }
  assert.fail(message);
}

function countSignUps(dataLayer: Array<IArguments | unknown[]> | undefined) {
  return (dataLayer ?? []).filter(
    (entry) => entry[0] === "event" && entry[1] === "sign_up"
  ).length;
}

test("registration recovery resumes through bounded periodic, consent and account-safe flows", async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const previousFetch = globalThis.fetch;
  const previousAnalyticsId = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID;
  const previousAdsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
  const { supabase } = await import("../src/lib/supabaseClient");
  const authClient = supabase.auth as unknown as {
    onAuthStateChange: (...args: unknown[]) => {
      data: { subscription: { unsubscribe: () => void } };
    };
    stopAutoRefresh: () => void;
  };
  const originalOnAuthStateChange = authClient.onAuthStateChange;
  authClient.onAuthStateChange = () => ({
    data: { subscription: { unsubscribe: () => undefined } },
  });

  const browser = new EventTarget() as TestWindow;
  const fullDocumentReplacements: string[] = [];
  browser.localStorage = new MemoryStorage();
  browser.sessionStorage = new MemoryStorage();
  browser.location = {
    hostname: "file.mgautotech.de",
    pathname: "/register",
    search: "",
    replace: (destination) => {
      fullDocumentReplacements.push(destination);
    },
  };
  browser.crypto = globalThis.crypto;
  const documentTarget = new EventTarget() as TestDocument;
  documentTarget.visibilityState = "visible";

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: browser,
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: documentTarget,
  });
  process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID = "G-ABC1234567";
  process.env.NEXT_PUBLIC_GOOGLE_ADS_ID = "";
  browser.gtag = (...args: unknown[]) => {
    browser.dataLayer = browser.dataLayer ?? [];
    browser.dataLayer.push(args);
    (args[2] as { event_callback?: () => void } | undefined)?.event_callback?.();
  };

  try {
    const { primeStableSession } = await import("../src/lib/authGuards");
    const {
      completeRegistrationHandoffs,
      completeRegistrationHandoffsBeforeNavigation,
      startRegistrationHandoffRecovery,
      startRegistrationHandoffRecoveryForCurrentSession,
    } = await import("../src/lib/registrationHandoffClient");
    const {
      createRegistrationAccountBinding,
      markRegistrationHandoffsPending,
    } = await import("../src/lib/registrationConversion");
    const {
      analyticsConsentStorageKey,
      measurementConsentStorageKey,
      measurementConsentSessionStorageKey,
      pendingVerifiedConversionStorageKey,
      readExternalMeasurementConsentSnapshot,
      flushPendingVerifiedConversions,
      notifyGoogleMeasurementScriptLoaded,
      replaceWithPendingMeasurementCompletion,
      writeMeasurementConsent,
    } = await import("../src/lib/publicAnalytics");
    const {
      measurementCompletionDestinationStorageKey,
      measurementCompletionPath,
    } = await import("../src/lib/measurementCompletion");

    const keys = {
      conversion: "pending-conversion",
      notification: "pending-notification",
    } as const;
    const userId = "11111111-1111-4111-8111-111111111111";
    const accountBinding = await createRegistrationAccountBinding(userId);
    assert.ok(accountBinding);
    primeStableSession(testSession(userId) as never);

    let backendAvailable = false;
    let conversionSeed = "2f37b710-4ced-4a04-8c83-3bcb0e5b1f55";
    let growthRequests = 0;
    let notificationRequests = 0;
    globalThis.fetch = (async (input) => {
      const url = String(input);
      if (url.includes("/api/growth/journey")) growthRequests += 1;
      if (url.includes("/api/email/new-customer")) notificationRequests += 1;
      if (!backendAvailable) return new Response(null, { status: 503 });
      if (url.includes("/api/growth/journey")) {
        return new Response(
          JSON.stringify({ conversionSeed }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(null, { status: 204 });
    }) as typeof fetch;

    writeMeasurementConsent({ analytics: true, advertising: false });
    markRegistrationHandoffsPending(
      browser.sessionStorage,
      keys,
      "email",
      accountBinding
    );
    assert.equal(
      startRegistrationHandoffRecovery(
        { storage: browser.sessionStorage, keys, accountBinding },
        {
          retryDelaysMs: [0, 0],
          periodicRetryDelaysMs: [100],
          signalAttemptLimit: 4,
        }
      ),
      true
    );
    await waitUntil(
      () => growthRequests >= 4 && notificationRequests >= 2,
      "the bounded timer attempts did not finish"
    );
    assert.notEqual(browser.sessionStorage.getItem(keys.conversion), null);
    assert.notEqual(browser.sessionStorage.getItem(keys.notification), null);

    backendAvailable = true;
    await waitUntil(
      () =>
        browser.sessionStorage.getItem(keys.conversion) === null &&
        browser.sessionStorage.getItem(keys.notification) === null,
      "the bounded periodic retry did not clear the completed handoff"
    );
    assert.equal(countSignUps(browser.dataLayer), 0);
    assert.notEqual(
      browser.localStorage.getItem(pendingVerifiedConversionStorageKey),
      null
    );
    browser.location.pathname = "/file-service";
    await notifyGoogleMeasurementScriptLoaded();
    assert.equal(await flushPendingVerifiedConversions(), 1);
    assert.equal(countSignUps(browser.dataLayer), 1);
    browser.location.pathname = "/register";

    browser.sessionStorage.clear();
    browser.localStorage.removeItem(measurementConsentStorageKey);
    browser.localStorage.removeItem(analyticsConsentStorageKey);
    browser.sessionStorage.removeItem(measurementConsentSessionStorageKey);
    assert.equal(readExternalMeasurementConsentSnapshot().needsDecision, true);
    browser.dataLayer = [];
    growthRequests = 0;
    notificationRequests = 0;
    conversionSeed = "6e14a2b9-8f5c-4bc1-a260-8a2794146bed";
    markRegistrationHandoffsPending(
      browser.sessionStorage,
      keys,
      "email",
      accountBinding
    );

    let lateConsentBridgeCalls = 0;
    const undecided = await completeRegistrationHandoffsBeforeNavigation(
      {
        storage: browser.sessionStorage,
        keys,
        accountBinding,
      },
      {
        budgetMs: 50,
        onConversionHandoffCompleted: () => {
          lateConsentBridgeCalls += 1;
          replaceWithPendingMeasurementCompletion("/dashboard");
        },
      }
    );
    assert.equal(undecided.conversionCompleted, false);
    assert.equal(undecided.notificationCompleted, true);
    assert.notEqual(browser.sessionStorage.getItem(keys.conversion), null);
    assert.equal(browser.sessionStorage.getItem(keys.notification), null);
    assert.equal(growthRequests, 0);
    assert.equal(countSignUps(browser.dataLayer), 0);

    writeMeasurementConsent({ analytics: true, advertising: false });
    await waitUntil(
      () =>
        browser.sessionStorage.getItem(keys.conversion) === null &&
        lateConsentBridgeCalls === 1,
      "the consent-change resume did not complete the conversion"
    );
    assert.deepEqual(fullDocumentReplacements, [measurementCompletionPath]);
    assert.equal(
      browser.sessionStorage.getItem(measurementCompletionDestinationStorageKey),
      "/dashboard"
    );
    assert.equal(countSignUps(browser.dataLayer), 0);
    assert.notEqual(
      browser.localStorage.getItem(pendingVerifiedConversionStorageKey),
      null
    );
    browser.dispatchEvent(new Event("online"));
    await new Promise((resolve) => globalThis.setTimeout(resolve, 20));
    assert.equal(lateConsentBridgeCalls, 1);
    browser.location.pathname = measurementCompletionPath;
    assert.equal(await flushPendingVerifiedConversions(), 1);
    assert.equal(countSignUps(browser.dataLayer), 1);
    browser.location.pathname = "/register";
    assert.equal(countSignUps(browser.dataLayer), 1);
    fullDocumentReplacements.length = 0;
    browser.sessionStorage.removeItem(
      measurementCompletionDestinationStorageKey
    );

    browser.sessionStorage.clear();
    browser.dataLayer = [];
    growthRequests = 0;
    notificationRequests = 0;
    writeMeasurementConsent({ analytics: false, advertising: false });
    markRegistrationHandoffsPending(
      browser.sessionStorage,
      keys,
      "email",
      accountBinding
    );
    const necessaryOnly = await completeRegistrationHandoffs({
      storage: browser.sessionStorage,
      keys,
      accountBinding,
    });
    assert.equal(necessaryOnly.conversionCompleted, true);
    assert.equal(necessaryOnly.notificationCompleted, true);
    assert.equal(browser.sessionStorage.getItem(keys.conversion), null);
    assert.equal(browser.sessionStorage.getItem(keys.notification), null);
    assert.equal(growthRequests, 0);
    assert.equal(notificationRequests, 1);
    assert.equal(countSignUps(browser.dataLayer), 0);

    browser.sessionStorage.clear();
    browser.dataLayer = [];
    growthRequests = 0;
    notificationRequests = 0;
    writeMeasurementConsent({ analytics: true, advertising: false });
    conversionSeed = "3e5f7bb8-a5bd-4442-9a9c-f2ec1f3d11d6";
    markRegistrationHandoffsPending(
      browser.sessionStorage,
      keys,
      "email",
      accountBinding
    );
    const otherUserId = "22222222-2222-4222-8222-222222222222";
    primeStableSession(testSession(otherUserId) as never);
    startRegistrationHandoffRecovery(
      { storage: browser.sessionStorage, keys, accountBinding },
      {
        retryDelaysMs: [],
        periodicRetryDelaysMs: [20, 100],
        signalAttemptLimit: 4,
      }
    );
    await new Promise((resolve) => globalThis.setTimeout(resolve, 50));
    assert.notEqual(browser.sessionStorage.getItem(keys.conversion), null);
    assert.notEqual(browser.sessionStorage.getItem(keys.notification), null);
    assert.equal(growthRequests, 0);
    assert.equal(notificationRequests, 0);
    assert.equal(countSignUps(browser.dataLayer), 0);

    primeStableSession(testSession(userId) as never);
    await waitUntil(
      () =>
        browser.sessionStorage.getItem(keys.conversion) === null &&
        browser.sessionStorage.getItem(keys.notification) === null,
      "the original account did not complete its preserved handoff"
    );
    assert.equal(countSignUps(browser.dataLayer), 0);
    assert.notEqual(
      browser.localStorage.getItem(pendingVerifiedConversionStorageKey),
      null
    );
    browser.location.pathname = "/file-service";
    assert.equal(await flushPendingVerifiedConversions(), 1);
    assert.equal(countSignUps(browser.dataLayer), 1);
    browser.location.pathname = "/register";

    const {
      OAUTH_REGISTRATION_CONVERSION_ELIGIBLE_KEY,
      OAUTH_REGISTRATION_NOTIFICATION_PENDING_KEY,
    } = await import("../src/lib/registrationProfile");
    const canonicalKeys = {
      conversion: OAUTH_REGISTRATION_CONVERSION_ELIGIBLE_KEY,
      notification: OAUTH_REGISTRATION_NOTIFICATION_PENDING_KEY,
    } as const;
    browser.dataLayer = [];
    growthRequests = 0;
    notificationRequests = 0;
    conversionSeed = "8b2ba9ad-e9e3-4bc5-8336-f236c3e67e07";
    markRegistrationHandoffsPending(
      browser.sessionStorage,
      canonicalKeys,
      "google",
      accountBinding
    );
    browser.location.pathname = "/dashboard/requests/recent";
    browser.location.search = "";
    assert.equal(
      await startRegistrationHandoffRecoveryForCurrentSession({
        storage: browser.sessionStorage,
        keys: canonicalKeys,
        onConversionHandoffCompleted: () => {
          replaceWithPendingMeasurementCompletion(
            `${browser.location.pathname}${browser.location.search}`
          );
        },
      }),
      "started"
    );
    await waitUntil(
      () =>
        browser.sessionStorage.getItem(canonicalKeys.conversion) === null &&
        browser.sessionStorage.getItem(canonicalKeys.notification) === null,
      "fresh-document canonical handoff recovery did not finish"
    );
    assert.equal(growthRequests, 1);
    assert.equal(notificationRequests, 1);
    assert.equal(countSignUps(browser.dataLayer), 0);
    assert.notEqual(
      browser.localStorage.getItem(pendingVerifiedConversionStorageKey),
      null
    );
    assert.deepEqual(fullDocumentReplacements, [measurementCompletionPath]);
    assert.equal(
      browser.sessionStorage.getItem(measurementCompletionDestinationStorageKey),
      "/dashboard/requests/recent"
    );
    assert.equal(
      (browser.dataLayer ?? []).some(
        (entry) => entry[0] === "config" || entry[0] === "event"
      ),
      false,
      "the private recovery document must not configure or call Google"
    );
    browser.location.pathname = measurementCompletionPath;
    assert.equal(await flushPendingVerifiedConversions(), 1);
    assert.equal(countSignUps(browser.dataLayer), 1);

    primeStableSession(null);
  } finally {
    authClient.onAuthStateChange = originalOnAuthStateChange;
    authClient.stopAutoRefresh();
    globalThis.fetch = previousFetch;
    if (previousAnalyticsId === undefined) {
      delete process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID;
    } else {
      process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID = previousAnalyticsId;
    }
    if (previousAdsId === undefined) {
      delete process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
    } else {
      process.env.NEXT_PUBLIC_GOOGLE_ADS_ID = previousAdsId;
    }
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (previousDocument) Object.defineProperty(globalThis, "document", previousDocument);
    else Reflect.deleteProperty(globalThis, "document");
  }
});

test("a mixed persisted and memory-only registration handoff receives the full foreground budget", async () => {
  const storage = new MixedDurabilityStorage();
  const keys = {
    conversion: "mixed-pending-conversion",
    notification: "mixed-pending-notification",
  } as const;
  const accountBinding = "a".repeat(64);
  const {
    getRegistrationHandoffNavigationBudget,
    markRegistrationHandoffsPending,
    readRegistrationSessionValue,
    registrationHandoffMarkersAreDurable,
  } = await import("../src/lib/registrationConversion");
  const durableBudgetMs = 1_250;
  const memoryOnlyBudgetMs = 4_100;

  assert.equal(
    markRegistrationHandoffsPending(
      storage,
      keys,
      "email",
      accountBinding
    ),
    true
  );
  assert.notEqual(storage.getItem(keys.conversion), null);
  assert.equal(storage.getItem(keys.notification), null);
  assert.notEqual(readRegistrationSessionValue(storage, keys.notification), null);
  assert.equal(registrationHandoffMarkersAreDurable(storage, keys), false);
  assert.equal(
    getRegistrationHandoffNavigationBudget(
      storage,
      keys,
      durableBudgetMs,
      memoryOnlyBudgetMs
    ),
    memoryOnlyBudgetMs
  );

  const durableStorage = new MemoryStorage();
  markRegistrationHandoffsPending(
    durableStorage,
    keys,
    "email",
    accountBinding
  );
  assert.equal(registrationHandoffMarkersAreDurable(durableStorage, keys), true);
  assert.equal(
    getRegistrationHandoffNavigationBudget(
      durableStorage,
      keys,
      durableBudgetMs,
      memoryOnlyBudgetMs
    ),
    durableBudgetMs
  );
});

test("the root runtime reconnects canonical handoffs after a full-document navigation", () => {
  const layout = readFileSync(resolve("src/app/layout.tsx"), "utf8");
  const boundary = readFileSync(
    resolve("src/components/analytics/AccountRuntimeBoundary.tsx"),
    "utf8"
  );
  const runtime = readFileSync(
    resolve("src/components/analytics/RegistrationHandoffRecoveryRuntime.tsx"),
    "utf8"
  );
  assert.match(layout, /<AccountRuntimeBoundary \/>/);
  assert.doesNotMatch(layout, /RegistrationHandoffRecoveryRuntime/);
  assert.match(
    boundary,
    /import\("@\/components\/analytics\/RegistrationHandoffRecoveryRuntime"\)/
  );
  assert.match(runtime, /OAUTH_REGISTRATION_CONVERSION_ELIGIBLE_KEY/);
  assert.match(runtime, /OAUTH_REGISTRATION_NOTIFICATION_PENDING_KEY/);
  assert.match(runtime, /startRegistrationHandoffRecoveryForCurrentSession/);
  assert.match(runtime, /onConversionHandoffCompleted/);
  assert.match(runtime, /window\.location\.pathname\.startsWith\("\/dashboard\/"\)/);
  assert.match(runtime, /replaceWithPendingMeasurementCompletion\(destination\)/);
  assert.match(runtime, /onAuthStateChange[\s\S]*?online[\s\S]*?visibilitychange|online[\s\S]*?visibilitychange[\s\S]*?onAuthStateChange/);
  assert.match(runtime, /recoveryRediscoveryMs = 10 \* 60 \* 1_000/);
  assert.match(
    runtime,
    /result === "started"[\s\S]*?window\.setTimeout\([\s\S]*?started = false;[\s\S]*?void attempt\(\)/
  );
  assert.match(runtime, /window\.clearTimeout\(rediscoveryTimer\)/);
});
