import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  buildEcuIntelligenceClusters,
  buildOverviewMetrics,
  calculateClusterReadiness,
  calculateKnowledgeScore,
  canonicalizeClusterIdentity,
  normalizeDtcCodes,
  normalizeServiceEvidence,
} from "../src/lib/ecuIntelligence/center";
import type { EcuIntelligenceSourceRows } from "../src/lib/ecuIntelligence/center/types";

const root = process.cwd();

function file(path: string) {
  return readFileSync(join(root, path), "utf8");
}

function emptyRows(overrides: Partial<EcuIntelligenceSourceRows> = {}): EcuIntelligenceSourceRows {
  return {
    learningFiles: [],
    learningPairs: [],
    trainingSamples: [],
    datasetPairs: [],
    fileExpertJobs: [],
    patternSignatures: [],
    patternClusters: [],
    similarityResults: [],
    mapDefinitionSets: [],
    mapDefinitions: [],
    generationReadinessReports: [],
    ...overrides,
  };
}

test("ECU Intelligence cluster identity is versioned, exact and deterministic", () => {
  const identity = canonicalizeClusterIdentity({
    supplier: " Robert Bosch ",
    ecuFamily: "ME 7.5",
    ecuType: "ME 7.5.10",
    hwNumber: " HW 123 ",
    swNumber: " SW 456 ",
    calibrationId: " CAL 789 ",
    representationType: " bin ",
    fileRole: "Original",
    fileSize: 524288,
    readMethod: "Bench Read",
  });

  assert.equal(identity.version, "eci-cluster-v1");
  assert.equal(identity.supplier, "Bosch");
  assert.equal(identity.ecuFamily, "ME7.5");
  assert.equal(identity.fileRole, "ori");
  assert.match(identity.clusterKey, /^eci-cluster-v1:/);
  assert.equal(identity.missingFields.length, 0);

  const differentSw = canonicalizeClusterIdentity({ ...identity, swNumber: "SW 999" });
  assert.notEqual(identity.clusterKey, differentSw.clusterKey);
});

test("ECU Intelligence preserves unknown labels and separates exact DTC codes", () => {
  const evidence = normalizeServiceEvidence({
    labels: { stage1: true, dtc_off: true, strange_private_label: true },
    exactDtcCodes: ["p0401", "P2002", "bad"],
    sourceText: "Customer also mentions U0100.",
  });

  assert.deepEqual(evidence.categories.sort(), ["dtc", "stage_1", "unknown"].sort());
  assert.deepEqual(evidence.exactDtcCodes, ["P0401", "P2002", "U0100"]);
  assert.deepEqual(evidence.unknownLabels, ["strange_private_label"]);
  assert.deepEqual(normalizeDtcCodes("p0401 P0401 B1234"), ["P0401", "B1234"]);
});

test("ECU Intelligence readiness hard-blocks ambiguous or unauthorized evidence", () => {
  const identity = canonicalizeClusterIdentity({
    supplier: "Bosch",
    ecuFamily: "EDC16U34",
    ecuType: "EDC16U34",
    hwNumber: "HW1,HW2",
    swNumber: "SW1",
    representationType: "bin",
    fileRole: "ori",
    fileSize: 1048576,
    readMethod: "bench",
  });
  const readiness = calculateClusterReadiness({
    identity,
    fileCandidateCount: 3,
    pairCandidateCount: 2,
    approvedPairCount: 1,
    reviewedPairCount: 1,
    singleServicePairCount: 1,
    checksumOnlyPairCount: 0,
    approvedTrainingSampleCount: 1,
    patternClusterCount: 1,
    mapDefinitionSetCount: 1,
    conflictCount: 0,
    syntheticEvidenceCount: 0,
    unresolvedAuthorizationCount: 1,
    unknownServiceLabels: [],
  });

  assert.equal(readiness.state, "BLOCKED");
  assert.ok(readiness.hardBlockers.includes("ambiguous_identity"));
  assert.ok(readiness.hardBlockers.includes("authorization_gap"));
});

test("ECU Intelligence knowledge score exposes decomposition and blockers", () => {
  const score = calculateKnowledgeScore({
    identityCompleteness: 100,
    totalEvidenceCount: 8,
    uniqueSourceCount: 4,
    approvedPairCount: 2,
    singleServicePairCount: 2,
    patternClusterCount: 1,
    mapDefinitionSetCount: 1,
    humanVerifiedCount: 3,
    reviewedPairCount: 2,
    unresolvedAuthorizationCount: 0,
    conflictCount: 0,
    quarantineCount: 0,
    syntheticEvidenceCount: 0,
    hardBlockers: [],
  });

  assert.equal(score.version, "knowledge-score-v1");
  assert.ok(score.score >= 80);
  assert.equal(score.components.identityCompleteness, 100);
  assert.equal(score.components.authorizationCoverage, 100);
});

