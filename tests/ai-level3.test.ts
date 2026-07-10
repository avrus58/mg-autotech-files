import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";
import {
  attributeChangedRegion,
  attributeChangedRegionsToDefinitions,
} from "../src/lib/aiFileIntelligence/mapAttribution";
import { evaluateEvidenceTrust, evaluateLearningUsefulness } from "../src/lib/aiFileIntelligence/evidenceReadiness";
import { evaluateGenerationReadiness } from "../src/lib/aiFileIntelligence/generationReadiness";
import {
  customerSafeChangePlan,
  customerSafeGenerationReadiness,
  customerSafeMapAttributionSummary,
  hasCustomerPrivateAiLeak,
  stripCustomerPrivateKeys,
} from "../src/lib/aiFileIntelligence/safeProjection";
import {
  explainFileIntelligenceMatch,
  rankFileIntelligenceMatches,
  type FileIntelligenceMatchInput,
} from "../src/lib/aiFileIntelligence/similarityTrust";
import { buildSyntheticFixture } from "../src/lib/aiFileIntelligence/syntheticFixtures";
import { createLockedAIChangePlan } from "../src/lib/aiFileIntelligence/changePlan";
import type {
  MapAttributionSummary,
  MapDefinition,
  MapDefinitionSet,
} from "../src/lib/aiFileIntelligence/types";
import { emptyTrainingServiceLabels, type TrainingServiceLabels } from "../src/lib/ecuIntelligence/types";

function labels(...features: Array<keyof TrainingServiceLabels>) {
  const output = emptyTrainingServiceLabels();
  for (const feature of features) output[feature] = true;
  return output;
}

function definitionSet(overrides: Partial<MapDefinitionSet> = {}): MapDefinitionSet {
  return {
    id: "set-edc17-sw1",
    name: "Bosch EDC17C50 SW1 verified maps",
    ecu_family: "EDC17",
    ecu_type: "Bosch EDC17C50",
    sw_number: "SW 1037 550001",
    hw_number: "0281031234",
    vehicle_brand: "BMW",
    vehicle_model: "5 Series",
    engine: "530d",
    source_type: "manual",
    confidence_score: 85,
    human_verified: true,
    active: true,
    ...overrides,
  };
}

function definition(overrides: Partial<MapDefinition> = {}): MapDefinition {
  return {
    id: "map-torque-1",
    definition_set_id: "set-edc17-sw1",
    map_name: "Torque limiter 1",
    category: "torque_limiter",
    offset_start: 0x1000,
    offset_end: 0x10ff,
    rows: 16,
    cols: 16,
    data_type: "uint16",
    endian: "big",
    factor: 0.1,
    unit: "Nm",
    axis_x: null,
    axis_y: null,
    description: "Synthetic test definition",
    confidence_score: 85,
    human_verified: true,
    active: true,
    ...overrides,
  };
}

function attributedSummary(overrides: Partial<MapAttributionSummary> = {}): MapAttributionSummary {
  return {
    status: "attributed",
    definition_set_id: "set-edc17-sw1",
    exact_sw_match: true,
    attributed_regions: [],
    category_counts: { torque_limiter: 1 },
    unknown_region_count: 0,
    verified_match_count: 1,
    average_confidence: 86,
    map_definition_required: false,
    human_review_required: true,
    checksum_verification_required: true,
    ...overrides,
  };
}

type EvidenceSampleInput = NonNullable<Parameters<typeof evaluateEvidenceTrust>[0]["sample"]>;

function trustedSample(overrides: Partial<EvidenceSampleInput> = {}): EvidenceSampleInput {
  return {
    learning_use_status: "approved_for_learning" as const,
    human_verification_status: "confirmed" as const,
    data_quality_score: 92,
    requested_service_labels: labels("stage1"),
    performed_service_labels: labels("stage1"),
    pattern_signature: { main_regions: [{ start_offset_hex: "0x001000", end_offset_hex: "0x0010FF" }] } as unknown as EvidenceSampleInput["pattern_signature"],
    diff_json: { mode: "ori_mod_compare" } as unknown as EvidenceSampleInput["diff_json"],
    source_type: "completed_request" as const,
    source_metadata: null,
    ...overrides,
  };
}

