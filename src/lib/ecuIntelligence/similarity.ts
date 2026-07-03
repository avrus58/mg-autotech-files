import { isAiTrainingDemoEnabled } from "@/lib/ecuIntelligence/demoFixtures";
import {
  trainingFeatureKeys,
  type AiTrainingSample,
  type TrainingServiceLabels,
} from "@/lib/ecuIntelligence/types";
import type {
  FileExpertAnalyzerResult,
  FileExpertJob,
  FileExpertPatternSignature,
} from "@/lib/fileExpert/types";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type SimilaritySourceType = "file_expert_job" | "training_sample";
export type SimilarityConfidence = "none" | "low" | "medium" | "high";
export type SimilarityReadiness = "no_data" | "weak" | "usable" | "strong";

export type SimilarityCandidate = {
  id: string;
  brand: string | null;
  model: string | null;
  engine: string | null;
  ecu_family: string | null;
  ecu_type: string | null;
  sw_number: string | null;
  hw_number: string | null;
  ori_file_size: number | string | null;
  mod_file_size: number | string | null;
  pattern_signature: FileExpertPatternSignature | null;
  // Database retrieval checks diff_json existence without selecting the large JSON body.
  diff_json: FileExpertAnalyzerResult | true | null;
  performed_service_labels: TrainingServiceLabels | null;
  learning_use_status: AiTrainingSample["learning_use_status"];
  human_verification_status: AiTrainingSample["human_verification_status"];
  data_quality_score: number | string | null;
  quality_rating: number | null;
  provider: string | null;
  source_type: AiTrainingSample["source_type"];
  source_metadata: Record<string, unknown> | null;
  outcome: string | null;
};

export type SimilaritySource = {
  sourceType: SimilaritySourceType;
  sourceId: string;
  excludeTrainingSampleId?: string | null;
  ecuFamily?: string | null;
  ecuType?: string | null;
  swNumber?: string | null;
  hwNumber?: string | null;
  fileSize?: number | string | null;
  patternSignature?: FileExpertPatternSignature | null;
  serviceLabels?: Partial<TrainingServiceLabels> | null;
  provider?: string | null;
};

export type SimilarityMatch = {
  training_sample_id: string;
  score: number;
  ecu_match_score: number;
  file_size_score: number;
  identifier_score: number;
  pattern_score: number;
  feature_label_score: number;
  reasons: string[];
  warnings: string[];
  compared_sample: {
    brand: string | null;
    model: string | null;
    engine: string | null;
    ecu_family: string | null;
    ecu_type: string | null;
    sw_number: string | null;
    hw_number: string | null;
    actual_service_labels: string[];
    data_quality_score: number;
    outcome: string | null;
    provider: string | null;
  };
};

export type SimilaritySearchResult = {
  matches: SimilarityMatch[];
  summary: {
    eligible_samples_checked: number;
    matches_found: number;
    best_score: number;
    confidence: SimilarityConfidence;
  };
};

export type PublicSimilarityEvidence = {
  matchesFound: number;
  bestScore: number;
  confidence: SimilarityConfidence;
  message: string;
};

const candidateSelect = [
  "id", "brand", "model", "engine", "ecu_family", "ecu_type", "sw_number", "hw_number",
  "ori_file_size", "mod_file_size", "pattern_signature", "performed_service_labels",
  "learning_use_status", "human_verification_status", "data_quality_score", "quality_rating",
  "provider", "source_type", "source_metadata", "outcome",
].join(", ");

function normalized(value: string | null | undefined) {
  return value?.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") || "";
}

