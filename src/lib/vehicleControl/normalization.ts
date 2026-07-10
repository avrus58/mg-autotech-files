import type {
  PublicVehicleRecord,
  RawVehicleRow,
  StageData,
  VehicleControlRecord,
  VehicleServiceKey,
} from "@/lib/vehicleControl/types";
import { vehicleServiceLabels } from "@/lib/vehicleControl/types";
import {
  buildCanonicalVehicleKey,
  compareNormalizedNames,
  normalizeBrandName,
  normalizeGenerationName,
  normalizeModelName,
  normalizeText,
  resolveAliasCandidate,
} from "@/lib/vehicleNormalization";

const serviceSynonyms: Array<[VehicleServiceKey, RegExp]> = [
  ["stage1", /\bstage\s*1\b/i],
  ["stage2", /\bstage\s*2\b/i],
  ["stage3", /\bstage\s*3\b/i],
  ["dpf_off", /\bdpf\b|particulate/i],
  ["egr_off", /\begr\b/i],
  ["adblue_off", /\badblue\b|\bscr\b/i],
  ["dtc_off", /\bdtc\b|fault\s*code/i],
  ["vmax_off", /\bvmax\b|speed\s*limit/i],
  ["start_stop_off", /start[\s-]*stop/i],
  ["tcu_tune", /\btcu\b|gearbox|transmission/i],
  ["tcu_shift", /\bshift\b/i],
  ["tcu_lockup", /lock[\s-]*up/i],
  ["pop_bangs", /pop|bang|crackle/i],
  ["launch_control", /launch/i],
];

export const normalizeToken = normalizeText;
export { buildCanonicalVehicleKey, compareNormalizedNames, resolveAliasCandidate };

export function normalizeVehicleBrandKey(brand: string | null | undefined) {
  return normalizeBrandName(brand).normalizedKey;
}

export function canonicalizeVehicleModel(brand: string | null | undefined, model: string | null | undefined) {
  const normalized = normalizeModelName(brand, model);
  return { slug: normalized.normalizedKey, displayName: normalized.canonicalName, normalized: normalized.aliasMatched };
}

export function sameVehicleModelFamily(
  brand: string | null | undefined,
  left: string | null | undefined,
  right: string | null | undefined
) {
  return compareNormalizedNames({ entityType: "model", brand, left, right }).equal;
}

export function buildVehicleKey(input: {
  brand: string;
  model: string;
  generation: string;
  engine: string;
  ecuType?: string | null;
}) {
  return buildCanonicalVehicleKey(input);
}

export function parseYearRange(generation: string | null | undefined) {
  const value = generation ?? "";
  const years = [...value.matchAll(/\b(19\d{2}|20\d{2})\b/g)].map((match) => Number(match[1]));
  if (years.length === 0) return { yearFrom: null, yearTo: null };
  const yearFrom = Math.min(...years);
  const hasOpenEnd = /->|\.\.\.|present|now/i.test(value);
  const yearTo = hasOpenEnd || years.length === 1 ? null : Math.max(...years);
  return { yearFrom, yearTo };
}

export function parseDisplacementCc(fuelType: string | null | undefined, engine: string | null | undefined) {
  const source = `${fuelType ?? ""} ${engine ?? ""}`;
  const match = source.match(/\b(\d{1,2}(?:[.,]\d)?)\s*(?:l|liter)?\b/i);
  if (!match) return null;
  const liters = Number(match[1].replace(",", "."));
  if (!Number.isFinite(liters) || liters <= 0 || liters > 20) return null;
  return Math.round(liters * 1000);
}

export function inferEcuFamily(ecuType: string | null | undefined) {
  const value = ecuType ?? "";
  const familyPatterns = [
    /\b(EDC\d+)[A-Z0-9]*\b/i,
    /\b(MED\d+)[A-Z0-9]*\b/i,
    /\b(MEVD\d+)[A-Z0-9]*\b/i,
    /\b(MD1)[A-Z0-9]*\b/i,
    /\b(MG1)[A-Z0-9]*\b/i,
    /\b(SID\d+)[A-Z0-9]*\b/i,
    /\b(SIMOS\d+)[A-Z0-9]*\b/i,
    /\b(DCM\d+)[A-Z0-9]*\b/i,
    /\b(E\d{2})\b/i,
    /\b(PCR\d+)[A-Z0-9]*\b/i,
    /\b(MSD\d+)[A-Z0-9]*\b/i,
    /\b(MSV\d+)[A-Z0-9]*\b/i,
    /\b(ME\d+)[A-Z0-9]*\b/i,
    /\b(DQ\d+)[A-Z0-9]*\b/i,
    /\b(DL\d+)[A-Z0-9]*\b/i,
    /\b(ZF\s*\d+HP)\b/i,
  ];
  for (const pattern of familyPatterns) {
    const match = value.match(pattern);
    if (match) return match[1].replace(/\s+/g, "").toUpperCase();
  }
  return null;
}

export function normalizeServices(services: string[] | null | undefined, stage1?: StageData | null, stage2?: StageData | null) {
  const keys = new Set<VehicleServiceKey>();
  if (stage1) keys.add("stage1");
  if (stage2) keys.add("stage2");
  for (const service of services ?? []) {
    for (const [key, pattern] of serviceSynonyms) {
      if (pattern.test(service)) keys.add(key);
    }
  }
  return [...keys];
}

