import { buildOverviewMetrics, buildEcuIntelligenceClusters } from "@/lib/ecuIntelligence/center/metrics";
import { generateEcuIntelligenceInsights } from "@/lib/ecuIntelligence/center/insights";
import { buildClusterKnowledgeGraph } from "@/lib/ecuIntelligence/center/knowledgeGraph";
import { buildEcuIntelligenceReviewQueue } from "@/lib/ecuIntelligence/center/reviewQueue";
import {
  ecuIntelligenceServiceCategories,
  type EcuIntelligenceFeatureFlagState,
  type EcuIntelligenceSourceRows,
} from "@/lib/ecuIntelligence/center/types";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const ecuIntelligenceCenterEngineVersion = "ecu-intelligence-center-v1";

function tableMissing(error: { code?: string; message?: string } | null | undefined) {
  return ["42P01", "42703", "PGRST204", "PGRST205"].includes(error?.code || "") ||
    Boolean(error?.message?.toLowerCase().includes("schema cache"));
}

function safeLimit(value: string | number | null | undefined, fallback = 100, maximum = 500) {
  const parsed = Number(value);
  return Math.min(Math.max(Number.isFinite(parsed) ? parsed : fallback, 1), maximum);
}

export function getEcuIntelligenceFeatureFlags(): EcuIntelligenceFeatureFlagState {
  const centerEnabled = process.env.ECU_INTELLIGENCE_CENTER_ENABLED !== "false";
  return {
    centerEnabled,
    deterministicInsightsEnabled: process.env.ECU_INTELLIGENCE_INSIGHTS_ENABLED !== "false",
    graphEnabled: process.env.ECU_INTELLIGENCE_GRAPH_ENABLED !== "false",
    refreshEnabled: process.env.ECU_INTELLIGENCE_REFRESH_ENABLED === "true",
    realEcuRulesEnabled: false,
    realIntegrityAdaptersEnabled: false,
    a3ProcessingEnabled: false,
    a4AutomationEnabled: false,
    a5AutomationEnabled: false,
    customerDeliveryEnabled: false,
    instructionPatchOperationsEnabled: false,
    globalDtcProductionKillSwitchEngaged: true,
  };
}

type SourceLoadResult = {
  rows: EcuIntelligenceSourceRows;
  warnings: string[];
};

async function selectRows(table: string, select: string, limit: number, orderColumn = "created_at") {
  const admin = getSupabaseAdmin();
  const query = admin.from(table).select(select).order(orderColumn, { ascending: false }).limit(limit);
  const result = await query;
  if (result.error) {
    if (tableMissing(result.error)) return { rows: [], warning: `${table}: ${result.error.message}` };
    throw new Error(`${table}: ${result.error.message}`);
  }
  return { rows: (result.data ?? []) as unknown as Record<string, unknown>[], warning: null };
}