function numeric(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function activeLabels(labels: Partial<TrainingServiceLabels> | null | undefined) {
  return trainingFeatureKeys.filter((feature) => labels?.[feature]);
}

function isDemoSample(sample: SimilarityCandidate) {
  return sample.source_type === "demo_fixture" || sample.source_metadata?.demo === true;
}

export function isEligibleSimilaritySample(
  sample: SimilarityCandidate,
  options: { allowDemoEvidence?: boolean } = {}
) {
  if (sample.learning_use_status !== "approved_for_learning") return false;
  if (sample.human_verification_status !== "confirmed") return false;
  if (numeric(sample.data_quality_score) < 60) return false;
  if (!sample.pattern_signature || !sample.diff_json) return false;
  if (!activeLabels(sample.performed_service_labels).length) return false;
  if (isDemoSample(sample) && !options.allowDemoEvidence) return false;
  return true;
}

function parseHexOffset(value: string) {
  const parsed = Number.parseInt(value.replace(/^0x/i, ""), 16);
  return Number.isFinite(parsed) ? parsed : null;
}

function overlappingRegions(
  source: FileExpertPatternSignature | null | undefined,
  candidate: FileExpertPatternSignature | null | undefined
) {
  const sourceRegions = source?.main_regions ?? [];
  const candidateRegions = candidate?.main_regions ?? [];
  if (!sourceRegions.length || !candidateRegions.length) return { overlap: 0, compared: 0, ratio: 0 };

  let overlap = 0;
  for (const sourceRegion of sourceRegions) {
    const sourceStart = parseHexOffset(sourceRegion.start_offset_hex);
    const sourceEnd = parseHexOffset(sourceRegion.end_offset_hex);
    if (sourceStart === null || sourceEnd === null) continue;
    const matches = candidateRegions.some((candidateRegion) => {
      const candidateStart = parseHexOffset(candidateRegion.start_offset_hex);
      const candidateEnd = parseHexOffset(candidateRegion.end_offset_hex);
      if (candidateStart === null || candidateEnd === null) return false;
      const intersection = Math.max(0, Math.min(sourceEnd, candidateEnd) - Math.max(sourceStart, candidateStart) + 1);
      const sourceLength = Math.max(1, sourceEnd - sourceStart + 1);
      return intersection / sourceLength >= 0.35;
    });
    if (matches) overlap += 1;
  }
  return { overlap, compared: sourceRegions.length, ratio: overlap / sourceRegions.length };
}

function confidenceFor(score: number): SimilarityConfidence {
  if (score >= 80) return "high";
  if (score >= 55) return "medium";
  if (score > 0) return "low";
  return "none";
}

export function calculateSimilarityReadiness(approvedSamples: number): SimilarityReadiness {
  if (approvedSamples <= 0) return "no_data";
  if (approvedSamples < 10) return "weak";
  if (approvedSamples < 100) return "usable";
  return "strong";
}

export function scoreTrainingSampleSimilarity(
  source: SimilaritySource,
  candidate: SimilarityCandidate
): SimilarityMatch {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let positivePoints = 0;
  let penalties = 0;

  let ecuMatchScore = 0;
  const sourceFamily = normalized(source.ecuFamily);
  const candidateFamily = normalized(candidate.ecu_family);
  if (sourceFamily && candidateFamily) {
    if (sourceFamily === candidateFamily) {
      ecuMatchScore += 25;
      positivePoints += 25;
      reasons.push(`Same ECU family: ${candidate.ecu_family}`);
    } else {
      penalties -= 30;
      warnings.push(`ECU family mismatch: ${source.ecuFamily} vs ${candidate.ecu_family}`);
    }
  } else {
    warnings.push("ECU family is missing on one side of the comparison.");
  }

  const sourceType = normalized(source.ecuType);
  const candidateType = normalized(candidate.ecu_type);
  if (sourceType && candidateType) {
    if (sourceType === candidateType) {
      ecuMatchScore += 25;
      positivePoints += 25;
      reasons.push(`Same ECU type: ${candidate.ecu_type}`);
    } else {
      penalties -= 25;
      warnings.push(`ECU type mismatch: ${source.ecuType} vs ${candidate.ecu_type}`);
    }
  } else {
    warnings.push("ECU type is missing on one side of the comparison.");
  }

  let identifierScore = 0;
  const sourceSw = normalized(source.swNumber);
  const candidateSw = normalized(candidate.sw_number);
  if (sourceSw && candidateSw) {
    if (sourceSw === candidateSw) {
      identifierScore = 20;
      positivePoints += 20;
      reasons.push(`Same software number: ${candidate.sw_number}`);
    } else {
      penalties -= 10;
      warnings.push("Software numbers differ.");
    }
  } else {
    warnings.push("SW number is missing on the source file or approved sample.");
  }

  let fileSizeScore = 0;
  const sourceSize = numeric(source.fileSize);
  const candidateSize = numeric(candidate.ori_file_size || candidate.mod_file_size);
  if (sourceSize && candidateSize) {
    const ratio = Math.min(sourceSize, candidateSize) / Math.max(sourceSize, candidateSize);
    if (sourceSize === candidateSize) {
      fileSizeScore = 10;
      positivePoints += 10;
      reasons.push(`Exact file size match: ${sourceSize.toLocaleString()} bytes`);
    } else if (ratio >= 0.98) {
      fileSizeScore = 6;
      positivePoints += 6;
      reasons.push("File sizes are within 2%.");
    } else {
      penalties -= 10;
      warnings.push("File sizes differ materially.");
    }
  } else {
    warnings.push("File size comparison is unavailable.");
  }

  let patternScore = 0;
  const regions = overlappingRegions(source.patternSignature, candidate.pattern_signature);
  if (regions.compared) {
    patternScore = Number((regions.ratio * 20).toFixed(2));
    positivePoints += patternScore;
    if (regions.overlap) reasons.push(`Pattern signature overlaps ${regions.overlap} of ${regions.compared} main regions.`);
    else warnings.push("No main changed-region overlap was found.");
  } else {
    warnings.push("Pattern-region comparison is limited by missing signature data.");
  }

  let featureLabelScore = 0;
  const sourceLabels = activeLabels(source.serviceLabels);
  const candidateLabels = activeLabels(candidate.performed_service_labels);
  if (sourceLabels.length && candidateLabels.length) {
    const intersection = sourceLabels.filter((label) => candidateLabels.includes(label));
    const union = new Set([...sourceLabels, ...candidateLabels]);
    if (intersection.length) {
      featureLabelScore = Number(((intersection.length / union.size) * 20).toFixed(2));
      positivePoints += featureLabelScore;
      reasons.push(`Same actual service label${intersection.length > 1 ? "s" : ""}: ${intersection.join(", ")}`);
    } else {
      penalties -= 10;
      warnings.push("No performed service-label overlap was found.");
    }
  } else {
    warnings.push("Service-label comparison is limited by missing source labels.");
  }

  const qualityScore = Math.min(100, Math.max(60, numeric(candidate.data_quality_score)));
  const qualityBonus = Number((((qualityScore - 60) / 40) * 10).toFixed(2));
  positivePoints += qualityBonus;
  if (qualityBonus >= 5) reasons.push(`High-quality approved evidence: ${Math.round(qualityScore)}/100`);

  if (normalized(source.provider) && normalized(source.provider) === normalized(candidate.provider)) {
    positivePoints += 5;
    reasons.push(`Same provider/source: ${candidate.provider}`);
  }

  const score = Math.max(0, Math.min(100, Math.round(((positivePoints + penalties) / 135) * 100)));
  return {
    training_sample_id: candidate.id,
    score,
    ecu_match_score: ecuMatchScore,
    file_size_score: fileSizeScore,
    identifier_score: identifierScore,
    pattern_score: patternScore,
    feature_label_score: featureLabelScore,
    reasons,
    warnings,
    compared_sample: {
      brand: candidate.brand,
      model: candidate.model,
      engine: candidate.engine,
      ecu_family: candidate.ecu_family,
      ecu_type: candidate.ecu_type,
      sw_number: candidate.sw_number,
      hw_number: candidate.hw_number,
      actual_service_labels: candidateLabels,
      data_quality_score: qualityScore,
      outcome: candidate.outcome,
      provider: candidate.provider,
    },
  };
}

export function rankSimilarTrainingSamples(
  source: SimilaritySource,
  candidates: SimilarityCandidate[],
  options: { topN?: number; allowDemoEvidence?: boolean } = {}
): SimilaritySearchResult {
  const seen = new Set<string>();
  const eligible = candidates.filter((candidate) => {
    if (seen.has(candidate.id)) return false;
    seen.add(candidate.id);
    return candidate.id !== source.excludeTrainingSampleId &&
      isEligibleSimilaritySample(candidate, { allowDemoEvidence: options.allowDemoEvidence });
  });
  const matches = eligible
    .map((candidate) => scoreTrainingSampleSimilarity(source, candidate))
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score || left.training_sample_id.localeCompare(right.training_sample_id))
    .slice(0, Math.min(Math.max(options.topN ?? 10, 1), 50));
  const bestScore = matches[0]?.score ?? 0;
  return {
    matches,
    summary: {
      eligible_samples_checked: eligible.length,
      matches_found: matches.length,
      best_score: bestScore,
      confidence: confidenceFor(bestScore),
    },
  };
}

