import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement, type ComponentProps, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext, type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime.js";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime.js";
import RootServicePage, { generateMetadata as rootMetadata, generateStaticParams as rootParams } from "../src/app/services/[slug]/page";
import LocalizedServicePage, { generateMetadata as localeMetadata, generateStaticParams as localeParams } from "../src/app/[locale]/services/[slug]/page";
import { PublicCoreServiceExperience, getPublicCoreServiceMetadata } from "../src/components/PublicCoreServiceExperience";
import { ServiceIntentPage } from "../src/components/ServiceIntentPage";
import { stage1BrandRoutes, stage1PlatformRoutes } from "../src/components/Stage1Authority";
import { publicCoreServices, getPublicCoreService } from "../src/lib/publicCoreServices";
import { publicCoreTranslations } from "../src/lib/i18n/public-core-translations";
import { publicServicesTranslations } from "../src/lib/i18n/public-services-translations";
import { publicSurfaceLocaleOrder } from "../src/lib/i18n/public-surface-types";
import { supportedLocales, intlLocaleByCode, type LocaleCode } from "../src/lib/i18nConfig";
import { buildNewRequestPath, getPublicServiceRequestIntent } from "../src/lib/requestIntent";
import { buildAuthEntryPath } from "../src/lib/safeLocalRedirect";
import { getServiceIntentGuide, serviceIntentGuideSlugs } from "../src/lib/serviceIntentGuides";
import { absoluteUrl, hreflangByLocale, languageAlternates, localizedPath, localizedUrl, publicServiceSlugs, seoLabels } from "../src/lib/seo";
import { getServiceSeo, serviceJsonLd, serviceMeta } from "../src/lib/publicCoreServiceSeo";
import { ActiveLocaleProvider } from "../src/lib/useActiveLocale";

const router: AppRouterInstance = {
  back: () => undefined, forward: () => undefined, refresh: () => undefined,
  push: () => undefined, replace: () => undefined, prefetch: () => undefined,
};
function escapeText(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
}
function renderService(slug: (typeof publicServiceSlugs)[number], locale: LocaleCode) {
  return renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router },
    createElement(PathnameContext.Provider, { value: localizedPath(locale, `/services/${slug}`) },
      createElement(ActiveLocaleProvider, { initialLocale: locale } as ComponentProps<typeof ActiveLocaleProvider>,
        createElement(PublicCoreServiceExperience, { slug, locale })))));
}
const rendered = new Map(supportedLocales.flatMap(({ code }) => publicServiceSlugs.map((slug) => [`${code}:${slug}`, renderService(slug, code)] as const)));
function expectedCopy(locale: LocaleCode, source: string) {
  if (locale === "en") return source;
  const index = publicSurfaceLocaleOrder.indexOf(locale);
  const row = (publicServicesTranslations as Record<string, readonly string[]>)[source]
    ?? (publicCoreTranslations as Record<string, readonly string[]>)[source];
  // Exact raw vehicle/technical values are intentionally not translated.
  if (!row) {
    assert.ok(["BMW", "Mercedes-Benz", "Audi", "Volkswagen", "Porsche", "Opel", "Renault", "Peugeot", "BMW Diesel", "Mercedes CDI", "VAG TDI", "Opel Diesel", "Renault Diesel", "Peugeot HDI", "VW", "Skoda", "Seat", "Stage 1", "Stage 2", "Stage 3"].includes(source), `unclassified scoped source: ${source}`);
    return source;
  }
  assert.equal(row.length, 11, source);
  assert.ok(row[index]?.trim(), `${locale}: missing ${source}`);
  return row[index];
}
function graph(html: string) {
  const script = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/u);
  assert.ok(script, "actual shared renderer must emit JSON-LD on first paint");
  return (JSON.parse(script[1]) as { "@graph": Array<Record<string, unknown>> })["@graph"];
}

test("reviewed core-service facts are an exact extraction, not rewritten claims or prices", () => {
  // SHA of JSON.stringify(actual root services array) at immutable d8ce92a.
  // Independent literal preserves every fact, notice, array order and credit.
  assert.equal(createHash("sha256").update(JSON.stringify(publicCoreServices)).digest("hex"), "455d22133e9f27ae201d90bb272cf2936bb43a37388d7dd870a0161332556ed5");
  assert.deepEqual(publicCoreServices.map(({ slug }) => slug), publicServiceSlugs);
  assert.deepEqual(publicCoreServices.map(({ credits }) => credits), ["10 credits", "6 credits", "6 credits", "11 credits", "4 credits"]);
  assert.equal(getPublicCoreService("not-a-service"), undefined);
  const pureModel = readFileSync("src/lib/publicCoreServices.ts", "utf8");
  const seoSource = readFileSync("src/lib/seo.ts", "utf8");
  assert.doesNotMatch(pureModel, /^import\s/mu);
  assert.doesNotMatch(seoSource, /from ["'][^"']*runtime-public["']/u, "SEO cannot cycle back through runtime-public");
  assert.doesNotMatch(seoSource, /publicCoreServiceSeo|publicCoreServices|public-(?:core|services)-translations/u, "client-shared SEO must not import the full public-service copy graph");
  assert.doesNotMatch(seoSource, /(?:const|export const) (?:serviceTemplates|localizedServiceOperations)\b/u);
});

