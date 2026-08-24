export const ADMIN_SYNC_RETRY_DELAYS_MS = [2_000, 5_000, 10_000] as const;
export const ADMIN_SYNC_INCIDENT_HEADER = "X-MG-Admin-Incident";
export const ADMIN_SYNC_INCIDENT_PATTERN = /^ADM-[A-Z0-9]{12}$/;

export type AdminSyncState =
  | "connecting"
  | "live"
  | "syncing"
  | "session_recovering"
  | "reconnecting"
  | "offline"
  | "degraded"
  | "unavailable"
  | "session_required";

export type AdminSyncFailureKind =
  | "offline"
  | "network"
  | "session_recovery"
  | "session_required"
  | "access_denied"
  | "rate_limited"
  | "server"
  | "invalid_response";

export type AdminSyncPresentation = {
  label: string;
  detail: string;
  tone: "neutral" | "success" | "warning" | "danger";
};

export function getAdminSyncRetryDelay(consecutiveFailureCount: number) {
  if (!Number.isInteger(consecutiveFailureCount) || consecutiveFailureCount < 1) {
    return null;
  }

  return ADMIN_SYNC_RETRY_DELAYS_MS[consecutiveFailureCount - 1] ?? null;
}
export function isRetryableAdminSyncFailure(kind: AdminSyncFailureKind) {
  return kind === "network" ||
    kind === "session_recovery" ||
    kind === "rate_limited" ||
    kind === "server" ||
    kind === "invalid_response";
}

export function buildAdminSyncIncidentCode(seed: string) {
  const normalized = seed.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const token = `${normalized}000000000000`.slice(0, 12);
  return `ADM-${token}`;
}

export function readAdminSyncIncidentCode(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return ADMIN_SYNC_INCIDENT_PATTERN.test(normalized) ? normalized : null;
}

export function getAdminSyncPresentation(input: {
  state: AdminSyncState;
  lastSyncLabel?: string | null;
  retryDelayMs?: number | null;
}): AdminSyncPresentation {
  const lastSync = input.lastSyncLabel ? `Last verified sync ${input.lastSyncLabel}.` : "No verified snapshot yet.";
  const retrySeconds = input.retryDelayMs && input.retryDelayMs > 0
    ? Math.ceil(input.retryDelayMs / 1_000)
    : null;

  if (input.state === "live") {
    return {
      label: input.lastSyncLabel ? `Live · ${input.lastSyncLabel}` : "Live",
      detail: "Admin operations are synchronized.",
      tone: "success",
    };
  }
  if (input.state === "syncing") {
    return {
      label: "Syncing…",
      detail: `${lastSync} Checking for updates now.`,
      tone: "neutral",
    };
  }
  if (input.state === "session_recovering") {
    return {
      label: "Refreshing secure session…",
      detail: `${lastSync} The secure session is being refreshed automatically.`,
      tone: "warning",
    };
  }
  if (input.state === "reconnecting") {
    return {
      label: retrySeconds ? `Reconnecting · ${retrySeconds}s` : "Reconnecting…",
      detail: `${lastSync} The connection will be retried automatically.`,
      tone: "warning",
    };
  }
  if (input.state === "offline") {
    return {
      label: "Offline",
      detail: `${lastSync} Reconnection starts automatically when the internet returns.`,
      tone: "warning",
    };
  }
  if (input.state === "degraded") {
    return {
      label: input.lastSyncLabel ? `Connection interrupted · ${input.lastSyncLabel}` : "Connection interrupted",
      detail: `${lastSync} Verified data remains visible while recovery continues.`,
      tone: "warning",
    };
  }
  if (input.state === "unavailable") {
    return {
      label: "Connection unavailable",
      detail: `${lastSync} Automatic retries are exhausted; a manual retry is available.`,
      tone: "danger",
    };
  }
  if (input.state === "session_required") {
    return {
      label: "Session ended",
      detail: `${lastSync} Sign in again to restore the protected admin connection.`,
      tone: "danger",
    };
  }

  return {
    label: "Connecting…",
    detail: "Waiting for the first verified admin snapshot.",
    tone: "neutral",
  };
}
