export const oauthRegistrationFinalizeErrorCodes = [
  "auth_required",
  "staff_profile_forbidden",
  "google_session_required",
  "invalid_request",
  "invalid_profile",
  "finalization_expired",
  "country_completion_unavailable",
  "invalid_country",
  "profile_update_failed",
  "metadata_update_failed",
] as const;

export type OAuthRegistrationFinalizeErrorCode =
  (typeof oauthRegistrationFinalizeErrorCodes)[number];

export type OAuthRegistrationFinalizeErrorPayload = {
  errorCode?: string;
};

export function isOAuthRegistrationFinalizeErrorCode(
  value: unknown,
): value is OAuthRegistrationFinalizeErrorCode {
  return (
    typeof value === "string" &&
    oauthRegistrationFinalizeErrorCodes.includes(
      value as OAuthRegistrationFinalizeErrorCode,
    )
  );
}

export function registrationFinalizeErrorMessage(
  errorCode: unknown,
):
  | "Registration profile could not be finalized. Please try again."
  | "Your updated account could not be verified. Please log in again." {
  if (
    isOAuthRegistrationFinalizeErrorCode(errorCode) &&
    errorCode === "auth_required"
  ) {
    return "Your updated account could not be verified. Please log in again.";
  }

  return "Registration profile could not be finalized. Please try again.";
}
