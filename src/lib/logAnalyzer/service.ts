import {
  buildDeterministicLogAnalyzerFallback,
  buildInvalidLogAnalyzerInputResponse,
  buildProviderUnavailableLogAnalyzerResponse,
  erroredLogAnalyzerProviderIdentity,
  normalizeLogAnalyzerInput,
} from "@/lib/logAnalyzer/fallback";
import type {
  LogAnalyzerProvider,
  LogAnalyzerRequest,
  LogAnalyzerResponse,
} from "@/lib/logAnalyzer/types";

export class UnavailableLogAnalyzerProvider implements LogAnalyzerProvider {
  readonly providerId = "unconfigured_log_analyzer_provider";
  readonly providerKind = "unconfigured" as const;
  readonly modelName = null;

  constructor(private readonly reason = "No Log Analyzer provider is configured for local analysis.") {}

  async analyzeLog(input: LogAnalyzerRequest): Promise<LogAnalyzerResponse> {
    return buildProviderUnavailableLogAnalyzerResponse(input, this.reason);
  }
}

export class DeterministicLogAnalyzerFallbackProvider implements LogAnalyzerProvider {
  readonly providerId = "deterministic_rules";
  readonly providerKind = "deterministic_rules" as const;
  readonly modelName = null;

  async analyzeLog(input: LogAnalyzerRequest): Promise<LogAnalyzerResponse> {
    return buildDeterministicLogAnalyzerFallback(input);
  }
}

export async function analyzeLogRequest(
  request: LogAnalyzerRequest,
  options: { provider?: LogAnalyzerProvider } = {}
): Promise<LogAnalyzerResponse> {
  const normalizedInput = normalizeLogAnalyzerInput(request);
  if (normalizedInput.invalidReason) {
    return buildInvalidLogAnalyzerInputResponse(request, normalizedInput);
  }

  const provider = options.provider ?? new UnavailableLogAnalyzerProvider();

  try {
    const providerResponse = await provider.analyzeLog(request);
    if (providerResponse.status === "provider_unavailable") {
      return buildDeterministicLogAnalyzerFallback(request, undefined, {
        provider: providerResponse.provider,
        reason: providerResponse.provider.unavailableReason ?? "Log Analyzer provider is unavailable.",
      });
    }
    return providerResponse;
  } catch {
    return buildDeterministicLogAnalyzerFallback(request, undefined, {
      provider: erroredLogAnalyzerProviderIdentity(provider),
      reason: "Configured Log Analyzer provider failed locally; deterministic fallback used.",
    });
  }
}