test("Stage 1 headline keeps the reviewed natural workshop wording on first paint", () => {
  // Freeze the visual-QA correction independently of catalog-derived assertions.
  const headlines: Record<LocaleCode, string> = {
    en: "Stage 1 Tuning File Service for Workshops",
    de: "Stage 1-Tuning-Dateiservice für Werkstätten",
    tr: "Oto servisleri için Stage 1 ECU dosya hizmeti",
    nl: "Stage 1-tuningbestandsservice voor werkplaatsen",
    fr: "Service de fichiers de reprogrammation Stage 1 pour ateliers",
    it: "Servizio di file di calibrazione Stage 1 per officine",
    es: "Servicio de archivos de reprogramación Stage 1 para talleres",
    pt: "Serviço de ficheiros de calibração Stage 1 para oficinas",
    pl: "Usługa plików kalibracyjnych Stage 1 dla warsztatów",
    ru: "Сервис файлов калибровки Stage 1 для автомастерских",
    zh: "面向维修厂的 Stage 1 调校文件服务",
    sq: "Shërbim skedarësh kalibrimi Stage 1 për servise",
  };
  for (const { code } of supportedLocales) {
    const headline = headlines[code];
    assert.equal(getServiceSeo("stage-1", code).title, headline);
    assert.ok(rendered.get(`${code}:stage-1`)!.includes(escapeText(headline)));
    assert.equal(getPublicCoreServiceMetadata("stage-1", code).title, headline);
  }
});

test("all 60 real service renders contain the complete reviewed translated body and compatible SEO projection", () => {
  assert.equal(rendered.size, 60);
  for (const { code: locale } of supportedLocales) {
    for (const raw of publicCoreServices) {
      const copy = getServiceSeo(raw.slug, locale);
      const html = rendered.get(`${locale}:${raw.slug}`)!;
      assert.equal(copy.slug, raw.slug);
      assert.equal(copy.credits, raw.credits.split(" ")[0]);
      assert.equal(serviceMeta[raw.slug].credits, copy.credits);
      assert.deepEqual(copy.required, copy.requiredInfo);
      assert.equal(copy.faq.length, raw.slug === "stage-1" ? 9 : 2);
      assert.equal(copy.process.length, raw.process.length);
      const pairs: Array<[string, string]> = [
        [raw.title, copy.title], [raw.description, copy.description], [raw.eyebrow, copy.eyebrow], [raw.hero, copy.hero], [raw.turnaround, copy.turnaround],
        ...raw.intro.map((source, index) => [source, copy.intro[index]] as [string, string]),
        ...raw.benefits.map((source, index) => [source, copy.benefits[index]] as [string, string]),
        ...raw.supported.map((source, index) => [source, copy.supported[index]] as [string, string]),
        ...raw.requiredInfo.map((source, index) => [source, copy.required[index]] as [string, string]),
        ...raw.process.flatMap((step, index) => [[step.title, copy.process[index].title], [step.text, copy.process[index].text]] as Array<[string, string]>),
        ...raw.faq.flatMap((item, index) => [[item.q, copy.faq[index].q], [item.a, copy.faq[index].a]] as Array<[string, string]>),
        ...(raw.notice ? [[raw.notice.title, copy.notice!.title], [raw.notice.text, copy.notice!.text]] as Array<[string, string]> : []),
      ];
      for (const [source, translated] of pairs) {
        assert.equal(translated, expectedCopy(locale, source), `${locale}:${raw.slug}: ${source}`);
        // Description is metadata/schema; every other field is also real HTML.
        if (source !== raw.description) assert.ok(html.includes(escapeText(translated)), `${locale}:${raw.slug}: first paint omitted ${source}`);
      }
      assert.equal(copy.notice?.kind, raw.notice?.kind);
      assert.ok(html.includes(`lang="${hreflangByLocale[locale]}"`));
      assert.ok(html.includes(`${new Intl.NumberFormat(intlLocaleByCode[locale]).format(Number(copy.credits))} ${escapeText(seoLabels[locale].credits)}`));
      assert.ok(!html.includes("30 minutes") && !html.includes("~30 min"), "competing generic timing promise cannot return");
    }
  }
});

