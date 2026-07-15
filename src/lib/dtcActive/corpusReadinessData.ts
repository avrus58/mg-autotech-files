import "server-only";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildDtcCorpusReadinessReport,
  dtcCorpusReadinessTargets,
  type DtcCorpusEvidenceItem,
  type DtcCorpusReadinessReport,
} from "@/lib/dtcActive/corpusReadiness";
import type { FileExpertAnalyzerResult } from "@/lib/fileExpert/types";
import type { TrainingServiceLabels } from "@/lib/ecuIntelligence/types";

type LoadResult = {
  report: DtcCorpusReadinessReport;
  warnings: string[];
  sourceCounts: Record<string, number>;
};

type TrainingSampleRow = {
  id: string;
  ecu_family: string | null;
  ecu_type: string | null;
  sw_number: string | null;
  hw_number: string | null;
  read_method: string | null;
  ori_sha256: string | null;
  mod_sha256: string | null;
  ori_file_size: number | string | null;
  mod_file_size: number | string | null;
  performed_service_labels: TrainingServiceLabels | null;
  requested_service_labels: TrainingServiceLabels | null;
  human_verification_status: string | null;
  learning_use_status: string | null;
  data_quality_score: number | string | null;
  source_type: string | null;
  provider: string | null;
  source_metadata: Record<string, unknown> | null;
  diff_json: FileExpertAnalyzerResult | null;
  pattern_signature: Record<string, unknown> | null;
  change_type_classification: string | null;
  outcome: string | null;
  created_at: string;
};

type DatasetFileRow = {
  id: string;
  file_role_guess: string | null;
  file_size: number | string | null;
  fingerprint: string | null;
  ecu_family_guess: string | null;
  ecu_type_guess: string | null;
  sw_number_guess: string | null;
  hw_number_guess: string | null;
  service_label_guess: string[] | null;
  provider_metadata: Record<string, unknown> | null;
  validation_status: string | null;
  privacy_status: string | null;
  warnings: string[] | null;
};

type DatasetPairRow = {
  id: string;
  ori_candidate_id: string | null;
  mod_candidate_id: string | null;
  pair_confidence: number | string | null;
  file_size_relation: string | null;
  sw_hw_match: boolean | null;
  service_label_guess: string[] | null;
  actual_service_labels: string[] | null;
  changed_region_summary: Record<string, unknown> | null;
  map_attribution_summary: Record<string, unknown> | null;
  quality_score: number | string | null;
  quality_reasons: string[] | null;
  learning_recommendation: string | null;
  review_status: string | null;
  admin_notes: string | null;
};

type FileExpertJobRow = {
  id: string;
  status: string | null;
  ecu_family: string | null;
  ecu_type: string | null;
  sw_number: string | null;
  hw_number: string | null;
  read_method: string | null;
  ori_sha256: string | null;
  ori_file_size: number | string | null;
  result_json: FileExpertAnalyzerResult | null;
  confidence_score: number | string | null;
  risk_level: string | null;
};

type MapDefinitionSetRow = {
  id: string;
  ecu_family: string | null;
  ecu_type: string | null;
  sw_number: string | null;
  hw_number: string | null;
  source_type: string | null;
  confidence_score: number | string | null;
  human_verified: boolean | null;
  verification_status: string | null;
  active: boolean | null;
};

type ReadinessImportRow = {
  id: string;
  import_batch_id: string;
  record_id: string;
  source_kind: DtcCorpusEvidenceItem["sourceKind"] | "manual_lab_import" | null;
  ecu_supplier: string | null;
  ecu_family: string | null;
  ecu_type: string | null;
  hw_number: string | null;
  sw_number: string | null;
  calibration_id: string | null;
  representation_type: string | null;
  file_role: string | null;
  file_size: number | string | null;
  segment_manifest_digest: string | null;
  read_method: string | null;
  source_provenance: string | null;
  source_authorization_quality: DtcCorpusEvidenceItem["sourceAuthorizationQuality"] | null;
  original_hash: string | null;
  mod_hash: string | null;
  exact_dtc_labels: string[] | null;
  service_labels: string[] | null;
  human_verified: boolean | null;
  learning_approved: boolean | null;
  pair_confidence: number | string | null;
  pair_review_status: string | null;
  pair_identity_consistent: boolean | null;
  changed_region_signature: string | null;
  changed_region_consistency: DtcCorpusEvidenceItem["changedRegionConsistency"] | null;
  unrelated_change: boolean | null;
  checksum_only_control: boolean | null;
  already_modified_negative: boolean | null;
  wrong_pair_negative: boolean | null;
  pre_integrity_available: boolean | null;
  final_mod_available: boolean | null;
  map_definition_available: boolean | null;
  integrity_evidence_available: boolean | null;
  bench_verified: boolean | null;
  successful_write_readback: boolean | null;
  rollback_verified: boolean | null;
  conflict_notes: string[] | null;
  validation_status: string | null;
};

