import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { generateMetadata } from "../src/app/services/[slug]/page";
import {
  stage1BrandRoutes,
  stage1PlatformRoutes,
} from "../src/components/Stage1Authority";

function projectFile(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

test("Stage 1 uses one exact-intent canonical page with useful search metadata", async () => {
  const metadata = await generateMetadata({ params: Promise.resolve({ slug: "stage-1" }) });
  const description = String(metadata.description);

  assert.equal(
    metadata.alternates?.canonical,
    "https://file.mgautotech.de/services/stage-1"
  );
  assert.equal(metadata.title, "Stage 1 Tuning File Service for Workshops");
  assert.match(description, /Online Stage 1 ECU tuning file service for workshops/);
  assert.ok(description.length >= 120 && description.length <= 170);
});

test("Stage 1 answers fit, file and evidence questions without generic power promises", () => {
  const page = projectFile("src", "app", "services", "[slug]", "page.tsx");
  const authority = projectFile("src", "components", "Stage1Authority.tsx");
  const combined = `${page}\n${authority}`;

  assert.match(page, /What is a Stage 1 tuning file service\?/);
  assert.match(page, /What file do I need for a Stage 1 request\?/);
  assert.match(page, /Is a Stage 1 tuning file generic\?/);
  assert.match(page, /Do I need logs for a Stage 1 file request\?/);
  assert.match(authority, /Turbo petrol/);
  assert.match(authority, /Turbo diesel/);
  assert.match(authority, /Naturally aspirated/);
  assert.match(authority, /Modified hardware/);
  assert.match(authority, /href="\/new-request"/);
  assert.doesNotMatch(combined, /guaranteed (?:power|horsepower|gain)/i);
});

test("Stage 1 exposes crawlable brand and ECU guide routes with no duplicate links", () => {
  assert.equal(stage1BrandRoutes.length, 8);
  assert.equal(stage1PlatformRoutes.length, 7);

  const routes = [...stage1BrandRoutes, ...stage1PlatformRoutes];
  assert.equal(new Set(routes.map((route) => route.href)).size, routes.length);
  assert.ok(routes.some((route) => route.href === "/brands/mercedes-benz"));
  assert.ok(routes.some((route) => route.href === "/brands/volkswagen"));
  assert.ok(routes.some((route) => route.href === "/ecu-platforms/bosch-edc17"));
  assert.ok(routes.some((route) => route.href === "/ecu-platforms/bosch-mg1"));
  assert.ok(routes.some((route) => route.href === "/ecu-platforms/continental-simos"));

  const authority = projectFile("src", "components", "Stage1Authority.tsx");
  assert.match(authority, /<Link/);
  assert.match(authority, /href={route\.href}/);
});

test("ECU platform guides link back to Stage 1 and the homepage stays compact", () => {
  const platformGuide = projectFile("src", "app", "ecu-platforms", "[slug]", "page.tsx");
  const homepage = projectFile("src", "components", "homepage", "HomepageExperience.tsx");

  assert.match(platformGuide, /Stage 1 ECU tuning file service/);
  assert.match(platformGuide, /href: "\/services\/stage-1"/);
  assert.doesNotMatch(homepage, /Stage1Authority/);
});

test("Stage 1 public content and schema do not expose private platform metadata", () => {
  const servicePage = projectFile("src", "app", "services", "[slug]", "page.tsx");
  const structuredDataI18n = projectFile("src", "lib", "structuredDataI18n.ts");
  const files = [
    servicePage,
    projectFile("src", "components", "Stage1Authority.tsx"),
  ].join("\n").toLowerCase();

  assert.match(files, /"@type": "itemlist"/);
  assert.match(servicePage, /audienceType: businessAudienceTypeByLocale\[locale\]/);
  assert.match(structuredDataI18n, /Automotive workshops and tuning professionals/);

  for (const marker of [
    "admin_notes",
    "source_reference",
    "storage_path",
    "signed_url",
    "service_role",
    "confidence_score",
    "sample_id",
    "raw hex",
  ]) {
    assert.equal(files.includes(marker), false, marker);
  }
});
