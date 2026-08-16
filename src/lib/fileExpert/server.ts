import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { requireStaffPermission } from "@/lib/apiAuth";
import { analyzeFileExpertBuffers, buildPatternSignature, sha256Buffer } from "@/lib/fileExpert/analyzer";
import { generateAiFileExpertReport } from "@/lib/ai";
import { findVehicleCandidates } from "@/lib/fileExpert/vehicleMatcher";
import type { FileExpertAnalyzerResult, FileExpertFeature, FileExpertJob } from "@/lib/fileExpert/types";
import { hasStaffPermission, type StaffAccess } from "@/lib/staffPermissions";
import {
  buildPublicSimilarityEvidence,
  findSimilarTrainingSamples,
  similaritySourceFromFileExpert,
} from "@/lib/ecuIntelligence/similarity";
import { fileExpertAllowedExtensions, fileExpertMaxFileSize } from "@/lib/fileExpert/limits";
import { buildFileExpertAiReportStatus } from "@/lib/fileExpert/reportStatus";
import {
  exactStoredObjectMetadata,
  isCompatibleFirmwareUpload,
  isExpectedFileExpertStoragePath,
  splitStoragePath,
} from "@/lib/uploadIntegrity";
export { fileExpertMaxFileSize } from "@/lib/fileExpert/limits";
export { isExpectedFileExpertStoragePath } from "@/lib/uploadIntegrity";

export const fileExpertBucket = "file-expert";
const allowedExtensions = new Set(fileExpertAllowedExtensions);

export class FileExpertJobConflictError extends Error {
  constructor() {
    super("This analysis is already running or is not ready to start.");
    this.name = "FileExpertJobConflictError";
  }
}

export class FileExpertJobInputError extends Error {
  constructor(message = "The uploaded file could not be verified safely.") {
    super(message);
    this.name = "FileExpertJobInputError";
  }
}

export class FileExpertAnalyzerUnavailableError extends Error {
  constructor() {
    super("Analysis capacity is temporarily unavailable.");
    this.name = "FileExpertAnalyzerUnavailableError";
  }
}

export function safeFileExpertAnalysisError(error: unknown) {
  if (error instanceof FileExpertJobConflictError) {
    return { status: 409, message: error.message };
  }
  if (error instanceof FileExpertJobInputError) {
    return { status: 400, message: error.message };
  }
  if (error instanceof FileExpertAnalyzerUnavailableError) {
    return { status: 503, message: error.message };
  }
  return { status: 500, message: "Analysis failed. Please retry or contact support." };
}

export function sanitizeFileExpertName(name: string) {
  const cleaned = name.replaceAll(" ", "_").replace(/[^a-zA-Z0-9._-]/g, "");
  return cleaned || "file.bin";
}

export function validateFileExpertFile(file: File | null) {
  if (!file || file.size === 0) return "File is empty.";
  return validateFileExpertDescriptor({ name: file.name, size: file.size });
}

export function validateFileExpertDescriptor(file: { name: string; size: number }) {
  if (!file.size || file.size <= 0) return "File is empty.";
  if (file.size > fileExpertMaxFileSize) return "File is too large. Maximum size is 32 MB.";

  const lowerName = file.name.toLowerCase();
  const hasAllowedExtension = Array.from(allowedExtensions).some((ext) => lowerName.endsWith(ext));
  if (!hasAllowedExtension) {
    return "Unsupported file type. Please upload .bin, .ori, .mod, .frf, .hex or .zip.";
  }

  return null;
}

