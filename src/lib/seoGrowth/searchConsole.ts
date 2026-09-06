import { isPublicAnalyticsPath, normalizeAnalyticsPath } from "@/lib/publicAnalytics";
import { boundedText, fetchGoogleJson, finiteNumber } from "@/lib/seoGrowth/googleHttp";
import type {
  SearchConsoleResponse,
  SearchCountryRow,
  SearchPageRow,
  SearchQueryRow,
} from "@/lib/seoGrowth/types";

type FetchLike = typeof fetch;

type SearchConsoleQueryInput = {
  siteUrl: string;
  accessToken: string;
  startDate: string;
  endDate: string;
  dimensions: Array<"query" | "page" | "country" | "date">;
  rowLimit: number;
  fetchFn?: FetchLike;
};

function normalizeReportedPage(value: unknown) {
  const raw = boundedText(value, 400);
  if (!raw) return null;
  const path = normalizeAnalyticsPath(raw);
  return path && isPublicAnalyticsPath(path) ? path : null;
}

function sanitizeSearchQuery(value: unknown) {
  const query = boundedText(value, 240);
  if (!query) return null;
  if (/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/i.test(query)) return null;
  if (/(?:\+?\d[\s().-]*){10,}/.test(query)) return null;
  return query;
}

async function querySearchConsole(input: SearchConsoleQueryInput) {
  return fetchGoogleJson<SearchConsoleResponse>({
    url: `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(input.siteUrl)}/searchAnalytics/query`,
    accessToken: input.accessToken,
    fetchFn: input.fetchFn,
    body: {
      startDate: input.startDate,
      endDate: input.endDate,
      dimensions: input.dimensions,
      type: "web",
      dataState: "final",
      aggregationType: "auto",
      // Domain properties can include the main site and other subdomains.
      // Filter before aggregation/row limits, including country-only reports.
      dimensionFilterGroups: [{
        groupType: "and",
        filters: [{
          dimension: "page",
          operator: "includingRegex",
          expression: "^https://file\\.mgautotech\\.de/",
        }],
      }],
      rowLimit: Math.min(1_000, Math.max(1, input.rowLimit)),
      startRow: 0,
    },
  });
}

export function parseSearchQueryRows(response: SearchConsoleResponse): SearchQueryRow[] {
  return (response.rows ?? []).flatMap((row) => {
    const query = sanitizeSearchQuery(row.keys?.[0]);
    const pagePath = normalizeReportedPage(row.keys?.[1]);
    if (!query || !pagePath) return [];
    return [{
      query,
      pagePath,
      clicks: finiteNumber(row.clicks),
      impressions: finiteNumber(row.impressions),
      ctr: finiteNumber(row.ctr),
      position: finiteNumber(row.position),
    }];
  });
}

export function parseSearchPageRows(response: SearchConsoleResponse): SearchPageRow[] {
  return (response.rows ?? []).flatMap((row) => {
    const pagePath = normalizeReportedPage(row.keys?.[0]);
    if (!pagePath) return [];
    return [{
      pagePath,
      clicks: finiteNumber(row.clicks),
      impressions: finiteNumber(row.impressions),
      ctr: finiteNumber(row.ctr),
      position: finiteNumber(row.position),
    }];
  });
}

export function parseSearchCountryRows(response: SearchConsoleResponse): SearchCountryRow[] {
  return (response.rows ?? []).flatMap((row) => {
    const countryCode = boundedText(row.keys?.[0], 8).toLowerCase();
    if (!/^[a-z]{3}$/.test(countryCode)) return [];
    return [{
      countryCode,
      clicks: finiteNumber(row.clicks),
      impressions: finiteNumber(row.impressions),
      ctr: finiteNumber(row.ctr),
      position: finiteNumber(row.position),
    }];
  });
}

export async function loadSearchConsoleDataset(input: Omit<SearchConsoleQueryInput, "dimensions" | "rowLimit">) {
  const [queryPage, pages, countries] = await Promise.all([
    querySearchConsole({ ...input, dimensions: ["query", "page"], rowLimit: 500 }),
    querySearchConsole({ ...input, dimensions: ["page"], rowLimit: 250 }),
    querySearchConsole({ ...input, dimensions: ["country"], rowLimit: 100 }),
  ]);

  return {
    queries: parseSearchQueryRows(queryPage),
    pages: parseSearchPageRows(pages),
    countries: parseSearchCountryRows(countries),
  };
}
