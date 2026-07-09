import vehicles from "../../../data/vehicle-database.json";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  normalizeToken,
  rawVehicleToControlRecord,
  stageGain,
} from "@/lib/vehicleControl/normalization";
import type {
  RawVehicleRow,
  VehicleControlRecord,
  VehicleImportSummary,
  VehicleValidationIssue,
} from "@/lib/vehicleControl/types";
import { validateVehicleCollection } from "@/lib/vehicleControl/validation";

const rawRows = vehicles as RawVehicleRow[];
const careImportSourceTypes = new Set(["carecufile", "carecufile_import"]);

type ImportOptions = {
  dryRun: boolean;
  actorUserId?: string | null;
  limit?: number;
};

type ExistingProtectedRow = {
  id: string;
  source_type: string | null;
  verification_status: string | null;
};

type ExistingVehicleEngine = ExistingProtectedRow & {
  vehicle_key: string;
};

export function createVehicleImportPlan(limit?: number) {
  const rows = typeof limit === "number" && limit > 0 ? rawRows.slice(0, limit) : rawRows;
  const records = rows.map(rawVehicleToControlRecord);
  const issues = validateVehicleCollection(records);
  const recordsByKey = groupRecordsByKey(records);
  const duplicateKeys = new Set([...recordsByKey.entries()].filter(([, group]) => group.length > 1).map(([key]) => key));
  return {
    rows,
    records,
    issues,
    duplicateKeys,
    recordsByKey,
  };
}

function groupRecordsByKey(records: VehicleControlRecord[]) {
  const map = new Map<string, VehicleControlRecord[]>();
  for (const record of records) {
    if (!map.has(record.vehicleKey)) map.set(record.vehicleKey, []);
    map.get(record.vehicleKey)?.push(record);
  }
  return map;
}

function groupIssuesByKey(issues: VehicleValidationIssue[]) {
  const map = new Map<string, VehicleValidationIssue[]>();
  for (const issue of issues) {
    if (!issue.vehicleKey) continue;
    if (!map.has(issue.vehicleKey)) map.set(issue.vehicleKey, []);
    map.get(issue.vehicleKey)?.push(issue);
  }
  return map;
}

function blockingInvalidKeys(issues: VehicleValidationIssue[]) {
  return new Set(issues.filter((issue) => issue.severity === "error" && issue.vehicleKey).map((issue) => issue.vehicleKey as string));
}

function isProtectedManualVerified(row: ExistingProtectedRow | null | undefined) {
  return Boolean(row?.verification_status === "verified" && !careImportSourceTypes.has(row.source_type ?? ""));
}

function recordPreview(record: VehicleControlRecord) {
  return {
    brand: record.brand,
    model: record.model,
    generation: record.generation,
    engine: record.engine,
    ecuType: record.ecuType,
    stockHp: record.stockHp,
    stockNm: record.stockNm,
    tunedHp: record.tunedHp,
    tunedNm: record.tunedNm,
    services: record.services,
  };
}

function importCandidateRecord(record: VehicleControlRecord, issues: VehicleValidationIssue[]) {
  const needsReview = issues.some((issue) => issue.severity === "warning");
  if (!needsReview) return record;
  return {
    ...record,
    verificationStatus: "needs_review" as const,
    confidenceScore: Math.max(40, Math.min(record.confidenceScore, record.ecuType ? 60 : 45)),
  };
}

export function getValidImportCandidates(plan: ReturnType<typeof createVehicleImportPlan>) {
  const issueMap = groupIssuesByKey(plan.issues);
  const invalidKeys = blockingInvalidKeys(plan.issues);
  return plan.records
    .filter((record) => !plan.duplicateKeys.has(record.vehicleKey))
    .filter((record) => !invalidKeys.has(record.vehicleKey))
    .map((record) => importCandidateRecord(record, issueMap.get(record.vehicleKey) ?? []));
}

