import { recordLearningAuditEvent } from "@/lib/ecuIntelligence/learningAudit";
import {
  learningFlywheelCaptureTimeoutMs,
  learningFlywheelEngineVersion,
  resolveLearningFlywheelFlags,
} from "@/lib/ecuIntelligence/learningConfig";
import {
  createLearningFileCandidateForOrderUpload,
  createLearningPairCandidateForOrder,
} from "@/lib/ecuIntelligence/learningFlywheel";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type FileSourceType = "customer_upload" | "desktop_upload" | "additional_upload" | "historical_backfill";
type PairSourceType = "modified_output" | "historical_backfill";
type JobType = "file_candidate" | "pair_candidate";

type IngestionJob = {
  id: string;
  status: "pending" | "running" | "succeeded" | "failed" | "timed_out";
  attempt_count: number;
  duplicate_hits: number;
  candidate_id: string | null;
  source_type: string;
  storage_path: string | null;
  file_name: string | null;
};

export type LearningIngestionResult = {
  status: "created" | "updated" | "duplicate" | "disabled" | "failed" | "skipped";
  jobId: string | null;
  candidateId: string | null;
  retryable: boolean;
  reason?: string;
};

function privateErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Learning candidate ingestion failed.";
  return message.replace(/https?:\/\/\S+/gi, "[private-url]").slice(0, 500);
}

function errorCode(error: unknown) {
  if (error instanceof Error && error.name === "LearningCaptureTimeoutError") return "capture_timeout";
  return "capture_failed";
}

function captureWithTimeout<T>(promise: Promise<T>) {
  let handle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    handle = setTimeout(() => {
      const error = new Error(`Learning candidate capture exceeded ${learningFlywheelCaptureTimeoutMs} ms.`);
      error.name = "LearningCaptureTimeoutError";
      reject(error);
    }, learningFlywheelCaptureTimeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (handle) clearTimeout(handle);
  });
}

async function claimJob(input: {
  jobType: JobType;
  idempotencyKey: string;
  requestId: string;
  sourceType: string;
  storagePath?: string | null;
  fileName?: string | null;
  actorUserId?: string | null;
  forceRetry?: boolean;
}) {
  const admin = getSupabaseAdmin();
  const inserted = await admin
    .from("ai_learning_ingestion_jobs")
    .insert({
      job_type: input.jobType,
      idempotency_key: input.idempotencyKey,
      request_id: input.requestId,
      source_type: input.sourceType,
      storage_path: input.storagePath ?? null,
      file_name: input.fileName ?? null,
      status: "pending",
      engine_version: learningFlywheelEngineVersion,
      created_by: input.actorUserId ?? null,
    })
    .select("id,status,attempt_count,duplicate_hits,candidate_id,source_type,storage_path,file_name")
    .maybeSingle();
  if (inserted.error && inserted.error.code !== "23505") throw new Error(inserted.error.message);

  const created = Boolean(inserted.data);
  let job = inserted.data as IngestionJob | null;
  if (!job) {
    const existing = await admin
      .from("ai_learning_ingestion_jobs")
      .select("id,status,attempt_count,duplicate_hits,candidate_id,source_type,storage_path,file_name")
      .eq("idempotency_key", input.idempotencyKey)
      .single();
    if (existing.error || !existing.data) throw new Error(existing.error?.message || "Learning ingestion job could not be loaded.");
    job = existing.data as IngestionJob;
  }

  if (job.status === "succeeded" && !input.forceRetry) {
    const duplicateHits = Number(job.duplicate_hits || 0) + 1;
    await admin.from("ai_learning_ingestion_jobs").update({ duplicate_hits: duplicateHits, updated_at: new Date().toISOString() }).eq("id", job.id);
    await recordLearningAuditEvent({
      requestId: input.requestId,
      action: `${input.jobType}_duplicate`,
      newValue: { job_id: job.id, duplicate_hits: duplicateHits, engine_version: learningFlywheelEngineVersion },
      actorUserId: input.actorUserId,
      notes: "Idempotent learning ingestion hit; no duplicate candidate was created.",
    });
    return { job, duplicate: true as const, recovered: false };
  }

  if (!created && job.status === "running" && !input.forceRetry) {
    await recordLearningAuditEvent({
      requestId: input.requestId,
      action: `${input.jobType}_duplicate`,
      newValue: { job_id: job.id, in_progress: true, engine_version: learningFlywheelEngineVersion },
      actorUserId: input.actorUserId,
      notes: "Idempotent learning ingestion attempt joined an existing running job.",
    });
    return { job, duplicate: true as const, recovered: false };
  }

  const recovered = ["failed", "timed_out"].includes(job.status);
  const startedAt = new Date().toISOString();
  const claimed = await admin
    .from("ai_learning_ingestion_jobs")
    .update({
      status: "running",
      attempt_count: Number(job.attempt_count || 0) + 1,
      last_attempt_at: startedAt,
      started_at: startedAt,
      completed_at: null,
      last_error_code: null,
      last_error_message: null,
      next_attempt_at: null,
      engine_version: learningFlywheelEngineVersion,
      updated_at: startedAt,
    })
    .eq("id", job.id)
    .eq("status", job.status)
    .select("id,status,attempt_count,duplicate_hits,candidate_id,source_type,storage_path,file_name")
    .maybeSingle();
  if (claimed.error) throw new Error(claimed.error.message);
  if (!claimed.data) {
    return { job, duplicate: true as const, recovered: false };
  }
  await recordLearningAuditEvent({
    requestId: input.requestId,
    action: `${input.jobType}_attempted`,
    newValue: { job_id: job.id, attempt: claimed.data.attempt_count, engine_version: learningFlywheelEngineVersion },
    actorUserId: input.actorUserId,
  });
  return { job: claimed.data as IngestionJob, duplicate: false as const, recovered };
}

