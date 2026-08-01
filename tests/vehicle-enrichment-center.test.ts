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
import { extractVehicleEntriesFromSource, fetchAndExtractVehicleUrl, validateVehicleSourceUrl } from "../src/lib/vehicleEnrichment/urlImport";
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

test("vehicle URL enrichment blocks unsafe SSRF targets before fetching", () => {
  for (const url of [
    "file:///etc/passwd",
    "http://localhost/vehicles",
    "http://127.0.0.1/vehicles",
    "http://10.0.0.1/vehicles",
    "http://172.16.1.4/vehicles",
    "http://192.168.1.2/vehicles",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]/vehicles",
    "http://[fe80::1]/vehicles",
    "http://[febf::1]/vehicles",
    "http://[::ffff:127.0.0.1]/vehicles",
    "http://[::ffff:10.0.0.1]/vehicles",
    "http://[0:0:0:0:0:ffff:7f00:1]/vehicles",
    "http://[0:0:0:0:0:ffff:a00:1]/vehicles",
    "http://[::ffff:c0a8:1]/vehicles",
    "http://192.0.2.1/vehicles",
    "http://198.18.0.1/vehicles",
    "http://198.51.100.1/vehicles",
    "http://203.0.113.1/vehicles",
    "ftp://example.com/vehicles.csv",
  ]) {
    assert.equal(validateVehicleSourceUrl(url).ok, false, url);
  }
  assert.equal(validateVehicleSourceUrl("https://example.com/vehicles").ok, true);
});

