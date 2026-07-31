export const googleAnalyticsMeasurementIdPattern = /^G-[A-Z0-9]{6,14}$/;
export const analyticsConsentStorageKey = "mg_analytics_consent_v1";
export const analyticsPreferencesEvent = "mg:open-analytics-preferences";

export type AnalyticsConsent = "granted" | "denied";

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
      };
    };

export type PublicPageViewEvent = Extract<PublicAnalyticsEvent, { name: "page_view" }>;

type AnalyticsWindow = Window & {
  dataLayer?: unknown[][];
  gtag?: (...args: unknown[]) => void;
  __mgAnalyticsMeasurementId?: string;
};

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

export function isApprovedAnalyticsHost(hostname: string) {
  return hostname.trim().toLowerCase() === "file.mgautotech.de";
}

export function normalizeAnalyticsPath(value: string) {
  try {
    const url = new URL(value, "https://file.mgautotech.de");
    if (url.origin !== "https://file.mgautotech.de") return null;
    if (!url.pathname.startsWith("/") || url.pathname.length > 180) return null;
    if (/\p{Cc}/u.test(url.pathname)) return null;
    const normalized = url.pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
    return normalized;
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

export function readAnalyticsConsent(): AnalyticsConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(analyticsConsentStorageKey);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

export function writeAnalyticsConsent(consent: AnalyticsConsent) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(analyticsConsentStorageKey, consent);
  } catch {
    // A blocked storage API keeps analytics disabled for this page view.
  }
}

function ensureGoogleTagQueue() {
  const target = analyticsWindow();
  target.dataLayer = target.dataLayer ?? [];
  target.gtag = target.gtag ?? ((...args: unknown[]) => target.dataLayer?.push(args));
  return target;
}

export function initializeGoogleAnalytics(measurementId: string) {
  if (
    typeof window === "undefined" ||
    !isValidGoogleAnalyticsMeasurementId(measurementId) ||
    readAnalyticsConsent() !== "granted"
  ) {
    return false;
  }

  const target = ensureGoogleTagQueue();
  if (target.__mgAnalyticsMeasurementId === measurementId) {
    target.gtag?.("consent", "update", {
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    return true;
  }

  target.gtag?.("consent", "default", {
    analytics_storage: "granted",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
  target.gtag?.("js", new Date());
  target.gtag?.("config", measurementId, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
  target.__mgAnalyticsMeasurementId = measurementId;
  return true;
}

export function denyGoogleAnalytics() {
  if (typeof window === "undefined") return;
  const target = analyticsWindow();
  target.gtag?.("consent", "update", {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
}

export function dispatchPublicAnalyticsEvent(event: PublicAnalyticsEvent | null) {
  if (!event || typeof window === "undefined" || readAnalyticsConsent() !== "granted") {
    return false;
  }
  const target = ensureGoogleTagQueue();
  target.gtag?.("event", event.name, event.params);
  return true;
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

export function trackRequestSubmitted() {
  return dispatchPublicAnalyticsEvent({
    name: "generate_lead",
    params: {
      content_group: "secure_request_flow",
      request_channel: "web_portal",
      page_location: "https://file.mgautotech.de/new-request",
      page_referrer: "",
    },
  });
}
