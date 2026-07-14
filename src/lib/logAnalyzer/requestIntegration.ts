import { analyzeLogRequest } from "@/lib/logAnalyzer/service";
import type {
  LogAnalyzerConfidence,
  LogAnalyzerConfidenceReason,
  LogAnalyzerEvidenceItem,
  LogAnalyzerInputRow,
  LogAnalyzerProviderKind,
  LogAnalyzerProviderStatus,
  LogAnalyzerRecommendation,
  LogAnalyzerRequest,
  LogAnalyzerResponse,
  LogAnalyzerRiskFlag,
  LogAnalyzerSafeSummary,
} from "@/lib/logAnalyzer/types";

export type RequestLogAnalyzerContext = {
  id: string;
  customer_id?: string | null;
  vehicle_brand?: string | null;
  vehicle_model?: string | null;
  vehicle_engine?: string | null;
  ecu?: string | null;
  read_method?: string | null;
  gearbox?: string | null;
  logText?: string | null;
  logRows?: LogAnalyzerInputRow[] | null;
  fileName?: string | null;
  notes?: string | null;
};

export type RequestLogAnalyzerState =
  | "no_log_data"
  | "deterministic_fallback"
  | "provider_unavailable_fallback"
  | "provider_error_fallback"
  | "provider_unavailable"
  | "provider_success";

export type CustomerRequestLogAnalyzerAnalysis = {
  contractVersion: LogAnalyzerResponse["contractVersion"];
  status: LogAnalyzerResponse["status"];
  state: RequestLogAnalyzerState;
  stateLabel: string;
  summary: string;
  isAiGenerated: boolean;
  readiness: LogAnalyzerResponse["readiness"];
  confidence: LogAnalyzerConfidence;
  confidenceReasons: LogAnalyzerConfidenceReason[];
  providerNotice: string;
  logSummary: LogAnalyzerSafeSummary;
  evidence: LogAnalyzerEvidenceItem[];
  riskFlags: LogAnalyzerRiskFlag[];
  recommendations: LogAnalyzerRecommendation[];
  missingInformation: string[];
  humanReview: LogAnalyzerResponse["humanReview"];
  safetyBoundaries: string[];
  blockedCustomerActions: string[];
};

export type ExpertRequestLogAnalyzerAnalysis = CustomerRequestLogAnalyzerAnalysis & {
  provider: {
    providerKind: LogAnalyzerProviderKind;
    providerStatus: LogAnalyzerProviderStatus;
    promptVersion: string | null;
  };
  fallback: {
    used: boolean;
    reason: string | null;
  };
  normalizedInput: LogAnalyzerResponse["normalizedInput"];
  blockedProductionActions: string[];
  requiredHumanChecks: string[];
};

export type RequestLogAnalyzerProjection = {
  customer: CustomerRequestLogAnalyzerAnalysis;
  expert: ExpertRequestLogAnalyzerAnalysis;
  auditMetadata: Record<string, unknown>;
};

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export function buildRequestLogAnalyzerRequest(
  context: RequestLogAnalyzerContext,
  source: "customer" | "admin"
): LogAnalyzerRequest {
  return {
    source: source === "admin" ? "admin_request" : "customer_request",
    text: context.logText,
    rows: context.logRows,
    fileName: context.fileName,
    notes: context.notes,
    vehicle: {
      brand: context.vehicle_brand,
      model: context.vehicle_model,
      engine: context.vehicle_engine,
      ecuType: context.ecu,
      readMethod: context.read_method,
      gearbox: context.gearbox,
    },
  };
}

function analysisState(response: LogAnalyzerResponse): RequestLogAnalyzerState {
  if (!response.normalizedInput.hasLogData) return "no_log_data";
  if (response.provider.providerStatus === "error" && response.fallback.used) return "provider_error_fallback";
  if (response.provider.providerStatus === "unavailable" && response.fallback.used) {
    return "provider_unavailable_fallback";
  }
  if (response.status === "provider_unavailable") return "provider_unavailable";
  if (response.fallback.used) return "deterministic_fallback";
  return "provider_success";
}

function stateLabel(state: RequestLogAnalyzerState) {
  if (state === "no_log_data") return "No valid log data is available for Log Analyzer.";
  if (state === "provider_error_fallback") return "Log Analyzer provider failed; deterministic non-AI summary is shown.";
  if (state === "provider_unavailable_fallback") {
    return "Log Analyzer provider is unavailable; deterministic non-AI summary is shown.";
  }
  if (state === "provider_unavailable") return "Log Analyzer provider is unavailable.";
  if (state === "provider_success") return "Log Analyzer provider returned analysis; human review remains required.";
  return "Deterministic non-AI Log Analyzer summary is shown.";
}

