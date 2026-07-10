import type {
  EvidenceTrustReport,
  GenerationBlockReason,
  GenerationReadinessReport,
  MapAttributionSummary,
} from "@/lib/aiFileIntelligence/types";

export function evaluateGenerationReadiness(input: {
  evidence: EvidenceTrustReport;
  mapAttribution?: MapAttributionSummary | null;
  ecuIdentified?: boolean;
  swOrHwIdentified?: boolean;
  actualLabelsConfirmed?: boolean;
  clusterStatus?: "none" | "weak" | "usable" | "strong" | "mature";
  humanReviewWorkflowReady?: boolean;
  checksumWorkflowAvailable?: boolean;
  requestedFinalFileExport?: boolean;
}): GenerationReadinessReport {
  const blockedReasons = new Set<GenerationBlockReason>(input.evidence.blocked_reasons);
  const missingSafetyGates = new Set<string>();

  if (!input.ecuIdentified) {
    blockedReasons.add("unsupported_ecu");
    missingSafetyGates.add("ECU family/type must be identified.");
  }
  if (!input.swOrHwIdentified) {
    blockedReasons.add("unsupported_ecu");
    missingSafetyGates.add("SW/HW or another strong software identifier is required.");
  }
  if (!input.actualLabelsConfirmed) {
    blockedReasons.add("actual_service_labels_missing");
    missingSafetyGates.add("Actual service labels must be confirmed by a human.");
  }
  if (!input.evidence.trusted) {
    blockedReasons.add("no_trusted_samples");
    missingSafetyGates.add("Trusted approved learning evidence is required.");
  }
  if (!input.mapAttribution || input.mapAttribution.status !== "attributed") {
    blockedReasons.add(input.mapAttribution?.status === "partial" ? "unknown_changed_regions" : "no_map_definitions");
    missingSafetyGates.add("Human-reviewed map definitions and changed-region attribution are required.");
  }
  if (!input.clusterStatus || ["none", "weak"].includes(input.clusterStatus)) {
    blockedReasons.add(input.clusterStatus === "weak" ? "weak_cluster" : "no_cluster");
    missingSafetyGates.add("Usable or stronger pattern cluster maturity is required.");
  }
  if (!input.humanReviewWorkflowReady) {
    blockedReasons.add("insufficient_admin_review");
    missingSafetyGates.add("Human tuner review workflow must be completed.");
  }
  if (!input.checksumWorkflowAvailable) {
    blockedReasons.add("checksum_not_supported");
    missingSafetyGates.add("Checksum verification/export tooling boundary is not implemented.");
  }

  blockedReasons.add("output_export_disabled");
  missingSafetyGates.add("Final MOD export is intentionally disabled in Level 3.");
  if (input.requestedFinalFileExport) {
    blockedReasons.add("output_export_disabled");
    missingSafetyGates.add("This sprint cannot create write-ready files.");
  }

  const reasonList = [...blockedReasons];
  const readiness =
    reasonList.includes("output_export_disabled") && reasonList.length <= 2 && input.evidence.score >= 85
      ? "export_locked"
      : input.evidence.score >= 75 &&
          input.mapAttribution?.status === "attributed" &&
          ["usable", "strong", "mature"].includes(input.clusterStatus ?? "none")
        ? "draft_plan_possible"
        : input.evidence.score >= 55
          ? "research_only"
          : reasonList.length
            ? "blocked"
            : "not_ready";

  return {
    readiness_status: readiness,
    trust_level: input.evidence.trust_level,
    blocked_reasons: reasonList,
    missing_safety_gates: [...missingSafetyGates],
    evidence_summary: {
      evidence_score: input.evidence.score,
      strengths: input.evidence.strengths,
      warnings: input.evidence.warnings,
    },
    map_attribution_summary: input.mapAttribution
      ? {
          status: input.mapAttribution.status,
          category_counts: input.mapAttribution.category_counts,
          unknown_region_count: input.mapAttribution.unknown_region_count,
          verified_match_count: input.mapAttribution.verified_match_count,
          average_confidence: input.mapAttribution.average_confidence,
        }
      : null,
    export_allowed: false,
    customer_visible: false,
    human_review_required: true,
  };
}
