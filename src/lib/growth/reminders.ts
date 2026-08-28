import { createHash } from "node:crypto";
import { loadUserTransactionalEmailLanguage } from "@/lib/email/languageServer";
import { getSiteUrl } from "@/lib/email/render";
import { sendTransactionalEmail } from "@/lib/email/service";
import { recordGrowthReminderJourneyOutcome } from "@/lib/growth/server";
import { isGrowthCustomerClassificationMigrationMissing } from "@/lib/growth/customerClassificationServer";
import type { GrowthReminderSendResult } from "@/lib/growth/types";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const minimumAgeMs = 24 * 60 * 60_000;
const maximumAgeMs = 14 * 24 * 60 * 60_000;
const reminderCooldownMs = 30 * 24 * 60 * 60_000;

type StartedEventRow = {
  id: string;
  user_id: string | null;
  occurred_at: string | null;
  safe_metadata: unknown;
};

type ReminderProfileRow = {
  id: string;
  email: string | null;
  customer_id: string | null;
  role: string | null;
  account_status: string | null;
};

export type GrowthReminderCandidate = {
  sourceEventId: string;
  userId: string;
  customerReference: string;
  occurredAt: string;
};

export function isExplicitReminderJourneyMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const metadata = value as Record<string, unknown>;
  return metadata.purpose === "reminder" &&
    metadata.consent_version === "abandoned-request-v1";
}

export function isGrowthReminderEligible(input: {
  startedAt: string | null;
  now: Date;
  preferenceEnabled: boolean;
  hasLaterOrder: boolean;
  hasReminderAction: boolean;
  email: string | null;
  role: string | null;
  accountStatus: string | null;
  analyticsExcluded?: boolean;
}) {
  const startedAt = input.startedAt ? new Date(input.startedAt).getTime() : NaN;
  const age = input.now.getTime() - startedAt;
  return Number.isFinite(startedAt) &&
    age >= minimumAgeMs && age <= maximumAgeMs &&
    input.preferenceEnabled &&
    !input.hasLaterOrder &&
    !input.hasReminderAction &&
    input.analyticsExcluded !== true &&
    Boolean(input.email) &&
    !["admin", "staff"].includes(input.role ?? "customer") &&
    !["blocked", "disabled", "suspended"].includes(input.accountStatus ?? "active");
}

export async function getEligibleGrowthReminderCandidates(input?: {
  now?: Date;
  limit?: number;
}) {
  const now = input?.now ?? new Date();
  const admin = getSupabaseAdmin();
  const from = new Date(now.getTime() - maximumAgeMs).toISOString();
  const to = new Date(now.getTime() - minimumAgeMs).toISOString();
  const eventsResult = await admin
    .from("growth_journey_events")
    .select("id,user_id,occurred_at,safe_metadata")
    .eq("event_type", "request_started")
    .contains("safe_metadata", {
      purpose: "reminder",
      consent_version: "abandoned-request-v1",
    })
    .gte("occurred_at", from)
    .lte("occurred_at", to)
    .order("occurred_at", { ascending: false })
    .limit(Math.max(1, Math.min(input?.limit ?? 50, 200)));
  if (eventsResult.error) throw eventsResult.error;

  const events = (eventsResult.data ?? []) as StartedEventRow[];
  const userIds = [...new Set(events.map((row) => row.user_id).filter((id): id is string => Boolean(id)))];
  if (!events.length || !userIds.length) return [] as GrowthReminderCandidate[];

  const [preferenceResult, actionResult, profileResult, orderResult, classificationResult] = await Promise.all([
    admin.from("growth_customer_preferences").select("user_id,abandoned_request_reminders").in("user_id", userIds),
    admin.from("growth_reminder_actions")
      .select("source_event_id,user_id,created_at")
      .in("user_id", userIds)
      .gte("created_at", new Date(now.getTime() - reminderCooldownMs).toISOString()),
    admin.from("profiles").select("id,email,customer_id,role,account_status").in("id", userIds),
    admin.from("orders").select("customer_id,created_at").in("customer_id", userIds).gte("created_at", from),
    admin.from("growth_customer_classifications")
      .select("user_id,analytics_excluded")
      .in("user_id", userIds),
  ]);
  const error = preferenceResult.error || actionResult.error || profileResult.error || orderResult.error;
  if (error) throw error;
  if (classificationResult.error && !isGrowthCustomerClassificationMigrationMissing(classificationResult.error)) {
    throw classificationResult.error;
  }

  const enabled = new Set((preferenceResult.data ?? [])
    .filter((row) => row.abandoned_request_reminders === true)
    .map((row) => String(row.user_id)));
  const acted = new Set((actionResult.data ?? []).map((row) => String(row.source_event_id)));
  const actedUsers = new Set((actionResult.data ?? []).map((row) => String(row.user_id)).filter(Boolean));
  const excludedUsers = new Set((classificationResult.data ?? [])
    .filter((row) => row.analytics_excluded === true)
    .map((row) => String(row.user_id)));
  const profiles = new Map(((profileResult.data ?? []) as ReminderProfileRow[]).map((row) => [row.id, row]));
  const orders = (orderResult.data ?? []) as Array<{ customer_id: string | null; created_at: string | null }>;
  const includedUsers = new Set<string>();

  return events.flatMap((event) => {
    if (!isExplicitReminderJourneyMetadata(event.safe_metadata)) return [];
    if (!event.user_id || !event.occurred_at) return [];
    if (includedUsers.has(event.user_id)) return [];
    const profile = profiles.get(event.user_id);
    if (!profile) return [];
    const startedAt = new Date(event.occurred_at).getTime();
    const hasLaterOrder = orders.some((order) =>
      order.customer_id === event.user_id &&
      Boolean(order.created_at) &&
      new Date(order.created_at as string).getTime() >= startedAt
    );
    if (!isGrowthReminderEligible({
      startedAt: event.occurred_at,
      now,
      preferenceEnabled: enabled.has(event.user_id),
      hasLaterOrder,
      hasReminderAction: acted.has(event.id) || actedUsers.has(event.user_id),
      email: profile.email,
      role: profile.role,
      accountStatus: profile.account_status,
      analyticsExcluded: excludedUsers.has(event.user_id),
    })) return [];
    includedUsers.add(event.user_id);
    return [{
      sourceEventId: event.id,
      userId: event.user_id,
      customerReference: profile.customer_id || `Customer ${event.user_id.slice(0, 8).toUpperCase()}`,
      occurredAt: event.occurred_at,
    }];
  });
}

