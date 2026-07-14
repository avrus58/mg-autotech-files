import { randomUUID } from "node:crypto";
import { compileSyntheticDtcDryRun } from "@/lib/dtcActive/dryRunCompiler";
import {
  syntheticGoldenCorpus,
  syntheticPhaseBConstants,
  syntheticPhaseBIdentity,
  syntheticRuleP0100,
  syntheticRuleP0300,
} from "@/lib/dtcActive/fixtures";
import {
  defaultDtcPhaseCStore,
  DtcPhaseCInMemoryStore,
  phaseCRequestHash,
} from "@/lib/dtcActive/phaseCStore";
import type {
  DtcPhaseCChangedRegion,
  DtcPhaseCGenerateInput,
  DtcPhaseCOperationRecord,
  DtcPhaseCProcessingReport,
  DtcPhaseCValidationRecord,
} from "@/lib/dtcActive/phaseCTypes";
import type { DtcPhaseBDryRunInput, DtcPhaseBLeafOperation, DtcPhaseBOperation } from "@/lib/dtcActive/phaseBTypes";
import { resolveDtcActiveFeatureFlags } from "@/lib/dtcActive/policy";
import { buildSyntheticPhaseBRegistry } from "@/lib/dtcActive/registry";
import type { DtcActiveFeatureFlags, DtcActiveHardVetoCode } from "@/lib/dtcActive/types";
import {
  applySyntheticCrc32,
  getApprovedSyntheticSourceBytes,
  sha256Hex,
  syntheticCrcValid,
  syntheticFixtureLayout,
} from "@/lib/dtcActive/syntheticFixtureSource";

export const phaseCAuthorizationStatement =
  "I understand this is synthetic internal test output only.";

type EngineOptions = {
  flags?: DtcActiveFeatureFlags;
  store?: DtcPhaseCInMemoryStore;
  leaseOwner?: string;
};

