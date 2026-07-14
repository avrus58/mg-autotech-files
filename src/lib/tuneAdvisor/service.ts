import {
  buildDeterministicTuneAdvisorFallback,
  buildInvalidTuneAdvisorInputResponse,
  buildProviderUnavailableTuneAdvisorResponse,
  erroredTuneAdvisorProviderIdentity,
  normalizeTuneAdvisorService,
} from "@/lib/tuneAdvisor/fallback";
import type {
  TuneAdvisorProvider,
  TuneAdvisorRequest,
  TuneAdvisorResponse,
} from "@/lib/tuneAdvisor/types";

export class UnavailableTuneAdvisorProvider implements TuneAdvisorProvider {
  readonly providerId = "unconfigured_tune_advisor_provider";
  readonly providerKind = "unconfigured" as const;
  readonly modelName = null;

  constructor(private readonly reason = "No Tune Advisor provider is configured for local analysis.") {}

  async analyzeTuneRequest(input: TuneAdvisorRequest): Promise<TuneAdvisorResponse> {
    return buildProviderUnavailableTuneAdvisorResponse(input, this.reason);
  }
}

export class DeterministicTuneAdvisorFallbackProvider implements TuneAdvisorProvider {
  readonly providerId = "deterministic_rules";
  readonly providerKind = "deterministic_rules" as const;
  readonly modelName = null;

  async analyzeTuneRequest(input: TuneAdvisorRequest): Promise<TuneAdvisorResponse> {
    return buildDeterministicTuneAdvisorFallback(input);
  }
}

export async function analyzeTuneAdvisorRequest(
  request: TuneAdvisorRequest,
  options: { provider?: TuneAdvisorProvider } = {}
): Promise<TuneAdvisorResponse> {
  const normalizedService = normalizeTuneAdvisorService(request.services);
  if (normalizedService.invalidReason) {
    return buildInvalidTuneAdvisorInputResponse(request, normalizedService);
  }

  const provider = options.provider ?? new UnavailableTuneAdvisorProvider();

  try {
    const providerResponse = await provider.analyzeTuneRequest(request);
    if (providerResponse.status === "provider_unavailable") {
      return buildDeterministicTuneAdvisorFallback(request, normalizedService, {
        provider: providerResponse.provider,
        reason: providerResponse.provider.unavailableReason ?? "Tune Advisor provider is unavailable.",
      });
    }
    return providerResponse;
  } catch {
    return buildDeterministicTuneAdvisorFallback(request, normalizedService, {
      provider: erroredTuneAdvisorProviderIdentity(provider),
      reason: "Configured Tune Advisor provider failed locally; deterministic fallback used.",
    });
  }
}
