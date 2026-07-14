import type { DtcActiveHardVetoCode } from "@/lib/dtcActive/types";

export type DtcPhaseBApprovalState =
  | "draft"
  | "candidate"
  | "internal_test_approved"
  | "human_verified"
  | "automation_approved"
  | "mature_approved"
  | "revoked";

export type DtcPhaseBIdentity = {
  supplier: string;
  family: string;
  ecuType: string;
  hardwareNumber: string;
  softwareNumber: string;
  calibrationId: string;
  processorArchitecture: string;
};

export type DtcPhaseBRepresentation = {
  containerType: "raw_synthetic";
  payloadRole: "synthetic_fixture";
  readRepresentation: "synthetic";
  fileSizeBytes: number;
  segmentManifestDigestSha256: string;
};

export type DtcPhaseBTarget = {
  kind: "absolute_file_offset";
  regionRef: string;
  absoluteOffset: number;
  alignment: number;
};

export type DtcPhaseBSourceExpectation = {
  expectationType: "exact_bytes";
  target: DtcPhaseBTarget;
  lengthBytes: number;
  expectedHex: string;
};

export type DtcPhaseBLeafOperation = {
  type: "write_bitfield" | "write_enum";
  operationId: string;
  target: DtcPhaseBTarget;
  expectedOldHex: string;
  newValueHex: string;
  widthBytes: number;
  allowedRegionRef: string;
  sourceContext: DtcPhaseBSourceExpectation[];
  semanticReason: string;
};

export type DtcPhaseBCoordinatedOperation = {
  type: "coordinated_multi_structure_operation";
  operationId: string;
  atomic: true;
  semanticReason: string;
  operations: DtcPhaseBLeafOperation[];
};

export type DtcPhaseBOperation = DtcPhaseBLeafOperation | DtcPhaseBCoordinatedOperation;

export type DtcPhaseBRegion = {
  regionRef: string;
  start: number;
  length: number;
};

export type DtcRuleDocument = {
  schemaVersion: "2.0.0";
  canonicalization: "RFC8785-JCS";
  digestAlgorithm: "SHA-256";
  ruleBody: {
    stableRuleKey: string;
    version: string;
    description: string;
    representation: DtcPhaseBRepresentation;
    ecuIdentity: DtcPhaseBIdentity;
    sourcePredicates: {
      acceptedSourceSha256: string[];
      identityDigestSha256: string;
      allowedSourceLineage: ["synthetic_fixture"];
    };
    dtc: {
      namespace: "SYNTHETIC";
      externalCode: string;
      riskCategory: "synthetic_test_only";
      internalEventId: number;
    };
    primaryStructureRef: string;
    linkedStructureRefs: string[];
    strategyType: "synthetic_test";
    sourceExpectations: DtcPhaseBSourceExpectation[];
    operations: DtcPhaseBOperation[];
    outputAllowlist: {
      semanticRegions: DtcPhaseBRegion[];
      integrityRegions: DtcPhaseBRegion[];
      maximumChangedBytes: number;
      allowNoOp: boolean;
    };
    integrityAdapterRef: {
      stableAdapterKey: string;
      version: string;
      contentDigest: string;
    };
    approvalState: DtcPhaseBApprovalState;
    revocation: {
      revoked: boolean;
      reason?: string;
    };
  };
  contentDigest: string;
};

export type DtcIntegrityAdapterDocument = {
  schemaVersion: "2.0.0";
  canonicalization: "RFC8785-JCS";
  digestAlgorithm: "SHA-256";
  adapterBody: {
    stableAdapterKey: string;
    version: string;
    description: string;
    adapterType: "synthetic_test";
    supportedScopes: Array<DtcPhaseBIdentity & {
      fileSizeBytes: number;
      segmentManifestDigestSha256: string;
    }>;
    execution: {
      entrypointType: "metadata_registry_only";
      executableOrImageDigestSha256: string;
    };
    approvalState: DtcPhaseBApprovalState;
    revocation: {
      revoked: boolean;
      reason?: string;
    };
  };
  contentDigest: string;
};

export type DtcGoldenCorpusManifest = {
  schemaVersion: "2.0.0";
  stableCorpusKey: string;
  version: string;
  description: string;
  ruleRefs: Array<{ stableRuleKey: string; version: string; contentDigest: string }>;
  adapterRefs: Array<{ stableAdapterKey: string; version: string; contentDigest: string }>;
  cases: DtcGoldenCorpusCase[];
  releaseThresholds: {
    positivePassRate: number;
    negativeRejectionRate: number;
    unexpectedChangedBytesMaximum: number;
    nondeterministicMismatchesMaximum: number;
    unresolvedConflictsMaximum: number;
  };
  manifestDigestSha256: string;
};

export type DtcGoldenCorpusCase = {
  caseKey: string;
  caseType:
    | "positive_single"
    | "positive_multi"
    | "noop_roundtrip"
    | "wrong_sw"
    | "wrong_role"
    | "source_mismatch"
    | "missing_linked"
    | "already_modified"
    | "corrupt";
  sourceArtifact: {
    relativePath: string;
    sha256: string;
    byteSize: number;
  };
  requestedCodes: string[];
  expectedResult: {
    success: boolean;
    preIntegritySha256?: string;
    finalSha256?: string;
    expectedChangedRegions?: Array<{
      regionRef: string;
      start: number;
      length: number;
    }>;
    expectedOperationIds?: string[];
    expectedErrorCode?: DtcActiveHardVetoCode;
    validationOutcome: "pass" | "reject";
  };
};

export type DtcPhaseBDryRunInput = {
  requestId: string;
  sourceArtifact: {
    sha256: string;
    byteSize: number;
    role: "source" | "unknown";
    lineage: "synthetic_fixture" | "unauthorized";
    identity: DtcPhaseBIdentity;
    segmentManifestDigestSha256: string;
    sourceExpectationState?: "match" | "mismatch";
    linkedStructureState?: "present" | "missing";
    previouslyModified?: boolean;
    integrityState?: "valid" | "corrupt";
  };
  requestedCodes: string[];
};

export type DtcDryRunOperationPlan = {
  operationId: string;
  type: DtcPhaseBLeafOperation["type"];
  offset: number;
  widthBytes: number;
  allowedRegionRef: string;
  semanticReason: string;
};

export type DtcDryRunReport = {
  reportVersion: "dtc-phase-b-dry-run-v1";
  requestId: string;
  mode: "synthetic_dry_run_only";
  success: boolean;
  requestedCodes: string[];
  matchedRuleDigests: string[];
  matchedAdapterDigests: string[];
  matchedOperationIds: string[];
  operationPlan: DtcDryRunOperationPlan[];
  hardVetoes: DtcActiveHardVetoCode[];
  dryRunOnly: true;
  firmwareBytesMutated: false;
  outputArtifactCreated: false;
  outputArtifacts: [];
  integrityAdaptersExecuted: false;
  nativeExecutionUsed: false;
  notes: string[];
};
