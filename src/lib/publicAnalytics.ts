import {
  isGoogleMeasurementPath,
  replaceWithMeasurementCompletion,
} from "@/lib/measurementCompletion";
import { runWithGa4ConversionClaim } from "@/lib/ga4ConversionClaim";

export const googleAnalyticsMeasurementIdPattern = /^G-[A-Z0-9]{6,14}$/;
export const googleAdsIdPattern = /^AW-\d{6,15}$/;
export const googleAdsConversionLabelPattern = /^[A-Za-z0-9_-]{6,40}$/;
export const googleAdsClickSignalValuePattern = /^[A-Za-z0-9_-]{6,200}$/;
export const analyticsConsentStorageKey = "mg_analytics_consent_v1";
export const measurementConsentStorageKey = "mg_measurement_consent_v2";
export const measurementConsentSessionStorageKey =
  "mg_measurement_consent_session_v2";
// Consent Mode remains v2, while this separate disclosure version forces a
// fresh decision after a material change to the privacy information. Older
// denials stay denied; an older optional grant is never carried forward.
export const measurementConsentDisclosureVersion = "privacy-2026-08-29" as const;
export const analyticsPreferencesEvent = "mg:open-analytics-preferences";
export const measurementConsentChangedEvent = "mg:measurement-consent-changed";
export const measurementLocationSanitizedEvent = "mg:measurement-location-sanitized";
export const googleMeasurementScriptLoadedEvent =
  "mg:google-measurement-script-loaded";
export const measurementConsentVersion = "consent-mode-v2" as const;

export type AnalyticsConsent = "granted" | "denied";

export type MeasurementConsentPreferences = {
  analytics: boolean;
  advertising: boolean;
  version: typeof measurementConsentVersion;
  updatedAt: string;
};

type StoredMeasurementConsentPreferences = MeasurementConsentPreferences & {
  disclosureVersion: typeof measurementConsentDisclosureVersion;
};

export type MeasurementConsentSnapshot = {
  preferences: MeasurementConsentPreferences;
  source:
    | "v2"
    | "previous_granted"
    | "previous_denied"
    | "legacy_granted"
    | "legacy_denied"
    | "none";
  needsDecision: boolean;
};

export type GoogleAdsPublicConfiguration = {
  googleAnalyticsMeasurementId: string;
  googleAdsId: string;
  registrationLabel: string;
  requestLabel: string;
  purchaseLabel: string;
};

export type PublicAnalyticsEvent =
  | {
      name: "page_view";
      params: {
        page_path: string;
        page_location: string;
        page_referrer: "";
        content_group: string;
      };
    }
  | {
      name: "public_navigation_click" | "request_cta_click";
      params: {
        source_path: string;
        destination_path: string;
        page_location: string;
        page_referrer: "";
        content_group: string;
      };
    }
  | {
      name: "generate_lead";
      params: {
        content_group: "secure_request_flow";
        request_channel: "web_portal";
        page_location: "https://file.mgautotech.de/new-request";
        page_referrer: "";
        transaction_id?: string;
      };
    }
  | {
      name: "sign_up";
      params: {
        method: "customer_portal";
        content_group: "account_entry";
        transaction_id: string;
        page_location: "https://file.mgautotech.de/auth/callback";
        page_referrer: "";
      };
    }
  | {
      name: "purchase";
      params: {
        currency: string;
        value: number;
        transaction_id: string;
        content_group: "credit_purchase";
        page_location: "https://file.mgautotech.de/payment/success";
        page_referrer: "";
      };
    };

export type PublicPageViewEvent = Extract<PublicAnalyticsEvent, { name: "page_view" }>;

type AnalyticsWindow = Window & {
  dataLayer?: Array<IArguments | unknown[]>;
  gtag?: (...args: unknown[]) => void;
  __mgConfiguredGoogleTags?: string[];
  __mgGoogleConsentDefaultSet?: boolean;
  __mgGoogleConsentState?: string;
};

type VerifiedConversionName = "registration" | "request" | "purchase";

const privatePathPrefixes = [
  "/admin",
  "/api",
  "/dashboard",
  "/embed",
  "/login",
  "/new-request",
  "/payment",
  "/register",
  "/reset-password",
];

const conversionMeasurementPaths = new Set([
  "/auth/callback",
  "/auth/complete-profile",
  "/measurement/complete",
  "/new-request",
  "/payment/success",
  "/register",
]);

const localizedPrefixes = new Set([
  "de",
  "en",
  "es",
  "fr",
  "it",
  "nl",
  "pl",
  "pt",
  "ru",
  "sq",
  "tr",
  "zh",
]);

const trackedPrivateDestinations = new Set(["/login", "/new-request", "/register"]);
const publicRouteRoots = new Set([
  "/about",
  "/agb",
  "/brands",
  "/contact",
  "/datenschutz",
  "/download",
  "/ecu-platforms",
  "/file-service",
  "/how-it-works",
  "/impressum",
  "/privacy",
  "/services",
  "/tools",
  "/widerruf",
  "/widget",
  "/workshop-guides",
]);

// Google code runs only on these exact, content-only marketing routes. Keeping
// this list exact prevents unknown/404 descendants from placing customer-like
// path segments in Google's page_location. Public pages with local diagnostic
// inputs, authenticated checkout state, or account data remain first-party
// only and never share their document with gtag.js.
export const googleMeasurementPublicPaths = [
  "/about",
  "/agb",
  "/brands",
  "/brands/audi",
  "/brands/bmw",
  "/brands/mercedes-benz",
  "/brands/opel",
  "/brands/peugeot",
  "/brands/porsche",
  "/brands/renault",
  "/brands/volkswagen",
  "/contact",
  "/datenschutz",
  "/download/windows",
  "/ecu-platforms",
  "/ecu-platforms/bosch-edc17",
  "/ecu-platforms/bosch-md1",
  "/ecu-platforms/bosch-mg1",
  "/ecu-platforms/continental-sid",
  "/ecu-platforms/continental-simos",
  "/ecu-platforms/delphi-dcm",
  "/ecu-platforms/denso",
  "/ecu-platforms/transmission-control-units",
  "/file-service",
  "/how-it-works",
  "/impressum",
  "/privacy",
  "/services",
  "/services/adblue-off",
  "/services/dpf-off",
  "/services/dtc-off",
  "/services/ecu-file-check",
  "/services/egr-off",
  "/services/stage-1",
  "/services/stage-2",
  "/services/stage-3",
  "/services/tcu-tuning",
  "/widerruf",
  "/workshop-guides",
  "/workshop-guides/ecu-file-request-checklist",
  "/workshop-guides/ecu-file-service-online",
  "/workshop-guides/ecu-hw-sw-identification",
  "/workshop-guides/obd-bench-boot-read-methods",
  "/workshop-guides/tcu-file-service-workflow",
] as const;
export const googleMeasurementLocalizedPublicPaths = [
  "/file-service",
  "/how-it-works",
  "/services/adblue-off",
  "/services/dpf-off",
  "/services/dtc-off",
  "/services/egr-off",
  "/services/stage-1",
] as const;
export const firstPartyAttributionPublicPaths = [
  "/",
  ...googleMeasurementPublicPaths,
  "/tools",
  "/tools/autotuner-log-analyzer",
  "/tools/ecu-read-method-advisor",
  "/tools/file-readiness-check",
  "/tools/request-brief-builder",
  "/tools/torque-power-calculator",
  "/widget",
] as const;
export const firstPartyAttributionLocalizedPublicPaths = [
  "/",
  ...googleMeasurementLocalizedPublicPaths,
] as const;
const googleMeasurementPublicPathSet = new Set<string>(
  googleMeasurementPublicPaths
);
const googleMeasurementLocalizedPublicPathSet = new Set<string>(
  googleMeasurementLocalizedPublicPaths
);
const firstPartyAttributionPublicPathSet = new Set<string>(
  firstPartyAttributionPublicPaths
);
const firstPartyAttributionLocalizedPublicPathSet = new Set<string>(
  firstPartyAttributionLocalizedPublicPaths
);

const conversionDedupePrefix = "mg_verified_conversion_v1";
export const pendingVerifiedConversionStorageKey =
  `${conversionDedupePrefix}:pending`;
export const googleAdsConversionOutboxStorageKey =
  "mg_google_ads_conversion_outbox_v1";
export const googleAdsLinkerStorageKey = "_gcl_ls";
export const googleAdsLinkerRevocationStorageKey =
  "mg_google_ads_linker_revoked_v1";
const measurementRevocationEpochSessionStorageKey =
  "mg_measurement_revocation_epoch_session_v1";
const measurementRevocationEpochLocalStorageKey =
  "mg_measurement_revocation_epoch_v1";
const googleAdsConversionOutboxVersion = 1 as const;
const googleAdsConversionOutboxLimit = 24;
const googleAdsConversionOutboxTtlMs = 7 * 24 * 60 * 60 * 1000;
const googleAdsConversionRetryDelays = [2_500, 10_000] as const;
const verifiedConversionAckTimeoutMs = 2_200;

type GoogleAdsConversionOutboxEntry = {
  version: typeof googleAdsConversionOutboxVersion;
  name: VerifiedConversionName;
  transactionId: string;
  createdAt: number;
  value?: number;
  currency?: string;
};

type PendingVerifiedConversionDeliveryState = "pending" | "complete" | "excluded";

type PendingVerifiedConversionEntry = {
  version: 2;
  name: VerifiedConversionName;
  transactionId: string;
  createdAt: number;
  analyticsState: PendingVerifiedConversionDeliveryState;
  advertisingState: PendingVerifiedConversionDeliveryState;
  value?: number;
  currency?: string;
};

type LegacyPendingVerifiedConversionEntry = Omit<
  PendingVerifiedConversionEntry,
  "version" | "analyticsState" | "advertisingState"
> & { version: 1 };

type RawPendingVerifiedConversionEntry = Partial<
  Omit<PendingVerifiedConversionEntry, "version">
> & { version?: 1 | 2 };

type ConversionAckWaiter = {
  promise: Promise<boolean>;
  resolve: (acknowledged: boolean) => void;
};

let initializedMeasurementConfiguration: GoogleAdsPublicConfiguration | null = null;
let googleMeasurementScriptLoaded = false;
let googleMeasurementScriptLoadedAt = 0;
const googleTagConfiguredAt = new Map<string, number>();
export const googleAdsLinkerSettleMs = 150;
const googleAdsConversionsInFlight = new Set<string>();
const googleAdsConversionAckWaiters = new Map<string, ConversionAckWaiter>();
const ga4ConversionAckWaiters = new Map<string, ConversionAckWaiter>();
const ga4ConversionsInFlightByDocument = new WeakMap<object, Set<string>>();
const googleAdsConversionMemoryOutbox = new Map<
  string,
  GoogleAdsConversionOutboxEntry
>();
const googleAdsConversionRetryCounts = new Map<string, number>();
const googleAdsConversionRetryTimers = new Map<
  string,
  ReturnType<typeof globalThis.setTimeout>
>();
const pendingVerifiedConversionMemory = new Map<string, PendingVerifiedConversionEntry>();
const pendingVerifiedConversionLimit = 8;
const pendingVerifiedConversionTtlMs = 30 * 60 * 1000;