function providerNotice(response: LogAnalyzerResponse, state: RequestLogAnalyzerState) {
  if (response.isAiGenerated) return "AI-assisted output. Human review remains required.";
  if (state === "provider_error_fallback") return "Provider failure is explicit; this is deterministic non-AI fallback output.";
  if (state === "provider_unavailable_fallback") {
    return "Provider unavailable state is explicit; this is deterministic non-AI fallback output.";
  }
  if (state === "provider_unavailable") return "Provider unavailable. No AI log analysis was generated.";
  return "No AI output was generated. Human review remains required.";
}

function projectCustomer(response: LogAnalyzerResponse): CustomerRequestLogAnalyzerAnalysis {
  const state = analysisState(response);
  return {
    contractVersion: response.contractVersion,
    status: response.status,
    state,
    stateLabel: stateLabel(state),
    summary: response.summary,
    isAiGenerated: response.isAiGenerated,
    readiness: response.readiness,
    confidence: response.confidence,
    confidenceReasons: response.confidenceReasons,
    providerNotice: providerNotice(response, state),
    logSummary: response.logSummary,
    evidence: response.evidence,
    riskFlags: response.riskFlags,
    recommendations: response.recommendations,
    missingInformation: response.missingInformation,
    humanReview: response.humanReview,
    safetyBoundaries: response.safetyBoundaries,
    blockedCustomerActions: [
      "write_ready_file_export",
      "checksum_approval",
      "automatic_delivery",
      "exact_gain_claim",
    ],
  };
}

function uniqueInOrder(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function projectExpert(response: LogAnalyzerResponse): ExpertRequestLogAnalyzerAnalysis {
  const customer = projectCustomer(response);
  return {
    ...customer,
    provider: {
      providerKind: response.provider.providerKind,
      providerStatus: response.provider.providerStatus,
      promptVersion: response.provider.promptVersion,
    },
    fallback: {
      used: response.fallback.used,
      reason: response.fallback.reason,
    },
    normalizedInput: response.normalizedInput,
    blockedProductionActions: response.blockedProductionActions,
    requiredHumanChecks: uniqueInOrder(response.humanReview.requiredBefore),
  };
}

function auditMetadata(response: LogAnalyzerResponse, context: RequestLogAnalyzerContext, source: "customer" | "admin") {
  const summary = response.logSummary;
  return {
    source,
    request_id: textValue(context.id),
    contract_version: response.contractVersion,
    status: response.status,
    state: analysisState(response),
    is_ai_generated: response.isAiGenerated,
    readiness: response.readiness,
    confidence: response.confidence,
    source_format: response.normalizedInput.sourceFormat,
    valid_row_count: summary.validRowCount,
    rejected_row_count: summary.rejectedRowCount,
    rpm_min: summary.rpmRange?.min ?? null,
    rpm_max: summary.rpmRange?.max ?? null,
    peak_torque_nm: summary.peakTorque?.torqueNm ?? null,
    peak_power_hp: summary.peakPower?.hp ?? null,
    provider_kind: response.provider.providerKind,
    provider_status: response.provider.providerStatus,
    fallback_used: response.fallback.used,
    provider_unavailable: response.provider.providerStatus === "unavailable",
    provider_error: response.provider.providerStatus === "error",
    evidence_count: response.evidence.length,
    risk_flag_count: response.riskFlags.length,
    recommendation_count: response.recommendations.length,
    missing_information_count: response.missingInformation.length,
    blocked_production_action_count: response.blockedProductionActions.length,
    human_review_required: response.humanReview.required,
  };
}

export function projectLogAnalyzerResponse(
  response: LogAnalyzerResponse,
  context: RequestLogAnalyzerContext,
  source: "customer" | "admin"
): RequestLogAnalyzerProjection {
  return {
    customer: projectCustomer(response),
    expert: projectExpert(response),
    auditMetadata: auditMetadata(response, context, source),
  };
}

export async function analyzeRequestLog(
  context: RequestLogAnalyzerContext,
  source: "customer" | "admin"
): Promise<RequestLogAnalyzerProjection> {
  const response = await analyzeLogRequest(buildRequestLogAnalyzerRequest(context, source));

  return projectLogAnalyzerResponse(response, context, source);
}
