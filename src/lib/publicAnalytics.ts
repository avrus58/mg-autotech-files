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
      };
    }
  | {
      name: "purchase";
      params: {
        currency: string;
        value: number;
        transaction_id: string;
        content_group: "credit_purchase";
      };
    };

export type PublicPageViewEvent = Extract<PublicAnalyticsEvent, { name: "page_view" }>;

type AnalyticsWindow = Window & {
  dataLayer?: unknown[][];
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

const registrationConversionSeedKey = "mg_registration_conversion_seed_v1";
const conversionDedupePrefix = "mg_verified_conversion_v1";

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
  target.gtag = target.gtag ?? ((...args: unknown[]) => target.dataLayer?.push(args));
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
  const preferences = readMeasurementConsent();
  const analyticsConfigured =
    preferences.analytics && isValidGoogleAnalyticsMeasurementId(config.googleAnalyticsMeasurementId);
  const adsConfigured = preferences.advertising && isValidGoogleAdsId(config.googleAdsId);
  if (!analyticsConfigured && !adsConfigured) return false;

  const target = ensureGoogleConsentDefault();
  target.gtag?.("consent", "update", consentCommand(preferences));
  if (!target.__mgConfiguredGoogleTags?.length) target.gtag?.("js", new Date());

  for (const tagId of [
    analyticsConfigured ? config.googleAnalyticsMeasurementId : "",
    adsConfigured ? config.googleAdsId : "",
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

function conversionLabel(
  config: GoogleAdsPublicConfiguration,
  name: VerifiedConversionName
) {
  if (name === "registration") return config.registrationLabel;
  if (name === "request") return config.requestLabel;
  return config.purchaseLabel;
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
    return window.localStorage.getItem(`${conversionDedupePrefix}:${destination}:${name}:${id}`) === "1";
  } catch {
    return false;
  }
}

function markConversionQueued(destination: "ga4" | "ads", name: VerifiedConversionName, id: string) {
  try {
    window.localStorage.setItem(`${conversionDedupePrefix}:${destination}:${name}:${id}`, "1");
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
  initializeGoogleMeasurement(config);
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
              },
            }
          : null;
    if (event) {
      target.gtag?.("event", event.name, event.params);
      markConversionQueued("ga4", input.name, transactionId);
      queued = true;
    }
  }

  const label = conversionLabel(config, input.name);
  if (
    preferences.advertising &&
    isValidGoogleAdsId(config.googleAdsId) &&
    isValidGoogleAdsConversionLabel(label) &&
    !conversionWasQueued("ads", input.name, transactionId)
  ) {
    const adsParams: Record<string, string | number> = {
      send_to: `${config.googleAdsId}/${label}`,
      transaction_id: transactionId,
    };
    if (currency && value !== null) {
      adsParams.currency = currency;
      adsParams.value = value;
    }
    target.gtag?.("event", "conversion", adsParams);
    markConversionQueued("ads", input.name, transactionId);
    queued = true;
  }
  return queued;
}

export function beginRegistrationConversion() {
  if (typeof window === "undefined") return null;
  const preferences = readMeasurementConsent();
  if (!preferences.analytics && !preferences.advertising) return null;
  try {
    const seed = window.crypto.randomUUID();
    window.localStorage.setItem(registrationConversionSeedKey, seed);
    return seed;
  } catch {
    return null;
  }
}

export function trackRegistrationCompleted() {
  if (typeof window === "undefined") return Promise.resolve(false);
  const preferences = readMeasurementConsent();
  if (!preferences.analytics && !preferences.advertising) return Promise.resolve(false);
  let seed = "";
  try {
    seed = window.localStorage.getItem(registrationConversionSeedKey) ?? "";
    if (!seed) {
      seed = window.crypto.randomUUID();
      window.localStorage.setItem(registrationConversionSeedKey, seed);
    }
  } catch {
    return Promise.resolve(false);
  }
  return dispatchVerifiedConversion({ name: "registration", seed });
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
