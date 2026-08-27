export const googleAnalyticsMeasurementIdPattern = /^G-[A-Z0-9]{6,14}$/;
export const googleAdsIdPattern = /^AW-\d{6,15}$/;
export const googleAdsConversionLabelPattern = /^[A-Za-z0-9_-]{6,40}$/;
export const analyticsConsentStorageKey = "mg_analytics_consent_v1";
export const measurementConsentStorageKey = "mg_measurement_consent_v2";
export const analyticsPreferencesEvent = "mg:open-analytics-preferences";
export const measurementConsentVersion = "consent-mode-v2" as const;

export type AnalyticsConsent = "granted" | "denied";

export type MeasurementConsentPreferences = {
  analytics: boolean;
  advertising: boolean;
  version: typeof measurementConsentVersion;
  updatedAt: string;
};

export type MeasurementConsentSnapshot = {
  preferences: MeasurementConsentPreferences;
  source: "v2" | "legacy_granted" | "legacy_denied" | "none";
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
      name: "request_start" | "generate_lead";
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
  "/services",
  "/tools",
  "/widerruf",
  "/widget",
  "/workshop-guides",
]);

const conversionDedupePrefix = "mg_verified_conversion_v1";
export const googleAdsConversionOutboxStorageKey =
  "mg_google_ads_conversion_outbox_v1";
const googleAdsConversionOutboxVersion = 1 as const;
const googleAdsConversionOutboxLimit = 24;
const googleAdsConversionOutboxTtlMs = 7 * 24 * 60 * 60 * 1000;
const googleAdsConversionRetryDelays = [2_500, 10_000] as const;

type GoogleAdsConversionOutboxEntry = {
  version: typeof googleAdsConversionOutboxVersion;
  name: VerifiedConversionName;
  transactionId: string;
  createdAt: number;
  value?: number;
  currency?: string;
};

let initializedMeasurementConfiguration: GoogleAdsPublicConfiguration | null = null;
const googleAdsConversionsInFlight = new Set<string>();
const googleAdsConversionMemoryOutbox = new Map<
  string,
  GoogleAdsConversionOutboxEntry
>();
const googleAdsConversionRetryCounts = new Map<string, number>();
const googleAdsConversionRetryTimers = new Map<
  string,
  ReturnType<typeof globalThis.setTimeout>
>();

function analyticsWindow() {
  return window as AnalyticsWindow;
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
    const parsed = JSON.parse(value) as Partial<MeasurementConsentPreferences>;
    if (
      parsed.version !== measurementConsentVersion ||
      typeof parsed.analytics !== "boolean" ||
      typeof parsed.advertising !== "boolean" ||
      typeof parsed.updatedAt !== "string" ||
      !Number.isFinite(new Date(parsed.updatedAt).getTime())
    ) {
      return null;
    }
    return parsed as MeasurementConsentPreferences;
  } catch {
    return null;
  }
}

