export type WidgetCheckoutActor = {
  userId: string;
  email: string;
};

export type ExistingWidgetCheckoutClient = {
  id: string;
  user_id: string | null;
  email: string;
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_checkout_session_id?: string | null;
  checkout_pending_until?: string | null;
  checkout_claim_token?: string | null;
  checkout_claimed_at?: string | null;
};

export type WidgetCheckoutReuseDecision =
  | { allowed: true }
  | {
      allowed: false;
      reason: "billing_state_exists" | "authentication_required" | "ownership_mismatch";
    };

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export function widgetCheckoutActorMatchesEmail(
  actor: WidgetCheckoutActor | null,
  submittedEmail: string,
) {
  return Boolean(actor) && normalizeEmail(actor?.email) === normalizeEmail(submittedEmail);
}

export function canResumeWidgetCheckoutAttempt(
  existing: ExistingWidgetCheckoutClient,
  actor: WidgetCheckoutActor,
  submittedEmail: string,
) {
  const expiresAt = Date.parse(existing.checkout_pending_until ?? "");
  return existing.status === "pending" &&
    existing.user_id === actor.userId &&
    normalizeEmail(existing.email) === normalizeEmail(submittedEmail) &&
    widgetCheckoutActorMatchesEmail(actor, submittedEmail) &&
    !existing.stripe_customer_id &&
    !existing.stripe_subscription_id &&
    !existing.stripe_checkout_session_id &&
    Boolean(existing.checkout_claim_token) &&
    Number.isFinite(Date.parse(existing.checkout_claimed_at ?? "")) &&
    Number.isFinite(expiresAt) &&
    expiresAt > Date.now();
}

export function evaluateWidgetCheckoutReuse(
  existing: ExistingWidgetCheckoutClient,
  actor: WidgetCheckoutActor | null,
  submittedEmail: string,
): WidgetCheckoutReuseDecision {
  if (
    existing.stripe_customer_id ||
    existing.stripe_subscription_id ||
    !["cancelled", "pending"].includes(existing.status)
  ) {
    return { allowed: false, reason: "billing_state_exists" };
  }
  if (!actor) return { allowed: false, reason: "authentication_required" };
  if (
    existing.user_id !== actor.userId ||
    normalizeEmail(existing.email) !== normalizeEmail(submittedEmail) ||
    !widgetCheckoutActorMatchesEmail(actor, submittedEmail)
  ) {
    return { allowed: false, reason: "ownership_mismatch" };
  }
  if (
    existing.status === "pending" &&
    (!existing.checkout_pending_until ||
      Date.parse(existing.checkout_pending_until) > Date.now())
  ) {
    return { allowed: false, reason: "billing_state_exists" };
  }
  return { allowed: true };
}
