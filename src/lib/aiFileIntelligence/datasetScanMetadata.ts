import {
  createDatasetDryRun,
} from "@/lib/aiFileIntelligence/datasetPairing";
import type {
  DatasetDryRunResult,
  DatasetFileDescriptor,
  DatasetFileRoleGuess,
  DatasetServiceLabel,
  ImportSourceType,
} from "@/lib/aiFileIntelligence/datasetImport";

export type ScannerFileMetadata = {
  relative_path: string;
  filename: string;
  extension: string;
  file_size: number;
  sha256: string;
  quick_hash?: string | null;
  modified_at?: string | null;
  guessed_file_role?: DatasetFileRoleGuess;
  guessed_service_labels?: DatasetServiceLabel[];
  guessed_ecu_family?: string | null;
  guessed_ecu_type?: string | null;
  guessed_sw_number?: string | null;
  guessed_hw_number?: string | null;
  duplicate_hash_group?: string | null;
  archive_candidate?: boolean;
  supported?: boolean;
  warnings?: string[];
  errors?: string[];
};

export type ScannerMetadataParseResult = {
  rows: ScannerFileMetadata[];
  rejected_lines: Array<{ line: number; error: string }>;
};

export type ScannerMetadataSummary = {
  total_files: number;
  total_size_bytes: number;
  total_size_gb: number;
  supported_files: number;
  unsupported_files: number;
  duplicate_files: number;
  archive_candidates: number;
  guessed_ori: number;
  guessed_mod: number;
  unknown_role: number;
  warnings: number;
  errors: number;
  service_label_distribution: Record<string, number>;
  ecu_guess_distribution: Record<string, number>;
};

const MAX_JSONL_LINES = 50_000;

function cleanRelativePath(value: unknown) {
  return String(value || "")
    .replace(/\\/g, "/")
    .replace(/^[A-Z]:/i, "")
    .replace(/^\/+/, "")
    .slice(0, 1000);
}

function cleanString(value: unknown, max = 260) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.trim()).filter(Boolean)
    : [];
}

export function parseScannerJsonl(text: string, options: { maxLines?: number } = {}): ScannerMetadataParseResult {
  const maxLines = options.maxLines ?? MAX_JSONL_LINES;
  const rows: ScannerFileMetadata[] = [];
  const rejectedLines: ScannerMetadataParseResult["rejected_lines"] = [];
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;
    if (rows.length >= maxLines) {
      rejectedLines.push({ line: index + 1, error: `Metadata import is limited to ${maxLines} rows per request. Use scanner output chunks for larger datasets.` });
      break;
    }
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      const filename = cleanString(parsed.filename || cleanRelativePath(parsed.relative_path).split("/").pop());
      const relativePath = cleanRelativePath(parsed.relative_path || filename);
      const sha256 = cleanString(parsed.sha256, 160);
      if (!filename || !relativePath || !sha256) {
        rejectedLines.push({ line: index + 1, error: "filename, relative_path and sha256 are required." });
        continue;
      }
      const guessedRole = parsed.guessed_file_role === "ori" || parsed.guessed_file_role === "mod" ? parsed.guessed_file_role : "unknown";
      rows.push({
        relative_path: relativePath,
        filename,
        extension: cleanString(parsed.extension, 32).replace(/^\./, "").toLowerCase(),
        file_size: Math.max(0, Math.floor(Number(parsed.file_size || 0))),
        sha256,
        quick_hash: cleanString(parsed.quick_hash, 160) || null,
        modified_at: cleanString(parsed.modified_at, 80) || null,
        guessed_file_role: guessedRole,
        guessed_service_labels: cleanStringArray(parsed.guessed_service_labels) as DatasetServiceLabel[],
        guessed_ecu_family: cleanString(parsed.guessed_ecu_family, 120) || null,
        guessed_ecu_type: cleanString(parsed.guessed_ecu_type, 180) || null,
        guessed_sw_number: cleanString(parsed.guessed_sw_number, 120) || null,
        guessed_hw_number: cleanString(parsed.guessed_hw_number, 120) || null,
        duplicate_hash_group: cleanString(parsed.duplicate_hash_group, 120) || null,
        archive_candidate: parsed.archive_candidate === true,
        supported: parsed.supported !== false,
        warnings: cleanStringArray(parsed.warnings),
        errors: cleanStringArray(parsed.errors),
      });
    } catch (error) {
      rejectedLines.push({ line: index + 1, error: error instanceof Error ? error.message : "Invalid JSONL row." });
    }
  }
  return { rows, rejected_lines: rejectedLines };
}

