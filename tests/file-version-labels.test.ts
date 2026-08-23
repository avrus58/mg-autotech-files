import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  buildFileVersionPathSegment,
  formatFileVersionLabel,
  normalizeFileVersionLabel,
} from "../src/lib/fileVersionLabels";
import {
  getStoredModifiedFileVersions,
  projectCustomerDeliveryHistory,
} from "../src/lib/customerOrderDelivery";

const root = process.cwd();

function source(...parts: string[]) {
  return fs.readFileSync(path.join(root, ...parts), "utf8");
}

test("file version labels preserve presets and safe custom admin labels", () => {
  assert.equal(normalizeFileVersionLabel("v1"), "v1");
  assert.equal(normalizeFileVersionLabel(" Revision "), "revision");
  assert.equal(normalizeFileVersionLabel("FINAL"), "final");
  assert.equal(normalizeFileVersionLabel("  V15  "), "V15");
  assert.equal(normalizeFileVersionLabel("Dyno   Fix 2"), "Dyno Fix 2");
  assert.equal(formatFileVersionLabel("v1"), "V1");
  assert.equal(formatFileVersionLabel("V15"), "V15");
});

test("file version labels reject path syntax and produce safe storage segments", () => {
  assert.equal(normalizeFileVersionLabel(""), null);
  assert.equal(normalizeFileVersionLabel("../final"), null);
  assert.equal(normalizeFileVersionLabel("V15/final"), null);
  assert.equal(normalizeFileVersionLabel("<script>"), null);
  assert.equal(normalizeFileVersionLabel("x".repeat(41)), null);
  assert.equal(buildFileVersionPathSegment("V15"), "v15");
  assert.equal(buildFileVersionPathSegment("Dyno Fix 2"), "dyno-fix-2");
  assert.equal(buildFileVersionPathSegment("Özel Sürüm"), "ozel-surum");
});

test("customer delivery history accepts safe custom labels without exposing paths", () => {
  const order = {
    customer_id: "customer",
    uploaded_file_name: "original.bin",
    original_file_path: "customer/request/original.bin",
    customer_uploads: [],
    created_at: "2026-07-29T10:00:00.000Z",
    modified_file_path: null,
    modified_files: [
      {
        id: "v15-1",
        label: "V15",
        file_name: "completed-v15.bin",
        file_path: "customer/modified/order/v15/completed-v15.bin",
        uploaded_at: "2026-07-29T11:00:00.000Z",
      },
      {
        id: "unsafe-1",
        label: "../unsafe",
        file_name: "unsafe.bin",
        file_path: "customer/modified/order/unsafe/unsafe.bin",
        uploaded_at: "2026-07-29T11:30:00.000Z",
      },
    ],
  };

  const stored = getStoredModifiedFileVersions(order);
  const history = projectCustomerDeliveryHistory(order, []);

  assert.equal(stored.length, 1);
  assert.equal(stored[0].label, "V15");
  assert.equal(history.versions[0].label, "V15");
  assert.doesNotMatch(JSON.stringify(history), /file_path|\/modified\//);
});

test("admin custom version UI and delivery API enforce the same safe label contract", () => {
  const adminPage = source("src", "app", "admin", "page.tsx");
  const deliveryRoute = source(
    "src",
    "app",
    "api",
    "admin",
    "orders",
    "[id]",
    "complete-delivery",
    "route.ts"
  );
  const customerPage = source(
    "src",
    "app",
    "dashboard",
    "orders",
    "[id]",
    "page.tsx"
  );

  assert.match(adminPage, /Custom label\.\.\./);
  assert.match(adminPage, /aria-label="Custom version label"/);
  assert.match(adminPage, /placeholder="e\.g\. V15 or Final 2"/);
  assert.match(adminPage, /FILE_VERSION_LABEL_MAX_LENGTH/);
  assert.match(adminPage, /buildFileVersionPathSegment\(normalizedLabel\)/);
  assert.match(deliveryRoute, /normalizeFileVersionLabel/);
  assert.match(deliveryRoute, /expectedVersionPrefix/);
  assert.match(deliveryRoute, /filePath\.includes\("\\\\"\)/);
  assert.doesNotMatch(deliveryRoute, /z\.enum\(\["v1", "revision", "final"\]\)/);
  assert.match(customerPage, /import \{ formatFileVersionLabel \} from "@\/lib\/fileVersionLabels"/);
});
