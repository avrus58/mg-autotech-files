import type {
  FileQualityScoreConfidence,
  FileQualityScoreConfidenceReason,
  FileQualityScoreFactor,
  FileQualityScoreGrade,
  FileQualityScoreMetadata,
  FileQualityScoreNormalizedInput,
  FileQualityScoreProvider,
  FileQualityScoreProviderIdentity,
  FileQualityScoreReadiness,
  FileQualityScoreRecommendation,
  FileQualityScoreRequest,
  FileQualityScoreResponse,
  FileQualityScoreRiskFlag,
  FileQualityScoreState,
} from "@/lib/fileQualityScore/types";
import type { FileExpertAnalyzerResult } from "@/lib/fileExpert/types";

export const fileQualityScoreContractVersion = "file-quality-score-v1" as const;
export const fileQualityScorePromptVersion = "file-quality-score-v1";
export const deterministicFileQualityScoreProviderId = "deterministic_rules" as const;
export const unconfiguredFileQualityScoreProviderId = "unconfigured_file_quality_score_provider";

export const fileQualityScoreBlockedProductionActions = [
  "live_provider_rollout",
  "customer_ready_mod_export",
  "checksum_approval",
  "flash_safety_approval",
  "automatic_delivery",
  "production_quality_persistence",
] as const;

const safetyBoundaries = [
  "File Quality Score is a deterministic readiness signal, not approval for tuning, checksum work, flashing or delivery.",
  "Provider unavailable and provider error states must remain explicit and must not be presented as successful AI output.",
  "Human expert review is required before customer-facing file advice, MOD export, checksum approval or delivery automation.",
];

const requiredBefore = [
  "customer-facing quality decision",
  "write-ready file export",
  "checksum approval",
  "flash-safety decision",
  "automatic delivery",
];

const metadataLabels = {
  brand: "Vehicle brand",
  model: "Vehicle model",
  engine: "Engine",
  ecuType: "ECU or TCU type",
  ecuFamily: "ECU or TCU family",
  readMethod: "Read method",
  hwSw: "Hardware or software identifier",
} satisfies Record<keyof Required<FileQualityScoreMetadata>, string>;

type FileQualityScoreFactorDraft = Omit<FileQualityScoreFactor, "customerSafe">;

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function hasText(value: unknown) {
  return textValue(value).length > 0;
}

