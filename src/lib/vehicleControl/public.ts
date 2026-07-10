import vehicles from "../../../data/vehicle-database.json";
import performanceOverrides from "../../../data/vehicle-performance-overrides.json";
import { createHash } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  canonicalizeVehicleModel,
  controlRecordToPublicVehicle,
  normalizeVehicleBrandKey,
  normalizeToken,
  rawVehicleToControlRecord,
} from "@/lib/vehicleControl/normalization";
import { normalizeBrandName, normalizeGenerationName } from "@/lib/vehicleNormalization";
import type {
  PublicVehicleCatalogPayload,
  PublicVehicleCatalogRebuildResult,
  PublicVehicleCatalogResult,
  PublicVehicleCatalogSource,
  PublicVehicleOption,
  PublicVehicleRecord,
  RawVehicleRow,
  StageData,
  VehicleServiceKey,
} from "@/lib/vehicleControl/types";
import { vehicleServiceLabels } from "@/lib/vehicleControl/types";

type PerformanceOverride = {
  stage1?: StageData;
  stage2?: StageData;
  services?: string[];
};

const rawRows = vehicles as RawVehicleRow[];
const overrides = performanceOverrides as Record<string, PerformanceOverride>;
const databasePageSize = 1000;
const cacheTtlMs = 60_000;
const catalogCacheId = "published";

type DbVehicleEngineBase = {
  id: string;
  vehicle_key: string;
  generation_id: string;
  engine_name: string;
  external_id: string | null;
  fuel_type: string | null;
  stock_hp: number | null;
  stock_nm: number | null;
  customer_safe_notes: string | null;
  active: boolean;
  published: boolean;
  generation: null | {
    id: string;
    name: string;
    external_id: string | null;
    active: boolean;
    published: boolean;
    model: null | {
      id: string;
      name: string;
      external_id: string | null;
      active: boolean;
      published: boolean;
      brand: null | {
        id: string;
        name: string;
        external_id: string | null;
        active: boolean;
        published: boolean;
      };
    };
  };
};

type DbVehicleDetail = {
  ecu_variants?: Array<{
    ecu_family: string | null;
    ecu_type: string | null;
    active: boolean;
    published: boolean;
  }>;
  service_capabilities?: Array<{
    service_key: VehicleServiceKey;
    available: boolean;
  }>;
  performance_profiles?: Array<{
    stage: "stock" | "stage1" | "stage2" | "stage3";
    stock_hp: number | null;
    stock_nm: number | null;
    tuned_hp: number | null;
    tuned_nm: number | null;
    gain_hp: number | null;
    gain_nm: number | null;
    active: boolean;
    published: boolean;
  }>;
};

type PagedResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

type DbCatalogCacheRow = {
  payload: unknown;
  version: number | null;
  source_hash: string | null;
  generated_at: string | null;
  is_active: boolean | null;
};

function catalogModelKey(brandId: string, modelId: string) {
  return `${brandId}::${modelId}`;
}

function catalogGenerationKey(brandId: string, modelId: string, generationId: string) {
  return `${brandId}::${modelId}::${generationId}`;
}

function isPublicVehicleOption(value: unknown): value is PublicVehicleOption {
  return Boolean(value && typeof value === "object" && typeof (value as PublicVehicleOption).id === "string" && typeof (value as PublicVehicleOption).name === "string");
}

function isPublicVehicleRecord(value: unknown): value is PublicVehicleRecord {
  const row = value as PublicVehicleRecord;
  return Boolean(value && typeof value === "object" && typeof row.brand === "string" && typeof row.brandId === "string" && typeof row.model === "string" && typeof row.modelId === "string" && typeof row.generation === "string" && typeof row.generationId === "string" && typeof row.engine === "string" && typeof row.engineId === "string");
}

function isPublicVehicleCatalogPayload(value: unknown): value is PublicVehicleCatalogPayload {
  const payload = value as PublicVehicleCatalogPayload;
  return Boolean(
    value &&
    typeof value === "object" &&
    payload.version === 1 &&
    typeof payload.generatedAt === "string" &&
    Array.isArray(payload.rows) &&
    payload.rows.every(isPublicVehicleRecord) &&
    Array.isArray(payload.brands) &&
    payload.brands.every(isPublicVehicleOption) &&
    payload.modelsByBrand &&
    typeof payload.modelsByBrand === "object" &&
    payload.generationsByModel &&
    typeof payload.generationsByModel === "object" &&
    payload.enginesByGeneration &&
    typeof payload.enginesByGeneration === "object"
  );
}

