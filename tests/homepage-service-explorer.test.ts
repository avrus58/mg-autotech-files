import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import * as icons from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AppRouterContext,
  type AppRouterInstance,
} from "next/dist/shared/lib/app-router-context.shared-runtime.js";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime.js";
import ts from "typescript";
import { buildHomepageTranslationCatalog } from "../src/lib/homepageTranslationCatalog";
import {
  HomepageLocalizationProvider,
  LocalizedHomepageTree,
  localizeHomepageHref,
  translateHomepageText,
} from "../src/lib/homepageLocalization";
import { intlLocaleByCode, supportedLocales, type LocaleCode } from "../src/lib/i18nConfig";
import { renderRootHomepage } from "../src/lib/renderRootHomepage";
import { europeRegionJsonLd } from "../src/lib/structuredDataI18n";
import { ActiveLocaleProvider } from "../src/lib/useActiveLocale";

const source = readFileSync("src/components/homepage/HomepageExperience.tsx", "utf8");
const ast = ts.createSourceFile("HomepageExperience.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const explorer = ast.statements.find(
  (statement): statement is ts.FunctionDeclaration => ts.isFunctionDeclaration(statement) && statement.name?.text === "HomepageServiceExplorer",
);
assert.ok(explorer, "exercise the real service explorer and handlers, not a duplicate selection model");
const constants = [
  "services", "serviceDiscoveryLinks", "serviceCategories", "workflowSteps", "faqs", "publicResourceUrl",
  "homepagePageJsonLd", "homepageFileServiceJsonLd", "homepageFaqJsonLd", "homepageRequestPreparationHowToJsonLd",
];
const declarations = ast.statements.filter((statement) =>
  (ts.isVariableStatement(statement) && statement.declarationList.declarations.some((declaration) =>
    ts.isIdentifier(declaration.name) && constants.includes(declaration.name.text),
  )) || (ts.isFunctionDeclaration(statement) && statement.name?.text === "buildHomepageStructuredData"),
);
assert.equal(declarations.length, constants.length + 1, "use all real catalog and structured-data declarations");
const compiled = ts.transpileModule(
  `${declarations.map((declaration) => declaration.getText(ast)).join("\n")}\n${explorer.getText(ast)}\nexports.HomepageServiceExplorer = HomepageServiceExplorer;\nexports.catalog = { services, serviceDiscoveryLinks, serviceCategories };`,
  { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } },
).outputText;

type Category = "all" | "performance" | "diesel" | "gearbox" | "diagnostic";
type ElementProps = Record<string, unknown> & { children?: React.ReactNode };
type ExplorerElement = React.ReactElement<ElementProps>;
type FilterProps = ElementProps & { "data-service-filter": Category; onClick(): void };
type Service = { title: string; text: string; credits: string; href: string; tag: string; category: Category };
type RelatedRoute = { label: string; href: string; category: Category };
type Catalog = { services: Service[]; serviceDiscoveryLinks: RelatedRoute[]; serviceCategories: Array<{ id: Category; label: string }> };

// Existing public facts are deliberate regression expectations, not a new
// catalog or eligibility model. Selection runs only in the real component.
const originalServices = [
  { title: "Stage 1", text: "Performance optimization for stock vehicles.", credits: "10 Credits", href: "/services/stage-1", tag: "Performance" },
  { title: "DPF OFF", text: "Technical software solution for diesel vehicles.", credits: "6 Credits", href: "/services/dpf-off", tag: "Diesel" },
  { title: "EGR / AGR OFF", text: "EGR related software solution and DTC support.", credits: "6 Credits", href: "/services/egr-off", tag: "Airflow" },
  { title: "AdBlue OFF", text: "SCR / AdBlue software solution for supported ECUs.", credits: "11 Credits", href: "/services/adblue-off", tag: "SCR" },
  { title: "DTC OFF", text: "Diagnostic trouble code removal by request.", credits: "4 Credits", href: "/services/dtc-off", tag: "Diagnostic" },
  { title: "TCU Tuning", text: "Gearbox software optimization for supported TCUs.", credits: "Manual", href: "/services/tcu-tuning", tag: "Gearbox" },
];
const originalRelatedRoutes = [
  { label: "Compare Stage 1–3", href: "/file-service#stage-comparison" },
  { label: "Stage 2 File Service", href: "/services/stage-2" },
  { label: "Stage 3 Custom Calibration", href: "/services/stage-3" },
  { label: "ECU File Check", href: "/services/ecu-file-check" },
  { label: "File Service Hub", href: "/file-service" },
];
const expectedFamilies: Record<Category, { services: string[]; related: string[] }> = {
  all: { services: originalServices.map(({ href }) => href), related: originalRelatedRoutes.map(({ href }) => href) },
  performance: { services: ["/services/stage-1"], related: ["/file-service#stage-comparison", "/services/stage-2", "/services/stage-3", "/file-service"] },
  diesel: { services: ["/services/dpf-off", "/services/egr-off", "/services/adblue-off"], related: ["/file-service"] },
  gearbox: { services: ["/services/tcu-tuning"], related: ["/file-service"] },
  diagnostic: { services: ["/services/dtc-off"], related: ["/services/ecu-file-check", "/file-service"] },
};
const categoryIds = Object.keys(expectedFamilies) as Category[];
const newCopy = [
  "All services", "Filter services", "Matching services", "Select a category to focus the services and related routes.",
  "Performance tuning", "Diesel systems", "Gearbox tuning", "Diagnostics & checks",
];