export function buildPublicSimilarityEvidence(result: SimilaritySearchResult): PublicSimilarityEvidence {
  const { matches_found, best_score, confidence } = result.summary;
  return {
    matchesFound: matches_found,
    bestScore: best_score,
    confidence,
    message: matches_found
      ? `Found ${matches_found} similar approved ECU pattern${matches_found === 1 ? "" : "s"}. Human tuner verification remains required.`
      : "No approved similar learning evidence was found. Confidence is limited and human tuner verification is required.",
  };
}

export function similaritySourceFromTrainingSample(sample: AiTrainingSample): SimilaritySource {
  return {
    sourceType: "training_sample",
    sourceId: sample.id,
    excludeTrainingSampleId: sample.id,
    ecuFamily: sample.ecu_family,
    ecuType: sample.ecu_type,
    swNumber: sample.sw_number,
    hwNumber: sample.hw_number,
    fileSize: sample.ori_file_size || sample.mod_file_size,
    patternSignature: sample.pattern_signature,
    serviceLabels: sample.performed_service_labels || sample.requested_service_labels,
    provider: sample.provider,
  };
}

export function similaritySourceFromFileExpert(
  job: FileExpertJob,
  result: FileExpertAnalyzerResult
): SimilaritySource {
  const labels = Object.fromEntries(
    trainingFeatureKeys.map((feature) => [
      feature,
      result.possible_features.some((candidate) => candidate.feature === feature && candidate.confidence >= 0.5),
    ])
  ) as TrainingServiceLabels;
  return {
    sourceType: "file_expert_job",
    sourceId: job.id,
    ecuFamily: result.ecu_identification?.family || job.ecu_family,
    ecuType: result.ecu_identification?.display_name || job.ecu_type,
    swNumber: result.ecu_identification?.software_numbers[0] || job.sw_number,
    hwNumber: result.ecu_identification?.hardware_numbers[0] || job.hw_number,
    fileSize: result.files.ori?.file_size || result.files.single?.file_size || result.files.mod?.file_size,
    patternSignature: result.pattern_signature || null,
    serviceLabels: labels,
  };
}

