import type { TrainingFeature, TrainingServiceLabels } from "@/lib/ecuIntelligence/types";

export const dtcCorpusReadinessTargets = [
  {
    targetKey: "bosch-me7-5",
    label: "Bosch ME7.5",
    aliases: ["ME7.5", "ME75", "BOSCH ME7.5", "BOSCH ME75"],
  },
  {
    targetKey: "bosch-edc15p-edc15vm",
    label: "Bosch EDC15P / EDC15VM+",
    aliases: ["EDC15P", "EDC15VM", "EDC15VM+", "BOSCH EDC15P", "BOSCH EDC15VM+"],
  },
  {
    targetKey: "bosch-edc16u34",
    label: "Bosch EDC16U34",
    aliases: ["EDC16U34", "BOSCH EDC16U34"],
  },
] as const;

export type DtcCorpusReadinessState =
  | "INSUFFICIENT_DATA"
  | "CORPUS_CLEANUP_REQUIRED"
  | "CONTROLLED_PAIR_REQUIRED"
  | "INTEGRITY_RESEARCH_REQUIRED"
  | "BENCH_VALIDATION_REQUIRED"
  | "READY_FOR_INTERNAL_RULE_RESEARCH";

export type DtcCorpusFileRole = "ori" | "mod" | "pair" | "single" | "unknown";

export type DtcCorpusEvidenceItem = {
  id: string;
  sourceKind:
    | "training_sample"
    | "dataset_pair"
    | "file_expert_job"
    | "pattern_cluster"
    | "knowledge_profile";
  ecuSupplier?: string | null;
  ecuFamily?: string | null;
  ecuType?: string | null;
  hwNumber?: string | null;
  swNumber?: string | null;
  calibrationId?: string | null;
  representationType?: string | null;
  fileRole?: DtcCorpusFileRole | null;
  fileSize?: number | null;
  segmentManifestDigest?: string | null;
  readMethod?: string | null;
  sourceProvenance?: string | null;
  sourceAuthorizationQuality?: "unknown" | "weak" | "trusted" | "authorized_lab" | null;
  originalHash?: string | null;
  modHash?: string | null;
  exactDtcLabels?: string[] | null;
  serviceLabels?: string[] | TrainingServiceLabels | null;
  humanVerified?: boolean | null;
  learningApproved?: boolean | null;
  pairConfidence?: number | null;
  pairReviewStatus?: string | null;
  pairIdentityConsistent?: boolean | null;
  changedRegionSignature?: string | null;
  changedRegionConsistency?: "unknown" | "consistent" | "inconsistent" | null;
  unrelatedChange?: boolean | null;
  checksumOnlyControl?: boolean | null;
  alreadyModifiedNegative?: boolean | null;
  wrongPairNegative?: boolean | null;
  preIntegrityAvailable?: boolean | null;
  finalModAvailable?: boolean | null;
  mapDefinitionAvailable?: boolean | null;
  integrityEvidenceAvailable?: boolean | null;
  benchVerified?: boolean | null;
  successfulWriteReadback?: boolean | null;
  rollbackVerified?: boolean | null;
  conflictNotes?: string[] | null;
};

export type DtcExactCompoundIdentity = {
  ecuSupplier: string;
  ecuFamily: string;
  ecuType: string;
  hwNumber: string;
  swNumber: string;
  calibrationId: string;
  representationType: string;
  fileRole: DtcCorpusFileRole;
  fileSize: number | null;
  segmentManifestDigest: string;
  readMethod: string;
  sourceProvenance: string;
};

export type DtcCorpusClusterReadiness = {
  clusterKey: string;
  targetKey: string;
  targetLabel: string;
  identity: DtcExactCompoundIdentity;
  readinessState: DtcCorpusReadinessState;
  readinessScore: number;
  verifiedOriginalCount: number;
  distinctSourceHashes: number;
  exactDuplicateCount: number;
  matchedOriModPairCount: number;
  controlledOneDtcPairCount: number;
  multiDtcPairCount: number;
  preIntegrityModAvailability: number;
  finalModAvailability: number;
  exactDtcLabels: string[];
  changedRegionConsistency: "none" | "consistent" | "inconsistent";
  checksumOnlyControlCount: number;
  alreadyModifiedNegativeCount: number;
  wrongPairNegativeCount: number;
  mapDefinitionAvailability: number;
  integrityEvidenceCount: number;
  benchVerificationCount: number;
  successfulWriteReadbackCount: number;
  rollbackVerificationCount: number;
  conflicts: string[];
  missingEvidence: string[];
  requiredControlledExperiments: string[];
  evidenceItemIds: string[];
};

