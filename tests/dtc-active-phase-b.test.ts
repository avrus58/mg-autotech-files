import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertCustomerDtcActiveProjectionSafe,
  buildCustomerSafeDtcDryRunStatus,
  canonicalDocumentDigest,
  canonicalDocumentSha256,
  cloneRegistryWith,
  compileSyntheticDtcDryRun,
  dtcGoldenCorpusManifestSchema,
  dtcIntegrityAdapterDocumentSchema,
  dtcRuleDocumentSchema,
  evaluatePhaseBDryRunFeatureGate,
  runSyntheticGoldenCorpus,
  syntheticGoldenCorpus,
  syntheticIntegrityAdapter,
  syntheticPhaseBConstants,
  syntheticPhaseBIdentity,
  syntheticRuleP0100,
  validateDtcDocument,
} from "@/lib/dtcActive";
import type {
  DtcIntegrityAdapterDocument,
  DtcPhaseBDryRunInput,
  DtcRuleDocument,
} from "@/lib/dtcActive/phaseBTypes";
import type { DtcActiveFeatureFlags } from "@/lib/dtcActive/types";

const enabledSyntheticFlags: DtcActiveFeatureFlags = {
  dtcReadOnlyFoundation: true,
  dtcInternalTestProcessing: true,
  dtcSyntheticFixtures: true,
  dtcAuthorizedLabFirmware: false,
  dtcA3ProductionProcessing: false,
  dtcA4Automation: false,
  dtcA5Automation: false,
  dtcCustomerDelivery: false,
  dtcRealEcuRules: false,
  dtcRealIntegrityAdapters: false,
  dtcInstructionPatchOperations: false,
  globalDtcKillSwitchEngaged: false,
};

