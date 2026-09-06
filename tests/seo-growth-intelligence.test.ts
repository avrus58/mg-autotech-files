import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { GET as getSeoPerformance } from "../src/app/api/admin/seo-performance/route";
import {
  getSeoDateRange,
  getSeoGrowthConfiguration,
  normalizeAnalyticsPropertyId,
  parseSeoReportRange,
} from "../src/lib/seoGrowth/config";
import { getPublicSeoContentInventory } from "../src/lib/seoGrowth/contentInventory";
import {
  createGoogleServiceAccountAssertion,
  resetGoogleAccessTokenCacheForTests,
} from "../src/lib/seoGrowth/googleAuth";
import {
  buildAnalyticsCountries,
  buildAnalyticsEventTotals,
  buildAnalyticsLandingPages,
  loadGoogleAnalyticsDataset,
  parseGoogleAnalyticsRows,
} from "../src/lib/seoGrowth/googleAnalytics";
import {
  buildContentCoverage,
  buildSeoOpportunities,
  buildWeeklySeoActions,
  expectedOrganicCtr,
} from "../src/lib/seoGrowth/opportunityEngine";
import {
  parseSearchCountryRows,
  parseSearchPageRows,
  parseSearchQueryRows,
  loadSearchConsoleDataset,
} from "../src/lib/seoGrowth/searchConsole";
import { buildSeoGrowthReport } from "../src/lib/seoGrowth/service";
import type { GoogleAnalyticsReportResponse, SearchConsoleResponse } from "../src/lib/seoGrowth/types";

function projectFile(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

function gaResponse(dimensions: string[], metrics: string[], rows: string[][]): GoogleAnalyticsReportResponse {
  return {
    dimensionHeaders: dimensions.map((name) => ({ name })),
    metricHeaders: metrics.map((name) => ({ name })),
    rows: rows.map((values) => ({
      dimensionValues: values.slice(0, dimensions.length).map((value) => ({ value })),
      metricValues: values.slice(dimensions.length).map((value) => ({ value })),
    })),
  };
}

test("SEO reporting configuration is strict and exposes safe readiness only", () => {
  assert.equal(parseSeoReportRange("90d"), "90d");
  assert.equal(parseSeoReportRange("365d"), "28d");
  assert.equal(normalizeAnalyticsPropertyId("properties/123456789"), "123456789");
  assert.equal(normalizeAnalyticsPropertyId("G-ABC123"), null);

  const missing = getSeoGrowthConfiguration({});
  assert.equal(missing.serviceAccountConfigured, false);
  assert.equal(missing.searchConsoleSiteUrl, "sc-domain:mgautotech.de");

  const invalid = getSeoGrowthConfiguration({
    GOOGLE_SERVICE_ACCOUNT_EMAIL: "not-a-service-account@example.com",
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: "private",
    GOOGLE_ANALYTICS_PROPERTY_ID: "javascript:alert(1)",
    GOOGLE_SEARCH_CONSOLE_SITE_URL: "file:///private",
  });
  assert.equal(invalid.serviceAccountConfigured, false);
  assert.equal(invalid.analyticsConfigured, false);
  assert.equal(invalid.searchConsoleSiteUrl, "sc-domain:mgautotech.de");
});

test("SEO ranges account for finalized Search Console reporting delay", () => {
  assert.deepEqual(getSeoDateRange("28d", new Date("2026-07-31T22:00:00.000Z")), {
    startDate: "2026-07-01",
    endDate: "2026-07-28",
    searchConsoleDelayDays: 3,
  });
});

test("service-account assertion contains bounded claims and no secret payload fields", () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const assertion = createGoogleServiceAccountAssertion({
    clientEmail: "seo-reader@test-project.iam.gserviceaccount.com",
    privateKey: pem,
    scopes: ["scope-b", "scope-a"],
    nowSeconds: 1_700_000_000,
  });
  const parts = assertion.split(".");
  assert.equal(parts.length, 3);
  const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  assert.equal(claims.iss, "seo-reader@test-project.iam.gserviceaccount.com");
  assert.equal(claims.scope, "scope-a scope-b");
  assert.equal(claims.exp - claims.iat, 3600);
  assert.equal(JSON.stringify(claims).includes("PRIVATE KEY"), false);
});