export type DtcCorpusReadinessReport = {
  generatedAt: string;
  targetFamilies: string[];
  clusters: DtcCorpusClusterReadiness[];
  firstRecommendedLabCluster: DtcCorpusClusterReadiness | null;
  anyReadyForInternalRuleResearch: boolean;
  safety: {
    readOnly: true;
    firmwareBytesMutated: false;
    outputArtifactsCreated: false;
    customerDeliveryEnabled: false;
    phaseDCustomerProcessingStarted: false;
  };
};

const stateRank: Record<DtcCorpusReadinessState, number> = {
  INSUFFICIENT_DATA: 0,
  CORPUS_CLEANUP_REQUIRED: 1,
  CONTROLLED_PAIR_REQUIRED: 2,
  INTEGRITY_RESEARCH_REQUIRED: 3,
  BENCH_VALIDATION_REQUIRED: 4,
  READY_FOR_INTERNAL_RULE_RESEARCH: 5,
};

export function buildDtcCorpusReadinessReport(
  evidence: DtcCorpusEvidenceItem[],
  now = new Date()
): DtcCorpusReadinessReport {
  const groups = new Map<string, { identity: DtcExactCompoundIdentity; targetKey: string; targetLabel: string; items: DtcCorpusEvidenceItem[] }>();
  for (const item of evidence) {
    const target = resolveTarget(item);
    if (!target) continue;
    const identity = exactIdentity(item);
    const key = exactClusterKey(target.targetKey, identity);
    const existing = groups.get(key);
    if (existing) existing.items.push(item);
    else groups.set(key, { identity, targetKey: target.targetKey, targetLabel: target.label, items: [item] });
  }

  const clusters = [...groups.entries()]
    .map(([clusterKey, group]) => evaluateCluster(clusterKey, group.targetKey, group.targetLabel, group.identity, group.items))
    .sort((left, right) =>
      stateRank[right.readinessState] - stateRank[left.readinessState] ||
      right.readinessScore - left.readinessScore ||
      right.controlledOneDtcPairCount - left.controlledOneDtcPairCount ||
      left.clusterKey.localeCompare(right.clusterKey)
    );

  return {
    generatedAt: now.toISOString(),
    targetFamilies: dtcCorpusReadinessTargets.map((target) => target.label),
    clusters,
    firstRecommendedLabCluster: clusters[0] ?? null,
    anyReadyForInternalRuleResearch: clusters.some((cluster) => cluster.readinessState === "READY_FOR_INTERNAL_RULE_RESEARCH"),
    safety: {
      readOnly: true,
      firmwareBytesMutated: false,
      outputArtifactsCreated: false,
      customerDeliveryEnabled: false,
      phaseDCustomerProcessingStarted: false,
    },
  };
}