export async function loadDtcCorpusReadinessReport(): Promise<LoadResult> {
  const admin = getSupabaseAdmin();
  const warnings: string[] = [];
  const [
    trainingSamples,
    datasetFiles,
    datasetPairs,
    fileExpertJobs,
    mapDefinitions,
    readinessImports,
  ] = await Promise.all([
    readRows<TrainingSampleRow>(
      admin.from("ai_training_samples").select([
        "id",
        "ecu_family",
        "ecu_type",
        "sw_number",
        "hw_number",
        "read_method",
        "ori_sha256",
        "mod_sha256",
        "ori_file_size",
        "mod_file_size",
        "performed_service_labels",
        "requested_service_labels",
        "human_verification_status",
        "learning_use_status",
        "data_quality_score",
        "source_type",
        "provider",
        "source_metadata",
        "diff_json",
        "pattern_signature",
        "change_type_classification",
        "outcome",
        "created_at",
      ].join(", ")).limit(5000),
      "ai_training_samples",
      warnings
    ),
    readRows<DatasetFileRow>(
      admin.from("ai_dataset_file_candidates").select([
        "id",
        "file_role_guess",
        "file_size",
        "fingerprint",
        "ecu_family_guess",
        "ecu_type_guess",
        "sw_number_guess",
        "hw_number_guess",
        "service_label_guess",
        "provider_metadata",
        "validation_status",
        "privacy_status",
        "warnings",
      ].join(", ")).limit(10000),
      "ai_dataset_file_candidates",
      warnings
    ),
    readRows<DatasetPairRow>(
      admin.from("ai_dataset_pair_candidates").select([
        "id",
        "ori_candidate_id",
        "mod_candidate_id",
        "pair_confidence",
        "file_size_relation",
        "sw_hw_match",
        "service_label_guess",
        "actual_service_labels",
        "changed_region_summary",
        "map_attribution_summary",
        "quality_score",
        "quality_reasons",
        "learning_recommendation",
        "review_status",
        "admin_notes",
      ].join(", ")).limit(10000),
      "ai_dataset_pair_candidates",
      warnings
    ),
    readRows<FileExpertJobRow>(
      admin.from("file_expert_jobs").select([
        "id",
        "status",
        "ecu_family",
        "ecu_type",
        "sw_number",
        "hw_number",
        "read_method",
        "ori_sha256",
        "ori_file_size",
        "result_json",
        "confidence_score",
        "risk_level",
      ].join(", ")).eq("status", "completed").limit(2000),
      "file_expert_jobs",
      warnings
    ),
    readRows<MapDefinitionSetRow>(
      admin.from("ai_map_definition_sets").select([
        "id",
        "ecu_family",
        "ecu_type",
        "sw_number",
        "hw_number",
        "source_type",
        "confidence_score",
        "human_verified",
        "verification_status",
        "active",
      ].join(", ")).eq("active", true).limit(2000),
      "ai_map_definition_sets",
      warnings
    ),
    readRows<ReadinessImportRow>(
      admin.from("dtc_readiness_import_records").select([
        "id",
        "import_batch_id",
        "record_id",
        "source_kind",
        "ecu_supplier",
        "ecu_family",
        "ecu_type",
        "hw_number",
        "sw_number",
        "calibration_id",
        "representation_type",
        "file_role",
        "file_size",
        "segment_manifest_digest",
        "read_method",
        "source_provenance",
        "source_authorization_quality",
        "original_hash",
        "mod_hash",
        "exact_dtc_labels",
        "service_labels",
        "human_verified",
        "learning_approved",
        "pair_confidence",
        "pair_review_status",
        "pair_identity_consistent",
        "changed_region_signature",
        "changed_region_consistency",
        "unrelated_change",
        "checksum_only_control",
        "already_modified_negative",
        "wrong_pair_negative",
        "pre_integrity_available",
        "final_mod_available",
        "map_definition_available",
        "integrity_evidence_available",
        "bench_verified",
        "successful_write_readback",
        "rollback_verified",
        "conflict_notes",
        "validation_status",
      ].join(", ")).eq("validation_status", "accepted").limit(5000),
      "dtc_readiness_import_records",
      warnings,
      { optional: true }
    ),
  ]);

  const rawEvidence: DtcCorpusEvidenceItem[] = [
    ...trainingSamples.map(trainingSampleToEvidence),
    ...datasetPairsToEvidence(datasetPairs, datasetFiles),
    ...fileExpertJobs.map(fileExpertJobToEvidence),
    ...readinessImports.map(readinessImportToEvidence),
  ].filter((item) => item.ecuFamily || item.ecuType);
  const evidence = rawEvidence.map((item) => ({
    ...item,
    mapDefinitionAvailable: item.mapDefinitionAvailable || hasMatchingMapDefinition(item, mapDefinitions),
  }));
  const report = buildDtcCorpusReadinessReport(evidence);
  return {
    report,
    warnings,
    sourceCounts: {
      training_samples: trainingSamples.length,
      dataset_pairs: datasetPairs.length,
      dataset_files: datasetFiles.length,
      file_expert_jobs: fileExpertJobs.length,
      map_definition_sets: mapDefinitions.length,
      readiness_import_records: readinessImports.length,
      evidence_items: evidence.length,
    },
  };
}

