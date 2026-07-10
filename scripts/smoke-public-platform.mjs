const baseUrl = process.env.BASE_URL || "http://localhost:3000";

const forbiddenFragments = [
  "admin_notes",
  "source_reference",
  "confidence_score",
  "audit",
  "import_batch",
  "storage_path",
  "file_path",
  "ori_file_path",
  "mod_file_path",
  "hex_preview",
  "raw_hex",
  "private_offsets",
];

async function request(path) {
  const response = await fetch(new URL(path, baseUrl), { cache: "no-store" });
  const text = await response.text();
  return { response, text };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const checks = [];

  for (const path of ["/", "/new-request"]) {
    const { response } = await request(path);
    assert(response.status >= 200 && response.status < 500, `${path} returned ${response.status}`);
    checks.push(`${path}: ${response.status}`);
  }

  const vehicles = await request("/api/vehicles?type=brands");
  assert(vehicles.response.ok, `/api/vehicles?type=brands returned ${vehicles.response.status}`);
  const lowered = vehicles.text.toLowerCase();
  for (const fragment of forbiddenFragments) {
    assert(!lowered.includes(fragment), `public vehicle API leaked ${fragment}`);
  }
  const parsed = JSON.parse(vehicles.text);
  const brands = Array.isArray(parsed) ? parsed : parsed.brands;
  assert(Array.isArray(brands), "vehicle API did not return a brand array");
  checks.push(
    `/api/vehicles?type=brands: ${brands.length} brands, source ${vehicles.response.headers.get("x-vehicle-source") || "unknown"}`
  );

  console.log(`MG AutoTech public smoke OK (${baseUrl})`);
  for (const check of checks) console.log(`- ${check}`);
}

main().catch((error) => {
  console.error(`MG AutoTech public smoke FAILED: ${error.message}`);
  process.exit(1);
});
