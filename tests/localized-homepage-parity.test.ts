import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { supportedLocales } from "../src/lib/i18nConfig";
import { homepageHeroCopy } from "../src/lib/homepageHeroI18n";
import { homepageExperienceExactTranslations } from "../src/lib/homepageExperienceTranslations";
import { buildHomepageTranslationCatalog } from "../src/lib/homepageTranslationCatalog";
import { publicVehicleCopy } from "../src/components/homepage/VehicleIntelligence";
import {
  localizeHomepageHref,
  translateHomepageText,
} from "../src/lib/homepageLocalization";

const rootHomepage = [
  readFileSync("src/app/page.tsx", "utf8"),
  readFileSync("src/components/homepage/HomepageExperience.tsx", "utf8"),
  readFileSync("src/components/homepage/VehicleIntelligence.tsx", "utf8"),
].join("\n");
const rootLayout = readFileSync("src/app/layout.tsx", "utf8");
const localizedHomepageRoute = readFileSync("src/app/[locale]/page.tsx", "utf8");
const localizedLayout = readFileSync("src/app/[locale]/layout.tsx", "utf8");
const homepageMetadata = readFileSync("src/lib/homepageMetadata.ts", "utf8");
const serverLocaleBoundary = readFileSync(
  "src/components/ServerLocaleBoundary.tsx",
  "utf8",
);
const languageSwitcher = readFileSync("src/components/LanguageSwitcher.tsx", "utf8");

test("localized homepages use the exact English homepage component tree", () => {
  assert.match(localizedHomepageRoute, /import \{ HomepageExperience \} from "@\/components\/homepage\/HomepageExperience"/u);
  assert.match(localizedHomepageRoute, /<HomepageExperience/u);
  assert.match(localizedHomepageRoute, /includeStructuredData=\{false\}/u);
  assert.match(rootHomepage, /export function HomepageExperience/u);
  assert.match(rootHomepage, /data-unified-localized-homepage/u);
  assert.match(rootHomepage, /HomepageLocalizationProvider/u);
  assert.equal(existsSync("src/components/LocalizedSeoHome.tsx"), false);
});

test("localized homepage keeps locale metadata and one localized schema graph", () => {
  assert.match(localizedHomepageRoute, /buildLocalizedHomepageJsonLd/u);
  assert.match(localizedHomepageRoute, /buildHomepageMetadata\(rawLocale as LocaleCode\)/u);
  assert.match(homepageMetadata, /languageAlternates\("\/"\)/u);
  assert.match(localizedHomepageRoute, /localizedUrl\(locale, "\/"\)/u);
  assert.match(localizedHomepageRoute, /JSON\.stringify\(jsonLd\)/u);
  assert.match(localizedHomepageRoute, /buildHomepageTranslationCatalog\(locale\)/u);
  assert.doesNotMatch(localizedHomepageRoute, /exactTranslations\[locale\]/u);
  assert.doesNotMatch(localizedHomepageRoute, /termTranslations\[locale\]/u);
});

test("localized routes set the browser document language before hydration", () => {
  assert.match(rootLayout, /<html[\s\S]*suppressHydrationWarning/u);
  assert.match(localizedLayout, /<ServerLocaleBoundary locale=\{locale\}>/u);
  assert.match(serverLocaleBoundary, /data-server-document-language/u);
  assert.match(serverLocaleBoundary, /document\.documentElement\.lang/u);
  assert.match(serverLocaleBoundary, /JSON\.stringify\(documentLanguage\)/u);
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
    const catalog = buildHomepageTranslationCatalog(locale);

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
    assert.ok(
      buildHomepageTranslationCatalog(code)?.exact[
        "Professional online file service platform"
      ],
      code,
    );
    assert.notEqual(homepageHeroCopy[code].customTitle, homepageHeroCopy.en.customTitle, code);
    assert.notEqual(homepageHeroCopy[code].tuningFiles, homepageHeroCopy.en.tuningFiles, code);
    assert.notEqual(homepageHeroCopy[code].securePortal, homepageHeroCopy.en.securePortal, code);
  }
});

test("the refreshed homepage has reviewed exact copy for every visible journey section", () => {
  const criticalSources = [
    "The core workshop services, without the clutter.",
    "From original file to secure delivery in four clear steps.",
    "A file service workflow built for serious workshop operations.",
    "Brands and controller families in one compact library.",
    "Choose a package. Use credits when you need them.",
    "Go deeper only when you need to.",
    "The important answers, without another wall of cards.",
    "Put the next request into one clear workflow.",
    "Secure request workspace",
    "Loading current credit prices",
  ] as const;

  for (const { code } of supportedLocales) {
    if (code === "en") continue;
    for (const source of criticalSources) {
      const translated = homepageExperienceExactTranslations[code][source];
      assert.ok(translated, `${code}: ${source}`);
      assert.notEqual(translated, source, `${code}: ${source}`);
    }
  }
});

test("vehicle intelligence receives the route locale before hydration and has complete reviewed copy", () => {
  assert.match(rootHomepage, /<VehicleIntelligence locale=\{locale\} \/>/u);

  const identicalNaturalTerms: string[] = [];

  for (const { code } of supportedLocales) {
    if (code === "en") continue;
    const copy = publicVehicleCopy[code];
    for (const field of Object.keys(publicVehicleCopy.en) as Array<
      keyof typeof publicVehicleCopy.en
    >) {
      assert.ok(copy[field].trim(), `${code}: ${field}`);
      if (copy[field] === publicVehicleCopy.en[field]) {
        identicalNaturalTerms.push(`${code}:${field}`);
      }
    }
  }

  assert.deepEqual(identicalNaturalTerms.sort(), [
    "de:generationPlaceholder",
    "fr:gain",
    "nl:modelPlaceholder",
    "pl:modelPlaceholder",
    "tr:modelPlaceholder",
  ]);
});

test("vehicle intelligence protects raw values without hiding its localized surface", () => {
  const vehicleSource = readFileSync(
    "src/components/homepage/VehicleIntelligence.tsx",
    "utf8"
  );
  assert.doesNotMatch(vehicleSource, /<section[^>]+data-no-translate/u);
  assert.match(vehicleSource, /option\.name/u);
  assert.match(vehicleSource, /translate="no" data-no-translate/u);
});

test("localized helper components translate their rendered output and the header logo keeps locale", () => {
  assert.ok((rootHomepage.match(/<LocalizedHomepageTree>/gu) ?? []).length >= 7);
  assert.equal(localizeHomepageHref("/", "de"), "/de");
  assert.match(rootHomepage, /<Link href="\/"[^>]+aria-label="MG AutoTech home"/u);
});

test("deferred homepage modules stay inside the locale translation observer", () => {
  assert.match(languageSwitcher, /data-unified-localized-homepage/u);
  assert.match(languageSwitcher, /hasDeferredLocalizedHomepage/u);
  assert.match(languageSwitcher, /MutationObserver/u);
  assert.doesNotMatch(languageSwitcher, /getPathLocale\(pathname\)\) \{\s*translatedLocaleRef/u);
});

test("localized hero and navigation stay readable on phones and compact laptops", () => {
  assert.match(rootHomepage, /locale === "en"/u);
  assert.match(rootHomepage, /text-\[clamp\(2\.8rem,7vw,6\.5rem\)\]/u);
  assert.match(rootHomepage, /aria-label="Open navigation"/u);
  assert.match(rootHomepage, /className="hidden items-center gap-1 lg:flex"/u);
  assert.match(rootHomepage, /w-\[min\(20rem,calc\(100vw-2rem\)\)\]/u);
  assert.match(rootHomepage, /overflow-x-hidden/u);
});
