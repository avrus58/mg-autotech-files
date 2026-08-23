import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

function source(...segments: string[]) {
  return readFileSync(path.join(process.cwd(), ...segments), "utf8");
}

test("homepage combined mode uses the compact log-first snapshot while the full public analyzer stays intact", () => {
  const performanceTools = source("src", "components", "tools", "PerformanceTools.tsx");
  const publicSnapshot = source("src", "components", "tools", "PublicLogSnapshot.tsx");
  const dedicatedAnalyzer = source("src", "app", "tools", "autotuner-log-analyzer", "page.tsx");

  assert.match(performanceTools, /import \{ PublicLogSnapshot \}/);
  assert.match(performanceTools, /if \(mode === "combined"\) \{\s*return <PublicLogSnapshot \/>;/);
  assert.match(dedicatedAnalyzer, /<PerformanceTools mode="log" \/>/);
  assert.match(publicSnapshot, /useState<SnapshotResult \| null>\(null\)/);
  assert.match(publicSnapshot, /Nothing is calculated until you choose a file/);
});

test("public log snapshot validates bounded local files and does not introduce persistence or network processing", () => {
  const publicSnapshot = source("src", "components", "tools", "PublicLogSnapshot.tsx");

  assert.match(publicSnapshot, /publicLogSnapshotMaxFileBytes = 1_000_000/);
  assert.match(publicSnapshot, /publicLogSnapshotMaxRows = 2_000/);
  assert.match(publicSnapshot, /endsWith\("\.csv"\)/);
  assert.match(publicSnapshot, /endsWith\("\.txt"\)/);
  assert.match(publicSnapshot, /file\.size > publicLogSnapshotMaxFileBytes/);
  assert.match(publicSnapshot, /parsed\.sourceRowCount > publicLogSnapshotMaxRows/);
  assert.match(publicSnapshot, /await file\.text\(\)/);
  assert.match(publicSnapshot, /analysisRequestRef\.current/);
  assert.match(publicSnapshot, /if \(requestId !== analysisRequestRef\.current\) return/);
  assert.match(publicSnapshot, /parsePerformanceLog\(text\)/);
  assert.match(publicSnapshot, /analyzePerformanceLog\(parsed\)/);
  assert.match(publicSnapshot, /role="alert"/);
  assert.doesNotMatch(
    publicSnapshot,
    /fetch\(|XMLHttpRequest|supabase|localStorage|sessionStorage|indexedDB|FormData/
  );
});

test("public log snapshot keeps the homepage result concise and communicates its safety boundary", () => {
  const publicSnapshot = source("src", "components", "tools", "PublicLogSnapshot.tsx");
  const deferred = source("src", "components", "tools", "DeferredPerformanceTools.tsx");

  for (const label of [
    "Peak torque",
    "Est. peak power",
    "RPM window",
    "Accepted rows",
    "Try example data",
    "Reset",
  ]) {
    assert.match(publicSnapshot, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(publicSnapshot, /aria-label="Quick torque and estimated power curve across engine speed"/);
  assert.match(publicSnapshot, /href="\/tools\/autotuner-log-analyzer"/);
  assert.match(publicSnapshot, /href="\/dashboard\/log-analysis"/);
  assert.match(publicSnapshot, /does not upload, store or create a request/);
  assert.match(publicSnapshot, /not a dyno measurement, diagnosis or tuning approval/);
  assert.doesNotMatch(publicSnapshot, /Manual data input|PerformanceDataTable|Download detailed report/);
  assert.match(deferred, /aria-label="Free log snapshot loading"/);
  assert.match(deferred, /min-h-\[38rem\]/);
});
