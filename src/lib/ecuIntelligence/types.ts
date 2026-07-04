import type {
  FileExpertAnalyzerResult,
  FileExpertChangeClassification,
  FileExpertPatternSignature,
} from "@/lib/fileExpert/types";

export const trainingFeatureKeys = [
  "stage1",
  "stage2",
  "stage3",
  "dpf_off",
  "egr_off",
  "adblue_off",
  "dtc_off",
  "vmax_off",
  "pop_bangs",
  "tcu_tune",
  "tcu_shift",
  "tcu_lockup",
] as const;

export type TrainingFeature = (typeof trainingFeatureKeys)[number];
export type TrainingServiceLabels = Record<TrainingFeature, boolean>;
export type HumanVerificationStatus = "unverified" | "confirmed" | "rejected" | "needs_review";
export const trainingSafetyRatingKeys = ["unknown", "safe", "aggressive", "risky", "bad"] as const;
export type TrainingSafetyRating = (typeof trainingSafetyRatingKeys)[number];
export type LearningUseStatus = "pending" | "approved_for_learning" | "excluded";
export type TrainingSourceType =
  | "completed_request"
  | "demo_fixture"
  | "manual_capture"
  | "file_expert";

export const patternClusterStatuses = ["weak", "usable", "strong", "mature"] as const;
export type PatternClusterStatus = (typeof patternClusterStatuses)[number];
export type AccuracyScopeType = "global" | "ecu_family" | "ecu_type" | "feature_type" | "cluster";

export type RepeatedRegionEvidence = {
  bucket_start_hex: string;
  bucket_end_hex: string;
  occurrence_count: number;
  occurrence_rate: number;
  representative_offsets: string[];
  confidence: number;
  reason: string;
  notes: string;
};

export type AiPatternCluster = {
  id: string;
  cluster_key: string;
  ecu_family: string | null;
  ecu_type: string | null;
  sw_number: string | null;
  hw_number: string | null;
  feature_type: TrainingFeature;
  sample_count: number;
  approved_sample_count: number;
  human_verified_sample_count: number;
  average_quality_score: number | string;
  cluster_confidence: number | string;
  cluster_status: PatternClusterStatus;
  repeated_regions: RepeatedRegionEvidence[] | null;
  common_pattern_signature: Record<string, unknown> | null;
  feature_consistency_json: Record<string, unknown> | null;
  outlier_sample_ids: string[] | null;
  source_sample_ids: string[] | null;
  last_rebuilt_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AiClusterMember = {
  id: string;
  cluster_id: string;
  training_sample_id: string;
  membership_score: number | string;
  membership_reasons: string[] | null;
  is_outlier: boolean;
  created_at: string;
};

export type AiAccuracyMetric = {
  id: string;
  scope_type: AccuracyScopeType;
  scope_key: string;
  total_reviewed: number;
  auto_label_correct: number;
  auto_label_partial: number;
  auto_label_wrong: number;
  precision_score: number | string;
  review_coverage: number | string;
  average_quality_score: number | string;
  confusion_json: Record<string, unknown> | null;
  last_calculated_at: string;
  created_at: string;
  updated_at: string;
};

export type AiTrainingSample = {
  id: string;
  request_id: string | null;
  user_id: string | null;
  ori_file_path: string;
  mod_file_path: string;
  ori_file_name: string | null;
  mod_file_name: string | null;
  ori_sha256: string | null;
  mod_sha256: string | null;
  ori_file_size: number | string | null;
  mod_file_size: number | string | null;
  brand: string | null;
  model: string | null;
  engine: string | null;
  ecu_type: string | null;
  ecu_family: string | null;
  sw_number: string | null;
  hw_number: string | null;
  read_method: string | null;
  service_labels: TrainingServiceLabels | null;
  requested_service_labels: TrainingServiceLabels | null;
  performed_service_labels: TrainingServiceLabels | null;
  provider: string | null;
  revision_label: string | null;
  revision_number: number;
  source_type: TrainingSourceType | null;
  source_metadata: Record<string, unknown> | null;
  change_type_classification: FileExpertChangeClassification | "unknown" | null;
  diff_json: FileExpertAnalyzerResult | null;
  pattern_signature: FileExpertPatternSignature | null;
  auto_label_confidence: number | string | null;
  auto_labels_correct: boolean | null;
  learning_use_status: LearningUseStatus;
  human_verified: boolean;
  human_verification_status: HumanVerificationStatus;
  quality_rating: number | null;
  data_quality_score: number | string | null;
  data_quality_reasons: Array<{ code: string; message: string; impact: number }> | null;
  safety_rating: TrainingSafetyRating | null;
  outcome: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type AiEcuKnowledgeProfile = {
  id: string;
  ecu_family: string | null;
  ecu_type: string | null;
  sw_number: string | null;
  hw_number: string | null;
  total_samples: number;
  human_verified_samples: number;
  unverified_samples: number;
  rejected_samples: number;
  stage1_samples: number;
  stage2_samples: number;
  stage3_samples: number;
  dpf_off_samples: number;
  egr_off_samples: number;
  adblue_off_samples: number;
  dtc_off_samples: number;
  vmax_off_samples: number;
  pop_bangs_samples: number;
  tcu_tune_samples: number;
  tcu_shift_samples: number;
  tcu_lockup_samples: number;
  learning_level: number;
  detection_confidence: number | string;
  pattern_confidence: number | string;
  map_candidate_confidence: number | string;
  generation_readiness: string;
  approved_samples: number;
  pending_samples: number;
  excluded_samples: number;
  average_quality_score: number | string;
  similarity_readiness: "no_data" | "weak" | "usable" | "strong";
  cluster_count: number;
  strong_cluster_count: number;
  usable_cluster_count: number;
  weak_cluster_count: number;
  outlier_count: number;
  pattern_clustering_readiness: "no_data" | PatternClusterStatus;
  accuracy_summary: Record<string, unknown> | null;
  profile_json: Record<string, unknown> | null;
  last_updated_at: string;
};

export function emptyTrainingServiceLabels(): TrainingServiceLabels {
  return Object.fromEntries(trainingFeatureKeys.map((key) => [key, false])) as TrainingServiceLabels;
}
