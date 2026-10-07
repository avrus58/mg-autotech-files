import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext, type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime.js";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime.js";
import RootServicePage, { generateMetadata as rootMetadata, generateStaticParams as rootParams } from "../src/app/services/[slug]/page";
import LocalizedServicePage, { generateMetadata as localeMetadata, generateStaticParams as localeParams } from "../src/app/[locale]/services/[slug]/page";
import sitemap from "../src/app/sitemap";
import { ServiceIntentPage, getServiceIntentGuideMetadata } from "../src/components/ServiceIntentPage";
import { publicCoreTranslations } from "../src/lib/i18n/public-core-translations";
import { publicServicesTranslations } from "../src/lib/i18n/public-services-translations";
import { publicSurfaceLocaleOrder } from "../src/lib/i18n/public-surface-types";
import { serviceIntentExactTranslations, serviceIntentLocaleOrder } from "../src/lib/i18n/service-intent-translations";
import { supportedLocales, intlLocaleByCode, openGraphLocaleByCode, type LocaleCode } from "../src/lib/i18nConfig";
import { localizeHomepageHref } from "../src/lib/homepageLocalization";
import { appendSafeQuery, getInitialLocaleRedirect, getLocalizedPublicHref, getLocalizedPublicPath, requiresServerLocaleRefresh } from "../src/lib/i18nRoutes";
import { buildNewRequestPath, getPublicServiceRequestIntent } from "../src/lib/requestIntent";
import { getServiceIntentGuide, serviceIntentGuides, serviceIntentGuideSlugs, type ServiceIntentGuide } from "../src/lib/serviceIntentGuides";
import { isServiceIntentGuideSlug } from "../src/lib/serviceIntentGuideRoutes";
import { organizationAreaServedJsonLd } from "../src/lib/structuredDataI18n";
import { absoluteUrl, hreflangByLocale, languageAlternates, localizedPath, localizedSeoLocales, localizedUrl, publicServiceSlugs } from "../src/lib/seo";

const reviewedGuideIds = ["stage-2", "stage-3", "tcu-tuning", "ecu-file-check"] as const;
const router: AppRouterInstance = {
  back: () => undefined, forward: () => undefined, refresh: () => undefined,
  push: () => undefined, replace: () => undefined, prefetch: () => undefined,
};
function escapeText(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
}
function scopedCopy(locale: LocaleCode, source: string) {
  if (locale === "en") return source;
  const catalogs = [
    [serviceIntentExactTranslations, serviceIntentLocaleOrder],
    [publicServicesTranslations, publicSurfaceLocaleOrder],
    [publicCoreTranslations, publicSurfaceLocaleOrder],
  ] as const;
  for (const [catalog, order] of catalogs) {
    const row = (catalog as Record<string, readonly string[]>)[source];
    if (!row) continue;
    assert.equal(row.length, 11, source);
    const translated = row[order.indexOf(locale)];
    assert.ok(translated?.trim(), `${locale}: empty scoped guide copy for ${source}`);
    if (translated !== source) return translated;
  }
  assert.fail(`${locale}: guide source has no actual scoped translation: ${source}`);
}
async function actualPage(guide: ServiceIntentGuide, locale: LocaleCode) {
  return (locale === "en"
    ? await RootServicePage({ params: Promise.resolve({ slug: guide.slug }) })
    : await LocalizedServicePage({ params: Promise.resolve({ locale, slug: guide.slug }) })) as ReactElement<{ guide: ServiceIntentGuide; locale: LocaleCode }>;
}
const rendered = Promise.all(supportedLocales.flatMap(({ code }) => serviceIntentGuides.map(async (guide) => {
  const page = await actualPage(guide, code);
  assert.equal(page.type, ServiceIntentPage);
  assert.deepEqual(page.props, { guide, locale: code });
  const html = renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router },
    createElement(PathnameContext.Provider, { value: localizedPath(code, `/services/${guide.slug}`) }, page)));
  return [`${code}:${guide.slug}`, html] as const;
}))).then((entries) => new Map(entries));
function graph(html: string) {
  const script = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/u);
  assert.ok(script, "actual guide Page must emit structured data on first paint");
  return (JSON.parse(script[1]) as { "@graph": Array<Record<string, unknown>> })["@graph"];
}

