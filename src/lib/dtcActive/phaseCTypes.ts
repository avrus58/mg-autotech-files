import type { DtcActiveHardVetoCode } from "@/lib/dtcActive/types";

export type DtcPhaseCArtifactRole = "source" | "pre_integrity" | "final";

export type DtcPhaseCChangedRegionKind = "semantic" | "integrity";

export type DtcPhaseCAttemptStatus = "queued" | "claimed" | "processing" | "succeeded" | "failed";

export type DtcPhaseCArtifactRecord = {
  artifactId: string;
  attemptId: string;
  role: DtcPhaseCArtifactRole;
  sha256: string;
  byteSize: number;
  parentArtifactId: string | null;
  storageKind: "memory_synthetic_test";
  internalTestOnly: true;
  customerPublishable: false;
  createdAt: string;
};

export type DtcPhaseCChangedRegion = {
  regionRef: string;
  kind: DtcPhaseCChangedRegionKind;
  start: number;
  length: number;
  beforeSha256: string;
  afterSha256: string;
};

export type DtcPhaseCOperationRecord = {
  operationId: string;
  operationType: "write_bitfield" | "write_enum";
  offset: number;
  widthBytes: number;
  allowedRegionRef: string;
  expectedOldHex: string;
  newValueHex: string;
  semanticReason: string;
};

export type DtcPhaseCValidationRecord = {
  validationId: string;
  stage: "source" | "dry_run" | "semantic_patch" | "integrity_adapter" | "post_validation" | "audit";
  status: "pass" | "fail";
  message: string;
  hardVetoes: DtcActiveHardVetoCode[];
};

export type DtcPhaseCEventRecord = {
  eventId: string;
  attemptId: string;
  eventType:
    | "attempt_created"
    | "lease_claimed"
    | "source_artifact_created"
    | "pre_integrity_artifact_created"
    | "integrity_adapter_executed"
    | "final_artifact_created"
    | "attempt_succeeded"
    | "attempt_failed";
  at: string;
  actorId: string | null;
  details: Record<string, unknown>;
};

export type DtcPhaseCProcessingAttempt = {
  attemptId: string;
  idempotencyKey: string;
  requestHash: string;
  status: DtcPhaseCAttemptStatus;
  requestedCodes: string[];
  hardVetoes: DtcActiveHardVetoCode[];
  leaseToken: string | null;
  leaseOwner: string | null;
  leaseExpiresAt: string | null;
  fencingToken: number;
  internalTestOnly: true;
  customerPublishable: false;
  createdAt: string;
  updatedAt: string;
};

export type DtcPhaseCProcessingReport = {
  reportVersion: "dtc-phase-c-synthetic-output-v1";
  attemptId: string;
  idempotencyKey: string;
  status: "succeeded" | "failed";
  success: boolean;
  requestedCodes: string[];
  sourceSha256: string;
  preIntegritySha256: string | null;
  finalSha256: string | null;
  semanticChangedRegions: DtcPhaseCChangedRegion[];
  integrityChangedRegions: DtcPhaseCChangedRegion[];
  operations: DtcPhaseCOperationRecord[];
  artifacts: DtcPhaseCArtifactRecord[];
  validations: DtcPhaseCValidationRecord[];
  events: DtcPhaseCEventRecord[];
  hardVetoes: DtcActiveHardVetoCode[];
  syntheticFixtureOnly: true;
  integrityAdapter: {
    stableAdapterKey: "mg.synthetic.crc32.integrity";
    version: "1.0.0";
    executionType: "in_process_synthetic_crc32";
    nativeExecutionUsed: false;
    realEcuChecksum: false;
  };
  internalTestOnly: true;
  customerPublishable: false;
  customerDeliveryEnabled: false;
  outputArtifactsCustomerVisible: false;
  notes: string[];
};

export type DtcPhaseCGenerateInput = {
  requestedCodes: string[];
  idempotencyKey: string;
  actorId?: string | null;
  authorizationStatement: string;
  sourceCaseType?: string;
  requestId?: string;
};

export type DtcPhaseCGoldenCorpusRunResult = {
  totalCases: number;
  passedCases: number;
  failedCases: number;
  positiveCases: number;
  negativeCases: number;
  cases: Array<{
    caseKey: string;
    expectedSuccess: boolean;
    actualSuccess: boolean;
    passed: boolean;
    sourceSha256: string;
    preIntegritySha256: string | null;
    finalSha256: string | null;
    semanticChangedRegions: Array<Pick<DtcPhaseCChangedRegion, "start" | "length">>;
    integrityChangedRegions: Array<Pick<DtcPhaseCChangedRegion, "start" | "length">>;
    hardVetoes: DtcActiveHardVetoCode[];
  }>;
  artifactsCreated: number;
  customerPublishableArtifacts: 0;
  realEcuFilesProcessed: false;
  customerFilesProcessed: false;
};
