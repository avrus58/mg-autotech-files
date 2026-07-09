import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";
import {
  hasForbiddenCustomerKey,
  removeCustomerForbiddenKeys,
  safePaymentSummaryOnly,
  sanitizeCustomerAiEvidence,
  sanitizeCustomerVisibleEvents,
} from "../src/lib/workOrders/visibility";
import {
  mapLegacyOrderStatus,
  splitServiceLabels,
} from "../src/lib/workOrders/types";

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

test("anonymous users cannot call admin work-order APIs", async () => {
  const list = await import("../src/app/api/admin/requests/route");
  const detail = await import("../src/app/api/admin/requests/[id]/route");
  const notes = await import("../src/app/api/admin/requests/[id]/notes/route");
  assert.equal((await list.GET(new Request("http://localhost/api/admin/requests"))).status, 401);
  assert.equal((await detail.GET(new Request("http://localhost/api/admin/requests/id"), { params: Promise.resolve({ id: "id" }) })).status, 401);
  assert.equal((await detail.PATCH(new Request("http://localhost/api/admin/requests/id", { method: "PATCH", body: "{}" }), { params: Promise.resolve({ id: "id" }) })).status, 401);
  assert.equal((await notes.POST(new Request("http://localhost/api/admin/requests/id/notes", { method: "POST", body: "{}" }), { params: Promise.resolve({ id: "id" }) })).status, 401);
});

test("customer sanitizer removes internal work-order and AI evidence fields", () => {
  const internal = {
    status: "in_progress",
    internal_notes: "private tuner note",
    risk_flags: ["bad checksum"],
    file_path: "customer/private/original.bin",
    ai: {
      provider: "internal",
      sample_id: "sample-secret",
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
  assert.match(source, /internal_note_added/);
});

test("admin work-order smoke script does not contain tokens or mutation calls", () => {
  const source = readFileSync(resolve(process.cwd(), "scripts", "smoke-admin-work-orders.mjs"), "utf8");
  assert.match(source, /ADMIN_WORK_ORDER_SMOKE_BASE_URL/);
  assert.match(source, /\/api\/admin\/requests/);
  assert.doesNotMatch(source, /Authorization|Bearer|access_token|SUPABASE_SERVICE_ROLE_KEY|method:\s*"POST"|method:\s*"PATCH"/);
});
