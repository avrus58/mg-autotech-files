import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { EmailDeliveryStatus, EmailEventLogInput } from "@/lib/email/types";

type EmailEventInsertResult =
  | {
      ok: true;
      id: string;
      leaseUpdatedAt: string;
      duplicate: false;
    }
  | {
      ok: true;
      id: null;
      leaseUpdatedAt: null;
      duplicate: true;
      existingStatus: string | null;
    }
  | {
      ok: false;
      id: null;
      leaseUpdatedAt: null;
      duplicate: false;
      error: string;
    };

export const EMAIL_PENDING_LEASE_STALE_MS = 10 * 60 * 1000;
export const EMAIL_PENDING_LEASE_SAFE_RECLAIM_WINDOW_MS = 23 * 60 * 60 * 1000;

export type EmailPendingLeaseState = "active" | "reclaimable" | "expired";
export type EmailFailedRecoveryState = "reclaimable" | "expired" | "invalid";

export function getEmailPendingLeaseState(
  updatedAt: string | null | undefined,
  now = Date.now()
): EmailPendingLeaseState {
  const updatedAtMs = new Date(updatedAt ?? "").getTime();
  if (!Number.isFinite(updatedAtMs) || !Number.isFinite(now)) return "active";
  const ageMs = now - updatedAtMs;
  if (ageMs < EMAIL_PENDING_LEASE_STALE_MS) return "active";
  if (ageMs >= EMAIL_PENDING_LEASE_SAFE_RECLAIM_WINDOW_MS) return "expired";
  return "reclaimable";
}

export function getEmailFailedRecoveryState(
  updatedAt: string | null | undefined,
  now = Date.now()
): EmailFailedRecoveryState {
  const updatedAtMs = new Date(updatedAt ?? "").getTime();
  if (!Number.isFinite(updatedAtMs) || !Number.isFinite(now)) return "invalid";
  const ageMs = now - updatedAtMs;
  if (ageMs < 0) return "invalid";
  return ageMs >= EMAIL_PENDING_LEASE_SAFE_RECLAIM_WINDOW_MS
    ? "expired"
    : "reclaimable";
}

const forbiddenMetadataKey = /raw|hex|storage|path|provider|source_reference|sample|offset|admin_note|internal|binary|token|recovery_url|action_link/i;

function sanitizeMetadataValue(value: unknown, depth = 0): unknown {
  if (depth > 3) return "[depth_limited]";
  if (typeof value === "string") return value.slice(0, 500);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) {
    return value.slice(0, 25).map((item) => sanitizeMetadataValue(item, depth + 1));
  }
  if (typeof value === "object" && value) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !forbiddenMetadataKey.test(key))
        .slice(0, 40)
        .map(([key, item]) => [key, sanitizeMetadataValue(item, depth + 1)])
    );
  }
  return String(value).slice(0, 200);
}

export function sanitizeEmailEventMetadata(value: Record<string, unknown> | undefined) {
  if (!value) return {};
  return sanitizeMetadataValue(value) as Record<string, unknown>;
}

