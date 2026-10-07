import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import * as icons from "lucide-react";
import ts from "typescript";
import { renderPublicUtilityControl } from "../src/components/PublicUtilityBar";
import * as localeConfig from "../src/lib/i18nConfig";
import * as localeRoutes from "../src/lib/i18nRoutes";
import * as workflowRoutes from "../src/lib/i18n/customer-workflow-client-routes";
import * as runtimeTranslation from "../src/lib/i18n/runtime-exact-translation";
import * as notificationCopy from "../src/lib/i18n/customer-workflow-notifications-translations";
import { fixedPresentationLocaleBySegment } from "../src/lib/fixedPresentationLocale";
import { isCustomerNotificationRuntimePath } from "../src/lib/customerNotificationRuntime";

type Props = Record<string, unknown> & { children?: React.ReactNode };
type Element = React.ReactElement<Props>;
type Portal = React.ReactPortal & { containerInfo: HTMLElement };
type RecordNode = { element: Element; parent: Element | null };
type Notification = {
  id: string; user_id: string; order_id: string | null; type: "system" | "file_ready";
  title: string; body: string; status: null; read_at: string | null; created_at: string;
};
type Account = { userId: string; active: boolean; authorized: boolean };
const filenames = {
  language: "src/components/LanguageSwitcher.tsx",
  notifications: "src/components/CustomerNotifications.tsx",
} as const;
const forbidden = () => { throw new Error("Overlay render tests must not access SDK, auth, env, network or real browser storage."); };
const syntheticAccount: Account = { userId: "synthetic-only-account", active: true, authorized: true };
const syntheticRow = (id: string, ready = false): Notification => ({
  id, user_id: syntheticAccount.userId, order_id: `synthetic-order-${id}`,
  type: ready ? "file_ready" : "system", title: `Synthetic-only title ${id}`,
  body: `Synthetic-only body ${id}`, status: null, read_at: null, created_at: "2026-10-07T10:00:00.000Z",
});
const isPortal = (node: React.ReactNode): node is Portal => Boolean(node && typeof node === "object" && "$$typeof" in node && node.$$typeof === Symbol.for("react.portal"));
function content(node: React.ReactNode): React.ReactNode { return isPortal(node) ? node.children : node; }
function records(node: React.ReactNode, parent: Element | null = null): RecordNode[] {
  if (isPortal(node)) return records(node.children, parent);
  if (Array.isArray(node)) return node.flatMap((child) => records(child, parent));
  if (!React.isValidElement(node)) return [];
  const element = node as Element;
  return [{ element, parent }, ...records(element.props.children, element)];
}
function text(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (isPortal(node)) return text(node.children);
  if (Array.isArray(node)) return node.map(text).join("");
  return React.isValidElement(node) ? text((node as Element).props.children) : "";
}
const source = (file: string) => readFileSync(file, "utf8");
function compiled(file: string) {
  const ast = ts.createSourceFile(file, source(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const stateNames: string[] = [];
  const refNames: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isCallExpression(node.initializer) && ts.isIdentifier(node.initializer.expression)) {
      if (node.initializer.expression.text === "useState" && ts.isArrayBindingPattern(node.name)) stateNames.push(node.name.elements[0].getText(ast));
      if (node.initializer.expression.text === "useRef" && ts.isIdentifier(node.name)) refNames.push(node.name.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const code = ts.transpileModule(ast.statements.filter((statement) => !ts.isImportDeclaration(statement)).map((statement) => statement.getText(ast)).join("\n"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  return { ast, code, stateNames, refNames };
}
const modules = new Map(Object.values(filenames).map((filename) => [filename, compiled(filename)]));

// Full current component bodies and JSX execute unchanged. Hook bookkeeping is
// deterministic and effects are deliberately inert: no SDK/auth module is
// imported or invoked. Real React serialization proves the rendered structure,
// not browser geometry, native focus, hydration or authentication. The normal
// account-isolation regressions and native browser checks remain separate gates.
function harness(kind: keyof typeof filenames, options: {
  locale?: localeConfig.LocaleCode; host?: HTMLElement | null;
  pathname?: string; states?: Record<string, unknown>;
} = {}) {
  const { code, stateNames, refNames } = modules.get(filenames[kind])!;
  const locale = options.locale ?? "en";
  const host = options.host ?? null;
  const pathname = options.pathname ?? "/dashboard";
  const states = new Map<string, unknown>(Object.entries(kind === "language" ? {
    locale, localeResolved: true, isOpen: true, ...options.states,
  } : {
    userId: syntheticAccount.userId, notificationAccount: syntheticAccount,
    items: [syntheticRow("first"), syntheticRow("last", true)], toast: syntheticRow("toast", true),
    open: true, soundEnabled: false, ...options.states,
  }));
  const refs = new Map<string, { current: unknown }>();
  if (kind === "notifications") refs.set("accountContext", { current: syntheticAccount });
  const timers: Array<() => void> = [];
  const persisted: Array<[string, unknown]> = [];
  const requestedSlots: string[] = [];
  let stateIndex = 0;
  let refIndex = 0;
  let current: React.ReactNode;
  const documentDouble = { activeElement: null as unknown, documentElement: { lang: locale } };
  const browser = {
    location: { pathname, search: "?synthetic=layout", hash: "#synthetic", reload: forbidden, replace: forbidden, assign: forbidden },
    setTimeout(callback: () => void) { timers.push(callback); return timers.length; },
    localStorage: { getItem: forbidden, setItem: (key: string, value: string) => persisted.push([key, value]) },
  };
  const exports: Record<string, unknown> = {};
  const context: Record<string, unknown> = {
    exports, ...localeConfig, ...localeRoutes, ...workflowRoutes, ...runtimeTranslation, ...notificationCopy, ...icons,
    fixedPresentationLocaleBySegment, isCustomerNotificationRuntimePath,
    Link: "a", window: browser, document: documentDouble, fetch: forbidden,
    authenticatedFetch: forbidden, getStableSession: forbidden,
    supabase: new Proxy({}, { get: forbidden }),
    usePathname: () => pathname, useActiveLocale: () => locale,
    usePublicUtilityHost: (slot: string) => { requestedSlots.push(slot); return host; },
    renderPublicUtilityControl,
    useState(initial: unknown) {
      const name = stateNames[stateIndex++]; assert.ok(name, "actual AST state binding");
      if (!states.has(name)) states.set(name, typeof initial === "function" ? (initial as () => unknown)() : initial);
      return [states.get(name), (value: unknown) => states.set(name, typeof value === "function" ? (value as (previous: unknown) => unknown)(states.get(name)) : value)];
    },
    useRef(initial: unknown) {
      const name = refNames[refIndex++]; assert.ok(name, "actual AST ref binding");
      if (!refs.has(name)) refs.set(name, { current: initial }); return refs.get(name);
    },
    useMemo: (calculate: () => unknown) => calculate(),
    useEffect: () => undefined,
    useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
    readStoredLocale: forbidden, readLocaleCookie: forbidden,
    writeStoredLocale: (value: unknown) => persisted.push(["storage", value]),
    writeLocaleCookies: (value: unknown) => persisted.push(["cookie", value]),
    writeDocumentLocale: (value: unknown) => persisted.push(["document", value]),
    dispatchLocaleChange: (value: unknown) => persisted.push(["event", value]),
    require(name: string) { assert.equal(name, "react/jsx-runtime"); return jsxRuntime; },
  };
  for (const target of [context, browser]) for (const name of ["process", "sessionStorage", "credentials", "XMLHttpRequest"]) Object.defineProperty(target, name, { get: forbidden });
  runInNewContext(code, context);
  const component = exports[kind === "language" ? "LanguageSwitcher" : "CustomerNotifications"] as () => React.ReactNode;
  assert.equal(typeof component, "function");
  function render() {
    stateIndex = 0; refIndex = 0; current = component();
    assert.equal(stateIndex, stateNames.length); assert.equal(refIndex, refNames.length); return current;
  }
  render();
  return {
    render, states, refs, documentDouble, persisted, requestedSlots,
    node: () => current, records: () => records(current),
    html: () => renderToStaticMarkup(content(current)),
    drainTimers() { for (const callback of timers.splice(0)) callback(); },
    click(predicate: (props: Props) => boolean) {
      const matches = records(current).filter(({ element }) => predicate(element.props)); assert.equal(matches.length, 1, "one actual control");
      const callback = matches[0].element.props.onClick as () => void; assert.equal(typeof callback, "function"); callback(); render();
    },
  };
}
type Harness = ReturnType<typeof harness>;
function single(h: Harness, predicate: (props: Props) => boolean) {
  const found = h.records().filter(({ element }) => predicate(element.props)); assert.equal(found.length, 1, "one actual node"); return found[0];
}
function ancestors(h: Harness, node: RecordNode) {
  const parents: Element[] = []; let parent = node.parent;
  while (parent) { parents.push(parent); parent = h.records().find(({ element }) => element === parent)?.parent ?? null; }
  return parents;
}
const className = (element: Element) => String(element.props.className ?? "");
function zIndex(element: Element) { const match = className(element).match(/(?:^|\s)z-\[(\d+)\](?:\s|$)/u); assert.ok(match, "explicit actual stacking context"); return Number(match[1]); }
function maximumHeight(element: Element, viewportHeight: number) {
  const token = className(element).split(/\s/u).find((value) => value.startsWith("max-h-["));
  assert.ok(token?.endsWith("]"), "actual unprefixed maximum-height class must bound the overlay");
  const expression = token.slice(7, -1).replace(/_/gu, " ")
    .replace(/(\d+(?:\.\d+)?)(dvh|vh|rem|px)/gu, (_match, amount: string, unit: string) => String(Number(amount) * (unit === "rem" ? 16 : unit === "px" ? 1 : viewportHeight / 100)))
    .replace(/\bcalc\(/gu, "(").replace(/\bmin\(/gu, "Math.min(").replace(/\bmax\(/gu, "Math.max(");
  assert.match(expression.replace(/Math\.(?:min|max)/gu, ""), /^[\d\s.+*/(),-]+$/u, "only numeric CSS math is evaluated, never executable product input");
  const result: unknown = runInNewContext(expression, { Math: Object.freeze({ min: Math.min, max: Math.max }) });
  assert.equal(typeof result, "number"); assert.ok(Number.isFinite(result)); return result as number;
}
const nativeLocales = ["en", "de", "tr", "zh"] as const;

function nonClassSourceFingerprint(file: string) {
  const ast = modules.get(file)!.ast;
  const withoutAllowedImport = file === filenames.language
    ? ts.factory.updateSourceFile(ast, ast.statements.filter((statement) => !isExactPrivateRuntimeImport(statement)))
    : ast;
  const normalized = ts.transform(withoutAllowedImport, [(context) => (node) => {
    function visit(current: ts.Node): ts.VisitResult<ts.Node> {
      if (ts.isJsxAttribute(current) && current.name.getText(ast) === "className") return ts.factory.updateJsxAttribute(current, current.name, ts.factory.createStringLiteral("__CSS_LAYOUT_CONTRACT__"));
      return ts.visitEachChild(current, visit, context);
    }
    return ts.visitNode(node, visit) as ts.SourceFile;
  }]).transformed[0];
  return createHash("sha256").update(ts.createPrinter({ removeComments: true }).printFile(normalized).replace(/\r\n/gu, "\n")).digest("hex");
}
function isExactPrivateRuntimeImport(node: ts.Node) {
  if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier) || node.moduleSpecifier.text !== "@/lib/customerNotificationRuntime") return false;
  const bindings = node.importClause?.namedBindings;
  assert.ok(bindings && ts.isNamedImports(bindings));
  assert.equal(node.importClause?.name, undefined); assert.equal(bindings.elements.length, 1);
  assert.equal(bindings.elements[0].name.text, "isCustomerNotificationRuntimePath");
  assert.equal(bindings.elements[0].propertyName, undefined);
  return true;
}

test("overlay repair preserves all non-class source, including copy, aria, links, account guards and handlers", () => {
  // Captured from clean9c677c9 before implementation. Unlike runtime Git reads,
  // these exact AST contracts also work in shallow CI checkouts. Class values
  // are covered behaviorally below; no logic/markup/source exception is allowed.
  assert.equal(nonClassSourceFingerprint(filenames.language), "761bc13852fc7a3907cbd3a581954f861d9f66367acc195ee8a9f819efea9992");
  assert.equal(nonClassSourceFingerprint(filenames.notifications), "527b4cdd0a08d36a007c0fff28df4869a43679336290d7e94a0b8c8435e0c850");
});

test("private language wrapper owns a higher stacking context than the actual notification overlay", () => {
  for (const locale of nativeLocales) {
    const language = harness("language", { locale }); const notifications = harness("notifications", { locale });
    const wrapper = single(language, (props) => props["data-language-switcher"] !== undefined).element;
    const notificationRoot = notifications.records()[0].element;
    assert.match(className(wrapper), /fixed bottom-4 right-4/u);
    assert.match(className(notificationRoot), /fixed right-4 top-20/u);
    assert.equal(zIndex(notificationRoot), 95, "do not solve menu coexistence by weakening the notification layer");
    assert.ok(zIndex(wrapper) > zIndex(notificationRoot), "the outer private language stacking context must win; an inner popup z-index cannot escape z80");
    const menu = single(language, (props) => props.role === "menu").element;
    assert.match(className(menu), /overflow-y-auto/u);
    assert.equal(ancestors(language, single(language, (props) => props.role === "menu")).includes(wrapper), true);
  }
});

test("private layering uses only the existing exact route helper and leaves other fallback documents at80", () => {
  const ast = modules.get(filenames.language)!.ast;
  assert.equal(ast.statements.filter(isExactPrivateRuntimeImport).length, 1, "one reviewed pure helper import, not a new private-route classifier");
  const references: ts.Identifier[] = [];
  function visit(node: ts.Node) {
    if (ts.isIdentifier(node) && node.text === "isCustomerNotificationRuntimePath" && !ts.isImportSpecifier(node.parent)) references.push(node);
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.equal(references.length, 2, "only pending/resolved className expressions use the helper");
  for (const reference of references) {
    let parent: ts.Node | undefined = reference.parent;
    while (parent && !ts.isJsxAttribute(parent)) parent = parent.parent;
    assert.ok(parent && ts.isJsxAttribute(parent)); assert.equal(parent.name.getText(ast), "className");
  }
  for (const pathname of ["/tools", "/file-service", "/login", "/register", "/contact"]) {
    const h = harness("language", { pathname });
    assert.equal(zIndex(single(h, (props) => props["data-language-switcher"] !== undefined).element), 80);
  }
  for (const pathname of ["/dashboard", "/dashboard/orders/synthetic", "/new-request", "/payment/synthetic"]) {
    for (const localeResolved of [false, true]) {
      const h = harness("language", { pathname, states: { localeResolved } });
      assert.ok(zIndex(single(h, (props) => props["data-language-switcher"] !== undefined).element) > 95);
    }
  }
});

test("toast, bell and normal-flow notification panel share a bounded viewport budget with independent scrolling", () => {
  for (const locale of nativeLocales) {
    const h = harness("notifications", { locale });
    const root = h.records()[0].element;
    assert.match(className(root), /\bmin-h-0\b/u); assert.match(className(root), /\bpointer-events-none\b/u);
    assert.doesNotMatch(className(root), /\bbottom-\d+\b|\bh-full\b/u, "do not stretch an invisible hitbox across the page");
    const center = single(h, (props) => props.href === "/dashboard/notifications");
    const [footer, panel, bellWrapper, actualRoot] = ancestors(h, center);
    assert.equal(actualRoot, root);
    assert.match(className(bellWrapper), /\brelative\b/u); assert.match(className(bellWrapper), /\bflex\b/u); assert.match(className(bellWrapper), /\bmin-h-0\b/u);
    assert.match(className(panel), /\bflex\b/u); assert.match(className(panel), /\bflex-col\b/u); assert.match(className(panel), /\bmin-h-0\b/u);
    assert.match(className(panel), /\boverflow-y-auto\b/u); assert.match(className(panel), /\bpointer-events-auto\b/u);
    assert.doesNotMatch(className(panel), /\babsolute\b|\bfixed\b/u, "an out-of-flow panel would ignore the root's remaining-height budget");
    const header = React.Children.toArray(panel.props.children).find(React.isValidElement) as Element;
    assert.match(className(header), /\bshrink-0\b/u); assert.match(className(footer), /\bshrink-0\b/u);
    const list = single(h, (props) => String(props.className).includes("max-h-[60vh]"));
    assert.equal(list.parent, panel); assert.match(className(list.element), /\bmin-h-0\b/u); assert.match(className(list.element), /\bflex-1\b/u); assert.match(className(list.element), /\boverflow-y-auto\b/u);
    assert.ok(className(list.element).split(/\s/u).includes("[@media(max-height:32rem)]:flex-none"), "very short views use the outer-panel scroll fallback instead of clipping fixed chrome");
    const bell = single(h, (props) => props["aria-label"] === "Notifications").element;
    assert.match(className(bell), /\bshrink-0\b/u); assert.match(className(bell), /\bpointer-events-auto\b/u);
    const close = single(h, (props) => props["aria-label"] === "Close notification");
    const toast = ancestors(h, close)[1];
    assert.match(className(toast), /\bshrink-0\b/u); assert.match(className(toast), /\bpointer-events-auto\b/u); assert.match(className(toast), /\boverflow-y-auto\b/u);
    // Evaluate numeric math from the actual rendered CSS classes, not a copied
    // rectangle model. Equivalent rem/px/vh expressions are acceptable. The
    // native browser gate separately proves computed CSS and actual geometry.
    for (const height of [720, 844, 480]) {
      const cap = maximumHeight(root, height); const toastCap = maximumHeight(toast, height);
      assert.ok(cap > 0); assert.ok(cap + 5 * 16 <= height - 60, "top20 plus overlay budget reserves the44px bottom trigger and16px margin");
      assert.ok(toastCap > 0 && toastCap <= Math.min(12 * 16, cap / 3) + 0.001, "toast consumes at most the reviewed responsive budget, leaving room for other flex children");
    }
  }
});

test("public header-hosted language control remains normal-flow and keeps its exact popup classes", () => {
  const host = { nodeType: 1, isConnected: true } as unknown as HTMLElement;
  for (const locale of nativeLocales) {
    const h = harness("language", { locale, host, pathname: "/file-service" });
    assert.equal(isPortal(h.node()), true, "actual renderPublicUtilityControl portals into the opted-in header host");
    const wrapper = single(h, (props) => props["data-language-switcher"] !== undefined).element;
    assert.equal(className(wrapper), "relative flex flex-col items-end gap-2");
    const menu = single(h, (props) => props.role === "menu").element;
    assert.equal(className(menu), "absolute right-0 top-[calc(100%+.5rem)] z-[80] max-h-[min(31rem,calc(100dvh-13rem))] grid w-56 overflow-y-auto rounded-2xl border border-white/10 bg-[#111720]/98 p-2 shadow-2xl shadow-black/50 backdrop-blur-xl");
    assert.doesNotMatch(h.html(), /\bfixed\b/u);
    assert.equal(h.requestedSlots[0], "language");
  }
});

test("all12 language choices, selected state, loading/error/retry and native key handlers stay accessible", () => {
  for (const { code } of localeConfig.supportedLocales) {
    const h = harness("language", { locale: code });
    const radios = h.records().filter(({ element }) => element.props.role === "menuitemradio");
    assert.equal(radios.length, 12); assert.equal(radios.filter(({ element }) => element.props["aria-checked"] === true).length, 1);
    for (const { element } of radios) { assert.match(className(element), /min-h-11/u); assert.equal(typeof element.props.onClick, "function"); assert.ok(element.props["aria-label"]); }
    const trigger = single(h, (props) => props["aria-haspopup"] === "menu").element;
    assert.equal(trigger.props["aria-expanded"], true); assert.equal(trigger.props["aria-controls"], "mg-language-menu"); assert.equal(typeof trigger.props.onKeyDown, "function");
    assert.equal(typeof single(h, (props) => props.role === "menu").element.props.onKeyDown, "function");
    h.click((props) => props["aria-haspopup"] === "menu"); assert.equal(h.states.get("isOpen"), false);
    h.click((props) => props["aria-haspopup"] === "menu"); assert.equal(h.states.get("isOpen"), true);
    const choice = radios.find(({ element }) => element.props.title === (code === "de" ? "English" : "Deutsch"))!.element;
    (choice.props.onClick as () => void)(); h.render();
    assert.equal(h.states.get("isOpen"), false); assert.equal(h.states.get("isLocaleLoading"), true);
    assert.equal(single(h, (props) => props.role === "status").element.props["aria-live"], "polite");
    assert.equal(h.persisted.length, 0, "private runtime choice does not invent public navigation or eager persistence");
    h.states.set("failedLocale", "de"); h.states.set("isLocaleLoading", false); h.render();
    const alert = single(h, (props) => props.role === "alert").element; assert.ok(text(alert));
    h.click((props) => props.type === "button" && text(props.children) === text(records(alert).find(({ element }) => element.type === "button")!.element.props.children));
    assert.equal(h.states.get("failedLocale"), null); assert.equal(h.states.get("isLocaleLoading"), true); assert.equal(h.states.get("retryAttempt"), 1);
  }
});

test("actual notification views keep last-item/order/center links, status, retry, toast dismissal and bell state", () => {
  for (const locale of nativeLocales) {
    const h = harness("notifications", { locale }); const html = h.html();
    assert.ok(html.includes("/dashboard/orders/synthetic-order-last")); assert.ok(html.includes("/dashboard/notifications"));
    assert.ok(html.includes(notificationCopy.localizeCustomerNotification(locale, syntheticRow("last", true)).title));
    assert.equal(typeof single(h, (props) => props.title === "Mark all as read").element.props.onClick, "function");
    h.click((props) => props["aria-label"] === "Close notification"); assert.equal(h.states.get("toast"), null);
    h.click((props) => props["aria-label"] === "Notifications"); assert.equal(h.states.get("open"), false);
    h.click((props) => props["aria-label"] === "Notifications"); assert.equal(h.states.get("open"), true);
    h.states.set("items", []); h.states.set("notificationLoading", true); h.render();
    assert.equal(single(h, (props) => props.role === "status").element.props["aria-live"], "polite");
    h.states.set("notificationLoading", false); h.states.set("notificationLoadError", "Notifications could not be loaded. Please try again."); h.render();
    assert.ok(text(single(h, (props) => props.role === "alert").element).includes("Notification sync failed"));
    h.click((props) => props.type === "button" && text(props.children) === "Try again");
    assert.equal(h.states.get("notificationLoading"), true); assert.equal(h.states.get("notificationLoadError"), null); assert.equal(h.states.get("notificationRefreshKey"), 1);
    h.states.set("notificationLoading", false); h.render(); assert.ok(h.html().includes("No notifications yet."));
  }
});

test("actual private menu key handlers preserve navigation, selection and Escape focus restoration", () => {
  const h = harness("language");
  const radios = h.records().filter(({ element }) => element.props.role === "menuitemradio").map(({ element }) => element);
  let triggerFocus = 0;
  const targets = radios.map((element) => ({
    focus() { h.documentDouble.activeElement = this; },
    click() { (element.props.onClick as () => void)(); },
  }));
  h.refs.get("menuRef")!.current = {
    querySelectorAll(selector: string) { assert.equal(selector, '[role="menuitemradio"]'); return targets; },
  };
  h.refs.get("triggerRef")!.current = { focus() { triggerFocus += 1; } };
  const handler = single(h, (props) => props.role === "menu").element.props.onKeyDown as (event: { key: string; preventDefault: () => void }) => void;
  function key(value: string) {
    let prevented = false; handler({ key: value, preventDefault() { prevented = true; } }); return prevented;
  }
  h.documentDouble.activeElement = targets[0];
  assert.equal(key("ArrowDown"), true); assert.equal(h.documentDouble.activeElement, targets[1]);
  assert.equal(key("ArrowUp"), true); assert.equal(h.documentDouble.activeElement, targets[0]);
  assert.equal(key("End"), true); assert.equal(h.documentDouble.activeElement, targets.at(-1));
  assert.equal(key("Home"), true); assert.equal(h.documentDouble.activeElement, targets[0]);
  assert.equal(key("Tab"), false, "leave native Tab behavior untouched");
  assert.equal(key(" "), true); assert.equal(h.states.get("requestedLocale"), localeConfig.supportedLocales[0].code);
  assert.equal(h.states.get("isOpen"), false); assert.equal(h.states.get("isLocaleLoading"), true);
  assert.equal(key("Escape"), true); assert.equal(triggerFocus, 1);
  h.render();
  const trigger = single(h, (props) => props["aria-haspopup"] === "menu").element.props.onKeyDown as (event: { key: string; preventDefault: () => void }) => void;
  let prevented = false; trigger({ key: "ArrowUp", preventDefault() { prevented = true; } });
  assert.equal(prevented, true); assert.equal(h.states.get("isOpen"), true);
});

test("overlay layout does not expand notification runtime into public or measurement documents", () => {
  for (const route of ["/dashboard", "/dashboard/orders/synthetic", "/new-request", "/payment/synthetic"]) assert.equal(isCustomerNotificationRuntimePath(route), true);
  for (const route of ["/", "/file-service", "/de/file-service", "/tools", "/admin", "/embed/widget", "/measurement/register"]) assert.equal(isCustomerNotificationRuntimePath(route), false);
  for (const route of ["/admin", "/admin/orders", "/embed/widget"]) assert.equal(harness("notifications", { pathname: route }).node(), null);
});
