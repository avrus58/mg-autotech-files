import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  analyzeLogStudio,
  extractLogStudioPerformanceRows,
  maxLogStudioChannels,
  maxLogStudioCharacters,
  maxLogStudioCells,
  maxLogStudioFullRows,
  maxLogStudioRows,
} from "../src/lib/logAnalysisStudio";
import {
  buildDeterministicLogAnalyzerFallback,
  parseLogAnalyzerText,
} from "../src/lib/logAnalyzer/fallback";
import { performanceSourceFromStudioAnalysis } from "../src/lib/performanceReport";
import {
  axisRatioForRow,
  channelPath,
  peakContext,
} from "../src/components/dashboard/LogAnalysisStudio";

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

const genericGermanToolLog = [
  "Logger export: compatible delimited text",
  "Vehicle session: local test fixture",
  "Zeit;Motordrehzahl;Drehmoment Ist;Drehmoment Soll;Abgastemperatur Bank 1;AGR Ventil Ist;AGR Ventil Soll;Ladedruck Ist;Ladedruck Soll;Einspritzmenge;Batteriespannung;Unmapped Sensor",
  "s;1/min;Nm;Nm;°C;%;%;mbar;mbar;mg/Hub;V;raw",
  "0,0;1800;280;300;440;75;80;1200;1250;35;13,8;7",
  "0,5;2400;360;390;525;48;55;1550;1600;48;13,9;9",
  "1,0;3100;410;430;620;18;25;1950;2000;58;14,1;12",
].join("\n");

test("multi-channel studio parses quoted semicolon logs and retains aligned values with units", () => {
  const result = analyzeLogStudio(professionalSemicolonLog);

  assert.equal(result.contractVersion, "log-analysis-studio-v1");
  assert.equal(result.status, "ready");
  assert.equal(result.delimiter, ";");
  assert.equal(result.source.acceptedRowCount, 5);
  assert.equal(result.source.rejectedRowCount, 0);
  assert.equal(result.channels.length, 15);
  assert.equal(result.xAxis?.kind, "time");
  assert.equal(result.xAxis?.channelId, "time");
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
  assert.equal(torque.peak?.xValue, 1);
  assert.equal(torque.peak?.xLabel, "1 s");
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
  assert.match(boostPeak.text, /2\.1 bar at 1\.5 s/);
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

  assert.equal(incompatible.insights.some((item) => item.kind === "actual_target_gap"), false);
  assert.ok(incompatible.missingChannels.includes("Boost pressure target"));
  assert.equal(pressureReferenceMismatch.insights.some((item) => item.kind === "actual_target_gap"), false);
  assert.ok(pressureReferenceMismatch.warnings.some((warning) => /no gap was calculated/i.test(warning)));
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
  assert.equal(result.xAxis?.kind, "time");
});

test("generic logger exports may include preambles and a separate units row", () => {
  const result = analyzeLogStudio(genericGermanToolLog);

  assert.equal(result.status, "ready");
  assert.equal(result.delimiter, ";");
  assert.equal(result.source.acceptedRowCount, 3);
  assert.equal(result.xAxis?.kind, "time");
  assert.ok(result.warnings.some((warning) => /2 preamble lines were skipped/i.test(warning)));
  assert.ok(result.warnings.some((warning) => /separate units row/i.test(warning)));

  assert.equal(channelById(result, "rpm").unit.symbol, "rpm");
  assert.equal(channelById(result, "torque").kind, "torque");
  assert.equal(channelById(result, "torque-target").kind, "torque_target");
  assert.equal(channelById(result, "egt").unit.symbol, "°C");
  assert.equal(channelById(result, "egr-actual").kind, "egr_actual");
  assert.equal(channelById(result, "egr-target").kind, "egr_target");
  assert.equal(channelById(result, "fuel-quantity").unit.symbol, "mg/stroke");
  assert.equal(channelById(result, "voltage").unit.symbol, "V");
  assert.equal(summaryById(result, "egt").max?.value, 620);
  assert.equal(summaryById(result, "unmapped-sensor").max?.value, 12);

  const egrObservation = result.insights.find((item) => item.kind === "egr_activity");
  assert.ok(egrObservation);
  assert.match(egrObservation.text, /Numeric movement is present/);
  assert.match(egrObservation.text, /does not confirm EGR function, health, disable state or commanded response/);
});

test("performance extraction uses logged actual torque, excludes requests and converts lb-ft", () => {
  const result = analyzeLogStudio([
    "Time [s],RPM,Driver Wish Torque (Nm),Engine Torque Actual (lb-ft)",
    "0.0,1800,400,200",
    "0.5,2400,450,250",
    "1.0,3000,480,300",
  ].join("\n"));
  const performanceRows = extractLogStudioPerformanceRows(result);

  assert.equal(channelById(result, "torque-target").kind, "torque_target");
  assert.equal(channelById(result, "torque").kind, "torque");
  assert.equal(performanceRows.length, 3);
  assert.equal(performanceRows[0].rpm, 1800);
  assert.equal(performanceRows[0].torqueNm.toFixed(2), "271.16");
  assert.equal(performanceRows[2].torqueNm.toFixed(2), "406.75");

  const requestOnly = analyzeLogStudio(
    "RPM,Requested Engine Torque (Nm)\n1800,400\n2400,450\n3000,480"
  );
  assert.deepEqual(extractLogStudioPerformanceRows(requestOnly), []);
});

