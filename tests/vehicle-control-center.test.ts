import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";
import { hasStaffPermission } from "../src/lib/staffPermissions";
import {
  buildVehicleKey,
  canonicalizeVehicleModel,
  controlRecordToPublicVehicle,
  rawVehiclesToPublicRows,
  rawVehicleToControlRecord,
} from "../src/lib/vehicleControl/normalization";
import {
  buildPublicVehicleCatalogPayload,
  fetchPagedRowsForVehicleSelector,
  getSafePublishedVehicleRows,
  listEnginesFromCatalog,
  listBrandsFromRows,
  listGenerationsFromCatalog,
  listEnginesFromRows,
  listGenerationsFromRows,
  listModelsFromCatalog,
  listModelsFromRows,
} from "../src/lib/vehicleControl/public";
import {
  buildVehicleImportSummary,
  createVehicleImportPlan,
  dryRunVehicleImport,
  getValidImportCandidates,
} from "../src/lib/vehicleControl/importer";
import type {
  PublicVehicleRecord,
  RawVehicleRow,
  StageData,
  VehicleControlRecord,
} from "../src/lib/vehicleControl/types";
import { validateVehicleCollection, validateVehicleRecord } from "../src/lib/vehicleControl/validation";
import {
  buildVehicleAdminPagination,
  buildVehicleAdminSearchPattern,
  vehicleAdminListQuerySchema,
  vehicleAdminPayloadSchema,
} from "../src/lib/vehicleControl/schema";
import {
  buildCanonicalVehicleKey,
  compareNormalizedNames,
  normalizeBrandName,
  normalizeGenerationName,
  resolveAliasCandidate,
} from "../src/lib/vehicleNormalization";

const rawRow: RawVehicleRow = {
  source: "carecufile_import",
  sourceUrl: "https://private.example/source",
  brand: "BMW",
  brandId: "bmw",
  model: "5 serie",
  modelId: "5-serie",
  generation: "G30/31 - 2016 - 2019",
  generationId: "g30-31-2016-2019",
  engine: "530d 265hp",
  engineId: "530d-265hp",
  fuelType: "3.0 Diesel",
  ecu: ["Bosch EDC17C50", "private calibration note"],
  stage1: { stockHp: 265, tunedHp: 320, gainHp: 55, stockNm: 620, tunedNm: 700, gainNm: 80 },
  stage2: null,
  readMethods: ["OBD", "Bench"],
  services: ["DPF OFF", "EGR OFF", "DTC OFF"],
};

function controlRecord(overrides: Partial<VehicleControlRecord> = {}): VehicleControlRecord {
  return {
    ...rawVehicleToControlRecord(rawRow),
    adminTechnicalNotes: "private admin note",
    sourceReference: "private-source-reference",
    sourceUrl: "https://private.example/source",
    confidenceScore: 73,
    ...overrides,
  };
}

type VehiclePerformanceOverride = {
  stage1?: StageData | null;
  stage2?: StageData | null;
  services?: string[];
};

const forbiddenPublicVehicleKeys = new Set([
  "adminTechnicalNotes",
  "audit",
  "confidenceScore",
  "file_path",
  "filePath",
  "hex_preview",
  "imageUrl",
  "import_metadata",
  "private",
  "private_offsets",
  "publishStatus",
  "published",
  "scrapedAt",
  "signed_url",
  "signedUrl",
  "source",
  "sourceReference",
  "sourceUrl",
  "storage_path",
  "storagePath",
  "validation",
  "verificationStatus",
]);

const forbiddenPerformanceOverrideKeys = new Set(
  [...forbiddenPublicVehicleKeys].filter((key) => key !== "source")
);

function readVehicleFallbackRows() {
  return JSON.parse(readFileSync(resolve(process.cwd(), "data", "vehicle-database.json"), "utf8")) as RawVehicleRow[];
}

function readVehiclePerformanceOverrides() {
  return JSON.parse(readFileSync(resolve(process.cwd(), "data", "vehicle-performance-overrides.json"), "utf8")) as Record<string, VehiclePerformanceOverride>;
}

function findForbiddenPublicKeys(
  value: unknown,
  path = "$",
  findings: string[] = [],
  forbiddenKeys = forbiddenPublicVehicleKeys
) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => findForbiddenPublicKeys(item, `${path}[${index}]`, findings, forbiddenKeys));
    return findings;
  }
  if (!value || typeof value !== "object") return findings;

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const childPath = `${path}.${key}`;
    if (forbiddenKeys.has(key)) findings.push(childPath);
    findForbiddenPublicKeys(child, childPath, findings, forbiddenKeys);
  }
  return findings;
}

function duplicatePublicVehicleKeys(rows: PublicVehicleRecord[]) {
  const byKey = new Map<string, PublicVehicleRecord[]>();
  for (const row of rows) {
    const key = row.vehicleKey ?? row.id;
    byKey.set(key, [...(byKey.get(key) ?? []), row]);
  }
  return [...byKey.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({ key, count: group.length }));
}

function assertStageOverrideShape(stage: StageData | null | undefined, label: string) {
  if (stage == null) return;
  for (const field of ["stockHp", "tunedHp", "gainHp", "stockNm", "tunedNm", "gainNm"] as const) {
    const value: number | null = stage[field];
    assert.equal(value == null || (typeof value === "number" && Number.isFinite(value)), true, `${label}.${field} must be a finite number or null`);
  }
}

