import { canonicalizeClusterIdentity, clusterKeyFromLegacyPairIdentityKey } from "@/lib/ecuIntelligence/center/clusterIdentity";
import { calculateKnowledgeScore } from "@/lib/ecuIntelligence/center/knowledgeScore";
import { calculateClusterReadiness, calculateServiceReadiness } from "@/lib/ecuIntelligence/center/readiness";
import { normalizeServiceEvidence } from "@/lib/ecuIntelligence/center/serviceTaxonomy";
import {
  ecuIntelligenceServiceCategories,
  type CanonicalEcuClusterIdentity,
  type EcuClusterIdentityInput,
  type EcuIntelligenceClusterSummary,
  type EcuIntelligenceOverviewMetrics,
  type EcuIntelligenceServiceCategory,
  type EcuIntelligenceServiceCoverageCell,
  type EcuIntelligenceServiceInput,
  type EcuIntelligenceSourceRows,
} from "@/lib/ecuIntelligence/center/types";

function stringValue(value: unknown) {
  return typeof value === "string" ? value : value === null || value === undefined ? "" : String(value);
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function dateValue(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function serviceLabels(value: unknown): EcuIntelligenceServiceInput["labels"] {
  if (typeof value === "string" || Array.isArray(value)) return value as EcuIntelligenceServiceInput["labels"];
  if (value && typeof value === "object") return value as Record<string, unknown>;
  return null;
}

function rowHasSyntheticEvidence(row: Record<string, unknown>) {
  const sourceType = stringValue(row.source_type).toLowerCase();
  if (sourceType.includes("demo") || sourceType.includes("synthetic")) return true;
  const provenance = row.provenance;
  if (provenance && typeof provenance === "object" && !Array.isArray(provenance)) {
    const record = provenance as Record<string, unknown>;
    return record.synthetic === true || record.demo === true || stringValue(record.source).includes("synthetic");
  }
  return false;
}

function normalizeIdentityFromRow(row: Record<string, unknown>, fileRoleFallback = "unknown"): CanonicalEcuClusterIdentity {
  const fileSize = row.file_size ?? row.ori_file_size ?? row.mod_file_size;
  return canonicalizeClusterIdentity({
    supplier: stringValue(row.supplier),
    ecuFamily: stringValue(row.ecu_family ?? row.ecu_family_guess),
    ecuType: stringValue(row.ecu_type ?? row.ecu_type_guess),
    hwNumber: stringValue(row.hw_number ?? row.hw_number_guess),
    swNumber: stringValue(row.sw_number ?? row.sw_number_guess),
    calibrationId: stringValue(row.calibration_id),
    representationType: stringValue(row.representation_type ?? row.file_extension),
    fileRole: stringValue(row.file_role_candidate ?? row.file_role ?? row.file_role_guess ?? fileRoleFallback),
    fileSize: typeof fileSize === "number" || typeof fileSize === "string" ? fileSize : null,
    readMethod: stringValue(row.read_method),
    segmentManifestDigest: stringValue(row.segment_manifest_digest),
  } satisfies EcuClusterIdentityInput);
}

type MutableCluster = EcuIntelligenceClusterSummary & {
  sourceHashes: Set<string>;
  serviceCells: Map<EcuIntelligenceServiceCategory, EcuIntelligenceServiceCoverageCell>;
  unknownServiceLabelSet: Set<string>;
  unresolvedAuthorizationCount: number;
  quarantineCount: number;
  humanVerifiedCount: number;
};

function emptyServiceCell(category: EcuIntelligenceServiceCategory): EcuIntelligenceServiceCoverageCell {
  return {
    category,
    candidateCount: 0,
    approvedCount: 0,
    singleServiceCount: 0,
    multiServiceCount: 0,
    reviewRequiredCount: 0,
    exactDtcCodes: [],
    readiness: "NO_EVIDENCE",
    missingEvidence: [],
  };
}

function makeCluster(identity: CanonicalEcuClusterIdentity): MutableCluster {
  const serviceCells = new Map<EcuIntelligenceServiceCategory, EcuIntelligenceServiceCoverageCell>();
  for (const category of ecuIntelligenceServiceCategories) serviceCells.set(category, emptyServiceCell(category));
  return {
    id: identity.clusterKey,
    identity,
    uniqueSourceCount: 0,
    duplicateCount: 0,
    fileCandidateCount: 0,
    fileExpertCount: 0,
    pairCandidateCount: 0,
    approvedPairCount: 0,
    reviewedPairCount: 0,
    singleServicePairCount: 0,
    multiServicePairCount: 0,
    checksumOnlyPairCount: 0,
    trainingSampleCount: 0,
    approvedTrainingSampleCount: 0,
    patternCount: 0,
    patternClusterCount: 0,
    similarityCount: 0,
    mapDefinitionSetCount: 0,
    mapDefinitionCount: 0,
    dtcEvidenceCount: 0,
    conflictCount: identity.conflictReasons.length,
    missingEvidenceCount: 0,
    knowledgeScore: null as never,
    readiness: "NO_EVIDENCE",
    serviceCoverage: [],
    unknownServiceLabels: [],
    firstObservedAt: null,
    lastObservedAt: null,
    syntheticEvidenceCount: 0,
    sourceHashes: new Set<string>(),
    serviceCells,
    unknownServiceLabelSet: new Set<string>(),
    unresolvedAuthorizationCount: 0,
    quarantineCount: 0,
    humanVerifiedCount: 0,
  };
}

function touchObserved(cluster: MutableCluster, createdAt: unknown) {
  const date = dateValue(createdAt);
  if (!date) return;
  if (!cluster.firstObservedAt || date < cluster.firstObservedAt) cluster.firstObservedAt = date;
  if (!cluster.lastObservedAt || date > cluster.lastObservedAt) cluster.lastObservedAt = date;
}

function addHash(cluster: MutableCluster, hash: unknown) {
  const text = stringValue(hash).toLowerCase();
  if (/^[a-f0-9]{64}$/.test(text)) cluster.sourceHashes.add(text);
}

function addServices(cluster: MutableCluster, input: Parameters<typeof normalizeServiceEvidence>[0], options: {
  approved?: boolean;
  singleService?: boolean;
  multiService?: boolean;
  reviewRequired?: boolean;
} = {}) {
  const evidence = normalizeServiceEvidence(input);
  for (const category of evidence.categories) {
    const cell = cluster.serviceCells.get(category) || emptyServiceCell(category);
    cell.candidateCount += 1;
    if (options.approved) cell.approvedCount += 1;
    if (options.singleService) cell.singleServiceCount += 1;
    if (options.multiService) cell.multiServiceCount += 1;
    if (options.reviewRequired) cell.reviewRequiredCount += 1;
    if (category === "dtc") {
      cell.exactDtcCodes = [...new Set([...cell.exactDtcCodes, ...evidence.exactDtcCodes])].sort();
      cluster.dtcEvidenceCount += evidence.exactDtcCodes.length || 1;
    }
    cluster.serviceCells.set(category, cell);
  }
  for (const label of evidence.unknownLabels) cluster.unknownServiceLabelSet.add(label);
}

function ensureCluster(clusters: Map<string, MutableCluster>, identity: CanonicalEcuClusterIdentity) {
  const existing = clusters.get(identity.clusterKey);
  if (existing) return existing;
  const cluster = makeCluster(identity);
  clusters.set(identity.clusterKey, cluster);
  return cluster;
}

export function buildEcuIntelligenceClusters(rows: EcuIntelligenceSourceRows, options: { includeSynthetic?: boolean } = {}) {
  const clusters = new Map<string, MutableCluster>();

  for (const row of rows.learningFiles) {
    if (!options.includeSynthetic && rowHasSyntheticEvidence(row)) continue;
    const cluster = ensureCluster(clusters, normalizeIdentityFromRow(row));
    cluster.fileCandidateCount += 1;
    cluster.conflictCount += arrayValue(row.identity_conflicts).length;
    if (stringValue(row.review_status) === "quarantined") cluster.quarantineCount += 1;
    if (stringValue(row.learning_authorization_status) !== "granted") cluster.unresolvedAuthorizationCount += 1;
    if (rowHasSyntheticEvidence(row)) cluster.syntheticEvidenceCount += 1;
    if (stringValue(row.file_role_candidate) === "ori") cluster.serviceCells.get("unknown")!.candidateCount += 0;
    addHash(cluster, row.sha256);
    addServices(cluster, { labels: serviceLabels(row.requested_service_labels), exactDtcCodes: row.dtc_codes });
    touchObserved(cluster, row.created_at);
  }

  for (const row of rows.fileExpertJobs) {
    if (!options.includeSynthetic && rowHasSyntheticEvidence(row)) continue;
    const cluster = ensureCluster(clusters, normalizeIdentityFromRow(row, "single"));
    cluster.fileExpertCount += 1;
    if (stringValue(row.status) === "completed") cluster.humanVerifiedCount += 0;
    addHash(cluster, row.ori_sha256);
    addHash(cluster, row.mod_sha256);
    touchObserved(cluster, row.created_at);
  }

  for (const row of rows.trainingSamples) {
    if (!options.includeSynthetic && rowHasSyntheticEvidence(row)) continue;
    const cluster = ensureCluster(clusters, normalizeIdentityFromRow(row, "ori"));
    cluster.trainingSampleCount += 1;
    if (stringValue(row.learning_use_status) === "approved_for_learning") cluster.approvedTrainingSampleCount += 1;
    if (stringValue(row.human_verification_status) === "confirmed") cluster.humanVerifiedCount += 1;
    if (stringValue(row.human_verification_status) === "rejected") cluster.quarantineCount += 1;
    addHash(cluster, row.ori_sha256);
    addHash(cluster, row.mod_sha256);
    addServices(cluster, {
      labels: serviceLabels(row.performed_service_labels ?? row.service_labels ?? row.requested_service_labels),
      exactDtcCodes: row.dtc_codes,
      sourceText: stringValue(row.change_type_classification),
    }, {
      approved: stringValue(row.learning_use_status) === "approved_for_learning",
      singleService: true,
      reviewRequired: stringValue(row.human_verification_status) !== "confirmed",
    });
    touchObserved(cluster, row.created_at);
  }

  for (const row of rows.learningPairs) {
    if (!options.includeSynthetic && rowHasSyntheticEvidence(row)) continue;
    const fromPairKey = clusterKeyFromLegacyPairIdentityKey(row.pair_identity_key);
    const cluster = ensureCluster(clusters, fromPairKey || canonicalizeClusterIdentity({ fileRole: "unknown" }));
    cluster.pairCandidateCount += 1;
    const reviewStatus = stringValue(row.review_status);
    const approved = stringValue(row.learning_use_status) === "approved_for_learning";
    const pairType = stringValue(row.pair_type);
    if (["human_verified", "approved"].includes(reviewStatus)) cluster.reviewedPairCount += 1;
    if (approved) cluster.approvedPairCount += 1;
    if (pairType === "single_service_clean") cluster.singleServicePairCount += 1;
    if (pairType === "multi_service") cluster.multiServicePairCount += 1;
    if (pairType === "checksum_only_noop") cluster.checksumOnlyPairCount += 1;
    if (["quarantined", "excluded"].includes(reviewStatus)) cluster.quarantineCount += 1;
    if (stringValue(row.learning_authorization_status) !== "granted") cluster.unresolvedAuthorizationCount += 1;
    addHash(cluster, row.ori_sha256);
    addHash(cluster, row.mod_sha256);
    addServices(cluster, {
      labels: serviceLabels(row.performed_service_labels ?? row.requested_service_labels),
      exactDtcCodes: row.dtc_codes,
    }, {
      approved,
      singleService: pairType === "single_service_clean",
      multiService: pairType === "multi_service",
      reviewRequired: !["human_verified", "approved"].includes(reviewStatus),
    });
    touchObserved(cluster, row.created_at);
  }

  for (const row of rows.datasetPairs) {
    if (!options.includeSynthetic && rowHasSyntheticEvidence(row)) continue;
    const cluster = ensureCluster(clusters, normalizeIdentityFromRow(row, "unknown"));
    cluster.pairCandidateCount += 1;
    const reviewStatus = stringValue(row.review_status);
    const approved = reviewStatus === "approved";
    if (approved) cluster.reviewedPairCount += 1;
    addServices(cluster, {
      labels: serviceLabels(row.actual_service_labels ?? row.service_label_guess),
    }, {
      approved,
      reviewRequired: !approved,
      singleService: arrayValue(row.actual_service_labels ?? row.service_label_guess).length === 1,
      multiService: arrayValue(row.actual_service_labels ?? row.service_label_guess).length > 1,
    });
    touchObserved(cluster, row.created_at);
  }

  for (const row of rows.patternSignatures) {
    const cluster = ensureCluster(clusters, normalizeIdentityFromRow(row, "unknown"));
    cluster.patternCount += 1;
    addServices(cluster, { labels: [stringValue(row.feature_type)] });
    touchObserved(cluster, row.created_at);
  }

  for (const row of rows.patternClusters) {
    const cluster = ensureCluster(clusters, normalizeIdentityFromRow(row, "unknown"));
    cluster.patternClusterCount += 1;
    cluster.approvedTrainingSampleCount += numberValue(row.approved_sample_count);
    addServices(cluster, { labels: [stringValue(row.feature_type)] }, { approved: numberValue(row.approved_sample_count) > 0 });
    touchObserved(cluster, row.last_rebuilt_at ?? row.created_at);
  }

  for (const row of rows.mapDefinitionSets) {
    const cluster = ensureCluster(clusters, normalizeIdentityFromRow(row, "unknown"));
    cluster.mapDefinitionSetCount += 1;
    if (row.human_verified !== true) cluster.unresolvedAuthorizationCount += 0;
    touchObserved(cluster, row.created_at);
  }

  for (const row of rows.mapDefinitions) {
    const category = stringValue(row.category);
    for (const cluster of clusters.values()) {
      if (cluster.mapDefinitionSetCount && category) {
        cluster.mapDefinitionCount += 1;
        addServices(cluster, { labels: [category] }, { approved: row.active !== false });
      }
    }
  }

  for (const row of rows.similarityResults) {
    const sourceId = stringValue(row.source_id);
    for (const cluster of clusters.values()) {
      if (sourceId && cluster.id.includes(sourceId)) cluster.similarityCount += 1;
    }
  }

  const finalized = [...clusters.values()].map((cluster) => {
    cluster.uniqueSourceCount = cluster.sourceHashes.size;
    cluster.duplicateCount = Math.max(0, cluster.fileCandidateCount + cluster.trainingSampleCount + cluster.fileExpertCount - cluster.uniqueSourceCount);
    const serviceCoverage = [...cluster.serviceCells.values()]
      .map((cell) => {
        const state = calculateServiceReadiness(cell);
        return { ...cell, readiness: state.readiness, missingEvidence: state.missingEvidence };
      })
      .filter((cell) => cell.candidateCount || cell.approvedCount || cell.missingEvidence.length <= 2);
    const readiness = calculateClusterReadiness({
      identity: cluster.identity,
      fileCandidateCount: cluster.fileCandidateCount + cluster.fileExpertCount,
      pairCandidateCount: cluster.pairCandidateCount,
      approvedPairCount: cluster.approvedPairCount + cluster.approvedTrainingSampleCount,
      reviewedPairCount: cluster.reviewedPairCount,
      singleServicePairCount: cluster.singleServicePairCount,
      checksumOnlyPairCount: cluster.checksumOnlyPairCount,
      approvedTrainingSampleCount: cluster.approvedTrainingSampleCount,
      patternClusterCount: cluster.patternClusterCount,
      mapDefinitionSetCount: cluster.mapDefinitionSetCount,
      conflictCount: cluster.conflictCount,
      syntheticEvidenceCount: cluster.syntheticEvidenceCount,
      unresolvedAuthorizationCount: cluster.unresolvedAuthorizationCount,
      unknownServiceLabels: [...cluster.unknownServiceLabelSet],
    });
    const knowledgeScore = calculateKnowledgeScore({
      identityCompleteness: cluster.identity.completenessScore,
      totalEvidenceCount: cluster.fileCandidateCount + cluster.fileExpertCount + cluster.pairCandidateCount + cluster.trainingSampleCount,
      uniqueSourceCount: cluster.uniqueSourceCount,
      approvedPairCount: cluster.approvedPairCount + cluster.approvedTrainingSampleCount,
      singleServicePairCount: cluster.singleServicePairCount,
      patternClusterCount: cluster.patternClusterCount,
      mapDefinitionSetCount: cluster.mapDefinitionSetCount,
      humanVerifiedCount: cluster.humanVerifiedCount,
      reviewedPairCount: cluster.reviewedPairCount,
      unresolvedAuthorizationCount: cluster.unresolvedAuthorizationCount,
      conflictCount: cluster.conflictCount,
      quarantineCount: cluster.quarantineCount,
      syntheticEvidenceCount: cluster.syntheticEvidenceCount,
      hardBlockers: readiness.hardBlockers,
    });
    return {
      ...cluster,
      uniqueSourceCount: cluster.uniqueSourceCount,
      duplicateCount: cluster.duplicateCount,
      serviceCoverage,
      unknownServiceLabels: [...cluster.unknownServiceLabelSet].sort(),
      missingEvidenceCount: new Set([
        ...readiness.missingEvidence,
        ...serviceCoverage.flatMap((cell) => cell.missingEvidence),
      ]).size,
      readiness: readiness.state,
      knowledgeScore,
      sourceHashes: undefined,
      serviceCells: undefined,
      unknownServiceLabelSet: undefined,
      unresolvedAuthorizationCount: undefined,
      quarantineCount: undefined,
      humanVerifiedCount: undefined,
    } as EcuIntelligenceClusterSummary;
  });

  return finalized.sort((left, right) =>
    right.knowledgeScore.score - left.knowledgeScore.score ||
    right.pairCandidateCount - left.pairCandidateCount ||
    right.fileCandidateCount - left.fileCandidateCount
  );
}

export function buildOverviewMetrics(clusters: EcuIntelligenceClusterSummary[], rows: EcuIntelligenceSourceRows): EcuIntelligenceOverviewMetrics {
  const distinctHashes = new Set<string>();
  for (const row of [...rows.learningFiles, ...rows.trainingSamples, ...rows.fileExpertJobs]) {
    for (const key of ["sha256", "ori_sha256", "mod_sha256"]) {
      const value = stringValue(row[key]).toLowerCase();
      if (/^[a-f0-9]{64}$/.test(value)) distinctHashes.add(value);
    }
  }
  const serviceCategories = new Set(clusters.flatMap((cluster) =>
    cluster.serviceCoverage.filter((cell) => cell.candidateCount || cell.approvedCount).map((cell) => cell.category)
  ));

  return {
    finalizedCustomerUploads: rows.learningFiles.filter((row) => !rowHasSyntheticEvidence(row)).length,
    learningFileCandidates: rows.learningFiles.length,
    fileExpertAnalyzedFiles: rows.fileExpertJobs.filter((row) => stringValue(row.status) === "completed").length,
    exactIdentityComplete: clusters.filter((cluster) => cluster.identity.completenessScore >= 85).length,
    identityAmbiguous: clusters.filter((cluster) => cluster.identity.ambiguousFields.length || cluster.identity.conflictReasons.length).length,
    quarantinedFiles: rows.learningFiles.filter((row) => stringValue(row.review_status) === "quarantined").length,
    distinctSourceSha256Count: distinctHashes.size,
    oriCandidates: rows.learningFiles.filter((row) => stringValue(row.file_role_candidate) === "ori").length,
    modCandidates: rows.learningFiles.filter((row) => stringValue(row.file_role_candidate) === "mod").length,
    pairCandidates: rows.learningPairs.length + rows.datasetPairs.length,
    reviewedPairs: rows.learningPairs.filter((row) => ["human_verified", "approved"].includes(stringValue(row.review_status))).length,
    approvedLearningPairs: rows.learningPairs.filter((row) => stringValue(row.learning_use_status) === "approved_for_learning").length,
    singleServiceCleanPairs: rows.learningPairs.filter((row) => stringValue(row.pair_type) === "single_service_clean").length,
    multiServicePairs: rows.learningPairs.filter((row) => stringValue(row.pair_type) === "multi_service").length,
    checksumOnlyNoopControls: rows.learningPairs.filter((row) => stringValue(row.pair_type) === "checksum_only_noop").length,
    humanVerifiedSamples: rows.trainingSamples.filter((row) => stringValue(row.human_verification_status) === "confirmed").length,
    approvedTrainingSamples: rows.trainingSamples.filter((row) => stringValue(row.learning_use_status) === "approved_for_learning").length,
    exactClusterCount: clusters.length,
    serviceCategoryCount: serviceCategories.size,
    patternSignatureCount: rows.patternSignatures.length,
    patternClusterCount: rows.patternClusters.length,
    mapDefinitionSetCount: rows.mapDefinitionSets.length,
    dtcEvidenceCount: clusters.reduce((sum, cluster) => sum + cluster.dtcEvidenceCount, 0),
    reviewQueueCount: rows.learningPairs.filter((row) => ["pending_review", "needs_review"].includes(stringValue(row.review_status))).length +
      rows.learningFiles.filter((row) => ["pending_review", "needs_review"].includes(stringValue(row.review_status))).length,
    unresolvedAuthorizationCount: rows.learningPairs.filter((row) => stringValue(row.learning_authorization_status) !== "granted").length +
      rows.learningFiles.filter((row) => stringValue(row.learning_authorization_status) !== "granted").length,
    unresolvedIdentityConflictCount: clusters.reduce((sum, cluster) => sum + cluster.conflictCount, 0),
  };
}
