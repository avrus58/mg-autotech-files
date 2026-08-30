import type {
  LogAnalyzerConfidence,
  LogAnalyzerConfidenceReason,
  LogAnalyzerEvidenceItem,
  LogAnalyzerInputRow,
  LogAnalyzerMessage,
  LogAnalyzerMessageKey,
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
import { maxCalculatedEngineTorqueNm } from "@/lib/logAnalysisStudio";
import { parsePerformanceLog } from "@/lib/performanceReport";

export const logAnalyzerContractVersion = "log-analyzer-v1" as const;
export const logAnalyzerPromptVersion = "log-analyzer-v1";
export const deterministicLogAnalyzerProviderId = "deterministic_rules" as const;
export const unconfiguredLogAnalyzerProviderId = "unconfigured_log_analyzer_provider";
export const maxLogAnalyzerRows = 2000;
export const maxBrowserLogAnalyzerRows = 15_000;
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

function analyzerMessage(
  key: LogAnalyzerMessageKey,
  fallback: string,
  params: Readonly<Record<string, string | number>> = {}
): LogAnalyzerMessage {
  return { key, params, fallback };
}

function fallbackMessages(messages: readonly LogAnalyzerMessage[]) {
  return messages.map((message) => message.fallback);
}

const safetyBoundaryMessages = [
  analyzerMessage("analyzer.safety.guidanceOnly", "This is log summary guidance only and does not confirm a tune, diagnosis, repair path or legal suitability."),
  analyzerMessage("analyzer.safety.estimatedPower", "Power is estimated from logged torque and RPM; it is not a calibrated chassis-dyno measurement."),
  analyzerMessage("analyzer.safety.humanReview", "Human expert review is required before any calibration, checksum, flash-safety, delivery or customer file action."),
];
const safetyBoundaries = fallbackMessages(safetyBoundaryMessages);

const commonMissingInformationMessages = [
  analyzerMessage("analyzer.missing.vehicleContext", "Vehicle brand, model, engine and ECU or TCU family"),
  analyzerMessage("analyzer.missing.fileIdentity", "Read method, software number and file identity"),
  analyzerMessage("analyzer.missing.operatingContext", "Gear, load condition and whether the log is full-throttle, partial-load or diagnostic-only"),
  analyzerMessage("analyzer.missing.requestedActualChannels", "Requested versus actual boost, airflow, rail pressure and temperature channels where available"),
  analyzerMessage("analyzer.missing.diagnosticContext", "Diagnostic fault status and hardware modification context"),
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
  if (
    !Number.isFinite(rpm) ||
    !Number.isFinite(torqueNm) ||
    rpm < 100 ||
    rpm > 30_000 ||
    torqueNm <= 0 ||
    torqueNm > maxCalculatedEngineTorqueNm
  ) {
    return null;
  }

  const power = calculateLogPowerEstimate(torqueNm, rpm);
  if (!Object.values(power).every(Number.isFinite)) return null;
  return {
    rpm: round(rpm, 0),
    torqueNm: round(torqueNm, 1),
    kw: round(power.kw, 1),
    hp: round(power.hp, 1),
    ps: round(power.ps, 1),
  };
}

export function parseLogAnalyzerText(input: string): {
  rows: LogAnalyzerInputRow[];
  rejectedRowCount: number;
  sourceFormat: LogAnalyzerSourceFormat;
  wasTruncated: boolean;
} {
  const truncatedText = input.slice(0, maxLogAnalyzerTextLength);
  const parsed = parsePerformanceLog(truncatedText);
  const wasTruncated =
    input.length > maxLogAnalyzerTextLength ||
    parsed.sourceRowCount > maxLogAnalyzerRows ||
    parsed.points.length > maxLogAnalyzerRows;

  if (!truncatedText.trim()) {
    return { rows: [], rejectedRowCount: 0, sourceFormat: "empty", wasTruncated };
  }

  const rows = parsed.points.slice(0, maxLogAnalyzerRows).map((point) => ({
    rpm: point.rpm,
    torqueNm: point.torque,
  }));

  return {
    rows,
    rejectedRowCount: parsed.rejectedRowCount,
    sourceFormat:
      parsed.format === "rpm_torque_rows"
        ? "text_rows"
        : parsed.format === "generic_tabular_log"
          ? "generic_tabular_log"
          : "unsupported",
    wasTruncated,
  };
}

function prepareStructuredRows(
  rows: LogAnalyzerInputRow[],
  rowLimit = maxLogAnalyzerRows
): PreparedLogInput {
  const limitedRows = rows.slice(0, rowLimit);
  const points = limitedRows
    .map(toPoint)
    .filter((point): point is LogAnalyzerPeakPoint => Boolean(point));
  const rejectedRowCount = limitedRows.length - points.length;
  const invalidReasonMessage =
    points.length === 0
      ? analyzerMessage("analyzer.invalid.noValidRows", "No valid RPM and torque rows were detected. Provide rows such as 2200, 390.")
      : null;

  return {
    normalized: {
      hasLogData: points.length > 0,
      sourceFormat: rows.length ? "structured_rows" : "empty",
      wasTruncated: rows.length > rowLimit,
      validRowCount: points.length,
      rejectedRowCount,
      invalidReason: invalidReasonMessage?.fallback ?? null,
      invalidReasonMessage,
    },
    points,
  };
}

function prepareTextRows(text: string): PreparedLogInput {
  const parsed = parseLogAnalyzerText(text);
  const points = parsed.rows
    .map(toPoint)
    .filter((point): point is LogAnalyzerPeakPoint => Boolean(point));
  const invalidReasonMessage =
    text.trim().length === 0
      ? analyzerMessage("analyzer.invalid.provideRows", "Provide log rows with RPM and torque values.")
      : points.length === 0
        ? analyzerMessage("analyzer.invalid.noValidRows", "No valid RPM and torque rows were detected. Provide rows such as 2200, 390.")
        : null;

  return {
    normalized: {
      hasLogData: points.length > 0,
      sourceFormat: parsed.sourceFormat,
      wasTruncated: parsed.wasTruncated,
      validRowCount: points.length,
      rejectedRowCount: parsed.rejectedRowCount,
      invalidReason: invalidReasonMessage?.fallback ?? null,
      invalidReasonMessage,
    },
    points,
  };
}

function prepareLogAnalyzerInput(request: LogAnalyzerRequest): PreparedLogInput {
  if (request.rows && request.rows.length > 0) {
    return prepareStructuredRows(
      request.rows,
      request.source === "browser_tool" ? maxBrowserLogAnalyzerRows : maxLogAnalyzerRows
    );
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
      invalidReasonMessage: analyzerMessage("analyzer.invalid.provideRows", "Provide log rows with RPM and torque values."),
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

  const message = provider.providerStatus === "error"
    ? analyzerMessage("analyzer.evidence.providerError", "The configured Log Analyzer provider failed locally; deterministic non-AI fallback was used.")
    : analyzerMessage("analyzer.evidence.providerUnavailable", "The Log Analyzer provider is unavailable; deterministic non-AI fallback is required for local guidance.");
  return [{
    id: `provider-${provider.providerStatus}`,
    source: "provider_state",
    type: "provider_availability",
    severity: provider.providerStatus === "error" ? "warning" : "caution",
    text: message.fallback,
    message,
    customerSafe: true,
  }];
}

function providerStateRiskFlags(provider: LogAnalyzerProviderIdentity): LogAnalyzerRiskFlag[] {
  if (provider.providerStatus === "ready" && provider.providerId === deterministicLogAnalyzerProviderId) {
    return [];
  }

  const message = analyzerMessage("analyzer.risk.providerState", "Provider state prevents treating this output as AI-generated log analysis.");
  return [{
    id: `provider-${provider.providerStatus}-risk`,
    kind: "provider_unavailable",
    severity: provider.providerStatus === "error" ? "warning" : "caution",
    text: message.fallback,
    message,
    requiresHumanReview: true,
    customerSafe: true,
  }];
}

function providerUnavailableRecommendations(): LogAnalyzerRecommendation[] {
  const message = analyzerMessage("analyzer.recommendation.providerUnavailable", "Log Analyzer provider is unavailable. Use deterministic fallback or human expert review; do not present this as AI-generated analysis.");
  return [{
    id: "provider-unavailable-fallback-notice",
    category: "fallback_notice",
    priority: "high",
    text: message.fallback,
    message,
    requiresHumanReview: true,
    customerSafe: true,
  }];
}

function invalidInputEvidence(normalized: LogAnalyzerNormalizedInput): LogAnalyzerEvidenceItem[] {
  const message = normalized.invalidReasonMessage ?? analyzerMessage("analyzer.evidence.invalidInput", "No valid RPM and torque rows were detected.");
  return [{
    id: "invalid-log-input",
    source: "input_normalization",
    type: "input_validation",
    severity: "warning",
    text: message.fallback,
    message,
    customerSafe: true,
  }];
}

function invalidInputRiskFlags(): LogAnalyzerRiskFlag[] {
  const message = analyzerMessage("analyzer.risk.invalidInput", "Log analysis cannot start until valid RPM and torque rows are available.");
  return [{
    id: "invalid-input",
    kind: "invalid_input",
    severity: "warning",
    text: message.fallback,
    message,
    requiresHumanReview: true,
    customerSafe: true,
  }];
}

function invalidInputRecommendations(): LogAnalyzerRecommendation[] {
  const provideRows = analyzerMessage("analyzer.recommendation.provideRows", "Provide at least one valid RPM and torque row, for example 2200, 390.");
  const noAdvice = analyzerMessage("analyzer.recommendation.noAdvice", "Do not prepare customer file advice until valid log data is available.");
  return [
    {
      id: "invalid-input-log-rows",
      category: "missing_information",
      priority: "high",
      text: provideRows.fallback,
      message: provideRows,
      requiresHumanReview: false,
      customerSafe: true,
    },
    {
      id: "invalid-input-human-review-gate",
      category: "human_review_gate",
      priority: "high",
      text: noAdvice.fallback,
      message: noAdvice,
      requiresHumanReview: true,
      customerSafe: true,
    },
  ];
}

function logSummaryEvidence(summary: LogAnalyzerSafeSummary): LogAnalyzerEvidenceItem[] {
  if (!summary.rpmRange || !summary.torqueRangeNm || !summary.peakPower || !summary.peakTorque) return [];

  const validRows = analyzerMessage("analyzer.evidence.validRows", `${summary.validRowCount} valid RPM and torque rows were summarized.`, { count: summary.validRowCount });
  const rpmRange = analyzerMessage("analyzer.evidence.rpmRange", `RPM range is ${summary.rpmRange.min.toFixed(0)} to ${summary.rpmRange.max.toFixed(0)} rpm.`, { minimum: summary.rpmRange.min, maximum: summary.rpmRange.max });
  const torqueRange = analyzerMessage("analyzer.evidence.torqueRange", `Torque range is ${summary.torqueRangeNm.min.toFixed(1)} to ${summary.torqueRangeNm.max.toFixed(1)} Nm.`, { minimum: summary.torqueRangeNm.min, maximum: summary.torqueRangeNm.max });
  const peaks = analyzerMessage("analyzer.evidence.peaks", `Peak estimated power is ${summary.peakPower.hp.toFixed(1)} HP at ${summary.peakPower.rpm.toFixed(0)} rpm; peak torque is ${summary.peakTorque.torqueNm.toFixed(1)} Nm at ${summary.peakTorque.rpm.toFixed(0)} rpm.`, {
    power: summary.peakPower.hp,
    powerRpm: summary.peakPower.rpm,
    torque: summary.peakTorque.torqueNm,
    torqueRpm: summary.peakTorque.rpm,
  });

  return [
    {
      id: "valid-row-count",
      source: "input_normalization",
      type: "valid_row_count",
      severity: summary.validRowCount >= 3 ? "info" : "caution",
      text: validRows.fallback,
      message: validRows,
      customerSafe: true,
    },
    {
      id: "rpm-range",
      source: "log_summary",
      type: "rpm_range",
      severity: "info",
      text: rpmRange.fallback,
      message: rpmRange,
      customerSafe: true,
    },
    {
      id: "torque-range",
      source: "log_summary",
      type: "torque_range",
      severity: "info",
      text: torqueRange.fallback,
      message: torqueRange,
      customerSafe: true,
    },
    {
      id: "peak-estimates",
      source: "log_summary",
      type: "peak_estimate",
      severity: "caution",
      text: peaks.fallback,
      message: peaks,
      customerSafe: true,
    },
  ];
}

function metadataEvidence(vehicle: LogAnalyzerVehicleContext | null | undefined): LogAnalyzerEvidenceItem[] {
  const evidence: LogAnalyzerEvidenceItem[] = [];
  if (textValue(vehicle?.brand) || textValue(vehicle?.model) || textValue(vehicle?.engine)) {
    const message = analyzerMessage("analyzer.evidence.vehicleContext", "Vehicle brand, model or engine metadata is present for expert review context.");
    evidence.push({
      id: "vehicle-context-present",
      source: "vehicle_metadata",
      type: "metadata_gap",
      severity: "info",
      text: message.fallback,
      message,
      customerSafe: true,
    });
  }
  if (textValue(vehicle?.ecuType) || textValue(vehicle?.ecuFamily) || textValue(vehicle?.readMethod)) {
    const message = analyzerMessage("analyzer.evidence.ecuContext", "ECU/TCU or read-method metadata is present for expert review context.");
    evidence.push({
      id: "ecu-read-context-present",
      source: "vehicle_metadata",
      type: "metadata_gap",
      severity: "info",
      text: message.fallback,
      message,
      customerSafe: true,
    });
  }
  return evidence;
}

function rpmSpan(summary: LogAnalyzerSafeSummary) {
  return summary.rpmRange ? summary.rpmRange.max - summary.rpmRange.min : 0;
}

function logQualityRiskFlags(summary: LogAnalyzerSafeSummary, vehicle: LogAnalyzerVehicleContext | null | undefined): LogAnalyzerRiskFlag[] {
  const torqueEstimate = analyzerMessage("analyzer.risk.torqueEstimate", "Logged torque can be modeled, limited or filtered by ECU strategy and must be reviewed as an estimate.");
  const dyno = analyzerMessage("analyzer.risk.dyno", "Calculated power from log torque and RPM is not equivalent to calibrated dyno output.");
  const flags: LogAnalyzerRiskFlag[] = [
    {
      id: "ecu-torque-estimate",
      kind: "ecu_torque_estimate",
      severity: "caution",
      text: torqueEstimate.fallback,
      message: torqueEstimate,
      requiresHumanReview: true,
      customerSafe: true,
    },
    {
      id: "dyno-equivalence-risk",
      kind: "dyno_equivalence_risk",
      severity: "caution",
      text: dyno.fallback,
      message: dyno,
      requiresHumanReview: true,
      customerSafe: true,
    },
  ];

  if (summary.validRowCount < 3) {
    const message = analyzerMessage("analyzer.risk.insufficientRows", "Fewer than three valid rows are available, so trend and peak interpretation is weak.");
    flags.unshift({
      id: "insufficient-log-coverage",
      kind: "insufficient_log_coverage",
      severity: "warning",
      text: message.fallback,
      message,
      requiresHumanReview: true,
      customerSafe: true,
    });
  }

  if (rpmSpan(summary) < 500) {
    const message = analyzerMessage("analyzer.risk.narrowRpm", "RPM coverage is narrow; a wider and cleaner pull is needed for stronger review.");
    flags.unshift({
      id: "narrow-rpm-range",
      kind: "narrow_rpm_range",
      severity: "warning",
      text: message.fallback,
      message,
      requiresHumanReview: true,
      customerSafe: true,
    });
  }

  if (!textValue(vehicle?.brand) || !textValue(vehicle?.engine) || (!textValue(vehicle?.ecuType) && !textValue(vehicle?.ecuFamily))) {
    const message = analyzerMessage("analyzer.risk.missingVehicle", "Vehicle and ECU context is incomplete for expert interpretation.");
    flags.push({
      id: "missing-vehicle-context",
      kind: "missing_vehicle_context",
      severity: "caution",
      text: message.fallback,
      message,
      requiresHumanReview: true,
      customerSafe: true,
    });
  }

  return flags;
}

function missingInformation(summary: LogAnalyzerSafeSummary, vehicle: LogAnalyzerVehicleContext | null | undefined) {
  const missing = new Map<LogAnalyzerMessageKey, LogAnalyzerMessage>();
  const add = (message: LogAnalyzerMessage) => missing.set(message.key, message);
  if (!textValue(vehicle?.brand) || !textValue(vehicle?.model) || !textValue(vehicle?.engine)) {
    add(commonMissingInformationMessages[0]);
  }
  if (!textValue(vehicle?.ecuType) && !textValue(vehicle?.ecuFamily)) {
    add(commonMissingInformationMessages[1]);
  }
  if (!textValue(vehicle?.readMethod)) {
    add(analyzerMessage("analyzer.missing.readMethod", "Read method"));
  }
  if (summary.validRowCount < 3 || rpmSpan(summary) < 500) {
    add(analyzerMessage("analyzer.missing.widerLog", "A wider clean log with at least three valid RPM and torque rows"));
  }
  for (const item of commonMissingInformationMessages.slice(2)) add(item);
  return [...missing.values()];
}

function logRecommendations(summary: LogAnalyzerSafeSummary, missing: LogAnalyzerMessage[], riskFlags: LogAnalyzerRiskFlag[]): LogAnalyzerRecommendation[] {
  const recommendations: LogAnalyzerRecommendation[] = missing.slice(0, 8).map((item, index) => ({
    id: `missing-${index + 1}`,
    category: "missing_information",
    priority: "normal",
    text: `Collect ${item.fallback.toLowerCase()} before expert log review.`,
    message: analyzerMessage(
      "analyzer.recommendation.collect",
      `Collect ${item.fallback.toLowerCase()} before expert log review.`,
      { itemKey: item.key }
    ),
    requiresHumanReview: false,
    customerSafe: true,
  }));

  if (summary.validRowCount < 3 || rpmSpan(summary) < 500) {
    const message = analyzerMessage("analyzer.recommendation.cleanerSweep", "Capture a cleaner and wider RPM sweep before treating the peak estimates as review evidence.");
    recommendations.push({
      id: "log-data-quality",
      category: "data_quality",
      priority: "high",
      text: message.fallback,
      message,
      requiresHumanReview: true,
      customerSafe: true,
    });
  }

  if (riskFlags.some((flag) => flag.kind === "dyno_equivalence_risk")) {
    const message = analyzerMessage("analyzer.recommendation.dynoReview", "Use calibrated dyno or richer channel logs when a final power or drivability decision is required.");
    recommendations.push({
      id: "dyno-review",
      category: "expert_review",
      priority: "normal",
      text: message.fallback,
      message,
      requiresHumanReview: true,
      customerSafe: true,
    });
  }

  const humanGate = analyzerMessage("analyzer.recommendation.humanGate", "Human expert review is required before tune advice, calibration changes, customer-ready MOD export, checksum approval, flash-safety claims or delivery automation.");
  recommendations.push({
    id: "human-review-gate",
    category: "human_review_gate",
    priority: "high",
    text: humanGate.fallback,
    message: humanGate,
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
    const message = input.normalized.invalidReasonMessage ?? analyzerMessage("analyzer.confidence.noRows", "No valid log rows were available for analysis.");
    return [{
      id: "confidence-none",
      confidence: "none",
      text: message.fallback,
      message,
      customerSafe: true,
    }];
  }

  const reasons: LogAnalyzerConfidenceReason[] = [
    {
      id: "deterministic-cap",
      confidence: input.confidence,
      text: "Confidence is capped because this deterministic fallback calculates summary facts only and does not evaluate the full vehicle or ECU context.",
      message: analyzerMessage("analyzer.confidence.deterministicCap", "Confidence is capped because this deterministic fallback calculates summary facts only and does not evaluate the full vehicle or ECU context."),
      customerSafe: true,
    },
    {
      id: "dyno-cap",
      confidence: input.confidence,
      text: "Calculated power from ECU torque logs is an estimate and is not treated as calibrated dyno output.",
      message: analyzerMessage("analyzer.confidence.dynoCap", "Calculated power from ECU torque logs is an estimate and is not treated as calibrated dyno output."),
      customerSafe: true,
    },
  ];

  if (input.provider.providerStatus !== "ready" || input.provider.providerId !== deterministicLogAnalyzerProviderId) {
    reasons.push({
      id: "provider-fallback-cap",
      confidence: input.confidence,
      text: "Provider unavailable or failed state keeps this result in deterministic non-AI fallback mode.",
      message: analyzerMessage("analyzer.confidence.providerCap", "Provider unavailable or failed state keeps this result in deterministic non-AI fallback mode."),
      customerSafe: true,
    });
  }

  if (input.readiness === "needs_log_data") {
    reasons.push({
      id: "log-data-cap",
      confidence: input.confidence,
      text: "Confidence is low until the log has enough valid rows and RPM coverage.",
      message: analyzerMessage("analyzer.confidence.logDataCap", "Confidence is low until the log has enough valid rows and RPM coverage."),
      customerSafe: true,
    });
  }

  if (input.summary.validRowCount >= 5 && rpmSpan(input.summary) >= 1000) {
    reasons.push({
      id: "evidence-supported-review",
      confidence: input.confidence,
      text: "The valid row count and RPM coverage are enough for expert review preparation, not automatic file approval.",
      message: analyzerMessage("analyzer.confidence.evidenceSupported", "The valid row count and RPM coverage are enough for expert review preparation, not automatic file approval."),
      customerSafe: true,
    });
  }

  return uniqueById(reasons);
}

function providerHumanReviewReason(provider: LogAnalyzerProviderIdentity) {
  if (provider.providerStatus === "error") {
    return analyzerMessage("analyzer.humanReview.providerError", "Provider error fallback and log-derived estimates require human expert review before any file or delivery action.");
  }
  if (provider.providerStatus === "unavailable") {
    return analyzerMessage("analyzer.humanReview.providerUnavailable", "Provider unavailable fallback and log-derived estimates require human expert review before any file or delivery action.");
  }
  return analyzerMessage("analyzer.humanReview.default", "Log-derived estimates require human expert review before any file or delivery action.");
}

function summarizeLog(summary: LogAnalyzerSafeSummary) {
  if (!summary.rpmRange || !summary.peakPower || !summary.peakTorque) {
    return analyzerMessage("analyzer.summary.noRows", "No valid log rows were available for deterministic summary.");
  }

  return analyzerMessage(
    "analyzer.summary.deterministic",
    `Deterministic non-AI Log Analyzer summarized ${summary.validRowCount} valid rows from ${summary.rpmRange.min.toFixed(0)} to ${summary.rpmRange.max.toFixed(0)} rpm. Peak estimated power is ${summary.peakPower.hp.toFixed(1)} HP at ${summary.peakPower.rpm.toFixed(0)} rpm; peak torque is ${summary.peakTorque.torqueNm.toFixed(1)} Nm at ${summary.peakTorque.rpm.toFixed(0)} rpm. Human review remains required.`,
    {
      count: summary.validRowCount,
      minimumRpm: summary.rpmRange.min,
      maximumRpm: summary.rpmRange.max,
      power: summary.peakPower.hp,
      powerRpm: summary.peakPower.rpm,
      torque: summary.peakTorque.torqueNm,
      torqueRpm: summary.peakTorque.rpm,
    }
  );
}

const requiredBeforeMessages = [
  analyzerMessage("analyzer.requiredBefore.tuneAdvice", "tune advice"),
  analyzerMessage("analyzer.requiredBefore.calibrationChanges", "calibration changes"),
  analyzerMessage("analyzer.requiredBefore.modExport", "customer-ready MOD export"),
  analyzerMessage("analyzer.requiredBefore.checksum", "checksum approval"),
  analyzerMessage("analyzer.requiredBefore.delivery", "flash-safety or delivery decision"),
];

export function buildProviderUnavailableLogAnalyzerResponse(
  request: LogAnalyzerRequest,
  reason = "No Log Analyzer provider is configured for local analysis."
): LogAnalyzerResponse {
  const normalized = normalizeLogAnalyzerInput(request);
  const provider = unavailableLogAnalyzerProviderIdentity(reason);
  const confidenceMessage = analyzerMessage("analyzer.confidence.noProvider", "No Log Analyzer confidence is assigned because the configured provider is unavailable and fallback was not used in this response.");
  const summaryMessage = analyzerMessage("analyzer.summary.providerUnavailable", "Log Analyzer provider is unavailable. Use deterministic fallback for local, non-AI log summary.");
  const missingInformationMessages = normalized.invalidReason
    ? [analyzerMessage("analyzer.missing.validRows", "Valid RPM and torque log rows")]
    : [...commonMissingInformationMessages];
  const humanReviewReason = analyzerMessage("analyzer.humanReview.unavailable", "Log Analyzer is unavailable until a provider is configured or deterministic fallback is used.");

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
      text: confidenceMessage.fallback,
      message: confidenceMessage,
      customerSafe: true,
    }],
    normalizedInput: normalized,
    summary: summaryMessage.fallback,
    summaryMessage,
    logSummary: emptyLogSummary(normalized),
    evidence: providerStateEvidence(provider),
    riskFlags: providerStateRiskFlags(provider),
    recommendations: providerUnavailableRecommendations(),
    missingInformation: fallbackMessages(missingInformationMessages),
    missingInformationMessages,
    humanReview: {
      required: true,
      reason: humanReviewReason.fallback,
      reasonMessage: humanReviewReason,
      requiredBefore: fallbackMessages(requiredBeforeMessages),
      requiredBeforeMessages: [...requiredBeforeMessages],
    },
    safetyBoundaries,
    safetyBoundaryMessages: [...safetyBoundaryMessages],
    blockedProductionActions: [...logAnalyzerBlockedProductionActions],
  };
}

