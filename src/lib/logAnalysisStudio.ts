export const maxLogStudioCharacters = 5_000_000;
export const maxLogStudioRows = 50_000;
export const maxLogStudioFullRows = 15_000;
export const maxLogStudioChannels = 64;
export const maxLogStudioCells = 500_000;
export const maxCalculatedEngineTorqueNm = 20_000;

const maxCandidateColumns = 192;
const maxPreambleLines = 30;
const maxAnalyzableMagnitude = 1_000_000_000;

export type LogStudioStatus = "empty" | "invalid" | "ready";
export type LogStudioDelimiter = "," | ";" | "\t";
export type LogStudioQualityLabel = "strong" | "usable" | "limited";
export type LogStudioInsightSeverity = "info" | "caution";
export type LogStudioPressureReference = "absolute" | "gauge" | "unknown";
export type LogStudioAnalysisProfile = "full" | "performance";

export type LogStudioChannelKind =
  | "sample"
  | "time"
  | "rpm"
  | "torque"
  | "torque_target"
  | "boost_actual"
  | "boost_target"
  | "lambda"
  | "afr"
  | "throttle"
  | "pedal"
  | "iat"
  | "coolant"
  | "egt"
  | "egr_actual"
  | "egr_target"
  | "dpf_pressure"
  | "oil_temperature"
  | "rail_actual"
  | "rail_target"
  | "fuel_quantity"
  | "airflow"
  | "speed"
  | "ignition"
  | "voltage"
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
  | "voltage"
  | "fuel_quantity"
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
  | "egr_activity"
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
  const scaled = value * factor;
  return Number.isFinite(scaled) ? Math.round(scaled) / factor : value;
}

function finiteWithinSummaryMagnitude(value: number) {
  return Number.isFinite(value) && Math.abs(value) <= maxAnalyzableMagnitude;
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
    .replace(/\u00b3/g, "3")
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

function splitDelimitedLine(
  line: string,
  delimiter: LogStudioDelimiter,
  valueLimit = maxCandidateColumns + 1
) {
  const decodeCell = (value: string) =>
    value.trim().replace(/"+/g, (quotes) => '"'.repeat(Math.floor(quotes.length / 2)));
  if (!line.includes(delimiter)) return [decodeCell(line)];

  const values: string[] = [];
  let cellStart = 0;
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
      continue;
    }

    if (char === delimiter && !quoted) {
      values.push(decodeCell(line.slice(cellStart, index)));
      if (values.length >= valueLimit) return values;
      cellStart = index + 1;
      continue;
    }
  }

  values.push(decodeCell(line.slice(cellStart)));
  return values;
}