export async function loadEcuIntelligenceSourceRows(limit = 5000): Promise<SourceLoadResult> {
  const [
    learningFiles,
    learningPairs,
    trainingSamples,
    datasetPairs,
    fileExpertJobs,
    patternSignatures,
    patternClusters,
    similarityResults,
    mapDefinitionSets,
    mapDefinitions,
    generationReadinessReports,
  ] = await Promise.all([
    selectRows(
      "ai_learning_file_candidates",
      "id, request_id, source_type, file_role_candidate, file_name, file_size, sha256, supplier, ecu_family, ecu_type, hw_number, sw_number, calibration_id, representation_type, read_method, identity_confidence, identity_conflicts, requested_service_labels, dtc_codes, stock_or_modified_guess, learning_authorization_status, analysis_status, review_status, quality_score, provenance, warnings, errors, created_at",
      limit
    ),
    selectRows(
      "ai_learning_pair_candidates",
      "id, request_id, linked_training_sample_id, ori_sha256, mod_sha256, pair_identity_key, pair_confidence, pair_type, requested_service_labels, performed_service_labels, dtc_codes, changed_region_summary, pattern_signature, quality_score, review_status, learning_use_status, learning_authorization_status, provenance, warnings, errors, created_at",
      limit
    ),
    selectRows(
      "ai_training_samples",
      "id, request_id, ori_sha256, mod_sha256, ori_file_size, mod_file_size, brand, model, engine, ecu_type, ecu_family, sw_number, hw_number, read_method, service_labels, requested_service_labels, performed_service_labels, provider, revision_label, revision_number, source_type, change_type_classification, pattern_signature, learning_use_status, human_verification_status, quality_rating, data_quality_score, data_quality_reasons, safety_rating, outcome, created_at",
      limit
    ),
    selectRows(
      "ai_dataset_pair_candidates",
      "id, batch_id, pair_confidence, ecu_match_score, file_size_relation, sw_hw_match, service_label_guess, actual_service_labels, changed_region_summary, map_attribution_summary, quality_score, quality_reasons, learning_recommendation, review_status, created_at",
      limit
    ),
    selectRows(
      "file_expert_jobs",
      "id, status, brand, model, engine, ecu_type, read_method, ori_sha256, mod_sha256, ori_file_size, mod_file_size, ecu_family, sw_number, hw_number, confidence_score, risk_level, created_at",
      limit
    ),
    selectRows(
      "ai_pattern_signatures",
      "id, training_sample_id, ecu_family, ecu_type, sw_number, feature_type, human_confirmed, confidence, created_at",
      limit
    ),
    selectRows(
      "ai_pattern_clusters",
      "id, cluster_key, ecu_family, ecu_type, sw_number, hw_number, feature_type, sample_count, approved_sample_count, human_verified_sample_count, average_quality_score, cluster_confidence, cluster_status, outlier_sample_ids, source_sample_ids, last_rebuilt_at, created_at",
      limit
    ),
    selectRows(
      "ai_similarity_results",
      "id, source_type, source_id, compared_sample_id, ecu_match_score, file_size_score, identifier_score, pattern_score, feature_label_score, overall_similarity_score, match_reasons, mismatch_reasons, created_at",
      limit
    ),
    selectRows(
      "ai_map_definition_sets",
      "id, name, ecu_family, ecu_type, sw_number, hw_number, source_type, confidence_score, human_verified, verification_status, active, created_at",
      limit
    ),
    selectRows(
      "ai_map_definitions",
      "id, definition_set_id, map_name, category, confidence_score, human_verified, active, created_at",
      limit
    ),
    selectRows(
      "ai_generation_readiness_reports",
      "id, file_expert_job_id, training_sample_id, readiness_status, trust_level, blocked_reasons, missing_safety_gates, evidence_summary, export_allowed, customer_visible, created_at",
      limit
    ),
  ]);

  const results = [
    learningFiles,
    learningPairs,
    trainingSamples,
    datasetPairs,
    fileExpertJobs,
    patternSignatures,
    patternClusters,
    similarityResults,
    mapDefinitionSets,
    mapDefinitions,
    generationReadinessReports,
  ];

  return {
    rows: {
      learningFiles: learningFiles.rows,
      learningPairs: learningPairs.rows,
      trainingSamples: trainingSamples.rows,
      datasetPairs: datasetPairs.rows,
      fileExpertJobs: fileExpertJobs.rows,
      patternSignatures: patternSignatures.rows,
      patternClusters: patternClusters.rows,
      similarityResults: similarityResults.rows,
      mapDefinitionSets: mapDefinitionSets.rows,
      mapDefinitions: mapDefinitions.rows,
      generationReadinessReports: generationReadinessReports.rows,
    },
    warnings: results.map((result) => result.warning).filter(Boolean) as string[],
  };
}

