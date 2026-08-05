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

test("analytics consent copy covers every supported locale", () => {
  assert.deepEqual(
    Object.keys(analyticsConsentCopy).sort(),
    supportedLocales.map(({ code }) => code).sort(),
  );

  for (const { code } of supportedLocales) {
    const copy = analyticsConsentCopy[code];
    for (const value of Object.values(copy)) {
      assert.ok(value.trim().length > 0, `${code} contains empty consent copy`);
    }
  }
});

test("localized public routes resolve consent copy without changing private routes", () => {
  assert.equal(getAnalyticsConsentLocale("/de"), "de");
  assert.equal(getAnalyticsConsentCopy("/de/services/stage-1").title, "Optionale Analyse");
  assert.equal(getAnalyticsConsentCopy("/tr").title, "İsteğe bağlı analizler");
  assert.equal(getAnalyticsConsentCopy("/fr/how-it-works").title, "Analyses facultatives");
  assert.equal(getAnalyticsConsentLocale("/new-request"), "en");
  assert.equal(getAnalyticsConsentCopy("/").title, "Optional analytics");
});

test("the consent UI renders locale copy instead of fixed English labels", () => {
  const component = readFileSync(
    path.join(projectRoot, "src", "components", "analytics", "PublicAnalytics.tsx"),
    "utf8",
  );

  assert.match(component, /getAnalyticsConsentCopy\(pathname\)/);
  assert.match(component, /\{consentCopy\.title\}/);
  assert.match(component, /\{consentCopy\.description\}/);
  assert.match(component, /\{consentCopy\.allow\}/);
  assert.match(component, /\{consentCopy\.necessaryOnly\}/);
  assert.match(component, /aria-label=\{consentCopy\.openPreferences\}/);
  assert.doesNotMatch(component, />Optional analytics</);
  assert.doesNotMatch(component, />Allow analytics</);
});
