import { isAiTrainingDemoEnabled } from "@/lib/ecuIntelligence/demoFixtures";
import {
  patternClusterStatuses,
  trainingFeatureKeys,
  type AccuracyScopeType,
  type AiAccuracyMetric,
  type AiTrainingSample,
  type PatternClusterStatus,
  type RepeatedRegionEvidence,
  type TrainingFeature,
  type TrainingServiceLabels,
} from "@/lib/ecuIntelligence/types";
import type {
  FileExpertAnalyzerResult,
  FileExpertJob,
  FileExpertPatternSignature,
} from "@/lib/fileExpert/types";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const exactSoftwareRegionBucketSize = 0x200;
export const generalEcuRegionBucketSize = 0x1000;
export const minimumClusterQualityScore = 60;

const negativeOutcomes = new Set(["issue_reported", "limp", "smoke", "knock", "needs_revision"]);
const positiveOutcomes = new Set(["customer_ok", "dyno_confirmed"]);

export type ClusteringSample = Pick<
  AiTrainingSample,
  | "id"
  | "ecu_family"
  | "ecu_type"
  | "sw_number"
  | "hw_number"
  | "performed_service_labels"
  | "requested_service_labels"
  | "pattern_signature"
  | "auto_labels_correct"
  | "learning_use_status"
  | "human_verification_status"
  | "data_quality_score"
  | "quality_rating"
  | "source_type"
  | "source_metadata"
  | "outcome"
>;

export type ClusterFilters = {
  ecuFamily?: string | null;
  ecuType?: string | null;
  swNumber?: string | null;
  hwNumber?: string | null;
  featureType?: TrainingFeature | null;
  allowDemoEvidence?: boolean;
};

export type ClusterMembership = {
  training_sample_id: string;
  membership_score: number;
  membership_reasons: string[];
  is_outlier: boolean;
};

export type PatternClusterDraft = {
  cluster_key: string;
  ecu_family: string | null;
  ecu_type: string | null;
  sw_number: string | null;
  hw_number: string | null;
  feature_type: TrainingFeature;
  sample_count: number;
  approved_sample_count: number;
  human_verified_sample_count: number;
  average_quality_score: number;
  cluster_confidence: number;
  cluster_status: PatternClusterStatus;
  repeated_regions: RepeatedRegionEvidence[];
  common_pattern_signature: Record<string, unknown>;
  feature_consistency_json: Record<string, unknown>;
  outlier_sample_ids: string[];
  source_sample_ids: string[];
  memberships: ClusterMembership[];
};

export type AccuracyMetricDraft = Omit<
  AiAccuracyMetric,
  "id" | "created_at" | "updated_at" | "last_calculated_at"
>;

export type AdminClusterEvidence = {
  matchingClusters: number;
  bestStatus: PatternClusterStatus | "none";
  bestConfidence: number;
  message: string;
  humanVerificationRequired: true;
  checksumVerificationRequired: true;
  clusters: Array<{
    id: string;
    ecu_family: string | null;
    ecu_type: string | null;
    sw_number: string | null;
    feature_type: TrainingFeature;
    sample_count: number;
    cluster_confidence: number;
    cluster_status: PatternClusterStatus;
    repeated_regions: RepeatedRegionEvidence[];
  }>;
};

export type PublicClusterEvidence = Omit<AdminClusterEvidence, "clusters">;