test("vehicle key generation is stable and normalized", () => {
  const left = buildVehicleKey({
    brand: "BMW",
    model: "5 Serie",
    generation: "G30/31 - 2016 - 2019",
    engine: "530d 265hp",
    ecuType: "Bosch EDC17C50",
  });
  const right = buildVehicleKey({
    brand: " bmw ",
    model: "5-serie",
    generation: "G30 31 2016 2019",
    engine: "530D 265HP",
    ecuType: "bosch edc17c50",
  });
  assert.equal(left, "bmw:5-serie:g30-31-2016-2019:530d-265hp:bosch-edc17c50");
  assert.equal(left, right);
});

test("Mercedes model aliases collapse to the existing short customer-facing family", () => {
  assert.deepEqual(canonicalizeVehicleModel("Mercedes-Benz", "E-Class"), { slug: "e", displayName: "E", normalized: true });
  assert.deepEqual(canonicalizeVehicleModel("Mercedes-Benz", "E Klasse"), { slug: "e", displayName: "E", normalized: true });
  assert.deepEqual(canonicalizeVehicleModel("Mercedes-Benz", "C-Klasse"), { slug: "c", displayName: "C", normalized: true });
  assert.deepEqual(canonicalizeVehicleModel("Mercedes-Benz", "GLC-Class"), { slug: "glc", displayName: "GLC", normalized: true });
  assert.deepEqual(canonicalizeVehicleModel("BMW", "E-Class"), { slug: "e-class", displayName: "E-Class", normalized: false });

  const key = buildVehicleKey({
    brand: "Mercedes-Benz",
    model: "E-Class",
    generation: "W214/S214/V214 (2023-present)",
    engine: "E 300 d",
  });
  assert.equal(key, "mercedes-benz:e:w214-s214-v214-2023-present:e-300-d");
});

test("vehicle normalization framework resolves brand, model and generation aliases", () => {
  assert.deepEqual(normalizeBrandName("MB"), {
    sourceName: "MB",
    canonicalName: "Mercedes-Benz",
    normalizedKey: "mercedes-benz",
    aliasMatched: true,
    matchedAlias: "mb",
  });
  assert.equal(normalizeBrandName("Mercedes Benz").normalizedKey, "mercedes-benz");
  assert.equal(normalizeBrandName("Bayerische Motoren Werke").normalizedKey, "bmw");
  assert.equal(normalizeBrandName("VW").canonicalName, "Volkswagen");
  assert.equal(compareNormalizedNames({ entityType: "brand", left: "VW", right: "Volkswagen" }).equal, true);
  assert.equal(compareNormalizedNames({ entityType: "model", brand: "Mercedes-Benz", left: "E Klasse", right: "E-Class" }).equal, true);

  const generation = normalizeGenerationName("Mercedes-Benz", "E-Class", "E Klasse W 214");
  assert.equal(generation.canonicalName, "W214");
  assert.equal(generation.normalizedKey, "w214");
  assert.equal(resolveAliasCandidate({ entityType: "generation", brand: "Mercedes", model: "E-Klasse", value: "E-Class W214" }).normalizedKey, "w214");
  assert.equal(buildCanonicalVehicleKey({ brand: "MB", model: "E-Klasse", generation: "E-Class W 214", engine: "E 300 d" }), "mercedes-benz:e:w214:e-300-d");
});

test("raw CareEcuFile rows become structured vehicle control records", () => {
  const record = rawVehicleToControlRecord(rawRow);
  assert.equal(record.brand, "BMW");
  assert.equal(record.model, "5 serie");
  assert.equal(record.yearFrom, 2016);
  assert.equal(record.yearTo, 2019);
  assert.equal(record.displacementCc, 3000);
  assert.equal(record.ecuFamily, "EDC17");
  assert.equal(record.ecuType, "Bosch EDC17C50");
  assert.ok(record.services.includes("stage1"));
  assert.ok(record.services.includes("dpf_off"));
  assert.ok(record.services.includes("egr_off"));
});

test("malformed raw rows produce validation issues instead of crashing normalization", () => {
  const malformed = rawVehicleToControlRecord({
    brand: undefined as unknown as string,
    model: undefined as unknown as string,
    generation: "future 2099 - 2001",
    engine: undefined as unknown as string,
    stage1: { stockHp: 10000, tunedHp: null, gainHp: null, stockNm: null, tunedNm: null, gainNm: null },
  });
  const issues = validateVehicleRecord(malformed);
  assert.ok(issues.some((issue) => issue.code === "missing_brand"));
  assert.ok(issues.some((issue) => issue.code === "missing_model"));
  assert.ok(issues.some((issue) => issue.code === "missing_engine"));
  assert.ok(issues.some((issue) => issue.code === "suspicious_year_to"));
  assert.ok(issues.some((issue) => issue.metadata?.suggestedFix));
});

test("vehicle validation blocks unrealistic performance values and warns on suspicious lower tuned output", () => {
  const impossible = controlRecord({ stockHp: 375, tunedHp: 4710, stockNm: 1539, tunedNm: 1925 });
  const lowTune = controlRecord({ stockHp: 300, tunedHp: 190, stockNm: 700, tunedNm: 480 });
  const missingEcu = controlRecord({ ecuType: null, ecuFamily: null });
  const missingTuned = controlRecord({ tunedHp: null, tunedNm: null, services: ["stage1"] });
  assert.ok(validateVehicleRecord(impossible).some((issue) => issue.code === "invalid_power_value" || issue.code === "unrealistic_tuned_hp_gain"));
  assert.ok(validateVehicleRecord(lowTune).some((issue) => issue.code === "tuned_hp_below_stock"));
  assert.equal(validateVehicleRecord(missingEcu).some((issue) => issue.code === "missing_ecu_info" && issue.severity === "warning"), true);
  assert.equal(validateVehicleRecord(missingTuned).some((issue) => issue.code === "missing_tuned_performance" && issue.severity === "warning"), true);
});

