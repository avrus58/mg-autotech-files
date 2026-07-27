import { isDefinitiveInvalidSession } from "@/lib/dashboardSync";

export type BrowserAuthState =
  | "checking"
  | "authenticated"
  | "unauthenticated"
  | "unavailable";

export const browserAuthCheckRetryLimit = 3;

const browserAuthCheckRetryDelays = [1_000, 3_000];

export function getBrowserAuthCheckRetryDelay(completedAttempts: number) {
  const index = Math.max(
    0,
    Math.min(completedAttempts - 1, browserAuthCheckRetryDelays.length - 1)
  );
  return browserAuthCheckRetryDelays[index];
}

export function resolveBrowserAuthCheck(input: {
  hasUser: boolean;
  error: unknown;
}): Exclude<BrowserAuthState, "checking"> | "retry" {
  if (input.hasUser) return "authenticated";
  if (!input.error || isDefinitiveInvalidSession(input)) return "unauthenticated";
  return "retry";
}
