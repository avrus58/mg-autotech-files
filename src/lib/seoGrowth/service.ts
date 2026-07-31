import { getSeoDateRange, getSeoGrowthConfiguration } from "@/lib/seoGrowth/config";
import { getPublicSeoContentInventory } from "@/lib/seoGrowth/contentInventory";
import { getGoogleAccessToken } from "@/lib/seoGrowth/googleAuth";
import { loadGoogleAnalyticsDataset } from "@/lib/seoGrowth/googleAnalytics";
import {
  buildContentCoverage,
  buildSeoOpportunities,
  buildWeeklySeoActions,
} from "@/lib/seoGrowth/opportunityEngine";
import { loadSearchConsoleDataset } from "@/lib/seoGrowth/searchConsole";
import type {
  AnalyticsCountryRow,
  AnalyticsEventTotals,
  AnalyticsLandingPageRow,
  SearchCountryRow,
  SearchPageRow,
  SearchQueryRow,
  SeoGrowthReport,
  SeoReportRange,
} from "@/lib/seoGrowth/types";

type FetchLike = typeof fetch;
type EnvLike = Record<string, string | undefined>;

const emptyEvents: AnalyticsEventTotals = {
  pageViews: 0,
  navigationClicks: 0,
  requestCtaClicks: 0,
  requestStarts: 0,
  leads: 0,
};

function sum(rows: Array<Record<string, unknown>>, key: string) {
  return rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
}

function weightedPosition(rows: SearchPageRow[]) {
  const impressions = sum(rows, "impressions");
  if (!impressions) return null;
  return rows.reduce((total, row) => total + row.position * row.impressions, 0) / impressions;
}

function safeRate(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : null;
}

