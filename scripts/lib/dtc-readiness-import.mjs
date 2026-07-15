import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, resolve, sep } from "node:path";

export const IMPORT_ROOT_RELATIVE = ".local/dtc-readiness-import";

export const DTC_READINESS_EXPORT_FIELD_ALLOWLIST = [
  "record_id",
  "source_kind",
  "ecu_supplier",
  "ecu_family",
  "ecu_type",
  "hw_number",
  "sw_number",
  "calibration_id",
  "representation_type",
  "file_role",
  "file_size",
  "segment_manifest_digest",
  "read_method",
  "source_provenance",
  "source_authorization_quality",
  "original_hash",
  "mod_hash",
  "exact_dtc_labels",
  "service_labels",
  "human_verified",
  "learning_approved",
  "pair_confidence",
  "pair_review_status",
  "pair_identity_consistent",
  "changed_region_signature",
  "changed_region_consistency",
  "unrelated_change",
  "checksum_only_control",
  "already_modified_negative",
  "wrong_pair_negative",
  "pre_integrity_available",
  "final_mod_available",
  "map_definition_available",
  "integrity_evidence_available",
  "bench_verified",
  "successful_write_readback",
  "rollback_verified",
  "conflict_notes",
  "export_source_table",
  "exported_at",
];

export const DTC_READINESS_EXCLUDED_FIELDS = [
  "firmware bytes",
  "raw binary",
  "raw hex",
  "customer names",
  "customer emails",
  "customer phone numbers",
  "customer addresses",
  "customer notes",
  "internal notes",
  "payment data",
  "credentials",
  "Supabase service role keys",
  "storage paths",
  "local absolute paths",
  "signed URLs",
  "source URLs",
  "provider private sample metadata",
];

const ALLOWLIST = new Set(DTC_READINESS_EXPORT_FIELD_ALLOWLIST);
const SOURCE_KINDS = new Set(["training_sample", "dataset_pair", "file_expert_job", "manual_lab_import"]);
const FILE_ROLES = new Set(["ori", "pair"]);
export const DTC_READINESS_ALLOWED_AUTHORIZATION_VALUES = ["trusted", "authorized_lab"];
export const DTC_READINESS_ALLOWED_PAIR_REVIEW_STATUSES = [
  "approved",
  "ready_for_human_label",
  "confirmed",
  "approved_for_learning",
  "needs_review",
  "pending_review",
];

const AUTH_QUALITY = new Set(DTC_READINESS_ALLOWED_AUTHORIZATION_VALUES);
const REVIEW_STATES = new Set(DTC_READINESS_ALLOWED_PAIR_REVIEW_STATUSES);
const CHANGED_REGION_STATES = new Set(["unknown", "consistent", "none"]);
const SERVICE_LABELS = new Set(["stage1", "stage2", "egr_off", "dpf_off", "adblue_off", "dtc_off", "vmax", "tcu", "unknown"]);
const HASH_PATTERN = /^[0-9a-f]{64}$/i;
const DTC_PATTERN = /^[PCBU][0-9A-F]{4}$/i;
const AUTHORIZATION_ALIASES = new Map([
  ["trusted", "trusted"],
  ["trusted_source", "trusted"],
  ["source_authorized", "trusted"],
  ["source_authorised", "trusted"],
  ["authorized_lab", "authorized_lab"],
  ["authorised_lab", "authorized_lab"],
  ["lab_authorized", "authorized_lab"],
  ["lab_authorised", "authorized_lab"],
]);
const REVIEW_STATUS_ALIASES = new Map([
  ["approved", "approved"],
  ["confirmed", "confirmed"],
  ["approved_for_learning", "approved_for_learning"],
  ["ready_for_human_label", "ready_for_human_label"],
  ["pending_review", "pending_review"],
  ["pending", "pending_review"],
  ["needs_review", "needs_review"],
  ["review_required", "needs_review"],
  ["unverified", "needs_review"],
]);
const SERVICE_LABEL_ALIASES = new Map([
  ["stage1", "stage1"],
  ["stage_1", "stage1"],
  ["stage2", "stage2"],
  ["stage_2", "stage2"],
  ["egr_off", "egr_off"],
  ["egr", "egr_off"],
  ["dpf_off", "dpf_off"],
  ["dpf", "dpf_off"],
  ["adblue_off", "adblue_off"],
  ["ad_blue_off", "adblue_off"],
  ["scr_off", "adblue_off"],
  ["dtc_off", "dtc_off"],
  ["dtc", "dtc_off"],
  ["vmax", "vmax"],
  ["vmax_off", "vmax"],
  ["speed_limiter_off", "vmax"],
  ["tcu", "tcu"],
  ["tcu_tune", "tcu"],
  ["tcu_shift", "tcu"],
  ["tcu_lockup", "tcu"],
  ["unknown", "unknown"],
]);
const READ_METHOD_ALIASES = new Map([
  ["bench", "bench"],
  ["obd", "obd"],
  ["boot", "boot"],
  ["boot_mode", "boot"],
  ["bootmode", "boot"],
  ["bdm", "bdm"],
  ["jtag", "jtag"],
  ["virtual_read", "virtual_read"],
  ["vr", "virtual_read"],
]);
const FIRST_LAB_TARGET_FAMILY_ALIASES = new Map([
  ["ME75", "ME7.5"],
  ["BOSCHME75", "ME7.5"],
  ["EDC15P", "EDC15P"],
  ["BOSCHEDC15P", "EDC15P"],
  ["EDC15VM", "EDC15VM+"],
  ["BOSCHEDC15VM", "EDC15VM+"],
  ["EDC15VM+", "EDC15VM+"],
  ["BOSCHEDC15VM+", "EDC15VM+"],
  ["EDC16U34", "EDC16U34"],
  ["BOSCHEDC16U34", "EDC16U34"],
]);

