import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  VehicleAdminListQuery,
  VehicleAdminListRecord,
  VehicleAdminListResponse,
  VehicleControlRecord,
  VehicleServiceKey,
  VehicleValidationIssue,
  VerificationStatus,
} from "@/lib/vehicleControl/types";
import { buildVehicleKey, canonicalizeVehicleModel, inferEcuFamily, normalizeToken } from "@/lib/vehicleControl/normalization";
import { normalizeBrandName, normalizeGenerationName } from "@/lib/vehicleNormalization";
import { validateVehicleRecord } from "@/lib/vehicleControl/validation";
import {
  buildVehicleAdminSearchPattern,
  buildVehicleAdminPagination,
  getVehicleAdminPageRange,
} from "@/lib/vehicleControl/schema";

export type VehicleAdminUpdate = {
  brand: string;
  model: string;
  generation: string;
  engine: string;
  displayName?: string | null;
  yearFrom?: number | null;
  yearTo?: number | null;
  fuelType?: string | null;
  displacementCc?: number | null;
  stockHp?: number | null;
  stockNm?: number | null;
  tunedHp?: number | null;
  tunedNm?: number | null;
  ecuFamily?: string | null;
  ecuType?: string | null;
  ecuHardware?: string | null;
  ecuSoftware?: string | null;
  ecuNotes?: string | null;
  protectionNotes?: string | null;
  unlockNotes?: string | null;
  gearboxType?: string | null;
  tcuType?: string | null;
  tcuNotes?: string | null;
  services?: VehicleServiceKey[];
  customerSafeNotes?: string | null;
  adminTechnicalNotes?: string | null;
  sourceType?: string;
  sourceReference?: string | null;
  confidenceScore?: number;
  verificationStatus?: VerificationStatus;
  published?: boolean;
  active?: boolean;
};

type AdminDbEngine = {
  id: string;
  vehicle_key: string;
  engine_name: string;
  display_name: string | null;
  external_id: string | null;
  fuel_type: string | null;
  displacement_cc: number | null;
  stock_hp: number | null;
  stock_nm: number | null;
  year_from: number | null;
  year_to: number | null;
  customer_safe_notes: string | null;
  admin_technical_notes: string | null;
  active: boolean;
  published: boolean;
  source_type: string;
  source_reference: string | null;
  confidence_score: number;
  verification_status: VerificationStatus;
  created_at: string | null;
  updated_at: string | null;
  generation: null | {
    id: string;
    name: string;
    external_id: string | null;
    year_from: number | null;
    year_to: number | null;
    facelift_label: string | null;
    is_lci: boolean;
    model: null | {
      id: string;
      name: string;
      external_id: string | null;
      brand: null | {
        id: string;
        name: string;
        external_id: string | null;
      };
    };
  };
  ecu_variants?: Array<{
    id: string;
    ecu_family: string | null;
    ecu_type: string | null;
    ecu_hardware: string | null;
    ecu_software: string | null;
    ecu_notes: string | null;
    protection_notes: string | null;
    unlock_notes: string | null;
    gearbox_type: string | null;
    tcu_type: string | null;
    tcu_notes: string | null;
  }>;
  service_capabilities?: Array<{
    service_key: VehicleServiceKey;
    available: boolean;
  }>;
  performance_profiles?: Array<{
    stage: string;
    tuned_hp: number | null;
    tuned_nm: number | null;
    gain_hp: number | null;
    gain_nm: number | null;
    stock_hp: number | null;
    stock_nm: number | null;
  }>;
};

type AdminListDbEngine = {
  id: string;
  vehicle_key: string;
  engine_name: string;
  year_from: number | null;
  year_to: number | null;
  active: boolean;
  published: boolean;
  confidence_score: number;
  verification_status: VerificationStatus;
  generation: null | {
    name: string;
    year_from: number | null;
    year_to: number | null;
    model: null | {
      name: string;
      brand: null | { name: string };
    };
  };
  ecu_variants?: Array<{
    ecu_family: string | null;
    ecu_type: string | null;
  }>;
  service_capabilities?: Array<{
    service_key: VehicleServiceKey;
    available: boolean;
  }>;
};

