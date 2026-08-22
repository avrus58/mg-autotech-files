import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function readProjectFile(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

const protectedClientFiles = [
  ["src", "app", "admin", "page.tsx"],
  ["src", "app", "admin", "commercial", "page.tsx"],
  ["src", "app", "admin", "email", "page.tsx"],
  ["src", "app", "admin", "payments", "page.tsx"],
  ["src", "app", "admin", "vehicles", "VehicleControlCenter.tsx"],
  ["src", "app", "admin", "vehicles", "[id]", "VehicleDetailClient.tsx"],
  ["src", "app", "admin", "widget-settings", "page.tsx"],
  ["src", "app", "admin", "widget-clients", "page.tsx"],
  ["src", "app", "admin", "widget-clients", "[id]", "page.tsx"],
  ["src", "app", "admin", "ai-training", "page.tsx"],
  ["src", "app", "admin", "ai-training", "[id]", "page.tsx"],
  ["src", "app", "admin", "ai-training", "clusters", "page.tsx"],
  ["src", "app", "admin", "ai-training", "clusters", "[id]", "page.tsx"],
  ["src", "app", "admin", "ai-training", "datasets", "page.tsx"],
  ["src", "app", "admin", "ai-training", "datasets", "[id]", "page.tsx"],
  ["src", "app", "admin", "ai-training", "map-definitions", "page.tsx"],
  ["src", "app", "admin", "ai-training", "synthetic-lab", "page.tsx"],
  ["src", "app", "dashboard", "credits", "page.tsx"],
  ["src", "app", "dashboard", "credits", "history", "page.tsx"],
  ["src", "app", "dashboard", "file-expert", "page.tsx"],
  ["src", "app", "dashboard", "file-expert", "[id]", "page.tsx"],
  ["src", "app", "dashboard", "orders", "page.tsx"],
  ["src", "app", "dashboard", "orders", "[id]", "page.tsx"],
  ["src", "app", "dashboard", "settings", "page.tsx"],
  ["src", "app", "dashboard", "widget", "billing", "page.tsx"],
  ["src", "app", "new-request", "page.tsx"],
  ["src", "components", "dashboard", "DashboardClient.tsx"],
  ["src", "components", "dashboard", "LogAnalysisStudio.tsx"],
  ["src", "components", "dashboard", "WidgetDashboardClient.tsx"],
  ["src", "components", "RequestChat.tsx"],
] as const;

function listClientFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return listClientFiles(path);
    if (!entry.isFile() || !/\.(?:ts|tsx)$/.test(entry.name)) return [];
    return readFileSync(path, "utf8").startsWith('"use client"') ? [path] : [];
  });
}

test("the browser Supabase client uses the supported default lock coordination", () => {
  const client = readProjectFile("src", "lib", "supabaseClient.ts");

  assert.doesNotMatch(client, /navigatorLock/);
  assert.doesNotMatch(client, /lockAcquireTimeout/);
  assert.doesNotMatch(client, /\block:/);
  assert.match(client, /persistSession: true/);
  assert.match(client, /autoRefreshToken: true/);
});

test("protected route layouts share one non-destructive browser auth boundary", () => {
  for (const layout of [
    ["src", "app", "admin", "layout.tsx"],
    ["src", "app", "dashboard", "layout.tsx"],
    ["src", "app", "new-request", "layout.tsx"],
  ]) {
    const source = readProjectFile(...layout);
    assert.match(source, /<BrowserAuthBoundary/);
  }

  const boundary = readProjectFile("src", "components", "auth", "BrowserAuthBoundary.tsx");
  assert.match(boundary, /type AuthState = "checking" \| "authenticated" \| "recovering" \| "unavailable" \| "unauthenticated"/);
  assert.match(boundary, /window\.setTimeout\(verifySession, 0\)/);
  assert.doesNotMatch(boundary, /router\.(?:push|replace)\(/);
  assert.doesNotMatch(boundary, /window\.location/);
});

test("protected routes reuse a verified session and recover transient checks in the background", () => {
  const guard = readProjectFile("src", "lib", "authGuards.ts");
  const boundary = readProjectFile("src", "components", "auth", "BrowserAuthBoundary.tsx");

  assert.match(guard, /export function getStableSessionSnapshot\(\)/);
  assert.match(guard, /const cachedSnapshot = getStableSessionSnapshot\(\);[\s\S]*if \(cachedSnapshot\) \{[\s\S]*session: cachedSnapshot/);
  assert.match(guard, /export async function getStableSession[\s\S]*const cachedSnapshot = getStableSessionSnapshot\(\);[\s\S]*if \(cachedSnapshot\)[\s\S]*if \(sessionResolutionInFlight\)/);
  assert.match(boundary, /const hasCachedSession = Boolean\(getStableSessionSnapshot\(\)\?\.user\)/);
  assert.match(boundary, /if \(!hasCachedSession\) startWaitTimers\(\)/);
  assert.match(boundary, /const sessionRecoveryDelays = \[350, 800, 1600, 3200, 5000\] as const/);
  assert.match(boundary, /current === "authenticated" \? current : nextState/);
  assert.match(boundary, /unavailableSessionDelay = 30000/);
  assert.match(boundary, /aria-live="polite"/);
  assert.doesNotMatch(boundary, /setAuthState\("recovering"\);\s*\}, 8000\)/);
  assert.doesNotMatch(boundary, /Secure session connection interrupted/);
  assert.doesNotMatch(boundary, /Retry secure connection/);
});

