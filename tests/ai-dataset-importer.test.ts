import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createDatasetDryRun, guessFileRole, labelsToTrainingRecord, suggestServiceLabelsFromText } from "../src/lib/aiFileIntelligence/datasetPairing";
import { stableDatasetId, type DatasetPairCandidate } from "../src/lib/aiFileIntelligence/datasetImport";
import { createDatasetDryRunFromScannerRows, parseScannerJsonl, scannerRowToDescriptor, summarizeScannerRows } from "../src/lib/aiFileIntelligence/datasetScanMetadata";
import { canApproveDatasetPairForLearning } from "../src/lib/aiFileIntelligence/datasetValidation";
import { evaluateStage1Readiness } from "../src/lib/aiFileIntelligence/stage1Readiness";
import { createLowDataStage1Plan } from "../src/lib/aiCalibration/lowDataStage1Plan";
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

test("local dataset scanner writes metadata-only JSONL and real size summary", () => {
  const root = join(tmpdir(), `mg-dataset-scan-${Date.now()}`);
  const out = join(root, "out", "scan.jsonl");
  mkdirSync(join(root, "BMW"), { recursive: true });
  writeFileSync(join(root, "BMW", "BMW_530d_ORI.bin"), Buffer.from([1, 2, 3, 4]));
  writeFileSync(join(root, "BMW", "BMW_530d_Stage1_MOD.bin"), Buffer.from([1, 2, 8, 4]));
  writeFileSync(join(root, "BMW", "duplicate_copy.mod"), Buffer.from([1, 2, 8, 4]));
  writeFileSync(join(root, "BMW", "archive.zip"), Buffer.from([9, 9, 9]));
  try {
    execFileSync(process.execPath, ["scripts/scan-ai-dataset.mjs", "--root", root, "--out", out, "--extensions", ".bin,.mod,.zip"], { cwd: process.cwd(), stdio: "pipe" });
    const jsonl = readFileSync(out, "utf8").trim().split(/\r?\n/).map((line) => JSON.parse(line));
    const summary = JSON.parse(readFileSync(out.replace(/\.jsonl$/, ".summary.json"), "utf8"));
    assert.equal(jsonl.length, 4);
    assert.equal(summary.total_files, 4);
    assert.equal(summary.scanned_entries, 4);
    assert.equal(summary.total_size_bytes, 15);
    assert.equal(summary.archive_candidates, 1);
    assert.equal(summary.duplicate_files, 2);
    assert.ok(jsonl.some((row) => row.guessed_file_role === "ori"));
    assert.ok(jsonl.some((row) => row.guessed_service_labels.includes("stage1")));
    assert.ok(jsonl.some((row) => row.duplicate_hash_group));
    assert.equal(JSON.stringify(jsonl).includes("01020304"), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("synthetic dataset fixture generator creates harmless scanner-ready files", () => {
  const root = join(tmpdir(), `mg-dataset-fixture-${Date.now()}`);
  try {
    const output = execFileSync(process.execPath, ["scripts/create-ai-dataset-fixture.mjs", "--out", root, "--clean"], { cwd: process.cwd(), encoding: "utf8" });
    const manifest = JSON.parse(readFileSync(join(root, "fixture-manifest.json"), "utf8"));
    assert.equal(manifest.safe_fake_binary, true);
    assert.equal(manifest.not_flashable, true);
    assert.equal(manifest.raw_customer_data, false);
    assert.match(output, /safe_fake_binary/);

    const scanOut = join(root, "scan.jsonl");
    execFileSync(process.execPath, ["scripts/scan-ai-dataset.mjs", "--root", root, "--out", scanOut], { cwd: process.cwd(), stdio: "pipe" });
    const summary = JSON.parse(readFileSync(scanOut.replace(/\.jsonl$/, ".summary.json"), "utf8"));
    assert.ok(summary.total_files >= 8);
    assert.ok(summary.duplicate_files >= 2);
    assert.ok(summary.archive_candidates >= 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("offline pair analyzer outputs changed-region metadata without raw bytes or MOD output", () => {
  const root = join(tmpdir(), `mg-pair-analysis-${Date.now()}`);
  const scanOut = join(root, "scan.jsonl");
  const analysisOut = join(root, "analysis.jsonl");
  try {
    execFileSync(process.execPath, ["scripts/create-ai-dataset-fixture.mjs", "--out", root, "--clean"], { cwd: process.cwd(), stdio: "pipe" });
    execFileSync(process.execPath, ["scripts/scan-ai-dataset.mjs", "--root", root, "--out", scanOut], { cwd: process.cwd(), stdio: "pipe" });
    execFileSync(process.execPath, ["scripts/analyze-ecu-pairs.mjs", "--root", root, "--scan", scanOut, "--out", analysisOut, "--limit", "10", "--merge-distance", "8", "--max-regions", "20"], { cwd: process.cwd(), stdio: "pipe" });
    const rows = readFileSync(analysisOut, "utf8").trim().split(/\r?\n/).map((line) => JSON.parse(line));
    assert.equal(rows.length, 2);
    assert.ok(rows.every((row) => row.changed_byte_count > 0));
    assert.ok(rows.every((row) => row.changed_region_count >= 1));
    assert.ok(rows.every((row) => row.raw_bytes_included === false));
    assert.ok(rows.every((row) => row.hex_included === false));
    assert.ok(rows.every((row) => row.mod_generation === false));
    assert.ok(rows.some((row) => row.guessed_service_labels.includes("stage1")));
    assert.equal(JSON.stringify(rows).includes("01020304"), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("offline pair analyzer detects identical, tiny diff and huge diff safely", () => {
  const root = join(tmpdir(), `mg-pair-warnings-${Date.now()}`);
  const scanOut = join(root, "scan.jsonl");
  const analysisOut = join(root, "analysis.jsonl");
  mkdirSync(join(root, "same"), { recursive: true });
  mkdirSync(join(root, "tiny"), { recursive: true });
  mkdirSync(join(root, "huge"), { recursive: true });
  writeFileSync(join(root, "same", "A_ORI.bin"), Buffer.alloc(4096, 1));
  writeFileSync(join(root, "same", "A_STAGE1_MOD.bin"), Buffer.alloc(4096, 1));
  const tinyOri = Buffer.alloc(4096, 2);
  const tinyMod = Buffer.from(tinyOri);
  tinyMod[2000] = 3;
  writeFileSync(join(root, "tiny", "B_ORI.bin"), tinyOri);
  writeFileSync(join(root, "tiny", "B_STAGE1_MOD.bin"), tinyMod);
  writeFileSync(join(root, "huge", "C_ORI.bin"), Buffer.alloc(1024, 4));
  writeFileSync(join(root, "huge", "C_STAGE1_MOD.bin"), Buffer.alloc(1024, 8));
  try {
    execFileSync(process.execPath, ["scripts/scan-ai-dataset.mjs", "--root", root, "--out", scanOut, "--extensions", ".bin"], { cwd: process.cwd(), stdio: "pipe" });
    execFileSync(process.execPath, ["scripts/analyze-ecu-pairs.mjs", "--root", root, "--scan", scanOut, "--out", analysisOut, "--limit", "10"], { cwd: process.cwd(), stdio: "pipe" });
    const rows = readFileSync(analysisOut, "utf8").trim().split(/\r?\n/).map((line) => JSON.parse(line));
    assert.ok(rows.some((row) => row.warnings.includes("identical_files")));
    assert.ok(rows.some((row) => row.warnings.includes("suspicious_tiny_diff")));
    assert.ok(rows.some((row) => row.warnings.includes("suspicious_huge_diff")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("dataset evaluation report summarizes quality bands and recommended actions", () => {
  const root = join(tmpdir(), `mg-dataset-eval-${Date.now()}`);
  const scanOut = join(root, "scan.jsonl");
  const analysisOut = join(root, "analysis.jsonl");
  const reportOut = join(root, "report.json");
  const mdOut = join(root, "report.md");
  try {
    execFileSync(process.execPath, ["scripts/create-ai-dataset-fixture.mjs", "--out", root, "--clean"], { cwd: process.cwd(), stdio: "pipe" });
    execFileSync(process.execPath, ["scripts/scan-ai-dataset.mjs", "--root", root, "--out", scanOut], { cwd: process.cwd(), stdio: "pipe" });
    execFileSync(process.execPath, ["scripts/analyze-ecu-pairs.mjs", "--root", root, "--scan", scanOut, "--out", analysisOut], { cwd: process.cwd(), stdio: "pipe" });
    execFileSync(process.execPath, ["scripts/evaluate-ai-dataset.mjs", "--scan", scanOut, "--analysis", analysisOut, "--out", reportOut, "--md", mdOut], { cwd: process.cwd(), stdio: "pipe" });
    const report = JSON.parse(readFileSync(reportOut, "utf8"));
    const md = readFileSync(mdOut, "utf8");
    assert.equal(report.raw_binary_included, false);
    assert.equal(report.hex_included, false);
    assert.equal(report.mod_generation, false);
    assert.ok(report.total_scanned_files >= 8);
    assert.ok(report.analyzed_pair_count >= 2);
    assert.ok(report.stage1_usable_candidate_count >= 1);
    assert.match(md, /No MOD generation is performed/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("scanner JSONL parser creates safe descriptors without raw paths or binary payloads", () => {
  const jsonl = [
    JSON.stringify({
      relative_path: "Provider/BMW/BMW_530d_ORI.bin",
      filename: "BMW_530d_ORI.bin",
      extension: "bin",
      file_size: 2048,
      sha256: "a".repeat(64),
      quick_hash: "q1",
      guessed_file_role: "ori",
      guessed_service_labels: [],
      guessed_ecu_family: "EDC17",
    }),
    JSON.stringify({
      relative_path: "Provider/BMW/BMW_530d_Stage1_MOD.bin",
      filename: "BMW_530d_Stage1_MOD.bin",
      extension: "bin",
      file_size: 2048,
      sha256: "b".repeat(64),
      quick_hash: "q2",
      guessed_file_role: "mod",
      guessed_service_labels: ["stage1"],
      duplicate_hash_group: "dup-00001",
    }),
  ].join("\n");
  const parsed = parseScannerJsonl(jsonl);
  assert.equal(parsed.rejected_lines.length, 0);
  assert.equal(parsed.rows.length, 2);
  const descriptor = scannerRowToDescriptor(parsed.rows[0]);
  assert.equal(descriptor.fingerprint, "a".repeat(64));
  assert.equal(descriptor.providerMetadata?.raw_binary_uploaded, false);
  assert.equal(descriptor.providerMetadata?.supabase_storage_used, false);
  assert.equal(JSON.stringify(descriptor).includes("C:\\"), false);
  const summary = summarizeScannerRows(parsed.rows);
  assert.equal(summary.total_files, 2);
  assert.equal(summary.total_size_bytes, 4096);
  assert.equal(summary.duplicate_files, 1);
});

test("scanner metadata dry-run produces ORI/MOD pair candidates without auto approval", () => {
  const rows = parseScannerJsonl([
    JSON.stringify({ relative_path: "BMW/BMW_530d_ORI.bin", filename: "BMW_530d_ORI.bin", extension: "bin", file_size: 4096, sha256: "1".repeat(64), guessed_file_role: "ori", guessed_ecu_type: "EDC17C50", guessed_sw_number: "SW1" }),
    JSON.stringify({ relative_path: "BMW/BMW_530d_Stage1_MOD.bin", filename: "BMW_530d_Stage1_MOD.bin", extension: "bin", file_size: 4096, sha256: "2".repeat(64), guessed_file_role: "mod", guessed_service_labels: ["stage1"], guessed_ecu_type: "EDC17C50", guessed_sw_number: "SW1" }),
  ].join("\n")).rows;
  const result = createDatasetDryRunFromScannerRows({ rows });
  assert.equal(result.batch.total_files, 2);
  assert.equal(result.pairs.length, 1);
  assert.equal(result.pairs[0].review_status, "auto_pair_suggested");
  assert.notEqual(result.pairs[0].review_status, "approved_for_learning");
  assert.equal(result.scanner_summary.total_size_bytes, 8192);
});

test("archive candidates are recorded as metadata but not paired as ORI/MOD evidence", () => {
  const rows = parseScannerJsonl([
    JSON.stringify({ relative_path: "Archive/BMW_ORI.zip", filename: "BMW_ORI.zip", extension: "zip", file_size: 100, sha256: "a".repeat(64), guessed_file_role: "ori", archive_candidate: true }),
    JSON.stringify({ relative_path: "Archive/BMW_STAGE1_MOD.zip", filename: "BMW_STAGE1_MOD.zip", extension: "zip", file_size: 100, sha256: "b".repeat(64), guessed_file_role: "mod", guessed_service_labels: ["stage1"], archive_candidate: true }),
  ].join("\n")).rows;
  const result = createDatasetDryRunFromScannerRows({ rows });
  assert.equal(result.scanner_summary.archive_candidates, 2);
  assert.equal(result.pairs.length, 0);
  assert.ok(result.warnings.some((warning) => /Archive candidate/i.test(warning)));
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
  const metadataImport = await import("../src/app/api/admin/ai/datasets/import/route");
  const pairReview = await import("../src/app/api/admin/ai/datasets/pairs/[pairId]/route");
  const detail = await import("../src/app/api/admin/ai/datasets/[id]/route");
  assert.equal((await list.GET(new Request("http://localhost/api/admin/ai/datasets"))).status, 401);
  assert.equal((await dryRun.POST(new Request("http://localhost/api/admin/ai/datasets/dry-run", { method: "POST" }))).status, 401);
  assert.equal((await metadataImport.POST(new Request("http://localhost/api/admin/ai/datasets/import", { method: "POST" }))).status, 401);
  assert.equal((await pairReview.PATCH(new Request("http://localhost/api/admin/ai/datasets/pairs/id", { method: "PATCH", body: "{}" }), { params: Promise.resolve({ pairId: "id" }) })).status, 401);
  assert.equal((await detail.GET(new Request("http://localhost/api/admin/ai/datasets/id"), { params: Promise.resolve({ id: "id" }) })).status, 401);
});

test("Stage 1 readiness stays evidence-only and reports missing gates", () => {
  const none = evaluateStage1Readiness([]);
  assert.equal(none[0].readiness, "no_evidence");
  assert.ok(none[0].missing_items.includes("map definitions"));
  const usable = evaluateStage1Readiness([
    { ecu_family: "EDC17", ecu_type: "EDC17C50", sw_number: "SW1", service_labels: ["stage1"], quality_score: 82, confidence: 80, warnings: [], actual_service_labels_confirmed: true, map_definitions_available: true },
    { ecu_family: "EDC17", ecu_type: "EDC17C50", sw_number: "SW1", service_labels: ["stage1"], quality_score: 78, confidence: 75, warnings: [], actual_service_labels_confirmed: true, map_definitions_available: true },
    { ecu_family: "EDC17", ecu_type: "EDC17C50", sw_number: "SW1", service_labels: ["stage1"], quality_score: 76, confidence: 74, warnings: [], actual_service_labels_confirmed: true, map_definitions_available: true },
  ]);
  assert.equal(usable[0].readiness, "usable");
  assert.equal(usable[0].high_quality_stage1_pair_count, 3);
});

test("low-data calibration assistant is advisory-only and blocks unknown ECU mode", () => {
  const unknown = createLowDataStage1Plan({ fuelType: "diesel", induction: "turbo" });
  assert.equal(unknown.advisory_only, true);
  assert.equal(unknown.mod_generation, false);
  assert.equal(unknown.checksum_correction, false);
  assert.equal(unknown.readiness, "blocked");
  assert.ok(unknown.missing_evidence.includes("ECU family/type identification"));
  assert.ok(unknown.risk_warnings.some((warning) => /never outputs byte patches/i.test(warning)));

  const diesel = createLowDataStage1Plan({ ecuFamily: "EDC17", ecuType: "EDC17C50", swNumber: "SW1", fuelType: "diesel", induction: "turbo", evidenceCount: 4, highQualityEvidenceCount: 3, mapDefinitionsAvailable: true });
  assert.equal(diesel.readiness, "evidence_supported_review");
  assert.ok(diesel.likely_calibration_areas.includes("smoke limiter"));
});

test("dataset APIs are staff-only and do not expose metadata through public/customer routes", () => {
  const routes = [
    readProjectFile("src", "app", "api", "admin", "ai", "datasets", "route.ts"),
    readProjectFile("src", "app", "api", "admin", "ai", "datasets", "[id]", "route.ts"),
    readProjectFile("src", "app", "api", "admin", "ai", "datasets", "import", "route.ts"),
    readProjectFile("src", "app", "api", "admin", "ai", "datasets", "pairs", "[pairId]", "route.ts"),
  ];
  for (const source of routes) assert.match(source, /requireStaffPermission\(request,\s*"ai_training\.manage"\)/);
  const detailRoute = routes[1];
  assert.doesNotMatch(detailRoute, /fingerprint|provider_metadata|safe_storage_reference|raw_storage_path/);
});

test("dataset importer UI is linked and documents dry-run safety", () => {
  const aiPage = readProjectFile("src", "app", "admin", "ai-training", "page.tsx");
  const datasetPage = readProjectFile("src", "app", "admin", "ai-training", "datasets", "page.tsx");
  assert.match(aiPage, /\/admin\/ai-training\/datasets/);
  assert.match(datasetPage, /Metadata dry-run only/);
  assert.match(datasetPage, /Scanner metadata import/);
  assert.match(datasetPage, /Raw files stay local\/offline/);
  assert.match(datasetPage, /no training samples are approved/i);
  const detailPage = readProjectFile("src", "app", "admin", "ai-training", "datasets", "[id]", "page.tsx");
  assert.match(detailPage, /api\/admin\/ai\/datasets\/pairs/);
  assert.match(detailPage, /Training sample creation remains|updatePairStatus|Reject/);
  assert.match(detailPage, /Stage 1 readiness/);
  const calibrationPage = readProjectFile("src", "app", "admin", "ai-training", "calibration-assistant", "page.tsx");
  assert.match(calibrationPage, /No byte patches/);
  assert.match(calibrationPage, /createLowDataStage1Plan/);
});

test("dataset metadata import and pair review APIs never auto-create training samples", () => {
  const importRoute = readProjectFile("src", "app", "api", "admin", "ai", "datasets", "import", "route.ts");
  const pairRoute = readProjectFile("src", "app", "api", "admin", "ai", "datasets", "pairs", "[pairId]", "route.ts");
  assert.match(importRoute, /training_samples:\s*0/);
  assert.match(importRoute, /approved_learning_samples:\s*0/);
  assert.match(importRoute, /raw_files_uploaded:\s*false/);
  assert.match(importRoute, /supabase_storage_used:\s*false/);
  assert.match(pairRoute, /actual_service_labels are required/);
  assert.match(pairRoute, /cannot directly approve trusted learning/);
  assert.match(pairRoute, /creates_training_sample:\s*false/);
  assert.match(pairRoute, /auto_approved_learning:\s*false/);
  assert.doesNotMatch(importRoute + pairRoute, /from\("ai_training_samples"\)\.insert|storage\.from/i);
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
