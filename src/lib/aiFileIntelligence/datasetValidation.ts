import {
  hasActualServiceLabels,
  type DatasetFileCandidate,
  type DatasetPairCandidate,
} from "@/lib/aiFileIntelligence/datasetImport";

export function scoreDatasetPairCandidate(
  pair: DatasetPairCandidate,
  files: { ori?: DatasetFileCandidate | null; mod?: DatasetFileCandidate | null },
) {
  const reasons: string[] = [];
  let score = 0;
  if (!files.ori || !files.mod) return { score: 0, reasons: ["ORI/MOD pair is incomplete."], recommendation: "reject" as const };

  if (pair.pair_confidence >= 70) {
    score += 30;
    reasons.push("Pair confidence is high.");
  } else if (pair.pair_confidence >= 40) {
    score += 15;
    reasons.push("Pair confidence is usable but needs review.");
  } else reasons.push("Pair confidence is low.");

  if (pair.file_size_relation === "same_size") {
    score += 20;
    reasons.push("Same-size ORI/MOD comparison is possible.");
  } else if (pair.file_size_relation === "near_size") {
    score += 8;
    reasons.push("File sizes are close but structural review is required.");
  } else reasons.push("File sizes differ or are unknown.");

  if (pair.sw_hw_match) {
    score += 15;
    reasons.push("SW/HW metadata matches.");
  } else if (files.ori.sw_number_guess || files.mod.sw_number_guess) reasons.push("SW/HW metadata is incomplete or mismatched.");

  if (pair.service_label_guess.length) {
    score += 15;
    reasons.push("Service label suggestion exists.");
  } else reasons.push("Service label suggestion is missing.");

  if (files.ori.privacy_status === "safe" && files.mod.privacy_status === "safe") {
    score += 10;
    reasons.push("Privacy screening is safe.");
  } else reasons.push("Privacy screening requires review.");

  if (files.ori.validation_status === "duplicate" || files.mod.validation_status === "duplicate") {
    return { score: Math.min(score, 20), reasons: [...reasons, "Duplicate files cannot be trusted learning evidence."], recommendation: "duplicate" as const };
  }
  if (files.ori.validation_status === "invalid" || files.mod.validation_status === "invalid") {
    return { score: Math.min(score, 20), reasons: [...reasons, "Invalid file candidate."], recommendation: "reject" as const };
  }

  const finalScore = Math.max(0, Math.min(100, score));
  return {
    score: finalScore,
    reasons,
    recommendation:
      finalScore >= 70 ? "needs_actual_labels" as const :
      finalScore >= 45 ? "needs_ecu_metadata" as const :
      "exclude" as const,
  };
}

export function canApproveDatasetPairForLearning(pair: DatasetPairCandidate, options: {
  duplicate?: boolean;
  knownBad?: boolean;
  privacySafe?: boolean;
  humanConfirmed?: boolean;
  explicitApproval?: boolean;
}) {
  const blockers: string[] = [];
  if (!pair.ori_candidate_id || !pair.mod_candidate_id) blockers.push("confirmed ORI/MOD pair is required");
  if (!hasActualServiceLabels(pair.actual_service_labels)) blockers.push("actual_service_labels are required");
  if (!options.humanConfirmed) blockers.push("human confirmation is required");
  if (pair.quality_score < 60) blockers.push("quality_score must be at least 60");
  if (options.duplicate) blockers.push("duplicate pair cannot be approved");
  if (options.knownBad) blockers.push("known bad pair cannot be approved");
  if (options.privacySafe === false) blockers.push("privacy screening must be safe");
  if (!options.explicitApproval) blockers.push("explicit admin approval is required");
  return {
    allowed: blockers.length === 0,
    blockers,
    target_learning_use_status: options.explicitApproval && blockers.length === 0 ? "approved_for_learning" : "pending",
  };
}
