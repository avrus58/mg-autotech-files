import { analyzeDtcText } from "@/lib/dtcAnalyzer";
import {
  getDtcAnalyzerAdminConfigStatus,
  type DtcAnalyzerAdminConfigStatus,
} from "@/lib/dtcAnalyzer/config";
import type {
  DtcAnalysisEvidenceItem,
  DtcAnalyzerConfidence,
  DtcAnalyzerRequest,
  DtcAnalyzerProviderKind,
  DtcAnalyzerProviderStatus,
  DtcAnalyzerRecommendation,
  DtcAnalyzerResponse,
  DtcConfidenceReason,
  DtcRiskFlag,
} from "@/lib/dtcAnalyzer/types";

export const requestDtcOrderSelect =
  "id, customer_id, vehicle_brand, vehicle_model, vehicle_engine, service_type, notes, ecu, gearbox, vehicle_year, read_method, hw_sw";

export type RequestDtcOrderContext = {
  id: string;
  customer_id?: string | null;
  vehicle_brand?: string | null;
  vehicle_model?: string | null;
  vehicle_engine?: string | null;
  service_type?: string | null;
  notes?: string | null;
  ecu?: string | null;
  gearbox?: string | null;
  vehicle_year?: string | null;
  read_method?: string | null;
  hw_sw?: string | null;
};

export type RequestDtcAnalysisState =
  | "no_request_text"
  | "no_valid_dtc"
  | "deterministic_fallback"
  | "provider_unavailable_fallback"
  | "provider_error_fallback"
  | "provider_unavailable"
  | "provider_success";

export type CustomerRequestDtcCode = {
  code: string;
  title: string;
  systemLabel: string;
  standardizationLabel: string;
  customerExplanation: string;
  confidence: DtcAnalyzerConfidence;
  evidence: DtcAnalysisEvidenceItem[];
  riskFlags: DtcRiskFlag[];
  recommendations: DtcAnalyzerRecommendation[];
  confidenceReasons: DtcConfidenceReason[];
};

export type CustomerRequestDtcAnalysis = {
  contractVersion: DtcAnalyzerResponse["contractVersion"];
  status: DtcAnalyzerResponse["status"];
  state: RequestDtcAnalysisState;
  stateLabel: string;
  summary: string;
  isAiGenerated: boolean;
  confidence: DtcAnalyzerConfidence;
  detectedCodes: string[];
  rejectedCodeLikeTokenCount: number;
  wasInputTruncated: boolean;
  providerNotice: string;
  codes: CustomerRequestDtcCode[];
  evidence: DtcAnalysisEvidenceItem[];
  riskFlags: DtcRiskFlag[];
  recommendations: DtcAnalyzerRecommendation[];
  confidenceReasons: DtcConfidenceReason[];
  missingInformation: string[];
  humanReview: DtcAnalyzerResponse["humanReview"];
  safetyBoundaries: string[];
};

export type ExpertRequestDtcAnalysis = CustomerRequestDtcAnalysis & {
  configuration: DtcAnalyzerAdminConfigStatus;
  provider: {
    providerKind: DtcAnalyzerProviderKind;
    providerStatus: DtcAnalyzerProviderStatus;
    promptVersion: string | null;
  };
  fallback: {
    used: boolean;
    reason: string | null;
  };
};

export type RequestDtcAnalysisProjection = {
  customer: CustomerRequestDtcAnalysis;
  expert: ExpertRequestDtcAnalysis;
  auditMetadata: Record<string, unknown>;
};

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export function requestDtcInputText(order: RequestDtcOrderContext) {
  return [
    textValue(order.service_type) ? `Service request: ${textValue(order.service_type)}` : "",
    textValue(order.notes) ? `Request notes: ${textValue(order.notes)}` : "",
    textValue(order.ecu) ? `ECU or TCU: ${textValue(order.ecu)}` : "",
    textValue(order.gearbox) ? `Gearbox: ${textValue(order.gearbox)}` : "",
    textValue(order.vehicle_year) ? `Vehicle year: ${textValue(order.vehicle_year)}` : "",
    textValue(order.read_method) ? `Read method: ${textValue(order.read_method)}` : "",
    textValue(order.hw_sw) ? `HW/SW: ${textValue(order.hw_sw)}` : "",
  ].filter(Boolean).join("\n");
}

export function buildRequestDtcAnalyzerRequest(
  order: RequestDtcOrderContext,
  source: "customer" | "admin"
): DtcAnalyzerRequest {
  return {
    source: source === "admin" ? "admin_text" : "request_brief",
    text: requestDtcInputText(order),
    vehicle: {
      brand: order.vehicle_brand,
      model: order.vehicle_model,
      engine: order.vehicle_engine,
      ecuType: order.ecu,
      readMethod: order.read_method,
    },
  };
}

function analysisState(response: DtcAnalyzerResponse): RequestDtcAnalysisState {
  if (!response.normalizedInput.hasText) return "no_request_text";
  if (response.normalizedInput.normalizedCodes.length === 0) return "no_valid_dtc";
  if (response.provider.providerStatus === "error" && response.fallback.used) return "provider_error_fallback";
  if (response.provider.providerStatus === "unavailable" && response.fallback.used) {
    return "provider_unavailable_fallback";
  }
  if (response.status === "provider_unavailable") return "provider_unavailable";
  if (response.fallback.used) return "deterministic_fallback";
  return "provider_success";
}

