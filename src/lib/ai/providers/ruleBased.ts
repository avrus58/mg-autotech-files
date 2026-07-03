import { generateFileExpertReport } from "@/lib/fileExpert/report";
import { fileExpertAiPromptVersion } from "@/lib/ai/prompt";
import type { AiReportProvider } from "@/lib/ai/types";

export class RuleBasedAiReportProvider implements AiReportProvider {
  readonly name = "rule_based" as const;
  readonly modelName = null;

  async generateReport(input: Parameters<AiReportProvider["generateReport"]>[0]) {
    const generated = generateFileExpertReport({
      result: input.result,
      metadata: input.metadata,
      similarityEvidence: input.similarityEvidence,
    });

    return {
      provider: this.name,
      modelName: this.modelName,
      promptVersion: fileExpertAiPromptVersion,
      executiveSummary: generated.executiveSummary,
      report: generated.report,
      outputJson: null,
    };
  }
}
