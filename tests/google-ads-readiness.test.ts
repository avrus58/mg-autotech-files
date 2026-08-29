import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  buildGrowthAttributionTouch,
  growthAttributionTouchKey,
  growthVisitorStorageKey,
  normalizeGrowthAttributionTouch,
  selectGrowthAttributionTouchesForRoute,
  uniqueGrowthAttributionTouches,
} from "../src/lib/growth/attribution";
import type { GrowthCustomerSuccessReport, GrowthPerformanceRow } from "../src/lib/growth/types";
import {
  clearGrowthVisitorId,
  flushGrowthAttributionOutbox,
  getOrCreateGrowthVisitorId,
  growthAttributionOutboxStorageKey,
  growthAttributionRevocationStorageKey,
  recordGrowthAttributionTouch,
} from "../src/lib/growth/publicClient";
import { runBoundedGrowthEventRetry } from "../src/lib/growth/client";
import {
  claimRegistrationHandoffRecovery,
  completePendingRegistrationHandoffs,
  createRegistrationAccountBinding,
  isVerifiedEmailRegistrationCallback,
  markRegistrationHandoffsPending,
  readPendingRegistrationHandoffs,
  readRegistrationSessionValue,
  REGISTRATION_HANDOFF_TTL_MS,
  ownsRegistrationHandoffRecovery,
  removeRegistrationSessionValues,
  retryPendingRegistrationHandoffs,
  runRegistrationHandoffWithTimeout,
  writeRegistrationSessionValue,
} from "../src/lib/registrationConversion";
import {
  adsExternalLaunchGates,
  adsLandingPages,
  buildAdsMeasurementHealth,
  buildAdsPerformanceReport,
  getAdsConfigurationStatus,
} from "../src/lib/googleAds/readiness";
import {
  buildGoogleAdsCampaignUrl,
  googleAdsDestinationDefinitions,
  googleAdsLanguageDestinations,
  googleAdsUkIeAuditedSitelinkKeys,
} from "../src/lib/googleAds/campaignLinks";
import { normalizeGoogleAdsCampaignToken } from "../src/lib/googleAds/campaignTokens";
import { brandGuides, platformGuides } from "../src/lib/industry-content";
import { supportedLocales } from "../src/lib/i18nConfig";
import { publicServiceSlugs } from "../src/lib/seo";
import { serviceIntentGuideSlugs } from "../src/lib/serviceIntentGuides";
import { workshopGuideArticles } from "../src/lib/workshopGuides";
import {
  analyticsConsentStorageKey,
  clearPendingVerifiedConversions,
  clearGoogleAdsConversionOutbox,
  createPrivateConversionId,
  denyGoogleMeasurement,
  firstPartyAttributionLocalizedPublicPaths,
  firstPartyAttributionPublicPaths,
  flushPendingVerifiedConversions,
  googleAdsLinkerSettleMs,
  googleMeasurementLocalizedPublicPaths,
  googleMeasurementPublicPaths,
  googleAdsConversionOutboxStorageKey,
  initializeGoogleMeasurement,
  getPrivateDocumentNavigation,
  hasSensitiveMeasurementLocation,
  isGoogleMeasurementScriptPath,
  isGoogleMeasurementPublicPath,
  isFirstPartyAttributionPublicPath,
  isPublicAnalyticsPath,
  measurementConsentDisclosureVersion,
  measurementConsentStorageKey,
  measurementConsentSessionStorageKey,
  notifyGoogleMeasurementScriptFailed,
  notifyGoogleMeasurementScriptLoaded,
  pendingVerifiedConversionStorageKey,
  readMeasurementConsentSnapshot,
  reconcileRestoredMeasurementConsent,
  replaceWithPendingMeasurementCompletion,
  safeGoogleAdsLandingLocation,
  sanitizeGoogleMeasurementBrowserLocation,
  trackPurchaseCompleted,
  trackRegistrationCompleted,
  trackRequestSubmitted,
  writeMeasurementConsent,
} from "../src/lib/publicAnalytics";
import {
  isGoogleMeasurementPath,
  measurementCompletionDestinationStorageKey,
  measurementCompletionPath,
  replaceWithMeasurementCompletion,
  safeMeasurementCompletionDestination,
} from "../src/lib/measurementCompletion";
import { isCustomerNotificationRuntimePath } from "../src/lib/customerNotificationRuntime";
import { isAccountRuntimePath } from "../src/lib/accountRuntimeBoundary";
import {
  settleRegistrationHandoffWithinNavigationBudget,
} from "../src/lib/registrationHandoffClient";

function projectFile(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

async function waitUntil(predicate: () => boolean, timeoutMs = 250) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) assert.fail("condition was not met before timeout");
    await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
  }
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

class SelectiveFailureStorage extends MemoryStorage {
  readonly failingSetKeys = new Set<string>();
  readonly failingRemoveKeys = new Set<string>();

  override setItem(key: string, value: string) {
    if (this.failingSetKeys.has(key) || this.failingSetKeys.has("*")) {
      throw new Error(`synthetic write failure: ${key}`);
    }
    super.setItem(key, value);
  }

  override removeItem(key: string) {
    if (this.failingRemoveKeys.has(key) || this.failingRemoveKeys.has("*")) {
      throw new Error(`synthetic removal failure: ${key}`);
    }
    super.removeItem(key);
  }
}

class FullyBlockedStorage extends MemoryStorage {
  override getItem(key: string): string | null {
    void key;
    throw new Error("synthetic read failure");
  }
  override setItem(key: string, value: string): void {
    void key;
    void value;
    throw new Error("synthetic write failure");
  }
  override removeItem(key: string): void {
    void key;
    throw new Error("synthetic removal failure");
  }
}

async function withWindow<T>(
  run: (storage: MemoryStorage) => T | Promise<T>,
  input?: { localStorage?: MemoryStorage; sessionStorage?: MemoryStorage }
) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const storage = input?.localStorage ?? new MemoryStorage();
  const sessionStorage = input?.sessionStorage ?? new MemoryStorage();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: storage,
      sessionStorage,
      crypto: globalThis.crypto,
      location: {
        pathname: measurementCompletionPath,
        replace() {},
      },
    },
  });
  try {
    return await run(storage);
  } finally {
    clearPendingVerifiedConversions();
    clearGoogleAdsConversionOutbox();
    notifyGoogleMeasurementScriptFailed();
    if (descriptor) Object.defineProperty(globalThis, "window", descriptor);
    else Reflect.deleteProperty(globalThis, "window");
  }
}

type MeasurementCommandTarget = {
  dataLayer?: Array<ArrayLike<unknown> | unknown[]>;
  gtag?: (...args: unknown[]) => void;
};

function measurementCommands(target: MeasurementCommandTarget) {
  return (target.dataLayer ?? []).map((entry) => Array.from(entry));
}

async function waitForMeasurementCommands(
  target: MeasurementCommandTarget,
  predicate: (entry: unknown[]) => boolean,
  minimum = 1
) {
  const deadline = Date.now() + 500;
  while (Date.now() < deadline) {
    const matches = measurementCommands(target).filter(predicate);
    if (matches.length >= minimum) return matches;
    await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
  }
  assert.fail("measurement command was not queued before the test deadline");
}

function installAcknowledgingGtag(target: MeasurementCommandTarget) {
  target.dataLayer = target.dataLayer ?? [];
  target.gtag = (...args: unknown[]) => {
    target.dataLayer?.push(args);
    const callback = (args[2] as { event_callback?: () => void } | undefined)
      ?.event_callback;
    if (callback) queueMicrotask(callback);
  };
}

async function markGoogleMeasurementScriptReady() {
  await notifyGoogleMeasurementScriptLoaded();
  await new Promise((resolve) =>
    globalThis.setTimeout(resolve, googleAdsLinkerSettleMs + 10)
  );
}

test("Google measurement is isolated from every private form and callback document", async () => {
  for (const privatePath of [
    "/register",
    "/auth/callback",
    "/auth/complete-profile",
    "/new-request",
    "/payment/success",
    "/dashboard",
  ]) {
    assert.equal(isGoogleMeasurementScriptPath(privatePath), false, privatePath);
  }
  for (const inputHeavyPublicPath of [
    "/",
    "/en",
    "/tools",
    "/tools/torque-power-calculator",
    "/widget",
    "/en/widget",
  ]) {
    assert.equal(
      isGoogleMeasurementScriptPath(inputHeavyPublicPath),
      false,
      inputHeavyPublicPath
    );
    assert.equal(
      isGoogleMeasurementPublicPath(inputHeavyPublicPath),
      false,
      inputHeavyPublicPath
    );
    assert.equal(isPublicAnalyticsPath(inputHeavyPublicPath), true);
    assert.equal(
      safeGoogleAdsLandingLocation(
        inputHeavyPublicPath,
        "?gclid=private-click-id"
      ),
      `https://file.mgautotech.de${inputHeavyPublicPath}`
    );
  }
  assert.equal(isGoogleMeasurementScriptPath("/file-service"), true);
  assert.equal(isGoogleMeasurementScriptPath(measurementCompletionPath), true);
  assert.equal(
    hasSensitiveMeasurementLocation(
      "https://file.mgautotech.de/measurement/complete?session_id=private"
    ),
    true
  );
  assert.equal(
    getPrivateDocumentNavigation(
      "/new-request",
      "https://file.mgautotech.de/file-service"
    ),
    "https://file.mgautotech.de/new-request"
  );
  assert.equal(
    safeMeasurementCompletionDestination(
      "/new-request?intent=stage_1"
    ),
    "/new-request?intent=stage_1"
  );
  assert.equal(
    safeMeasurementCompletionDestination(
      "/payment/success?session_id=private"
    ),
    "/dashboard"
  );
  assert.equal(
    safeMeasurementCompletionDestination(
      "/new-request?intent=syntactically_valid_but_unknown"
    ),
    "/dashboard"
  );
  const verifiedCallbackDestination =
    "/auth/callback?next=%2Fdashboard%2Forders";
  assert.equal(
    safeMeasurementCompletionDestination(verifiedCallbackDestination),
    verifiedCallbackDestination
  );
  for (const unsafeCallbackDestination of [
    "/auth/callback?code=private&next=%2Fdashboard",
    "/auth/callback?next=https%3A%2F%2Fevil.example",
    "/auth/callback?next=%2Fdashboard&next=%2Fnew-request",
    "/auth/callback?next=%2Fdashboard#private",
  ]) {
    assert.equal(
      safeMeasurementCompletionDestination(unsafeCallbackDestination),
      "/dashboard",
      unsafeCallbackDestination
    );
  }

  await withWindow(async () => {
    const target = globalThis.window as unknown as {
      location: { pathname: string; replace: (destination: string) => void };
      sessionStorage: MemoryStorage;
    };
    const replacements: string[] = [];
    target.location.replace = (destination) => replacements.push(destination);

    assert.equal(
      replaceWithMeasurementCompletion(verifiedCallbackDestination),
      true
    );
    assert.equal(
      target.sessionStorage.getItem(
        measurementCompletionDestinationStorageKey
      ),
      verifiedCallbackDestination
    );
    assert.deepEqual(replacements, [measurementCompletionPath]);
  });

  await withWindow(async () => {
    const target = globalThis.window as unknown as {
      location: { pathname: string; replace: (destination: string) => void };
    };
    const replacements: string[] = [];
    target.location.replace = (destination) => replacements.push(destination);

    assert.equal(
      replaceWithMeasurementCompletion(verifiedCallbackDestination),
      false
    );
    assert.deepEqual(replacements, []);
  }, { sessionStorage: new FullyBlockedStorage() });

  await withWindow(async (storage) => {
    const target = globalThis.window as unknown as MeasurementCommandTarget & {
      location: { pathname: string; replace: (destination: string) => void };
      sessionStorage: MemoryStorage;
    };
    const replacements: string[] = [];
    target.location.pathname = "/new-request";
    target.location.replace = (destination) => replacements.push(destination);
    writeMeasurementConsent({ analytics: true, advertising: true });

    assert.equal(
      await trackRequestSubmitted("private-form-isolation-request"),
      true
    );
    assert.notEqual(storage.getItem(pendingVerifiedConversionStorageKey), null);
    assert.equal(
      measurementCommands(target).some(
        (entry) => entry[0] === "event" && entry[1] === "conversion"
      ),
      false
    );
    assert.equal(
      replaceWithPendingMeasurementCompletion("/dashboard"),
      true
    );
    assert.deepEqual(replacements, [measurementCompletionPath]);
    assert.equal(
      target.sessionStorage.getItem(
        measurementCompletionDestinationStorageKey
      ),
      "/dashboard"
    );
  });

  const analyticsComponent = projectFile(
    "src",
    "components",
    "analytics",
    "PublicAnalytics.tsx"
  );
  const completionPage = projectFile(
    "src",
    "app",
    "measurement",
    "complete",
    "page.tsx"
  );
  const completionLayout = projectFile(
    "src",
    "app",
    "measurement",
    "complete",
    "layout.tsx"
  );
  const nextConfiguration = projectFile("next.config.ts");
  const newRequestPage = projectFile("src", "app", "new-request", "page.tsx");
  const preHydrationGuard = projectFile(
    "src",
    "components",
    "analytics",
    "PaidClickPreHydrationGuard.tsx"
  );
  assert.match(
    analyticsComponent,
    /measurementReady && scriptId && googleMeasurementRouteAllowed/
  );
  assert.doesNotMatch(
    analyticsComponent,
    /measurementReady && scriptId && analyticsRouteAllowed/
  );
  assert.match(completionPage, /sanitizeSensitiveMeasurementLocation\(\)/);
  assert.match(completionPage, /googleMeasurementScriptLoadedEvent/);
  assert.match(completionPage, /await flushPendingVerifiedConversions\(\)/);
  assert.match(
    completionPage,
    /clearMeasurementCompletionDestination\(\)[\s\S]*window\.location\.replace\(destination\)/
  );
  assert.doesNotMatch(completionPage, /<form|<input/i);
  assert.match(
    completionPage,
    /const returnToDashboard =[\s\S]*?clearMeasurementCompletionDestination\(\)[\s\S]*?window\.location\.replace\("\/dashboard"\)/
  );
  assert.match(
    completionPage,
    /<button[\s\S]*?onClick=\{returnToDashboard\}[\s\S]*?Return to dashboard/
  );
  assert.match(
    completionPage,
    /<noscript>[\s\S]*?<Link[\s\S]*?href="\/dashboard"[\s\S]*?customer dashboard/
  );
  assert.equal((completionPage.match(/<Link/g) ?? []).length, 1);
  assert.doesNotMatch(completionPage, /href=\{[^}]+\}/);
  assert.match(completionLayout, /index:\s*false[\s\S]*follow:\s*false/);
  assert.match(nextConfiguration, /"\/measurement\/:path\*"/);
  assert.doesNotMatch(newRequestPage, /trackRequestStarted/);
  const inlinePathsSource = preHydrationGuard.match(
    /var paths=(\[[^;]+\]);/
  )?.[1];
  const inlineLocalizedPathsSource = preHydrationGuard.match(
    /var localizedPaths=(\[[^;]+\]);/
  )?.[1];
  assert.ok(inlinePathsSource);
  assert.ok(inlineLocalizedPathsSource);
  assert.deepEqual(
    JSON.parse(inlinePathsSource),
    [...googleMeasurementPublicPaths]
  );
  assert.deepEqual(
    JSON.parse(inlineLocalizedPathsSource),
    [...googleMeasurementLocalizedPublicPaths]
  );
  assert.doesNotMatch(preHydrationGuard, /startsWith|\.some\(function\(x\)/);
  assert.doesNotMatch(preHydrationGuard, /"\/(?:tools|widget)"/);
  assert.match(
    preHydrationGuard,
    /\^\[A-Za-z0-9_-\]\{6,200\}\$\/\.test\(v\)/
  );
});

