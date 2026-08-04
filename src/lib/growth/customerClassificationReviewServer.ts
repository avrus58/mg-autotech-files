import type { GrowthCustomerClassificationChange } from "@/lib/growth/customerClassificationReview";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function saveGrowthCustomerClassificationBatch(input: {
  changes: GrowthCustomerClassificationChange[];
  actorUserId: string;
}) {
  return getSupabaseAdmin().rpc("set_growth_customer_classifications_batch", {
    p_changes: input.changes.map((change) => ({
      user_id: change.userId,
      classification: change.classification,
      reason: change.reason,
      expected_updated_at: change.expectedUpdatedAt,
    })),
    p_actor_user_id: input.actorUserId,
  });
}

export function growthClassificationSaveError(error: unknown) {
  const message = String(
    error && typeof error === "object" && "message" in error
      ? (error as { message?: unknown }).message ?? ""
      : ""
  );
  if (message.includes("growth_customer_classification_stale")) {
    return { status: 409, message: "Customer reviews changed on the server. Refresh before saving again." };
  }
  if (message.includes("growth_customer_classification_reason_required")) {
    return { status: 400, message: "Every reviewed customer requires a short evidence note." };
  }
  if (message.includes("growth_customer_batch_duplicate")) {
    return { status: 400, message: "A customer may appear only once in a review batch." };
  }
  if (message.includes("growth_customer_batch_too_large")) {
    return { status: 413, message: "The customer review batch is too large." };
  }
  if (message.includes("staff_accounts_are_already_excluded")) {
    return { status: 409, message: "Staff accounts are already excluded from customer analytics." };
  }
  if (message.includes("growth_customer_not_found")) {
    return { status: 404, message: "A customer account in this review no longer exists." };
  }
  if (message.includes("growth_customer_actor_required")) {
    return { status: 403, message: "A verified admin identity is required for customer reviews." };
  }
  return { status: 503, message: "Customer reviews could not be saved." };
}
