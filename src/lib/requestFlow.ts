export const requestFlowSteps = [
  { id: "vehicle", label: "Vehicle" },
  { id: "service", label: "Service" },
  { id: "upload", label: "Upload" },
  { id: "notes", label: "Notes" },
  { id: "payment", label: "Credits" },
  { id: "review", label: "Review" },
] as const;

export type RequestFlowStepId = (typeof requestFlowSteps)[number]["id"];

const advancedServiceCategoryIds = new Set([
  "performance",
  "engine_functions",
  "support_addons",
]);

export function isAdvancedRequestServiceCategory(categoryId: string) {
  return advancedServiceCategoryIds.has(categoryId);
}

export function getRequestFlowStepStates(input: {
  hasVehicle: boolean;
  hasService: boolean;
  hasUpload: boolean;
  hasNotes: boolean;
  hasPaymentAcceptance: boolean;
  hasFinalAcceptance: boolean;
}) {
  const completed: Record<RequestFlowStepId, boolean> = {
    vehicle: input.hasVehicle,
    service: input.hasService,
    upload: input.hasUpload,
    notes: input.hasNotes,
    payment: input.hasPaymentAcceptance,
    review: input.hasPaymentAcceptance && input.hasFinalAcceptance,
  };

  const firstOpenStep =
    requestFlowSteps.find((step) => !completed[step.id])?.id ?? "review";

  return requestFlowSteps.map((step) => ({
    ...step,
    completed: completed[step.id],
    active: step.id === firstOpenStep,
  }));
}
