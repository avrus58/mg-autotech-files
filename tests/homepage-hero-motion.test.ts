import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import * as icons from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { buildHomepageTranslationCatalog } from "../src/lib/homepageTranslationCatalog";
import {
  HomepageLocalizationProvider,
  LocalizedHomepageTree,
  localizeHomepageHref,
} from "../src/lib/homepageLocalization";
import { supportedLocales, type LocaleCode } from "../src/lib/i18nConfig";

const source = readFileSync("src/components/homepage/HomepageExperience.tsx", "utf8");
const ast = ts.createSourceFile("HomepageExperience.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const previewFunction = ast.statements.find(
  (statement): statement is ts.FunctionDeclaration => ts.isFunctionDeclaration(statement) && statement.name?.text === "HeroProductPreview",
);
assert.ok(previewFunction, "test the real homepage preview, not a duplicated demonstration component");
const compiledPreview = ts.transpileModule(
  `${previewFunction.getText(ast)}\nexports.HeroProductPreview = HeroProductPreview;`,
  { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } },
).outputText;

type PreviewProps = Record<string, unknown> & { children?: React.ReactNode };
type PreviewElement = React.ReactElement<PreviewProps>;
type ButtonProps = PreviewProps & {
  id: string;
  tabIndex: number;
  onClick(): void;
  onKeyDown(event: { key: string; preventDefault(): void }): void;
  ref?: (element: { focus(): void } | null) => void;
};

function descendants(node: React.ReactNode): PreviewElement[] {
  if (!React.isValidElement(node)) return [];
  const element = node as PreviewElement;
  return [element, ...React.Children.toArray(element.props.children).flatMap(descendants)];
}

// Execute the actual component and its handlers with deterministic hooks. This
// does not simulate a browser's native Enter/Space activation or CSS rendering;
// those remain explicit browser acceptance checks.
function previewHarness(locale: LocaleCode = "en") {
  const states: unknown[] = [];
  const refs: Array<{ current: unknown }> = [];
  let stateIndex = 0;
  let refIndex = 0;
  let focusedStage: number | null = null;
  const exports: { HeroProductPreview?: () => React.ReactNode } = {};
  const noExternalWork = () => { throw new Error("An illustrative homepage preview must not use a timer, network, storage or customer data."); };
  const context = {
    exports,
    ...icons,
    LocalizedHomepageTree,
    Link: ({ children, ...props }: PreviewProps) => React.createElement("a", props, children),
    useState(initial: unknown) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = typeof initial === "function" ? (initial as () => unknown)() : initial;
      return [states[index], (next: unknown) => {
        states[index] = typeof next === "function" ? (next as (previous: unknown) => unknown)(states[index]) : next;
      }];
    },
    useRef(initial: unknown) {
      const index = refIndex++;
      return refs[index] ?? (refs[index] = { current: initial });
    },
    setTimeout: noExternalWork,
    setInterval: noExternalWork,
    fetch: noExternalWork,
    require(name: string) {
      assert.equal(name, "react/jsx-runtime", `Unexpected preview dependency ${name}`);
      return jsxRuntime;
    },
  };
  runInNewContext(compiledPreview, context);
  assert.ok(exports.HeroProductPreview);
  let current: React.ReactNode;
  function render() {
    stateIndex = 0;
    refIndex = 0;
    current = exports.HeroProductPreview!();
    const buttons = descendants(current).filter((element) => element.type === "button");
    buttons.forEach((button, index) => {
      const ref = button.props.ref;
      if (typeof ref === "function") ref({ focus() { focusedStage = index; } });
    });
    return current;
  }
  render();
  return {
    buttons: () => descendants(current).filter((element) => element.type === "button") as React.ReactElement<ButtonProps>[],
    panel: () => descendants(current).find((element) => element.props.role === "tabpanel"),
    render,
    focused: () => focusedStage,
    html: () => renderToStaticMarkup(React.createElement(
      HomepageLocalizationProvider,
      { locale, catalog: buildHomepageTranslationCatalog(locale) } as React.ComponentProps<typeof HomepageLocalizationProvider>,
      current,
    )),
  };
}

