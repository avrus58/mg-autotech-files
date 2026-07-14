import { z } from "zod";

const semver = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/;
const sha256 = /^[0-9a-f]{64}$/;
const contentDigest = /^sha256:[0-9a-f]{64}$/;
const dtcCode = /^[PBCU][0-9A-F]{4}$/;
const hexBytes = /^(?:[0-9A-F]{2})+$/i;
const forbiddenExecutableKeys = /^(script|shell|command|javascript|wasm|native|dll|exe|powershell|postinstall)$/i;

export type DtcSchemaValidationResult<T> =
  | { ok: true; data: T; errors: [] }
  | { ok: false; data: null; errors: string[] };

const targetSchema = z.object({
  kind: z.literal("absolute_file_offset"),
  regionRef: z.string().min(1),
  absoluteOffset: z.number().int().nonnegative(),
  alignment: z.number().int().positive(),
}).strict();

const sourceExpectationSchema = z.object({
  expectationType: z.literal("exact_bytes"),
  target: targetSchema,
  lengthBytes: z.number().int().positive(),
  expectedHex: z.string().regex(hexBytes),
}).strict();

const leafOperationSchema = z.object({
  type: z.enum(["write_bitfield", "write_enum"]),
  operationId: z.string().min(1),
  target: targetSchema,
  expectedOldHex: z.string().regex(hexBytes),
  newValueHex: z.string().regex(hexBytes),
  widthBytes: z.number().int().positive(),
  allowedRegionRef: z.string().min(1),
  sourceContext: z.array(sourceExpectationSchema).min(1),
  semanticReason: z.string().min(10),
}).strict();

const coordinatedOperationSchema = z.object({
  type: z.literal("coordinated_multi_structure_operation"),
  operationId: z.string().min(1),
  atomic: z.literal(true),
  semanticReason: z.string().min(10),
  operations: z.array(leafOperationSchema).min(1),
}).strict();

const operationSchema = z.union([leafOperationSchema, coordinatedOperationSchema]);

const identitySchema = z.object({
  supplier: z.string().min(1),
  family: z.string().min(1),
  ecuType: z.string().min(1),
  hardwareNumber: z.string().min(1),
  softwareNumber: z.string().min(1),
  calibrationId: z.string().min(1),
  processorArchitecture: z.string().min(1),
}).strict();

const representationSchema = z.object({
  containerType: z.literal("raw_synthetic"),
  payloadRole: z.literal("synthetic_fixture"),
  readRepresentation: z.literal("synthetic"),
  fileSizeBytes: z.number().int().positive(),
  segmentManifestDigestSha256: z.string().regex(sha256),
}).strict();

const regionSchema = z.object({
  regionRef: z.string().min(1),
  start: z.number().int().nonnegative(),
  length: z.number().int().positive(),
}).strict();

const approvalStateSchema = z.enum([
  "draft",
  "candidate",
  "internal_test_approved",
  "human_verified",
  "automation_approved",
  "mature_approved",
  "revoked",
]);

export const dtcRuleDocumentSchema = z.object({
  schemaVersion: z.literal("2.0.0"),
  canonicalization: z.literal("RFC8785-JCS"),
  digestAlgorithm: z.literal("SHA-256"),
  ruleBody: z.object({
    stableRuleKey: z.string().min(3),
    version: z.string().regex(semver),
    description: z.string().min(20),
    representation: representationSchema,
    ecuIdentity: identitySchema,
    sourcePredicates: z.object({
      acceptedSourceSha256: z.array(z.string().regex(sha256)).min(1),
      identityDigestSha256: z.string().regex(sha256),
      allowedSourceLineage: z.tuple([z.literal("synthetic_fixture")]),
    }).strict(),
    dtc: z.object({
      namespace: z.literal("SYNTHETIC"),
      externalCode: z.string().regex(dtcCode),
      riskCategory: z.literal("synthetic_test_only"),
      internalEventId: z.number().int().positive(),
    }).strict(),
    primaryStructureRef: z.string().min(1),
    linkedStructureRefs: z.array(z.string().min(1)),
    strategyType: z.literal("synthetic_test"),
    sourceExpectations: z.array(sourceExpectationSchema).min(1),
    operations: z.array(operationSchema).min(1),
    outputAllowlist: z.object({
      semanticRegions: z.array(regionSchema).min(1),
      integrityRegions: z.array(regionSchema),
      maximumChangedBytes: z.number().int().positive(),
      allowNoOp: z.boolean(),
    }).strict(),
    integrityAdapterRef: z.object({
      stableAdapterKey: z.string().min(3),
      version: z.string().regex(semver),
      contentDigest: z.string().regex(contentDigest),
    }).strict(),
    approvalState: approvalStateSchema,
    revocation: z.object({
      revoked: z.boolean(),
      reason: z.string().optional(),
    }).strict(),
  }).strict(),
  contentDigest: z.string().regex(contentDigest),
}).strict();

