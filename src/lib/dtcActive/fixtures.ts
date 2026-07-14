import {
  canonicalDocumentDigest,
  canonicalDocumentSha256,
  documentWithoutDigest,
} from "@/lib/dtcActive/canonicalJson";
import type {
  DtcGoldenCorpusManifest,
  DtcIntegrityAdapterDocument,
  DtcPhaseBIdentity,
  DtcRuleDocument,
} from "@/lib/dtcActive/phaseBTypes";

export const syntheticPhaseBIdentity: DtcPhaseBIdentity = {
  supplier: "MG AutoTech",
  family: "SYNTHETIC_DTC_FIXTURE",
  ecuType: "MG_DTC_FIXTURE_V1",
  hardwareNumber: "MG-SYN-HW-0001",
  softwareNumber: "MG-SYN-SW-0001",
  calibrationId: "MG-SYN-CAL-0001",
  processorArchitecture: "synthetic-byte-addressed",
};

export const syntheticPhaseBConstants = {
  sourceSha256: "3635c2b76cba5164d0b189305a0264e167d8a9e7c3bd264e92574e41acb277c9",
  wrongSwSha256: "3a5b9777b7b544ffcfa731f5882932314141ed8c523a13f4225d4598ee9e37dc",
  wrongRoleSha256: "548ff41ba67f0602496ec30f1db7de0a3b8b37b0cee9c2cbbf17c2083715b352",
  sourceMismatchSha256: "3dd6f0ac5cfd7fa2b989d7f96f997e9aeb7914085e4c8f28487715c3ec995820",
  missingLinkedSha256: "3647fe77a29f79ce123a7168eb6da8cc215884ae38f048eaaa9eb82e4f71899e",
  alreadyModifiedSha256: "6aafd3bec89c982a395d0935180257facb1f165c5b5d8d0b483d388c4aade3a5",
  corruptSha256: "2329f49dd0f9b9824831ab1a981ceef5dcd1a51e5296b477c10cb5800813d5c9",
  fileSizeBytes: 4096,
  segmentManifestDigestSha256: "0fc7dbfcf5dd986763423043b44fe650d8b45f2262aca7934dffb9782fcf5fe8",
  identityDigestSha256: "7ce7417ed74725a8f9f6dde89eefc81d40a99cdc56941618fff00b6ee498772d",
} as const;

function attachContentDigest<T extends object>(document: T): T & { contentDigest: string } {
  return {
    ...document,
    contentDigest: canonicalDocumentDigest(documentWithoutDigest(document as Record<string, unknown>, "contentDigest")),
  };
}

function attachManifestDigest<T extends object>(
  document: T
): T & { manifestDigestSha256: string } {
  return {
    ...document,
    manifestDigestSha256: canonicalDocumentSha256(
      documentWithoutDigest(document as Record<string, unknown>, "manifestDigestSha256")
    ),
  };
}

export const syntheticIntegrityAdapter = attachContentDigest({
  schemaVersion: "2.0.0",
  canonicalization: "RFC8785-JCS",
  digestAlgorithm: "SHA-256",
  adapterBody: {
    stableAdapterKey: "mg.synthetic.crc32.integrity",
    version: "1.0.0",
    description: "Synthetic-only integrity adapter metadata. It is never executed by Phase B.",
    adapterType: "synthetic_test",
    supportedScopes: [
      {
        ...syntheticPhaseBIdentity,
        fileSizeBytes: syntheticPhaseBConstants.fileSizeBytes,
        segmentManifestDigestSha256: syntheticPhaseBConstants.segmentManifestDigestSha256,
      },
    ],
    execution: {
      entrypointType: "metadata_registry_only",
      executableOrImageDigestSha256:
        "0000000000000000000000000000000000000000000000000000000000000000",
    },
    approvalState: "internal_test_approved",
    revocation: {
      revoked: false,
    },
  },
} satisfies Omit<DtcIntegrityAdapterDocument, "contentDigest">);