async function finishJob(input: {
  job: IngestionJob;
  requestId: string;
  jobType: JobType;
  actorUserId?: string | null;
  candidateId?: string | null;
  recovered?: boolean;
}) {
  const completedAt = new Date().toISOString();
  const result = await getSupabaseAdmin()
    .from("ai_learning_ingestion_jobs")
    .update({
      status: "succeeded",
      candidate_id: input.candidateId ?? null,
      completed_at: completedAt,
      recovered_at: input.recovered ? completedAt : null,
      updated_at: completedAt,
    })
    .eq("id", input.job.id);
  if (result.error) throw new Error(result.error.message);
  await recordLearningAuditEvent({
    requestId: input.requestId,
    fileCandidateId: input.jobType === "file_candidate" ? input.candidateId : null,
    pairCandidateId: input.jobType === "pair_candidate" ? input.candidateId : null,
    action: input.recovered ? "backfill_recovered" : `${input.jobType}_succeeded`,
    newValue: { job_id: input.job.id, engine_version: learningFlywheelEngineVersion },
    actorUserId: input.actorUserId,
  });
}

async function failJob(input: {
  job: IngestionJob;
  requestId: string;
  jobType: JobType;
  actorUserId?: string | null;
  error: unknown;
  candidateId?: string | null;
}) {
  const code = errorCode(input.error);
  const message = privateErrorMessage(input.error);
  const completedAt = new Date().toISOString();
  const nextAttemptAt = new Date(Date.now() + 5 * 60_000).toISOString();
  await getSupabaseAdmin()
    .from("ai_learning_ingestion_jobs")
    .update({
      status: code === "capture_timeout" ? "timed_out" : "failed",
      candidate_id: input.candidateId ?? null,
      completed_at: completedAt,
      last_error_code: code,
      last_error_message: message,
      next_attempt_at: nextAttemptAt,
      updated_at: completedAt,
    })
    .eq("id", input.job.id);
  await recordLearningAuditEvent({
    requestId: input.requestId,
    fileCandidateId: input.jobType === "file_candidate" ? input.candidateId : null,
    pairCandidateId: input.jobType === "pair_candidate" ? input.candidateId : null,
    action: `${input.jobType}_failed`,
    newValue: { job_id: input.job.id, error_code: code, retryable: true, engine_version: learningFlywheelEngineVersion },
    actorUserId: input.actorUserId,
    notes: message,
  });
  return message;
}

export async function captureLearningFileCandidate(input: {
  requestId: string;
  actorUserId?: string | null;
  sourceType?: FileSourceType;
  forceRetry?: boolean;
}): Promise<LearningIngestionResult> {
  const flags = resolveLearningFlywheelFlags();
  const sourceType = input.sourceType ?? "customer_upload";
  if (!flags.fileCandidatesEnabled) {
    await recordLearningAuditEvent({ requestId: input.requestId, action: "file_candidate_disabled", actorUserId: input.actorUserId });
    return { status: "disabled", jobId: null, candidateId: null, retryable: false, reason: "File candidate capture is disabled." };
  }
  let claimed: Awaited<ReturnType<typeof claimJob>>;
  try {
    claimed = await claimJob({
      jobType: "file_candidate",
      idempotencyKey: `file:${input.requestId}:${sourceType}`,
      requestId: input.requestId,
      sourceType,
      actorUserId: input.actorUserId,
      forceRetry: input.forceRetry,
    });
  } catch (error) {
    return { status: "failed", jobId: null, candidateId: null, retryable: true, reason: privateErrorMessage(error) };
  }
  if (claimed.duplicate) {
    return { status: "duplicate", jobId: claimed.job.id, candidateId: claimed.job.candidate_id, retryable: false };
  }
  try {
    const result = await captureWithTimeout(createLearningFileCandidateForOrderUpload({
      requestId: input.requestId,
      actorUserId: input.actorUserId,
      sourceType,
    }));
    const candidateId = "candidateId" in result ? result.candidateId : null;
    if (result.status === "skipped") throw new Error(result.reason);
    if ("analysisStatus" in result && result.analysisStatus === "failed") {
      const failure = new Error(result.reason || "File candidate enrichment failed and requires retry.");
      const reason = await failJob({ job: claimed.job, requestId: input.requestId, jobType: "file_candidate", actorUserId: input.actorUserId, error: failure, candidateId });
      return { status: "failed", jobId: claimed.job.id, candidateId, retryable: true, reason };
    }
    await finishJob({ job: claimed.job, requestId: input.requestId, jobType: "file_candidate", actorUserId: input.actorUserId, candidateId, recovered: claimed.recovered });
    return { status: result.status, jobId: claimed.job.id, candidateId, retryable: false };
  } catch (error) {
    const reason = await failJob({ job: claimed.job, requestId: input.requestId, jobType: "file_candidate", actorUserId: input.actorUserId, error });
    return { status: "failed", jobId: claimed.job.id, candidateId: null, retryable: true, reason };
  }
}