test("Google measurement uses only real exact routes and validated dynamic slugs", () => {
  const staticPaths = [
    "/about",
    "/agb",
    "/brands",
    "/contact",
    "/datenschutz",
    "/download/windows",
    "/ecu-platforms",
    "/file-service",
    "/how-it-works",
    "/impressum",
    "/privacy",
    "/services",
    "/widerruf",
    "/workshop-guides",
  ];
  const expectedPublicPaths = [
    ...staticPaths,
    ...brandGuides.map((guide) => `/brands/${guide.slug}`),
    ...platformGuides.map((guide) => `/ecu-platforms/${guide.slug}`),
    ...publicServiceSlugs.map((slug) => `/services/${slug}`),
    ...serviceIntentGuideSlugs.map((slug) => `/services/${slug}`),
    ...workshopGuideArticles.map((article) => `/workshop-guides/${article.slug}`),
  ].sort();
  const expectedLocalizedPaths = [
    "/file-service",
    "/how-it-works",
    ...publicServiceSlugs.map((slug) => `/services/${slug}`),
  ].sort();

  assert.equal(new Set(googleMeasurementPublicPaths).size, expectedPublicPaths.length);
  assert.deepEqual([...googleMeasurementPublicPaths].sort(), expectedPublicPaths);
  assert.deepEqual(
    [...googleMeasurementLocalizedPublicPaths].sort(),
    expectedLocalizedPaths
  );

  for (const path of googleMeasurementPublicPaths) {
    assert.equal(isGoogleMeasurementPublicPath(path), true, path);
    assert.equal(isGoogleMeasurementPublicPath(`${path}/`), true, `${path}/`);
  }
  for (const locale of supportedLocales.map(({ code }) => code)) {
    for (const path of googleMeasurementLocalizedPublicPaths) {
      assert.equal(
        isGoogleMeasurementPublicPath(`/${locale}${path}`),
        true,
        `/${locale}${path}`
      );
    }
  }

  for (const path of [
    "/about/alice_smith_customer",
    "/brands/not-a-brand",
    "/brands/bmw/private-account",
    "/download",
    "/download/private",
    "/ecu-platforms/bosch-edc17/private-account",
    "/services/alice_smith_customer",
    "/services/alice%40example.test",
    "/services/customer%2Faccount",
    "/services/stage-1/private-account",
    "/workshop-guides/not-a-guide",
    "/de/about",
    "/de/brands/bmw",
    "/de/services",
    "/de/services/stage-2",
    "/de/workshop-guides/ecu-file-service-online",
    "/zz/services/stage-1",
  ]) {
    assert.equal(isGoogleMeasurementPublicPath(path), false, path);
    assert.equal(isGoogleMeasurementScriptPath(path), false, path);
    assert.doesNotMatch(
      safeGoogleAdsLandingLocation(path, "?gclid=ValidClick_123"),
      /gclid=/,
      path
    );
  }
});

test("first-party attribution persists only exact real public route contracts", () => {
  const exactFirstPartyOnlyPaths = [
    "/tools",
    "/tools/autotuner-log-analyzer",
    "/tools/ecu-read-method-advisor",
    "/tools/file-readiness-check",
    "/tools/request-brief-builder",
    "/tools/torque-power-calculator",
    "/widget",
  ];
  const expectedPublicPaths = [
    "/",
    ...googleMeasurementPublicPaths,
    ...exactFirstPartyOnlyPaths,
  ];
  const expectedLocalizedPaths = [
    "/",
    ...googleMeasurementLocalizedPublicPaths,
  ];

  assert.equal(
    new Set(firstPartyAttributionPublicPaths).size,
    expectedPublicPaths.length
  );
  assert.deepEqual(
    [...firstPartyAttributionPublicPaths].sort(),
    [...expectedPublicPaths].sort()
  );
  assert.deepEqual(
    [...firstPartyAttributionLocalizedPublicPaths].sort(),
    [...expectedLocalizedPaths].sort()
  );

  for (const path of firstPartyAttributionPublicPaths) {
    assert.equal(isFirstPartyAttributionPublicPath(path), true, path);
    assert.ok(
      buildGrowthAttributionTouch({
        url: `https://file.mgautotech.de${path}?utm_source=google&utm_medium=cpc&utm_campaign=file_service_uk_ie_en`,
        locale: "en",
      }),
      path
    );
  }
  for (const locale of supportedLocales.map(({ code }) => code)) {
    for (const path of firstPartyAttributionLocalizedPublicPaths) {
      const localizedPath = path === "/" ? `/${locale}` : `/${locale}${path}`;
      assert.equal(
        isFirstPartyAttributionPublicPath(localizedPath),
        true,
        localizedPath
      );
    }
  }

  for (const path of [
    "/about/alice_smith_customer",
    "/brands/not-a-brand",
    "/download",
    "/services/alice_smith_customer",
    "/services/alice%40example.test",
    "/services/stage-1/private-account",
    "/tools/private-account",
    "/tools/unknown-calculator",
    "/widget/private-account",
    "/workshop-guides/not-a-guide",
    "/de/about",
    "/de/services/stage-2",
    "/de/tools/torque-power-calculator",
    "/new-request",
    "/payment/success",
    "/register",
  ]) {
    assert.equal(isFirstPartyAttributionPublicPath(path), false, path);
    assert.equal(
      buildGrowthAttributionTouch({
        url: `https://file.mgautotech.de${path}?utm_source=google&utm_medium=cpc&utm_campaign=file_service_uk_ie_en`,
        locale: "en",
      }),
      null,
      path
    );
    assert.equal(
      normalizeGrowthAttributionTouch({
        landingPath: path,
        source: "google",
        medium: "cpc",
        campaign: "file_service_uk_ie_en",
        term: null,
        referrerHost: null,
        locale: "en",
      }),
      null,
      path
    );
  }
});

test("the conversion bridge excludes customer and account runtimes", () => {
  assert.equal(isGoogleMeasurementPath("/measurement/complete"), true);
  assert.equal(isGoogleMeasurementPath("/measurement/complete/"), true);
  assert.equal(isGoogleMeasurementPath("/dashboard"), false);

  const notificationsRuntime = projectFile(
    "src",
    "components",
    "CustomerNotificationsRuntime.tsx"
  );
  const identityRuntime = projectFile(
    "src",
    "components",
    "analytics",
    "GrowthIdentityLinkRuntime.tsx"
  );
  const registrationRuntime = projectFile(
    "src",
    "components",
    "analytics",
    "RegistrationHandoffRecoveryRuntime.tsx"
  );
  const accountRuntimeBoundary = projectFile(
    "src",
    "components",
    "analytics",
    "AccountRuntimeBoundary.tsx"
  );
  const rootLayout = projectFile("src", "app", "layout.tsx");

  for (const [pathname, allowed] of [
    ["/dashboard", true],
    ["/dashboard/orders", true],
    ["/new-request", true],
    ["/payment/success", true],
    ["/", false],
    ["/file-service", false],
    ["/services/stage-1", false],
    ["/measurement/complete", false],
    ["/admin", false],
    ["/embed/widget", false],
  ] as const) {
    assert.equal(isCustomerNotificationRuntimePath(pathname), allowed, pathname);
  }
  assert.match(
    notificationsRuntime,
    /if \(!isCustomerNotificationRuntimePath\(pathname\)\) return null;/
  );
  assert.doesNotMatch(
    notificationsRuntime,
    /requestIdleCallback|setTimeout|useEffect|useState/
  );
  for (const [pathname, allowed] of [
    ["/auth/callback", true],
    ["/dashboard", true],
    ["/login", true],
    ["/new-request", true],
    ["/payment/success", true],
    ["/register", true],
    ["/reset-password", true],
    ["/", false],
    ["/file-service", false],
    ["/services/stage-1", false],
    ["/tools/torque-power-calculator", false],
    ["/widget", false],
    ["/measurement/complete", false],
    ["/admin", false],
  ] as const) {
    assert.equal(isAccountRuntimePath(pathname), allowed, pathname);
  }
  assert.match(rootLayout, /<AccountRuntimeBoundary \/>/);
  assert.doesNotMatch(
    rootLayout,
    /GrowthIdentityLinkRuntime|RegistrationHandoffRecoveryRuntime/
  );
  assert.match(accountRuntimeBoundary, /dynamic\([\s\S]*?ssr: false/);
  assert.equal(
    (accountRuntimeBoundary.match(/ssr: false/g) ?? []).length,
    2
  );
  assert.match(
    accountRuntimeBoundary,
    /if \(!isAccountRuntimePath\(pathname\)\) return null;/
  );
  for (const runtime of [identityRuntime, registrationRuntime]) {
    assert.match(
      runtime,
      /accountRuntimeAllowed = isAccountRuntimePath\(pathname\)[\s\S]*?useEffect\(\(\) => \{[\s\S]*?if \(!accountRuntimeAllowed\) return;/
    );
  }
});

function performanceRow(input: Partial<GrowthPerformanceRow> & Pick<GrowthPerformanceRow, "key" | "label">): GrowthPerformanceRow {
  return {
    consentedVisitors: 0,
    registrations: 0,
    returningCustomers: 0,
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
    assert.equal(snapshot.preferences.analytics, false);
    assert.equal(snapshot.preferences.advertising, false);
  });
});

test("a pre-disclosure optional grant is disabled until the user chooses again", async () => {
  await withWindow((storage) => {
    storage.setItem(measurementConsentStorageKey, JSON.stringify({
      analytics: true,
      advertising: true,
      version: "consent-mode-v2",
      updatedAt: "2026-08-28T10:00:00.000Z",
    }));

    const snapshot = readMeasurementConsentSnapshot();
    assert.equal(snapshot.source, "previous_granted");
    assert.equal(snapshot.needsDecision, true);
    assert.equal(snapshot.preferences.analytics, false);
    assert.equal(snapshot.preferences.advertising, false);
  });
});

test("a pre-disclosure necessary-only choice stays denied without a new prompt", async () => {
  await withWindow((storage) => {
    storage.setItem(measurementConsentStorageKey, JSON.stringify({
      analytics: false,
      advertising: false,
      version: "consent-mode-v2",
      updatedAt: "2026-08-28T10:00:00.000Z",
    }));

    const snapshot = readMeasurementConsentSnapshot();
    assert.equal(snapshot.source, "previous_denied");
    assert.equal(snapshot.needsDecision, false);
    assert.equal(snapshot.preferences.analytics, false);
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
    const stored = JSON.parse(storage.getItem(measurementConsentStorageKey) ?? "null");
    assert.equal(stored.version, "consent-mode-v2");
    assert.equal(stored.disclosureVersion, measurementConsentDisclosureVersion);
  });
});

test("a failed consent overwrite cannot resurrect an old grant after a fresh document", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const localStorage = new SelectiveFailureStorage();
  const sessionStorage = new SelectiveFailureStorage();
  const oldGrant = JSON.stringify({
    analytics: true,
    advertising: true,
    version: "consent-mode-v2",
    updatedAt: "2026-08-27T10:00:00.000Z",
  });
  localStorage.setItem(measurementConsentStorageKey, oldGrant);
  localStorage.setItem(analyticsConsentStorageKey, "granted");
  sessionStorage.setItem(measurementConsentSessionStorageKey, oldGrant);
  localStorage.failingSetKeys.add("*");
  sessionStorage.failingSetKeys.add("*");

  try {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage,
        sessionStorage,
        crypto: globalThis.crypto,
        location: { pathname: "/new-request" },
      },
    });
    writeMeasurementConsent({ analytics: false, advertising: false });
    const currentDocument = readMeasurementConsentSnapshot();
    assert.equal(currentDocument.preferences.analytics, false);
    assert.equal(currentDocument.preferences.advertising, false);
    assert.equal(localStorage.getItem(measurementConsentStorageKey), null);
    assert.equal(localStorage.getItem(analyticsConsentStorageKey), null);
    assert.equal(sessionStorage.getItem(measurementConsentSessionStorageKey), null);

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage,
        sessionStorage,
        crypto: globalThis.crypto,
        location: { pathname: "/dashboard" },
      },
    });
    const freshDocument = readMeasurementConsentSnapshot();
    assert.equal(freshDocument.preferences.analytics, false);
    assert.equal(freshDocument.preferences.advertising, false);
    assert.equal(freshDocument.needsDecision, true);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "window", descriptor);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("a legacy mirror failure preserves the authoritative v2 revocation", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const localStorage = new SelectiveFailureStorage();
  const sessionStorage = new MemoryStorage();
  localStorage.failingSetKeys.add(analyticsConsentStorageKey);
  try {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage,
        sessionStorage,
        crypto: globalThis.crypto,
        location: { pathname: "/new-request" },
      },
    });
    writeMeasurementConsent({ analytics: false, advertising: false });
    assert.match(
      localStorage.getItem(measurementConsentStorageKey) ?? "",
      /consent-mode-v2/
    );
    assert.equal(localStorage.getItem(analyticsConsentStorageKey), null);
    const snapshot = readMeasurementConsentSnapshot();
    assert.equal(snapshot.needsDecision, false);
    assert.equal(snapshot.preferences.analytics, false);
    assert.equal(snapshot.preferences.advertising, false);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "window", descriptor);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("consent withdrawal fails closed when Storage property access is blocked", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const restrictedWindow = {
    crypto: globalThis.crypto,
    location: { pathname: "/file-service" },
    get localStorage(): Storage {
      throw new DOMException("Storage access is blocked", "SecurityError");
    },
    get sessionStorage(): Storage {
      throw new DOMException("Storage access is blocked", "SecurityError");
    },
  };

  try {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: restrictedWindow,
    });
    assert.doesNotThrow(() => {
      writeMeasurementConsent({ analytics: false, advertising: false });
    });
    const snapshot = readMeasurementConsentSnapshot();
    assert.equal(snapshot.needsDecision, false);
    assert.equal(snapshot.preferences.analytics, false);
    assert.equal(snapshot.preferences.advertising, false);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "window", descriptor);
    else Reflect.deleteProperty(globalThis, "window");
  }
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