test("the four-guide route registry is exact while all reviewed raw facts, dates and ordering remain frozen", () => {
  assert.deepEqual(serviceIntentGuideSlugs, reviewedGuideIds);
  assert.deepEqual(serviceIntentGuides.map(({ slug }) => slug), reviewedGuideIds);
  // Independent digest observed before the routing package at immutable 98a3f6b.
  assert.equal(createHash("sha256").update(JSON.stringify(serviceIntentGuides)).digest("hex"), "8447a2435d5f95c60d4b337885f7f6e470c5f665cc39da5a47ead3a6673df50c");
  for (const id of reviewedGuideIds) assert.equal(isServiceIntentGuideSlug(id), true);
  for (const invalid of ["stage-1", "stage-4", "Stage-2", "stage-2/extra", "%73tage-2", "", "tcu", "ecu-file-check?ref=x"]) {
    assert.equal(isServiceIntentGuideSlug(invalid), false, invalid);
    if (invalid !== "stage-1") assert.equal(getServiceIntentGuide(invalid), null, invalid);
  }
});

test("all 48 guide destinations preserve equivalent paths, query and fragments without manufacturing invalid routes", () => {
  for (const { code } of supportedLocales) {
    for (const slug of reviewedGuideIds) {
      const path = `/services/${slug}`;
      const target = localizedPath(code, path);
      for (const from of [path, `/de${path}`, `/tr${path}`]) {
        assert.equal(getLocalizedPublicPath(from, code), target);
        assert.equal(getLocalizedPublicHref(`${from}?ref=related&service=stage_2#requirements`, code), `${target}?ref=related&service=stage_2#requirements`);
      }
      assert.equal(getInitialLocaleRedirect(path, code), code === "en" ? null : target);
      assert.equal(getInitialLocaleRedirect(`/de${path}`, code), null, "an explicit locale cannot be overridden by preference");
      assert.equal(requiresServerLocaleRefresh(path, "en", code), false, "guide changes navigate to genuine locale URLs rather than prefixless reloads");
      const sanitized = appendSafeQuery(target, "?ref=guide&GCLID=private&wbraid=private&_gl=private");
      assert.equal(sanitized, `${target}?ref=guide`, "existing paid-click privacy interception contract remains exact");
    }
  }
  for (const path of ["/services/stage-4", "/services/stage-2/extra", "/services/Stage-2", "/services/%73tage-2", "/services/tcu-tuning/extra"]) {
    assert.equal(getLocalizedPublicPath(path, "de"), path, path);
    assert.equal(getInitialLocaleRedirect(path, "de"), null, path);
  }
  for (const path of ["/tools/request-brief-builder", "/services", "/brands/bmw", "/ecu-platforms/bosch-md1", "/dashboard/log-analysis", "/new-request?service=tcu_stage_1"]) {
    assert.equal(getLocalizedPublicHref(path, "zh"), path, path);
  }
});

test("actual route static params add only four guide families without displacing any core-service variant", async () => {
  const slugs = [...publicServiceSlugs, ...reviewedGuideIds];
  assert.deepEqual(rootParams(), slugs.map((slug) => ({ slug })));
  assert.deepEqual(localeParams(), localizedSeoLocales.flatMap((locale) => slugs.map((slug) => ({ locale, slug }))));
  assert.equal(rootParams().length, 9);
  assert.equal(localeParams().length, 99);
  for (const guide of serviceIntentGuides) {
    const page = await actualPage(guide, "en");
    assert.equal(page.props.locale, "en");
  }
  for (const invalid of ["invalid", "stage-4", "Stage-2", "stage-2/extra", "%73tage-2"]) {
    assert.deepEqual(await rootMetadata({ params: Promise.resolve({ slug: invalid }) }), {});
    assert.deepEqual(await localeMetadata({ params: Promise.resolve({ locale: "de", slug: invalid }) }), {});
    await assert.rejects(RootServicePage({ params: Promise.resolve({ slug: invalid }) }), /NEXT_HTTP_ERROR_FALLBACK;404/u);
    await assert.rejects(LocalizedServicePage({ params: Promise.resolve({ locale: "de", slug: invalid }) }), /NEXT_HTTP_ERROR_FALLBACK;404/u);
  }
  for (const locale of ["invalid", "de-DE", "DE", "zz"]) {
    assert.deepEqual(await localeMetadata({ params: Promise.resolve({ locale, slug: "stage-2" }) }), {});
    await assert.rejects(LocalizedServicePage({ params: Promise.resolve({ locale, slug: "stage-2" }) }), /NEXT_HTTP_ERROR_FALLBACK;404/u);
  }
  for (const file of ["src/app/services/[slug]/page.tsx", "src/app/[locale]/services/[slug]/page.tsx"]) {
    assert.doesNotMatch(readFileSync(file, "utf8"), /getServerLocale|next\/headers/u, "explicit guide route metadata/body must not depend on a contradictory cookie or browser locale");
  }
});

