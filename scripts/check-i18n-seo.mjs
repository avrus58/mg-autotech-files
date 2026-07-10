import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const filesToScan = [
  "src/lib/i18n.ts",
  "src/lib/seo.ts",
  "src/app/[locale]/page.tsx",
  "src/app/[locale]/layout.tsx",
  "src/app/[locale]/services/[slug]/page.tsx",
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

const sitemap = readFileSync(join(root, "src/app/sitemap.ts"), "utf8");
if (!sitemap.includes("languageAlternates")) failures.push("Sitemap does not include language alternates.");
if (!sitemap.includes("publicServiceSlugs")) failures.push("Sitemap does not include service slugs.");

const robots = readFileSync(join(root, "src/app/robots.ts"), "utf8");
if (!robots.includes("sitemap")) failures.push("robots.ts does not expose sitemap.");
if (!robots.includes("/admin") || !robots.includes("/dashboard") || !robots.includes("/api")) {
  failures.push("robots.ts should block private/admin/dashboard/API crawling.");
}

if (failures.length) {
  console.error("i18n/SEO check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`i18n/SEO check passed for ${expectedLocales.length} locales and ${filesToScan.length} source files.`);
