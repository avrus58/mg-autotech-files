import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  analyticsConsentCopy,
  getAnalyticsConsentCopy,
  getAnalyticsConsentLocale,
  getAnalyticsPrivacyPath,
} from "../src/lib/analyticsConsentI18n";
import { supportedLocales } from "../src/lib/i18nConfig";
import {
  buildPublicPageView,
  isMeasurementConsentPath,
  isPublicAnalyticsPath,
} from "../src/lib/publicAnalytics";

const projectRoot = path.resolve(process.cwd());

test("measurement consent copy covers every supported locale", () => {
  assert.deepEqual(
    Object.keys(analyticsConsentCopy).sort(),
    supportedLocales.map(({ code }) => code).sort(),
  );

  for (const { code } of supportedLocales) {
    const copy = analyticsConsentCopy[code];
    for (const value of Object.values(copy)) {
      assert.ok(value.trim().length > 0, `${code} contains empty consent copy`);
    }
    assert.match(copy.personalizationDisabled, /.+/);
  }
});

test("localized public routes resolve consent copy without changing private routes", () => {
  assert.equal(getAnalyticsConsentLocale("/de"), "de");
  assert.equal(getAnalyticsConsentLocale("/datenschutz"), "de");
  assert.equal(getAnalyticsConsentLocale("/privacy"), "en");
  assert.equal(getAnalyticsConsentCopy("/de/services/stage-1").title, "Datenschutzauswahl");
  assert.equal(getAnalyticsConsentCopy("/datenschutz").title, "Datenschutzauswahl");
  assert.equal(getAnalyticsConsentCopy("/tr").title, "Gizlilik tercihleri");
  assert.equal(getAnalyticsConsentCopy("/fr/how-it-works").title, "Choix de confidentialité");
  assert.equal(getAnalyticsConsentLocale("/new-request"), "en");
  assert.equal(getAnalyticsConsentLocale("/new-request", "tr"), "tr");
  assert.equal(getAnalyticsConsentLocale("/about", "de"), "de");
  assert.equal(getAnalyticsConsentCopy("/about", "tr").title, "Gizlilik tercihleri");
  assert.equal(getAnalyticsConsentCopy("/").title, "Privacy choices");
  assert.equal(getAnalyticsPrivacyPath("/de/services/stage-1"), "/datenschutz");
  assert.equal(getAnalyticsPrivacyPath("/datenschutz"), "/datenschutz");
  assert.equal(getAnalyticsPrivacyPath("/privacy"), "/privacy");
  assert.equal(getAnalyticsPrivacyPath("/en/services/stage-1"), "/privacy");
  assert.equal(getAnalyticsPrivacyPath("/tr"), "/privacy");
  assert.equal(getAnalyticsPrivacyPath("/about", "de"), "/datenschutz");
  assert.equal(getAnalyticsPrivacyPath("/"), "/privacy");

  for (const route of ["/agb", "/av-vertrag", "/impressum", "/widerruf"]) {
    assert.equal(getAnalyticsConsentLocale(route, "tr"), "de", route);
    assert.equal(getAnalyticsPrivacyPath(route, "tr"), "/datenschutz", route);
  }
  for (const route of ["/admin", "/embed/vehicle-selector", "/privacy"]) {
    assert.equal(getAnalyticsConsentLocale(route, "tr"), "en", route);
    assert.equal(getAnalyticsPrivacyPath(route, "tr"), "/privacy", route);
  }
});

test("the consent UI renders locale copy and granular measurement choices", () => {
  const component = readFileSync(
    path.join(projectRoot, "src", "components", "analytics", "PublicAnalytics.tsx"),
    "utf8",
  );

  assert.match(component, /useActiveLocale\(\)/);
  assert.match(component, /getAnalyticsConsentCopy\(pathname, activeLocale\)/);
  assert.match(component, /getAnalyticsPrivacyPath\(pathname, activeLocale\)/);
  assert.match(component, /href=\{privacyPath\}/);
  assert.match(component, /\{consentCopy\.title\}/);
  assert.match(component, /\{consentCopy\.description\}/);
  assert.match(component, /\{consentCopy\.acceptAll\}/);
  assert.match(component, /\{consentCopy\.analyticsOnly\}/);
  assert.match(component, /\{consentCopy\.advertisingLabel\}/);
  assert.match(component, /\{consentCopy\.necessaryOnly\}/);
  assert.match(component, /aria-label=\{consentCopy\.openPreferences\}/);
  assert.doesNotMatch(component, />Privacy choices</);
  assert.doesNotMatch(component, />Accept all</);
});

test("conversion measurement routes expose consent choices without becoming public journeys", () => {
  for (const pathname of [
    "/register",
    "/new-request",
    "/auth/callback",
    "/auth/complete-profile",
    "/payment/success",
  ]) {
    assert.equal(isMeasurementConsentPath(pathname), true, pathname);
    assert.equal(isPublicAnalyticsPath(pathname), false, pathname);
    assert.equal(buildPublicPageView(pathname), null, pathname);
  }
  assert.equal(isMeasurementConsentPath("/dashboard/orders/private-id"), false);

  const component = readFileSync(
    path.join(projectRoot, "src", "components", "analytics", "PublicAnalytics.tsx"),
    "utf8",
  );
  assert.match(component, /const analyticsRouteAllowed = isMeasurementConsentPath\(pathname\)/);
  assert.match(
    component,
    /const attributionRouteAllowed =[\s\S]*?attributionPublicRoute \|\| isConversionMeasurementPath\(pathname\)/
  );
  assert.match(component, /const showConsentPanel = !showAdClickConsentGate && \([\s\S]*?preferencesOpen \|\|[\s\S]*?analyticsRouteAllowed && consent !== "loading" && consent\.needsDecision/);
  assert.match(component, /\{consent !== "loading"[\s\S]*?!consent\.needsDecision[\s\S]*?!preferencesOpen[\s\S]*?!showAdClickConsentGate/);
  assert.match(component, /\{measurementReady && scriptId && googleMeasurementRouteAllowed/);
  assert.match(
    component,
    /const currentTouch = attributionPublicRoute[\s\S]*?\? captureGrowthAttributionTouch\(\)[\s\S]*?: null/
  );
  const publicJourneyGuards = component.match(
    /!configured \|\| !hostApproved \|\| !preferences\?\.analytics \|\| !publicRoute/g,
  );
  assert.equal(publicJourneyGuards?.length, 1);
});