test("all 48 actual guide renders retain complete translated headings, workshop evidence and review-led workflow", async () => {
  const pages = await rendered;
  assert.equal(pages.size, 48);
  for (const { code } of supportedLocales) {
    for (const guide of serviceIntentGuides) {
      const html = pages.get(`${code}:${guide.slug}`)!;
      const body = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gu, "");
      const heading = body.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/u);
      assert.equal(heading?.[1], escapeText(scopedCopy(code, guide.heroTitle)), `${code}:${guide.slug}: actual visible hero`);
      assert.ok(html.includes(`data-server-document-language="${hreflangByLocale[code]}"`));
      const sources = [guide.name, guide.eyebrow, guide.lead, ...guide.fitSignals, ...guide.requiredInputs,
        ...guide.reviewChecks.flatMap(({ title, text }) => [title, text]),
        ...guide.workflow.flatMap(({ title, text }) => [title, text]),
        ...guide.faq.flatMap(({ q, a }) => [q, a]), ...guide.related.map(({ label }) => label)];
      for (const source of sources) assert.ok(body.includes(escapeText(scopedCopy(code, source))), `${code}:${guide.slug}: omitted visible body source ${source}`);
      assert.equal(guide.requiredInputs.length, 6);
      assert.equal(guide.reviewChecks.length, 3);
      assert.equal(guide.workflow.length, 4);
      for (const source of ["Review-first boundary", "Compatibility is confirmed per request.", "This public page does not inspect, upload, modify or approve a controller file. Exact support depends on the submitted identity, source file and workshop context.", "Public guidance only; secure handling remains account-based."]) {
        assert.ok(body.includes(escapeText(scopedCopy(code, source))), `${code}:${guide.slug}: reviewed boundary remains visible`);
      }
      assert.doesNotMatch(body, /<form\b|<input\b[^>]*type="file"/u, "public locale route is not a new upload or approval capability");
    }
  }
});

test("actual guide FAQ disclosures and requirements are consistent with their translated schema", async () => {
  const pages = await rendered;
  for (const { code } of supportedLocales) {
    for (const guide of serviceIntentGuides) {
      const html = pages.get(`${code}:${guide.slug}`)!;
      const nodes = graph(html);
      const faq = nodes.find((entry) => entry["@type"] === "FAQPage")!;
      assert.equal(faq.inLanguage, intlLocaleByCode[code]);
      assert.deepEqual(faq.mainEntity, guide.faq.map(({ q, a }) => ({ "@type": "Question", name: scopedCopy(code, q), acceptedAnswer: { "@type": "Answer", text: scopedCopy(code, a) } })));
      const details = [...html.matchAll(/<details\b([^>]*)>([\s\S]*?)<\/details>/gu)];
      assert.equal(details.length, guide.faq.length);
      details.forEach((match, index) => {
        assert.ok(match[2].includes(escapeText(scopedCopy(code, guide.faq[index].q))));
        assert.ok(match[2].includes(escapeText(scopedCopy(code, guide.faq[index].a))));
        assert.equal(match[1].includes('open=""'), index === 0);
        assert.ok(match[2].includes("<summary"));
        assert.doesNotMatch(match[2], /role="button"/u, "native keyboard disclosure semantics remain intact");
      });
      const requirements = nodes.find((entry) => entry["@type"] === "ItemList")!;
      assert.deepEqual(requirements.itemListElement, guide.requiredInputs.map((input, index) => ({ "@type": "ListItem", position: index + 1, name: scopedCopy(code, input) })));
    }
  }
});