export async function findSimilarTrainingSamples(
  source: SimilaritySource,
  options: { topN?: number; allowDemoEvidence?: boolean } = {}
) {
  const allowDemoEvidence = options.allowDemoEvidence === true && isAiTrainingDemoEnabled();
  const query = await getSupabaseAdmin()
    .from("ai_training_samples")
    .select(candidateSelect)
    .eq("learning_use_status", "approved_for_learning")
    .eq("human_verification_status", "confirmed")
    .gte("data_quality_score", 60)
    .not("pattern_signature", "is", null)
    .not("diff_json", "is", null)
    .limit(2000);
  if (query.error) throw new Error(query.error.message);
  const rows = (query.data ?? []) as unknown as Array<Omit<SimilarityCandidate, "diff_json">>;
  const candidates = rows.map((candidate) => ({
    ...candidate,
    diff_json: true as const,
  }));
  return rankSimilarTrainingSamples(source, candidates, {
    topN: options.topN,
    allowDemoEvidence,
  });
}

export async function storeSimilarityResults(source: SimilaritySource, result: SimilaritySearchResult) {
  const admin = getSupabaseAdmin();
  if (!result.matches.length) {
    const removed = await admin
      .from("ai_similarity_results")
      .delete()
      .eq("source_type", source.sourceType)
      .eq("source_id", source.sourceId);
    if (removed.error) throw new Error(removed.error.message);
    return;
  }

  const inserted = await admin.from("ai_similarity_results").upsert(
    result.matches.map((match) => ({
      source_type: source.sourceType,
      source_id: source.sourceId,
      compared_sample_id: match.training_sample_id,
      ecu_match_score: match.ecu_match_score,
      file_size_score: match.file_size_score,
      identifier_score: match.identifier_score,
      pattern_score: match.pattern_score,
      feature_label_score: match.feature_label_score,
      overall_similarity_score: match.score,
      match_reasons: match.reasons,
      mismatch_reasons: match.warnings,
      compared_features: match.compared_sample,
      created_at: new Date().toISOString(),
    })),
    { onConflict: "source_type,source_id,compared_sample_id" }
  );
  if (inserted.error) throw new Error(inserted.error.message);

  const retainedIds = result.matches.map((match) => match.training_sample_id);
  const orphaned = await admin
    .from("ai_similarity_results")
    .delete()
    .eq("source_type", source.sourceType)
    .eq("source_id", source.sourceId)
    .is("compared_sample_id", null);
  if (orphaned.error) throw new Error(orphaned.error.message);
  const stale = await admin
    .from("ai_similarity_results")
    .delete()
    .eq("source_type", source.sourceType)
    .eq("source_id", source.sourceId)
    .not("compared_sample_id", "in", `(${retainedIds.join(",")})`);
  if (stale.error) throw new Error(stale.error.message);
}