type MeasurementRevocationEpochs = {
  owner: Window;
  analyticsPendingRevokedAt: number;
  advertisingPendingRevokedAt: number;
  googleAdsOutboxRevokedAt: number;
};

type StoredMeasurementRevocationEpochs = Omit<
  MeasurementRevocationEpochs,
  "owner"
> & { version: 1 };

let measurementRevocationEpochs: MeasurementRevocationEpochs | null = null;
let googleAdsLinkerRevocationBarrier: { owner: Window; active: boolean } | null =
  null;

function browserStorage(kind: "localStorage" | "sessionStorage") {
  if (typeof window === "undefined") return null;
  try {
    return window[kind];
  } catch {
    // Accessing the Storage property itself may throw in privacy-restricted
    // documents. Callers must treat that store as unavailable.
    return null;
  }
}

function availableBrowserStorages() {
  return (["localStorage", "sessionStorage"] as const)
    .map((kind) => browserStorage(kind))
    .filter((storage): storage is Storage => storage !== null);
}

function documentGoogleAdsLinkerRevocationBarrier() {
  if (typeof window === "undefined") return null;
  if (googleAdsLinkerRevocationBarrier?.owner !== window) {
    googleAdsLinkerRevocationBarrier = { owner: window, active: false };
  }
  for (const storage of availableBrowserStorages()) {
    try {
      if (storage.getItem(googleAdsLinkerRevocationStorageKey) === "1") {
        googleAdsLinkerRevocationBarrier.active = true;
      }
    } catch {
      // The process barrier remains authoritative when a store is unreadable.
    }
  }
  return googleAdsLinkerRevocationBarrier;
}

function persistGoogleAdsLinkerRevocationBarrier() {
  const barrier = documentGoogleAdsLinkerRevocationBarrier();
  if (!barrier) return;
  barrier.active = true;
  for (const storage of availableBrowserStorages()) {
    try {
      storage.setItem(googleAdsLinkerRevocationStorageKey, "1");
    } catch {
      // The other store or process memory remains the fail-closed fallback.
    }
  }
}

function clearGoogleAdsLinkerRevocationBarrier() {
  const barrier = documentGoogleAdsLinkerRevocationBarrier();
  if (barrier) barrier.active = false;
  for (const storage of availableBrowserStorages()) {
    try {
      storage.removeItem(googleAdsLinkerRevocationStorageKey);
    } catch {
      // A stale barrier fails closed and can be retried in a later document.
    }
  }
}

function retireGoogleAdsLinkerState() {
  const storage = browserStorage("localStorage");
  let invalidated = false;
  if (storage) {
    try {
      storage.removeItem(googleAdsLinkerStorageKey);
    } catch {
      // Fall through to a non-provider sentinel overwrite.
    }
    try {
      invalidated = storage.getItem(googleAdsLinkerStorageKey) === null;
    } catch {
      invalidated = false;
    }
    if (!invalidated) {
      try {
        storage.setItem(googleAdsLinkerStorageKey, "");
        invalidated = storage.getItem(googleAdsLinkerStorageKey) === "";
      } catch {
        invalidated = false;
      }
    }
  }

  if (invalidated) clearGoogleAdsLinkerRevocationBarrier();
  else persistGoogleAdsLinkerRevocationBarrier();
}

export function isGoogleAdsLinkerStateRevoked() {
  const barrier = documentGoogleAdsLinkerRevocationBarrier();
  if (!barrier?.active) return false;

  const storage = browserStorage("localStorage");
  if (!storage) return true;
  try {
    const value = storage.getItem(googleAdsLinkerStorageKey);
    if (value !== null && value !== "") return true;
  } catch {
    return true;
  }

  // The provider state is now absent/invalidated. Retire the durable barrier,
  // but fail this readiness probe once so a stale cookie cannot win the same
  // poll that observed the cleanup.
  clearGoogleAdsLinkerRevocationBarrier();
  return true;
}

function readStoredMeasurementRevocationEpochs(
  storage: Pick<Storage, "getItem">,
  key: string
) {
  try {
    const parsed = JSON.parse(
      storage.getItem(key) ?? "null"
    ) as Partial<StoredMeasurementRevocationEpochs> | null;
    if (
      parsed?.version !== 1 ||
      ![
        parsed.analyticsPendingRevokedAt,
        parsed.advertisingPendingRevokedAt,
        parsed.googleAdsOutboxRevokedAt,
      ].every(
        (value) =>
          typeof value === "number" &&
          Number.isFinite(value) &&
          value >= 0 &&
          value <= Date.now() + 60_000
      )
    ) {
      return null;
    }
    return parsed as StoredMeasurementRevocationEpochs;
  } catch {
    return null;
  }
}

function mergedStoredMeasurementRevocationEpochs() {
  if (typeof window === "undefined") return null;
  const localStorage = browserStorage("localStorage");
  const sessionStorage = browserStorage("sessionStorage");
  const local = localStorage
    ? readStoredMeasurementRevocationEpochs(
        localStorage,
        measurementRevocationEpochLocalStorageKey
      )
    : null;
  const session = sessionStorage
    ? readStoredMeasurementRevocationEpochs(
        sessionStorage,
        measurementRevocationEpochSessionStorageKey
      )
    : null;
  if (!local && !session) return null;
  return {
    analyticsPendingRevokedAt: Math.max(
      local?.analyticsPendingRevokedAt ?? 0,
      session?.analyticsPendingRevokedAt ?? 0
    ),
    advertisingPendingRevokedAt: Math.max(
      local?.advertisingPendingRevokedAt ?? 0,
      session?.advertisingPendingRevokedAt ?? 0
    ),
    googleAdsOutboxRevokedAt: Math.max(
      local?.googleAdsOutboxRevokedAt ?? 0,
      session?.googleAdsOutboxRevokedAt ?? 0
    ),
  };
}

function persistMeasurementRevocationEpochs(epochs: MeasurementRevocationEpochs) {
  const stored: StoredMeasurementRevocationEpochs = {
    version: 1,
    analyticsPendingRevokedAt: epochs.analyticsPendingRevokedAt,
    advertisingPendingRevokedAt: epochs.advertisingPendingRevokedAt,
    googleAdsOutboxRevokedAt: epochs.googleAdsOutboxRevokedAt,
  };
  const serialized = JSON.stringify(stored);
  for (const [storage, key] of [
    [browserStorage("localStorage"), measurementRevocationEpochLocalStorageKey],
    [browserStorage("sessionStorage"), measurementRevocationEpochSessionStorageKey],
  ] as const) {
    if (!storage) continue;
    try {
      storage.setItem(key, serialized);
    } catch {
      // The other store or document memory remains the fail-closed fallback.
    }
  }
}

function documentMeasurementRevocationEpochs() {
  if (typeof window === "undefined") return null;
  if (measurementRevocationEpochs?.owner !== window) {
    measurementRevocationEpochs = {
      owner: window,
      analyticsPendingRevokedAt: 0,
      advertisingPendingRevokedAt: 0,
      googleAdsOutboxRevokedAt: 0,
    };
  }
  const stored = mergedStoredMeasurementRevocationEpochs();
  if (stored) {
    measurementRevocationEpochs.analyticsPendingRevokedAt = Math.max(
      measurementRevocationEpochs.analyticsPendingRevokedAt,
      stored.analyticsPendingRevokedAt
    );
    measurementRevocationEpochs.advertisingPendingRevokedAt = Math.max(
      measurementRevocationEpochs.advertisingPendingRevokedAt,
      stored.advertisingPendingRevokedAt
    );
    measurementRevocationEpochs.googleAdsOutboxRevokedAt = Math.max(
      measurementRevocationEpochs.googleAdsOutboxRevokedAt,
      stored.googleAdsOutboxRevokedAt
    );
  }
  return measurementRevocationEpochs;
}

function advanceMeasurementRevocationEpoch(
  key: Exclude<keyof MeasurementRevocationEpochs, "owner">
) {
  const epochs = documentMeasurementRevocationEpochs();
  if (!epochs) return 0;
  epochs[key] = Math.max(epochs[key], Date.now());
  persistMeasurementRevocationEpochs(epochs);
  return epochs[key];
}

function freshMeasurementEntryCreatedAt() {
  const epochs = documentMeasurementRevocationEpochs();
  if (!epochs) return Date.now();
  return Math.max(
    Date.now(),
    epochs.analyticsPendingRevokedAt + 1,
    epochs.advertisingPendingRevokedAt + 1,
    epochs.googleAdsOutboxRevokedAt + 1
  );
}

function getOrCreateConversionAckWaiter(
  waiters: Map<string, ConversionAckWaiter>,
  key: string
) {
  const current = waiters.get(key);
  if (current) return current;
  let resolve!: (acknowledged: boolean) => void;
  const promise = new Promise<boolean>((done) => {
    resolve = done;
  });
  const waiter = { promise, resolve };
  waiters.set(key, waiter);
  return waiter;
}

function settleConversionAck(
  waiters: Map<string, ConversionAckWaiter>,
  key: string,
  acknowledged: boolean
) {
  const waiter = waiters.get(key);
  if (!waiter) return;
  waiters.delete(key);
  waiter.resolve(acknowledged);
}

function settleAllConversionAcks(
  waiters: Map<string, ConversionAckWaiter>,
  acknowledged: boolean
) {
  for (const key of [...waiters.keys()]) {
    settleConversionAck(waiters, key, acknowledged);
  }
}

async function waitForConversionAck(
  waiters: Map<string, ConversionAckWaiter>,
  key: string,
  waiter: ConversionAckWaiter,
  timeoutMs = verifiedConversionAckTimeoutMs
) {
  let timer: ReturnType<typeof globalThis.setTimeout> | undefined;
  try {
    const acknowledged = await Promise.race([
      waiter.promise,
      new Promise<boolean>((resolve) => {
        timer = globalThis.setTimeout(() => resolve(false), timeoutMs);
      }),
    ]);
    if (!acknowledged && waiters.get(key) === waiter) {
      settleConversionAck(waiters, key, false);
    }
    return acknowledged;
  } finally {
    if (timer !== undefined) globalThis.clearTimeout(timer);
  }
}

function analyticsWindow() {
  return window as AnalyticsWindow;
}

function ga4ConversionsInFlight(target: AnalyticsWindow) {
  const owner = target as object;
  let entries = ga4ConversionsInFlightByDocument.get(owner);
  if (!entries) {
    entries = new Set<string>();
    ga4ConversionsInFlightByDocument.set(owner, entries);
  }
  return entries;
}

function stripLocalePrefix(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] && localizedPrefixes.has(segments[0])) segments.shift();
  return segments.length ? `/${segments.join("/")}` : "/";
}

export function isValidGoogleAnalyticsMeasurementId(value: string | null | undefined) {
  return googleAnalyticsMeasurementIdPattern.test(String(value ?? "").trim());
}

export function isValidGoogleAdsId(value: string | null | undefined) {
  return googleAdsIdPattern.test(String(value ?? "").trim());
}

export function isValidGoogleAdsConversionLabel(value: string | null | undefined) {
  return googleAdsConversionLabelPattern.test(String(value ?? "").trim());
}

export function isApprovedAnalyticsHost(hostname: string) {
  return hostname.trim().toLowerCase() === "file.mgautotech.de";
}

