import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  emptyServiceReportDetails, saveServiceReportDetailsSchema, serviceReportDetailsSchema, serviceReportSnapshotSchema,
} from "../src/lib/serviceReports/model";
import { assertOrderReportStillAccessible, getOrCreateServiceReport, getAdminServiceReportDetails, saveAdminServiceReportDetails } from "../src/lib/serviceReports/server";

const orderId = "11111111-1111-4111-8111-111111111111";
const customerId = "22222222-2222-4222-8222-222222222222";
const otherId = "33333333-3333-4333-8333-333333333333";
const customer = { role: "customer", staffRole: null, permissions: [] } as const;
function snapshot() {
  return { schemaVersion: 1, id: "44444444-4444-4444-8444-444444444444", orderId, customerId, revision: 1, issuedAt: "2026-09-07T10:00:00.000Z", workshop: { name: "Test Workshop", logoPath: null }, vehicle: { brand: "Test", model: "Car", generation: null, engine: null, year: "2022", ecu: null, gearbox: null, licensePlate: null }, requestedServices: ["Stage 1"], performedServices: [], performance: { beforeHp: null, afterHp: null, beforeNm: null, afterNm: null, source: null, sourceNote: "" }, customerNote: "" };
}
type Database = NonNullable<Parameters<typeof getOrCreateServiceReport>[3]>;
const customerAccess = { ...customer, permissions: [...customer.permissions] };

test("automatic report allows absent optional metrics and unconfirmed completed services", () => {
  assert.deepEqual(serviceReportDetailsSchema.parse(emptyServiceReportDetails()), emptyServiceReportDetails());
  assert.equal(serviceReportSnapshotSchema.safeParse(snapshot()).success, true);
});

test("each non-null metric requires source and explanation, including zero", () => {
  for (const key of ["beforeHp", "afterHp", "beforeNm", "afterNm"]) {
    const details = { ...emptyServiceReportDetails(), [key]: 0 };
    assert.equal(serviceReportDetailsSchema.safeParse(details).success, false);
    assert.equal(serviceReportDetailsSchema.safeParse({ ...details, metricSource: "measured" }).success, false);
    assert.equal(serviceReportDetailsSchema.safeParse({ ...details, metricSource: "measured", sourceNote: "Dyno reference TEST-001" }).success, true);
  }
});

test("details reject unknown fields, unsupported sources, non-finite values and oversized content", () => {
  for (const patch of [{ status: "completed" }, { metricSource: "AI_verified" }, { afterHp: Infinity }, { afterNm: -1 }, { afterHp: 5001 }, { sourceNote: "a".repeat(2001) }, { performedServices: ["\u0000internal"] }]) {
    assert.equal(serviceReportDetailsSchema.safeParse({ ...emptyServiceReportDetails(), ...patch }).success, false);
  }
  assert.deepEqual(serviceReportDetailsSchema.parse({ ...emptyServiceReportDetails(), performedServices: [" Stage 1 ", "Stage 1"] }).performedServices, ["Stage 1"]);
  assert.equal(saveServiceReportDetailsSchema.safeParse({ expectedRevision: -1, details: emptyServiceReportDetails() }).success, false);
});

test("both report notes bound newlines without discarding valid multiline content", () => {
  for (const key of ["sourceNote", "customerNote"]) {
    for (const separator of ["\n", "\r\n", "\r"]) {
      const accepted = Array(30).fill("Note").join(separator);
      const rejected = Array(31).fill("Note").join(separator);
      assert.equal(serviceReportDetailsSchema.safeParse({ ...emptyServiceReportDetails(), [key]: accepted }).success, true);
      assert.equal(serviceReportDetailsSchema.safeParse({ ...emptyServiceReportDetails(), [key]: rejected }).success, false);
    }
  }
});

test("snapshot is a strict allowlist and branding belongs to the frozen customer", () => {
  assert.equal(serviceReportSnapshotSchema.safeParse({ ...snapshot(), notes: "internal" }).success, false);
  for (const logoPath of ["https://example.com/logo.png", `${otherId}/profile/report-logo/${orderId}.png`, `${customerId}/profile/report-logo/../../x.png`]) {
    assert.equal(serviceReportSnapshotSchema.safeParse({ ...snapshot(), workshop: { name: "Test", logoPath } }).success, false);
  }
  assert.equal(serviceReportSnapshotSchema.safeParse({ ...snapshot(), workshop: { name: "Test", logoPath: `${customerId}/profile/report-logo/${orderId}.png` } }).success, true);
});

test("server requests one atomic RPC with the authenticated actor and least privilege", async () => {
  const calls: unknown[] = [];
  const database = { rpc: async (...args: unknown[]) => { calls.push(args); return { data: snapshot(), error: null }; } } as unknown as Database;
  assert.deepEqual(await getOrCreateServiceReport(orderId, customerId, customerAccess, database), snapshot());
  assert.deepEqual(calls, [["get_or_create_service_report", { p_order_id: orderId, p_actor_id: customerId, p_allow_staff: false }]]);
});

test("server rejects mismatched order/customer and reports database failures without raw details", async () => {
  for (const data of [{ ...snapshot(), orderId: otherId }, { ...snapshot(), customerId: otherId }, { ...snapshot(), customer_email: "private@example.test" }]) {
    const database = { rpc: async () => ({ data, error: null }) } as unknown as Database;
    await assert.rejects(getOrCreateServiceReport(orderId, customerId, customerAccess, database), { message: "REPORT_UNAVAILABLE" });
  }
  for (const [code, message] of [["SR404", "REPORT_NOT_FOUND"], ["SR409", "REPORT_NOT_COMPLETED"], ["42P01", "REPORT_UNAVAILABLE"]]) {
    const database = { rpc: async () => ({ data: null, error: { code, message: "private database detail" } }) } as unknown as Database;
    await assert.rejects(getOrCreateServiceReport(orderId, customerId, customerAccess, database), { message });
  }
});

