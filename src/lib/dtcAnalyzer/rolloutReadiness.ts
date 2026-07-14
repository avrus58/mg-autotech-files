import { getDtcAnalyzerAdminConfigStatus } from "@/lib/dtcAnalyzer/config";

export const dtcRolloutReadinessContractVersion = "dtc-analyzer-rollout-readiness-v1" as const;

export type DtcRolloutRegressionScenarioId =
  | "provider_unavailable_fallback"
  | "provider_error_fallback"
  | "invalid_or_no_code_input"
  | "customer_admin_projection_boundary"
  | "usage_limit_rejection"
  | "audit_metadata_safety"
  | "ui_no_leak_boundary";

export type DtcRolloutRegressionScenario = {
  id: DtcRolloutRegressionScenarioId;
  title: string;
  required: true;
  coverage: "covered";
  localCommand: string;
  evidence: string[];
};

export type DtcRolloutAnalyticsField = {
  key: string;
  source: "dtc_analysis_generated.auditMetadata";
  classification: "sanitized_metadata";
  aggregateUse: "count" | "enum_count" | "sum" | "not_aggregated_by_default";
  customerVisible: false;
};

export type DtcRolloutAnalyticsSnapshot = {
  contractVersion: typeof dtcRolloutReadinessContractVersion;
  source: "local_fixture_metadata";
  eventCount: number;
  ignoredFieldCount: number;
  ignoredForbiddenFieldCount: number;
  statusCounts: Record<string, number>;
  stateCounts: Record<string, number>;
  providerStatusCounts: Record<string, number>;
  fallbackUsedCount: number;
  providerUnavailableCount: number;
  providerErrorCount: number;
  analysisSuccessCount: number;
  aiGeneratedCount: number;
  humanReviewRequiredCount: number;
  totals: {
    detectedCodeCount: number;
    rejectedCodeLikeTokenCount: number;
    evidenceCount: number;
    riskFlagCount: number;
    recommendationCount: number;
    missingInformationCount: number;
  };
  allowedFields: string[];
};

export type DtcRolloutReadinessReport = {
  contractVersion: typeof dtcRolloutReadinessContractVersion;
  roadmapTaskId: "RMAP-FILE-DTC-M5-ROLLOUT-READINESS";
  epicId: "file-ai-dtc-analyzer";
  featureId: "file-dtc-m5-rollout-readiness-feature";
  status: "ready_for_operator_review";
  summary: string;
  readiness: {
    regressionSuite: "covered";
    analytics: "local_fixture_ready";
    documentation: "documented";
    productionRollout: "operator_approval_required";
  };
  configurationBoundary: {
    customerProviderStatus: string;
    adminProviderStatus: string;
    deterministicFallbackEnabled: true;
    customerRequestsPerWindow: number;
    adminRequestsPerWindow: number;
    maxRequestTextLength: number;
    maxAnalyzedTextLength: number;
    maxCodesPerRequest: number;
  };
  regressionSuite: {
    requiredScenarioCount: number;
    coveredScenarioCount: number;
    scenarios: DtcRolloutRegressionScenario[];
  };
  analytics: {
    source: "sanitized local audit metadata";
    fields: DtcRolloutAnalyticsField[];
    aggregationHelper: "projectDtcRolloutAnalyticsSnapshot";
  };
  validation: {
    localCommands: string[];
    skippedAutonomousBuildReason: string;
    operatorOnlyProductionChecks: string[];
  };
  dataAccessPolicy: string[];
  blockedProductionActions: string[];
  documentation: {
    runbook: "docs/dtc-analyzer-rollout-readiness.md";
    productSpec: "C:\\Users\\gokka\\Documents\\MG-AI-OS-V4\\artifacts\\specs\\rmap-file-dtc-m5-rollout-readiness.md";
  };
};