test("all 48 actual guide schemas use reviewed native requirement labels and workshop audience wording", async () => {
  // Independent literals from the existing reviewed catalogs. Catalog lookup
  // alone previously missed an unmatched interpolated requirements label and
  // the English BusinessAudience prose in otherwise translated guide schemas.
  const labels: Record<LocaleCode, { requirements: string; audience: string }> = {
    en: { requirements: "Required request context", audience: "Automotive workshops and tuning professionals" },
    de: { requirements: "Erforderlicher Anfragekontext", audience: "Kfz-Werkstätten und professionelle Tuner" },
    tr: { requirements: "Gerekli talep bağlamı", audience: "Otomotiv servisleri ve profesyonel tuning uzmanları" },
    nl: { requirements: "Vereiste aanvraagcontext", audience: "Autowerkplaatsen en professionele tuners" },
    fr: { requirements: "Contexte requis pour la demande", audience: "Ateliers automobiles et préparateurs professionnels" },
    it: { requirements: "Contesto richiesto per la richiesta", audience: "Officine automobilistiche e preparatori professionisti" },
    es: { requirements: "Contexto necesario de la solicitud", audience: "Talleres de automoción y preparadores profesionales" },
    pt: { requirements: "Contexto necessário do pedido", audience: "Oficinas automóveis e preparadores profissionais" },
    pl: { requirements: "Wymagany kontekst zlecenia", audience: "Warsztaty samochodowe i profesjonalni tunerzy" },
    ru: { requirements: "Необходимый контекст запроса", audience: "Автомобильные мастерские и профессиональные тюнеры" },
    zh: { requirements: "请求所需信息", audience: "汽车维修厂和专业调校技师" },
    sq: { requirements: "Konteksti i kërkuar i kërkesës", audience: "Servise automobilistike dhe specialistë të tunimit" },
  };
  const pages = await rendered;
  for (const { code } of supportedLocales) {
    for (const guide of serviceIntentGuides) {
      const nodes = graph(pages.get(`${code}:${guide.slug}`)!);
      const requirements = nodes.find((entry) => entry["@type"] === "ItemList")!;
      assert.equal(requirements.name, labels[code].requirements, `${code}:${guide.slug}: native schema requirements label`);
      const service = nodes.find((entry) => entry["@type"] === "Service")!;
      assert.deepEqual(service.audience, { "@type": "BusinessAudience", audienceType: labels[code].audience }, `${code}:${guide.slug}: native workshop audience`);
      if (code !== "en") {
        assert.notEqual(requirements.name, labels.en.requirements);
        assert.notEqual((service.audience as Record<string, unknown>).audienceType, labels.en.audience);
        assert.doesNotMatch(String(requirements.name), /request requirements/u);
      }
    }
  }
});

test("all 48 actual guide Service schemas retain audited language-neutral DE, EU and Europe area identifiers", async () => {
  // Preserve the audited geographical scope without translatable country-name
  // prose or an additional service-coverage claim in any locale variant.
  const areaServed = [
    { "@type": "Country", identifier: "DE" },
    { "@type": "AdministrativeArea", identifier: "EU" },
    { "@type": "Place", identifier: { "@type": "PropertyValue", propertyID: "UN M49", value: "150" } },
  ];
  assert.deepEqual(organizationAreaServedJsonLd, areaServed, "existing audited shared helper retains its exact language-neutral scope");
  const pages = await rendered;
  for (const { code } of supportedLocales) {
    for (const guide of serviceIntentGuides) {
      const service = graph(pages.get(`${code}:${guide.slug}`)!).find((entry) => entry["@type"] === "Service")!;
      assert.deepEqual(service.areaServed, organizationAreaServedJsonLd, `${code}:${guide.slug}: actual Service must use the audited organization area projection`);
      assert.deepEqual(service.areaServed, areaServed, `${code}:${guide.slug}: exact DE / EU / UN M49 150 identifiers`);
      assert.doesNotMatch(JSON.stringify(service.areaServed), /\b(?:Germany|Europe)\b/u, `${code}:${guide.slug}: no plain English country or region name`);
    }
  }
});

test("Chinese file-check guidance retains the source's review boundary without inventing an automatic system actor", async () => {
  const source = "Vehicle, controller, HW/SW and file context are checked for conflicts instead of relying on the filename.";
  const native = "会检查车辆、控制器、HW/SW 和文件背景是否存在冲突，而不是依赖文件名。";
  assert.equal(getServiceIntentGuide("ecu-file-check")!.reviewChecks[0].text, source);
  assert.equal(scopedCopy("zh", source), native);
  const body = (await rendered).get("zh:ecu-file-check")!.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gu, "");
  assert.ok(body.includes(native));
  assert.ok(!body.includes("系统会检查车辆"));
});