export function buildVehicleImportSummary(
  plan: ReturnType<typeof createVehicleImportPlan>,
  existingRows: ExistingVehicleEngine[] = [],
  options: {
    dryRun: boolean;
    dbDiffCalculated?: boolean;
    batchId?: string | null;
    created?: number;
    updated?: number;
    runtimeErrors?: number;
  } = { dryRun: true }
): VehicleImportSummary {
  const issueMap = groupIssuesByKey(plan.issues);
  const invalidKeys = blockingInvalidKeys(plan.issues);
  const duplicateRowCount = [...plan.duplicateKeys].reduce((total, key) => total + (plan.recordsByKey.get(key)?.length ?? 0), 0);
  const duplicateExtraRows = [...plan.duplicateKeys].reduce((total, key) => total + Math.max(0, (plan.recordsByKey.get(key)?.length ?? 0) - 1), 0);
  const invalidRecords = plan.records.filter((record) => !plan.duplicateKeys.has(record.vehicleKey) && invalidKeys.has(record.vehicleKey));
  const validCandidates = getValidImportCandidates(plan);
  const existingByKey = new Map(existingRows.map((row) => [row.vehicle_key, row]));
  const protectedManualVerified = validCandidates.filter((record) => isProtectedManualVerified(existingByKey.get(record.vehicleKey)));
  const wouldCreate = validCandidates.filter((record) => !existingByKey.has(record.vehicleKey)).length;
  const wouldUpdate = validCandidates.filter((record) => existingByKey.has(record.vehicleKey) && !isProtectedManualVerified(existingByKey.get(record.vehicleKey))).length;
  const warningKeys = new Set(
    plan.issues
      .filter((issue) => issue.severity === "warning" && issue.vehicleKey && !plan.duplicateKeys.has(issue.vehicleKey) && !invalidKeys.has(issue.vehicleKey))
      .map((issue) => issue.vehicleKey as string)
  );
  const skippedBase = duplicateRowCount + invalidRecords.length + protectedManualVerified.length;
  const warningOrErrorIssues = plan.issues.filter((issue) => issue.severity !== "info");

  const duplicateExamples = [...plan.duplicateKeys].slice(0, 10).map((key) => ({
    vehicleKey: key,
    count: plan.recordsByKey.get(key)?.length ?? 0,
    records: (plan.recordsByKey.get(key) ?? []).slice(0, 3).map(recordPreview),
  }));
  const invalidExamples = invalidRecords.slice(0, 10).map((record) => {
    const issues = (issueMap.get(record.vehicleKey) ?? []).filter((issue) => issue.severity === "error");
    return {
      vehicleKey: record.vehicleKey,
      reason: issues[0]?.message ?? "Blocking validation error.",
      issueCodes: issues.map((issue) => issue.code),
      record: recordPreview(record),
    };
  });
  const warningExamples = [...warningKeys].slice(0, 10).map((key) => {
    const issues = (issueMap.get(key) ?? []).filter((issue) => issue.severity === "warning");
    return {
      vehicleKey: key,
      reason: issues[0]?.message ?? "Needs review warning.",
      issueCodes: issues.map((issue) => issue.code),
      record: recordPreview((plan.recordsByKey.get(key) ?? [])[0]),
    };
  });

  return {
    dryRun: options.dryRun,
    mode: "valid_only",
    totalRows: plan.records.length,
    created: options.dryRun ? wouldCreate : options.created ?? 0,
    updated: options.dryRun ? wouldUpdate : options.updated ?? 0,
    skipped: skippedBase,
    errors: plan.issues.filter((issue) => issue.severity === "error").length + (options.runtimeErrors ?? 0),
    duplicates: plan.duplicateKeys.size,
    duplicateExtraRows,
    skippedDuplicate: duplicateRowCount,
    skippedInvalid: invalidRecords.length,
    validImportableCount: validCandidates.length,
    needsReviewCount: warningKeys.size,
    protectedManualVerifiedCount: protectedManualVerified.length,
    warningCount: plan.issues.filter((issue) => issue.severity === "warning").length,
    infoCount: plan.issues.filter((issue) => issue.severity === "info").length,
    dbDiffCalculated: Boolean(options.dbDiffCalculated),
    warnings: warningOrErrorIssues.slice(0, 250),
    examples: {
      duplicates: duplicateExamples,
      invalid: invalidExamples,
      warnings: warningExamples,
      protectedManualVerified: protectedManualVerified.slice(0, 10).map((record) => ({
        vehicleKey: record.vehicleKey,
        reason: "Existing verified manual record is protected from CareEcuFile import overwrite.",
      })),
    },
    sampleRecords: validCandidates.slice(0, 10),
    batchId: options.batchId ?? null,
  };
}

