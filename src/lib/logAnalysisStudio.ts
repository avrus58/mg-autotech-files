export const maxLogStudioCharacters = 120_000;
export const maxLogStudioRows = 2_000;
export const maxLogStudioChannels = 24;

const maxCandidateColumns = 96;

export type LogStudioStatus = "empty" | "invalid" | "ready";
export type LogStudioDelimiter = "," | ";" | "\t";
export type LogStudioQualityLabel = "strong" | "usable" | "limited";
export type LogStudioInsightSeverity = "info" | "caution";
export type LogStudioPressureReference = "absolute" | "gauge" | "unknown";

export type LogStudioChannelKind =
  | "sample"
  | "time"
  | "rpm"
  | "torque"
  | "boost_actual"
  | "boost_target"
  | "lambda"
  | "afr"
  | "throttle"
  | "pedal"
  | "iat"
  | "coolant"
  | "egt"
  | "rail_actual"
  | "rail_target"
  | "airflow"
  | "speed"
  | "ignition"
  | "other";

export type LogStudioUnitDimension =
  | "sample"
  | "time"
  | "engine_speed"
  | "torque"
  | "pressure"
  | "ratio"
  | "percent"
  | "temperature"
  | "airflow"
  | "speed"
  | "angle"
  | "unknown";

export type LogStudioUnit = {
  raw: string | null;
  symbol: string | null;
  dimension: LogStudioUnitDimension;
  canonicalSymbol: string | null;
  toCanonicalFactor: number | null;
  toCanonicalOffset: number | null;
  pressureReference: LogStudioPressureReference;
};

export type LogStudioChannel = {
  id: string;
  index: number;
  header: string;
  label: string;
  kind: LogStudioChannelKind;
  unit: LogStudioUnit;
  numericValueCount: number;
  coveragePercent: number;
};

export type LogStudioRow = {
  rowNumber: number;
  values: Record<string, number | null>;
};

export type LogStudioAxis = {
  channelId: string | null;
  kind: "rpm" | "time" | "sample";
  label: string;
  unit: LogStudioUnit;
  synthetic: boolean;
};

export type LogStudioValueContext = {
  value: number;
  rowNumber: number;
  xValue: number | null;
  xLabel: string;
};

export type LogStudioChannelSummary = {
  channelId: string;
  kind: LogStudioChannelKind;
  label: string;
  unit: LogStudioUnit;
  valueCount: number;
  missingValueCount: number;
  coveragePercent: number;
  min: LogStudioValueContext | null;
  max: LogStudioValueContext | null;
  average: number | null;
  peak: LogStudioValueContext | null;
};

export type LogStudioInsightKind =
  | "coverage"
  | "rpm_window"
  | "channel_range"
  | "channel_peak"
  | "boost_peak"
  | "actual_target_gap"
  | "limitation";

export type LogStudioInsight = {
  id: string;
  kind: LogStudioInsightKind;
  severity: LogStudioInsightSeverity;
  title: string;
  text: string;
  channelIds: string[];
};

export type LogStudioQuality = {
  score: number;
  label: LogStudioQualityLabel;
  reasons: string[];
  averageCoveragePercent: number;
  xAxisMonotonic: boolean;
  duplicateXAxisCount: number;
};

export type LogStudioAnalysis = {
  contractVersion: "log-analysis-studio-v1";
  status: LogStudioStatus;
  delimiter: LogStudioDelimiter | null;
  truncated: {
    characters: boolean;
    rows: boolean;
    channels: boolean;
  };
  source: {
    sourceRowCount: number;
    processedRowCount: number;
    acceptedRowCount: number;
    rejectedRowCount: number;
  };
  channels: LogStudioChannel[];
  rows: LogStudioRow[];
  xAxis: LogStudioAxis | null;
  summaries: LogStudioChannelSummary[];
  quality: LogStudioQuality;
  insights: LogStudioInsight[];
  warnings: string[];
  missingChannels: string[];
  safetyBoundaries: string[];
};

type CandidateChannel = {
  index: number;
  header: string;
  label: string;
  kind: LogStudioChannelKind;
  unit: LogStudioUnit;
  values: Array<number | null>;
  numericValueCount: number;
};

const safetyBoundaries = [
  "This browser-local result describes numeric log channels only and does not diagnose a fault or select a repair path.",
  "Logged values depend on sensor scaling, ECU reporting, units and capture conditions; they are not a calibrated dyno measurement.",
  "No result approves a tune, calibration, checksum, flash operation, component limit, vehicle safety or delivery decision.",
];

const emptyQuality: LogStudioQuality = {
  score: 0,
  label: "limited",
  reasons: ["No numeric log rows are available for quality review."],
  averageCoveragePercent: 0,
  xAxisMonotonic: true,
  duplicateXAxisCount: 0,
};

function emptyAnalysis(
  status: LogStudioStatus,
  warnings: string[],
  delimiter: LogStudioDelimiter | null = null
): LogStudioAnalysis {
  return {
    contractVersion: "log-analysis-studio-v1",
    status,
    delimiter,
    truncated: { characters: false, rows: false, channels: false },
    source: {
      sourceRowCount: 0,
      processedRowCount: 0,
      acceptedRowCount: 0,
      rejectedRowCount: 0,
    },
    channels: [],
    rows: [],
    xAxis: null,
    summaries: [],
    quality: emptyQuality,
    insights: [],
    warnings,
    missingChannels: buildMissingChannels([]),
    safetyBoundaries: [...safetyBoundaries],
  };
}