test("Search Console parser keeps only safe public paths and aggregate fields", () => {
  const response: SearchConsoleResponse = {
    rows: [
      { keys: ["ecu file service", "https://file.mgautotech.de/file-service?private=value"], clicks: 12, impressions: 200, ctr: 0.06, position: 6.2 },
      { keys: ["private@example.com", "https://file.mgautotech.de/services/stage-1"], clicks: 1, impressions: 2, ctr: 0.5, position: 1 },
      { keys: ["external", "https://example.com/private"], clicks: 5, impressions: 20, ctr: 0.25, position: 3 },
    ],
  };
  assert.deepEqual(parseSearchQueryRows(response), [{
    query: "ecu file service",
    pagePath: "/file-service",
    clicks: 12,
    impressions: 200,
    ctr: 0.06,
    position: 6.2,
  }]);
  assert.equal(parseSearchPageRows({ rows: [{ keys: ["https://file.mgautotech.de/services/stage-1#x"], clicks: 2, impressions: 10, ctr: 0.2, position: 4 }] })[0].pagePath, "/services/stage-1");
  assert.deepEqual(parseSearchCountryRows({ rows: [{ keys: ["deu"], clicks: 2, impressions: 10, ctr: 0.2, position: 4 }, { keys: ["Germany"], clicks: 1 }] }).map((row) => row.countryCode), ["deu"]);
});

test("GA4 parser builds aggregate landing, country and event rows", () => {
  const landing = parseGoogleAnalyticsRows(gaResponse(
    ["landingPage"],
    ["sessions", "activeUsers", "screenPageViews", "engagementRate"],
    [["/file-service?utm_source=test", "40", "32", "55", "0.7"]]
  ));
  const pageEvents = parseGoogleAnalyticsRows(gaResponse(
    ["unifiedPagePathScreen", "eventName"],
    ["eventCount"],
    [
      ["/file-service", "request_cta_click", "8"],
      ["/file-service", "request_start", "5"],
      ["/file-service", "generate_lead", "3"],
      ["/admin", "generate_lead", "99"],
    ]
  ));
  const pages = buildAnalyticsLandingPages(landing, pageEvents);
  assert.deepEqual(pages[0], {
    pagePath: "/file-service",
    sessions: 40,
    activeUsers: 32,
    pageViews: 55,
    engagementRate: 0.7,
    requestCtaClicks: 8,
    requestStarts: 5,
    leads: 3,
  });
  assert.equal(pages.some((page) => page.pagePath === "/admin"), false);

  const totals = buildAnalyticsEventTotals([
    { eventName: "page_view", eventCount: "55" },
    { eventName: "request_start", eventCount: "5" },
    { eventName: "generate_lead", eventCount: "3" },
  ]);
  assert.equal(totals.pageViews, 55);
  assert.equal(totals.leads, 3);

  const countries = buildAnalyticsCountries(
    [{ country: "Germany", sessions: "30", activeUsers: "20" }],
    [{ country: "Germany", eventName: "generate_lead", eventCount: "2" }]
  );
  assert.equal(countries[0].leads, 2);
});

test("all Search Console reports filter the exact HTTPS file host before row limits and country aggregation", async () => {
  for (const siteUrl of ["sc-domain:mgautotech.de", "https://file.mgautotech.de/"]) {
    const requests: string[] = [];
    const dataset = await loadSearchConsoleDataset({
      siteUrl,
      accessToken: "synthetic-token",
      startDate: "2026-08-01",
      endDate: "2026-08-28",
      fetchFn: async (url, init) => {
        assert.ok(String(url).includes(encodeURIComponent(siteUrl)));
        const body = JSON.parse(String(init?.body));
        requests.push(body.dimensions.join(","));
        assert.deepEqual(body.dimensionFilterGroups, [{
          groupType: "and",
          filters: [{ dimension: "page", operator: "includingRegex", expression: "^https://file\\.mgautotech\\.de/" }],
        }]);
        assert.equal(body.aggregationType, "auto");
        assert.equal(body.startRow, 0);
        assert.ok(body.rowLimit <= 1_000);
        const filter = new RegExp(body.dimensionFilterGroups[0].filters[0].expression);
        for (const page of ["https://file.mgautotech.de/", "https://file.mgautotech.de/file-service", "https://file.mgautotech.de/?lang=de"]) {
          assert.equal(filter.test(page), true, page);
        }
        for (const page of ["https://mgautotech.de/", "https://www.mgautotech.de/", "https://preview.file.mgautotech.de/", "https://file.mgautotech.de.example.com/", "https://fileXmgautotechYde/", "https://example.com/?next=https://file.mgautotech.de/", "http://file.mgautotech.de/", "http://localhost:3000/"]) {
          assert.equal(filter.test(page), false, page);
        }
        // Simulate aggregation after the API filter, including the country-only
        // report where response rows contain no page to filter locally.
        const fixtures = [
          { page: "https://file.mgautotech.de/file-service", clicks: 6 },
          { page: "https://mgautotech.de/", clicks: 900 },
        ];
        const rows = fixtures.filter((row) => filter.test(row.page)).map((row) => ({
          keys: body.dimensions.map((dimension: string) => dimension === "page" ? row.page : dimension === "country" ? "deu" : "ecu file service"),
          clicks: row.clicks, impressions: 180, ctr: 0.033, position: 7,
        }));
        return Response.json({ rows });
      },
    });
    assert.deepEqual(requests.sort(), ["country", "page", "query,page"]);
    assert.equal(dataset.queries[0].clicks, 6);
    assert.equal(dataset.pages[0].clicks, 6);
    assert.equal(dataset.countries[0].clicks, 6);
  }
});