const engineSelect = `
  id, vehicle_key, engine_name, display_name, external_id, fuel_type, displacement_cc, stock_hp, stock_nm, year_from, year_to,
  customer_safe_notes, admin_technical_notes, active, published, source_type, source_reference, confidence_score, verification_status, created_at, updated_at,
  generation:vehicle_generations(id, name, external_id, year_from, year_to, facelift_label, is_lci,
    model:vehicle_models(id, name, external_id,
      brand:vehicle_brands(id, name, external_id)
    )
  ),
  ecu_variants:vehicle_ecu_variants(id, ecu_family, ecu_type, ecu_hardware, ecu_software, ecu_notes, protection_notes, unlock_notes, gearbox_type, tcu_type, tcu_notes),
  service_capabilities:vehicle_service_capabilities(service_key, available),
  performance_profiles:vehicle_performance_profiles(stage, stock_hp, stock_nm, tuned_hp, tuned_nm, gain_hp, gain_nm)
`;

const listEngineSelect = `
  id, vehicle_key, engine_name, year_from, year_to, active, published, confidence_score, verification_status,
  generation:vehicle_generations!inner(name, year_from, year_to,
    model:vehicle_models!inner(name,
      brand:vehicle_brands!inner(name)
    )
  ),
  ecu_variants:vehicle_ecu_variants(ecu_family, ecu_type),
  service_capabilities:vehicle_service_capabilities(service_key, available)
`;

function getVehicleAdminListSelect(input: VehicleAdminListQuery) {
  return input.ecuFamily
    ? listEngineSelect.replace("ecu_variants:vehicle_ecu_variants(", "ecu_variants:vehicle_ecu_variants!inner(")
    : listEngineSelect;
}

function adminListDbEngineToRecord(row: AdminListDbEngine): VehicleAdminListRecord {
  const generation = row.generation;
  const model = generation?.model;
  const brand = model?.brand;
  const ecu = row.ecu_variants?.[0];
  return {
    id: row.id,
    brand: brand?.name ?? "Unknown brand",
    model: model?.name ?? "Unknown model",
    generation: generation?.name ?? "Unknown generation",
    engine: row.engine_name,
    vehicleKey: row.vehicle_key,
    yearFrom: row.year_from ?? generation?.year_from ?? null,
    yearTo: row.year_to ?? generation?.year_to ?? null,
    ecuFamily: ecu?.ecu_family ?? inferEcuFamily(ecu?.ecu_type),
    ecuType: ecu?.ecu_type ?? null,
    services: (row.service_capabilities ?? []).filter((item) => item.available).map((item) => item.service_key),
    confidenceScore: Number(row.confidence_score ?? 0),
    verificationStatus: row.verification_status,
    publishStatus: !row.active ? "archived" : row.published ? "published" : "draft",
  };
}

