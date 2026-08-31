import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import manifest from "../src/app/manifest";
import { alt as openGraphImageAlt } from "../src/app/opengraph-image";
import {
  localizeRuntimePublicJsonLd,
  runtimePublicT,
} from "../src/lib/i18n/runtime-public";
import { supportedLocales } from "../src/lib/i18nConfig";
import {
  getServiceSeo,
  homeSeo,
  publicServiceSlugs,
} from "../src/lib/seo";
import { servicesPageTitle } from "../src/lib/servicesPageMetadata";
import {
  buildPublicMetadataKeywords,
  businessAudienceTypeByLocale,
  embeddedWidgetBrowserRequirementJsonLd,
  javascriptBrowserRequirementJsonLd,
  organizationAreaServedJsonLd,
  publicBrandImageAlt,
  publicTechnicalCategory,
  publicTechnicalKeywords,
  relatedWorkshopResourcesName,
} from "../src/lib/structuredDataI18n";
import { workshopGuideArticles } from "../src/lib/workshopGuides";

function projectFile(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

test("canonical structured-data fragments are native or language-neutral in all locales", () => {
  for (const { code: locale } of supportedLocales) {
    const localizedCatalogTitle = runtimePublicT(
      locale,
      servicesPageTitle,
      ["core", "services", "service-intent"]
    );
    const localizedStageTitle = runtimePublicT(
      locale,
      "Stage 1 Tuning File Service for Workshops",
      ["core", "services", "service-intent"]
    );
    const localizedToolsBreadcrumb = runtimePublicT(
      locale,
      "Workshop tools",
      ["core", "tools"]
    );
    const output = localizeRuntimePublicJsonLd(
      {
        serviceType: servicesPageTitle,
        category: "Stage 1 Tuning File Service for Workshops",
        audience: {
          "@type": "Audience",
          audienceType: businessAudienceTypeByLocale[locale],
        },
        areaServed: organizationAreaServedJsonLd,
        browserRequirements: javascriptBrowserRequirementJsonLd,
        embeddedBrowserRequirements: embeddedWidgetBrowserRequirementJsonLd,
        breadcrumb: { name: "Workshop tools" },
      },
      locale,
      ["core", "services", "service-intent", "tools"]
    );

    assert.equal(output.serviceType, localizedCatalogTitle);
    assert.equal(output.category, localizedStageTitle);
    assert.equal(output.audience.audienceType, businessAudienceTypeByLocale[locale]);
    assert.deepEqual(output.areaServed, organizationAreaServedJsonLd);
    assert.equal(output.browserRequirements, "JavaScript");
    assert.equal(output.embeddedBrowserRequirements, "JavaScript; iframe");
    assert.equal(output.breadcrumb.name, localizedToolsBreadcrumb);

    if (locale !== "en") {
      assert.notEqual(output.serviceType, servicesPageTitle, locale);
      assert.notEqual(
        output.category,
        "Stage 1 Tuning File Service for Workshops",
        locale
      );
      assert.notEqual(
        output.audience.audienceType,
        businessAudienceTypeByLocale.en,
        locale
      );
      assert.notEqual(output.breadcrumb.name, "Workshop tools", locale);
    }
  }
});

test("dynamic workshop resource schema names preserve localized article titles", () => {
  for (const { code: locale } of supportedLocales) {
    for (const article of workshopGuideArticles) {
      const localizedShortTitle = runtimePublicT(
        locale,
        article.shortTitle,
        ["core", "workshop-guides"]
      );
      const name = relatedWorkshopResourcesName(locale, localizedShortTitle);

      assert.ok(name.includes(localizedShortTitle), `${locale}: ${article.slug}`);
      if (locale !== "en") {
        assert.doesNotMatch(name, /related workshop resources/iu);
        assert.notEqual(localizedShortTitle, article.shortTitle, `${locale}: ${article.slug}`);
      }
    }
  }
});

test("global metadata keywords combine neutral terms with locale-native service names", () => {
  const retiredEnglishKeywords = new Set([
    "ECU Tuning",
    "TCU Tuning",
    "DPF OFF",
    "EGR OFF",
    "AdBlue OFF",
    "File Service",
    "ECU File Service",
    "Online ECU File Service",
    "ECU File Service Germany",
    "TCU File Service",
    "ECU File Upload Service",
    "ECU Tuning File Service",
    "TCU Tuning File Service",
    "BMW Tuning",
    "Mercedes Tuning",
    "VAG Tuning",
  ]);

  for (const { code: locale } of supportedLocales) {
    const serviceNames = publicServiceSlugs.map(
      (slug) => getServiceSeo(slug, locale).name
    );
    const keywords = buildPublicMetadataKeywords(
      homeSeo[locale].title,
      serviceNames
    );

    assert.deepEqual(
      keywords.slice(0, publicTechnicalKeywords.length),
      [...publicTechnicalKeywords]
    );
    assert.ok(keywords.includes(homeSeo[locale].title));
    for (const serviceName of serviceNames) assert.ok(keywords.includes(serviceName));
    if (locale !== "en") {
      assert.equal(
        keywords.some((keyword) => retiredEnglishKeywords.has(keyword)),
        false,
        locale
      );
    }
  }
});

test("shared Open Graph and PWA surfaces contain language-neutral branding", () => {
  assert.equal(openGraphImageAlt, publicBrandImageAlt);
  assert.equal(openGraphImageAlt, "MG AutoTech · ECU · TCU");

  const webManifest = manifest();
  assert.equal(webManifest.name, "MG AutoTech");
  assert.equal(
    webManifest.description,
    "ECU · TCU · Stage 1 · DPF · EGR · AdBlue · DTC"
  );

  const imageSource = projectFile("src", "app", "opengraph-image.tsx");
  for (const source of [
    "Professional ECU & TCU tuning files.",
    "Secure upload",
    "Credit workflow",
    "Portal delivery",
  ]) {
    assert.equal(imageSource.includes(source), false, source);
  }
});

test("canonical routes consume the audited structured-data helpers", () => {
  const services = projectFile("src", "app", "services", "page.tsx");
  assert.match(services, /serviceType: pageTitle/u);
  assert.match(services, /areaServed: organizationAreaServedJsonLd/u);
  assert.doesNotMatch(services, /areaServed: \["Germany", "Europe"\]/u);

  const service = projectFile("src", "app", "services", "[slug]", "page.tsx");
  assert.match(service, /category: service\.title/u);
  assert.match(service, /audienceType: businessAudienceTypeByLocale\[locale\]/u);

  for (const route of [
    "ecu-read-method-advisor",
    "file-readiness-check",
    "request-brief-builder",
    "torque-power-calculator",
  ]) {
    const source = projectFile("src", "app", "tools", route, "page.tsx");
    assert.match(source, /browserRequirements: javascriptBrowserRequirementJsonLd/u);
    assert.match(source, /name: "Workshop tools"/u);
    assert.doesNotMatch(source, /browserRequirements: "Requires JavaScript"/u);
    assert.doesNotMatch(source, /name: "Tools"/u);
  }

  const widget = projectFile("src", "app", "widget", "page.tsx");
  assert.match(widget, /browserRequirements: embeddedWidgetBrowserRequirementJsonLd/u);
  assert.doesNotMatch(widget, /Modern browser with JavaScript and iframe support/u);

  const guide = projectFile(
    "src",
    "app",
    "workshop-guides",
    "[slug]",
    "page.tsx"
  );
  assert.match(guide, /relatedWorkshopResourcesName\(locale, localizedShortTitle\)/u);
  assert.doesNotMatch(guide, /related workshop resources/u);

  const layout = projectFile("src", "app", "layout.tsx");
  const homepageMetadata = projectFile("src", "lib", "homepageMetadata.ts");
  assert.match(homepageMetadata, /buildPublicMetadataKeywords/u);
  assert.match(homepageMetadata, /alt: copy\.title/u);
  assert.match(layout, /alt: publicBrandImageAlt/u);
  assert.match(layout, /category: publicTechnicalCategory/u);
  assert.equal(publicTechnicalCategory, "ECU/TCU");
});