export function normalizeAnalyticsPath(value: string) {
  try {
    const url = new URL(value, "https://file.mgautotech.de");
    if (url.origin !== "https://file.mgautotech.de") return null;
    if (!url.pathname.startsWith("/") || url.pathname.length > 180) return null;
    if (/\p{Cc}/u.test(url.pathname)) return null;
    return url.pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
  } catch {
    return null;
  }
}

function safeAnalyticsLocation(pathname: string) {
  const path = normalizeAnalyticsPath(pathname);
  return path ? `https://file.mgautotech.de${path}` : "https://file.mgautotech.de/";
}

export function isSafeGoogleAdsClickSignalValue(value: string) {
  return googleAdsClickSignalValuePattern.test(value);
}

/**
 * Gives the Ads tag only the bounded click signal it needs to establish
 * first-party linker state. Unrelated query parameters and the hash are never
 * copied into Google configuration commands.
 */
export function safeGoogleAdsLandingLocation(pathname: string, search = "") {
  const location = safeAnalyticsLocation(pathname);
  if (!isGoogleMeasurementPublicPath(pathname)) return location;

  const source = new URLSearchParams(search);
  const clickSignals = new URLSearchParams();
  for (const key of ["gclid", "dclid", "wbraid", "gbraid"] as const) {
    const value = source
      .getAll(key)
      .find(isSafeGoogleAdsClickSignalValue);
    if (value) clickSignals.set(key, value);
  }
  const boundedQuery = clickSignals.toString();
  return boundedQuery ? `${location}?${boundedQuery}` : location;
}

/**
 * Removes query/hash values from the browser address before third-party Google
 * code is inserted. Ads consent may retain only one validated value per
 * documented click-signal key; first-party attribution must be captured by the
 * caller before invoking this boundary.
 */
export function sanitizeGoogleMeasurementBrowserLocation(input: {
  advertising: boolean;
}) {
  if (typeof window === "undefined") return false;
  if (
    !isApprovedAnalyticsHost(window.location.hostname) ||
    !isGoogleMeasurementScriptPath(window.location.pathname)
  ) {
    return false;
  }

  const pathname = normalizeAnalyticsPath(window.location.pathname);
  if (!pathname) return false;
  let destination = pathname;
  if (
    input.advertising &&
    isGoogleMeasurementPublicPath(window.location.pathname)
  ) {
    const adsLocation = new URL(
      safeGoogleAdsLandingLocation(
        window.location.pathname,
        window.location.search
      )
    );
    destination += adsLocation.search;
  }

  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (current === destination) return true;
  try {
    window.history.replaceState(window.history.state, "", destination);
    return true;
  } catch {
    // Do not load an external provider while an unsanitized query remains.
    return false;
  }
}

export function isPublicAnalyticsPath(pathname: string) {
  const normalized = normalizeAnalyticsPath(pathname);
  if (!normalized) return false;
  if (privatePathPrefixes.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
  )) return false;

  const route = stripLocalePrefix(normalized);
  if (route === "/") return true;
  return [...publicRouteRoots].some(
    (root) => route === root || route.startsWith(`${root}/`)
  );
}

export function isConversionMeasurementPath(pathname: string) {
  const normalized = normalizeAnalyticsPath(pathname);
  return normalized ? conversionMeasurementPaths.has(normalized) : false;
}

export function isGoogleMeasurementPublicPath(pathname: string) {
  const normalized = normalizeAnalyticsPath(pathname);
  if (!normalized || !isPublicAnalyticsPath(normalized)) return false;
  const firstSegment = normalized.split("/").filter(Boolean)[0];
  const localized = Boolean(
    firstSegment && localizedPrefixes.has(firstSegment)
  );
  const route = stripLocalePrefix(normalized);
  if (route === "/") return false;
  return localized
    ? googleMeasurementLocalizedPublicPathSet.has(route)
    : googleMeasurementPublicPathSet.has(route);
}

export function isFirstPartyAttributionPublicPath(pathname: string) {
  const normalized = normalizeAnalyticsPath(pathname);
  if (!normalized || !isPublicAnalyticsPath(normalized)) return false;
  const firstSegment = normalized.split("/").filter(Boolean)[0];
  const localized = Boolean(
    firstSegment && localizedPrefixes.has(firstSegment)
  );
  const route = stripLocalePrefix(normalized);
  return localized
    ? firstPartyAttributionLocalizedPublicPathSet.has(route)
    : firstPartyAttributionPublicPathSet.has(route);
}

export function hasSensitiveMeasurementLocation(value: string) {
  try {
    const url = new URL(value, "https://file.mgautotech.de");
    if (url.origin !== "https://file.mgautotech.de") return false;
    if (
      ![
        "/auth/callback",
        "/measurement/complete",
        "/payment/success",
      ].includes(url.pathname)
    ) {
      return false;
    }
    return Boolean(url.search || url.hash);
  } catch {
    return true;
  }
}

export function sanitizeSensitiveMeasurementLocation() {
  if (
    typeof window === "undefined" ||
    !hasSensitiveMeasurementLocation(window.location.href)
  ) {
    return false;
  }
  try {
    window.history.replaceState(window.history.state, "", window.location.pathname);
    window.dispatchEvent(new Event(measurementLocationSanitizedEvent));
    return true;
  } catch {
    return false;
  }
}

export function isMeasurementConsentPath(pathname: string) {
  return isPublicAnalyticsPath(pathname) || isConversionMeasurementPath(pathname);
}

export function isGoogleMeasurementScriptPath(pathname: string) {
  return (
    isGoogleMeasurementPublicPath(pathname) ||
    isGoogleMeasurementPath(pathname)
  );
}

export function getPrivateDocumentNavigation(
  destination: string,
  currentLocation: string,
) {
  try {
    const current = new URL(currentLocation, "https://file.mgautotech.de");
    const target = new URL(destination, current);
    if (target.origin !== current.origin) return null;
    if (
      target.href !== current.href &&
      (hasSensitiveMeasurementLocation(current.href) ||
        hasSensitiveMeasurementLocation(target.href))
    ) {
      return target.href;
    }
    const currentAllowsMeasurement = isGoogleMeasurementScriptPath(current.pathname);
    const targetAllowsMeasurement = isGoogleMeasurementScriptPath(target.pathname);
    if (
      currentAllowsMeasurement &&
      targetAllowsMeasurement &&
      target.href !== current.href &&
      (target.search !== current.search || target.hash !== current.hash)
    ) {
      return target.href;
    }
    if (currentAllowsMeasurement === targetAllowsMeasurement) return null;
    if (target.href === current.href) return null;
    return target.href;
  } catch {
    return null;
  }
}

export function replacePrivateMeasurementDocument(destination: string) {
  if (typeof window === "undefined") return false;
  const target = getPrivateDocumentNavigation(destination, window.location.href);
  if (!target) return false;
  window.location.replace(target);
  return true;
}

export function notifyMeasurementConsentChanged() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(measurementConsentChangedEvent));
  } catch {
    // A blocked event API cannot weaken the stored consent choice.
  }
}

export function publicAnalyticsContentGroup(pathname: string) {
  const normalized = normalizeAnalyticsPath(pathname) ?? "/";
  const route = stripLocalePrefix(normalized);

  if (route === "/") return "homepage";
  if (route === "/file-service") return "file_service_hub";
  if (route === "/services" || route.startsWith("/services/")) return "service_content";
  if (route === "/workshop-guides" || route.startsWith("/workshop-guides/")) return "workshop_guides";
  if (route === "/tools" || route.startsWith("/tools/")) return "workshop_tools";
  if (route === "/brands" || route.startsWith("/brands/")) return "vehicle_content";
  if (route === "/ecu-platforms" || route.startsWith("/ecu-platforms/")) return "ecu_content";
  if (route === "/how-it-works") return "workflow_content";
  if (route === "/about" || route === "/contact") return "company_content";
  if (route === "/login" || route === "/register") return "account_entry";
  if (route === "/new-request") return "secure_request_flow";
  return "public_content";
}

export function buildPublicPageView(pathname: string): PublicPageViewEvent | null {
  const pagePath = normalizeAnalyticsPath(pathname);
  if (!pagePath || !isPublicAnalyticsPath(pagePath)) return null;
  return {
    name: "page_view",
    params: {
      page_path: pagePath,
      page_location: safeAnalyticsLocation(pagePath),
      page_referrer: "",
      content_group: publicAnalyticsContentGroup(pagePath),
    },
  };
}

export function buildPublicNavigationEvent(
  sourcePathname: string,
  destinationHref: string
): PublicAnalyticsEvent | null {
  const sourcePath = normalizeAnalyticsPath(sourcePathname);
  if (!sourcePath || !isPublicAnalyticsPath(sourcePath)) return null;

  const destinationPath = normalizeAnalyticsPath(destinationHref);
  if (!destinationPath) return null;
  if (!isPublicAnalyticsPath(destinationPath) && !trackedPrivateDestinations.has(destinationPath)) {
    return null;
  }
  if (destinationPath === sourcePath) return null;

  return {
    name: destinationPath === "/new-request" ? "request_cta_click" : "public_navigation_click",
    params: {
      source_path: sourcePath,
      destination_path: destinationPath,
      page_location: safeAnalyticsLocation(sourcePath),
      page_referrer: "",
      content_group: publicAnalyticsContentGroup(destinationPath),
    },
  };
}

function necessaryOnlyPreferences(): MeasurementConsentPreferences {
  return {
    analytics: false,
    advertising: false,
    version: measurementConsentVersion,
    updatedAt: new Date(0).toISOString(),
  };
}

function parseMeasurementConsent(value: string | null) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<StoredMeasurementConsentPreferences>;
    if (
      parsed.version !== measurementConsentVersion ||
      parsed.disclosureVersion !== measurementConsentDisclosureVersion ||
      typeof parsed.analytics !== "boolean" ||
      typeof parsed.advertising !== "boolean" ||
      typeof parsed.updatedAt !== "string" ||
      !Number.isFinite(new Date(parsed.updatedAt).getTime())
    ) {
      return null;
    }
    return {
      analytics: parsed.analytics,
      advertising: parsed.advertising,
      version: parsed.version,
      updatedAt: parsed.updatedAt,
    } as MeasurementConsentPreferences;
  } catch {
    return null;
  }
}

let processMeasurementConsentOverride: {
  owner: Window;
  preferences: MeasurementConsentPreferences;
  localPersisted?: boolean;
  sessionPersisted?: boolean;
} | null = null;

function readConsentFromStorage(
  storage: Pick<Storage, "getItem">,
  key: string
) {
  try {
    return parseMeasurementConsent(storage.getItem(key));
  } catch {
    return null;
  }
}