function splitWhitespaceFields(line: string, valueLimit = maxCandidateColumns + 1) {
  const trimmed = line.trim();
  return trimmed ? trimmed.split(/\s+/, valueLimit) : [];
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

function parseChannelNumericCell(
  value: string | undefined,
  kind: LogStudioChannelKind
) {
  const trimmed = value?.trim().replace(/\u00a0/g, "") ?? "";
  const groupedPattern = /^[+-]?\d{1,3}[,.]\d{3}$/;
  const decimalValue = parseNumericCell(value);
  const shouldGroup = kind === "rpm" && groupedPattern.test(trimmed);
  if (shouldGroup) {
    const grouped = Number(trimmed.replace(/[,.]/g, ""));
    return Number.isFinite(grouped) ? grouped : null;
  }
  return decimalValue;
}

function findHeaderlessWhitespaceTableStart(lines: string[]) {
  const lastCandidate = Math.min(lines.length - 2, maxPreambleLines);
  for (let lineIndex = 0; lineIndex <= lastCandidate; lineIndex += 1) {
    const current = splitWhitespaceFields(lines[lineIndex] ?? "", 3);
    const next = splitWhitespaceFields(lines[lineIndex + 1] ?? "", 3);
    if (
      current.length === 2 &&
      next.length === 2 &&
      current.every((cell) => parseNumericCell(cell) !== null) &&
      next.every((cell) => parseNumericCell(cell) !== null)
    ) {
      return lineIndex;
    }
  }
  return null;
}

const unsigned16SentinelCounts = [32_766, 32_767, 32_768, 65_534, 65_535, 65_536];

function isUnsigned16Sentinel(value: number) {
  return unsigned16SentinelCounts.includes(Math.abs(value));
}

function isScaledUnsigned16Sentinel(value: number) {
  const absolute = Math.abs(value);
  return [0.001, 0.01, 0.1].some((scale) =>
    unsigned16SentinelCounts.some((sentinel) =>
      Math.abs(absolute - sentinel * scale) <= Math.max(1e-9, scale * 1e-6)
    )
  );
}

function findTableStart(lines: string[]) {
  const delimiters: LogStudioDelimiter[] = ["\t", ";", ","];
  let best: { lineIndex: number; delimiter: LogStudioDelimiter; score: number } | null = null;
  const lastCandidate = Math.min(lines.length - 1, maxPreambleLines);

  for (let lineIndex = 0; lineIndex <= lastCandidate; lineIndex += 1) {
    for (const delimiter of delimiters) {
      const headerCells = splitDelimitedLine(lines[lineIndex] ?? "", delimiter);
      if (headerCells.length < 2) continue;

      const dataCandidates = lines
        .slice(lineIndex + 1, lineIndex + 4)
        .map((line) => splitDelimitedLine(line, delimiter))
        .filter((cells) => Math.abs(cells.length - headerCells.length) <= 1);
      const numericCounts = dataCandidates.map(
        (cells) => cells.filter((cell) => parseNumericCell(cell) !== null).length
      );
      const bestNumericCount = Math.max(0, ...numericCounts);
      const recognizedHeaders = headerCells.filter(
        (header) => channelKindFromHeader(header) !== "other"
      ).length;
      const numericColumnCoverage = headerCells.filter((_, columnIndex) =>
        dataCandidates.some(
          (cells) => parseNumericCell(cells[columnIndex]) !== null
        )
      ).length;
      const sparseRecognizedTable =
        recognizedHeaders >= 2 &&
        bestNumericCount >= 1 &&
        numericColumnCoverage >= 2;
      if (
        bestNumericCount < Math.min(2, headerCells.length) &&
        !sparseRecognizedTable
      ) continue;

      const numericHeaders = headerCells.filter(
        (header) => parseNumericCell(header) !== null
      ).length;
      const headerlessPair =
        headerCells.length === 2 && numericHeaders === headerCells.length;
      const score =
        headerCells.length * 2 +
        bestNumericCount * 4 +
        recognizedHeaders * 8 -
        numericHeaders * 2 +
        (headerlessPair ? 6 : 0) -
        lineIndex * 0.1;

      if (!best || score > best.score) {
        best = { lineIndex, delimiter, score };
      }
    }
  }

  return best;
}

function mergeSeparateUnitRow(
  headers: string[],
  dataLines: string[],
  delimiter: LogStudioDelimiter
) {
  const cells = splitDelimitedLine(dataLines[0] ?? "", delimiter);
  if (cells.length < 2 || Math.abs(cells.length - headers.length) > 1) {
    return { headers, dataLines, detected: false };
  }

  const nonEmpty = cells.filter((cell) => cell.trim()).length;
  const numeric = cells.filter((cell) => parseNumericCell(cell) !== null).length;
  const recognizedUnits = cells.filter((cell) => {
    const value = cell.trim().replace(/^[[(]|[\])]$/g, "");
    return Boolean(extractRawUnit(value));
  }).length;
  const unitThreshold = Math.max(2, Math.ceil(nonEmpty * 0.5));

  if (numeric > 1 || recognizedUnits < unitThreshold) {
    return { headers, dataLines, detected: false };
  }

  const merged = headers.map((header, index) => {
    const unit = cells[index]?.trim().replace(/^[[(]|[\])]$/g, "");
    if (!unit || extractRawUnit(header)) return header;
    return `${header} [${unit}]`;
  });

  return { headers: merged, dataLines: dataLines.slice(1), detected: true };
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
    [/\bmm(?:3|\u00b3)\s*\/\s*(?:stroke|str|hub)\b/i, "mm3/stroke"],
    [/\bg\s*\/\s*s\b/i, "g/s"],
    [/\bkm\s*\/\s*h\b|\bkmh\b/i, "km/h"],
    [/\bmph\b/i, "mph"],
    [/\bmbar\b/i, "mbar"],
    [/\bhpa\b/i, "hPa"],
    [/\bkpa\b/i, "kPa"],
    [/\bmpa\b/i, "MPa"],
    [/\bbar[ag]?\b/i, normalized.match(/\bbar[ag]\b/i)?.[0] ?? "bar"],
    [/\bpsi[ag]?\b/i, normalized.match(/\bpsi[ag]\b/i)?.[0] ?? "psi"],
    [/\b(?:lb|lbf)\s*[-/]?\s*ft\b|\bft\s*[-/]?\s*(?:lb|lbf)\b/i, "lb-ft"],
    [/\bn\s*m\b/i, "Nm"],
    [/\brpm\b|\b(?:rev|r)\s*\/\s*min\b|\b1\s*\/\s*min\b|\bmin\s*\^?\s*-?1\b/i, "rpm"],
    [/\bmilliseconds?\b|\bmsec\b|\bms\b/i, "ms"],
    [/\bseconds?\b|\bsec\b/i, "s"],
    [/\bdeg\s*c\b|\bcelsius\b|\u00b0c/i, "degC"],
    [/\bdeg\s*f\b|\bfahrenheit\b|\u00b0f/i, "degF"],
    [/\bkelvin\b/i, "K"],
    [/\bdegrees?\b|\bdeg\b|\bbtdc\b/i, "deg"],
    [/\bvolts?\b|\bvolt\b|\bv\b/i, "V"],
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

  if (/^(?:rpm|rev\/min|r\/min|1\/min|min-?1)$/.test(key)) {
    return create("rpm", "engine_speed", "rpm", 1);
  }
  if (/^(?:nm|n\*m)$/.test(key)) return create("Nm", "torque", "Nm", 1);
  if (/^(?:(?:lb|lbf)-?ft|(?:ft)-?(?:lb|lbf)|lbft|ftlb)$/.test(key)) {
    return create("lb-ft", "torque", "Nm", 1.3558179483);
  }
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
    return create("mg/stroke", "fuel_quantity", "mg/stroke", 1);
  }
  if (/^(?:mm3\/stroke|mm3stroke|mm3\/str|mm3\/hub)$/.test(key)) {
    return create("mm³/stroke", "fuel_quantity", "mm³/stroke", 1);
  }
  if (/^(?:km\/h|kmh|kph)$/.test(key)) return create("km/h", "speed", "km/h", 1);
  if (key === "mph") return create("mph", "speed", "km/h", 1.609344);
  if (/^(?:deg|degree|degrees|btdc)$/.test(key)) return create("deg", "angle", "deg", 1);
  if (/^(?:v|volt|volts)$/.test(key)) return create("V", "voltage", "V", 1);

  if (!raw && kind === "rpm") return create("rpm", "engine_speed", "rpm", 1);
  if (!raw && kind === "sample") return create("sample", "sample", "sample", 1);
  if (!raw && (kind === "lambda" || kind === "afr")) {
    return create(kind === "lambda" ? "λ" : "AFR", "ratio", kind === "lambda" ? "λ" : "AFR", 1);
  }
  if (!raw && kind === "time") return create(null, "time", null, null);
  if (!raw && (kind === "torque" || kind === "torque_target")) return create(null, "torque", null, null);
  if (!raw && (kind === "boost_actual" || kind === "boost_target" || kind === "rail_actual" || kind === "rail_target")) {
    return create(null, "pressure", null, null);
  }
  if (!raw && kind === "dpf_pressure") return create(null, "pressure", null, null);
  if (!raw && (kind === "throttle" || kind === "pedal" || kind === "egr_actual" || kind === "egr_target")) {
    return create(null, "percent", null, null);
  }
  if (!raw && (kind === "iat" || kind === "coolant" || kind === "egt" || kind === "oil_temperature")) {
    return create(null, "temperature", null, null);
  }
  if (!raw && kind === "fuel_quantity") return create(null, "fuel_quantity", null, null);
  if (!raw && kind === "airflow") return create(null, "airflow", null, null);
  if (!raw && kind === "speed") return create(null, "speed", null, null);
  if (!raw && kind === "ignition") return create(null, "angle", null, null);
  if (!raw && kind === "voltage") return create(null, "voltage", null, null);

  return create(raw, "unknown", null, null);
}