test("Google Ads conversions stay durable until script load and dedupe after handoff callback", async () => {
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

    assert.equal(await trackRequestSubmitted(privateSeed), false);
    const persisted = storage.getItem(googleAdsConversionOutboxStorageKey) ?? "";
    assert.match(persisted, /[a-f0-9]{64}/);
    assert.doesNotMatch(persisted, new RegExp(privateSeed));

    const target = globalThis.window as unknown as {
      dataLayer?: Array<ArrayLike<unknown>>;
    };
    assert.equal(
      measurementCommands(target).some(
        (entry) => entry[0] === "event" && entry[1] === "conversion"
      ),
      false
    );
    installAcknowledgingGtag(target);
    await markGoogleMeasurementScriptReady();
    assert.equal(await flushPendingVerifiedConversions(), 1);
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
    assert.equal(storage.getItem(googleAdsConversionOutboxStorageKey), null);

    const beforeRepeat = commands.filter(
      (entry) => entry[0] === "event" && entry[1] === "conversion"
    ).length;
    assert.equal(await trackRequestSubmitted(privateSeed), true);
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
    assert.equal(await trackRequestSubmitted("pending-private-request"), false);
    assert.notEqual(storage.getItem(googleAdsConversionOutboxStorageKey), null);

    denyGoogleMeasurement();
    assert.notEqual(storage.getItem(googleAdsConversionOutboxStorageKey), null);

    writeMeasurementConsent({ analytics: true, advertising: false });
    assert.equal(storage.getItem(googleAdsConversionOutboxStorageKey), null);
  });
});

test("queued conversions survive private documents and dispatch only on the completion bridge", async () => {
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
    target.location.pathname = "/dashboard";
    assert.equal(await trackRequestSubmitted("route-paused-request"), true);
    denyGoogleMeasurement();
    assert.notEqual(storage.getItem(pendingVerifiedConversionStorageKey), null);
    assert.equal(
      measurementCommands(target).some(
        (entry) => entry[0] === "event" && entry[1] === "conversion"
      ),
      false
    );

    target.location.pathname = measurementCompletionPath;
    initializeGoogleMeasurement({
      googleAnalyticsMeasurementId: "G-ABC1234567",
      googleAdsId: "AW-123456789",
      registrationLabel: "Register_123",
      requestLabel: "Request_123",
      purchaseLabel: "Purchase_123",
    });
    installAcknowledgingGtag(target);
    await markGoogleMeasurementScriptReady();
    assert.equal(await flushPendingVerifiedConversions(), 1);
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
    installAcknowledgingGtag(target);
    await markGoogleMeasurementScriptReady();

    const callbackQuerySeed = "callback-code-must-never-reach-google";
    const paymentQuerySeed = "cs_live_payment-seed-must-never-reach-google";
    assert.equal(
      await trackRegistrationCompleted(
        "2f37b710-4ced-4a04-8c83-3bcb0e5b1f55"
      ),
      true
    );
    assert.equal(await trackRequestSubmitted("canonical-request-seed"), true);
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
    await markGoogleMeasurementScriptReady();
    const delivery = trackRequestSubmitted("late-callback-request");
    await waitForMeasurementCommands(
      target,
      (entry) => entry[0] === "event" && entry[1] === "conversion"
    );
    assert.equal(await notifyGoogleMeasurementScriptLoaded(), 0);
    const conversion = (target.dataLayer ?? [])
      .map((entry) => Array.from(entry))
      .find((entry) => entry[0] === "event" && entry[1] === "conversion");
    const params = conversion?.[2] as { event_callback?: () => void } | undefined;
    assert.equal(typeof params?.event_callback, "function");

    writeMeasurementConsent({ analytics: true, advertising: false });
    params?.event_callback?.();
    assert.equal(await delivery, false);

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

    assert.equal(await trackRequestSubmitted("throwing-gtag-request"), false);
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

    await markGoogleMeasurementScriptReady();
    assert.equal(await trackRequestSubmitted("sync-callback-request"), true);
    assert.equal(await notifyGoogleMeasurementScriptLoaded(), 0);
    assert.equal(storage.getItem(googleAdsConversionOutboxStorageKey), null);
    writeMeasurementConsent({ analytics: true, advertising: false });
  });
});