export async function getCurrentServerUser(request?: Request) {
  const token = request?.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const cookieHeader = request?.headers.get("cookie") ?? "";
  const hasSupabaseAuthCookie = /(?:^|;\s*)sb-[^=;]+-auth-token(?:\.\d+)?=/.test(cookieHeader);

  if (request && !token && !hasSupabaseAuthCookie) return null;

  const supabase = await getSupabaseServer();

  if (token) {
    const {
      data: { user },
    } = await supabase.auth.getUser(token);

    if (user) return user;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function isFileExpertAdmin(userId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const current = await supabaseAdmin
    .from("profiles")
    .select("role, staff_role, staff_permissions")
    .eq("id", userId)
    .single();

  if (current.error?.code === "42703") {
    // A legacy role value alone cannot prove Primary Owner or File Expert
    // authority. Fail closed until the staff security columns are available.
    return false;
  }

  const access: StaffAccess = {
    role: current.data?.role ?? null,
    staffRole: current.data?.staff_role ?? null,
    permissions: Array.isArray(current.data?.staff_permissions)
      ? current.data.staff_permissions
      : [],
  };
  return hasStaffPermission(access, "file_expert.manage");
}

export async function requireFileExpertAdmin(request?: Request) {
  if (!request) return { ok: false as const, error: "Unauthorized", status: 401 as const };
  const auth = await requireStaffPermission(request, "file_expert.manage");
  if (!auth.ok) return { ok: false as const, error: auth.error, status: auth.status };
  return { ok: true as const, user: auth.user, status: 200 as const };
}

async function downloadFile(input: {
  path: string | null;
  fileName: string | null;
  expectedSize: number | string | null;
  expectedSha256: string | null;
}) {
  const { path } = input;
  if (!path) return null;
  const supabaseAdmin = getSupabaseAdmin();
  const { folder, name } = splitStoragePath(path);
  const { data: objects, error: metadataError } = await supabaseAdmin.storage
    .from(fileExpertBucket)
    .list(folder, { search: name, limit: 5 });
  const metadata = exactStoredObjectMetadata(objects, name);
  const expectedSize = Number(input.expectedSize);
  if (
    metadataError ||
    !metadata ||
    metadata.size > fileExpertMaxFileSize ||
    !Number.isInteger(expectedSize) ||
    expectedSize <= 0 ||
    metadata.size !== expectedSize ||
    !isCompatibleFirmwareUpload(input.fileName ?? "", metadata.contentType)
  ) {
    throw new FileExpertJobInputError();
  }
  const { data, error } = await supabaseAdmin.storage.from(fileExpertBucket).download(path);
  if (error || !data) {
    throw new FileExpertJobInputError();
  }
  const buffer = Buffer.from(await data.arrayBuffer());
  if (!buffer.length || buffer.length !== metadata.size || buffer.length > fileExpertMaxFileSize) {
    throw new FileExpertJobInputError();
  }
  if (input.expectedSha256 && sha256Buffer(buffer) !== input.expectedSha256.toLowerCase()) {
    throw new FileExpertJobInputError("The stored file changed after its previous analysis.");
  }
  return buffer;
}

export function getExternalAnalyzerConfiguration(
  environment: Readonly<Record<string, string | undefined>> = process.env
) {
  const rawUrl = environment.FILE_EXPERT_ANALYZER_URL?.trim() ?? "";
  const token = environment.FILE_EXPERT_ANALYZER_TOKEN?.trim() ?? "";
  if (!rawUrl || token.length < 32) return null;
  try {
    const url = new URL(rawUrl);
    const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
    const isLoopback = loopbackHosts.has(url.hostname.toLowerCase());
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback))
    ) return null;
    return { url: url.toString().replace(/\/$/, ""), token };
  } catch {
    return null;
  }
}

async function readBoundedAnalyzerResponse(response: Response) {
  const maximumBytes = 2 * 1024 * 1024;
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) return null;
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maximumBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const payload = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
  try {
    return JSON.parse(payload) as FileExpertAnalyzerResult;
  } catch {
    return null;
  }
}

