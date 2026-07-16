import { analyzeFileExpertBuffers, buildPatternSignature, sha256Buffer } from "@/lib/fileExpert/analyzer";
import { fileExpertMaxFileSize } from "@/lib/fileExpert/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  activeTrainingServiceLabels,
  parseTrainingServiceLabels,
} from "@/lib/ecuIntelligence/serviceLabels";
import {
  emptyTrainingServiceLabels,
  trainingFeatureKeys,
  type TrainingServiceLabels,
} from "@/lib/ecuIntelligence/types";
import {
  maybeCreateTrainingSampleForRequest,
  updateTrainingSampleVerification,
} from "@/lib/ecuIntelligence/learning";
import { recordLearningAuditEvent } from "@/lib/ecuIntelligence/learningAudit";
import { getCurrentLearningAuthorizationForRequest } from "@/lib/ecuIntelligence/learningAuthorization";
import {
  resolveLearningAuthorizationConfig,
  resolveLearningFlywheelFlags,
} from "@/lib/ecuIntelligence/learningConfig";
import type {
  FileExpertAnalyzerResult,
  FileExpertChangeClassification,
  FileExpertFileInspection,
} from "@/lib/fileExpert/types";

type ModifiedFileVersion = {
  id?: string;
  label?: string;
  file_name?: string;
  file_path?: string;
  uploaded_at?: string;
};

type OrderForLearning = {
  id: string;
  customer_id: string | null;
  vehicle_brand: string | null;
  vehicle_model: string | null;
  vehicle_generation: string | null;
  vehicle_engine: string | null;
  service_type: string | null;
  notes: string | null;
  ecu: string | null;
  hw_sw: string | null;
  read_method: string | null;
  uploaded_file_name: string | null;
  original_file_path: string | null;
  modified_file_path: string | null;
  modified_files: ModifiedFileVersion[] | null;
  status: string | null;
};

export type LearningFileCandidateResult =
  | {
      status: "created" | "updated";
      candidateId: string;
      sha256: string | null;
      analysisStatus: "enriched" | "failed";
      reason?: string;
    }
  | { status: "skipped"; reason: string };

export type LearningPairCandidateResult =
  | {
      status: "created" | "updated" | "duplicate";
      pairId: string;
      pairType: LearningPairType;
      qualityScore: number;
      createsTrainingSample: false;
      approvedForLearning: false;
    }
  | { status: "skipped"; reason: string };

export type LearningPairType =
  | "single_service_clean"
  | "multi_service"
  | "checksum_only_noop"
  | "uncertain"
  | "already_modified_source";

export type LearningReviewStatus =
  | "pending_review"
  | "needs_review"
  | "human_verified"
  | "approved"
  | "quarantined"
  | "excluded";

export type PairReviewUpdateInput = {
  pairId: string;
  actorUserId: string;
  reviewStatus?: LearningReviewStatus;
  performedServiceLabels?: TrainingServiceLabels;
  learningUseStatus?: "pending" | "approved_for_learning" | "excluded";
  adminNotes?: string | null;
  markUnrelatedChanges?: boolean;
};

function baseName(path: string | null | undefined) {
  if (!path) return "file.bin";
  return path.split("/").filter(Boolean).at(-1) || "file.bin";
}

function modifiedFileFor(order: OrderForLearning, requestedPath?: string | null) {
  const versions = Array.isArray(order.modified_files) ? order.modified_files : [];
  const selected = requestedPath
    ? versions.find((item) => item.file_path === requestedPath)
    : versions.at(-1);
  const path = requestedPath || selected?.file_path || order.modified_file_path;
  if (!path) return null;
  return {
    path,
    name: selected?.file_name || baseName(path),
    label: selected?.label || null,
  };
}