export function generateSyntheticDtcTestOutput(
  input: DtcPhaseCGenerateInput,
  options: EngineOptions = {}
): DtcPhaseCProcessingReport {
  const flags = options.flags ?? resolveDtcActiveFeatureFlags();
  const requestedCodes = uniqueCodes(input.requestedCodes);
  const store = options.store ?? defaultDtcPhaseCStore;
  const requestHash = phaseCRequestHash({
    requestedCodes,
    authorizationStatement: input.authorizationStatement,
    sourceCaseType: input.sourceCaseType ?? "approved_source",
  });
  const { attempt, reused } = store.createOrGetAttempt({
    idempotencyKey: input.idempotencyKey,
    requestHash,
    requestedCodes,
  });

  if (reused && attempt.status === "succeeded") {
    const artifacts = store.listArtifacts(attempt.attemptId);
    return {
      reportVersion: "dtc-phase-c-synthetic-output-v1",
      attemptId: attempt.attemptId,
      idempotencyKey: attempt.idempotencyKey,
      status: "succeeded",
      success: true,
      requestedCodes,
      sourceSha256: artifacts.find((artifact) => artifact.role === "source")?.sha256 ?? syntheticPhaseBConstants.sourceSha256,
      preIntegritySha256: artifacts.find((artifact) => artifact.role === "pre_integrity")?.sha256 ?? null,
      finalSha256: artifacts.find((artifact) => artifact.role === "final")?.sha256 ?? null,
      semanticChangedRegions: [],
      integrityChangedRegions: [],
      operations: [],
      artifacts,
      validations: [],
      events: store.listEvents(attempt.attemptId),
      hardVetoes: [],
      syntheticFixtureOnly: true,
      integrityAdapter: syntheticAdapterSummary(),
      internalTestOnly: true,
      customerPublishable: false,
      customerDeliveryEnabled: false,
      outputArtifactsCustomerVisible: false,
      notes: ["Idempotent Phase C replay returned existing internal synthetic artifact metadata."],
    };
  }

  store.appendEvent({
    attemptId: attempt.attemptId,
    eventType: "attempt_created",
    actorId: input.actorId ?? null,
    details: { requestedCodes, internalTestOnly: true },
  });

  const lease = store.claimAttempt(attempt.attemptId, options.leaseOwner ?? "phase-c-synthetic-worker");
  if (!lease.ok) {
    return failedReport(store, attempt.attemptId, input.idempotencyKey, requestedCodes, ["LEASE_FENCING_FAILURE"], [
      validation("audit", "fail", "Attempt could not be claimed.", ["LEASE_FENCING_FAILURE"]),
    ]);
  }
  store.appendEvent({
    attemptId: attempt.attemptId,
    eventType: "lease_claimed",
    actorId: input.actorId ?? null,
    details: { fencingToken: lease.fencingToken },
  });
  store.markProcessing(attempt.attemptId, lease.leaseToken);

  const validations: DtcPhaseCValidationRecord[] = [];
  try {
    const gateVetoes = evaluatePhaseCGate(flags, input.authorizationStatement);
    if (gateVetoes.length > 0) {
      validations.push(validation("source", "fail", "Phase C synthetic processing gate rejected the request.", gateVetoes));
      throw new PhaseCFailure(gateVetoes);
    }

    const sourceBytes = getApprovedSyntheticSourceBytes();
    const sourceMetadata = makeSourceMetadata(input.sourceCaseType);
    validations.push(validation("source", "pass", "Approved synthetic fixture source artifact selected.", []));

    const dryRunReport = compileSyntheticDtcDryRun({
      requestId: input.requestId ?? `phase-c-${attempt.attemptId}`,
      sourceArtifact: sourceMetadata,
      requestedCodes,
    }, {
      registry: buildSyntheticPhaseBRegistry(),
      flags,
    });
    if (!dryRunReport.success) {
      validations.push(validation("dry_run", "fail", "Phase B exact-rule dry run rejected the request.", dryRunReport.hardVetoes));
      throw new PhaseCFailure(dryRunReport.hardVetoes);
    }
    validations.push(validation("dry_run", "pass", "Phase B exact-rule dry run compiled approved synthetic operations.", []));

    const sourceArtifact = store.putArtifact({ attemptId: attempt.attemptId, role: "source", bytes: sourceBytes });
    store.appendEvent({
      attemptId: attempt.attemptId,
      eventType: "source_artifact_created",
      actorId: input.actorId ?? null,
      details: { artifactId: sourceArtifact.artifactId, sha256: sourceArtifact.sha256 },
    });

    const operations = operationsForCodes(requestedCodes);
    const { preIntegrityBytes, operationRecords } = applySemanticOperations(sourceBytes, operations);
    const semanticChangedRegions = changedRegions(sourceBytes, preIntegrityBytes, "semantic", "fixture.semantic");
    validations.push(validation("semantic_patch", "pass", "Synthetic semantic operations were applied within allowlisted regions.", []));

    const preArtifact = store.putArtifact({
      attemptId: attempt.attemptId,
      role: "pre_integrity",
      bytes: preIntegrityBytes,
      parentArtifactId: sourceArtifact.artifactId,
    });
    store.appendEvent({
      attemptId: attempt.attemptId,
      eventType: "pre_integrity_artifact_created",
      actorId: input.actorId ?? null,
      details: { artifactId: preArtifact.artifactId, sha256: preArtifact.sha256 },
    });

    const finalBytes = requestedCodes.length > 0 ? applySyntheticCrc32(preIntegrityBytes) : Buffer.from(preIntegrityBytes);
    const integrityChangedRegions = changedRegions(preIntegrityBytes, finalBytes, "integrity", "fixture.integrity.crc32");
    if (!syntheticCrcValid(finalBytes)) {
      validations.push(validation("integrity_adapter", "fail", "Synthetic CRC32 post-validation failed.", ["POST_VALIDATION_FAILED"]));
      throw new PhaseCFailure(["POST_VALIDATION_FAILED"]);
    }
    validations.push(validation("integrity_adapter", "pass", "Approved in-process synthetic CRC32 adapter executed.", []));
    store.appendEvent({
      attemptId: attempt.attemptId,
      eventType: "integrity_adapter_executed",
      actorId: input.actorId ?? null,
      details: { adapterKey: "mg.synthetic.crc32.integrity", nativeExecutionUsed: false },
    });

    const finalArtifact = store.putArtifact({
      attemptId: attempt.attemptId,
      role: "final",
      bytes: finalBytes,
      parentArtifactId: preArtifact.artifactId,
    });
    store.appendEvent({
      attemptId: attempt.attemptId,
      eventType: "final_artifact_created",
      actorId: input.actorId ?? null,
      details: { artifactId: finalArtifact.artifactId, sha256: finalArtifact.sha256 },
    });

    validations.push(validation("post_validation", "pass", "Source, pre-integrity and final hashes were calculated and recorded.", []));
    validations.push(validation("audit", "pass", "Internal synthetic artifact lineage and audit events were recorded.", []));
    store.markSucceeded(attempt.attemptId, lease.leaseToken);
    store.appendEvent({
      attemptId: attempt.attemptId,
      eventType: "attempt_succeeded",
      actorId: input.actorId ?? null,
      details: { sourceSha256: sourceArtifact.sha256, preIntegritySha256: preArtifact.sha256, finalSha256: finalArtifact.sha256 },
    });

    return {
      reportVersion: "dtc-phase-c-synthetic-output-v1",
      attemptId: attempt.attemptId,
      idempotencyKey: input.idempotencyKey,
      status: "succeeded",
      success: true,
      requestedCodes,
      sourceSha256: sourceArtifact.sha256,
      preIntegritySha256: preArtifact.sha256,
      finalSha256: finalArtifact.sha256,
      semanticChangedRegions,
      integrityChangedRegions,
      operations: operationRecords,
      artifacts: [sourceArtifact, preArtifact, finalArtifact],
      validations,
      events: store.listEvents(attempt.attemptId),
      hardVetoes: [],
      syntheticFixtureOnly: true,
      integrityAdapter: syntheticAdapterSummary(),
      internalTestOnly: true,
      customerPublishable: false,
      customerDeliveryEnabled: false,
      outputArtifactsCustomerVisible: false,
      notes: [
        "Generated from the approved synthetic fixture only.",
        "No real ECU checksum adapter, native executable, customer file or customer delivery path was used.",
      ],
    };
  } catch (error) {
    const hardVetoes = error instanceof PhaseCFailure ? error.hardVetoes : ["WORKER_INTEGRITY_FAILURE" as const];
    store.markFailed(attempt.attemptId, hardVetoes);
    store.appendEvent({
      attemptId: attempt.attemptId,
      eventType: "attempt_failed",
      actorId: input.actorId ?? null,
      details: { hardVetoes },
    });
    return failedReport(store, attempt.attemptId, input.idempotencyKey, requestedCodes, hardVetoes, validations);
  }
}

