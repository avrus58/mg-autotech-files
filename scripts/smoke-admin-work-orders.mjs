import { resolveSmokeBaseUrl } from "./smoke-url-guard.mjs";

const baseUrl = resolveSmokeBaseUrl({
  envVarName: "ADMIN_WORK_ORDER_SMOKE_BASE_URL",
  scriptName: "Admin Work Order smoke",
});

async function check(path, predicate, description) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
  const text = await response.text();
  if (!predicate(response, text)) {
    throw new Error(`${description} failed: status ${response.status}, body ${text.slice(0, 180)}`);
  }
  console.log(`OK ${description}`);
}

await check(
  "/api/admin/requests",
  (response) => response.status === 401 || response.status === 403 || [301, 302, 307, 308].includes(response.status),
  "admin work-order list API is closed without auth"
);

await check(
  "/admin/requests",
  (response) => [200, 301, 302, 307, 308].includes(response.status),
  "admin requests page is reachable"
);

await check(
  "/dashboard",
  (response) => [200, 301, 302, 307, 308].includes(response.status),
  "customer dashboard route is still reachable"
);

console.log(`Admin Work Order smoke checks passed for ${baseUrl}`);