function validInput(overrides?: Partial<DtcPhaseBDryRunInput["sourceArtifact"]>): DtcPhaseBDryRunInput {
  return {
    requestId: "test-dry-run",
    sourceArtifact: {
      sha256: syntheticPhaseBConstants.sourceSha256,
      byteSize: syntheticPhaseBConstants.fileSizeBytes,
      role: "source",
      lineage: "synthetic_fixture",
      identity: syntheticPhaseBIdentity,
      segmentManifestDigestSha256: syntheticPhaseBConstants.segmentManifestDigestSha256,
      sourceExpectationState: "match",
      linkedStructureState: "present",
      integrityState: "valid",
      ...overrides,
    },
    requestedCodes: ["P0100"],
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function compileWithRule(rule: DtcRuleDocument) {
  return compileSyntheticDtcDryRun(validInput(), {
    flags: enabledSyntheticFlags,
    registry: cloneRegistryWith(
      {
        rules: [syntheticRuleP0100],
        adapters: [syntheticIntegrityAdapter],
        corpus: syntheticGoldenCorpus,
      },
      { rules: [rule] }
    ),
  });
}

test("DTC Phase B validates rule, adapter and corpus schemas", () => {
  assert.equal(validateDtcDocument(dtcRuleDocumentSchema, syntheticRuleP0100).ok, true);
  assert.equal(validateDtcDocument(dtcIntegrityAdapterDocumentSchema, syntheticIntegrityAdapter).ok, true);
  assert.equal(validateDtcDocument(dtcGoldenCorpusManifestSchema, syntheticGoldenCorpus).ok, true);

  const invalidRule = clone(syntheticRuleP0100) as DtcRuleDocument & { script?: string };
  invalidRule.script = "return true";
  const invalidRuleResult = validateDtcDocument(dtcRuleDocumentSchema, invalidRule);
  assert.equal(invalidRuleResult.ok, false);
  assert.match(invalidRuleResult.errors.join("\n"), /Executable or arbitrary-script field rejected/);

  const invalidAdapter = clone(syntheticIntegrityAdapter) as DtcIntegrityAdapterDocument;
  invalidAdapter.adapterBody.execution.entrypointType = "native_dll" as DtcIntegrityAdapterDocument["adapterBody"]["execution"]["entrypointType"];
  assert.equal(validateDtcDocument(dtcIntegrityAdapterDocumentSchema, invalidAdapter).ok, false);

  const invalidCorpus = clone(syntheticGoldenCorpus);
  invalidCorpus.cases[0].sourceArtifact.sha256 = "not-a-sha";
  assert.equal(validateDtcDocument(dtcGoldenCorpusManifestSchema, invalidCorpus).ok, false);
});

test("DTC Phase B canonical JSON digest is stable across key order", () => {
  const left = { b: 2, a: { d: true, c: ["x", 1] } };
  const right = { a: { c: ["x", 1], d: true }, b: 2 };

  assert.equal(canonicalDocumentSha256(left), canonicalDocumentSha256(right));
  assert.equal(canonicalDocumentDigest(left), `sha256:${canonicalDocumentSha256(right)}`);
});

test("DTC Phase B exact identity matching rejects wrong HW, SW and calibration", () => {
  for (const identityPatch of [
    { hardwareNumber: "WRONG-HW" },
    { softwareNumber: "WRONG-SW" },
    { calibrationId: "WRONG-CAL" },
  ]) {
    const report = compileSyntheticDtcDryRun(validInput({
      identity: { ...syntheticPhaseBIdentity, ...identityPatch },
    }), { flags: enabledSyntheticFlags });
    assert.equal(report.success, false);
    assert.ok(report.hardVetoes.includes("EXACT_SW_NOT_ESTABLISHED"));
  }
});

test("DTC Phase B rejects ambiguous, unapproved and revoked rules", () => {
  const ambiguous = compileSyntheticDtcDryRun(validInput(), {
    flags: enabledSyntheticFlags,
    registry: {
      rules: [syntheticRuleP0100, clone(syntheticRuleP0100)],
      adapters: [syntheticIntegrityAdapter],
      corpus: syntheticGoldenCorpus,
    },
  });
  assert.ok(ambiguous.hardVetoes.includes("DUPLICATE_OR_AMBIGUOUS_MATCH"));

  const draftRule = clone(syntheticRuleP0100) as DtcRuleDocument;
  draftRule.ruleBody.approvalState = "draft";
  assert.ok(compileWithRule(draftRule).hardVetoes.includes("RULE_NOT_APPROVED"));

  const revokedRule = clone(syntheticRuleP0100) as DtcRuleDocument;
  revokedRule.ruleBody.revocation.revoked = true;
  assert.ok(compileWithRule(revokedRule).hardVetoes.includes("RULE_REVOKED"));
});

test("DTC Phase B rejects unapproved and revoked adapters", () => {
  const draftAdapter = clone(syntheticIntegrityAdapter) as DtcIntegrityAdapterDocument;
  draftAdapter.adapterBody.approvalState = "draft";
  const unapproved = compileSyntheticDtcDryRun(validInput(), {
    flags: enabledSyntheticFlags,
    registry: { rules: [syntheticRuleP0100], adapters: [draftAdapter], corpus: syntheticGoldenCorpus },
  });
  assert.ok(unapproved.hardVetoes.includes("ADAPTER_NOT_APPROVED"));

  const revokedAdapter = clone(syntheticIntegrityAdapter) as DtcIntegrityAdapterDocument;
  revokedAdapter.adapterBody.revocation.revoked = true;
  const revoked = compileSyntheticDtcDryRun(validInput(), {
    flags: enabledSyntheticFlags,
    registry: { rules: [syntheticRuleP0100], adapters: [revokedAdapter], corpus: syntheticGoldenCorpus },
  });
  assert.ok(revoked.hardVetoes.includes("ADAPTER_REVOKED"));
});

test("DTC Phase B hard vetoes source-byte expectations and linked-structure requirements", () => {
  const mismatch = compileSyntheticDtcDryRun(validInput({ sourceExpectationState: "mismatch" }), {
    flags: enabledSyntheticFlags,
  });
  assert.ok(mismatch.hardVetoes.includes("SOURCE_BYTES_MISMATCH"));

  const missingLinked = compileSyntheticDtcDryRun(validInput({ linkedStructureState: "missing" }), {
    flags: enabledSyntheticFlags,
  });
  assert.ok(missingLinked.hardVetoes.includes("MISSING_LINKED_STRUCTURE"));
});

test("DTC Phase B validates operation bounds, overlap, alignment and allowlists", () => {
  const outOfBoundsRule = clone(syntheticRuleP0100);
  outOfBoundsRule.ruleBody.operations[0].operations[0].target.absoluteOffset = 5000;
  assert.ok(compileWithRule(outOfBoundsRule).hardVetoes.includes("OPERATION_OUT_OF_BOUNDS"));

  const overlapRule = clone(syntheticRuleP0100);
  overlapRule.ruleBody.operations[0].operations[1].target.absoluteOffset = 516;
  overlapRule.ruleBody.operations[0].operations[1].allowedRegionRef = "fixture.semantic.p0100.primary";
  assert.ok(compileWithRule(overlapRule).hardVetoes.includes("OPERATION_OVERLAP"));

  const alignmentRule = clone(syntheticRuleP0100);
  alignmentRule.ruleBody.operations[0].operations[0].target.absoluteOffset = 517;
  alignmentRule.ruleBody.operations[0].operations[0].target.alignment = 2;
  assert.ok(compileWithRule(alignmentRule).hardVetoes.includes("OPERATION_ALIGNMENT_FAILED"));

  const allowlistRule = clone(syntheticRuleP0100);
  allowlistRule.ruleBody.operations[0].operations[0].target.absoluteOffset = 600;
  assert.ok(compileWithRule(allowlistRule).hardVetoes.includes("OUTPUT_OUTSIDE_ALLOWLIST"));
});

test("DTC Phase B rejects unsupported operation types and arbitrary script documents", () => {
  const unsupportedRule = clone(syntheticRuleP0100) as unknown as DtcRuleDocument;
  (unsupportedRule.ruleBody.operations[0] as { operations: Array<{ type: string }> }).operations[0].type = "write_script";
  const unsupported = compileWithRule(unsupportedRule);
  assert.ok(unsupported.hardVetoes.includes("UNSUPPORTED_OPERATION_TYPE"));

  const arbitraryScriptRule = clone(syntheticRuleP0100) as DtcRuleDocument & { ruleBody: DtcRuleDocument["ruleBody"] & { command?: string } };
  arbitraryScriptRule.ruleBody.command = "powershell.exe";
  const validation = validateDtcDocument(dtcRuleDocumentSchema, arbitraryScriptRule);
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /arbitrary-script/i);
});

test("DTC Phase B dry-run report generates no firmware mutation or output artifact", () => {
  const input = validInput();
  const before = clone(input);
  const report = compileSyntheticDtcDryRun(input, { flags: enabledSyntheticFlags });

  assert.equal(report.success, true);
  assert.equal(report.operationPlan.length, 2);
  assert.deepEqual(report.matchedOperationIds, ["fixture.p0100.coordinated-disable"]);
  assert.equal(report.firmwareBytesMutated, false);
  assert.equal(report.outputArtifactCreated, false);
  assert.deepEqual(report.outputArtifacts, []);
  assert.equal(report.integrityAdaptersExecuted, false);
  assert.equal(report.nativeExecutionUsed, false);
  assert.deepEqual(input, before);
});

test("DTC Phase B golden corpus covers positive and negative synthetic cases", () => {
  const result = runSyntheticGoldenCorpus({ flags: enabledSyntheticFlags });

  assert.equal(result.totalCases, 10);
  assert.equal(result.positiveCases, 4);
  assert.equal(result.negativeCases, 6);
  assert.equal(result.failedCases, 0);
  assert.equal(result.outputArtifactCreated, false);
  assert.equal(result.firmwareBytesMutated, false);
});

test("DTC Phase B customer response is allowlisted and strips internals", () => {
  const report = compileSyntheticDtcDryRun(validInput(), { flags: enabledSyntheticFlags });
  const customerStatus = buildCustomerSafeDtcDryRunStatus(report, new Date("2026-07-14T12:00:00.000Z"));

  assert.equal(customerStatus.downloadable, false);
  assert.deepEqual(Object.keys(customerStatus).sort(), [
    "customerMessage",
    "downloadable",
    "requestId",
    "requestedCodes",
    "status",
    "updatedAt",
  ]);
  assert.doesNotThrow(() => assertCustomerDtcActiveProjectionSafe(customerStatus));
});

test("DTC Phase B feature flags fail closed by default and reject dangerous combinations", () => {
  const defaultReport = compileSyntheticDtcDryRun(validInput(), {
    flags: {
      ...enabledSyntheticFlags,
      dtcInternalTestProcessing: false,
      dtcSyntheticFixtures: false,
      globalDtcKillSwitchEngaged: true,
    },
  });
  assert.ok(defaultReport.hardVetoes.includes("GLOBAL_KILL_SWITCH"));
  assert.ok(defaultReport.hardVetoes.includes("MODE_DISABLED"));

  const dangerousVetoes = evaluatePhaseBDryRunFeatureGate({
    ...enabledSyntheticFlags,
    dtcRealEcuRules: true,
    dtcRealIntegrityAdapters: true,
    dtcInstructionPatchOperations: true,
  });
  assert.deepEqual(dangerousVetoes, ["MODE_DISABLED"]);
});
