import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  analyzeFileExpertBuffers,
  buildPatternSignature,
  sha256Buffer,
} from "../src/lib/fileExpert/analyzer";
import { parseTrainingServiceLabels } from "../src/lib/ecuIntelligence/serviceLabels";
import {
  calculateKnowledgeProfileMetrics,
  calculateKnowledgeReadiness,
  type KnowledgeProfileSample,
} from "../src/lib/ecuIntelligence/learning";
import { calculateTrainingSampleQuality } from "../src/lib/ecuIntelligence/quality";
import { buildDemoBinaryFixtures, isAiTrainingDemoEnabled } from "../src/lib/ecuIntelligence/demoFixtures";
import { emptyTrainingServiceLabels } from "../src/lib/ecuIntelligence/types";
import { generateAiFileExpertReport } from "../src/lib/ai";
import { modelSafeAnalyzerResult, modelSafeMetadata } from "../src/lib/ai/prompt";
import { hasStaffPermission } from "../src/lib/staffPermissions";
import { validateFileExpertDescriptor } from "../src/lib/fileExpert/server";
import {
  buildCreditQuote,
  defaultCommerceSettings,
  emptyCustomerCommercialPolicy,
} from "../src/lib/commercialPolicy";
import { paymentProviderFromSource } from "../src/lib/paymentAudit";
import {
  buildPublicSimilarityEvidence,
  calculateSimilarityReadiness,
  isEligibleSimilaritySample,
  rankSimilarTrainingSamples,
  scoreTrainingSampleSimilarity,
  type SimilarityCandidate,
  type SimilaritySource,
} from "../src/lib/ecuIntelligence/similarity";

function calibrationLikeBuffer(size = 16_384) {
  const buffer = Buffer.alloc(size, 0xff);
  for (let index = 1024; index < size - 1024; index += 1) {
    buffer[index] = (index * 17 + Math.floor(index / 31)) % 256;
  }
  Buffer.from("BOSCH EDC17C50 0281031234 SW1037550001").copy(buffer, 64);
  return buffer;
}

function similarityLabels(feature: "stage1" | "egr_off" = "stage1") {
  const labels = emptyTrainingServiceLabels();
  labels[feature] = true;
  return labels;
}

function similaritySignature(start = "0x00001000", end = "0x00001100") {
  return {
    analysis_version: "2.1.0",
    mode: "ori_mod_compare" as const,
    changed_percent: 1,
    merged_changed_blocks: 1,
    map_candidates: [],
    repeated_patterns: [],
    feature_candidates: [],
    ecu_identification: null,
    change_profile: null,
    main_regions: [{ start_offset_hex: start, end_offset_hex: end, changed_byte_count: 64 }],
    changed_bytes: 64,
    merged_blocks: 1,
    repeated_patterns_summary: [],
    map_candidates_summary: [],
    feature_hint_summary: [],
  };
}

function similarityCandidate(
  id: string,
  overrides: Partial<SimilarityCandidate> = {}
): SimilarityCandidate {
  return {
    id,
    brand: "BMW",
    model: "5 Series",
    engine: "3.0d",
    ecu_family: "EDC17",
    ecu_type: "Bosch EDC17C50",
    sw_number: "SW1037550001",
    hw_number: "0281031234",
    ori_file_size: 2_097_152,
    mod_file_size: 2_097_152,
    pattern_signature: similaritySignature(),
    diff_json: true,
    performed_service_labels: similarityLabels(),
    learning_use_status: "approved_for_learning",
    human_verification_status: "confirmed",
    data_quality_score: 90,
    quality_rating: 5,
    provider: "internal",
    source_type: "completed_request",
    source_metadata: null,
    outcome: "customer_ok",
    ...overrides,
  };
}

const similaritySource: SimilaritySource = {
  sourceType: "training_sample",
  sourceId: "00000000-0000-4000-8000-000000000300",
  ecuFamily: "EDC17",
  ecuType: "Bosch EDC17C50",
  swNumber: "SW1037550001",
  hwNumber: "0281031234",
  fileSize: 2_097_152,
  patternSignature: similaritySignature(),
  serviceLabels: similarityLabels(),
  provider: "internal",
};

test("normalizes requested service labels conservatively", () => {
  const labels = parseTrainingServiceLabels(
    "Stage 2 + EGR OFF + Speed Limit Removal / VMAX OFF + TCU Shift Optimization"
  );
  assert.equal(labels.stage2, true);
  assert.equal(labels.egr_off, true);
  assert.equal(labels.vmax_off, true);
  assert.equal(labels.tcu_shift, true);
  assert.equal(labels.stage1, false);
  assert.equal(labels.dpf_off, false);
});

