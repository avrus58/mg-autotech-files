import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { customerOrderViewStatuses, isCustomerOrderView } from "../src/lib/customerOrderViews";
import { notificationConnectionState } from "../src/lib/notificationConnection";
import { supportedLocales } from "../src/lib/i18nConfig";
import { customerWorkflowExactT as securityT } from "../src/lib/i18n/customer-workflow-security-translations";
import { customerWorkflowExactT as notificationsT } from "../src/lib/i18n/customer-workflow-notifications-translations";
import { customerWorkflowExactT as ordersT } from "../src/lib/i18n/customer-workflow-orders-translations";

const source = (file: string) => readFileSync(path.resolve(file), "utf8");

test("new panel copy exists in the actual browser catalogs for every locale", () => {
  const securityCopy = ["Name, phone and preferred contact method.", "Invoice e-mail", "Street, postal code, city and country.", "Company Name", "Account type", "Complete", "Missing information", "Add missing details below to help us handle your requests."];
  const notificationCopy = ["Connecting", "Connected", "Disconnected", "Latest 100 notifications", "Use Refresh if updates are delayed.", "New order updates and messages will appear here."];
  const orderCopy = ["Active Orders", "Pending Requests", "In Progress", "Loading orders..."];
  for (const { code: locale } of supportedLocales) {
    for (const [translator, copy] of [[securityT, securityCopy], [notificationsT, notificationCopy], [ordersT, orderCopy]] as const) {
      for (const text of copy) {
        const translated = translator(locale, text);
        assert.ok(translated.trim(), `${locale}: ${text}`);
        if (locale === "en") assert.equal(translated, text);
        else assert.notEqual(translated, text, `${locale}: browser catalog missing ${text}`);
      }
    }
  }
});

test("overview categories retain exact pending/progress semantics and all existing views", () => {
  assert.deepEqual(customerOrderViewStatuses.pending, ["new_request", "file_check"]);
  assert.deepEqual(customerOrderViewStatuses.in_progress, ["in_progress"]);
  assert.deepEqual(customerOrderViewStatuses.needs_response, ["customer_info_needed"]);
  assert.deepEqual(customerOrderViewStatuses.active, ["new_request", "file_check", "in_progress", "customer_info_needed", "revision"]);
  assert.deepEqual(customerOrderViewStatuses.completed, ["completed"]);
  assert.deepEqual(customerOrderViewStatuses.cancelled, ["cancelled"]);
  assert.deepEqual(customerOrderViewStatuses.all, []);
  for (const value of Object.keys(customerOrderViewStatuses)) assert.equal(isCustomerOrderView(value), true);
  for (const value of [null, "", "unknown", "constructor", "__proto__"]) assert.equal(isCustomerOrderView(value), false);
  const dashboard = source("src/components/dashboard/DashboardClient.tsx");
  assert.match(dashboard, /href="\/dashboard\/orders\?view=pending"/);
  assert.match(dashboard, /href="\/dashboard\/orders\?view=in_progress"/);
});

test("archive observes URL changes and rejects stale responses or old-filter rows", () => {
  const orders = source("src/app/dashboard/orders/page.tsx");
  assert.match(orders, /useSearchParams\(\)/);
  assert.match(orders, /requestedView = searchParams.get\("view"\)/);
  assert.match(orders, /const requestId = \+\+requestSequence.current/);
  assert.match(orders, /if \(requestId !== requestSequence.current\) return/);
  assert.match(orders, /const ordersReady = loadedScope === scope/);
  assert.match(orders, /!options\?\.silent \|\| loadedScopeRef\.current !== scope/);
  assert.match(orders, /loadedScopeRef\.current = scope/);
  assert.match(orders, /ordersReady && orders.length < total/);
  assert.match(orders, /\.eq\("customer_id", uid\)/);
});

test("notification indicator follows subscription, failures and offline/reconnect transitions", () => {
  assert.equal(notificationConnectionState("JOINING"), "connecting");
  assert.equal(notificationConnectionState("SUBSCRIBED"), "connected");
  for (const status of ["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"]) {
    assert.equal(notificationConnectionState(status), "disconnected");
    assert.equal(notificationConnectionState("SUBSCRIBED"), "connected");
  }
  assert.equal(notificationConnectionState("SUBSCRIBED", false), "disconnected");
  // A short browser offline/online interval does not necessarily rejoin the channel.
  assert.equal(notificationConnectionState("SUBSCRIBED", true), "connected");
  assert.equal(notificationConnectionState("CHANNEL_ERROR", false), "disconnected");
  assert.equal(notificationConnectionState("CHANNEL_ERROR", true), "disconnected");
  const notifications = source("src/app/dashboard/notifications/page.tsx");
  assert.match(notifications, /subscribe\(\(status\) =>/);
  assert.match(notifications, /if \(!active\) return;[\s\S]*notificationConnectionState\(status, navigator.onLine\)/);
  assert.match(notifications, /if \(status === "SUBSCRIBED"\) void load\(id, true\)/);
  assert.match(notifications, /removeEventListener\("offline", onOffline\)/);
  assert.match(notifications, /lastSubscriptionStatus = status/);
  assert.match(notifications, /onOnline = \(\) => setConnectionState\(notificationConnectionState\(lastSubscriptionStatus, true\)\)/);
  assert.doesNotMatch(notifications, /value="On"|Customer-owned realtime channel/);
});

test("admin does not display missing or unconfirmed prices as zero or assert no saved policy", () => {
  const admin = source("src/app/admin/page.tsx");
  assert.match(admin, /customerPricingReady && form.global_custom_unit_price_eur.trim\(\)/);
  assert.match(admin, /customerPricingReady && globalPriceText \? Number\(globalPriceText\) : NaN/);
  assert.match(admin, /const effectivePrice = !customerPricingReady \|\| !overrideValid/);
  assert.match(admin, /Number.isFinite\(globalPrice\) \? globalPrice : null/);
  assert.match(admin, /!customerPricingReady \? "Saved pricing has not been confirmed."/);
  assert.match(admin, /disabled=\{pricingControlsDisabled\}/);
});

test("readability fixes preserve digits, full statuses and honest localized readiness", () => {
  const dashboard = source("src/components/dashboard/DashboardClient.tsx");
  const balance = dashboard.slice(dashboard.indexOf("data-dashboard-balance"), dashboard.indexOf("</section>", dashboard.indexOf("data-dashboard-balance")));
  assert.match(balance, /whitespace-nowrap[^\n]*formatDashboardCount/);
  assert.doesNotMatch(balance, /break-words/);
  const admin = source("src/app/admin/page.tsx");
  assert.match(admin, /min-w-0 whitespace-normal[^\n]*statusLabel\(order.status\)/);
  assert.doesNotMatch(admin, /truncate[^\n]*statusLabel\(order.status\)/);
  const settings = source("src/app/dashboard/settings/page.tsx");
  assert.match(settings, /item.complete \? customerWorkflowExactT\(locale, "Complete"\) : customerWorkflowExactT\(locale, "Missing information"\)/);
  assert.doesNotMatch(settings, /are ready for|high-touch|available for B2B/);
});
