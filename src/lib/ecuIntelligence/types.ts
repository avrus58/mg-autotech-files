import type { FileExpertAnalyzerResult, FileExpertPatternSignature } from "@/lib/fileExpert/types";

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
export type TrainingSafetyRating = "unknown" | "safe" | "aggressive" | "risky" | "bad";

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
  provider: string | null;
  revision_label: string | null;
  source_metadata: Record<string, unknown> | null;
  diff_json: FileExpertAnalyzerResult | null;
  pattern_signature: FileExpertPatternSignature | null;
  auto_label_confidence: number | string | null;
  auto_labels_correct: boolean | null;
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
  profile_json: Record<string, unknown> | null;
  last_updated_at: string;
};

export function emptyTrainingServiceLabels(): TrainingServiceLabels {
  return Object.fromEntries(trainingFeatureKeys.map((key) => [key, false])) as TrainingServiceLabels;
}
