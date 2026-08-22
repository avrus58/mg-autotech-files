import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  analyzeLogStudio,
  maxLogStudioChannels,
  maxLogStudioCharacters,
  maxLogStudioRows,
} from "../src/lib/logAnalysisStudio";

function channelById(input: ReturnType<typeof analyzeLogStudio>, id: string) {
  const channel = input.channels.find((item) => item.id === id);
  assert.ok(channel, `Expected channel ${id}`);
  return channel;
}

function summaryById(input: ReturnType<typeof analyzeLogStudio>, id: string) {
  const summary = input.summaries.find((item) => item.channelId === id);
  assert.ok(summary, `Expected summary ${id}`);
  return summary;
}

const professionalSemicolonLog = [
  '"Time [s]";"Engine Speed (rpm)";"Engine Torque (Nm)";"Boost Pressure Actual [bar]";"Boost Pressure Target [mbar]";"Lambda";"Throttle Position [%]";"Intake Air Temperature [degC]";"Coolant Temperature [degC]";"EGT 1 [degC]";"Rail Pressure Actual [bar]";"Rail Pressure Target [MPa]";"Mass Air Flow [g/s]";"Vehicle Speed [km/h]";"Ignition Timing [deg]"',
  '"0,0";"1800";"320,5";"1,20";"1250";"0,980";"54,0";"28,0";"88,0";"510";"1500";"150";"71,0";"48";"4,0"',
  '"0,5";"2200";"390,0";"1,55";"1600";"0,970";"72,0";"31,0";"89,0";"540";"1600";"161";"88,0";"62";"5,0"',
  '"1,0";"2600";"430,0";"1,90";"2000";"0,960";"95,0";"35,0";"90,0";"580";"1700";"172";"102,0";"79";"6,0"',
  '"1,5";"3200";"410,0";"2,10";"2050";"0,955";"100,0";"39,0";"91,0";"620";"1750";"174";"112,0";"101";"7,0"',
  '"2,0";"3800";"360,0";"1,85";"1900";"0,965";"100,0";"44,0";"92,0";"660";"1650";"167";"104,0";"118";"8,0"',
].join("\n");

test("multi-channel studio parses quoted semicolon logs and retains aligned values with units", () => {
  const result = analyzeLogStudio(professionalSemicolonLog);

  assert.equal(result.contractVersion, "log-analysis-studio-v1");
  assert.equal(result.status, "ready");
  assert.equal(result.delimiter, ";");
  assert.equal(result.source.acceptedRowCount, 5);
  assert.equal(result.source.rejectedRowCount, 0);
  assert.equal(result.channels.length, 15);
  assert.equal(result.xAxis?.kind, "rpm");
  assert.equal(result.xAxis?.channelId, "rpm");
  assert.equal(result.xAxis?.synthetic, false);

  assert.equal(channelById(result, "boost-actual").unit.symbol, "bar");
  assert.equal(channelById(result, "boost-target").unit.symbol, "mbar");
  assert.equal(channelById(result, "rail-target").unit.canonicalSymbol, "kPa");
  assert.equal(channelById(result, "iat").unit.dimension, "temperature");
  assert.equal(channelById(result, "airflow").unit.symbol, "g/s");
  assert.equal(channelById(result, "speed").unit.symbol, "km/h");

  assert.equal(result.rows[2].values.rpm, 2600);
  assert.equal(result.rows[2].values.torque, 430);
  assert.equal(result.rows[2].values["boost-actual"], 1.9);
  assert.equal(result.rows[2].values.lambda, 0.96);
  assert.equal(result.rows[2].values.iat, 35);
  assert.equal(result.rows[2].values["rail-target"], 172);
});

test("studio summaries expose min, max, average and peak x-axis context", () => {
  const result = analyzeLogStudio(professionalSemicolonLog);
  const torque = summaryById(result, "torque");
  const boost = summaryById(result, "boost-actual");

  assert.equal(torque.min?.value, 320.5);
  assert.equal(torque.max?.value, 430);
  assert.equal(torque.peak?.value, 430);
  assert.equal(torque.peak?.xValue, 2600);
  assert.equal(torque.peak?.xLabel, "2600 rpm");
  assert.equal(torque.average, 382.1);
  assert.equal(boost.min?.value, 1.2);
  assert.equal(boost.max?.value, 2.1);
  assert.equal(boost.coveragePercent, 100);
});

test("boost peak and unit-converted actual-target gaps require real detected channels", () => {
  const result = analyzeLogStudio(professionalSemicolonLog);
  const boostPeak = result.insights.find((item) => item.kind === "boost_peak");
  const comparisons = result.insights.filter((item) => item.kind === "actual_target_gap");

  assert.ok(boostPeak);
  assert.deepEqual(boostPeak.channelIds, ["boost-actual"]);
  assert.match(boostPeak.text, /2\.1 bar at 3200 rpm/);
  assert.equal(comparisons.length, 2);
  assert.ok(comparisons.some((item) => item.title === "Boost pressure actual vs target"));
  assert.ok(comparisons.some((item) => item.title === "Rail pressure actual vs target"));
  assert.doesNotMatch(comparisons.map((item) => item.text).join(" "), /safe|approved|diagnos/i);
});