function evaluateCluster(
  clusterKey: string,
  targetKey: string,
  targetLabel: string,
  identity: DtcExactCompoundIdentity,
  items: DtcCorpusEvidenceItem[]
): DtcCorpusClusterReadiness {
  const conflicts = new Set<string>();
  const missing = new Set<string>();
  const experiments = new Set<string>();
  const sourceHashes = items.map((item) => normalizeHash(item.originalHash)).filter(Boolean);
  const distinctSourceHashes = new Set(sourceHashes).size;
  const exactDuplicateCount = Math.max(0, sourceHashes.length - distinctSourceHashes);
  const exactDtcLabels = sortedUnique(items.flatMap((item) => (item.exactDtcLabels ?? []).map((label) => label.trim().toUpperCase()).filter(Boolean)));
  const regionSignatures = sortedUnique(items.map((item) => item.changedRegionSignature || "").filter(Boolean));
  const controlledPairs = items.filter(isControlledOneDtcPair);
  const matchedPairs = items.filter(isMatchedPair);
  const multiDtcPairs = items.filter((item) => isMatchedPair(item) && (item.exactDtcLabels?.length ?? 0) > 1);

  if (!identity.swNumber || identity.swNumber === "unknown") missing.add("exact SW number");
  if (!identity.hwNumber || identity.hwNumber === "unknown") missing.add("exact HW number");
  if (!identity.calibrationId || identity.calibrationId === "unknown") missing.add("calibration ID");
  if (!identity.segmentManifestDigest || identity.segmentManifestDigest === "unknown") missing.add("segment manifest");
  if (!identity.readMethod || identity.readMethod === "unknown") missing.add("read method");
  if (!identity.sourceProvenance || identity.sourceProvenance === "unknown") missing.add("source provenance");

  if (items.some((item) => item.fileRole === "mod" || item.fileRole === "unknown")) {
    conflicts.add("Mixed or unknown file role evidence is not valid for first real lab target qualification.");
  }
  if (items.some((item) => item.pairIdentityConsistent === false)) {
    conflicts.add("ORI/MOD identity mismatch detected inside candidate evidence.");
  }
  if (items.some((item) => item.unrelatedChange || item.changedRegionConsistency === "inconsistent")) {
    conflicts.add("Unrelated or inconsistent changed-region evidence detected.");
  }
  if (items.some((item) => item.alreadyModifiedNegative)) {
    conflicts.add("Already-modified negative evidence is present.");
  }
  if (items.some((item) => item.wrongPairNegative)) {
    conflicts.add("Wrong-pair negative evidence is present.");
  }
  for (const note of items.flatMap((item) => item.conflictNotes ?? [])) conflicts.add(note);
  if (regionSignatures.length > 1 && controlledPairs.length > 1) {
    conflicts.add("Controlled one-DTC pairs do not share one changed-region signature.");
  }
  if (exactDuplicateCount > 0 && distinctSourceHashes <= 1 && items.length > 1) {
    conflicts.add("Corpus is dominated by exact duplicate source hashes.");
  }

  const verifiedOriginalCount = items.filter((item) => item.humanVerified && normalizeHash(item.originalHash)).length;
  const preIntegrityModAvailability = items.filter((item) => item.preIntegrityAvailable).length;
  const finalModAvailability = items.filter((item) => item.finalModAvailable).length;
  const checksumOnlyControlCount = items.filter((item) => item.checksumOnlyControl).length;
  const mapDefinitionAvailability = items.filter((item) => item.mapDefinitionAvailable).length;
  const integrityEvidenceCount = items.filter((item) => item.integrityEvidenceAvailable).length;
  const benchVerificationCount = items.filter((item) => item.benchVerified).length;
  const successfulWriteReadbackCount = items.filter((item) => item.successfulWriteReadback).length;
  const rollbackVerificationCount = items.filter((item) => item.rollbackVerified).length;
  const provenanceQuality = items.filter((item) =>
    item.sourceAuthorizationQuality === "trusted" || item.sourceAuthorizationQuality === "authorized_lab"
  ).length;

  if (verifiedOriginalCount < 2) {
    missing.add("at least two verified originals");
    experiments.add("Capture at least two independently verified ORI reads for the exact HW/SW/calibration identity.");
  }
  if (distinctSourceHashes < 2) {
    missing.add("distinct source hashes");
    experiments.add("Add a second independent source hash to avoid duplicate-only evidence.");
  }
  if (matchedPairs.length < 2) {
    missing.add("matched ORI/MOD pairs");
    experiments.add("Build controlled ORI/MOD pairs under lab supervision for the exact identity.");
  }
  if (controlledPairs.length < 2) {
    missing.add("controlled one-DTC pairs");
    experiments.add("Create one-DTC-at-a-time lab pairs for target codes and document changed regions.");
  }
  if (checksumOnlyControlCount < 1) {
    missing.add("checksum-only control");
    experiments.add("Create a checksum-only control pair so semantic changes are not confused with integrity changes.");
  }
  if (preIntegrityModAvailability < 1 || finalModAvailability < 1 || integrityEvidenceCount < 1) {
    missing.add("integrity evidence");
    experiments.add("Research integrity behavior and preserve pre-integrity vs final artifact hashes as metadata.");
  }
  if (mapDefinitionAvailability < 1) {
    missing.add("map/A2L/DAMOS/XDF evidence");
    experiments.add("Attach verified map/A2L/DAMOS/XDF or manual map definition evidence for the exact identity.");
  }
  if (benchVerificationCount < 1) {
    missing.add("bench validation");
    experiments.add("Bench-validate the exact identity before internal rule research.");
  }
  if (successfulWriteReadbackCount < 1) {
    missing.add("successful write/read-back");
    experiments.add("Perform one safe lab write/read-back confirmation after integrity research.");
  }
  if (rollbackVerificationCount < 1) {
    missing.add("rollback verification");
    experiments.add("Confirm rollback path on bench before any real internal rule research.");
  }
  if (provenanceQuality < items.length || provenanceQuality === 0) {
    missing.add("trusted provenance and authorization");
    experiments.add("Document source authorization and provenance for every evidence row.");
  }

  const readinessState = chooseReadinessState({
    itemCount: items.length,
    conflicts: conflicts.size,
    matchedPairs: matchedPairs.length,
    controlledPairs: controlledPairs.length,
    verifiedOriginalCount,
    distinctSourceHashes,
    preIntegrityModAvailability,
    finalModAvailability,
    checksumOnlyControlCount,
    mapDefinitionAvailability,
    integrityEvidenceCount,
    benchVerificationCount,
    successfulWriteReadbackCount,
    rollbackVerificationCount,
    provenanceQuality,
    itemCountForProvenance: items.length,
  });

  const readinessScore = Math.min(100, Math.max(0,
    verifiedOriginalCount * 8 +
    distinctSourceHashes * 7 +
    matchedPairs.length * 10 +
    controlledPairs.length * 14 +
    checksumOnlyControlCount * 8 +
    mapDefinitionAvailability * 8 +
    integrityEvidenceCount * 8 +
    benchVerificationCount * 10 +
    successfulWriteReadbackCount * 10 +
    rollbackVerificationCount * 10 +
    provenanceQuality * 4 -
    conflicts.size * 25
  ));

  return {
    clusterKey,
    targetKey,
    targetLabel,
    identity,
    readinessState,
    readinessScore,
    verifiedOriginalCount,
    distinctSourceHashes,
    exactDuplicateCount,
    matchedOriModPairCount: matchedPairs.length,
    controlledOneDtcPairCount: controlledPairs.length,
    multiDtcPairCount: multiDtcPairs.length,
    preIntegrityModAvailability,
    finalModAvailability,
    exactDtcLabels,
    changedRegionConsistency: regionSignatures.length === 0 ? "none" : regionSignatures.length === 1 ? "consistent" : "inconsistent",
    checksumOnlyControlCount,
    alreadyModifiedNegativeCount: items.filter((item) => item.alreadyModifiedNegative).length,
    wrongPairNegativeCount: items.filter((item) => item.wrongPairNegative).length,
    mapDefinitionAvailability,
    integrityEvidenceCount,
    benchVerificationCount,
    successfulWriteReadbackCount,
    rollbackVerificationCount,
    conflicts: [...conflicts],
    missingEvidence: [...missing],
    requiredControlledExperiments: [...experiments],
    evidenceItemIds: items.map((item) => item.id),
  };
}

