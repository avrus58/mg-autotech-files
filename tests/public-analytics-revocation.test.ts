import assert from "node:assert/strict";
import test from "node:test";

class MemoryStorage {
  protected readonly values = new Map<string, string>();

  get length() { return this.values.size; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
}

class SelectivelyUnwritableStorage extends MemoryStorage {
  private readonly blockedKeys = new Set<string>();

  block(key: string) { this.blockedKeys.add(key); }

  override setItem(key: string, value: string) {
    if (this.blockedKeys.has(key)) throw new Error("blocked storage write");
    super.setItem(key, value);
  }

  override removeItem(key: string) {
    if (this.blockedKeys.has(key)) throw new Error("blocked storage removal");
    super.removeItem(key);
  }
}

type TestLocation = {
  href: string;
  hostname: string;
  pathname: string;
  search: string;
  replace: (destination: string) => void;
};

type TestWindow = EventTarget & {
  localStorage: MemoryStorage;
  sessionStorage: MemoryStorage;
  location: TestLocation;
  dataLayer?: Array<IArguments | unknown[]>;
  gtag?: (...args: unknown[]) => void;
  __mgConfiguredGoogleTags?: string[];
};

class TestDocument extends EventTarget {
  readonly cookieWrites: string[] = [];

  constructor(private readonly visibleCookies: string) {
    super();
  }

