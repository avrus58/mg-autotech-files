import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  analyticsConsentCopy,
  getAnalyticsConsentCopy,
  getAnalyticsConsentLocale,
} from "../src/lib/analyticsConsentI18n";
import { supportedLocales } from "../src/lib/i18nConfig";

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
  assert.equal(getAnalyticsConsentCopy("/de/services/stage-1").title, "Datenschutzauswahl");
  assert.equal(getAnalyticsConsentCopy("/tr").title, "Gizlilik tercihleri");
  assert.equal(getAnalyticsConsentCopy("/fr/how-it-works").title, "Choix de confidentialité");
  assert.equal(getAnalyticsConsentLocale("/new-request"), "en");
  assert.equal(getAnalyticsConsentCopy("/").title, "Privacy choices");
});

test("the consent UI renders locale copy and granular measurement choices", () => {
  const component = readFileSync(
    path.join(projectRoot, "src", "components", "analytics", "PublicAnalytics.tsx"),
    "utf8",
  );

  assert.match(component, /getAnalyticsConsentCopy\(pathname\)/);
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
