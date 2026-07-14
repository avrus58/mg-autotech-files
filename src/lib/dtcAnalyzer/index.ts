import {
  buildDeterministicDtcFallback,
  buildInvalidDtcInputResponse,
  buildProviderUnavailableDtcResponse,
  erroredDtcProviderIdentity,
  normalizeDtcInput,
} from "@/lib/dtcAnalyzer/fallback";
import type {
  DtcAnalyzerProvider,
  DtcAnalyzerRequest,
  DtcAnalyzerResponse,
} from "@/lib/dtcAnalyzer/types";

export * from "@/lib/dtcAnalyzer/fallback";
export * from "@/lib/dtcAnalyzer/rolloutReadiness";
export * from "@/lib/dtcAnalyzer/types";

export class UnavailableDtcAnalyzerProvider implements DtcAnalyzerProvider {
  readonly providerId = "unconfigured_dtc_ai_provider";
  readonly providerKind = "unconfigured" as const;
  readonly modelName = null;

  constructor(private readonly reason = "No DTC AI provider is configured for local analysis.") {}

  async analyzeDtc(input: DtcAnalyzerRequest): Promise<DtcAnalyzerResponse> {
    return buildProviderUnavailableDtcResponse(input, this.reason);
  }
}

export class DeterministicDtcFallbackProvider implements DtcAnalyzerProvider {
  readonly providerId = "deterministic_rules";
  readonly providerKind = "deterministic_rules" as const;
  readonly modelName = null;

  async analyzeDtc(input: DtcAnalyzerRequest): Promise<DtcAnalyzerResponse> {
    return buildDeterministicDtcFallback(input);
  }
}

export async function analyzeDtcText(
  request: DtcAnalyzerRequest,
  options: { provider?: DtcAnalyzerProvider } = {}
): Promise<DtcAnalyzerResponse> {
  const normalizedInput = normalizeDtcInput(request.text);
  if (normalizedInput.invalidReason) {
    return buildInvalidDtcInputResponse(request, normalizedInput);
  }

  const provider = options.provider ?? new UnavailableDtcAnalyzerProvider();

  try {
    const providerResponse = await provider.analyzeDtc(request);
    if (providerResponse.status === "provider_unavailable") {
      return buildDeterministicDtcFallback(request, normalizedInput, {
        provider: providerResponse.provider,
        reason: providerResponse.provider.unavailableReason ?? "DTC analyzer provider is unavailable.",
      });
    }
    return providerResponse;
  } catch {
    return buildDeterministicDtcFallback(request, normalizedInput, {
      provider: erroredDtcProviderIdentity(provider),
      reason: "Configured DTC analyzer provider failed locally; deterministic fallback used.",
    });
  }
}
