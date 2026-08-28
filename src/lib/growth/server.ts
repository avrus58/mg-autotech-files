import { createHash, createHmac } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  growthConsentVersion,
  isGrowthVisitorId,
  normalizeGrowthAttributionTouch,
  normalizeGrowthCountry,
} from "@/lib/growth/attribution";
import { hashGrowthVisitorId } from "@/lib/growth/attributionServer";
import type { GrowthAttributionTouch } from "@/lib/growth/types";
import { isPublicAnalyticsPath } from "@/lib/publicAnalytics";

const migrationErrorCodes = new Set(["42P01", "42703", "PGRST202", "PGRST204", "PGRST205"]);
const opaqueGrowthIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type GrowthAdminClient = ReturnType<typeof getSupabaseAdmin>;
type GrowthServerDependencies = {
  getAdmin?: () => GrowthAdminClient;
  now?: () => string;
};

function isOpaqueGrowthId(value: unknown): value is string {
  return typeof value === "string" && opaqueGrowthIdPattern.test(value);
}

function growthSecret() {
  const current = process.env.GROWTH_ATTRIBUTION_HMAC_SECRET?.trim() ?? "";
  const legacy = process.env.GROWTH_ATTRIBUTION_LEGACY_HMAC_SECRET?.trim() ?? "";
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (current.length < 32 || current.length > 512) return "";
  if ((legacy && current === legacy) || (serviceRole && current === serviceRole)) {
    return "";
  }
  return current;
}

const currentGrowthHashVersion = "dedicated-v2";
const legacyGrowthHashVersion = "legacy-service-role-v1";
const preCutoverGrowthHashVersion = "pre-v2-key-unknown";

type GrowthHashVersion =
  | typeof currentGrowthHashVersion
  | typeof legacyGrowthHashVersion
  | typeof preCutoverGrowthHashVersion;

type GrowthVisitorHashCandidate = {
  hash: string;
  version: GrowthHashVersion;
};

function legacyGrowthSecret() {
  // The service-role key was the historical HMAC fallback. It is used only to
  // find pre-cutover rows; every new visitor hash is written with the dedicated
  // secret. An explicit legacy value supports a later service-role rotation.
  return process.env.GROWTH_ATTRIBUTION_LEGACY_HMAC_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
}

function growthVisitorHashCandidates(
  visitorId: string | null | undefined
): GrowthVisitorHashCandidate[] {
  if (!visitorId || !isGrowthVisitorId(visitorId)) return [];
  const currentSecret = growthSecret();
  if (currentSecret.length < 32) return [];

  const current: GrowthVisitorHashCandidate = {
    hash: hashGrowthVisitorId(visitorId, currentSecret),
    version: currentGrowthHashVersion,
  };
  const legacySecret = legacyGrowthSecret();
  if (legacySecret.length < 16) return [current];
  const legacyHash = hashGrowthVisitorId(visitorId, legacySecret);
  if (legacyHash === current.hash) return [current];
  return [
    current,
    { hash: legacyHash, version: legacyGrowthHashVersion },
  ];
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
    message.includes("record_growth_attribution_touch") ||
    message.includes("link_growth_visitor_identity");
}

function growthAdmin(dependencies?: GrowthServerDependencies) {
  return dependencies?.getAdmin?.() ?? getSupabaseAdmin();
}