export async function captureLearningPairCandidate(input: {
  requestId: string;
  modFilePath?: string | null;
  modFileName?: string | null;
  actorUserId?: string | null;
  sourceType?: PairSourceType;
  forceRetry?: boolean;
}): Promise<LearningIngestionResult> {
  const flags = resolveLearningFlywheelFlags();
  const sourceType = input.sourceType ?? "modified_output";
  if (!flags.pairCandidatesEnabled) {
    await recordLearningAuditEvent({ requestId: input.requestId, action: "pair_candidate_disabled", actorUserId: input.actorUserId });
    return { status: "disabled", jobId: null, candidateId: null, retryable: false, reason: "Pair candidate capture is disabled." };
  }
  let claimed: Awaited<ReturnType<typeof claimJob>>;
  try {
    claimed = await claimJob({
      jobType: "pair_candidate",
      idempotencyKey: `pair:${input.requestId}:${input.modFilePath ?? "latest"}`,
      requestId: input.requestId,
      sourceType,
      storagePath: input.modFilePath,
      fileName: input.modFileName,
      actorUserId: input.actorUserId,
      forceRetry: input.forceRetry,
    });
  } catch (error) {
    return { status: "failed", jobId: null, candidateId: null, retryable: true, reason: privateErrorMessage(error) };
  }
  if (claimed.duplicate) {
    return { status: "duplicate", jobId: claimed.job.id, candidateId: claimed.job.candidate_id, retryable: false };
  }
  try {
    const result = await captureWithTimeout(createLearningPairCandidateForOrder({
      requestId: input.requestId,
      modFilePath: input.modFilePath,
      modFileName: input.modFileName,
      actorUserId: input.actorUserId,
      sourceType,
    }));
    if (result.status === "skipped") throw new Error(result.reason);
    await finishJob({ job: claimed.job, requestId: input.requestId, jobType: "pair_candidate", actorUserId: input.actorUserId, candidateId: result.pairId, recovered: claimed.recovered });
    return { status: result.status, jobId: claimed.job.id, candidateId: result.pairId, retryable: false };
  } catch (error) {
    const reason = await failJob({ job: claimed.job, requestId: input.requestId, jobType: "pair_candidate", actorUserId: input.actorUserId, error });
    return { status: "failed", jobId: claimed.job.id, candidateId: null, retryable: true, reason };
  }
}

export async function recoverFailedLearningIngestionJobs(input: { actorUserId: string; limit?: number }) {
  const limit = Math.min(Math.max(input.limit ?? 25, 1), 200);
  const jobs = await getSupabaseAdmin()
    .from("ai_learning_ingestion_jobs")
    .select("id,job_type,request_id,source_type,storage_path,file_name,attempt_count,max_attempts")
    .in("status", ["failed", "timed_out"])
    .order("created_at", { ascending: true })
    .limit(limit);
  if (jobs.error) throw new Error(jobs.error.message);
  const results: LearningIngestionResult[] = [];
  for (const job of jobs.data ?? []) {
    if (Number(job.attempt_count || 0) >= Number(job.max_attempts || 5)) continue;
    if (job.job_type === "file_candidate") {
      results.push(await captureLearningFileCandidate({
        requestId: job.request_id,
        actorUserId: input.actorUserId,
        sourceType: job.source_type as FileSourceType,
        forceRetry: true,
      }));
    } else {
      results.push(await captureLearningPairCandidate({
        requestId: job.request_id,
        actorUserId: input.actorUserId,
        sourceType: job.source_type as PairSourceType,
        modFilePath: job.storage_path,
        modFileName: job.file_name,
        forceRetry: true,
      }));
    }
  }
  return {
    inspected: jobs.data?.length ?? 0,
    recovered: results.filter((item) => ["created", "updated", "duplicate"].includes(item.status)).length,
    failed: results.filter((item) => item.status === "failed").length,
    results,
  };
}