function isSupportedAnalyzerInspection(
  value: unknown,
  expectedSize: number | string | null,
  expectedSha256: string | null
) {
  if (!value || typeof value !== "object") return false;
  const inspection = value as Record<string, unknown>;
  const size = Number(inspection.file_size);
  const sha256 = typeof inspection.sha256 === "string"
    ? inspection.sha256.toLowerCase()
    : "";
  return Number.isInteger(size) &&
    size === Number(expectedSize) &&
    /^[a-f0-9]{64}$/.test(sha256) &&
    (!expectedSha256 || sha256 === expectedSha256.toLowerCase()) &&
    typeof inspection.first_64_bytes_hex === "string" &&
    typeof inspection.last_64_bytes_hex === "string" &&
    Number.isFinite(Number(inspection.ff_ratio)) &&
    Number.isFinite(Number(inspection.zero_ratio)) &&
    Number.isFinite(Number(inspection.entropy)) &&
    Array.isArray(inspection.ascii_strings) &&
    Array.isArray(inspection.ecu_identifiers);
}

function isSupportedExternalAnalyzerResult(
  result: FileExpertAnalyzerResult | null,
  job: FileExpertJob
): result is FileExpertAnalyzerResult {
  if (!result || !/^2\.\d+\.\d+$/.test(result.analysis_version)) return false;
  if (!result.files || typeof result.files !== "object") return false;

  const hasOri = Boolean(job.ori_file_path);
  const hasMod = Boolean(job.mod_file_path);
  if (result.mode !== (hasOri && hasMod ? "ori_mod_compare" : "single_file")) return false;
  if (hasOri !== Boolean(result.files.ori) || hasMod !== Boolean(result.files.mod)) return false;
  if (hasOri && !isSupportedAnalyzerInspection(
    result.files.ori,
    job.ori_file_size,
    job.ori_sha256
  )) return false;
  if (hasMod && !isSupportedAnalyzerInspection(
    result.files.mod,
    job.mod_file_size,
    job.mod_sha256
  )) return false;

  const singleExpectedSize = hasOri ? job.ori_file_size : job.mod_file_size;
  const singleExpectedHash = hasOri ? job.ori_sha256 : job.mod_sha256;
  if (result.files.single && !isSupportedAnalyzerInspection(
    result.files.single,
    singleExpectedSize,
    singleExpectedHash
  )) return false;

  return result.job_id === job.id &&
    Array.isArray(result.active_regions) &&
    Array.isArray(result.map_candidates) &&
    Array.isArray(result.repeated_patterns) &&
    Array.isArray(result.possible_features) &&
    Boolean(result.risk_assessment) &&
    Number.isFinite(Number(result.risk_assessment.confidence)) &&
    Array.isArray(result.risk_assessment.reasons) &&
    Array.isArray(result.risk_assessment.warnings) &&
    Boolean(result.summary) &&
    typeof result.summary.main_conclusion === "string" &&
    Array.isArray(result.summary.recommended_next_steps);
}

async function callExternalAnalyzer(input: { job: FileExpertJob }) {
  const configuration = getExternalAnalyzerConfiguration();
  if (!configuration) return null;

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const createAnalyzerUrl = async (path: string | null) => {
      if (!path) return null;
      const { data, error } = await supabaseAdmin.storage
        .from(fileExpertBucket)
        .createSignedUrl(path, 60);
      return error ? null : data?.signedUrl ?? null;
    };
    const [oriSignedUrl, modSignedUrl] = await Promise.all([
      createAnalyzerUrl(input.job.ori_file_path),
      createAnalyzerUrl(input.job.mod_file_path),
    ]);

    if (
      (input.job.ori_file_path && !oriSignedUrl) ||
      (input.job.mod_file_path && !modSignedUrl)
    ) return null;

    const response = await fetch(`${configuration.url}/analyze`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${configuration.token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(25_000),
      body: JSON.stringify({
        job_id: input.job.id,
        ori_file_url: oriSignedUrl,
        mod_file_url: modSignedUrl,
        metadata: {
          brand: input.job.brand,
          model: input.job.model,
          engine: input.job.engine,
          ecu_type: input.job.ecu_type,
          read_method: input.job.read_method,
          ori_file_name: input.job.ori_file_name,
          mod_file_name: input.job.mod_file_name,
        },
      }),
    });

    if (!response.ok) return null;
    const result = await readBoundedAnalyzerResponse(response);
    return result?.job_id === input.job.id ? result : null;
  } catch {
    return null;
  }
}

