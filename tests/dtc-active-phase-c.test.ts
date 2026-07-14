import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  DtcPhaseCInMemoryStore,
  phaseCRequestHash,
} from "@/lib/dtcActive/phaseCStore";
import {
  generateSyntheticDtcTestOutput,
  phaseCAuthorizationStatement,
  phaseCExpectedHashes,
  runSyntheticPhaseCGoldenCorpus,
} from "@/lib/dtcActive/syntheticProcessingEngine";
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

function readProjectFile(...parts: string[]) {
  return readFileSync(resolve(process.cwd(), ...parts), "utf8");
}

function stripSqlComments(sql: string) {
  return sql
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
}

function generate(codes: string[], store = new DtcPhaseCInMemoryStore(), idempotencyKey = `test-${codes.join("-") || "noop"}`) {
  return generateSyntheticDtcTestOutput({
    requestedCodes: codes,
    idempotencyKey,
    authorizationStatement: phaseCAuthorizationStatement,
    actorId: "00000000-0000-0000-0000-000000000001",
  }, {
    flags: enabledSyntheticFlags,
    store,
  });
}

test("DTC Phase C generates exact P0100 synthetic source, pre-integrity and final hashes", () => {
  const report = generate(["P0100"]);

  assert.equal(report.success, true);
  assert.equal(report.sourceSha256, phaseCExpectedHashes.source);
  assert.equal(report.preIntegritySha256, phaseCExpectedHashes.p0100PreIntegrity);
  assert.equal(report.finalSha256, phaseCExpectedHashes.p0100Final);
  assert.deepEqual(report.semanticChangedRegions.map((region) => [region.start, region.length]), [[516, 1], [770, 1]]);
  assert.deepEqual(report.integrityChangedRegions.map((region) => [region.start, region.length]), [[4092, 4]]);
  assert.equal(report.integrityAdapter.nativeExecutionUsed, false);
  assert.equal(report.integrityAdapter.realEcuChecksum, false);
  assert.equal(report.customerPublishable, false);
  assert.equal(report.customerDeliveryEnabled, false);
  assert.equal(report.outputArtifactsCustomerVisible, false);
});

test("DTC Phase C generates exact P0300 and combined synthetic golden outputs", () => {
  const p0300 = generate(["P0300"]);
  assert.equal(p0300.preIntegritySha256, phaseCExpectedHashes.p0300PreIntegrity);
  assert.equal(p0300.finalSha256, phaseCExpectedHashes.p0300Final);
  assert.deepEqual(p0300.semanticChangedRegions.map((region) => [region.start, region.length]), [[548, 1], [786, 1]]);

  const combined = generate(["P0300", "P0100"]);
  assert.equal(combined.preIntegritySha256, phaseCExpectedHashes.combinedPreIntegrity);
  assert.equal(combined.finalSha256, phaseCExpectedHashes.combinedFinal);
  assert.deepEqual(combined.semanticChangedRegions.map((region) => [region.start, region.length]), [
    [516, 1],
    [548, 1],
    [770, 1],
    [786, 1],
  ]);
  assert.deepEqual(combined.integrityChangedRegions.map((region) => [region.start, region.length]), [[4092, 4]]);
});

test("DTC Phase C no-op corpus case creates no changed regions and preserves source hash", () => {
  const report = generate([]);

  assert.equal(report.success, true);
  assert.equal(report.preIntegritySha256, phaseCExpectedHashes.source);
  assert.equal(report.finalSha256, phaseCExpectedHashes.source);
  assert.deepEqual(report.semanticChangedRegions, []);
  assert.deepEqual(report.integrityChangedRegions, []);
});

test("DTC Phase C golden corpus passes positive and negative synthetic cases", () => {
  const result = runSyntheticPhaseCGoldenCorpus({ flags: enabledSyntheticFlags });

  assert.equal(result.totalCases, 10);
  assert.equal(result.positiveCases, 4);
  assert.equal(result.negativeCases, 6);
  assert.equal(result.failedCases, 0);
  assert.equal(result.passedCases, 10);
  assert.equal(result.customerPublishableArtifacts, 0);
  assert.equal(result.realEcuFilesProcessed, false);
  assert.equal(result.customerFilesProcessed, false);
});

test("DTC Phase C fails closed when feature flags or authorization statement are missing", () => {
  const report = generateSyntheticDtcTestOutput({
    requestedCodes: ["P0100"],
    idempotencyKey: "blocked",
    authorizationStatement: "",
  }, {
    flags: {
      ...enabledSyntheticFlags,
      dtcInternalTestProcessing: false,
      dtcSyntheticFixtures: false,
      globalDtcKillSwitchEngaged: true,
    },
    store: new DtcPhaseCInMemoryStore(),
  });

  assert.equal(report.success, false);
  assert.ok(report.hardVetoes.includes("GLOBAL_KILL_SWITCH"));
  assert.ok(report.hardVetoes.includes("MODE_DISABLED"));
  assert.ok(report.hardVetoes.includes("AUDIT_COMMIT_FAILED"));
  assert.equal(report.artifacts.length, 0);
});

test("DTC Phase C idempotency prevents duplicate conflicting requests", () => {
  const store = new DtcPhaseCInMemoryStore();
  const first = generate(["P0100"], store, "same-key");
  const replay = generate(["P0100"], store, "same-key");

  assert.equal(first.success, true);
  assert.equal(replay.success, true);
  assert.equal(replay.attemptId, first.attemptId);

  assert.throws(
    () => generate(["P0300"], store, "same-key"),
    /Idempotency key reuse/
  );
});

