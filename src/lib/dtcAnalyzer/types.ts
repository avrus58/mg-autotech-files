export type DtcAnalyzerInputSource = "customer_text" | "admin_text" | "request_brief" | "local_test";

export type DtcAnalyzerProviderKind = "deterministic_rules" | "external_ai" | "mock" | "unconfigured";

export type DtcAnalyzerProviderStatus = "ready" | "unavailable" | "error";

export type DtcAnalyzerResponseStatus =
  | "success"
  | "fallback"
  | "invalid_input"
  | "provider_unavailable";

export type DtcAnalyzerConfidence = "none" | "low" | "medium" | "high";

export type DtcSystem = "powertrain" | "chassis" | "body" | "network";

export type DtcStandardization =
  | "sae_or_iso_generic"
  | "manufacturer_specific"
  | "mixed_or_reserved";

export type DtcAnalyzerVehicleContext = {
  brand?: string | null;
  model?: string | null;
  engine?: string | null;
  ecuType?: string | null;
  ecuFamily?: string | null;
  readMethod?: string | null;
};

export type DtcAnalyzerRequest = {
  source: DtcAnalyzerInputSource;
  text: string;
  vehicle?: DtcAnalyzerVehicleContext | null;
};

export type DtcAnalyzerNormalizedInput = {
  hasText: boolean;
  wasTruncated: boolean;
  normalizedCodes: string[];
  rejectedCodeLikeTokens: string[];
  invalidReason: string | null;
};

export type DtcAnalyzerProviderIdentity = {
  providerId: string;
  providerKind: DtcAnalyzerProviderKind;
  providerStatus: DtcAnalyzerProviderStatus;
  modelName: string | null;
  promptVersion: string | null;
  unavailableReason?: string | null;
};

export type DtcAnalyzerFallbackState = {
  used: boolean;
  providerId: "deterministic_rules";
  reason: string | null;
};

export type DtcAnalysisEvidenceSource =
  | "input_normalization"
  | "local_known_profile"
  | "deterministic_code_family"
  | "provider_state";

export type DtcAnalysisEvidenceType =
  | "dtc_code_detected"
  | "known_code_context"
  | "system_family"
  | "standardization_scope"
  | "input_validation"
  | "provider_availability";

export type DtcAnalysisSeverity = "info" | "caution" | "warning" | "critical";

export type DtcAnalysisEvidenceItem = {
  id: string;
  code: string | null;
  source: DtcAnalysisEvidenceSource;
  type: DtcAnalysisEvidenceType;
  severity: DtcAnalysisSeverity;
  text: string;
  customerSafe: true;
};

export type DtcRiskFlagKind =
  | "diagnostic_uncertainty"
  | "insufficient_context"
  | "safety_relevance"
  | "emissions_or_legal_review"
  | "network_or_module_review"
  | "provider_unavailable";

export type DtcRiskFlag = {
  id: string;
  code: string | null;
  kind: DtcRiskFlagKind;
  severity: DtcAnalysisSeverity;
  text: string;
  requiresHumanReview: boolean;
  customerSafe: true;
};

export type DtcRecommendationCategory =
  | "diagnostic_check"
  | "missing_information"
  | "human_review_gate";

export type DtcAnalyzerRecommendation = {
  id: string;
  code: string | null;
  category: DtcRecommendationCategory;
  priority: "normal" | "high";
  text: string;
  requiresHumanReview: boolean;
  customerSafe: true;
};

export type DtcConfidenceReason = {
  id: string;
  code: string | null;
  confidence: DtcAnalyzerConfidence;
  text: string;
  customerSafe: true;
};

export type DtcCodeAnalysis = {
  code: string;
  system: DtcSystem;
  systemLabel: string;
  standardization: DtcStandardization;
  standardizationLabel: string;
  title: string;
  likelyDiagnosticContext: string[];
  customerExplanation: string;
  recommendedChecks: string[];
  missingInformation: string[];
  confidence: DtcAnalyzerConfidence;
  confidenceReasons: DtcConfidenceReason[];
  evidence: DtcAnalysisEvidenceItem[];
  riskFlags: DtcRiskFlag[];
  recommendations: DtcAnalyzerRecommendation[];
  uncertainty: string[];
};

export type DtcAnalyzerHumanReview = {
  required: true;
  reason: string;
  requiredBefore: string[];
};

export type DtcAnalyzerResponse = {
  contractVersion: "dtc-analyzer-v1";
  status: DtcAnalyzerResponseStatus;
  provider: DtcAnalyzerProviderIdentity;
  fallback: DtcAnalyzerFallbackState;
  isAiGenerated: boolean;
  confidence: DtcAnalyzerConfidence;
  confidenceReasons: DtcConfidenceReason[];
  normalizedInput: DtcAnalyzerNormalizedInput;
  summary: string;
  codes: DtcCodeAnalysis[];
  evidence: DtcAnalysisEvidenceItem[];
  riskFlags: DtcRiskFlag[];
  recommendations: DtcAnalyzerRecommendation[];
  missingInformation: string[];
  humanReview: DtcAnalyzerHumanReview;
  safetyBoundaries: string[];
};

export interface DtcAnalyzerProvider {
  readonly providerId: string;
  readonly providerKind: DtcAnalyzerProviderKind;
  readonly modelName: string | null;
  analyzeDtc(input: DtcAnalyzerRequest): Promise<DtcAnalyzerResponse>;
}