export function importRoot(cwd = process.cwd()) {
  return resolve(cwd, IMPORT_ROOT_RELATIVE);
}

export function resolveImportFile(inputPath, cwd = process.cwd()) {
  const root = importRoot(cwd);
  const resolved = resolve(cwd, inputPath);
  if (resolved !== root && !resolved.startsWith(`${root}${sep}`)) {
    throw new Error(`Import file must be stored under ${IMPORT_ROOT_RELATIVE}. Move the downloaded export there first.`);
  }
  return resolved;
}

export function detectFormat(filePath, explicitFormat = "auto") {
  if (explicitFormat && explicitFormat !== "auto") return explicitFormat;
  const extension = extname(filePath).toLowerCase();
  if (extension === ".csv") return "csv";
  if (extension === ".json" || extension === ".jsonl") return extension.slice(1);
  throw new Error("Could not detect import format. Use --format csv, --format json or --format jsonl.");
}

export function parseImportContent(content, format) {
  if (format === "json") {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.records)) return parsed.records;
    throw new Error("JSON import must be an array or an object with a records array.");
  }
  if (format === "jsonl") {
    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }
  if (format === "csv") return parseCsv(content);
  throw new Error(`Unsupported import format: ${format}`);
}

export function loadImportRecords(inputPath, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const resolved = resolveImportFile(inputPath, cwd);
  const format = detectFormat(resolved, options.format ?? "auto");
  const content = readFileSync(resolved, "utf8");
  return {
    inputPath: resolved,
    format,
    records: parseImportContent(content, format),
  };
}

