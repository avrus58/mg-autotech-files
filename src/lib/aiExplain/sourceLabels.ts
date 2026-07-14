import type {
  AiExplainInputItem,
  AiExplainProviderStatus,
  AiExplainSourceCategory,
  AiExplainSourceLabel,
  AiExplainSourceLabelKind,
  AiExplainSeverity,
  AiExplainTrustLevel,
} from "@/lib/aiExplain/types";

type SourceCategoryDefinition = {
  label: string;
  description: string;
  trustLevel: AiExplainTrustLevel;
};

const sourceCategoryDefinitions: Record<AiExplainSourceCategory, SourceCategoryDefinition> = {
  customer_input: {
    label: "Customer input",
    description: "Information entered by the customer or operator.",
    trustLevel: "direct_input",
  },
  vehicle_metadata: {
    label: "Vehicle metadata",
    description: "Vehicle, ECU, read-method or service metadata already present in the request.",
    trustLevel: "direct_input",
  },
  request_service_metadata: {
    label: "Service metadata",
    description: "Requested service context from the existing request taxonomy.",
    trustLevel: "direct_input",
  },
  diagnostic_evidence: {
    label: "Diagnostic evidence",
    description: "DTC or diagnostic context derived from bounded local analysis.",
    trustLevel: "derived_summary",
  },
  log_summary: {
    label: "Log summary",
    description: "RPM, torque or data-quality summary derived from local log analysis.",
    trustLevel: "derived_summary",
  },
  file_analysis_summary: {
    label: "File analysis summary",
    description: "Customer-safe file analysis summary without binary, offset, hash or path details.",
    trustLevel: "derived_summary",
  },
  provider_state: {
    label: "Provider state",
    description: "Provider availability state used to decide whether AI output exists.",
    trustLevel: "provider_state",
  },
  deterministic_rules: {
    label: "Deterministic rules",
    description: "Local non-AI fallback rules used when provider output is unavailable or invalid.",
    trustLevel: "deterministic_rule",
  },
  human_review: {
    label: "Human review",
    description: "Expert review gate required before critical file-service decisions.",
    trustLevel: "review_gate",
  },
  safety_boundary: {
    label: "Safety boundary",
    description: "Policy boundary that blocks unsafe or unsupported production action.",
    trustLevel: "review_gate",
  },
  unavailable_state: {
    label: "Unavailable state",
    description: "Explicit state showing no successful AI output is available.",
    trustLevel: "provider_state",
  },
};

const labelKindDefinitions: Record<AiExplainSourceLabelKind, string> = {
  evidence: "Evidence",
  recommendation: "Recommendation",
  risk_flag: "Risk flag",
  human_review_gate: "Human review gate",
  provider_state: "Provider state",
  fallback_state: "Fallback state",
};

const defaultSeverityByKind: Record<AiExplainSourceLabelKind, AiExplainSeverity> = {
  evidence: "info",
  recommendation: "info",
  risk_flag: "warning",
  human_review_gate: "warning",
  provider_state: "caution",
  fallback_state: "caution",
};

function uniqueLabels(labels: AiExplainSourceLabel[]) {
  const seen = new Set<string>();
  return labels.filter((label) => {
    if (seen.has(label.id)) return false;
    seen.add(label.id);
    return true;
  });
}

function requiresReview(kind: AiExplainSourceLabelKind, item?: AiExplainInputItem) {
  if (item?.requiresHumanReview === true) return true;
  return kind === "risk_flag" || kind === "human_review_gate" || kind === "provider_state" || kind === "fallback_state";
}

function labelFor(input: {
  kind: AiExplainSourceLabelKind;
  sourceCategory: AiExplainSourceCategory;
  severity?: AiExplainSeverity;
  customerVisible?: boolean;
  requiresHumanReview?: boolean;
}): AiExplainSourceLabel {
  const category = sourceCategoryDefinitions[input.sourceCategory];
  const kindLabel = labelKindDefinitions[input.kind];
  const severity = input.severity ?? defaultSeverityByKind[input.kind];

  return {
    id: `${input.kind}:${input.sourceCategory}`,
    itemKind: input.kind,
    sourceCategory: input.sourceCategory,
    label: `${kindLabel}: ${category.label}`,
    description: `${category.description} ${kindLabel.toLowerCase()} labels explain why the recommendation exists without exposing private internals.`,
    severity,
    trustLevel: category.trustLevel,
    customerVisible: input.customerVisible ?? true,
    requiresHumanReview: input.requiresHumanReview ?? requiresReview(input.kind),
  };
}

export function buildAiExplainSourceLabels(
  items: AiExplainInputItem[],
  options: {
    providerStatus?: AiExplainProviderStatus | null;
    fallbackUsed?: boolean;
  } = {}
): AiExplainSourceLabel[] {
  const labels = items.map((item) =>
    labelFor({
      kind: item.kind,
      sourceCategory: item.source,
      severity: item.severity,
      customerVisible: item.customerSafe !== false,
      requiresHumanReview: requiresReview(item.kind, item),
    })
  );

  if (options.providerStatus === "unavailable" || options.providerStatus === "error") {
    labels.push(
      labelFor({
        kind: "provider_state",
        sourceCategory: "unavailable_state",
        severity: options.providerStatus === "error" ? "warning" : "caution",
        requiresHumanReview: true,
      })
    );
  }

  if (options.fallbackUsed) {
    labels.push(
      labelFor({
        kind: "fallback_state",
        sourceCategory: "deterministic_rules",
        severity: "caution",
        requiresHumanReview: true,
      })
    );
  }

  return uniqueLabels(labels);
}

export function sourceCategoryLabel(sourceCategory: AiExplainSourceCategory) {
  return sourceCategoryDefinitions[sourceCategory].label;
}
