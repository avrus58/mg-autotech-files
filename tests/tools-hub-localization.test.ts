import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as jsxRuntime from "react/jsx-runtime";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Link from "next/link";
import { AppRouterContext, type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime.js";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime.js";
import * as icons from "lucide-react";
import { RuntimePublicLocalization } from "../src/components/RuntimePublicLocalization";
import { RuntimePublicFooter } from "../src/components/RuntimePublicFooter";
import { ToolsHeader } from "../src/components/tools/ToolsHeader";
import * as runtimePublic from "../src/lib/i18n/runtime-public";
import * as seo from "../src/lib/seo";
import { supportedLocales, intlLocaleByCode, type LocaleCode } from "../src/lib/i18nConfig";
import { publicToolsTranslations } from "../src/lib/i18n/public-tools-translations";
import { publicSurfaceLocaleOrder } from "../src/lib/i18n/public-surface-types";
import { exactTranslations } from "../src/lib/i18n";

type HubModule = {
  default: () => Promise<ReactElement>;
  generateMetadata: () => Promise<{ title: string; description: string; alternates: { canonical: string } }>;
};

function loadActualPage(locale: LocaleCode): HubModule {
  const source = readFileSync("src/app/tools/page.tsx", "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  const dependencies: Record<string, unknown> = {
    "react/jsx-runtime": jsxRuntime,
    "next/link": { default: Link },
    "lucide-react": icons,
    "@/components/RuntimePublicLocalization": { RuntimePublicLocalization },
    "@/components/RuntimePublicFooter": { RuntimePublicFooter },
    "@/components/tools/ToolsHeader": { ToolsHeader },
    "@/lib/i18n/runtime-public": runtimePublic,
    "@/lib/seo": seo,
    // Only the request preference is synthetic. Model, Page, Header, localization
    // walker, catalogs, metadata and schema are actual application code.
    "@/lib/serverLocale": { getServerLocale: async () => locale },
  };
  runInNewContext(code, {
    exports,
    require: (name: string) => {
      assert.ok(Object.hasOwn(dependencies, name), `unreviewed page dependency: ${name}`);
      return dependencies[name];
    },
  });
  return exports as HubModule;
}

const router: AppRouterInstance = {
  back: () => undefined, forward: () => undefined, refresh: () => undefined,
  push: () => undefined, replace: () => undefined, prefetch: () => undefined,
};
async function renderHub(locale: LocaleCode) {
  return renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router },
    createElement(PathnameContext.Provider, { value: "/tools" }, await loadActualPage(locale).default())));
}

function text(html: string) {
  return html.replace(/<[^>]*>/gu, "").replaceAll("&amp;", "&").replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'").replace(/\s+/gu, " ").trim();
}
function features(html: string) {
  const main = html.match(/<main>([\s\S]*?)<\/main>/u)?.[1];
  assert.ok(main, "actual hub main");
  return [...main.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gu)].map((match) => text(match[1]));
}
function scopedCopy(locale: LocaleCode, source: string) {
  if (locale === "en") return source;
  const row = publicToolsTranslations[source];
  assert.ok(row, `${locale}: missing tools-scoped row for ${source}`);
  assert.equal(row.length, 11, source);
  const value = row[publicSurfaceLocaleOrder.indexOf(locale)];
  assert.ok(value.trim(), source);
  assert.notEqual(value, source, `${locale}: English retained for ${source}`);
  return value;
}

test("actual Tools Page and shared Header render all fifteen feature bullets in all twelve runtime locales", async () => {
  const english = await renderHub("en");
  const sources = features(english);
  assert.equal(sources.length, 15);
  assert.equal(new Set(sources).size, 13);
  for (const { code } of supportedLocales) {
    const html = await renderHub(code);
    assert.deepEqual(features(html), sources.map((source) => scopedCopy(code, source)), code);
    assert.equal((html.match(/<article\b/gu) ?? []).length, 5, code);
    const header = renderToStaticMarkup(createElement(ToolsHeader, { locale: code }));
    assert.ok(header.includes(`>${scopedCopy(code, "Tools")}<`), code);
    assert.ok(header.includes('href="/tools"'), "stable runtime tool URL");
    if (code !== "en") assert.doesNotMatch(header, />Tools</u, code);
  }
});

