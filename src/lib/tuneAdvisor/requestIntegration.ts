import { analyzeTuneAdvisorRequest } from "@/lib/tuneAdvisor/service";
import type {
  TuneAdvisorConfidence,
  TuneAdvisorConfidenceReason,
  TuneAdvisorGuidanceItem,
  TuneAdvisorProviderKind,
  TuneAdvisorProviderStatus,
  TuneAdvisorRecommendation,
  TuneAdvisorRequest,
  TuneAdvisorResponse,
  TuneAdvisorRiskFlag,
} from "@/lib/tuneAdvisor/types";

export const requestTuneAdvisorOrderSelect =
  "id, customer_id, vehicle_brand, vehicle_model, vehicle_engine, service_type, notes, ecu, gearbox, vehicle_year, read_method, hw_sw";

export type RequestTuneAdvisorOrderContext = {
  id: string;
  customer_id?: string | null;
  vehicle_brand?: string | null;
  vehicle_model?: string | null;
  vehicle_engine?: string | null;
  service_type?: string | null;
  notes?: string | null;
  ecu?: string | null;
  gearbox?: string | null;
  vehicle_year?: string | null;
  read_method?: string | null;
  hw_sw?: string | null;
};

export type RequestTuneAdvisorState =
  | "no_service_context"
  | "deterministic_fallback"
  | "provider_unavailable_fallback"
  | "provider_error_fallback"
  | "provider_unavailable"
  | "provider_success";

export type CustomerRequestTuneAdvisorAnalysis = {
  contractVersion: TuneAdvisorResponse["contractVersion"];
  status: TuneAdvisorResponse["status"];
  state: RequestTuneAdvisorState;
  stateLabel: string;
  summary: string;
  isAiGenerated: boolean;
  readiness: TuneAdvisorResponse["readiness"];
  confidence: TuneAdvisorConfidence;
  confidenceReasons: TuneAdvisorConfidenceReason[];
  providerNotice: string;
  guidance: TuneAdvisorGuidanceItem[];
  riskFlags: TuneAdvisorRiskFlag[];
  recommendations: TuneAdvisorRecommendation[];
  missingInformation: string[];
  humanReview: TuneAdvisorResponse["humanReview"];
  safetyBoundaries: string[];
  blockedCustomerActions: string[];
};

export type ExpertRequestTuneAdvisorAnalysis = CustomerRequestTuneAdvisorAnalysis & {
  provider: {
    providerKind: TuneAdvisorProviderKind;
    providerStatus: TuneAdvisorProviderStatus;
    promptVersion: string | null;
  };
  fallback: {
    used: boolean;
    reason: string | null;
  };
  requiredHumanChecks: string[];
  blockedProductionActions: string[];
};

export type RequestTuneAdvisorProjection = {
  customer: CustomerRequestTuneAdvisorAnalysis;
  expert: ExpertRequestTuneAdvisorAnalysis;
  auditMetadata: Record<string, unknown>;
};

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export function buildRequestTuneAdvisorRequest(
  order: RequestTuneAdvisorOrderContext,
  source: "customer" | "admin"
): TuneAdvisorRequest {
  return {
    source: source === "admin" ? "admin_request" : "customer_request",
    vehicle: {
      brand: order.vehicle_brand,
      model: order.vehicle_model,
      engine: order.vehicle_engine,
      vehicleYear: order.vehicle_year,
      ecuType: order.ecu,
      gearbox: order.gearbox,
      readMethod: order.read_method,
      hwSw: order.hw_sw,
    },
    services: {
      serviceSummary: order.service_type,
      notes: order.notes,
    },
  };
}

function analysisState(response: TuneAdvisorResponse): RequestTuneAdvisorState {
  if (!response.normalizedService.hasServiceContext) return "no_service_context";
  if (response.provider.providerStatus === "error" && response.fallback.used) return "provider_error_fallback";
  if (response.provider.providerStatus === "unavailable" && response.fallback.used) {
    return "provider_unavailable_fallback";
  }
  if (response.status === "provider_unavailable") return "provider_unavailable";
  if (response.fallback.used) return "deterministic_fallback";
  return "provider_success";
}

