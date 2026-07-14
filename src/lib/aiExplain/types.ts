export type AiExplainSurface =
  | "dtc_analyzer"
  | "tune_advisor"
  | "log_analyzer"
  | "file_expert"
  | "request_recommendation"
  | "local_test";

export type AiExplainProviderKind = "deterministic_rules" | "external_ai" | "mock" | "unconfigured";

export type AiExplainProviderStatus = "ready" | "unavailable" | "error";

export type AiExplainResponseStatus =
  | "success"
  | "fallback"
  | "invalid_input"
  | "provider_unavailable";

export type AiExplainLayerState =
  | "provider_success"
  | "deterministic_fallback"
  | "provider_unavailable"
  | "provider_unavailable_fallback"
  | "provider_error_fallback"
  | "invalid_input";

export type AiExplainReadiness =
  | "unavailable"
  | "blocked"
  | "fallback_ready"
  | "human_review_required"
  | "provider_generated_review";

export type AiExplainConfidence = "none" | "low" | "medium" | "high";

export type AiExplainSourceCategory =
  | "customer_input"
  | "vehicle_metadata"
  | "request_service_metadata"
  | "diagnostic_evidence"
  | "log_summary"
  | "file_analysis_summary"
  | "provider_state"
  | "deterministic_rules"
  | "human_review"
  | "safety_boundary"
  | "unavailable_state";

export type AiExplainSourceLabelKind =
  | "evidence"
  | "recommendation"
  | "risk_flag"
  | "human_review_gate"
  | "provider_state"
  | "fallback_state";

export type AiExplainSeverity = "info" | "caution" | "warning" | "critical";

export type AiExplainTrustLevel =
  | "direct_input"
  | "derived_summary"
  | "deterministic_rule"
  | "provider_state"
  | "review_gate";

export type AiExplainInputItem = {
  id: string;
  kind: Exclude<AiExplainSourceLabelKind, "provider_state" | "fallback_state">;
  source: AiExplainSourceCategory;
  severity?: AiExplainSeverity;
  requiresHumanReview?: boolean;
  customerSafe?: boolean;
  title?: string | null;
};

export type AiExplainSourceLabel = {
  id: string;
  itemKind: AiExplainSourceLabelKind;
  sourceCategory: AiExplainSourceCategory;
  label: string;
  description: string;
  severity: AiExplainSeverity;
  trustLevel: AiExplainTrustLevel;
  customerVisible: boolean;
  requiresHumanReview: boolean;
};

export type AiExplainProviderIdentity = {
  providerId: string;
  providerKind: AiExplainProviderKind;
  providerStatus: AiExplainProviderStatus;
  modelName: string | null;
  promptVersion: string | null;
  unavailableReason?: string | null;
};

export type AiExplainFallbackState = {
  used: boolean;
  providerId: "deterministic_rules";
  reason: string | null;
};

export type AiExplainUnavailableState = {
  unavailable: boolean;
  reason: string | null;
  customerMessage: string;
  expertMessage: string | null;
};

export type AiExplainHumanReview = {
  required: true;
  reason: string;
  requiredBefore: string[];
};

export type AiExplainCard = {
  id: string;
  title: string;
  summary: string;
  sourceLabelIds: string[];
  severity: AiExplainSeverity;
  requiresHumanReview: boolean;
  customerSafe: true;
};

export type AiExplainRequest = {
  surface: AiExplainSurface;
  subject: string;
  items: AiExplainInputItem[];
  context?: {
    vehiclePresent?: boolean | null;
    fileEvidencePresent?: boolean | null;
    logEvidencePresent?: boolean | null;
    diagnosticEvidencePresent?: boolean | null;
    serviceMetadataPresent?: boolean | null;
  } | null;
  privateMetadata?: Record<string, unknown> | null;
};

export type AiExplainLayerResponse = {
  contractVersion: "ai-explain-layer-v1";
  surface: AiExplainSurface;
  subject: string;
  status: AiExplainResponseStatus;
  state: AiExplainLayerState;
  provider: AiExplainProviderIdentity;
  fallback: AiExplainFallbackState;
  isAiGenerated: boolean;
  readiness: AiExplainReadiness;
  confidence: AiExplainConfidence;
  summary: string;
  sourceLabels: AiExplainSourceLabel[];
  explanationCards: AiExplainCard[];
  unavailableState: AiExplainUnavailableState;
  humanReview: AiExplainHumanReview;
  safetyBoundaries: string[];
  blockedProductionActions: string[];
  privateInputRedacted: true;
};

export interface AiExplainProvider {
  readonly providerId: string;
  readonly providerKind: AiExplainProviderKind;
  readonly modelName: string | null;
  explain(input: AiExplainRequest): Promise<AiExplainLayerResponse>;
}
