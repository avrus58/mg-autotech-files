import type {
  FileQualityScoreConfidenceReason,
  FileQualityScoreFactor,
  FileQualityScoreProviderKind,
  FileQualityScoreProviderStatus,
  FileQualityScoreRecommendation,
  FileQualityScoreResponse,
  FileQualityScoreRiskFlag,
  FileQualityScoreState,
} from "@/lib/fileQualityScore/types";

export type CustomerFileQualityScoreFactor = {
  id: FileQualityScoreFactor["id"];
  category: Exclude<FileQualityScoreFactor["category"], "provider_state">;
  label: string;
  score: number;
  status: FileQualityScoreFactor["status"];
  evidenceReasons: string[];
  missingInformation: string[];
};

export type CustomerFileQualityScoreProjection = {
  contractVersion: FileQualityScoreResponse["contractVersion"];
  status: FileQualityScoreResponse["status"];
  state: FileQualityScoreState;
  stateLabel: string;
  summary: string;
  isAiGenerated: boolean;
  score: number;
  grade: FileQualityScoreResponse["grade"];
  readiness: FileQualityScoreResponse["readiness"];
  confidence: FileQualityScoreResponse["confidence"];
  confidenceReasons: FileQualityScoreConfidenceReason[];
  analysisNotice: string;
  factorBreakdown: CustomerFileQualityScoreFactor[];
  evidenceReasons: string[];
  missingInformation: string[];
  riskFlags: FileQualityScoreRiskFlag[];
  recommendations: FileQualityScoreRecommendation[];
  humanReview: FileQualityScoreResponse["humanReview"];
  safetyBoundaries: string[];
  blockedCustomerActions: string[];
};

export type ExpertFileQualityScoreProjection = CustomerFileQualityScoreProjection & {
  provider: {
    providerId: string;
    providerKind: FileQualityScoreProviderKind;
    providerStatus: FileQualityScoreProviderStatus;
    modelName: string | null;
    promptVersion: string | null;
    unavailableReason: string | null;
  };
  fallback: {
    used: boolean;
    reason: string | null;
  };
  normalizedInput: FileQualityScoreResponse["normalizedInput"];
  weightedFactorBreakdown: FileQualityScoreFactor[];
  requiredHumanChecks: string[];
  blockedProductionActions: string[];
};

export type FileQualityScoreProjection = {
  customer: CustomerFileQualityScoreProjection;
  expert: ExpertFileQualityScoreProjection;
  auditMetadata: Record<string, unknown>;
};

const forbiddenCustomerKeyPatterns = [
  /^provider$/i,
  /^providerId$/i,
  /^providerKind$/i,
  /^providerStatus$/i,
  /^modelName$/i,
  /^promptVersion$/i,
  /^fallback$/i,
  /requestedName/i,
  /executedName/i,
  /storage/i,
  /path/i,
  /signed/i,
  /url/i,
  /sha/i,
  /hash/i,
  /binary/i,
  /raw/i,
  /hex/i,
  /offset/i,
  /fileName/i,
  /filename/i,
  /sample/i,
  /customer_id/i,
  /customerId/i,
  /user_id/i,
  /userId/i,
  /^admin/i,
];

function stateLabel(response: FileQualityScoreResponse) {
  if (response.state === "invalid_input") return "File Quality Score input is incomplete.";
  if (response.state === "provider_error_fallback") {
    return "Configured analysis failed; deterministic non-AI quality score is shown.";
  }
  if (response.state === "provider_unavailable_fallback") {
    return "AI quality analysis is unavailable; deterministic non-AI quality score is shown.";
  }
  if (response.state === "provider_unavailable") return "AI quality analysis is unavailable.";
  if (response.state === "provider_success") return "AI-assisted quality analysis returned; human review remains required.";
  return "Deterministic non-AI quality score is shown.";
}

function analysisNotice(response: FileQualityScoreResponse) {
  if (response.isAiGenerated) return "AI-assisted quality analysis. Human review remains required.";
  if (response.state === "invalid_input") return "No AI output was generated because the quality input is incomplete.";
  if (response.state === "provider_unavailable") return "No AI output was generated.";
  return "No AI output was generated. Deterministic quality scoring supports review only.";
}