export function buildPublicVehicleCatalogPayload(rows: PublicVehicleRecord[], generatedAt = new Date().toISOString()): PublicVehicleCatalogPayload {
  const brands = listBrandsFromRows(rows);
  const modelsByBrand: Record<string, PublicVehicleOption[]> = {};
  const generationsByModel: Record<string, PublicVehicleOption[]> = {};
  const enginesByGeneration: Record<string, PublicVehicleOption[]> = {};

  for (const brand of brands) {
    const models = listModelsFromRows(rows, brand.id);
    modelsByBrand[brand.id] = models;

    for (const model of models) {
      const generations = listGenerationsFromRows(rows, brand.id, model.id);
      generationsByModel[catalogModelKey(brand.id, model.id)] = generations;

      for (const generation of generations) {
        enginesByGeneration[catalogGenerationKey(brand.id, model.id, generation.id)] = listEnginesFromRows(rows, brand.id, model.id, generation.id);
      }
    }
  }

  return {
    version: 1,
    generatedAt,
    rows,
    brands,
    modelsByBrand,
    generationsByModel,
    enginesByGeneration,
  };
}

function sourceHashForPayload(payload: PublicVehicleCatalogPayload) {
  return createHash("sha256").update(JSON.stringify(payload.rows)).digest("hex");
}

function countCatalogItems(payload: PublicVehicleCatalogPayload) {
  return {
    brandCount: payload.brands.length,
    modelCount: Object.values(payload.modelsByBrand).reduce((sum, items) => sum + items.length, 0),
    generationCount: Object.values(payload.generationsByModel).reduce((sum, items) => sum + items.length, 0),
    engineCount: Object.values(payload.enginesByGeneration).reduce((sum, items) => sum + items.length, 0),
  };
}

function withOverrides(row: RawVehicleRow): PublicVehicleRecord {
  const publicRow = controlRecordToPublicVehicle(rawVehicleToControlRecord(row));
  const legacyKey = [row.brandId, row.modelId, row.generationId, row.engineId].join(":");
  const override = overrides[legacyKey];
  return {
    ...publicRow,
    stage1: override?.stage1 ?? publicRow.stage1,
    stage2: override?.stage2 ?? row.stage2 ?? publicRow.stage2,
    services: [...new Set([...(publicRow.services ?? []), ...(override?.services ?? [])])],
  };
}

function publicRowsFromJson() {
  return rawRows.map(withOverrides);
}

