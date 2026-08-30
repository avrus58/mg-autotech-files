import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const filesToScan = [
  "src/lib/i18n.ts",
  "src/lib/customerPortalTranslations.ts",
  "src/lib/seo.ts",
  "src/lib/searchEngineIndexing.ts",
  "src/lib/howItWorksI18n.ts",
  "src/lib/fileServiceI18n.ts",
  "src/lib/i18nRoutes.ts",
  "src/lib/homepageLocalization.tsx",
  "src/lib/homepageHeroI18n.ts",
  "src/components/LanguageSwitcher.tsx",
  "next.config.ts",
  "src/app/layout.tsx",
  "src/app/page.tsx",
  "src/app/[locale]/page.tsx",
  "src/app/[locale]/layout.tsx",
  "src/app/[locale]/services/[slug]/page.tsx",
  "src/app/services/[slug]/page.tsx",
  "src/app/services/page.tsx",
  "src/app/[locale]/how-it-works/page.tsx",
  "src/app/[locale]/file-service/page.tsx",
  "src/app/how-it-works/page.tsx",
  "src/app/file-service/page.tsx",
  "src/app/workshop-guides/page.tsx",
  "src/app/workshop-guides/[slug]/page.tsx",
  "src/lib/workshopGuides.ts",
  "src/lib/serviceIntentGuides.ts",
  "src/components/ServiceIntentPage.tsx",
  "src/app/feed.xml/route.ts",
  "src/app/llms.txt/route.ts",
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

const i18nConfig = readFileSync(join(root, "src/lib/i18nConfig.ts"), "utf8");
for (const locale of expectedLocales) {
  if (!i18nConfig.includes(`code: "${locale}"`)) failures.push(`Locale ${locale} is missing from supportedLocales.`);
}

const seo = readFileSync(join(root, "src/lib/seo.ts"), "utf8");
for (const locale of expectedLocales) {
  if (!seo.includes(`${locale}:`)) failures.push(`Locale ${locale} is missing from SEO copy.`);
}
for (const slug of ["stage-1", "dpf-off", "egr-off", "adblue-off", "dtc-off"]) {
  if (!seo.includes(`"${slug}"`)) failures.push(`Service slug ${slug} is missing from SEO metadata.`);
}
if (!seo.includes("localizedSeoLocales") || !seo.includes("locale === defaultLocale")) {
  failures.push("English canonical URLs are not isolated from prefixed localized SEO routes.");
}

const nextConfig = readFileSync(join(root, "next.config.ts"), "utf8");
if (!nextConfig.includes('source: "/en"') || !nextConfig.includes('destination: "/"')) {
  failures.push("Legacy /en does not permanently redirect to the canonical English root.");
}
if (!nextConfig.includes('source: "/en/:path*"') || !nextConfig.includes('destination: "/:path*"')) {
  failures.push("Legacy /en descendants do not redirect to canonical English root paths.");
}

for (const relativePath of [
  "src/app/[locale]/layout.tsx",
  "src/app/[locale]/page.tsx",
  "src/app/[locale]/how-it-works/page.tsx",
  "src/app/[locale]/file-service/page.tsx",
  "src/app/[locale]/services/[slug]/page.tsx",
]) {
  const localizedRoute = readFileSync(join(root, relativePath), "utf8");
  if (!localizedRoute.includes("localizedSeoLocales")) {
    failures.push(`${relativePath} can still generate duplicate English-prefixed routes.`);
  }
}

const languageSwitcher = readFileSync(join(root, "src/components/LanguageSwitcher.tsx"), "utf8");
if (!languageSwitcher.includes("isServerLocalizedPublicPath")) {
  failures.push("Language switcher does not distinguish server-localized and runtime-localized routes.");
}

const customerTranslations = readFileSync(join(root, "src/lib/customerPortalTranslations.ts"), "utf8");
const runtimeI18n = readFileSync(join(root, "src/lib/i18n.ts"), "utf8");
if (!customerTranslations.includes("customerPortalLocaleOrder") || !customerTranslations.includes("customerPortalTranslations")) {
  failures.push("Typed customer portal translation coverage is missing.");
}
if (!runtimeI18n.includes("customerPortalTranslations") || !runtimeI18n.includes("customerPortalLocaleOverrides")) {
  failures.push("Customer portal translations are not registered in the runtime catalog.");
}

const serviceIntentGuides = readFileSync(join(root, "src/lib/serviceIntentGuides.ts"), "utf8");
const rootServiceRoute = readFileSync(join(root, "src/app/services/[slug]/page.tsx"), "utf8");
const serviceIntentPage = readFileSync(join(root, "src/components/ServiceIntentPage.tsx"), "utf8");
for (const slug of ["stage-2", "stage-3", "tcu-tuning", "ecu-file-check"]) {
  if (!serviceIntentGuides.includes(`slug: "${slug}"`)) {
    failures.push(`Global service-intent slug ${slug} is missing.`);
  }
}
if (!rootServiceRoute.includes("serviceIntentGuideSlugs.map")) {
  failures.push("Root service route is not statically generating global service-intent pages.");
}
if (!serviceIntentPage.includes('"@type": "Service"')) {
  failures.push("Global service-intent pages are missing visible Service structured data.");
}
if (!serviceIntentPage.includes('"@type": "FAQPage"') || !serviceIntentPage.includes("guide.faq.map")) {
  failures.push("Global service-intent pages are missing FAQPage data backed by visible guide FAQs.");
}
if (serviceIntentPage.includes('"@type": "HowTo"')) {
  failures.push("Global service-intent pages use unsupported HowTo structured data.");
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
if (!localizedHomePage.includes("HomepageExperience")) {
  failures.push("Localized homepage is not using the canonical root homepage component tree.");
}
if (!localizedHomePage.includes("includeStructuredData={false}")) {
  failures.push("Localized homepage can duplicate the English root structured-data graph.");
}
if (localizedHomePage.includes("LocalizedSeoHome")) {
  failures.push("Localized homepage still depends on a separate drifting page design.");
}
if (existsSync(join(root, "src/components/LocalizedSeoHome.tsx"))) {
  failures.push("Legacy standalone localized homepage component still exists.");
}

const rootHomeEntry = readFileSync(join(root, "src/app/page.tsx"), "utf8");
const rootHomeExperience = readFileSync(
  join(root, "src/components/homepage/HomepageExperience.tsx"),
  "utf8"
);
const rootVehicleExperience = readFileSync(
  join(root, "src/components/homepage/VehicleIntelligence.tsx"),
  "utf8"
);
const rootHomePage = `${rootHomeEntry}\n${rootHomeExperience}\n${rootVehicleExperience}`;
const rootLayout = readFileSync(join(root, "src/app/layout.tsx"), "utf8");
const rootServicesPage = readFileSync(join(root, "src/app/services/page.tsx"), "utf8");
const rootFileServicePage = readFileSync(join(root, "src/app/file-service/page.tsx"), "utf8");
const rootHowItWorksPage = readFileSync(join(root, "src/app/how-it-works/page.tsx"), "utf8");
if (!rootServicesPage.includes("title: pageTitle,")) {
  failures.push("Root services page can duplicate the global title template suffix.");
}
if (!rootFileServicePage.includes("title: pageTitle,")) {
  failures.push("Root file-service page can duplicate the global title template suffix.");
}
if (!rootHowItWorksPage.includes("title: { absolute: copy.pageTitle }")) {
  failures.push("How It Works title does not opt out of duplicate global title suffixing.");
}
if (!rootLayout.includes("Online ECU File Service")) {
  failures.push("Root metadata is missing online ECU file service search wording.");
}
if (!rootLayout.includes("TCU File Service")) {
  failures.push("Root metadata is missing TCU File Service search wording.");
}
if (!rootLayout.includes("ECU File Upload Service")) {
  failures.push("Root metadata is missing ECU File Upload Service search wording.");
}
for (const marker of [
  "homepagePageJsonLd",
  "homepageFileServiceJsonLd",
  "homepageFaqJsonLd",
  "homepageRequestPreparationHowToJsonLd",
  '"@type": "WebPage"',
  '"@type": "Service"',
  '"@type": "FAQPage"',
  '"@type": "HowTo"',
  "hasOfferCatalog",
]) {
  if (!rootHomePage.includes(marker)) {
    failures.push(`Compact root homepage contract is missing ${marker}.`);
  }
}

for (const visibleId of [
  'id="services"',
  'id="workflow"',
  'id="homepage-search-faq"',
  'id="vehicle-data"',
]) {
  if (!rootHomePage.includes(visibleId)) {
    failures.push(`Compact root homepage is missing visible target ${visibleId}.`);
  }
}

if ((rootHomePage.match(/<DeferredPerformanceTools \/>/g) ?? []).length !== 1) {
  failures.push("Root homepage must render the deferred datalog experience exactly once.");
}
if (!rootHomePage.includes('href: "/file-service"')) {
  failures.push("Root homepage does not link to the public file service hub.");
}
for (const removedResource of [
  "homepageFileServiceNavigator",
  "fileServiceAnswerLibrary",
  "homepageCompactResourceGroups",
  "homepageFileServiceGlossaryJsonLd",
]) {
  if (rootHomePage.includes(removedResource)) {
    failures.push(`Compact root homepage still contains obsolete resource ${removedResource}.`);
  }
}

const fileServicePage = readFileSync(join(root, "src/app/file-service/page.tsx"), "utf8");
if (!fileServicePage.includes("Professional ECU file service for custom tuning files")) {
  failures.push("File service hub page is missing the visible H1/title signal.");
}
if (!fileServicePage.includes('"@type": "Service"')) {
  failures.push("File service hub structured data is missing Service.");
}
if (!fileServicePage.includes('"@type": "FAQPage"')) {
  failures.push("File service hub structured data is missing FAQPage.");
}
if (!fileServicePage.includes('"@type": "BreadcrumbList"')) {
  failures.push("File service hub structured data is missing BreadcrumbList.");
}
if (!fileServicePage.includes('"@type": "ItemList"')) {
  failures.push("File service hub structured data is missing resource ItemList.");
}
if (!fileServicePage.includes('absoluteUrl("/file-service")')) {
  failures.push("File service hub metadata is missing canonical /file-service URL.");
}
if (!fileServicePage.includes('languageAlternates("/file-service")')) {
  failures.push("File service hub metadata is missing language alternates.");
}
if (!fileServicePage.includes("JSON.stringify(jsonLd)")) {
  failures.push("File service hub does not render structured data.");
}
if (!fileServicePage.includes("PublicSeoHeader") || !fileServicePage.includes("Footer")) {
  failures.push("File service hub is missing shared public header/footer navigation.");
}

const servicesCatalogPage = readFileSync(join(root, "src/app/services/page.tsx"), "utf8");
if (
  !servicesCatalogPage.includes(
    "ECU & TCU file services, organized for serious workshops.",
  )
) {
  failures.push("Services catalog page is missing the visible H1/title signal.");
}
if (!servicesCatalogPage.includes('canonical: absoluteUrl("/services")')) {
  failures.push("Services catalog page is missing canonical /services metadata.");
}
if (!servicesCatalogPage.includes('"@type": "CollectionPage"')) {
  failures.push("Services catalog structured data is missing CollectionPage.");
}
if (!servicesCatalogPage.includes('"@type": "Service"')) {
  failures.push("Services catalog structured data is missing Service.");
}
if (!servicesCatalogPage.includes('"@type": "OfferCatalog"')) {
  failures.push("Services catalog structured data is missing OfferCatalog.");
}
if (!servicesCatalogPage.includes('"@type": "FAQPage"')) {
  failures.push("Services catalog structured data is missing FAQPage.");
}
if (!servicesCatalogPage.includes('"@type": "BreadcrumbList"')) {
  failures.push("Services catalog structured data is missing BreadcrumbList.");
}
if (!servicesCatalogPage.includes("JSON.stringify(catalogJsonLd)")) {
  failures.push("Services catalog does not render structured data.");
}
if (!servicesCatalogPage.includes("PublicSeoHeader") || !servicesCatalogPage.includes("Footer")) {
  failures.push("Services catalog is missing shared public header/footer navigation.");
}

const localizedFileServicePage = readFileSync(join(root, "src/app/[locale]/file-service/page.tsx"), "utf8");
if (!localizedFileServicePage.includes("getFileServiceCopy")) {
  failures.push("Localized file service page is not using localized copy.");
}
if (!localizedFileServicePage.includes("fileServiceJsonLd")) {
  failures.push("Localized file service page is missing structured data helper.");
}
if (!localizedFileServicePage.includes('localizedUrl(locale, "/file-service")')) {
  failures.push("Localized file service page is missing canonical localized URL.");
}
if (!localizedFileServicePage.includes('languageAlternates("/file-service")')) {
  failures.push("Localized file service page is missing File Service language alternates.");
}
if (!localizedFileServicePage.includes("LocalizedSeoFooter")) {
  failures.push("Localized file service page is missing localized footer navigation.");
}

const fileServiceI18n = readFileSync(join(root, "src/lib/fileServiceI18n.ts"), "utf8");
for (const marker of [
  "ECU & TCU File Service Hub",
  "ECU und TCU Dateiservice Hub",
  "ECU ve TCU Dosya Servisi Merkezi",
  "fileServiceJsonLd",
]) {
  if (!fileServiceI18n.includes(marker)) {
    failures.push(`File Service i18n copy is missing ${marker}.`);
  }
}

const i18nRoutes = readFileSync(join(root, "src/lib/i18nRoutes.ts"), "utf8");
if (!i18nRoutes.includes('parts[0] === "file-service"')) {
  failures.push("i18n route helper does not map File Service routes across locales.");
}

const sitemap = readFileSync(join(root, "src/app/sitemap.ts"), "utf8");
if (!sitemap.includes("localizedSeoLocales") || sitemap.includes("seoLocales.flatMap")) {
  failures.push("Sitemap can emit duplicate English-prefixed canonical pages.");
}
if (!sitemap.includes("languageAlternates")) failures.push("Sitemap does not include language alternates.");
if (!sitemap.includes("publicServiceSlugs")) failures.push("Sitemap does not include service slugs.");
if (!sitemap.includes('"/file-service"')) {
  failures.push("Sitemap does not include /file-service.");
}
if (!sitemap.includes('absoluteUrl("/services")')) {
  failures.push("Sitemap does not include /services.");
}
if (!sitemap.includes('localizedUrl(locale, "/how-it-works")')) {
  failures.push("Sitemap does not include localized How It Works routes.");
}
if (!sitemap.includes('localizedUrl(locale, "/file-service")')) {
  failures.push("Sitemap does not include localized File Service routes.");
}
if (!sitemap.includes('languageAlternates("/how-it-works")')) {
  failures.push("Sitemap does not include How It Works language alternates.");
}
if (!sitemap.includes('languageAlternates("/file-service")')) {
  failures.push("Sitemap does not include File Service language alternates.");
}
if (!sitemap.includes("workshopGuideArticles.map")) {
  failures.push("Sitemap does not include the workshop guide article collection.");
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
if (!robots.includes("localizedSeoLocales")) {
  failures.push("Robots allowlist is not aligned with canonical localized route generation.");
}
if (!robots.includes("sitemap")) failures.push("robots.ts does not expose sitemap.");
if (!robots.includes("/admin") || !robots.includes("/dashboard") || !robots.includes("/api")) {
  failures.push("robots.ts should block private/admin/dashboard/API crawling.");
}
if (!robots.includes('"/file-service"')) {
  failures.push("robots.ts should allow /file-service.");
}
if (!robots.includes("/how-it-works") || !robots.includes('`/${locale}/how-it-works`')) {
  failures.push("robots.ts should allow root and localized How It Works routes.");
}
if (!robots.includes('`/${locale}/file-service`')) {
  failures.push("robots.ts should allow localized File Service routes.");
}
if (!robots.includes('"/workshop-guides/"')) {
  failures.push("robots.ts should allow workshop guide descendants.");
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

const searchEngineIndexing = readFileSync(join(root, "src/lib/searchEngineIndexing.ts"), "utf8");
const indexNowScript = readFileSync(join(root, "scripts/submit-indexnow.ts"), "utf8");
const rootProxy = readFileSync(join(root, "src/proxy.ts"), "utf8");
const indexNowKeyMatch = searchEngineIndexing.match(/indexNowKey = "([a-f0-9]{32,128})"/);
if (!indexNowKeyMatch) {
  failures.push("IndexNow uses no valid public ownership key.");
} else {
  const keyPath = join(root, "public", `${indexNowKeyMatch[1]}.txt`);
  if (!existsSync(keyPath) || readFileSync(keyPath, "utf8").trim() !== indexNowKeyMatch[1]) {
    failures.push("IndexNow public ownership file is missing or does not match its configured key.");
  }
  if (!robots.includes("indexNowKeyPath")) {
    failures.push("robots.ts does not expose the IndexNow ownership path.");
  }
  if (!rootProxy.includes(`${indexNowKeyMatch[1]}.txt`)) {
    failures.push("IndexNow ownership verification still passes through locale middleware.");
  }
}
if (!rootLayout.includes("buildSearchEngineVerification")) {
  failures.push("Root metadata is missing multi-engine webmaster verification support.");
}
if (!searchEngineIndexing.includes('other["msvalidate.01"]')) {
  failures.push("Bing webmaster verification metadata is missing.");
}
if (!searchEngineIndexing.includes('other["baidu-site-verification"]')) {
  failures.push("Baidu webmaster verification metadata is missing.");
}
if (!searchEngineIndexing.includes('other["naver-site-verification"]')) {
  failures.push("Naver webmaster verification metadata is missing.");
}
if (!searchEngineIndexing.includes("YANDEX_SITE_VERIFICATION")) {
  failures.push("Yandex webmaster verification metadata is missing.");
}
if (!indexNowScript.includes('process.argv.includes("--submit")')) {
  failures.push("IndexNow operator script is not fail-safe/dry-run by default.");
}

const workshopGuideIndex = readFileSync(join(root, "src/app/workshop-guides/page.tsx"), "utf8");
const workshopGuideRoute = readFileSync(join(root, "src/app/workshop-guides/[slug]/page.tsx"), "utf8");
const workshopGuideContent = readFileSync(join(root, "src/lib/workshopGuides.ts"), "utf8");
if (!workshopGuideIndex.includes("workshopGuideArticles.map")) {
  failures.push("Workshop guide index does not render the cornerstone article collection.");
}
if (!workshopGuideIndex.includes("hasPart: workshopGuideArticles.map")) {
  failures.push("Workshop guide CollectionPage is not linked to its visible articles.");
}
for (const marker of ["TechArticle", "BreadcrumbList", "FAQPage", "ItemList"]) {
  if (!workshopGuideRoute.includes(marker)) {
    failures.push(`Workshop guide article route is missing ${marker} structured data.`);
  }
}
for (const slug of [
  "ecu-file-service-online",
  "tcu-file-service-workflow",
  "obd-bench-boot-read-methods",
  "ecu-file-request-checklist",
  "ecu-hw-sw-identification",
]) {
  if (!workshopGuideContent.includes(`slug: "${slug}"`)) {
    failures.push(`Workshop guide content is missing ${slug}.`);
  }
}

if (failures.length) {
  console.error("i18n/SEO check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`i18n/SEO check passed for ${expectedLocales.length} locales and ${filesToScan.length} source files.`);
