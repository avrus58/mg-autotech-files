import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  shouldReloadAdminAfterHistoryReturn,
  shouldReloadAdminFromPageCache,
} from "../src/lib/adminNavigationRecovery";

function readProjectFile(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

test("persisted admin pages request a fresh document after BFCache restore", () => {
  assert.equal(shouldReloadAdminFromPageCache({
    persisted: true,
    navigationType: "navigate",
    navigationEntryPathname: "/admin",
    currentPathname: "/admin",
  }), true);
  assert.equal(shouldReloadAdminFromPageCache({
    persisted: false,
    navigationType: "back_forward",
    navigationEntryPathname: "/admin",
    currentPathname: "/admin",
  }), true);
  assert.equal(shouldReloadAdminFromPageCache({
    persisted: false,
    navigationType: "navigate",
    navigationEntryPathname: "/admin",
    currentPathname: "/admin",
  }), false);
  assert.equal(shouldReloadAdminFromPageCache({
    persisted: false,
    navigationType: "reload",
    navigationEntryPathname: "/admin",
    currentPathname: "/admin",
  }), false);
  assert.equal(shouldReloadAdminFromPageCache({
    persisted: false,
    navigationType: "back_forward",
    navigationEntryPathname: "/dashboard",
    currentPathname: "/admin",
  }), false, "a later client navigation into admin must not inherit an earlier document traversal");
});

test("browser history return from an admin child route refreshes only the admin root", () => {
  assert.equal(shouldReloadAdminAfterHistoryReturn({
    previousPathname: "/admin/operations",
    currentPathname: "/admin",
    historyTargetPathname: "/admin",
  }), true);
  assert.equal(shouldReloadAdminAfterHistoryReturn({
    previousPathname: "/admin/operations/",
    currentPathname: "/admin/",
    historyTargetPathname: "/admin/",
  }), true);

  assert.equal(shouldReloadAdminAfterHistoryReturn({
    previousPathname: "/admin",
    currentPathname: "/admin",
    historyTargetPathname: null,
  }), false, "a direct admin load must not reload");
  assert.equal(shouldReloadAdminAfterHistoryReturn({
    previousPathname: "/admin/operations",
    currentPathname: "/admin",
    historyTargetPathname: null,
  }), false, "a normal Link navigation must not reload");
  assert.equal(shouldReloadAdminAfterHistoryReturn({
    previousPathname: "/admin/operations",
    currentPathname: "/admin/payments",
    historyTargetPathname: "/admin/payments",
  }), false, "admin child-to-child history navigation must stay client-side");
  assert.equal(shouldReloadAdminAfterHistoryReturn({
    previousPathname: "/dashboard",
    currentPathname: "/admin",
    historyTargetPathname: "/admin",
  }), false, "non-admin history must not control the protected admin layout");
});

test("admin layout owns a single cleaned-up history and BFCache recovery guard", () => {
  const layout = readProjectFile("src", "app", "admin", "layout.tsx");
  const guard = readProjectFile("src", "components", "admin", "AdminWorkspaceRestoreGuard.tsx");

  assert.match(layout, /<AdminWorkspaceRestoreGuard \/>/);
  assert.match(layout, /<AdminWorkspaceRestoreGuard \/>[\s\S]*?<BrowserAuthBoundary/);
  assert.match(guard, /const reloadRequestedRef = useRef\(false\)/);
  assert.match(guard, /if \(reloadRequestedRef\.current\) return/);
  assert.match(guard, /window\.location\.reload\(\)/);
  assert.match(guard, /window\.addEventListener\("popstate", handleHistoryTraversal\)/);
  assert.match(guard, /window\.addEventListener\("pageshow", handlePageShow\)/);
  assert.match(guard, /window\.removeEventListener\("popstate", handleHistoryTraversal\)/);
  assert.match(guard, /window\.removeEventListener\("pageshow", handlePageShow\)/);
  assert.match(guard, /window\.performance\.getEntriesByType\("navigation"\)/);
  assert.match(guard, /\.\.\.readNavigationEntry\(\)/);
  assert.match(guard, /navigationEntryPathname: entry\?\.name \? new URL\(entry\.name\)\.pathname : null/);
  assert.match(guard, /historyTargetPathnameRef\.current = window\.location\.pathname/);
});