test("all five GA4 reports require the exact file hostname AND retain the event allowlist", async () => {
  const requests: string[] = [];
  const dataset = await loadGoogleAnalyticsDataset({
    propertyId: "123456789",
    accessToken: "synthetic-token",
    startDate: "2026-08-01",
    endDate: "2026-08-28",
    fetchFn: async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      const dimensions: string[] = body.dimensions.map((item: { name: string }) => item.name);
      const metrics: string[] = body.metrics.map((item: { name: string }) => item.name);
      requests.push(dimensions.join(","));
      const expressions = body.dimensionFilter.andGroup.expressions;
      assert.deepEqual(expressions[0], { filter: {
        fieldName: "hostName",
        stringFilter: { matchType: "EXACT", value: "file.mgautotech.de", caseSensitive: false },
      } });
      const isEventReport = dimensions.includes("eventName");
      assert.equal(expressions.length, isEventReport ? 2 : 1);
      if (isEventReport) {
        assert.deepEqual(expressions[1], { filter: {
          fieldName: "eventName",
          inListFilter: { values: ["page_view", "public_navigation_click", "request_cta_click", "request_start", "generate_lead"], caseSensitive: true },
        } });
      }
      const fixtures = [
        { host: "file.mgautotech.de", count: 6 },
        { host: "FILE.MGAUTOTECH.DE", count: 2 },
        { host: "mgautotech.de", count: 900 },
        { host: "preview.file.mgautotech.de", count: 900 },
        { host: "file.mgautotech.de.example.com", count: 900 },
        { host: "localhost", count: 900 },
        { host: "(not set)", count: 900 },
      ];
      const count = fixtures.filter((row) => row.host.toLowerCase() === expressions[0].filter.stringFilter.value).reduce((sum, row) => sum + row.count, 0);
      const cells = dimensions.map((dimension) => dimension === "country" ? "Germany" : dimension === "eventName" ? "generate_lead" : "/file-service");
      return Response.json(gaResponse(dimensions, metrics, [[...cells, ...metrics.map(() => String(count))]]));
    },
  });
  assert.deepEqual(requests.sort(), ["country", "country,eventName", "eventName", "landingPage", "unifiedPagePathScreen,eventName"]);
  assert.equal(dataset.landingPages[0].sessions, 8);
  assert.equal(dataset.landingPages[0].leads, 8);
  assert.equal(dataset.countries[0].sessions, 8);
  assert.equal(dataset.countries[0].leads, 8);
  assert.equal(dataset.eventTotals.leads, 8);
});

test("site-scoped reports never retry unfiltered when a Google filter request fails", async () => {
  let requests = 0;
  const input = {
    accessToken: "synthetic-token", startDate: "2026-08-01", endDate: "2026-08-28",
    fetchFn: (async () => { requests++; return new Response(null, { status: 400 }); }) as typeof fetch,
  };
  await assert.rejects(loadSearchConsoleDataset({ ...input, siteUrl: "sc-domain:mgautotech.de" }));
  assert.equal(requests, 3);
  await assert.rejects(loadGoogleAnalyticsDataset({ ...input, propertyId: "123456789" }));
  assert.equal(requests, 8);
});

