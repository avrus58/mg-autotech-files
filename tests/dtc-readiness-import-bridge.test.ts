import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

async function bridge() {
  return await import("../scripts/lib/dtc-readiness-import.mjs");
}

const VALID_RECORD = {
  record_id: "synthetic-edc16u34-p0100",
  source_kind: "training_sample",
  ecu_supplier: "Bosch",
  ecu_family: "EDC16U34",
  ecu_type: "Bosch EDC16U34",
  hw_number: "03G906021AB",
  sw_number: "1037391234",
  calibration_id: "EDC16U34-CAL-A",
  representation_type: "full_flash",
  file_role: "pair",
  file_size: 2_097_152,
  segment_manifest_digest: "segment-manifest-edc16u34-a",
  read_method: "bench",
  source_provenance: "authorized_lab",
  source_authorization_quality: "authorized_lab",
  original_hash: "a".repeat(64),
  mod_hash: "b".repeat(64),
  exact_dtc_labels: ["P0100"],
  service_labels: ["dtc_off"],
  human_verified: true,
  learning_approved: false,
  pair_confidence: 96,
  pair_review_status: "approved",
  pair_identity_consistent: true,
  changed_region_signature: "0x0204:0x0205:1:1|0x0302:0x0303:1:1",
  changed_region_consistency: "consistent",
  unrelated_change: false,
  checksum_only_control: false,
  already_modified_negative: false,
  wrong_pair_negative: false,
  pre_integrity_available: true,
  final_mod_available: true,
  map_definition_available: true,
  integrity_evidence_available: true,
  bench_verified: true,
  successful_write_readback: true,
  rollback_verified: true,
  conflict_notes: [],
  export_source_table: "ai_training_samples",
  exported_at: "2026-07-15T00:00:00Z",
};

function stripSqlComments(sql: string) {
  return sql
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .toLowerCase();
}

test("DTC readiness export SQL is SELECT-only and excludes private/customer fields", () => {
  const sql = readFileSync(resolve(process.cwd(), "scripts", "export-dtc-corpus-readiness-metadata.sql"), "utf8");
  const executable = stripSqlComments(sql);

  assert.match(executable, /\bselect\b/);
  assert.match(executable, /jsonb_each/);
  assert.doesNotMatch(executable, /\b(insert|update|delete|drop|truncate|alter|create|copy|grant|revoke)\b/);
  for (const forbidden of [
    "customer_name",
    "customer_email",
    "phone",
    "address",
    "payment",
    "credential",
    "storage_path",
    "signed_url",
    "source_url",
    "admin_notes",
    "internal_notes",
    "raw_hex",
    "binary",
  ]) {
    assert.doesNotMatch(executable, new RegExp(forbidden));
  }
});

test("DTC readiness local staging setup is additive, RLS protected and metadata-only", () => {
  const sql = readFileSync(resolve(process.cwd(), "scripts", "setup-dtc-readiness-import-local.sql"), "utf8").toLowerCase();

  assert.match(sql, /create table if not exists public\.dtc_readiness_import_records/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on table public\.dtc_readiness_import_records from anon/);
  assert.match(sql, /revoke all on table public\.dtc_readiness_import_records from authenticated/);
  assert.doesNotMatch(sql, /\b(drop|delete|truncate|alter table .* drop)\b/);
  assert.doesNotMatch(sql, /firmware_bytes|raw_hex|storage_path|signed_url|customer_email|payment/);
});

test("DTC readiness importer enforces local import root and validates synthetic metadata", async () => {
  const bridgeModule = await bridge();
  const root = bridgeModule.importRoot(process.cwd());
  const input = resolve(root, `synthetic-export-${Date.now()}.json`);
  mkdirSync(root, { recursive: true });
  writeFileSync(input, `${JSON.stringify([
    VALID_RECORD,
    { ...VALID_RECORD, record_id: "unauthorized", source_authorization_quality: "unknown" },
    { ...VALID_RECORD, record_id: "conflicting", unrelated_change: true },
    { ...VALID_RECORD, record_id: "malformed", customer_email: "blocked@example.com" },
  ], null, 2)}\n`);

  assert.throws(
      () => bridgeModule.resolveImportFile("outside-export.json", process.cwd()),
    /must be stored under/
  );

  const loaded = bridgeModule.loadImportRecords(input, { format: "json" });
  const { accepted, quarantine } = bridgeModule.validateReadinessRecords(loaded.records);

  assert.equal(accepted.length, 1);
  assert.equal(quarantine.length, 3);
  assert.deepEqual(new Set(quarantine.map((entry: { reason: string }) => entry.reason)), new Set(["unauthorized", "conflicting", "malformed"]));
  assert.equal(accepted[0].record_id, "synthetic-edc16u34-p0100");
});