export function adminDbEngineToRecord(row: AdminDbEngine): VehicleControlRecord {
  const generation = row.generation;
  const model = generation?.model;
  const brand = model?.brand;
  const ecu = row.ecu_variants?.[0];
  const stage1 = row.performance_profiles?.find((profile) => profile.stage === "stage1");
  return {
    id: row.id,
    brand: brand?.name ?? "Unknown brand",
    brandId: brand?.external_id ?? brand?.id ?? null,
    model: model?.name ?? "Unknown model",
    modelId: model?.external_id ?? model?.id ?? null,
    generation: generation?.name ?? "Unknown generation",
    generationId: generation?.external_id ?? generation?.id ?? null,
    engine: row.engine_name,
    engineId: row.external_id,
    vehicleKey: row.vehicle_key,
    displayName: row.display_name ?? `${brand?.name ?? ""} ${model?.name ?? ""} ${generation?.name ?? ""} ${row.engine_name}`.replace(/\s+/g, " ").trim(),
    yearFrom: row.year_from ?? generation?.year_from ?? null,
    yearTo: row.year_to ?? generation?.year_to ?? null,
    faceliftLabel: generation?.facelift_label ?? null,
    isLci: generation?.is_lci ?? false,
    fuelType: row.fuel_type,
    displacementCc: row.displacement_cc,
    stockHp: row.stock_hp ?? stage1?.stock_hp ?? null,
    stockNm: row.stock_nm ?? stage1?.stock_nm ?? null,
    tunedHp: stage1?.tuned_hp ?? null,
    tunedNm: stage1?.tuned_nm ?? null,
    ecuFamily: ecu?.ecu_family ?? inferEcuFamily(ecu?.ecu_type),
    ecuType: ecu?.ecu_type ?? null,
    ecuHardware: ecu?.ecu_hardware ?? null,
    ecuSoftware: ecu?.ecu_software ?? null,
    ecuNotes: ecu?.ecu_notes ?? null,
    protectionNotes: ecu?.protection_notes ?? null,
    unlockNotes: ecu?.unlock_notes ?? null,
    gearboxType: ecu?.gearbox_type ?? null,
    tcuType: ecu?.tcu_type ?? null,
    tcuNotes: ecu?.tcu_notes ?? null,
    services: (row.service_capabilities ?? []).filter((item) => item.available).map((item) => item.service_key),
    readMethods: [],
    customerSafeNotes: row.customer_safe_notes,
    adminTechnicalNotes: row.admin_technical_notes,
    sourceType: row.source_type,
    sourceReference: row.source_reference,
    sourceUrl: null,
    confidenceScore: Number(row.confidence_score ?? 0),
    verificationStatus: row.verification_status,
    publishStatus: !row.active ? "archived" : row.published ? "published" : "draft",
    active: row.active,
    published: row.published,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function count(table: string, filters: Array<[string, unknown]> = []) {
  const admin = getSupabaseAdmin();
  let query = admin.from(table).select("id", { count: "exact", head: true });
  for (const [column, value] of filters) query = query.eq(column, value);
  const { count: value, error } = await query;
  if (error) throw error;
  return value ?? 0;
}

export async function getVehicleAdminRecordPage(input: VehicleAdminListQuery): Promise<VehicleAdminListResponse> {
  const admin = getSupabaseAdmin();
  const { from, to } = getVehicleAdminPageRange(input);
  let query = admin
    .from("vehicle_engines")
    .select(getVehicleAdminListSelect(input), { count: "exact" });

  if (input.publishStatus === "published") query = query.eq("active", true).eq("published", true);
  if (input.publishStatus === "draft") query = query.eq("active", true).eq("published", false);
  if (input.publishStatus === "archived") query = query.eq("active", false);
  if (input.verificationStatus !== "all") query = query.eq("verification_status", input.verificationStatus);

  const brandPattern = buildVehicleAdminSearchPattern(input.brand);
  const modelPattern = buildVehicleAdminSearchPattern(input.model);
  const generationPattern = buildVehicleAdminSearchPattern(input.generation);
  const ecuFamilyPattern = buildVehicleAdminSearchPattern(input.ecuFamily);
  if (brandPattern) query = query.ilike("generation.model.brand.name", `%${brandPattern}%`);
  if (modelPattern) query = query.ilike("generation.model.name", `%${modelPattern}%`);
  if (generationPattern) query = query.ilike("generation.name", `%${generationPattern}%`);
  if (ecuFamilyPattern) query = query.ilike("ecu_variants.ecu_family", `%${ecuFamilyPattern}%`);

  const searchPattern = buildVehicleAdminSearchPattern(input.q);
  if (searchPattern) {
    query = query.or([
      `vehicle_key.ilike.%${searchPattern}%`,
      `display_name.ilike.%${searchPattern}%`,
      `engine_name.ilike.%${searchPattern}%`,
      `external_id.ilike.%${searchPattern}%`,
      `fuel_type.ilike.%${searchPattern}%`,
      `source_reference.ilike.%${searchPattern}%`,
    ].join(","));
  }

  const result = await query
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .range(from, to);
  if (result.error) throw result.error;

  return {
    records: ((result.data as unknown as AdminListDbEngine[] | null) ?? []).map(adminListDbEngineToRecord),
    pagination: buildVehicleAdminPagination(input, result.count),
    query: input,
  };
}

export async function getAllVehicleAdminRecords() {
  const admin = getSupabaseAdmin();
  const pageSize = 1000;
  const records: VehicleControlRecord[] = [];

  for (let from = 0; ; from += pageSize) {
    const result = await admin
      .from("vehicle_engines")
      .select(engineSelect)
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (result.error) throw result.error;
    const rows = ((result.data as unknown as AdminDbEngine[] | null) ?? []);
    records.push(...rows.map(adminDbEngineToRecord));
    if (rows.length < pageSize) break;
  }

  return records;
}

export async function getVehicleAdminLegacyRecords() {
  const admin = getSupabaseAdmin();
  const result = await admin
    .from("vehicle_engines")
    .select(engineSelect)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .limit(150);
  if (result.error) throw result.error;
  return (((result.data as unknown as AdminDbEngine[] | null) ?? []).map(adminDbEngineToRecord));
}

export async function getVehicleAdminOverview() {
  const admin = getSupabaseAdmin();
  const [
    brandCount,
    modelCount,
    generationCount,
    engineCount,
    ecuVariantCount,
    publishedCount,
    draftCount,
    archivedCount,
    verifiedCount,
    needsReviewCount,
    validationCount,
    duplicates,
    audit,
    batches,
  ] = await Promise.all([
    count("vehicle_brands"),
    count("vehicle_models"),
    count("vehicle_generations"),
    count("vehicle_engines"),
    count("vehicle_ecu_variants"),
    count("vehicle_engines", [["published", true], ["active", true]]),
    count("vehicle_engines", [["published", false], ["active", true]]),
    count("vehicle_engines", [["active", false]]),
    count("vehicle_engines", [["verification_status", "verified"]]),
    count("vehicle_engines", [["verification_status", "needs_review"]]),
    count("vehicle_validation_results", [["status", "open"]]),
    admin.from("vehicle_engines").select("vehicle_key").limit(10000),
    admin.from("vehicle_change_audit_log").select("*").order("created_at", { ascending: false }).limit(50),
    admin.from("vehicle_import_batches").select("*").order("created_at", { ascending: false }).limit(10),
  ]);
  if (duplicates.error) throw duplicates.error;
  if (audit.error) throw audit.error;
  if (batches.error) throw batches.error;
  const duplicateWarningCount = (() => {
    const map = new Map<string, number>();
    for (const row of duplicates.data ?? []) map.set(row.vehicle_key, (map.get(row.vehicle_key) ?? 0) + 1);
    return [...map.values()].filter((value) => value > 1).length;
  })();
  const scoreBase = engineCount ? Math.round((publishedCount / Math.max(1, engineCount)) * 70 + Math.max(0, 30 - validationCount)) : 0;
  return {
    stats: {
      brandCount,
      modelCount,
      generationCount,
      engineCount,
      ecuVariantCount,
      publishedCount,
      draftCount,
      archivedCount,
      verifiedCount,
      needsReviewCount,
      validationWarningCount: validationCount,
      duplicateWarningCount,
      duplicateScanRowCount: duplicates.data?.length ?? 0,
      dataHealthScore: Math.max(0, Math.min(100, scoreBase)),
    },
    recentAudit: audit.data ?? [],
    importBatches: batches.data ?? [],
  };
}

export async function getVehicleAdminDetail(id: string) {
  const admin = getSupabaseAdmin();
  const [engine, audit, validations] = await Promise.all([
    admin.from("vehicle_engines").select(engineSelect).eq("id", id).single(),
    admin.from("vehicle_change_audit_log").select("*").eq("entity_type", "vehicle_engine").eq("entity_id", id).order("created_at", { ascending: false }).limit(100),
    admin.from("vehicle_validation_results").select("*").eq("entity_id", id).order("created_at", { ascending: false }).limit(100),
  ]);
  if (engine.error) throw engine.error;
  const record = adminDbEngineToRecord(engine.data as unknown as AdminDbEngine);
  return {
    record,
    audit: audit.data ?? [],
    validations: validations.data ?? validateVehicleRecord(record),
  };
}

async function auditChange(actorUserId: string | null, entityId: string, oldValue: unknown, newValue: unknown, action = "admin.updated") {
  const admin = getSupabaseAdmin();
  await admin.from("vehicle_change_audit_log").insert({
    actor_user_id: actorUserId,
    entity_type: "vehicle_engine",
    entity_id: entityId,
    action,
    old_value: oldValue,
    new_value: newValue,
    metadata: { source: "admin_vehicle_control_center" },
  });
}

export async function updateVehicleAdminRecord(id: string, update: VehicleAdminUpdate, actorUserId: string | null) {
  const admin = getSupabaseAdmin();
  const before = await getVehicleAdminDetail(id);
  const oldRecord = before.record;
  const nextKey = buildVehicleKey({
    brand: update.brand,
    model: update.model,
    generation: update.generation,
    engine: update.engine,
    ecuType: update.ecuType,
  });
  const validationTarget: VehicleControlRecord = {
    ...oldRecord,
    brand: update.brand,
    model: update.model,
    generation: update.generation,
    engine: update.engine,
    vehicleKey: nextKey,
    displayName: update.displayName || `${update.brand} ${update.model} ${update.generation} ${update.engine}`.replace(/\s+/g, " ").trim(),
    yearFrom: update.yearFrom ?? null,
    yearTo: update.yearTo ?? null,
    fuelType: update.fuelType ?? null,
    displacementCc: update.displacementCc ?? null,
    stockHp: update.stockHp ?? null,
    stockNm: update.stockNm ?? null,
    tunedHp: update.tunedHp ?? null,
    tunedNm: update.tunedNm ?? null,
    ecuFamily: update.ecuFamily || inferEcuFamily(update.ecuType),
    ecuType: update.ecuType ?? null,
    ecuHardware: update.ecuHardware ?? null,
    ecuSoftware: update.ecuSoftware ?? null,
    ecuNotes: update.ecuNotes ?? null,
    protectionNotes: update.protectionNotes ?? null,
    unlockNotes: update.unlockNotes ?? null,
    gearboxType: update.gearboxType ?? null,
    tcuType: update.tcuType ?? null,
    tcuNotes: update.tcuNotes ?? null,
    services: update.services ?? [],
    customerSafeNotes: update.customerSafeNotes ?? null,
    adminTechnicalNotes: update.adminTechnicalNotes ?? null,
    confidenceScore: update.confidenceScore ?? 60,
    verificationStatus: update.verificationStatus ?? "unverified",
    published: Boolean(update.published),
    active: update.active !== false,
  };
  const issues = validateVehicleRecord(validationTarget);
  if (issues.some((issue) => issue.severity === "error")) {
    return { ok: false as const, issues };
  }

  const generation = (await admin.from("vehicle_generations").select("id, model:vehicle_models(id, brand:vehicle_brands(id))").eq("id", before.record.generationId || "").maybeSingle()).data;
  let generationId = oldRecord.generationId && /^[0-9a-f-]{36}$/i.test(oldRecord.generationId) ? oldRecord.generationId : null;
  if (!generationId || !generation) {
    const canonicalBrand = normalizeBrandName(update.brand);
    const canonicalModel = canonicalizeVehicleModel(update.brand, update.model);
    const canonicalGeneration = normalizeGenerationName(update.brand, update.model, update.generation);
    const brand = await admin.from("vehicle_brands").upsert({
      name: canonicalBrand.canonicalName || update.brand,
      slug: canonicalBrand.normalizedKey || normalizeToken(update.brand),
      active: true,
      published: true,
      source_type: "manual",
      verification_status: "verified",
      updated_by: actorUserId,
    }, { onConflict: "slug" }).select("id").single();
    const model = await admin.from("vehicle_models").upsert({
      brand_id: brand.data?.id,
      name: canonicalModel.normalized ? canonicalModel.displayName : update.model,
      slug: canonicalModel.slug || normalizeToken(update.model),
      active: true,
      published: true,
      source_type: "manual",
      verification_status: "verified",
      updated_by: actorUserId,
    }, { onConflict: "brand_id,slug" }).select("id").single();
    const generationRow = await admin.from("vehicle_generations").upsert({
      model_id: model.data?.id,
      name: canonicalGeneration.canonicalName || update.generation,
      slug: canonicalGeneration.aliasMatched ? canonicalGeneration.normalizedKey : normalizeToken(update.generation),
      year_from: update.yearFrom ?? null,
      year_to: update.yearTo ?? null,
      active: true,
      published: true,
      source_type: "manual",
      verification_status: "verified",
      updated_by: actorUserId,
    }, { onConflict: "model_id,slug" }).select("id").single();
    generationId = generationRow.data?.id ?? null;
  }

  const saved = await admin.from("vehicle_engines").update({
    generation_id: generationId,
    vehicle_key: nextKey,
    engine_name: update.engine,
    display_name: validationTarget.displayName,
    fuel_type: update.fuelType ?? null,
    displacement_cc: update.displacementCc ?? null,
    stock_hp: update.stockHp ?? null,
    stock_nm: update.stockNm ?? null,
    year_from: update.yearFrom ?? null,
    year_to: update.yearTo ?? null,
    customer_safe_notes: update.customerSafeNotes ?? null,
    admin_technical_notes: update.adminTechnicalNotes ?? null,
    active: update.active !== false,
    published: Boolean(update.published),
    source_type: "manual",
    confidence_score: update.confidenceScore ?? 60,
    verification_status: update.verificationStatus ?? "unverified",
    updated_by: actorUserId,
    updated_at: new Date().toISOString(),
  }).eq("id", id).select("id").single();
  if (saved.error) throw saved.error;

  const ecu = await admin.from("vehicle_ecu_variants").select("id").eq("engine_id", id).limit(1).maybeSingle();
  const ecuPayload = {
    engine_id: id,
    ecu_family: update.ecuFamily || inferEcuFamily(update.ecuType),
    ecu_type: update.ecuType ?? null,
    ecu_hardware: update.ecuHardware ?? null,
    ecu_software: update.ecuSoftware ?? null,
    ecu_notes: update.ecuNotes ?? null,
    protection_notes: update.protectionNotes ?? null,
    unlock_notes: update.unlockNotes ?? null,
    gearbox_type: update.gearboxType ?? null,
    tcu_type: update.tcuType ?? null,
    tcu_notes: update.tcuNotes ?? null,
    source_type: "manual",
    confidence_score: update.confidenceScore ?? 60,
    verification_status: update.verificationStatus ?? "unverified",
    updated_by: actorUserId,
  };
  if (ecu.data?.id) await admin.from("vehicle_ecu_variants").update(ecuPayload).eq("id", ecu.data.id);
  else await admin.from("vehicle_ecu_variants").insert({ ...ecuPayload, created_by: actorUserId });

  await admin.from("vehicle_service_capabilities").update({
    available: false,
    updated_by: actorUserId,
  }).eq("engine_id", id);

  for (const service of update.services ?? []) {
    await admin.from("vehicle_service_capabilities").upsert({
      engine_id: id,
      service_key: service,
      available: true,
      source_type: "manual",
      confidence_score: update.confidenceScore ?? 60,
      verification_status: update.verificationStatus ?? "unverified",
      updated_by: actorUserId,
    }, { onConflict: "engine_id,service_key" });
  }

  await admin.from("vehicle_performance_profiles").upsert({
    engine_id: id,
    stage: "stage1",
    stock_hp: update.stockHp ?? null,
    stock_nm: update.stockNm ?? null,
    tuned_hp: update.tunedHp ?? null,
    tuned_nm: update.tunedNm ?? null,
    gain_hp: update.tunedHp != null && update.stockHp != null ? update.tunedHp - update.stockHp : null,
    gain_nm: update.tunedNm != null && update.stockNm != null ? update.tunedNm - update.stockNm : null,
    source_type: "manual",
    confidence_score: update.confidenceScore ?? 60,
    verification_status: update.verificationStatus ?? "unverified",
    updated_by: actorUserId,
  }, { onConflict: "engine_id,stage" });

  await auditChange(actorUserId, id, oldRecord, validationTarget);
  const detail = await getVehicleAdminDetail(id);
  return { ok: true as const, detail, issues };
}

export async function createVehicleAdminRecord(update: VehicleAdminUpdate, actorUserId: string | null) {
  const admin = getSupabaseAdmin();
  const canonicalBrand = normalizeBrandName(update.brand);
  const canonicalModel = canonicalizeVehicleModel(update.brand, update.model);
  const canonicalGeneration = normalizeGenerationName(update.brand, update.model, update.generation);
  const brandName = canonicalBrand.canonicalName || update.brand;
  const modelName = canonicalModel.normalized ? canonicalModel.displayName : update.model;
  const generationName = canonicalGeneration.canonicalName || update.generation;
  const record: VehicleControlRecord = {
    brand: brandName,
    brandId: canonicalBrand.aliasMatched ? canonicalBrand.normalizedKey : null,
    model: modelName,
    modelId: canonicalModel.normalized ? canonicalModel.slug : null,
    generation: generationName,
    generationId: canonicalGeneration.aliasMatched ? canonicalGeneration.normalizedKey : null,
    engine: update.engine,
    engineId: null,
    vehicleKey: buildVehicleKey({ brand: update.brand, model: update.model, generation: update.generation, engine: update.engine, ecuType: update.ecuType }),
    displayName: update.displayName || `${brandName} ${modelName} ${generationName} ${update.engine}`.replace(/\s+/g, " ").trim(),
    yearFrom: update.yearFrom ?? null,
    yearTo: update.yearTo ?? null,
    faceliftLabel: null,
    isLci: /\blci\b|facelift/i.test(update.generation),
    fuelType: update.fuelType ?? null,
    displacementCc: update.displacementCc ?? null,
    stockHp: update.stockHp ?? null,
    stockNm: update.stockNm ?? null,
    tunedHp: update.tunedHp ?? null,
    tunedNm: update.tunedNm ?? null,
    ecuFamily: update.ecuFamily || inferEcuFamily(update.ecuType),
    ecuType: update.ecuType ?? null,
    ecuHardware: update.ecuHardware ?? null,
    ecuSoftware: update.ecuSoftware ?? null,
    ecuNotes: update.ecuNotes ?? null,
    protectionNotes: update.protectionNotes ?? null,
    unlockNotes: update.unlockNotes ?? null,
    gearboxType: update.gearboxType ?? null,
    tcuType: update.tcuType ?? null,
    tcuNotes: update.tcuNotes ?? null,
    services: update.services ?? [],
    readMethods: [],
    customerSafeNotes: update.customerSafeNotes ?? null,
    adminTechnicalNotes: update.adminTechnicalNotes ?? null,
    sourceType: update.sourceType ?? "manual",
    sourceReference: update.sourceReference ?? null,
    sourceUrl: null,
    confidenceScore: update.confidenceScore ?? 70,
    verificationStatus: update.verificationStatus ?? "unverified",
    publishStatus: update.published ? "published" : "draft",
    active: update.active !== false,
    published: Boolean(update.published),
  };
  const issues = validateVehicleRecord(record);
  if (issues.some((issue) => issue.severity === "error")) return { ok: false as const, issues };

  const brand = await admin.from("vehicle_brands").upsert({
    name: brandName,
    slug: canonicalBrand.normalizedKey || normalizeToken(update.brand),
    active: true,
    published: true,
    source_type: "manual",
    verification_status: "verified",
    updated_by: actorUserId,
  }, { onConflict: "slug" }).select("id").single();
  if (brand.error) throw brand.error;
  const model = await admin.from("vehicle_models").upsert({
    brand_id: brand.data.id,
    name: modelName,
    slug: canonicalModel.slug || normalizeToken(update.model),
    active: true,
    published: true,
    source_type: "manual",
    verification_status: "verified",
    updated_by: actorUserId,
  }, { onConflict: "brand_id,slug" }).select("id").single();
  if (model.error) throw model.error;
  const generation = await admin.from("vehicle_generations").upsert({
    model_id: model.data.id,
    name: generationName,
    slug: canonicalGeneration.aliasMatched ? canonicalGeneration.normalizedKey : normalizeToken(update.generation),
    year_from: update.yearFrom ?? null,
    year_to: update.yearTo ?? null,
    active: true,
    published: true,
    source_type: "manual",
    verification_status: "verified",
    updated_by: actorUserId,
  }, { onConflict: "model_id,slug" }).select("id").single();
  if (generation.error) throw generation.error;
  const engine = await admin.from("vehicle_engines").insert({
    generation_id: generation.data.id,
    vehicle_key: record.vehicleKey,
    engine_name: update.engine,
    display_name: record.displayName,
    fuel_type: update.fuelType ?? null,
    displacement_cc: update.displacementCc ?? null,
    stock_hp: update.stockHp ?? null,
    stock_nm: update.stockNm ?? null,
    year_from: update.yearFrom ?? null,
    year_to: update.yearTo ?? null,
    customer_safe_notes: update.customerSafeNotes ?? null,
    admin_technical_notes: update.adminTechnicalNotes ?? null,
    active: update.active !== false,
    published: Boolean(update.published),
    source_type: update.sourceType ?? "manual",
    confidence_score: update.confidenceScore ?? 70,
    verification_status: update.verificationStatus ?? "unverified",
    created_by: actorUserId,
    updated_by: actorUserId,
  }).select("id").single();
  if (engine.error) throw engine.error;
  await auditChange(actorUserId, engine.data.id, null, record, "admin.created");
  await updateVehicleAdminRecord(engine.data.id, update, actorUserId);
  return { ok: true as const, detail: await getVehicleAdminDetail(engine.data.id), issues };
}

export async function persistVehicleValidationResults(records: VehicleControlRecord[], actorUserId: string | null) {
  const admin = getSupabaseAdmin();
  const issues: VehicleValidationIssue[] = records.flatMap(validateVehicleRecord);
  if (issues.length) {
    await admin.from("vehicle_validation_results").insert(issues.slice(0, 500).map((issue) => ({
      entity_type: issue.entityType ?? "vehicle_engine",
      entity_id: issue.entityId ?? null,
      vehicle_key: issue.vehicleKey ?? null,
      severity: issue.severity,
      code: issue.code,
      message: issue.message,
      metadata: issue.metadata ?? {},
    })));
  }
  await admin.from("vehicle_change_audit_log").insert({
    actor_user_id: actorUserId,
    entity_type: "vehicle_database",
    action: "validation.executed",
    new_value: { issue_count: issues.length },
    metadata: { source: "admin_vehicle_control_center" },
  });
  return issues;
}
