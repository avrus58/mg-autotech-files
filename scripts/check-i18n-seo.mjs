import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const filesToScan = [
  "src/lib/i18n.ts",
  "src/lib/seo.ts",
  "src/lib/howItWorksI18n.ts",
  "src/lib/i18nRoutes.ts",
  "src/app/page.tsx",
  "src/app/[locale]/page.tsx",
  "src/app/[locale]/layout.tsx",
  "src/app/[locale]/services/[slug]/page.tsx",
  "src/app/[locale]/how-it-works/page.tsx",
  "src/app/how-it-works/page.tsx",
  "src/app/sitemap.ts",
  "src/app/robots.ts",
];

const expectedLocales = ["nl", "en", "de", "fr", "it", "ru", "es", "tr", "pt", "zh", "pl", "sq"];

const mojibakePatterns = [
  { name: "replacement-character", pattern: /\ufffd/u },
  { name: "utf8-as-latin1-c3", pattern: /\u00c3[\u0080-\u00bf]/u },
  { name: "utf8-as-latin1-c2", pattern: /\u00c2[\u0080-\u00bf]/u },
  { name: "smart-quote-mojibake", pattern: /\u00e2[\u0080-\u009f]/u },
  { name: "russian-mojibake-marker", pattern: /\u011e/u },
];

const failures = [];

for (const relativePath of filesToScan) {
  const fullPath = join(root, relativePath);
  if (!existsSync(fullPath)) {
    failures.push(`Missing expected i18n/SEO file: ${relativePath}`);
    continue;
  }
  const text = readFileSync(fullPath, "utf8");
  for (const marker of mojibakePatterns) {
    if (marker.pattern.test(text)) {
      failures.push(`${relativePath} contains possible ${marker.name}`);
    }
  }
}

const i18n = readFileSync(join(root, "src/lib/i18n.ts"), "utf8");
for (const locale of expectedLocales) {
  if (!i18n.includes(`code: "${locale}"`)) failures.push(`Locale ${locale} is missing from supportedLocales.`);
}

const seo = readFileSync(join(root, "src/lib/seo.ts"), "utf8");
for (const locale of expectedLocales) {
  if (!seo.includes(`${locale}:`)) failures.push(`Locale ${locale} is missing from SEO copy.`);
}
for (const slug of ["stage-1", "dpf-off", "egr-off", "adblue-off", "dtc-off"]) {
  if (!seo.includes(`"${slug}"`)) failures.push(`Service slug ${slug} is missing from SEO metadata.`);
}

const localizedHomePage = readFileSync(join(root, "src/app/[locale]/page.tsx"), "utf8");
if (!localizedHomePage.includes("buildLocalizedHomepageJsonLd")) {
  failures.push("Localized homepage does not build page-level structured data.");
}
if (!localizedHomePage.includes('"@type": "WebPage"')) {
  failures.push("Localized homepage structured data is missing WebPage.");
}
if (!localizedHomePage.includes('"@type": "ItemList"')) {
  failures.push("Localized homepage structured data is missing service ItemList.");
}
if (!localizedHomePage.includes("publicServiceSlugs.map")) {
  failures.push("Localized homepage service ItemList is not generated from public service slugs.");
}
if (!localizedHomePage.includes("localizedUrl(locale, `/services/${slug}`)")) {
  failures.push("Localized homepage service ItemList is missing localized service URLs.");
}

const rootHomePage = readFileSync(join(root, "src/app/page.tsx"), "utf8");
if (!rootHomePage.includes("homepagePageJsonLd")) {
  failures.push("Root homepage does not expose page-level WebPage structured data.");
}
if (!rootHomePage.includes('"@type": "WebPage"')) {
  failures.push("Root homepage structured data is missing WebPage.");
}
if (!rootHomePage.includes('JSON.stringify(homepagePageJsonLd)')) {
  failures.push("Root homepage does not render page-level WebPage structured data.");
}
if (!rootHomePage.includes('publicResourceUrl("/#homepage-search-faq")')) {
  failures.push("Root homepage WebPage structured data is not linked to the FAQ graph.");
}
if (!rootHomePage.includes("homepageRequestPreparationHowToJsonLd")) {
  failures.push("Root homepage does not expose request preparation HowTo structured data.");
}
if (!rootHomePage.includes('"@type": "HowTo"')) {
  failures.push("Root homepage request preparation structured data is missing HowTo.");
}
if (!rootHomePage.includes("step: requestReadinessSteps.map")) {
  failures.push("Root homepage HowTo is not generated from the visible request readiness steps.");
}
if (!rootHomePage.includes('JSON.stringify(homepageRequestPreparationHowToJsonLd)')) {
  failures.push("Root homepage does not render request preparation HowTo structured data.");
}
if (!rootHomePage.includes('publicResourceUrl("/#service-landing-pages")')) {
  failures.push("Root homepage WebPage structured data is not linked to service ItemList.");
}

const sitemap = readFileSync(join(root, "src/app/sitemap.ts"), "utf8");
if (!sitemap.includes("languageAlternates")) failures.push("Sitemap does not include language alternates.");
if (!sitemap.includes("publicServiceSlugs")) failures.push("Sitemap does not include service slugs.");
if (!sitemap.includes('localizedUrl(locale, "/how-it-works")')) {
  failures.push("Sitemap does not include localized How It Works routes.");
}
if (!sitemap.includes('languageAlternates("/how-it-works")')) {
  failures.push("Sitemap does not include How It Works language alternates.");
}
for (const toolPath of [
  "/tools/file-readiness-check",
  "/tools/request-brief-builder",
  "/tools/ecu-read-method-advisor",
]) {
  if (!sitemap.includes(`"${toolPath}"`)) {
    failures.push(`Sitemap does not include public preparation tool route ${toolPath}.`);
  }
}

const robots = readFileSync(join(root, "src/app/robots.ts"), "utf8");
if (!robots.includes("sitemap")) failures.push("robots.ts does not expose sitemap.");
if (!robots.includes("/admin") || !robots.includes("/dashboard") || !robots.includes("/api")) {
  failures.push("robots.ts should block private/admin/dashboard/API crawling.");
}
if (!robots.includes("/how-it-works") || !robots.includes('`/${locale}/how-it-works`')) {
  failures.push("robots.ts should allow root and localized How It Works routes.");
}
for (const toolPath of [
  "/tools/file-readiness-check",
  "/tools/request-brief-builder",
  "/tools/ecu-read-method-advisor",
]) {
  if (!robots.includes(`"${toolPath}"`)) {
    failures.push(`robots.ts should allow public preparation tool route ${toolPath}.`);
  }
}

if (failures.length) {
  console.error("i18n/SEO check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`i18n/SEO check passed for ${expectedLocales.length} locales and ${filesToScan.length} source files.`);
