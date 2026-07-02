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

function changedRegionLines(result: FileExpertAnalyzerResult) {
  const blocks = result.comparison?.changed_blocks.slice(0, 8) ?? [];
  if (!blocks.length) return ["- No changed region is available for review."];
  return blocks.map((block) =>
    `- ${block.start_offset_hex}-${block.end_offset_hex}: ${block.changed_byte_count} changed bytes in a ${block.length}-byte grouped region.`
  );
}

function loggingRecommendations(result: FileExpertAnalyzerResult) {
  if (result.mode === "single_file" || result.summary.stock_or_modified !== "likely_modified") {
    return [
      "- No calibration-specific logging list can be justified from a single or unchanged file.",
      "- If drivability is being investigated, record RPM, requested/actual torque, boost and lambda only with a qualified operator and appropriate equipment.",
    ];
  }
  const moduleType = result.ecu_identification?.module_type;
  if (moduleType === "TCU") {
    return [
      "- Review input/output speed, selected/actual gear, clutch slip, clutch pressure, oil temperature and torque intervention.",
      "- Validate shift quality under controlled load; parameter names depend on the manufacturer and logging tool.",
    ];
  }
  return [
    "- Review RPM, accelerator/requested load, requested/actual torque, requested/actual boost, lambda/AFR, rail pressure and relevant temperatures.",
    "- Add ignition correction/knock information for petrol applications and smoke/air-mass information for diesel applications where available.",
    "- Parameter availability and safe test conditions must be confirmed by an experienced operator; use controlled road or dyno testing as appropriate.",
  ];
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
    "# Calibration Change Summary",
    changeProfile?.summary || "No calibration change profile is available.",
    `Map candidates: ${result.map_candidates.length}. Repeated binary patterns: ${result.repeated_patterns.length}. These are structural candidates, not proven map definitions.`,
    "",
    "# Important Changed Regions",
    ...changedRegionLines(result),
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
    "# Risk Assessment",
    `Risk level: ${result.risk_assessment.risk_level}`,
    `Analyzer confidence: ${Math.round(result.risk_assessment.confidence * 100)}%`,
    ...(result.risk_assessment.reasons.length ? result.risk_assessment.reasons.map((reason) => `- ${reason}`) : ["- No additional risk reason was produced."]),
    "",
    "# Recommended Logging Parameters",
    ...loggingRecommendations(result),
    "",
    "# Recommended Next Steps",
    ...result.summary.recommended_next_steps.map((item) => `- ${item}`),
    "",
    "# Disclaimer",
    "This automated report identifies binary evidence and likely matches; it does not guarantee file safety, legal suitability, exact map purpose, horsepower or torque. An experienced calibrator must confirm the result. Checksum correction must be verified with the flashing tool or professional checksum software before writing. Where a modification is present or suspected, validate the result with controlled vehicle logging and/or dyno testing as appropriate.",
  ].join("\n");

  return { executiveSummary, report };
}