export function stageGain(stage: StageData | null | undefined) {
  if (!stage) return null;
  return {
    stockHp: stage.stockHp ?? null,
    tunedHp: stage.tunedHp ?? null,
    gainHp: stage.gainHp ?? (stage.tunedHp != null && stage.stockHp != null ? stage.tunedHp - stage.stockHp : null),
    stockNm: stage.stockNm ?? null,
    tunedNm: stage.tunedNm ?? null,
    gainNm: stage.gainNm ?? (stage.tunedNm != null && stage.stockNm != null ? stage.tunedNm - stage.stockNm : null),
  };
}

export function rawVehicleToControlRecord(row: RawVehicleRow): VehicleControlRecord {
  const brandName = normalizeBrandName(row.brand ?? "");
  const brand = brandName.canonicalName || (row.brand ?? "");
  const canonicalModel = canonicalizeVehicleModel(brand, row.model ?? "");
  const model = canonicalModel.displayName || (row.model ?? "");
  const generationName = normalizeGenerationName(brand, model, row.generation ?? "");
  const generation = generationName.canonicalName || (row.generation ?? "");
  const engine = row.engine ?? "";
  const ecuType = row.ecu?.[0] ?? null;
  const years = parseYearRange(generation);
  const stage1 = stageGain(row.stage1);
  const vehicleKey = buildVehicleKey({
    brand,
    model,
    generation,
    engine,
    ecuType,
  });
  return {
    brand,
    brandId: brandName.aliasMatched ? brandName.normalizedKey : row.brandId ?? null,
    model,
    modelId: canonicalModel.normalized ? canonicalModel.slug : row.modelId ?? null,
    generation,
    generationId: generationName.aliasMatched ? generationName.normalizedKey : row.generationId ?? null,
    engine,
    engineId: row.engineId ?? null,
    vehicleKey,
    displayName: `${brand} ${model} ${generation} ${engine}`.replace(/\s+/g, " ").trim(),
    yearFrom: years.yearFrom,
    yearTo: years.yearTo,
    faceliftLabel: null,
    isLci: /\blci\b|facelift/i.test(generation),
    fuelType: row.fuelType ?? null,
    displacementCc: parseDisplacementCc(row.fuelType, engine),
    stockHp: stage1?.stockHp ?? row.stage2?.stockHp ?? null,
    stockNm: stage1?.stockNm ?? row.stage2?.stockNm ?? null,
    tunedHp: stage1?.tunedHp ?? null,
    tunedNm: stage1?.tunedNm ?? null,
    ecuFamily: inferEcuFamily(ecuType),
    ecuType,
    ecuHardware: null,
    ecuSoftware: null,
    ecuNotes: row.ecu?.slice(1).join(", ") || null,
    protectionNotes: null,
    unlockNotes: null,
    gearboxType: null,
    tcuType: null,
    tcuNotes: null,
    services: normalizeServices(row.services, row.stage1, row.stage2),
    readMethods: row.readMethods ?? [],
    customerSafeNotes: null,
    adminTechnicalNotes: null,
    sourceType: row.source || "carecufile_import",
    sourceReference: [row.brandId, row.modelId, row.generationId, row.engineId].filter(Boolean).join(":") || null,
    sourceUrl: row.sourceUrl ?? null,
    confidenceScore: ecuType ? 70 : 55,
    verificationStatus: "imported",
    publishStatus: "published",
    active: true,
    published: true,
  };
}

export function controlRecordToPublicVehicle(record: VehicleControlRecord): PublicVehicleRecord {
  const canonicalBrand = normalizeBrandName(record.brand);
  const canonicalModel = canonicalizeVehicleModel(record.brand, record.model);
  const canonicalGeneration = normalizeGenerationName(record.brand, record.model, record.generation);
  const stage1: StageData | null = record.stockHp || record.stockNm || record.tunedHp || record.tunedNm
    ? {
        stockHp: record.stockHp,
        stockNm: record.stockNm,
        tunedHp: record.tunedHp,
        tunedNm: record.tunedNm,
        gainHp: record.tunedHp != null && record.stockHp != null ? record.tunedHp - record.stockHp : null,
        gainNm: record.tunedNm != null && record.stockNm != null ? record.tunedNm - record.stockNm : null,
      }
    : null;
  return {
    id: record.vehicleKey,
    brand: canonicalBrand.canonicalName || record.brand,
    brandId: canonicalBrand.normalizedKey || record.brandId || normalizeToken(record.brand),
    model: canonicalModel.displayName || record.model,
    modelId: canonicalModel.slug || normalizeToken(record.model),
    generation: canonicalGeneration.canonicalName || record.generation,
    generationId: canonicalGeneration.normalizedKey || normalizeToken(record.generation),
    engine: record.engine,
    engineId: record.engineId || normalizeToken(record.engine),
    fuelType: record.fuelType,
    ecu: [record.ecuType, record.ecuFamily].filter((value): value is string => Boolean(value)),
    stage1,
    stage2: null,
    readMethods: record.readMethods.slice(0, 8),
    services: record.services.map((key) => vehicleServiceLabels[key]).slice(0, 24),
    vehicleKey: record.vehicleKey,
    customerSafeNotes: record.customerSafeNotes,
  };
}

export function rawVehiclesToPublicRows(rows: RawVehicleRow[]) {
  return rows.map((row) => controlRecordToPublicVehicle(rawVehicleToControlRecord(row)));
}
