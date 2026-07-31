import { seoReportRanges, type SeoReportRange } from "@/lib/seoGrowth/types";

type EnvLike = Record<string, string | undefined>;

export type SeoGrowthConfiguration = {
  serviceAccountEmail: string | null;
  serviceAccountPrivateKey: string | null;
  searchConsoleSiteUrl: string;
  analyticsPropertyId: string | null;
  serviceAccountConfigured: boolean;
  searchConsoleConfigured: boolean;
  analyticsConfigured: boolean;
};

const defaultSearchConsoleSite = "sc-domain:mgautotech.de";

function clean(value: string | undefined) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

export function normalizeGooglePrivateKey(value: string | null) {
  return value?.replace(/\\n/g, "\n") ?? null;
}

export function isValidServiceAccountEmail(value: string | null) {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.iam\.gserviceaccount\.com$/i.test(value));
}

export function isValidSearchConsoleSiteUrl(value: string) {
  if (/^sc-domain:[a-z0-9.-]+$/i.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function normalizeAnalyticsPropertyId(value: string | null) {
  if (!value) return null;
  const normalized = value.replace(/^properties\//, "");
  return /^\d{4,20}$/.test(normalized) ? normalized : null;
}

export function getSeoGrowthConfiguration(env: EnvLike = process.env): SeoGrowthConfiguration {
  const email = clean(env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
  const privateKey = normalizeGooglePrivateKey(clean(env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY));
  const siteCandidate = clean(env.GOOGLE_SEARCH_CONSOLE_SITE_URL) ?? defaultSearchConsoleSite;
  const siteUrl = isValidSearchConsoleSiteUrl(siteCandidate)
    ? siteCandidate
    : defaultSearchConsoleSite;
  const propertyId = normalizeAnalyticsPropertyId(clean(env.GOOGLE_ANALYTICS_PROPERTY_ID));
  const serviceAccountConfigured = Boolean(
    isValidServiceAccountEmail(email) && privateKey?.includes("BEGIN PRIVATE KEY")
  );

  return {
    serviceAccountEmail: serviceAccountConfigured ? email : null,
    serviceAccountPrivateKey: serviceAccountConfigured ? privateKey : null,
    searchConsoleSiteUrl: siteUrl,
    analyticsPropertyId: propertyId,
    serviceAccountConfigured,
    searchConsoleConfigured: serviceAccountConfigured && isValidSearchConsoleSiteUrl(siteUrl),
    analyticsConfigured: serviceAccountConfigured && Boolean(propertyId),
  };
}

export function parseSeoReportRange(value: string | null | undefined): SeoReportRange {
  return seoReportRanges.includes(value as SeoReportRange)
    ? (value as SeoReportRange)
    : "28d";
}

export function getSeoDateRange(range: SeoReportRange, now = new Date()) {
  const delayDays = 3;
  const days = range === "90d" ? 90 : 28;
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  end.setUTCDate(end.getUTCDate() - delayDays);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    searchConsoleDelayDays: delayDays,
  };
}
