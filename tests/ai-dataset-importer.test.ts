import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";
import { createDatasetDryRun, guessFileRole, labelsToTrainingRecord, suggestServiceLabelsFromText } from "../src/lib/aiFileIntelligence/datasetPairing";
import { stableDatasetId, type DatasetPairCandidate } from "../src/lib/aiFileIntelligence/datasetImport";
import { canApproveDatasetPairForLearning } from "../src/lib/aiFileIntelligence/datasetValidation";
import { negativeTrustWarning, type NegativeLearningExample } from "../src/lib/aiFileIntelligence/negativeExamples";
import { emptyTrainingServiceLabels } from "../src/lib/ecuIntelligence/types";

function readProjectFile(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

function pairFixture(overrides: Partial<DatasetPairCandidate> = {}): DatasetPairCandidate {
  return {
    id: "pair-1",
    batch_id: "batch-1",
    ori_candidate_id: "ori-1",
    mod_candidate_id: "mod-1",
    pair_confidence: 88,
    pairing_reasons: ["Same base name"],
    ecu_match_score: 80,
    file_size_relation: "same_size",
    sw_hw_match: true,
    service_label_guess: ["stage1"],
    changed_region_summary: { changed_regions: 2 },
    map_attribution_summary: {},
    quality_score: 82,
    quality_reasons: ["High confidence"],
    learning_recommendation: "approve_possible_after_review",
    review_status: "ready_for_human_label",
    actual_service_labels: labelsToTrainingRecord(["stage1"]),
    admin_notes: null,
    ...overrides,
  };
}

test("dataset importer guesses ORI/MOD roles and service labels from filenames", () => {
  assert.equal(guessFileRole("BMW_530d_original_read.bin"), "ori");
  assert.equal(guessFileRole("BMW_530d_Stage1_EGR_DPF_OFF.mod"), "mod");
  assert.equal(guessFileRole("notes.txt"), "unknown");
  assert.deepEqual(suggestServiceLabelsFromText("Stage1 EGR DPF OFF").sort(), ["dpf_off", "egr_off", "stage1"].sort());
  assert.deepEqual(suggestServiceLabelsFromText("DTC P0401 OFF"), ["dtc_off"]);
  assert.deepEqual(suggestServiceLabelsFromText("Vmax Launch Control"), ["vmax_off", "launch_control"]);
});

test("dataset dry-run pairs simple ORI/MOD files without mutating anything", () => {
  const result = createDatasetDryRun({
    sourceType: "manual_upload",
    files: [
      { folder: "BMW", filename: "BMW_530d_EDC17_ORI.bin", fileSize: 2048, providerMetadata: { sw_number: "SW1" } },
      { folder: "BMW", filename: "BMW_530d_EDC17_Stage1_MOD.bin", fileSize: 2048, providerMetadata: { sw_number: "SW1" } },
    ],
  });

  assert.equal(result.batch.dry_run, true);
  assert.equal(result.batch.total_files, 2);
  assert.equal(result.batch.candidate_pairs, 1);
  assert.equal(result.pairs[0].file_size_relation, "same_size");
  assert.ok(result.pairs[0].pair_confidence >= 70);
  assert.ok(result.pairs[0].service_label_guess.includes("stage1"));
});

test("dataset dry-run supports one ORI with multiple MOD service variants", () => {
  const result = createDatasetDryRun({
    files: [
      { folder: "BMW", filename: "BMW_530d_ORI.bin", fileSize: 2048 },
      { folder: "BMW", filename: "BMW_530d_Stage1_MOD.bin", fileSize: 2048 },
      { folder: "BMW", filename: "BMW_530d_EGR_OFF_MOD.bin", fileSize: 2048 },
    ],
  });

  assert.equal(result.pairs.length, 2);
  assert.ok(result.pairs.some((pair) => pair.service_label_guess.includes("stage1")));
  assert.ok(result.pairs.some((pair) => pair.service_label_guess.includes("egr_off")));
});

test("dataset dry-run reports unmatched, ambiguous and duplicate files", () => {
  const duplicate = stableDatasetId("fp", "duplicate");
  const result = createDatasetDryRun({
    files: [
      { folder: "dup", filename: "same_ORI.bin", fileSize: 1024, fingerprint: duplicate },
      { folder: "dup", filename: "same_copy_ORI.bin", fileSize: 1024, fingerprint: duplicate },
      { folder: "onlymod", filename: "Mercedes_DTC_OFF.mod", fileSize: 4096 },
      { folder: "misc", filename: "readme.txt", fileSize: 100 },
    ],
  });

  assert.equal(result.duplicate_files.length, 2);
  assert.equal(result.unmatched_mod.length, 1);
  assert.equal(result.unknown_files.length, 1);
  assert.ok(result.warnings.some((warning) => /Duplicate fingerprint/i.test(warning)));
});

test("dataset approval gate blocks missing actual labels, low quality, duplicate and known bad pairs", () => {
  const noLabels = canApproveDatasetPairForLearning(pairFixture({ actual_service_labels: emptyTrainingServiceLabels() }), {
    humanConfirmed: true,
    privacySafe: true,
    explicitApproval: true,
  });
  const lowQuality = canApproveDatasetPairForLearning(pairFixture({ quality_score: 40 }), {
    humanConfirmed: true,
    privacySafe: true,
    explicitApproval: true,
  });
  const duplicate = canApproveDatasetPairForLearning(pairFixture(), {
    humanConfirmed: true,
    privacySafe: true,
    explicitApproval: true,
    duplicate: true,
  });
  const allowed = canApproveDatasetPairForLearning(pairFixture(), {
    humanConfirmed: true,
    privacySafe: true,
    explicitApproval: true,
  });

  assert.equal(noLabels.allowed, false);
  assert.ok(noLabels.blockers.some((blocker) => /actual_service_labels/i.test(blocker)));
  assert.equal(lowQuality.allowed, false);
  assert.equal(duplicate.allowed, false);
  assert.equal(canApproveDatasetPairForLearning(pairFixture(), { humanConfirmed: true, privacySafe: true, explicitApproval: true, knownBad: true }).allowed, false);
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.target_learning_use_status, "approved_for_learning");
});