function numeric(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value: number, minimum = 0, maximum = 100) {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function normalized(value: string | null | undefined) {
  return value?.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") || "";
}

function normalizedKeyPart(value: string | null | undefined) {
  return normalized(value) || "*";
}

function activeLabels(labels: Partial<TrainingServiceLabels> | null | undefined) {
  return trainingFeatureKeys.filter((feature) => labels?.[feature]);
}

function isDemoSample(sample: ClusteringSample) {
  return sample.source_type === "demo_fixture" || sample.source_metadata?.demo === true;
}

function parseHexOffset(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Number.parseInt(value.replace(/^0x/i, ""), 16);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function hexOffset(value: number) {
  return `0x${Math.max(0, Math.floor(value)).toString(16).toUpperCase().padStart(8, "0")}`;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function createPatternClusterKey(input: {
  ecuFamily?: string | null;
  ecuType?: string | null;
  swNumber?: string | null;
  hwNumber?: string | null;
  featureType: TrainingFeature;
}) {
  return [
    normalizedKeyPart(input.ecuFamily),
    normalizedKeyPart(input.ecuType),
    normalizedKeyPart(input.swNumber),
    normalizedKeyPart(input.hwNumber),
    input.featureType,
  ].join(":");
}

export function isEligibleClusteringSample(
  sample: ClusteringSample,
  options: { allowDemoEvidence?: boolean } = {}
) {
  if (sample.learning_use_status !== "approved_for_learning") return false;
  if (sample.human_verification_status !== "confirmed") return false;
  if (numeric(sample.data_quality_score) < minimumClusterQualityScore) return false;
  if (!sample.pattern_signature) return false;
  if (!activeLabels(sample.performed_service_labels).length) return false;
  if (isDemoSample(sample) && !options.allowDemoEvidence) return false;
  return true;
}

function matchesClusterFilters(sample: ClusteringSample, filters: ClusterFilters) {
  if (filters.ecuFamily && normalized(sample.ecu_family) !== normalized(filters.ecuFamily)) return false;
  if (filters.ecuType && normalized(sample.ecu_type) !== normalized(filters.ecuType)) return false;
  if (filters.swNumber && normalized(sample.sw_number) !== normalized(filters.swNumber)) return false;
  if (filters.hwNumber && normalized(sample.hw_number) !== normalized(filters.hwNumber)) return false;
  if (filters.featureType && !sample.performed_service_labels?.[filters.featureType]) return false;
  return true;
}

const clusteringSampleSelect = [
  "id", "ecu_family", "ecu_type", "sw_number", "hw_number", "performed_service_labels",
  "requested_service_labels", "pattern_signature", "auto_labels_correct", "learning_use_status",
  "human_verification_status", "data_quality_score", "quality_rating", "source_type",
  "source_metadata", "outcome",
].join(", ");

export async function getEligibleSamplesForClustering(filters: ClusterFilters = {}) {
  const allowDemoEvidence = filters.allowDemoEvidence === true && isAiTrainingDemoEnabled();
  const collected: ClusteringSample[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    let query = getSupabaseAdmin()
      .from("ai_training_samples")
      .select(clusteringSampleSelect)
      .eq("learning_use_status", "approved_for_learning")
      .eq("human_verification_status", "confirmed")
      .gte("data_quality_score", minimumClusterQualityScore)
      .not("pattern_signature", "is", null)
      .range(from, from + pageSize - 1);
    if (filters.ecuFamily) query = query.eq("ecu_family", filters.ecuFamily);
    if (filters.ecuType) query = query.eq("ecu_type", filters.ecuType);
    if (filters.swNumber) query = query.eq("sw_number", filters.swNumber);
    if (filters.hwNumber) query = query.eq("hw_number", filters.hwNumber);
    if (filters.featureType) {
      query = query.contains("performed_service_labels", { [filters.featureType]: true });
    }

    const page = await query;
    if (page.error) throw new Error(page.error.message);
    const rows = (page.data ?? []) as unknown as ClusteringSample[];
    collected.push(...rows);
    if (rows.length < pageSize) break;
  }

  return collected.filter((sample) =>
    isEligibleClusteringSample(sample, { allowDemoEvidence }) && matchesClusterFilters(sample, filters)
  );
}

function bucketStartsForSignature(signature: FileExpertPatternSignature, bucketSize: number) {
  const buckets = new Set<number>();
  for (const region of signature.main_regions ?? []) {
    const start = parseHexOffset(region.start_offset_hex);
    const end = parseHexOffset(region.end_offset_hex);
    if (start === null || end === null) continue;
    const first = Math.floor(Math.min(start, end) / bucketSize) * bucketSize;
    const last = Math.floor(Math.max(start, end) / bucketSize) * bucketSize;
    const cappedLast = Math.min(last, first + bucketSize * 63);
    for (let bucket = first; bucket <= cappedLast; bucket += bucketSize) buckets.add(bucket);
  }
  return buckets;
}

export function extractRepeatedRegions(
  samples: ClusteringSample[],
  options: { exactSoftware?: boolean; bucketSize?: number } = {}
): RepeatedRegionEvidence[] {
  const bucketSize = options.bucketSize ??
    (options.exactSoftware ? exactSoftwareRegionBucketSize : generalEcuRegionBucketSize);
  const buckets = new Map<number, { sampleIds: Set<string>; offsets: Set<string> }>();

  for (const sample of samples) {
    const signature = sample.pattern_signature;
    if (!signature) continue;
    const sampleBuckets = new Set<number>();
    for (const region of signature.main_regions ?? []) {
      const start = parseHexOffset(region.start_offset_hex);
      const end = parseHexOffset(region.end_offset_hex);
      if (start === null || end === null) continue;
      const first = Math.floor(Math.min(start, end) / bucketSize) * bucketSize;
      const last = Math.floor(Math.max(start, end) / bucketSize) * bucketSize;
      const cappedLast = Math.min(last, first + bucketSize * 63);
      for (let bucket = first; bucket <= cappedLast; bucket += bucketSize) {
        sampleBuckets.add(bucket);
        const entry = buckets.get(bucket) ?? { sampleIds: new Set<string>(), offsets: new Set<string>() };
        entry.offsets.add(region.start_offset_hex);
        buckets.set(bucket, entry);
      }
    }
    for (const bucket of sampleBuckets) buckets.get(bucket)?.sampleIds.add(sample.id);
  }

  return [...buckets.entries()]
    .filter(([, evidence]) => evidence.sampleIds.size >= 2)
    .map(([bucketStart, evidence]) => {
      const occurrenceCount = evidence.sampleIds.size;
      const occurrenceRate = samples.length ? occurrenceCount / samples.length : 0;
      const support = Math.min(1, occurrenceCount / 20);
      const confidence = round(clamp((occurrenceRate * 0.75 + support * 0.25) * 100) / 100, 3);
      return {
        bucket_start_hex: hexOffset(bucketStart),
        bucket_end_hex: hexOffset(bucketStart + bucketSize - 1),
        occurrence_count: occurrenceCount,
        occurrence_rate: round(occurrenceRate, 3),
        representative_offsets: [...evidence.offsets].sort().slice(0, 8),
        confidence,
        reason: `Repeated in ${occurrenceCount} of ${samples.length} approved ${samples.length === 1 ? "sample" : "samples"}`,
        notes: options.exactSoftware
          ? `Strict ${hexOffset(bucketSize)} bucket for the same software identifier.`
          : `Conservative ${hexOffset(bucketSize)} bucket; this does not prove an exact map identity.`,
      };
    })
    .sort((left, right) =>
      right.occurrence_count - left.occurrence_count || left.bucket_start_hex.localeCompare(right.bucket_start_hex)
    )
    .slice(0, 100);
}

function predictedLabels(sample: ClusteringSample) {
  const candidates = sample.pattern_signature?.feature_candidates ??
    sample.pattern_signature?.feature_hint_summary ?? [];
  return trainingFeatureKeys.filter((feature) =>
    candidates.some((candidate) => candidate.feature === feature && candidate.confidence >= 0.5)
  );
}

export function calculateFeatureConsistency(samples: ClusteringSample[], featureType: TrainingFeature) {
  const requestedMatches = samples.filter((sample) => sample.requested_service_labels?.[featureType]).length;
  const predictedMatches = samples.filter((sample) => predictedLabels(sample).includes(featureType)).length;
  const multiLabelSamples = samples.filter((sample) => activeLabels(sample.performed_service_labels).length > 1).length;
  const coOccurringLabels = Object.fromEntries(
    trainingFeatureKeys
      .filter((feature) => feature !== featureType)
      .map((feature) => [
        feature,
        samples.filter((sample) => sample.performed_service_labels?.[feature]).length,
      ])
      .filter(([, count]) => Number(count) > 0)
  );

  return {
    feature_type: featureType,
    actual_label_consistency: samples.length ? 1 : 0,
    requested_label_match_rate: samples.length ? round(requestedMatches / samples.length, 3) : 0,
    automatic_feature_support_rate: samples.length ? round(predictedMatches / samples.length, 3) : 0,
    multi_label_rate: samples.length ? round(multiLabelSamples / samples.length, 3) : 0,
    multi_label_sample_count: multiLabelSamples,
    co_occurring_labels: coOccurringLabels,
    evidence_note: "Actual performed labels are human-confirmed evidence; automatic labels remain measured predictions.",
  };
}

function changedBytes(sample: ClusteringSample) {
  return numeric(sample.pattern_signature?.changed_bytes);
}

export function detectClusterOutliers(input: {
  samples: ClusteringSample[];
  repeatedRegions: RepeatedRegionEvidence[];
  featureType: TrainingFeature;
  exactSoftware?: boolean;
}) {
  const bucketSize = input.exactSoftware ? exactSoftwareRegionBucketSize : generalEcuRegionBucketSize;
  const repeatedBuckets = new Set(
    input.repeatedRegions.map((region) => parseHexOffset(region.bucket_start_hex)).filter((value): value is number => value !== null)
  );
  const typicalChangedBytes = median(input.samples.map(changedBytes).filter((value) => value > 0));

  return input.samples.map<ClusterMembership>((sample) => {
    const reasons: string[] = [];
    const sampleBuckets = sample.pattern_signature
      ? bucketStartsForSignature(sample.pattern_signature, bucketSize)
      : new Set<number>();
    const matchedBuckets = [...sampleBuckets].filter((bucket) => repeatedBuckets.has(bucket)).length;
    const denominator = Math.max(1, Math.min(sampleBuckets.size, repeatedBuckets.size));
    const regionMatchRate = repeatedBuckets.size ? matchedBuckets / denominator : 0.5;
    let score = regionMatchRate * 40;
    reasons.push(repeatedBuckets.size
      ? `${matchedBuckets} repeated region bucket${matchedBuckets === 1 ? "" : "s"} matched.`
      : "Cluster has too little repeated-region evidence; region score is neutral.");

    const bytes = changedBytes(sample);
    let byteConsistency = 0.5;
    if (typicalChangedBytes > 0 && bytes > 0) {
      const ratio = Math.min(bytes, typicalChangedBytes) / Math.max(bytes, typicalChangedBytes);
      byteConsistency = Math.sqrt(ratio);
    }
    score += byteConsistency * 20;
    reasons.push(`Changed-byte consistency: ${Math.round(byteConsistency * 100)}%.`);

    score += (clamp(numeric(sample.data_quality_score), 60, 100) / 100) * 15;
    const automaticSupport = predictedLabels(sample).includes(input.featureType);
    if (automaticSupport) {
      score += 15;
      reasons.push("Automatic analyzer evidence supports the confirmed feature label.");
    } else {
      reasons.push("Automatic analyzer evidence does not clearly support this feature label.");
    }

    if (positiveOutcomes.has(sample.outcome || "")) {
      score += 10;
      reasons.push("A positive customer or dyno outcome is recorded.");
    } else if (!sample.outcome || sample.outcome === "unknown") {
      score += 5;
      reasons.push("Outcome is unknown.");
    }

    const negativeOutcome = negativeOutcomes.has(sample.outcome || "");
    if (negativeOutcome) {
      score -= 30;
      reasons.push(`Negative or unresolved outcome: ${sample.outcome}.`);
    }

    const membershipScore = Math.round(clamp(score));
    return {
      training_sample_id: sample.id,
      membership_score: membershipScore,
      membership_reasons: reasons,
      is_outlier: negativeOutcome || membershipScore < 35,
    };
  });
}

export function calculateClusterConfidence(input: {
  samples: ClusteringSample[];
  repeatedRegions: RepeatedRegionEvidence[];
  featureConsistency: ReturnType<typeof calculateFeatureConsistency>;
  memberships: ClusterMembership[];
  exactSoftware?: boolean;
}) {
  const sampleCount = input.samples.length;
  const averageQuality = sampleCount
    ? input.samples.reduce((sum, sample) => sum + numeric(sample.data_quality_score), 0) / sampleCount
    : 0;
  const sampleSupport = Math.min(30, sampleCount * 1.5);
  const repeatedConsistency = input.repeatedRegions.length
    ? input.repeatedRegions.slice(0, 12).reduce((sum, region) => sum + region.occurrence_rate, 0) /
      Math.min(12, input.repeatedRegions.length)
    : 0;
  const outlierRate = sampleCount
    ? input.memberships.filter((member) => member.is_outlier).length / sampleCount
    : 0;
  const positiveOutcomeRate = sampleCount
    ? input.samples.filter((sample) => positiveOutcomes.has(sample.outcome || "")).length / sampleCount
    : 0;
  const negativeOutcomeRate = sampleCount
    ? input.samples.filter((sample) => negativeOutcomes.has(sample.outcome || "")).length / sampleCount
    : 0;

  let score = sampleSupport;
  score += (averageQuality / 100) * 25;
  score += repeatedConsistency * 20;
  score += numeric(input.featureConsistency.actual_label_consistency) * 15;
  score += input.exactSoftware ? 5 : 0;
  score += positiveOutcomeRate * 5;
  if (sampleCount < 5) score -= 20;
  if (!input.exactSoftware) score -= 5;
  score -= outlierRate * 20;
  score -= negativeOutcomeRate * 10;
  return Math.round(clamp(score));
}

export function clusterStatusFor(sampleCount: number, confidence: number): PatternClusterStatus {
  if (sampleCount >= 100 && confidence >= 80) return "mature";
  if (sampleCount >= 20 && confidence >= 65) return "strong";
  if (sampleCount >= 5 && confidence >= 40) return "usable";
  return "weak";
}

function commonPatternSignature(samples: ClusteringSample[], bucketSize: number) {
  const mapTypes = new Map<string, number>();
  const repeatedSignatures = new Map<string, number>();
  for (const sample of samples) {
    for (const candidate of sample.pattern_signature?.map_candidates_summary ?? []) {
      const key = candidate.possible_type || "unknown";
      mapTypes.set(key, (mapTypes.get(key) ?? 0) + 1);
    }
    for (const pattern of sample.pattern_signature?.repeated_patterns_summary ?? []) {
      repeatedSignatures.set(pattern.signature, (repeatedSignatures.get(pattern.signature) ?? 0) + 1);
    }
  }
  const changed = samples.map(changedBytes).filter((value) => value > 0);
  return {
    evidence_only: true,
    bucket_size_hex: hexOffset(bucketSize),
    changed_bytes_median: Math.round(median(changed)),
    changed_bytes_average: changed.length
      ? Math.round(changed.reduce((sum, value) => sum + value, 0) / changed.length)
      : 0,
    common_map_candidate_types: [...mapTypes.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 12)
      .map(([type, count]) => ({ type, sample_occurrences: count })),
    common_repeated_signatures: [...repeatedSignatures.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 12)
      .map(([signature, count]) => ({ signature, sample_occurrences: count })),
    warning: "Pattern evidence is not a verified map definition and is never write-ready output.",
  };
}

export function buildPatternCluster(input: ClusterFilters & {
  featureType: TrainingFeature;
  samples: ClusteringSample[];
}): PatternClusterDraft {
  const samples = input.samples.filter((sample) =>
    isEligibleClusteringSample(sample, { allowDemoEvidence: input.allowDemoEvidence }) &&
    matchesClusterFilters(sample, input)
  );
  const exactSoftware = Boolean(input.swNumber);
  const bucketSize = exactSoftware ? exactSoftwareRegionBucketSize : generalEcuRegionBucketSize;
  const repeatedRegions = extractRepeatedRegions(samples, { exactSoftware, bucketSize });
  const featureConsistency = calculateFeatureConsistency(samples, input.featureType);
  const memberships = detectClusterOutliers({
    samples,
    repeatedRegions,
    featureType: input.featureType,
    exactSoftware,
  });
  const confidence = calculateClusterConfidence({
    samples,
    repeatedRegions,
    featureConsistency,
    memberships,
    exactSoftware,
  });
  const averageQuality = samples.length
    ? samples.reduce((sum, sample) => sum + numeric(sample.data_quality_score), 0) / samples.length
    : 0;

  return {
    cluster_key: createPatternClusterKey(input),
    ecu_family: input.ecuFamily || null,
    ecu_type: input.ecuType || null,
    sw_number: input.swNumber || null,
    hw_number: input.hwNumber || null,
    feature_type: input.featureType,
    sample_count: samples.length,
    approved_sample_count: samples.length,
    human_verified_sample_count: samples.length,
    average_quality_score: round(averageQuality, 1),
    cluster_confidence: confidence,
    cluster_status: clusterStatusFor(samples.length, confidence),
    repeated_regions: repeatedRegions,
    common_pattern_signature: commonPatternSignature(samples, bucketSize),
    feature_consistency_json: featureConsistency,
    outlier_sample_ids: memberships.filter((member) => member.is_outlier).map((member) => member.training_sample_id),
    source_sample_ids: samples.map((sample) => sample.id),
    memberships,
  };
}

function assessmentFor(sample: ClusteringSample) {
  if (sample.human_verification_status !== "confirmed") return null;
  const actual = activeLabels(sample.performed_service_labels);
  const predicted = predictedLabels(sample);
  if (!actual.length) return null;
  if (sample.auto_labels_correct === true) return { result: "correct" as const, actual, predicted };
  const intersection = predicted.filter((feature) => actual.includes(feature));
  if (sample.auto_labels_correct === false) {
    return { result: intersection.length ? "partial" as const : "wrong" as const, actual, predicted };
  }
  if (!predicted.length) return null;
  if (predicted.length === actual.length && intersection.length === actual.length) {
    return { result: "correct" as const, actual, predicted };
  }
  return { result: intersection.length ? "partial" as const : "wrong" as const, actual, predicted };
}

function metricForScope(scopeType: AccuracyScopeType, scopeKey: string, samples: ClusteringSample[]): AccuracyMetricDraft {
  const assessed = samples
    .map((sample) => ({ sample, assessment: assessmentFor(sample) }))
    .filter((item): item is { sample: ClusteringSample; assessment: NonNullable<ReturnType<typeof assessmentFor>> } => Boolean(item.assessment));
  const correct = assessed.filter((item) => item.assessment.result === "correct").length;
  const partial = assessed.filter((item) => item.assessment.result === "partial").length;
  const wrong = assessed.filter((item) => item.assessment.result === "wrong").length;
  const confusion: Record<string, number> = {};
  for (const { assessment } of assessed) {
    const predicted = assessment.predicted.length ? assessment.predicted : ["none"];
    for (const predictedLabel of predicted) {
      for (const actualLabel of assessment.actual) {
        const key = `${predictedLabel}->${actualLabel}`;
        confusion[key] = (confusion[key] ?? 0) + 1;
      }
    }
  }
  const qualityValues = assessed.map((item) => numeric(item.sample.data_quality_score)).filter((value) => value > 0);
  return {
    scope_type: scopeType,
    scope_key: scopeKey,
    total_reviewed: assessed.length,
    auto_label_correct: correct,
    auto_label_partial: partial,
    auto_label_wrong: wrong,
    precision_score: assessed.length ? round(((correct + partial * 0.5) / assessed.length) * 100, 1) : 0,
    review_coverage: samples.length ? round((assessed.length / samples.length) * 100, 1) : 0,
    average_quality_score: qualityValues.length
      ? round(qualityValues.reduce((sum, value) => sum + value, 0) / qualityValues.length, 1)
      : 0,
    confusion_json: {
      insufficient_data: assessed.length === 0,
      pairs: confusion,
      note: assessed.length
        ? "Precision gives partial matches half credit and never implies calibration safety."
        : "Not enough human-reviewed automatic-label data.",
    },
  };
}

export function calculateAccuracyMetrics(
  samples: ClusteringSample[],
  clusterMemberships: Array<{ clusterKey: string; sampleIds: string[] }> = []
) {
  const metrics: AccuracyMetricDraft[] = [metricForScope("global", "all", samples)];
  const groups = new Map<string, { type: AccuracyScopeType; key: string; samples: ClusteringSample[] }>();
  const add = (type: AccuracyScopeType, key: string, sample: ClusteringSample) => {
    if (!key) return;
    const groupKey = `${type}:${key}`;
    const group = groups.get(groupKey) ?? { type, key, samples: [] };
    if (!group.samples.some((existing) => existing.id === sample.id)) group.samples.push(sample);
    groups.set(groupKey, group);
  };
  for (const sample of samples) {
    if (sample.ecu_family) add("ecu_family", sample.ecu_family, sample);
    if (sample.ecu_type) add("ecu_type", sample.ecu_type, sample);
    for (const feature of activeLabels(sample.performed_service_labels)) add("feature_type", feature, sample);
  }
  for (const cluster of clusterMemberships) {
    const ids = new Set(cluster.sampleIds);
    const members = samples.filter((sample) => ids.has(sample.id));
    groups.set(`cluster:${cluster.clusterKey}`, { type: "cluster", key: cluster.clusterKey, samples: members });
  }
  for (const group of groups.values()) metrics.push(metricForScope(group.type, group.key, group.samples));
  return metrics;
}

function groupInputs(samples: ClusteringSample[]) {
  const groups = new Map<string, ClusterFilters & { featureType: TrainingFeature }>();
  for (const sample of samples) {
    if (!sample.ecu_family && !sample.ecu_type) continue;
    for (const featureType of activeLabels(sample.performed_service_labels)) {
      const general = {
        ecuFamily: sample.ecu_family,
        ecuType: sample.ecu_type,
        swNumber: null,
        hwNumber: null,
        featureType,
      };
      groups.set(createPatternClusterKey(general), general);
      if (sample.sw_number) {
        const exact = {
          ecuFamily: sample.ecu_family,
          ecuType: sample.ecu_type,
          swNumber: sample.sw_number,
          hwNumber: sample.hw_number,
          featureType,
        };
        groups.set(createPatternClusterKey(exact), exact);
      }
    }
  }
  return [...groups.values()];
}

async function logClusterEvent(input: {
  eventType: string;
  actorUserId?: string | null;
  trainingSampleId?: string | null;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  await getSupabaseAdmin().from("ai_training_events").insert({
    event_type: input.eventType,
    actor_user_id: input.actorUserId ?? null,
    training_sample_id: input.trainingSampleId ?? null,
    message: input.message,
    metadata: input.metadata ?? {},
  });
}

async function persistPatternCluster(draft: PatternClusterDraft) {
  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();
  const saved = await admin.from("ai_pattern_clusters").upsert({
    cluster_key: draft.cluster_key,
    ecu_family: draft.ecu_family,
    ecu_type: draft.ecu_type,
    sw_number: draft.sw_number,
    hw_number: draft.hw_number,
    feature_type: draft.feature_type,
    sample_count: draft.sample_count,
    approved_sample_count: draft.approved_sample_count,
    human_verified_sample_count: draft.human_verified_sample_count,
    average_quality_score: draft.average_quality_score,
    cluster_confidence: draft.cluster_confidence,
    cluster_status: draft.cluster_status,
    repeated_regions: draft.repeated_regions,
    common_pattern_signature: draft.common_pattern_signature,
    feature_consistency_json: draft.feature_consistency_json,
    outlier_sample_ids: draft.outlier_sample_ids,
    source_sample_ids: draft.source_sample_ids,
    last_rebuilt_at: now,
  }, { onConflict: "cluster_key" }).select("id").single();
  if (saved.error || !saved.data) throw new Error(saved.error?.message || "Pattern cluster could not be saved.");
  const clusterId = String(saved.data.id);
  const removed = await admin.from("ai_cluster_members").delete().eq("cluster_id", clusterId);
  if (removed.error) throw new Error(removed.error.message);
  if (draft.memberships.length) {
    const inserted = await admin.from("ai_cluster_members").insert(draft.memberships.map((member) => ({
      cluster_id: clusterId,
      training_sample_id: member.training_sample_id,
      membership_score: member.membership_score,
      membership_reasons: member.membership_reasons,
      is_outlier: member.is_outlier,
    })));
    if (inserted.error) throw new Error(inserted.error.message);
  }
  return clusterId;
}

async function getAccuracySamples() {
  const collected: ClusteringSample[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const page = await getSupabaseAdmin()
      .from("ai_training_samples")
      .select(clusteringSampleSelect)
      .range(from, from + pageSize - 1);
    if (page.error) throw new Error(page.error.message);
    const rows = (page.data ?? []) as unknown as ClusteringSample[];
    collected.push(...rows.filter((sample) => !isDemoSample(sample) || isAiTrainingDemoEnabled()));
    if (rows.length < pageSize) break;
  }
  return collected;
}

async function storeAccuracyMetrics(
  metrics: AccuracyMetricDraft[],
  options: { retireMissing?: boolean } = { retireMissing: true }
) {
  if (!metrics.length) return;
  const admin = getSupabaseAdmin();
  const saved = await admin.from("ai_accuracy_metrics").upsert(
    metrics.map((metric) => ({ ...metric, last_calculated_at: new Date().toISOString() })),
    { onConflict: "scope_type,scope_key" }
  );
  if (saved.error) throw new Error(saved.error.message);

  if (options.retireMissing === false) return;
  const activeKeys = new Set(metrics.map((metric) => `${metric.scope_type}:${metric.scope_key}`));
  const existing = await admin.from("ai_accuracy_metrics").select("id, scope_type, scope_key");
  if (existing.error) throw new Error(existing.error.message);
  for (const metric of existing.data ?? []) {
    if (activeKeys.has(`${metric.scope_type}:${metric.scope_key}`)) continue;
    const retired = await admin.from("ai_accuracy_metrics").update({
      total_reviewed: 0,
      auto_label_correct: 0,
      auto_label_partial: 0,
      auto_label_wrong: 0,
      precision_score: 0,
      review_coverage: 0,
      average_quality_score: 0,
      confusion_json: {
        insufficient_data: true,
        pairs: {},
        note: "This scope has no current reviewed evidence after the latest rebuild.",
      },
      last_calculated_at: new Date().toISOString(),
    }).eq("id", metric.id);
    if (retired.error) throw new Error(retired.error.message);
  }
}

async function retireStalePatternClusters(activeClusterKeys: Set<string>) {
  const admin = getSupabaseAdmin();
  const existing = await admin.from("ai_pattern_clusters").select("id, cluster_key");
  if (existing.error) throw new Error(existing.error.message);
  for (const cluster of existing.data ?? []) {
    if (activeClusterKeys.has(cluster.cluster_key)) continue;
    const members = await admin.from("ai_cluster_members").delete().eq("cluster_id", cluster.id);
    if (members.error) throw new Error(members.error.message);
    const retired = await admin.from("ai_pattern_clusters").update({
      sample_count: 0,
      approved_sample_count: 0,
      human_verified_sample_count: 0,
      average_quality_score: 0,
      cluster_confidence: 0,
      cluster_status: "weak",
      repeated_regions: [],
      common_pattern_signature: {
        evidence_only: true,
        retired: true,
        warning: "No current eligible samples remain after the latest rebuild.",
      },
      feature_consistency_json: { insufficient_data: true },
      outlier_sample_ids: [],
      source_sample_ids: [],
      last_rebuilt_at: new Date().toISOString(),
    }).eq("id", cluster.id);
    if (retired.error) throw new Error(retired.error.message);
  }
}

function statusRank(status: PatternClusterStatus | "no_data") {
  return ["no_data", ...patternClusterStatuses].indexOf(status);
}

type KnowledgeClusterSummary = Pick<
  PatternClusterDraft,
  "ecu_family" | "ecu_type" | "sw_number" | "cluster_status" | "outlier_sample_ids"
>;

async function updateKnowledgeProfilesFromClusters(
  clusters: KnowledgeClusterSummary[],
  metrics: AccuracyMetricDraft[]
) {
  const admin = getSupabaseAdmin();
  const profiles = await admin
    .from("ai_ecu_knowledge_profiles")
    .select("id, ecu_family, ecu_type, sw_number, hw_number");
  if (profiles.error) throw new Error(profiles.error.message);
  for (const profile of profiles.data ?? []) {
    const matching = clusters.filter((cluster) =>
      (!profile.ecu_family || normalized(cluster.ecu_family) === normalized(profile.ecu_family)) &&
      (!profile.ecu_type || normalized(cluster.ecu_type) === normalized(profile.ecu_type)) &&
      (!cluster.sw_number || !profile.sw_number || normalized(cluster.sw_number) === normalized(profile.sw_number))
    );
    const readiness = matching.reduce<PatternClusterStatus | "no_data">(
      (best, cluster) => statusRank(cluster.cluster_status) > statusRank(best) ? cluster.cluster_status : best,
      "no_data"
    );
    const familyMetric = metrics.find((metric) =>
      metric.scope_type === "ecu_family" && normalized(metric.scope_key) === normalized(profile.ecu_family)
    );
    const typeMetric = metrics.find((metric) =>
      metric.scope_type === "ecu_type" && normalized(metric.scope_key) === normalized(profile.ecu_type)
    );
    const outlierIds = new Set(matching.flatMap((cluster) => cluster.outlier_sample_ids));
    const updated = await admin.from("ai_ecu_knowledge_profiles").update({
      cluster_count: matching.length,
      strong_cluster_count: matching.filter((cluster) => cluster.cluster_status === "strong" || cluster.cluster_status === "mature").length,
      usable_cluster_count: matching.filter((cluster) => cluster.cluster_status === "usable").length,
      weak_cluster_count: matching.filter((cluster) => cluster.cluster_status === "weak").length,
      outlier_count: outlierIds.size,
      pattern_clustering_readiness: readiness,
      accuracy_summary: typeMetric || familyMetric || null,
    }).eq("id", profile.id);
    if (updated.error) throw new Error(updated.error.message);
  }
}

async function getStoredKnowledgeClusterSummaries(): Promise<KnowledgeClusterSummary[]> {
  const rows = await getSupabaseAdmin().from("ai_pattern_clusters")
    .select("ecu_family, ecu_type, sw_number, cluster_status, outlier_sample_ids")
    .gt("sample_count", 0);
  if (rows.error) throw new Error(rows.error.message);
  return (rows.data ?? []).map((cluster) => ({
    ecu_family: cluster.ecu_family,
    ecu_type: cluster.ecu_type,
    sw_number: cluster.sw_number,
    cluster_status: cluster.cluster_status as PatternClusterStatus,
    outlier_sample_ids: Array.isArray(cluster.outlier_sample_ids) ? cluster.outlier_sample_ids : [],
  }));
}

export async function rebuildAllPatternClusters(options: {
  actorUserId?: string | null;
  allowDemoEvidence?: boolean;
} = {}) {
  await logClusterEvent({
    eventType: "pattern_cluster_rebuild_started",
    actorUserId: options.actorUserId,
    message: "Level 2 pattern cluster rebuild started.",
  }).catch(() => undefined);
  try {
    const samples = await getEligibleSamplesForClustering({ allowDemoEvidence: options.allowDemoEvidence });
    const inputs = groupInputs(samples);
    const clusters: PatternClusterDraft[] = [];
    const persisted: Array<{ clusterKey: string; sampleIds: string[] }> = [];
    for (const input of inputs) {
      const draft = buildPatternCluster({ ...input, samples, allowDemoEvidence: options.allowDemoEvidence });
      const clusterId = await persistPatternCluster(draft);
      clusters.push(draft);
      persisted.push({ clusterKey: draft.cluster_key, sampleIds: draft.source_sample_ids });
      await logClusterEvent({
        eventType: "cluster_member_added",
        actorUserId: options.actorUserId,
        message: `${draft.memberships.length} approved samples were evaluated for ${draft.feature_type}.`,
        metadata: { cluster_id: clusterId, cluster_key: draft.cluster_key, member_count: draft.memberships.length },
      }).catch(() => undefined);
      if (draft.outlier_sample_ids.length) {
        await logClusterEvent({
          eventType: "cluster_outlier_detected",
          actorUserId: options.actorUserId,
          message: `${draft.outlier_sample_ids.length} cluster outliers require human review.`,
          metadata: { cluster_id: clusterId, outlier_count: draft.outlier_sample_ids.length },
        }).catch(() => undefined);
      }
    }
    await retireStalePatternClusters(new Set(clusters.map((cluster) => cluster.cluster_key)));

    const accuracySamples = await getAccuracySamples();
    const metrics = calculateAccuracyMetrics(accuracySamples, persisted);
    await storeAccuracyMetrics(metrics);
    await updateKnowledgeProfilesFromClusters(clusters, metrics);
    await logClusterEvent({
      eventType: "accuracy_metrics_calculated",
      actorUserId: options.actorUserId,
      message: `${metrics.length} Level 2 accuracy scopes were calculated.`,
    }).catch(() => undefined);
    await logClusterEvent({
      eventType: "pattern_cluster_rebuild_completed",
      actorUserId: options.actorUserId,
      message: `${clusters.length} evidence-only pattern clusters were rebuilt from ${samples.length} trusted samples.`,
      metadata: { cluster_count: clusters.length, eligible_samples: samples.length },
    }).catch(() => undefined);
    return { clusters, metrics, eligibleSampleCount: samples.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pattern cluster rebuild failed.";
    await logClusterEvent({
      eventType: "pattern_cluster_rebuild_failed",
      actorUserId: options.actorUserId,
      message,
    }).catch(() => undefined);
    throw error;
  }
}

export async function rebuildPatternClusterById(
  clusterId: string,
  options: { actorUserId?: string | null; allowDemoEvidence?: boolean } = {}
) {
  await logClusterEvent({
    eventType: "pattern_cluster_rebuild_started",
    actorUserId: options.actorUserId,
    message: `Level 2 rebuild started for cluster ${clusterId}.`,
    metadata: { cluster_id: clusterId },
  }).catch(() => undefined);
  try {
    const current = await getSupabaseAdmin().from("ai_pattern_clusters").select("*").eq("id", clusterId).single();
    if (current.error || !current.data) throw new Error(current.error?.message || "Pattern cluster not found.");
    const samples = await getEligibleSamplesForClustering({
      ecuFamily: current.data.ecu_family,
      ecuType: current.data.ecu_type,
      swNumber: current.data.sw_number,
      hwNumber: current.data.hw_number,
      featureType: current.data.feature_type as TrainingFeature,
      allowDemoEvidence: options.allowDemoEvidence,
    });
    const draft = buildPatternCluster({
      ecuFamily: current.data.ecu_family,
      ecuType: current.data.ecu_type,
      swNumber: current.data.sw_number,
      hwNumber: current.data.hw_number,
      featureType: current.data.feature_type as TrainingFeature,
      allowDemoEvidence: options.allowDemoEvidence,
      samples,
    });
    await persistPatternCluster(draft);
    const accuracySamples = await getAccuracySamples();
    const metrics = calculateAccuracyMetrics(accuracySamples, [{
      clusterKey: draft.cluster_key,
      sampleIds: draft.source_sample_ids,
    }]);
    await storeAccuracyMetrics(metrics, { retireMissing: false });
    await updateKnowledgeProfilesFromClusters(await getStoredKnowledgeClusterSummaries(), metrics);
    await logClusterEvent({
      eventType: "cluster_member_added",
      actorUserId: options.actorUserId,
      message: `${draft.memberships.length} approved samples were evaluated for ${draft.feature_type}.`,
      metadata: { cluster_id: clusterId, cluster_key: draft.cluster_key, member_count: draft.memberships.length },
    }).catch(() => undefined);
    if (draft.outlier_sample_ids.length) {
      await logClusterEvent({
        eventType: "cluster_outlier_detected",
        actorUserId: options.actorUserId,
        message: `${draft.outlier_sample_ids.length} cluster outliers require human review.`,
        metadata: { cluster_id: clusterId, outlier_count: draft.outlier_sample_ids.length },
      }).catch(() => undefined);
    }
    await logClusterEvent({
      eventType: "accuracy_metrics_calculated",
      actorUserId: options.actorUserId,
      message: `Accuracy metrics were refreshed for cluster ${draft.cluster_key}.`,
      metadata: { cluster_id: clusterId, cluster_key: draft.cluster_key },
    }).catch(() => undefined);
    await logClusterEvent({
      eventType: "pattern_cluster_rebuild_completed",
      actorUserId: options.actorUserId,
      message: `Cluster ${draft.cluster_key} was rebuilt from ${draft.sample_count} trusted samples.`,
      metadata: { cluster_id: clusterId, cluster_key: draft.cluster_key },
    }).catch(() => undefined);
    return draft;
  } catch (error) {
    await logClusterEvent({
      eventType: "pattern_cluster_rebuild_failed",
      actorUserId: options.actorUserId,
      message: error instanceof Error ? error.message : "Pattern cluster rebuild failed.",
      metadata: { cluster_id: clusterId },
    }).catch(() => undefined);
    throw error;
  }
}

export function buildPublicClusterEvidence(evidence: AdminClusterEvidence): PublicClusterEvidence {
  return {
    matchingClusters: evidence.matchingClusters,
    bestStatus: evidence.bestStatus,
    bestConfidence: evidence.bestConfidence,
    message: evidence.matchingClusters
      ? "Approved pattern evidence exists for this ECU/service family. Human tuner verification remains required."
      : "No approved pattern cluster evidence is available. Confidence is limited and human tuner verification is required.",
    humanVerificationRequired: true,
    checksumVerificationRequired: true,
  };
}

export async function findClusterEvidenceForFileExpert(
  job: FileExpertJob,
  result: FileExpertAnalyzerResult
): Promise<AdminClusterEvidence> {
  const ecuFamily = result.ecu_identification?.family || job.ecu_family;
  const ecuType = result.ecu_identification?.display_name || job.ecu_type;
  if (!ecuFamily && !ecuType) {
    return {
      matchingClusters: 0,
      bestStatus: "none",
      bestConfidence: 0,
      message: "ECU metadata is insufficient for cluster evidence.",
      humanVerificationRequired: true,
      checksumVerificationRequired: true,
      clusters: [],
    };
  }
  let query = getSupabaseAdmin().from("ai_pattern_clusters")
    .select("id, ecu_family, ecu_type, sw_number, feature_type, sample_count, cluster_confidence, cluster_status, repeated_regions")
    .gt("sample_count", 0)
    .order("cluster_confidence", { ascending: false })
    .limit(100);
  if (ecuFamily) query = query.eq("ecu_family", ecuFamily);
  else if (ecuType) query = query.eq("ecu_type", ecuType);
  const rows = await query;
  if (rows.error) throw new Error(rows.error.message);
  const likelyFeatures = new Set(
    result.possible_features.filter((feature) => feature.confidence >= 0.5).map((feature) => feature.feature)
  );
  const matches = (rows.data ?? [])
    .filter((cluster) =>
      (!ecuType || normalized(cluster.ecu_type) === normalized(ecuType)) &&
      (!likelyFeatures.size || likelyFeatures.has(cluster.feature_type))
    )
    .slice(0, 8)
    .map((cluster) => ({
      id: String(cluster.id),
      ecu_family: cluster.ecu_family,
      ecu_type: cluster.ecu_type,
      sw_number: cluster.sw_number,
      feature_type: cluster.feature_type as TrainingFeature,
      sample_count: Number(cluster.sample_count || 0),
      cluster_confidence: numeric(cluster.cluster_confidence),
      cluster_status: cluster.cluster_status as PatternClusterStatus,
      repeated_regions: Array.isArray(cluster.repeated_regions)
        ? cluster.repeated_regions as RepeatedRegionEvidence[]
        : [],
    }));
  const best = matches[0];
  return {
    matchingClusters: matches.length,
    bestStatus: best?.cluster_status || "none",
    bestConfidence: best?.cluster_confidence || 0,
    message: matches.length
      ? `${matches.length} approved pattern clusters match this ECU/service evidence.`
      : "No approved pattern cluster evidence matched this analysis.",
    humanVerificationRequired: true,
    checksumVerificationRequired: true,
    clusters: matches,
  };
}
