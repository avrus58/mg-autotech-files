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
  const source = readFileSync(resolve(process.cwd(), ...segments), "utf8");
  if (segments.join("/") !== "src/app/page.tsx") return source;
  return [
    source,
    readFileSync(
      resolve(process.cwd(), "src", "components", "homepage", "HomepageExperience.tsx"),
      "utf8"
    ),
    readFileSync(
      resolve(process.cwd(), "src", "components", "homepage", "VehicleIntelligence.tsx"),
      "utf8"
    ),
  ].join("\n");
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

test("new request summary names selected extra services before submit", () => {
  const page = readProjectFile("src", "app", "new-request", "page.tsx");

  assert.match(page, /const selectedExtraServices = useMemo/);
  assert.match(page, /selectedExtras[\s\S]*\.map\(\(id\) => extraServices\.find\(\(service\) => service\.id === id\)\)/);
  assert.match(page, /filter\(\(service\): service is ExtraService => Boolean\(service\)\)/);
  assert.match(page, /const extrasCredits = selectedExtraServices\.reduce/);
  assert.match(page, /const extras = selectedExtraServices\.map\(\(service\) => service\.title\)/);
  assert.match(page, /selectedExtraServices\.map\(\(service\) =>/);
  assert.match(page, /localizeServiceLabel\(locale, service\.title\)/);
  assert.match(page, /\{service\.credits\} cr/);
  assert.match(page, /None selected/);
  assert.match(page, /\{selectedExtras\.length\}/);
  assert.doesNotMatch(
    page,
    /storage_path|signed_url|service_role|SUPABASE_SERVICE_ROLE_KEY|admin_notes|internal_notes|source_reference|confidence_score/i
  );
});

test("new request summary shows a live submit readiness checklist", () => {
  const page = readProjectFile("src", "app", "new-request", "page.tsx");

  assert.match(page, /const hasRequestVehicle = Boolean/);
  assert.match(page, /const hasValidSelectedFile = Boolean/);
  assert.match(page, /hasUpload: hasValidSelectedFile/);
  assert.match(page, /const submissionChecklist = \[/);
  assert.match(page, /Vehicle and engine selected/);
  assert.match(page, /Original file attached/);
  assert.match(page, /Credits verified/);
  assert.match(page, /Credit use accepted/);
  assert.match(page, /Responsibility confirmed/);
  assert.match(page, /Submit Readiness/);
  assert.match(page, /completedSubmissionChecklistItems/);
  assert.match(page, /const isRequestReadyForSubmit = submissionChecklist\.every/);
  assert.match(page, /disabled=\{awaitingConsentAfterSuccess \|\| submitting \|\| !isRequestReadyForSubmit\}/);
  assert.match(page, /Complete Required Steps/);
  assert.match(page, /Please upload your original ECU \/ TCU file\./);
  assert.match(page, /Please accept payment and responsibility confirmation\./);
  assert.doesNotMatch(
    page,
    /storage_path|signed_url|service_role|SUPABASE_SERVICE_ROLE_KEY|admin_notes|internal_notes|source_reference|confidence_score/i
  );
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
  assert.match(page, /deliveryEstimate\.isExplicit && \(/);
  assert.match(page, /ETA: \{deliveryEstimate\.label\}/);
  assert.match(page, /order\.estimated_delivery_note \? <> - <span translate="no" data-no-translate>\{order\.estimated_delivery_note\}<\/span><\/> : null/);
  assert.doesNotMatch(page, /A delivery estimate will appear here after MG AutoTech reviews your request details\./);
  assert.doesNotMatch(page, /labels\[value as DeliveryEstimate\] \?\? labels\.usually_30_min/);
  assert.doesNotMatch(page, /formatDeliveryEstimate\(order\.estimated_delivery_label\)/);
});

test("customer order detail keeps queue internals out of the customer workspace", () => {
  const page = readProjectFile("src", "app", "dashboard", "orders", "[id]", "page.tsx");
  const route = readProjectFile("src", "app", "api", "requests", "[id]", "queue", "route.ts");

  assert.match(route, /requireApiUser\(request\)/);
  assert.match(route, /getCustomerRequestQueueProjection\(id, auth\.user\.id\)/);
  assert.doesNotMatch(page, /CustomerRequestQueueProjection/);
  assert.doesNotMatch(page, /queueProjection|CustomerQueuePanel/);
  assert.doesNotMatch(page, /\/api\/requests\/\$\{orderId\}\/queue/);
  assert.doesNotMatch(page, /Live queue & ETA|Queue state|Payment review/);
  assert.doesNotMatch(
    page + route,
    /request_internal_notes|internal_notes|risk_flags|training_sample_id|private_offsets|hex_preview|signed_url|storage_path|hash/i
  );
});

test("customer order detail provides a safe support summary copy action", () => {
  const page = readProjectFile("src", "app", "dashboard", "orders", "[id]", "page.tsx");
  const helper = page.match(/function buildCustomerSupportSummary[\s\S]*?\r?\n}\r?\n/)?.[0] ?? "";

  assert.match(page, /function buildCustomerSupportSummary\(order: Order \| null, fallbackId: string, locale: LocaleCode\)/);
  assert.match(helper, /customerWorkflowT\(locale, "supportSummary"/);
  assert.match(helper, /requestId: shortId\(order\.id \|\| fallbackId\)/);
  assert.match(helper, /status: localizeCustomerOrderStatus\(locale, order\.status\)/);
  assert.match(helper, /vehicle: vehicleSummary/);
  assert.match(helper, /service: order\.service_type/);
  assert.match(helper, /created: formatDate\(order\.created_at, locale\)/);
  assert.match(page, /const \[copiedSupportSummary, setCopiedSupportSummary\] = useState\(false\)/);
  assert.match(page, /const supportSummaryText = useMemo/);
  assert.match(page, /navigator\.clipboard\.writeText\(supportSummaryText\)/);
  assert.match(page, /Copy summary/);
  assert.match(page, /copiedSupportSummary \? "Copied" : "Copy summary"/);
  assert.doesNotMatch(
    helper,
    /modified_file_path|original_file_path|file_path|storage_path|signed_url|service_role|admin_notes|internal_notes|source_reference|confidence_score|raw|hex|hash/i
  );
});

test("customer order detail uses a responsive MG AutoTech work-order workspace", () => {
  const page = readProjectFile("src", "app", "dashboard", "orders", "[id]", "page.tsx");
  const workspaceStyles = readProjectFile(
    "src",
    "app",
    "dashboard",
    "orders",
    "[id]",
    "order-workspace.module.css"
  );
  const chat = readProjectFile("src", "components", "RequestChat.tsx");
  const layout = readProjectFile("src", "app", "dashboard", "layout.tsx");
  const frame = readProjectFile("src", "components", "dashboard", "CustomerPortalFrame.tsx");
  const sidebar = readProjectFile("src", "components", "dashboard", "CustomerPortalSidebar.tsx");

  assert.match(page, /Secure order workspace/);
  assert.match(page, /max-w-\[1480px\]/);
  assert.match(page, /import workspaceStyles from "\.\/order-workspace\.module\.css"/);
  assert.match(page, /workspaceStyles\.viewportShell/);
  assert.match(page, /workspaceStyles\.workspaceFrame/);
  assert.match(page, /workspaceStyles\.workspaceColumns/);
  assert.match(layout, /<CustomerPortalFrame>\{children\}<\/CustomerPortalFrame>/);
  assert.match(frame, /pathname\.startsWith\("\/dashboard\/orders\/"\)[\s\S]*return "orders"/);
  assert.match(frame, /\.from\("profiles"\)[\s\S]*\.select\("credit_balance"\)/);
  assert.doesNotMatch(page, /CustomerPortalSidebar|aria-label="Mobile navigation"/);
  assert.match(page, /lg:grid-cols-\[minmax\(0,1fr\)_minmax\(20rem,0\.42fr\)\]/);
  assert.match(page, /workspaceStyles\.workspaceChatColumn/);
  assert.match(page, /<RequestChat requestId=\{order\.id\} senderRole="customer" variant="workspace"/);
  assert.match(page, /aria-label="Order progress"/);
  assert.match(page, /aria-label="Order detail content"[\s\S]*tabIndex=\{0\}/);
  assert.match(page, /lg:grid-cols-4/);
  assert.match(page, /Request specification/);
  assert.match(page, /Delivery history/);
  assert.match(page, /Original received/);
  assert.match(page, /DTC diagnostic guidance/);
  assert.match(page, /Copy summary/);
  assert.match(page, /Download latest/);
  assert.match(page, /uploadAdditionalFile\(file\)/);
  assert.match(page, /className="sr-only" onChange=\{\(event\) => \{/);
  assert.match(page, /downloadModifiedVersion\(version\.id\)/);
  assert.ok(page.indexOf("<ProgressTimeline") < page.indexOf("Request specification"));
  assert.doesNotMatch(page, /Live queue & ETA|Payment review/);

  assert.match(chat, /variant\?: "default" \| "workspace"/);
  assert.match(chat, /Order conversation/);
  assert.match(chat, /min-h-72 max-h-\[30rem\] lg:min-h-0 lg:max-h-none lg:flex-1/);
  assert.match(workspaceStyles, /@media \(min-width: 1024px\)/);
  assert.match(workspaceStyles, /workspaceChatColumn/);
  assert.match(workspaceStyles, /position: sticky/);
  assert.doesNotMatch(workspaceStyles, /height: 640px/);
  assert.doesNotMatch(workspaceStyles, /min-height: 640px/);
  assert.match(sidebar, /w-60 shrink-0/);
  assert.match(sidebar, /Current Balance[\s\S]*Available Credits[\s\S]*href="\/dashboard\/credits"[\s\S]*Buy Credits/);
  assert.doesNotMatch(page, /carecufile|panel\.carecufile/i);
});

test("customer workspace uses the same MG AutoTech red tone as the existing portal pages", () => {
  const dashboard = readProjectFile("src", "components", "dashboard", "DashboardClient.tsx");
  const orderDetail = readProjectFile("src", "app", "dashboard", "orders", "[id]", "page.tsx");
  const sidebar = readProjectFile("src", "components", "dashboard", "CustomerPortalSidebar.tsx");
  const login = readProjectFile("src", "app", "login", "page.tsx");
  const register = readProjectFile("src", "app", "register", "page.tsx");
  const customerWorkspaceShell = [dashboard, orderDetail, sidebar].join("\n");

  assert.match(login, /bg-\[#b1121b\][\s\S]*hover:bg-\[#c91824\]/);
  assert.match(register, /bg-\[#b1121b\][\s\S]*hover:bg-\[#c91824\]/);
  assert.match(customerWorkspaceShell, /bg-\[#b1121b\][\s\S]*hover:bg-\[#c91824\]/);
  assert.match(sidebar, /border-\[rgba\(177,18,27,0\.55\)\] bg-\[rgba\(177,18,27,0\.18\)\]/);
  assert.match(orderDetail, /rgba\(177,18,27,0\.25\)/);
  assert.doesNotMatch(customerWorkspaceShell, /#2d1719|rgba\(160,18,28/);
});

test("customer portal uses the public and auth black palette without legacy blue-gray surfaces", () => {
  const globals = readProjectFile("src", "app", "globals.css");
  const shell = readProjectFile("src", "components", "app-shell.tsx");
  const frame = readProjectFile("src", "components", "dashboard", "CustomerPortalFrame.tsx");
  const header = readProjectFile("src", "components", "dashboard", "CustomerPortalPageHeader.tsx");
  const sidebar = readProjectFile("src", "components", "dashboard", "CustomerPortalSidebar.tsx");
  const dashboard = readProjectFile("src", "components", "dashboard", "DashboardClient.tsx");
  const datalogStudio = readProjectFile("src", "components", "dashboard", "LogAnalysisStudio.tsx");
  const widgetDashboard = readProjectFile("src", "components", "dashboard", "WidgetDashboardClient.tsx");
  const orders = readProjectFile("src", "app", "dashboard", "orders", "page.tsx");
  const orderDetail = readProjectFile("src", "app", "dashboard", "orders", "[id]", "page.tsx");
  const creditHistory = readProjectFile("src", "app", "dashboard", "credits", "history", "page.tsx");
  const settings = readProjectFile("src", "app", "dashboard", "settings", "page.tsx");
  const widgetBilling = readProjectFile("src", "app", "dashboard", "widget", "billing", "page.tsx");
  const newRequest = readProjectFile("src", "app", "new-request", "page.tsx");
  const requestChat = readProjectFile("src", "components", "RequestChat.tsx");
  const customerPaletteSources = [
    shell,
    frame,
    header,
    sidebar,
    dashboard,
    datalogStudio,
    widgetDashboard,
    orders,
    orderDetail,
    creditHistory,
    settings,
    widgetBilling,
    newRequest,
  ].join("\n");

  assert.match(globals, /--mg-portal-canvas: #050505/);
  assert.match(globals, /--mg-portal-sidebar: #090909/);
  assert.match(globals, /--mg-portal-header: rgba\(0, 0, 0, 0\.82\)/);
  assert.match(globals, /--mg-portal-surface: rgba\(255, 255, 255, 0\.04\)/);
  assert.match(globals, /--mg-portal-border: rgba\(255, 255, 255, 0\.1\)/);
  assert.match(globals, /radial-gradient[\s\S]*var\(--mg-portal-canvas\)/);
  assert.match(shell, /bg-\[#050505\]/);
  assert.match(frame, /bg-\[var\(--mg-portal-canvas\)\]/);
  assert.match(header, /border-\[var\(--mg-portal-border\)\] bg-\[var\(--mg-portal-header\)\]/);
  assert.match(sidebar, /bg-\[var\(--mg-portal-sidebar\)\]/);
  assert.match(dashboard, /bg-\[var\(--mg-portal-surface\)\]/);
  assert.match(dashboard, /linear-gradient\(100deg,rgba\(177,18,27,0\.22\),var\(--mg-portal-surface-solid\)_55%\)/);
  assert.match(orderDetail, /bg-\[var\(--mg-portal-header\)\]/);
  assert.match(requestChat, /variant === "workspace"[\s\S]*bg-\[var\(--mg-portal-surface\)\]/);
  assert.doesNotMatch(
    customerPaletteSources,
    /#15181e|#12151b|#0f1217|#20242c|#303640|#282d35|#171a20|#1c2028|#252a33|rgba\(20,\s*22,\s*27/i
  );
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

test("legacy admin dashboard protects initial loading and exposes truthful recovery state", () => {
  const adminPage = readProjectFile("src", "app", "admin", "page.tsx");
  const dashboardRoute = readProjectFile("src", "app", "api", "admin", "dashboard", "route.ts");

  assert.match(adminPage, /const ADMIN_LOAD_ERROR_MESSAGE =/);
  assert.match(adminPage, /Retry before treating the queue as empty/);
  assert.match(adminPage, /const \[adminLoadError, setAdminLoadError\]/);
  assert.match(adminPage, /const \[adminDataReady, setAdminDataReady\]/);
  assert.match(adminPage, /const hasLoadedAdminDataRef = useRef\(false\)/);
  assert.match(adminPage, /authenticatedFetch\("\/api\/admin\/dashboard"/);
  assert.match(adminPage, /handleAdminSyncFailure\(\{ kind: failureKind/);
  assert.match(adminPage, /AUTH_SESSION_RECOVERY_MESSAGE/);
  assert.match(adminPage, /AUTH_SESSION_REQUIRED_MESSAGE/);
  assert.match(dashboardRoute, /requireStaffPermission\(request, "orders\.view"\)/);
  assert.match(dashboardRoute, /Admin dashboard orders could not be loaded/);
  assert.match(dashboardRoute, /Admin dashboard customers could not be loaded/);
  assert.match(adminPage, /hasLoadedAdminDataRef\.current = true/);
  assert.match(adminPage, /setAdminDataReady\(true\)/);
  assert.match(adminPage, /const refreshAdminData = \(recoveryEvent = false\) => \{/);
  assert.match(adminPage, /adminRefreshInFlightRef\.current[\s\S]*document\.visibilityState !== "visible"[\s\S]*!navigator\.onLine/);
  assert.match(adminPage, /void loadAdminDataActionRef\.current\(\{ silent: hasLoadedAdminDataRef\.current, automatic: true \}\)/);
  assert.match(adminPage, /const showInitialAdminLoadError = Boolean\(adminLoadError && !adminDataReady\)/);
  assert.match(adminPage, /showInitialAdminLoadError \? \(/);
  assert.match(adminPage, /<AdminLoadErrorState/);
  assert.match(adminPage, /role="alert"[\s\S]*Admin data sync failed/);
  assert.match(adminPage, /The queue is not shown until orders and customers load successfully/);
  assert.match(adminPage, /onRetry=\{\(\) => loadAdminData\(\{ manual: true \}\)\}/);
  assert.match(adminPage, /adminDataReady \? stats\.total : "—"/);
  assert.match(adminPage, /adminDataReady && \(\s*<AdminOperationsOverview/);
  assert.doesNotMatch(adminPage, /: "Live Sync"/);
  assert.doesNotMatch(adminPage, /ADMIN_SYNC_ERROR_MESSAGE/);
  assert.doesNotMatch(adminPage, /Admin sync needs retry/);
  assert.match(adminPage, /adminDataReady && adminSyncIssue/);
  assert.doesNotMatch(adminPage, /supabase\.from\("orders"\)\.select\("\*"\)/);
  assert.doesNotMatch(adminPage, /supabase\s*\.from\("profiles"\)\s*\.select/);
});

test("legacy admin dashboard shows a compact latest-order operations desk", () => {
  const adminPage = readProjectFile("src", "app", "admin", "page.tsx");
  const overview =
    adminPage.match(/function AdminOperationsOverview[\s\S]*?function MiniInfo/)?.[0] ?? "";

  assert.match(adminPage, /type AdminStats = \{/);
  assert.match(adminPage, /type AdminCommandLink = \{/);
  assert.match(adminPage, /const adminCommandLinks = useMemo<AdminCommandLink\[\]>/);
  assert.match(adminPage, /const latestOrders = useMemo\([\s\S]*?\.slice\(0, 5\)/);
  assert.match(adminPage, /href: "\/admin\/requests"/);
  assert.match(adminPage, /href: "\/admin\/file-expert"/);
  assert.match(adminPage, /href: "\/admin\/vehicles"/);
  assert.match(adminPage, /href: "\/admin\/payments"/);
  assert.match(adminPage, /<AdminOperationsOverview/);
  assert.match(adminPage, /latestOrders=\{latestOrders\}/);
  assert.match(adminPage, /commandLinks=\{adminCommandLinks\}/);
  assert.match(overview, /Live order desk/);
  assert.match(overview, /Latest 5 orders/);
  assert.match(overview, /Newest customer work across every status/);
  assert.match(overview, /latestOrders\.map/);
  assert.match(overview, /onOpenOrder\(order\)/);
  assert.match(overview, /Queue snapshot/);
  assert.match(overview, /Quick controls/);
  assert.match(overview, /Queue under control/);
  assert.match(overview, /All orders/);
  assert.match(overview, /Credits used/);
  assert.match(adminPage, /id="admin-order-list"/);
  assert.match(adminPage, /useState<AdminOrderGroup>\("all"\)/);
  assert.doesNotMatch(adminPage, /Daily Command Brief/);
  assert.doesNotMatch(
    overview,
    /internal_admin_note|modified_file_path|signedUrl|signed_url|storage|staff_adjust_customer_credits|fetch\(|\.rpc\(/i
  );
});

test("admin laptop layouts keep dense orders and customer controls inside the viewport", () => {
  const adminPage = readProjectFile("src", "app", "admin", "page.tsx");
  const ordersPanel =
    adminPage.match(/function OrdersPanel[\s\S]*?function CustomersPanel/)?.[0] ?? "";
  const customerModal =
    adminPage.match(/function CustomerDetailModal[\s\S]*?function CustomerPasswordSecurityPanel/)?.[0] ?? "";
  const orderModal =
    adminPage.match(/function OrderDetailModal[\s\S]*?function WorkInfo/)?.[0] ?? "";

  assert.match(ordersPanel, /hidden overflow-x-auto rounded-2xl border border-white\/10 2xl:block/);
  assert.doesNotMatch(ordersPanel, /overflow-hidden rounded-lg border border-white\/10 2xl:block/);
  assert.match(ordersPanel, /grid gap-3 lg:grid-cols-2 2xl:hidden/);
  assert.match(ordersPanel, /grid grid-cols-2 gap-2 text-sm/);
  assert.match(ordersPanel, /sm:grid-cols-\[minmax\(0,1fr\)_auto\]/);
  assert.match(ordersPanel, /aria-label=\{`Open order \$\{shortId\(order\.id\)\} details`\}/);
  assert.match(customerModal, /max-w-\[96rem\]/);
  assert.match(customerModal, /xl:grid-cols-\[minmax\(0,1fr\)_280px\]/);
  assert.match(customerModal, /xl:sticky xl:top-\[7\.5rem\] xl:h-fit/);
  assert.match(customerModal, /role="dialog" aria-modal="true" aria-labelledby="customer-detail-title"/);
  assert.doesNotMatch(customerModal, /max-w-6xl|xl:grid-cols-\[1fr_360px\]/);
  assert.match(orderModal, /max-w-\[96rem\]/);
  assert.match(orderModal, /xl:grid-cols-\[minmax\(0,1fr\)_310px\]/);
  assert.match(orderModal, /xl:sticky xl:top-\[8\.25rem\] xl:h-fit/);
  assert.match(orderModal, /role="dialog" aria-modal="true" aria-labelledby="order-detail-title"/);
  assert.match(orderModal, /min-h-11[\s\S]*?lg:h-9 lg:min-h-0/);
  assert.doesNotMatch(orderModal, /max-w-7xl|xl:grid-cols-\[minmax\(0,1fr\)_380px\]|rounded-\[2rem\]|text-2xl font-black">(?:Status Workflow|Estimated Delivery|File Workflow|Customer Contact)/);
});

test("admin customer management shows the account creation date read-only", () => {
  const adminPage = readProjectFile("src", "app", "admin", "page.tsx");
  const dashboardRoute = readProjectFile("src", "app", "api", "admin", "dashboard", "route.ts");

  assert.match(
    adminPage,
    /Account created \$\{formatDate\(customer\.created_at\)\}/
  );
  assert.match(adminPage, /Account creation date unavailable/);
  assert.match(adminPage, /title="Customer account creation date"/);
  assert.match(
    dashboardRoute,
    /internal_admin_note, created_at"/
  );
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
  assert.match(page, /setAdditionalUploadPhase\("uploading"\)[\s\S]*\.uploadToSignedUrl\(prepared\.upload\.path, prepared\.upload\.token, file/);
  assert.match(page, /setAdditionalUploadPhase\("verifying"\)[\s\S]*additional-file\/finalize/);
  assert.match(page, /finally\s*\{\s*setAdditionalUploadPhase\("idle"\);/);
  assert.match(page, /aria-busy=\{additionalUploading\}/);
  assert.match(page, /max-w-full break-words font-black/);
  assert.doesNotMatch(page, /Uploading additional file\.\.\./);
});

test("customer dashboard and order archive surface action-needed orders separately", () => {
  const dashboard = readProjectFile("src", "components", "dashboard", "DashboardClient.tsx");
  const orders = readProjectFile("src", "app", "dashboard", "orders", "page.tsx");
  const frame = readProjectFile("src", "components", "dashboard", "CustomerPortalFrame.tsx");
  const sidebar = readProjectFile("src", "components", "dashboard", "CustomerPortalSidebar.tsx");

  assert.match(dashboard, /const \[needsResponseCount, setNeedsResponseCount\]/);
  assert.match(dashboard, /\.eq\("status", "customer_info_needed"\)/);
  assert.match(dashboard, /setNeedsResponseCount\(needsResponseOrders \?\? 0\)/);
  assert.match(sidebar, /href: "\/dashboard\/orders\?view=needs_response"/);
  assert.match(dashboard, /Needs Response/);
  assert.match(dashboard, /customerWorkflowT\(locale, "notificationsWaiting"/);

  assert.match(orders, /type View = "active" \| "needs_response" \| "completed" \| "cancelled" \| "all"/);
  assert.match(orders, /value: "needs_response"/);
  assert.match(orders, /selectedView === "needs_response"[\s\S]*\.eq\("status", "customer_info_needed"\)/);
  assert.match(orders, /window\.history\.replaceState/);
  assert.match(orders, /Needs your response/);
  assert.match(orders, /Revision review in progress/);
  assert.match(frame, /view === "needs_response"[\s\S]*return "needs-response"/);
  assert.match(frame, /view === "completed" \|\| view === "cancelled" \|\| view === "all"[\s\S]*return "order-history"/);
});

test("customer order archive keeps verified data during silent realtime refresh failures", () => {
  const orders = readProjectFile("src", "app", "dashboard", "orders", "page.tsx");

  assert.match(orders, /const CUSTOMER_ORDERS_LOAD_ERROR_MESSAGE =/);
  assert.doesNotMatch(orders, /CUSTOMER_ORDERS_SYNC_ERROR_MESSAGE/);
  assert.match(orders, /const \[loadError, setLoadError\] = useState\(""\)/);
  assert.match(orders, /const \[ordersReady, setOrdersReady\] = useState\(false\)/);
  assert.match(orders, /const hasLoadedOrdersRef = useRef\(false\)/);
  assert.match(orders, /if \(!options\?\.silent \|\| !hasLoadedOrdersRef\.current\) \{[\s\S]*setLoadError\(CUSTOMER_ORDERS_LOAD_ERROR_MESSAGE\)/);
  assert.match(orders, /loadOrders\(\{ uid: userId, silent: true \}\)/);
  assert.match(orders, /setOrders\(\(data \?\? \[\]\) as Order\[\]\)/);
  assert.match(orders, /setOrdersReady\(true\)/);
  assert.match(orders, /hasLoadedOrdersRef\.current = true/);
  assert.match(orders, /const showInitialLoadError = Boolean\(loadError && !ordersReady\)/);
  assert.match(orders, /showInitialLoadError \? \(/);
  assert.match(orders, /<OrdersLoadErrorState onRetry=\{\(\) => void loadOrders\(\)\}/);
  assert.match(orders, /role="alert"[\s\S]*Order archive sync failed/);
  assert.match(orders, /not an empty order history/);
  assert.match(orders, /loadError && ordersReady \? \(/);
  assert.match(orders, /Order archive sync needs retry/);
  assert.match(orders, /Your last loaded order list is still shown/);
  assert.match(orders, /Retry sync/);
  assert.match(orders, /ordersReady \? customerWorkflowT\(locale, "requestCount"/);
  assert.match(orders, /No orders found in this view/);
  assert.doesNotMatch(orders, /setMessage\(error\.message\)|error\.message/);
  assert.doesNotMatch(orders, /storage_path|signed_url|service_role|admin_note|metadata/i);
});

test("customer order archive summarizes the loaded page safely", () => {
  const orders = readProjectFile("src", "app", "dashboard", "orders", "page.tsx");

  assert.match(orders, /const loadedOrdersSummary = useMemo\(\(\) => \{/);
  assert.match(orders, /loaded: orders\.length/);
  assert.match(orders, /needsResponse: orders\.filter\(\(order\) => order\.status === "customer_info_needed"\)\.length/);
  assert.match(orders, /delivered: orders\.filter\(\(order\) => order\.status === "completed"\)\.length/);
  assert.match(orders, /creditsShown: orders\.reduce/);
  assert.match(orders, /Loaded page/);
  assert.match(orders, /\{loadedOrdersSummary\.loaded\} \/ \{total\}/);
  assert.match(orders, /Shown from this filtered view/);
  assert.match(orders, /Action needed/);
  assert.match(orders, /Visible orders waiting for your info/);
  assert.match(orders, /Delivered files/);
  assert.match(orders, /Completed files visible on this page/);
  assert.match(orders, /Credits shown/);
  assert.match(orders, /Credit value across loaded orders/);
  assert.doesNotMatch(orders, /loadedOrdersSummary[\s\S]*(storage_path|signed_url|service_role|admin_note|metadata)/);
});

test("customer dashboard shows initial retry and keeps silent refresh failures in the background", () => {
  const dashboard = readProjectFile("src", "components", "dashboard", "DashboardClient.tsx");

  assert.match(dashboard, /const DASHBOARD_LOAD_ERROR_MESSAGE =/);
  assert.doesNotMatch(dashboard, /DASHBOARD_SYNC_ERROR_MESSAGE/);
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
  assert.match(dashboard, /if \(queryFailed\) \{[\s\S]*if \(!silent \|\| !hasLoadedDashboardRef\.current\)[\s\S]*setDashboardLoadError\(DASHBOARD_LOAD_ERROR_MESSAGE\)/);
  assert.match(dashboard, /catch \{[\s\S]*if \(!silent \|\| !hasLoadedDashboardRef\.current\)[\s\S]*setDashboardLoadError\(DASHBOARD_LOAD_ERROR_MESSAGE\)/);
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

test("customer dashboard shows one prioritized next best action", () => {
  const dashboard = readProjectFile("src", "components", "dashboard", "DashboardClient.tsx");
  const needsResponsePriority = dashboard.indexOf("if (needsResponseCount > 0)");
  const profilePriority = dashboard.indexOf("if (profileMissingItems.length > 0)");
  const creditsPriority = dashboard.indexOf("if (credits <= 0)");
  const activeOrdersPriority = dashboard.indexOf("if (activeCount > 0)");

  assert.match(dashboard, /const dashboardNextAction = useMemo\(\(\) => \{/);
  assert.match(dashboard, /profileMissingItems\.length > 0[\s\S]*Complete your customer profile/);
  assert.match(dashboard, /needsResponseCount > 0[\s\S]*Respond to requested order information/);
  assert.match(dashboard, /credits <= 0[\s\S]*Add credits before your next file request/);
  assert.match(dashboard, /activeCount > 0[\s\S]*Track your active file requests/);
  assert.match(dashboard, /title: "Create a new file request"/);
  assert.match(dashboard, /Next best action - \{dashboardNextAction\.eyebrow\}/);
  assert.match(dashboard, /href=\{dashboardNextAction\.href\}/);
  assert.match(dashboard, /\{dashboardNextAction\.cta\}/);
  assert.match(dashboard, /const NextActionIcon =/);
  assert.ok(needsResponsePriority >= 0);
  assert.ok(needsResponsePriority < profilePriority);
  assert.ok(profilePriority < creditsPriority);
  assert.ok(creditsPriority < activeOrdersPriority);
  assert.doesNotMatch(dashboard, /dashboardNextAction[\s\S]*(storage_path|signed_url|service_role|admin_note|metadata)/);
});

test("customer dashboard shows a safe preparation-to-delivery workflow map", () => {
  const dashboard = readProjectFile("src", "components", "dashboard", "DashboardClient.tsx");
  const workflowBlock =
    dashboard.match(/<details className="group mb-\d[\s\S]*?Customer Workflow Map[\s\S]*?customerWorkflowSteps\.map[\s\S]*?<\/details>/)?.[0] ??
    "";

  assert.match(dashboard, /const customerWorkflowSteps = useMemo/);
  assert.match(dashboard, /Prepare file/);
  assert.match(dashboard, /Build request brief/);
  assert.match(dashboard, /Submit secure request/);
  assert.match(dashboard, /Track live work/);
  assert.match(dashboard, /Review delivery/);
  assert.match(dashboard, /href: "\/tools\/file-readiness-check"/);
  assert.match(dashboard, /href: "\/tools\/request-brief-builder"/);
  assert.match(dashboard, /href: "\/new-request"/);
  assert.match(dashboard, /needsResponseCount > 0 \? "\/dashboard\/orders\?view=needs_response" : "\/dashboard\/orders"/);
  assert.match(dashboard, /href: "\/dashboard\/orders\?view=completed"/);
  assert.match(dashboard, /Customer Workflow Map/);
  assert.match(dashboard, /From preparation to delivery/);
  assert.match(dashboard, /No raw file is handled by these prep tools/);
  assert.match(dashboard, /customerWorkflowSteps\.map/);
  assert.match(dashboard, /String\(index \+ 1\)\.padStart\(2, "0"\)/);
  assert.match(workflowBlock, /<summary[\s\S]*focus-visible:ring-red-500/);
  assert.doesNotMatch(
    workflowBlock,
    /storage_path|signed_url|service_role|admin_note|metadata|customer_email|hex|fetch\(|\.rpc\(/i
  );
});

test("customer dashboard follows the owner reference hierarchy without hiding operational data", () => {
  const dashboard = readProjectFile("src", "components", "dashboard", "DashboardClient.tsx");
  const dashboardLayout = readProjectFile("src", "app", "dashboard", "layout.tsx");
  const frame = readProjectFile("src", "components", "dashboard", "CustomerPortalFrame.tsx");
  const sidebar = readProjectFile("src", "components", "dashboard", "CustomerPortalSidebar.tsx");
  const welcome = dashboard.indexOf("data-dashboard-welcome");
  const prioritySummary = dashboard.indexOf("data-dashboard-priority-summary", welcome);
  const recentRequests = dashboard.indexOf('data-dashboard-primary="recent-requests"');
  const creditHistory = dashboard.indexOf('id="credit-history-title"', recentRequests);
  const quickActions = dashboard.indexOf("Quick Actions", creditHistory);
  const workflow = dashboard.indexOf("Customer Workflow Map", quickActions);
  const recentOrderProjection =
    dashboard.match(/\.from\("orders"\)[\s\S]*?\.limit\(5\)/)?.[0] ?? "";

  assert.ok(welcome >= 0);
  assert.ok(welcome < prioritySummary);
  assert.ok(prioritySummary < recentRequests);
  assert.ok(recentRequests >= 0);
  assert.ok(recentRequests < creditHistory);
  assert.ok(creditHistory < quickActions);
  assert.ok(quickActions < workflow);
  assert.match(
    dashboard,
    /data-dashboard-welcome[\s\S]*Welcome, <span translate="no" data-no-translate>\{customerName\}<\/span>/
  );
  assert.match(dashboard, /data-dashboard-priority-summary[\s\S]*Pending Requests[\s\S]*In Progress[\s\S]*Completed[\s\S]*Balance/);
  assert.match(dashboard, /<section[\s\S]*aria-labelledby="recent-requests-title"[\s\S]*filteredOrders\.map/);
  assert.match(dashboard, /min-\[1180px\]:grid-cols-\[minmax\(0,1\.55fr\)_minmax\(20rem,0\.85fr\)\]/);
  assert.match(dashboard, /sm:grid-cols-\[minmax\(0,1fr\)_auto\]/);
  assert.match(dashboardLayout, /<CustomerPortalFrame>\{children\}<\/CustomerPortalFrame>/);
  assert.match(frame, /<CustomerPortalDesktopNavigation pathname=\{pathname\} credits=\{credits\} \/>/);
  assert.match(sidebar, /hidden w-60 shrink-0/);
  assert.match(sidebar, /Current Balance[\s\S]*Available Credits[\s\S]*href="\/dashboard\/credits"[\s\S]*Buy Credits/);
  assert.match(dashboard, /const \[requestSearch, setRequestSearch\]/);
  assert.match(dashboard, /const filteredOrders = useMemo/);
  assert.match(dashboard, /Search recent requests/);
  assert.match(sidebar, /aria-label="Primary navigation"/);
  assert.match(frame, /<CustomerPortalMobileNavigation pathname=\{pathname\} \/>/);
  assert.match(dashboard, /aria-label="Dashboard content"[\s\S]*tabIndex=\{0\}/);
  assert.match(sidebar, /aria-label="Primary navigation"/);
  assert.match(dashboard, /order\.status === "customer_info_needed"/);
  assert.match(dashboard, /Needs your response/);
  assert.match(dashboard, /order\.status === "revision"/);
  assert.match(dashboard, /Revision review in progress/);
  assert.match(dashboard, /Open Delivery/);
  assert.match(dashboard, /\? "Needs Response"[\s\S]*: "Details"/);
  assert.match(dashboard, /<details[\s\S]*Quick Actions/);
  assert.match(dashboard, /aria-labelledby="credit-history-title"[\s\S]*creditHistory\.map/);
  assert.doesNotMatch(dashboard, /<details[\s\S]*Credit History/);
  assert.match(dashboard, /aria-live="polite"/);
  assert.match(dashboard, /if \(!customerId\) return null/);
  assert.match(dashboard, /disabled=\{!customerReference\}/);
  assert.match(
    dashboard,
    /\.select\(\s*"id, vehicle_brand, vehicle_model, vehicle_generation, vehicle_engine, service_type, credits_required, status, created_at"\s*\)/
  );
  assert.doesNotMatch(recentOrderProjection, /customer_email|notes/);
  assert.doesNotMatch(dashboard, /Not Ready|min-h-\[220px\]|text-5xl|Need a new tuning file\?|Secure File Workflow/);
});

test("customer dashboard uses the Efferd shell without losing routes or adding unused UI packages", () => {
  const page = readProjectFile("src", "app", "dashboard", "page.tsx");
  const shell = readProjectFile("src", "components", "app-shell.tsx");
  const dashboardEntry = readProjectFile("src", "components", "dashboard", "index.tsx");
  const efferd = readProjectFile("src", "components", "ui", "efferd-dashboard-2.tsx");
  const dashboard = readProjectFile("src", "components", "dashboard", "DashboardClient.tsx");
  const dashboardLayout = readProjectFile("src", "app", "dashboard", "layout.tsx");
  const newRequestLayout = readProjectFile("src", "app", "new-request", "layout.tsx");
  const newRequestAccessBoundary = readProjectFile(
    "src",
    "app",
    "new-request",
    "NewRequestAccessBoundary.tsx"
  );
  const frame = readProjectFile("src", "components", "dashboard", "CustomerPortalFrame.tsx");
  const sidebar = readProjectFile("src", "components", "dashboard", "CustomerPortalSidebar.tsx");
  const globals = readProjectFile("src", "app", "globals.css");
  const i18nCheck = readProjectFile("scripts", "check-customer-i18n.ts");
  const packageJson = readProjectFile("package.json");
  const presentation = `${page}\n${shell}\n${dashboardEntry}\n${efferd}\n${dashboardLayout}\n${newRequestLayout}\n${newRequestAccessBoundary}\n${frame}\n${dashboard}\n${sidebar}`;

  assert.match(page, /import \{ EfferdDashboard2 \} from "@\/components\/ui\/efferd-dashboard-2"/);
  assert.match(page, /return <EfferdDashboard2 \/>/);
  assert.match(efferd, /import \{ Dashboard \} from "@\/components\/dashboard"/);
  assert.match(efferd, /return <Dashboard \/>/);
  assert.doesNotMatch(efferd, /AppShell/);
  assert.match(dashboardEntry, /return <DashboardClient \/>/);
  assert.match(shell, /data-dashboard-shell="efferd"/);
  assert.match(shell, /mg-efferd-dashboard/);
  assert.match(globals, /\.mg-efferd-dashboard \.mg-compact-ui/);
  assert.match(globals, /border-radius: 0\.75rem !important/);
  assert.match(dashboardLayout, /<CustomerPortalFrame>\{children\}<\/CustomerPortalFrame>/);
  assert.match(newRequestAccessBoundary, /<CustomerPortalFrame>\{children\}<\/CustomerPortalFrame>/);
  assert.match(frame, /data-customer-portal-frame/);
  assert.match(frame, /<AppShell>/);
  assert.match(frame, /lg:h-screen lg:overflow-hidden/);
  assert.match(frame, /routeOwnsDesktopScroll/);
  assert.match(frame, /pathname === "\/dashboard" \|\| pathname\.startsWith\("\/dashboard\/orders\/"\)/);
  assert.match(frame, /!isEmailVerified\(user\)/);
  assert.doesNotMatch(frame, /signOutIfEmailUnverified/);
  assert.match(frame, /<CustomerPortalMobileNavigation pathname=\{pathname\} \/>/);
  assert.match(dashboard, /lg:h-screen lg:overflow-hidden/);
  assert.match(dashboard, /lg:flex lg:h-screen lg:flex-col lg:overflow-hidden/);
  assert.match(dashboard, /lg:min-h-0 lg:flex-1 lg:overflow-y-auto/);
  assert.match(dashboard, /grid grid-cols-2 gap-3 min-\[1180px\]:grid-cols-4/);

  for (const target of [
    "/",
    "/dashboard",
    "/new-request",
    "/dashboard/file-expert",
    "/dashboard/log-analysis",
    "/dashboard/widget",
    "/dashboard/orders",
    "/dashboard/orders?view=needs_response",
    "/dashboard/orders?view=completed",
    "/dashboard/credits",
    "/dashboard/credits/history",
    "/dashboard/notifications",
    "/dashboard/settings",
    "mailto:info@mgautotech.de",
  ]) {
    assert.ok(
      presentation.includes(`href="${target}"`) || presentation.includes(`href: "${target}"`),
      `missing preserved customer dashboard target: ${target}`
    );
  }

  assert.match(dashboard, /href=\{`\/dashboard\/orders\/\$\{order\.id\}`\}/);
  assert.match(dashboard, /href: "\/tools\/file-readiness-check"/);
  assert.match(dashboard, /href: "\/tools\/request-brief-builder"/);
  assert.match(i18nCheck, /"src\/components\/app-shell\.tsx"/);
  assert.match(i18nCheck, /"src\/components\/dashboard\/CustomerPortalFrame\.tsx"/);
  assert.match(i18nCheck, /"src\/components\/dashboard\/CustomerPortalPageHeader\.tsx"/);
  assert.match(i18nCheck, /"src\/components\/dashboard\/CustomerPortalSidebar\.tsx"/);
  assert.match(i18nCheck, /"src\/components\/dashboard\/index\.tsx"/);
  assert.match(i18nCheck, /"src\/components\/ui\/efferd-dashboard-2\.tsx"/);
  assert.doesNotMatch(presentation, /from ["'](?:recharts|@radix-ui\/)/);
  assert.doesNotMatch(packageJson, /"(?:recharts|@radix-ui\/react-avatar|@radix-ui\/react-separator|@radix-ui\/react-collapsible|@radix-ui\/react-dropdown-menu)"/);
});

test("customer destination routes share one compact page header without duplicate desktop branding", () => {
  const header = readProjectFile("src", "components", "dashboard", "CustomerPortalPageHeader.tsx");
  const sidebar = readProjectFile("src", "components", "dashboard", "CustomerPortalSidebar.tsx");
  const globals = readProjectFile("src", "app", "globals.css");
  const notifications = readProjectFile("src", "app", "dashboard", "notifications", "page.tsx");
  const destinations = [
    readProjectFile("src", "app", "new-request", "page.tsx"),
    readProjectFile("src", "app", "dashboard", "orders", "page.tsx"),
    readProjectFile("src", "app", "dashboard", "credits", "page.tsx"),
    readProjectFile("src", "app", "dashboard", "credits", "history", "page.tsx"),
    notifications,
    readProjectFile("src", "app", "dashboard", "settings", "page.tsx"),
    readProjectFile("src", "app", "dashboard", "file-expert", "page.tsx"),
    readProjectFile("src", "app", "dashboard", "file-expert", "[id]", "page.tsx"),
    readProjectFile("src", "components", "dashboard", "LogAnalysisStudio.tsx"),
    readProjectFile("src", "components", "dashboard", "WidgetDashboardClient.tsx"),
    readProjectFile("src", "app", "dashboard", "widget", "billing", "page.tsx"),
  ];

  assert.match(header, /min-h-\[4\.75rem\]/);
  assert.match(header, /border-\[var\(--mg-portal-border\)\] bg-\[var\(--mg-portal-header\)\]/);
  assert.match(header, /width\?: "6xl" \| "7xl" \| "wide"/);
  for (const destination of destinations) {
    assert.match(destination, /CustomerPortalPageHeader/);
  }
  assert.match(sidebar, /nav\.scrollTo\(\{ left: Math\.max\(0, centeredLeft\), behavior: "auto" \}\)/);
  assert.match(sidebar, /aria-current=\{active \? "page" : undefined\}/);
  assert.match(sidebar, /aria-label="Mobile navigation"[\s\S]*href="mailto:info@mgautotech\.de"/);
  assert.match(globals, /min-height: calc\(100dvh - 3\.8125rem\) !important/);
  assert.match(notifications, /signOutIfEmailUnverified\(user\)[\s\S]*router\.push\("\/login\?verify_email=1"\)/);
});

test("authenticated customer routes use laptop density without shrinking mobile controls", () => {
  const globals = readProjectFile("src", "app", "globals.css");
  const shell = readProjectFile("src", "components", "app-shell.tsx");
  const header = readProjectFile("src", "components", "dashboard", "CustomerPortalPageHeader.tsx");
  const sidebar = readProjectFile("src", "components", "dashboard", "CustomerPortalSidebar.tsx");
  const dashboard = readProjectFile("src", "components", "dashboard", "DashboardClient.tsx");
  const credits = readProjectFile("src", "app", "dashboard", "credits", "page.tsx");
  const creditHistory = readProjectFile("src", "app", "dashboard", "credits", "history", "page.tsx");
  const settings = readProjectFile("src", "app", "dashboard", "settings", "page.tsx");
  const newRequest = readProjectFile("src", "app", "new-request", "page.tsx");

  assert.match(shell, /mg-efferd-dashboard mg-customer-density/);
  assert.match(globals, /@media \(min-width: 1024px\) \{[\s\S]*\.mg-customer-density \[data-customer-portal-sidebar\]/);
  assert.match(globals, /\.mg-customer-density \.mg-compact-ui :where\(\.p-8, \.p-7\)/);
  assert.match(sidebar, /data-customer-portal-sidebar/);
  assert.match(sidebar, /data-customer-sidebar-link/);
  assert.match(header, /data-customer-page-header/);
  assert.match(header, /lg:min-h-16/);
  assert.match(dashboard, /data-customer-dashboard/);

  assert.match(credits, /title="Buy Credits"[\s\S]*?heading/);
  assert.match(credits, /width="wide"/);
  assert.match(credits, /data-credit-purchase-page/);
  assert.match(credits, /data-credit-package-grid[\s\S]*xl:grid-cols-5/);
  assert.match(credits, /min-h-11 w-full/);
  assert.doesNotMatch(
    credits,
    /py-10|mb-10|min-h-\[(?:290|340|360)px\]/,
  );
  assert.ok(
    credits.indexOf("data-credit-package-grid") <
      credits.indexOf("Credit Utilization Scale"),
  );
  assert.match(creditHistory, /title="Credit History"[\s\S]*?heading/);
  assert.doesNotMatch(creditHistory, /text-4xl font-black md:text-6xl/);
  assert.match(settings, /title="Customer Settings"[\s\S]*?heading/);
  assert.match(settings, /h-12[\s\S]*lg:h-10/);
  assert.match(newRequest, /title="New File Request"[\s\S]*?heading/);
  assert.match(newRequest, /h-11[\s\S]*lg:h-9/);
});

test("customer settings profile load errors block default editable profile state", () => {
  const settings = readProjectFile("src", "app", "dashboard", "settings", "page.tsx");

  assert.match(settings, /const SETTINGS_LOAD_ERROR_MESSAGE = "Customer profile could not be synced\. Please try again\."/);
  assert.match(settings, /const SETTINGS_SAVE_ERROR_MESSAGE =/);
  assert.match(settings, /const \[loadError, setLoadError\] = useState\(""\)/);
  assert.match(settings, /const \[settingsReady, setSettingsReady\] = useState\(false\)/);
  assert.match(settings, /const loadSettings = useCallback\(async \(\) => \{/);
  assert.match(settings, /setLoadError\(SETTINGS_LOAD_ERROR_MESSAGE\)/);
  assert.match(settings, /setSettingsReady\(false\)/);
  assert.match(settings, /setSettingsReady\(true\)/);
  assert.match(settings, /if \(loadError && !settingsReady\) \{/);
  assert.match(settings, /<SettingsLoadErrorState onRetry=\{\(\) => void loadSettings\(\)\}/);
  assert.match(settings, /role="alert"[\s\S]*Customer settings sync failed/);
  assert.match(settings, /profile form is not shown until customer settings load successfully/);
  assert.match(settings, /incorrect bank-transfer reference/);
  assert.match(settings, /Back to dashboard/);
  assert.match(settings, /setMessage\(SETTINGS_SAVE_ERROR_MESSAGE\)/);
  assert.match(settings, /Settings saved successfully/);
  assert.match(settings, /formatCustomerReference\(customerId\)/);
  assert.doesNotMatch(settings, /setMessage\(error\.message\)|error\.message/);
  assert.doesNotMatch(settings, /storage_path|signed_url|service_role|admin_note|SUPABASE_SERVICE_ROLE_KEY|credit_transactions/i);
});

test("customer settings shows live account readiness and copyable bank reference", () => {
  const settings = readProjectFile("src", "app", "dashboard", "settings", "page.tsx");
  const readinessBlock =
    settings.match(/function getSettingsReadinessItems[\s\S]*?<form onSubmit=\{saveSettings\}/)?.[0] ?? "";

  assert.match(settings, /function getSettingsReadinessItems/);
  assert.match(settings, /const readinessItems = useMemo/);
  assert.match(settings, /const completedReadinessItems = readinessItems\.filter/);
  assert.match(settings, /const readinessPercent = Math\.round/);
  assert.match(settings, /Account Readiness/);
  assert.match(settings, /Profile completion for faster handling/);
  assert.match(settings, /Complete customer details before high-touch file service workflows/);
  assert.match(settings, /Contact details/);
  assert.match(settings, /Invoice contact/);
  assert.match(settings, /Billing address/);
  assert.match(settings, /Company profile/);
  assert.match(settings, /\{readinessPercent\}%/);
  assert.match(settings, /\{completedReadinessItems\}\/\{readinessItems\.length\} checks complete/);
  assert.match(settings, /const \[referenceCopied, setReferenceCopied\] = useState\(false\)/);
  assert.match(settings, /const copyCustomerReference = async \(\) => \{/);
  assert.match(settings, /navigator\.clipboard\.writeText\(customerReference\)/);
  assert.match(settings, /Customer reference could not be copied\. Please copy it manually\./);
  assert.match(settings, /Reference copied/);
  assert.match(settings, /Copy reference/);
  assert.doesNotMatch(
    readinessBlock,
    /storage_path|signed_url|service_role|admin_note|credit_transactions|SUPABASE_SERVICE_ROLE_KEY|fetch\(|\.rpc\(/i
  );
});

test("customer widget dashboard blocks duplicate pending domain-change requests", () => {
  const widgetDashboard = readProjectFile("src", "components", "dashboard", "WidgetDashboardClient.tsx");

  assert.match(widgetDashboard, /const pendingDomainRequest = payload\?\.domainRequests\?\.find\(\(item\) => item\.status === "pending"\) \?\? null/);
  assert.match(widgetDashboard, /const hasPendingDomainRequest = Boolean\(pendingDomainRequest\)/);
  assert.match(widgetDashboard, /if \(hasPendingDomainRequest\) \{ setMessage\(widgetSiteT\(activeSiteLocale, "domainRequestAlreadyPending"\)\); return; \}/);
  assert.match(widgetDashboard, /widgetSiteT\(activeSiteLocale, "pendingAdminReview"\)/);
  assert.match(widgetDashboard, /pendingDomainRequest\.requested_domain/);
  assert.match(widgetDashboard, /widgetSiteT\(activeSiteLocale, "newRequestAfterResolution"\)/);
  assert.match(widgetDashboard, /disabled=\{hasPendingDomainRequest\}/);
  assert.match(widgetDashboard, /aria-describedby=\{hasPendingDomainRequest \? "pending-domain-request" : undefined\}/);
  assert.match(widgetDashboard, /disabled=\{hasPendingDomainRequest \|\| !domainRequest\.trim\(\)\}/);
  assert.match(widgetDashboard, /payload\.domainRequests\?\.map/);
  assert.doesNotMatch(widgetDashboard, /widget_audit_logs|actor_user_id|old_domain/);
});

test("customer widget dashboard shows retryable load errors without plan fallback", () => {
  const widgetDashboard = readProjectFile("src", "components", "dashboard", "WidgetDashboardClient.tsx");

  assert.match(widgetDashboard, /const \[widgetLoadError, setWidgetLoadError\]/);
  assert.match(widgetDashboard, /setWidgetLoadError\(""\);[\s\S]*\/api\/widget\/client/);
  assert.match(widgetDashboard, /if \(!response\.ok\) throw new Error\("widget_workspace_sync_failed"\)/);
  assert.match(widgetDashboard, /catch \{ setWidgetLoadError\(widgetSiteT\(activeSiteLocale, "workspaceSyncFailed"\)\); \}/);
  assert.match(widgetDashboard, /const showInitialWidgetLoadError = Boolean\(widgetLoadError && !client && !payload\)/);
  assert.match(widgetDashboard, /if \(showInitialWidgetLoadError\) return/);
  assert.match(widgetDashboard, /role="alert"[\s\S]*widgetSiteT\(activeSiteLocale, "workspaceSyncFailedTitle"\)/);
  assert.match(widgetDashboard, /widgetSiteT\(activeSiteLocale, "subscriptionStatusUnchanged"\)/);
  assert.match(widgetDashboard, /onClick=\{\(\) => void load\(\)\}/);
  assert.match(widgetDashboard, /widgetSiteT\(activeSiteLocale, "tryAgain"\)/);
  assert.match(widgetDashboard, /widgetSiteT\(activeSiteLocale, "noWidgetSubscription"\)/);
  assert.match(widgetDashboard, /widgetSiteT\(activeSiteLocale, "viewPlans"\)/);
  assert.match(widgetDashboard, /widgetLoadError && <div role="alert"[\s\S]*widgetSiteT\(activeSiteLocale, "lastSettingsShown"\)/);
  assert.match(widgetDashboard, /widgetSiteT\(activeSiteLocale, "retrySync"\)/);
  assert.doesNotMatch(widgetDashboard, /throw new Error\(data\.error/);
  assert.doesNotMatch(widgetDashboard, /setMessage\(error instanceof Error \? error\.message/);
  assert.doesNotMatch(widgetDashboard, /stripe_customer_id|widget_audit_logs|service_role|admin_note/);
});

test("admin widget clients list surfaces pending domain review signals safely", () => {
  const route = readProjectFile("src", "app", "api", "admin", "widget-clients", "route.ts");
  const page = readProjectFile("src", "app", "admin", "widget-clients", "page.tsx");
  const dataLoader = readProjectFile("src", "lib", "widget", "adminData.ts");
  const commercial = readProjectFile("src", "lib", "widget", "commercial.ts");

  assert.match(route, /loadAdminWidgetClients/);
  assert.match(dataLoader, /\.from\("widget_domain_change_requests"\)/);
  assert.match(dataLoader, /\.select\("requested_domain, created_at"\)/);
  assert.match(dataLoader, /\.eq\("status", "pending"\)/);
  assert.match(dataLoader, /pending_domain_request_count/);
  assert.match(dataLoader, /latest_requested_domain/);
  assert.match(commercial, /Domain review waiting/);
  assert.doesNotMatch(route + dataLoader, /admin_note|old_domain|widget_audit_logs|actor_user_id|resolved_at/);

  assert.match(page, /domain reviews/);
  assert.match(page, /domain review/);
  assert.match(page, /href=\{`\/admin\/widget-clients\/\$\{client\.id\}`\}/);
  assert.match(page, /Commercial action queue/);
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
  assert.match(chat, /aria-describedby="request-chat-message-help request-chat-message-limit request-chat-send-error"/);
  assert.match(chat, /disabled=\{!canSendMessage\}/);
  assert.match(chat, /id="request-chat-message-limit"/);
  assert.match(chat, /aria-live="polite"/);
  assert.match(chat, /\{charactersRemaining\} characters remaining/);
  assert.match(chat, /Press Enter to send/);
  assert.match(chat, /Shift \+ Enter for a new line/);
  assert.match(chat, /const MESSAGE_REFRESH_INTERVAL_MS = 12000/);
  assert.match(chat, /if \(fetchInFlightRef\.current\) return fetchInFlightRef\.current/);
  assert.match(chat, /document\.visibilityState !== "visible"/);
  assert.match(chat, /Reconnecting in the background\. Your loaded messages remain available\./);
  assert.match(chat, /Conversation unavailable/);
  assert.match(chat, /onClick=\{\(\) => void loadMessages\(\{ scrollAfterLoad: true \}\)\}/);
  assert.match(chat, /disabled=\{!historyReady \|\| syncState === "unavailable"\}/);
  assert.doesNotMatch(chat, /Messages could not be loaded\./);
  assert.doesNotMatch(chat, /Â·/);
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
  assert.match(notifications, /if \(!initialized\.current\) \{[\s\S]*setNotificationLoadError\("Notifications could not be loaded\. Please try again\."\)/);
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
  assert.match(dashboard, /item\.description \? \(/);
  assert.match(dashboard, /<span translate="no" data-no-translate>\{item\.description\}<\/span>/);
  assert.match(dashboard, /\) : typeLabel/);
  assert.match(dashboard, /item\.balance_after !== null/);
  assert.match(dashboard, /isPositive \? "text-emerald-400" : "text-red-500"/);
  assert.match(dashboard, /No credit ledger movements yet/);
  assert.match(dashboard, /href="\/dashboard\/credits"/);
  assert.match(dashboard, /href="\/dashboard\/credits\/history"/);
  assert.doesNotMatch(dashboard, /return orders[\s\S]*credits_required[\s\S]*slice\(0, 6\)/);
  assert.doesNotMatch(dashboard, /source_id|metadata/);
});

test("customer credit ledger shows initial retry and suppresses silent refresh noise", () => {
  const page = readProjectFile("src", "app", "dashboard", "credits", "history", "page.tsx");

  assert.match(page, /const CREDIT_LEDGER_LOAD_ERROR_MESSAGE =/);
  assert.doesNotMatch(page, /CREDIT_LEDGER_SYNC_ERROR_MESSAGE/);
  assert.match(page, /const \[ledgerLoadError, setLedgerLoadError\]/);
  assert.match(page, /const \[ledgerReady, setLedgerReady\]/);
  assert.match(page, /const hasLoadedLedgerRef = useRef\(false\)/);
  assert.match(page, /error: profileError/);
  assert.match(page, /error: transactionRowsError/);
  assert.match(page, /if \(profileError \|\| transactionRowsError\) \{/);
  assert.match(
    page,
    /if \(!options\?\.silent \|\| !hasLoadedLedgerRef\.current\) \{[\s\S]*setLedgerLoadError\(CREDIT_LEDGER_LOAD_ERROR_MESSAGE\)/
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
  assert.doesNotMatch(page, /Your last loaded balance and movements are still shown/);
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

  assert.match(page, /customerWorkflowT\(locale, "fileExpertRequirements"/);
  assert.match(page, /extensions: fileExpertAllowedExtensionsLabel/);
  assert.match(page, /size: fileExpertMaxFileSizeLabel/);
  assert.match(page, /validateFileExpertSelection/);
  assert.match(page, /file\.size === 0/);
  assert.match(page, /file\.size > fileExpertMaxFileSize/);
  assert.match(page, /fileExpertAllowedExtensions\.some/);
  assert.match(page, /customerWorkflowT\(locale, "fileExpertUnsupportedFile"/);
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
  assert.match(page, /customerWorkflowT\(locale, "fileExpertSelectFile"\)/);
  assert.match(page, /setMessage\(customerWorkflowT\(locale, "fileExpertUploadFile"\)\)/);
  assert.match(page, /disabled=\{!canSubmitAnalysis\}/);
  assert.match(page, /if \(textLimitError\) \{[\s\S]*setMessage\(textLimitError\)/);
  assert.match(page, /if \(!oriFile && !modFile\) \{[\s\S]*authenticatedFetch\("\/api\/file-expert\/jobs\/prepare"/);
});

test("customer File Expert history shows initial retry and suppresses silent refresh noise", () => {
  const page = readProjectFile("src", "app", "dashboard", "file-expert", "page.tsx");
  const route = readProjectFile("src", "app", "api", "file-expert", "jobs", "route.ts");

  assert.match(page, /const FILE_EXPERT_JOBS_LOAD_ERROR_MESSAGE =/);
  assert.doesNotMatch(page, /FILE_EXPERT_JOBS_SYNC_ERROR_MESSAGE/);
  assert.match(page, /const \[jobsLoadError, setJobsLoadError\] = useState\(""\)/);
  assert.match(page, /const \[jobsReady, setJobsReady\] = useState\(false\)/);
  assert.match(page, /const hasLoadedJobsRef = useRef\(false\)/);
  assert.match(page, /if \(!response\.ok\) \{[\s\S]*throw new Error\(FILE_EXPERT_JOBS_LOAD_ERROR_MESSAGE\)/);
  assert.match(
    page,
    /if \(!options\?\.silent \|\| !hasLoadedJobsRef\.current\) \{[\s\S]*setJobsLoadError\(FILE_EXPERT_JOBS_LOAD_ERROR_MESSAGE\)/
  );
  assert.match(page, /setJobs\(payload\.jobs \?\? \[\]\)/);
  assert.match(page, /setJobs\(payload\.jobs \?\? \[\]\);\s*setJobsLoadError\(""\)/);
  assert.match(page, /setJobsReady\(true\)/);
  assert.match(page, /hasLoadedJobsRef\.current = true/);
  assert.match(page, /const showInitialJobsLoadError = Boolean\(jobsLoadError && !jobsReady\)/);
  assert.match(page, /\{!showInitialJobsLoadError && \(/);
  assert.match(page, /jobsLoadError && jobsReady \? \(/);
  assert.match(page, /File Expert history sync needs retry/);
  assert.match(page, /Your last loaded analysis history is still shown/);
  assert.match(page, /showInitialJobsLoadError \? \(/);
  assert.match(page, /<FileExpertJobsLoadErrorState onRetry=\{\(\) => void loadJobs\(\)\}/);
  assert.match(page, /role="alert"[\s\S]*File Expert history sync failed/);
  assert.match(page, /Analysis history is not shown until it loads successfully/);
  assert.match(page, /No analysis yet/);
  assert.match(route, /\{ error: "File Expert jobs could not be loaded\." \}/);
  assert.doesNotMatch(page, /payload\.error/);
  assert.doesNotMatch(route, /if \(error\) return NextResponse\.json\(\{ error: error\.message \}/);
  assert.doesNotMatch(page, /storage_path|signed_url|service_role|admin_note/i);
});

test("DTC analyzer provider boundary keeps fallback local and safety-scoped", () => {
  const types = readProjectFile("src", "lib", "dtcAnalyzer", "types.ts");
  const fallback = readProjectFile("src", "lib", "dtcAnalyzer", "fallback.ts");
  const index = readProjectFile("src", "lib", "dtcAnalyzer", "index.ts");
  const config = readProjectFile("src", "lib", "dtcAnalyzer", "config.ts");
  const combined = `${types}\n${fallback}\n${index}\n${config}`;

  assert.match(types, /export interface DtcAnalyzerProvider/);
  assert.match(types, /provider_unavailable/);
  assert.match(types, /DtcAnalyzerFallbackState/);
  assert.match(types, /isAiGenerated: boolean/);
  assert.match(types, /DtcAnalysisEvidenceItem/);
  assert.match(types, /DtcRiskFlag/);
  assert.match(types, /DtcAnalyzerRecommendation/);
  assert.match(types, /DtcConfidenceReason/);
  assert.match(types, /source: DtcAnalysisEvidenceSource/);
  assert.match(types, /category: DtcRecommendationCategory/);
  assert.match(fallback, /Deterministic non-AI DTC fallback/);
  assert.match(fallback, /No DTC AI provider is configured for local analysis/);
  assert.match(fallback, /DTC-off decision/);
  assert.match(fallback, /emissions_or_legal_review/);
  assert.match(fallback, /safety_relevance/);
  assert.match(fallback, /diagnostic_uncertainty/);
  assert.match(fallback, /human_review_gate/);
  assert.match(fallback, /Deterministic text-only fallback is capped at medium/);
  assert.match(fallback, /does not confirm a root cause, fix or legal suitability/);
  assert.match(index, /class UnavailableDtcAnalyzerProvider/);
  assert.match(index, /buildDeterministicDtcFallback/);
  assert.match(config, /dtc-analyzer-config-v1/);
  assert.match(config, /checkDtcAnalyzerUsage/);
  assert.match(config, /maxCodesPerRequest/);
  assert.match(config, /projectDtcUsageLimitForResponse/);
  assert.doesNotMatch(combined, /fetch\(|process\.env|OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY/i);
  assert.doesNotMatch(combined, /upload-session|createObjectURL|FileReader|writeFile|bytePatch/i);
  assert.doesNotMatch(combined, /confirmed fix|customer-ready file|checksum result|DTC-off approved|byte patch approved/i);
});

test("request DTC integration keeps customer and admin projections bounded", () => {
  const helper = readProjectFile("src", "lib", "dtcAnalyzer", "requestIntegration.ts");
  const config = readProjectFile("src", "lib", "dtcAnalyzer", "config.ts");
  const customerRoute = readProjectFile("src", "app", "api", "requests", "[id]", "dtc-analysis", "route.ts");
  const adminRoute = readProjectFile("src", "app", "api", "admin", "requests", "[id]", "dtc-analysis", "route.ts");
  const customerPage = readProjectFile("src", "app", "dashboard", "orders", "[id]", "page.tsx");
  const adminClient = readProjectFile("src", "app", "admin", "requests", "[id]", "WorkOrderDetailClient.tsx");
  const customerPanel = customerPage.match(/function CustomerDtcAnalysisPanel[\s\S]*?\r?\n}\r?\n\r?\nfunction Detail/)?.[0] ?? "";
  const adminPanel = adminClient.match(/function DtcExpertReviewPanel[\s\S]*?\r?\n}\r?\n\r?\nfunction Panel/)?.[0] ?? "";
  const combinedDtcSurface = `${helper}\n${customerRoute}\n${adminRoute}\n${customerPanel}\n${adminPanel}`;

  assert.match(helper, /export type CustomerRequestDtcAnalysis/);
  assert.match(helper, /export type ExpertRequestDtcAnalysis/);
  assert.match(helper, /requestDtcOrderSelect/);
  assert.match(helper, /rejectedCodeLikeTokenCount/);
  assert.match(helper, /auditMetadata/);
  assert.match(customerRoute, /requireApiUser\(request\)/);
  assert.match(customerRoute, /\.eq\("customer_id", auth\.user\.id\)/);
  assert.match(adminRoute, /requireStaffPermissions\(request,\s*\["orders\.view", "file_expert\.manage"\]\)/);
  assert.match(customerRoute, /checkDtcAnalyzerUsage/);
  assert.match(adminRoute, /checkDtcAnalyzerUsage/);
  assert.match(customerRoute, /projectDtcUsageLimitForResponse\(usage\)/);
  assert.match(adminRoute, /projectDtcUsageLimitForResponse\(usage\)/);
  assert.match(config, /No live DTC AI provider is configured/);
  assert.match(config, /Over-limit requests are rejected before analysis/);
  assert.match(customerRoute, /customerVisible:\s*false/);
  assert.match(adminRoute, /customerVisible:\s*false/);
  assert.match(customerPanel, /DTC Diagnostic Guidance/);
  assert.match(customerPage, /\/api\/requests\/\$\{order\.id\}\/dtc-analysis/);
  assert.match(customerPanel, /role="status"[\s\S]*aria-live="polite"/);
  assert.match(customerPanel, /role="alert"/);
  assert.match(customerPanel, /key: "human\.required_before"/);
  assert.match(customerPanel, /localizeDtcAnalyzerMessage\(locale/);
  assert.match(adminPanel, /DTC Expert Review/);
  assert.match(adminClient, /\/api\/admin\/requests\/\$\{requestId\}\/dtc-analysis/);
  assert.match(adminPanel, /DTC analyzer configuration/);
  assert.match(adminPanel, /Provider availability/);
  assert.match(adminPanel, /Fallback mode/);
  assert.match(adminPanel, /Usage limit/);
  assert.match(adminPanel, /Text and code limits/);
  assert.match(adminPanel, /Usage limit state/);
  assert.match(adminPanel, /Retry after/);
  assert.match(adminPanel, /Provider status/);
  assert.match(adminPanel, /Fallback/);
  assert.doesNotMatch(customerPanel, /configuration|usageLimits|providerId|modelName|promptVersion|providerKind|providerStatus/i);
  assert.doesNotMatch(
    combinedDtcSurface,
    /request_messages|request_internal_notes|admin_notes|storage_path|signed_url|sha256|first_64_bytes_hex|sample_id|rawHex|hex_preview|confirmed fix|DTC-off approved|customer-ready file|checksum result|byte patch approved/i
  );
});

test("DTC rollout readiness runbook stays local-only and names validation gates", () => {
  const runbook = readProjectFile("docs", "dtc-analyzer-rollout-readiness.md");
  const helper = readProjectFile("src", "lib", "dtcAnalyzer", "rolloutReadiness.ts");
  const combined = `${runbook}\n${helper}`;

  assert.match(runbook, /RMAP-FILE-DTC-M5-ROLLOUT-READINESS/);
  assert.match(runbook, /ready_for_operator_review/);
  assert.match(runbook, /provider-unavailable fallback/);
  assert.match(runbook, /provider-error fallback/);
  assert.match(runbook, /usage-limit rejection before analysis and audit generation/);
  assert.match(runbook, /projectDtcRolloutAnalyticsSnapshot/);
  assert.match(runbook, /\.\\node_modules\\.bin\\tsx\.cmd --test tests\\ecu-intelligence\.test\.ts/);
  assert.match(runbook, /\.\\node_modules\\.bin\\tsx\.cmd --test tests\\admin-work-orders\.test\.ts/);
  assert.match(runbook, /\.\\node_modules\\.bin\\tsx\.cmd --test tests\\ui-ux-safety\.test\.ts/);
  assert.match(runbook, /npm run lint/);
  assert.match(runbook, /npm run typecheck/);
  assert.match(runbook, /npm test/);
  assert.match(runbook, /git diff --check/);
  assert.match(runbook, /Autonomous Codex must not perform/);
  assert.match(helper, /dtc-analyzer-rollout-readiness-v1/);
  assert.match(helper, /sanitized local audit metadata/);
  assert.doesNotMatch(combined, /fetch\(|process\.env|getSupabaseAdmin|createClient|\.from\(|OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY/i);
  assert.doesNotMatch(combined, /DTC-off approved|customer-ready file|checksum result|byte patch approved/i);
});

test("customer File Expert UI renders only customer-safe report details", () => {
  const page = readProjectFile("src", "app", "dashboard", "file-expert", "[id]", "page.tsx");
  const reportTranslations = readProjectFile("src", "lib", "i18n", "file-expert-report-translations.ts");
  assert.match(page, /Technical coordinate data, private file fingerprints and binary internals are hidden on customer reports/);
  assert.match(reportTranslations, /Human tuner verification remains required/);
  assert.match(page, /localizeFileExpertFileProfile/);
  assert.match(page, /localizeFileExpertFinding/);
  assert.match(page, /localizeFileExpertAnalyzerEvidence/);
  assert.match(page, /localizeFileExpertVehicleCandidateEvidence/);
  assert.doesNotMatch(page, /job\.executive_summary|job\.error_message|finding\.summary|candidate\.reason/);
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

  assert.match(homepage, /From original file to secure delivery in four clear steps\./);
  assert.match(homepage, /See the complete workflow/);
  assert.match(homepage, /href="\/how-it-works"/);
  assert.match(footer, /How It Works/);
  assert.match(header, /How it works/);
  assert.match(sitemap, /absoluteUrl\("\/how-it-works"\)/);
});

test("How It Works localization is wired for locale routes, homepage and footer", () => {
  const localizedPage = readProjectFile("src", "app", "[locale]", "how-it-works", "page.tsx");
  const copy = readProjectFile("src", "lib", "howItWorksI18n.ts");
  const localizedHomeRoute = readProjectFile("src", "app", "[locale]", "page.tsx");
  const homepage = readProjectFile("src", "app", "page.tsx");
  const homepageLocalization = readProjectFile("src", "lib", "homepageLocalization.tsx");
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
  assert.match(localizedHomeRoute, /HomepageExperience/);
  assert.match(localizedHomeRoute, /includeStructuredData=\{false\}/);
  assert.doesNotMatch(localizedHomeRoute, /LocalizedSeoHome/);
  assert.match(homepage, /href="\/how-it-works"/);
  assert.match(homepageLocalization, /"\/how-it-works"/);
  assert.match(localizedFooter, /localizedPath\(locale, "\/how-it-works"\)/);
  assert.match(sitemap, /localizedUrl\(locale, "\/how-it-works"\)/);
  assert.match(sitemap, /languageAlternates\("\/how-it-works"\)/);
});

test("localized homepages expose page-level service structured data", () => {
  const localizedHomeRoute = readProjectFile("src", "app", "[locale]", "page.tsx");
  const structuredDataSource =
    localizedHomeRoute.match(/function buildLocalizedHomepageJsonLd[\s\S]*?export async function generateMetadata/)?.[0] ??
    "";

  assert.match(localizedHomeRoute, /function buildLocalizedHomepageJsonLd\(locale: LocaleCode\)/);
  assert.match(localizedHomeRoute, /const jsonLd = buildLocalizedHomepageJsonLd\(locale\)/);
  assert.match(structuredDataSource, /"@type": "WebPage"/);
  assert.match(structuredDataSource, /"@id": `\$\{pageUrl\}#page`/);
  assert.match(structuredDataSource, /inLanguage: hreflangByLocale\[locale\]/);
  assert.match(structuredDataSource, /isPartOf: \{ "@id": `\$\{siteUrl\}\/#website` \}/);
  assert.match(structuredDataSource, /about: \{ "@id": `\$\{siteUrl\}\/#organization` \}/);
  assert.match(structuredDataSource, /primaryImageOfPage/);
  assert.match(structuredDataSource, /"@type": "ItemList"/);
  assert.match(structuredDataSource, /"@id": `\$\{pageUrl\}#service-list`/);
  assert.match(structuredDataSource, /itemListElement: publicServiceSlugs\.map/);
  assert.match(structuredDataSource, /const service = getServiceSeo\(slug, locale\)/);
  assert.match(structuredDataSource, /localizedUrl\(locale, `\/services\/\$\{slug\}`\)/);
  assert.doesNotMatch(
    structuredDataSource,
    /credits|Credit|price|payment|storage_path|signed_url|service_role|SUPABASE_SERVICE_ROLE_KEY|admin_note|internal_note|customer_email|source_reference|confidence_score|sample_id|provider|raw|hex|bytePatch|generateMod|checksum|fetch\(|\.rpc\(/i
  );
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

test("tools hub guides customers through a safe request preparation workflow", () => {
  const tools = readProjectFile("src", "app", "tools", "page.tsx");

  assert.match(tools, /const workflowSteps = \[/);
  assert.match(tools, /Recommended workflow/);
  assert.match(tools, /Go from unsure to upload-ready without guessing/);
  assert.match(tools, /\/tools\/file-readiness-check/);
  assert.match(tools, /Run readiness check/);
  assert.match(tools, /\/tools\/request-brief-builder/);
  assert.match(tools, /Build request brief/);
  assert.match(tools, /\/tools\/ecu-read-method-advisor/);
  assert.match(tools, /Plan read method/);
  assert.match(tools, /\/new-request/);
  assert.match(tools, /Start new request/);
  assert.match(tools, /check file readiness, build request briefs, plan ECU read methods/i);
  assert.doesNotMatch(
    tools,
    /type="file"|upload-session|api\/admin|fetch\(|createObjectURL|FileReader|generateMod|bytePatch|writeFile|checksum/i
  );
});

test("public preparation tools are discoverable in sitemap and robots", () => {
  const sitemap = readProjectFile("src", "app", "sitemap.ts");
  const robots = readProjectFile("src", "app", "robots.ts");
  const checker = readProjectFile("scripts", "check-i18n-seo.mjs");

  for (const toolPath of [
    "/tools/file-readiness-check",
    "/tools/request-brief-builder",
    "/tools/ecu-read-method-advisor",
  ]) {
    assert.match(sitemap, new RegExp(toolPath.replaceAll("/", "\\/")));
    assert.match(robots, new RegExp(toolPath.replaceAll("/", "\\/")));
    assert.match(checker, new RegExp(toolPath.replaceAll("/", "\\/")));
  }

  assert.match(sitemap, /priority: path === "\/tools" \? 0\.85 : 0\.8/);
  assert.doesNotMatch(
    sitemap,
    /\/admin|\/dashboard|\/api\/admin|upload-session|storage_path|signed_url|service_role|generateMod|bytePatch|checksum\(/i
  );
  assert.doesNotMatch(
    robots,
    /upload-session|storage_path|signed_url|service_role|generateMod|bytePatch|checksum\(/i
  );
});

test("refreshed homepage uses one compact visible information architecture", () => {
  const homepage = readProjectFile("src", "app", "page.tsx");

  for (const target of [
    'id="vehicle-data"',
    "<DeferredPerformanceTools",
    'id="services"',
    'id="workflow"',
    'id="security"',
    'id="prices"',
    'id="homepage-search-faq"',
    '<Footer variant="homepage" />',
  ]) {
    assert.match(homepage, new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.equal((homepage.match(/<DeferredPerformanceTools\b/g) ?? []).length, 1);
  assert.equal((homepage.match(/id="services"/g) ?? []).length, 1);
  assert.doesNotMatch(
    homepage,
    /homepageFileServiceNavigator|fileServiceAnswerLibrary|homepageCompactResourceGroups|BusinessMarginCalculator|Live Workload|Workshop Command Desk/
  );
});

test("refreshed homepage keeps real tools, safe preparation routes and service discovery", () => {
  const homepage = readProjectFile("src", "app", "page.tsx");

  for (const route of [
    "/api/vehicles?type=brands",
    "/tools/file-readiness-check",
    "/tools/request-brief-builder",
    "/tools/ecu-read-method-advisor",
    "/services/stage-1",
    "/services/stage-2",
    "/services/stage-3",
    "/services/tcu-tuning",
    "/services/ecu-file-check",
    "/file-service#stage-comparison",
  ]) {
    assert.match(
      homepage,
      new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    );
  }
  assert.match(homepage, /data-no-translate/);
  assert.match(homepage, /role="alert"/);
  assert.match(homepage, /aria-live="polite"/);
});

test("refreshed homepage schema describes only visible content", () => {
  const homepage = readProjectFile("src", "app", "page.tsx");

  assert.match(homepage, /homepagePageJsonLd/);
  assert.match(homepage, /homepageFileServiceJsonLd/);
  assert.match(homepage, /homepageFaqJsonLd/);
  assert.match(homepage, /homepageRequestPreparationHowToJsonLd/);
  assert.match(homepage, /"@type": "WebPage"/);
  assert.match(homepage, /"@type": "Service"/);
  assert.match(homepage, /"@type": "FAQPage"/);
  assert.match(homepage, /"@type": "HowTo"/);
  assert.match(homepage, /step: workflowSteps\.map/);
  assert.match(homepage, /mainEntity: faqs\.map/);
  assert.match(homepage, /itemListElement: services\.map/);
  assert.doesNotMatch(homepage, /DefinedTermSet|homepageResourceJsonLd/);
});

test("refreshed homepage exposes navigation on mobile and compact laptops", () => {
  const homepage = readProjectFile("src", "app", "page.tsx");
  const deferredTools = readProjectFile(
    "src",
    "components",
    "tools",
    "DeferredPerformanceTools.tsx"
  );
  const publicSnapshot = readProjectFile(
    "src",
    "components",
    "tools",
    "PublicLogSnapshot.tsx"
  );

  assert.match(homepage, /aria-label="Open navigation"/);
  assert.match(homepage, /w-\[min\(20rem,calc\(100vw-2rem\)\)\]/);
  assert.match(homepage, /overflow-x-hidden/);
  assert.match(homepage, /sm:grid-cols-2 xl:grid-cols-\[repeat\(4,minmax\(0,1fr\)\)_auto\]/);
  assert.match(homepage, /min-h-11/);
  assert.match(homepage, /href: "#tools"/);
  assert.match(deferredTools, /id="tools"[^>]*scroll-mt-24/);
  assert.doesNotMatch(publicSnapshot, /<section id="tools"/);
  assert.match(homepage, /<HomepageHeader[\s\S]*?<main>[\s\S]*?<\/main>[\s\S]*?<Footer variant="homepage"/);
  assert.match(homepage, /handleSearch\(false\)/);
  assert.match(homepage, /handleSearch\(true\)/);
  assert.match(homepage, /role="region" aria-label=\{copy\.publishedRecord\} aria-live="polite"/);
  assert.doesNotMatch(homepage, /text-7xl|text-8xl|py-32/);
});

test("public file service hub is indexable, linked and customer-safe", () => {
  const page = readProjectFile("src", "app", "file-service", "page.tsx");
  const homepage = readProjectFile("src", "app", "page.tsx");
  const header = readProjectFile("src", "components", "PublicSeoHeader.tsx");
  const footer = readProjectFile("src", "components", "Footer.tsx");
  const sitemap = readProjectFile("src", "app", "sitemap.ts");
  const robots = readProjectFile("src", "app", "robots.ts");

  assert.match(page, /export const metadata: Metadata/);
  assert.match(page, /title: `\$\{pageTitle\} \| MG AutoTech`/);
  assert.match(page, /canonical: absoluteUrl\("\/file-service"\)/);
  assert.match(page, /languageAlternates\("\/file-service"\)/);
  assert.match(
    page,
    /Online ECU File Service for Custom ECU & TCU Tuning Files/,
  );
  assert.match(page, /Professional ECU file service for custom tuning files/);
  assert.match(page, /const fileServiceCategories: HubCard\[\]/);
  assert.match(page, /const workflowSteps = \[/);
  assert.match(page, /const linkedResources: HubCard\[\]/);
  assert.match(page, /const safetyBoundaries = \[/);
  assert.match(page, /const fileServiceFaq = \[/);
  assert.match(page, /"@type": "CollectionPage"/);
  assert.match(page, /"@type": "Service"/);
  assert.match(page, /"@type": "FAQPage"/);
  assert.match(page, /"@type": "BreadcrumbList"/);
  assert.match(page, /"@type": "ItemList"/);
  assert.match(page, /JSON\.stringify\(jsonLd\)/);
  assert.match(page, /<PublicSeoHeader \/>/);
  assert.match(page, /<Footer \/>/);

  for (const expectedLink of [
    "/tools/request-brief-builder",
    "/tools/file-readiness-check",
    "/how-it-works",
    "/ecu-platforms",
    "/brands",
    "/services/stage-1",
    "/services/stage-2",
    "/services/stage-3",
    "/services/dpf-off",
    "/brands/audi",
  ]) {
    assert.match(page, new RegExp(`href: "${expectedLink.replace(/\//g, "\\/")}"|href="${expectedLink.replace(/\//g, "\\/")}"`));
  }
  assert.match(page, /href: "\/services"|href="\/services"/);
  assert.match(
    page,
    /href="\/new-request"[\s\S]*data-acquisition-primary-cta/,
    "the broad public hub must expose the registration-first secure request entry"
  );
  assert.match(page, /href="#request-route"[\s\S]*Choose service first/);

  assert.match(homepage, /href: "\/file-service"|href="\/file-service"/);
  assert.match(header, /href=\{href\("\/file-service"\)\}/);
  assert.match(footer, /File Service Hub/);
  assert.match(sitemap, /absoluteUrl\("\/file-service"\)/);
  assert.match(robots, /"\/file-service"/);
  assert.doesNotMatch(
    page,
    /type="file"|upload-session|api\/admin|fetch\(|createObjectURL|FileReader|generateMod|bytePatch|writeFile|storage_path|signed_url|service_role|SUPABASE_SERVICE_ROLE_KEY|admin_note|internal_note|customer_email|source_reference|confidence_score|sample_id|raw|hex/i
  );
});

test("public services catalog is broad, indexable and customer-safe", () => {
  const page = readProjectFile("src", "app", "services", "page.tsx");
  const homepage = readProjectFile("src", "app", "page.tsx");
  const header = readProjectFile("src", "components", "PublicSeoHeader.tsx");
  const toolsHeader = readProjectFile("src", "components", "tools", "ToolsHeader.tsx");
  const footer = readProjectFile("src", "components", "Footer.tsx");
  const metadata = readProjectFile("src", "lib", "servicesPageMetadata.ts");
  const sitemap = readProjectFile("src", "app", "sitemap.ts");
  const robots = readProjectFile("src", "app", "robots.ts");

  assert.match(page, /generateMetadata\(\)[\s\S]*buildServicesMetadata/);
  assert.match(
    page,
    /ECU & TCU file services, organized for serious workshops\./,
  );
  assert.match(page, /Professional file-service catalog/);
  assert.match(page, /More than a basic ECU solutions grid/);
  assert.match(metadata, /runtimePublicAlternates\("\/services"\)/);
  assert.match(page, /const solutionCategories: SolutionCategory\[\]/);

  for (const section of [
    "Performance & drivability",
    "Diesel & aftertreatment",
    "Engine function requests",
    "TCU & gearbox",
    "Diagnostics & file services",
    "Professional support add-ons",
  ]) {
    assert.match(page, new RegExp(section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  for (const service of [
    "Launch control",
    "VMAX OFF",
    "Pop and Bang",
    "DPF",
    "EGR / AGR",
    "AdBlue / SCR",
    "GPF / OPF",
    "NOx",
    "Lambda / O2",
    "TCU tuning",
    "Gearbox torque limit",
    "File expertise",
    "Readout verification",
    "Priority processing",
    "Log file review",
  ]) {
    assert.match(page, new RegExp(service.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(page, /"@type": "CollectionPage"/);
  assert.match(page, /"@type": "Service"/);
  assert.match(page, /"@type": "OfferCatalog"/);
  assert.match(page, /"@type": "ItemList"/);
  assert.match(page, /"@type": "FAQPage"/);
  assert.match(page, /"@type": "BreadcrumbList"/);
  assert.match(page, /JSON\.stringify\(catalogJsonLd\)/);
  assert.match(page, /<PublicSeoHeader locale=\{locale\} \/>/);
  assert.match(page, /<RuntimePublicFooter locale=\{locale\}/);

  assert.match(homepage, /href: "\/services"|href="\/services"/);
  assert.match(header, /href=\{href\("\/services"\)\}[\s\S]*Services/);
  assert.match(toolsHeader, /href="\/services"[\s\S]*Services/);
  assert.match(footer, /Services Overview/);
  assert.match(sitemap, /absoluteUrl\("\/services"\)/);
  assert.match(robots, /"\/services"/);
  assert.doesNotMatch(
    page,
    /type="file"|upload-session|api\/admin|fetch\(|createObjectURL|FileReader|generateMod|bytePatch|writeFile|checksum\(|storage_path|signed_url|service_role|SUPABASE_SERVICE_ROLE_KEY|admin_note|internal_note|customer_email|source_reference|confidence_score|sample_id|raw|hex/i
  );
});

test("localized file service hub is hreflang-ready and linked from localized surfaces", () => {
  const localizedPage = readProjectFile("src", "app", "[locale]", "file-service", "page.tsx");
  const copy = readProjectFile("src", "lib", "fileServiceI18n.ts");
  const localizedHomeRoute = readProjectFile("src", "app", "[locale]", "page.tsx");
  const homepageLocalization = readProjectFile("src", "lib", "homepageLocalization.tsx");
  const localizedFooter = readProjectFile("src", "components", "LocalizedSeoFooter.tsx");
  const i18nRoutes = readProjectFile("src", "lib", "i18nRoutes.ts");
  const sitemap = readProjectFile("src", "app", "sitemap.ts");
  const robots = readProjectFile("src", "app", "robots.ts");

  assert.match(localizedPage, /generateStaticParams/);
  assert.match(localizedPage, /getFileServiceCopy/);
  assert.match(localizedPage, /fileServiceJsonLd/);
  assert.match(localizedPage, /localizedUrl\(locale, "\/file-service"\)/);
  assert.match(localizedPage, /languageAlternates\("\/file-service"\)/);
  assert.match(localizedPage, /title: copy\.pageTitle/);
  assert.doesNotMatch(
    localizedPage,
    /return \{\s*title: `\$\{copy\.pageTitle\} \| MG AutoTech`/
  );
  assert.match(localizedPage, /LocalizedSeoFooter/);
  assert.match(localizedPage, /resolvePublicHref/);
  assert.match(localizedPage, /JSON\.stringify\(jsonLd\)/);
  assert.match(copy, /ECU & TCU File Service Hub/);
  assert.match(copy, /ECU und TCU Dateiservice Hub/);
  assert.match(copy, /ECU ve TCU Dosya Servisi Merkezi/);
  assert.match(copy, /fileServiceJsonLd/);
  assert.match(localizedHomeRoute, /HomepageExperience/);
  assert.match(localizedHomeRoute, /exactTranslations\[locale\]/);
  assert.match(homepageLocalization, /"\/file-service"/);
  assert.match(localizedFooter, /getFileServiceCopy/);
  assert.match(localizedFooter, /localizedPath\(locale, "\/file-service"\)/);
  assert.match(i18nRoutes, /parts\[0\] === "file-service"/);
  assert.match(sitemap, /localizedUrl\(locale, "\/file-service"\)/);
  assert.match(sitemap, /languageAlternates\("\/file-service"\)/);
  assert.match(robots, /`\/\$\{locale\}\/file-service`/);
  assert.doesNotMatch(
    localizedPage + copy,
    /type="file"|upload-session|api\/admin|fetch\(|createObjectURL|FileReader|generateMod|bytePatch|writeFile|storage_path|signed_url|service_role|SUPABASE_SERVICE_ROLE_KEY|admin_note|internal_note|customer_email|source_reference|confidence_score|sample_id|raw|hex/i
  );
});

test("homepage exposes request preparation HowTo structured data from visible steps", () => {
  const homepage = readProjectFile("src", "app", "page.tsx");
  const howToSource =
    homepage.match(/export const homepageRequestPreparationHowToJsonLd = \{[\s\S]*?\n\};/)?.[0] ?? "";

  assert.match(howToSource, /"@type": "HowTo"/);
  assert.match(howToSource, /"@id": publicResourceUrl\("\/#workflow"\)/);
  assert.match(howToSource, /name: "How to use the MG AutoTech file service"/);
  assert.match(howToSource, /step: workflowSteps\.map/);
  assert.match(howToSource, /"@type": "HowToStep"/);
  assert.match(howToSource, /position: index \+ 1/);
  for (const step of ["Register", "Load Credits", "Upload File", "Download File"]) {
    assert.match(homepage, new RegExp(step));
  }
  assert.match(homepage, /type="application\/ld\+json"/);
  assert.match(homepage, /homepageRequestPreparationHowToJsonLd/);
  assert.doesNotMatch(
    howToSource,
    /credits|Credit|price|payment|storage_path|signed_url|service_role|SUPABASE_SERVICE_ROLE_KEY|admin_note|internal_note|customer_email|source_reference|confidence_score|sample_id|provider|raw|hex|bytePatch|generateMod|checksum|fetch\(|\.rpc\(|type="file"|upload-session|FileReader|writeFile/i
  );
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

test("admin File Expert exposes V2 report review gate without customer-ready output claims", () => {
  const adminPage = readProjectFile("src", "app", "admin", "file-expert", "page.tsx");
  const runbook = readProjectFile("docs", "file-expert-v2-review-gates.md");
  const gateSource =
    adminPage.match(/function getAiReportStatusSummary[\s\S]*?export default function AdminFileExpertPage/)?.[0] ?? "";
  const gateUi =
    adminPage.match(/<div className=\{`mt-4 rounded-2xl border p-4[\s\S]*?<div className="mt-4 grid gap-3 sm:grid-cols-2">/)?.[0] ?? "";

  assert.match(adminPage, /ai_report_status/);
  assert.match(gateSource, /Provider-generated report/);
  assert.match(gateSource, /Provider error fallback/);
  assert.match(gateSource, /Deterministic fallback/);
  assert.match(gateUi, /AI review gate/);
  assert.match(gateUi, /Human review required/);
  assert.match(gateUi, /Blocked production actions/);
  assert.match(gateUi, /requestedName/);
  assert.match(gateUi, /executedName/);
  assert.match(runbook, /provider_generated/);
  assert.match(runbook, /deterministic_fallback/);
  assert.match(runbook, /provider_error_fallback/);
  assert.match(runbook, /exportLocked: true/);
  assert.match(runbook, /operator-only decisions/i);
  assert.doesNotMatch(gateUi + runbook, /customer-ready\s+file|safe to flash|checksum completed|automatic delivery is possible/i);
  assert.doesNotMatch(runbook, /SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY|STRIPE_SECRET_KEY|RESEND_API_KEY/);
});

test("Tune Advisor foundation is local-only and expert-review gated", () => {
  const fallback = readProjectFile("src", "lib", "tuneAdvisor", "fallback.ts");
  const service = readProjectFile("src", "lib", "tuneAdvisor", "service.ts");
  const integration = readProjectFile("src", "lib", "tuneAdvisor", "requestIntegration.ts");
  const runbook = readProjectFile("docs", "tune-advisor-foundation.md");
  const combined = `${fallback}\n${service}\n${integration}\n${runbook}`;

  assert.match(fallback, /tune-advisor-v1/);
  assert.match(fallback, /Deterministic non-AI Tune Advisor/);
  assert.match(fallback, /stage_1/);
  assert.match(fallback, /eco_tuning/);
  assert.match(fallback, /tcu_tuning/);
  assert.match(fallback, /only_options/);
  assert.match(fallback, /emissions_or_legal_review/);
  assert.match(fallback, /checksum_not_approved/);
  assert.match(service, /class UnavailableTuneAdvisorProvider/);
  assert.match(service, /buildDeterministicTuneAdvisorFallback/);
  assert.match(integration, /export type CustomerRequestTuneAdvisorAnalysis/);
  assert.match(integration, /export type ExpertRequestTuneAdvisorAnalysis/);
  assert.match(integration, /blockedProductionActions/);
  assert.match(runbook, /RMAP-FILE-AI-TUNE-ADVISOR-M1-FOUNDATION/);
  assert.match(runbook, /provider-unavailable/i);
  assert.match(runbook, /operator approval/i);
  assert.doesNotMatch(combined, /fetch\(|process\.env|getSupabaseAdmin|createClient|\.from\(|OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|RESEND_API_KEY/i);
  assert.doesNotMatch(combined, /customer-ready\s+file|safe to flash|checksum completed|exact \d+\s*(hp|nm)|automatic delivery is possible|MOD generation approved/i);
});

test("Log Analyzer foundation is local-only and projection-gated", () => {
  const fallback = readProjectFile("src", "lib", "logAnalyzer", "fallback.ts");
  const service = readProjectFile("src", "lib", "logAnalyzer", "service.ts");
  const integration = readProjectFile("src", "lib", "logAnalyzer", "requestIntegration.ts");
  const runbook = readProjectFile("docs", "log-analyzer-foundation.md");
  const combined = `${fallback}\n${service}\n${integration}\n${runbook}`;

  assert.match(fallback, /log-analyzer-v1/);
  assert.match(fallback, /Deterministic non-AI Log Analyzer/);
  assert.match(fallback, /calculateLogPowerEstimate/);
  assert.match(fallback, /provider-unavailable/i);
  assert.match(service, /class UnavailableLogAnalyzerProvider/);
  assert.match(service, /buildDeterministicLogAnalyzerFallback/);
  assert.match(integration, /export type CustomerRequestLogAnalyzerAnalysis/);
  assert.match(integration, /export type ExpertRequestLogAnalyzerAnalysis/);
  assert.match(integration, /blockedProductionActions/);
  assert.match(runbook, /RMAP-FILE-AI-LOG-ANALYZER-M1-FOUNDATION/);
  assert.match(runbook, /No raw binary or hex data/i);
  assert.match(runbook, /operator approval/i);
  assert.doesNotMatch(combined, /fetch\(|process\.env|getSupabaseAdmin|createClient|\.from\(|OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|RESEND_API_KEY/i);
  assert.doesNotMatch(combined, /customer-ready\s+file|safe to flash|checksum completed|automatic delivery is possible|MOD generation approved/i);
});

test("AI Explain Layer foundation is local-only and projection-gated", () => {
  const types = readProjectFile("src", "lib", "aiExplain", "types.ts");
  const sourceLabels = readProjectFile("src", "lib", "aiExplain", "sourceLabels.ts");
  const service = readProjectFile("src", "lib", "aiExplain", "service.ts");
  const projection = readProjectFile("src", "lib", "aiExplain", "projection.ts");
  const runbook = readProjectFile("docs", "ai-explain-layer-foundation.md");
  const combined = `${types}\n${sourceLabels}\n${service}\n${projection}\n${runbook}`;

  assert.match(types, /ai-explain-layer-v1/);
  assert.match(types, /provider_unavailable_fallback/);
  assert.match(types, /provider_error_fallback/);
  assert.match(sourceLabels, /evidence/);
  assert.match(sourceLabels, /recommendation/);
  assert.match(sourceLabels, /risk_flag/);
  assert.match(sourceLabels, /human_review_gate/);
  assert.match(sourceLabels, /provider_state/);
  assert.match(sourceLabels, /fallback_state/);
  assert.match(service, /class UnavailableAiExplainProvider/);
  assert.match(service, /buildDeterministicAiExplainFallback/);
  assert.match(projection, /export type CustomerAiExplainProjection/);
  assert.match(projection, /export type ExpertAiExplainProjection/);
  assert.match(projection, /blockedProductionActions/);
  assert.match(runbook, /RMAP-FILE-AI-EXPLAIN-LAYER-M1-FOUNDATION/);
  assert.match(runbook, /Source label kinds/i);
  assert.match(runbook, /provider-unavailable/i);
  assert.match(runbook, /operator approval/i);
  assert.doesNotMatch(combined, /fetch\(|process\.env|getSupabaseAdmin|createClient|\.from\(|OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|RESEND_API_KEY/i);
  assert.doesNotMatch(combined, /customer-ready\s+file|safe to flash|checksum completed|automatic delivery is possible|MOD generation approved/i);
});

test("File Quality Score foundation is local-only and projection-gated", () => {
  const types = readProjectFile("src", "lib", "fileQualityScore", "types.ts");
  const service = readProjectFile("src", "lib", "fileQualityScore", "service.ts");
  const projection = readProjectFile("src", "lib", "fileQualityScore", "projection.ts");
  const runbook = readProjectFile("docs", "file-quality-score-foundation.md");
  const combined = `${types}\n${service}\n${projection}\n${runbook}`;

  assert.match(types, /file-quality-score-v1/);
  assert.match(types, /provider_unavailable_fallback/);
  assert.match(types, /provider_error_fallback/);
  assert.match(service, /Deterministic non-AI File Quality Score/);
  assert.match(service, /class UnavailableFileQualityScoreProvider/);
  assert.match(service, /buildDeterministicFileQualityScoreFallback/);
  assert.match(service, /metadata_completeness/);
  assert.match(service, /integrity_compatibility/);
  assert.match(projection, /export type CustomerFileQualityScoreProjection/);
  assert.match(projection, /export type ExpertFileQualityScoreProjection/);
  assert.match(projection, /weightedFactorBreakdown/);
  assert.match(runbook, /RMAP-FILE-QUALITY-SCORE-M1-FOUNDATION/);
  assert.match(runbook, /No raw binary or hex data/i);
  assert.match(runbook, /operator approval/i);
  assert.doesNotMatch(combined, /fetch\(|process\.env|getSupabaseAdmin|createClient|\.from\(|OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|RESEND_API_KEY/i);
  assert.doesNotMatch(combined, /safe to flash|checksum completed|automatic delivery is possible|MOD generation approved/i);
});

test("i18n and SEO health script catches core multilingual requirements", () => {
  const script = readProjectFile("scripts", "check-i18n-seo.mjs");
  assert.match(script, /expectedLocales/);
  assert.match(script, /language alternates/i);
  assert.match(script, /buildLocalizedHomepageJsonLd/);
  assert.match(script, /Localized homepage structured data is missing WebPage/);
  assert.match(script, /Localized homepage structured data is missing service ItemList/);
  assert.match(script, /homepagePageJsonLd/);
  assert.match(script, /homepageFileServiceJsonLd/);
  assert.match(script, /Root metadata is missing online ECU file service search wording/);
  assert.match(script, /Root metadata is missing TCU File Service search wording/);
  assert.match(script, /Root metadata is missing ECU File Upload Service search wording/);
  assert.match(script, /homepageRequestPreparationHowToJsonLd/);
  assert.match(script, /Compact root homepage contract is missing/);
  assert.match(script, /Compact root homepage is missing visible target/);
  assert.match(script, /Root homepage must render the deferred datalog experience exactly once/);
  assert.match(script, /Compact root homepage still contains obsolete resource/);
  assert.match(script, /src\/app\/file-service\/page\.tsx/);
  assert.match(script, /src\/app\/\[locale\]\/file-service\/page\.tsx/);
  assert.match(script, /src\/lib\/fileServiceI18n\.tsx|src\/lib\/fileServiceI18n\.ts/);
  assert.match(script, /Root homepage does not link to the public file service hub/);
  assert.match(script, /File service hub structured data is missing Service/);
  assert.match(script, /File service hub structured data is missing FAQPage/);
  assert.match(script, /File service hub metadata is missing language alternates/);
  assert.match(script, /Localized file service page is missing File Service language alternates/);
  assert.match(script, /File Service i18n copy is missing/);
  assert.match(script, /i18n route helper does not map File Service routes across locales/);
  assert.match(script, /Sitemap does not include \/file-service/);
  assert.match(script, /Sitemap does not include localized File Service routes/);
  assert.match(script, /Sitemap does not include File Service language alternates/);
  assert.match(script, /robots\.ts should allow \/file-service/);
  assert.match(script, /robots\.ts should allow localized File Service routes/);
  assert.doesNotMatch(script, /SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|RESEND_API_KEY/);
  const output = execFileSync(process.execPath, ["scripts/check-i18n-seo.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.match(output, /i18n\/SEO check passed/);
});
