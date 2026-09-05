import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  buildOperationsQueueSummary,
  getCustomerProfileReadiness,
  normalizeOperationsSearchTerm,
  searchOperationsRecords,
  type OperationsProfile,
} from "../src/lib/operationsIntelligence";
import { evaluateRequestIntelligence } from "../src/lib/requestIntelligence";
import { projectPublicDesktopRelease } from "../src/lib/desktopUpload/releaseReadiness";
import type { AdminRequestListItem } from "../src/lib/workOrders/server";

function projectFile(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

function profile(overrides: Partial<OperationsProfile> = {}): OperationsProfile {
  return {
    id: "customer-1",
    email: "workshop@example.com",
    customer_id: "MGA-10001",
    full_name: "Workshop User",
    account_type: "company",
    company_name: "Workshop GmbH",
    phone: "+49 000 000000",
    street: "Teststr. 1",
    postal_code: "70173",
    city: "Stuttgart",
    country: "Germany",
    invoice_email: "invoice@example.com",
    preferred_contact: "email",
    account_status: "active",
    created_at: "2026-07-01T10:00:00.000Z",
    ...overrides,
  };
}

function requestItem(overrides: {
  id?: string;
  state?: string;
  terminal?: boolean;
  blocked?: boolean;
  priority?: "urgent" | "high" | "normal" | "low";
  assigned?: boolean;
  etaMinutes?: number | null;
  createdAt?: string;
} = {}): AdminRequestListItem {
  const id = overrides.id ?? "00000000-0000-4000-8000-000000000001";
  const state = (overrides.state ?? "in_progress") as AdminRequestListItem["queueProjection"]["state"];
  const terminal = overrides.terminal ?? false;
  const blocked = overrides.blocked ?? false;
  const priority = overrides.priority ?? "normal";
  const etaMinutes = overrides.etaMinutes ?? null;
  return {
    order: {
      id,
      customer_id: "customer-1",
      customer_email: "workshop@example.com",
      vehicle_brand: "Mercedes-Benz",
      vehicle_model: "E",
      vehicle_generation: "W214",
      vehicle_engine: "E 300",
      service_type: "Stage 1",
      credits_required: 10,
      status: "in_progress",
      notes: "private note must not enter search results",
      ecu: "Bosch MG1",
      gearbox: null,
      vehicle_year: "2024",
      read_method: "OBD",
      license_plate: null,
      hw_sw: null,
      master_slave: null,
      uploaded_file_name: "safe-name.bin",
      original_file_path: "private/customer/source.bin",
      modified_file_path: null,
      modified_files: null,
      estimated_delivery_label: null,
      estimated_delivery_note: null,
      created_at: overrides.createdAt ?? "2026-07-01T10:00:00.000Z",
      updated_at: "2026-07-01T11:00:00.000Z",
    },
    customer: {
      id: "customer-1",
      email: "workshop@example.com",
      customer_id: "MGA-10001",
      full_name: "Workshop User",
      company_name: "Workshop GmbH",
      phone: "+49 000 000000",
      account_status: "active",
      customer_tags: [],
      internal_admin_note: "private",
      credit_balance: 20,
      created_at: "2026-07-01T10:00:00.000Z",
    },
    workOrder: {
      id: `work-${id}`,
      request_id: id,
      priority,
      admin_status: "in_progress",
      tuner_status: "unassigned",
      payment_review_status: "paid",
      delivery_status: "waiting_final_file",
      assigned_admin_id: overrides.assigned ? "admin-1" : null,
      assigned_tuner_id: null,
      internal_notes: null,
      customer_visible_notes: null,
      estimated_turnaround_minutes: etaMinutes,
      eta_note: null,
      risk_flags: [],
      quality_check_status: "pending",
      quality_check_json: {},
      final_file_status: "not_ready",
      delivery_method: "portal",
      last_admin_activity_at: null,
      last_customer_activity_at: null,
      created_at: "2026-07-01T10:00:00.000Z",
      updated_at: "2026-07-01T11:00:00.000Z",
    },
    queueProjection: {
      requestId: id,
      state,
      stateLabel: state.replaceAll("_", " "),
      stateDescription: "Safe queue description",
      priority,
      priorityLabel: priority,
      isBlocked: blocked,
      isTerminal: terminal,
      participatesInQueue: !blocked && !terminal,
      createdAt: overrides.createdAt ?? "2026-07-01T10:00:00.000Z",
      updatedAt: "2026-07-01T11:00:00.000Z",
      eta: {
        availability: etaMinutes == null ? "pending_review" : "available",
        minutes: etaMinutes,
        note: null,
        label: etaMinutes == null ? "ETA pending review" : `${etaMinutes} min`,
        description: "Internal estimate",
      },
      queuePosition: { position: 1, activeCount: 1, label: "1 of 1", description: "Queue" },
    },
    requestedServices: ["Stage 1"],
    indicators: { hasOriginalFile: true, hasDeliveredFile: false, hasCustomerUpload: false, trainingSampleCount: 0, hasAiEvidence: false },
  };
}

test("customer profile readiness uses existing profile fields without inventing identity data", () => {
  assert.deepEqual(getCustomerProfileReadiness(profile()), { complete: true, percent: 100, completed: 6, total: 6, missing: [] });
  const incomplete = getCustomerProfileReadiness(profile({ phone: null, street: null, company_name: null }));
  assert.equal(incomplete.complete, false);
  assert.equal(incomplete.percent, 50);
  assert.deepEqual(incomplete.missing, ["phone", "billing address", "company name"]);
});

test("operations queue summary uses explicit work-order state and ETA only", () => {
  const items = [
    requestItem({ id: "1", priority: "urgent", etaMinutes: 60, createdAt: "2026-07-01T08:00:00.000Z" }),
    requestItem({ id: "2", state: "waiting_for_customer", blocked: true, assigned: true }),
    requestItem({ id: "3", state: "delivered", terminal: true, assigned: true }),
  ];
  const summary = buildOperationsQueueSummary(items, new Date("2026-07-01T12:00:00.000Z"));
  assert.equal(summary.total, 3);
  assert.equal(summary.active, 2);
  assert.equal(summary.completed, 1);
  assert.equal(summary.needsAttention, 1);
  assert.equal(summary.waitingForCustomer, 1);
  assert.equal(summary.urgentOrHigh, 1);
  assert.equal(summary.unassigned, 1);
  assert.equal(summary.estimateElapsed, 1);
});

test("admin global search normalizes input and returns allowlisted projections only", () => {
  assert.equal(normalizeOperationsSearchTerm("  MERCEDES\u0000  "), "mercedes");
  assert.equal(normalizeOperationsSearchTerm("x".repeat(150)).length, 100);
  const results = searchOperationsRecords({ items: [requestItem()], profiles: [profile()], term: "W214" });
  assert.equal(results.length, 1);
  assert.equal(results[0]?.type, "order");
  const serialized = JSON.stringify(results);
  assert.equal(serialized.includes("private/customer"), false);
  assert.equal(serialized.includes("private note"), false);
  assert.equal(serialized.includes("internal_admin_note"), false);
  assert.equal(serialized.includes("original_file_path"), false);
  const adminPage = projectFile("src", "app", "admin", "page.tsx");
  assert.match(adminPage, /window\.location\.hash === "#customers"/);
  assert.match(adminPage, /hasStaffPermission\(access, "customers\.view"\)/);
});

test("smart request intake is advisory and preserves existing secure submission gates", () => {
  const ready = evaluateRequestIntelligence({
    hasVehicle: true,
    manualVehicle: false,
    hasService: true,
    selectedServiceIds: ["stage_1"],
    selectedServiceTitles: ["Stage 1"],
    hasValidFile: true,
    fileName: "ori.bin",
    ecu: "Bosch MG1",
    readMethod: "OBD",
    notes: "Customer requests a standard Stage 1 review.",
    accountVerified: true,
    creditsVerified: true,
  });
  assert.equal(ready.status, "ready");
  assert.equal(ready.score, 100);

  const incomplete = evaluateRequestIntelligence({
    hasVehicle: false,
    manualVehicle: true,
    hasService: true,
    selectedServiceIds: ["dtc_off"],
    selectedServiceTitles: ["DTC request"],
    hasValidFile: false,
    fileName: null,
    ecu: null,
    readMethod: null,
    notes: "please check",
    accountVerified: false,
    creditsVerified: false,
  });
  assert.equal(incomplete.status, "blocked");
  assert.ok(incomplete.findings.some((finding) => finding.key === "dtc_code"));
  assert.ok(incomplete.findings.some((finding) => finding.key === "manual_vehicle"));
});

test("desktop release projection remains selected-beta-only until every release gate is explicit", () => {
  const previous = {
    publicDownload: process.env.DESKTOP_APP_PUBLIC_DOWNLOAD_ENABLED,
    signing: process.env.DESKTOP_APP_SIGNING_STATUS,
    updateUrl: process.env.DESKTOP_APP_UPDATE_URL,
  };
  try {
    process.env.DESKTOP_APP_PUBLIC_DOWNLOAD_ENABLED = "true";
    process.env.DESKTOP_APP_SIGNING_STATUS = "unsigned_internal_beta";
    process.env.DESKTOP_APP_UPDATE_URL = "https://file.mgautotech.de/downloads/internal.exe";
    const projection = projectPublicDesktopRelease("0.1.0");
    assert.equal(projection.download_enabled, false);
    assert.equal(projection.download_url, null);
    assert.equal(projection.status, "selected_beta_only");
    assert.equal(JSON.stringify(projection).includes("service_role"), false);
  } finally {
    if (previous.publicDownload === undefined) delete process.env.DESKTOP_APP_PUBLIC_DOWNLOAD_ENABLED;
    else process.env.DESKTOP_APP_PUBLIC_DOWNLOAD_ENABLED = previous.publicDownload;
    if (previous.signing === undefined) delete process.env.DESKTOP_APP_SIGNING_STATUS;
    else process.env.DESKTOP_APP_SIGNING_STATUS = previous.signing;
    if (previous.updateUrl === undefined) delete process.env.DESKTOP_APP_UPDATE_URL;
    else process.env.DESKTOP_APP_UPDATE_URL = previous.updateUrl;
  }
});

test("operations and desktop release admin APIs require staff permissions", async () => {
  const operations = await import("../src/app/api/admin/operations/route");
  const search = await import("../src/app/api/admin/operations/search/route");
  const desktop = await import("../src/app/api/admin/desktop-app/route");
  assert.equal((await operations.GET(new Request("http://localhost/api/admin/operations"))).status, 401);
  assert.equal((await search.GET(new Request("http://localhost/api/admin/operations/search?q=mg"))).status, 401);
  assert.equal((await desktop.GET(new Request("http://localhost/api/admin/desktop-app"))).status, 401);
});

test("notification center is customer-scoped and contains no internal metadata fields", () => {
  const page = projectFile("src", "app", "dashboard", "notifications", "page.tsx");
  assert.match(page, /\.eq\("user_id", customerId\)/);
  assert.match(page, /\.eq\("user_id", userId\)/);
  assert.match(page, /\.select\(customerNotificationProjection\)/);
  const projection = projectFile("src", "lib", "customerNotificationProjection.ts");
  assert.match(projection, /"id,user_id,order_id,type,title,body,status:metadata->>status,read_at,created_at" as const/);
  assert.doesNotMatch(page, /internal_notes|risk_flags|source_reference|confidence_score|hex_preview|signed_url/);
});

test("operations API projects health data without private file or note fields", () => {
  const route = projectFile("src", "app", "api", "admin", "operations", "route.ts");
  const search = projectFile("src", "app", "api", "admin", "operations", "search", "route.ts");
  assert.match(route, /requireStaffPermission\(request, "orders\.view"\)/);
  assert.match(search, /requireStaffPermission\(request, "orders\.view"\)/);
  assert.match(route, /\.eq\("role", "customer"\)/);
  assert.match(search, /\.eq\("role", "customer"\)/);
  assert.doesNotMatch(route, /original_file_path:|modified_file_path:|internal_notes:|admin_notes:|signed_url:|hex:/);
  assert.doesNotMatch(search, /previous_access|new_access|internal_admin_note/);
});

test("workshop knowledge center strengthens internal SEO without lengthening the homepage", () => {
  const page = projectFile("src", "app", "workshop-guides", "page.tsx");
  const sitemap = projectFile("src", "app", "sitemap.ts");
  const robots = projectFile("src", "app", "robots.ts");
  const homepage = projectFile("src", "components", "homepage", "HomepageExperience.tsx");
  assert.match(page, /CollectionPage/);
  assert.match(page, /ItemList/);
  assert.match(page, /FAQPage/);
  assert.match(page, /Public guidance boundary/);
  assert.match(sitemap, /\/workshop-guides/);
  assert.match(robots, /\/workshop-guides/);
  assert.doesNotMatch(homepage, /Workshop Knowledge Center/);
});
