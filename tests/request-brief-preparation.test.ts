import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import * as icons from "lucide-react";
import ts from "typescript";
import { renderToStaticMarkup } from "react-dom/server";
import { buildRequestBriefCopy } from "../src/lib/i18n/tool-client-copy";
import { intlLocaleByCode, supportedLocales, type LocaleCode } from "../src/lib/i18nConfig";
import { getRequestBriefPreparation } from "../src/lib/requestBriefPreparation";
import { buildNewRequestPath, parseRequestIntent } from "../src/lib/requestIntent";
import { buildAuthEntryPath } from "../src/lib/safeLocalRedirect";

const builderPath = "src/components/tools/RequestBriefBuilder.tsx";
const currentSource = readFileSync(builderPath, "utf8");
const goals = ["Stage 1 performance", "Stage 2 / hardware changes", "TCU / gearbox support", "DTC request preparation", "Aftertreatment service request", "Diagnostic / custom file support"];
const paths = ["/new-request?intent=stage_1", "/new-request?intent=stage_2", "/new-request?intent=tcu_stage_1", "/new-request?intent=dtc_off", "/new-request", "/new-request"];
const base = { vehicle: "Synthetic BMW", engine: "B57", year: "2021", notes: "Synthetic preparation context", hardware: "", faultCodes: "", serviceGoal: goals[0] };
type Props = Record<string, unknown> & { children?: React.ReactNode };
type Element = React.ReactElement<Props>;

function descendants(node: React.ReactNode): Element[] {
  if (!React.isValidElement(node)) return [];
  const element = node as Element;
  const children: Element[] = [];
  React.Children.forEach(element.props.children, (child) => children.push(...descendants(child)));
  return [element, ...children];
}
function text(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  if (!React.isValidElement(node)) return "";
  return React.Children.toArray((node as Element).props.children).map(text).join("");
}
function plain<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }

