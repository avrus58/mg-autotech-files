import type {
  GrowthCustomerClassification,
  GrowthCustomerClassificationAdminRow,
} from "@/lib/growth/types";

export const maxGrowthClassificationBatchSize = 100;

export type GrowthCustomerClassificationDraft = {
  classification: GrowthCustomerClassification;
  reason: string;
};

export type GrowthCustomerClassificationChange = {
  userId: string;
  classification: GrowthCustomerClassification;
  reason: string | null;
  expectedUpdatedAt: string | null;
};

export function classificationNeedsEvidenceNote(classification: GrowthCustomerClassification) {
  return classification !== "unreviewed";
}

export function isGrowthClassificationDraftChanged(
  row: GrowthCustomerClassificationAdminRow,
  draft: GrowthCustomerClassificationDraft
) {
  return draft.classification !== row.classification ||
    draft.reason.trim() !== (row.reason ?? "").trim();
}

export function buildGrowthClassificationChange(
  row: GrowthCustomerClassificationAdminRow,
  draft: GrowthCustomerClassificationDraft
): GrowthCustomerClassificationChange {
  const reason = draft.reason.trim();
  return {
    userId: row.userId,
    classification: draft.classification,
    reason: reason || null,
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
  const missingEvidence = changes.find((change) =>
    classificationNeedsEvidenceNote(change.classification) && (change.reason?.trim().length ?? 0) < 3
  );
  if (missingEvidence) {
    return "Add a short evidence note for every reviewed customer before saving.";
  }
  return null;
}
