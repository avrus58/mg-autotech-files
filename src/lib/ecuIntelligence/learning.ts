import { analyzeFileExpertBuffers, buildPatternSignature, sha256Buffer } from "@/lib/fileExpert/analyzer";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { fileExpertMaxFileSize } from "@/lib/fileExpert/server";
import { parseTrainingServiceLabels } from "@/lib/ecuIntelligence/serviceLabels";
import { calculateTrainingSampleQuality } from "@/lib/ecuIntelligence/quality";
import { calculateKnowledgeReadiness } from "@/lib/ecuIntelligence/readiness";
import {
  trainingFeatureKeys,
  type AiTrainingSample,
  type HumanVerificationStatus,
  type TrainingSafetyRating,
  type TrainingServiceLabels,
} from "@/lib/ecuIntelligence/types";

type ModifiedFileVersion = {
  id?: string;
  label?: string;
  file_name?: string;
  file_path?: string;
  uploaded_at?: string;
};

type CompletedOrder = {
  id: string;
  customer_id: string | null;
  vehicle_brand: string | null;
  vehicle_model: string | null;
  vehicle_generation: string | null;
  vehicle_engine: string | null;
  service_type: string | null;
  ecu: string | null;
  hw_sw: string | null;
  read_method: string | null;
  master_slave: string | null;
  uploaded_file_name: string | null;
  original_file_path: string | null;
  modified_file_path: string | null;
  modified_files: ModifiedFileVersion[] | null;
  status: string | null;
};

export type CaptureTrainingOptions = {
  modFilePath?: string | null;
  modFileName?: string | null;
  revisionLabel?: string | null;
  actorUserId?: string | null;
  provider?: string | null;
};

export type CaptureTrainingResult =
  | { status: "created"; sampleId: string }
  | { status: "duplicate"; sampleId: string }
  | { status: "skipped"; reason: string };

export type TrainingSampleBufferInput = {
  analysisId: string;
  requestId?: string | null;
  userId?: string | null;
  actorUserId?: string | null;
  ori: Buffer;
  mod: Buffer;
  oriFilePath: string;
  modFilePath: string;
  oriFileName: string;
  modFileName: string;
  brand?: string | null;
  model?: string | null;
  engine?: string | null;
  ecuType?: string | null;
  ecuFamily?: string | null;
  swNumber?: string | null;
  hwNumber?: string | null;
  readMethod?: string | null;
  serviceLabels: TrainingServiceLabels;
  provider?: string | null;
  revisionLabel?: string | null;
  sourceMetadata?: Record<string, unknown> | null;
  createdMessage?: string;
};

