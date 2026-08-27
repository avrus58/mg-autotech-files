import { createHash } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  growthConsentVersion,
  isGrowthVisitorId,
  normalizeGrowthCountry,
  normalizeGrowthPath,
} from "@/lib/growth/attribution";
import { hashGrowthVisitorId } from "@/lib/growth/attributionServer";
import type { GrowthAttributionTouch } from "@/lib/growth/types";

const migrationErrorCodes = new Set(["42P01", "42703", "PGRST202", "PGRST204", "PGRST205"]);

function growthSecret() {
  return process.env.GROWTH_ATTRIBUTION_HMAC_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

function compactLabel(value: string | null | undefined, maxLength: number) {
  const clean = value?.trim().toLowerCase().replace(/\s+/g, " ").slice(0, maxLength) ?? "";
  return clean && /^[a-z0-9][a-z0-9._~+\-/ ]*$/.test(clean) ? clean : null;
}

function compactLocale(value: string | null | undefined) {
  const clean = value?.trim().toLowerCase() ?? "";
  return /^[a-z]{2}(?:-[a-z]{2})?$/.test(clean) ? clean : null;
}

function compactHostname(value: string | null | undefined) {
  const clean = value?.trim().toLowerCase().replace(/^www\./, "").slice(0, 120) ?? "";
  return clean && /^[a-z0-9.-]+$/.test(clean) ? clean : null;
}

function eventKey(parts: Array<string | null | undefined>) {
  const material = parts.filter(Boolean).join("\u0000");
  return `growth:${createHash("sha256").update(material).digest("hex")}`;
}

export function isGrowthMigrationMissing(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown };
  const code = String(candidate.code ?? "");
  const message = String(candidate.message ?? "").toLowerCase();
  return migrationErrorCodes.has(code) ||
    message.includes("growth_attribution_sessions") ||
    message.includes("growth_journey_events") ||
    message.includes("growth_customer_preferences") ||
    message.includes("record_growth_attribution_touch");
}

function visitorHash(visitorId: string | null | undefined) {
  if (!visitorId || !isGrowthVisitorId(visitorId)) return null;
  const secret = growthSecret();
  if (secret.length < 16) return null;
  return hashGrowthVisitorId(visitorId, secret);
}

export async function recordGrowthAttributionTouchServer(input: {
  visitorId: string;
  userId?: string | null;
  touch: GrowthAttributionTouch;
  countryCode?: string | null;
  consentVersion?: string;
}) {
  const hash = visitorHash(input.visitorId);
  const landingPath = normalizeGrowthPath(input.touch.landingPath);
  const source = compactLabel(input.touch.source, 120);
  const medium = compactLabel(input.touch.medium, 48);
  if (!hash || !landingPath || !source || !medium) {
    return { ok: false as const, unavailable: false, reason: "invalid_attribution" };
  }

  const result = await getSupabaseAdmin().rpc("record_growth_attribution_touch", {
    p_visitor_hash: hash,
    p_user_id: input.userId ?? null,
    p_landing_path: landingPath,
    p_source: source,
    p_medium: medium,
    p_campaign: compactLabel(input.touch.campaign, 80),
    p_term: compactLabel(input.touch.term, 80),
    p_referrer_host: compactHostname(input.touch.referrerHost),
    p_country_code: normalizeGrowthCountry(input.countryCode),
    p_locale: compactLocale(input.touch.locale),
    p_consent_version: input.consentVersion || growthConsentVersion,
  });

  if (result.error) {
    return {
      ok: false as const,
      unavailable: isGrowthMigrationMissing(result.error),
      reason: "attribution_unavailable",
    };
  }
  return { ok: true as const, unavailable: false, id: String(result.data) };
}

async function linkGrowthVisitor(userId: string, rawVisitorId: string | null | undefined) {
  const hash = visitorHash(rawVisitorId);
  if (!hash) return;
  await getSupabaseAdmin()
    .from("growth_attribution_sessions")
    .update({ user_id: userId, identified_at: new Date().toISOString() })
    .eq("visitor_hash", hash)
    .is("user_id", null);
}

export async function recordGrowthJourneyEvent(input: {
  eventType: "account_created" | "request_started" | "request_created";
  userId: string;
  visitorId?: string | null;
  attemptId?: string | null;
  orderId?: string | null;
  channel?: "web" | "desktop" | "admin";
}) {
  const hash = visitorHash(input.visitorId);
  const key = eventKey([
    input.eventType,
    input.userId,
    input.orderId,
    input.attemptId,
  ]);
  const safeMetadata = input.attemptId ? { attempt_id: input.attemptId } : {};

  try {
    if (hash) await linkGrowthVisitor(input.userId, input.visitorId);
    const admin = getSupabaseAdmin();
    const result = await admin.from("growth_journey_events").upsert({
      event_type: input.eventType,
      event_key: key,
      visitor_hash: hash,
      user_id: input.userId,
      order_id: input.orderId ?? null,
      channel: input.channel ?? "web",
      safe_metadata: safeMetadata,
    }, { onConflict: "event_key", ignoreDuplicates: true }).select("id").maybeSingle();

    if (result.error) {
      return { ok: false as const, unavailable: isGrowthMigrationMissing(result.error) };
    }
    if (result.data?.id) {
      return { ok: true as const, unavailable: false, id: result.data.id };
    }

    // ignoreDuplicates intentionally returns no row on a replay. Resolve the
    // existing own-user event so every browser receives the same opaque seed.
    const existing = await admin
      .from("growth_journey_events")
      .select("id")
      .eq("event_key", key)
      .eq("user_id", input.userId)
      .eq("event_type", input.eventType)
      .maybeSingle();
    if (existing.error) {
      return {
        ok: false as const,
        unavailable: isGrowthMigrationMissing(existing.error),
      };
    }
    return { ok: true as const, unavailable: false, id: existing.data?.id ?? null };
  } catch (error) {
    return { ok: false as const, unavailable: isGrowthMigrationMissing(error) };
  }
}

export async function updateGrowthCustomerPreference(input: {
  userId: string;
  enabled: boolean;
  consentVersion: string;
}) {
  const now = new Date().toISOString();
  const result = await getSupabaseAdmin().from("growth_customer_preferences").upsert({
    user_id: input.userId,
    abandoned_request_reminders: input.enabled,
    consent_version: input.consentVersion,
    consented_at: input.enabled ? now : null,
    revoked_at: input.enabled ? null : now,
  }, { onConflict: "user_id" });

  if (result.error) {
    return { ok: false as const, unavailable: isGrowthMigrationMissing(result.error) };
  }
  return { ok: true as const, unavailable: false };
}

export async function recordGrowthReminderJourneyOutcome(input: {
  sourceEventId: string;
  userId: string;
  sent: boolean;
  reason: string | null;
}) {
  const result = await getSupabaseAdmin().from("growth_journey_events").upsert({
    event_type: input.sent ? "abandoned_reminder_sent" : "abandoned_reminder_skipped",
    event_key: eventKey(["reminder", input.sourceEventId, input.sent ? "sent" : "skipped"]),
    user_id: input.userId,
    channel: "admin",
    safe_metadata: input.reason ? { reason: input.reason.slice(0, 120) } : {},
  }, { onConflict: "event_key", ignoreDuplicates: true });
  return { ok: !result.error };
}
