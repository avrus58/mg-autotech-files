import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function readProjectFile(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

test("widget billing portal verifies account, subscription and customer binding", () => {
  const route = readProjectFile("src", "app", "api", "stripe", "widget-customer-portal", "route.ts");

  assert.match(route, /select\("id, email, stripe_customer_id, stripe_subscription_id"\)/);
  assert.match(route, /recoverCustomerIdFromSubscription/);
  assert.match(route, /stripe\.subscriptions\.retrieve\(subscriptionId\)/);
  assert.match(route, /subscription\.metadata\.widget_client_id !== clientId/);
  assert.match(route, /\.eq\("user_id", auth\.user\.id\)/);
  assert.match(route, /subscriptionEmail[\s\S]*?clientEmail/);
  assert.doesNotMatch(route, /auth\.user\.email/);
  assert.match(route, /client\.data\.stripe_customer_id !== verifiedCustomerId/);
  assert.match(route, /billing\.customer_profile_recovered/);
  assert.match(route, /billingPortal\.sessions\.create/);
  assert.match(route, /action: "view_plans"/);
  assert.doesNotMatch(route, /Stripe billing profile not found/);
  assert.doesNotMatch(route, /SUPABASE_SERVICE_ROLE_KEY|service_role/);
});

test("customer widget payload exposes billing state booleans instead of raw Stripe ids", () => {
  const route = readProjectFile("src", "app", "api", "widget", "client", "route.ts");
  const customerType = readProjectFile("src", "lib", "widget", "customerTypes.ts");

  assert.match(route, /WIDGET_CUSTOMER_CLIENT_FIELDS/);
  assert.match(route, /Object\.fromEntries\(safeFields\.map/);
  assert.match(route, /function customerSafeClient/);
  assert.match(route, /client: customerSafeClient\(client\)/);
  assert.match(route, /billing_profile_linked: Boolean\(row\.stripe_customer_id \|\| row\.stripe_subscription_id\)/);
  assert.match(route, /subscription_linked: Boolean\(row\.stripe_subscription_id\)/);
  assert.doesNotMatch(customerType.split("export const WIDGET_CUSTOMER_CLIENT_FIELDS")[1].split("\.join")[0], /stripe_customer_id|stripe_subscription_id|user_id|admin_suspended/);
  assert.match(customerType, /"stripe_customer_id" \| "stripe_subscription_id" \| "user_id" \| "admin_suspended"/);
});

test("widget dashboard and billing UI do not show a dead manage button when billing is unlinked", () => {
  const dashboard = readProjectFile("src", "components", "dashboard", "WidgetDashboardClient.tsx");
  const notice = readProjectFile("src", "components", "widget", "SubscriptionNotice.tsx");
  const panel = readProjectFile("src", "components", "widget", "SubscriptionSummaryPanel.tsx");
  const billing = readProjectFile("src", "app", "dashboard", "widget", "billing", "page.tsx");

  assert.match(dashboard, /const canManageBilling = Boolean\(client\?\.billing_profile_linked\)/);
  assert.match(dashboard, /widgetSiteT\(activeSiteLocale, "billingProfileMissing"\)/);
  assert.match(panel, /widgetSiteT\(locale, "viewWidgetPlans"\)/);
  assert.match(notice, /canManageBilling/);
  assert.match(notice, /href="\/widget"/);
  assert.match(notice, /mailto:info@mgautotech\.de\?subject=Widget%20billing%20support/);
  assert.match(billing, /setShowPlanAction\(data\.action === "view_plans"\)/);
  assert.match(billing, /View widget plans/);
  assert.doesNotMatch(dashboard, /stripe_customer_id|stripe_subscription_id|widget_audit_logs|service_role|admin_note/);
});

test("widget subscription summary endpoint exposes professional billing fields without raw Stripe internals", () => {
  const route = readProjectFile("src", "app", "api", "stripe", "widget-subscription-summary", "route.ts");
  const helper = readProjectFile("src", "lib", "widget", "billingSummary.ts");
  const typeFile = readProjectFile("src", "lib", "widget", "customerTypes.ts");

  assert.match(route, /requireApiUser/);
  assert.match(route, /widget_clients/);
  assert.match(route, /stripe\.subscriptions\.retrieve/);
  assert.doesNotMatch(route, /stripe\.subscriptions\.list/);
  assert.match(route, /stripe\.invoices\.list/);
  assert.match(route, /subscription\.metadata\.widget_client_id !== client\.id/);
  assert.match(route, /client\.stripe_customer_id !== stripeCustomerId/);
  assert.match(route, /Cache-Control": "private, no-store"/);
  assert.match(route, /buildUnlinkedWidgetBillingSummary/);
  assert.match(route, /buildLocalWidgetBillingSummary/);
  assert.match(route, /buildStripeWidgetBillingSummary/);
  assert.match(helper, /latestPaidInvoice/);
  assert.match(helper, /daysUntilIso/);
  assert.match(helper, /current_period_end/);
  assert.match(typeFile, /last_payment_at/);
  assert.match(typeFile, /next_payment_at/);
  assert.match(typeFile, /days_until_next_payment/);
  assert.match(typeFile, /days_until_period_end/);
  assert.match(typeFile, /cancel_at_period_end/);
  assert.doesNotMatch(route, /payment_method|card|invoice_pdf|hosted_invoice_url|client_secret|service_role/);
});

test("widget subscription summary panel shows last payment next renewal and remaining days", () => {
  const dashboard = readProjectFile("src", "components", "dashboard", "WidgetDashboardClient.tsx");
  const billing = readProjectFile("src", "app", "dashboard", "widget", "billing", "page.tsx");
  const panel = readProjectFile("src", "components", "widget", "SubscriptionSummaryPanel.tsx");

  assert.match(dashboard, /SubscriptionSummaryPanel/);
  assert.match(dashboard, /loadBillingSummary/);
  assert.match(dashboard, /\/api\/stripe\/widget-subscription-summary/);
  assert.match(billing, /SubscriptionSummaryPanel/);
  assert.match(panel, /widgetSiteT\(locale, "lastPayment"\)/);
  assert.match(panel, /widgetSiteT\(locale, "nextPayment"\)/);
  assert.match(panel, /widgetSiteT\(locale, "daysRemaining"\)/);
  assert.match(panel, /widgetSiteT\(locale, "manageSubscription"\)/);
  assert.match(panel, /widgetSiteT\(locale, "customerSafeBilling"\)/);
  assert.doesNotMatch(panel, /stripe_customer_id|stripe_subscription_id|invoice_pdf|hosted_invoice_url|payment_method|card/);
});
