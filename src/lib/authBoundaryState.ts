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

export type BrowserAuthUserCheckResult<TUser> =
  | { state: "authenticated"; user: TUser; error: null }
  | { state: "unauthenticated"; user: null; error: unknown }
  | { state: "unavailable"; user: null; error: unknown };

export async function checkBrowserAuthUserWithRetry<TUser>(
  checkUser: () => Promise<{ user: TUser | null; error: unknown }>,
  waitForRetry: (delayMs: number) => Promise<void> = (delayMs) =>
    new Promise((resolve) => globalThis.setTimeout(resolve, delayMs))
): Promise<BrowserAuthUserCheckResult<TUser>> {
  let lastError: unknown = null;

  for (
    let completedAttempts = 1;
    completedAttempts <= browserAuthCheckRetryLimit;
    completedAttempts += 1
  ) {
    let result: { user: TUser | null; error: unknown };

    try {
      result = await checkUser();
    } catch (error) {
      result = { user: null, error };
    }

    const decision = resolveBrowserAuthCheck({
      hasUser: Boolean(result.user),
      error: result.error,
    });

    if (decision === "authenticated" && result.user) {
      return { state: "authenticated", user: result.user, error: null };
    }
    if (decision === "unauthenticated") {
      return { state: "unauthenticated", user: null, error: result.error };
    }

    lastError = result.error;
    if (completedAttempts < browserAuthCheckRetryLimit) {
      await waitForRetry(getBrowserAuthCheckRetryDelay(completedAttempts));
    }
  }

  return { state: "unavailable", user: null, error: lastError };
}
