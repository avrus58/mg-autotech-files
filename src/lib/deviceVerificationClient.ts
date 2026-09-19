import { authenticatedFetch } from "@/lib/authGuards";

const deviceVerificationRequestTimeoutMs = 12_000;
const deviceVerificationUnavailableMessage = "Account security verification is temporarily unavailable.";

export type DeviceVerificationState = {
  status: "not_required" | "verified" | "required" | "revoked";
  maskedEmail: string;
  challengeId?: string;
  expiresAt?: string;
  retryAfterSeconds?: number;
  attemptsRemaining?: number;
  outcome?: "new_code_sent" | "existing_sent" | "delivery_pending" | "rate_limited" | "stale_challenge";
  canVerify?: boolean;
  sentNewCode?: boolean;
  rateLimited?: boolean;
  error?: string;
};

function isDeviceVerificationState(value: unknown): value is DeviceVerificationState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const state = value as Record<string, unknown>;
  if (
    typeof state.status !== "string" ||
    !["not_required", "verified", "required", "revoked"].includes(state.status) ||
    typeof state.maskedEmail !== "string"
  ) return false;
  for (const field of ["challengeId", "expiresAt", "error"]) {
    if (state[field] !== undefined && typeof state[field] !== "string") return false;
  }
  for (const field of ["canVerify", "sentNewCode", "rateLimited"]) {
    if (state[field] !== undefined && typeof state[field] !== "boolean") return false;
  }
  for (const field of ["retryAfterSeconds", "attemptsRemaining"]) {
    if (state[field] !== undefined && (
      typeof state[field] !== "number" ||
      !Number.isSafeInteger(state[field]) || state[field] < 0
    )) return false;
  }
  return state.outcome === undefined || (typeof state.outcome === "string" && [
    "new_code_sent", "existing_sent", "delivery_pending", "rate_limited", "stale_challenge",
  ].includes(state.outcome));
}

async function readDeviceVerificationResponse(response: Response): Promise<DeviceVerificationState> {
  const payload: unknown = await response.json().catch(() => null);
  if (!isDeviceVerificationState(payload)) {
    throw new Error(deviceVerificationUnavailableMessage);
  }

  // Explicit denial/challenge states can accompany recoverable HTTP errors.
  // Never treat an error response (or an unknown payload) as verified access.
  const allowedStatuses = payload.status === "required"
    ? [200, 202, 400, 409, 410, 423, 429]
    : payload.status === "revoked"
      ? [200, 400]
      : [200];
  if (
    !allowedStatuses.includes(response.status) ||
    ((payload.status === "verified" || payload.status === "not_required") && payload.error)
  ) throw new Error(deviceVerificationUnavailableMessage);
  return payload;
}

async function requestDeviceVerification(input: string, init?: RequestInit) {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timeoutId = globalThis.setTimeout(() => {
      const error = new Error(deviceVerificationUnavailableMessage);
      error.name = "TimeoutError";
      reject(error);
      controller.abort();
    }, deviceVerificationRequestTimeoutMs);
  });

  try {
    // Auth preflight can wait independently of fetch's abort handling. Bound
    // the complete operation, including JSON consumption, without signing out
    // or turning a late/failed request into a successful verification.
    return await Promise.race([
      (async () => readDeviceVerificationResponse(
        await authenticatedFetch(input, { ...init, signal: controller.signal })
      ))(),
      deadline,
    ]);
  } finally {
    if (timeoutId !== undefined) globalThis.clearTimeout(timeoutId);
  }
}

export async function getDeviceVerificationStatus() {
  return requestDeviceVerification("/api/auth/device-verification/status", {
    cache: "no-store",
  });
}

export async function startDeviceVerification() {
  return requestDeviceVerification("/api/auth/device-verification/start", {
    method: "POST",
    cache: "no-store",
  });
}

export async function startPasswordChangeVerification() {
  return requestDeviceVerification(
    "/api/auth/device-verification/password-change/start",
    { method: "POST", cache: "no-store" }
  );
}

export async function verifyDeviceCode(input: {
  challengeId: string;
  code: string;
  rememberDevice: boolean;
}) {
  return requestDeviceVerification("/api/auth/device-verification/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function resendDeviceCode(challengeId: string) {
  return requestDeviceVerification("/api/auth/device-verification/resend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ challengeId }),
  });
}
