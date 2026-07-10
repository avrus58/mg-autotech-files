import type {
  AdminClusterEvidence,
  PublicClusterEvidence,
} from "@/lib/ecuIntelligence/clustering";
import {
  trainingFeatureKeys,
  type AiTrainingSample,
  type TrainingServiceLabels,
} from "@/lib/ecuIntelligence/types";
import type {
  PublicSimilarityEvidence,
  SimilarityMatch,
  SimilaritySearchResult,
} from "@/lib/ecuIntelligence/similarity";

export type EvidenceTrustLevel = "none" | "weak" | "related" | "strong" | "exact";
export type GenerationReadinessLevel = "blocked" | "research_only" | "review_candidate" | "future_ready";
export type SimilarityMatchCategory = "same_file_family" | "very_similar" | "related" | "weak" | "not_useful";

export type EvidenceChecklist = {
  level: EvidenceTrustLevel;
  score: number;
  summary: string;
  strengths: string[];
  gaps: string[];
  warnings: string[];
};

export type LearningUsefulness = {
  usable: boolean;
  score: number;
  status: "trusted" | "almost_ready" | "needs_review" | "blocked";
  missing: string[];
  reasons: string[];
  nextAction: string;
};

export type GenerationReadiness = {
  level: GenerationReadinessLevel;
  score: number;
  ready: false;
  reasons: string[];
  blockers: string[];
  nextGate: string;
};

type SampleLike = Partial<
  Pick<
    AiTrainingSample,
    | "learning_use_status"
    | "human_verification_status"
    | "data_quality_score"
    | "requested_service_labels"
    | "performed_service_labels"
    | "pattern_signature"
    | "diff_json"
    | "ecu_type"
    | "ecu_family"
    | "sw_number"
    | "hw_number"
    | "outcome"
    | "source_type"
    | "source_metadata"
  >
>;