function selectedStage(harness: ReturnType<typeof previewHarness>) {
  const tabs = harness.buttons();
  assert.equal(tabs.length, 3);
  const selected = tabs.map((button, index) => button.props["aria-selected"] === true ? index : -1).filter((index) => index >= 0);
  assert.equal(selected.length, 1, "exactly one illustrative step is selected");
  tabs.forEach((button, index) => {
    assert.equal(button.props.type, "button");
    assert.equal(button.props.role, "tab");
    assert.equal(button.props.id, `homepage-preview-step-${index}`);
    assert.equal(button.props["aria-controls"], "homepage-preview-panel");
    assert.equal(button.props.tabIndex, index === selected[0] ? 0 : -1);
  });
  const panel = harness.panel();
  assert.ok(panel);
  assert.equal(panel.props.id, "homepage-preview-panel");
  assert.equal(panel.props["aria-labelledby"], `homepage-preview-step-${selected[0]}`);
  assert.equal(panel.props.tabIndex, 0);
  return selected[0];
}

function escapeRenderedText(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
}

test("actual preview SSR defaults to completed delivery, remains visible, and has accessible manually selected stages", () => {
  const harness = previewHarness();
  assert.equal(selectedStage(harness), 2);
  const html = harness.html();
  assert.match(html, /role="tablist"/u);
  assert.match(html, /aria-label="Example request stages"/u);
  assert.match(html, /Completed file/u);
  assert.match(html, /PDF after completion/u);
  assert.match(html, /Illustrative preview\. No customer data\./u);
  assert.doesNotMatch(html, /<[^>]+\shidden(?:=|\s|>)|aria-hidden="true"[^>]*role="tabpanel"|style="[^"]*(?:opacity:\s*0|visibility:\s*hidden|display:\s*none)/u);
});