async function logTrainingEvent(input: {
  eventType: string;
  requestId?: string | null;
  trainingSampleId?: string | null;
  actorUserId?: string | null;
  message?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  try {
    const inserted = await getSupabaseAdmin()
      .from("ai_training_events")
      .insert({
        event_type: input.eventType,
        request_id: input.requestId ?? null,
        training_sample_id: input.trainingSampleId ?? null,
        actor_user_id: input.actorUserId ?? null,
        message: input.message ?? null,
        metadata: input.metadata ?? null,
      })
      .select("id")
      .single();
    return inserted.data?.id as string | undefined;
  } catch {
    // Audit failure must not turn a successful customer delivery into an error.
    return undefined;
  }
}

function baseName(path: string) {
  return path.split("/").filter(Boolean).at(-1) || "file.bin";
}

function resolveMod(order: CompletedOrder, options: CaptureTrainingOptions) {
  const versions = Array.isArray(order.modified_files) ? order.modified_files : [];
  const selected = options.modFilePath
    ? versions.find((item) => item.file_path === options.modFilePath)
    : versions.at(-1);
  const path = options.modFilePath || selected?.file_path || order.modified_file_path;
  if (!path) return null;

  return {
    path,
    name: options.modFileName || selected?.file_name || baseName(path),
    revisionLabel: options.revisionLabel || selected?.label || null,
  };
}

async function downloadCustomerFile(path: string) {
  const { data, error } = await getSupabaseAdmin().storage.from("customer-files").download(path);
  if (error || !data) throw new Error(error?.message || `Customer file not found: ${path}`);
  const buffer = Buffer.from(await data.arrayBuffer());
  if (!buffer.length) throw new Error(`Customer file is empty: ${path}`);
  if (buffer.length > fileExpertMaxFileSize) {
    throw new Error(`Customer file exceeds the ${fileExpertMaxFileSize / 1024 / 1024} MB analysis limit.`);
  }
  return buffer;
}

function extractSubmittedIdentifiers(order: CompletedOrder) {
  const parts = (order.hw_sw || "")
    .split(/[|,;/\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return { hwNumber: parts[0] || null, swNumber: parts[1] || null };
}

function averageFeatureConfidence(
  labels: TrainingServiceLabels,
  result: Awaited<ReturnType<typeof analyzeFileExpertBuffers>>
) {
  const requested = trainingFeatureKeys.filter((key) => labels[key]);
  if (!requested.length) return result.risk_assessment.confidence;
  const values = requested.map((key) =>
    result.possible_features.find((item) => item.feature === key)?.confidence ?? 0.35
  );
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(3));
}

function duplicateQueryFor(
  requestId: string | null,
  oriHash: string,
  modHash: string
) {
  let query = getSupabaseAdmin()
    .from("ai_training_samples")
    .select("id")
    .eq("ori_sha256", oriHash)
    .eq("mod_sha256", modHash);
  query = requestId ? query.eq("request_id", requestId) : query.is("request_id", null);
  return query.maybeSingle();
}

export async function createTrainingSampleFromBuffers(
  input: TrainingSampleBufferInput
): Promise<CaptureTrainingResult> {
  if (!input.ori.length) return { status: "skipped", reason: "Original file is empty." };
  if (!input.mod.length) return { status: "skipped", reason: "Modified file is empty." };
  if (input.ori.length > fileExpertMaxFileSize || input.mod.length > fileExpertMaxFileSize) {
    return { status: "skipped", reason: "Training fixture exceeds the analysis size limit." };
  }

  const admin = getSupabaseAdmin();
  const requestId = input.requestId ?? null;
  const oriHash = sha256Buffer(input.ori);
  const modHash = sha256Buffer(input.mod);
  const duplicate = await duplicateQueryFor(requestId, oriHash, modHash);
  if (duplicate.error) throw new Error(duplicate.error.message);
  if (duplicate.data?.id) {
    await logTrainingEvent({
      eventType: "duplicate_skipped",
      requestId,
      trainingSampleId: duplicate.data.id,
      actorUserId: input.actorUserId,
      message: "The same ORI/MOD hash pair already exists; no duplicate sample was created.",
      metadata: { demo: input.sourceMetadata?.demo === true },
    });
    return { status: "duplicate", sampleId: duplicate.data.id };
  }

  const diffStartedEventId = await logTrainingEvent({
    eventType: "diff_started",
    requestId,
    actorUserId: input.actorUserId,
    message: "ORI/MOD binary comparison started.",
    metadata: { provider: input.provider ?? "internal", demo: input.sourceMetadata?.demo === true },
  });

  try {
    const result = await analyzeFileExpertBuffers({
      jobId: input.analysisId,
      ori: input.ori,
      mod: input.mod,
      fileNames: { ori: input.oriFileName, mod: input.modFileName },
      metadata: {
        brand: input.brand,
        model: input.model,
        engine: input.engine,
        ecuType: input.ecuType,
        readMethod: input.readMethod,
      },
      sourceKind: "completed_request",
    });
    const identity = result.ecu_identification;
    const patternSignature = result.pattern_signature || buildPatternSignature(result);
    const candidate = {
      request_id: requestId,
      user_id: input.userId ?? null,
      ori_file_path: input.oriFilePath,
      mod_file_path: input.modFilePath,
      ori_file_name: input.oriFileName,
      mod_file_name: input.modFileName,
      ori_sha256: oriHash,
      mod_sha256: modHash,
      ori_file_size: input.ori.length,
      mod_file_size: input.mod.length,
      brand: input.brand ?? null,
      model: input.model ?? null,
      engine: input.engine ?? null,
      ecu_type: identity?.display_name || input.ecuType || null,
      ecu_family: identity?.family || input.ecuFamily || null,
      sw_number: identity?.software_numbers[0] || input.swNumber || null,
      hw_number: identity?.hardware_numbers[0] || input.hwNumber || null,
      read_method: input.readMethod ?? null,
      service_labels: input.serviceLabels,
      provider: input.provider || "internal",
      revision_label: input.revisionLabel ?? null,
      source_metadata: input.sourceMetadata ?? null,
      diff_json: result,
      pattern_signature: patternSignature,
      auto_label_confidence: averageFeatureConfidence(input.serviceLabels, result),
      human_verified: false,
      human_verification_status: "unverified" as const,
      outcome: "unknown",
    };
    const quality = calculateTrainingSampleQuality(candidate, result);

    const inserted = await admin
      .from("ai_training_samples")
      .insert({
        ...candidate,
        data_quality_score: quality.score,
        data_quality_reasons: quality.reasons,
      })
      .select("*")
      .single();

    if (inserted.error || !inserted.data) {
      if (inserted.error?.code === "23505") {
        const existing = await duplicateQueryFor(requestId, oriHash, modHash);
        if (existing.data?.id) {
          await logTrainingEvent({
            eventType: "duplicate_skipped",
            requestId,
            trainingSampleId: existing.data.id,
            actorUserId: input.actorUserId,
            message: "A concurrent request already created this ORI/MOD sample.",
          });
          return { status: "duplicate", sampleId: existing.data.id };
        }
      }
      if (inserted.error?.code === "PGRST204" || inserted.error?.code === "42703") {
        throw new Error("AI training quality columns are missing. Run the Level 0 hardening migration first.");
      }
      throw new Error(inserted.error?.message || "Training sample could not be created.");
    }

    const sample = inserted.data as AiTrainingSample;
    if (diffStartedEventId) {
      await admin
        .from("ai_training_events")
        .update({ training_sample_id: sample.id })
        .eq("id", diffStartedEventId);
    }
    const signatures = trainingFeatureKeys
      .filter((feature) => input.serviceLabels[feature])
      .map((feature) => ({
        training_sample_id: sample.id,
        ecu_family: sample.ecu_family,
        ecu_type: sample.ecu_type,
        sw_number: sample.sw_number,
        feature_type: feature,
        signature_json: patternSignature,
        human_confirmed: false,
        confidence: result.possible_features.find((item) => item.feature === feature)?.confidence ?? 0.35,
      }));
    if (signatures.length) {
      const signatureInsert = await admin.from("ai_pattern_signatures").insert(signatures);
      if (signatureInsert.error) throw new Error(signatureInsert.error.message);
    }

    await logTrainingEvent({
      eventType: "training_sample_created",
      requestId,
      trainingSampleId: sample.id,
      actorUserId: input.actorUserId,
      message: input.createdMessage || "ORI/MOD training sample created.",
      metadata: {
        revision_label: input.revisionLabel ?? null,
        analysis_version: result.analysis_version,
        data_quality_score: quality.score,
        demo: input.sourceMetadata?.demo === true,
      },
    });
    await logTrainingEvent({
      eventType: "diff_completed",
      requestId,
      trainingSampleId: sample.id,
      actorUserId: input.actorUserId,
      message: "Binary comparison and pattern signature completed.",
      metadata: {
        changed_bytes: result.comparison?.changed_bytes ?? null,
        changed_percent: result.comparison?.changed_percent ?? null,
      },
    });
    await updateEcuKnowledgeProfile(sample, input.actorUserId, sample.id, requestId);
    return { status: "created", sampleId: sample.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Training analysis failed.";
    await logTrainingEvent({
      eventType: "analyzer_failed",
      requestId,
      actorUserId: input.actorUserId,
      message,
      metadata: { demo: input.sourceMetadata?.demo === true },
    });
    await logTrainingEvent({
      eventType: "diff_failed",
      requestId,
      actorUserId: input.actorUserId,
      message,
    });
    throw error;
  }
}

export async function maybeCreateTrainingSampleForRequest(
  requestId: string,
  options: CaptureTrainingOptions = {}
): Promise<CaptureTrainingResult> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("orders").select("*").eq("id", requestId).single();
  if (error || !data) throw new Error(error?.message || "Completed request not found.");
  const order = data as CompletedOrder;
  const mod = resolveMod(order, options);

  if (!order.original_file_path || !mod) {
    const reason = !order.original_file_path ? "Original file is missing." : "Modified file is missing.";
    await logTrainingEvent({
      eventType: "training_sample_skipped",
      requestId,
      actorUserId: options.actorUserId,
      message: reason,
    });
    return { status: "skipped", reason };
  }

  try {
    const [ori, modified] = await Promise.all([
      downloadCustomerFile(order.original_file_path),
      downloadCustomerFile(mod.path),
    ]);
    const submitted = extractSubmittedIdentifiers(order);
    const labels = parseTrainingServiceLabels(order.service_type);
    return createTrainingSampleFromBuffers({
      analysisId: requestId,
      requestId,
      userId: order.customer_id,
      actorUserId: options.actorUserId,
      ori,
      mod: modified,
      oriFilePath: order.original_file_path,
      modFilePath: mod.path,
      oriFileName: order.uploaded_file_name || baseName(order.original_file_path),
      modFileName: mod.name,
      brand: order.vehicle_brand,
      model: order.vehicle_model,
      engine: order.vehicle_engine,
      ecuType: order.ecu,
      swNumber: submitted.swNumber,
      hwNumber: submitted.hwNumber,
      readMethod: order.read_method,
      serviceLabels: labels,
      provider: options.provider || "internal",
      revisionLabel: mod.revisionLabel,
      sourceMetadata: {
        vehicle_generation: order.vehicle_generation,
        master_slave: order.master_slave,
        order_status: order.status,
      },
      createdMessage: "ORI/MOD training sample created from completed request.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Training analysis failed.";
    await logTrainingEvent({
      eventType: "diff_failed",
      requestId,
      actorUserId: options.actorUserId,
      message,
    });
    throw error;
  }
}

function matchingIdentity<T extends { eq: (column: string, value: string) => T; is: (column: string, value: null) => T }>(
  query: T,
  identity: Pick<AiTrainingSample, "ecu_family" | "ecu_type" | "sw_number" | "hw_number">
) {
  let next = query;
  for (const key of ["ecu_family", "ecu_type", "sw_number", "hw_number"] as const) {
    next = identity[key] ? next.eq(key, identity[key] as string) : next.is(key, null);
  }
  return next;
}

export { calculateKnowledgeReadiness } from "@/lib/ecuIntelligence/readiness";

export type KnowledgeProfileSample = {
  id: string;
  service_labels: TrainingServiceLabels | null;
  human_verified: boolean;
  human_verification_status: HumanVerificationStatus;
  quality_rating: number | null;
  data_quality_score: number | string | null;
};

export function calculateKnowledgeProfileMetrics(samples: KnowledgeProfileSample[]) {
  const verified = samples.filter((sample) => sample.human_verification_status === "confirmed");
  const rejected = samples.filter((sample) => sample.human_verification_status === "rejected");
  const usable = samples.filter((sample) =>
    sample.human_verification_status !== "rejected" &&
    (sample.quality_rating ?? 3) >= 3 &&
    Number(sample.data_quality_score ?? 0) >= 60
  );
  const state = calculateKnowledgeReadiness(usable.length, verified.length);
  const featureCounts = Object.fromEntries(
    trainingFeatureKeys.map((feature) => [
      `${feature}_samples`,
      usable.filter((sample) => sample.service_labels?.[feature]).length,
    ])
  );
  const ratio = (value: number, total: number) => Number((total ? value / total : 0).toFixed(3));
  const averageQuality = samples.length
    ? Number((samples.reduce((sum, sample) => sum + Number(sample.data_quality_score || 0), 0) / samples.length).toFixed(1))
    : 0;

  return { verified, rejected, usable, state, featureCounts, ratio, averageQuality };
}

export async function updateEcuKnowledgeProfile(
  identity: Pick<AiTrainingSample, "ecu_family" | "ecu_type" | "sw_number" | "hw_number">,
  actorUserId?: string | null,
  trainingSampleId?: string | null,
  requestId?: string | null
) {
  const admin = getSupabaseAdmin();
  const samples: KnowledgeProfileSample[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const sampleQuery = admin
      .from("ai_training_samples")
      .select("id, service_labels, human_verified, human_verification_status, quality_rating, data_quality_score")
      .range(offset, offset + pageSize - 1);
    const { data, error } = await matchingIdentity(sampleQuery, identity);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as KnowledgeProfileSample[];
    samples.push(...page);
    if (page.length < pageSize) break;
  }
  const { verified, rejected, usable, state, featureCounts, ratio, averageQuality } =
    calculateKnowledgeProfileMetrics(samples);
  const qualityWeight = averageQuality / 100;

  const payload = {
    ecu_family: identity.ecu_family,
    ecu_type: identity.ecu_type,
    sw_number: identity.sw_number,
    hw_number: identity.hw_number,
    total_samples: samples.length,
    human_verified_samples: verified.length,
    unverified_samples: samples.filter((sample) => sample.human_verification_status === "unverified").length,
    rejected_samples: rejected.length,
    ...featureCounts,
    learning_level: state.level,
    detection_confidence: Number((ratio(usable.length, Math.max(10, samples.length)) * qualityWeight).toFixed(3)),
    pattern_confidence: Number((ratio(verified.length, Math.max(100, usable.length)) * qualityWeight).toFixed(3)),
    map_candidate_confidence: Number((ratio(verified.length, Math.max(500, usable.length)) * qualityWeight).toFixed(3)),
    generation_readiness: state.value,
    profile_json: {
      usable_samples: usable.length,
      needs_review_samples: samples.filter((sample) => sample.human_verification_status === "needs_review").length,
      verified_ratio: ratio(verified.length, samples.length),
      average_data_quality: averageQuality,
      high_quality_samples: samples.filter((sample) => Number(sample.data_quality_score || 0) >= 80).length,
      quality_threshold: 60,
      draft_generation_enabled: false,
    },
    last_updated_at: new Date().toISOString(),
  };

  const existingQuery = admin.from("ai_ecu_knowledge_profiles").select("id");
  const existing = await matchingIdentity(existingQuery, identity).maybeSingle();
  let saved = existing.data?.id
    ? await admin.from("ai_ecu_knowledge_profiles").update(payload).eq("id", existing.data.id).select("id").single()
    : await admin.from("ai_ecu_knowledge_profiles").insert(payload).select("id").single();
  if (saved.error?.code === "23505") {
    const retryProfileQuery = admin.from("ai_ecu_knowledge_profiles").select("id");
    const retryExisting = await matchingIdentity(
      retryProfileQuery,
      identity
    ).single();
    if (retryExisting.data?.id) {
      saved = await admin
        .from("ai_ecu_knowledge_profiles")
        .update(payload)
        .eq("id", retryExisting.data.id)
        .select("id")
        .single();
    }
  }
  if (saved.error) throw new Error(saved.error.message);

  await logTrainingEvent({
    eventType: "profile_updated",
    requestId,
    trainingSampleId,
    actorUserId,
    message: `ECU knowledge profile updated to Level ${state.level}.`,
    metadata: { profile_id: saved.data?.id, total_samples: samples.length, usable_samples: usable.length },
  });
  return saved.data?.id as string;
}

export async function updateTrainingSampleVerification(input: {
  sampleId: string;
  actorUserId: string;
  status: HumanVerificationStatus;
  aiCorrect?: boolean | null;
  serviceLabels: TrainingServiceLabels;
  qualityRating?: number | null;
  safetyRating?: TrainingSafetyRating | null;
  outcome?: string | null;
  adminNotes?: string | null;
}) {
  const admin = getSupabaseAdmin();
  const current = await admin.from("ai_training_samples").select("*").eq("id", input.sampleId).single();
  if (current.error || !current.data) throw new Error(current.error?.message || "Training sample not found.");

  const pendingQuality = calculateTrainingSampleQuality({
    ...(current.data as AiTrainingSample),
    human_verified: input.status === "confirmed",
    human_verification_status: input.status,
    service_labels: input.serviceLabels,
    quality_rating: input.qualityRating ?? null,
    safety_rating: input.safetyRating ?? "unknown",
    outcome: input.outcome?.trim() || "unknown",
  }, (current.data as AiTrainingSample).diff_json);

  const update = await admin
    .from("ai_training_samples")
    .update({
      human_verified: input.status === "confirmed",
      human_verification_status: input.status,
      auto_labels_correct: input.aiCorrect ?? null,
      service_labels: input.serviceLabels,
      quality_rating: input.qualityRating ?? null,
      data_quality_score: pendingQuality.score,
      data_quality_reasons: pendingQuality.reasons,
      safety_rating: input.safetyRating ?? "unknown",
      outcome: input.outcome?.trim() || "unknown",
      admin_notes: input.adminNotes?.trim() || null,
    })
    .eq("id", input.sampleId)
    .select("*")
    .single();
  if (update.error || !update.data) throw new Error(update.error?.message || "Training sample could not be updated.");
  const sample = update.data as AiTrainingSample;

  await admin.from("ai_pattern_signatures").delete().eq("training_sample_id", sample.id);
  if (sample.pattern_signature) {
    const rows = trainingFeatureKeys.filter((feature) => input.serviceLabels[feature]).map((feature) => ({
      training_sample_id: sample.id,
      ecu_family: sample.ecu_family,
      ecu_type: sample.ecu_type,
      sw_number: sample.sw_number,
      feature_type: feature,
      signature_json: sample.pattern_signature,
      human_confirmed: input.status === "confirmed",
      confidence: input.status === "confirmed" ? 1 : Number(sample.auto_label_confidence || 0),
    }));
    if (rows.length) await admin.from("ai_pattern_signatures").insert(rows);
  }

  await logTrainingEvent({
    eventType: input.status === "confirmed"
      ? "admin_confirmed"
      : input.status === "rejected"
        ? "admin_rejected"
        : input.status === "needs_review"
          ? "needs_review"
          : "admin_reviewed",
    requestId: sample.request_id,
    trainingSampleId: sample.id,
    actorUserId: input.actorUserId,
    message: input.adminNotes?.trim() || `Training sample marked ${input.status}.`,
    metadata: {
      ai_correct: input.aiCorrect,
      quality_rating: input.qualityRating,
      data_quality_score: pendingQuality.score,
      safety_rating: input.safetyRating,
      outcome: input.outcome,
    },
  });
  await updateEcuKnowledgeProfile(sample, input.actorUserId, sample.id, sample.request_id);
  return sample;
}

export const createTrainingSampleFromCompletedRequest = maybeCreateTrainingSampleForRequest;
