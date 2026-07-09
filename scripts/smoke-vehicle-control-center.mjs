const baseUrl = (process.env.VEHICLE_SMOKE_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");

async function checkJson(path, predicate, description) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!predicate(response, json, text)) {
    throw new Error(`${description} failed: status ${response.status}, body ${text.slice(0, 180)}`);
  }
  console.log(`OK ${description}`);
  return { response, json, text };
}

async function checkPage(path, description) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
  if (![200, 301, 302, 307, 308].includes(response.status)) {
    throw new Error(`${description} failed: status ${response.status}`);
  }
  console.log(`OK ${description}`);
}

await checkJson(
  "/api/vehicles?type=brands",
  (response, json) => response.status === 200 && Array.isArray(json),
  "public vehicle brands endpoint returns an array"
);

await checkPage("/new-request", "new request page is reachable");

await checkJson(
  "/api/admin/vehicles",
  (response) => response.status === 401 || response.status === 403 || [301, 302, 307, 308].includes(response.status),
  "admin vehicles endpoint is closed without auth"
);

console.log(`Vehicle Control Center smoke checks passed for ${baseUrl}`);
