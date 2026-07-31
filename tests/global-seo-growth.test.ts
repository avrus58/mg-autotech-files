import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { GET as getFeed } from "../src/app/feed.xml/route";
import { GET as getLlms } from "../src/app/llms.txt/route";
import {
  getServiceIntentGuide,
  serviceIntentGuides,
} from "../src/lib/serviceIntentGuides";

function projectFile(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

function guideWordCount(index: number) {
  const guide = serviceIntentGuides[index];
  assert.ok(guide);
  return [
    guide.metaTitle,
    guide.description,
    guide.heroTitle,
    guide.lead,
    ...guide.fitSignals,
    ...guide.requiredInputs,
    ...guide.reviewChecks.flatMap((item) => [item.title, item.text]),
    ...guide.workflow.flatMap((item) => [item.title, item.text]),
    ...guide.faq.flatMap((item) => [item.q, item.a]),
  ]
    .join(" ")
    .trim()
    .split(/\s+/)
    .length;
}

test("global service-intent library exposes three distinct substantial guides", () => {
  assert.deepEqual(
    serviceIntentGuides.map((guide) => guide.slug),
    ["stage-2", "tcu-tuning", "ecu-file-check"]
  );
  assert.equal(new Set(serviceIntentGuides.map((guide) => guide.metaTitle)).size, 3);
  assert.equal(new Set(serviceIntentGuides.map((guide) => guide.description)).size, 3);

  for (const [index, guide] of serviceIntentGuides.entries()) {
    assert.match(guide.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(guide.description.length >= 120 && guide.description.length <= 180);
    assert.ok(guide.fitSignals.length >= 4);
    assert.ok(guide.requiredInputs.length >= 6);
    assert.equal(guide.reviewChecks.length, 3);
    assert.equal(guide.workflow.length, 4);
    assert.ok(guide.faq.length >= 4);
    assert.ok(guide.related.length >= 5);
    assert.ok(guideWordCount(index) >= 250);
    assert.equal(getServiceIntentGuide(guide.slug), guide);
  }
});

test("service-intent routes publish canonical metadata and matching visible schema", () => {
  const route = projectFile("src", "app", "services", "[slug]", "page.tsx");
  const page = projectFile("src", "components", "ServiceIntentPage.tsx");

  assert.match(route, /serviceIntentGuideSlugs\.map/);
  assert.match(route, /absoluteUrl\(`\/services\/\$\{intentGuide\.slug\}`\)/);
  assert.match(route, /ServiceIntentPage guide=\{intentGuide\}/);
  assert.doesNotMatch(route, /languageAlternates\(`\/services\/\$\{intentGuide\.slug\}`\)/);
  assert.match(page, /"@type": "WebPage"/);
  assert.match(page, /"@type": "Service"/);
  assert.match(page, /"@type": "BreadcrumbList"/);
  assert.match(page, /"@type": "ItemList"/);
  assert.match(page, /guide\.faq\.map/);
  assert.doesNotMatch(page, /"@type": "FAQPage"/);
  assert.doesNotMatch(page, /"@type": "HowTo"/);
});

test("service catalog and public discovery surfaces link to every new guide", () => {
  const catalog = projectFile("src", "app", "services", "page.tsx");
  const fileService = projectFile("src", "app", "file-service", "page.tsx");
  const guides = projectFile("src", "app", "workshop-guides", "page.tsx");
  const footer = projectFile("src", "components", "Footer.tsx");
  const homepage = projectFile("src", "app", "page.tsx");

  assert.match(catalog, /serviceIntentGuides\.map/);
  for (const slug of ["stage-2", "tcu-tuning", "ecu-file-check"]) {
    assert.match(`${fileService}\n${guides}\n${footer}`, new RegExp(`/services/${slug}`));
  }
  assert.match(homepage, /href: "\/services\/tcu-tuning"/);
  assert.doesNotMatch(homepage, /serviceIntentGuides\.map/);
});

test("sitemap, robots and root metadata expose safe discovery endpoints", () => {
  const sitemap = projectFile("src", "app", "sitemap.ts");
  const robots = projectFile("src", "app", "robots.ts");
  const layout = projectFile("src", "app", "layout.tsx");

  assert.match(sitemap, /serviceIntentGuides\.map/);
  assert.match(sitemap, /new Date\(guide\.updatedAt\)/);
  assert.doesNotMatch(sitemap, /localizedUrl\(locale, `\/services\/\$\{guide\.slug\}`\)/);
  assert.match(robots, /serviceIntentGuideSlugs\.map/);
  assert.match(robots, /"\/feed\.xml"/);
  assert.match(robots, /"\/llms\.txt"/);
  assert.match(layout, /"application\/rss\+xml": absoluteUrl\("\/feed\.xml"\)/);
});

test("primary service titles apply the MG AutoTech suffix exactly once", () => {
  const services = projectFile("src", "app", "services", "page.tsx");
  const fileService = projectFile("src", "app", "file-service", "page.tsx");
  const howItWorks = projectFile("src", "app", "how-it-works", "page.tsx");
  const localizedHowItWorks = projectFile("src", "app", "[locale]", "how-it-works", "page.tsx");

  assert.match(services, /export const metadata: Metadata = \{\s*title: pageTitle,/);
  assert.match(fileService, /export const metadata: Metadata = \{\s*title: pageTitle,/);
  assert.match(howItWorks, /title: \{ absolute: copy\.pageTitle \}/);
  assert.match(localizedHowItWorks, /title: \{ absolute: copy\.pageTitle \}/);
});

test("RSS feed publishes only public guide metadata", async () => {
  const response = await getFeed();
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^application\/rss\+xml/);
  assert.match(response.headers.get("cache-control") ?? "", /stale-while-revalidate/);
  assert.match(body, /<rss version="2\.0"/);
  for (const guide of serviceIntentGuides) {
    assert.match(body, new RegExp(`https://file\\.mgautotech\\.de/services/${guide.slug}`));
  }
  assert.doesNotMatch(body, /\/(?:admin|api|dashboard)\b/);
  assert.doesNotMatch(body, /(?:admin_notes|source_reference|storage_path|signed_url|confidence_score)/i);
});

test("llms discovery document contains only public routes and explicit privacy boundaries", async () => {
  const response = await getLlms();
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/plain/);
  assert.match(body, /# MG AutoTech File Service/);
  assert.match(body, /Public tools do not upload, inspect, modify, patch or generate/);
  for (const guide of serviceIntentGuides) {
    assert.match(body, new RegExp(`/services/${guide.slug}`));
  }
  assert.doesNotMatch(body, /\/(?:admin|api|dashboard)\b/);
  assert.doesNotMatch(body, /(?:service_role|admin_notes|source_reference|storage_path|signed_url|sample_id)/i);
});

test("new service copy remains review-first and contains no private implementation metadata", () => {
  const serialized = JSON.stringify(serviceIntentGuides).toLowerCase();
  for (const privateMarker of [
    "service_role",
    "signed_url",
    "storage_path",
    "admin_notes",
    "confidence_score",
    "sample_id",
    "source_reference",
    "raw binary",
    "hex preview",
  ]) {
    assert.equal(serialized.includes(privateMarker), false, privateMarker);
  }
  assert.equal(serialized.includes("guaranteed power"), false);
  assert.equal(serialized.includes("automatic approval"), false);
  assert.equal(serialized.includes("universal support"), false);
  assert.equal(serialized.includes("review-first"), true);
});