export const dtcIntegrityAdapterDocumentSchema = z.object({
  schemaVersion: z.literal("2.0.0"),
  canonicalization: z.literal("RFC8785-JCS"),
  digestAlgorithm: z.literal("SHA-256"),
  adapterBody: z.object({
    stableAdapterKey: z.string().min(3),
    version: z.string().regex(semver),
    description: z.string().min(20),
    adapterType: z.literal("synthetic_test"),
    supportedScopes: z.array(identitySchema.extend({
      fileSizeBytes: z.number().int().positive(),
      segmentManifestDigestSha256: z.string().regex(sha256),
    }).strict()).min(1),
    execution: z.object({
      entrypointType: z.literal("metadata_registry_only"),
      executableOrImageDigestSha256: z.string().regex(sha256),
    }).strict(),
    approvalState: approvalStateSchema,
    revocation: z.object({
      revoked: z.boolean(),
      reason: z.string().optional(),
    }).strict(),
  }).strict(),
  contentDigest: z.string().regex(contentDigest),
}).strict();

export const dtcGoldenCorpusManifestSchema = z.object({
  schemaVersion: z.literal("2.0.0"),
  stableCorpusKey: z.string().min(3),
  version: z.string().regex(semver),
  description: z.string().min(20),
  ruleRefs: z.array(z.object({
    stableRuleKey: z.string().min(3),
    version: z.string().regex(semver),
    contentDigest: z.string().regex(contentDigest),
  }).strict()).min(1),
  adapterRefs: z.array(z.object({
    stableAdapterKey: z.string().min(3),
    version: z.string().regex(semver),
    contentDigest: z.string().regex(contentDigest),
  }).strict()).min(1),
  cases: z.array(z.object({
    caseKey: z.string().min(1),
    caseType: z.enum([
      "positive_single",
      "positive_multi",
      "noop_roundtrip",
      "wrong_sw",
      "wrong_role",
      "source_mismatch",
      "missing_linked",
      "already_modified",
      "corrupt",
    ]),
    sourceArtifact: z.object({
      relativePath: z.string().min(1),
      sha256: z.string().regex(sha256),
      byteSize: z.number().int().positive(),
    }).strict(),
    requestedCodes: z.array(z.string().regex(dtcCode)),
    expectedResult: z.object({
      success: z.boolean(),
      expectedOperationIds: z.array(z.string()).optional(),
      expectedErrorCode: z.string().optional(),
      validationOutcome: z.enum(["pass", "reject"]),
    }).strict(),
  }).strict()).min(1),
  releaseThresholds: z.object({
    positivePassRate: z.number().min(0).max(1),
    negativeRejectionRate: z.number().min(0).max(1),
    unexpectedChangedBytesMaximum: z.number().int().nonnegative(),
    nondeterministicMismatchesMaximum: z.number().int().nonnegative(),
    unresolvedConflictsMaximum: z.number().int().nonnegative(),
  }).strict(),
  manifestDigestSha256: z.string().regex(sha256),
}).strict();

export function assertNoExecutableDocumentFields(value: unknown) {
  const seen = new WeakSet<object>();

  function visit(node: unknown, path: string): string | null {
    if (!node || typeof node !== "object") return null;
    if (seen.has(node)) return null;
    seen.add(node);

    for (const [key, child] of Object.entries(node)) {
      if (forbiddenExecutableKeys.test(key)) return `${path}.${key}`;
      const nested = visit(child, `${path}.${key}`);
      if (nested) return nested;
    }
    return null;
  }

  const forbiddenPath = visit(value, "$");
  if (forbiddenPath) {
    throw new Error(`Executable or arbitrary-script field rejected at ${forbiddenPath}.`);
  }
}

export function validateDtcDocument<T>(
  schema: z.ZodType<T>,
  value: unknown
): DtcSchemaValidationResult<T> {
  try {
    assertNoExecutableDocumentFields(value);
    const parsed = schema.parse(value);
    return { ok: true, data: parsed, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        ok: false,
        data: null,
        errors: error.issues.map((issue) => `${issue.path.join(".") || "$"}: ${issue.message}`),
      };
    }
    return {
      ok: false,
      data: null,
      errors: [error instanceof Error ? error.message : "Unknown validation error"],
    };
  }
}
