import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  classifyLearningPair,
  dtcCodesFromText,
  requestedLabelsForOrder,
  scoreLearningPair,
} from "../src/lib/ecuIntelligence/learningFlywheel";
import { emptyTrainingServiceLabels } from "../src/lib/ecuIntelligence/types";

const root = process.cwd();

function file(path: string) {
  return readFileSync(join(root, path), "utf8");
}

function fakeResult(overrides: Record<string, unknown> = {}) {
  return {
    comparison: {
      same_size: true,
      changed_bytes: 64,
      changed_percent: 0.04,
      raw_changed_blocks: 4,
      merged_changed_blocks: 2,
      changed_blocks: [],
    },
    change_profile: {
      classification: "focused_calibration",
      label: "Focused calibration changes",
      summary: "",
      confidence: 0.8,
      affected_area_percent: 0.04,
      changed_regions: 2,
    },
    summary: { stock_or_modified: "likely_modified", main_conclusion: "", recommended_next_steps: [] },
    integrity_assessment: {
      file_size_match: true,
      ecu_identity_match: true,
      vin_match: null,
      checksum_status: "not_checked",
      issues: [],
    },
    ecu_identification: {
      status: "detected",
      module_type: "ECU",
      supplier: "Bosch",
      family: "EDC17",
      variant: "EDC17C50",
      display_name: "Bosch EDC17C50",
      processor: null,
      confidence: 0.9,
      evidence: [],
      hardware_numbers: ["HW1"],
      software_numbers: ["SW1"],
      calibration_ids: ["CAL1"],
      vins: [],
      engine_codes: [],
    },
    risk_assessment: { risk_level: "medium", confidence: 0.8, reasons: [], warnings: [] },
    ...overrides,
  } as never;
}

test("learning flywheel migration is additive, RLS protected and metadata-only", () => {
  const sql = file("supabase/migrations/20260715195048_learning_flywheel_candidates.sql");
  assert.doesNotMatch(sql, /\bdrop\b|\bdelete\s+from\b|\btruncate\b|\bdrop\s+column\b/i);
  assert.match(sql, /create table if not exists public\.ai_learning_file_candidates/i);
  assert.match(sql, /create table if not exists public\.ai_learning_pair_candidates/i);
  assert.match(sql, /create table if not exists public\.ai_learning_review_events/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /has_staff_permission\('ai_training\.manage'\)/i);
  assert.doesNotMatch(sql, /firmware_bytes|raw_hex|hex_preview|signed_url/i);
  assert.match(sql, /learning_authorization_status text not null default 'not_granted'/i);
});

test("customer upload and desktop finalize create candidates without exposing private learning metadata", () => {
  const customerRoute = file("src/app/api/requests/[id]/learning-candidate/route.ts");
  const desktopFinalize = file("src/app/api/desktop/requests/finalize/route.ts");
  const newRequest = file("src/app/new-request/page.tsx");

  assert.match(customerRoute, /requireApiUser/i);
  assert.match(customerRoute, /order\.data\.customer_id !== auth\.user\.id/i);
  assert.match(customerRoute, /captureLearningFileCandidate/i);
  assert.doesNotMatch(customerRoute, /sha256|storage_path|file_expert|identity_conflicts/i);

  assert.match(desktopFinalize, /captureLearningFileCandidate/i);
  assert.match(desktopFinalize, /approvedForLearning:\s*false/i);
  assert.match(desktopFinalize, /rawHexReturned:\s*false/i);
  assert.match(desktopFinalize, /privateMetadataReturned:\s*false/i);

  assert.match(newRequest, /\/api\/requests\/\$\{String\(createdOrderId\)\}\/learning-candidate/);
});

test("delivery output creates ORI/MOD pair candidates instead of automatic training samples", () => {
  const route = file("src/app/api/admin/orders/[id]/complete-delivery/route.ts");
  assert.match(route, /captureLearningPairCandidate/i);
  assert.doesNotMatch(route, /maybeCreateTrainingSampleForRequest/i);
  assert.match(route, /createsTrainingSampleAutomatically:\s*false/i);
  assert.match(route, /approvedForLearningAutomatically:\s*false/i);
});

