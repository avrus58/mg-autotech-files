import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AppRouterContext,
  type AppRouterInstance,
} from "next/dist/shared/lib/app-router-context.shared-runtime.js";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime.js";
import { buildHomepageTranslationCatalog } from "../src/lib/homepageTranslationCatalog";
import { localizeHomepageHref } from "../src/lib/homepageLocalization";
import { supportedLocales, type LocaleCode } from "../src/lib/i18nConfig";
import { renderRootHomepage } from "../src/lib/renderRootHomepage";
import { ActiveLocaleProvider } from "../src/lib/useActiveLocale";

const router: AppRouterInstance = {
  back: () => undefined,
  forward: () => undefined,
  refresh: () => undefined,
  push: () => undefined,
  replace: () => undefined,
  prefetch: () => undefined,
};

const previewCopy = [
  "Customer workspace",
  "Secure request workspace",
  "Example preview",
  "Example request",
  "Stage 1 Tuning",
  "Completed",
  "File uploaded",
  "File reviewed",
  "Ready for download",
  "Status & messages",
  "Your completed file is ready in your account.",
  "Completed file",
  "Account delivery",
  "Service report",
  "PDF after completion",
  "Illustrative preview. No customer data.",
  "How It Works",
] as const;

function escapeRenderedText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;");
}

function renderHomepage(locale: LocaleCode) {
  return renderToStaticMarkup(
    createElement(
      AppRouterContext.Provider,
      { value: router },
      createElement(
        PathnameContext.Provider,
        { value: "/" },
        createElement(
          ActiveLocaleProvider,
          { initialLocale: locale } as ComponentProps<typeof ActiveLocaleProvider>,
          renderRootHomepage(locale),
        ),
      ),
    ),
  );
}

const renderedHomepages = new Map(
  supportedLocales.map(({ code }) => [code, renderHomepage(code)]),
);

function extractPreview(html: string) {
  const match = html.match(/<aside\b[^>]*data-homepage-product-preview[^>]*>[\s\S]*?<\/aside>/u);
  assert.ok(match, "the actual homepage must render the product preview on first paint");
  return match[0];
}

test("the actual hero preview and its accessible example label render translated in all 12 locales", () => {
  assert.equal(renderedHomepages.size, supportedLocales.length);
  for (const { code } of supportedLocales) {
    const preview = extractPreview(renderedHomepages.get(code)!);
    const catalog = buildHomepageTranslationCatalog(code);
    for (const source of previewCopy) {
      const translated = code === "en" ? source : catalog?.exact[source];
      assert.ok(translated, `${code}: missing exact preview translation for ${source}`);
      assert.ok(preview.includes(escapeRenderedText(translated)), `${code}: first paint omitted ${source}`);
      if (code !== "en") {
        assert.notEqual(translated, source, `${code}: clean English fallback for ${source}`);
        assert.ok(!preview.includes(escapeRenderedText(source)), `${code}: preview leaked ${source}`);
      }
    }
    const exampleLabel = code === "en" ? "Example preview" : catalog!.exact["Example preview"];
    assert.ok(preview.includes(`aria-label="${escapeRenderedText(exampleLabel)}"`), `${code}: accessible label must match the translated example badge`);
    assert.equal((preview.match(/role="tablist"/gu) ?? []).length, 1, `${code}: one manual illustrative lifecycle`);
    assert.equal((preview.match(/role="tab"/gu) ?? []).length, 3, `${code}: upload, review and delivery remain explicit`);
  }
});