export async function getEcuIntelligenceOverview(options: { includeSynthetic?: boolean } = {}) {
  const flags = getEcuIntelligenceFeatureFlags();
  const source = await loadEcuIntelligenceSourceRows();
  const clusters = buildEcuIntelligenceClusters(source.rows, options);
  const metrics = buildOverviewMetrics(clusters, source.rows);
  const insights = flags.deterministicInsightsEnabled
    ? generateEcuIntelligenceInsights({ metrics, clusters })
    : [];
  const reviewQueue = buildEcuIntelligenceReviewQueue({ rows: source.rows, clusters });
  return {
    engineVersion: ecuIntelligenceCenterEngineVersion,
    generatedAt: new Date().toISOString(),
    flags,
    metrics,
    clusters: clusters.slice(0, 12),
    serviceCoverage: buildServiceCoverage(clusters),
    insights: insights.slice(0, 8),
    reviewQueue: reviewQueue.slice(0, 8),
    warnings: source.warnings,
    safety: centerSafety(),
  };
}

export async function getEcuIntelligenceClusters(params: {
  limit?: string | number | null;
  page?: string | number | null;
  search?: string | null;
  service?: string | null;
  readiness?: string | null;
  includeSynthetic?: boolean;
}) {
  const limit = safeLimit(params.limit, 50, 200);
  const page = Math.max(Number(params.page || 1), 1);
  const source = await loadEcuIntelligenceSourceRows();
  let clusters = buildEcuIntelligenceClusters(source.rows, { includeSynthetic: params.includeSynthetic });
  const search = (params.search || "").trim().toLowerCase();
  const service = (params.service || "all").trim();
  const readiness = (params.readiness || "all").trim();

  if (search) {
    clusters = clusters.filter((cluster) =>
      [
        cluster.identity.displayLabel,
        cluster.identity.supplier,
        cluster.identity.ecuFamily,
        cluster.identity.ecuType,
        cluster.identity.hwNumber,
        cluster.identity.swNumber,
        cluster.identity.calibrationId,
      ].join(" ").toLowerCase().includes(search)
    );
  }
  if (service !== "all") {
    clusters = clusters.filter((cluster) =>
      cluster.serviceCoverage.some((cell) => cell.category === service && (cell.candidateCount || cell.approvedCount))
    );
  }
  if (readiness !== "all") clusters = clusters.filter((cluster) => cluster.readiness === readiness);

  const from = (page - 1) * limit;
  return {
    engineVersion: ecuIntelligenceCenterEngineVersion,
    generatedAt: new Date().toISOString(),
    clusters: clusters.slice(from, from + limit),
    pagination: {
      page,
      limit,
      total: clusters.length,
      hasNextPage: from + limit < clusters.length,
    },
    filters: {
      serviceCategories: ecuIntelligenceServiceCategories,
      readinessStates: [...new Set(clusters.map((cluster) => cluster.readiness))],
    },
    warnings: source.warnings,
    safety: centerSafety(),
  };
}

export async function getEcuIntelligenceClusterDetail(clusterId: string) {
  const source = await loadEcuIntelligenceSourceRows();
  const clusters = buildEcuIntelligenceClusters(source.rows, { includeSynthetic: true });
  const cluster = clusters.find((item) => item.id === clusterId);
  if (!cluster) return null;
  const graph = getEcuIntelligenceFeatureFlags().graphEnabled ? buildClusterKnowledgeGraph(cluster) : null;
  return {
    engineVersion: ecuIntelligenceCenterEngineVersion,
    generatedAt: new Date().toISOString(),
    cluster,
    graph,
    evidenceTimeline: buildEvidenceTimeline(cluster, source.rows),
    missingEvidence: cluster.serviceCoverage.flatMap((cell) =>
      cell.missingEvidence.map((reason) => ({
        service: cell.category,
        reason,
      }))
    ),
    deepLinks: {
      learningCorpus: "/admin/ai-training/corpus",
      patternClusters: "/admin/ai-training/clusters",
      mapDefinitions: "/admin/ai-training/map-definitions",
      dtcReadiness: "/admin/dtc/corpus-readiness",
      datasetWorkbench: "/admin/ai-training/datasets",
    },
    warnings: source.warnings,
    safety: centerSafety(),
  };
}

