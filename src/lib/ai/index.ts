import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { OllamaReportProvider } from "@/lib/ai/providers/ollama";
import { OpenAiReportProvider } from "@/lib/ai/providers/openAi";
import { OpenAiCompatibleReportProvider } from "@/lib/ai/providers/openAiCompatible";
import { RuleBasedAiReportProvider } from "@/lib/ai/providers/ruleBased";
import type { AiReportProvider, AiReportRequest } from "@/lib/ai/types";
import { modelSafeMetadata } from "@/lib/ai/prompt";

function configuredProvider(): AiReportProvider {
  const provider = (process.env.AI_PROVIDER || "rule_based").toLowerCase();

  if (provider === "openai" && process.env.OPENAI_API_KEY) {
    return new OpenAiReportProvider(process.env.OPENAI_API_KEY);
  }
  if (provider === "ollama" && process.env.OLLAMA_BASE_URL) return new OllamaReportProvider();
  if (provider === "vllm" && process.env.VLLM_BASE_URL) {
    return new OpenAiCompatibleReportProvider(
      "vllm",
      process.env.VLLM_MODEL || "mg-autotech-ecu",
      process.env.VLLM_BASE_URL,
      process.env.VLLM_API_KEY
    );
  }
  if (provider === "local" && process.env.LOCAL_AI_BASE_URL) {
    return new OpenAiCompatibleReportProvider(
      "local",
      process.env.LOCAL_AI_MODEL || "mg-autotech-ecu",
      process.env.LOCAL_AI_BASE_URL,
      process.env.LOCAL_AI_API_KEY
    );
  }
  return new RuleBasedAiReportProvider();
}

async function auditRun(input: {
  request: AiReportRequest;
  provider: AiReportProvider;
  startedAt: number;
  outputText?: string | null;
  outputJson?: Record<string, unknown> | null;
  error?: string | null;
}) {
  try {
    await getSupabaseAdmin().from("ai_model_runs").insert({
      source_type: input.request.sourceType,
      source_id: input.request.sourceId ?? null,
      provider: input.provider.name,
      model_name: input.provider.modelName,
      prompt_version: "ecu-file-expert-report-v1",
      input_json: {
        metadata: modelSafeMetadata(input.request.metadata),
        analysis_version: input.request.result.analysis_version,
        pattern_signature: input.request.result.pattern_signature ?? null,
        similarity_evidence: input.request.similarityEvidence ?? null,
      },
      output_text: input.outputText ?? null,
      output_json: input.outputJson ?? null,
      latency_ms: Date.now() - input.startedAt,
      error_message: input.error ?? null,
    });
  } catch {
    // Model-run auditing is best effort and must never break the report.
  }
}

export async function generateAiFileExpertReport(request: AiReportRequest) {
  const provider = configuredProvider();
  const startedAt = Date.now();

  try {
    const output = await provider.generateReport(request);
    await auditRun({
      request,
      provider,
      startedAt,
      outputText: output.report,
      outputJson: output.outputJson,
    });
    return output;
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI report provider failed.";
    await auditRun({ request, provider, startedAt, error: message });

    const fallback = new RuleBasedAiReportProvider();
    const fallbackStartedAt = Date.now();
    const output = await fallback.generateReport(request);
    await auditRun({
      request,
      provider: fallback,
      startedAt: fallbackStartedAt,
      outputText: output.report,
      outputJson: { fallback_reason: message },
    });
    return output;
  }
}

export type { AiReportRequest, AiReportResponse, AiProviderName } from "@/lib/ai/types";