function makeSyntheticRule(input: {
  code: "P0100" | "P0300";
  stableRuleKey: string;
  internalEventId: number;
  primaryStart: number;
  primaryTargetOffset: number;
  linkedStart: number;
  linkedTargetOffset: number;
  primaryExpectedHex: string;
  linkedExpectedHex: string;
}) {
  return attachContentDigest({
    schemaVersion: "2.0.0",
    canonicalization: "RFC8785-JCS",
    digestAlgorithm: "SHA-256",
    ruleBody: {
      stableRuleKey: input.stableRuleKey,
      version: "1.0.0",
      description: `Synthetic-only coordinated dry-run rule for ${input.code}. Not valid for production ECU files.`,
      representation: {
        containerType: "raw_synthetic",
        payloadRole: "synthetic_fixture",
        readRepresentation: "synthetic",
        fileSizeBytes: syntheticPhaseBConstants.fileSizeBytes,
        segmentManifestDigestSha256: syntheticPhaseBConstants.segmentManifestDigestSha256,
      },
      ecuIdentity: syntheticPhaseBIdentity,
      sourcePredicates: {
        acceptedSourceSha256: [syntheticPhaseBConstants.sourceSha256],
        identityDigestSha256: syntheticPhaseBConstants.identityDigestSha256,
        allowedSourceLineage: ["synthetic_fixture"],
      },
      dtc: {
        namespace: "SYNTHETIC",
        externalCode: input.code,
        riskCategory: "synthetic_test_only",
        internalEventId: input.internalEventId,
      },
      primaryStructureRef: "fixture.dtc-record-table",
      linkedStructureRefs: ["fixture.reporting-status-table"],
      strategyType: "synthetic_test",
      sourceExpectations: [
        {
          expectationType: "exact_bytes",
          target: {
            kind: "absolute_file_offset",
            regionRef: "fixture.dtc-record-table",
            absoluteOffset: input.primaryStart,
            alignment: 1,
          },
          lengthBytes: 16,
          expectedHex: input.primaryExpectedHex,
        },
        {
          expectationType: "exact_bytes",
          target: {
            kind: "absolute_file_offset",
            regionRef: "fixture.reporting-status-table",
            absoluteOffset: input.linkedStart,
            alignment: 1,
          },
          lengthBytes: 8,
          expectedHex: input.linkedExpectedHex,
        },
      ],
      operations: [
        {
          type: "coordinated_multi_structure_operation",
          operationId: `fixture.${input.code.toLowerCase()}.coordinated-disable`,
          atomic: true,
          semanticReason: "The synthetic fixture requires primary and linked flags to change atomically.",
          operations: [
            {
              type: "write_bitfield",
              operationId: `fixture.${input.code.toLowerCase()}.primary-enabled`,
              target: {
                kind: "absolute_file_offset",
                regionRef: "fixture.dtc-record-table",
                absoluteOffset: input.primaryTargetOffset,
                alignment: 1,
              },
              expectedOldHex: "01",
              newValueHex: "00",
              widthBytes: 1,
              allowedRegionRef: `fixture.semantic.${input.code.toLowerCase()}.primary`,
              sourceContext: [
                {
                  expectationType: "exact_bytes",
                  target: {
                    kind: "absolute_file_offset",
                    regionRef: "fixture.dtc-record-table",
                    absoluteOffset: input.primaryStart,
                    alignment: 1,
                  },
                  lengthBytes: 16,
                  expectedHex: input.primaryExpectedHex,
                },
              ],
              semanticReason: "Synthetic dry-run primary record enable flag would be cleared.",
            },
            {
              type: "write_enum",
              operationId: `fixture.${input.code.toLowerCase()}.linked-reporting`,
              target: {
                kind: "absolute_file_offset",
                regionRef: "fixture.reporting-status-table",
                absoluteOffset: input.linkedTargetOffset,
                alignment: 1,
              },
              expectedOldHex: "01",
              newValueHex: "00",
              widthBytes: 1,
              allowedRegionRef: `fixture.semantic.${input.code.toLowerCase()}.linked`,
              sourceContext: [
                {
                  expectationType: "exact_bytes",
                  target: {
                    kind: "absolute_file_offset",
                    regionRef: "fixture.reporting-status-table",
                    absoluteOffset: input.linkedStart,
                    alignment: 1,
                  },
                  lengthBytes: 8,
                  expectedHex: input.linkedExpectedHex,
                },
              ],
              semanticReason: "Synthetic dry-run linked reporting state would be cleared.",
            },
          ],
        },
      ],
      outputAllowlist: {
        semanticRegions: [
          {
            regionRef: `fixture.semantic.${input.code.toLowerCase()}.primary`,
            start: input.primaryTargetOffset,
            length: 1,
          },
          {
            regionRef: `fixture.semantic.${input.code.toLowerCase()}.linked`,
            start: input.linkedTargetOffset,
            length: 1,
          },
        ],
        integrityRegions: [
          {
            regionRef: "fixture.integrity.crc32",
            start: 4092,
            length: 4,
          },
        ],
        maximumChangedBytes: 6,
        allowNoOp: false,
      },
      integrityAdapterRef: {
        stableAdapterKey: syntheticIntegrityAdapter.adapterBody.stableAdapterKey,
        version: syntheticIntegrityAdapter.adapterBody.version,
        contentDigest: syntheticIntegrityAdapter.contentDigest,
      },
      approvalState: "internal_test_approved",
      revocation: {
        revoked: false,
      },
    },
  } satisfies Omit<DtcRuleDocument, "contentDigest">);
}

export const syntheticRuleP0100 = makeSyntheticRule({
  code: "P0100",
  stableRuleKey: "mg.synthetic.dtc-fixture.p0100.disable",
  internalEventId: 1001,
  primaryStart: 512,
  primaryTargetOffset: 516,
  linkedStart: 768,
  linkedTargetOffset: 770,
  primaryExpectedHex: "0001E9030102010000000000A5A5A5A5",
  linkedExpectedHex: "E90301000000C0D7",
});

