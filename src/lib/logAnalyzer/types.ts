export type LogAnalyzerInputSource =
  | "browser_tool"
  | "customer_request"
  | "admin_request"
  | "desktop_request"
  | "local_test";

export type LogAnalyzerProviderKind = "deterministic_rules" | "external_ai" | "mock" | "unconfigured";

export type LogAnalyzerProviderStatus = "ready" | "unavailable" | "error";

export type LogAnalyzerResponseStatus =
  | "success"
  | "fallback"
  | "invalid_input"
  | "provider_unavailable";

export type LogAnalyzerConfidence = "none" | "low" | "medium" | "high";

export const logAnalyzerMessageKeys = [
  "analyzer.invalid.provideRows", "analyzer.invalid.noValidRows",
  "analyzer.safety.guidanceOnly", "analyzer.safety.estimatedPower", "analyzer.safety.humanReview",
  "analyzer.missing.vehicleContext", "analyzer.missing.fileIdentity", "analyzer.missing.readMethod",
  "analyzer.missing.widerLog", "analyzer.missing.operatingContext", "analyzer.missing.requestedActualChannels",
  "analyzer.missing.diagnosticContext", "analyzer.missing.validRows",
  "analyzer.evidence.providerError", "analyzer.evidence.providerUnavailable", "analyzer.evidence.invalidInput",
  "analyzer.evidence.validRows", "analyzer.evidence.rpmRange", "analyzer.evidence.torqueRange",
  "analyzer.evidence.peaks", "analyzer.evidence.vehicleContext", "analyzer.evidence.ecuContext",
  "analyzer.risk.providerState", "analyzer.risk.invalidInput", "analyzer.risk.torqueEstimate",
  "analyzer.risk.dyno", "analyzer.risk.insufficientRows", "analyzer.risk.narrowRpm",
  "analyzer.risk.missingVehicle",
  "analyzer.recommendation.providerUnavailable", "analyzer.recommendation.provideRows",
  "analyzer.recommendation.noAdvice", "analyzer.recommendation.collect", "analyzer.recommendation.cleanerSweep",
  "analyzer.recommendation.dynoReview", "analyzer.recommendation.humanGate",
  "analyzer.confidence.noRows", "analyzer.confidence.noProvider", "analyzer.confidence.deterministicCap",
  "analyzer.confidence.dynoCap", "analyzer.confidence.providerCap", "analyzer.confidence.logDataCap",
  "analyzer.confidence.evidenceSupported",
  "analyzer.humanReview.providerError", "analyzer.humanReview.providerUnavailable",
  "analyzer.humanReview.default", "analyzer.humanReview.unavailable", "analyzer.humanReview.invalid",
  "analyzer.requiredBefore.tuneAdvice", "analyzer.requiredBefore.calibrationChanges",
  "analyzer.requiredBefore.modExport", "analyzer.requiredBefore.checksum", "analyzer.requiredBefore.delivery",
  "analyzer.summary.noRows", "analyzer.summary.deterministic", "analyzer.summary.providerUnavailable",
  "analyzer.state.noLogData", "analyzer.state.providerErrorFallback",
  "analyzer.state.providerUnavailableFallback", "analyzer.state.providerUnavailable",
  "analyzer.state.providerSuccess", "analyzer.state.deterministicFallback",
  "analyzer.provider.ai", "analyzer.provider.errorFallback", "analyzer.provider.unavailableFallback",
  "analyzer.provider.unavailable", "analyzer.provider.nonAi",
] as const;

export type LogAnalyzerMessageKey = (typeof logAnalyzerMessageKeys)[number];
export type LogAnalyzerMessage = {
  key: LogAnalyzerMessageKey;
  params: Readonly<Record<string, string | number>>;
  fallback: string;
};

export type LogAnalyzerReadiness =
  | "blocked"
  | "needs_log_data"
  | "human_review_required"
  | "evidence_supported_review";

export type LogAnalyzerVehicleContext = {
  brand?: string | null;
  model?: string | null;
  engine?: string | null;
  ecuType?: string | null;
  ecuFamily?: string | null;
  readMethod?: string | null;
  gearbox?: string | null;
};

export type LogAnalyzerInputRow = {
  rpm: number;
  torqueNm: number;
};

export type LogAnalyzerRequest = {
  source: LogAnalyzerInputSource;
  text?: string | null;
  rows?: LogAnalyzerInputRow[] | null;
  fileName?: string | null;
  vehicle?: LogAnalyzerVehicleContext | null;
  notes?: string | null;
};

export type LogAnalyzerProviderIdentity = {
  providerId: string;
  providerKind: LogAnalyzerProviderKind;
  providerStatus: LogAnalyzerProviderStatus;
  modelName: string | null;
  promptVersion: string | null;
  unavailableReason?: string | null;
};

