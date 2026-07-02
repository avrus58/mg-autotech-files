import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { analyzeFileExpertBuffers, buildPatternSignature, sha256Buffer } from "@/lib/fileExpert/analyzer";
import { generateAiFileExpertReport } from "@/lib/ai";
import { findVehicleCandidates } from "@/lib/fileExpert/vehicleMatcher";
import type { FileExpertAnalyzerResult, FileExpertFeature, FileExpertJob } from "@/lib/fileExpert/types";
import { hasStaffPermission, type StaffAccess } from "@/lib/staffPermissions";

export const fileExpertBucket = "file-expert";
export const fileExpertMaxFileSize = 32 * 1024 * 1024;
const allowedExtensions = new Set([".bin", ".ori", ".mod", ".frf", ".hex", ".zip"]);

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
  const supabase = await getSupabaseServer();

  const token = request?.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();

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
    const legacy = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();
    return legacy.data?.role === "admin";
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
  const user = await getCurrentServerUser(request);
  if (!user) return { error: "Unauthorized", status: 401 as const };

  const isAdmin = await isFileExpertAdmin(user.id);
  if (!isAdmin) return { error: "Admin access required", status: 403 as const };

  return { user, status: 200 as const };
}

async function downloadFile(path: string | null) {
  if (!path) return null;
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.storage.from(fileExpertBucket).download(path);
  if (error || !data) {
    throw new Error(error?.message || `File could not be downloaded: ${path}`);
  }
  const buffer = Buffer.from(await data.arrayBuffer());
  if (!buffer.length) throw new Error("Uploaded file is empty.");
  if (buffer.length > fileExpertMaxFileSize) {
    throw new Error("Uploaded file exceeds the 32 MB analysis limit.");
  }
  return buffer;
}

async function callExternalAnalyzer(input: {
  job: FileExpertJob;
  ori?: Buffer | null;
  mod?: Buffer | null;
}) {
  const analyzerUrl = process.env.FILE_EXPERT_ANALYZER_URL;
  if (!analyzerUrl) return null;

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const [oriSigned, modSigned] = await Promise.all([
      input.job.ori_file_path
        ? supabaseAdmin.storage.from(fileExpertBucket).createSignedUrl(input.job.ori_file_path, 300)
        : Promise.resolve({ data: null }),
      input.job.mod_file_path
        ? supabaseAdmin.storage.from(fileExpertBucket).createSignedUrl(input.job.mod_file_path, 300)
        : Promise.resolve({ data: null }),
    ]);

    const response = await fetch(`${analyzerUrl.replace(/\/$/, "")}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_id: input.job.id,
        ori_file_path: input.job.ori_file_path,
        mod_file_path: input.job.mod_file_path,
        ori_file_url: oriSigned.data?.signedUrl ?? null,
        mod_file_url: modSigned.data?.signedUrl ?? null,
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
    return (await response.json()) as FileExpertAnalyzerResult;
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

export async function analyzeFileExpertJob(jobId: string) {
  const supabaseAdmin = getSupabaseAdmin();

  await supabaseAdmin
    .from("file_expert_jobs")
    .update({ status: "processing", error_message: null })
    .eq("id", jobId);

  const { data: jobData, error: jobError } = await supabaseAdmin
    .from("file_expert_jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (jobError || !jobData) {
    throw new Error(jobError?.message || "File Expert job not found.");
  }

  const job = jobData as FileExpertJob;

  try {
    const ori = await downloadFile(job.ori_file_path);
    const mod = await downloadFile(job.mod_file_path);
    const single = !ori && !mod ? null : ori && !mod ? ori : !ori && mod ? mod : null;

    const externalResult = await callExternalAnalyzer({ job, ori, mod });
    const result =
      externalResult?.analysis_version?.startsWith("2.")
        ? externalResult
        : await analyzeFileExpertBuffers({
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
    });

    await supabaseAdmin
      .from("file_expert_binary_fingerprints")
      .delete()
      .eq("job_id", job.id);

    const fingerprints = getPrimaryFingerprintEntries(result, job);
    if (fingerprints.length) {
      const { error: fingerprintError } = await supabaseAdmin
        .from("file_expert_binary_fingerprints")
        .insert(fingerprints);
      if (fingerprintError) throw fingerprintError;
    }

    const exactVehicle = result.vehicle_match?.exact_vehicle_identified
      ? result.vehicle_match.candidates[0]
      : null;
    const { error: updateError } = await supabaseAdmin
      .from("file_expert_jobs")
      .update({
        status: "completed",
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
        error_message: null,
      })
      .eq("id", job.id);

    if (updateError) throw updateError;

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analysis failed.";
    await supabaseAdmin
      .from("file_expert_jobs")
      .update({ status: "failed", error_message: message })
      .eq("id", job.id);
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
