import type {
  DtcDryRunOperationPlan,
  DtcDryRunReport,
  DtcPhaseBDryRunInput,
  DtcPhaseBLeafOperation,
  DtcPhaseBOperation,
  DtcRuleDocument,
} from "@/lib/dtcActive/phaseBTypes";
import { resolveDtcActiveFeatureFlags } from "@/lib/dtcActive/policy";
import {
  buildSyntheticPhaseBRegistry,
  resolveExactDtcRule,
  resolveExactIntegrityAdapter,
  type DtcPhaseBRegistry,
} from "@/lib/dtcActive/registry";
import type { DtcActiveFeatureFlags, DtcActiveHardVetoCode } from "@/lib/dtcActive/types";

export function compileSyntheticDtcDryRun(
  input: DtcPhaseBDryRunInput,
  options?: {
    registry?: DtcPhaseBRegistry;
    flags?: DtcActiveFeatureFlags;
  }
): DtcDryRunReport {
  const registry = options?.registry ?? buildSyntheticPhaseBRegistry();
  const flags = options?.flags ?? resolveDtcActiveFeatureFlags();
  const gateVetoes = evaluatePhaseBDryRunFeatureGate(flags);
  if (gateVetoes.length > 0) return blockedReport(input, gateVetoes, "Phase B dry-run feature flags are fail-closed.");

  const sourceVetoes = evaluateSourceMetadata(input);
  if (sourceVetoes.length > 0) return blockedReport(input, sourceVetoes, "Source metadata failed before rule resolution.");

  if (input.requestedCodes.length === 0) {
    return successReport(input, [], [], [], [], ["No DTC codes requested; dry-run completed as no-op."]);
  }

  const matchedRules: DtcRuleDocument[] = [];
  const matchedAdapterDigests = new Set<string>();
  const operationPlan: DtcDryRunOperationPlan[] = [];
  const coordinatedOperationIds: string[] = [];

  for (const code of uniqueCodes(input.requestedCodes)) {
    const ruleResolution = resolveExactDtcRule(registry, {
      code,
      identity: input.sourceArtifact.identity,
      sourceSha256: input.sourceArtifact.sha256,
      segmentManifestDigestSha256: input.sourceArtifact.segmentManifestDigestSha256,
      fileSizeBytes: input.sourceArtifact.byteSize,
    });
    if (!ruleResolution.ok) return blockedReport(input, ruleResolution.hardVetoes, "No exact approved rule matched.");

    const adapterResolution = resolveExactIntegrityAdapter(
      registry,
      ruleResolution.item.ruleBody.integrityAdapterRef,
      input.sourceArtifact.identity,
      input.sourceArtifact.byteSize,
      input.sourceArtifact.segmentManifestDigestSha256
    );
    if (!adapterResolution.ok) {
      return blockedReport(input, adapterResolution.hardVetoes, "No exact approved integrity adapter metadata matched.");
    }

    const operationValidation = validateRuleOperations(ruleResolution.item);
    if (operationValidation.hardVetoes.length > 0) {
      return blockedReport(input, operationValidation.hardVetoes, operationValidation.note);
    }

    matchedRules.push(ruleResolution.item);
    matchedAdapterDigests.add(adapterResolution.item.contentDigest);
    operationPlan.push(...operationValidation.operationPlan);
    coordinatedOperationIds.push(...operationValidation.coordinatedOperationIds);
  }

  const overlapVetoes = findOperationOverlap(operationPlan);
  if (overlapVetoes.length > 0) {
    return blockedReport(input, overlapVetoes, "Operation plan contains overlapping write ranges.");
  }

  return successReport(
    input,
    matchedRules.map((rule) => rule.contentDigest),
    [...matchedAdapterDigests],
    coordinatedOperationIds,
    operationPlan,
    ["Synthetic dry-run report compiled. No firmware bytes were read, modified or written."]
  );
}

export function evaluatePhaseBDryRunFeatureGate(flags: DtcActiveFeatureFlags): DtcActiveHardVetoCode[] {
  const vetoes: DtcActiveHardVetoCode[] = [];
  if (flags.globalDtcKillSwitchEngaged) vetoes.push("GLOBAL_KILL_SWITCH");
  if (!flags.dtcInternalTestProcessing || !flags.dtcSyntheticFixtures) vetoes.push("MODE_DISABLED");
  if (flags.dtcRealEcuRules || flags.dtcRealIntegrityAdapters || flags.dtcInstructionPatchOperations) {
    vetoes.push("MODE_DISABLED");
  }
  if (flags.dtcA3ProductionProcessing || flags.dtcA4Automation || flags.dtcA5Automation || flags.dtcCustomerDelivery) {
    vetoes.push("MODE_DISABLED");
  }
  return [...new Set(vetoes)];
}

function evaluateSourceMetadata(input: DtcPhaseBDryRunInput): DtcActiveHardVetoCode[] {
  const source = input.sourceArtifact;
  if (source.lineage !== "synthetic_fixture") return ["UNAUTHORIZED_SOURCE_PROVENANCE"];
  if (source.role !== "source") return ["FILE_ROLE_UNKNOWN"];
  if (source.integrityState === "corrupt") return ["SOURCE_INTEGRITY_FAILED"];
  if (source.previouslyModified) return ["PREVIOUSLY_MODIFIED_INPUT"];
  if (source.sourceExpectationState === "mismatch") return ["SOURCE_BYTES_MISMATCH"];
  if (source.linkedStructureState === "missing") return ["MISSING_LINKED_STRUCTURE"];
  return [];
}