test("logs without a boost channel never receive a boost-derived insight", () => {
  const result = analyzeLogStudio(
    "Engine Speed (rpm),Engine Torque (Nm)\n1800,320\n2200,390\n2600,430\n3200,410\n3800,360"
  );

  assert.equal(result.status, "ready");
  assert.equal(result.channels.some((channel) => channel.kind === "boost_actual"), false);
  assert.equal(result.insights.some((insight) => insight.kind === "boost_peak"), false);
  assert.equal(result.insights.some((insight) => insight.kind === "actual_target_gap"), false);
  assert.ok(result.missingChannels.includes("Boost pressure actual"));
});

test("actual-target comparison is skipped for incompatible or differently referenced units", () => {
  const incompatible = analyzeLogStudio(
    "RPM,Boost Actual [bar],Boost Target [V]\n1800,1.2,2.5\n2200,1.5,2.8\n2600,1.8,3.0"
  );
  const pressureReferenceMismatch = analyzeLogStudio(
    "RPM,Boost Actual [bara],Boost Target [barg]\n1800,2.2,1.2\n2200,2.5,1.5\n2600,2.8,1.8"
  );

  for (const result of [incompatible, pressureReferenceMismatch]) {
    assert.equal(result.insights.some((item) => item.kind === "actual_target_gap"), false);
    assert.ok(result.warnings.some((warning) => /no gap was calculated/i.test(warning)));
  }
});

test("comma-delimited quoted cells retain decimal-comma numeric values", () => {
  const result = analyzeLogStudio([
    '"Time (s)","Engine Speed (rpm)","Boost Actual (bar)","AFR"',
    '"0,1","1800","1,25","14,7"',
    '"0,2","2200","1,55","14,4"',
    '"0,3","2600","1,80","14,1"',
  ].join("\n"));

  assert.equal(result.delimiter, ",");
  assert.equal(result.rows[0].values.time, 0.1);
  assert.equal(result.rows[0].values["boost-actual"], 1.25);
  assert.equal(result.rows[2].values.afr, 14.1);
  assert.equal(result.xAxis?.kind, "rpm");
});

test("tab-delimited logs choose explicit sample when RPM and time are absent", () => {
  const result = analyzeLogStudio(
    "Sample\tPedal Position [%]\tLambda\n1\t20\t1.02\n2\t55\t0.99\n3\t100\t0.96"
  );

  assert.equal(result.delimiter, "\t");
  assert.equal(result.xAxis?.kind, "sample");
  assert.equal(result.xAxis?.channelId, "sample");
  assert.equal(result.xAxis?.synthetic, false);
  assert.equal(channelById(result, "pedal").kind, "pedal");
});

test("time is selected before a synthetic sample axis when RPM is unavailable", () => {
  const result = analyzeLogStudio(
    "Time [ms];Coolant Temperature [degC];Vehicle Speed [mph]\n0;80;20\n250;82;25\n500;84;30"
  );

  assert.equal(result.xAxis?.kind, "time");
  assert.equal(result.xAxis?.unit.symbol, "ms");
  assert.equal(channelById(result, "speed").unit.canonicalSymbol, "km/h");
});

test("header qualifiers are not displayed or converted as measurement units", () => {
  const result = analyzeLogStudio(
    "Engine Speed (actual),MAP Pressure (absolute),Boost Target [bar] (requested)\n2500,180,1.8\n3000,195,2.0"
  );
  const rpm = channelById(result, "rpm");
  const map = channelById(result, "boost-actual");
  const target = channelById(result, "boost-target");

  assert.equal(rpm.unit.raw, null);
  assert.equal(rpm.unit.symbol, "rpm");
  assert.equal(rpm.unit.dimension, "engine_speed");
  assert.equal(map.unit.raw, null);
  assert.equal(map.unit.symbol, null);
  assert.equal(map.unit.dimension, "pressure");
  assert.equal(map.unit.pressureReference, "absolute");
  assert.equal(target.unit.raw, "bar");
  assert.equal(target.unit.symbol, "bar");
});

test("row number is a visible synthetic fallback when no RPM, time or sample channel exists", () => {
  const result = analyzeLogStudio(
    "Coolant Temperature [degC],Lambda\n80,1.02\n82,0.99\n84,0.97"
  );

  assert.equal(result.status, "ready");
  assert.equal(result.xAxis?.kind, "sample");
  assert.equal(result.xAxis?.channelId, null);
  assert.equal(result.xAxis?.synthetic, true);
  assert.ok(result.warnings.some((warning) => /row number is used as the x-axis/i.test(warning)));
  assert.equal(result.quality.label, "limited");
});