test("admin vehicle payload accepts one independent profile for each Stage and rejects duplicate stages", () => {
  const base = {
    brand: "BMW",
    model: "3 Series",
    generation: "G20",
    engine: "330d",
    stockHp: 286,
    stockNm: 650,
    services: ["stage1", "stage2", "stage3"],
  };
  const threeStages = vehicleAdminPayloadSchema.safeParse({
    ...base,
    performanceProfiles: [
      { stage: "stage1", tunedHp: 340, tunedNm: 720, active: true },
      { stage: "stage2", tunedHp: 370, tunedNm: 760, active: true },
      { stage: "stage3", tunedHp: 410, tunedNm: 800, active: true },
    ],
  });
  assert.equal(threeStages.success, true);

  const duplicate = vehicleAdminPayloadSchema.safeParse({
    ...base,
    performanceProfiles: [
      { stage: "stage1", tunedHp: 340, tunedNm: 720 },
      { stage: "stage1", tunedHp: 350, tunedNm: 730 },
    ],
  });
  assert.equal(duplicate.success, false);

  const omittedServices = vehicleAdminPayloadSchema.safeParse({
    brand: "BMW",
    model: "3 Series",
    generation: "G20",
    engine: "330d",
    stockHp: 286,
    stockNm: 650,
    performanceProfiles: [{ stage: "stage1", tunedHp: 340, tunedNm: 720, active: true }],
  });
  assert.equal(omittedServices.success, true);
  assert.equal(omittedServices.success && omittedServices.data.services, undefined);
});

test("public projection carries a real active Stage 3 profile without exposing admin metadata", () => {
  const publicRecord = controlRecordToPublicVehicle(controlRecord({
    services: ["stage1", "stage3"],
    performanceProfiles: [
      { stage: "stage1", stockHp: 265, stockNm: 620, tunedHp: 320, tunedNm: 700, gainHp: 55, gainNm: 80, active: true, published: true },
      { stage: "stage3", stockHp: 265, stockNm: 620, tunedHp: 410, tunedNm: 820, gainHp: 145, gainNm: 200, active: true, published: true },
    ],
  }));
  assert.equal(publicRecord.stage3?.tunedHp, 410);
  assert.equal(publicRecord.stage3?.gainNm, 200);
  assert.equal("performanceProfiles" in publicRecord, false);
});