export type LogAnalyzerFallbackState = {
  used: boolean;
  providerId: "deterministic_rules";
  reason: string | null;
};

export type LogAnalyzerSourceFormat =
  | "structured_rows"
  | "autotuner_csv"
  | "generic_tabular_log"
  | "text_rows"
  | "empty"
  | "unsupported";

export type LogAnalyzerNormalizedInput = {
  hasLogData: boolean;
  sourceFormat: LogAnalyzerSourceFormat;
  wasTruncated: boolean;
  validRowCount: number;
  rejectedRowCount: number;
  invalidReason: string | null;
  invalidReasonMessage: LogAnalyzerMessage | null;
};

export type LogAnalyzerRange = {
  min: number;
  max: number;
};

export type LogAnalyzerPeakPoint = {
  rpm: number;
  torqueNm: number;
  kw: number;
  hp: number;
  ps: number;
};

export type LogAnalyzerSafeSummary = {
  validRowCount: number;
  rejectedRowCount: number;
  rpmRange: LogAnalyzerRange | null;
  torqueRangeNm: LogAnalyzerRange | null;
  estimatedPowerRangeHp: LogAnalyzerRange | null;
  averageTorqueNm: number | null;
  peakTorque: LogAnalyzerPeakPoint | null;
  peakPower: LogAnalyzerPeakPoint | null;
};

export type LogAnalyzerEvidenceSource =
  | "input_normalization"
  | "log_summary"
  | "vehicle_metadata"
  | "provider_state";

export type LogAnalyzerEvidenceType =
  | "valid_row_count"
  | "rpm_range"
  | "torque_range"
  | "peak_estimate"
  | "metadata_gap"
  | "provider_availability"
  | "input_validation";

export type LogAnalyzerSeverity = "info" | "caution" | "warning" | "critical";

export type LogAnalyzerEvidenceItem = {
  id: string;
  source: LogAnalyzerEvidenceSource;
  type: LogAnalyzerEvidenceType;
  severity: LogAnalyzerSeverity;
  text: string;
  message: LogAnalyzerMessage;
  customerSafe: true;
};

export type LogAnalyzerRiskFlagKind =
  | "insufficient_log_coverage"
  | "narrow_rpm_range"
  | "ecu_torque_estimate"
  | "dyno_equivalence_risk"
  | "missing_vehicle_context"
  | "provider_unavailable"
  | "invalid_input";

export type LogAnalyzerRiskFlag = {
  id: string;
  kind: LogAnalyzerRiskFlagKind;
  severity: LogAnalyzerSeverity;
  text: string;
  message: LogAnalyzerMessage;
  requiresHumanReview: boolean;
  customerSafe: true;
};

export type LogAnalyzerRecommendationCategory =
  | "missing_information"
  | "data_quality"
  | "expert_review"
  | "fallback_notice"
  | "human_review_gate";

export type LogAnalyzerRecommendation = {
  id: string;
  category: LogAnalyzerRecommendationCategory;
  priority: "normal" | "high";
  text: string;
  message: LogAnalyzerMessage;
  requiresHumanReview: boolean;
  customerSafe: true;
};

export type LogAnalyzerConfidenceReason = {
  id: string;
  confidence: LogAnalyzerConfidence;
  text: string;
  message: LogAnalyzerMessage;
  customerSafe: true;
};

export type LogAnalyzerHumanReview = {
  required: true;
  reason: string;
  reasonMessage: LogAnalyzerMessage;
  requiredBefore: string[];
  requiredBeforeMessages: LogAnalyzerMessage[];
};

export type LogAnalyzerResponse = {
  contractVersion: "log-analyzer-v1";
  status: LogAnalyzerResponseStatus;
  provider: LogAnalyzerProviderIdentity;
  fallback: LogAnalyzerFallbackState;
  isAiGenerated: boolean;
  readiness: LogAnalyzerReadiness;
  confidence: LogAnalyzerConfidence;
  confidenceReasons: LogAnalyzerConfidenceReason[];
  normalizedInput: LogAnalyzerNormalizedInput;
  summary: string;
  summaryMessage: LogAnalyzerMessage;
  logSummary: LogAnalyzerSafeSummary;
  evidence: LogAnalyzerEvidenceItem[];
  riskFlags: LogAnalyzerRiskFlag[];
  recommendations: LogAnalyzerRecommendation[];
  missingInformation: string[];
  missingInformationMessages: LogAnalyzerMessage[];
  humanReview: LogAnalyzerHumanReview;
  safetyBoundaries: string[];
  safetyBoundaryMessages: LogAnalyzerMessage[];
  blockedProductionActions: string[];
};

export interface LogAnalyzerProvider {
  readonly providerId: string;
  readonly providerKind: LogAnalyzerProviderKind;
  readonly modelName: string | null;
  analyzeLog(input: LogAnalyzerRequest): Promise<LogAnalyzerResponse>;
}
