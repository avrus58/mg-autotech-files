import type { FileExpertAnalyzerResult } from "@/lib/fileExpert/types";
import {
  trainingFeatureKeys,
  type AiTrainingSample,
} from "@/lib/ecuIntelligence/types";

export type TrainingQualityReason = {
  code: string;
  message: string;
  impact: number;
};

export type TrainingQualityResult = {
  score: number;
  reasons: TrainingQualityReason[];
};

type QualitySample = Partial<AiTrainingSample> & {
  analyzer_failed?: boolean;
};

function hasText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function metadataFlag(sample: QualitySample, key: string) {
  return sample.source_metadata?.[key] === true;
}

export function calculateTrainingSampleQuality(
  sample: QualitySample,
  analyzerResult: FileExpertAnalyzerResult | null = sample.diff_json ?? null
): TrainingQualityResult {
  let score = 0;
  const reasons: TrainingQualityReason[] = [];
  const add = (code: string, message: string, impact: number) => {
    score += impact;
    reasons.push({ code, message, impact });
  };

  if (hasText(sample.ori_file_path)) add("ori_present", "Original file evidence is present.", 7);
  else add("ori_missing", "Original file evidence is missing.", 0);

  if (hasText(sample.mod_file_path)) add("mod_present", "Modified file evidence is present.", 7);
  else add("mod_missing", "Modified file evidence is missing.", 0);

  const sameSize = analyzerResult?.comparison?.same_size ??
    (sample.ori_file_size != null && sample.mod_file_size != null
      ? Number(sample.ori_file_size) === Number(sample.mod_file_size)
      : null);
  if (sameSize === true) add("same_size", "ORI and MOD have the same size.", 10);
  else if (sameSize === false) add("different_size", "ORI and MOD sizes differ.", -10);
  else add("size_unknown", "ORI/MOD size compatibility is unknown.", 0);

  if (hasText(sample.ori_sha256) && hasText(sample.mod_sha256)) {
    add("hashes_present", "Both SHA-256 hashes were computed.", 10);
  } else {
    add("hashes_missing", "One or both SHA-256 hashes are missing.", 0);
  }

  const vehicleFields = [sample.brand, sample.model, sample.engine].filter(hasText).length;
  if (vehicleFields >= 2) add("vehicle_metadata", "Vehicle metadata is sufficiently populated.", 8);
  else add("vehicle_metadata_sparse", "Vehicle metadata is incomplete.", vehicleFields * 2);

  if (hasText(sample.ecu_type) || hasText(sample.ecu_family)) {
    add("ecu_metadata", "ECU identity metadata is present.", 10);
  } else {
    add("ecu_metadata_missing", "ECU type and family are missing.", -5);
  }

  const hasLabels = trainingFeatureKeys.some((key) => sample.service_labels?.[key] === true);
  if (hasLabels) add("service_labels", "At least one service label is present.", 8);
  else add("service_labels_missing", "No service label is present.", -5);

  if (analyzerResult) add("diff_present", "Structured analyzer output is present.", 10);
  else add("diff_missing", "Structured analyzer output is missing.", 0);

  const changedBytes = analyzerResult?.comparison?.changed_bytes;
  if (analyzerResult?.mode === "ori_mod_compare" && changedBytes === 0) {
    add("empty_diff", "ORI and MOD are identical; no learning delta exists.", -10);
  }

  if (sample.pattern_signature || analyzerResult?.pattern_signature) {
    add("pattern_signature", "A reusable pattern signature is present.", 8);
  } else {
    add("pattern_signature_missing", "Pattern signature is missing.", 0);
  }

  const analyzerConfidence = analyzerResult?.risk_assessment?.confidence;
  if (typeof analyzerConfidence === "number") {
    add("analyzer_confidence", "Analyzer confidence is available.", Math.round(analyzerConfidence * 10));
  } else {
    add("analyzer_confidence_missing", "Analyzer confidence is unavailable.", 0);
  }

  if (sample.human_verification_status === "confirmed" || sample.human_verified === true) {
    add("human_verified", "A human reviewer confirmed the sample.", 7);
  } else {
    add("human_verification_pending", "Human verification is still pending.", 0);
  }

  if (hasText(sample.outcome) && sample.outcome !== "unknown") {
    add("outcome_known", "Customer or validation outcome is known.", 3);
  } else {
    add("outcome_unknown", "Customer or validation outcome is unknown.", 0);
  }

  const evidenceCount = Number(metadataFlag(sample, "logs_available")) + Number(metadataFlag(sample, "dyno_available"));
  if (evidenceCount) add("validation_evidence", "Log or dyno evidence is attached.", evidenceCount);
  else add("validation_evidence_future", "No log or dyno evidence is attached yet.", 0);

  if (sample.analyzer_failed || metadataFlag(sample, "analyzer_failed")) {
    add("analyzer_failed", "Analyzer processing failed.", -20);
  }
  if (sample.human_verification_status === "rejected") {
    add("admin_rejected", "An admin rejected this sample.", -20);
  }
  if (["issue_reported", "limp", "smoke", "knock", "needs_revision"].includes(sample.outcome || "")) {
    add("negative_outcome", "A negative or unresolved outcome was reported.", -15);
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasons,
  };
}
