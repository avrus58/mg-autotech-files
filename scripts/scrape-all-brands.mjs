import { spawn } from "node:child_process";
import fs from "node:fs/promises";

const BRANDS_FILE = "data/carecufile-brands.json";
const PROGRESS_FILE = "data/scrape-all-progress.json";

const WAIT_BETWEEN_BRANDS_MS = 15000;

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

function runBrandScraper(brand) {
  return new Promise((resolve) => {
    console.log("\n========================================");
    console.log(`Starting brand: ${brand.name} (${brand.id})`);
    console.log("========================================\n");

    const child = spawn(
      "node",
      [
        "scripts/carecufile-scraper.mjs",
        "--brand-id",
        String(brand.id),
        "--brand-name",
        String(brand.name),
        "--append",
      ],
      {
        stdio: "inherit",
        shell: true,
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

  if (!Array.isArray(brands) || brands.length === 0) {
    console.error(`No brands found in ${BRANDS_FILE}`);
    process.exit(1);
  }

  console.log(`Brands found: ${brands.length}`);
  console.log(`Already completed: ${progress.completed.length}`);
  console.log(`Already failed: ${progress.failed.length}`);

  for (const brand of brands) {
    const brandKey = `${brand.id}:${brand.name}`;

    if (progress.completed.includes(brandKey)) {
      console.log(`Skipping completed brand: ${brand.name}`);
      continue;
    }

    const code = await runBrandScraper(brand);

    if (code === 0) {
      console.log(`Completed brand: ${brand.name}`);
      progress.completed.push(brandKey);
      progress.failed = progress.failed.filter((x) => x !== brandKey);
    } else {
      console.log(`Failed brand: ${brand.name} | exit code: ${code}`);
      if (!progress.failed.includes(brandKey)) {
        progress.failed.push(brandKey);
      }
    }

    await saveJson(PROGRESS_FILE, progress);

    console.log(`Waiting ${WAIT_BETWEEN_BRANDS_MS / 1000}s before next brand...`);
    await sleep(WAIT_BETWEEN_BRANDS_MS);
  }

  console.log("\nAll brands processed.");
  console.log(`Completed: ${progress.completed.length}`);
  console.log(`Failed: ${progress.failed.length}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});