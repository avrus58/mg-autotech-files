import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { canReadCustomerOrder } from "../src/lib/customerOrderDelivery";
import {
  buildRepeatRequestPrefill,
  isRepeatRequestId,
  resolveRepeatRequestServices,
  type RepeatRequestOrder,
} from "../src/lib/repeatRequest";
import type { StaffAccess } from "../src/lib/staffPermissions";

const root = process.cwd();

const mainServices = [
  { id: "stage_1", title: "Stage 1" },
  { id: "stage_2", title: "Stage 2" },
  { id: "only_options", title: "Only Options" },
];

const extraServices = [
  { id: "dpf_egr_off", title: "DPF + EGR Removal" },
  { id: "pops_bangs", title: "Pop and Bangs" },
  { id: "start_stop", title: "Start / Stop Removal" },
];

function source(...parts: string[]) {
  return fs.readFileSync(path.join(root, ...parts), "utf8");
}

function fixtureOrder(overrides: Partial<RepeatRequestOrder> = {}): RepeatRequestOrder {
  return {
    id: "00000000-0000-4000-8000-000000000071",
    vehicle_brand: "Mercedes-Benz",
    vehicle_model: "E",
    vehicle_generation: "W214/S214",
    vehicle_engine: "E 450 d 367hp",
    service_type: "Stage 1 + DPF + EGR Removal + Start / Stop Removal",
    ecu: "Bosch MD1CP001",
    gearbox: "9G-Tronic",
    vehicle_year: "2024",
    read_method: "Bench",
    hw_sw: "HW-01 / SW-22",
    master_slave: "master",
    ...overrides,
  };
}

test("repeat request resolves exact service sequences including titles containing plus signs", () => {
  const selection = resolveRepeatRequestServices(
    "Stage 1 + DPF + EGR Removal + Pop and Bangs",
    mainServices,
    extraServices
  );

  assert.deepEqual(selection, {
    mainServiceId: "stage_1",
    extraServiceIds: ["dpf_egr_off", "pops_bangs"],
    fullyResolved: true,
    sourceSummary: "Stage 1 + DPF + EGR Removal + Pop and Bangs",
  });
});

test("unknown or partially matched service summaries require explicit customer reselection", () => {
  const unknown = resolveRepeatRequestServices(
    "Stage 1 + Unlisted Legacy Option",
    mainServices,
    extraServices
  );

  assert.equal(unknown.fullyResolved, false);
  assert.equal(unknown.mainServiceId, null);
  assert.deepEqual(unknown.extraServiceIds, []);

  const ambiguous = resolveRepeatRequestServices(
    "Stage 1",
    [...mainServices, { id: "legacy_stage_1", title: "Stage 1" }],
    extraServices
  );
  assert.equal(ambiguous.fullyResolved, false);
  assert.equal(ambiguous.mainServiceId, null);
});

test("repeat prefill uses a strict allowlist and omits files, notes, payment and customer metadata", () => {
  const sourceOrder = {
    ...fixtureOrder(),
    customer_email: "private@example.test",
    customer_id: "customer-private-id",
    notes: "Do not copy this note",
    license_plate: "PRIVATE-PLATE",
    credits_required: 27,
    original_file_path: "private/original.bin",
    modified_file_path: "private/final.bin",
    admin_notes: "Internal",
  };
  const prefill = buildRepeatRequestPrefill(sourceOrder, { mainServices, extraServices });
  const serialized = JSON.stringify(prefill);

  assert.equal(prefill.vehicle.brand, "Mercedes-Benz");
  assert.equal(prefill.technical.readMethod, "Bench");
  assert.equal(prefill.services.fullyResolved, true);
  assert.doesNotMatch(
    serialized,
    /private@example|customer-private|Do not copy|PRIVATE-PLATE|credits|required|original\.bin|final\.bin|admin_notes/i
  );
  assert.deepEqual(Object.keys(prefill).sort(), [
    "missingVehicleFields",
    "services",
    "sourceOrderId",
    "technical",
    "vehicle",
  ]);
});

test("repeat prefill rejects malformed source identifiers and normalizes safe text", () => {
  assert.equal(isRepeatRequestId("../../other-order"), false);
  assert.equal(isRepeatRequestId(fixtureOrder().id), true);
  assert.throws(
    () => buildRepeatRequestPrefill(fixtureOrder({ id: "not-an-order-id" }), { mainServices, extraServices }),
    /identifier is invalid/
  );

  const prefill = buildRepeatRequestPrefill(
    fixtureOrder({ vehicle_brand: "  Mercedes-Benz\u0000\n  " }),
    { mainServices, extraServices }
  );
  assert.equal(prefill.vehicle.brand, "Mercedes-Benz");
});

test("repeat request remains tenant-bound through the existing customer-safe order API", () => {
  const customerAccess: StaffAccess = { role: "customer", staffRole: null, permissions: [] };
  assert.equal(canReadCustomerOrder("customer-a", "customer-a", customerAccess), true);
  assert.equal(canReadCustomerOrder("customer-a", "customer-b", customerAccess), false);

  const detailRoute = source("src", "app", "api", "requests", "[id]", "route.ts");
  const newRequestPage = source("src", "app", "new-request", "page.tsx");
  assert.match(detailRoute, /requireApiUser\(request\)/);
  assert.match(detailRoute, /canReadCustomerOrder\(auth\.user\.id, order\.customer_id, auth\.access\)/);
  assert.match(detailRoute, /projectCustomerOrder\(order\)/);
  assert.match(newRequestPage, /authenticatedFetch\(`\/api\/requests\/\$\{encodeURIComponent\(repeatId\)\}`/);
  assert.doesNotMatch(newRequestPage, /setOriginalFilePath|setModifiedFilePath/);
});

test("customer order surfaces expose repeat actions while the new job requires fresh safety gates", () => {
  const detailPage = source("src", "app", "dashboard", "orders", "[id]", "page.tsx");
  const archivePage = source("src", "app", "dashboard", "orders", "page.tsx");
  const newRequestPage = source("src", "app", "new-request", "page.tsx");

  assert.match(detailPage, /href=\{`\/new-request\?repeat=\$\{order\.id\}`\}/);
  assert.match(archivePage, /href=\{`\/new-request\?repeat=\$\{order\.id\}`\}/);
  assert.match(newRequestPage, /A new original file is required/);
  assert.match(newRequestPage, /aria-live="polite"/);
  assert.match(newRequestPage, /grid grid-cols-2 gap-2 lg:w-52 lg:grid-cols-1/);
  assert.match(archivePage, /grid grid-cols-2 gap-2 md:grid-cols-1/);
  assert.match(newRequestPage, /min-h-11/);
  assert.match(newRequestPage, /setSelectedFile\(null\)/);
  assert.match(newRequestPage, /setPaymentAccepted\(false\)/);
  assert.match(newRequestPage, /setResponsibilityAccepted\(false\)/);
  assert.match(newRequestPage, /Please select the service required for this new request/);
  assert.doesNotMatch(newRequestPage, /setNotes\(payload\.order\.notes\)/);
});
