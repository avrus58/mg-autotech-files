import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  buildPublicNavigationEvent,
  buildPublicPageView,
  isApprovedAnalyticsHost,
  isConversionMeasurementPath,
  isPublicAnalyticsPath,
  isValidGoogleAdsConversionLabel,
  isValidGoogleAdsId,
  isValidGoogleAnalyticsMeasurementId,
  normalizeAnalyticsPath,
  publicAnalyticsContentGroup,
} from "../src/lib/publicAnalytics";

function projectFile(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

test("analytics configuration accepts only a GA4 measurement id on the production host", () => {
  assert.equal(isValidGoogleAnalyticsMeasurementId("G-ABC1234567"), true);
  assert.equal(isValidGoogleAnalyticsMeasurementId("UA-123-1"), false);
  assert.equal(isValidGoogleAnalyticsMeasurementId("G-short"), false);
  assert.equal(isValidGoogleAnalyticsMeasurementId(""), false);
  assert.equal(isApprovedAnalyticsHost("file.mgautotech.de"), true);
  assert.equal(isApprovedAnalyticsHost("preview.vercel.app"), false);
  assert.equal(isApprovedAnalyticsHost("localhost"), false);
  assert.equal(isValidGoogleAdsId("AW-123456789"), true);
  assert.equal(isValidGoogleAdsId("G-ABC1234567"), false);
  assert.equal(isValidGoogleAdsConversionLabel("AbCdEf_123-xy"), true);
  assert.equal(isValidGoogleAdsConversionLabel("short"), false);
});

test("verified conversion routes are measurement-only and never become public page views", () => {
  for (const path of ["/register", "/auth/callback", "/new-request", "/payment/success"]) {
    assert.equal(isConversionMeasurementPath(path), true, path);
    assert.equal(isPublicAnalyticsPath(path), false, path);
    assert.equal(buildPublicPageView(path), null, path);
  }
  assert.equal(isConversionMeasurementPath("/dashboard/orders/private-id"), false);
});

test("analytics path normalization removes query and fragment data", () => {
  assert.equal(
    normalizeAnalyticsPath("https://file.mgautotech.de/services/stage-1?email=private@example.com#price"),
    "/services/stage-1"
  );
  assert.equal(normalizeAnalyticsPath("/de/file-service/?utm_source=test"), "/de/file-service");
  assert.equal(normalizeAnalyticsPath("https://example.com/services/stage-1"), null);
});

test("public tracking uses an explicit route allowlist and excludes private workspaces", () => {
  for (const path of [
    "/",
    "/de",
    "/file-service",
    "/tr/services/stage-1",
    "/workshop-guides/ecu-file-service-online",
    "/tools/torque-power-calculator",
  ]) {
    assert.equal(isPublicAnalyticsPath(path), true, path);
  }

  for (const path of [
    "/admin",
    "/admin/requests/private-id",
    "/dashboard/orders/private-id",
    "/new-request",
    "/api/vehicles",
    "/unknown/private-id",
  ]) {
    assert.equal(isPublicAnalyticsPath(path), false, path);
  }
});

test("public page views expose only sanitized location and content grouping", () => {
  const event = buildPublicPageView("/de/services/stage-2?customer=private");
  assert.deepEqual(event, {
    name: "page_view",
    params: {
      page_path: "/de/services/stage-2",
      page_location: "https://file.mgautotech.de/de/services/stage-2",
      page_referrer: "",
      content_group: "service_content",
    },
  });
  assert.equal(buildPublicPageView("/dashboard/orders/private-id"), null);
  assert.equal(publicAnalyticsContentGroup("/tr/workshop-guides/ecu-request-checklist"), "workshop_guides");
});

test("public link tracking records safe internal destinations and rejects private or external links", () => {
  assert.deepEqual(buildPublicNavigationEvent("/services/stage-1", "/new-request?order=private"), {
    name: "request_cta_click",
    params: {
      source_path: "/services/stage-1",
      destination_path: "/new-request",
      page_location: "https://file.mgautotech.de/services/stage-1",
      page_referrer: "",
      content_group: "secure_request_flow",
    },
  });
  assert.deepEqual(buildPublicNavigationEvent("/de/file-service", "/de/services/tcu-tuning"), {
    name: "public_navigation_click",
    params: {
      source_path: "/de/file-service",
      destination_path: "/de/services/tcu-tuning",
      page_location: "https://file.mgautotech.de/de/file-service",
      page_referrer: "",
      content_group: "service_content",
    },
  });
  assert.equal(buildPublicNavigationEvent("/admin", "/services"), null);
  assert.equal(buildPublicNavigationEvent("/services", "/dashboard/orders/private-id"), null);
  assert.equal(buildPublicNavigationEvent("/services", "https://example.com/new-request"), null);
});

test("request analytics contains no customer, order, vehicle, file or payment metadata", () => {
  const analytics = projectFile("src", "lib", "publicAnalytics.ts");
  const requestPage = projectFile("src", "app", "new-request", "page.tsx");
  const contract = analytics.slice(0, analytics.indexOf("type AnalyticsWindow"));

  for (const forbidden of [
    "customer_email",
    "customer_id",
    "order_id",
    "request_id",
    "vehicle_brand",
    "service_type",
    "file_name",
    "storage_path",
    "notes",
  ]) {
    assert.doesNotMatch(contract, new RegExp(forbidden, "i"), forbidden);
  }

  assert.match(requestPage, /if \(error\) \{[\s\S]*?return;[\s\S]*?createdOrderId \|\| growthAttemptIdRef[\s\S]*?trackRequestSubmitted\(conversionSeed\);/);
  assert.match(requestPage, /if \(!customerProfile \|\| requestStartTrackedRef\.current\) return;[\s\S]*?trackRequestStarted\(\);/);
  assert.match(analytics, /crypto\.subtle\.digest\("SHA-256", bytes\)/);
});

test("root analytics loader is consent-aware, production-only and fail-closed without config", () => {
  const layout = projectFile("src", "app", "layout.tsx");
  const component = projectFile("src", "components", "analytics", "PublicAnalytics.tsx");
  const consentCopy = projectFile("src", "lib", "analyticsConsentI18n.ts");
  const analytics = projectFile("src", "lib", "publicAnalytics.ts");

  assert.match(layout, /NEXT_PUBLIC_GOOGLE_ANALYTICS_ID/);
  assert.match(layout, /googleAnalyticsMeasurementId=\{googleAnalyticsMeasurementId\}/);
  assert.match(layout, /googleAdsId=\{googleAdsId\}/);
  assert.match(component, /isApprovedAnalyticsHost\(window\.location\.hostname\)/);
  assert.match(component, /isConversionMeasurementPath\(pathname\)/);
  assert.match(component, /analyticsRouteAllowed/);
  assert.match(component, /denyGoogleMeasurement\(\);/);
  assert.match(component, /getAnalyticsConsentCopy\(pathname\)/);
  assert.match(consentCopy, /Necessary only/);
  assert.match(consentCopy, /File names, vehicle details, account data and order IDs are never included/);
  assert.match(analytics, /ad_storage: preferences\.advertising \? "granted" : "denied"/);
  assert.match(analytics, /ad_user_data: preferences\.advertising \? "granted" : "denied"/);
  assert.match(analytics, /ad_personalization: "denied"/);
  assert.match(analytics, /page_referrer: ""/);
  assert.doesNotMatch(analytics, /window\.location\.href/);
});

test("admin Ads readiness center is protected and never returns public configuration values", () => {
  const route = projectFile("src", "app", "api", "admin", "ads-performance", "route.ts");
  const readiness = projectFile("src", "lib", "googleAds", "readiness.ts");
  const client = projectFile("src", "app", "admin", "ads-performance", "AdsPerformanceClient.tsx");
  const adminLayout = projectFile("src", "app", "admin", "layout.tsx");

  assert.match(route, /requireStaffPermissions\(request, adsPerformancePermissions\)/);
  assert.match(route, /private, no-store/);
  assert.match(adminLayout, /BrowserAuthBoundary/);
  assert.match(client, /Google Ads Readiness & Conversion Center/);
  assert.match(readiness, /rawClickIdsStored: false/);
  assert.match(readiness, /customerIdentifiersExported: false/);
  assert.doesNotMatch(route, /NEXT_PUBLIC_GOOGLE_ADS_ID|REGISTRATION_LABEL|PURCHASE_LABEL/);
});

test("admin SEO measurement center is protected by the admin layout and exposes no identifier", () => {
  const page = projectFile("src", "app", "admin", "seo-performance", "page.tsx");
  const client = projectFile("src", "app", "admin", "seo-performance", "SeoPerformanceClient.tsx");
  const adminLayout = projectFile("src", "app", "admin", "layout.tsx");
  const admin = projectFile("src", "app", "admin", "page.tsx");

  assert.match(adminLayout, /BrowserAuthBoundary/);
  assert.match(admin, /href="\/admin\/seo-performance"/);
  assert.match(client, /Search Console/);
  assert.match(client, /Completed requests/);
  assert.match(page, /process\.env\.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID/);
  assert.doesNotMatch(page, /G-[A-Z0-9]{6,14}/);
  assert.doesNotMatch(page, /service_role|private_key|client_secret/i);
});
