import {
  createHmac,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import type { User } from "@supabase/supabase-js";
import { resolveTransactionalEmailLanguageFromMetadata } from "@/lib/email/language";
import { sendTransactionalEmail } from "@/lib/email/service";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
export { CUSTOMER_DEVICE_VERIFICATION_REQUIRED_CODE } from "@/lib/customerDeviceContracts";

export const CUSTOMER_DEVICE_COOKIE_NAME = "__Host-mg_customer_device";
export const CUSTOMER_DEVICE_TRUST_DAYS = 30;
export const CUSTOMER_DEVICE_CODE_TTL_MINUTES = 10;
export const CUSTOMER_DEVICE_CODE_LENGTH = 6;
export const CUSTOMER_DEVICE_MAX_ATTEMPTS = 5;
export const CUSTOMER_DEVICE_RESEND_SECONDS = 60;
export const CUSTOMER_DEVICE_HMAC_KEY_VERSION = 1;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const deviceTokenPattern = /^[A-Za-z0-9_-]{32,160}$/;
const verificationCodePattern = /^\d{6}$/;

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

type RpcRecord = Record<string, unknown>;

export type CustomerDeviceAssuranceStatus =
  | "not_required"
  | "verified"
  | "required"
  | "revoked";

export type CustomerDeviceAssuranceState = {
  status: CustomerDeviceAssuranceStatus;
  maskedEmail: string;
};

export type CustomerDeviceChallengeState = CustomerDeviceAssuranceState & {
  challengeId?: string;
  expiresAt?: string;
  retryAfterSeconds?: number;
  outcome?:
    | "new_code_sent"
    | "existing_sent"
    | "delivery_pending"
    | "rate_limited"
    | "stale_challenge";
  canVerify?: boolean;
  sentNewCode?: boolean;
  rateLimited?: boolean;
};

export type CustomerDeviceVerificationResult = CustomerDeviceChallengeState & {
  attemptsRemaining?: number;
  trustedDeviceToken?: string;
  error?: string;
};

export class CustomerDeviceSecurityUnavailableError extends Error {
  constructor(message = "Account security verification is temporarily unavailable.") {
    super(message);
    this.name = "CustomerDeviceSecurityUnavailableError";
  }
}

function asRecord(value: unknown): RpcRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as RpcRecord
    : {};
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asPositiveInteger(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : undefined;
}

function asBoolean(value: unknown) {
  return value === true;
}

function getCustomerDeviceHmacSecret(
  environment: Readonly<Record<string, string | undefined>> = process.env
) {
  const secret = environment.CUSTOMER_DEVICE_HMAC_SECRET?.trim() ?? "";
  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new CustomerDeviceSecurityUnavailableError();
  }
  return secret;
}

export function hashCustomerDeviceToken(
  token: string,
  environment?: Readonly<Record<string, string | undefined>>
) {
  return createHmac("sha256", getCustomerDeviceHmacSecret(environment))
    .update(`mg-autotech:customer-device:v1:${token}`)
    .digest("hex");
}

export function hashCustomerDeviceCode(
  userId: string,
  sessionId: string,
  challengeId: string,
  code: string,
  environment?: Readonly<Record<string, string | undefined>>
) {
  return createHmac("sha256", getCustomerDeviceHmacSecret(environment))
    .update(
      `mg-autotech:customer-device-code:v1:${challengeId}:${sessionId}:${userId}:${code}`
    )
    .digest("hex");
}

export function customerDeviceHashesEqual(left: string, right: string) {
  if (!/^[0-9a-f]{64}$/i.test(left) || !/^[0-9a-f]{64}$/i.test(right)) {
    return false;
  }
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

export function generateCustomerDeviceToken() {
  return randomBytes(32).toString("base64url");
}

export function generateCustomerDeviceCode() {
  return String(randomInt(0, 1_000_000)).padStart(CUSTOMER_DEVICE_CODE_LENGTH, "0");
}

export function readCustomerDeviceCookie(cookieHeader: string | null) {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    if (name !== CUSTOMER_DEVICE_COOKIE_NAME) continue;
    const value = part.slice(separator + 1).trim();
    return deviceTokenPattern.test(value) ? value : null;
  }
  return null;
}

export function getCustomerDeviceCookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: CUSTOMER_DEVICE_TRUST_DAYS * 24 * 60 * 60,
  };
}

export function getCustomerDeviceCookieDeletionOptions() {
  return {
    ...getCustomerDeviceCookieOptions(),
    maxAge: 0,
    expires: new Date(0),
  };
}

export function extractSessionIdFromAccessToken(accessToken: string) {
  const payload = accessToken.split(".")[1];
  if (!payload) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      session_id?: unknown;
    };
    const sessionId = typeof decoded.session_id === "string"
      ? decoded.session_id
      : "";
    return uuidPattern.test(sessionId) ? sessionId : null;
  } catch {
    return null;
  }
}

