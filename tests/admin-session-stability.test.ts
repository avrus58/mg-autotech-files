import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { hasAdminSnapshotRegression } from "../src/lib/adminDataStability";

function readProjectFile(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

test("admin dashboard reads a verified server snapshot instead of browser RLS queries", () => {
  const adminPage = readProjectFile("src", "app", "admin", "page.tsx");
  const dashboardRoute = readProjectFile("src", "app", "api", "admin", "dashboard", "route.ts");

  assert.match(adminPage, /authenticatedFetch\("\/api\/admin\/dashboard"/);
  assert.doesNotMatch(adminPage, /supabase\.from\("orders"\)\.select\("\*"\)/);
  assert.doesNotMatch(adminPage, /supabase\s*\.from\("profiles"\)\s*\.select\(customerSelect\)/);
  assert.match(dashboardRoute, /requireStaffPermission\(request, "orders\.view"\)/);
  assert.match(dashboardRoute, /getSupabaseAdmin\(\)/);
  assert.match(dashboardRoute, /hasStaffPermission\(auth\.access, "customers\.view"\)/);
  assert.match(dashboardRoute, /"Cache-Control": "private, no-store, max-age=0"/);
});

test("admin dashboard snapshot rejects anonymous requests", async () => {
  const { GET } = await import("../src/app/api/admin/dashboard/route");

  const response = await GET(new Request("http://localhost/api/admin/dashboard"));
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Unauthorized" });
});

test("a transient snapshot request failure keeps the loaded admin workspace visible", () => {
  const adminPage = readProjectFile("src", "app", "admin", "page.tsx");

  assert.match(adminPage, /if \(!silent \|\| !hasLoadedAdminDataRef\.current\) \{\s*setAdminLoadError\(ADMIN_LOAD_ERROR_MESSAGE\)/);
  assert.doesNotMatch(adminPage, /ADMIN_SESSION_SYNC_ERROR_MESSAGE/);
  assert.doesNotMatch(adminPage, /router\.replace\("\/login\?redirect=\/admin"\)/);
  assert.doesNotMatch(adminPage, /setOrders\(\[\]\)/);
  assert.doesNotMatch(adminPage, /setCustomers\(\[\]\)/);
});

test("silent admin refresh failures preserve the verified workspace without a recurring warning", () => {
  const adminPage = readProjectFile("src", "app", "admin", "page.tsx");

  assert.match(
    adminPage,
    /if \(!silent \|\| !hasLoadedAdminDataRef\.current\) setAdminLoadError\(ADMIN_LOAD_ERROR_MESSAGE\)/
  );
  assert.doesNotMatch(adminPage, /ADMIN_SYNC_ERROR_MESSAGE/);
  assert.doesNotMatch(adminPage, /Admin sync needs retry/);
});

test("admin polling avoids overlapping refreshes and pauses in hidden tabs", () => {
  const adminPage = readProjectFile("src", "app", "admin", "page.tsx");

  assert.match(adminPage, /const adminRefreshInFlightRef = useRef\(false\)/);
  assert.match(adminPage, /adminRefreshInFlightRef\.current \|\|\s*document\.visibilityState !== "visible"/);
  assert.match(adminPage, /adminRefreshInFlightRef\.current = true/);
  assert.match(adminPage, /loadAdminData\(\{ silent: true \}\)\.finally/);
  assert.match(adminPage, /adminRefreshInFlightRef\.current = false/);
  assert.match(adminPage, /document\.addEventListener\("visibilitychange", handleVisibilityChange\)/);
  assert.match(adminPage, /document\.removeEventListener\("visibilitychange", handleVisibilityChange\)/);
});

test("verified admin snapshots cannot be replaced by empty, partial or older refresh data", () => {
  assert.equal(hasAdminSnapshotRegression([], []), false);
  assert.equal(hasAdminSnapshotRegression(["order-1"], ["order-1"]), false);
  assert.equal(hasAdminSnapshotRegression(["order-1"], ["order-2", "order-1"]), false);
  assert.equal(hasAdminSnapshotRegression(["order-1", "order-2"], []), true);
  assert.equal(hasAdminSnapshotRegression(["order-1", "order-2"], ["order-2"]), true);
  assert.equal(
    hasAdminSnapshotRegression(["order-1", "order-2", "order-3", "order-4"], ["order-1", "order-2", "order-3"]),
    false,
    "a single legitimate archived row must not freeze an otherwise healthy snapshot"
  );

  const adminPage = readProjectFile("src", "app", "admin", "page.tsx");
  assert.match(adminPage, /const adminLoadSequenceRef = useRef\(0\)/);
  assert.match(adminPage, /const loadSequence = \+\+adminLoadSequenceRef\.current/);
  assert.match(adminPage, /loadSequence !== adminLoadSequenceRef\.current/);
  assert.match(adminPage, /hasAdminSnapshotRegression\(\s*knownOrderIdsRef\.current/);
  assert.match(adminPage, /hasAdminSnapshotRegression\(\s*knownCustomerIdsRef\.current/);
  assert.match(adminPage, /previously verified admin snapshot/);
  assert.doesNotMatch(adminPage, /setOrders\(\[\]\)/);
  assert.doesNotMatch(adminPage, /setCustomers\(\[\]\)/);
});

test("admin authorization remains profile and permission based", () => {
  const adminPage = readProjectFile("src", "app", "admin", "page.tsx");
  const accessClassifier = readProjectFile("src", "lib", "adminAccess.ts");
  const accessRoute = readProjectFile("src", "app", "api", "admin", "access", "route.ts");
  const dashboardRoute = readProjectFile("src", "app", "api", "admin", "dashboard", "route.ts");

  assert.match(adminPage, /authenticatedFetch\("\/api\/admin\/dashboard"/);
  assert.match(accessRoute, /requireStaffPermission\(request, "orders\.view"\)/);
  assert.match(dashboardRoute, /requireStaffPermission\(request, "orders\.view"\)/);
  assert.match(accessRoute, /"Cache-Control": "private, no-store, max-age=0"/);
  assert.match(accessClassifier, /!isStaffMember\(access\)/);
  assert.match(accessClassifier, /!hasStaffPermission\(access, "orders\.view"\)/);
  assert.match(adminPage, /You are not authorized to access the admin panel/);
});

test("transient access API failures never become a false access denial", () => {
  const adminPage = readProjectFile("src", "app", "admin", "page.tsx");
  const authGuards = readProjectFile("src", "lib", "authGuards.ts");

  assert.match(authGuards, /requestRetryDelays = \[0, 250, 650\]/);
  assert.match(adminPage, /response = await authenticatedFetch\("\/api\/admin\/dashboard"/);
  assert.match(
    adminPage,
    /} catch \{[\s\S]*?if \(!silent \|\| !hasLoadedAdminDataRef\.current\) \{\s*setAdminLoadError\(ADMIN_LOAD_ERROR_MESSAGE\)/
  );
  assert.match(
    adminPage,
    /if \(!response\.ok\) \{[\s\S]*?setAdminLoadError\(ADMIN_LOAD_ERROR_MESSAGE\)/
  );
  assert.doesNotMatch(
    adminPage,
    /} catch \{[\s\S]*?setAdminAccessDenied\(true\)[\s\S]*?if \(loadSequence !== adminLoadSequenceRef\.current\)/
  );
});

test("only a successful denied profile resolution closes the admin workspace", () => {
  const adminPage = readProjectFile("src", "app", "admin", "page.tsx");

  assert.match(adminPage, /const \[adminAccessDenied, setAdminAccessDenied\] = useState\(false\)/);
  assert.match(
    adminPage,
    /if \(response\.status === 403\) \{[\s\S]*?setAdminAccessDenied\(true\)/
  );
  assert.match(adminPage, /const access = payload\.access;[\s\S]*setAdminAccessDenied\(false\)/);
  assert.match(adminPage, /if \(adminAccessDenied\) \{/);
  assert.doesNotMatch(adminPage, /if \(message === "You are not authorized/);
});

test("server-side profile lookup failures stay retryable instead of becoming 403", () => {
  const apiAuth = readProjectFile("src", "lib", "apiAuth.ts");

  assert.match(apiAuth, /else if \(current\.error\) \{/);
  assert.match(apiAuth, /if \(legacy\.error\) \{/);
  assert.equal(
    (apiAuth.match(/status: 503/g) ?? []).length,
    2,
    "both current and legacy profile query failures must be service-unavailable responses"
  );
});