async function logSimilarityEvent(input: {
  trainingSampleId?: string | null;
  requestId?: string | null;
  actorUserId?: string | null;
  result?: SimilaritySearchResult;
  error?: string | null;
  sourceId: string;
  sourceType: SimilaritySourceType;
}) {
  await getSupabaseAdmin().from("ai_training_events").insert({
    event_type: input.error ? "similarity_failed" : "similarity_completed",
    request_id: input.requestId ?? null,
    training_sample_id: input.trainingSampleId ?? null,
    actor_user_id: input.actorUserId ?? null,
    message: input.error
      ? `Similarity search failed: ${input.error}`
      : `Similarity search checked ${input.result?.summary.eligible_samples_checked ?? 0} approved samples and stored ${input.result?.summary.matches_found ?? 0} matches.`,
    metadata: {
      source_type: input.sourceType,
      source_id: input.sourceId,
      best_score: input.result?.summary.best_score ?? 0,
      confidence: input.result?.summary.confidence ?? "none",
    },
  });
}

export async function runSimilarityForTrainingSample(
  sampleId: string,
  options: { actorUserId?: string | null; topN?: number; allowDemoEvidence?: boolean } = {}
) {
  const sampleQuery = await getSupabaseAdmin().from("ai_training_samples").select("*").eq("id", sampleId).single();
  if (sampleQuery.error || !sampleQuery.data) throw new Error(sampleQuery.error?.message || "Training sample not found.");
  const sample = sampleQuery.data as AiTrainingSample;
  const source = similaritySourceFromTrainingSample(sample);
  try {
    const result = await findSimilarTrainingSamples(source, options);
    await storeSimilarityResults(source, result);
    await logSimilarityEvent({
      trainingSampleId: sample.id,
      requestId: sample.request_id,
      actorUserId: options.actorUserId,
      result,
      sourceId: source.sourceId,
      sourceType: source.sourceType,
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Similarity search failed.";
    await logSimilarityEvent({
      trainingSampleId: sample.id,
      requestId: sample.request_id,
      actorUserId: options.actorUserId,
      error: message,
      sourceId: source.sourceId,
      sourceType: source.sourceType,
    }).catch(() => undefined);
    throw error;
  }
}

export async function runSimilarityForFileExpert(job: FileExpertJob, result: FileExpertAnalyzerResult) {
  const source = similaritySourceFromFileExpert(job, result);
  const search = await findSimilarTrainingSamples(source);
  // Similarity is an evidence enhancement. A missing Level 1 migration must not
  // turn an otherwise valid File Expert analysis into a customer-facing failure.
  await storeSimilarityResults(source, search).catch(() => undefined);
  return search;
}

export async function getStoredSimilarityResults(
  sourceType: SimilaritySourceType,
  sourceId: string
): Promise<SimilaritySearchResult> {
  const query = await getSupabaseAdmin()
    .from("ai_similarity_results")
    .select("*")
    .eq("source_type", sourceType)
    .eq("source_id", sourceId)
    .order("overall_similarity_score", { ascending: false })
    .limit(50);
  if (query.error) throw new Error(query.error.message);
  const matches = (query.data ?? []).filter((row) => Boolean(row.compared_sample_id)).map((row) => ({
    training_sample_id: row.compared_sample_id,
    score: numeric(row.overall_similarity_score),
    ecu_match_score: numeric(row.ecu_match_score),
    file_size_score: numeric(row.file_size_score),
    identifier_score: numeric(row.identifier_score),
    pattern_score: numeric(row.pattern_score),
    feature_label_score: numeric(row.feature_label_score),
    reasons: Array.isArray(row.match_reasons) ? row.match_reasons : [],
    warnings: Array.isArray(row.mismatch_reasons) ? row.mismatch_reasons : [],
    compared_sample: row.compared_features as SimilarityMatch["compared_sample"],
  })) as SimilarityMatch[];
  const bestScore = matches[0]?.score ?? 0;
  return {
    matches,
    summary: {
      eligible_samples_checked: matches.length,
      matches_found: matches.length,
      best_score: bestScore,
      confidence: confidenceFor(bestScore),
    },
  };
}