export function runSyntheticPhaseCGoldenCorpus(options: EngineOptions = {}) {
  const cases = syntheticGoldenCorpus.cases.map((corpusCase) => {
    const store = new DtcPhaseCInMemoryStore();
    const report = generateSyntheticDtcTestOutput({
      requestedCodes: corpusCase.requestedCodes,
      idempotencyKey: `corpus-${corpusCase.caseKey}`,
      authorizationStatement: phaseCAuthorizationStatement,
      sourceCaseType: corpusCase.caseType,
      requestId: `corpus-${corpusCase.caseKey}`,
    }, {
      ...options,
      store,
    });
    const expected = corpusCase.expectedResult;
    const allChangedRegions = [...report.semanticChangedRegions, ...report.integrityChangedRegions].map((region) => ({
      start: region.start,
      length: region.length,
    }));
    const expectedRegions = expected.expectedChangedRegions?.map((region) => ({ start: region.start, length: region.length })) ?? [];
    const changedRegionsMatch = JSON.stringify(allChangedRegions) === JSON.stringify(expectedRegions);
    const preMatches = !expected.preIntegritySha256 || expected.preIntegritySha256 === report.preIntegritySha256;
    const finalMatches = !expected.finalSha256 || expected.finalSha256 === report.finalSha256;
    const errorMatches = expected.expectedErrorCode ? report.hardVetoes.includes(expected.expectedErrorCode) : true;
    const passed = report.success === expected.success &&
      (report.success ? changedRegionsMatch && preMatches && finalMatches : errorMatches) &&
      report.customerPublishable === false &&
      report.outputArtifactsCustomerVisible === false;

    return {
      caseKey: corpusCase.caseKey,
      expectedSuccess: expected.success,
      actualSuccess: report.success,
      passed,
      sourceSha256: report.sourceSha256,
      preIntegritySha256: report.preIntegritySha256,
      finalSha256: report.finalSha256,
      semanticChangedRegions: report.semanticChangedRegions.map((region) => ({ start: region.start, length: region.length })),
      integrityChangedRegions: report.integrityChangedRegions.map((region) => ({ start: region.start, length: region.length })),
      hardVetoes: report.hardVetoes,
    };
  });

  return {
    totalCases: cases.length,
    passedCases: cases.filter((corpusCase) => corpusCase.passed).length,
    failedCases: cases.filter((corpusCase) => !corpusCase.passed).length,
    positiveCases: syntheticGoldenCorpus.cases.filter((corpusCase) => corpusCase.expectedResult.success).length,
    negativeCases: syntheticGoldenCorpus.cases.filter((corpusCase) => !corpusCase.expectedResult.success).length,
    cases,
    artifactsCreated: cases.filter((corpusCase) => corpusCase.actualSuccess).length * 3,
    customerPublishableArtifacts: 0,
    realEcuFilesProcessed: false,
    customerFilesProcessed: false,
  } as const;
}

