import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  CUSTOMER_FILE_DOWNLOAD_EVENT,
  buildCustomerDownloadAuditValue,
  canDownloadCustomerOrder,
  canReadCustomerOrder,
  getStoredModifiedFileVersions,
  isExpectedCustomerDeliveryPath,
  projectCustomerDeliveryHistory,
  projectCustomerOrder,
  resolveCustomerDeliveryVersion,
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
        file_path: "private/customer/path/log.csv",
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
  assert.doesNotMatch(serialized, /private\/customer\/path|file_path|modified_files/);
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
      new_value: { version_id: "final-1" },
      created_at: "2026-07-28T14:00:00.000Z",
    },
    {
      event_type: CUSTOMER_FILE_DOWNLOAD_EVENT,
      new_value: { version_id: "final-1" },
      created_at: "2026-07-28T15:30:00.000Z",
    },
    {
      event_type: "unrelated_event",
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

test("customer delivery API is ownership-bound, audited and version-id based", () => {
  const detailRoute = source("src", "app", "api", "requests", "[id]", "route.ts");
  const deliveryRoute = source("src", "app", "api", "requests", "[id]", "deliveries", "route.ts");
  const page = source("src", "app", "dashboard", "orders", "[id]", "page.tsx");
  const finalize = source("src", "app", "api", "requests", "[id]", "additional-file", "finalize", "route.ts");

  assert.match(detailRoute, /requireApiUser\(request\)/);
  assert.match(detailRoute, /canReadCustomerOrder\(auth\.user\.id, order\.customer_id, auth\.access\)/);
  assert.match(detailRoute, /projectCustomerOrder\(order\)/);
  assert.match(deliveryRoute, /requireApiUser\(request\)/);
  assert.match(deliveryRoute, /canDownloadCustomerOrder\(auth\.user\.id, order\.customer_id, auth\.access\)/);
  assert.match(deliveryRoute, /versionId/);
  assert.match(deliveryRoute, /isExpectedCustomerDeliveryPath/);
  assert.match(deliveryRoute, /recordWorkOrderEvent/);
  assert.match(deliveryRoute, /customerVisible:\s*false/);
  assert.doesNotMatch(deliveryRoute, /bodySchema[\s\S]*filePath/);
  assert.match(page, /\/api\/requests\/\$\{order\.id\}\/deliveries/);
  assert.match(page, /Portal downloads:/);
  assert.match(page, /Delivered \{formatDate\(version\.deliveredAt\)\}/);
  assert.match(page, /Berlin time/);
  assert.doesNotMatch(page, /createSignedUrl|version\.file_path|modified_file_path|modified_files/);

  const responseProjection = finalize.slice(finalize.lastIndexOf("return NextResponse.json"));
  assert.doesNotMatch(responseProjection, /file_path/);
});

test("anonymous users cannot load an order or request a delivery download", async () => {
  const detailRoute = await import("../src/app/api/requests/[id]/route");
  const deliveryRoute = await import("../src/app/api/requests/[id]/deliveries/route");
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

  assert.equal(detailResponse.status, 401);
  assert.equal(downloadResponse.status, 401);
});

test("desktop order workspace uses a bounded three-column layout while mobile remains stacked", () => {
  const page = source("src", "app", "dashboard", "orders", "[id]", "page.tsx");
  const chat = source("src", "components", "RequestChat.tsx");

  assert.match(page, /xl:h-dvh xl:overflow-hidden/);
  assert.match(page, /xl:grid-cols-\[minmax\(310px,0\.9fr\)_minmax\(390px,1\.12fr\)_minmax\(340px,0\.98fr\)\]/);
  assert.match(chat, /Order conversation/);
  assert.match(page, /Vehicle & technical data/);
  assert.match(page, /Delivery history/);
  assert.match(chat, /xl:flex xl:h-full xl:min-h-0 xl:flex-col/);
  assert.match(chat, /xl:min-h-0 xl:max-h-none xl:flex-1/);
});