test("Ads tag receives only the bounded current click signal while GA stays canonical", async () => {
  await withWindow(() => {
    const target = globalThis.window as unknown as {
      location: { pathname: string; search?: string };
      dataLayer?: Array<ArrayLike<unknown>>;
    };
    target.location.pathname = "/services/stage-1";
    target.location.search =
      "?gclid=fresh-current-click&utm_source=google&email=private%40example.test#ignored";

    assert.equal(
      safeGoogleAdsLandingLocation(target.location.pathname, target.location.search),
      "https://file.mgautotech.de/services/stage-1?gclid=fresh-current-click"
    );
    assert.equal(
      safeGoogleAdsLandingLocation(
        target.location.pathname,
        `?gclid=${"x".repeat(201)}&wbraid=bounded-braid`
      ),
      "https://file.mgautotech.de/services/stage-1?wbraid=bounded-braid"
    );
    assert.equal(
      safeGoogleAdsLandingLocation(
        target.location.pathname,
        "?gclid=customer%40example.test&dclid=opaque%2Funsafe&wbraid=Valid_braid-123&gbraid=ValidBraid456"
      ),
      "https://file.mgautotech.de/services/stage-1?wbraid=Valid_braid-123&gbraid=ValidBraid456"
    );
    for (const [key, value] of [
      ["gclid", "ValidClick_123"],
      ["dclid", "ValidDclid-456"],
      ["wbraid", "ValidWbraid_789"],
      ["gbraid", "ValidGbraid-012"],
    ] as const) {
      assert.equal(
        safeGoogleAdsLandingLocation(
          target.location.pathname,
          `?${key}=${value}`
        ),
        `https://file.mgautotech.de/services/stage-1?${key}=${value}`,
        key
      );
    }

    writeMeasurementConsent({ analytics: true, advertising: true });
    initializeGoogleMeasurement({
      googleAnalyticsMeasurementId: "G-ABC1234567",
      googleAdsId: "AW-123456789",
      registrationLabel: "Register_123",
      requestLabel: "Request_123",
      purchaseLabel: "Purchase_123",
    });

    const configs = measurementCommands(target).filter(
      (entry) => entry[0] === "config"
    );
    const gaConfig = configs.find((entry) => entry[1] === "G-ABC1234567");
    const adsConfig = configs.find((entry) => entry[1] === "AW-123456789");
    assert.equal(
      (gaConfig?.[2] as { page_location?: string }).page_location,
      "https://file.mgautotech.de/services/stage-1"
    );
    assert.equal(
      (adsConfig?.[2] as { page_location?: string }).page_location,
      "https://file.mgautotech.de/services/stage-1?gclid=fresh-current-click"
    );
    assert.doesNotMatch(JSON.stringify(configs), /private%40example|utm_source|#ignored/);
  });
});

test("the browser URL is minimized before external Google code can load", async () => {
  await withWindow(() => {
    const target = globalThis.window as unknown as {
      history: {
        state: unknown;
        replaceState: (state: unknown, title: string, destination: string) => void;
      };
      location: {
        hash: string;
        hostname: string;
        pathname: string;
        search: string;
      };
    };
    const replacements: string[] = [];
    target.location.hostname = "file.mgautotech.de";
    target.location.pathname = "/services/stage-1";
    target.location.search =
      "?utm_source=google&utm_medium=cpc&utm_campaign=file_service_en&email=private%40example.test&gclid=ValidClick_123";
    target.location.hash = "#private-fragment";
    const capturedTouch = buildGrowthAttributionTouch({
      url: `https://file.mgautotech.de${target.location.pathname}${target.location.search}${target.location.hash}`,
      locale: "en",
    });
    target.history = {
      state: { preserved: true },
      replaceState: (_state, _title, destination) => {
        replacements.push(destination);
        const parsed = new URL(destination, "https://file.mgautotech.de");
        target.location.pathname = parsed.pathname;
        target.location.search = parsed.search;
        target.location.hash = parsed.hash;
      },
    };

    assert.equal(
      sanitizeGoogleMeasurementBrowserLocation({ advertising: true }),
      true
    );
    assert.deepEqual(replacements, [
      "/services/stage-1?gclid=ValidClick_123",
    ]);
    assert.equal(capturedTouch?.campaign, "file_service_en");
    assert.doesNotMatch(replacements[0] ?? "", /email|utm_|private/i);

    target.location.search =
      "?gclid=ValidClick_456&utm_campaign=file_service_en";
    target.location.hash = "#another-private-fragment";
    assert.equal(
      sanitizeGoogleMeasurementBrowserLocation({ advertising: false }),
      true
    );
    assert.equal(replacements.at(-1), "/services/stage-1");

    target.location.search =
      "?gclid=ValidClick_789&email=blocked%40example.test";
    target.history.replaceState = () => {
      throw new Error("synthetic history failure");
    };
    assert.equal(
      sanitizeGoogleMeasurementBrowserLocation({ advertising: true }),
      false
    );
    assert.match(target.location.search, /email=/);
  });

  const component = projectFile(
    "src",
    "components",
    "analytics",
    "PublicAnalytics.tsx"
  );
  const initialTouchCapture = component.indexOf(
    "const initialTouch = captureGrowthAttributionTouch()"
  );
  const locationBoundary = component.indexOf(
    "sanitizeGoogleMeasurementBrowserLocation({"
  );
  assert.ok(initialTouchCapture >= 0);
  assert.ok(locationBoundary > initialTouchCapture);
  assert.match(
    component,
    /const initialized = initializeGoogleMeasurement\(configuration\);[\s\S]*?initialized &&[\s\S]*?sanitizeGoogleMeasurementBrowserLocation/
  );
  assert.match(
    component,
    /measurementReady && scriptId && googleMeasurementRouteAllowed[\s\S]*?<Script/
  );
});

test("a provider callback at 1.9 seconds still acknowledges before the navigation budget", async () => {
  await withWindow(async () => {
    const target = globalThis.window as unknown as MeasurementCommandTarget;
    writeMeasurementConsent({ analytics: true, advertising: false });
    initializeGoogleMeasurement({
      googleAnalyticsMeasurementId: "G-ABC1234567",
      googleAdsId: "",
      registrationLabel: "",
      requestLabel: "",
      purchaseLabel: "",
    });
    const delivery = trackRequestSubmitted("late-valid-ga4-callback");
    const events = await waitForMeasurementCommands(
      target,
      (entry) => entry[0] === "event" && entry[1] === "generate_lead"
    );
    const callback = (events[0]?.[2] as { event_callback?: () => void })
      .event_callback;
    assert.equal(typeof callback, "function");
    globalThis.setTimeout(() => callback?.(), 1_900);
    assert.equal(await delivery, true);
  });
});

test("a missed GA4 callback never queues a duplicate event in the same document", async () => {
  await withWindow(async (storage) => {
    const target = globalThis.window as unknown as MeasurementCommandTarget;
    writeMeasurementConsent({ analytics: true, advertising: false });
    initializeGoogleMeasurement({
      googleAnalyticsMeasurementId: "G-ABC1234567",
      googleAdsId: "",
      registrationLabel: "",
      requestLabel: "",
      purchaseLabel: "",
    });
    await markGoogleMeasurementScriptReady();
    const delivery = trackRequestSubmitted("ga4-callback-timeout-no-duplicate");
    const events = await waitForMeasurementCommands(
      target,
      (entry) => entry[0] === "event" && entry[1] === "generate_lead"
    );
    assert.equal(await delivery, false);
    assert.notEqual(storage.getItem(pendingVerifiedConversionStorageKey), null);
    assert.equal(await flushPendingVerifiedConversions(), 0);
    assert.equal(
      measurementCommands(target).filter(
        (entry) => entry[0] === "event" && entry[1] === "generate_lead"
      ).length,
      1
    );
    (events[0]?.[2] as { event_callback?: () => void }).event_callback?.();
    assert.equal(await flushPendingVerifiedConversions(), 1);
    assert.equal(storage.getItem(pendingVerifiedConversionStorageKey), null);
  });
});

test("a consented but unconfigured provider remains pending and recovers after valid configuration", async () => {
  await withWindow(async (storage) => {
    const target = globalThis.window as unknown as MeasurementCommandTarget;
    writeMeasurementConsent({ analytics: true, advertising: true });
    initializeGoogleMeasurement({
      googleAnalyticsMeasurementId: "G-ABC1234567",
      googleAdsId: "AW-123456789",
      registrationLabel: "Register_123",
      requestLabel: "",
      purchaseLabel: "Purchase_123",
    });
    installAcknowledgingGtag(target);
    await markGoogleMeasurementScriptReady();
    assert.equal(await trackRequestSubmitted("missing-label-recovery"), false);
    assert.notEqual(storage.getItem(pendingVerifiedConversionStorageKey), null);
    assert.equal(storage.getItem(googleAdsConversionOutboxStorageKey), null);

    initializeGoogleMeasurement({
      googleAnalyticsMeasurementId: "G-ABC1234567",
      googleAdsId: "AW-123456789",
      registrationLabel: "Register_123",
      requestLabel: "Request_123",
      purchaseLabel: "Purchase_123",
    });
    await markGoogleMeasurementScriptReady();
    assert.equal(await flushPendingVerifiedConversions(), 1);
    assert.equal(storage.getItem(pendingVerifiedConversionStorageKey), null);
  });
});

test("partial consent changes cannot resurrect or duplicate a completed provider delivery", async () => {
  await withWindow(async (storage) => {
    const target = globalThis.window as unknown as MeasurementCommandTarget;
    const analyticsEvents: string[] = [];
    const adsEvents: string[] = [];
    writeMeasurementConsent({ analytics: true, advertising: true });
    initializeGoogleMeasurement({
      googleAnalyticsMeasurementId: "G-ABC1234567",
      googleAdsId: "AW-123456789",
      registrationLabel: "Register_123",
      requestLabel: "",
      purchaseLabel: "Purchase_123",
    });
    target.gtag = (...args: unknown[]) => {
      target.dataLayer = target.dataLayer ?? [];
      target.dataLayer.push(args);
      if (args[0] !== "event") return;
      if (args[1] === "conversion") adsEvents.push(String(args[1]));
      else analyticsEvents.push(String(args[1]));
      (args[2] as { event_callback?: () => void } | undefined)?.event_callback?.();
    };
    await markGoogleMeasurementScriptReady();

    assert.equal(await trackRequestSubmitted("partial-provider-request"), false);
    assert.deepEqual(analyticsEvents, ["generate_lead"]);
    assert.deepEqual(adsEvents, []);
    assert.match(
      storage.getItem(pendingVerifiedConversionStorageKey) ?? "",
      /"analyticsState":"complete"/
    );

    writeMeasurementConsent({ analytics: false, advertising: true });
    writeMeasurementConsent({ analytics: true, advertising: true });
    initializeGoogleMeasurement({
      googleAnalyticsMeasurementId: "G-ABC1234567",
      googleAdsId: "AW-123456789",
      registrationLabel: "Register_123",
      requestLabel: "Request_123",
      purchaseLabel: "Purchase_123",
    });
    await markGoogleMeasurementScriptReady();
    assert.equal(await flushPendingVerifiedConversions(), 1);
    assert.deepEqual(analyticsEvents, ["generate_lead"]);
    assert.deepEqual(adsEvents, ["conversion"]);
    assert.equal(storage.getItem(pendingVerifiedConversionStorageKey), null);
  });
});

test("an in-flight provider result cannot overwrite a partial consent retirement", async () => {
  await withWindow(async (storage) => {
    const target = globalThis.window as unknown as MeasurementCommandTarget;
    let analyticsCallback: (() => void) | undefined;
    let advertisingCallback: (() => void) | undefined;
    writeMeasurementConsent({ analytics: true, advertising: true });
    initializeGoogleMeasurement({
      googleAnalyticsMeasurementId: "G-ABC1234567",
      googleAdsId: "AW-123456789",
      registrationLabel: "Register_123",
      requestLabel: "Request_123",
      purchaseLabel: "Purchase_123",
    });
    target.gtag = (...args: unknown[]) => {
      target.dataLayer = target.dataLayer ?? [];
      target.dataLayer.push(args);
      if (args[0] !== "event") return;
      const callback = (args[2] as { event_callback?: () => void } | undefined)
        ?.event_callback;
      if (args[1] === "conversion") advertisingCallback = callback;
      else if (args[1] === "generate_lead") analyticsCallback = callback;
    };
    await markGoogleMeasurementScriptReady();

    const delivery = trackRequestSubmitted("in-flight-partial-revocation");
    await waitForMeasurementCommands(
      target,
      (entry) => entry[0] === "event" && entry[1] === "generate_lead"
    );
    await waitForMeasurementCommands(
      target,
      (entry) => entry[0] === "event" && entry[1] === "conversion"
    );
    writeMeasurementConsent({ analytics: false, advertising: true });
    analyticsCallback?.();
    advertisingCallback?.();
    assert.equal(
      await delivery,
      false,
      "a stale callback cannot claim a provider state that consent retirement already removed"
    );
    assert.equal(storage.getItem(pendingVerifiedConversionStorageKey), null);

    writeMeasurementConsent({ analytics: true, advertising: true });
    assert.equal(await flushPendingVerifiedConversions(), 0);
    assert.equal(
      measurementCommands(target).filter(
        (entry) => entry[0] === "event" && entry[1] === "generate_lead"
      ).length,
      1
    );
  });
});

test("an in-flight result cannot recreate a queue after Necessary-only revocation", async () => {
  await withWindow(async (storage) => {
    const target = globalThis.window as unknown as MeasurementCommandTarget;
    const callbacks: Array<() => void> = [];
    writeMeasurementConsent({ analytics: true, advertising: true });
    initializeGoogleMeasurement({
      googleAnalyticsMeasurementId: "G-ABC1234567",
      googleAdsId: "AW-123456789",
      registrationLabel: "Register_123",
      requestLabel: "Request_123",
      purchaseLabel: "Purchase_123",
    });
    target.gtag = (...args: unknown[]) => {
      target.dataLayer = target.dataLayer ?? [];
      target.dataLayer.push(args);
      if (args[0] !== "event") return;
      const callback = (args[2] as { event_callback?: () => void } | undefined)
        ?.event_callback;
      if (callback) callbacks.push(callback);
    };
    await markGoogleMeasurementScriptReady();

    const delivery = trackRequestSubmitted("in-flight-necessary-only");
    await waitForMeasurementCommands(
      target,
      (entry) => entry[0] === "event" && entry[1] === "conversion"
    );
    writeMeasurementConsent({ analytics: false, advertising: false });
    for (const callback of callbacks) callback();
    assert.equal(await delivery, false);
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    assert.equal(storage.getItem(pendingVerifiedConversionStorageKey), null);

    writeMeasurementConsent({ analytics: true, advertising: true });
    assert.equal(await flushPendingVerifiedConversions(), 0);
  });
});

test("the private conversion bridge falls back to session storage when local storage is blocked", async () => {
  const localStorage = new SelectiveFailureStorage();
  localStorage.failingSetKeys.add(pendingVerifiedConversionStorageKey);
  await withWindow(async () => {
    const target = globalThis.window as unknown as {
      location: { pathname: string; replace: (destination: string) => void };
      sessionStorage: MemoryStorage;
    };
    const replacements: string[] = [];
    target.location.pathname = "/dashboard";
    target.location.replace = (destination) => replacements.push(destination);
    writeMeasurementConsent({ analytics: true, advertising: false });

    assert.equal(
      await trackRegistrationCompleted("2f37b710-4ced-4a04-8c83-3bcb0e5b1f58"),
      true
    );
    assert.equal(localStorage.getItem(pendingVerifiedConversionStorageKey), null);
    assert.notEqual(
      target.sessionStorage.getItem(pendingVerifiedConversionStorageKey),
      null
    );
    assert.equal(replaceWithPendingMeasurementCompletion("/dashboard"), true);
    assert.deepEqual(replacements, [measurementCompletionPath]);
  }, { localStorage });
});

test("a bfcache-restored document reconciles a newer consent revocation before reuse", async () => {
  await withWindow((storage) => {
    const target = globalThis.window as unknown as MeasurementCommandTarget & {
      sessionStorage: MemoryStorage;
    };
    const granted = writeMeasurementConsent({ analytics: true, advertising: true });
    assert.ok(granted);
    const revoked = {
      ...granted,
      analytics: false,
      advertising: false,
      disclosureVersion: measurementConsentDisclosureVersion,
      updatedAt: new Date(
        new Date(granted.updatedAt).getTime() + 1_000
      ).toISOString(),
    };
    storage.setItem(measurementConsentStorageKey, JSON.stringify(revoked));
    target.sessionStorage.setItem(
      measurementConsentSessionStorageKey,
      JSON.stringify(revoked)
    );

    const snapshot = reconcileRestoredMeasurementConsent();
    assert.equal(snapshot.preferences.analytics, false);
    assert.equal(snapshot.preferences.advertising, false);
    const consentUpdates = measurementCommands(target).filter(
      (entry) => entry[0] === "consent" && entry[1] === "update"
    );
    const latest = consentUpdates.at(-1)?.[2] as {
      analytics_storage?: string;
      ad_storage?: string;
    };
    assert.equal(latest.analytics_storage, "denied");
    assert.equal(latest.ad_storage, "denied");

    const analyticsComponent = projectFile(
      "src",
      "components",
      "analytics",
      "PublicAnalytics.tsx"
    );
    assert.match(analyticsComponent, /addEventListener\("pageshow"/);
    assert.ok(
      (analyticsComponent.match(
        /replaceGoogleMeasurementDocumentAfterConsentWithdrawal/g
      )?.length ?? 0) >= 5,
      "same-tab, paid-click, cross-tab, and restored-document withdrawals must replace an already configured Google document"
    );
    assert.match(
      analyticsComponent,
      /synchronizeCrossTabConsent[\s\S]*?const previous = lastAppliedPreferencesRef\.current;[\s\S]*?applyExternalMeasurementConsentChange\(event\.newValue\)[\s\S]*?replaceGoogleMeasurementDocumentAfterConsentWithdrawal\([\s\S]*?previous/,
      "the storage event must compare against the document-local grant, not storage that has already changed"
    );
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

test("a shared browser rotates attribution identity when authenticated accounts change", async () => {
  await withWindow(async (storage) => {
    writeMeasurementConsent({ analytics: true, advertising: false });
    const firstVisitor = getOrCreateGrowthVisitorId();
    assert.match(firstVisitor ?? "", /^[0-9a-f-]{36}$/i);
    storage.setItem(growthAttributionOutboxStorageKey, "synthetic-pending-touch");
    const { resetGrowthAttributionForAuthIdentityTransition } = await import(
      "../src/lib/authGuards"
    );
    assert.equal(
      resetGrowthAttributionForAuthIdentityTransition("account-a", "account-b"),
      true
    );
    assert.equal(storage.getItem(growthVisitorStorageKey), null);
    assert.equal(storage.getItem(growthAttributionOutboxStorageKey), null);

    const secondVisitor = getOrCreateGrowthVisitorId();
    assert.match(secondVisitor ?? "", /^[0-9a-f-]{36}$/i);
    assert.notEqual(secondVisitor, firstVisitor);
    assert.equal(
      resetGrowthAttributionForAuthIdentityTransition(null, "account-b"),
      false
    );
    assert.equal(storage.getItem(growthVisitorStorageKey), secondVisitor);
  });
});

test("registration recovery queues only an anonymous hash on a private route and flushes later", async () => {
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
    process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL = "Purchase_123";

    await withWindow(async (storage) => {
      const target = globalThis.window as unknown as {
        location: { pathname: string };
        dataLayer?: Array<ArrayLike<unknown>>;
        gtag?: (...args: unknown[]) => void;
      };
      const serverSeed = "2f37b710-4ced-4a04-8c83-3bcb0e5b1f55";
      target.location.pathname = "/dashboard";
      writeMeasurementConsent({ analytics: true, advertising: false });

      assert.equal(await trackRegistrationCompleted(serverSeed), true);
      const privateCommands = (target.dataLayer ?? []).map((entry) => Array.from(entry));
      assert.deepEqual(
        privateCommands.map((command) => command.slice(0, 2)),
        [["consent", "default"], ["consent", "update"]],
        "a private route may queue consent state but must not configure or call Google"
      );
      assert.equal(
        privateCommands.some((command) => command[0] === "config" || command[0] === "event"),
        false
      );
      const persisted = storage.getItem(pendingVerifiedConversionStorageKey) ?? "";
      assert.match(persisted, /"name":"registration"/);
      assert.match(persisted, /[a-f0-9]{64}/);
      assert.doesNotMatch(persisted, new RegExp(serverSeed));

      const events: string[] = [];
      target.gtag = (...args: unknown[]) => {
        if (args[0] === "event" && typeof args[1] === "string") events.push(args[1]);
        (args[2] as { event_callback?: () => void } | undefined)?.event_callback?.();
      };
      target.location.pathname = measurementCompletionPath;
      initializeGoogleMeasurement({
        googleAnalyticsMeasurementId: "G-ABC1234567",
        googleAdsId: "AW-123456789",
        registrationLabel: "Register_123",
        requestLabel: "Request_123",
        purchaseLabel: "Purchase_123",
      });
      await markGoogleMeasurementScriptReady();
      assert.equal(await flushPendingVerifiedConversions(), 1);
      assert.deepEqual(events, ["sign_up"]);
      assert.equal(storage.getItem(pendingVerifiedConversionStorageKey), null);
      assert.equal(await flushPendingVerifiedConversions(), 0);
    });
  } finally {
    for (const key of keys) {
      const value = before[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("revoking consent deletes a private-route registration queue before regrant", async () => {
  await withWindow(async (storage) => {
    const target = globalThis.window as unknown as {
      location: { pathname: string };
      gtag?: (...args: unknown[]) => void;
    };
    target.location.pathname = "/dashboard";
    writeMeasurementConsent({ analytics: true, advertising: false });
    assert.equal(
      await trackRegistrationCompleted("2f37b710-4ced-4a04-8c83-3bcb0e5b1f56"),
      true
    );
    assert.notEqual(storage.getItem(pendingVerifiedConversionStorageKey), null);

    writeMeasurementConsent({ analytics: false, advertising: false });
    assert.equal(storage.getItem(pendingVerifiedConversionStorageKey), null);
    const events: string[] = [];
    target.gtag = (...args: unknown[]) => {
      if (args[0] === "event" && typeof args[1] === "string") events.push(args[1]);
      (args[2] as { event_callback?: () => void } | undefined)?.event_callback?.();
    };
    writeMeasurementConsent({ analytics: true, advertising: false });
    target.location.pathname = "/";
    assert.equal(await flushPendingVerifiedConversions(), 0);
    assert.deepEqual(events, []);
  });
});

test("verified request and paid purchase wait in memory for a consent decision and dispatch once after grant", async () => {
  await withWindow(async () => {
    const target = globalThis.window as unknown as {
      gtag?: (...args: unknown[]) => void;
    };
    const events: string[] = [];
    initializeGoogleMeasurement({
      googleAnalyticsMeasurementId: "G-ABC1234567",
      googleAdsId: "AW-123456789",
      registrationLabel: "Register_123",
      requestLabel: "Request_123",
      purchaseLabel: "Purchase_123",
    });
    target.gtag = (...args: unknown[]) => {
      if (args[0] === "event" && typeof args[1] === "string") events.push(args[1]);
      (args[2] as { event_callback?: () => void } | undefined)?.event_callback?.();
    };

    assert.equal(await trackRequestSubmitted("verified-request-before-consent"), false);
    assert.equal(await trackPurchaseCompleted({
      anonymousPaymentSeed: "verified-payment-before-consent",
      value: 125,
      currency: "EUR",
    }), false);
    assert.deepEqual(events, []);

    writeMeasurementConsent({ analytics: true, advertising: false });
    await markGoogleMeasurementScriptReady();
    assert.equal(await flushPendingVerifiedConversions(), 2);
    assert.deepEqual(events, ["generate_lead", "purchase"]);

    writeMeasurementConsent({ analytics: true, advertising: false });
    assert.equal(await flushPendingVerifiedConversions(), 0);
    assert.deepEqual(events, ["generate_lead", "purchase"]);
  });
});

test("accept-all durably promotes undecided private request and purchase conversions for the completion bridge", async () => {
  await withWindow(async (storage) => {
    const target = globalThis.window as unknown as MeasurementCommandTarget & {
      location: { pathname: string };
    };
    const configuration = {
      googleAnalyticsMeasurementId: "G-ABC1234567",
      googleAdsId: "AW-123456789",
      registrationLabel: "Register_123",
      requestLabel: "Request_123",
      purchaseLabel: "Purchase_123",
    };

    // The private document may hold a verified conversion while the customer is
    // still deciding. Google remains completely absent from that document.
    target.location.pathname = measurementCompletionPath;
    initializeGoogleMeasurement(configuration);
    target.location.pathname = "/new-request";
    assert.equal(await trackRequestSubmitted("accept-all-private-request"), false);
    assert.equal(await trackPurchaseCompleted({
      anonymousPaymentSeed: "accept-all-private-purchase",
      value: 125,
      currency: "EUR",
    }), false);
    assert.equal(storage.getItem(pendingVerifiedConversionStorageKey), null);

    writeMeasurementConsent({ analytics: true, advertising: true });
    const promoted = JSON.parse(
      storage.getItem(pendingVerifiedConversionStorageKey) ?? "[]"
    ) as Array<{
      analyticsState?: unknown;
      advertisingState?: unknown;
    }>;
    assert.equal(promoted.length, 2);
    assert.ok(promoted.every((entry) =>
      entry.analyticsState === "pending" && entry.advertisingState === "pending"
    ));
    assert.deepEqual(measurementCommands(target).filter((entry) => entry[0] === "event"), []);

    // A fresh dedicated completion document configures the provider and drains
    // both consented destinations exactly once.
    target.location.pathname = measurementCompletionPath;
    installAcknowledgingGtag(target);
    assert.equal(initializeGoogleMeasurement(configuration), true);
    await markGoogleMeasurementScriptReady();
    assert.equal(await flushPendingVerifiedConversions(), 2);

    const events = measurementCommands(target).filter((entry) => entry[0] === "event");
    assert.equal(events.filter((entry) => entry[1] === "generate_lead").length, 1);
    assert.equal(events.filter((entry) => entry[1] === "purchase").length, 1);
    const ads = events.filter((entry) => entry[1] === "conversion");
    assert.equal(ads.length, 2);
    assert.deepEqual(
      ads.map((entry) => (entry[2] as { send_to?: unknown }).send_to).sort(),
      ["AW-123456789/Purchase_123", "AW-123456789/Request_123"]
    );
    assert.equal(storage.getItem(pendingVerifiedConversionStorageKey), null);

    assert.equal(await flushPendingVerifiedConversions(), 0);
    assert.equal(
      measurementCommands(target).filter((entry) => entry[0] === "event").length,
      events.length
    );
  });
});

test("Necessary-only explicitly discards an undecided verified conversion", async () => {
  await withWindow(async () => {
    const target = globalThis.window as unknown as {
      gtag?: (...args: unknown[]) => void;
    };
    const events: string[] = [];
    initializeGoogleMeasurement({
      googleAnalyticsMeasurementId: "G-ABC1234567",
      googleAdsId: "AW-123456789",
      registrationLabel: "Register_123",
      requestLabel: "Request_123",
      purchaseLabel: "Purchase_123",
    });
    target.gtag = (...args: unknown[]) => {
      if (args[0] === "event" && typeof args[1] === "string") events.push(args[1]);
    };

    assert.equal(await trackRequestSubmitted("discarded-request-before-consent"), false);
    writeMeasurementConsent({ analytics: false, advertising: false });
    writeMeasurementConsent({ analytics: true, advertising: false });
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(events, []);
  });
});

test("captured attribution requires an explicit persistence acknowledgement", async () => {
  const originalFetch = globalThis.fetch;
  const touch = {
    landingPath: "/services/stage-1",
    source: "google",
    medium: "cpc",
    campaign: "file_service_en",
    term: null,
    referrerHost: "google.de",
    locale: "de-de",
  };

  try {
    await withWindow(async () => {
      writeMeasurementConsent({ analytics: true, advertising: false });

      globalThis.fetch = (async () => new Response(null, { status: 202 })) as typeof fetch;
      assert.equal(await recordGrowthAttributionTouch(touch), false);

      globalThis.fetch = (async () => new Response(
        JSON.stringify({ accepted: false }),
        { status: 202, headers: { "Content-Type": "application/json" } }
      )) as typeof fetch;
      assert.equal(await recordGrowthAttributionTouch(touch), false);

      globalThis.fetch = (async () => new Response(
        JSON.stringify({ accepted: false }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      )) as typeof fetch;
      assert.equal(await recordGrowthAttributionTouch(touch), false);

      globalThis.fetch = (async () => new Response(
        JSON.stringify({ accepted: true }),
        { status: 202, headers: { "Content-Type": "application/json" } }
      )) as typeof fetch;
      assert.equal(await recordGrowthAttributionTouch(touch), true);

      globalThis.fetch = (async () => {
        throw new TypeError("synthetic network failure");
      }) as typeof fetch;
      assert.equal(await recordGrowthAttributionTouch(touch), false);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("captured attribution times out fail-soft and permits a later retry when fetch never settles", async () => {
  const originalFetch = globalThis.fetch;
  const touch = {
    landingPath: "/services/stage-1",
    source: "google",
    medium: "cpc",
    campaign: "file_service_en",
    term: null,
    referrerHost: "google.de",
    locale: "de-de",
  };
  let firstSignal: AbortSignal | null = null;
  let fetchCalls = 0;

  try {
    await withWindow(async () => {
      writeMeasurementConsent({ analytics: true, advertising: false });
      globalThis.fetch = (async (_input, init) => {
        fetchCalls += 1;
        firstSignal = init?.signal instanceof AbortSignal ? init.signal : null;
        return await new Promise<Response>(() => undefined);
      }) as typeof fetch;

      assert.equal(
        await recordGrowthAttributionTouch(touch, { timeoutMs: 15 }),
        false
      );
      assert.equal(firstSignal?.aborted, true);

      globalThis.fetch = (async () => {
        fetchCalls += 1;
        return new Response(
          JSON.stringify({ accepted: true }),
          { status: 202, headers: { "Content-Type": "application/json" } }
        );
      }) as typeof fetch;

      assert.equal(await recordGrowthAttributionTouch(touch), true);
      assert.equal(fetchCalls, 2);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a lost attribution ACK reuses one durable delivery receipt on retry", async () => {
  const originalFetch = globalThis.fetch;
  const touch = {
    landingPath: "/services/stage-1",
    source: "google",
    medium: "cpc",
    campaign: "file_service_de",
    term: null,
    referrerHost: "google.co.uk",
    locale: "en-gb",
  };
  const bodies: Array<Record<string, unknown>> = [];
  try {
    await withWindow(async (storage) => {
      writeMeasurementConsent({ analytics: true, advertising: false });
      globalThis.fetch = (async (_input, init) => {
        bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        return {
          ok: true,
          json: () => new Promise<unknown>(() => undefined),
        } as Response;
      }) as typeof fetch;
      assert.equal(
        await recordGrowthAttributionTouch(touch, { timeoutMs: 15 }),
        false
      );
      const pending = JSON.parse(
        storage.getItem(growthAttributionOutboxStorageKey) ?? "[]"
      ) as Array<{ version?: unknown; deliveryId?: unknown }>;
      assert.equal(pending[0]?.version, 2);
      assert.match(String(pending[0]?.deliveryId ?? ""), /^[0-9a-f-]{36}$/i);

      globalThis.fetch = (async (_input, init) => {
        bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        return new Response(JSON.stringify({ accepted: true }), {
          status: 202,
          headers: { "Content-Type": "application/json" },
        });
      }) as typeof fetch;
      assert.equal(await recordGrowthAttributionTouch(touch), true);
      assert.equal(bodies.length, 2);
      assert.equal(bodies[0]?.deliveryId, bodies[1]?.deliveryId);
      assert.equal(storage.getItem(growthAttributionOutboxStorageKey), null);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("consented attribution survives navigation in a sanitized bounded outbox and clears on ACK or withdrawal", async () => {
  const originalFetch = globalThis.fetch;
  const privateClickId = "raw-click-id-must-not-persist";
  const touch = {
    landingPath: "/services/stage-1",
    source: "google",
    medium: "cpc",
    campaign: "file_service_uk_ie_en",
    term: null,
    referrerHost: "google.co.uk",
    locale: "en-gb",
    gclid: privateClickId,
    rawUrl: `https://file.mgautotech.de/services/stage-1?gclid=${privateClickId}`,
  };

  try {
    await withWindow(async (storage) => {
      writeMeasurementConsent({ analytics: true, advertising: false });
      globalThis.fetch = (async () => new Response(
        JSON.stringify({ accepted: false }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      )) as typeof fetch;
      assert.equal(await recordGrowthAttributionTouch(touch), false);

      const persisted = storage.getItem(growthAttributionOutboxStorageKey) ?? "";
      assert.match(persisted, /file_service_uk_ie_en/);
      assert.doesNotMatch(persisted, /gclid|rawUrl|raw-click-id-must-not-persist/i);

      globalThis.fetch = (async () => new Response(
        JSON.stringify({ accepted: true }),
        { status: 202, headers: { "Content-Type": "application/json" } }
      )) as typeof fetch;
      assert.deepEqual(await flushGrowthAttributionOutbox(), [
        growthAttributionTouchKey(touch),
      ]);
      assert.equal(storage.getItem(growthAttributionOutboxStorageKey), null);
      assert.deepEqual(await flushGrowthAttributionOutbox(), []);

      globalThis.fetch = (async () => new Response(
        JSON.stringify({ accepted: false }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      )) as typeof fetch;
      assert.equal(await recordGrowthAttributionTouch(touch), false);
      assert.notEqual(storage.getItem(growthAttributionOutboxStorageKey), null);
      clearGrowthVisitorId();
      assert.equal(storage.getItem(growthAttributionOutboxStorageKey), null);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("concurrent route and outbox attribution delivery share one server ACK", async () => {
  const originalFetch = globalThis.fetch;
  const touch = {
    landingPath: "/services/stage-1",
    source: "google",
    medium: "cpc",
    campaign: "stage1_en",
    term: null,
    referrerHost: "google.co.uk",
    locale: "en-gb",
  };
  let fetchCalls = 0;
  let resolveFetch!: (response: Response) => void;

  try {
    await withWindow(async (storage) => {
      writeMeasurementConsent({ analytics: true, advertising: false });
      globalThis.fetch = (async () => {
        fetchCalls += 1;
        return await new Promise<Response>((resolve) => { resolveFetch = resolve; });
      }) as typeof fetch;

      const first = recordGrowthAttributionTouch(touch);
      const second = recordGrowthAttributionTouch(touch);
      await Promise.resolve();
      await Promise.resolve();
      assert.equal(fetchCalls, 1);
      resolveFetch(new Response(
        JSON.stringify({ accepted: true }),
        { status: 202, headers: { "Content-Type": "application/json" } }
      ));
      assert.deepEqual(await Promise.all([first, second]), [true, true]);

      globalThis.fetch = (async () => {
        fetchCalls += 1;
        return new Response(
          JSON.stringify({ accepted: false }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        );
      }) as typeof fetch;
      assert.equal(await recordGrowthAttributionTouch(touch), false);
      assert.notEqual(storage.getItem(growthAttributionOutboxStorageKey), null);

      globalThis.fetch = (async () => {
        fetchCalls += 1;
        return await new Promise<Response>((resolve) => { resolveFetch = resolve; });
      }) as typeof fetch;
      const flush = flushGrowthAttributionOutbox();
      const routeRetry = recordGrowthAttributionTouch(touch);
      await Promise.resolve();
      await Promise.resolve();
      assert.equal(fetchCalls, 3, "flush and route retry must share the third request");
      resolveFetch(new Response(
        JSON.stringify({ accepted: true }),
        { status: 202, headers: { "Content-Type": "application/json" } }
      ));
      assert.deepEqual(await flush, [growthAttributionTouchKey(touch)]);
      assert.equal(await routeRetry, true);
      assert.equal(storage.getItem(growthAttributionOutboxStorageKey), null);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a sequential outbox recovery receipt suppresses the same current touch", async () => {
  const originalFetch = globalThis.fetch;
  const touch = {
    landingPath: "/services/stage-1",
    source: "google",
    medium: "cpc",
    campaign: "stage1_de",
    term: null,
    referrerHost: "google.co.uk",
    locale: "en-gb",
  };
  let fetchCalls = 0;

  try {
    await withWindow(async () => {
      writeMeasurementConsent({ analytics: true, advertising: false });
      globalThis.fetch = (async () => {
        fetchCalls += 1;
        return new Response(JSON.stringify({ accepted: false }), { status: 503 });
      }) as typeof fetch;
      assert.equal(await recordGrowthAttributionTouch(touch), false);

      fetchCalls = 0;
      globalThis.fetch = (async () => {
        fetchCalls += 1;
        return new Response(JSON.stringify({ accepted: true }), { status: 202 });
      }) as typeof fetch;
      const recoveredKeys = new Set(await flushGrowthAttributionOutbox());
      if (!recoveredKeys.has(growthAttributionTouchKey(touch))) {
        await recordGrowthAttributionTouch(touch);
      }

      assert.equal(fetchCalls, 1);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("revocation epoch prevents a failed in-flight touch from reappearing after regrant", async () => {
  const originalFetch = globalThis.fetch;
  const touch = {
    landingPath: "/services/stage-1",
    source: "google",
    medium: "cpc",
    campaign: "stage2_en",
    term: null,
    referrerHost: "google.co.uk",
    locale: "en-gb",
  };
  let resolveFetch!: (response: Response) => void;

  try {
    await withWindow(async (storage) => {
      writeMeasurementConsent({ analytics: true, advertising: false });
      globalThis.fetch = (async () => await new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      })) as typeof fetch;

      const pending = recordGrowthAttributionTouch(touch);
      await Promise.resolve();
      await Promise.resolve();
      writeMeasurementConsent({ analytics: false, advertising: false });
      clearGrowthVisitorId();
      writeMeasurementConsent({ analytics: true, advertising: false });
      resolveFetch(new Response(JSON.stringify({ accepted: false }), { status: 503 }));

      assert.equal(await pending, false);
      assert.equal(storage.getItem(growthAttributionOutboxStorageKey), null);
      assert.deepEqual(await flushGrowthAttributionOutbox(), []);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("growth revocation isolates storage removals and never reuses a visitor whose removal failed", async () => {
  const storage = new SelectiveFailureStorage();
  await withWindow(async () => {
    writeMeasurementConsent({ analytics: true, advertising: false });
    const revokedVisitorId = getOrCreateGrowthVisitorId();
    assert.match(revokedVisitorId ?? "", /^[0-9a-f-]{36}$/i);
    storage.setItem(growthAttributionOutboxStorageKey, "revoked-outbox");
    storage.failingRemoveKeys.add(growthVisitorStorageKey);
    storage.failingSetKeys.add(growthVisitorStorageKey);

    writeMeasurementConsent({ analytics: false, advertising: false });
    clearGrowthVisitorId();

    assert.equal(storage.getItem(growthVisitorStorageKey), revokedVisitorId);
    assert.equal(
      storage.getItem(growthAttributionOutboxStorageKey),
      null,
      "an independent outbox removal must still run after visitor removal fails"
    );

    writeMeasurementConsent({ analytics: true, advertising: false });
    const freshVisitorId = getOrCreateGrowthVisitorId();
    assert.match(freshVisitorId ?? "", /^[0-9a-f-]{36}$/i);
    assert.notEqual(freshVisitorId, revokedVisitorId);
    assert.equal(storage.getItem(growthVisitorStorageKey), revokedVisitorId);
  }, { localStorage: storage });
});

test("a failed outbox removal cannot transmit a revoked touch after analytics regrant", async () => {
  const originalFetch = globalThis.fetch;
  const storage = new SelectiveFailureStorage();
  const revokedTouch = {
    landingPath: "/services/stage-1",
    source: "google",
    medium: "cpc",
    campaign: "stage2_de",
    term: null,
    referrerHost: "google.de",
    locale: "de-de",
  };
  const freshTouch = {
    ...revokedTouch,
    campaign: "stage2_fr",
  };
  const delivered: Array<Record<string, unknown>> = [];

  try {
    await withWindow(async () => {
      writeMeasurementConsent({ analytics: true, advertising: false });
      const revokedVisitorId = getOrCreateGrowthVisitorId();
      globalThis.fetch = (async () => new Response(
        JSON.stringify({ accepted: false }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      )) as typeof fetch;
      assert.equal(await recordGrowthAttributionTouch(revokedTouch), false);
      const revokedOutbox = storage.getItem(growthAttributionOutboxStorageKey);
      assert.match(revokedOutbox ?? "", /stage2_de/);

      storage.failingRemoveKeys.add(growthAttributionOutboxStorageKey);
      storage.failingSetKeys.add(growthAttributionOutboxStorageKey);
      writeMeasurementConsent({ analytics: false, advertising: false });
      clearGrowthVisitorId();

      assert.equal(
        storage.getItem(growthVisitorStorageKey),
        null,
        "visitor removal must still run when outbox removal fails"
      );
      assert.equal(storage.getItem(growthAttributionOutboxStorageKey), revokedOutbox);

      writeMeasurementConsent({ analytics: true, advertising: false });
      globalThis.fetch = (async (_input, init) => {
        delivered.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        return new Response(JSON.stringify({ accepted: true }), {
          status: 202,
          headers: { "Content-Type": "application/json" },
        });
      }) as typeof fetch;

      assert.deepEqual(await flushGrowthAttributionOutbox(), []);
      assert.equal(delivered.length, 0);
      const freshVisitorId = getOrCreateGrowthVisitorId();
      assert.notEqual(freshVisitorId, revokedVisitorId);
      assert.equal(await recordGrowthAttributionTouch(freshTouch), true);
      assert.equal(delivered.length, 1);
      assert.equal(delivered[0]?.campaign, "stage2_fr");
      assert.equal(delivered[0]?.visitorId, freshVisitorId);
      assert.notEqual(delivered[0]?.visitorId, revokedVisitorId);
    }, { localStorage: storage });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a local growth revocation barrier survives a hard reload and fresh session", async () => {
  const originalFetch = globalThis.fetch;
  const localStorage = new SelectiveFailureStorage();
  const revokedSession = new MemoryStorage();
  const freshSession = new MemoryStorage();
  const revokedTouch = {
    landingPath: "/services/stage-1",
    source: "google",
    medium: "cpc",
    campaign: "tcu_en",
    term: null,
    referrerHost: "google.de",
    locale: "de-de",
  };
  let freshDocumentDeliveries = 0;

  try {
    await withWindow(async () => {
      writeMeasurementConsent({ analytics: true, advertising: false });
      assert.match(getOrCreateGrowthVisitorId() ?? "", /^[0-9a-f-]{36}$/i);
      globalThis.fetch = (async () => new Response(
        JSON.stringify({ accepted: false }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      )) as typeof fetch;
      assert.equal(await recordGrowthAttributionTouch(revokedTouch), false);
      assert.match(
        localStorage.getItem(growthAttributionOutboxStorageKey) ?? "",
        /tcu_en/
      );

      localStorage.failingRemoveKeys.add(growthVisitorStorageKey);
      localStorage.failingRemoveKeys.add(growthAttributionOutboxStorageKey);
      localStorage.failingSetKeys.add(growthVisitorStorageKey);
      localStorage.failingSetKeys.add(growthAttributionOutboxStorageKey);
      writeMeasurementConsent({ analytics: false, advertising: false });
      clearGrowthVisitorId();

      assert.notEqual(
        localStorage.getItem(growthAttributionRevocationStorageKey),
        null
      );
      assert.match(
        localStorage.getItem(growthAttributionOutboxStorageKey) ?? "",
        /tcu_en/
      );
    }, { localStorage, sessionStorage: revokedSession });

    await withWindow(async () => {
      writeMeasurementConsent({ analytics: true, advertising: false });
      globalThis.fetch = (async () => {
        freshDocumentDeliveries += 1;
        return new Response(JSON.stringify({ accepted: true }), { status: 202 });
      }) as typeof fetch;

      assert.deepEqual(await flushGrowthAttributionOutbox(), []);
      assert.equal(freshDocumentDeliveries, 0);
      assert.notEqual(
        localStorage.getItem(growthAttributionRevocationStorageKey),
        null,
        "the durable local barrier must protect a new session from stale local data"
      );
    }, { localStorage, sessionStorage: freshSession });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("growth attribution fails closed when both durable revocation stores are blocked", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  try {
    await withWindow(async () => {
      writeMeasurementConsent({ analytics: true, advertising: false });
      globalThis.fetch = (async () => {
        fetchCalls += 1;
        return new Response(JSON.stringify({ accepted: true }), { status: 202 });
      }) as typeof fetch;

      assert.equal(getOrCreateGrowthVisitorId(), null);
      assert.equal(await recordGrowthAttributionTouch({
        landingPath: "/services/stage-1",
        source: "google",
        medium: "cpc",
        campaign: "ecu_file_check_de",
        term: null,
        referrerHost: "google.de",
        locale: "de-de",
      }), false);
      assert.equal(fetchCalls, 0);
    }, {
      localStorage: new FullyBlockedStorage(),
      sessionStorage: new FullyBlockedStorage(),
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("PublicAnalytics applies recovered touch receipts before current-route delivery", () => {
  const source = readFileSync(
    resolve(process.cwd(), "src", "components", "analytics", "PublicAnalytics.tsx"),
    "utf8"
  );
  const recovery = source.indexOf("const recoveredTouchKeys = await flushGrowthAttributionOutbox");
  const receipt = source.indexOf("sentAttributionTouchesRef.current.add(key)", recovery);
  const currentTouch = source.indexOf(
    "const currentTouch = attributionPublicRoute",
    recovery
  );
  assert.ok(recovery >= 0);
  assert.ok(receipt > recovery);
  assert.ok(currentTouch > receipt);
});

test("expired or malformed attribution outbox entries are discarded without delivery", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  try {
    await withWindow(async (storage) => {
      writeMeasurementConsent({ analytics: true, advertising: false });
      storage.setItem(growthAttributionOutboxStorageKey, JSON.stringify([
        {
          version: 1,
          touch: {
            landingPath: "/services/stage-1",
            source: "google",
            medium: "cpc",
            campaign: "tcu_de",
            term: null,
            referrerHost: "google.de",
            locale: "de-de",
          },
          createdAt: Date.now() - 31 * 60 * 1000,
        },
        { version: 1, touch: { gclid: "private" }, createdAt: Date.now() },
      ]));
      globalThis.fetch = (async () => {
        fetchCalls += 1;
        return new Response(JSON.stringify({ accepted: true }), { status: 202 });
      }) as typeof fetch;

      assert.deepEqual(await flushGrowthAttributionOutbox(), []);
      assert.equal(fetchCalls, 0);
      assert.equal(storage.getItem(growthAttributionOutboxStorageKey), null);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("retries never extend the sanitized attribution outbox TTL", async () => {
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  const startedAt = 2_000_000_000_000;
  let now = startedAt;
  let fetchCalls = 0;
  Date.now = () => now;
  try {
    await withWindow(async (storage) => {
      writeMeasurementConsent({ analytics: true, advertising: false });
      globalThis.fetch = (async () => {
        fetchCalls += 1;
        return new Response(
          JSON.stringify({ accepted: false }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        );
      }) as typeof fetch;
      const touch = {
        landingPath: "/services/stage-1",
        source: "google",
        medium: "cpc",
        campaign: "tcu_de",
        term: null,
        referrerHost: "google.de",
        locale: "de-de",
      };

      assert.equal(await recordGrowthAttributionTouch(touch), false);
      const firstCreatedAt = JSON.parse(
        storage.getItem(growthAttributionOutboxStorageKey) ?? "[]"
      )[0]?.createdAt;
      assert.equal(firstCreatedAt, startedAt);

      now = startedAt + 29 * 60 * 1000;
      assert.equal(await recordGrowthAttributionTouch(touch), false);
      const retriedCreatedAt = JSON.parse(
        storage.getItem(growthAttributionOutboxStorageKey) ?? "[]"
      )[0]?.createdAt;
      assert.equal(retriedCreatedAt, startedAt);

      now = startedAt + 31 * 60 * 1000;
      assert.deepEqual(await flushGrowthAttributionOutbox(), []);
      assert.equal(storage.getItem(growthAttributionOutboxStorageKey), null);
      assert.equal(fetchCalls, 2);
    });
  } finally {
    Date.now = originalNow;
    globalThis.fetch = originalFetch;
  }
});

test("growth journey delivery retries a rejected ACK and bounds a request that never settles", async () => {
  let attempts = 0;
  assert.equal(
    await runBoundedGrowthEventRetry(async () => {
      attempts += 1;
      return attempts === 2;
    }, { timeoutMs: 100, attempts: 2 }),
    true
  );
  assert.equal(attempts, 2);

  let aborted = false;
  assert.equal(
    await runBoundedGrowthEventRetry(
      (signal) => new Promise<boolean>(() => {
        signal?.addEventListener("abort", () => {
          aborted = true;
        }, { once: true });
      }),
      { timeoutMs: 15, attempts: 2 }
    ),
    false
  );
  assert.equal(aborted, true);

  const firstAttempt = deferred();
  let consentStillCurrent = true;
  let revocationAttempts = 0;
  const delivery = runBoundedGrowthEventRetry(async () => {
    revocationAttempts += 1;
    await firstAttempt.promise;
    return false;
  }, {
    timeoutMs: 100,
    attempts: 2,
    shouldContinue: () => consentStillCurrent,
  });
  await waitUntil(() => revocationAttempts === 1);
  consentStillCurrent = false;
  firstAttempt.resolve();
  assert.equal(await delivery, false);
  assert.equal(revocationAttempts, 1);
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
      target.location.pathname = measurementCompletionPath;
      writeMeasurementConsent({ analytics: true, advertising: true });
      initializeGoogleMeasurement({
        googleAnalyticsMeasurementId: "G-ABC1234567",
        googleAdsId: "AW-123456789",
        registrationLabel: "Register_123",
        requestLabel: "Request_123",
        purchaseLabel: "Purchase_123",
      });
      notifyGoogleMeasurementScriptFailed();
      installAcknowledgingGtag(target);
      await markGoogleMeasurementScriptReady();

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
    target.location.pathname = measurementCompletionPath;
    writeMeasurementConsent({ analytics: true, advertising: true });
    initializeGoogleMeasurement({
      googleAnalyticsMeasurementId: "G-ABC1234567",
      googleAdsId: "AW-123456789",
      registrationLabel: "Register_123",
      requestLabel: "Request_123",
      purchaseLabel: "Purchase_123",
    });
    notifyGoogleMeasurementScriptFailed();
    installAcknowledgingGtag(target);
    await markGoogleMeasurementScriptReady();

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
    true
  );
  assert.equal(readRegistrationSessionValue(blockedStorage, "provider"), "google");
  assert.doesNotThrow(() =>
    removeRegistrationSessionValues(blockedStorage, ["provider", "profile"])
  );
  assert.equal(readRegistrationSessionValue(blockedStorage, "provider"), null);
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

test("registration conversion and notification budgets run concurrently", async () => {
  const storage = new MemoryStorage();
  const keys = {
    conversion: "parallel-conversion",
    notification: "parallel-notification",
  } as const;
  const accountBinding = "c".repeat(64);
  assert.equal(
    markRegistrationHandoffsPending(storage, keys, "email", accountBinding),
    true
  );

  let conversionStarted = false;
  let notificationStarted = false;
  let releaseConversion!: () => void;
  let releaseNotification!: () => void;
  const conversionGate = new Promise<void>((resolve) => { releaseConversion = resolve; });
  const notificationGate = new Promise<void>((resolve) => { releaseNotification = resolve; });
  const completion = completePendingRegistrationHandoffs({
    storage,
    keys,
    accountBinding,
    onConversion: async () => {
      conversionStarted = true;
      await conversionGate;
      return true;
    },
    onNotification: async () => {
      notificationStarted = true;
      await notificationGate;
      return true;
    },
  });

  await Promise.resolve();
  assert.equal(conversionStarted, true);
  assert.equal(notificationStarted, true);
  releaseConversion();
  releaseNotification();
  assert.deepEqual(await completion, {
    conversionCompleted: true,
    notificationCompleted: true,
  });
});

test("registration navigation budget covers fast, hanging and rejected handoffs without overlap", async () => {
  const fastBackground: string[] = [];
  const fast = await settleRegistrationHandoffWithinNavigationBudget({
    completion: Promise.resolve("done"),
    budgetMs: 20,
    onBackgroundSettled: (result) => fastBackground.push(result),
    onBackgroundRejected: () => fastBackground.push("rejected"),
  });
  assert.deepEqual(fast, {
    settledInForeground: true,
    rejected: false,
    result: "done",
  });
  assert.deepEqual(fastBackground, []);

  let settleHanging!: (value: string) => void;
  const hangingCompletion = new Promise<string>((resolve) => {
    settleHanging = resolve;
  });
  const background: string[] = [];
  const hanging = await settleRegistrationHandoffWithinNavigationBudget({
    completion: hangingCompletion,
    budgetMs: 0,
    onBackgroundSettled: (result) => background.push(result),
    onBackgroundRejected: () => background.push("rejected"),
  });
  assert.deepEqual(hanging, {
    settledInForeground: false,
    rejected: false,
    result: null,
  });
  assert.deepEqual(background, []);
  settleHanging("settled-after-navigation");
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(background, ["settled-after-navigation"]);

  const foregroundRejected = await settleRegistrationHandoffWithinNavigationBudget({
    completion: Promise.reject(new Error("synthetic foreground failure")),
    budgetMs: 20,
    onBackgroundSettled: () => assert.fail("foreground result must not be background"),
    onBackgroundRejected: () => assert.fail("foreground rejection is returned to the caller"),
  });
  assert.deepEqual(foregroundRejected, {
    settledInForeground: true,
    rejected: true,
    result: null,
  });

  let rejectHanging!: (error: Error) => void;
  const hangingRejection = new Promise<string>((_resolve, reject) => {
    rejectHanging = reject;
  });
  let recoveredRejection = 0;
  const backgroundRejected = await settleRegistrationHandoffWithinNavigationBudget({
    completion: hangingRejection,
    budgetMs: 0,
    onBackgroundSettled: () => assert.fail("rejected work must not settle successfully"),
    onBackgroundRejected: () => { recoveredRejection += 1; },
  });
  assert.equal(backgroundRejected.settledInForeground, false);
  rejectHanging(new Error("synthetic background failure"));
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(recoveredRejection, 1);
});

test("registration handoff recovery retries failed work automatically and clears each marker independently", async () => {
  const storage = new MemoryStorage();
  const keys = {
    conversion: "pending-conversion",
    notification: "pending-notification",
  } as const;
  const accountBinding = "a".repeat(64);
  let conversionCalls = 0;
  let notificationCalls = 0;

  assert.equal(
    markRegistrationHandoffsPending(
      storage,
      keys,
      "email",
      accountBinding
    ),
    true
  );

  const result = await retryPendingRegistrationHandoffs({
    storage,
    keys,
    accountBinding,
    retryDelaysMs: [0, 0],
    wait: async () => undefined,
    onConversion: async () => {
      conversionCalls += 1;
      return conversionCalls === 2;
    },
    onNotification: async (source) => {
      assert.equal(source, "email");
      notificationCalls += 1;
      return true;
    },
  });

  assert.deepEqual(result, {
    conversionCompleted: true,
    notificationCompleted: true,
    attempts: 2,
    stopped: false,
  });
  assert.equal(conversionCalls, 2);
  assert.equal(notificationCalls, 1);
  assert.equal(storage.getItem(keys.conversion), null);
  assert.equal(storage.getItem(keys.notification), null);
});

test("registration notification timeout aborts fail-soft instead of blocking auth", async () => {
  let aborted = false;
  const completed = await runRegistrationHandoffWithTimeout(
    (signal) =>
      new Promise<boolean>((resolve) => {
        signal?.addEventListener(
          "abort",
          () => {
            aborted = true;
            resolve(false);
          },
          { once: true }
        );
      }),
    10
  );

  assert.equal(completed, false);
  assert.equal(aborted, true);
});

test("cancelled registration recovery stops before touching account-bound markers", async () => {
  const storage = new MemoryStorage();
  const keys = {
    conversion: "pending-conversion",
    notification: "pending-notification",
  } as const;
  const accountBinding = "a".repeat(64);
  const previousAccountRecovery = claimRegistrationHandoffRecovery(storage);
  markRegistrationHandoffsPending(storage, keys, "google", accountBinding);
  assert.equal(
    ownsRegistrationHandoffRecovery(storage, previousAccountRecovery),
    false
  );
  let deliveries = 0;

  const result = await retryPendingRegistrationHandoffs({
    storage,
    keys,
    accountBinding,
    retryDelaysMs: [0],
    wait: async () => undefined,
    shouldContinue: () =>
      ownsRegistrationHandoffRecovery(storage, previousAccountRecovery),
    onConversion: async () => {
      deliveries += 1;
      return true;
    },
    onNotification: async () => {
      deliveries += 1;
      return true;
    },
  });

  assert.equal(result.stopped, true);
  assert.equal(result.attempts, 0);
  assert.equal(deliveries, 0);
  assert.notEqual(storage.getItem(keys.conversion), null);
  assert.notEqual(storage.getItem(keys.notification), null);
});

test("an auth identity change without marker replacement cannot consume the original handoff", async () => {
  const storage = new MemoryStorage();
  const keys = {
    conversion: "pending-conversion",
    notification: "pending-notification",
  } as const;
  const firstUserId = "11111111-1111-4111-8111-111111111111";
  const secondUserId = "22222222-2222-4222-8222-222222222222";
  const firstBinding = await createRegistrationAccountBinding(firstUserId);
  assert.ok(firstBinding);
  markRegistrationHandoffsPending(storage, keys, "email", firstBinding);

  let currentUserId = firstUserId;
  const matchesCurrentAccount = async () =>
    (await createRegistrationAccountBinding(currentUserId)) === firstBinding;
  currentUserId = secondUserId;
  let deliveries = 0;

  const result = await completePendingRegistrationHandoffs({
    storage,
    keys,
    accountBinding: firstBinding,
    onConversion: async () => {
      if (!(await matchesCurrentAccount())) return false;
      deliveries += 1;
      return true;
    },
    onNotification: async () => {
      if (!(await matchesCurrentAccount())) return false;
      deliveries += 1;
      return true;
    },
  });

  assert.deepEqual(result, {
    conversionCompleted: false,
    notificationCompleted: false,
  });
  assert.equal(deliveries, 0);
  assert.match(storage.getItem(keys.conversion) ?? "", new RegExp(firstBinding));
  assert.match(storage.getItem(keys.notification) ?? "", new RegExp(firstBinding));
});

test("an account switch during delivery preserves the new account handoff markers", async () => {
  const storage = new MemoryStorage();
  const keys = {
    conversion: "pending-conversion",
    notification: "pending-notification",
  } as const;
  const firstBinding = "a".repeat(64);
  const secondBinding = "b".repeat(64);
  markRegistrationHandoffsPending(storage, keys, "email", firstBinding);
  const firstRecovery = claimRegistrationHandoffRecovery(storage);
  let notificationCalls = 0;

  const result = await completePendingRegistrationHandoffs({
    storage,
    keys,
    accountBinding: firstBinding,
    shouldContinue: () =>
      ownsRegistrationHandoffRecovery(storage, firstRecovery),
    onConversion: async () => {
      markRegistrationHandoffsPending(
        storage,
        keys,
        "google",
        secondBinding
      );
      return true;
    },
    onNotification: async () => {
      notificationCalls += 1;
      return true;
    },
  });

  assert.deepEqual(result, {
    conversionCompleted: false,
    notificationCompleted: false,
  });
  assert.equal(notificationCalls, 0);
  assert.match(storage.getItem(keys.conversion) ?? "", new RegExp(secondBinding));
  assert.match(storage.getItem(keys.notification) ?? "", new RegExp(secondBinding));
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
  assert.match(storage.getItem(keys.conversion) ?? "", new RegExp(firstBinding ?? ""));
  assert.match(storage.getItem(keys.notification) ?? "", new RegExp(firstBinding ?? ""));
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

test("late consent on a conversion route persists the exact public first touch once and never captures the private route", async () => {
  const originalFetch = globalThis.fetch;
  const initialTouch = buildGrowthAttributionTouch({
    url: "https://file.mgautotech.de/services/stage-1?utm_source=google&utm_medium=cpc&utm_campaign=stage1_uk&gclid=private-click",
    referrer: "https://www.google.co.uk/",
    locale: "en-GB",
  });
  const privateCurrentTouch = buildGrowthAttributionTouch({
    url: "https://file.mgautotech.de/new-request?utm_source=private-value",
    referrer: "https://file.mgautotech.de/services/stage-1",
    locale: "en-GB",
  });
  const selectedTouches = selectGrowthAttributionTouchesForRoute({
    pathname: "/new-request",
    initialTouch,
    currentTouch: privateCurrentTouch,
  });
  const acknowledged = new Set<string>();
  const requestBodies: Array<Record<string, unknown>> = [];

  assert.deepEqual(selectedTouches, [initialTouch]);
  assert.doesNotMatch(JSON.stringify(selectedTouches), /new-request|private-click|private-value/);

  try {
    globalThis.fetch = (async (_input, init) => {
      requestBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return new Response(
        JSON.stringify({ accepted: true }),
        { status: 202, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    await withWindow(async () => {
      writeMeasurementConsent({ analytics: true, advertising: false });
      for (const touch of [...selectedTouches, ...selectedTouches]) {
        const key = growthAttributionTouchKey(touch);
        if (acknowledged.has(key)) continue;
        if (await recordGrowthAttributionTouch(touch)) acknowledged.add(key);
      }
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(requestBodies.length, 1);
  assert.equal(requestBodies[0]?.action, "attribution_touch");
  assert.equal(requestBodies[0]?.landingPath, "/services/stage-1");
  assert.equal(requestBodies[0]?.source, "google");
  assert.equal(requestBodies[0]?.medium, "cpc");
  assert.equal(requestBodies[0]?.campaign, "stage1_uk");
  assert.equal(acknowledged.size, 1);

  const analyticsComponent = projectFile("src", "components", "analytics", "PublicAnalytics.tsx");
  assert.match(
    analyticsComponent,
    /attributionRouteAllowed =[\s\S]*?attributionPublicRoute \|\| isConversionMeasurementPath\(pathname\)/
  );
  assert.match(
    analyticsComponent,
    /const currentTouch = attributionPublicRoute[\s\S]*?\? captureGrowthAttributionTouch\(\)[\s\S]*?: null/
  );
});

test("campaign URL builder keeps language, destination and UTM values on an allowlist", () => {
  const german = buildGoogleAdsCampaignUrl({
    locale: "de",
    destination: "stage1",
    campaign: "stage1_de",
  });
  const english = buildGoogleAdsCampaignUrl({
    locale: "en",
    destination: "file_service",
    campaign: "file_service_us",
  });
  const stageTwo = buildGoogleAdsCampaignUrl({
    locale: "en",
    destination: "stage2",
    campaign: "file_service_uk_ie_en",
  });
  const fileCheck = buildGoogleAdsCampaignUrl({
    locale: "en",
    destination: "ecu_file_check",
    campaign: "file_service_uk_ie_en",
  });
  const ecuPlatforms = buildGoogleAdsCampaignUrl({
    locale: "en",
    destination: "ecu_platforms",
    campaign: "file_service_uk_ie_en",
  });

  assert.equal(
    german,
    "https://file.mgautotech.de/de/services/stage-1?utm_source=google&utm_medium=cpc&utm_campaign=stage1_de"
  );
  assert.equal(
    english,
    "https://file.mgautotech.de/file-service?utm_source=google&utm_medium=cpc&utm_campaign=file_service_us"
  );
  assert.equal(stageTwo, "https://file.mgautotech.de/services/stage-2?utm_source=google&utm_medium=cpc&utm_campaign=file_service_uk_ie_en");
  assert.equal(fileCheck, "https://file.mgautotech.de/services/ecu-file-check?utm_source=google&utm_medium=cpc&utm_campaign=file_service_uk_ie_en");
  assert.equal(ecuPlatforms, "https://file.mgautotech.de/ecu-platforms?utm_source=google&utm_medium=cpc&utm_campaign=file_service_uk_ie_en");
  assert.equal(buildGoogleAdsCampaignUrl({ locale: "de", destination: "ecu_platforms", campaign: "stage1_de" }), null);
  assert.equal(googleAdsLanguageDestinations.length, 12);
  assert.equal(buildGoogleAdsCampaignUrl({ locale: "de", destination: "stage1", campaign: "customer@example.com" }), null);
  assert.equal(buildGoogleAdsCampaignUrl({ locale: "de", destination: "stage1", campaign: "alice_smith" }), null);
  assert.equal(buildGoogleAdsCampaignUrl({ locale: "de", destination: "stage1", campaign: "stage1_alice_smith" }), null);
  assert.equal(buildGoogleAdsCampaignUrl({ locale: "de", destination: "stage1", campaign: "ab" }), null);
  for (const campaign of [
    "file_service_eu_en",
    "stage1_fr_ca",
    "stage2_uk_ie",
    "tcu_uk_ie",
    "ecu_file_check_uk_ie",
    "ecu_platforms_uk_ie",
    "how_it_works_uk_ie",
  ]) {
    assert.equal(normalizeGoogleAdsCampaignToken(campaign), campaign);
  }
});

test("Ads readiness fails closed until every conversion control is safely configured", () => {
  const protectedSecretKeys = [
    "GROWTH_ATTRIBUTION_LEGACY_HMAC_SECRET",
    "SUPABASE_SERVICE_ROLE_KEY",
    "UPLOAD_INTEGRITY_SECRET",
    "CUSTOMER_DEVICE_HMAC_SECRET",
    "FILE_EXPERT_ANALYZER_TOKEN",
    "REQUEST_NETWORK_PROXY_SECRET",
    "SECURITY_RATE_LIMIT_SALT",
    "WIDGET_SESSION_SECRET",
    "WIDGET_IP_HASH_SALT",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_WIDGET_WEBHOOK_SECRET",
    "RESEND_API_KEY",
    "RESEND_WEBHOOK_SECRET",
    "OPENAI_API_KEY",
    "LOCAL_AI_API_KEY",
    "VLLM_API_KEY",
    "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
    "UPSTASH_REDIS_REST_TOKEN",
    "KV_REST_API_TOKEN",
  ] as const;
  const keys = [
    "NEXT_PUBLIC_GOOGLE_ANALYTICS_ID",
    "NEXT_PUBLIC_GOOGLE_ADS_ID",
    "NEXT_PUBLIC_GOOGLE_ADS_REGISTRATION_LABEL",
    "NEXT_PUBLIC_GOOGLE_ADS_REQUEST_LABEL",
    "NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL",
    "GROWTH_ATTRIBUTION_HMAC_SECRET",
    ...protectedSecretKeys,
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
    assert.equal(getAdsConfigurationStatus().configurationComplete, false);
    process.env.GROWTH_ATTRIBUTION_HMAC_SECRET = "dedicated-growth-attribution-secret-123456";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-service-role-secret-123456789";
    process.env.UPLOAD_INTEGRITY_SECRET = "synthetic-upload-integrity-secret-123456";
    process.env.CUSTOMER_DEVICE_HMAC_SECRET = "synthetic-customer-device-secret-123456";
    process.env.FILE_EXPERT_ANALYZER_TOKEN = "synthetic-file-analyzer-token-12345678";
    process.env.REQUEST_NETWORK_PROXY_SECRET = "synthetic-network-proxy-secret-123456";
    process.env.SECURITY_RATE_LIMIT_SALT = "synthetic-rate-limit-secret-123456789";
    process.env.WIDGET_SESSION_SECRET = "synthetic-widget-session-secret-123456";
    process.env.WIDGET_IP_HASH_SALT = "synthetic-widget-ip-hash-salt-123456";
    process.env.STRIPE_SECRET_KEY = "synthetic-stripe-key-secret-123456789";
    process.env.STRIPE_WEBHOOK_SECRET = "synthetic-stripe-webhook-secret-123456";
    process.env.STRIPE_WIDGET_WEBHOOK_SECRET = "synthetic-widget-webhook-secret-123456";
    process.env.RESEND_API_KEY = "synthetic-resend-api-secret-123456789";
    process.env.RESEND_WEBHOOK_SECRET = "synthetic-resend-webhook-secret-123456";
    process.env.OPENAI_API_KEY = "synthetic-openai-api-secret-123456789";
    process.env.LOCAL_AI_API_KEY = "synthetic-local-ai-secret-123456789012";
    process.env.VLLM_API_KEY = "synthetic-vllm-api-secret-12345678901";
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = "synthetic-google-private-key-secret-123456";
    process.env.UPSTASH_REDIS_REST_TOKEN = "synthetic-upstash-token-secret-123456789";
    process.env.KV_REST_API_TOKEN = "synthetic-kv-token-secret-123456789012";
    const ready = getAdsConfigurationStatus();
    assert.equal(ready.configurationComplete, true);
    assert.equal(ready.attributionSigning, true);
    assert.equal(ready.distinctConversionLabels, true);
    assert.equal(ready.personalizedAdvertising, false);
    for (const protectedSecretKey of protectedSecretKeys) {
      process.env.GROWTH_ATTRIBUTION_HMAC_SECRET = process.env[protectedSecretKey];
      const reusedSecret = getAdsConfigurationStatus();
      assert.equal(reusedSecret.attributionSigning, false, protectedSecretKey);
      assert.equal(reusedSecret.configurationComplete, false, protectedSecretKey);
    }
    process.env.GROWTH_ATTRIBUTION_HMAC_SECRET = "dedicated-growth-attribution-secret-123456";
    process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL = "Request_123";
    const duplicate = getAdsConfigurationStatus();
    assert.equal(duplicate.distinctConversionLabels, false);
    assert.equal(duplicate.configurationComplete, false);
    process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL = " Request_123 ";
    const whitespaceDuplicate = getAdsConfigurationStatus();
    assert.equal(whitespaceDuplicate.distinctConversionLabels, false);
    assert.equal(whitespaceDuplicate.configurationComplete, false);
  } finally {
    for (const key of keys) {
      const value = before[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("measurement health distinguishes configuration, traffic, request and revenue evidence", () => {
  const readySources = {
    coreBusiness: "ready" as const,
    attribution: "ready" as const,
    customerClassification: "ready" as const,
  };
  const configured = {
    analyticsMeasurement: true,
    googleAdsTag: true,
    registrationConversion: true,
    requestConversion: true,
    purchaseConversion: true,
    attributionSigning: true,
    distinctConversionLabels: true,
    consentModeV2: true as const,
    personalizedAdvertising: false as const,
    configurationComplete: true,
  };

  assert.equal(buildAdsMeasurementHealth({
    configuration: configured,
    sourceReadiness: readySources,
    consentedVisitors: 0,
    registrations: 0,
    requests: 0,
    payingCustomers: 0,
  }).status, "awaiting_consented_traffic");
  assert.equal(buildAdsMeasurementHealth({
    configuration: configured,
    sourceReadiness: readySources,
    consentedVisitors: 4,
    registrations: 1,
    requests: 0,
    payingCustomers: 0,
  }).status, "traffic_observed");
  assert.equal(buildAdsMeasurementHealth({
    configuration: configured,
    sourceReadiness: readySources,
    consentedVisitors: 4,
    registrations: 1,
    requests: 1,
    payingCustomers: 0,
  }).status, "requests_observed");
  const revenueHealth = buildAdsMeasurementHealth({
    configuration: configured,
    sourceReadiness: readySources,
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
    sourceReadiness: readySources,
    consentedVisitors: 4,
    registrations: 1,
    requests: 1,
    payingCustomers: 1,
  }).status, "configuration_required");

  const incomplete = buildAdsMeasurementHealth({
    configuration: configured,
    sourceReadiness: {
      coreBusiness: "partial",
      attribution: "error",
      customerClassification: "migration_required",
    },
    consentedVisitors: 40,
    registrations: 12,
    requests: 8,
    payingCustomers: 3,
  });
  assert.equal(incomplete.status, "report_incomplete");
  assert.equal(incomplete.metricsAvailable, false);
  assert.equal(incomplete.payingCustomers, 0);
  assert.match(incomplete.label, /do not activate ads/i);
  assert.match(incomplete.detail, /Core business: partial/i);
});

test("Ads report withholds partial success and revenue signals until required sources are ready", () => {
  const report = buildAdsPerformanceReport({
    generatedAt: "2026-08-06T12:00:00.000Z",
    range: "30d",
    sources: {
      coreBusiness: "partial",
      attribution: "ready",
      customerClassification: "error",
      seo: "not_configured",
      emailDelivery: "ready",
    },
    funnel: {
      consentedVisitors: 25,
      registrations: 8,
      customersWithRequests: 6,
      firstRequestCustomers: 4,
      repeatCustomers: 2,
      orders: 10,
      completedOrders: 7,
      payingCustomers: 4,
      visitorToRegistrationRate: 0.32,
      registrationToRequestRate: 0.75,
      requestToRepeatRate: 1 / 3,
      completionRate: 0.7,
    },
    bySource: [performanceRow({ key: "google / cpc", label: "google / cpc", orders: 10 })],
    byCampaign: [performanceRow({ key: "stage1_en", label: "stage1_en", orders: 10 })],
  } as GrowthCustomerSuccessReport);

  assert.equal(report.measurementHealth.status, "report_incomplete");
  assert.equal(report.measurementHealth.metricsAvailable, false);
  assert.equal(report.measurementHealth.requests, 0);
  assert.equal(report.measurementHealth.payingCustomers, 0);
  assert.deepEqual(report.paidSources, []);
  assert.deepEqual(report.campaigns, []);
  assert.ok(report.accountActions.some((action) => /Do not activate paid campaign/i.test(action)));
  assert.ok(report.limitations.some((item) => /totals are withheld/i.test(item)));
});

test("admin report exposes aggregate paid results and no configuration values", () => {
  const report = buildAdsPerformanceReport({
    generatedAt: "2026-08-06T12:00:00.000Z",
    range: "30d",
    sources: {
      coreBusiness: "ready",
      attribution: "ready",
      customerClassification: "ready",
      seo: "not_configured",
      emailDelivery: "ready",
    },
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
  assert.deepEqual(report.measurementPolicy.primaryConversions, [
    "verified_request",
    "verified_purchase",
  ]);
  assert.equal(report.measurementPolicy.observationConversion, "verified_registration");
  assert.equal(report.measurementPolicy.applicationRetainsRawClickIds, false);
  assert.equal(report.measurementPolicy.customerIdentifiersExported, false);
  assert.equal(report.deliveryVerification.status, "external_verification_required");
  assert.match(report.deliveryVerification.detail, /Google Ads has not confirmed receiving/i);
  assert.equal(report.externalLaunchGates.length, 9);
  assert.ok(report.externalLaunchGates.every((gate) => gate.status === "manual_unverified"));
  assert.equal(report.measurementHealth.status, "configuration_required");
  assert.equal(report.measurementHealth.payingCustomers, 1);
  assert.equal(report.languageDestinations.length, 12);
  assert.doesNotMatch(JSON.stringify(report), /AW-\d+|service_role|private_key|client_secret/i);
});

test("admin Ads UI separates configuration from delivery and first-party outcomes", () => {
  const client = projectFile("src", "app", "admin", "ads-performance", "AdsPerformanceClient.tsx");

  assert.match(client, /Technical configuration complete - not launch-ready/);
  assert.match(client, /Technical configuration incomplete - not launch-ready/);
  assert.match(client, /Google Ads delivery not verified|deliveryVerification\.label/);
  assert.match(client, /Website results/);
  assert.match(client, /Customer classification/);
  assert.match(client, /metricsAvailable/);
  assert.match(client, /Unavailable/);
  assert.match(client, /of 9 technical controls/);
  assert.doesNotMatch(client, /Measurement ready|of 9 verified/);
  assert.match(client, /External launch gates remain manual and unverified/);
  assert.match(client, /No approvals stored here/);
  assert.match(client, /report\.externalLaunchGates\.map/);
  assert.match(client, /Manual \/ unverified/);
  assert.match(client, /landingReviewStatusLabel\(page\.status\)/);
  assert.match(client, /Verified file requests and verified payments are Primary \/ Every/);
  assert.match(client, /Registration is Secondary \/ One/);
  assert.doesNotMatch(client, /request is secondary|request Secondary/i);
  assert.doesNotMatch(client, /Creative code|creativeCode|utm_content/);
});

test("external Ads launch gates are explicit, read-only and never inferred as complete", () => {
  assert.deepEqual(
    adsExternalLaunchGates.map((gate) => gate.key),
    [
      "english_privacy_google_disclosure",
      "google_ads_data_protection_contact",
      "edge_query_log_controls",
      "turnaround_claim_evidence",
      "uk_ie_emissions_clearance",
      "daily_budget_overdelivery_acceptance",
      "same_origin_google_tag_decision",
      "post_deploy_conversion_receipt",
      "action_time_ads_assets_and_edits",
    ]
  );
  assert.ok(adsExternalLaunchGates.every((gate) => gate.status === "manual_unverified"));
  assert.match(JSON.stringify(adsExternalLaunchGates), /Business Data Responsibility/);
  assert.match(JSON.stringify(adsExternalLaunchGates), /data protection contact/i);
  assert.match(JSON.stringify(adsExternalLaunchGates), /query redaction, retention and access controls/i);
  assert.match(JSON.stringify(adsExternalLaunchGates), /15-30 minute/);
  assert.match(JSON.stringify(adsExternalLaunchGates), /UK and Irish legal review/);
  assert.match(JSON.stringify(adsExternalLaunchGates), /daily-budget overdelivery/);
  assert.match(JSON.stringify(adsExternalLaunchGates), /same-origin trust boundary/);
  assert.match(JSON.stringify(adsExternalLaunchGates), /Tag Assistant and network evidence/);
  assert.match(JSON.stringify(adsExternalLaunchGates), /asset rights/);
});

test("Ads landing readiness points How It Works at its real request conversion path", () => {
  const howItWorks = adsLandingPages.find((page) => page.path === "/how-it-works");
  assert.equal(howItWorks?.conversionPath, "/new-request");
});

test("Ads readiness separates the audited six sitelinks from the seven landing-page union", () => {
  const auditedPaths = googleAdsUkIeAuditedSitelinkKeys.map((key) => {
    const destination = googleAdsDestinationDefinitions.find((item) => item.key === key);
    assert.ok(destination, `missing Google Ads destination definition for ${key}`);
    return destination.path;
  });
  const readinessPaths = adsLandingPages.map((page) => page.path);
  const destinationPaths = googleAdsDestinationDefinitions.map((item) => item.path);

  assert.equal(new Set(auditedPaths).size, 6);
  assert.equal(auditedPaths.includes("/file-service"), false);
  assert.equal(new Set(readinessPaths).size, 7);
  assert.deepEqual([...readinessPaths].sort(), [...destinationPaths].sort());
  assert.equal(readinessPaths.includes("/file-service"), true);
  assert.ok(auditedPaths.every((path) => readinessPaths.includes(path)));
});

test("verified conversion integration is ordered after business success and remains fail-soft", () => {
  const register = projectFile("src", "app", "register", "page.tsx");
  const callback = projectFile("src", "app", "auth", "callback", "page.tsx");
  const completeProfile = projectFile("src", "app", "auth", "complete-profile", "page.tsx");
  const request = projectFile("src", "app", "new-request", "page.tsx");
  const payment = projectFile("src", "app", "payment", "success", "page.tsx");
  const confirmation = projectFile("src", "app", "api", "stripe", "confirm-session", "route.ts");
  const analytics = projectFile("src", "lib", "publicAnalytics.ts");
  const registrationClient = projectFile("src", "lib", "registrationHandoffClient.ts");
  const registrationCore = projectFile("src", "lib", "registrationConversion.ts");

  assert.match(register, /isAlreadyVerified[\s\S]*?markRegistrationHandoffsPending[\s\S]*?completeRegistrationHandoffsBeforeNavigation/);
  assert.doesNotMatch(register, /completePendingRegistrationHandoffs|recordGrowthAccountCreated|trackRegistrationCompleted/);
  assert.match(callback, /isVerifiedEmailRegistrationCallback[\s\S]*?markRegistrationHandoffsPending[\s\S]*?completeRegistrationHandoffsBeforeNavigation/);
  assert.doesNotMatch(callback, /isRecentSignup|isRecentEmailConfirmation|15 \* 60 \* 1000/);
  assert.doesNotMatch(callback, /window\.sessionStorage\.(?:getItem|setItem|removeItem)/);
  assert.equal(callback.match(/exchangeCodeForSession\(/g)?.length, 1);
  assert.ok(
    callback.indexOf("await completeRegistrationHandoffsBeforeNavigation") <
      callback.indexOf("await startDeviceVerification()"),
    "the bounded registration handoff opportunity must begin before device verification"
  );
  assert.match(completeProfile, /readPendingRegistrationHandoffs[\s\S]*?clearPendingDraft\(\)[\s\S]*?completeRegistrationHandoffsBeforeNavigation/);
  assert.doesNotMatch(completeProfile, /clearPendingDraft[\s\S]{0,250}removeItem\(OAUTH_REGISTRATION_(?:CONVERSION|NOTIFICATION)/);
  assert.match(
    completeProfile,
    /const callbackDestination =[\s\S]*?replaceWithPendingMeasurementCompletion\([\s\S]*?callbackDestination[\s\S]*?\)[\s\S]*?replacePrivateMeasurementDocument\(callbackDestination\)/
  );
  assert.doesNotMatch(
    completeProfile,
    /replaceWithPendingMeasurementCompletion\(next\)/
  );
  assert.match(registrationClient, /readMeasurementConsentSnapshot\(\)[\s\S]*?consent\.needsDecision\) return false/);
  assert.match(registrationClient, /readMeasurementConsentSnapshot\(\)[\s\S]*?!consent\.preferences\.analytics && !consent\.preferences\.advertising[\s\S]*?return true/);
  assert.match(registrationClient, /runRegistrationHandoffWithTimeout[\s\S]*?authenticatedFetchForUser\([\s\S]*?"\/api\/email\/new-customer"[\s\S]*?signal/);
  assert.match(registrationCore, /WeakMap[\s\S]*?markRegistrationHandoffsPending[\s\S]*?claimRegistrationHandoffRecovery/);
  assert.match(registrationClient, /shouldContinue:[\s\S]*?ownsRegistrationHandoffRecovery/);
  assert.match(registrationClient, /getStableSession\(\)[\s\S]*?createRegistrationAccountBinding\([\s\S]*?session\.user\.id[\s\S]*?currentAccountBinding === accountBinding/);
  assert.match(registrationClient, /deliverRegistrationConversion\(accountBinding[\s\S]*?registrationAccountStillMatches\(expectedAccount\)/);
  assert.match(registrationClient, /deliverRegistrationNotification\([\s\S]*?authenticatedFetchForUser\([\s\S]*?registrationAccountStillMatches\(expectedAccount\)/);
  assert.match(registrationClient, /REGISTRATION_HANDOFF_PERIODIC_RETRY_DELAYS_MS[\s\S]*?15_000[\s\S]*?30_000[\s\S]*?60_000/);
  assert.match(registrationClient, /scheduleNextPeriodicRetry[\s\S]*?setTimeout\([\s\S]*?runAttempt\(false\)/);
  assert.match(registrationClient, /REGISTRATION_HANDOFF_NAVIGATION_BUDGET_MS = 1_250/);
  assert.match(registrationClient, /settleRegistrationHandoffWithinNavigationBudget[\s\S]*?Promise\.race/);
  assert.match(registrationClient, /completeRegistrationHandoffsBeforeNavigation[\s\S]*?onBackgroundSettled: recoverIfNeeded[\s\S]*?onBackgroundRejected:[\s\S]*?startRegistrationHandoffRecovery/);
  assert.match(
    registrationClient,
    /conversionWasPending[\s\S]*?conversionCompletionNotified[\s\S]*?onConversionHandoffCompleted[\s\S]*?startRegistrationHandoffRecovery\(input, recoveryOptions\)/
  );
  for (const source of [register, callback, completeProfile]) {
    assert.match(
      source,
      /onConversionHandoffCompleted:[\s\S]*?startMeasurementBridge/
    );
    assert.match(source, /replaceWithPendingMeasurementCompletion/);
  }
  assert.match(registrationCore, /Promise\.all\(\[[\s\S]*?completeConversion\(\)[\s\S]*?completeNotification\(\)/);
  assert.match(registrationClient, /addEventListener\("online", requestResume\)/);
  assert.match(registrationClient, /addEventListener\(measurementConsentChangedEvent, requestResume\)/);
  assert.match(registrationClient, /addEventListener\("visibilitychange", resumeWhenVisible\)/);
  assert.doesNotMatch(registrationClient, /user\.email|gclid|gbraid|wbraid/i);
  assert.match(request, /if \(error\) \{[\s\S]*?return;[\s\S]*?createdOrderId \|\| growthAttemptIdRef[\s\S]*?trackRequestSubmitted\(conversionSeed\)/);
  assert.match(confirmation, /session\.payment_status !== "paid"[\s\S]*?completeStripeCreditPurchase\(session\)[\s\S]*?conversion:/);
  assert.match(payment, /if \(!response\?\.ok\)[\s\S]*?return;[\s\S]*?trackPurchaseCompleted/);
  assert.match(analytics, /process\.env\.NEXT_PUBLIC_GOOGLE_ADS_ID/);
  assert.match(analytics, /measurementConsentChangedEvent[\s\S]*?dispatchEvent\(new Event\(measurementConsentChangedEvent\)\)/);
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
  assert.match(client, /export async function recordGrowthAccountCreated\(expectedUserId\?: string\) \{[\s\S]*try \{[\s\S]*catch \{[\s\S]*return null/);
  assert.doesNotMatch(client, /localStorage\.setItem\([^\n]*conversionSeed/);
  assert.match(server, /ignoreDuplicates: true[\s\S]*\.eq\("event_key", key\)[\s\S]*\.eq\("user_id", input\.userId\)/);
});
