import {
  ecuIntelligenceKnowledgeScoreVersion,
  type EcuIntelligenceKnowledgeScore,
} from "@/lib/ecuIntelligence/center/types";

export type KnowledgeScoreInput = {
  identityCompleteness: number;
  totalEvidenceCount: number;
  uniqueSourceCount: number;
  approvedPairCount: number;
  singleServicePairCount: number;
  patternClusterCount: number;
  mapDefinitionSetCount: number;
  humanVerifiedCount: number;
  reviewedPairCount: number;
  unresolvedAuthorizationCount: number;
  conflictCount: number;
  quarantineCount: number;
  syntheticEvidenceCount: number;
  hardBlockers: string[];
};

function clamp(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function coverage(count: number, target: number) {
  return clamp((Math.max(0, count) / Math.max(1, target)) * 100);
}

export function calculateKnowledgeScore(input: KnowledgeScoreInput): EcuIntelligenceKnowledgeScore {
  const components = {
    identityCompleteness: clamp(input.identityCompleteness),
    authorizationCoverage: input.unresolvedAuthorizationCount ? 25 : 100,
    provenanceQuality: coverage(input.uniqueSourceCount, 3),
    corpusVolume: coverage(input.totalEvidenceCount, 6),
    approvedPairCoverage: coverage(input.approvedPairCount, 2),
    singleServiceCoverage: coverage(input.singleServicePairCount, 2),
    patternConsistency: coverage(input.patternClusterCount, 1),
    mapDefinitionCoverage: coverage(input.mapDefinitionSetCount, 1),
    humanVerificationDepth: coverage(input.humanVerifiedCount + input.reviewedPairCount, 3),
    validationDepth: coverage(input.approvedPairCount + input.patternClusterCount + input.mapDefinitionSetCount, 4),
    conflictPenalty: -Math.min(35, input.conflictCount * 12),
    quarantinePenalty: -Math.min(30, input.quarantineCount * 10),
    syntheticDataPenalty: -Math.min(25, input.syntheticEvidenceCount * 8),
  };

  const positive =
    components.identityCompleteness * 0.16 +
    components.authorizationCoverage * 0.12 +
    components.provenanceQuality * 0.08 +
    components.corpusVolume * 0.1 +
    components.approvedPairCoverage * 0.14 +
    components.singleServiceCoverage * 0.1 +
    components.patternConsistency * 0.1 +
    components.mapDefinitionCoverage * 0.08 +
    components.humanVerificationDepth * 0.07 +
    components.validationDepth * 0.05;

  const raw = positive + components.conflictPenalty + components.quarantinePenalty + components.syntheticDataPenalty;
  const blockerPenalty = input.hardBlockers.length ? Math.min(35, input.hardBlockers.length * 8) : 0;

  return {
    version: ecuIntelligenceKnowledgeScoreVersion,
    score: clamp(raw - blockerPenalty),
    components,
    hardBlockers: input.hardBlockers,
  };
}