test("DTC readiness importer writes accepted, quarantine, audit and local SQL under .local only", async () => {
  const bridgeModule = await bridge();
  const root = bridgeModule.importRoot(process.cwd());
  const input = resolve(root, `synthetic-export-${Date.now()}.csv`);
  mkdirSync(root, { recursive: true });
  writeFileSync(input, [
    Object.keys(VALID_RECORD).join(","),
    Object.values(VALID_RECORD).map((value) => {
      const text = Array.isArray(value) ? JSON.stringify(value) : String(value);
      return `"${text.replace(/"/g, '""')}"`;
    }).join(","),
  ].join("\n"));

  const loaded = bridgeModule.loadImportRecords(input, { format: "csv" });
  const { accepted, quarantine } = bridgeModule.validateReadinessRecords(loaded.records);
  const outputs = bridgeModule.writeImportOutputs({
    inputPath: loaded.inputPath,
    accepted,
    quarantine,
    batchId: "synthetic-test-batch",
  });

  assert.equal(accepted.length, 1);
  assert.equal(quarantine.length, 0);
  for (const outputPath of [outputs.acceptedPath, outputs.quarantinePath, outputs.auditPath, outputs.sqlPath]) {
    assert.ok(outputPath.startsWith(`${root}\\`) || outputPath.startsWith(`${root}/`));
  }

  const audit = JSON.parse(readFileSync(outputs.auditPath, "utf8"));
  assert.equal(audit.accepted_count, 1);
  assert.equal(audit.safety.metadata_only, true);
  assert.equal(audit.safety.firmware_bytes_imported, false);
  assert.equal(audit.safety.customer_identity_imported, false);

  const loadSql = readFileSync(outputs.sqlPath, "utf8").toLowerCase();
  assert.match(loadSql, /insert into public\.dtc_readiness_import_records/);
  assert.doesNotMatch(loadSql, /customer_email|storage_path|signed_url|raw_hex|firmware_bytes|payment/);
  assert.doesNotMatch(loadSql, /\b(delete|drop|truncate|alter)\b/);
});

test("DTC readiness importer maps only explicit authorization equivalents", async () => {
  const bridgeModule = await bridge();
  const sourceAuthorized = bridgeModule.validateReadinessRecord({
    ...VALID_RECORD,
    record_id: "source-authorized",
    source_authorization_quality: "source authorized",
  });
  const labAuthorized = bridgeModule.validateReadinessRecord({
    ...VALID_RECORD,
    record_id: "lab-authorized",
    source_authorization_quality: "authorised-lab",
  });
  const weak = bridgeModule.validateReadinessRecord({
    ...VALID_RECORD,
    record_id: "weak-auth",
    source_authorization_quality: "weak",
  });
  const unknown = bridgeModule.validateReadinessRecord({
    ...VALID_RECORD,
    record_id: "unknown-auth",
    source_authorization_quality: "unknown",
  });

  assert.equal(sourceAuthorized.ok, true);
  assert.ok(sourceAuthorized.record);
  assert.equal(sourceAuthorized.record.source_authorization_quality, "trusted");
  assert.equal(labAuthorized.ok, true);
  assert.ok(labAuthorized.record);
  assert.equal(labAuthorized.record.source_authorization_quality, "authorized_lab");
  assert.equal(weak.ok, false);
  assert.equal(weak.reason, "unauthorized");
  assert.equal(unknown.ok, false);
  assert.equal(unknown.reason, "unauthorized");
});

