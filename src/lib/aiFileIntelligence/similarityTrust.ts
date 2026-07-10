import { normalizeIdentifier } from "@/lib/aiFileIntelligence/mapDefinitions";
import type { EvidenceTrustLevel } from "@/lib/aiFileIntelligence/types";
import { trainingFeatureKeys, type TrainingServiceLabels } from "@/lib/ecuIntelligence/types";

export type FileIntelligenceMatchCategory =
  | "exact_file_match"
  | "exact_software_match"
  | "strong_same_ecu_service"
  | "usable_same_ecu"
  | "weak_related"
  | "not_trusted"
  | "no_match";

export type FileIntelligenceMatchInput = {
  id: string;
  ori_sha256?: string | null;
  mod_sha256?: string | null;
  file_size?: number | string | null;
  ecu_family?: string | null;
  ecu_type?: string | null;
  sw_number?: string | null;
  hw_number?: string | null;
  service_labels?: Partial<TrainingServiceLabels> | null;
  pattern_region_keys?: string[];
  learning_use_status?: string | null;
  human_verification_status?: string | null;
  data_quality_score?: number | string | null;
  cluster_status?: "none" | "weak" | "usable" | "strong" | "mature";
};

export type FileIntelligenceMatchExplanation = {
  candidate_id: string;
  category: FileIntelligenceMatchCategory;
  trust_level: EvidenceTrustLevel;
  score: number;
  matched_fields: string[];
  missing_fields: string[];
  warnings: string[];
  trusted: boolean;
  recommended_admin_action: string;
};

