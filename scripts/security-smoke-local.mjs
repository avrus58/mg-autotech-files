import { readdir, readFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { isLocalSmokeUrl } from "./smoke-url-guard.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const configuredBaseUrl = (process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
const baseUrl = new URL(configuredBaseUrl);
const testId = "00000000-0000-4000-8000-000000000001";

if (!isLocalSmokeUrl(baseUrl)) {
  throw new Error(`Security smoke is local-only and refused ${baseUrl.origin}.`);
}

async function routeFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await routeFiles(path));
    else if (entry.name === "route.ts") files.push(path);
  }
  return files;
}

function apiPathFor(file) {
  const routePath = relative(resolve(projectRoot, "src", "app"), file)
    .split(sep)
    .slice(0, -1)
    .map((segment) => segment.startsWith("[") ? testId : segment)
    .join("/");
  return `/${routePath}`;
}

async function request(path, method = "GET", body = null) {
  const headers = { Accept: "application/json" };
  const options = { method, headers, redirect: "manual", cache: "no-store" };
  if (body !== null) {
    headers["Content-Type"] = "application/json";
    options.body = typeof body === "string" ? body : JSON.stringify(body);
  }
  return fetch(new URL(path, baseUrl), options);
}

function expectStatus(response, expected, label) {
  if (!expected.includes(response.status)) {
    throw new Error(`${label}: expected ${expected.join("/")}, got ${response.status}`);
  }
}

async function verifyAdminApiIsolation() {
  const files = await routeFiles(resolve(projectRoot, "src", "app", "api", "admin"));
  let checked = 0;
  for (const file of files) {
    const source = await readFile(file, "utf8");
    const methods = [...source.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/g)]
      .map((match) => match[1]);
    for (const method of methods) {
      const path = apiPathFor(file);
      const response = await request(path, method, method === "GET" ? null : {});
      const expected = path === "/api/admin/ai-training/demo" ? [401, 403, 404] : [401, 403];
      expectStatus(response, expected, `${method} ${path}`);
      checked += 1;
    }
  }
  if (checked < 40) throw new Error(`Admin API discovery checked only ${checked} methods.`);
  return checked;
}

async function verifyCustomerApiIsolation() {
  const checks = [
    ["GET", "/api/desktop/bootstrap"],
    ["GET", "/api/desktop/requests"],
    ["POST", "/api/desktop/upload-session"],
    ["POST", "/api/desktop/requests/finalize"],
    ["POST", "/api/email/new-customer"],
    ["POST", "/api/email/new-order"],
    ["POST", "/api/email/bank-transfer"],
    ["POST", "/api/stripe/widget-customer-portal"],
    ["GET", `/api/requests/${testId}`],
    ["GET", `/api/requests/${testId}/messages`],
    ["POST", `/api/requests/${testId}/messages`],
    ["POST", `/api/requests/${testId}/deliveries`],
    ["POST", `/api/requests/${testId}/revision`],
    ["POST", `/api/requests/${testId}/additional-file/prepare`],
    ["POST", `/api/requests/${testId}/additional-file/finalize`],
    ["GET", `/api/file-expert/jobs/${testId}`],
  ];
  for (const [method, path] of checks) {
    const response = await request(path, method, method === "GET" ? null : {});
    expectStatus(response, [401, 403], `${method} ${path}`);
  }
  return checks.length;
}

async function verifySecurityHeaders() {
  const baseline = await request("/");
  expectStatus(baseline, [200], "GET /");
  for (const [name, value] of [
    ["x-content-type-options", "nosniff"],
    ["x-permitted-cross-domain-policies", "none"],
    ["referrer-policy", "strict-origin"],
  ]) {
    if (baseline.headers.get(name) !== value) throw new Error(`GET / missing ${name}: ${value}`);
  }

  const privatePaths = [
    "/admin",
    "/dashboard",
    "/new-request",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/auth/callback",
  ];
  for (const path of privatePaths) {
    const response = await request(path);
    expectStatus(response, [200], `GET ${path}`);
    if (response.headers.get("x-frame-options") !== "DENY") throw new Error(`${path} is frameable.`);
    if (!response.headers.get("content-security-policy")?.includes("frame-ancestors 'none'")) {
      throw new Error(`${path} is missing CSP frame protection.`);
    }
    if (!response.headers.get("cache-control")?.includes("no-store")) throw new Error(`${path} can be cached.`);
    if (!response.headers.get("x-robots-tag")?.includes("noindex")) throw new Error(`${path} can be indexed.`);
  }

  const widget = await request("/widget");
  expectStatus(widget, [200], "GET /widget");
  if (widget.headers.get("x-frame-options") === "DENY") throw new Error("Widget embedding was blocked.");
  return privatePaths.length;
}

async function verifyPublicSafeEndpoints() {
  const appCheck = await request("/api/desktop/app-check?app_version=0.1.0&platform=win32&installation_id=security-smoke");
  expectStatus(appCheck, [200], "GET /api/desktop/app-check");
  const appPayload = JSON.stringify(await appCheck.json());
  if (/service.role|secret|credential|private.key|password/i.test(appPayload)) {
    throw new Error("Desktop app-check exposed a forbidden field.");
  }

  const vehicles = await request("/api/vehicles?type=brands");
  expectStatus(vehicles, [200], "GET /api/vehicles?type=brands");

  const unknownField = await request("/api/observability/client-event", "POST", {
    kind: "client_error",
    route: "/dashboard/orders/private-id",
    category: "render",
    email: "forbidden@example.com",
  });
  expectStatus(unknownField, [400], "observability unknown-field rejection");

  const oversized = await request(
    "/api/observability/client-event",
    "POST",
    JSON.stringify({ kind: "client_error", route: "/", category: "render", padding: "x".repeat(2200) })
  );
  expectStatus(oversized, [413], "observability oversized-body rejection");
  return 4;
}

async function main() {
  const adminMethods = await verifyAdminApiIsolation();
  const customerRoutes = await verifyCustomerApiIsolation();
  const privatePages = await verifySecurityHeaders();
  const publicChecks = await verifyPublicSafeEndpoints();
  console.log(`MG AutoTech local security smoke OK (${baseUrl.origin})`);
  console.log(`- admin API methods denied anonymously: ${adminMethods}`);
  console.log(`- customer API routes denied anonymously: ${customerRoutes}`);
  console.log(`- protected pages with security headers: ${privatePages}`);
  console.log(`- public-safe endpoint checks: ${publicChecks}`);
}

main().catch((error) => {
  console.error(`MG AutoTech local security smoke FAILED: ${error.message}`);
  process.exit(1);
});
