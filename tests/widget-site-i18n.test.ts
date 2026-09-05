import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  widgetSiteExactTranslations,
  widgetSiteLocaleOrder,
  widgetSitePlanLabel,
  widgetSiteSourceCount,
  widgetSiteT,
  widgetSiteTranslations,
  translateWidgetSiteExact,
} from "../src/lib/i18n/widget-site-translations";

const componentSources = {
  sales: readFileSync("src/components/widget/WidgetSalesPageClient.tsx", "utf8"),
  dashboard: readFileSync("src/components/dashboard/WidgetDashboardClient.tsx", "utf8"),
  summary: readFileSync("src/components/widget/SubscriptionSummaryPanel.tsx", "utf8"),
  notice: readFileSync("src/components/widget/SubscriptionNotice.tsx", "utf8"),
  embed: readFileSync("src/components/widget/EmbedCodeBox.tsx", "utf8"),
  selector: readFileSync("src/components/widget/PublicVehicleSelector.tsx", "utf8"),
  billing: readFileSync("src/app/dashboard/widget/billing/page.tsx", "utf8"),
};

function placeholders(value: string) {
  return [...value.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((match) => match[1]).sort();
}

test("widget site catalog covers every supported site locale without fallback spreads", () => {
  assert.deepEqual(widgetSiteLocaleOrder, ["de", "nl", "fr", "it", "ru", "es", "tr", "pt", "zh", "pl", "sq"]);
  assert.equal(widgetSiteSourceCount, 186);

  const englishKeys = Object.keys(widgetSiteTranslations.en);
  assert.equal(englishKeys.length, widgetSiteSourceCount);

  for (const locale of ["en", ...widgetSiteLocaleOrder] as const) {
    const dictionary = widgetSiteTranslations[locale];
    assert.deepEqual(Object.keys(dictionary).sort(), [...englishKeys].sort(), `${locale} must contain every widget-site key`);
    for (const key of englishKeys) {
      const typedKey = key as keyof typeof dictionary;
      assert.ok(dictionary[typedKey].trim(), `${locale}.${key} must not be blank`);
      assert.deepEqual(placeholders(dictionary[typedKey]), placeholders(widgetSiteTranslations.en[typedKey]), `${locale}.${key} must preserve interpolation placeholders`);
    }
  }
});

test("widget exact catalog is complete and keeps native scripts and accents", () => {
  const distinctEnglish = new Set(Object.values(widgetSiteTranslations.en));
  assert.equal(Object.keys(widgetSiteExactTranslations).length, distinctEnglish.size);
  for (const [localeIndex, locale] of widgetSiteLocaleOrder.entries()) {
    for (const [source, translations] of Object.entries(widgetSiteExactTranslations)) {
      assert.ok(translations[localeIndex]?.trim(), `${locale} exact translation must exist for ${source}`);
    }
    const unchanged = Object.entries(widgetSiteTranslations.en).filter(([key, value]) => widgetSiteTranslations[locale][key as keyof typeof widgetSiteTranslations.en] === value);
    assert.ok(unchanged.length <= 6, `${locale} contains too many unchanged English values: ${unchanged.map(([key]) => key).join(", ")}`);
  }

  assert.match(Object.values(widgetSiteTranslations.de).join(" "), /[äöüß]/i);
  assert.match(Object.values(widgetSiteTranslations.nl).join(" "), /[ëé]/i);
  assert.match(Object.values(widgetSiteTranslations.fr).join(" "), /[àâçéèêëîïôùûüÿœæ]/i);
  assert.match(Object.values(widgetSiteTranslations.it).join(" "), /[àèéìòù]/i);
  assert.match(Object.values(widgetSiteTranslations.ru).join(" "), /[А-Яа-яЁё]/);
  assert.match(Object.values(widgetSiteTranslations.es).join(" "), /[áéíóúüñ¿¡]/i);
  assert.match(Object.values(widgetSiteTranslations.tr).join(" "), /[çğıöşüİ]/i);
  assert.match(Object.values(widgetSiteTranslations.pt).join(" "), /[áâãàçéêíóôõú]/i);
  assert.match(Object.values(widgetSiteTranslations.zh).join(" "), /[\u3400-\u9fff]/);
  assert.match(Object.values(widgetSiteTranslations.pl).join(" "), /[ąćęłńóśźż]/i);
  assert.match(Object.values(widgetSiteTranslations.sq).join(" "), /[ëç]/i);
});

test("widget interpolation is typed, locale-aware and does not leak template tokens", () => {
  assert.equal(widgetSiteT("de", "stepsComplete", { done: 2, total: 4 }), "2 von 4 Schritten abgeschlossen");
  assert.equal(widgetSiteT("tr", "deliveryFailures", { count: 3 }), "3 teslimat hatası");
  assert.equal(widgetSiteT("zh", "lastLiveLoad", { value: "2026/08/30 12:30" }), "上次正式环境加载：2026/08/30 12:30");
  assert.equal(widgetSiteT("sq", "startMonthly", { price: "4,99 €" }), "Filloni tani për 4,99 € në muaj");
  assert.equal(widgetSitePlanLabel("fr", "white_label"), "Marque blanche");
  assert.equal(widgetSitePlanLabel("de", "starter"), "Starter");
  assert.equal(widgetSitePlanLabel("tr", "custom_partner_plan"), "custom_partner_plan");
  assert.equal(widgetSiteT("zh", "widgetDashboardMetaTitle"), "车辆小组件面板");
  assert.match(widgetSiteT("pl", "widgetMetaOffer"), /4,99 € miesięcznie/);
});

test("widget API prose is allowlisted even for the English locale", () => {
  assert.equal(
    translateWidgetSiteExact("en", "Settings could not be saved.", "checkoutFailed"),
    "Settings could not be saved.",
  );
  assert.equal(
    translateWidgetSiteExact("de", "Settings could not be saved.", "checkoutFailed"),
    "Die Einstellungen konnten nicht gespeichert werden.",
  );
  assert.equal(
    translateWidgetSiteExact(
      "en",
      "raw provider/database details that must stay private",
      "checkoutFailed",
    ),
    "Checkout could not be started.",
  );
});

test("site locale and embedded widget language remain independent", () => {
  assert.match(componentSources.sales, /const siteLocale = useActiveLocale\(\)/);
  assert.match(componentSources.sales, /useState<WidgetLanguage>\(initialLanguage\)/);
  assert.match(componentSources.sales, /PublicVehicleSelector demo config=\{\{[\s\S]*?language/);
  assert.match(componentSources.dashboard, /const widgetLanguage = client\?\.default_language \?\? "en"/);
  assert.match(componentSources.dashboard, /VehicleLookupPreview client=\{client\} language=\{widgetLanguage\}/);
  assert.doesNotMatch(componentSources.dashboard, /dashboardLanguage|widgetLanguageSet/);
});

test("widget surfaces translate dynamic UI and format dates and numbers by site locale", () => {
  assert.match(componentSources.dashboard, /Intl\.NumberFormat\(intlLocaleByCode\[activeSiteLocale\]\)/);
  assert.match(componentSources.dashboard, /toLocaleString\(intlLocaleByCode\[activeSiteLocale\]\)/);
  assert.match(componentSources.dashboard, /widgetSiteT\(activeSiteLocale, "stepsComplete"/);
  assert.match(componentSources.dashboard, /widgetSiteT\(activeSiteLocale, "deliveryFailures"/);
  assert.match(componentSources.dashboard, /widgetSiteT\(activeSiteLocale, "planStatusLoads"/);
  assert.match(componentSources.dashboard, /widgetSitePlanLabel\(activeSiteLocale, client\.plan\)/);
  assert.doesNotMatch(componentSources.dashboard, /\.toLocaleString\(\)/);
  assert.match(componentSources.summary, /Intl\.NumberFormat\(intlLocaleByCode\[locale\]/);
  assert.match(componentSources.summary, /Intl\.RelativeTimeFormat\(intlLocaleByCode\[locale\]/);
  assert.match(componentSources.summary, /toLocaleDateString\(intlLocaleByCode\[locale\]/);
  assert.match(componentSources.summary, /widgetSiteT\(locale, "perBillingPeriod"/);
  assert.match(componentSources.summary, /widgetSiteT\(locale, "currentPeriodEnds"/);
  assert.match(componentSources.summary, /widgetSitePlanLabel\(locale, summary\?\.plan/);
});

test("all widget success and failure states use the typed site catalog", () => {
  for (const key of [
    "emailRequired",
    "whatsappRequired",
    "settingsSaveFailed",
    "settingsSaved",
    "billingProfileMissing",
    "billingPortalFailed",
    "domainRequestAlreadyPending",
    "requestFailed",
    "domainRequestSent",
  ]) {
    assert.match(componentSources.dashboard, new RegExp(`(?:widgetSiteT|translateWidgetSiteExact)\\(activeSiteLocale,[^\\n]*"${key}"`), `${key} must be localized at its state transition`);
  }
  assert.match(componentSources.sales, /widgetSiteT\(siteLocale, "verifiedBillingEmailRequired"/);
  assert.match(componentSources.sales, /siteLocale === "de" \? "\/datenschutz" : "\/privacy"/);
  assert.match(componentSources.sales, /translateWidgetSiteExact\(siteLocale, payload\.error, "checkoutFailed"/);
  assert.match(componentSources.billing, /translateWidgetSiteExact\([\s\S]*?activeSiteLocale[\s\S]*?"billingPortalFailed"/u);
  assert.match(componentSources.billing, /translateWidgetSiteExact\([\s\S]*?activeSiteLocale[\s\S]*?"billingSummaryApiFailed"/u);
  assert.match(componentSources.billing, /const loadSummary = useCallback\([\s\S]*?\}, \[activeSiteLocale\]\);/u);
  assert.doesNotMatch(componentSources.billing, /widgetSiteT\("en",/u);
  assert.doesNotMatch(componentSources.billing, /message:\s*data\.error/u);
  assert.doesNotMatch(componentSources.billing, /setSummaryError\(\s*data\.error/u);
});

test("raw embed, domains and product-owned language remain protected without broad page exclusions", () => {
  assert.doesNotMatch(componentSources.sales, /<main[^>]*data-no-translate/);
  assert.doesNotMatch(componentSources.dashboard, /<main[^>]*data-no-translate/);
  assert.match(
    componentSources.embed,
    /<pre[^>]*><code translate="no" data-no-translate>/,
  );
  assert.match(componentSources.dashboard, /translate="no" data-no-translate[^>]*>\{client\.allowed_domain\}/);
  assert.equal(
    componentSources.selector.match(/<div translate="no" data-no-translate\b/gu)?.length,
    2,
    "the separately localized widget product must be isolated from the site-wide DOM translator"
  );
  assert.match(componentSources.selector, /const closeLabels: Record<WidgetLanguage, string>/);
  assert.match(componentSources.selector, /aria-label=\{closeLabels\[language\]\}/);
});
