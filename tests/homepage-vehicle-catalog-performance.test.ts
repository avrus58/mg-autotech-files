import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import rawVehicles from "../data/vehicle-database.json";
import { getInitialVehicleBrands } from "../src/lib/vehicleControl/clientCatalog";
import {
  checkPublicVehicleAccess,
  parsePublicVehicleQuery,
  publicVehicleAccessPolicy,
  type PublicVehicleQuery,
} from "../src/lib/vehicleControl/publicAccess";
import { publicVehicleBrandSeed } from "../src/lib/vehicleControl/publicVehicleBrandSeed";
import type { RawVehicleRow } from "../src/lib/vehicleControl/types";
import { normalizeBrandName } from "../src/lib/vehicleNormalization";

const root = process.cwd();
const vercelNetworkEnvironment = { VERCEL: "1" } as const;

function source(...parts: string[]) {
  return fs.readFileSync(path.join(root, ...parts), "utf8");
}

function expectedFallbackBrands() {
  const brands = new Map<string, string>();
  for (const row of rawVehicles as RawVehicleRow[]) {
    const normalized = normalizeBrandName(row.brand);
    if (normalized.normalizedKey && !brands.has(normalized.normalizedKey)) {
      brands.set(normalized.normalizedKey, normalized.canonicalName);
    }
  }
  return [...brands]
    .map(([id, name]) => ({ id, name }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function parsedQuery(url: string): PublicVehicleQuery {
  const parsed = parsePublicVehicleQuery(url);
  assert.equal(parsed.ok, true, `Expected a valid vehicle query: ${url}`);
  if (!parsed.ok) throw new Error("Vehicle query fixture was invalid.");
  return parsed.query;
}

function requestFrom(ip: string) {
  return new Request("https://file.mgautotech.de/api/vehicles", {
    headers: { "x-vercel-forwarded-for": ip },
  });
}

test("homepage brand bootstrap exactly matches the canonical customer-safe JSON fallback", () => {
  const expected = expectedFallbackBrands();
  assert.equal(publicVehicleBrandSeed.length, 102);
  assert.deepEqual(publicVehicleBrandSeed, expected);
  assert.deepEqual(getInitialVehicleBrands(), expected);
  assert.notEqual(getInitialVehicleBrands(), publicVehicleBrandSeed);
});

test("vehicle API accepts only the exact progressive selector query contract", () => {
  for (const url of [
    "/api/vehicles?type=brands",
    "/api/vehicles?type=models&brandId=mercedes-benz",
    "/api/vehicles?type=generations&brandId=mercedes-benz&modelId=e",
    "/api/vehicles?type=engines&brandId=mercedes-benz&modelId=e&generationId=w214-s214",
    "/api/vehicles?type=vehicle&brandId=mercedes-benz&modelId=e&generationId=w214-s214&engineId=engine-1",
  ]) {
    assert.equal(parsePublicVehicleQuery(url).ok, true, url);
  }

  for (const url of [
    "/api/vehicles?type=catalog-index",
    "/api/vehicles?type=models",
    "/api/vehicles?type=models&brandId=mercedes-benz&cacheBust=1",
    "/api/vehicles?type=models&type=models&brandId=mercedes-benz",
    "/api/vehicles?type=engines&brandId=../private&modelId=e&generationId=w214",
    "/api/vehicles?type=vehicle&brandId=mercedes-benz&modelId=e&generationId=w214",
  ]) {
    assert.equal(parsePublicVehicleQuery(url).ok, false, url);
  }
});

test("normal browsing stays comfortably below transparent catalog protection", async () => {
  const request = requestFrom("198.51.100.21");
  assert.equal(publicVehicleAccessPolicy.hierarchyRequests >= 100, true);

  for (let index = 0; index < 12; index += 1) {
    const model = `model-${index}`;
    const generation = `generation-${index}`;
    const engine = `engine-${index}`;
    const queries = [
      parsedQuery("/api/vehicles?type=models&brandId=bmw"),
      parsedQuery(`/api/vehicles?type=generations&brandId=bmw&modelId=${model}`),
      parsedQuery(`/api/vehicles?type=engines&brandId=bmw&modelId=${model}&generationId=${generation}`),
      parsedQuery(`/api/vehicles?type=vehicle&brandId=bmw&modelId=${model}&generationId=${generation}&engineId=${engine}`),
    ];
    for (const query of queries) {
      assert.equal(
        (
          await checkPublicVehicleAccess(
            request,
            query,
            vercelNetworkEnvironment
          )
        ).allowed,
        true
      );
    }
  }
});

test("rapid enumeration of many distinct brands is stopped without blocking repeated normal choices", async () => {
  const request = requestFrom("198.51.100.22");
  const limit = publicVehicleAccessPolicy.distinctRoutes.models;

  for (let index = 0; index < limit; index += 1) {
    const query = parsedQuery(`/api/vehicles?type=models&brandId=brand-${index}`);
    assert.equal(
      (
        await checkPublicVehicleAccess(
          request,
          query,
          vercelNetworkEnvironment
        )
      ).allowed,
      true
    );
    assert.equal(
      (
        await checkPublicVehicleAccess(
          request,
          query,
          vercelNetworkEnvironment
        )
      ).allowed,
      true
    );
  }

  const blocked = await checkPublicVehicleAccess(
    request,
    parsedQuery(`/api/vehicles?type=models&brandId=brand-${limit}`),
    vercelNetworkEnvironment
  );
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds > 0, true);
});

test("homepage renders brands immediately but loads deeper levels only after user selection", () => {
  const homepage = source("src", "components", "homepage", "VehicleIntelligence.tsx");
  const clientCatalog = source("src", "lib", "vehicleControl", "clientCatalog.ts");
  const route = source("src", "app", "api", "vehicles", "route.ts");

  assert.match(homepage, /useState<VehicleOption\[]>\(getInitialVehicleBrands\)/);
  assert.match(homepage, /fetchVehicleOptions\("\/api\/vehicles\?type=brands"/);
  assert.match(homepage, /type=models&brandId=/);
  assert.match(clientCatalog, /sessionStorage/);
  assert.match(clientCatalog, /memoryCache/);
  assert.doesNotMatch(clientCatalog, /catalogIndex|catalog-index/);
  assert.doesNotMatch(route, /catalog-index|projectPublicVehicleCatalogIndex|payload\.rows/);
  assert.match(route, /parsePublicVehicleQuery/);
  assert.match(route, /checkPublicVehicleAccess/);
  assert.match(route, /status: 429/);
});

test("existing cache, DB, JSON fallback and canonical Mercedes behavior remain intact", () => {
  const publicLoader = source("src", "lib", "vehicleControl", "public.ts");
  const normalization = source("src", "lib", "vehicleNormalization.ts");
  const route = source("src", "app", "api", "vehicles", "route.ts");

  assert.match(publicLoader, /publicRowsFromJson/);
  assert.match(publicLoader, /publicCatalogPayloadFromDatabaseCache/);
  assert.match(normalization, /canonicalName: "E"/);
  assert.match(normalization, /"e-class"/);
  assert.match(route, /stale-while-revalidate=60/);
  assert.match(route, /x-vehicle-source/);
});