export function maskCustomerEmail(email: string | null | undefined) {
  const normalized = email?.trim().toLowerCase() ?? "";
  const at = normalized.lastIndexOf("@");
  if (at <= 0) return "your registered e-mail";
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}

export function describeCustomerDevice(userAgent: string | null) {
  const value = userAgent ?? "";
  const browser = /Edg\//i.test(value)
    ? "Microsoft Edge"
    : /Firefox\//i.test(value)
      ? "Firefox"
      : /Chrome\//i.test(value)
        ? "Chrome"
        : /Safari\//i.test(value)
          ? "Safari"
          : "Browser";
  const platform = /Windows/i.test(value)
    ? "Windows"
    : /Android/i.test(value)
      ? "Android"
      : /iPhone|iPad|iPod/i.test(value)
        ? "iPhone / iPad"
        : /Mac OS|Macintosh/i.test(value)
          ? "macOS"
          : /Linux/i.test(value)
            ? "Linux"
            : "Unknown device";
  return `${browser} on ${platform}`.slice(0, 120);
}

async function callSecurityRpc(
  admin: SupabaseAdmin,
  name: string,
  parameters: Record<string, unknown>
) {
  const result = await admin.rpc(name, parameters);
  if (result.error) throw new CustomerDeviceSecurityUnavailableError();
  return asRecord(result.data);
}

export async function getCustomerDeviceAssuranceState(input: {
  user: User;
  sessionId: string | null;
  admin?: SupabaseAdmin;
}): Promise<CustomerDeviceAssuranceState> {
  const maskedEmail = maskCustomerEmail(input.user.email);
  if (!input.sessionId) return { status: "required", maskedEmail };

  const state = await callSecurityRpc(
    input.admin ?? getSupabaseAdmin(),
    "get_customer_session_assurance_state",
    {
      p_user_id: input.user.id,
      p_session_id: input.sessionId,
    }
  );
  const status = asString(state.status);
  if (
    status === "not_required" ||
    status === "verified" ||
    status === "required" ||
    status === "revoked"
  ) {
    return { status, maskedEmail };
  }
  throw new CustomerDeviceSecurityUnavailableError();
}

export async function prepareCustomerPasswordChangeVerification(input: {
  userId: string;
  sessionId: string | null;
  admin?: SupabaseAdmin;
}) {
  if (!input.sessionId) return "required" as const;
  const state = await callSecurityRpc(
    input.admin ?? getSupabaseAdmin(),
    "prepare_customer_password_change_verification",
    {
      p_user_id: input.userId,
      p_session_id: input.sessionId,
    }
  );
  const status = asString(state.status);
  if (status === "verified" || status === "required" || status === "revoked") {
    return status;
  }
  throw new CustomerDeviceSecurityUnavailableError();
}

export async function hasRecentCustomerPasswordChangeVerification(input: {
  userId: string;
  sessionId: string | null;
  admin?: SupabaseAdmin;
}) {
  if (!input.sessionId) return false;
  const state = await callSecurityRpc(
    input.admin ?? getSupabaseAdmin(),
    "customer_password_change_verification_state",
    {
      p_user_id: input.userId,
      p_session_id: input.sessionId,
    }
  );
  return state.verified === true;
}

export async function assureCustomerSessionFromTrustedDevice(input: {
  user: User;
  sessionId: string | null;
  cookieToken: string | null;
  admin?: SupabaseAdmin;
}): Promise<CustomerDeviceAssuranceState> {
  const current = await getCustomerDeviceAssuranceState({
    user: input.user,
    sessionId: input.sessionId,
    admin: input.admin,
  });
  if (current.status !== "required" || !input.cookieToken || !input.sessionId) {
    return current;
  }

  const trusted = await callSecurityRpc(
    input.admin ?? getSupabaseAdmin(),
    "assure_customer_session_from_trusted_device",
    {
      p_user_id: input.user.id,
      p_session_id: input.sessionId,
      p_token_hmac: hashCustomerDeviceToken(input.cookieToken),
      p_hmac_key_version: CUSTOMER_DEVICE_HMAC_KEY_VERSION,
    }
  );
  return trusted.verified === true
    ? { status: "verified", maskedEmail: current.maskedEmail }
    : current;
}