test("recognizes Stage 3 and common aftertreatment labels", () => {
  const labels = parseTrainingServiceLabels("Stage 3, DPF delete, SCR deactivation, DTC OFF");
  assert.equal(labels.stage3, true);
  assert.equal(labels.dpf_off, true);
  assert.equal(labels.adblue_off, true);
  assert.equal(labels.dtc_off, true);
});

test("produces stable SHA-256 fingerprints", () => {
  const buffer = calibrationLikeBuffer();
  assert.equal(sha256Buffer(buffer), sha256Buffer(Buffer.from(buffer)));
  assert.equal(sha256Buffer(buffer).length, 64);
});

test("classifies identical ORI and MOD without changed blocks", async () => {
  const ori = calibrationLikeBuffer();
  const result = await analyzeFileExpertBuffers({
    jobId: "00000000-0000-0000-0000-000000000001",
    ori,
    mod: Buffer.from(ori),
    fileNames: { ori: "vehicle.ori", mod: "vehicle.mod" },
    sourceKind: "completed_request",
  });

  assert.equal(result.analysis_version, "2.1.0");
  assert.equal(result.mode, "ori_mod_compare");
  assert.equal(result.comparison?.changed_bytes, 0);
  assert.equal(result.change_profile?.classification, "identical");
  assert.ok(result.active_regions.length > 0);
  assert.ok(result.pattern_signature);
});

test("groups controlled ORI/MOD changes and creates a reusable signature", async () => {
  const ori = calibrationLikeBuffer();
  const mod = Buffer.from(ori);
  for (let index = 4096; index < 4256; index += 1) mod[index] = (mod[index] + 12) % 256;
  for (let index = 8192; index < 8272; index += 1) mod[index] = (mod[index] + 4) % 256;

  const result = await analyzeFileExpertBuffers({
    jobId: "00000000-0000-0000-0000-000000000002",
    ori,
    mod,
    metadata: { brand: "BMW", model: "5 Series", ecuType: "Bosch EDC17C50" },
    sourceKind: "completed_request",
  });
  const signature = buildPatternSignature(result);

  assert.equal(result.comparison?.same_size, true);
  assert.ok((result.comparison?.changed_bytes || 0) >= 240);
  assert.ok((result.comparison?.merged_changed_blocks || 0) >= 2);
  assert.equal(signature.analysis_version, "2.1.0");
  assert.equal(signature.changed_percent, result.comparison?.changed_percent);
  assert.ok(result.summary.recommended_next_steps.some((item) => /checksum/i.test(item)));
  assert.ok(result.summary.recommended_next_steps.some((item) => /logging|dyno/i.test(item)));
});

test("raises structural risk when ORI and MOD sizes differ", async () => {
  const ori = calibrationLikeBuffer();
  const mod = Buffer.concat([ori, Buffer.alloc(256, 0)]);
  const result = await analyzeFileExpertBuffers({
    jobId: "00000000-0000-0000-0000-000000000003",
    ori,
    mod,
  });

  assert.equal(result.comparison?.same_size, false);
  assert.equal(result.change_profile?.classification, "structural_mismatch");
  assert.equal(result.risk_assessment.risk_level, "high");
});

test("single-file analysis never claims confirmed modification status", async () => {
  const result = await analyzeFileExpertBuffers({
    jobId: "00000000-0000-0000-0000-000000000004",
    single: calibrationLikeBuffer(),
    fileNames: { single: "read.bin" },
    sourceKind: "manual_file_expert",
  });
  assert.equal(result.mode, "single_file");
  assert.match(result.summary.main_conclusion, /cannot be confirmed/i);
  assert.ok(result.risk_assessment.warnings.some((warning) => /human|calibrator/i.test(warning)));
  assert.ok(result.risk_assessment.warnings.some((warning) => /checksum/i.test(warning)));
});

test("knowledge readiness is capped when human verification is weak", () => {
  assert.deepEqual(calculateKnowledgeReadiness(9, 9), { level: 0, value: "not_ready" });
  assert.deepEqual(calculateKnowledgeReadiness(120, 0), { level: 1, value: "detection_ready" });
  assert.deepEqual(calculateKnowledgeReadiness(120, 12), { level: 2, value: "pattern_ready" });
  assert.deepEqual(calculateKnowledgeReadiness(600, 60), { level: 3, value: "map_candidate_ready" });
  assert.deepEqual(calculateKnowledgeReadiness(2500, 250), { level: 4, value: "suggestion_ready" });
});