export const dtcRolloutRegressionScenarios: DtcRolloutRegressionScenario[] = [
  {
    id: "provider_unavailable_fallback",
    title: "Provider unavailable returns explicit non-AI deterministic fallback",
    required: true,
    coverage: "covered",
    localCommand: ".\\node_modules\\.bin\\tsx.cmd --test tests\\ecu-intelligence.test.ts",
    evidence: [
      "tests/ecu-intelligence.test.ts: DTC analyzer exposes provider-unavailable state before fallback",
      "tests/ecu-intelligence.test.ts: DTC analyzer deterministic fallback handles valid DTC text safely",
      "src/lib/dtcAnalyzer/index.ts",
    ],
  },
  {
    id: "provider_error_fallback",
    title: "Provider error preserves provider status and falls back without leaking failure details",
    required: true,
    coverage: "covered",
    localCommand: ".\\node_modules\\.bin\\tsx.cmd --test tests\\ecu-intelligence.test.ts",
    evidence: [
      "tests/ecu-intelligence.test.ts: DTC analyzer provider errors preserve provider identity and non-AI fallback",
      "src/lib/dtcAnalyzer/fallback.ts",
    ],
  },
  {
    id: "invalid_or_no_code_input",
    title: "Invalid, missing or no-code input is rejected as diagnostic guidance, not AI output",
    required: true,
    coverage: "covered",
    localCommand: ".\\node_modules\\.bin\\tsx.cmd --test tests\\ecu-intelligence.test.ts",
    evidence: [
      "tests/ecu-intelligence.test.ts: DTC analyzer deterministic fallback handles invalid and empty input",
      "tests/ecu-intelligence.test.ts: request DTC projection makes missing and invalid DTC input explicit",
      "src/lib/dtcAnalyzer/fallback.ts",
    ],
  },
  {
    id: "customer_admin_projection_boundary",
    title: "Customer projection hides provider/configuration internals while admin projection stays permissioned",
    required: true,
    coverage: "covered",
    localCommand: ".\\node_modules\\.bin\\tsx.cmd --test tests\\ecu-intelligence.test.ts",
    evidence: [
      "tests/ecu-intelligence.test.ts: request DTC projection separates customer and expert boundaries",
      "tests/ecu-intelligence.test.ts: admin DTC projection carries admin-safe configuration while customer projection stays bounded",
      "src/lib/dtcAnalyzer/requestIntegration.ts",
    ],
  },
  {
    id: "usage_limit_rejection",
    title: "Usage, text and code limits are rejected before analysis or audit generation",
    required: true,
    coverage: "covered",
    localCommand: ".\\node_modules\\.bin\\tsx.cmd --test tests\\ecu-intelligence.test.ts",
    evidence: [
      "tests/ecu-intelligence.test.ts: DTC analyzer usage guard rejects local text, code and request limits",
      "src/lib/dtcAnalyzer/config.ts",
      "src/app/api/requests/[id]/dtc-analysis/route.ts",
      "src/app/api/admin/requests/[id]/dtc-analysis/route.ts",
    ],
  },
  {
    id: "audit_metadata_safety",
    title: "Audit metadata is sanitized, internal-only and never records generated analysis for usage-limit rejections",
    required: true,
    coverage: "covered",
    localCommand: ".\\node_modules\\.bin\\tsx.cmd --test tests\\admin-work-orders.test.ts",
    evidence: [
      "tests/admin-work-orders.test.ts: request DTC analysis routes audit sanitized internal-only events",
      "src/lib/dtcAnalyzer/requestIntegration.ts",
      "src/lib/workOrders/server.ts",
    ],
  },
  {
    id: "ui_no_leak_boundary",
    title: "Customer and admin UI surfaces preserve loading, error, empty, retry and no-leak assumptions",
    required: true,
    coverage: "covered",
    localCommand: ".\\node_modules\\.bin\\tsx.cmd --test tests\\ui-ux-safety.test.ts",
    evidence: [
      "tests/ui-ux-safety.test.ts: request DTC integration keeps customer and admin projections bounded",
      "src/app/dashboard/orders/[id]/page.tsx",
      "src/app/admin/requests/[id]/WorkOrderDetailClient.tsx",
    ],
  },
];

