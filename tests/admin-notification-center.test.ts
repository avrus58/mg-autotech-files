import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  getAdminNotificationSummary,
  getAdminOperationalAlerts,
  getAdminRecentOrderActivity,
  type AdminNotificationOrder,
} from "../src/lib/adminNotificationCenter";

function readProjectFile(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

const orders: AdminNotificationOrder[] = [
  {
    id: "completed-order-0001",
    status: "completed",
    vehicle_brand: "Audi",
    vehicle_model: "A6",
    created_at: "2026-07-28T08:00:00.000Z",
  },
  {
    id: "file-check-order-0002",
    status: "file_check",
    vehicle_brand: "BMW",
    vehicle_model: "5 Series",
    created_at: "2026-07-28T10:00:00.000Z",
  },
  {
    id: "new-request-order-0003",
    status: "new_request",
    vehicle_brand: "Mercedes-Benz",
    vehicle_model: "E",
    created_at: "2026-07-28T11:00:00.000Z",
  },
  {
    id: "revision-order-0004",
    status: "revision",
    vehicle_brand: "Volkswagen",
    vehicle_model: "Golf",
    created_at: "2026-07-28T09:00:00.000Z",
  },
  {
    id: "progress-order-0005",
    status: "in_progress",
    vehicle_brand: null,
    vehicle_model: null,
    created_at: "2026-07-28T12:00:00.000Z",
  },
];

test("admin notification center derives active queue alerts without treating completed work as urgent", () => {
  const alerts = getAdminOperationalAlerts(orders);

  assert.deepEqual(alerts.map((alert) => alert.status), ["revision", "new_request", "file_check"]);
  assert.equal(alerts.some((alert) => alert.orderId === "completed-order-0001"), false);
  assert.equal(alerts.some((alert) => alert.orderId === "progress-order-0005"), false);
  assert.equal(alerts[1]?.vehicleLabel, "Mercedes-Benz E");
});

test("admin notification summary and recent activity stay deterministic", () => {
  assert.deepEqual(getAdminNotificationSummary(orders), {
    activeAlerts: 3,
    urgentAlerts: 2,
    inProgress: 1,
  });

  const recent = getAdminRecentOrderActivity(orders, 3);
  assert.deepEqual(recent.map((item) => item.orderId), [
    "progress-order-0005",
    "new-request-order-0003",
    "file-check-order-0002",
  ]);
  assert.equal(recent[0]?.vehicleLabel, "Vehicle details pending");
});

test("admin notification UI is persistent, responsive and derived from the admin queue", () => {
  const component = readProjectFile("src", "components", "admin", "AdminNotificationCenter.tsx");
  const dock = readProjectFile("src", "components", "admin", "AdminNotificationDock.tsx");
  const adminPage = readProjectFile("src", "app", "admin", "page.tsx");
  const adminLayout = readProjectFile("src", "app", "admin", "layout.tsx");

  assert.match(component, /Admin notifications/);
  assert.match(component, /Operations inbox/);
  assert.match(component, /Loading operations/);
  assert.match(component, /Operations are clear/);
  assert.match(component, /Queue connection unavailable/);
  assert.match(component, /Recent order activity/);
  assert.match(component, /document\.addEventListener\("mousedown"/);
  assert.match(component, /event\.key === "Escape"/);
  assert.match(component, /fixed inset-x-3[\s\S]*sm:absolute/);
  assert.doesNotMatch(component, /\.from\("notifications"\)/);
  assert.doesNotMatch(
    component,
    /customer_email|admin_notes|internal_notes|source_reference|storage_path|signed_url|service_role|raw_hex/i
  );
  assert.match(adminPage, /<AdminNotificationCenter/);
  assert.match(adminPage, /onOpenOrder=\{\(orderId\)/);
  assert.match(adminPage, /onFilterQueue=\{focusOrderQueue\}/);
  assert.match(dock, /\/api\/admin\/notifications/);
  assert.match(dock, /pathname === "\/admin"/);
  assert.match(dock, /document\.visibilityState === "visible"/);
  assert.match(dock, /\/admin\/requests\/\$\{orderId\}/);
  assert.match(adminLayout, /<AdminNotificationDock \/>/);
});

test("customer notification bell is synchronously suppressed across every admin route", () => {
  const component = readProjectFile("src", "components", "CustomerNotifications.tsx");

  assert.match(component, /pathname === "\/admin"/);
  assert.match(component, /pathname\.startsWith\("\/admin\/"\)/);
  assert.match(component, /if \(notificationsSuppressed \|\| !userId\) return null/);
  assert.match(component, /authenticatedFetch\("\/api\/account\/context"/);
  assert.match(component, /payload\?\.home === "\/dashboard"/);
  assert.match(component, /resolution !== resolutionSequence/);
});

test("admin notification API is staff-only and returns an explicit safe projection", async () => {
  const routeSource = readProjectFile("src", "app", "api", "admin", "notifications", "route.ts");
  const { GET } = await import("../src/app/api/admin/notifications/route");

  assert.equal((await GET(new Request("http://localhost/api/admin/notifications"))).status, 401);
  assert.match(routeSource, /requireStaffPermission\(request, "orders\.view"\)/);
  assert.match(routeSource, /id: order\.id/);
  assert.match(routeSource, /status: order\.status/);
  assert.match(routeSource, /vehicle_brand: order\.vehicle_brand/);
  assert.match(routeSource, /vehicle_model: order\.vehicle_model/);
  assert.match(routeSource, /created_at: order\.created_at/);
  assert.doesNotMatch(
    routeSource,
    /customer_email|customer_id|notes|original_file_path|modified_file_path|storage_path|signed_url|source_reference|confidence_score/i
  );
});