test("admin vehicle list filters are bounded, sanitized and page ranges are stable", () => {
  const parsed = vehicleAdminListQuerySchema.safeParse({
    page: "2",
    pageSize: "25",
    q: " B57 / 330d ",
    brand: "BMW",
    model: "3 Series",
    generation: "G20",
    ecuFamily: "MD1",
    publishStatus: "published",
    verificationStatus: "verified",
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.success && parsed.data.page, 2);
  assert.equal(buildVehicleAdminSearchPattern(" B57, <script> "), "B57%script");
  assert.deepEqual(buildVehicleAdminPagination({ page: 2, pageSize: 25 }, 63), {
    page: 2,
    pageSize: 25,
    total: 63,
    pageCount: 3,
    hasPreviousPage: true,
    hasNextPage: true,
  });
  assert.equal(vehicleAdminListQuerySchema.safeParse({ page: 1, pageSize: 500 }).success, false);
});

test("customer public vehicle projection strips admin-only data", () => {
  const publicRecord = controlRecordToPublicVehicle(controlRecord());
  const serialized = JSON.stringify(publicRecord);
  assert.equal(serialized.includes("private admin note"), false);
  assert.equal(serialized.includes("private-source-reference"), false);
  assert.equal(serialized.includes("sourceUrl"), false);
  assert.equal(serialized.includes("confidenceScore"), false);
  assert.equal(serialized.includes("verificationStatus"), false);
  assert.equal(serialized.includes("audit"), false);
  assert.ok(serialized.includes("Bosch EDC17C50"));
});

test("public selector merges Mercedes E and E-Class into one model option at read time", () => {
  const rows = rawVehiclesToPublicRows([
    {
      brand: "Mercedes-Benz",
      brandId: "mercedes-benz",
      model: "E",
      modelId: "e",
      generation: "W213/S213 - 2016 - 2023",
      generationId: "w213-s213",
      engine: "E 220 d",
      engineId: "e-220-d",
      fuelType: "Diesel",
      ecu: ["Bosch MD1"],
      stage1: { stockHp: 194, stockNm: 400, tunedHp: 220, tunedNm: 470, gainHp: 26, gainNm: 70 },
    },
    {
      brand: "Mercedes-Benz",
      brandId: "mercedes-benz",
      model: "E-Class",
      modelId: "external-e-class",
      generation: "W214/S214/V214 (2023-present)",
      generationId: "w214-s214-v214",
      engine: "E 300 d",
      engineId: "e-300-d",
      fuelType: "Diesel",
      ecu: ["Bosch MD1"],
      stage1: { stockHp: 197, stockNm: 440, tunedHp: 227, tunedNm: 506, gainHp: 30, gainNm: 66 },
    },
  ]);

  const models = listModelsFromRows(rows, "mercedes-benz");
  assert.deepEqual(models, [{ id: "e", name: "E" }]);
  const generations = listGenerationsFromRows(rows, "mercedes-benz", "e").map((item) => item.name);
  assert.equal(generations.includes("W213/S213 (2016-2023)"), true);
  assert.equal(generations.includes("W214/S214/V214 (2023-present)"), true);
  const engines = listEnginesFromRows(rows, "mercedes-benz", "e", "w214-s214-v214-2023-present");
  assert.deepEqual(engines, [{ id: "e-300-d", name: "E 300 d", fuelType: "Diesel" }]);
});

test("public catalog cache payload keeps Mercedes aliases merged and customer-safe", () => {
  const rows = rawVehiclesToPublicRows([
    {
      brand: "Mercedes-Benz",
      brandId: "mercedes-benz",
      model: "E",
      modelId: "e",
      generation: "W213/S213 - 2016 - 2023",
      generationId: "w213-s213",
      engine: "E 220 d",
      engineId: "e-220-d",
      fuelType: "Diesel",
      ecu: ["Bosch MD1"],
      stage1: { stockHp: 194, stockNm: 400, tunedHp: 220, tunedNm: 470, gainHp: 26, gainNm: 70 },
    },
    {
      brand: "Mercedes-Benz",
      brandId: "mercedes-benz",
      model: "E-Class",
      modelId: "source-e-class",
      generation: "E Klasse W 214",
      generationId: "source-w-214",
      engine: "E 300 d",
      engineId: "e-300-d",
      fuelType: "Diesel",
      ecu: ["Bosch MD1"],
      stage1: { stockHp: 197, stockNm: 440, tunedHp: 227, tunedNm: 506, gainHp: 30, gainNm: 66 },
    },
  ]);
  const payload = buildPublicVehicleCatalogPayload(rows, "2026-07-10T00:00:00.000Z");

  assert.deepEqual(payload.brands, [{ id: "mercedes-benz", name: "Mercedes-Benz" }]);
  assert.deepEqual(listModelsFromCatalog(payload, "mercedes-benz"), [{ id: "e", name: "E" }]);
  assert.deepEqual(listGenerationsFromCatalog(payload, "mercedes-benz", "e").map((item) => item.name), ["W213/S213 (2016-2023)", "W214"]);
  assert.deepEqual(listEnginesFromCatalog(payload, "mercedes-benz", "e", "w214"), [{ id: "e-300-d", name: "E 300 d", fuelType: "Diesel" }]);

  const serialized = JSON.stringify(payload);
  for (const forbidden of ["admin_notes", "source_reference", "confidence_score", "audit", "validation", "import_metadata", "alias", "private"]) {
    assert.equal(serialized.includes(forbidden), false, `${forbidden} should not be present`);
  }
});

test("public selector normalizes brand and generation aliases without exposing alias metadata", () => {
  const rows = rawVehiclesToPublicRows([
    {
      brand: "MB",
      brandId: "mb",
      model: "E Klasse",
      modelId: "external-e-klasse",
      generation: "E-Class W 214",
      generationId: "source-w-214",
      engine: "E 300 d",
      engineId: "e-300-d",
      fuelType: "Diesel",
      ecu: ["Bosch MD1"],
      stage1: { stockHp: 197, stockNm: 440, tunedHp: 227, tunedNm: 506, gainHp: 30, gainNm: 66 },
    },
    {
      brand: "Mercedes-Benz",
      brandId: "mercedes-benz",
      model: "E",
      modelId: "e",
      generation: "W214",
      generationId: "w214",
      engine: "E 220 d",
      engineId: "e-220-d",
      fuelType: "Diesel",
      ecu: ["Bosch MD1"],
      stage1: { stockHp: 197, stockNm: 440, tunedHp: 227, tunedNm: 506, gainHp: 30, gainNm: 66 },
    },
  ]);

  assert.deepEqual(listBrandsFromRows(rows), [{ id: "mercedes-benz", name: "Mercedes-Benz" }]);
  assert.deepEqual(listModelsFromRows(rows, "mercedes-benz"), [{ id: "e", name: "E" }]);
  assert.deepEqual(listGenerationsFromRows(rows, "mercedes-benz", "e"), [{ id: "w214", name: "W214" }]);
  const serialized = JSON.stringify(rows);
  assert.equal(serialized.includes("alias"), false);
  assert.equal(serialized.includes("source-w-214"), false);
  assert.equal(serialized.includes("external-e-klasse"), false);
});

test("import dry-run summary exposes source to canonical alias mapping", () => {
  const row: RawVehicleRow = {
    brand: "Mercedes",
    brandId: "source-mercedes",
    model: "E-Class",
    modelId: "source-e-class",
    generation: "E Klasse W 214",
    generationId: "source-w-214",
    engine: "E 300 d",
    engineId: "e-300-d",
    fuelType: "Diesel",
    ecu: ["Bosch MD1"],
    stage1: { stockHp: 197, stockNm: 440, tunedHp: 227, tunedNm: 506, gainHp: 30, gainNm: 66 },
  };
  const record = rawVehicleToControlRecord(row);
  const plan = {
    rows: [row],
    records: [record],
    issues: [],
    duplicateKeys: new Set<string>(),
    recordsByKey: new Map([[record.vehicleKey, [record]]]),
  } as ReturnType<typeof createVehicleImportPlan>;
  const summary = buildVehicleImportSummary(plan, [], { dryRun: true, dbDiffCalculated: true });

  assert.equal(summary.aliasWarningCount, 1);
  assert.equal(summary.aliasMappings?.[0]?.source.model, "E-Class");
  assert.equal(summary.aliasMappings?.[0]?.canonical.brand, "Mercedes-Benz");
  assert.equal(summary.aliasMappings?.[0]?.canonical.model, "E");
  assert.equal(summary.aliasMappings?.[0]?.canonical.generation, "W214");
  assert.deepEqual(summary.aliasMappings?.[0]?.matchedAliases, ["brand", "model", "generation"]);
  assert.equal(summary.aliasMappings?.[0]?.action, "reuse_canonical");
});

test("JSON fallback returns safe vehicle rows when database access is unavailable", async () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousService = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const result = await getSafePublishedVehicleRows({ forceRefresh: true });
    assert.equal(result.source, "json");
    assert.ok(result.rows.length > 1000);
    const serialized = JSON.stringify(result.rows.slice(0, 5));
    assert.equal(serialized.includes("adminTechnicalNotes"), false);
    assert.equal(serialized.includes("sourceReference"), false);
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousService === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousService;
  }
});