async function readRows<T>(
  query: PromiseLike<{ data: unknown[] | null; error: { code?: string; message?: string } | null }>,
  label: string,
  warnings: string[],
  options: { optional?: boolean } = {}
): Promise<T[]> {
  const result = await query;
  if (result.error) {
    if (tableMissing(result.error)) {
      if (!options.optional) warnings.push(`${label} unavailable: ${result.error.message}`);
      return [];
    }
    throw new Error(result.error.message);
  }
  return (result.data ?? []) as T[];
}

function trainingSampleToEvidence(sample: TrainingSampleRow): DtcCorpusEvidenceItem {
  const metadata = sample.source_metadata ?? {};
  const diff = sample.diff_json;
  const identity = diff?.ecu_identification;
  const dtcLabels = stringArray(metadata.exact_dtc_labels ?? metadata.dtc_codes ?? metadata.actual_dtc_codes);
  const regionSignature = regionSignatureFrom(diff?.pattern_signature ?? sample.pattern_signature);
  const serviceLabels = sample.performed_service_labels ?? sample.requested_service_labels;
  return {
    id: `training_sample:${sample.id}`,
    sourceKind: "training_sample",
    ecuSupplier: stringValue(metadata.ecu_supplier) || identity?.supplier || supplierFromText(sample.ecu_type, sample.ecu_family),
    ecuFamily: sample.ecu_family || identity?.family || null,
    ecuType: sample.ecu_type || identity?.display_name || null,
    hwNumber: sample.hw_number || identity?.hardware_numbers?.[0] || stringValue(metadata.hw_number),
    swNumber: sample.sw_number || identity?.software_numbers?.[0] || stringValue(metadata.sw_number),
    calibrationId: stringValue(metadata.calibration_id) || identity?.calibration_ids?.[0] || null,
    representationType: stringValue(metadata.representation_type) || diff?.files.ori?.read_scope || null,
    fileRole: "pair",
    fileSize: numeric(sample.ori_file_size),
    segmentManifestDigest: stringValue(metadata.segment_manifest_digest_sha256),
    readMethod: sample.read_method || diff?.metadata?.read_method || null,
    sourceProvenance: sample.source_type || sample.provider || null,
    sourceAuthorizationQuality: authorizationQuality(metadata, sample.source_type),
    originalHash: sample.ori_sha256,
    modHash: sample.mod_sha256,
    exactDtcLabels: dtcLabels,
    serviceLabels,
    humanVerified: sample.human_verification_status === "confirmed",
    learningApproved: sample.learning_use_status === "approved_for_learning",
    pairConfidence: numeric(sample.data_quality_score) || 70,
    pairReviewStatus: sample.learning_use_status === "approved_for_learning" ? "approved_for_learning" : sample.human_verification_status || null,
    pairIdentityConsistent: metadata.pair_identity_consistent !== false && diff?.integrity_assessment?.ecu_identity_match !== false,
    changedRegionSignature: regionSignature,
    changedRegionConsistency: bool(metadata.changed_region_inconsistent) ? "inconsistent" : regionSignature ? "consistent" : "unknown",
    unrelatedChange: bool(metadata.unrelated_change) || sample.change_type_classification === "broad_rework" || sample.change_type_classification === "structural_mismatch",
    checksumOnlyControl: bool(metadata.checksum_only_control),
    alreadyModifiedNegative: bool(metadata.already_modified_negative) || sample.outcome === "already_modified",
    wrongPairNegative: bool(metadata.wrong_pair_negative) || sample.outcome === "wrong_pair",
    preIntegrityAvailable: hasHash(metadata.pre_integrity_sha256),
    finalModAvailable: hasHash(metadata.final_sha256) || Boolean(sample.mod_sha256),
    mapDefinitionAvailable: bool(metadata.map_definition_available),
    integrityEvidenceAvailable: bool(metadata.integrity_evidence_available) || hasHash(metadata.pre_integrity_sha256) || hasHash(metadata.final_sha256),
    benchVerified: bool(metadata.bench_verified),
    successfulWriteReadback: bool(metadata.successful_write_readback),
    rollbackVerified: bool(metadata.rollback_verified),
    conflictNotes: stringArray(metadata.conflicts),
  };
}