test("opportunity engine finds positions 4-20 and uses page CTA intent without claiming lead attribution", () => {
  const opportunities = buildSeoOpportunities([
    { query: "ecu file service", pagePath: "/file-service", clicks: 5, impressions: 400, ctr: 0.0125, position: 6 },
    { query: "already first", pagePath: "/", clicks: 20, impressions: 100, ctr: 0.2, position: 1 },
    { query: "too deep", pagePath: "/services", clicks: 0, impressions: 80, ctr: 0, position: 35 },
  ], [{ pagePath: "/file-service", sessions: 30, activeUsers: 25, pageViews: 40, engagementRate: 0.6, requestCtaClicks: 4, requestStarts: 1, leads: 0 }]);
  assert.equal(opportunities.length, 1);
  assert.equal(opportunities[0].type, "ctr_rewrite");
  assert.equal(opportunities[0].pageRequestCtaClicks, 4);
  assert.equal(opportunities[0].pageIntentRate, 4 / 30);
  assert.equal(opportunities[0].evidence.some((item) => item.includes("completed request")), false);
  assert.equal(opportunities[0].projectedAdditionalClicks > 0, true);
  assert.equal(expectedOrganicCtr(6) > expectedOrganicCtr(16), true);
});

test("request-path gap requires sessions with no page CTA intent", () => {
  const opportunities = buildSeoOpportunities([
    { query: "tcu file service", pagePath: "/services/tcu-tuning", clicks: 3, impressions: 120, ctr: 0.025, position: 9 },
  ], [{ pagePath: "/services/tcu-tuning", sessions: 18, activeUsers: 14, pageViews: 22, engagementRate: 0.5, requestCtaClicks: 0, requestStarts: 4, leads: 2 }]);
  assert.equal(opportunities[0].type, "conversion_gap");
  assert.equal(opportunities[0].attribution, "page_level_inference");
  assert.equal(opportunities[0].pageRequestCtaClicks, 0);
  assert.equal(opportunities[0].evidence.some((item) => item.includes("2 completed")), false);
});

test("content inventory covers existing canonical services, brands, platforms and guides", () => {
  const inventory = getPublicSeoContentInventory();
  assert.equal(inventory.some((item) => item.path === "/services/stage-1" && item.group === "service"), true);
  assert.equal(inventory.some((item) => item.path.startsWith("/brands/") && item.group === "brand"), true);
  assert.equal(inventory.some((item) => item.path.startsWith("/ecu-platforms/") && item.group === "platform"), true);
  assert.equal(new Set(inventory.map((item) => item.path)).size, inventory.length);

  const coverage = buildContentCoverage(inventory.slice(0, 2), [
    { pagePath: "/", clicks: 10, impressions: 100, ctr: 0.1, position: 3 },
  ], [{ pagePath: "/", sessions: 25, activeUsers: 20, pageViews: 30, engagementRate: 0.5, requestCtaClicks: 2, requestStarts: 1, leads: 1 }]);
  assert.equal(coverage.find((item) => item.path === "/")?.state, "driving_request_intent");
  assert.equal(coverage.find((item) => item.path === "/")?.requestCtaClicks, 2);
});

test("weekly actions use evidence and never promise automatic publishing", () => {
  const opportunities = buildSeoOpportunities([
    { query: "tcu file service", pagePath: "/services/tcu-tuning", clicks: 1, impressions: 120, ctr: 0.008, position: 8 },
  ], []);
  const actions = buildWeeklySeoActions({
    opportunities,
    searchCountries: [{ countryCode: "deu", clicks: 1, impressions: 100, ctr: 0.01, position: 9 }],
    analyticsCountries: [],
    contentCoverage: [],
  });
  assert.equal(actions.length >= 1, true);
  assert.equal(JSON.stringify(actions).toLowerCase().includes("auto-publish"), false);
  assert.equal(actions.every((action) => Boolean(action.evidence && action.action)), true);
});

test("full report fails closed without credentials and contains no secret placeholders", async () => {
  const report = await buildSeoGrowthReport({
    range: "28d",
    env: {},
    now: new Date("2026-07-31T12:00:00.000Z"),
  });
  assert.equal(report.sources.searchConsole.state, "not_configured");
  assert.equal(report.sources.analytics.state, "not_configured");
  assert.equal(report.contentCoverage.length > 0, true);
  const serialized = JSON.stringify(report);
  for (const forbidden of ["private_key", "client_secret", "access_token", "service_role", "customer_email", "order_id"]) {
    assert.equal(serialized.toLowerCase().includes(forbidden), false, forbidden);
  }
});