function parsePreviousMeasurementConsent(value: string | null) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<StoredMeasurementConsentPreferences>;
    if (
      parsed.version !== measurementConsentVersion ||
      parsed.disclosureVersion === measurementConsentDisclosureVersion ||
      typeof parsed.analytics !== "boolean" ||
      typeof parsed.advertising !== "boolean" ||
      typeof parsed.updatedAt !== "string" ||
      !Number.isFinite(new Date(parsed.updatedAt).getTime())
    ) {
      return null;
    }
    return {
      analytics: parsed.analytics,
      advertising: parsed.advertising,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

function readPreviousConsentFromStorage(
  storage: Pick<Storage, "getItem">,
  key: string
) {
  try {
    return parsePreviousMeasurementConsent(storage.getItem(key));
  } catch {
    return null;
  }
}

function newestConsent<T extends { updatedAt: string }>(
  first: T | null,
  second: T | null
) {
  if (!first) return second;
  if (!second) return first;
  return new Date(second.updatedAt).getTime() > new Date(first.updatedAt).getTime()
    ? second
    : first;
}

export function readMeasurementConsentSnapshot(): MeasurementConsentSnapshot {
  const fallback = necessaryOnlyPreferences();
  if (typeof window === "undefined") {
    return { preferences: fallback, source: "none", needsDecision: true };
  }
  if (processMeasurementConsentOverride?.owner === window) {
    return {
      preferences: processMeasurementConsentOverride.preferences,
      source: "v2",
      needsDecision: false,
    };
  }
  try {
    const current = newestConsent(
      readConsentFromStorage(window.localStorage, measurementConsentStorageKey),
      readConsentFromStorage(
        window.sessionStorage,
        measurementConsentSessionStorageKey
      )
    );
    if (current) return { preferences: current, source: "v2", needsDecision: false };

    const previous = newestConsent(
      readPreviousConsentFromStorage(
        window.localStorage,
        measurementConsentStorageKey
      ),
      readPreviousConsentFromStorage(
        window.sessionStorage,
        measurementConsentSessionStorageKey
      )
    );
    if (previous?.analytics || previous?.advertising) {
      return {
        preferences: fallback,
        source: "previous_granted",
        needsDecision: true,
      };
    }
    if (previous) {
      return {
        preferences: fallback,
        source: "previous_denied",
        needsDecision: false,
      };
    }

    const legacy = window.localStorage.getItem(analyticsConsentStorageKey);
    if (legacy === "granted") {
      return {
        preferences: fallback,
        source: "legacy_granted",
        needsDecision: true,
      };
    }
    if (legacy === "denied") {
      return { preferences: fallback, source: "legacy_denied", needsDecision: false };
    }
  } catch {
    // Blocked storage keeps all optional measurement disabled.
  }
  return { preferences: fallback, source: "none", needsDecision: true };
}

/** A real cross-tab storage event supersedes this tab's process-only fallback. */
export function readExternalMeasurementConsentSnapshot() {
  if (typeof window !== "undefined" && processMeasurementConsentOverride?.owner === window) {
    processMeasurementConsentOverride = null;
  }
  return readMeasurementConsentSnapshot();
}

/**
 * Reconciles a document restored from the browser back-forward cache with the
 * newest same-tab/cross-document consent. This deliberately drops a frozen
 * process override before reading storage so an old public document cannot
 * resurrect a grant changed on a later private document.
 */
export function reconcileRestoredMeasurementConsent() {
  if (typeof window === "undefined") return readMeasurementConsentSnapshot();
  const currentOverride = processMeasurementConsentOverride?.owner === window
    ? processMeasurementConsentOverride
    : null;
  const current = currentOverride?.preferences ?? null;
  let localReadable = false;
  let localRaw: string | null = null;
  let local: MeasurementConsentPreferences | null = null;
  try {
    localRaw = window.localStorage.getItem(measurementConsentStorageKey);
    localReadable = true;
    local = parseMeasurementConsent(localRaw);
  } catch {
    // A blocked store cannot disprove the current document's process decision.
  }
  const sessionStorage = browserStorage("sessionStorage");
  const session = sessionStorage
    ? readConsentFromStorage(
        sessionStorage,
        measurementConsentSessionStorageKey
      )
    : null;
  const stored = newestConsent(local, session);
  const storedIsNewer = Boolean(
    current &&
      stored &&
      new Date(stored.updatedAt).getTime() > new Date(current.updatedAt).getTime()
  );
  const localGrantWasRemoved = Boolean(
    current &&
      (current.analytics || current.advertising) &&
      currentOverride?.localPersisted === true &&
      localReadable &&
      localRaw === null &&
      !storedIsNewer
  );
  const preferences = storedIsNewer
    ? stored!
    : localGrantWasRemoved
      ? { ...necessaryOnlyPreferences(), updatedAt: new Date().toISOString() }
      : current ?? stored ?? necessaryOnlyPreferences();
  const snapshot: MeasurementConsentSnapshot = {
    preferences,
    source: current || stored || localGrantWasRemoved ? "v2" : "none",
    needsDecision: !current && !stored && !localGrantWasRemoved,
  };
  processMeasurementConsentOverride = {
    owner: window,
    preferences,
    localPersisted: Boolean(local),
    sessionPersisted: Boolean(session),
  };
  applyStoredMeasurementConsent(preferences);
  return snapshot;
}

/**
 * A storage removal is an authoritative fail-closed cross-tab signal. It must
 * not fall back to this tab's older session grant after another tab could only
 * remove (rather than overwrite) an obsolete localStorage grant.
 */
export function applyExternalMeasurementConsentChange(value: string | null) {
  if (typeof window === "undefined") {
    return readMeasurementConsentSnapshot();
  }
  const parsed = parseMeasurementConsent(value);
  const preferences = parsed ?? {
    ...necessaryOnlyPreferences(),
    updatedAt: new Date().toISOString(),
  };
  processMeasurementConsentOverride = {
    owner: window,
    preferences,
    localPersisted: Boolean(parsed),
    sessionPersisted: false,
  };
  try {
    window.sessionStorage.setItem(
      measurementConsentSessionStorageKey,
      JSON.stringify(preferences)
    );
    processMeasurementConsentOverride.sessionPersisted = true;
  } catch {
    // The process override keeps the current tab denied.
  }
  return {
    preferences,
    source: "v2" as const,
    needsDecision: value !== null && !parsed,
  };
}

export function readMeasurementConsent() {
  return readMeasurementConsentSnapshot().preferences;
}

export function hasAnalyticsConsent() {
  return readMeasurementConsent().analytics;
}

export function hasAdvertisingMeasurementConsent() {
  return readMeasurementConsent().advertising;
}

/**
 * Applies an already-stored consent choice to this tab's process-local queues.
 * Private routes are always process-locally denied even when the stored choice
 * is granted; the grant is applied only after a later eligible document/route.
 * This performs no consent-storage write or event emission, so cross-tab use
 * cannot loop. A granted choice may promote an already-held anonymous
 * conversion to the same-origin durable queue before the private document is
 * replaced; denied destinations remain retired by the steps below.
 */
export function applyStoredMeasurementConsent(
  preferences: Pick<MeasurementConsentPreferences, "analytics" | "advertising">
) {
  if (!preferences.advertising) {
    clearGoogleAdsConversionOutbox();
    retirePendingVerifiedConversionDestination("advertising");
  }
  if (!preferences.analytics) {
    clearGa4ConversionDedupeMarkers();
    retirePendingVerifiedConversionDestination("analytics");
  }
  if (!preferences.analytics && !preferences.advertising) {
    clearPendingVerifiedConversions();
  } else {
    persistPendingVerifiedConversionsAfterConsentGrant();
  }
  const measurementRouteAllowed =
    typeof window !== "undefined" &&
    isGoogleMeasurementScriptPath(window.location.pathname);
  applyGoogleConsentUpdate(
    measurementRouteAllowed
      ? preferences
      : { analytics: false, advertising: false }
  );
}

export function writeMeasurementConsent(input: Pick<MeasurementConsentPreferences, "analytics" | "advertising">) {
  if (typeof window === "undefined") return null;
  const preferences: MeasurementConsentPreferences = {
    analytics: input.analytics,
    advertising: input.advertising,
    version: measurementConsentVersion,
    updatedAt: new Date().toISOString(),
  };
  const storedPreferences: StoredMeasurementConsentPreferences = {
    ...preferences,
    disclosureVersion: measurementConsentDisclosureVersion,
  };
  // The user's newest choice is authoritative in this document even when a
  // quota/privacy extension makes a previously readable grant unwritable.
  processMeasurementConsentOverride = {
    owner: window,
    preferences,
    localPersisted: false,
    sessionPersisted: false,
  };
  try {
    window.sessionStorage.setItem(
      measurementConsentSessionStorageKey,
      JSON.stringify(storedPreferences)
    );
    processMeasurementConsentOverride.sessionPersisted = true;
  } catch {
    try {
      window.sessionStorage.removeItem(measurementConsentSessionStorageKey);
    } catch {
      // Process memory remains fail-closed for this document.
    }
  }
  let persistedV2 = false;
  try {
    window.localStorage.setItem(
      measurementConsentStorageKey,
      JSON.stringify(storedPreferences)
    );
    persistedV2 = true;
    processMeasurementConsentOverride.localPersisted = true;
  } catch {
    // Do not let a previously readable grant survive a failed overwrite into a
    // fresh document. Removal is best-effort; the process override still keeps
    // this document aligned with the user's latest choice.
    try {
      window.localStorage.removeItem(measurementConsentStorageKey);
    } catch {
      // A fully blocked storage API cannot be mutated by application code.
    }
  }
  try {
    if (persistedV2) {
      window.localStorage.setItem(
        analyticsConsentStorageKey,
        preferences.analytics ? "granted" : "denied"
      );
    } else {
      window.localStorage.removeItem(analyticsConsentStorageKey);
    }
  } catch {
    try {
      window.localStorage.removeItem(analyticsConsentStorageKey);
    } catch {
      // The authoritative v2 choice remains intact when only the legacy mirror fails.
    }
  }
  applyStoredMeasurementConsent(preferences);
  notifyMeasurementConsentChanged();
  if (
    (preferences.analytics || preferences.advertising) &&
    isMeasurementConsentPath(window.location.pathname)
  ) {
    void flushPendingVerifiedConversions();
  }
  return preferences;
}

export function readAnalyticsConsent(): AnalyticsConsent | null {
  const snapshot = readMeasurementConsentSnapshot();
  if (snapshot.source === "none") return null;
  return snapshot.preferences.analytics ? "granted" : "denied";
}

export function writeAnalyticsConsent(consent: AnalyticsConsent) {
  writeMeasurementConsent({ analytics: consent === "granted", advertising: false });
}

function ensureGoogleTagQueue() {
  const target = analyticsWindow();
  target.dataLayer = target.dataLayer ?? [];
  // Match Google's documented queue contract exactly so gtag.js and Consent
  // Mode receive the command tuple in the format they expect.
  target.gtag = target.gtag ?? function gtag() {
    // eslint-disable-next-line prefer-rest-params -- gtag.js documents this exact queue shape.
    target.dataLayer?.push(arguments);
  };
  target.__mgConfiguredGoogleTags = target.__mgConfiguredGoogleTags ?? [];
  return target;
}

function consentCommand(preferences: MeasurementConsentPreferences) {
  const optionalStorageGranted = preferences.analytics || preferences.advertising;
  return {
    analytics_storage: preferences.analytics ? "granted" : "denied",
    ad_storage: preferences.advertising ? "granted" : "denied",
    ad_user_data: preferences.advertising ? "granted" : "denied",
    ad_personalization: "denied",
    functionality_storage: optionalStorageGranted ? "granted" : "denied",
    security_storage: optionalStorageGranted ? "granted" : "denied",
  } as const;
}

function ensureGoogleConsentDefault() {
  const target = ensureGoogleTagQueue();
  if (target.__mgGoogleConsentDefaultSet) return target;
  try {
    target.gtag?.("consent", "default", {
      ...consentCommand(necessaryOnlyPreferences()),
      wait_for_update: 500,
    });
    target.__mgGoogleConsentDefaultSet = true;
  } catch {
    // A blocked provider queue must never break the user's consent choice.
  }
  return target;
}

/**
 * Queue the exact stored Consent Mode state immediately without loading a
 * Google script or configuring a measurement tag. This keeps same-tab and
 * cross-tab partial withdrawals synchronous, including on private routes.
 */
export function applyGoogleConsentUpdate(
  preferences: Pick<MeasurementConsentPreferences, "analytics" | "advertising">
) {
  if (typeof window === "undefined") return;
  const target = ensureGoogleConsentDefault();
  const state = `${preferences.analytics ? "1" : "0"}:${preferences.advertising ? "1" : "0"}`;
  if (target.__mgGoogleConsentState === state) return;
  try {
    target.gtag?.("consent", "update", consentCommand({
      ...necessaryOnlyPreferences(),
      analytics: preferences.analytics,
      advertising: preferences.advertising,
    }));
    target.__mgGoogleConsentState = state;
  } catch {
    // Keep the stored choice authoritative and allow a later route/effect retry.
  }
}

export function initializeGoogleMeasurement(config: GoogleAdsPublicConfiguration) {
  if (
    typeof window === "undefined" ||
    !isGoogleMeasurementScriptPath(window.location.pathname)
  ) return false;
  initializedMeasurementConfiguration = {
    googleAnalyticsMeasurementId: config.googleAnalyticsMeasurementId.trim(),
    googleAdsId: config.googleAdsId.trim(),
    registrationLabel: config.registrationLabel.trim(),
    requestLabel: config.requestLabel.trim(),
    purchaseLabel: config.purchaseLabel.trim(),
  };
  const preferences = readMeasurementConsent();
  const analyticsConfigured =
    preferences.analytics && isValidGoogleAnalyticsMeasurementId(
      initializedMeasurementConfiguration.googleAnalyticsMeasurementId
    );
  const adsConfigured = preferences.advertising && isValidGoogleAdsId(
    initializedMeasurementConfiguration.googleAdsId
  );
  if (!analyticsConfigured && !adsConfigured) return false;

  applyGoogleConsentUpdate(preferences);
  const target = ensureGoogleConsentDefault();
  if (!target.__mgConfiguredGoogleTags?.length) target.gtag?.("js", new Date());

  for (const tagId of [
    analyticsConfigured
      ? initializedMeasurementConfiguration.googleAnalyticsMeasurementId
      : "",
    adsConfigured ? initializedMeasurementConfiguration.googleAdsId : "",
  ].filter(Boolean)) {
    if (!target.__mgConfiguredGoogleTags?.includes(tagId)) {
      const isAdsTag = tagId === initializedMeasurementConfiguration.googleAdsId;
      target.gtag?.("config", tagId, {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        page_location: isAdsTag
          ? safeGoogleAdsLandingLocation(
              window.location.pathname,
              window.location.search
            )
          : safeAnalyticsLocation(window.location.pathname),
        page_referrer: "",
      });
      target.__mgConfiguredGoogleTags?.push(tagId);
      googleTagConfiguredAt.set(tagId, Date.now());
    }
  }
  return true;
}

export function initializeGoogleAnalytics(measurementId: string) {
  return initializeGoogleMeasurement({
    googleAnalyticsMeasurementId: measurementId,
    googleAdsId: "",
    registrationLabel: "",
    requestLabel: "",
    purchaseLabel: "",
  });
}

export function denyGoogleMeasurement() {
  applyGoogleConsentUpdate(necessaryOnlyPreferences());
}

export const denyGoogleAnalytics = denyGoogleMeasurement;

export function dispatchPublicAnalyticsEvent(event: PublicAnalyticsEvent | null) {
  if (
    !event ||
    typeof window === "undefined" ||
    !hasAnalyticsConsent() ||
    !isGoogleMeasurementScriptPath(window.location.pathname)
  ) return false;
  const target = ensureGoogleTagQueue();
  target.gtag?.("event", event.name, event.params);
  return true;
}

export function dispatchPublicAnalyticsEventWithAck(
  event: PublicAnalyticsEvent | null,
  input?: { signal?: AbortSignal; timeoutMs?: number }
) {
  if (!event || typeof window === "undefined" || !hasAnalyticsConsent()) {
    return Promise.resolve(false);
  }
  if (!isGoogleMeasurementScriptPath(window.location.pathname)) {
    return Promise.resolve(false);
  }

  const timeoutMs = Math.max(0, Math.min(input?.timeoutMs ?? 2_000, 2_000));
  const target = ensureGoogleTagQueue();
  return new Promise<boolean>((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof globalThis.setTimeout> | null = null;
    const finish = (acknowledged: boolean) => {
      if (settled) return;
      settled = true;
      if (timer !== null) globalThis.clearTimeout(timer);
      input?.signal?.removeEventListener("abort", abort);
      resolve(acknowledged);
    };
    const abort = () => finish(false);

    input?.signal?.addEventListener("abort", abort, { once: true });
    if (input?.signal?.aborted) {
      finish(false);
      return;
    }
    timer = globalThis.setTimeout(() => finish(false), timeoutMs);
    try {
      target.gtag?.("event", event.name, {
        ...event.params,
        event_timeout: timeoutMs,
        event_callback: () => finish(true),
      });
    } catch {
      finish(false);
    }
  });
}

function publicMeasurementConfiguration(): GoogleAdsPublicConfiguration {
  if (initializedMeasurementConfiguration) {
    return initializedMeasurementConfiguration;
  }
  return {
    googleAnalyticsMeasurementId:
      process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID?.trim() ?? "",
    googleAdsId: process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim() ?? "",
    registrationLabel:
      process.env.NEXT_PUBLIC_GOOGLE_ADS_REGISTRATION_LABEL?.trim() ?? "",
    requestLabel: process.env.NEXT_PUBLIC_GOOGLE_ADS_REQUEST_LABEL?.trim() ?? "",
    purchaseLabel: process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL?.trim() ?? "",
  };
}

function googleAdsConversionKey(
  name: VerifiedConversionName,
  transactionId: string
) {
  return `${name}:${transactionId}`;
}

function isGoogleAdsConversionOutboxEntry(
  value: unknown,
  now: number
): value is GoogleAdsConversionOutboxEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<GoogleAdsConversionOutboxEntry>;
  if (
    entry.version !== googleAdsConversionOutboxVersion ||
    !["registration", "request", "purchase"].includes(String(entry.name)) ||
    !/^[a-f0-9]{64}$/.test(String(entry.transactionId ?? "")) ||
    typeof entry.createdAt !== "number" ||
    !Number.isFinite(entry.createdAt) ||
    entry.createdAt > now + 60_000 ||
    now - entry.createdAt > googleAdsConversionOutboxTtlMs
  ) {
    return false;
  }
  if (entry.value !== undefined && safeConversionValue(entry.value) === null) {
    return false;
  }
  if (entry.currency !== undefined && safeCurrency(entry.currency) === null) {
    return false;
  }
  return true;
}