test("common r/min and foot-pound spellings produce canonical performance rows", () => {
  for (const torqueUnit of ["ft-lb", "lbf-ft"]) {
    const result = analyzeLogStudio([
      `Engine Speed [r/min],Engine Torque Actual [${torqueUnit}]`,
      "1800,220",
      "2400,300",
      "3200,360",
    ].join("\n"));
    const rows = extractLogStudioPerformanceRows(result);

    assert.equal(channelById(result, "rpm").unit.dimension, "engine_speed");
    assert.equal(channelById(result, "torque").unit.dimension, "torque");
    assert.equal(rows.length, 3);
    assert.equal(rows[2].torqueNm.toFixed(1), "488.1");
  }
});

test("power extraction rejects turbo RPM and non-engine torque channels", () => {
  const result = analyzeLogStudio([
    "Turbo Speed (rpm),Engine Speed (rpm),Transmission Input Torque (Nm),Engine Torque Actual (Nm)",
    "80000,1800,900,280",
    "95000,2400,950,360",
    "110000,3200,1000,410",
  ].join("\n"));
  const performanceRows = extractLogStudioPerformanceRows(result);

  assert.equal(channelById(result, "turbo-speed").kind, "other");
  assert.equal(channelById(result, "transmission-input-torque").kind, "other");
  assert.deepEqual(
    performanceRows.map(({ rpm, torqueNm }) => ({ rpm, torqueNm })),
    [
      { rpm: 1800, torqueNm: 280 },
      { rpm: 2400, torqueNm: 360 },
      { rpm: 3200, torqueNm: 410 },
    ]
  );
});

test("turbine speed and torque-converter aliases cannot drive engine power", () => {
  const tcTorque = analyzeLogStudio(
    "Engine Speed (rpm),TC Input Torque (Nm)\n1800,700\n2400,800"
  );
  const turbineSpeed = analyzeLogStudio(
    "Turbine Speed (rpm),Torque (Nm)\n1800,300\n2400,360"
  );

  assert.equal(channelById(tcTorque, "tc-input-torque").kind, "other");
  assert.equal(channelById(turbineSpeed, "turbine-speed").kind, "other");
  assert.deepEqual(extractLogStudioPerformanceRows(tcTorque), []);
  assert.deepEqual(extractLogStudioPerformanceRows(turbineSpeed), []);
});

test("ambiguous equal-ranked engine channels fail closed for power", () => {
  const result = analyzeLogStudio([
    "Engine Speed (rpm),Engine Torque Actual (Nm),Actual Engine Torque (Nm)",
    "1800,280,275",
    "2400,360,355",
    "3200,410,405",
  ].join("\n"));

  assert.deepEqual(extractLogStudioPerformanceRows(result), []);
});

test("coverage differences do not resolve equally ranked engine-channel ambiguity", () => {
  const result = analyzeLogStudio([
    "Engine Speed (rpm),Engine Torque Actual (Nm),Actual Engine Torque (Nm)",
    "1800,280,275",
    "2400,360,",
    "3200,410,405",
  ].join("\n"));

  assert.notEqual(channelById(result, "torque").coveragePercent, channelById(result, "torque-2").coveragePercent);
  assert.deepEqual(extractLogStudioPerformanceRows(result), []);
});

test("actual-target comparisons pair sensor identities and reject singleton mismatches", () => {
  const paired = analyzeLogStudio([
    "RPM,EGR Bank 1 Actual [%],EGR Bank 2 Actual [%],EGR Bank 2 Target [%],EGR Bank 1 Target [%]",
    "1800,10,20,21,11",
    "2400,30,40,41,31",
  ].join("\n"));
  const comparisons = paired.insights.filter((item) => item.kind === "actual_target_gap");

  assert.equal(comparisons.length, 2);
  for (const comparison of comparisons) {
    const headers = comparison.channelIds.map((id) => channelById(paired, id).header);
    assert.ok(
      headers.every((header) => header.includes("Bank 1")) ||
        headers.every((header) => header.includes("Bank 2"))
    );
    assert.match(comparison.text, /1 %/);
  }

  const mismatched = analyzeLogStudio([
    "RPM,EGR Bank 1 Actual [%],EGR Bank 2 Target [%]",
    "1800,10,21",
    "2400,30,41",
  ].join("\n"));
  assert.equal(mismatched.insights.some((item) => item.kind === "actual_target_gap"), false);
  assert.ok(mismatched.warnings.some((warning) => /mismatched sensor identities/i.test(warning)));
});

