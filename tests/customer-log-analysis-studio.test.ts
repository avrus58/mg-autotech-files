import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function readProjectFile(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

const route = readProjectFile("src", "app", "dashboard", "log-analysis", "page.tsx");
const dashboardLayout = readProjectFile("src", "app", "dashboard", "layout.tsx");
const studio = readProjectFile("src", "components", "dashboard", "LogAnalysisStudio.tsx");
const studioLoader = readProjectFile("src", "components", "dashboard", "LogAnalysisStudioLoader.tsx");
const engine = readProjectFile("src", "lib", "logAnalysisStudio.ts");
const workerBridge = readProjectFile("src", "lib", "analyzeLogStudioInBrowser.ts");
const workerModule = readProjectFile("src", "workers", "logAnalysis.worker.ts");

test("the customer Log Analysis Studio route stays protected and loads its private bundle lazily", () => {
  assert.match(route, /import \{ LogAnalysisStudioLoader \} from "@\/components\/dashboard\/LogAnalysisStudioLoader"/);
  assert.match(route, /return <LogAnalysisStudioLoader \/>/);
  assert.match(route, /robots: \{ index: false, follow: false \}/);

  assert.match(studioLoader, /^"use client"/);
  assert.match(studioLoader, /dynamic\(/);
  assert.match(studioLoader, /import\("@\/components\/dashboard\/LogAnalysisStudio"\)/);
  assert.match(studioLoader, /ssr: false/);
  assert.match(studioLoader, /Opening your private datalog workspace/);
  assert.match(studioLoader, /await supabase\.auth\.getUser\(\)/);
  assert.match(studioLoader, /accessState !== "verified"/);
  assert.match(studioLoader, /return <LogAnalysisStudio \/>/);
  assert.match(studioLoader, /error\.status === 401/);

  assert.match(dashboardLayout, /<BrowserAuthBoundary/);
  assert.match(dashboardLayout, /<RegistrationCountryBoundary>/);
  assert.match(dashboardLayout, /\{children\}/);
});

test("log files are processed locally with explicit format and resource bounds", () => {
  assert.match(studio, /^"use client"/);
  assert.match(studio, /name\.endsWith\("\.csv"\)/);
  assert.match(studio, /name\.endsWith\("\.txt"\)/);
  assert.match(studio, /name\.endsWith\("\.tsv"\)/);
  assert.match(studio, /name\.endsWith\("\.log"\)/);
  assert.match(studio, /file\.size > maxLogStudioCharacters/);
  assert.match(studio, /const text = await file\.text\(\)/);
  assert.match(studio, /if \(requestId !== analysisRequestRef\.current\) return/);
  assert.match(studio, /await analyzeText\(text, file\.name, file\.size, false, requestId, controller\.signal\)/);
  assert.match(studio, /analyzeLogStudioInBrowser\(text, signal\)/);
  assert.match(workerBridge, /new Worker/);
  assert.match(workerBridge, /worker\.terminate\(\)/);
  assert.match(workerBridge, /signal\?\.addEventListener\("abort", abort/);
  assert.match(workerBridge, /logAnalysisTimeoutMs = 15_000/);
  assert.match(workerModule, /analyzeLogStudio\(event\.data\.text\)/);
  assert.match(studio, /No upload, cloud storage or request is created\./);
  assert.match(studio, /Included with your customer account; no credits are used\./);

  assert.match(engine, /export const maxLogStudioCharacters = 5_000_000/);
  assert.match(engine, /export const maxLogStudioRows = 50_000/);
  assert.match(engine, /export const maxLogStudioFullRows = 15_000/);
  assert.match(engine, /export const maxLogStudioChannels = 64/);
  assert.match(engine, /export const maxLogStudioCells = 500_000/);
  assert.match(engine, /input\.slice\(0, maxLogStudioCharacters\)/);
  assert.match(engine, /profileRowLimit = options\.profile === "performance"/);
  assert.match(engine, /processedRowLimit = Math\.min\(profileRowLimit, rowsWithinCellBudget\)/);
  assert.match(engine, /dataLines\.slice\(0, processedRowLimit\)/);
  assert.match(engine, /\.slice\(0, maxLogStudioChannels\)/);

  for (const source of [studio, engine]) {
    assert.doesNotMatch(source, /\bfetch\s*\(/);
    assert.doesNotMatch(source, /\bsupabase\b/i);
    assert.doesNotMatch(source, /\b(?:localStorage|sessionStorage|indexedDB|FormData|XMLHttpRequest)\b/);
    assert.doesNotMatch(source, /navigator\.sendBeacon/);
  }
});

test("the studio opens idle and loads only an explicitly requested synthetic demo", () => {
  assert.match(studio, /useState<StudioState>\("idle"\)/);
  assert.match(studio, /const \[analysis, setAnalysis\] = useState<LogStudioAnalysis>\(emptyAnalysis\)/);
  assert.match(studio, /const loadDemo = \(\) => \{[\s\S]*"Synthetic multi-channel demo\.csv",[\s\S]*true,[\s\S]*requestId,[\s\S]*controller\.signal/);
  assert.match(studio, /onClick=\{onDemo\}[\s\S]*Try synthetic demo/);
  assert.match(studio, /The studio is ready for a real log\./);
  assert.match(studio, /Synthetic demonstration data—never a real vehicle result\./);
  assert.match(studio, /useEffect\(\(\) => \(\) => analysisAbortRef\.current\?\.abort\(\), \[\]\)/);
  assert.doesNotMatch(studio, /useEffect\([\s\S]{0,160}(?:loadDemo|analyzeText|handleFile)/);
});

test("the analysis workspace caps overlays and provides tabs plus a row inspector", () => {
  assert.match(studio, /const maxSelectedChannels = 3/);
  assert.match(studio, /\.slice\(0, maxSelectedChannels\)/);
  assert.match(studio, /if \(current\.length >= maxSelectedChannels\) return current/);
  assert.match(studio, /role="tablist" aria-label="Log analysis view"/);
  assert.match(studio, /role="tab"/);
  assert.match(studio, /role="tabpanel"/);
  assert.match(studio, /aria-controls=\{`studio-panel-\$\{value\}`\}/);
  assert.match(studio, /event\.key === "ArrowRight"/);
  assert.match(studio, /label="Overview"/);
  assert.match(studio, /label="Channels"/);
  assert.match(studio, /label="Data rows"/);
  assert.match(studio, /type="range"[\s\S]*nearestRowIndexForAxisRatio\(Number\(event\.target\.value\) \/ 1_000, analysis\)/);
  assert.match(studio, /Row inspector/);
  assert.match(studio, /const visibleRows = analysis\.rows\.slice\(0, 120\)/);
});

test("the customer Studio prioritizes power, torque and RPM while retaining every detected channel", () => {
  assert.match(studio, /performanceFromStudioAnalysis\(analysis\)/);
  assert.match(studio, /label="Estimated peak power"/);
  assert.match(studio, /label="Highest logged torque"/);
  assert.match(studio, /label="Engine-speed window"/);
  assert.match(studio, /Requires one unambiguous RPM channel and one actual engine-torque channel with a known unit/);
  assert.match(studio, /Requested, non-engine, ambiguous or unitless torque is never used for power/);
  assert.match(studio, /summary\.channelId === performanceSource\.rpmChannelId/);
  assert.match(studio, /performanceSource\?\.loggedPeakTorqueNm/);
  assert.match(studio, /More details/);
  assert.match(studio, /Highest logged EGT/);
  assert.match(studio, /function highestEgtSummary/);
  assert.match(studio, /rightCanonical - leftCanonical/);
  assert.match(studio, /EGR signal observation/);
  assert.match(studio, /EGR signal actual vs target/);
  assert.match(studio, /analysis\.channels\.map\(\(channel\) =>/);
  assert.match(studio, /Every retained numeric channel/);
});

test("the Studio chart uses detected time, RPM or sample values rather than row spacing", () => {
  assert.match(studio, /function axisRange\(analysis: LogStudioAnalysis\)/);
  assert.match(studio, /function axisRatioForRow\(row: LogStudioRow \| undefined, rowIndex: number, analysis: LogStudioAnalysis\)/);
  assert.match(studio, /const axisRatio = axisRatioForRowWithRange\(row, index, analysis, range\)/);
  assert.match(studio, /const representativeIndexes = new Set\(representativeRowIndexes\(analysis\.rows\.length\)\)/);
  assert.match(studio, /analysis\.rows\.forEach\(\(row, index\) =>/);
  assert.match(studio, /!Number\.isFinite\(value\)/);
  assert.match(studio, /function rawSummaryRange\(analysis: LogStudioAnalysis/);
  assert.match(studio, /value < channelRange\.min/);
  assert.match(studio, /axisRatio === null/);
  assert.match(studio, /axisTickLabel\(analysis, ratio\)/);
  assert.match(studio, /const channelRange = rawSummaryRange\(analysis, channelSummary\)/);
  assert.match(studio, /value > channelRange\.max/);
  assert.match(studio, /detected time, RPM or explicit sample axis/);
  assert.match(studio, /aria-valuetext=/);
  assert.match(studio, /nearestRowIndexForAxisRatio/);
  assert.match(studio, /max=\{1_000\}/);
  assert.match(studio, /<div className="min-w-\[42rem\] sm:min-w-0">[\s\S]*<svg[\s\S]*<label className="mt-2 block">/);
});

test("quality is described as capture structure with explicit technical boundaries", () => {
  assert.match(studio, /Structure: \$\{analysis\.quality\.label\}/);
  assert.match(studio, /\{analysis\.quality\.label\} structure/);
  assert.match(studio, /Capture structure/);
  assert.match(studio, /Descriptive log review—not a dyno or diagnosis\./);
  assert.match(studio, /not a dyno result, diagnosis, calibration approval, component limit or flash-safety decision/);

  assert.match(engine, /does not diagnose a fault or select a repair path/);
  assert.match(engine, /not a calibrated dyno measurement/);
  assert.match(engine, /No result approves a tune, calibration, checksum, flash operation, component limit, vehicle safety or delivery decision/);
  assert.doesNotMatch(studio, /(?:dyno|diagnosis|tune approval) (?:confirmed|validated|approved)/i);
});

test("customer dashboard navigation exposes the Studio on dashboard and orders surfaces", () => {
  const dashboard = readProjectFile("src", "components", "dashboard", "DashboardClient.tsx");
  const orders = readProjectFile("src", "app", "dashboard", "orders", "page.tsx");
  const dashboardLinks = dashboard.match(/href="\/dashboard\/log-analysis"/g) ?? [];

  assert.ok(dashboardLinks.length >= 2, "dashboard should expose desktop and compact Studio navigation");
  assert.match(dashboard, /Datalog Analysis Studio/);
  assert.match(dashboard, /Datalog Studio/);
  assert.match(orders, /href="\/dashboard\/log-analysis"/);
  assert.match(orders, /label="Datalog Analysis Studio"/);
});
