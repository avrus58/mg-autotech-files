import type { TrainingFeature } from "@/lib/ecuIntelligence/types";

export const evidenceTrustLevels = [
  "trusted",
  "strong",
  "usable",
  "weak",
  "untrusted",
  "blocked",
  "unknown",
] as const;

export type EvidenceTrustLevel = (typeof evidenceTrustLevels)[number];

export const generationReadinessStatuses = [
  "blocked",
  "not_ready",
  "research_only",
  "draft_plan_possible",
  "human_review_required",
  "export_locked",
  "ready_for_future_human_approved_draft",
] as const;

export type GenerationReadinessStatus = (typeof generationReadinessStatuses)[number];

export const generationBlockReasons = [
  "no_map_definitions",
  "no_trusted_samples",
  "no_human_confirmed_samples",
  "insufficient_quality",
  "actual_service_labels_missing",
  "service_label_mismatch",
  "weak_cluster",
  "no_cluster",
  "no_pattern_signature",
  "unsupported_ecu",
  "unsupported_service",
  "customer_file_only",
  "checksum_not_supported",
  "output_export_disabled",
  "unsafe_private_data",
  "unknown_changed_regions",
  "insufficient_admin_review",
] as const;

export type GenerationBlockReason = (typeof generationBlockReasons)[number];

export const mapCategories = [
  "driver_wish",
  "torque_limiter",
  "boost_request",
  "boost_limiter",
  "rail_pressure",
  "duration",
  "lambda",
  "smoke_limiter",
  "ignition",
  "vanos",
  "egr",
  "dpf",
  "dtc",
  "vmax",
  "pop_bangs",
  "tcu_shift",
  "tcu_pressure",
  "tcu_lockup",
  "checksum",
  "axis",
  "metadata",
  "unknown",
] as const;

export type MapCategory = (typeof mapCategories)[number];

export type MapDefinitionSet = {
  id: string;
  name: string;
  ecu_family: string | null;
  ecu_type: string | null;
  sw_number: string | null;
  hw_number: string | null;
  vehicle_brand: string | null;
  vehicle_model: string | null;
  engine: string | null;
  source_type: "manual" | "provider_reference" | "cluster_candidate" | "research" | string;
  confidence_score: number;
  human_verified: boolean;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type MapDefinition = {
  id: string;
  definition_set_id: string;
  map_name: string;
  category: MapCategory;
  offset_start: number;
  offset_end: number;
  rows: number | null;
  cols: number | null;
  data_type: string | null;
  endian: string | null;
  factor: number | null;
  unit: string | null;
  axis_x: unknown;
  axis_y: unknown;
  description: string | null;
  confidence_score: number;
  human_verified: boolean;
  active?: boolean;
};

export type ChangedRegionInput = {
  id?: string;
  offset_start: number;
  offset_end: number;
  size?: number;
  changed_byte_count?: number;
};

export type ChangedRegionAttributionStatus =
  | "matched_verified"
  | "matched_unverified"
  | "partial_match"
  | "ambiguous"
  | "unknown"
  | "no_definition_set"
  | "blocked";

export type ChangedRegionAttribution = {
  changed_region_id: string;
  offset_start: number;
  offset_end: number;
  size: number;
  matched_map_definition_id: string | null;
  map_name: string | null;
  category: MapCategory;
  overlap_ratio: number;
  confidence: number;
  human_verified: boolean;
  attribution_status: ChangedRegionAttributionStatus;
  warnings: string[];
  alternatives: Array<{
    matched_map_definition_id: string;
    map_name: string;
    category: MapCategory;
    overlap_ratio: number;
    confidence: number;
    human_verified: boolean;
  }>;
};

export type MapAttributionSummary = {
  status: "no_definition_set" | "no_changed_regions" | "attributed" | "partial" | "unknown";
  definition_set_id: string | null;
  exact_sw_match: boolean;
  attributed_regions: ChangedRegionAttribution[];
  category_counts: Partial<Record<MapCategory, number>>;
  unknown_region_count: number;
  verified_match_count: number;
  average_confidence: number;
  map_definition_required: boolean;
  human_review_required: true;
  checksum_verification_required: true;
};

export type EvidenceTrustReport = {
  trust_level: EvidenceTrustLevel;
  score: number;
  trusted: boolean;
  strengths: string[];
  warnings: string[];
  blocked_reasons: GenerationBlockReason[];
  recommended_admin_actions: string[];
};

export type LearningUsefulnessReport = {
  usable_for_learning: boolean;
  trust_level: EvidenceTrustLevel;
  missing_requirements: string[];
  quality_reasons: string[];
  label_status: "confirmed" | "missing_actual" | "mismatch" | "unknown";
  privacy_status: "safe" | "unsafe";
  cluster_status: "none" | "weak" | "usable" | "strong" | "mature";
  map_definition_status: "available" | "missing" | "partial";
  recommended_admin_action:
    | "confirm_actual_service_labels"
    | "mark_human_confirmed"
    | "improve_quality_metadata"
    | "run_similarity"
    | "rebuild_clusters"
    | "add_map_definition"
    | "mark_needs_review"
    | "exclude_from_learning"
    | "approve_for_learning"
    | "do_not_use";
};

export type GenerationReadinessReport = {
  readiness_status: GenerationReadinessStatus;
  trust_level: EvidenceTrustLevel;
  blocked_reasons: GenerationBlockReason[];
  missing_safety_gates: string[];
  evidence_summary: Record<string, unknown>;
  map_attribution_summary: Pick<
    MapAttributionSummary,
    "status" | "category_counts" | "unknown_region_count" | "verified_match_count" | "average_confidence"
  > | null;
  export_allowed: false;
  customer_visible: false;
  human_review_required: true;
};

export type AIChangePlan = {
  id: string;
  job_id?: string | null;
  sample_id?: string | null;
  status: "draft_evidence_only" | "blocked" | "needs_human_review";
  service_labels: TrainingFeature[];
  evidence_summary: Record<string, unknown>;
  map_attribution_summary: MapAttributionSummary | null;
  proposed_changes: [];
  safety_gates: string[];
  blocked_reasons: GenerationBlockReason[];
  human_review_required: true;
  export_allowed: false;
  customer_visible: false;
  disclaimer: string;
};