function readinessImportToEvidence(row: ReadinessImportRow): DtcCorpusEvidenceItem {
  return {
    id: `readiness_import:${row.import_batch_id}:${row.record_id}`,
    sourceKind: row.source_kind === "manual_lab_import" ? "knowledge_profile" : row.source_kind || "knowledge_profile",
    ecuSupplier: row.ecu_supplier,
    ecuFamily: row.ecu_family,
    ecuType: row.ecu_type,
    hwNumber: row.hw_number,
    swNumber: row.sw_number,
    calibrationId: row.calibration_id,
    representationType: row.representation_type,
    fileRole: normalizeFileRole(row.file_role),
    fileSize: numeric(row.file_size),
    segmentManifestDigest: row.segment_manifest_digest,
    readMethod: row.read_method,
    sourceProvenance: row.source_provenance,
    sourceAuthorizationQuality: row.source_authorization_quality,
    originalHash: row.original_hash,
    modHash: row.mod_hash,
    exactDtcLabels: Array.isArray(row.exact_dtc_labels) ? row.exact_dtc_labels : [],
    serviceLabels: Array.isArray(row.service_labels) ? row.service_labels : [],
    humanVerified: row.human_verified === true,
    learningApproved: row.learning_approved === true,
    pairConfidence: numeric(row.pair_confidence),
    pairReviewStatus: row.pair_review_status,
    pairIdentityConsistent: row.pair_identity_consistent !== false,
    changedRegionSignature: row.changed_region_signature,
    changedRegionConsistency: row.changed_region_consistency,
    unrelatedChange: row.unrelated_change === true,
    checksumOnlyControl: row.checksum_only_control === true,
    alreadyModifiedNegative: row.already_modified_negative === true,
    wrongPairNegative: row.wrong_pair_negative === true,
    preIntegrityAvailable: row.pre_integrity_available === true,
    finalModAvailable: row.final_mod_available === true,
    mapDefinitionAvailable: row.map_definition_available === true,
    integrityEvidenceAvailable: row.integrity_evidence_available === true,
    benchVerified: row.bench_verified === true,
    successfulWriteReadback: row.successful_write_readback === true,
    rollbackVerified: row.rollback_verified === true,
    conflictNotes: Array.isArray(row.conflict_notes) ? row.conflict_notes : [],
  };
}

