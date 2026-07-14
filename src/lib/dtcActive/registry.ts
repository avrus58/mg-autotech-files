import { canonicalDocumentDigest, documentWithoutDigest } from "@/lib/dtcActive/canonicalJson";
import { buildSyntheticPhaseBFixtureSet } from "@/lib/dtcActive/fixtures";
import type {
  DtcGoldenCorpusManifest,
  DtcIntegrityAdapterDocument,
  DtcPhaseBIdentity,
  DtcRuleDocument,
} from "@/lib/dtcActive/phaseBTypes";
import {
  dtcGoldenCorpusManifestSchema,
  dtcIntegrityAdapterDocumentSchema,
  dtcRuleDocumentSchema,
  validateDtcDocument,
} from "@/lib/dtcActive/schemas";
import type { DtcActiveHardVetoCode } from "@/lib/dtcActive/types";

export type DtcPhaseBRegistry = {
  rules: DtcRuleDocument[];
  adapters: DtcIntegrityAdapterDocument[];
  corpus: DtcGoldenCorpusManifest;
};

export type DtcRegistryResolution<T> =
  | { ok: true; item: T; hardVetoes: [] }
  | { ok: false; item: null; hardVetoes: DtcActiveHardVetoCode[] };

export function buildSyntheticPhaseBRegistry(): DtcPhaseBRegistry {
  const fixtureSet = buildSyntheticPhaseBFixtureSet();
  validateRegistryOrThrow(fixtureSet);
  return fixtureSet;
}

export function validateRegistryOrThrow(registry: DtcPhaseBRegistry) {
  for (const rule of registry.rules) {
    const validation = validateDtcDocument(dtcRuleDocumentSchema, rule);
    if (!validation.ok) throw new Error(`DTC rule schema invalid: ${validation.errors.join("; ")}`);
    assertDocumentDigestMatches(rule, "contentDigest");
  }

  for (const adapter of registry.adapters) {
    const validation = validateDtcDocument(dtcIntegrityAdapterDocumentSchema, adapter);
    if (!validation.ok) throw new Error(`DTC adapter schema invalid: ${validation.errors.join("; ")}`);
    assertDocumentDigestMatches(adapter, "contentDigest");
  }

  const corpusValidation = validateDtcDocument(dtcGoldenCorpusManifestSchema, registry.corpus);
  if (!corpusValidation.ok) {
    throw new Error(`DTC golden corpus schema invalid: ${corpusValidation.errors.join("; ")}`);
  }
  assertCorpusManifestDigestMatches(registry.corpus);
}

export function assertDocumentDigestMatches(
  document: { contentDigest: string },
  digestKey: "contentDigest"
) {
  const expected = canonicalDocumentDigest(documentWithoutDigest(document as Record<string, unknown>, digestKey));
  if (document.contentDigest !== expected) {
    throw new Error(`DTC document digest mismatch: expected ${expected}, received ${document.contentDigest}.`);
  }
}

export function assertCorpusManifestDigestMatches(corpus: DtcGoldenCorpusManifest) {
  const expected = canonicalDocumentDigest(
    documentWithoutDigest(corpus as unknown as Record<string, unknown>, "manifestDigestSha256")
  ).replace(/^sha256:/, "");
  if (corpus.manifestDigestSha256 !== expected) {
    throw new Error(`DTC corpus digest mismatch: expected ${expected}, received ${corpus.manifestDigestSha256}.`);
  }
}

export function identityMatches(
  left: DtcPhaseBIdentity,
  right: DtcPhaseBIdentity
) {
  return (
    left.supplier === right.supplier &&
    left.family === right.family &&
    left.ecuType === right.ecuType &&
    left.hardwareNumber === right.hardwareNumber &&
    left.softwareNumber === right.softwareNumber &&
    left.calibrationId === right.calibrationId &&
    left.processorArchitecture === right.processorArchitecture
  );
}

export function resolveExactDtcRule(
  registry: DtcPhaseBRegistry,
  input: {
    code: string;
    identity: DtcPhaseBIdentity;
    sourceSha256: string;
    segmentManifestDigestSha256: string;
    fileSizeBytes: number;
  }
): DtcRegistryResolution<DtcRuleDocument> {
  const matches = registry.rules.filter((rule) => {
    return (
      rule.ruleBody.dtc.externalCode === input.code &&
      identityMatches(rule.ruleBody.ecuIdentity, input.identity) &&
      rule.ruleBody.representation.fileSizeBytes === input.fileSizeBytes &&
      rule.ruleBody.representation.segmentManifestDigestSha256 === input.segmentManifestDigestSha256 &&
      rule.ruleBody.sourcePredicates.acceptedSourceSha256.includes(input.sourceSha256)
    );
  });

  if (matches.length === 0) return { ok: false, item: null, hardVetoes: ["EXACT_SW_NOT_ESTABLISHED"] };
  if (matches.length > 1) return { ok: false, item: null, hardVetoes: ["DUPLICATE_OR_AMBIGUOUS_MATCH"] };

  const [rule] = matches;
  if (rule.ruleBody.revocation.revoked || rule.ruleBody.approvalState === "revoked") {
    return { ok: false, item: null, hardVetoes: ["RULE_REVOKED"] };
  }
  if (!isApprovedForSyntheticDryRun(rule.ruleBody.approvalState)) {
    return { ok: false, item: null, hardVetoes: ["RULE_NOT_APPROVED"] };
  }

  return { ok: true, item: rule, hardVetoes: [] };
}

export function resolveExactIntegrityAdapter(
  registry: DtcPhaseBRegistry,
  ref: DtcRuleDocument["ruleBody"]["integrityAdapterRef"],
  identity: DtcPhaseBIdentity,
  fileSizeBytes: number,
  segmentManifestDigestSha256: string
): DtcRegistryResolution<DtcIntegrityAdapterDocument> {
  const matches = registry.adapters.filter((adapter) => {
    return (
      adapter.adapterBody.stableAdapterKey === ref.stableAdapterKey &&
      adapter.adapterBody.version === ref.version &&
      adapter.contentDigest === ref.contentDigest &&
      adapter.adapterBody.supportedScopes.some((scope) => (
        identityMatches(scope, identity) &&
        scope.fileSizeBytes === fileSizeBytes &&
        scope.segmentManifestDigestSha256 === segmentManifestDigestSha256
      ))
    );
  });

  if (matches.length === 0) return { ok: false, item: null, hardVetoes: ["UNSUPPORTED_CHECKSUM"] };
  if (matches.length > 1) return { ok: false, item: null, hardVetoes: ["DUPLICATE_OR_AMBIGUOUS_MATCH"] };

  const [adapter] = matches;
  if (adapter.adapterBody.revocation.revoked || adapter.adapterBody.approvalState === "revoked") {
    return { ok: false, item: null, hardVetoes: ["ADAPTER_REVOKED"] };
  }
  if (!isApprovedForSyntheticDryRun(adapter.adapterBody.approvalState)) {
    return { ok: false, item: null, hardVetoes: ["ADAPTER_NOT_APPROVED"] };
  }

  return { ok: true, item: adapter, hardVetoes: [] };
}

function isApprovedForSyntheticDryRun(approvalState: string) {
  return approvalState === "internal_test_approved" || approvalState === "human_verified";
}

export function cloneRegistryWith(
  registry: DtcPhaseBRegistry,
  override: Partial<DtcPhaseBRegistry>
): DtcPhaseBRegistry {
  return {
    rules: override.rules ?? registry.rules,
    adapters: override.adapters ?? registry.adapters,
    corpus: override.corpus ?? registry.corpus,
  };
}
