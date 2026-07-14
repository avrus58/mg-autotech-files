import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  assertCustomerDtcActiveProjectionSafe,
  buildCustomerDtcActiveStatus,
  buildDtcActiveFoundationStatus,
  buildDtcActiveModes,
  normalizeActiveDtcCodes,
  resolveDtcActiveFeatureFlags,
} from "@/lib/dtcActive";

function readProjectFile(...parts: string[]) {
  return readFileSync(resolve(process.cwd(), ...parts), "utf8");
}

function stripSqlComments(sql: string) {
  return sql
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
}

test("DTC active Phase A policy defaults fail closed in production-like environments", () => {
  const flags = resolveDtcActiveFeatureFlags({
    NODE_ENV: "production",
    VERCEL_ENV: "production",
  } as NodeJS.ProcessEnv);
  const modes = buildDtcActiveModes(flags);

  assert.equal(flags.dtcReadOnlyFoundation, true);
  assert.equal(flags.globalDtcKillSwitchEngaged, true);
  assert.equal(flags.dtcCustomerDelivery, false);
  assert.equal(flags.dtcRealEcuRules, false);
  assert.equal(flags.dtcRealIntegrityAdapters, false);
  assert.equal(flags.dtcA4Automation, false);
  assert.equal(flags.dtcA5Automation, false);
  assert.equal(flags.dtcInstructionPatchOperations, false);
  assert.equal(modes.find((mode) => mode.mode === "READ_ONLY")?.enabled, true);
  assert.equal(modes.find((mode) => mode.mode === "CONTROLLED_PRODUCTION_PROCESSING")?.enabled, false);
  assert.ok(
    modes
      .find((mode) => mode.mode === "CONTROLLED_PRODUCTION_PROCESSING")
      ?.hardVetoes.includes("GLOBAL_KILL_SWITCH")
  );
});

test("DTC active code parser normalizes DTCs but defaults risky or unknown categories to review", () => {
  const result = normalizeActiveDtcCodes([
    "p0100",
    "P0100",
    "P0401",
    "B10AF",
    "U0123",
    "BAD",
  ]);

  assert.deepEqual(result.codes.map((code) => code.code), ["P0100", "P0401", "B10AF", "U0123"]);
  assert.equal(result.codes.find((code) => code.code === "P0100")?.riskCategory, "ordinary_non_restricted");
  assert.equal(result.codes.find((code) => code.code === "P0401")?.riskCategory, "emissions_and_regulatory");
  assert.equal(result.codes.find((code) => code.code === "B10AF")?.riskCategory, "security_related");
  assert.equal(result.codes.find((code) => code.code === "U0123")?.requiresManualReview, true);
  assert.equal(result.rejected[0]?.reason, "malformed");
});

test("DTC active customer projection is positive-only and rejects forbidden private keys", () => {
  const projection = buildCustomerDtcActiveStatus({
    requestId: "request-1",
    requestedCodes: ["P0100", "P0100", "P0300"],
    now: new Date("2026-07-14T12:00:00.000Z"),
  });

  assert.deepEqual(projection.requestedCodes, ["P0100", "P0300"]);
  assert.equal(projection.downloadable, false);
  assert.equal(projection.status, "expert_review");
  assert.doesNotThrow(() => assertCustomerDtcActiveProjectionSafe(projection));
  assert.throws(
    () => assertCustomerDtcActiveProjectionSafe({ ...projection, storage_path: "private" }),
    /forbidden key/
  );
});

test("DTC active foundation status exposes Phase A plus Phase B synthetic-only safety state", () => {
  const status = buildDtcActiveFoundationStatus({
    NODE_ENV: "production",
    VERCEL_ENV: "production",
  } as NodeJS.ProcessEnv);

  assert.equal(status.phase, "A");
  assert.equal(status.repositoryMode, "read_only_foundation");
  assert.equal(status.serverAuthority, true);
  assert.equal(status.customerDeliveryEnabled, false);
  assert.equal(status.realEcuRulesEnabled, false);
  assert.equal(status.checksumAdaptersEnabled, false);
  assert.equal(status.productionAutomationEnabled, false);
  assert.equal(status.adminPermission, "ai_training.manage");
  assert.ok(status.disabledCapabilities.includes("A4/A5 automation"));
  assert.ok(status.disabledCapabilities.includes("real integrity adapter execution"));
  assert.equal(status.phaseB.syntheticOnly, true);
  assert.equal(status.phaseB.ruleCount, 2);
  assert.equal(status.phaseB.adapterCount, 1);
  assert.equal(status.phaseB.corpusCaseCount, 10);
  assert.equal(status.phaseB.firmwareMutationEnabled, false);
  assert.equal(status.phaseB.outputArtifactGenerationEnabled, false);
  assert.equal(status.phaseB.integrityAdapterExecutionEnabled, false);
  assert.equal(status.phaseB.sampleReport.outputArtifactCreated, false);
  assert.equal(status.phaseB.sampleReport.firmwareBytesMutated, false);
  assert.equal(status.migration.status, "database_verified_local_not_production_applied");
  assert.equal(status.migration.localVerification, "database_verified_local_disposable");
});

