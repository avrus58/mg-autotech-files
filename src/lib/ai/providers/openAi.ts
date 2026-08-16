import {
  fileExpertAiInstructions,
  fileExpertAiPromptVersion,
  fileExpertReportJsonSchema,
  modelSafeAnalyzerResult,
  modelSafeMetadata,
} from "@/lib/ai/prompt";
import type { AiReportProvider, AiReportRequest } from "@/lib/ai/types";

type ResponsesApiOutput = {
  output?: Array<{
    content?: Array<{ type?: string; text?: string }>;
  }>;
};

function responseText(payload: ResponsesApiOutput) {
  return (payload.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text" && typeof item.text === "string")
    .map((item) => item.text)
    .join("\n")
    .trim();
}

export class OpenAiReportProvider implements AiReportProvider {
  readonly name = "openai" as const;
  readonly modelName: string;

  constructor(
    private readonly apiKey: string,
    modelName = process.env.OPENAI_MODEL || "gpt-5.4-mini",
    private readonly baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"
  ) {
    this.modelName = modelName;
  }

  async generateReport(input: AiReportRequest, options?: { signal?: AbortSignal }) {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.modelName,
        instructions: fileExpertAiInstructions,
        input: JSON.stringify({ metadata: modelSafeMetadata(input.metadata), analyzer: modelSafeAnalyzerResult(input.result), similarity_evidence: input.similarityEvidence ?? null }),
        text: {
          format: {
            type: "json_schema",
            name: "mg_file_expert_report",
            strict: true,
            schema: fileExpertReportJsonSchema,
          },
        },
      }),
      signal: options?.signal ?? AbortSignal.timeout(45_000),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`OpenAI report request failed (${response.status}): ${detail.slice(0, 300)}`);
    }

    const payload = (await response.json()) as ResponsesApiOutput;
    const text = responseText(payload);
    if (!text) throw new Error("OpenAI report response did not contain output text.");

    const parsed = JSON.parse(text) as { executive_summary?: unknown; report?: unknown };
    if (typeof parsed.executive_summary !== "string" || typeof parsed.report !== "string") {
      throw new Error("OpenAI report response did not match the expected schema.");
    }

    return {
      provider: this.name,
      modelName: this.modelName,
      promptVersion: fileExpertAiPromptVersion,
      executiveSummary: parsed.executive_summary,
      report: parsed.report,
      outputJson: parsed as Record<string, unknown>,
    };
  }
}