function descendants(node: React.ReactNode): ExplorerElement[] {
  if (!React.isValidElement(node)) return [];
  const element = node as ExplorerElement;
  const children: ExplorerElement[] = [];
  React.Children.forEach(element.props.children, (child) => children.push(...descendants(child)));
  return [element, ...children];
}

function textContent(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!React.isValidElement(node)) return "";
  return React.Children.toArray((node as ExplorerElement).props.children).map(textContent).join("");
}

function escapeRenderedText(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
}

function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

// Deterministic hooks execute actual JSX and onClick closures. Focus starts on
// the activated native control; forbidden browser access detects focus theft.
// Native Enter/Space activation, real focus and responsive CSS still need QA.
function explorerHarness(locale: LocaleCode = "en") {
  const states: unknown[] = [];
  let stateIndex = 0;
  let activeLocale = locale;
  let focused: Category | null = null;
  const exports: {
    HomepageServiceExplorer?: (props: { locale: LocaleCode }) => React.ReactNode;
    catalog?: Catalog;
    buildHomepageStructuredData?: (locale: LocaleCode, catalog?: ReturnType<typeof buildHomepageTranslationCatalog>) => Array<Record<string, unknown>>;
  } = {};
  const noExternalWork = () => { throw new Error("Service discovery must not run timers, network, storage, customer data or browser mutations."); };
  const context: Record<string, unknown> = {
    exports, ...icons, intlLocaleByCode, europeRegionJsonLd, translateHomepageText, LocalizedHomepageTree,
    Link: ({ children, ...props }: ElementProps) => React.createElement("a", props, children),
    useState(initial: unknown) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = typeof initial === "function" ? (initial as () => unknown)() : initial;
      return [states[index], (next: unknown) => {
        states[index] = typeof next === "function" ? (next as (previous: unknown) => unknown)(states[index]) : next;
      }];
    },
    setTimeout: noExternalWork, setInterval: noExternalWork, requestAnimationFrame: noExternalWork,
    fetch: noExternalWork, useEffect: noExternalWork,
    require(name: string) {
      assert.equal(name, "react/jsx-runtime", `Unexpected service explorer dependency ${name}`);
      return jsxRuntime;
    },
  };
  for (const name of ["window", "document", "localStorage", "sessionStorage"]) {
    Object.defineProperty(context, name, { get: noExternalWork });
  }
  runInNewContext(compiled, context);
  assert.ok(exports.HomepageServiceExplorer);
  assert.ok(exports.catalog);
  assert.ok(exports.buildHomepageStructuredData);
  let current: React.ReactNode;
  function render(nextLocale: LocaleCode = activeLocale) {
    activeLocale = nextLocale;
    stateIndex = 0;
    current = exports.HomepageServiceExplorer!({ locale: activeLocale });
    return current;
  }
  const elements = () => descendants(current);
  const buttons = () => elements().filter((element) => element.type === "button") as React.ReactElement<FilterProps>[];
  render();
  return {
    catalog: exports.catalog,
    elements, buttons, render,
    grid: () => elements().find((element) => element.props["data-service-count"] !== undefined)!,
    cards: () => elements().filter((element) => element.props["data-homepage-service"] !== undefined),
    related: () => elements().filter((element) => element.props["data-homepage-related-route"] !== undefined),
    focused: () => focused,
    click(category: Category) {
      const button = buttons().find((element) => element.props["data-service-filter"] === category);
      assert.ok(button, `native control exists for ${category}`);
      focused = category;
      button.props.onClick();
      render();
    },
    schemas: () => plain(exports.buildHomepageStructuredData!(activeLocale, buildHomepageTranslationCatalog(activeLocale))),
    html: () => renderToStaticMarkup(React.createElement(
      HomepageLocalizationProvider,
      { locale: activeLocale, catalog: buildHomepageTranslationCatalog(activeLocale) } as React.ComponentProps<typeof HomepageLocalizationProvider>,
      current,
    )),
  };
}

