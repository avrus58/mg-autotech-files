import { compileSyntheticDtcDryRun } from "@/lib/dtcActive/dryRunCompiler";
import { syntheticPhaseBConstants, syntheticPhaseBIdentity } from "@/lib/dtcActive/fixtures";
import { buildDtcActiveModes, dtcActiveContractVersion, dtcActivePolicyVersion, resolveDtcActiveFeatureFlags } from "@/lib/dtcActive/policy";
import { buildSyntheticPhaseBRegistry } from "@/lib/dtcActive/registry";
import { runSyntheticPhaseCGoldenCorpus, phaseCExpectedHashes } from "@/lib/dtcActive/syntheticProcessingEngine";
import type { DtcActiveFoundationStatus } from "@/lib/dtcActive/types";

export function buildDtcActiveFoundationStatus(
  env: NodeJS.ProcessEnv = process.env
): DtcActiveFoundationStatus {
  const effectiveFlags = resolveDtcActiveFeatureFlags(env);
  const phaseBRegistry = buildSyntheticPhaseBRegistry();
  const phaseBSampleReport = compileSyntheticDtcDryRun(
    {
      requestId: "synthetic-phase-b-sample",
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
      },
      requestedCodes: ["P0100"],
    },
    {
      registry: phaseBRegistry,
      flags: {
        ...effectiveFlags,
        dtcInternalTestProcessing: true,
        dtcSyntheticFixtures: true,
        globalDtcKillSwitchEngaged: false,
      },
    }
  );
  const positiveCorpusCases = phaseBRegistry.corpus.cases.filter((corpusCase) => corpusCase.expectedResult.success).length;
  const phaseCGoldenCorpus = runSyntheticPhaseCGoldenCorpus({
    flags: {
      ...effectiveFlags,
      dtcInternalTestProcessing: true,
      dtcSyntheticFixtures: true,
      globalDtcKillSwitchEngaged: false,
    },
  });

  return {
    contractVersion: dtcActiveContractVersion,
    phase: "A",
    policyVersion: dtcActivePolicyVersion,
    repositoryMode: "read_only_foundation",
    serverAuthority: true,
    customerDeliveryEnabled: false,
    realEcuRulesEnabled: false,
    checksumAdaptersEnabled: false,
    productionAutomationEnabled: false,
    effectiveFlags,
    modes: buildDtcActiveModes(effectiveFlags),
    disabledCapabilities: [
      "customer delivery",
      "A3 production processing",
      "A4/A5 automation",
      "real ECU byte rules",
      "real checksum or signature adapters",
      "real integrity adapter execution",
      "desktop/client-side firmware processing",
      "publication grants",
      "rule promotion or revocation actions",
    ],
    safeCapabilities: [
      "repository reconciliation",
      "policy and feature flag status",
      "customer-safe DTC status projection",
      "admin-only foundation visibility",
      "draft migration reconciliation notes",
      "unsupported real-scope register",
      "Phase B synthetic rule registry validation",
      "Phase B metadata-only adapter registry validation",
      "Phase B dry-run processing reports",
      "Phase B golden corpus regression harness",
    ],
    adminPermission: "ai_training.manage",
    migration: {
      status: "database_verified_local_not_production_applied",
      file: "scripts/add-dtc-active-processing-phase-a.sql",
      localVerification: "database_verified_local_disposable",
    },
    researchPackage: {
      sourcePath: "mg-autotech-dtc-active-processing-v2",
      hashManifestPath: "docs/dtc-active/research-package/SHA256SUMS.txt",
      packageManifestPath: "docs/dtc-active/research-package/PACKAGE_MANIFEST.json",
    },
    phaseB: {
      status: "synthetic_dry_run_foundation",
      syntheticOnly: true,
      ruleCount: phaseBRegistry.rules.length,
      adapterCount: phaseBRegistry.adapters.length,
      corpusCaseCount: phaseBRegistry.corpus.cases.length,
      positiveCorpusCases,
      negativeCorpusCases: phaseBRegistry.corpus.cases.length - positiveCorpusCases,
      dryRunReportsEnabled: true,
      firmwareMutationEnabled: false,
      outputArtifactGenerationEnabled: false,
      integrityAdapterExecutionEnabled: false,
      customerDeliveryEnabled: false,
      sampleReport: {
        success: phaseBSampleReport.success,
        requestedCodes: phaseBSampleReport.requestedCodes,
        operationCount: phaseBSampleReport.operationPlan.length,
        hardVetoes: phaseBSampleReport.hardVetoes,
        outputArtifactCreated: false,
        firmwareBytesMutated: false,
      },
    },
    phaseC: {
      status: "synthetic_test_output_processing",
      syntheticOnly: true,
      generateTestOutputEnabled: false,
      artifactGenerationScope: "internal_synthetic_test_only",
      sourceSha256: phaseCExpectedHashes.source,
      p0100PreIntegritySha256: phaseCExpectedHashes.p0100PreIntegrity,
      p0100FinalSha256: phaseCExpectedHashes.p0100Final,
      combinedPreIntegritySha256: phaseCExpectedHashes.combinedPreIntegrity,
      combinedFinalSha256: phaseCExpectedHashes.combinedFinal,
      goldenCorpusCases: phaseCGoldenCorpus.totalCases,
      goldenCorpusPassed: phaseCGoldenCorpus.passedCases,
      customerDeliveryEnabled: false,
      realEcuFilesProcessed: false,
      nativeChecksumExecutionEnabled: false,
    },
  };
}