test("ECU Intelligence aggregates existing learning, training, pattern and map evidence without synthetic real-metric pollution", () => {
  const rows = emptyRows({
    learningFiles: [
      {
        id: "file-1",
        file_role_candidate: "ori",
        sha256: "a".repeat(64),
        supplier: "Bosch",
        ecu_family: "EDC17C50",
        ecu_type: "EDC17C50",
        hw_number: "HW1",
        sw_number: "SW1",
        representation_type: "bin",
        read_method: "bench",
        file_size: 2048,
        learning_authorization_status: "granted",
        requested_service_labels: { stage1: true },
        review_status: "pending_review",
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "synthetic-file",
        file_role_candidate: "ori",
        sha256: "b".repeat(64),
        supplier: "Bosch",
        ecu_family: "EDC17C50",
        source_type: "synthetic_fixture",
        created_at: "2026-01-02T00:00:00Z",
      },
    ],
    learningPairs: [
      {
        id: "pair-1",
        pair_identity_key: "Bosch|EDC17C50|EDC17C50|HW1|SW1|CAL1|bin|bench|2048",
        pair_type: "single_service_clean",
        review_status: "approved",
        learning_use_status: "approved_for_learning",
        learning_authorization_status: "granted",
        requested_service_labels: { stage1: true },
        performed_service_labels: { stage1: true },
        ori_sha256: "a".repeat(64),
        mod_sha256: "c".repeat(64),
        created_at: "2026-01-03T00:00:00Z",
      },
    ],
    trainingSamples: [
      {
        id: "sample-1",
        ecu_family: "EDC17C50",
        ecu_type: "EDC17C50",
        hw_number: "HW1",
        sw_number: "SW1",
        read_method: "bench",
        ori_file_size: 2048,
        ori_sha256: "a".repeat(64),
        mod_sha256: "c".repeat(64),
        learning_use_status: "approved_for_learning",
        human_verification_status: "confirmed",
        performed_service_labels: { stage1: true },
        created_at: "2026-01-04T00:00:00Z",
      },
    ],
    patternClusters: [
      {
        id: "cluster-pattern-1",
        ecu_family: "EDC17C50",
        ecu_type: "EDC17C50",
        hw_number: "HW1",
        sw_number: "SW1",
        feature_type: "stage1",
        approved_sample_count: 1,
        created_at: "2026-01-05T00:00:00Z",
      },
    ],
    mapDefinitionSets: [
      {
        id: "map-set-1",
        ecu_family: "EDC17C50",
        ecu_type: "EDC17C50",
        hw_number: "HW1",
        sw_number: "SW1",
        human_verified: true,
        created_at: "2026-01-06T00:00:00Z",
      },
    ],
  });

  const clusters = buildEcuIntelligenceClusters(rows);
  const metrics = buildOverviewMetrics(clusters, rows);
  assert.equal(metrics.learningFileCandidates, 2);
  assert.equal(metrics.exactClusterCount >= 1, true);
  assert.equal(metrics.approvedLearningPairs, 1);
  assert.equal(clusters.some((cluster) => cluster.syntheticEvidenceCount > 0), false);
  assert.ok(clusters[0].serviceCoverage.some((cell) => cell.category === "stage_1" && cell.approvedCount > 0));
});

test("ECU Intelligence admin APIs are staff-only and customer-safe", () => {
  const routeFiles = [
    "src/app/api/admin/ecu-intelligence/overview/route.ts",
    "src/app/api/admin/ecu-intelligence/clusters/route.ts",
    "src/app/api/admin/ecu-intelligence/clusters/[clusterId]/route.ts",
    "src/app/api/admin/ecu-intelligence/clusters/[clusterId]/graph/route.ts",
    "src/app/api/admin/ecu-intelligence/services/route.ts",
    "src/app/api/admin/ecu-intelligence/patterns/route.ts",
    "src/app/api/admin/ecu-intelligence/similarity/route.ts",
    "src/app/api/admin/ecu-intelligence/review/route.ts",
    "src/app/api/admin/ecu-intelligence/insights/route.ts",
    "src/app/api/admin/ecu-intelligence/backfill/route.ts",
    "src/app/api/admin/ecu-intelligence/refresh/route.ts",
  ];
  for (const path of routeFiles) {
    const source = file(path);
    assert.match(source, /requireStaffPermission\(request,\s*"ai_training\.manage"\)/, path);
    assert.doesNotMatch(source, /service_role|signed_url|raw_hex|firmware_bytes/i, path);
  }
  const server = file("src/lib/ecuIntelligence/center/server.ts");
  assert.doesNotMatch(server, /storage_path|ori_file_path|mod_file_path|customer_email|phone|address/i);
  assert.match(server, /refreshEnabled:\s*process\.env\.ECU_INTELLIGENCE_REFRESH_ENABLED === "true"/);
  assert.match(server, /firmwareGenerated:\s*false/);
});

test("ECU Intelligence UI pages deep-link existing systems instead of duplicating them", () => {
  const page = file("src/app/admin/ecu-intelligence/EcuIntelligenceShell.tsx");
  const detail = file("src/app/admin/ecu-intelligence/clusters/[clusterId]/page.tsx");
  const admin = file("src/app/admin/page.tsx");
  assert.match(page, /\/admin\/ecu-intelligence\/clusters/);
  assert.match(page, /\/admin\/ecu-intelligence\/backfill/);
  assert.match(detail, /\/admin\/ai-training\/corpus/);
  assert.match(detail, /\/admin\/dtc\/corpus-readiness/);
  assert.match(admin, /href="\/admin\/ecu-intelligence"/);
  assert.doesNotMatch(page + detail, /generate MOD|checksum adapter|customer delivery/i);
});
