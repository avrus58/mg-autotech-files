import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { auditReportAssetList, reportFontFiles } from "../scripts/check-service-report-build.mjs";

const projectRoot = path.resolve("synthetic-build-fixture");
const traceDirectory = path.join(projectRoot, ".next/server/app/api/requests/[id]/service-report");
const requiredFiles = ["assets/report-fonts/NotoSans-Regular.ttf", "node_modules/pdfkit/js/standard-fonts/Helvetica.cjs", "node_modules/pdfkit/js/standard-fonts/chunks/font.cjs"];
const tracedFiles = requiredFiles.map((file) => path.relative(traceDirectory, path.join(projectRoot, file)));

test("report build guard accepts all traced local and standalone runtime assets", () => {
  assert.deepEqual(auditReportAssetList({ projectRoot, traceDirectory, tracedFiles, requiredFiles, exists: () => true }), []);
  assert.equal(reportFontFiles.length, 5);
  assert.ok(reportFontFiles.includes("NotoSansSC-Regular.ttf"));
  assert.ok(reportFontFiles.includes("OFL-NotoSansSC.txt"));
});

test("report build guard catches PDFKit dynamic font modules and nested chunk omissions", () => {
  const missing = auditReportAssetList({ projectRoot, traceDirectory, tracedFiles: tracedFiles.slice(0, 1), requiredFiles, exists: () => true });
  assert.deepEqual(missing, requiredFiles.slice(1).map((file) => ({ file, reason: "not_traced" })));
});

test("a correct NFT trace does not hide missing standalone copies or source assets", () => {
  const absent = path.join(projectRoot, ".next/standalone", requiredFiles[1]);
  assert.deepEqual(auditReportAssetList({ projectRoot, traceDirectory, tracedFiles, requiredFiles, exists: (file: string) => file !== absent }), [{ file: requiredFiles[1], reason: "missing_in_standalone" }]);
  const absentSource = path.join(projectRoot, requiredFiles[0]);
  assert.deepEqual(auditReportAssetList({ projectRoot, traceDirectory, tracedFiles, requiredFiles, exists: (file: string) => file !== absentSource }), [{ file: requiredFiles[0], reason: "missing_source" }]);
});

test("the report route traces PDFKit recursive runtime fonts and project font assets", () => {
  const config = readFileSync("next.config.ts", "utf8");
  assert.match(config, /"\/api\/requests\/\*\/service-report"\s*:\s*\[[^\]]*"\.\/assets\/report-fonts\/\*\*\/\*"[^\]]*"\.\/node_modules\/pdfkit\/js\/standard-fonts\/\*\*\/\*"/s);
});

test("Docker admits only the synthetic PDF helper needed by builder typechecking", () => {
  const patterns = readFileSync(".dockerignore", "utf8").split(/\r?\n/);
  for (const line of ["tests/*", "!tests/helpers", "tests/helpers/*", "!tests/helpers/service-report-fixture.ts"]) assert.ok(patterns.includes(line));
  assert.ok(!patterns.includes("!tests") && !patterns.includes("!tests/**"));
});

test("every successful production build runs the standalone report runtime gate", () => {
  const manifest = JSON.parse(readFileSync("package.json", "utf8"));
  assert.equal(manifest.scripts.postbuild, "node scripts/check-service-report-build.mjs");
});
