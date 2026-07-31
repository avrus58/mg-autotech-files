import type {
  AnalyticsCountryRow,
  AnalyticsLandingPageRow,
  ContentCoverageRow,
  ContentInventoryItem,
  SearchCountryRow,
  SearchPageRow,
  SearchQueryRow,
  SeoOpportunity,
  WeeklySeoAction,
} from "@/lib/seoGrowth/types";

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

function stableId(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function expectedOrganicCtr(position: number) {
  if (position <= 1.5) return 0.28;
  if (position <= 2.5) return 0.15;
  if (position <= 3.5) return 0.1;
  if (position <= 5) return 0.07;
  if (position <= 7) return 0.05;
  if (position <= 10) return 0.035;
  if (position <= 15) return 0.02;
  return 0.012;
}

function opportunityPriority(score: number): SeoOpportunity["priority"] {
  if (score >= 70) return "high";
  if (score >= 45) return "medium";
  return "low";
}

export function buildSeoOpportunities(
  queries: SearchQueryRow[],
  landingPages: AnalyticsLandingPageRow[]
): SeoOpportunity[] {
  const landingMap = new Map(landingPages.map((row) => [row.pagePath, row]));

  return queries
    .filter((row) => row.position >= 4 && row.position <= 20 && row.impressions >= 8)
    .map((row): SeoOpportunity => {
      const expectedCtr = expectedOrganicCtr(row.position);
      const ctrGap = Math.max(0, expectedCtr - row.ctr);
      const ctrGapRatio = expectedCtr ? ctrGap / expectedCtr : 0;
      const landing = landingMap.get(row.pagePath);
      const pageIntentRate = landing ? ratio(landing.requestCtaClicks, landing.sessions) : null;
      const conversionGap = Boolean(
        landing && landing.sessions >= 10 && landing.requestCtaClicks === 0
      );
      const type: SeoOpportunity["type"] = conversionGap
        ? "conversion_gap"
        : row.position <= 10 && ctrGapRatio >= 0.3
          ? "ctr_rewrite"
          : row.position <= 10
            ? "quick_win"
            : "content_expansion";

      const visibilityScore = clamp(Math.log10(row.impressions + 1) * 16, 5, 35);
      const rankScore = row.position <= 10 ? 25 : clamp(25 - (row.position - 10) * 1.5, 8, 25);
      const clickGapScore = clamp(ctrGapRatio * 25, 0, 25);
      const conversionScore = conversionGap
        ? 15
        : landing && landing.requestCtaClicks > 0
          ? 8
          : 4;
      const score = Math.round(clamp(visibilityScore + rankScore + clickGapScore + conversionScore, 0, 100));
      const projectedAdditionalClicks = Math.max(0, Math.round(row.impressions * ctrGap));

      const recommendations: Record<SeoOpportunity["type"], string> = {
        quick_win: "Strengthen the page section that answers this query and improve the internal link path to it.",
        ctr_rewrite: "Review the title and meta description against the exact search intent; preserve factual scope and test a clearer result promise.",
        content_expansion: "Expand the existing page with a concise, evidence-backed answer section instead of creating a thin duplicate page.",
        conversion_gap: "Review the landing-page request path and CTA clarity; this uses aggregate page intent, not completed-request attribution.",
      };

      return {
        id: `seo-${stableId(`${row.query}|${row.pagePath}`)}`,
        type,
        priority: opportunityPriority(score),
        score,
        query: row.query,
        pagePath: row.pagePath,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        expectedCtr,
        position: row.position,
        projectedAdditionalClicks,
        pageSessions: landing?.sessions ?? null,
        pageRequestCtaClicks: landing?.requestCtaClicks ?? null,
        pageIntentRate,
        recommendation: recommendations[type],
        evidence: [
          `${row.impressions} impressions at average position ${row.position.toFixed(1)}.`,
          `${(row.ctr * 100).toFixed(1)}% CTR versus a directional ${(expectedCtr * 100).toFixed(1)}% benchmark.`,
          landing
            ? `${landing.sessions} consented sessions and ${landing.requestCtaClicks} request CTA clicks on the reported page.`
            : "No consented GA4 landing-page row is available for this path in the selected period.",
        ],
        attribution: conversionGap ? "page_level_inference" : "search_query",
      };
    })
    .sort((left, right) => right.score - left.score || right.impressions - left.impressions)
    .slice(0, 100);
}

export function buildContentCoverage(
  inventory: ContentInventoryItem[],
  searchPages: SearchPageRow[],
  landingPages: AnalyticsLandingPageRow[]
): ContentCoverageRow[] {
  const searchMap = new Map(searchPages.map((row) => [row.pagePath, row]));
  const landingMap = new Map(landingPages.map((row) => [row.pagePath, row]));
  return inventory.map((item) => {
    const search = searchMap.get(item.path);
    const landing = landingMap.get(item.path);
    const intentRate = landing && landing.sessions > 0
      ? landing.requestCtaClicks / landing.sessions
      : null;
    let state: ContentCoverageRow["state"] = "no_reported_data";
    if ((landing?.requestCtaClicks ?? 0) > 0) state = "driving_request_intent";
    else if ((search?.clicks ?? 0) > 0 || (landing?.sessions ?? 0) >= 10) state = "visible_no_request_intent";
    else if ((search?.impressions ?? 0) > 0 || (landing?.sessions ?? 0) > 0) state = "low_visibility";
    return {
      ...item,
      searchClicks: search?.clicks ?? 0,
      searchImpressions: search?.impressions ?? 0,
      averagePosition: search?.position ?? null,
      sessions: landing?.sessions ?? 0,
      requestCtaClicks: landing?.requestCtaClicks ?? 0,
      intentRate,
      state,
    };
  }).sort((left, right) => {
    const stateOrder = {
      visible_no_request_intent: 0,
      low_visibility: 1,
      driving_request_intent: 2,
      no_reported_data: 3,
    };
    return stateOrder[left.state] - stateOrder[right.state]
      || right.searchImpressions - left.searchImpressions;
  });
}

export function buildWeeklySeoActions(input: {
  opportunities: SeoOpportunity[];
  searchCountries: SearchCountryRow[];
  analyticsCountries: AnalyticsCountryRow[];
  contentCoverage: ContentCoverageRow[];
}): WeeklySeoAction[] {
  const actions: WeeklySeoAction[] = input.opportunities.slice(0, 6).map((opportunity) => ({
    id: `action-${opportunity.id}`,
    priority: opportunity.priority,
    title: opportunity.type === "ctr_rewrite"
      ? `Improve search-result fit for "${opportunity.query}"`
      : opportunity.type === "conversion_gap"
        ? `Audit the request path on ${opportunity.pagePath}`
        : `Strengthen ${opportunity.pagePath} for "${opportunity.query}"`,
    detail: opportunity.recommendation,
    pagePath: opportunity.pagePath,
    query: opportunity.query,
    evidence: opportunity.evidence[0],
    action: opportunity.type === "ctr_rewrite"
      ? "Compare the current title/meta and first visible answer with the exact query before editing."
      : opportunity.type === "conversion_gap"
        ? "Inspect CTA visibility, request preparation clarity and mobile interaction without changing pricing or workflow rules."
        : "Add or refine one focused answer block on the existing canonical page and link it from a relevant hub.",
  }));

  const country = input.searchCountries.find((row) => row.impressions >= 50 && row.ctr < 0.03);
  if (country && actions.length < 8) {
    actions.push({
      id: `country-${country.countryCode}`,
      priority: country.impressions >= 250 ? "high" : "medium",
      title: `Review search demand from ${country.countryCode.toUpperCase()}`,
      detail: "Validate language and search intent before expanding localized content. Country reporting is aggregate and contains no customer identity.",
      pagePath: null,
      query: null,
      evidence: `${country.impressions} search impressions and ${country.clicks} clicks.`,
      action: "Inspect the country's top queries and current landing pages; improve an existing localized route only when the intent is supported.",
    });
  }

  const uncovered = input.contentCoverage.find((row) => row.state === "visible_no_request_intent");
  if (uncovered && actions.length < 8) {
    actions.push({
      id: `coverage-${stableId(uncovered.path)}`,
      priority: uncovered.sessions >= 25 ? "high" : "medium",
      title: `Close the request-intent gap on ${uncovered.label}`,
      detail: "The route has reported visibility or sessions but no request CTA interaction in the selected period.",
      pagePath: uncovered.path,
      query: null,
      evidence: `${uncovered.searchImpressions} impressions, ${uncovered.sessions} sessions and ${uncovered.requestCtaClicks} request CTA clicks.`,
      action: "Check message alignment, mobile CTA placement and the handoff to the secure request flow before adding more content.",
    });
  }

  return actions.slice(0, 8);
}
