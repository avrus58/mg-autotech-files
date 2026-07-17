import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";
import {
  buildLegacySessionCookieWrites,
  getSupabaseAuthStorageKey,
} from "../src/lib/authSessionMigration";
import {
  classifyDashboardSyncFailure,
  dashboardSyncRetryLimit,
  getDashboardSyncRetryDelay,
} from "../src/lib/dashboardSync";

function readProjectFile(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

const testSupabaseUrl = "https://stagingref.supabase.co";
const legacySession = JSON.stringify({
  access_token: "test-access-token",
  refresh_token: "test-refresh-token",
  expires_at: 4_102_444_800,
  user: { id: "00000000-0000-4000-8000-000000000001" },
});

test("legacy local-storage sessions are encoded into SSR cookie chunks without changing token content", () => {
  const storageKey = getSupabaseAuthStorageKey(testSupabaseUrl);
  const writes = buildLegacySessionCookieWrites({
    supabaseUrl: testSupabaseUrl,
    legacySession,
    existingCookieNames: [],
  });

  assert.equal(storageKey, "sb-stagingref-auth-token");
  assert.ok(writes.length > 0);
  assert.ok(writes.every(({ name, value }) => name.startsWith(storageKey!) && value.length <= 3180));

  const encoded = writes.map(({ value }) => value).join("");
  assert.match(encoded, /^base64-/);
  const decoded = Buffer.from(encoded.slice("base64-".length), "base64url").toString("utf8");
  assert.deepEqual(JSON.parse(decoded), JSON.parse(legacySession));
});

test("legacy session migration is skipped for invalid payloads or an existing cookie session", () => {
  assert.deepEqual(
    buildLegacySessionCookieWrites({
      supabaseUrl: testSupabaseUrl,
      legacySession: "not-json",
      existingCookieNames: [],
    }),
    []
  );
  assert.deepEqual(
    buildLegacySessionCookieWrites({
      supabaseUrl: testSupabaseUrl,
      legacySession,
      existingCookieNames: ["sb-stagingref-auth-token.0"],
    }),
    []
  );
});

test("dashboard retry policy is bounded exponential backoff with deterministic jitter bounds", () => {
  assert.equal(dashboardSyncRetryLimit, 4);
  assert.equal(getDashboardSyncRetryDelay(0, () => 0), 800);
  assert.equal(getDashboardSyncRetryDelay(0, () => 0.5), 1000);
  assert.equal(getDashboardSyncRetryDelay(1, () => 0.5), 2000);
  assert.equal(getDashboardSyncRetryDelay(2, () => 1), 4800);
  assert.equal(getDashboardSyncRetryDelay(99, () => 1), 9600);
});

test("dashboard sync failures preserve auth, authorization, rate, server, network and abort semantics", () => {
  assert.equal(classifyDashboardSyncFailure({ status: 401 }), "authentication");
  assert.equal(classifyDashboardSyncFailure({ code: "PGRST301" }), "authentication");
  assert.equal(classifyDashboardSyncFailure({ status: 403 }), "authorization");
  assert.equal(classifyDashboardSyncFailure({ code: "42501" }), "authorization");
  assert.equal(classifyDashboardSyncFailure({ status: 429 }), "rate_limit");
  assert.equal(classifyDashboardSyncFailure({ status: 503 }), "server");
  assert.equal(classifyDashboardSyncFailure(new TypeError("offline")), "network");
  assert.equal(classifyDashboardSyncFailure({ name: "AbortError" }), "aborted");
});

test("Supabase browser, server and proxy clients share one cookie session model", () => {
  const browserClient = readProjectFile("src", "lib", "supabaseClient.ts");
  const serverClient = readProjectFile("src", "lib", "supabaseServer.ts");
  const proxy = readProjectFile("src", "proxy.ts");

  assert.match(browserClient, /createBrowserClient/);
  assert.doesNotMatch(browserClient, /createClient\s*\(/);
  assert.match(browserClient, /migrateLegacyBrowserSessionToCookies/);
  assert.match(browserClient, /__mgAutotechSupabaseMode/);
  assert.match(browserClient, /navigatorLock/);
  assert.match(serverClient, /createServerClient/);
  assert.match(serverClient, /getAll\(\)/);
  assert.match(serverClient, /setAll\(cookiesToSet\)/);

  assert.match(proxy, /createServerClient/);
  assert.match(proxy, /await supabase\.auth\.getClaims\(\)/);
  assert.match(proxy, /request\.cookies\.set\(name, value\)/);
  assert.match(proxy, /response\.cookies\.set\(name, value, options\)/);
  assert.match(proxy, /Object\.entries\(responseHeaders\)/);
  assert.doesNotMatch(proxy, /signOut|NextResponse\.redirect/);
});

test("auth listeners do not start nested refreshes and stale sessions cannot mask a real sign-out", () => {
  const authGuards = readProjectFile("src", "lib", "authGuards.ts");
  const boundary = readProjectFile("src", "components", "auth", "BrowserAuthBoundary.tsx");
  const dashboard = readProjectFile("src", "components", "dashboard", "DashboardClient.tsx");

  assert.match(authGuards, /event === "SIGNED_OUT"[\s\S]*setCachedSession\(null\)/);
  assert.doesNotMatch(authGuards, /auth\.refreshSession/);
  assert.match(authGuards, /auth\.getUser\(\)/);

  const boundaryListener = boundary.match(/onAuthStateChange[\s\S]*?\n    \}\);/)?.[0] ?? "";
  assert.match(boundaryListener, /event === "SIGNED_OUT"[\s\S]*resolveAuthState\("unauthenticated"\)/);
  assert.doesNotMatch(boundaryListener, /getStableSession|refreshSession/);

  const dashboardListener = dashboard.match(/onAuthStateChange[\s\S]*?\n    \}\);/)?.[0] ?? "";
  assert.match(dashboardListener, /event === "SIGNED_OUT"[\s\S]*router\.replace\("\/login"\)/);
  assert.doesNotMatch(dashboardListener, /getStableSession|refreshSession/);
});

test("dashboard sync retries are serialized, bounded and cancelled without signing out", () => {
  const dashboard = readProjectFile("src", "components", "dashboard", "DashboardClient.tsx");
  const loadEffect = dashboard.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[router, dashboardRefreshKey\]\);/)?.[0] ?? "";

  assert.match(loadEffect, /let loadInFlight: Promise<void> \| null = null/);
  assert.match(loadEffect, /retryAttempt >= dashboardSyncRetryLimit/);
  assert.match(loadEffect, /getDashboardSyncRetryDelay\(retryAttempt\)/);
  assert.match(loadEffect, /if \(loadInFlight\) return loadInFlight/);
  assert.match(loadEffect, /clearScheduledRetry\(\)/);
  assert.match(loadEffect, /setDashboardLoadError/);
  assert.doesNotMatch(loadEffect, /signOutStable\(\)|supabase\.auth\.signOut\(\)/);
});