test("the stable session snapshot is browser-scoped and cannot leak through warm server memory", () => {
  const guard = readProjectFile("src", "lib", "authGuards.ts");

  assert.match(guard, /return authWindow\?\.__mgAutotechStableSession \?\? null/);
  assert.doesNotMatch(guard, /serverStableSession/);
  assert.doesNotMatch(guard, /globalThis\.__mgAutotechStableSession/);
});

test("protected clients do not treat one raw Supabase read as a logout", () => {
  const routeClients = ["admin", "dashboard", "new-request"]
    .flatMap((segment) => listClientFiles(resolve(process.cwd(), "src", "app", segment)));
  const explicitClients = protectedClientFiles.map((segments) => resolve(process.cwd(), ...segments));

  for (const file of new Set([...routeClients, ...explicitClients])) {
    const source = readFileSync(file, "utf8");
    const label = file.replace(`${process.cwd()}\\`, "");

    assert.doesNotMatch(source, /supabase\.auth\.getSession\(\)/, `${label} performs a raw session read`);
    assert.doesNotMatch(source, /supabase\.auth\.getUser\(\)/, `${label} performs a raw user read`);
    assert.doesNotMatch(source, /window\.location\.href = [`"]\/login[`"]/, `${label} hard-redirects to login`);
    assert.doesNotMatch(source, /response\.status === 401/, `${label} interprets a single API response as logout`);
  }
});

test("session-required events are emitted only after a confirmed signed-out read", () => {
  const guard = readProjectFile("src", "lib", "authGuards.ts");

  assert.match(guard, /class AuthSessionRecoveryPendingError extends Error/);
  assert.match(guard, /if \(getCachedSession\(\) && !lastError\)/);
  assert.match(guard, /const \{ session, error \} = await getStableSession\(\)/);
  assert.match(guard, /if \(!session\?\.user && !error\)/);
  assert.match(guard, /window\.dispatchEvent\(new Event\(AUTH_SESSION_REQUIRED_EVENT\)\)/);
  assert.doesNotMatch(guard, /export function notifySessionRequired\(\) \{\s*if \(typeof window !== "undefined"\) \{/);
});

test("auth state callbacks defer follow-up Supabase work outside the callback", () => {
  const boundary = readProjectFile("src", "components", "auth", "BrowserAuthBoundary.tsx");
  const dashboard = readProjectFile("src", "components", "dashboard", "DashboardClient.tsx");
  const notifications = readProjectFile("src", "components", "CustomerNotifications.tsx");

  for (const source of [boundary, dashboard, notifications]) {
    assert.doesNotMatch(source, /onAuthStateChange\(async/);
  }

  assert.match(boundary, /window\.setTimeout\(verifySession, 0\)/);
  assert.match(dashboard, /window\.setTimeout\(\(\) => \{/);
  assert.match(notifications, /window\.setTimeout\(\(\) => \{ void resolveCustomer/);
});

test("admin AI routes keep permission denial distinct from session recovery", () => {
  const pages = [
    readProjectFile("src", "app", "admin", "ai-training", "page.tsx"),
    readProjectFile("src", "app", "admin", "ai-training", "[id]", "page.tsx"),
    readProjectFile("src", "app", "admin", "ai-training", "clusters", "page.tsx"),
  ];

  for (const page of pages) {
    assert.match(page, /authenticatedFetch/);
    assert.doesNotMatch(page, /response\.status === 401/);
  }

  assert.match(pages[0], /response\.status === 403/);
  assert.match(pages[1], /response\.status === 403/);
});
