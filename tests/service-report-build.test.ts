import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import nextConfig from "../next.config";
import { auditReportAssetList, listSharpRuntimeFiles, reportFontFiles } from "../scripts/check-service-report-build.mjs";

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
  assert.match(config, /"\/api\/requests\/\*\/service-report"\s*:\s*\[[^\]]*"\.\/assets\/report-fonts\/\*\*\/\*"[^\]]*"\.\/node_modules\/pdfkit\/js\/standard-fonts\/\*\*\/\*"/);
});

test("both report image routes trace installed Sharp binaries and libvips packages", () => {
  const nativeArtifacts = "./node_modules/@img/sharp-*/**/*";
  const routes = nextConfig.outputFileTracingIncludes ?? {};
  const expectedRoutes = ["/api/account/report-branding", "/api/requests/*/service-report"];
  for (const route of expectedRoutes) {
    assert.ok(routes[route]?.includes(nativeArtifacts), `${route} must include Sharp and its separate libvips runtime packages`);
  }
  assert.deepEqual(Object.entries(routes).filter(([, files]) => files.includes(nativeArtifacts)).map(([route]) => route).sort(), expectedRoutes);
});

test("report asset checks reject a missing native libvips standalone library", () => {
  const library = "node_modules/@img/sharp-libvips-linuxmusl-x64/lib/libvips-cpp.so.8.18.3";
  const source = path.join(projectRoot, library);
  const standalone = path.join(projectRoot, ".next/standalone", library);
  assert.deepEqual(auditReportAssetList({ projectRoot, traceDirectory, tracedFiles: [path.relative(traceDirectory, source)], requiredFiles: [library], exists: (file: string) => file !== standalone }), [{ file: library, reason: "missing_in_standalone" }]);
});

test("Sharp runtime discovery includes the separate native binary and libvips package", () => {
  const root = mkdtempSync(path.join(tmpdir(), "mg-sharp-runtime-"));
  const files = [
    "node_modules/@img/sharp-linuxmusl-x64/lib/sharp-linuxmusl-x64-0.35.0.node",
    "node_modules/@img/sharp-libvips-linuxmusl-x64/lib/libvips-cpp.so.8.18.3",
    "node_modules/@img/sharp-libvips-linuxmusl-x64/package.json",
  ];
  try {
    for (const file of [...files, "node_modules/@img/unrelated/readme.txt"]) {
      const target = path.join(root, file);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, "synthetic fixture only");
    }
    assert.deepEqual(listSharpRuntimeFiles(root).sort(), files.map((file) => path.normalize(file)).sort());
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("postbuild checks Sharp assets in both compiled report and branding traces", () => {
  const script = readFileSync("scripts/check-service-report-build.mjs", "utf8");
  assert.match(script, /const sharpFiles = listSharpRuntimeFiles\(projectRoot\)/);
  assert.match(script, /const requiredFiles = \[[^\]]*\.\.\.sharpFiles\]/);
  assert.match(script, /auditReportAssetList\(\{ projectRoot, traceDirectory, tracedFiles: trace\.files, requiredFiles \}\)/);
  assert.match(script, /"\.next\/server\/app\/api\/account\/report-branding"/);
  assert.match(script, /auditReportAssetList\(\{ projectRoot, traceDirectory: brandingDirectory, tracedFiles: brandingTrace\.files, requiredFiles: sharpFiles \}\)/);
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
