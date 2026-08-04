import { createHash } from "node:crypto";
import type { WebhookEventPayload } from "resend";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  EmailSuppressionReason,
  ProviderEmailDeliveryStatus,
} from "@/lib/email/types";

const trackedProviderEvents = new Map<string, ProviderEmailDeliveryStatus>([
  ["email.sent", "sent"],
  ["email.delivered", "delivered"],
  ["email.delivery_delayed", "delayed"],
  ["email.bounced", "bounced"],
  ["email.complained", "complained"],
  ["email.failed", "failed"],
  ["email.suppressed", "suppressed"],
]);

const deliveryIssueStatuses = [
  "delayed",
  "bounced",
  "complained",
  "failed",
  "suppressed",
] as const;

export type NormalizedProviderDeliveryEvent = {
  providerEventId: string;
  providerMessageId: string;
  providerEventType: string;
  deliveryStatus: ProviderEmailDeliveryStatus;
  recipientEmail: string;
  occurredAt: string;
  reasonCode: string | null;
  reasonMessage: string | null;
  payloadSha256: string;
  suppressionReason: EmailSuppressionReason | null;
};

export type EmailSuppressionLookup = {
  available: boolean;
  suppressed: boolean;
  reason: EmailSuppressionReason | null;
};

export type AdminEmailDeliveryIssue = {
  id: string;
  status: (typeof deliveryIssueStatuses)[number];
  eventType: string;
  occurredAt: string;
};

type ProviderDeliveryIssueRow = {
  provider_event_id?: unknown;
  provider_message_id?: unknown;
  provider_event_type?: unknown;
  delivery_status?: unknown;
  occurred_at?: unknown;
};

function cleanReason(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, 300) : null;
}

export function normalizeEmailAddress(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized.length > 250) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

export function getSuppressionReasonForDeliveryStatus(
  status: ProviderEmailDeliveryStatus
): EmailSuppressionReason | null {
  if (status === "bounced") return "hard_bounce";
  if (status === "complained") return "complaint";
  if (status === "suppressed") return "provider_suppressed";
  return null;
}

export function shouldBlockRecipientForSuppression(
  lookup: EmailSuppressionLookup,
  dryRun: boolean
) {
  if (lookup.suppressed) return true;
  return !lookup.available && !dryRun;
}

export function normalizeResendDeliveryEvent(input: {
  providerEventId: string;
  payload: string;
  event: WebhookEventPayload;
}): NormalizedProviderDeliveryEvent | null {
  const deliveryStatus = trackedProviderEvents.get(input.event.type);
  if (!deliveryStatus || !("data" in input.event)) return null;

  const data = input.event.data as unknown as Record<string, unknown>;
  const providerMessageId = cleanReason(data.email_id);
  const recipients = Array.isArray(data.to) ? data.to : [];
  const recipientEmail = normalizeEmailAddress(recipients[0]);
  const occurred = new Date(input.event.created_at);
  if (
    !input.providerEventId.trim() ||
    !providerMessageId ||
    !recipientEmail ||
    Number.isNaN(occurred.getTime())
  ) {
    return null;
  }

  let reasonCode: string | null = null;
  let reasonMessage: string | null = null;
  if (input.event.type === "email.bounced") {
    reasonCode = cleanReason(input.event.data.bounce.type);
    reasonMessage = cleanReason(input.event.data.bounce.message);
  } else if (input.event.type === "email.failed") {
    reasonCode = "provider_failed";
    reasonMessage = cleanReason(input.event.data.failed.reason);
  } else if (input.event.type === "email.suppressed") {
    reasonCode = cleanReason(input.event.data.suppressed.type);
    reasonMessage = cleanReason(input.event.data.suppressed.message);
  }

  return {
    providerEventId: input.providerEventId.trim().slice(0, 200),
    providerMessageId,
    providerEventType: input.event.type,
    deliveryStatus,
    recipientEmail,
    occurredAt: occurred.toISOString(),
    reasonCode,
    reasonMessage,
    payloadSha256: createHash("sha256").update(input.payload).digest("hex"),
    suppressionReason: getSuppressionReasonForDeliveryStatus(deliveryStatus),
  };
}