function googleAdsConversionOutboxEntryWasRevoked(
  entry: GoogleAdsConversionOutboxEntry
) {
  const revokedAt =
    documentMeasurementRevocationEpochs()?.googleAdsOutboxRevokedAt ?? 0;
  return revokedAt > 0 && entry.createdAt <= revokedAt;
}

function readGoogleAdsConversionOutbox() {
  if (typeof window === "undefined") return [] as GoogleAdsConversionOutboxEntry[];
  const now = Date.now();
  let raw: string | null = null;
  let persisted: unknown[] = [];
  try {
    raw = window.localStorage.getItem(googleAdsConversionOutboxStorageKey);
    const parsed = JSON.parse(raw ?? "[]") as unknown;
    if (Array.isArray(parsed)) persisted = parsed;
  } catch {
    // The in-memory queue still covers the current page when storage is blocked.
  }

  const merged = new Map<string, GoogleAdsConversionOutboxEntry>();
  for (const candidate of [
    ...persisted,
    ...googleAdsConversionMemoryOutbox.values(),
  ]) {
    if (!isGoogleAdsConversionOutboxEntry(candidate, now)) continue;
    if (googleAdsConversionOutboxEntryWasRevoked(candidate)) continue;
    merged.set(
      googleAdsConversionKey(candidate.name, candidate.transactionId),
      candidate
    );
  }
  const entries = [...merged.values()].slice(-googleAdsConversionOutboxLimit);
  googleAdsConversionMemoryOutbox.clear();
  for (const entry of entries) {
    googleAdsConversionMemoryOutbox.set(
      googleAdsConversionKey(entry.name, entry.transactionId),
      entry
    );
  }

  try {
    const sanitized = JSON.stringify(entries);
    if (entries.length === 0 && raw !== null) {
      window.localStorage.removeItem(googleAdsConversionOutboxStorageKey);
    } else if (entries.length > 0 && raw !== sanitized) {
      window.localStorage.setItem(googleAdsConversionOutboxStorageKey, sanitized);
    }
  } catch {
    // Optional persistence may be blocked; the memory queue remains usable.
  }
  return entries;
}

function writeGoogleAdsConversionOutbox(
  entries: GoogleAdsConversionOutboxEntry[]
) {
  if (typeof window === "undefined") return;
  const boundedEntries = entries
    .filter((entry) => !googleAdsConversionOutboxEntryWasRevoked(entry))
    .slice(-googleAdsConversionOutboxLimit);
  googleAdsConversionMemoryOutbox.clear();
  for (const entry of boundedEntries) {
    googleAdsConversionMemoryOutbox.set(
      googleAdsConversionKey(entry.name, entry.transactionId),
      entry
    );
  }
  try {
    if (boundedEntries.length === 0) {
      window.localStorage.removeItem(googleAdsConversionOutboxStorageKey);
      return;
    }
    window.localStorage.setItem(
      googleAdsConversionOutboxStorageKey,
      JSON.stringify(boundedEntries)
    );
  } catch {
    // Provider transaction IDs still protect retries when storage is blocked.
  }
}

function clearGoogleAdsConversionRetry(key: string) {
  const timer = googleAdsConversionRetryTimers.get(key);
  if (timer !== undefined) globalThis.clearTimeout(timer);
  googleAdsConversionRetryTimers.delete(key);
  googleAdsConversionRetryCounts.delete(key);
  googleAdsConversionsInFlight.delete(key);
}

export function clearGoogleAdsConversionOutbox() {
  advanceMeasurementRevocationEpoch("googleAdsOutboxRevokedAt");
  retireGoogleAdsLinkerState();
  googleAdsConversionMemoryOutbox.clear();
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(googleAdsConversionOutboxStorageKey);
    } catch {
      // The document epoch keeps an unremovable stale outbox retired.
    }
    const adsDedupePrefix = `${conversionDedupePrefix}:ads:`;
    const dedupeKeys: string[] = [];
    let storageLength = 0;
    try {
      storageLength = window.localStorage.length;
    } catch {
      // Continue with process-local queue retirement below.
    }
    for (let index = storageLength - 1; index >= 0; index -= 1) {
      try {
        const key = window.localStorage.key(index);
        if (key?.startsWith(adsDedupePrefix)) dedupeKeys.push(key);
      } catch {
        // One unreadable slot must not skip the remaining cleanup attempts.
      }
    }
    for (const key of dedupeKeys) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // The revocation epoch remains authoritative for this document.
      }
    }
  }
  for (const key of [...googleAdsConversionRetryTimers.keys()]) {
    clearGoogleAdsConversionRetry(key);
  }
  googleAdsConversionsInFlight.clear();
  settleAllConversionAcks(googleAdsConversionAckWaiters, false);
}

