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
  normalizedInput: DtcAnalyzerNormalizedInput;
  summary: string;
  codes: DtcCodeAnalysis[];
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
