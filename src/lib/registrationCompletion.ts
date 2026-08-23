import { normalizeCountryName } from "@/lib/countries";
import type { RegistrationProfileCompletionDraft } from "@/lib/registrationProfile";

export const REGISTRATION_COUNTRY_CONFIRMED_KEY =
  "registration_country_confirmed";
export const REGISTRATION_COUNTRY_REQUIRED_KEY =
  "registration_country_required";

// Accounts created before this rollout keep their existing profile behavior.
// Google accounts created from this rollout onward must explicitly confirm a
// country, even if they abandon the callback and return much later.
export const REGISTRATION_COUNTRY_ENFORCEMENT_STARTED_AT =
  "2026-08-22T00:00:00.000Z";
export const GOOGLE_REGISTRATION_PROFILE_FINALIZATION_WINDOW_MS =
  30 * 60 * 1000;

type RegistrationUser = {
  created_at: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

function isGoogleProvider(appMetadata: Record<string, unknown> | undefined) {
  if (appMetadata?.provider === "google") return true;
  return (
    Array.isArray(appMetadata?.providers) &&
    appMetadata.providers.includes("google")
  );
}

export function isGoogleRegistrationAfterCountryEnforcement(
  user: RegistrationUser
) {
  const createdAt = new Date(user.created_at).getTime();
  if (!Number.isFinite(createdAt) || !isGoogleProvider(user.app_metadata)) {
    return false;
  }

  return createdAt >= Date.parse(REGISTRATION_COUNTRY_ENFORCEMENT_STARTED_AT);
}

export function isGoogleRegistrationProfileFinalizationWindowOpen(
  user: RegistrationUser,
  now = Date.now()
) {
  const createdAt = new Date(user.created_at).getTime();
  if (!Number.isFinite(createdAt) || !isGoogleProvider(user.app_metadata)) {
    return false;
  }

  const registrationAge = now - createdAt;
  return (
    registrationAge >= 0 &&
    registrationAge <= GOOGLE_REGISTRATION_PROFILE_FINALIZATION_WINDOW_MS
  );
}

export function hasConfirmedRegistrationCountry(
  metadata: Record<string, unknown> | undefined
) {
  return Boolean(
    metadata?.[REGISTRATION_COUNTRY_CONFIRMED_KEY] === true &&
      normalizeCountryName(metadata.country)
  );
}

export function requiresRegistrationCountryCompletion(user: RegistrationUser) {
  if (hasConfirmedRegistrationCountry(user.user_metadata)) return false;

  return Boolean(
    user.user_metadata?.[REGISTRATION_COUNTRY_REQUIRED_KEY] === true ||
      isGoogleRegistrationAfterCountryEnforcement(user)
  );
}

export function buildPendingRegistrationCountryMetadata(
  existingMetadata?: Record<string, unknown>
) {
  return {
    ...(existingMetadata ?? {}),
    [REGISTRATION_COUNTRY_REQUIRED_KEY]: true,
    [REGISTRATION_COUNTRY_CONFIRMED_KEY]: false,
  };
}

export function buildRegistrationCompletionUpdates(input: {
  country: unknown;
  draft: RegistrationProfileCompletionDraft | null;
  existingMetadata?: Record<string, unknown>;
}) {
  const country = normalizeCountryName(input.country);
  if (!country) return null;

  const draftMetadata = input.draft
    ? {
        ...input.draft,
        country,
      }
    : {};
  const profile = input.draft
    ? {
        full_name: input.draft.full_name,
        account_type: input.draft.account_type,
        company_name: input.draft.company_name,
        phone: input.draft.phone,
        vat_id: input.draft.vat_id,
        country,
      }
    : { country };

  const metadata: Record<string, unknown> = {
    ...(input.existingMetadata ?? {}),
    ...draftMetadata,
    country,
    role: "customer",
    [REGISTRATION_COUNTRY_REQUIRED_KEY]: false,
    [REGISTRATION_COUNTRY_CONFIRMED_KEY]: true,
  };

  return {
    metadata,
    profile,
  };
}
