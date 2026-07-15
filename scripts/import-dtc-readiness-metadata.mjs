#!/usr/bin/env node
import {
  loadImportRecords,
  validateReadinessRecords,
  writeImportOutputs,
  IMPORT_ROOT_RELATIVE,
} from "./lib/dtc-readiness-import.mjs";

function usage() {
  return `Usage:
  node scripts/import-dtc-readiness-metadata.mjs --input .local/dtc-readiness-import/export.csv [--format csv|json|jsonl|auto] [--batch-id id]

This importer is local-only. The input file must already be stored under ${IMPORT_ROOT_RELATIVE}.
It writes accepted records, quarantine records, an audit report and a local-load SQL file under that same directory.`;
}

function args(argv) {
  const parsed = { format: "auto", batchId: null, input: null };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const next = argv[index + 1];
    if (key === "--input") {
      parsed.input = next;
      index += 1;
    } else if (key === "--format") {
      parsed.format = next;
      index += 1;
    } else if (key === "--batch-id") {
      parsed.batchId = next;
      index += 1;
    } else if (key === "--help" || key === "-h") {
      console.log(usage());
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${key}`);
    }
  }
  if (!parsed.input) throw new Error("Missing --input.");
  return parsed;
}

try {
  const options = args(process.argv.slice(2));
  const loaded = loadImportRecords(options.input, { format: options.format });
  const { accepted, quarantine } = validateReadinessRecords(loaded.records);
  const outputs = writeImportOutputs({
    inputPath: loaded.inputPath,
    accepted,
    quarantine,
    batchId: options.batchId ?? undefined,
  });
  console.log(JSON.stringify({
    ok: true,
    input: loaded.inputPath,
    format: loaded.format,
    batch_id: outputs.batchId,
    accepted_count: accepted.length,
    quarantined_count: quarantine.length,
    quarantine_reasons: outputs.audit.quarantine_reasons,
    diagnostic_categories: outputs.audit.diagnostic.categories,
    accepted_path: outputs.acceptedPath,
    quarantine_path: outputs.quarantinePath,
    audit_path: outputs.auditPath,
    local_load_sql_path: outputs.sqlPath,
  }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error(usage());
  process.exit(1);
}
