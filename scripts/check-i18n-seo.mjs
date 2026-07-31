import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const filesToScan = [
  "src/lib/i18n.ts",
  "src/lib/seo.ts",
  "src/lib/howItWorksI18n.ts",
  "src/lib/fileServiceI18n.ts",
  "src/lib/i18nRoutes.ts",
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

const rootHomePage = readFileSync(join(root, "src/app/page.tsx"), "utf8");
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
if (!rootHomePage.includes("homepageFileServiceJsonLd")) {
  failures.push("Root homepage does not expose ECU/TCU file service structured data.");
}
if (!rootHomePage.includes("homepageFileServiceNavigator")) {
  failures.push("Root homepage does not expose the file service navigator.");
}
if (!rootHomePage.includes("fileServiceAnswerLibrary")) {
  failures.push("Root homepage does not expose the file service answer library.");
}
if (!rootHomePage.includes("fileServiceAnswerLibraryJsonLd")) {
  failures.push("Root homepage does not expose file service answer library structured data.");
}
if (!rootHomePage.includes('JSON.stringify(fileServiceAnswerLibraryJsonLd)')) {
  failures.push("Root homepage does not render file service answer library structured data.");
}
if (!rootHomePage.includes("fileServiceSearchRouteIndex")) {
  failures.push("Root homepage does not expose the file service search route index.");
}
if (!rootHomePage.includes("fileServiceSnippetSummary")) {
  failures.push("Root homepage does not expose the file service snippet summary.");
}
if (!rootHomePage.includes("fileServiceTrustComparison")) {
  failures.push("Root homepage does not expose the professional file service comparison.");
}
if (!rootHomePage.includes("fileServiceVerificationCheckpoints")) {
  failures.push("Root homepage does not expose the file service verification checkpoints.");
}
if (!rootHomePage.includes("fileServiceMythChecks")) {
  failures.push("Root homepage does not expose the file service myth checks.");
}
if (!rootHomePage.includes("fileServicePlatformStack")) {
  failures.push("Root homepage does not expose the file service platform stack.");
}
if (!rootHomePage.includes("fileServiceReadMethodRoutes")) {
  failures.push("Root homepage does not expose file service read method routes.");
}
if (!rootHomePage.includes("fileServiceBriefRequirements")) {
  failures.push("Root homepage does not expose file service brief requirements.");
}
if (!rootHomePage.includes("fileServiceFitChecks")) {
  failures.push("Root homepage does not expose the file service fit checker.");
}
if (!rootHomePage.includes("fileServiceOutcomePreview")) {
  failures.push("Root homepage does not expose the file service outcome preview.");
}
if (!rootHomePage.includes("fileServiceStatusGuide")) {
  failures.push("Root homepage does not expose the file service status guide.");
}
if (!rootHomePage.includes("fileServicePrivacyControls")) {
  failures.push("Root homepage does not expose secure file service privacy controls.");
}
if (!rootHomePage.includes("fileServiceUseCases")) {
  failures.push("Root homepage does not expose the file service use case library.");
}
if (!rootHomePage.includes("fileServiceQualitySignals")) {
  failures.push("Root homepage does not expose file service quality signals.");
}
if (!rootHomePage.includes("fileServiceWorkshopProfiles")) {
  failures.push("Root homepage does not expose workshop file service profiles.");
}
if (!rootHomePage.includes("fileServiceKnowledgeMap")) {
  failures.push("Root homepage does not expose the file service knowledge map.");
}
if (!rootHomePage.includes("fileServiceDecisionMatrix")) {
  failures.push("Root homepage does not expose the file service decision matrix.");
}
if (!rootHomePage.includes("fileServiceOperatingStandard")) {
  failures.push("Root homepage does not expose the file service operating standard.");
}
if (!rootHomePage.includes("fileServiceGlossaryTerms")) {
  failures.push("Root homepage does not expose the file service terminology glossary.");
}
if (!rootHomePage.includes('"@type": "Service"')) {
  failures.push("Root homepage file service structured data is missing Service type.");
}
if (!rootHomePage.includes('"@type": "DefinedTermSet"')) {
  failures.push("Root homepage file service glossary structured data is missing DefinedTermSet.");
}
if (!rootHomePage.includes('publicResourceUrl("/#ecu-tcu-file-service")')) {
  failures.push("Root homepage WebPage structured data is not linked to the ECU/TCU file service graph.");
}
if (!rootHomePage.includes("hasOfferCatalog")) {
  failures.push("Root homepage file service structured data is missing offer catalog.");
}
if (!rootHomePage.includes('JSON.stringify(homepageFileServiceJsonLd)')) {
  failures.push("Root homepage does not render ECU/TCU file service structured data.");
}
const performanceToolsIndex = rootHomePage.indexOf("<PerformanceTools />");
const fileServiceNavigatorIndex = rootHomePage.indexOf('<AnimatedSection id="file-service-navigator"');
if (performanceToolsIndex < 0 || fileServiceNavigatorIndex < 0 || performanceToolsIndex > fileServiceNavigatorIndex) {
  failures.push("Root homepage performance tools must render before the file service navigator.");
}
if (rootHomePage.includes("file-service-quick-paths") || rootHomePage.includes("homepageQuickPathJsonLd")) {
  failures.push("Root homepage still contains the removed hero quick-path panel.");
}
if (!rootHomePage.includes('buildHomepageItemList("MG AutoTech file service homepage navigator", homepageFileServiceNavigator, "/#file-service-navigator")')) {
  failures.push("Root homepage resource graph is missing the file service navigator ItemList.");
}
if (!rootHomePage.includes('publicResourceUrl("/#file-service-navigator")')) {
  failures.push("Root homepage WebPage structured data is not linked to the file service navigator.");
}
if (!rootHomePage.includes('buildHomepageItemList("MG AutoTech file service answer library", fileServiceAnswerLibrary, "/#file-service-answer-library")')) {
  failures.push("Root homepage resource graph is missing the file service answer library ItemList.");
}
if (!rootHomePage.includes('publicResourceUrl("/#file-service-answer-library")')) {
  failures.push("Root homepage WebPage structured data is not linked to the file service answer library.");
}
if (!rootHomePage.includes('buildHomepageItemList("MG AutoTech file service search route index", fileServiceSearchRouteIndex, "/#file-service-search-index")')) {
  failures.push("Root homepage resource graph is missing the file service search route index ItemList.");
}
if (!rootHomePage.includes('publicResourceUrl("/#file-service-search-index")')) {
  failures.push("Root homepage WebPage structured data is not linked to the file service search route index.");
}
if (!rootHomePage.includes('buildHomepageItemList("MG AutoTech file service snippet summary", fileServiceSnippetSummary, "/#file-service-snippet-summary")')) {
  failures.push("Root homepage resource graph is missing the file service snippet summary ItemList.");
}
if (!rootHomePage.includes('publicResourceUrl("/#file-service-snippet-summary")')) {
  failures.push("Root homepage WebPage structured data is not linked to the file service snippet summary.");
}
if (!rootHomePage.includes('buildHomepageItemList("MG AutoTech professional file service comparison", fileServiceTrustComparison, "/#professional-file-service-comparison")')) {
  failures.push("Root homepage resource graph is missing the professional file service comparison ItemList.");
}
if (!rootHomePage.includes('publicResourceUrl("/#professional-file-service-comparison")')) {
  failures.push("Root homepage WebPage structured data is not linked to the professional file service comparison.");
}
if (!rootHomePage.includes('buildHomepageItemList("MG AutoTech file service verification checkpoints", fileServiceVerificationCheckpoints, "/#file-service-verification-checkpoints")')) {
  failures.push("Root homepage resource graph is missing the file service verification checkpoints ItemList.");
}
if (!rootHomePage.includes('publicResourceUrl("/#file-service-verification-checkpoints")')) {
  failures.push("Root homepage WebPage structured data is not linked to the file service verification checkpoints.");
}
if (!rootHomePage.includes('buildHomepageItemList("MG AutoTech file service myth checks", fileServiceMythChecks, "/#file-service-myth-checks")')) {
  failures.push("Root homepage resource graph is missing the file service myth checks ItemList.");
}
if (!rootHomePage.includes('publicResourceUrl("/#file-service-myth-checks")')) {
  failures.push("Root homepage WebPage structured data is not linked to the file service myth checks.");
}
if (!rootHomePage.includes('buildHomepageItemList("MG AutoTech file service platform stack", fileServicePlatformStack, "/#file-service-platform-stack")')) {
  failures.push("Root homepage resource graph is missing the file service platform stack ItemList.");
}
if (!rootHomePage.includes('publicResourceUrl("/#file-service-platform-stack")')) {
  failures.push("Root homepage WebPage structured data is not linked to the file service platform stack.");
}
if (!rootHomePage.includes('buildHomepageItemList("MG AutoTech file service read method routes", fileServiceReadMethodRoutes, "/#file-service-read-methods")')) {
  failures.push("Root homepage resource graph is missing the file service read method routes ItemList.");
}
if (!rootHomePage.includes('publicResourceUrl("/#file-service-read-methods")')) {
  failures.push("Root homepage WebPage structured data is not linked to the file service read method routes.");
}
if (!rootHomePage.includes('buildHomepageItemList("MG AutoTech file service brief requirements", fileServiceBriefRequirements, "/#file-service-brief-requirements")')) {
  failures.push("Root homepage resource graph is missing the file service brief requirements ItemList.");
}
if (!rootHomePage.includes('publicResourceUrl("/#file-service-brief-requirements")')) {
  failures.push("Root homepage WebPage structured data is not linked to the file service brief requirements.");
}
if (!rootHomePage.includes('buildHomepageItemList("MG AutoTech file service fit checker", fileServiceFitChecks, "/#file-service-fit-checker")')) {
  failures.push("Root homepage resource graph is missing the file service fit checker ItemList.");
}
if (!rootHomePage.includes('publicResourceUrl("/#file-service-fit-checker")')) {
  failures.push("Root homepage WebPage structured data is not linked to the file service fit checker.");
}
if (!rootHomePage.includes('buildHomepageItemList("MG AutoTech file service outcome preview", fileServiceOutcomePreview, "/#file-service-outcome-preview")')) {
  failures.push("Root homepage resource graph is missing the file service outcome preview ItemList.");
}
if (!rootHomePage.includes('publicResourceUrl("/#file-service-outcome-preview")')) {
  failures.push("Root homepage WebPage structured data is not linked to the file service outcome preview.");
}
if (!rootHomePage.includes('buildHomepageItemList("MG AutoTech file service status guide", fileServiceStatusGuide, "/#file-service-status-guide")')) {
  failures.push("Root homepage resource graph is missing the file service status guide ItemList.");
}
if (!rootHomePage.includes('publicResourceUrl("/#file-service-status-guide")')) {
  failures.push("Root homepage WebPage structured data is not linked to the file service status guide.");
}
if (!rootHomePage.includes('buildHomepageItemList("MG AutoTech secure file service privacy controls", fileServicePrivacyControls, "/#file-service-privacy-controls")')) {
  failures.push("Root homepage resource graph is missing the secure file service privacy controls ItemList.");
}
if (!rootHomePage.includes('publicResourceUrl("/#file-service-privacy-controls")')) {
  failures.push("Root homepage WebPage structured data is not linked to the secure file service privacy controls.");
}
if (!rootHomePage.includes('buildHomepageItemList("MG AutoTech file service use case library", fileServiceUseCases, "/#file-service-use-cases")')) {
  failures.push("Root homepage resource graph is missing the file service use case library ItemList.");
}
if (!rootHomePage.includes('publicResourceUrl("/#file-service-use-cases")')) {
  failures.push("Root homepage WebPage structured data is not linked to the file service use case library.");
}
if (!rootHomePage.includes('buildHomepageItemList("MG AutoTech file service quality signals", fileServiceQualitySignals, "/#file-service-quality-signals")')) {
  failures.push("Root homepage resource graph is missing the file service quality signals ItemList.");
}
if (!rootHomePage.includes('publicResourceUrl("/#file-service-quality-signals")')) {
  failures.push("Root homepage WebPage structured data is not linked to the file service quality signals.");
}
if (!rootHomePage.includes('buildHomepageItemList("MG AutoTech workshop file service profiles", fileServiceWorkshopProfiles, "/#file-service-workshop-profiles")')) {
  failures.push("Root homepage resource graph is missing the workshop file service profiles ItemList.");
}
if (!rootHomePage.includes('publicResourceUrl("/#file-service-workshop-profiles")')) {
  failures.push("Root homepage WebPage structured data is not linked to the workshop file service profiles.");
}
if (!rootHomePage.includes("homepageFileServiceGlossaryJsonLd")) {
  failures.push("Root homepage does not expose file service glossary structured data.");
}
if (!rootHomePage.includes("hasDefinedTerm: fileServiceGlossaryTerms.map")) {
  failures.push("Root homepage glossary structured data is not generated from visible terms.");
}
if (!rootHomePage.includes('JSON.stringify(homepageFileServiceGlossaryJsonLd)')) {
  failures.push("Root homepage does not render file service glossary structured data.");
}
if (!rootHomePage.includes('buildHomepageItemList("MG AutoTech file service knowledge map", fileServiceKnowledgeMap, "/#file-service-knowledge-map")')) {
  failures.push("Root homepage resource graph is missing the file service knowledge map ItemList.");
}
if (!rootHomePage.includes('publicResourceUrl("/#file-service-knowledge-map")')) {
  failures.push("Root homepage WebPage structured data is not linked to the file service knowledge map.");
}
if (!rootHomePage.includes('buildHomepageItemList("MG AutoTech file service decision matrix", fileServiceDecisionMatrix, "/#file-service-decision-matrix")')) {
  failures.push("Root homepage resource graph is missing the file service decision matrix ItemList.");
}
if (!rootHomePage.includes('publicResourceUrl("/#file-service-decision-matrix")')) {
  failures.push("Root homepage WebPage structured data is not linked to the file service decision matrix.");
}
if (!rootHomePage.includes('buildHomepageItemList("MG AutoTech online file service operating standard", fileServiceOperatingStandard, "/#file-service-operating-standard")')) {
  failures.push("Root homepage resource graph is missing the online file service operating standard ItemList.");
}
if (!rootHomePage.includes('publicResourceUrl("/#file-service-operating-standard")')) {
  failures.push("Root homepage WebPage structured data is not linked to the online file service operating standard.");
}
if (!rootHomePage.includes('buildHomepageItemList("MG AutoTech file service glossary", fileServiceGlossaryTerms, "/#file-service-glossary")')) {
  failures.push("Root homepage resource graph is missing the file service glossary ItemList.");
}
if (!rootHomePage.includes('publicResourceUrl("/#file-service-glossary")')) {
  failures.push("Root homepage WebPage structured data is not linked to the file service glossary.");
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
if (!rootHomePage.includes('href="/file-service"')) {
  failures.push("Root homepage does not link to the public file service hub.");
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
if (!servicesCatalogPage.includes("ECU & TCU Solution Catalog")) {
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