function getPrimaryFingerprintEntries(result: FileExpertAnalyzerResult, job: FileExpertJob) {
  const activeRegions = result.active_regions;
  const entries = [];

  if (result.files.ori && result.files.mod) {
    entries.push({ role: "ori", file: result.files.ori });
    entries.push({ role: "mod", file: result.files.mod });
  } else if (result.files.single) {
    entries.push({ role: "single", file: result.files.single });
  } else if (result.files.ori) {
    entries.push({ role: "single", file: result.files.ori });
  } else if (result.files.mod) {
    entries.push({ role: "single", file: result.files.mod });
  }

  return entries.map((entry) => ({
    job_id: job.id,
    file_role: entry.role,
    sha256: entry.file.sha256,
    file_size: entry.file.file_size,
    ecu_strings: entry.file.ecu_identifiers,
    ascii_strings: entry.file.ascii_strings.slice(0, 80),
    ff_ratio: entry.file.ff_ratio,
    zero_ratio: entry.file.zero_ratio,
    entropy: entry.file.entropy,
    active_regions: activeRegions,
    fingerprint_json: {
      identifiers: entry.file.ecu_identifiers,
      ecu_identification: result.ecu_identification ?? null,
      first_64_bytes_hex: entry.file.first_64_bytes_hex,
      last_64_bytes_hex: entry.file.last_64_bytes_hex,
      mode: result.mode,
    },
  }));
}

