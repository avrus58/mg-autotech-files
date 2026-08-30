import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { exactTranslations } from "../src/lib/i18n";
import {
  customerRuntimeLocaleOrder,
  customerRuntimeExactT,
  customerRuntimeTranslations,
} from "../src/lib/i18n/customer-runtime-translations";
import {
  customerWorkflowExactTranslations,
  customerWorkflowLocaleOrder,
} from "../src/lib/i18n/customer-workflow-translations";
import { intlLocaleByCode, supportedLocales } from "../src/lib/i18nConfig";
import { publicCoreTranslations } from "../src/lib/i18n/public-core-translations";
import { publicServicesTranslations } from "../src/lib/i18n/public-services-translations";
import { publicSurfaceLocaleOrder } from "../src/lib/i18n/public-surface-types";
import { publicToolsTranslations } from "../src/lib/i18n/public-tools-translations";
import { publicVehicleTranslations } from "../src/lib/i18n/public-vehicle-translations";
import {
  serviceIntentExactTranslations,
  serviceIntentLocaleOrder,
} from "../src/lib/i18n/service-intent-translations";
import {
  widgetSiteExactTranslations,
  widgetSiteLocaleOrder,
} from "../src/lib/i18n/widget-site-translations";
import {
  workshopGuideExactTranslations,
  workshopGuideLocaleOrder,
} from "../src/lib/i18n/workshop-guides-translations";

test("the language menu exposes native names, flags and valid Intl locales", () => {
  assert.equal(supportedLocales.length, 12);
  assert.equal(new Set(supportedLocales.map(({ code }) => code)).size, 12);
  assert.equal(new Set(supportedLocales.map(({ flag }) => flag)).size, 12);

  for (const locale of supportedLocales) {
    assert.ok(locale.name.trim(), locale.code);
    assert.ok(locale.flag.trim(), locale.code);
    assert.doesNotThrow(() => new Intl.DisplayNames([intlLocaleByCode[locale.code]], { type: "region" }));
  }
});

test("shared runtime copy covers every non-English site locale without fallback", () => {
  const configured = supportedLocales
    .map(({ code }) => code)
    .filter((code) => code !== "en");

  assert.deepEqual([...customerRuntimeLocaleOrder].sort(), configured.sort());

  for (const [source, values] of Object.entries(customerRuntimeTranslations)) {
    assert.equal(values.length, customerRuntimeLocaleOrder.length, source);
    values.forEach((value, index) => {
      const locale = customerRuntimeLocaleOrder[index];
      assert.ok(value.trim(), `${locale}: ${source}`);
      assert.notEqual(value, source, `${locale}: ${source}`);
    });
  }
});

test("shared runtime copy does not reintroduce legacy ASCII transliteration", () => {
  const forbiddenByLocale: Partial<Record<(typeof customerRuntimeLocaleOrder)[number], RegExp>> = {
    de: /\b(?:fuer|ueber|zurueck|oeffnen|pruefen|waehlen)\b/iu,
    tr: /\b(?:musteri|guvenli|sifre|ulke|odeme|yukle|dogrula|islem|baslat|olustur)\b/iu,
    sq: /\b(?:dhenat|kerkohet|perdor|llogarise|permbledhja)\b/iu,
  };

  for (const [source, values] of Object.entries(customerRuntimeTranslations)) {
    values.forEach((value, index) => {
      const locale = customerRuntimeLocaleOrder[index];
      const forbidden = forbiddenByLocale[locale];
      assert.equal(forbidden?.test(value) ?? false, false, `${locale}: ${source} => ${value}`);
    });
  }
});

