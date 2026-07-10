import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { buildVehicleEnrichmentPlan } from "../src/lib/vehicleEnrichment";
import { analyzeVehicleEnrichmentGaps } from "../src/lib/vehicleEnrichment/gapAnalysis";
import { normalizeEngineCandidate, parseDisplacementCcFromText, parseEngineCode, parseHorsepower, parseTorqueNm } from "../src/lib/vehicleEnrichment/normalizeEngine";
import { normalizeGenerationGroups } from "../src/lib/vehicleEnrichment/normalizeGeneration";
import { parseVehicleEnrichmentEntries } from "../src/lib/vehicleEnrichment/parseInput";
import { createStage1DraftEstimate } from "../src/lib/vehicleEnrichment/stageEstimate";
import type { ExternalVehicleEntry } from "../src/lib/vehicleEnrichment/types";
import type { VehicleControlRecord } from "../src/lib/vehicleControl/types";

const eClassEntries: ExternalVehicleEntry[] = [
  {
    brand: "Mercedes-Benz",
    model: "E-Class",
    rawTitle: "Mercedes-Benz E-class Long (V214), 2023-present",
    rawBodyType: "Long wheelbase",
    rawYearRange: "2023-present",
    engineDisplayName: "E 300 e",
    powerText: "Power: 204 HP",
    torqueText: "Torque: 320 Nm",
  },
  {
    brand: "Mercedes-Benz",
    model: "E-Class",
    rawTitle: "Mercedes-Benz E-class All-Terrain (S214), 2023-present",
    rawBodyType: "All-Terrain",
    rawYearRange: "2023-present",
    engineDisplayName: "E 300 d",
    powerText: "Power: 197 HP",
    torqueText: "Torque: 440 Nm",
  },
  {
    brand: "Mercedes-Benz",
    model: "E-Class",
    rawTitle: "Mercedes-Benz E-class T-modell (S214), 2023-present",
    rawBodyType: "Estate",
    rawYearRange: "2023-present",
    engineDisplayName: "E 200",
    powerText: "Power: 204 HP",
    torqueText: "Torque: 320 Nm",
  },
  {
    brand: "Mercedes-Benz",
    model: "E-Class",
    rawTitle: "Mercedes-Benz E-class (W214), 2023-present",
    rawBodyType: "Sedan",
    rawYearRange: "2023-present",
    engineDisplayName: "E 450 4MATIC",
    powerText: "Power: 381 HP",
    torqueText: "Torque: 500 Nm",
  },
  {
    brand: "Mercedes-Benz",
    model: "E-Class",
    rawTitle: "Mercedes-Benz E-class Coupe (C238, facelift 2020), 2020-2023",
    rawBodyType: "Coupe",
    rawYearRange: "2020-2023",
    engineDisplayName: "E 300 Coupe",
    powerText: "Power: 258 HP",
    torqueText: "Torque: 370 Nm",
  },
  {
    brand: "Mercedes-Benz",
    model: "E-Class",
    rawTitle: "Mercedes-Benz E-class Cabrio (A238, facelift 2020), 2020-2023",
    rawBodyType: "Cabrio",
    rawYearRange: "2020-2023",
    engineDisplayName: "E 300 Cabrio",
    powerText: "Power: 258 HP",
    torqueText: "Torque: 370 Nm",
  },
];

function existingRecord(overrides: Partial<VehicleControlRecord> = {}): VehicleControlRecord {
  return {
    id: "existing",
    brand: "Mercedes-Benz",
    brandId: null,
    model: "E-Class",
    modelId: null,
    generation: "W214/S214/V214 (2023-present)",
    generationId: null,
    engine: "E 300 d",
    engineId: null,
    vehicleKey: "mercedes-benz:e-class:w214-s214-v214-2023-present:e-300-d",
    displayName: "Mercedes-Benz E-Class W214/S214/V214 E 300 d",
    yearFrom: 2023,
    yearTo: null,
    faceliftLabel: null,
    isLci: false,
    fuelType: "Diesel",
    displacementCc: 1993,
    stockHp: 200,
    stockNm: 440,
    tunedHp: null,
    tunedNm: null,
    ecuFamily: null,
    ecuType: null,
    ecuHardware: null,
    ecuSoftware: null,
    ecuNotes: null,
    protectionNotes: null,
    unlockNotes: null,
    gearboxType: null,
    tcuType: null,
    tcuNotes: null,
    services: [],
    readMethods: [],
    customerSafeNotes: null,
    adminTechnicalNotes: null,
    sourceType: "manual",
    sourceReference: null,
    sourceUrl: null,
    confidenceScore: 90,
    verificationStatus: "verified",
    publishStatus: "published",
    active: true,
    published: true,
    ...overrides,
  };
}

