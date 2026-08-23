import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
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
import type { AiReportProvider, AiReportRequest } from "../src/lib/ai/types";
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
  buildFileExpertAiReportStatus,
  fileExpertReportGateContractVersion,
} from "../src/lib/fileExpert/reportStatus";
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
  buildDtcRolloutReadinessReport,
  dtcRolloutAnalyticsFields,
  dtcRolloutReadinessContractVersion,
  projectDtcRolloutAnalyticsSnapshot,
  type DtcAnalyzerProvider,
  type DtcAnalyzerRequest,
  UnavailableDtcAnalyzerProvider,
} from "../src/lib/dtcAnalyzer";
import {
  checkDtcAnalyzerUsage,
  getDtcAnalyzerAdminConfigStatus,
  projectDtcUsageLimitForResponse,
} from "../src/lib/dtcAnalyzer/config";
import { analyzeRequestDtc } from "../src/lib/dtcAnalyzer/requestIntegration";
import {
  analyzeTuneAdvisorRequest,
  tuneAdvisorBlockedProductionActions,
  tuneAdvisorContractVersion,
  type TuneAdvisorProvider,
  type TuneAdvisorRequest,
  UnavailableTuneAdvisorProvider,
} from "../src/lib/tuneAdvisor";
import { analyzeRequestTuneAdvisor } from "../src/lib/tuneAdvisor/requestIntegration";
import {
  analyzeLogRequest,
  analyzeRequestLog,
  logAnalyzerBlockedProductionActions,
  logAnalyzerContractVersion,
  type LogAnalyzerProvider,
  type LogAnalyzerRequest,
  UnavailableLogAnalyzerProvider,
} from "../src/lib/logAnalyzer";
import {
  aiExplainLayerBlockedProductionActions,
  aiExplainLayerContractVersion,
  analyzeAiExplainRequest,
  buildAiExplainSourceLabels,
  hasAiExplainCustomerLeak,
  projectAiExplainResponse,
  type AiExplainProvider,
  type AiExplainRequest,
  UnavailableAiExplainProvider,
} from "../src/lib/aiExplain";
import {
  analyzeFileQualityScoreRequest,
  fileQualityScoreBlockedProductionActions,
  fileQualityScoreContractVersion,
  hasFileQualityScoreCustomerLeak,
  projectFileQualityScoreResponse,
  type FileQualityScoreProvider,
  type FileQualityScoreRequest,
  UnavailableFileQualityScoreProvider,
} from "../src/lib/fileQualityScore";
import type { FileExpertAnalyzerResult } from "../src/lib/fileExpert/types";

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
    assert.equal(report.generation?.state, "deterministic_fallback");
    assert.equal(report.generation?.fallback.used, true);
    assert.equal(report.generation?.isAiGenerated, false);
    const status = buildFileExpertAiReportStatus(report);
    assert.equal(status.contractVersion, fileExpertReportGateContractVersion);
    assert.equal(status.state, "deterministic_fallback");
    assert.equal(status.fallback.reason, "no_configured_provider");
    assert.equal(status.reviewGate.humanReviewRequired, true);
    assert.equal(status.reviewGate.exportLocked, true);
    assert.ok(status.reviewGate.blockedProductionActions.includes("customer_ready_mod_export"));
    assert.ok(status.reviewGate.blockedProductionActions.includes("checksum_approval"));
    assert.match(report.report, /checksum/i);
    assert.match(report.report, /human|calibrator/i);
  } finally {
    if (previousProvider === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = previousProvider;
    if (previousOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousOpenAiKey;
  }
});

test("AI reporting records provider-generated status without unlocking File Expert review", async () => {
  const provider: AiReportProvider = {
    name: "openai",
    modelName: "unit-model",
    async generateReport(input: AiReportRequest) {
      return {
        provider: "openai",
        modelName: "unit-model",
        promptVersion: "unit-prompt-v1",
        executiveSummary: `Provider summary for ${input.result.job_id}`,
        report: "Provider generated report. Human review and checksum verification remain required.",
        outputJson: { generated: true },
      };
    },
  };
  const analysis = await analyzeFileExpertBuffers({
    jobId: "provider-generated-status",
    single: calibrationLikeBuffer(),
  });
  const report = await generateAiFileExpertReport({
    sourceType: "file_expert_job",
    sourceId: null,
    result: analysis,
    metadata: {},
  }, { provider });
  const status = buildFileExpertAiReportStatus(report);

  assert.equal(report.provider, "openai");
  assert.equal(report.generation?.state, "provider_generated");
  assert.equal(report.generation?.isAiGenerated, true);
  assert.equal(status.state, "provider_generated");
  assert.equal(status.provider.requestedName, "openai");
  assert.equal(status.provider.executedModelName, "unit-model");
  assert.equal(status.provider.promptVersion, "unit-prompt-v1");
  assert.equal(status.fallback.used, false);
  assert.equal(status.reviewGate.humanReviewRequired, true);
  assert.equal(status.reviewGate.exportLocked, true);
  assert.ok(status.reviewGate.blockedProductionActions.includes("flash_safety_approval"));
  assert.ok(status.reviewGate.customerSafeNotice.includes("human review"));
});

test("AI reporting records provider-error fallback and keeps binary analysis safe", async () => {
  const provider: AiReportProvider = {
    name: "openai",
    modelName: "unit-provider",
    async generateReport() {
      throw new Error("unit provider failure sk-test-secret-token");
    },
  };
  const analysis = await analyzeFileExpertBuffers({
    jobId: "provider-error-fallback",
    single: calibrationLikeBuffer(),
  });
  const report = await generateAiFileExpertReport({
    sourceType: "file_expert_job",
    sourceId: null,
    result: analysis,
    metadata: {},
  }, { provider });
  const status = buildFileExpertAiReportStatus(report);
  const serialized = JSON.stringify(status);

  assert.equal(report.provider, "rule_based");
  assert.equal(report.generation?.state, "provider_error_fallback");
  assert.equal(report.generation?.fallback.used, true);
  assert.equal(report.generation?.fallback.reason, "provider_error");
  assert.equal(report.generation?.isAiGenerated, false);
  assert.equal(status.state, "provider_error_fallback");
  assert.equal(status.provider.requestedName, "openai");
  assert.equal(status.provider.status, "failed");
  assert.equal(status.provider.executedName, "rule_based");
  assert.equal(status.fallback.deterministicProvider, "rule_based");
  assert.match(status.fallback.message ?? "", /deterministic local report/i);
  assert.doesNotMatch(serialized, /sk-test-secret-token/);
  assert.equal(status.reviewGate.exportLocked, true);
  assert.ok(report.report.length > 0);
});