test("vehicle JSON fallback full projection is customer-safe and duplicate-reportable", () => {
  const fallbackRows = readVehicleFallbackRows();
  const firstRowBefore = JSON.stringify(fallbackRows[0]);
  const publicRows = rawVehiclesToPublicRows(fallbackRows);
  const forbiddenPaths = findForbiddenPublicKeys(publicRows);
  const duplicateGroups = duplicatePublicVehicleKeys(publicRows);
  const plan = createVehicleImportPlan();
  const summary = buildVehicleImportSummary(plan, [], { dryRun: true });

  assert.equal(publicRows.length, fallbackRows.length);
  assert.deepEqual(forbiddenPaths.slice(0, 20), []);
  assert.equal(plan.duplicateKeys.size, duplicateGroups.length);
  assert.equal(summary.duplicates, duplicateGroups.length);
  assert.equal(summary.duplicateExtraRows, duplicateGroups.reduce((total, group) => total + group.count - 1, 0));
  for (const example of summary.examples?.duplicates ?? []) {
    assert.equal(duplicateGroups.some((group) => group.key === example.vehicleKey && group.count === example.count), true);
  }
  assert.equal(JSON.stringify(fallbackRows[0]), firstRowBefore);
});

test("vehicle performance override keys match existing JSON fallback rows", () => {
  const fallbackRows = readVehicleFallbackRows();
  const fallbackLegacyKeys = new Set(
    fallbackRows.map((row) => [row.brandId, row.modelId, row.generationId, row.engineId].join(":"))
  );
  const overrides = readVehiclePerformanceOverrides();

  for (const [key, override] of Object.entries(overrides)) {
    assert.match(key, /^[^:\s]+:[^:\s]+:[^:\s]+:[^:\s]+$/, `${key} must be a four-part legacy vehicle key`);
    assert.equal(fallbackLegacyKeys.has(key), true, `${key} must match data/vehicle-database.json`);
    assert.equal(findForbiddenPublicKeys(override, "$", [], forbiddenPerformanceOverrideKeys).length, 0, `${key} override must not contain private/admin fields`);
    assertStageOverrideShape(override.stage1, `${key}.stage1`);
    assertStageOverrideShape(override.stage2, `${key}.stage2`);
    if (override.services !== undefined) {
      assert.equal(Array.isArray(override.services), true, `${key}.services must be an array`);
      for (const service of override.services) {
        assert.equal(typeof service === "string" && service.trim().length > 0, true, `${key}.services entries must be non-empty strings`);
      }
    }
  }
});

test("public vehicle database pagination collects every page", async () => {
  const sourceRows = Array.from({ length: 2505 }, (_, index) => ({ id: String(index + 1) }));
  const rows = await fetchPagedRowsForVehicleSelector(async (from, to) => ({
    data: sourceRows.slice(from, to + 1),
    error: null,
  }));
  assert.equal(rows.length, 2505);
  assert.equal(rows[0].id, "1");
  assert.equal(rows.at(-1)?.id, "2505");
});

test("public vehicle database pagination handles empty database for JSON fallback", async () => {
  const rows = await fetchPagedRowsForVehicleSelector(async () => ({ data: [], error: null }));
  assert.deepEqual(rows, []);
});

test("validation catches duplicate vehicle keys and invalid published records", () => {
  const first = controlRecord({ id: "one" });
  const duplicate = controlRecord({ id: "two" });
  const invalid = controlRecord({
    brand: "",
    vehicleKey: "",
    stockHp: 9999,
    published: true,
  });
  const issues = validateVehicleCollection([first, duplicate, invalid]);
  assert.ok(issues.some((issue) => issue.code === "duplicate_vehicle_key"));
  assert.ok(validateVehicleRecord(invalid).some((issue) => issue.code === "missing_brand"));
  assert.ok(validateVehicleRecord(invalid).some((issue) => issue.code === "invalid_power_value"));
});

test("validation warns about alias duplicate candidates and canonical key collisions", () => {
  const eShort = rawVehicleToControlRecord({
    brand: "Mercedes-Benz",
    model: "E",
    generation: "W214",
    engine: "E 300 d",
    ecu: ["Bosch MD1"],
    stage1: { stockHp: 197, stockNm: 440, tunedHp: 227, tunedNm: 506, gainHp: 30, gainNm: 66 },
  });
  const eClass = {
    ...rawVehicleToControlRecord({
      brand: "Mercedes",
      model: "E-Class",
      generation: "E Klasse W 214",
      engine: "E 220 d",
      ecu: ["Bosch MD1"],
      stage1: { stockHp: 197, stockNm: 440, tunedHp: 227, tunedNm: 506, gainHp: 30, gainNm: 66 },
    }),
    brand: "Mercedes",
    model: "E-Class",
    generation: "E Klasse W 214",
    vehicleKey: "legacy-source-key",
  };
  const issues = validateVehicleCollection([eShort, eClass]);

  assert.ok(issues.some((issue) => issue.code === "brand_alias_duplicate_candidate"));
  assert.ok(issues.some((issue) => issue.code === "model_alias_duplicate_candidate"));
  assert.ok(issues.some((issue) => issue.code === "generation_alias_duplicate_candidate"));
  assert.ok(issues.some((issue) => issue.code === "vehicle_key_alias_resolution" && issue.metadata?.canonicalKey));
});