export async function startCustomerDeviceVerification(input: {
  user: User;
  sessionId: string | null;
  cookieToken: string | null;
  userAgent: string | null;
  resend?: boolean;
  previousChallengeId?: string;
  admin?: SupabaseAdmin;
}): Promise<CustomerDeviceChallengeState> {
  const admin = input.admin ?? getSupabaseAdmin();
  const current = await assureCustomerSessionFromTrustedDevice({
    user: input.user,
    sessionId: input.sessionId,
    cookieToken: input.cookieToken,
    admin,
  });
  if (current.status !== "required") return current;
  if (!input.sessionId || !input.user.email) {
    throw new CustomerDeviceSecurityUnavailableError();
  }

  const code = generateCustomerDeviceCode();
  const challengeId = randomUUID();
  const reservation = await callSecurityRpc(
    admin,
    "reserve_customer_device_challenge",
    {
      p_user_id: input.user.id,
      p_session_id: input.sessionId,
      p_challenge_id: challengeId,
      p_code_hmac: hashCustomerDeviceCode(
        input.user.id,
        input.sessionId,
        challengeId,
        code
      ),
      p_hmac_key_version: CUSTOMER_DEVICE_HMAC_KEY_VERSION,
      p_device_label: describeCustomerDevice(input.userAgent),
      p_force_resend: input.resend === true,
      p_previous_challenge_id:
        input.previousChallengeId && uuidPattern.test(input.previousChallengeId)
          ? input.previousChallengeId
          : null,
    }
  );
  const reservationStatus = asString(reservation.status);
  const retryAfterSeconds = asPositiveInteger(reservation.retry_after_seconds);
  const expiresAt = asString(reservation.expires_at) || undefined;
  const reservedChallengeId = asString(reservation.challenge_id);

  if (
    reservationStatus === "rate_limited" ||
    reservationStatus === "existing_sent" ||
    reservationStatus === "delivery_pending" ||
    reservationStatus === "stale_challenge"
  ) {
    return {
      status: "required",
      maskedEmail: current.maskedEmail,
      challengeId: reservedChallengeId || undefined,
      expiresAt,
      retryAfterSeconds: retryAfterSeconds ?? CUSTOMER_DEVICE_RESEND_SECONDS,
      outcome: reservationStatus,
      canVerify: asBoolean(reservation.can_verify),
      sentNewCode: false,
      rateLimited: reservationStatus === "rate_limited",
    };
  }
  if (reservationStatus === "revoked") {
    return { status: "revoked", maskedEmail: current.maskedEmail };
  }
  if (reservationStatus === "verified") {
    return { status: "verified", maskedEmail: current.maskedEmail };
  }
  if (reservationStatus !== "reserved") {
    throw new CustomerDeviceSecurityUnavailableError();
  }

  const issuedAt = asString(reservation.issued_at);
  if (!reservedChallengeId || !issuedAt) {
    throw new CustomerDeviceSecurityUnavailableError();
  }

  const delivery = await sendTransactionalEmail({
    eventType: "customer_device_verification",
    to: input.user.email,
    language: resolveTransactionalEmailLanguageFromMetadata(
      input.user.user_metadata
    ),
    context: {
      customerEmail: input.user.email,
      verificationCode: code,
      deviceLabel: describeCustomerDevice(input.userAgent),
      verificationMinutes: CUSTOMER_DEVICE_CODE_TTL_MINUTES,
    },
    idempotencyKey: `customer-device:${reservedChallengeId}:${issuedAt}`,
    recipientUserId: input.user.id,
    metadata: {
      challenge_id: reservedChallengeId,
      code_logged: false,
      device_token_logged: false,
    },
  });

  const delivered = delivery.status === "sent" &&
    delivery.provider === "resend" &&
    Boolean(delivery.messageId?.trim());
  if (!delivery.ok || !delivered) {
    await admin.rpc("invalidate_customer_device_challenge", {
      p_user_id: input.user.id,
      p_session_id: input.sessionId,
      p_challenge_id: reservedChallengeId,
    });
    throw new CustomerDeviceSecurityUnavailableError(
      "The verification e-mail could not be sent. Please try again shortly."
    );
  }

  let markedSent = false;
  for (const delay of [0, 150, 400] as const) {
    if (delay > 0) {
      await new Promise((resolve) => globalThis.setTimeout(resolve, delay));
    }
    try {
      const result = await callSecurityRpc(
        admin,
        "mark_customer_device_challenge_sent",
        {
          p_user_id: input.user.id,
          p_session_id: input.sessionId,
          p_challenge_id: reservedChallengeId,
        }
      );
      if (result.sent === true) {
        markedSent = true;
        break;
      }
    } catch {
      // Retry a bounded number of times; the RPC is idempotent.
    }
  }
  if (!markedSent) {
    await admin.rpc("invalidate_customer_device_challenge", {
      p_user_id: input.user.id,
      p_session_id: input.sessionId,
      p_challenge_id: reservedChallengeId,
    });
    throw new CustomerDeviceSecurityUnavailableError(
      "The e-mail was accepted, but the security code could not be activated. Request a new code."
    );
  }

  return {
    status: "required",
    maskedEmail: current.maskedEmail,
    challengeId: reservedChallengeId,
    expiresAt,
    retryAfterSeconds: CUSTOMER_DEVICE_RESEND_SECONDS,
    outcome: "new_code_sent",
    canVerify: true,
    sentNewCode: true,
    rateLimited: false,
  };
}

