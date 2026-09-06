import { isPublicAnalyticsPath, normalizeAnalyticsPath } from "@/lib/publicAnalytics";
import { boundedText, fetchGoogleJson, finiteNumber } from "@/lib/seoGrowth/googleHttp";
import type {
  AnalyticsCountryRow,
  AnalyticsEventTotals,
  AnalyticsLandingPageRow,
  GoogleAnalyticsReportResponse,
} from "@/lib/seoGrowth/types";

type FetchLike = typeof fetch;

type AnalyticsRow = Record<string, string>;

const allowedEventNames = [
  "page_view",
  "public_navigation_click",
  "request_cta_click",
  "request_start",
  "generate_lead",
] as const;

export function parseGoogleAnalyticsRows(response: GoogleAnalyticsReportResponse): AnalyticsRow[] {
  const dimensions = (response.dimensionHeaders ?? []).map((header) => header.name ?? "");
  const metrics = (response.metricHeaders ?? []).map((header) => header.name ?? "");
  return (response.rows ?? []).map((row) => {
    const output: AnalyticsRow = {};
    dimensions.forEach((name, index) => {
      if (name) output[name] = boundedText(row.dimensionValues?.[index]?.value, 400);
    });
    metrics.forEach((name, index) => {
      if (name) output[name] = String(finiteNumber(row.metricValues?.[index]?.value));
    });
    return output;
  });
}

function eventTotal(rows: AnalyticsRow[], eventName: string) {
  return rows
    .filter((row) => row.eventName === eventName)
    .reduce((sum, row) => sum + finiteNumber(row.eventCount), 0);
}

export function buildAnalyticsEventTotals(rows: AnalyticsRow[]): AnalyticsEventTotals {
  return {
    pageViews: eventTotal(rows, "page_view"),
    navigationClicks: eventTotal(rows, "public_navigation_click"),
    requestCtaClicks: eventTotal(rows, "request_cta_click"),
    requestStarts: eventTotal(rows, "request_start"),
    leads: eventTotal(rows, "generate_lead"),
  };
}

function safeGaPath(value: string) {
  if (!value || value === "(not set)") return null;
  const path = normalizeAnalyticsPath(value);
  return path && (isPublicAnalyticsPath(path) || path === "/new-request") ? path : null;
}

export function buildAnalyticsLandingPages(
  landingRows: AnalyticsRow[],
  pageEventRows: AnalyticsRow[]
): AnalyticsLandingPageRow[] {
  const eventMap = new Map<string, AnalyticsEventTotals>();
  for (const row of pageEventRows) {
    const pagePath = safeGaPath(row.unifiedPagePathScreen);
    if (!pagePath || !allowedEventNames.includes(row.eventName as typeof allowedEventNames[number])) continue;
    const current = eventMap.get(pagePath) ?? {
      pageViews: 0,
      navigationClicks: 0,
      requestCtaClicks: 0,
      requestStarts: 0,
      leads: 0,
    };
    const value = finiteNumber(row.eventCount);
    if (row.eventName === "page_view") current.pageViews += value;
    if (row.eventName === "public_navigation_click") current.navigationClicks += value;
    if (row.eventName === "request_cta_click") current.requestCtaClicks += value;
    if (row.eventName === "request_start") current.requestStarts += value;
    if (row.eventName === "generate_lead") current.leads += value;
    eventMap.set(pagePath, current);
  }

  const landingMap = new Map<string, AnalyticsLandingPageRow>();
  for (const row of landingRows) {
    const pagePath = safeGaPath(row.landingPage);
    if (!pagePath) continue;
    const events = eventMap.get(pagePath);
    landingMap.set(pagePath, {
      pagePath,
      sessions: finiteNumber(row.sessions),
      activeUsers: finiteNumber(row.activeUsers),
      pageViews: finiteNumber(row.screenPageViews) || events?.pageViews || 0,
      engagementRate: finiteNumber(row.engagementRate),
      requestCtaClicks: events?.requestCtaClicks ?? 0,
      requestStarts: events?.requestStarts ?? 0,
      leads: events?.leads ?? 0,
    });
  }

  for (const [pagePath, events] of eventMap.entries()) {
    if (landingMap.has(pagePath)) continue;
    landingMap.set(pagePath, {
      pagePath,
      sessions: 0,
      activeUsers: 0,
      pageViews: events.pageViews,
      engagementRate: 0,
      requestCtaClicks: events.requestCtaClicks,
      requestStarts: events.requestStarts,
      leads: events.leads,
    });
  }

  return [...landingMap.values()].sort((a, b) => b.sessions - a.sessions);
}