function enqueueGoogleAdsConversion(
  entry: GoogleAdsConversionOutboxEntry
) {
  if (googleAdsConversionOutboxEntryWasRevoked(entry)) return false;
  const entries = readGoogleAdsConversionOutbox();
  const key = googleAdsConversionKey(entry.name, entry.transactionId);
  if (
    entries.some(
      (candidate) =>
        googleAdsConversionKey(candidate.name, candidate.transactionId) === key
    )
  ) {
    return true;
  }
  writeGoogleAdsConversionOutbox([...entries, entry]);
  return true;
}

function removeGoogleAdsConversion(
  name: VerifiedConversionName,
  transactionId: string,
  acknowledged = true
) {
  const key = googleAdsConversionKey(name, transactionId);
  writeGoogleAdsConversionOutbox(
    readGoogleAdsConversionOutbox().filter(
      (entry) => googleAdsConversionKey(entry.name, entry.transactionId) !== key
    )
  );
  clearGoogleAdsConversionRetry(key);
  settleConversionAck(googleAdsConversionAckWaiters, key, acknowledged);
}

function scheduleGoogleAdsConversionRetry(key: string) {
  const retryCount = googleAdsConversionRetryCounts.get(key) ?? 0;
  const delay = googleAdsConversionRetryDelays[retryCount];
  if (delay === undefined) {
    googleAdsConversionsInFlight.delete(key);
    return;
  }
  googleAdsConversionRetryCounts.set(key, retryCount + 1);
  const timer = globalThis.setTimeout(() => {
    googleAdsConversionRetryTimers.delete(key);
    googleAdsConversionsInFlight.delete(key);
    void flushGoogleAdsConversionOutbox();
  }, delay);
  googleAdsConversionRetryTimers.set(key, timer);
}

export function notifyGoogleMeasurementScriptFailed() {
  googleMeasurementScriptLoaded = false;
  googleMeasurementScriptLoadedAt = 0;
  for (const key of [...googleAdsConversionsInFlight]) {
    clearGoogleAdsConversionRetry(key);
    settleConversionAck(googleAdsConversionAckWaiters, key, false);
  }
  settleAllConversionAcks(ga4ConversionAckWaiters, false);
}

export async function notifyGoogleMeasurementScriptLoaded() {
  googleMeasurementScriptLoaded = true;
  googleMeasurementScriptLoadedAt = Date.now();
  try {
    window.dispatchEvent(new Event(googleMeasurementScriptLoadedEvent));
  } catch {
    // The completion page also checks the in-memory ready flag on mount.
  }
  return flushGoogleAdsConversionOutbox();
}

export function isGoogleMeasurementScriptReady() {
  return googleMeasurementScriptLoaded;
}

function isAnalyticsMeasurementCookie(name: string) {
  return (
    name === "_ga" ||
    name.startsWith("_ga_") ||
    name === "_gid" ||
    name === "_gat" ||
    name.startsWith("_gat_")
  );
}

function isAdvertisingMeasurementCookie(name: string) {
  return (
    name.startsWith("_gcl") ||
    name.startsWith("_gac") ||
    name === "FPLC" ||
    name.startsWith("FPGCL")
  );
}

function measurementCookieCleanupPaths(pathname: string) {
  const paths = new Set(["/"]);
  const normalized = normalizeAnalyticsPath(pathname);
  if (!normalized || !/^\/[A-Za-z0-9/_-]*$/.test(normalized)) return [...paths];
  const segments = normalized.split("/").filter(Boolean);
  let current = "";
  for (const segment of segments) {
    current += `/${segment}`;
    paths.add(current);
  }
  return [...paths].reverse();
}

function measurementCookieCleanupDomains(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  const domains = new Set<string | null>([null]);
  if (!/^[a-z0-9.-]+$/.test(normalized)) return [...domains];
  const labels = normalized.split(".").filter(Boolean);
  for (let index = 0; labels.length - index >= 2; index += 1) {
    const domain = labels.slice(index).join(".");
    domains.add(domain);
    domains.add(`.${domain}`);
  }
  return [...domains];
}

function clearRevokedGoogleMeasurementCookies(input: {
  analytics: boolean;
  advertising: boolean;
}) {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  let names: string[] = [];
  try {
    names = document.cookie
      .split(";")
      .map((entry) => entry.trim().split("=", 1)[0] ?? "")
      .filter((name) =>
        (input.analytics && isAnalyticsMeasurementCookie(name)) ||
        (input.advertising && isAdvertisingMeasurementCookie(name))
      );
  } catch {
    return;
  }
  const paths = measurementCookieCleanupPaths(window.location.pathname);
  const domains = measurementCookieCleanupDomains(window.location.hostname);
  for (const name of new Set(names)) {
    for (const path of paths) {
      for (const domain of domains) {
        try {
          document.cookie = [
            `${name}=`,
            "Max-Age=0",
            "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
            `Path=${path}`,
            domain ? `Domain=${domain}` : "",
            "SameSite=Lax",
            "Secure",
          ].filter(Boolean).join("; ");
        } catch {
          // Continue across the remaining host/path variants.
        }
      }
    }
  }
}

/**
 * Consent updates retire app-owned queues synchronously, but a provider script
 * that already executed cannot be unloaded from the current document. Call
 * this after persisting a narrower choice so the next document starts from the
 * stored state without retaining query/hash measurement signals.
 */
export function replaceGoogleMeasurementDocumentAfterConsentWithdrawal(
  previous: Pick<MeasurementConsentPreferences, "analytics" | "advertising">,
  next: Pick<MeasurementConsentPreferences, "analytics" | "advertising">
) {
  if (typeof window === "undefined") return false;
  const destinationWasRevoked =
    (previous.analytics && !next.analytics) ||
    (previous.advertising && !next.advertising);
  if (!destinationWasRevoked) return false;
  clearRevokedGoogleMeasurementCookies({
    analytics: previous.analytics && !next.analytics,
    advertising: previous.advertising && !next.advertising,
  });
  const target = analyticsWindow();
  if (
    !googleMeasurementScriptLoaded ||
    !target.__mgConfiguredGoogleTags?.length
  ) {
    return false;
  }

  const destination = normalizeAnalyticsPath(window.location.pathname) ?? "/";
  try {
    window.location.replace(destination);
    return true;
  } catch {
    return false;
  }
}

function clearGa4ConversionDedupeMarkers() {
  if (typeof window === "undefined") return;
  try {
    const markerPrefix = `${conversionDedupePrefix}:ga4:`;
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(markerPrefix)) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // Consent revocation remains effective when app-owned storage is blocked.
  }
  ga4ConversionsInFlight(analyticsWindow()).clear();
  settleAllConversionAcks(ga4ConversionAckWaiters, false);
}

export function isGoogleAdsLinkerConfigurationReady(
  googleAdsId: string,
  now = Date.now()
) {
  if (
    typeof window === "undefined" ||
    !googleMeasurementScriptLoaded ||
    !isValidGoogleAdsId(googleAdsId)
  ) {
    return false;
  }
  const configuredAt = googleTagConfiguredAt.get(googleAdsId.trim()) ?? 0;
  const readyAt = Math.max(configuredAt, googleMeasurementScriptLoadedAt);
  return Boolean(
    readyAt > 0 &&
      now - readyAt >= googleAdsLinkerSettleMs &&
      analyticsWindow().__mgConfiguredGoogleTags?.includes(googleAdsId.trim())
  );
}

export async function flushGoogleAdsConversionOutbox() {
  if (
    typeof window === "undefined" ||
    !hasAdvertisingMeasurementConsent() ||
    !isGoogleMeasurementScriptPath(window.location.pathname)
  ) {
    return 0;
  }

  const config = publicMeasurementConfiguration();
  if (
    !isValidGoogleAdsId(config.googleAdsId) ||
    !isGoogleAdsLinkerConfigurationReady(config.googleAdsId)
  ) return 0;
  const target = ensureGoogleTagQueue();
  let dispatched = 0;

  for (const entry of readGoogleAdsConversionOutbox()) {
    if (conversionWasQueued("ads", entry.name, entry.transactionId)) {
      removeGoogleAdsConversion(entry.name, entry.transactionId);
      continue;
    }
    const label = conversionLabel(config, entry.name);
    if (!isValidGoogleAdsConversionLabel(label)) continue;
    const key = googleAdsConversionKey(entry.name, entry.transactionId);
    if (googleAdsConversionsInFlight.has(key)) continue;

    googleAdsConversionsInFlight.add(key);
    getOrCreateConversionAckWaiter(googleAdsConversionAckWaiters, key);
    const adsParams: Record<string, unknown> = {
      send_to: `${config.googleAdsId}/${label}`,
      transaction_id: entry.transactionId,
      page_location: verifiedConversionPageLocation(entry.name),
      page_referrer: "",
      event_timeout: 2_000,
      event_callback: () => {
        if (!hasAdvertisingMeasurementConsent()) {
          clearGoogleAdsConversionRetry(key);
          settleConversionAck(googleAdsConversionAckWaiters, key, false);
          return;
        }
        markConversionQueued("ads", entry.name, entry.transactionId);
        removeGoogleAdsConversion(entry.name, entry.transactionId);
      },
    };
    if (entry.currency && entry.value !== undefined) {
      adsParams.currency = entry.currency;
      adsParams.value = entry.value;
    }
    scheduleGoogleAdsConversionRetry(key);
    try {
      target.gtag?.("event", "conversion", adsParams);
      dispatched += 1;
    } catch {
      // Keep the hashed outbox entry for the scheduled retry.
      settleConversionAck(googleAdsConversionAckWaiters, key, false);
    }
  }
  return dispatched;
}

function conversionLabel(
  config: GoogleAdsPublicConfiguration,
  name: VerifiedConversionName
) {
  if (name === "registration") return config.registrationLabel;
  if (name === "request") return config.requestLabel;
  return config.purchaseLabel;
}

function verifiedConversionPageLocation(name: VerifiedConversionName) {
  if (name === "registration") return "https://file.mgautotech.de/auth/callback";
  if (name === "request") return "https://file.mgautotech.de/new-request";
  return "https://file.mgautotech.de/payment/success";
}