function analyzableChannelValue(
  kind: LogStudioChannelKind,
  unit: LogStudioUnit,
  value: number
) {
  if (!Number.isFinite(value)) return false;
  if (kind === "time" || kind === "sample") {
    return Math.abs(value) <= Number.MAX_SAFE_INTEGER;
  }
  if (!finiteWithinSummaryMagnitude(value)) return false;
  if (isUnsigned16Sentinel(value)) return false;
  const canonical = unit.toCanonicalFactor === null || unit.toCanonicalOffset === null
    ? null
    : value * unit.toCanonicalFactor + unit.toCanonicalOffset;
  const canonicalMagnitude = Math.abs(canonical ?? value);

  if (isScaledUnsigned16Sentinel(value)) {
    if (kind === "lambda" && canonicalMagnitude > 10) return false;
    if (kind === "afr" && canonicalMagnitude > 200) return false;
    if (kind === "speed" && canonicalMagnitude > 500) return false;
    if (kind === "ignition" && canonicalMagnitude > 720) return false;
  }

  if (kind === "rpm") {
    return canonical !== null && canonical >= 0 && canonical <= 30_000;
  }
  if (kind === "torque" || kind === "torque_target") {
    return Math.abs(canonical ?? value) <= maxCalculatedEngineTorqueNm;
  }
  if (kind === "boost_actual" || kind === "boost_target") {
    return Math.abs(canonical ?? value) <= 5_000;
  }
  if (kind === "rail_actual" || kind === "rail_target") {
    return Math.abs(canonical ?? value) <= (canonical === null ? 5_000 : 500_000);
  }
  if (["iat", "coolant", "egt", "oil_temperature"].includes(kind)) {
    const temperature = canonical ?? value;
    return temperature >= -273.15 && temperature <= 5_000;
  }
  if (
    unit.dimension === "percent" &&
    ["throttle", "pedal", "egr_actual", "egr_target"].includes(kind)
  ) {
    return Math.abs(canonical ?? value) <= 1_000;
  }
  return true;
}

function analyzableSummaryValue(channel: LogStudioChannel, value: number) {
  return analyzableChannelValue(channel.kind, channel.unit, value);
}

function hasTargetMarker(header: string) {
  return /\b(?:target|requested|request|req|cmd|sp|ref|lim|des|desired|specified|setpoint|commanded|command|nominal|reference|referenz|demanded|demand|demande|consigne|wunsch|limit|limiter|limitation|maximum|max|soll|vorgabe|hedef|istenen|set point)\b|\bdriver(?: s)? wish\b|\bfahrerwunsch\b|\bsoll(?:wert|moment|druck|position)\b/.test(header);
}