test("the actual Page keeps all five tools and four workflow destinations, including the gated customer Studio", async () => {
  const html = await renderHub("en");
  const expected = ["/tools/file-readiness-check", "/tools/request-brief-builder", "/tools/ecu-read-method-advisor", "/tools/torque-power-calculator", "/dashboard/log-analysis"];
  const articleLinks = [...html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gu)]
    .map((match) => match[1].match(/<a\b[^>]*\bhref="([^"]+)"/u)?.[1]);
  assert.deepEqual(articleLinks, expected);
  for (const href of expected.slice(0, 3).concat("/new-request")) {
    assert.ok(html.includes(`href="${href}"`), href);
  }
  assert.equal((html.match(/>0[1-4]<\/span>/gu) ?? []).length, 4);
  assert.doesNotMatch(html, /<input[^>]*type="file"|<form\b/u);
});

test("actual tool metadata and CollectionPage/ItemList projection remain localized and canonical", async () => {
  for (const { code } of supportedLocales) {
    const page = loadActualPage(code);
    const metadata = await page.generateMetadata();
    const html = await renderHub(code);
    const graph = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/u)![1])["@graph"];
    assert.equal(metadata.alternates.canonical, seo.absoluteUrl("/tools"));
    assert.equal(metadata.title, scopedCopy(code, "Free ECU Workshop Tools"));
    const collection = graph.find((entry: Record<string, unknown>) => entry["@type"] === "CollectionPage");
    assert.equal(collection.inLanguage, intlLocaleByCode[code]);
    assert.equal(collection.url, seo.absoluteUrl("/tools"));
    const itemList = graph.find((entry: Record<string, unknown>) => entry["@type"] === "ItemList");
    assert.equal(itemList.itemListElement.length, 5);
    assert.equal(itemList.itemListElement[4].url, seo.absoluteUrl("/dashboard/log-analysis"));
    for (const item of itemList.itemListElement) assert.ok(html.includes(text(item.name)), item.name);
  }
});

test("a global customer Tools row cannot fill a missing public runtime Tools row", () => {
  assert.ok(exactTranslations.de.Tools, "legacy global-catalog alternative exists");
  const row = publicToolsTranslations.Tools;
  assert.ok(row);
  try {
    delete publicToolsTranslations.Tools;
    assert.equal(runtimePublic.runtimePublicT("de", "Tools", ["core", "tools"]), "Tools");
    const html = renderToStaticMarkup(createElement(ToolsHeader, { locale: "de" }));
    assert.match(html, />Tools</u, "real Header proves why global dictionaries are insufficient");
  } finally {
    publicToolsTranslations.Tools = row;
  }
});

test("native hub copy describes clear requests and ECU reading rather than cleaning or reading prose", async () => {
  const expected: Partial<Record<LocaleCode, string>> = {
    de: "Praktische ECU-Fileservice-Werkzeuge für verständlichere Anfragen.",
    tr: "Daha anlaşılır talepler için pratik ECU dosya hizmeti araçları.",
    fr: "Des outils pratiques de service de fichiers ECU pour des demandes plus claires.",
    zh: "实用的 ECU 文件服务工具，让服务请求更清晰。",
  };
  for (const [locale, headline] of Object.entries(expected)) {
    const html = await renderHub(locale as LocaleCode);
    const h1 = text(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/u)![1]);
    assert.equal(h1, headline, locale);
    assert.doesNotMatch(h1, /清洁|nettoyage|sauberere|temiz talepler/u);
  }
  const zh = features(await renderHub("zh"));
  assert.ok(zh.includes("ECU 读取检查清单"));
  assert.ok(zh.includes("输入 Nm + RPM"));
  assert.ok(zh.includes("输出 kW、HP 和 PS"));
  const zhMain = (await renderHub("zh")).match(/<main>([\s\S]*?)<\/main>/u)![1];
  assert.ok(zhMain.includes("规划读取方式"));
  assert.doesNotMatch(zhMain, /规划阅读方法/u);
});

test("both existing source collectors explicitly classify feature collections instead of hiding the runtime labels", () => {
  for (const file of ["tests/public-surface-i18n.test.ts", "scripts/check-customer-i18n.ts"]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /const visible(?:PropertyNames|CollectionProps) = new Set\(\[[\s\S]*?"features"/u, file);
  }
  assert.match(readFileSync("src/app/tools/page.tsx", "utf8"), /features: readonly ToolsHubFeatureSource\[\]/u);
});