function validateRuleOperations(rule: DtcRuleDocument): {
  operationPlan: DtcDryRunOperationPlan[];
  coordinatedOperationIds: string[];
  hardVetoes: DtcActiveHardVetoCode[];
  note: string;
} {
  const fileSize = rule.ruleBody.representation.fileSizeBytes;
  const semanticRegions = rule.ruleBody.outputAllowlist.semanticRegions;
  const operations = flattenOperations(rule.ruleBody.operations);
  const operationPlan: DtcDryRunOperationPlan[] = [];
  const hardVetoes: DtcActiveHardVetoCode[] = [];

  for (const operation of operations.leafOperations) {
    if (operation.type !== "write_bitfield" && operation.type !== "write_enum") {
      hardVetoes.push("UNSUPPORTED_OPERATION_TYPE");
      continue;
    }
    if (operation.sourceContext.length === 0) hardVetoes.push("SOURCE_BYTES_MISMATCH");
    if (operation.target.absoluteOffset < 0 || operation.target.absoluteOffset + operation.widthBytes > fileSize) {
      hardVetoes.push("OPERATION_OUT_OF_BOUNDS");
    }
    if (operation.target.absoluteOffset % operation.target.alignment !== 0) {
      hardVetoes.push("OPERATION_ALIGNMENT_FAILED");
    }
    const region = semanticRegions.find((candidate) => candidate.regionRef === operation.allowedRegionRef);
    if (!region || !isInsideRegion(operation.target.absoluteOffset, operation.widthBytes, region.start, region.length)) {
      hardVetoes.push("OUTPUT_OUTSIDE_ALLOWLIST");
    }

    operationPlan.push({
      operationId: operation.operationId,
      type: operation.type,
      offset: operation.target.absoluteOffset,
      widthBytes: operation.widthBytes,
      allowedRegionRef: operation.allowedRegionRef,
      semanticReason: operation.semanticReason,
    });
  }

  const changedBytes = operationPlan.reduce((sum, operation) => sum + operation.widthBytes, 0);
  if (changedBytes > rule.ruleBody.outputAllowlist.maximumChangedBytes) {
    hardVetoes.push("OUTPUT_OUTSIDE_ALLOWLIST");
  }

  return {
    operationPlan,
    coordinatedOperationIds: operations.coordinatedOperationIds,
    hardVetoes: [...new Set(hardVetoes)],
    note: "Rule operation plan failed Phase B dry-run validation.",
  };
}

function flattenOperations(operations: DtcPhaseBOperation[]) {
  const leafOperations: DtcPhaseBLeafOperation[] = [];
  const coordinatedOperationIds: string[] = [];
  for (const operation of operations) {
    if (operation.type === "coordinated_multi_structure_operation") {
      coordinatedOperationIds.push(operation.operationId);
      leafOperations.push(...operation.operations);
    } else {
      leafOperations.push(operation);
    }
  }
  return { leafOperations, coordinatedOperationIds };
}

function findOperationOverlap(operationPlan: DtcDryRunOperationPlan[]): DtcActiveHardVetoCode[] {
  const sorted = [...operationPlan].sort((left, right) => left.offset - right.offset);
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (previous.offset + previous.widthBytes > current.offset) return ["OPERATION_OVERLAP"];
  }
  return [];
}

function isInsideRegion(offset: number, width: number, regionStart: number, regionLength: number) {
  return offset >= regionStart && offset + width <= regionStart + regionLength;
}

function successReport(
  input: DtcPhaseBDryRunInput,
  matchedRuleDigests: string[],
  matchedAdapterDigests: string[],
  matchedOperationIds: string[],
  operationPlan: DtcDryRunOperationPlan[],
  notes: string[]
): DtcDryRunReport {
  return {
    reportVersion: "dtc-phase-b-dry-run-v1",
    requestId: input.requestId,
    mode: "synthetic_dry_run_only",
    success: true,
    requestedCodes: uniqueCodes(input.requestedCodes),
    matchedRuleDigests,
    matchedAdapterDigests,
    matchedOperationIds,
    operationPlan,
    hardVetoes: [],
    dryRunOnly: true,
    firmwareBytesMutated: false,
    outputArtifactCreated: false,
    outputArtifacts: [],
    integrityAdaptersExecuted: false,
    nativeExecutionUsed: false,
    notes,
  };
}

function blockedReport(
  input: DtcPhaseBDryRunInput,
  hardVetoes: DtcActiveHardVetoCode[],
  note: string
): DtcDryRunReport {
  return {
    reportVersion: "dtc-phase-b-dry-run-v1",
    requestId: input.requestId,
    mode: "synthetic_dry_run_only",
    success: false,
    requestedCodes: uniqueCodes(input.requestedCodes),
    matchedRuleDigests: [],
    matchedAdapterDigests: [],
    matchedOperationIds: [],
    operationPlan: [],
    hardVetoes: [...new Set(hardVetoes)],
    dryRunOnly: true,
    firmwareBytesMutated: false,
    outputArtifactCreated: false,
    outputArtifacts: [],
    integrityAdaptersExecuted: false,
    nativeExecutionUsed: false,
    notes: [note],
  };
}

function uniqueCodes(codes: string[]) {
  return [...new Set(codes.map((code) => code.trim().toUpperCase()).filter(Boolean))].sort();
}