function channelKindFromHeader(header: string): LogStudioChannelKind {
  const normalized = normalizeText(header);
  const compact = normalized.replace(/[^a-z0-9]/g, "");
  const rawUnit = extractRawUnit(header);
  const voltageUnit = rawUnit !== null && normalizeUnitKey(rawUnit) === "v";
  const target = hasTargetMarker(normalized);
  const crankSignal = /\b(?:crankshaft|crank shaft)\b/.test(normalized);
  const nonEngineRotationalSignal =
    !crankSignal && /\b(?:turbo|turbocharger|turbine|compressor|wheel|shaft|input shaft|output shaft|transmission|gearbox|clutch|converter|tc|driveshaft|axle|fan|pump)\b/.test(normalized);
  const nonEngineTorqueSignal =
    !crankSignal && /\b(?:transmission|gearbox|clutch|converter|turbine|tc|wheel|axle|driveshaft|input shaft|output shaft|friction|loss|brake)\b/.test(normalized);
  const measurementDuration =
    /\b(?:injection|injector|ignition|spark|dwell|pulse|opening|charging|charge|boost|response)\b.*\b(?:time|duration)\b/.test(normalized);
  const derivedOrCorrectionSignal =
    /\b(?:error|deviation|difference|delta|offset|reserve|margin|correction|intervention|reduction|drag|loss|gradient|derivative)\b/.test(normalized);
  const controlOutputSignal =
    /\b(?:duty|pwm|solenoid)\b|\b(?:actuator|valve|regulator)\b.*\b(?:position|current|voltage|command|duty)\b/.test(normalized);
  const boostControlOutput =
    /\b(?:boost|turbo|wastegate)\b/.test(normalized) && controlOutputSignal;
  const railControlOutput =
    /\b(?:rail|fuel rail|common rail)\b/.test(normalized) && controlOutputSignal;
  const voltageSignal =
    /\b(?:battery voltage|supply voltage|system voltage|ecu voltage|batteriespannung|bordspannung|aku voltaji|voltage|volt)\b/.test(normalized);

  if (/^(?:sample|sample number|sample no|index|row|record|frame)$/.test(normalized)) return "sample";
  if (voltageSignal || voltageUnit) return "voltage";
  if (!measurementDuration && /\b(?:timestamp|time stamp|elapsed time|elapsed|time|zeit|sure)\b/.test(normalized)) return "time";
  if (derivedOrCorrectionSignal) return "other";
  if (!target && !nonEngineRotationalSignal && (/\brpm\b|\bengine speed\b|\bmotor speed\b|\bmotor devri\b|\bmotordrehzahl\b|\bdrehzahl\b|\bregime moteur\b|\bn mot\b|\bdevir\b/.test(normalized) || /^(?:nmot|enginespeedrpm|enginerpm)$/.test(compact))) {
    return "rpm";
  }
  if (!railControlOutput && /\b(?:rail pressure|fuel rail|common rail|railpressure|rail press|kraftstoffdruck)\b/.test(normalized)) {
    return target ? "rail_target" : "rail_actual";
  }
  if (!boostControlOutput && /\b(?:boost|charge pressure|manifold pressure|manifold absolute pressure|map pressure|turbo pressure|ladedruck|turbo basinci)\b/.test(normalized)) {
    return target ? "boost_target" : "boost_actual";
  }
  if (!nonEngineTorqueSignal && /\b(?:engine torque|motor torque|actual torque|calculated torque|torque|drehmoment|couple moteur|motor torku|tork|moment)\b/.test(normalized)) {
    return target || /\b(?:limit|limiter|maximum allowed|driver wish)\b/.test(normalized)
      ? "torque_target"
      : "torque";
  }
  if (/\b(?:exhaust gas recirculation|abgasruckfuhrung|egr valve|egr position|egr stellung|egr duty|egr|agr valve|agr ventil|agr position|agr stellung)\b/.test(normalized)) {
    return target ? "egr_target" : "egr_actual";
  }
  if (target) return "other";
  if (/\blambda\b|\bo2 equivalence\b|\bequivalence ratio\b/.test(normalized)) return "lambda";
  if (/\bafr\b|\bair fuel ratio\b/.test(normalized)) return "afr";
  if (/\b(?:accelerator pedal|accelerator position|pedal position|pedal)\b/.test(normalized)) return "pedal";
  if (/\b(?:throttle valve|throttle position|throttle angle|throttle)\b/.test(normalized)) return "throttle";
  if (/\b(?:intake air temp|intake air temperature|intake temperature|charge air temp|charge air temperature|inlet air temp|inlet air temperature|ansauglufttemperatur|emme havasi sicakligi|iat)\b/.test(normalized)) return "iat";
  if (/\b(?:coolant temp|coolant temperature|engine coolant|kuhlmitteltemperatur|sogutma suyu sicakligi|ect)\b/.test(normalized)) return "coolant";
  if (/\b(?:exhaust gas temp|exhaust temperature|exhaust temp|abgastemperatur|egzoz gaz sicakligi|egt)\b|\begt\d+\b|\begts\d+\b/.test(normalized)) return "egt";
  if (/\b(?:dpf differential pressure|dpf pressure|particulate filter differential pressure|particulate filter pressure|exhaust differential pressure|partikelfilter differenzdruck|differenzdruck partikelfilter)\b/.test(normalized)) return "dpf_pressure";
  if (/\b(?:engine oil temp|engine oil temperature|oil temp|oil temperature|oltemperatur|motor yag sicakligi)\b/.test(normalized)) return "oil_temperature";
  if (/\b(?:injection quantity|injected quantity|fuel quantity|injection amount|injected amount|einspritzmenge|kraftstoffmenge|yakit miktari|iq)\b/.test(normalized) || /(?:mg|mm3)\s*\/\s*(?:stroke|str|hub)/.test(normalized)) return "fuel_quantity";
  if (/\b(?:mass air flow|air mass flow|air mass|airflow|luftmasse|luftmassenstrom|hava kutlesi|maf)\b/.test(normalized)) return "airflow";
  if (/\b(?:vehicle speed|road speed|wheel speed|fahrzeuggeschwindigkeit|arac hizi|kmh|kph|mph)\b/.test(normalized)) return "speed";
  if (/\b(?:ignition timing|ignition angle|spark timing|spark advance|ignition advance|zundwinkel|zundzeitpunkt|atesleme avansi|ignition)\b/.test(normalized)) return "ignition";
  if (/\b(?:battery voltage|supply voltage|system voltage|ecu voltage|batteriespannung|bordspannung|aku voltaji|voltage)\b/.test(normalized)) return "voltage";

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
  const bestChannel = (kind: "rpm" | "time" | "sample") =>
    channels
      .filter(
        (channel) =>
          channel.kind === kind &&
          (kind !== "rpm" || channel.unit.dimension === "engine_speed")
      )
      .map((channel) => ({
        channel,
        values: rows.flatMap((row) => {
          const value = row.values[channel.id];
          return value !== null && analyzableSummaryValue(channel, value) ? [value] : [];
        }),
      }))
      .filter(
        (candidate) =>
          candidate.values.length > 0 && new Set(candidate.values).size > 1
      )
      .sort((left, right) => right.values.length - left.values.length)[0];
  const time = bestChannel("time");
  const rpm = bestChannel("rpm");
  const sample = bestChannel("sample");
  const timeCoverage = time ? time.values.length / Math.max(1, rows.length) : 0;
  const timeValues = time?.values ?? [];
  const timeMonotonic = timeValues.every(
    (value, index) => index === 0 || value >= timeValues[index - 1]
  );
  const preferredTime = timeCoverage >= 0.8 && timeMonotonic;
  const selected = time && preferredTime
    ? { channel: time.channel, kind: "time" as const }
    : rpm
      ? { channel: rpm.channel, kind: "rpm" as const }
      : sample
        ? { channel: sample.channel, kind: "sample" as const }
        : null;

  if (selected) {
    return {
      channelId: selected.channel.id,
      kind: selected.kind,
      label: selected.channel.label,
      unit: selected.channel.unit,
      synthetic: false,
    };
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
  if (!axis.channelId) return row.rowNumber;
  const value = row.values[axis.channelId] ?? null;
  return value !== null && analyzableChannelValue(axis.kind, axis.unit, value)
    ? value
    : null;
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
      .filter((item): item is { row: LogStudioRow; value: number } =>
        item.value !== null && analyzableSummaryValue(channel, item.value)
      );

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
    const converted = (canonical - to.toCanonicalOffset) / to.toCanonicalFactor;
    return Number.isFinite(converted) ? converted : null;
  }

  if (
    from.symbol &&
    to.symbol &&
    normalizeUnitKey(from.symbol) === normalizeUnitKey(to.symbol)
  ) {
    return finiteWithinSummaryMagnitude(value) ? value : null;
  }

  return null;
}