export function readMeasurementConsentSnapshot(): MeasurementConsentSnapshot {
  const fallback = necessaryOnlyPreferences();
  if (typeof window === "undefined") {
    return { preferences: fallback, source: "none", needsDecision: true };
  }
  try {
    const current = parseMeasurementConsent(
      window.localStorage.getItem(measurementConsentStorageKey)
    );
    if (current) return { preferences: current, source: "v2", needsDecision: false };

    const legacy = window.localStorage.getItem(analyticsConsentStorageKey);
    if (legacy === "granted") {
      return {
        preferences: { ...fallback, analytics: true },
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

export function readMeasurementConsent() {
  return readMeasurementConsentSnapshot().preferences;
}

export function hasAnalyticsConsent() {
  return readMeasurementConsent().analytics;
}

export function hasAdvertisingMeasurementConsent() {
  return readMeasurementConsent().advertising;
}

export function writeMeasurementConsent(input: Pick<MeasurementConsentPreferences, "analytics" | "advertising">) {
  if (typeof window === "undefined") return;
  const preferences: MeasurementConsentPreferences = {
    analytics: input.analytics,
    advertising: input.advertising,
    version: measurementConsentVersion,
    updatedAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(measurementConsentStorageKey, JSON.stringify(preferences));
    window.localStorage.setItem(
      analyticsConsentStorageKey,
      preferences.analytics ? "granted" : "denied"
    );
  } catch {
    // A blocked storage API keeps optional measurement disabled for the next page view.
  }
  if (!preferences.advertising) clearGoogleAdsConversionOutbox();
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
  return {
    analytics_storage: preferences.analytics ? "granted" : "denied",
    ad_storage: preferences.advertising ? "granted" : "denied",
    ad_user_data: preferences.advertising ? "granted" : "denied",
    ad_personalization: "denied",
    functionality_storage: "granted",
    security_storage: "granted",
  } as const;
}

function ensureGoogleConsentDefault() {
  const target = ensureGoogleTagQueue();
  if (target.__mgGoogleConsentDefaultSet) return target;
  target.gtag?.("consent", "default", {
    ...consentCommand(necessaryOnlyPreferences()),
    wait_for_update: 500,
  });
  target.__mgGoogleConsentDefaultSet = true;
  return target;
}

export function initializeGoogleMeasurement(config: GoogleAdsPublicConfiguration) {
  if (typeof window === "undefined") return false;
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

  const target = ensureGoogleConsentDefault();
  target.gtag?.("consent", "update", consentCommand(preferences));
  if (!target.__mgConfiguredGoogleTags?.length) target.gtag?.("js", new Date());

  for (const tagId of [
    analyticsConfigured
      ? initializedMeasurementConfiguration.googleAnalyticsMeasurementId
      : "",
    adsConfigured ? initializedMeasurementConfiguration.googleAdsId : "",
  ].filter(Boolean)) {
    if (target.__mgConfiguredGoogleTags?.includes(tagId)) continue;
    target.gtag?.("config", tagId, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
    target.__mgConfiguredGoogleTags?.push(tagId);
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
  if (typeof window === "undefined") return;
  const target = ensureGoogleConsentDefault();
  target.gtag?.("consent", "update", consentCommand(necessaryOnlyPreferences()));
}

export const denyGoogleAnalytics = denyGoogleMeasurement;

export function dispatchPublicAnalyticsEvent(event: PublicAnalyticsEvent | null) {
  if (!event || typeof window === "undefined" || !hasAnalyticsConsent()) return false;
  const target = ensureGoogleTagQueue();
  target.gtag?.("event", event.name, event.params);
  return true;
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
  const boundedEntries = entries.slice(-googleAdsConversionOutboxLimit);
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
  googleAdsConversionMemoryOutbox.clear();
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(googleAdsConversionOutboxStorageKey);
      const adsDedupePrefix = `${conversionDedupePrefix}:ads:`;
      for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
        const key = window.localStorage.key(index);
        if (key?.startsWith(adsDedupePrefix)) {
          window.localStorage.removeItem(key);
        }
      }
    } catch {
      // A blocked storage API already prevents optional persistence.
    }
  }
  for (const key of [...googleAdsConversionRetryTimers.keys()]) {
    clearGoogleAdsConversionRetry(key);
  }
  googleAdsConversionsInFlight.clear();
}

function enqueueGoogleAdsConversion(
  entry: GoogleAdsConversionOutboxEntry
) {
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
  transactionId: string
) {
  const key = googleAdsConversionKey(name, transactionId);
  writeGoogleAdsConversionOutbox(
    readGoogleAdsConversionOutbox().filter(
      (entry) => googleAdsConversionKey(entry.name, entry.transactionId) !== key
    )
  );
  clearGoogleAdsConversionRetry(key);
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
  for (const key of [...googleAdsConversionsInFlight]) {
    clearGoogleAdsConversionRetry(key);
  }
}

export async function notifyGoogleMeasurementScriptLoaded() {
  return flushGoogleAdsConversionOutbox();
}

export async function flushGoogleAdsConversionOutbox() {
  if (
    typeof window === "undefined" ||
    !hasAdvertisingMeasurementConsent() ||
    (!isPublicAnalyticsPath(window.location.pathname) &&
      !isConversionMeasurementPath(window.location.pathname))
  ) {
    return 0;
  }

  const config = publicMeasurementConfiguration();
  if (!isValidGoogleAdsId(config.googleAdsId)) return 0;
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
    const adsParams: Record<string, unknown> = {
      send_to: `${config.googleAdsId}/${label}`,
      transaction_id: entry.transactionId,
      page_location: verifiedConversionPageLocation(entry.name),
      page_referrer: "",
      event_timeout: 2_000,
      event_callback: () => {
        if (!hasAdvertisingMeasurementConsent()) {
          clearGoogleAdsConversionRetry(key);
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

async function dispatchVerifiedConversion(input: {
  name: VerifiedConversionName;
  seed: string;
  value?: number | null;
  currency?: string | null;
}) {
  if (typeof window === "undefined") return false;
  const transactionId = await createPrivateConversionId(input.name, input.seed);
  if (!transactionId) return false;

  const preferences = readMeasurementConsent();
  const config = publicMeasurementConfiguration();
  try {
    initializeGoogleMeasurement(config);
  } catch {
    // A blocked or replaced provider function must not prevent the privacy-safe
    // Ads outbox from retaining this verified conversion for a later retry.
  }
  const target = ensureGoogleTagQueue();
  let queued = false;
  const currency = safeCurrency(input.currency);
  const value = safeConversionValue(input.value);

  if (
    preferences.analytics &&
    isValidGoogleAnalyticsMeasurementId(config.googleAnalyticsMeasurementId) &&
    !conversionWasQueued("ga4", input.name, transactionId)
  ) {
    const event: PublicAnalyticsEvent | null = input.name === "registration"
      ? {
          name: "sign_up",
          params: {
            method: "customer_portal",
            content_group: "account_entry",
            transaction_id: transactionId,
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
              transaction_id: transactionId,
            },
          }
        : currency && value !== null
          ? {
              name: "purchase",
              params: {
                currency,
                value,
                transaction_id: transactionId,
                content_group: "credit_purchase",
                page_location: "https://file.mgautotech.de/payment/success",
                page_referrer: "",
              },
            }
          : null;
    if (event) {
      try {
        target.gtag?.("event", event.name, event.params);
        markConversionQueued("ga4", input.name, transactionId);
        queued = true;
      } catch {
        // Ads delivery below remains independently retryable.
      }
    }
  }

  if (
    preferences.advertising &&
    isValidGoogleAdsId(config.googleAdsId) &&
    !conversionWasQueued("ads", input.name, transactionId)
  ) {
    const entry: GoogleAdsConversionOutboxEntry = {
      version: googleAdsConversionOutboxVersion,
      name: input.name,
      transactionId,
      createdAt: Date.now(),
    };
    if (currency && value !== null) {
      entry.currency = currency;
      entry.value = value;
    }
    enqueueGoogleAdsConversion(entry);
    await flushGoogleAdsConversionOutbox();
    queued = true;
  }
  return queued;
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

export function trackRequestStarted() {
  return dispatchPublicAnalyticsEvent({
    name: "request_start",
    params: {
      content_group: "secure_request_flow",
      request_channel: "web_portal",
      page_location: "https://file.mgautotech.de/new-request",
      page_referrer: "",
    },
  });
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