function assertFamily(harness: ReturnType<typeof explorerHarness>, category: Category) {
  const expected = expectedFamilies[category];
  assert.deepEqual(harness.cards().map((card) => card.props.href), expected.services, category);
  assert.deepEqual(harness.related().map((route) => route.props.href), expected.related, category);
  assert.equal(harness.grid().type, "ul");
  assert.equal(harness.grid().props["data-service-count"], expected.services.length);
  assert.equal(harness.grid().key, category);
  assert.ok(expected.services.length > 0, "fixed families cannot create an empty/unavailable service claim");
  assert.equal(harness.elements().filter((element) => element.props.id === "homepage-service-results").length, 1);
  const buttons = harness.buttons();
  assert.deepEqual(buttons.map((button) => button.props["data-service-filter"]), categoryIds);
  assert.equal(buttons.filter((button) => button.props["aria-pressed"] === true).length, 1);
  for (const button of buttons) {
    const id = button.props["data-service-filter"];
    assert.equal(button.key, id, "controls stay keyed and outside the replaced result list");
    assert.equal(button.props.type, "button");
    assert.equal(button.props["aria-controls"], "homepage-service-results");
    assert.equal(button.props["aria-pressed"], id === category);
    assert.equal(button.props.onKeyDown, undefined, "native Enter/Space activation is not overridden");
    assert.equal(button.props.tabIndex, undefined, "every native filter remains in the normal tab order");
    assert.equal(button.props.disabled, undefined);
  }
  const status = harness.elements().find((element) => element.props.role === "status");
  assert.ok(status);
  assert.equal(status.props["aria-live"], "polite");
  assert.equal(status.props["aria-atomic"], "true");
  assert.equal(textContent(status), `Matching services${expected.services.length}`);
}

test("actual explorer SSR defaults to all six services and five related routes with native accessible controls", () => {
  const harness = explorerHarness();
  assertFamily(harness, "all");
  assert.match(harness.html(), /role="group" aria-label="Filter services"/u);
  assert.match(harness.html(), /Select a category to focus the services and related routes\./u);
  assert.equal(harness.buttons().map(textContent).join("|"), "All services6|Performance tuning1|Diesel systems3|Gearbox tuning1|Diagnostics & checks1");
  assert.doesNotMatch(harness.html(), /<(?:form|input|iframe|object|embed)\b|\bdownload=|href="(?:blob:|data:|https?:)/u);
  assert.doesNotMatch(harness.html(), /<[^>]+\shidden(?:=|\s|>)|style="[^"]*(?:opacity:\s*0|visibility:\s*hidden|display:\s*none)/u);
});