function stateLabel(state: RequestDtcAnalysisState) {
  if (state === "no_request_text") return "No request text is available for DTC analysis.";
  if (state === "no_valid_dtc") return "No valid DTC code was found in the current request fields.";
  if (state === "provider_error_fallback") return "DTC provider failed; deterministic non-AI guidance is shown.";
  if (state === "provider_unavailable_fallback") {
    return "DTC AI provider is unavailable; deterministic non-AI guidance is shown.";
  }
  if (state === "provider_unavailable") return "DTC analysis provider is unavailable.";
  if (state === "provider_success") return "DTC provider returned guidance; human review remains required.";
  return "Deterministic non-AI DTC guidance is shown.";
}

function providerNotice(response: DtcAnalyzerResponse, state: RequestDtcAnalysisState) {
  if (response.isAiGenerated) return "AI-assisted output. Human review remains required.";
  if (state === "provider_error_fallback") return "Provider failure is explicit; this is deterministic non-AI fallback output.";
  if (state === "provider_unavailable_fallback") {
    return "Provider unavailable state is explicit; this is deterministic non-AI fallback output.";
  }
  if (state === "provider_unavailable") return "Provider unavailable. No AI analysis was generated.";
  return "No AI output was generated. Human review remains required.";
}

function projectCustomer(response: DtcAnalyzerResponse): CustomerRequestDtcAnalysis {
  const state = analysisState(response);
  return {
    contractVersion: response.contractVersion,
    status: response.status,
    state,
    stateLabel: stateLabel(state),
    summary: response.summary,
    isAiGenerated: response.isAiGenerated,
    confidence: response.confidence,
    detectedCodes: response.normalizedInput.normalizedCodes,
    rejectedCodeLikeTokenCount: response.normalizedInput.rejectedCodeLikeTokens.length,
    wasInputTruncated: response.normalizedInput.wasTruncated,
    providerNotice: providerNotice(response, state),
    codes: response.codes.map((code) => ({
      code: code.code,
      title: code.title,
      systemLabel: code.systemLabel,
      standardizationLabel: code.standardizationLabel,
      customerExplanation: code.customerExplanation,
      confidence: code.confidence,
      evidence: code.evidence,
      riskFlags: code.riskFlags,
      recommendations: code.recommendations,
      confidenceReasons: code.confidenceReasons,
    })),
    evidence: response.evidence,
    riskFlags: response.riskFlags,
    recommendations: response.recommendations,
    confidenceReasons: response.confidenceReasons,
    missingInformation: response.missingInformation,
    humanReview: response.humanReview,
    safetyBoundaries: response.safetyBoundaries,
  };
}

function projectExpert(
  response: DtcAnalyzerResponse,
  configuration: DtcAnalyzerAdminConfigStatus
): ExpertRequestDtcAnalysis {
  return {
    ...projectCustomer(response),
    configuration,
    provider: {
      providerKind: response.provider.providerKind,
      providerStatus: response.provider.providerStatus,
      promptVersion: response.provider.promptVersion,
    },
    fallback: {
      used: response.fallback.used,
      reason: response.fallback.reason,
    },
  };
}

function auditMetadata(response: DtcAnalyzerResponse, source: "customer" | "admin") {
  return {
    source,
    contract_version: response.contractVersion,
    status: response.status,
    state: analysisState(response),
    is_ai_generated: response.isAiGenerated,
    confidence: response.confidence,
    detected_code_count: response.normalizedInput.normalizedCodes.length,
    detected_codes: response.normalizedInput.normalizedCodes,
    rejected_code_like_token_count: response.normalizedInput.rejectedCodeLikeTokens.length,
    input_was_truncated: response.normalizedInput.wasTruncated,
    provider_kind: response.provider.providerKind,
    provider_status: response.provider.providerStatus,
    fallback_used: response.fallback.used,
    provider_unavailable: response.provider.providerStatus === "unavailable",
    provider_error: response.provider.providerStatus === "error",
    analysis_success: response.status === "success" && response.isAiGenerated,
    evidence_count: response.evidence.length,
    risk_flag_count: response.riskFlags.length,
    recommendation_count: response.recommendations.length,
    missing_information_count: response.missingInformation.length,
    human_review_required: response.humanReview.required,
  };
}

export async function analyzeRequestDtc(
  order: RequestDtcOrderContext,
  source: "customer" | "admin",
  options: { configuration?: DtcAnalyzerAdminConfigStatus } = {}
): Promise<RequestDtcAnalysisProjection> {
  const response = await analyzeDtcText(buildRequestDtcAnalyzerRequest(order, source));
  const configuration = options.configuration ?? getDtcAnalyzerAdminConfigStatus(source);

  return {
    customer: projectCustomer(response),
    expert: projectExpert(response, configuration),
    auditMetadata: auditMetadata(response, source),
  };
}