test("AI reporting falls back to the rule-based provider when no provider is configured", async () => {
  const previousProvider = process.env.AI_PROVIDER;
  const previousOpenAiKey = process.env.OPENAI_API_KEY;
  delete process.env.AI_PROVIDER;
  delete process.env.OPENAI_API_KEY;
  try {
    const analysis = await analyzeFileExpertBuffers({
      jobId: "00000000-0000-0000-0000-000000000005",
      single: calibrationLikeBuffer(),
    });
    const report = await generateAiFileExpertReport({
      sourceType: "file_expert_job",
      sourceId: null,
      result: analysis,
      metadata: {},
    });
    assert.equal(report.provider, "rule_based");
    assert.match(report.report, /checksum/i);
    assert.match(report.report, /human|calibrator/i);
  } finally {
    if (previousProvider === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = previousProvider;
    if (previousOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousOpenAiKey;
  }
});

test("model payload removes customer notes, filenames, VIN and printable strings", async () => {
  const analysis = await analyzeFileExpertBuffers({
    jobId: "00000000-0000-0000-0000-000000000006",
    single: calibrationLikeBuffer(),
    fileNames: { single: "customer-name-read.bin" },
  });
  if (analysis.files.single) {
    analysis.files.single.vins = ["WBA00000000000000"];
    analysis.files.single.ascii_strings = ["private marker"];
  }
  const safe = modelSafeAnalyzerResult(analysis);
  const metadata = modelSafeMetadata({ customerNotes: "private customer note", brand: "BMW" });

  assert.equal(safe.source?.single_file_name, null);
  assert.deepEqual(safe.files.single?.vins, []);
  assert.deepEqual(safe.files.single?.ascii_strings, []);
  assert.equal(safe.files.single?.first_64_bytes_hex, "[redacted]");
  assert.equal(safe.files.single?.last_64_bytes_hex, "[redacted]");
  assert.equal(analysis.source?.single_file_name, "customer-name-read.bin");
  assert.equal("customerNotes" in metadata, false);
});

test("committed demo fixtures are deterministic, harmless and cover invalid input", () => {
  const generated = buildDemoBinaryFixtures();
  const directory = resolve(process.cwd(), "tests", "fixtures", "ecu-intelligence");
  for (const [name, expected] of Object.entries(generated)) {
    const committed = readFileSync(resolve(directory, name));
    assert.deepEqual(committed, expected, `${name} must match the deterministic generator`);
  }
  assert.equal(generated["ori_same_size.bin"].length, generated["mod_same_size_stage1_like.bin"].length);
  assert.notEqual(
    sha256Buffer(generated["ori_same_size.bin"]),
    sha256Buffer(generated["mod_same_size_stage1_like.bin"])
  );
  assert.notEqual(generated["ori_same_size.bin"].length, generated["mod_different_size.bin"].length);
  assert.equal(validateFileExpertDescriptor({ name: "empty_invalid.bin", size: 0 }), "File is empty.");
});

test("calculates a transparent 0-100 training data quality score", async () => {
  const fixtures = buildDemoBinaryFixtures();
  const result = await analyzeFileExpertBuffers({
    jobId: "00000000-0000-4000-8000-000000000200",
    ori: fixtures["ori_same_size.bin"],
    mod: fixtures["mod_same_size_stage1_like.bin"],
    metadata: { brand: "BMW", model: "5 Series", engine: "3.0d", ecuType: "Bosch EDC17C50" },
  });
  const labels = emptyTrainingServiceLabels();
  labels.stage1 = true;
  const quality = calculateTrainingSampleQuality({
    ori_file_path: "demo/ori.bin",
    mod_file_path: "demo/mod.bin",
    ori_sha256: sha256Buffer(fixtures["ori_same_size.bin"]),
    mod_sha256: sha256Buffer(fixtures["mod_same_size_stage1_like.bin"]),
    ori_file_size: fixtures["ori_same_size.bin"].length,
    mod_file_size: fixtures["mod_same_size_stage1_like.bin"].length,
    brand: "BMW",
    model: "5 Series",
    engine: "3.0d",
    ecu_type: "Bosch EDC17C50",
    service_labels: labels,
    pattern_signature: result.pattern_signature ?? null,
    diff_json: result,
    human_verified: false,
    human_verification_status: "unverified",
    outcome: "unknown",
  }, result);

  assert.ok(quality.score >= 70 && quality.score <= 100);
  assert.ok(quality.reasons.some((reason) => reason.code === "same_size"));
  assert.ok(quality.reasons.some((reason) => reason.code === "human_verification_pending"));
});

test("quality scoring penalizes size mismatch, rejection and negative outcome", async () => {
  const fixtures = buildDemoBinaryFixtures();
  const result = await analyzeFileExpertBuffers({
    jobId: "00000000-0000-4000-8000-000000000201",
    ori: fixtures["ori_same_size.bin"],
    mod: fixtures["mod_different_size.bin"],
  });
  const quality = calculateTrainingSampleQuality({
    ori_file_path: "demo/ori.bin",
    mod_file_path: "demo/mod.bin",
    ori_sha256: "a".repeat(64),
    mod_sha256: "b".repeat(64),
    human_verified: false,
    human_verification_status: "rejected",
    outcome: "issue_reported",
    service_labels: emptyTrainingServiceLabels(),
    diff_json: result,
  }, result);
  assert.ok(quality.score < 40);
  assert.ok(quality.reasons.some((reason) => reason.code === "different_size"));
  assert.ok(quality.reasons.some((reason) => reason.code === "admin_rejected"));
  assert.ok(quality.reasons.some((reason) => reason.code === "negative_outcome"));
});

test("knowledge profiles exclude rejected and low-quality samples", () => {
  const labels = emptyTrainingServiceLabels();
  labels.stage1 = true;
  const samples: KnowledgeProfileSample[] = Array.from({ length: 110 }, (_, index) => ({
    id: String(index),
    service_labels: labels,
    performed_service_labels: labels,
    learning_use_status: "approved_for_learning" as const,
    human_verified: true,
    human_verification_status: "confirmed" as const,
    quality_rating: 4,
    data_quality_score: 85,
  }));
  samples.push({
    id: "low",
    service_labels: labels,
    performed_service_labels: labels,
    learning_use_status: "approved_for_learning",
    human_verified: false,
    human_verification_status: "unverified",
    quality_rating: 5,
    data_quality_score: 30,
  });
  samples.push({
    id: "rejected",
    service_labels: labels,
    performed_service_labels: labels,
    learning_use_status: "excluded",
    human_verified: false,
    human_verification_status: "rejected",
    quality_rating: 5,
    data_quality_score: 95,
  });
  const metrics = calculateKnowledgeProfileMetrics(samples);
  assert.equal(metrics.usable.length, 110);
  assert.equal(metrics.rejected.length, 1);
  assert.equal(metrics.state.level, 2);
  assert.equal(metrics.featureCounts.stage1_samples, 110);
});

test("knowledge profiles require confirmed performed services and explicit learning approval", () => {
  const requested = emptyTrainingServiceLabels();
  requested.egr_off = true;
  const performed = emptyTrainingServiceLabels();
  performed.stage1 = true;
  const metrics = calculateKnowledgeProfileMetrics([
    {
      id: "pending",
      service_labels: performed,
      performed_service_labels: performed,
      learning_use_status: "pending",
      human_verified: true,
      human_verification_status: "confirmed",
      quality_rating: 5,
      data_quality_score: 95,
    },
  ]);
  assert.equal(metrics.usable.length, 0);
  assert.equal(metrics.featureCounts.stage1_samples, 0);
  assert.equal(requested.egr_off, true);
});

test("similarity evidence uses only approved, confirmed and quality-gated samples", () => {
  const candidates = [
    similarityCandidate("approved"),
    similarityCandidate("pending", { learning_use_status: "pending" }),
    similarityCandidate("rejected", { human_verification_status: "rejected" }),
    similarityCandidate("excluded", { learning_use_status: "excluded" }),
    similarityCandidate("low-quality", { data_quality_score: 59 }),
    similarityCandidate("no-pattern", { pattern_signature: null }),
    similarityCandidate("demo", { source_type: "demo_fixture", source_metadata: { demo: true } }),
  ];
  const result = rankSimilarTrainingSamples(similaritySource, candidates);
  assert.equal(result.summary.eligible_samples_checked, 1);
  assert.deepEqual(result.matches.map((match) => match.training_sample_id), ["approved"]);
  assert.equal(isEligibleSimilaritySample(candidates[1]), false);
  assert.equal(isEligibleSimilaritySample(candidates[2]), false);
  assert.equal(isEligibleSimilaritySample(candidates[4]), false);
  assert.equal(isEligibleSimilaritySample(candidates[6]), false);
});

test("same ECU family and type score higher than mismatched ECU evidence", () => {
  const same = scoreTrainingSampleSimilarity(similaritySource, similarityCandidate("same"));
  const different = scoreTrainingSampleSimilarity(
    similaritySource,
    similarityCandidate("different", { ecu_family: "MED17", ecu_type: "Bosch MED17.5" })
  );
  assert.ok(same.score > different.score);
  assert.ok(same.reasons.some((reason) => /same ecu family/i.test(reason)));
  assert.ok(different.warnings.some((warning) => /ecu family mismatch/i.test(warning)));
});

test("matching actual service labels increase similarity score", () => {
  const matching = scoreTrainingSampleSimilarity(similaritySource, similarityCandidate("stage1"));
  const mismatch = scoreTrainingSampleSimilarity(
    similaritySource,
    similarityCandidate("egr", { performed_service_labels: similarityLabels("egr_off") })
  );
  assert.ok(matching.score > mismatch.score);
  assert.ok(matching.reasons.some((reason) => /same actual service label/i.test(reason)));
});

test("missing source metadata produces explicit similarity warnings", () => {
  const result = scoreTrainingSampleSimilarity(
    { ...similaritySource, ecuFamily: null, ecuType: null, swNumber: null, fileSize: null },
    similarityCandidate("candidate")
  );
  assert.ok(result.warnings.some((warning) => /ecu family is missing/i.test(warning)));
  assert.ok(result.warnings.some((warning) => /sw number is missing/i.test(warning)));
  assert.ok(result.warnings.some((warning) => /file size comparison is unavailable/i.test(warning)));
});

test("similarity search handles no eligible matches cleanly", () => {
  const result = rankSimilarTrainingSamples(similaritySource, [
    similarityCandidate("pending-only", { learning_use_status: "pending" }),
  ]);
  assert.equal(result.summary.matches_found, 0);
  assert.equal(result.summary.best_score, 0);
  assert.equal(result.summary.confidence, "none");
  assert.match(buildPublicSimilarityEvidence(result).message, /no approved similar learning evidence/i);
});

test("similarity ranking deduplicates the same approved sample safely", () => {
  const duplicate = similarityCandidate("same-sample");
  const result = rankSimilarTrainingSamples(similaritySource, [duplicate, { ...duplicate }]);
  assert.equal(result.summary.eligible_samples_checked, 1);
  assert.equal(result.matches.length, 1);
});

test("customer similarity evidence exposes aggregates without sample ids or binary data", () => {
  const ranked = rankSimilarTrainingSamples(similaritySource, [similarityCandidate("private-sample-id")]);
  const publicEvidence = buildPublicSimilarityEvidence(ranked);
  const serialized = JSON.stringify(publicEvidence);
  assert.equal(serialized.includes("private-sample-id"), false);
  assert.equal(serialized.includes("pattern_signature"), false);
  assert.equal(serialized.includes("diff_json"), false);
  assert.equal(publicEvidence.matchesFound, 1);
});

test("similarity readiness uses independent approved-sample thresholds", () => {
  assert.equal(calculateSimilarityReadiness(0), "no_data");
  assert.equal(calculateSimilarityReadiness(1), "weak");
  assert.equal(calculateSimilarityReadiness(10), "usable");
  assert.equal(calculateSimilarityReadiness(100), "strong");
});

test("Level 1 migration prevents duplicate comparisons and grants no customer read policy", () => {
  const sql = readFileSync(resolve(process.cwd(), "scripts", "add-ecu-similarity-level1.sql"), "utf8");
  assert.match(sql, /create table if not exists public\.ai_similarity_results/i);
  assert.match(sql, /ai_similarity_results_unique_comparison/i);
  assert.match(sql, /source_type, source_id, compared_sample_id/i);
  assert.doesNotMatch(sql, /Customers can read AI similarity/i);
});

test("commercial pricing applies customer override before customer adjustment", () => {
  const globalQuote = buildCreditQuote(defaultCommerceSettings, emptyCustomerCommercialPolicy("customer-a"));
  assert.equal(globalQuote.customUnitPriceEuro, 4);

  const customerFive = emptyCustomerCommercialPolicy("customer-b");
  customerFive.credit_price_override_eur = 5;
  customerFive.adjustment_type = "fixed";
  customerFive.adjustment_value = 1;
  assert.equal(buildCreditQuote(defaultCommerceSettings, customerFive).customUnitPriceEuro, 4);

  const customerFour = { ...customerFive, user_id: "customer-c", credit_price_override_eur: 4 };
  assert.equal(buildCreditQuote(defaultCommerceSettings, customerFour).customUnitPriceEuro, 3);
  customerFour.payment_paypal_enabled = false;
  assert.equal(buildCreditQuote(defaultCommerceSettings, customerFour).paymentMethods.paypal, false);
  assert.equal(buildCreditQuote(defaultCommerceSettings, customerFour).paymentMethods.stripe, true);
});

test("payment ledger sources map to supported finance providers", () => {
  assert.equal(paymentProviderFromSource("stripe_checkout"), "stripe");
  assert.equal(paymentProviderFromSource("paypal_order"), "paypal");
  assert.equal(paymentProviderFromSource("bank_transfer"), "bank");
  assert.equal(paymentProviderFromSource("staff_adjustment"), null);
});

test("payment control migration includes reconciliation and refund safeguards", () => {
  const sql = readFileSync(resolve(process.cwd(), "scripts", "add-payment-revenue-control.sql"), "utf8");
  assert.match(sql, /create table if not exists public\.payment_records/i);
  assert.match(sql, /unique \(provider, external_id\)/i);
  assert.match(sql, /admin_record_bank_payment/i);
  assert.match(sql, /admin_apply_payment_refund/i);
  assert.match(sql, /for update/i);
});

test("database migration enforces duplicate ORI/MOD sample prevention", () => {
  const sql = readFileSync(resolve(process.cwd(), "scripts", "add-ecu-intelligence-learning.sql"), "utf8");
  assert.match(sql, /ai_training_samples_request_hash_unique/i);
  assert.match(sql, /ai_training_samples_hash_unique_without_request/i);
});

test("AI provider falls back when OpenAI is selected without a key", async () => {
  const previousProvider = process.env.AI_PROVIDER;
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.AI_PROVIDER = "openai";
  delete process.env.OPENAI_API_KEY;
  try {
    const analysis = await analyzeFileExpertBuffers({
      jobId: "00000000-0000-4000-8000-000000000202",
      single: calibrationLikeBuffer(),
    });
    const report = await generateAiFileExpertReport({
      sourceType: "file_expert_job",
      result: analysis,
      metadata: {},
    });
    assert.equal(report.provider, "rule_based");
  } finally {
    if (previousProvider === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = previousProvider;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});

test("demo mode is unavailable unless the server-only flag is explicitly true", () => {
  assert.equal(isAiTrainingDemoEnabled({ ENABLE_AI_TRAINING_DEMO: "false" }), false);
  assert.equal(isAiTrainingDemoEnabled({}), false);
  assert.equal(isAiTrainingDemoEnabled({ ENABLE_AI_TRAINING_DEMO: "true" }), true);
});

test("customer access cannot satisfy the AI training admin permission", () => {
  assert.equal(hasStaffPermission({ role: "customer", staffRole: null, permissions: [] }, "ai_training.manage"), false);
  assert.equal(hasStaffPermission({ role: "staff", staffRole: "calibrator", permissions: [] }, "ai_training.manage"), false);
  assert.equal(hasStaffPermission({ role: "staff", staffRole: "manager", permissions: ["ai_training.manage"] }, "ai_training.manage"), true);
});

test("admin training API rejects unauthenticated access", async () => {
  const { GET } = await import("../src/app/api/admin/ai-training/route");
  const response = await GET(new Request("http://localhost/api/admin/ai-training"));
  assert.equal(response.status, 401);
});

test("admin similarity API rejects unauthenticated access", async () => {
  const { POST } = await import("../src/app/api/admin/ai-training/[id]/similarity/route");
  const response = await POST(
    new Request("http://localhost/api/admin/ai-training/sample-id/similarity", { method: "POST" }),
    { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000300" }) }
  );
  assert.equal(response.status, 401);
});

test("demo API is unavailable when the environment flag is false", async () => {
  const previous = process.env.ENABLE_AI_TRAINING_DEMO;
  process.env.ENABLE_AI_TRAINING_DEMO = "false";
  try {
    const { POST } = await import("../src/app/api/admin/ai-training/demo/route");
    const response = await POST(new Request("http://localhost/api/admin/ai-training/demo", { method: "POST" }));
    assert.equal(response.status, 404);
  } finally {
    if (previous === undefined) delete process.env.ENABLE_AI_TRAINING_DEMO;
    else process.env.ENABLE_AI_TRAINING_DEMO = previous;
  }
});
