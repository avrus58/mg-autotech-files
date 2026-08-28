import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  createAdClickConsentGateController,
  consumePreHydrationAdClickNavigation,
  getAdClickConsentDestination,
  getAdClickConsentNavigation,
  hasGoogleAdsLinkerState,
  hasProtectedAdsQueryKey,
  hasRecognizedAdClickSignal,
  isAdClickConsentLanding,
  isUnmodifiedSelfNavigation,
  preferencesForAdClickConsentChoice,
  waitForGoogleAdsLinkerReady,
} from "../src/lib/adClickConsentGate";
import {
  applyStoredMeasurementConsent,
  applyExternalMeasurementConsentChange,
  buildPublicNavigationEvent,
  dispatchPublicAnalyticsEventWithAck,
  flushGoogleAdsConversionOutbox,
  flushPendingVerifiedConversions,
  getPrivateDocumentNavigation,
  hasSensitiveMeasurementLocation,
  googleAdsLinkerSettleMs,
  googleAdsConversionOutboxStorageKey,
  googleAdsLinkerRevocationStorageKey,
  googleAdsLinkerStorageKey,
  initializeGoogleMeasurement,
  isGoogleAdsLinkerConfigurationReady,
  measurementConsentStorageKey,
  measurementConsentSessionStorageKey,
  measurementLocationSanitizedEvent,
  notifyGoogleMeasurementScriptFailed,
  notifyGoogleMeasurementScriptLoaded,
  replacePrivateMeasurementDocument,
  sanitizeSensitiveMeasurementLocation,
  trackRequestSubmitted,
  writeMeasurementConsent,
} from "../src/lib/publicAnalytics";

class MemoryStorage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
}

class LinkerMutationBlockedStorage extends MemoryStorage {
  constructor(value: string) {
    super();
    super.setItem(googleAdsLinkerStorageKey, value);
  }

  override setItem(key: string, value: string) {
    if (key === googleAdsLinkerStorageKey) {
      throw new Error("synthetic linker overwrite failure");
    }
    super.setItem(key, value);
  }

  override removeItem(key: string) {
    if (key === googleAdsLinkerStorageKey) {
      throw new Error("synthetic linker removal failure");
    }
    super.removeItem(key);
  }
}

const root = process.cwd();
const source = (...segments: string[]) =>
  readFileSync(path.join(root, ...segments), "utf8");

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

function controllerHarness(input?: {
  consent?: { needsDecision: boolean; analytics: boolean; advertising: boolean };
  wait?: (signal: AbortSignal) => Promise<unknown>;
  prepare?: (signal: AbortSignal) => Promise<unknown>;
}) {
  const events: string[] = [];
  const pending: Array<string | null> = [];
  const controller = createAdClickConsentGateController({
    readConsent: () => ({
      needsDecision: input?.consent?.needsDecision ?? true,
      preferences: {
        analytics: input?.consent?.analytics ?? false,
        advertising: input?.consent?.advertising ?? false,
      },
    }),
    persistConsent: (preferences) => {
      events.push(`persist:${preferences.analytics}:${preferences.advertising}`);
    },
    configureMeasurement: () => { events.push("config"); },
    prepareConsentedNavigation: (_destination, _preferences, signal) => {
      events.push("prepare");
      return input?.prepare?.(signal) ?? Promise.resolve();
    },
    waitForAdsReady: input?.wait ?? (async () => undefined),
    navigate: (destination) => { events.push(`navigate:${destination}`); },
    onPendingChange: (destination) => { pending.push(destination); },
  });
  return { controller, events, pending };
}

test("Google-capable to private navigation requires a fresh document boundary", () => {
  assert.equal(
    getPrivateDocumentNavigation(
      "/dashboard/orders",
      "https://file.mgautotech.de/services/stage-1?utm_source=google"
    ),
    "https://file.mgautotech.de/dashboard/orders"
  );
  assert.equal(
    getPrivateDocumentNavigation(
      "/dashboard",
      "https://file.mgautotech.de/new-request"
    ),
    null
  );
  assert.equal(
    getPrivateDocumentNavigation(
      "/services/stage-2",
      "https://file.mgautotech.de/services/stage-1"
    ),
    null
  );
  assert.equal(
    getPrivateDocumentNavigation(
      "/about?email=private%40example.test",
      "https://file.mgautotech.de/services/stage-1"
    ),
    "https://file.mgautotech.de/about?email=private%40example.test"
  );
  assert.equal(
    getPrivateDocumentNavigation(
      "/about#private-fragment",
      "https://file.mgautotech.de/services/stage-1"
    ),
    "https://file.mgautotech.de/about#private-fragment"
  );
  assert.equal(
    getPrivateDocumentNavigation(
      "https://example.test/dashboard",
      "https://file.mgautotech.de/services/stage-1"
    ),
    null
  );
});

test("only Google-capable and sensitive routes cross a fresh-document boundary", () => {
  assert.equal(
    getPrivateDocumentNavigation(
      "/auth/callback?next=%2Fdashboard",
      "https://file.mgautotech.de/register"
    ),
    "https://file.mgautotech.de/auth/callback?next=%2Fdashboard"
  );
  assert.equal(
    getPrivateDocumentNavigation(
      "/new-request?intent=stage_1",
      "https://file.mgautotech.de/dashboard"
    ),
    null
  );
  assert.equal(
    getPrivateDocumentNavigation(
      "/register",
      "https://file.mgautotech.de/dashboard/orders"
    ),
    null
  );
  assert.equal(
    getPrivateDocumentNavigation(
      "/auth/callback?next=%2Fdashboard",
      "https://file.mgautotech.de/login"
    ),
    "https://file.mgautotech.de/auth/callback?next=%2Fdashboard"
  );
  assert.equal(
    getPrivateDocumentNavigation(
      "/services/stage-1",
      "https://file.mgautotech.de/new-request"
    ),
    "https://file.mgautotech.de/services/stage-1"
  );
  assert.equal(
    getPrivateDocumentNavigation(
      "/new-request?intent=stage_1",
      "https://file.mgautotech.de/measurement/complete"
    ),
    "https://file.mgautotech.de/new-request?intent=stage_1"
  );
});

