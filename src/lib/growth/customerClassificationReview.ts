import type {
  GrowthCustomerClassification,
  GrowthCustomerClassificationAdminRow,
} from "@/lib/growth/types";

export const maxGrowthClassificationBatchSize = 100;

export type GrowthCustomerClassificationDraft = {
  classification: GrowthCustomerClassification;
};

export type GrowthCustomerClassificationChange = {
  userId: string;
  classification: GrowthCustomerClassification;
  reason: string | null;
  expectedUpdatedAt: string | null;
};

export function defaultGrowthClassificationAuditNote(
  classification: GrowthCustomerClassification
) {
  if (classification === "real_customer") {
    return "Manual Growth Center decision: verified real customer.";
  }
  if (classification === "internal_test") {
    return "Manual Growth Center decision: internal or test account.";
  }
  if (classification === "staff_operated") {
    return "Manual Growth Center decision: staff-operated account.";
  }
  return null;
}

export function normalizeGrowthClassificationReason(
  classification: GrowthCustomerClassification,
  reason?: string | null
) {
  void reason; // Accepted for wire compatibility; the audit marker remains server-owned.
  return defaultGrowthClassificationAuditNote(classification);
}

export function isGrowthClassificationDraftChanged(
  row: GrowthCustomerClassificationAdminRow,
  draft: GrowthCustomerClassificationDraft
) {
  return draft.classification !== row.classification;
}

export function buildGrowthClassificationChange(
  row: GrowthCustomerClassificationAdminRow,
  draft: GrowthCustomerClassificationDraft
): GrowthCustomerClassificationChange {
  return {
    userId: row.userId,
    classification: draft.classification,
    reason: defaultGrowthClassificationAuditNote(draft.classification),
    expectedUpdatedAt: row.updatedAt,
  };
}

export function validateGrowthClassificationChanges(
  changes: GrowthCustomerClassificationChange[]
) {
  if (!changes.length) return "There are no pending customer reviews to save.";
  if (changes.length > maxGrowthClassificationBatchSize) {
    return `Save at most ${maxGrowthClassificationBatchSize} customer reviews at once.`;
  }
  if (new Set(changes.map((change) => change.userId)).size !== changes.length) {
    return "A customer may appear only once in a review batch.";
  }
  return null;
}