test("actual FAQ schema and visible native details agree in every service and locale", () => {
  for (const { code: locale } of supportedLocales) {
    for (const slug of publicServiceSlugs) {
      const html = rendered.get(`${locale}:${slug}`)!;
      const copy = getServiceSeo(slug, locale);
      const faqSchema = graph(html).find((item) => item["@type"] === "FAQPage");
      assert.deepEqual(faqSchema?.mainEntity, copy.faq.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })));
      const details = [...html.matchAll(/<details\b([^>]*)>([\s\S]*?)<\/details>/gu)].filter((match) => match[2].includes("<p class=\"px-4 pb-4"));
      assert.equal(details.length, copy.faq.length);
      details.forEach((match, index) => {
        assert.ok(match[2].includes(escapeText(copy.faq[index].q)));
        assert.ok(match[2].includes(escapeText(copy.faq[index].a)));
        assert.equal(match[1].includes('open=""'), index === 0);
        assert.ok(match[2].includes("<summary"));
        assert.ok(!match[2].includes('role="button"'), "native disclosure cannot lose keyboard semantics");
      });
    }
  }
});

test("all metadata and actual structured data preserve canonical, languages, service audience and entity relationships", () => {
  for (const { code: locale } of supportedLocales) {
    for (const slug of publicServiceSlugs) {
      const path = `/services/${slug}`;
      const copy = getServiceSeo(slug, locale);
      const metadata = getPublicCoreServiceMetadata(slug, locale);
      const nodes = graph(rendered.get(`${locale}:${slug}`)!);
      assert.equal(metadata.title, copy.title);
      assert.equal(metadata.description, copy.description);
      assert.equal(metadata.alternates?.canonical, localizedUrl(locale, path));
      assert.deepEqual(metadata.alternates?.languages, languageAlternates(path));
      assert.equal(metadata.openGraph?.title, `${copy.title} | MG AutoTech`);
      assert.deepEqual(metadata.openGraph?.images, [{ url: absoluteUrl("/opengraph-image"), width: 1200, height: 630, alt: copy.title }]);
      const service = nodes.find((item) => item["@type"] === "Service")!;
      assert.deepEqual(service, { ...serviceJsonLd(slug, locale), "@id": `${localizedUrl(locale, path)}#service`, name: copy.title, serviceType: copy.title, category: copy.title });
      assert.equal(service.name, copy.title, "detail entity retains the reviewed full title, not the short navigation label");
      assert.equal(service.inLanguage, hreflangByLocale[locale]);
      assert.equal((service.audience as Record<string, unknown>)["@type"], "BusinessAudience");
      assert.deepEqual(service.provider, { "@id": `${absoluteUrl("/")}#organization` });
      assert.equal(service.url, localizedUrl(locale, path));
      assert.equal(service.mainEntityOfPage, localizedUrl(locale, path));
      const webpage = nodes.find((item) => item["@type"] === "WebPage")!;
      assert.deepEqual(webpage.mainEntity, { "@id": service["@id"] });
      assert.deepEqual(webpage.breadcrumb, { "@id": `${localizedUrl(locale, path)}#breadcrumb` });
      assert.equal(nodes.filter((item) => item["@type"] === "FAQPage").length, 1);
    }
  }
});

test("actual primary controls keep exact service intent, registration redirect, public Prices and four related services", () => {
  for (const { code: locale } of supportedLocales) {
    for (const slug of publicServiceSlugs) {
      const html = rendered.get(`${locale}:${slug}`)!;
      const request = buildNewRequestPath(getPublicServiceRequestIntent(slug));
      const register = buildAuthEntryPath("/register", request);
      const hrefs = [...html.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gu)];
      assert.equal(hrefs.filter((match) => match[1] === escapeText(request)).length, 2, `${locale}:${slug}: two primary service request controls`);
      assert.equal(hrefs.filter((match) => match[1] === escapeText(register)).length, 1);
      const pricePath = localizedPath(locale, "/").replace(/\/$/u, "") || "/";
      assert.ok(hrefs.some((match) => match[1] === `${pricePath}#prices` && match[2].includes(escapeText(seoLabels[locale].navPrices))), `${locale}:${slug}: visible public Prices link missing: ${JSON.stringify(hrefs.filter((match) => match[1].includes("prices")).map((match) => [match[1], match[2].replace(/<[^>]*>/gu, "")]))}`);
      for (const related of publicServiceSlugs.filter((item) => item !== slug)) {
        assert.ok(hrefs.some((match) => match[1] === localizedPath(locale, `/services/${related}`) && match[2].includes(escapeText(getServiceSeo(related, locale).name))));
      }
      for (const label of ["Credit price", "Delivery estimate", "File delivery", "Workflow", "What this service is for", "Professional file workflow", "Information needed", "Ready to submit?", "Common questions", "Create Customer Account", "Start Secure Request"]) {
        const translated = expectedCopy(locale, label);
        assert.ok(html.includes(escapeText(translated)), `${locale}:${slug}: UI label ${label} must be translated on first paint`);
        if (locale !== "en") assert.notEqual(translated, label);
      }
    }
  }
});