test("full report consumes synthetic Google aggregate responses only", async () => {
  resetGoogleAccessTokenCacheForTests();
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const searchRows = (dimensions: string[]): SearchConsoleResponse => {
    if (dimensions.join(",") === "query,page") return { rows: [{ keys: ["ecu file service", "https://file.mgautotech.de/file-service"], clicks: 6, impressions: 180, ctr: 0.033, position: 7 }] };
    if (dimensions[0] === "page") return { rows: [{ keys: ["https://file.mgautotech.de/file-service"], clicks: 6, impressions: 180, ctr: 0.033, position: 7 }] };
    return { rows: [{ keys: ["deu"], clicks: 6, impressions: 180, ctr: 0.033, position: 7 }] };
  };
  const fetchFn: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url === "https://oauth2.googleapis.com/token") {
      return new Response(JSON.stringify({ access_token: "synthetic-token", expires_in: 3600 }), { status: 200 });
    }
    const body = JSON.parse(String(init?.body ?? "{}"));
    if (url.includes("webmasters/v3")) {
      return new Response(JSON.stringify(searchRows(body.dimensions ?? [])), { status: 200 });
    }
    const dimensions = (body.dimensions ?? []).map((item: { name: string }) => item.name);
    if (dimensions.join(",") === "landingPage") return new Response(JSON.stringify(gaResponse(dimensions, ["sessions", "activeUsers", "screenPageViews", "engagementRate"], [["/file-service", "25", "20", "32", "0.6"]])), { status: 200 });
    if (dimensions.join(",") === "unifiedPagePathScreen,eventName") return new Response(JSON.stringify(gaResponse(dimensions, ["eventCount"], [["/file-service", "request_start", "3"], ["/file-service", "generate_lead", "2"]])), { status: 200 });
    if (dimensions.join(",") === "eventName") return new Response(JSON.stringify(gaResponse(dimensions, ["eventCount"], [["page_view", "32"], ["request_start", "3"], ["generate_lead", "2"]])), { status: 200 });
    if (dimensions.join(",") === "country") return new Response(JSON.stringify(gaResponse(dimensions, ["sessions", "activeUsers"], [["Germany", "25", "20"]])), { status: 200 });
    return new Response(JSON.stringify(gaResponse(dimensions, ["eventCount"], [["Germany", "generate_lead", "2"]])), { status: 200 });
  };

  const report = await buildSeoGrowthReport({
    range: "28d",
    env: {
      GOOGLE_SERVICE_ACCOUNT_EMAIL: "seo-reader@test-project.iam.gserviceaccount.com",
      GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: pem,
      GOOGLE_SEARCH_CONSOLE_SITE_URL: "sc-domain:mgautotech.de",
      GOOGLE_ANALYTICS_PROPERTY_ID: "123456789",
    },
    fetchFn,
    now: new Date("2026-07-31T12:00:00.000Z"),
  });
  assert.equal(report.sources.searchConsole.state, "ready");
  assert.equal(report.sources.analytics.state, "ready");
  assert.equal(report.summary.clicks, 6);
  assert.equal(report.summary.sessions, 25);
  assert.equal(report.summary.leads, 2);
  assert.equal(report.searchCountries[0].countryCode, "deu");
});

test("admin SEO API is guarded, private, bounded and customer-safe", () => {
  const route = projectFile("src", "app", "api", "admin", "seo-performance", "route.ts");
  const client = projectFile("src", "app", "admin", "seo-performance", "SeoPerformanceClient.tsx");
  const service = projectFile("src", "lib", "seoGrowth", "service.ts");
  assert.match(route, /requireStaffPermission\(request, "orders\.view"\)/);
  assert.match(route, /private, no-store/);
  assert.match(route, /parseSeoReportRange/);
  assert.doesNotMatch(route, /POST|PATCH|DELETE|Supabase|service_role/i);
  assert.match(client, /authenticatedFetch\(`\/api\/admin\/seo-performance\?range=/);
  assert.match(client, /page opportunities use aggregate sessions and request CTA clicks only/i);
  assert.match(service, /never edits, publishes or indexes content automatically/i);
  for (const forbidden of ["customer_email", "customer_id", "order_id", "vehicle_brand", "file_name", "storage_path", "credit_value", "admin_notes"]) {
    assert.doesNotMatch(service, new RegExp(forbidden, "i"), forbidden);
  }
});

test("anonymous users cannot read the aggregate admin SEO report", async () => {
  const response = await getSeoPerformance(
    new Request("http://localhost/api/admin/seo-performance?range=28d")
  );
  assert.equal(response.status, 401);
  assert.match(response.headers.get("cache-control") ?? "", /private, no-store/);
});