test("DTC readiness importer parses JSON array fields and legacy service maps without inventing labels", async () => {
  const bridgeModule = await bridge();
  const valid = bridgeModule.validateReadinessRecord({
    ...VALID_RECORD,
    exact_dtc_labels: '["p0100","P0200"]',
    service_labels: '{"dtc_off":true,"stage1":false,"vmax_off":true}',
  });
  const emptyServiceLabels = bridgeModule.validateReadinessRecord({
    ...VALID_RECORD,
    record_id: "missing-dtc-service",
    exact_dtc_labels: "[]",
    service_labels: "{}",
  });
  const malformedArray = bridgeModule.validateReadinessRecord({
    ...VALID_RECORD,
    record_id: "malformed-array",
    exact_dtc_labels: "[not-json]",
  });

  assert.equal(valid.ok, true);
  assert.ok(valid.record);
  assert.deepEqual(valid.record.exact_dtc_labels, ["P0100", "P0200"]);
  assert.deepEqual(valid.record.service_labels, ["dtc_off", "vmax"]);
  assert.equal(emptyServiceLabels.ok, false);
  assert.match(emptyServiceLabels.reasons.join(" "), /must include dtc_off|exact_dtc_labels/);
  assert.equal(malformedArray.ok, false);
  assert.equal(malformedArray.reason, "malformed");
});

test("DTC readiness importer accepts exact first-lab family aliases and rejects fuzzy family matches", async () => {
  const bridgeModule = await bridge();
  const me75 = bridgeModule.validateReadinessRecord({
    ...VALID_RECORD,
    record_id: "me75-alias",
    ecu_family: "ME 7.5",
    ecu_type: "Bosch ME75",
  });
  const edc15vm = bridgeModule.validateReadinessRecord({
    ...VALID_RECORD,
    record_id: "edc15vm-alias",
    ecu_family: "Bosch EDC15VM +",
    ecu_type: "EDC15VM",
  });
  const fuzzyEdc16 = bridgeModule.validateReadinessRecord({
    ...VALID_RECORD,
    record_id: "edc16cp31-rejected",
    ecu_family: "EDC16",
    ecu_type: "Bosch EDC16CP31",
  });

  assert.equal(me75.ok, true);
  assert.ok(me75.record);
  assert.equal((me75.record as { first_lab_target_family?: string }).first_lab_target_family, "ME7.5");
  assert.equal(edc15vm.ok, true);
  assert.ok(edc15vm.record);
  assert.equal((edc15vm.record as { first_lab_target_family?: string }).first_lab_target_family, "EDC15VM+");
  assert.equal(fuzzyEdc16.ok, false);
  assert.match(fuzzyEdc16.reasons.join(" "), /outside the allowed first-lab target families/);
});

test("DTC readiness importer maps pair statuses safely and quarantines unknown statuses", async () => {
  const bridgeModule = await bridge();
  const unverified = bridgeModule.validateReadinessRecord({
    ...VALID_RECORD,
    record_id: "unverified-status",
    pair_review_status: "unverified",
  });
  const unknown = bridgeModule.validateReadinessRecord({
    ...VALID_RECORD,
    record_id: "unknown-status",
    pair_review_status: "lab_done",
  });

  assert.equal(unverified.ok, true);
  assert.ok(unverified.record);
  assert.equal(unverified.record.pair_review_status, "needs_review");
  assert.equal(unknown.ok, false);
  assert.match(unknown.reasons.join(" "), /Invalid pair_review_status/);
});

test("DTC readiness importer keeps hard safety gates closed", async () => {
  const bridgeModule = await bridge();
  const cases = [
    ["missing-read-method", { read_method: null }, /Missing exact read_method/],
    ["missing-dtc-labels", { exact_dtc_labels: [] }, /require exact_dtc_labels/],
    ["identity-inconsistent", { pair_identity_consistent: false }, /identity is not consistent/],
    ["already-modified", { already_modified_negative: true }, /already-modified negative/],
    ["unrelated-change", { unrelated_change: true }, /unrelated changes/],
  ] as const;

  for (const [recordId, override, reasonPattern] of cases) {
    const result = bridgeModule.validateReadinessRecord({
      ...VALID_RECORD,
      record_id: recordId,
      ...override,
    });
    assert.equal(result.ok, false, recordId);
    assert.match(result.reasons.join(" "), reasonPattern, recordId);
  }
});