function datasetPairsToEvidence(pairs: DatasetPairRow[], files: DatasetFileRow[]): DtcCorpusEvidenceItem[] {
  const byId = new Map(files.map((file) => [file.id, file]));
  return pairs.map((pair) => {
    const ori = pair.ori_candidate_id ? byId.get(pair.ori_candidate_id) : null;
    const mod = pair.mod_candidate_id ? byId.get(pair.mod_candidate_id) : null;
    const metadata = { ...(ori?.provider_metadata ?? {}), ...(mod?.provider_metadata ?? {}) };
    const labels = pair.actual_service_labels?.length ? pair.actual_service_labels : pair.service_label_guess ?? mod?.service_label_guess ?? [];
    const dtcLabels = stringArray(metadata.exact_dtc_labels ?? metadata.dtc_codes ?? metadata.actual_dtc_codes);
    const changedRegionSignature = regionSignatureFrom(pair.changed_region_summary);
    return {
      id: `dataset_pair:${pair.id}`,
      sourceKind: "dataset_pair",
      ecuSupplier: stringValue(metadata.ecu_supplier) || supplierFromText(ori?.ecu_type_guess, ori?.ecu_family_guess),
      ecuFamily: ori?.ecu_family_guess || mod?.ecu_family_guess || stringValue(metadata.ecu_family),
      ecuType: ori?.ecu_type_guess || mod?.ecu_type_guess || stringValue(metadata.ecu_type),
      hwNumber: ori?.hw_number_guess || mod?.hw_number_guess || stringValue(metadata.hw_number),
      swNumber: ori?.sw_number_guess || mod?.sw_number_guess || stringValue(metadata.sw_number),
      calibrationId: stringValue(metadata.calibration_id),
      representationType: stringValue(metadata.representation_type),
      fileRole: normalizeFileRole(ori?.file_role_guess) === "ori" && normalizeFileRole(mod?.file_role_guess) === "mod" ? "pair" : "unknown",
      fileSize: numeric(ori?.file_size),
      segmentManifestDigest: stringValue(metadata.segment_manifest_digest_sha256),
      readMethod: stringValue(metadata.read_method),
      sourceProvenance: stringValue(metadata.source_provenance) || stringValue(metadata.provider_name) || "dataset_import",
      sourceAuthorizationQuality: authorizationQuality(metadata, "dataset_import"),
      originalHash: hashValue(ori?.fingerprint),
      modHash: hashValue(mod?.fingerprint),
      exactDtcLabels: dtcLabels,
      serviceLabels: labels,
      humanVerified: pair.review_status === "approved" || pair.review_status === "ready_for_human_label",
      learningApproved: false,
      pairConfidence: numeric(pair.pair_confidence),
      pairReviewStatus: pair.review_status,
      pairIdentityConsistent: pair.sw_hw_match !== false && ori?.validation_status !== "duplicate" && mod?.validation_status !== "duplicate",
      changedRegionSignature,
      changedRegionConsistency: bool(pair.changed_region_summary?.inconsistent) ? "inconsistent" : changedRegionSignature ? "consistent" : "unknown",
      unrelatedChange: bool(pair.changed_region_summary?.unrelated_change),
      checksumOnlyControl: bool(pair.changed_region_summary?.checksum_only_control),
      alreadyModifiedNegative: pair.learning_recommendation === "known_bad" || /already.modified/i.test(pair.admin_notes || ""),
      wrongPairNegative: /wrong.pair|bad_pair/i.test(pair.admin_notes || "") || pair.learning_recommendation === "reject_wrong_pair",
      preIntegrityAvailable: hasHash(pair.changed_region_summary?.pre_integrity_sha256),
      finalModAvailable: hasHash(pair.changed_region_summary?.final_sha256) || Boolean(mod?.fingerprint),
      mapDefinitionAvailable: bool(pair.map_attribution_summary?.map_definition_available),
      integrityEvidenceAvailable: bool(pair.changed_region_summary?.integrity_evidence_available) || hasHash(pair.changed_region_summary?.final_sha256),
      benchVerified: bool(pair.changed_region_summary?.bench_verified),
      successfulWriteReadback: bool(pair.changed_region_summary?.successful_write_readback),
      rollbackVerified: bool(pair.changed_region_summary?.rollback_verified),
      conflictNotes: [
        ...(Array.isArray(pair.quality_reasons) ? pair.quality_reasons : []),
        ...(ori?.warnings ?? []),
        ...(mod?.warnings ?? []),
      ].filter((note) => /conflict|wrong|mismatch|unrelated|already/i.test(note)),
    };
  });
}