test("DTC Phase C lease fencing rejects concurrent and stale worker writes", () => {
  const store = new DtcPhaseCInMemoryStore();
  const { attempt } = store.createOrGetAttempt({
    idempotencyKey: "lease-test",
    requestHash: phaseCRequestHash({ codes: ["P0100"] }),
    requestedCodes: ["P0100"],
  });
  const first = store.claimAttempt(attempt.attemptId, "worker-a");
  const second = store.claimAttempt(attempt.attemptId, "worker-b");

  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  assert.throws(() => store.markProcessing(attempt.attemptId, "stale-token"), /lease fencing/i);
});

test("DTC Phase C artifact repository is immutable and returns isolated byte copies", () => {
  const store = new DtcPhaseCInMemoryStore();
  const report = generate(["P0100"], store, "artifact-test");
  const source = report.artifacts.find((artifact) => artifact.role === "source");
  assert.ok(source);

  const firstCopy = store.getArtifactBytes(source.artifactId);
  assert.ok(firstCopy);
  firstCopy[0] = 0;
  const secondCopy = store.getArtifactBytes(source.artifactId);
  assert.ok(secondCopy);
  assert.notEqual(secondCopy[0], 0);

  assert.throws(
    () => store.putArtifact({ attemptId: report.attemptId, role: "source", bytes: secondCopy }),
    /already exists/
  );
});

test("DTC Phase C negative source states fail without output artifacts", () => {
  for (const [caseType, veto] of [
    ["wrong_sw", "EXACT_SW_NOT_ESTABLISHED"],
    ["wrong_role", "FILE_ROLE_UNKNOWN"],
    ["source_mismatch", "SOURCE_BYTES_MISMATCH"],
    ["missing_linked", "MISSING_LINKED_STRUCTURE"],
    ["already_modified", "PREVIOUSLY_MODIFIED_INPUT"],
    ["corrupt", "SOURCE_INTEGRITY_FAILED"],
  ] as const) {
    const report = generateSyntheticDtcTestOutput({
      requestedCodes: ["P0100"],
      idempotencyKey: `negative-${caseType}`,
      authorizationStatement: phaseCAuthorizationStatement,
      sourceCaseType: caseType,
    }, {
      flags: enabledSyntheticFlags,
      store: new DtcPhaseCInMemoryStore(),
    });

    assert.equal(report.success, false);
    assert.ok(report.hardVetoes.includes(veto));
    assert.equal(report.artifacts.length, 0);
    assert.equal(report.finalSha256, null);
  }
});

test("DTC Phase C migration is additive, private, RLS-protected and stores no bytes", () => {
  const sql = readProjectFile("supabase", "migrations", "20260714212824_dtc_active_processing_phase_c_synthetic_test_output.sql");
  const executableSql = stripSqlComments(sql);

  assert.match(sql, /create table if not exists dtc_private\.dtc_phase_c_synthetic_attempts/i);
  assert.match(sql, /create table if not exists dtc_private\.dtc_phase_c_synthetic_artifacts/i);
  assert.match(sql, /alter table dtc_private\.dtc_phase_c_synthetic_artifacts enable row level security/i);
  assert.match(sql, /revoke all on all tables in schema dtc_private from public, anon, authenticated/i);
  assert.match(sql, /customer_publishable boolean not null default false check \(customer_publishable is false\)/i);
  assert.match(sql, /customer_delivery_enabled boolean not null default false check \(customer_delivery_enabled is false\)/i);
  assert.match(sql, /before update or delete on dtc_private\.dtc_phase_c_synthetic_artifacts/i);
  assert.doesNotMatch(executableSql, /\b(drop|delete\s+from|truncate|drop\s+column)\b/i);
  assert.doesNotMatch(sql, /\bbytea\b|base64|raw_firmware|hex_dump/i);
});

test("DTC Phase C local verification SQL checks RLS, grants and immutability", () => {
  const verification = readProjectFile("scripts", "verify-dtc-active-phase-c-local.sql");

  assert.match(verification, /Local-only verification/i);
  assert.match(verification, /has_table_privilege\('anon', 'dtc_private\.dtc_phase_c_synthetic_artifacts', 'SELECT'\)/i);
  assert.match(verification, /data_type = 'bytea'/i);
  assert.match(verification, /immutability trigger did not block update/i);
  assert.match(verification, /rollback;/i);
  assert.doesNotMatch(stripSqlComments(verification), /\b(drop|delete\s+from|truncate|drop\s+column)\b/i);
});

test("DTC Phase C admin workflow is staff-only and has no customer delivery route", () => {
  const route = readProjectFile("src", "app", "api", "admin", "dtc", "test-processing", "generate", "route.ts");
  const page = readProjectFile("src", "app", "admin", "dtc", "test-processing", "page.tsx");
  const customerStatusRoute = readProjectFile("src", "app", "api", "requests", "[id]", "dtc-status", "route.ts");

  assert.match(route, /requireStaffPermission\(request,\s*"ai_training\.manage"\)/);
  assert.match(route, /generateSyntheticDtcTestOutput/);
  assert.doesNotMatch(route, /public|download|delivery|service_role/i);
  assert.match(page, /Generate Synthetic Test Output/);
  assert.match(page, /No customer file, real ECU checksum, native tool, delivery or A3\/A4\/A5 path is used/);
  assert.doesNotMatch(customerStatusRoute, /test-processing|finalSha256|preIntegrity|changedRegions|artifact/i);
});