  get cookie() { return this.visibleCookies; }
  set cookie(value: string) { this.cookieWrites.push(value); }
}

function browserWindow(
  localStorage: MemoryStorage,
  sessionStorage: MemoryStorage,
  replacements: string[]
) {
  const browser = new EventTarget() as TestWindow;
  browser.localStorage = localStorage;
  browser.sessionStorage = sessionStorage;
  browser.location = {
    href: "https://file.mgautotech.de/services/stage-1?gclid=paid#details",
    hostname: "file.mgautotech.de",
    pathname: "/services/stage-1",
    search: "?gclid=paid",
    replace: (destination) => replacements.push(destination),
  };
  return browser;
}

function commandTuples(dataLayer: Array<IArguments | unknown[]> | undefined) {
  return (dataLayer ?? []).map((entry) => Array.from(entry as ArrayLike<unknown>));
}

function pendingEntry(input: {
  transactionId: string;
  createdAt: number;
  analyticsState: "pending" | "complete" | "excluded";
  advertisingState: "pending" | "complete" | "excluded";
}) {
  return {
    version: 2,
    name: "request",
    ...input,
  };
}

test("consent withdrawal reloads cleanly and revocation survives stale durable queues", async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const localStorage = new SelectivelyUnwritableStorage();
  const sessionStorage = new MemoryStorage();
  const replacements: string[] = [];
  let browser = browserWindow(localStorage, sessionStorage, replacements);
  const cookieSource = [
    "_ga=analytics",
    "_ga_STREAM=analytics-stream",
    "_gid=analytics-id",
    "_gat=analytics-rate",
    "_gcl_au=ads-linker",
    "_gac_STREAM=ads-campaign",
    "FPLC=ads-first-party",
    "FPGCLAW=ads-click",
    "sb-auth-token=necessary-auth",
    "mg_necessary=necessary",
  ].join("; ");
  let documentTarget = new TestDocument(cookieSource);

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: browser,
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: documentTarget,
  });

  try {
    const analytics = await import("../src/lib/publicAnalytics");
    const configuration = {
      googleAnalyticsMeasurementId: "G-ABC1234567",
      googleAdsId: "AW-123456789",
      registrationLabel: "Register_123",
      requestLabel: "Request_123",
      purchaseLabel: "Purchase_123",
    };

    analytics.writeMeasurementConsent({ analytics: false, advertising: false });
    const deniedUpdate = commandTuples(browser.dataLayer).find(
      (command) => command[0] === "consent" && command[1] === "update"
    );
    assert.deepEqual(
      {
        functionality_storage: (deniedUpdate?.[2] as Record<string, unknown>)
          ?.functionality_storage,
        security_storage: (deniedUpdate?.[2] as Record<string, unknown>)
          ?.security_storage,
      },
      { functionality_storage: "denied", security_storage: "denied" }
    );

    const granted = analytics.writeMeasurementConsent({
      analytics: true,
      advertising: true,
    });
    assert.ok(granted);
    assert.equal(analytics.initializeGoogleMeasurement(configuration), true);
    await analytics.notifyGoogleMeasurementScriptLoaded();

    const analyticsOnly = analytics.writeMeasurementConsent({
      analytics: true,
      advertising: false,
    });
    assert.ok(analyticsOnly);
    assert.equal(
      analytics.replaceGoogleMeasurementDocumentAfterConsentWithdrawal(
        granted,
        analyticsOnly
      ),
      true
    );
    assert.deepEqual(replacements, ["/services/stage-1"]);
    const advertisingCookieWrites = documentTarget.cookieWrites.join("\n");
    assert.match(advertisingCookieWrites, /_gcl_au=/);
    assert.match(advertisingCookieWrites, /_gac_STREAM=/);
    assert.match(advertisingCookieWrites, /FPLC=/);
    assert.match(advertisingCookieWrites, /FPGCLAW=/);
    assert.doesNotMatch(advertisingCookieWrites, /(?:^|\n)_ga=/);
    assert.doesNotMatch(advertisingCookieWrites, /sb-auth-token|mg_necessary/);
    assert.match(advertisingCookieWrites, /Path=\/services\/stage-1/);
    assert.match(advertisingCookieWrites, /Domain=\.mgautotech\.de/);

    await new Promise((resolve) => globalThis.setTimeout(resolve, 2));
    const createdAt = Date.now();
    const fullyTerminalId = "a".repeat(64);
    const partiallyPendingId = "b".repeat(64);
    localStorage.setItem(
      analytics.pendingVerifiedConversionStorageKey,
      JSON.stringify([
        pendingEntry({
          transactionId: fullyTerminalId,
          createdAt,
          analyticsState: "pending",
          advertisingState: "pending",
        }),
        pendingEntry({
          transactionId: partiallyPendingId,
          createdAt,
          analyticsState: "pending",
          advertisingState: "pending",
        }),
      ])
    );
    sessionStorage.setItem(
      analytics.pendingVerifiedConversionStorageKey,
      JSON.stringify([
        pendingEntry({
          transactionId: fullyTerminalId,
          createdAt,
          analyticsState: "complete",
          advertisingState: "excluded",
        }),
        pendingEntry({
          transactionId: partiallyPendingId,
          createdAt,
          analyticsState: "pending",
          advertisingState: "excluded",
        }),
      ])
    );
    assert.equal(analytics.pendingVerifiedConversionCount(), 1);
    const conservativelyMerged = JSON.parse(
      sessionStorage.getItem(analytics.pendingVerifiedConversionStorageKey) ?? "[]"
    ) as Array<{ transactionId: string; analyticsState: string; advertisingState: string }>;
    assert.deepEqual(
      conservativelyMerged.find((entry) => entry.transactionId === fullyTerminalId),
      {
        version: 2,
        name: "request",
        transactionId: fullyTerminalId,
        createdAt,
        analyticsState: "complete",
        advertisingState: "excluded",
      }
    );
    assert.equal(
      conservativelyMerged.find((entry) => entry.transactionId === partiallyPendingId)
        ?.advertisingState,
      "excluded"
    );

    await new Promise((resolve) => globalThis.setTimeout(resolve, 2));
    const outboxTransactionId = "c".repeat(64);
    localStorage.setItem(
      analytics.googleAdsConversionOutboxStorageKey,
      JSON.stringify([{
        version: 1,
        name: "request",
        transactionId: outboxTransactionId,
        createdAt: Date.now(),
      }])
    );
    const adsDedupeKey =
      `mg_verified_conversion_v1:ads:request:${outboxTransactionId}`;
    localStorage.setItem(adsDedupeKey, String(Date.now()));
    localStorage.block(analytics.pendingVerifiedConversionStorageKey);
    localStorage.block(analytics.googleAdsConversionOutboxStorageKey);

    const necessaryOnly = analytics.writeMeasurementConsent({
      analytics: false,
      advertising: false,
    });
    assert.ok(necessaryOnly);
    assert.notEqual(
      localStorage.getItem(analytics.pendingVerifiedConversionStorageKey),
      null,
      "the fixture must preserve the stale local pending payload"
    );
    assert.notEqual(
      localStorage.getItem(analytics.googleAdsConversionOutboxStorageKey),
      null,
      "the fixture must preserve the stale local Ads outbox"
    );
    assert.equal(
      localStorage.getItem(adsDedupeKey),
      null,
      "an outbox removal failure must not skip Ads dedupe cleanup"
    );
    assert.equal(
      analytics.replaceGoogleMeasurementDocumentAfterConsentWithdrawal(
        analyticsOnly,
        necessaryOnly
      ),
      true
    );
    assert.deepEqual(replacements, ["/services/stage-1", "/services/stage-1"]);
    const allCookieWrites = documentTarget.cookieWrites.join("\n");
    assert.match(allCookieWrites, /(?:^|\n)_ga=/);
    assert.match(allCookieWrites, /(?:^|\n)_gid=/);
    assert.match(allCookieWrites, /(?:^|\n)_gat=/);
    assert.doesNotMatch(allCookieWrites, /sb-auth-token|mg_necessary/);

    const freshSessionStorage = new MemoryStorage();
    browser = browserWindow(localStorage, freshSessionStorage, replacements);
    documentTarget = new TestDocument(cookieSource);
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: browser,
    });
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: documentTarget,
    });

    assert.equal(
      analytics.pendingVerifiedConversionCount(),
      0,
      "the local revocation epoch must retire stale rows in a fresh document and session"
    );
    analytics.writeMeasurementConsent({ analytics: true, advertising: true });
    assert.equal(analytics.initializeGoogleMeasurement(configuration), true);
    await analytics.notifyGoogleMeasurementScriptLoaded();
    await new Promise((resolve) =>
      globalThis.setTimeout(resolve, analytics.googleAdsLinkerSettleMs + 10)
    );
    assert.equal(await analytics.flushGoogleAdsConversionOutbox(), 0);
    assert.equal(
      commandTuples(browser.dataLayer).filter(
        (command) => command[0] === "event" && command[1] === "conversion"
      ).length,
      0,
      "a stale unremovable Ads row must not rehydrate after reload and regrant"
    );
    assert.equal(analytics.pendingVerifiedConversionCount(), 0);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (previousDocument) Object.defineProperty(globalThis, "document", previousDocument);
    else Reflect.deleteProperty(globalThis, "document");
  }
});
