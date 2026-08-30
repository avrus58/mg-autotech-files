import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { buildServicesMetadata } from "../src/lib/servicesPageMetadata";
import {
  buildFileServiceSearchOwnership,
  fileServiceSearchDestinations,
  fileServiceSearchIntentGroups,
  normalizeFileServiceSearchTerm,
} from "../src/lib/fileServiceSearchIntents";

function projectFile(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

test("file-service search architecture covers the major commercial intent families", () => {
  assert.deepEqual(
    fileServiceSearchIntentGroups.map((group) => group.id),
    [
      "online-file-service",
      "performance-calibration",
      "transmission-control",
      "diagnostic-aftertreatment",
      "file-verification",
      "vehicle-coverage",
      "controller-coverage",
    ]
  );
  assert.ok(fileServiceSearchDestinations.length >= 20);

  const ownership = buildFileServiceSearchOwnership();
  assert.ok(ownership.length >= 90);

  const routeFor = (term: string) =>
    ownership.find(
      (entry) => entry.normalizedTerm === normalizeFileServiceSearchTerm(term)
    )?.href;

  assert.equal(routeFor("ECU file service"), "/file-service");
  assert.equal(routeFor("Stage 1 tuning file service"), "/services/stage-1");
  assert.equal(routeFor("Stage 2 tuning file service"), "/services/stage-2");
  assert.equal(routeFor("TCU tuning file service"), "/services/tcu-tuning");
  assert.equal(routeFor("original ECU file check"), "/services/ecu-file-check");
  assert.equal(
    routeFor("OBD ECU read file"),
    "/workshop-guides/obd-bench-boot-read-methods"
  );
  assert.equal(
    routeFor("Bosch EDC17 tuning file service"),
    "/ecu-platforms/bosch-edc17"
  );
});

test("every normalized search phrase has exactly one canonical owner", () => {
  const ownership = buildFileServiceSearchOwnership();
  const normalized = ownership.map((entry) => entry.normalizedTerm);

  assert.equal(new Set(normalized).size, normalized.length);
  assert.equal(
    new Set(fileServiceSearchDestinations.map((destination) => destination.id)).size,
    fileServiceSearchDestinations.length
  );

  for (const entry of ownership) {
    assert.equal(entry.term, entry.term.trim());
    assert.ok(entry.normalizedTerm.split(" ").length >= 3, entry.term);
    assert.match(entry.href, /^\/(?:file-service|services|workshop-guides|tools|brands|ecu-platforms)(?:\/|$)/);
  }
});

test("search architecture stays factual, public-safe and free of doorway tactics", () => {
  const serialized = JSON.stringify(fileServiceSearchIntentGroups).toLowerCase();

  for (const marker of [
    "admin_notes",
    "source_reference",
    "storage_path",
    "signed_url",
    "service_role",
    "customer_id",
    "confidence_score",
    "sample_id",
    "raw binary",
    "hex preview",
  ]) {
    assert.equal(serialized.includes(marker), false, marker);
  }

  for (const claim of [
    "guaranteed ranking",
    "guaranteed power",
    "number one",
    "best file service",
    "free tuning file",
    "near me",
  ]) {
    assert.equal(serialized.includes(claim), false, claim);
  }

  assert.equal(fileServiceSearchDestinations.some((item) => item.href.includes("?")), false);
  assert.equal(fileServiceSearchDestinations.some((item) => item.href.includes("#")), false);
});

test("services page renders crawlable intent navigation and matching public schema", () => {
  const servicesMetadata = buildServicesMetadata("en");
  const page = projectFile("src", "app", "services", "page.tsx");
  const navigator = projectFile(
    "src",
    "components",
    "FileServiceSearchNavigator.tsx"
  );
  const homepage = projectFile("src", "components", "homepage", "HomepageExperience.tsx");

  assert.equal(
    servicesMetadata.alternates?.canonical,
    "https://file.mgautotech.de/services"
  );
  assert.match(String(servicesMetadata.title), /ECU & TCU File Service Catalog/);
  assert.ok(String(servicesMetadata.description).length >= 120);
  assert.ok(String(servicesMetadata.description).length <= 170);

  assert.match(page, /<FileServiceSearchNavigator locale=\{locale\} \/>/);
  assert.match(page, /fileServiceSearchDestinations\.map/);
  assert.match(page, /#file-service-search-intent-map/);
  assert.match(page, /ECU & TCU file services, organized for serious workshops/);
  assert.doesNotMatch(page, /keywords\s*:/);

  assert.doesNotMatch(navigator, /"use client"/);
  assert.match(navigator, /<details/);
  assert.match(navigator, /<summary/);
  assert.match(navigator, /<Link/);
  assert.match(navigator, /destination\.href/);
  assert.match(navigator, /destination\.searchTerms\.slice\(0, 3\)\.join/);
  assert.match(navigator, /Also described as/);

  assert.doesNotMatch(homepage, /FileServiceSearchNavigator/);
  assert.doesNotMatch(homepage, /fileServiceSearchIntents/);
});

test("operational SEO documentation records the route map and anti-spam boundary", () => {
  const documentation = projectFile(
    "docs",
    "organic-search-keyword-architecture.md"
  );

  assert.match(documentation, /No search-volume number is claimed/);
  assert.match(documentation, /Canonical route ownership/);
  assert.match(documentation, /Google people-first content/);
  assert.match(documentation, /No `meta keywords` tag/);
  assert.match(documentation, /No repeated city, country or "near me" doorway pages/);
  assert.match(documentation, /Search Console/);
  assert.match(documentation, /The homepage receives no additional long-form section/);
});