test("sensitive callback and payment queries block measurement until sanitized", () => {
  assert.equal(
    hasSensitiveMeasurementLocation(
      "https://file.mgautotech.de/auth/callback?code=private&next=%2Fdashboard"
    ),
    true
  );
  assert.equal(
    hasSensitiveMeasurementLocation(
      "https://file.mgautotech.de/payment/success#session-private"
    ),
    true
  );
  assert.equal(
    hasSensitiveMeasurementLocation(
      "https://file.mgautotech.de/register?redirect=%2Fdashboard"
    ),
    false
  );

  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const browser = new EventTarget() as EventTarget & {
    location: { href: string; pathname: string };
    history: { state: unknown; replaceState: (state: unknown, title: string, url: string) => void };
  };
  browser.location = {
    href: "https://file.mgautotech.de/auth/callback?code=private",
    pathname: "/auth/callback",
  };
  const replacements: string[] = [];
  browser.history = {
    state: { preserved: true },
    replaceState: (_state, _title, url) => {
      replacements.push(url);
      browser.location.href = `https://file.mgautotech.de${url}`;
    },
  };
  let sanitizedEvents = 0;
  browser.addEventListener(measurementLocationSanitizedEvent, () => {
    sanitizedEvents += 1;
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: browser,
  });
  try {
    assert.equal(sanitizeSensitiveMeasurementLocation(), true);
    assert.deepEqual(replacements, ["/auth/callback"]);
    assert.equal(sanitizedEvents, 1);
    assert.equal(hasSensitiveMeasurementLocation(browser.location.href), false);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }

  const callback = source("src", "app", "auth", "callback", "page.tsx");
  assert.ok(
    callback.indexOf("exchangeCodeForSession(code)") <
      callback.indexOf("sanitizeSensitiveMeasurementLocation()")
  );
  const payment = source("src", "app", "payment", "success", "page.tsx");
  assert.ok(
    payment.indexOf("if (!response?.ok)") <
      payment.indexOf("sanitizeSensitiveMeasurementLocation()")
  );
  assert.ok(
    payment.indexOf("sanitizeSensitiveMeasurementLocation()") <
      payment.indexOf("await trackPurchaseCompleted")
  );
});