export function validateReadinessRecord(raw, index = 0) {
  const reasons = [];
  const normalizationNotes = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      ok: false,
      reason: "malformed",
      reasons: ["Record is not an object."],
      normalization_notes: [],
      raw,
    };
  }

  const unknownKeys = Object.keys(raw).filter((key) => !ALLOWLIST.has(key));
  if (unknownKeys.length) reasons.push(`Unknown or forbidden fields: ${unknownKeys.join(", ")}`);

  const record = {
    record_id: requiredString(raw.record_id, "record_id", reasons),
    source_kind: enumString(raw.source_kind, SOURCE_KINDS, "source_kind", reasons),
    ecu_supplier: requiredString(raw.ecu_supplier, "ecu_supplier", reasons),
    ecu_family: requiredString(raw.ecu_family, "ecu_family", reasons),
    ecu_type: requiredString(raw.ecu_type, "ecu_type", reasons),
    hw_number: requiredString(raw.hw_number, "hw_number", reasons),
    sw_number: requiredString(raw.sw_number, "sw_number", reasons),
    calibration_id: optionalString(raw.calibration_id),
    representation_type: requiredString(raw.representation_type, "representation_type", reasons),
    file_role: enumString(raw.file_role, FILE_ROLES, "file_role", reasons),
    file_size: requiredPositiveInteger(raw.file_size, "file_size", reasons),
    segment_manifest_digest: requiredString(raw.segment_manifest_digest, "segment_manifest_digest", reasons),
    read_method: readMethodValue(raw.read_method, "read_method", reasons, normalizationNotes),
    source_provenance: requiredString(raw.source_provenance, "source_provenance", reasons),
    source_authorization_quality: authorizationQuality(raw.source_authorization_quality, "source_authorization_quality", reasons, normalizationNotes),
    original_hash: optionalHash(raw.original_hash, "original_hash", reasons, true),
    mod_hash: optionalHash(raw.mod_hash, "mod_hash", reasons, false),
    exact_dtc_labels: dtcArray(raw.exact_dtc_labels, "exact_dtc_labels", reasons),
    service_labels: labelArray(raw.service_labels, "service_labels", reasons, normalizationNotes),
    human_verified: booleanValue(raw.human_verified),
    learning_approved: booleanValue(raw.learning_approved),
    pair_confidence: optionalNumber(raw.pair_confidence, "pair_confidence", reasons),
    pair_review_status: pairReviewStatus(raw.pair_review_status, "pair_review_status", reasons, normalizationNotes),
    pair_identity_consistent: booleanValue(raw.pair_identity_consistent, true),
    changed_region_signature: optionalString(raw.changed_region_signature),
    changed_region_consistency: optionalEnum(raw.changed_region_consistency, CHANGED_REGION_STATES, "changed_region_consistency", reasons) ?? "unknown",
    unrelated_change: booleanValue(raw.unrelated_change),
    checksum_only_control: booleanValue(raw.checksum_only_control),
    already_modified_negative: booleanValue(raw.already_modified_negative),
    wrong_pair_negative: booleanValue(raw.wrong_pair_negative),
    pre_integrity_available: booleanValue(raw.pre_integrity_available),
    final_mod_available: booleanValue(raw.final_mod_available),
    map_definition_available: booleanValue(raw.map_definition_available),
    integrity_evidence_available: booleanValue(raw.integrity_evidence_available),
    bench_verified: booleanValue(raw.bench_verified),
    successful_write_readback: booleanValue(raw.successful_write_readback),
    rollback_verified: booleanValue(raw.rollback_verified),
    conflict_notes: stringArray(raw.conflict_notes, "conflict_notes", reasons),
    export_source_table: optionalString(raw.export_source_table),
    exported_at: optionalString(raw.exported_at),
  };

  if (!/bosch/i.test(`${record.ecu_supplier} ${record.ecu_family} ${record.ecu_type}`)) {
    reasons.push("Only Bosch ME7.5, EDC15P/EDC15VM+ and EDC16U34 readiness targets are accepted.");
  }
  const targetFamily = resolveFirstLabTargetFamily(record);
  if (!targetFamily) {
    reasons.push("ECU family/type is outside the allowed first-lab target families.");
  } else {
    record.first_lab_target_family = targetFamily;
  }
  if (record.file_role === "pair" && !record.mod_hash) reasons.push("Pair records require a valid mod_hash.");
  if (record.file_role === "pair" && !record.service_labels.includes("dtc_off")) reasons.push("Pair records must include dtc_off in service_labels.");
  if (record.file_role === "pair" && record.exact_dtc_labels.length === 0 && !record.checksum_only_control) {
    reasons.push("Pair records require exact_dtc_labels unless they are checksum-only controls.");
  }
  if (record.human_verified !== true) reasons.push("Record is not human verified.");
  if (record.pair_identity_consistent === false) reasons.push("ORI/MOD pair identity is not consistent.");
  if (record.changed_region_consistency === "inconsistent") reasons.push("Changed-region evidence is inconsistent.");
  if (record.unrelated_change) reasons.push("Record contains unrelated changes.");
  if (record.already_modified_negative) reasons.push("Record is an already-modified negative.");
  if (record.wrong_pair_negative) reasons.push("Record is a wrong-pair negative.");
  if (record.conflict_notes.length > 0) reasons.push("Record contains conflict notes.");

  const reason = classifyReasons(reasons);
  return {
    ok: reasons.length === 0,
    reason,
    reasons,
    normalization_notes: normalizationNotes,
    record,
    raw,
    index,
  };
}