test("AI reporting aborts at its absolute deadline and degrades deterministically", async () => {
  let observedSignal: AbortSignal | undefined;
  const provider: AiReportProvider = {
    name: "openai",
    modelName: "hanging-unit-provider",
    async generateReport(_input, options) {
      observedSignal = options?.signal;
      return await new Promise<never>((_resolve, reject) => {
        options?.signal?.addEventListener(
          "abort",
          () => reject(new Error("deadline abort")),
          { once: true }
        );
      });
    },
  };
  const analysis = await analyzeFileExpertBuffers({
    jobId: "provider-deadline-fallback",
    single: calibrationLikeBuffer(),
  });
  const startedAt = Date.now();
  const report = await generateAiFileExpertReport({
    sourceType: "file_expert_job",
    sourceId: null,
    result: analysis,
    metadata: {},
  }, { provider, deadlineAt: startedAt + 850 });

  assert.equal(observedSignal?.aborted, true);
  assert.ok(Date.now() - startedAt < 1_250);
  assert.equal(report.provider, "rule_based");
  assert.equal(report.generation?.state, "provider_error_fallback");
  assert.equal(report.generation?.fallback.reason, "provider_error");
  assert.equal(report.generation?.isAiGenerated, false);
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

test("request DTC projection separates customer and expert boundaries", async () => {
  const projection = await analyzeRequestDtc({
    id: "request-dtc-safe",
    customer_id: "customer-1",
    vehicle_brand: "BMW",
    vehicle_model: "5 Series",
    vehicle_engine: "2.0d",
    service_type: "DTC OFF review",
    notes:
      "Customer private workshop note with P0401. storage_path=customer/private/read.bin signed_url=https://private.example SHA256=secret-hash admin note sample-secret first_64_bytes_hex=DE AD BE EF",
    ecu: "Bosch EDC17C50",
    read_method: "bench",
    hw_sw: "private-sw-marker",
  }, "customer");
  const customerSerialized = JSON.stringify(projection.customer);
  const expertSerialized = JSON.stringify(projection.expert);
  const auditSerialized = JSON.stringify(projection.auditMetadata);

  assert.equal(projection.customer.state, "provider_unavailable_fallback");
  assert.equal(projection.customer.isAiGenerated, false);
  assert.deepEqual(projection.customer.detectedCodes, ["P0401"]);
  assert.match(projection.customer.providerNotice, /deterministic non-AI fallback/i);
  assert.ok(projection.customer.humanReview.required);
  assert.equal(projection.expert.provider.providerStatus, "unavailable");
  assert.equal(projection.expert.fallback.used, true);
  assert.equal(projection.auditMetadata.customer_id, undefined);
  assert.deepEqual(projection.auditMetadata.detected_codes, ["P0401"]);

  for (const serialized of [customerSerialized, expertSerialized, auditSerialized]) {
    assert.doesNotMatch(serialized, /private workshop note/i);
    assert.doesNotMatch(serialized, /storage_path|signed_url|customer\/private|secret-hash|sample-secret/i);
    assert.doesNotMatch(serialized, /first_64_bytes_hex|DE AD BE EF|admin note|private-sw-marker/i);
    assert.doesNotMatch(serialized, /confirmed fix|DTC-off approved|customer-ready file|checksum result|byte patch approved/i);
  }
  assert.doesNotMatch(customerSerialized, /providerId|modelName|promptVersion|providerKind|providerStatus/i);
});

test("DTC analyzer configuration exposes provider and usage boundary locally", () => {
  const customerConfig = getDtcAnalyzerAdminConfigStatus("customer");
  const adminConfig = getDtcAnalyzerAdminConfigStatus("admin");
  const serialized = JSON.stringify({ customerConfig, adminConfig });

  assert.equal(customerConfig.contractVersion, "dtc-analyzer-config-v1");
  assert.equal(customerConfig.provider.configured, false);
  assert.equal(customerConfig.provider.providerStatus, "unavailable");
  assert.equal(customerConfig.provider.providerKind, "unconfigured");
  assert.equal(customerConfig.fallback.deterministicFallbackEnabled, true);
  assert.equal(customerConfig.fallback.mode, "deterministic_rules");
  assert.equal(customerConfig.usageLimits.maxAnalyzedTextLength, 2000);
  assert.equal(customerConfig.usageLimits.maxCodesPerRequest, 8);
  assert.equal(adminConfig.usageLimits.requestsPerWindow > customerConfig.usageLimits.requestsPerWindow, true);
  assert.doesNotMatch(serialized, /modelName|promptVersion|providerId|OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY/i);
});

test("DTC analyzer usage guard rejects local text, code and request limits", () => {
  const actorUserId = `user-${randomUUID()}`;
  const orderId = `order-${randomUUID()}`;
  const request = new Request("http://localhost/api/requests/test/dtc-analysis", {
    headers: { "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 100) + 1}` },
  });

  const tooLong = checkDtcAnalyzerUsage({
    request,
    scope: "customer",
    orderId: `${orderId}-long`,
    actorUserId,
    text: `P0401 ${"x".repeat(4100)}`,
  });
  assert.equal(tooLong.allowed, false);
  if (tooLong.allowed) assert.fail("Expected long DTC text to be limited.");
  assert.equal(tooLong.type, "request_text_length");
  assert.equal(tooLong.httpStatus, 413);

  const tooManyCodes = checkDtcAnalyzerUsage({
    request,
    scope: "customer",
    orderId: `${orderId}-codes`,
    actorUserId,
    text: "P0001 P0002 P0003 P0004 P0005 P0006 P0007 P0008 P0009",
  });
  assert.equal(tooManyCodes.allowed, false);
  if (tooManyCodes.allowed) assert.fail("Expected excessive DTC code count to be limited.");
  assert.equal(tooManyCodes.type, "dtc_code_count");
  assert.equal(tooManyCodes.httpStatus, 400);

  const rateOrderId = `${orderId}-rate`;
  for (let index = 0; index < 4; index += 1) {
    const allowed = checkDtcAnalyzerUsage({
      request,
      scope: "customer",
      orderId: rateOrderId,
      actorUserId,
      text: "P0401",
    });
    assert.equal(allowed.allowed, true);
  }

  const limited = checkDtcAnalyzerUsage({
    request,
    scope: "customer",
    orderId: rateOrderId,
    actorUserId,
    text: "P0401",
  });
  assert.equal(limited.allowed, false);
  if (limited.allowed) assert.fail("Expected repeated DTC usage to be rate limited.");
  assert.equal(limited.type, "request_rate");
  assert.equal(limited.httpStatus, 429);
  assert.equal(typeof limited.retryAfterSeconds, "number");
  assert.match(projectDtcUsageLimitForResponse(limited).retryAt ?? "", /^\d{4}-\d{2}-\d{2}T/);
});

test("admin DTC projection carries admin-safe configuration while customer projection stays bounded", async () => {
  const projection = await analyzeRequestDtc({
    id: "request-dtc-config",
    vehicle_brand: "BMW",
    vehicle_model: "5 Series",
    service_type: "DTC review",
    notes: "Please review P0401.",
    ecu: "Bosch EDC17",
  }, "admin", { configuration: getDtcAnalyzerAdminConfigStatus("admin") });
  const customerSerialized = JSON.stringify(projection.customer);
  const expertSerialized = JSON.stringify(projection.expert);

  assert.equal(projection.expert.configuration.provider.providerStatus, "unavailable");
  assert.equal(projection.expert.configuration.fallback.mode, "deterministic_rules");
  assert.equal(projection.expert.configuration.usageLimits.scope, "admin");
  assert.equal(projection.auditMetadata.analysis_success, false);
  assert.match(expertSerialized, /usageLimits/);
  assert.doesNotMatch(customerSerialized, /configuration|usageLimits|providerId|modelName|promptVersion|providerKind|providerStatus/i);
});

test("DTC rollout readiness report covers regression analytics and documentation gates", () => {
  const report = buildDtcRolloutReadinessReport();
  const serialized = JSON.stringify(report);
  const scenarioIds = report.regressionSuite.scenarios.map((scenario) => scenario.id).sort();

  assert.equal(report.contractVersion, dtcRolloutReadinessContractVersion);
  assert.equal(report.roadmapTaskId, "RMAP-FILE-DTC-M5-ROLLOUT-READINESS");
  assert.equal(report.status, "ready_for_operator_review");
  assert.equal(report.readiness.regressionSuite, "covered");
  assert.equal(report.readiness.analytics, "local_fixture_ready");
  assert.equal(report.readiness.documentation, "documented");
  assert.equal(report.readiness.productionRollout, "operator_approval_required");
  assert.equal(report.configurationBoundary.customerProviderStatus, "unavailable");
  assert.equal(report.configurationBoundary.adminProviderStatus, "unavailable");
  assert.equal(report.configurationBoundary.deterministicFallbackEnabled, true);
  assert.equal(report.regressionSuite.requiredScenarioCount, 7);
  assert.equal(report.regressionSuite.coveredScenarioCount, report.regressionSuite.requiredScenarioCount);
  assert.deepEqual(scenarioIds, [
    "audit_metadata_safety",
    "customer_admin_projection_boundary",
    "invalid_or_no_code_input",
    "provider_error_fallback",
    "provider_unavailable_fallback",
    "ui_no_leak_boundary",
    "usage_limit_rejection",
  ]);
  assert.ok(report.validation.localCommands.includes(".\\node_modules\\.bin\\tsx.cmd --test tests\\ecu-intelligence.test.ts"));
  assert.ok(report.validation.localCommands.includes(".\\node_modules\\.bin\\tsx.cmd --test tests\\admin-work-orders.test.ts"));
  assert.ok(report.validation.localCommands.includes(".\\node_modules\\.bin\\tsx.cmd --test tests\\ui-ux-safety.test.ts"));
  assert.ok(report.validation.localCommands.includes("npm run lint"));
  assert.ok(report.validation.localCommands.includes("npm run typecheck"));
  assert.ok(report.validation.localCommands.includes("npm test"));
  assert.ok(report.validation.localCommands.includes("git diff --check"));
  assert.match(report.validation.skippedAutonomousBuildReason, /Google Fonts/i);
  assert.ok(report.blockedProductionActions.some((item) => /production deployment/i.test(item)));
  assert.ok(report.blockedProductionActions.some((item) => /No live Supabase/i.test(item)));
  assert.ok(report.blockedProductionActions.some((item) => /No DTC-off approval/i.test(item)));
  assert.equal(report.documentation.runbook, "docs/dtc-analyzer-rollout-readiness.md");
  assert.equal(dtcRolloutAnalyticsFields.some((field) => field.key === "provider_status"), true);
  assert.doesNotMatch(
    serialized,
    /SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY|STRIPE_SECRET_KEY|storage_path|signed_url|first_64_bytes_hex|sample_id|customer-ready file|checksum result|byte patch approved/i
  );
});

test("DTC rollout analytics snapshot allow-lists fixture metadata only", async () => {
  const customerProjection = await analyzeRequestDtc({
    id: "request-dtc-rollout-analytics",
    customer_id: "customer-private",
    service_type: "DTC OFF review",
    notes: "Please review P0401 with private note and signed_url=https://private.example/read.bin",
    ecu: "Bosch EDC17C50",
  }, "customer");
  const adminProjection = await analyzeRequestDtc({
    id: "request-dtc-rollout-invalid",
    service_type: "DTC review",
    notes: "No usable diagnostic trouble code was supplied.",
  }, "admin");

  const snapshot = projectDtcRolloutAnalyticsSnapshot([
    {
      ...customerProjection.auditMetadata,
      storage_path: "customer/private/read.bin",
      signed_url: "https://private.example/read.bin",
      sha256: "secret-hash",
      customer_id: "customer-private",
      internal_note: "private note",
    },
    {
      ...adminProjection.auditMetadata,
      rawHex: "DE AD BE EF",
      sample_id: "private-sample",
      provider_secret_key: "secret",
    },
  ]);
  const serialized = JSON.stringify(snapshot);

  assert.equal(snapshot.contractVersion, dtcRolloutReadinessContractVersion);
  assert.equal(snapshot.source, "local_fixture_metadata");
  assert.equal(snapshot.eventCount, 2);
  assert.equal(snapshot.fallbackUsedCount, 2);
  assert.equal(snapshot.providerUnavailableCount, 1);
  assert.equal(snapshot.providerErrorCount, 0);
  assert.equal(snapshot.analysisSuccessCount, 0);
  assert.equal(snapshot.aiGeneratedCount, 0);
  assert.equal(snapshot.humanReviewRequiredCount, 2);
  assert.equal(snapshot.totals.detectedCodeCount, 1);
  assert.equal(snapshot.totals.riskFlagCount > 0, true);
  assert.equal(snapshot.statusCounts.fallback, 1);
  assert.equal(snapshot.statusCounts.invalid_input, 1);
  assert.equal(snapshot.stateCounts.provider_unavailable_fallback, 1);
  assert.equal(snapshot.stateCounts.no_valid_dtc, 1);
  assert.equal(snapshot.providerStatusCounts.unavailable, 1);
  assert.equal(snapshot.providerStatusCounts.ready, 1);
  assert.equal(snapshot.ignoredFieldCount, 8);
  assert.equal(snapshot.ignoredForbiddenFieldCount, 8);
  assert.ok(snapshot.allowedFields.includes("provider_status"));
  assert.ok(snapshot.allowedFields.includes("human_review_required"));
  assert.doesNotMatch(
    serialized,
    /customer-private|storage_path|signed_url|secret-hash|private note|rawHex|DE AD BE EF|sample_id|provider_secret_key/i
  );
});

test("request DTC projection makes missing and invalid DTC input explicit", async () => {
  const noCode = await analyzeRequestDtc({
    id: "request-dtc-empty",
    service_type: "DTC OFF review",
    notes: "Customer asks for diagnostic review but did not provide a code.",
  }, "customer");
  const empty = await analyzeRequestDtc({ id: "request-dtc-no-text" }, "admin");

  assert.equal(noCode.customer.state, "no_valid_dtc");
  assert.equal(noCode.customer.status, "invalid_input");
  assert.deepEqual(noCode.customer.detectedCodes, []);
  assert.match(noCode.customer.stateLabel, /No valid DTC code/i);
  assert.match(noCode.customer.summary, /No valid SAE-style DTC code/i);
  assert.equal(noCode.customer.isAiGenerated, false);

  assert.equal(empty.customer.state, "no_request_text");
  assert.equal(empty.customer.status, "invalid_input");
  assert.match(empty.customer.stateLabel, /No request text/i);
  assert.match(empty.customer.summary, /Enter at least one diagnostic trouble code/i);
  assert.equal(empty.expert.provider.providerStatus, "ready");
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

test("Tune Advisor exposes provider-unavailable state before fallback", async () => {
  const provider = new UnavailableTuneAdvisorProvider("Local Tune Advisor provider is disabled.");
  const response = await provider.analyzeTuneRequest({
    source: "local_test",
    services: { primaryServiceId: "stage_1" },
  });

  assert.equal(response.contractVersion, tuneAdvisorContractVersion);
  assert.equal(response.status, "provider_unavailable");
  assert.equal(response.provider.providerId, "unconfigured_tune_advisor_provider");
  assert.equal(response.provider.providerStatus, "unavailable");
  assert.equal(response.provider.unavailableReason, "Local Tune Advisor provider is disabled.");
  assert.equal(response.fallback.used, false);
  assert.equal(response.isAiGenerated, false);
  assert.equal(response.confidence, "none");
  assert.ok(response.evidence.some((item) => item.source === "provider_state"));
  assert.ok(response.riskFlags.some((item) => item.kind === "provider_unavailable"));
  assert.ok(response.recommendations.some((item) => item.category === "fallback_notice"));
  assert.ok(response.humanReview.required);
});

test("Tune Advisor deterministic fallback handles Stage 1 request guidance safely", async () => {
  const response = await analyzeTuneAdvisorRequest({
    source: "local_test",
    vehicle: {
      brand: "BMW",
      model: "5 Series",
      engine: "530d",
      ecuType: "Bosch EDC17C50",
      readMethod: "bench",
      hwSw: "SW1037550001",
    },
    services: {
      primaryServiceId: "stage_1",
      extraServiceIds: ["log_file_review"],
      evidenceCount: 3,
      highQualityEvidenceCount: 2,
      mapDefinitionsAvailable: true,
    },
  });
  const serialized = JSON.stringify(response);

  assert.equal(response.status, "fallback");
  assert.equal(response.provider.providerStatus, "unavailable");
  assert.equal(response.fallback.used, true);
  assert.equal(response.fallback.providerId, "deterministic_rules");
  assert.equal(response.isAiGenerated, false);
  assert.equal(response.readiness, "evidence_supported_review");
  assert.equal(response.confidence, "medium");
  assert.equal(response.normalizedService.primary?.id, "stage_1");
  assert.ok(response.guidance.some((item) => item.category === "stage_calibration"));
  assert.ok(response.missingInformation.some((item) => /Original file identity/i.test(item)));
  assert.ok(response.riskFlags.some((item) => item.kind === "stage_calibration_review"));
  assert.ok(response.recommendations.some((item) => item.category === "human_review_gate"));
  assert.ok(response.humanReview.requiredBefore.some((item) => /calibration byte changes/i.test(item)));
  assert.ok(response.safetyBoundaries.some((item) => /does not approve calibration bytes/i.test(item)));
  assert.ok(response.blockedProductionActions.includes("customer_ready_mod_export"));
  assert.equal(tuneAdvisorBlockedProductionActions.includes("checksum_approval"), true);
  assert.doesNotMatch(serialized, /customer-ready file|checksum completed|safe to flash|exact \d+\s*(hp|nm)|automatic delivery/i);
  assert.doesNotMatch(serialized, /storage_path|signed_url|service_role|first_64_bytes_hex|rawHex|sample_id/i);
});

test("Tune Advisor flags missing metadata and risky advanced service contexts", async () => {
  const response = await analyzeTuneAdvisorRequest({
    source: "admin_request",
    services: {
      serviceSummary: "Stage 2 + DPF Removal + DTC OFF + Checksum",
    },
  });

  assert.equal(response.status, "fallback");
  assert.equal(response.readiness, "needs_metadata");
  assert.equal(response.confidence, "low");
  assert.equal(response.normalizedService.primary?.id, "stage_2");
  assert.ok(response.normalizedService.extras.some((item) => item.id === "dpf_off"));
  assert.ok(response.normalizedService.extras.some((item) => item.id === "dtc_off"));
  assert.ok(response.normalizedService.extras.some((item) => item.id === "checksum"));
  assert.ok(response.missingInformation.some((item) => /Vehicle brand/i.test(item)));
  assert.ok(response.riskFlags.some((item) => item.kind === "emissions_or_legal_review"));
  assert.ok(response.riskFlags.some((item) => item.kind === "diagnostic_uncertainty"));
  assert.ok(response.riskFlags.some((item) => item.kind === "checksum_not_approved"));
  assert.ok(response.recommendations.some((item) => /legal, hardware and diagnostic review/i.test(item.text)));
  assert.ok(response.recommendations.some((item) => /Tune Advisor cannot approve/i.test(item.text)));
});

test("Tune Advisor handles ECO, TCU and Only Options service contexts", async () => {
  const eco = await analyzeTuneAdvisorRequest({
    source: "local_test",
    vehicle: { brand: "VW", model: "Golf", engine: "2.0 TDI", ecuType: "EDC17", readMethod: "OBD", hwSw: "SW1" },
    services: { primaryServiceId: "eco_tuning" },
  });
  const tcu = await analyzeTuneAdvisorRequest({
    source: "local_test",
    vehicle: { brand: "Audi", model: "A6", engine: "3.0 TDI", ecuType: "TCU", readMethod: "bench", hwSw: "TCU-SW" },
    services: { serviceSummary: "TCU tuning with gearbox shift review" },
  });
  const tcuStage = await analyzeTuneAdvisorRequest({
    source: "local_test",
    vehicle: { brand: "BMW", model: "M3", engine: "3.0", ecuType: "TCU", readMethod: "bench", hwSw: "TCU-SW2" },
    services: { primaryServiceId: "tcu_stage_2" },
  });
  const onlyOptions = await analyzeTuneAdvisorRequest({
    source: "local_test",
    services: { primaryServiceId: "only_options", extraServiceIds: ["vmax_off", "launch_control"] },
  });

  assert.ok(eco.guidance.some((item) => item.category === "eco_calibration"));
  assert.ok(eco.guidance.some((item) => /does not estimate fuel savings/i.test(item.summary)));
  assert.equal(tcu.normalizedService.primary?.id, "tcu_tuning");
  assert.ok(tcu.guidance.some((item) => item.category === "tcu_calibration"));
  assert.ok(tcu.riskFlags.some((item) => item.kind === "tcu_review"));
  assert.equal(tcuStage.normalizedService.primary?.id, "tcu_tuning");
  assert.equal(tcuStage.normalizedService.primary?.label, "TCU Stage 2");
  assert.equal(onlyOptions.normalizedService.primary?.id, "only_options");
  assert.ok(onlyOptions.guidance.some((item) => item.category === "options_only"));
  assert.ok(onlyOptions.riskFlags.some((item) => item.kind === "driveability_or_safety_review"));
});

test("Tune Advisor provider errors preserve provider identity and non-AI fallback", async () => {
  class ThrowingTuneProvider implements TuneAdvisorProvider {
    readonly providerId = "throwing_tune_provider";
    readonly providerKind = "external_ai" as const;
    readonly modelName = "private-tune-model";

    async analyzeTuneRequest(_input: TuneAdvisorRequest): Promise<never> {
      void _input;
      throw new Error("provider failed with sk-test-secret-token");
    }
  }

  const response = await analyzeTuneAdvisorRequest({
    source: "admin_request",
    vehicle: { brand: "BMW", model: "3 Series", engine: "320d", ecuType: "EDC17", readMethod: "bench", hwSw: "SW2" },
    services: { primaryServiceId: "stage_1" },
  }, { provider: new ThrowingTuneProvider() });
  const serialized = JSON.stringify(response);

  assert.equal(response.status, "fallback");
  assert.equal(response.provider.providerId, "throwing_tune_provider");
  assert.equal(response.provider.providerStatus, "error");
  assert.equal(response.provider.modelName, "private-tune-model");
  assert.equal(response.fallback.used, true);
  assert.equal(response.isAiGenerated, false);
  assert.ok(response.confidenceReasons.some((item) => /provider unavailable or failed/i.test(item.text)));
  assert.doesNotMatch(serialized, /sk-test-secret-token/);
});

test("request Tune Advisor projection separates customer and expert boundaries", async () => {
  const projection = await analyzeRequestTuneAdvisor({
    id: "request-tune-safe",
    customer_id: "customer-private",
    vehicle_brand: "BMW",
    vehicle_model: "5 Series",
    vehicle_engine: "530d",
    ecu: "Bosch EDC17C50",
    read_method: "bench",
    hw_sw: "SW1037550001",
    service_type: "Stage 1 + EGR OFF + Checksum",
    notes: "Private note with storage_path and signed_url should not be projected.",
  }, "admin");
  const customerSerialized = JSON.stringify(projection.customer);
  const expertSerialized = JSON.stringify(projection.expert);

  assert.equal(projection.customer.contractVersion, tuneAdvisorContractVersion);
  assert.equal(projection.customer.isAiGenerated, false);
  assert.equal(projection.customer.state, "provider_unavailable_fallback");
  assert.match(projection.customer.providerNotice, /deterministic non-AI fallback/i);
  assert.ok(projection.customer.riskFlags.some((item) => item.kind === "emissions_or_legal_review"));
  assert.ok(projection.customer.riskFlags.some((item) => item.kind === "checksum_not_approved"));
  assert.equal(projection.expert.provider.providerStatus, "unavailable");
  assert.equal(projection.expert.fallback.used, true);
  assert.ok(projection.expert.requiredHumanChecks.some((item) => /checksum approval/i.test(item)));
  assert.ok(projection.expert.blockedProductionActions.includes("checksum_approval"));
  assert.equal(projection.auditMetadata.primary_service_id, "stage_1");
  assert.equal(projection.auditMetadata.provider_status, "unavailable");
  assert.doesNotMatch(customerSerialized, /providerId|modelName|promptVersion|providerKind|providerStatus/i);
  assert.doesNotMatch(customerSerialized, /storage_path|signed_url|customer-private|sample_id|raw|hex|private note/i);
  assert.match(expertSerialized, /providerStatus/);
  assert.match(expertSerialized, /blockedProductionActions/);
});

test("Log Analyzer exposes provider-unavailable state before fallback", async () => {
  const provider = new UnavailableLogAnalyzerProvider("Local Log Analyzer provider is disabled.");
  const response = await provider.analyzeLog({
    source: "local_test",
    rows: [
      { rpm: 2200, torqueNm: 390 },
      { rpm: 2600, torqueNm: 430 },
    ],
  });

  assert.equal(response.contractVersion, logAnalyzerContractVersion);
  assert.equal(response.status, "provider_unavailable");
  assert.equal(response.provider.providerId, "unconfigured_log_analyzer_provider");
  assert.equal(response.provider.providerStatus, "unavailable");
  assert.equal(response.provider.unavailableReason, "Local Log Analyzer provider is disabled.");
  assert.equal(response.fallback.used, false);
  assert.equal(response.isAiGenerated, false);
  assert.equal(response.confidence, "none");
  assert.equal(response.normalizedInput.validRowCount, 2);
  assert.ok(response.evidence.some((item) => item.source === "provider_state"));
  assert.ok(response.riskFlags.some((item) => item.kind === "provider_unavailable"));
  assert.ok(response.recommendations.some((item) => item.category === "fallback_notice"));
  assert.ok(response.humanReview.required);
});

test("Log Analyzer deterministic fallback summarizes RPM and torque rows safely", async () => {
  const response = await analyzeLogRequest({
    source: "local_test",
    text: "1800, 320\n2200, 390\n2600, 430\n3000, 420\n3400, 395\n3800, 360\n4200, 315",
    vehicle: {
      brand: "BMW",
      model: "5 Series",
      engine: "530d",
      ecuType: "Bosch EDC17C50",
      readMethod: "bench",
    },
  });
  const serialized = JSON.stringify(response);

  assert.equal(response.status, "fallback");
  assert.equal(response.provider.providerStatus, "unavailable");
  assert.equal(response.fallback.used, true);
  assert.equal(response.fallback.providerId, "deterministic_rules");
  assert.equal(response.isAiGenerated, false);
  assert.equal(response.readiness, "evidence_supported_review");
  assert.equal(response.confidence, "medium");
  assert.equal(response.normalizedInput.sourceFormat, "text_rows");
  assert.equal(response.normalizedInput.validRowCount, 7);
  assert.deepEqual(response.logSummary.rpmRange, { min: 1800, max: 4200 });
  assert.equal(response.logSummary.peakTorque?.torqueNm, 430);
  assert.equal(response.logSummary.peakTorque?.rpm, 2600);
  assert.ok((response.logSummary.peakPower?.hp ?? 0) > 190);
  assert.ok(response.evidence.some((item) => item.type === "peak_estimate"));
  assert.ok(response.riskFlags.some((item) => item.kind === "dyno_equivalence_risk"));
  assert.ok(response.riskFlags.some((item) => item.kind === "provider_unavailable"));
  assert.ok(response.recommendations.some((item) => item.category === "human_review_gate"));
  assert.ok(response.confidenceReasons.some((item) => /deterministic fallback/i.test(item.text)));
  assert.ok(response.safetyBoundaries.some((item) => /not a calibrated chassis-dyno measurement/i.test(item)));
  assert.ok(response.blockedProductionActions.includes("customer_ready_mod_export"));
  assert.equal(logAnalyzerBlockedProductionActions.includes("checksum_approval"), true);
  assert.doesNotMatch(serialized, /1800, 320|2200, 390|storage_path|signed_url|service_role|first_64_bytes_hex|rawHex|sample_id/i);
  assert.doesNotMatch(serialized, /customer-ready file|checksum completed|safe to flash|automatic delivery/i);
});

test("Log Analyzer handles AutoTuner CSV headers, invalid and empty input", async () => {
  const autotuner = await analyzeLogRequest({
    source: "browser_tool",
    text: '"Time","Engine Speed (rpm)","Engine Torque (Nm)"\n"0.1","1800","320"\n"0.2","2200","390"\n"0.3","bad","private"',
  });
  const invalid = await analyzeLogRequest({
    source: "customer_request",
    text: "private note storage_path=customer/private/log.csv signed_url=https://private.example",
  });
  const empty = await analyzeLogRequest({
    source: "customer_request",
    text: "   ",
  });

  assert.equal(autotuner.status, "fallback");
  assert.equal(autotuner.normalizedInput.sourceFormat, "autotuner_csv");
  assert.equal(autotuner.normalizedInput.validRowCount, 2);
  assert.equal(autotuner.normalizedInput.rejectedRowCount, 1);

  assert.equal(invalid.status, "invalid_input");
  assert.equal(invalid.normalizedInput.validRowCount, 0);
  assert.equal(invalid.confidence, "none");
  assert.match(invalid.summary, /No valid RPM and torque rows/i);
  assert.ok(invalid.evidence.some((item) => item.type === "input_validation"));
  assert.ok(invalid.riskFlags.some((item) => item.kind === "invalid_input"));
  assert.ok(invalid.recommendations.some((item) => item.category === "missing_information"));
  assert.doesNotMatch(JSON.stringify(invalid), /customer\/private|signed_url|private\.example/i);

  assert.equal(empty.status, "invalid_input");
  assert.equal(empty.normalizedInput.sourceFormat, "empty");
  assert.equal(empty.confidence, "none");
  assert.match(empty.summary, /Provide log rows/i);
});

test("Log Analyzer provider errors preserve provider identity and non-AI fallback", async () => {
  class ThrowingLogProvider implements LogAnalyzerProvider {
    readonly providerId = "throwing_log_provider";
    readonly providerKind = "external_ai" as const;
    readonly modelName = "private-log-model";

    async analyzeLog(_input: LogAnalyzerRequest): Promise<never> {
      void _input;
      throw new Error("provider failed with sk-log-secret-token");
    }
  }

  const response = await analyzeLogRequest({
    source: "admin_request",
    rows: [
      { rpm: 2000, torqueNm: 350 },
      { rpm: 2600, torqueNm: 430 },
      { rpm: 3300, torqueNm: 410 },
      { rpm: 3900, torqueNm: 360 },
    ],
    vehicle: { brand: "BMW", model: "3 Series", engine: "320d", ecuType: "EDC17", readMethod: "bench" },
  }, { provider: new ThrowingLogProvider() });
  const serialized = JSON.stringify(response);

  assert.equal(response.status, "fallback");
  assert.equal(response.provider.providerId, "throwing_log_provider");
  assert.equal(response.provider.providerStatus, "error");
  assert.equal(response.provider.modelName, "private-log-model");
  assert.equal(response.fallback.used, true);
  assert.equal(response.isAiGenerated, false);
  assert.ok(response.confidenceReasons.some((item) => /provider unavailable or failed/i.test(item.text)));
  assert.ok(response.evidence.some((item) => item.source === "provider_state" && item.severity === "warning"));
  assert.doesNotMatch(serialized, /sk-log-secret-token/);
});

test("request Log Analyzer projection separates customer and expert boundaries", async () => {
  const projection = await analyzeRequestLog({
    id: "request-log-safe",
    customer_id: "customer-private",
    vehicle_brand: "BMW",
    vehicle_model: "5 Series",
    vehicle_engine: "530d",
    ecu: "Bosch EDC17C50",
    read_method: "bench",
    fileName: "customer-name-private-log.csv",
    logText: '"Time","Engine Speed (rpm)","Engine Torque (Nm)"\n"0.1","1800","320"\n"0.2","2600","430"\n"0.3","3800","360"',
    notes: "Private note with storage_path signed_url SHA256=secret-hash first_64_bytes_hex=DE AD BE EF.",
  }, "admin");
  const customerSerialized = JSON.stringify(projection.customer);
  const expertSerialized = JSON.stringify(projection.expert);
  const auditSerialized = JSON.stringify(projection.auditMetadata);

  assert.equal(projection.customer.contractVersion, logAnalyzerContractVersion);
  assert.equal(projection.customer.isAiGenerated, false);
  assert.equal(projection.customer.state, "provider_unavailable_fallback");
  assert.match(projection.customer.providerNotice, /deterministic non-AI fallback/i);
  assert.equal(projection.customer.logSummary.validRowCount, 3);
  assert.equal(projection.expert.provider.providerStatus, "unavailable");
  assert.equal(projection.expert.fallback.used, true);
  assert.ok(projection.expert.blockedProductionActions.includes("checksum_approval"));
  assert.equal(projection.auditMetadata.provider_status, "unavailable");
  assert.equal(projection.auditMetadata.customer_id, undefined);

  assert.doesNotMatch(customerSerialized, /providerId|modelName|promptVersion|providerKind|providerStatus/i);
  for (const serialized of [customerSerialized, expertSerialized, auditSerialized]) {
    assert.doesNotMatch(serialized, /customer-private|customer-name-private-log|Private note/i);
    assert.doesNotMatch(serialized, /storage_path|signed_url|secret-hash|first_64_bytes_hex|DE AD BE EF/i);
    assert.doesNotMatch(serialized, /raw CSV|raw binary|customer-ready file|checksum completed|safe to flash/i);
  }
  assert.match(expertSerialized, /providerStatus/);
  assert.match(expertSerialized, /blockedProductionActions/);
});

function aiExplainRequestFixture(): AiExplainRequest {
  return {
    surface: "dtc_analyzer",
    subject: "request-level recommendation",
    items: [
      {
        id: "dtc-evidence",
        kind: "evidence",
        source: "diagnostic_evidence",
      },
      {
        id: "rule-recommendation",
        kind: "recommendation",
        source: "deterministic_rules",
      },
      {
        id: "safety-risk",
        kind: "risk_flag",
        source: "safety_boundary",
        requiresHumanReview: true,
      },
      {
        id: "expert-review",
        kind: "human_review_gate",
        source: "human_review",
        requiresHumanReview: true,
      },
    ],
    context: {
      vehiclePresent: true,
      diagnosticEvidencePresent: true,
      serviceMetadataPresent: true,
    },
    privateMetadata: {
      customer_id: "customer-private",
      storage_path: "customer-private/request/file.bin",
      signed_url: "https://private.example/signed",
      sample_id: "private-sample",
      raw_hex: "DE AD BE EF",
      admin_note: "private note",
    },
  };
}

test("AI Explain Layer source labels cover evidence, recommendations, risks and state", () => {
  const request = aiExplainRequestFixture();
  const labels = buildAiExplainSourceLabels(request.items, {
    providerStatus: "unavailable",
    fallbackUsed: true,
  });
  const kinds = new Set(labels.map((label) => label.itemKind));

  assert.ok(kinds.has("evidence"));
  assert.ok(kinds.has("recommendation"));
  assert.ok(kinds.has("risk_flag"));
  assert.ok(kinds.has("human_review_gate"));
  assert.ok(kinds.has("provider_state"));
  assert.ok(kinds.has("fallback_state"));
  assert.ok(labels.some((label) => label.sourceCategory === "unavailable_state"));
  assert.ok(labels.some((label) => label.sourceCategory === "deterministic_rules"));
  assert.ok(labels.every((label) => label.customerVisible));
  assert.ok(labels.some((label) => label.requiresHumanReview));
});

test("AI Explain Layer exposes provider-unavailable state before fallback", async () => {
  const provider = new UnavailableAiExplainProvider("Local AI Explain provider is disabled.");
  const response = await provider.explain(aiExplainRequestFixture());

  assert.equal(response.contractVersion, aiExplainLayerContractVersion);
  assert.equal(response.status, "provider_unavailable");
  assert.equal(response.state, "provider_unavailable");
  assert.equal(response.provider.providerId, "unconfigured_ai_explain_provider");
  assert.equal(response.provider.providerStatus, "unavailable");
  assert.equal(response.provider.unavailableReason, "Local AI Explain provider is disabled.");
  assert.equal(response.fallback.used, false);
  assert.equal(response.isAiGenerated, false);
  assert.equal(response.confidence, "none");
  assert.equal(response.unavailableState.unavailable, true);
  assert.ok(response.sourceLabels.some((label) => label.itemKind === "provider_state"));
  assert.ok(response.humanReview.required);
});

test("AI Explain Layer default behavior is deterministic non-AI fallback", async () => {
  const response = await analyzeAiExplainRequest(aiExplainRequestFixture());
  const serialized = JSON.stringify(response);
  const kinds = new Set(response.sourceLabels.map((label) => label.itemKind));

  assert.equal(response.contractVersion, "ai-explain-layer-v1");
  assert.equal(response.status, "fallback");
  assert.equal(response.state, "provider_unavailable_fallback");
  assert.equal(response.provider.providerStatus, "unavailable");
  assert.equal(response.fallback.used, true);
  assert.equal(response.fallback.providerId, "deterministic_rules");
  assert.equal(response.isAiGenerated, false);
  assert.equal(response.confidence, "medium");
  assert.ok(kinds.has("evidence"));
  assert.ok(kinds.has("recommendation"));
  assert.ok(kinds.has("risk_flag"));
  assert.ok(kinds.has("human_review_gate"));
  assert.ok(kinds.has("provider_state"));
  assert.ok(kinds.has("fallback_state"));
  assert.ok(response.explanationCards.some((card) => card.id === "provider-fallback-state"));
  assert.ok(response.humanReview.required);
  assert.ok(response.blockedProductionActions.includes("checksum_approval"));
  assert.equal(aiExplainLayerBlockedProductionActions.includes("automatic_delivery"), true);
  assert.doesNotMatch(serialized, /customer-private|private\.example|private-sample|DE AD BE EF|private note/i);
});

test("AI Explain Layer provider errors preserve expert state without leaking thrown secrets", async () => {
  class ThrowingExplainProvider implements AiExplainProvider {
    readonly providerId = "throwing_explain_provider";
    readonly providerKind = "external_ai" as const;
    readonly modelName = "private-explain-model";

    async explain(_input: AiExplainRequest): Promise<never> {
      void _input;
      throw new Error("provider failed with sk-explain-secret-token");
    }
  }

  const response = await analyzeAiExplainRequest(aiExplainRequestFixture(), {
    provider: new ThrowingExplainProvider(),
  });
  const serialized = JSON.stringify(response);

  assert.equal(response.status, "fallback");
  assert.equal(response.state, "provider_error_fallback");
  assert.equal(response.provider.providerId, "throwing_explain_provider");
  assert.equal(response.provider.providerStatus, "error");
  assert.equal(response.provider.modelName, "private-explain-model");
  assert.equal(response.fallback.used, true);
  assert.equal(response.isAiGenerated, false);
  assert.ok(response.sourceLabels.some((label) => label.itemKind === "provider_state" && label.severity === "warning"));
  assert.doesNotMatch(serialized, /sk-explain-secret-token/);
});

test("AI Explain Layer projection separates customer and expert boundaries", async () => {
  const response = await analyzeAiExplainRequest(aiExplainRequestFixture());
  const projection = projectAiExplainResponse(response);
  const customerSerialized = JSON.stringify(projection.customer);
  const expertSerialized = JSON.stringify(projection.expert);
  const auditSerialized = JSON.stringify(projection.auditMetadata);

  assert.equal(projection.customer.contractVersion, aiExplainLayerContractVersion);
  assert.equal(projection.customer.isAiGenerated, false);
  assert.equal(projection.customer.state, "provider_unavailable_fallback");
  assert.match(projection.customer.providerNotice, /deterministic non-AI explanation labels/i);
  assert.equal(hasAiExplainCustomerLeak(projection.customer), false);
  assert.equal(projection.expert.provider.providerStatus, "unavailable");
  assert.equal(projection.expert.fallback.used, true);
  assert.ok(projection.expert.requiredHumanChecks.some((item) => /checksum approval/i.test(item)));
  assert.ok(projection.expert.blockedProductionActions.includes("checksum_approval"));
  assert.equal(projection.auditMetadata.provider_status, "unavailable");
  assert.equal(projection.auditMetadata.customer_id, undefined);

  assert.doesNotMatch(customerSerialized, /providerId|providerKind|providerStatus|modelName|promptVersion|"fallback":/i);
  for (const serialized of [customerSerialized, expertSerialized, auditSerialized]) {
    assert.doesNotMatch(serialized, /customer-private|private\.example|private-sample|DE AD BE EF|private note/i);
    assert.doesNotMatch(serialized, /storage_path|signed_url|raw_hex|first_64_bytes_hex|customer-ready file|safe to flash/i);
  }
  assert.match(expertSerialized, /providerStatus/);
  assert.match(expertSerialized, /fallback/);
  assert.match(expertSerialized, /blockedProductionActions/);
});

test("AI Explain Layer expert projection keeps source labels hidden from customers", async () => {
  const response = await analyzeAiExplainRequest({
    ...aiExplainRequestFixture(),
    items: [
      {
        id: "internal-file-summary",
        kind: "evidence",
        source: "file_analysis_summary",
        customerSafe: false,
      },
      {
        id: "safe-rule-recommendation",
        kind: "recommendation",
        source: "deterministic_rules",
      },
    ],
  });
  const projection = projectAiExplainResponse(response);

  assert.equal(
    projection.customer.sourceLabels.some((label) => label.sourceCategory === "file_analysis_summary"),
    false
  );
  assert.equal(
    projection.expert.sourceLabels.some((label) => label.sourceCategory === "file_analysis_summary"),
    true
  );
  assert.equal(hasAiExplainCustomerLeak(projection.customer), false);
});

function fileQualityScoreRequestFixture(): FileQualityScoreRequest {
  const inspection: NonNullable<FileExpertAnalyzerResult["files"]["ori"]> = {
    file_size: 4096,
    sha256: "secret-quality-hash",
    first_64_bytes_hex: "DE AD BE EF",
    last_64_bytes_hex: "FE ED FA CE",
    ff_ratio: 0.1,
    zero_ratio: 0.05,
    entropy: 7.1,
    ascii_strings: ["private printable marker"],
    ecu_identifiers: ["Bosch EDC17"],
    file_format: "raw_binary",
    read_scope: "full_read",
    read_scope_confidence: 0.8,
    hardware_numbers: ["private-hw"],
    software_numbers: ["private-sw"],
    calibration_ids: [],
    vins: ["WBA00000000000000"],
    engine_codes: [],
  };

  return {
    source: "local_test",
    metadata: {
      brand: "BMW",
      model: "5 Series",
      engine: "530d",
      ecuType: "Bosch EDC17C50",
      ecuFamily: "EDC17",
      readMethod: "bench",
      hwSw: "SW1037550001",
    },
    service: {
      serviceSummary: "Stage 1 review with checksum preparation",
      requestedServiceLabels: ["Stage 1"],
      selectedOptionLabels: ["Checksum"],
      customerNotesPresent: true,
    },
    review: {
      qualityCheckStatus: "needs_review",
      humanReviewStatus: "in_review",
    },
    analyzerResult: {
      job_id: "private-quality-job",
      analysis_version: "test",
      mode: "ori_mod_compare",
      source: {
        kind: "manual_file_expert",
        ori_file_name: "private-ori.bin",
        mod_file_name: "private-mod.bin",
      },
      metadata: {
        brand: "BMW",
        model: "5 Series",
        engine: "530d",
        ecu_type: "Bosch EDC17C50",
        read_method: "Bench",
      },
      files: {
        ori: inspection,
        mod: {
          ...inspection,
          sha256: "secret-quality-mod-hash",
          first_64_bytes_hex: "BA AD F0 0D",
        },
      },
      comparison: {
        same_size: true,
        changed_bytes: 128,
        changed_percent: 3.1,
        raw_changed_blocks: 2,
        merged_changed_blocks: 1,
        changed_blocks: [],
      },
      active_regions: [],
      map_candidates: [{
        offset_hex: "0x00001000",
        length: 256,
        possible_type: "calibration",
        reason: "private map reason",
        confidence: 0.7,
      }],
      repeated_patterns: [],
      possible_features: [{
        feature: "stage1",
        confidence: 0.7,
        reasons: ["private feature reason"],
      }],
      ecu_identification: {
        status: "detected",
        module_type: "ECU",
        supplier: "Bosch",
        family: "EDC17",
        variant: "C50",
        display_name: "Bosch EDC17C50",
        processor: null,
        confidence: 0.82,
        evidence: ["private ecu evidence"],
        hardware_numbers: ["private-hw"],
        software_numbers: ["private-sw"],
        calibration_ids: [],
        vins: ["WBA00000000000000"],
        engine_codes: [],
      },
      vehicle_match: {
        total_matches: 1,
        exact_vehicle_identified: true,
        summary: "private vehicle match",
        candidates: [],
      },
      change_profile: {
        classification: "focused_calibration",
        label: "Focused calibration",
        summary: "private profile",
        confidence: 0.74,
        affected_area_percent: 3.1,
        changed_regions: 1,
      },
      findings: [],
      integrity_assessment: {
        file_size_match: true,
        ecu_identity_match: true,
        vin_match: null,
        checksum_status: "not_checked",
        issues: [],
      },
      risk_assessment: {
        risk_level: "low",
        confidence: 0.74,
        reasons: ["private risk reason"],
        warnings: [],
      },
      summary: {
        stock_or_modified: "likely_modified",
        main_conclusion: "Structured analyzer summary is present.",
        recommended_next_steps: ["private next step"],
      },
    },
    privateMetadata: {
      customer_id: "customer-private",
      storage_path: "customer/private/file.bin",
      signed_url: "https://private.example/signed",
      sample_id: "sample-private",
      raw_hex: "DE AD BE EF",
      admin_note: "private admin note",
    },
  };
}

test("File Quality Score exposes provider-unavailable state before fallback", async () => {
  const provider = new UnavailableFileQualityScoreProvider("Local File Quality Score provider is disabled.");
  const response = await provider.scoreFileQuality(fileQualityScoreRequestFixture());

  assert.equal(response.contractVersion, fileQualityScoreContractVersion);
  assert.equal(response.status, "provider_unavailable");
  assert.equal(response.state, "provider_unavailable");
  assert.equal(response.provider.providerId, "unconfigured_file_quality_score_provider");
  assert.equal(response.provider.providerStatus, "unavailable");
  assert.equal(response.provider.unavailableReason, "Local File Quality Score provider is disabled.");
  assert.equal(response.fallback.used, false);
  assert.equal(response.isAiGenerated, false);
  assert.equal(response.score, 0);
  assert.equal(response.grade, "not_scorable");
  assert.equal(response.readiness, "unavailable");
  assert.ok(response.factorBreakdown.some((factor) => factor.id === "provider_state"));
  assert.ok(response.humanReview.required);
});

test("File Quality Score deterministic baseline grades strong structured evidence", async () => {
  const response = await analyzeFileQualityScoreRequest(fileQualityScoreRequestFixture());
  const factorIds = new Set(response.factorBreakdown.map((factor) => factor.id));

  assert.equal(response.contractVersion, "file-quality-score-v1");
  assert.equal(response.status, "fallback");
  assert.equal(response.state, "provider_unavailable_fallback");
  assert.equal(response.provider.providerStatus, "unavailable");
  assert.equal(response.fallback.used, true);
  assert.equal(response.isAiGenerated, false);
  assert.ok(response.score >= 75);
  assert.ok(["A", "B"].includes(response.grade));
  assert.equal(response.readiness, "ready_for_expert_review");
  assert.ok(factorIds.has("metadata_completeness"));
  assert.ok(factorIds.has("file_evidence"));
  assert.ok(factorIds.has("integrity_compatibility"));
  assert.ok(factorIds.has("analysis_confidence"));
  assert.ok(response.evidenceReasons.some((reason) => /ORI\/MOD comparison summary/i.test(reason)));
  assert.ok(response.humanReview.required);
  assert.ok(response.blockedProductionActions.includes("checksum_approval"));
  assert.equal(fileQualityScoreBlockedProductionActions.includes("automatic_delivery"), true);
});

test("File Quality Score weak and blocked evidence stays explicit", async () => {
  const request = fileQualityScoreRequestFixture();
  const response = await analyzeFileQualityScoreRequest({
    ...request,
    metadata: { brand: "BMW" },
    service: {
      serviceSummary: null,
      requestedServiceLabels: [],
      selectedOptionLabels: [],
      customerNotesPresent: false,
    },
    review: {
      qualityCheckStatus: "failed",
      reviewBlockers: ["private blocker with storage_path customer/private"],
      humanReviewStatus: "rejected",
    },
    analyzerResult: {
      ...(request.analyzerResult as FileExpertAnalyzerResult),
      comparison: {
        same_size: false,
        changed_bytes: 0,
        changed_percent: 0,
        raw_changed_blocks: 0,
        merged_changed_blocks: 0,
        changed_blocks: [],
      },
      map_candidates: [],
      possible_features: [],
      change_profile: undefined,
      integrity_assessment: {
        file_size_match: false,
        ecu_identity_match: null,
        vin_match: null,
        checksum_status: "not_checked",
        issues: ["private integrity issue"],
      },
      findings: [{
        id: "critical-integrity",
        category: "integrity",
        severity: "critical",
        title: "Integrity review required",
        summary: "private finding",
        confidence: 0.9,
        evidence: ["private finding evidence"],
      }],
      risk_assessment: {
        risk_level: "high",
        confidence: 0.2,
        reasons: ["private risk reason"],
        warnings: ["private warning"],
      },
      summary: {
        stock_or_modified: "unknown",
        main_conclusion: "",
        recommended_next_steps: [],
      },
    },
  });
  const serialized = JSON.stringify(response);

  assert.equal(response.status, "fallback");
  assert.equal(response.readiness, "blocked");
  assert.equal(response.confidence, "none");
  assert.ok(response.score < 55);
  assert.ok(response.riskFlags.some((flag) => flag.kind === "high_risk_file" && flag.severity === "critical"));
  assert.ok(response.riskFlags.some((flag) => flag.kind === "review_blocker"));
  assert.ok(response.missingInformation.some((item) => /Requested service/i.test(item)));
  assert.doesNotMatch(serialized, /private blocker|customer\/private|private risk reason|private finding evidence/i);
});

test("File Quality Score invalid input does not look like successful AI analysis", async () => {
  const response = await analyzeFileQualityScoreRequest({ source: "local_test" });

  assert.equal(response.status, "invalid_input");
  assert.equal(response.state, "invalid_input");
  assert.equal(response.fallback.used, true);
  assert.equal(response.isAiGenerated, false);
  assert.equal(response.score, 0);
  assert.equal(response.grade, "not_scorable");
  assert.equal(response.readiness, "blocked");
  assert.equal(response.confidence, "none");
  assert.ok(response.riskFlags.some((flag) => flag.kind === "invalid_input"));
  assert.match(response.summary, /structured File Expert output|request metadata/i);
});

test("File Quality Score provider errors preserve expert state without leaking thrown secrets", async () => {
  class ThrowingQualityProvider implements FileQualityScoreProvider {
    readonly providerId = "throwing_quality_provider";
    readonly providerKind = "external_ai" as const;
    readonly modelName = "private-quality-model";

    async scoreFileQuality(_input: FileQualityScoreRequest): Promise<never> {
      void _input;
      throw new Error("provider failed with sk-quality-secret-token");
    }
  }

  const response = await analyzeFileQualityScoreRequest(fileQualityScoreRequestFixture(), {
    provider: new ThrowingQualityProvider(),
  });
  const serialized = JSON.stringify(response);

  assert.equal(response.status, "fallback");
  assert.equal(response.state, "provider_error_fallback");
  assert.equal(response.provider.providerId, "throwing_quality_provider");
  assert.equal(response.provider.providerStatus, "error");
  assert.equal(response.provider.modelName, "private-quality-model");
  assert.equal(response.fallback.used, true);
  assert.equal(response.isAiGenerated, false);
  assert.ok(response.riskFlags.some((flag) => flag.kind === "provider_unavailable"));
  assert.doesNotMatch(serialized, /sk-quality-secret-token/);
});

test("File Quality Score projection separates customer and expert boundaries", async () => {
  const response = await analyzeFileQualityScoreRequest(fileQualityScoreRequestFixture());
  const projection = projectFileQualityScoreResponse(response);
  const customerSerialized = JSON.stringify(projection.customer);
  const expertSerialized = JSON.stringify(projection.expert);
  const auditSerialized = JSON.stringify(projection.auditMetadata);

  assert.equal(projection.customer.contractVersion, fileQualityScoreContractVersion);
  assert.equal(projection.customer.isAiGenerated, false);
  assert.equal(projection.customer.state, "provider_unavailable_fallback");
  assert.equal(projection.customer.score, response.score);
  assert.equal(hasFileQualityScoreCustomerLeak(projection.customer), false);
  assert.equal(projection.expert.provider.providerStatus, "unavailable");
  assert.equal(projection.expert.fallback.used, true);
  assert.ok(projection.expert.weightedFactorBreakdown.some((factor) => factor.weight > 0));
  assert.ok(projection.expert.blockedProductionActions.includes("checksum_approval"));
  assert.equal(projection.auditMetadata.provider_status, "unavailable");
  assert.equal(projection.auditMetadata.customer_id, undefined);

  assert.doesNotMatch(customerSerialized, /providerId|providerKind|providerStatus|modelName|promptVersion|"fallback":|weightedFactorBreakdown/i);
  for (const serialized of [customerSerialized, expertSerialized, auditSerialized]) {
    assert.doesNotMatch(serialized, /private-ori\.bin|private-mod\.bin|secret-quality-hash|secret-quality-mod-hash/i);
    assert.doesNotMatch(serialized, /DE AD BE EF|BA AD F0 0D|0x00001000|private map reason|private feature reason/i);
    assert.doesNotMatch(serialized, /customer-private|private\.example|sample-private|storage_path|signed_url|raw_hex|admin note/i);
  }
  assert.match(expertSerialized, /providerStatus/);
  assert.match(expertSerialized, /fallback/);
  assert.match(expertSerialized, /weightedFactorBreakdown/);
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

test("rate limiter ignores untrusted forwarding headers and enforces limits", () => {
  const request = new Request("https://file.mgautotech.de/api/email/new-customer", {
    headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.1" },
  });
  const key = rateLimitKey(request, "unit-test", crypto.randomUUID());

  assert.equal(getClientIp(request), "unknown");
  assert.equal(checkRateLimit({ key, limit: 2, windowMs: 60_000 }).allowed, true);
  assert.equal(checkRateLimit({ key, limit: 2, windowMs: 60_000 }).allowed, true);
  const blocked = checkRateLimit({ key, limit: 2, windowMs: 60_000 });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.ok(blocked.retryAfterSeconds > 0);
});

test("browser Supabase client persists sessions and uses supported default refresh coordination", () => {
  const source = readFileSync(resolve(process.cwd(), "src", "lib", "supabaseClient.ts"), "utf8");
  assert.match(source, /persistSession:\s*true/);
  assert.match(source, /autoRefreshToken:\s*true/);
  assert.doesNotMatch(source, /navigatorLock/);
  assert.doesNotMatch(source, /lockAcquireTimeout/);
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
  const reportStatus = buildFileExpertAiReportStatus({
    provider: "openai",
    modelName: "private-model",
    promptVersion: "private-prompt-v1",
    executiveSummary: "Private provider summary",
    report: "Private provider report",
    outputJson: { private_model_metadata: true },
    generation: {
      state: "provider_generated",
      requestedProvider: {
        name: "openai",
        modelName: "private-model",
        status: "available",
      },
      executedProvider: {
        name: "openai",
        modelName: "private-model",
        promptVersion: "private-prompt-v1",
      },
      fallback: {
        used: false,
        reason: null,
        message: null,
      },
      isAiGenerated: true,
    },
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
    result_json: {
      ...analyzerResult,
      ai_report_status: reportStatus,
    },
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
  assert.equal(serialized.includes("private-model"), false);
  assert.equal(serialized.includes("private-prompt-v1"), false);
  assert.equal(serialized.includes("provider_generated"), false);
  assert.equal(serialized.includes("fallback"), false);
  assert.equal(serialized.includes("humanReviewRequired"), true);
  assert.equal(serialized.includes("exportLocked"), true);
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
