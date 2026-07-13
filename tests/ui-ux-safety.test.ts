import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import {
  getRequestFlowStepStates,
  isAdvancedRequestServiceCategory,
  requestFlowSteps,
} from "../src/lib/requestFlow";
import { countCompletedToday } from "../src/lib/adminDashboardMetrics";

function readProjectFile(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

test("compact operating UI is opt-in and attached to key customer/admin work screens", () => {
  const globals = readProjectFile("src", "app", "globals.css");
  assert.match(globals, /\.mg-compact-ui/);
  assert.match(globals, /\.mg-step-rail/);

  for (const file of [
    ["src", "app", "new-request", "page.tsx"],
    ["src", "components", "dashboard", "DashboardClient.tsx"],
    ["src", "app", "dashboard", "file-expert", "page.tsx"],
    ["src", "app", "dashboard", "file-expert", "[id]", "page.tsx"],
    ["src", "app", "admin", "requests", "AdminRequestsClient.tsx"],
    ["src", "app", "admin", "requests", "[id]", "WorkOrderDetailClient.tsx"],
    ["src", "app", "admin", "vehicles", "VehicleControlCenter.tsx"],
    ["src", "app", "admin", "ai-training", "page.tsx"],
    ["src", "app", "admin", "ai-training", "clusters", "page.tsx"],
  ]) {
    assert.match(readProjectFile(...file), /mg-compact-ui/);
  }
});

test("new request flow exposes clear progress steps and keeps advanced services collapsed", () => {
  assert.deepEqual(requestFlowSteps.map((step) => step.id), [
    "vehicle",
    "service",
    "upload",
    "notes",
    "payment",
    "review",
  ]);
  assert.equal(isAdvancedRequestServiceCategory("performance"), true);
  assert.equal(isAdvancedRequestServiceCategory("support_addons"), true);
  assert.equal(isAdvancedRequestServiceCategory("emissions"), false);

  const pending = getRequestFlowStepStates({
    hasVehicle: true,
    hasService: true,
    hasUpload: false,
    hasNotes: false,
    hasPaymentAcceptance: false,
    hasFinalAcceptance: false,
  });
  assert.equal(pending.find((step) => step.active)?.id, "upload");

  const page = readProjectFile("src", "app", "new-request", "page.tsx");
  assert.match(page, /Advanced services/);
  assert.match(page, /ServiceCategoryPanel/);
  assert.match(page, /mg-step-rail/);
  assert.match(page, /Manual vehicle details/);
  assert.match(page, /Customer-provided, unverified catalog match/);
  assert.match(page, /p_vehicle_brand: requestVehicleBrand/);
  assert.match(page, /switchToManualVehicleDetails/);
  assert.match(page, /setEcu\(""\)/);
  assert.match(page, /if \(useManualVehicleDetails\) \{\s*return;\s*\}/);
  assert.match(page, /let cancelled = false/);
});

test("customer order detail timeline shows action-needed and revision states separately", () => {
  const page = readProjectFile("src", "app", "dashboard", "orders", "[id]", "page.tsx");

  assert.match(page, /key:\s*"customer_info_needed"/);
  assert.match(page, /Waiting for Your Information/);
  assert.match(page, /status === "customer_info_needed"[\s\S]*timelineStepDefinitions\.customerInfoNeeded/);
  assert.match(page, /key:\s*"revision"/);
  assert.match(page, /Revision Review/);
  assert.match(page, /status === "revision"[\s\S]*timelineStepDefinitions\.revision/);
  assert.match(page, /step\.key === "revision"/);
  assert.match(page, /max-w-full rounded-full/);
  assert.match(page, /break-words font-black/);
  assert.doesNotMatch(page, /status === "in_progress"\s*\|\|\s*status === "revision"/);
  assert.doesNotMatch(page, /status === "file_check"\s*\|\|\s*status === "customer_info_needed"/);
});

test("customer order detail shows delivery estimates only when explicitly set", () => {
  const page = readProjectFile("src", "app", "dashboard", "orders", "[id]", "page.tsx");

  assert.match(page, /const deliveryEstimateLabels: Record<DeliveryEstimate, string>/);
  assert.match(page, /usually_30_min: "Usually around 30 min"/);
  assert.match(page, /same_day: "Same day"/);
  assert.match(page, /"24h": "24h"/);
  assert.match(page, /"48h": "48h"/);
  assert.match(page, /manual_review: "Manual review"/);
  assert.match(page, /getDeliveryEstimateDisplay\(order\.estimated_delivery_label\)/);
  assert.match(page, /label: label \?\? "Estimate not set yet"/);
  assert.match(page, /deliveryEstimate\.isExplicit[\s\S]*order\.estimated_delivery_note/);
  assert.match(page, /A delivery estimate will appear here after MG AutoTech reviews your request details\./);
  assert.match(page, /max-w-full break-words text-3xl font-black/);
  assert.doesNotMatch(page, /labels\[value as DeliveryEstimate\] \?\? labels\.usually_30_min/);
  assert.doesNotMatch(page, /formatDeliveryEstimate\(order\.estimated_delivery_label\)/);
});

test("legacy admin order modal requires an explicit delivery estimate before saving", () => {
  const adminPage = readProjectFile("src", "app", "admin", "page.tsx");

  assert.match(adminPage, /type DeliveryEstimateSelection = DeliveryEstimate \| ""/);
  assert.match(adminPage, /order\.estimated_delivery_label \?\? ""/);
  assert.match(adminPage, /"Estimate not set yet"/);
  assert.match(adminPage, /const hasExplicitDeliveryEstimate = deliveryEstimate !== ""/);
  assert.match(adminPage, /const canSaveDeliveryEstimate =[\s\S]*hasExplicitDeliveryEstimate && canManageOrders && !updating/);
  assert.match(adminPage, /formatDeliveryEstimate\(deliveryEstimate\)/);
  assert.match(adminPage, /Select an explicit estimate before saving\. No customer-visible time estimate is saved yet\./);
  assert.match(adminPage, /<option value="" disabled className="bg-\[#111\]"/);
  assert.match(adminPage, /Estimate not set - choose one/);
  assert.match(adminPage, /disabled=\{!hasExplicitDeliveryEstimate\}/);
  assert.match(adminPage, /disabled=\{!canSaveDeliveryEstimate\}/);
  assert.match(adminPage, /if \(!deliveryEstimate\) \{[\s\S]*return;[\s\S]*\}[\s\S]*onDeliveryUpdate\(deliveryEstimate, deliveryNote\)/);
  assert.match(adminPage, /order\.estimated_delivery_label \? order\.estimated_delivery_note \?\? "" : ""/);
  assert.doesNotMatch(adminPage, /order\.estimated_delivery_label \?\? "usually_30_min"/);
  assert.doesNotMatch(adminPage, /\?\?\s*"Usually around 30 min"/);
});

test("legacy admin dashboard shows retryable sync errors instead of empty queues", () => {
  const adminPage = readProjectFile("src", "app", "admin", "page.tsx");

  assert.match(adminPage, /const ADMIN_LOAD_ERROR_MESSAGE =/);
  assert.match(adminPage, /const ADMIN_SYNC_ERROR_MESSAGE =/);
  assert.match(adminPage, /Retry before treating the queue as empty/);
  assert.match(adminPage, /last loaded orders and customers are still shown/);
  assert.match(adminPage, /const \[adminLoadError, setAdminLoadError\]/);
  assert.match(adminPage, /const \[adminDataReady, setAdminDataReady\]/);
  assert.match(adminPage, /const hasLoadedAdminDataRef = useRef\(false\)/);
  assert.match(adminPage, /if \(error\) \{[\s\S]*setAdminLoadError\([\s\S]*hasLoadedAdminDataRef\.current \? ADMIN_SYNC_ERROR_MESSAGE : ADMIN_LOAD_ERROR_MESSAGE/);
  assert.match(adminPage, /if \(customerError\) \{[\s\S]*setAdminLoadError\([\s\S]*hasLoadedAdminDataRef\.current \? ADMIN_SYNC_ERROR_MESSAGE : ADMIN_LOAD_ERROR_MESSAGE/);
  assert.match(adminPage, /hasLoadedAdminDataRef\.current = true/);
  assert.match(adminPage, /setAdminDataReady\(true\)/);
  assert.match(adminPage, /if \(!hasLoadedAdminDataRef\.current\) return;\s*void loadAdminData\(\{ silent: true \}\);/);
  assert.match(adminPage, /const showInitialAdminLoadError = Boolean\(adminLoadError && !adminDataReady\)/);
  assert.match(adminPage, /showInitialAdminLoadError \? \(/);
  assert.match(adminPage, /<AdminLoadErrorState/);
  assert.match(adminPage, /role="alert"[\s\S]*Admin data sync failed/);
  assert.match(adminPage, /The queue is not shown until orders and customers load successfully/);
  assert.match(adminPage, /onRetry=\{\(\) => loadAdminData\(\)\}/);
  assert.match(adminPage, /adminLoadError && adminDataReady/);
  assert.match(adminPage, /Admin sync needs retry/);
  assert.match(adminPage, /onClick=\{\(\) => loadAdminData\(\)\}/);
  assert.doesNotMatch(adminPage, /if \(error\) \{\s*setMessage\(error\.message\);\s*setLoading\(false\);\s*setAutoRefreshing\(false\);/);
  assert.doesNotMatch(adminPage, /if \(customerError\) \{\s*setMessage\(customerError\.message\);/);
});

test("admin request control center shows retryable API load errors instead of empty filters", () => {
  const client = readProjectFile("src", "app", "admin", "requests", "AdminRequestsClient.tsx");
  const route = readProjectFile("src", "app", "api", "admin", "requests", "route.ts");

  assert.match(client, /const ADMIN_REQUESTS_LOAD_ERROR_MESSAGE =/);
  assert.match(client, /const ADMIN_REQUESTS_SYNC_ERROR_MESSAGE =/);
  assert.match(client, /const \[loadError, setLoadError\] = useState\(""\)/);
  assert.match(client, /const hasLoadedRequestsRef = useRef\(false\)/);
  assert.match(client, /if \(!response\.ok\) \{[\s\S]*throw new Error\(ADMIN_REQUESTS_LOAD_ERROR_MESSAGE\)/);
  assert.match(
    client,
    /setLoadError\([\s\S]*hasLoadedRequestsRef\.current \? ADMIN_REQUESTS_SYNC_ERROR_MESSAGE : ADMIN_REQUESTS_LOAD_ERROR_MESSAGE/
  );
  assert.match(client, /hasLoadedRequestsRef\.current = true/);
  assert.match(client, /const showInitialLoadError = Boolean\(loadError && !payload\)/);
  assert.match(client, /showInitialLoadError \? \(/);
  assert.match(client, /<AdminRequestsLoadErrorState/);
  assert.match(client, /role="alert"[\s\S]*Request queue sync failed/);
  assert.match(client, /The queue is not shown until work orders load successfully/);
  assert.match(client, /onRetry=\{\(\) => void load\(\)\}/);
  assert.match(client, /loadError && payload/);
  assert.match(client, /Admin request sync needs retry/);
  assert.match(client, /Your last loaded work-order queue is still shown/);
  assert.match(client, /Retry sync/);
  assert.match(client, /loading && !payload/);
  assert.match(route, /\{ error: "Admin requests could not be loaded\." \}/);
  assert.doesNotMatch(client, /setMessage\(result\.error/);
  assert.doesNotMatch(client + route, /error instanceof Error \? error\.message/);
  assert.doesNotMatch(client, /storage_path|signed_url|service_role|admin_note|customer_uploads|payment_records/i);
});

test("customer additional file upload shows phase-aware retry-safe feedback", () => {
  const page = readProjectFile("src", "app", "dashboard", "orders", "[id]", "page.tsx");

  assert.match(page, /type AdditionalUploadPhase = "idle" \| "preparing" \| "uploading" \| "verifying"/);
  assert.match(page, /const additionalUploadSteps/);
  assert.match(page, /Preparing upload/);
  assert.match(page, /Uploading file/);
  assert.match(page, /Verifying upload/);
  assert.match(page, /setAdditionalUploadPhase\("preparing"\)[\s\S]*additional-file\/prepare/);
  assert.match(page, /setAdditionalUploadPhase\("uploading"\)[\s\S]*\.upload\(prepared\.upload\.path, file/);
  assert.match(page, /setAdditionalUploadPhase\("verifying"\)[\s\S]*additional-file\/finalize/);
  assert.match(page, /finally\s*\{\s*setAdditionalUploadPhase\("idle"\);/);
  assert.match(page, /aria-busy=\{additionalUploading\}/);
  assert.match(page, /max-w-full break-words font-black/);
  assert.doesNotMatch(page, /Uploading additional file\.\.\./);
});

test("customer dashboard and order archive surface action-needed orders separately", () => {
  const dashboard = readProjectFile("src", "components", "dashboard", "DashboardClient.tsx");
  const orders = readProjectFile("src", "app", "dashboard", "orders", "page.tsx");

  assert.match(dashboard, /const \[needsResponseCount, setNeedsResponseCount\]/);
  assert.match(dashboard, /\.eq\("status", "customer_info_needed"\)/);
  assert.match(dashboard, /setNeedsResponseCount\(needsResponseOrders \?\? 0\)/);
  assert.match(dashboard, /href="\/dashboard\/orders\?view=needs_response"/);
  assert.match(dashboard, /Needs Response/);
  assert.match(dashboard, /Waiting for your information/);

  assert.match(orders, /type View = "active" \| "needs_response" \| "completed" \| "cancelled" \| "all"/);
  assert.match(orders, /value: "needs_response"/);
  assert.match(orders, /selectedView === "needs_response"[\s\S]*\.eq\("status", "customer_info_needed"\)/);
  assert.match(orders, /window\.history\.replaceState/);
  assert.match(orders, /Needs your response/);
  assert.match(orders, /Revision review in progress/);
  assert.match(orders, /active=\{\["completed", "cancelled", "all"\]\.includes\(view\)\}/);
});

test("customer dashboard load errors show retry without replacing last good data", () => {
  const dashboard = readProjectFile("src", "components", "dashboard", "DashboardClient.tsx");

  assert.match(dashboard, /const DASHBOARD_LOAD_ERROR_MESSAGE =/);
  assert.match(dashboard, /const DASHBOARD_SYNC_ERROR_MESSAGE =/);
  assert.match(dashboard, /const \[dashboardLoadError, setDashboardLoadError\]/);
  assert.match(dashboard, /const \[dashboardReady, setDashboardReady\]/);
  assert.match(dashboard, /const \[dashboardRefreshKey, setDashboardRefreshKey\]/);
  assert.match(dashboard, /const hasLoadedDashboardRef = useRef\(false\)/);
  assert.match(dashboard, /error: profileError/);
  assert.match(dashboard, /error: recentOrdersError/);
  assert.match(dashboard, /error: transactionRowsError/);
  assert.match(dashboard, /error: allOrdersError/);
  assert.match(dashboard, /error: needsResponseOrdersError/);
  assert.match(dashboard, /const queryFailed =[\s\S]*profileError[\s\S]*recentOrdersError[\s\S]*transactionRowsError[\s\S]*cancelledOrdersError/);
  assert.match(dashboard, /if \(queryFailed\) \{[\s\S]*setDashboardLoadError/);
  assert.match(dashboard, /hasLoadedDashboardRef\.current \|\| silent[\s\S]*DASHBOARD_SYNC_ERROR_MESSAGE[\s\S]*DASHBOARD_LOAD_ERROR_MESSAGE/);
  assert.match(dashboard, /setOrders\(\(recentOrders \?\? \[\]\) as Order\[\]\)/);
  assert.match(dashboard, /setCreditTransactions\(\(transactionRows \?\? \[\]\) as CreditTransaction\[\]\)/);
  assert.match(dashboard, /setDashboardReady\(true\)/);
  assert.match(dashboard, /hasLoadedDashboardRef\.current = true/);
  assert.match(dashboard, /finally \{[\s\S]*setLiveRefreshing\(false\)/);
  assert.match(dashboard, /const retryDashboardLoad = \(\) => \{/);
  assert.match(dashboard, /setDashboardRefreshKey\(\(current\) => current \+ 1\)/);
  assert.match(dashboard, /dashboardLoadError && !dashboardReady/);
  assert.match(dashboard, /Dashboard sync failed/);
  assert.match(dashboard, /role="alert"[\s\S]*\{dashboardLoadError\}/);
  assert.match(dashboard, /onClick=\{retryDashboardLoad\}/);
  assert.match(dashboard, /Try again/);
  assert.match(dashboard, /dashboardLoadError && dashboardReady/);
  assert.match(dashboard, /Your last loaded data is still shown/);
  assert.doesNotMatch(dashboard, /profileError\.message|recentOrdersError\.message|transactionRowsError\.message|allOrdersError\.message/);
  assert.doesNotMatch(dashboard, /storage_path|signed_url|service_role|admin_note|metadata/);
});

test("customer dashboard surfaces missing profile details without changing settings flow", () => {
  const dashboard = readProjectFile("src", "components", "dashboard", "DashboardClient.tsx");
  const settings = readProjectFile("src", "app", "dashboard", "settings", "page.tsx");

  assert.match(dashboard, /type DashboardProfile = \{/);
  assert.match(dashboard, /full_name, account_type, company_name, phone, street, postal_code, city, country, invoice_email, preferred_contact/);
  assert.match(dashboard, /const \[profileMissingItems, setProfileMissingItems\]/);
  assert.match(dashboard, /getProfileCompletionMissingItems\(dashboardProfile\)/);
  assert.match(dashboard, /profileMissingItems\.length > 0/);
  assert.match(dashboard, /Complete your customer profile/);
  assert.match(dashboard, /Phone \/ WhatsApp contact/);
  assert.match(dashboard, /Invoice e-mail/);
  assert.match(dashboard, /Company \/ workshop name/);
  assert.match(dashboard, /Billing address/);
  assert.match(dashboard, /href="\/dashboard\/settings"/);
  assert.match(dashboard, /max-w-full break-words rounded-full/);

  assert.match(settings, /\.update\(\{\s*[\s\S]*full_name: fullName\.trim\(\) \|\| null/);
  assert.match(settings, /invoice_email: invoiceEmail\.trim\(\) \|\| email/);
  assert.match(settings, /preferred_contact: preferredContact/);
});

test("customer widget dashboard blocks duplicate pending domain-change requests", () => {
  const widgetDashboard = readProjectFile("src", "components", "dashboard", "WidgetDashboardClient.tsx");

  assert.match(widgetDashboard, /const pendingDomainRequest = payload\?\.domainRequests\?\.find\(\(item\) => item\.status === "pending"\) \?\? null/);
  assert.match(widgetDashboard, /const hasPendingDomainRequest = Boolean\(pendingDomainRequest\)/);
  assert.match(widgetDashboard, /if \(hasPendingDomainRequest\) \{ setMessage\("Your domain change request is already waiting for admin review\."\); return; \}/);
  assert.match(widgetDashboard, /Pending admin review/);
  assert.match(widgetDashboard, /pendingDomainRequest\.requested_domain/);
  assert.match(widgetDashboard, /A new request can be sent after this one is approved or rejected\./);
  assert.match(widgetDashboard, /disabled=\{hasPendingDomainRequest\}/);
  assert.match(widgetDashboard, /aria-describedby=\{hasPendingDomainRequest \? "pending-domain-request" : undefined\}/);
  assert.match(widgetDashboard, /disabled=\{hasPendingDomainRequest \|\| !domainRequest\.trim\(\)\}/);
  assert.match(widgetDashboard, /payload\.domainRequests\?\.map/);
  assert.doesNotMatch(widgetDashboard, /widget_audit_logs|actor_user_id|old_domain/);
});

test("customer widget dashboard shows retryable load errors without plan fallback", () => {
  const widgetDashboard = readProjectFile("src", "components", "dashboard", "WidgetDashboardClient.tsx");

  assert.match(widgetDashboard, /const WIDGET_LOAD_ERROR_MESSAGE = "Widget workspace could not be synced\. Please try again\."/);
  assert.match(widgetDashboard, /const \[widgetLoadError, setWidgetLoadError\]/);
  assert.match(widgetDashboard, /setWidgetLoadError\(""\);[\s\S]*\/api\/widget\/client/);
  assert.match(widgetDashboard, /if \(!response\.ok\) throw new Error\(WIDGET_LOAD_ERROR_MESSAGE\)/);
  assert.match(widgetDashboard, /catch \{ setWidgetLoadError\(WIDGET_LOAD_ERROR_MESSAGE\); \}/);
  assert.match(widgetDashboard, /const showInitialWidgetLoadError = Boolean\(widgetLoadError && !client && !payload\)/);
  assert.match(widgetDashboard, /if \(showInitialWidgetLoadError\) return/);
  assert.match(widgetDashboard, /role="alert"[\s\S]*Widget workspace sync failed/);
  assert.match(widgetDashboard, /Your widget subscription status has not changed/);
  assert.match(widgetDashboard, /onClick=\{\(\) => void load\(\)\}/);
  assert.match(widgetDashboard, /Try again/);
  assert.match(widgetDashboard, /No widget subscription is linked to this account/);
  assert.match(widgetDashboard, /View plans/);
  assert.match(widgetDashboard, /widgetLoadError && <div role="alert"[\s\S]*Your last loaded widget settings are still shown/);
  assert.match(widgetDashboard, /Retry sync/);
  assert.doesNotMatch(widgetDashboard, /throw new Error\(data\.error/);
  assert.doesNotMatch(widgetDashboard, /setMessage\(error instanceof Error \? error\.message/);
  assert.doesNotMatch(widgetDashboard, /stripe_customer_id|widget_audit_logs|service_role|admin_note/);
});

test("admin widget clients list surfaces pending domain review signals safely", () => {
  const route = readProjectFile("src", "app", "api", "admin", "widget-clients", "route.ts");
  const page = readProjectFile("src", "app", "admin", "widget-clients", "page.tsx");

  assert.match(route, /\.from\("widget_domain_change_requests"\)/);
  assert.match(route, /\.select\("client_id, requested_domain, created_at"\)/);
  assert.match(route, /\.eq\("status", "pending"\)/);
  assert.match(route, /pending_domain_request_count/);
  assert.match(route, /latest_requested_domain/);
  assert.doesNotMatch(route, /admin_note|old_domain|widget_audit_logs|actor_user_id|resolved_at/);

  assert.match(page, /pending_domain_request_count: number/);
  assert.match(page, /latest_requested_domain: string \| null/);
  assert.match(page, /Pending domain requests/);
  assert.match(page, /Domain review/);
  assert.match(page, /PendingDomainSignal/);
  assert.match(page, /href=\{`\/admin\/widget-clients\/\$\{clientId\}`\}/);
  assert.match(page, /pending domain request domain review/);
  assert.match(page, /label="Pending"/);
  assert.doesNotMatch(page, /admin_note|old_domain|widget_audit_logs|actor_user_id/);
});

test("request chat composer exposes and enforces the API message length contract", () => {
  const chat = readProjectFile("src", "components", "RequestChat.tsx");
  const route = readProjectFile("src", "app", "api", "requests", "[id]", "messages", "route.ts");

  assert.match(route, /z\.string\(\)\.trim\(\)\.min\(1\)\.max\(4000\)/);
  assert.match(route, /Message must be between 1 and 4000 characters\./);
  assert.match(chat, /const MESSAGE_MAX_LENGTH = 4000/);
  assert.match(chat, /const charactersRemaining = MESSAGE_MAX_LENGTH - message\.length/);
  assert.match(chat, /const canSendMessage =[\s\S]*message\.trim\(\)\.length > 0[\s\S]*message\.length <= MESSAGE_MAX_LENGTH/);
  assert.match(chat, /maxLength=\{MESSAGE_MAX_LENGTH\}/);
  assert.match(chat, /aria-describedby="request-chat-message-help request-chat-message-limit"/);
  assert.match(chat, /disabled=\{!canSendMessage\}/);
  assert.match(chat, /id="request-chat-message-limit"/);
  assert.match(chat, /aria-live="polite"/);
  assert.match(chat, /\{charactersRemaining\} characters remaining/);
  assert.match(chat, /Press Enter to send/);
  assert.match(chat, /Shift \+ Enter for a new line/);
  assert.doesNotMatch(chat, /disabled=\{sending \|\| !message\.trim\(\)\}/);
});

test("customer notifications show retryable loading and error states", () => {
  const notifications = readProjectFile("src", "components", "CustomerNotifications.tsx");

  assert.match(notifications, /const \[notificationLoading, setNotificationLoading\]/);
  assert.match(notifications, /const \[notificationLoadError, setNotificationLoadError\]/);
  assert.match(notifications, /const \[notificationRefreshKey, setNotificationRefreshKey\]/);
  assert.match(notifications, /\.from\("notifications"\)/);
  assert.match(notifications, /\.eq\("user_id", userId\)/);
  assert.match(notifications, /if \(error\) \{[\s\S]*setNotificationLoadError\("Notifications could not be loaded\. Please try again\."\)/);
  assert.match(notifications, /setNotificationLoading\(false\);[\s\S]*setNotificationLoadError\(null\);[\s\S]*knownIds\.current = new Set/);
  assert.match(notifications, /function retryNotificationLoad\(\)/);
  assert.match(notifications, /setNotificationRefreshKey\(\(current\) => current \+ 1\)/);
  assert.match(notifications, /role="status" aria-live="polite"/);
  assert.match(notifications, /Loading notifications\.\.\./);
  assert.match(notifications, /role="alert"/);
  assert.match(notifications, /Notification sync failed/);
  assert.match(notifications, /onClick=\{retryNotificationLoad\}/);
  assert.match(notifications, /Try again/);
  assert.match(notifications, /notificationLoadError && items\.length === 0[\s\S]*No notifications yet\./);
  assert.match(notifications, /break-words font-black text-white/);
  assert.match(notifications, /\.update\(\{ read_at: readAt \}\)\.in\("id", ids\)\.eq\("user_id", userId\)/);
  assert.doesNotMatch(notifications, /storage_path|signed_url|service_role|admin_note|metadata/);
});

test("customer dashboard credit history preview uses the customer credit ledger", () => {
  const dashboard = readProjectFile("src", "components", "dashboard", "DashboardClient.tsx");

  assert.match(dashboard, /type CreditTransaction = \{/);
  assert.match(dashboard, /const \[creditTransactions, setCreditTransactions\]/);
  assert.match(dashboard, /\.from\("credit_transactions"\)/);
  assert.match(
    dashboard,
    /\.select\("id, user_id, type, credits_delta, balance_after, description, created_at"\)/
  );
  assert.match(dashboard, /\.eq\("user_id", userId\)/);
  assert.match(dashboard, /\.order\("created_at", \{ ascending: false \}\)/);
  assert.match(dashboard, /\.limit\(6\)/);
  assert.match(dashboard, /return creditTransactions\.slice\(0, 6\)/);
  assert.match(dashboard, /item\.description \|\| typeLabel/);
  assert.match(dashboard, /item\.balance_after !== null/);
  assert.match(dashboard, /isPositive \? "text-emerald-400" : "text-red-500"/);
  assert.match(dashboard, /No credit ledger movements yet/);
  assert.match(dashboard, /href="\/dashboard\/credits"/);
  assert.match(dashboard, /href="\/dashboard\/credits\/history"/);
  assert.doesNotMatch(dashboard, /return orders[\s\S]*credits_required[\s\S]*slice\(0, 6\)/);
  assert.doesNotMatch(dashboard, /source_id|metadata/);
});

test("customer credit ledger history shows retryable load errors", () => {
  const page = readProjectFile("src", "app", "dashboard", "credits", "history", "page.tsx");

  assert.match(page, /const CREDIT_LEDGER_LOAD_ERROR_MESSAGE =/);
  assert.match(page, /const CREDIT_LEDGER_SYNC_ERROR_MESSAGE =/);
  assert.match(page, /const \[ledgerLoadError, setLedgerLoadError\]/);
  assert.match(page, /const \[ledgerReady, setLedgerReady\]/);
  assert.match(page, /const hasLoadedLedgerRef = useRef\(false\)/);
  assert.match(page, /error: profileError/);
  assert.match(page, /error: transactionRowsError/);
  assert.match(page, /if \(profileError \|\| transactionRowsError\) \{/);
  assert.match(
    page,
    /setLedgerLoadError\([\s\S]*hasLoadedLedgerRef\.current[\s\S]*CREDIT_LEDGER_SYNC_ERROR_MESSAGE[\s\S]*CREDIT_LEDGER_LOAD_ERROR_MESSAGE/
  );
  assert.match(page, /setTransactions\(\(transactionRows \?\? \[\]\) as CreditTransaction\[\]\)/);
  assert.match(page, /setLedgerReady\(true\)/);
  assert.match(page, /hasLoadedLedgerRef\.current = true/);
  assert.match(page, /finally \{[\s\S]*setLoading\(false\);[\s\S]*setRefreshing\(false\);/);
  assert.match(page, /const showInitialLedgerLoadError = Boolean\(ledgerLoadError && !ledgerReady\)/);
  assert.match(page, /showInitialLedgerLoadError \? \(/);
  assert.match(page, /role="alert"[\s\S]*Credit ledger sync failed/);
  assert.match(page, /onClick=\{\(\) => loadHistory\(\)\}/);
  assert.match(page, /Try again/);
  assert.match(page, /ledgerLoadError && ledgerReady/);
  assert.match(page, /Your last loaded balance and movements are still shown/);
  assert.match(page, /No credit ledger yet/);
  assert.doesNotMatch(page, /error\.message|profileError\.message|transactionRowsError\.message/);
  assert.doesNotMatch(page, /credit_transactions ledger table|metadata|storage_path|signed_url|service_role|admin_note/);
});

test("admin completed-today metric uses delivered file timestamps before request creation", () => {
  const adminPage = readProjectFile("src", "app", "admin", "page.tsx");

  assert.match(adminPage, /countCompletedToday\(orders\)/);
  assert.doesNotMatch(adminPage, /order\.created_at\)[\s\S]*return orderDay === todayKey/);

  assert.equal(
    countCompletedToday(
      [
        {
          status: "completed",
          created_at: "2026-07-10T09:00:00.000Z",
          modified_files: [{ uploaded_at: "2026-07-12T08:00:00.000Z" }],
        },
        {
          status: "completed",
          created_at: "2026-07-12T09:00:00.000Z",
          modified_files: [{ uploaded_at: "2026-07-11T18:00:00.000Z" }],
        },
        {
          status: "completed",
          created_at: "2026-07-12T10:00:00.000Z",
          modified_files: [],
        },
        {
          status: "completed",
          created_at: "2026-07-12T11:00:00.000Z",
          modified_files: null,
        },
        {
          status: "in_progress",
          created_at: "2026-07-12T12:00:00.000Z",
          modified_files: [{ uploaded_at: "2026-07-12T12:30:00.000Z" }],
        },
      ],
      new Date("2026-07-12T12:00:00.000Z")
    ),
    3
  );
});

test("customer File Expert intake shows upload limits before prepare", () => {
  const page = readProjectFile("src", "app", "dashboard", "file-expert", "page.tsx");
  const limits = readProjectFile("src", "lib", "fileExpert", "limits.ts");
  const prepareRoute = readProjectFile("src", "app", "api", "file-expert", "jobs", "prepare", "route.ts");

  assert.match(limits, /brand:\s*100/);
  assert.match(limits, /model:\s*100/);
  assert.match(limits, /engine:\s*100/);
  assert.match(limits, /ecuType:\s*120/);
  assert.match(limits, /customerNotes:\s*2000/);
  assert.match(limits, /fileExpertAllowedExtensions = \["\.bin", "\.ori", "\.mod", "\.frf", "\.hex", "\.zip"\]/);
  assert.match(limits, /fileExpertMaxFileSize = 32 \* 1024 \* 1024/);
  assert.match(limits, /fileExpertMaxFileSizeLabel = "32 MB"/);

  assert.match(prepareRoute, /fileExpertTextLimits/);
  assert.match(prepareRoute, /\.max\(fileExpertTextLimits\.brand\)/);
  assert.match(prepareRoute, /\.max\(fileExpertTextLimits\.customerNotes\)/);

  assert.match(page, /fileExpertFileRequirements/);
  assert.match(page, /Allowed files:/);
  assert.match(page, /Maximum \$\{fileExpertMaxFileSizeLabel\} per file/);
  assert.match(page, /validateFileExpertSelection/);
  assert.match(page, /file\.size === 0/);
  assert.match(page, /file\.size > fileExpertMaxFileSize/);
  assert.match(page, /fileExpertAllowedExtensions\.some/);
  assert.match(page, /Unsupported file type/);
  assert.match(page, /handleFileSelection\("ori", file\)/);
  assert.match(page, /handleFileSelection\("mod", file\)/);
  assert.match(page, /accept=\{fileExpertAccept\}/);
  assert.match(page, /event\.currentTarget\.value = ""/);

  assert.match(page, /maxLength=\{fileExpertTextLimits\.brand\}/);
  assert.match(page, /maxLength=\{fileExpertTextLimits\.model\}/);
  assert.match(page, /maxLength=\{fileExpertTextLimits\.engine\}/);
  assert.match(page, /maxLength=\{fileExpertTextLimits\.ecuType\}/);
  assert.match(page, /maxLength=\{fileExpertTextLimits\.customerNotes\}/);
  assert.match(page, /CharacterLimitHint/);
  assert.match(page, /Select at least one valid ORI or MOD file before starting analysis/);
  assert.match(page, /setMessage\("Please upload at least one valid ORI or MOD file\."\)/);
  assert.match(page, /disabled=\{!canSubmitAnalysis\}/);
  assert.match(page, /if \(textLimitError\) \{[\s\S]*setMessage\(textLimitError\)/);
  assert.match(page, /if \(!oriFile && !modFile\) \{[\s\S]*fetch\("\/api\/file-expert\/jobs\/prepare"/);
});

test("customer File Expert UI renders only customer-safe report details", () => {
  const page = readProjectFile("src", "app", "dashboard", "file-expert", "[id]", "page.tsx");
  assert.match(page, /Technical coordinate data, private file fingerprints and binary internals are hidden on customer reports/);
  assert.match(page, /Human tuner verification remains required/);
  assert.match(page, /does not approve this file for writing/);
  assert.match(page, /formatSafeFileProfile/);
  assert.match(page, /safeReportText/);
  assert.doesNotMatch(page, /isAdmin/);
  assert.doesNotMatch(page, /SHA256|Copy JSON|Download report data|Analyzer JSON|changed_blocks\.slice|offset_start|offset_end|provider\/source/i);
});

test("How It Works page is English, SEO-ready and linked from public surfaces", () => {
  const page = readProjectFile("src", "app", "how-it-works", "page.tsx");
  const homepage = readProjectFile("src", "app", "page.tsx");
  const footer = readProjectFile("src", "components", "Footer.tsx");
  const header = readProjectFile("src", "components", "PublicSeoHeader.tsx");
  const sitemap = readProjectFile("src", "app", "sitemap.ts");

  assert.match(page, /title:\s*copy\.pageTitle/);
  assert.match(page, /canonical:\s*"\/how-it-works"/);
  assert.match(page, /openGraph/);
  assert.match(page, /howItWorksJsonLd/);
  assert.match(page, /languageAlternates\("\/how-it-works"\)/);
  assert.doesNotMatch(page, /Anfrage|Kunden|Datei|hochladen|öffnen|bearbeitet/i);

  assert.match(homepage, /A Clear File-Service Workflow/);
  assert.match(homepage, /See How It Works/);
  assert.match(homepage, /href="\/how-it-works"/);
  assert.match(footer, /How It Works/);
  assert.match(header, /How it works/);
  assert.match(sitemap, /absoluteUrl\("\/how-it-works"\)/);
});

test("How It Works localization is wired for locale routes, homepage and footer", () => {
  const localizedPage = readProjectFile("src", "app", "[locale]", "how-it-works", "page.tsx");
  const copy = readProjectFile("src", "lib", "howItWorksI18n.ts");
  const localizedHomeRoute = readProjectFile("src", "app", "[locale]", "page.tsx");
  const localizedHome = readProjectFile("src", "components", "LocalizedSeoHome.tsx");
  const localizedFooter = readProjectFile("src", "components", "LocalizedSeoFooter.tsx");
  const sitemap = readProjectFile("src", "app", "sitemap.ts");

  assert.match(localizedPage, /generateStaticParams/);
  assert.match(localizedPage, /localizedUrl\(locale, "\/how-it-works"\)/);
  assert.match(localizedPage, /languageAlternates\("\/how-it-works"\)/);
  assert.match(localizedPage, /HowItWorksPageContent/);
  assert.match(copy, /How MG AutoTech File Service Works/);
  assert.match(copy, /So funktioniert der MG AutoTech File-Service/);
  assert.match(copy, /MG AutoTech File Service Nasıl Çalışır/);
  assert.match(copy, /Does the system automatically modify files\?/);
  assert.match(copy, /Ändert das System Dateien automatisch\?/);
  assert.match(copy, /Sistem dosyaları otomatik değiştirir mi\?/);
  assert.match(localizedHomeRoute, /LocalizedSeoHome/);
  assert.doesNotMatch(localizedHomeRoute, /import HomePage|<HomePage/);
  assert.match(localizedHome, /getHowItWorksCopy/);
  assert.match(localizedHome, /localizedPath\(locale, "\/how-it-works"\)/);
  assert.match(localizedFooter, /localizedPath\(locale, "\/how-it-works"\)/);
  assert.match(sitemap, /localizedUrl\(locale, "\/how-it-works"\)/);
  assert.match(sitemap, /languageAlternates\("\/how-it-works"\)/);
});

test("Windows upload assistant public page is beta-gated and exposes no installer", () => {
  const page = readProjectFile("src", "app", "download", "windows", "page.tsx");
  const footer = readProjectFile("src", "components", "Footer.tsx");

  assert.match(page, /Windows upload app is being prepared for selected beta customers/i);
  assert.match(page, /Public download is not enabled yet/i);
  assert.match(page, /There is no direct installer link/i);
  assert.match(page, /robots:\s*\{\s*index:\s*false,\s*follow:\s*true\s*\}/);
  assert.match(page, /Use Web Upload/);
  assert.match(page, /Request Beta Access/);
  assert.match(page, /does not modify files/);
  assert.match(footer, /Windows App Beta/);
  assert.match(footer, /\/download\/windows/);
  assert.doesNotMatch(page, /\.exe|\.msi|release\/|win-unpacked|portable|nsis/i);
});

test("ECU file readiness checker is public, useful and does not upload files", () => {
  const page = readProjectFile("src", "app", "tools", "file-readiness-check", "page.tsx");
  const assistant = readProjectFile("src", "components", "tools", "FileReadinessAssistant.tsx");
  const tools = readProjectFile("src", "app", "tools", "page.tsx");

  assert.match(page, /ECU File Readiness Check/);
  assert.match(page, /without reading, uploading or modifying any file/i);
  assert.match(page, /applicationCategory:\s*"UtilitiesApplication"/);
  assert.match(page, /FAQPage/);
  assert.match(assistant, /Ready to submit/);
  assert.match(assistant, /Needs preparation/);
  assert.match(assistant, /Start Secure Request/);
  assert.match(assistant, /Customer safety: no file picker, no upload session, no raw data, no checksum, no MOD generation/);
  assert.match(tools, /\/tools\/file-readiness-check/);
  assert.match(tools, /Check readiness/);
  assert.doesNotMatch(assistant, /type="file"|upload-session|createObjectURL|FileReader|fetch\(|generateMod|bytePatch|writeFile/i);
});

test("ECU request brief builder creates copy-ready notes without backend side effects", () => {
  const page = readProjectFile("src", "app", "tools", "request-brief-builder", "page.tsx");
  const builder = readProjectFile("src", "components", "tools", "RequestBriefBuilder.tsx");
  const tools = readProjectFile("src", "app", "tools", "page.tsx");

  assert.match(page, /ECU Request Brief Builder/);
  assert.match(page, /No file upload, no automation, no hidden server action/);
  assert.match(page, /applicationCategory:\s*"UtilitiesApplication"/);
  assert.match(page, /FAQPage/);
  assert.match(builder, /MG AutoTech request brief/);
  assert.match(builder, /Brief completeness/);
  assert.match(builder, /Generated request brief/);
  assert.match(builder, /navigator\.clipboard\.writeText/);
  assert.match(builder, /does not upload files, inspect binary data, create a request or contact MG AutoTech automatically/);
  assert.match(tools, /\/tools\/request-brief-builder/);
  assert.match(tools, /Build a brief/);
  assert.doesNotMatch(builder, /type="file"|upload-session|api\/admin|fetch\(|createObjectURL|FileReader|generateMod|bytePatch|writeFile/i);
});

test("ECU read method advisor gives safe preparation guidance without file actions", () => {
  const page = readProjectFile("src", "app", "tools", "ecu-read-method-advisor", "page.tsx");
  const advisor = readProjectFile("src", "components", "tools", "EcuReadMethodAdvisor.tsx");
  const tools = readProjectFile("src", "app", "tools", "page.tsx");

  assert.match(page, /ECU Read Method Advisor/);
  assert.match(page, /without opening or uploading a file/);
  assert.match(page, /applicationCategory:\s*"UtilitiesApplication"/);
  assert.match(page, /FAQPage/);
  assert.match(advisor, /Good read preparation/);
  assert.match(advisor, /Read preparation checklist/);
  assert.match(advisor, /Build Request Brief/);
  assert.match(advisor, /Customer safety: no file picker, no upload session, no binary analysis, no checksum, no file generation/);
  assert.match(tools, /\/tools\/ecu-read-method-advisor/);
  assert.match(tools, /Plan read method/);
  assert.doesNotMatch(advisor, /type="file"|upload-session|api\/admin|fetch\(|createObjectURL|FileReader|generateMod|bytePatch|writeFile/i);
});

test("active customer payment UI remains Stripe/Card and Bank Transfer only", () => {
  const page = readProjectFile("src", "app", "dashboard", "credits", "page.tsx");
  assert.match(page, /id: "stripe"/);
  assert.match(page, /id: "bank"/);
  assert.doesNotMatch(page, /id:\s*"paypal"|PayPal checkout|paypalClient/i);
});

test("admin bank payment form validates the API contract before posting", () => {
  const page = readProjectFile("src", "app", "admin", "payments", "page.tsx");

  assert.match(page, /const BANK_PAYMENT_LIMITS = \{/);
  assert.match(page, /referenceMin: 3/);
  assert.match(page, /referenceMax: 160/);
  assert.match(page, /creditsMax: 100000/);
  assert.match(page, /amountEuroMax: 1000000/);
  assert.match(page, /noteMax: 1000/);
  assert.match(page, /getBankPaymentValidation\(bankForm, data\?\.customers \?\? \[\]\)/);
  assert.match(page, /if \(!bankFormValidation\.isValid\)/);
  assert.match(page, /const canRecordBankPayment = Boolean\(data\?\.migrationReady\) && bankFormValidation\.isValid && !saving/);
  assert.match(page, /maxLength=\{BANK_PAYMENT_LIMITS\.referenceMax\}/);
  assert.match(page, /max=\{BANK_PAYMENT_LIMITS\.creditsMax\}/);
  assert.match(page, /max=\{BANK_PAYMENT_LIMITS\.amountEuroMax\}/);
  assert.match(page, /maxLength=\{BANK_PAYMENT_LIMITS\.noteMax\}/);
  assert.match(page, /Complete the bank payment contract before posting/);
  assert.match(page, /disabled=\{!canRecordBankPayment\}/);
  assert.match(page, /action: "record_bank_payment"[\s\S]*customerUserId: bankForm\.customerUserId[\s\S]*reference: bankForm\.reference[\s\S]*credits: Number\(bankForm\.credits\)[\s\S]*amountEuro: Number\(bankForm\.amountEuro\)[\s\S]*note: bankForm\.note\.trim\(\) \|\| null/);
  assert.doesNotMatch(page, /STRIPE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|admin_record_bank_payment\(/);
});

test("PayPal routes stay disabled with 410 Gone", async () => {
  const create = await import("../src/app/api/paypal/create-order/route");
  const capture = await import("../src/app/api/paypal/capture-order/route");
  assert.equal((await create.POST()).status, 410);
  assert.equal((await capture.POST()).status, 410);
});

test("AI file intelligence roadmap keeps generation behind future safety gates", () => {
  const roadmap = readProjectFile("docs", "ai-file-intelligence-roadmap.md");
  assert.match(roadmap, /No automatic MOD generation/i);
  assert.match(roadmap, /Level 3: Map Definition Layer/i);
  assert.match(roadmap, /Level 6: Human-Approved Draft MOD Export/i);
  assert.match(roadmap, /AI-assisted evidence and review support/i);
});

test("i18n and SEO health script catches core multilingual requirements", () => {
  const script = readProjectFile("scripts", "check-i18n-seo.mjs");
  assert.match(script, /expectedLocales/);
  assert.match(script, /language alternates/i);
  assert.doesNotMatch(script, /SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|RESEND_API_KEY/);
  const output = execFileSync(process.execPath, ["scripts/check-i18n-seo.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.match(output, /i18n\/SEO check passed/);
});
