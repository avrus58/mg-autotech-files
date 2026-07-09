export const workOrderPriorities = ["low", "normal", "high", "urgent"] as const;
export type WorkOrderPriority = (typeof workOrderPriorities)[number];

export const adminWorkOrderStatuses = [
  "new",
  "waiting_for_payment",
  "payment_review",
  "waiting_for_file",
  "file_received",
  "in_analysis",
  "waiting_for_customer",
  "in_progress",
  "quality_check",
  "ready_for_delivery",
  "delivered",
  "completed",
  "cancelled",
  "needs_review",
] as const;
export type AdminWorkOrderStatus = (typeof adminWorkOrderStatuses)[number];

export const tunerStatuses = [
  "unassigned",
  "assigned",
  "reviewing",
  "working",
  "paused",
  "ready_for_qc",
  "done",
] as const;
export type TunerStatus = (typeof tunerStatuses)[number];

export const paymentReviewStatuses = [
  "not_checked",
  "pending",
  "paid",
  "requires_review",
  "refunded",
  "cancelled",
] as const;
export type PaymentReviewStatus = (typeof paymentReviewStatuses)[number];

export const deliveryStatuses = [
  "not_ready",
  "waiting_final_file",
  "ready",
  "delivered",
  "revision_requested",
  "blocked",
] as const;
export type DeliveryStatus = (typeof deliveryStatuses)[number];

export const qualityCheckStatuses = ["pending", "passed", "failed", "needs_review"] as const;
export type QualityCheckStatus = (typeof qualityCheckStatuses)[number];

export const finalFileStatuses = ["not_ready", "uploaded", "qc_pending", "approved", "blocked"] as const;
export type FinalFileStatus = (typeof finalFileStatuses)[number];

export const deliveryMethods = ["portal", "manual", "external"] as const;
export type DeliveryMethod = (typeof deliveryMethods)[number];

export const workOrderNoteTypes = ["internal", "tuner", "customer_visible", "pinned"] as const;
export type WorkOrderNoteType = (typeof workOrderNoteTypes)[number];

export const legacyOrderToAdminStatus: Record<string, AdminWorkOrderStatus> = {
  new_request: "new",
  file_check: "file_received",
  in_progress: "in_progress",
  customer_info_needed: "waiting_for_customer",
  completed: "completed",
  revision: "needs_review",
  cancelled: "cancelled",
};

export function labelFromToken(value: string | null | undefined) {
  if (!value) return "-";
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function mapLegacyOrderStatus(value: string | null | undefined): AdminWorkOrderStatus {
  if (!value) return "new";
  return legacyOrderToAdminStatus[value] ?? "needs_review";
}

export function splitServiceLabels(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }
  if (typeof value !== "string") return [];
  return value.split(/[,;+|]/).map((item) => item.trim()).filter(Boolean);
}
