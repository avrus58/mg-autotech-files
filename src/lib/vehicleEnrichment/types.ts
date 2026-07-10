import type { VehicleControlRecord, VehicleServiceKey } from "@/lib/vehicleControl/types";

export type VehicleEnrichmentSourceType = "manual" | "auto_data_reference" | "json" | "csv" | "other";

export type VehicleEnrichmentReviewStatus =
  | "needs_review"
  | "draft"
  | "verified"
  | "published"
  | "ignored"
  | "rejected"
  | "archived";

export type ExternalVehicleEntry = {
  id?: string;
  brand: string;
  model: string;
  rawTitle?: string | null;
  rawModel?: string | null;
  rawGeneration?: string | null;
  rawBodyType?: string | null;
  rawYearRange?: string | null;
  rawPowerRange?: string | null;
  engineDisplayName?: string | null;
  engineCodeText?: string | null;
  displacementText?: string | null;
  powerText?: string | null;
  torqueText?: string | null;
  fuelType?: string | null;
  drivetrain?: string | null;
  transmission?: string | null;
  hybridType?: string | null;
  sourceUrl?: string | null;
};

export type BodyVariantSummary = {
  code: string | null;
  label: string;
  bodyType: string | null;
  yearFrom: number | null;
  yearTo: number | null;
  sourceUrl: string | null;
};

export type ExcludedExternalEntry = {
  entry: ExternalVehicleEntry;
  reason: string;
};

export type NormalizedGenerationGroup = {
  id: string;
  brand: string;
  model: string;
  internalGenerationLabel: string;
  customerDisplayLabel: string;
  yearFrom: number | null;
  yearTo: number | null;
  platformCodes: string[];
  bodyVariants: BodyVariantSummary[];
  includedEntries: ExternalVehicleEntry[];
  excludedEntries: ExcludedExternalEntry[];
  confidenceScore: number;
  reviewStatus: VehicleEnrichmentReviewStatus;
  notes: string[];
};

export type Stage1DraftEstimate = {
  stage1HpEstimate: number | null;
  stage1NmEstimate: number | null;
  estimateSource: "auto_estimate_15_percent";
  estimateConfidence: "low";
  needsReview: true;
  verified: false;
};

export type NormalizedEngineCandidate = {
  id: string;
  generationGroupId: string;
  brand: string;
  model: string;
  generation: string;
  engineDisplayName: string;
  engineCode: string | null;
  fuelType: string | null;
  displacementCc: number | null;
  stockHp: number | null;
  stockKw: number | null;
  stockNm: number | null;
  drivetrain: string | null;
  transmission: string | null;
  hybridType: string | null;
  bodyVariantAvailability: BodyVariantSummary[];
  yearFrom: number | null;
  yearTo: number | null;
  sourceUrl: string | null;
  services: VehicleServiceKey[];
  stage1Estimate: Stage1DraftEstimate;
  confidenceScore: number;
  reviewStatus: VehicleEnrichmentReviewStatus;
  warnings: string[];
};

export type VehicleEnrichmentScopeOptions = {
  modernOnly?: boolean;
  yearCutoff?: number;
};

export type VehicleEnrichmentInput = {
  sourceType: VehicleEnrichmentSourceType;
  sourceName?: string | null;
  sourceUrl?: string | null;
  brand?: string | null;
  model?: string | null;
  entries: ExternalVehicleEntry[];
  modernOnly?: boolean;
  yearCutoff?: number;
};

export type VehicleEnrichmentSuggestedAction =
  | "create_draft_generation"
  | "create_draft_engine"
  | "create_diff_review"
  | "ignore_existing"
  | "mark_needs_review"
  | "reject_old_generation"
  | "reject_duplicate"
  | "manual_review_required";

export type VehicleEnrichmentDiff = {
  entityType: "generation" | "engine" | "performance";
  fieldName: string;
  existingValue: unknown;
  candidateValue: unknown;
  diffType: "missing" | "conflict" | "protected_manual_verified" | "duplicate" | "old_scope";
  severity: "info" | "warning" | "error";
  reviewStatus: "pending";
};

export type VehicleEnrichmentGapResult = {
  generationGroupId: string;
  engineCandidateId?: string;
  matchedExistingGeneration: VehicleControlRecord | null;
  matchedExistingEngine: VehicleControlRecord | null;
  possibleDuplicates: VehicleControlRecord[];
  conflictingValues: VehicleEnrichmentDiff[];
  protectedManualVerified: boolean;
  suggestedAction: VehicleEnrichmentSuggestedAction;
  reasons: string[];
};

export type VehicleEnrichmentPlan = {
  source: {
    sourceType: VehicleEnrichmentSourceType;
    sourceName: string | null;
    sourceUrl: string | null;
    modernOnly: boolean;
    yearCutoff: number;
  };
  totalEntries: number;
  acceptedEntries: number;
  skippedOldEntries: number;
  generationGroups: NormalizedGenerationGroup[];
  engineCandidates: NormalizedEngineCandidate[];
  gaps: VehicleEnrichmentGapResult[];
  warnings: string[];
};
