import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(path, "utf8");

test("panel grid containment does not hide overflowing controls or scale the UI", () => {
  const css = source("src/app/globals.css");
  const rules = css.slice(css.indexOf("/* Allow panel grid tracks"), css.indexOf("/*\n  Compact operating UI"));
  assert.match(rules, /\[data-admin-workspace\], \.mg-customer-density\) \.grid > \* \{\s*min-width: 0;/);
  assert.match(rules, /overflow-wrap: anywhere/);
  assert.doesNotMatch(rules, /overflow[^;]*hidden|zoom:|scale\(/);
  assert.match(source("src/app/admin/layout.tsx"), /<BrowserAuthBoundary[\s\S]*<div data-admin-workspace>[\s\S]*\{children\}[\s\S]*<AdminNotificationDock/);
});

test("customer navigation and shared headings wrap without dropping destinations", () => {
  const sidebar = source("src/components/dashboard/CustomerPortalSidebar.tsx");
  const header = source("src/components/dashboard/CustomerPortalPageHeader.tsx");
  assert.match(sidebar, /min-w-0 break-words leading-snug/);
  for (const destination of ["/new-request", "/dashboard/orders", "/dashboard/file-expert", "/dashboard/log-analysis", "/dashboard/widget", "/dashboard/credits", "/dashboard/credits/history", "/dashboard/notifications", "/dashboard/settings"]) {
    assert.ok(sidebar.includes(destination), destination);
  }
  assert.doesNotMatch(header, /truncate/);
  assert.match(header, /flex-wrap items-center justify-between/);
  assert.match(header, /flex max-w-full flex-wrap items-center/);
});

test("dashboard preserves complete action guidance and credit descriptions", () => {
  const dashboard = source("src/components/dashboard/DashboardClient.tsx");
  const banner = dashboard.slice(dashboard.indexOf("<details"), dashboard.indexOf('href={dashboardNextAction.href}'));
  assert.match(banner, /<summary/);
  assert.match(banner, /focus-visible:ring-2/);
  assert.match(banner, /dashboardNextAction.title/);
  assert.match(banner, /dashboardNextAction.description/);
  assert.doesNotMatch(banner, /truncate|hidden truncate/);
  assert.match(dashboard, /open=\{dashboardNextAction.key === "response"\}/);
  const welcome = dashboard.slice(dashboard.indexOf("data-dashboard-welcome"), dashboard.indexOf("data-dashboard-priority-summary"));
  assert.doesNotMatch(welcome, /profileMissingItems.map/);
  assert.match(welcome, /href="\/new-request"/);
  const ledger = dashboard.slice(dashboard.indexOf("creditHistory.map"), dashboard.indexOf("Customer ID", dashboard.indexOf("creditHistory.map")));
  assert.doesNotMatch(ledger, /truncate|line-clamp/);
  assert.match(ledger, /item.description/);
  assert.match(ledger, /item.balance_after/);
  assert.match(ledger, /translate="no" data-no-translate/);
});

test("admin customer controls use cards on laptops and fluid balances on wide screens", () => {
  const admin = source("src/app/admin/page.tsx");
  const customers = admin.slice(admin.indexOf("function CustomersPanel"), admin.indexOf("function CustomerDetailModal"));
  assert.match(customers, /data-admin-customers-table[^>]*overflow-x-auto[^>]*2xl:block/);
  assert.match(customers, /grid gap-3 lg:grid-cols-2 2xl:hidden/);
  assert.doesNotMatch(customers, /w-24/);
  assert.match(customers, /max-w-full[^\n]*md:w-\[520px\]/);
  assert.match(customers, /quickAdjustCredits\(customer, amount\)/);
  assert.match(customers, /openCustomer\(customer\)/);
  const cards = customers.slice(customers.indexOf("grid gap-3 lg:grid-cols-2 2xl:hidden"));
  for (const preservedField of ["account_type", "account_status", "allow_negative_credits", "negative_credit_limit", "internal_admin_note"]) {
    assert.ok(cards.includes(`customer.${preservedField}`), preservedField);
  }
  assert.match(cards, /aria-label="Copy customer ID"/);
  assert.match(cards, /navigator.clipboard.writeText\(customer.customer_id\)/);
  assert.match(admin, /data-admin-navigation/);
  assert.match(admin, /id="customer-detail-title" className="break-words/);
  assert.match(admin, /onClick=\{onSave\}/);
});