test("vehicle enrichment groups W214/S214/V214 and excludes C238/A238 from the current E-Class group", () => {
  const { groups } = normalizeGenerationGroups(eClassEntries, { modernOnly: true, yearCutoff: 2020 });
  assert.equal(groups.length, 1);
  const group = groups[0];
  assert.equal(group.model, "E");
  assert.equal(group.customerDisplayLabel, "W214/S214/V214 (2023-present)");
  assert.deepEqual(group.platformCodes, ["W214", "S214", "V214"]);
  assert.equal(group.bodyVariants.some((variant) => variant.label === "W214 Sedan"), true);
  assert.equal(group.bodyVariants.some((variant) => variant.label === "S214 Estate / T-Modell"), true);
  assert.equal(group.bodyVariants.some((variant) => variant.label === "S214 All-Terrain"), true);
  assert.equal(group.bodyVariants.some((variant) => variant.label === "V214 Long wheelbase"), true);
  assert.equal(group.excludedEntries.some((item) => item.entry.rawTitle?.includes("C238")), true);
  assert.equal(group.excludedEntries.some((item) => item.entry.rawTitle?.includes("A238")), true);
});

test("vehicle enrichment modern-only scope skips old historical entries by default", () => {
  const plan = buildVehicleEnrichmentPlan({
    sourceType: "manual",
    entries: [{
      brand: "BMW",
      model: "3 Series",
      rawTitle: "BMW 3 Series (E46), 1998-2005",
      rawYearRange: "1998-2005",
      powerText: "Power: 150 HP",
    }],
  });
  assert.equal(plan.generationGroups.length, 0);
  assert.equal(plan.skippedOldEntries, 1);
  const override = buildVehicleEnrichmentPlan({
    sourceType: "manual",
    modernOnly: false,
    entries: [{
      brand: "BMW",
      model: "3 Series",
      rawTitle: "BMW 3 Series (E46), 1998-2005",
      rawYearRange: "1998-2005",
      powerText: "Power: 150 HP",
    }],
  });
  assert.equal(override.generationGroups.length, 1);
});

test("vehicle enrichment extracts HP, kW, torque, engine code and displacement from source text", () => {
  assert.deepEqual(parseHorsepower("Power: 612 HP @ 5750 rpm"), { hp: 612, kw: null });
  assert.deepEqual(parseHorsepower("Power: 150 kW"), { hp: 201, kw: 150 });
  assert.equal(parseTorqueNm("Torque: 850 Nm @ 2500 rpm"), 850);
  assert.equal(parseEngineCode("Engine Model/Code: M 177.980"), "M177.980");
  assert.equal(parseDisplacementCcFromText("Engine displacement: 3982 cm3"), 3982);
  assert.equal(parseDisplacementCcFromText("Engine displacement: 3.0 l"), 3000);
});

test("vehicle enrichment accepts structured CSV paste without crawling external sites", () => {
  const entries = parseVehicleEnrichmentEntries([
    "brand,model,title,bodyType,years,engine,power,torque,engineCode,displacement",
    "Mercedes-Benz,E-Class,\"Mercedes-Benz E-class (W214), 2023-present\",Sedan,2023-present,E 400 e,Power: 252 HP,Torque: 400 Nm,M254.920,1999 cm3",
  ].join("\n"));
  assert.equal(entries.length, 1);
  assert.equal(entries[0].brand, "Mercedes-Benz");
  assert.equal(entries[0].rawTitle?.includes("W214"), true);
  assert.equal(entries[0].engineCodeText, "M254.920");
});

test("vehicle enrichment creates only unverified low-confidence Stage 1 draft estimates", () => {
  const estimate = createStage1DraftEstimate(197, 440);
  assert.equal(estimate.stage1HpEstimate, 227);
  assert.equal(estimate.stage1NmEstimate, 506);
  assert.equal(estimate.estimateSource, "auto_estimate_15_percent");
  assert.equal(estimate.estimateConfidence, "low");
  assert.equal(estimate.needsReview, true);
  assert.equal(estimate.verified, false);
  assert.equal(JSON.stringify(estimate).includes("stage2"), false);
});

test("vehicle enrichment engine candidate keeps missing ECU type empty and needs review", () => {
  const { groups } = normalizeGenerationGroups(eClassEntries.slice(0, 1));
  const candidate = normalizeEngineCandidate({
    ...eClassEntries[0],
    engineCodeText: "Engine Model/Code: M 254.920",
    displacementText: "Engine displacement: 1999 cm3",
  }, groups[0]);
  assert.equal(candidate.engineCode, "M254.920");
  assert.equal(candidate.stockHp, 204);
  assert.equal(candidate.stockNm, 320);
  assert.equal(candidate.displacementCc, 1999);
  assert.equal(candidate.reviewStatus, "needs_review");
  assert.equal(candidate.services.includes("stage1"), true);
  assert.equal(Object.prototype.hasOwnProperty.call(candidate, "ecuType"), false);
});