export async function analyzeFileExpertJob(
  jobId: string,
  options: { allowCompleted?: boolean } = {}
) {
  const supabaseAdmin = getSupabaseAdmin();
  const claimToken = randomUUID();
  const claimStartedAt = new Date().toISOString();
  const claimPayload = {
    status: "processing",
    error_message: null,
    analysis_claim_token: claimToken,
    analysis_started_at: claimStartedAt,
  };

  let claim = await supabaseAdmin
    .from("file_expert_jobs")
    .update(claimPayload)
    .eq("id", jobId)
    .in("status", options.allowCompleted
      ? ["pending", "failed", "completed"]
      : ["pending", "failed"])
    .select("*")
    .maybeSingle();

  if (!claim.error && !claim.data) {
    const staleBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    claim = await supabaseAdmin
      .from("file_expert_jobs")
      .update(claimPayload)
      .eq("id", jobId)
      .eq("status", "processing")
      .or(`analysis_started_at.is.null,analysis_started_at.lt.${staleBefore}`)
      .select("*")
      .maybeSingle();
  }

  if (claim.error) throw new Error("File Expert analysis could not be started.");
  if (!claim.data) throw new FileExpertJobConflictError();

  const job = claim.data as FileExpertJob;

  try {
    if (
      !job.user_id ||
      !isExpectedFileExpertStoragePath(job.ori_file_path, job.user_id, job.id) ||
      !isExpectedFileExpertStoragePath(job.mod_file_path, job.user_id, job.id)
    ) {
      throw new FileExpertJobInputError("The job contains an invalid upload path.");
    }
    if (!job.ori_file_path && !job.mod_file_path) {
      throw new FileExpertJobInputError("No uploaded file is attached to this job.");
    }
    for (const descriptor of [
      job.ori_file_path ? { name: job.ori_file_name ?? "", size: Number(job.ori_file_size) } : null,
      job.mod_file_path ? { name: job.mod_file_name ?? "", size: Number(job.mod_file_size) } : null,
    ]) {
      if (descriptor && validateFileExpertDescriptor(descriptor)) {
        throw new FileExpertJobInputError();
      }
    }
    const externalResult = await callExternalAnalyzer({ job });
    const supportedExternalResult = isSupportedExternalAnalyzerResult(externalResult, job)
      ? externalResult
      : null;
    if (!supportedExternalResult && process.env.NODE_ENV === "production") {
      // Keep the synchronous TypeScript implementation available for local
      // development and tests only. Production binary CPU work must run in the
      // isolated analyzer service, whose concurrency is bounded independently.
      // Unsupported or integrity-mismatched 2.x responses fail closed too.
      throw new FileExpertAnalyzerUnavailableError();
    }

    let result: FileExpertAnalyzerResult;
    if (supportedExternalResult) {
      // The analyzer downloads the signed sources itself and returns hashes and
      // sizes bound to the job. Avoid buffering the same 32 MB sources in Next.
      result = supportedExternalResult;
    } else {
      const ori = await downloadFile({
        path: job.ori_file_path,
        fileName: job.ori_file_name,
        expectedSize: job.ori_file_size,
        expectedSha256: job.ori_sha256,
      });
      const mod = await downloadFile({
        path: job.mod_file_path,
        fileName: job.mod_file_name,
        expectedSize: job.mod_file_size,
        expectedSha256: job.mod_sha256,
      });
      const single = !ori && !mod ? null : ori && !mod ? ori : !ori && mod ? mod : null;
      result = await analyzeFileExpertBuffers({
        jobId: job.id,
        ori: ori ?? undefined,
        mod: mod ?? undefined,
        single: single ?? undefined,
        fileNames: {
          ori: job.ori_file_name,
          mod: job.mod_file_name,
          single: job.ori_file_name ?? job.mod_file_name,
        },
        metadata: {
          brand: job.brand,
          model: job.model,
          engine: job.engine,
          ecuType: job.ecu_type,
          readMethod: job.read_method,
        },
        sourceKind: "manual_file_expert",
      });
    }

    result.vehicle_match = findVehicleCandidates({
      identification: result.ecu_identification,
      metadata: {
        brand: job.brand,
        model: job.model,
        engine: job.engine,
      },
    });

    if (result.vehicle_match.total_matches > 0) {
      result.findings = [
        ...(result.findings ?? []),
        {
          id: "vehicle-applications",
          category: "vehicle",
          severity: "info",
          title: `${result.vehicle_match.total_matches} compatible vehicle applications`,
          summary: result.vehicle_match.summary,
          confidence: result.vehicle_match.exact_vehicle_identified ? 0.94 : 0.62,
          evidence: result.vehicle_match.candidates.slice(0, 3).map(
            (candidate) => `${candidate.brand} ${candidate.model} ${candidate.engine}`
          ),
        },
      ];
    }

    const similaritySource = similaritySourceFromFileExpert(job, result);
    const similarity = await findSimilarTrainingSamples(similaritySource).catch(() => null);
    const generated = await generateAiFileExpertReport({
      sourceType: "file_expert_job",
      sourceId: job.id,
      result,
      metadata: {
        brand: job.brand,
        model: job.model,
        engine: job.engine,
        ecuType: job.ecu_type,
        readMethod: job.read_method,
        customerNotes: job.customer_notes,
      },
      similarityEvidence: similarity ? buildPublicSimilarityEvidence(similarity) : null,
    });
    result.ai_report_status = buildFileExpertAiReportStatus(generated);

    const exactVehicle = result.vehicle_match?.exact_vehicle_identified
      ? result.vehicle_match.candidates[0]
      : null;
    const fingerprints = getPrimaryFingerprintEntries(result, job);
    const completion = {
      analysis_version: result.analysis_version,
      brand: job.brand || exactVehicle?.brand || null,
      model: job.model || exactVehicle?.model || null,
      engine: job.engine || exactVehicle?.engine || null,
      ecu_type:
        result.ecu_identification && result.ecu_identification.confidence >= 0.68
          ? result.ecu_identification.display_name
          : job.ecu_type,
      ecu_family: result.ecu_identification?.family ?? job.ecu_family,
      sw_number: result.ecu_identification?.software_numbers[0] ?? job.sw_number,
      hw_number: result.ecu_identification?.hardware_numbers[0] ?? job.hw_number,
      ori_sha256: result.files.ori?.sha256 ?? job.ori_sha256,
      mod_sha256: result.files.mod?.sha256 ?? job.mod_sha256,
      ori_file_size: result.files.ori?.file_size ?? job.ori_file_size,
      mod_file_size: result.files.mod?.file_size ?? job.mod_file_size,
      result_json: result,
      ai_report: generated.report,
      executive_summary: generated.executiveSummary,
      detected_features: result.possible_features,
      confidence_score: Math.round(result.risk_assessment.confidence * 100),
      risk_level: result.risk_assessment.risk_level,
    };
    const similarityMatches = similarity?.matches.map((match) => ({
      training_sample_id: match.training_sample_id,
      score: match.score,
      ecu_match_score: match.ecu_match_score,
      file_size_score: match.file_size_score,
      identifier_score: match.identifier_score,
      pattern_score: match.pattern_score,
      feature_label_score: match.feature_label_score,
      reasons: match.reasons,
      warnings: match.warnings,
      compared_sample: match.compared_sample,
    })) ?? [];

    // The RPC locks the job row, rechecks the exact token and live lease, then
    // replaces fingerprints/similarity and completes the job in one transaction.
    // A reclaimed worker cannot commit any derived row independently.
    const { data: completedJob, error: completeError } = await supabaseAdmin.rpc(
      "complete_file_expert_analysis_atomic",
      {
        p_job_id: job.id,
        p_claim_token: claimToken,
        p_completion: completion,
        p_fingerprints: fingerprints,
        p_similarity_matches: similarityMatches,
      }
    );

    if (completeError) throw completeError;
    if (completedJob !== true) throw new FileExpertJobConflictError();

    return result;
  } catch (error) {
    const message = safeFileExpertAnalysisError(error).message;
    await supabaseAdmin
      .from("file_expert_jobs")
      .update({
        status: "failed",
        error_message: message,
        analysis_claim_token: null,
        analysis_started_at: null,
      })
      .eq("id", job.id)
      .eq("status", "processing")
      .eq("analysis_claim_token", claimToken);
    throw error;
  }
}

