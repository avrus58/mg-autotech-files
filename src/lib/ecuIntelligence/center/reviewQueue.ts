import type {
  EcuIntelligenceClusterSummary,
  EcuIntelligenceReviewQueueItem,
  EcuIntelligenceSourceRows,
} from "@/lib/ecuIntelligence/center/types";

function stringValue(value: unknown) {
  return typeof value === "string" ? value : value === null || value === undefined ? "" : String(value);
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function priority(parts: Array<{ code: string; label: string; impact: number }>) {
  return Math.min(100, Math.max(0, parts.reduce((sum, part) => sum + part.impact, 0)));
}

export function buildEcuIntelligenceReviewQueue(input: {
  rows: EcuIntelligenceSourceRows;
  clusters: EcuIntelligenceClusterSummary[];
}): EcuIntelligenceReviewQueueItem[] {
  const items: EcuIntelligenceReviewQueueItem[] = [];

  for (const row of input.rows.learningPairs.slice(0, 500)) {
    const reviewStatus = stringValue(row.review_status);
    const learningStatus = stringValue(row.learning_use_status);
    if (!["pending_review", "needs_review"].includes(reviewStatus) && learningStatus !== "pending") continue;
    const reasons = [
      { code: "pair_candidate", label: "ORI/MOD pair candidate", impact: 22 },
      numberValue(row.quality_score) >= 60 ? { code: "quality", label: "Quality score is usable", impact: 18 } : { code: "quality_low", label: "Quality needs review", impact: 8 },
      stringValue(row.pair_type) === "single_service_clean" ? { code: "single_service", label: "Clean single-service potential", impact: 24 } : { code: "multi_service", label: "Multi-service context", impact: 10 },
      stringValue(row.learning_authorization_status) === "granted" ? { code: "authorized", label: "Learning authorization present", impact: 15 } : { code: "authorization_gap", label: "Authorization must be checked", impact: 4 },
    ];
    items.push({
      id: `learning_pair:${stringValue(row.id)}`,
      sourceType: "learning_pair_candidate",
      title: `Pair candidate ${String(row.id).slice(0, 8)}`,
      scope: stringValue(row.pair_identity_key) || "Unknown exact identity",
      priorityScore: priority(reasons),
      priorityReasons: reasons,
      recommendedAction: "Confirm exact identity, performed services and authorization before any learning approval.",
      createdAt: stringValue(row.created_at) || null,
      adminHref: "/admin/ai-training/corpus",
    });
  }

  for (const row of input.rows.learningFiles.slice(0, 500)) {
    const status = stringValue(row.review_status);
    const conflicts = Array.isArray(row.identity_conflicts) ? row.identity_conflicts.length : 0;
    if (!["pending_review", "needs_review", "quarantined"].includes(status) && !conflicts) continue;
    const reasons = [
      { code: "file_candidate", label: "Learning file candidate", impact: 14 },
      conflicts ? { code: "identity_conflict", label: "Identity conflict exists", impact: 24 } : { code: "identity", label: "Identity can be confirmed", impact: 10 },
      stringValue(row.learning_authorization_status) === "granted" ? { code: "authorized", label: "Authorized", impact: 10 } : { code: "authorization_gap", label: "Authorization missing", impact: 12 },
    ];
    items.push({
      id: `learning_file:${stringValue(row.id)}`,
      sourceType: conflicts ? "identity_conflict" : "learning_file_candidate",
      title: `${stringValue(row.file_role_candidate) || "File"} candidate ${String(row.id).slice(0, 8)}`,
      scope: [row.ecu_family, row.ecu_type, row.hw_number, row.sw_number].filter(Boolean).join(" / ") || "Unknown identity",
      priorityScore: priority(reasons),
      priorityReasons: reasons,
      recommendedAction: "Review File Expert identity and decide whether this candidate remains in the corpus.",
      createdAt: stringValue(row.created_at) || null,
      adminHref: "/admin/ai-training/corpus",
    });
  }

  for (const cluster of input.clusters.slice(0, 100)) {
    if (!cluster.unknownServiceLabels.length && cluster.readiness !== "BLOCKED") continue;
    const reasons = [
      cluster.unknownServiceLabels.length ? { code: "unknown_labels", label: "Unknown service labels", impact: 18 } : { code: "blocked", label: "Blocked readiness", impact: 15 },
      { code: "cluster_value", label: "Exact cluster impact", impact: Math.min(20, cluster.uniqueSourceCount * 4) },
    ];
    items.push({
      id: `cluster:${cluster.id}`,
      sourceType: cluster.unknownServiceLabels.length ? "unknown_service_label" : "identity_conflict",
      title: cluster.unknownServiceLabels.length ? "Resolve unknown service labels" : "Resolve cluster blockers",
      scope: cluster.identity.displayLabel,
      priorityScore: priority(reasons),
      priorityReasons: reasons,
      recommendedAction: "Open the cluster detail and clear deterministic blockers before research.",
      createdAt: cluster.lastObservedAt,
      adminHref: `/admin/ecu-intelligence/clusters/${encodeURIComponent(cluster.id)}`,
    });
  }

  return items.sort((left, right) =>
    right.priorityScore - left.priorityScore ||
    String(left.createdAt || "").localeCompare(String(right.createdAt || ""))
  ).slice(0, 100);
}
