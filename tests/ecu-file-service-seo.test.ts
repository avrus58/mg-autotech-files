import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { metadata as fileServiceMetadata } from "../src/app/file-service/page";
import { generateMetadata as generateBrandMetadata } from "../src/app/brands/[slug]/page";
import { generateMetadata as generateServiceMetadata } from "../src/app/services/[slug]/page";
import { getBrandGuide } from "../src/lib/industry-content";
import { serviceIntentGuides } from "../src/lib/serviceIntentGuides";
import { stageTuningComparisons } from "../src/lib/stageTuning";

function projectFile(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

function metadataDescription(value: unknown) {
  if (typeof value !== "string") throw new TypeError("Expected a string metadata description");
  return value as string;
}

test("the existing file-service URL remains the single canonical general ECU file-service hub", () => {
  assert.equal(fileServiceMetadata.alternates?.canonical, "https://file.mgautotech.de/file-service");
  assert.match(String(fileServiceMetadata.title), /ECU File Service/i);
  const description = metadataDescription(fileServiceMetadata.description);
  assert.ok(description.length >= 120 && description.length <= 170);

  const source = projectFile("src", "app", "file-service", "page.tsx");
  assert.match(source, /Professional ECU file service for custom tuning files/);
  assert.match(source, /For workshops &amp; professional tuners/);
  assert.match(source, /Built for workshops and professional tuners/);
  assert.match(source, /href="\/new-request"[\s\S]*Create account &amp; start request/);
  assert.match(source, /href="#request-route"[\s\S]*Choose service first/);
  assert.match(source, /<StageComparison/);
  assert.match(source, /"@type": "FAQPage"/);
  assert.match(source, /"@type": "BreadcrumbList"/);
  assert.doesNotMatch(source, /\/ecu-file-service/);
});

test("Stage 1, Stage 2 and Stage 3 use distinct exact-intent canonical pages", async () => {
  assert.deepEqual(
    stageTuningComparisons.map((stage) => stage.slug),
    ["stage-1", "stage-2", "stage-3"]
  );
  assert.equal(new Set(stageTuningComparisons.map((stage) => stage.href)).size, 3);

  for (const stage of stageTuningComparisons) {
    const metadata = await generateServiceMetadata({ params: Promise.resolve({ slug: stage.slug }) });
    assert.equal(
      metadata.alternates?.canonical,
      `https://file.mgautotech.de/services/${stage.slug}`
    );
    assert.match(String(metadata.title), new RegExp(stage.shortName, "i"));
    const description = metadataDescription(metadata.description);
    assert.ok(description.length >= 110 && description.length <= 180);
  }

  const serialized = JSON.stringify(stageTuningComparisons).toLowerCase();
  assert.match(projectFile("src", "components", "StageComparison.tsx"), /No stage promises a universal result/);
  assert.equal(serialized.includes("guaranteed"), false);
  assert.equal(serialized.includes("horsepower"), false);
});

test("Stage 3 is substantial, review-led and discoverable without a duplicate locale page", () => {
  const stage3 = serviceIntentGuides.find((guide) => guide.slug === "stage-3");
  assert.ok(stage3);
  assert.match(stage3.lead, /not one universal software package/i);
  assert.ok(stage3.requiredInputs.length >= 6);
  assert.ok(stage3.faq.length >= 5);
  assert.ok(stage3.related.some((item) => item.href === "/services/stage-1"));
  assert.ok(stage3.related.some((item) => item.href === "/services/stage-2"));

  const sitemap = projectFile("src", "app", "sitemap.ts");
  assert.match(sitemap, /serviceIntentGuides\.map/);
  assert.doesNotMatch(sitemap, /localizedUrl\(locale, `\/services\/\$\{guide\.slug\}`\)/);
});

test("Audi search intent is served by the existing canonical brand guide", async () => {
  const audi = getBrandGuide("audi");
  assert.ok(audi);
  assert.match(audi.name, /Audi ECU Software/);
  assert.match(audi.description, /Audi ECU software/i);
  assert.ok(audi.faq.length >= 5);
  assert.ok(audi.requestChecks.some((item) => /HW\/SW/.test(item)));

  const metadata = await generateBrandMetadata({ params: Promise.resolve({ slug: "audi" }) });
  assert.equal(metadata.alternates?.canonical, "https://file.mgautotech.de/brands/audi");
  assert.doesNotMatch(JSON.stringify(metadata), /audi-ecu-software/);
});

test("DPF, EGR and AdBlue pages show legal context while DTC requires diagnosis", () => {
  const source = projectFile("src", "app", "services", "[slug]", "page.tsx");
  assert.match(source, /Legal use depends on the vehicle and jurisdiction/);
  assert.match(source, /Confirm lawful use before submission/);
  assert.match(source, /SCR and AdBlue requirements vary by jurisdiction/);
  assert.match(source, /restricted or prohibited[\s\S]*public-road/);
  assert.match(source, /Diagnose the underlying fault first/);
  assert.match(source, /does not repair a mechanical, electrical or emissions-system fault/);
  assert.match(source, /service\.notice/);
});

test("customer-facing SEO pages expose only public navigation and no private metadata", () => {
  const files = [
    projectFile("src", "app", "file-service", "page.tsx"),
    projectFile("src", "components", "ServiceIntentPage.tsx"),
    projectFile("src", "components", "StageComparison.tsx"),
    projectFile("src", "lib", "serviceIntentGuides.ts"),
  ].join("\n").toLowerCase();

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

test("homepage adds compact Stage discovery without duplicating the service hub", () => {
  const homepage = projectFile("src", "app", "page.tsx");
  for (const route of ["/services/stage-1", "/services/stage-2", "/services/stage-3"]) {
    assert.match(homepage, new RegExp(route));
  }
  assert.match(homepage, /\/file-service#stage-comparison/);
  assert.equal((homepage.match(/id="services"/g) ?? []).length, 1);
  assert.doesNotMatch(homepage, /StageComparison/);
});
