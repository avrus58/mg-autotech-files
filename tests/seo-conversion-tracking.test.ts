import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  buildPublicNavigationEvent,
  buildPublicPageView,
  isApprovedAnalyticsHost,
  isConversionMeasurementPath,
  isGoogleMeasurementScriptPath,
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
  for (const path of [
    "/register",
    "/auth/callback",
    "/auth/complete-profile",
    "/new-request",
    "/payment/success",
    "/measurement/complete",
  ]) {
    assert.equal(isConversionMeasurementPath(path), true, path);
    assert.equal(isPublicAnalyticsPath(path), false, path);
    assert.equal(buildPublicPageView(path), null, path);
  }
  assert.equal(isConversionMeasurementPath("/dashboard/orders/private-id"), false);
  for (const privatePath of [
    "/register",
    "/auth/callback",
    "/auth/complete-profile",
    "/new-request",
    "/payment/success",
  ]) {
    assert.equal(isGoogleMeasurementScriptPath(privatePath), false, privatePath);
  }
  assert.equal(isGoogleMeasurementScriptPath("/measurement/complete"), true);
});

test("measurement completion metadata is locale-aware and relies on the root title template", () => {
  const completionLayout = projectFile(
    "src",
    "app",
    "measurement",
    "complete",
    "layout.tsx"
  );

  assert.match(completionLayout, /buildMeasurementCompletionMetadata\(await getServerLocale\(\)\)/);
  assert.doesNotMatch(completionLayout, /export const metadata/);
  assert.doesNotMatch(completionLayout, /Secure measurement handoff \| MG AutoTech/);
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

  assert.match(requestPage, /if \(error\) \{[\s\S]*?return;[\s\S]*?createdOrderId \|\| growthAttemptIdRef[\s\S]*?await Promise\.all\(\[[\s\S]*?trackRequestSubmitted\(conversionSeed\)[\s\S]*?recordGrowthRequestCreated/);
  assert.match(requestPage, /if \(requestStartTrackedRef\.current\) return;[\s\S]*?window\.crypto\.randomUUID\(\)[\s\S]*?growthStartDelivery\.begin\(/);
  assert.match(requestPage, /onChangeCapture=\{markRequestStarted\}/);
  assert.doesNotMatch(requestPage, /trackRequestStarted|requestStartAnalyticsRecordedRef/);
  assert.doesNotMatch(analytics, /export function trackRequestStarted/);
  assert.doesNotMatch(analytics, /name: "request_start"/);
  assert.doesNotMatch(requestPage, /if \(!customerProfile \|\| requestStartTrackedRef\.current\) return;/);
  assert.match(analytics, /crypto\.subtle\.digest\("SHA-256", bytes\)/);
});

test("verified conversion routes await local queue insertion before customer navigation", () => {
  const requestPage = projectFile("src", "app", "new-request", "page.tsx");
  const paymentPage = projectFile("src", "app", "payment", "success", "page.tsx");
  const registerPage = projectFile("src", "app", "register", "page.tsx");
  const authCallback = projectFile("src", "app", "auth", "callback", "page.tsx");
  const completeProfile = projectFile("src", "app", "auth", "complete-profile", "page.tsx");
  const registrationClient = projectFile("src", "lib", "registrationHandoffClient.ts");

  assert.match(requestPage, /await Promise\.all\(\[[\s\S]*?trackRequestSubmitted\(conversionSeed\)[\s\S]*?recordGrowthRequestCreated/);
  const requestTrackingIndex = requestPage.indexOf("trackRequestSubmitted(conversionSeed)");
  const requestConsentIndex = requestPage.indexOf(
    "const completionConsent = readMeasurementConsentSnapshot()",
    requestTrackingIndex
  );
  const requestConsentWaitIndex = requestPage.indexOf(
    "setAwaitingConsentAfterSuccess(true)",
    requestConsentIndex
  );
  const requestNavigationIndex = requestPage.indexOf(
    'window.location.assign("/dashboard")',
    requestConsentWaitIndex
  );
  assert.ok(requestTrackingIndex >= 0);
  assert.ok(requestConsentIndex > requestTrackingIndex);
  assert.ok(requestConsentWaitIndex > requestConsentIndex);
  assert.ok(requestNavigationIndex > requestConsentWaitIndex);
  assert.match(
    requestPage,
    /createRequestCompletionConsentHandoff\(\{[\s\S]*?flushVerifiedConversions: flushPendingVerifiedConversions[\s\S]*?navigate: \(\) => \{[\s\S]*?window\.location\.assign\("\/dashboard"\)/
  );
  assert.match(paymentPage, /await trackPurchaseCompleted\(\{[\s\S]*?\}\)\.catch\(\(\) => false\);/);
  assert.ok(
    paymentPage.indexOf("await trackPurchaseCompleted({") <
      paymentPage.indexOf('setState("success")')
  );
  assert.ok(
    registerPage.indexOf("await completeRegistrationHandoffsBeforeNavigation(") <
      registerPage.indexOf("setSuccess(true)")
  );
  assert.match(
    registerPage,
    /await completeRegistrationHandoffsBeforeNavigation\(/
  );
  assert.doesNotMatch(
    registerPage,
    /recordGrowthAccountCreated|trackRegistrationCompleted/
  );
  const registrationDeliveryStart = registrationClient.indexOf(
    "async function deliverRegistrationConversion"
  );
  const registrationDeliveryEnd = registrationClient.indexOf(
    "function deliverRegistrationNotification",
    registrationDeliveryStart
  );
  const registrationDelivery = registrationClient.slice(
    registrationDeliveryStart,
    registrationDeliveryEnd
  );
  const registrationSeedIndex = registrationDelivery.indexOf(
    "recordGrowthAccountCreated(expectedAccount.userId)"
  );
  const registrationPreTrackBindingIndex = registrationDelivery.indexOf(
    "registrationAccountStillMatches(expectedAccount)",
    registrationSeedIndex
  );
  const registrationTrackIndex = registrationDelivery.indexOf(
    "trackRegistrationCompleted(conversionSeed)",
    registrationPreTrackBindingIndex
  );
  const registrationFinalBindingIndex = registrationDelivery.indexOf(
    "registrationAccountStillMatches(expectedAccount)",
    registrationTrackIndex
  );
  assert.ok(registrationSeedIndex >= 0);
  assert.ok(registrationPreTrackBindingIndex > registrationSeedIndex);
  assert.ok(registrationTrackIndex > registrationPreTrackBindingIndex);
  assert.ok(registrationFinalBindingIndex > registrationTrackIndex);
  assert.ok(
    authCallback.indexOf("await completeRegistrationHandoffsBeforeNavigation(") <
      authCallback.indexOf("router.replace(next)")
  );
  const completeProfileHandoffIndex = completeProfile.indexOf(
    "await completeRegistrationHandoffsBeforeNavigation("
  );
  const completeProfileCallbackIndex = completeProfile.indexOf(
    "const callbackDestination ="
  );
  const completeProfileNavigationIndex = completeProfile.indexOf(
    "replacePrivateMeasurementDocument(callbackDestination)",
    completeProfileHandoffIndex
  );
  assert.ok(completeProfileCallbackIndex >= 0);
  assert.ok(completeProfileHandoffIndex > completeProfileCallbackIndex);
  assert.ok(completeProfileNavigationIndex > completeProfileHandoffIndex);
  assert.match(
    completeProfile,
    /replaceWithPendingMeasurementCompletion\([\s\S]*?callbackDestination[\s\S]*?\)/
  );
  assert.doesNotMatch(
    completeProfile,
    /replaceWithPendingMeasurementCompletion\(next\)/
  );
  for (const source of [registerPage, authCallback, completeProfile]) {
    assert.match(
      source,
      /onConversionHandoffCompleted:[\s\S]*?startMeasurementBridge/
    );
  }
  assert.match(registrationClient, /completeRegistrationHandoffsBeforeNavigation[\s\S]*?REGISTRATION_HANDOFF_NAVIGATION_BUDGET_MS/);
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
  assert.match(component, /isMeasurementConsentPath\(pathname\)/);
  assert.match(component, /analyticsRouteAllowed/);
  assert.match(
    component,
    /const initialized = initializeGoogleMeasurement\(configuration\);[\s\S]*?updateMeasurementReady\([\s\S]*?initialized &&[\s\S]*?sanitizeGoogleMeasurementBrowserLocation\(\{[\s\S]*?advertising: preferences\.advertising/
  );
  assert.match(component, /queueMicrotask\(\(\) =>/);
  assert.match(component, /measurementReady && scriptId && googleMeasurementRouteAllowed/);
  assert.match(component, /googleMeasurementScriptRetryDelays/);
  assert.match(component, /mg_retry_attempt=\$\{measurementScriptAttempt\}/);
  assert.match(component, /onLoad=\{\(\) => \{[\s\S]*?notifyGoogleMeasurementScriptLoaded/);
  assert.match(component, /onError=\{\(\) => \{[\s\S]*?notifyGoogleMeasurementScriptFailed/);
  assert.doesNotMatch(component, /onReady=\{/);
  assert.match(component, /denyGoogleMeasurement\(\);/);
  assert.match(component, /getAnalyticsConsentCopy\(pathname, activeLocale\)/);
  assert.match(consentCopy, /Necessary only/);
  assert.match(consentCopy, /File names, vehicle details, account data and order IDs are never included/);
  assert.match(analytics, /ad_storage: preferences\.advertising \? "granted" : "denied"/);
  assert.match(analytics, /ad_user_data: preferences\.advertising \? "granted" : "denied"/);
  assert.match(analytics, /ad_personalization: "denied"/);
  assert.match(analytics, /page_referrer: ""/);
  assert.match(analytics, /page_location: isAdsTag[\s\S]*safeGoogleAdsLandingLocation\([\s\S]*window\.location\.pathname[\s\S]*window\.location\.search[\s\S]*safeAnalyticsLocation\(window\.location\.pathname\)/);
  assert.doesNotMatch(analytics, /page_location:\s*window\.location\.href/);
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
  assert.match(client, /Technical configuration complete - not launch-ready/);
  assert.match(client, /External launch gates remain manual and unverified/);
  assert.match(client, /Manual \/ unverified/);
  assert.match(client, /landingReviewStatusLabel\(page\.status\)/);
  assert.match(client, /deliveryVerification\.detail/);
  assert.doesNotMatch(client, /Measurement ready|of 7 verified/);
  assert.match(readiness, /applicationRetainsRawClickIds: false/);
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
