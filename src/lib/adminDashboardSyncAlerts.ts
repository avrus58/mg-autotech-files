import { Resend } from "resend";
import {
  checkAdaptiveRateLimit,
  type AdaptiveRateLimitResult,
} from "@/lib/abuseProtection";

export const ADMIN_DASHBOARD_FAILURE_THRESHOLD = 3;
export const ADMIN_DASHBOARD_FAILURE_WINDOW_MS = 5 * 60_000;
export const ADMIN_DASHBOARD_ALERT_COOLDOWN_MS = 24 * 60 * 60_000;

export type AdminDashboardSyncFailureKind =
  | "authorization_profile"
  | "orders_query"
  | "customers_query"
  | "unexpected";

type AlertEnvironment = Readonly<Record<string, string | undefined>>;
type AlertRateLimit = (input: Parameters<typeof checkAdaptiveRateLimit>[0]) => Promise<AdaptiveRateLimitResult>;
type AlertProviderSend = (
  payload: { from: string; to: string; subject: string; html: string; text: string },
  options: { idempotencyKey: string }
) => Promise<{ data?: { id?: string | null } | null; error?: unknown }>;

type AlertDependencies = {
  checkLimit?: AlertRateLimit;
  environment?: AlertEnvironment;
  now?: Date;
  send?: AlertProviderSend;
};

function isEmailAddress(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 250;
}
function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeAdminUrl(environment: AlertEnvironment) {
  const candidate = environment.NEXT_PUBLIC_SITE_URL || "https://file.mgautotech.de";
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Unsupported protocol");
    url.pathname = "/admin";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "https://file.mgautotech.de/admin";
  }
}

export function getAdminDashboardAlertDayBucket(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function buildAdminDashboardSyncAlertEmail(
  environment: AlertEnvironment = process.env,
  now = new Date()
) {
  const dayBucket = getAdminDashboardAlertDayBucket(now);
  const to = (environment.ADMIN_NOTIFICATION_EMAIL || environment.EMAIL_TO || "info@mgautotech.de")
    .trim()
    .toLowerCase();
  const from = environment.EMAIL_FROM || "MG AutoTech <noreply@file.mgautotech.de>";
  const adminUrl = safeAdminUrl(environment);
  const escapedAdminUrl = escapeHtml(adminUrl);
  const subject = "MG AutoTech admin dashboard connection alert";
  const text = [
    "MG AutoTech Admin Operations",
    "",
    "The admin dashboard returned repeated server-side synchronization errors within five minutes.",
    "No customer, order, file, IP address or session data is included in this alert.",
    "",
    `Review admin: ${adminUrl}`,
  ].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;background:#050505;color:#fff;padding:30px"><div style="max-width:650px;margin:auto;background:#111;border:1px solid #333;border-radius:18px;padding:26px"><p style="color:#ff4b5c;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase">MG AutoTech Admin Operations</p><h1 style="margin:12px 0">Dashboard connection alert</h1><p style="color:#d4d4d8;line-height:1.6">The admin dashboard returned repeated server-side synchronization errors within five minutes.</p><p style="color:#a1a1aa;line-height:1.6">No customer, order, file, IP address or session data is included in this alert.</p><a href="${escapedAdminUrl}" style="display:inline-block;margin-top:16px;background:#b1121b;color:white;text-decoration:none;padding:14px 20px;border-radius:12px;font-weight:bold">Review admin dashboard</a></div></div>`;

  return {
    to,
    from,
    subject,
    text,
    html,
    idempotencyKey: `mg_admin_dashboard_sync_v1_${dayBucket}`,
  };
}

export function logAdminDashboardSyncFailure(input: {
  kind: AdminDashboardSyncFailureKind;
  incidentCode: string;
  occurredAt?: Date;
}) {
  console.error("[admin-dashboard-sync]", JSON.stringify({
    kind: input.kind,
    route: "/api/admin/dashboard",
    incident_id: input.incidentCode,
    occurred_at: (input.occurredAt ?? new Date()).toISOString(),
  }));
}

async function sendAdminDashboardSyncAlert(dependencies: AlertDependencies) {
  const environment = dependencies.environment ?? process.env;
  if (environment.EMAIL_DRY_RUN !== "false" || environment.NODE_ENV === "test") {
    return { status: "skipped" as const, reason: "dry_run" };
  }

  const apiKey = environment.RESEND_API_KEY;
  const email = buildAdminDashboardSyncAlertEmail(environment, dependencies.now);
  if (!apiKey || !isEmailAddress(email.to)) {
    return { status: "skipped" as const, reason: "not_configured" };
  }

  const send = dependencies.send ?? (async (payload, options) => {
    const result = await new Resend(apiKey).emails.send(payload, options);
    return { data: result.data, error: result.error };
  });

  try {
    const result = await send(
      {
        from: email.from,
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
      },
      { idempotencyKey: email.idempotencyKey }
    );
    if (result.error) throw new Error("Operational alert provider rejected the request.");
    return { status: "sent" as const };
  } catch {
    console.warn("[admin-dashboard-sync-alert]", JSON.stringify({
      kind: "delivery_failed",
      route: "/api/admin/dashboard",
      occurred_at: (dependencies.now ?? new Date()).toISOString(),
    }));
    return { status: "failed" as const, reason: "provider_error" };
  }
}

export async function recordAdminDashboardSyncFailure(
  request: Request,
  dependencies: AlertDependencies = {}
) {
  try {
    const checkLimit = dependencies.checkLimit ?? checkAdaptiveRateLimit;
    const threshold = await checkLimit({
      request,
      scope: "admin-dashboard-sync-failure",
      suffix: "server-5xx",
      limit: ADMIN_DASHBOARD_FAILURE_THRESHOLD - 1,
      windowMs: ADMIN_DASHBOARD_FAILURE_WINDOW_MS,
      includeClientIp: false,
      emitSignals: false,
    });
    if (threshold.allowed) return { status: "below_threshold" as const };

    const cooldown = await checkLimit({
      request,
      scope: "admin-dashboard-sync-alert",
      suffix: "global",
      limit: 1,
      windowMs: ADMIN_DASHBOARD_ALERT_COOLDOWN_MS,
      includeClientIp: false,
      emitSignals: false,
    });
    if (!cooldown.allowed) return { status: "cooldown" as const };

    return await sendAdminDashboardSyncAlert(dependencies);
  } catch {
    console.warn("[admin-dashboard-sync-alert]", JSON.stringify({
      kind: "alert_pipeline_failed",
      route: "/api/admin/dashboard",
      occurred_at: (dependencies.now ?? new Date()).toISOString(),
    }));
    return { status: "failed" as const, reason: "alert_pipeline_error" };
  }
}