function uniqueInOrder(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function uniqueById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function factor(input: FileQualityScoreFactorDraft): FileQualityScoreFactor {
  return {
    ...input,
    score: Math.max(0, Math.min(input.weight, Math.round(input.score))),
    customerSafe: true,
  };
}

function mergedMetadata(request: FileQualityScoreRequest): Required<FileQualityScoreMetadata> {
  const analyzerMetadata = request.analyzerResult?.metadata;
  const identification = request.analyzerResult?.ecu_identification;
  return {
    brand: textValue(request.metadata?.brand) || textValue(analyzerMetadata?.brand),
    model: textValue(request.metadata?.model) || textValue(analyzerMetadata?.model),
    engine: textValue(request.metadata?.engine) || textValue(analyzerMetadata?.engine),
    ecuType:
      textValue(request.metadata?.ecuType) ||
      textValue(analyzerMetadata?.ecu_type) ||
      textValue(identification?.display_name),
    ecuFamily: textValue(request.metadata?.ecuFamily) || textValue(identification?.family),
    readMethod: textValue(request.metadata?.readMethod) || textValue(analyzerMetadata?.read_method),
    hwSw:
      textValue(request.metadata?.hwSw) ||
      textValue(identification?.software_numbers?.[0]) ||
      textValue(identification?.hardware_numbers?.[0]),
  };
}

function metadataFieldCount(metadata: Required<FileQualityScoreMetadata>) {
  return Object.entries(metadataLabels).filter(([key]) => hasText(metadata[key as keyof typeof metadataLabels])).length;
}

function serviceContextPresent(request: FileQualityScoreRequest) {
  return Boolean(
    hasText(request.service?.serviceSummary) ||
    request.service?.customerNotesPresent ||
    (request.service?.requestedServiceLabels?.length ?? 0) > 0 ||
    (request.service?.selectedOptionLabels?.length ?? 0) > 0
  );
}

function reviewContextPresent(request: FileQualityScoreRequest) {
  return Boolean(
    hasText(request.review?.qualityCheckStatus) ||
    hasText(request.review?.deliveryStatus) ||
    hasText(request.review?.paymentReviewStatus) ||
    hasText(request.review?.humanReviewStatus) ||
    (request.review?.reviewBlockers?.length ?? 0) > 0
  );
}

export function normalizeFileQualityScoreInput(request: FileQualityScoreRequest): FileQualityScoreNormalizedInput {
  const metadata = mergedMetadata(request);
  const metadataCount = metadataFieldCount(metadata);
  const hasAnalyzerResult = Boolean(request.analyzerResult);
  const hasServiceContext = serviceContextPresent(request);
  const hasReviewContext = reviewContextPresent(request);
  const invalidReason =
    !hasAnalyzerResult && metadataCount === 0 && !hasServiceContext && !hasReviewContext
      ? "Provide structured File Expert output or request metadata before scoring file quality."
      : null;

  return {
    hasAnalyzerResult,
    metadataFieldCount: metadataCount,
    serviceContextPresent: hasServiceContext,
    reviewContextPresent: hasReviewContext,
    invalidReason,
  };
}

function fileInspections(result: FileExpertAnalyzerResult | null | undefined) {
  return result ? Object.values(result.files).filter(Boolean) : [];
}

function hasSuspiciousFillRatio(result: FileExpertAnalyzerResult) {
  return fileInspections(result).some((file) => {
    const ffRatio = Number(file?.ff_ratio ?? 0);
    const zeroRatio = Number(file?.zero_ratio ?? 0);
    return ffRatio > 0.98 || zeroRatio > 0.98;
  });
}

function hasCriticalFinding(result: FileExpertAnalyzerResult) {
  return result.findings?.some((finding) => finding.severity === "critical") ?? false;
}

function reviewStatus(value: string | null | undefined) {
  return textValue(value).toLowerCase().replace(/[\s-]+/g, "_");
}

function hasReviewBlocker(request: FileQualityScoreRequest) {
  const qualityStatus = reviewStatus(request.review?.qualityCheckStatus);
  const humanStatus = reviewStatus(request.review?.humanReviewStatus);
  return Boolean(
    (request.review?.reviewBlockers?.length ?? 0) > 0 ||
    ["failed", "blocked", "rejected"].includes(qualityStatus) ||
    humanStatus === "rejected"
  );
}

function buildMetadataFactor(request: FileQualityScoreRequest): FileQualityScoreFactor {
  const metadata = mergedMetadata(request);
  const present = Object.entries(metadataLabels).filter(([key]) => hasText(metadata[key as keyof typeof metadataLabels]));
  const missing = Object.entries(metadataLabels)
    .filter(([key]) => !hasText(metadata[key as keyof typeof metadataLabels]))
    .map(([, label]) => label);
  const score = Math.round((22 * present.length) / Object.keys(metadataLabels).length);

  return factor({
    id: "metadata_completeness",
    category: "metadata",
    label: "Request metadata completeness",
    weight: 22,
    score,
    status: missing.length === 0 ? "positive" : present.length >= 3 ? "caution" : "missing",
    evidenceReasons: [
      `${present.length} of ${Object.keys(metadataLabels).length} safe request metadata fields are present.`,
    ],
    missingInformation: missing,
  });
}

function buildFileEvidenceFactor(result: FileExpertAnalyzerResult | null | undefined): FileQualityScoreFactor {
  if (!result) {
    return factor({
      id: "file_evidence",
      category: "file_evidence",
      label: "Structured file evidence",
      weight: 20,
      score: 0,
      status: "missing",
      evidenceReasons: ["No structured File Expert analyzer output is available."],
      missingInformation: ["Structured File Expert analyzer result"],
    });
  }

  const inspections = fileInspections(result);
  let score = 8;
  const reasons = ["Structured File Expert analyzer output is available."];
  const missing: string[] = [];

  if (inspections.length > 0) {
    score += 4;
    reasons.push("At least one bounded file inspection summary is available.");
  } else {
    missing.push("File inspection summary");
  }

  if (result.mode === "ori_mod_compare" && result.files.ori && result.files.mod && result.comparison) {
    score += 8;
    reasons.push("ORI/MOD comparison summary is available.");
  } else if (result.mode === "single_file" && result.files.single) {
    score += 5;
    reasons.push("Single-file inspection summary is available.");
    missing.push("ORI/MOD comparison when a modified file is expected");
  } else if (result.mode === "ori_mod_compare") {
    missing.push("Complete ORI/MOD comparison summary");
  }

  return factor({
    id: "file_evidence",
    category: "file_evidence",
    label: "Structured file evidence",
    weight: 20,
    score,
    status: score >= 18 ? "positive" : score >= 12 ? "caution" : "warning",
    evidenceReasons: reasons,
    missingInformation: missing,
  });
}

function buildIntegrityFactor(result: FileExpertAnalyzerResult | null | undefined): FileQualityScoreFactor {
  if (!result) {
    return factor({
      id: "integrity_compatibility",
      category: "integrity",
      label: "Integrity and compatibility signals",
      weight: 18,
      score: 0,
      status: "missing",
      evidenceReasons: ["Integrity compatibility cannot be scored without structured file evidence."],
      missingInformation: ["File integrity summary"],
    });
  }

  let score = 0;
  const reasons: string[] = [];
  const missing: string[] = [];
  const comparison = result.comparison;
  const issues = result.integrity_assessment?.issues ?? [];

  if (comparison?.same_size === true) {
    score += 6;
    reasons.push("ORI/MOD size compatibility is present.");
  } else if (comparison?.same_size === false) {
    score += 1;
    reasons.push("ORI/MOD size mismatch needs expert review.");
  } else {
    score += 3;
    missing.push("ORI/MOD size compatibility evidence");
  }

  if (result.integrity_assessment && issues.length === 0) {
    score += 5;
    reasons.push("No structured integrity issues are reported.");
  } else if (result.integrity_assessment) {
    reasons.push("Structured integrity issues are present and need review.");
  } else {
    score += 2;
    missing.push("Structured integrity assessment");
  }

  if (result.risk_assessment.risk_level === "low") {
    score += 5;
    reasons.push("File Expert risk level is low.");
  } else if (result.risk_assessment.risk_level === "medium") {
    score += 3;
    reasons.push("File Expert risk level is medium.");
  } else if (result.risk_assessment.risk_level === "high") {
    reasons.push("File Expert risk level is high.");
  } else {
    score += 1;
    missing.push("Clear File Expert risk level");
  }

  if (!hasSuspiciousFillRatio(result) && !hasCriticalFinding(result)) {
    score += 2;
    reasons.push("No deterministic critical integrity blocker was detected.");
  } else {
    reasons.push("Deterministic integrity review blockers are present.");
  }

  return factor({
    id: "integrity_compatibility",
    category: "integrity",
    label: "Integrity and compatibility signals",
    weight: 18,
    score,
    status:
      comparison?.same_size === false || result.risk_assessment.risk_level === "high" || hasCriticalFinding(result)
        ? "warning"
        : score >= 15
          ? "positive"
          : "caution",
    evidenceReasons: reasons,
    missingInformation: missing,
  });
}

function buildAnalysisFactor(result: FileExpertAnalyzerResult | null | undefined): FileQualityScoreFactor {
  if (!result) {
    return factor({
      id: "analysis_confidence",
      category: "analysis",
      label: "Analyzer confidence and explainability",
      weight: 18,
      score: 0,
      status: "missing",
      evidenceReasons: ["No analyzer summary is available for explainable scoring."],
      missingInformation: ["Analyzer summary, ECU identification and risk confidence"],
    });
  }

  let score = 0;
  const reasons: string[] = [];
  const missing: string[] = [];

  if (result.summary.main_conclusion) {
    score += 3;
    reasons.push("Analyzer conclusion summary is present.");
  }
  if (result.summary.stock_or_modified !== "unknown") {
    score += 3;
    reasons.push("Stock or modified classification is present.");
  } else {
    missing.push("Stock or modified classification");
  }
  if ((result.ecu_identification?.confidence ?? 0) >= 0.6 || result.ecu_identification?.status === "detected") {
    score += 4;
    reasons.push("ECU identification confidence is available.");
  } else {
    missing.push("Strong ECU identification evidence");
  }
  if (
    result.pattern_signature ||
    result.change_profile ||
    result.map_candidates.length > 0 ||
    result.possible_features.length > 0
  ) {
    score += 5;
    reasons.push("Explainable pattern, change or feature summaries are available.");
  } else {
    missing.push("Pattern, change-profile or feature summary");
  }

  const analyzerConfidence = Number(result.risk_assessment.confidence);
  if (Number.isFinite(analyzerConfidence)) {
    score += Math.round(Math.max(0, Math.min(1, analyzerConfidence)) * 3);
    reasons.push("Analyzer confidence value is present.");
  } else {
    missing.push("Analyzer confidence value");
  }

  return factor({
    id: "analysis_confidence",
    category: "analysis",
    label: "Analyzer confidence and explainability",
    weight: 18,
    score,
    status: score >= 15 ? "positive" : score >= 9 ? "caution" : "warning",
    evidenceReasons: reasons.length ? reasons : ["Analyzer explainability evidence is weak."],
    missingInformation: missing,
  });
}

function buildServiceFactor(request: FileQualityScoreRequest): FileQualityScoreFactor {
  let score = 0;
  const reasons: string[] = [];
  const missing: string[] = [];

  if (hasText(request.service?.serviceSummary) || (request.service?.requestedServiceLabels?.length ?? 0) > 0) {
    score += 5;
    reasons.push("Requested service context is present.");
  } else {
    missing.push("Requested service or option context");
  }

  if ((request.service?.selectedOptionLabels?.length ?? 0) > 0 || request.service?.customerNotesPresent) {
    score += 3;
    reasons.push("Additional customer request context is present without exposing note text.");
  } else {
    missing.push("Customer request notes or selected option context");
  }

  if (!hasReviewBlocker(request)) {
    score += 3;
    reasons.push("No explicit review blocker is present in request context.");
  } else {
    reasons.push("Review blocker context is present.");
  }

  const qualityStatus = reviewStatus(request.review?.qualityCheckStatus);
  if (["passed", "needs_review", "pending", ""].includes(qualityStatus)) {
    score += qualityStatus === "passed" ? 1 : 0;
  }

  return factor({
    id: "service_context",
    category: "service_context",
    label: "Service and request context",
    weight: 12,
    score,
    status: hasReviewBlocker(request) ? "warning" : score >= 9 ? "positive" : score >= 5 ? "caution" : "missing",
    evidenceReasons: reasons.length ? reasons : ["Service context is not available."],
    missingInformation: missing,
  });
}

function buildReviewGateFactor(request: FileQualityScoreRequest): FileQualityScoreFactor {
  const result = request.analyzerResult;
  const blocked = hasReviewBlocker(request);
  const highRisk = result?.risk_assessment.risk_level === "high" || Boolean(result && hasCriticalFinding(result));
  const score = blocked ? 0 : highRisk ? 3 : request.review?.humanReviewStatus === "approved" ? 10 : 8;

  return factor({
    id: "review_gate",
    category: "review_gate",
    label: "Human review gate",
    weight: 10,
    score,
    status: blocked ? "critical" : highRisk ? "warning" : "positive",
    evidenceReasons: [
      blocked
        ? "Request-level blockers prevent treating this submission as ready."
        : "Human review remains required before production file actions.",
    ],
    missingInformation:
      request.review?.humanReviewStatus === "approved" ? [] : ["Final human expert quality decision"],
  });
}

function providerStateFactor(provider: FileQualityScoreProviderIdentity): FileQualityScoreFactor {
  return factor({
    id: "provider_state",
    category: "provider_state",
    label: "Provider and fallback state",
    weight: 0,
    score: 0,
    status: provider.providerStatus === "error" ? "warning" : provider.providerStatus === "unavailable" ? "caution" : "positive",
    evidenceReasons: [
      provider.providerStatus === "ready"
        ? "Deterministic local rules are available."
        : "Provider state is explicit and fallback output is not AI-generated.",
    ],
    missingInformation: [],
  });
}

function deterministicProviderIdentity(): FileQualityScoreProviderIdentity {
  return {
    providerId: deterministicFileQualityScoreProviderId,
    providerKind: "deterministic_rules",
    providerStatus: "ready",
    modelName: null,
    promptVersion: fileQualityScorePromptVersion,
  };
}

export function unavailableFileQualityScoreProviderIdentity(reason: string): FileQualityScoreProviderIdentity {
  return {
    providerId: unconfiguredFileQualityScoreProviderId,
    providerKind: "unconfigured",
    providerStatus: "unavailable",
    modelName: null,
    promptVersion: null,
    unavailableReason: reason,
  };
}

export function erroredFileQualityScoreProviderIdentity(provider: {
  providerId: string;
  providerKind: FileQualityScoreProviderIdentity["providerKind"];
  modelName: string | null;
}): FileQualityScoreProviderIdentity {
  return {
    providerId: provider.providerId,
    providerKind: provider.providerKind,
    providerStatus: "error",
    modelName: provider.modelName,
    promptVersion: null,
    unavailableReason: "Configured File Quality Score provider failed locally.",
  };
}

function gradeFor(score: number): FileQualityScoreGrade {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

function readinessFor(input: {
  score: number;
  riskFlags: FileQualityScoreRiskFlag[];
  normalized: FileQualityScoreNormalizedInput;
}): FileQualityScoreReadiness {
  if (input.normalized.invalidReason) return "blocked";
  if (input.riskFlags.some((flag) => flag.severity === "critical")) return "blocked";
  if (input.score >= 75 && input.normalized.hasAnalyzerResult) return "ready_for_expert_review";
  if (input.score >= 55) return "needs_expert_review";
  return "needs_information";
}

function confidenceFor(readiness: FileQualityScoreReadiness, score: number): FileQualityScoreConfidence {
  if (readiness === "blocked" || readiness === "unavailable") return "none";
  if (score >= 85) return "high";
  if (score >= 55) return "medium";
  return "low";
}

function collectRiskFlags(
  request: FileQualityScoreRequest,
  normalized: FileQualityScoreNormalizedInput,
  provider: FileQualityScoreProviderIdentity
): FileQualityScoreRiskFlag[] {
  const flags: FileQualityScoreRiskFlag[] = [];
  const result = request.analyzerResult;

  if (normalized.metadataFieldCount < 4) {
    flags.push({
      id: "missing-metadata",
      kind: "missing_metadata",
      severity: normalized.metadataFieldCount === 0 ? "warning" : "caution",
      text: "Important request metadata is incomplete for file-quality readiness.",
      requiresHumanReview: true,
      customerSafe: true,
    });
  }

  if (!normalized.hasAnalyzerResult) {
    flags.push({
      id: "insufficient-file-evidence",
      kind: "insufficient_file_evidence",
      severity: "warning",
      text: "Structured File Expert evidence is missing, so readiness is limited.",
      requiresHumanReview: true,
      customerSafe: true,
    });
  }

  if (result?.comparison?.same_size === false || (result?.integrity_assessment?.issues.length ?? 0) > 0) {
    flags.push({
      id: "integrity-mismatch",
      kind: "integrity_mismatch",
      severity: "warning",
      text: "Integrity or compatibility signals need expert review before work continues.",
      requiresHumanReview: true,
      customerSafe: true,
    });
  }

  if (result?.risk_assessment.risk_level === "high" || Boolean(result && hasCriticalFinding(result))) {
    flags.push({
      id: "high-risk-file",
      kind: "high_risk_file",
      severity: "critical",
      text: "File Expert risk signals block automatic quality approval.",
      requiresHumanReview: true,
      customerSafe: true,
    });
  }

  if (hasReviewBlocker(request)) {
    flags.push({
      id: "review-blocker",
      kind: "review_blocker",
      severity: "critical",
      text: "Request-level review blockers are present and require operator resolution.",
      requiresHumanReview: true,
      customerSafe: true,
    });
  }

  if (provider.providerStatus === "unavailable" || provider.providerStatus === "error") {
    flags.push({
      id: `provider-${provider.providerStatus}`,
      kind: "provider_unavailable",
      severity: provider.providerStatus === "error" ? "warning" : "caution",
      text: "Provider state prevents treating this result as AI-generated quality analysis.",
      requiresHumanReview: true,
      customerSafe: true,
    });
  }

  return uniqueById(flags);
}

function recommendationsFor(input: {
  missingInformation: string[];
  riskFlags: FileQualityScoreRiskFlag[];
  provider: FileQualityScoreProviderIdentity;
}): FileQualityScoreRecommendation[] {
  const recommendations: FileQualityScoreRecommendation[] = input.missingInformation.slice(0, 8).map((item, index) => ({
    id: `missing-${index + 1}`,
    category: "missing_information",
    priority: "normal",
    text: `Collect ${item.toLowerCase()} before treating the request as quality-ready.`,
    requiresHumanReview: false,
    customerSafe: true,
  }));

  if (input.riskFlags.some((flag) => flag.kind === "insufficient_file_evidence")) {
    recommendations.push({
      id: "file-expert-evidence",
      category: "file_evidence",
      priority: "high",
      text: "Run or attach structured File Expert evidence before relying on the quality score.",
      requiresHumanReview: true,
      customerSafe: true,
    });
  }

  if (input.provider.providerStatus !== "ready") {
    recommendations.push({
      id: "provider-unavailable-fallback-notice",
      category: "fallback_notice",
      priority: "high",
      text: "Provider unavailable or failed state is explicit. Use deterministic fallback only as review support.",
      requiresHumanReview: true,
      customerSafe: true,
    });
  }

  recommendations.push({
    id: "human-review-gate",
    category: "human_review_gate",
    priority: "high",
    text: "Human expert review is required before customer-ready MOD export, checksum approval, flash-safety claims or delivery automation.",
    requiresHumanReview: true,
    customerSafe: true,
  });

  return uniqueById(recommendations);
}

function confidenceReasons(input: {
  confidence: FileQualityScoreConfidence;
  readiness: FileQualityScoreReadiness;
  provider: FileQualityScoreProviderIdentity;
  normalized: FileQualityScoreNormalizedInput;
  score: number;
}): FileQualityScoreConfidenceReason[] {
  if (input.confidence === "none") {
    return [{
      id: "confidence-none",
      confidence: "none",
      text: input.normalized.invalidReason ?? "No quality confidence is assigned until the input is scorable.",
      customerSafe: true,
    }];
  }

  const reasons: FileQualityScoreConfidenceReason[] = [
    {
      id: "deterministic-cap",
      confidence: input.confidence,
      text: "Confidence is based on deterministic local rules and remains review support only.",
      customerSafe: true,
    },
  ];

  if (input.provider.providerStatus !== "ready" || input.provider.providerId !== deterministicFileQualityScoreProviderId) {
    reasons.push({
      id: "provider-fallback-cap",
      confidence: input.confidence,
      text: "Provider unavailable or failed state keeps this result in deterministic non-AI fallback mode.",
      customerSafe: true,
    });
  }

  if (!input.normalized.hasAnalyzerResult || input.normalized.metadataFieldCount < 4) {
    reasons.push({
      id: "evidence-gap-cap",
      confidence: input.confidence,
      text: "Missing File Expert evidence or request metadata limits confidence.",
      customerSafe: true,
    });
  }

  if (input.readiness === "ready_for_expert_review" && input.score >= 75) {
    reasons.push({
      id: "review-ready",
      confidence: input.confidence,
      text: "Structured evidence is strong enough for expert review preparation, not automatic production approval.",
      customerSafe: true,
    });
  }

  return uniqueById(reasons);
}

function responseState(provider: FileQualityScoreProviderIdentity): FileQualityScoreState {
  if (provider.providerStatus === "error") return "provider_error_fallback";
  if (provider.providerStatus === "unavailable") return "provider_unavailable_fallback";
  return "deterministic_fallback";
}

function summarize(score: number, grade: FileQualityScoreGrade, readiness: FileQualityScoreReadiness) {
  if (grade === "not_scorable") {
    return "File Quality Score could not be calculated because the input is incomplete.";
  }
  return `Deterministic non-AI File Quality Score is ${score}/100 (${grade}) with readiness ${readiness}. Human review remains required.`;
}

function buildScoredResponse(
  request: FileQualityScoreRequest,
  provider: FileQualityScoreProviderIdentity,
  fallbackReason: string
): FileQualityScoreResponse {
  const normalized = normalizeFileQualityScoreInput(request);
  if (normalized.invalidReason) return buildInvalidFileQualityScoreInputResponse(request, normalized);

  const factors = [
    buildMetadataFactor(request),
    buildFileEvidenceFactor(request.analyzerResult),
    buildIntegrityFactor(request.analyzerResult),
    buildAnalysisFactor(request.analyzerResult),
    buildServiceFactor(request),
    buildReviewGateFactor(request),
    providerStateFactor(provider),
  ];
  const score = clampScore(factors.reduce((total, item) => total + item.score, 0));
  const riskFlags = collectRiskFlags(request, normalized, provider);
  const readiness = readinessFor({ score, riskFlags, normalized });
  const confidence = confidenceFor(readiness, score);
  const grade = gradeFor(score);
  const missingInformation = uniqueInOrder(factors.flatMap((item) => item.missingInformation));

  return {
    contractVersion: fileQualityScoreContractVersion,
    status: "fallback",
    state: responseState(provider),
    provider,
    fallback: {
      used: true,
      providerId: deterministicFileQualityScoreProviderId,
      reason: fallbackReason,
    },
    isAiGenerated: false,
    normalizedInput: normalized,
    score,
    grade,
    readiness,
    confidence,
    confidenceReasons: confidenceReasons({ confidence, readiness, provider, normalized, score }),
    summary: summarize(score, grade, readiness),
    factorBreakdown: factors,
    evidenceReasons: uniqueInOrder(factors.flatMap((item) => item.evidenceReasons)),
    missingInformation,
    riskFlags,
    recommendations: recommendationsFor({ missingInformation, riskFlags, provider }),
    humanReview: {
      required: true,
      reason: "File Quality Score supports review only and cannot approve production file-service actions.",
      requiredBefore,
    },
    safetyBoundaries,
    blockedProductionActions: [...fileQualityScoreBlockedProductionActions],
  };
}

export function buildProviderUnavailableFileQualityScoreResponse(
  request: FileQualityScoreRequest,
  reason = "No File Quality Score provider is configured for local analysis."
): FileQualityScoreResponse {
  const normalized = normalizeFileQualityScoreInput(request);
  const provider = unavailableFileQualityScoreProviderIdentity(reason);

  return {
    contractVersion: fileQualityScoreContractVersion,
    status: "provider_unavailable",
    state: "provider_unavailable",
    provider,
    fallback: {
      used: false,
      providerId: deterministicFileQualityScoreProviderId,
      reason: null,
    },
    isAiGenerated: false,
    normalizedInput: normalized,
    score: 0,
    grade: "not_scorable",
    readiness: "unavailable",
    confidence: "none",
    confidenceReasons: [{
      id: "provider-unavailable-confidence-none",
      confidence: "none",
      text: "No quality confidence is assigned because the provider is unavailable and fallback was not used in this response.",
      customerSafe: true,
    }],
    summary: "File Quality Score provider is unavailable. No AI quality score was generated.",
    factorBreakdown: [providerStateFactor(provider)],
    evidenceReasons: ["Provider unavailable state is explicit."],
    missingInformation: normalized.invalidReason ? ["Structured File Expert result or request metadata"] : [],
    riskFlags: collectRiskFlags(request, normalized, provider),
    recommendations: recommendationsFor({
      missingInformation: normalized.invalidReason ? ["Structured File Expert result or request metadata"] : [],
      riskFlags: [],
      provider,
    }),
    humanReview: {
      required: true,
      reason: "File Quality Score provider is unavailable until a provider is configured or deterministic fallback is used.",
      requiredBefore,
    },
    safetyBoundaries,
    blockedProductionActions: [...fileQualityScoreBlockedProductionActions],
  };
}

export function buildInvalidFileQualityScoreInputResponse(
  request: FileQualityScoreRequest,
  normalized = normalizeFileQualityScoreInput(request)
): FileQualityScoreResponse {
  const provider = deterministicProviderIdentity();
  const factorBreakdown = [
    factor({
      id: "file_evidence",
      category: "file_evidence",
      label: "Structured file evidence",
      weight: 20,
      score: 0,
      status: "missing",
      evidenceReasons: [normalized.invalidReason ?? "The input is not scorable."],
      missingInformation: ["Structured File Expert result or request metadata"],
    }),
    providerStateFactor(provider),
  ];
  const riskFlags: FileQualityScoreRiskFlag[] = [{
    id: "invalid-input",
    kind: "invalid_input",
    severity: "warning",
    text: normalized.invalidReason ?? "Quality scoring cannot start until structured evidence is available.",
    requiresHumanReview: true,
    customerSafe: true,
  }];

  return {
    contractVersion: fileQualityScoreContractVersion,
    status: "invalid_input",
    state: "invalid_input",
    provider,
    fallback: {
      used: true,
      providerId: deterministicFileQualityScoreProviderId,
      reason: "Input validation handled by deterministic rules before any provider call.",
    },
    isAiGenerated: false,
    normalizedInput: normalized,
    score: 0,
    grade: "not_scorable",
    readiness: "blocked",
    confidence: "none",
    confidenceReasons: confidenceReasons({
      confidence: "none",
      readiness: "blocked",
      provider,
      normalized,
      score: 0,
    }),
    summary: normalized.invalidReason ?? "File Quality Score input is incomplete.",
    factorBreakdown,
    evidenceReasons: factorBreakdown.flatMap((item) => item.evidenceReasons),
    missingInformation: ["Structured File Expert result or request metadata"],
    riskFlags,
    recommendations: recommendationsFor({
      missingInformation: ["Structured File Expert result or request metadata"],
      riskFlags,
      provider,
    }),
    humanReview: {
      required: true,
      reason: "Structured evidence is required before quality readiness can be reviewed.",
      requiredBefore,
    },
    safetyBoundaries,
    blockedProductionActions: [...fileQualityScoreBlockedProductionActions],
  };
}

export function buildDeterministicFileQualityScoreFallback(
  request: FileQualityScoreRequest,
  options: {
    provider?: FileQualityScoreProviderIdentity;
    reason?: string;
  } = {}
): FileQualityScoreResponse {
  const provider = options.provider ?? deterministicProviderIdentity();
  return buildScoredResponse(
    request,
    provider,
    options.reason ?? "Deterministic non-AI fallback used for local File Quality Score."
  );
}

export class UnavailableFileQualityScoreProvider implements FileQualityScoreProvider {
  readonly providerId = unconfiguredFileQualityScoreProviderId;
  readonly providerKind = "unconfigured" as const;
  readonly modelName = null;

  constructor(private readonly reason = "No File Quality Score provider is configured for local analysis.") {}

  async scoreFileQuality(input: FileQualityScoreRequest): Promise<FileQualityScoreResponse> {
    return buildProviderUnavailableFileQualityScoreResponse(input, this.reason);
  }
}

export class DeterministicFileQualityScoreFallbackProvider implements FileQualityScoreProvider {
  readonly providerId = deterministicFileQualityScoreProviderId;
  readonly providerKind = "deterministic_rules" as const;
  readonly modelName = null;

  async scoreFileQuality(input: FileQualityScoreRequest): Promise<FileQualityScoreResponse> {
    return buildDeterministicFileQualityScoreFallback(input);
  }
}

export async function analyzeFileQualityScoreRequest(
  request: FileQualityScoreRequest,
  options: { provider?: FileQualityScoreProvider } = {}
): Promise<FileQualityScoreResponse> {
  const normalized = normalizeFileQualityScoreInput(request);
  if (normalized.invalidReason) return buildInvalidFileQualityScoreInputResponse(request, normalized);

  const provider = options.provider ?? new UnavailableFileQualityScoreProvider();

  try {
    const providerResponse = await provider.scoreFileQuality(request);
    if (providerResponse.status === "provider_unavailable") {
      return buildDeterministicFileQualityScoreFallback(request, {
        provider: providerResponse.provider,
        reason: providerResponse.provider.unavailableReason ?? "File Quality Score provider is unavailable.",
      });
    }
    return providerResponse;
  } catch {
    return buildDeterministicFileQualityScoreFallback(request, {
      provider: erroredFileQualityScoreProviderIdentity(provider),
      reason: "Configured File Quality Score provider failed locally; deterministic fallback used.",
    });
  }
}