test("actuator duty and sensor-voltage channels cannot create pressure or EGT conclusions", () => {
  const result = analyzeLogStudio([
    "RPM,Boost Solenoid Duty [%],Fuel Rail Pressure Regulator Duty [%],EGT Sensor Voltage [V]",
    "1800,20,32,0.8",
    "2400,55,48,1.2",
    "3200,80,62,1.6",
  ].join("\n"));

  assert.equal(channelById(result, "boost-solenoid-duty").kind, "other");
  assert.equal(channelById(result, "fuel-rail-pressure-regulator-duty").kind, "other");
  assert.equal(result.channels.find((channel) => channel.header === "EGT Sensor Voltage [V]")?.kind, "voltage");
  assert.equal(result.insights.some((item) => item.kind === "boost_peak"), false);
  assert.equal(result.insights.some((item) => /rail pressure/i.test(item.title)), false);
  assert.equal(result.insights.some((item) => /exhaust gas temperature/i.test(item.title)), false);
});

test("engine-speed sensor voltage is voltage and cannot become an RPM axis", () => {
  const result = analyzeLogStudio([
    "Sample,Engine Speed Sensor Voltage [V],Lambda",
    "1,0.5,1.02",
    "2,1.2,0.99",
    "3,2.1,0.96",
  ].join("\n"));

  assert.equal(result.channels.find((channel) => channel.header === "Engine Speed Sensor Voltage [V]")?.kind, "voltage");
  assert.equal(result.xAxis?.kind, "sample");
  assert.equal(result.xAxis?.channelId, "sample");
});

test("unit-only voltage notation overrides misleading automotive signal names", () => {
  const result = analyzeLogStudio([
    "Sample,Engine Torque Sensor [V],EGT Sensor [V],Boost Sensor [%],Fuel Rail Pressure Sensor [V]",
    "1,1.2,0.8,20,0.5",
    "2,2.4,1.1,55,1.2",
    "3,4.8,1.6,80,2.1",
  ].join("\n"));

  assert.equal(result.channels.find((channel) => channel.header === "Engine Torque Sensor [V]")?.kind, "voltage");
  assert.equal(result.channels.find((channel) => channel.header === "EGT Sensor [V]")?.kind, "voltage");
  assert.equal(result.channels.find((channel) => channel.header === "Fuel Rail Pressure Sensor [V]")?.kind, "voltage");
  assert.equal(result.insights.some((item) => /torque|exhaust gas temperature|rail pressure/i.test(item.title)), false);
  assert.ok(result.missingChannels.includes("Engine torque with a known unit"));
  assert.ok(result.missingChannels.includes("Exhaust-gas temperature"));
  assert.ok(result.missingChannels.includes("Boost pressure actual"));
  assert.ok(result.missingChannels.includes("Rail pressure actual"));
});

test("thousands-formatted RPM stays compatible while unitless whitespace logs fail closed for power", () => {
  const headered = analyzeLogStudio([
    '"Engine Speed (rpm)","Engine Torque Actual (Nm)"',
    '"1,800","280"',
    '"2,400","360"',
    '"3,200","410"',
  ].join("\n"));
  const whitespace = analyzeLogStudio("1800 280\n2400 360\n3200 410");

  assert.deepEqual(extractLogStudioPerformanceRows(headered).map((row) => row.rpm), [1800, 2400, 3200]);
  assert.equal(whitespace.status, "ready");
  assert.equal(whitespace.delimiter, "\t");
  assert.deepEqual(extractLogStudioPerformanceRows(whitespace), []);
  assert.ok(whitespace.warnings.some((warning) => /torque unit remains unknown/i.test(warning)));
});

test("leading empty TSV cells retain column alignment", () => {
  const result = analyzeLogStudio(
    "RPM\tEngine Torque [Nm]\tEGT [degC]\n\t320\t600\n1800\t330\t650"
  );

  assert.equal(result.rows[0].values.rpm, null);
  assert.equal(result.rows[0].values.torque, 320);
  assert.equal(result.rows[0].values.egt, 600);
  assert.deepEqual(extractLogStudioPerformanceRows(result).map((row) => row.rpm), [1800]);
});

test("target RPM and demand torque are never accepted as measured performance inputs", () => {
  const targetRpm = analyzeLogStudio(
    "Engine Speed Target [rpm],Engine Torque Actual [Nm]\n1800,300\n2400,360"
  );
  const demandTorque = analyzeLogStudio(
    "Engine Speed [rpm],Engine Torque Demand [Nm]\n1800,400\n2400,450"
  );

  assert.equal(targetRpm.channels.some((channel) => channel.kind === "rpm"), false);
  assert.equal(channelById(demandTorque, "torque-target").kind, "torque_target");
  assert.deepEqual(extractLogStudioPerformanceRows(targetRpm), []);
  assert.deepEqual(extractLogStudioPerformanceRows(demandTorque), []);
});

