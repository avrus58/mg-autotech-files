import type { FileExpertAnalyzerResult } from "@/lib/fileExpert/types";

export function shouldPreserveCompletedFileExpertResult(input: {
  claimedFromStatus?: string | null;
  existingResult?: Pick<FileExpertAnalyzerResult, "analysis_version"> | null;
}) {
  return input.claimedFromStatus === "completed" ||
    Boolean(input.existingResult?.analysis_version);
}

export function failedFileExpertAnalysisState(input: {
  preserveCompletedResult: boolean;
  message: string;
}) {
  return input.preserveCompletedResult
    ? { status: "completed" as const, error_message: null }
    : { status: "failed" as const, error_message: input.message };
}