test("requested order labels include common customer service wording without confirming performed services", () => {
  const labels = requestedLabelsForOrder({
    service_type: "Stage 2 + DPF Removal + EGR Removal + DTC Removal",
    notes: "Codes P0401 and P2002 included by customer.",
  });
  assert.equal(labels.stage2, true);
  assert.equal(labels.dpf_off, true);
  assert.equal(labels.egr_off, true);
  assert.equal(labels.dtc_off, true);
  assert.equal(labels.stage1, false);
  assert.deepEqual(dtcCodesFromText("Please handle P0401, p2002 and U0100."), ["P0401", "P2002", "U0100"]);
});

test("pair classifier distinguishes single-service, multi-service, no-op, uncertain and already-modified source cases", () => {
  const stage1 = emptyTrainingServiceLabels();
  stage1.stage1 = true;
  assert.equal(classifyLearningPair({ result: fakeResult(), requestedLabels: stage1, sourceStockOrModified: "likely_stock" }).pairType, "single_service_clean");

  const multi = emptyTrainingServiceLabels();
  multi.stage1 = true;
  multi.dpf_off = true;
  assert.equal(classifyLearningPair({ result: fakeResult(), requestedLabels: multi, sourceStockOrModified: "likely_stock" }).pairType, "multi_service");

  const identical = fakeResult({
    comparison: { same_size: true, changed_bytes: 0, changed_percent: 0, raw_changed_blocks: 0, merged_changed_blocks: 0, changed_blocks: [] },
    change_profile: { classification: "identical", label: "", summary: "", confidence: 1, affected_area_percent: 0, changed_regions: 0 },
  });
  assert.equal(classifyLearningPair({ result: identical, requestedLabels: stage1, sourceStockOrModified: "likely_stock" }).pairType, "checksum_only_noop");

  assert.equal(classifyLearningPair({ result: fakeResult(), requestedLabels: stage1, sourceStockOrModified: "likely_modified" }).pairType, "already_modified_source");

  const conflict = fakeResult({ integrity_assessment: { file_size_match: false, ecu_identity_match: false, vin_match: null, checksum_status: "not_checked", issues: ["ORI and MOD file sizes differ."] } });
  assert.equal(classifyLearningPair({ result: conflict, requestedLabels: stage1, sourceStockOrModified: "likely_stock" }).pairType, "uncertain");
});

test("pair quality favors exact identity and clean service evidence but penalizes unsafe candidates", () => {
  const labels = emptyTrainingServiceLabels();
  labels.stage1 = true;
  const clean = scoreLearningPair({ result: fakeResult(), requestedLabels: labels, pairType: "single_service_clean" });
  const uncertain = scoreLearningPair({
    result: fakeResult({ integrity_assessment: { file_size_match: false, ecu_identity_match: false, vin_match: null, checksum_status: "not_checked", issues: ["identity mismatch"] } }),
    requestedLabels: labels,
    pairType: "uncertain",
  });
  assert.ok(clean.score >= 60);
  assert.ok(uncertain.score < clean.score);
});

test("admin learning corpus APIs are staff-only and do not create approved samples by default", () => {
  const listRoute = file("src/app/api/admin/ai/learning-corpus/route.ts");
  const backfillRoute = file("src/app/api/admin/ai/learning-corpus/backfill/route.ts");
  const pairRoute = file("src/app/api/admin/ai/learning-corpus/pairs/[pairId]/route.ts");

  for (const source of [listRoute, backfillRoute, pairRoute]) {
    assert.match(source, /requireStaffPermission\(request,\s*"ai_training\.manage"\)/);
  }
  assert.match(backfillRoute, /approvedLearningSamples:\s*0/i);
  assert.match(backfillRoute, /createsApprovedSamples:\s*false/i);
  assert.match(pairRoute, /createsTrainingSampleOnlyAfterGates:\s*true/i);
  assert.match(pairRoute, /autoApproved:\s*false/i);
});

test("learning flywheel code does not contain firmware generation or patch operations", () => {
  const source = file("src/lib/ecuIntelligence/learningFlywheel.ts");
  assert.doesNotMatch(source, /generate\s*mod|writeFirmware|checksumAdapter|patch\s*\(|pre-integrity artifact/i);
  assert.match(source, /approved_for_learning/);
  assert.match(source, /Explicit learning authorization must be granted/i);
});