export const dtcRolloutAnalyticsFields: DtcRolloutAnalyticsField[] = [
  { key: "source", source: "dtc_analysis_generated.auditMetadata", classification: "sanitized_metadata", aggregateUse: "enum_count", customerVisible: false },
  { key: "contract_version", source: "dtc_analysis_generated.auditMetadata", classification: "sanitized_metadata", aggregateUse: "enum_count", customerVisible: false },
  { key: "status", source: "dtc_analysis_generated.auditMetadata", classification: "sanitized_metadata", aggregateUse: "enum_count", customerVisible: false },
  { key: "state", source: "dtc_analysis_generated.auditMetadata", classification: "sanitized_metadata", aggregateUse: "enum_count", customerVisible: false },
  { key: "is_ai_generated", source: "dtc_analysis_generated.auditMetadata", classification: "sanitized_metadata", aggregateUse: "count", customerVisible: false },
  { key: "confidence", source: "dtc_analysis_generated.auditMetadata", classification: "sanitized_metadata", aggregateUse: "enum_count", customerVisible: false },
  { key: "detected_code_count", source: "dtc_analysis_generated.auditMetadata", classification: "sanitized_metadata", aggregateUse: "sum", customerVisible: false },
  { key: "detected_codes", source: "dtc_analysis_generated.auditMetadata", classification: "sanitized_metadata", aggregateUse: "not_aggregated_by_default", customerVisible: false },
  { key: "rejected_code_like_token_count", source: "dtc_analysis_generated.auditMetadata", classification: "sanitized_metadata", aggregateUse: "sum", customerVisible: false },
  { key: "input_was_truncated", source: "dtc_analysis_generated.auditMetadata", classification: "sanitized_metadata", aggregateUse: "count", customerVisible: false },
  { key: "provider_kind", source: "dtc_analysis_generated.auditMetadata", classification: "sanitized_metadata", aggregateUse: "enum_count", customerVisible: false },
  { key: "provider_status", source: "dtc_analysis_generated.auditMetadata", classification: "sanitized_metadata", aggregateUse: "enum_count", customerVisible: false },
  { key: "fallback_used", source: "dtc_analysis_generated.auditMetadata", classification: "sanitized_metadata", aggregateUse: "count", customerVisible: false },
  { key: "provider_unavailable", source: "dtc_analysis_generated.auditMetadata", classification: "sanitized_metadata", aggregateUse: "count", customerVisible: false },
  { key: "provider_error", source: "dtc_analysis_generated.auditMetadata", classification: "sanitized_metadata", aggregateUse: "count", customerVisible: false },
  { key: "analysis_success", source: "dtc_analysis_generated.auditMetadata", classification: "sanitized_metadata", aggregateUse: "count", customerVisible: false },
  { key: "evidence_count", source: "dtc_analysis_generated.auditMetadata", classification: "sanitized_metadata", aggregateUse: "sum", customerVisible: false },
  { key: "risk_flag_count", source: "dtc_analysis_generated.auditMetadata", classification: "sanitized_metadata", aggregateUse: "sum", customerVisible: false },
  { key: "recommendation_count", source: "dtc_analysis_generated.auditMetadata", classification: "sanitized_metadata", aggregateUse: "sum", customerVisible: false },
  { key: "missing_information_count", source: "dtc_analysis_generated.auditMetadata", classification: "sanitized_metadata", aggregateUse: "sum", customerVisible: false },
  { key: "human_review_required", source: "dtc_analysis_generated.auditMetadata", classification: "sanitized_metadata", aggregateUse: "count", customerVisible: false },
];

const localValidationCommands = [
  ".\\node_modules\\.bin\\tsx.cmd --test tests\\ecu-intelligence.test.ts",
  ".\\node_modules\\.bin\\tsx.cmd --test tests\\admin-work-orders.test.ts",
  ".\\node_modules\\.bin\\tsx.cmd --test tests\\ui-ux-safety.test.ts",
  "npm run lint",
  "npm run typecheck",
  "npm test",
  "git diff --check",
];

const operatorOnlyProductionChecks = [
  "Confirm a real provider is configured through approved secret management outside autonomous Codex.",
  "Review production rate-limit persistence, monitoring and alerting before enabling customer rollout.",
  "Run any production analytics query manually with owner-approved access and sanitized aggregate output only.",
  "Run deployment, smoke and rollback checks outside autonomous Codex with explicit operator approval.",
];

const dataAccessPolicy = [
  "The readiness report is built from local code contracts, static source evidence and fixture audit metadata only.",
  "The analytics helper accepts caller-provided local metadata and never queries Supabase or external services.",
  "No .env, .env.local, secret, token, customer file, storage object, signed URL, raw binary, hash or provider key is read.",
];

const blockedProductionActions = [
  "No production deployment or Vercel state change.",
  "No live Supabase, Stripe, Resend, OpenAI or other production service call.",
  "No SQL migration execution or production database query.",
  "No package installation or new production dependency.",
  "No live provider enablement, key read or secret inspection.",
  "No DTC-off approval, final diagnosis, checksum completion, byte patch approval or customer-ready MOD generation.",
];

const allowedAnalyticsKeys = new Set(dtcRolloutAnalyticsFields.map((field) => field.key));
const forbiddenMetadataKeyPattern =
  /storage|path|signed|url|hash|sha|binary|hex|sample|secret|token|key|note|message|customer_id|email|file/i;

function increment(counts: Record<string, number>, key: string) {
  counts[key] = (counts[key] ?? 0) + 1;
}

function stringValue(value: unknown, fallback = "unknown") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function booleanValue(value: unknown) {
  return value === true;
}

