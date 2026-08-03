import { sendTransactionalEmail } from "@/lib/email/service";

export function validateRecoveryActionLink(value: unknown) {
  if (typeof value !== "string" || !value) return null;

  try {
    const url = new URL(value);
    const isRecoveryVerification =
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      /\/auth\/v1\/verify\/?$/.test(url.pathname) &&
      url.searchParams.get("type") === "recovery" &&
      Boolean(url.searchParams.get("token"));

    return isRecoveryVerification ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function sendCustomerPasswordRecoveryEmail(input: {
  auditId: string;
  customerEmail: string;
  customerId: string;
  customerReference?: string | null;
  recoveryUrl: string;
}) {
  const recoveryUrl = validateRecoveryActionLink(input.recoveryUrl);
  if (!recoveryUrl) {
    return {
      ok: false as const,
      status: "failed" as const,
      reason: "invalid_recovery_link" as const,
    };
  }

  const result = await sendTransactionalEmail({
    eventType: "customer_password_reset",
    to: input.customerEmail,
    context: {
      customerEmail: input.customerEmail,
      customerId: input.customerReference ?? null,
      recoveryUrl,
    },
    idempotencyKey: `customer_password_reset:${input.customerId}:${input.auditId}`,
    recipientUserId: input.customerId,
    metadata: {
      source: "admin_customer_security",
      audit_id: input.auditId,
    },
  });

  return {
    ok: result.ok && result.status === "sent",
    status: result.status,
    reason: result.ok ? result.skippedReason ?? null : "delivery_failed",
  };
}
