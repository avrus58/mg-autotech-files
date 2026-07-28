import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function readProjectFile(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

test("admin background refresh uses the stable browser session instead of a fresh user lookup", () => {
  const adminPage = readProjectFile("src", "app", "admin", "page.tsx");

  assert.match(adminPage, /import \{ authenticatedFetch, getStableSession, notifySessionRequired, signOutIfEmailUnverified \} from "@\/lib\/authGuards"/);
  assert.match(adminPage, /import \{ resolveAdminAccess \} from "@\/lib\/adminAccessClient"/);
  assert.match(adminPage, /const \{ session \} = await getStableSession\(\)/);
  assert.match(adminPage, /const user = session\?\.user/);
  assert.doesNotMatch(adminPage, /const \{ data: userData \} = await supabase\.auth\.getUser\(\)/);
  assert.match(adminPage, /resolveAdminAccess\(user\.id\)/);
});

test("a transient silent session gap keeps the loaded admin workspace visible", () => {
  const adminPage = readProjectFile("src", "app", "admin", "page.tsx");

  assert.match(adminPage, /if \(silent && hasLoadedAdminDataRef\.current\) \{[\s\S]*?return;\s*\}/);
  assert.doesNotMatch(adminPage, /ADMIN_SESSION_SYNC_ERROR_MESSAGE/);
  assert.doesNotMatch(
    adminPage,
    /if \(silent && hasLoadedAdminDataRef\.current\) \{\s*setAdminLoadError/
  );
  assert.match(adminPage, /notifySessionRequired\(\)/);
  assert.doesNotMatch(adminPage, /router\.replace\("\/login\?redirect=\/admin"\)/);
  assert.doesNotMatch(
    adminPage,
    /if \(!user\) \{\s*router\.(?:push|replace)\("\/login"\)/
  );
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

test("admin authorization remains profile and permission based", () => {
  const adminPage = readProjectFile("src", "app", "admin", "page.tsx");
  const accessClient = readProjectFile("src", "lib", "adminAccessClient.ts");
  const accessClassifier = readProjectFile("src", "lib", "adminAccess.ts");

  assert.match(accessClient, /\.select\("role, staff_role, staff_permissions"\)/);
  assert.match(accessClassifier, /!isStaffMember\(access\)/);
  assert.match(accessClassifier, /!hasStaffPermission\(access, "orders\.view"\)/);
  assert.match(adminPage, /You are not authorized to access the admin panel/);
});

test("transient profile query failures never become a false access denial", () => {
  const adminPage = readProjectFile("src", "app", "admin", "page.tsx");
  const accessClient = readProjectFile("src", "lib", "adminAccessClient.ts");
  const accessClassifier = readProjectFile("src", "lib", "adminAccess.ts");
  const unavailableBranch =
    adminPage.match(
      /if \(accessResolution\.state === "unavailable"\)[\s\S]*?if \(accessResolution\.state === "denied"\)/
    )?.[0] ?? "";

  assert.match(accessClassifier, /if \(error\) return \{ state: "unavailable" \}/);
  assert.match(accessClient, /ADMIN_ACCESS_RETRY_DELAYS_MS = \[0, 160, 420\]/);
  assert.match(adminPage, /if \(accessResolution\.state === "unavailable"\) \{/);
  assert.match(
    adminPage,
    /if \(!silent \|\| !hasLoadedAdminDataRef\.current\) \{\s*setAdminLoadError\(ADMIN_LOAD_ERROR_MESSAGE\)/
  );
  assert.doesNotMatch(unavailableBranch, /setAdminAccessDenied\(true\)/);
});

test("only a successful denied profile resolution closes the admin workspace", () => {
  const adminPage = readProjectFile("src", "app", "admin", "page.tsx");

  assert.match(adminPage, /const \[adminAccessDenied, setAdminAccessDenied\] = useState\(false\)/);
  assert.match(
    adminPage,
    /if \(accessResolution\.state === "denied"\) \{[\s\S]*setAdminAccessDenied\(true\)/
  );
  assert.match(adminPage, /const access = accessResolution\.access;[\s\S]*setAdminAccessDenied\(false\)/);
  assert.match(adminPage, /if \(adminAccessDenied\) \{/);
  assert.doesNotMatch(adminPage, /if \(message === "You are not authorized/);
});