test("post-render check refuses reopening and customer reassignment", async () => {
  function databaseFor(data: unknown): Database {
    const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data, error: null }) };
    return { from: () => query } as unknown as Database;
  }
  await assertOrderReportStillAccessible(orderId, customerId, customerId, customerAccess, databaseFor({ id: orderId, customer_id: customerId, status: "completed" }));
  await assert.rejects(assertOrderReportStillAccessible(orderId, customerId, customerId, customerAccess, databaseFor({ id: orderId, customer_id: customerId, status: "in_progress" })), { message: "REPORT_NOT_COMPLETED" });
  await assert.rejects(assertOrderReportStillAccessible(orderId, customerId, customerId, customerAccess, databaseFor({ id: orderId, customer_id: otherId, status: "completed" })), { message: "REPORT_NOT_FOUND" });
});

test("staff download permission is separate from order view and cannot be forged by customer metadata", async () => {
  const flags: boolean[] = [];
  const database = { rpc: async (_name: string, args: { p_allow_staff: boolean }) => { flags.push(args.p_allow_staff); return { data: snapshot(), error: null }; } } as unknown as Database;
  await assert.rejects(getOrCreateServiceReport(orderId, otherId, { role: "staff", staffRole: "support", permissions: ["orders.view"] }, database));
  await assert.rejects(getOrCreateServiceReport(orderId, otherId, { role: "customer", staffRole: null, permissions: ["files.download"] }, database));
  await getOrCreateServiceReport(orderId, otherId, { role: "staff", staffRole: "calibrator", permissions: ["files.download"] }, database);
  assert.deepEqual(flags, [false, false, true]);
});

test("admin detail save preserves provenance, validates input and exposes CAS conflict", async () => {
  const calls: unknown[] = [];
  const details = { ...emptyServiceReportDetails(), afterHp: 210, metricSource: "manually_declared" as const, sourceNote: "Admin supplied reference" };
  const database = { rpc: async (...args: unknown[]) => { calls.push(args); return { data: { revision: 2, details }, error: null }; } } as unknown as Database;
  assert.deepEqual(await saveAdminServiceReportDetails(orderId, otherId, 1, details, database), { revision: 2, details });
  assert.deepEqual(calls, [["save_service_report_details", { p_order_id: orderId, p_actor_id: otherId, p_expected_revision: 1, p_details: details }]]);
  await assert.rejects(saveAdminServiceReportDetails(orderId, otherId, 1, { ...details, sourceNote: "" }, database));
  assert.equal(calls.length, 1);
  const conflict = { rpc: async () => ({ data: null, error: { code: "SR412" } }) } as unknown as Database;
  await assert.rejects(saveAdminServiceReportDetails(orderId, otherId, 1, details, conflict), { message: "REPORT_CONFLICT" });
});

test("admin no-details state retains requested services and completion independently", async () => {
  const requestedTables: string[] = [];
  const database = { from: (table: string) => {
    requestedTables.push(table);
    const query = { select: () => query, eq: () => query, order: () => query, limit: () => query, maybeSingle: async () => ({ data: table === "orders" ? { id: orderId, status: "in_progress", service_type: "Stage 1 + Diagnostics" } : null, error: null }) };
    return query;
  } } as unknown as Database;
  assert.deepEqual(await getAdminServiceReportDetails(orderId, database), { revision: 0, details: emptyServiceReportDetails(), requestedServices: ["Stage 1", "Diagnostics"], orderStatus: "in_progress" });
  assert.deepEqual(requestedTables, ["orders", "service_report_details"]);
});

test("new SQL objects are RLS protected, append-only and service-role only", () => {
  const sql = readFileSync("supabase/migrations/20260907111225_service_report_snapshots.sql", "utf8");
  for (const table of ["customer_report_branding", "service_report_details", "service_report_snapshots"]) assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
  assert.match(sql, /revoke all on public\.customer_report_branding, public\.service_report_details, public\.service_report_snapshots from public, anon, authenticated, service_role/);
  assert.match(sql, /grant select, insert on public\.service_report_details, public\.service_report_snapshots to service_role/);
  assert.doesNotMatch(sql, /security definer|grant .* to (?:authenticated|anon)|drop table|alter table public\.orders/i);
  assert.match(sql, /from public\.orders where id = p_order_id for update/g);
  assert.match(sql, /v_previous\.source_input = v_source/);
  assert.match(sql, /v_order\.status is distinct from 'completed'/);
  assert.match(sql, /coalesce\(v_current\.revision, 0\) <> p_expected_revision/);
});

test("admin editor endpoint uses existing distinct view/manage guards and bounded payload", () => {
  const route = readFileSync("src/app/api/admin/requests/[id]/service-report/route.ts", "utf8");
  assert.match(route, /requireStaffPermission\(request, "orders\.view"\)/);
  assert.match(route, /requireStaffPermission\(request, "orders\.manage"\)/);
  assert.match(route, /readBoundedJsonBody\(request, 24 \* 1024\)/);
  assert.match(route, /private, no-store/);
});
