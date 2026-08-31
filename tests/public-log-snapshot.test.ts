import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  analyzePublicLogSnapshot,
  publicLogSnapshotMaximumEstimatedPowerHp,
  publicLogSnapshotMaximumCharacters,
  publicLogSnapshotMaximumRpm,
  publicLogSnapshotMaximumRows,
  publicLogSnapshotMaximumTorqueNm,
  publicLogSnapshotMinimumEstimatedPowerHp,
  publicLogSnapshotMinimumPairedRows,
  publicLogSnapshotMinimumRpm,
  publicLogSnapshotMinimumRpmSpan,
  publicLogSnapshotMinimumTorqueNm,
} from "../src/lib/publicLogSnapshot";

function source(...segments: string[]) {
  return readFileSync(path.join(process.cwd(), ...segments), "utf8");
}

test("homepage loads the compact snapshot independently while the old public analyzer redirects into the protected dashboard", () => {
  const performanceTools = source("src", "components", "tools", "PerformanceTools.tsx");
  const publicSnapshot = source("src", "components", "tools", "PublicLogSnapshot.tsx");
  const deferredSnapshot = source("src", "components", "tools", "DeferredPerformanceTools.tsx");
  const dedicatedAnalyzer = source("src", "app", "tools", "autotuner-log-analyzer", "page.tsx");

  assert.match(deferredSnapshot, /import\("@\/components\/tools\/PublicLogSnapshot"\)/);
  assert.match(deferredSnapshot, /<PublicLogSnapshot copy=\{copy\} locale=\{locale\} \/>/);
  assert.doesNotMatch(performanceTools, /PublicLogSnapshot|PerformanceToolsMode/);
  assert.doesNotMatch(performanceTools, /DetailedPerformanceTools|PerformanceCurveChart|PerformanceDataTable/);
  assert.doesNotMatch(performanceTools, /parsePerformanceLog|analyzePerformanceLog|buildPerformanceReportSvg/);
  assert.match(dedicatedAnalyzer, /permanentRedirect\("\/dashboard\/log-analysis"\)/);
  assert.match(
    dedicatedAnalyzer,
    /buildLogAnalysisStudioMetadata\(await getServerLocale\(\)\)/,
  );
  assert.doesNotMatch(dedicatedAnalyzer, /PerformanceTools/);
  assert.match(publicSnapshot, /useState<SnapshotResult \| null>\(null\)/);
  assert.match(publicSnapshot, /Nothing is calculated until you choose a file/);
  assert.doesNotMatch(publicSnapshot, /public-tools-translations/);
});

