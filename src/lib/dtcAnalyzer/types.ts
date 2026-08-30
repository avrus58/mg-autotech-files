export type DtcAnalyzerInputSource = "customer_text" | "admin_text" | "request_brief" | "local_test";

export type DtcAnalyzerProviderKind = "deterministic_rules" | "external_ai" | "mock" | "unconfigured";

export type DtcAnalyzerProviderStatus = "ready" | "unavailable" | "error";

export type DtcAnalyzerResponseStatus =
  | "success"
  | "fallback"
  | "invalid_input"
  | "provider_unavailable";

export type DtcAnalyzerConfidence = "none" | "low" | "medium" | "high";

export type DtcAnalyzerMessageKey =
  | `state.${
      | "no_request_text"
      | "no_valid_dtc"
      | "deterministic_fallback"
      | "provider_unavailable_fallback"
      | "provider_error_fallback"
      | "provider_unavailable"
      | "provider_success"}`
  | `provider.${"ai_generated" | "error_fallback" | "unavailable_fallback" | "unavailable" | "no_ai"}`
  | `summary.${"provider_unavailable" | "invalid_empty" | "invalid_no_valid" | "invalid_generic" | "deterministic"}`
  | `confidence.${DtcAnalyzerConfidence}`
  | `system.${DtcSystem}`
  | `code.${
      | "P0101"
      | "P0299"
      | "P0401"
      | "P0402"
      | "P0420"
      | "P0087"
      | "P2002"
      | "P2453"
      | "U0100"}.${"title" | "explanation" | `check_${1 | 2 | 3}`}`
  | `code.generic.${DtcSystem}.${"title" | "explanation"}`
  | `code.generic.check_${1 | 2 | 3}`
  | `evidence.${
      | "valid_code"
      | `system_${DtcSystem}`
      | "standard_generic"
      | "standard_manufacturer"
      | "standard_mixed"
      | "profile_known"
      | "profile_unknown"
      | "generic"}`
  | `missing.${
      | "vehicle"
      | "ecu"
      | "freeze_frame"
      | "live_data"
      | "hardware"
      | "p0401_egr_data"
      | "p0401_history"
      | "valid_code"}`
  | `recommendation.${"human_review_gate" | "generic"}`
  | "human.required_before"
  | `safety.${"guidance_only" | "no_approval" | "human_review"}`
  | `required_before.${"customer_file_advice" | "dtc_off_decision" | "checksum_mod_work"}`;

export type DtcAnalyzerMessageDescriptor = {
  key: DtcAnalyzerMessageKey;
  params?: Readonly<Record<string, string | number>>;
  fallback: string;
};

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
  message?: DtcAnalyzerMessageDescriptor;
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
  message?: DtcAnalyzerMessageDescriptor;
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
  systemLabelMessage: DtcAnalyzerMessageDescriptor;
  standardization: DtcStandardization;
  standardizationLabel: string;
  title: string;
  titleMessage: DtcAnalyzerMessageDescriptor;
  likelyDiagnosticContext: string[];
  customerExplanation: string;
  customerExplanationMessage: DtcAnalyzerMessageDescriptor;
  recommendedChecks: string[];
  missingInformation: string[];
  missingInformationMessages: DtcAnalyzerMessageDescriptor[];
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
  requiredBeforeMessages: DtcAnalyzerMessageDescriptor[];
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
  summaryMessage: DtcAnalyzerMessageDescriptor;
  codes: DtcCodeAnalysis[];
  evidence: DtcAnalysisEvidenceItem[];
  riskFlags: DtcRiskFlag[];
  recommendations: DtcAnalyzerRecommendation[];
  missingInformation: string[];
  missingInformationMessages: DtcAnalyzerMessageDescriptor[];
  humanReview: DtcAnalyzerHumanReview;
  safetyBoundaries: string[];
  safetyBoundaryMessages: DtcAnalyzerMessageDescriptor[];
};

export interface DtcAnalyzerProvider {
  readonly providerId: string;
  readonly providerKind: DtcAnalyzerProviderKind;
  readonly modelName: string | null;
  analyzeDtc(input: DtcAnalyzerRequest): Promise<DtcAnalyzerResponse>;
}