export function buildAnalyticsCountries(
  sessionRows: AnalyticsRow[],
  eventRows: AnalyticsRow[]
): AnalyticsCountryRow[] {
  const countries = new Map<string, AnalyticsCountryRow>();
  for (const row of sessionRows) {
    const country = boundedText(row.country, 80);
    if (!country || country === "(not set)") continue;
    countries.set(country, {
      country,
      sessions: finiteNumber(row.sessions),
      activeUsers: finiteNumber(row.activeUsers),
      requestStarts: 0,
      leads: 0,
    });
  }
  for (const row of eventRows) {
    const country = boundedText(row.country, 80);
    if (!country || country === "(not set)") continue;
    const current = countries.get(country) ?? {
      country,
      sessions: 0,
      activeUsers: 0,
      requestStarts: 0,
      leads: 0,
    };
    if (row.eventName === "request_start") current.requestStarts += finiteNumber(row.eventCount);
    if (row.eventName === "generate_lead") current.leads += finiteNumber(row.eventCount);
    countries.set(country, current);
  }
  return [...countries.values()].sort((a, b) => b.sessions - a.sessions);
}

async function runAnalyticsReport(input: {
  propertyId: string;
  accessToken: string;
  startDate: string;
  endDate: string;
  dimensions: string[];
  metrics: string[];
  limit: number;
  eventFilter?: boolean;
  fetchFn?: FetchLike;
}) {
  return fetchGoogleJson<GoogleAnalyticsReportResponse>({
    url: `https://analyticsdata.googleapis.com/v1beta/properties/${input.propertyId}:runReport`,
    accessToken: input.accessToken,
    fetchFn: input.fetchFn,
    body: {
      dateRanges: [{ startDate: input.startDate, endDate: input.endDate }],
      dimensions: input.dimensions.map((name) => ({ name })),
      metrics: input.metrics.map((name) => ({ name })),
      limit: String(Math.min(1_000, Math.max(1, input.limit))),
      keepEmptyRows: false,
      // A shared GA4 property must not mix the main site, previews or local QA
      // with the File Service's aggregate sessions, countries and events.
      dimensionFilter: {
        andGroup: {
          expressions: [
            {
              filter: {
                fieldName: "hostName",
                stringFilter: {
                  matchType: "EXACT",
                  value: "file.mgautotech.de",
                  caseSensitive: false,
                },
              },
            },
            ...(input.eventFilter ? [{
              filter: {
                fieldName: "eventName",
                inListFilter: { values: [...allowedEventNames], caseSensitive: true },
              },
            }] : []),
          ],
        },
      },
    },
  });
}

export async function loadGoogleAnalyticsDataset(input: {
  propertyId: string;
  accessToken: string;
  startDate: string;
  endDate: string;
  fetchFn?: FetchLike;
}) {
  const shared = {
    propertyId: input.propertyId,
    accessToken: input.accessToken,
    startDate: input.startDate,
    endDate: input.endDate,
    fetchFn: input.fetchFn,
  };
  const [landingResponse, pageEventsResponse, eventTotalsResponse, countryResponse, countryEventsResponse] = await Promise.all([
    runAnalyticsReport({ ...shared, dimensions: ["landingPage"], metrics: ["sessions", "activeUsers", "screenPageViews", "engagementRate"], limit: 250 }),
    runAnalyticsReport({ ...shared, dimensions: ["unifiedPagePathScreen", "eventName"], metrics: ["eventCount"], limit: 1_000, eventFilter: true }),
    runAnalyticsReport({ ...shared, dimensions: ["eventName"], metrics: ["eventCount"], limit: 20, eventFilter: true }),
    runAnalyticsReport({ ...shared, dimensions: ["country"], metrics: ["sessions", "activeUsers"], limit: 100 }),
    runAnalyticsReport({ ...shared, dimensions: ["country", "eventName"], metrics: ["eventCount"], limit: 500, eventFilter: true }),
  ]);

  const landingRows = parseGoogleAnalyticsRows(landingResponse);
  const pageEventRows = parseGoogleAnalyticsRows(pageEventsResponse);
  const eventRows = parseGoogleAnalyticsRows(eventTotalsResponse);
  const countryRows = parseGoogleAnalyticsRows(countryResponse);
  const countryEventRows = parseGoogleAnalyticsRows(countryEventsResponse);

  return {
    landingPages: buildAnalyticsLandingPages(landingRows, pageEventRows),
    countries: buildAnalyticsCountries(countryRows, countryEventRows),
    eventTotals: buildAnalyticsEventTotals(eventRows),
  };
}
