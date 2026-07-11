import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { EmailDeliveryStatus, EmailEventLogInput } from "@/lib/email/types";

type EmailEventInsertResult =
  | { ok: true; id: string | null; duplicate: false }
  | { ok: true; id: null; duplicate: true }
  | { ok: false; id: null; duplicate: false; error: string };

function sanitizeMetadata(value: Record<string, unknown> | undefined) {
  if (!value) return {};
  const forbidden = /raw|hex|storage|path|provider|source_reference|sample|offset|admin_note|internal|binary/i;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !forbidden.test(key))
      .map(([key, item]) => [key, typeof item === "string" ? item.slice(0, 500) : item])
  );
}

export async function createEmailEventLog(input: EmailEventLogInput): Promise<EmailEventInsertResult> {
  try {
    const admin = getSupabaseAdmin();
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
        metadata: sanitizeMetadata(input.metadata),
      })
      .select("id")
      .single();

    if (result.error) {
      if (result.error.code === "23505") return { ok: true, id: null, duplicate: true };
      if (["42P01", "42703"].includes(result.error.code || "")) {
        return { ok: false, id: null, duplicate: false, error: "email_events table is not available" };
      }
      return { ok: false, id: null, duplicate: false, error: result.error.message };
    }
    return { ok: true, id: String(result.data.id), duplicate: false };
  } catch (error) {
    return {
      ok: false,
      id: null,
      duplicate: false,
      error: error instanceof Error ? error.message : "Email log unavailable",
    };
  }
}

export async function updateEmailEventLog(
  id: string | null,
  patch: {
    status: EmailDeliveryStatus;
    providerMessageId?: string | null;
    errorMessage?: string | null;
    sentAt?: string | null;
  }
) {
  if (!id) return;
  try {
    const admin = getSupabaseAdmin();
    await admin
      .from("email_events")
      .update({
        status: patch.status,
        provider_message_id: patch.providerMessageId ?? null,
        error_message: patch.errorMessage ?? null,
        sent_at: patch.sentAt ?? (patch.status === "sent" ? new Date().toISOString() : null),
      })
      .eq("id", id);
  } catch {
    // Email logging must not break the customer/request/payment flow.
  }
}