function stateLabel(state: RequestTuneAdvisorState) {
  if (state === "no_service_context") return "No service context is available for Tune Advisor.";
  if (state === "provider_error_fallback") return "Tune Advisor provider failed; deterministic non-AI guidance is shown.";
  if (state === "provider_unavailable_fallback") {
    return "Tune Advisor provider is unavailable; deterministic non-AI guidance is shown.";
  }
  if (state === "provider_unavailable") return "Tune Advisor provider is unavailable.";
  if (state === "provider_success") return "Tune Advisor provider returned guidance; human review remains required.";
  return "Deterministic non-AI Tune Advisor guidance is shown.";
}

function providerNotice(response: TuneAdvisorResponse, state: RequestTuneAdvisorState) {
  if (response.isAiGenerated) return "AI-assisted output. Human review remains required.";
  if (state === "provider_error_fallback") return "Provider failure is explicit; this is deterministic non-AI fallback output.";
  if (state === "provider_unavailable_fallback") {
    return "Provider unavailable state is explicit; this is deterministic non-AI fallback output.";
  }
  if (state === "provider_unavailable") return "Provider unavailable. No AI guidance was generated.";
  return "No AI output was generated. Human review remains required.";
}

function projectCustomer(response: TuneAdvisorResponse): CustomerRequestTuneAdvisorAnalysis {
  const state = analysisState(response);
  return {
    contractVersion: response.contractVersion,
    status: response.status,
    state,
    stateLabel: stateLabel(state),
    summary: response.summary,
    isAiGenerated: response.isAiGenerated,
    readiness: response.readiness,
    confidence: response.confidence,
    confidenceReasons: response.confidenceReasons,
    providerNotice: providerNotice(response, state),
    guidance: response.guidance,
    riskFlags: response.riskFlags,
    recommendations: response.recommendations,
    missingInformation: response.missingInformation,
    humanReview: response.humanReview,
    safetyBoundaries: response.safetyBoundaries,
    blockedCustomerActions: [
      "write_ready_file_export",
      "checksum_approval",
      "automatic_delivery",
      "exact_gain_claim",
    ],
  };
}

function projectExpert(response: TuneAdvisorResponse): ExpertRequestTuneAdvisorAnalysis {
  const customer = projectCustomer(response);
  return {
    ...customer,
    provider: {
      providerKind: response.provider.providerKind,
      providerStatus: response.provider.providerStatus,
      promptVersion: response.provider.promptVersion,
    },
    fallback: {
      used: response.fallback.used,
      reason: response.fallback.reason,
    },
    requiredHumanChecks: uniqueInOrder(response.humanReview.requiredBefore),
    blockedProductionActions: response.blockedProductionActions,
  };
}

function uniqueInOrder(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function auditMetadata(response: TuneAdvisorResponse, order: RequestTuneAdvisorOrderContext, source: "customer" | "admin") {
  return {
    source,
    order_id: textValue(order.id),
    contract_version: response.contractVersion,
    status: response.status,
    state: analysisState(response),
    is_ai_generated: response.isAiGenerated,
    readiness: response.readiness,
    confidence: response.confidence,
    primary_service_id: response.normalizedService.primary?.id ?? null,
    extra_service_count: response.normalizedService.extras.length,
    provider_kind: response.provider.providerKind,
    provider_status: response.provider.providerStatus,
    fallback_used: response.fallback.used,
    provider_unavailable: response.provider.providerStatus === "unavailable",
    provider_error: response.provider.providerStatus === "error",
    guidance_count: response.guidance.length,
    risk_flag_count: response.riskFlags.length,
    recommendation_count: response.recommendations.length,
    missing_information_count: response.missingInformation.length,
    blocked_production_action_count: response.blockedProductionActions.length,
    human_review_required: response.humanReview.required,
  };
}

export async function analyzeRequestTuneAdvisor(
  order: RequestTuneAdvisorOrderContext,
  source: "customer" | "admin"
): Promise<RequestTuneAdvisorProjection> {
  const response = await analyzeTuneAdvisorRequest(buildRequestTuneAdvisorRequest(order, source));

  return {
    customer: projectCustomer(response),
    expert: projectExpert(response),
    auditMetadata: auditMetadata(response, order, source),
  };
}
