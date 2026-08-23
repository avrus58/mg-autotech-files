import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  adsPerformancePermissions,
  customerIntelligencePermissions,
  growthClassificationReadPermissions,
  growthReminderPermissions,
  growthReportPermissions,
} from "../src/lib/growth/access";
import {
  hasAllStaffPermissions,
  staffRoleDefaults,
  type StaffAccess,
} from "../src/lib/staffPermissions";

function source(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

function staff(permissions: string[]): StaffAccess {
  return { role: "staff", staffRole: "support", permissions };
}

test("growth data surfaces require every vertical represented in their response", () => {
  assert.deepEqual(growthReportPermissions, [
    "orders.view",
    "customers.view",
    "credits.manage",
    "messages.manage",
  ]);
  assert.deepEqual(customerIntelligencePermissions, growthReportPermissions);
  assert.deepEqual(adsPerformancePermissions, growthReportPermissions);
  assert.deepEqual(growthReminderPermissions, ["orders.manage", "messages.manage"]);
  assert.deepEqual(growthClassificationReadPermissions, [
    "customers.manage",
    "orders.view",
    "credits.manage",
  ]);

  assert.equal(hasAllStaffPermissions(staff([...growthReportPermissions]), growthReportPermissions), true);
  assert.equal(hasAllStaffPermissions(staff(["orders.view"]), growthReportPermissions), false);
  assert.equal(hasAllStaffPermissions(staff(["customers.view"]), customerIntelligencePermissions), false);
  assert.equal(hasAllStaffPermissions(staff(["orders.manage"]), growthReminderPermissions), false);
  assert.equal(
    hasAllStaffPermissions(
      { role: "staff", staffRole: "manager", permissions: staffRoleDefaults.manager },
      growthReportPermissions
    ),
    true
  );
  assert.equal(
    hasAllStaffPermissions({ role: "admin", staffRole: "owner", permissions: [] }, growthReportPermissions),
    true
  );
  assert.equal(
    hasAllStaffPermissions({ role: "customer", staffRole: null, permissions: [...growthReportPermissions] }, growthReportPermissions),
    false
  );
});

test("growth, customer intelligence, Ads and reminders use their composite permission gates", () => {
  const growth = source("src", "app", "api", "admin", "growth", "route.ts");
  const customer = source("src", "app", "api", "admin", "growth", "customers", "[id]", "route.ts");
  const classification = source("src", "app", "api", "admin", "growth", "customers", "route.ts");
  const ads = source("src", "app", "api", "admin", "ads-performance", "route.ts");
  const reminder = source("src", "app", "api", "admin", "growth", "reminders", "route.ts");

  assert.match(growth, /requireStaffPermissions\(request, growthReportPermissions\)/);
  assert.match(customer, /requireStaffPermissions\(request, customerIntelligencePermissions\)/);
  assert.match(classification, /requireStaffPermissions\(request, growthClassificationReadPermissions\)/);
  assert.match(ads, /requireStaffPermissions\(request, adsPerformancePermissions\)/);
  assert.match(reminder, /requireStaffPermissions\(request, growthReminderPermissions\)/);
  assert.match(customer, /requireStaffPermission\(request, "customers\.manage"\)/);
  assert.match(classification, /requireStaffPermission\(request, "customers\.manage"\)/);
});

test("service-role customer projections exclude staff and admin profiles at the query", () => {
  const dashboard = source("src", "app", "api", "admin", "dashboard", "route.ts");
  const intelligence = source("src", "lib", "growth", "customerIntelligenceServer.ts");
  const classification = source("src", "lib", "growth", "customerClassificationServer.ts");
  const report = source("src", "lib", "growth", "report.ts");

  assert.equal((dashboard.match(/\.eq\("role", "customer"\)/g) ?? []).length, 2);
  assert.match(intelligence, /\.eq\("id", userId\)\s*\.eq\("role", "customer"\)/);
  assert.match(classification, /from\("profiles"\)[\s\S]*?\.eq\("role", "customer"\)/);
  assert.match(report, /from\("profiles"\)[\s\S]*?\.eq\("role", "customer"\)/);
});

test("admin navigation hides composite reports and Customer 360 without the matching capability set", () => {
  const admin = source("src", "app", "admin", "page.tsx");
  assert.match(admin, /hasAllStaffPermissions\(adminAccess, adsPerformancePermissions\)[\s\S]*?href="\/admin\/ads-performance"/);
  assert.match(admin, /hasAllStaffPermissions\(adminAccess, growthReportPermissions\)[\s\S]*?href="\/admin\/growth"/);
  assert.match(admin, /canViewCustomerIntelligence=\{hasAllStaffPermissions\(adminAccess, customerIntelligencePermissions\)\}/);
  assert.match(admin, /canViewCustomerIntelligence && <Link href=\{`\/admin\/growth\/customers\/\$\{customer\.id\}`\}/);
});
