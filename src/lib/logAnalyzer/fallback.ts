import type {
  LogAnalyzerConfidence,
  LogAnalyzerConfidenceReason,
  LogAnalyzerEvidenceItem,
  LogAnalyzerInputRow,
  LogAnalyzerNormalizedInput,
  LogAnalyzerPeakPoint,
  LogAnalyzerProviderIdentity,
  LogAnalyzerReadiness,
  LogAnalyzerRecommendation,
  LogAnalyzerRequest,
  LogAnalyzerResponse,
  LogAnalyzerRiskFlag,
  LogAnalyzerSafeSummary,
  LogAnalyzerSourceFormat,
  LogAnalyzerVehicleContext,
} from "@/lib/logAnalyzer/types";

export const logAnalyzerContractVersion = "log-analyzer-v1" as const;
export const logAnalyzerPromptVersion = "log-analyzer-v1";
export const deterministicLogAnalyzerProviderId = "deterministic_rules" as const;
export const unconfiguredLogAnalyzerProviderId = "unconfigured_log_analyzer_provider";
export const maxLogAnalyzerRows = 2000;
export const maxLogAnalyzerTextLength = 120_000;

export const logAnalyzerBlockedProductionActions = [
  "live_provider_routing",
  "customer_ready_mod_export",
  "checksum_approval",
  "flash_safety_approval",
  "exact_gain_claim",
  "automatic_delivery",
  "production_log_storage",
] as const;

const safetyBoundaries = [
  "This is log summary guidance only and does not confirm a tune, diagnosis, repair path or legal suitability.",
  "Power is estimated from logged torque and RPM; it is not a calibrated chassis-dyno measurement.",
  "Human expert review is required before any calibration, checksum, flash-safety, delivery or customer file action.",
];

const commonMissingInformation = [
  "Vehicle brand, model, engine and ECU or TCU family",
  "Read method, software number and file identity",
  "Gear, load condition and whether the log is full-throttle, partial-load or diagnostic-only",
  "Requested versus actual boost, airflow, rail pressure and temperature channels where available",
  "Diagnostic fault status and hardware modification context",
];

type PreparedLogInput = {
  normalized: LogAnalyzerNormalizedInput;
  points: LogAnalyzerPeakPoint[];
};