function chooseReadinessState(input: {
  itemCount: number;
  conflicts: number;
  matchedPairs: number;
  controlledPairs: number;
  verifiedOriginalCount: number;
  distinctSourceHashes: number;
  preIntegrityModAvailability: number;
  finalModAvailability: number;
  checksumOnlyControlCount: number;
  mapDefinitionAvailability: number;
  integrityEvidenceCount: number;
  benchVerificationCount: number;
  successfulWriteReadbackCount: number;
  rollbackVerificationCount: number;
  provenanceQuality: number;
  itemCountForProvenance: number;
}): DtcCorpusReadinessState {
  if (input.itemCount === 0 || (input.verifiedOriginalCount === 0 && input.matchedPairs === 0)) return "INSUFFICIENT_DATA";
  if (input.conflicts > 0 || input.provenanceQuality < input.itemCountForProvenance) return "CORPUS_CLEANUP_REQUIRED";
  if (
    input.verifiedOriginalCount < 2 ||
    input.distinctSourceHashes < 2 ||
    input.matchedPairs < 2 ||
    input.controlledPairs < 2
  ) return "CONTROLLED_PAIR_REQUIRED";
  if (
    input.preIntegrityModAvailability < 1 ||
    input.finalModAvailability < 1 ||
    input.checksumOnlyControlCount < 1 ||
    input.mapDefinitionAvailability < 1 ||
    input.integrityEvidenceCount < 1
  ) return "INTEGRITY_RESEARCH_REQUIRED";
  if (
    input.benchVerificationCount < 1 ||
    input.successfulWriteReadbackCount < 1 ||
    input.rollbackVerificationCount < 1
  ) return "BENCH_VALIDATION_REQUIRED";
  return "READY_FOR_INTERNAL_RULE_RESEARCH";
}

