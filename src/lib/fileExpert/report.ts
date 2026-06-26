import type { FileExpertAnalyzerResult } from "@/lib/fileExpert/types";
import { fileExpertFeatureLabels } from "@/lib/fileExpert/types";

export const fileExpertReportPromptTemplate = `
You are MG AutoTech AI File Expert.
Use only the structured analyzer JSON and submitted vehicle metadata.
Do not generate tuning files.
Do not claim guaranteed safety.
Use words like possible, likely, no clear evidence, requires human confirmation.
Always include checksum and human calibrator disclaimer.
`;

function percent(value: number | undefined) {
  if (typeof value !== "number") return "-";
  return `${value.toFixed(value < 1 ? 4 : 2)}%`;
}

function shortHash(value?: string) {
  return value ? `${value.slice(0, 12)}...` : "-";
}

function formatFeatureList(result: FileExpertAnalyzerResult) {
  if (result.possible_features.length === 0) {
    return "No specific feature pattern was detected with useful confidence.";
  }

  return result.possible_features
    .map((item) => {
      const label = fileExpertFeatureLabels[item.feature] ?? item.feature;
      const reasons = item.reasons.length ? ` Reason: ${item.reasons.join(" ")}` : "";
      return `- ${label}: possible confidence ${(item.confidence * 100).toFixed(0)}%.${reasons}`;
    })
    .join("\n");
}

function fileLine(label: string, file?: { file_size: number; sha256: string; entropy: number; ecu_identifiers: string[] }) {
  if (!file) return `- ${label}: not uploaded`;
  return `- ${label}: ${file.file_size.toLocaleString()} bytes, SHA256 ${shortHash(file.sha256)}, entropy ${file.entropy}, identifiers ${file.ecu_identifiers.join(", ") || "none detected"}`;
}

export function generateFileExpertReport(input: {
  result: FileExpertAnalyzerResult;
  metadata: {
    brand?: string | null;
    model?: string | null;
    engine?: string | null;
    ecuType?: string | null;
    readMethod?: string | null;
    customerNotes?: string | null;
  };
}) {
  const { result, metadata } = input;
  const comparison = result.comparison;
  const vehicle = [metadata.brand, metadata.model, metadata.engine].filter(Boolean).join(" ") || "Vehicle not specified";
  const features = formatFeatureList(result);
  const changedBlocks = comparison?.changed_blocks.slice(0, 10) ?? [];
  const maps = result.map_candidates.slice(0, 10);
  const warnings = result.risk_assessment.warnings.map((item) => `- ${item}`).join("\n");

  const executiveSummary =
    result.mode === "ori_mod_compare"
      ? `${vehicle}: ${result.summary.main_conclusion} ${comparison ? `${comparison.changed_bytes.toLocaleString()} bytes changed across ${comparison.merged_changed_blocks} merged regions.` : ""}`
      : `${vehicle}: single file inspection completed. No ORI/MOD comparison was available.`;

  const report = [
    "# Executive Summary",
    executiveSummary,
    "",
    "# File Identification",
    `Vehicle: ${vehicle}`,
    `ECU / TCU: ${metadata.ecuType || "-"}`,
    `Read method: ${metadata.readMethod || "-"}`,
    fileLine("ORI", result.files.ori),
    fileLine("MOD", result.files.mod),
    fileLine("Single", result.files.single),
    "",
    "# Stock/Modified Assessment",
    `Assessment: ${result.summary.stock_or_modified.replaceAll("_", " ")}`,
    comparison
      ? `Changed bytes: ${comparison.changed_bytes.toLocaleString()} (${percent(comparison.changed_percent)}). Same size: ${comparison.same_size ? "yes" : "no"}.`
      : "No comparison data available.",
    "",
    "# Detected Possible Features",
    features,
    "",
    "# Calibration Change Summary",
    comparison
      ? `The comparison found ${comparison.raw_changed_blocks} raw changed blocks and ${comparison.merged_changed_blocks} merged changed regions. This is a first-level binary review, not a map-definition export.`
      : "Single file mode can identify strings, entropy and active regions, but cannot confirm modified features.",
    "",
    "# Important Changed Regions",
    changedBlocks.length
      ? changedBlocks
          .map((block) => `- ${block.start_offset_hex} - ${block.end_offset_hex}: ${block.changed_byte_count} changed bytes, length ${block.length}`)
          .join("\n")
      : "No changed regions available.",
    "",
    "# Map Candidates",
    maps.length
      ? maps
          .map((item) => `- ${item.offset_hex}: ${item.length} bytes, confidence ${(item.confidence * 100).toFixed(0)}%. ${item.reason}`)
          .join("\n")
      : "No clear map candidates were detected in this first-level analysis.",
    "",
    "# Risk Assessment",
    `Risk level: ${result.risk_assessment.risk_level}`,
    `Analyzer confidence: ${(result.risk_assessment.confidence * 100).toFixed(0)}%`,
    result.risk_assessment.reasons.map((item) => `- ${item}`).join("\n") || "- No additional risk reasons.",
    "",
    "# Recommended Logging Parameters",
    "- Boost pressure request vs actual",
    "- Rail pressure request vs actual",
    "- Air mass request vs actual",
    "- Lambda / AFR where available",
    "- Exhaust gas temperature where available",
    "- Torque request, torque limiters and gearbox torque intervention",
    "- DTC scan before and after road test",
    "",
    "# Recommended Next Steps",
    result.summary.recommended_next_steps.map((item) => `- ${item}`).join("\n"),
    "",
    "# Warnings",
    warnings,
    "",
    "# Disclaimer",
    "This report is an automated analysis and does not guarantee file safety. Final verification must be performed by an experienced calibrator. Checksum correction must be verified with the flashing tool or professional checksum software before writing.",
  ].join("\n");

  return {
    executiveSummary,
    report,
  };
}