export async function buildSeoGrowthReport(input: {
  range: SeoReportRange;
  env?: EnvLike;
  fetchFn?: FetchLike;
  now?: Date;
}): Promise<SeoGrowthReport> {
  const now = input.now ?? new Date();
  const config = getSeoGrowthConfiguration(input.env ?? process.env);
  const dateRange = getSeoDateRange(input.range, now);
  const warnings: string[] = [];
  let queries: SearchQueryRow[] = [];
  let searchPages: SearchPageRow[] = [];
  let searchCountries: SearchCountryRow[] = [];
  let landingPages: AnalyticsLandingPageRow[] = [];
  let analyticsCountries: AnalyticsCountryRow[] = [];
  let eventTotals = { ...emptyEvents };
  let searchState: SeoGrowthReport["sources"]["searchConsole"]["state"] = config.searchConsoleConfigured ? "ready" : "not_configured";
  let analyticsState: SeoGrowthReport["sources"]["analytics"]["state"] = config.analyticsConfigured ? "ready" : "not_configured";
  let searchWarning: string | null = config.searchConsoleConfigured
    ? null
    : "Search Console server reporting is not configured.";
  let analyticsWarning: string | null = config.analyticsConfigured
    ? null
    : "GA4 Data API server reporting is not configured.";

  let accessToken: string | null = null;
  if (config.serviceAccountConfigured && (config.searchConsoleConfigured || config.analyticsConfigured)) {
    try {
      accessToken = await getGoogleAccessToken({
        clientEmail: config.serviceAccountEmail!,
        privateKey: config.serviceAccountPrivateKey!,
        scopes: [
          "https://www.googleapis.com/auth/webmasters.readonly",
          "https://www.googleapis.com/auth/analytics.readonly",
        ],
        fetchFn: input.fetchFn,
      });
    } catch {
      if (config.searchConsoleConfigured) {
        searchState = "error";
        searchWarning = "Search Console authorization could not be completed.";
      }
      if (config.analyticsConfigured) {
        analyticsState = "error";
        analyticsWarning = "GA4 authorization could not be completed.";
      }
    }
  }

  if (accessToken && config.searchConsoleConfigured) {
    try {
      const data = await loadSearchConsoleDataset({
        siteUrl: config.searchConsoleSiteUrl,
        accessToken,
        ...dateRange,
        fetchFn: input.fetchFn,
      });
      queries = data.queries;
      searchPages = data.pages;
      searchCountries = data.countries;
      searchState = "ready";
      searchWarning = data.queries.length || data.pages.length
        ? null
        : "Search Console returned no rows for the selected period.";
    } catch {
      searchState = "error";
      searchWarning = "Search Console reporting is temporarily unavailable.";
    }
  }

  if (accessToken && config.analyticsConfigured && config.analyticsPropertyId) {
    try {
      const data = await loadGoogleAnalyticsDataset({
        propertyId: config.analyticsPropertyId,
        accessToken,
        ...dateRange,
        fetchFn: input.fetchFn,
      });
      landingPages = data.landingPages;
      analyticsCountries = data.countries;
      eventTotals = data.eventTotals;
      analyticsState = "ready";
      analyticsWarning = data.landingPages.length || data.eventTotals.pageViews
        ? null
        : "GA4 returned no consented public-site rows for the selected period.";
    } catch {
      analyticsState = "error";
      analyticsWarning = "GA4 reporting is temporarily unavailable.";
    }
  }

  if (searchWarning) warnings.push(searchWarning);
  if (analyticsWarning) warnings.push(analyticsWarning);

  const opportunities = buildSeoOpportunities(queries, landingPages);
  const contentCoverage = buildContentCoverage(
    getPublicSeoContentInventory(),
    searchPages,
    landingPages
  );
  const weeklyActions = buildWeeklySeoActions({
    opportunities,
    searchCountries,
    analyticsCountries,
    contentCoverage,
  });
  const clicks = sum(searchPages, "clicks");
  const impressions = sum(searchPages, "impressions");
  const sessions = sum(landingPages, "sessions");

  return {
    generatedAt: now.toISOString(),
    range: input.range,
    dateRange,
    configuration: {
      serviceAccountConfigured: config.serviceAccountConfigured,
      searchConsoleConfigured: config.searchConsoleConfigured,
      analyticsConfigured: config.analyticsConfigured,
      searchConsoleProperty: config.searchConsoleSiteUrl,
      analyticsPropertyConfigured: Boolean(config.analyticsPropertyId),
    },
    sources: {
      searchConsole: { state: searchState, rowCount: queries.length, warning: searchWarning },
      analytics: { state: analyticsState, rowCount: landingPages.length, warning: analyticsWarning },
    },
    summary: {
      clicks,
      impressions,
      ctr: safeRate(clicks, impressions) ?? 0,
      averagePosition: weightedPosition(searchPages),
      sessions,
      requestCtaClicks: eventTotals.requestCtaClicks,
      requestStarts: eventTotals.requestStarts,
      leads: eventTotals.leads,
      requestStartRate: safeRate(eventTotals.requestStarts, sessions),
      leadRate: safeRate(eventTotals.leads, sessions),
      opportunityCount: opportunities.length,
      projectedAdditionalClicks: opportunities.reduce(
        (total, opportunity) => total + opportunity.projectedAdditionalClicks,
        0
      ),
    },
    eventTotals,
    opportunities,
    weeklyActions,
    queries: queries.slice(0, 250),
    searchPages: searchPages.slice(0, 100),
    searchCountries: searchCountries.slice(0, 50),
    landingPages: landingPages.slice(0, 100),
    analyticsCountries: analyticsCountries.slice(0, 50),
    contentCoverage,
    warnings,
    limitations: [
      "Search Console can omit anonymized and low-volume queries; reported rows are not a complete search log.",
      "Search queries are not joined to completed requests. Page opportunities use aggregate sessions and request CTA clicks only.",
      "GA4 rows include only consented public-site measurement and must not be interpreted as all visitors.",
      "CTR benchmarks are directional prioritization aids, not ranking or traffic guarantees.",
      "The center recommends review work only; it never edits, publishes or indexes content automatically.",
    ],
  };
}

const reportCache = new Map<SeoReportRange, { expiresAt: number; report: SeoGrowthReport }>();

export async function getCachedSeoGrowthReport(range: SeoReportRange) {
  const cached = reportCache.get(range);
  if (cached && cached.expiresAt > Date.now()) return cached.report;
  const report = await buildSeoGrowthReport({ range });
  reportCache.set(range, { expiresAt: Date.now() + 15 * 60 * 1000, report });
  return report;
}

export function resetSeoGrowthReportCacheForTests() {
  reportCache.clear();
}
