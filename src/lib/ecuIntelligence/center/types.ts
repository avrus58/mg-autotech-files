import type { TrainingFeature, TrainingServiceLabels } from "@/lib/ecuIntelligence/types";

export const ecuIntelligenceClusterKeyVersion = "eci-cluster-v1" as const;
export const ecuIntelligenceKnowledgeScoreVersion = "knowledge-score-v1" as const;
export const ecuIntelligenceReadinessVersion = "readiness-v1" as const;
export const ecuIntelligenceInsightRuleVersion = "insights-v1" as const;

export type EcuIntelligenceServiceCategory =
  | "stage_1"
  | "stage_2"
  | "stage_3"
  | "dtc"
  | "dpf"
  | "egr"
  | "adblue"
  | "swirl"
  | "tva"
  | "vmax"
  | "start_stop"
  | "hot_start"
  | "cold_start"
  | "launch_control"
  | "pops_bangs"
  | "torque"
  | "tcu"
  | "boost"
  | "rail_pressure"
  | "lambda"
  | "other"
  | "unknown";

export const ecuIntelligenceServiceCategories: EcuIntelligenceServiceCategory[] = [
  "stage_1",
  "stage_2",
  "stage_3",
  "dtc",
  "dpf",
  "egr",
  "adblue",
  "swirl",
  "tva",
  "vmax",
  "start_stop",
  "hot_start",
  "cold_start",
  "launch_control",
  "pops_bangs",
  "torque",
  "tcu",
  "boost",
  "rail_pressure",
  "lambda",
  "other",
  "unknown",
];

export type EcuIntelligenceReadinessState =
  | "NO_EVIDENCE"
  | "IDENTITY_ONLY"
  | "CANDIDATES_AVAILABLE"
  | "HUMAN_REVIEW_REQUIRED"
  | "APPROVED_EVIDENCE_AVAILABLE"
  | "CONTROLLED_PAIR_REQUIRED"
  | "INTEGRITY_RESEARCH_REQUIRED"
  | "LAB_VALIDATION_REQUIRED"
  | "RESEARCH_ELIGIBLE"
  | "BLOCKED";

export type EcuClusterIdentityInput = {
  supplier?: string | null;
  ecuFamily?: string | null;
  ecuType?: string | null;
  hwNumber?: string | null;
  swNumber?: string | null;
  calibrationId?: string | null;
  calibrationIdUnavailableReason?: string | null;
  representationType?: string | null;
  fileRole?: string | null;
  fileSize?: number | string | null;
  readMethod?: string | null;
  segmentManifestDigest?: string | null;
};

export type CanonicalEcuClusterIdentity = {
  version: typeof ecuIntelligenceClusterKeyVersion;
  supplier: string;
  ecuFamily: string;
  ecuType: string;
  hwNumber: string;
  swNumber: string;
  calibrationId: string;
  calibrationIdUnavailableReason: string;
  representationType: string;
  fileRole: "ori" | "mod" | "single" | "unknown";
  fileSize: string;
  readMethod: string;
  segmentManifestDigest: string;
  clusterKey: string;
  displayLabel: string;
  completenessScore: number;
  missingFields: string[];
  ambiguousFields: string[];
  conflictReasons: string[];
};

export type EcuIntelligenceKnowledgeScore = {
  version: typeof ecuIntelligenceKnowledgeScoreVersion;
  score: number;
  components: {
    identityCompleteness: number;
    authorizationCoverage: number;
    provenanceQuality: number;
    corpusVolume: number;
    approvedPairCoverage: number;
    singleServiceCoverage: number;
    patternConsistency: number;
    mapDefinitionCoverage: number;
    humanVerificationDepth: number;
    validationDepth: number;
    conflictPenalty: number;
    quarantinePenalty: number;
    syntheticDataPenalty: number;
  };
  hardBlockers: string[];
};

export type EcuIntelligenceServiceCoverageCell = {
  category: EcuIntelligenceServiceCategory;
  candidateCount: number;
  approvedCount: number;
  singleServiceCount: number;
  multiServiceCount: number;
  reviewRequiredCount: number;
  exactDtcCodes: string[];
  readiness: EcuIntelligenceReadinessState;
  missingEvidence: string[];
};

export type EcuIntelligenceClusterSummary = {
  id: string;
  identity: CanonicalEcuClusterIdentity;
  uniqueSourceCount: number;
  duplicateCount: number;
  fileCandidateCount: number;
  fileExpertCount: number;
  pairCandidateCount: number;
  approvedPairCount: number;
  reviewedPairCount: number;
  singleServicePairCount: number;
  multiServicePairCount: number;
  checksumOnlyPairCount: number;
  trainingSampleCount: number;
  approvedTrainingSampleCount: number;
  patternCount: number;
  patternClusterCount: number;
  similarityCount: number;
  mapDefinitionSetCount: number;
  mapDefinitionCount: number;
  dtcEvidenceCount: number;
  conflictCount: number;
  missingEvidenceCount: number;
  knowledgeScore: EcuIntelligenceKnowledgeScore;
  readiness: EcuIntelligenceReadinessState;
  serviceCoverage: EcuIntelligenceServiceCoverageCell[];
  unknownServiceLabels: string[];
  firstObservedAt: string | null;
  lastObservedAt: string | null;
  syntheticEvidenceCount: number;
};