export async function getEcuIntelligenceServices() {
  const source = await loadEcuIntelligenceSourceRows();
  const clusters = buildEcuIntelligenceClusters(source.rows);
  return {
    engineVersion: ecuIntelligenceCenterEngineVersion,
    generatedAt: new Date().toISOString(),
    services: buildServiceCoverage(clusters),
    unknownLabels: [...new Set(clusters.flatMap((cluster) => cluster.unknownServiceLabels))].sort(),
    safety: centerSafety(),
  };
}

export async function getEcuIntelligencePatterns() {
  const source = await loadEcuIntelligenceSourceRows();
  return {
    engineVersion: ecuIntelligenceCenterEngineVersion,
    generatedAt: new Date().toISOString(),
    signatures: source.rows.patternSignatures.slice(0, 100).map((row) => ({
      id: row.id,
      ecu_family: row.ecu_family,
      ecu_type: row.ecu_type,
      sw_number: row.sw_number,
      feature_type: row.feature_type,
      human_confirmed: row.human_confirmed,
      confidence: row.confidence,
      created_at: row.created_at,
    })),
    clusters: source.rows.patternClusters.slice(0, 100),
    safety: centerSafety(),
    warnings: source.warnings,
  };
}

export async function getEcuIntelligenceSimilarity() {
  const source = await loadEcuIntelligenceSourceRows();
  return {
    engineVersion: ecuIntelligenceCenterEngineVersion,
    generatedAt: new Date().toISOString(),
    results: source.rows.similarityResults.slice(0, 100).map((row) => ({
      id: row.id,
      source_type: row.source_type,
      source_id: row.source_id,
      compared_sample_id: row.compared_sample_id,
      ecu_match_score: row.ecu_match_score,
      file_size_score: row.file_size_score,
      identifier_score: row.identifier_score,
      pattern_score: row.pattern_score,
      feature_label_score: row.feature_label_score,
      overall_similarity_score: row.overall_similarity_score,
      match_reasons: row.match_reasons,
      mismatch_reasons: row.mismatch_reasons,
      created_at: row.created_at,
      warning: "Similarity is evidence retrieval only and never implies exact SW compatibility or modification eligibility.",
    })),
    safety: centerSafety(),
    warnings: source.warnings,
  };
}

export async function getEcuIntelligenceReviewQueue() {
  const source = await loadEcuIntelligenceSourceRows();
  const clusters = buildEcuIntelligenceClusters(source.rows);
  return {
    engineVersion: ecuIntelligenceCenterEngineVersion,
    generatedAt: new Date().toISOString(),
    items: buildEcuIntelligenceReviewQueue({ rows: source.rows, clusters }),
    safety: centerSafety(),
    warnings: source.warnings,
  };
}

export async function getEcuIntelligenceInsights() {
  const source = await loadEcuIntelligenceSourceRows();
  const clusters = buildEcuIntelligenceClusters(source.rows);
  const metrics = buildOverviewMetrics(clusters, source.rows);
  return {
    engineVersion: ecuIntelligenceCenterEngineVersion,
    generatedAt: new Date().toISOString(),
    insights: generateEcuIntelligenceInsights({ metrics, clusters }),
    safety: centerSafety(),
    warnings: source.warnings,
  };
}

export async function getEcuIntelligenceBackfillStatus() {
  const source = await loadEcuIntelligenceSourceRows();
  const admin = getSupabaseAdmin();
  const events = await admin
    .from("ai_learning_review_events")
    .select("id, action, notes, created_at")
    .ilike("action", "%backfill%")
    .order("created_at", { ascending: false })
    .limit(25);

  return {
    engineVersion: ecuIntelligenceCenterEngineVersion,
    generatedAt: new Date().toISOString(),
    status: {
      existingBackfillEndpoint: "/api/admin/ai/learning-corpus/backfill",
      dryRunRecommendedFirst: true,
      createsApprovedSamples: false,
      candidateCount: source.rows.learningFiles.length + source.rows.learningPairs.length,
      lastEvents: events.error ? [] : events.data ?? [],
      loadError: events.error?.message ?? null,
    },
    safety: centerSafety(),
    warnings: source.warnings,
  };
}

