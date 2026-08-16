import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";
import {
  buildAdminRequestAccess,
  projectAdminOrderRow,
  projectAdminProfileRow,
} from "../src/lib/workOrders/access";

function source(...parts: string[]) {
  return readFileSync(resolve(process.cwd(), ...parts), "utf8");
}

test("admin order projection keeps each sensitive domain behind its permission", () => {
  const access = buildAdminRequestAccess({
    role: "staff",
    staffRole: "support",
    permissions: ["orders.view"],
  });
  const projected = projectAdminOrderRow({
    id: "order-1",
    customer_id: "customer-secret",
    customer_email: "private@example.test",
    license_plate: "PII-123",
    credits_required: 42,
    uploaded_file_name: "secret.bin",
    original_file_path: "private/original.bin",
    modified_file_path: "private/modified.bin",
    modified_files: [{ file_path: "private/version.bin" }],
    customer_uploads: [{ file_path: "private/customer.bin" }],
    vehicle_brand: "MG",
    stripe_customer_id: "must-never-be-spread",
  }, access);

  assert.equal(projected.vehicle_brand, "MG");
  assert.equal(projected.customer_id, null);
  assert.equal(projected.customer_email, null);
  assert.equal(projected.license_plate, null);
  assert.equal(projected.credits_required, null);
  assert.equal(projected.original_file_path, null);
  assert.equal(projected.modified_files, null);
  assert.equal(projected.customer_uploads, null);
  assert.equal("stripe_customer_id" in projected, false);
});

test("customer profile and finance permissions remain independent", () => {
  const profile = {
    id: "customer-1",
    email: "private@example.test",
    credit_balance: 999,
  };
  const customerOnly = buildAdminRequestAccess({
    role: "staff",
    staffRole: "support",
    permissions: ["orders.view", "customers.view"],
  });
  const financeOnly = buildAdminRequestAccess({
    role: "staff",
    staffRole: "support",
    permissions: ["orders.view", "credits.manage"],
  });

  assert.equal(projectAdminProfileRow(profile, customerOnly)?.credit_balance, null);
  assert.equal(projectAdminProfileRow(profile, financeOnly), null);
});

test("admin request APIs pass permission projections and gate cross-domain mutations", () => {
  const listRoute = source("src", "app", "api", "admin", "requests", "route.ts");
  const detailRoute = source("src", "app", "api", "admin", "requests", "[id]", "route.ts");
  const notesRoute = source("src", "app", "api", "admin", "requests", "[id]", "notes", "route.ts");
  const dtcRoute = source("src", "app", "api", "admin", "requests", "[id]", "dtc-analysis", "route.ts");
  const dashboardRoute = source("src", "app", "api", "admin", "dashboard", "route.ts");
  const server = source("src", "lib", "workOrders", "server.ts");

  assert.match(listRoute, /getAdminRequestList\(buildAdminRequestAccess\(auth\.access\)\)/);
  assert.match(detailRoute, /getAdminRequestDetail\([\s\S]*buildAdminRequestAccess\(auth\.access\)/);
  assert.match(detailRoute, /payment_review_status[\s\S]*credits\.manage/);
  assert.match(detailRoute, /final_file_status[\s\S]*files\.upload/);
  assert.match(detailRoute, /message_visibility[\s\S]*messages\.manage/);
  assert.match(notesRoute, /note_type === "customer_visible"[\s\S]*messages\.manage/);
  assert.match(dtcRoute, /requireStaffPermissions\(request, \["orders\.view", "file_expert\.manage"\]\)/);
  assert.match(dashboardRoute, /projectAdminOrderRow/);
  assert.match(server, /\.select\(adminOrderSelect\)/);
  assert.match(server, /metadata: \{\}/);
});

test("customer messaging and revision routes enforce durable abuse and replay guards", () => {
  const messages = source("src", "app", "api", "requests", "[id]", "messages", "route.ts");
  const revision = source("src", "app", "api", "requests", "[id]", "revision", "route.ts");

  assert.match(messages, /checkAdaptiveRateLimit/);
  assert.match(messages, /CUSTOMER_MESSAGE_BURST_LIMIT/);
  assert.match(messages, /CUSTOMER_MESSAGE_DAILY_LIMIT/);
  assert.match(messages, /select\("id", \{ count: "exact", head: true \}\)/);
  assert.match(revision, /z\.string\(\)\.trim\(\)\.min\(1\)\.max\(4000\)/);
  assert.match(revision, /order\.status === "revision"/);
  assert.match(revision, /\.eq\("status", "completed"\)/);
  assert.doesNotMatch(revision, /error: updateError\.message/);
  assert.doesNotMatch(revision, /error: messageError\?\.message/);
});