test("programmatic auth redirects remain SPA-safe inside a measurement-free document", () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const replacements: string[] = [];
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: {
        href: "https://file.mgautotech.de/auth/callback",
        pathname: "/auth/callback",
        replace: (value: string) => replacements.push(value),
      },
    },
  });
  try {
    assert.equal(replacePrivateMeasurementDocument("/dashboard"), false);
    assert.deepEqual(replacements, []);
    assert.equal(replacePrivateMeasurementDocument("/register"), false);
    assert.equal(replacePrivateMeasurementDocument("https://example.test/admin"), false);
    assert.equal(replacements.length, 0);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("all programmatic auth exits guard private destinations before SPA replace", () => {
  for (const path of [
    ["src", "app", "register", "page.tsx"],
    ["src", "app", "login", "page.tsx"],
    ["src", "app", "auth", "callback", "page.tsx"],
    ["src", "app", "auth", "complete-profile", "page.tsx"],
    ["src", "components", "auth", "DeviceVerificationPanel.tsx"],
    ["src", "components", "auth", "RegistrationCountryBoundary.tsx"],
  ]) {
    const content = source(...path);
    assert.match(content, /replacePrivateMeasurementDocument/);
  }
  const callback = source("src", "app", "auth", "callback", "page.tsx");
  assert.match(callback, /if \(!replacePrivateMeasurementDocument\(next\)\) \{\s*router\.replace\(next\)/);
  const register = source("src", "app", "register", "page.tsx");
  assert.match(register, /if \(replacePrivateMeasurementDocument\(destination\)\) return;\s*router\.replace\(destination\)/);
  assert.match(register, /callbackDestination[\s\S]*?replacePrivateMeasurementDocument\(callbackDestination\)/);
  const completeProfile = source("src", "app", "auth", "complete-profile", "page.tsx");
  assert.match(completeProfile, /callbackDestination[\s\S]*?replacePrivateMeasurementDocument\(callbackDestination\)/);
  const request = source("src", "app", "new-request", "page.tsx");
  assert.match(request, /if \(!replacePrivateMeasurementDocument\("\/login\?verify_email=1"\)\) \{\s*router\.push/);
  assert.match(callback, /if \(!replacePrivateMeasurementDocument\("\/login"\)\) \{\s*router\.replace\("\/login"\)/);
  const login = source("src", "app", "login", "page.tsx");
  assert.match(login, /callbackDestination[\s\S]*?if \(!replacePrivateMeasurementDocument\(callbackDestination\)\) \{\s*router\.replace\(callbackDestination\)/);
});

test("paid-click classification is production/public/boolean-only and validates signal length", () => {
  for (const key of ["gclid", "dclid", "wbraid", "gbraid"]) {
    assert.equal(hasRecognizedAdClickSignal(`?${key}=click123`), true, key);
    assert.equal(hasRecognizedAdClickSignal(`?${key}=x`), false, `${key}:too-short`);
    assert.equal(
      hasRecognizedAdClickSignal(`?${key}=${"x".repeat(200)}`),
      true,
      `${key}:200`
    );
    assert.equal(hasRecognizedAdClickSignal(`?${key}=`), false, `${key}:empty`);
    assert.equal(
      hasRecognizedAdClickSignal(`?${key}=customer%40example.test`),
      false,
      `${key}:pii-like`
    );
    assert.equal(
      hasRecognizedAdClickSignal(`?${key}=opaque%2Funsafe`),
      false,
      `${key}:unsafe-character`
    );
    assert.equal(
      hasRecognizedAdClickSignal(`?${key}=${"x".repeat(201)}`),
      false,
      `${key}:oversized`
    );
  }
  assert.equal(hasRecognizedAdClickSignal("?utm_source=google&utm_medium=cpc"), false);
  for (const key of ["_gl", "gclid", "dclid", "wbraid", "gbraid"]) {
    assert.equal(hasProtectedAdsQueryKey(`?${key}=`), true, key);
  }
  assert.equal(
    isAdClickConsentLanding("https://file.mgautotech.de/services/stage-1?gclid=private-click-id"),
    true
  );
  assert.equal(
    isAdClickConsentLanding("http://file.mgautotech.de/services/stage-1?gclid=x"),
    false
  );
  assert.equal(
    isAdClickConsentLanding("https://www.file.mgautotech.de/services/stage-1?gclid=x"),
    false
  );
  assert.equal(
    isAdClickConsentLanding("https://file.mgautotech.de/dashboard?gclid=x"),
    false
  );
  assert.equal(
    isAdClickConsentLanding("https://file.mgautotech.de/services/stage-1?utm_source=google"),
    false
  );
  for (const path of [
    "/",
    "/en",
    "/tools/torque-power-calculator",
    "/widget",
  ]) {
    assert.equal(
      isAdClickConsentLanding(
        `https://file.mgautotech.de${path}?gclid=private-click-id`
      ),
      false,
      path
    );
  }
});

test("CTA destination classifier accepts only exact safe same-origin customer entry paths", () => {
  const landing = "https://file.mgautotech.de/services/stage-1?gclid=private";
  for (const destination of [
    "/register",
    "/login",
    "/new-request",
    "/new-request?intent=stage_1",
    "/new-request?intent=tcu_stage_1",
    "/login?redirect=%2Fdashboard%2Flog-analysis",
    "/register?redirect=%2Fnew-request%3Fintent%3Dstage_1",
  ]) {
    assert.equal(
      getAdClickConsentDestination(destination, landing),
      destination,
      destination
    );
  }

  for (const destination of [
    "https://example.com/register",
    "//example.com/login",
    "/register/extra",
    "/login#section",
    "/new-request?intent=unknown",
    "/new-request?intent=stage_1&intent=egr_off",
    "/new-request?repeat=11111111-1111-4111-8111-111111111111",
    "/register?next=%2Fdashboard",
    "/login?redirect=%2Fdashboard&extra=1",
    "/register?gclid=private",
    "/dashboard",
  ]) {
    assert.equal(getAdClickConsentDestination(destination, landing), null, destination);
  }

  for (const key of ["_gl", "gclid", "dclid", "wbraid", "gbraid"]) {
    const redirect = encodeURIComponent(`/new-request?${key}=private`);
    assert.equal(
      getAdClickConsentDestination(`/login?redirect=${redirect}`, landing),
      null,
      key
    );
  }
  assert.equal(
    getAdClickConsentDestination(
      "/register",
      "https://preview.example.test/services/stage-1?gclid=private"
    ),
    null
  );
});

test("safe same-origin navigation is classified without carrying the paid-click query", () => {
  const landing = "https://file.mgautotech.de/services/stage-1?gclid=private";
  for (const destination of ["/", "/about", "/services", "/#prices"]) {
    assert.deepEqual(getAdClickConsentNavigation(destination, landing), {
      destination,
      isConversionEntry: false,
      opensPrivacyInNewTab: false,
    });
  }
  assert.deepEqual(getAdClickConsentNavigation("/datenschutz", landing), {
    destination: "/datenschutz",
    isConversionEntry: false,
    opensPrivacyInNewTab: true,
  });
  assert.deepEqual(getAdClickConsentNavigation("/new-request?intent=stage_1", landing), {
    destination: "/new-request?intent=stage_1",
    isConversionEntry: true,
    opensPrivacyInNewTab: false,
  });

  for (const destination of [
    "#faq",
    "https://example.com/about",
    "//example.com/about",
    "/about?_gl=private",
    "/about?dclid=private",
    "javascript:void(0)",
  ]) {
    assert.equal(getAdClickConsentNavigation(destination, landing), null, destination);
  }
  assert.equal(
    getAdClickConsentNavigation(
      "/about",
      "https://file.mgautotech.de/services/stage-1?utm_source=google"
    ),
    null,
    "ordinary organic/public navigation must remain untouched"
  );
});

test("only unmodified same-tab primary clicks are interceptable", () => {
  const base = {
    button: 0,
    defaultPrevented: false,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    target: null,
    download: false,
  };
  assert.equal(isUnmodifiedSelfNavigation(base), true);
  assert.equal(isUnmodifiedSelfNavigation({ ...base, target: "_self" }), true);
  for (const changed of [
    { button: 1 },
    { defaultPrevented: true },
    { metaKey: true },
    { ctrlKey: true },
    { shiftKey: true },
    { altKey: true },
    { target: "_blank" },
    { download: true },
  ]) {
    assert.equal(isUnmodifiedSelfNavigation({ ...base, ...changed }), false);
  }
});

test("a pre-hydration paid public link enters the consent gate and still fails open once", () => {
  const currentHref =
    "https://file.mgautotech.de/services/stage-1?gclid=private";
  const navigations: string[] = [];
  let beginCalls = 0;
  assert.equal(consumePreHydrationAdClickNavigation({
    pendingDestination: "/services/stage-2",
    currentHref,
    begin: () => {
      beginCalls += 1;
      return true;
    },
    navigate: (destination) => navigations.push(destination),
  }), true);
  assert.equal(beginCalls, 1);
  assert.equal(navigations.length, 0);

  assert.equal(consumePreHydrationAdClickNavigation({
    pendingDestination: "/about",
    currentHref,
    begin: () => {
      beginCalls += 1;
      return false;
    },
    navigate: (destination) => navigations.push(destination),
  }), true);
  assert.equal(beginCalls, 2);
  assert.deepEqual(navigations, ["/about"]);

  for (const destination of [
    "https://example.com/services/stage-2",
    "/services/stage-2?gclid=private",
    "/services/stage-2?_gl=private",
  ]) {
    assert.equal(consumePreHydrationAdClickNavigation({
      pendingDestination: destination,
      currentHref,
      begin: () => {
        beginCalls += 1;
        return true;
      },
      navigate: (target) => navigations.push(target),
    }), false, destination);
  }
  assert.equal(consumePreHydrationAdClickNavigation({
    pendingDestination: "/datenschutz",
    currentHref,
    begin: () => {
      beginCalls += 1;
      return true;
    },
    navigate: (target) => navigations.push(target),
  }), false);
  assert.equal(beginCalls, 2);
  assert.deepEqual(navigations, ["/about"]);
});

test("the hydrated paid-click listener gates the first safe same-origin navigation", () => {
  const component = source("src", "components", "analytics", "PublicAnalytics.tsx");
  assert.match(
    component,
    /navigation\.opensPrivacyInNewTab[\s\S]*?controller\.begin\(navigation\.destination\)/
  );
  assert.doesNotMatch(component, /if \(!navigation\.isConversionEntry\) return/);
});

test("paid public navigation honors Necessary and Ads choices without copying the click id", async () => {
  const currentHref =
    "https://file.mgautotech.de/services/stage-1?gclid=private-click-id";
  const navigation = getAdClickConsentNavigation("/about", currentHref);
  assert.deepEqual(navigation, {
    destination: "/about",
    isConversionEntry: false,
    opensPrivacyInNewTab: false,
  });

  const necessary = controllerHarness();
  assert.equal(necessary.controller.begin(navigation?.destination ?? ""), true);
  assert.equal(necessary.controller.choose("necessary"), true);
  assert.deepEqual(necessary.events, [
    "persist:false:false",
    "navigate:/about",
  ]);
  assert.equal(
    necessary.events.some((entry) => entry === "config" || entry === "prepare"),
    false
  );

  const ready = deferred();
  const advertising = controllerHarness({ wait: () => ready.promise });
  assert.equal(advertising.controller.begin(navigation?.destination ?? ""), true);
  assert.equal(advertising.controller.choose("advertising"), true);
  await waitUntil(() => advertising.events.includes("prepare"));
  assert.deepEqual(advertising.events, [
    "persist:true:true",
    "config",
    "prepare",
  ]);
  ready.resolve();
  await waitUntil(() => advertising.events.includes("navigate:/about"));
  assert.equal(
    advertising.events.filter((entry) => entry === "navigate:/about").length,
    1
  );
  assert.doesNotMatch(JSON.stringify(advertising.events), /private-click-id/);
});

test("Necessary navigates immediately while Analytics waits for a bounded consented handoff", async () => {
  const necessary = controllerHarness();
  assert.equal(necessary.controller.begin("/register"), true);
  assert.equal(necessary.controller.choose("necessary"), true);
  assert.deepEqual(necessary.events, ["persist:false:false", "navigate:/register"]);

  const prepared = deferred();
  const analytics = controllerHarness({ prepare: () => prepared.promise });
  assert.equal(analytics.controller.begin("/register"), true);
  assert.equal(analytics.controller.choose("analytics"), true);
  await waitUntil(() => analytics.events.includes("prepare"));
  assert.deepEqual(analytics.events, ["persist:true:false", "config", "prepare"]);
  prepared.resolve();
  await waitUntil(() => analytics.events.includes("navigate:/register"));
  assert.deepEqual(analytics.events, [
    "persist:true:false",
    "config",
    "prepare",
    "navigate:/register",
  ]);
  assert.deepEqual(preferencesForAdClickConsentChoice("advertising"), {
    analytics: true,
    advertising: true,
  });
});

test("Ads choice orders update then config then readiness then one navigation", async () => {
  const ready = deferred();
  const { controller, events } = controllerHarness({ wait: () => ready.promise });
  assert.equal(controller.begin("/new-request?intent=stage_1"), true);
  assert.equal(controller.choose("advertising"), true);
  await waitUntil(() => events.includes("prepare"));
  assert.deepEqual(events, ["persist:true:true", "config", "prepare"]);
  assert.equal(controller.begin("/login"), true);
  assert.equal(controller.choose("advertising"), false);
  ready.resolve();
  await waitUntil(() => events.some((entry) => entry.startsWith("navigate:")));
  assert.deepEqual(events, [
    "persist:true:true",
    "config",
    "prepare",
    "navigate:/new-request?intent=stage_1",
  ]);
});

test("consented conversion CTA queues default, update, config, safe event, then navigates once on ACK", async () => {
  const event = buildPublicNavigationEvent(
    "/services/stage-1",
    "/new-request?intent=stage_1"
  );
  assert.equal(event?.name, "request_cta_click");
  assert.equal(event?.params.source_path, "/services/stage-1");
  assert.equal(event?.params.destination_path, "/new-request");
  assert.doesNotMatch(JSON.stringify(event), /intent|gclid|dclid|wbraid|gbraid|_gl/i);

  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const storage = new MemoryStorage();
  const browser = {
    localStorage: storage,
    crypto: globalThis.crypto,
    location: { pathname: "/services/stage-1" },
    dataLayer: [] as Array<IArguments | unknown[]>,
    dispatchEvent: () => true,
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value: browser });
  const navigations: string[] = [];

  try {
    const controller = createAdClickConsentGateController({
      readConsent: () => ({
        needsDecision: true,
        preferences: { analytics: false, advertising: false },
      }),
      persistConsent: (preferences) => writeMeasurementConsent(preferences),
      configureMeasurement: () => {
        initializeGoogleMeasurement({
          googleAnalyticsMeasurementId: "G-ABC1234567",
          googleAdsId: "AW-123456789",
          registrationLabel: "Register_123",
          requestLabel: "Request_123",
          purchaseLabel: "Purchase_123",
        });
      },
      prepareConsentedNavigation: (destination, _preferences, signal) =>
        dispatchPublicAnalyticsEventWithAck(
          buildPublicNavigationEvent("/services/stage-1", destination),
          { signal, timeoutMs: 100 }
        ),
      waitForAdsReady: async () => undefined,
      navigate: (destination) => { navigations.push(destination); },
      onPendingChange: () => undefined,
    });

    assert.equal(controller.begin("/new-request?intent=stage_1"), true);
    assert.equal(controller.choose("analytics"), true);
    assert.equal(controller.choose("analytics"), false);
    await waitUntil(() => browser.dataLayer.length >= 5);
    const commands = browser.dataLayer.map((entry) => Array.from(entry as IArguments));
    assert.deepEqual(commands.slice(0, 4).map((command) => command.slice(0, 2)), [
      ["consent", "default"],
      ["consent", "update"],
      ["js", commands[2][1]],
      ["config", "G-ABC1234567"],
    ]);
    assert.equal(commands[4][0], "event");
    assert.equal(commands[4][1], "request_cta_click");
    assert.deepEqual(navigations, []);
    const eventParams = commands[4][2] as { event_callback?: () => void };
    eventParams.event_callback?.();
    await waitUntil(() => navigations.length === 1);
    assert.deepEqual(navigations, ["/new-request?intent=stage_1"]);
    assert.equal(
      commands.filter((command) => command[0] === "event" && command[1] === "request_cta_click").length,
      1
    );

    const necessaryCommandsBefore = browser.dataLayer.length;
    const necessary = createAdClickConsentGateController({
      readConsent: () => ({
        needsDecision: true,
        preferences: { analytics: false, advertising: false },
      }),
      persistConsent: (preferences) => writeMeasurementConsent(preferences),
      configureMeasurement: () => assert.fail("Necessary must not configure measurement"),
      waitForAdsReady: async () => undefined,
      navigate: () => undefined,
      onPendingChange: () => undefined,
    });
    necessary.begin("/new-request?intent=stage_1");
    necessary.choose("necessary");
    assert.equal(browser.dataLayer.length, necessaryCommandsBefore + 1);
    const necessaryUpdate = Array.from(
      browser.dataLayer.at(-1) as IArguments
    );
    assert.deepEqual(necessaryUpdate.slice(0, 2), ["consent", "update"]);
    assert.equal(
      (necessaryUpdate[2] as { analytics_storage: string }).analytics_storage,
      "denied"
    );
  } finally {
    applyStoredMeasurementConsent({ analytics: false, advertising: false });
    notifyGoogleMeasurementScriptFailed();
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("saved customized Ads-only consent is preserved exactly while the CTA waits", async () => {
  const ready = deferred();
  const events: string[] = [];
  const controller = createAdClickConsentGateController({
    readConsent: () => ({
      needsDecision: false,
      preferences: { analytics: false, advertising: true },
    }),
    persistConsent: () => assert.fail("saved Ads-only consent must not be rewritten"),
    configureMeasurement: () => { events.push("config"); },
    waitForAdsReady: () => ready.promise,
    navigate: (destination) => { events.push(`navigate:${destination}`); },
    onPendingChange: () => undefined,
  });

  assert.equal(controller.begin("/register"), true);
  assert.deepEqual(events, ["config"]);
  ready.resolve();
  await waitUntil(() => events.includes("navigate:/register"));
  assert.deepEqual(events, ["config", "navigate:/register"]);
});

test("saved Ads consent holds a fast CTA until current-load readiness, even with an old linker key", async () => {
  let currentScriptAndConfigReady = false;
  const navigations: string[] = [];
  const storage = new MemoryStorage();
  storage.setItem("_gcl_ls", "old-private-linker-value");
  assert.equal(
    hasGoogleAdsLinkerState({ cookieHeader: "_gcl_aw=old-private-cookie-value", storage }),
    true
  );
  const controller = createAdClickConsentGateController({
    readConsent: () => ({
      needsDecision: false,
      preferences: { analytics: true, advertising: true },
    }),
    persistConsent: () => assert.fail("saved consent must not be rewritten"),
    configureMeasurement: () => undefined,
    waitForAdsReady: (signal) =>
      waitForGoogleAdsLinkerReady({
        signal,
        timeoutMs: 100,
        pollIntervalMs: 5,
        isReady: () =>
          currentScriptAndConfigReady &&
          hasGoogleAdsLinkerState({ cookieHeader: "_gcl_aw=old", storage }),
      }),
    navigate: (destination) => { navigations.push(destination); },
    onPendingChange: () => undefined,
  });
  assert.equal(controller.begin("/login"), true);
  await new Promise((resolve) => globalThis.setTimeout(resolve, 15));
  assert.deepEqual(navigations, []);
  currentScriptAndConfigReady = true;
  await new Promise((resolve) => globalThis.setTimeout(resolve, 15));
  assert.deepEqual(navigations, ["/login"]);
});

test("timeout fails open once, while cancel and dispose never navigate", async () => {
  const timeoutHarness = controllerHarness({
    wait: (signal) =>
      waitForGoogleAdsLinkerReady({
        signal,
        timeoutMs: 15,
        pollIntervalMs: 5,
        isReady: () => false,
      }),
  });
  timeoutHarness.controller.begin("/register");
  timeoutHarness.controller.choose("advertising");
  await new Promise((resolve) => globalThis.setTimeout(resolve, 30));
  assert.equal(
    timeoutHarness.events.filter((entry) => entry.startsWith("navigate:")).length,
    1
  );

  for (const stop of ["cancel", "dispose"] as const) {
    const ready = deferred();
    const harness = controllerHarness({ wait: () => ready.promise });
    harness.controller.begin("/register");
    harness.controller.choose("advertising");
    harness.controller[stop]();
    assert.deepEqual(harness.pending, ["/register", null], stop);
    ready.resolve();
    await ready.promise;
    await Promise.resolve();
    assert.equal(
      harness.events.some((entry) => entry.startsWith("navigate:")),
      false,
      stop
    );
  }
});

test("actual Ads readiness requires current script load, AW config and a post-config settling window", async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const browser = {
    localStorage: new MemoryStorage(),
    location: { hostname: "file.mgautotech.de", pathname: "/services/stage-1" },
    dataLayer: [] as Array<IArguments | unknown[]>,
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value: browser });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { cookie: "_gcl_aw=old-private-cookie-value" },
  });

  try {
    notifyGoogleMeasurementScriptFailed();
    writeMeasurementConsent({ analytics: true, advertising: true });
    initializeGoogleMeasurement({
      googleAnalyticsMeasurementId: "",
      googleAdsId: "AW-123456789",
      registrationLabel: "",
      requestLabel: "",
      purchaseLabel: "",
    });
    assert.equal(hasGoogleAdsLinkerState(), true);
    assert.equal(isGoogleAdsLinkerConfigurationReady("AW-123456789"), false);
    await notifyGoogleMeasurementScriptLoaded();
    assert.equal(isGoogleAdsLinkerConfigurationReady("AW-123456789"), false);
    assert.equal(
      isGoogleAdsLinkerConfigurationReady(
        "AW-123456789",
        Date.now() + googleAdsLinkerSettleMs + 1
      ),
      true
    );
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (previousDocument) Object.defineProperty(globalThis, "document", previousDocument);
    else Reflect.deleteProperty(globalThis, "document");
  }
});

test("pre-hydration timeout revalidates and completes the first click exactly once", () => {
  const componentSource = source(
    "src",
    "components",
    "analytics",
    "PaidClickPreHydrationGuard.tsx"
  );
  const script = componentSource.match(/String\.raw`([\s\S]*?)`;/)?.[1];
  assert.ok(script, "pre-hydration guard source must be extractable");

  let clickHandler: ((event: Record<string, unknown>) => void) | null = null;
  let timeoutHandler: (() => void) | null = null;
  const navigations: string[] = [];
  const fakeWindow = {
    location: {
      href: "https://file.mgautotech.de/services/stage-1?gclid=private-click-id",
      assign: (destination: string) => navigations.push(destination),
    },
    setTimeout: (callback: () => void) => {
      timeoutHandler = callback;
      return 1;
    },
    clearTimeout: () => undefined,
  } as Record<string, unknown> & {
    __mgPendingPaidClickDestination?: string;
  };
  const fakeDocument = {
    addEventListener: (
      type: string,
      handler: (event: Record<string, unknown>) => void
    ) => {
      if (type === "click") clickHandler = handler;
    },
    removeEventListener: () => undefined,
  };
  Function("window", "document", "URL", script)(fakeWindow, fakeDocument, URL);
  assert.ok(clickHandler);
  assert.ok(timeoutHandler);
  const runClickHandler = clickHandler as unknown as (
    event: Record<string, unknown>
  ) => void;
  const runTimeoutHandler = timeoutHandler as unknown as () => void;

  let prevented = 0;
  let stopped = 0;
  const anchor = {
    href: "https://file.mgautotech.de/register?source=stage-1",
    getAttribute: () => null,
    hasAttribute: () => false,
    setAttribute: () => undefined,
  };
  runClickHandler({
    button: 0,
    defaultPrevented: false,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    target: { closest: () => anchor },
    preventDefault: () => { prevented += 1; },
    stopImmediatePropagation: () => { stopped += 1; },
  });
  assert.equal(fakeWindow.__mgPendingPaidClickDestination, "/register?source=stage-1");
  assert.doesNotMatch(
    fakeWindow.__mgPendingPaidClickDestination ?? "",
    /private-click-id|gclid/i
  );
  runTimeoutHandler();
  runTimeoutHandler();
  assert.deepEqual(navigations, ["/register?source=stage-1"]);
  assert.equal(fakeWindow.__mgPendingPaidClickDestination, undefined);
  assert.equal(prevented, 1);
  assert.equal(stopped, 1);
});

test("pre-hydration guard ignores malformed signals and input-heavy public routes", () => {
  const componentSource = source(
    "src",
    "components",
    "analytics",
    "PaidClickPreHydrationGuard.tsx"
  );
  const script = componentSource.match(/String\.raw`([\s\S]*?)`;/)?.[1];
  assert.ok(script, "pre-hydration guard source must be extractable");

  const installsGuard = (href: string) => {
    let clickListeners = 0;
    let timers = 0;
    const fakeWindow = {
      location: { href, assign: () => undefined },
      setTimeout: () => {
        timers += 1;
        return 1;
      },
      clearTimeout: () => undefined,
    };
    const fakeDocument = {
      addEventListener: (type: string) => {
        if (type === "click") clickListeners += 1;
      },
      removeEventListener: () => undefined,
    };
    Function("window", "document", "URL", script)(
      fakeWindow,
      fakeDocument,
      URL
    );
    return { clickListeners, timers };
  };

  assert.deepEqual(
    installsGuard(
      "https://file.mgautotech.de/services/stage-1?gclid=private-click-id"
    ),
    { clickListeners: 1, timers: 1 }
  );
  assert.deepEqual(
    installsGuard(
      "https://file.mgautotech.de/de/services/stage-1?gclid=private-click-id"
    ),
    { clickListeners: 1, timers: 1 }
  );
  for (const href of [
    "https://file.mgautotech.de/services/stage-1?gclid=customer%40example.test",
    "https://file.mgautotech.de/services/alice_smith_customer?gclid=private-click-id",
    "https://file.mgautotech.de/services/stage-1/private-account?gclid=private-click-id",
    "https://file.mgautotech.de/about/alice_smith_customer?gclid=private-click-id",
    "https://file.mgautotech.de/brands/not-a-brand?gclid=private-click-id",
    "https://file.mgautotech.de/de/services/stage-2?gclid=private-click-id",
    "https://file.mgautotech.de/de/brands/bmw?gclid=private-click-id",
    "https://file.mgautotech.de/?gclid=private-click-id",
    "https://file.mgautotech.de/en?gclid=private-click-id",
    "https://file.mgautotech.de/tools/torque-power-calculator?gclid=private-click-id",
    "https://file.mgautotech.de/widget?gclid=private-click-id",
  ]) {
    assert.deepEqual(
      installsGuard(href),
      { clickListeners: 0, timers: 0 },
      href
    );
  }
});

test("CTA gate stores no click id, performs no network work and keeps private measurement disabled", () => {
  const gate = source("src", "lib", "adClickConsentGate.ts");
  const analytics = source("src", "lib", "publicAnalytics.ts");
  const component = source("src", "components", "analytics", "PublicAnalytics.tsx");
  const preHydrationGuard = source("src", "components", "analytics", "PaidClickPreHydrationGuard.tsx");
  const rootLayout = source("src", "app", "layout.tsx");
  const privateClickId = "private-click-id-must-never-persist";
  assert.equal(
    isAdClickConsentLanding(
      `https://file.mgautotech.de/services/stage-1?gclid=${privateClickId}`
    ),
    true
  );
  assert.doesNotMatch(gate, /fetch\(|recordGrowth|setItem\(|sendBeacon|passthrough|url_passthrough/i);
  assert.match(component, /document\.addEventListener\("click", interceptAdClickNavigation, true\)/);
  assert.match(component, /__mgReleasePaidClickHydrationGuard/);
  assert.match(rootLayout, /<PaidClickPreHydrationGuard \/>[\s\S]*?\{children\}/);
  assert.match(preHydrationGuard, /document\.addEventListener\(\"click\",block,true\)/);
  assert.match(preHydrationGuard, /e\.preventDefault\(\);e\.stopImmediatePropagation\(\)/);
  assert.match(preHydrationGuard, /setTimeout\(function\(\)\{release\(\);navigatePending\(\)\},2500\)/);
  assert.match(preHydrationGuard, /window\.__mgPendingPaidClickDestination=local/);
  assert.match(component, /pendingPreHydrationDestination[\s\S]*?consumePreHydrationAdClickNavigation/);
  assert.match(component, /!configured[\s\S]*?pendingDestination[\s\S]*?consumePreHydrationAdClickNavigation/);
  assert.match(
    component,
    /!publicRoute \|\|[\s\S]*?!googleMeasurementRouteAllowed \|\|[\s\S]*?!paidClickLanding/
  );
  assert.match(
    component,
    /setPaidClickLanding\([\s\S]*?isGoogleMeasurementScriptPath\(window\.location\.pathname\)[\s\S]*?isAdClickConsentLanding/
  );
  assert.doesNotMatch(preHydrationGuard, /localStorage|sessionStorage|document\.cookie|fetch\(/);
  assert.match(component, /isUnmodifiedSelfNavigation\([\s\S]*?getAdClickConsentNavigation\(/);
  assert.match(component, /event\.preventDefault\(\)/);
  assert.match(component, /event\.preventDefault\(\)[\s\S]*?event\.stopPropagation\(\)/);
  assert.ok(
    component.indexOf('document.addEventListener("click", trackClick') <
      component.indexOf('document.addEventListener("click", forcePrivateDocumentNavigation'),
    "the sanitized CTA observer must register before the fresh-document guard"
  );
  assert.match(component, /event\.key === "Escape"[\s\S]*?\.cancel\(\)/);
  assert.match(component, /backgroundElements[\s\S]*?element\.inert = true[\s\S]*?aria-hidden[\s\S]*?element\.inert = inert/);
  assert.match(component, /href="\/datenschutz"[\s\S]*?target="_blank"[\s\S]*?rel="noopener noreferrer"/);
  assert.match(component, /href="\/datenschutz"[\s\S]*?target="_blank"[\s\S]*?referrerPolicy="no-referrer"/);
  assert.match(component, /aria-label=\{`\$\{consentCopy\.privacyInformation\} \(\$\{consentCopy\.opensInNewTab\}\)`\}/);
  assert.match(component, /navigation\.opensPrivacyInNewTab[\s\S]*?anchor\.setAttribute\("target", "_blank"\)[\s\S]*?return/);
  assert.match(component, /target=\{paidClickLanding \? "_blank" : undefined\}[\s\S]*?rel=\{paidClickLanding \? "noopener noreferrer" : undefined\}/);
  assert.match(component, /\["necessary", consentCopy\.necessaryOnly\][\s\S]*?\["analytics", consentCopy\.analyticsOnly\][\s\S]*?\["advertising", consentCopy\.acceptAll\][\s\S]*?\.map/);
  assert.equal((component.match(/data-ad-click-consent-choice=/g) ?? []).length, 1);
  assert.equal((component.match(/className=\{immediateConsentChoiceClassName\}/g) ?? []).length, 3);
  assert.match(
    component,
    /max-h-\[calc\(100dvh-2rem\)\][^"\n]*overflow-y-auto[^"\n]*overscroll-contain/
  );
  assert.match(
    component,
    /max-h-\[calc\(100dvh-1\.5rem\)\][^"\n]*overflow-y-auto[^"\n]*overscroll-contain/
  );
  assert.match(component, /window\.addEventListener\("storage", synchronizeCrossTabConsent\)/);
  assert.match(component, /synchronizeCrossTabConsent[\s\S]*?applyStoredMeasurementConsent\(snapshot\.preferences\)[\s\S]*?setConsent\(snapshot\)/);
  assert.match(component, /readConsent: \(\) => \{[\s\S]*?setConsent\(snapshot\)[\s\S]*?return snapshot/);
  assert.match(component, /configureMeasurement:[\s\S]*?initializeGoogleMeasurement\(configuration\)/);
  assert.match(component, /prepareConsentedNavigation:[\s\S]*?buildPublicNavigationEvent\(pathname, destination\)[\s\S]*?dispatchPublicAnalyticsEventWithAck/);
  assert.match(component, /acknowledged[\s\S]*?reportMeasurementHandoffFailure\("attribution_handoff"\)/);
  assert.match(component, /result === "timeout"[\s\S]*?reportMeasurementHandoffFailure\("ads_linker"\)/);
  assert.match(component, /measurementReady && scriptId && googleMeasurementRouteAllowed/);
  assert.match(component, /!preferencesOpen[\s\S]*?!showAdClickConsentGate/);
  assert.doesNotMatch(component, /analyticsRouteAllowed && consent !== "loading" && !consent\.needsDecision/);
  assert.match(analytics, /isGoogleMeasurementScriptPath\(window\.location\.pathname\)[\s\S]*?flushPendingVerifiedConversions/);
  assert.match(analytics, /dispatchVerifiedConversionById[\s\S]*?!isGoogleMeasurementScriptPath\(window\.location\.pathname\)/);
  assert.match(analytics, /clearGoogleAdsConversionOutbox[\s\S]*?adsDedupePrefix[\s\S]*?clearGoogleAdsConversionRetry/);
  assert.doesNotMatch(JSON.stringify(preferencesForAdClickConsentChoice("advertising")), new RegExp(privateClickId));
  assert.equal(new MemoryStorage().getItem(measurementConsentStorageKey), null);
});

test("private-route withdrawal clears Ads state without private measurement", () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const storage = new MemoryStorage();
  storage.setItem(
    measurementConsentStorageKey,
    JSON.stringify({
      analytics: false,
      advertising: true,
      version: 2,
      updatedAt: new Date().toISOString(),
    })
  );
  storage.setItem(
    googleAdsConversionOutboxStorageKey,
    JSON.stringify([{ version: 1, name: "registration", transactionId: "opaque", createdAt: Date.now() }])
  );
  storage.setItem("mg_verified_conversion_v1:ads:registration:opaque", String(Date.now()));
  storage.setItem("mg_verified_conversion_v1:ga4:registration:opaque", "1");
  storage.setItem("_ga", "google-managed-state");
  storage.setItem(googleAdsLinkerStorageKey, "google-managed-linker-state");
  const browser = {
    localStorage: storage,
    location: { pathname: "/dashboard" },
    dataLayer: [] as unknown[],
    dispatchEvent: () => true,
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value: browser });

  try {
    writeMeasurementConsent({ analytics: false, advertising: false });
    const stored = JSON.parse(storage.getItem(measurementConsentStorageKey) ?? "null");
    assert.equal(stored.analytics, false);
    assert.equal(stored.advertising, false);
    assert.equal(storage.getItem(googleAdsConversionOutboxStorageKey), null);
    assert.equal(storage.getItem("mg_verified_conversion_v1:ads:registration:opaque"), null);
    assert.equal(storage.getItem("mg_verified_conversion_v1:ga4:registration:opaque"), null);
    assert.equal(storage.getItem("_ga"), "google-managed-state");
    assert.equal(storage.getItem(googleAdsLinkerStorageKey), null);
    assert.equal(
      hasGoogleAdsLinkerState({
        cookieHeader: "",
        storage,
      }),
      false
    );
    const consentCommands = browser.dataLayer.map((entry) => Array.from(entry as IArguments));
    assert.equal(consentCommands.length, 2);
    assert.deepEqual(consentCommands.map((command) => command.slice(0, 2)), [
      ["consent", "default"],
      ["consent", "update"],
    ]);
    assert.deepEqual(consentCommands[1][2], {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      functionality_storage: "denied",
      security_storage: "denied",
    });
    assert.equal(consentCommands.some((command) => command[0] === "config" || command[0] === "event"), false);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("an unremovable Ads linker state remains fail-closed across a fresh document", () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const localStorage = new LinkerMutationBlockedStorage(
    "stale-google-managed-linker-state"
  );
  const sessionStorage = new MemoryStorage();
  const makeBrowser = (session: MemoryStorage) => ({
    localStorage,
    sessionStorage: session,
    location: { pathname: "/dashboard" },
    dataLayer: [] as unknown[],
    dispatchEvent: () => true,
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: makeBrowser(sessionStorage),
  });

  try {
    writeMeasurementConsent({ analytics: false, advertising: false });
    assert.equal(
      localStorage.getItem(googleAdsLinkerStorageKey),
      "stale-google-managed-linker-state"
    );
    assert.equal(
      localStorage.getItem(googleAdsLinkerRevocationStorageKey),
      "1"
    );
    assert.equal(
      sessionStorage.getItem(googleAdsLinkerRevocationStorageKey),
      "1"
    );
    assert.equal(
      hasGoogleAdsLinkerState({
        cookieHeader: "_gcl_aw=stale-google-cookie",
        storage: localStorage,
      }),
      false
    );

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: makeBrowser(new MemoryStorage()),
    });
    assert.equal(
      hasGoogleAdsLinkerState({
        cookieHeader: "_gcl_aw=stale-google-cookie",
        storage: localStorage,
      }),
      false,
      "the local revocation marker must survive a fresh tab/session"
    );
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("same-tab partial withdrawal immediately denies Analytics and preserves consented Ads recovery", () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const storage = new MemoryStorage();
  const id = "a".repeat(64);
  storage.setItem(`mg_verified_conversion_v1:ga4:registration:${id}`, "1");
  storage.setItem(`mg_verified_conversion_v1:ads:registration:${id}`, String(Date.now()));
  storage.setItem(
    googleAdsConversionOutboxStorageKey,
    JSON.stringify([{ version: 1, name: "registration", transactionId: id, createdAt: Date.now() }])
  );
  const browser = {
    localStorage: storage,
    location: { pathname: "/dashboard" },
    dataLayer: [] as Array<IArguments | unknown[]>,
    dispatchEvent: () => true,
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value: browser });

  try {
    writeMeasurementConsent({ analytics: false, advertising: true });
    assert.equal(storage.getItem(`mg_verified_conversion_v1:ga4:registration:${id}`), null);
    assert.notEqual(storage.getItem(`mg_verified_conversion_v1:ads:registration:${id}`), null);
    assert.notEqual(storage.getItem(googleAdsConversionOutboxStorageKey), null);

    const commands = browser.dataLayer.map((entry) => Array.from(entry as IArguments));
    assert.deepEqual(commands.at(-1)?.slice(0, 2), ["consent", "update"]);
    assert.deepEqual(commands.at(-1)?.[2], {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      functionality_storage: "denied",
      security_storage: "denied",
    });
    assert.equal(commands.some((command) => command[0] === "config" || command[0] === "event"), false);
  } finally {
    applyStoredMeasurementConsent({ analytics: false, advertising: false });
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("cross-tab partial withdrawal immediately denies Ads and preserves consented Analytics markers", () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const storage = new MemoryStorage();
  const id = "b".repeat(64);
  storage.setItem(`mg_verified_conversion_v1:ga4:request:${id}`, "1");
  storage.setItem(`mg_verified_conversion_v1:ads:request:${id}`, String(Date.now()));
  storage.setItem(
    googleAdsConversionOutboxStorageKey,
    JSON.stringify([{ version: 1, name: "request", transactionId: id, createdAt: Date.now() }])
  );
  const browser = {
    localStorage: storage,
    location: { pathname: "/dashboard" },
    dataLayer: [] as Array<IArguments | unknown[]>,
    dispatchEvent: () => true,
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value: browser });

  try {
    applyStoredMeasurementConsent({ analytics: true, advertising: false });
    assert.notEqual(storage.getItem(`mg_verified_conversion_v1:ga4:request:${id}`), null);
    assert.equal(storage.getItem(`mg_verified_conversion_v1:ads:request:${id}`), null);
    assert.equal(storage.getItem(googleAdsConversionOutboxStorageKey), null);

    const commands = browser.dataLayer.map((entry) => Array.from(entry as IArguments));
    assert.deepEqual(commands.at(-1)?.slice(0, 2), ["consent", "update"]);
    assert.deepEqual(commands.at(-1)?.[2], {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      functionality_storage: "denied",
      security_storage: "denied",
    });
    assert.equal(commands.some((command) => command[0] === "config" || command[0] === "event"), false);
  } finally {
    applyStoredMeasurementConsent({ analytics: false, advertising: false });
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("a cross-tab grant on a private route remains process-locally denied", () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const browser = {
    localStorage: new MemoryStorage(),
    location: { pathname: "/dashboard" },
    dataLayer: [] as Array<IArguments | unknown[]>,
    dispatchEvent: () => true,
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value: browser });
  try {
    applyStoredMeasurementConsent({ analytics: true, advertising: true });
    const commands = browser.dataLayer.map((entry) => Array.from(entry as IArguments));
    assert.deepEqual(commands.at(-1)?.slice(0, 2), ["consent", "update"]);
    assert.deepEqual(commands.at(-1)?.[2], {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      functionality_storage: "denied",
      security_storage: "denied",
    });
    assert.equal(commands.some((command) => command[0] === "config" || command[0] === "event"), false);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("a cross-tab v2 removal overrides this tab's stale session grant", () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  const oldGrant = JSON.stringify({
    analytics: true,
    advertising: true,
    version: "consent-mode-v2",
    updatedAt: "2026-08-27T10:00:00.000Z",
  });
  sessionStorage.setItem(measurementConsentSessionStorageKey, oldGrant);
  const browser = {
    localStorage,
    sessionStorage,
    crypto: globalThis.crypto,
    location: { pathname: "/measurement/complete" },
    dataLayer: [] as Array<IArguments | unknown[]>,
    dispatchEvent: () => true,
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: browser,
  });
  try {
    const snapshot = applyExternalMeasurementConsentChange(null);
    applyStoredMeasurementConsent(snapshot.preferences);
    assert.equal(snapshot.needsDecision, false);
    assert.equal(snapshot.preferences.analytics, false);
    assert.equal(snapshot.preferences.advertising, false);
    const sessionChoice = JSON.parse(
      sessionStorage.getItem(measurementConsentSessionStorageKey) ?? "{}"
    ) as { analytics?: boolean; advertising?: boolean };
    assert.equal(sessionChoice.analytics, false);
    assert.equal(sessionChoice.advertising, false);
    const lastConsent = browser.dataLayer
      .map((entry) => Array.from(entry as IArguments))
      .filter((entry) => entry[0] === "consent" && entry[1] === "update")
      .at(-1)?.[2] as { analytics_storage?: string; ad_storage?: string };
    assert.equal(lastConsent.analytics_storage, "denied");
    assert.equal(lastConsent.ad_storage, "denied");
  } finally {
    applyStoredMeasurementConsent({ analytics: false, advertising: false });
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("cross-tab revoke clears process-local pending work so a later regrant cannot resurrect it", async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const storage = new MemoryStorage();
  const browser = {
    localStorage: storage,
    crypto: globalThis.crypto,
    location: { pathname: "/new-request" },
    dataLayer: [] as Array<IArguments | unknown[]>,
    dispatchEvent: () => true,
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value: browser });
  const storeConsent = (analytics: boolean, advertising: boolean) => {
    storage.setItem(measurementConsentStorageKey, JSON.stringify({
      analytics,
      advertising,
      version: "consent-mode-v2",
      updatedAt: new Date().toISOString(),
    }));
  };

  try {
    notifyGoogleMeasurementScriptFailed();
    assert.equal(await trackRequestSubmitted("cross-tab-pending-request"), false);

    storeConsent(false, true);
    // A private request document may queue verified work, but only a fresh
    // measurement-completion document is allowed to configure or dispatch Google.
    browser.location.pathname = "/measurement/complete";
    initializeGoogleMeasurement({
      googleAnalyticsMeasurementId: "G-ABC1234567",
      googleAdsId: "AW-123456789",
      registrationLabel: "Register_123",
      requestLabel: "Request_123",
      purchaseLabel: "Purchase_123",
    });
    await notifyGoogleMeasurementScriptLoaded();
    await new Promise((resolve) =>
      globalThis.setTimeout(resolve, googleAdsLinkerSettleMs + 5)
    );
    const adsDelivery = trackRequestSubmitted("cross-tab-ads-outbox-request");
    await waitUntil(() => browser.dataLayer.some((entry) => {
      const command = Array.from(entry as IArguments);
      return command[0] === "event" && command[1] === "conversion";
    }));
    assert.notEqual(storage.getItem(googleAdsConversionOutboxStorageKey), null);
    notifyGoogleMeasurementScriptFailed();
    assert.equal(await adsDelivery, false);
    storage.setItem("mg_verified_conversion_v1:ads:request:opaque", String(Date.now()));
    storage.setItem("mg_verified_conversion_v1:ga4:request:opaque", "1");
    const conversionEventsBeforeRevoke = browser.dataLayer
      .map((entry) => Array.from(entry as IArguments))
      .filter((command) => command[0] === "event" && command[1] === "conversion")
      .length;

    browser.location.pathname = "/new-request";
    storeConsent(false, false);
    applyStoredMeasurementConsent({ analytics: false, advertising: false });
    assert.equal(storage.getItem(googleAdsConversionOutboxStorageKey), null);
    assert.equal(storage.getItem("mg_verified_conversion_v1:ads:request:opaque"), null);
    assert.equal(storage.getItem("mg_verified_conversion_v1:ga4:request:opaque"), null);

    storeConsent(false, true);
    assert.equal(await flushPendingVerifiedConversions(), 0);
    assert.equal(await notifyGoogleMeasurementScriptLoaded(), 0);
    assert.equal(await flushGoogleAdsConversionOutbox(), 0);
    const conversionEventsAfterRegrant = browser.dataLayer
      .map((entry) => Array.from(entry as IArguments))
      .filter((command) => command[0] === "event" && command[1] === "conversion")
      .length;
    assert.equal(conversionEventsAfterRegrant, conversionEventsBeforeRevoke);
  } finally {
    applyStoredMeasurementConsent({ analytics: false, advertising: false });
    notifyGoogleMeasurementScriptFailed();
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