function fileExpertJobToEvidence(job: FileExpertJobRow): DtcCorpusEvidenceItem {
  const result = job.result_json;
  const metadata = result?.metadata ?? {};
  const identity = result?.ecu_identification;
  return {
    id: `file_expert_job:${job.id}`,
    sourceKind: "file_expert_job",
    ecuSupplier: identity?.supplier || supplierFromText(job.ecu_type, job.ecu_family),
    ecuFamily: job.ecu_family || identity?.family || null,
    ecuType: job.ecu_type || identity?.display_name || metadata.ecu_type || null,
    hwNumber: job.hw_number || identity?.hardware_numbers?.[0] || null,
    swNumber: job.sw_number || identity?.software_numbers?.[0] || null,
    calibrationId: identity?.calibration_ids?.[0] || null,
    representationType: result?.files.ori?.read_scope || result?.files.single?.read_scope || null,
    fileRole: result?.mode === "single_file" ? "single" : "ori",
    fileSize: numeric(job.ori_file_size || result?.files.ori?.file_size || result?.files.single?.file_size),
    segmentManifestDigest: null,
    readMethod: job.read_method || metadata.read_method || null,
    sourceProvenance: "file_expert_job",
    sourceAuthorizationQuality: "weak",
    originalHash: job.ori_sha256 || result?.files.ori?.sha256 || result?.files.single?.sha256 || null,
    modHash: result?.files.mod?.sha256 || null,
    exactDtcLabels: [],
    serviceLabels: result?.possible_features?.filter((feature) => feature.feature === "dtc_off").map((feature) => feature.feature) ?? [],
    humanVerified: false,
    learningApproved: false,
    pairConfidence: numeric(job.confidence_score),
    pairReviewStatus: job.status === "completed" ? "needs_review" : job.status,
    pairIdentityConsistent: result?.integrity_assessment?.ecu_identity_match !== false,
    changedRegionSignature: regionSignatureFrom(result?.pattern_signature),
    changedRegionConsistency: "unknown",
    unrelatedChange: result?.change_profile?.classification === "broad_rework" || result?.change_profile?.classification === "structural_mismatch",
    checksumOnlyControl: false,
    alreadyModifiedNegative: result?.summary?.stock_or_modified === "likely_modified",
    wrongPairNegative: false,
    preIntegrityAvailable: false,
    finalModAvailable: Boolean(result?.files.mod?.sha256),
    mapDefinitionAvailable: false,
    integrityEvidenceAvailable: false,
    benchVerified: false,
    successfulWriteReadback: false,
    rollbackVerified: false,
    conflictNotes: result?.risk_assessment?.warnings?.filter((warning) => /conflict|wrong|mismatch|unrelated|already/i.test(warning)) ?? [],
  };
}

function hasMatchingMapDefinition(item: DtcCorpusEvidenceItem, maps: MapDefinitionSetRow[]) {
  return maps.some((map) =>
    map.active !== false &&
    (map.human_verified === true || map.verification_status === "confirmed") &&
    compatibleIdentity(map.ecu_family, item.ecuFamily) &&
    compatibleIdentity(map.ecu_type, item.ecuType) &&
    compatibleIdentity(map.sw_number, item.swNumber) &&
    compatibleIdentity(map.hw_number, item.hwNumber)
  );
}

function compatibleIdentity(mapValue: string | null | undefined, itemValue: string | null | undefined) {
  if (!mapValue) return true;
  return normalize(mapValue) === normalize(itemValue);
}

function tableMissing(error: { code?: string; message?: string } | null) {
  return error?.code === "42P01" ||
    error?.code === "42703" ||
    error?.code === "PGRST204" ||
    error?.message?.includes("schema cache");
}

function supplierFromText(...values: Array<string | null | undefined>) {
  return values.some((value) => /bosch/i.test(value || "")) ? "Bosch" : null;
}

function authorizationQuality(metadata: Record<string, unknown>, sourceType?: string | null) {
  if (metadata.authorized_lab === true) return "authorized_lab";
  if (metadata.source_authorized === true || metadata.trusted_source === true) return "trusted";
  if (sourceType === "completed_request" || sourceType === "file_expert") return "weak";
  return "unknown";
}

function regionSignatureFrom(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const regions = Array.isArray(record.main_regions)
    ? record.main_regions
    : Array.isArray(record.changed_regions)
      ? record.changed_regions
      : Array.isArray(record.regions)
        ? record.regions
        : [];
  const normalizedRegions = regions.map((region) => {
    if (!region || typeof region !== "object") return "";
    const row = region as Record<string, unknown>;
    return [
      row.start_offset_hex ?? row.start ?? row.offset_start ?? "",
      row.end_offset_hex ?? row.end ?? row.offset_end ?? "",
      row.length ?? row.length_bytes ?? "",
      row.changed_byte_count ?? "",
    ].join(":");
  }).filter(Boolean).sort();
  return normalizedRegions.length ? normalizedRegions.join("|") : null;
}

function normalizeFileRole(value: string | null | undefined) {
  if (value === "ori" || value === "mod") return value;
  if (value === "single") return "single";
  return "unknown";
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0) : [];
}

function bool(value: unknown) {
  return value === true;
}

function numeric(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasHash(value: unknown) {
  return typeof value === "string" && /^[0-9a-f]{64}$/i.test(value);
}

function hashValue(value: unknown) {
  return hasHash(value) ? String(value).toLowerCase() : null;
}

function normalize(value: unknown) {
  return typeof value === "string" ? value.toUpperCase().replace(/[^A-Z0-9+]/g, "") : "";
}

export function targetFamilyLabels() {
  return dtcCorpusReadinessTargets.map((target) => target.label);
}
