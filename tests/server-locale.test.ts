import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime.js";
import { LanguageSwitcher } from "../src/components/LanguageSwitcher";
import { ServerLocaleBoundary } from "../src/components/ServerLocaleBoundary";
import { getServerLocale } from "../src/lib/serverLocale";
import { hreflangByLocale } from "../src/lib/seo";

const root = process.cwd();

test("requestless metadata evaluation falls back to canonical English", async () => {
  assert.equal(await getServerLocale(), "en");
});

test("proxy resolves locale before rendering and the root document consumes it", () => {
  const proxy = fs.readFileSync(path.join(root, "src", "proxy.ts"), "utf8");
  const fixedPresentationLocale = fs.readFileSync(
    path.join(root, "src", "lib", "fixedPresentationLocale.ts"),
    "utf8",
  );
  const layout = fs.readFileSync(path.join(root, "src", "app", "layout.tsx"), "utf8");
  const rootPage = fs.readFileSync(path.join(root, "src", "app", "page.tsx"), "utf8");
  const localeLayout = fs.readFileSync(
    path.join(root, "src", "app", "[locale]", "layout.tsx"),
    "utf8",
  );

  assert.match(proxy, /const pathLocale =/);
  assert.match(proxy, /getFixedPresentationLocale\(request\.nextUrl\.pathname\)/);
  assert.match(fixedPresentationLocale, /datenschutz: "de"/);
  assert.match(fixedPresentationLocale, /privacy: "en"/);
  assert.match(proxy, /pathLocale \?\?[\s\S]*authoredLocale \?\?/);
  assert.match(proxy, /requestHeaders\.set\("x-mg-locale", resolvedLocale\)/);
  assert.match(proxy, /getInitialLocaleRedirect\(/u);
  assert.match(proxy, /pathname !== "\/embed\/vehicle-selector"/u);
  assert.match(
    proxy,
    /response\.headers\.set\("Content-Language", intlLocaleByCode\[resolvedLocale\]\)/,
  );
  assert.doesNotMatch(layout, /from "next\/headers"/u);
  assert.doesNotMatch(layout, /await headers\(\)/u);
  assert.match(layout, /lang=\{hreflangByLocale\[defaultLocale\]\}/);
  assert.match(layout, /buildNeutralSiteIdentityJsonLd\(\)/);
  assert.match(layout, /<ActiveLocaleProvider initialLocale=\{defaultLocale\}>/);
  assert.match(rootPage, /metadata: Metadata = buildHomepageMetadata\(defaultLocale\)/u);
  assert.match(rootPage, /renderRootHomepage\(defaultLocale\)/u);
  assert.doesNotMatch(rootPage, /getServerLocale|headers\(/u);
  assert.match(localeLayout, /<ServerLocaleBoundary locale=\{locale\}>/u);
});

test("fixed and embedded presentation languages are assigned before their content", () => {
  const legalShell = fs.readFileSync(
    path.join(root, "src", "components", "legal", "LegalPageShell.tsx"),
    "utf8",
  );
  const embedPage = fs.readFileSync(
    path.join(root, "src", "app", "embed", "vehicle-selector", "page.tsx"),
    "utf8",
  );

  assert.match(legalShell, /data-fixed-document-language=\{documentLanguage\}/u);
  assert.match(legalShell, /document\.documentElement\.lang=/u);
  assert.ok(
    legalShell.indexOf("data-fixed-document-language") <
      legalShell.indexOf("data-no-translate"),
  );
  assert.match(embedPage, /data-widget-document-language=\{language\}/u);
  assert.match(embedPage, /document\.documentElement\.lang=/u);
  assert.match(embedPage, /document\.documentElement\.dir=/u);
  assert.ok(
    embedPage.indexOf("widgetDocumentLanguage(result.language)") <
      embedPage.indexOf("data-widget-embed", embedPage.indexOf("widgetDocumentLanguage(result.language)")),
  );
});

test("route locale boundary assigns document language before localized content", () => {
  const html = renderToStaticMarkup(
    createElement(
      ServerLocaleBoundary,
      {
        locale: "de",
      } as Parameters<typeof ServerLocaleBoundary>[0],
      createElement(
        "main",
        { "data-localized-content": "de" },
        "Inhalt",
      ),
    ),
  );

  const assignment = html.indexOf(
    `document.documentElement.lang=\"${hreflangByLocale.de}\"`,
  );
  const content = html.indexOf('data-localized-content="de"');
  assert.ok(assignment >= 0, "document language assignment is missing");
  assert.ok(content > assignment, "localized content rendered before language assignment");
});

test("widget sales route seeds its client copy from the resolved request locale", () => {
  const widgetPage = fs.readFileSync(
    path.join(root, "src", "app", "widget", "page.tsx"),
    "utf8",
  );

  assert.match(widgetPage, /const locale = await getServerLocale\(\)/u);
  assert.match(widgetPage, /<ServerLocaleBoundary locale=\{locale\}>/u);
  assert.ok(
    widgetPage.indexOf("<ServerLocaleBoundary") <
      widgetPage.indexOf("<WidgetSalesPageClient"),
    "widget copy rendered before its locale provider",
  );
});

test("global language selector has no English fallback before locale hydration", () => {
  const html = renderToStaticMarkup(
    createElement(
      PathnameContext.Provider,
      { value: "/de" },
      createElement(LanguageSwitcher),
    ),
  );

  assert.match(html, /data-language-switcher-pending/u);
  assert.doesNotMatch(html, /🇬🇧|>EN<|Change language|aria-label="Language"/u);
});

test("client locale consumers hydrate from the same server-resolved locale", () => {
  const activeLocale = fs.readFileSync(
    path.join(root, "src", "lib", "useActiveLocale.ts"),
    "utf8"
  );

  assert.match(activeLocale, /createContext<LocaleCode \| null>\(null\)/);
  assert.match(activeLocale, /createElement\([\s\S]*InitialLocaleContext\.Provider[\s\S]*value: initialLocale/);
  assert.match(
    activeLocale,
    /useSyncExternalStore\([\s\S]*subscribe,[\s\S]*readLocale,[\s\S]*\(\) => initialLocale \?\? defaultLocale/,
  );
  assert.match(activeLocale, /export function useInitialLocale\(\)/);
});

test("canonical homepage and root layout remain request-independent", () => {
  const layout = fs.readFileSync(path.join(root, "src", "app", "layout.tsx"), "utf8");
  const page = fs.readFileSync(path.join(root, "src", "app", "page.tsx"), "utf8");
  const serverBoundary = fs.readFileSync(
    path.join(root, "src", "components", "ServerLocaleBoundary.tsx"),
    "utf8",
  );
  const requestBoundary = fs.readFileSync(
    path.join(root, "src", "components", "RequestLocaleBoundary.tsx"),
    "utf8",
  );

  assert.match(page, /export const metadata: Metadata = buildHomepageMetadata\(defaultLocale\)/u);
  assert.doesNotMatch(page, /generateMetadata|getServerLocale|headers\(/u);
  assert.doesNotMatch(layout, /export async function generateMetadata/u);
  assert.doesNotMatch(layout, /headers\(\)/u);
  assert.doesNotMatch(serverBoundary, /getServerLocale|next\/headers/u);
  assert.match(requestBoundary, /getServerLocale\(\)/u);
});

test("canonical English pages stay static while proxy owns non-English redirects", () => {
  const proxy = fs.readFileSync(path.join(root, "src", "proxy.ts"), "utf8");
  assert.match(proxy, /getInitialLocaleRedirect\(/u);

  for (const route of ["file-service", "how-it-works"]) {
    const canonical = fs.readFileSync(
      path.join(root, "src", "app", route, "page.tsx"),
      "utf8",
    );
    const localized = fs.readFileSync(
      path.join(root, "src", "app", "[locale]", route, "page.tsx"),
      "utf8",
    );

    assert.match(canonical, /export default function/u);
    assert.doesNotMatch(
      canonical,
      /getServerLocale|searchParams|redirect\(/u,
    );

    assert.match(localized, /generateMetadata\(/u);
    assert.match(localized, /const copy = get(?:FileService|HowItWorks)Copy\(locale\)/u);
    assert.match(localized, /JsonLd\(locale, pageUrl\)/u);
    assert.match(localized, /organizationJsonLd\(locale\)/u);
    assert.match(localized, /websiteJsonLd\(locale\)/u);
  }
});
