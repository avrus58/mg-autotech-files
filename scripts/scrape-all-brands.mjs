import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import {
  CAREECU_NETWORK_OVERRIDE_FLAG,
  requireCareEcuNetworkPermission,
} from "./carecufile-network-guard.mjs";

const BRANDS_FILE = "data/carecufile-brands.json";
const PROGRESS_FILE = "data/scrape-all-progress.json";
const DATABASE_FILE = "data/vehicle-database.json";

const WAIT_BETWEEN_BRANDS_MS = Number(process.env.CAREECU_BRAND_DELAY_MS || 15000);
const WAIT_BETWEEN_ENGINES_MS = Number(process.env.CAREECU_REQUEST_DELAY_MS || 350);
const rawArgs = process.argv.slice(2);
const childNetworkArgs = rawArgs.includes(CAREECU_NETWORK_OVERRIDE_FLAG)
  ? [CAREECU_NETWORK_OVERRIDE_FLAG]
  : [];

try {
  requireCareEcuNetworkPermission({
    argv: rawArgs,
    scriptName: "scrape-all-brands",
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fileExists(path) {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

async function loadJson(path, fallback) {
  if (!(await fileExists(path))) return fallback;
  const raw = await fs.readFile(path, "utf8");
  if (!raw.trim()) return fallback;
  return JSON.parse(raw);
}

async function saveJson(path, data) {
  await fs.writeFile(path, JSON.stringify(data, null, 2), "utf8");
}

function getBrandRowCounts(rows) {
  const counts = new Map();

  for (const row of rows) {
    const brandId = String(row.brandId || "");
    if (!brandId) continue;
    counts.set(brandId, (counts.get(brandId) || 0) + 1);
  }

  return counts;
}

function runBrandScraper(brand) {
  return new Promise((resolve) => {
    console.log("\n========================================");
    console.log(`Starting brand: ${brand.name} (${brand.id})`);
    console.log("========================================\n");

    const child = spawn(
      process.execPath,
      [
        "scripts/carecufile-scraper.mjs",
        ...childNetworkArgs,
        "--brand-id",
        String(brand.id),
        "--brand-name",
        String(brand.name),
        "--append",
        "--delay",
        String(WAIT_BETWEEN_ENGINES_MS),
      ],
      {
        stdio: "inherit",
      }
    );

    child.on("close", (code) => {
      resolve(code);
    });
  });
}

async function main() {
  const brands = await loadJson(BRANDS_FILE, []);
  const progress = await loadJson(PROGRESS_FILE, {
    completed: [],
    failed: [],
  });
  const database = await loadJson(DATABASE_FILE, []);
  let brandRowCounts = getBrandRowCounts(database);

  if (!Array.isArray(brands) || brands.length === 0) {
    console.error(`No brands found in ${BRANDS_FILE}`);
    process.exit(1);
  }

  console.log(`Brands found: ${brands.length}`);
  progress.completed = brands
    .filter((brand) => (brandRowCounts.get(String(brand.id)) || 0) > 0)
    .map((brand) => `${brand.id}:${brand.name}`);
  progress.failed = progress.failed.filter((brandKey) => {
    const brandId = String(brandKey).split(":", 1)[0];
    return (brandRowCounts.get(brandId) || 0) === 0;
  });

  console.log(`Brands already present in database: ${brandRowCounts.size}`);
  console.log(`Already failed: ${progress.failed.length}`);

  for (const brand of brands) {
    const brandKey = `${brand.id}:${brand.name}`;

    const existingRows = brandRowCounts.get(String(brand.id)) || 0;

    if (existingRows > 0) {
      console.log(`Skipping existing brand: ${brand.name} (${existingRows} vehicles)`);
      continue;
    }

    const code = await runBrandScraper(brand);
    const updatedDatabase = await loadJson(DATABASE_FILE, []);
    brandRowCounts = getBrandRowCounts(updatedDatabase);
    const scrapedRows = brandRowCounts.get(String(brand.id)) || 0;

    if (code === 0 && scrapedRows > 0) {
      console.log(`Completed brand: ${brand.name} (${scrapedRows} vehicles)`);
      if (!progress.completed.includes(brandKey)) {
        progress.completed.push(brandKey);
      }
      progress.failed = progress.failed.filter((x) => x !== brandKey);
    } else {
      console.log(
        `Failed brand: ${brand.name} | exit code: ${code} | vehicles added: ${scrapedRows}`
      );
      progress.completed = progress.completed.filter((x) => x !== brandKey);
      if (!progress.failed.includes(brandKey)) {
        progress.failed.push(brandKey);
      }
    }

    await saveJson(PROGRESS_FILE, progress);

    console.log(`Waiting ${WAIT_BETWEEN_BRANDS_MS / 1000}s before next brand...`);
    await sleep(WAIT_BETWEEN_BRANDS_MS);
  }

  const finalDatabase = await loadJson(DATABASE_FILE, []);
  const finalBrandRowCounts = getBrandRowCounts(finalDatabase);

  progress.completed = brands
    .filter((brand) => (finalBrandRowCounts.get(String(brand.id)) || 0) > 0)
    .map((brand) => `${brand.id}:${brand.name}`);
  progress.failed = brands
    .filter((brand) => (finalBrandRowCounts.get(String(brand.id)) || 0) === 0)
    .map((brand) => `${brand.id}:${brand.name}`);

  await saveJson(PROGRESS_FILE, progress);

  console.log("\nAll brands processed.");
  console.log(`Completed: ${progress.completed.length}`);
  console.log(`Failed: ${progress.failed.length}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