function safeCurrency(value: string | null | undefined) {
  const currency = String(value ?? "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : null;
}

function safeConversionValue(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.round(value * 100) / 100
    : null;
}

function pendingVerifiedConversionKey(entry: Pick<PendingVerifiedConversionEntry, "name" | "transactionId">) {
  return `${entry.name}:${entry.transactionId}`;
}

function normalizePendingVerifiedConversionEntry(
  value: unknown,
  now = Date.now()
): PendingVerifiedConversionEntry | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as RawPendingVerifiedConversionEntry;
  if (
    ![1, 2].includes(Number(entry.version)) ||
    !["registration", "request", "purchase"].includes(String(entry.name)) ||
    !/^[a-f0-9]{64}$/.test(String(entry.transactionId ?? "")) ||
    typeof entry.createdAt !== "number" ||
    !Number.isFinite(entry.createdAt) ||
    entry.createdAt <= 0 ||
    entry.createdAt > now + 60_000 ||
    now - entry.createdAt > pendingVerifiedConversionTtlMs
  ) {
    return null;
  }
  if (entry.value !== undefined && safeConversionValue(entry.value) === null) return null;
  if (entry.currency !== undefined && safeCurrency(entry.currency) === null) return null;

  if (entry.version === 2) {
    if (
      !["pending", "complete", "excluded"].includes(String(entry.analyticsState)) ||
      !["pending", "complete", "excluded"].includes(String(entry.advertisingState))
    ) {
      return null;
    }
    return entry as PendingVerifiedConversionEntry;
  }

  const base = entry as LegacyPendingVerifiedConversionEntry;
  const preferences = readMeasurementConsent();
  return {
    ...base,
    version: 2,
    analyticsState: conversionWasQueued("ga4", base.name, base.transactionId)
      ? "complete"
      : preferences.analytics
        ? "pending"
        : "excluded",
    advertisingState: conversionWasQueued("ads", base.name, base.transactionId)
      ? "complete"
      : preferences.advertising
        ? "pending"
        : "excluded",
  };
}

function pendingVerifiedConversionAfterRevocation(
  entry: PendingVerifiedConversionEntry
) {
  const epochs = documentMeasurementRevocationEpochs();
  if (!epochs) return entry;
  return {
    ...entry,
    analyticsState:
      epochs.analyticsPendingRevokedAt > 0 &&
      entry.createdAt <= epochs.analyticsPendingRevokedAt
        ? "excluded" as const
        : entry.analyticsState,
    advertisingState:
      epochs.advertisingPendingRevokedAt > 0 &&
      entry.createdAt <= epochs.advertisingPendingRevokedAt
        ? "excluded" as const
        : entry.advertisingState,
  };
}

function mergePendingVerifiedConversionState(
  first: PendingVerifiedConversionDeliveryState,
  second: PendingVerifiedConversionDeliveryState
) {
  if (first === "excluded" || second === "excluded") return "excluded" as const;
  if (first === "complete" || second === "complete") return "complete" as const;
  return "pending" as const;
}

function mergePendingVerifiedConversionEntries(
  first: PendingVerifiedConversionEntry,
  second: PendingVerifiedConversionEntry
) {
  const newest = second.createdAt >= first.createdAt ? second : first;
  return {
    ...newest,
    createdAt: Math.min(first.createdAt, second.createdAt),
    analyticsState: mergePendingVerifiedConversionState(
      first.analyticsState,
      second.analyticsState
    ),
    advertisingState: mergePendingVerifiedConversionState(
      first.advertisingState,
      second.advertisingState
    ),
  };
}

function writePendingVerifiedConversions(entries: PendingVerifiedConversionEntry[]) {
  const bounded = entries
    .map(pendingVerifiedConversionAfterRevocation)
    .slice(-pendingVerifiedConversionLimit);
  pendingVerifiedConversionMemory.clear();
  for (const entry of bounded) {
    pendingVerifiedConversionMemory.set(pendingVerifiedConversionKey(entry), entry);
  }
  if (typeof window === "undefined") return false;
  const serialized = JSON.stringify(bounded);
  let durable = false;
  for (const storage of availableBrowserStorages()) {
    try {
      if (!bounded.length) storage.removeItem(pendingVerifiedConversionStorageKey);
      else storage.setItem(pendingVerifiedConversionStorageKey, serialized);
      durable = true;
    } catch {
      // Either same-origin store is sufficient for the fresh-document bridge.
    }
  }
  return durable;
}

function readPendingVerifiedConversions() {
  const now = Date.now();
  const persisted: unknown[] = [];
  if (typeof window !== "undefined") {
    for (const storage of availableBrowserStorages()) {
      try {
        const raw = storage.getItem(pendingVerifiedConversionStorageKey);
        if (raw === null) continue;
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) persisted.push(...parsed);
      } catch {
        // Merge every readable same-origin store with process memory.
      }
    }
  }
  const merged = new Map<string, PendingVerifiedConversionEntry>();
  for (const candidate of [...persisted, ...pendingVerifiedConversionMemory.values()]) {
    const normalized = normalizePendingVerifiedConversionEntry(candidate, now);
    if (!normalized) continue;
    const effective = pendingVerifiedConversionAfterRevocation(normalized);
    const key = pendingVerifiedConversionKey(effective);
    const current = merged.get(key);
    merged.set(
      key,
      current
        ? mergePendingVerifiedConversionEntries(current, effective)
        : effective
    );
  }
  const entries = [...merged.values()].slice(-pendingVerifiedConversionLimit);
  writePendingVerifiedConversions(entries);
  return entries;
}

function persistPendingVerifiedConversionsAfterConsentGrant() {
  // A verified request or purchase can finish before the customer has made an
  // optional measurement choice. Those undecided entries intentionally live in
  // memory only. Once a grant is explicit, readPendingVerifiedConversions()
  // merges that memory with any durable queue and writes the bounded result to
  // same-origin storage. Excluded states win during the merge, so this cannot
  // resurrect a destination retired by a partial consent choice.
  readPendingVerifiedConversions();
}

function enqueuePendingVerifiedConversion(
  entry: PendingVerifiedConversionEntry,
  persist: boolean
) {
  if (persist) {
    const entries = readPendingVerifiedConversions();
    const key = pendingVerifiedConversionKey(entry);
    return writePendingVerifiedConversions([
      ...entries.filter((candidate) => pendingVerifiedConversionKey(candidate) !== key),
      entry,
    ]);
  }
  const key = pendingVerifiedConversionKey(entry);
  if (!pendingVerifiedConversionMemory.has(key)) {
    while (pendingVerifiedConversionMemory.size >= pendingVerifiedConversionLimit) {
      const oldestKey = pendingVerifiedConversionMemory.keys().next().value;
      if (typeof oldestKey !== "string") break;
      pendingVerifiedConversionMemory.delete(oldestKey);
    }
  }
  pendingVerifiedConversionMemory.set(key, entry);
  return false;
}

export function clearPendingVerifiedConversions() {
  advanceMeasurementRevocationEpoch("analyticsPendingRevokedAt");
  advanceMeasurementRevocationEpoch("advertisingPendingRevokedAt");
  pendingVerifiedConversionMemory.clear();
  if (typeof window !== "undefined") {
    for (const storage of availableBrowserStorages()) {
      try {
        storage.removeItem(pendingVerifiedConversionStorageKey);
      } catch {
        // A blocked store cannot retain a new pending entry written by this tab.
      }
    }
  }
}

function pendingVerifiedConversionsAreDurable(
  entries: PendingVerifiedConversionEntry[]
) {
  if (typeof window === "undefined" || entries.length === 0) return false;
  for (const storage of availableBrowserStorages()) {
    try {
      const parsed = JSON.parse(
        storage.getItem(pendingVerifiedConversionStorageKey) ?? "[]"
      ) as unknown;
      if (!Array.isArray(parsed)) continue;
      const durableKeys = new Set(
        parsed
          .map((candidate) => normalizePendingVerifiedConversionEntry(candidate))
          .filter((candidate): candidate is PendingVerifiedConversionEntry => Boolean(candidate))
          .map((candidate) => pendingVerifiedConversionKey(candidate))
      );
      if (
        entries.every((entry) =>
          durableKeys.has(pendingVerifiedConversionKey(entry))
        )
      ) {
        return true;
      }
    } catch {
      // Try the remaining same-origin store.
    }
  }
  return false;
}

function hasPendingDestination(entry: PendingVerifiedConversionEntry) {
  return entry.analyticsState === "pending" || entry.advertisingState === "pending";
}

function retirePendingVerifiedConversionDestination(
  destination: "analytics" | "advertising"
) {
  advanceMeasurementRevocationEpoch(
    destination === "analytics"
      ? "analyticsPendingRevokedAt"
      : "advertisingPendingRevokedAt"
  );
  const stateKey = destination === "analytics" ? "analyticsState" : "advertisingState";
  const next = readPendingVerifiedConversions()
    .map((entry) => ({
      ...entry,
      [stateKey]: entry[stateKey] === "pending" ? "excluded" : entry[stateKey],
    }))
    .filter(hasPendingDestination);
  writePendingVerifiedConversions(next);
}

export function pendingVerifiedConversionCount() {
  return readPendingVerifiedConversions().filter(hasPendingDestination).length;
}

export function replaceWithPendingMeasurementCompletion(destination: unknown) {
  if (typeof window === "undefined") return false;
  const snapshot = readMeasurementConsentSnapshot();
  if (
    snapshot.needsDecision ||
    (!snapshot.preferences.analytics && !snapshot.preferences.advertising)
  ) {
    return false;
  }
  const entries = readPendingVerifiedConversions();
  if (!pendingVerifiedConversionsAreDurable(entries)) return false;
  return replaceWithMeasurementCompletion(destination);
}

