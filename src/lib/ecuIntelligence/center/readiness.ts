import {
  ecuIntelligenceReadinessVersion,
  type EcuIntelligenceReadinessState,
  type EcuIntelligenceServiceCoverageCell,
} from "@/lib/ecuIntelligence/center/types";
import type { CanonicalEcuClusterIdentity } from "@/lib/ecuIntelligence/center/types";

export type ReadinessInput = {
  identity: CanonicalEcuClusterIdentity;
  fileCandidateCount: number;
  pairCandidateCount: number;
  approvedPairCount: number;
  reviewedPairCount: number;
  singleServicePairCount: number;
  checksumOnlyPairCount: number;
  approvedTrainingSampleCount: number;
  patternClusterCount: number;
  mapDefinitionSetCount: number;
  conflictCount: number;
  syntheticEvidenceCount: number;
  unresolvedAuthorizationCount: number;
  unknownServiceLabels: string[];
};

export function hardBlockersForCluster(input: ReadinessInput) {
  const blockers: string[] = [];
  if (input.identity.ambiguousFields.length) blockers.push("ambiguous_identity");
  if (input.identity.conflictReasons.length) blockers.push("identity_conflict");
  if (input.conflictCount > 0) blockers.push("unresolved_conflicts");
  if (input.unresolvedAuthorizationCount > 0) blockers.push("authorization_gap");
  if (input.unknownServiceLabels.length > 0) blockers.push("unknown_service_labels");
  if (input.syntheticEvidenceCount > 0 && input.approvedPairCount === 0) blockers.push("synthetic_only_evidence");
  if (input.identity.completenessScore < 60) blockers.push("insufficient_exact_identity");
  return blockers;
}

export function calculateClusterReadiness(input: ReadinessInput): {
  version: typeof ecuIntelligenceReadinessVersion;
  state: EcuIntelligenceReadinessState;
  hardBlockers: string[];
  missingEvidence: string[];
} {
  const hardBlockers = hardBlockersForCluster(input);
  const missingEvidence: string[] = [];

  if (!input.fileCandidateCount && !input.approvedTrainingSampleCount) missingEvidence.push("observed_file_candidate");
  if (!input.pairCandidateCount) missingEvidence.push("ori_mod_pair_candidate");
  if (!input.reviewedPairCount) missingEvidence.push("human_review");
  if (!input.approvedPairCount) missingEvidence.push("approved_pair");
  if (!input.singleServicePairCount) missingEvidence.push("clean_single_service_pair");
  if (!input.patternClusterCount) missingEvidence.push("pattern_cluster");
  if (!input.mapDefinitionSetCount) missingEvidence.push("map_definition_set");

  if (hardBlockers.length) {
    return { version: ecuIntelligenceReadinessVersion, state: "BLOCKED", hardBlockers, missingEvidence };
  }
  if (!input.fileCandidateCount && !input.approvedTrainingSampleCount) {
    return { version: ecuIntelligenceReadinessVersion, state: "NO_EVIDENCE", hardBlockers, missingEvidence };
  }
  if (!input.pairCandidateCount && input.identity.completenessScore >= 60) {
    return { version: ecuIntelligenceReadinessVersion, state: "IDENTITY_ONLY", hardBlockers, missingEvidence };
  }
  if (input.pairCandidateCount && !input.reviewedPairCount) {
    return { version: ecuIntelligenceReadinessVersion, state: "HUMAN_REVIEW_REQUIRED", hardBlockers, missingEvidence };
  }
  if (input.pairCandidateCount && !input.approvedPairCount) {
    return { version: ecuIntelligenceReadinessVersion, state: "CONTROLLED_PAIR_REQUIRED", hardBlockers, missingEvidence };
  }
  if (input.approvedPairCount && !input.patternClusterCount) {
    return { version: ecuIntelligenceReadinessVersion, state: "APPROVED_EVIDENCE_AVAILABLE", hardBlockers, missingEvidence };
  }
  if (input.approvedPairCount && input.patternClusterCount && !input.mapDefinitionSetCount) {
    return { version: ecuIntelligenceReadinessVersion, state: "INTEGRITY_RESEARCH_REQUIRED", hardBlockers, missingEvidence };
  }
  if (input.approvedPairCount >= 2 && input.singleServicePairCount >= 1 && input.patternClusterCount && input.mapDefinitionSetCount) {
    return { version: ecuIntelligenceReadinessVersion, state: "RESEARCH_ELIGIBLE", hardBlockers, missingEvidence };
  }
  return { version: ecuIntelligenceReadinessVersion, state: "CANDIDATES_AVAILABLE", hardBlockers, missingEvidence };
}

export function calculateServiceReadiness(cell: Omit<EcuIntelligenceServiceCoverageCell, "readiness" | "missingEvidence">) {
  const missingEvidence: string[] = [];
  if (!cell.candidateCount) missingEvidence.push("candidate_pair");
  if (!cell.approvedCount) missingEvidence.push("approved_pair");
  if (!cell.singleServiceCount) missingEvidence.push("clean_single_service_pair");
  if (cell.category === "dtc" && !cell.exactDtcCodes.length) missingEvidence.push("exact_dtc_code_labels");

  let readiness: EcuIntelligenceReadinessState = "NO_EVIDENCE";
  if (cell.reviewRequiredCount) readiness = "HUMAN_REVIEW_REQUIRED";
  else if (cell.approvedCount && cell.singleServiceCount) readiness = "APPROVED_EVIDENCE_AVAILABLE";
  else if (cell.approvedCount) readiness = "CONTROLLED_PAIR_REQUIRED";
  else if (cell.candidateCount) readiness = "CANDIDATES_AVAILABLE";
  if (cell.category === "dtc" && cell.candidateCount && !cell.exactDtcCodes.length) readiness = "BLOCKED";

  return { readiness, missingEvidence };
}
