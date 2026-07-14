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
import {
  emptyTrainingServiceLabels,
  trainingSafetyRatingKeys,
} from "../src/lib/ecuIntelligence/types";
import { generateAiFileExpertReport } from "../src/lib/ai";
import { modelSafeAnalyzerResult, modelSafeMetadata } from "../src/lib/ai/prompt";
import { hasStaffPermission } from "../src/lib/staffPermissions";
import { isTransientAuthError } from "../src/lib/authGuards";
import { validateFileExpertDescriptor } from "../src/lib/fileExpert/server";
import {
  hasFileExpertCustomerLeak,
  redactFileExpertResultForCustomer,
  sanitizeFileExpertJobForCustomer,
} from "../src/lib/fileExpert/publicResult";
import {
  buildCreditQuote,
  defaultCommerceSettings,
  emptyCustomerCommercialPolicy,
} from "../src/lib/commercialPolicy";
import { paymentProviderFromSource } from "../src/lib/paymentAudit";
import { checkRateLimit, getClientIp, rateLimitKey } from "../src/lib/rateLimit";
import {
  buildPublicSimilarityEvidence,
  calculateSimilarityReadiness,
  isEligibleSimilaritySample,
  rankSimilarTrainingSamples,
  scoreTrainingSampleSimilarity,
  type SimilarityCandidate,
  type SimilaritySource,
} from "../src/lib/ecuIntelligence/similarity";
import {
  buildPatternCluster,
  buildPublicClusterEvidence,
  calculateAccuracyMetrics,
  clusterStatusFor,
  exactSoftwareRegionBucketSize,
  extractRepeatedRegions,
  generalEcuRegionBucketSize,
  isEligibleClusteringSample,
  type AdminClusterEvidence,
  type ClusteringSample,
} from "../src/lib/ecuIntelligence/clustering";
import {
  buildEvidenceChecklist,
  calculateGenerationReadiness,
  calculateLearningUsefulness,
  categorizeSimilarityMatch,
} from "../src/lib/ecuIntelligence/evidenceReadiness";
import {
  attributeChangedRegionsToMapDefinitions,
  summarizeMapCandidates,
  type MapDefinition,
} from "../src/lib/ecuIntelligence/mapDefinitions";
import {
  analyzeDtcText,
  type DtcAnalyzerProvider,
  type DtcAnalyzerRequest,
  UnavailableDtcAnalyzerProvider,
} from "../src/lib/dtcAnalyzer";

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

function clusteringSignature(
  start = "0x00001000",
  end = "0x00001100",
  predicted: Array<"stage1" | "egr_off" | "dpf_off"> = ["stage1"]
) {
  return {
    ...similaritySignature(start, end),
    feature_candidates: predicted.map((feature) => ({ feature, confidence: 0.9, reasons: ["test evidence"] })),
    feature_hint_summary: predicted.map((feature) => ({ feature, confidence: 0.9, reasons: ["test evidence"] })),
  };
}

function clusteringSample(
  id: string,
  overrides: Partial<ClusteringSample> = {}
): ClusteringSample {
  return {
    id,
    ecu_family: "EDC17",
    ecu_type: "Bosch EDC17C50",
    sw_number: "SW1037550001",
    hw_number: "0281031234",
    performed_service_labels: similarityLabels("stage1"),
    requested_service_labels: similarityLabels("stage1"),
    pattern_signature: clusteringSignature(),
    auto_labels_correct: true,
    learning_use_status: "approved_for_learning",
    human_verification_status: "confirmed",
    data_quality_score: 90,
    quality_rating: 5,
    source_type: "completed_request",
    source_metadata: null,
    outcome: "customer_ok",
    ...overrides,
  };
}

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

