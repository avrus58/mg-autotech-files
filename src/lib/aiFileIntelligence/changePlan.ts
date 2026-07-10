import { randomUUID } from "crypto";
import type {
  AIChangePlan,
  EvidenceTrustReport,
  GenerationReadinessReport,
  MapAttributionSummary,
} from "@/lib/aiFileIntelligence/types";
import type { TrainingFeature } from "@/lib/ecuIntelligence/types";

export function createLockedAIChangePlan(input: {
  jobId?: string | null;
  sampleId?: string | null;
  serviceLabels: TrainingFeature[];
  evidence: EvidenceTrustReport;
  readiness: GenerationReadinessReport;
  mapAttribution?: MapAttributionSummary | null;
}): AIChangePlan {
  return {
    id: randomUUID(),
    job_id: input.jobId ?? null,
    sample_id: input.sampleId ?? null,
    status: input.readiness.readiness_status === "blocked" ? "blocked" : "draft_evidence_only",
    service_labels: input.serviceLabels,
    evidence_summary: {
      trust_level: input.evidence.trust_level,
      score: input.evidence.score,
      strengths: input.evidence.strengths,
      warnings: input.evidence.warnings,
    },
    map_attribution_summary: input.mapAttribution ?? null,
    proposed_changes: [],
    safety_gates: input.readiness.missing_safety_gates,
    blocked_reasons: input.readiness.blocked_reasons,
    human_review_required: true,
    export_allowed: false,
    customer_visible: false,
    disclaimer:
      "Level 3 change plans are admin-only evidence objects. They are not byte patches, not tuning files and not flash-ready output.",
  };
}
