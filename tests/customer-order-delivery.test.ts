import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  CUSTOMER_FILE_DOWNLOAD_EVENT,
  buildCustomerDownloadAuditValue,
  buildCustomerSourceDownloadAuditValue,
  canDownloadCustomerOrder,
  canReadCustomerOrder,
  getStoredModifiedFileVersions,
  getStoredCustomerSourceFiles,
  isExpectedCustomerDeliveryPath,
  isExpectedCustomerSourcePath,
  projectCustomerDeliveryHistory,
  projectCustomerOrder,
  resolveCustomerDeliveryVersion,
  resolveCustomerSourceFile,
  summarizeCustomerDeliveryHistory,
  type CustomerOrderRecord,
} from "../src/lib/customerOrderDelivery";
import type { StaffAccess } from "../src/lib/staffPermissions";

const root = process.cwd();

function source(...parts: string[]) {
  return fs.readFileSync(path.join(root, ...parts), "utf8");
}

function fixtureOrder(overrides: Partial<CustomerOrderRecord> = {}): CustomerOrderRecord {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    customer_id: "00000000-0000-4000-8000-000000000002",
    customer_email: "customer@example.test",
    vehicle_brand: "Mercedes-Benz",
    vehicle_model: "S",
    vehicle_generation: "W222",
    vehicle_engine: "S 63 AMG",
    service_type: "Stage 1",
    credits_required: 10,
    status: "completed",
    notes: "Safe customer note",
    ecu: "MED17",
    gearbox: null,
    vehicle_year: "2016",
    read_method: "OBD",
    license_plate: null,
    hw_sw: "10SW010192",
    master_slave: null,
    uploaded_file_name: "original.bin",
    original_file_path:
      "00000000-0000-4000-8000-000000000002/request-key/original.bin",
    modified_file_path:
      "00000000-0000-4000-8000-000000000002/modified/00000000-0000-4000-8000-000000000001/final/final.bin",
    modified_files: [
      {
        id: "final-1",
        label: "final",
        file_name: "final.bin",
        file_path:
          "00000000-0000-4000-8000-000000000002/modified/00000000-0000-4000-8000-000000000001/final/final.bin",
        uploaded_at: "2026-07-28T13:14:00.000Z",
      },
    ],
    estimated_delivery_label: null,
    estimated_delivery_note: null,
    customer_upload_enabled: false,
    customer_uploads: [
      {
        id: "upload-1",
        file_name: "log.csv",
        file_path:
          "00000000-0000-4000-8000-000000000002/additional/00000000-0000-4000-8000-000000000001/upload-log.csv",
        file_size: 120,
        uploaded_at: "2026-07-28T12:30:00.000Z",
      },
    ],
    created_at: "2026-07-28T12:00:00.000Z",
    ...overrides,
  };
}

test("customer order projection removes ownership and private storage fields", () => {
  const projected = projectCustomerOrder(fixtureOrder());
  const serialized = JSON.stringify(projected);

  assert.equal("customer_id" in projected, false);
  assert.equal("modified_file_path" in projected, false);
  assert.equal("modified_files" in projected, false);
  assert.doesNotMatch(serialized, /\/additional\/|file_path|modified_files/);
  assert.deepEqual(projected.customer_uploads, [
    {
      id: "upload-1",
      file_name: "log.csv",
      file_size: 120,
      uploaded_at: "2026-07-28T12:30:00.000Z",
    },
  ]);
});

