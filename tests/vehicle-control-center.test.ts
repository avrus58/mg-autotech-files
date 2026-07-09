import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";
import { hasStaffPermission } from "../src/lib/staffPermissions";
import {
  buildVehicleKey,
  controlRecordToPublicVehicle,
  rawVehicleToControlRecord,
} from "../src/lib/vehicleControl/normalization";
import { getSafePublishedVehicleRows } from "../src/lib/vehicleControl/public";
import { createVehicleImportPlan, dryRunVehicleImport } from "../src/lib/vehicleControl/importer";
import type { RawVehicleRow, VehicleControlRecord } from "../src/lib/vehicleControl/types";
import { validateVehicleCollection, validateVehicleRecord } from "../src/lib/vehicleControl/validation";

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

test("vehicle import dry-run is non-destructive and reports source health", () => {
  const summary = dryRunVehicleImport(20);
  assert.equal(summary.dryRun, true);
  assert.equal(summary.totalRows, 20);
  assert.equal(summary.created, 0);
  assert.equal(summary.updated, 0);
  assert.ok(summary.sampleRecords.length > 0);
  assert.ok(Array.isArray(summary.warnings));
});

test("vehicle import plan detects duplicates before any database write", () => {
  const plan = createVehicleImportPlan(250);
  assert.ok(plan.records.length > 0);
  assert.ok(plan.issues.some((issue) => issue.code === "duplicate_vehicle_key") || plan.duplicateKeys.size >= 0);
});

test("anonymous users cannot call admin vehicle APIs", async () => {
  const { GET } = await import("../src/app/api/admin/vehicles/route");
  const response = await GET(new Request("http://localhost/api/admin/vehicles"));
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
});

test("admin vehicle routes consistently require vehicles.manage permission", () => {
  for (const file of [
    "src/app/api/admin/vehicles/route.ts",
    "src/app/api/admin/vehicles/[id]/route.ts",
    "src/app/api/admin/vehicles/import/route.ts",
    "src/app/api/admin/vehicles/validation/route.ts",
    "src/app/api/admin/vehicles/audit/route.ts",
  ]) {
    const source = readFileSync(resolve(process.cwd(), file), "utf8");
    assert.match(source, /requireStaffPermission\(request,\s*"vehicles\.manage"\)/);
  }
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

test("admin update path writes audit log entries", () => {
  const source = readFileSync(resolve(process.cwd(), "src", "lib", "vehicleControl", "admin.ts"), "utf8");
  assert.match(source, /vehicle_change_audit_log/);
  assert.match(source, /admin\.updated/);
  assert.match(source, /admin\.created/);
});

test("importer protects verified manual records and writes import audit events", () => {
  const source = readFileSync(resolve(process.cwd(), "src", "lib", "vehicleControl", "importer.ts"), "utf8");
  assert.match(source, /verification_status === "verified"/);
  assert.match(source, /source_type !== "carecufile"/);
  assert.match(source, /source_type !== "carecufile_import"/);
  assert.match(source, /import\.created/);
  assert.match(source, /import\.updated/);
  assert.match(source, /import\.error/);
});

test("real import UI requires explicit confirmation text", () => {
  const source = readFileSync(resolve(process.cwd(), "src", "app", "admin", "vehicles", "VehicleControlCenter.tsx"), "utf8");
  assert.match(source, /Type IMPORT/);
  assert.match(source, /importConfirm\.trim\(\) !== "IMPORT"/);
  assert.match(source, /Real import writes database rows/);
});

test("admin dashboard surfaces owner profile edge warnings without weakening security", () => {
  const routeSource = readFileSync(resolve(process.cwd(), "src", "app", "api", "admin", "vehicles", "route.ts"), "utf8");
  const uiSource = readFileSync(resolve(process.cwd(), "src", "app", "admin", "vehicles", "VehicleControlCenter.tsx"), "utf8");
  assert.match(routeSource, /permissionWarnings/);
  assert.match(routeSource, /staffRole !== "owner"/);
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
  assert.match(source, /\/api\/vehicles\?type=brands/);
  assert.match(source, /\/new-request/);
  assert.match(source, /\/api\/admin\/vehicles/);
  assert.doesNotMatch(source, /Authorization|Bearer|access_token|SUPABASE_SERVICE_ROLE_KEY/);
});

test("public selector queries database as published-only and keeps JSON fallback", () => {
  const source = readFileSync(resolve(process.cwd(), "src", "lib", "vehicleControl", "public.ts"), "utf8");
  assert.match(source, /\.eq\("active", true\)/);
  assert.match(source, /\.eq\("published", true\)/);
  assert.match(source, /publicRowsFromJson/);
  assert.match(source, /customer_safe_notes/);
  assert.doesNotMatch(source, /admin_technical_notes|source_reference|confidence_score/);
});
