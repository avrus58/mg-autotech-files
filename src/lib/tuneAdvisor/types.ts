export type TuneAdvisorInputSource =
  | "customer_request"
  | "admin_request"
  | "desktop_request"
  | "request_brief"
  | "local_test";

export type TuneAdvisorProviderKind = "deterministic_rules" | "external_ai" | "mock" | "unconfigured";

export type TuneAdvisorProviderStatus = "ready" | "unavailable" | "error";

export type TuneAdvisorResponseStatus =
  | "success"
  | "fallback"
  | "invalid_input"
  | "provider_unavailable";

export type TuneAdvisorConfidence = "none" | "low" | "medium" | "high";

export type TuneAdvisorReadiness =
  | "blocked"
  | "needs_metadata"
  | "human_review_required"
  | "evidence_supported_review";

export type TuneAdvisorVehicleContext = {
  brand?: string | null;
  model?: string | null;
  engine?: string | null;
  vehicleYear?: string | null;
  ecuType?: string | null;
  ecuFamily?: string | null;
  gearbox?: string | null;
  readMethod?: string | null;
  hwSw?: string | null;
};

export type TuneAdvisorServiceContext = {
  primaryServiceId?: string | null;
  primaryServiceLabel?: string | null;
  extraServiceIds?: string[] | null;
  extraServiceLabels?: string[] | null;
  serviceSummary?: string | null;
  notes?: string | null;
  evidenceCount?: number | null;
  highQualityEvidenceCount?: number | null;
  mapDefinitionsAvailable?: boolean | null;
};

export type TuneAdvisorRequest = {
  source: TuneAdvisorInputSource;
  vehicle?: TuneAdvisorVehicleContext | null;
  services?: TuneAdvisorServiceContext | null;
};

export type TuneAdvisorProviderIdentity = {
  providerId: string;
  providerKind: TuneAdvisorProviderKind;
  providerStatus: TuneAdvisorProviderStatus;
  modelName: string | null;
  promptVersion: string | null;
  unavailableReason?: string | null;
};

export type TuneAdvisorFallbackState = {
  used: boolean;
  providerId: "deterministic_rules";
  reason: string | null;
};

export type TuneAdvisorNormalizedService = {
  hasServiceContext: boolean;
  primary:
    | {
        id: string;
        label: string;
        source: "id" | "label" | "summary";
      }
    | null;
  extras: Array<{
    id: string;
    label: string;
    categoryId: string;
    categoryTitle: string;
    source: "id" | "label" | "summary";
  }>;
  serviceSummaryPresent: boolean;
  notesPresent: boolean;
  invalidReason: string | null;
};

export type TuneAdvisorEvidenceSource =
  | "request_service_metadata"
  | "vehicle_metadata"
  | "deterministic_rules"
  | "provider_state";

export type TuneAdvisorEvidenceType =
  | "primary_service"
  | "extra_service"
  | "vehicle_context"
  | "metadata_gap"
  | "provider_availability";

export type TuneAdvisorSeverity = "info" | "caution" | "warning" | "critical";

export type TuneAdvisorEvidenceItem = {
  id: string;
  source: TuneAdvisorEvidenceSource;
  type: TuneAdvisorEvidenceType;
  severity: TuneAdvisorSeverity;
  text: string;
  customerSafe: true;
};

export type TuneAdvisorRiskFlagKind =
  | "insufficient_metadata"
  | "no_file_evidence"
  | "stage_calibration_review"
  | "tcu_review"
  | "advanced_service_review"
  | "emissions_or_legal_review"
  | "diagnostic_uncertainty"
  | "checksum_not_approved"
  | "driveability_or_safety_review"
  | "security_authorization_review"
  | "provider_unavailable";

export type TuneAdvisorRiskFlag = {
  id: string;
  kind: TuneAdvisorRiskFlagKind;
  severity: TuneAdvisorSeverity;
  text: string;
  requiresHumanReview: boolean;
  customerSafe: true;
};

export type TuneAdvisorRecommendationCategory =
  | "metadata_required"
  | "service_scope_review"
  | "expert_check"
  | "risk_review"
  | "fallback_notice"
  | "human_review_gate";

export type TuneAdvisorRecommendation = {
  id: string;
  category: TuneAdvisorRecommendationCategory;
  priority: "normal" | "high";
  text: string;
  requiresHumanReview: boolean;
  customerSafe: true;
};

export type TuneAdvisorConfidenceReason = {
  id: string;
  confidence: TuneAdvisorConfidence;
  text: string;
  customerSafe: true;
};

export type TuneAdvisorGuidanceCategory =
  | "stage_calibration"
  | "eco_calibration"
  | "tcu_calibration"
  | "options_only"
  | "original_file"
  | "advanced_service_context";

export type TuneAdvisorGuidanceItem = {
  id: string;
  category: TuneAdvisorGuidanceCategory;
  title: string;
  summary: string;
  missingInformation: string[];
  requiredHumanChecks: string[];
  customerSafe: true;
};

export type TuneAdvisorHumanReview = {
  required: true;
  reason: string;
  requiredBefore: string[];
};

export type TuneAdvisorResponse = {
  contractVersion: "tune-advisor-v1";
  status: TuneAdvisorResponseStatus;
  provider: TuneAdvisorProviderIdentity;
  fallback: TuneAdvisorFallbackState;
  isAiGenerated: boolean;
  readiness: TuneAdvisorReadiness;
  confidence: TuneAdvisorConfidence;
  confidenceReasons: TuneAdvisorConfidenceReason[];
  normalizedService: TuneAdvisorNormalizedService;
  summary: string;
  guidance: TuneAdvisorGuidanceItem[];
  evidence: TuneAdvisorEvidenceItem[];
  riskFlags: TuneAdvisorRiskFlag[];
  recommendations: TuneAdvisorRecommendation[];
  missingInformation: string[];
  humanReview: TuneAdvisorHumanReview;
  safetyBoundaries: string[];
  blockedProductionActions: string[];
};

export interface TuneAdvisorProvider {
  readonly providerId: string;
  readonly providerKind: TuneAdvisorProviderKind;
  readonly modelName: string | null;
  analyzeTuneRequest(input: TuneAdvisorRequest): Promise<TuneAdvisorResponse>;
}
