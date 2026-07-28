import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  analyzePerformanceLog,
  buildPerformanceReportSvg,
  calculatePowerFromTorque,
  parsePerformanceLog,
} from "../src/lib/performanceReport";

const sampleRows = [
  "1800, 320",
  "2200, 390",
  "2600, 430",
  "3000, 420",
  "3400, 395",
  "3800, 360",
  "4200, 315",
].join("\n");

test("torque and RPM calculation retains the transparent workshop formula", () => {
  const result = calculatePowerFromTorque(430, 3200);

  assert.equal(result.kw.toFixed(1), "144.1");
  assert.equal(result.hp.toFixed(1), "193.2");
});

test("performance parser accepts simple RPM and torque rows", () => {
  const parsed = parsePerformanceLog(sampleRows);

  assert.equal(parsed.format, "rpm_torque_rows");
  assert.equal(parsed.sourceRowCount, 7);
  assert.equal(parsed.rejectedRowCount, 0);
  assert.equal(parsed.points.length, 7);
  assert.equal(parsed.points[2].rpm, 2600);
  assert.equal(parsed.points[2].torque, 430);
});

test("performance parser detects quoted AutoTuner CSV columns and rejected rows", () => {
  const parsed = parsePerformanceLog(
    [
      '"Time";"Engine Speed (rpm)";"Engine Torque (Nm)"',
      '"0,1";"1800";"320,5"',
      '"0,2";"2200";"390,0"',
      '"0,3";"invalid";"410,0"',
    ].join("\n")
  );

  assert.equal(parsed.format, "autotuner_csv");
  assert.equal(parsed.sourceRowCount, 3);
  assert.equal(parsed.rejectedRowCount, 1);
  assert.equal(parsed.points.length, 2);
  assert.equal(parsed.points[0].torque, 320.5);
});

test("performance analysis exposes peak, range, retention and quality evidence", () => {
  const parsed = parsePerformanceLog(sampleRows);
  const analysis = analyzePerformanceLog(parsed);

  assert.equal(analysis.peakTorque?.torque, 430);
  assert.equal(analysis.peakTorque?.rpm, 2600);
  assert.equal(analysis.peakPower?.rpm, 3800);
  assert.equal(analysis.minRpm, 1800);
  assert.equal(analysis.maxRpm, 4200);
  assert.equal(analysis.rpmSpan, 2400);
  assert.equal(analysis.torqueRetentionPercent.toFixed(1), "73.3");
  assert.equal(analysis.qualityScore, 100);
  assert.equal(analysis.quality, "strong");
  assert.deepEqual(analysis.warnings, []);
});

test("performance analysis flags structural limitations without inventing data", () => {
  const parsed = parsePerformanceLog(
    "2200, 390\n1800, 320\n2200, 400\ninvalid row"
  );
  const analysis = analyzePerformanceLog(parsed);

  assert.equal(parsed.rejectedRowCount, 1);
  assert.equal(analysis.monotonicRpm, false);
  assert.equal(analysis.duplicateRpmCount, 1);
  assert.equal(analysis.quality, "limited");
  assert.ok(analysis.warnings.some((warning) => warning.includes("rejected")));
  assert.ok(analysis.warnings.some((warning) => warning.includes("not ordered")));
  assert.ok(analysis.warnings.some((warning) => warning.includes("duplicate RPM")));
});

test("downloaded report is deterministic, detailed and strips private source paths", () => {
  const parsed = parsePerformanceLog(sampleRows);
  const analysis = analyzePerformanceLog(parsed);
  const options = {
    fileName: "C:\\private\\customer-42\\log&<review>.csv",
    parsed,
    analysis,
    generatedAt: new Date("2026-07-28T10:00:00.000Z"),
  };
  const report = buildPerformanceReportSvg(options);
  const secondReport = buildPerformanceReportSvg(options);

  assert.equal(report, secondReport);
  assert.match(report, /Performance Log Analysis/);
  assert.match(report, /REPORT ID/);
  assert.match(report, /MGA-LOG-[A-F0-9]{8}/);
  assert.match(report, /CURVE SUMMARY/);
  assert.match(report, /QUALITY &amp; METHOD/);
  assert.match(report, /Representative log rows/);
  assert.match(report, /LOG-BASED ESTIMATE/);
  assert.match(report, /stroke="#38bdf8"/);
  assert.match(report, /stroke="#ef4444"/);
  assert.match(report, /log&amp;&lt;review&gt;\.csv/);
  assert.doesNotMatch(report, /C:\\private|customer-42/);
  assert.doesNotMatch(
    report,
    /<script|javascript:|<image|<foreignObject|xlink:href|\shref=/i
  );
});

test("report generation fails closed without valid log rows", () => {
  const parsed = parsePerformanceLog("invalid row");
  const analysis = analyzePerformanceLog(parsed);

  assert.throws(
    () => buildPerformanceReportSvg({ fileName: "", parsed, analysis }),
    /requires at least one valid log row/
  );
});

test("performance tools UI exposes professional curve, data and report states", () => {
  const source = readFileSync(
    path.join(process.cwd(), "src", "components", "tools", "PerformanceTools.tsx"),
    "utf8"
  );

  assert.match(source, /Performance analysis workspace/);
  assert.match(source, /Local browser analysis/);
  assert.match(source, /Torque and power across engine speed/);
  assert.match(source, /aria-label="Torque and estimated power curve across engine speed"/);
  assert.match(source, /Detailed MG AutoTech performance report/);
  assert.match(source, /Download detailed report/);
  assert.match(source, /aria-pressed=\{reportView === "curve"\}/);
  assert.match(source, /aria-pressed=\{reportView === "data"\}/);
  assert.doesNotMatch(source, /Download Dyno Report|Power curve preview/);
});
