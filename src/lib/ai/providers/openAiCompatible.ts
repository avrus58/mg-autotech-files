import { fileExpertAiInstructions, fileExpertAiPromptVersion, modelSafeAnalyzerResult, modelSafeMetadata } from "@/lib/ai/prompt";
import type { AiProviderName, AiReportProvider, AiReportRequest } from "@/lib/ai/types";

export class OpenAiCompatibleReportProvider implements AiReportProvider {
  constructor(
    readonly name: AiProviderName,
    readonly modelName: string,
    private readonly baseUrl: string,
    private readonly apiKey?: string
  ) {}

  async generateReport(input: AiReportRequest) {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: this.modelName,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: fileExpertAiInstructions },
          {
            role: "user",
            content: JSON.stringify({ metadata: modelSafeMetadata(input.metadata), analyzer: modelSafeAnalyzerResult(input.result), similarity_evidence: input.similarityEvidence ?? null }),
          },
        ],
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!response.ok) {
      throw new Error(`${this.name} report request failed (${response.status}).`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error(`${this.name} report response was empty.`);
    const parsed = JSON.parse(content) as { executive_summary?: unknown; report?: unknown };
    if (typeof parsed.executive_summary !== "string" || typeof parsed.report !== "string") {
      throw new Error(`${this.name} report response did not match the expected schema.`);
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
