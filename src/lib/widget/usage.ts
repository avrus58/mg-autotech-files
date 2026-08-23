import { createHash } from "node:crypto";
import { checkAdaptiveRateLimit } from "@/lib/abuseProtection";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getWidgetIpHashSalt, widgetAbuseSubject } from "@/lib/widget/security";
import {
  getTrustedClientIp,
  type RequestNetworkEnvironment,
} from "@/lib/requestNetwork";

function distributedWidgetLimitRequired() {
  return process.env.NODE_ENV === "production" ||
    process.env.SECURITY_DISTRIBUTED_RATE_LIMIT_REQUIRED === "true";
}

function usableWidgetLimit(result: { allowed: boolean; source: string }) {
  return result.allowed &&
    (!distributedWidgetLimitRequired() || result.source === "distributed");
}

export function hashRequestIp(
  headers: Headers,
  environment: RequestNetworkEnvironment = process.env
) {
  const ip = getTrustedClientIp({ headers }, environment);
  const salt = getWidgetIpHashSalt();
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

export async function getMonthlyWidgetUsage(clientId: string) {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const admin = getSupabaseAdmin();
  const { count, error } = await admin
    .from("widget_access_logs")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("status", "allowed")
    .in("path", ["/api/widget/config", "/embed/vehicle-selector"])
    .gte("created_at", start.toISOString());
  if (error) throw error;
  return count ?? 0;
}

export async function consumeWidgetRateLimit(clientId: string, limit = 120) {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc("widget_consume_rate_limit", {
    p_client_id: clientId,
    p_limit: limit,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function consumeWidgetFrontDoorAbuseLimit(headers: Headers) {
  const result = await checkAdaptiveRateLimit({
    request: { headers } as Request,
    scope: "widget-public-edge",
    limit: 90,
    windowMs: 60 * 1000,
  });
  return usableWidgetLimit(result);
}

export async function consumeWidgetLayeredAbuseLimit(input: {
  headers: Headers;
  clientId: string;
  sessionToken?: string | null;
  bootstrap: boolean;
}) {
  const request = { headers: input.headers } as Request;
  const clientIpLimit = await checkAdaptiveRateLimit({
    request,
    scope: input.bootstrap ? "widget-public-bootstrap" : "widget-public-client-ip",
    limit: input.bootstrap ? 12 : 40,
    windowMs: input.bootstrap ? 5 * 60 * 1000 : 60 * 1000,
    suffix: widgetAbuseSubject(input.clientId),
  });
  if (!usableWidgetLimit(clientIpLimit)) {
    return { allowed: false as const, reason: "ip_rate_limit_exceeded" };
  }

  if (!input.bootstrap) {
    if (!input.sessionToken) {
      return { allowed: false as const, reason: "session_required" };
    }
    const sessionLimit = await checkAdaptiveRateLimit({
      request,
      scope: "widget-public-session",
      limit: 30,
      windowMs: 60 * 1000,
      suffix: widgetAbuseSubject(input.clientId, input.sessionToken),
      includeClientIp: false,
    });
    if (!usableWidgetLimit(sessionLimit)) {
      return { allowed: false as const, reason: "session_rate_limit_exceeded" };
    }
  }

  return { allowed: true as const, reason: null };
}