test("negative learning examples never become trusted positive evidence", () => {
  const examples: NegativeLearningExample[] = [{
    id: "bad-egr",
    negative_type: "wrong_service_label",
    service_labels: ["egr_off"],
    reason: "Provider label did not match actual changed regions.",
    human_confirmed: true,
    active: true,
  }];
  const warning = negativeTrustWarning(examples, { serviceLabels: ["egr_off"] });
  assert.equal(warning.has_warning, true);
  assert.ok(warning.trust_penalty > 0);
  assert.ok(warning.warnings[0].includes("wrong_service_label"));
});

test("dataset admin APIs reject anonymous users", async () => {
  const list = await import("../src/app/api/admin/ai/datasets/route");
  const dryRun = await import("../src/app/api/admin/ai/datasets/dry-run/route");
  assert.equal((await list.GET(new Request("http://localhost/api/admin/ai/datasets"))).status, 401);
  assert.equal((await dryRun.POST(new Request("http://localhost/api/admin/ai/datasets/dry-run", { method: "POST" }))).status, 401);
});

test("dataset importer UI is linked and documents dry-run safety", () => {
  const aiPage = readProjectFile("src", "app", "admin", "ai-training", "page.tsx");
  const datasetPage = readProjectFile("src", "app", "admin", "ai-training", "datasets", "page.tsx");
  assert.match(aiPage, /\/admin\/ai-training\/datasets/);
  assert.match(datasetPage, /Metadata dry-run only/);
  assert.match(datasetPage, /no training samples are approved/i);
});

test("dataset workbench SQL is additive, RLS-protected and non-destructive", () => {
  const sql = readProjectFile("scripts", "add-ai-dataset-import-workbench.sql");
  assert.match(sql, /create table if not exists public\.ai_dataset_import_batches/i);
  assert.match(sql, /create table if not exists public\.ai_dataset_file_candidates/i);
  assert.match(sql, /create table if not exists public\.ai_dataset_pair_candidates/i);
  assert.match(sql, /create table if not exists public\.ai_negative_learning_examples/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /has_staff_permission\('ai_training\.manage'\)/i);
  assert.doesNotMatch(sql, /\bdrop\b|\bdelete\s+from\b|\btruncate\b|drop\s+column/i);
});