export function scannerRowToDescriptor(row: ScannerFileMetadata): DatasetFileDescriptor {
  const folder = row.relative_path.includes("/")
    ? row.relative_path.split("/").slice(0, -1).join("/")
    : "";
  return {
    filename: row.filename,
    folder,
    fileSize: row.file_size,
    fingerprint: row.sha256,
    providerMetadata: {
      metadata_source: "local_scanner_jsonl",
      relative_path: row.relative_path,
      local_reference: row.relative_path,
      extension: row.extension,
      quick_hash: row.quick_hash || null,
      modified_at: row.modified_at || null,
      guessed_file_role: row.guessed_file_role || "unknown",
      guessed_service_labels: row.guessed_service_labels || [],
      guessed_ecu_family: row.guessed_ecu_family || null,
      guessed_ecu_type: row.guessed_ecu_type || null,
      guessed_sw_number: row.guessed_sw_number || null,
      guessed_hw_number: row.guessed_hw_number || null,
      duplicate_hash_group: row.duplicate_hash_group || null,
      archive_candidate: row.archive_candidate === true,
      scanner_supported: row.supported !== false,
      scanner_warnings: row.warnings || [],
      scanner_errors: row.errors || [],
      raw_binary_uploaded: false,
      supabase_storage_used: false,
    },
  };
}

export function summarizeScannerRows(rows: ScannerFileMetadata[]): ScannerMetadataSummary {
  const serviceDistribution: Record<string, number> = {};
  const ecuDistribution: Record<string, number> = {};
  let totalSize = 0;
  let warnings = 0;
  let errors = 0;
  for (const row of rows) {
    totalSize += row.file_size || 0;
    warnings += row.warnings?.length || 0;
    errors += row.errors?.length || 0;
    for (const label of row.guessed_service_labels || []) serviceDistribution[label] = (serviceDistribution[label] || 0) + 1;
    const ecu = row.guessed_ecu_type || row.guessed_ecu_family;
    if (ecu) ecuDistribution[ecu] = (ecuDistribution[ecu] || 0) + 1;
  }
  return {
    total_files: rows.length,
    total_size_bytes: totalSize,
    total_size_gb: Number((totalSize / 1024 / 1024 / 1024).toFixed(3)),
    supported_files: rows.filter((row) => row.supported !== false).length,
    unsupported_files: rows.filter((row) => row.supported === false).length,
    duplicate_files: rows.filter((row) => Boolean(row.duplicate_hash_group)).length,
    archive_candidates: rows.filter((row) => row.archive_candidate).length,
    guessed_ori: rows.filter((row) => row.guessed_file_role === "ori").length,
    guessed_mod: rows.filter((row) => row.guessed_file_role === "mod").length,
    unknown_role: rows.filter((row) => !row.guessed_file_role || row.guessed_file_role === "unknown").length,
    warnings,
    errors,
    service_label_distribution: serviceDistribution,
    ecu_guess_distribution: ecuDistribution,
  };
}

export function createDatasetDryRunFromScannerRows(input: {
  rows: ScannerFileMetadata[];
  sourceType?: ImportSourceType;
  sourceName?: string | null;
  providerName?: string | null;
}): DatasetDryRunResult & { scanner_summary: ScannerMetadataSummary } {
  const dryRun = createDatasetDryRun({
    sourceType: input.sourceType || "local_dev_archive",
    sourceName: input.sourceName || "Local scanner metadata",
    providerName: input.providerName || null,
    files: input.rows.map(scannerRowToDescriptor),
  });
  return {
    ...dryRun,
    scanner_summary: summarizeScannerRows(input.rows),
  };
}