async function resolveGrowthVisitorUser(
  admin: GrowthAdminClient,
  hashCandidates: GrowthVisitorHashCandidate[],
  explicitUserId?: string | null
) {
  const hashes = hashCandidates.map((candidate) => candidate.hash);
  const journeyResult = await admin
    .from("growth_journey_events")
    .select("user_id,visitor_hash,visitor_hash_version")
    .in("visitor_hash", hashes)
    .in("event_type", [
      "account_created",
      "identity_linked",
      "request_started",
      "request_created",
    ]);
  const attributionResult = await admin
    .from("growth_attribution_sessions")
    .select("user_id,visitor_hash,visitor_hash_version")
    .in("visitor_hash", hashes);

  if (journeyResult.error || attributionResult.error) {
    const error = journeyResult.error ?? attributionResult.error;
    return {
      ok: false as const,
      unavailable: isGrowthMigrationMissing(error),
      conflict: false,
      userId: null,
      hashCandidate: null,
    };
  }

  const candidateByHash = new Map(
    hashCandidates.map((candidate) => [candidate.hash, candidate])
  );
  const journeyRows = Array.isArray(journeyResult.data) ? journeyResult.data : [];
  const attributionRows = Array.isArray(attributionResult.data)
    ? attributionResult.data
    : [];
  const attributionHashes = new Set<string>();
  for (const row of journeyRows) {
    const hash = String((row as { visitor_hash?: unknown }).visitor_hash ?? "");
    const version = String(
      (row as { visitor_hash_version?: unknown }).visitor_hash_version ?? ""
    );
    const expected = candidateByHash.get(hash);
    if (
      !expected ||
      (version !== preCutoverGrowthHashVersion && expected.version !== version)
    ) {
      return {
        ok: false as const,
        unavailable: false,
        conflict: true,
        userId: null,
        hashCandidate: null,
      };
    }
  }
  for (const row of attributionRows) {
    const hash = String((row as { visitor_hash?: unknown }).visitor_hash ?? "");
    const version = String(
      (row as { visitor_hash_version?: unknown }).visitor_hash_version ?? ""
    );
    const expected = candidateByHash.get(hash);
    if (
      !expected ||
      (version !== preCutoverGrowthHashVersion && expected.version !== version)
    ) {
      return {
        ok: false as const,
        unavailable: false,
        conflict: true,
        userId: null,
        hashCandidate: null,
      };
    }
    attributionHashes.add(hash);
  }
  if (attributionHashes.size > 1) {
    return {
      ok: false as const,
      unavailable: false,
      conflict: true,
      userId: null,
      hashCandidate: null,
    };
  }

  const candidateUserIds = new Set<string>();
  const candidates = [
    ...journeyRows,
    ...attributionRows,
    ...(explicitUserId ? [{ user_id: explicitUserId }] : []),
  ];
  for (const candidate of candidates) {
    const userId = (candidate as { user_id?: unknown }).user_id;
    if (userId == null) continue;
    if (!isOpaqueGrowthId(userId)) {
      return {
        ok: false as const,
        unavailable: false,
        conflict: true,
        userId: null,
        hashCandidate: null,
      };
    }
    candidateUserIds.add(userId);
  }
  const existingUserId = (attributionRows[0] as { user_id?: unknown } | undefined)
    ?.user_id;
  const candidateUserId = [...candidateUserIds][0] ?? null;
  if (
    candidateUserIds.size > 1 ||
    (existingUserId && candidateUserId && existingUserId !== candidateUserId)
  ) {
    return {
      ok: false as const,
      unavailable: false,
      conflict: true,
      userId: null,
      hashCandidate: null,
    };
  }
  const selectedHash = [...attributionHashes][0] ?? null;
  const selectedAttribution = attributionRows.find((row) =>
    String((row as { visitor_hash?: unknown }).visitor_hash ?? "") === selectedHash
  );
  const selectedVersion = String(
    (selectedAttribution as { visitor_hash_version?: unknown } | undefined)
      ?.visitor_hash_version ?? ""
  ) as GrowthHashVersion;
  return {
    ok: true as const,
    unavailable: false,
    conflict: false,
    userId: candidateUserId,
    // An existing attribution row keeps its historical hash so first/last
    // touch continuity is preserved. A journey-only legacy match contributes
    // only the bound user; the new attribution row must use the current key.
    hashCandidate: selectedHash
      ? { hash: selectedHash, version: selectedVersion }
      : hashCandidates[0],
  };
}