export function buildServiceCoverage(clusters: Awaited<ReturnType<typeof buildEcuIntelligenceClusters>>) {
  return ecuIntelligenceServiceCategories.map((category) => {
    const cells = clusters.flatMap((cluster) => cluster.serviceCoverage.filter((cell) => cell.category === category));
    return {
      category,
      clusterCount: cells.length,
      candidateCount: cells.reduce((sum, cell) => sum + cell.candidateCount, 0),
      approvedCount: cells.reduce((sum, cell) => sum + cell.approvedCount, 0),
      singleServiceCount: cells.reduce((sum, cell) => sum + cell.singleServiceCount, 0),
      multiServiceCount: cells.reduce((sum, cell) => sum + cell.multiServiceCount, 0),
      reviewRequiredCount: cells.reduce((sum, cell) => sum + cell.reviewRequiredCount, 0),
      exactDtcCodeCount: new Set(cells.flatMap((cell) => cell.exactDtcCodes)).size,
      strongestReadiness: cells.some((cell) => cell.readiness === "RESEARCH_ELIGIBLE")
        ? "RESEARCH_ELIGIBLE"
        : cells.some((cell) => cell.readiness === "APPROVED_EVIDENCE_AVAILABLE")
          ? "APPROVED_EVIDENCE_AVAILABLE"
          : cells.some((cell) => cell.readiness === "HUMAN_REVIEW_REQUIRED")
            ? "HUMAN_REVIEW_REQUIRED"
            : cells.some((cell) => cell.readiness === "CANDIDATES_AVAILABLE")
              ? "CANDIDATES_AVAILABLE"
              : "NO_EVIDENCE",
    };
  });
}

function buildEvidenceTimeline(cluster: Awaited<ReturnType<typeof buildEcuIntelligenceClusters>>[number], rows: EcuIntelligenceSourceRows) {
  const matches = (row: Record<string, unknown>) => {
    const text = [row.ecu_family, row.ecu_type, row.hw_number, row.sw_number, row.pair_identity_key]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return text.includes(cluster.identity.ecuFamily.toLowerCase()) ||
      text.includes(cluster.identity.ecuType.toLowerCase()) ||
      text.includes(cluster.identity.swNumber.toLowerCase());
  };
  return [
    ...rows.learningFiles.filter(matches).slice(0, 20).map((row) => ({
      type: "learning_file_candidate",
      label: "Learning file candidate observed",
      created_at: row.created_at,
      status: row.review_status,
    })),
    ...rows.learningPairs.filter(matches).slice(0, 20).map((row) => ({
      type: "learning_pair_candidate",
      label: "ORI/MOD pair candidate created",
      created_at: row.created_at,
      status: row.review_status,
    })),
    ...rows.trainingSamples.filter(matches).slice(0, 20).map((row) => ({
      type: "training_sample",
      label: "Training sample evidence",
      created_at: row.created_at,
      status: row.learning_use_status,
    })),
  ]
    .filter((item) => item.created_at)
    .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))
    .slice(0, 50);
}

export function centerSafety() {
  return {
    adminOnly: true,
    rawFirmwareBytesReturned: false,
    storagePathsReturned: false,
    signedUrlsReturned: false,
    customerPiiReturned: false,
    customerDeliveryEnabled: false,
    firmwareGenerated: false,
    modGenerated: false,
    realChecksumAdaptersExecuted: false,
    automationEnabled: false,
  } as const;
}

export { tableMissing, safeLimit };
