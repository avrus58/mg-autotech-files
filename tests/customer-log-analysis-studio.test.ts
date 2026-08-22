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
const engine = readProjectFile("src", "lib", "logAnalysisStudio.ts");

test("the customer Log Analysis Studio route stays inside the protected dashboard layout", () => {
  assert.match(route, /import \{ LogAnalysisStudio \} from "@\/components\/dashboard\/LogAnalysisStudio"/);
  assert.match(route, /return <LogAnalysisStudio \/>/);
  assert.match(route, /robots: \{ index: false, follow: false \}/);

  assert.match(dashboardLayout, /<BrowserAuthBoundary/);
  assert.match(dashboardLayout, /<RegistrationCountryBoundary>/);
  assert.match(dashboardLayout, /\{children\}/);
});

test("log files are processed locally with explicit format and resource bounds", () => {
  assert.match(studio, /^"use client"/);
  assert.match(studio, /name\.endsWith\("\.csv"\)/);
  assert.match(studio, /name\.endsWith\("\.txt"\)/);
  assert.match(studio, /name\.endsWith\("\.tsv"\)/);
  assert.match(studio, /file\.size > maxLogStudioCharacters/);
  assert.match(studio, /const text = await file\.text\(\)/);
  assert.match(studio, /if \(requestId !== analysisRequestRef\.current\) return/);
  assert.match(studio, /analyzeText\(text, file\.name, file\.size, false\)/);
  assert.match(studio, /No upload, cloud storage or request is created\./);

  assert.match(engine, /export const maxLogStudioCharacters = 120_000/);
  assert.match(engine, /export const maxLogStudioRows = 2_000/);
  assert.match(engine, /export const maxLogStudioChannels = 24/);
  assert.match(engine, /input\.slice\(0, maxLogStudioCharacters\)/);
  assert.match(engine, /dataLines\.slice\(0, maxLogStudioRows\)/);
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
  assert.match(studio, /const loadDemo = \(\) => \{[\s\S]*analyzeText\(buildDemoLog\(\), "Synthetic multi-channel demo\.csv", null, true\)/);
  assert.match(studio, /onClick=\{onDemo\}[\s\S]*Try synthetic demo/);
  assert.match(studio, /The studio is ready for a real log\./);
  assert.match(studio, /Synthetic demonstration data—never a real vehicle result\./);
  assert.doesNotMatch(studio, /\buseEffect\b/);
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
  assert.match(studio, /type="range"[\s\S]*onActiveRow\(Number\(event\.target\.value\)\)/);
  assert.match(studio, /Row inspector/);
  assert.match(studio, /const visibleRows = analysis\.rows\.slice\(0, 120\)/);
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
  assert.match(dashboard, /Log Analysis Studio/);
  assert.match(dashboard, /Log Studio/);
  assert.match(orders, /href="\/dashboard\/log-analysis"/);
  assert.match(orders, /label="Log Analysis Studio"/);
});