export async function fetchPagedRowsForVehicleSelector<T>(
  fetchPage: (from: number, to: number) => Promise<PagedResult<T>>,
  pageSize = databasePageSize
) {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await fetchPage(from, to);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

function dbEngineToPublic(row: DbVehicleEngineBase, detail: DbVehicleDetail = {}): PublicVehicleRecord | null {
  const generation = row.generation;
  const model = generation?.model;
  const brand = model?.brand;
  if (!brand || !model || !generation) return null;
  if (!row.active || !row.published || !brand.active || !brand.published || !model.active || !model.published || !generation.active || !generation.published) {
    return null;
  }
  const canonicalBrand = normalizeBrandName(brand.name);
  const brandName = canonicalBrand.canonicalName || brand.name;
  const canonicalModel = canonicalizeVehicleModel(brandName, model.name);
  const canonicalGeneration = normalizeGenerationName(brandName, canonicalModel.displayName || model.name, generation.name);
  const ecu = (detail.ecu_variants ?? [])
    .filter((item) => item.active && item.published)
    .flatMap((item) => [item.ecu_type, item.ecu_family])
    .filter((value): value is string => Boolean(value));
  const stage1 = (detail.performance_profiles ?? []).find((item) => item.stage === "stage1" && item.active && item.published) ?? null;
  const stage2 = (detail.performance_profiles ?? []).find((item) => item.stage === "stage2" && item.active && item.published) ?? null;
  const services = (detail.service_capabilities ?? [])
    .filter((item) => item.available)
    .map((item) => vehicleServiceLabels[item.service_key] ?? item.service_key);
  return {
    id: row.vehicle_key,
    brand: brandName,
    brandId: normalizeVehicleBrandKey(brand.name) || brand.external_id || brand.id,
    model: canonicalModel.displayName || model.name,
    modelId: canonicalModel.slug || normalizeToken(model.name),
    generation: canonicalGeneration.canonicalName || generation.name,
    generationId: canonicalGeneration.normalizedKey || normalizeToken(generation.name),
    engine: row.engine_name,
    engineId: row.external_id || row.id,
    fuelType: row.fuel_type,
    ecu: [...new Set(ecu)].slice(0, 8),
    stage1: stage1 ? {
      stockHp: stage1.stock_hp ?? row.stock_hp,
      stockNm: stage1.stock_nm ?? row.stock_nm,
      tunedHp: stage1.tuned_hp,
      tunedNm: stage1.tuned_nm,
      gainHp: stage1.gain_hp,
      gainNm: stage1.gain_nm,
    } : null,
    stage2: stage2 ? {
      stockHp: stage2.stock_hp ?? row.stock_hp,
      stockNm: stage2.stock_nm ?? row.stock_nm,
      tunedHp: stage2.tuned_hp,
      tunedNm: stage2.tuned_nm,
      gainHp: stage2.gain_hp,
      gainNm: stage2.gain_nm,
    } : null,
    readMethods: [],
    services: [...new Set(services)].slice(0, 24),
    vehicleKey: row.vehicle_key,
    customerSafeNotes: row.customer_safe_notes,
  };
}

async function publishedBaseRowsFromDatabase() {
  try {
    const admin = getSupabaseAdmin();
    const data = await fetchPagedRowsForVehicleSelector<DbVehicleEngineBase>((from, to) =>
      admin
        .from("vehicle_engines")
        .select(`
          id, vehicle_key, generation_id, engine_name, external_id, fuel_type, stock_hp, stock_nm, customer_safe_notes, active, published,
          generation:vehicle_generations(id, name, external_id, active, published,
            model:vehicle_models(id, name, external_id, active, published,
              brand:vehicle_brands(id, name, external_id, active, published)
            )
          )
        `)
        .eq("active", true)
        .eq("published", true)
        .order("vehicle_key", { ascending: true })
        .range(from, to) as unknown as Promise<PagedResult<DbVehicleEngineBase>>
    );
    return data.map((row) => dbEngineToPublic(row)).filter((row): row is PublicVehicleRecord => Boolean(row));
  } catch {
    return [];
  }
}

async function publishedVehicleDetailFromDatabase(vehicleKey: string) {
  try {
    const admin = getSupabaseAdmin();
    const { data: engine, error } = await admin
      .from("vehicle_engines")
      .select(`
        id, vehicle_key, generation_id, engine_name, external_id, fuel_type, stock_hp, stock_nm, customer_safe_notes, active, published,
        generation:vehicle_generations(id, name, external_id, active, published,
          model:vehicle_models(id, name, external_id, active, published,
            brand:vehicle_brands(id, name, external_id, active, published)
          )
        )
      `)
      .eq("vehicle_key", vehicleKey)
      .eq("active", true)
      .eq("published", true)
      .maybeSingle();
    if (error || !engine) return null;

    const engineId = (engine as { id: string }).id;
    const [ecu, services, performance] = await Promise.all([
      admin
        .from("vehicle_ecu_variants")
        .select("ecu_family, ecu_type, active, published")
        .eq("engine_id", engineId)
        .eq("active", true)
        .eq("published", true),
      admin
        .from("vehicle_service_capabilities")
        .select("service_key, available")
        .eq("engine_id", engineId)
        .eq("available", true),
      admin
        .from("vehicle_performance_profiles")
        .select("stage, stock_hp, stock_nm, tuned_hp, tuned_nm, gain_hp, gain_nm, active, published")
        .eq("engine_id", engineId)
        .eq("active", true)
        .eq("published", true),
    ]);
    if (ecu.error || services.error || performance.error) return null;

    return dbEngineToPublic(engine as unknown as DbVehicleEngineBase, {
      ecu_variants: ecu.data ?? [],
      service_capabilities: (services.data ?? []) as DbVehicleDetail["service_capabilities"],
      performance_profiles: (performance.data ?? []) as DbVehicleDetail["performance_profiles"],
    });
  } catch {
    return null;
  }
}

async function publicCatalogPayloadFromDatabaseCache() {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("public_vehicle_catalog_cache")
      .select("payload, version, source_hash, generated_at, is_active")
      .eq("id", catalogCacheId)
      .eq("is_active", true)
      .maybeSingle();

    if (error || !data) return null;
    const row = data as DbCatalogCacheRow;
    return isPublicVehicleCatalogPayload(row.payload) ? row.payload : null;
  } catch {
    return null;
  }
}

let cachedCatalog: PublicVehicleCatalogResult | null = null;

export async function getSafePublishedVehicleCatalog(options: { forceRefresh?: boolean } = {}): Promise<PublicVehicleCatalogResult> {
  const now = Date.now();
  if (!options.forceRefresh && cachedCatalog && cachedCatalog.expiresAt > now) return cachedCatalog;

  const cachedPayload = await publicCatalogPayloadFromDatabaseCache();
  if (cachedPayload) {
    cachedCatalog = {
      source: "cache",
      payload: cachedPayload,
      rows: cachedPayload.rows,
      expiresAt: now + cacheTtlMs,
    };
    return cachedCatalog;
  }

  const databaseRows = await publishedBaseRowsFromDatabase();
  const source: PublicVehicleCatalogSource = databaseRows.length ? "database" : "json";
  const rows = databaseRows.length ? databaseRows : publicRowsFromJson();
  const payload = buildPublicVehicleCatalogPayload(rows);
  cachedCatalog = {
    source,
    payload,
    rows,
    expiresAt: now + cacheTtlMs,
  };
  return cachedCatalog;
}