export async function sendGrowthAbandonedRequestReminder(input: {
  sourceEventId: string;
  actorUserId: string;
}): Promise<GrowthReminderSendResult> {
  const candidates = await getEligibleGrowthReminderCandidates({ limit: 200 });
  const candidate = candidates.find((item) => item.sourceEventId === input.sourceEventId);
  if (!candidate) return { ok: false, status: "skipped", reason: "not_eligible" };

  const admin = getSupabaseAdmin();
  const profile = await admin
    .from("profiles")
    .select("email,customer_id")
    .eq("id", candidate.userId)
    .maybeSingle();
  if (profile.error || !profile.data?.email) {
    return { ok: false, status: "skipped", reason: "recipient_unavailable" };
  }

  const idempotencyKey = `growth-reminder:${createHash("sha256")
    .update(candidate.sourceEventId)
    .digest("hex")}`;
  const reservation = await admin.rpc("reserve_growth_reminder_action", {
    p_source_event_id: candidate.sourceEventId,
    p_user_id: candidate.userId,
    p_idempotency_key: idempotencyKey,
    p_actor_user_id: input.actorUserId,
  });
  if (reservation.error || !reservation.data) {
    return { ok: true, status: "skipped", reason: "already_processed" };
  }

  const language = await loadUserTransactionalEmailLanguage(candidate.userId);
  const result = await sendTransactionalEmail({
    eventType: "request_abandoned_reminder",
    to: profile.data.email,
    language,
    context: {
      customerId: profile.data.customer_id,
      dashboardUrl: `${getSiteUrl()}/new-request`,
      statusLabel: "Not submitted",
    },
    recipientUserId: candidate.userId,
    idempotencyKey,
    metadata: { source: "admin_growth_center", consented: true },
  });

  const status = result.provider === "dry_run"
    ? "dry_run"
    : result.ok && result.status === "sent"
      ? "sent"
      : result.ok
        ? "skipped"
        : "failed";
  const reason = result.skippedReason || result.error || null;
  await admin.from("growth_reminder_actions").update({
    status,
    reason: reason?.slice(0, 160) ?? null,
    completed_at: new Date().toISOString(),
  }).eq("id", String(reservation.data));
  await recordGrowthReminderJourneyOutcome({
    sourceEventId: candidate.sourceEventId,
    userId: candidate.userId,
    sent: status === "sent" || status === "dry_run",
    reason,
  });

  return { ok: result.ok, status, reason };
}