export function dryRunVehicleImport(limit?: number): VehicleImportSummary {
  const plan = createVehicleImportPlan(limit);
  return buildVehicleImportSummary(plan, [], { dryRun: true, dbDiffCalculated: false });
}

async function audit(entityType: string, entityId: string | null, action: string, actorUserId: string | null | undefined, oldValue: unknown, newValue: unknown, metadata: Record<string, unknown> = {}) {
  const admin = getSupabaseAdmin();
  await admin.from("vehicle_change_audit_log").insert({
    actor_user_id: actorUserId ?? null,
    entity_type: entityType,
    entity_id: entityId,
    action,
    old_value: oldValue ?? null,
    new_value: newValue ?? null,
    metadata,
  });
}

async function upsertBrand(record: VehicleControlRecord, actorUserId?: string | null) {
  const admin = getSupabaseAdmin();
  const slug = normalizeToken(record.brand);
  const existing = await admin.from("vehicle_brands").select("id, verification_status, source_type").eq("slug", slug).maybeSingle();
  if (isProtectedManualVerified(existing.data as ExistingProtectedRow | null)) return existing.data?.id as string;
  const { data, error } = await admin.from("vehicle_brands").upsert({
    name: record.brand,
    slug,
    external_id: record.brandId,
    active: true,
    published: true,
    source_type: record.sourceType,
    source_reference: record.brandId,
    confidence_score: record.confidenceScore,
    verification_status: record.verificationStatus,
    updated_by: actorUserId ?? null,
  }, { onConflict: "slug" }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

async function upsertModel(record: VehicleControlRecord, brandId: string, actorUserId?: string | null) {
  const admin = getSupabaseAdmin();
  const slug = normalizeToken(record.model);
  const existing = await admin.from("vehicle_models").select("id, verification_status, source_type").eq("brand_id", brandId).eq("slug", slug).maybeSingle();
  if (isProtectedManualVerified(existing.data as ExistingProtectedRow | null)) return existing.data?.id as string;
  const { data, error } = await admin.from("vehicle_models").upsert({
    brand_id: brandId,
    name: record.model,
    slug,
    external_id: record.modelId,
    active: true,
    published: true,
    source_type: record.sourceType,
    source_reference: record.modelId,
    confidence_score: record.confidenceScore,
    verification_status: record.verificationStatus,
    updated_by: actorUserId ?? null,
  }, { onConflict: "brand_id,slug" }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

async function upsertGeneration(record: VehicleControlRecord, modelId: string, actorUserId?: string | null) {
  const admin = getSupabaseAdmin();
  const slug = normalizeToken(record.generation);
  const existing = await admin.from("vehicle_generations").select("id, verification_status, source_type").eq("model_id", modelId).eq("slug", slug).maybeSingle();
  if (isProtectedManualVerified(existing.data as ExistingProtectedRow | null)) return existing.data?.id as string;
  const { data, error } = await admin.from("vehicle_generations").upsert({
    model_id: modelId,
    name: record.generation,
    slug,
    external_id: record.generationId,
    year_from: record.yearFrom,
    year_to: record.yearTo,
    facelift_label: record.faceliftLabel,
    is_lci: record.isLci,
    active: true,
    published: true,
    source_type: record.sourceType,
    source_reference: record.generationId,
    confidence_score: record.confidenceScore,
    verification_status: record.verificationStatus,
    updated_by: actorUserId ?? null,
  }, { onConflict: "model_id,slug" }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

async function upsertEngine(record: VehicleControlRecord, generationId: string, actorUserId?: string | null) {
  const admin = getSupabaseAdmin();
  const existing = await admin
    .from("vehicle_engines")
    .select("*")
    .eq("vehicle_key", record.vehicleKey)
    .maybeSingle();

  if (isProtectedManualVerified(existing.data as ExistingProtectedRow | null)) {
    return { id: existing.data.id as string, skipped: true, existing: existing.data };
  }

  const payload = {
    generation_id: generationId,
    vehicle_key: record.vehicleKey,
    engine_name: record.engine,
    display_name: record.displayName,
    external_id: record.engineId,
    fuel_type: record.fuelType,
    displacement_cc: record.displacementCc,
    stock_hp: record.stockHp,
    stock_nm: record.stockNm,
    year_from: record.yearFrom,
    year_to: record.yearTo,
    customer_safe_notes: record.customerSafeNotes,
    admin_technical_notes: record.adminTechnicalNotes,
    active: record.active,
    published: record.published,
    source_type: record.sourceType,
    source_reference: record.sourceReference,
    confidence_score: record.confidenceScore,
    verification_status: record.verificationStatus,
    updated_by: actorUserId ?? null,
  };
  const { data, error } = await admin
    .from("vehicle_engines")
    .upsert(payload, { onConflict: "vehicle_key" })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id as string, skipped: false, existing: existing.data };
}

async function getExistingVehicleEngines(vehicleKeys: string[]) {
  const admin = getSupabaseAdmin();
  const rows: ExistingVehicleEngine[] = [];
  const uniqueKeys = [...new Set(vehicleKeys)].filter(Boolean);
  const chunkSize = 75;
  for (let index = 0; index < uniqueKeys.length; index += chunkSize) {
    const chunk = uniqueKeys.slice(index, index + chunkSize);
    const { data, error } = await admin
      .from("vehicle_engines")
      .select("id, vehicle_key, source_type, verification_status")
      .in("vehicle_key", chunk);
    if (error) throw error;
    rows.push(...(data as ExistingVehicleEngine[] | null ?? []));
  }
  return rows;
}

async function syncChildren(record: VehicleControlRecord, raw: RawVehicleRow, engineId: string, actorUserId?: string | null) {
  const admin = getSupabaseAdmin();
  if (record.ecuType || record.ecuFamily) {
    const existing = await admin
      .from("vehicle_ecu_variants")
      .select("id")
      .eq("engine_id", engineId)
      .eq("ecu_type", record.ecuType)
      .limit(1)
      .maybeSingle();
    if (!existing.data) {
      await admin.from("vehicle_ecu_variants").insert({
        engine_id: engineId,
        ecu_family: record.ecuFamily,
        ecu_type: record.ecuType,
        ecu_hardware: record.ecuHardware,
        ecu_software: record.ecuSoftware,
        ecu_notes: record.ecuNotes,
        protection_notes: record.protectionNotes,
        unlock_notes: record.unlockNotes,
        gearbox_type: record.gearboxType,
        tcu_type: record.tcuType,
        tcu_notes: record.tcuNotes,
        source_type: record.sourceType,
        source_reference: record.sourceReference,
        confidence_score: record.confidenceScore,
        verification_status: record.verificationStatus,
        created_by: actorUserId ?? null,
        updated_by: actorUserId ?? null,
      });
    }
  }

  for (const service of record.services) {
    await admin.from("vehicle_service_capabilities").upsert({
      engine_id: engineId,
      service_key: service,
      available: true,
      source_type: record.sourceType,
      confidence_score: record.confidenceScore,
      verification_status: record.verificationStatus,
      updated_by: actorUserId ?? null,
    }, { onConflict: "engine_id,service_key" });
  }

  for (const [stage, data] of [["stage1", stageGain(raw.stage1)], ["stage2", stageGain(raw.stage2)]] as const) {
    if (!data) continue;
    await admin.from("vehicle_performance_profiles").upsert({
      engine_id: engineId,
      stage,
      stock_hp: data.stockHp,
      stock_nm: data.stockNm,
      tuned_hp: data.tunedHp,
      tuned_nm: data.tunedNm,
      gain_hp: data.gainHp,
      gain_nm: data.gainNm,
      source_type: record.sourceType,
      confidence_score: record.confidenceScore,
      verification_status: record.verificationStatus,
      updated_by: actorUserId ?? null,
    }, { onConflict: "engine_id,stage" });
  }
}

export async function runVehicleImport(options: ImportOptions): Promise<VehicleImportSummary> {
  const plan = createVehicleImportPlan(options.limit);
  const candidates = getValidImportCandidates(plan);

  if (options.dryRun) {
    try {
      const existingRows = await getExistingVehicleEngines(candidates.map((record) => record.vehicleKey));
      return buildVehicleImportSummary(plan, existingRows, { dryRun: true, dbDiffCalculated: true });
    } catch {
      return buildVehicleImportSummary(plan, [], { dryRun: true, dbDiffCalculated: false });
    }
  }

  const admin = getSupabaseAdmin();
  const source = await admin.from("vehicle_data_sources").upsert({
    source_type: "carecufile_import",
    source_name: "CareEcuFile raw import",
    source_reference: "data/vehicle-database.json",
    trust_level: "imported",
    active: true,
  }, { onConflict: "source_name" }).select("id").single();

  const batch = await admin.from("vehicle_import_batches").insert({
    source_id: source.data?.id ?? null,
    source_type: "carecufile_import",
    mode: "import",
    dry_run: false,
    requested_by: options.actorUserId ?? null,
    total_rows: plan.records.length,
  }).select("id").single();
  const batchId = batch.data?.id ?? null;

  let created = 0;
  let updated = 0;
  let protectedSkipped = 0;
  let runtimeErrors = 0;
  const rawByKey = new Map(plan.records.map((record, index) => [record.vehicleKey, plan.rows[index]]));

  for (const record of candidates) {
    const raw = rawByKey.get(record.vehicleKey);
    if (!raw) {
      runtimeErrors += 1;
      continue;
    }
    try {
      const brandId = await upsertBrand(record, options.actorUserId);
      const modelId = await upsertModel(record, brandId, options.actorUserId);
      const generationId = await upsertGeneration(record, modelId, options.actorUserId);
      const engine = await upsertEngine(record, generationId, options.actorUserId);
      if (engine.skipped) {
        protectedSkipped += 1;
        continue;
      }
      await syncChildren(record, raw, engine.id, options.actorUserId);
      if (engine.existing) updated += 1;
      else created += 1;
      await audit("vehicle_engine", engine.id, engine.existing ? "import.updated" : "import.created", options.actorUserId, engine.existing, { vehicleKey: record.vehicleKey }, { batchId });
    } catch (error) {
      runtimeErrors += 1;
      await audit("vehicle_engine", null, "import.error", options.actorUserId, null, { vehicleKey: record.vehicleKey, error: error instanceof Error ? error.message : String(error) }, { batchId });
    }
  }

  const existingRows = await getExistingVehicleEngines(candidates.map((record) => record.vehicleKey));
  const summary = buildVehicleImportSummary(plan, existingRows, { dryRun: false, dbDiffCalculated: true, batchId, created, updated, runtimeErrors });
  summary.protectedManualVerifiedCount = Math.max(summary.protectedManualVerifiedCount ?? 0, protectedSkipped);
  summary.skipped = (summary.skippedDuplicate ?? 0) + (summary.skippedInvalid ?? 0) + (summary.protectedManualVerifiedCount ?? 0);

  if (batchId) {
    await admin.from("vehicle_import_batches").update({
      status: runtimeErrors > 0 ? "failed" : "completed",
      created_count: created,
      updated_count: updated,
      skipped_count: summary.skipped,
      error_count: runtimeErrors,
      duplicate_count: plan.duplicateKeys.size,
      warning_count: plan.issues.filter((issue) => issue.severity !== "error").length,
      summary_json: summary,
      finished_at: new Date().toISOString(),
    }).eq("id", batchId);
  }
  return summary;
}
