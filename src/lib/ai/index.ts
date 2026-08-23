import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { OllamaReportProvider } from "@/lib/ai/providers/ollama";
import { OpenAiReportProvider } from "@/lib/ai/providers/openAi";
import { OpenAiCompatibleReportProvider } from "@/lib/ai/providers/openAiCompatible";
import { RuleBasedAiReportProvider } from "@/lib/ai/providers/ruleBased";
import type { AiReportGenerationMetadata, AiReportProvider, AiReportRequest, AiReportResponse } from "@/lib/ai/types";
import { modelSafeMetadata } from "@/lib/ai/prompt";

const fileExpertDeterministicFallbackReserveMs = 750;

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

function redactProviderError(message: string) {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]")
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, "[redacted-api-key]")
    .slice(0, 300);
}

function attachGeneration(
  output: AiReportResponse,
  generation: AiReportGenerationMetadata
): AiReportResponse {
  return {
    ...output,
    generation,
  };
}

function successfulGenerationMetadata(
  provider: AiReportProvider,
  output: AiReportResponse
): AiReportGenerationMetadata {
  const usedRuleFallback = output.provider === "rule_based";
  return {
    state: usedRuleFallback ? "deterministic_fallback" : "provider_generated",
    requestedProvider: {
      name: provider.name,
      modelName: provider.modelName,
      status: usedRuleFallback ? "unavailable" : "available",
    },
    executedProvider: {
      name: output.provider,
      modelName: output.modelName,
      promptVersion: output.promptVersion,
    },
    fallback: {
      used: usedRuleFallback,
      reason: usedRuleFallback ? "no_configured_provider" : null,
      message: usedRuleFallback
        ? "No external AI report provider is configured; a deterministic local report was generated."
        : null,
    },
    isAiGenerated: !usedRuleFallback,
  };
}

function providerErrorGenerationMetadata(input: {
  provider: AiReportProvider;
  output: AiReportResponse;
  errorMessage: string;
}): AiReportGenerationMetadata {
  return {
    state: "provider_error_fallback",
    requestedProvider: {
      name: input.provider.name,
      modelName: input.provider.modelName,
      status: "failed",
    },
    executedProvider: {
      name: input.output.provider,
      modelName: input.output.modelName,
      promptVersion: input.output.promptVersion,
    },
    fallback: {
      used: true,
      reason: "provider_error",
      message: `Configured AI report provider failed; deterministic local report was generated. ${redactProviderError(input.errorMessage)}`,
    },
    isAiGenerated: false,
  };
}

async function settleBeforeDeadline<T>(operation: Promise<T>, deadlineAt: number) {
  const remainingMs = deadlineAt - Date.now();
  if (remainingMs <= 0) {
    throw new Error("AI report provider exceeded the File Expert deadline.");
  }

  let timeout: ReturnType<typeof setTimeout> | null = null;
  const deadline = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(
      () => reject(new Error("AI report provider exceeded the File Expert deadline.")),
      remainingMs
    );
  });
  try {
    return await Promise.race([operation, deadline]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function auditBeforeDeadline(
  operations: Array<Promise<unknown>>,
  deadlineAt: number | undefined
) {
  if (!deadlineAt) {
    await Promise.allSettled(operations);
    return;
  }
  if (Date.now() >= deadlineAt) return;
  await settleBeforeDeadline(Promise.allSettled(operations), deadlineAt).catch(() => undefined);
}

export async function generateAiFileExpertReport(
  request: AiReportRequest,
  options: { provider?: AiReportProvider; deadlineAt?: number } = {}
) {
  const provider = options.provider ?? configuredProvider();
  const startedAt = Date.now();
  const providerDeadlineAt = options.deadlineAt && provider.name !== "rule_based"
    ? options.deadlineAt - fileExpertDeterministicFallbackReserveMs
    : null;
  const controller = providerDeadlineAt ? new AbortController() : null;
  const abortDelayMs = providerDeadlineAt ? providerDeadlineAt - Date.now() : null;
  if (controller && abortDelayMs !== null && abortDelayMs <= 0) controller.abort();
  const abortTimeout = controller && abortDelayMs !== null && abortDelayMs > 0
    ? setTimeout(() => controller.abort(), abortDelayMs)
    : null;

  try {
    const generation = provider.generateReport(request, { signal: controller?.signal });
    const output = providerDeadlineAt
      ? await settleBeforeDeadline(generation, providerDeadlineAt)
      : await generation;
    await auditBeforeDeadline([
      auditRun({
        request,
        provider,
        startedAt,
        outputText: output.report,
        outputJson: output.outputJson,
      }),
    ], options.deadlineAt);
    return attachGeneration(output, successfulGenerationMetadata(provider, output));
  } catch (error) {
    if (controller && !controller.signal.aborted) controller.abort();
    const message = error instanceof Error ? error.message : "AI report provider failed.";
    const safeMessage = redactProviderError(message);

    const fallback = new RuleBasedAiReportProvider();
    const fallbackStartedAt = Date.now();
    const output = await fallback.generateReport(request);
    await auditBeforeDeadline([
      auditRun({ request, provider, startedAt, error: safeMessage }),
      auditRun({
        request,
        provider: fallback,
        startedAt: fallbackStartedAt,
        outputText: output.report,
        outputJson: { fallback_reason: safeMessage },
      }),
    ], options.deadlineAt);
    return attachGeneration(
      output,
      providerErrorGenerationMetadata({ provider, output, errorMessage: safeMessage })
    );
  } finally {
    if (abortTimeout) clearTimeout(abortTimeout);
    if (controller && !controller.signal.aborted) controller.abort();
  }
}

export type { AiReportRequest, AiReportResponse, AiProviderName } from "@/lib/ai/types";
