import { fileExpertAiInstructions, fileExpertAiPromptVersion, modelSafeAnalyzerResult, modelSafeMetadata } from "@/lib/ai/prompt";
import type { AiReportProvider, AiReportRequest } from "@/lib/ai/types";

export class OllamaReportProvider implements AiReportProvider {
  readonly name = "ollama" as const;

  constructor(
    readonly modelName = process.env.OLLAMA_MODEL || "gpt-oss:20b",
    private readonly baseUrl = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434"
  ) {}

  async generateReport(input: AiReportRequest) {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.modelName,
        stream: false,
        format: "json",
        options: { temperature: 0.1 },
        messages: [
          { role: "system", content: fileExpertAiInstructions },
          { role: "user", content: JSON.stringify({ metadata: modelSafeMetadata(input.metadata), analyzer: modelSafeAnalyzerResult(input.result), similarity_evidence: input.similarityEvidence ?? null }) },
        ],
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) throw new Error(`Ollama report request failed (${response.status}).`);
    const payload = (await response.json()) as { message?: { content?: string } };
    if (!payload.message?.content) throw new Error("Ollama report response was empty.");
    const parsed = JSON.parse(payload.message.content) as { executive_summary?: unknown; report?: unknown };
    if (typeof parsed.executive_summary !== "string" || typeof parsed.report !== "string") {
      throw new Error("Ollama report response did not match the expected schema.");
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