function matchCandidate(id: string, overrides: Partial<FileIntelligenceMatchInput> = {}): FileIntelligenceMatchInput {
  return {
    id,
    ori_sha256: "a".repeat(64),
    file_size: 2_097_152,
    ecu_family: "EDC17",
    ecu_type: "Bosch EDC17C50",
    sw_number: "SW1037550001",
    hw_number: "0281031234",
    service_labels: labels("stage1"),
    pattern_region_keys: ["0x001000-0x0010FF"],
    learning_use_status: "approved_for_learning",
    human_verification_status: "confirmed",
    data_quality_score: 92,
    cluster_status: "strong",
    ...overrides,
  };
}

test("Level 3 attribution maps exact changed regions to verified map definitions", () => {
  const result = attributeChangedRegion({
    changed: { id: "changed-1", offset_start: 0x1020, offset_end: 0x1050 },
    definitionSet: definitionSet(),
    definitions: [definition()],
    exactSwMatch: true,
  });

  assert.equal(result.matched_map_definition_id, "map-torque-1");
  assert.equal(result.category, "torque_limiter");
  assert.equal(result.attribution_status, "matched_verified");
  assert.ok(result.overlap_ratio > 0.9);
  assert.ok(result.confidence >= 80);
});

test("Level 3 attribution calculates partial overlap conservatively", () => {
  const result = attributeChangedRegion({
    changed: { id: "changed-1", offset_start: 0x1080, offset_end: 0x1180 },
    definitionSet: definitionSet(),
    definitions: [definition()],
  });

  assert.equal(result.matched_map_definition_id, "map-torque-1");
  assert.equal(result.attribution_status, "partial_match");
  assert.ok(result.overlap_ratio > 0.4 && result.overlap_ratio < 0.6);
  assert.ok(result.warnings.some((warning) => /partial/i.test(warning)));
});

test("Level 3 attribution prefers exact SW context and ignores inactive maps", () => {
  const exact = definitionSet();
  const familyOnly = definitionSet({
    id: "set-family-only",
    name: "Family generic maps",
    sw_number: null,
    hw_number: null,
    human_verified: true,
  });
  const summary = attributeChangedRegionsToDefinitions({
    changedRegions: [{ id: "changed-1", offset_start: 0x1000, offset_end: 0x10ff }],
    definitionSets: [familyOnly, exact],
    definitions: [
      definition({ definition_set_id: "set-family-only", id: "generic-map" }),
      definition({ id: "inactive-map", active: false }),
      definition(),
    ],
    ecuFamily: "EDC17",
    ecuType: "Bosch EDC17C50",
    swNumber: "SW1037550001",
    hwNumber: "0281031234",
  });

  assert.equal(summary.definition_set_id, "set-edc17-sw1");
  assert.equal(summary.exact_sw_match, true);
  assert.equal(summary.attributed_regions[0].matched_map_definition_id, "map-torque-1");
});

test("Level 3 attribution returns no_definition_set when no safe map library exists", () => {
  const summary = attributeChangedRegionsToDefinitions({
    changedRegions: [{ id: "changed-1", offset_start: 0x1000, offset_end: 0x10ff }],
    definitionSets: [],
    definitions: [],
    ecuFamily: "EDC17",
  });

  assert.equal(summary.status, "no_definition_set");
  assert.equal(summary.map_definition_required, true);
  assert.equal(summary.attributed_regions[0].category, "unknown");
});