export function validateReadinessRecords(records) {
  const accepted = [];
  const quarantine = [];
  records.forEach((raw, index) => {
    const result = validateReadinessRecord(raw, index);
    if (result.ok) accepted.push(result.record);
    else quarantine.push(result);
  });
  return { accepted, quarantine };
}

export function writeImportOutputs({ inputPath, accepted, quarantine, cwd = process.cwd(), batchId = defaultBatchId() }) {
  const root = importRoot(cwd);
  const acceptedDir = resolve(root, "accepted");
  const quarantineDir = resolve(root, "quarantine");
  const auditDir = resolve(root, "audit");
  const sqlDir = resolve(root, "sql");
  for (const dir of [acceptedDir, quarantineDir, auditDir, sqlDir]) mkdirSync(dir, { recursive: true });

  const base = safeBaseName(inputPath);
  const acceptedPath = resolve(acceptedDir, `${batchId}-${base}.accepted.json`);
  const quarantinePath = resolve(quarantineDir, `${batchId}-${base}.quarantine.json`);
  const auditPath = resolve(auditDir, `${batchId}-${base}.audit.json`);
  const sqlPath = resolve(sqlDir, `${batchId}-${base}.load-local.sql`);
  const audit = buildAuditReport({ inputPath, accepted, quarantine, batchId });

  writeFileSync(acceptedPath, `${JSON.stringify({ batch_id: batchId, records: accepted }, null, 2)}\n`);
  writeFileSync(quarantinePath, `${JSON.stringify({ batch_id: batchId, records: quarantine }, null, 2)}\n`);
  writeFileSync(auditPath, `${JSON.stringify(audit, null, 2)}\n`);
  writeFileSync(sqlPath, buildLocalLoadSql(batchId, accepted));

  return {
    batchId,
    acceptedPath,
    quarantinePath,
    auditPath,
    sqlPath,
    audit,
  };
}

export function buildAuditReport({ inputPath, accepted, quarantine, batchId }) {
  const quarantineReasons = {};
  for (const item of quarantine) {
    quarantineReasons[item.reason] = (quarantineReasons[item.reason] ?? 0) + 1;
  }
  const diagnostic = buildDiagnosticReport({ accepted, quarantine });
  return {
    batch_id: batchId,
    generated_at: new Date().toISOString(),
    input_file: inputPath ? basename(inputPath) : null,
    accepted_count: accepted.length,
    quarantined_count: quarantine.length,
    quarantine_reasons: quarantineReasons,
    diagnostic,
    exported_field_allowlist: DTC_READINESS_EXPORT_FIELD_ALLOWLIST,
    excluded_fields: DTC_READINESS_EXCLUDED_FIELDS,
    safety: {
      metadata_only: true,
      firmware_bytes_imported: false,
      raw_hex_imported: false,
      customer_identity_imported: false,
      storage_paths_imported: false,
      output_artifacts_created: false,
    },
  };
}

