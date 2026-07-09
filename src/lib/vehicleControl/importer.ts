import vehicles from "../../../data/vehicle-database.json";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  normalizeToken,
  rawVehicleToControlRecord,
  stageGain,
} from "@/lib/vehicleControl/normalization";
import type { RawVehicleRow, VehicleControlRecord, VehicleImportSummary } from "@/lib/vehicleControl/types";
import { validateVehicleCollection } from "@/lib/vehicleControl/validation";

const rawRows = vehicles as RawVehicleRow[];

type ImportOptions = {
  dryRun: boolean;
  actorUserId?: string | null;
  limit?: number;
};

export function createVehicleImportPlan(limit?: number) {
  const rows = typeof limit === "number" && limit > 0 ? rawRows.slice(0, limit) : rawRows;
  const records = rows.map(rawVehicleToControlRecord);
  const issues = validateVehicleCollection(records);
  const duplicateKeys = new Set(
    [...records.reduce((map, record) => {
      map.set(record.vehicleKey, (map.get(record.vehicleKey) ?? 0) + 1);
      return map;
    }, new Map<string, number>()).entries()]
      .filter(([, count]) => count > 1)
      .map(([key]) => key)
  );
  return {
    rows,
    records,
    issues,
    duplicateKeys,
  };
}

export function dryRunVehicleImport(limit?: number): VehicleImportSummary {
  const plan = createVehicleImportPlan(limit);
  return {
    dryRun: true,
    totalRows: plan.records.length,
    created: 0,
    updated: 0,
    skipped: plan.duplicateKeys.size,
    errors: plan.issues.filter((issue) => issue.severity === "error").length,
    duplicates: plan.duplicateKeys.size,
    warnings: plan.issues.slice(0, 250),
    sampleRecords: plan.records.slice(0, 10),
    batchId: null,
  };
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

  if (
    existing.data &&
    existing.data.verification_status === "verified" &&
    existing.data.source_type !== "carecufile" &&
    existing.data.source_type !== "carecufile_import"
  ) {
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
  if (options.dryRun) return dryRunVehicleImport(options.limit);

  const plan = createVehicleImportPlan(options.limit);
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
  let skipped = 0;
  let errors = 0;

  for (let index = 0; index < plan.records.length; index += 1) {
    const record = plan.records[index];
    const raw = plan.rows[index];
    try {
      const brandId = await upsertBrand(record, options.actorUserId);
      const modelId = await upsertModel(record, brandId, options.actorUserId);
      const generationId = await upsertGeneration(record, modelId, options.actorUserId);
      const engine = await upsertEngine(record, generationId, options.actorUserId);
      if (engine.skipped) {
        skipped += 1;
        continue;
      }
      await syncChildren(record, raw, engine.id, options.actorUserId);
      if (engine.existing) updated += 1;
      else created += 1;
      await audit("vehicle_engine", engine.id, engine.existing ? "import.updated" : "import.created", options.actorUserId, engine.existing, { vehicleKey: record.vehicleKey }, { batchId });
    } catch (error) {
      errors += 1;
      await audit("vehicle_engine", null, "import.error", options.actorUserId, null, { vehicleKey: record.vehicleKey, error: error instanceof Error ? error.message : String(error) }, { batchId });
    }
  }

  const summary: VehicleImportSummary = {
    dryRun: false,
    totalRows: plan.records.length,
    created,
    updated,
    skipped,
    errors,
    duplicates: plan.duplicateKeys.size,
    warnings: plan.issues.slice(0, 250),
    sampleRecords: plan.records.slice(0, 10),
    batchId,
  };
  if (batchId) {
    await admin.from("vehicle_import_batches").update({
      status: errors > 0 ? "failed" : "completed",
      created_count: created,
      updated_count: updated,
      skipped_count: skipped,
      error_count: errors,
      duplicate_count: plan.duplicateKeys.size,
      warning_count: plan.issues.filter((issue) => issue.severity !== "error").length,
      summary_json: summary,
      finished_at: new Date().toISOString(),
    }).eq("id", batchId);
  }
  return summary;
}
