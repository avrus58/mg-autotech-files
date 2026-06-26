export type FileExpertStatus = "pending" | "processing" | "completed" | "failed";
export type FileExpertReadMethod = "OBD" | "Bench" | "Boot" | "VR" | "Unknown";
export type FileExpertRiskLevel = "low" | "medium" | "high" | "unknown";
export type FileExpertMode = "single_file" | "ori_mod_compare";
export type FileExpertFeature =
  | "stock_or_modified"
  | "stage1"
  | "stage2"
  | "dpf_off"
  | "egr_off"
  | "adblue_off"
  | "dtc_off"
  | "vmax_off"
  | "pop_bangs"
  | "tcu_tune"
  | "tcu_shift"
  | "tcu_lockup";

export type FileExpertFileInspection = {
  file_size: number;
  sha256: string;
  first_64_bytes_hex: string;
  last_64_bytes_hex: string;
  ff_ratio: number;
  zero_ratio: number;
  entropy: number;
  ascii_strings: string[];
  ecu_identifiers: string[];
};

export type FileExpertChangedBlock = {
  start_offset_hex: string;
  end_offset_hex: string;
  length: number;
  changed_byte_count: number;
  ori_hex_preview: string;
  mod_hex_preview: string;
  unsigned_8bit_preview: number[];
  signed_8bit_preview: number[];
  uint16_be_preview: number[];
  uint16_le_preview: number[];
  delta_preview: number[];
};

export type FileExpertActiveRegion = {
  start_offset_hex: string;
  end_offset_hex: string;
  density: number;
};

export type FileExpertMapCandidate = {
  offset_hex: string;
  length: number;
  possible_type: string;
  reason: string;
  confidence: number;
};

export type FileExpertRepeatedPattern = {
  signature: string;
  count: number;
  offsets: string[];
  reason: string;
};

export type FileExpertPossibleFeature = {
  feature: FileExpertFeature;
  confidence: number;
  reasons: string[];
};

export type FileExpertAnalyzerResult = {
  job_id: string;
  analysis_version: string;
  mode: FileExpertMode;
  files: {
    ori?: FileExpertFileInspection;
    mod?: FileExpertFileInspection;
    single?: FileExpertFileInspection;
  };
  comparison?: {
    same_size: boolean;
    changed_bytes: number;
    changed_percent: number;
    raw_changed_blocks: number;
    merged_changed_blocks: number;
    changed_blocks: FileExpertChangedBlock[];
  };
  active_regions: FileExpertActiveRegion[];
  map_candidates: FileExpertMapCandidate[];
  repeated_patterns: FileExpertRepeatedPattern[];
  possible_features: FileExpertPossibleFeature[];
  risk_assessment: {
    risk_level: FileExpertRiskLevel;
    confidence: number;
    reasons: string[];
    warnings: string[];
  };
  summary: {
    stock_or_modified: "likely_stock" | "likely_modified" | "unknown";
    main_conclusion: string;
    recommended_next_steps: string[];
  };
};

export type FileExpertJob = {
  id: string;
  user_id: string | null;
  status: FileExpertStatus;
  brand: string | null;
  model: string | null;
  engine: string | null;
  ecu_type: string | null;
  read_method: string | null;
  customer_notes: string | null;
  ori_file_path: string | null;
  mod_file_path: string | null;
  ori_file_name: string | null;
  mod_file_name: string | null;
  ori_sha256: string | null;
  mod_sha256: string | null;
  ori_file_size: number | string | null;
  mod_file_size: number | string | null;
  result_json: FileExpertAnalyzerResult | null;
  ai_report: string | null;
  executive_summary: string | null;
  detected_features: FileExpertPossibleFeature[] | null;
  confidence_score: number | string | null;
  risk_level: FileExpertRiskLevel | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export const fileExpertFeatureLabels: Record<FileExpertFeature, string> = {
  stock_or_modified: "Stock / Modified",
  stage1: "Stage 1",
  stage2: "Stage 2",
  dpf_off: "DPF OFF",
  egr_off: "EGR OFF",
  adblue_off: "AdBlue OFF",
  dtc_off: "DTC OFF",
  vmax_off: "VMAX OFF",
  pop_bangs: "Pop & Bangs",
  tcu_tune: "TCU Tune",
  tcu_shift: "TCU Shift",
  tcu_lockup: "TCU Lockup",
};
