export type AuthenticatedGrowthAction =
  | "account_created"
  | "identity_linked"
  | "request_started"
  | "request_created"
  | "reminder_preference";

export function growthJourneyAuthMode(action: AuthenticatedGrowthAction) {
  return action === "account_created" || action === "identity_linked"
    ? "verified-account"
    : "verified-device";
}