export async function createPrivateConversionId(name: VerifiedConversionName, seed: string) {
  if (typeof window === "undefined" || !window.crypto?.subtle || !seed || seed.length > 500) {
    return null;
  }
  const bytes = new TextEncoder().encode(`mg:${name}:v1:${seed}`);
  const digest = await window.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function conversionWasQueued(destination: "ga4" | "ads", name: VerifiedConversionName, id: string) {
  try {
    const key = `${conversionDedupePrefix}:${destination}:${name}:${id}`;
    const value = window.localStorage.getItem(key);
    if (destination === "ga4") return value === "1";
    if (value === "1") {
      window.localStorage.setItem(key, String(Date.now()));
      return true;
    }
    const handedOffAt = Number(value);
    if (
      Number.isFinite(handedOffAt) &&
      handedOffAt > 0 &&
      handedOffAt <= Date.now() + 60_000 &&
      Date.now() - handedOffAt <= googleAdsConversionOutboxTtlMs
    ) {
      return true;
    }
    if (value !== null) window.localStorage.removeItem(key);
    return false;
  } catch {
    return false;
  }
}

function markConversionQueued(destination: "ga4" | "ads", name: VerifiedConversionName, id: string) {
  try {
    window.localStorage.setItem(
      `${conversionDedupePrefix}:${destination}:${name}:${id}`,
      destination === "ads" ? String(Date.now()) : "1"
    );
  } catch {
    // Provider-side transaction IDs remain the final duplicate defense.
  }
}

async function dispatchGa4VerifiedConversionWithAck(
  input: Pick<PendingVerifiedConversionEntry, "name" | "transactionId">,
  event: PublicAnalyticsEvent,
  target: AnalyticsWindow
) {
  const key = pendingVerifiedConversionKey(input);
  if (conversionWasQueued("ga4", input.name, input.transactionId)) return true;

  const existing = ga4ConversionAckWaiters.get(key);
  if (existing) {
    return waitForConversionAck(ga4ConversionAckWaiters, key, existing);
  }
  const inFlight = ga4ConversionsInFlight(target);
  // A queued gtag command may still be waiting for the provider script. Do not
  // enqueue the same GA4 event twice in one document merely because its callback
  // missed our short foreground budget. A new document may safely retry the
  // persisted anonymous conversion if this document never acknowledges it.
  if (inFlight.has(key)) return false;
  return runWithGa4ConversionClaim({
    name: input.name,
    transactionId: input.transactionId,
    canDeliver: hasAnalyticsConsent,
    deliver: async () => {
      // The receipt check belongs inside the browser-wide claim. A second tab
      // that arrived before the first callback must observe the receipt before
      // it is allowed to enqueue the same non-purchase GA4 event.
      if (conversionWasQueued("ga4", input.name, input.transactionId)) return true;
      const claimedExisting = ga4ConversionAckWaiters.get(key);
      if (claimedExisting) {
        return waitForConversionAck(ga4ConversionAckWaiters, key, claimedExisting);
      }
      if (inFlight.has(key) || !hasAnalyticsConsent()) return false;

      const waiter = getOrCreateConversionAckWaiter(ga4ConversionAckWaiters, key);
      inFlight.add(key);
      try {
        target.gtag?.("event", event.name, {
          ...event.params,
          event_timeout: 2_000,
          event_callback: () => {
            inFlight.delete(key);
            if (!hasAnalyticsConsent()) {
              settleConversionAck(ga4ConversionAckWaiters, key, false);
              return;
            }
            markConversionQueued("ga4", input.name, input.transactionId);
            settleConversionAck(ga4ConversionAckWaiters, key, true);
          },
        });
      } catch {
        inFlight.delete(key);
        settleConversionAck(ga4ConversionAckWaiters, key, false);
        return false;
      }
      if (conversionWasQueued("ga4", input.name, input.transactionId)) return true;
      return waitForConversionAck(ga4ConversionAckWaiters, key, waiter);
    },
  });
}

async function waitForGoogleAdsVerifiedConversionAck(
  input: Pick<PendingVerifiedConversionEntry, "name" | "transactionId">
) {
  if (conversionWasQueued("ads", input.name, input.transactionId)) return true;
  const key = googleAdsConversionKey(input.name, input.transactionId);
  const waiter = googleAdsConversionAckWaiters.get(key);
  return waiter
    ? waitForConversionAck(googleAdsConversionAckWaiters, key, waiter)
    : false;
}

async function dispatchVerifiedConversionById(input: {
  name: VerifiedConversionName;
  transactionId: string;
  createdAt: number;
  analyticsState: PendingVerifiedConversionDeliveryState;
  advertisingState: PendingVerifiedConversionDeliveryState;
  value?: number | null;
  currency?: string | null;
}) {
  if (
    typeof window === "undefined" ||
    !isGoogleMeasurementScriptPath(window.location.pathname)
  ) {
    return { analyticsAcknowledged: false, advertisingAcknowledged: false };
  }
  const preferences = readMeasurementConsent();
  const config = publicMeasurementConfiguration();
  try {
    initializeGoogleMeasurement(config);
  } catch {
    // A blocked or replaced provider function must not prevent the privacy-safe
    // Ads outbox from retaining this verified conversion for a later retry.
  }
  const target = ensureGoogleTagQueue();
  const currency = safeCurrency(input.currency);
  const value = safeConversionValue(input.value);
  const epochs = documentMeasurementRevocationEpochs();
  const analyticsRequired =
    input.analyticsState === "pending" &&
    (!epochs ||
      epochs.analyticsPendingRevokedAt === 0 ||
      input.createdAt > epochs.analyticsPendingRevokedAt);
  const advertisingRequired =
    input.advertisingState === "pending" &&
    (!epochs ||
      epochs.advertisingPendingRevokedAt === 0 ||
      input.createdAt > epochs.advertisingPendingRevokedAt);
  const analyticsConfigured =
    analyticsRequired &&
    preferences.analytics &&
    isValidGoogleAnalyticsMeasurementId(config.googleAnalyticsMeasurementId);
  const adsConfigured =
    advertisingRequired &&
    preferences.advertising &&
    isValidGoogleAdsId(config.googleAdsId) &&
    isValidGoogleAdsConversionLabel(conversionLabel(config, input.name));
  let analyticsAcknowledgement = Promise.resolve(!analyticsRequired);
  let advertisingAcknowledgement = Promise.resolve(!advertisingRequired);

  if (analyticsConfigured) {
    const event: PublicAnalyticsEvent | null = input.name === "registration"
      ? {
          name: "sign_up",
          params: {
            method: "customer_portal",
            content_group: "account_entry",
            transaction_id: input.transactionId,
            page_location: "https://file.mgautotech.de/auth/callback",
            page_referrer: "",
          },
        }
      : input.name === "request"
        ? {
            name: "generate_lead",
            params: {
              content_group: "secure_request_flow",
              request_channel: "web_portal",
              page_location: "https://file.mgautotech.de/new-request",
              page_referrer: "",
              transaction_id: input.transactionId,
            },
          }
        : currency && value !== null
          ? {
              name: "purchase",
              params: {
                currency,
                value,
                transaction_id: input.transactionId,
                content_group: "credit_purchase",
                page_location: "https://file.mgautotech.de/payment/success",
                page_referrer: "",
              },
            }
          : null;
    if (event) {
      analyticsAcknowledgement = dispatchGa4VerifiedConversionWithAck(
        input,
        event,
        target
      );
    }
  }

  if (adsConfigured) {
    const entry: GoogleAdsConversionOutboxEntry = {
      version: googleAdsConversionOutboxVersion,
      name: input.name,
      transactionId: input.transactionId,
      createdAt: freshMeasurementEntryCreatedAt(),
    };
    if (currency && value !== null) {
      entry.currency = currency;
      entry.value = value;
    }
    advertisingAcknowledgement = (async () => {
      enqueueGoogleAdsConversion(entry);
      await flushGoogleAdsConversionOutbox();
      return waitForGoogleAdsVerifiedConversionAck(input);
    })();
  }
  const [analyticsAcknowledged, advertisingAcknowledged] = await Promise.all([
    analyticsAcknowledgement,
    advertisingAcknowledgement,
  ]);
  return { analyticsAcknowledged, advertisingAcknowledged };
}

function applyPendingVerifiedConversionResult(
  entry: PendingVerifiedConversionEntry,
  result: {
    analyticsAcknowledged: boolean;
    advertisingAcknowledged: boolean;
  }
) {
  const key = pendingVerifiedConversionKey(entry);
  const currentEntries = readPendingVerifiedConversions();
  const current = currentEntries.find(
    (candidate) => pendingVerifiedConversionKey(candidate) === key
  );
  // Consent withdrawal may retire or remove this destination while the provider
  // callback is still in flight. Never recreate a row from that stale snapshot.
  if (!current) return false;
  const updated: PendingVerifiedConversionEntry = {
    ...current,
    analyticsState:
      current.analyticsState === "pending" && result.analyticsAcknowledged
        ? "complete"
        : current.analyticsState,
    advertisingState:
      current.advertisingState === "pending" && result.advertisingAcknowledged
        ? "complete"
        : current.advertisingState,
  };
  const entries = currentEntries.filter(
    (candidate) => pendingVerifiedConversionKey(candidate) !== key
  );
  if (hasPendingDestination(updated)) entries.push(updated);
  writePendingVerifiedConversions(entries);
  return !hasPendingDestination(updated);
}

export async function flushPendingVerifiedConversions() {
  if (typeof window === "undefined") return 0;
  const snapshot = readMeasurementConsentSnapshot();
  if (snapshot.needsDecision) return 0;
  if (!snapshot.preferences.analytics && !snapshot.preferences.advertising) {
    clearPendingVerifiedConversions();
    return 0;
  }

  const entries = readPendingVerifiedConversions();
  if (
    !isGoogleMeasurementScriptPath(window.location.pathname) ||
    !isGoogleMeasurementScriptReady()
  ) return 0;

  let queued = 0;
  const results = await Promise.all(
    entries.map((entry) =>
      dispatchVerifiedConversionById(entry).catch(() => null)
    )
  );
  for (const [index, result] of results.entries()) {
    const entry = entries[index];
    if (!entry || result === null) continue;
    if (applyPendingVerifiedConversionResult(entry, result)) queued += 1;
  }
  return queued;
}

async function dispatchVerifiedConversion(input: {
  name: VerifiedConversionName;
  seed: string;
  value?: number | null;
  currency?: string | null;
}) {
  if (typeof window === "undefined") return false;
  const transactionId = await createPrivateConversionId(input.name, input.seed);
  if (!transactionId) return false;

  const snapshot = readMeasurementConsentSnapshot();
  const currency = safeCurrency(input.currency);
  const value = safeConversionValue(input.value);
  if (snapshot.needsDecision) {
    if (input.name !== "registration") {
      const pending: PendingVerifiedConversionEntry = {
        version: 2,
        name: input.name,
        transactionId,
        createdAt: freshMeasurementEntryCreatedAt(),
        analyticsState: "pending",
        advertisingState: "pending",
      };
      if (currency && value !== null) {
        pending.currency = currency;
        pending.value = value;
      }
      enqueuePendingVerifiedConversion(pending, false);
    }
    return false;
  }
  if (!snapshot.preferences.analytics && !snapshot.preferences.advertising) {
    if (input.name !== "registration") {
      pendingVerifiedConversionMemory.delete(
        pendingVerifiedConversionKey({ name: input.name, transactionId })
      );
    }
    return false;
  }

  const pending: PendingVerifiedConversionEntry = {
    version: 2,
    name: input.name,
    transactionId,
    createdAt: freshMeasurementEntryCreatedAt(),
    analyticsState: snapshot.preferences.analytics ? "pending" : "excluded",
    advertisingState: snapshot.preferences.advertising ? "pending" : "excluded",
  };
  if (currency && value !== null) {
    pending.currency = currency;
    pending.value = value;
  }
  const pendingIsDurable = enqueuePendingVerifiedConversion(pending, true);

  if (!isGoogleMeasurementScriptPath(window.location.pathname)) {
    // Private customer pages never initialize or call Google. After an explicit
    // optional consent choice, retain only the anonymous transaction hash so a
    // later public or dedicated completion route can complete the handoff.
    return pendingIsDurable;
  }

  const result = await dispatchVerifiedConversionById(pending);
  return applyPendingVerifiedConversionResult(pending, result);
}

export function trackRegistrationCompleted(verifiedRegistrationSeed: string | null) {
  if (typeof window === "undefined") return Promise.resolve(false);
  const preferences = readMeasurementConsent();
  if (!preferences.analytics && !preferences.advertising) return Promise.resolve(false);
  const opaqueServerSeed =
    typeof verifiedRegistrationSeed === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      verifiedRegistrationSeed
    )
      ? verifiedRegistrationSeed
      : "";
  if (!opaqueServerSeed) return Promise.resolve(false);
  return dispatchVerifiedConversion({ name: "registration", seed: opaqueServerSeed });
}

export function trackRequestSubmitted(verifiedRequestSeed: string) {
  return dispatchVerifiedConversion({ name: "request", seed: verifiedRequestSeed });
}

export function trackPurchaseCompleted(input: {
  anonymousPaymentSeed: string;
  value: number;
  currency: string;
}) {
  return dispatchVerifiedConversion({
    name: "purchase",
    seed: input.anonymousPaymentSeed,
    value: input.value,
    currency: input.currency,
  });
}