export function buildDiagnosticReport({ accepted = [], quarantine = [] }) {
  const categories = {
    serialization_schema_mismatch: 0,
    deterministic_normalization_issue: 0,
    genuinely_missing_metadata: 0,
    genuinely_unauthorized_data: 0,
    intentionally_excluded_ecu_family: 0,
    hard_stop_safety_condition: 0,
  };
  for (const item of quarantine) {
    const text = item.reasons.join(" ").toLowerCase();
    if (/unknown or forbidden|invalid json array|invalid json object|invalid array field|invalid service labels|invalid dtc labels/.test(text)) {
      categories.serialization_schema_mismatch += 1;
    }
    if (item.normalization_notes?.length) categories.deterministic_normalization_issue += 1;
    if (/missing exact|not human verified|pair records require exact_dtc_labels|pair records must include dtc_off/.test(text)) {
      categories.genuinely_missing_metadata += 1;
    }
    if (/source_authorization_quality|authorization|authorized|trusted/.test(text)) {
      categories.genuinely_unauthorized_data += 1;
    }
    if (/outside the allowed first-lab target|only bosch/.test(text)) {
      categories.intentionally_excluded_ecu_family += 1;
    }
    if (/identity is not consistent|unrelated changes|already-modified negative|wrong-pair negative|conflict notes|changed-region evidence is inconsistent/.test(text)) {
      categories.hard_stop_safety_condition += 1;
    }
  }

  return {
    categories,
    allowed_values: {
      source_authorization_quality: DTC_READINESS_ALLOWED_AUTHORIZATION_VALUES,
      pair_review_status: DTC_READINESS_ALLOWED_PAIR_REVIEW_STATUSES,
      first_lab_target_families: ["ME7.5", "EDC15P", "EDC15VM+", "EDC16U34"],
    },
    actual_values: {
      source_authorization_quality: countValues([...accepted, ...quarantine.map((item) => item.raw)], "source_authorization_quality"),
      pair_review_status: countValues([...accepted, ...quarantine.map((item) => item.raw)], "pair_review_status"),
      ecu_family: countValues([...accepted, ...quarantine.map((item) => item.raw)], "ecu_family"),
      ecu_type: countValues([...accepted, ...quarantine.map((item) => item.raw)], "ecu_type"),
      read_method: countValues([...accepted, ...quarantine.map((item) => item.raw)], "read_method"),
    },
  };
}

export function buildLocalLoadSql(batchId, accepted) {
  const rows = accepted.map((record) => {
    const id = `${batchId}:${record.record_id}`;
    const values = [
      sqlString(id),
      sqlString(batchId),
      sqlString(record.record_id),
      sqlString(record.source_kind),
      sqlString(record.ecu_supplier),
      sqlString(record.ecu_family),
      sqlString(record.ecu_type),
      sqlString(record.hw_number),
      sqlString(record.sw_number),
      sqlString(record.calibration_id),
      sqlString(record.representation_type),
      sqlString(record.file_role),
      sqlNumber(record.file_size),
      sqlString(record.segment_manifest_digest),
      sqlString(record.read_method),
      sqlString(record.source_provenance),
      sqlString(record.source_authorization_quality),
      sqlString(record.original_hash),
      sqlString(record.mod_hash),
      sqlJson(record.exact_dtc_labels),
      sqlJson(record.service_labels),
      sqlBoolean(record.human_verified),
      sqlBoolean(record.learning_approved),
      sqlNumber(record.pair_confidence),
      sqlString(record.pair_review_status),
      sqlBoolean(record.pair_identity_consistent),
      sqlString(record.changed_region_signature),
      sqlString(record.changed_region_consistency),
      sqlBoolean(record.unrelated_change),
      sqlBoolean(record.checksum_only_control),
      sqlBoolean(record.already_modified_negative),
      sqlBoolean(record.wrong_pair_negative),
      sqlBoolean(record.pre_integrity_available),
      sqlBoolean(record.final_mod_available),
      sqlBoolean(record.map_definition_available),
      sqlBoolean(record.integrity_evidence_available),
      sqlBoolean(record.bench_verified),
      sqlBoolean(record.successful_write_readback),
      sqlBoolean(record.rollback_verified),
      sqlJson(record.conflict_notes),
      sqlString(record.export_source_table),
      sqlString(record.exported_at),
      sqlJson(record),
    ];
    return `(${values.join(", ")})`;
  });

  const valuesSql = rows.length ? rows.join(",\n") : "";
  return `-- Local-only generated loader for DTC readiness metadata.
-- Apply scripts/setup-dtc-readiness-import-local.sql first.
-- This file stores metadata only and should target a disposable local Supabase database.

${rows.length ? `insert into public.dtc_readiness_import_records (
  id,
  import_batch_id,
  record_id,
  source_kind,
  ecu_supplier,
  ecu_family,
  ecu_type,
  hw_number,
  sw_number,
  calibration_id,
  representation_type,
  file_role,
  file_size,
  segment_manifest_digest,
  read_method,
  source_provenance,
  source_authorization_quality,
  original_hash,
  mod_hash,
  exact_dtc_labels,
  service_labels,
  human_verified,
  learning_approved,
  pair_confidence,
  pair_review_status,
  pair_identity_consistent,
  changed_region_signature,
  changed_region_consistency,
  unrelated_change,
  checksum_only_control,
  already_modified_negative,
  wrong_pair_negative,
  pre_integrity_available,
  final_mod_available,
  map_definition_available,
  integrity_evidence_available,
  bench_verified,
  successful_write_readback,
  rollback_verified,
  conflict_notes,
  export_source_table,
  exported_at,
  raw_record
) values
${valuesSql}
on conflict do nothing;
` : "-- No accepted records to load.\n"}`;
}