test("actual handlers deterministically filter, repeat, switch and reset without moving focus or mutating catalog/schema", () => {
  const harness = explorerHarness();
  const catalogBefore = plain(harness.catalog);
  const schemaBefore = harness.schemas();
  const allHtml = harness.html();
  for (const category of ["performance", "diesel", "gearbox", "diagnostic", "diagnostic", "all", "diesel", "performance", "all"] as const) {
    harness.click(category);
    assertFamily(harness, category);
    assert.equal(harness.focused(), category, "the handler never redirects native focus into changing results");
    assert.deepEqual(plain(harness.catalog), catalogBefore);
    assert.deepEqual(harness.schemas(), schemaBefore, "view filtering never narrows the published offer catalog");
  }
  assert.equal(harness.html(), allHtml, "reset returns exactly to the initial all-services view");
  const actualSource = explorer.getText(ast);
  assert.doesNotMatch(actualSource, /\b(?:setTimeout|setInterval|requestAnimationFrame|fetch|useEffect)\s*\(|window\.|document\.|localStorage|sessionStorage|authenticatedFetch|\.focus\s*\(/u);
});

test("existing service credits, descriptions, tags and genuine secondary routes remain exact", () => {
  const harness = explorerHarness();
  assert.deepEqual(plain(harness.catalog.services.map(({ title, text, credits, href, tag }) => ({ title, text, credits, href, tag }))), originalServices);
  assert.deepEqual(plain(harness.catalog.serviceDiscoveryLinks.map(({ label, href }) => ({ label, href }))), originalRelatedRoutes);
  for (const [index, service] of originalServices.entries()) {
    const card = renderToStaticMarkup(harness.cards()[index]);
    for (const value of [service.title, service.text, service.credits, service.tag, "View service"]) {
      assert.ok(card.includes(escapeRenderedText(value)), `${service.href}: retained ${value}`);
    }
    assert.equal(harness.cards()[index].props["data-homepage-service"], service.href);
  }
  const schemas = harness.schemas();
  assert.deepEqual(schemas.map((schema) => schema["@type"]), ["WebPage", "Service", "FAQPage", "HowTo"]);
  const offers = (schemas[1].hasOfferCatalog as { itemListElement: Array<{ position: number; itemOffered: { name: string; description: string; url: string } }> }).itemListElement;
  assert.deepEqual(offers.map(({ position, itemOffered }) => ({ position, ...itemOffered })), originalServices.map((service, index) => ({
    position: index + 1, "@type": "Service", name: service.title, description: service.text, url: `https://file.mgautotech.de${service.href}`,
  })));
});

test("all 12 locales render all five actual filter states with translated controls, cards and real localized links", () => {
  assert.equal(supportedLocales.length, 12);
  for (const { code } of supportedLocales) {
    const harness = explorerHarness(code);
    const catalog = buildHomepageTranslationCatalog(code);
    for (const category of categoryIds) {
      harness.click(category);
      assertFamily(harness, category);
      const html = harness.html();
      const expected = expectedFamilies[category];
      const visibleCopy = [
        ...newCopy, ...harness.catalog.serviceCategories.map(({ label }) => label), "View service", "More routes",
        ...harness.catalog.services.filter(({ href }) => expected.services.includes(href)).flatMap(({ title, text, credits, tag }) => [title, text, credits, tag]),
        ...harness.catalog.serviceDiscoveryLinks.filter(({ href }) => expected.related.includes(href)).map(({ label }) => label),
      ];
      for (const text of new Set(visibleCopy)) {
        const translated = translateHomepageText(text, catalog);
        assert.ok(html.includes(escapeRenderedText(translated)), `${code}/${category}: omitted localized ${text}`);
        if (code !== "en" && (newCopy.includes(text) || originalServices.some(({ text: description }) => description === text))) {
          assert.notEqual(translated, text, `${code}/${category}: clean English fallback ${text}`);
          assert.ok(!html.includes(escapeRenderedText(text)), `${code}/${category}: English leak ${text}`);
        }
      }
      assert.ok(html.includes(`aria-label="${escapeRenderedText(translateHomepageText("Filter services", catalog))}"`));
      for (const href of [...expected.services, ...expected.related]) {
        assert.ok(html.includes(`href="${localizeHomepageHref(href, code)}"`), `${code}/${category}: real route ${href}`);
      }
      assert.equal((html.match(/data-homepage-service=/gu) ?? []).length, expected.services.length);
      assert.equal((html.match(/data-homepage-related-route=/gu) ?? []).length, expected.related.length);
    }
    harness.render("en");
    assertFamily(harness, "diagnostic");
    assert.match(harness.html(), /aria-label="Filter services"/u);
    harness.render(code);
    assertFamily(harness, "diagnostic");
    harness.click("all");
    assertFamily(harness, "all");
  }
});

const router: AppRouterInstance = {
  back: () => undefined, forward: () => undefined, refresh: () => undefined,
  push: () => undefined, replace: () => undefined, prefetch: () => undefined,
};

test("the complete real homepage first paint embeds one explorer without dropping tools, workflow, pricing, FAQ or schema", () => {
  for (const { code } of supportedLocales) {
    const html = renderToStaticMarkup(React.createElement(
      AppRouterContext.Provider, { value: router },
      React.createElement(PathnameContext.Provider, { value: "/" },
        React.createElement(ActiveLocaleProvider, { initialLocale: code } as React.ComponentProps<typeof ActiveLocaleProvider>, renderRootHomepage(code)),
      ),
    ));
    assert.equal((html.match(/data-homepage-service-explorer=/gu) ?? []).length, 1, code);
    assert.equal((html.match(/data-service-filter=/gu) ?? []).length, 5, code);
    assert.equal((html.match(/data-homepage-service=/gu) ?? []).length, 6, code);
    assert.equal((html.match(/data-homepage-related-route=/gu) ?? []).length, 5, code);
    for (const id of ["services", "vehicle-data", "tools", "workflow", "security", "prices", "homepage-search-faq"]) {
      assert.ok(html.includes(`id="${id}"`), `${code}: existing ${id} surface remains`);
    }
    assert.match(html, /data-homepage-product-preview/u);
    assert.ok(html.includes('href="/new-request"'), `${code}: real secure-request route remains`);
    const schemas = Array.from(html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gu), (match) => JSON.parse(match[1]) as Record<string, unknown>);
    const service = schemas.find((schema) => schema["@type"] === "Service");
    assert.ok(service, `${code}: original service graph remains`);
    assert.equal((service.hasOfferCatalog as { itemListElement: unknown[] }).itemListElement.length, 6);
    assert.equal(schemas.filter((schema) => schema["@type"] === "FAQPage").length, 1);
    assert.equal(schemas.filter((schema) => schema["@type"] === "HowTo").length, 1);
  }
});