function evaluatePhaseCGate(flags: DtcActiveFeatureFlags, authorizationStatement: string): DtcActiveHardVetoCode[] {
  const vetoes: DtcActiveHardVetoCode[] = [];
  if (authorizationStatement !== phaseCAuthorizationStatement) vetoes.push("AUDIT_COMMIT_FAILED");
  if (flags.globalDtcKillSwitchEngaged) vetoes.push("GLOBAL_KILL_SWITCH");
  if (!flags.dtcInternalTestProcessing || !flags.dtcSyntheticFixtures) vetoes.push("MODE_DISABLED");
  if (flags.dtcRealEcuRules || flags.dtcRealIntegrityAdapters || flags.dtcInstructionPatchOperations) vetoes.push("MODE_DISABLED");
  if (flags.dtcA3ProductionProcessing || flags.dtcA4Automation || flags.dtcA5Automation || flags.dtcCustomerDelivery) {
    vetoes.push("MODE_DISABLED");
  }
  return [...new Set(vetoes)];
}

function makeSourceMetadata(caseType = "approved_source"): DtcPhaseBDryRunInput["sourceArtifact"] {
  const sourceArtifact: DtcPhaseBDryRunInput["sourceArtifact"] = {
    sha256: syntheticPhaseBConstants.sourceSha256,
    byteSize: syntheticPhaseBConstants.fileSizeBytes,
    role: "source",
    lineage: "synthetic_fixture",
    identity: syntheticPhaseBIdentity,
    segmentManifestDigestSha256: syntheticPhaseBConstants.segmentManifestDigestSha256,
    sourceExpectationState: "match",
    linkedStructureState: "present",
    integrityState: "valid",
  };
  if (caseType === "wrong_sw") sourceArtifact.identity = { ...syntheticPhaseBIdentity, softwareNumber: "MG-SYN-SW-WRONG" };
  if (caseType === "wrong_role") sourceArtifact.role = "unknown";
  if (caseType === "source_mismatch") sourceArtifact.sourceExpectationState = "mismatch";
  if (caseType === "missing_linked") sourceArtifact.linkedStructureState = "missing";
  if (caseType === "already_modified") sourceArtifact.previouslyModified = true;
  if (caseType === "corrupt") sourceArtifact.integrityState = "corrupt";
  return sourceArtifact;
}

function operationsForCodes(codes: string[]) {
  const rules = [
    { code: "P0100", rule: syntheticRuleP0100 },
    { code: "P0300", rule: syntheticRuleP0300 },
  ];
  const operations: DtcPhaseBLeafOperation[] = [];
  for (const code of codes) {
    const match = rules.find((candidate) => candidate.code === code);
    if (!match) throw new PhaseCFailure(["DEFINITION_NOT_EXACT"]);
    const ruleOperations: DtcPhaseBLeafOperation[] = [];
    const topOperations = match.rule.ruleBody.operations as DtcPhaseBOperation[];
    for (const operation of topOperations) {
      if (operation.type === "coordinated_multi_structure_operation") {
        ruleOperations.push(...operation.operations);
      } else {
        ruleOperations.push(operation);
      }
    }
    operations.push(...ruleOperations);
  }
  return operations.sort((left, right) => left.target.absoluteOffset - right.target.absoluteOffset);
}

function applySemanticOperations(sourceBytes: Buffer, operations: DtcPhaseBLeafOperation[]) {
  const output = Buffer.from(sourceBytes);
  const operationRecords: DtcPhaseCOperationRecord[] = [];
  for (const operation of operations) {
    const oldBytes = output.subarray(operation.target.absoluteOffset, operation.target.absoluteOffset + operation.widthBytes);
    if (oldBytes.toString("hex").toUpperCase() !== operation.expectedOldHex) {
      throw new PhaseCFailure(["SOURCE_BYTES_MISMATCH"]);
    }
    const newBytes = Buffer.from(operation.newValueHex, "hex");
    if (newBytes.length !== operation.widthBytes) throw new PhaseCFailure(["OPERATION_OUT_OF_BOUNDS"]);
    newBytes.copy(output, operation.target.absoluteOffset);
    operationRecords.push({
      operationId: operation.operationId,
      operationType: operation.type,
      offset: operation.target.absoluteOffset,
      widthBytes: operation.widthBytes,
      allowedRegionRef: operation.allowedRegionRef,
      expectedOldHex: operation.expectedOldHex,
      newValueHex: operation.newValueHex,
      semanticReason: operation.semanticReason,
    });
  }
  return { preIntegrityBytes: output, operationRecords };
}