test("reference torque and percentage torque cannot be treated as delivered engine torque", () => {
  const result = analyzeLogStudio([
    "RPM,Engine Reference Torque [Nm],Actual Torque [%]",
    "1800,500,55",
    "2400,500,72",
    "3200,500,84",
  ].join("\n"));

  assert.equal(channelById(result, "torque-target").kind, "torque_target");
  assert.deepEqual(extractLogStudioPerformanceRows(result), []);
});

test("ASCII and curly driver's-wish torque labels remain requested channels", () => {
  for (const header of ["Driver's Wish Torque [Nm]", "Driver’s Wish Torque [Nm]"]) {
    const result = analyzeLogStudio([
      `RPM,${header}`,
      "1800,350",
      "2400,420",
      "3200,460",
    ].join("\n"));

    assert.equal(channelById(result, "torque-target").kind, "torque_target");
    assert.deepEqual(extractLogStudioPerformanceRows(result), []);
  }
});

test("French, German and abbreviated target markers never become actual performance channels", () => {
  for (const [rpmHeader, torqueHeader] of [
    ["Régime moteur demandé [rpm]", "Couple moteur demandé [Nm]"],
    ["Engine Speed Soll [rpm]", "Drehmoment Wunsch [Nm]"],
    ["RPM SP", "Torque CMD [Nm]"],
    ["RPM REF", "Torque LIM [Nm]"],
    ["RPM DES", "Torque REF [Nm]"],
  ]) {
    const result = analyzeLogStudio([
      `${rpmHeader},${torqueHeader}`,
      "1800,350",
      "2400,420",
      "3200,460",
    ].join("\n"));

    assert.deepEqual(extractLogStudioPerformanceRows(result), []);
  }
});

test("a generic actual channel does not pair with a bank-specific target", () => {
  const result = analyzeLogStudio([
    "RPM,Boost Actual [bar],Boost Bank 2 Target [bar]",
    "1800,1.2,1.3",
    "2400,1.6,1.7",
    "3200,1.9,2.0",
  ].join("\n"));

  assert.equal(result.insights.some((item) => item.kind === "actual_target_gap"), false);
  assert.ok(result.warnings.some((warning) => /ambiguous or mismatched sensor identities/i.test(warning)));
});

test("error, deviation, reserve and target signals cannot impersonate measured channels", () => {
  const derived = analyzeLogStudio([
    "Engine Speed Error [rpm],Engine Torque Error [Nm],Engine Torque Reserve [Nm],Boost Pressure Error [bar],Fuel Rail Pressure Deviation [bar],EGT Target [degC],EGT Limit [degC]",
    "5,20,40,0.1,5,700,800",
    "8,25,45,0.2,8,720,820",
    "10,30,50,0.3,10,740,840",
  ].join("\n"));
  const mixed = analyzeLogStudio([
    "Engine Speed (rpm),Engine Torque Actual [Nm],Boost Pressure Error [bar],Fuel Rail Pressure Deviation [bar],EGT Target [degC]",
    "1800,280,0.1,5,700",
    "2400,360,0.2,8,720",
    "3200,410,0.3,10,740",
  ].join("\n"));

  assert.deepEqual(extractLogStudioPerformanceRows(derived), []);
  assert.ok(derived.channels.every((channel) => channel.kind === "other"));
  assert.equal(mixed.insights.some((item) => item.kind === "boost_peak"), false);
  assert.equal(mixed.insights.some((item) => /rail pressure|exhaust gas temperature/i.test(item.title)), false);
  assert.ok(mixed.missingChannels.includes("Boost pressure actual"));
  assert.ok(mixed.missingChannels.includes("Rail pressure actual"));
  assert.ok(mixed.missingChannels.includes("Exhaust-gas temperature"));
});

test("duplicate actual channels with one sensor identity do not pair arbitrarily to a target", () => {
  const result = analyzeLogStudio([
    "RPM,Engine Torque Bank 1 Raw [Nm],Engine Torque Bank 1 Filtered [Nm],Engine Torque Bank 1 Target [Nm]",
    "1800,280,275,300",
    "2400,360,355,390",
    "3200,410,405,430",
  ].join("\n"));

  assert.equal(result.insights.some((item) => item.kind === "actual_target_gap"), false);
  assert.ok(result.warnings.some((warning) => /ambiguous or mismatched sensor identities/i.test(warning)));
});

test("only RPM receives an unambiguous thousands grouping heuristic", () => {
  const result = analyzeLogStudio([
    "RPM;Engine Torque Actual [Nm];EGT 1 [degC]",
    "1.800;1.200;1.050",
    "2.400;950.000;980.000",
  ].join("\n"));

  assert.equal(result.rows[0].values.rpm, 1800);
  assert.equal(result.rows[0].values.torque, 1.2);
  assert.equal(result.rows[0].values.egt, 1.05);
  assert.equal(result.rows[1].values.torque, 950);
  assert.equal(result.rows[1].values.egt, 980);
});