function parseCsv(content) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;
  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current);
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      current = "";
      continue;
    }
    current += char;
  }
  row.push(current);
  if (row.some((cell) => cell.length > 0)) rows.push(row);
  if (rows.length === 0) return [];
  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((cells) => Object.fromEntries(headers.map((header, index) => [header, parseCell(cells[index] ?? "")])));
}

function parseCell(value) {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if ((trimmed.startsWith("[") && trimmed.endsWith("]")) || (trimmed.startsWith("{") && trimmed.endsWith("}"))) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

function requiredString(value, field, reasons) {
  const parsed = optionalString(value);
  if (!parsed || parsed.toLowerCase() === "unknown") reasons.push(`Missing exact ${field}.`);
  return parsed;
}

function optionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function enumString(value, allowed, field, reasons) {
  const parsed = optionalString(value);
  if (!parsed || !allowed.has(parsed)) reasons.push(`Invalid ${field}.`);
  return parsed;
}

function optionalEnum(value, allowed, field, reasons) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = String(value).trim();
  if (!allowed.has(parsed)) reasons.push(`Invalid ${field}.`);
  return parsed;
}

function authorizationQuality(value, field, reasons, normalizationNotes) {
  const parsed = optionalString(value);
  const normalized = aliasLookup(parsed, AUTHORIZATION_ALIASES);
  if (!normalized || !AUTH_QUALITY.has(normalized)) {
    reasons.push(`Invalid ${field}. Allowed values are ${DTC_READINESS_ALLOWED_AUTHORIZATION_VALUES.join(", ")}; weak, unknown, customer-unapproved and ambiguous sources remain quarantined.`);
    return parsed;
  }
  if (normalized !== parsed) normalizationNotes.push(`${field}: ${parsed} -> ${normalized}`);
  return normalized;
}

function pairReviewStatus(value, field, reasons, normalizationNotes) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = String(value).trim();
  const normalized = aliasLookup(parsed, REVIEW_STATUS_ALIASES);
  if (!normalized || !REVIEW_STATES.has(normalized)) {
    reasons.push(`Invalid ${field}.`);
    return parsed;
  }
  if (normalized !== parsed) normalizationNotes.push(`${field}: ${parsed} -> ${normalized}`);
  return normalized;
}

function readMethodValue(value, field, reasons, normalizationNotes) {
  const parsed = optionalString(value);
  const normalized = aliasLookup(parsed, READ_METHOD_ALIASES);
  if (!normalized) {
    reasons.push(`Missing exact ${field}.`);
    return parsed;
  }
  if (normalized !== parsed) normalizationNotes.push(`${field}: ${parsed} -> ${normalized}`);
  return normalized;
}

function requiredPositiveInteger(value, field, reasons) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) reasons.push(`Invalid ${field}.`);
  return Number.isFinite(number) ? number : null;
}

function optionalNumber(value, field, reasons) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) reasons.push(`Invalid ${field}.`);
  return Number.isFinite(number) ? number : null;
}

function optionalHash(value, field, reasons, required) {
  const parsed = optionalString(value)?.toLowerCase() ?? null;
  if (!parsed && required) reasons.push(`Missing ${field}.`);
  if (parsed && !HASH_PATTERN.test(parsed)) reasons.push(`Invalid ${field}.`);
  return parsed;
}

function booleanValue(value, defaultValue = false) {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return defaultValue;
}

function dtcArray(value, field, reasons) {
  const values = stringArray(value, field, reasons).map((entry) => entry.toUpperCase());
  const invalid = values.filter((entry) => !DTC_PATTERN.test(entry));
  if (invalid.length) reasons.push(`Invalid DTC labels in ${field}: ${invalid.join(", ")}`);
  return [...new Set(values)].sort();
}

