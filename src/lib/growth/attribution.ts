import type { GrowthAttributionTouch } from "@/lib/growth/types";
import { normalizeGoogleAdsCampaignToken } from "@/lib/googleAds/campaignTokens";
import {
  isFirstPartyAttributionPublicPath,
  isSafeGoogleAdsClickSignalValue,
} from "@/lib/publicAnalytics";

export const growthVisitorStorageKey = "mg_growth_visitor_v1";
export const growthConsentVersion = "analytics-v1";

const allowedLocale = /^[a-z]{2}(?:-[a-z]{2})?$/i;

function isKnownAttributionClassification(
  source: string,
  medium: string,
  referrerHost: string | null
) {
  if (source === "direct" && medium === "none") return referrerHost === null;
  if (source === "google" && medium === "cpc") return true;
  if (medium === "organic" && referrerHost) {
    if (source === "google") return /(^|\.)google\./.test(referrerHost);
    if (source === "bing") return /(^|\.)bing\.com$/.test(referrerHost);
    if (source === "yahoo") return /(^|\.)yahoo\./.test(referrerHost);
    if (source === "duckduckgo") return /(^|\.)duckduckgo\.com$/.test(referrerHost);
  }
  return medium === "referral" && Boolean(referrerHost) && source === referrerHost;
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
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) return null;
    return hostname === "file.mgautotech.de" ? null : hostname;
  } catch {
    return null;
  }
}

export function classifyGrowthSource(input: {
  utmSource?: string | null;
  utmMedium?: string | null;
  referrer?: string | null;
  hasGoogleAdsClickSignal?: boolean;
}) {
  const explicitSource = input.utmSource?.trim().toLowerCase() ?? "";
  const explicitMedium = input.utmMedium?.trim().toLowerCase() ?? "";
  if (explicitSource === "google" && explicitMedium === "cpc") {
    return {
      source: "google",
      medium: "cpc",
      referrerHost: normalizeReferrerHost(input.referrer),
    };
  }

  if (input.hasGoogleAdsClickSignal) {
    return {
      source: "google",
      medium: "cpc",
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
  if (!landingPath || !isFirstPartyAttributionPublicPath(landingPath)) return null;
  const classified = classifyGrowthSource({
    utmSource: parsed.searchParams.get("utm_source"),
    utmMedium: parsed.searchParams.get("utm_medium"),
    referrer: input.referrer,
    hasGoogleAdsClickSignal: ["gclid", "dclid", "gbraid", "wbraid"].some((key) =>
      parsed.searchParams
        .getAll(key)
        .some(isSafeGoogleAdsClickSignalValue)
    ),
  });
  const locale = input.locale?.trim().toLowerCase() ?? "";

  const paidCampaign = classified.source === "google" && classified.medium === "cpc"
    ? normalizeGoogleAdsCampaignToken(parsed.searchParams.get("utm_campaign"))
    : null;

  return {
    landingPath,
    source: classified.source,
    medium: classified.medium,
    campaign: paidCampaign,
    // Search terms can contain free-form customer or vehicle information and
    // are not used by the campaign-level Growth report.
    term: null,
    referrerHost: classified.referrerHost,
    locale: allowedLocale.test(locale) ? locale : null,
  };
}

export function normalizeGrowthAttributionTouch(
  value: unknown
): GrowthAttributionTouch | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<GrowthAttributionTouch>;
  const landingPath = typeof candidate.landingPath === "string"
    ? normalizeGrowthPath(candidate.landingPath)
    : null;
  if (!landingPath || !isFirstPartyAttributionPublicPath(landingPath)) return null;
  const referrerHost = candidate.referrerHost === null
    ? null
    : typeof candidate.referrerHost === "string"
      ? normalizeReferrerHost(`https://${candidate.referrerHost}`)
      : undefined;
  if (referrerHost === undefined) return null;
  const source = typeof candidate.source === "string"
    ? candidate.source.trim().toLowerCase()
    : "";
  const medium = typeof candidate.medium === "string"
    ? candidate.medium.trim().toLowerCase()
    : "";
  if (!isKnownAttributionClassification(source, medium, referrerHost)) return null;
  const nullableCampaignValue = (input: unknown) => {
    if (input === null) return null;
    if (typeof input !== "string") return undefined;
    return normalizeGoogleAdsCampaignToken(input) ?? undefined;
  };
  const campaign = nullableCampaignValue(candidate.campaign);
  if (campaign === undefined) return null;
  if (campaign && (source !== "google" || medium !== "cpc")) return null;
  const locale = candidate.locale === null
    ? null
    : typeof candidate.locale === "string" && allowedLocale.test(candidate.locale.trim())
      ? candidate.locale.trim().toLowerCase()
      : undefined;
  if (locale === undefined) return null;

  return {
    landingPath,
    source,
    medium,
    campaign,
    term: null,
    referrerHost,
    locale,
  };
}

export function growthAttributionTouchKey(touch: GrowthAttributionTouch) {
  return JSON.stringify([
    touch.landingPath,
    touch.source,
    touch.medium,
    touch.campaign,
    touch.term,
    touch.referrerHost,
    touch.locale,
  ]);
}

export function uniqueGrowthAttributionTouches(
  ...touches: Array<GrowthAttributionTouch | null | undefined>
) {
  const seen = new Set<string>();
  const unique: GrowthAttributionTouch[] = [];
  for (const touch of touches) {
    if (!touch) continue;
    const key = growthAttributionTouchKey(touch);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(touch);
  }
  return unique;
}

export function selectGrowthAttributionTouchesForRoute(input: {
  pathname: string;
  initialTouch: GrowthAttributionTouch | null;
  currentTouch: GrowthAttributionTouch | null;
}) {
  const initialTouch = input.initialTouch &&
    isFirstPartyAttributionPublicPath(input.initialTouch.landingPath)
    ? input.initialTouch
    : null;
  const currentTouch =
    isFirstPartyAttributionPublicPath(input.pathname) &&
    input.currentTouch?.landingPath === input.pathname &&
    isFirstPartyAttributionPublicPath(input.currentTouch.landingPath)
      ? input.currentTouch
      : null;

  return uniqueGrowthAttributionTouches(initialTouch, currentTouch);
}

export function isGrowthVisitorId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function normalizeGrowthCountry(value: string | null | undefined) {
  const clean = value?.trim().toUpperCase() ?? "";
  return /^[A-Z]{2}$/.test(clean) ? clean : null;
}
