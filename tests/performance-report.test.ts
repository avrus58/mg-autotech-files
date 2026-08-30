import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  analyzePerformanceLog,
  buildPerformanceReportSvg,
  calculatePowerFromTorque,
  parsePerformanceLog,
  performanceFromStudioAnalysis,
  performanceSourceFromStudioAnalysis,
} from "../src/lib/performanceReport";
import { analyzeLogStudio } from "../src/lib/logAnalysisStudio";

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

test("headerless performance rows require exactly two fields", () => {
  const parsed = parsePerformanceLog([
    "100,2000,300",
    "101,2500,350",
    "102,3000,400",
  ].join("\n"));

  assert.equal(parsed.format, "unknown");
  assert.deepEqual(parsed.points, []);
});

test("performance parser detects quoted generic logger columns and rejected rows", () => {
  const parsed = parsePerformanceLog(
    [
      '"Time";"Engine Speed (rpm)";"Engine Torque (Nm)"',
      '"0,1";"1800";"320,5"',
      '"0,2";"2200";"390,0"',
      '"0,3";"invalid";"410,0"',
    ].join("\n")
  );

  assert.equal(parsed.format, "generic_tabular_log");
  assert.equal(parsed.sourceRowCount, 3);
  assert.equal(parsed.rejectedRowCount, 1);
  assert.equal(parsed.points.length, 2);
  assert.equal(parsed.points[0].torque, 320.5);
});

test("shared Studio projection calculates power from compatible generic log channels", () => {
  const studio = analyzeLogStudio([
    "Time [s];RPM;Requested Torque [Nm];Actual Engine Torque [Nm]",
    "0,0;1800;500;280",
    "0,5;2400;520;360",
    "1,0;3200;540;410",
  ].join("\n"));
  const result = performanceFromStudioAnalysis(studio);

  assert.ok(result);
  assert.equal(result.parsed.format, "generic_tabular_log");
  assert.equal(result.parsed.points.length, 3);
  assert.equal(result.analysis.peakTorque?.torque, 410);
  assert.equal(result.analysis.peakTorque?.rpm, 3200);
  assert.equal(result.analysis.peakPower?.hp.toFixed(1), "184.3");
  assert.equal(result.source.rpmLabel, "RPM");
  assert.equal(result.source.torqueLabel, "Actual Engine Torque");
  assert.equal(result.source.loggedPeakTorqueNm, 410);
});

test("Studio source metadata keeps the true logged torque maximum even when its row lacks RPM", () => {
  const studio = analyzeLogStudio([
    "Engine Speed [rpm],Engine Torque Actual [Nm]",
    "1800,280",
    "2400,360",
    ",500",
    "3200,410",
  ].join("\n"));
  const result = performanceFromStudioAnalysis(studio);

  assert.ok(result);
  assert.equal(result.analysis.peakTorque?.torque, 410);
  assert.equal(result.source.loggedPeakTorqueNm, 500);
});

test("Studio source metadata keeps known-unit torque available without aligned RPM rows", () => {
  const studio = analyzeLogStudio([
    "Engine Speed [rpm],Engine Torque Actual [Nm]",
    "1800,",
    ",400",
    "3200,",
  ].join("\n"));
  const source = performanceSourceFromStudioAnalysis(studio);

  assert.equal(performanceFromStudioAnalysis(studio), null);
  assert.equal(source?.loggedPeakTorqueNm, 400);
  assert.equal(source?.torqueChannelId, "torque");
  assert.equal(source?.rpmChannelId, "rpm");
});

test("public torque metadata excludes extreme and sentinel values rejected by the performance contract", () => {
  const studio = analyzeLogStudio([
    "Engine Speed [rpm],Engine Torque Actual [Nm]",
    "1800,280",
    "2400,1e308",
    "2800,32767",
    "3200,410",
  ].join("\n"));
  const result = performanceFromStudioAnalysis(studio);

  assert.ok(result);
  assert.equal(result.source.loggedPeakTorqueNm, 410);
  assert.ok((result.source.loggedPeakTorqueNm ?? 0) <= 20_000);
});

test("Studio truncation is not mislabeled as rejected performance rows", () => {
  const studio = analyzeLogStudio(
    "Engine Speed [rpm],Engine Torque Actual [Nm]\n1800,280\n2400,360\n3200,410"
  );
  studio.source.sourceRowCount = 50_001;
  studio.truncated.rows = true;
  const result = performanceFromStudioAnalysis(studio);

  assert.ok(result);
  assert.equal(result.parsed.sourceRowCount, 3);
  assert.equal(result.parsed.rejectedRowCount, 0);
  assert.ok(result.analysis.warnings.some((warning) => /first 3 of 50,001 source rows.*not counted as rejected/i.test(warning)));
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

test("performance parser rejects values that would overflow an automotive power result", () => {
  const parsed = parsePerformanceLog("30000,1e308");

  assert.equal(parsed.points.length, 0);
  assert.equal(parsed.rejectedRowCount, 1);
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
  assert.doesNotMatch(report, /AutoTuner/i);
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

test("homepage performance tools ship only the public snapshot and manual calculator", () => {
  const source = readFileSync(
    path.join(process.cwd(), "src", "components", "tools", "PerformanceTools.tsx"),
    "utf8"
  );
  const deferredSource = readFileSync(
    path.join(process.cwd(), "src", "components", "tools", "DeferredPerformanceTools.tsx"),
    "utf8"
  );

  assert.match(deferredSource, /import\("@\/components\/tools\/PublicLogSnapshot"\)/);
  assert.match(deferredSource, /<PublicLogSnapshot copy=\{copy\} locale=\{locale\} \/>/);
  assert.match(source, /Torque Power Calculator/);
  assert.match(source, /copy: PerformanceCalculatorCopy/);
  assert.doesNotMatch(source, /PublicLogSnapshot|public-tools-translations/);
  assert.doesNotMatch(source, /DetailedPerformanceTools|parsePerformanceLog|analyzePerformanceLog/);
  assert.doesNotMatch(source, /PerformanceCurveChart|PerformanceDataTable|buildPerformanceReportSvg/);
  assert.doesNotMatch(source, /Manual data input|Download detailed report/);
});

test("downloaded long-log curve sampling preserves narrow torque extrema", () => {
  const points = Array.from({ length: 15_000 }, (_, index) => {
    const rpm = 1_000 + index;
    const torque = index === 1 ? 900 : 300;
    return { rpm, torque, ...calculatePowerFromTorque(torque, rpm) };
  });
  const parsed = {
    points,
    format: "rpm_torque_rows" as const,
    sourceRowCount: points.length,
    rejectedRowCount: 0,
  };
  const analysis = analyzePerformanceLog(parsed);
  const report = buildPerformanceReportSvg({
    fileName: "long-log.csv",
    parsed,
    analysis,
    generatedAt: new Date("2026-08-22T10:00:00.000Z"),
  });
  const torquePolyline = report.match(
    /<polyline points="([^"]+)" fill="none" stroke="#38bdf8"/
  )?.[1];

  assert.ok(torquePolyline);
  assert.match(torquePolyline, /82\.1,354\.0/);
  assert.ok(torquePolyline.split(" ").length > 1_500);
});
