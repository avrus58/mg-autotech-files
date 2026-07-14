import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  buildDtcCorpusReadinessReport,
  type DtcCorpusEvidenceItem,
} from "@/lib/dtcActive";

const ORI_A = "a".repeat(64);
const ORI_B = "b".repeat(64);
const ORI_C = "c".repeat(64);
const MOD_A = "d".repeat(64);
const MOD_B = "e".repeat(64);
const MOD_C = "f".repeat(64);

function readyEvidence(index: number, overrides: Partial<DtcCorpusEvidenceItem> = {}): DtcCorpusEvidenceItem {
  return {
    id: `evidence-${index}`,
    sourceKind: "training_sample",
    ecuSupplier: "Bosch",
    ecuFamily: "EDC16U34",
    ecuType: "Bosch EDC16U34",
    hwNumber: "03G906021AB",
    swNumber: "1037391234",
    calibrationId: "EDC16U34-CAL-A",
    representationType: "full_flash",
    fileRole: "pair",
    fileSize: 2_097_152,
    segmentManifestDigest: "segment-manifest-edc16u34-a",
    readMethod: "bench",
    sourceProvenance: "authorized_lab",
    sourceAuthorizationQuality: "authorized_lab",
    originalHash: index % 2 === 0 ? ORI_A : ORI_B,
    modHash: index % 2 === 0 ? MOD_A : MOD_B,
    exactDtcLabels: ["P0100"],
    serviceLabels: ["dtc_off"],
    humanVerified: true,
    learningApproved: false,
    pairConfidence: 96,
    pairReviewStatus: "approved",
    pairIdentityConsistent: true,
    changedRegionSignature: "0x0204:0x0205:1:1|0x0302:0x0303:1:1",
    changedRegionConsistency: "consistent",
    unrelatedChange: false,
    checksumOnlyControl: index === 1,
    alreadyModifiedNegative: false,
    wrongPairNegative: false,
    preIntegrityAvailable: true,
    finalModAvailable: true,
    mapDefinitionAvailable: true,
    integrityEvidenceAvailable: true,
    benchVerified: true,
    successfulWriteReadback: true,
    rollbackVerified: true,
    conflictNotes: [],
    ...overrides,
  };
}

function firstCluster(items: DtcCorpusEvidenceItem[]) {
  const report = buildDtcCorpusReadinessReport(items, new Date("2026-07-15T00:00:00Z"));
  assert.ok(report.firstRecommendedLabCluster);
  return report.firstRecommendedLabCluster;
}

test("DTC corpus readiness clusters exact identities and can qualify a clean internal lab target", () => {
  const report = buildDtcCorpusReadinessReport([readyEvidence(0), readyEvidence(1)], new Date("2026-07-15T00:00:00Z"));

  assert.equal(report.clusters.length, 1);
  assert.equal(report.anyReadyForInternalRuleResearch, true);
  assert.equal(report.safety.readOnly, true);
  assert.equal(report.safety.firmwareBytesMutated, false);
  assert.equal(report.safety.outputArtifactsCreated, false);

  const cluster = report.firstRecommendedLabCluster;
  assert.ok(cluster);
  assert.equal(cluster.targetLabel, "Bosch EDC16U34");
  assert.equal(cluster.readinessState, "READY_FOR_INTERNAL_RULE_RESEARCH");
  assert.equal(cluster.identity.ecuSupplier, "Bosch");
  assert.equal(cluster.identity.hwNumber, "03G906021AB");
  assert.equal(cluster.identity.swNumber, "1037391234");
  assert.equal(cluster.identity.calibrationId, "EDC16U34-CAL-A");
  assert.equal(cluster.identity.representationType, "full_flash");
  assert.equal(cluster.identity.fileRole, "pair");
  assert.equal(cluster.identity.fileSize, 2_097_152);
  assert.equal(cluster.identity.segmentManifestDigest, "segment-manifest-edc16u34-a");
  assert.equal(cluster.identity.readMethod, "bench");
  assert.equal(cluster.identity.sourceProvenance, "authorized_lab");
  assert.equal(cluster.verifiedOriginalCount, 2);
  assert.equal(cluster.distinctSourceHashes, 2);
  assert.equal(cluster.exactDuplicateCount, 0);
  assert.equal(cluster.matchedOriModPairCount, 2);
  assert.equal(cluster.controlledOneDtcPairCount, 2);
  assert.equal(cluster.multiDtcPairCount, 0);
  assert.equal(cluster.preIntegrityModAvailability, 2);
  assert.equal(cluster.finalModAvailability, 2);
  assert.deepEqual(cluster.exactDtcLabels, ["P0100"]);
  assert.equal(cluster.changedRegionConsistency, "consistent");
  assert.equal(cluster.checksumOnlyControlCount, 1);
  assert.equal(cluster.mapDefinitionAvailability, 2);
  assert.equal(cluster.integrityEvidenceCount, 2);
  assert.equal(cluster.benchVerificationCount, 2);
  assert.equal(cluster.successfulWriteReadbackCount, 2);
  assert.equal(cluster.rollbackVerificationCount, 2);
  assert.deepEqual(cluster.conflicts, []);
});