test("Level 3 evidence trust blocks pending, rejected, excluded and low-quality evidence", () => {
  const trusted = evaluateEvidenceTrust({
    sample: trustedSample(),
    similarityBestScore: 82,
    clusterStatus: "usable",
    mapAttribution: attributedSummary(),
  });
  const pending = evaluateEvidenceTrust({
    sample: trustedSample({ learning_use_status: "pending" }),
    clusterStatus: "usable",
    mapAttribution: attributedSummary(),
  });
  const rejected = evaluateEvidenceTrust({
    sample: trustedSample({ human_verification_status: "rejected" }),
    clusterStatus: "usable",
    mapAttribution: attributedSummary(),
  });
  const lowQuality = evaluateEvidenceTrust({
    sample: trustedSample({ data_quality_score: 40 }),
    clusterStatus: "usable",
    mapAttribution: attributedSummary(),
  });

  assert.equal(trusted.trusted, true);
  assert.ok(["trusted", "strong"].includes(trusted.trust_level));
  assert.equal(pending.trusted, false);
  assert.ok(pending.blocked_reasons.includes("no_trusted_samples"));
  assert.equal(rejected.trusted, false);
  assert.ok(rejected.blocked_reasons.includes("no_human_confirmed_samples"));
  assert.equal(lowQuality.trusted, false);
  assert.ok(lowQuality.blocked_reasons.includes("insufficient_quality"));
});

test("Level 3 learning usefulness explains missing actual labels and map definitions", () => {
  const missingLabels = evaluateLearningUsefulness({
    sample: trustedSample({ performed_service_labels: emptyTrainingServiceLabels() }),
    clusterStatus: "usable",
    mapDefinitionStatus: "available",
  });
  const useful = evaluateLearningUsefulness({
    sample: trustedSample(),
    clusterStatus: "usable",
    mapDefinitionStatus: "available",
  });

  assert.equal(missingLabels.usable_for_learning, false);
  assert.equal(missingLabels.recommended_admin_action, "confirm_actual_service_labels");
  assert.equal(useful.usable_for_learning, true);
  assert.equal(useful.recommended_admin_action, "approve_for_learning");
});

test("Level 3 similarity trust ranks exact file matches above related evidence and flags untrusted samples", () => {
  const source = matchCandidate("source");
  const exact = matchCandidate("exact");
  const related = matchCandidate("related", {
    ori_sha256: "b".repeat(64),
    sw_number: "SW999",
    pattern_region_keys: ["0x002000-0x0020FF"],
  });
  const pending = matchCandidate("pending", { learning_use_status: "pending" });
  const ranked = rankFileIntelligenceMatches(source, [related, pending, exact]);
  const untrusted = explainFileIntelligenceMatch(source, pending);

  assert.equal(ranked[0].candidate_id, "exact");
  assert.equal(ranked[0].category, "exact_file_match");
  assert.equal(untrusted.category, "not_trusted");
  assert.equal(untrusted.trusted, false);
  assert.ok(untrusted.warnings.some((warning) => /not approved/i.test(warning)));
});

test("Level 3 generation readiness never enables export and lists missing gates", () => {
  const trusted = evaluateEvidenceTrust({
    sample: trustedSample(),
    similarityBestScore: 90,
    clusterStatus: "strong",
    mapAttribution: attributedSummary(),
  });
  const report = evaluateGenerationReadiness({
    evidence: trusted,
    mapAttribution: attributedSummary(),
    ecuIdentified: true,
    swOrHwIdentified: true,
    actualLabelsConfirmed: true,
    clusterStatus: "strong",
    humanReviewWorkflowReady: true,
    checksumWorkflowAvailable: true,
  });
  const blocked = evaluateGenerationReadiness({
    evidence: trusted,
    mapAttribution: null,
    ecuIdentified: false,
    actualLabelsConfirmed: false,
    clusterStatus: "none",
  });

  assert.equal(report.export_allowed, false);
  assert.equal(report.customer_visible, false);
  assert.ok(report.blocked_reasons.includes("output_export_disabled"));
  assert.equal(blocked.export_allowed, false);
  assert.ok(blocked.blocked_reasons.includes("no_map_definitions"));
  assert.ok(blocked.blocked_reasons.includes("actual_service_labels_missing"));
});