function round(value: number, decimals = 4) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u00b0/g, " deg ")
    .replace(/\u03bb/g, " lambda ")
    .replace(/\u00b2/g, "2")
    .toLowerCase()
    .replace(/[^a-z0-9%/+.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUnitKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\u00b0\s_.]/g, "")
    .replace(/\u00b7/g, "")
    .replace(/per/g, "/");
}

function countUnquotedDelimiter(line: string, delimiter: LogStudioDelimiter) {
  let count = 0;
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && next === '"') {
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      count += 1;
    }
  }

  return count;
}

function detectDelimiter(lines: string[]): LogStudioDelimiter | null {
  const candidates: LogStudioDelimiter[] = ["\t", ";", ","];
  const header = lines[0] ?? "";
  const headerScores = candidates.map((delimiter) => ({
    delimiter,
    score: countUnquotedDelimiter(header, delimiter),
  }));
  const bestHeader = headerScores.reduce((best, item) =>
    item.score > best.score ? item : best
  );

  if (bestHeader.score > 0) return bestHeader.delimiter;

  const sample = lines.slice(0, 4);
  const sampleScores = candidates.map((delimiter) => ({
    delimiter,
    score: sample.reduce(
      (total, line) => total + countUnquotedDelimiter(line, delimiter),
      0
    ),
  }));
  const bestSample = sampleScores.reduce((best, item) =>
    item.score > best.score ? item : best
  );

  return bestSample.score > 0 ? bestSample.delimiter : null;
}

