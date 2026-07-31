export const seoReportRanges = ["28d", "90d"] as const;

export type SeoReportRange = (typeof seoReportRanges)[number];

export type SeoSourceState = "ready" | "not_configured" | "partial" | "error";

export type SearchQueryRow = {
  query: string;
  pagePath: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type SearchPageRow = Omit<SearchQueryRow, "query">;

export type SearchCountryRow = {
  countryCode: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type AnalyticsLandingPageRow = {
  pagePath: string;
  sessions: number;
  activeUsers: number;
  pageViews: number;
  engagementRate: number;
  requestCtaClicks: number;
  requestStarts: number;
  leads: number;
};

export type AnalyticsCountryRow = {
  country: string;
  sessions: number;
  activeUsers: number;
  requestStarts: number;
  leads: number;
};

export type AnalyticsEventTotals = {
  pageViews: number;
  navigationClicks: number;
  requestCtaClicks: number;
  requestStarts: number;
  leads: number;
};

export type SeoOpportunityType =
  | "quick_win"
  | "ctr_rewrite"
  | "content_expansion"
  | "conversion_gap";

export type SeoOpportunity = {
  id: string;
  type: SeoOpportunityType;
  priority: "high" | "medium" | "low";
  score: number;
  query: string;
  pagePath: string;
  clicks: number;
  impressions: number;
  ctr: number;
  expectedCtr: number;
  position: number;
  projectedAdditionalClicks: number;
  pageSessions: number | null;
  pageRequestCtaClicks: number | null;
  pageIntentRate: number | null;
  recommendation: string;
  evidence: string[];
  attribution: "search_query" | "page_level_inference";
};

export type WeeklySeoAction = {
  id: string;
  priority: "high" | "medium" | "low";
  title: string;
  detail: string;
  pagePath: string | null;
  query: string | null;
  evidence: string;
  action: string;
};

export type ContentInventoryItem = {
  path: string;
  group: "service" | "service_intent" | "brand" | "platform" | "workshop_guide" | "tool" | "core";
  label: string;
};

export type ContentCoverageRow = ContentInventoryItem & {
  searchClicks: number;
  searchImpressions: number;
  averagePosition: number | null;
  sessions: number;
  requestCtaClicks: number;
  intentRate: number | null;
  state: "driving_request_intent" | "visible_no_request_intent" | "low_visibility" | "no_reported_data";
};

export type SeoGrowthReport = {
  generatedAt: string;
  range: SeoReportRange;
  dateRange: {
    startDate: string;
    endDate: string;
    searchConsoleDelayDays: number;
  };
  configuration: {
    serviceAccountConfigured: boolean;
    searchConsoleConfigured: boolean;
    analyticsConfigured: boolean;
    searchConsoleProperty: string;
    analyticsPropertyConfigured: boolean;
  };
  sources: {
    searchConsole: { state: SeoSourceState; rowCount: number; warning: string | null };
    analytics: { state: SeoSourceState; rowCount: number; warning: string | null };
  };
  summary: {
    clicks: number;
    impressions: number;
    ctr: number;
    averagePosition: number | null;
    sessions: number;
    requestCtaClicks: number;
    requestStarts: number;
    leads: number;
    requestStartRate: number | null;
    leadRate: number | null;
    opportunityCount: number;
    projectedAdditionalClicks: number;
  };
  eventTotals: AnalyticsEventTotals;
  opportunities: SeoOpportunity[];
  weeklyActions: WeeklySeoAction[];
  queries: SearchQueryRow[];
  searchPages: SearchPageRow[];
  searchCountries: SearchCountryRow[];
  landingPages: AnalyticsLandingPageRow[];
  analyticsCountries: AnalyticsCountryRow[];
  contentCoverage: ContentCoverageRow[];
  warnings: string[];
  limitations: string[];
};

export type GoogleReportCell = { value?: string };

export type GoogleAnalyticsReportResponse = {
  dimensionHeaders?: Array<{ name?: string }>;
  metricHeaders?: Array<{ name?: string; type?: string }>;
  rows?: Array<{ dimensionValues?: GoogleReportCell[]; metricValues?: GoogleReportCell[] }>;
  rowCount?: number;
};

export type SearchConsoleResponse = {
  rows?: Array<{
    keys?: string[];
    clicks?: number;
    impressions?: number;
    ctr?: number;
    position?: number;
  }>;
};