export async function storeConfirmedPatterns(input: {
  job: FileExpertJob;
  adminNotes: string;
  actualFeatures: Partial<Record<FileExpertFeature, boolean>>;
}) {
  const supabaseAdmin = getSupabaseAdmin();
  const result = input.job.result_json;
  if (!result) return;

  const confirmed = Object.entries(input.actualFeatures).filter(([, value]) => value);
  if (!confirmed.length) return;

  const signature = buildPatternSignature(result);
  const ecuFamily =
    result.ecu_identification?.family ??
    result.files.ori?.ecu_identifiers[0] ??
    result.files.mod?.ecu_identifiers[0] ??
    result.files.single?.ecu_identifiers[0] ??
    null;

  await supabaseAdmin.from("known_file_patterns").insert(
    confirmed.map(([feature]) => ({
      ecu_family: ecuFamily,
      ecu_type: input.job.ecu_type,
      feature_type: feature,
      pattern_signature: signature,
      source_job_id: input.job.id,
      human_confirmed: true,
      confidence: 1,
      notes: input.adminNotes || null,
    }))
  );
}

export async function getFileHashes(input: { ori?: Buffer | null; mod?: Buffer | null }) {
  return {
    ori_sha256: input.ori ? sha256Buffer(input.ori) : null,
    mod_sha256: input.mod ? sha256Buffer(input.mod) : null,
    ori_file_size: input.ori?.length ?? null,
    mod_file_size: input.mod?.length ?? null,
  };
}