function splitDelimitedLine(line: string, delimiter: LogStudioDelimiter) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === delimiter && !quoted) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseNumericCell(value: string | undefined) {
  if (!value) return null;

  let normalized = value
    .trim()
    .replace(/\u00a0/g, "")
    .replace(/\s+/g, "")
    .replace(/[’']/g, "");

  if (!normalized || /^(?:-|--|n\/?a|null|nan|inf(?:inity)?)$/i.test(normalized)) {
    return null;
  }

  normalized = normalized.replace(/(?:rpm|nm|bar|mbar|kpa|mpa|psi|km\/?h|mph|kg\/?h|g\/?s|ms|s|deg|%|c|f)$/i, "");

  const commaIndex = normalized.lastIndexOf(",");
  const dotIndex = normalized.lastIndexOf(".");

  if (commaIndex !== -1 && dotIndex !== -1) {
    if (commaIndex > dotIndex) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else if (commaIndex !== -1) {
    normalized = normalized.replace(",", ".");
  }

  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractRawUnit(header: string) {
  const bracketMatches = [...header.matchAll(/(?:\[([^\]]{1,32})\]|\(([^)]{1,32})\))/g)];
  const qualifierTokens = new Set([
    "actual",
    "target",
    "requested",
    "request",
    "desired",
    "specified",
    "setpoint",
    "commanded",
    "nominal",
    "measured",
    "absolute",
    "gauge",
    "relative",
    "raw",
  ]);
  const bracketValue = bracketMatches
    .map((match) => match.slice(1).find(Boolean)?.trim())
    .filter((value): value is string => Boolean(value))
    .reverse()
    .find((value) => {
      const tokens = normalizeText(value).split(" ").filter(Boolean);
      return tokens.length > 0 && !tokens.every((token) => qualifierTokens.has(token));
    });
  if (bracketValue) return bracketValue.slice(0, 32);

  const normalized = header.toLowerCase().replace(/\u00b7/g, "");
  const patterns: Array<[RegExp, string]> = [
    [/\bkg\s*\/\s*h\b/i, "kg/h"],
    [/\bmg\s*\/\s*(?:stroke|str|hub)\b/i, "mg/stroke"],
    [/\bg\s*\/\s*s\b/i, "g/s"],
    [/\bkm\s*\/\s*h\b|\bkmh\b/i, "km/h"],
    [/\bmph\b/i, "mph"],
    [/\bmbar\b/i, "mbar"],
    [/\bhpa\b/i, "hPa"],
    [/\bkpa\b/i, "kPa"],
    [/\bmpa\b/i, "MPa"],
    [/\bbar[ag]?\b/i, normalized.match(/\bbar[ag]\b/i)?.[0] ?? "bar"],
    [/\bpsi[ag]?\b/i, normalized.match(/\bpsi[ag]\b/i)?.[0] ?? "psi"],
    [/\blb\s*[-/]?\s*ft\b/i, "lb-ft"],
    [/\bn\s*m\b/i, "Nm"],
    [/\brpm\b|\brev\s*\/\s*min\b/i, "rpm"],
    [/\bmilliseconds?\b|\bmsec\b|\bms\b/i, "ms"],
    [/\bseconds?\b|\bsec\b/i, "s"],
    [/\bdeg\s*c\b|\bcelsius\b|\u00b0c/i, "degC"],
    [/\bdeg\s*f\b|\bfahrenheit\b|\u00b0f/i, "degF"],
    [/\bkelvin\b/i, "K"],
    [/\bdegrees?\b|\bdeg\b|\bbtdc\b/i, "deg"],
    [/%|\bpercent\b/i, "%"],
  ];

  for (const [pattern, unit] of patterns) {
    if (pattern.test(header)) return unit;
  }

  return null;
}

function pressureReferenceFor(header: string, rawUnit: string | null): LogStudioPressureReference {
  const normalized = normalizeText(`${header} ${rawUnit ?? ""}`);
  const unitKey = normalizeUnitKey(rawUnit ?? "");

  if (
    normalized.includes(" absolute ") ||
    normalized.startsWith("absolute ") ||
    normalized.endsWith(" absolute") ||
    /^(?:bara|psia)$/.test(unitKey)
  ) {
    return "absolute";
  }

  if (
    normalized.includes(" gauge ") ||
    normalized.includes(" relative ") ||
    /^(?:barg|psig)$/.test(unitKey)
  ) {
    return "gauge";
  }

  return "unknown";
}

function unitFromHeader(
  header: string,
  kind: LogStudioChannelKind
): LogStudioUnit {
  const raw = extractRawUnit(header);
  const key = normalizeUnitKey(raw ?? "");
  const pressureReference = pressureReferenceFor(header, raw);

  const create = (
    symbol: string | null,
    dimension: LogStudioUnitDimension,
    canonicalSymbol: string | null,
    factor: number | null,
    offset = 0
  ): LogStudioUnit => ({
    raw,
    symbol,
    dimension,
    canonicalSymbol,
    toCanonicalFactor: factor,
    toCanonicalOffset: factor === null ? null : offset,
    pressureReference,
  });

  if (/^(?:rpm|rev\/min|1\/min|min-?1)$/.test(key)) {
    return create("rpm", "engine_speed", "rpm", 1);
  }
  if (/^(?:nm|n\*m)$/.test(key)) return create("Nm", "torque", "Nm", 1);
  if (/^(?:lb-?ft|lbft|ftlb)$/.test(key)) return create("lb-ft", "torque", "Nm", 1.3558179483);
  if (key === "pa") return create("Pa", "pressure", "kPa", 0.001);
  if (key === "hpa" || key === "mbar") return create(key === "hpa" ? "hPa" : "mbar", "pressure", "kPa", 0.1);
  if (key === "kpa") return create("kPa", "pressure", "kPa", 1);
  if (key === "mpa") return create("MPa", "pressure", "kPa", 1_000);
  if (/^bar[ag]?$/.test(key)) return create("bar", "pressure", "kPa", 100);
  if (/^psi[ag]?$/.test(key)) return create("psi", "pressure", "kPa", 6.8947572932);
  if (key === "%" || key === "percent") return create("%", "percent", "%", 1);
  if (/^(?:degc|c|celsius)$/.test(key)) return create("°C", "temperature", "°C", 1);
  if (/^(?:degf|f|fahrenheit)$/.test(key)) return create("°F", "temperature", "°C", 5 / 9, (-32 * 5) / 9);
  if (key === "k" || key === "kelvin") return create("K", "temperature", "°C", 1, -273.15);
  if (/^(?:ms|msec|millisecond|milliseconds)$/.test(key)) return create("ms", "time", "s", 0.001);
  if (/^(?:s|sec|second|seconds)$/.test(key)) return create("s", "time", "s", 1);
  if (/^(?:g\/s|gs)$/.test(key)) return create("g/s", "airflow", "g/s", 1);
  if (/^(?:kg\/h|kgh)$/.test(key)) return create("kg/h", "airflow", "g/s", 1_000 / 3_600);
  if (/^(?:mg\/stroke|mgstroke|mg\/str|mg\/hub)$/.test(key)) {
    return create("mg/stroke", "airflow", null, null);
  }
  if (/^(?:km\/h|kmh|kph)$/.test(key)) return create("km/h", "speed", "km/h", 1);
  if (key === "mph") return create("mph", "speed", "km/h", 1.609344);
  if (/^(?:deg|degree|degrees|btdc)$/.test(key)) return create("deg", "angle", "deg", 1);

  if (!raw && kind === "rpm") return create("rpm", "engine_speed", "rpm", 1);
  if (!raw && kind === "sample") return create("sample", "sample", "sample", 1);
  if (!raw && (kind === "lambda" || kind === "afr")) {
    return create(kind === "lambda" ? "λ" : "AFR", "ratio", kind === "lambda" ? "λ" : "AFR", 1);
  }
  if (!raw && kind === "time") return create(null, "time", null, null);
  if (!raw && kind === "torque") return create(null, "torque", null, null);
  if (!raw && (kind === "boost_actual" || kind === "boost_target" || kind === "rail_actual" || kind === "rail_target")) {
    return create(null, "pressure", null, null);
  }
  if (!raw && (kind === "throttle" || kind === "pedal")) {
    return create(null, "percent", null, null);
  }
  if (!raw && (kind === "iat" || kind === "coolant" || kind === "egt")) {
    return create(null, "temperature", null, null);
  }
  if (!raw && kind === "airflow") return create(null, "airflow", null, null);
  if (!raw && kind === "speed") return create(null, "speed", null, null);
  if (!raw && kind === "ignition") return create(null, "angle", null, null);

  return create(raw, "unknown", null, null);
}

function hasTargetMarker(header: string) {
  return /\b(?:target|requested|request|desired|specified|setpoint|commanded|nominal|soll)\b/.test(header);
}

function channelKindFromHeader(header: string): LogStudioChannelKind {
  const normalized = normalizeText(header);
  const compact = normalized.replace(/[^a-z0-9]/g, "");
  const target = hasTargetMarker(normalized);

  if (/^(?:sample|sample number|sample no|index|row|record|frame)$/.test(normalized)) return "sample";
  if (/\b(?:timestamp|time stamp|elapsed time|elapsed|time)\b/.test(normalized)) return "time";
  if (/\brpm\b|\bengine speed\b|\bmotor speed\b|\bn mot\b/.test(normalized) || /^(?:nmot|enginespeedrpm)$/.test(compact)) {
    return "rpm";
  }
  if (/\b(?:rail pressure|fuel rail|common rail|railpressure|rail press|kraftstoffdruck)\b/.test(normalized)) {
    return target ? "rail_target" : "rail_actual";
  }
  if (/\b(?:boost|charge pressure|manifold pressure|manifold absolute pressure|map pressure|turbo pressure|ladedruck)\b/.test(normalized)) {
    return target ? "boost_target" : "boost_actual";
  }
  if (/\b(?:engine torque|torque|moment)\b/.test(normalized)) return "torque";
  if (/\blambda\b|\bo2 equivalence\b|\bequivalence ratio\b/.test(normalized)) return "lambda";
  if (/\bafr\b|\bair fuel ratio\b/.test(normalized)) return "afr";
  if (/\b(?:accelerator pedal|accelerator position|pedal position|pedal)\b/.test(normalized)) return "pedal";
  if (/\b(?:throttle valve|throttle position|throttle angle|throttle)\b/.test(normalized)) return "throttle";
  if (/\b(?:intake air temp|intake air temperature|intake temperature|charge air temp|charge air temperature|inlet air temp|inlet air temperature|iat)\b/.test(normalized)) return "iat";
  if (/\b(?:coolant temp|coolant temperature|engine coolant|ect)\b/.test(normalized)) return "coolant";
  if (/\b(?:exhaust gas temp|exhaust temperature|exhaust temp|egt)\b/.test(normalized)) return "egt";
  if (/\b(?:mass air flow|air mass flow|air mass|airflow|maf)\b/.test(normalized)) return "airflow";
  if (/\b(?:vehicle speed|road speed|wheel speed|kmh|kph|mph)\b/.test(normalized)) return "speed";
  if (/\b(?:ignition timing|ignition angle|spark timing|spark advance|ignition advance|ignition)\b/.test(normalized)) return "ignition";

  return "other";
}

function labelFromHeader(header: string) {
  const cleaned = header
    .replace(/(?:\s*[[(][^\])]{1,32}[\])])\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || header.trim() || "Unnamed channel";
}

function slug(value: string) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function channelId(
  candidate: CandidateChannel,
  usedIds: Set<string>
) {
  const base = candidate.kind === "other"
    ? slug(candidate.label) || `channel-${candidate.index + 1}`
    : candidate.kind.replaceAll("_", "-");
  let id = base;
  let suffix = 2;

  while (usedIds.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }

  usedIds.add(id);
  return id;
}

function chooseAxis(channels: LogStudioChannel[], rows: LogStudioRow[]): LogStudioAxis {
  const preferredKinds: Array<"rpm" | "time" | "sample"> = ["rpm", "time", "sample"];

  for (const kind of preferredKinds) {
    const candidates = channels
      .filter((channel) => channel.kind === kind)
      .sort((left, right) => right.numericValueCount - left.numericValueCount);
    const channel = candidates[0];
    if (channel && rows.some((row) => row.values[channel.id] !== null)) {
      return {
        channelId: channel.id,
        kind,
        label: channel.label,
        unit: channel.unit,
        synthetic: false,
      };
    }
  }

  return {
    channelId: null,
    kind: "sample",
    label: "Sample",
    unit: unitFromHeader("Sample", "sample"),
    synthetic: true,
  };
}

function axisValue(row: LogStudioRow, axis: LogStudioAxis) {
  return axis.channelId ? row.values[axis.channelId] ?? null : row.rowNumber;
}

function formatNumber(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1_000) return value.toFixed(0);
  if (absolute >= 100) return value.toFixed(1);
  if (absolute >= 10) return value.toFixed(2);
  return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function axisContextLabel(row: LogStudioRow, axis: LogStudioAxis) {
  const value = axisValue(row, axis);
  if (value === null) return `row ${row.rowNumber}`;
  const symbol = axis.unit.symbol;
  return `${formatNumber(value)}${symbol ? ` ${symbol}` : ""}`;
}

function valueContext(
  row: LogStudioRow,
  value: number,
  axis: LogStudioAxis
): LogStudioValueContext {
  return {
    value: round(value),
    rowNumber: row.rowNumber,
    xValue: axisValue(row, axis),
    xLabel: axisContextLabel(row, axis),
  };
}

function buildSummaries(
  channels: LogStudioChannel[],
  rows: LogStudioRow[],
  axis: LogStudioAxis
) {
  return channels.map<LogStudioChannelSummary>((channel) => {
    const present = rows
      .map((row) => ({ row, value: row.values[channel.id] }))
      .filter((item): item is { row: LogStudioRow; value: number } => item.value !== null);

    if (!present.length) {
      return {
        channelId: channel.id,
        kind: channel.kind,
        label: channel.label,
        unit: channel.unit,
        valueCount: 0,
        missingValueCount: rows.length,
        coveragePercent: 0,
        min: null,
        max: null,
        average: null,
        peak: null,
      };
    }

    const minItem = present.reduce((best, item) => item.value < best.value ? item : best);
    const maxItem = present.reduce((best, item) => item.value > best.value ? item : best);
    const average = present.reduce((total, item) => total + item.value, 0) / present.length;

    return {
      channelId: channel.id,
      kind: channel.kind,
      label: channel.label,
      unit: channel.unit,
      valueCount: present.length,
      missingValueCount: rows.length - present.length,
      coveragePercent: round((present.length / Math.max(1, rows.length)) * 100, 1),
      min: valueContext(minItem.row, minItem.value, axis),
      max: valueContext(maxItem.row, maxItem.value, axis),
      average: round(average),
      peak: valueContext(maxItem.row, maxItem.value, axis),
    };
  });
}

function unitsComparable(left: LogStudioUnit, right: LogStudioUnit) {
  if (
    left.dimension === "pressure" &&
    right.dimension === "pressure" &&
    left.pressureReference !== right.pressureReference &&
    (left.pressureReference !== "unknown" || right.pressureReference !== "unknown")
  ) {
    return false;
  }

  if (
    left.dimension === right.dimension &&
    left.toCanonicalFactor !== null &&
    right.toCanonicalFactor !== null
  ) {
    return true;
  }

  return Boolean(
    left.symbol &&
    right.symbol &&
    normalizeUnitKey(left.symbol) === normalizeUnitKey(right.symbol)
  );
}

function convertToUnit(value: number, from: LogStudioUnit, to: LogStudioUnit) {
  if (
    from.toCanonicalFactor !== null &&
    from.toCanonicalOffset !== null &&
    to.toCanonicalFactor !== null &&
    to.toCanonicalOffset !== null &&
    from.dimension === to.dimension
  ) {
    const canonical = value * from.toCanonicalFactor + from.toCanonicalOffset;
    return (canonical - to.toCanonicalOffset) / to.toCanonicalFactor;
  }

  if (
    from.symbol &&
    to.symbol &&
    normalizeUnitKey(from.symbol) === normalizeUnitKey(to.symbol)
  ) {
    return value;
  }

  return null;
}

function comparisonInsight(
  actual: LogStudioChannel,
  target: LogStudioChannel,
  rows: LogStudioRow[],
  axis: LogStudioAxis,
  family: "Boost pressure" | "Rail pressure"
): LogStudioInsight | null {
  if (!unitsComparable(actual.unit, target.unit)) return null;

  const gaps = rows.flatMap((row) => {
    const actualValue = row.values[actual.id];
    const targetValue = row.values[target.id];
    if (actualValue === null || targetValue === null) return [];
    const convertedTarget = convertToUnit(targetValue, target.unit, actual.unit);
    if (convertedTarget === null) return [];
    return [{
      row,
      actualValue,
      targetValue: convertedTarget,
      gap: actualValue - convertedTarget,
    }];
  });

  if (!gaps.length) return null;
  const largest = gaps.reduce((best, item) =>
    Math.abs(item.gap) > Math.abs(best.gap) ? item : best
  );
  const unit = actual.unit.symbol ? ` ${actual.unit.symbol}` : "";

  return {
    id: `${actual.id}-${target.id}-gap`,
    kind: "actual_target_gap",
    severity: "info",
    title: `${family} actual vs target`,
    text: `The largest aligned actual-to-target difference was ${formatNumber(Math.abs(largest.gap))}${unit} at ${axisContextLabel(largest.row, axis)}. This is a numeric log comparison, not a control-limit or component judgment.`,
    channelIds: [actual.id, target.id],
  };
}

function channelSummaryByKind(
  summaries: LogStudioChannelSummary[],
  kind: LogStudioChannelKind
) {
  return summaries
    .filter((summary) => summary.kind === kind && summary.valueCount > 0)
    .sort((left, right) => right.coveragePercent - left.coveragePercent);
}

function summaryUnit(summary: LogStudioChannelSummary) {
  return summary.unit.symbol ? ` ${summary.unit.symbol}` : "";
}

function rangeInsight(
  summary: LogStudioChannelSummary,
  title: string
): LogStudioInsight | null {
  if (!summary.min || !summary.max || summary.average === null) return null;
  const unit = summaryUnit(summary);
  return {
    id: `${summary.channelId}-range`,
    kind: "channel_range",
    severity: "info",
    title,
    text: `${summary.label} ranged from ${formatNumber(summary.min.value)} to ${formatNumber(summary.max.value)}${unit}, with an average of ${formatNumber(summary.average)}${unit}.`,
    channelIds: [summary.channelId],
  };
}

function buildInsights(
  channels: LogStudioChannel[],
  rows: LogStudioRow[],
  axis: LogStudioAxis,
  summaries: LogStudioChannelSummary[]
) {
  const insights: LogStudioInsight[] = [{
    id: "aligned-log-coverage",
    kind: "coverage",
    severity: "info",
    title: "Aligned log coverage",
    text: `${rows.length} aligned numeric row${rows.length === 1 ? "" : "s"} were retained across ${channels.length} channel${channels.length === 1 ? "" : "s"}.`,
    channelIds: channels.map((channel) => channel.id),
  }];

  const rpm = channelSummaryByKind(summaries, "rpm")[0];
  if (rpm?.min && rpm.max) {
    insights.push({
      id: `${rpm.channelId}-window`,
      kind: "rpm_window",
      severity: "info",
      title: "Logged engine-speed window",
      text: `Engine speed covered ${formatNumber(rpm.min.value)} to ${formatNumber(rpm.max.value)}${summaryUnit(rpm)} across the retained rows.`,
      channelIds: [rpm.channelId],
    });
  }

  const torque = channelSummaryByKind(summaries, "torque")[0];
  if (torque?.peak) {
    insights.push({
      id: `${torque.channelId}-peak`,
      kind: "channel_peak",
      severity: "info",
      title: "Highest logged torque value",
      text: `${torque.label} reached ${formatNumber(torque.peak.value)}${summaryUnit(torque)} at ${torque.peak.xLabel}. This reports the logged channel and does not validate delivered engine torque.`,
      channelIds: [torque.channelId],
    });
  }

  for (const boost of channelSummaryByKind(summaries, "boost_actual")) {
    if (!boost.peak) continue;
    insights.push({
      id: `${boost.channelId}-peak`,
      kind: "boost_peak",
      severity: "info",
      title: "Highest logged pressure value",
      text: `${boost.label} reached ${formatNumber(boost.peak.value)}${summaryUnit(boost)} at ${boost.peak.xLabel}. This is reported only because a recognized boost or manifold-pressure channel exists in the source log and is not a boost target, gauge-pressure conversion or component-limit judgment.`,
      channelIds: [boost.channelId],
    });
  }

  const actualTargetFamilies: Array<{
    actualKind: "boost_actual" | "rail_actual";
    targetKind: "boost_target" | "rail_target";
    title: "Boost pressure" | "Rail pressure";
  }> = [
    { actualKind: "boost_actual", targetKind: "boost_target", title: "Boost pressure" },
    { actualKind: "rail_actual", targetKind: "rail_target", title: "Rail pressure" },
  ];

  for (const family of actualTargetFamilies) {
    const actuals = channels.filter((channel) => channel.kind === family.actualKind);
    const targets = channels.filter((channel) => channel.kind === family.targetKind);
    const usedTargets = new Set<string>();

    for (const actual of actuals) {
      const target = targets
        .filter((candidate) => !usedTargets.has(candidate.id) && unitsComparable(actual.unit, candidate.unit))
        .sort((left, right) => Math.abs(left.index - actual.index) - Math.abs(right.index - actual.index))[0];
      if (!target) continue;
      const insight = comparisonInsight(actual, target, rows, axis, family.title);
      if (insight) {
        insights.push(insight);
        usedTargets.add(target.id);
      }
    }
  }

  const rangeTitles: Partial<Record<LogStudioChannelKind, string>> = {
    lambda: "Lambda range",
    afr: "Air-fuel ratio range",
    throttle: "Throttle range",
    pedal: "Pedal range",
    iat: "Intake-air temperature range",
    coolant: "Coolant temperature range",
    egt: "Exhaust-gas temperature range",
    rail_actual: "Rail-pressure range",
    airflow: "Airflow range",
    speed: "Vehicle-speed range",
    ignition: "Ignition-channel range",
  };

  for (const summary of summaries) {
    const title = rangeTitles[summary.kind];
    if (!title) continue;
    const insight = rangeInsight(summary, title);
    if (insight) insights.push(insight);
  }

  insights.push({
    id: "descriptive-review-boundary",
    kind: "limitation",
    severity: "caution",
    title: "Descriptive review boundary",
    text: "These summaries describe captured values and alignment only. Vehicle context and qualified human review are required before any calibration, repair, component-limit or operational decision.",
    channelIds: [],
  });

  return insights;
}

function buildMissingChannels(channels: LogStudioChannel[]) {
  const has = (...kinds: LogStudioChannelKind[]) =>
    channels.some((channel) => kinds.includes(channel.kind));
  const missing: string[] = [];

  if (!has("rpm")) missing.push("Engine speed (RPM)");
  if (!has("torque")) missing.push("Engine torque");
  if (!has("boost_actual")) missing.push("Boost pressure actual");
  if (!has("boost_target")) missing.push("Boost pressure target");
  if (!has("lambda", "afr")) missing.push("Lambda or AFR");
  if (!has("throttle", "pedal")) missing.push("Throttle or pedal position");
  if (!has("iat")) missing.push("Intake-air temperature");
  if (!has("coolant")) missing.push("Coolant temperature");
  if (!has("egt")) missing.push("Exhaust-gas temperature");
  if (!has("rail_actual")) missing.push("Rail pressure actual");
  if (!has("rail_target")) missing.push("Rail pressure target");
  if (!has("airflow")) missing.push("Airflow");
  if (!has("speed")) missing.push("Vehicle speed");
  if (!has("ignition")) missing.push("Ignition timing");

  return missing;
}

function axisHealth(rows: LogStudioRow[], axis: LogStudioAxis) {
  const values = rows
    .map((row) => axisValue(row, axis))
    .filter((value): value is number => value !== null);
  let monotonic = true;

  for (let index = 1; index < values.length; index += 1) {
    if (values[index] < values[index - 1]) {
      monotonic = false;
      break;
    }
  }

  return {
    coveragePercent: rows.length ? (values.length / rows.length) * 100 : 0,
    monotonic,
    duplicateCount: Math.max(0, values.length - new Set(values).size),
  };
}

function buildQuality(input: {
  channels: LogStudioChannel[];
  rows: LogStudioRow[];
  processedRowCount: number;
  axis: LogStudioAxis;
  truncated: LogStudioAnalysis["truncated"];
}) {
  const reasons: string[] = [];
  let score = 100;
  const accepted = input.rows.length;
  const acceptedRatio = accepted / Math.max(1, input.processedRowCount);
  const measurementChannels = input.channels.filter((channel) =>
    !["sample", "time", "rpm"].includes(channel.kind)
  );
  const averageCoveragePercent = measurementChannels.length
    ? measurementChannels.reduce((total, channel) => total + channel.coveragePercent, 0) /
      measurementChannels.length
    : 0;
  const axis = axisHealth(input.rows, input.axis);

  if (accepted < 5) {
    score -= 30;
    reasons.push("Fewer than five aligned rows limit trend context.");
  } else if (accepted < 20) {
    score -= 15;
    reasons.push("Fewer than twenty aligned rows provide only a short trend window.");
  } else if (accepted < 50) {
    score -= 5;
    reasons.push("The retained log contains fewer than fifty aligned rows.");
  }

  if (acceptedRatio < 0.75) {
    score -= 20;
    reasons.push("More than one quarter of processed rows contained no retained numeric values.");
  } else if (acceptedRatio < 0.9) {
    score -= 10;
    reasons.push("Some processed rows contained no retained numeric values.");
  }

  if (!measurementChannels.length) {
    score -= 25;
    reasons.push("No measurement channel beyond the x-axis was retained.");
  } else if (measurementChannels.length === 1) {
    score -= 10;
    reasons.push("Only one non-axis measurement channel was retained.");
  }

  if (measurementChannels.length && averageCoveragePercent < 60) {
    score -= 20;
    reasons.push("Average measurement-channel coverage is below 60 percent.");
  } else if (measurementChannels.length && averageCoveragePercent < 80) {
    score -= 10;
    reasons.push("Average measurement-channel coverage is below 80 percent.");
  } else if (measurementChannels.length && averageCoveragePercent < 95) {
    score -= 5;
    reasons.push("Some retained channels contain missing values.");
  }

  if (input.axis.synthetic) {
    score -= 10;
    reasons.push("No RPM, time or source sample channel was available; row number is used as the x-axis.");
  } else if (axis.coveragePercent < 80) {
    score -= 10;
    reasons.push("The selected x-axis is missing in more than 20 percent of retained rows.");
  }

  if (!axis.monotonic) {
    score -= 10;
    reasons.push("The selected x-axis is not monotonic in source order.");
  }

  if (axis.duplicateCount > 0) {
    score -= Math.min(10, axis.duplicateCount);
    reasons.push(`${axis.duplicateCount} duplicate x-axis value${axis.duplicateCount === 1 ? " was" : "s were"} detected.`);
  }

  if (input.truncated.characters) {
    score -= 5;
    reasons.push("Input was truncated at the character boundary.");
  }
  if (input.truncated.rows) {
    score -= 5;
    reasons.push("Input was truncated at the row boundary.");
  }
  if (input.truncated.channels) {
    score -= 5;
    reasons.push("Input was truncated at the channel boundary.");
  }

  const finalScore = clamp(Math.round(score), 0, 100);
  const label: LogStudioQualityLabel = finalScore >= 85
    ? "strong"
    : finalScore >= 65
      ? "usable"
      : "limited";

  if (!reasons.length) {
    reasons.push("Row alignment, x-axis order and retained-channel coverage are structurally consistent.");
  }

  return {
    score: finalScore,
    label,
    reasons,
    averageCoveragePercent: round(averageCoveragePercent, 1),
    xAxisMonotonic: axis.monotonic,
    duplicateXAxisCount: axis.duplicateCount,
  } satisfies LogStudioQuality;
}

function unitComparisonWarnings(channels: LogStudioChannel[]) {
  const warnings: string[] = [];
  const pairs: Array<{
    actual: "boost_actual" | "rail_actual";
    target: "boost_target" | "rail_target";
    label: string;
  }> = [
    { actual: "boost_actual", target: "boost_target", label: "Boost pressure" },
    { actual: "rail_actual", target: "rail_target", label: "Rail pressure" },
  ];

  for (const pair of pairs) {
    const actuals = channels.filter((channel) => channel.kind === pair.actual);
    const targets = channels.filter((channel) => channel.kind === pair.target);
    if (!actuals.length || !targets.length) continue;
    if (!actuals.some((actual) => targets.some((target) => unitsComparable(actual.unit, target.unit)))) {
      warnings.push(`${pair.label} actual and target channels use missing, incompatible or differently referenced units, so no gap was calculated.`);
    }
  }

  return warnings;
}

export function analyzeLogStudio(input: string): LogStudioAnalysis {
  if (!input.trim()) {
    return emptyAnalysis("empty", ["Select a delimited log or paste numeric log rows to begin."]);
  }

  const charactersTruncated = input.length > maxLogStudioCharacters;
  let bounded = input.slice(0, maxLogStudioCharacters).replace(/^\uFEFF/, "");

  if (charactersTruncated) {
    const lastCompleteLine = Math.max(bounded.lastIndexOf("\n"), bounded.lastIndexOf("\r"));
    if (lastCompleteLine > 0) bounded = bounded.slice(0, lastCompleteLine);
  }

  const lines = bounded
    .split(/\r?\n|\r/)
    .map((line) => line.trim())
    .filter(Boolean);
  const delimiter = detectDelimiter(lines);

  if (!delimiter) {
    const result = emptyAnalysis("invalid", ["A comma, semicolon or tab-delimited header could not be detected."]);
    result.truncated.characters = charactersTruncated;
    return result;
  }

  const firstCells = splitDelimitedLine(lines[0] ?? "", delimiter);
  const firstNumeric = firstCells.map(parseNumericCell);
  const headerlessRpmTorque =
    firstCells.length === 2 &&
    firstNumeric.every((value) => value !== null) &&
    (firstNumeric[0] ?? 0) >= 100 &&
    (firstNumeric[1] ?? 0) > 0;
  const headers = headerlessRpmTorque
    ? ["Engine Speed (rpm)", "Engine Torque (Nm)"]
    : firstCells;
  const dataLines = headerlessRpmTorque ? lines : lines.slice(1);
  const sourceRowCount = dataLines.length;
  const rowsTruncated = sourceRowCount > maxLogStudioRows;
  const processedLines = dataLines.slice(0, maxLogStudioRows);
  const candidateColumnCount = Math.min(headers.length, maxCandidateColumns);

  if (!headers.length || !processedLines.length) {
    const result = emptyAnalysis("invalid", ["The log needs a header and at least one numeric data row."], delimiter);
    result.truncated = {
      characters: charactersTruncated,
      rows: rowsTruncated,
      channels: headers.length > maxLogStudioChannels,
    };
    result.source.sourceRowCount = sourceRowCount;
    return result;
  }

  const parsedRows = processedLines.map((line) =>
    splitDelimitedLine(line, delimiter)
      .slice(0, candidateColumnCount)
      .map(parseNumericCell)
  );
  const candidates = headers
    .slice(0, candidateColumnCount)
    .map<CandidateChannel>((rawHeader, index) => {
      const header = rawHeader.trim() || `Channel ${index + 1}`;
      const kind = channelKindFromHeader(header);
      const values = parsedRows.map((row) => row[index] ?? null);
      return {
        index,
        header,
        label: labelFromHeader(header),
        kind,
        unit: unitFromHeader(header, kind),
        values,
        numericValueCount: values.filter((value) => value !== null).length,
      };
    });
  const minimumOtherValues = Math.min(2, processedLines.length);
  const recognized = candidates.filter((candidate) =>
    candidate.kind !== "other" && candidate.numericValueCount > 0
  );
  const otherNumeric = candidates.filter((candidate) =>
    candidate.kind === "other" &&
    candidate.numericValueCount >= minimumOtherValues &&
    candidate.numericValueCount / Math.max(1, processedLines.length) >= 0.5
  );
  const eligible = [...recognized, ...otherNumeric];
  const selectedCandidates = eligible
    .slice(0, maxLogStudioChannels)
    .sort((left, right) => left.index - right.index);
  const channelsTruncated =
    headers.length > maxCandidateColumns || eligible.length > maxLogStudioChannels;

  if (!selectedCandidates.length) {
    const result = emptyAnalysis("invalid", ["No numeric channels were detected in the retained rows."], delimiter);
    result.truncated = {
      characters: charactersTruncated,
      rows: rowsTruncated,
      channels: channelsTruncated,
    };
    result.source = {
      sourceRowCount,
      processedRowCount: processedLines.length,
      acceptedRowCount: 0,
      rejectedRowCount: processedLines.length,
    };
    return result;
  }

  const usedIds = new Set<string>();
  const selected = selectedCandidates.map((candidate) => ({
    candidate,
    channel: {
      id: channelId(candidate, usedIds),
      index: candidate.index,
      header: candidate.header,
      label: candidate.label,
      kind: candidate.kind,
      unit: candidate.unit,
      numericValueCount: candidate.numericValueCount,
      coveragePercent: round(
        (candidate.numericValueCount / Math.max(1, processedLines.length)) * 100,
        1
      ),
    } satisfies LogStudioChannel,
  }));
  const rows = parsedRows.flatMap<LogStudioRow>((_, rowIndex) => {
    const values = Object.fromEntries(
      selected.map(({ candidate, channel }) => [
        channel.id,
        candidate.values[rowIndex] ?? null,
      ])
    );
    if (!Object.values(values).some((value) => value !== null)) return [];
    return [{ rowNumber: rowIndex + 1, values }];
  });
  const channels = selected.map((item) => item.channel);
  const xAxis = chooseAxis(channels, rows);
  const truncated = {
    characters: charactersTruncated,
    rows: rowsTruncated,
    channels: channelsTruncated,
  };
  const summaries = buildSummaries(channels, rows, xAxis);
  const quality = buildQuality({
    channels,
    rows,
    processedRowCount: processedLines.length,
    axis: xAxis,
    truncated,
  });
  const warnings: string[] = [];

  if (headerlessRpmTorque) {
    warnings.push("No header was present; the two numeric columns were treated as RPM and torque rows.");
  }
  if (charactersTruncated) {
    warnings.push(`Only the first ${maxLogStudioCharacters.toLocaleString("en-US")} characters were inspected.`);
  }
  if (rowsTruncated) {
    warnings.push(`Only the first ${maxLogStudioRows.toLocaleString("en-US")} data rows were inspected.`);
  }
  if (channelsTruncated) {
    warnings.push(`Only ${maxLogStudioChannels} numeric channels were retained; recognized automotive channels were prioritized.`);
  }
  const rejectedRowCount = processedLines.length - rows.length;
  if (rejectedRowCount > 0) {
    warnings.push(`${rejectedRowCount} processed row${rejectedRowCount === 1 ? " contained" : "s contained"} no retained numeric values.`);
  }
  if (xAxis.synthetic) {
    warnings.push("No RPM, time or source sample channel was detected; row number is used as the x-axis.");
  }
  if (!quality.xAxisMonotonic) {
    warnings.push("The selected x-axis is not monotonic in source order; rows were not reordered.");
  }
  if (quality.duplicateXAxisCount > 0) {
    warnings.push(`${quality.duplicateXAxisCount} duplicate x-axis value${quality.duplicateXAxisCount === 1 ? " was" : "s were"} retained.`);
  }
  warnings.push(...unitComparisonWarnings(channels));

  return {
    contractVersion: "log-analysis-studio-v1",
    status: rows.length ? "ready" : "invalid",
    delimiter,
    truncated,
    source: {
      sourceRowCount,
      processedRowCount: processedLines.length,
      acceptedRowCount: rows.length,
      rejectedRowCount,
    },
    channels,
    rows,
    xAxis,
    summaries,
    quality,
    insights: buildInsights(channels, rows, xAxis, summaries),
    warnings: unique(warnings),
    missingChannels: buildMissingChannels(channels),
    safetyBoundaries: [...safetyBoundaries],
  };
}