test("DTC analyzer exposes provider-unavailable state before fallback", async () => {
  const provider = new UnavailableDtcAnalyzerProvider("Local DTC AI provider is disabled.");
  const response = await provider.analyzeDtc({
    source: "local_test",
    text: "P0401",
  });

  assert.equal(response.contractVersion, "dtc-analyzer-v1");
  assert.equal(response.status, "provider_unavailable");
  assert.equal(response.provider.providerId, "unconfigured_dtc_ai_provider");
  assert.equal(response.provider.providerStatus, "unavailable");
  assert.equal(response.provider.unavailableReason, "Local DTC AI provider is disabled.");
  assert.equal(response.fallback.used, false);
  assert.equal(response.isAiGenerated, false);
  assert.equal(response.confidence, "none");
  assert.ok(response.confidenceReasons.some((item) => /provider is unavailable/i.test(item.text)));
  assert.ok(response.evidence.some((item) => item.source === "provider_state" && item.type === "provider_availability"));
  assert.ok(response.riskFlags.some((item) => item.kind === "provider_unavailable"));
  assert.ok(response.recommendations.some((item) => item.category === "human_review_gate"));
  assert.deepEqual(response.normalizedInput.normalizedCodes, ["P0401"]);
  assert.ok(response.humanReview.required);
});

test("DTC analyzer deterministic fallback handles valid DTC text safely", async () => {
  const response = await analyzeDtcText({
    source: "customer_text",
    text: "Customer reports limp mode with p0401, P0401 and P2002.",
    vehicle: { brand: "BMW", engine: "2.0d", ecuType: "EDC17" },
  });
  const serialized = JSON.stringify(response);

  assert.equal(response.status, "fallback");
  assert.equal(response.provider.providerStatus, "unavailable");
  assert.equal(response.fallback.used, true);
  assert.equal(response.fallback.providerId, "deterministic_rules");
  assert.equal(response.isAiGenerated, false);
  assert.equal(response.confidence, "medium");
  assert.deepEqual(response.normalizedInput.normalizedCodes, ["P0401", "P2002"]);
  assert.equal(response.codes[0].code, "P0401");
  assert.match(response.codes[0].title, /EGR flow lower than expected/i);
  assert.ok(response.codes[0].recommendedChecks.some((item) => /commanded EGR/i.test(item)));
  assert.ok(response.codes[0].evidence.some((item) => item.source === "local_known_profile"));
  assert.ok(response.codes[0].riskFlags.some((item) => item.kind === "emissions_or_legal_review"));
  assert.ok(response.codes[0].recommendations.some((item) => item.category === "diagnostic_check"));
  assert.ok(response.codes[0].confidenceReasons.some((item) => /capped/i.test(item.text)));
  assert.ok(response.missingInformation.some((item) => /Freeze-frame/i.test(item)));
  assert.ok(response.evidence.some((item) => item.type === "dtc_code_detected" && item.code === "P2002"));
  assert.ok(response.riskFlags.some((item) => item.kind === "provider_unavailable"));
  assert.ok(response.riskFlags.some((item) => item.code === "P2002" && item.kind === "emissions_or_legal_review"));
  assert.ok(response.recommendations.some((item) => item.category === "human_review_gate" && /byte patches/i.test(item.text)));
  assert.ok(response.confidenceReasons.some((item) => /Deterministic text-only fallback is capped at medium/i.test(item.text)));
  assert.ok(response.humanReview.required);
  assert.ok(response.humanReview.requiredBefore.some((item) => /DTC-off decision/i.test(item)));
  assert.ok(response.safetyBoundaries.some((item) => /does not approve DTC-off/i.test(item)));
  assert.doesNotMatch(serialized, /Customer reports limp mode/i);
  assert.doesNotMatch(serialized, /confirmed fix|customer-ready file|checksum result|byte patch approved/i);
  assert.doesNotMatch(serialized, /storage_path|signed_url|service_role|first_64_bytes_hex/i);
});