test("measurement durations do not become the timeline axis", () => {
  const result = analyzeLogStudio([
    "Injection Time [ms],Engine Speed [rpm],Engine Torque Actual [Nm]",
    "1.2,1800,280",
    "0.9,2400,360",
    "1.4,3200,410",
  ].join("\n"));

  assert.equal(channelById(result, "injection-time").kind, "other");
  assert.equal(result.xAxis?.kind, "rpm");
});

test("implausible finite torque cannot overflow calculated performance", () => {
  const result = analyzeLogStudio(
    "Engine Speed [rpm],Engine Torque Actual [Nm]\n30000,1e308"
  );

  assert.deepEqual(extractLogStudioPerformanceRows(result), []);
});

test("extreme and sentinel cells stay visible but cannot overflow summaries or calculated highlights", () => {
  const result = analyzeLogStudio([
    "Engine Speed [rpm],Engine Torque Actual [Nm],Boost Actual [bar],EGT 1 [degC]",
    "1800,280,1.2,500",
    "2400,1e308,1e308,1e308",
    "2800,32767,65535,65535",
    "3200,410,1.8,650",
  ].join("\n"));

  assert.equal(result.rows[1].values.torque, 1e308);
  assert.equal(result.rows[2].values.torque, 32767);
  assert.equal(summaryById(result, "torque").max?.value, 410);
  assert.equal(summaryById(result, "boost-actual").max?.value, 1.8);
  assert.equal(summaryById(result, "egt").max?.value, 650);
  assert.ok(result.warnings.some((warning) => /outside conservative local analysis bounds/i.test(warning)));
  assert.doesNotMatch(result.insights.map((item) => item.text).join(" "), /Infinity|1e\+?308|32767|65535/i);

  const allNumbers: number[] = [];
  const collectNumbers = (value: unknown) => {
    if (typeof value === "number") allNumbers.push(value);
    else if (Array.isArray(value)) value.forEach(collectNumbers);
    else if (value && typeof value === "object") Object.values(value).forEach(collectNumbers);
  };
  collectNumbers(result);
  assert.ok(allNumbers.every(Number.isFinite));
});

test("common automotive sentinels cannot become secondary-channel summaries", () => {
  const result = analyzeLogStudio([
    "Time [s],RPM,Lambda,AFR,Vehicle Speed [km/h],Battery Voltage [V],DPF Differential Pressure [mbar],Mass Air Flow [g/s],Ignition Timing [deg]",
    "0,1800,1.02,14.7,40,13.8,12,80,5",
    "1,2400,65535,65535,65535,65535,65535,65535,65535",
    "2,3200,0.95,13.9,90,14.2,24,180,12",
  ].join("\n"));

  assert.equal(summaryById(result, "lambda").max?.value, 1.02);
  assert.equal(summaryById(result, "afr").max?.value, 14.7);
  assert.equal(summaryById(result, "speed").max?.value, 90);
  assert.equal(summaryById(result, "voltage").max?.value, 14.2);
  assert.equal(summaryById(result, "dpf-pressure").max?.value, 24);
  assert.equal(summaryById(result, "airflow").max?.value, 180);
  assert.equal(summaryById(result, "ignition").max?.value, 12);
  assert.doesNotMatch(result.insights.map((item) => item.text).join(" "), /65535/);
});

test("scaled 16-bit sentinels are excluded only for implausible semantic channels", () => {
  const result = analyzeLogStudio([
    "Time [s],RPM,Lambda,AFR,Vehicle Speed [km/h],Battery Voltage [V],Ignition Timing [deg]",
    "0,1800,1.02,14.7,40,13.8,5",
    "1,2400,65.535,655.35,655.35,65.535,6553.5",
    "2,3200,0.95,13.9,90,14.2,12",
  ].join("\n"));

  assert.equal(summaryById(result, "lambda").max?.value, 1.02);
  assert.equal(summaryById(result, "afr").max?.value, 14.7);
  assert.equal(summaryById(result, "speed").max?.value, 90);
  assert.equal(summaryById(result, "ignition").max?.value, 12);
  assert.equal(summaryById(result, "voltage").max?.value, 65.535);
  assert.ok(result.warnings.some((warning) => /outside conservative local analysis bounds/i.test(warning)));
});

test("excluded finite sentinels break chart traces instead of producing invalid SVG coordinates", () => {
  const result = analyzeLogStudio([
    "Time [s],Engine Speed [rpm],Engine Torque Actual [Nm],EGT [degC]",
    "0,1800,280,600",
    "1,2400,360,650",
    "2,3200,410,700",
    "1e308,999999,1e308,1e308",
  ].join("\n"));
  const torque = channelById(result, "torque");
  const torqueSummary = summaryById(result, "torque");
  const path = channelPath(result, torque, torqueSummary, {
    x: 0,
    y: 0,
    width: 800,
    height: 240,
  });

  assert.equal(axisRatioForRow(result.rows[3], 3, result), null);
  assert.match(path, /^M/);
  assert.doesNotMatch(path, /Infinity|NaN/);
  assert.ok(result.warnings.some((warning) => /outside conservative local analysis bounds/i.test(warning)));
});