test("vehicle import dry-run is non-destructive and reports source health", () => {
  const summary = dryRunVehicleImport(20);
  assert.equal(summary.dryRun, true);
  assert.equal(summary.mode, "valid_only");
  assert.equal(summary.totalRows, 20);
  assert.equal(summary.created, summary.validImportableCount);
  assert.equal(summary.updated, 0);
  assert.equal(summary.dbDiffCalculated, false);
  assert.ok(summary.sampleRecords.length > 0);
  assert.ok(Array.isArray(summary.warnings));
});

test("vehicle import dry-run calculates create, update and protected manual rows when DB state is known", () => {
  const plan = createVehicleImportPlan(20);
  const candidates = getValidImportCandidates(plan);
  const summary = buildVehicleImportSummary(plan, [
    { id: "existing-care", vehicle_key: candidates[0].vehicleKey, source_type: "carecufile_import", verification_status: "imported" },
    { id: "existing-manual", vehicle_key: candidates[1].vehicleKey, source_type: "manual", verification_status: "verified" },
  ], { dryRun: true, dbDiffCalculated: true });
  assert.equal(summary.dbDiffCalculated, true);
  assert.equal(summary.updated, 1);
  assert.equal(summary.protectedManualVerifiedCount, 1);
  assert.equal(summary.created, (summary.validImportableCount ?? 0) - 2);
});

test("vehicle import plan skips duplicate groups and blocking-invalid records before any database write", () => {
  const plan = createVehicleImportPlan();
  const summary = buildVehicleImportSummary(plan, [], { dryRun: true });
  assert.ok(plan.records.length > 0);
  assert.ok(plan.duplicateKeys.size > 0);
  assert.ok((summary.skippedDuplicate ?? 0) > (summary.duplicateExtraRows ?? 0));
  assert.ok((summary.skippedInvalid ?? 0) >= 1);
  assert.equal(summary.examples?.invalid?.some((item) => item.vehicleKey?.includes("challenger:rogator") && item.issueCodes.includes("invalid_power_value")), true);
  assert.equal(getValidImportCandidates(plan).some((record) => plan.duplicateKeys.has(record.vehicleKey)), false);
});

test("valid-only import candidates keep warning rows as needs-review instead of blocking them", () => {
  const plan = createVehicleImportPlan(20);
  const candidates = getValidImportCandidates(plan);
  assert.ok(candidates.some((record) => record.ecuType == null && record.verificationStatus === "needs_review"));
  assert.ok(candidates.some((record) => record.services.includes("stage1")));
});

test("real import path is valid-only by construction", () => {
  const source = readFileSync(resolve(process.cwd(), "src", "lib", "vehicleControl", "importer.ts"), "utf8");
  assert.match(source, /getValidImportCandidates\(plan\)/);
  assert.match(source, /for \(const record of candidates\)/);
  assert.doesNotMatch(source, /for \(let index = 0; index < plan\.records\.length/);
});

test("anonymous users cannot call admin vehicle APIs", async () => {
  const { GET } = await import("../src/app/api/admin/vehicles/route");
  const response = await GET(new Request("http://localhost/api/admin/vehicles"));
  assert.equal(response.status, 401);
});

test("anonymous users cannot search the full admin vehicle catalog", async () => {
  const { GET } = await import("../src/app/api/admin/vehicles/search/route");
  const response = await GET(new Request("http://localhost/api/admin/vehicles/search?page=1&pageSize=25"));
  assert.equal(response.status, 401);
});

test("anonymous users cannot run vehicle imports", async () => {
  const { POST } = await import("../src/app/api/admin/vehicles/import/route");
  const response = await POST(new Request("http://localhost/api/admin/vehicles/import", {
    method: "POST",
    body: JSON.stringify({ dryRun: true }),
  }));
  assert.equal(response.status, 401);
});

test("customer role cannot satisfy vehicle database admin permission", () => {
  assert.equal(hasStaffPermission({ role: "customer", staffRole: null, permissions: [] }, "vehicles.manage"), false);
  assert.equal(hasStaffPermission({ role: "staff", staffRole: "support", permissions: [] }, "vehicles.manage"), false);
  assert.equal(hasStaffPermission({ role: "staff", staffRole: "manager", permissions: ["vehicles.manage"] }, "vehicles.manage"), true);
  assert.equal(hasStaffPermission({ role: "admin", staffRole: "owner", permissions: [] }, "vehicles.manage"), true);
  assert.equal(hasStaffPermission({ role: "admin", staffRole: null, permissions: ["vehicles.manage"] }, "vehicles.manage"), false);
  assert.equal(hasStaffPermission({ role: "staff", staffRole: null, permissions: ["vehicles.manage"] }, "vehicles.manage"), false);
  assert.equal(hasStaffPermission({ role: "staff", staffRole: "owner", permissions: ["vehicles.manage"] }, "vehicles.manage"), false);
  assert.equal(hasStaffPermission({ role: "staff", staffRole: "invalid" as never, permissions: ["vehicles.manage"] }, "vehicles.manage"), false);
});

test("admin vehicle routes consistently require vehicles.manage permission", () => {
  for (const file of [
    "src/app/api/admin/vehicles/route.ts",
    "src/app/api/admin/vehicles/search/route.ts",
    "src/app/api/admin/vehicles/[id]/route.ts",
    "src/app/api/admin/vehicles/import/route.ts",
    "src/app/api/admin/vehicles/catalog-cache/rebuild/route.ts",
    "src/app/api/admin/vehicles/validation/route.ts",
    "src/app/api/admin/vehicles/audit/route.ts",
  ]) {
    const source = readFileSync(resolve(process.cwd(), file), "utf8");
    assert.match(source, /requireStaffPermission\(request,\s*"vehicles\.manage"\)/);
  }
});

test("anonymous users cannot rebuild the public vehicle catalog cache", async () => {
  const { POST } = await import("../src/app/api/admin/vehicles/catalog-cache/rebuild/route");
  const response = await POST(new Request("http://localhost/api/admin/vehicles/catalog-cache/rebuild", { method: "POST" }));
  assert.equal(response.status, 401);
});

test("vehicle control migration is additive, indexed, RLS protected and non-destructive", () => {
  const sql = readFileSync(resolve(process.cwd(), "scripts", "add-vehicle-control-center.sql"), "utf8");
  for (const table of [
    "vehicle_brands",
    "vehicle_models",
    "vehicle_generations",
    "vehicle_engines",
    "vehicle_ecu_variants",
    "vehicle_service_capabilities",
    "vehicle_performance_profiles",
    "vehicle_data_sources",
    "vehicle_import_batches",
    "vehicle_change_audit_log",
    "vehicle_validation_results",
  ]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`, "i"));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
  assert.match(sql, /has_staff_permission/i);
  assert.match(sql, /vehicles\.manage/i);
  assert.match(sql, /unique \(vehicle_key\)/i);
  assert.match(sql, /vehicle_engines_published_idx/i);
  assert.doesNotMatch(sql, /\bdrop\s+table\b|\btruncate\b|\bdelete\s+from\b/i);
});

test("vehicle normalization alias migration is additive and admin protected", () => {
  const sql = readFileSync(resolve(process.cwd(), "scripts", "add-vehicle-normalization-aliases.sql"), "utf8");
  for (const table of [
    "vehicle_brand_aliases",
    "vehicle_model_aliases",
    "vehicle_generation_aliases",
    "vehicle_engine_aliases",
    "vehicle_alias_review_events",
  ]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`, "i"));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
  assert.match(sql, /vehicles\.manage/i);
  assert.match(sql, /normalized_alias/i);
  assert.match(sql, /vehicle_alias_review_events/i);
  assert.doesNotMatch(sql, /\bdrop\s+table\b|\bdrop\s+column\b|\btruncate\b|\bdelete\s+from\b/i);
});

