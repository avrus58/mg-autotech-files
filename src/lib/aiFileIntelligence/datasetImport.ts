import { createHash } from "crypto";
import type { TrainingFeature, TrainingServiceLabels } from "@/lib/ecuIntelligence/types";
import { emptyTrainingServiceLabels } from "@/lib/ecuIntelligence/types";

export const datasetReviewStatuses = [
  "pending_review",
  "auto_pair_suggested",
  "needs_manual_pairing",
  "ready_for_human_label",
  "approved_for_learning",
  "rejected",
  "excluded",
  "known_bad",
  "duplicate",
  "imported",
] as const;

export type DatasetReviewStatus = (typeof datasetReviewStatuses)[number];

export const negativeExampleTypes = [
  "wrong_service_label",
  "bad_pair",
  "metadata_only_change",
  "checksum_only_change",
  "noisy_mod",
  "low_quality",
  "untrusted_source",
  "unsafe_private_data",
  "duplicate",
  "unknown_ecu",
] as const;

export type NegativeExampleType = (typeof negativeExampleTypes)[number];

export const importSourceTypes = [
  "manual_upload",
  "provider_archive",
  "historical_jobs",
  "synthetic_fixture",
  "golden_dataset",
  "local_dev_archive",
  "unknown",
] as const;

export type ImportSourceType = (typeof importSourceTypes)[number];

export type DatasetServiceLabel =
  | TrainingFeature
  | "start_stop_off"
  | "tcu"
  | "pops_bangs"
  | "launch_control"
  | "custom";

export type DatasetFileRoleGuess = "ori" | "mod" | "unknown";
export type DatasetValidationStatus = "valid" | "warning" | "invalid" | "duplicate" | "pending";
export type DatasetPrivacyStatus = "safe" | "needs_review" | "unsafe" | "pending";

export type DatasetFileDescriptor = {
  filename: string;
  folder?: string | null;
  fileSize?: number | null;
  fingerprint?: string | null;
  providerMetadata?: Record<string, unknown> | null;
};

export type DatasetImportBatch = {
  id: string;
  source_type: ImportSourceType;
  source_name: string | null;
  source_reference: string | null;
  provider_name: string | null;
  import_mode: "dry_run" | "staged" | "approved_learning" | "synthetic" | "negative_examples";
  dry_run: boolean;
  status: "pending" | "analyzed" | "needs_review" | "failed" | "completed";
  total_files: number;
  candidate_pairs: number;
  confirmed_pairs: number;
  duplicates: number;
  rejected: number;
  needs_review: number;
  errors: string[];
  warnings: string[];
  created_at: string;
  created_by?: string | null;
};

export type DatasetFileCandidate = {
  id: string;
  batch_id: string;
  filename: string;
  folder: string | null;
  file_role_guess: DatasetFileRoleGuess;
  file_extension: string;
  file_size: number;
  fingerprint: string;
  ecu_family_guess: string | null;
  ecu_type_guess: string | null;
  sw_number_guess: string | null;
  hw_number_guess: string | null;
  vehicle_guess: Record<string, unknown>;
  service_label_guess: DatasetServiceLabel[];
  provider_metadata: Record<string, unknown>;
  privacy_status: DatasetPrivacyStatus;
  validation_status: DatasetValidationStatus;
  warnings: string[];
  errors: string[];
};

export type DatasetPairCandidate = {
  id: string;
  batch_id: string;
  ori_candidate_id: string | null;
  mod_candidate_id: string | null;
  pair_confidence: number;
  pairing_reasons: string[];
  ecu_match_score: number;
  file_size_relation: "same_size" | "near_size" | "different_size" | "unknown";
  sw_hw_match: boolean;
  service_label_guess: DatasetServiceLabel[];
  changed_region_summary: Record<string, unknown>;
  map_attribution_summary: Record<string, unknown>;
  quality_score: number;
  quality_reasons: string[];
  learning_recommendation:
    | "approve_possible_after_review"
    | "needs_actual_labels"
    | "needs_ecu_metadata"
    | "needs_map_definition"
    | "duplicate"
    | "reject"
    | "exclude"
    | "known_bad"
    | "synthetic_only";
  review_status: DatasetReviewStatus;
  actual_service_labels: TrainingServiceLabels | null;
  admin_notes: string | null;
};

export type DatasetDryRunResult = {
  batch: DatasetImportBatch;
  files: DatasetFileCandidate[];
  pairs: DatasetPairCandidate[];
  unmatched_ori: DatasetFileCandidate[];
  unmatched_mod: DatasetFileCandidate[];
  unknown_files: DatasetFileCandidate[];
  duplicate_files: DatasetFileCandidate[];
  warnings: string[];
  errors: string[];
};

export function stableDatasetId(prefix: string, input: string) {
  return `${prefix}-${createHash("sha256").update(input).digest("hex").slice(0, 16)}`;
}

export function labelsToTrainingRecord(labels: DatasetServiceLabel[]) {
  const record = emptyTrainingServiceLabels();
  for (const label of labels) {
    if (label === "pops_bangs") record.pop_bangs = true;
    else if (label === "tcu") record.tcu_tune = true;
    else if (label in record) record[label as TrainingFeature] = true;
  }
  return record;
}

export function hasActualServiceLabels(labels: TrainingServiceLabels | null | undefined) {
  return Boolean(labels && Object.values(labels).some(Boolean));
}
