import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function source(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

test("customer dashboard loads independent data concurrently", () => {
  const dashboard = source("src", "components", "dashboard", "DashboardClient.tsx");
  assert.match(dashboard, /\] = await Promise\.all\(\[/);
  assert.match(dashboard, /dashboardRefreshInFlightRef = useRef\(false\)/);
  assert.match(dashboard, /if \(dashboardRefreshInFlightRef\.current\) return/);
  assert.match(dashboard, /dashboardRefreshInFlightRef\.current = false/);
});

test("customer polling pauses in hidden tabs and refreshes when visible", () => {
  const dashboard = source("src", "components", "dashboard", "DashboardClient.tsx");
  assert.match(dashboard, /document\.visibilityState === "visible"/);
  assert.match(dashboard, /document\.addEventListener\("visibilitychange", handleVisibilityChange\)/);
  assert.match(dashboard, /document\.removeEventListener\("visibilitychange", handleVisibilityChange\)/);
});

test("admin dashboard server fetches operational snapshots concurrently", () => {
  const route = source("src", "app", "api", "admin", "dashboard", "route.ts");
  assert.match(route, /const \[orderResult, customerResult, emailIssues\] = await Promise\.all\(\[/);
  assert.match(route, /orderQuery,[\s\S]*customerQuery,[\s\S]*listAdminEmailDeliveryIssues\(\)/);
  assert.match(route, /requireStaffPermission\(request, "orders\.view"\)/);
  assert.match(route, /"Cache-Control": "private, no-store, max-age=0"/);
});
