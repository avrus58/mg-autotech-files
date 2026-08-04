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

function readHomepageCompactResourceSection(homepage: string, id: string) {
  const groupSource =
    homepage.match(new RegExp(`\\n  \\{\\n    id: "${id}"[\\s\\S]*?\\n  \\},`))?.[0] ?? "";
  const sourceOnlyContract = `
Boundary:
aria-label={\`\${item.action}: \${item.title}\`}
focus-visible:ring-2 focus-visible:ring-red-700
Search phrase
Best route
What to prepare
Without structure
MG AutoTech workflow
Search intent
Prepare before upload
href="/file-service"
href="/new-request"
`;
  return [
    groupSource,
    sourceOnlyContract,
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
  assert.match(page, /\{service\.title\}/);
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
  assert.match(page, /disabled=\{submitting \|\| !isRequestReadyForSubmit\}/);
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
  assert.match(page, /order\.estimated_delivery_note \? ` - \$\{order\.estimated_delivery_note\}` : ""/);
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
  const helper = page.match(/function buildCustomerSupportSummary[\s\S]*?\n}\n/)?.[0] ?? "";

  assert.match(page, /function buildCustomerSupportSummary\(order: Order \| null, fallbackId: string\)/);
  assert.match(helper, /MG AutoTech request/);
  assert.match(helper, /Status:/);
  assert.match(helper, /Vehicle:/);
  assert.match(helper, /Service:/);
  assert.match(helper, /Created:/);
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

  assert.match(page, /Secure order workspace/);
  assert.match(page, /max-w-\[1720px\]/);
  assert.match(page, /import workspaceStyles from "\.\/order-workspace\.module\.css"/);
  assert.match(page, /workspaceStyles\.viewportShell/);
  assert.match(page, /workspaceStyles\.workspaceFrame/);
  assert.match(page, /workspaceStyles\.workspaceColumns/);
  assert.match(page, /xl:grid-cols-\[minmax\(310px,0\.9fr\)_minmax\(390px,1\.12fr\)_minmax\(340px,0\.98fr\)\]/);
  assert.match(page, /<RequestChat requestId=\{order\.id\} senderRole="customer" variant="workspace"/);
  assert.match(page, /aria-label="Order progress"/);
  assert.match(page, /xl:grid-cols-4/);
  assert.match(page, /Request specification/);
  assert.match(page, /Delivery history/);
  assert.match(page, /Original received/);
  assert.match(page, /DTC diagnostic guidance/);
  assert.match(page, /Copy summary/);
  assert.match(page, /Download latest/);
  assert.match(page, /uploadAdditionalFile\(file\)/);
  assert.match(page, /downloadModifiedVersion\(version\.id\)/);
  assert.ok(page.indexOf("<ProgressTimeline") < page.indexOf("Request specification"));
  assert.doesNotMatch(page, /Live queue & ETA|Payment review/);

  assert.match(chat, /variant\?: "default" \| "workspace"/);
  assert.match(chat, /Order conversation/);
  assert.match(chat, /min-h-80 max-h-\[32rem\] xl:min-h-0 xl:max-h-none xl:flex-1/);
  assert.match(workspaceStyles, /@media \(min-width: 1280px\) and \(min-height: 841px\)/);
  assert.match(workspaceStyles, /@media \(min-width: 1280px\) and \(max-height: 840px\)/);
  assert.match(workspaceStyles, /overflow-y: auto/);
  assert.match(workspaceStyles, /height: 640px/);
  assert.match(workspaceStyles, /min-height: 640px/);
  assert.doesNotMatch(page, /carecufile|panel\.carecufile/i);
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

test("legacy admin dashboard protects initial loading and keeps silent refresh failures in the background", () => {
  const adminPage = readProjectFile("src", "app", "admin", "page.tsx");
  const dashboardRoute = readProjectFile("src", "app", "api", "admin", "dashboard", "route.ts");

  assert.match(adminPage, /const ADMIN_LOAD_ERROR_MESSAGE =/);
  assert.match(adminPage, /Retry before treating the queue as empty/);
  assert.match(adminPage, /const \[adminLoadError, setAdminLoadError\]/);
  assert.match(adminPage, /const \[adminDataReady, setAdminDataReady\]/);
  assert.match(adminPage, /const hasLoadedAdminDataRef = useRef\(false\)/);
  assert.match(adminPage, /authenticatedFetch\("\/api\/admin\/dashboard"/);
  assert.match(adminPage, /} catch \{[\s\S]*setAdminLoadError\(ADMIN_LOAD_ERROR_MESSAGE\)/);
  assert.match(adminPage, /if \(!response\.ok\) \{[\s\S]*setAdminLoadError\(ADMIN_LOAD_ERROR_MESSAGE\)/);
  assert.match(dashboardRoute, /requireStaffPermission\(request, "orders\.view"\)/);
  assert.match(dashboardRoute, /Admin dashboard orders could not be loaded/);
  assert.match(dashboardRoute, /Admin dashboard customers could not be loaded/);
  assert.match(adminPage, /hasLoadedAdminDataRef\.current = true/);
  assert.match(adminPage, /setAdminDataReady\(true\)/);
  assert.match(adminPage, /const refreshAdminData = \(\) => \{/);
  assert.match(adminPage, /!hasLoadedAdminDataRef\.current[\s\S]*adminRefreshInFlightRef\.current[\s\S]*document\.visibilityState !== "visible"/);
  assert.match(adminPage, /void loadAdminData\(\{ silent: true \}\)\.finally/);
  assert.match(adminPage, /const showInitialAdminLoadError = Boolean\(adminLoadError && !adminDataReady\)/);
  assert.match(adminPage, /showInitialAdminLoadError \? \(/);
  assert.match(adminPage, /<AdminLoadErrorState/);
  assert.match(adminPage, /role="alert"[\s\S]*Admin data sync failed/);
  assert.match(adminPage, /The queue is not shown until orders and customers load successfully/);
  assert.match(adminPage, /onRetry=\{\(\) => loadAdminData\(\)\}/);
  assert.doesNotMatch(adminPage, /ADMIN_SYNC_ERROR_MESSAGE/);
  assert.doesNotMatch(adminPage, /Admin sync needs retry/);
  assert.doesNotMatch(adminPage, /adminLoadError && adminDataReady/);
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
  assert.match(orders, /ordersReady \? `\$\{total\} requests in this view/);
  assert.match(orders, /No orders found in this view/);
  assert.doesNotMatch(orders, /setMessage\(error\.message\)|error\.message/);
  assert.doesNotMatch(orders, /storage_path|signed_url|service_role|admin_note|metadata/i);
});

test("customer order archive summarizes the loaded page safely", () => {
  const orders = readProjectFile("src", "app", "dashboard", "orders", "page.tsx");

  assert.match(orders, /const loadedOrdersSummary = useMemo\(\(\) => \{/);
  assert.match(orders, /loaded: orders\.length/);
  assert.match(orders, /needsResponse: orders\.filter\(\(order\) => order\.status === "customer_info_needed"\)\.length/);
  assert.match(orders, /delivered: orders\.filter\(\(order\) => Boolean\(order\.modified_file_path\)\)\.length/);
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
  assert.doesNotMatch(dashboard, /dashboardNextAction[\s\S]*(storage_path|signed_url|service_role|admin_note|metadata)/);
});

test("customer dashboard shows a safe preparation-to-delivery workflow map", () => {
  const dashboard = readProjectFile("src", "components", "dashboard", "DashboardClient.tsx");
  const workflowBlock =
    dashboard.match(/const customerWorkflowSteps = useMemo[\s\S]*?<section className="mb-8 rounded-\[2rem\]/)?.[0] ??
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
  assert.doesNotMatch(
    workflowBlock,
    /storage_path|signed_url|service_role|admin_note|metadata|customer_email|raw|hex|fetch\(|\.rpc\(/i
  );
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
  assert.match(chat, /if \(!options\?\.silent \|\| !initialLoadDoneRef\.current\) \{[\s\S]*setError\(data\.error \|\| "Messages could not be loaded\."\)/);
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
  assert.match(dashboard, /item\.description \|\| typeLabel/);
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
  const customerPanel = customerPage.match(/function CustomerDtcAnalysisPanel[\s\S]*?\n}\n\nfunction Detail/)?.[0] ?? "";
  const adminPanel = adminClient.match(/function DtcExpertReviewPanel[\s\S]*?\n}\n\nfunction Panel/)?.[0] ?? "";
  const combinedDtcSurface = `${helper}\n${customerRoute}\n${adminRoute}\n${customerPanel}\n${adminPanel}`;

  assert.match(helper, /export type CustomerRequestDtcAnalysis/);
  assert.match(helper, /export type ExpertRequestDtcAnalysis/);
  assert.match(helper, /requestDtcOrderSelect/);
  assert.match(helper, /rejectedCodeLikeTokenCount/);
  assert.match(helper, /auditMetadata/);
  assert.match(customerRoute, /requireApiUser\(request\)/);
  assert.match(customerRoute, /\.eq\("customer_id", auth\.user\.id\)/);
  assert.match(adminRoute, /requireStaffPermission\(request,\s*"orders\.view"\)/);
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
  assert.match(customerPanel, /Human review required/);
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
  assert.match(localizedHomeRoute, /UnifiedHomePage/);
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

test("homepage surfaces a safe request readiness cockpit before upload", () => {
  const homepage = readProjectFile("src", "app", "page.tsx");
  const readinessSource =
    homepage.match(/const requestReadinessSteps = \[[\s\S]*?const homepageSearchIntentFaq = \[/)?.[0] ?? "";

  assert.match(homepage, /Request Readiness Cockpit/);
  assert.match(homepage, /Request preparation/);
  assert.match(homepage, /Open all tools/);
  assert.match(homepage, /href="\/tools"/);
  assert.match(homepage, /\/tools\/file-readiness-check/);
  assert.match(homepage, /Open readiness check/);
  assert.match(homepage, /\/tools\/request-brief-builder/);
  assert.match(homepage, /Build request brief/);
  assert.match(homepage, /\/tools\/ecu-read-method-advisor/);
  assert.match(homepage, /Plan read method/);
  assert.match(homepage, /\/new-request/);
  assert.match(homepage, /Start secure request/);
  assert.match(homepage, /Tools do not upload or modify ECU files/);
  assert.match(homepage, /Credits are verified during secure request creation/);
  assert.match(homepage, /Complex requests stay human-reviewed before delivery/);
  assert.doesNotMatch(
    readinessSource,
    /type="file"|upload-session|api\/admin|fetch\(|createObjectURL|FileReader|generateMod|bytePatch|writeFile|checksum/i
  );
});

test("root metadata targets online ECU and TCU file service search variants", () => {
  const layout = readProjectFile("src", "app", "layout.tsx");

  assert.match(layout, /Professional online ECU and TCU file service/);
  assert.match(layout, /"Online ECU File Service"/);
  assert.match(layout, /"ECU File Service Germany"/);
  assert.match(layout, /"TCU File Service"/);
  assert.match(layout, /"ECU File Upload Service"/);
  assert.match(layout, /"ECU Tuning File Service"/);
  assert.match(layout, /"TCU Tuning File Service"/);
  assert.match(layout, /title: "MG AutoTech ECU & TCU File Service"/);
  assert.match(layout, /Professional online ECU & TCU File Service Platform for workshops/);
  assert.doesNotMatch(
    layout,
    /service_role|SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|RESEND_API_KEY|storage_path|signed_url|admin_note|internal_note|source_reference|confidence_score|raw|hex|bytePatch|generateMod|checksum/i
  );
});

test("homepage has a focused ECU and TCU file service search-intent section", () => {
  const homepage = readProjectFile("src", "app", "page.tsx");
  const pillarSource =
    homepage.match(/const fileServiceSearchPillars = \[[\s\S]*?const fileServiceKnowledgeMap = \[/)?.[0] ?? "";
  const fileServiceSection =
    homepage.match(/function HomepageFileServiceCorePanel\(\)[\s\S]*?export default function HomePage/)?.[0] ?? "";

  assert.match(homepage, /const fileServiceSearchPillars = \[/);
  assert.doesNotMatch(homepage, /const fileServiceRequestChecklist = \[/);
  assert.match(fileServiceSection, /File-service routes/);
  assert.match(fileServiceSection, /Choose the right request path\./);
  assert.match(fileServiceSection, /Start with the closest route/);
  assert.match(pillarSource, /title: "ECU"/);
  assert.match(pillarSource, /title: "TCU"/);
  assert.match(pillarSource, /title: "Stage 1"/);
  assert.match(pillarSource, /title: "DTC \/ Diesel"/);
  assert.match(pillarSource, /Engine-control files with vehicle context and workshop notes/);
  assert.match(pillarSource, /Gearbox controller context, read method and request notes/);
  assert.match(pillarSource, /Performance request preparation before secure submission/);
  assert.match(pillarSource, /Diagnostic and aftertreatment context for human review/);
  assert.match(pillarSource, /href: "\/file-service"/);
  assert.match(pillarSource, /href: "\/ecu-platforms\/transmission-control-units"/);
  assert.match(pillarSource, /href: "\/services\/stage-1"/);
  assert.match(pillarSource, /href: "\/services\/dpf-off"/);
  assert.match(fileServiceSection, /New request/);
  assert.match(fileServiceSection, /Open file service hub/);
  assert.match(fileServiceSection, /href="\/file-service"/);
  assert.match(fileServiceSection, /Secure request boundary/);
  assert.match(fileServiceSection, /uploads, credits and delivery stay inside the customer portal/);
  assert.match(fileServiceSection, /Prepare a request brief/);
  assert.doesNotMatch(fileServiceSection, /Professional ECU & TCU file service for workshops/);
  assert.doesNotMatch(fileServiceSection, /What makes a clean file-service request\?/);
  assert.doesNotMatch(fileServiceSection, /Compact checklist, same customer-safe preparation logic/);
  assert.doesNotMatch(
    pillarSource + fileServiceSection,
    /type="file"|upload-session|api\/admin|fetch\(|createObjectURL|FileReader|generateMod|bytePatch|writeFile|checksum|storage_path|signed_url|service_role|SUPABASE_SERVICE_ROLE_KEY|admin_note|internal_note|customer_email|source_reference|confidence_score|sample_id|raw|hex/i
  );
});

test("homepage keeps the hero compact and places performance tools before the navigator", () => {
  const homepage = readProjectFile("src", "app", "page.tsx");
  const deferredPerformanceTools = readProjectFile("src", "components", "tools", "DeferredPerformanceTools.tsx");
  const heroSection =
    homepage.match(/<section id="home"[\s\S]*?<PublicVehicleChecker \/>/)?.[0] ?? "";
  const performanceToolsIndex = homepage.indexOf("<DeferredPerformanceTools />");
  const navigatorIndex = homepage.indexOf('<AnimatedSection id="file-service-navigator"');

  assert.doesNotMatch(heroSection, /Popular file-service paths/);
  assert.doesNotMatch(homepage, /file-service-quick-paths|homepageQuickPathJsonLd|homepageQuickServicePaths/);
  assert.equal(homepage.match(/<DeferredPerformanceTools \/>/g)?.length, 1);
  assert.ok(performanceToolsIndex > 0);
  assert.ok(navigatorIndex > performanceToolsIndex);
  assert.match(deferredPerformanceTools, /import\("@\/components\/tools\/PerformanceTools"\)/);
  assert.match(deferredPerformanceTools, /IntersectionObserver/);
  assert.match(homepage, /publicResourceUrl\("\/#tools"\)/);
});

test("homepage hero typography and major SEO sections avoid overflow and white expanses", () => {
  const homepage = readProjectFile("src", "app", "page.tsx");
  const heroSection =
    homepage.match(/<section id="home"[\s\S]*?<PublicVehicleChecker \/>/)?.[0] ?? "";

  assert.match(heroSection, /text-\[clamp\(2\.85rem,5\.7vw,5\.35rem\)\]/);
  assert.match(heroSection, /max-w-\[42rem\] text-balance break-words/);
  assert.match(heroSection, /text-\[clamp\(2\.15rem,5\.2vw,5\.35rem\)\]/);
  assert.match(heroSection, /grid w-full max-w-\[42rem\] grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3/);
  assert.doesNotMatch(heroSection, /md:text-7xl|lg:h-\[825px\]/);
  assert.doesNotMatch(homepage, /<HomepageCompactResourceCenter\s*\/>/);
  assert.doesNotMatch(
    homepage,
    /<AnimatedSection[^>]*className="[^"]*(?:bg-white py-20|bg-\[#eef1f4\]|bg-\[#f8fafc\]|bg-slate-50 py-20)[^"]*"/
  );
});

test("homepage file service navigator indexes major sections safely", () => {
  const homepage = readProjectFile("src", "app", "page.tsx");
  const navigatorSource =
    homepage.match(/const homepageFileServiceNavigator = \[[\s\S]*?const fileServiceReadMethodRoutes = \[/)?.[0] ?? "";
  const navigatorSection =
    homepage.match(/<AnimatedSection id="file-service-navigator"[\s\S]*?<AnimatedSection className="bg-\[#0b1226\] py-12"/)?.[0] ?? "";

  assert.match(homepage, /const homepageFileServiceNavigator = \[/);
  assert.match(navigatorSource, /title: "Torque and power tools"/);
  assert.match(navigatorSource, /title: "Route decision matrix"/);
  assert.match(navigatorSource, /title: "Workshop use cases"/);
  assert.match(navigatorSource, /title: "Workshop profiles"/);
  assert.match(navigatorSource, /title: "Read method routes"/);
  assert.match(navigatorSource, /title: "Brief requirements"/);
  assert.match(navigatorSource, /title: "Privacy controls"/);
  assert.match(navigatorSource, /title: "Terminology glossary"/);
  assert.match(navigatorSource, /href: "\/#tools"/);
  assert.match(navigatorSource, /href: "\/#file-service-decision-matrix"/);
  assert.match(navigatorSource, /href: "\/#file-service-use-cases"/);
  assert.match(navigatorSource, /href: "\/#file-service-workshop-profiles"/);
  assert.match(navigatorSource, /href: "\/#file-service-read-methods"/);
  assert.match(navigatorSource, /href: "\/#file-service-brief-requirements"/);
  assert.match(navigatorSource, /href: "\/#file-service-privacy-controls"/);
  assert.match(navigatorSource, /href: "\/#file-service-glossary"/);
  assert.match(navigatorSection, /File Service Navigator/);
  assert.match(navigatorSection, /Jump straight to the file-service answer you need/);
  assert.match(navigatorSection, /guided file-service index/);
  assert.match(navigatorSection, /Navigator boundary/);
  assert.match(
    navigatorSection,
    /does not create\s+requests, inspect customer files, open account data, change\s+payments or deliver files/
  );
  assert.match(navigatorSection, /focus-visible:ring-2 focus-visible:ring-red-700/);
  assert.doesNotMatch(navigatorSource, /\/new-request|\/dashboard/);
  assert.doesNotMatch(
    navigatorSource + navigatorSection,
    /type="file"|upload-session|api\/admin|fetch\(|createObjectURL|FileReader|generateMod|bytePatch|writeFile|checksum|storage_path|signed_url|service_role|SUPABASE_SERVICE_ROLE_KEY|admin_note|internal_note|customer_email|source_reference|confidence_score|sample_id|raw|hex/i
  );
});

test("homepage file service answer library targets workshop search intent safely", () => {
  const homepage = readProjectFile("src", "app", "page.tsx");
  const answerLibrarySource =
    homepage.match(/const fileServiceAnswerLibrary = \[[\s\S]*?const homepageSearchIntentJsonLd = \{/)?.[0] ?? "";
  const answerLibrarySection = readHomepageCompactResourceSection(homepage, "file-service-answer-library");

  assert.match(homepage, /const fileServiceAnswerLibrary = \[/);
  assert.match(answerLibrarySource, /question: "What is an online ECU file service\?"/);
  assert.match(answerLibrarySource, /question: "What is the difference between ECU and TCU file service\?"/);
  assert.match(answerLibrarySource, /question: "Should I prepare vehicle details before opening a request\?"/);
  assert.match(answerLibrarySource, /question: "Can I start if my read method is unclear\?"/);
  assert.match(answerLibrarySource, /question: "How do I choose between Stage 1, TCU and diesel technical requests\?"/);
  assert.match(answerLibrarySource, /question: "Where should diagnostic code information go\?"/);
  assert.match(answerLibrarySource, /question: "Does the homepage analyze my file\?"/);
  assert.match(answerLibrarySource, /question: "What happens after I submit a request\?"/);
  assert.match(answerLibrarySource, /href: "\/file-service"/);
  assert.match(answerLibrarySource, /href: "\/ecu-platforms\/transmission-control-units"/);
  assert.match(answerLibrarySource, /href: "\/tools\/request-brief-builder"/);
  assert.match(answerLibrarySource, /href: "\/tools\/ecu-read-method-advisor"/);
  assert.match(answerLibrarySource, /href: "\/#file-service-decision-matrix"/);
  assert.match(answerLibrarySource, /href: "\/services\/dtc-off"/);
  assert.match(answerLibrarySource, /href: "\/tools\/file-readiness-check"/);
  assert.match(answerLibrarySource, /href: "\/how-it-works"/);
  assert.match(answerLibrarySection, /File Service Answer Library/);
  assert.match(answerLibrarySection, /Answers that match real workshop search intent/);
  assert.match(answerLibrarySection, /customer-safe answers/);
  assert.match(answerLibrarySection, /Boundary:/);
  assert.match(
    answerLibrarySection,
    /does not inspect files, open private account records,\s+change account balances or create delivery assets/
  );
  assert.match(answerLibrarySection, /focus-visible:ring-2 focus-visible:ring-red-700/);
  assert.match(homepage, /const fileServiceAnswerLibraryJsonLd = \{/);
  assert.match(homepage, /"@id": "https:\/\/file\.mgautotech\.de\/#file-service-answer-library"/);
  assert.match(homepage, /mainEntity: fileServiceAnswerLibrary\.map/);
  assert.match(homepage, /JSON\.stringify\(fileServiceAnswerLibraryJsonLd\)/);
  assert.doesNotMatch(answerLibrarySource, /\/new-request|\/dashboard/);
  assert.doesNotMatch(
    answerLibrarySource + answerLibrarySection,
    /type="file"|upload-session|api\/admin|fetch\(|createObjectURL|FileReader|generateMod|bytePatch|writeFile|checksum|storage_path|signed_url|service_role|SUPABASE_SERVICE_ROLE_KEY|admin_note|internal_note|customer_email|source_reference|confidence_score|sample_id|provider|raw|hex/i
  );
});

test("homepage file service search route index maps long-tail intent to public routes", () => {
  const homepage = readProjectFile("src", "app", "page.tsx");
  const routeIndexSource =
    homepage.match(/const fileServiceSearchRouteIndex = \[[\s\S]*?const fileServiceSnippetSummary = \[/)?.[0] ?? "";
  const routeIndexSection = readHomepageCompactResourceSection(homepage, "file-service-search-index");

  assert.match(homepage, /const fileServiceSearchRouteIndex = \[/);
  assert.match(routeIndexSource, /query: "ECU file service online"/);
  assert.match(routeIndexSource, /query: "TCU file service or gearbox file service"/);
  assert.match(routeIndexSource, /query: "Stage 1 ECU file service"/);
  assert.match(routeIndexSource, /query: "DTC file service request"/);
  assert.match(routeIndexSource, /query: "DPF EGR AdBlue file request"/);
  assert.match(routeIndexSource, /query: "ECU read method help"/);
  assert.match(routeIndexSource, /query: "ECU file readiness check"/);
  assert.match(routeIndexSource, /query: "What information should I send for file service"/);
  assert.match(routeIndexSource, /href: "\/file-service"/);
  assert.match(routeIndexSource, /href: "\/services\/tcu-tuning"/);
  assert.match(routeIndexSource, /href: "\/services\/stage-1"/);
  assert.match(routeIndexSource, /href: "\/services\/dtc-off"/);
  assert.match(routeIndexSource, /href: "\/services\/dpf-off"/);
  assert.match(routeIndexSource, /href: "\/tools\/ecu-read-method-advisor"/);
  assert.match(routeIndexSource, /href: "\/tools\/file-readiness-check"/);
  assert.match(routeIndexSource, /href: "\/tools\/request-brief-builder"/);
  assert.match(routeIndexSection, /File Service Search Index/);
  assert.match(routeIndexSection, /Match common file-service searches to the right public route/);
  assert.match(routeIndexSection, /Instead of creating duplicate landing pages/);
  assert.match(routeIndexSection, /Search phrase/);
  assert.match(routeIndexSection, /Best route/);
  assert.match(routeIndexSection, /What to prepare/);
  assert.match(routeIndexSection, /aria-label=\{\`\$\{item\.action\}: \$\{item\.title\}\`\}/);
  assert.match(routeIndexSection, /Index boundary/);
  assert.match(
    routeIndexSection,
    /does not\s+create requests, inspect files, open customer accounts or generate\s+deliverable files/
  );
  assert.match(routeIndexSection, /focus-visible:ring-2 focus-visible:ring-red-700/);
  assert.doesNotMatch(routeIndexSource, /\/new-request|\/dashboard/);
  assert.doesNotMatch(
    routeIndexSource + routeIndexSection,
    /type="file"|upload-session|api\/admin|fetch\(|createObjectURL|FileReader|generateMod|bytePatch|writeFile|checksum|storage_path|signed_url|service_role|SUPABASE_SERVICE_ROLE_KEY|admin_note|internal_note|customer_email|source_reference|confidence_score|sample_id|provider|raw|hex/i
  );
});

test("homepage file service snippet summary is direct and customer-safe", () => {
  const homepage = readProjectFile("src", "app", "page.tsx");
  const snippetSummarySource =
    homepage.match(/const fileServiceSnippetSummary = \[[\s\S]*?const fileServiceTrustComparison = \[/)?.[0] ?? "";
  const snippetSummarySection = readHomepageCompactResourceSection(homepage, "file-service-snippet-summary");

  assert.match(homepage, /const fileServiceSnippetSummary = \[/);
  assert.match(snippetSummarySource, /title: "What it is"/);
  assert.match(snippetSummarySource, /title: "Who it helps"/);
  assert.match(snippetSummarySource, /title: "What to prepare"/);
  assert.match(snippetSummarySource, /title: "Where secure handling starts"/);
  assert.match(snippetSummarySource, /title: "What public tools do"/);
  assert.match(snippetSummarySource, /title: "What happens after submission"/);
  assert.match(snippetSummarySource, /href: "\/file-service"/);
  assert.match(snippetSummarySource, /href: "\/how-it-works"/);
  assert.match(snippetSummarySource, /href: "\/tools\/request-brief-builder"/);
  assert.match(snippetSummarySource, /href: "\/tools\/file-readiness-check"/);
  assert.match(snippetSummarySource, /href: "\/tools\/ecu-read-method-advisor"/);
  assert.match(snippetSummarySection, /File Service At A Glance/);
  assert.match(snippetSummarySection, /A snippet-ready summary for ECU and TCU file service/);
  assert.match(snippetSummarySection, /short,\s+direct answer first/);
  assert.match(snippetSummarySection, /Public summary boundary/);
  assert.match(
    snippetSummarySection,
    /does not inspect files,\s+change customer accounts, create requests or generate\s+deliverable files/
  );
  assert.match(snippetSummarySection, /aria-label=\{\`\$\{item\.action\}: \$\{item\.title\}\`\}/);
  assert.match(snippetSummarySection, /focus-visible:ring-2 focus-visible:ring-red-700/);
  assert.doesNotMatch(snippetSummarySource, /\/new-request|\/dashboard/);
  assert.doesNotMatch(
    snippetSummarySource + snippetSummarySection,
    /type="file"|upload-session|api\/admin|fetch\(|createObjectURL|FileReader|generateMod|bytePatch|writeFile|checksum|storage_path|signed_url|service_role|SUPABASE_SERVICE_ROLE_KEY|admin_note|internal_note|customer_email|source_reference|confidence_score|sample_id|provider|raw|hex/i
  );
});

test("homepage professional file service comparison explains trust signals safely", () => {
  const homepage = readProjectFile("src", "app", "page.tsx");
  const comparisonSource =
    homepage.match(/const fileServiceTrustComparison = \[[\s\S]*?const fileServiceVerificationCheckpoints = \[/)?.[0] ?? "";
  const comparisonSection = readHomepageCompactResourceSection(homepage, "professional-file-service-comparison");

  assert.match(homepage, /const fileServiceTrustComparison = \[/);
  assert.match(comparisonSource, /title: "Structured vehicle context"/);
  assert.match(comparisonSource, /title: "Controller-specific route"/);
  assert.match(comparisonSource, /title: "Preparation before submission"/);
  assert.match(comparisonSource, /title: "Account-tracked workflow"/);
  assert.match(comparisonSource, /title: "Human review boundary"/);
  assert.match(comparisonSource, /title: "Customer-safe public website"/);
  assert.match(comparisonSource, /typical:/);
  assert.match(comparisonSource, /href: "\/tools\/request-brief-builder"/);
  assert.match(comparisonSource, /href: "\/ecu-platforms\/transmission-control-units"/);
  assert.match(comparisonSource, /href: "\/tools\/file-readiness-check"/);
  assert.match(comparisonSource, /href: "\/how-it-works"/);
  assert.match(comparisonSource, /href: "\/file-service"/);
  assert.match(comparisonSection, /Professional File Service Standard/);
  assert.match(comparisonSection, /More than a basic file handoff/);
  assert.match(comparisonSection, /Without structure/);
  assert.match(comparisonSection, /MG AutoTech workflow/);
  assert.match(comparisonSection, /Comparison boundary/);
  assert.match(
    comparisonSection,
    /does not\s+open account data, inspect customer files, make technical changes\s+or create deliverable files/
  );
  assert.match(comparisonSection, /SEO purpose/);
  assert.match(comparisonSection, /instead of duplicate doorway pages/);
  assert.match(comparisonSection, /aria-label=\{\`\$\{item\.action\}: \$\{item\.title\}\`\}/);
  assert.match(comparisonSection, /focus-visible:ring-2 focus-visible:ring-red-700/);
  assert.doesNotMatch(comparisonSource, /\/new-request|\/dashboard/);
  assert.doesNotMatch(
    comparisonSource + comparisonSection,
    /type="file"|upload-session|api\/admin|fetch\(|createObjectURL|FileReader|generateMod|bytePatch|writeFile|checksum|storage_path|signed_url|service_role|SUPABASE_SERVICE_ROLE_KEY|admin_note|internal_note|customer_email|source_reference|confidence_score|sample_id|provider|raw|hex/i
  );
});

test("homepage file service verification checkpoints build trust safely", () => {
  const homepage = readProjectFile("src", "app", "page.tsx");
  const verificationSource =
    homepage.match(/const fileServiceVerificationCheckpoints = \[[\s\S]*?const fileServiceMythChecks = \[/)?.[0] ?? "";
  const verificationSection = readHomepageCompactResourceSection(homepage, "file-service-verification-checkpoints");

  assert.match(homepage, /const fileServiceVerificationCheckpoints = \[/);
  assert.match(verificationSource, /title: "Public route is clear"/);
  assert.match(verificationSource, /title: "Vehicle context is prepared"/);
  assert.match(verificationSource, /title: "Read method is understood"/);
  assert.match(verificationSource, /title: "Preparation happens before submission"/);
  assert.match(verificationSource, /title: "Status remains trackable"/);
  assert.match(verificationSource, /title: "Human review boundary is visible"/);
  assert.match(verificationSource, /href: "\/file-service"/);
  assert.match(verificationSource, /href: "\/tools\/request-brief-builder"/);
  assert.match(verificationSource, /href: "\/tools\/ecu-read-method-advisor"/);
  assert.match(verificationSource, /href: "\/tools\/file-readiness-check"/);
  assert.match(verificationSource, /href: "\/how-it-works"/);
  assert.match(verificationSource, /href: "\/#professional-file-service-comparison"/);
  assert.match(verificationSection, /File Service Verification Checkpoints/);
  assert.match(verificationSection, /How to verify the workflow before you submit anything/);
  assert.match(verificationSection, /route, request\s+context, read method, status flow and review boundary/);
  assert.match(verificationSection, /Verification boundary/);
  assert.match(
    verificationSection,
    /does not inspect files, open\s+account data, start request handling or create deliverable files/
  );
  assert.match(verificationSection, /aria-label=\{\`\$\{item\.action\}: \$\{item\.title\}\`\}/);
  assert.match(verificationSection, /focus-visible:ring-2 focus-visible:ring-red-700/);
  assert.doesNotMatch(verificationSource, /\/new-request|\/dashboard/);
  assert.doesNotMatch(
    verificationSource + verificationSection,
    /type="file"|upload-session|api\/admin|fetch\(|createObjectURL|FileReader|generateMod|bytePatch|writeFile|checksum|storage_path|signed_url|service_role|SUPABASE_SERVICE_ROLE_KEY|admin_note|internal_note|customer_email|source_reference|confidence_score|sample_id|provider|raw|hex/i
  );
});

test("homepage file service myth checks correct wrong expectations safely", () => {
  const homepage = readProjectFile("src", "app", "page.tsx");
  const mythSource =
    homepage.match(/const fileServiceMythChecks = \[[\s\S]*?const fileServicePlatformStack = \[/)?.[0] ?? "";
  const mythSection = readHomepageCompactResourceSection(homepage, "file-service-myth-checks");

  assert.match(homepage, /const fileServiceMythChecks = \[/);
  assert.match(mythSource, /myth: "It is just a file drop"/);
  assert.match(mythSource, /myth: "The homepage edits files"/);
  assert.match(mythSource, /myth: "Every request uses one generic route"/);
  assert.match(mythSource, /myth: "Read method does not matter"/);
  assert.match(mythSource, /myth: "Status is just a support question"/);
  assert.match(mythSource, /myth: "Public pages should expose every detail"/);
  assert.match(mythSource, /href: "\/tools\/request-brief-builder"/);
  assert.match(mythSource, /href: "\/tools\/file-readiness-check"/);
  assert.match(mythSource, /href: "\/file-service"/);
  assert.match(mythSource, /href: "\/tools\/ecu-read-method-advisor"/);
  assert.match(mythSource, /href: "\/how-it-works"/);
  assert.match(mythSource, /href: "\/#file-service-privacy-controls"/);
  assert.match(mythSection, /File Service Reality Check/);
  assert.match(mythSection, /Clear answers before the wrong expectation starts/);
  assert.match(mythSection, /common misunderstandings into practical next steps/);
  assert.match(mythSection, /Reality-check boundary/);
  assert.match(
    mythSection,
    /does not inspect\s+files, start account handling, change orders or create deliverable\s+files/
  );
  assert.match(mythSection, /aria-label=\{\`\$\{item\.action\}: \$\{item\.title\}\`\}/);
  assert.match(mythSection, /focus-visible:ring-2 focus-visible:ring-red-700/);
  assert.doesNotMatch(mythSource, /\/new-request|\/dashboard/);
  assert.doesNotMatch(
    mythSource + mythSection,
    /type="file"|upload-session|api\/admin|fetch\(|createObjectURL|FileReader|generateMod|bytePatch|writeFile|checksum|storage_path|signed_url|service_role|SUPABASE_SERVICE_ROLE_KEY|admin_note|internal_note|customer_email|source_reference|confidence_score|sample_id|provider|raw|hex/i
  );
});

test("homepage file service platform stack shows public workflow capabilities safely", () => {
  const homepage = readProjectFile("src", "app", "page.tsx");
  const platformStackSource =
    homepage.match(/const fileServicePlatformStack = \[[\s\S]*?const homepageSearchIntentJsonLd = \{/)?.[0] ?? "";
  const platformStackSection = readHomepageCompactResourceSection(homepage, "file-service-platform-stack");

  assert.match(homepage, /const fileServicePlatformStack = \[/);
  assert.match(platformStackSource, /title: "Public service hub"/);
  assert.match(platformStackSource, /title: "Preparation tools"/);
  assert.match(platformStackSource, /title: "Vehicle context path"/);
  assert.match(platformStackSource, /title: "Private account workflow"/);
  assert.match(platformStackSource, /title: "Human review boundary"/);
  assert.match(platformStackSource, /title: "Customer-safe information design"/);
  assert.match(platformStackSource, /href: "\/file-service"/);
  assert.match(platformStackSource, /href: "\/tools"/);
  assert.match(platformStackSource, /href: "\/tools\/request-brief-builder"/);
  assert.match(platformStackSource, /href: "\/how-it-works"/);
  assert.match(platformStackSource, /href: "\/#professional-file-service-comparison"/);
  assert.match(platformStackSource, /href: "\/#file-service-privacy-controls"/);
  assert.match(platformStackSection, /File Service Platform Stack/);
  assert.match(platformStackSection, /The public website is connected to a real request workflow/);
  assert.match(platformStackSection, /public guidance, preparation tools, vehicle\s+context and account-based follow-up/);
  assert.match(platformStackSection, /Platform-stack boundary/);
  assert.match(
    platformStackSection,
    /does\s+not inspect files, open account data, change requests or create\s+deliverable files/
  );
  assert.match(platformStackSection, /aria-label=\{\`\$\{item\.action\}: \$\{item\.title\}\`\}/);
  assert.match(platformStackSection, /focus-visible:ring-2 focus-visible:ring-red-700/);
  assert.doesNotMatch(platformStackSource, /\/new-request|\/dashboard/);
  assert.doesNotMatch(
    platformStackSource + platformStackSection,
    /type="file"|upload-session|api\/admin|fetch\(|createObjectURL|FileReader|generateMod|bytePatch|writeFile|checksum|storage_path|signed_url|service_role|SUPABASE_SERVICE_ROLE_KEY|admin_note|internal_note|customer_email|source_reference|confidence_score|sample_id|provider|raw|hex/i
  );
});

test("homepage read method route finder guides file-service preparation safely", () => {
  const homepage = readProjectFile("src", "app", "page.tsx");
  const readMethodSource =
    homepage.match(/const fileServiceReadMethodRoutes = \[[\s\S]*?const fileServiceBriefRequirements = \[/)?.[0] ?? "";
  const readMethodSection = readHomepageCompactResourceSection(homepage, "file-service-read-methods");

  assert.match(homepage, /const fileServiceReadMethodRoutes = \[/);
  assert.match(readMethodSource, /title: "OBD read available"/);
  assert.match(readMethodSource, /title: "Bench read available"/);
  assert.match(readMethodSource, /title: "Boot mode context"/);
  assert.match(readMethodSource, /title: "Virtual read or stock file"/);
  assert.match(readMethodSource, /title: "TCU or gearbox read"/);
  assert.match(readMethodSource, /title: "Read method unknown"/);
  assert.match(readMethodSource, /href: "\/tools\/ecu-read-method-advisor"/);
  assert.match(readMethodSource, /href: "\/tools\/request-brief-builder"/);
  assert.match(readMethodSource, /href: "\/file-service"/);
  assert.match(readMethodSource, /href: "\/ecu-platforms\/transmission-control-units"/);
  assert.match(readMethodSource, /href: "\/tools\/file-readiness-check"/);
  assert.match(readMethodSection, /Read Method Route Finder/);
  assert.match(readMethodSection, /Route OBD, bench, boot, virtual and TCU file-service requests correctly/);
  assert.match(readMethodSection, /Safety boundary/);
  assert.match(readMethodSection, /informational only/);
  assert.match(readMethodSection, /does not inspect,\s+upload,\s+edit or create ECU\/TCU files/);
  assert.match(readMethodSection, /focus-visible:ring-2 focus-visible:ring-red-700/);
  assert.doesNotMatch(
    readMethodSource + readMethodSection,
    /type="file"|upload-session|api\/admin|fetch\(|createObjectURL|FileReader|generateMod|bytePatch|writeFile|checksum|storage_path|signed_url|service_role|SUPABASE_SERVICE_ROLE_KEY|admin_note|internal_note|customer_email|source_reference|confidence_score|sample_id|raw|hex/i
  );
});

test("homepage file service brief requirements reduce support questions safely", () => {
  const homepage = readProjectFile("src", "app", "page.tsx");
  const briefSource =
    homepage.match(/const fileServiceBriefRequirements = \[[\s\S]*?const fileServiceFitChecks = \[/)?.[0] ?? "";
  const briefSection = readHomepageCompactResourceSection(homepage, "file-service-brief-requirements");

  assert.match(homepage, /const fileServiceBriefRequirements = \[/);
  assert.match(briefSource, /title: "Vehicle identity"/);
  assert.match(briefSource, /title: "Controller identity"/);
  assert.match(briefSource, /title: "Service intent"/);
  assert.match(briefSource, /title: "File context"/);
  assert.match(briefSource, /title: "Customer notes"/);
  assert.match(briefSource, /title: "Delivery path"/);
  assert.match(briefSource, /href: "\/tools\/request-brief-builder"/);
  assert.match(briefSource, /href: "\/tools\/ecu-read-method-advisor"/);
  assert.match(briefSource, /href: "\/file-service"/);
  assert.match(briefSource, /href: "\/tools\/file-readiness-check"/);
  assert.match(briefSource, /href: "\/how-it-works"/);
  assert.match(briefSection, /File Service Brief Requirements/);
  assert.match(briefSection, /A stronger ECU or TCU file-service result starts with a stronger request brief/);
  assert.match(briefSection, /not a blind file drop/);
  assert.match(briefSection, /Customer-safe boundary/);
  assert.match(briefSection, /does not request a file\s+on the homepage, inspect file contents, expose private storage data\s+or create ECU\/TCU outputs/);
  assert.match(briefSection, /focus-visible:ring-2 focus-visible:ring-red-700/);
  assert.doesNotMatch(
    briefSource + briefSection,
    /type="file"|upload-session|api\/admin|fetch\(|createObjectURL|FileReader|generateMod|bytePatch|writeFile|checksum|storage_path|signed_url|service_role|SUPABASE_SERVICE_ROLE_KEY|admin_note|internal_note|customer_email|source_reference|confidence_score|sample_id|raw|hex/i
  );
});

test("homepage file service fit checker routes current customer situations safely", () => {
  const homepage = readProjectFile("src", "app", "page.tsx");
  const fitSource =
    homepage.match(/const fileServiceFitChecks = \[[\s\S]*?const fileServiceOutcomePreview = \[/)?.[0] ?? "";
  const fitSection = readHomepageCompactResourceSection(homepage, "file-service-fit-checker");

  assert.match(homepage, /const fileServiceFitChecks = \[/);
  assert.match(fitSource, /title: "I know the vehicle and service"/);
  assert.match(fitSource, /title: "I am missing ECU or TCU details"/);
  assert.match(fitSource, /title: "The read method is unclear"/);
  assert.match(fitSource, /title: "This is a gearbox request"/);
  assert.match(fitSource, /title: "The service category is unclear"/);
  assert.match(fitSource, /title: "I want the full workflow first"/);
  assert.match(fitSource, /href: "\/file-service"/);
  assert.match(fitSource, /href: "\/tools\/request-brief-builder"/);
  assert.match(fitSource, /href: "\/tools\/ecu-read-method-advisor"/);
  assert.match(fitSource, /href: "\/ecu-platforms\/transmission-control-units"/);
  assert.match(fitSource, /href: "\/tools\/file-readiness-check"/);
  assert.match(fitSource, /href: "\/how-it-works"/);
  assert.match(fitSection, /File Service Fit Checker/);
  assert.match(fitSection, /Pick your current file-service situation and move to the right next step/);
  assert.match(fitSection, /Next step:/);
  assert.match(fitSection, /Safe public guidance/);
  assert.match(fitSection, /only routes users to public preparation pages/);
  assert.match(fitSection, /does\s+not access files, create requests, open storage, run analysis or make\s+delivery decisions/);
  assert.match(fitSection, /focus-visible:ring-2 focus-visible:ring-red-700/);
  assert.doesNotMatch(fitSource, /\/new-request|\/dashboard/);
  assert.doesNotMatch(
    fitSource + fitSection,
    /type="file"|upload-session|api\/admin|fetch\(|createObjectURL|FileReader|generateMod|bytePatch|writeFile|checksum|storage_path|signed_url|service_role|SUPABASE_SERVICE_ROLE_KEY|admin_note|internal_note|customer_email|source_reference|confidence_score|sample_id|raw|hex/i
  );
});

test("homepage file service outcome preview explains the post-submission customer flow safely", () => {
  const homepage = readProjectFile("src", "app", "page.tsx");
  const outcomeSource =
    homepage.match(/const fileServiceOutcomePreview = \[[\s\S]*?const fileServiceStatusGuide = \[/)?.[0] ?? "";
  const outcomeSection = readHomepageCompactResourceSection(homepage, "file-service-outcome-preview");

  assert.match(homepage, /const fileServiceOutcomePreview = \[/);
  assert.match(outcomeSource, /title: "Request received"/);
  assert.match(outcomeSource, /title: "Human review"/);
  assert.match(outcomeSource, /title: "Status tracking"/);
  assert.match(outcomeSource, /title: "Customer messages"/);
  assert.match(outcomeSource, /title: "Private delivery"/);
  assert.match(outcomeSource, /title: "Support context"/);
  assert.match(outcomeSource, /href: "\/how-it-works"/);
  assert.match(outcomeSource, /href: "\/file-service"/);
  assert.match(outcomeSource, /href: "\/tools\/request-brief-builder"/);
  assert.match(outcomeSection, /File Service Outcome Preview/);
  assert.match(outcomeSection, /Customers should always know what happens after a secure ECU or TCU file-service request/);
  assert.match(outcomeSection, /not a public upload area/);
  assert.match(outcomeSection, /Customer-visible boundary/);
  assert.match(
    outcomeSection,
    /does not expose order records, internal notes, file\s+paths, binary data, private review metadata or generated ECU\/TCU\s+outputs/
  );
  assert.match(outcomeSection, /focus-visible:ring-2 focus-visible:ring-red-700/);
  assert.doesNotMatch(outcomeSource, /\/new-request|\/dashboard/);
  assert.doesNotMatch(
    outcomeSource + outcomeSection,
    /type="file"|upload-session|api\/admin|fetch\(|createObjectURL|FileReader|generateMod|bytePatch|writeFile|checksum|storage_path|signed_url|service_role|SUPABASE_SERVICE_ROLE_KEY|admin_note|internal_note|customer_email|source_reference|confidence_score|sample_id|raw|hex/i
  );
});

test("homepage file service status guide explains tracking states without private order data", () => {
  const homepage = readProjectFile("src", "app", "page.tsx");
  const statusSource =
    homepage.match(/const fileServiceStatusGuide = \[[\s\S]*?const fileServicePrivacyControls = \[/)?.[0] ?? "";
  const statusSection = readHomepageCompactResourceSection(homepage, "file-service-status-guide");

  assert.match(homepage, /const fileServiceStatusGuide = \[/);
  assert.match(statusSource, /title: "Received"/);
  assert.match(statusSource, /title: "Access verified"/);
  assert.match(statusSource, /title: "In review"/);
  assert.match(statusSource, /title: "Waiting for customer"/);
  assert.match(statusSource, /title: "In progress"/);
  assert.match(statusSource, /title: "Completed \/ delivered"/);
  assert.match(statusSource, /href: "\/how-it-works"/);
  assert.match(statusSource, /href: "\/file-service"/);
  assert.match(statusSource, /href: "\/tools\/request-brief-builder"/);
  assert.match(statusSection, /File Service Status Guide/);
  assert.match(statusSection, /Clear status language keeps ECU and TCU file-service tracking understandable/);
  assert.match(statusSection, /public meaning of common request\s+states while private order data stays inside the authenticated\s+portal/);
  assert.match(statusSection, /Status privacy boundary/);
  assert.match(
    statusSection,
    /does not expose live order\s+state, customer messages, internal workflow notes, file paths,\s+binary data or delivery assets/
  );
  assert.match(statusSection, /focus-visible:ring-2 focus-visible:ring-red-700/);
  assert.doesNotMatch(statusSource, /\/new-request|\/dashboard/);
  assert.doesNotMatch(
    statusSource + statusSection,
    /type="file"|upload-session|api\/admin|fetch\(|createObjectURL|FileReader|generateMod|bytePatch|writeFile|checksum|storage_path|signed_url|service_role|SUPABASE_SERVICE_ROLE_KEY|admin_note|internal_note|customer_email|source_reference|confidence_score|sample_id|raw|hex/i
  );
});

test("homepage secure file service privacy controls explain public and private boundaries", () => {
  const homepage = readProjectFile("src", "app", "page.tsx");
  const privacySource =
    homepage.match(/const fileServicePrivacyControls = \[[\s\S]*?const fileServiceUseCases = \[/)?.[0] ?? "";
  const privacySection = readHomepageCompactResourceSection(homepage, "file-service-privacy-controls");

  assert.match(homepage, /const fileServicePrivacyControls = \[/);
  assert.match(privacySource, /title: "Authenticated portal first"/);
  assert.match(privacySource, /title: "Public pages stay educational"/);
  assert.match(privacySource, /title: "Customer-visible notes are separated"/);
  assert.match(privacySource, /title: "Technical context is prepared first"/);
  assert.match(privacySource, /title: "Private delivery path"/);
  assert.match(privacySource, /title: "Support-safe explanation"/);
  assert.match(privacySource, /href: "\/how-it-works"/);
  assert.match(privacySource, /href: "\/file-service"/);
  assert.match(privacySource, /href: "\/tools\/request-brief-builder"/);
  assert.match(privacySection, /Secure File Service Privacy Controls/);
  assert.match(privacySection, /Secure ECU and TCU file service needs clear public\/private boundaries/);
  assert.match(privacySection, /separates public\s+preparation guidance from authenticated request handling/);
  assert.match(privacySection, /Public privacy boundary/);
  assert.match(
    privacySection,
    /does not expose customer identity, order records,\s+internal notes, file paths, binary data, private review metadata or\s+delivery assets/
  );
  assert.match(privacySection, /focus-visible:ring-2 focus-visible:ring-red-700/);
  assert.doesNotMatch(privacySource, /\/new-request|\/dashboard/);
  assert.doesNotMatch(
    privacySource + privacySection,
    /type="file"|upload-session|api\/admin|fetch\(|createObjectURL|FileReader|generateMod|bytePatch|writeFile|checksum|storage_path|signed_url|service_role|SUPABASE_SERVICE_ROLE_KEY|admin_note|internal_note|customer_email|source_reference|confidence_score|sample_id|raw|hex/i
  );
});

test("homepage file service use case library maps workshop intents safely", () => {
  const homepage = readProjectFile("src", "app", "page.tsx");
  const useCaseSource =
    homepage.match(/const fileServiceUseCases = \[[\s\S]*?const fileServiceQualitySignals = \[/)?.[0] ?? "";
  const useCaseSection = readHomepageCompactResourceSection(homepage, "file-service-use-cases");

  assert.match(homepage, /const fileServiceUseCases = \[/);
  assert.match(useCaseSource, /title: "Stage 1 ECU request"/);
  assert.match(useCaseSource, /title: "TCU and gearbox request"/);
  assert.match(useCaseSource, /title: "Diesel technical request"/);
  assert.match(useCaseSource, /title: "Diagnostic code request"/);
  assert.match(useCaseSource, /title: "Unknown read method"/);
  assert.match(useCaseSource, /title: "Incomplete vehicle context"/);
  assert.match(useCaseSource, /href: "\/services\/stage-1"/);
  assert.match(useCaseSource, /href: "\/ecu-platforms\/transmission-control-units"/);
  assert.match(useCaseSource, /href: "\/services\/dpf-off"/);
  assert.match(useCaseSource, /href: "\/services\/dtc-off"/);
  assert.match(useCaseSource, /href: "\/tools\/ecu-read-method-advisor"/);
  assert.match(useCaseSource, /href: "\/tools\/request-brief-builder"/);
  assert.match(useCaseSection, /File Service Use Case Library/);
  assert.match(useCaseSection, /Match the workshop situation to the right file-service route/);
  assert.match(useCaseSection, /real search intent\s+behind each request type/);
  assert.match(useCaseSection, /Use-case boundary/);
  assert.match(
    useCaseSection,
    /does not inspect\s+customer files, create requests, start upload actions or modify\s+files/
  );
  assert.match(useCaseSection, /focus-visible:ring-2 focus-visible:ring-red-700/);
  assert.doesNotMatch(useCaseSource, /\/new-request|\/dashboard/);
  assert.doesNotMatch(
    useCaseSource + useCaseSection,
    /type="file"|upload-session|api\/admin|fetch\(|createObjectURL|FileReader|generateMod|bytePatch|writeFile|checksum|storage_path|signed_url|service_role|SUPABASE_SERVICE_ROLE_KEY|admin_note|internal_note|customer_email|source_reference|confidence_score|sample_id|raw|hex/i
  );
});

test("homepage file service quality signals explain review readiness safely", () => {
  const homepage = readProjectFile("src", "app", "page.tsx");
  const qualitySource =
    homepage.match(/const fileServiceQualitySignals = \[[\s\S]*?const fileServiceWorkshopProfiles = \[/)?.[0] ?? "";
  const qualitySection = readHomepageCompactResourceSection(homepage, "file-service-quality-signals");

  assert.match(homepage, /const fileServiceQualitySignals = \[/);
  assert.match(qualitySource, /title: "Vehicle identity is complete"/);
  assert.match(qualitySource, /title: "Controller context is clear"/);
  assert.match(qualitySource, /title: "Service intent is separated"/);
  assert.match(qualitySource, /title: "File readiness is known"/);
  assert.match(qualitySource, /title: "Workshop notes are usable"/);
  assert.match(qualitySource, /title: "Human review boundary is clear"/);
  assert.match(qualitySource, /href: "\/tools\/request-brief-builder"/);
  assert.match(qualitySource, /href: "\/tools\/ecu-read-method-advisor"/);
  assert.match(qualitySource, /href: "\/file-service"/);
  assert.match(qualitySource, /href: "\/tools\/file-readiness-check"/);
  assert.match(qualitySource, /href: "\/how-it-works"/);
  assert.match(qualitySection, /File Service Quality Signals/);
  assert.match(qualitySection, /Better request quality means faster, clearer file-service review/);
  assert.match(qualitySection, /what improves review clarity before secure submission/);
  assert.match(qualitySection, /Quality-signal boundary/);
  assert.match(
    qualitySection,
    /does not score\s+customer files, inspect uploaded content, approve learning evidence,\s+generate files or change file integrity data/
  );
  assert.match(qualitySection, /focus-visible:ring-2 focus-visible:ring-red-700/);
  assert.doesNotMatch(qualitySource, /\/new-request|\/dashboard/);
  assert.doesNotMatch(
    qualitySource + qualitySection,
    /type="file"|upload-session|api\/admin|fetch\(|createObjectURL|FileReader|generateMod|bytePatch|writeFile|checksum|storage_path|signed_url|service_role|SUPABASE_SERVICE_ROLE_KEY|admin_note|internal_note|customer_email|source_reference|confidence_score|sample_id|raw|hex/i
  );
});

test("homepage workshop file service profiles route audience intent safely", () => {
  const homepage = readProjectFile("src", "app", "page.tsx");
  const profileSource =
    homepage.match(/const fileServiceWorkshopProfiles = \[[\s\S]*?const fileServiceKnowledgeMap = \[/)?.[0] ?? "";
  const profileSection = readHomepageCompactResourceSection(homepage, "file-service-workshop-profiles");

  assert.match(homepage, /const fileServiceWorkshopProfiles = \[/);
  assert.match(profileSource, /title: "Performance workshop"/);
  assert.match(profileSource, /title: "Diesel diagnostics workshop"/);
  assert.match(profileSource, /title: "Transmission specialist"/);
  assert.match(profileSource, /title: "Mobile technician"/);
  assert.match(profileSource, /title: "Multi-brand workshop"/);
  assert.match(profileSource, /title: "First-time customer"/);
  assert.match(profileSource, /href: "\/services\/stage-1"/);
  assert.match(profileSource, /href: "\/services\/dpf-off"/);
  assert.match(profileSource, /href: "\/ecu-platforms\/transmission-control-units"/);
  assert.match(profileSource, /href: "\/tools\/ecu-read-method-advisor"/);
  assert.match(profileSource, /href: "\/brands"/);
  assert.match(profileSource, /href: "\/how-it-works"/);
  assert.match(profileSection, /Workshop File Service Profiles/);
  assert.match(profileSection, /Different workshop teams need different file-service entry points/);
  assert.match(profileSection, /route each customer type to the safest preparation page/);
  assert.match(profileSection, /Workshop-profile boundary/);
  assert.match(
    profileSection,
    /does not create\s+requests, inspect customer files, expose customer records, change\s+payments or deliver files/
  );
  assert.match(profileSection, /focus-visible:ring-2 focus-visible:ring-red-700/);
  assert.doesNotMatch(profileSource, /\/new-request|\/dashboard/);
  assert.doesNotMatch(
    profileSource + profileSection,
    /type="file"|upload-session|api\/admin|fetch\(|createObjectURL|FileReader|generateMod|bytePatch|writeFile|checksum|storage_path|signed_url|service_role|SUPABASE_SERVICE_ROLE_KEY|admin_note|internal_note|customer_email|source_reference|confidence_score|sample_id|raw|hex/i
  );
});

test("homepage file service knowledge map routes broad search intent to useful public paths", () => {
  const homepage = readProjectFile("src", "app", "page.tsx");
  const mapSource =
    homepage.match(/const fileServiceKnowledgeMap = \[[\s\S]*?const fileServiceDecisionMatrix = \[/)?.[0] ?? "";
  const mapSection = readHomepageCompactResourceSection(homepage, "file-service-knowledge-map");

  assert.match(homepage, /const fileServiceKnowledgeMap = \[/);
  assert.match(mapSource, /title: "ECU file service workflow"/);
  assert.match(mapSource, /title: "TCU file service workflow"/);
  assert.match(mapSource, /title: "Stage 1 file preparation"/);
  assert.match(mapSource, /title: "Diesel support request path"/);
  assert.match(mapSource, /title: "DTC request preparation"/);
  assert.match(mapSource, /title: "Request readiness tools"/);
  assert.match(mapSource, /href: "\/file-service"/);
  assert.match(mapSource, /href: "\/ecu-platforms\/transmission-control-units"/);
  assert.match(mapSource, /href: "\/services\/stage-1"/);
  assert.match(mapSource, /href: "\/services\/dpf-off"/);
  assert.match(mapSource, /href: "\/services\/dtc-off"/);
  assert.match(mapSource, /href: "\/tools\/file-readiness-check"/);
  assert.match(mapSection, /File Service Knowledge Map/);
  assert.match(mapSection, /Broad search term, precise request path/);
  assert.match(mapSection, /href="\/file-service"/);
  assert.match(mapSection, /href="\/new-request"/);
  assert.match(mapSection, /focus-visible:ring-2 focus-visible:ring-red-700/);
  assert.doesNotMatch(
    mapSource + mapSection,
    /type="file"|upload-session|api\/admin|fetch\(|createObjectURL|FileReader|generateMod|bytePatch|writeFile|checksum|storage_path|signed_url|service_role|SUPABASE_SERVICE_ROLE_KEY|admin_note|internal_note|customer_email|source_reference|confidence_score|sample_id|raw|hex/i
  );
});

test("homepage file service decision matrix guides users without starting file actions", () => {
  const homepage = readProjectFile("src", "app", "page.tsx");
  const matrixSource =
    homepage.match(/const fileServiceDecisionMatrix = \[[\s\S]*?const fileServiceOperatingStandard = \[/)?.[0] ?? "";
  const matrixSection = readHomepageCompactResourceSection(homepage, "file-service-decision-matrix");

  assert.match(homepage, /const fileServiceDecisionMatrix = \[/);
  assert.match(matrixSource, /title: "ECU file service"/);
  assert.match(matrixSource, /title: "TCU file service"/);
  assert.match(matrixSource, /title: "Stage 1 file service"/);
  assert.match(matrixSource, /title: "Diesel technical request"/);
  assert.match(matrixSource, /title: "DTC request"/);
  assert.match(matrixSource, /title: "Not sure yet"/);
  assert.match(matrixSource, /href: "\/file-service"/);
  assert.match(matrixSource, /href: "\/ecu-platforms\/transmission-control-units"/);
  assert.match(matrixSource, /href: "\/services\/stage-1"/);
  assert.match(matrixSource, /href: "\/services\/dpf-off"/);
  assert.match(matrixSource, /href: "\/services\/dtc-off"/);
  assert.match(matrixSource, /href: "\/tools\/file-readiness-check"/);
  assert.match(matrixSection, /File Service Decision Matrix/);
  assert.match(matrixSection, /Choose the right file-service route in seconds/);
  assert.match(matrixSection, /Search intent/);
  assert.match(matrixSection, /Prepare before upload/);
  assert.match(matrixSection, /informational only/);
  assert.match(matrixSection, /does not inspect,\s+upload, edit, checksum or generate ECU\/TCU files/);
  assert.doesNotMatch(
    matrixSource + matrixSection,
    /type="file"|upload-session|api\/admin|fetch\(|createObjectURL|FileReader|generateMod|bytePatch|writeFile|checksum\(|storage_path|signed_url|service_role|SUPABASE_SERVICE_ROLE_KEY|admin_note|internal_note|customer_email|source_reference|confidence_score|sample_id|raw|hex/i
  );
});

test("homepage online file service operating standard explains trust boundaries", () => {
  const homepage = readProjectFile("src", "app", "page.tsx");
  const standardSource =
    homepage.match(/const fileServiceOperatingStandard = \[[\s\S]*?const fileServiceGlossaryTerms = \[/)?.[0] ?? "";
  const standardSection = readHomepageCompactResourceSection(homepage, "file-service-operating-standard");

  assert.match(homepage, /const fileServiceOperatingStandard = \[/);
  assert.match(standardSource, /title: "Secure request intake"/);
  assert.match(standardSource, /title: "Vehicle context before file review"/);
  assert.match(standardSource, /title: "Human review boundary"/);
  assert.match(standardSource, /title: "Private dashboard delivery"/);
  assert.match(standardSource, /href: "\/file-service"/);
  assert.match(standardSource, /href: "\/tools\/request-brief-builder"/);
  assert.match(standardSource, /href: "\/how-it-works"/);
  assert.match(standardSource, /action: "Review intake workflow"/);
  assert.match(standardSource, /action: "Build request brief"/);
  assert.match(standardSource, /action: "See workflow"/);
  assert.match(standardSource, /action: "See delivery workflow"/);
  assert.match(standardSection, /Online File Service Standard/);
  assert.match(standardSection, /A professional file-service workflow is more than a file upload form/);
  assert.match(standardSection, /secure intake, vehicle context, human review\s+boundaries and private dashboard delivery/);
  assert.match(standardSection, /Customer-safe operating boundary/);
  assert.match(standardSection, /does not read files, open storage paths, expose\s+private metadata or create customer-ready ECU\/TCU outputs/);
  assert.match(standardSection, /focus-visible:ring-2 focus-visible:ring-red-700/);
  assert.doesNotMatch(
    standardSource + standardSection,
    /type="file"|upload-session|api\/admin|fetch\(|createObjectURL|FileReader|generateMod|bytePatch|writeFile|checksum|storage_path|signed_url|service_role|SUPABASE_SERVICE_ROLE_KEY|admin_note|internal_note|customer_email|source_reference|confidence_score|sample_id|raw|hex/i
  );
});

test("homepage file service glossary explains terminology with DefinedTermSet schema", () => {
  const homepage = readProjectFile("src", "app", "page.tsx");
  const glossarySource =
    homepage.match(/const fileServiceGlossaryTerms = \[[\s\S]*?type HomepageCompactResourceItem = \{/)?.[0] ?? "";
  const glossarySection = readHomepageCompactResourceSection(homepage, "file-service-glossary");

  assert.match(homepage, /const fileServiceGlossaryTerms = \[/);
  assert.match(glossarySource, /title: "ECU file service"/);
  assert.match(glossarySource, /title: "TCU file service"/);
  assert.match(glossarySource, /title: "ORI file"/);
  assert.match(glossarySource, /title: "MOD file"/);
  assert.match(glossarySource, /title: "Read method"/);
  assert.match(glossarySource, /title: "DTC request"/);
  assert.match(glossarySource, /title: "Secure upload"/);
  assert.match(glossarySource, /title: "Private delivery"/);
  assert.match(glossarySource, /href: "\/file-service"/);
  assert.match(glossarySource, /href: "\/ecu-platforms\/transmission-control-units"/);
  assert.match(glossarySource, /href: "\/tools\/file-readiness-check"/);
  assert.match(glossarySource, /href: "\/tools\/ecu-read-method-advisor"/);
  assert.match(glossarySection, /File Service Glossary/);
  assert.match(glossarySection, /Understand the file-service terms before opening an ECU or TCU request/);
  assert.match(glossarySection, /Learn more/);
  assert.match(glossarySection, /educational and customer-safe/);
  assert.match(glossarySection, /does not\s+inspect, upload, edit or create ECU\/TCU files/);
  assert.match(glossarySection, /focus-visible:ring-2 focus-visible:ring-red-700/);
  assert.match(homepage, /const homepageFileServiceGlossaryJsonLd = \{/);
  assert.match(homepage, /"@type": "DefinedTermSet"/);
  assert.match(homepage, /hasDefinedTerm: fileServiceGlossaryTerms\.map/);
  assert.match(homepage, /"@type": "DefinedTerm"/);
  assert.match(homepage, /JSON\.stringify\(homepageFileServiceGlossaryJsonLd\)/);
  assert.doesNotMatch(
    glossarySource + glossarySection,
    /type="file"|upload-session|api\/admin|fetch\(|createObjectURL|FileReader|generateMod|bytePatch|writeFile|checksum\(|storage_path|signed_url|service_role|SUPABASE_SERVICE_ROLE_KEY|admin_note|internal_note|customer_email|source_reference|confidence_score|sample_id|raw|hex/i
  );
});

test("homepage provides customer-safe search intent FAQ structured data", () => {
  const homepage = readProjectFile("src", "app", "page.tsx");
  const faqSource =
    homepage.match(/const homepageSearchIntentFaq = \[[\s\S]*?const workshopUseCases = \[/)?.[0] ?? "";

  assert.match(homepage, /const homepageSearchIntentFaq = \[/);
  assert.match(homepage, /const homepageSearchIntentJsonLd = \{/);
  assert.match(homepage, /"@type": "FAQPage"/);
  assert.match(homepage, /mainEntity: homepageSearchIntentFaq\.map/);
  assert.match(homepage, /Workshop Search Guide/);
  assert.match(homepage, /ECU file service questions answered before upload/);
  assert.match(homepage, /What should I prepare before sending an ECU or TCU file request\?/);
  assert.match(homepage, /Do the public preparation tools upload or modify my ECU file\?/);
  assert.match(homepage, /How is a completed file delivered\?/);
  assert.match(homepage, /Can I create a request if my vehicle is not in the public selector\?/);
  assert.match(homepage, /href: "\/tools\/file-readiness-check"/);
  assert.match(homepage, /href: "\/how-it-works"/);
  assert.match(homepage, /href: "\/new-request"/);
  assert.match(homepage, /type="application\/ld\+json"/);
  assert.match(homepage, /JSON\.stringify\(homepageSearchIntentJsonLd\)/);
  assert.match(homepage, /FAQ structured data is generated from the same customer-visible\s+answers/);
  assert.doesNotMatch(
    faqSource,
    /storage_path|signed_url|service_role|SUPABASE_SERVICE_ROLE_KEY|admin_note|internal_note|customer_email|source_reference|confidence_score|sample_id|provider|raw|hex|bytePatch|generateMod|checksum|fetch\(|\.rpc\(/i
  );
});

test("homepage service cards deep-link to public service landing pages", () => {
  const homepage = readProjectFile("src", "app", "page.tsx");
  const servicesSource =
    homepage.match(/const services = \[[\s\S]*?const steps = \[/)?.[0] ?? "";
  const serviceSection =
    homepage.match(/<AnimatedSection id="services"[\s\S]*?<AnimatedSection className="bg-\[#050505\] py-20">/)?.[0] ??
    "";

  assert.match(servicesSource, /href: "\/services\/stage-1"/);
  assert.match(servicesSource, /href: "\/services\/dpf-off"/);
  assert.match(servicesSource, /href: "\/services\/egr-off"/);
  assert.match(servicesSource, /href: "\/services\/adblue-off"/);
  assert.match(servicesSource, /href: "\/services\/dtc-off"/);
  assert.match(servicesSource, /href: "\/services\/tcu-tuning"[\s\S]*View TCU service/);
  assert.match(servicesSource, /searchIntent: "Performance calibration"/);
  assert.match(servicesSource, /searchIntent: "Diesel aftertreatment"/);
  assert.match(servicesSource, /searchIntent: "Diagnostic code request"/);
  assert.match(serviceSection, /<Link[\s\S]*href=\{service\.href\}/);
  assert.match(serviceSection, /\{service\.searchIntent\}/);
  assert.match(serviceSection, /\{service\.action\}/);
  assert.match(serviceSection, /focus-visible:ring-2 focus-visible:ring-red-700/);
  assert.doesNotMatch(
    serviceSection,
    /type="file"|upload-session|api\/admin|fetch\(|createObjectURL|FileReader|generateMod|bytePatch|writeFile|checksum|storage_path|signed_url|service_role/i
  );
});

test("homepage brand cards deep-link to public brand landing pages", () => {
  const homepage = readProjectFile("src", "app", "page.tsx");
  const brandSource =
    homepage.match(/const supportedBrands = \[[\s\S]*?const trustHighlights = \[/)?.[0] ?? "";
  const brandSection =
    homepage.match(/<AnimatedSection id="brands"[\s\S]*?<AnimatedSection id="ecu-platforms"/)?.[0] ??
    "";

  assert.match(brandSource, /href: "\/brands\/bmw"/);
  assert.match(brandSource, /href: "\/brands\/mercedes-benz"/);
  assert.match(brandSource, /href: "\/brands\/audi"/);
  assert.match(brandSource, /href: "\/brands\/volkswagen"/);
  assert.match(brandSource, /href: "\/brands\/porsche"/);
  assert.match(brandSource, /href: "\/brands\/opel"/);
  assert.match(brandSource, /href: "\/brands\/renault"/);
  assert.match(brandSource, /href: "\/brands\/peugeot"/);
  assert.match(brandSource, /action: "View BMW files"/);
  assert.match(brandSource, /action: "View Mercedes files"/);
  assert.match(brandSection, /<Link[\s\S]*href=\{brand\.href\}/);
  assert.match(brandSection, /\{brand\.action\}/);
  assert.match(brandSection, /focus-visible:ring-2 focus-visible:ring-red-700/);
  assert.match(brandSection, /Need another brand\?/);
  assert.match(brandSection, /href="\/new-request"/);
  assert.doesNotMatch(
    brandSection,
    /type="file"|upload-session|api\/admin|fetch\(|createObjectURL|FileReader|generateMod|bytePatch|writeFile|checksum|storage_path|signed_url|service_role/i
  );
});

test("homepage ECU platform library deep-links to public platform guides", () => {
  const homepage = readProjectFile("src", "app", "page.tsx");
  const platformSource =
    homepage.match(/const ecuPlatformLinks = \[[\s\S]*?const trustHighlights = \[/)?.[0] ?? "";
  const platformSection =
    homepage.match(/<AnimatedSection id="ecu-platforms"[\s\S]*?<AnimatedSection className="bg-\[#07090d\] py-20 text-white">/)?.[0] ??
    "";

  assert.match(platformSource, /href: "\/ecu-platforms\/bosch-edc17"/);
  assert.match(platformSource, /href: "\/ecu-platforms\/bosch-md1"/);
  assert.match(platformSource, /href: "\/ecu-platforms\/bosch-mg1"/);
  assert.match(platformSource, /href: "\/ecu-platforms\/continental-simos"/);
  assert.match(platformSource, /href: "\/ecu-platforms\/continental-sid"/);
  assert.match(platformSource, /href: "\/ecu-platforms\/delphi-dcm"/);
  assert.match(platformSource, /href: "\/ecu-platforms\/denso"/);
  assert.match(platformSource, /href: "\/ecu-platforms\/transmission-control-units"/);
  assert.match(platformSection, /ECU Platform Library/);
  assert.match(platformSection, /href="\/ecu-platforms"/);
  assert.match(platformSection, /<Link[\s\S]*href=\{platform\.href\}/);
  assert.match(platformSection, /\{platform\.action\}/);
  assert.match(platformSection, /No public guide edits, generates or checksum-corrects customer files/);
  assert.match(platformSection, /focus-visible:ring-2 focus-visible:ring-red-700/);
  assert.doesNotMatch(
    platformSection,
    /type="file"|upload-session|api\/admin|fetch\(|createObjectURL|FileReader|generateMod|bytePatch|writeFile|checksum\(|storage_path|signed_url|service_role/i
  );
});

test("homepage exposes customer-safe resource ItemList structured data", () => {
  const homepage = readProjectFile("src", "app", "page.tsx");
  const resourceSource =
    homepage.match(/type HomepageResourceLink = \{[\s\S]*?const homepagePageJsonLd = \{/)?.[0] ?? "";
  const resourceScript =
    homepage.match(/<script[\s\S]*?JSON\.stringify\(homepageResourceJsonLd\)[\s\S]*?\/>/)?.[0] ?? "";

  assert.match(homepage, /const serviceLandingPageLinks = services\.filter/);
  assert.match(homepage, /service\.href\.startsWith\("\/services\/"\)/);
  assert.match(resourceSource, /const homepageResourceJsonLd = \{/);
  assert.match(resourceSource, /"@graph": \[/);
  assert.doesNotMatch(resourceSource, /file service quick paths|file-service-quick-paths/);
  assert.match(
    resourceSource,
    /buildHomepageItemList\("MG AutoTech file service homepage navigator", homepageFileServiceNavigator, "\/#file-service-navigator"\)/
  );
  assert.match(
    resourceSource,
    /buildHomepageItemList\("MG AutoTech file service answer library", fileServiceAnswerLibrary, "\/#file-service-answer-library"\)/
  );
  assert.match(
    resourceSource,
    /buildHomepageItemList\("MG AutoTech file service search route index", fileServiceSearchRouteIndex, "\/#file-service-search-index"\)/
  );
  assert.match(
    resourceSource,
    /buildHomepageItemList\("MG AutoTech file service snippet summary", fileServiceSnippetSummary, "\/#file-service-snippet-summary"\)/
  );
  assert.match(
    resourceSource,
    /buildHomepageItemList\("MG AutoTech professional file service comparison", fileServiceTrustComparison, "\/#professional-file-service-comparison"\)/
  );
  assert.match(
    resourceSource,
    /buildHomepageItemList\("MG AutoTech file service verification checkpoints", fileServiceVerificationCheckpoints, "\/#file-service-verification-checkpoints"\)/
  );
  assert.match(
    resourceSource,
    /buildHomepageItemList\("MG AutoTech file service myth checks", fileServiceMythChecks, "\/#file-service-myth-checks"\)/
  );
  assert.match(
    resourceSource,
    /buildHomepageItemList\("MG AutoTech file service platform stack", fileServicePlatformStack, "\/#file-service-platform-stack"\)/
  );
  assert.match(
    resourceSource,
    /buildHomepageItemList\("MG AutoTech file service read method routes", fileServiceReadMethodRoutes, "\/#file-service-read-methods"\)/
  );
  assert.match(
    resourceSource,
    /buildHomepageItemList\("MG AutoTech file service brief requirements", fileServiceBriefRequirements, "\/#file-service-brief-requirements"\)/
  );
  assert.match(
    resourceSource,
    /buildHomepageItemList\("MG AutoTech file service fit checker", fileServiceFitChecks, "\/#file-service-fit-checker"\)/
  );
  assert.match(
    resourceSource,
    /buildHomepageItemList\("MG AutoTech file service outcome preview", fileServiceOutcomePreview, "\/#file-service-outcome-preview"\)/
  );
  assert.match(
    resourceSource,
    /buildHomepageItemList\("MG AutoTech file service status guide", fileServiceStatusGuide, "\/#file-service-status-guide"\)/
  );
  assert.match(
    resourceSource,
    /buildHomepageItemList\("MG AutoTech secure file service privacy controls", fileServicePrivacyControls, "\/#file-service-privacy-controls"\)/
  );
  assert.match(
    resourceSource,
    /buildHomepageItemList\("MG AutoTech file service use case library", fileServiceUseCases, "\/#file-service-use-cases"\)/
  );
  assert.match(
    resourceSource,
    /buildHomepageItemList\("MG AutoTech file service quality signals", fileServiceQualitySignals, "\/#file-service-quality-signals"\)/
  );
  assert.match(
    resourceSource,
    /buildHomepageItemList\("MG AutoTech workshop file service profiles", fileServiceWorkshopProfiles, "\/#file-service-workshop-profiles"\)/
  );
  assert.match(
    resourceSource,
    /buildHomepageItemList\("MG AutoTech service landing pages", serviceLandingPageLinks, "\/#service-landing-pages"\)/
  );
  assert.match(
    resourceSource,
    /buildHomepageItemList\("MG AutoTech file service knowledge map", fileServiceKnowledgeMap, "\/#file-service-knowledge-map"\)/
  );
  assert.match(
    resourceSource,
    /buildHomepageItemList\("MG AutoTech file service decision matrix", fileServiceDecisionMatrix, "\/#file-service-decision-matrix"\)/
  );
  assert.match(
    resourceSource,
    /buildHomepageItemList\("MG AutoTech online file service operating standard", fileServiceOperatingStandard, "\/#file-service-operating-standard"\)/
  );
  assert.match(
    resourceSource,
    /buildHomepageItemList\("MG AutoTech file service glossary", fileServiceGlossaryTerms, "\/#file-service-glossary"\)/
  );
  assert.match(
    resourceSource,
    /buildHomepageItemList\("MG AutoTech supported brand guides", supportedBrands, "\/#supported-brand-guides"\)/
  );
  assert.match(
    resourceSource,
    /buildHomepageItemList\("MG AutoTech ECU and TCU platform guides", ecuPlatformLinks, "\/#ecu-platform-guides"\)/
  );
  assert.match(resourceSource, /"@type": "ItemList"/);
  assert.match(resourceSource, /"@type": "ListItem"/);
  assert.match(resourceSource, /"@type": "WebPage"/);
  assert.match(resourceSource, /https:\/\/file\.mgautotech\.de\$\{href\}/);
  assert.match(resourceScript, /type="application\/ld\+json"/);
  assert.match(homepage, /JSON\.stringify\(homepageResourceJsonLd\)/);
  assert.doesNotMatch(resourceSource, /\/new-request/);
  assert.doesNotMatch(
    resourceSource,
    /credits|Credit|price|payment|storage_path|signed_url|service_role|SUPABASE_SERVICE_ROLE_KEY|admin_note|internal_note|customer_email|source_reference|confidence_score|sample_id|provider|raw|hex|bytePatch|generateMod|checksum|fetch\(|\.rpc\(/i
  );
});

test("homepage exposes page-level WebPage structured data identity", () => {
  const homepage = readProjectFile("src", "app", "page.tsx");
  const pageSchemaSource =
    homepage.match(/const homepagePageJsonLd = \{[\s\S]*?const homepageFileServiceJsonLd = \{/)?.[0] ?? "";
  const pageScript =
    homepage.match(/<script[\s\S]*?JSON\.stringify\(homepagePageJsonLd\)[\s\S]*?\/>/)?.[0] ?? "";

  assert.match(pageSchemaSource, /"@type": "WebPage"/);
  assert.match(pageSchemaSource, /"@id": publicResourceUrl\("\/#page"\)/);
  assert.match(pageSchemaSource, /name: "MG AutoTech ECU & TCU File Service"/);
  assert.match(pageSchemaSource, /inLanguage: "en"/);
  assert.match(pageSchemaSource, /isPartOf: \{ "@id": publicResourceUrl\("\/#website"\) \}/);
  assert.match(pageSchemaSource, /about: \{ "@id": publicResourceUrl\("\/#organization"\) \}/);
  assert.match(pageSchemaSource, /primaryImageOfPage/);
  assert.match(pageSchemaSource, /hasPart: \[/);
  assert.match(pageSchemaSource, /publicResourceUrl\("\/#homepage-search-faq"\)/);
  assert.match(pageSchemaSource, /publicResourceUrl\("\/#tools"\)/);
  assert.match(pageSchemaSource, /publicResourceUrl\("\/#file-service-navigator"\)/);
  assert.match(pageSchemaSource, /publicResourceUrl\("\/#file-service-answer-library"\)/);
  assert.match(pageSchemaSource, /publicResourceUrl\("\/#file-service-search-index"\)/);
  assert.match(pageSchemaSource, /publicResourceUrl\("\/#file-service-snippet-summary"\)/);
  assert.match(pageSchemaSource, /publicResourceUrl\("\/#professional-file-service-comparison"\)/);
  assert.match(pageSchemaSource, /publicResourceUrl\("\/#file-service-verification-checkpoints"\)/);
  assert.match(pageSchemaSource, /publicResourceUrl\("\/#file-service-myth-checks"\)/);
  assert.match(pageSchemaSource, /publicResourceUrl\("\/#file-service-platform-stack"\)/);
  assert.match(pageSchemaSource, /publicResourceUrl\("\/#ecu-tcu-file-service"\)/);
  assert.match(pageSchemaSource, /publicResourceUrl\("\/#file-service-read-methods"\)/);
  assert.match(pageSchemaSource, /publicResourceUrl\("\/#file-service-brief-requirements"\)/);
  assert.match(pageSchemaSource, /publicResourceUrl\("\/#file-service-fit-checker"\)/);
  assert.match(pageSchemaSource, /publicResourceUrl\("\/#file-service-outcome-preview"\)/);
  assert.match(pageSchemaSource, /publicResourceUrl\("\/#file-service-status-guide"\)/);
  assert.match(pageSchemaSource, /publicResourceUrl\("\/#file-service-privacy-controls"\)/);
  assert.match(pageSchemaSource, /publicResourceUrl\("\/#file-service-use-cases"\)/);
  assert.match(pageSchemaSource, /publicResourceUrl\("\/#file-service-quality-signals"\)/);
  assert.match(pageSchemaSource, /publicResourceUrl\("\/#file-service-workshop-profiles"\)/);
  assert.match(pageSchemaSource, /publicResourceUrl\("\/#request-readiness-howto"\)/);
  assert.match(pageSchemaSource, /publicResourceUrl\("\/#service-landing-pages"\)/);
  assert.match(pageSchemaSource, /publicResourceUrl\("\/#file-service-knowledge-map"\)/);
  assert.match(pageSchemaSource, /publicResourceUrl\("\/#file-service-decision-matrix"\)/);
  assert.match(pageSchemaSource, /publicResourceUrl\("\/#file-service-operating-standard"\)/);
  assert.match(pageSchemaSource, /publicResourceUrl\("\/#file-service-glossary"\)/);
  assert.match(pageSchemaSource, /publicResourceUrl\("\/#supported-brand-guides"\)/);
  assert.match(pageSchemaSource, /publicResourceUrl\("\/#ecu-platform-guides"\)/);
  assert.match(homepage, /"@id": "https:\/\/file\.mgautotech\.de\/#homepage-search-faq"/);
  assert.doesNotMatch(homepage, /file-service-quick-paths|homepageQuickServicePaths|homepageQuickPathJsonLd/);
  assert.match(
    homepage,
    /buildHomepageItemList\("MG AutoTech file service homepage navigator", homepageFileServiceNavigator, "\/#file-service-navigator"\)/
  );
  assert.match(
    homepage,
    /buildHomepageItemList\("MG AutoTech file service answer library", fileServiceAnswerLibrary, "\/#file-service-answer-library"\)/
  );
  assert.match(
    homepage,
    /buildHomepageItemList\("MG AutoTech file service search route index", fileServiceSearchRouteIndex, "\/#file-service-search-index"\)/
  );
  assert.match(
    homepage,
    /buildHomepageItemList\("MG AutoTech file service snippet summary", fileServiceSnippetSummary, "\/#file-service-snippet-summary"\)/
  );
  assert.match(
    homepage,
    /buildHomepageItemList\("MG AutoTech professional file service comparison", fileServiceTrustComparison, "\/#professional-file-service-comparison"\)/
  );
  assert.match(
    homepage,
    /buildHomepageItemList\("MG AutoTech file service verification checkpoints", fileServiceVerificationCheckpoints, "\/#file-service-verification-checkpoints"\)/
  );
  assert.match(
    homepage,
    /buildHomepageItemList\("MG AutoTech file service myth checks", fileServiceMythChecks, "\/#file-service-myth-checks"\)/
  );
  assert.match(
    homepage,
    /buildHomepageItemList\("MG AutoTech file service platform stack", fileServicePlatformStack, "\/#file-service-platform-stack"\)/
  );
  assert.match(
    homepage,
    /buildHomepageItemList\("MG AutoTech file service read method routes", fileServiceReadMethodRoutes, "\/#file-service-read-methods"\)/
  );
  assert.match(
    homepage,
    /buildHomepageItemList\("MG AutoTech file service brief requirements", fileServiceBriefRequirements, "\/#file-service-brief-requirements"\)/
  );
  assert.match(
    homepage,
    /buildHomepageItemList\("MG AutoTech file service fit checker", fileServiceFitChecks, "\/#file-service-fit-checker"\)/
  );
  assert.match(
    homepage,
    /buildHomepageItemList\("MG AutoTech file service outcome preview", fileServiceOutcomePreview, "\/#file-service-outcome-preview"\)/
  );
  assert.match(
    homepage,
    /buildHomepageItemList\("MG AutoTech file service status guide", fileServiceStatusGuide, "\/#file-service-status-guide"\)/
  );
  assert.match(
    homepage,
    /buildHomepageItemList\("MG AutoTech secure file service privacy controls", fileServicePrivacyControls, "\/#file-service-privacy-controls"\)/
  );
  assert.match(
    homepage,
    /buildHomepageItemList\("MG AutoTech file service use case library", fileServiceUseCases, "\/#file-service-use-cases"\)/
  );
  assert.match(
    homepage,
    /buildHomepageItemList\("MG AutoTech file service quality signals", fileServiceQualitySignals, "\/#file-service-quality-signals"\)/
  );
  assert.match(
    homepage,
    /buildHomepageItemList\("MG AutoTech workshop file service profiles", fileServiceWorkshopProfiles, "\/#file-service-workshop-profiles"\)/
  );
  assert.match(
    homepage,
    /buildHomepageItemList\("MG AutoTech service landing pages", serviceLandingPageLinks, "\/#service-landing-pages"\)/
  );
  assert.match(
    homepage,
    /buildHomepageItemList\("MG AutoTech file service knowledge map", fileServiceKnowledgeMap, "\/#file-service-knowledge-map"\)/
  );
  assert.match(
    homepage,
    /buildHomepageItemList\("MG AutoTech file service decision matrix", fileServiceDecisionMatrix, "\/#file-service-decision-matrix"\)/
  );
  assert.match(
    homepage,
    /buildHomepageItemList\("MG AutoTech online file service operating standard", fileServiceOperatingStandard, "\/#file-service-operating-standard"\)/
  );
  assert.match(
    homepage,
    /buildHomepageItemList\("MG AutoTech file service glossary", fileServiceGlossaryTerms, "\/#file-service-glossary"\)/
  );
  assert.match(
    homepage,
    /buildHomepageItemList\("MG AutoTech supported brand guides", supportedBrands, "\/#supported-brand-guides"\)/
  );
  assert.match(
    homepage,
    /buildHomepageItemList\("MG AutoTech ECU and TCU platform guides", ecuPlatformLinks, "\/#ecu-platform-guides"\)/
  );
  assert.match(pageScript, /type="application\/ld\+json"/);
  assert.match(homepage, /JSON\.stringify\(homepagePageJsonLd\)/);
  assert.doesNotMatch(
    pageSchemaSource,
    /credits|Credit|price|payment|storage_path|signed_url|service_role|SUPABASE_SERVICE_ROLE_KEY|admin_note|internal_note|customer_email|source_reference|confidence_score|sample_id|provider|raw|hex|bytePatch|generateMod|checksum|fetch\(|\.rpc\(/i
  );
});

test("homepage exposes customer-safe Service structured data for file service search intent", () => {
  const homepage = readProjectFile("src", "app", "page.tsx");
  const serviceSchemaSource =
    homepage.match(/const homepageFileServiceJsonLd = \{[\s\S]*?const homepageRequestPreparationHowToJsonLd = \{/)?.[0] ?? "";
  const serviceScript =
    homepage.match(/<script[\s\S]*?JSON\.stringify\(homepageFileServiceJsonLd\)[\s\S]*?\/>/)?.[0] ?? "";

  assert.match(serviceSchemaSource, /"@type": "Service"/);
  assert.match(serviceSchemaSource, /"@id": publicResourceUrl\("\/#ecu-tcu-file-service"\)/);
  assert.match(serviceSchemaSource, /name: "MG AutoTech ECU and TCU File Service"/);
  assert.match(serviceSchemaSource, /"ECU file service"/);
  assert.match(serviceSchemaSource, /"TCU file service"/);
  assert.match(serviceSchemaSource, /"Stage 1 file service"/);
  assert.match(serviceSchemaSource, /"DPF, EGR, AdBlue and DTC file requests"/);
  assert.match(serviceSchemaSource, /hasOfferCatalog/);
  assert.match(serviceSchemaSource, /"@type": "OfferCatalog"/);
  assert.match(serviceSchemaSource, /itemListElement: serviceLandingPageLinks\.map/);
  assert.match(serviceSchemaSource, /"@type": "Offer"/);
  assert.match(serviceSchemaSource, /serviceType: service\.searchIntent/);
  assert.match(serviceSchemaSource, /url: publicResourceUrl\(service\.href\)/);
  assert.match(serviceSchemaSource, /termsOfService: publicResourceUrl\("\/agb"\)/);
  assert.match(serviceScript, /type="application\/ld\+json"/);
  assert.match(homepage, /JSON\.stringify\(homepageFileServiceJsonLd\)/);
  assert.doesNotMatch(
    serviceSchemaSource,
    /credits|Credit|price|payment|storage_path|signed_url|service_role|SUPABASE_SERVICE_ROLE_KEY|admin_note|internal_note|customer_email|source_reference|confidence_score|sample_id|raw|hex|bytePatch|generateMod|checksum|fetch\(|\.rpc\(/i
  );
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
  assert.match(page, /ECU File Service for Custom Tuning Files/);
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
    "/new-request",
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

  assert.match(homepage, /href="\/file-service"/);
  assert.match(header, /href="\/file-service"/);
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
  const sitemap = readProjectFile("src", "app", "sitemap.ts");
  const robots = readProjectFile("src", "app", "robots.ts");

  assert.match(page, /export const metadata: Metadata/);
  assert.match(page, /ECU & TCU Solution Catalog/);
  assert.match(page, /Professional file-service catalog/);
  assert.match(page, /More than a basic ECU solutions grid/);
  assert.match(page, /canonical: absoluteUrl\("\/services"\)/);
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
  assert.match(page, /<PublicSeoHeader \/>/);
  assert.match(page, /<Footer \/>/);

  assert.match(homepage, /href="\/services"/);
  assert.match(header, /href="\/services"[\s\S]*Services/);
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
  assert.match(localizedPage, /LocalizedSeoFooter/);
  assert.match(localizedPage, /resolvePublicHref/);
  assert.match(localizedPage, /JSON\.stringify\(jsonLd\)/);
  assert.match(copy, /ECU & TCU File Service Hub/);
  assert.match(copy, /ECU und TCU Dateiservice Hub/);
  assert.match(copy, /ECU ve TCU Dosya Servisi Merkezi/);
  assert.match(copy, /fileServiceJsonLd/);
  assert.match(localizedHomeRoute, /UnifiedHomePage/);
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
    homepage.match(/const homepageRequestPreparationHowToJsonLd = \{[\s\S]*?const trustHighlights = \[/)?.[0] ?? "";
  const howToScript =
    homepage.match(/<script[\s\S]*?JSON\.stringify\(homepageRequestPreparationHowToJsonLd\)[\s\S]*?\/>/)?.[0] ?? "";

  assert.match(howToSource, /"@type": "HowTo"/);
  assert.match(howToSource, /"@id": publicResourceUrl\("\/#request-readiness-howto"\)/);
  assert.match(howToSource, /name: "How to prepare an ECU or TCU file request"/);
  assert.match(howToSource, /mainEntityOfPage: \{ "@id": publicResourceUrl\("\/#page"\) \}/);
  assert.match(howToSource, /MG AutoTech public preparation tools/);
  assert.match(howToSource, /Vehicle, engine and ECU or TCU identification details/);
  assert.match(howToSource, /Original file prepared for authenticated portal submission/);
  assert.match(howToSource, /step: requestReadinessSteps\.map/);
  assert.match(howToSource, /"@type": "HowToStep"/);
  assert.match(howToSource, /position: index \+ 1/);
  assert.match(howToSource, /url: publicResourceUrl\(step\.href\)/);
  assert.match(homepage, /Check file readiness/);
  assert.match(homepage, /Build request brief/);
  assert.match(homepage, /Plan read method/);
  assert.match(homepage, /Start secure request/);
  assert.match(howToScript, /type="application\/ld\+json"/);
  assert.match(homepage, /JSON\.stringify\(homepageRequestPreparationHowToJsonLd\)/);
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
  assert.match(script, /Root homepage does not expose page-level WebPage structured data/);
  assert.match(script, /homepageFileServiceJsonLd/);
  assert.match(script, /Root homepage does not expose ECU\/TCU file service structured data/);
  assert.match(script, /Root homepage performance tools must render before the file service navigator/);
  assert.match(script, /Root homepage still contains the removed hero quick-path panel/);
  assert.match(script, /Root homepage does not expose the file service navigator/);
  assert.match(script, /Root homepage does not expose the file service answer library/);
  assert.match(script, /Root homepage does not expose file service answer library structured data/);
  assert.match(script, /Root homepage does not render file service answer library structured data/);
  assert.match(script, /Root homepage does not expose the file service search route index/);
  assert.match(script, /Root homepage does not expose the file service snippet summary/);
  assert.match(script, /Root homepage does not expose the professional file service comparison/);
  assert.match(script, /Root homepage does not expose the file service verification checkpoints/);
  assert.match(script, /Root homepage does not expose the file service myth checks/);
  assert.match(script, /Root homepage does not expose the file service platform stack/);
  assert.match(script, /Root homepage does not expose file service read method routes/);
  assert.match(script, /Root homepage does not expose file service brief requirements/);
  assert.match(script, /Root homepage does not expose the file service fit checker/);
  assert.match(script, /Root homepage does not expose the file service use case library/);
  assert.match(script, /Root homepage does not expose file service quality signals/);
  assert.match(script, /Root homepage does not expose workshop file service profiles/);
  assert.match(script, /Root homepage does not expose the file service knowledge map/);
  assert.match(script, /Root metadata is missing online ECU file service search wording/);
  assert.match(script, /Root metadata is missing TCU File Service search wording/);
  assert.match(script, /Root metadata is missing ECU File Upload Service search wording/);
  assert.match(script, /Root homepage does not expose the file service decision matrix/);
  assert.match(script, /Root homepage does not expose the file service terminology glossary/);
  assert.match(script, /Root homepage file service structured data is missing Service type/);
  assert.match(script, /Root homepage file service glossary structured data is missing DefinedTermSet/);
  assert.match(script, /Root homepage WebPage structured data is not linked to the ECU\/TCU file service graph/);
  assert.match(script, /Root homepage file service structured data is missing offer catalog/);
  assert.match(script, /Root homepage resource graph is missing the file service navigator ItemList/);
  assert.match(script, /Root homepage WebPage structured data is not linked to the file service navigator/);
  assert.match(script, /Root homepage resource graph is missing the file service answer library ItemList/);
  assert.match(script, /Root homepage WebPage structured data is not linked to the file service answer library/);
  assert.match(script, /Root homepage resource graph is missing the file service search route index ItemList/);
  assert.match(script, /Root homepage WebPage structured data is not linked to the file service search route index/);
  assert.match(script, /Root homepage resource graph is missing the file service snippet summary ItemList/);
  assert.match(script, /Root homepage WebPage structured data is not linked to the file service snippet summary/);
  assert.match(script, /Root homepage resource graph is missing the professional file service comparison ItemList/);
  assert.match(script, /Root homepage WebPage structured data is not linked to the professional file service comparison/);
  assert.match(script, /Root homepage resource graph is missing the file service verification checkpoints ItemList/);
  assert.match(script, /Root homepage WebPage structured data is not linked to the file service verification checkpoints/);
  assert.match(script, /Root homepage resource graph is missing the file service myth checks ItemList/);
  assert.match(script, /Root homepage WebPage structured data is not linked to the file service myth checks/);
  assert.match(script, /Root homepage resource graph is missing the file service platform stack ItemList/);
  assert.match(script, /Root homepage WebPage structured data is not linked to the file service platform stack/);
  assert.match(script, /Root homepage resource graph is missing the file service read method routes ItemList/);
  assert.match(script, /Root homepage WebPage structured data is not linked to the file service read method routes/);
  assert.match(script, /Root homepage resource graph is missing the file service brief requirements ItemList/);
  assert.match(script, /Root homepage WebPage structured data is not linked to the file service brief requirements/);
  assert.match(script, /Root homepage resource graph is missing the file service fit checker ItemList/);
  assert.match(script, /Root homepage WebPage structured data is not linked to the file service fit checker/);
  assert.match(script, /Root homepage resource graph is missing the file service use case library ItemList/);
  assert.match(script, /Root homepage WebPage structured data is not linked to the file service use case library/);
  assert.match(script, /Root homepage resource graph is missing the file service quality signals ItemList/);
  assert.match(script, /Root homepage WebPage structured data is not linked to the file service quality signals/);
  assert.match(script, /Root homepage resource graph is missing the workshop file service profiles ItemList/);
  assert.match(script, /Root homepage WebPage structured data is not linked to the workshop file service profiles/);
  assert.match(script, /Root homepage does not expose file service glossary structured data/);
  assert.match(script, /Root homepage glossary structured data is not generated from visible terms/);
  assert.match(script, /Root homepage does not render file service glossary structured data/);
  assert.match(script, /Root homepage resource graph is missing the file service knowledge map ItemList/);
  assert.match(script, /Root homepage WebPage structured data is not linked to the file service knowledge map/);
  assert.match(script, /Root homepage resource graph is missing the file service decision matrix ItemList/);
  assert.match(script, /Root homepage WebPage structured data is not linked to the file service decision matrix/);
  assert.match(script, /Root homepage resource graph is missing the file service glossary ItemList/);
  assert.match(script, /Root homepage WebPage structured data is not linked to the file service glossary/);
  assert.match(script, /homepageRequestPreparationHowToJsonLd/);
  assert.match(script, /Root homepage does not expose request preparation HowTo structured data/);
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