test("the illustrative preview has only manual example stages, no pretend file actions or private result data", () => {
  for (const { code } of supportedLocales) {
    const preview = extractPreview(renderedHomepages.get(code)!);
    const anchors = [...preview.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>/gu)];
    assert.equal(anchors.length, 1, `${code}: only the legitimate workflow link is interactive`);
    assert.equal(anchors[0][1], localizeHomepageHref("/how-it-works", code));
    const stageButtons = [...preview.matchAll(/<button\b[^>]*>/gu)];
    assert.equal(stageButtons.length, 3, `${code}: only the three illustrative stage controls are interactive`);
    for (const button of stageButtons) {
      assert.match(button[0], /type="button"/u);
      assert.match(button[0], /role="tab"/u);
      assert.match(button[0], /aria-controls="homepage-preview-panel"/u);
    }
    assert.doesNotMatch(preview, /<(?:form|input|iframe|script|object|embed)\b|\bdownload=|href="(?:blob:|data:)|aria-live=|role="(?:status|alert)"/u);
    assert.doesNotMatch(preview, /Portal online|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/iu);
    const visibleText = preview.replace(/<[^>]+>/gu, " ");
    assert.doesNotMatch(visibleText, /\b\d+(?:[.,]\d+)?\s*(?:HP|bhp|Nm|PS|kW|€|EUR|credits?)\b|\.(?:bin|ori|mod|pdf)\b/iu);
  }
  const source = readFileSync("src/components/homepage/HomepageExperience.tsx", "utf8");
  const previewSource = source.slice(source.indexOf("function HeroProductPreview()"), source.indexOf("function HeroProof("));
  assert.doesNotMatch(previewSource, /data-no-translate|dangerouslySetInnerHTML|\bfetch\(|authenticatedFetch|useEffect|setInterval|setTimeout|window\.|document\.|supabase|serviceReportT|ServiceReportDownload/u);
});

test("hero polish preserves request entry, tools, service routes, section order and structured data", () => {
  const sectionIds = ["vehicle-data", "tools", "services", "workflow", "security", "prices", "homepage-search-faq"];
  const serviceRoutes = ["stage-1", "dpf-off", "egr-off", "adblue-off", "dtc-off", "tcu-tuning"];
  for (const { code } of supportedLocales) {
    const html = renderedHomepages.get(code)!;
    assert.equal((html.match(/<h1\b/gu) ?? []).length, 1, `${code}: one page H1`);
    const hero = html.match(/<section\b[^>]*data-homepage-hero[^>]*>[\s\S]*?<\/section>/u)?.[0];
    assert.ok(hero, `${code}: actual hero missing`);
    assert.match(hero, /href="\/new-request"/u);
    assert.match(hero, /href="#vehicle-data"/u);
    assert.match(html, /data-homepage-mobile-account/u);
    let previous = html.indexOf("data-homepage-hero");
    for (const id of sectionIds) {
      assert.equal((html.match(new RegExp(`id="${id}"`, "gu")) ?? []).length, 1, `${code}: ${id} preserved exactly once`);
      const position = html.indexOf(`id="${id}"`);
      assert.ok(position > previous, `${code}: ${id} retains homepage feature order`);
      previous = position;
    }
    for (const slug of serviceRoutes) {
      const href = localizeHomepageHref(`/services/${slug}`, code);
      assert.ok(html.includes(`href="${href}"`), `${code}: service route ${slug} removed`);
    }
    assert.match(html, /<footer\b/u);
    const schemas = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gu)]
      .map((match) => JSON.parse(match[1]) as Record<string, unknown>);
    assert.equal(schemas.length, 5, `${code}: identity and homepage schema blocks preserved`);
    assert.deepEqual(schemas.slice(1).map((schema) => schema["@type"]), ["WebPage", "Service", "FAQPage", "HowTo"]);
    assert.ok(!JSON.stringify(schemas).includes("Illustrative preview. No customer data."), `${code}: example UI is not presented as real structured-data evidence`);
  }
});

test("compact hero keeps wrapping, usable focusable CTAs and mobile-safe illustrative preview structure", () => {
  const html = renderedHomepages.get("en")!;
  const hero = html.match(/<section\b[^>]*data-homepage-hero[^>]*>[\s\S]*?<\/section>/u)?.[0];
  assert.ok(hero);
  const heading = hero.match(/<h1\b[^>]*class="([^"]+)"/u)?.[1];
  assert.ok(heading);
  const clamp = heading.match(/text-\[clamp\(([\d.]+)rem,([\d.]+)vw,([\d.]+)rem\)\]/u);
  assert.ok(clamp, "hero uses bounded responsive typography");
  assert.ok(Number(clamp[3]) <= 4.4, "desktop hero cap must not return to the oversized 6.5rem title");
  assert.ok(Number(clamp[1]) >= 2.4, "compact mobile heading remains readable");
  assert.match(heading, /\[overflow-wrap:anywhere\]/u);
  assert.match(hero, /sm:flex-wrap/u);
  for (const destination of ["/new-request", "#vehicle-data"]) {
    const anchor = [...hero.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>/gu)].find((match) => match[1] === destination)?.[0];
    assert.ok(anchor, destination);
    assert.match(anchor, /min-h-11/u);
    assert.match(anchor, /focus-visible:ring-2/u);
  }
  const preview = extractPreview(html);
  assert.match(preview, /min-w-0/u);
  assert.match(preview.match(/<aside\b[^>]*>/u)?.[0] ?? "", /\[overflow-wrap:anywhere\]/u);
  assert.match(preview, /flex-wrap/u);
  assert.match(preview, /grid-cols-3/u);
  assert.match(preview, /sm:grid-cols-2/u);
  const workflowLink = [...preview.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>/gu)]
    .find((match) => match[1] === "/how-it-works")?.[0];
  assert.ok(workflowLink, "the real workflow link remains available");
  assert.match(workflowLink, /min-h-11/u);
  assert.match(workflowLink, /focus-visible:ring-2/u);
  for (const svg of preview.matchAll(/<svg\b[^>]*>/gu)) assert.match(svg[0], /aria-hidden="true"/u);
});