test("dynamic auth copy is translatable while provider and customer data stay protected", () => {
  const googleButton = readFileSync("src/components/auth/GoogleIdentityButton.tsx", "utf8");
  const requestChat = readFileSync("src/components/RequestChat.tsx", "utf8");
  const phoneField = readFileSync("src/components/InternationalPhoneField.tsx", "utf8");
  const normalizedPhoneField = phoneField.replace(/\s+/gu, " ");
  const turnstile = readFileSync("src/components/auth/TurnstileChallenge.tsx", "utf8");
  const login = readFileSync("src/app/login/page.tsx", "utf8");
  const register = readFileSync("src/app/register/page.tsx", "utf8");
  const recovery = readFileSync("src/app/forgot-password/page.tsx", "utf8");

  assert.doesNotMatch(googleButton, /ref=\{wrapperRef\}[\s\S]{0,80}data-no-translate/u);
  assert.match(googleButton, /ref=\{containerRef\}[\s\S]{0,100}data-no-translate/u);
  assert.match(requestChat, /translate="no"[\s\S]{0,80}data-no-translate/u);
  assert.match(googleButton, /const locale = useActiveLocale\(\)/u);
  assert.match(googleButton, /locale: intlLocaleByCode\[locale\]\.replace\("-", "_"\)/u);
  assert.match(googleButton, /\[clientId, loadAttempt, locale, resetKey\]/u);
  assert.doesNotMatch(googleButton, /gsi\/client\?hl=en/u);
  assert.match(turnstile, /language: turnstileLanguage\(locale\)/u);
  assert.match(turnstile, /locale === "sq"\) return "en"/u);
  assert.match(turnstile, /\[action, appearance, loadAttempt, locale, siteKey, widgetSize\]/u);

  for (const locale of customerRuntimeLocaleOrder) {
    for (const source of [
      "Security verification is temporarily unavailable. Please try again later.",
      "Please complete the security verification before continuing.",
    ]) {
      assert.notEqual(customerRuntimeExactT(locale, source), source, `${locale}: ${source}`);
    }
  }
  for (const source of [login, register, recovery]) {
    assert.match(source, /customerRuntimeExactT/u);
  }

  for (const source of [
    "Country calling code",
    "Select a country calling code",
    "Mobile or landline",
    "Calling code starts from your country. Enter the local number; special carrier plans may require the full + number.",
  ]) {
    assert.match(normalizedPhoneField, new RegExp(source.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
    assert.ok(
      customerRuntimeTranslations[source as keyof typeof customerRuntimeTranslations],
      source
    );
  }
});

test("the locale observer handles dynamic text, accessibility attributes and exact-only translation", () => {
  const switcher = readFileSync("src/components/LanguageSwitcher.tsx", "utf8");

  assert.match(switcher, /characterData: true/u);
  assert.match(switcher, /attributes: true/u);
  assert.match(switcher, /aria-description/u);
  assert.match(switcher, /aria-roledescription/u);
  assert.match(switcher, /translateNode\(document\.head/u);
  assert.match(switcher, /brandedTitleSuffix = " \| MG AutoTech"/u);
  assert.match(switcher, /loadScopedExactTranslations\(pathname, locale\)/u);
  assert.match(switcher, /public-core-translations/u);
  assert.match(switcher, /public-vehicle-translations/u);
  assert.match(switcher, /public-services-translations/u);
  assert.match(switcher, /public-tools-translations/u);
  assert.match(switcher, /customer-workflow-translations/u);
  assert.match(switcher, /widget-site-translations/u);
  assert.match(switcher, /hiddenLocalizedFlow/u);
  assert.match(switcher, /const externallySelectedLocale = useActiveLocale\(\)/u);
  assert.match(switcher, /current === externallySelectedLocale/u);
  assert.match(switcher, /hideSwitcher && !hiddenLocalizedFlow/u);
  assert.match(switcher, /supplementalExact\[locale\]/u);
  assert.doesNotMatch(switcher, /\.reduce\(\(text, \[source, target\]\)/u);

  const inventory = readFileSync("scripts/check-customer-i18n.ts", "utf8");
  assert.match(inventory, /metadataDeclaration/u);
  assert.match(inventory, /\["title", "description", "alt"\]/u);

  const baseCatalog = readFileSync("src/lib/i18n.ts", "utf8");
  assert.doesNotMatch(baseCatalog, /publicCoreTranslations/u);
  assert.doesNotMatch(baseCatalog, /publicVehicleTranslations/u);
  assert.doesNotMatch(baseCatalog, /publicServicesTranslations/u);
  assert.doesNotMatch(baseCatalog, /publicToolsTranslations/u);
  assert.doesNotMatch(baseCatalog, /customerWorkflowExactTranslations/u);
  assert.doesNotMatch(baseCatalog, /widgetSiteExactTranslations/u);
  assert.doesNotMatch(baseCatalog, /logStudioExactTranslations/u);
});

test("customer timestamps use the active site locale while admin chat stays English", () => {
  const notifications = readFileSync("src/components/CustomerNotifications.tsx", "utf8");
  const chat = readFileSync("src/components/RequestChat.tsx", "utf8");
  const dashboard = readFileSync("src/components/dashboard/DashboardClient.tsx", "utf8");

  for (const source of [notifications, chat, dashboard]) {
    assert.match(source, /useActiveLocale/u);
    assert.match(source, /intlLocaleByCode\[locale\]/u);
  }

  assert.match(chat, /senderRole === "admin" \? "en" : preferredLocale/u);
  assert.doesNotMatch(notifications, /toLocaleDateString\("de-DE"/u);
  assert.doesNotMatch(dashboard, /Intl\.DateTimeFormat\("de-DE"/u);
});

test("authored German legal content declares its language explicitly", () => {
  const processingAgreement = readFileSync("src/app/av-vertrag/page.tsx", "utf8");
  assert.match(processingAgreement, /<div lang="de" data-no-translate/u);
});

test("catalogs loaded together only use reviewed contextual overrides", () => {
  type TupleCatalog = readonly [
    label: string,
    localeOrder: readonly string[],
    translations: Record<string, readonly string[]>,
  ];

  const core: TupleCatalog = ["public-core", publicSurfaceLocaleOrder, publicCoreTranslations];
  const globallyStableSources = new Set([
    "Buy Credits",
    "Contact",
    "Create File Request",
    "Credit Prices",
    "Customer Dashboard",
    "Datalog Analysis Studio",
    "File Service",
    "Home",
    "How It Works",
    "Platform",
    "Primary navigation",
    "Services",
    "Start Request",
    "Upload File",
    "Vehicle Widget",
  ]);
  const contextualOverrides = new Set([
    "About MG AutoTech",
    "Breadcrumb",
    "Cancelled",
    "Create file request",
    "ECU File Service",
    "ECU platform guides",
    "Email support",
    "ECU read-method advisor",
    "File readiness check",
    "Privacy",
    "Request brief builder",
    "Submit securely",
    "TCU tuning file service",
    "Technical review",
    "Vehicle brand guides",
  ]);
  const bundles: ReadonlyArray<readonly [string, readonly TupleCatalog[]]> = [
    ["vehicle", [core, ["public-vehicle", publicSurfaceLocaleOrder, publicVehicleTranslations]]],
    ["tools", [core, ["public-tools", publicSurfaceLocaleOrder, publicToolsTranslations]]],
    ["services", [
      core,
      ["public-services", publicSurfaceLocaleOrder, publicServicesTranslations],
      ["service-intent", serviceIntentLocaleOrder, serviceIntentExactTranslations],
    ]],
    ["workshop-guides", [
      core,
      ["workshop-guides", workshopGuideLocaleOrder, workshopGuideExactTranslations],
    ]],
    ["public-widget", [
      core,
      ["widget", widgetSiteLocaleOrder, widgetSiteExactTranslations],
    ]],
    ["customer-widget", [
      ["customer", customerWorkflowLocaleOrder, customerWorkflowExactTranslations],
      ["widget", widgetSiteLocaleOrder, widgetSiteExactTranslations],
    ]],
  ];

  for (const [bundleName, catalogs] of bundles) {
    for (const { code: locale } of supportedLocales) {
      if (locale === "en") continue;
      const seen = new Map<string, { label: string; value: string }>();
      const conflicts: string[] = [];

      for (const source of globallyStableSources) {
        const value = exactTranslations[locale][source];
        if (value) seen.set(source, { label: "base", value });
      }

      for (const [label, localeOrder, translations] of catalogs) {
        const localeIndex = localeOrder.indexOf(locale);
        assert.notEqual(localeIndex, -1, `${bundleName}.${label}.${locale}`);
        for (const [source, values] of Object.entries(translations)) {
          const value = values[localeIndex];
          if (!value) continue;
          const previous = seen.get(source);
          if (
            previous &&
            previous.value !== value &&
            !contextualOverrides.has(source)
          ) {
            conflicts.push(`${source}: ${previous.label}=${previous.value} <> ${label}=${value}`);
          } else {
            seen.set(source, { label, value });
          }
        }
      }

      assert.deepEqual(conflicts, [], `${bundleName}.${locale}`);
    }
  }
});
