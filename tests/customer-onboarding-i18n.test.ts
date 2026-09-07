import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { supportedLocales } from "../src/lib/i18nConfig";
import {
  customerOnboardingT,
  customerOnboardingRows,
  customerOnboardingLocaleOrder,
} from "../src/lib/i18n/customer-onboarding-translations";
import { customerWorkflowSharedSourceManifest } from "../src/lib/i18n/customer-workflow-surface-manifest";

const guideSource = "src/components/dashboard/CustomerOnboardingGuide.tsx";
const guideCopy = [
  "Welcome to your workspace",
  "A quick tour of credits, file requests and support. You can skip it at any time.",
  "1. Prepare your original file",
  "Keep the original ECU or TCU read ready. You can add your vehicle, controller and service details when creating a request.",
  "2. Choose your credits",
  "Open Buy Credits to compare the available packages or enter an amount. Your account prices are shown before payment.",
  "3. Create a file request",
  "Open New File Request, select your vehicle and services, then upload your original file and review the details.",
  "4. Follow progress and get help",
  "Open an order to see its status, exchange messages and download the finished file when it is ready.",
  "Start tour",
  "Skip tour",
  "Next step",
  "Previous step",
  "Finish tour",
  "Saving your choice…",
  "Your choice could not be saved. Please try again so the tour stays dismissed on your other devices.",
  "Retry",
  "Continue without saving",
  "Tour progress",
  "Getting started",
  "Open Buy Credits",
  "Open New File Request",
  "Open My Orders",
  "Opens in a new tab",
] as const;

test("customer introduction remains in the shared portal translation inventory", () => {
  assert.deepEqual(
    customerWorkflowSharedSourceManifest["portal-common"].typedUiBoundaries.find(
      ({ file }) => file === guideSource,
    ),
    { file: guideSource, localizationImport: "@/lib/i18n/customer-onboarding-translations" },
  );
  const source = readFileSync(guideSource, "utf8");
  assert.match(source, /@\/lib\/i18n\/customer-onboarding-translations/u);
  assert.match(source, /useActiveLocale\(\)/u);
  assert.doesNotMatch(source, /data-no-translate/u);
  for (const copy of guideCopy) {
    assert.ok(source.includes(JSON.stringify(copy)), `Guide no longer uses: ${copy}`);
    assert.ok(customerOnboardingRows.some(([key]) => key === copy), `Catalog is missing: ${copy}`);
  }
});

test("customer introduction actions, steps and save failures render in every locale", () => {
  assert.deepEqual(
    [...customerOnboardingLocaleOrder].sort(),
    supportedLocales.map(({ code }) => code).filter((code) => code !== "en").sort(),
  );
  assert.equal(new Set(customerOnboardingRows.map(([source]) => source)).size, guideCopy.length);
  assert.equal(customerOnboardingRows.length, guideCopy.length);
  for (const row of customerOnboardingRows) assert.equal(row.length, supportedLocales.length);
  for (const source of guideCopy) {
    assert.equal(customerOnboardingT("en", source), source);
    for (const { code: locale } of supportedLocales) {
      if (locale === "en") continue;
      const localeIndex = customerOnboardingLocaleOrder.indexOf(locale);
      const expected = customerOnboardingRows.find(([key]) => key === source)?.[localeIndex + 1];
      assert.ok(expected, `${locale}: missing translation for ${source}`);
      assert.ok(expected.trim(), `${locale}: blank translation for ${source}`);
      assert.notEqual(expected, source, `${locale}: English fallback for ${source}`);
      assert.equal(
        customerOnboardingT(locale, source),
        expected,
        `${locale}: first-paint catalog mismatch for ${source}`,
      );
      assert.doesNotMatch(expected, /\uFFFD|\{\{?|\}\}?/u);
    }
  }
});

test("original-file guidance preserves the ECU and TCU technical terms", () => {
  const source = guideCopy[3];
  for (const { code: locale } of supportedLocales) {
    const translated = customerOnboardingT(locale, source);
    assert.match(translated, /\bECU\b/u, locale);
    assert.match(translated, /\bTCU\b/u, locale);
  }
});