export function projectDtcRolloutAnalyticsSnapshot(
  events: Array<Record<string, unknown>>
): DtcRolloutAnalyticsSnapshot {
  const statusCounts: Record<string, number> = {};
  const stateCounts: Record<string, number> = {};
  const providerStatusCounts: Record<string, number> = {};
  const totals = {
    detectedCodeCount: 0,
    rejectedCodeLikeTokenCount: 0,
    evidenceCount: 0,
    riskFlagCount: 0,
    recommendationCount: 0,
    missingInformationCount: 0,
  };
  let ignoredFieldCount = 0;
  let ignoredForbiddenFieldCount = 0;
  let fallbackUsedCount = 0;
  let providerUnavailableCount = 0;
  let providerErrorCount = 0;
  let analysisSuccessCount = 0;
  let aiGeneratedCount = 0;
  let humanReviewRequiredCount = 0;

  for (const event of events) {
    for (const key of Object.keys(event)) {
      if (!allowedAnalyticsKeys.has(key)) {
        ignoredFieldCount += 1;
        if (forbiddenMetadataKeyPattern.test(key)) ignoredForbiddenFieldCount += 1;
      }
    }

    increment(statusCounts, stringValue(event.status));
    increment(stateCounts, stringValue(event.state));
    increment(providerStatusCounts, stringValue(event.provider_status));

    if (booleanValue(event.fallback_used)) fallbackUsedCount += 1;
    if (booleanValue(event.provider_unavailable)) providerUnavailableCount += 1;
    if (booleanValue(event.provider_error)) providerErrorCount += 1;
    if (booleanValue(event.analysis_success)) analysisSuccessCount += 1;
    if (booleanValue(event.is_ai_generated)) aiGeneratedCount += 1;
    if (booleanValue(event.human_review_required)) humanReviewRequiredCount += 1;

    totals.detectedCodeCount += numberValue(event.detected_code_count);
    totals.rejectedCodeLikeTokenCount += numberValue(event.rejected_code_like_token_count);
    totals.evidenceCount += numberValue(event.evidence_count);
    totals.riskFlagCount += numberValue(event.risk_flag_count);
    totals.recommendationCount += numberValue(event.recommendation_count);
    totals.missingInformationCount += numberValue(event.missing_information_count);
  }

  return {
    contractVersion: dtcRolloutReadinessContractVersion,
    source: "local_fixture_metadata",
    eventCount: events.length,
    ignoredFieldCount,
    ignoredForbiddenFieldCount,
    statusCounts,
    stateCounts,
    providerStatusCounts,
    fallbackUsedCount,
    providerUnavailableCount,
    providerErrorCount,
    analysisSuccessCount,
    aiGeneratedCount,
    humanReviewRequiredCount,
    totals,
    allowedFields: dtcRolloutAnalyticsFields.map((field) => field.key),
  };
}

export function buildDtcRolloutReadinessReport(): DtcRolloutReadinessReport {
  const customerConfig = getDtcAnalyzerAdminConfigStatus("customer");
  const adminConfig = getDtcAnalyzerAdminConfigStatus("admin");

  return {
    contractVersion: dtcRolloutReadinessContractVersion,
    roadmapTaskId: "RMAP-FILE-DTC-M5-ROLLOUT-READINESS",
    epicId: "file-ai-dtc-analyzer",
    featureId: "file-dtc-m5-rollout-readiness-feature",
    status: "ready_for_operator_review",
    summary:
      "DTC Analyzer M5 is locally ready for operator rollout review: regression coverage, sanitized fixture analytics and operator documentation exist, while production rollout still requires explicit owner/operator action.",
    readiness: {
      regressionSuite: "covered",
      analytics: "local_fixture_ready",
      documentation: "documented",
      productionRollout: "operator_approval_required",
    },
    configurationBoundary: {
      customerProviderStatus: customerConfig.provider.providerStatus,
      adminProviderStatus: adminConfig.provider.providerStatus,
      deterministicFallbackEnabled: customerConfig.fallback.deterministicFallbackEnabled,
      customerRequestsPerWindow: customerConfig.usageLimits.requestsPerWindow,
      adminRequestsPerWindow: adminConfig.usageLimits.requestsPerWindow,
      maxRequestTextLength: customerConfig.usageLimits.maxRequestTextLength,
      maxAnalyzedTextLength: customerConfig.usageLimits.maxAnalyzedTextLength,
      maxCodesPerRequest: customerConfig.usageLimits.maxCodesPerRequest,
    },
    regressionSuite: {
      requiredScenarioCount: dtcRolloutRegressionScenarios.length,
      coveredScenarioCount: dtcRolloutRegressionScenarios.filter((scenario) => scenario.coverage === "covered").length,
      scenarios: dtcRolloutRegressionScenarios,
    },
    analytics: {
      source: "sanitized local audit metadata",
      fields: dtcRolloutAnalyticsFields,
      aggregationHelper: "projectDtcRolloutAnalyticsSnapshot",
    },
    validation: {
      localCommands: localValidationCommands,
      skippedAutonomousBuildReason:
        "npm run build can read local Next env files and request Google Fonts in this repository; run it only when the operator provides a safe local build environment.",
      operatorOnlyProductionChecks,
    },
    dataAccessPolicy,
    blockedProductionActions,
    documentation: {
      runbook: "docs/dtc-analyzer-rollout-readiness.md",
      productSpec:
        "C:\\Users\\gokka\\Documents\\MG-AI-OS-V4\\artifacts\\specs\\rmap-file-dtc-m5-rollout-readiness.md",
    },
  };
}