export async function getSafePublishedVehicleRows(options: { forceRefresh?: boolean } = {}) {
  const catalog = await getSafePublishedVehicleCatalog(options);
  return { source: catalog.source, rows: catalog.rows, expiresAt: catalog.expiresAt };
}

export async function rebuildPublicVehicleCatalogCache(generatedBy?: string | null): Promise<PublicVehicleCatalogRebuildResult> {
  const rows = await publishedBaseRowsFromDatabase();
  if (!rows.length) throw new Error("No published database vehicle rows were found. Cache rebuild was skipped.");

  const generatedAt = new Date().toISOString();
  const payload = buildPublicVehicleCatalogPayload(rows, generatedAt);
  const sourceHash = sourceHashForPayload(payload);
  const counts = countCatalogItems(payload);
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("public_vehicle_catalog_cache")
    .upsert({
      id: catalogCacheId,
      payload,
      version: payload.version,
      source_hash: sourceHash,
      brand_count: counts.brandCount,
      model_count: counts.modelCount,
      generation_count: counts.generationCount,
      engine_count: counts.engineCount,
      generated_at: generatedAt,
      generated_by: generatedBy ?? null,
      is_active: true,
      updated_at: generatedAt,
    }, { onConflict: "id" });

  if (error) throw new Error(error.message);
  cachedCatalog = {
    source: "cache",
    payload,
    rows,
    expiresAt: Date.now() + cacheTtlMs,
  };

  return {
    ok: true,
    id: catalogCacheId,
    sourceHash,
    ...counts,
    generatedAt,
  };
}

function uniqueBy<T>(items: T[], keyFn: (item: T) => string) {
  const map = new Map<string, T>();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, item);
  }
  return [...map.values()];
}

export function listBrandsFromRows(rows: PublicVehicleRecord[]) {
  return uniqueBy(rows, (row) => row.brandId || normalizeToken(row.brand))
    .map((row) => ({ id: row.brandId || normalizeToken(row.brand), name: row.brand }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function listModelsFromRows(rows: PublicVehicleRecord[], brandId: string) {
  return uniqueBy(rows.filter((row) => row.brandId === brandId), (row) => row.modelId || normalizeToken(row.model))
    .map((row) => ({ id: row.modelId || normalizeToken(row.model), name: row.model }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function listModelsFromCatalog(payload: PublicVehicleCatalogPayload, brandId: string) {
  return payload.modelsByBrand[brandId] ?? [];
}

export function listGenerationsFromCatalog(payload: PublicVehicleCatalogPayload, brandId: string, modelId: string) {
  return payload.generationsByModel[catalogModelKey(brandId, modelId)] ?? [];
}

export function listEnginesFromCatalog(payload: PublicVehicleCatalogPayload, brandId: string, modelId: string, generationId: string) {
  return payload.enginesByGeneration[catalogGenerationKey(brandId, modelId, generationId)] ?? [];
}

export function listGenerationsFromRows(rows: PublicVehicleRecord[], brandId: string, modelId: string) {
  return uniqueBy(rows.filter((row) => row.brandId === brandId && row.modelId === modelId), (row) => row.generationId || normalizeToken(row.generation))
    .map((row) => ({ id: row.generationId || normalizeToken(row.generation), name: row.generation }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function listEnginesFromRows(rows: PublicVehicleRecord[], brandId: string, modelId: string, generationId: string) {
  return uniqueBy(
    rows.filter((row) => row.brandId === brandId && row.modelId === modelId && row.generationId === generationId),
    (row) => row.engineId || normalizeToken(row.engine)
  ).map((row) => ({ id: row.engineId || normalizeToken(row.engine), name: row.engine, fuelType: row.fuelType }));
}

export function findVehicleFromRows(rows: PublicVehicleRecord[], brandId: string, modelId: string, generationId: string, engineId: string) {
  return rows.find((row) =>
    row.brandId === brandId &&
    row.modelId === modelId &&
    row.generationId === generationId &&
    row.engineId === engineId
  ) ?? null;
}

export async function getSafePublishedVehicle(brandId: string, modelId: string, generationId: string, engineId: string) {
  const list = await getSafePublishedVehicleRows();
  const base = findVehicleFromRows(list.rows, brandId, modelId, generationId, engineId);
  if (!base) return { source: list.source, row: null };
  if (list.source === "json") return { source: list.source, row: base };
  return { source: list.source, row: await publishedVehicleDetailFromDatabase(base.vehicleKey ?? base.id) ?? base };
}