test("public log snapshot validates bounded local files and does not introduce persistence or network processing", () => {
  const publicSnapshot = source("src", "components", "tools", "PublicLogSnapshot.tsx");
  const workerBridge = source("src", "lib", "analyzePublicLogSnapshotInBrowser.ts");
  const workerModule = source("src", "workers", "publicLogSnapshot.worker.ts");
  const snapshotPolicy = source("src", "lib", "publicLogSnapshot.ts");

  assert.match(publicSnapshot, /publicLogSnapshotMaxFileBytes = publicLogSnapshotMaximumCharacters/);
  assert.match(publicSnapshot, /endsWith\("\.csv"\)/);
  assert.match(publicSnapshot, /endsWith\("\.txt"\)/);
  assert.match(publicSnapshot, /endsWith\("\.tsv"\)/);
  assert.match(publicSnapshot, /endsWith\("\.log"\)/);
  assert.match(publicSnapshot, /file\.size > publicLogSnapshotMaxFileBytes/);
  assert.doesNotMatch(publicSnapshot, /publicLogSnapshotMaxRows|sourceRowCount >|2_000/);
  assert.match(publicSnapshot, /await file\.text\(\)/);
  assert.match(publicSnapshot, /analysisRequestRef\.current/);
  assert.match(publicSnapshot, /if \(requestId !== analysisRequestRef\.current\) return/);
  assert.match(publicSnapshot, /analyzePublicLogSnapshotInBrowser\(text, signal\)/);
  assert.match(workerBridge, /new URL\("\.\.\/workers\/publicLogSnapshot\.worker\.ts"/);
  assert.match(workerBridge, /signal\?\.addEventListener\("abort", abort/);
  assert.match(workerBridge, /worker\.terminate\(\)/);
  assert.match(workerBridge, /publicSnapshotTimeoutMs = 15_000/);
  assert.match(workerModule, /analyzePublicLogSnapshot\(event\.data\.text\)/);
  assert.match(snapshotPolicy, /publicLogSnapshotMaximumCharacters = 5_000_000/);
  assert.match(snapshotPolicy, /publicLogSnapshotMaximumRows = 50_000/);
  assert.match(snapshotPolicy, /status: "incompatible" \| "insufficient_data" \| "unsupported_range"/);
  assert.match(snapshotPolicy, /pairedRows < publicLogSnapshotMinimumPairedRows/);
  assert.match(snapshotPolicy, /maximumRpm - minimumRpm < publicLogSnapshotMinimumRpmSpan/);
  assert.match(snapshotPolicy, /processedRows >= publicLogSnapshotMaximumRows/);
  assert.match(snapshotPolicy, /torqueRaw \* \(columns\.torque\.torqueFactor/);
  assert.doesNotMatch(snapshotPolicy, /^import /m);
  assert.doesNotMatch(snapshotPolicy, /logAnalysisStudio|performanceReport|analyzeLogStudio/);
  assert.doesNotMatch(publicSnapshot, /logAnalysisStudio|performanceReport|analyzeLogStudio/);
  assert.doesNotMatch(workerModule, /analysis:\s*analysis|LogStudioAnalysis/);
  assert.doesNotMatch(workerBridge, /logAnalysis\.worker|mode:\s*"full"/);
  assert.match(publicSnapshot, /aria-describedby="public-log-file-requirements public-log-unit-requirement"/);
  assert.match(publicSnapshot, /role="alert"/);
  assert.doesNotMatch(
    publicSnapshot,
    /fetch\(|XMLHttpRequest|supabase|localStorage|sessionStorage|indexedDB|FormData/
  );
});

test("public log snapshot keeps the homepage result concise and communicates its safety boundary", () => {
  const publicSnapshot = source("src", "components", "tools", "PublicLogSnapshot.tsx");
  const deferred = source("src", "components", "tools", "DeferredPerformanceTools.tsx");
  const resultsSource = publicSnapshot.slice(
    publicSnapshot.indexOf("function SnapshotResults"),
    publicSnapshot.indexOf("function SnapshotMetric")
  );

  for (const label of [
    "Peak torque",
    "Est. peak power",
    "Try example data",
    "Reset",
  ]) {
    assert.match(publicSnapshot, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(resultsSource, /unit="Nm"/);
  assert.match(resultsSource, /unit="HP"/);
  assert.doesNotMatch(resultsSource, /RPM window|Accepted rows|qualityScore|sortedPoints|PerformanceLogAnalysis|<svg|<table/);
  assert.doesNotMatch(publicSnapshot, /analysis: PerformanceLogAnalysis/);
  assert.match(publicSnapshot, /href="\/login\?redirect=%2Fdashboard%2Flog-analysis"/);
  assert.doesNotMatch(publicSnapshot, /href="\/tools\/autotuner-log-analyzer"|href="\/dashboard\/log-analysis"/);
  assert.match(publicSnapshot, /does not upload, store or create a request/);
  assert.match(publicSnapshot, /not a dyno measurement, diagnosis or tuning approval/);
  assert.match(publicSnapshot, /Engine Speed \(rpm\), Engine Torque Actual \(Nm\)/);
  assert.doesNotMatch(publicSnapshot, /Manual data input|PerformanceDataTable|Download detailed report/);
  assert.doesNotMatch(publicSnapshot, /AutoTuner/i);
  assert.match(deferred, /aria-label=\{copy\["Loading the free log snapshot"\]\}/);
  assert.match(deferred, /min-h-\[32rem\]/);
});

test("public snapshot publishes only an eligible multi-row, wide-RPM result", () => {
  const snapshot = analyzePublicLogSnapshot([
    "Engine Speed (rpm),Engine Torque Actual (Nm)",
    "1800,320",
    "2200,390",
    "2600,430",
    "3000,420",
    "3400,395",
    "3800,360",
    "4200,315",
  ].join("\n"));

  assert.equal(publicLogSnapshotMinimumPairedRows, 5);
  assert.equal(publicLogSnapshotMinimumRpmSpan, 1_000);
  assert.equal(snapshot.status, "ready");
  if (snapshot.status !== "ready") assert.fail("Expected an eligible public snapshot");
  assert.equal(snapshot.peakTorqueNm, 430);
  assert.ok(snapshot.peakPowerHp > 190 && snapshot.peakPowerHp < 200);
});

test("public snapshot with one paired row returns structured insufficient_data without numbers", () => {
  const snapshot = analyzePublicLogSnapshot(
    "Engine Speed (rpm),Engine Torque Actual (Nm)\n2500,400"
  );

  assert.deepEqual(snapshot, {
    status: "insufficient_data",
    peakTorqueNm: null,
    peakPowerHp: null,
    truncated: false,
  });
});

test("public snapshot rejects a narrow capture even when it has five paired rows", () => {
  const snapshot = analyzePublicLogSnapshot([
    "Engine Speed (rpm),Engine Torque Actual (Nm)",
    "2500,400",
    "2501,401",
    "2502,402",
    "2503,403",
    "2504,404",
  ].join("\n"));

  assert.equal(snapshot.status, "insufficient_data");
  assert.equal(snapshot.peakTorqueNm, null);
  assert.equal(snapshot.peakPowerHp, null);
});

test("public snapshot rejects absurd RPM and torque values without leaking calculated peaks", () => {
  const snapshot = analyzePublicLogSnapshot([
    "Engine Speed (rpm),Engine Torque Actual (Nm)",
    "10000,20000",
    "15000,20000",
    "20000,20000",
    "25000,20000",
    "30000,20000",
  ].join("\n"));

  assert.deepEqual(snapshot, {
    status: "unsupported_range",
    peakTorqueNm: null,
    peakPowerHp: null,
    truncated: false,
  });
});

test("public snapshot enforces explicit RPM, torque and estimated-power bounds", () => {
  assert.equal(publicLogSnapshotMaximumCharacters, 5_000_000);
  assert.equal(publicLogSnapshotMaximumRows, 50_000);
  assert.equal(publicLogSnapshotMinimumRpm, 400);
  assert.equal(publicLogSnapshotMaximumRpm, 12_000);
  assert.equal(publicLogSnapshotMinimumTorqueNm, 1);
  assert.equal(publicLogSnapshotMaximumTorqueNm, 5_000);
  assert.equal(publicLogSnapshotMinimumEstimatedPowerHp, 1);
  assert.equal(publicLogSnapshotMaximumEstimatedPowerHp, 5_000);

  const fixtures = [
    [
      "Engine Speed (rpm),Engine Torque Actual (Nm)",
      "100,400", "400,400", "700,400", "1000,400", "1300,400",
    ],
    [
      "Engine Speed (rpm),Engine Torque Actual (Nm)",
      "9000,400", "10000,400", "11000,400", "12000,400", "13000,400",
    ],
    [
      "Engine Speed (rpm),Engine Torque Actual (Nm)",
      "1000,0.5", "1500,0.5", "2000,0.5", "2500,0.5", "3000,0.5",
    ],
    [
      "Engine Speed (rpm),Engine Torque Actual (Nm)",
      "1000,5100", "1500,5100", "2000,5100", "2500,5100", "3000,5100",
    ],
    [
      "Engine Speed (rpm),Engine Torque Actual (Nm)",
      "400,1", "650,1", "900,1", "1150,1", "1400,1",
    ],
    [
      "Engine Speed (rpm),Engine Torque Actual (Nm)",
      "8000,4000", "9000,4000", "10000,4000", "11000,4000", "12000,4000",
    ],
  ];

  for (const fixture of fixtures) {
    const snapshot = analyzePublicLogSnapshot(fixture.join("\n"));
    assert.equal(snapshot.status, "unsupported_range");
    assert.equal(snapshot.peakTorqueNm, null);
    assert.equal(snapshot.peakPowerHp, null);
  }
});

test("public snapshot handles preambles, a separate units row and European semicolon exports", () => {
  const snapshot = analyzePublicLogSnapshot([
    "MG logger export",
    "Zeit;Motordrehzahl;Drehmoment Ist",
    "s;rpm;Nm",
    "0,0;1.800;320,0",
    "0,2;2.200;390,0",
    "0,4;2.600;430,0",
    "0,6;3.000;420,0",
    "0,8;3.400;395,0",
    "1,0;3.800;360,0",
    "1,2;4.200;315,0",
  ].join("\n"));

  assert.equal(snapshot.status, "ready");
  if (snapshot.status !== "ready") assert.fail("Expected a compatible European export");
  assert.equal(snapshot.peakTorqueNm, 430);
  assert.ok(snapshot.peakPowerHp > 190 && snapshot.peakPowerHp < 200);
});

test("public snapshot converts an explicit lb-ft actual-torque channel to Nm", () => {
  const snapshot = analyzePublicLogSnapshot([
    "Engine Speed [rpm]\tEngine Torque Actual [lb-ft]",
    "1800\t240",
    "2200\t285",
    "2600\t310",
    "3000\t305",
    "3400\t290",
    "3800\t265",
    "4200\t230",
  ].join("\n"));

  assert.equal(snapshot.status, "ready");
  if (snapshot.status !== "ready") assert.fail("Expected an explicit lb-ft export");
  assert.ok(snapshot.peakTorqueNm > 420 && snapshot.peakTorqueNm < 421);
});

test("public snapshot tolerates a low-load row when the final peak remains eligible", () => {
  const snapshot = analyzePublicLogSnapshot([
    "Engine Speed [rpm],Engine Torque Actual [Nm]",
    "500,5",
    "1800,220",
    "2200,250",
    "2600,280",
    "3000,270",
    "3400,240",
    "3800,210",
  ].join("\n"));

  assert.equal(snapshot.status, "ready");
  if (snapshot.status !== "ready") assert.fail("Expected the eligible peak to win");
  assert.equal(snapshot.peakTorqueNm, 280);
  assert.ok(snapshot.peakPowerHp > 110 && snapshot.peakPowerHp < 120);
});

test("public snapshot rejects sparse pairs and ambiguous torque grouping", () => {
  const sparse = analyzePublicLogSnapshot([
    "Engine Speed [rpm],Engine Torque Actual [Nm]",
    "1800,320",
    "2000,",
    "2200,390",
    "2400,",
    "2600,430",
    "2800,",
    "3000,420",
    "3200,",
    "3400,395",
  ].join("\n"));
  const ambiguous = analyzePublicLogSnapshot([
    "Engine Speed [rpm];Engine Torque Actual [Nm]",
    "1800;320.000",
    "2200;390.000",
    "2600;430.000",
    "3000;420.000",
    "3400;395.000",
  ].join("\n"));

  assert.equal(sparse.status, "insufficient_data");
  assert.equal(ambiguous.status, "incompatible");
});

test("public snapshot fails closed for requested torque and ambiguous actual channels", () => {
  const requested = analyzePublicLogSnapshot([
    "Engine Speed [rpm],Engine Torque Requested [Nm]",
    "1800,320",
    "2200,390",
    "2600,430",
    "3000,420",
    "3400,395",
  ].join("\n"));
  const ambiguous = analyzePublicLogSnapshot([
    "Engine Speed [rpm],Engine Torque Actual A [Nm],Engine Torque Actual B [Nm]",
    "1800,320,318",
    "2200,390,388",
    "2600,430,428",
    "3000,420,418",
    "3400,395,393",
  ].join("\n"));
  const unitless = analyzePublicLogSnapshot([
    "Engine Speed [rpm],Engine Torque Actual",
    "1800,320",
    "2200,390",
    "2600,430",
    "3000,420",
    "3400,395",
  ].join("\n"));
  const abbreviatedTarget = analyzePublicLogSnapshot([
    "RPM SP,Driver’s Wish Torque [Nm]",
    "1800,320",
    "2200,390",
    "2600,430",
    "3000,420",
    "3400,395",
  ].join("\n"));

  assert.equal(requested.status, "incompatible");
  assert.equal(ambiguous.status, "incompatible");
  assert.equal(unitless.status, "incompatible");
  assert.equal(abbreviatedTarget.status, "incompatible");
  assert.equal(requested.peakPowerHp, null);
  assert.equal(ambiguous.peakTorqueNm, null);
});
