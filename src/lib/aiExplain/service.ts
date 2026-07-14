import { buildAiExplainSourceLabels, sourceCategoryLabel } from "@/lib/aiExplain/sourceLabels";
import type {
  AiExplainCard,
  AiExplainConfidence,
  AiExplainInputItem,
  AiExplainLayerResponse,
  AiExplainLayerState,
  AiExplainProvider,
  AiExplainProviderIdentity,
  AiExplainReadiness,
  AiExplainRequest,
  AiExplainSourceLabel,
} from "@/lib/aiExplain/types";

export const aiExplainLayerContractVersion = "ai-explain-layer-v1" as const;
export const aiExplainLayerPromptVersion = "ai-explain-layer-v1";
export const deterministicAiExplainProviderId = "deterministic_rules" as const;
export const unconfiguredAiExplainProviderId = "unconfigured_ai_explain_provider";

export const aiExplainLayerBlockedProductionActions = [
  "live_provider_rollout",
  "customer_ready_mod_export",
  "checksum_approval",
  "flash_safety_approval",
  "automatic_delivery",
  "production_analytics_persistence",
] as const;

const safetyBoundaries = [
  "This layer explains why a recommendation is shown; it does not approve file edits, checksum work or delivery.",
  "Provider unavailable and provider error states must never be presented as successful AI output.",
  "Human expert review is required before critical tuning, diagnostic, payment, access or delivery decisions.",
];

const defaultRequiredBefore = [
  "customer-facing file advice",
  "write-ready file export",
  "checksum approval",
  "automatic delivery",
];

