import { requiresRegistrationCountryCompletion } from "@/lib/registrationCompletion";
import type { StaffAccess } from "@/lib/staffPermissions";

export const verifiedRegistrationWindowMs = 30 * 60 * 1000;

type VerifiedRegistrationUser = {
  created_at: string;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
  confirmation_sent_at?: string | null;
  email_change_sent_at?: string | null;
  new_email?: string | null;
  updated_at?: string | null;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

function isRecentTimestamp(value: string | null | undefined, now: number) {
  const timestamp = value ? new Date(value).getTime() : NaN;
  const age = now - timestamp;
  return Number.isFinite(timestamp) && age >= 0 && age <= verifiedRegistrationWindowMs;
}

export function isVerifiedRegistrationWindowOpen(
  user: VerifiedRegistrationUser,
  now = Date.now()
) {
  // Supabase Auth retains `email_change_sent_at` after ConfirmEmailChange while
  // clearing the pending `new_email`. Reject either server-owned trace before
  // considering a recent confirmation. `updated_at` is intentionally ignored:
  // ordinary profile/account maintenance can move it on an existing account.
  if (
    Boolean(user.email_change_sent_at?.trim()) ||
    Boolean(user.new_email?.trim())
  ) {
    return false;
  }

  // A first e-mail confirmation can legitimately happen long after signup, so
  // the immutable creation timestamp cannot be the only window. The recent
  // Auth confirmation remains valid only when there is no e-mail-change trace.
  return (
    isRecentTimestamp(user.created_at, now) ||
    isRecentTimestamp(user.email_confirmed_at, now) ||
    isRecentTimestamp(user.confirmed_at, now)
  );
}

function isGoogleRegistration(user: VerifiedRegistrationUser) {
  if (user.app_metadata?.provider === "google") return true;
  return (
    Array.isArray(user.app_metadata?.providers) &&
    user.app_metadata.providers.includes("google")
  );
}

/**
 * Server authority for conversion and notification registration handoffs.
 *
 * The timestamp window alone is insufficient: freshly-created staff users and
 * Google identities that have not completed the customer profile flow are
 * verified Auth users too. Only a completed customer registration may produce
 * the account-created conversion seed or new-customer notifications.
 */
export function isCompletedCustomerRegistrationEligible(input: {
  user: VerifiedRegistrationUser;
  access: StaffAccess;
  now?: number;
}) {
  if (input.access.role !== "customer") return false;
  if (!isVerifiedRegistrationWindowOpen(input.user, input.now)) return false;
  if (requiresRegistrationCountryCompletion(input.user)) return false;

  return !isGoogleRegistration(input.user) ||
    input.user.user_metadata?.oauth_registration_finalized === true;
}
