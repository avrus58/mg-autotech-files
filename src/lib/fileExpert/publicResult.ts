import type { FileExpertAnalyzerResult } from "@/lib/fileExpert/types";

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