function comparisonInsight(
  actual: LogStudioChannel,
  target: LogStudioChannel,
  rows: LogStudioRow[],
  axis: LogStudioAxis,
  family: "Boost pressure" | "Rail pressure" | "Engine torque" | "EGR signal"
): LogStudioInsight | null {
  if (!unitsComparable(actual.unit, target.unit)) return null;

  const gaps = rows.flatMap((row) => {
    const actualValue = row.values[actual.id];
    const targetValue = row.values[target.id];
    if (
      actualValue === null ||
      targetValue === null ||
      !analyzableSummaryValue(actual, actualValue) ||
      !analyzableSummaryValue(target, targetValue)
    ) return [];
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

const channelRetentionPriority: LogStudioChannelKind[] = [
  "rpm",
  "torque",
  "time",
  "sample",
  "egt",
  "egr_actual",
  "egr_target",
  "boost_actual",
  "boost_target",
  "rail_actual",
  "rail_target",
  "lambda",
  "afr",
  "throttle",
  "pedal",
  "iat",
  "coolant",
  "dpf_pressure",
  "oil_temperature",
  "fuel_quantity",
  "airflow",
  "speed",
  "ignition",
  "voltage",
  "torque_target",
  "other",
];

function retentionPriority(kind: LogStudioChannelKind) {
  const priority = channelRetentionPriority.indexOf(kind);
  return priority === -1 ? channelRetentionPriority.length : priority;
}

function channelIdentityKey(channel: LogStudioChannel) {
  const normalized = normalizeText(channel.header);
  const identities = [
    ...normalized.matchAll(/\b(bank|sensor|cylinder|cyl|probe|turbo|actuator)\s*([a-z]|\d+)\b/g),
    ...normalized.matchAll(/\bb(\d+)\s*s(\d+)\b/g),
  ].map((match) => match.slice(1).join(":"));
  return identities.length ? identities.sort().join("|") : null;
}

function pairActualTargetChannels(
  actuals: LogStudioChannel[],
  targets: LogStudioChannel[]
): Array<[LogStudioChannel, LogStudioChannel]> {
  if (
    actuals.length === 1 &&
    targets.length === 1 &&
    unitsComparable(actuals[0].unit, targets[0].unit)
  ) {
    const actualIdentity = channelIdentityKey(actuals[0]);
    const targetIdentity = channelIdentityKey(targets[0]);
    if (actualIdentity !== targetIdentity) {
      return [];
    }
    return [[actuals[0], targets[0]]] as Array<[LogStudioChannel, LogStudioChannel]>;
  }

  const usedTargets = new Set<string>();
  const actualIdentityCounts = actuals.reduce((counts, actual) => {
    const identity = channelIdentityKey(actual);
    if (identity) counts.set(identity, (counts.get(identity) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
  return actuals.flatMap<[LogStudioChannel, LogStudioChannel]>((actual) => {
    const identity = channelIdentityKey(actual);
    if (!identity || actualIdentityCounts.get(identity) !== 1) return [];
    const matches = targets.filter(
      (target) =>
        !usedTargets.has(target.id) &&
        channelIdentityKey(target) === identity &&
        unitsComparable(actual.unit, target.unit)
    );
    if (matches.length !== 1) return [];
    usedTargets.add(matches[0].id);
    return [[actual, matches[0]]];
  });
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

  const rpm = channelSummaryByKind(summaries, "rpm").find(
    (summary) => summary.unit.dimension === "engine_speed"
  );
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

  const torque = channelSummaryByKind(summaries, "torque").find(
    (summary) => summary.unit.dimension === "torque"
  );
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
    if (!boost.peak || boost.unit.dimension !== "pressure") continue;
    insights.push({
      id: `${boost.channelId}-peak`,
      kind: "boost_peak",
      severity: "info",
      title: "Highest logged pressure value",
      text: `${boost.label} reached ${formatNumber(boost.peak.value)}${summaryUnit(boost)} at ${boost.peak.xLabel}. This is reported only because a recognized boost or manifold-pressure channel exists in the source log and is not a boost target, gauge-pressure conversion or component-limit judgment.`,
      channelIds: [boost.channelId],
    });
  }

  for (const egr of channelSummaryByKind(summaries, "egr_actual")) {
    if (!egr.min || !egr.max) continue;
    const span = Math.abs(egr.max.value - egr.min.value);
    const movementThreshold = egr.unit.symbol === "%"
      ? 0.5
      : Math.max(0.01, Math.max(Math.abs(egr.min.value), Math.abs(egr.max.value)) * 0.005);
    const movementObserved = span > movementThreshold;
    insights.push({
      id: `${egr.channelId}-activity`,
      kind: "egr_activity",
      severity: movementObserved ? "info" : "caution",
      title: movementObserved
        ? "EGR signal movement observed"
        : "No EGR signal movement observed in this window",
      text: `${egr.label} ranged from ${formatNumber(egr.min.value)} to ${formatNumber(egr.max.value)}${summaryUnit(egr)}. ${movementObserved ? "Numeric movement is present in the captured signal." : "The retained values stayed effectively constant."} This observation does not confirm EGR function, health, disable state or commanded response.`,
      channelIds: [egr.channelId],
    });
  }

  const actualTargetFamilies: Array<{
    actualKind: "boost_actual" | "rail_actual" | "torque" | "egr_actual";
    targetKind: "boost_target" | "rail_target" | "torque_target" | "egr_target";
    title: "Boost pressure" | "Rail pressure" | "Engine torque" | "EGR signal";
  }> = [
    { actualKind: "boost_actual", targetKind: "boost_target", title: "Boost pressure" },
    { actualKind: "rail_actual", targetKind: "rail_target", title: "Rail pressure" },
    { actualKind: "torque", targetKind: "torque_target", title: "Engine torque" },
    { actualKind: "egr_actual", targetKind: "egr_target", title: "EGR signal" },
  ];

  for (const family of actualTargetFamilies) {
    const pressureFamily = family.actualKind === "boost_actual" || family.actualKind === "rail_actual";
    const actuals = channels.filter(
      (channel) => channel.kind === family.actualKind && (!pressureFamily || channel.unit.dimension === "pressure")
    );
    const targets = channels.filter(
      (channel) => channel.kind === family.targetKind && (!pressureFamily || channel.unit.dimension === "pressure")
    );
    for (const [actual, target] of pairActualTargetChannels(actuals, targets)) {
      const insight = comparisonInsight(actual, target, rows, axis, family.title);
      if (insight) {
        insights.push(insight);
      }
    }
  }

  const rangeTitles: Partial<Record<LogStudioChannelKind, string>> = {
    torque_target: "Requested torque range",
    lambda: "Lambda range",
    afr: "Air-fuel ratio range",
    throttle: "Throttle range",
    pedal: "Pedal range",
    iat: "Intake-air temperature range",
    coolant: "Coolant temperature range",
    egt: "Exhaust-gas temperature range",
    egr_actual: "EGR actual-signal range",
    egr_target: "EGR requested-signal range",
    dpf_pressure: "DPF pressure range",
    oil_temperature: "Oil-temperature range",
    rail_actual: "Rail-pressure range",
    fuel_quantity: "Fuel-quantity range",
    airflow: "Airflow range",
    speed: "Vehicle-speed range",
    ignition: "Ignition-channel range",
    voltage: "Voltage range",
  };

  for (const summary of summaries) {
    const title = rangeTitles[summary.kind];
    if (!title) continue;
    if (
      ((summary.kind === "rail_actual" || summary.kind === "dpf_pressure") &&
        summary.unit.dimension !== "pressure") ||
      (summary.kind === "egt" && summary.unit.dimension !== "temperature")
    ) continue;
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
  const hasDimension = (
    kinds: LogStudioChannelKind[],
    dimension: LogStudioUnitDimension
  ) => channels.some(
    (channel) => kinds.includes(channel.kind) && channel.unit.dimension === dimension
  );
  const missing: string[] = [];

  if (!hasDimension(["rpm"], "engine_speed")) missing.push("Engine speed (RPM)");
  if (!hasDimension(["torque"], "torque")) missing.push("Engine torque with a known unit");
  if (!hasDimension(["boost_actual"], "pressure")) missing.push("Boost pressure actual");
  if (!hasDimension(["boost_target"], "pressure")) missing.push("Boost pressure target");
  if (!has("lambda", "afr")) missing.push("Lambda or AFR");
  if (!has("throttle", "pedal")) missing.push("Throttle or pedal position");
  if (!hasDimension(["iat"], "temperature")) missing.push("Intake-air temperature");
  if (!hasDimension(["coolant"], "temperature")) missing.push("Coolant temperature");
  if (!hasDimension(["egt"], "temperature")) missing.push("Exhaust-gas temperature");
  if (!has("egr_actual", "egr_target")) missing.push("EGR actual or requested signal");
  if (!hasDimension(["rail_actual"], "pressure")) missing.push("Rail pressure actual");
  if (!hasDimension(["rail_target"], "pressure")) missing.push("Rail pressure target");
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
    actual: "boost_actual" | "rail_actual" | "torque" | "egr_actual";
    target: "boost_target" | "rail_target" | "torque_target" | "egr_target";
    label: string;
  }> = [
    { actual: "boost_actual", target: "boost_target", label: "Boost pressure" },
    { actual: "rail_actual", target: "rail_target", label: "Rail pressure" },
    { actual: "torque", target: "torque_target", label: "Engine torque" },
    { actual: "egr_actual", target: "egr_target", label: "EGR signal" },
  ];

  for (const pair of pairs) {
    const actuals = channels.filter((channel) => channel.kind === pair.actual);
    const targets = channels.filter((channel) => channel.kind === pair.target);
    if (!actuals.length || !targets.length) continue;
    if (!actuals.some((actual) => targets.some((target) => unitsComparable(actual.unit, target.unit)))) {
      warnings.push(`${pair.label} actual and target channels use missing, incompatible or differently referenced units, so no gap was calculated.`);
    } else if (!pairActualTargetChannels(actuals, targets).length) {
      warnings.push(`${pair.label} actual and target channels have ambiguous or mismatched sensor identities, so no gap was calculated.`);
    }
  }

  return warnings;
}

export function analyzeLogStudio(
  input: string,
  options: { profile?: LogStudioAnalysisProfile } = {}
): LogStudioAnalysis {
  if (!input.trim()) {
    return emptyAnalysis("empty", ["Select a delimited log or paste numeric log rows to begin."]);
  }

  const charactersTruncated = input.length > maxLogStudioCharacters;
  let bounded = input.slice(0, maxLogStudioCharacters).replace(/^\uFEFF/, "");

  if (charactersTruncated) {
    const lastCompleteLine = Math.max(bounded.lastIndexOf("\n"), bounded.lastIndexOf("\r"));
    if (lastCompleteLine > 0) bounded = bounded.slice(0, lastCompleteLine);
  }

  let lines = bounded
    .split(/\r?\n|\r/)
    .filter((line) => Boolean(line.trim()));
  let tableStart = findTableStart(lines);
  if (!tableStart) {
    const whitespaceStart = findHeaderlessWhitespaceTableStart(lines);
    if (whitespaceStart !== null) {
      lines = lines.map((line, index) =>
        index < whitespaceStart ? line : splitWhitespaceFields(line).join("\t")
      );
      tableStart = { lineIndex: whitespaceStart, delimiter: "\t", score: 0 };
    }
  }
  const delimiter = tableStart?.delimiter ?? null;

  if (!delimiter || !tableStart) {
    const result = emptyAnalysis("invalid", ["A comma, semicolon or tab-delimited numeric table could not be detected."]);
    result.truncated.characters = charactersTruncated;
    return result;
  }

  const tableLines = lines.slice(tableStart.lineIndex);
  const firstCells = splitDelimitedLine(tableLines[0] ?? "", delimiter);
  const firstNumeric = firstCells.map((value, index) =>
    parseChannelNumericCell(value, index === 0 ? "rpm" : "torque")
  );
  const headerlessRpmTorque =
    firstCells.length === 2 &&
    firstNumeric.every((value) => value !== null) &&
    (firstNumeric[0] ?? 0) >= 100 &&
    (firstNumeric[1] ?? 0) > 0;
  let headers = headerlessRpmTorque
    ? ["Engine Speed (rpm)", "Engine Torque"]
    : firstCells;
  let dataLines = headerlessRpmTorque ? tableLines : tableLines.slice(1);
  const unitsRow = headerlessRpmTorque
    ? { headers, dataLines, detected: false }
    : mergeSeparateUnitRow(headers, dataLines, delimiter);
  headers = unitsRow.headers;
  dataLines = unitsRow.dataLines;
  const sourceRowCount = dataLines.length;
  const candidateColumnCount = Math.min(headers.length, maxCandidateColumns);
  const allCandidateHeaders = headers.slice(0, candidateColumnCount);
  const allCandidateKinds = allCandidateHeaders.map(channelKindFromHeader);
  const includedColumnIndexes = allCandidateHeaders.flatMap((_, index) =>
    options.profile === "performance" &&
    allCandidateKinds[index] !== "rpm" &&
    allCandidateKinds[index] !== "torque"
      ? []
      : [index]
  );
  const rowsWithinCellBudget = Math.max(
    1,
    Math.floor(maxLogStudioCells / Math.max(1, includedColumnIndexes.length))
  );
  const profileRowLimit = options.profile === "performance"
    ? maxLogStudioRows
    : maxLogStudioFullRows;
  const processedRowLimit = Math.min(profileRowLimit, rowsWithinCellBudget);
  const rowsTruncated = sourceRowCount > processedRowLimit;
  const cellBudgetTruncated =
    rowsTruncated && processedRowLimit === rowsWithinCellBudget && rowsWithinCellBudget < profileRowLimit;
  const processedLines = dataLines.slice(0, processedRowLimit);

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

  const candidateHeaders = includedColumnIndexes.map((index) => allCandidateHeaders[index]);
  const candidateKinds = includedColumnIndexes.map((index) => allCandidateKinds[index]);
  const parsedRows = processedLines.map((line) => {
    const values = splitDelimitedLine(line, delimiter).slice(0, candidateColumnCount);
    return includedColumnIndexes.map((sourceIndex, index) =>
      parseChannelNumericCell(values[sourceIndex], candidateKinds[index] ?? "other")
    );
  });
  const candidates = candidateHeaders
    .map<CandidateChannel>((rawHeader, index) => {
      const sourceIndex = includedColumnIndexes[index];
      const header = rawHeader.trim() || `Channel ${sourceIndex + 1}`;
      const kind = candidateKinds[index] ?? "other";
      const values = parsedRows.map((row) => row[index] ?? null);
      return {
        index: sourceIndex,
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
    candidate.numericValueCount >= minimumOtherValues
  );
  const eligible = [...recognized, ...otherNumeric];
  const selectedCandidates = eligible
    .sort(
      (left, right) =>
        retentionPriority(left.kind) - retentionPriority(right.kind) ||
        left.index - right.index
    )
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
  const excludedSummaryValueCount = rows.reduce(
    (total, row) => total + channels.filter((channel) => {
      const value = row.values[channel.id];
      return value !== null && !analyzableSummaryValue(channel, value);
    }).length,
    0
  );

  if (headerlessRpmTorque) {
    warnings.push("No header was present; the two numeric columns were treated as RPM and torque rows, but the torque unit remains unknown and no power is calculated.");
  }
  if (tableStart.lineIndex > 0) {
    warnings.push(`${tableStart.lineIndex} preamble line${tableStart.lineIndex === 1 ? " was" : "s were"} skipped before the detected data table.`);
  }
  if (unitsRow.detected) {
    warnings.push("A separate units row was detected and merged with the channel headers.");
  }
  if (charactersTruncated) {
    warnings.push(`Only the first ${maxLogStudioCharacters.toLocaleString("en-US")} characters were inspected.`);
  }
  if (excludedSummaryValueCount > 0) {
    warnings.push(`${excludedSummaryValueCount} numeric cell${excludedSummaryValueCount === 1 ? "" : "s"} fell outside conservative local analysis bounds. The raw values remain visible in the row inspector but were excluded from summaries, comparisons and calculated highlights.`);
  }
  if (rowsTruncated) {
    warnings.push(
      cellBudgetTruncated
        ? `Only the first ${processedRowLimit.toLocaleString("en-US")} data rows were inspected to stay within the ${maxLogStudioCells.toLocaleString("en-US")}-cell local processing budget.`
        : options.profile === "performance"
          ? `Only the first ${maxLogStudioRows.toLocaleString("en-US")} data rows were inspected.`
          : `Only the first ${maxLogStudioFullRows.toLocaleString("en-US")} data rows were retained for the detailed mobile-safe analysis workspace.`
    );
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

export type LogStudioPerformanceRow = {
  rowNumber: number;
  rpm: number;
  torqueNm: number;
};

export type LogStudioPerformanceChannels = {
  rpm: LogStudioChannel;
  torque: LogStudioChannel;
};

function performanceRpmScore(channel: LogStudioChannel) {
  const normalized = normalizeText(channel.header);
  if (/\b(?:engine speed|engine rpm|motor speed|motor devri|motordrehzahl|drehzahl|regime moteur|n mot|crankshaft|crank shaft)\b/.test(normalized)) {
    return 5;
  }
  return /^(?:rpm|rpm rpm)$/.test(normalized) ? 2 : 1;
}

function performanceTorqueScore(channel: LogStudioChannel) {
  const normalized = normalizeText(channel.header);
  let score = 1;
  if (/\b(?:engine torque|motor torque|couple moteur|motor torku|drehmoment|crankshaft torque|crank shaft torque)\b/.test(normalized)) {
    score += 4;
  }
  if (/\b(?:actual|measured|calculated|ist)\b/.test(normalized)) {
    score += 2;
  }
  return score;
}

function selectUnambiguousPerformanceChannel(
  candidates: LogStudioChannel[],
  score: (channel: LogStudioChannel) => number
) {
  const ranked = candidates
    .map((channel) => ({ channel, score: score(channel) }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.channel.coveragePercent - left.channel.coveragePercent ||
        left.channel.index - right.channel.index
    );
  const best = ranked[0];
  const runnerUp = ranked[1];
  if (!best) return null;
  if (runnerUp && runnerUp.score === best.score) {
    return null;
  }
  return best.channel;
}

export function selectLogStudioPerformanceChannels(
  analysis: LogStudioAnalysis
): LogStudioPerformanceChannels | null {
  const rpm = selectUnambiguousPerformanceChannel(
    analysis.channels.filter(
      (channel) =>
        channel.kind === "rpm" &&
        channel.unit.canonicalSymbol === "rpm" &&
        channel.unit.toCanonicalFactor !== null
    ),
    performanceRpmScore
  );
  const torque = selectUnambiguousPerformanceChannel(
    analysis.channels.filter(
      (channel) =>
        channel.kind === "torque" &&
        channel.unit.canonicalSymbol === "Nm" &&
        channel.unit.toCanonicalFactor !== null
    ),
    performanceTorqueScore
  );

  return rpm && torque ? { rpm, torque } : null;
}

export function extractLogStudioPerformanceRows(
  analysis: LogStudioAnalysis
): LogStudioPerformanceRow[] {
  const selection = selectLogStudioPerformanceChannels(analysis);
  if (!selection) return [];
  const { rpm, torque } = selection;

  return analysis.rows.flatMap((row) => {
    const rpmRaw = row.values[rpm.id];
    const torqueRaw = row.values[torque.id];
    if (rpmRaw === null || torqueRaw === null) return [];
    const rpmValue = rpmRaw * rpm.unit.toCanonicalFactor! + (rpm.unit.toCanonicalOffset ?? 0);
    const torqueValue = torqueRaw * torque.unit.toCanonicalFactor! + (torque.unit.toCanonicalOffset ?? 0);
    if (
      !Number.isFinite(rpmValue) ||
      !Number.isFinite(torqueValue) ||
      rpmValue < 100 ||
      rpmValue > 30_000 ||
      torqueValue <= 0 ||
      torqueValue > maxCalculatedEngineTorqueNm
    ) {
      return [];
    }
    return [{ rowNumber: row.rowNumber, rpm: rpmValue, torqueNm: torqueValue }];
  });
}
