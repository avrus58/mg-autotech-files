import type {
  AiExplainLayerResponse,
  AiExplainProviderKind,
  AiExplainProviderStatus,
  AiExplainSourceLabel,
} from "@/lib/aiExplain/types";

export type CustomerAiExplainProjection = {
  contractVersion: AiExplainLayerResponse["contractVersion"];
  surface: AiExplainLayerResponse["surface"];
  status: AiExplainLayerResponse["status"];
  state: AiExplainLayerResponse["state"];
  subject: string;
  summary: string;
  isAiGenerated: boolean;
  readiness: AiExplainLayerResponse["readiness"];
  confidence: AiExplainLayerResponse["confidence"];
  providerNotice: string;
  unavailableNotice: string;
  sourceLabels: AiExplainSourceLabel[];
  explanationCards: AiExplainLayerResponse["explanationCards"];
  humanReview: AiExplainLayerResponse["humanReview"];
  safetyBoundaries: string[];
  blockedCustomerActions: string[];
};

export type ExpertAiExplainProjection = CustomerAiExplainProjection & {
  provider: {
    providerId: string;
    providerKind: AiExplainProviderKind;
    providerStatus: AiExplainProviderStatus;
    modelName: string | null;
    promptVersion: string | null;
    unavailableReason: string | null;
  };
  fallback: {
    used: boolean;
    reason: string | null;
  };
  requiredHumanChecks: string[];
  blockedProductionActions: string[];
};

export type AiExplainProjection = {
  customer: CustomerAiExplainProjection;
  expert: ExpertAiExplainProjection;
  auditMetadata: Record<string, unknown>;
};

const forbiddenCustomerKeyPatterns = [
  /^providerId$/i,
  /^providerKind$/i,
  /^providerStatus$/i,
  /^modelName$/i,
  /^promptVersion$/i,
  /^fallback$/i,
  /requestedName/i,
  /executedName/i,
  /storage/i,
  /path/i,
  /signed/i,
  /url/i,
  /sha/i,
  /hash/i,
  /binary/i,
  /raw/i,
  /hex/i,
  /csv/i,
  /sample/i,
  /customer_id/i,
  /customerId/i,
  /admin/i,
  /fileName/i,
  /filename/i,
];

function providerNotice(response: AiExplainLayerResponse) {
  if (response.isAiGenerated) return "AI-assisted explanation. Human review remains required.";
  if (response.state === "provider_error_fallback") {
    return "Provider failure is explicit; deterministic non-AI explanation labels are shown.";
  }
  if (response.state === "provider_unavailable_fallback") {
    return "Provider unavailable state is explicit; deterministic non-AI explanation labels are shown.";
  }
  if (response.state === "provider_unavailable") return "Provider unavailable. No AI explanation was generated.";
  if (response.state === "invalid_input") return "No AI explanation was generated because the explainable input is incomplete.";
  return "No AI output was generated. Human review remains required.";
}

function customerSourceLabels(response: AiExplainLayerResponse) {
  return response.sourceLabels.filter((label) => label.customerVisible).map((label) => ({
    ...label,
    description: label.description.replace(/\bprovider id\b/gi, "provider state"),
  }));
}

function projectCustomer(response: AiExplainLayerResponse): CustomerAiExplainProjection {
  return {
    contractVersion: response.contractVersion,
    surface: response.surface,
    status: response.status,
    state: response.state,
    subject: response.subject,
    summary: response.summary,
    isAiGenerated: response.isAiGenerated,
    readiness: response.readiness,
    confidence: response.confidence,
    providerNotice: providerNotice(response),
    unavailableNotice: response.unavailableState.customerMessage,
    sourceLabels: customerSourceLabels(response),
    explanationCards: response.explanationCards,
    humanReview: response.humanReview,
    safetyBoundaries: response.safetyBoundaries,
    blockedCustomerActions: [
      "write_ready_file_export",
      "checksum_approval",
      "automatic_delivery",
    ],
  };
}

function projectExpert(response: AiExplainLayerResponse): ExpertAiExplainProjection {
  return {
    ...projectCustomer(response),
    sourceLabels: response.sourceLabels,
    provider: {
      providerId: response.provider.providerId,
      providerKind: response.provider.providerKind,
      providerStatus: response.provider.providerStatus,
      modelName: response.provider.modelName,
      promptVersion: response.provider.promptVersion,
      unavailableReason: response.provider.unavailableReason ?? null,
    },
    fallback: {
      used: response.fallback.used,
      reason: response.fallback.reason,
    },
    requiredHumanChecks: response.humanReview.requiredBefore,
    blockedProductionActions: response.blockedProductionActions,
  };
}

function auditMetadata(response: AiExplainLayerResponse) {
  return {
    contract_version: response.contractVersion,
    surface: response.surface,
    status: response.status,
    state: response.state,
    is_ai_generated: response.isAiGenerated,
    readiness: response.readiness,
    confidence: response.confidence,
    source_label_count: response.sourceLabels.length,
    explanation_card_count: response.explanationCards.length,
    provider_status: response.provider.providerStatus,
    fallback_used: response.fallback.used,
    human_review_required: response.humanReview.required,
    blocked_production_action_count: response.blockedProductionActions.length,
  };
}

export function projectAiExplainResponse(response: AiExplainLayerResponse): AiExplainProjection {
  return {
    customer: projectCustomer(response),
    expert: projectExpert(response),
    auditMetadata: auditMetadata(response),
  };
}

export function hasAiExplainCustomerLeak(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasAiExplainCustomerLeak);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value as Record<string, unknown>).some(
    ([key, entry]) =>
      forbiddenCustomerKeyPatterns.some((pattern) => pattern.test(key)) ||
      hasAiExplainCustomerLeak(entry)
  );
}
