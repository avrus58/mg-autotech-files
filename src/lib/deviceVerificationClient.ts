import { authenticatedFetch } from "@/lib/authGuards";

const deviceVerificationRequestTimeoutMs = 12_000;

function deviceVerificationRequestSignal() {
  return AbortSignal.timeout(deviceVerificationRequestTimeoutMs);
}

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

async function readDeviceVerificationResponse(response: Response) {
  const payload = await response.json().catch(() => ({})) as DeviceVerificationState;
  if (!response.ok && response.status !== 400 && response.status !== 409 && response.status !== 410 && response.status !== 423 && response.status !== 429) {
    throw new Error(payload.error || "Account security verification is temporarily unavailable.");
  }
  return payload;
}

export async function getDeviceVerificationStatus() {
  return readDeviceVerificationResponse(
    await authenticatedFetch("/api/auth/device-verification/status", {
      cache: "no-store",
      signal: deviceVerificationRequestSignal(),
    })
  );
}

export async function startDeviceVerification() {
  return readDeviceVerificationResponse(
    await authenticatedFetch("/api/auth/device-verification/start", {
      method: "POST",
      cache: "no-store",
      signal: deviceVerificationRequestSignal(),
    })
  );
}

export async function startPasswordChangeVerification() {
  return readDeviceVerificationResponse(
    await authenticatedFetch(
      "/api/auth/device-verification/password-change/start",
      {
        method: "POST",
        cache: "no-store",
        signal: deviceVerificationRequestSignal(),
      }
    )
  );
}

export async function verifyDeviceCode(input: {
  challengeId: string;
  code: string;
  rememberDevice: boolean;
}) {
  return readDeviceVerificationResponse(
    await authenticatedFetch("/api/auth/device-verification/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: deviceVerificationRequestSignal(),
    })
  );
}

export async function resendDeviceCode(challengeId: string) {
  return readDeviceVerificationResponse(
    await authenticatedFetch("/api/auth/device-verification/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengeId }),
      signal: deviceVerificationRequestSignal(),
    })
  );
}
