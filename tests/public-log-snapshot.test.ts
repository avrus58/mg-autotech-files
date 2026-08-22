import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

function source(...segments: string[]) {
  return readFileSync(path.join(process.cwd(), ...segments), "utf8");
}

test("homepage combined mode uses the compact snapshot while the old public analyzer redirects into the protected dashboard", () => {
  const performanceTools = source("src", "components", "tools", "PerformanceTools.tsx");
  const publicSnapshot = source("src", "components", "tools", "PublicLogSnapshot.tsx");
  const dedicatedAnalyzer = source("src", "app", "tools", "autotuner-log-analyzer", "page.tsx");

  assert.match(performanceTools, /import \{ PublicLogSnapshot \}/);
  assert.match(performanceTools, /if \(mode === "combined"\) \{\s*return <PublicLogSnapshot \/>;/);
  assert.match(performanceTools, /PerformanceToolsMode = "combined" \| "calculator"/);
  assert.doesNotMatch(performanceTools, /DetailedPerformanceTools|PerformanceCurveChart|PerformanceDataTable/);
  assert.doesNotMatch(performanceTools, /parsePerformanceLog|analyzePerformanceLog|buildPerformanceReportSvg/);
  assert.match(dedicatedAnalyzer, /permanentRedirect\("\/dashboard\/log-analysis"\)/);
  assert.match(dedicatedAnalyzer, /robots: \{ index: false, follow: false \}/);
  assert.doesNotMatch(dedicatedAnalyzer, /PerformanceTools/);
  assert.match(publicSnapshot, /useState<SnapshotResult \| null>\(null\)/);
  assert.match(publicSnapshot, /Nothing is calculated until you choose a file/);
});

test("public log snapshot validates bounded local files and does not introduce persistence or network processing", () => {
  const publicSnapshot = source("src", "components", "tools", "PublicLogSnapshot.tsx");
  const workerBridge = source("src", "lib", "analyzePublicLogSnapshotInBrowser.ts");
  const workerModule = source("src", "workers", "publicLogSnapshot.worker.ts");

  assert.match(publicSnapshot, /publicLogSnapshotMaxFileBytes = maxLogStudioCharacters/);
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
  assert.match(workerModule, /performanceFromStudioAnalysis\(analysis\)/);
  assert.match(workerModule, /profile: "performance"/);
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
  assert.match(deferred, /aria-label="Free log snapshot loading"/);
  assert.match(deferred, /min-h-\[38rem\]/);
});
