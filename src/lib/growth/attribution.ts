import type { GrowthAttributionTouch } from "@/lib/growth/types";

export const growthVisitorStorageKey = "mg_growth_visitor_v1";
export const growthConsentVersion = "analytics-v1";

const allowedCampaignValue = /^[a-z0-9][a-z0-9._~+\-/ ]{0,79}$/i;
const allowedLocale = /^[a-z]{2}(?:-[a-z]{2})?$/i;

function cleanCampaignValue(value: string | null, maxLength = 80) {
  if (!value) return null;
  const clean = value.trim().replace(/\s+/g, " ").slice(0, maxLength);
  return clean && allowedCampaignValue.test(clean) ? clean : null;
}

export function normalizeGrowthPath(value: string) {
  try {
    const parsed = new URL(value, "https://file.mgautotech.de");
    if (parsed.origin !== "https://file.mgautotech.de") return null;
    if (!parsed.pathname.startsWith("/") || parsed.pathname.length > 180) return null;
    if (/\p{Cc}/u.test(parsed.pathname)) return null;
    return parsed.pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
  } catch {
    return null;
  }
}

export function normalizeReferrerHost(value: string | null | undefined) {
  if (!value) return null;
  try {
    const hostname = new URL(value).hostname.toLowerCase().replace(/^www\./, "");
    if (!hostname || hostname.length > 120 || !/^[a-z0-9.-]+$/.test(hostname)) return null;
    return hostname === "file.mgautotech.de" ? null : hostname;
  } catch {
    return null;
  }
}

export function classifyGrowthSource(input: {
  utmSource?: string | null;
  utmMedium?: string | null;
  referrer?: string | null;
}) {
  const explicitSource = cleanCampaignValue(input.utmSource ?? null, 48)?.toLowerCase();
  const explicitMedium = cleanCampaignValue(input.utmMedium ?? null, 48)?.toLowerCase();
  if (explicitSource) {
    return {
      source: explicitSource,
      medium: explicitMedium || "campaign",
      referrerHost: normalizeReferrerHost(input.referrer),
    };
  }

  const referrerHost = normalizeReferrerHost(input.referrer);
  if (!referrerHost) return { source: "direct", medium: "none", referrerHost: null };
  if (/(^|\.)google\./.test(referrerHost)) return { source: "google", medium: "organic", referrerHost };
  if (/(^|\.)bing\.com$/.test(referrerHost)) return { source: "bing", medium: "organic", referrerHost };
  if (/(^|\.)yahoo\./.test(referrerHost)) return { source: "yahoo", medium: "organic", referrerHost };
  if (/(^|\.)duckduckgo\.com$/.test(referrerHost)) return { source: "duckduckgo", medium: "organic", referrerHost };
  return { source: referrerHost, medium: "referral", referrerHost };
}

export function buildGrowthAttributionTouch(input: {
  url: string;
  referrer?: string | null;
  locale?: string | null;
}): GrowthAttributionTouch | null {
  let parsed: URL;
  try {
    parsed = new URL(input.url, "https://file.mgautotech.de");
  } catch {
    return null;
  }

  const landingPath = normalizeGrowthPath(parsed.pathname);
  if (!landingPath) return null;
  const classified = classifyGrowthSource({
    utmSource: parsed.searchParams.get("utm_source"),
    utmMedium: parsed.searchParams.get("utm_medium"),
    referrer: input.referrer,
  });
  const locale = input.locale?.trim().toLowerCase() ?? "";

  return {
    landingPath,
    source: classified.source,
    medium: classified.medium,
    campaign: cleanCampaignValue(parsed.searchParams.get("utm_campaign")),
    term: cleanCampaignValue(parsed.searchParams.get("utm_term")),
    referrerHost: classified.referrerHost,
    locale: allowedLocale.test(locale) ? locale : null,
  };
}

export function isGrowthVisitorId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function normalizeGrowthCountry(value: string | null | undefined) {
  const clean = value?.trim().toUpperCase() ?? "";
  return /^[A-Z]{2}$/.test(clean) ? clean : null;
}