export function buildInvalidLogAnalyzerInputResponse(
  request: LogAnalyzerRequest,
  normalized = normalizeLogAnalyzerInput(request)
): LogAnalyzerResponse {
  const provider = deterministicProviderIdentity();
  const summaryMessage = normalized.invalidReasonMessage ?? analyzerMessage("analyzer.invalid.noValidRows", "No valid RPM and torque rows were detected.");
  const missingInformationMessages = [analyzerMessage("analyzer.missing.validRows", "Valid RPM and torque log rows")];
  const humanReviewReason = analyzerMessage("analyzer.humanReview.invalid", "Valid log data is required before useful log guidance can be prepared.");

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
    summary: summaryMessage.fallback,
    summaryMessage,
    logSummary: emptyLogSummary(normalized),
    evidence: invalidInputEvidence(normalized),
    riskFlags: invalidInputRiskFlags(),
    recommendations: invalidInputRecommendations(),
    missingInformation: fallbackMessages(missingInformationMessages),
    missingInformationMessages,
    humanReview: {
      required: true,
      reason: humanReviewReason.fallback,
      reasonMessage: humanReviewReason,
      requiredBefore: fallbackMessages(requiredBeforeMessages.slice(0, 3)),
      requiredBeforeMessages: requiredBeforeMessages.slice(0, 3),
    },
    safetyBoundaries,
    safetyBoundaryMessages: [...safetyBoundaryMessages],
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
  const missingInformationMessages = missingInformation(logSummary, request.vehicle);
  const riskFlags = uniqueById([
    ...logQualityRiskFlags(logSummary, request.vehicle),
    ...providerStateRiskFlags(provider),
  ]);
  const recommendations = uniqueById([
    ...logRecommendations(logSummary, missingInformationMessages, riskFlags),
    ...(provider.providerStatus === "ready" && provider.providerId === deterministicLogAnalyzerProviderId
      ? []
      : providerUnavailableRecommendations()),
  ]);
  const evidence = uniqueById([
    ...logSummaryEvidence(logSummary),
    ...metadataEvidence(request.vehicle),
    ...providerStateEvidence(provider),
  ]);

  const summaryMessage = summarizeLog(logSummary);
  const humanReviewReason = providerHumanReviewReason(provider);
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
    summary: summaryMessage.fallback,
    summaryMessage,
    logSummary,
    evidence,
    riskFlags,
    recommendations,
    missingInformation: uniqueInOrder(fallbackMessages(missingInformationMessages)),
    missingInformationMessages,
    humanReview: {
      required: true,
      reason: humanReviewReason.fallback,
      reasonMessage: humanReviewReason,
      requiredBefore: fallbackMessages(requiredBeforeMessages),
      requiredBeforeMessages: [...requiredBeforeMessages],
    },
    safetyBoundaries,
    safetyBoundaryMessages: [...safetyBoundaryMessages],
    blockedProductionActions: [...logAnalyzerBlockedProductionActions],
  };
}