test("chart geometry uses raw high-precision extrema instead of rounded summary values", () => {
  const result = analyzeLogStudio([
    "Time [s],Engine Speed [rpm],Engine Torque Actual [Nm],Lambda",
    "1.23456,1800,280,0.98765",
    "1.23457,2400,360,1.00001",
    "1.23459,3200,410,1.12344",
  ].join("\n"));
  const lambda = channelById(result, "lambda");
  const lambdaSummary = summaryById(result, "lambda");
  const ratios = result.rows.map((row, index) => axisRatioForRow(row, index, result));
  const path = channelPath(result, lambda, lambdaSummary, {
    x: 0,
    y: 0,
    width: 800,
    height: 240,
  });

  assert.equal(ratios[0], 0);
  assert.ok(Math.abs((ratios[1] ?? 0) - (1 / 3)) < 1e-6);
  assert.equal(ratios[2], 1);
  assert.match(path, /^M0\.00 240\.00 L/);
  assert.match(path, /L800\.00 0\.00$/);
});

test("long-log chart sampling resolves extrema by retained row identity", () => {
  const result = analyzeLogStudio([
    "Time [s],Engine Speed [rpm],Engine Torque Actual [Nm]",
    ",,",
    ...Array.from({ length: 2_000 }, (_, index) =>
      `${index},${1_500 + index},${index === 2 ? 900 : 300}`
    ),
  ].join("\n"));
  const torque = channelById(result, "torque");
  const torqueSummary = summaryById(result, "torque");
  const path = channelPath(result, torque, torqueSummary, {
    x: 0,
    y: 0,
    width: 800,
    height: 240,
  });

  assert.equal(torqueSummary.max?.rowNumber, 4);
  assert.match(path, /\d+\.\d{2} 0\.00/);
});

test("low-coverage time data falls back to the complete engine-speed axis", () => {
  const result = analyzeLogStudio([
    "Time [s],Engine Speed (rpm),Engine Torque (Nm)",
    "0.0,1800,280",
    ",2400,360",
    ",3200,410",
  ].join("\n"));

  assert.equal(result.xAxis?.kind, "rpm");
  assert.equal(result.xAxis?.channelId, "rpm");
});

test("epoch timestamps remain a real time axis instead of falling back to row spacing", () => {
  const result = analyzeLogStudio([
    "Timestamp [ms],Engine Speed (rpm),Engine Torque Actual (Nm)",
    "1800000000000,1800,280",
    "1800000000250,2400,360",
    "1800000000500,3200,410",
  ].join("\n"));

  assert.equal(result.xAxis?.kind, "time");
  assert.equal(result.xAxis?.channelId, "time");
  assert.equal(summaryById(result, "time").min?.value, 1_800_000_000_000);
  assert.doesNotMatch(result.warnings.join(" "), /outside conservative local analysis bounds/i);
});

test("excluded time sentinels cannot win axis selection or leak into peak context", () => {
  const result = analyzeLogStudio([
    "Time [s],Engine Speed [rpm],Engine Torque Actual [Nm]",
    "0,1800,280",
    "1,2400,360",
    "1e308,3200,410",
  ].join("\n"));
  const contexts = result.summaries.flatMap((summary) => [
    summary.min?.xLabel ?? "",
    summary.max?.xLabel ?? "",
    summary.peak?.xLabel ?? "",
  ]).join(" ");

  assert.equal(result.xAxis?.kind, "rpm");
  assert.equal(result.xAxis?.channelId, "rpm");
  assert.doesNotMatch(`${contexts} ${result.insights.map((item) => item.text).join(" ")}`, /1e\+?308/i);
  assert.doesNotMatch(peakContext(result, summaryById(result, "torque"), "rpm"), /1e\+?308/i);
  assert.ok(result.warnings.some((warning) => /outside conservative local analysis bounds/i.test(warning)));
});

test("primary torque context follows the RPM channel selected for power", () => {
  const result = analyzeLogStudio([
    "Time [s],RPM,Engine Speed [rpm],Engine Torque Actual [Nm]",
    "0,100,1800,280",
    "1,200,2400,360",
    "2,300,3200,410",
  ].join("\n"));
  const source = performanceSourceFromStudioAnalysis(result);

  assert.equal(source?.rpmChannelId, "rpm-2");
  const context = peakContext(result, summaryById(result, "torque"), source?.rpmChannelId);
  assert.match(context, /Engine Speed: 3,200 rpm/);
  assert.doesNotMatch(context, /RPM: 300 rpm/);
});