export const syntheticRuleP0300 = makeSyntheticRule({
  code: "P0300",
  stableRuleKey: "mg.synthetic.dtc-fixture.p0300.disable",
  internalEventId: 1003,
  primaryStart: 544,
  primaryTargetOffset: 548,
  linkedStart: 784,
  linkedTargetOffset: 786,
  primaryExpectedHex: "0003EB030102010000000000A5A5A5A5",
  linkedExpectedHex: "EB0301000200C0D7",
});

export const syntheticGoldenCorpus = attachManifestDigest({
  schemaVersion: "2.0.0",
  stableCorpusKey: "mg.synthetic.dtc-fixture.corpus",
  version: "1.0.0",
  description: "Synthetic-only Phase B golden corpus. It contains metadata expectations, not firmware bytes.",
  ruleRefs: [
    {
      stableRuleKey: syntheticRuleP0100.ruleBody.stableRuleKey,
      version: syntheticRuleP0100.ruleBody.version,
      contentDigest: syntheticRuleP0100.contentDigest,
    },
    {
      stableRuleKey: syntheticRuleP0300.ruleBody.stableRuleKey,
      version: syntheticRuleP0300.ruleBody.version,
      contentDigest: syntheticRuleP0300.contentDigest,
    },
  ],
  adapterRefs: [
    {
      stableAdapterKey: syntheticIntegrityAdapter.adapterBody.stableAdapterKey,
      version: syntheticIntegrityAdapter.adapterBody.version,
      contentDigest: syntheticIntegrityAdapter.contentDigest,
    },
  ],
  cases: [
    makeCase("p0100", "positive_single", syntheticPhaseBConstants.sourceSha256, ["P0100"], true, [
      "fixture.p0100.coordinated-disable",
    ]),
    makeCase("p0300", "positive_single", syntheticPhaseBConstants.sourceSha256, ["P0300"], true, [
      "fixture.p0300.coordinated-disable",
    ]),
    makeCase("p0100-p0300", "positive_multi", syntheticPhaseBConstants.sourceSha256, ["P0100", "P0300"], true, [
      "fixture.p0100.coordinated-disable",
      "fixture.p0300.coordinated-disable",
    ]),
    makeCase("noop-roundtrip", "noop_roundtrip", syntheticPhaseBConstants.sourceSha256, [], true, []),
    makeCase("wrong-sw", "wrong_sw", syntheticPhaseBConstants.wrongSwSha256, ["P0100"], false, [], "EXACT_SW_NOT_ESTABLISHED"),
    makeCase("wrong-role", "wrong_role", syntheticPhaseBConstants.wrongRoleSha256, ["P0100"], false, [], "FILE_ROLE_UNKNOWN"),
    makeCase("source-mismatch", "source_mismatch", syntheticPhaseBConstants.sourceMismatchSha256, ["P0100"], false, [], "SOURCE_BYTES_MISMATCH"),
    makeCase("missing-linked", "missing_linked", syntheticPhaseBConstants.missingLinkedSha256, ["P0100"], false, [], "MISSING_LINKED_STRUCTURE"),
    makeCase("already-modified", "already_modified", syntheticPhaseBConstants.alreadyModifiedSha256, ["P0100"], false, [], "PREVIOUSLY_MODIFIED_INPUT"),
    makeCase("corrupt", "corrupt", syntheticPhaseBConstants.corruptSha256, ["P0100"], false, [], "SOURCE_INTEGRITY_FAILED"),
  ],
  releaseThresholds: {
    positivePassRate: 1,
    negativeRejectionRate: 1,
    unexpectedChangedBytesMaximum: 0,
    nondeterministicMismatchesMaximum: 0,
    unresolvedConflictsMaximum: 0,
  },
} satisfies Omit<DtcGoldenCorpusManifest, "manifestDigestSha256">);

function makeCase(
  caseKey: string,
  caseType: DtcGoldenCorpusManifest["cases"][number]["caseType"],
  sha256: string,
  requestedCodes: string[],
  success: boolean,
  expectedOperationIds: string[],
  expectedErrorCode?: DtcGoldenCorpusManifest["cases"][number]["expectedResult"]["expectedErrorCode"]
): DtcGoldenCorpusManifest["cases"][number] {
  return {
    caseKey,
    caseType,
    sourceArtifact: {
      relativePath: `${caseKey}.bin`,
      sha256,
      byteSize: syntheticPhaseBConstants.fileSizeBytes,
    },
    requestedCodes,
    expectedResult: {
      success,
      expectedOperationIds,
      expectedErrorCode,
      validationOutcome: success ? "pass" : "reject",
    },
  };
}

export function buildSyntheticPhaseBFixtureSet() {
  return {
    rules: [syntheticRuleP0100, syntheticRuleP0300],
    adapters: [syntheticIntegrityAdapter],
    corpus: syntheticGoldenCorpus,
  };
}