function isMatchedPair(item: DtcCorpusEvidenceItem) {
  return Boolean(
    item.originalHash &&
    item.modHash &&
    item.pairIdentityConsistent !== false &&
    (item.pairConfidence ?? 0) >= 70 &&
    ["approved", "ready_for_human_label", "confirmed", "approved_for_learning"].includes(item.pairReviewStatus ?? "approved")
  );
}

function isControlledOneDtcPair(item: DtcCorpusEvidenceItem) {
  const labels = serviceLabels(item);
  return Boolean(
    isMatchedPair(item) &&
    labels.includes("dtc_off") &&
    (item.exactDtcLabels?.length ?? 0) === 1 &&
    item.unrelatedChange !== true &&
    item.changedRegionConsistency !== "inconsistent"
  );
}

function exactIdentity(item: DtcCorpusEvidenceItem): DtcExactCompoundIdentity {
  const supplier = canonicalSupplier(item);
  return {
    ecuSupplier: supplier,
    ecuFamily: clean(item.ecuFamily) || targetFamilyLabel(item) || "unknown",
    ecuType: clean(item.ecuType) || "unknown",
    hwNumber: clean(item.hwNumber) || "unknown",
    swNumber: clean(item.swNumber) || "unknown",
    calibrationId: clean(item.calibrationId) || "unknown",
    representationType: clean(item.representationType) || "unknown",
    fileRole: item.fileRole || "unknown",
    fileSize: Number.isFinite(Number(item.fileSize)) ? Number(item.fileSize) : null,
    segmentManifestDigest: clean(item.segmentManifestDigest) || "unknown",
    readMethod: clean(item.readMethod) || "unknown",
    sourceProvenance: clean(item.sourceProvenance) || "unknown",
  };
}

function exactClusterKey(targetKey: string, identity: DtcExactCompoundIdentity) {
  return [
    targetKey,
    identity.ecuSupplier,
    identity.ecuFamily,
    identity.ecuType,
    identity.hwNumber,
    identity.swNumber,
    identity.calibrationId,
    identity.representationType,
    identity.fileRole,
    identity.fileSize ?? "unknown_size",
    identity.segmentManifestDigest,
    identity.readMethod,
    identity.sourceProvenance,
  ].map(normalizedKeyPart).join("|");
}

function resolveTarget(item: DtcCorpusEvidenceItem) {
  const haystack = normalizedKeyPart([
    item.ecuSupplier,
    item.ecuFamily,
    item.ecuType,
  ].filter(Boolean).join(" "));
  const supplier = normalizedKeyPart(item.ecuSupplier || item.ecuType || item.ecuFamily);
  if (!supplier.includes("BOSCH") && !haystack.includes("BOSCH")) return null;
  return dtcCorpusReadinessTargets.find((target) =>
    target.aliases.some((alias) => haystack.includes(normalizedKeyPart(alias)))
  ) ?? null;
}

function targetFamilyLabel(item: DtcCorpusEvidenceItem) {
  return resolveTarget(item)?.label || null;
}

function canonicalSupplier(item: DtcCorpusEvidenceItem) {
  const text = normalizedKeyPart([item.ecuSupplier, item.ecuType, item.ecuFamily].filter(Boolean).join(" "));
  return text.includes("BOSCH") ? "Bosch" : clean(item.ecuSupplier) || "unknown";
}

function serviceLabels(item: DtcCorpusEvidenceItem) {
  const labels = item.serviceLabels;
  if (!labels) return [];
  if (Array.isArray(labels)) return labels;
  return Object.entries(labels).filter(([, active]) => active).map(([key]) => key as TrainingFeature);
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeHash(value: unknown) {
  return typeof value === "string" && /^[0-9a-f]{64}$/i.test(value.trim()) ? value.trim().toLowerCase() : "";
}

function normalizedKeyPart(value: unknown) {
  return clean(value).toUpperCase().replace(/[^A-Z0-9+]+/g, "") || "UNKNOWN";
}

function sortedUnique(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}