test("unitless semantic channels keep plausible summaries but reject sentinel highlights", () => {
  const result = analyzeLogStudio([
    "RPM,Actual Engine Torque,Boost Actual,EGT",
    "1800,280,1.2,500",
    "2400,65535,65535,65535",
    "3200,410,1.8,650",
  ].join("\n"));

  assert.equal(summaryById(result, "torque").max?.value, 410);
  assert.equal(summaryById(result, "boost-actual").max?.value, 1.8);
  assert.equal(summaryById(result, "egt").max?.value, 650);
  assert.deepEqual(extractLogStudioPerformanceRows(result), []);
  assert.ok(result.warnings.some((warning) => /outside conservative local analysis bounds/i.test(warning)));
  assert.doesNotMatch(result.insights.map((item) => item.text).join(" "), /65535/);
});

test("a complete source sample axis wins over unusable time when RPM is absent", () => {
  const result = analyzeLogStudio([
    "Sample,Time [s],EGT [degC]",
    "1,0,500",
    "2,,550",
    "3,,600",
    "4,,650",
    "5,,700",
  ].join("\n"));

  assert.equal(result.xAxis?.kind, "sample");
  assert.equal(result.xAxis?.channelId, "sample");
});

test("unusable time without another logged axis falls back to explicit source order", () => {
  const result = analyzeLogStudio(
    "Time [s],EGT [degC]\n0,500\n0,550\n0,600"
  );

  assert.equal(result.xAxis?.kind, "sample");
  assert.equal(result.xAxis?.channelId, null);
  assert.equal(result.xAxis?.synthetic, true);
});

test("constant engine speed falls back to explicit source order", () => {
  const result = analyzeLogStudio([
    "Engine Speed (rpm),Engine Torque Actual (Nm)",
    "2000,300",
    "2000,320",
    "2000,310",
    "2000,315",
    "2000,305",
  ].join("\n"));

  assert.equal(result.xAxis?.kind, "sample");
  assert.equal(result.xAxis?.channelId, null);
  assert.equal(result.xAxis?.synthetic, true);
  assert.ok(result.warnings.some((warning) => /row number is used as the x-axis/i.test(warning)));
});

test("standalone German Drehzahl is recognized as engine speed", () => {
  const result = analyzeLogStudio(
    "Zeit [s];Drehzahl [1/min];Drehmoment Ist [Nm]\n0,0;1800;280\n0,5;2400;360"
  );

  assert.equal(channelById(result, "rpm").kind, "rpm");
  assert.equal(extractLogStudioPerformanceRows(result).length, 2);
});

test("logs above the former 2,000-row trial cap are analyzed within the expanded local bound", () => {
  const log = [
    "Time [s],RPM,Engine Torque (Nm)",
    ...Array.from({ length: 3_500 }, (_, index) =>
      `${index / 10},${1_500 + (index % 4_000)},${280 + (index % 120)}`
    ),
  ].join("\n");
  const result = analyzeLogStudio(log);

  assert.equal(result.status, "ready");
  assert.equal(result.source.acceptedRowCount, 3_500);
  assert.equal(result.truncated.rows, false);
  assert.equal(extractLogStudioPerformanceRows(result).length, 3_500);
});

test("the browser Studio checklist uses every bounded performance row", () => {
  const rows = Array.from({ length: 3_000 }, (_, index) => ({
    rpm: 1_500 + index,
    torqueNm: index === 2_999 ? 900 : 300,
  }));
  const response = buildDeterministicLogAnalyzerFallback({
    source: "browser_tool",
    rows,
  });

  assert.equal(response.normalizedInput.wasTruncated, false);
  assert.equal(response.normalizedInput.validRowCount, 3_000);
  assert.equal(response.logSummary.peakTorque?.torqueNm, 900);
  assert.equal(response.logSummary.peakTorque?.rpm, 4_499);
});

