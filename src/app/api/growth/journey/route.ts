import { NextResponse } from "next/server";
import { z } from "zod";
import { checkAdaptiveRateLimit, rateLimitResponseHeaders } from "@/lib/abuseProtection";
import { requireApiUser } from "@/lib/apiAuth";
import {
  recordGrowthAttributionTouchServer,
  recordGrowthJourneyEvent,
  updateGrowthCustomerPreference,
} from "@/lib/growth/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTrustedCountryCode } from "@/lib/requestNetwork";

const noStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  Vary: "Authorization",
};

const visitorId = z.string().uuid().nullable().optional();
const attributionSchema = z.object({
  action: z.literal("attribution_touch"),
  visitorId: z.string().uuid(),
  consent: z.literal("granted"),
  consentVersion: z.literal("analytics-v1"),
  landingPath: z.string().min(1).max(180),
  source: z.string().trim().min(1).max(120),
  medium: z.string().trim().min(1).max(48),
  campaign: z.string().trim().max(80).nullable(),
  term: z.string().trim().max(80).nullable(),
  referrerHost: z.string().trim().max(120).nullable(),
  locale: z.string().trim().max(12).nullable(),
}).strict();
const accountCreatedSchema = z.object({ action: z.literal("account_created"), visitorId }).strict();
const requestStartedSchema = z.object({
  action: z.literal("request_started"),
  attemptId: z.string().uuid(),
  visitorId,
}).strict();
const requestCreatedSchema = z.object({
  action: z.literal("request_created"),
  orderId: z.string().uuid(),
  attemptId: z.string().uuid(),
  visitorId,
}).strict();
const preferenceSchema = z.object({
  action: z.literal("reminder_preference"),
  enabled: z.boolean(),
  consentVersion: z.literal("abandoned-request-v1"),
}).strict();
const bodySchema = z.discriminatedUnion("action", [
  attributionSchema,
  accountCreatedSchema,
  requestStartedSchema,
  requestCreatedSchema,
  preferenceSchema,
]);

function response(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { ...noStoreHeaders, ...extraHeaders } });
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 8_192) return response({ error: "Payload is too large." }, 413);

  let raw: unknown;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 8_192) {
      return response({ error: "Payload is too large." }, 413);
    }
    raw = JSON.parse(rawBody);
  } catch {
    return response({ error: "Invalid JSON payload." }, 400);
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return response({ error: "Invalid growth event." }, 400);

  const isPublicTouch = parsed.data.action === "attribution_touch";
  const limit = isPublicTouch ? 60 : 120;
  const windowMs = 60 * 60_000;
  const rateLimit = await checkAdaptiveRateLimit({
    request,
    scope: isPublicTouch ? "growth-attribution" : "growth-journey",
    limit,
    windowMs,
    emitSignals: true,
  });
  const limitHeaders = rateLimitResponseHeaders({
    result: rateLimit,
    limit,
    windowMs,
    blocked: !rateLimit.allowed,
  });
  if (!rateLimit.allowed) return response({ error: "Too many requests." }, 429, limitHeaders);

  if (parsed.data.action === "attribution_touch") {
    try {
      await recordGrowthAttributionTouchServer({
        visitorId: parsed.data.visitorId,
        touch: parsed.data,
        countryCode: getTrustedCountryCode(request),
        consentVersion: parsed.data.consentVersion,
      });
      return response({ accepted: true }, 202, limitHeaders);
    } catch {
      // Analytics dependencies must never interrupt the public website.
      return response({ accepted: true }, 202, limitHeaders);
    }
  }

  const auth = await requireApiUser(request);
  if (!auth.ok) return response({ error: auth.error }, auth.status, limitHeaders);

  if (parsed.data.action === "reminder_preference") {
    const result = await updateGrowthCustomerPreference({
      userId: auth.user.id,
      enabled: parsed.data.enabled,
      consentVersion: parsed.data.consentVersion,
    });
    if (!result.ok) {
      return response({ error: "Reminder preference could not be saved." }, 503, limitHeaders);
    }
    return response({ ok: true, enabled: parsed.data.enabled }, 200, limitHeaders);
  }

  if (parsed.data.action === "request_created") {
    const ownedOrder = await getSupabaseAdmin()
      .from("orders")
      .select("id")
      .eq("id", parsed.data.orderId)
      .eq("customer_id", auth.user.id)
      .maybeSingle();
    if (ownedOrder.error || !ownedOrder.data) {
      return response({ error: "Request not found." }, 403, limitHeaders);
    }
  }

  const result = await recordGrowthJourneyEvent({
    eventType: parsed.data.action,
    userId: auth.user.id,
    visitorId: parsed.data.visitorId,
    attemptId: "attemptId" in parsed.data ? parsed.data.attemptId : null,
    orderId: "orderId" in parsed.data ? parsed.data.orderId : null,
  });
  if (
    parsed.data.action === "account_created" &&
    result.ok &&
    typeof result.id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result.id)
  ) {
    // This row UUID is an opaque event identifier scoped to the authenticated
    // caller. User IDs, e-mail addresses and event keys never leave the server.
    return response({ accepted: true, conversionSeed: result.id }, 202, limitHeaders);
  }
  return response({ accepted: true }, 202, limitHeaders);
}
