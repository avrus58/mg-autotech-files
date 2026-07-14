import { syntheticPhaseBConstants, syntheticPhaseBIdentity } from "@/lib/dtcActive/fixtures";
import { compileSyntheticDtcDryRun } from "@/lib/dtcActive/dryRunCompiler";
import type { DtcPhaseBDryRunInput } from "@/lib/dtcActive/phaseBTypes";
import { buildSyntheticPhaseBRegistry, type DtcPhaseBRegistry } from "@/lib/dtcActive/registry";
import type { DtcActiveFeatureFlags } from "@/lib/dtcActive/types";

export type DtcGoldenCorpusRunResult = {
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
    expectedErrorCode?: string;
    hardVetoes: string[];
    operationIds: string[];
  }>;
  firmwareBytesMutated: false;
  outputArtifactCreated: false;
};

export function runSyntheticGoldenCorpus(
  options?: {
    registry?: DtcPhaseBRegistry;
    flags?: DtcActiveFeatureFlags;
  }
): DtcGoldenCorpusRunResult {
  const registry = options?.registry ?? buildSyntheticPhaseBRegistry();
  const cases = registry.corpus.cases.map((corpusCase) => {
    const report = compileSyntheticDtcDryRun(makeInputForCorpusCase(corpusCase.caseKey, corpusCase.caseType, corpusCase.sourceArtifact.sha256, corpusCase.requestedCodes), {
      registry,
      flags: options?.flags,
    });
    const expectedOperationIds = corpusCase.expectedResult.expectedOperationIds ?? [];
    const operationIdsMatch =
      expectedOperationIds.length === report.matchedOperationIds.length &&
      expectedOperationIds.every((operationId, index) => operationId === report.matchedOperationIds[index]);
    const errorMatches = corpusCase.expectedResult.expectedErrorCode
      ? report.hardVetoes.includes(corpusCase.expectedResult.expectedErrorCode)
      : true;
    const passed =
      report.success === corpusCase.expectedResult.success &&
      (report.success ? operationIdsMatch : errorMatches) &&
      report.firmwareBytesMutated === false &&
      report.outputArtifactCreated === false;

    return {
      caseKey: corpusCase.caseKey,
      expectedSuccess: corpusCase.expectedResult.success,
      actualSuccess: report.success,
      passed,
      expectedErrorCode: corpusCase.expectedResult.expectedErrorCode,
      hardVetoes: report.hardVetoes,
      operationIds: report.matchedOperationIds,
    };
  });

  return {
    totalCases: cases.length,
    passedCases: cases.filter((corpusCase) => corpusCase.passed).length,
    failedCases: cases.filter((corpusCase) => !corpusCase.passed).length,
    positiveCases: registry.corpus.cases.filter((corpusCase) => corpusCase.expectedResult.success).length,
    negativeCases: registry.corpus.cases.filter((corpusCase) => !corpusCase.expectedResult.success).length,
    cases,
    firmwareBytesMutated: false,
    outputArtifactCreated: false,
  };
}

function makeInputForCorpusCase(
  caseKey: string,
  caseType: string,
  sha256: string,
  requestedCodes: string[]
): DtcPhaseBDryRunInput {
  const input: DtcPhaseBDryRunInput = {
    requestId: `synthetic-corpus-${caseKey}`,
    sourceArtifact: {
      sha256,
      byteSize: syntheticPhaseBConstants.fileSizeBytes,
      role: "source",
      lineage: "synthetic_fixture",
      identity: syntheticPhaseBIdentity,
      segmentManifestDigestSha256: syntheticPhaseBConstants.segmentManifestDigestSha256,
      sourceExpectationState: "match",
      linkedStructureState: "present",
      integrityState: "valid",
    },
    requestedCodes,
  };

  if (caseType === "wrong_sw") {
    input.sourceArtifact.identity = {
      ...syntheticPhaseBIdentity,
      softwareNumber: "MG-SYN-SW-WRONG",
    };
  }
  if (caseType === "wrong_role") input.sourceArtifact.role = "unknown";
  if (caseType === "source_mismatch") input.sourceArtifact.sourceExpectationState = "mismatch";
  if (caseType === "missing_linked") input.sourceArtifact.linkedStructureState = "missing";
  if (caseType === "already_modified") input.sourceArtifact.previouslyModified = true;
  if (caseType === "corrupt") input.sourceArtifact.integrityState = "corrupt";

  return input;
}
