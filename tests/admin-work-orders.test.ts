import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  hasForbiddenCustomerKey,
  removeCustomerForbiddenKeys,
  safePaymentSummaryOnly,
  sanitizeCustomerAiEvidence,
  sanitizeCustomerVisibleEvents,
} from "../src/lib/workOrders/visibility";
import {
  filterCustomerVisibleRequestMessages,
  isHiddenFromCustomer,
  normalizeRequestMessageVisibility,
} from "../src/lib/workOrders/messageVisibility";
import {
  mapLegacyOrderStatus,
  splitServiceLabels,
} from "../src/lib/workOrders/types";

type SmokeUrlGuardModule = {
  NON_LOCAL_SMOKE_OVERRIDE_ENV: string;
  isLocalSmokeUrl: (value: string | URL) => boolean;
  resolveSmokeBaseUrl: (options?: {
    defaultUrl?: string;
    env?: Record<string, string | undefined>;
    envVarName?: string;
    scriptName?: string;
  }) => string;
};

test("work-order migration is additive, RLS protected and non-destructive", () => {
  const sql = readFileSync(resolve(process.cwd(), "scripts", "add-admin-work-order-control-center.sql"), "utf8");
  for (const table of ["request_work_orders", "request_work_order_events", "request_internal_notes"]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`, "i"));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
  assert.match(sql, /has_staff_permission\('orders\.view'\)/);
  assert.match(sql, /has_staff_permission\('orders\.manage'\)/);
  assert.match(sql, /request_work_order_events_request_idx/i);
  assert.match(sql, /request_internal_notes_request_idx/i);
  assert.doesNotMatch(sql, /\bdrop\s+table\b|\bdrop\s+column\b|\btruncate\b|\bdelete\s+from\b/i);
});

test("request message soft-hide migration is additive and preserves history", () => {
  const sql = readFileSync(resolve(process.cwd(), "scripts", "add-request-message-soft-hide.sql"), "utf8");
  assert.match(sql, /alter table public\.request_messages\s+add column if not exists visibility_status/i);
  assert.match(sql, /alter table public\.request_internal_notes\s+add column if not exists visibility_status/i);
  assert.match(sql, /hidden_at timestamptz/i);
  assert.match(sql, /hidden_by uuid references auth\.users/i);
  assert.match(sql, /hidden_reason text/i);
  assert.match(sql, /linked_request_message_id uuid references public\.request_messages/i);
  assert.match(sql, /alter table public\.request_messages enable row level security/i);
  assert.match(sql, /request_messages_visible_request_idx/i);
  assert.doesNotMatch(sql, /\bdrop\s+table\b|\bdrop\s+column\b|\btruncate\b|\bdelete\s+from\b/i);
});

test("admin request routes require existing staff permissions", () => {
  const routes = [
    ["src/app/api/admin/requests/route.ts", /requireStaffPermission\(request,\s*"orders\.view"\)/],
    ["src/app/api/admin/requests/[id]/route.ts", /requireStaffPermission\(request,\s*"orders\.view"\)/],
    ["src/app/api/admin/requests/[id]/route.ts", /requireStaffPermission\(request,\s*"orders\.manage"\)/],
    ["src/app/api/admin/requests/[id]/notes/route.ts", /requireStaffPermission\(request,\s*"orders\.manage"\)/],
  ] as const;
  for (const [file, pattern] of routes) {
    const source = readFileSync(resolve(process.cwd(), file), "utf8");
    assert.match(source, pattern);
  }
});

test("admin request list route returns a generic load error", () => {
  const route = readFileSync(resolve(process.cwd(), "src", "app", "api", "admin", "requests", "route.ts"), "utf8");

  assert.match(route, /\{ error: "Admin requests could not be loaded\." \}/);
  assert.doesNotMatch(route, /error instanceof Error \? error\.message/);
});

test("anonymous users cannot call admin work-order APIs", async () => {
  const list = await import("../src/app/api/admin/requests/route");
  const detail = await import("../src/app/api/admin/requests/[id]/route");
  const notes = await import("../src/app/api/admin/requests/[id]/notes/route");
  assert.equal((await list.GET(new Request("http://localhost/api/admin/requests"))).status, 401);
  assert.equal((await detail.GET(new Request("http://localhost/api/admin/requests/id"), { params: Promise.resolve({ id: "id" }) })).status, 401);
  assert.equal((await detail.PATCH(new Request("http://localhost/api/admin/requests/id", { method: "PATCH", body: "{}" }), { params: Promise.resolve({ id: "id" }) })).status, 401);
  assert.equal((await notes.POST(new Request("http://localhost/api/admin/requests/id/notes", { method: "POST", body: "{}" }), { params: Promise.resolve({ id: "id" }) })).status, 401);
  assert.equal((await detail.PATCH(new Request("http://localhost/api/admin/requests/id", { method: "PATCH", body: JSON.stringify({ message_visibility: { message_id: "00000000-0000-4000-8000-000000000001", action: "hide" } }) }), { params: Promise.resolve({ id: "id" }) })).status, 401);
});

test("request message visibility helper hides archived messages from customers", () => {
  const rows = [
    { id: "visible", request_id: "r1", sender_id: "u1", sender_role: "admin", message: "visible", created_at: "2026-01-01T00:00:00.000Z", visibility_status: "visible" },
    { id: "legacy", request_id: "r1", sender_id: "u1", sender_role: "admin", message: "legacy", created_at: "2026-01-01T00:01:00.000Z", visibility_status: null },
    { id: "hidden", request_id: "r1", sender_id: "u1", sender_role: "admin", message: "hidden", created_at: "2026-01-01T00:02:00.000Z", visibility_status: "hidden", hidden_reason: "test" },
  ];
  const customerRows = filterCustomerVisibleRequestMessages(rows);
  assert.deepEqual(customerRows.map((row) => row.id), ["visible", "legacy"]);
  assert.equal(JSON.stringify(customerRows).includes("hidden_reason"), false);
  assert.equal(normalizeRequestMessageVisibility("archived"), "archived");
  assert.equal(isHiddenFromCustomer({ visibility_status: "hidden" }), true);
});

test("customer sanitizer removes internal work-order and AI evidence fields", () => {
  const internal = {
    status: "in_progress",
    internal_notes: "private tuner note",
    risk_flags: ["bad checksum"],
    file_path: "customer/private/original.bin",
    ai: {
      provider: "internal",
      provider_name: "private-provider",
      sample_id: "sample-secret",
      confidence_score: 92,
      source_metadata: { source_reference: "private-source" },
      private_offsets: ["0x1234"],
      hex_preview: "DE AD BE EF",
      confidence: "usable",
    },
  };
  const sanitized = removeCustomerForbiddenKeys(internal);
  const serialized = JSON.stringify(sanitized);
  assert.equal(hasForbiddenCustomerKey(sanitized), false);
  assert.equal(serialized.includes("private tuner note"), false);
  assert.equal(serialized.includes("customer/private"), false);
  assert.equal(serialized.includes("sample-secret"), false);
  assert.equal(serialized.includes("private-provider"), false);
  assert.equal(serialized.includes("private-source"), false);
  assert.equal(serialized.includes("92"), false);
  assert.equal(serialized.includes("DE AD BE EF"), false);
});

test("customer-visible timeline exposes only explicitly safe events", () => {
  const events = sanitizeCustomerVisibleEvents([
    {
      id: "1",
      event_type: "internal_note_added",
      message: "private internal note",
      customer_visible: false,
      created_at: "2026-01-01T00:00:00.000Z",
      metadata: { risk_flags: ["secret"] },
    },
    {
      id: "2",
      event_type: "customer_visible_note_added",
      message: "We need another read file.",
      customer_visible: true,
      created_at: "2026-01-01T00:01:00.000Z",
    },
  ]);
  assert.equal(events.length, 1);
  assert.equal(events[0].message, "We need another read file.");
  assert.equal(JSON.stringify(events).includes("private internal note"), false);
});

test("AI evidence sanitizer strips source, sample and raw binary metadata", () => {
  const sanitized = sanitizeCustomerAiEvidence({
    cluster: "usable",
    provider: "private-provider",
    trainingSampleId: "abc",
    rawHex: "AA BB",
    nested: { sourceReference: "partner-system", storagePath: "bucket/path" },
  });
  const text = JSON.stringify(sanitized);
  assert.equal(text.includes("usable"), true);
  assert.equal(text.includes("private-provider"), false);
  assert.equal(text.includes("abc"), false);
  assert.equal(text.includes("AA BB"), false);
  assert.equal(text.includes("bucket/path"), false);
});

test("payment summary helper is read-only aggregate only", () => {
  const summary = safePaymentSummaryOnly({
    creditsRequired: "12",
    creditTransactions: [{ id: "ledger" }],
    paymentRecords: [{ id: "payment" }],
  });
  assert.deepEqual(summary, {
    creditsRequired: 12,
    creditTransactionCount: 1,
    paymentRecordCount: 1,
  });
  assert.equal(JSON.stringify(summary).includes("refund"), false);
});

test("legacy statuses map into admin work-order status model without rewriting old values", () => {
  assert.equal(mapLegacyOrderStatus("new_request"), "new");
  assert.equal(mapLegacyOrderStatus("file_check"), "file_received");
  assert.equal(mapLegacyOrderStatus("customer_info_needed"), "waiting_for_customer");
  assert.equal(mapLegacyOrderStatus("revision"), "needs_review");
  assert.equal(mapLegacyOrderStatus("unknown_legacy_status"), "needs_review");
});

test("service labels are split conservatively for request summaries", () => {
  assert.deepEqual(splitServiceLabels("Stage 1 + EGR OFF; DTC OFF | VMAX OFF"), [
    "Stage 1",
    "EGR OFF",
    "DTC OFF",
    "VMAX OFF",
  ]);
});

test("admin work-order UI does not embed customer-forbidden fields directly in customer routes", () => {
  const customerDetail = readFileSync(resolve(process.cwd(), "src", "app", "dashboard", "orders", "[id]", "page.tsx"), "utf8");
  assert.doesNotMatch(customerDetail, /request_internal_notes|request_work_order_events|internal_notes|risk_flags|training_sample_id|private_offsets|hex_preview/i);
});

test("customer-visible note path copies to existing request messages while internal notes stay internal", () => {
  const source = readFileSync(resolve(process.cwd(), "src", "lib", "workOrders", "server.ts"), "utf8");
  assert.match(source, /noteType === "customer_visible"/);
  assert.match(source, /request_messages/);
  assert.match(source, /request_internal_notes/);
  assert.match(source, /linked_request_message_id/);
  assert.match(source, /internal_note_added/);
  assert.match(source, /Customer-visible note could not be copied to request messages/);
});

test("customer message API filters hidden messages and returns no visibility internals", () => {
  const source = readFileSync(resolve(process.cwd(), "src", "app", "api", "requests", "[id]", "messages", "route.ts"), "utf8");
  assert.match(source, /visibility_status\.eq\.visible/);
  assert.match(source, /filterCustomerVisibleRequestMessages/);
  assert.doesNotMatch(source, /hidden_reason|hidden_by|restored_by/);
});

test("admin request route soft-hides messages and audits without hard delete", () => {
  const route = readFileSync(resolve(process.cwd(), "src", "app", "api", "admin", "requests", "[id]", "route.ts"), "utf8");
  const server = readFileSync(resolve(process.cwd(), "src", "lib", "workOrders", "server.ts"), "utf8");
  assert.match(route, /requireStaffPermission\(request,\s*"orders\.manage"\)/);
  assert.match(route, /message_visibility/);
  assert.match(route, /z\.enum\(\["hide", "restore"\]\)/);
  assert.match(route, /updateRequestMessageVisibility/);
  assert.match(server, /message_hidden_from_customer/);
  assert.match(server, /message_restored_to_customer/);
  assert.match(server, /recordWorkOrderEvent/);
  assert.match(server, /visibility_status:\s*nextVisibility/);
  assert.doesNotMatch(route + server, /\.delete\(|\bdelete\s+from\b/i);
});

test("admin work-order UI confirms hide and keeps hidden customer messages visible to admin", () => {
  const source = readFileSync(resolve(process.cwd(), "src", "app", "admin", "requests", "[id]", "WorkOrderDetailClient.tsx"), "utf8");
  assert.match(source, /Hide from customer/);
  assert.match(source, /Restore to customer/);
  assert.match(source, /window\.confirm/);
  assert.match(source, /window\.prompt/);
  assert.match(source, /Hidden from customer/);
  assert.match(source, /message_visibility:\s*\{\s*message_id:\s*messageId/);
});

test("admin audit timeline badges customer-visible and internal-only events", () => {
  const source = readFileSync(resolve(process.cwd(), "src", "app", "admin", "requests", "[id]", "WorkOrderDetailClient.tsx"), "utf8");
  const auditStart = source.indexOf("Status Timeline & Audit");
  const asideStart = source.indexOf("<aside", auditStart);
  assert.notEqual(auditStart, -1);
  assert.notEqual(asideStart, -1);
  const auditSection = source.slice(auditStart, asideStart);

  assert.match(auditSection, /event\.customer_visible \? "Customer-visible" : "Internal-only"/);
  assert.match(auditSection, /event\.customer_visible \? <User/);
  assert.match(auditSection, /: <ShieldCheck/);
  assert.match(auditSection, /break-words text-sm/);
  assert.doesNotMatch(auditSection, /old_value|new_value|metadata|risk_flags|private_offsets|hidden_reason|file_path|signedUrl|storage_path|hash/i);
});

test("admin work-order mutations create timeline events and reject empty updates", () => {
  const detailRoute = readFileSync(resolve(process.cwd(), "src", "app", "api", "admin", "requests", "[id]", "route.ts"), "utf8");
  const uploadRoute = readFileSync(resolve(process.cwd(), "src", "app", "api", "admin", "orders", "[id]", "upload-permission", "route.ts"), "utf8");
  const deliveryRoute = readFileSync(resolve(process.cwd(), "src", "app", "api", "admin", "orders", "[id]", "complete-delivery", "route.ts"), "utf8");
  const trainingRoute = readFileSync(resolve(process.cwd(), "src", "app", "api", "admin", "orders", "[id]", "training-capture", "route.ts"), "utf8");

  assert.match(detailRoute, /Object\.keys\(parsed\.data\)\.length === 0/);
  assert.match(uploadRoute, /recordWorkOrderEvent/);
  assert.match(uploadRoute, /customer_upload_permission_enabled/);
  assert.match(deliveryRoute, /recordWorkOrderEvent/);
  assert.match(deliveryRoute, /final_file_delivery_saved/);
  assert.match(trainingRoute, /recordWorkOrderEvent/);
  assert.match(trainingRoute, /training_capture_requested/);
});

test("customer request actions add safe work-order timeline events without exposing private file paths", () => {
  const revisionRoute = readFileSync(resolve(process.cwd(), "src", "app", "api", "requests", "[id]", "revision", "route.ts"), "utf8");
  const additionalFinalize = readFileSync(resolve(process.cwd(), "src", "app", "api", "requests", "[id]", "additional-file", "finalize", "route.ts"), "utf8");

  assert.match(revisionRoute, /customer_revision_requested/);
  assert.match(additionalFinalize, /customer_additional_file_uploaded/);
  assert.match(additionalFinalize, /file_name/);
  assert.doesNotMatch(additionalFinalize, /newValue:\s*\{[\s\S]*?file_path[\s\S]*?\}/);
});

test("admin work-order detail exposes upload permission control without payment mutation", () => {
  const source = readFileSync(resolve(process.cwd(), "src", "app", "admin", "requests", "[id]", "WorkOrderDetailClient.tsx"), "utf8");
  assert.match(source, /Additional customer upload/);
  assert.match(source, /\/api\/admin\/orders\/\$\{requestId\}\/upload-permission/);
  assert.match(source, /Read-only summary/);
  assert.doesNotMatch(source, /\/api\/admin\/payments|credit_transactions[\s\S]*insert|payment_records[\s\S]*update/);
});

test("admin request review queue includes payment, quality and delivery signals", () => {
  const source = readFileSync(resolve(process.cwd(), "src", "app", "admin", "requests", "AdminRequestsClient.tsx"), "utf8");
  const helperCalls = source.match(/hasReviewSignal\(item\)/g) ?? [];

  assert.match(source, /function hasReviewSignal\(item: ApiItem\)/);
  assert.match(source, /adminReviewStatuses/);
  assert.match(source, /paymentReviewSignals[\s\S]*"requires_review"/);
  assert.match(source, /qualityReviewSignals[\s\S]*"failed"[\s\S]*"needs_review"/);
  assert.match(source, /deliveryReviewSignals[\s\S]*"blocked"[\s\S]*"revision_requested"/);
  assert.ok(helperCalls.length >= 2);
});

test("admin request list surfaces customer upload signal without upload internals", () => {
  const client = readFileSync(resolve(process.cwd(), "src", "app", "admin", "requests", "AdminRequestsClient.tsx"), "utf8");
  const server = readFileSync(resolve(process.cwd(), "src", "lib", "workOrders", "server.ts"), "utf8");

  assert.match(server, /hasCustomerUpload:\s*Array\.isArray\(order\.customer_uploads\)\s*&&\s*order\.customer_uploads\.length > 0/);
  assert.match(client, /item\.indicators\.hasCustomerUpload/);
  assert.match(client, /Customer file/);
  assert.match(client, /Paperclip/);
  assert.doesNotMatch(client, /customer_uploads|signed_url|storage_path|file_name|hash/i);
});

test("admin work-order fallback mode disables mutation controls", () => {
  const source = readFileSync(resolve(process.cwd(), "src", "app", "admin", "requests", "[id]", "WorkOrderDetailClient.tsx"), "utf8");
  const guardCalls = source.match(/if \(blockReadOnlyFallback\(\)\) return;/g) ?? [];

  assert.match(source, /payload\?\.migrationReady === false/);
  assert.ok(guardCalls.length >= 4);
  assert.match(source, /disabled=\{saving \|\| readOnlyFallback\}/);
  assert.match(source, /disabled=\{saving \|\| readOnlyFallback \|\| !noteBody\.trim\(\)\}/);
  assert.match(source, /<ActionSelect disabled=\{readOnlyFallback\} label="Admin status"/);
  assert.match(source, /<ActionSelect disabled=\{readOnlyFallback\} label="Final file"/);
  assert.match(source, /customer message visibility, upload permissions and status actions require the SQL migration/);
});

test("admin work-order smoke script does not contain tokens or mutation calls", () => {
  const source = readFileSync(resolve(process.cwd(), "scripts", "smoke-admin-work-orders.mjs"), "utf8");
  assert.match(source, /ADMIN_WORK_ORDER_SMOKE_BASE_URL/);
  assert.match(source, /smoke-url-guard\.mjs/);
  assert.match(source, /\/api\/admin\/requests/);
  assert.doesNotMatch(source, /Authorization|Bearer|access_token|SUPABASE_SERVICE_ROLE_KEY|method:\s*"POST"|method:\s*"PATCH"/);
});

test("platform smoke scripts are non-mutating and contain no secrets", () => {
  for (const script of ["smoke-public-platform.mjs", "smoke-admin-unauthenticated.mjs"]) {
    const source = readFileSync(resolve(process.cwd(), "scripts", script), "utf8");
    assert.match(source, /BASE_URL/);
    assert.match(source, /resolveSmokeBaseUrl/);
    assert.doesNotMatch(source, /Authorization|Bearer|access_token|SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY/);
    assert.doesNotMatch(source, /method:\s*["'](?:POST|PATCH|PUT|DELETE)["']/i);
  }
});

test("smoke URL guard keeps local defaults and requires explicit non-local override", async () => {
  const guard = (await import(pathToFileURL(resolve(process.cwd(), "scripts", "smoke-url-guard.mjs")).href)) as SmokeUrlGuardModule;

  assert.equal(guard.NON_LOCAL_SMOKE_OVERRIDE_ENV, "ALLOW_NON_LOCAL_SMOKE");
  assert.equal(guard.isLocalSmokeUrl("http://localhost:3000"), true);
  assert.equal(guard.isLocalSmokeUrl("http://127.0.0.1:3000"), true);
  assert.equal(guard.isLocalSmokeUrl("https://file.mgautotech.de"), false);
  assert.equal(
    guard.resolveSmokeBaseUrl({
      env: {},
      envVarName: "BASE_URL",
      scriptName: "test smoke",
    }),
    "http://localhost:3000"
  );
  assert.throws(
    () =>
      guard.resolveSmokeBaseUrl({
        env: { BASE_URL: "https://file.mgautotech.de" },
        envVarName: "BASE_URL",
        scriptName: "test smoke",
      }),
    /ALLOW_NON_LOCAL_SMOKE=1/
  );
  assert.equal(
    guard.resolveSmokeBaseUrl({
      env: { BASE_URL: "https://file.mgautotech.de/", ALLOW_NON_LOCAL_SMOKE: "1" },
      envVarName: "BASE_URL",
      scriptName: "test smoke",
    }),
    "https://file.mgautotech.de"
  );

  const productionChecklist = readFileSync(resolve(process.cwd(), "docs", "production-smoke-checklist.md"), "utf8");
  assert.match(productionChecklist, /ALLOW_NON_LOCAL_SMOKE=1/);
  assert.match(productionChecklist, /human-controlled production smoke/i);
});