function customerFactors(response: FileQualityScoreResponse): CustomerFileQualityScoreFactor[] {
  return response.factorBreakdown
    .filter((factor) => factor.category !== "provider_state")
    .map((factor) => ({
      id: factor.id,
      category: factor.category as CustomerFileQualityScoreFactor["category"],
      label: factor.label,
      score: factor.score,
      status: factor.status,
      evidenceReasons: factor.evidenceReasons,
      missingInformation: factor.missingInformation,
    }));
}

function customerRiskFlags(response: FileQualityScoreResponse): FileQualityScoreRiskFlag[] {
  return response.riskFlags.map((flag) =>
    flag.kind === "provider_unavailable"
      ? {
          ...flag,
          text: "Analysis source state prevents treating this result as AI-generated quality analysis.",
        }
      : flag
  );
}

function projectCustomer(response: FileQualityScoreResponse): CustomerFileQualityScoreProjection {
  return {
    contractVersion: response.contractVersion,
    status: response.status,
    state: response.state,
    stateLabel: stateLabel(response),
    summary: response.summary,
    isAiGenerated: response.isAiGenerated,
    score: response.score,
    grade: response.grade,
    readiness: response.readiness,
    confidence: response.confidence,
    confidenceReasons: response.confidenceReasons,
    analysisNotice: analysisNotice(response),
    factorBreakdown: customerFactors(response),
    evidenceReasons: response.evidenceReasons,
    missingInformation: response.missingInformation,
    riskFlags: customerRiskFlags(response),
    recommendations: response.recommendations,
    humanReview: response.humanReview,
    safetyBoundaries: response.safetyBoundaries,
    blockedCustomerActions: [
      "write_ready_file_export",
      "checksum_approval",
      "automatic_delivery",
    ],
  };
}

function projectExpert(response: FileQualityScoreResponse): ExpertFileQualityScoreProjection {
  const customer = projectCustomer(response);
  return {
    ...customer,
    provider: {
      providerId: response.provider.providerId,
      providerKind: response.provider.providerKind,
      providerStatus: response.provider.providerStatus,
      modelName: response.provider.modelName,
      promptVersion: response.provider.promptVersion,
      unavailableReason: response.provider.unavailableReason ?? null,
    },
    fallback: {
      used: response.fallback.used,
      reason: response.fallback.reason,
    },
    normalizedInput: response.normalizedInput,
    weightedFactorBreakdown: response.factorBreakdown,
    requiredHumanChecks: response.humanReview.requiredBefore,
    blockedProductionActions: response.blockedProductionActions,
  };
}

function auditMetadata(response: FileQualityScoreResponse) {
  return {
    contract_version: response.contractVersion,
    status: response.status,
    state: response.state,
    is_ai_generated: response.isAiGenerated,
    score: response.score,
    grade: response.grade,
    readiness: response.readiness,
    confidence: response.confidence,
    metadata_field_count: response.normalizedInput.metadataFieldCount,
    analyzer_result_present: response.normalizedInput.hasAnalyzerResult,
    service_context_present: response.normalizedInput.serviceContextPresent,
    review_context_present: response.normalizedInput.reviewContextPresent,
    provider_kind: response.provider.providerKind,
    provider_status: response.provider.providerStatus,
    fallback_used: response.fallback.used,
    factor_count: response.factorBreakdown.length,
    risk_flag_count: response.riskFlags.length,
    missing_information_count: response.missingInformation.length,
    blocked_production_action_count: response.blockedProductionActions.length,
    human_review_required: response.humanReview.required,
  };
}

export function projectFileQualityScoreResponse(response: FileQualityScoreResponse): FileQualityScoreProjection {
  return {
    customer: projectCustomer(response),
    expert: projectExpert(response),
    auditMetadata: auditMetadata(response),
  };
}

export function hasFileQualityScoreCustomerLeak(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasFileQualityScoreCustomerLeak);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value as Record<string, unknown>).some(
    ([key, entry]) =>
      forbiddenCustomerKeyPatterns.some((pattern) => pattern.test(key)) ||
      hasFileQualityScoreCustomerLeak(entry)
  );
}