test("Stage 1 retains fit, comparison and all fifteen genuine crawlable technical guides in every locale", () => {
  for (const { code: locale } of supportedLocales) {
    const html = rendered.get(`${locale}:stage-1`)!;
    assert.ok(html.includes('id="stage-1-fit-heading"'));
    for (const title of ["Turbo petrol", "Turbo diesel", "Naturally aspirated", "Modified hardware", "Stage 1", "Stage 2", "Stage 3"]) assert.ok(html.includes(escapeText(expectedCopy(locale, title))));
    const terms = [...html.matchAll(/<dt\b[^>]*>([\s\S]*?)<\/dt>/gu)].map((match) => match[1]);
    for (const label of ["Typical hardware", "Calibration scope", "Supporting modifications", "Logging", "Intended customer", "Review", "Ordering"]) {
      assert.equal(terms.filter((term) => term === escapeText(expectedCopy(locale, label))).length, 3, `${locale}: all three comparison columns must translate ${label}`);
      if (locale !== "en") assert.ok(!terms.includes(escapeText(label)), `${locale}: comparison label leaked English: ${label}`);
    }
    assert.equal((html.match(/<details\b/gu) ?? []).length, 11);
    const itemList = graph(html).find((item) => item["@type"] === "ItemList")!;
    const routes = [...stage1BrandRoutes, ...stage1PlatformRoutes];
    assert.equal(routes.length, 15);
    assert.equal((itemList.itemListElement as unknown[]).length, 15);
    // Brand/ECU guides retain their existing single canonical URLs; locale is
    // handled on those runtime-localized surfaces, not by inventing prefixes.
    for (const route of routes) assert.ok(html.includes(`href="${route.href}"`), `${locale}: missing ${route.href}`);
  }
});

test("both routes use the actual shared experience while newer guide branches, static params and invalid paths retain their behavior", async () => {
  assert.equal(rootParams().length, 9);
  assert.equal(localeParams().length, 55);
  for (const slug of publicServiceSlugs) {
    const root = await RootServicePage({ params: Promise.resolve({ slug }) }) as ReactElement<{ slug: string; locale: string }>;
    assert.equal(root.type, PublicCoreServiceExperience);
    assert.deepEqual(root.props, { slug, locale: "en" });
    assert.deepEqual(await rootMetadata({ params: Promise.resolve({ slug }) }), getPublicCoreServiceMetadata(slug, "en"));
    for (const { code: locale } of supportedLocales) {
      const page = await LocalizedServicePage({ params: Promise.resolve({ locale, slug }) }) as ReactElement<{ slug: string; locale: string }>;
      assert.equal(page.type, PublicCoreServiceExperience);
      assert.deepEqual(page.props, { slug, locale });
      assert.deepEqual(await localeMetadata({ params: Promise.resolve({ locale, slug }) }), getPublicCoreServiceMetadata(slug, locale));
    }
  }
  for (const slug of serviceIntentGuideSlugs) {
    const page = await RootServicePage({ params: Promise.resolve({ slug }) }) as ReactElement;
    assert.equal(page.type, ServiceIntentPage);
    assert.equal((page.props as { guide: unknown }).guide, getServiceIntentGuide(slug));
    assert.equal((await rootMetadata({ params: Promise.resolve({ slug }) })).title, getServiceIntentGuide(slug)!.metaTitle);
  }
  assert.deepEqual(await rootMetadata({ params: Promise.resolve({ slug: "invalid" }) }), {});
  assert.deepEqual(await localeMetadata({ params: Promise.resolve({ locale: "invalid", slug: "stage-1" }) }), {});
  await assert.rejects(RootServicePage({ params: Promise.resolve({ slug: "invalid" }) }), /NEXT_HTTP_ERROR_FALLBACK;404/u);
  await assert.rejects(LocalizedServicePage({ params: Promise.resolve({ locale: "invalid", slug: "stage-1" }) }), /NEXT_HTTP_ERROR_FALLBACK;404/u);
});
