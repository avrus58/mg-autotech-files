import type { FileExpertAnalyzerResult } from "@/lib/fileExpert/types";

export type FileQualityScoreInputSource =
  | "file_expert_result"
  | "request_metadata"
  | "customer_request"
  | "admin_request"
  | "local_test";

export type FileQualityScoreProviderKind = "deterministic_rules" | "external_ai" | "mock" | "unconfigured";

export type FileQualityScoreProviderStatus = "ready" | "unavailable" | "error";

export type FileQualityScoreResponseStatus =
  | "success"
  | "fallback"
  | "invalid_input"
  | "provider_unavailable";

export type FileQualityScoreState =
  | "provider_success"
  | "deterministic_fallback"
  | "provider_unavailable"
  | "provider_unavailable_fallback"
  | "provider_error_fallback"
  | "invalid_input";

export type FileQualityScoreGrade = "A" | "B" | "C" | "D" | "F" | "not_scorable";

export type FileQualityScoreReadiness =
  | "unavailable"
  | "blocked"
  | "needs_information"
  | "needs_expert_review"
  | "ready_for_expert_review";

export type FileQualityScoreConfidence = "none" | "low" | "medium" | "high";

export type FileQualityScoreMetadata = {
  brand?: string | null;
  model?: string | null;
  engine?: string | null;
  ecuType?: string | null;
  ecuFamily?: string | null;
  readMethod?: string | null;
  hwSw?: string | null;
};

export type FileQualityScoreServiceContext = {
  serviceSummary?: string | null;
  requestedServiceLabels?: string[] | null;
  selectedOptionLabels?: string[] | null;
  customerNotesPresent?: boolean | null;
};

export type FileQualityScoreReviewContext = {
  qualityCheckStatus?: string | null;
  deliveryStatus?: string | null;
  paymentReviewStatus?: string | null;
  reviewBlockers?: string[] | null;
  humanReviewStatus?: "pending" | "in_review" | "approved" | "rejected" | null;
};

export type FileQualityScoreRequest = {
  source: FileQualityScoreInputSource;
  analyzerResult?: FileExpertAnalyzerResult | null;
  metadata?: FileQualityScoreMetadata | null;
  service?: FileQualityScoreServiceContext | null;
  review?: FileQualityScoreReviewContext | null;
  privateMetadata?: Record<string, unknown> | null;
};

export type FileQualityScoreProviderIdentity = {
  providerId: string;
  providerKind: FileQualityScoreProviderKind;
  providerStatus: FileQualityScoreProviderStatus;
  modelName: string | null;
  promptVersion: string | null;
  unavailableReason?: string | null;
};

export type FileQualityScoreFallbackState = {
  used: boolean;
  providerId: "deterministic_rules";
  reason: string | null;
};

export type FileQualityScoreNormalizedInput = {
  hasAnalyzerResult: boolean;
  metadataFieldCount: number;
  serviceContextPresent: boolean;
  reviewContextPresent: boolean;
  invalidReason: string | null;
};

export type FileQualityScoreFactorCategory =
  | "metadata"
  | "file_evidence"
  | "integrity"
  | "analysis"
  | "service_context"
  | "review_gate"
  | "provider_state";

export type FileQualityScoreFactorStatus = "positive" | "caution" | "warning" | "critical" | "missing";

export type FileQualityScoreFactor = {
  id:
    | "metadata_completeness"
    | "file_evidence"
    | "integrity_compatibility"
    | "analysis_confidence"
    | "service_context"
    | "review_gate"
    | "provider_state";
  category: FileQualityScoreFactorCategory;
  label: string;
  weight: number;
  score: number;
  status: FileQualityScoreFactorStatus;
  evidenceReasons: string[];
  missingInformation: string[];
  customerSafe: true;
};

export type FileQualityScoreRiskFlagKind =
  | "missing_metadata"
  | "insufficient_file_evidence"
  | "integrity_mismatch"
  | "high_risk_file"
  | "review_blocker"
  | "provider_unavailable"
  | "invalid_input";

export type FileQualityScoreSeverity = "info" | "caution" | "warning" | "critical";

export type FileQualityScoreRiskFlag = {
  id: string;
  kind: FileQualityScoreRiskFlagKind;
  severity: FileQualityScoreSeverity;
  text: string;
  requiresHumanReview: boolean;
  customerSafe: true;
};

export type FileQualityScoreRecommendationCategory =
  | "missing_information"
  | "file_evidence"
  | "expert_review"
  | "fallback_notice"
  | "human_review_gate";

export type FileQualityScoreRecommendation = {
  id: string;
  category: FileQualityScoreRecommendationCategory;
  priority: "normal" | "high";
  text: string;
  requiresHumanReview: boolean;
  customerSafe: true;
};

export type FileQualityScoreConfidenceReason = {
  id: string;
  confidence: FileQualityScoreConfidence;
  text: string;
  customerSafe: true;
};

export type FileQualityScoreHumanReview = {
  required: true;
  reason: string;
  requiredBefore: string[];
};

export type FileQualityScoreResponse = {
  contractVersion: "file-quality-score-v1";
  status: FileQualityScoreResponseStatus;
  state: FileQualityScoreState;
  provider: FileQualityScoreProviderIdentity;
  fallback: FileQualityScoreFallbackState;
  isAiGenerated: boolean;
  normalizedInput: FileQualityScoreNormalizedInput;
  score: number;
  grade: FileQualityScoreGrade;
  readiness: FileQualityScoreReadiness;
  confidence: FileQualityScoreConfidence;
  confidenceReasons: FileQualityScoreConfidenceReason[];
  summary: string;
  factorBreakdown: FileQualityScoreFactor[];
  evidenceReasons: string[];
  missingInformation: string[];
  riskFlags: FileQualityScoreRiskFlag[];
  recommendations: FileQualityScoreRecommendation[];
  humanReview: FileQualityScoreHumanReview;
  safetyBoundaries: string[];
  blockedProductionActions: string[];
};

export interface FileQualityScoreProvider {
  readonly providerId: string;
  readonly providerKind: FileQualityScoreProviderKind;
  readonly modelName: string | null;
  scoreFileQuality(input: FileQualityScoreRequest): Promise<FileQualityScoreResponse>;
}