test("delivery projection reports delivered time and exact tracked download count", () => {
  const history = projectCustomerDeliveryHistory(fixtureOrder(), [
    {
      event_type: CUSTOMER_FILE_DOWNLOAD_EVENT,
      actor_user_id: fixtureOrder().customer_id,
      new_value: { version_id: "final-1" },
      created_at: "2026-07-28T14:00:00.000Z",
    },
    {
      event_type: CUSTOMER_FILE_DOWNLOAD_EVENT,
      actor_user_id: fixtureOrder().customer_id,
      new_value: { version_id: "final-1" },
      created_at: "2026-07-28T15:30:00.000Z",
    },
    {
      event_type: "unrelated_event",
      actor_user_id: fixtureOrder().customer_id,
      new_value: { version_id: "final-1" },
      created_at: "2026-07-28T16:00:00.000Z",
    },
  ]);

  assert.equal(history.original.fileName, "original.bin");
  assert.equal(history.versions.length, 1);
  assert.equal(history.versions[0].deliveredAt, "2026-07-28T13:14:00.000Z");
  assert.equal(history.versions[0].downloadCount, 2);
  assert.equal(history.versions[0].lastDownloadedAt, "2026-07-28T15:30:00.000Z");
  assert.doesNotMatch(JSON.stringify(history), /file_path|\/modified\//);
});

test("source file activity counts only proven customer download requests", () => {
  const order = fixtureOrder();
  const history = projectCustomerDeliveryHistory(order, [
    {
      event_type: CUSTOMER_FILE_DOWNLOAD_EVENT,
      actor_user_id: order.customer_id,
      new_value: {
        file_kind: "original",
        file_id: "original",
        file_name: "original.bin",
      },
      created_at: "2026-07-28T13:00:00.000Z",
    },
    {
      event_type: CUSTOMER_FILE_DOWNLOAD_EVENT,
      actor_user_id: order.customer_id,
      new_value: {
        file_kind: "additional",
        file_id: "upload-1",
        file_name: "log.csv",
      },
      created_at: "2026-07-28T14:00:00.000Z",
    },
    {
      event_type: CUSTOMER_FILE_DOWNLOAD_EVENT,
      actor_user_id: "00000000-0000-4000-8000-000000000099",
      new_value: {
        file_kind: "additional",
        file_id: "upload-1",
        file_name: "log.csv",
      },
      created_at: "2026-07-28T15:00:00.000Z",
    },
  ]);

  assert.equal(history.original.downloadCount, 1);
  assert.equal(history.original.lastDownloadedAt, "2026-07-28T13:00:00.000Z");
  assert.equal(history.customerUploads.length, 1);
  assert.equal(history.customerUploads[0].downloadCount, 1);
  assert.equal(history.customerUploads[0].lastDownloadedAt, "2026-07-28T14:00:00.000Z");
  assert.doesNotMatch(
    JSON.stringify(history),
    /file_path|original_file_path|\/additional\/|\/modified\//
  );
});

test("source file resolution is exact, tenant-bound and traversal-safe", () => {
  const order = fixtureOrder();
  const files = getStoredCustomerSourceFiles(order);
  const original = resolveCustomerSourceFile(order, "original", "original");
  const additional = resolveCustomerSourceFile(order, "additional", "upload-1");

  assert.equal(files.length, 2);
  assert.equal(original?.file_name, "original.bin");
  assert.equal(additional?.file_name, "log.csv");
  assert.equal(resolveCustomerSourceFile(order, "additional", "missing"), null);
  assert.equal(
    isExpectedCustomerSourcePath(
      original!.file_path,
      order.customer_id,
      order.id,
      "original"
    ),
    true
  );
  assert.equal(
    isExpectedCustomerSourcePath(
      `${order.customer_id}/legacy-original.bin`,
      order.customer_id,
      order.id,
      "original"
    ),
    true
  );
  assert.equal(
    isExpectedCustomerSourcePath(
      additional!.file_path,
      order.customer_id,
      order.id,
      "additional"
    ),
    true
  );
  assert.equal(
    isExpectedCustomerSourcePath(
      `${order.customer_id}/additional/${order.id}/../other.bin`,
      order.customer_id,
      order.id,
      "additional"
    ),
    false
  );
  assert.equal(
    isExpectedCustomerSourcePath(
      `other-customer/additional/${order.id}/other.bin`,
      order.customer_id,
      order.id,
      "additional"
    ),
    false
  );
  assert.equal(
    isExpectedCustomerSourcePath(
      `${order.customer_id}/additional/other-request/other.bin`,
      order.customer_id,
      order.id,
      "additional"
    ),
    false
  );

  const duplicateUploads = fixtureOrder({
    customer_uploads: [
      ...(order.customer_uploads as Array<Record<string, unknown>>),
      { ...(order.customer_uploads as Array<Record<string, unknown>>)[0] },
    ],
  });
  assert.equal(resolveCustomerSourceFile(duplicateUploads, "additional", "upload-1"), null);
});

test("delivery summary combines every delivered version without private file metadata", () => {
  const order = fixtureOrder({
    modified_files: [
      ...(fixtureOrder().modified_files as Array<Record<string, unknown>>),
      {
        id: "revision-2",
        label: "V15",
        file_name: "revision-2.bin",
        file_path:
          "00000000-0000-4000-8000-000000000002/modified/00000000-0000-4000-8000-000000000001/revision/revision-2.bin",
        uploaded_at: "2026-07-29T09:00:00.000Z",
      },
    ],
  });
  const history = projectCustomerDeliveryHistory(order, [
    {
      event_type: CUSTOMER_FILE_DOWNLOAD_EVENT,
      actor_user_id: order.customer_id,
      new_value: { version_id: "final-1" },
      created_at: "2026-07-28T15:30:00.000Z",
    },
    {
      event_type: CUSTOMER_FILE_DOWNLOAD_EVENT,
      actor_user_id: order.customer_id,
      new_value: { version_id: "revision-2" },
      created_at: "2026-07-29T10:00:00.000Z",
    },
    {
      event_type: CUSTOMER_FILE_DOWNLOAD_EVENT,
      actor_user_id: order.customer_id,
      new_value: { version_id: "revision-2" },
      created_at: "2026-07-29T11:00:00.000Z",
    },
  ]);

  assert.deepEqual(summarizeCustomerDeliveryHistory(history), {
    deliveredVersionCount: 2,
    totalDownloadCount: 3,
    latestDeliveredAt: "2026-07-29T09:00:00.000Z",
    lastDownloadedAt: "2026-07-29T11:00:00.000Z",
  });
  assert.equal(history.versions[1].label, "V15");
  assert.doesNotMatch(
    JSON.stringify(summarizeCustomerDeliveryHistory(history)),
    /file_path|signedUrl|storage|\/modified\//
  );
});

test("delivery resolution rejects ambiguous ids and path traversal", () => {
  const order = fixtureOrder();
  const resolved = resolveCustomerDeliveryVersion(order, "final-1");
  assert.equal(resolved?.file_name, "final.bin");
  assert.equal(resolveCustomerDeliveryVersion(order, "missing"), null);

  const stored = order.modified_files as Array<Record<string, unknown>>;
  const duplicate = fixtureOrder({ modified_files: [stored[0], { ...stored[0] }] });
  assert.equal(resolveCustomerDeliveryVersion(duplicate, "final-1"), null);

  assert.equal(
    isExpectedCustomerDeliveryPath(resolved!.file_path, order.customer_id, order.id),
    true
  );
  assert.equal(
    isExpectedCustomerDeliveryPath(
      `${order.customer_id}/modified/${order.id}/../other.bin`,
      order.customer_id,
      order.id
    ),
    false
  );
  assert.equal(
    isExpectedCustomerDeliveryPath("other-customer/modified/order/file.bin", order.customer_id, order.id),
    false
  );
});

test("customer order access preserves tenant isolation and explicit staff permissions", () => {
  const customerAccess: StaffAccess = { role: "customer", staffRole: null, permissions: [] };
  const supportAccess: StaffAccess = {
    role: "staff",
    staffRole: "support",
    permissions: ["orders.view"],
  };
  const fileStaffAccess: StaffAccess = {
    role: "staff",
    staffRole: "calibrator",
    permissions: ["orders.view", "files.download"],
  };

  assert.equal(canReadCustomerOrder("customer-a", "customer-a", customerAccess), true);
  assert.equal(canReadCustomerOrder("customer-a", "customer-b", customerAccess), false);
  assert.equal(canReadCustomerOrder("staff-a", "customer-b", supportAccess), true);
  assert.equal(canDownloadCustomerOrder("staff-a", "customer-b", supportAccess), false);
  assert.equal(canDownloadCustomerOrder("staff-a", "customer-b", fileStaffAccess), true);
});

test("legacy completed delivery stays available without leaking its path", () => {
  const order = fixtureOrder({ modified_files: null });
  const versions = getStoredModifiedFileVersions(order);
  const history = projectCustomerDeliveryHistory(order, []);

  assert.equal(versions[0].id, "legacy-final");
  assert.equal(history.versions[0].id, "legacy-final");
  assert.equal(history.versions[0].downloadCount, 0);
  assert.doesNotMatch(JSON.stringify(history), /\/modified\//);
});

test("download audit metadata is customer-safe and contains no storage path", () => {
  const version = getStoredModifiedFileVersions(fixtureOrder())[0];
  const audit = buildCustomerDownloadAuditValue(version);

  assert.deepEqual(audit, {
    version_id: "final-1",
    label: "final",
    file_name: "final.bin",
  });
  assert.doesNotMatch(JSON.stringify(audit), /file_path|\/modified\//);
});

test("source download audit metadata contains identity but no private path", () => {
  const sourceFile = resolveCustomerSourceFile(
    fixtureOrder(),
    "additional",
    "upload-1"
  );
  assert.ok(sourceFile);
  const audit = buildCustomerSourceDownloadAuditValue(sourceFile);

  assert.deepEqual(audit, {
    file_kind: "additional",
    file_id: "upload-1",
    file_name: "log.csv",
  });
  assert.doesNotMatch(
    JSON.stringify(audit),
    /file_path|storage|hash|\/additional\//
  );
});

test("customer delivery API is ownership-bound, audited and version-id based", () => {
  const detailRoute = source("src", "app", "api", "requests", "[id]", "route.ts");
  const deliveryRoute = source("src", "app", "api", "requests", "[id]", "deliveries", "route.ts");
  const sourceFileRoute = source("src", "app", "api", "requests", "[id]", "source-files", "route.ts");
  const page = source("src", "app", "dashboard", "orders", "[id]", "page.tsx");
  const finalize = source("src", "app", "api", "requests", "[id]", "additional-file", "finalize", "route.ts");

  assert.match(detailRoute, /requireApiUser\(request\)/);
  assert.match(detailRoute, /canReadCustomerOrder\(auth\.user\.id, order\.customer_id, auth\.access\)/);
  assert.match(detailRoute, /orderResult\.error\?\.code === "42703"/);
  assert.match(detailRoute, /customerOrderDetailLegacySelect/);
  assert.match(detailRoute, /projectCustomerOrder\(order\)/);
  assert.match(deliveryRoute, /requireApiUser\(request\)/);
  assert.match(deliveryRoute, /canDownloadCustomerOrder\(auth\.user\.id, order\.customer_id, auth\.access\)/);
  assert.match(deliveryRoute, /result\.error\?\.code === "42703"/);
  assert.match(deliveryRoute, /versionId/);
  assert.match(deliveryRoute, /isExpectedCustomerDeliveryPath/);
  assert.match(deliveryRoute, /recordWorkOrderEvent/);
  assert.match(deliveryRoute, /customerVisible:\s*false/);
  assert.match(deliveryRoute, /customerOwnDownload = auth\.user\.id === order\.customer_id/);
  assert.match(deliveryRoute, /\.eq\("actor_user_id", customerId\)/);
  assert.match(deliveryRoute, /readBoundedJsonBody\(request, 8 \* 1024\)/);
  assert.match(deliveryRoute, /checkAdaptiveRateLimit/);
  assert.match(deliveryRoute, /suffix: `\$\{auth\.user\.id\}:\$\{id\}:\$\{parsed\.data\.versionId\}`/);
  assert.match(deliveryRoute, /rate\.source !== "distributed"/);
  assert.match(deliveryRoute, /rateLimitResponseHeaders/);
  assert.doesNotMatch(deliveryRoute, /bodySchema[\s\S]*filePath/);
  assert.match(sourceFileRoute, /requireApiUser\(request\)/);
  assert.match(sourceFileRoute, /\.eq\("customer_id", customerId\)/);
  assert.match(sourceFileRoute, /order\.customer_id !== auth\.user\.id/);
  assert.match(sourceFileRoute, /resolveCustomerSourceFile/);
  assert.match(sourceFileRoute, /isExpectedCustomerSourcePath/);
  assert.match(sourceFileRoute, /checkAdaptiveRateLimit/);
  assert.match(sourceFileRoute, /rate\.source !== "distributed"/);
  assert.match(sourceFileRoute, /recordWorkOrderEvent/);
  assert.match(sourceFileRoute, /buildCustomerSourceDownloadAuditValue/);
  assert.match(sourceFileRoute, /createSignedUrl\(sourceFile\.file_path, 60, \{ download: true \}\)/);
  assert.doesNotMatch(sourceFileRoute, /filePath:\s*z\.|path:\s*z\./);
  const deliveryEventLoad = deliveryRoute.indexOf("const existingEvents = await loadDownloadEvents");
  const deliverySign = deliveryRoute.indexOf(".createSignedUrl(version.file_path, 60)");
  const deliveryAudit = deliveryRoute.indexOf("await recordWorkOrderEvent", deliverySign);
  assert.ok(deliveryEventLoad > 0 && deliveryEventLoad < deliverySign);
  assert.ok(deliverySign > 0 && deliverySign < deliveryAudit);
  const sourceEventLoad = sourceFileRoute.indexOf("const existingEvents = await loadCustomerDownloadEvents");
  const sourceSign = sourceFileRoute.indexOf(".createSignedUrl(sourceFile.file_path, 60");
  const sourceAudit = sourceFileRoute.indexOf("await recordWorkOrderEvent", sourceSign);
  assert.ok(sourceEventLoad > 0 && sourceEventLoad < sourceSign);
  assert.ok(sourceSign > 0 && sourceSign < sourceAudit);
  assert.match(page, /\/api\/requests\/\$\{order\.id\}\/deliveries/);
  assert.match(page, /\/api\/requests\/\$\{order\.id\}\/source-files/);
  assert.match(page, /Portal download requests:/);
  assert.match(page, /does not confirm byte-complete transfer/);
  assert.match(page, /Delivered \{formatDate\(version\.deliveredAt\)\}/);
  assert.match(page, /Berlin time/);
  assert.doesNotMatch(page, /createSignedUrl|version\.file_path|modified_file_path|modified_files/);

  const responseProjection = finalize.slice(finalize.lastIndexOf("return NextResponse.json"));
  assert.doesNotMatch(responseProjection, /file_path/);
});

test("admin work order shows delivery versions, counts and Berlin delivery times", () => {
  const server = source("src", "lib", "workOrders", "server.ts");
  const adminPage = source(
    "src",
    "app",
    "admin",
    "requests",
    "[id]",
    "WorkOrderDetailClient.tsx"
  );
  const adminRoute = source("src", "app", "api", "admin", "requests", "[id]", "route.ts");

  assert.match(adminRoute, /requireStaffPermission\(request, "orders\.view"\)/);
  assert.match(server, /\.eq\("event_type", CUSTOMER_FILE_DOWNLOAD_EVENT\)/);
  assert.match(server, /projectCustomerDeliveryHistory/);
  assert.match(server, /summarizeCustomerDeliveryHistory/);
  assert.match(server, /deliveryTrackingAvailable/);
  assert.match(adminPage, /Files & delivery/);
  assert.match(adminPage, /Delivered versions/);
  assert.match(adminPage, /Portal requests/);
  assert.match(adminPage, /Latest delivery/);
  assert.match(adminPage, /Last request/);
  assert.match(adminPage, /Europe\/Berlin/);
  assert.match(adminPage, /Customer requested download/);
  assert.match(adminPage, /No customer download request/);
  assert.match(adminPage, /Customer files/);
  assert.match(adminPage, /Additional uploads/);
  assert.match(adminPage, /payload\.deliveryHistory\.customerUploads/);
  assert.match(adminPage, /staff downloads are excluded/i);
  assert.match(adminPage, /formatFileVersionLabel\(label\)/);

  const legacyAdmin = source("src", "app", "admin", "page.tsx");
  assert.match(legacyAdmin, /href=\{`\/admin\/requests\/\$\{order\.id\}`\}/);
  assert.match(legacyAdmin, /Open file activity/);
});

test("anonymous users cannot load an order or request a delivery download", async () => {
  const detailRoute = await import("../src/app/api/requests/[id]/route");
  const deliveryRoute = await import("../src/app/api/requests/[id]/deliveries/route");
  const sourceFileRoute = await import("../src/app/api/requests/[id]/source-files/route");
  const context = { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000001" }) };

  const detailResponse = await detailRoute.GET(
    new Request("http://localhost/api/requests/order-id"),
    context
  );
  const downloadResponse = await deliveryRoute.POST(
    new Request("http://localhost/api/requests/order-id/deliveries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ versionId: "final-1" }),
    }),
    context
  );
  const sourceDownloadResponse = await sourceFileRoute.POST(
    new Request("http://localhost/api/requests/order-id/source-files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "original", fileId: "original" }),
    }),
    context
  );

  assert.equal(detailResponse.status, 401);
  assert.equal(downloadResponse.status, 401);
  assert.equal(sourceDownloadResponse.status, 401);
});

test("desktop order workspace uses shared navigation and a bounded chat aside while mobile remains stacked", () => {
  const page = source("src", "app", "dashboard", "orders", "[id]", "page.tsx");
  const workspaceStyles = source(
    "src",
    "app",
    "dashboard",
    "orders",
    "[id]",
    "order-workspace.module.css"
  );
  const chat = source("src", "components", "RequestChat.tsx");

  assert.match(page, /workspaceStyles\.viewportShell/);
  assert.match(page, /workspaceStyles\.workspaceColumns/);
  assert.match(page, /<CustomerPortalSidebar activeItem="orders" credits=\{credits\} \/>/);
  assert.match(page, /lg:grid-cols-\[minmax\(0,1fr\)_minmax\(20rem,0\.42fr\)\]/);
  assert.match(page, /workspaceStyles\.workspaceChatColumn/);
  assert.match(workspaceStyles, /@media \(min-width: 1024px\)/);
  assert.match(workspaceStyles, /position: sticky/);
  assert.doesNotMatch(workspaceStyles, /height: 640px/);
  assert.match(chat, /Order conversation/);
  assert.match(page, /Vehicle & technical data/);
  assert.match(page, /Delivery history/);
  assert.match(chat, /lg:flex lg:max-h-\[calc\(100dvh-8\.25rem\)\] lg:min-h-\[31rem\] lg:flex-col/);
  assert.match(chat, /lg:min-h-0 lg:max-h-none lg:flex-1/);
});