function submittedHwSw(order: OrderForLearning) {
  const parts = (order.hw_sw || "")
    .split(/[|,;/\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return { hwNumber: parts[0] || null, swNumber: parts[1] || null };
}

export function dtcCodesFromText(value: string | null | undefined) {
  const matches = (value || "").toUpperCase().match(/\b[PCBU][0-9A-F]{4}\b/g);
  return [...new Set(matches || [])].slice(0, 80);
}

export function requestedLabelsForOrder(order: Pick<OrderForLearning, "service_type" | "notes">) {
  return parseTrainingServiceLabels([order.service_type, order.notes].filter(Boolean).join(" "));
}

function compactFileSummary(file: FileExpertFileInspection | undefined) {
  if (!file) return null;
  return {
    file_size: file.file_size,
    sha256: file.sha256,
    file_format: file.file_format ?? "unknown",
    read_scope: file.read_scope ?? "unknown",
    hardware_numbers: file.hardware_numbers?.slice(0, 8) ?? [],
    software_numbers: file.software_numbers?.slice(0, 8) ?? [],
    calibration_ids: file.calibration_ids?.slice(0, 8) ?? [],
  };
}

function changedRegionSummary(result: FileExpertAnalyzerResult) {
  const comparison = result.comparison;
  return {
    same_size: comparison?.same_size ?? null,
    changed_bytes: comparison?.changed_bytes ?? 0,
    changed_percent: comparison?.changed_percent ?? 0,
    raw_changed_blocks: comparison?.raw_changed_blocks ?? 0,
    merged_changed_blocks: comparison?.merged_changed_blocks ?? 0,
    regions: (comparison?.changed_blocks ?? []).slice(0, 80).map((block) => ({
      start_offset_hex: block.start_offset_hex,
      end_offset_hex: block.end_offset_hex,
      length: block.length,
      changed_byte_count: block.changed_byte_count,
    })),
  };
}

function identityConflicts(result: FileExpertAnalyzerResult, order: OrderForLearning) {
  const conflicts: string[] = [];
  const identity = result.ecu_identification;
  const submitted = submittedHwSw(order);
  if (!identity || identity.status === "not_detected") conflicts.push("ecu_identity_not_detected");
  if (submitted.hwNumber && identity?.hardware_numbers.length && !identity.hardware_numbers.includes(submitted.hwNumber)) {
    conflicts.push("submitted_hw_does_not_match_detected_hw");
  }
  if (submitted.swNumber && identity?.software_numbers.length && !identity.software_numbers.includes(submitted.swNumber)) {
    conflicts.push("submitted_sw_does_not_match_detected_sw");
  }
  for (const issue of result.integrity_assessment?.issues ?? []) conflicts.push(issue);
  return [...new Set(conflicts)].slice(0, 30);
}

function pairIdentityKey(result: FileExpertAnalyzerResult) {
  const identity = result.ecu_identification;
  const file = result.files.ori ?? result.files.single ?? result.files.mod;
  return [
    identity?.supplier || "unknown",
    identity?.family || "unknown",
    identity?.variant || identity?.display_name || "unknown",
    identity?.hardware_numbers?.[0] || "unknown-hw",
    identity?.software_numbers?.[0] || "unknown-sw",
    identity?.calibration_ids?.[0] || "unknown-cal",
    file?.file_format || "unknown-format",
    file?.read_scope || "unknown-scope",
    file?.file_size || "unknown-size",
  ].join("|").toLowerCase();
}

export function classifyLearningPair(input: {
  result: Pick<FileExpertAnalyzerResult, "comparison" | "change_profile" | "summary" | "integrity_assessment">;
  requestedLabels: Partial<TrainingServiceLabels>;
  sourceStockOrModified?: "likely_stock" | "likely_modified" | "unknown";
}) {
  const activeLabels = activeTrainingServiceLabels(input.requestedLabels);
  const comparison = input.result.comparison;
  const classification = input.result.change_profile?.classification;
  const warnings: string[] = [];
  let pairType: LearningPairType = "uncertain";

  if (input.sourceStockOrModified === "likely_modified") {
    pairType = "already_modified_source";
    warnings.push("Original/source file appears already modified.");
  } else if (!comparison || classification === "single_file") {
    pairType = "uncertain";
    warnings.push("Pair comparison is missing.");
  } else if (classification === "identical" || comparison.changed_bytes === 0) {
    pairType = "checksum_only_noop";
    warnings.push("ORI and MOD are identical or effectively no-op.");
  } else if (input.result.integrity_assessment?.issues?.length) {
    pairType = "uncertain";
    warnings.push("File Expert reported identity or integrity compatibility issues.");
  } else if (activeLabels.length === 1 && classification !== "broad_rework" && classification !== "structural_mismatch") {
    pairType = "single_service_clean";
  } else if (activeLabels.length > 1 && classification !== "structural_mismatch") {
    pairType = "multi_service";
  } else {
    pairType = "uncertain";
  }

  return {
    pairType,
    activeLabels,
    warnings,
  };
}

export function scoreLearningPair(input: {
  result: FileExpertAnalyzerResult;
  requestedLabels: Partial<TrainingServiceLabels>;
  pairType: LearningPairType;
}) {
  const reasons: string[] = [];
  let score = 20;
  const comparison = input.result.comparison;
  const activeLabels = activeTrainingServiceLabels(input.requestedLabels);

  if (comparison?.same_size) {
    score += 15;
    reasons.push("same_size_pair");
  }
  if ((comparison?.changed_bytes ?? 0) > 0) {
    score += 10;
    reasons.push("binary_difference_present");
  }
  if (input.result.ecu_identification?.status === "detected" || input.result.ecu_identification?.status === "probable") {
    score += 15;
    reasons.push("ecu_identity_detected");
  }
  if (activeLabels.length === 1) {
    score += 15;
    reasons.push("single_requested_service_label");
  } else if (activeLabels.length > 1) {
    score += 8;
    reasons.push("multi_service_label_context");
  }
  if (input.result.change_profile?.classification === "focused_calibration") {
    score += 15;
    reasons.push("focused_calibration_changes");
  } else if (input.result.change_profile?.classification === "distributed_calibration") {
    score += 8;
    reasons.push("distributed_calibration_changes");
  }
  if (input.pairType === "checksum_only_noop" || input.pairType === "already_modified_source") score -= 25;
  if (input.pairType === "uncertain") score -= 10;
  if (input.result.integrity_assessment?.issues?.length) score -= 20;

  return {
    score: Math.max(0, Math.min(100, score)),
    reasons,
  };
}

async function orderById(requestId: string): Promise<OrderForLearning | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("orders")
    .select("id, customer_id, vehicle_brand, vehicle_model, vehicle_generation, vehicle_engine, service_type, notes, ecu, hw_sw, read_method, uploaded_file_name, original_file_path, modified_file_path, modified_files, status")
    .eq("id", requestId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as OrderForLearning | null;
}

async function downloadCustomerFile(path: string) {
  const { data, error } = await getSupabaseAdmin().storage.from("customer-files").download(path);
  if (error || !data) throw new Error(error?.message || `Customer file not found: ${path}`);
  const buffer = Buffer.from(await data.arrayBuffer());
  if (!buffer.length) throw new Error("Customer file is empty.");
  if (buffer.length > fileExpertMaxFileSize) {
    throw new Error(`Customer file exceeds the ${fileExpertMaxFileSize / 1024 / 1024} MB analysis limit.`);
  }
  return buffer;
}

async function upsertFileCandidate(input: {
  order: OrderForLearning;
  path: string;
  fileName: string;
  role: "ori" | "mod" | "single" | "unknown";
  sourceType: "customer_upload" | "desktop_upload" | "additional_upload" | "modified_output" | "historical_backfill" | "manual_review";
  actorUserId?: string | null;
  result?: FileExpertAnalyzerResult | null;
  buffer?: Buffer | null;
  errors?: string[];
}) {
  const requestedLabels = requestedLabelsForOrder(input.order);
  const authorization = input.sourceType === "historical_backfill"
    ? { status: "not_granted" as const, termsVersion: null }
    : await getCurrentLearningAuthorizationForRequest(input.order.id);
  const primaryFile = input.result?.files.single ?? input.result?.files.ori ?? input.result?.files.mod;
  const identity = input.result?.ecu_identification;
  const submitted = submittedHwSw(input.order);
  const sha256 = input.buffer ? sha256Buffer(input.buffer) : primaryFile?.sha256 ?? null;
  const payload = {
    request_id: input.order.id,
    customer_id: input.order.customer_id,
    source_type: input.sourceType,
    file_role_candidate: input.role,
    storage_bucket: "customer-files",
    storage_path: input.path,
    file_name: input.fileName,
    file_size: input.buffer?.length ?? primaryFile?.file_size ?? null,
    sha256,
    supplier: identity?.supplier ?? null,
    ecu_family: identity?.family ?? null,
    ecu_type: identity?.variant || identity?.display_name || input.order.ecu || null,
    hw_number: identity?.hardware_numbers?.[0] || submitted.hwNumber,
    sw_number: identity?.software_numbers?.[0] || submitted.swNumber,
    calibration_id: identity?.calibration_ids?.[0] || null,
    representation_type: primaryFile?.file_format ?? primaryFile?.read_scope ?? null,
    read_method: input.order.read_method || null,
    identity_confidence: identity?.confidence ?? 0,
    identity_conflicts: input.result ? identityConflicts(input.result, input.order) : [],
    requested_service_labels: requestedLabels,
    dtc_codes: dtcCodesFromText(`${input.order.service_type || ""} ${input.order.notes || ""}`),
    stock_or_modified_guess: input.result?.summary.stock_or_modified ?? "unknown",
    learning_authorization_status: authorization.status,
    learning_authorization_terms_version: authorization.termsVersion,
    analysis_status: input.errors?.length ? "failed" : input.result ? "enriched" : "pending",
    review_status: input.errors?.length ? "needs_review" : "pending_review",
    quality_score: Math.round((identity?.confidence ?? 0) * 65 + (sha256 ? 15 : 0) + (input.order.read_method ? 10 : 0)),
    quality_reasons: [
      ...(identity?.status && identity.status !== "not_detected" ? ["file_expert_identity_detected"] : []),
      ...(input.order.read_method ? ["explicit_read_method_available"] : ["read_method_missing"]),
      ...(sha256 ? ["sha256_calculated"] : []),
    ],
    provenance: {
      vehicle: {
        brand: input.order.vehicle_brand,
        model: input.order.vehicle_model,
        generation: input.order.vehicle_generation,
        engine: input.order.vehicle_engine,
      },
      file_expert: input.result
        ? {
            analysis_version: input.result.analysis_version,
            mode: input.result.mode,
            file: compactFileSummary(primaryFile),
          }
        : null,
      internal_only: true,
    },
    warnings: input.result?.risk_assessment.warnings ?? [],
    errors: input.errors ?? [],
    created_by: input.actorUserId ?? null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await getSupabaseAdmin()
    .from("ai_learning_file_candidates")
    .upsert(payload, { onConflict: "request_id,storage_bucket,storage_path" })
    .select("id, sha256")
    .single();
  if (error) throw new Error(error.message);
  await recordLearningAuditEvent({
    requestId: input.order.id,
    fileCandidateId: data?.id ?? null,
    action: input.errors?.length ? "file_candidate_failed" : "file_candidate_enriched",
    newValue: { source_type: input.sourceType, file_role_candidate: input.role, sha256 },
    actorUserId: input.actorUserId,
  });
  return { id: String(data.id), sha256: (data.sha256 as string | null) ?? sha256 };
}

export async function createLearningFileCandidateForOrderUpload(input: {
  requestId: string;
  actorUserId?: string | null;
  sourceType?: "customer_upload" | "desktop_upload" | "additional_upload" | "historical_backfill";
}): Promise<LearningFileCandidateResult> {
  const order = await orderById(input.requestId);
  if (!order) return { status: "skipped", reason: "Order not found." };
  if (!order.original_file_path) return { status: "skipped", reason: "Original upload path is missing." };

  try {
    const buffer = await downloadCustomerFile(order.original_file_path);
    const result = await analyzeFileExpertBuffers({
      jobId: `${order.id}:learning-file`,
      single: buffer,
      fileNames: { single: order.uploaded_file_name || baseName(order.original_file_path) },
      metadata: {
        brand: order.vehicle_brand,
        model: order.vehicle_model,
        engine: order.vehicle_engine,
        ecuType: order.ecu,
        readMethod: order.read_method,
      },
      sourceKind: "completed_request",
    });
    const saved = await upsertFileCandidate({
      order,
      path: order.original_file_path,
      fileName: order.uploaded_file_name || baseName(order.original_file_path),
      role: "ori",
      sourceType: input.sourceType ?? (order.original_file_path.includes("/desktop/") ? "desktop_upload" : "customer_upload"),
      actorUserId: input.actorUserId,
      result,
      buffer,
    });
    return {
      status: "created",
      candidateId: saved.id,
      sha256: saved.sha256,
      analysisStatus: "enriched",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "File candidate enrichment failed.";
    const saved = await upsertFileCandidate({
      order,
      path: order.original_file_path,
      fileName: order.uploaded_file_name || baseName(order.original_file_path),
      role: "ori",
      sourceType: input.sourceType ?? "customer_upload",
      actorUserId: input.actorUserId,
      errors: [message],
    });
    return {
      status: "created",
      candidateId: saved.id,
      sha256: saved.sha256,
      analysisStatus: "failed",
      reason: message,
    };
  }
}

export async function createLearningPairCandidateForOrder(input: {
  requestId: string;
  modFilePath?: string | null;
  modFileName?: string | null;
  actorUserId?: string | null;
  sourceType?: "modified_output" | "historical_backfill";
}): Promise<LearningPairCandidateResult> {
  const order = await orderById(input.requestId);
  if (!order) return { status: "skipped", reason: "Order not found." };
  const mod = modifiedFileFor(order, input.modFilePath);
  if (!order.original_file_path || !mod) {
    return {
      status: "skipped",
      reason: !order.original_file_path ? "Original upload path is missing." : "Modified output path is missing.",
    };
  }

  const [ori, modified] = await Promise.all([
    downloadCustomerFile(order.original_file_path),
    downloadCustomerFile(mod.path),
  ]);
  const result = await analyzeFileExpertBuffers({
    jobId: `${order.id}:learning-pair`,
    ori,
    mod: modified,
    fileNames: {
      ori: order.uploaded_file_name || baseName(order.original_file_path),
      mod: input.modFileName || mod.name,
    },
    metadata: {
      brand: order.vehicle_brand,
      model: order.vehicle_model,
      engine: order.vehicle_engine,
      ecuType: order.ecu,
      readMethod: order.read_method,
    },
    sourceKind: "completed_request",
  });

  const oriCandidate = await upsertFileCandidate({
    order,
    path: order.original_file_path,
    fileName: order.uploaded_file_name || baseName(order.original_file_path),
    role: "ori",
    sourceType: input.sourceType === "historical_backfill" ? "historical_backfill" : "customer_upload",
    actorUserId: input.actorUserId,
    result: await analyzeFileExpertBuffers({
      jobId: `${order.id}:learning-ori`,
      single: ori,
      fileNames: { single: order.uploaded_file_name || baseName(order.original_file_path) },
      metadata: { brand: order.vehicle_brand, model: order.vehicle_model, engine: order.vehicle_engine, ecuType: order.ecu, readMethod: order.read_method },
      sourceKind: "completed_request",
    }),
    buffer: ori,
  });
  const modCandidate = await upsertFileCandidate({
    order,
    path: mod.path,
    fileName: input.modFileName || mod.name,
    role: "mod",
    sourceType: input.sourceType ?? "modified_output",
    actorUserId: input.actorUserId,
    result: await analyzeFileExpertBuffers({
      jobId: `${order.id}:learning-mod`,
      single: modified,
      fileNames: { single: input.modFileName || mod.name },
      metadata: { brand: order.vehicle_brand, model: order.vehicle_model, engine: order.vehicle_engine, ecuType: order.ecu, readMethod: order.read_method },
      sourceKind: "completed_request",
    }),
    buffer: modified,
  });

  const requestedLabels = requestedLabelsForOrder(order);
  const sourceStock = result.files.ori && result.comparison?.changed_bytes
    ? "unknown"
    : result.summary.stock_or_modified;
  const classification = classifyLearningPair({ result, requestedLabels, sourceStockOrModified: sourceStock });
  const quality = scoreLearningPair({ result, requestedLabels, pairType: classification.pairType });
  const signature = result.pattern_signature || buildPatternSignature(result);
  const authorization = input.sourceType === "historical_backfill"
    ? { status: "not_granted" as const, termsVersion: null }
    : await getCurrentLearningAuthorizationForRequest(order.id);
  const payload = {
    request_id: order.id,
    customer_id: order.customer_id,
    ori_file_candidate_id: oriCandidate.id,
    mod_file_candidate_id: modCandidate.id,
    ori_sha256: sha256Buffer(ori),
    mod_sha256: sha256Buffer(modified),
    pair_identity_key: pairIdentityKey(result),
    pair_confidence: Math.round((result.risk_assessment.confidence ?? 0) * 100),
    pair_type: classification.pairType,
    requested_service_labels: requestedLabels,
    performed_service_labels: emptyTrainingServiceLabels(),
    dtc_codes: dtcCodesFromText(`${order.service_type || ""} ${order.notes || ""}`),
    changed_region_summary: changedRegionSummary(result),
    pattern_signature: signature,
    quality_score: quality.score,
    quality_reasons: quality.reasons,
    review_status: quality.score >= 60 ? "pending_review" : "needs_review",
    learning_use_status: "pending",
    learning_authorization_status: authorization.status,
    learning_authorization_terms_version: authorization.termsVersion,
    provenance: {
      source: input.sourceType ?? "modified_output",
      revision_label: mod.label,
      file_expert: {
        analysis_version: result.analysis_version,
        change_profile: result.change_profile,
        integrity: result.integrity_assessment,
      },
      labels_are_requested_not_confirmed: true,
      internal_only: true,
    },
    warnings: [...classification.warnings, ...result.risk_assessment.warnings],
    errors: [],
    created_by: input.actorUserId ?? null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await getSupabaseAdmin()
    .from("ai_learning_pair_candidates")
    .upsert(payload, { onConflict: "request_id,ori_sha256,mod_sha256" })
    .select("id, pair_type, quality_score")
    .single();
  if (error) throw new Error(error.message);
  await recordLearningAuditEvent({
    requestId: order.id,
    pairCandidateId: data?.id ?? null,
    action: "pair_candidate_created",
    newValue: {
      pair_type: data?.pair_type,
      quality_score: data?.quality_score,
      requested_labels: activeTrainingServiceLabels(requestedLabels),
    },
    actorUserId: input.actorUserId,
    notes: "ORI/MOD learning pair candidate created. No training sample was approved.",
  });
  return {
    status: "created",
    pairId: String(data.id),
    pairType: data.pair_type as LearningPairType,
    qualityScore: Number(data.quality_score ?? quality.score),
    createsTrainingSample: false,
    approvedForLearning: false,
  };
}

function hasAnyLabel(labels: Partial<TrainingServiceLabels> | null | undefined) {
  return trainingFeatureKeys.some((feature) => labels?.[feature]);
}

function pairTypeToChangeClassification(pairType: LearningPairType): FileExpertChangeClassification | "unknown" {
  if (pairType === "checksum_only_noop") return "identical";
  if (pairType === "already_modified_source" || pairType === "uncertain") return "unknown";
  if (pairType === "single_service_clean") return "focused_calibration";
  if (pairType === "multi_service") return "distributed_calibration";
  return "unknown";
}

export async function updateLearningPairReview(input: PairReviewUpdateInput) {
  const admin = getSupabaseAdmin();
  const current = await admin
    .from("ai_learning_pair_candidates")
    .select("*")
    .eq("id", input.pairId)
    .maybeSingle();
  if (current.error || !current.data) throw new Error(current.error?.message || "Learning pair candidate not found.");
  const existing = current.data as Record<string, unknown>;
  const nextReviewStatus = input.reviewStatus ?? (existing.review_status as LearningReviewStatus);
  const nextPerformed = input.performedServiceLabels ?? (existing.performed_service_labels as TrainingServiceLabels | null) ?? emptyTrainingServiceLabels();
  const nextLearningUse = input.learningUseStatus ?? (existing.learning_use_status as "pending" | "approved_for_learning" | "excluded");
  const nextAuthorization = existing.learning_authorization_status as "not_granted" | "granted" | "revoked" | "unknown";
  const nextQuality = Number(existing.quality_score ?? 0);
  const updatePayload: Record<string, unknown> = {
    review_status: nextReviewStatus,
    performed_service_labels: nextPerformed,
    learning_use_status: nextLearningUse,
    updated_at: new Date().toISOString(),
  };
  if (input.markUnrelatedChanges) {
    updatePayload.review_status = "quarantined";
    updatePayload.learning_use_status = "excluded";
    updatePayload.quality_reasons = [...((existing.quality_reasons as string[] | null) ?? []), "admin_marked_unrelated_changes"];
  }

  if (nextLearningUse === "approved_for_learning") {
    const flags = resolveLearningFlywheelFlags();
    const authorizationConfig = resolveLearningAuthorizationConfig();
    const currentAuthorization = existing.request_id
      ? await getCurrentLearningAuthorizationForRequest(String(existing.request_id))
      : { status: "not_granted" as const, termsVersion: null };
    if (!flags.approvalEnabled) {
      await recordLearningAuditEvent({
        requestId: existing.request_id as string | null,
        pairCandidateId: input.pairId,
        action: "approval_blocked",
        newValue: { reason: "approval_feature_disabled" },
        actorUserId: input.actorUserId,
      });
      throw new Error("Learning approval is disabled.");
    }
    if (!authorizationConfig.available || !authorizationConfig.termsVersion) {
      throw new Error("Learning approval is unavailable until approved authorization terms are configured.");
    }
    if (!["human_verified", "approved"].includes(nextReviewStatus)) {
      throw new Error("Pair must be human-verified before approved_for_learning.");
    }
    if (!hasAnyLabel(nextPerformed)) {
      throw new Error("Confirmed performed service labels are required before learning approval.");
    }
    if (nextQuality < 60) {
      throw new Error("Quality score must be at least 60 before learning approval.");
    }
    if (nextAuthorization !== "granted" || currentAuthorization.status !== "granted") {
      throw new Error("Explicit learning authorization must be granted before learning approval.");
    }
    if (
      existing.learning_authorization_terms_version !== authorizationConfig.termsVersion
      || currentAuthorization.termsVersion !== authorizationConfig.termsVersion
    ) {
      throw new Error("Learning authorization must match the current configured terms version.");
    }
  }

  const updated = await admin
    .from("ai_learning_pair_candidates")
    .update(updatePayload)
    .eq("id", input.pairId)
    .select("*")
    .single();
  if (updated.error || !updated.data) throw new Error(updated.error?.message || "Learning pair review could not be updated.");

  let trainingSample: unknown = null;
  if (nextLearningUse === "approved_for_learning" && !updated.data.linked_training_sample_id && updated.data.request_id) {
    const capture = await maybeCreateTrainingSampleForRequest(String(updated.data.request_id), {
      actorUserId: input.actorUserId,
      performedServiceLabels: nextPerformed,
      provider: "internal_learning_flywheel",
    });
    if (capture.status !== "skipped") {
      const sample = await updateTrainingSampleVerification({
        sampleId: capture.sampleId,
        actorUserId: input.actorUserId,
        status: "confirmed",
        aiCorrect: true,
        requestedServiceLabels: (updated.data.requested_service_labels as TrainingServiceLabels | null) ?? emptyTrainingServiceLabels(),
        performedServiceLabels: nextPerformed,
        learningUseStatus: "approved_for_learning",
        changeTypeClassification: pairTypeToChangeClassification(updated.data.pair_type as LearningPairType),
        revisionNumber: 1,
        provider: "internal_learning_flywheel",
        sourceType: "completed_request",
        qualityRating: Math.max(3, Math.min(5, Math.round(nextQuality / 20))),
        safetyRating: "unknown",
        outcome: "unknown",
        adminNotes: input.adminNotes || "Approved from customer-job learning flywheel.",
      });
      await admin
        .from("ai_learning_pair_candidates")
        .update({ linked_training_sample_id: sample.id })
        .eq("id", input.pairId);
      trainingSample = { id: sample.id, status: capture.status };
    }
  }

  await recordLearningAuditEvent({
    requestId: updated.data.request_id,
    pairCandidateId: input.pairId,
    action: "learning_pair_review_updated",
    oldValue: existing,
    newValue: updated.data,
    actorUserId: input.actorUserId,
    notes: input.adminNotes,
  });

  return {
    pair: updated.data,
    trainingSample,
    autoApproved: false,
  };
}

export async function backfillCompletedLearningPairs(input: {
  actorUserId: string;
  limit?: number;
  dryRun?: boolean;
}) {
  const limit = Math.min(Math.max(Number(input.limit || 25), 1), 200);
  if (!input.dryRun && !resolveLearningFlywheelFlags().backfillEnabled) {
    await recordLearningAuditEvent({
      action: "backfill_blocked",
      actorUserId: input.actorUserId,
      newValue: { reason: "backfill_feature_disabled" },
    });
    throw new Error("Learning backfill is disabled.");
  }
  const admin = getSupabaseAdmin();
  const orders = await admin
    .from("orders")
    .select("id, original_file_path, modified_file_path, modified_files, status")
    .not("original_file_path", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (orders.error) throw new Error(orders.error.message);
  const rows = (orders.data ?? []).filter((order) => order.original_file_path);
  if (input.dryRun) {
    return {
      dryRun: true,
      inspected: rows.length,
      created: 0,
      skipped: 0,
      errors: [],
      approvedLearningSamples: 0,
    };
  }
  const results: Array<{
    requestId: string;
    fileStatus: string;
    pairStatus: string;
    reason?: string;
    pairId?: string;
  }> = [];
  for (const row of rows) {
    try {
      const fileResult = await createLearningFileCandidateForOrderUpload({
        requestId: row.id,
        actorUserId: input.actorUserId,
        sourceType: "historical_backfill",
      });
      const hasModified = Boolean(row.modified_file_path || (Array.isArray(row.modified_files) && row.modified_files.length));
      const pairResult = hasModified
        ? await createLearningPairCandidateForOrder({
            requestId: row.id,
            actorUserId: input.actorUserId,
            sourceType: "historical_backfill",
          })
        : { status: "skipped" as const, reason: "Modified output path is missing." };
      results.push({
        requestId: row.id,
        fileStatus: fileResult.status,
        pairStatus: pairResult.status,
        reason: "reason" in pairResult ? pairResult.reason : undefined,
        pairId: "pairId" in pairResult ? pairResult.pairId : undefined,
      });
    } catch (error) {
      results.push({
        requestId: row.id,
        fileStatus: "error",
        pairStatus: "error",
        reason: error instanceof Error ? error.message : "Backfill failed.",
      });
    }
  }
  return {
    dryRun: false,
    inspected: rows.length,
    created: results.filter((item) => ["created", "updated", "duplicate"].includes(item.fileStatus) || ["created", "updated", "duplicate"].includes(item.pairStatus)).length,
    skipped: results.filter((item) => item.fileStatus === "skipped" && item.pairStatus === "skipped").length,
    errors: results.filter((item) => item.fileStatus === "error" || item.pairStatus === "error"),
    approvedLearningSamples: 0,
    results,
  };
}

export async function getLearningCorpusCoverage() {
  const admin = getSupabaseAdmin();
  const [
    uploads,
    identities,
    pairs,
    singleService,
    multiService,
    approvedPairs,
    trainingApproved,
    clusters,
  ] = await Promise.all([
    admin.from("ai_learning_file_candidates").select("id", { count: "exact", head: true }),
    admin.from("ai_learning_file_candidates").select("ecu_family, ecu_type, sw_number, hw_number").not("sha256", "is", null).limit(5000),
    admin.from("ai_learning_pair_candidates").select("id", { count: "exact", head: true }),
    admin.from("ai_learning_pair_candidates").select("id", { count: "exact", head: true }).eq("pair_type", "single_service_clean"),
    admin.from("ai_learning_pair_candidates").select("id", { count: "exact", head: true }).eq("pair_type", "multi_service"),
    admin.from("ai_learning_pair_candidates").select("id", { count: "exact", head: true }).eq("learning_use_status", "approved_for_learning"),
    admin.from("ai_training_samples").select("id", { count: "exact", head: true }).eq("learning_use_status", "approved_for_learning"),
    admin.from("ai_pattern_clusters").select("feature_type, sample_count, cluster_status").limit(5000),
  ]);
  const firstError = uploads.error || identities.error || pairs.error || singleService.error || multiService.error || approvedPairs.error || trainingApproved.error;
  if (firstError) throw new Error(firstError.message);
  const identityKeys = new Set(
    (identities.data ?? []).map((row) => [row.ecu_family, row.ecu_type, row.sw_number, row.hw_number].map((value) => value || "unknown").join("|"))
  );
  const serviceCoverage = Object.fromEntries(trainingFeatureKeys.map((feature) => [feature, 0]));
  if (!clusters.error) {
    for (const cluster of clusters.data ?? []) {
      if (cluster.feature_type in serviceCoverage) serviceCoverage[cluster.feature_type as keyof typeof serviceCoverage] += Number(cluster.sample_count || 0);
    }
  }
  const missingEvidence = trainingFeatureKeys
    .filter((feature) => Number(serviceCoverage[feature] || 0) === 0)
    .map((feature) => ({ feature, reason: "No approved cluster evidence yet." }));
  return {
    uploads: uploads.count ?? 0,
    exactIdentities: identityKeys.size,
    pairCandidates: pairs.count ?? 0,
    singleServicePairs: singleService.count ?? 0,
    multiServicePairs: multiService.count ?? 0,
    approvedPairs: approvedPairs.count ?? 0,
    approvedTrainingSamples: trainingApproved.count ?? 0,
    clusterSizes: clusters.error ? [] : clusters.data ?? [],
    serviceCoverage,
    stageCoverage: {
      stage1: serviceCoverage.stage1 ?? 0,
      stage2: serviceCoverage.stage2 ?? 0,
      dtc: serviceCoverage.dtc_off ?? 0,
    },
    missingEvidence,
    customerSafeProjection: false,
  };
}
