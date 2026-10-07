import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import * as icons from "lucide-react";
import ts from "typescript";
import { buildEcuReadAdvisorCopy } from "../src/lib/i18n/tool-client-copy";
import type { EcuReadAdvisorCopy, EcuReadAdvisorCopyKey } from "../src/lib/i18n/tool-client-copy-keys";
import { supportedLocales, type LocaleCode } from "../src/lib/i18nConfig";

type Props = Record<string, unknown> & { children?: React.ReactNode };
type Element = React.ReactElement<Props>;
type RecordNode = { element: Element; parent: Element | null };
const filename = "src/components/tools/EcuReadMethodAdvisor.tsx";
const ast = ts.createSourceFile(filename, readFileSync(filename, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const code = ts.transpileModule(ast.statements.filter((statement) => !ts.isImportDeclaration(statement)).map((statement) => statement.getText(ast)).join("\n"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const forbidden = () => { throw new Error("Advisor component tests must not read files, upload, use browser storage or contact a service."); };

function children(node: React.ReactNode): React.ReactNode[] {
  if (Array.isArray(node)) return node.flatMap(children);
  return node === null || node === undefined || typeof node === "boolean" ? [] : [node];
}

function materialize(node: React.ReactNode): React.ReactNode {
  if (Array.isArray(node)) return node.map(materialize);
  if (!React.isValidElement(node)) return node;
  const element = node as Element;
  // Execute the real SelectField exactly once per render to reach its native
  // select and event closure; Lucide forward-ref icons remain real elements.
  if (typeof element.type === "function") return materialize((element.type as (props: Props) => React.ReactNode)(element.props));
  return React.cloneElement(element, { children: children(element.props.children).map(materialize) });
}

function nodes(node: React.ReactNode, parent: Element | null = null): RecordNode[] {
  if (Array.isArray(node)) return node.flatMap((child) => nodes(child, parent));
  if (!React.isValidElement(node)) return [];
  const element = node as Element;
  return [{ element, parent }, ...children(element.props.children).flatMap((child) => nodes(child, element))];
}

function text(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  return React.isValidElement(node) ? React.Children.toArray((node as Element).props.children).map(text).join("") : "";
}

// Real TSX, calculations, memo dependencies, JSX and event closures run here.
// Only React hook bookkeeping and Link's native anchor adapter are doubles.
// Containment assertions are structural regressions, NOT browser geometry QA.
function harness(locale: LocaleCode) {
  let copy: EcuReadAdvisorCopy = buildEcuReadAdvisorCopy(locale);
  const states: unknown[] = [];
  const memos: Array<{ dependencies: readonly unknown[]; value: unknown }> = [];
  let stateIndex = 0;
  let memoIndex = 0;
  let current: React.ReactNode;
  const exports: Record<string, unknown> = {};
  const context: Record<string, unknown> = {
    exports, ...icons, Link: "a", fetch: forbidden, setTimeout: forbidden, setInterval: forbidden,
    useState(initial: unknown) {
      const index = stateIndex++;
      if (index >= states.length) states[index] = typeof initial === "function" ? (initial as () => unknown)() : initial;
      return [states[index], (value: unknown) => { states[index] = typeof value === "function" ? (value as (previous: unknown) => unknown)(states[index]) : value; }];
    },
    useMemo(calculate: () => unknown, dependencies: readonly unknown[]) {
      const index = memoIndex++;
      const previous = memos[index];
      if (!previous || previous.dependencies.length !== dependencies.length || dependencies.some((value, slot) => !Object.is(value, previous.dependencies[slot]))) memos[index] = { dependencies: [...dependencies], value: calculate() };
      return memos[index].value;
    },
    require(name: string) { assert.equal(name, "react/jsx-runtime"); return jsxRuntime; },
  };
  for (const name of ["window", "document", "localStorage", "sessionStorage", "navigator", "XMLHttpRequest"]) Object.defineProperty(context, name, { get: forbidden });
  runInNewContext(code, context);
  const component = exports.EcuReadMethodAdvisor as (props: { copy: EcuReadAdvisorCopy }) => React.ReactNode;
  assert.equal(typeof component, "function");
  function render() {
    stateIndex = 0; memoIndex = 0;
    current = materialize(component({ copy }));
    assert.equal(stateIndex, 7, "preserve four select and three checkbox state hooks");
    assert.equal(memoIndex, 1, "exercise the actual single result memo");
    return current;
  }
  render();
  return {
    render,
    records: () => nodes(current),
    copy: () => copy,
    state: () => [...states],
    changeLocale(next: LocaleCode) { copy = buildEcuReadAdvisorCopy(next); render(); },
  };
}
type Harness = ReturnType<typeof harness>;

const fields = [
  { label: "Control unit type", options: [["diesel", "Turbo diesel ECU"], ["gasoline", "Turbo gasoline ECU"], ["hybrid", "Hybrid / mild-hybrid ECU"], ["tcu", "TCU / gearbox file"], ["unknown", "Unknown control unit"]] },
  { label: "Known read access", options: [["obd_known", "OBD read is known to be supported"], ["bench_required", "Bench read may be required"], ["boot_required", "Boot mode may be required"], ["locked", "ECU may be locked or protected"], ["unknown", "Read method is unknown"]] },
  { label: "Tool / file source", options: [["professional", "Professional tool and account available"], ["customer_file", "Customer already has a file"], ["unknown", "Tool or file source is unknown"]] },
  { label: "Original file status", options: [["ori_ready", "Original read file is available"], ["virtual_read", "Virtual read / stock file may be needed"], ["modified_only", "Only a modified file is available"], ["not_ready", "No file is ready yet"]] },
] as const satisfies ReadonlyArray<{ label: EcuReadAdvisorCopyKey; options: ReadonlyArray<readonly [string, EcuReadAdvisorCopyKey]> }>;
const checkboxLabels = [
  "ECU/TCU label or software details are available.",
  "Stable battery support is available during the read.",
  "Fault codes or diagnostic symptoms are known.",
] as const;
const baseChecklist = [
  "Confirm vehicle brand, model, generation, engine and year.",
  "Prepare the original file, not only a modified file.",
  "Keep the read tool name and read mode available.",
  "Use stable battery support during read/write operations.",
] as const;
const missingLabel = "Add ECU/TCU label details or clear photos where possible.";
const faults = "Include diagnostic codes and symptoms in the request notes.";
const noFileWarning = "No upload should be started until a valid file or verified read plan exists.";
const unknownSourceWarning = "Unknown file sources increase review time and may require extra verification.";

function single(h: Harness, predicate: (record: RecordNode) => boolean) {
  const found = h.records().filter(predicate);
  assert.equal(found.length, 1, "identify one actual component node");
  return found[0];
}
function select(h: Harness, index: number) {
  return single(h, ({ element, parent }) => element.type === "select" && parent?.type === "label" && children(parent.props.children)[0] === h.copy()[fields[index].label]).element;
}
function checkbox(h: Harness, index: number) {
  return single(h, ({ element, parent }) => element.type === "input" && element.props.type === "checkbox" && parent?.type === "label" && text(parent).includes(h.copy()[checkboxLabels[index]])).element;
}
function choose(h: Harness, index: number, value: string) {
  const control = select(h, index);
  assert.ok(fields[index].options.some(([token]) => token === value), "use only an actual existing option token");
  (control.props.onChange as (event: { target: { value: string } }) => void)({ target: { value } });
  h.render();
  assert.equal(select(h, index).props.value, value, "the real controlled select keeps the chosen value");
}
function check(h: Harness, index: number, checked: boolean) {
  (checkbox(h, index).props.onChange as (event: { target: { checked: boolean } }) => void)({ target: { checked } });
  h.render();
  assert.equal(checkbox(h, index).props.checked, checked, "the real controlled checkbox keeps its changed value");
}
function checklist(h: Harness) {
  const heading = single(h, ({ element }) => element.type === "h2" && text(element) === h.copy()["Read preparation checklist"]);
  const card = single(h, ({ element }) => directElements(element).includes(heading.parent!));
  return nodes(card.element).filter(({ element }) => element.type === "span").map(({ element }) => text(element));
}
function warnings(h: Harness) {
  const headings = h.records().filter(({ element }) => element.type === "h2" && text(element) === h.copy()["Review before upload"]);
  if (headings.length === 0) return [];
  assert.equal(headings.length, 1);
  const heading = headings[0];
  const card = single(h, ({ element }) => directElements(element).includes(heading.parent!));
  return nodes(card.element).filter(({ element }) => element.type === "p").map(({ element }) => text(element));
}

type Scenario = {
  name: string; selected: readonly [string, string, string, string]; checked: readonly [boolean, boolean, boolean];
  score: number; tone: EcuReadAdvisorCopyKey; method: EcuReadAdvisorCopyKey;
  checklist: readonly EcuReadAdvisorCopyKey[]; warnings: readonly EcuReadAdvisorCopyKey[];
};
// Fixed observed contract examples, not a second implementation of the engine.
const scenarios = [
  { name: "default", selected: ["diesel", "unknown", "professional", "ori_ready"], checked: [false, false, false], score: 72, tone: "Needs confirmation", method: "Identify the ECU, software number and read tool first, then confirm the read method.", checklist: [...baseChecklist, missingLabel], warnings: [] },
  { name: "locked modified file", selected: ["diesel", "locked", "professional", "modified_only"], checked: [true, false, true], score: 64, tone: "Needs confirmation", method: "Do not assume the file can be read normally. Ask MG AutoTech to confirm the safest path.", checklist: [...baseChecklist, faults], warnings: ["A modified-only file is not ideal. An original file is usually required for a clean workflow.", "Locked or protected ECUs require human confirmation before any work is promised."] },
  { name: "unknown unit boot read and no file", selected: ["unknown", "boot_required", "unknown", "not_ready"], checked: [false, false, false], score: 39, tone: "High review needed", method: "Treat this as a specialist read. Confirm the method with MG AutoTech before attempting it.", checklist: [...baseChecklist, missingLabel], warnings: [noFileWarning, "Boot-mode work should only be handled with the correct professional procedure and equipment.", unknownSourceWarning] },
  { name: "TCU bench virtual read", selected: ["tcu", "bench_required", "customer_file", "virtual_read"], checked: [true, true, true], score: 79, tone: "Good read preparation", method: "Prepare for a bench read and keep ECU identification photos ready.", checklist: [...baseChecklist, "Include gearbox type and transmission software details if available.", "Tell MG AutoTech if the tool produced a virtual read instead of a full read.", faults], warnings: [] },
  { name: "hybrid OBD original file", selected: ["hybrid", "obd_known", "professional", "ori_ready"], checked: [true, true, true], score: 100, tone: "Good read preparation", method: "Start with an OBD read if your tool confirms support for this exact ECU/SW.", checklist: [...baseChecklist, "Mention hybrid, mild-hybrid or plug-in-hybrid system context.", faults], warnings: [] },
  { name: "empty file and unknown preparation", selected: ["unknown", "unknown", "unknown", "not_ready"], checked: [false, false, false], score: 31, tone: "High review needed", method: "Identify the ECU, software number and read tool first, then confirm the read method.", checklist: [...baseChecklist, missingLabel], warnings: [noFileWarning, unknownSourceWarning] },
] as const satisfies readonly Scenario[];

function applyScenario(h: Harness, scenario: Scenario) {
  for (let index = 0; index < 4; index++) choose(h, index, scenario.selected[index]);
  for (let index = 0; index < 3; index++) check(h, index, scenario.checked[index]);
}
function assertResult(h: Harness, scenario: Scenario) {
  const copy = h.copy();
  single(h, ({ element }) => element.type === "div" && text(element) === `${scenario.score}%`);
  single(h, ({ element }) => element.type === "div" && text(element) === copy[scenario.tone]);
  single(h, ({ element }) => element.type === "p" && text(element) === copy[scenario.method]);
  const meters = h.records().filter(({ element }) => element.props.style && (element.props.style as React.CSSProperties).width === `${scenario.score}%`);
  assert.equal(meters.length, 1, "score text and actual progress bar agree");
  assert.deepEqual(checklist(h), scenario.checklist.map((key) => copy[key]), scenario.name);
  assert.deepEqual(warnings(h), scenario.warnings.map((key) => copy[key]), scenario.name);
  assert.deepEqual(h.state(), [...scenario.selected, ...scenario.checked], "all seven actual hook values are preserved");
}

test("actual ECU advisor keeps four native selects, all 17 option tokens and safe request links in every locale", () => {
  assert.equal(supportedLocales.length, 12);
  for (const { code: locale } of supportedLocales) {
    const h = harness(locale);
    assertResult(h, scenarios[0]);
    assert.equal(h.records().filter(({ element }) => element.type === "select").length, 4, locale);
    assert.equal(h.records().filter(({ element }) => element.type === "option").length, 17, locale);
    for (let index = 0; index < fields.length; index++) {
      const options = nodes(select(h, index)).filter(({ element }) => element.type === "option");
      assert.deepEqual(options.map(({ element }) => [element.props.value, text(element)]), fields[index].options.map(([token, key]) => [token, h.copy()[key]]), `${locale}/${fields[index].label}`);
      for (const [token] of fields[index].options) {
        const expectedState = h.state();
        expectedState[index] = token;
        choose(h, index, token);
        assert.deepEqual(h.state(), expectedState, "each of the 17 native options changes only its own real state slot");
      }
    }
    const anchors = h.records().filter(({ element }) => element.type === "a").map(({ element }) => ({ href: element.props.href, text: text(element) }));
    assert.deepEqual(anchors, [{ href: "/tools/request-brief-builder", text: h.copy()["Build Request Brief"] }, { href: "/new-request", text: h.copy()["Start Secure Request"] }], locale);
    assert.equal(h.records().some(({ element }) => ["form", "button", "textarea"].includes(String(element.type)) || (element.type === "input" && element.props.type !== "checkbox")), false, "no submit, file picker or new input workflow is introduced");
    single(h, ({ element }) => text(element) === h.copy()["Customer safety: no file picker, no upload session, no binary analysis, no checksum, no file generation."] && element.type === "div");
    applyScenario(h, scenarios[0]);
    assertResult(h, scenarios[0]);
  }
});

test("real select and checkbox handlers preserve scores, methods, checklists and warnings across representative states in all 12 locales", () => {
  for (const { code: locale } of supportedLocales) {
    const h = harness(locale);
    for (const scenario of scenarios) {
      applyScenario(h, scenario);
      assertResult(h, scenario);
      h.render();
      assertResult(h, scenario);
    }
    applyScenario(h, scenarios[0]);
    assertResult(h, scenarios[0]);
  }
});

test("a locale copy replacement recomputes real result text without discarding selected preparation", () => {
  const h = harness("en");
  applyScenario(h, scenarios[3]);
  for (const { code: locale } of supportedLocales) {
    h.changeLocale(locale);
    assertResult(h, scenarios[3]);
    assert.deepEqual([0, 1, 2, 3].map((index) => select(h, index).props.value), [...scenarios[3].selected]);
    assert.deepEqual([0, 1, 2].map((index) => checkbox(h, index).props.checked), [...scenarios[3].checked]);
  }
});

function tokens(element: Element) { return new Set(String(element.props.className ?? "").split(/\s+/u)); }
function hasClasses(element: Element, ...expected: string[]) { for (const token of expected) assert.ok(tokens(element).has(token), `${String(element.type)} must carry ${token}`); }
function wraps(h: Harness, element: Element) {
  const records = h.records();
  let owner: Element | null = element;
  while (owner) {
    if (tokens(owner).has("[overflow-wrap:anywhere]")) return;
    owner = records.find((record) => record.element === owner)?.parent ?? null;
  }
  assert.fail(`${String(element.type)} needs intrinsic-safe wrapping on its actual node or inherited owner`);
}
function directElements(element: Element) { return children(element.props.children).filter(React.isValidElement) as Element[]; }

test("containment classes belong to the actual grid, cards, native controls and translated text nodes, not an unrelated source match", () => {
  for (const { code: locale } of supportedLocales) {
    const h = harness(locale);
    applyScenario(h, scenarios[1]);
    const section = single(h, ({ element }) => element.type === "section").element;
    const grid = directElements(section)[0];
    hasClasses(grid, "grid", "grid-cols-1", "lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]");
    const [formCard, results] = directElements(grid);
    hasClasses(formCard, "min-w-0", "max-w-full", "[overflow-wrap:anywhere]");
    hasClasses(results, "min-w-0", "max-w-full", "[overflow-wrap:anywhere]");
    for (const card of directElements(results)) hasClasses(card, "min-w-0", "max-w-full");
    const formGrid = directElements(formCard).find((element) => directElements(element).some((child) => child.type === "label"));
    assert.ok(formGrid);
    hasClasses(formGrid, "grid", "grid-cols-1", "min-w-0");
    for (let index = 0; index < fields.length; index++) {
      const control = select(h, index);
      hasClasses(control, "min-w-0", "max-w-full", "w-full");
      const label = single(h, ({ element }) => directElements(element).includes(control)).element;
      hasClasses(label, "min-w-0", "max-w-full");
    }
    const headings = h.records().filter(({ element }) => element.type === "h2");
    assert.equal(headings.length, 3, "include form, checklist and conditional warning headings");
    for (const { element, parent } of headings) {
      assert.ok(parent);
      wraps(h, element);
      if (directElements(parent).some((child) => typeof child.type !== "string")) hasClasses(element, "min-w-0");
      else hasClasses(parent, "min-w-0");
    }
    const formHeading = headings.find(({ element }) => text(element) === h.copy()["Choose the safest read preparation path"])!;
    const formHeader = single(h, ({ element }) => directElements(element).includes(formHeading.parent!)).element;
    hasClasses(directElements(formHeader)[0], "shrink-0");
    const score = single(h, ({ element }) => element.type === "div" && text(element) === `${scenarios[1].score}%`);
    assert.ok(score.parent);
    hasClasses(score.parent, "min-w-0");
    wraps(h, score.parent);
    for (const { element } of h.records().filter(({ element }) => [icons.ClipboardList, icons.AlertTriangle, icons.ArrowRight].includes(element.type as typeof icons.ClipboardList))) hasClasses(element, "shrink-0");
    const checklistText = checklist(h);
    for (const { element } of h.records().filter(({ element }) => element.type === "p" || element.type === "a" || (element.type === "span" && checklistText.includes(text(element))))) {
      wraps(h, element);
      if (element.type === "span") hasClasses(element, "min-w-0");
    }
    for (const { element, parent } of h.records().filter(({ element }) => element.type === "a")) {
      hasClasses(element, "min-w-0", "max-w-full", "text-center", "[overflow-wrap:anywhere]");
      assert.ok(parent);
      hasClasses(parent, "flex-wrap", "min-w-0");
    }
    for (let index = 0; index < 3; index++) hasClasses(checkbox(h, index), "shrink-0");
  }
});