test("legacy checklist text input uses the shared generic parser and fails closed on extremes", () => {
  const requestedFirst = parseLogAnalyzerText([
    "Engine Speed [rpm],Engine Torque Requested [Nm],Engine Torque Actual [Nm]",
    "1800,600,280",
    "2400,650,360",
    "3200,700,410",
  ].join("\n"));
  const german = parseLogAnalyzerText([
    "Zeit [s];Drehzahl [r/min];Drehmoment Ist [Nm]",
    "0;3000;300",
    "1;4000;350",
  ].join("\n"));
  const extreme = buildDeterministicLogAnalyzerFallback({
    source: "browser_tool",
    rows: [{ rpm: 1e308, torqueNm: 1e308 }],
  });

  assert.deepEqual(requestedFirst.rows.map((row) => row.torqueNm), [280, 360, 410]);
  assert.deepEqual(german.rows, [
    { rpm: 3000, torqueNm: 300 },
    { rpm: 4000, torqueNm: 350 },
  ]);
  assert.equal(extreme.status, "invalid_input");
  assert.equal(extreme.normalizedInput.validRowCount, 0);
  assert.doesNotMatch(JSON.stringify(extreme), /Infinity/);
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
  const publicRowBounded = analyzeLogStudio(manyRows, { profile: "performance" });

  assert.equal(rowBounded.truncated.rows, true);
  assert.equal(rowBounded.source.sourceRowCount, maxLogStudioRows + 105);
  assert.equal(rowBounded.source.processedRowCount, maxLogStudioFullRows);
  assert.equal(rowBounded.rows.length, maxLogStudioFullRows);
  assert.ok(rowBounded.warnings.some((warning) => /15,000 data rows.*mobile-safe/i.test(warning)));
  assert.equal(publicRowBounded.source.processedRowCount, maxLogStudioRows);
  assert.equal(publicRowBounded.rows.length, maxLogStudioRows);

  const channelHeaders = [
    "RPM",
    ...Array.from({ length: maxLogStudioChannels + 8 }, (_, index) => `Sensor ${index + 1}`),
  ];
  const manyChannels = analyzeLogStudio([
    channelHeaders.join(","),
    channelHeaders.map((_, index) => 1_000 + index).join(","),
    channelHeaders.map((_, index) => 1_100 + index).join(","),
  ].join("\n"));

  assert.equal(manyChannels.truncated.channels, true);
  assert.equal(manyChannels.channels.length, maxLogStudioChannels);
  assert.ok(manyChannels.channels.some((channel) => channel.kind === "rpm"));

  const latePrimaryHeaders = [
    ...Array.from({ length: maxLogStudioChannels + 4 }, (_, index) => `EGT ${index + 1} [degC]`),
    "Engine Speed (rpm)",
    "Engine Torque Actual (Nm)",
  ];
  const latePrimary = analyzeLogStudio([
    latePrimaryHeaders.join(","),
    latePrimaryHeaders.map((_, index) => 500 + index).join(","),
    latePrimaryHeaders.map((_, index) => 600 + index).join(","),
  ].join("\n"));

  assert.equal(latePrimary.truncated.channels, true);
  assert.equal(latePrimary.channels.length, maxLogStudioChannels);
  assert.ok(latePrimary.channels.some((channel) => channel.kind === "rpm"));
  assert.ok(latePrimary.channels.some((channel) => channel.kind === "torque"));
  assert.equal(extractLogStudioPerformanceRows(latePrimary).length, 2);

  const oversized = `${"Time [s],RPM,Engine Torque (Nm)\n"}${"0.1,2000,320\n".repeat(
    Math.ceil(maxLogStudioCharacters / 12)
  )}`;
  assert.ok(oversized.length > maxLogStudioCharacters);
  const characterBounded = analyzeLogStudio(oversized);

  assert.equal(characterBounded.truncated.characters, true);
  assert.ok(characterBounded.source.processedRowCount <= maxLogStudioFullRows);
  assert.ok(characterBounded.warnings.some((warning) => /first 5,000,000 characters/i.test(warning)));
});

test("malformed wide delimiter and whitespace rows stay inside the tokenizer bound", () => {
  const startedAt = Date.now();
  const delimited = analyzeLogStudio(",".repeat(maxLogStudioCharacters));
  const whitespaceRow = "1 ".repeat(1_100_000);
  const whitespace = analyzeLogStudio(`${whitespaceRow}\n${whitespaceRow}`);
  const elapsedMs = Date.now() - startedAt;

  assert.equal(delimited.status, "invalid");
  assert.equal(whitespace.status, "invalid");
  assert.ok(elapsedMs < 8_000, `Expected bounded tokenization, received ${elapsedMs} ms`);
});

test("the full profile respects the cell budget while the public performance profile reads the full two-channel capture", () => {
  const columnCount = maxLogStudioChannels;
  const rowCount = Math.floor(maxLogStudioCells / columnCount) + 5;
  const headers = [
    "Engine Speed (rpm)",
    "Engine Torque Actual (Nm)",
    ...Array.from({ length: columnCount - 2 }, (_, index) => `Sensor ${index + 1}`),
  ];
  const log = [
    headers.join(","),
    ...Array.from({ length: rowCount }, (_, rowIndex) =>
      headers.map((_, columnIndex) =>
        columnIndex === 0 ? 1_500 + rowIndex : columnIndex === 1 ? 300 + (rowIndex % 50) : rowIndex + columnIndex
      ).join(",")
    ),
  ].join("\n");

  const full = analyzeLogStudio(log);
  const performance = analyzeLogStudio(log, { profile: "performance" });

  assert.equal(full.truncated.rows, true);
  assert.equal(full.source.processedRowCount, Math.floor(maxLogStudioCells / columnCount));
  assert.ok(full.warnings.some((warning) => /500,000-cell local processing budget/i.test(warning)));
  assert.equal(performance.truncated.rows, false);
  assert.equal(performance.source.processedRowCount, rowCount);
  assert.equal(performance.channels.length, 2);
  assert.equal(extractLogStudioPerformanceRows(performance).length, rowCount);
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
  assert.match(source, /maxLogStudioCharacters = 5_000_000/);
  assert.match(source, /maxLogStudioRows = 50_000/);
  assert.match(source, /maxLogStudioFullRows = 15_000/);
  assert.match(source, /maxLogStudioChannels = 64/);
  assert.match(source, /maxLogStudioCells = 500_000/);
});