test("DTC analyzer deterministic fallback keeps unknown valid codes low-confidence", async () => {
  const response = await analyzeDtcText({
    source: "admin_text",
    text: "Please check B1234 with a private workshop note.",
  });
  const code = response.codes[0];
  const serialized = JSON.stringify(response);

  assert.equal(response.status, "fallback");
  assert.equal(response.confidence, "low");
  assert.equal(code.code, "B1234");
  assert.equal(code.confidence, "low");
  assert.ok(code.evidence.some((item) => item.type === "known_code_context" && item.severity === "caution"));
  assert.ok(code.riskFlags.some((item) => item.kind === "diagnostic_uncertainty"));
  assert.ok(code.riskFlags.some((item) => item.kind === "insufficient_context"));
  assert.ok(code.recommendations.some((item) => item.category === "missing_information"));
  assert.ok(code.recommendations.some((item) => item.category === "human_review_gate"));
  assert.ok(code.confidenceReasons.some((item) => /no trusted local definition/i.test(item.text)));
  assert.ok(response.confidenceReasons.some((item) => /Overall confidence is low/i.test(item.text)));
  assert.doesNotMatch(serialized, /private workshop note/i);
  assert.doesNotMatch(serialized, /confirmed fix|DTC-off approved|customer-ready file|checksum result|byte patch approved/i);
});

test("DTC analyzer provider errors preserve provider identity and non-AI fallback", async () => {
  class ThrowingDtcProvider implements DtcAnalyzerProvider {
    readonly providerId = "throwing_test_provider";
    readonly providerKind = "mock" as const;
    readonly modelName = "local-test-model";

    async analyzeDtc(_input: DtcAnalyzerRequest): Promise<never> {
      void _input;
      throw new Error("private provider failure detail");
    }
  }

  const response = await analyzeDtcText({
    source: "local_test",
    text: "P0299",
  }, { provider: new ThrowingDtcProvider() });
  const serialized = JSON.stringify(response);

  assert.equal(response.status, "fallback");
  assert.equal(response.provider.providerId, "throwing_test_provider");
  assert.equal(response.provider.providerStatus, "error");
  assert.equal(response.fallback.used, true);
  assert.match(response.fallback.reason ?? "", /provider failed locally/i);
  assert.equal(response.isAiGenerated, false);
  assert.equal(response.confidence, "medium");
  assert.ok(response.evidence.some((item) => item.source === "provider_state" && item.severity === "warning"));
  assert.ok(response.riskFlags.some((item) => item.kind === "provider_unavailable"));
  assert.doesNotMatch(serialized, /private provider failure detail/i);
});

test("DTC analyzer deterministic fallback handles invalid and empty input", async () => {
  const invalid = await analyzeDtcText({
    source: "customer_text",
    text: "P0XYZ and random note",
  });
  const empty = await analyzeDtcText({
    source: "customer_text",
    text: "   ",
  });

  assert.equal(invalid.status, "invalid_input");
  assert.equal(invalid.provider.providerId, "deterministic_rules");
  assert.equal(invalid.fallback.used, true);
  assert.equal(invalid.isAiGenerated, false);
  assert.equal(invalid.confidence, "none");
  assert.ok(invalid.confidenceReasons.some((item) => /No confidence/i.test(item.text)));
  assert.deepEqual(invalid.normalizedInput.normalizedCodes, []);
  assert.deepEqual(invalid.normalizedInput.rejectedCodeLikeTokens, ["P0XYZ"]);
  assert.match(invalid.summary, /No valid SAE-style DTC code/i);
  assert.ok(invalid.evidence.some((item) => item.type === "input_validation"));
  assert.ok(invalid.riskFlags.some((item) => item.kind === "insufficient_context"));
  assert.ok(invalid.recommendations.some((item) => item.category === "missing_information"));
  assert.doesNotMatch(JSON.stringify(invalid), /random note/i);

  assert.equal(empty.status, "invalid_input");
  assert.equal(empty.normalizedInput.hasText, false);
  assert.equal(empty.confidence, "none");
  assert.match(empty.summary, /Enter at least one diagnostic trouble code/i);
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
  customerFour.payment_paypal_enabled = true;
  const quote = buildCreditQuote(defaultCommerceSettings, customerFour);
  assert.deepEqual(Object.keys(quote.paymentMethods).sort(), ["bank", "stripe"]);
  assert.equal(quote.paymentMethods.stripe, true);
});