export async function recordGrowthAttributionTouchServer(input: {
  visitorId: string;
  deliveryId: string;
  userId?: string | null;
  touch: GrowthAttributionTouch;
  countryCode?: string | null;
  consentVersion?: string;
}, dependencies?: GrowthServerDependencies) {
  if (growthSecret().length < 32) {
    return {
      ok: false as const,
      unavailable: true,
      reason: "attribution_unavailable",
    };
  }
  const hashCandidates = growthVisitorHashCandidates(input.visitorId);
  const deliveryId = isGrowthVisitorId(input.deliveryId)
    ? input.deliveryId
    : null;
  const normalizedTouch = normalizeGrowthAttributionTouch(input.touch);
  const landingPath = normalizedTouch?.landingPath ?? null;
  const source = normalizedTouch?.source ?? null;
  const medium = normalizedTouch?.medium ?? null;
  if (
    hashCandidates.length === 0 ||
    !deliveryId ||
    !landingPath ||
    !isPublicAnalyticsPath(landingPath) ||
    !source ||
    !medium
  ) {
    return { ok: false as const, unavailable: false, reason: "invalid_attribution" };
  }

  try {
    const admin = growthAdmin(dependencies);
    // Any consented, identity-bound journey event and the public touch can arrive
    // in either order. If the journey event won the race, bind the later public
    // touch without exposing an account identifier to the browser.
    const visitorUser = await resolveGrowthVisitorUser(
      admin,
      hashCandidates,
      input.userId
    );
    if (!visitorUser.ok) {
      if (visitorUser.conflict) {
        return {
          ok: true as const,
          unavailable: false,
          ignored: true,
          id: null,
        };
      }
      return {
        ok: false as const,
        unavailable: visitorUser.unavailable,
        reason: "attribution_unavailable",
      };
    }
    const selectedHash = visitorUser.hashCandidate;
    if (!selectedHash) {
      return {
        ok: false as const,
        unavailable: false,
        reason: "invalid_attribution",
      };
    }
    const result = await admin.rpc("record_growth_attribution_touch", {
      p_visitor_hash: selectedHash.hash,
      p_visitor_hash_version: selectedHash.version,
      p_receipt_hash: createHmac("sha256", growthSecret())
        .update(`${selectedHash.version}\u0000${selectedHash.hash}\u0000${deliveryId}`)
        .digest("hex"),
      p_user_id: input.userId ?? visitorUser.userId,
      p_landing_path: landingPath,
      p_source: source,
      p_medium: medium,
      p_campaign: normalizedTouch?.campaign ?? null,
      p_term: null,
      p_referrer_host: compactHostname(normalizedTouch?.referrerHost),
      p_country_code: normalizeGrowthCountry(input.countryCode),
      p_locale: compactLocale(normalizedTouch?.locale),
      p_consent_version: input.consentVersion || growthConsentVersion,
    });

    if (
      result.error ||
      (result.data !== null && !isOpaqueGrowthId(result.data))
    ) {
      return {
        ok: false as const,
        unavailable: isGrowthMigrationMissing(result.error),
        reason: "attribution_unavailable",
      };
    }
    return {
      ok: true as const,
      unavailable: false,
      ignored: result.data === null,
      id: result.data,
    };
  } catch (error) {
    return {
      ok: false as const,
      unavailable: isGrowthMigrationMissing(error),
      reason: "attribution_unavailable",
    };
  }
}

async function linkGrowthVisitor(
  admin: GrowthAdminClient,
  userId: string,
  hashCandidate: GrowthVisitorHashCandidate,
  now: string
) {
  const result = await admin.rpc("link_growth_visitor_identity", {
    p_visitor_hash: hashCandidate.hash,
    p_visitor_hash_version: hashCandidate.version,
    p_user_id: userId,
    p_identified_at: now,
  });
  if (result.error) {
    return {
      ok: false as const,
      unavailable: isGrowthMigrationMissing(result.error),
    };
  }
  const allowedOutcomes = new Set([
    "linked",
    "already_linked",
    "pending_touch",
    "rejected_conflict",
  ]);
  if (typeof result.data !== "string" || !allowedOutcomes.has(result.data)) {
    return { ok: false as const, unavailable: true };
  }
  return {
    ok: true as const,
    unavailable: false,
    linked: result.data === "linked",
    conflict: result.data === "rejected_conflict",
  };
}