test("public vehicle catalog cache migration is additive, RLS protected and server mediated", () => {
  const sql = readFileSync(resolve(process.cwd(), "scripts", "add-public-vehicle-catalog-cache.sql"), "utf8");
  assert.match(sql, /create table if not exists public\.public_vehicle_catalog_cache/i);
  assert.match(sql, /payload jsonb not null/i);
  assert.match(sql, /alter table public\.public_vehicle_catalog_cache enable row level security/i);
  assert.match(sql, /revoke all on table public\.public_vehicle_catalog_cache from anon/i);
  assert.match(sql, /vehicles\.manage/i);
  assert.match(sql, /grant select, insert, update on table public\.public_vehicle_catalog_cache to service_role/i);
  assert.doesNotMatch(sql, /\bdrop\s+table\b|\bdrop\s+column\b|\btruncate\b|\bdelete\s+from\b/i);
});

test("public vehicle catalog cache verification SQL is read-only", () => {
  const sql = readFileSync(resolve(process.cwd(), "scripts", "verify-public-vehicle-catalog-cache.sql"), "utf8");
  assert.match(sql, /public_vehicle_catalog_cache/i);
  assert.match(sql, /pg_policies/i);
  assert.match(sql, /relrowsecurity/i);
  assert.match(sql, /role_table_grants/i);
  assert.doesNotMatch(sql, /\binsert\b|\bupdate\b|\bdelete\b|\bdrop\b|\btruncate\b|\balter\b|\brevoke\b|\bgrant\b/i);
});

test("vehicles API is cache-first and still exposes stale-while-revalidate headers", () => {
  const source = readFileSync(resolve(process.cwd(), "src", "app", "api", "vehicles", "route.ts"), "utf8");
  assert.match(source, /getSafePublishedVehicleCatalog/);
  assert.match(source, /payload\.brands/);
  assert.match(source, /stale-while-revalidate=300/);
  assert.match(source, /x-vehicle-source/);
});

test("public selector uses memory and session storage cache for vehicle options", () => {
  const helper = readFileSync(resolve(process.cwd(), "src", "lib", "vehicleControl", "clientCatalog.ts"), "utf8");
  const newRequest = readFileSync(resolve(process.cwd(), "src", "app", "new-request", "page.tsx"), "utf8");
  const homepage = readFileSync(resolve(process.cwd(), "src", "app", "page.tsx"), "utf8");
  assert.match(helper, /sessionStorage/);
  assert.match(helper, /memoryCache/);
  assert.match(newRequest, /fetchVehicleOptions/);
  assert.match(newRequest, /Loading vehicles/);
  assert.match(homepage, /fetchVehicleOptions/);
});

test("admin update path writes audit log entries", () => {
  const source = readFileSync(resolve(process.cwd(), "src", "lib", "vehicleControl", "admin.ts"), "utf8");
  assert.match(source, /vehicle_change_audit_log/);
  assert.match(source, /admin\.updated/);
  assert.match(source, /admin\.created/);
});