export async function getActiveEmailSuppression(
  recipientEmail: string
): Promise<EmailSuppressionLookup> {
  const normalized = normalizeEmailAddress(recipientEmail);
  if (!normalized) {
    return { available: true, suppressed: true, reason: "manual" };
  }

  try {
    const admin = getSupabaseAdmin();
    const result = await admin
      .from("email_suppressions")
      .select("reason,active")
      .eq("recipient_email", normalized)
      .eq("active", true)
      .maybeSingle();

    if (result.error) {
      return { available: false, suppressed: false, reason: null };
    }

    return {
      available: true,
      suppressed: Boolean(result.data?.active),
      reason: (result.data?.reason as EmailSuppressionReason | undefined) ?? null,
    };
  } catch {
    return { available: false, suppressed: false, reason: null };
  }
}

function deliveryTimestampPatch(event: NormalizedProviderDeliveryEvent) {
  const patch: Record<string, string> = {
    delivery_status: event.deliveryStatus,
    last_delivery_event_at: event.occurredAt,
  };
  if (event.deliveryStatus === "delivered") patch.delivered_at = event.occurredAt;
  if (event.deliveryStatus === "delayed") patch.delayed_at = event.occurredAt;
  if (event.deliveryStatus === "bounced") patch.bounced_at = event.occurredAt;
  if (event.deliveryStatus === "complained") patch.complained_at = event.occurredAt;
  return patch;
}

export async function persistProviderDeliveryEvent(
  event: NormalizedProviderDeliveryEvent
) {
  const admin = getSupabaseAdmin();
  const emailLog = await admin
    .from("email_events")
    .select("id")
    .eq("provider_message_id", event.providerMessageId)
    .maybeSingle();

  const emailEventId = emailLog.error ? null : String(emailLog.data?.id ?? "") || null;
  const insertResult = await admin.from("email_delivery_events").insert({
    provider_event_id: event.providerEventId,
    email_event_id: emailEventId,
    provider_message_id: event.providerMessageId,
    provider_event_type: event.providerEventType,
    delivery_status: event.deliveryStatus,
    recipient_email: event.recipientEmail,
    occurred_at: event.occurredAt,
    reason_code: event.reasonCode,
    reason_message: event.reasonMessage,
    payload_sha256: event.payloadSha256,
  });

  const duplicate = insertResult.error?.code === "23505";
  if (insertResult.error && !duplicate) {
    return { ok: false, duplicate: false, error: "delivery_event_store_failed" } as const;
  }

  if (emailEventId) {
    const updateResult = await admin
      .from("email_events")
      .update(deliveryTimestampPatch(event))
      .eq("id", emailEventId)
      .or(`last_delivery_event_at.is.null,last_delivery_event_at.lte.${event.occurredAt}`);
    if (updateResult.error) {
      return { ok: false, duplicate, error: "email_event_delivery_update_failed" } as const;
    }
  }

  if (event.suppressionReason) {
    const suppressionResult = await admin.from("email_suppressions").upsert(
      {
        recipient_email: event.recipientEmail,
        reason: event.suppressionReason,
        source_event_id: event.providerEventId,
        active: true,
        last_event_at: event.occurredAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "recipient_email" }
    );
    if (suppressionResult.error) {
      return { ok: false, duplicate, error: "email_suppression_store_failed" } as const;
    }
  }

  return { ok: true, duplicate } as const;
}

export async function listAdminEmailDeliveryIssues(
  limit = 8
): Promise<AdminEmailDeliveryIssue[]> {
  try {
    const admin = getSupabaseAdmin();
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const result = await admin
      .from("email_delivery_events")
      .select("provider_event_id,provider_message_id,provider_event_type,delivery_status,occurred_at")
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: false })
      .limit(100);

    if (result.error) return [];
    return selectLatestAdminEmailDeliveryIssues(result.data ?? [], limit);
  } catch {
    return [];
  }
}

export function selectLatestAdminEmailDeliveryIssues(
  rows: ProviderDeliveryIssueRow[],
  limit = 8
) {
  const seenMessages = new Set<string>();
  const issues: AdminEmailDeliveryIssue[] = [];
  for (const row of rows) {
    const messageId = String(row.provider_message_id || "");
    if (!messageId || seenMessages.has(messageId)) continue;
    seenMessages.add(messageId);
    const status = row.delivery_status as (typeof deliveryIssueStatuses)[number];
    if (!deliveryIssueStatuses.includes(status)) continue;
    issues.push({
      id: String(row.provider_event_id),
      status,
      eventType: String(row.provider_event_type),
      occurredAt: String(row.occurred_at),
    });
    if (issues.length >= Math.max(1, Math.min(limit, 25))) break;
  }
  return issues;
}
