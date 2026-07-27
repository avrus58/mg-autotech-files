export const dashboardSyncRetryLimit = 4;
export const dashboardSyncTimeoutMs = 15_000;

export type DashboardSyncFailureKind =
  | "aborted"
  | "authorization"
  | "authentication"
  | "network"
  | "rate_limit"
  | "server"
  | "unknown";

export function getDashboardSyncRetryDelay(attempt: number, random = Math.random) {
  const normalizedAttempt = Math.max(0, Math.min(attempt, dashboardSyncRetryLimit - 1));
  const baseDelay = Math.min(1000 * 2 ** normalizedAttempt, 8000);
  const jitter = 0.8 + Math.max(0, Math.min(1, random())) * 0.4;
  return Math.round(baseDelay * jitter);
}

export function classifyDashboardSyncFailure(error: unknown): DashboardSyncFailureKind {
  if (error instanceof DOMException && error.name === "AbortError") return "aborted";
  if (error instanceof TypeError) return "network";
  if (!error || typeof error !== "object") return "unknown";

  const candidate = error as { code?: unknown; name?: unknown; status?: unknown };
  const code = String(candidate.code ?? "");
  const name = String(candidate.name ?? "");
  const status = Number(candidate.status);

  if (name === "AbortError") return "aborted";
  if (status === 429 || code === "429") return "rate_limit";
  if (status >= 500) return "server";
  if (status === 403 || code === "403" || code === "42501") return "authorization";
  if (
    status === 401 ||
    code === "401" ||
    code === "PGRST301" ||
    code === "PGRST303"
  ) {
    return "authentication";
  }

  return "unknown";
}

export function shouldRevalidateDashboardSession(error: unknown) {
  return classifyDashboardSyncFailure(error) === "authentication";
}

export function isDefinitiveInvalidSession(input: {
  hasUser: boolean;
  error: unknown;
}) {
  if (input.hasUser) return false;
  if (!input.error) return true;
  if (typeof input.error !== "object") return false;

  const candidate = input.error as { code?: unknown; name?: unknown };
  const code = String(candidate.code ?? "");
  const name = String(candidate.name ?? "");

  return (
    name === "AuthSessionMissingError" ||
    name === "AuthInvalidTokenResponseError" ||
    name === "AuthInvalidJwtError" ||
    [
      "bad_jwt",
      "invalid_jwt",
      "refresh_token_already_used",
      "refresh_token_not_found",
      "session_expired",
      "session_not_found",
      "user_banned",
      "user_not_found",
    ].includes(code)
  );
}

export function recordDashboardSyncDiagnostic(
  kind: DashboardSyncFailureKind,
  retryAttempt: number
) {
  console.warn("[mg-auth-diagnostic]", {
    event: "dashboard_sync_retry",
    kind,
    retryAttempt,
  });
}