test("actual route metadata and graph identities use matching locale canonicals and reciprocal alternates", async () => {
  const pages = await rendered;
  for (const { code } of supportedLocales) {
    for (const guide of serviceIntentGuides) {
      const path = `/services/${guide.slug}`;
      const url = localizedUrl(code, path);
      const metadata = code === "en"
        ? await rootMetadata({ params: Promise.resolve({ slug: guide.slug }) })
        : await localeMetadata({ params: Promise.resolve({ locale: code, slug: guide.slug }) });
      assert.deepEqual(metadata, getServiceIntentGuideMetadata(guide, code));
      assert.equal(metadata.title, scopedCopy(code, guide.metaTitle));
      assert.equal(metadata.description, scopedCopy(code, guide.description));
      assert.equal(metadata.alternates?.canonical, url);
      assert.deepEqual(metadata.alternates?.languages, languageAlternates(path));
      assert.equal(Object.keys(metadata.alternates!.languages!).length, 13, "twelve true locales plus default");
      assert.equal(metadata.openGraph?.url, url);
      assert.equal(metadata.openGraph?.locale, openGraphLocaleByCode[code]);
      assert.deepEqual(metadata.openGraph?.alternateLocale, supportedLocales.filter(({ code: other }) => other !== code).map(({ code: other }) => openGraphLocaleByCode[other]));
      assert.equal(metadata.openGraph?.title, `${scopedCopy(code, guide.metaTitle)} | MG AutoTech`);
      assert.deepEqual(metadata.openGraph?.images, [{ url: absoluteUrl("/opengraph-image"), width: 1200, height: 630, alt: scopedCopy(code, guide.metaTitle) }]);
      const nodes = graph(pages.get(`${code}:${guide.slug}`)!);
      for (const [kind, suffix] of [["WebPage", "page"], ["Service", "service"], ["BreadcrumbList", "breadcrumb"], ["ItemList", "requirements"], ["FAQPage", "faq"]]) {
        const matches = nodes.filter((entry) => entry["@type"] === kind);
        assert.equal(matches.length, 1, `${code}:${guide.slug}: unique ${kind}`);
        assert.equal(matches[0]["@id"], `${url}#${suffix}`);
      }
      const webpage = nodes.find((entry) => entry["@type"] === "WebPage")!;
      assert.equal(webpage.url, url);
      assert.equal(webpage.inLanguage, intlLocaleByCode[code]);
      assert.equal(webpage.name, metadata.title);
      assert.equal(webpage.description, metadata.description);
      assert.equal(webpage.datePublished, guide.publishedAt);
      assert.equal(webpage.dateModified, guide.updatedAt);
      assert.deepEqual(webpage.about, { "@id": `${url}#service` });
      assert.deepEqual(webpage.breadcrumb, { "@id": `${url}#breadcrumb` });
      assert.deepEqual(webpage.isPartOf, { "@id": `${absoluteUrl("/services")}#page` }, "single canonical services hub must not acquire an imaginary locale route");
      const service = nodes.find((entry) => entry["@type"] === "Service")!;
      assert.equal(service.url, url);
      assert.equal(service.name, scopedCopy(code, guide.name));
      assert.equal(service.description, metadata.description);
      assert.deepEqual(service.provider, { "@id": `${absoluteUrl("/")}#organization` });
      assert.deepEqual(service.mainEntityOfPage, { "@id": `${url}#page` });
      const breadcrumb = nodes.find((entry) => entry["@type"] === "BreadcrumbList")!;
      assert.deepEqual((breadcrumb.itemListElement as Array<Record<string, unknown>>).map(({ item }) => item), [localizedUrl(code), localizedUrl(code, "/file-service"), url]);
      assert.deepEqual((breadcrumb.itemListElement as Array<Record<string, unknown>>).map(({ name }) => name), [scopedCopy(code, "Home"), scopedCopy(code, "ECU File Service"), scopedCopy(code, guide.name)]);
    }
  }
});