function changedRegions(before: Uint8Array, after: Uint8Array, kind: "semantic" | "integrity", regionRef: string): DtcPhaseCChangedRegion[] {
  const regions: DtcPhaseCChangedRegion[] = [];
  let start: number | null = null;
  for (let index = 0; index < before.length; index += 1) {
    if (before[index] !== after[index] && start === null) start = index;
    if ((before[index] === after[index] || index === before.length - 1) && start !== null) {
      const exclusiveEnd = before[index] === after[index] ? index : index + 1;
      const beforeSlice = before.subarray(start, exclusiveEnd);
      const afterSlice = after.subarray(start, exclusiveEnd);
      regions.push({
        regionRef,
        kind,
        start,
        length: exclusiveEnd - start,
        beforeSha256: sha256Hex(beforeSlice),
        afterSha256: sha256Hex(afterSlice),
      });
      start = null;
    }
  }
  return regions;
}

function validation(
  stage: DtcPhaseCValidationRecord["stage"],
  status: DtcPhaseCValidationRecord["status"],
  message: string,
  hardVetoes: DtcActiveHardVetoCode[]
): DtcPhaseCValidationRecord {
  return {
    validationId: randomUUID(),
    stage,
    status,
    message,
    hardVetoes,
  };
}

function failedReport(
  store: DtcPhaseCInMemoryStore,
  attemptId: string,
  idempotencyKey: string,
  requestedCodes: string[],
  hardVetoes: DtcActiveHardVetoCode[],
  validations: DtcPhaseCValidationRecord[]
): DtcPhaseCProcessingReport {
  return {
    reportVersion: "dtc-phase-c-synthetic-output-v1",
    attemptId,
    idempotencyKey,
    status: "failed",
    success: false,
    requestedCodes,
    sourceSha256: syntheticPhaseBConstants.sourceSha256,
    preIntegritySha256: null,
    finalSha256: null,
    semanticChangedRegions: [],
    integrityChangedRegions: [],
    operations: [],
    artifacts: store.listArtifacts(attemptId),
    validations,
    events: store.listEvents(attemptId),
    hardVetoes: [...new Set(hardVetoes)],
    syntheticFixtureOnly: true,
    integrityAdapter: syntheticAdapterSummary(),
    internalTestOnly: true,
    customerPublishable: false,
    customerDeliveryEnabled: false,
    outputArtifactsCustomerVisible: false,
    notes: ["Phase C synthetic processing failed safely. No customer-deliverable artifact was created."],
  };
}

function syntheticAdapterSummary() {
  return {
    stableAdapterKey: "mg.synthetic.crc32.integrity",
    version: "1.0.0",
    executionType: "in_process_synthetic_crc32",
    nativeExecutionUsed: false,
    realEcuChecksum: false,
  } as const;
}

function uniqueCodes(codes: string[]) {
  return [...new Set(codes.map((code) => code.trim().toUpperCase()).filter(Boolean))].sort();
}

class PhaseCFailure extends Error {
  constructor(readonly hardVetoes: DtcActiveHardVetoCode[]) {
    super(`Phase C processing failed: ${hardVetoes.join(", ")}`);
  }
}

export const phaseCExpectedHashes = {
  source: syntheticPhaseBConstants.sourceSha256,
  p0100PreIntegrity: "e3c99d7798cc84255aded8e5593bf7bb0ec1243f17abd4d5f455e8a6e26bdd6c",
  p0100Final: "6aafd3bec89c982a395d0935180257facb1f165c5b5d8d0b483d388c4aade3a5",
  p0300PreIntegrity: "44a4d79f82526443c8a9a3e4a16b446adb9f658d82a259ad9d472eeff68c8da2",
  p0300Final: "152baac460a39528977ecf2dfa86739165b016467b92afa3e75a595b41535ffd",
  combinedPreIntegrity: "aee08c106549d591b7c48ee550b8b3a5139ad14315d3f3c87ab75bf0b8c5205b",
  combinedFinal: "0b1d77135352893df994b75da7c9948d6e954ba7f8fe4df78328d09ff20736e0",
  crcRegion: { start: syntheticFixtureLayout.crcOffset, length: 4 },
} as const;
