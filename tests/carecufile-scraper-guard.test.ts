import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

type CareEcuNetworkGuardModule = {
  CAREECU_NETWORK_OVERRIDE_ENV: string;
  CAREECU_NETWORK_OVERRIDE_FLAG: string;
  isCareEcuNetworkAllowed(options?: {
    argv?: string[];
    env?: Record<string, string | undefined>;
  }): boolean;
  requireCareEcuNetworkPermission(options?: {
    argv?: string[];
    env?: Record<string, string | undefined>;
    scriptName?: string;
  }): void;
};

function runNodeScript(args: string[]) {
  return spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      ALLOW_CAREECU_NETWORK: "",
      CAREECU_COOKIE: "",
    },
  });
}

test("CareEcuFile network guard requires explicit opt-in", async () => {
  const guard = (await import(
    pathToFileURL(resolve(process.cwd(), "scripts", "carecufile-network-guard.mjs")).href
  )) as CareEcuNetworkGuardModule;

  assert.equal(guard.CAREECU_NETWORK_OVERRIDE_ENV, "ALLOW_CAREECU_NETWORK");
  assert.equal(guard.CAREECU_NETWORK_OVERRIDE_FLAG, "--allow-network");
  assert.equal(guard.isCareEcuNetworkAllowed({ argv: [], env: {} }), false);
  assert.equal(guard.isCareEcuNetworkAllowed({ argv: ["--allow-network"], env: {} }), true);
  assert.equal(guard.isCareEcuNetworkAllowed({ argv: [], env: { ALLOW_CAREECU_NETWORK: "1" } }), true);

  assert.throws(
    () => guard.requireCareEcuNetworkPermission({ argv: [], env: {}, scriptName: "test scraper" }),
    /test scraper: refusing external CareEcuFile network access[\s\S]*--allow-network[\s\S]*ALLOW_CAREECU_NETWORK=1/
  );
});

test("CareEcuFile scraper exits before network without explicit opt-in", () => {
  const result = runNodeScript(["scripts/carecufile-scraper.mjs", "--brands-only"]);
  const output = `${result.stdout}\n${result.stderr}`;

  assert.notEqual(result.status, 0);
  assert.match(output, /carecufile-scraper: refusing external CareEcuFile network access/);
  assert.doesNotMatch(output, /Saved:|Done\. New vehicles scraped|GET .* failed|POST .* failed/);
});

test("all-brand scraper exits before data loop without explicit opt-in", () => {
  const result = runNodeScript(["scripts/scrape-all-brands.mjs"]);
  const output = `${result.stdout}\n${result.stderr}`;

  assert.notEqual(result.status, 0);
  assert.match(output, /scrape-all-brands: refusing external CareEcuFile network access/);
  assert.doesNotMatch(output, /Brands found:|Starting brand:/);
});

test("CareEcuFile scraper docs and child process keep explicit network opt-in visible", () => {
  const readme = readFileSync(resolve(process.cwd(), "scripts", "README-carecufile-scraper.md"), "utf8");
  const scraper = readFileSync(resolve(process.cwd(), "scripts", "carecufile-scraper.mjs"), "utf8");
  const allBrands = readFileSync(resolve(process.cwd(), "scripts", "scrape-all-brands.mjs"), "utf8");

  assert.match(readme, /--allow-network/);
  assert.match(readme, /ALLOW_CAREECU_NETWORK/);
  assert.match(scraper, /requireCareEcuNetworkPermission/);
  assert.match(allBrands, /requireCareEcuNetworkPermission/);
  assert.match(allBrands, /childNetworkArgs/);
});
