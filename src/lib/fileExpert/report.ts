import type { FileExpertAnalyzerResult, FileExpertFileInspection } from "@/lib/fileExpert/types";
import { fileExpertFeatureLabels } from "@/lib/fileExpert/types";

export const fileExpertReportPromptTemplate = `
You are MG AutoTech AI File Expert.
Use only the structured analyzer JSON and submitted vehicle metadata.
Do not generate tuning files or invent exact vehicle, engine, map or checksum results.
Clearly separate detected facts, probable matches and items requiring human confirmation.
Always include checksum and human calibrator disclaimers.
`;

function percent(value: number | undefined) {
  if (typeof value !== "number") return "-";
  return `${value.toFixed(value < 1 ? 4 : 2)}%`;
}

function shortHash(value?: string) {
  return value ? `${value.slice(0, 12)}...` : "-";
}

function list(values: string[] | undefined) {
  return values?.length ? values.join(", ") : "not detected";
}

function formatFeatureList(result: FileExpertAnalyzerResult) {
  if (result.possible_features.length === 0) {
    return "No specific operation can be named from the available evidence.";
  }

  return result.possible_features
    .map((item) => {
      const label = fileExpertFeatureLabels[item.feature] ?? item.feature;
      return `- ${label}: ${Math.round(item.confidence * 100)}% indication. ${item.reasons.join(" ")}`;
    })
    .join("\n");
}

function fileLine(label: string, file?: FileExpertFileInspection) {
  if (!file) return `- ${label}: not uploaded`;
  const format = (file.file_format || "unknown").replaceAll("_", " ");
  const scope = (file.read_scope || "unknown").replaceAll("_", " ");
  return `- ${label}: ${file.file_size.toLocaleString()} bytes, ${format}, ${scope}, SHA256 ${shortHash(file.sha256)}`;
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
  const identity = result.ecu_identification;
  const changeProfile = result.change_profile;
  const integrity = result.integrity_assessment;
  const vehicle = [metadata.brand, metadata.model, metadata.engine].filter(Boolean).join(" ") || "Vehicle not supplied";
  const detectedEcu = identity?.display_name || metadata.ecuType || "Control unit not identified";
  const changeSummary = changeProfile?.summary || result.summary.main_conclusion;
  const executiveSummary = `${detectedEcu}: ${changeSummary}`;

  const report = [
    "# Expert Conclusion",
    executiveSummary,
    "",
    "# Control Unit Identification",
    `Detected unit: ${detectedEcu}`,
    `Detection status: ${identity?.status || "not detected"}`,
    `Module type: ${identity?.module_type || "unknown"}`,
    `Supplier: ${identity?.supplier || "not detected"}`,
    `Family / variant: ${identity?.variant || identity?.family || "not detected"}`,
    `Processor: ${identity?.processor || "not detected"}`,
    `Identification confidence: ${identity ? Math.round(identity.confidence * 100) : 0}%`,
    `Hardware numbers: ${list(identity?.hardware_numbers)}`,
    `Software numbers: ${list(identity?.software_numbers)}`,
    `Calibration IDs: ${list(identity?.calibration_ids)}`,
    `VIN identifiers: ${list(identity?.vins)}`,
    `Engine code markers: ${list(identity?.engine_codes)}`,
    "",
    "# Vehicle Assessment",
    `Submitted vehicle: ${vehicle}`,
    result.vehicle_match?.summary || "No automatic vehicle application match is available.",
    "Exact vehicle and engine are only reported when supported by file identifiers; ECU-family compatibility alone is not treated as proof.",
    "",
    "# Uploaded File Profile",
    `Read method supplied by customer: ${metadata.readMethod || "unknown"}`,
    fileLine("ORI", result.files.ori),
    fileLine("MOD", result.files.mod),
    fileLine("Single file", result.files.single),
    "",
    "# Modification Assessment",
    `Result: ${changeProfile?.label || result.summary.stock_or_modified.replaceAll("_", " ")}`,
    changeSummary,
    comparison
      ? `${comparison.changed_bytes.toLocaleString()} bytes differ across ${comparison.merged_changed_blocks} grouped regions (${percent(comparison.changed_percent)} of the file).`
      : "A matching ORI/MOD pair was not available, so modification status cannot be confirmed.",
    "",
    "# Possible Operations",
    formatFeatureList(result),
    "Low-confidence operation labels are indications only. Exact DPF, EGR, AdBlue, DTC, VMAX or tuning-stage confirmation requires ECU-specific map definitions or a known verified pattern.",
    "",
    "# File Integrity",
    `File size match: ${integrity?.file_size_match === null || integrity?.file_size_match === undefined ? "not applicable" : integrity.file_size_match ? "yes" : "no"}`,
    `ECU identity match: ${integrity?.ecu_identity_match === null || integrity?.ecu_identity_match === undefined ? "not proven" : integrity.ecu_identity_match ? "yes" : "no"}`,
    `VIN match: ${integrity?.vin_match === null || integrity?.vin_match === undefined ? "not available" : integrity.vin_match ? "yes" : "no"}`,
    "Checksum status: not checked",
    ...(integrity?.issues.length ? integrity.issues.map((issue) => `- ${issue}`) : ["- No obvious structural conflict was detected."]),
    "",
    "# Recommended Next Steps",
    ...result.summary.recommended_next_steps.map((item) => `- ${item}`),
    "",
    "# Disclaimer",
    "This automated report identifies binary evidence and likely matches; it does not guarantee file safety or exact map purpose. An experienced calibrator must confirm the result. Checksum correction must be verified with the flashing tool or professional checksum software before writing.",
  ].join("\n");

  return { executiveSummary, report };
}