test("admin catalog is server-paginated and the editor manages ECU plus all three Stage profiles", () => {
  const adminSource = readFileSync(resolve(process.cwd(), "src", "lib", "vehicleControl", "admin.ts"), "utf8");
  const searchRoute = readFileSync(resolve(process.cwd(), "src", "app", "api", "admin", "vehicles", "search", "route.ts"), "utf8");
  const catalogUi = readFileSync(resolve(process.cwd(), "src", "app", "admin", "vehicles", "VehicleControlCenter.tsx"), "utf8");
  const detailUi = readFileSync(resolve(process.cwd(), "src", "app", "admin", "vehicles", "[id]", "VehicleDetailClient.tsx"), "utf8");

  assert.match(adminSource, /getVehicleAdminRecordPage/);
  assert.match(adminSource, /\.range\(from, to\)/);
  assert.match(adminSource, /gainHp: tunedHp != null && update\.stockHp != null \? tunedHp - update\.stockHp/);
  assert.match(adminSource, /\.eq\("id", update\.ecuVariantId\)\.eq\("engine_id", id\)/);
  assert.match(adminSource, /const hierarchyChanged =/);
  assert.match(adminSource, /generationRecordId/);
  assert.match(adminSource, /for \(const profile of nextPerformanceProfiles\)/);
  assert.match(adminSource, /const engineId = engine\.data\.id/);
  assert.match(adminSource, /await updateVehicleAdminRecord\(engineId, update, actorUserId, "admin\.created"\)/);
  assert.match(adminSource, /from\("vehicle_engines"\)\.delete\(\)\.eq\("id", engineId\)/);
  assert.match(adminSource, /catch \(error\)[\s\S]*await removeFailedDraft\(\)/);
  assert.match(adminSource, /if \(update\.services\)/);
  assert.match(searchRoute, /parseVehicleAdminListQuery/);
  assert.match(searchRoute, /Cache-Control": "no-store/);
  assert.match(catalogUi, /brand → model → generation → engine or ECU/);
  assert.match(catalogUi, /Advanced tools/);
  assert.match(catalogUi, /Loading matching vehicles/);
  assert.match(catalogUi, /No matching vehicles/);
  assert.match(detailUi, /vehiclePerformanceStages\.map/);
  assert.match(detailUi, /Stage 1–2–3/);
  assert.match(detailUi, /Primary ECU & gearbox/);
  assert.match(detailUi, /ecuVariantId: form\.ecuVariantId \|\| null/);
  assert.match(detailUi, /if \(profile\.active\) stageServices\.add\(profile\.stage\)/);
  assert.match(detailUi, /else stageServices\.delete\(profile\.stage\)/);
  assert.match(detailUi, /services: \[\.\.\.stageServices\]/);
  assert.match(detailUi, /aria-pressed/);
  assert.match(detailUi, /Unsaved changes/);
  assert.match(detailUi, /Try again/);
});

test("importer protects verified manual records and writes import audit events", () => {
  const source = readFileSync(resolve(process.cwd(), "src", "lib", "vehicleControl", "importer.ts"), "utf8");
  assert.match(source, /isProtectedManualVerified/);
  assert.match(source, /vehicle_brands"\)\.select\("id, verification_status, source_type"/);
  assert.match(source, /vehicle_models"\)\.select\("id, verification_status, source_type"/);
  assert.match(source, /vehicle_generations"\)\.select\("id, verification_status, source_type"/);
  assert.match(source, /import\.created/);
  assert.match(source, /import\.updated/);
  assert.match(source, /import\.error/);
});

test("real import UI requires explicit confirmation text", () => {
  const source = readFileSync(resolve(process.cwd(), "src", "app", "admin", "vehicles", "VehicleControlCenter.tsx"), "utf8");
  assert.match(source, /Type IMPORT/);
  assert.match(source, /importConfirm\.trim\(\) !== "IMPORT"/);
  assert.match(source, /Real import will import only valid unique records by default/);
  assert.match(source, /Valid importable/);
});

test("admin dashboard does not describe malformed authority as app-guard allowed", () => {
  const routeSource = readFileSync(resolve(process.cwd(), "src", "app", "api", "admin", "vehicles", "route.ts"), "utf8");
  const uiSource = readFileSync(resolve(process.cwd(), "src", "app", "admin", "vehicles", "VehicleControlCenter.tsx"), "utf8");
  assert.match(routeSource, /permissionWarnings/);
  assert.doesNotMatch(routeSource, /Primary admin access is allowed by the app guard/);
  assert.doesNotMatch(routeSource, /staffRole !== "owner"/);
  assert.match(uiSource, /permissionWarnings/);
});

test("verification SQL is read-only and checks tables, RLS, policies and counts", () => {
  const sql = readFileSync(resolve(process.cwd(), "scripts", "verify-vehicle-control-center.sql"), "utf8");
  assert.match(sql, /select[\s\S]*vehicle_brands/i);
  assert.match(sql, /relrowsecurity/i);
  assert.match(sql, /pg_policies/i);
  assert.match(sql, /has_staff_permission/i);
  assert.match(sql, /row_count/i);
  assert.doesNotMatch(sql, /\binsert\b|\bupdate\b|\bdelete\b|\bdrop\b|\btruncate\b|\balter\b/i);
});

test("production smoke script checks only public-safe endpoints by default", () => {
  const source = readFileSync(resolve(process.cwd(), "scripts", "smoke-vehicle-control-center.mjs"), "utf8");
  assert.match(source, /VEHICLE_SMOKE_BASE_URL/);
  assert.match(source, /smoke-url-guard\.mjs/);
  assert.match(source, /\/api\/vehicles\?type=brands/);
  assert.match(source, /\/new-request/);
  assert.match(source, /\/api\/admin\/vehicles/);
  assert.doesNotMatch(source, /Authorization|Bearer|access_token|SUPABASE_SERVICE_ROLE_KEY/);
});

test("public selector queries database as published-only and keeps JSON fallback", () => {
  const source = readFileSync(resolve(process.cwd(), "src", "lib", "vehicleControl", "public.ts"), "utf8");
  assert.match(source, /\.eq\("active", true\)/);
  assert.match(source, /\.eq\("published", true\)/);
  assert.match(source, /\.range\(from, to\)/);
  assert.match(source, /publicRowsFromJson/);
  assert.match(source, /customer_safe_notes/);
  assert.doesNotMatch(source, /admin_technical_notes|source_reference|confidence_score/);
});