test("payment ledger sources map to supported and legacy finance providers", () => {
  assert.equal(paymentProviderFromSource("stripe_checkout"), "stripe");
  assert.equal(paymentProviderFromSource("paypal_order"), "paypal");
  assert.equal(paymentProviderFromSource("bank_transfer"), "bank");
  assert.equal(paymentProviderFromSource("staff_adjustment"), null);
});

test("admin credit migration writes only ledger-supported transaction types", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "scripts", "fix-credit-ledger-safety-contracts.sql"),
    "utf8"
  );
  assert.match(sql, /p_amount > 0 then 'admin_topup' else 'admin_adjustment'/i);
  assert.doesNotMatch(sql, /p_customer_id\s*,\s*'adjustment'/i);
  assert.match(sql, /grant execute on function public\.staff_adjust_customer_credits/i);
});

test("File Expert and AI Training share the complete safety rating contract", () => {
  assert.deepEqual(trainingSafetyRatingKeys, ["unknown", "safe", "aggressive", "risky", "bad"]);
  const sql = readFileSync(
    resolve(process.cwd(), "scripts", "fix-credit-ledger-safety-contracts.sql"),
    "utf8"
  );
  for (const rating of trainingSafetyRatingKeys) {
    assert.match(sql, new RegExp(`'${rating}'`, "i"));
  }
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

test("auth guards recognize refresh races as transient instead of a real logout", () => {
  assert.equal(isTransientAuthError({ name: "AuthRefreshDiscardedError" }), true);
  assert.equal(isTransientAuthError({ name: "AuthRetryableFetchError" }), true);
  assert.equal(isTransientAuthError({ name: "NavigatorLockAcquireTimeoutError" }), true);
  assert.equal(isTransientAuthError({ name: "AuthInvalidCredentialsError" }), false);
});

test("rate limiter keys requests by forwarded client IP and enforces limits", () => {
  const request = new Request("https://file.mgautotech.de/api/email/new-customer", {
    headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.1" },
  });
  const key = rateLimitKey(request, "unit-test", crypto.randomUUID());

  assert.equal(getClientIp(request), "203.0.113.10");
  assert.equal(checkRateLimit({ key, limit: 2, windowMs: 60_000 }).allowed, true);
  assert.equal(checkRateLimit({ key, limit: 2, windowMs: 60_000 }).allowed, true);
  const blocked = checkRateLimit({ key, limit: 2, windowMs: 60_000 });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.ok(blocked.retryAfterSeconds > 0);
});

test("browser Supabase client persists and serializes cross-tab token refresh", () => {
  const source = readFileSync(resolve(process.cwd(), "src", "lib", "supabaseClient.ts"), "utf8");
  assert.match(source, /persistSession:\s*true/);
  assert.match(source, /autoRefreshToken:\s*true/);
  assert.match(source, /lock:\s*typeof navigator[\s\S]*navigatorLock/);
  assert.match(source, /__mgAutotechSupabase/);
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

test("Level 2 clustering accepts only approved, confirmed and quality-gated samples", () => {
  assert.equal(isEligibleClusteringSample(clusteringSample("approved")), true);
  assert.equal(isEligibleClusteringSample(clusteringSample("pending", { learning_use_status: "pending" })), false);
  assert.equal(isEligibleClusteringSample(clusteringSample("rejected", { human_verification_status: "rejected" })), false);
  assert.equal(isEligibleClusteringSample(clusteringSample("excluded", { learning_use_status: "excluded" })), false);
  assert.equal(isEligibleClusteringSample(clusteringSample("low", { data_quality_score: 59 })), false);
  assert.equal(isEligibleClusteringSample(clusteringSample("no-pattern", { pattern_signature: null })), false);
});

test("demo samples are excluded from trusted clusters unless explicitly allowed", () => {
  const demo = clusteringSample("demo", { source_type: "demo_fixture", source_metadata: { demo: true } });
  assert.equal(isEligibleClusteringSample(demo), false);
  assert.equal(isEligibleClusteringSample(demo, { allowDemoEvidence: true }), true);
});

test("same ECU and actual feature form one evidence cluster", () => {
  const samples = [clusteringSample("one"), clusteringSample("two"), clusteringSample("three")];
  const cluster = buildPatternCluster({
    ecuFamily: "EDC17",
    ecuType: "Bosch EDC17C50",
    featureType: "stage1",
    samples,
  });
  assert.equal(cluster.sample_count, 3);
  assert.deepEqual(cluster.source_sample_ids.sort(), ["one", "three", "two"]);
  assert.equal(cluster.feature_type, "stage1");
});

test("different actual feature labels remain in separate clusters", () => {
  const stage = clusteringSample("stage");
  const egr = clusteringSample("egr", {
    performed_service_labels: similarityLabels("egr_off"),
    requested_service_labels: similarityLabels("egr_off"),
    pattern_signature: clusteringSignature("0x00002000", "0x00002100", ["egr_off"]),
  });
  const stageCluster = buildPatternCluster({ ecuType: "Bosch EDC17C50", featureType: "stage1", samples: [stage, egr] });
  const egrCluster = buildPatternCluster({ ecuType: "Bosch EDC17C50", featureType: "egr_off", samples: [stage, egr] });
  assert.deepEqual(stageCluster.source_sample_ids, ["stage"]);
  assert.deepEqual(egrCluster.source_sample_ids, ["egr"]);
});

test("repeated regions count each approved sample only once per bucket", () => {
  const samples = [
    clusteringSample("a", { pattern_signature: clusteringSignature("0x00001010", "0x000011F0") }),
    clusteringSample("b", { pattern_signature: clusteringSignature("0x00001080", "0x00001120") }),
    clusteringSample("c", { pattern_signature: clusteringSignature("0x00002800", "0x00002840") }),
  ];
  const regions = extractRepeatedRegions(samples, { exactSoftware: false });
  assert.equal(regions.length, 1);
  assert.equal(regions[0].occurrence_count, 2);
  assert.equal(regions[0].occurrence_rate, 0.667);
});

test("region bucketing is stricter for the same software identifier", () => {
  assert.ok(exactSoftwareRegionBucketSize < generalEcuRegionBucketSize);
  const samples = [
    clusteringSample("a", { pattern_signature: clusteringSignature("0x00001020", "0x00001040") }),
    clusteringSample("b", { pattern_signature: clusteringSignature("0x00001620", "0x00001640") }),
  ];
  assert.equal(extractRepeatedRegions(samples, { exactSoftware: true }).length, 0);
  assert.equal(extractRepeatedRegions(samples, { exactSoftware: false }).length, 1);
});

test("outlier detection flags a dissimilar sample without deleting it", () => {
  const regular = Array.from({ length: 5 }, (_, index) => clusteringSample(`regular-${index}`));
  const outlier = clusteringSample("outlier", {
    pattern_signature: clusteringSignature("0x000A0000", "0x000A0100", ["egr_off"]),
    outcome: "issue_reported",
  });
  const cluster = buildPatternCluster({ ecuType: "Bosch EDC17C50", featureType: "stage1", samples: [...regular, outlier] });
  assert.ok(cluster.source_sample_ids.includes("outlier"));
  assert.ok(cluster.outlier_sample_ids.includes("outlier"));
  assert.equal(cluster.memberships.find((member) => member.training_sample_id === "outlier")?.is_outlier, true);
});

test("cluster confidence rises with repeated high-quality evidence", () => {
  const weak = buildPatternCluster({
    ecuType: "Bosch EDC17C50",
    swNumber: "SW1037550001",
    featureType: "stage1",
    samples: Array.from({ length: 3 }, (_, index) => clusteringSample(`weak-${index}`)),
  });
  const strong = buildPatternCluster({
    ecuType: "Bosch EDC17C50",
    swNumber: "SW1037550001",
    featureType: "stage1",
    samples: Array.from({ length: 25 }, (_, index) => clusteringSample(`strong-${index}`, { data_quality_score: 96 })),
  });
  assert.ok(strong.cluster_confidence > weak.cluster_confidence);
  assert.equal(weak.cluster_status, "weak");
  assert.equal(strong.cluster_status, "strong");
  assert.equal(clusterStatusFor(4, 90), "weak");
});

test("multi-label actual services contribute to each relevant feature cluster", () => {
  const labels = similarityLabels("stage1");
  labels.egr_off = true;
  const sample = clusteringSample("multi", {
    performed_service_labels: labels,
    pattern_signature: clusteringSignature("0x00001000", "0x00001100", ["stage1", "egr_off"]),
  });
  const stage = buildPatternCluster({ ecuType: sample.ecu_type, featureType: "stage1", samples: [sample] });
  const egr = buildPatternCluster({ ecuType: sample.ecu_type, featureType: "egr_off", samples: [sample] });
  assert.deepEqual(stage.source_sample_ids, ["multi"]);
  assert.deepEqual(egr.source_sample_ids, ["multi"]);
});

test("accuracy metrics explicitly report insufficient reviewed data", () => {
  const sample = clusteringSample("unreviewed", { auto_labels_correct: null, pattern_signature: clusteringSignature("0x1000", "0x1100", []) });
  const global = calculateAccuracyMetrics([sample])[0];
  assert.equal(global.total_reviewed, 0);
  assert.equal(global.precision_score, 0);
  assert.equal(global.confusion_json?.insufficient_data, true);
});

test("accuracy metrics ignore labels that are not human-confirmed", () => {
  const unconfirmed = clusteringSample("unconfirmed", {
    human_verification_status: "unverified",
    auto_labels_correct: true,
  });
  const global = calculateAccuracyMetrics([unconfirmed])[0];
  assert.equal(global.total_reviewed, 0);
  assert.equal(global.confusion_json?.insufficient_data, true);
});

test("accuracy metrics calculate correct, partial and wrong labels", () => {
  const correct = clusteringSample("correct", { auto_labels_correct: true });
  const partialLabels = similarityLabels("stage1");
  partialLabels.egr_off = true;
  const partial = clusteringSample("partial", {
    auto_labels_correct: false,
    performed_service_labels: partialLabels,
    pattern_signature: clusteringSignature("0x1000", "0x1100", ["stage1"]),
  });
  const wrong = clusteringSample("wrong", {
    auto_labels_correct: false,
    performed_service_labels: similarityLabels("egr_off"),
    pattern_signature: clusteringSignature("0x1000", "0x1100", ["dpf_off"]),
  });
  const global = calculateAccuracyMetrics([correct, partial, wrong])[0];
  assert.equal(global.total_reviewed, 3);
  assert.equal(global.auto_label_correct, 1);
  assert.equal(global.auto_label_partial, 1);
  assert.equal(global.auto_label_wrong, 1);
  assert.equal(global.precision_score, 50);
  const pairs = global.confusion_json?.pairs as Record<string, number>;
  assert.equal(pairs["dpf_off->egr_off"], 1);
});

test("customer cluster evidence exposes no sample IDs, offsets or raw data", () => {
  const adminEvidence: AdminClusterEvidence = {
    matchingClusters: 1,
    bestStatus: "usable",
    bestConfidence: 64,
    message: "private admin evidence",
    humanVerificationRequired: true,
    checksumVerificationRequired: true,
    clusters: [{
      id: "private-cluster-id",
      ecu_family: "EDC17",
      ecu_type: "Bosch EDC17C50",
      sw_number: "PRIVATE-SW",
      feature_type: "stage1",
      sample_count: 8,
      cluster_confidence: 64,
      cluster_status: "usable",
      repeated_regions: [{
        bucket_start_hex: "0x00001000",
        bucket_end_hex: "0x00001FFF",
        occurrence_count: 7,
        occurrence_rate: 0.875,
        representative_offsets: ["0x00001020"],
        confidence: 0.8,
        reason: "private region",
        notes: "private note",
      }],
    }],
  };
  const serialized = JSON.stringify(buildPublicClusterEvidence(adminEvidence));
  assert.equal(serialized.includes("private-cluster-id"), false);
  assert.equal(serialized.includes("PRIVATE-SW"), false);
  assert.equal(serialized.includes("0x00001000"), false);
  assert.equal(serialized.includes("representative_offsets"), false);
  assert.equal(serialized.includes("raw"), false);
});

test("AI evidence checklist explains trusted matches without approving generation", () => {
  const match = scoreTrainingSampleSimilarity(similaritySource, similarityCandidate("trusted"));
  const result = rankSimilarTrainingSamples(similaritySource, [similarityCandidate("trusted")]);
  const cluster = buildPublicClusterEvidence({
    matchingClusters: 1,
    bestStatus: "strong",
    bestConfidence: 76,
    message: "Approved cluster evidence exists.",
    humanVerificationRequired: true,
    checksumVerificationRequired: true,
    clusters: [],
  });
  const evidence = buildEvidenceChecklist({
    similarity: result,
    cluster,
    sample: {
      learning_use_status: "approved_for_learning",
      human_verification_status: "confirmed",
      data_quality_score: 92,
      requested_service_labels: similarityLabels("stage1"),
      performed_service_labels: similarityLabels("stage1"),
      pattern_signature: similaritySignature(),
      diff_json: { mode: "ori_mod_compare" } as never,
      ecu_type: "Bosch EDC17C50",
    },
  });
  const generation = calculateGenerationReadiness({
    evidence,
    mapDefinitionsAvailable: false,
    checksumWorkflowAvailable: false,
    humanApprovalReady: false,
    exactSwMatch: true,
    actualLabelsConfirmed: true,
  });

  assert.equal(categorizeSimilarityMatch(match), "same_file_family");
  assert.ok(["strong", "exact"].includes(evidence.level));
  assert.equal(generation.ready, false);
  assert.ok(generation.blockers.some((blocker) => /map definitions/i.test(blocker)));
  assert.ok(generation.blockers.some((blocker) => /checksum/i.test(blocker)));
});

test("learning usefulness blocks weak or unconfirmed samples from trusted evidence", () => {
  const pending = calculateLearningUsefulness({
    learning_use_status: "pending",
    human_verification_status: "unverified",
    data_quality_score: 42,
    requested_service_labels: similarityLabels("stage1"),
    performed_service_labels: null,
    pattern_signature: null,
    diff_json: null,
  });
  const approved = calculateLearningUsefulness({
    learning_use_status: "approved_for_learning",
    human_verification_status: "confirmed",
    data_quality_score: 92,
    requested_service_labels: similarityLabels("stage1"),
    performed_service_labels: similarityLabels("stage1"),
    pattern_signature: similaritySignature(),
    diff_json: { mode: "ori_mod_compare" } as never,
    ecu_family: "EDC17",
  });

  assert.equal(pending.usable, false);
  assert.equal(pending.status, "needs_review");
  assert.ok(pending.missing.some((item) => /quality/i.test(item)));
  assert.equal(approved.usable, true);
  assert.equal(approved.status, "trusted");
});

test("map definition attribution stays conservative without definitions", async () => {
  const result = await analyzeFileExpertBuffers({
    jobId: "map-definition-required",
    ori: calibrationLikeBuffer(),
    mod: (() => {
      const mod = calibrationLikeBuffer();
      mod.fill(0x55, 0x3000, 0x3100);
      return mod;
    })(),
  });
  const noDefinitions = attributeChangedRegionsToMapDefinitions(result, []);
  const definition: MapDefinition = {
    id: "torque-map-1",
    ecuFamily: result.ecu_identification?.family,
    name: "Torque limiter candidate",
    category: "torque_model",
    startOffsetHex: "0x00003000",
    endOffsetHex: "0x000031FF",
    confidence: 0.85,
    source: "human_verified",
  };
  const attributed = attributeChangedRegionsToMapDefinitions(result, [definition]);

  assert.equal(noDefinitions.status, "no_definitions");
  assert.equal(noDefinitions.mapDefinitionRequired, true);
  assert.ok(attributed.attributed.some((item) => item.definitionId === "torque-map-1"));
  assert.ok(summarizeMapCandidates(result.map_candidates).every((item) => /Human|Structural/i.test(item.note)));
});

test("customer File Expert projection strips paths, hashes, offsets and admin fields", async () => {
  const analyzerResult = await analyzeFileExpertBuffers({
    jobId: "customer-safe-job",
    ori: calibrationLikeBuffer(),
    mod: (() => {
      const mod = calibrationLikeBuffer();
      mod.fill(0x42, 0x1000, 0x1100);
      mod.fill(0x24, 0x3000, 0x3100);
      return mod;
    })(),
  });
  const safeJob = sanitizeFileExpertJobForCustomer({
    id: "job-1",
    user_id: "customer-1",
    status: "completed",
    brand: "BMW",
    model: "5 Series",
    engine: "530d",
    ecu_type: "Bosch EDC17C50",
    ori_file_path: "customer-1/job-1/ori-private.bin",
    mod_file_path: "customer-1/job-1/mod-private.bin",
    ori_sha256: "secret-ori-hash",
    mod_sha256: "secret-mod-hash",
    confidence_score: 88,
    admin_notes: "private tuner note",
    provider: "private-provider",
    source_reference: "private-source",
    ai_report: "private report mentions 0x00001000",
    result_json: analyzerResult,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  });
  const serialized = JSON.stringify(safeJob);
  assert.equal(hasFileExpertCustomerLeak(safeJob), false);
  assert.equal(serialized.includes("ori-private.bin"), false);
  assert.equal(serialized.includes("secret-ori-hash"), false);
  assert.equal(serialized.includes("confidence_score"), false);
  assert.equal(serialized.includes("private tuner note"), false);
  assert.equal(serialized.includes("0x00001000"), false);
  assert.equal(serialized.includes("offset"), false);
  assert.equal(serialized.includes("hex"), false);
  assert.equal(serialized.includes("private-provider"), false);
});

test("customer File Expert analyzer result keeps safe summary while hiding binary coordinates", async () => {
  const result = await analyzeFileExpertBuffers({
    jobId: "safe-summary",
    ori: calibrationLikeBuffer(),
    mod: (() => {
      const mod = calibrationLikeBuffer();
      mod.fill(0x11, 0x2000, 0x2100);
      return mod;
    })(),
  });
  const safe = redactFileExpertResultForCustomer(result);
  const serialized = JSON.stringify(safe);
  assert.equal(hasFileExpertCustomerLeak(safe), false);
  assert.equal(serialized.includes("main_conclusion"), true);
  assert.equal(serialized.includes("changed_bytes"), true);
  assert.equal(serialized.includes("0x"), false);
  assert.equal(serialized.includes("first_64_bytes_hex"), false);
  assert.equal(serialized.includes("ori_hex_preview"), false);
  assert.equal(serialized.includes("sha256"), false);
});

test("admin cluster rebuild API rejects unauthenticated customers", async () => {
  const { POST } = await import("../src/app/api/admin/ai-training/clusters/rebuild/route");
  const response = await POST(new Request("http://localhost/api/admin/ai-training/clusters/rebuild", { method: "POST" }));
  assert.equal(response.status, 401);
});

test("Level 2 migration is additive, admin-only and contains no binary payload column", () => {
  const sql = readFileSync(resolve(process.cwd(), "scripts", "add-ecu-pattern-clustering-level2.sql"), "utf8");
  assert.match(sql, /create table if not exists public\.ai_pattern_clusters/i);
  assert.match(sql, /create table if not exists public\.ai_accuracy_metrics/i);
  assert.match(sql, /create table if not exists public\.ai_cluster_members/i);
  assert.match(sql, /unique \(cluster_id, training_sample_id\)/i);
  assert.match(sql, /has_staff_permission\('ai_training\.manage'\)/i);
  assert.doesNotMatch(sql, /customer[\s\S]*read[\s\S]*cluster/i);
  assert.doesNotMatch(sql, /raw_binary|binary_content|hex_preview/i);
  assert.doesNotMatch(sql, /drop table|truncate table/i);
});
