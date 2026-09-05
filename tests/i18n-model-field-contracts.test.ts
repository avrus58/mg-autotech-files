import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import {
  isReviewedModelField,
  isReviewedNotificationTranslatorCall,
} from "../scripts/lib/i18n-model-field-contracts";
import { analyzeLogStudio } from "../src/lib/logAnalysisStudio";
import { logStudioLocaleOrder, logStudioQualityT, logStudioT } from "../src/lib/i18n/log-analysis-studio-translations";

function nodes(text: string) {
  const source = ts.createSourceFile("source.ts", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const found: ts.Node[] = [];
  const visit = (node: ts.Node) => { found.push(node); ts.forEachChild(node, visit); };
  visit(source);
  return found;
}

test("model exceptions are exact properties, not whole-file or value allowlists", () => {
  const entries = [
    ["src/lib/creditPackages.ts", 5],
    ["src/lib/seo.ts", 1],
    ["src/lib/logAnalysisStudio.ts", 10],
  ] as const;
  for (const [file, count] of entries) {
    const source = readFileSync(file, "utf8");
    const matched = nodes(source).filter((node) => isReviewedModelField(file, node));
    assert.equal(matched.length, count, file);
    assert.ok(matched.every((node) => !isReviewedModelField(`${file}.sibling.ts`, node)));
    for (const node of matched) {
      assert.ok(ts.isPropertyAssignment(node) && ts.isStringLiteral(node.initializer));
      const changed = source.slice(0, node.initializer.getStart()) + '"Untranslated new copy"' + source.slice(node.initializer.end);
      assert.equal(nodes(changed).filter((item) => isReviewedModelField(file, item)).length, count - 1);
    }
  }
  const unrelated = nodes('const visible = { name: "Starter", label: "limited", title: "Boost pressure" };');
  assert.ok(unrelated.every((node) => !isReviewedModelField("src/lib/logAnalysisStudio.ts", node)));
  assert.ok(unrelated.every((node) => !isReviewedModelField("src/lib/creditPackages.ts", node)));
});

test("only the declared notification translator parameter carries the typed-key contract", () => {
  const file = "src/lib/i18n/customer-workflow-client-runtime.ts";
  const source = readFileSync(file, "utf8");
  const accepted = (text: string, path = file) => nodes(text).filter((node) =>
    ts.isCallExpression(node) && isReviewedNotificationTranslatorCall(path, node));
  assert.ok(accepted(source).length >= 9);
  assert.equal(accepted(source, "src/lib/i18n/fake-runtime.ts").length, 0);
  assert.equal(accepted(source.replace("export function translateCustomerNotification(", "export function fakeNotification(")).length, 0);
  assert.equal(accepted(source.replaceAll("t: CustomerWorkflowTemplateTranslator,", "t: OtherTranslator,")).length, 0);
  const shadowed = source.replace('const typeLabel = t(locale,', 'const t = (locale: string, key: string) => key; const typeLabel = t(locale,');
  assert.equal(accepted(shadowed).length, 0);
  const nested = 'export function translateCustomerNotification(locale: LocaleCode, item: Input, t: CustomerWorkflowTemplateTranslator) { return (() => { const t = (l, k) => k; return t(locale, "raw title"); })(); }';
  assert.equal(accepted(nested).length, 0);
  const checker = readFileSync("scripts/check-customer-i18n.ts", "utf8");
  assert.match(checker, /isReviewedNotificationTranslatorCall[\s\S]*?return typedKeyTranslatorContract/u);
  assert.match(checker, /auditedArgumentIndexes: new Set\(\[2\]\)/u);
});

test("model consumers render typed labels, not package metadata or quality enums", () => {
  const credits = readFileSync("src/app/dashboard/credits/page.tsx", "utf8");
  assert.doesNotMatch(credits, />\s*\{item\.name\}/u);
  assert.match(credits, /\{item\.credits\} Credit/u);
  assert.match(credits, /customerWorkflowT\(locale, creditPackageDescriptionKeys\[item.id\]\)/u);
  const studio = readFileSync("src/components/dashboard/LogAnalysisStudio.tsx", "utf8");
  assert.match(studio, /logStudioQualityT\(locale, analysis\.quality\.label\)/u);
  assert.equal((studio.match(/analysis\.xAxis\?\.synthetic \? t\("sample"\)/gu) ?? []).length, 4);
  for (const locale of logStudioLocaleOrder) {
    if (locale !== "en") assert.notEqual(logStudioQualityT(locale, "limited"), "limited");
    if (locale !== "en") assert.notEqual(logStudioT(locale, "sample"), "Sample");
  }
});

test("unnamed log columns use their source index while named columns remain literal", () => {
  const analysis = analyzeLogStudio("Time [s],,RAW_ÄÖ\n0,10,20\n1,11,21\n2,12,22");
  assert.equal(analysis.status, "ready");
  assert.equal(analysis.channels.find((channel) => channel.index === 1)?.header, "#2");
  assert.equal(analysis.channels.find((channel) => channel.index === 2)?.header, "RAW_ÄÖ");
});

test("source audit reuses validated exact SEO matrices without excluding siblings", () => {
  const checker = readFileSync("scripts/check-customer-i18n.ts", "utf8");
  assert.match(checker, /for \(const entry of customerWorkflowExternallyLocalizedSharedSources\) \{\s*externallyLocalizedSharedSourceExclusions\(entry\)/u);
  assert.match(checker, /new Set\(entry\.localeMatrixBindings\)/u);
});
