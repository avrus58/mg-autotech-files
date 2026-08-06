import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { exactTranslations, termTranslations } from "../src/lib/i18n";
import { supportedLocales } from "../src/lib/i18nConfig";
import { homepageHeroCopy } from "../src/lib/homepageHeroI18n";
import {
  localizeHomepageHref,
  translateHomepageText,
} from "../src/lib/homepageLocalization";

const rootHomepage = readFileSync("src/app/page.tsx", "utf8");
const rootLayout = readFileSync("src/app/layout.tsx", "utf8");
const localizedHomepageRoute = readFileSync("src/app/[locale]/page.tsx", "utf8");
const localizedLayout = readFileSync("src/app/[locale]/layout.tsx", "utf8");
const languageSwitcher = readFileSync("src/components/LanguageSwitcher.tsx", "utf8");

test("localized homepages use the exact English homepage component tree", () => {
  assert.match(localizedHomepageRoute, /import \{ UnifiedHomePage \} from "@\/app\/page"/u);
  assert.match(localizedHomepageRoute, /<UnifiedHomePage/u);
  assert.match(localizedHomepageRoute, /includeStructuredData=\{false\}/u);
  assert.match(rootHomepage, /export function UnifiedHomePage/u);
  assert.match(rootHomepage, /data-unified-localized-homepage/u);
  assert.match(rootHomepage, /HomepageLocalizationProvider/u);
  assert.equal(existsSync("src/components/LocalizedSeoHome.tsx"), false);
});

test("localized homepage keeps locale metadata and one localized schema graph", () => {
  assert.match(localizedHomepageRoute, /buildLocalizedHomepageJsonLd/u);
  assert.match(localizedHomepageRoute, /languageAlternates\("\/"\)/u);
  assert.match(localizedHomepageRoute, /localizedUrl\(locale, "\/"\)/u);
  assert.match(localizedHomepageRoute, /JSON\.stringify\(jsonLd\)/u);
  assert.match(localizedHomepageRoute, /exactTranslations\[locale\]/u);
  assert.match(localizedHomepageRoute, /termTranslations\[locale\]/u);
});

test("localized routes set the browser document language before hydration", () => {
  assert.match(rootLayout, /<html[\s\S]*suppressHydrationWarning/u);
  assert.match(localizedLayout, /data-locale-document-language/u);
  assert.match(localizedLayout, /document\.documentElement\.lang/u);
  assert.match(localizedLayout, /JSON\.stringify\(documentLanguage\)/u);
  assert.match(localizedLayout, /<div lang=\{documentLanguage\}>/u);
});

test("homepage links localize only when an equivalent locale page exists", () => {
  assert.equal(localizeHomepageHref("/", "de"), "/de");
  assert.equal(localizeHomepageHref("/#services", "tr"), "/tr#services");
  assert.equal(localizeHomepageHref("/file-service#stage-comparison", "fr"), "/fr/file-service#stage-comparison");
  assert.equal(localizeHomepageHref("/how-it-works?from=home", "de"), "/de/how-it-works?from=home");
  assert.equal(localizeHomepageHref("/services/stage-1", "tr"), "/tr/services/stage-1");
  assert.equal(localizeHomepageHref("/services/dtc-off", "de"), "/de/services/dtc-off");
  assert.equal(localizeHomepageHref("/services/stage-2", "de"), "/services/stage-2");
  assert.equal(localizeHomepageHref("/new-request", "de"), "/new-request");
  assert.equal(localizeHomepageHref("/dashboard", "tr"), "/dashboard");
  assert.equal(localizeHomepageHref("mailto:info@mgautotech.de", "de"), "mailto:info@mgautotech.de");
});

test("critical hero copy is translated from the shared catalog without touching technical values", () => {
  for (const locale of ["de", "tr", "fr"] as const) {
    const catalog = {
      exact: exactTranslations[locale],
      terms: termTranslations[locale],
    };

    assert.notEqual(
      translateHomepageText("Professional online file service platform", catalog),
      "Professional online file service platform",
      locale
    );
    assert.notEqual(
      translateHomepageText("Custom ECU & TCU", catalog),
      "Custom ECU & TCU",
      locale
    );
    assert.notEqual(
      translateHomepageText("Tuning Files", catalog),
      "Tuning Files",
      locale
    );
    assert.equal(
      translateHomepageText("info@mgautotech.de", catalog),
      "info@mgautotech.de",
      locale
    );
  }
});

test("all configured non-English locales receive the unified homepage route", () => {
  const nonEnglishLocales = supportedLocales.filter(({ code }) => code !== "en");

  assert.equal(nonEnglishLocales.length, 11);
  for (const { code } of nonEnglishLocales) {
    assert.equal(localizeHomepageHref("/", code), `/${code}`);
    assert.ok(exactTranslations[code]["Professional online file service platform"], code);
    assert.notEqual(homepageHeroCopy[code].customTitle, homepageHeroCopy.en.customTitle, code);
    assert.notEqual(homepageHeroCopy[code].tuningFiles, homepageHeroCopy.en.tuningFiles, code);
    assert.notEqual(homepageHeroCopy[code].securePortal, homepageHeroCopy.en.securePortal, code);
  }
});

test("deferred homepage modules stay inside the locale translation observer", () => {
  assert.match(languageSwitcher, /data-unified-localized-homepage/u);
  assert.match(languageSwitcher, /hasDeferredLocalizedHomepage/u);
  assert.match(languageSwitcher, /MutationObserver/u);
  assert.doesNotMatch(languageSwitcher, /getPathLocale\(pathname\)\) \{\s*translatedLocaleRef/u);
});

test("localized hero and navigation stay readable on phones and compact laptops", () => {
  assert.match(rootHomepage, /locale === "en"/u);
  assert.match(rootHomepage, /text-\[clamp\(2\.15rem,5\.2vw,5\.35rem\)\]/u);
  assert.match(rootHomepage, /tracking-normal/u);
  assert.match(rootHomepage, /gap-3 whitespace-nowrap text-xs font-semibold text-zinc-300 xl:flex/u);
  assert.match(rootHomepage, /min-w-0 shrink-0 items-center/u);
});