test("vehicle URL enrichment rejects redirects and requires the final exact URL", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response("", {
    status: 302,
    headers: { location: "https://example.com/final" },
  })) as typeof fetch;
  try {
    await assert.rejects(
      () => fetchAndExtractVehicleUrl({ sourceUrl: "http://93.184.216.34/redirect", sourceType: "html" }),
      /final public URL directly/i,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("vehicle URL enrichment parses simple HTML tables", () => {
  const extraction = extractVehicleEntriesFromSource({
    sourceUrl: "https://example.com/w214",
    sourceType: "html",
    contentType: "text/html",
    text: `
      <html><head><title>Mercedes W214 engines</title></head><body>
      <table>
        <tr><th>Brand</th><th>Model</th><th>Generation</th><th>Body</th><th>Years</th><th>Engine</th><th>Power</th><th>Torque</th><th>Displacement</th><th>Fuel</th></tr>
        <tr><td>Mercedes-Benz</td><td>E-Class</td><td>W 214</td><td>Sedan</td><td>2023-present</td><td>E 300 d</td><td>Power: 197 HP</td><td>Torque: 440 Nm</td><td>1993 cm3</td><td>Diesel</td></tr>
      </table></body></html>
    `,
  });
  assert.equal(extraction.title, "Mercedes W214 engines");
  assert.equal(extraction.detectedRows, 1);
  assert.equal(extraction.candidates.length, 1);
  assert.equal(extraction.candidates[0].brand, "Mercedes-Benz");
  assert.equal(extraction.candidates[0].model, "E-Class");
  assert.equal(extraction.candidates[0].rawGeneration, "W 214");
  assert.equal(extraction.confidence >= 70, true);
});

test("vehicle URL enrichment parses JSON lists and normalizes aliases through the existing plan", () => {
  const extraction = extractVehicleEntriesFromSource({
    sourceUrl: "https://example.com/vehicles.json",
    sourceType: "json",
    contentType: "application/json",
    text: JSON.stringify([
      {
        brand: "VW",
        model: "Tiguan",
        generation: "New generation",
        years: "2024-present",
        engine: "2.0 TSI",
        power: "Power: 265 HP",
        torque: "Torque: 400 Nm",
      },
      {
        brand: "Mercedes-Benz",
        model: "E-Class",
        generation: "E-Class W 214",
        years: "2023-present",
        engine: "E 300 d",
        power: "Power: 197 HP",
        torque: "Torque: 440 Nm",
      },
    ]),
  });
  assert.equal(extraction.candidates.length, 2);
  const plan = buildVehicleEnrichmentPlan({ sourceType: "url", sourceUrl: "https://example.com/vehicles.json", entries: extraction.candidates });
  assert.equal(plan.coverage.sourceMappings.some((item) => item.source.brand === "VW" && item.canonical.brand === "Volkswagen"), true);
  assert.equal(plan.coverage.sourceMappings.some((item) => item.source.model === "E-Class" && item.canonical.model === "E"), true);
  assert.equal(plan.generationGroups.some((group) => group.model === "E" && group.customerDisplayLabel.includes("W214")), true);
});

test("vehicle URL enrichment parses CSV endpoints", () => {
  const extraction = extractVehicleEntriesFromSource({
    sourceUrl: "https://example.com/vehicles.csv",
    sourceType: "csv",
    contentType: "text/csv",
    text: [
      "brand,model,generation,years,engine,power,torque,displacement,fuel",
      "Audi,A5,B10,2024-present,2.0 TDI,Power: 204 HP,Torque: 400 Nm,1968 cm3,Diesel",
    ].join("\n"),
  });
  assert.equal(extraction.candidates.length, 1);
  assert.equal(extraction.candidates[0].brand, "Audi");
  assert.equal(extraction.candidates[0].rawGeneration, "B10");
});

test("vehicle URL enrichment marks low-confidence extraction for review", () => {
  const extraction = extractVehicleEntriesFromSource({
    sourceUrl: "https://example.com/weak",
    sourceType: "text",
    contentType: "text/plain",
    text: "Unstructured modern car page with 197 HP and no usable model table",
  });
  assert.equal(extraction.confidence < 50, true);
  assert.equal(extraction.warnings.some((warning) => /No reliable|missing/i.test(warning)), true);
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

test("external coverage detects global missing vehicles beyond Mercedes examples", () => {
  const plan = buildVehicleEnrichmentPlan({
    sourceType: "json",
    sourceName: "Global legal reference export",
    entries: [
      {
        brand: "BMW",
        model: "5 Series",
        rawTitle: "BMW 5 Series Touring (G61), 2024-present",
        rawYearRange: "2024-present",
        engineDisplayName: "530e xDrive",
        powerText: "Power: 299 HP",
        torqueText: "Torque: 450 Nm",
        displacementText: "1998 cm3",
        fuelType: "Plug-in hybrid",
      },
      {
        brand: "VW",
        model: "Golf",
        rawTitle: "Volkswagen Golf 8.5, 2024-present",
        rawYearRange: "2024-present",
        engineDisplayName: "2.0 TSI GTI",
        powerText: "Power: 265 HP",
        torqueText: "Torque: 370 Nm",
        displacementText: "1984 cm3",
        fuelType: "Petrol",
      },
      {
        brand: "Audi",
        model: "A5",
        rawTitle: "Audi A5 (B10), 2024-present",
        rawYearRange: "2024-present",
        engineDisplayName: "2.0 TDI",
        powerText: "Power: 204 HP",
        torqueText: "Torque: 400 Nm",
        displacementText: "1968 cm3",
        fuelType: "Diesel",
      },
    ],
  }, [
    existingRecord({
      id: "bmw-old",
      brand: "BMW",
      model: "5 Series",
      generation: "G30/G31 (2017-2023)",
      engine: "530e",
      vehicleKey: "bmw:5-series:g30-g31-2017-2023:530e",
      verificationStatus: "verified",
      sourceType: "manual",
    }),
    existingRecord({
      id: "vw-golf-old",
      brand: "Volkswagen",
      model: "Golf",
      generation: "Golf 8 (2020-2023)",
      engine: "2.0 TSI GTI",
      vehicleKey: "volkswagen:golf:golf-8-2020-2023:2-0-tsi-gti",
      verificationStatus: "imported",
      sourceType: "carecufile_import",
    }),
  ]);

  assert.ok(plan.coverage.stats.missingBrands >= 1);
  assert.ok(plan.coverage.stats.missingGenerations >= 2);
  assert.ok(plan.coverage.stats.missingEngines >= 2);
  assert.equal(plan.coverage.aliasSuggestions.some((item) => item.entityType === "brand" && item.sourceName === "VW" && item.canonicalName === "Volkswagen"), true);
  assert.equal(plan.coverage.sourceMappings.some((item) => item.source.brand === "VW" && item.canonical.brand === "Volkswagen"), true);
  assert.equal(plan.coverage.issues.some((item) => item.type === "missing_generation" && item.brand === "BMW"), true);
  assert.equal(plan.coverage.issues.some((item) => item.type === "missing_engine" && item.brand === "Volkswagen"), true);
  assert.equal(plan.coverage.reviewQueue.every((item) => item.reviewStatus === "needs_review"), true);
});

test("external Mercedes W214 source maps through canonical E/W214 coverage instead of duplicate E-Class family", () => {
  const plan = buildVehicleEnrichmentPlan({
    sourceType: "manual",
    entries: eClassEntries.slice(0, 4),
  }, [existingRecord({ model: "E", generation: "W214/S214/V214 (2023-present)", engine: "Different engine" })]);

  assert.equal(plan.generationGroups[0].model, "E");
  assert.equal(plan.coverage.sourceMappings.some((item) => item.source.model === "E-Class" && item.canonical.model === "E"), true);
  assert.equal(plan.coverage.sourceMappings[0].canonical.model, "E");
  assert.equal(plan.coverage.sourceMappings[0].canonical.generation, "W214/S214/V214 (2023-present)");
  assert.equal(plan.coverage.sourceMappings[0].action, "create_draft");
  assert.equal(plan.coverage.aliasSuggestions.some((item) => item.entityType === "model" && item.sourceName === "E-Class"), true);
});

test("external coverage never auto-publishes and create-draft path stays unpublished needs-review", () => {
  const uiSource = readFileSync(resolve(process.cwd(), "src", "app", "admin", "vehicles", "VehicleControlCenter.tsx"), "utf8");
  const routeSource = readFileSync(resolve(process.cwd(), "src", "app", "api", "admin", "vehicles", "enrichment", "create-draft", "route.ts"), "utf8");
  assert.match(uiSource, /never auto-publishes|never auto-published|no auto-publish/i);
  assert.match(routeSource, /published:\s*false/);
  assert.match(routeSource, /verificationStatus:\s*"needs_review"/);
  assert.match(routeSource, /confirm !== "CREATE_DRAFT"/);
});

test("external coverage admin API is protected and dry-run only", async () => {
  const { POST } = await import("../src/app/api/admin/vehicles/coverage/route");
  const response = await POST(new Request("http://localhost/api/admin/vehicles/coverage", {
    method: "POST",
    body: JSON.stringify({ sourceType: "json", entries: [] }),
  }));
  assert.equal(response.status, 401);
  const source = readFileSync(resolve(process.cwd(), "src", "app", "api", "admin", "vehicles", "coverage", "route.ts"), "utf8");
  assert.match(source, /requireStaffPermission\(request,\s*"vehicles\.manage"\)/);
  assert.match(source, /dryRun:\s*true/);
  assert.match(source, /mutation:\s*false/);
  assert.doesNotMatch(source, /fetch\(\s*body\.sourceUrl|puppeteer|playwright/i);
});

test("vehicle URL enrichment API is admin-only, exact-URL and dry-run only", async () => {
  const { POST } = await import("../src/app/api/admin/vehicles/enrichment/fetch-url/route");
  const response = await POST(new Request("http://localhost/api/admin/vehicles/enrichment/fetch-url", {
    method: "POST",
    body: JSON.stringify({ sourceUrl: "https://example.com/vehicles", sourceType: "auto" }),
  }));
  assert.equal(response.status, 401);
  const source = readFileSync(resolve(process.cwd(), "src", "app", "api", "admin", "vehicles", "enrichment", "fetch-url", "route.ts"), "utf8");
  assert.match(source, /requireStaffPermission\(request,\s*"vehicles\.manage"\)/);
  assert.match(source, /dryRun:\s*true/);
  assert.match(source, /mutation:\s*false/);
  assert.match(source, /reviewStatus:\s*"needs_review"/);
  assert.match(source, /normalizedCandidates/);
  assert.match(source, /comparison/);
  assert.match(source, /Only import data you are allowed to use/);
  assert.doesNotMatch(source, /published:\s*true|create_draft|upsert|insert\(/i);
});

test("vehicle URL enrichment stays out of the public selector surface", () => {
  const publicRoute = readFileSync(resolve(process.cwd(), "src", "app", "api", "vehicles", "route.ts"), "utf8");
  assert.doesNotMatch(publicRoute, /vehicleEnrichment|fetch-url|sourceUrl|sourceReference|confidenceScore|validation metadata|import metadata/i);
  assert.match(publicRoute, /getSafePublishedVehicleCatalog/);
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
    "src/app/api/admin/vehicles/enrichment/fetch-url/route.ts",
    "src/app/api/admin/vehicles/coverage/route.ts",
    "src/app/api/admin/vehicles/enrichment/create-draft/route.ts",
    "src/app/api/admin/vehicles/enrichment/review/route.ts",
  ]) {
    const source = readFileSync(resolve(process.cwd(), file), "utf8");
    assert.match(source, /requireStaffPermission\(request,\s*"vehicles\.manage"\)/);
    assert.doesNotMatch(source, /puppeteer|playwright/i);
  }
});

test("vehicle enrichment UI is linked and warns about draft/manual-assisted workflow", () => {
  const source = readFileSync(resolve(process.cwd(), "src", "app", "admin", "vehicles", "VehicleControlCenter.tsx"), "utf8");
  assert.match(source, /\/admin\/vehicles\/enrichment/);
  assert.match(source, /\/admin\/vehicles\/coverage/);
  assert.match(source, /Coverage & Gap Import/);
  assert.match(source, /Manual-assisted enrichment/);
  assert.match(source, /does not crawl/);
  assert.match(source, /Source mode/);
  assert.match(source, /Paste JSON\/CSV/);
  assert.match(source, /Fetch from URL/);
  assert.match(source, /Fetch URL \+ Extract Vehicles/);
  assert.match(source, /Only import data you are allowed to use/);
  assert.match(source, /CREATE_DRAFT/);
  assert.match(source, /Stage 1 values are auto-estimated at \+15%/);
});