test("Level 3 synthetic fixtures are deterministic, harmless and attributable", () => {
  const first = buildSyntheticFixture("stage1_like");
  const second = buildSyntheticFixture("stage1_like");
  const summary = attributeChangedRegionsToDefinitions({
    changedRegions: first.changed_regions,
    definitionSets: [first.definition_set],
    definitions: first.map_definitions,
    ecuFamily: first.ecu_family,
    ecuType: first.ecu_type,
    swNumber: first.sw_number,
    hwNumber: first.hw_number,
  });

  assert.deepEqual(first.ori, second.ori);
  assert.deepEqual(first.mod, second.mod);
  assert.equal(first.safe_fake_binary, true);
  assert.equal(first.not_flashable, true);
  assert.match(first.summary, /not a real ECU file/i);
  assert.ok(summary.verified_match_count >= 2);
  assert.equal(summary.map_definition_required, false);
});

test("Level 3 customer-safe projections hide private AI/map/generation internals", () => {
  const attribution = attributedSummary({
    attributed_regions: [{
      changed_region_id: "private-sample-id",
      offset_start: 0x1000,
      offset_end: 0x10ff,
      size: 256,
      matched_map_definition_id: "private-map-id",
      map_name: "Torque limiter private",
      category: "torque_limiter",
      overlap_ratio: 1,
      confidence: 99,
      human_verified: true,
      attribution_status: "matched_verified",
      warnings: ["private offset 0x1000"],
      alternatives: [],
    }],
  });
  const evidence = evaluateEvidenceTrust({
      sample: trustedSample(),
      similarityBestScore: 90,
      clusterStatus: "strong",
      mapAttribution: attribution,
    });
  const readiness = evaluateGenerationReadiness({
    evidence,
    mapAttribution: attribution,
    ecuIdentified: true,
    swOrHwIdentified: true,
    actualLabelsConfirmed: true,
    clusterStatus: "strong",
    humanReviewWorkflowReady: true,
    checksumWorkflowAvailable: false,
  });
  const plan = createLockedAIChangePlan({
    jobId: "private-job",
    serviceLabels: ["stage1"],
    evidence,
    readiness,
    mapAttribution: attribution,
  });
  const serialized = JSON.stringify({
    attribution: customerSafeMapAttributionSummary(attribution),
    readiness: customerSafeGenerationReadiness(readiness),
    plan: customerSafeChangePlan(plan),
    stripped: stripCustomerPrivateKeys({
      admin_notes: "secret",
      source_reference: "private",
      confidence_score: 99,
      offset_start: 0x1000,
      safe: "visible",
    }),
  });

  assert.equal(hasCustomerPrivateAiLeak(JSON.parse(serialized)), false);
  assert.equal(serialized.includes("private-sample-id"), false);
  assert.equal(serialized.includes("private-map-id"), false);
  assert.equal(serialized.includes("0x1000"), false);
  assert.equal(serialized.includes("private-provider"), false);
  assert.equal(serialized.includes("storage_path"), false);
  assert.equal(serialized.includes("admin_notes"), false);
  assert.equal(serialized.includes("confidence_score"), false);
  assert.equal(serialized.includes("visible"), true);
});

test("Level 3 map definition API rejects unauthenticated access", async () => {
  const { GET } = await import("../src/app/api/admin/ai-training/map-definitions/route");
  const response = await GET(new Request("http://localhost/api/admin/ai-training/map-definitions"));
  assert.equal(response.status, 401);
});

test("Level 3 SQL migration is additive, RLS-protected and export-locked", () => {
  const sql = readFileSync(resolve(process.cwd(), "scripts", "add-ai-level3-map-definitions.sql"), "utf8");
  assert.match(sql, /create table if not exists public\.ai_map_definition_sets/i);
  assert.match(sql, /create table if not exists public\.ai_map_definitions/i);
  assert.match(sql, /create table if not exists public\.ai_map_attribution_results/i);
  assert.match(sql, /create table if not exists public\.ai_generation_readiness_reports/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /has_staff_permission\('ai_training\.manage'\)/i);
  assert.match(sql, /check \(export_allowed = false\)/i);
  assert.match(sql, /safe_fake_binary = true/i);
  assert.doesNotMatch(sql, /\bdrop\b|\bdelete\s+from\b|\btruncate\b|drop\s+column/i);
});