test("actual example stage clicks change only local illustrated content, with no autoplay or fake download action", () => {
  const harness = previewHarness();
  const panels: string[] = [];
  for (const stage of [0, 1, 2, 0, 2]) {
    harness.buttons()[stage].props.onClick();
    harness.render();
    assert.equal(selectedStage(harness), stage);
    const html = harness.html();
    panels.push(html);
    assert.match(html, /Example preview/u);
    assert.match(html, /Illustrative preview\. No customer data\./u);
    assert.doesNotMatch(html, /<(?:form|input|iframe|object|embed)\b|\bdownload=|href="(?:blob:|data:)/u);
    assert.equal((html.match(/<a\b/gu) ?? []).length, 1);
    if (stage < 2) assert.doesNotMatch(html, /Your completed file is ready in your account\./u);
  }
  assert.notEqual(panels[0], panels[1]);
  assert.notEqual(panels[1], panels[2]);
  const actualSource = previewFunction!.getText(ast);
  assert.doesNotMatch(actualSource, /\b(?:setTimeout|setInterval|requestAnimationFrame|fetch|useEffect)\s*\(|window\.|document\.|localStorage|sessionStorage|authenticatedFetch|ServiceReportDownload/u);
});

test("actual Arrow/Home/End handlers wrap selected step and move focus; unrelated keys do not change state", () => {
  const harness = previewHarness();
  const cases = [
    { key: "ArrowRight", expected: 0 },
    { key: "ArrowLeft", expected: 2 },
    { key: "Home", expected: 0 },
    { key: "End", expected: 2 },
    { key: "ArrowLeft", expected: 1 },
    { key: "ArrowLeft", expected: 0 },
  ];
  for (const { key, expected } of cases) {
    let prevented = false;
    harness.buttons()[selectedStage(harness)].props.onKeyDown({ key, preventDefault() { prevented = true; } });
    harness.render();
    assert.equal(prevented, true, `${key}: prevent page scroll while operating the stage selector`);
    assert.equal(selectedStage(harness), expected, key);
    assert.equal(harness.focused(), expected, `${key}: focus follows the active tab`);
  }
  for (const key of ["Tab", "Escape", "a"]) {
    let prevented = false;
    harness.buttons()[0].props.onKeyDown({ key, preventDefault() { prevented = true; } });
    harness.render();
    assert.equal(prevented, false, key);
    assert.equal(selectedStage(harness), 0, key);
  }
});

test("every actual interactive preview state retains scoped first-paint localization in all 12 languages", () => {
  const sourceStrings = ["Example preview", "Example request stages", "Choose a step to explore the example.", "Illustrative preview. No customer data.", "How It Works"];
  const stageMessages = [
    "This example starts with an original file and request details.",
    "Vehicle, ECU and selected service are reviewed together.",
    "Your completed file is ready in your account.",
  ];
  for (const { code } of supportedLocales) {
    const harness = previewHarness(code);
    const catalog = buildHomepageTranslationCatalog(code);
    for (const stage of [0, 1, 2]) {
      harness.buttons()[stage].props.onClick();
      harness.render();
      assert.equal(selectedStage(harness), stage);
      const html = harness.html();
      for (const text of [...sourceStrings, stageMessages[stage]]) {
        const translated = code === "en" ? text : catalog!.exact[text];
        assert.ok(translated, `${code}: exact translation missing for ${text}`);
        assert.ok(html.includes(escapeRenderedText(translated)), `${code}: stage ${stage} omitted ${text}`);
        if (code !== "en") {
          assert.notEqual(translated, text, `${code}: clean English fallback ${text}`);
          assert.ok(!html.includes(escapeRenderedText(text)), `${code}: stage ${stage} leaks ${text}`);
        }
      }
      assert.ok(html.includes(`href="${localizeHomepageHref("/how-it-works", code)}"`));
    }
  }
});

type RevealNode = { attributes: Map<string, string>; writes: number; setAttribute(name: string, value: string): void; removeAttribute(name: string): void };
type RevealEntry = { target: RevealNode; isIntersecting: boolean };
type ObserverCallback = (entries: RevealEntry[], observer: FakeObserver) => void;
type FakeObserver = { callback: ObserverCallback; observed: Set<RevealNode>; unobserved: RevealNode[]; disconnected: boolean; observe(node: RevealNode): void; unobserve(node: RevealNode): void; disconnect(): void };

function revealHarness(options: { reduced?: boolean; noWindow?: boolean; noMatchMedia?: boolean; noObserver?: boolean } = {}) {
  let preference = options.reduced ?? false;
  const listeners = new Set<() => void>();
  const observers: FakeObserver[] = [];
  const targets: RevealNode[] = Array.from({ length: 2 }, () => ({
    attributes: new Map(), writes: 0,
    setAttribute(name, value) { this.attributes.set(name, value); this.writes += 1; },
    removeAttribute(name) { this.attributes.delete(name); },
  }));
  let queryCount = 0;
  const root = { querySelectorAll(selector: string) { queryCount += 1; assert.equal(selector, "[data-homepage-reveal]"); return targets; } };
  const media = {
    get matches() { return preference; },
    addEventListener(name: string, listener: () => void) { assert.equal(name, "change"); listeners.add(listener); },
    removeEventListener(name: string, listener: () => void) { assert.equal(name, "change"); listeners.delete(listener); },
  };
  class Observer implements FakeObserver {
    observed = new Set<RevealNode>();
    unobserved: RevealNode[] = [];
    disconnected = false;
    constructor(public callback: ObserverCallback, config: { threshold: number }) {
      assert.equal(config.threshold, 0.12);
      observers.push(this);
    }
    observe(node: RevealNode) { this.observed.add(node); }
    unobserve(node: RevealNode) { this.unobserved.push(node); this.observed.delete(node); }
    disconnect() { this.disconnected = true; this.observed.clear(); }
  }
  const revealSource = readFileSync("src/lib/homepageMotion.ts", "utf8");
  const compiled = ts.transpileModule(revealSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: { observeHomepageReveals?: (root: unknown) => () => void } = {};
  const context: Record<string, unknown> = { exports };
  if (!options.noWindow) context.window = {
    ...(!options.noMatchMedia && { matchMedia(query: string) { assert.equal(query, "(prefers-reduced-motion: reduce)"); return media; } }),
    ...(!options.noObserver && { IntersectionObserver: Observer }),
  };
  runInNewContext(compiled, context);
  assert.ok(exports.observeHomepageReveals);
  const cleanup = exports.observeHomepageReveals(root);
  return {
    cleanup, targets, observers,
    queries: () => queryCount,
    listeners: () => listeners.size,
    preference(reduced: boolean) { preference = reduced; listeners.forEach((listener) => listener()); },
    emit(observer: FakeObserver, target: RevealNode, isIntersecting = true) { observer.callback([{ target, isIntersecting }], observer); },
  };
}

test("actual progressive reveal is optional for SSR, missing browser APIs and reduced-motion first paint", () => {
  for (const options of [{ noWindow: true }, { noMatchMedia: true }, { noObserver: true }]) {
    const harness = revealHarness(options);
    assert.equal(harness.observers.length, 0);
    assert.equal(harness.queries(), 0);
    assert.equal(harness.listeners(), 0);
    assert.doesNotThrow(harness.cleanup);
    assert.ok(harness.targets.every((target) => target.attributes.size === 0 && target.writes === 0));
  }
  const reduced = revealHarness({ reduced: true });
  assert.equal(reduced.observers.length, 0);
  assert.ok(reduced.targets.every((target) => target.attributes.size === 0 && target.writes === 0));
  reduced.cleanup();
  assert.equal(reduced.listeners(), 0);
});

test("actual reveal marks only intersecting sections and tears down both observer and preference listener", () => {
  const harness = revealHarness();
  assert.equal(harness.observers.length, 1);
  const observer = harness.observers[0];
  assert.equal(observer.observed.size, 2);
  assert.equal(harness.listeners(), 1);
  harness.emit(observer, harness.targets[0], false);
  assert.equal(harness.targets[0].writes, 0);
  harness.emit(observer, harness.targets[0]);
  assert.equal(harness.targets[0].attributes.get("data-homepage-revealed"), "true");
  assert.equal(observer.observed.has(harness.targets[0]), false);
  assert.equal(observer.unobserved[0], harness.targets[0]);
  assert.equal(harness.targets[1].writes, 0);
  harness.cleanup();
  assert.equal(observer.disconnected, true);
  assert.equal(harness.listeners(), 0);
  assert.ok(harness.targets.every((target) => target.attributes.size === 0));
});

test("actual reduced-motion preference changes stop reveals immediately and re-enable optional finite reveals", () => {
  const harness = revealHarness({ reduced: true });
  harness.preference(false);
  assert.equal(harness.observers.length, 1);
  harness.emit(harness.observers[0], harness.targets[0]);
  harness.preference(true);
  assert.equal(harness.observers[0].disconnected, true);
  assert.ok(harness.targets.every((target) => target.attributes.size === 0));
  harness.preference(false);
  assert.equal(harness.observers.length, 2);
  assert.equal(harness.observers[1].observed.size, 2);
  harness.cleanup();
  assert.equal(harness.observers[1].disconnected, true);
  assert.equal(harness.listeners(), 0);
});

test("actual stale observer callbacks cannot restore a reveal after preference change, replacement or unmount", () => {
  const harness = revealHarness();
  const original = harness.observers[0];
  harness.preference(true);
  harness.emit(original, harness.targets[0]);
  assert.equal(harness.targets[0].writes, 0, "a queued callback cannot start an effect after reduced motion is enabled");
  harness.preference(false);
  const replacement = harness.observers[1];
  harness.emit(original, harness.targets[0]);
  assert.equal(harness.targets[0].writes, 0, "a disconnected observer cannot mutate the replacement generation");
  harness.emit(replacement, harness.targets[0]);
  assert.equal(harness.targets[0].writes, 1);
  harness.cleanup();
  harness.emit(replacement, harness.targets[1]);
  assert.equal(harness.targets[1].writes, 0, "unmounted content stays untouched by a queued callback");
  assert.ok(harness.targets.every((target) => target.attributes.size === 0));
});

test("homepage motion remains scoped, finite, SSR-visible and reduced-motion aware without heavy runtime dependencies", () => {
  const styles = readFileSync("src/app/globals.css", "utf8");
  assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)/u);
  assert.match(styles, /\.mg-homepage-[\s\S]*?animation:\s*none/u);
  assert.match(styles, /\.mg-homepage-[\s\S]*?transform:\s*none/u);
  assert.doesNotMatch(styles.slice(styles.indexOf(".mg-homepage-")), /animation(?:-iteration-count)?\s*:[^;}]*\binfinite\b/u);
  assert.doesNotMatch(source, /from\s*["'](?:framer-motion|gsap|@react-three\/fiber)["']/u);
  assert.doesNotMatch(previewFunction!.getText(ast), /\b(?:setTimeout|setInterval|requestAnimationFrame)\s*\(/u);
});