test("DTC corpus readiness rejects mixed SW identities by splitting exact clusters", () => {
  const report = buildDtcCorpusReadinessReport([
    readyEvidence(0),
    readyEvidence(1, { swNumber: "1037399999", originalHash: ORI_C, modHash: MOD_C }),
  ]);

  assert.equal(report.clusters.length, 2);
  assert.deepEqual(new Set(report.clusters.map((cluster) => cluster.identity.swNumber)), new Set(["1037391234", "1037399999"]));
  assert.ok(report.clusters.every((cluster) => cluster.evidenceItemIds.length === 1));
});

test("DTC corpus readiness rejects mixed or invalid file-role evidence", () => {
  const report = buildDtcCorpusReadinessReport([
    readyEvidence(0),
    readyEvidence(1, { fileRole: "ori", modHash: null, exactDtcLabels: [] }),
    readyEvidence(2, { fileRole: "mod", originalHash: ORI_C, modHash: MOD_C }),
  ]);

  assert.equal(report.clusters.length, 3);
  const roles = new Set(report.clusters.map((cluster) => cluster.identity.fileRole));
  assert.deepEqual(roles, new Set(["pair", "ori", "mod"]));

  const modCluster = report.clusters.find((cluster) => cluster.identity.fileRole === "mod");
  assert.ok(modCluster);
  assert.equal(modCluster.readinessState, "CORPUS_CLEANUP_REQUIRED");
  assert.match(modCluster.conflicts.join("\n"), /Mixed or unknown file role/);
});

test("DTC corpus readiness normalizes duplicate source hashes and requires cleanup", () => {
  const cluster = firstCluster([
    readyEvidence(0, { originalHash: ORI_A }),
    readyEvidence(1, { originalHash: ORI_A, modHash: MOD_B }),
  ]);

  assert.equal(cluster.distinctSourceHashes, 1);
  assert.equal(cluster.exactDuplicateCount, 1);
  assert.equal(cluster.readinessState, "CORPUS_CLEANUP_REQUIRED");
  assert.match(cluster.conflicts.join("\n"), /duplicate source hashes/);
});

test("DTC corpus readiness rejects uncertain ORI/MOD pairs from controlled evidence counts", () => {
  const cluster = firstCluster([
    readyEvidence(0, {
      pairConfidence: 40,
      pairReviewStatus: "needs_review",
      sourceAuthorizationQuality: "trusted",
    }),
  ]);

  assert.equal(cluster.matchedOriModPairCount, 0);
  assert.equal(cluster.controlledOneDtcPairCount, 0);
  assert.equal(cluster.readinessState, "CONTROLLED_PAIR_REQUIRED");
  assert.ok(cluster.missingEvidence.includes("matched ORI/MOD pairs"));
});

test("DTC corpus readiness rejects unrelated changed-region evidence and explicit conflicts", () => {
  const cluster = firstCluster([
    readyEvidence(0),
    readyEvidence(1, {
      unrelatedChange: true,
      changedRegionConsistency: "inconsistent",
      conflictNotes: ["Manual conflict: unrelated boost map edit found"],
    }),
  ]);

  assert.equal(cluster.readinessState, "CORPUS_CLEANUP_REQUIRED");
  assert.match(cluster.conflicts.join("\n"), /Unrelated or inconsistent/);
  assert.match(cluster.conflicts.join("\n"), /unrelated boost map/i);
});

test("DTC corpus readiness flags missing provenance and authorization quality", () => {
  const cluster = firstCluster([
    readyEvidence(0, {
      sourceProvenance: null,
      sourceAuthorizationQuality: "unknown",
    }),
  ]);

  assert.equal(cluster.readinessState, "CORPUS_CLEANUP_REQUIRED");
  assert.ok(cluster.missingEvidence.includes("source provenance"));
  assert.ok(cluster.missingEvidence.includes("trusted provenance and authorization"));
});

test("DTC corpus readiness admin API is staff-only and customer access is denied by design", () => {
  const route = readFileSync(resolve(process.cwd(), "src", "app", "api", "admin", "dtc", "corpus-readiness", "route.ts"), "utf8");

  assert.match(route, /requireStaffPermission\(request,\s*"ai_training\.manage"\)/);
  assert.doesNotMatch(route, /requireApiUser/);
});

test("DTC corpus readiness code performs zero binary mutation and creates zero output artifacts", () => {
  const files = [
    "src/lib/dtcActive/corpusReadiness.ts",
    "src/lib/dtcActive/corpusReadinessData.ts",
    "src/app/api/admin/dtc/corpus-readiness/route.ts",
    "src/app/admin/dtc/corpus-readiness/page.tsx",
  ].map((file) => readFileSync(resolve(process.cwd(), file), "utf8").replace(/\s+/g, " "));

  const combined = files.join("\n");
  assert.doesNotMatch(combined, /\b(writeFile|createWriteStream|putArtifact|generateSyntheticDtcTestOutput|applySyntheticCrc32)\s*\(/);
  assert.doesNotMatch(combined, /storage\.from|\.insert\(|\.update\(|\.delete\(|upsert\(/);

  const report = buildDtcCorpusReadinessReport([readyEvidence(0), readyEvidence(1)]);
  assert.equal(report.safety.firmwareBytesMutated, false);
  assert.equal(report.safety.outputArtifactsCreated, false);
  assert.equal(report.safety.phaseDCustomerProcessingStarted, false);
});
