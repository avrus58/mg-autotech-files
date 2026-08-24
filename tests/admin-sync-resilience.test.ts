import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  ADMIN_SYNC_RETRY_DELAYS_MS,
  buildAdminSyncIncidentCode,
  getAdminSyncPresentation,
  getAdminSyncRetryDelay,
  isRetryableAdminSyncFailure,
  readAdminSyncIncidentCode,
} from "../src/lib/adminSyncResilience";
import {
  ADMIN_DASHBOARD_ALERT_COOLDOWN_MS,
  ADMIN_DASHBOARD_FAILURE_THRESHOLD,
  ADMIN_DASHBOARD_FAILURE_WINDOW_MS,
  buildAdminDashboardSyncAlertEmail,
  recordAdminDashboardSyncFailure,
} from "../src/lib/adminDashboardSyncAlerts";

function source(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

function rateResult(allowed: boolean) {
  return {
    allowed,
    remaining: allowed ? 1 : 0,
    retryAfterSeconds: 60,
    resetAt: Date.now() + 60_000,
    source: "memory" as const,
  };
}

test("admin sync retry plan is exactly 2s, 5s and 10s with no fourth retry", () => {
  assert.deepEqual([...ADMIN_SYNC_RETRY_DELAYS_MS], [2_000, 5_000, 10_000]);
  assert.equal(getAdminSyncRetryDelay(0), null);
  assert.equal(getAdminSyncRetryDelay(1), 2_000);
  assert.equal(getAdminSyncRetryDelay(2), 5_000);
  assert.equal(getAdminSyncRetryDelay(3), 10_000);
  assert.equal(getAdminSyncRetryDelay(4), null);
  assert.equal(getAdminSyncRetryDelay(5), null);
});

test("admin sync retry excludes confirmed sign-out, access denial and offline waiting", () => {
  for (const kind of ["network", "session_recovery", "rate_limited", "server", "invalid_response"] as const) {
    assert.equal(isRetryableAdminSyncFailure(kind), true, kind);
  }
  for (const kind of ["offline", "session_required", "access_denied"] as const) {
    assert.equal(isRetryableAdminSyncFailure(kind), false, kind);
  }
});

test("admin sync states never claim live before a verified snapshot", () => {
  assert.equal(getAdminSyncPresentation({ state: "connecting" }).label, "Connecting…");
  assert.equal(getAdminSyncPresentation({ state: "session_recovering" }).label, "Refreshing secure session…");
  assert.equal(getAdminSyncPresentation({ state: "reconnecting", retryDelayMs: 5_000 }).label, "Reconnecting · 5s");
  assert.equal(getAdminSyncPresentation({ state: "offline", lastSyncLabel: "15:42" }).label, "Offline");
  assert.equal(getAdminSyncPresentation({ state: "unavailable" }).label, "Connection unavailable");
  assert.equal(getAdminSyncPresentation({ state: "session_required" }).label, "Session ended");
  assert.equal(getAdminSyncPresentation({ state: "live", lastSyncLabel: "15:42" }).label, "Live · 15:42");
});

test("admin sync incident references are opaque, bounded and strictly validated", () => {
  const code = buildAdminSyncIncidentCode("550e8400-e29b-41d4-a716-446655440000");
  assert.equal(code, "ADM-550E8400E29B");
  assert.equal(readAdminSyncIncidentCode(code.toLowerCase()), code);
  assert.equal(readAdminSyncIncidentCode("ADM-short"), null);
  assert.equal(readAdminSyncIncidentCode("customer@example.com"), null);
});

test("admin dashboard alert e-mail is deterministic and contains no customer or request data", () => {
  const environment = {
    ADMIN_NOTIFICATION_EMAIL: "ops@example.com",
    EMAIL_FROM: "MG AutoTech <noreply@example.com>",
    NEXT_PUBLIC_SITE_URL: "https://file.mgautotech.de",
  };
  const now = new Date("2026-08-24T12:00:00.000Z");
  const first = buildAdminDashboardSyncAlertEmail(environment, now);
  const second = buildAdminDashboardSyncAlertEmail(environment, new Date("2026-08-24T23:59:59.000Z"));

  assert.equal(first.idempotencyKey, "mg_admin_dashboard_sync_v1_2026-08-24");
  assert.deepEqual(first, second);
  assert.equal(first.to, "ops@example.com");
  assert.match(first.text, /repeated server-side synchronization errors within five minutes/i);
  assert.match(first.text, /No customer, order, file, IP address or session data is included/i);
  assert.doesNotMatch(JSON.stringify(first), /customer_id|order_id|access_token|storage_path|stack|incident_id/i);
});

test("admin dashboard server alert fires only after threshold and respects cooldown", async () => {
  assert.equal(ADMIN_DASHBOARD_FAILURE_THRESHOLD, 3);
  assert.equal(ADMIN_DASHBOARD_FAILURE_WINDOW_MS, 5 * 60_000);
  assert.equal(ADMIN_DASHBOARD_ALERT_COOLDOWN_MS, 24 * 60 * 60_000);

  const request = new Request("http://localhost/api/admin/dashboard");
  const sent: Array<{ to: string; idempotencyKey: string }> = [];
  const baseDependencies = {
    environment: {
      EMAIL_DRY_RUN: "false",
      NODE_ENV: "production",
      RESEND_API_KEY: "test-only-not-sent",
      ADMIN_NOTIFICATION_EMAIL: "ops@example.com",
    },
    now: new Date("2026-08-24T12:00:00.000Z"),
    send: async (payload: { to: string }, options: { idempotencyKey: string }) => {
      sent.push({ to: payload.to, idempotencyKey: options.idempotencyKey });
      return { data: { id: "provider-test" }, error: null };
    },
  };

  const belowThreshold = await recordAdminDashboardSyncFailure(request, {
    ...baseDependencies,
    checkLimit: async () => rateResult(true),
  });
  assert.equal(belowThreshold.status, "below_threshold");
  assert.equal(sent.length, 0);

  const scopes: Array<{ scope: string; suffix: string }> = [];
  const sentAlert = await recordAdminDashboardSyncFailure(request, {
    ...baseDependencies,
    checkLimit: async (input) => {
      scopes.push({ scope: input.scope, suffix: input.suffix ?? "" });
      return rateResult(input.scope === "admin-dashboard-sync-alert");
    },
  });
  assert.equal(sentAlert.status, "sent");
  assert.deepEqual(scopes, [
    { scope: "admin-dashboard-sync-failure", suffix: "server-5xx" },
    { scope: "admin-dashboard-sync-alert", suffix: "global" },
  ]);
  assert.deepEqual(sent, [{
    to: "ops@example.com",
    idempotencyKey: "mg_admin_dashboard_sync_v1_2026-08-24",
  }]);

  const cooldown = await recordAdminDashboardSyncFailure(request, {
    ...baseDependencies,
    checkLimit: async () => rateResult(false),
  });
  assert.equal(cooldown.status, "cooldown");
  assert.equal(sent.length, 1);
});

test("admin dashboard 5xx diagnostics are correlated and privacy bounded", () => {
  const route = source("src", "app", "api", "admin", "dashboard", "route.ts");
  const alerts = source("src", "lib", "adminDashboardSyncAlerts.ts");
  const page = source("src", "app", "admin", "page.tsx");

  assert.match(route, /incidentCode = buildAdminSyncIncidentCode\(randomUUID\(\)\)/);
  assert.match(route, /\{ error: input\.error, incidentCode \}/);
  assert.match(route, /\[ADMIN_SYNC_INCIDENT_HEADER\]: incidentCode/);
  assert.match(route, /after\(async \(\) => \{\s*await recordAdminDashboardSyncFailure\(input\.request\)/);
  assert.match(route, /if \(auth\.status >= 500\)/);
  assert.match(route, /kind: "orders_query"/);
  assert.match(route, /kind: "customers_query"/);
  assert.match(alerts, /includeClientIp: false/);
  assert.match(alerts, /emitSignals: false/);
  assert.match(alerts, /scope: "admin-dashboard-sync-alert",\s*suffix: "global",/);
  assert.doesNotMatch(alerts, /request\.headers|getClientIp|customer_id|order_id|access_token|storage_path/);
  assert.match(page, /response\.headers\.get\(ADMIN_SYNC_INCIDENT_HEADER\)/);
  assert.match(page, /!recoveryEvent && adminRetryTimerRef\.current !== null/);
  assert.match(page, /if \(hasLoadedAdminDataRef\.current\) refreshAdminData\(\)/);
  assert.doesNotMatch(page, /createClientAdminSyncIncidentCode/);
  assert.match(page, /Support reference/);
});
