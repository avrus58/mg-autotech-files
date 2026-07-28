export type PerformanceLogPoint = {
  rpm: number;
  torque: number;
  kw: number;
  hp: number;
};

export type PerformanceLogFormat =
  | "autotuner_csv"
  | "rpm_torque_rows"
  | "unknown";

export type ParsedPerformanceLog = {
  points: PerformanceLogPoint[];
  format: PerformanceLogFormat;
  sourceRowCount: number;
  rejectedRowCount: number;
};

export type PerformanceLogQuality = "strong" | "usable" | "limited";

export type PerformanceLogAnalysis = {
  sortedPoints: PerformanceLogPoint[];
  peakTorque: PerformanceLogPoint | null;
  peakPower: PerformanceLogPoint | null;
  averageTorque: number;
  averagePower: number;
  minRpm: number;
  maxRpm: number;
  rpmSpan: number;
  torqueRetentionPercent: number;
  duplicateRpmCount: number;
  monotonicRpm: boolean;
  qualityScore: number;
  quality: PerformanceLogQuality;
  warnings: string[];
};

export function calculatePowerFromTorque(torqueNm: number, rpm: number) {
  const kw = (torqueNm * rpm) / 9549;
  const hp = kw * 1.34102;

  return { kw, hp };
}

function splitDelimitedLine(line: string, delimiter: string) {
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

function countDelimiter(line: string, delimiter: string) {
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

function detectDelimiter(line: string) {
  const candidates = [",", ";", "\t"];
  return candidates.reduce((best, candidate) =>
    countDelimiter(line, candidate) > countDelimiter(line, best)
      ? candidate
      : best
  );
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseNumber(value: string | undefined) {
  if (!value) return Number.NaN;
  return Number(value.trim().replace(/\s/g, "").replace(",", "."));
}

function toPerformancePoint(rpm: number, torque: number) {
  if (
    !Number.isFinite(rpm) ||
    !Number.isFinite(torque) ||
    rpm <= 0 ||
    torque <= 0
  ) {
    return null;
  }

  const power = calculatePowerFromTorque(torque, rpm);
  return { rpm, torque, kw: power.kw, hp: power.hp };
}

export function parsePerformanceLog(input: string): ParsedPerformanceLog {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return {
      points: [],
      format: "unknown",
      sourceRowCount: 0,
      rejectedRowCount: 0,
    };
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitDelimitedLine(lines[0], delimiter).map(normalizeHeader);
  const rpmIndex = headers.findIndex(
    (header) => header.includes("enginespeedrpm") || header === "rpm"
  );
  const torqueIndex = headers.findIndex(
    (header) => header.includes("enginetorquenm") || header === "torquenm"
  );

  if (rpmIndex !== -1 && torqueIndex !== -1) {
    const rows = lines.slice(1);
    const points = rows
      .map((line) => {
        const values = splitDelimitedLine(line, delimiter);
        return toPerformancePoint(
          parseNumber(values[rpmIndex]),
          parseNumber(values[torqueIndex])
        );
      })
      .filter((point): point is PerformanceLogPoint => Boolean(point));

    return {
      points,
      format: "autotuner_csv",
      sourceRowCount: rows.length,
      rejectedRowCount: rows.length - points.length,
    };
  }

  const points = lines
    .map((line) => {
      const [rpmValue, torqueValue] = line
        .split(/[,;\t ]+/)
        .map((value) => parseNumber(value));
      return toPerformancePoint(rpmValue, torqueValue);
    })
    .filter((point): point is PerformanceLogPoint => Boolean(point));

  return {
    points,
    format: points.length ? "rpm_torque_rows" : "unknown",
    sourceRowCount: lines.length,
    rejectedRowCount: lines.length - points.length,
  };
}

export function analyzePerformanceLog(
  parsed: ParsedPerformanceLog
): PerformanceLogAnalysis {
  const sortedPoints = [...parsed.points].sort((left, right) => left.rpm - right.rpm);
  const peakTorque = parsed.points.reduce<PerformanceLogPoint | null>(
    (best, point) => (!best || point.torque > best.torque ? point : best),
    null
  );
  const peakPower = parsed.points.reduce<PerformanceLogPoint | null>(
    (best, point) => (!best || point.hp > best.hp ? point : best),
    null
  );
  const averageTorque = parsed.points.length
    ? parsed.points.reduce((total, point) => total + point.torque, 0) /
      parsed.points.length
    : 0;
  const averagePower = parsed.points.length
    ? parsed.points.reduce((total, point) => total + point.hp, 0) /
      parsed.points.length
    : 0;
  const minRpm = sortedPoints[0]?.rpm ?? 0;
  const maxRpm = sortedPoints.at(-1)?.rpm ?? 0;
  const rpmSpan = Math.max(0, maxRpm - minRpm);
  const finalTorque = sortedPoints.at(-1)?.torque ?? 0;
  const torqueRetentionPercent = peakTorque
    ? (finalTorque / peakTorque.torque) * 100
    : 0;
  const duplicateRpmCount = Math.max(
    0,
    parsed.points.length - new Set(parsed.points.map((point) => point.rpm)).size
  );
  const monotonicRpm = parsed.points.every(
    (point, index) => index === 0 || point.rpm >= parsed.points[index - 1].rpm
  );
  const warnings: string[] = [];
  let qualityScore = parsed.points.length ? 100 : 0;

  if (parsed.points.length > 0 && parsed.points.length < 5) {
    qualityScore -= 30;
    warnings.push("Fewer than five valid rows limit curve confidence.");
  }
  if (parsed.points.length > 0 && rpmSpan < 1000) {
    qualityScore -= 20;
    warnings.push("RPM coverage is too narrow for a representative curve.");
  }
  if (parsed.rejectedRowCount > 0) {
    qualityScore -= Math.min(20, parsed.rejectedRowCount * 5);
    warnings.push(`${parsed.rejectedRowCount} source row${parsed.rejectedRowCount === 1 ? " was" : "s were"} rejected.`);
  }
  if (!monotonicRpm) {
    qualityScore -= 10;
    warnings.push("RPM values were not ordered and were sorted for the chart.");
  }
  if (duplicateRpmCount > 0) {
    qualityScore -= Math.min(15, duplicateRpmCount * 5);
    warnings.push(`${duplicateRpmCount} duplicate RPM row${duplicateRpmCount === 1 ? " was" : "s were"} detected.`);
  }

  qualityScore = Math.max(0, Math.min(100, qualityScore));
  const quality: PerformanceLogQuality =
    qualityScore >= 85 ? "strong" : qualityScore >= 65 ? "usable" : "limited";

  return {
    sortedPoints,
    peakTorque,
    peakPower,
    averageTorque,
    averagePower,
    minRpm,
    maxRpm,
    rpmSpan,
    torqueRetentionPercent,
    duplicateRpmCount,
    monotonicRpm,
    qualityScore,
    quality,
    warnings,
  };
}

function escapeSvgText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function safeSourceName(fileName: string) {
  return (fileName.split(/[\\/]/).at(-1) || "Pasted RPM / torque rows")
    .replace(/[\u0000-\u001f]/g, "")
    .slice(0, 90);
}

function buildReportId(fileName: string, points: PerformanceLogPoint[]) {
  const source = `${safeSourceName(fileName)}|${points
    .map((point) => `${point.rpm}:${point.torque}`)
    .join("|")}`;
  let hash = 2166136261;

  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `MGA-LOG-${(hash >>> 0).toString(16).toUpperCase().padStart(8, "0")}`;
}

function representativePoints(points: PerformanceLogPoint[], limit = 6) {
  if (points.length <= limit) return points;

  const indexes = Array.from({ length: limit }, (_, index) =>
    Math.round((index * (points.length - 1)) / (limit - 1))
  );
  return indexes.map((index) => points[index]);
}

export function buildPerformanceReportSvg({
  fileName,
  parsed,
  analysis,
  generatedAt = new Date(),
}: {
  fileName: string;
  parsed: ParsedPerformanceLog;
  analysis: PerformanceLogAnalysis;
  generatedAt?: Date;
}) {
  if (!analysis.sortedPoints.length) {
    throw new Error("A performance report requires at least one valid log row.");
  }

  const width = 1200;
  const height = 1180;
  const chart = { x: 82, y: 354, width: 1036, height: 354 };
  const maxHp = Math.max(...analysis.sortedPoints.map((point) => point.hp), 1);
  const maxNm = Math.max(...analysis.sortedPoints.map((point) => point.torque), 1);
  const maxScale = Math.ceil(Math.max(maxHp, maxNm) / 50) * 50;
  const xFor = (rpmValue: number) =>
    chart.x +
    ((rpmValue - analysis.minRpm) /
      Math.max(1, analysis.maxRpm - analysis.minRpm)) *
      chart.width;
  const yFor = (value: number) =>
    chart.y + chart.height - (value / maxScale) * chart.height;
  const torquePolyline = analysis.sortedPoints
    .map((point) => `${xFor(point.rpm).toFixed(1)},${yFor(point.torque).toFixed(1)}`)
    .join(" ");
  const hpPolyline = analysis.sortedPoints
    .map((point) => `${xFor(point.rpm).toFixed(1)},${yFor(point.hp).toFixed(1)}`)
    .join(" ");
  const gridLines = [0, 0.25, 0.5, 0.75, 1]
    .map((ratio) => {
      const y = chart.y + chart.height * ratio;
      const label = Math.round(maxScale * (1 - ratio));
      return `<line x1="${chart.x}" y1="${y}" x2="${chart.x + chart.width}" y2="${y}" stroke="#27272a" stroke-width="1"/><text x="${chart.x - 16}" y="${y + 5}" text-anchor="end" fill="#71717a" font-size="15">${label}</text>`;
    })
    .join("");
  const rpmLabels = [0, 0.25, 0.5, 0.75, 1]
    .map((ratio) => {
      const rpmValue = analysis.minRpm + analysis.rpmSpan * ratio;
      const x = chart.x + chart.width * ratio;
      return `<text x="${x}" y="${chart.y + chart.height + 34}" text-anchor="middle" fill="#a1a1aa" font-size="15">${Math.round(rpmValue)}</text>`;
    })
    .join("");
  const peakPower = analysis.peakPower;
  const peakTorque = analysis.peakTorque;
  const peakPs = peakPower ? peakPower.kw * 1.35962 : 0;
  const sourceName = safeSourceName(fileName);
  const sourceLabel =
    sourceName.length > 52 ? `${sourceName.slice(0, 49)}...` : sourceName;
  const reportId = buildReportId(fileName, analysis.sortedPoints);
  const generatedLabel = generatedAt.toISOString().replace("T", " ").slice(0, 19) + " UTC";
  const sampleRows = representativePoints(analysis.sortedPoints)
    .map((point, index) => {
      const y = 961 + index * 30;
      return `<rect x="82" y="${y - 20}" width="1036" height="30" fill="${index % 2 === 0 ? "#111113" : "#0b0b0d"}"/><text x="110" y="${y}" fill="#e4e4e7" font-size="15">${point.rpm.toFixed(0)}</text><text x="360" y="${y}" fill="#7dd3fc" font-size="15">${point.torque.toFixed(1)}</text><text x="610" y="${y}" fill="#fda4af" font-size="15">${point.kw.toFixed(1)}</text><text x="860" y="${y}" fill="#ffffff" font-size="15">${point.hp.toFixed(1)}</text>`;
    })
    .join("");
  const qualityLabel =
    analysis.quality === "strong"
      ? "STRONG LOG"
      : analysis.quality === "usable"
        ? "USABLE / REVIEW"
        : "LIMITED DATA";
  const warningSummary = analysis.warnings[0] || "No structural log warnings detected.";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#050505"/>
  <rect x="32" y="32" width="1136" height="1116" rx="28" fill="#09090b" stroke="#27272a" stroke-width="2"/>
  <rect x="32" y="32" width="10" height="1116" rx="5" fill="#dc2626"/>

  <text x="82" y="84" fill="#ef4444" font-size="18" font-weight="900" letter-spacing="5">MG AUTOTECH</text>
  <text x="82" y="128" fill="#ffffff" font-size="38" font-weight="900">Performance Log Analysis</text>
  <text x="82" y="158" fill="#a1a1aa" font-size="16">Workshop report · torque-derived power estimate · local browser analysis</text>
  <rect x="890" y="65" width="228" height="82" rx="14" fill="#111113" stroke="#3f3f46"/>
  <text x="914" y="94" fill="#71717a" font-size="13" font-weight="700">REPORT ID</text>
  <text x="914" y="120" fill="#ffffff" font-size="17" font-weight="900">${reportId}</text>
  <text x="914" y="139" fill="#a1a1aa" font-size="11">${generatedLabel}</text>

  <rect x="82" y="188" width="1036" height="72" rx="14" fill="#0f0f12" stroke="#27272a"/>
  <text x="108" y="215" fill="#71717a" font-size="12" font-weight="700">SOURCE</text>
  <text x="108" y="240" fill="#ffffff" font-size="16" font-weight="800">${escapeSvgText(sourceLabel)}</text>
  <text x="470" y="215" fill="#71717a" font-size="12" font-weight="700">FORMAT</text>
  <text x="470" y="240" fill="#ffffff" font-size="16" font-weight="800">${parsed.format === "autotuner_csv" ? "AutoTuner CSV" : "RPM / torque rows"}</text>
  <text x="720" y="215" fill="#71717a" font-size="12" font-weight="700">DATA INTEGRITY</text>
  <text x="720" y="240" fill="#ffffff" font-size="16" font-weight="800">${parsed.points.length}/${parsed.sourceRowCount} valid rows</text>
  <rect x="945" y="207" width="145" height="32" rx="16" fill="${analysis.quality === "strong" ? "#052e2b" : analysis.quality === "usable" ? "#422006" : "#450a0a"}" stroke="${analysis.quality === "strong" ? "#047857" : analysis.quality === "usable" ? "#b45309" : "#b91c1c"}"/>
  <text x="1017" y="228" text-anchor="middle" fill="#ffffff" font-size="12" font-weight="900">${qualityLabel} ${analysis.qualityScore}</text>

  ${[
    ["PEAK TORQUE", peakTorque ? peakTorque.torque.toFixed(0) : "-", peakTorque ? `Nm @ ${peakTorque.rpm.toFixed(0)} rpm` : "Nm"],
    ["EST. PEAK POWER", peakPower ? peakPower.hp.toFixed(1) : "-", peakPower ? `HP @ ${peakPower.rpm.toFixed(0)} rpm` : "HP"],
    ["METRIC POWER", peakPower ? peakPs.toFixed(1) : "-", "PS"],
    ["RPM WINDOW", `${analysis.minRpm.toFixed(0)}–${analysis.maxRpm.toFixed(0)}`, `${analysis.rpmSpan.toFixed(0)} rpm span`],
  ].map(([label, value, unit], index) => {
    const x = 82 + index * 260;
    return `<rect x="${x}" y="282" width="244" height="50" rx="10" fill="#0f0f12" stroke="#27272a"/><text x="${x + 14}" y="301" fill="#71717a" font-size="10" font-weight="800">${label}</text><text x="${x + 14}" y="321" fill="#ffffff" font-size="19" font-weight="900">${value}</text><text x="${x + 230}" y="321" text-anchor="end" fill="#fca5a5" font-size="10" font-weight="700">${unit}</text>`;
  }).join("")}

  <rect x="${chart.x}" y="${chart.y}" width="${chart.width}" height="${chart.height}" rx="16" fill="#0b0b0d" stroke="#27272a" stroke-width="2"/>
  ${gridLines}
  ${rpmLabels}
  <text x="${chart.x}" y="${chart.y - 20}" fill="#71717a" font-size="12" font-weight="800">POWER / TORQUE</text>
  <text x="${chart.x + chart.width - 16}" y="${chart.y + chart.height - 16}" text-anchor="end" fill="#71717a" font-size="11" font-weight="800">ENGINE SPEED (RPM)</text>
  <rect x="885" y="${chart.y - 30}" width="12" height="12" rx="3" fill="#ef4444"/><text x="905" y="${chart.y - 19}" fill="#d4d4d8" font-size="13">Estimated HP</text>
  <rect x="1004" y="${chart.y - 30}" width="12" height="12" rx="3" fill="#38bdf8"/><text x="1024" y="${chart.y - 19}" fill="#d4d4d8" font-size="13">Torque Nm</text>
  <polyline points="${torquePolyline}" fill="none" stroke="#38bdf8" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  <polyline points="${hpPolyline}" fill="none" stroke="#ef4444" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  ${peakTorque ? `<circle cx="${xFor(peakTorque.rpm)}" cy="${yFor(peakTorque.torque)}" r="7" fill="#38bdf8" stroke="#e0f2fe" stroke-width="3"/>` : ""}
  ${peakPower ? `<circle cx="${xFor(peakPower.rpm)}" cy="${yFor(peakPower.hp)}" r="7" fill="#ef4444" stroke="#fee2e2" stroke-width="3"/>` : ""}

  <rect x="82" y="748" width="500" height="112" rx="14" fill="#0f0f12" stroke="#27272a"/>
  <text x="106" y="777" fill="#ef4444" font-size="12" font-weight="900" letter-spacing="2">CURVE SUMMARY</text>
  <text x="106" y="807" fill="#ffffff" font-size="15" font-weight="800">Peak torque ${peakTorque ? `${peakTorque.torque.toFixed(0)} Nm at ${peakTorque.rpm.toFixed(0)} rpm` : "not available"}</text>
  <text x="106" y="833" fill="#ffffff" font-size="15" font-weight="800">Peak power ${peakPower ? `${peakPower.hp.toFixed(1)} HP / ${peakPower.kw.toFixed(1)} kW` : "not available"}</text>
  <text x="106" y="851" fill="#a1a1aa" font-size="12">End-of-window torque retention: ${analysis.torqueRetentionPercent.toFixed(0)}%</text>

  <rect x="598" y="748" width="520" height="112" rx="14" fill="#0f0f12" stroke="#27272a"/>
  <text x="622" y="777" fill="#38bdf8" font-size="12" font-weight="900" letter-spacing="2">QUALITY &amp; METHOD</text>
  <text x="622" y="807" fill="#ffffff" font-size="15" font-weight="800">Score ${analysis.qualityScore}/100 · ${parsed.points.length} valid · ${parsed.rejectedRowCount} rejected</text>
  <text x="622" y="833" fill="#a1a1aa" font-size="12">${escapeSvgText(warningSummary)}</text>
  <text x="622" y="851" fill="#a1a1aa" font-size="12">Power formula: kW = Nm × RPM ÷ 9549</text>

  <text x="82" y="898" fill="#ffffff" font-size="19" font-weight="900">Representative log rows</text>
  <rect x="82" y="908" width="1036" height="30" fill="#18181b"/>
  <text x="110" y="928" fill="#a1a1aa" font-size="12" font-weight="800">RPM</text><text x="360" y="928" fill="#a1a1aa" font-size="12" font-weight="800">TORQUE (NM)</text><text x="610" y="928" fill="#a1a1aa" font-size="12" font-weight="800">POWER (KW)</text><text x="860" y="928" fill="#a1a1aa" font-size="12" font-weight="800">POWER (HP)</text>
  ${sampleRows}

  <line x1="82" y1="1122" x2="1118" y2="1122" stroke="#27272a"/>
  <text x="82" y="1145" fill="#71717a" font-size="11">LOG-BASED ESTIMATE · NOT A CHASSIS-DYNO CERTIFICATE · ECU-reported torque and logging quality affect the result.</text>
  <text x="1118" y="1145" text-anchor="end" fill="#ef4444" font-size="11" font-weight="900">MG AUTOTECH FILE SERVICE</text>
</svg>`;
}