export type EcuIntelligenceOverviewMetrics = {
  finalizedCustomerUploads: number;
  learningFileCandidates: number;
  fileExpertAnalyzedFiles: number;
  exactIdentityComplete: number;
  identityAmbiguous: number;
  quarantinedFiles: number;
  distinctSourceSha256Count: number;
  oriCandidates: number;
  modCandidates: number;
  pairCandidates: number;
  reviewedPairs: number;
  approvedLearningPairs: number;
  singleServiceCleanPairs: number;
  multiServicePairs: number;
  checksumOnlyNoopControls: number;
  humanVerifiedSamples: number;
  approvedTrainingSamples: number;
  exactClusterCount: number;
  serviceCategoryCount: number;
  patternSignatureCount: number;
  patternClusterCount: number;
  mapDefinitionSetCount: number;
  dtcEvidenceCount: number;
  reviewQueueCount: number;
  unresolvedAuthorizationCount: number;
  unresolvedIdentityConflictCount: number;
};

export type EcuIntelligenceReviewQueueItem = {
  id: string;
  sourceType:
    | "learning_file_candidate"
    | "learning_pair_candidate"
    | "training_sample"
    | "dataset_pair_candidate"
    | "identity_conflict"
    | "authorization_gap"
    | "unknown_service_label";
  title: string;
  scope: string;
  priorityScore: number;
  priorityReasons: Array<{ code: string; label: string; impact: number }>;
  recommendedAction: string;
  createdAt: string | null;
  adminHref: string;
};

export type EcuIntelligenceInsight = {
  id: string;
  type:
    | "rapidly_growing_cluster"
    | "high_review_backlog"
    | "high_quarantine_rate"
    | "high_duplicate_rate"
    | "authorization_gap"
    | "identity_extraction_gap"
    | "multi_service_needs_clean_pairs"
    | "approval_gap"
    | "pattern_gap"
    | "dtc_controlled_pair_gap"
    | "map_without_pairs"
    | "validation_gap"
    | "conflicting_labels"
    | "stale_cluster"
    | "backfill_opportunity"
    | "promising_research_candidate"
    | "anomalous_sample_warning";
  severity: "info" | "warning" | "critical";
  title: string;
  explanation: string;
  scope: string;
  supportingMetrics: Record<string, number | string>;
  evidenceRefs: string[];
  recommendedAction: string;
  generatedAt: string;
  ruleVersion: typeof ecuIntelligenceInsightRuleVersion;
  acknowledged: false;
};

export type EcuIntelligenceGraph = {
  clusterId: string;
  nodes: Array<{
    id: string;
    type: string;
    label: string;
    evidenceCount?: number;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    type: string;
    label: string;
  }>;
  safety: {
    rawBytesIncluded: false;
    storagePathsIncluded: false;
    customerPiiIncluded: false;
  };
};

export type EcuIntelligenceSourceRows = {
  learningFiles: Record<string, unknown>[];
  learningPairs: Record<string, unknown>[];
  trainingSamples: Record<string, unknown>[];
  datasetPairs: Record<string, unknown>[];
  fileExpertJobs: Record<string, unknown>[];
  patternSignatures: Record<string, unknown>[];
  patternClusters: Record<string, unknown>[];
  similarityResults: Record<string, unknown>[];
  mapDefinitionSets: Record<string, unknown>[];
  mapDefinitions: Record<string, unknown>[];
  generationReadinessReports: Record<string, unknown>[];
};

export type EcuIntelligenceServiceInput = {
  labels?: Partial<TrainingServiceLabels> | Record<string, unknown> | string | string[] | null;
  exactDtcCodes?: unknown;
  sourceText?: string | null;
};

export type EcuIntelligenceFeatureFlagState = {
  centerEnabled: boolean;
  deterministicInsightsEnabled: boolean;
  graphEnabled: boolean;
  refreshEnabled: boolean;
  realEcuRulesEnabled: false;
  realIntegrityAdaptersEnabled: false;
  a3ProcessingEnabled: false;
  a4AutomationEnabled: false;
  a5AutomationEnabled: false;
  customerDeliveryEnabled: false;
  instructionPatchOperationsEnabled: false;
  globalDtcProductionKillSwitchEngaged: true;
};

export type EcuIntelligenceTrainingFeature = TrainingFeature;