test("DTC active Phase A migration is additive, private and customer projection is RLS protected", () => {
  const sql = readProjectFile("scripts", "add-dtc-active-processing-phase-a.sql");
  const executableSql = stripSqlComments(sql);

  assert.match(sql, /create schema if not exists dtc_private/i);
  assert.match(sql, /revoke all on schema dtc_private from public, anon, authenticated/i);
  assert.match(sql, /create table if not exists dtc_private\.dtc_processing_rule_documents/i);
  assert.match(sql, /create table if not exists dtc_private\.dtc_integrity_adapter_documents/i);
  assert.match(sql, /create table if not exists public\.dtc_request_status_public/i);
  assert.match(sql, /alter table public\.dtc_request_status_public enable row level security/i);
  assert.match(sql, /revoke all on public\.dtc_request_status_public from public, anon/i);
  assert.match(sql, /grant select on public\.dtc_request_status_public to authenticated/i);
  assert.match(sql, /grant select, insert, update on public\.dtc_request_status_public to service_role/i);
  assert.match(sql, /auth\.uid\(\) = user_id/i);
  assert.match(sql, /has_staff_permission\('ai_training\.manage'\)/i);
  assert.doesNotMatch(executableSql, /\b(drop|delete\s+from|truncate|drop\s+column)\b/i);
  assert.doesNotMatch(sql, /\bbytea\b|base64|raw_firmware|hex_dump/i);
});

test("DTC active Phase A local database verification harness is disposable and local-only", () => {
  const baseline = readProjectFile(
    "supabase",
    "migrations",
    "20260714132000_dtc_phase_a_test_baseline.sql"
  );
  const verification = readProjectFile("scripts", "verify-dtc-active-phase-a-local.sql");

  assert.match(baseline, /Local-only baseline/i);
  assert.match(baseline, /create table if not exists public\.orders/i);
  assert.match(baseline, /create table if not exists public\.request_work_orders/i);
  assert.match(baseline, /create or replace function public\.has_staff_permission/i);

  assert.match(verification, /disposable local Supabase database/i);
  assert.match(verification, /has_table_privilege\('anon', 'public\.dtc_request_status_public', 'SELECT'\)/i);
  assert.match(verification, /set role authenticated/i);
  assert.match(verification, /request\.jwt\.claim\.sub/i);
  assert.match(verification, /append-only trigger did not block/i);
  assert.doesNotMatch(stripSqlComments(verification), /\b(drop|delete\s+from|truncate|drop\s+column)\b/i);
});

test("DTC active admin and customer APIs are scoped and do not expose processing internals", () => {
  const adminRoute = readProjectFile("src", "app", "api", "admin", "dtc", "foundation", "route.ts");
  const customerRoute = readProjectFile("src", "app", "api", "requests", "[id]", "dtc-status", "route.ts");

  assert.match(adminRoute, /requireStaffPermission\(request,\s*"ai_training\.manage"\)/);
  assert.match(customerRoute, /requireApiUser\(request\)/);
  assert.match(customerRoute, /\.eq\("customer_id", auth\.user\.id\)/);
  assert.match(customerRoute, /assertCustomerDtcActiveProjectionSafe/);
  assert.doesNotMatch(customerRoute, /rule|adapter|operation|offset|storage_path|bucket|checksum/i);
});

test("DTC active admin workbench is visible but cannot start generation, processing or publication", () => {
  const adminPage = readProjectFile("src", "app", "admin", "dtc", "page.tsx");
  const adminHome = readProjectFile("src", "app", "admin", "page.tsx");

  assert.match(adminHome, /href: "\/admin\/dtc"/);
  assert.match(adminPage, /Phase A\/B foundation control/);
  assert.match(adminPage, /No binary\s+mutation, checksum adapter execution,\s+customer delivery or A4\/A5 automation is enabled/i);
  assert.match(adminPage, /no generate, process, publish/i);
  assert.match(adminPage, /Phase B synthetic registry/);
  assert.match(adminPage, /No output artifacts/);
  assert.doesNotMatch(adminPage, /generate-test-output|authorize-a3|\/process|\/publish/);
});

test("DTC active research package hash manifests are imported without enabling runtime fixtures", () => {
  const hashManifest = readProjectFile("docs", "dtc-active", "research-package", "SHA256SUMS.txt");
  const packageManifest = readProjectFile("docs", "dtc-active", "research-package", "PACKAGE_MANIFEST.json");
  const importDoc = readProjectFile("docs", "dtc-active", "RESEARCH_PACKAGE_IMPORT.md");

  assert.match(hashManifest, /ACTIVE_PROCESSING_RESEARCH_ADDENDUM\.md/);
  assert.match(hashManifest, /examples\/fixtures\/source\.bin/);
  assert.match(packageManifest, /"fileCount": 75/);
  assert.match(importDoc, /Phase A deliberately stops before executable mutation/);
});