export async function recordGrowthJourneyEvent(input: {
  eventType:
    | "account_created"
    | "identity_linked"
    | "request_started"
    | "request_created";
  userId: string;
  visitorId?: string | null;
  attemptId?: string | null;
  orderId?: string | null;
  purpose?: "analytics" | "advertising" | "reminder" | null;
  consentVersion?: "consent-mode-v2" | "abandoned-request-v1" | null;
  channel?: "web" | "desktop" | "admin";
}, dependencies?: GrowthServerDependencies) {
  const consentPair = `${input.purpose ?? ""}:${input.consentVersion ?? ""}`;
  const consentPairAllowed = (
    (input.eventType === "account_created" &&
      ["analytics:consent-mode-v2", "advertising:consent-mode-v2"].includes(consentPair)) ||
    (input.eventType === "identity_linked" &&
      consentPair === "analytics:consent-mode-v2") ||
    (input.eventType === "request_started" &&
      ["analytics:consent-mode-v2", "reminder:abandoned-request-v1"].includes(consentPair)) ||
    (input.eventType === "request_created" && consentPair === "analytics:consent-mode-v2")
  );
  if ((input.purpose || input.consentVersion) && !consentPairAllowed) {
    return {
      ok: false as const,
      unavailable: false,
      reason: "invalid_journey_consent",
    };
  }
  const hashCandidates = growthVisitorHashCandidates(input.visitorId);
  const primaryHash = hashCandidates[0] ?? null;
  const hash = primaryHash?.hash ?? null;
  const key = eventKey([
    input.eventType,
    input.userId,
    input.orderId,
    input.attemptId,
    input.eventType === "identity_linked" ? hash : null,
    input.eventType === "request_started" ? input.purpose : null,
  ]);
  const safeMetadata: Record<string, string> = {};
  if (input.attemptId) safeMetadata.attempt_id = input.attemptId;
  if (consentPairAllowed && input.purpose && input.consentVersion) {
    safeMetadata.purpose = input.purpose;
    safeMetadata.consent_version = input.consentVersion;
  }

  try {
    const admin = growthAdmin(dependencies);
    const result = await admin.from("growth_journey_events").upsert({
      event_type: input.eventType,
      event_key: key,
      visitor_hash: hash,
      visitor_hash_version: primaryHash?.version ?? null,
      user_id: input.userId,
      order_id: input.orderId ?? null,
      channel: input.channel ?? "web",
      safe_metadata: safeMetadata,
    }, { onConflict: "event_key", ignoreDuplicates: true }).select("id").maybeSingle();

    if (result.error) {
      return {
        ok: false as const,
        unavailable: isGrowthMigrationMissing(result.error),
        reason: "journey_unavailable",
      };
    }
    let eventId = isOpaqueGrowthId(result.data?.id) ? result.data.id : null;
    let replayedExistingEvent = false;
    if (!eventId) {
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
          reason: "journey_unavailable",
        };
      }
      if (!isOpaqueGrowthId(existing.data?.id)) {
        return {
          ok: false as const,
          unavailable: false,
          reason: "journey_not_recorded",
        };
      }
      eventId = existing.data.id;
      replayedExistingEvent = true;
    }

    if (hash) {
      if (replayedExistingEvent) {
        // A consented replay can recover a same-purpose row that was accepted
        // while visitor persistence was unavailable. Enrich only that exact
        // same-user event while its visitor hash is still null; never overwrite
        // another attribution identity.
        const enriched = await admin
          .from("growth_journey_events")
          .update({
            visitor_hash: hash,
            visitor_hash_version: primaryHash?.version ?? null,
          })
          .eq("id", eventId)
          .eq("event_key", key)
          .eq("user_id", input.userId)
          .eq("event_type", input.eventType)
          .is("visitor_hash", null)
          .select("id")
          .maybeSingle();
        if (enriched.error) {
          return {
            ok: false as const,
            unavailable: isGrowthMigrationMissing(enriched.error),
            reason: "journey_unavailable",
          };
        }
      }
      const identifiedAt = dependencies?.now?.() ?? new Date().toISOString();
      for (const hashCandidate of hashCandidates) {
        const link = await linkGrowthVisitor(
          admin,
          input.userId,
          hashCandidate,
          identifiedAt
        );
        if (!link.ok) {
          return {
            ok: false as const,
            unavailable: link.unavailable,
            reason: "journey_unavailable",
          };
        }
      }
      // A zero-row update means the public touch has not arrived yet (or was
      // already linked). The durable identity-bound event above lets a later
      // touch deterministically recover the user binding in either ordering.
    }
    return { ok: true as const, unavailable: false, id: eventId };
  } catch (error) {
    return {
      ok: false as const,
      unavailable: isGrowthMigrationMissing(error),
      reason: "journey_unavailable",
    };
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
