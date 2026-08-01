import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  classifyPlatformFailure,
  normalizeReliabilityRoute,
  normalizeWebVitalValue,
} from "../src/lib/platformReliability";

function source(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

test("runtime route normalization removes queries and private identifiers", () => {
  assert.equal(normalizeReliabilityRoute("/admin/requests/32007019-ac4b-48cb-a648-668ffa5e4d69?email=private"), "/admin/requests/:id");
  assert.equal(normalizeReliabilityRoute("/dashboard/orders/verylongprivateorder123456"), "/dashboard/orders/:id");
  assert.equal(normalizeReliabilityRoute("/services/stage-1?utm_source=search"), "/services/stage-1");
  assert.equal(normalizeReliabilityRoute("https://example.com/private"), null);
});

test("runtime failures are reduced to coarse allowlisted categories", () => {
  assert.equal(classifyPlatformFailure(new Error("Loading chunk 123 failed")), "chunk_load");
  assert.equal(classifyPlatformFailure(new TypeError("Failed to fetch")), "network");
  assert.equal(classifyPlatformFailure(new Error("refresh token session error")), "auth_recovery");
  assert.equal(classifyPlatformFailure(new Error("React hydration failed")), "render");
  assert.equal(classifyPlatformFailure(new Error("customer@example.com")), "unknown");
});

test("web vital values are finite, bounded and stable", () => {
  assert.equal(normalizeWebVitalValue("CLS", 0.123456), 0.1235);
  assert.equal(normalizeWebVitalValue("LCP", 2488.84), 2488.8);
  assert.equal(normalizeWebVitalValue("LCP", Number.NaN), null);
  assert.equal(normalizeWebVitalValue("TTFB", 999_999), 120_000);
});

test("observability endpoint accepts safe telemetry and rejects extra private fields", async () => {
  const { POST } = await import("../src/app/api/observability/client-event/route");
  const accepted = await POST(new Request("http://localhost/api/observability/client-event", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.20", "x-vercel-ip-country": "DE" },
    body: JSON.stringify({ kind: "client_error", route: "/dashboard/orders/32007019-ac4b-48cb-a648-668ffa5e4d69", category: "network" }),
  }));
  assert.equal(accepted.status, 202);
  assert.deepEqual(await accepted.json(), { accepted: true });

  const rejected = await POST(new Request("http://localhost/api/observability/client-event", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.21" },
    body: JSON.stringify({ kind: "client_error", route: "/dashboard", category: "unknown", message: "private filename.bin" }),
  }));
  assert.equal(rejected.status, 400);
});

test("client diagnostics never transmit messages, stacks, users or request metadata", () => {
  const monitor = source("src", "components", "PlatformReliabilityMonitor.tsx");
  const route = source("src", "app", "api", "observability", "client-event", "route.ts");
  const payloadContract = monitor.slice(0, monitor.indexOf("const reportedFailures"));

  for (const forbidden of ["message", "stack", "email", "customerId", "orderId", "filename", "storagePath"]) {
    assert.doesNotMatch(payloadContract, new RegExp(forbidden, "i"), forbidden);
  }
  assert.match(route, /\.strict\(\)/);
  assert.match(route, /checkRateLimit/);
  assert.match(route, /"Cache-Control": "no-store"/);
  assert.doesNotMatch(route, /getSupabaseAdmin|\.from\(/);
});

test("global and route error boundaries provide recovery without exposing details", () => {
  const error = source("src", "app", "error.tsx");
  const globalError = source("src", "app", "global-error.tsx");
  const layout = source("src", "app", "layout.tsx");

  assert.match(error, /reportPlatformFailure\("fatal_render", error\)/);
  assert.match(globalError, /reportPlatformFailure\("fatal_render", error\)/);
  assert.match(layout, /<PlatformReliabilityMonitor \/>/);
  assert.doesNotMatch(error + globalError, /error\.message|error\.stack|error\.digest/);
});

test("operations health includes SEO index and aggregate conversion source readiness", () => {
  const operations = source("src", "app", "api", "admin", "operations", "route.ts");
  assert.match(operations, /getSeoGrowthConfiguration/);
  assert.match(operations, /SEO index and conversion measurement/);
  assert.match(operations, /searchConsoleConfigured && seoMeasurement\.analyticsConfigured/);
  assert.doesNotMatch(operations, /serviceAccountPrivateKey:/);
});
