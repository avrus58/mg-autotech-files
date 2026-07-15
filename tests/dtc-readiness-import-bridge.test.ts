import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  const input = resolve(root, "synthetic-export.json");
  rmSync(root, { recursive: true, force: true });
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
  const input = resolve(root, "synthetic-export.csv");
  rmSync(root, { recursive: true, force: true });
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
