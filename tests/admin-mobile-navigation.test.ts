import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { activeAdminDestination, availableAdminDestinations } from "../src/lib/adminMobileNavigation";
import { buildHomepageTranslationCatalog } from "../src/lib/homepageTranslationCatalog";
import { translateHomepageText } from "../src/lib/homepageLocalization";
import { supportedLocales } from "../src/lib/i18nConfig";
import type { StaffAccess } from "../src/lib/staffPermissions";

const source = (file: string) => readFileSync(file, "utf8");
const owner: StaffAccess = { role: "admin", staffRole: "owner", permissions: [] };

test("mobile admin destinations preserve every desktop section without duplicate links", () => {
  const desktop = source("src/app/admin/page.tsx");
  const links = availableAdminDestinations(owner);
  assert.equal(links.length, 14);
  assert.equal(new Set(links.map((item) => item.href)).size, links.length);
  for (const item of links.filter((item) => !item.href.includes("#"))) {
    assert.ok(desktop.includes(`href="${item.href}"`), item.href);
  }
});

test("unverified, customer and malformed staff access cannot expose navigation", () => {
  for (const access of [null, { role: "customer", staffRole: null, permissions: ["orders.view"] }, { role: "admin", staffRole: null, permissions: ["staff.manage"] }] as Array<StaffAccess | null>) {
    assert.deepEqual(availableAdminDestinations(access), []);
  }
});

test("support staff see only their authorized sections, not finance, AI or owner tools", () => {
  assert.deepEqual(availableAdminDestinations({ role: "staff", staffRole: "support", permissions: ["orders.view", "customers.view", "messages.manage"] }).map((item) => item.href), ["/admin#orders", "/admin#customers", "/admin/requests", "/admin/operations", "/admin/seo-performance"]);
  const delegated = availableAdminDestinations({ role: "staff", staffRole: "manager", permissions: ["staff.manage", "credits.manage"] });
  assert.deepEqual(delegated.map((item) => item.href), ["/admin/payments", "/admin/commercial"]);
});

test("combined reports require all of their existing permissions", () => {
  const permissions = ["orders.view", "customers.view", "credits.manage", "messages.manage"];
  for (const missing of permissions) {
    const links = availableAdminDestinations({ role: "staff", staffRole: "manager", permissions: permissions.filter((item) => item !== missing) });
    assert.ok(!links.some((item) => ["/admin/ads-performance", "/admin/growth"].includes(item.href)));
  }
  assert.ok(availableAdminDestinations({ role: "staff", staffRole: "manager", permissions }).some((item) => item.href === "/admin/growth"));
});

test("section identity supports direct URLs, hashes and nested editors without prefix collisions", () => {
  assert.equal(activeAdminDestination("/admin", "#customers"), "/admin#customers");
  assert.equal(activeAdminDestination("/admin", ""), "/admin#orders");
  assert.equal(activeAdminDestination("/admin/vehicles/fixture", "#stages"), "/admin/vehicles");
  assert.equal(activeAdminDestination("/admin/requests/fixture", ""), "/admin/requests");
  assert.equal(activeAdminDestination("/admin/vehicles-unrelated", ""), null);
});

test("mobile menu lives inside the existing authenticated layout with no access bypass", () => {
  const layout = source("src/app/admin/layout.tsx");
  assert.match(layout, /<BrowserAuthBoundary[\s\S]*<AdminMobileNavigation \/>[\s\S]*\{children\}/);
  const menu = source("src/components/admin/AdminMobileNavigation.tsx");
  assert.match(menu, /resolveAdminAccess\(\)/);
  assert.match(menu, /request === requestRef.current/);
  assert.match(menu, /\.showModal\(\)/);
  assert.match(menu, /onClose=/);
  assert.match(menu, /previousOverflow/);
  assert.match(menu, /prefetch=\{false\}/);
  assert.doesNotMatch(menu, /service_role|supabase\.auth|localStorage|setInterval/);
});

test("mobile styling cannot scale or restyle the desktop or customer panel", () => {
  const css = source("src/app/admin/mobile.css");
  assert.match(css, /@media \(max-width: 1023px\)/);
  assert.doesNotMatch(css, /zoom:|scale\(|mg-customer-density/);
  const outsideMobile = css.split("@media")[0];
  assert.doesNotMatch(outsideMobile, /padding|font-size|position: fixed/);
  assert.match(css, /data-admin-desktop-sidebar/);
  assert.match(css, /data-admin-overview-content.*data-expanded="false"/);
  assert.match(source("src/app/admin/page.tsx"), /addEventListener\("hashchange", selectPanel\)/);
});

test("public mobile account labels already have real translations in every supported locale", () => {
  for (const { code } of supportedLocales) {
    for (const label of ["My Account", "Customer Dashboard", "Login"]) {
      const translation = translateHomepageText(label, buildHomepageTranslationCatalog(code));
      assert.ok(translation.trim(), `${code}: ${label}`);
      // "Login" is the reviewed German label, not a missing translation.
      if (code !== "en" && !(code === "de" && label === "Login")) assert.notEqual(translation, label, `${code}: ${label}`);
    }
  }
  const homepage = source("src/components/homepage/HomepageExperience.tsx");
  assert.match(homepage, /data-homepage-mobile-account href=\{isLoggedIn \? "\/dashboard" : "\/login"\}/);
  assert.match(homepage, /data-homepage-mobile-account[^\n]+sm:hidden/);
});