function uniqueInOrder(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function unavailableProviderIdentity(reason: string): AiExplainProviderIdentity {
  return {
    providerId: unconfiguredAiExplainProviderId,
    providerKind: "unconfigured",
    providerStatus: "unavailable",
    modelName: null,
    promptVersion: null,
    unavailableReason: reason,
  };
}

function deterministicProviderIdentity(): AiExplainProviderIdentity {
  return {
    providerId: deterministicAiExplainProviderId,
    providerKind: "deterministic_rules",
    providerStatus: "ready",
    modelName: null,
    promptVersion: aiExplainLayerPromptVersion,
  };
}

export function erroredAiExplainProviderIdentity(provider: {
  providerId: string;
  providerKind: AiExplainProviderIdentity["providerKind"];
  modelName: string | null;
}): AiExplainProviderIdentity {
  return {
    providerId: provider.providerId,
    providerKind: provider.providerKind,
    providerStatus: "error",
    modelName: provider.modelName,
    promptVersion: null,
    unavailableReason: "Configured AI Explain provider failed locally.",
  };
}

function readinessFor(state: AiExplainLayerState): AiExplainReadiness {
  if (state === "provider_unavailable") return "unavailable";
  if (state === "invalid_input") return "blocked";
  if (state === "provider_success") return "provider_generated_review";
  return "fallback_ready";
}

function confidenceFor(items: AiExplainInputItem[]): AiExplainConfidence {
  if (items.length === 0) return "none";
  const hasEvidence = items.some((item) => item.kind === "evidence");
  const hasRecommendation = items.some((item) => item.kind === "recommendation");
  return hasEvidence && hasRecommendation ? "medium" : "low";
}

function stateFor(provider: AiExplainProviderIdentity): AiExplainLayerState {
  if (provider.providerStatus === "error") return "provider_error_fallback";
  if (provider.providerStatus === "unavailable") return "provider_unavailable_fallback";
  return "deterministic_fallback";
}

function surfaceLabel(surface: AiExplainRequest["surface"]) {
  if (surface === "dtc_analyzer") return "DTC Analyzer";
  if (surface === "tune_advisor") return "Tune Advisor";
  if (surface === "log_analyzer") return "Log Analyzer";
  if (surface === "file_expert") return "File Expert";
  if (surface === "request_recommendation") return "Request Recommendation";
  return "Local Test";
}

function sourceCountSummary(items: AiExplainInputItem[]) {
  const evidence = items.filter((item) => item.kind === "evidence").length;
  const recommendations = items.filter((item) => item.kind === "recommendation").length;
  const risks = items.filter((item) => item.kind === "risk_flag").length;
  const reviewGates = items.filter((item) => item.kind === "human_review_gate").length;
  return { evidence, recommendations, risks, reviewGates };
}

function cardForKind(input: {
  id: string;
  title: string;
  summary: string;
  labels: AiExplainSourceLabel[];
  severity: AiExplainCard["severity"];
  requiresHumanReview: boolean;
}): AiExplainCard {
  return {
    id: input.id,
    title: input.title,
    summary: input.summary,
    sourceLabelIds: input.labels.map((label) => label.id),
    severity: input.severity,
    requiresHumanReview: input.requiresHumanReview,
    customerSafe: true,
  };
}

function buildExplanationCards(items: AiExplainInputItem[], labels: AiExplainSourceLabel[]): AiExplainCard[] {
  const cards: AiExplainCard[] = [];
  const byKind = (kind: AiExplainInputItem["kind"]) => items.filter((item) => item.kind === kind);
  const evidenceItems = byKind("evidence");
  const recommendationItems = byKind("recommendation");
  const riskItems = byKind("risk_flag");
  const reviewItems = byKind("human_review_gate");
  const labelMatches = (kind: AiExplainSourceLabel["itemKind"]) => labels.filter((label) => label.itemKind === kind);

  if (evidenceItems.length > 0) {
    const sources = uniqueInOrder(evidenceItems.map((item) => sourceCategoryLabel(item.source))).join(", ");
    cards.push(cardForKind({
      id: "evidence-sources",
      title: "Evidence sources",
      summary: `${evidenceItems.length} evidence source label(s) are available from ${sources}.`,
      labels: labelMatches("evidence"),
      severity: "info",
      requiresHumanReview: false,
    }));
  }

  if (recommendationItems.length > 0) {
    const sources = uniqueInOrder(recommendationItems.map((item) => sourceCategoryLabel(item.source))).join(", ");
    cards.push(cardForKind({
      id: "recommendation-sources",
      title: "Recommendation sources",
      summary: `${recommendationItems.length} recommendation source label(s) are available from ${sources}.`,
      labels: labelMatches("recommendation"),
      severity: "info",
      requiresHumanReview: false,
    }));
  }

  if (riskItems.length > 0) {
    cards.push(cardForKind({
      id: "risk-flag-sources",
      title: "Risk flags",
      summary: `${riskItems.length} risk flag source label(s) require expert review before action.`,
      labels: labelMatches("risk_flag"),
      severity: "warning",
      requiresHumanReview: true,
    }));
  }

  if (reviewItems.length > 0) {
    cards.push(cardForKind({
      id: "human-review-gates",
      title: "Human review gates",
      summary: `${reviewItems.length} human review gate label(s) block critical production actions.`,
      labels: labelMatches("human_review_gate"),
      severity: "warning",
      requiresHumanReview: true,
    }));
  }

  const stateLabels = labels.filter((label) => label.itemKind === "provider_state" || label.itemKind === "fallback_state");
  if (stateLabels.length > 0) {
    cards.push(cardForKind({
      id: "provider-fallback-state",
      title: "Provider and fallback state",
      summary: "Provider availability and deterministic fallback state are explicit and are not successful AI output.",
      labels: stateLabels,
      severity: "caution",
      requiresHumanReview: true,
    }));
  }

  return cards;
}

function baseResponse(input: {
  request: AiExplainRequest;
  provider: AiExplainProviderIdentity;
  fallbackUsed: boolean;
  fallbackReason: string | null;
  state: AiExplainLayerState;
  summary: string;
  sourceLabels: AiExplainSourceLabel[];
  explanationCards: AiExplainCard[];
  confidence: AiExplainConfidence;
}): AiExplainLayerResponse {
  const unavailable = input.provider.providerStatus !== "ready";
  return {
    contractVersion: aiExplainLayerContractVersion,
    surface: input.request.surface,
    subject: input.request.subject,
    status:
      input.state === "invalid_input"
        ? "invalid_input"
        : input.state === "provider_unavailable"
          ? "provider_unavailable"
          : "fallback",
    state: input.state,
    provider: input.provider,
    fallback: {
      used: input.fallbackUsed,
      providerId: deterministicAiExplainProviderId,
      reason: input.fallbackReason,
    },
    isAiGenerated: false,
    readiness: readinessFor(input.state),
    confidence: input.confidence,
    summary: input.summary,
    sourceLabels: input.sourceLabels,
    explanationCards: input.explanationCards,
    unavailableState: {
      unavailable,
      reason: input.provider.unavailableReason ?? null,
      customerMessage: unavailable
        ? "AI explanation output is unavailable; deterministic non-AI explanation labels are shown where possible."
        : "AI explanation output is not required for this deterministic local response.",
      expertMessage: unavailable
        ? input.provider.unavailableReason ?? "Provider is unavailable for this local response."
        : null,
    },
    humanReview: {
      required: true,
      reason: "AI explanation labels support review only and cannot approve production file-service actions.",
      requiredBefore: [...defaultRequiredBefore],
    },
    safetyBoundaries,
    blockedProductionActions: [...aiExplainLayerBlockedProductionActions],
    privateInputRedacted: true,
  };
}

export function buildProviderUnavailableAiExplainResponse(
  request: AiExplainRequest,
  reason = "No AI Explain provider is configured for local explanation."
): AiExplainLayerResponse {
  const provider = unavailableProviderIdentity(reason);
  const sourceLabels = buildAiExplainSourceLabels(request.items, {
    providerStatus: provider.providerStatus,
    fallbackUsed: false,
  });
  const explanationCards = buildExplanationCards(request.items, sourceLabels);

  return baseResponse({
    request,
    provider,
    fallbackUsed: false,
    fallbackReason: null,
    state: "provider_unavailable",
    summary: `${surfaceLabel(request.surface)} AI Explain provider is unavailable. No AI explanation was generated.`,
    sourceLabels,
    explanationCards,
    confidence: "none",
  });
}

export function buildInvalidAiExplainInputResponse(request: AiExplainRequest): AiExplainLayerResponse {
  const provider = deterministicProviderIdentity();
  const sourceLabels = buildAiExplainSourceLabels([{
    id: "invalid-input-review-gate",
    kind: "human_review_gate",
    source: "human_review",
    severity: "warning",
    requiresHumanReview: true,
  }], {
    fallbackUsed: true,
  });

  return baseResponse({
    request,
    provider,
    fallbackUsed: true,
    fallbackReason: "Input validation blocked explanation generation before any provider call.",
    state: "invalid_input",
    summary: "AI Explain Layer needs at least one evidence, recommendation, risk flag or human-review item.",
    sourceLabels,
    explanationCards: buildExplanationCards([], sourceLabels),
    confidence: "none",
  });
}

export function buildDeterministicAiExplainFallback(
  request: AiExplainRequest,
  options: {
    provider?: AiExplainProviderIdentity;
    reason?: string;
  } = {}
): AiExplainLayerResponse {
  if (request.items.length === 0) return buildInvalidAiExplainInputResponse(request);

  const provider = options.provider ?? unavailableProviderIdentity("No AI Explain provider is configured for local explanation.");
  const state = stateFor(provider);
  const sourceLabels = buildAiExplainSourceLabels(request.items, {
    providerStatus: provider.providerStatus,
    fallbackUsed: true,
  });
  const counts = sourceCountSummary(request.items);
  const explanationCards = buildExplanationCards(request.items, sourceLabels);

  return baseResponse({
    request,
    provider,
    fallbackUsed: true,
    fallbackReason: options.reason ?? "Deterministic non-AI fallback generated source labels for local explanation.",
    state,
    summary:
      `${surfaceLabel(request.surface)} explanation uses deterministic non-AI labels: ` +
      `${counts.evidence} evidence, ${counts.recommendations} recommendation, ` +
      `${counts.risks} risk flag and ${counts.reviewGates} review gate source(s).`,
    sourceLabels,
    explanationCards,
    confidence: confidenceFor(request.items),
  });
}

export class UnavailableAiExplainProvider implements AiExplainProvider {
  readonly providerId = unconfiguredAiExplainProviderId;
  readonly providerKind = "unconfigured" as const;
  readonly modelName = null;

  constructor(private readonly reason = "No AI Explain provider is configured for local explanation.") {}

  async explain(input: AiExplainRequest): Promise<AiExplainLayerResponse> {
    return buildProviderUnavailableAiExplainResponse(input, this.reason);
  }
}

export class DeterministicAiExplainFallbackProvider implements AiExplainProvider {
  readonly providerId = deterministicAiExplainProviderId;
  readonly providerKind = "deterministic_rules" as const;
  readonly modelName = null;

  async explain(input: AiExplainRequest): Promise<AiExplainLayerResponse> {
    return buildDeterministicAiExplainFallback(input, {
      provider: deterministicProviderIdentity(),
      reason: "Deterministic provider generated local explanation labels.",
    });
  }
}

export async function analyzeAiExplainRequest(
  request: AiExplainRequest,
  options: { provider?: AiExplainProvider } = {}
): Promise<AiExplainLayerResponse> {
  if (request.items.length === 0) return buildInvalidAiExplainInputResponse(request);

  const provider = options.provider ?? new UnavailableAiExplainProvider();

  try {
    const providerResponse = await provider.explain(request);
    if (providerResponse.status === "provider_unavailable") {
      return buildDeterministicAiExplainFallback(request, {
        provider: providerResponse.provider,
        reason: providerResponse.provider.unavailableReason ?? "AI Explain provider is unavailable.",
      });
    }
    return providerResponse;
  } catch {
    return buildDeterministicAiExplainFallback(request, {
      provider: erroredAiExplainProviderIdentity(provider),
      reason: "Configured AI Explain provider failed locally; deterministic fallback used.",
    });
  }
}