test("vehicle enrichment gap analysis protects existing and manually verified data", () => {
  const plan = buildVehicleEnrichmentPlan({
    sourceType: "manual",
    entries: eClassEntries.slice(1, 2),
  }, [existingRecord({ stockHp: 199, verificationStatus: "verified", sourceType: "manual" })]);
  const gap = plan.gaps[0];
  assert.equal(gap.matchedExistingGeneration?.generation, "W214/S214/V214 (2023-present)");
  assert.equal(gap.matchedExistingEngine?.engine, "E 300 d");
  assert.equal(gap.protectedManualVerified, true);
  assert.equal(gap.suggestedAction, "create_diff_review");
  assert.equal(gap.conflictingValues.some((diff) => diff.diffType === "protected_manual_verified"), true);
});

test("vehicle enrichment compares E-Class candidates against existing E family records", () => {
  const plan = buildVehicleEnrichmentPlan({
    sourceType: "manual",
    entries: eClassEntries.slice(1, 2),
  }, [existingRecord({ model: "E", vehicleKey: "mercedes-benz:e:w214-s214-v214-2023-present:e-300-d" })]);
  const gap = plan.gaps[0];
  assert.equal(plan.generationGroups[0].model, "E");
  assert.equal(plan.engineCandidates[0].model, "E");
  assert.equal(gap.matchedExistingGeneration?.model, "E");
  assert.equal(gap.matchedExistingEngine?.engine, "E 300 d");
  assert.equal(gap.suggestedAction, "create_diff_review");
});

test("vehicle enrichment gap analysis suggests draft engine instead of duplicate when generation exists", () => {
  const { groups } = normalizeGenerationGroups(eClassEntries.slice(0, 1));
  const candidate = normalizeEngineCandidate(eClassEntries[0], groups[0]);
  const gaps = analyzeVehicleEnrichmentGaps(groups, [candidate], [existingRecord({ engine: "Different engine", stockHp: 100 })]);
  assert.equal(gaps[0].suggestedAction, "create_draft_engine");
  assert.equal(gaps[0].matchedExistingEngine, null);
});

test("vehicle enrichment SQL migration is additive, RLS protected and non-destructive", () => {
  const sql = readFileSync(resolve(process.cwd(), "scripts", "add-vehicle-enrichment-center.sql"), "utf8");
  for (const table of [
    "vehicle_external_sources",
    "vehicle_external_import_batches",
    "vehicle_external_entries",
    "vehicle_external_generation_groups",
    "vehicle_external_engine_candidates",
    "vehicle_external_diffs",
    "vehicle_external_review_events",
  ]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`, "i"));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
  assert.match(sql, /has_staff_permission/i);
  assert.match(sql, /vehicles\.manage/i);
  assert.doesNotMatch(sql, /\bdrop\s+table\b|\bdrop\s+column\b|\btruncate\b|\bdelete\s+from\b/i);
  assert.doesNotMatch(sql, /alter\s+table[\s\S]{0,80}drop/i);
});

test("vehicle enrichment admin APIs require vehicles.manage and do not broad crawl", () => {
  for (const file of [
    "src/app/api/admin/vehicles/enrichment/route.ts",
    "src/app/api/admin/vehicles/enrichment/normalize/route.ts",
    "src/app/api/admin/vehicles/enrichment/compare/route.ts",
    "src/app/api/admin/vehicles/enrichment/create-draft/route.ts",
    "src/app/api/admin/vehicles/enrichment/review/route.ts",
  ]) {
    const source = readFileSync(resolve(process.cwd(), file), "utf8");
    assert.match(source, /requireStaffPermission\(request,\s*"vehicles\.manage"\)/);
    assert.doesNotMatch(source, /fetch\(\s*body\.sourceUrl|fetch\(\s*sourceUrl|puppeteer|playwright/i);
  }
});

test("vehicle enrichment UI is linked and warns about draft/manual-assisted workflow", () => {
  const source = readFileSync(resolve(process.cwd(), "src", "app", "admin", "vehicles", "VehicleControlCenter.tsx"), "utf8");
  assert.match(source, /\/admin\/vehicles\/enrichment/);
  assert.match(source, /Manual-assisted enrichment/);
  assert.match(source, /does not crawl/);
  assert.match(source, /CREATE_DRAFT/);
  assert.match(source, /Stage 1 values are auto-estimated at \+15%/);
});