function numeric(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function hasActiveLabels(labels: Partial<TrainingServiceLabels> | null | undefined) {
  return trainingFeatureKeys.some((key) => labels?.[key]);
}

function activeLabels(labels: Partial<TrainingServiceLabels> | null | undefined) {
  return trainingFeatureKeys.filter((key) => labels?.[key]);
}

function bestSimilarityScore(evidence: SimilaritySearchResult | PublicSimilarityEvidence | null | undefined) {
  if (!evidence) return 0;
  if ("summary" in evidence) return evidence.summary.best_score;
  return evidence.bestScore;
}

function similarityCount(evidence: SimilaritySearchResult | PublicSimilarityEvidence | null | undefined) {
  if (!evidence) return 0;
  if ("summary" in evidence) return evidence.summary.matches_found;
  return evidence.matchesFound;
}

export function categorizeSimilarityMatch(match: SimilarityMatch): SimilarityMatchCategory {
  if (
    match.ecu_match_score >= 50 &&
    match.file_size_score >= 10 &&
    match.identifier_score >= 20 &&
    match.pattern_score >= 16 &&
    match.feature_label_score >= 16
  ) {
    return "same_file_family";
  }
  if (match.score >= 75 && match.pattern_score >= 12 && match.feature_label_score >= 10) return "very_similar";
  if (match.score >= 55 && (match.ecu_match_score >= 25 || match.feature_label_score >= 8)) return "related";
  if (match.score > 0) return "weak";
  return "not_useful";
}

export function explainSimilarityMatch(match: SimilarityMatch) {
  const category = categorizeSimilarityMatch(match);
  const trusted = match.compared_sample.data_quality_score >= 60;
  const titleByCategory: Record<SimilarityMatchCategory, string> = {
    same_file_family: "Same file family evidence",
    very_similar: "Very similar approved evidence",
    related: "Related approved evidence",
    weak: "Weak contextual evidence",
    not_useful: "Not useful for this decision",
  };

  return {
    category,
    title: titleByCategory[category],
    trusted,
    score: match.score,
    matchedFields: match.reasons,
    missingOrWeakFields: match.warnings,
    adminSummary:
      category === "same_file_family"
        ? "This approved sample is close enough to inspect first before starting from scratch."
        : category === "very_similar"
          ? "This sample can guide review, but ECU/SW and service labels still need human verification."
          : category === "related"
            ? "This is useful context only, not a direct reference."
            : "This match should not be treated as reliable tuning evidence.",
  };
}

export function buildEvidenceChecklist(input: {
  similarity?: SimilaritySearchResult | PublicSimilarityEvidence | null;
  cluster?: AdminClusterEvidence | PublicClusterEvidence | null;
  sample?: SampleLike | null;
}): EvidenceChecklist {
  const strengths: string[] = [];
  const gaps: string[] = [];
  const warnings: string[] = [];
  let score = 0;

  const similarityScore = bestSimilarityScore(input.similarity);
  const matches = similarityCount(input.similarity);
  if (matches > 0) {
    score += Math.min(35, similarityScore * 0.35);
    strengths.push(`${matches} approved similar sample${matches === 1 ? "" : "s"} found.`);
  } else {
    gaps.push("No approved similar learning sample is available yet.");
  }

  if (input.cluster?.matchingClusters) {
    score += Math.min(25, input.cluster.bestConfidence * 0.25);
    strengths.push(`${input.cluster.matchingClusters} pattern cluster${input.cluster.matchingClusters === 1 ? "" : "s"} matched.`);
    if (["strong", "mature"].includes(input.cluster.bestStatus)) {
      strengths.push(`Cluster maturity is ${input.cluster.bestStatus}.`);
    } else {
      warnings.push("Cluster evidence is still weak or early-stage.");
    }
  } else {
    gaps.push("No trusted pattern cluster is available for this ECU/service context.");
  }

  if (input.sample) {
    const quality = numeric(input.sample.data_quality_score);
    if (quality >= 80) {
      score += 15;
      strengths.push(`Training quality is high (${quality}/100).`);
    } else if (quality >= 60) {
      score += 8;
      strengths.push(`Training quality passes the minimum gate (${quality}/100).`);
    } else {
      warnings.push("Training quality is below the trusted-evidence threshold.");
    }

    if (input.sample.learning_use_status === "approved_for_learning") {
      score += 5;
      strengths.push("Learning use was explicitly approved.");
    }
    else warnings.push("Learning use is not approved.");

    if (input.sample.human_verification_status === "confirmed") {
      score += 8;
      strengths.push("Human verification is confirmed.");
    }
    else gaps.push("Human confirmation is still missing.");

    if (hasActiveLabels(input.sample.performed_service_labels)) {
      score += 5;
      strengths.push("Actual performed service labels are recorded.");
    }
    else gaps.push("Actual performed service labels are missing.");

    if (input.sample.pattern_signature) {
      score += 5;
      strengths.push("Pattern signature exists.");
    }
    else gaps.push("Pattern signature is missing.");
  }

  const finalScore = clamp(Math.round(score));
  const level: EvidenceTrustLevel =
    finalScore >= 85 ? "exact" :
    finalScore >= 70 ? "strong" :
    finalScore >= 45 ? "related" :
    finalScore > 0 ? "weak" :
    "none";

  return {
    level,
    score: finalScore,
    strengths,
    gaps,
    warnings,
    summary:
      level === "exact"
        ? "Strong evidence exists, but human tuner and checksum verification are still required."
        : level === "strong"
          ? "Good evidence exists for admin review; it is not write-ready output."
          : level === "related"
            ? "Evidence is useful context, not a direct tuning reference."
            : level === "weak"
              ? "Evidence is weak and should not guide file changes without manual review."
              : "No trusted evidence is available yet.",
  };
}

export function calculateLearningUsefulness(sample: SampleLike): LearningUsefulness {
  const missing: string[] = [];
  const reasons: string[] = [];
  let score = 0;

  const quality = numeric(sample.data_quality_score);
  if (quality >= 60) {
    score += Math.min(25, quality * 0.25);
    reasons.push(`Quality gate passes at ${quality}/100.`);
  } else {
    missing.push("Data quality score must be at least 60.");
  }

  if (sample.learning_use_status === "approved_for_learning") {
    score += 15;
    reasons.push("Learning use is approved.");
  } else {
    missing.push("Learning use needs explicit admin approval.");
  }

  if (sample.human_verification_status === "confirmed") {
    score += 15;
    reasons.push("Human verification is confirmed.");
  } else if (sample.human_verification_status === "rejected") {
    missing.push("Rejected samples cannot be trusted evidence.");
  } else {
    missing.push("Human verification is still required.");
  }

  if (hasActiveLabels(sample.requested_service_labels)) {
    score += 8;
    reasons.push(`Requested labels: ${activeLabels(sample.requested_service_labels).join(", ")}.`);
  } else {
    missing.push("Requested service labels are missing.");
  }

  if (hasActiveLabels(sample.performed_service_labels)) {
    score += 14;
    reasons.push(`Actual performed labels: ${activeLabels(sample.performed_service_labels).join(", ")}.`);
  } else {
    missing.push("Actual performed service labels are missing.");
  }

  if (sample.pattern_signature) {
    score += 10;
    reasons.push("Pattern signature exists.");
  } else {
    missing.push("Pattern signature is missing.");
  }

  if (sample.diff_json) {
    score += 7;
    reasons.push("Structured analyzer output exists.");
  } else {
    missing.push("Structured analyzer output is missing.");
  }

  if (sample.ecu_type || sample.ecu_family) {
    score += 6;
    reasons.push("ECU metadata exists.");
  } else {
    missing.push("ECU family/type metadata is missing.");
  }

  const finalScore = clamp(Math.round(score));
  const usable = missing.length === 0 && finalScore >= 80;
  const status: LearningUsefulness["status"] =
    usable ? "trusted" :
    finalScore >= 65 ? "almost_ready" :
    sample.human_verification_status === "rejected" || sample.learning_use_status === "excluded" ? "blocked" :
    "needs_review";

  return {
    usable,
    score: finalScore,
    status,
    missing,
    reasons,
    nextAction:
      status === "trusted"
        ? "Use as trusted evidence and keep monitoring customer outcome."
        : status === "almost_ready"
          ? "Fix the missing labels/metadata before approving as trusted evidence."
          : status === "blocked"
            ? "Do not use this sample for learning unless a human admin reopens it."
            : "Complete human review, actual labels and quality checks first.",
  };
}

export function calculateGenerationReadiness(input: {
  evidence?: EvidenceChecklist | null;
  mapDefinitionsAvailable?: boolean;
  checksumWorkflowAvailable?: boolean;
  humanApprovalReady?: boolean;
  exactSwMatch?: boolean;
  actualLabelsConfirmed?: boolean;
}): GenerationReadiness {
  const blockers: string[] = [];
  const reasons: string[] = [];
  let score = input.evidence?.score ?? 0;

  if (!input.evidence || !["strong", "exact"].includes(input.evidence.level)) {
    blockers.push("Strong trusted evidence is required before any draft change-plan work.");
  } else {
    reasons.push(`Evidence level is ${input.evidence.level}.`);
  }
  if (!input.mapDefinitionsAvailable) blockers.push("ECU-specific map definitions are required.");
  else {
    score += 10;
    reasons.push("Map definitions are available.");
  }
  if (!input.exactSwMatch) blockers.push("Exact software/HW context match is required for any future draft.");
  else {
    score += 5;
    reasons.push("Exact SW/HW context is available.");
  }
  if (!input.actualLabelsConfirmed) blockers.push("Actual performed service labels must be human-confirmed.");
  else {
    score += 5;
    reasons.push("Actual service labels are confirmed.");
  }
  if (!input.humanApprovalReady) blockers.push("Human tuner approval workflow is required.");
  if (!input.checksumWorkflowAvailable) blockers.push("Checksum verification/export tooling boundary is required.");

  const finalScore = clamp(Math.round(score));
  const level: GenerationReadinessLevel =
    blockers.length ? (finalScore >= 70 ? "review_candidate" : finalScore >= 40 ? "research_only" : "blocked") : "future_ready";

  return {
    level,
    score: finalScore,
    ready: false,
    reasons,
    blockers,
    nextGate:
      blockers[0] ??
      "Future-only: still keep human approval and checksum verification before any draft MOD export.",
  };
}