// Execute the real source, JSX, field callbacks and clipboard handler. Only hooks
// and external browser effects are deterministic. Native focus/layout need GUI QA.
function harness(locale: LocaleCode = "en", source = currentSource) {
  const ast = ts.createSourceFile(builderPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const compiled = ts.transpileModule(ast.statements.filter((statement) => !ts.isImportDeclaration(statement)).map((statement) => statement.getText(ast)).join("\n"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const states: unknown[] = [];
  let index = 0;
  let activeLocale = locale;
  let current: React.ReactNode;
  let clipboardFails = false;
  const copied: string[] = [];
  const timers: Array<() => void> = [];
  const exports: { RequestBriefBuilder?: (props: { copy: ReturnType<typeof buildRequestBriefCopy>; locale: LocaleCode }) => React.ReactNode } = {};
  const forbidden = () => { throw new Error("The preparation tool must not access network, storage, files, accounts or browser documents."); };
  const context: Record<string, unknown> = {
    exports, ...icons, intlLocaleByCode, getRequestBriefPreparation,
    Link: ({ children, ...props }: Props) => React.createElement("a", props, children),
    useCallback: (callback: unknown) => callback,
    useMemo: (calculate: () => unknown) => calculate(),
    useState(initial: unknown) {
      const slot = index++;
      if (!(slot in states)) states[slot] = typeof initial === "function" ? (initial as () => unknown)() : initial;
      return [states[slot], (value: unknown) => { states[slot] = typeof value === "function" ? (value as (previous: unknown) => unknown)(states[slot]) : value; }];
    },
    navigator: { clipboard: { async writeText(value: string) { if (clipboardFails) throw new Error("Synthetic clipboard failure"); copied.push(value); } } },
    window: { setTimeout(callback: () => void) { timers.push(callback); return timers.length; } },
    fetch: forbidden,
    require(name: string) { assert.equal(name, "react/jsx-runtime"); return jsxRuntime; },
  };
  for (const name of ["document", "localStorage", "sessionStorage", "FileReader"]) Object.defineProperty(context, name, { get: forbidden });
  runInNewContext(compiled, context);
  assert.ok(exports.RequestBriefBuilder);
  const elements = () => descendants(current);
  function render(nextLocale = activeLocale) {
    activeLocale = nextLocale;
    index = 0;
    current = exports.RequestBriefBuilder!({ copy: buildRequestBriefCopy(activeLocale), locale: activeLocale });
    return current;
  }
  render();
  const copy = () => buildRequestBriefCopy(activeLocale);
  function field(sourceLabel: string) {
    const value = elements().find((element) => element.props.label === copy()[sourceLabel as keyof ReturnType<typeof copy>]);
    assert.ok(value, `actual field ${sourceLabel}`);
    return value;
  }
  return {
    elements, render,
    html: () => renderToStaticMarkup(current),
    scoreText: () => text(elements().find((element) => String(element.props.className).includes("text-5xl"))?.props.children),
    progress: () => elements().find((element) => element.props.role === "progressbar"),
    brief: () => text(elements().find((element) => element.type === "pre")?.props.children),
    href: () => elements().find((element) => text(element.props.children) === copy()["Open Secure Request Form"])?.props.href,
    missingText: () => text(elements().find((element) => String(element.props.className).includes("text-amber-100"))?.props.children),
    status: () => text(elements().find((element) => element.type === "button")?.props.children),
    options: () => field("Requested service").props.options,
    readMethods: () => field("Read tool / method").props.options,
    value: (label: string) => field(label).props.value,
    edit(label: string, value: string) { (field(label).props.onChange as (value: string) => void)(value); render(); },
    async copy(fail = false) {
      clipboardFails = fail;
      const button = elements().find((element) => element.type === "button");
      assert.ok(button);
      (button.props.onClick as () => void)();
      await new Promise<void>((resolve) => setImmediate(resolve)); render();
      return copied;
    },
    resetCopy() { const callback = timers.shift(); assert.ok(callback); callback(); render(); },
  };
}
function fillBase(h: ReturnType<typeof harness>) {
  h.edit("Vehicle", base.vehicle);
  h.edit("Engine / engine code", base.engine);
  h.edit("Model year", base.year);
  h.edit("Additional notes", base.notes);
}

test("empty and whitespace preparation is zero, with one shared required-field set", () => {
  for (const serviceGoal of goals) {
    const result = getRequestBriefPreparation({ ...base, vehicle: " ", engine: "\t", year: "\n", notes: "", serviceGoal });
    assert.equal(result.score, 0);
    assert.deepEqual(plain(result.missing), [...["vehicle brand/model", "engine or engine code", "model year", "short customer goal or context"], ...(serviceGoal === goals[1] ? ["hardware changes"] : serviceGoal === goals[3] ? ["fault codes"] : [])]);
  }
});

test("all six exact goals preserve strict intent and conditional preparation", () => {
  goals.forEach((serviceGoal, i) => {
    const input = { ...base, serviceGoal };
    const original = { ...input };
    const result = getRequestBriefPreparation(input);
    assert.deepEqual(input, original, "no input mutation");
    assert.equal(result.requestPath, paths[i]);
    assert.equal(result.score, i === 1 || i === 3 ? 80 : 100);
    assert.equal(result.missing.length, i === 1 || i === 3 ? 1 : 0);
    const complete = getRequestBriefPreparation({ ...input, hardware: "Synthetic parts context", faultCodes: "P0401" });
    assert.equal(complete.score, 100);
    assert.equal(complete.missing.length, 0);
  });
  for (const serviceGoal of ["constructor", "__proto__", "toString", "", "DPF", "stage_1", "Stage 1 performance&vehicle=secret", "Unknown service"]) assert.equal(getRequestBriefPreparation({ ...base, serviceGoal }).requestPath, "/new-request");
});

test("all required-field permutations agree with missing count and optional-field independence", () => {
  const fields = ["vehicle", "engine", "year", "notes", "hardware", "faultCodes"] as const;
  for (const serviceGoal of goals) for (let mask = 0; mask < 64; mask++) {
    const input = { ...base, serviceGoal };
    fields.forEach((field, i) => { input[field] = mask & (1 << i) ? "Synthetic filled value" : " \t\n "; });
    const required = [0, 1, 2, 3, ...(serviceGoal === goals[1] ? [4] : serviceGoal === goals[3] ? [5] : [])];
    const filled = required.filter((i) => mask & (1 << i)).length;
    const result = getRequestBriefPreparation(input);
    assert.equal(result.score, Math.round(filled / required.length * 100));
    assert.equal(result.missing.length, required.length - filled);
    assert.equal(result.score === 100, result.missing.length === 0);
  }
});

test("current actual first paint is zero and localized in every supported locale", () => {
  for (const { code: locale } of supportedLocales) {
    const h = harness(locale);
    const copy = buildRequestBriefCopy(locale);
    assert.equal(h.scoreText(), new Intl.NumberFormat(intlLocaleByCode[locale], { style: "percent", maximumFractionDigits: 0 }).format(0));
    assert.equal(h.href(), paths[0]);
    assert.equal(h.progress()?.props["aria-label"], copy["Brief completeness"]);
    assert.equal(h.progress()?.props["aria-valuenow"], 0);
    assert.equal(h.progress()?.props["aria-valuemin"], 0);
    assert.equal(h.progress()?.props["aria-valuemax"], 100);
    assert.equal(h.progress()?.props["aria-valuetext"], h.scoreText());
    assert.deepEqual(plain(h.options()), goals);
    assert.deepEqual(plain(h.readMethods()), ["AutoTuner", "Flex", "KESS / KTAG", "CMD", "Magic Motorsport", "Bench / boot mode", "Unknown"]);
    for (const key of ["vehicle brand/model", "engine or engine code", "model year", "short customer goal or context"] as const) assert.ok(h.missingText().includes(copy[key]));
    const html = h.html();
    for (const key of ["MG AutoTech request brief", "Safety note: original file will be uploaded only through the secure MG AutoTech request form.", "This tool does not upload files, inspect binary data, create a request or contact MG AutoTech automatically."] as const) assert.ok(html.includes(copy[key].replaceAll("&", "&amp;").replaceAll("'", "&#x27;")));
    assert.equal((html.match(/<input\b/gu) ?? []).length, 6);
    assert.equal((html.match(/<textarea\b/gu) ?? []).length, 2);
    assert.equal((html.match(/<select\b/gu) ?? []).length, 2);
    assert.ok(html.includes('role="progressbar"'));
    assert.ok(!html.includes('type="file"'));
    fillBase(h); h.edit("Requested service", goals[1]);
    assert.equal(h.scoreText(), new Intl.NumberFormat(intlLocaleByCode[locale], { style: "percent", maximumFractionDigits: 0 }).format(0.8));
    assert.equal(h.progress()?.props["aria-valuenow"], 80);
    assert.equal(h.progress()?.props["aria-valuetext"], h.scoreText());
    assert.equal(h.missingText(), `${copy["Add:"]} ${copy["hardware changes"]}.`);
    assert.ok(h.brief().includes(copy["Stage 2 / hardware changes"]));
    assert.equal(h.href(), paths[1]);
  }
});

test("actual edits and goal switching keep percentage, missing list, current brief and CTA in agreement", () => {
  const h = harness();
  h.edit("ECU / TCU info", "Synthetic controller"); h.edit("Symptoms / customer goal", "Synthetic optional observation"); h.edit("Read tool / method", "Unknown");
  assert.equal(h.scoreText(), "0%");
  h.edit("Vehicle", base.vehicle); assert.equal(h.progress()?.props["aria-valuenow"], 25);
  fillBase(h);
  assert.equal(h.progress()?.props["aria-valuenow"], 100);
  h.edit("Requested service", goals[1]);
  assert.equal(h.progress()?.props["aria-valuenow"], 80);
  assert.ok(h.missingText().includes("hardware changes"));
  h.edit("Hardware changes", "Synthetic intake parts");
  assert.equal(h.progress()?.props["aria-valuenow"], 100);
  h.edit("Requested service", goals[3]);
  assert.equal(h.progress()?.props["aria-valuenow"], 80);
  assert.ok(h.missingText().includes("fault codes"));
  h.edit("Fault codes", "P0401, P2002");
  assert.equal(h.progress()?.props["aria-valuenow"], 100);
  for (const [i, goal] of goals.entries()) {
    h.edit("Requested service", goal);
    assert.equal(h.href(), paths[i]);
    assert.equal(h.value("Hardware changes"), "Synthetic intake parts");
    assert.equal(h.value("Fault codes"), "P0401, P2002");
    assert.ok(h.brief().includes(goal));
  }
  h.edit("Additional notes", " \n\t");
  assert.equal(h.progress()?.props["aria-valuenow"], 75);
  assert.ok(h.missingText().includes("short customer goal or context"));
});

test("real clipboard handler copies current native text and preserves raw inputs across success, failure and locale changes", async () => {
  const h = harness("tr"); fillBase(h);
  h.edit("Vehicle", "Synthetic <vehicle & identifier>");
  h.edit("Requested service", goals[1]);
  h.edit("Hardware changes", "Synthetic parts");
  const before = h.brief();
  assert.ok(before.includes("Synthetic <vehicle & identifier>"));
  assert.deepEqual(await h.copy(), [before]);
  assert.equal(h.status(), buildRequestBriefCopy("tr")["Copied"]);
  h.resetCopy(); assert.equal(h.status(), buildRequestBriefCopy("tr")["Copy brief"]);
  h.render("zh");
  assert.equal(h.value("Vehicle"), "Synthetic <vehicle & identifier>");
  assert.ok(h.brief().includes(buildRequestBriefCopy("zh")["Stage 2 / hardware changes"]));
  assert.equal(h.href(), paths[1]);
  await h.copy(true);
  assert.equal(h.status(), buildRequestBriefCopy("zh")["Copy failed"]);
  assert.equal(h.brief().includes("Synthetic <vehicle & identifier>"), true);
  h.resetCopy();
  assert.equal(h.status(), buildRequestBriefCopy("zh")["Copy brief"]);
});

test("only allowlisted service intent reaches the actual request access boundaries and auth redirect", () => {
  const source = readFileSync("src/app/new-request/NewRequestAccessBoundary.tsx", "utf8");
  const ast = ts.createSourceFile("NewRequestAccessBoundary.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const compiled = ts.transpileModule(ast.statements.filter((statement) => !ts.isImportDeclaration(statement)).map((statement) => statement.getText(ast)).join("\n"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  for (const goal of goals) {
    const requestPath = getRequestBriefPreparation({ ...base, serviceGoal: goal, vehicle: "Private synthetic value&vehicle=private", notes: "Private synthetic note#private" }).requestPath;
    const params = new URL(requestPath, "https://local.invalid").searchParams;
    assert.deepEqual([...params.keys()], requestPath.includes("?") ? ["intent"] : []);
    const exports: { NewRequestAccessBoundary?: (props: { children: React.ReactNode }) => React.ReactNode } = {};
    runInNewContext(compiled, {
      exports, buildNewRequestPath, parseRequestIntent, useSearchParams: () => params,
      BrowserAuthBoundary: "browser-auth-boundary", RegistrationCountryBoundary: "registration-country-boundary", CustomerPortalFrame: "customer-portal-frame",
      require(name: string) { assert.equal(name, "react/jsx-runtime"); return jsxRuntime; },
    });
    const boundaries = descendants(exports.NewRequestAccessBoundary!({ children: "Synthetic protected content" })).filter((element) => element.props.nextPath !== undefined);
    assert.equal(boundaries.length, 2);
    for (const boundary of boundaries) assert.equal(boundary.props.nextPath, requestPath);
    const redirect = new URL(buildAuthEntryPath("/register", requestPath), "https://local.invalid");
    assert.equal(redirect.searchParams.get("redirect"), requestPath);
    assert.ok(!redirect.href.includes("private"));
  }
});
