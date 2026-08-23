import type { FileExpertAnalyzerResult } from "@/lib/fileExpert/types";
import {
  projectFileExpertAiReportStatusForCustomer,
  type FileExpertAiReportStatus,
} from "@/lib/fileExpert/reportStatus";

const customerSafeJobKeys = [
  "id",
  "user_id",
  "status",
  "brand",
  "model",
  "engine",
  "ecu_type",
  "ecu_family",
  "sw_number",
  "hw_number",
  "read_method",
  "customer_notes",
  "ori_file_name",
  "mod_file_name",
  "ori_file_size",
  "mod_file_size",
  "result_json",
  "executive_summary",
  "detected_features",
  "risk_level",
  "error_message",
  "created_at",
  "updated_at",
] as const;

const forbiddenCustomerKeyPatterns = [
  /path/i,
  /provider/i,
  /fallback/i,
  /modelName/i,
  /prompt/i,
  /requestedName/i,
  /executedName/i,
  /^source$/i,
  /source_type/i,
  /sourceType/,
  /source_reference/i,
  /sourceReference/,
  /sample_id/i,
  /sampleId/,
  /training_sample_id/i,
  /trainingSampleId/,
  /storage/i,
  /binary/i,
  /raw/i,
  /preview/i,
  /offset/i,
  /hex/i,
  /sha/i,
  /signature/i,
  /vin/i,
  /confidence_score/i,
  /admin/i,
];

export function redactBinaryPreviews(result: FileExpertAnalyzerResult | null | undefined) {
  if (!result) return result ?? null;
  const safe = structuredClone(result);

  for (const file of Object.values(safe.files)) {
    if (!file) continue;
    file.first_64_bytes_hex = "[redacted]";
    file.last_64_bytes_hex = "[redacted]";
    file.ascii_strings = [];
  }
  if (safe.comparison) {
    safe.comparison.changed_blocks = safe.comparison.changed_blocks.map((block) => ({
      ...block,
      ori_hex_preview: "[redacted]",
      mod_hex_preview: "[redacted]",
      unsigned_8bit_preview: [],
      signed_8bit_preview: [],
      uint16_be_preview: [],
      uint16_le_preview: [],
      delta_preview: [],
    }));
  }
  return safe;
}

function stripForbiddenCustomerKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripForbiddenCustomerKeys);
  if (!value || typeof value !== "object") return value;

  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (forbiddenCustomerKeyPatterns.some((pattern) => pattern.test(key))) continue;
    output[key] = stripForbiddenCustomerKeys(entry);
  }
  return output;
}

export function redactFileExpertResultForCustomer(result: FileExpertAnalyzerResult | null | undefined) {
  if (!result) return result ?? null;
  const safe = structuredClone(result);

  for (const file of Object.values(safe.files)) {
    if (!file) continue;
    file.first_64_bytes_hex = "[redacted]";
    file.last_64_bytes_hex = "[redacted]";
    file.ascii_strings = [];
    file.sha256 = "[redacted]";
  }

  if (safe.comparison) {
    safe.comparison.changed_blocks = safe.comparison.changed_blocks.map((block) => ({
      start_offset_hex: "[redacted]",
      end_offset_hex: "[redacted]",
      length: block.length,
      changed_byte_count: block.changed_byte_count,
      ori_hex_preview: "[redacted]",
      mod_hex_preview: "[redacted]",
      unsigned_8bit_preview: [],
      signed_8bit_preview: [],
      uint16_be_preview: [],
      uint16_le_preview: [],
      delta_preview: [],
    }));
  }

  safe.active_regions = [];
  safe.map_candidates = safe.map_candidates.map((candidate) => ({
    offset_hex: "[redacted]",
    length: candidate.length,
    possible_type: candidate.possible_type,
    reason: candidate.reason,
    confidence: candidate.confidence,
  }));
  safe.repeated_patterns = [];

  if (safe.pattern_signature) {
    safe.pattern_signature = {
      ...safe.pattern_signature,
      map_candidates: [],
      repeated_patterns: [],
      main_regions: [],
      repeated_patterns_summary: [],
      map_candidates_summary: [],
    };
  }

  if (safe.ai_report_status) {
    safe.ai_report_status = projectFileExpertAiReportStatusForCustomer(
      safe.ai_report_status as FileExpertAiReportStatus
    ) as never;
  }

  return stripForbiddenCustomerKeys(safe);
}

export function sanitizeFileExpertJobForCustomer(job: Record<string, unknown>) {
  const safe: Record<string, unknown> = {};
  for (const key of customerSafeJobKeys) {
    if (key === "result_json") {
      safe.result_json = redactFileExpertResultForCustomer(job.result_json as FileExpertAnalyzerResult | null | undefined);
      continue;
    }
    if (key === "error_message" && job.error_message) {
      safe.error_message = "Analysis failed. Please retry or contact support.";
      continue;
    }
    if (key in job) safe[key] = job[key];
  }
  return stripForbiddenCustomerKeys(safe) as Record<string, unknown>;
}

export function sanitizeFileExpertJobsForCustomer(jobs: Array<Record<string, unknown>>) {
  return jobs.map((job) => sanitizeFileExpertJobForCustomer(job));
}

export function hasFileExpertCustomerLeak(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasFileExpertCustomerLeak);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value as Record<string, unknown>).some(
    ([key, entry]) =>
      forbiddenCustomerKeyPatterns.some((pattern) => pattern.test(key)) ||
      hasFileExpertCustomerLeak(entry)
  );
}
