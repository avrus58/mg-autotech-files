import { createHash } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export function hashRequestIp(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || headers.get("x-real-ip") || "unknown";
  const salt = process.env.WIDGET_IP_HASH_SALT || process.env.WIDGET_SESSION_SECRET || "mg-widget";
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
  if (error) return true;
  return Boolean(data);
}