export async function verifyCustomerDeviceCode(input: {
  user: User;
  sessionId: string | null;
  challengeId: string;
  code: string;
  rememberDevice: boolean;
  userAgent: string | null;
  admin?: SupabaseAdmin;
}): Promise<CustomerDeviceVerificationResult> {
  const current = await getCustomerDeviceAssuranceState({
    user: input.user,
    sessionId: input.sessionId,
    admin: input.admin,
  });
  if (current.status !== "required") return current;
  if (
    !input.sessionId ||
    !uuidPattern.test(input.challengeId) ||
    !verificationCodePattern.test(input.code)
  ) {
    return {
      ...current,
      error: "Enter the 6-digit code from your e-mail.",
    };
  }

  const trustedDeviceToken = input.rememberDevice
    ? generateCustomerDeviceToken()
    : null;
  const verification = await callSecurityRpc(
    input.admin ?? getSupabaseAdmin(),
    "consume_customer_device_challenge",
    {
      p_user_id: input.user.id,
      p_session_id: input.sessionId,
      p_challenge_id: input.challengeId,
      p_code_hmac: hashCustomerDeviceCode(
        input.user.id,
        input.sessionId,
        input.challengeId,
        input.code
      ),
      p_hmac_key_version: CUSTOMER_DEVICE_HMAC_KEY_VERSION,
      p_token_hmac: trustedDeviceToken
        ? hashCustomerDeviceToken(trustedDeviceToken)
        : null,
      p_device_label: describeCustomerDevice(input.userAgent),
    }
  );
  const status = asString(verification.status);
  if (status === "verified") {
    return {
      status: "verified",
      maskedEmail: current.maskedEmail,
      trustedDeviceToken: trustedDeviceToken ?? undefined,
    };
  }

  const attemptsRemaining = asPositiveInteger(verification.attempts_remaining);
  const errors: Record<string, string> = {
    invalid: "That code is not correct. Check the e-mail and try again.",
    expired: "That code has expired. Request a new code.",
    locked: "Too many incorrect attempts. Request a new code.",
    missing: "Request a new verification code.",
  };
  return {
    status: "required",
    maskedEmail: current.maskedEmail,
    attemptsRemaining,
    error: errors[status] ?? "The code could not be verified.",
  };
}

export async function revokeAllCustomerDeviceTrust(
  userId: string,
  admin: SupabaseAdmin = getSupabaseAdmin()
) {
  await callSecurityRpc(admin, "revoke_all_customer_trusted_devices", {
    p_user_id: userId,
  });
}

export type CustomerTrustedDeviceSummary = {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string;
  trustedUntil: string;
  current: boolean;
};

export async function listCustomerTrustedDevices(input: {
  userId: string;
  cookieToken: string | null;
  admin?: SupabaseAdmin;
}): Promise<CustomerTrustedDeviceSummary[]> {
  const admin = input.admin ?? getSupabaseAdmin();
  const result = await admin
    .from("customer_trusted_devices")
    .select("id, token_hmac, device_label, created_at, last_used_at, expires_at")
    .eq("user_id", input.userId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("last_used_at", { ascending: false });
  if (result.error) throw new CustomerDeviceSecurityUnavailableError();

  const currentHmac = input.cookieToken
    ? hashCustomerDeviceToken(input.cookieToken)
    : null;
  return (result.data ?? []).map((row) => ({
    id: String(row.id),
    label: String(row.device_label || "Trusted browser"),
    createdAt: String(row.created_at),
    lastUsedAt: String(row.last_used_at),
    trustedUntil: String(row.expires_at),
    current: Boolean(
      currentHmac && customerDeviceHashesEqual(currentHmac, String(row.token_hmac))
    ),
  }));
}

export async function revokeCustomerTrustedDevice(input: {
  userId: string;
  deviceId: string;
  admin?: SupabaseAdmin;
}) {
  const result = await callSecurityRpc(
    input.admin ?? getSupabaseAdmin(),
    "revoke_customer_trusted_device",
    {
      p_user_id: input.userId,
      p_device_id: input.deviceId,
    }
  );
  return { revoked: result.revoked === true };
}

export async function revokeOtherCustomerTrustedDevices(input: {
  userId: string;
  currentDeviceId: string | null;
  admin?: SupabaseAdmin;
}) {
  return callSecurityRpc(
    input.admin ?? getSupabaseAdmin(),
    "revoke_other_customer_trusted_devices",
    {
      p_user_id: input.userId,
      p_current_device_id: input.currentDeviceId,
    }
  );
}