function labelArray(value, field, reasons, normalizationNotes) {
  const values = serviceLabelValues(value, field, reasons, normalizationNotes).map((entry) => {
    const normalized = aliasLookup(entry, SERVICE_LABEL_ALIASES);
    if (normalized && normalized !== entry.toLowerCase()) normalizationNotes.push(`${field}: ${entry} -> ${normalized}`);
    return normalized ?? entry.toLowerCase();
  });
  const invalid = values.filter((entry) => !SERVICE_LABELS.has(entry));
  if (invalid.length) reasons.push(`Invalid service labels in ${field}: ${invalid.join(", ")}`);
  return [...new Set(values)].sort();
}

function stringArray(value, field, reasons) {
  if (Array.isArray(value)) return value.filter((entry) => typeof entry === "string" && entry.trim()).map((entry) => entry.trim());
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        return stringArray(JSON.parse(trimmed), field, reasons);
      } catch {
        reasons.push(`Invalid JSON array in ${field}.`);
        return [];
      }
    }
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      reasons.push(`Invalid JSON object in ${field}; expected a JSON array.`);
      return [];
    }
    reasons.push(`Invalid array field ${field}; expected a JSON array.`);
    return [];
  }
  if (value === null || value === undefined) return [];
  reasons.push(`Invalid array field ${field}.`);
  return [];
}

function serviceLabelValues(value, field, reasons, normalizationNotes) {
  if (Array.isArray(value) || value === null || value === undefined) return stringArray(value, field, reasons);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        return serviceLabelValues(JSON.parse(trimmed), field, reasons, normalizationNotes);
      } catch {
        reasons.push(`Invalid JSON object in ${field}.`);
        return [];
      }
    }
    return stringArray(value, field, reasons);
  }
  if (typeof value === "object") {
    normalizationNotes.push(`${field}: legacy object-map -> active JSON array`);
    return Object.entries(value)
      .filter(([, enabled]) => enabled === true || enabled === "true")
      .map(([label]) => label)
      .filter(Boolean)
      .sort();
  }
  reasons.push(`Invalid array field ${field}.`);
  return [];
}

function classifyReasons(reasons) {
  const text = reasons.join(" ").toLowerCase();
  if (!reasons.length) return "accepted";
  if (/unknown or forbidden|invalid json|invalid array|invalid .*hash|invalid .*labels/.test(text)) return "malformed";
  if (/authorization|authorized|trusted/.test(text)) return "unauthorized";
  if (/conflict|unrelated|negative|wrong-pair|already-modified|inconsistent/.test(text)) return "conflicting";
  if (/missing exact|unknown|outside|file_role|ambiguous|pair records require/.test(text)) return "ambiguous";
  return "malformed";
}

function aliasLookup(value, aliases) {
  if (!value || typeof value !== "string") return null;
  return aliases.get(aliasKey(value)) ?? null;
}

function aliasKey(value) {
  return String(value).trim().toLowerCase().replace(/[^\p{L}\p{N}+]+/gu, "_").replace(/^_+|_+$/g, "");
}

function targetFamilyKey(value) {
  return String(value).trim().toUpperCase().replace(/[^A-Z0-9+]/g, "");
}

function resolveFirstLabTargetFamily(record) {
  for (const value of [record.ecu_type, record.ecu_family]) {
    const key = targetFamilyKey(value ?? "");
    if (FIRST_LAB_TARGET_FAMILY_ALIASES.has(key)) return FIRST_LAB_TARGET_FAMILY_ALIASES.get(key);
  }
  return null;
}

function countValues(records, field) {
  const counts = {};
  for (const record of records) {
    const value = record?.[field];
    const key = value === null || value === undefined || value === "" ? "null" : String(value);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function defaultBatchId() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function safeBaseName(inputPath) {
  return basename(inputPath).replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.(csv|json|jsonl)$/i, "");
}

function sqlString(value) {
  if (value === null || value === undefined || value === "") return "null";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlNumber(value) {
  return Number.isFinite(Number(value)) ? String(Number(value)) : "null";
}

function sqlBoolean(value) {
  return value ? "true" : "false";
}

function sqlJson(value) {
  return `${sqlString(JSON.stringify(value ?? null))}::jsonb`;
}
