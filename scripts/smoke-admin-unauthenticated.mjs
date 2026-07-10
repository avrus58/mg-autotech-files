const baseUrl = process.env.BASE_URL || "http://localhost:3000";

const adminRoutes = [
  "/api/admin/vehicles",
  "/api/admin/requests",
  "/api/admin/ai-training/clusters",
  "/api/admin/ai-training/clusters/rebuild",
];

async function main() {
  const results = [];
  for (const path of adminRoutes) {
    const response = await fetch(new URL(path, baseUrl), { cache: "no-store" });
    if (![401, 403, 405].includes(response.status)) {
      throw new Error(`${path} should reject anonymous access, got ${response.status}`);
    }
    results.push(`${path}: ${response.status}`);
  }

  console.log(`MG AutoTech unauthenticated admin smoke OK (${baseUrl})`);
  for (const result of results) console.log(`- ${result}`);
}

main().catch((error) => {
  console.error(`MG AutoTech unauthenticated admin smoke FAILED: ${error.message}`);
  process.exit(1);
});