function round(value: number, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function uniqueInOrder(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function uniqueById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function calculateLogPowerEstimate(torqueNm: number, rpm: number) {
  const kw = (torqueNm * rpm) / 9549;
  return {
    kw,
    hp: kw * 1.34102,
    ps: kw * 1.35962,
  };
}

function toPoint(row: LogAnalyzerInputRow): LogAnalyzerPeakPoint | null {
  const rpm = Number(row.rpm);
  const torqueNm = Number(row.torqueNm);
  if (!Number.isFinite(rpm) || !Number.isFinite(torqueNm) || rpm <= 0 || torqueNm <= 0) {
    return null;
  }

  const power = calculateLogPowerEstimate(torqueNm, rpm);
  return {
    rpm: round(rpm, 0),
    torqueNm: round(torqueNm, 1),
    kw: round(power.kw, 1),
    hp: round(power.hp, 1),
    ps: round(power.ps, 1),
  };
}

function parseNumber(value: string | undefined) {
  if (!value) return Number.NaN;
  return Number(value.trim().replace(",", "."));
}

function splitCsvLine(line: string) {
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

    if (char === "," && !quoted) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findHeaderIndex(headers: string[], options: string[]) {
  return headers.findIndex((header) => options.some((option) => header.includes(option)));
}

export function parseLogAnalyzerText(input: string): {
  rows: LogAnalyzerInputRow[];
  rejectedRowCount: number;
  sourceFormat: LogAnalyzerSourceFormat;
  wasTruncated: boolean;
} {
  const truncatedText = input.slice(0, maxLogAnalyzerTextLength);
  const lines = truncatedText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const wasTruncated = input.length > maxLogAnalyzerTextLength || lines.length > maxLogAnalyzerRows;

  if (!lines.length) {
    return { rows: [], rejectedRowCount: 0, sourceFormat: "empty", wasTruncated };
  }

  const headers = splitCsvLine(lines[0]).map(normalizeHeader);
  const rpmIndex = findHeaderIndex(headers, ["enginespeedrpm", "enginespeed", "rpm"]);
  const torqueIndex = findHeaderIndex(headers, ["enginetorquenm", "enginetorque", "torquenm"]);
  const looksLikeAutotunerCsv = rpmIndex !== -1 && torqueIndex !== -1 && lines.length > 1;
  const rows: LogAnalyzerInputRow[] = [];
  let rejectedRowCount = 0;

  if (looksLikeAutotunerCsv) {
    for (const line of lines.slice(1, maxLogAnalyzerRows + 1)) {
      const values = splitCsvLine(line);
      const rpm = parseNumber(values[rpmIndex]);
      const torqueNm = parseNumber(values[torqueIndex]);
      if (Number.isFinite(rpm) && Number.isFinite(torqueNm) && rpm > 0 && torqueNm > 0) {
        rows.push({ rpm, torqueNm });
      } else {
        rejectedRowCount += 1;
      }
    }

    return {
      rows,
      rejectedRowCount,
      sourceFormat: "autotuner_csv",
      wasTruncated,
    };
  }

  for (const line of lines.slice(0, maxLogAnalyzerRows)) {
    const [rpmValue, torqueValue] = line.split(/[,;\t ]+/);
    const rpm = parseNumber(rpmValue);
    const torqueNm = parseNumber(torqueValue);
    if (Number.isFinite(rpm) && Number.isFinite(torqueNm) && rpm > 0 && torqueNm > 0) {
      rows.push({ rpm, torqueNm });
    } else {
      rejectedRowCount += 1;
    }
  }

  return {
    rows,
    rejectedRowCount,
    sourceFormat: rows.length ? "text_rows" : "unsupported",
    wasTruncated,
  };
}

function prepareStructuredRows(rows: LogAnalyzerInputRow[]): PreparedLogInput {
  const limitedRows = rows.slice(0, maxLogAnalyzerRows);
  const points = limitedRows
    .map(toPoint)
    .filter((point): point is LogAnalyzerPeakPoint => Boolean(point));
  const rejectedRowCount = limitedRows.length - points.length;
  const invalidReason =
    points.length === 0
      ? "No valid RPM and torque rows were detected. Provide rows such as 2200, 390."
      : null;

  return {
    normalized: {
      hasLogData: points.length > 0,
      sourceFormat: rows.length ? "structured_rows" : "empty",
      wasTruncated: rows.length > maxLogAnalyzerRows,
      validRowCount: points.length,
      rejectedRowCount,
      invalidReason,
    },
    points,
  };
}

function prepareTextRows(text: string): PreparedLogInput {
  const parsed = parseLogAnalyzerText(text);
  const points = parsed.rows
    .map(toPoint)
    .filter((point): point is LogAnalyzerPeakPoint => Boolean(point));
  const invalidReason =
    text.trim().length === 0
      ? "Provide log rows with RPM and torque values."
      : points.length === 0
        ? "No valid RPM and torque rows were detected. Provide rows such as 2200, 390."
        : null;

  return {
    normalized: {
      hasLogData: points.length > 0,
      sourceFormat: parsed.sourceFormat,
      wasTruncated: parsed.wasTruncated,
      validRowCount: points.length,
      rejectedRowCount: parsed.rejectedRowCount,
      invalidReason,
    },
    points,
  };
}

function prepareLogAnalyzerInput(request: LogAnalyzerRequest): PreparedLogInput {
  if (request.rows && request.rows.length > 0) {
    return prepareStructuredRows(request.rows);
  }

  const text = textValue(request.text);
  if (text) return prepareTextRows(text);

  return {
    normalized: {
      hasLogData: false,
      sourceFormat: "empty",
      wasTruncated: false,
      validRowCount: 0,
      rejectedRowCount: 0,
      invalidReason: "Provide log rows with RPM and torque values.",
    },
    points: [],
  };
}

export function normalizeLogAnalyzerInput(request: LogAnalyzerRequest): LogAnalyzerNormalizedInput {
  return prepareLogAnalyzerInput(request).normalized;
}

function emptyLogSummary(normalized: LogAnalyzerNormalizedInput): LogAnalyzerSafeSummary {
  return {
    validRowCount: normalized.validRowCount,
    rejectedRowCount: normalized.rejectedRowCount,
    rpmRange: null,
    torqueRangeNm: null,
    estimatedPowerRangeHp: null,
    averageTorqueNm: null,
    peakTorque: null,
    peakPower: null,
  };
}

function range(values: number[]) {
  if (values.length === 0) return null;
  return {
    min: round(Math.min(...values), 1),
    max: round(Math.max(...values), 1),
  };
}

function buildSafeLogSummary(points: LogAnalyzerPeakPoint[], normalized: LogAnalyzerNormalizedInput): LogAnalyzerSafeSummary {
  if (points.length === 0) return emptyLogSummary(normalized);

  const peakTorque = points.reduce((best, point) => (point.torqueNm > best.torqueNm ? point : best), points[0]);
  const peakPower = points.reduce((best, point) => (point.hp > best.hp ? point : best), points[0]);
  const averageTorqueNm = points.reduce((total, point) => total + point.torqueNm, 0) / points.length;

  return {
    validRowCount: normalized.validRowCount,
    rejectedRowCount: normalized.rejectedRowCount,
    rpmRange: range(points.map((point) => point.rpm)),
    torqueRangeNm: range(points.map((point) => point.torqueNm)),
    estimatedPowerRangeHp: range(points.map((point) => point.hp)),
    averageTorqueNm: round(averageTorqueNm, 1),
    peakTorque,
    peakPower,
  };
}

function deterministicProviderIdentity(): LogAnalyzerProviderIdentity {
  return {
    providerId: deterministicLogAnalyzerProviderId,
    providerKind: "deterministic_rules",
    providerStatus: "ready",
    modelName: null,
    promptVersion: logAnalyzerPromptVersion,
  };
}

export function unavailableLogAnalyzerProviderIdentity(reason: string): LogAnalyzerProviderIdentity {
  return {
    providerId: unconfiguredLogAnalyzerProviderId,
    providerKind: "unconfigured",
    providerStatus: "unavailable",
    modelName: null,
    promptVersion: null,
    unavailableReason: reason,
  };
}

export function erroredLogAnalyzerProviderIdentity(provider: {
  providerId: string;
  providerKind: LogAnalyzerProviderIdentity["providerKind"];
  modelName: string | null;
}): LogAnalyzerProviderIdentity {
  return {
    providerId: provider.providerId,
    providerKind: provider.providerKind,
    providerStatus: "error",
    modelName: provider.modelName,
    promptVersion: null,
    unavailableReason: "Configured Log Analyzer provider failed locally.",
  };
}

function providerStateEvidence(provider: LogAnalyzerProviderIdentity): LogAnalyzerEvidenceItem[] {
  if (provider.providerStatus === "ready" && provider.providerId === deterministicLogAnalyzerProviderId) {
    return [];
  }

  return [{
    id: `provider-${provider.providerStatus}`,
    source: "provider_state",
    type: "provider_availability",
    severity: provider.providerStatus === "error" ? "warning" : "caution",
    text:
      provider.providerStatus === "error"
        ? "The configured Log Analyzer provider failed locally; deterministic non-AI fallback was used."
        : "The Log Analyzer provider is unavailable; deterministic non-AI fallback is required for local guidance.",
    customerSafe: true,
  }];
}

function providerStateRiskFlags(provider: LogAnalyzerProviderIdentity): LogAnalyzerRiskFlag[] {
  if (provider.providerStatus === "ready" && provider.providerId === deterministicLogAnalyzerProviderId) {
    return [];
  }

  return [{
    id: `provider-${provider.providerStatus}-risk`,
    kind: "provider_unavailable",
    severity: provider.providerStatus === "error" ? "warning" : "caution",
    text: "Provider state prevents treating this output as AI-generated log analysis.",
    requiresHumanReview: true,
    customerSafe: true,
  }];
}

function providerUnavailableRecommendations(): LogAnalyzerRecommendation[] {
  return [{
    id: "provider-unavailable-fallback-notice",
    category: "fallback_notice",
    priority: "high",
    text: "Log Analyzer provider is unavailable. Use deterministic fallback or human expert review; do not present this as AI-generated analysis.",
    requiresHumanReview: true,
    customerSafe: true,
  }];
}

function invalidInputEvidence(normalized: LogAnalyzerNormalizedInput): LogAnalyzerEvidenceItem[] {
  return [{
    id: "invalid-log-input",
    source: "input_normalization",
    type: "input_validation",
    severity: "warning",
    text: normalized.invalidReason ?? "No valid RPM and torque rows were detected.",
    customerSafe: true,
  }];
}

function invalidInputRiskFlags(): LogAnalyzerRiskFlag[] {
  return [{
    id: "invalid-input",
    kind: "invalid_input",
    severity: "warning",
    text: "Log analysis cannot start until valid RPM and torque rows are available.",
    requiresHumanReview: true,
    customerSafe: true,
  }];
}

function invalidInputRecommendations(): LogAnalyzerRecommendation[] {
  return [
    {
      id: "invalid-input-log-rows",
      category: "missing_information",
      priority: "high",
      text: "Provide at least one valid RPM and torque row, for example 2200, 390.",
      requiresHumanReview: false,
      customerSafe: true,
    },
    {
      id: "invalid-input-human-review-gate",
      category: "human_review_gate",
      priority: "high",
      text: "Do not prepare customer file advice until valid log data is available.",
      requiresHumanReview: true,
      customerSafe: true,
    },
  ];
}

function logSummaryEvidence(summary: LogAnalyzerSafeSummary): LogAnalyzerEvidenceItem[] {
  if (!summary.rpmRange || !summary.torqueRangeNm || !summary.peakPower || !summary.peakTorque) return [];

  return [
    {
      id: "valid-row-count",
      source: "input_normalization",
      type: "valid_row_count",
      severity: summary.validRowCount >= 3 ? "info" : "caution",
      text: `${summary.validRowCount} valid RPM and torque rows were summarized.`,
      customerSafe: true,
    },
    {
      id: "rpm-range",
      source: "log_summary",
      type: "rpm_range",
      severity: "info",
      text: `RPM range is ${summary.rpmRange.min.toFixed(0)} to ${summary.rpmRange.max.toFixed(0)} rpm.`,
      customerSafe: true,
    },
    {
      id: "torque-range",
      source: "log_summary",
      type: "torque_range",
      severity: "info",
      text: `Torque range is ${summary.torqueRangeNm.min.toFixed(1)} to ${summary.torqueRangeNm.max.toFixed(1)} Nm.`,
      customerSafe: true,
    },
    {
      id: "peak-estimates",
      source: "log_summary",
      type: "peak_estimate",
      severity: "caution",
      text: `Peak estimated power is ${summary.peakPower.hp.toFixed(1)} HP at ${summary.peakPower.rpm.toFixed(0)} rpm; peak torque is ${summary.peakTorque.torqueNm.toFixed(1)} Nm at ${summary.peakTorque.rpm.toFixed(0)} rpm.`,
      customerSafe: true,
    },
  ];
}

function metadataEvidence(vehicle: LogAnalyzerVehicleContext | null | undefined): LogAnalyzerEvidenceItem[] {
  const evidence: LogAnalyzerEvidenceItem[] = [];
  if (textValue(vehicle?.brand) || textValue(vehicle?.model) || textValue(vehicle?.engine)) {
    evidence.push({
      id: "vehicle-context-present",
      source: "vehicle_metadata",
      type: "metadata_gap",
      severity: "info",
      text: "Vehicle brand, model or engine metadata is present for expert review context.",
      customerSafe: true,
    });
  }
  if (textValue(vehicle?.ecuType) || textValue(vehicle?.ecuFamily) || textValue(vehicle?.readMethod)) {
    evidence.push({
      id: "ecu-read-context-present",
      source: "vehicle_metadata",
      type: "metadata_gap",
      severity: "info",
      text: "ECU/TCU or read-method metadata is present for expert review context.",
      customerSafe: true,
    });
  }
  return evidence;
}

function rpmSpan(summary: LogAnalyzerSafeSummary) {
  return summary.rpmRange ? summary.rpmRange.max - summary.rpmRange.min : 0;
}

function logQualityRiskFlags(summary: LogAnalyzerSafeSummary, vehicle: LogAnalyzerVehicleContext | null | undefined): LogAnalyzerRiskFlag[] {
  const flags: LogAnalyzerRiskFlag[] = [
    {
      id: "ecu-torque-estimate",
      kind: "ecu_torque_estimate",
      severity: "caution",
      text: "Logged torque can be modeled, limited or filtered by ECU strategy and must be reviewed as an estimate.",
      requiresHumanReview: true,
      customerSafe: true,
    },
    {
      id: "dyno-equivalence-risk",
      kind: "dyno_equivalence_risk",
      severity: "caution",
      text: "Calculated power from log torque and RPM is not equivalent to calibrated dyno output.",
      requiresHumanReview: true,
      customerSafe: true,
    },
  ];

  if (summary.validRowCount < 3) {
    flags.unshift({
      id: "insufficient-log-coverage",
      kind: "insufficient_log_coverage",
      severity: "warning",
      text: "Fewer than three valid rows are available, so trend and peak interpretation is weak.",
      requiresHumanReview: true,
      customerSafe: true,
    });
  }

  if (rpmSpan(summary) < 500) {
    flags.unshift({
      id: "narrow-rpm-range",
      kind: "narrow_rpm_range",
      severity: "warning",
      text: "RPM coverage is narrow; a wider and cleaner pull is needed for stronger review.",
      requiresHumanReview: true,
      customerSafe: true,
    });
  }

  if (!textValue(vehicle?.brand) || !textValue(vehicle?.engine) || (!textValue(vehicle?.ecuType) && !textValue(vehicle?.ecuFamily))) {
    flags.push({
      id: "missing-vehicle-context",
      kind: "missing_vehicle_context",
      severity: "caution",
      text: "Vehicle and ECU context is incomplete for expert interpretation.",
      requiresHumanReview: true,
      customerSafe: true,
    });
  }

  return flags;
}

function missingInformation(summary: LogAnalyzerSafeSummary, vehicle: LogAnalyzerVehicleContext | null | undefined) {
  const missing = new Set<string>();
  if (!textValue(vehicle?.brand) || !textValue(vehicle?.model) || !textValue(vehicle?.engine)) {
    missing.add(commonMissingInformation[0]);
  }
  if (!textValue(vehicle?.ecuType) && !textValue(vehicle?.ecuFamily)) {
    missing.add(commonMissingInformation[1]);
  }
  if (!textValue(vehicle?.readMethod)) {
    missing.add("Read method");
  }
  if (summary.validRowCount < 3 || rpmSpan(summary) < 500) {
    missing.add("A wider clean log with at least three valid RPM and torque rows");
  }
  for (const item of commonMissingInformation.slice(2)) missing.add(item);
  return [...missing];
}

function logRecommendations(summary: LogAnalyzerSafeSummary, missing: string[], riskFlags: LogAnalyzerRiskFlag[]): LogAnalyzerRecommendation[] {
  const recommendations: LogAnalyzerRecommendation[] = missing.slice(0, 8).map((item, index) => ({
    id: `missing-${index + 1}`,
    category: "missing_information",
    priority: "normal",
    text: `Collect ${item.toLowerCase()} before expert log review.`,
    requiresHumanReview: false,
    customerSafe: true,
  }));

  if (summary.validRowCount < 3 || rpmSpan(summary) < 500) {
    recommendations.push({
      id: "log-data-quality",
      category: "data_quality",
      priority: "high",
      text: "Capture a cleaner and wider RPM sweep before treating the peak estimates as review evidence.",
      requiresHumanReview: true,
      customerSafe: true,
    });
  }

  if (riskFlags.some((flag) => flag.kind === "dyno_equivalence_risk")) {
    recommendations.push({
      id: "dyno-review",
      category: "expert_review",
      priority: "normal",
      text: "Use calibrated dyno or richer channel logs when a final power or drivability decision is required.",
      requiresHumanReview: true,
      customerSafe: true,
    });
  }

  recommendations.push({
    id: "human-review-gate",
    category: "human_review_gate",
    priority: "high",
    text: "Human expert review is required before tune advice, calibration changes, customer-ready MOD export, checksum approval, flash-safety claims or delivery automation.",
    requiresHumanReview: true,
    customerSafe: true,
  });

  return recommendations;
}

function readinessFor(summary: LogAnalyzerSafeSummary): LogAnalyzerReadiness {
  if (summary.validRowCount === 0) return "blocked";
  if (summary.validRowCount < 3 || rpmSpan(summary) < 500) return "needs_log_data";
  if (summary.validRowCount >= 5 && rpmSpan(summary) >= 1000) return "evidence_supported_review";
  return "human_review_required";
}

function confidenceFor(readiness: LogAnalyzerReadiness): LogAnalyzerConfidence {
  if (readiness === "blocked") return "none";
  if (readiness === "needs_log_data") return "low";
  return "medium";
}

function confidenceReasons(input: {
  readiness: LogAnalyzerReadiness;
  confidence: LogAnalyzerConfidence;
  provider: LogAnalyzerProviderIdentity;
  summary: LogAnalyzerSafeSummary;
  normalized: LogAnalyzerNormalizedInput;
}): LogAnalyzerConfidenceReason[] {
  if (input.confidence === "none") {
    return [{
      id: "confidence-none",
      confidence: "none",
      text: input.normalized.invalidReason ?? "No valid log rows were available for analysis.",
      customerSafe: true,
    }];
  }

  const reasons: LogAnalyzerConfidenceReason[] = [
    {
      id: "deterministic-cap",
      confidence: input.confidence,
      text: "Confidence is capped because this deterministic fallback calculates summary facts only and does not evaluate the full vehicle or ECU context.",
      customerSafe: true,
    },
    {
      id: "dyno-cap",
      confidence: input.confidence,
      text: "Calculated power from ECU torque logs is an estimate and is not treated as calibrated dyno output.",
      customerSafe: true,
    },
  ];

  if (input.provider.providerStatus !== "ready" || input.provider.providerId !== deterministicLogAnalyzerProviderId) {
    reasons.push({
      id: "provider-fallback-cap",
      confidence: input.confidence,
      text: "Provider unavailable or failed state keeps this result in deterministic non-AI fallback mode.",
      customerSafe: true,
    });
  }

  if (input.readiness === "needs_log_data") {
    reasons.push({
      id: "log-data-cap",
      confidence: input.confidence,
      text: "Confidence is low until the log has enough valid rows and RPM coverage.",
      customerSafe: true,
    });
  }

  if (input.summary.validRowCount >= 5 && rpmSpan(input.summary) >= 1000) {
    reasons.push({
      id: "evidence-supported-review",
      confidence: input.confidence,
      text: "The valid row count and RPM coverage are enough for expert review preparation, not automatic file approval.",
      customerSafe: true,
    });
  }

  return uniqueById(reasons);
}

function providerHumanReviewReason(provider: LogAnalyzerProviderIdentity) {
  if (provider.providerStatus === "error") {
    return "Provider error fallback and log-derived estimates require human expert review before any file or delivery action.";
  }
  if (provider.providerStatus === "unavailable") {
    return "Provider unavailable fallback and log-derived estimates require human expert review before any file or delivery action.";
  }
  return "Log-derived estimates require human expert review before any file or delivery action.";
}

function summarizeLog(summary: LogAnalyzerSafeSummary) {
  if (!summary.rpmRange || !summary.peakPower || !summary.peakTorque) {
    return "No valid log rows were available for deterministic summary.";
  }

  return `Deterministic non-AI Log Analyzer summarized ${summary.validRowCount} valid rows from ${summary.rpmRange.min.toFixed(0)} to ${summary.rpmRange.max.toFixed(0)} rpm. Peak estimated power is ${summary.peakPower.hp.toFixed(1)} HP at ${summary.peakPower.rpm.toFixed(0)} rpm; peak torque is ${summary.peakTorque.torqueNm.toFixed(1)} Nm at ${summary.peakTorque.rpm.toFixed(0)} rpm. Human review remains required.`;
}

export function buildProviderUnavailableLogAnalyzerResponse(
  request: LogAnalyzerRequest,
  reason = "No Log Analyzer provider is configured for local analysis."
): LogAnalyzerResponse {
  const normalized = normalizeLogAnalyzerInput(request);
  const provider = unavailableLogAnalyzerProviderIdentity(reason);

  return {
    contractVersion: logAnalyzerContractVersion,
    status: "provider_unavailable",
    provider,
    fallback: {
      used: false,
      providerId: deterministicLogAnalyzerProviderId,
      reason: null,
    },
    isAiGenerated: false,
    readiness: "blocked",
    confidence: "none",
    confidenceReasons: [{
      id: "provider-unavailable-confidence-none",
      confidence: "none",
      text: "No Log Analyzer confidence is assigned because the configured provider is unavailable and fallback was not used in this response.",
      customerSafe: true,
    }],
    normalizedInput: normalized,
    summary: "Log Analyzer provider is unavailable. Use deterministic fallback for local, non-AI log summary.",
    logSummary: emptyLogSummary(normalized),
    evidence: providerStateEvidence(provider),
    riskFlags: providerStateRiskFlags(provider),
    recommendations: providerUnavailableRecommendations(),
    missingInformation: normalized.invalidReason ? ["Valid RPM and torque log rows"] : commonMissingInformation,
    humanReview: {
      required: true,
      reason: "Log Analyzer is unavailable until a provider is configured or deterministic fallback is used.",
      requiredBefore: [
        "tune advice",
        "calibration changes",
        "customer-ready MOD export",
        "checksum approval",
        "flash-safety or delivery decision",
      ],
    },
    safetyBoundaries,
    blockedProductionActions: [...logAnalyzerBlockedProductionActions],
  };
}

export function buildInvalidLogAnalyzerInputResponse(
  request: LogAnalyzerRequest,
  normalized = normalizeLogAnalyzerInput(request)
): LogAnalyzerResponse {
  const provider = deterministicProviderIdentity();

  return {
    contractVersion: logAnalyzerContractVersion,
    status: "invalid_input",
    provider,
    fallback: {
      used: true,
      providerId: deterministicLogAnalyzerProviderId,
      reason: "Input validation handled by deterministic rules before any provider call.",
    },
    isAiGenerated: false,
    readiness: "blocked",
    confidence: "none",
    confidenceReasons: confidenceReasons({
      readiness: "blocked",
      confidence: "none",
      provider,
      summary: emptyLogSummary(normalized),
      normalized,
    }),
    normalizedInput: normalized,
    summary: normalized.invalidReason ?? "No valid RPM and torque rows were detected.",
    logSummary: emptyLogSummary(normalized),
    evidence: invalidInputEvidence(normalized),
    riskFlags: invalidInputRiskFlags(),
    recommendations: invalidInputRecommendations(),
    missingInformation: ["Valid RPM and torque log rows"],
    humanReview: {
      required: true,
      reason: "Valid log data is required before useful log guidance can be prepared.",
      requiredBefore: [
        "tune advice",
        "calibration changes",
        "customer-ready MOD export",
      ],
    },
    safetyBoundaries,
    blockedProductionActions: [...logAnalyzerBlockedProductionActions],
  };
}

export function buildDeterministicLogAnalyzerFallback(
  request: LogAnalyzerRequest,
  prepared = prepareLogAnalyzerInput(request),
  options: {
    provider?: LogAnalyzerProviderIdentity;
    reason?: string;
  } = {}
): LogAnalyzerResponse {
  if (prepared.normalized.invalidReason) {
    return buildInvalidLogAnalyzerInputResponse(request, prepared.normalized);
  }

  const provider = options.provider ?? deterministicProviderIdentity();
  const logSummary = buildSafeLogSummary(prepared.points, prepared.normalized);
  const readiness = readinessFor(logSummary);
  const confidence = confidenceFor(readiness);
  const missing = missingInformation(logSummary, request.vehicle);
  const riskFlags = uniqueById([
    ...logQualityRiskFlags(logSummary, request.vehicle),
    ...providerStateRiskFlags(provider),
  ]);
  const recommendations = uniqueById([
    ...logRecommendations(logSummary, missing, riskFlags),
    ...(provider.providerStatus === "ready" && provider.providerId === deterministicLogAnalyzerProviderId
      ? []
      : providerUnavailableRecommendations()),
  ]);
  const evidence = uniqueById([
    ...logSummaryEvidence(logSummary),
    ...metadataEvidence(request.vehicle),
    ...providerStateEvidence(provider),
  ]);

  return {
    contractVersion: logAnalyzerContractVersion,
    status: "fallback",
    provider,
    fallback: {
      used: true,
      providerId: deterministicLogAnalyzerProviderId,
      reason: options.reason ?? "Deterministic non-AI fallback used for local Log Analyzer summary.",
    },
    isAiGenerated: false,
    readiness,
    confidence,
    confidenceReasons: confidenceReasons({
      readiness,
      confidence,
      provider,
      summary: logSummary,
      normalized: prepared.normalized,
    }),
    normalizedInput: prepared.normalized,
    summary: summarizeLog(logSummary),
    logSummary,
    evidence,
    riskFlags,
    recommendations,
    missingInformation: uniqueInOrder(missing),
    humanReview: {
      required: true,
      reason: providerHumanReviewReason(provider),
      requiredBefore: [
        "tune advice",
        "calibration changes",
        "customer-ready MOD export",
        "checksum approval",
        "flash-safety or delivery decision",
      ],
    },
    safetyBoundaries,
    blockedProductionActions: [...logAnalyzerBlockedProductionActions],
  };
}
