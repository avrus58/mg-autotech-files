import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  getWorkshopGuideArticle,
  workshopGuideArticles,
} from "../src/lib/workshopGuides";

function projectFile(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

function articleWordCount(index: number) {
  const article = workshopGuideArticles[index];
  assert.ok(article);
  return [
    article.title,
    article.description,
    ...article.intro,
    ...article.sections.flatMap((section) => [section.title, ...section.items]),
    ...article.faq.flatMap((item) => [item.q, item.a]),
  ]
    .join(" ")
    .trim()
    .split(/\s+/)
    .length;
}

test("workshop SEO library exposes five unique substantial search-intent guides", () => {
  assert.equal(workshopGuideArticles.length, 5);
  assert.equal(new Set(workshopGuideArticles.map((article) => article.slug)).size, 5);
  assert.equal(new Set(workshopGuideArticles.map((article) => article.title)).size, 5);
  assert.equal(new Set(workshopGuideArticles.map((article) => article.description)).size, 5);
  assert.equal(new Set(workshopGuideArticles.map((article) => article.intentLabel)).size, 5);

  for (const [index, article] of workshopGuideArticles.entries()) {
    assert.match(article.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(article.description.length >= 120 && article.description.length <= 180);
    assert.equal(article.intro.length, 2);
    assert.equal(article.sections.length, 3);
    assert.ok(article.sections.every((section) => section.items.length >= 5));
    assert.ok(article.faq.length >= 3);
    assert.ok(article.related.length >= 4);
    assert.ok(articleWordCount(index) >= 260);
    assert.equal(getWorkshopGuideArticle(article.slug), article);
  }
});

test("workshop guide links are crawlable internal routes with no private surfaces", () => {
  for (const article of workshopGuideArticles) {
    for (const link of article.related) {
      assert.match(link.href, /^\/[a-z0-9/#-]+$/);
      assert.doesNotMatch(link.href, /^\/(?:admin|api|dashboard)(?:\/|$)/);
      assert.ok(link.label.length >= 8);
    }
  }
});

test("workshop guide route publishes canonical article metadata and visible matching schema", () => {
  const route = projectFile("src", "app", "workshop-guides", "[slug]", "page.tsx");
  assert.match(route, /generateStaticParams/);
  assert.match(route, /getWorkshopGuideArticle/);
  assert.match(route, /alternates: \{ canonical: url \}/);
  assert.match(route, /"@type": "TechArticle"/);
  assert.match(route, /"@type": "BreadcrumbList"/);
  assert.match(route, /"@type": "FAQPage"/);
  assert.match(route, /"@type": "ItemList"/);
  assert.match(route, /dateModified: article\.updatedAt/);
  assert.match(route, /faq=\{article\.faq\}/);
  assert.match(route, /related=\{article\.related\}/);
  assert.doesNotMatch(route, /languageAlternates/);
});

test("workshop guide index and public header provide descriptive crawlable discovery", () => {
  const index = projectFile("src", "app", "workshop-guides", "page.tsx");
  const header = projectFile("src", "components", "PublicSeoHeader.tsx");
  assert.match(index, /workshopGuideArticles\.map/);
  assert.match(index, /href=\{`\/workshop-guides\/\$\{article\.slug\}`\}/);
  assert.match(index, /hasPart: workshopGuideArticles\.map/);
  assert.match(index, /Read workshop guide/);
  assert.match(header, /href="\/workshop-guides"[^>]*>Workshop guides/);
});

test("sitemap and robots publish every guide without claiming untranslated alternates", () => {
  const sitemap = projectFile("src", "app", "sitemap.ts");
  const robots = projectFile("src", "app", "robots.ts");
  assert.match(sitemap, /workshopGuideArticles\.map/);
  assert.match(sitemap, /absoluteUrl\(`\/workshop-guides\/\$\{article\.slug\}`\)/);
  assert.match(sitemap, /new Date\(article\.updatedAt\)/);
  assert.match(robots, /"\/workshop-guides\/"/);
  assert.doesNotMatch(sitemap, /localizedUrl\(locale, "\/workshop-guides"\)/);
});

test("public workshop content contains no customer, admin, storage or AI internals", () => {
  const serialized = JSON.stringify(workshopGuideArticles).toLowerCase();
  for (const privateMarker of [
    "service_role",
    "signed_url",
    "storage_path",
    "admin_notes",
    "confidence_score",
    "sample_id",
    "hex preview",
    "raw binary",
    "source_reference",
  ]) {
    assert.equal(serialized.includes(privateMarker), false, privateMarker);
  }
});
