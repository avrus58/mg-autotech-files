import {
  ecuIntelligenceInsightRuleVersion,
  type EcuIntelligenceClusterSummary,
  type EcuIntelligenceInsight,
  type EcuIntelligenceOverviewMetrics,
} from "@/lib/ecuIntelligence/center/types";

function insight(input: Omit<EcuIntelligenceInsight, "id" | "generatedAt" | "ruleVersion" | "acknowledged">): EcuIntelligenceInsight {
  const scopeKey = input.scope.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "global";
  return {
    ...input,
    id: `${ecuIntelligenceInsightRuleVersion}:${input.type}:${scopeKey}`,
    generatedAt: new Date().toISOString(),
    ruleVersion: ecuIntelligenceInsightRuleVersion,
    acknowledged: false,
  };
}

export function generateEcuIntelligenceInsights(input: {
  metrics: EcuIntelligenceOverviewMetrics;
  clusters: EcuIntelligenceClusterSummary[];
}): EcuIntelligenceInsight[] {
  const insights: EcuIntelligenceInsight[] = [];
  const reviewBacklog = input.metrics.reviewQueueCount;

  if (reviewBacklog >= 10) {
    insights.push(insight({
      type: "high_review_backlog",
      severity: reviewBacklog >= 50 ? "critical" : "warning",
      title: "Learning review backlog is growing",
      explanation: "Many candidate files or ORI/MOD pairs still need human review before they can support the corpus.",
      scope: "global",
      supportingMetrics: { reviewQueueCount: reviewBacklog },
      evidenceRefs: ["/admin/ecu-intelligence/review"],
      recommendedAction: "Prioritize high-score pair candidates with exact identity and explicit authorization.",
    }));
  }

  if (input.metrics.unresolvedAuthorizationCount > 0) {
    insights.push(insight({
      type: "authorization_gap",
      severity: "warning",
      title: "Learning authorization gaps remain",
      explanation: "Some candidates are not explicitly authorized for learning or research and must stay excluded from trusted evidence.",
      scope: "global",
      supportingMetrics: { unresolvedAuthorizationCount: input.metrics.unresolvedAuthorizationCount },
      evidenceRefs: ["/admin/ai-training/corpus"],
      recommendedAction: "Review authorization evidence and keep historical uploads not_granted unless explicit terms exist.",
    }));
  }

  if (input.metrics.exactIdentityComplete < input.metrics.exactClusterCount) {
    insights.push(insight({
      type: "identity_extraction_gap",
      severity: "info",
      title: "Some exact identities are incomplete",
      explanation: "Clusters with missing HW, SW, file role, read method or representation cannot be treated as exact evidence.",
      scope: "global",
      supportingMetrics: {
        exactIdentityComplete: input.metrics.exactIdentityComplete,
        exactClusterCount: input.metrics.exactClusterCount,
      },
      evidenceRefs: ["/admin/ecu-intelligence/clusters"],
      recommendedAction: "Use File Expert enrichment or manual review to complete exact identity fields.",
    }));
  }

  for (const cluster of input.clusters.slice(0, 80)) {
    if (cluster.multiServicePairCount >= 3 && cluster.singleServicePairCount === 0) {
      insights.push(insight({
        type: "multi_service_needs_clean_pairs",
        severity: "warning",
        title: "Multi-service evidence needs controlled clean pairs",
        explanation: "This cluster has multiple multi-service examples, but no clean single-service pair to isolate evidence.",
        scope: cluster.identity.displayLabel,
        supportingMetrics: {
          multiServicePairCount: cluster.multiServicePairCount,
          singleServicePairCount: cluster.singleServicePairCount,
        },
        evidenceRefs: [`/admin/ecu-intelligence/clusters/${encodeURIComponent(cluster.id)}`],
        recommendedAction: "Prioritize a controlled single-service ORI/MOD pair for the strongest service category.",
      }));
    }

    if (cluster.approvedPairCount > 0 && cluster.patternClusterCount === 0) {
      insights.push(insight({
        type: "pattern_gap",
        severity: "info",
        title: "Approved evidence has no pattern cluster yet",
        explanation: "Approved evidence exists, but no pattern cluster currently supports this exact identity.",
        scope: cluster.identity.displayLabel,
        supportingMetrics: {
          approvedPairCount: cluster.approvedPairCount,
          patternClusterCount: cluster.patternClusterCount,
        },
        evidenceRefs: [`/admin/ecu-intelligence/clusters/${encodeURIComponent(cluster.id)}`],
        recommendedAction: "Run or review Level 2 clustering only after the samples are human verified and approved for learning.",
      }));
    }

    if (cluster.mapDefinitionSetCount > 0 && cluster.approvedPairCount === 0) {
      insights.push(insight({
        type: "map_without_pairs",
        severity: "warning",
        title: "Map definitions need approved pair evidence",
        explanation: "Map definition context exists, but trusted ORI/MOD evidence is missing for this exact identity.",
        scope: cluster.identity.displayLabel,
        supportingMetrics: {
          mapDefinitionSetCount: cluster.mapDefinitionSetCount,
          approvedPairCount: cluster.approvedPairCount,
        },
        evidenceRefs: [`/admin/ecu-intelligence/clusters/${encodeURIComponent(cluster.id)}`],
        recommendedAction: "Review pair candidates before treating map definitions as useful evidence.",
      }));
    }

    const dtcCell = cluster.serviceCoverage.find((cell) => cell.category === "dtc");
    if (dtcCell && dtcCell.candidateCount >= 2 && !dtcCell.exactDtcCodes.length) {
      insights.push(insight({
        type: "dtc_controlled_pair_gap",
        severity: "warning",
        title: "DTC evidence is missing exact code labels",
        explanation: "DTC-category evidence exists, but exact DTC codes are not attached, so controlled DTC learning cannot proceed.",
        scope: cluster.identity.displayLabel,
        supportingMetrics: { dtcCandidateCount: dtcCell.candidateCount, exactDtcCodeCount: 0 },
        evidenceRefs: [`/admin/ecu-intelligence/clusters/${encodeURIComponent(cluster.id)}`],
        recommendedAction: "Add human-confirmed exact DTC labels such as P0401 or P2002 before using this evidence.",
      }));
    }

    if (cluster.knowledgeScore.score >= 70 && cluster.readiness !== "RESEARCH_ELIGIBLE") {
      insights.push(insight({
        type: "promising_research_candidate",
        severity: "info",
        title: "Promising cluster still has hard gates",
        explanation: "The knowledge score is strong, but readiness remains gated by missing evidence or hard blockers.",
        scope: cluster.identity.displayLabel,
        supportingMetrics: {
          knowledgeScore: cluster.knowledgeScore.score,
          missingEvidenceCount: cluster.missingEvidenceCount,
        },
        evidenceRefs: [`/admin/ecu-intelligence/clusters/${encodeURIComponent(cluster.id)}`],
        recommendedAction: "Resolve the displayed hard blockers before any internal rule research is considered.",
      }));
    }
  }

  if (!input.metrics.learningFileCandidates && !input.metrics.pairCandidates) {
    insights.push(insight({
      type: "backfill_opportunity",
      severity: "info",
      title: "Learning corpus can be initialized from completed jobs",
      explanation: "No learning candidates are visible yet. The backfill workflow can create review-first candidates from completed orders without approving samples.",
      scope: "global",
      supportingMetrics: { learningFileCandidates: 0, pairCandidates: 0 },
      evidenceRefs: ["/admin/ecu-intelligence/backfill"],
      recommendedAction: "Run a dry-run backfill first, then create candidates only after reviewing the summary.",
    }));
  }

  return insights.slice(0, 50);
}