export async function createEmailEventLog(input: EmailEventLogInput): Promise<EmailEventInsertResult> {
  try {
    const admin = getSupabaseAdmin();
    const leaseStartedAt = new Date().toISOString();
    const result = await admin
      .from("email_events")
      .insert({
        event_type: input.eventType,
        recipient_email: input.recipientEmail.toLowerCase(),
        recipient_user_id: input.recipientUserId ?? null,
        related_order_id: input.relatedOrderId ?? null,
        related_request_id: input.relatedRequestId ?? null,
        idempotency_key: input.idempotencyKey,
        status: input.status,
        provider: input.provider,
        provider_message_id: input.providerMessageId ?? null,
        error_message: input.errorMessage ?? null,
        metadata: sanitizeEmailEventMetadata(input.metadata),
        updated_at: leaseStartedAt,
      })
      .select("id,updated_at")
      .single();

    if (result.error) {
      if (result.error.code === "23505") {
        const existing = await admin
          .from("email_events")
          .select("id,status,updated_at")
          .eq("idempotency_key", input.idempotencyKey)
          .maybeSingle();
        const existingId = existing.data?.id
          ? String(existing.data.id)
          : null;
        const existingStatus = existing.data?.status ?? null;
        const existingUpdatedAt =
          typeof existing.data?.updated_at === "string"
            ? existing.data.updated_at
            : null;

        if (
          !existing.error &&
          existingId &&
          existingUpdatedAt &&
          existingStatus === "failed"
        ) {
          const recoveryState = getEmailFailedRecoveryState(existingUpdatedAt);
          if (recoveryState === "reclaimable") {
            const reclaimed = await admin
              .from("email_events")
              .update({
                status: "pending",
                delivery_status: "pending",
                error_message: null,
                updated_at: leaseStartedAt,
              })
              .eq("id", existingId)
              .eq("status", "failed")
              .eq("updated_at", existingUpdatedAt)
              .select("id,updated_at")
              .maybeSingle();
            if (
              !reclaimed.error &&
              reclaimed.data?.id &&
              typeof reclaimed.data.updated_at === "string"
            ) {
              return {
                ok: true,
                id: String(reclaimed.data.id),
                leaseUpdatedAt: reclaimed.data.updated_at,
                duplicate: false,
              };
            }
          } else if (recoveryState === "expired") {
            const expiredBefore = new Date(
              Date.now() - EMAIL_PENDING_LEASE_SAFE_RECLAIM_WINDOW_MS
            ).toISOString();
            const terminal = await admin
              .from("email_events")
              .update({
                status: "skipped",
                delivery_status: "failed",
                error_message:
                  "Failed delivery exceeded the provider idempotency recovery window; manual reconciliation is required.",
                updated_at: leaseStartedAt,
              })
              .eq("id", existingId)
              .eq("status", "failed")
              .eq("updated_at", existingUpdatedAt)
              .lte("updated_at", expiredBefore)
              .select("id")
              .maybeSingle();
            if (!terminal.error && terminal.data?.id) {
              return {
                ok: true,
                id: null,
                leaseUpdatedAt: null,
                duplicate: true,
                existingStatus: "skipped",
              };
            }
          }
        }

        if (
          !existing.error &&
          existingId &&
          existingUpdatedAt &&
          existingStatus === "pending"
        ) {
          const leaseState = getEmailPendingLeaseState(existingUpdatedAt);
          if (leaseState === "reclaimable") {
            const staleBefore = new Date(
              Date.now() - EMAIL_PENDING_LEASE_STALE_MS
            ).toISOString();
            const reclaimed = await admin
              .from("email_events")
              .update({
                status: "pending",
                delivery_status: "pending",
                error_message: null,
                updated_at: leaseStartedAt,
              })
              .eq("id", existingId)
              .eq("status", "pending")
              .eq("updated_at", existingUpdatedAt)
              .lt("updated_at", staleBefore)
              .select("id,updated_at")
              .maybeSingle();
            if (
              !reclaimed.error &&
              reclaimed.data?.id &&
              typeof reclaimed.data.updated_at === "string"
            ) {
              return {
                ok: true,
                id: String(reclaimed.data.id),
                leaseUpdatedAt: reclaimed.data.updated_at,
                duplicate: false,
              };
            }
          } else if (leaseState === "expired") {
            // Resend deduplicates a stable key for 24 hours. Beyond the bounded
            // reclaim window we cannot prove whether a lost response was sent,
            // so terminalize the lease for manual reconciliation instead of
            // risking a duplicate live message.
            const expiredBefore = new Date(
              Date.now() - EMAIL_PENDING_LEASE_SAFE_RECLAIM_WINDOW_MS
            ).toISOString();
            const terminal = await admin
              .from("email_events")
              .update({
                status: "skipped",
                delivery_status: "failed",
                error_message:
                  "Pending delivery exceeded the provider idempotency recovery window; manual reconciliation is required.",
                updated_at: leaseStartedAt,
              })
              .eq("id", existingId)
              .eq("status", "pending")
              .eq("updated_at", existingUpdatedAt)
              .lte("updated_at", expiredBefore)
              .select("id")
              .maybeSingle();
            if (!terminal.error && terminal.data?.id) {
              return {
                ok: true,
                id: null,
                leaseUpdatedAt: null,
                duplicate: true,
                existingStatus: "skipped",
              };
            }
          }
        }

        return {
          ok: true,
          id: null,
          leaseUpdatedAt: null,
          duplicate: true,
          existingStatus,
        };
      }
      if (["42P01", "42703"].includes(result.error.code || "")) {
        return {
          ok: false,
          id: null,
          leaseUpdatedAt: null,
          duplicate: false,
          error: "email_events table is not available",
        };
      }
      return {
        ok: false,
        id: null,
        leaseUpdatedAt: null,
        duplicate: false,
        error: result.error.message,
      };
    }
    if (!result.data?.id || typeof result.data.updated_at !== "string") {
      return {
        ok: false,
        id: null,
        leaseUpdatedAt: null,
        duplicate: false,
        error: "email event lease is unavailable",
      };
    }
    return {
      ok: true,
      id: String(result.data.id),
      leaseUpdatedAt: result.data.updated_at,
      duplicate: false,
    };
  } catch (error) {
    return {
      ok: false,
      id: null,
      leaseUpdatedAt: null,
      duplicate: false,
      error: error instanceof Error ? error.message : "Email log unavailable",
    };
  }
}

export async function updateEmailEventLog(
  id: string | null,
  leaseUpdatedAt: string | null,
  patch: {
    status: EmailDeliveryStatus;
    deliveryStatus?: EmailDeliveryStatus | "delivered" | "delayed" | "bounced" | "complained" | "suppressed";
    providerMessageId?: string | null;
    errorMessage?: string | null;
    sentAt?: string | null;
  }
) {
  if (!id || !leaseUpdatedAt) return false;
  try {
    const admin = getSupabaseAdmin();
    const update: Record<string, unknown> = {
      status: patch.status,
      updated_at: new Date().toISOString(),
    };
    if (patch.deliveryStatus !== undefined) update.delivery_status = patch.deliveryStatus;
    if (patch.providerMessageId !== undefined) update.provider_message_id = patch.providerMessageId;
    if (patch.errorMessage !== undefined) update.error_message = patch.errorMessage;
    if (patch.sentAt !== undefined) update.sent_at = patch.sentAt;
    else if (patch.status === "sent") update.sent_at = new Date().toISOString();

    const result = await admin
      .from("email_events")
      .update(update)
      .eq("id", id)
      .eq("status", "pending")
      .eq("updated_at", leaseUpdatedAt)
      .select("id")
      .maybeSingle();
    return !result.error && Boolean(result.data?.id);
  } catch {
    // Email logging must not break the customer/request/payment flow.
    return false;
  }
}