test("actual translated controls keep exact private service intent and only localize genuine related public routes", async () => {
  const pages = await rendered;
  const intents = { "stage-2": "stage_2", "stage-3": "stage_3", "tcu-tuning": "tcu_stage_1", "ecu-file-check": "file_check" } as const;
  for (const { code } of supportedLocales) {
    for (const guide of serviceIntentGuides) {
      const html = pages.get(`${code}:${guide.slug}`)!;
      const hrefs = [...html.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gu)];
      assert.equal(getPublicServiceRequestIntent(guide.slug), intents[guide.slug]);
      const request = buildNewRequestPath(intents[guide.slug]);
      const primary = hrefs.filter((match) => match[1] === escapeText(request));
      assert.equal(primary.length, 1, `${code}:${guide.slug}: one actual service-specific request control`);
      assert.ok(primary[0][2].includes(escapeText(scopedCopy(code, "Create file request"))));
      for (const related of guide.related) {
        const target = getLocalizedPublicHref(related.href, code);
        assert.ok(hrefs.some((match) => match[1] === target && match[2].includes(escapeText(scopedCopy(code, related.label)))), `${code}:${guide.slug}: visible related route ${related.href}`);
      }
      if (guide.slug === "stage-2" || guide.slug === "stage-3") {
        assert.ok(html.includes('id="stage-comparison"'));
        for (const slug of ["stage-1", "stage-2", "stage-3"]) assert.ok(hrefs.some((match) => match[1] === localizedPath(code, `/services/${slug}`)), `${code}:${guide.slug}: comparison route ${slug}`);
      } else assert.ok(!html.includes('id="stage-comparison"'));
      assert.ok(hrefs.some((match) => match[1] === "/services"));
      assert.ok(hrefs.some((match) => match[1] === "/about"));
      assert.ok(hrefs.some((match) => match[1] === localizedPath(code)));
      assert.doesNotMatch(html, /href="\/(?:de|tr|zh)\/(?:new-request|dashboard|tools|about|services)\/?(?:\?|"$)/u);
    }
  }
});

test("sitemap exposes exactly 48 unique genuine guide URLs with reciprocal twelve-locale discovery", () => {
  const entries = sitemap();
  const expected = serviceIntentGuides.flatMap((guide) => supportedLocales.map(({ code }) => localizedUrl(code, `/services/${guide.slug}`)));
  const guideEntries = entries.filter((entry) => reviewedGuideIds.some((slug) => new URL(entry.url).pathname.endsWith(`/services/${slug}`)));
  assert.equal(guideEntries.length, 48);
  assert.deepEqual(guideEntries.map(({ url }) => url).sort(), expected.sort());
  assert.equal(new Set(guideEntries.map(({ url }) => url)).size, 48);
  for (const guide of serviceIntentGuides) {
    const path = `/services/${guide.slug}`;
    for (const { code } of supportedLocales) {
      const entry = guideEntries.find(({ url }) => url === localizedUrl(code, path))!;
      assert.deepEqual(entry.alternates?.languages, languageAlternates(path));
      assert.equal(entry.lastModified?.valueOf(), new Date(guide.updatedAt).valueOf());
      for (const href of Object.values(entry.alternates!.languages!)) assert.ok(expected.includes(href), `alternate ${href} must be a genuinely rendered guide variant`);
    }
  }
  assert.ok(!entries.some(({ url }) => /\/(?:admin|dashboard|new-request|api)(?:\/|$)/u.test(new URL(url).pathname)));
});

test("all 48 actual guide footers link to the four genuine matching locale guides without stale English destinations", async () => {
  const pages = await rendered;
  for (const { code } of supportedLocales) {
    for (const guide of serviceIntentGuides) {
      const html = pages.get(`${code}:${guide.slug}`)!;
      const footer = html.match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/u);
      assert.ok(footer, `${code}:${guide.slug}: actual shared Footer must be rendered`);
      const hrefs = [...footer[1].matchAll(/<a\b[^>]*href="([^"]*)"/gu)].map((match) => match[1]);
      for (const slug of reviewedGuideIds) {
        const path = `/services/${slug}`;
        assert.equal(hrefs.filter((href) => href === localizedPath(code, path)).length, 1, `${code}:${guide.slug}: exact footer guide destination ${slug}`);
        if (code !== "en") assert.ok(!hrefs.includes(path), `${code}:${guide.slug}: footer ${slug} cannot silently return to English root`);
      }
      for (const slug of publicServiceSlugs) assert.ok(hrefs.includes(localizedPath(code, `/services/${slug}`)), `${code}:${guide.slug}: existing core-service footer destination ${slug}`);
      for (const path of ["/services", "/about", "/dashboard", "/tools"]) assert.ok(hrefs.includes(path), `${code}:${guide.slug}: single/private footer route ${path} remains unchanged`);
    }
  }
});

