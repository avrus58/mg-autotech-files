import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function readProjectFile(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

test("admin background refresh uses the stable browser session instead of a fresh user lookup", () => {
  const adminPage = readProjectFile("src", "app", "admin", "page.tsx");

  assert.match(adminPage, /import \{ getStableSession, signOutIfEmailUnverified \} from "@\/lib\/authGuards"/);
  assert.match(adminPage, /const \{ session \} = await getStableSession\(\)/);
  assert.match(adminPage, /const user = session\?\.user/);
  assert.doesNotMatch(adminPage, /const \{ data: userData \} = await supabase\.auth\.getUser\(\)/);
  assert.match(adminPage, /\.eq\("id", user\.id\)/);
});

test("a transient silent session gap keeps the loaded admin workspace visible", () => {
  const adminPage = readProjectFile("src", "app", "admin", "page.tsx");

  assert.match(adminPage, /if \(silent && hasLoadedAdminDataRef\.current\) \{[\s\S]*?return;\s*\}/);
  assert.doesNotMatch(adminPage, /ADMIN_SESSION_SYNC_ERROR_MESSAGE/);
  assert.doesNotMatch(
    adminPage,
    /if \(silent && hasLoadedAdminDataRef\.current\) \{\s*setAdminLoadError/
  );
  assert.match(adminPage, /router\.replace\("\/login\?redirect=\/admin"\)/);
  assert.doesNotMatch(
    adminPage,
    /if \(!user\) \{\s*router\.(?:push|replace)\("\/login"\)/
  );
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

  assert.match(adminPage, /\.select\("role, staff_role, staff_permissions"\)/);
  assert.match(adminPage, /!isStaffMember\(access\)/);
  assert.match(adminPage, /!hasStaffPermission\(access, "orders\.view"\)/);
  assert.match(adminPage, /You are not authorized to access the admin panel/);
});
