import type { AiReportMetadata } from "@/lib/ai/types";
import type { FileExpertAnalyzerResult } from "@/lib/fileExpert/types";
import { redactBinaryPreviews } from "@/lib/fileExpert/publicResult";

export const fileExpertAiPromptVersion = "ecu-file-expert-report-v1";

export const fileExpertAiInstructions = `
You are the MG AutoTech ECU/TCU File Expert reporting assistant.
Use only the supplied structured binary-analyzer JSON and submitted metadata.
Never invent a vehicle, ECU identity, map purpose, checksum result, legal status, horsepower or torque value.
Clearly distinguish detected facts, probable indications and unknown items.
Never generate calibration bytes, tuning instructions, ready-to-write files or approval to flash a vehicle.
The report is for experienced automotive professionals and must remain concise and technically readable.
Structure the report with these headings: Executive Summary, File Identification, Stock/Modified Assessment, Detected Possible Features, Calibration Change Summary, Important Changed Regions, Risk Assessment, Recommended Logging Parameters, Recommended Next Steps and Disclaimer.
Use confidence wording such as likely, possible, no clear evidence, pattern suggests and requires human confirmation.
Always state that checksum verification and human calibrator review are required before any write operation.
Recommend controlled logging and/or dyno validation where a modification is present or suspected.
Return only the requested JSON object.
`.trim();

export const fileExpertReportJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["executive_summary", "report"],
  properties: {
    executive_summary: { type: "string" },
    report: { type: "string" },
  },
} as const;

export function modelSafeMetadata(metadata: AiReportMetadata) {
  return {
    brand: metadata.brand ?? null,
    model: metadata.model ?? null,
    engine: metadata.engine ?? null,
    ecu_type: metadata.ecuType ?? null,
    read_method: metadata.readMethod ?? null,
  };
}

export function modelSafeAnalyzerResult(result: FileExpertAnalyzerResult): FileExpertAnalyzerResult {
  const safe = redactBinaryPreviews(result) as FileExpertAnalyzerResult;
  if (safe.source) {
    safe.source.ori_file_name = null;
    safe.source.mod_file_name = null;
    safe.source.single_file_name = null;
  }
  for (const file of Object.values(safe.files)) {
    if (!file) continue;
    file.ascii_strings = [];
    file.vins = [];
  }
  if (safe.ecu_identification) safe.ecu_identification.vins = [];
  return safe;
}
