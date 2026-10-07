import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { createPortal } from "react-dom";
import { renderToStaticMarkup } from "react-dom/server";
import * as icons from "lucide-react";
import ts from "typescript";
import { AppRouterContext, type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime.js";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime.js";
import { PublicUtilityBar, renderPublicUtilityControl, usePublicUtilityHost } from "../src/components/PublicUtilityBar";
import { PublicSeoHeader } from "../src/components/PublicSeoHeader";
import { ToolsHeader } from "../src/components/tools/ToolsHeader";
import LocalizedFileServicePage from "../src/app/[locale]/file-service/page";
import { ActiveLocaleProvider } from "../src/lib/useActiveLocale";
import { renderRootHomepage } from "../src/lib/renderRootHomepage";
import { createPublicUtilityHostRegistry, type PublicUtilitySlot } from "../src/lib/publicUtilityHosts";
import * as localeConfig from "../src/lib/i18nConfig";
import * as localeRoutes from "../src/lib/i18nRoutes";
import * as workflowRoutes from "../src/lib/i18n/customer-workflow-client-routes";
import * as runtimeTranslation from "../src/lib/i18n/runtime-exact-translation";
import { fixedPresentationLocaleBySegment } from "../src/lib/fixedPresentationLocale";
import { hreflangByLocale, isSeoLocale } from "../src/lib/seo";
import * as analytics from "../src/lib/publicAnalytics";
import { analyticsConsentCopy, getAnalyticsConsentCopy, getAnalyticsPrivacyPath } from "../src/lib/analyticsConsentI18n";

type Props = Record<string, unknown> & { children?: React.ReactNode };
type Element = React.ReactElement<Props>;
type Portal = React.ReactPortal & { containerInfo: HTMLElement; $$typeof: symbol };
const { supportedLocales } = localeConfig;
const syntheticHost = () => ({ nodeType: 1, isConnected: true }) as unknown as HTMLElement;
const forbidden = () => { throw new Error("Utility render tests must not make network, consent, storage, account or request-header operations."); };
const source = (file: string) => readFileSync(file, "utf8");
const isPortal = (node: React.ReactNode): node is Portal => Boolean(node && typeof node === "object" && "$$typeof" in node && node.$$typeof === Symbol.for("react.portal"));
const controlNode = (node: React.ReactNode) => isPortal(node) ? node.children : node;

function descendants(node: React.ReactNode): Element[] {
  if (isPortal(node)) return descendants(node.children);
  if (Array.isArray(node)) return node.flatMap(descendants);
  if (!React.isValidElement(node)) return [];
  const element = node as Element;
  return [element, ...React.Children.toArray(element.props.children).flatMap(descendants)];
}
function portals(node: React.ReactNode): Portal[] {
  if (isPortal(node)) return [node, ...portals(node.children)];
  if (Array.isArray(node)) return node.flatMap(portals);
  return React.isValidElement(node) ? React.Children.toArray((node as Element).props.children).flatMap(portals) : [];
}
function text(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (isPortal(node)) return text(node.children);
  if (Array.isArray(node)) return node.map(text).join("");
  return React.isValidElement(node) ? React.Children.toArray((node as Element).props.children).map(text).join("") : "";
}
function compiled(file: string) {
  const ast = ts.createSourceFile(file, source(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  return {
    ast,
    code: ts.transpileModule(ast.statements.filter((statement) => !ts.isImportDeclaration(statement)).map((statement) => statement.getText(ast)).join("\n"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText,
  };
}
const compiledSources = new Map(["src/components/LanguageSwitcher.tsx", "src/components/OnlineStatus.tsx", "src/components/analytics/PublicAnalytics.tsx"].map((file) => [file, compiled(file)]));

// Execute real component bodies, JSX and handlers. Only hooks and external
// effects are deterministic doubles; actual DOM layout/focus require GUI QA.
function harness(file: string, exportName: string, options: { locale?: localeConfig.LocaleCode; pathname?: string; host?: HTMLElement | null; states?: Record<string, unknown> } = {}) {
  const { ast, code } = compiledSources.get(file)!;
  const stateNames: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && ts.isArrayBindingPattern(node.name) && node.initializer && ts.isCallExpression(node.initializer) && ts.isIdentifier(node.initializer.expression) && node.initializer.expression.text === "useState") stateNames.push(node.name.elements[0].getText(ast));
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const locale = options.locale ?? "en";
  const pathname = options.pathname ?? "/file-service";
  const host = options.host ?? null;
  const states = new Map(Object.entries(options.states ?? {}));
  const refs: Array<{ current: unknown }> = [];
  const timers: Array<() => void> = [];
  const persisted: Array<[string, localeConfig.LocaleCode]> = [];
  const requestedSlots: PublicUtilitySlot[] = [];
  let stateIndex = 0;
  let refIndex = 0;
  let current: React.ReactNode;
  const exports: Record<string, unknown> = {};
  const documentDouble = { activeElement: null as unknown, documentElement: { lang: locale } };
  const browser = {
    location: { pathname, search: "?utm_source=synthetic", hash: "#stage-comparison", reload: forbidden, replace: forbidden, assign: forbidden },
    setTimeout(callback: () => void) { timers.push(callback); return timers.length; },
  };
  const context: Record<string, unknown> = {
    exports, ...localeConfig, ...localeRoutes, ...workflowRoutes, ...runtimeTranslation, ...analytics, ...icons,
    fixedPresentationLocaleBySegment, isSeoLocale, getAnalyticsConsentCopy, getAnalyticsPrivacyPath,
    useActiveLocale: () => locale,
    usePathname: () => pathname,
    usePublicUtilityHost: (slot: PublicUtilitySlot) => { requestedSlots.push(slot); return host; },
    renderPublicUtilityControl,
    useState(initial: unknown) {
      const name = stateNames[stateIndex++];
      assert.ok(name, "every actual state hook must have an identified binding");
      if (!states.has(name)) states.set(name, typeof initial === "function" ? (initial as () => unknown)() : initial);
      return [states.get(name), (value: unknown) => states.set(name, typeof value === "function" ? (value as (previous: unknown) => unknown)(states.get(name)) : value)];
    },
    useRef(initial: unknown) { const slot = refIndex++; return refs[slot] ?? (refs[slot] = { current: initial }); },
    useMemo: (calculate: () => unknown) => calculate(),
    useEffect: () => undefined,
    useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
    readStoredLocale: forbidden, readLocaleCookie: forbidden,
    writeStoredLocale: (value: localeConfig.LocaleCode) => persisted.push(["storage", value]),
    writeLocaleCookies: (value: localeConfig.LocaleCode) => persisted.push(["cookie", value]),
    writeDocumentLocale: (value: localeConfig.LocaleCode) => persisted.push(["document", value]),
    dispatchLocaleChange: (value: localeConfig.LocaleCode) => persisted.push(["event", value]),
    writeMeasurementConsent: forbidden,
    Link: ({ children, ...props }: Props) => React.createElement("a", props, children),
    Script: () => { throw new Error("No measurement script should be rendered by the utility fixture."); },
    document: documentDouble, window: browser, fetch: forbidden,
    require(name: string) { assert.equal(name, "react/jsx-runtime"); return jsxRuntime; },
  };
  for (const name of ["localStorage", "sessionStorage", "navigator"]) Object.defineProperty(context, name, { get: forbidden });
  runInNewContext(code + (exportName === "OnlineStatus" ? "\nexports.statusCopy = statusCopy;" : ""), context);
  const component = exports[exportName] as (props: Props) => React.ReactNode;
  assert.equal(typeof component, "function");
  function render() { stateIndex = 0; refIndex = 0; current = component({ googleAnalyticsMeasurementId: "G-TEST123456" }); return current; }
  render();
  return {
    render, states, exports, persisted, requestedSlots, documentDouble,
    node: () => current,
    elements: () => descendants(current),
    html: () => renderToStaticMarkup(controlNode(current)),
    drainTimers: () => { for (const timer of timers.splice(0)) timer(); },
  };
}
function language(options: Parameters<typeof harness>[2] = {}) { return harness("src/components/LanguageSwitcher.tsx", "LanguageSwitcher", options); }
function privacy(options: Parameters<typeof harness>[2] = {}) {
  return harness("src/components/analytics/PublicAnalytics.tsx", "PublicAnalytics", { ...options, states: { hostApproved: true, consent: { preferences: { analytics: false, advertising: false }, source: "v2", needsDecision: false }, ...options.states } });
}
const find = (h: ReturnType<typeof harness>, predicate: (element: Element) => boolean) => { const element = h.elements().find(predicate); assert.ok(element, "actual rendered element must exist"); return element; };

/** Inert, explicitly synthetic layout output; not a real localhost consent runtime. */
export function renderUtilityPrivacyGeometryFixture(locale: localeConfig.LocaleCode) {
  const host = syntheticHost();
  const privacyHarness = privacy({ locale, host });
  const privacyPortal = portals(privacyHarness.node())[0];
  assert.ok(privacyPortal, "actual approved synthetic compact privacy JSX");
  const controlMarkup: Record<PublicUtilitySlot, string> = {
    privacy: renderToStaticMarkup(privacyPortal.children),
    language: language({ locale, pathname: localeRoutes.getLocalizedPublicPath("/file-service", locale), host, states: { localeResolved: true } }).html(),
    status: harness("src/components/OnlineStatus.tsx", "OnlineStatus", { locale, host }).html(),
  };
  let header = renderToStaticMarkup(React.createElement(PublicSeoHeader, { locale })).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gu, "");
  for (const slot of ["status", "privacy", "language"] as const) {
    const hostPattern = new RegExp(`(<div\\b[^>]*data-public-utility-host="${slot}"[^>]*>)([\\s\\S]*?)(<\\/div>)`, "u");
    assert.match(header, hostPattern, `actual SSR ${slot} host`);
    header = header.replace(hostPattern, (_match, opening: string, neutral: string, closing: string) => `${opening}${neutral}${controlMarkup[slot]}${closing}`);
  }
  return `<!doctype html><html lang="${hreflangByLocale[locale]}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Synthetic utility geometry fixture - ${locale}</title></head><body class="min-h-full flex flex-col" data-synthetic-layout-only="true" data-synthetic-consent-state="approved-for-inert-layout-only"><main class="min-h-screen bg-[#050505] text-white">${header}</main></body></html>`;
}

test("privacy geometry fixture is inert actual markup with explicitly synthetic state", () => {
  for (const locale of ["en", "de", "tr", "zh"] as const) {
    const html = renderUtilityPrivacyGeometryFixture(locale);
    assert.match(html, /data-synthetic-layout-only="true"/u);
    assert.match(html, /data-synthetic-consent-state="approved-for-inert-layout-only"/u);
    assert.equal((html.match(/<button\b/gu) ?? []).length, 2);
    assert.equal((html.match(/data-language-switcher=/gu) ?? []).length, 1);
    assert.doesNotMatch(html, /<script\b|\b(?:onclick|onkeydown)=|googletagmanager|\bfixed\b/u);
    assert.ok(html.includes(analyticsConsentCopy[locale].openPreferences));
    assert.match(html, /relative h-11 w-11/u);
  }
});

test("slot registry independently registers, replaces and cleans up exact connected hosts", () => {
  const registry = createPublicUtilityHostRegistry<{ isConnected: boolean; name: string }>();
  let notifications = 0;
  const unsubscribe = registry.subscribe(() => notifications++);
  const original = { isConnected: true, name: "outgoing" };
  const successor = { isConnected: true, name: "incoming" };
  const privacyHost = { isConnected: true, name: "privacy" };
  assert.equal(registry.getHost("language"), null);
  const removeOriginal = registry.register("language", original);
  const removePrivacy = registry.register("privacy", privacyHost);
  const removeSuccessor = registry.register("language", successor);
  assert.equal(registry.getHost("language"), successor);
  assert.equal(registry.getHost("privacy"), privacyHost);
  assert.equal(registry.getHost("status"), null);
  removeOriginal();
  assert.equal(registry.getHost("language"), successor, "outgoing unmount cannot remove incoming header");
  assert.equal(notifications, 4);
  removeOriginal();
  assert.equal(notifications, 4, "cleanup is idempotent");
  successor.isConnected = false;
  assert.equal(registry.getHost("language"), null, "never portal into a detached node");
  removeSuccessor(); removePrivacy();
  assert.equal(registry.getHost("privacy"), null);
  unsubscribe();
  registry.register("status", original);
  assert.equal(notifications, 6, "unsubscribed consumers receive no notification");
});

test("connected predecessor remains a fallback until its exact cleanup", () => {
  const registry = createPublicUtilityHostRegistry<{ isConnected: boolean }>();
  const older = { isConnected: true };
  const newer = { isConnected: false };
  const removeOlder = registry.register("status", older);
  const removeNewer = registry.register("status", newer);
  assert.equal(registry.getHost("status"), older);
  newer.isConnected = true;
  assert.equal(registry.getHost("status"), newer);
  removeNewer();
  assert.equal(registry.getHost("status"), older);
  removeOlder();
  assert.equal(registry.getHost("status"), null);
});

test("actual UtilityHost refs register, replace and unmount without document discovery", () => {
  const { code } = compiled("src/components/PublicUtilityBar.tsx");
  const exports: { PublicUtilityBar?: typeof PublicUtilityBar; usePublicUtilityHost?: typeof usePublicUtilityHost } = {};
  runInNewContext(code, {
    exports, createPublicUtilityHostRegistry, createPortal,
    useCallback: (callback: unknown) => callback,
    useRef: (initial: unknown) => ({ current: initial }),
    useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
    require(name: string) { assert.equal(name, "react/jsx-runtime"); return jsxRuntime; },
  });
  const hosts = descendants(exports.PublicUtilityBar!({})).filter((element) => typeof element.type === "function");
  assert.deepEqual(hosts.map((element) => element.props["data-public-utility-host"]), ["status", "privacy", "language"]);
  for (const element of hosts) {
    const hostElement = (element.type as (props: Props) => Element)(element.props);
    const ref = hostElement.props.ref as (node: HTMLElement | null) => void;
    const first = syntheticHost(); const second = syntheticHost();
    ref(first); assert.equal(exports.usePublicUtilityHost!(element.props["data-public-utility-host"] as PublicUtilitySlot), first);
    ref(second); assert.equal(exports.usePublicUtilityHost!(element.props["data-public-utility-host"] as PublicUtilitySlot), second);
    ref(null); assert.equal(exports.usePublicUtilityHost!(element.props["data-public-utility-host"] as PublicUtilitySlot), null);
    ref(null); assert.equal(exports.usePublicUtilityHost!(element.props["data-public-utility-host"] as PublicUtilitySlot), null);
  }
});

test("one actual control node becomes a portal only with an owned host; SSR stays requestless", () => {
  const control = React.createElement("button", { type: "button" }, "Synthetic control");
  assert.equal(renderPublicUtilityControl(null, control), control);
  const host = syntheticHost();
  const portal = renderPublicUtilityControl(host, control);
  assert.ok(isPortal(portal));
  assert.equal(portal.containerInfo, host);
  assert.equal(portal.children, control, "the existing instance is moved, not copied");
  const Probe = () => { assert.equal(usePublicUtilityHost("language"), null); return React.createElement(PublicUtilityBar); };
  const html = renderToStaticMarkup(React.createElement(Probe));
  assert.equal((html.match(/data-public-utility-bar=/gu) ?? []).length, 1);
  for (const slot of ["status", "privacy", "language"]) assert.equal((html.match(new RegExp(`data-public-utility-host="${slot}"`, "gu")) ?? []).length, 1);
  assert.match(html, /data-public-utility-placeholder="(?:true)?" aria-hidden="true"/u);
  assert.doesNotMatch(html, /(?:Change language|Privacy preferences|Checking availability|fixed|role="menu")/u);
});

test("actual pending language control remains neutral in all 12 locales and both placements", () => {
  for (const { code: locale } of supportedLocales) for (const host of [null, syntheticHost()]) {
    const h = language({ locale, host });
    const node = find(h, (element) => element.props["data-language-switcher-pending"] !== undefined);
    assert.equal(node.props["aria-hidden"], "true");
    assert.equal(text(node), "🌐");
    assert.match(String(node.props.className), /h-11 min-w-11/u);
    if (host) assert.doesNotMatch(String(node.props.className), /fixed/u);
    else assert.match(String(node.props.className), /fixed bottom-4 right-4/u);
    assert.equal(portals(h.node()).length, host ? 1 : 0);
    assert.equal(h.requestedSlots[0], "language");
    assert.doesNotMatch(h.html(), /(?:Change language|>EN<|aria-label=|role="menu")/u);
  }
});

test("resolved language menus retain all native options, current selection, hrefs and 44px rows", () => {
  for (const { code: locale } of supportedLocales) for (const host of [null, syntheticHost()]) {
    const pathname = localeRoutes.getLocalizedPublicPath("/file-service", locale);
    const h = language({ locale, pathname, host, states: { localeResolved: true, isOpen: true } });
    const copy = (h.exports.selectorCopy as Record<localeConfig.LocaleCode, { label: string; change: string; switchTo: string }>)[locale];
    const wrapper = find(h, (element) => element.props["data-language-switcher"] !== undefined);
    if (host) assert.doesNotMatch(String(wrapper.props.className), /fixed/u);
    else assert.match(String(wrapper.props.className), /fixed bottom-4 right-4/u);
    const trigger = find(h, (element) => element.props["aria-haspopup"] === "menu");
    assert.equal(trigger.props["aria-label"], copy.change);
    assert.equal(trigger.props.title, copy.change);
    assert.equal(trigger.props["aria-expanded"], true);
    assert.match(String(trigger.props.className), /h-11 min-w-11/u);
    assert.match(String(trigger.props.className), /focus-visible:ring-2/u);
    const menu = find(h, (element) => element.props.role === "menu");
    assert.equal(menu.props["aria-label"], copy.label);
    assert.match(String(menu.props.className), /overflow-y-auto/u);
    if (host) assert.match(String(menu.props.className), /absolute right-0 top-/u);
    const options = h.elements().filter((element) => element.props.role === "menuitemradio");
    assert.equal(options.length, 12);
    options.forEach((element, index) => {
      const item = supportedLocales[index];
      assert.ok(text(element).includes(item.name));
      assert.equal(element.props["aria-label"], `${copy.switchTo} ${item.name}`);
      assert.equal(element.props["aria-checked"], item.code === locale);
      assert.match(String(element.props.className), /min-h-11/u);
      if (item.code !== locale) {
        assert.equal(element.type, "a");
        assert.equal(element.props.href, `${localeRoutes.appendSafeQuery(localeRoutes.getLocalizedPublicPath(pathname, item.code), "?utm_source=synthetic")}#stage-comparison`);
        assert.equal(element.props["data-mg-locale-intent"], item.code);
      }
    });
    assert.equal(options.filter((element) => element.props["aria-checked"]).length, 1);
    assert.equal(portals(h.node()).length, host ? 1 : 0);
    assert.equal((h.html().match(/id="mg-language-menu"/gu) ?? []).length, 1);
  }
});

test("actual language handlers retain keyboard traversal, Space, Escape and native navigation focus", () => {
  const h = language({ host: syntheticHost(), states: { localeResolved: true, isOpen: true } });
  const trigger = find(h, (element) => element.props["aria-haspopup"] === "menu");
  const menu = find(h, (element) => element.props.role === "menu");
  let triggerFocus = 0; let prevented = 0; let clicked = 0;
  const focused: number[] = [];
  const items = supportedLocales.map((_item, index) => ({ focus: () => focused.push(index), click: () => clicked++ }));
  (trigger.props.ref as { current: unknown }).current = { focus: () => triggerFocus++ };
  (menu.props.ref as { current: unknown }).current = { querySelectorAll: () => items };
  h.documentDouble.activeElement = items[1];
  const key = (value: string) => (menu.props.onKeyDown as (event: { key: string; preventDefault: () => void }) => void)({ key: value, preventDefault: () => prevented++ });
  key("ArrowDown"); key("ArrowUp"); key("Home"); key("End"); key(" "); key("Escape");
  assert.deepEqual(focused, [2, 0, 0, 11]);
  assert.equal(clicked, 1); assert.equal(prevented, 6); assert.equal(triggerFocus, 1);
  h.render(); assert.equal(h.elements().some((element) => element.props.role === "menu"), false);
  (find(h, (element) => element.props["aria-haspopup"] === "menu").props.onClick as () => void)(); h.render();
  const target = find(h, (element) => element.props["data-mg-locale-intent"] === "de");
  (target.props.onClick as (event: { preventDefault: () => void }) => void)({ preventDefault: forbidden });
  h.drainTimers(); h.render();
  assert.deepEqual(h.persisted, [["storage", "de"], ["cookie", "de"], ["document", "de"], ["event", "de"]]);
  assert.equal(h.states.get("isOpen"), false);
  assert.equal(triggerFocus, 2);
});

test("all 12 hosted loading and recoverable failure states use existing localized copy", () => {
  for (const { code: locale } of supportedLocales) {
    const h = language({ locale, host: syntheticHost(), states: { localeResolved: true, isLocaleLoading: true } });
    const copy = (h.exports.selectorCopy as Record<localeConfig.LocaleCode, { loading: string; failed: string; retry: string }>)[locale];
    const loading = find(h, (element) => element.props.role === "status");
    assert.equal(text(loading), copy.loading); assert.equal(loading.props["aria-live"], "polite");
    h.states.set("isLocaleLoading", false); h.states.set("failedLocale", "zh"); h.render();
    const alert = find(h, (element) => element.props.role === "alert");
    assert.ok(text(alert).includes(copy.failed));
    const retry = find(h, (element) => element.type === "button" && text(element) === copy.retry);
    assert.match(String(retry.props.className), /min-h-11/u);
    (retry.props.onClick as () => void)(); h.render();
    assert.equal(h.states.get("requestedLocale"), "zh");
    assert.equal(h.states.get("failedLocale"), null);
    assert.equal(h.states.get("retryAttempt"), 1);
    assert.equal(h.states.get("isLocaleLoading"), true);
    assert.equal(h.elements().some((element) => element.props.role === "alert"), false);
  }
});

test("hosted menus temporarily hide loading/error panels without discarding recovery state", () => {
  for (const { code: locale } of supportedLocales) for (const host of [null, syntheticHost()]) {
    const h = language({ locale, host, states: { localeResolved: true, failedLocale: "zh" } });
    assert.equal(h.elements().some((element) => element.props.role === "alert"), true);
    (find(h, (element) => element.props["aria-haspopup"] === "menu").props.onClick as () => void)(); h.render();
    assert.equal(h.elements().some((element) => element.props.role === "menu"), true);
    assert.equal(h.elements().some((element) => element.props.role === "alert"), !host);
    assert.equal(h.states.get("failedLocale"), "zh", "opening the hosted menu must not erase the failed selection");
    (find(h, (element) => element.props["aria-haspopup"] === "menu").props.onClick as () => void)(); h.render();
    assert.equal(h.elements().some((element) => element.props.role === "alert"), true);
    h.states.set("isLocaleLoading", true); h.states.set("isOpen", true); h.render();
    assert.equal(h.elements().some((element) => element.props.role === "status"), !host);
    assert.equal(h.states.get("isLocaleLoading"), true);
    h.states.set("isOpen", false); h.render();
    assert.equal(h.elements().some((element) => element.props.role === "status"), true);
  }
});

test("page-owned, authored and private routes retain their hidden selector contract", () => {
  for (const pathname of ["/admin", "/privacy", "/impressum", "/embed/vehicle-selector", "/auth/complete-profile", "/auth/callback", "/desktop-auth/login"]) {
    const h = language({ pathname, host: syntheticHost(), states: { localeResolved: true, isOpen: true } });
    assert.equal(h.node(), null, pathname);
    assert.equal(portals(h.node()).length, 0, pathname);
    assert.deepEqual(h.persisted, [], pathname);
  }
});

test("only the localized privacy reopen button moves; opening preferences leaves the dialog overlay intact", () => {
  for (const { code: locale } of supportedLocales) {
    const host = syntheticHost();
    const h = privacy({ locale, host });
    const copy = analyticsConsentCopy[locale];
    const button = find(h, (element) => element.props["aria-label"] === copy.openPreferences);
    assert.equal(button.type, "button"); assert.equal(button.props.title, copy.preferencesTitle);
    assert.match(String(button.props.className), /relative h-11 w-11/u);
    assert.match(String(button.props.className), /focus-visible:ring-2/u);
    assert.doesNotMatch(String(button.props.className), /fixed/u);
    assert.equal(portals(h.node()).length, 1); assert.equal(portals(h.node())[0].containerInfo, host);
    assert.equal(h.requestedSlots[0], "privacy");
    (button.props.onClick as () => void)(); h.render();
    assert.equal(portals(h.node()).length, 0, "the consent panel is not portaled into the header");
    const panel = find(h, (element) => element.type === "aside" && element.props["aria-labelledby"] === "analytics-consent-title");
    assert.match(String(panel.props.className), /fixed/u);
    assert.ok(text(panel).includes(copy.title)); assert.ok(text(panel).includes(copy.savePreferences));
    assert.equal(h.elements().filter((element) => element.type === "input" && element.props.type === "checkbox").length, 2);
    assert.equal(h.elements().some((element) => element.props["aria-label"] === copy.openPreferences), false);
  }
  const fallback = privacy();
  assert.match(String(find(fallback, (element) => element.props["aria-label"] === analyticsConsentCopy.en.openPreferences).props.className), /fixed bottom-4 right-20/u);
  for (const states of [{ consent: "loading" }, { consent: { preferences: { analytics: false, advertising: false }, needsDecision: true } }, { pendingAdClickDestination: "/register" }]) {
    const h = privacy({ host: syntheticHost(), states });
    assert.equal(portals(h.node()).length, 0, "undecided/loading/ad-click gate must not expose compact reopen control");
  }
});

test("online status moves one unchanged localized instance with wrapping inline and normal-flow SSR fallback", () => {
  for (const { code: locale } of supportedLocales) for (const now of [null, new Date(2026, 9, 5, 12, 34), new Date(2026, 9, 5, 3, 0), new Date(2026, 9, 4, 12, 34)]) {
    const fallback = harness("src/components/OnlineStatus.tsx", "OnlineStatus", { locale, states: { now } });
    const hosted = harness("src/components/OnlineStatus.tsx", "OnlineStatus", { locale, host: syntheticHost(), states: { now } });
    assert.equal(text(fallback.node()), text(hosted.node()), `${locale}: copy, clock and online schedule are unchanged`);
    assert.equal(hosted.requestedSlots[0], "status");
    assert.equal(portals(hosted.node()).length, 1);
    assert.equal(hosted.elements().filter((element) => element.props["data-online-status"] !== undefined).length, 1);
    assert.doesNotMatch(String(find(hosted, (element) => element.props["data-online-status"] !== undefined).props.className), /fixed/u);
    assert.match(String(find(fallback, (element) => element.props["data-online-status"] !== undefined).props.className), /pointer-events-none mx-auto w-full max-w-7xl/u);
    assert.doesNotMatch(String(find(fallback, (element) => element.props["data-online-status"] !== undefined).props.className), /fixed|bottom-/u);
    assert.doesNotMatch(fallback.html(), /\bfixed\b/u, `${locale}: real first-paint status must not cover footer or form content`);
    assert.equal(hosted.elements().some((element) => String(element.props.className).includes("break-words")), true);
    const copy = (hosted.exports.statusCopy as Record<localeConfig.LocaleCode, { loadingTitle: string; loadingLabel: string }>)[locale];
    if (!now) assert.equal(text(hosted.node()), `${copy.loadingTitle}${copy.loadingLabel}`);
  }
});

const router: AppRouterInstance = { back: () => undefined, forward: () => undefined, refresh: () => undefined, push: () => undefined, replace: () => undefined, prefetch: () => undefined };
function localizedMarkup(locale: localeConfig.LocaleCode, node: React.ReactNode) {
  return renderToStaticMarkup(React.createElement(AppRouterContext.Provider, { value: router }, React.createElement(PathnameContext.Provider, { value: "/" }, React.createElement(ActiveLocaleProvider, { initialLocale: locale } as React.ComponentProps<typeof ActiveLocaleProvider>, node))));
}
test("all four opted-in actual headers render exactly one normal-flow utility row in every locale", async () => {
  for (const { code: locale } of supportedLocales) {
    const cases = [
      ["public SEO", React.createElement(PublicSeoHeader, { locale })],
      ["tools", React.createElement(ToolsHeader, { locale })],
      ["homepage", renderRootHomepage(locale)],
      ["localized file service", await LocalizedFileServicePage({ params: Promise.resolve({ locale }) })],
    ] as const;
    for (const [name, node] of cases) {
      const html = localizedMarkup(locale, node);
      const headers = [...html.matchAll(/<header\b[^>]*>[\s\S]*?<\/header>/gu)];
      assert.equal(headers.length, 1, `${locale}/${name}: original header count`);
      assert.equal((headers[0][0].match(/data-public-utility-bar=/gu) ?? []).length, 1, `${locale}/${name}: host row belongs inside the actual header`);
      for (const slot of ["status", "privacy", "language"]) assert.equal((html.match(new RegExp(`data-public-utility-host="${slot}"`, "gu")) ?? []).length, 1, `${locale}/${name}/${slot}: no duplicate host`);
      const utilityRow = headers[0][0].slice(headers[0][0].indexOf("data-public-utility-bar="));
      assert.doesNotMatch(utilityRow, /\bfixed\b|\babsolute\b/u);
      assert.match(utilityRow, /min-h-13/u);
      assert.equal((html.match(/data-online-status=/gu) ?? []).length <= 1, true, `${locale}/${name}: status is not duplicated`);
    }
  }
});

test("placement remains exact-file inventoried and does not introduce root request reads or duplicate owner mounts", () => {
  const homepageAst = ts.createSourceFile("HomepageExperience.tsx", source("src/components/homepage/HomepageExperience.tsx"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const header = homepageAst.statements.find((statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === "HomepageHeader");
  assert.ok(header, "inspect the actual native header branches, not a replacement fixture");
  const nativePanelClasses: string[] = [];
  function inspectNativePanels(node: ts.Node) {
    if (ts.isJsxOpeningElement(node) && node.tagName.getText(homepageAst) === "div") {
      const attribute = node.attributes.properties.find((property) => ts.isJsxAttribute(property) && property.name.getText(homepageAst) === "className");
      if (attribute && ts.isJsxAttribute(attribute) && attribute.initializer && ts.isStringLiteral(attribute.initializer) && attribute.initializer.text.startsWith("absolute right-0 top-")) nativePanelClasses.push(attribute.initializer.text);
    }
    ts.forEachChild(node, inspectNativePanels);
  }
  inspectNativePanels(header);
  assert.equal(nativePanelClasses.length, 2, "preserve both native account and mobile navigation panel branches");
  for (const panel of nativePanelClasses) assert.ok(panel.split(/\s+/u).includes("z-50"), "native panels must paint above later closed utility triggers, below the z-80 language menu");
  const inventory = source("scripts/check-customer-i18n.ts");
  assert.match(inventory, /"src\/components\/PublicUtilityBar\.tsx"/u);
  for (const file of ["src/app/layout.tsx", "src/app/page.tsx", "src/components/RootDocument.tsx", "src/components/PublicUtilityBar.tsx", "src/lib/publicUtilityHosts.ts"]) assert.doesNotMatch(source(file), /next\/headers|\bheaders\s*\(|\bcookies\s*\(|\bgetServerLocale\s*\(/u, file);
  for (const file of ["src/components/homepage/HomepageExperience.tsx", "src/components/PublicCoreServiceExperience.tsx", "src/app/file-service/page.tsx", "src/app/[locale]/file-service/page.tsx", "src/app/services/page.tsx"]) assert.equal((source(file).match(/<OnlineStatus\s*\/\s*>/gu) ?? []).length, 1, `${file}: preserve one existing owner mount`);
  assert.equal((source("src/app/layout.tsx").match(/<LanguageSwitcher\s*\/\s*>/gu) ?? []).length, 1);
  assert.equal((source("src/components/analytics/PublicAnalytics.tsx").match(/renderPublicUtilityControl\(/gu) ?? []).length, 1, "only the compact privacy reopen button is relocated");
  assert.doesNotMatch(source("src/components/PublicUtilityBar.tsx"), /querySelector|MutationObserver|next\/navigation|document\./u);
  const css = source("src/app/globals.css");
  assert.match(css, /data-public-utility-host="language"[^\n]*:has\([^\n]*data-language-switcher[^\n]*\)[^\n]*data-public-utility-placeholder/u);
  assert.match(css, /body:has\([^\n]*data-public-utility-bar[^\n]*\)[^\n]*>[^\n]*data-language-switcher-pending/u);
  const scrollAncestorRule = css.match(/:where\([^\n]+\):has\(\[data-public-utility-bar\]\)\s*\{[^}]+\}/u)?.[0] ?? "";
  assert.match(scrollAncestorRule, /:where\(body,\s*main,\s*\.mg-homepage\):has\(\[data-public-utility-bar\]\)\s*\{\s*overflow-x:\s*clip;\s*overflow-y:\s*visible;/u);
  const directHeaderWrapperRule = css.match(/:where\(div\):has\([^\n]+\)\s*\{[^}]+\}/u)?.[0] ?? "";
  assert.match(directHeaderWrapperRule, /:where\(div\):has\(>\s*header\s+\[data-public-utility-bar\]\)\s*\{\s*overflow-x:\s*clip;\s*overflow-y:\s*visible;/u);
  const toolsIntroRule = css.match(/:where\(div\):has\(>\s*header\s+\[data-public-utility-bar\]\):not\(\.mg-homepage\)\s*>\s*main\s+\.flex\.flex-col\.items-start\s*>\s*:where\(div\):has\(>\s*h1\)\s*\{[^}]+\}/u)?.[0] ?? "";
  assert.match(toolsIntroRule, /min-width:\s*0;\s*max-width:\s*100%;\s*overflow-wrap:\s*anywhere;/u);
  const anchorClearanceRule = css.match(/:where\([^\n]+\):has\(\[data-public-utility-bar\]\)\s+\[id\]\s*\{[^}]+\}/u)?.[0] ?? "";
  assert.match(anchorClearanceRule, /:where\(main,\s*\.mg-homepage\):has\(\[data-public-utility-bar\]\)\s+\[id\]\s*\{\s*scroll-margin-top:\s*14rem;/u);
});
