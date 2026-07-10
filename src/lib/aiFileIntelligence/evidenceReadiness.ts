import {
  trainingFeatureKeys,
  type AiTrainingSample,
  type TrainingServiceLabels,
} from "@/lib/ecuIntelligence/types";
import type {
  EvidenceTrustLevel,
  EvidenceTrustReport,
  GenerationBlockReason,
  LearningUsefulnessReport,
  MapAttributionSummary,
} from "@/lib/aiFileIntelligence/types";

type SampleEvidence = Partial<
  Pick<
    AiTrainingSample,
    | "learning_use_status"
    | "human_verification_status"
    | "data_quality_score"
    | "requested_service_labels"
    | "performed_service_labels"
    | "pattern_signature"
    | "diff_json"
    | "source_type"
    | "source_metadata"
  >
>;

function numeric(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function activeLabels(labels: Partial<TrainingServiceLabels> | null | undefined) {
  return trainingFeatureKeys.filter((feature) => labels?.[feature]);
}

function isDemoSample(sample: SampleEvidence) {
  return sample.source_type === "demo_fixture" || sample.source_metadata?.demo === true;
}

function trustLevelFromScore(score: number, blocked: boolean): EvidenceTrustLevel {
  if (blocked) return score > 55 ? "untrusted" : "blocked";
  if (score >= 85) return "trusted";
  if (score >= 70) return "strong";
  if (score >= 55) return "usable";
  if (score > 0) return "weak";
  return "unknown";
}

export function evaluateEvidenceTrust(input: {
  sample?: SampleEvidence | null;
  similarityBestScore?: number;
  clusterStatus?: "none" | "weak" | "usable" | "strong" | "mature";
  clusterConfidence?: number;
  mapAttribution?: MapAttributionSummary | null;
  allowSyntheticEvidence?: boolean;
}): EvidenceTrustReport {
  const strengths: string[] = [];
  const warnings: string[] = [];
  const blockedReasons: GenerationBlockReason[] = [];
  const recommendedAdminActions: string[] = [];
  let score = 0;
  let blocked = false;
  const sample = input.sample;

  if (sample) {
    const quality = numeric(sample.data_quality_score);
    if (sample.learning_use_status === "approved_for_learning") {
      score += 18;
      strengths.push("Learning use is explicitly approved.");
    } else {
      blocked = true;
      blockedReasons.push("no_trusted_samples");
      recommendedAdminActions.push("approve_for_learning");
      warnings.push("Sample is not approved for trusted learning evidence.");
    }

    if (sample.human_verification_status === "confirmed") {
      score += 18;
      strengths.push("Human verification is confirmed.");
    } else {
      blocked = true;
      blockedReasons.push("no_human_confirmed_samples");
      recommendedAdminActions.push("mark_human_confirmed");
      warnings.push("Human confirmation is missing.");
    }

    if (quality >= 80) {
      score += 18;
      strengths.push(`Data quality is high (${quality}/100).`);
    } else if (quality >= 60) {
      score += 10;
      strengths.push(`Data quality passes the trusted-evidence minimum (${quality}/100).`);
    } else {
      blocked = true;
      blockedReasons.push("insufficient_quality");
      recommendedAdminActions.push("improve_quality_metadata");
      warnings.push("Data quality is below the trusted threshold.");
    }

    if (activeLabels(sample.performed_service_labels).length) {
      score += 14;
      strengths.push("Actual performed service labels are present.");
    } else {
      blocked = true;
      blockedReasons.push("actual_service_labels_missing");
      recommendedAdminActions.push("confirm_actual_service_labels");
      warnings.push("Actual performed service labels are missing.");
    }

    const requested = activeLabels(sample.requested_service_labels);
    const actual = activeLabels(sample.performed_service_labels);
    if (requested.length && actual.length && !actual.some((feature) => requested.includes(feature))) {
      blockedReasons.push("service_label_mismatch");
      warnings.push("Requested and actual service labels do not overlap; human review is required.");
      recommendedAdminActions.push("mark_needs_review");
    }

    if (sample.pattern_signature) {
      score += 10;
      strengths.push("Pattern signature exists.");
    } else {
      blockedReasons.push("no_pattern_signature");
      warnings.push("Pattern signature is missing.");
      recommendedAdminActions.push("run_similarity");
    }

    if (isDemoSample(sample) && !input.allowSyntheticEvidence) {
      blocked = true;
      blockedReasons.push("unsafe_private_data");
      warnings.push("Demo/synthetic samples are excluded from production trusted evidence by default.");
    }
  } else {
    blocked = true;
    blockedReasons.push("no_trusted_samples");
    warnings.push("No sample evidence is available.");
  }

  if (input.similarityBestScore && input.similarityBestScore > 0) {
    score += Math.min(12, input.similarityBestScore * 0.12);
    strengths.push(`Similarity evidence best score is ${Math.round(input.similarityBestScore)}/100.`);
  } else {
    recommendedAdminActions.push("run_similarity");
    warnings.push("No approved similarity evidence is attached.");
  }

  if (input.clusterStatus && input.clusterStatus !== "none") {
    const clusterBonus = { weak: 3, usable: 8, strong: 12, mature: 15 }[input.clusterStatus] ?? 0;
    score += clusterBonus;
    strengths.push(`Pattern cluster maturity is ${input.clusterStatus}.`);
    if (input.clusterStatus === "weak") blockedReasons.push("weak_cluster");
  } else {
    blockedReasons.push("no_cluster");
    recommendedAdminActions.push("rebuild_clusters");
    warnings.push("No pattern cluster is available yet.");
  }

  if (input.mapAttribution?.status === "attributed") {
    score += 10;
    strengths.push("Changed regions are attributed to known map definitions.");
  } else if (input.mapAttribution) {
    blockedReasons.push(input.mapAttribution.status === "no_definition_set" ? "no_map_definitions" : "unknown_changed_regions");
    recommendedAdminActions.push("add_map_definition");
    warnings.push("Map attribution is incomplete.");
  } else {
    blockedReasons.push("no_map_definitions");
    recommendedAdminActions.push("add_map_definition");
  }

  const finalScore = Math.round(Math.max(0, Math.min(100, score)));
  const trustLevel = trustLevelFromScore(finalScore, blocked);
  return {
    trust_level: trustLevel,
    score: finalScore,
    trusted: trustLevel === "trusted" || trustLevel === "strong",
    strengths: [...new Set(strengths)],
    warnings: [...new Set(warnings)],
    blocked_reasons: [...new Set(blockedReasons)],
    recommended_admin_actions: [...new Set(recommendedAdminActions)],
  };
}

export function evaluateLearningUsefulness(input: {
  sample: SampleEvidence;
  clusterStatus?: LearningUsefulnessReport["cluster_status"];
  mapDefinitionStatus?: LearningUsefulnessReport["map_definition_status"];
  privacySafe?: boolean;
}) {
  const evidence = evaluateEvidenceTrust({
    sample: input.sample,
    clusterStatus: input.clusterStatus ?? "none",
    mapAttribution: input.mapDefinitionStatus === "available"
      ? {
          status: "attributed",
          definition_set_id: "available",
          exact_sw_match: false,
          attributed_regions: [],
          category_counts: {},
          unknown_region_count: 0,
          verified_match_count: 0,
          average_confidence: 0,
          map_definition_required: false,
          human_review_required: true,
          checksum_verification_required: true,
        }
      : null,
  });
  const requested = activeLabels(input.sample.requested_service_labels);
  const actual = activeLabels(input.sample.performed_service_labels);
  const labelStatus: LearningUsefulnessReport["label_status"] =
    actual.length
      ? requested.length && !actual.some((label) => requested.includes(label))
        ? "mismatch"
        : "confirmed"
      : "missing_actual";
  const missing = [
    ...evidence.blocked_reasons.map((reason) => reason.replaceAll("_", " ")),
    ...(input.privacySafe === false ? ["Privacy projection is unsafe."] : []),
  ];
  const blocked = evidence.trust_level === "blocked" || evidence.trust_level === "untrusted" || input.privacySafe === false;
  const recommended =
    input.privacySafe === false ? "exclude_from_learning" :
    input.sample.human_verification_status !== "confirmed" ? "mark_human_confirmed" :
    !actual.length ? "confirm_actual_service_labels" :
    numeric(input.sample.data_quality_score) < 60 ? "improve_quality_metadata" :
    input.clusterStatus === "none" ? "rebuild_clusters" :
    input.mapDefinitionStatus !== "available" ? "add_map_definition" :
    input.sample.learning_use_status !== "approved_for_learning" ? "approve_for_learning" :
    blocked ? "do_not_use" : "approve_for_learning";

  return {
    usable_for_learning: evidence.trusted && missing.length === 0,
    trust_level: evidence.trust_level,
    missing_requirements: missing,
    quality_reasons: evidence.strengths,
    label_status: labelStatus,
    privacy_status: input.privacySafe === false ? "unsafe" : "safe",
    cluster_status: input.clusterStatus ?? "none",
    map_definition_status: input.mapDefinitionStatus ?? "missing",
    recommended_admin_action: recommended,
  } satisfies LearningUsefulnessReport;
}
