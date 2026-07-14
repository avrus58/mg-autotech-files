import type { AiProviderName, AiReportResponse } from "@/lib/ai/types";

export const fileExpertReportGateContractVersion = "file-expert-v2-report-gate-v1";

export type FileExpertAiReportState =
  | "provider_generated"
  | "deterministic_fallback"
  | "provider_error_fallback";

export type FileExpertAiReportStatus = {
  contractVersion: typeof fileExpertReportGateContractVersion;
  state: FileExpertAiReportState;
  provider: {
    requestedName: AiProviderName;
    requestedModelName: string | null;
    executedName: AiProviderName;
    executedModelName: string | null;
    promptVersion: string;
    status: "available" | "unavailable" | "failed";
  };
  fallback: {
    used: boolean;
    reason: "no_configured_provider" | "provider_error" | null;
    message: string | null;
    deterministicProvider: "rule_based";
  };
  reviewGate: {
    humanReviewRequired: true;
    exportLocked: true;
    requiredBefore: string[];
    blockedProductionActions: string[];
    customerSafeNotice: string;
  };
  isAiGenerated: boolean;
};

export type PublicFileExpertAiReportStatus = {
  contractVersion: typeof fileExpertReportGateContractVersion;
  state: "human_review_required";
  humanReviewRequired: true;
  exportLocked: true;
  notice: string;
  blockedCustomerActions: string[];
};

export const fileExpertBlockedProductionActions = [
  "customer_ready_mod_export",
  "checksum_approval",
  "flash_safety_approval",
  "automatic_delivery",
] as const;

const reviewGate = {
  humanReviewRequired: true,
  exportLocked: true,
  requiredBefore: [
    "human_tuner_review",
    "checksum_workflow_verification",
    "vehicle_or_bench_validation_decision",
  ],
  blockedProductionActions: [...fileExpertBlockedProductionActions],
  customerSafeNotice:
    "Automatic File Expert output is evidence for review only. MG AutoTech must complete human review before any write-ready file, checksum approval or delivery decision.",
} as const;

function inferGeneration(report: AiReportResponse) {
  if (report.generation) return report.generation;
  const ruleBased = report.provider === "rule_based";
  return {
    state: ruleBased ? "deterministic_fallback" : "provider_generated",
    requestedProvider: {
      name: report.provider,
      modelName: report.modelName,
      status: ruleBased ? "unavailable" : "available",
    },
    executedProvider: {
      name: report.provider,
      modelName: report.modelName,
      promptVersion: report.promptVersion,
    },
    fallback: {
      used: ruleBased,
      reason: ruleBased ? "no_configured_provider" : null,
      message: ruleBased
        ? "No external AI report provider is configured; a deterministic local report was generated."
        : null,
    },
    isAiGenerated: !ruleBased,
  } as const;
}

export function buildFileExpertAiReportStatus(report: AiReportResponse): FileExpertAiReportStatus {
  const generation = inferGeneration(report);

  return {
    contractVersion: fileExpertReportGateContractVersion,
    state: generation.state,
    provider: {
      requestedName: generation.requestedProvider.name,
      requestedModelName: generation.requestedProvider.modelName,
      executedName: generation.executedProvider.name,
      executedModelName: generation.executedProvider.modelName,
      promptVersion: generation.executedProvider.promptVersion,
      status: generation.requestedProvider.status,
    },
    fallback: {
      used: generation.fallback.used,
      reason: generation.fallback.reason,
      message: generation.fallback.message,
      deterministicProvider: "rule_based",
    },
    reviewGate: {
      humanReviewRequired: true,
      exportLocked: true,
      requiredBefore: [...reviewGate.requiredBefore],
      blockedProductionActions: [...reviewGate.blockedProductionActions],
      customerSafeNotice: reviewGate.customerSafeNotice,
    },
    isAiGenerated: generation.isAiGenerated,
  };
}

export function projectFileExpertAiReportStatusForCustomer(
  status: FileExpertAiReportStatus | null | undefined
): PublicFileExpertAiReportStatus | null {
  if (!status) return null;
  return {
    contractVersion: fileExpertReportGateContractVersion,
    state: "human_review_required",
    humanReviewRequired: true,
    exportLocked: true,
    notice: status.reviewGate.customerSafeNotice,
    blockedCustomerActions: [
      "write_ready_file_export",
      "checksum_approval",
      "automatic_delivery",
    ],
  };
}