function numeric(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function activeLabels(labels: Partial<TrainingServiceLabels> | null | undefined) {
  return trainingFeatureKeys.filter((feature) => labels?.[feature]);
}

function labelOverlap(left: Partial<TrainingServiceLabels> | null | undefined, right: Partial<TrainingServiceLabels> | null | undefined) {
  const leftLabels = activeLabels(left);
  const rightLabels = activeLabels(right);
  if (!leftLabels.length || !rightLabels.length) return { overlap: 0, union: Math.max(leftLabels.length, rightLabels.length), labels: [] as string[] };
  const shared = leftLabels.filter((feature) => rightLabels.includes(feature));
  return { overlap: shared.length, union: new Set([...leftLabels, ...rightLabels]).size, labels: shared };
}

function commonRegionRatio(left: string[] | undefined, right: string[] | undefined) {
  if (!left?.length || !right?.length) return 0;
  const rightSet = new Set(right);
  const common = left.filter((item) => rightSet.has(item)).length;
  return common / Math.max(1, new Set([...left, ...right]).size);
}

function isTrustedCandidate(candidate: FileIntelligenceMatchInput) {
  return candidate.learning_use_status === "approved_for_learning" &&
    candidate.human_verification_status === "confirmed" &&
    numeric(candidate.data_quality_score) >= 60;
}

function categoryFor(score: number, trusted: boolean, exactHash: boolean, exactSw: boolean): FileIntelligenceMatchCategory {
  if (!trusted && score > 0) return "not_trusted";
  if (exactHash) return "exact_file_match";
  if (exactSw && score >= 75) return "exact_software_match";
  if (score >= 70) return "strong_same_ecu_service";
  if (score >= 50) return "usable_same_ecu";
  if (score > 0) return "weak_related";
  return "no_match";
}

function trustFor(category: FileIntelligenceMatchCategory): EvidenceTrustLevel {
  if (category === "exact_file_match" || category === "exact_software_match") return "trusted";
  if (category === "strong_same_ecu_service") return "strong";
  if (category === "usable_same_ecu") return "usable";
  if (category === "weak_related") return "weak";
  if (category === "not_trusted") return "untrusted";
  return "unknown";
}

export function explainFileIntelligenceMatch(
  source: FileIntelligenceMatchInput,
  candidate: FileIntelligenceMatchInput
): FileIntelligenceMatchExplanation {
  const matched: string[] = [];
  const missing: string[] = [];
  const warnings: string[] = [];
  let score = 0;

  const exactHash = Boolean(
    (source.ori_sha256 && candidate.ori_sha256 && source.ori_sha256 === candidate.ori_sha256) ||
    (source.mod_sha256 && candidate.mod_sha256 && source.mod_sha256 === candidate.mod_sha256)
  );
  if (exactHash) {
    score += 35;
    matched.push("Exact SHA-256 file fingerprint match.");
  } else {
    missing.push("No exact file fingerprint match.");
  }

  const sourceFamily = normalizeIdentifier(source.ecu_family);
  const candidateFamily = normalizeIdentifier(candidate.ecu_family);
  if (sourceFamily && candidateFamily && sourceFamily === candidateFamily) {
    score += 12;
    matched.push("Same ECU family.");
  } else if (sourceFamily || candidateFamily) {
    warnings.push("ECU family differs or is incomplete.");
  } else missing.push("ECU family is missing.");

  const sourceType = normalizeIdentifier(source.ecu_type);
  const candidateType = normalizeIdentifier(candidate.ecu_type);
  if (sourceType && candidateType && sourceType === candidateType) {
    score += 16;
    matched.push("Same ECU type.");
  } else if (sourceType || candidateType) {
    warnings.push("ECU type differs or is incomplete.");
  } else missing.push("ECU type is missing.");

  const exactSw = Boolean(source.sw_number && candidate.sw_number && normalizeIdentifier(source.sw_number) === normalizeIdentifier(candidate.sw_number));
  if (exactSw) {
    score += 20;
    matched.push("Exact software number match.");
  } else if (source.sw_number || candidate.sw_number) {
    warnings.push("Software number differs or is missing on one side.");
  } else missing.push("Software number is missing.");

  if (source.hw_number && candidate.hw_number && normalizeIdentifier(source.hw_number) === normalizeIdentifier(candidate.hw_number)) {
    score += 8;
    matched.push("Hardware number match.");
  }

  const sourceSize = numeric(source.file_size);
  const candidateSize = numeric(candidate.file_size);
  if (sourceSize && candidateSize) {
    const ratio = Math.min(sourceSize, candidateSize) / Math.max(sourceSize, candidateSize);
    if (ratio === 1) {
      score += 8;
      matched.push("Exact file size match.");
    } else if (ratio >= 0.98) {
      score += 4;
      matched.push("File size is within 2%.");
    } else warnings.push("File size differs materially.");
  } else missing.push("File size comparison unavailable.");

  const labels = labelOverlap(source.service_labels, candidate.service_labels);
  if (labels.overlap) {
    score += Math.round((labels.overlap / Math.max(1, labels.union)) * 14);
    matched.push(`Service label overlap: ${labels.labels.join(", ")}.`);
  } else if (activeLabels(source.service_labels).length || activeLabels(candidate.service_labels).length) {
    warnings.push("No actual service-label overlap.");
  } else missing.push("Service labels are missing.");

  const regionRatio = commonRegionRatio(source.pattern_region_keys, candidate.pattern_region_keys);
  if (regionRatio > 0) {
    score += Math.round(regionRatio * 12);
    matched.push(`Pattern-region bucket overlap ${Math.round(regionRatio * 100)}%.`);
  } else missing.push("No shared pattern-region bucket evidence.");

  const trusted = isTrustedCandidate(candidate);
  if (!trusted) warnings.push("Candidate is not approved + confirmed + quality-gated trusted evidence.");
  if (candidate.cluster_status === "strong" || candidate.cluster_status === "mature") {
    score += 6;
    matched.push(`Cluster maturity is ${candidate.cluster_status}.`);
  } else if (candidate.cluster_status === "weak") warnings.push("Cluster maturity is weak.");

  score += Math.min(5, Math.max(0, (numeric(candidate.data_quality_score) - 60) / 8));
  const finalScore = Math.round(Math.max(0, Math.min(100, score)));
  const category = categoryFor(finalScore, trusted, exactHash, exactSw);
  return {
    candidate_id: candidate.id,
    category,
    trust_level: trustFor(category),
    score: finalScore,
    matched_fields: matched,
    missing_fields: missing,
    warnings,
    trusted: trusted && category !== "not_trusted" && category !== "no_match",
    recommended_admin_action:
      category === "exact_file_match" ? "Inspect this previous file before starting from scratch." :
      category === "exact_software_match" ? "Use as high-value review evidence; still verify maps and checksum." :
      category === "strong_same_ecu_service" ? "Use as supporting evidence with human review." :
      category === "usable_same_ecu" ? "Use as context only; do not copy changes." :
      category === "not_trusted" ? "Review or exclude the candidate before using it." :
      "No useful reference found.",
  };
}

export function rankFileIntelligenceMatches(
  source: FileIntelligenceMatchInput,
  candidates: FileIntelligenceMatchInput[],
  limit = 10
) {
  return candidates
    .filter((candidate) => candidate.id !== source.id)
    .map((candidate) => explainFileIntelligenceMatch(source, candidate))
    .filter((match) => match.category !== "no_match")
    .sort((left, right) => right.score - left.score || left.candidate_id.localeCompare(right.candidate_id))
    .slice(0, Math.max(1, Math.min(limit, 50)));
}
