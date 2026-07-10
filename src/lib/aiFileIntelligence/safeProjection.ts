import type {
  AIChangePlan,
  ChangedRegionAttribution,
  GenerationReadinessReport,
  MapAttributionSummary,
} from "@/lib/aiFileIntelligence/types";

const privateKeyPatterns = [
  /offset/i,
  /raw/i,
  /hex/i,
  /path/i,
  /storage/i,
  /provider/i,
  /source_reference/i,
  /sample/i,
  /admin/i,
  /confidence_score/i,
  /sha/i,
  /hash/i,
  /vin/i,
  /definition_set_id/i,
  /matched_map_definition_id/i,
];

export function stripCustomerPrivateKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripCustomerPrivateKeys);
  if (!value || typeof value !== "object") return value;
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (privateKeyPatterns.some((pattern) => pattern.test(key))) continue;
    output[key] = stripCustomerPrivateKeys(entry);
  }
  return output;
}

export function customerSafeMapAttributionSummary(summary: MapAttributionSummary | null | undefined) {
  if (!summary) return null;
  return {
    status: summary.status === "attributed" ? "evidence_available" : "human_review_required",
    categories: Object.keys(summary.category_counts).filter((category) => category !== "checksum" && category !== "metadata"),
    unknownRegionCount: summary.unknown_region_count,
    humanReviewRequired: true,
    checksumVerificationRequired: true,
    message:
      summary.status === "attributed"
        ? "Internal map evidence is available for admin review. Human tuner verification remains required."
        : "Internal map evidence is limited. Human tuner verification remains required.",
  };
}

export function adminSafeAttribution(attribution: ChangedRegionAttribution) {
  return attribution;
}

export function customerSafeGenerationReadiness(readiness: GenerationReadinessReport | null | undefined) {
  void readiness;
  return {
    status: "admin_review_required",
    message: "File intelligence is reviewed internally by MG AutoTech. Automatic file generation is not customer-visible.",
  };
}

export function customerSafeChangePlan(plan: AIChangePlan | null | undefined) {
  void plan;
  return null;
}

export function hasCustomerPrivateAiLeak(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasCustomerPrivateAiLeak);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value as Record<string, unknown>).some(
    ([key, entry]) => privateKeyPatterns.some((pattern) => pattern.test(key)) || hasCustomerPrivateAiLeak(entry)
  );
}