test("homepage/footer guide href localization adds only four exact reviewed families and preserves suffixes and existing route behavior", () => {
  for (const { code } of supportedLocales) {
    for (const slug of [...publicServiceSlugs, ...reviewedGuideIds]) {
      for (const pathname of [`/services/${slug}`, `/services/${slug}/`]) {
        const suffix = "?ref=footer&mode=review#requirements";
        assert.equal(localizeHomepageHref(`${pathname}${suffix}`, code), `${code === "en" ? "" : `/${code}`}${pathname}${suffix}`, `${code}:${pathname}: exact query and fragment preserved`);
      }
    }
    for (const path of ["/services", "/services/stage-4", "/services/Stage-2", "/services/%73tage-2", "/services/stage-2/extra", "/services/tcu-tuning/extra", "/de/services/stage-2", "/dashboard/log-analysis", "/new-request?service=tcu_stage_1#upload", "/admin", "/api/vehicles", "/tools/request-brief-builder", "/brands/bmw", "/about", "https://example.invalid/services/stage-2", "//example.invalid/services/stage-2"]) {
      assert.equal(localizeHomepageHref(path, code), path, `${code}:${path}: unsupported, private, single-path or external route remains unchanged`);
    }
    assert.equal(localizeHomepageHref("/?ref=footer#prices", code), `${code === "en" ? "/" : `/${code}`}?ref=footer#prices`);
    for (const path of ["/file-service", "/how-it-works"]) assert.equal(localizeHomepageHref(`${path}?ref=footer#workflow`, code), `${code === "en" ? "" : `/${code}`}${path}?ref=footer#workflow`);
  }
});

test("client-shared navigation imports only the tiny reviewed guide registry, never the rich guide copy graph", () => {
  const root = process.cwd();
  const seen = new Set<string>();
  function collect(file: string, visited = seen) {
    const absolute = resolve(root, file);
    if (visited.has(absolute)) return;
    visited.add(absolute);
    const source = readFileSync(absolute, "utf8");
    for (const match of source.matchAll(/(?:import|export)\s[\s\S]*?\sfrom\s+["']([^"']+)["']/gu)) {
      const name = match[1];
      if (!name.startsWith("@/") && !name.startsWith(".")) continue;
      const base = name.startsWith("@/") ? resolve(root, "src", name.slice(2)) : resolve(dirname(absolute), name);
      const next = [base, `${base}.ts`, `${base}.tsx`, resolve(base, "index.ts"), resolve(base, "index.tsx")].find((candidate) => existsSync(candidate) && /\.[jt]sx?$/u.test(candidate));
      assert.ok(next, `unresolved navigation dependency: ${name}`);
      collect(next, visited);
    }
  }
  collect("src/lib/i18nRoutes.ts");
  assert.ok(seen.has(resolve(root, "src/lib/serviceIntentGuideRoutes.ts")), "actual navigation must use the small guide eligibility registry");
  const homepageSeen = new Set<string>();
  collect("src/lib/homepageLocalization.tsx", homepageSeen);
  assert.ok(homepageSeen.has(resolve(root, "src/lib/serviceIntentGuideRoutes.ts")), "actual homepage/footer navigation must use the tiny registry independently of the generic route helper");
  for (const file of new Set([...seen, ...homepageSeen])) assert.doesNotMatch(file.replaceAll("\\", "/"), /\/(?:serviceIntentGuides|publicCoreServices|publicCoreServiceSeo|service-intent-translations|public-services-translations|runtime-public)\.[jt]sx?$/u, "route eligibility cannot drag rich catalogs into compact client graphs");
  const registry = readFileSync("src/lib/serviceIntentGuideRoutes.ts", "utf8");
  assert.doesNotMatch(registry, /^import\s/mu);
  assert.doesNotMatch(registry, /description|heroTitle|fitSignals|requiredInputs|workflow|faq|publishedAt|metaTitle/u);
});