test("legacy headerless RPM and torque rows remain bounded and explicit", () => {
  const result = analyzeLogStudio(
    "1800,320\n2200,390\n2600,430\n3200,410\n3800,360"
  );

  assert.equal(result.status, "ready");
  assert.equal(result.xAxis?.kind, "rpm");
  assert.equal(result.channels[0].kind, "rpm");
  assert.equal(result.channels[1].kind, "torque");
  assert.equal(result.source.sourceRowCount, 5);
  assert.ok(result.warnings.some((warning) => /treated as RPM and torque rows/i.test(warning)));
});

test("row, channel and character limits are enforced independently", () => {
  const manyRows = [
    "Sample,RPM,Engine Torque (Nm)",
    ...Array.from({ length: maxLogStudioRows + 105 }, (_, index) =>
      `${index + 1},${1_500 + index},${300 + (index % 50)}`
    ),
  ].join("\n");
  const rowBounded = analyzeLogStudio(manyRows);

  assert.equal(rowBounded.truncated.rows, true);
  assert.equal(rowBounded.source.sourceRowCount, maxLogStudioRows + 105);
  assert.equal(rowBounded.source.processedRowCount, maxLogStudioRows);
  assert.equal(rowBounded.rows.length, maxLogStudioRows);

  const channelHeaders = ["RPM", ...Array.from({ length: 30 }, (_, index) => `Sensor ${index + 1}`)];
  const manyChannels = analyzeLogStudio([
    channelHeaders.join(","),
    channelHeaders.map((_, index) => 1_000 + index).join(","),
    channelHeaders.map((_, index) => 1_100 + index).join(","),
  ].join("\n"));

  assert.equal(manyChannels.truncated.channels, true);
  assert.equal(manyChannels.channels.length, maxLogStudioChannels);
  assert.ok(manyChannels.channels.some((channel) => channel.kind === "rpm"));

  const oversized = [
    "Time [s],RPM,Engine Torque (Nm)",
    ...Array.from({ length: 20_000 }, (_, index) => `${index / 10},${1_500 + index},320`),
  ].join("\n");
  assert.ok(oversized.length > maxLogStudioCharacters);
  const characterBounded = analyzeLogStudio(oversized);

  assert.equal(characterBounded.truncated.characters, true);
  assert.ok(characterBounded.source.processedRowCount <= maxLogStudioRows);
  assert.ok(characterBounded.warnings.some((warning) => /first 120,000 characters/i.test(warning)));
});

test("quality is evidence-based and exposes structural reasons without a technical verdict", () => {
  const strong = analyzeLogStudio(professionalSemicolonLog);
  const limited = analyzeLogStudio(
    "RPM,Torque [Nm]\n2200,390\n1800,320\n2200,"
  );

  assert.equal(strong.quality.label, "strong");
  assert.ok(strong.quality.score >= 85);
  assert.equal(strong.quality.xAxisMonotonic, true);
  assert.equal(limited.quality.label, "limited");
  assert.equal(limited.quality.xAxisMonotonic, false);
  assert.equal(limited.quality.duplicateXAxisCount, 1);
  assert.ok(limited.quality.reasons.some((reason) => /not monotonic/i.test(reason)));

  const outputText = limited.insights.map((item) => item.text).join(" ");
  assert.doesNotMatch(outputText, /safe to flash|tune approved|checksum complete|fault confirmed|repair required/i);
});

test("empty and unsupported input fail closed with missing-channel guidance", () => {
  const empty = analyzeLogStudio("   ");
  const unsupported = analyzeLogStudio("not a delimited log");
  const textOnly = analyzeLogStudio("Name,Comment\nCar,Private\nRun,Notes");

  assert.equal(empty.status, "empty");
  assert.equal(unsupported.status, "invalid");
  assert.equal(textOnly.status, "invalid");
  assert.equal(textOnly.rows.length, 0);
  assert.ok(empty.missingChannels.includes("Engine speed (RPM)"));
  assert.ok(empty.safetyBoundaries.every((item) => /does not|not a|no result/i.test(item)));
});

test("the studio engine remains pure, browser-local and dependency-free", () => {
  const source = readFileSync(
    path.join(process.cwd(), "src", "lib", "logAnalysisStudio.ts"),
    "utf8"
  );

  assert.doesNotMatch(
    source,
    /fetch\(|XMLHttpRequest|WebSocket|supabase|localStorage|sessionStorage|indexedDB|process\.env|\bwindow\.(?:location|navigator|addEventListener|setTimeout|setInterval)|\bdocument\.(?:querySelector|createElement|body)|createClient|^\s*import\s.+from\s+["']/im
  );
  assert.match(source, /maxLogStudioCharacters = 120_000/);
  assert.match(source, /maxLogStudioRows = 2_000/);
  assert.match(source, /maxLogStudioChannels = 24/);
});
