import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { exactTranslations, termTranslations } from "../src/lib/i18n";
import { supportedLocales, type LocaleCode } from "../src/lib/i18nConfig";
import { buildHomepageTranslationCatalog } from "../src/lib/homepageTranslationCatalog";
import { publicVehicleCopy } from "../src/components/homepage/VehicleIntelligence";
import { emailLocaleCopy } from "../src/lib/email/localeCopy";
import {
  customerWorkflowExactTranslations,
  customerWorkflowLocaleOrder,
} from "../src/lib/i18n/customer-workflow-translations";
import { customerWorkflowClientGroupForPath } from "../src/lib/i18n/customer-workflow-client-routes";
import {
  customerWorkflowAuditRoots,
  customerWorkflowExternallyLocalizedSharedSources,
  customerWorkflowClientSurfaceManifest,
  customerWorkflowManagedRouteSegments,
  customerWorkflowManifestSourceFiles,
  type CustomerWorkflowClientGroup,
  type CustomerWorkflowClientSurfaceConfig,
} from "../src/lib/i18n/customer-workflow-surface-manifest";
import {
  dtcAnalyzerLocaleOrder,
  dtcAnalyzerMessageRows,
} from "../src/lib/i18n/dtc-analyzer-translations";
import {
  logStudioExactLocaleOrder,
  logStudioExactTranslations,
} from "../src/lib/i18n/log-analysis-studio-translations";
import { publicSurfaceLocaleOrder } from "../src/lib/i18n/public-surface-types";
import { publicCoreTranslations } from "../src/lib/i18n/public-core-translations";
import { publicServicesTranslations } from "../src/lib/i18n/public-services-translations";
import { publicToolsTranslations } from "../src/lib/i18n/public-tools-translations";
import { publicVehicleTranslations } from "../src/lib/i18n/public-vehicle-translations";
import {
  serviceIntentExactTranslations,
  serviceIntentLocaleOrder,
} from "../src/lib/i18n/service-intent-translations";
import {
  workshopGuideExactTranslations,
  workshopGuideLocaleOrder,
} from "../src/lib/i18n/workshop-guides-translations";
import {
  widgetSiteExactTranslations,
  widgetSiteLocaleOrder,
} from "../src/lib/i18n/widget-site-translations";
import {
  auditDynamicVisibleExpressions,
  reviewedDynamicVisibleExpressions,
  type DynamicVisibleExpression,
} from "./lib/i18n-dynamic-guard";
import {
  findUnclassifiedAppRouteFiles,
  findUnclassifiedFiles,
  isCoLocatedAppUiSourceFile,
  isPotentialSharedUiSourceFile,
} from "./lib/i18n-component-inventory";
import { auditFrozenSource } from "./lib/i18n-frozen-source";
import { externallyLocalizedSharedSourceExclusions } from "./generate-customer-workflow-client-translations";
import { isReviewedModelField, isReviewedNotificationTranslatorCall } from "./lib/i18n-model-field-contracts";

const customerSurfaceRoots = [
  "src/app/error.tsx",
  "src/app/global-error.tsx",
  "src/app/layout.tsx",
  "src/app/manifest.ts",
  "src/app/not-found.tsx",
  "src/app/opengraph-image.tsx",
  "src/app/page.tsx",
  "src/app/[locale]",
  "src/app/about",
  "src/app/auth",
  "src/app/brands",
  "src/app/contact",
  "src/app/dashboard",
  "src/app/desktop-auth",
  "src/app/download",
  "src/app/ecu-platforms",
  "src/app/embed",
  "src/app/new-request",
  "src/app/login",
  "src/app/measurement",
  "src/app/register",
  "src/app/forgot-password",
  "src/app/how-it-works",
  "src/app/reset-password",
  "src/app/payment",
  "src/app/services",
  "src/app/tools",
  "src/app/widget",
  "src/app/workshop-guides",
  "src/components/account",
  "src/components/analytics/AccountRuntimeBoundary.tsx",
  "src/components/analytics/GrowthIdentityLinkRuntime.tsx",
  "src/components/analytics/PaidClickPreHydrationGuard.tsx",
  "src/components/analytics/PublicAnalyticsRuntime.tsx",
  "src/components/analytics/RegistrationHandoffRecoveryRuntime.tsx",
  "src/components/auth",
  "src/components/dashboard",
  "src/components/homepage/HomepageExperience.tsx",
  "src/components/homepage/VehicleIntelligence.tsx",
  "src/components/HomepageSessionBridge.tsx",
  "src/components/HowItWorksPageContent.tsx",
  "src/components/LanguageSwitcher.tsx",
  "src/components/LocalizedSeoFooter.tsx",
  "src/components/LocalizedServiceCards.tsx",
  "src/components/recovery/NotFoundClient.tsx",
  "src/components/RequestLocaleBoundary.tsx",
  "src/components/RuntimePublicFooter.tsx",
  "src/components/RuntimePublicLocalization.tsx",
  "src/components/ServerLocaleBoundary.tsx",
  "src/components/tools",
  "src/components/widget",
  "src/lib/notFoundMetadata.ts",
  "src/components/analytics/PublicAnalytics.tsx",
  "src/components/CustomerNotificationsRuntime.tsx",
  "src/components/CustomerNotifications.tsx",
  "src/components/CountrySelect.tsx",
  "src/components/FileServiceSearchNavigator.tsx",
  "src/components/Footer.tsx",
  "src/components/InternationalPhoneField.tsx",
  "src/components/OnlineStatus.tsx",
  "src/components/PlatformReliabilityMonitor.tsx",
  "src/components/PublicSeoHeader.tsx",
  "src/components/RequestChat.tsx",
  "src/components/SeoGuidePage.tsx",
  "src/components/ServiceIntentPage.tsx",
  "src/components/Stage1Authority.tsx",
  "src/components/StageComparison.tsx",
  "src/components/auth/AuthRequired.tsx",
  "src/components/auth/DeviceVerificationPanel.tsx",
  "src/components/account/TrustedDevicesCard.tsx",
  "src/components/app-shell.tsx",
  "src/components/dashboard/CustomerPortalFrame.tsx",
  "src/components/dashboard/CustomerPortalPageHeader.tsx",
  "src/components/dashboard/CustomerPortalSidebar.tsx",
  "src/components/dashboard/index.tsx",
  "src/components/dashboard/DashboardClient.tsx",
  "src/components/ui/efferd-dashboard-2.tsx",
  "src/lib/homepageLocalization.tsx",
  "src/lib/industry-content.ts",
  "src/lib/renderRootHomepage.tsx",
  "src/lib/serviceIntentGuides.ts",
  "src/lib/workshopGuides.ts",
  "src/lib/email/authLocaleCopy.ts",
  "src/lib/email/localeCopy.ts",
  "src/lib/i18n/tool-client-copy.ts",
] as const;

const extraAuditRoot = process.env.I18N_AUDIT_EXTRA_ROOT?.trim();
const fixtureAuditOnlyRequested = process.env.I18N_AUDIT_FIXTURE_ONLY === "1";
if (fixtureAuditOnlyRequested && !extraAuditRoot) {
  throw new Error(
    "I18N_AUDIT_FIXTURE_ONLY requires a non-empty I18N_AUDIT_EXTRA_ROOT",
  );
}
const fixtureAuditMode = fixtureAuditOnlyRequested && Boolean(extraAuditRoot);
if (fixtureAuditMode && extraAuditRoot && !fs.existsSync(extraAuditRoot)) {
  throw new Error(
    `I18N_AUDIT_EXTRA_ROOT does not exist: ${path.normalize(extraAuditRoot)}`,
  );
}

const customerWorkflowClientSurfaceEntries = Object.entries(
  customerWorkflowClientSurfaceManifest,
) as Array<[CustomerWorkflowClientGroup, CustomerWorkflowClientSurfaceConfig]>;

const customerWorkflowManifestSourceOwners = new Map<
  string,
  CustomerWorkflowClientGroup[]
>();
for (const [group, surface] of customerWorkflowClientSurfaceEntries) {
  for (const file of surface.sourceFiles) {
    const owners = customerWorkflowManifestSourceOwners.get(file) ?? [];
    owners.push(group);
    customerWorkflowManifestSourceOwners.set(file, owners);
  }
}

const customerWorkflowManifestSourceFileSet = new Set(
  customerWorkflowManifestSourceFiles,
);

const customerWorkflowManagedRouteSegmentSet = new Set(
  customerWorkflowManagedRouteSegments,
);

const intentionallyAuthoredAppFiles = [
  "src/app/agb/page.tsx",
  "src/app/av-vertrag/page.tsx",
  "src/app/datenschutz/page.tsx",
  "src/app/impressum/page.tsx",
  "src/app/privacy/page.tsx",
  "src/app/widerruf/page.tsx",
] as const;

// The canonical English File Service hub predates its typed localized route.
// Freeze it byte-for-byte (after line-ending normalization) so no future copy
// or UI change can bypass localization. Do not refresh this fingerprint: first
// migrate the route to a shared typed renderer/catalog, then delete this gate.
const frozenLegacyCustomerFiles = new Map([
  [
    "src/app/file-service/page.tsx",
    "0d6d6dc6aa22ed637aa92ce58911c4e3ce5a76740b76d8b207ca2f43b67c603f",
  ],
]);

const intentionallyAuthoredComponentRoots = [
  "src/components/admin",
  "src/components/legal/LegalPageShell.tsx",
] as const;

const invariantValues = new Set([
  "MG",
  "MG AutoTech",
  "MG AutoTech File Service",
  "| MG AutoTech",
  "© 2026 MG AutoTech.",
  "MG AutoTech • 404",
  "MG AutoTech - Melih Gokkaya",
  "MG AutoTech SaaS",
  "MG AutoTech · ECU · TCU",
  "MG AUTOTECH",
  "AUTOTECH",
  "ECU",
  "ECU:",
  "ECU · TCU",
  "TCU",
  "DTC",
  "ORI",
  "ORI:",
  "MOD",
  "MOD:",
  "IBAN",
  "BIC",
  "VIN",
  "OBD",
  "kW",
  "PS",
  "RPM",
  "2-digit",
  // Intl.NumberFormat signDisplay option; a technical control token, not copy.
  "exceptZero",
  "Bench",
  "BENCH",
  "Boot",
  "BOOT",
  "OBD / Bench / Boot",
  "HW",
  "SW",
  "HW / SW",
  "HP",
  "Nm",
  "HP / Nm Gain",
  "ECU Tuning",
  "Stage 1",
  "Stage 2",
  "Stage 3",
  "Stage 1-3",
  "STAGE 1 · DPF · EGR · ADBLUE · DTC",
  "ECU · TCU · Stage 1 · DPF · EGR · AdBlue · DTC",
  "AdBlue OFF",
  "DPF OFF",
  "DPF / EGR / SCR",
  "DTC OFF",
  "WhatsApp",
  "ETA:",
  "Source #",
  "John Doe",
  "Stuttgart",
  "Böckinger Str. 32",
  "DE...",
  "MG AutoTech AI File Expert",
  "AI File Expert",
  "OBD · Bench · Boot",
  "cr",
  "continue_with",
  "file.mgautotech.de",
  "Alientech",
  "Audi",
  "AutoTuner",
  "Autotuner",
  "BMW",
  "Bosch EDC17",
  "Bosch MD1",
  "Bosch MG1",
  "CMD",
  "Continental SID",
  "Continental SIMOS",
  "Delphi DCM",
  "Denso",
  "DSG",
  "ECM Titanium",
  "Flex",
  "KESS / KTAG",
  "Magic Motorsport",
  "Mercedes 7G",
  "Mercedes 9G",
  "Mercedes-Benz",
  "Muster Tuning GmbH",
  "Opel",
  "Peugeot",
  "Porsche",
  "Renault",
  "Volkswagen",
  "WinOLS",
  "ZF 8HP",
  // Customer-entered examples and product identifiers must stay literal.
  "B57, OM654, EA888...",
  "BMW 530d G30",
  "EDC17, MD1, MG1...",
  "F30 / F31 · 2011 - 2019",
  "G20 / G21 · 2019 ->",
  "P0401, P2002...",
  "example.com",
  "new-domain.com",
  // These are the canonical names of the authored German legal documents.
  "Datenschutz",
  "Impressum",
  "Widerruf",
  // Locale codes intentionally stay literal when they are rendered as codes.
  "en",
  // Vehicle demo values and technical units/formulas intentionally stay
  // literal across locales.
  "3-series",
  "320d",
  "330i",
  "5-series",
  "audi",
  "bmw",
  "car",
  "f30",
  "g20",
  "mercedes",
  "volkswagen",
  "rpm",
  "kW ·",
  "HP = kW × 1.34102",
  "kW = Nm × RPM ÷ 9549",
  "PS = kW × 1.35962",
]);

const invariantPatterns = [
  /^MGA-\d+$/u,
  /^#[A-F0-9-]+$/u,
  /^P\d{4}$/u,
  /^\d+(?:[.,]\d+)?\s*(?:HP|PS|Nm|kW|MB|GB|KB)$/u,
  /^\d+\s+Series$/u,
  /^[A-Za-z0-9.+-]+\s+\d+\s+(?:hp|HP|PS|Nm|kW)$/u,
  /^\p{Extended_Pictographic}+$/u,
  /^https?:\/\//u,
  /^\/[A-Za-z0-9][A-Za-z0-9._~!$&'()*+,;=:@%\-/]*(?:\?[A-Za-z0-9._~!$&'()*+,;=:@%\-/?]*)?(?:#[A-Za-z0-9._~!$&'()*+,;=:@%\-/?]*)?$/u,
  /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/iu,
];

type NonEnglishLocaleCode = Exclude<LocaleCode, "en">;

// A translated target that is byte-for-byte identical to its English source
// is never accepted by inference. Every legitimate technical invariant or
// native-language cognate must be reviewed as an exact source + locale pair.
// The full audit reconciles this list against actual source-identical catalog
// targets so stale exceptions cannot silently accumulate.
const allNonEnglishLocaleCodes = [
  "nl",
  "de",
  "fr",
  "it",
  "ru",
  "es",
  "tr",
  "pt",
  "zh",
  "pl",
  "sq",
] as const satisfies readonly NonEnglishLocaleCode[];

const reviewedLocaleSpecificSourceIdenticalRows: ReadonlyArray<
  readonly [source: string, locales: readonly NonEnglishLocaleCode[]]
> = [
  // International automotive terminology and branded channel names remain
  // unchanged in every supported target locale.
  ["AUTOTECH", allNonEnglishLocaleCodes],
  ["ECU", allNonEnglishLocaleCodes],
  ["ECU / TCU", allNonEnglishLocaleCodes],
  ["Master / Slave", allNonEnglishLocaleCodes],
  ["Stage 3", allNonEnglishLocaleCodes],
  ["TCU Stage 1", allNonEnglishLocaleCodes],
  ["TCU Stage 2", allNonEnglishLocaleCodes],
  ["TCU Stage 3", allNonEnglishLocaleCodes],
  ["WhatsApp", allNonEnglishLocaleCodes],
  ["WhatsApp MG AutoTech", allNonEnglishLocaleCodes],
  ["DPF OFF", ["sq"]],
  ["DTC OFF", ["sq"]],

  // Exact native-language cognates and established product vocabulary. These
  // pairs are intentionally locale-specific; adding a locale requires review.
  ["/ Credit", ["de"]],
  ["17 Credits ×", ["de"]],
  ["Account", ["it", "nl"]],
  ["AGB", ["de"]],
  ["Analyses", ["fr", "nl"]],
  ["Bank", ["de", "nl", "pl"]],
  ["Checksum", ["it"]],
  ["Code", ["de", "fr", "nl"]],
  ["Conflict", ["nl"]],
  ["Contact", ["fr", "nl"]],
  ["Credit", ["de", "nl"]],
  ["credits", ["nl"]],
  ["Credits", ["de", "nl"]],
  ["Credits =", ["de", "nl"]],
  ["Datalog", ["nl", "pl"]],
  ["Date", ["fr"]],
  ["Details", ["de", "nl"]],
  ["E-mail", ["fr", "it", "nl", "pl", "pt", "ru", "sq"]],
  ["ECU / TCU File Service", ["de"]],
  ["FAQ", ["de", "fr", "sq"]],
  ["Generation", ["de"]],
  ["Hard Cut Limiter (Diesel)", ["de"]],
  ["Identification", ["fr"]],
  ["Important", ["fr"]],
  ["Input", ["it"]],
  ["Launch Control", ["it"]],
  ["Login", ["de"]],
  ["Manual", ["es", "pt", "sq"]],
  ["Max", ["it"]],
  ["Message", ["fr"]],
  ["Messages", ["fr"]],
  ["Model", ["nl", "pl", "tr"]],
  ["Module", ["fr", "nl"]],
  ["Notes", ["fr"]],
  ["Notifications", ["fr"]],
  ["Optional", ["de"]],
  ["Password", ["it"]],
  ["per credit", ["nl"]],
  ["Platform", ["nl", "tr"]],
  ["Popular", ["es", "pt"]],
  ["Portal online", ["de", "pl", "pt"]],
  ["Possible", ["fr"]],
  ["Postcode", ["nl"]],
  ["Processor", ["nl"]],
  ["Questions", ["fr"]],
  ["Revision", ["de"]],
  ["Service", ["de", "fr", "nl"]],
  ["Services", ["de", "fr", "nl"]],
  ["Source", ["fr"]],
  ["Support", ["de"]],
  ["Total", ["es", "fr", "pt"]],
  ["Transaction", ["fr"]],
  ["Transactions", ["fr"]],
  ["Transmission", ["fr"]],
  ["Variant", ["nl"]],
];

const reviewedSourceIdenticalRows: ReadonlyArray<
  readonly [source: string, locales: readonly NonEnglishLocaleCode[]]
> = reviewedLocaleSpecificSourceIdenticalRows;

const reviewedSourceIdenticalTargets = new Map<
  string,
  ReadonlySet<NonEnglishLocaleCode>
>();
for (const [source, reviewedLocales] of reviewedSourceIdenticalRows) {
  const locales = new Set(reviewedSourceIdenticalTargets.get(source) ?? []);
  reviewedLocales.forEach((locale) => locales.add(locale));
  reviewedSourceIdenticalTargets.set(source, locales);
}

const sourceIdenticalPairKey = (source: string, locale: NonEnglishLocaleCode) =>
  `${locale}\u0000${source}`;

function isReviewedSourceIdenticalTarget(
  source: string,
  locale: NonEnglishLocaleCode,
) {
  return reviewedSourceIdenticalTargets.get(source)?.has(locale) === true;
}

// These declarations are complete typed locale catalogs, not independent UI
// sources. Direct parity/no-fallback tests cover every field; all other code in
// the same components remains inside this AST audit.
const catalogDeclarationsWithParityTests = new Map<string, ReadonlySet<string>>(
  [
    [
      "src/components/homepage/VehicleIntelligence.tsx",
      new Set(["publicVehicleCopy"]),
    ],
    ["src/components/LanguageSwitcher.tsx", new Set(["selectorCopy"])],
    ["src/lib/email/localeCopy.ts", new Set(["emailLocaleCopy"])],
  ],
);

// Reuse the generator's fail-closed locale-matrix validation. Native catalog
// targets are not new English source copy; sibling declarations remain audited.
for (const entry of customerWorkflowExternallyLocalizedSharedSources) {
  externallyLocalizedSharedSourceExclusions(entry);
  catalogDeclarationsWithParityTests.set(
    entry.file,
    new Set(entry.localeMatrixBindings),
  );
}

// Exact customer-visible imports that carry formatting or raw technical values,
// not translatable prose. Keep this list module-and-export specific: a sibling
// export must be reviewed independently and computed copy must remain blocked.
const reviewedNonCopyVisibleImportDescriptors = new Map<string, string>([
  [
    "@/lib/i18nConfig#intlLocaleByCode",
    "BCP-47 locale identifiers used only to format locale-aware numbers",
  ],
  [
    "@/lib/fileExpert/limits#fileExpertTextLimits",
    "numeric input-length constraints",
  ],
  [
    "@/lib/fileExpert/limits#fileExpertAllowedExtensionsLabel",
    "raw supported filename extensions interpolated into localized copy",
  ],
]);

// These exact exports are typed locale catalogs with dedicated parity and
// no-English-fallback tests. Requiring a resolved initializer prevents this
// exception from masking an opaque function call or a missing/re-exported copy
// source.
const reviewedLocalizedCatalogImportDescriptors = new Map<string, string>([
  [
    "@/components/LocalizedSeoFooter#localizedSeoFooterCopy",
    "covered by tests/server-localized-core-copy.test.ts",
  ],
  [
    "@/lib/i18n/widget-translations#widgetVehicleTypeLabels",
    "complete typed WidgetLanguage catalog checked by the dynamic guard suite",
  ],
]);

type TranslatorContract = {
  readonly skippedArgumentIndexes: ReadonlySet<number>;
  readonly auditedArgumentIndexes: ReadonlySet<number>;
  readonly skippedArgumentPaths: ReadonlySet<string>;
  readonly auditedArgumentPaths: ReadonlySet<string>;
};

type TranslatorArgumentPathSegment = string | number;
const translatorArgumentPathKey = (
  argumentIndex: number,
  path: readonly TranslatorArgumentPathSegment[],
) => JSON.stringify([argumentIndex, ...path]);

const exactSourceTranslatorContract: TranslatorContract = {
  skippedArgumentIndexes: new Set(),
  auditedArgumentIndexes: new Set([1]),
  skippedArgumentPaths: new Set(),
  auditedArgumentPaths: new Set([translatorArgumentPathKey(1, [])]),
};
const typedKeyTranslatorContract: TranslatorContract = {
  skippedArgumentIndexes: new Set([1]),
  auditedArgumentIndexes: new Set([2]),
  skippedArgumentPaths: new Set([translatorArgumentPathKey(1, [])]),
  auditedArgumentPaths: new Set([translatorArgumentPathKey(2, [])]),
};
const widgetExactTranslatorContract: TranslatorContract = {
  skippedArgumentIndexes: new Set([2]),
  auditedArgumentIndexes: new Set([1]),
  skippedArgumentPaths: new Set([translatorArgumentPathKey(2, [])]),
  auditedArgumentPaths: new Set([translatorArgumentPathKey(1, [])]),
};
const localizedMessageDescriptorContract: TranslatorContract = {
  skippedArgumentIndexes: new Set([1]),
  auditedArgumentIndexes: new Set([1]),
  skippedArgumentPaths: new Set([
    translatorArgumentPathKey(1, ["key"]),
    translatorArgumentPathKey(1, ["kind"]),
  ]),
  auditedArgumentPaths: new Set([translatorArgumentPathKey(1, [])]),
};

const exactAndKeyTranslatorExports = new Map<string, TranslatorContract>([
  ["customerWorkflowExactT", exactSourceTranslatorContract],
  ["customerWorkflowT", typedKeyTranslatorContract],
]);

// Translator trust is an exact module/export contract. A familiar export name
// from a new or fake module is deliberately untrusted. Exact-source functions
// do not skip their English source argument, and typed-key functions skip only
// the declared key position; interpolation values remain inside the copy audit.
const reviewedTranslatorExportsByModule = new Map<
  string,
  ReadonlyMap<string, TranslatorContract>
>([
  [
    "@/lib/i18n/auth-page-first-paint",
    new Map([["authPageFirstPaintT", exactSourceTranslatorContract]]),
  ],
  [
    "@/lib/i18n/customer-auth-feedback",
    new Map([["customerAuthFeedbackT", localizedMessageDescriptorContract]]),
  ],
  [
    "@/lib/i18n/customer-portal-first-paint",
    new Map([["customerPortalFirstPaintT", exactSourceTranslatorContract]]),
  ],
  [
    "@/lib/i18n/customer-runtime-translations",
    new Map([["customerRuntimeExactT", exactSourceTranslatorContract]]),
  ],
  [
    "@/lib/i18n/customer-workflow-auth-translations",
    exactAndKeyTranslatorExports,
  ],
  [
    "@/lib/i18n/customer-workflow-credits-translations",
    exactAndKeyTranslatorExports,
  ],
  [
    "@/lib/i18n/customer-workflow-file-expert-translations",
    exactAndKeyTranslatorExports,
  ],
  [
    "@/lib/i18n/customer-workflow-orders-translations",
    exactAndKeyTranslatorExports,
  ],
  [
    "@/lib/i18n/customer-workflow-overview-translations",
    exactAndKeyTranslatorExports,
  ],
  [
    "@/lib/i18n/customer-workflow-request-translations",
    exactAndKeyTranslatorExports,
  ],
  [
    "@/lib/i18n/customer-workflow-security-translations",
    exactAndKeyTranslatorExports,
  ],
  [
    "@/lib/i18n/dtc-analyzer-translations",
    new Map([
      ["localizeDtcAnalyzerMessage", localizedMessageDescriptorContract],
      ["localizeDtcConfidence", typedKeyTranslatorContract],
    ]),
  ],
  [
    "@/lib/i18n/file-expert-report-translations",
    new Map([["fileExpertReportT", typedKeyTranslatorContract]]),
  ],
  [
    "@/lib/i18n/log-analysis-studio-translations",
    new Map([
      ["logStudioAnalysisErrorT", exactSourceTranslatorContract],
      ["logStudioChannelKindT", typedKeyTranslatorContract],
      ["logStudioMessageT", exactSourceTranslatorContract],
      ["logStudioQualityT", typedKeyTranslatorContract],
      ["logStudioT", typedKeyTranslatorContract],
    ]),
  ],
  [
    "@/lib/i18n/public-surface-types",
    new Map([["publicSurfaceExactT", exactSourceTranslatorContract]]),
  ],
  [
    "@/lib/i18n/runtime-public",
    new Map([["runtimePublicT", exactSourceTranslatorContract]]),
  ],
  [
    "@/lib/i18n/widget-site-translations",
    new Map([
      ["translateWidgetSiteExact", widgetExactTranslatorContract],
      ["widgetSiteT", typedKeyTranslatorContract],
    ]),
  ],
  [
    "@/lib/i18n/widget-translations",
    new Map([["widgetT", typedKeyTranslatorContract]]),
  ],
]);

const legacyTransliterationPatterns: Partial<
  Record<Exclude<LocaleCode, "en">, RegExp>
> = {
  de: /\b(?:fuer|ueber|zurueck|oeffnen|pruefen|waehlen|koennen|muessen)\b/iu,
  tr: /\b(?:musteri|guvenli|sifre|ulke|odeme|yukle|dogrula|islem|baslat|olustur)\b/iu,
  fr: /\b(?:securise|verification|selectionnez|telecharger|donnees)\b/iu,
  es: /\b(?:verificacion|sesion|numero|telefono|seleccion)\b/iu,
  pt: /\b(?:verificacao|sessao|numero|selecao|informacao)\b/iu,
  sq: /\b(?:dhenat|kerkohet|perdor|llogarise|permbledhja)\b/iu,
};

function walkSourceFiles(directory: string, files: Set<string>) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) walkSourceFiles(filePath, files);
    else if (/\.(?:js|jsx|ts|tsx)$/u.test(entry.name)) files.add(filePath);
  }
}

function sourceScriptKind(file: string) {
  const extension = path.extname(file).toLowerCase();
  if (extension === ".tsx") return ts.ScriptKind.TSX;
  if (extension === ".js" || extension === ".jsx") return ts.ScriptKind.JSX;
  return ts.ScriptKind.TS;
}

function collectVisibleStrings() {
  const files = new Set<string>();
  const strings = new Set<string>();
  const sourceFilesByValue = new Map<string, Set<string>>();
  const broadNoTranslateFiles = new Set<string>();
  const dynamicVisibleExpressions: DynamicVisibleExpression[] = [];

  const broadNoTranslateTags = new Set([
    "article",
    "aside",
    "footer",
    "form",
    "header",
    "main",
    "nav",
    "section",
  ]);
  const exactOwnedNoTranslateSurfaces = new Map([
    [
      "src/components/widget/PublicVehicleSelector.tsx",
      new Set(["widget-site"]),
    ],
  ]);
  const jsxAttribute = (attributes: ts.JsxAttributes, name: string) =>
    attributes.properties.find(
      (property): property is ts.JsxAttribute =>
        ts.isJsxAttribute(property) && property.name.getText() === name,
    ) ?? null;
  const staticJsxAttributeValue = (attribute: ts.JsxAttribute | null) => {
    if (!attribute?.initializer) return attribute ? "true" : null;
    if (ts.isStringLiteral(attribute.initializer))
      return attribute.initializer.text;
    if (
      ts.isJsxExpression(attribute.initializer) &&
      attribute.initializer.expression &&
      (ts.isStringLiteral(attribute.initializer.expression) ||
        ts.isNoSubstitutionTemplateLiteral(attribute.initializer.expression))
    ) {
      return attribute.initializer.expression.text;
    }
    return null;
  };
  const containsNestedJsx = (element: ts.JsxElement) => {
    let nested = false;
    const visit = (node: ts.Node) => {
      if (
        ts.isJsxElement(node) ||
        ts.isJsxSelfClosingElement(node) ||
        ts.isJsxFragment(node)
      ) {
        nested = true;
        return;
      }
      ts.forEachChild(node, visit);
    };
    element.children.forEach(visit);
    return nested;
  };
  const collectBroadNoTranslateBoundaries = (
    source: ts.SourceFile,
    file: string,
  ) => {
    const projectFile = path
      .relative(process.cwd(), file)
      .replaceAll("\\", "/");
    const allowedOwners = exactOwnedNoTranslateSurfaces.get(projectFile);
    const visit = (node: ts.Node) => {
      if (ts.isJsxElement(node)) {
        const opening = node.openingElement;
        const noTranslate = jsxAttribute(
          opening.attributes,
          "data-no-translate",
        );
        const owner = staticJsxAttributeValue(
          jsxAttribute(opening.attributes, "data-i18n-owned-surface"),
        );
        const tag = opening.tagName.getText(source).toLowerCase();
        const broad =
          Boolean(noTranslate) &&
          (broadNoTranslateTags.has(tag) || containsNestedJsx(node));
        const exactOwner = owner !== null && allowedOwners?.has(owner) === true;
        if ((broad && !exactOwner) || (owner !== null && !exactOwner)) {
          broadNoTranslateFiles.add(projectFile);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  };

  const unresolvedVisibleImports = new Set<string>();
  const exportedInitializersByFile = new Map<
    string,
    ReadonlyMap<string, ts.Expression>
  >();
  const portableStaticExpression = (expression: ts.Expression): boolean => {
    let current = expression;
    while (
      ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isTypeAssertionExpression(current) ||
      ts.isNonNullExpression(current) ||
      ts.isSatisfiesExpression(current)
    ) {
      current = current.expression;
    }
    if (
      ts.isStringLiteral(current) ||
      ts.isNoSubstitutionTemplateLiteral(current) ||
      ts.isNumericLiteral(current) ||
      current.kind === ts.SyntaxKind.TrueKeyword ||
      current.kind === ts.SyntaxKind.FalseKeyword ||
      current.kind === ts.SyntaxKind.NullKeyword
    ) {
      return true;
    }
    if (ts.isArrayLiteralExpression(current)) {
      return current.elements.every(
        (element) =>
          !ts.isSpreadElement(element) &&
          !ts.isOmittedExpression(element) &&
          portableStaticExpression(element),
      );
    }
    if (ts.isObjectLiteralExpression(current)) {
      return current.properties.every(
        (property) =>
          ts.isPropertyAssignment(property) &&
          portableStaticExpression(property.initializer),
      );
    }
    if (ts.isConditionalExpression(current)) {
      return (
        portableStaticExpression(current.condition) &&
        portableStaticExpression(current.whenTrue) &&
        portableStaticExpression(current.whenFalse)
      );
    }
    return (
      ts.isBinaryExpression(current) &&
      [
        ts.SyntaxKind.PlusToken,
        ts.SyntaxKind.AmpersandAmpersandToken,
        ts.SyntaxKind.BarBarToken,
        ts.SyntaxKind.QuestionQuestionToken,
      ].includes(current.operatorToken.kind) &&
      portableStaticExpression(current.left) &&
      portableStaticExpression(current.right)
    );
  };

  const resolveLocalModuleFile = (importer: string, specifier: string) => {
    const base = specifier.startsWith("@/")
      ? path.resolve(process.cwd(), "src", specifier.slice(2))
      : specifier.startsWith(".")
        ? path.resolve(path.dirname(importer), specifier)
        : null;
    if (!base) return null;
    const candidates = path.extname(base)
      ? [base]
      : [
          ...[".ts", ".tsx", ".js", ".jsx"].map(
            (extension) => `${base}${extension}`,
          ),
          ...[".ts", ".tsx", ".js", ".jsx"].map((extension) =>
            path.join(base, `index${extension}`),
          ),
        ];
    return (
      candidates.find(
        (candidate) =>
          fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
      ) ?? null
    );
  };

  const exportedInitializersForFile = (moduleFile: string) => {
    const normalized = path.normalize(moduleFile);
    const cached = exportedInitializersByFile.get(normalized);
    if (cached) return cached;
    const moduleText = fs.readFileSync(normalized, "utf8");
    const moduleSource = ts.createSourceFile(
      normalized,
      moduleText,
      ts.ScriptTarget.Latest,
      true,
      sourceScriptKind(normalized),
    );
    const initializers = new Map<string, ts.Expression>();
    for (const statement of moduleSource.statements) {
      const exported =
        ts.canHaveModifiers(statement) &&
        ts
          .getModifiers(statement)
          ?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
      if (exported && ts.isVariableStatement(statement)) {
        statement.declarationList.declarations.forEach((declaration) => {
          if (
            ts.isIdentifier(declaration.name) &&
            declaration.initializer &&
            portableStaticExpression(declaration.initializer)
          ) {
            initializers.set(declaration.name.text, declaration.initializer);
          }
        });
      }
      if (
        ts.isExportAssignment(statement) &&
        !statement.isExportEquals &&
        portableStaticExpression(statement.expression)
      ) {
        initializers.set("default", statement.expression);
      }
    }
    exportedInitializersByFile.set(normalized, initializers);
    return initializers;
  };

  // Synthetic adversarial fixtures use the exact same parser and copy-flow
  // analysis without paying for another repository-wide scan. The explicit
  // fixture flag is intentionally insufficient on its own, while every normal
  // invocation (including Production prebuild) keeps the complete fail-closed
  // roots. Supplying an extra root without the fixture flag preserves the old
  // full-repository-plus-extra behavior.
  const auditRoots =
    fixtureAuditMode && extraAuditRoot
      ? [path.normalize(extraAuditRoot)]
      : customerWorkflowAuditRoots(customerSurfaceRoots, extraAuditRoot);

  for (const root of auditRoots) {
    if (!fs.existsSync(root)) continue;
    if (fs.statSync(root).isDirectory()) walkSourceFiles(root, files);
    else files.add(path.normalize(root));
  }

  for (const file of files) {
    const sourceText = fs.readFileSync(file, "utf8");
    const source = ts.createSourceFile(
      file,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      sourceScriptKind(file),
    );
    collectBroadNoTranslateBoundaries(source, file);
    const relativeImportInitializers = new Map<string, ts.Expression>();
    const relativeImportDescriptors = new Map<string, string>();
    const exactExternalImportDescriptors = new Map<string, string>();
    for (const statement of source.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier) ||
        statement.moduleSpecifier.text !== "react" ||
        statement.importClause?.isTypeOnly
      ) {
        continue;
      }
      const importClause = statement.importClause;
      if (!importClause) continue;
      if (importClause.name) {
        exactExternalImportDescriptors.set(importClause.name.text, "react");
      }
      if (
        importClause.namedBindings &&
        ts.isNamedImports(importClause.namedBindings)
      ) {
        importClause.namedBindings.elements.forEach((binding) => {
          if (binding.isTypeOnly) return;
          exactExternalImportDescriptors.set(
            binding.name.text,
            `react.${binding.propertyName?.text ?? binding.name.text}`,
          );
        });
      } else if (
        importClause.namedBindings &&
        ts.isNamespaceImport(importClause.namedBindings)
      ) {
        exactExternalImportDescriptors.set(
          importClause.namedBindings.name.text,
          "react",
        );
      }
    }
    for (const statement of source.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier) ||
        (!statement.moduleSpecifier.text.startsWith(".") &&
          !statement.moduleSpecifier.text.startsWith("@/")) ||
        statement.importClause?.isTypeOnly
      ) {
        continue;
      }
      const moduleName = statement.moduleSpecifier.text;
      const moduleFile = resolveLocalModuleFile(file, moduleName);
      const exported = moduleFile
        ? exportedInitializersForFile(moduleFile)
        : new Map<string, ts.Expression>();
      const importClause = statement.importClause;
      if (!importClause) continue;
      if (importClause.name) {
        relativeImportDescriptors.set(
          importClause.name.text,
          `${moduleName}#default`,
        );
        const initializer = exported.get("default");
        if (initializer) {
          relativeImportInitializers.set(importClause.name.text, initializer);
        }
      }
      if (
        importClause.namedBindings &&
        ts.isNamedImports(importClause.namedBindings)
      ) {
        importClause.namedBindings.elements.forEach((binding) => {
          if (binding.isTypeOnly) return;
          const importedName = binding.propertyName?.text ?? binding.name.text;
          relativeImportDescriptors.set(
            binding.name.text,
            `${moduleName}#${importedName}`,
          );
          const initializer = exported.get(importedName);
          if (initializer) {
            relativeImportInitializers.set(binding.name.text, initializer);
          }
        });
      } else if (
        importClause.namedBindings &&
        ts.isNamespaceImport(importClause.namedBindings)
      ) {
        relativeImportDescriptors.set(
          importClause.namedBindings.name.text,
          `${moduleName}#*`,
        );
      }
    }

    const reviewedTranslatorBindings = new Map<string, TranslatorContract>();
    for (const statement of source.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier)
      ) {
        continue;
      }
      const moduleName = statement.moduleSpecifier.text;
      const reviewedExports = reviewedTranslatorExportsByModule.get(moduleName);
      const bindings = statement.importClause?.namedBindings;
      if (!reviewedExports || !bindings || !ts.isNamedImports(bindings)) {
        continue;
      }
      for (const binding of bindings.elements) {
        const importedName = binding.propertyName?.text ?? binding.name.text;
        const contract = reviewedExports.get(importedName);
        if (contract) {
          reviewedTranslatorBindings.set(binding.name.text, contract);
        }
      }
    }

    const authenticImportedTranslatorBindings = new Map(
      reviewedTranslatorBindings,
    );
    const localBindingCounts = new Map<string, number>();
    const registerLocalBinding = (name: string) => {
      localBindingCounts.set(name, (localBindingCounts.get(name) ?? 0) + 1);
    };
    const collectBindingIdentifiers = (name: ts.BindingName) => {
      if (ts.isIdentifier(name)) {
        registerLocalBinding(name.text);
        return;
      }
      name.elements.forEach((element) => {
        if (ts.isBindingElement(element)) {
          collectBindingIdentifiers(element.name);
        }
      });
    };
    const collectLocalBindingCounts = (node: ts.Node) => {
      if (ts.isImportDeclaration(node)) return;
      if (ts.isVariableDeclaration(node)) {
        collectBindingIdentifiers(node.name);
      } else if (
        (ts.isFunctionDeclaration(node) ||
          ts.isClassDeclaration(node) ||
          ts.isFunctionExpression(node) ||
          ts.isClassExpression(node)) &&
        node.name &&
        ts.isIdentifier(node.name)
      ) {
        registerLocalBinding(node.name.text);
      }
      ts.forEachChild(node, collectLocalBindingCounts);
    };
    collectLocalBindingCounts(source);

    const unwrapExpression = (expression: ts.Expression): ts.Expression => {
      let current = expression;
      while (
        ts.isParenthesizedExpression(current) ||
        ts.isAsExpression(current) ||
        ts.isTypeAssertionExpression(current) ||
        ts.isNonNullExpression(current) ||
        ts.isSatisfiesExpression(current) ||
        ts.isAwaitExpression(current) ||
        (ts.isBinaryExpression(current) &&
          current.operatorToken.kind === ts.SyntaxKind.CommaToken &&
          (ts.isNumericLiteral(unwrapExpression(current.left)) ||
            ts.isStringLiteral(unwrapExpression(current.left))))
      ) {
        if (ts.isBinaryExpression(current)) {
          current = current.right;
        } else {
          current = current.expression;
        }
      }
      return current;
    };
    const returnedCallFromFunction = (
      node: ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration,
    ) => {
      if (!node.body) return null;
      if (!ts.isBlock(node.body)) {
        const expression = unwrapExpression(node.body);
        return ts.isCallExpression(expression) ? expression : null;
      }
      if (node.body.statements.length !== 1) return null;
      const statement = node.body.statements[0];
      if (!ts.isReturnStatement(statement) || !statement.expression)
        return null;
      const expression = unwrapExpression(statement.expression);
      return ts.isCallExpression(expression) ? expression : null;
    };
    const wrapperCandidates: Array<{
      name: string;
      functionNode:
        ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration;
      immutable: boolean;
    }> = [];
    const reassignedLocalBindings = new Set<string>();
    const variableDeclarationIsConst = (node: ts.VariableDeclaration) =>
      ts.isVariableDeclarationList(node.parent) &&
      (node.parent.flags & ts.NodeFlags.Const) !== 0;
    const collectTranslatorWrappers = (node: ts.Node) => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer &&
        (ts.isArrowFunction(node.initializer) ||
          ts.isFunctionExpression(node.initializer))
      ) {
        wrapperCandidates.push({
          name: node.name.text,
          functionNode: node.initializer,
          immutable: variableDeclarationIsConst(node),
        });
      } else if (ts.isFunctionDeclaration(node) && node.name) {
        wrapperCandidates.push({
          name: node.name.text,
          functionNode: node,
          immutable: true,
        });
      } else if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
        node.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
        ts.isIdentifier(node.left)
      ) {
        reassignedLocalBindings.add(node.left.text);
      } else if (
        (ts.isPrefixUnaryExpression(node) ||
          ts.isPostfixUnaryExpression(node)) &&
        (node.operator === ts.SyntaxKind.PlusPlusToken ||
          node.operator === ts.SyntaxKind.MinusMinusToken) &&
        ts.isIdentifier(node.operand)
      ) {
        reassignedLocalBindings.add(node.operand.text);
      }
      ts.forEachChild(node, collectTranslatorWrappers);
    };
    collectTranslatorWrappers(source);

    const bindingNameContains = (
      name: ts.BindingName,
      expected: string,
    ): boolean =>
      ts.isIdentifier(name)
        ? name.text === expected
        : name.elements.some(
            (element) =>
              ts.isBindingElement(element) &&
              bindingNameContains(element.name, expected),
          );
    const isShadowedByEnclosingParameterOrCatch = (
      node: ts.Node,
      name: string,
    ) => {
      let current = node.parent;
      while (current && !ts.isSourceFile(current)) {
        if (
          ts.isFunctionLike(current) &&
          current.parameters.some((parameter) =>
            bindingNameContains(parameter.name, name),
          )
        ) {
          return true;
        }
        if (
          ts.isCatchClause(current) &&
          current.variableDeclaration &&
          bindingNameContains(current.variableDeclaration.name, name)
        ) {
          return true;
        }
        if (
          ((ts.isFunctionExpression(current) && current.name) ||
            (ts.isClassExpression(current) && current.name)) &&
          current.name?.text === name
        ) {
          return true;
        }
        current = current.parent;
      }
      return false;
    };
    const variableDeclarationListContains = (
      declarationList: ts.VariableDeclarationList,
      name: string,
    ) =>
      declarationList.declarations.some((declaration) =>
        bindingNameContains(declaration.name, name),
      );
    const statementDirectlyDeclaresName = (
      statement: ts.Statement,
      name: string,
    ) => {
      if (ts.isVariableStatement(statement)) {
        return variableDeclarationListContains(statement.declarationList, name);
      }
      return (
        (ts.isFunctionDeclaration(statement) ||
          ts.isClassDeclaration(statement) ||
          ts.isEnumDeclaration(statement)) &&
        statement.name?.text === name
      );
    };
    const functionBodyHasVarBinding = (
      functionNode: ts.SignatureDeclaration,
      name: string,
    ) => {
      const body = (functionNode as ts.FunctionLikeDeclaration).body;
      if (!body) return false;
      let found = false;
      const visit = (current: ts.Node) => {
        if (found) return;
        if (
          current !== body &&
          (ts.isFunctionLike(current) ||
            ts.isClassDeclaration(current) ||
            ts.isClassExpression(current))
        ) {
          return;
        }
        if (
          ts.isVariableDeclarationList(current) &&
          (current.flags & ts.NodeFlags.BlockScoped) === 0 &&
          variableDeclarationListContains(current, name)
        ) {
          found = true;
          return;
        }
        ts.forEachChild(current, visit);
      };
      visit(body);
      return found;
    };
    const lexicalScopeDirectlyDeclaresName = (scope: ts.Node, name: string) => {
      if (
        ts.isFunctionLike(scope) &&
        (scope.parameters.some((parameter) =>
          bindingNameContains(parameter.name, name),
        ) ||
          functionBodyHasVarBinding(scope, name))
      ) {
        return true;
      }
      if (
        ((ts.isFunctionExpression(scope) && scope.name) ||
          (ts.isClassExpression(scope) && scope.name)) &&
        scope.name?.text === name
      ) {
        return true;
      }
      if (
        ts.isCatchClause(scope) &&
        scope.variableDeclaration &&
        bindingNameContains(scope.variableDeclaration.name, name)
      ) {
        return true;
      }
      if (
        ts.isBlock(scope) &&
        scope.statements.some((statement) =>
          statementDirectlyDeclaresName(statement, name),
        )
      ) {
        return true;
      }
      if (
        ts.isCaseBlock(scope) &&
        scope.clauses.some((clause) =>
          clause.statements.some((statement) =>
            statementDirectlyDeclaresName(statement, name),
          ),
        )
      ) {
        return true;
      }
      if (
        ts.isForStatement(scope) &&
        scope.initializer &&
        ts.isVariableDeclarationList(scope.initializer) &&
        variableDeclarationListContains(scope.initializer, name)
      ) {
        return true;
      }
      if (
        (ts.isForInStatement(scope) || ts.isForOfStatement(scope)) &&
        ts.isVariableDeclarationList(scope.initializer) &&
        variableDeclarationListContains(scope.initializer, name)
      ) {
        return true;
      }
      return false;
    };
    const isAuthenticTranslatorImportShadowedAtNode = (
      node: ts.Node,
      name: string,
    ) => {
      let current = node.parent;
      while (current && !ts.isSourceFile(current)) {
        if (lexicalScopeDirectlyDeclaresName(current, name)) return true;
        current = current.parent;
      }
      return false;
    };
    const approvedLocalTranslatorContracts = new Map<
      string,
      TranslatorContract[]
    >();
    const approveLocalTranslatorBinding = (
      name: string,
      contract: TranslatorContract,
    ) => {
      const contracts = approvedLocalTranslatorContracts.get(name) ?? [];
      contracts.push(contract);
      approvedLocalTranslatorContracts.set(name, contracts);
    };
    const contractsMatch = (
      left: TranslatorContract,
      right: TranslatorContract,
    ) =>
      left.skippedArgumentIndexes.size === right.skippedArgumentIndexes.size &&
      [...left.skippedArgumentIndexes].every((index) =>
        right.skippedArgumentIndexes.has(index),
      ) &&
      left.auditedArgumentIndexes.size === right.auditedArgumentIndexes.size &&
      [...left.auditedArgumentIndexes].every((index) =>
        right.auditedArgumentIndexes.has(index),
      ) &&
      left.skippedArgumentPaths.size === right.skippedArgumentPaths.size &&
      [...left.skippedArgumentPaths].every((path) =>
        right.skippedArgumentPaths.has(path),
      ) &&
      left.auditedArgumentPaths.size === right.auditedArgumentPaths.size &&
      [...left.auditedArgumentPaths].every((path) =>
        right.auditedArgumentPaths.has(path),
      );
    const auditedWrapperDefaultExpressions: ts.Expression[] = [];
    const deriveForwardedTranslatorContract = (
      functionNode:
        ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration,
      returnedCall: ts.CallExpression,
      calleeContract: TranslatorContract,
    ): TranslatorContract => {
      type ParameterReference = {
        readonly parameterIndex: number;
        readonly callArgumentIndex: number;
        readonly isRest: boolean;
        readonly parameterPath: readonly TranslatorArgumentPathSegment[];
      };
      const parameterReferenceByName = new Map<string, ParameterReference>();
      const registerParameterBindings = (
        name: ts.BindingName,
        parameterIndex: number,
        isRest: boolean,
        parameterPath: readonly TranslatorArgumentPathSegment[] = [],
      ) => {
        if (ts.isIdentifier(name)) {
          parameterReferenceByName.set(name.text, {
            parameterIndex,
            callArgumentIndex: parameterIndex,
            isRest,
            parameterPath,
          });
          return;
        }
        name.elements.forEach((element, elementIndex) => {
          if (!ts.isBindingElement(element)) return;
          if (element.dotDotDotToken) {
            registerParameterBindings(
              element.name,
              parameterIndex,
              isRest,
              parameterPath,
            );
            return;
          }
          let segment: TranslatorArgumentPathSegment | null = null;
          if (ts.isArrayBindingPattern(name)) {
            segment = elementIndex;
          } else if (
            element.propertyName &&
            (ts.isIdentifier(element.propertyName) ||
              ts.isStringLiteral(element.propertyName) ||
              ts.isNumericLiteral(element.propertyName))
          ) {
            segment = ts.isNumericLiteral(element.propertyName)
              ? Number(element.propertyName.text)
              : element.propertyName.text;
          } else if (ts.isIdentifier(element.name)) {
            segment = element.name.text;
          }
          registerParameterBindings(
            element.name,
            parameterIndex,
            isRest,
            segment === null ? parameterPath : [...parameterPath, segment],
          );
        });
      };
      functionNode.parameters.forEach((parameter, index) =>
        registerParameterBindings(
          parameter.name,
          index,
          Boolean(parameter.dotDotDotToken),
        ),
      );

      const directParameterReference = (
        expression: ts.Expression,
      ): ParameterReference | null => {
        const current = unwrapExpression(expression);
        if (ts.isIdentifier(current)) {
          return parameterReferenceByName.get(current.text) ?? null;
        }
        if (
          ts.isElementAccessExpression(current) &&
          current.argumentExpression &&
          (ts.isNumericLiteral(current.argumentExpression) ||
            ts.isStringLiteral(current.argumentExpression))
        ) {
          const reference = directParameterReference(current.expression);
          const offset = ts.isNumericLiteral(current.argumentExpression)
            ? Number(current.argumentExpression.text)
            : null;
          if (
            reference?.isRest &&
            offset !== null &&
            Number.isInteger(offset) &&
            offset >= 0
          ) {
            return {
              ...reference,
              callArgumentIndex: reference.parameterIndex + offset,
              parameterPath: [],
            };
          }
          if (reference) {
            const segment =
              offset === null ? current.argumentExpression.text : offset;
            return {
              ...reference,
              parameterPath: [...reference.parameterPath, segment],
            };
          }
        }
        if (ts.isPropertyAccessExpression(current)) {
          const reference = directParameterReference(current.expression);
          if (reference) {
            return {
              ...reference,
              parameterPath: [...reference.parameterPath, current.name.text],
            };
          }
        }
        return null;
      };

      const argumentForEffectiveIndex = (targetIndex: number) => {
        let effectiveIndex = 0;
        for (const argument of returnedCall.arguments) {
          if (ts.isSpreadElement(argument)) {
            const reference = directParameterReference(argument.expression);
            if (reference?.isRest && targetIndex >= effectiveIndex) {
              return {
                expression: null,
                reference: {
                  ...reference,
                  callArgumentIndex:
                    reference.parameterIndex + (targetIndex - effectiveIndex),
                },
              };
            }
            return null;
          }
          if (effectiveIndex === targetIndex) {
            return { expression: argument, reference: null };
          }
          effectiveIndex += 1;
        }
        return null;
      };

      const forwardedArgumentInfo = (
        calleeArgumentIndexes: ReadonlySet<number>,
        followNestedReferences: boolean,
      ) => {
        const callArgumentIndexes = new Set<number>();
        const callArgumentPaths = new Set<string>();
        const referencedParameterIndexes = new Set<number>();
        const addReference = (reference: ParameterReference) => {
          callArgumentIndexes.add(reference.callArgumentIndex);
          callArgumentPaths.add(
            translatorArgumentPathKey(
              reference.callArgumentIndex,
              reference.parameterPath,
            ),
          );
          referencedParameterIndexes.add(reference.parameterIndex);
        };
        const isValueReference = (identifier: ts.Identifier) => {
          const parent = identifier.parent;
          if (
            ts.isPropertyAccessExpression(parent) &&
            parent.name === identifier
          ) {
            return false;
          }
          if (
            ts.isPropertyAssignment(parent) &&
            parent.name === identifier &&
            parent.initializer !== identifier
          ) {
            return false;
          }
          return true;
        };
        const collectNestedParameterReferences = (node: ts.Node) => {
          if (ts.isTypeNode(node)) return;
          if (
            ts.isElementAccessExpression(node) ||
            ts.isPropertyAccessExpression(node)
          ) {
            const isMethodTarget =
              ts.isCallExpression(node.parent) &&
              node.parent.expression === node;
            const reference = directParameterReference(
              isMethodTarget ? node.expression : node,
            );
            if (reference) {
              addReference(reference);
              return;
            }
          }
          if (ts.isIdentifier(node) && isValueReference(node)) {
            const reference = parameterReferenceByName.get(node.text);
            if (reference) addReference(reference);
          }
          ts.forEachChild(node, collectNestedParameterReferences);
        };
        for (const calleeArgumentIndex of calleeArgumentIndexes) {
          const effectiveArgument =
            argumentForEffectiveIndex(calleeArgumentIndex);
          if (!effectiveArgument) continue;
          if (effectiveArgument.reference) {
            addReference(effectiveArgument.reference);
            continue;
          }
          const argument = effectiveArgument.expression;
          if (!argument) continue;
          if (followNestedReferences) {
            collectNestedParameterReferences(argument);
            continue;
          }
          const reference = directParameterReference(argument);
          if (reference) addReference(reference);
        }
        return {
          callArgumentIndexes,
          callArgumentPaths,
          referencedParameterIndexes,
        };
      };

      const skipped = forwardedArgumentInfo(
        calleeContract.skippedArgumentIndexes,
        false,
      );
      const transformedSkipped = forwardedArgumentInfo(
        calleeContract.skippedArgumentIndexes,
        true,
      );
      const audited = forwardedArgumentInfo(
        calleeContract.auditedArgumentIndexes,
        true,
      );
      const refineDirectParameterPaths = (
        info: ReturnType<typeof forwardedArgumentInfo>,
        contractPaths: ReadonlySet<string>,
      ) => {
        const pathsByArgument = new Map<
          number,
          TranslatorArgumentPathSegment[][]
        >();
        contractPaths.forEach((encodedPath) => {
          const [argumentIndex, ...path] = JSON.parse(encodedPath) as [
            number,
            ...TranslatorArgumentPathSegment[],
          ];
          const paths = pathsByArgument.get(argumentIndex) ?? [];
          paths.push(path);
          pathsByArgument.set(argumentIndex, paths);
        });
        pathsByArgument.forEach((paths, calleeArgumentIndex) => {
          const effectiveArgument =
            argumentForEffectiveIndex(calleeArgumentIndex);
          const reference =
            effectiveArgument?.reference ??
            (effectiveArgument?.expression
              ? directParameterReference(effectiveArgument.expression)
              : null);
          if (!reference) return;
          const basePathKey = translatorArgumentPathKey(
            reference.callArgumentIndex,
            reference.parameterPath,
          );
          if (!paths.some((path) => path.length === 0)) {
            info.callArgumentPaths.delete(basePathKey);
          }
          paths.forEach((path) => {
            info.callArgumentPaths.add(
              translatorArgumentPathKey(reference.callArgumentIndex, [
                ...reference.parameterPath,
                ...path,
              ]),
            );
          });
        });
      };
      refineDirectParameterPaths(skipped, calleeContract.skippedArgumentPaths);
      refineDirectParameterPaths(audited, calleeContract.auditedArgumentPaths);
      transformedSkipped.callArgumentPaths.forEach((path) => {
        const [argumentIndex] = JSON.parse(path) as [number];
        if (
          skipped.callArgumentIndexes.has(argumentIndex) ||
          skipped.callArgumentPaths.has(path)
        ) {
          return;
        }
        audited.callArgumentPaths.add(path);
      });
      transformedSkipped.callArgumentIndexes.forEach((argumentIndex) => {
        if (skipped.callArgumentIndexes.has(argumentIndex)) return;
        if (
          [...audited.callArgumentPaths].some((path) =>
            path.startsWith(`[${argumentIndex},`),
          ) ||
          audited.callArgumentPaths.has(
            translatorArgumentPathKey(argumentIndex, []),
          )
        ) {
          audited.callArgumentIndexes.add(argumentIndex);
        }
      });
      audited.referencedParameterIndexes.forEach((parameterIndex) => {
        const initializer =
          functionNode.parameters[parameterIndex]?.initializer;
        if (initializer) auditedWrapperDefaultExpressions.push(initializer);
      });
      return {
        skippedArgumentIndexes: skipped.callArgumentIndexes,
        auditedArgumentIndexes: audited.callArgumentIndexes,
        skippedArgumentPaths: skipped.callArgumentPaths,
        auditedArgumentPaths: audited.callArgumentPaths,
      };
    };

    // A local convenience wrapper is trusted only when its entire return value
    // is a call to an authentic imported translator binding.
    for (const { name, functionNode, immutable } of wrapperCandidates) {
      if (!immutable || reassignedLocalBindings.has(name)) continue;
      const returnedCall = returnedCallFromFunction(functionNode);
      if (!returnedCall || !ts.isIdentifier(returnedCall.expression)) continue;
      const calleeName = returnedCall.expression.text;
      const calleeContract = reviewedTranslatorBindings.get(calleeName);
      if (
        calleeContract &&
        authenticImportedTranslatorBindings.has(calleeName) &&
        !isAuthenticTranslatorImportShadowedAtNode(returnedCall, calleeName)
      ) {
        approveLocalTranslatorBinding(
          name,
          deriveForwardedTranslatorContract(
            functionNode,
            returnedCall,
            calleeContract,
          ),
        );
      }
    }

    const returnedObjectFromFunction = (
      node: ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration,
    ) => {
      if (!node.body) return null;
      if (!ts.isBlock(node.body)) {
        const expression = unwrapExpression(node.body);
        return ts.isObjectLiteralExpression(expression) ? expression : null;
      }
      const returns = node.body.statements.filter(ts.isReturnStatement);
      if (returns.length !== 1 || !returns[0].expression) return null;
      const expression = unwrapExpression(returns[0].expression);
      return ts.isObjectLiteralExpression(expression) ? expression : null;
    };
    const reviewedTranslatorProviders = new Map<
      string,
      Map<string, TranslatorContract>
    >();
    for (const { name, functionNode, immutable } of wrapperCandidates) {
      if (!immutable || reassignedLocalBindings.has(name)) continue;
      if (localBindingCounts.get(name) !== 1) continue;
      const returnedObject = returnedObjectFromFunction(functionNode);
      if (!returnedObject) continue;
      const properties = new Map<string, TranslatorContract>();
      for (const property of returnedObject.properties) {
        if (
          !ts.isPropertyAssignment(property) ||
          (!ts.isIdentifier(property.name) &&
            !ts.isStringLiteral(property.name)) ||
          (!ts.isArrowFunction(property.initializer) &&
            !ts.isFunctionExpression(property.initializer))
        ) {
          continue;
        }
        const returnedCall = returnedCallFromFunction(property.initializer);
        if (!returnedCall || !ts.isIdentifier(returnedCall.expression))
          continue;
        const calleeName = returnedCall.expression.text;
        const calleeContract = reviewedTranslatorBindings.get(calleeName);
        if (
          calleeContract &&
          authenticImportedTranslatorBindings.has(calleeName) &&
          !isAuthenticTranslatorImportShadowedAtNode(returnedCall, calleeName)
        ) {
          properties.set(
            property.name.text,
            deriveForwardedTranslatorContract(
              property.initializer,
              returnedCall,
              calleeContract,
            ),
          );
        }
      }
      if (properties.size > 0)
        reviewedTranslatorProviders.set(name, properties);
    }

    const collectProviderDerivedBindings = (node: ts.Node) => {
      if (
        ts.isVariableDeclaration(node) &&
        variableDeclarationIsConst(node) &&
        ts.isObjectBindingPattern(node.name) &&
        node.initializer &&
        ts.isCallExpression(node.initializer) &&
        ts.isIdentifier(node.initializer.expression) &&
        !isShadowedByEnclosingParameterOrCatch(
          node,
          node.initializer.expression.text,
        )
      ) {
        const properties = reviewedTranslatorProviders.get(
          node.initializer.expression.text,
        );
        if (properties) {
          for (const element of node.name.elements) {
            if (!ts.isIdentifier(element.name)) continue;
            const propertyName =
              element.propertyName &&
              (ts.isIdentifier(element.propertyName) ||
                ts.isStringLiteral(element.propertyName))
                ? element.propertyName.text
                : element.name.text;
            const contract = properties.get(propertyName);
            if (contract) {
              approveLocalTranslatorBinding(element.name.text, contract);
            }
          }
        }
      }
      ts.forEachChild(node, collectProviderDerivedBindings);
    };
    collectProviderDerivedBindings(source);

    for (const [name, count] of localBindingCounts) {
      const contracts = approvedLocalTranslatorContracts.get(name) ?? [];
      const firstContract = contracts[0];
      if (
        firstContract &&
        contracts.length === count &&
        contracts.every((contract) => contractsMatch(contract, firstContract))
      ) {
        reviewedTranslatorBindings.set(name, firstContract);
      }
    }

    const reviewedTranslatorContractForCall = (node: ts.CallExpression) => {
      if (isReviewedNotificationTranslatorCall(file.replaceAll("\\", "/"), node)) {
        return typedKeyTranslatorContract;
      }
      if (!ts.isIdentifier(node.expression)) return null;
      const name = node.expression.text;
      const isShadowed = authenticImportedTranslatorBindings.has(name)
        ? isAuthenticTranslatorImportShadowedAtNode(node, name)
        : isShadowedByEnclosingParameterOrCatch(node, name);
      return isShadowed ? null : (reviewedTranslatorBindings.get(name) ?? null);
    };

    const translatorArgumentIndexContaining = (
      node: ts.Node,
      call: ts.CallExpression,
    ) => {
      let branch = node;
      while (branch.parent && branch.parent !== call) branch = branch.parent;
      if (branch.parent !== call) return -1;
      return call.arguments.findIndex((argument) => argument === branch);
    };

    const translatorArgumentPathContaining = (
      node: ts.Node,
      call: ts.CallExpression,
    ) => {
      const path: TranslatorArgumentPathSegment[] = [];
      let branch = node;
      while (branch.parent && branch.parent !== call) {
        const parent = branch.parent;
        if (ts.isPropertyAssignment(parent) && parent.initializer === branch) {
          if (ts.isIdentifier(parent.name) || ts.isStringLiteral(parent.name)) {
            path.unshift(parent.name.text);
          } else if (ts.isNumericLiteral(parent.name)) {
            path.unshift(Number(parent.name.text));
          } else {
            return null;
          }
        } else if (
          ts.isShorthandPropertyAssignment(parent) &&
          parent.name === branch
        ) {
          path.unshift(parent.name.text);
        } else if (ts.isArrayLiteralExpression(parent)) {
          const index = parent.elements.findIndex(
            (element) => element === branch,
          );
          if (index < 0) return null;
          path.unshift(index);
        } else if (ts.isSpreadAssignment(parent)) {
          return null;
        }
        branch = parent;
      }
      if (branch.parent !== call) return null;
      const argumentIndex = call.arguments.findIndex(
        (argument) => argument === branch,
      );
      return argumentIndex < 0 ? null : { argumentIndex, path };
    };

    const translatorContractPathSpecificity = (
      paths: ReadonlySet<string>,
      argumentIndex: number,
      path: readonly TranslatorArgumentPathSegment[],
    ) => {
      let specificity = -1;
      for (let length = 0; length <= path.length; length += 1) {
        if (
          paths.has(
            translatorArgumentPathKey(argumentIndex, path.slice(0, length)),
          )
        ) {
          specificity = length;
        }
      }
      return specificity;
    };
    type AuditedTranslatorLocation = {
      readonly contract: TranslatorContract;
      readonly argumentIndex: number;
      readonly path: readonly TranslatorArgumentPathSegment[];
    };
    const auditedTranslatorLocationForNode = (
      node: ts.Node,
    ): AuditedTranslatorLocation | null => {
      let current: ts.Node | undefined = node.parent;
      while (current && !ts.isSourceFile(current)) {
        if (ts.isCallExpression(current)) {
          const contract = reviewedTranslatorContractForCall(current);
          const location = contract
            ? translatorArgumentPathContaining(node, current)
            : null;
          if (
            contract &&
            location &&
            contract.auditedArgumentIndexes.has(location.argumentIndex)
          ) {
            return { contract, ...location };
          }
        }
        current = current.parent;
      }
      return null;
    };
    const isTranslatorControlPath = (
      location: AuditedTranslatorLocation,
      relativePath: readonly TranslatorArgumentPathSegment[] = [],
    ) => {
      const path = [...location.path, ...relativePath];
      const skippedSpecificity = translatorContractPathSpecificity(
        location.contract.skippedArgumentPaths,
        location.argumentIndex,
        path,
      );
      const auditedSpecificity = translatorContractPathSpecificity(
        location.contract.auditedArgumentPaths,
        location.argumentIndex,
        path,
      );
      return skippedSpecificity > auditedSpecificity;
    };

    const isInsideSkippedTranslatorArgument = (
      node: ts.Node,
      call: ts.CallExpression,
      contract: TranslatorContract,
    ) => {
      const argumentIndex = translatorArgumentIndexContaining(node, call);
      return (
        contract.skippedArgumentIndexes.has(argumentIndex) &&
        !contract.auditedArgumentIndexes.has(argumentIndex)
      );
    };

    const translatorArgumentAuditDisposition = (node: ts.Node) => {
      let current: ts.Node | undefined = node.parent;
      while (current && !ts.isSourceFile(current)) {
        if (ts.isCallExpression(current)) {
          if (
            ts.isIdentifier(current.expression) &&
            reviewedTranslatorBindings.has(current.expression.text) &&
            (authenticImportedTranslatorBindings.has(current.expression.text)
              ? isAuthenticTranslatorImportShadowedAtNode(
                  current,
                  current.expression.text,
                )
              : isShadowedByEnclosingParameterOrCatch(
                  current,
                  current.expression.text,
                )) &&
            translatorArgumentIndexContaining(node, current) >= 0
          ) {
            return "audited";
          }
          const contract = reviewedTranslatorContractForCall(current);
          if (contract) {
            const argumentIndex = translatorArgumentIndexContaining(
              node,
              current,
            );
            if (argumentIndex >= 0) {
              return contract.auditedArgumentIndexes.has(argumentIndex)
                ? "audited"
                : "ignored";
            }
          }
        }
        current = current.parent;
      }
      return null;
    };

    const remember = (value: string) => {
      const normalized = value.replace(/\s+/gu, " ").trim();
      if (normalized.length <= 1) return;
      strings.add(normalized);
      const sources = sourceFilesByValue.get(normalized) ?? new Set<string>();
      sources.add(file.replaceAll("\\", "/"));
      sourceFilesByValue.set(normalized, sources);
    };

    type StaticAccessSegment = string | number;
    type StaticBindingRecord = {
      readonly key: string;
      readonly initializer: ts.Expression | null;
      readonly accessPath: readonly StaticAccessSegment[];
      readonly arrayRestOffset: number | null;
      readonly fallbackInitializer: ts.Expression | null;
      readonly staticMembers: ReadonlyMap<string, ts.Expression> | null;
      readonly importDescriptor: string | null;
      readonly declarationKind: "unique" | "parameter" | "var";
      readonly callable: ts.FunctionLikeDeclaration | null;
    };
    const staticBindingsByScope = new Map<
      ts.Node,
      Map<string, StaticBindingRecord[]>
    >();
    const staticClassByBindingKey = new Map<string, ts.ClassLikeDeclaration>();
    let staticBindingSequence = 0;
    const ignoredCatalogDeclarations = catalogDeclarationsWithParityTests.get(
      file.replaceAll("\\", "/"),
    );

    const isLexicalScopeNode = (node: ts.Node) =>
      ts.isSourceFile(node) ||
      ts.isBlock(node) ||
      ts.isCaseBlock(node) ||
      ts.isClassLike(node) ||
      ts.isFunctionLike(node) ||
      ts.isForStatement(node) ||
      ts.isForInStatement(node) ||
      ts.isForOfStatement(node) ||
      ts.isCatchClause(node);

    const nearestLexicalScope = (node: ts.Node | undefined) => {
      let current = node;
      while (current && !isLexicalScopeNode(current)) current = current.parent;
      return current ?? source;
    };
    const nearestVarScope = (node: ts.Node | undefined) => {
      let current = node;
      while (
        current &&
        !ts.isSourceFile(current) &&
        !ts.isFunctionLike(current)
      ) {
        current = current.parent;
      }
      return current ?? source;
    };

    const registerStaticBinding = (
      scope: ts.Node,
      name: string,
      initializer: ts.Expression | null,
      accessPath: readonly StaticAccessSegment[] = [],
      fallbackInitializer: ts.Expression | null = null,
      staticMembers: ReadonlyMap<string, ts.Expression> | null = null,
      importDescriptor: string | null = null,
      arrayRestOffset: number | null = null,
      declarationKind: "unique" | "parameter" | "var" = "unique",
      callable: ts.FunctionLikeDeclaration | null = null,
    ) => {
      const bindings = staticBindingsByScope.get(scope) ?? new Map();
      const records = bindings.get(name) ?? [];
      const record = {
        key: `${scope.pos}:${scope.end}:${name}:${staticBindingSequence++}`,
        initializer,
        accessPath,
        arrayRestOffset,
        fallbackInitializer,
        staticMembers,
        importDescriptor,
        declarationKind,
        callable,
      } satisfies StaticBindingRecord;
      records.push(record);
      bindings.set(name, records);
      staticBindingsByScope.set(scope, bindings);
      return record;
    };

    const bindingPropertyName = (name: ts.PropertyName | undefined) => {
      if (!name) return null;
      if (
        ts.isIdentifier(name) ||
        ts.isStringLiteral(name) ||
        ts.isNumericLiteral(name)
      ) {
        return name.text;
      }
      if (ts.isComputedPropertyName(name)) {
        return resolveStaticString(name.expression);
      }
      return null;
    };

    const registerBindingPattern = (
      scope: ts.Node,
      name: ts.BindingName,
      initializer: ts.Expression | null,
      accessPath: readonly StaticAccessSegment[] = [],
      fallbackInitializer: ts.Expression | null = null,
      arrayRestOffset: number | null = null,
      declarationKind: "unique" | "parameter" | "var" = "unique",
    ) => {
      if (ts.isIdentifier(name)) {
        registerStaticBinding(
          scope,
          name.text,
          initializer,
          accessPath,
          fallbackInitializer,
          null,
          null,
          arrayRestOffset,
          declarationKind,
        );
        return;
      }
      name.elements.forEach((element, index) => {
        if (!ts.isBindingElement(element)) return;
        const segment = ts.isObjectBindingPattern(name)
          ? (bindingPropertyName(element.propertyName) ??
            (ts.isIdentifier(element.name) ? element.name.text : null))
          : index;
        registerBindingPattern(
          scope,
          element.name,
          initializer,
          element.dotDotDotToken || segment === null
            ? accessPath
            : [...accessPath, segment],
          element.initializer ?? fallbackInitializer,
          ts.isArrayBindingPattern(name) && element.dotDotDotToken
            ? index
            : arrayRestOffset,
          declarationKind,
        );
      });
    };

    const staticMembersFromDeclaration = (
      node: ts.ClassLikeDeclaration | ts.EnumDeclaration,
    ) => {
      const members = new Map<string, ts.Expression>();
      if (ts.isEnumDeclaration(node)) {
        node.members.forEach((member) => {
          const name = bindingPropertyName(member.name);
          if (name && member.initializer) members.set(name, member.initializer);
        });
        return members;
      }
      node.members.forEach((member) => {
        if (
          ts.isPropertyDeclaration(member) &&
          member.initializer &&
          (ts.getCombinedModifierFlags(member) & ts.ModifierFlags.Static) !== 0
        ) {
          const name = bindingPropertyName(member.name);
          if (name) members.set(name, member.initializer);
        }
      });
      return members;
    };

    const collectStaticStringDeclarations = (node: ts.Node) => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        ignoredCatalogDeclarations?.has(node.name.text)
      ) {
        return;
      }
      if (ts.isVariableDeclaration(node)) {
        const declarationList = ts.isVariableDeclarationList(node.parent)
          ? node.parent
          : null;
        const isVarDeclaration = Boolean(
          declarationList &&
          (declarationList.flags & ts.NodeFlags.BlockScoped) === 0,
        );
        registerBindingPattern(
          isVarDeclaration
            ? nearestVarScope(node.parent)
            : nearestLexicalScope(node.parent),
          node.name,
          node.initializer ?? null,
          [],
          null,
          null,
          isVarDeclaration ? "var" : "unique",
        );
      } else if (ts.isParameter(node)) {
        registerBindingPattern(
          node.parent,
          node.name,
          node.initializer ?? null,
          [],
          null,
          null,
          "parameter",
        );
      } else if (
        (ts.isClassDeclaration(node) ||
          ts.isClassExpression(node) ||
          ts.isEnumDeclaration(node)) &&
        node.name
      ) {
        const binding = registerStaticBinding(
          ts.isClassExpression(node) ? node : nearestLexicalScope(node.parent),
          node.name.text,
          ts.isClassExpression(node) ? node : null,
          [],
          null,
          staticMembersFromDeclaration(node),
        );
        if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
          staticClassByBindingKey.set(binding.key, node);
        }
      } else if (ts.isFunctionExpression(node) && node.name) {
        registerStaticBinding(
          node,
          node.name.text,
          node,
          [],
          null,
          null,
          null,
          null,
          "unique",
          node,
        );
      } else if (ts.isFunctionDeclaration(node) && node.name) {
        registerStaticBinding(
          nearestLexicalScope(node.parent),
          node.name.text,
          null,
          [],
          null,
          null,
          null,
          null,
          "unique",
          node,
        );
      } else if (
        (ts.isImportSpecifier(node) || ts.isImportClause(node)) &&
        node.name
      ) {
        registerStaticBinding(
          source,
          node.name.text,
          relativeImportInitializers.get(node.name.text) ?? null,
          [],
          null,
          null,
          relativeImportDescriptors.get(node.name.text) ??
            exactExternalImportDescriptors.get(node.name.text) ??
            null,
        );
      } else if (ts.isNamespaceImport(node)) {
        registerStaticBinding(
          source,
          node.name.text,
          null,
          [],
          null,
          null,
          relativeImportDescriptors.get(node.name.text) ??
            exactExternalImportDescriptors.get(node.name.text) ??
            null,
        );
      }
      ts.forEachChild(node, collectStaticStringDeclarations);
    };
    const staticBindingForIdentifier = (identifier: ts.Identifier) => {
      let current: ts.Node | undefined = identifier.parent;
      while (current) {
        if (isLexicalScopeNode(current)) {
          const records = staticBindingsByScope
            .get(current)
            ?.get(identifier.text);
          if (records) {
            if (records.length === 1) return records[0];
            if (
              records.every(
                (record) =>
                  record.declarationKind === "var" ||
                  record.declarationKind === "parameter",
              )
            ) {
              const initializedBeforeReference = records.filter(
                (record) =>
                  record.initializer &&
                  record.initializer.getStart(source) <
                    identifier.getStart(source),
              );
              return (
                initializedBeforeReference[
                  initializedBeforeReference.length - 1
                ] ?? records[0]
              );
            }
            return null;
          }
        }
        current = current.parent;
      }
      return null;
    };
    const isConstVariableInitializer = (expression: ts.Expression) => {
      const declaration = expression.parent;
      const declarationList =
        ts.isVariableDeclaration(declaration) &&
        ts.isVariableDeclarationList(declaration.parent)
          ? declaration.parent
          : null;
      return Boolean(
        declarationList && declarationList.flags & ts.NodeFlags.Const,
      );
    };
    const globalDescriptorProperty = (
      base: string,
      propertyName: string,
    ): string | null => {
      if (base === "globalThis" || base === "window") {
        return [
          "Array",
          "Boolean",
          "Function",
          "Map",
          "Object",
          "Promise",
          "Reflect",
          "Set",
          "structuredClone",
        ].includes(propertyName)
          ? propertyName
          : null;
      }
      return `${base}.${propertyName}`;
    };
    function staticGlobalDescriptorForBindingPath(
      binding: StaticBindingRecord,
      extraPath: readonly StaticAccessSegment[],
      seenBindings: ReadonlySet<string>,
    ): string | null {
      if (
        binding.importDescriptor?.startsWith("react") &&
        !seenBindings.has(binding.key)
      ) {
        let descriptor: string | null = binding.importDescriptor;
        for (const segment of [...binding.accessPath, ...extraPath]) {
          if (typeof segment !== "string" || !descriptor) return null;
          descriptor = globalDescriptorProperty(descriptor, segment);
        }
        return descriptor;
      }
      if (
        !binding.initializer ||
        seenBindings.has(binding.key) ||
        !isConstVariableInitializer(binding.initializer)
      ) {
        return null;
      }
      const nextSeen = new Set(seenBindings).add(binding.key);
      const fullPath = [...binding.accessPath, ...extraPath];
      const directDescriptor = staticGlobalReferenceDescriptor(
        binding.initializer,
        nextSeen,
      );
      if (directDescriptor) {
        let descriptor: string | null = directDescriptor;
        for (const segment of fullPath) {
          if (typeof segment !== "string" || !descriptor) return null;
          descriptor = globalDescriptorProperty(descriptor, segment);
        }
        return descriptor;
      }

      let current: ts.Expression = unwrapExpression(binding.initializer);
      for (const segment of fullPath) {
        const unwrapped = unwrapExpression(current);
        if (
          typeof segment === "number" &&
          ts.isArrayLiteralExpression(unwrapped)
        ) {
          const element = unwrapped.elements[segment];
          if (!element || ts.isOmittedExpression(element)) return null;
          current = ts.isSpreadElement(element) ? element.expression : element;
          continue;
        }
        if (
          typeof segment === "string" &&
          ts.isObjectLiteralExpression(unwrapped)
        ) {
          const property = [...unwrapped.properties]
            .reverse()
            .find((candidate) => {
              if (
                !ts.isPropertyAssignment(candidate) &&
                !ts.isShorthandPropertyAssignment(candidate)
              ) {
                return false;
              }
              const name = candidate.name;
              return (
                (ts.isIdentifier(name) || ts.isStringLiteral(name)) &&
                name.text === segment
              );
            });
          if (!property) return null;
          if (ts.isPropertyAssignment(property)) {
            current = property.initializer;
          } else if (ts.isShorthandPropertyAssignment(property)) {
            current = property.name;
          } else {
            return null;
          }
          continue;
        }
        return null;
      }
      return staticGlobalReferenceDescriptor(current, nextSeen);
    }
    const staticGlobalDescriptorRootCache = new Map<ts.Expression, string | null>();
    function staticGlobalReferenceDescriptor(
      expression: ts.Expression,
      seenBindings: ReadonlySet<string> = new Set(),
    ): string | null {
      if (seenBindings.size > 0) {
        return resolveStaticGlobalReferenceDescriptor(expression, seenBindings);
      }
      const current = unwrapExpression(expression);
      if (staticGlobalDescriptorRootCache.has(current)) {
        return staticGlobalDescriptorRootCache.get(current) ?? null;
      }
      const result = resolveStaticGlobalReferenceDescriptor(current, seenBindings);
      staticGlobalDescriptorRootCache.set(current, result);
      return result;
    }
    function resolveStaticGlobalReferenceDescriptor(
      expression: ts.Expression,
      seenBindings: ReadonlySet<string> = new Set(),
    ): string | null {
      const current = unwrapExpression(expression);
      if (ts.isConditionalExpression(current)) {
        const whenTrue = staticGlobalReferenceDescriptor(
          current.whenTrue,
          seenBindings,
        );
        const whenFalse = staticGlobalReferenceDescriptor(
          current.whenFalse,
          seenBindings,
        );
        return whenTrue && whenTrue === whenFalse ? whenTrue : null;
      }
      if (ts.isCallExpression(current)) {
        const callee = unwrapExpression(current.expression);
        const isBindCall =
          (ts.isPropertyAccessExpression(callee) &&
            callee.name.text === "bind") ||
          (ts.isElementAccessExpression(callee) &&
            callee.argumentExpression &&
            resolveStaticString(callee.argumentExpression, seenBindings) ===
              "bind");
        if (isBindCall) {
          return staticGlobalReferenceDescriptor(
            callee.expression,
            seenBindings,
          );
        }
      }
      if (ts.isIdentifier(current)) {
        const binding = staticBindingForIdentifier(current);
        if (binding) {
          return staticGlobalDescriptorForBindingPath(
            binding,
            [],
            seenBindings,
          );
        }
        return [
          "Array",
          "Boolean",
          "Function",
          "Map",
          "Object",
          "Promise",
          "Reflect",
          "Set",
          "globalThis",
          "structuredClone",
          "window",
        ].includes(current.text)
          ? current.text
          : null;
      }
      if (
        ts.isPropertyAccessExpression(current) ||
        ts.isElementAccessExpression(current)
      ) {
        const access = staticAccessForExpression(current);
        const binding = access
          ? staticBindingForIdentifier(access.identifier)
          : null;
        if (binding && access?.path) {
          const descriptor = staticGlobalDescriptorForBindingPath(
            binding,
            access.path,
            seenBindings,
          );
          if (descriptor) return descriptor;
        }
      }
      if (ts.isElementAccessExpression(current) && current.argumentExpression) {
        const container = unwrapExpression(current.expression);
        if (ts.isArrayLiteralExpression(container)) {
          const indexValue = ts.isNumericLiteral(current.argumentExpression)
            ? current.argumentExpression.text
            : resolveStaticString(current.argumentExpression, seenBindings);
          const index = indexValue === null ? Number.NaN : Number(indexValue);
          const flattened: ts.Expression[] = [];
          for (const candidate of container.elements) {
            if (ts.isOmittedExpression(candidate)) continue;
            if (
              ts.isSpreadElement(candidate) &&
              ts.isArrayLiteralExpression(
                unwrapExpression(candidate.expression),
              )
            ) {
              const nested = unwrapExpression(
                candidate.expression,
              ) as ts.ArrayLiteralExpression;
              nested.elements.forEach((element) => {
                if (!ts.isOmittedExpression(element)) {
                  flattened.push(
                    ts.isSpreadElement(element) ? element.expression : element,
                  );
                }
              });
            } else {
              flattened.push(
                ts.isSpreadElement(candidate)
                  ? candidate.expression
                  : candidate,
              );
            }
          }
          const element = Number.isInteger(index) ? flattened[index] : null;
          if (element && !ts.isOmittedExpression(element)) {
            return staticGlobalReferenceDescriptor(
              ts.isSpreadElement(element) ? element.expression : element,
              seenBindings,
            );
          }
        }
        if (ts.isObjectLiteralExpression(container)) {
          const propertyName = resolveStaticString(
            current.argumentExpression,
            seenBindings,
          );
          const property =
            propertyName === null
              ? null
              : [...container.properties].reverse().find((candidate) => {
                  if (
                    !ts.isPropertyAssignment(candidate) &&
                    !ts.isShorthandPropertyAssignment(candidate)
                  ) {
                    return false;
                  }
                  return bindingPropertyName(candidate.name) === propertyName;
                });
          if (property && ts.isPropertyAssignment(property)) {
            return staticGlobalReferenceDescriptor(
              property.initializer,
              seenBindings,
            );
          }
          if (property && ts.isShorthandPropertyAssignment(property)) {
            return staticGlobalReferenceDescriptor(property.name, seenBindings);
          }
        }
      }
      if (ts.isPropertyAccessExpression(current)) {
        const container = unwrapExpression(current.expression);
        if (ts.isObjectLiteralExpression(container)) {
          const property = [...container.properties]
            .reverse()
            .find(
              (candidate) =>
                (ts.isPropertyAssignment(candidate) ||
                  ts.isShorthandPropertyAssignment(candidate)) &&
                bindingPropertyName(candidate.name) === current.name.text,
            );
          if (property && ts.isPropertyAssignment(property)) {
            return staticGlobalReferenceDescriptor(
              property.initializer,
              seenBindings,
            );
          }
          if (property && ts.isShorthandPropertyAssignment(property)) {
            return staticGlobalReferenceDescriptor(property.name, seenBindings);
          }
        }
      }
      if (
        ts.isPropertyAccessExpression(current) ||
        ts.isElementAccessExpression(current)
      ) {
        const dereferenced = dereferenceStaticExpression(current, seenBindings);
        if (dereferenced && unwrapExpression(dereferenced) !== current) {
          const descriptor = staticGlobalReferenceDescriptor(
            dereferenced,
            seenBindings,
          );
          if (descriptor) return descriptor;
        }
      }
      if (ts.isPropertyAccessExpression(current)) {
        const base = staticGlobalReferenceDescriptor(
          current.expression,
          seenBindings,
        );
        if (!base) return null;
        return globalDescriptorProperty(base, current.name.text);
      }
      if (ts.isElementAccessExpression(current) && current.argumentExpression) {
        const base = staticGlobalReferenceDescriptor(
          current.expression,
          seenBindings,
        );
        if (!base) return null;
        const propertyName =
          ts.isStringLiteral(current.argumentExpression) ||
          ts.isNoSubstitutionTemplateLiteral(current.argumentExpression)
            ? current.argumentExpression.text
            : resolveStaticString(current.argumentExpression, seenBindings);
        if (propertyName === null) return null;
        return globalDescriptorProperty(base, propertyName);
      }
      return null;
    }
    const isUnshadowedObjectMethodCall = (
      expression: ts.Expression,
      methodNames: readonly string[],
    ): expression is ts.CallExpression =>
      ts.isCallExpression(expression) &&
      methodNames.some(
        (methodName) =>
          staticGlobalReferenceDescriptor(expression.expression) ===
          `Object.${methodName}`,
      );
    const isUnshadowedGlobalFunctionCall = (
      expression: ts.Expression,
      functionName: string,
    ): expression is ts.CallExpression =>
      ts.isCallExpression(expression) &&
      staticGlobalReferenceDescriptor(expression.expression) === functionName;
    const isUnshadowedGlobalConstructorCall = (
      expression: ts.Expression,
      constructorName: string,
    ): expression is ts.NewExpression =>
      ts.isNewExpression(expression) &&
      staticGlobalReferenceDescriptor(expression.expression) ===
        constructorName;
    const propertyAccessName = (expression: ts.Expression): string | null => {
      const current = unwrapExpression(expression);
      if (ts.isPropertyAccessExpression(current)) return current.name.text;
      if (
        ts.isElementAccessExpression(current) &&
        current.argumentExpression &&
        (ts.isStringLiteral(current.argumentExpression) ||
          ts.isNoSubstitutionTemplateLiteral(current.argumentExpression))
      ) {
        return current.argumentExpression.text;
      }
      return null;
    };
    const rootAccessIdentifierName = (
      expression: ts.Expression,
    ): string | null => {
      let current = unwrapExpression(expression);
      while (
        ts.isPropertyAccessExpression(current) ||
        ts.isElementAccessExpression(current)
      ) {
        current = unwrapExpression(current.expression);
      }
      return ts.isIdentifier(current) ? current.text : null;
    };
    type StaticGlobalCallInvocation = {
      readonly descriptor: string;
      readonly arguments: readonly ts.Expression[];
    };
    const supportedStaticCopyDescriptors = new Set([
      "structuredClone",
      "Array",
      "Array.from",
      "Array.of",
      "Object.assign",
      "Reflect.construct",
      "Array.prototype.slice",
      "Array.prototype.concat",
    ]);
    const arrayPrototypeCopyDescriptors = new Set([
      "Array.prototype.slice",
      "Array.prototype.concat",
    ]);
    const staticBoundArgumentsForExpression = (
      expression: ts.Expression,
      seenBindings: ReadonlySet<string> = new Set(),
    ): ts.Expression[] => {
      const current = unwrapExpression(expression);
      if (ts.isIdentifier(current)) {
        const binding = staticBindingForIdentifier(current);
        if (
          binding?.initializer &&
          binding.accessPath.length === 0 &&
          !seenBindings.has(binding.key)
        ) {
          return staticBoundArgumentsForExpression(
            binding.initializer,
            new Set(seenBindings).add(binding.key),
          );
        }
        return [];
      }
      if (!ts.isCallExpression(current)) return [];
      const callee = unwrapExpression(current.expression);
      const methodName = propertyAccessName(callee);
      if (
        methodName !== "bind" ||
        (!ts.isPropertyAccessExpression(callee) &&
          !ts.isElementAccessExpression(callee))
      ) {
        return [];
      }
      const targetDescriptor = staticGlobalReferenceDescriptor(
        callee.expression,
      );
      return [
        ...staticBoundArgumentsForExpression(callee.expression, seenBindings),
        ...(targetDescriptor &&
        arrayPrototypeCopyDescriptors.has(targetDescriptor)
          ? current.arguments
          : current.arguments.slice(1)),
      ];
    };
    const staticGlobalCallInvocation = (
      call: ts.CallExpression,
    ): StaticGlobalCallInvocation | null => {
      const directDescriptor = staticGlobalReferenceDescriptor(call.expression);
      if (directDescriptor === "Reflect.apply" && call.arguments.length >= 3) {
        const descriptor = staticGlobalReferenceDescriptor(call.arguments[0]);
        const appliedArguments = staticArrayElements(
          call.arguments[2],
          new Set(),
        );
        return descriptor && appliedArguments
          ? {
              descriptor,
              arguments: arrayPrototypeCopyDescriptors.has(descriptor)
                ? [call.arguments[1], ...appliedArguments]
                : appliedArguments,
            }
          : null;
      }

      const callee = unwrapExpression(call.expression);
      const methodName = propertyAccessName(callee);
      if (
        (methodName === "call" || methodName === "apply") &&
        (ts.isPropertyAccessExpression(callee) ||
          ts.isElementAccessExpression(callee))
      ) {
        const descriptor = staticGlobalReferenceDescriptor(callee.expression);
        if (!descriptor) return null;
        if (
          descriptor === "Function.prototype.call" &&
          methodName === "call" &&
          call.arguments.length >= 2
        ) {
          const invokedDescriptor = staticGlobalReferenceDescriptor(
            call.arguments[0],
          );
          if (!invokedDescriptor) return null;
          return {
            descriptor: invokedDescriptor,
            arguments: arrayPrototypeCopyDescriptors.has(invokedDescriptor)
              ? [call.arguments[1], ...call.arguments.slice(2)]
              : [...call.arguments.slice(2)],
          };
        }
        if (methodName === "call") {
          return {
            descriptor,
            arguments: arrayPrototypeCopyDescriptors.has(descriptor)
              ? [...call.arguments]
              : [...call.arguments.slice(1)],
          };
        }
        const appliedArguments = call.arguments[1]
          ? staticArrayElements(call.arguments[1], new Set())
          : [];
        return appliedArguments
          ? {
              descriptor,
              arguments: arrayPrototypeCopyDescriptors.has(descriptor)
                ? [call.arguments[0], ...appliedArguments]
                : appliedArguments,
            }
          : null;
      }

      return directDescriptor
        ? {
            descriptor: directDescriptor,
            arguments: [
              ...staticBoundArgumentsForExpression(call.expression),
              ...call.arguments,
            ],
          }
        : null;
    };
    const staticCopyInvocationForCall = (
      call: ts.CallExpression,
    ): StaticGlobalCallInvocation | null => {
      const invocation = staticGlobalCallInvocation(call);
      return invocation &&
        supportedStaticCopyDescriptors.has(invocation.descriptor)
        ? invocation
        : null;
    };
    const staticCopyDescriptorForCall = (
      call: ts.CallExpression,
    ): string | null => staticCopyInvocationForCall(call)?.descriptor ?? null;
    const isStaticCopyLikeCall = (call: ts.CallExpression) => {
      if (staticCopyDescriptorForCall(call)) return true;

      const callee = unwrapExpression(call.expression);
      if (ts.isIdentifier(callee)) {
        return callee.text === "structuredClone";
      }
      const propertyName = propertyAccessName(callee);
      const rootName = rootAccessIdentifierName(callee);
      return (
        (rootName === "Array" &&
          (propertyName === "from" || propertyName === "of")) ||
        (rootName === "Object" && propertyName === "assign") ||
        (rootName === "Reflect" && propertyName === "construct")
      );
    };
    const isStaticCopyLikeNew = (expression: ts.NewExpression) => {
      const descriptor = staticGlobalReferenceDescriptor(expression.expression);
      if (descriptor === "Array") return true;
      const constructor = unwrapExpression(expression.expression);
      return ts.isIdentifier(constructor) && constructor.text === "Array";
    };
    const staticCopySourceExpression = (
      expression: ts.Expression,
    ): ts.Expression | null => {
      const current = unwrapExpression(expression);
      if (!ts.isCallExpression(current)) return null;
      const invocation = staticCopyInvocationForCall(current);
      if (
        invocation?.descriptor === "structuredClone" &&
        invocation.arguments.length >= 1 &&
        invocation.arguments.length <= 2
      ) {
        return invocation.arguments[0];
      }
      if (
        invocation?.descriptor === "Array.from" &&
        invocation.arguments.length >= 1
      ) {
        return invocation.arguments[0];
      }
      return null;
    };
    function functionLikeReturnExpressions(
      current: ts.FunctionLikeDeclaration,
    ): ts.Expression[] {
      if (ts.isArrowFunction(current) && !ts.isBlock(current.body)) {
        return [current.body];
      }
      const body = current.body;
      if (!body || !ts.isBlock(body)) return [];
      const returns: ts.Expression[] = [];
      const visitReturn = (node: ts.Node) => {
        if (node !== current && ts.isFunctionLike(node)) return;
        if (ts.isReturnStatement(node) && node.expression) {
          returns.push(node.expression);
          return;
        }
        ts.forEachChild(node, visitReturn);
      };
      visitReturn(body);
      return returns;
    }
    function staticCallbackFunctionLike(
      expression: ts.Expression,
      seen: ReadonlySet<string> = new Set(),
    ): ts.FunctionLikeDeclaration | null {
      const direct = unwrapExpression(expression);
      if (ts.isIdentifier(direct)) {
        const binding = staticBindingForIdentifier(direct);
        if (binding?.callable) return binding.callable;
      }
      const dereferenced = dereferenceStaticExpression(expression, seen);
      if (!dereferenced) return null;
      const current = unwrapExpression(dereferenced);
      return ts.isArrowFunction(current) || ts.isFunctionExpression(current)
        ? current
        : null;
    }
    function staticCallbackReturnExpressions(
      expression: ts.Expression,
      seen: ReadonlySet<string> = new Set(),
    ): ts.Expression[] {
      const callback = staticCallbackFunctionLike(expression, seen);
      return callback ? functionLikeReturnExpressions(callback) : [];
    }
    function staticCallbackFirstParameterName(
      expression: ts.Expression,
      seen: ReadonlySet<string> = new Set(),
    ): string | null {
      const callback = staticCallbackFunctionLike(expression, seen);
      if (!callback) return null;
      const parameter = callback.parameters[0]?.name;
      return parameter && ts.isIdentifier(parameter) ? parameter.text : null;
    }
    const staticMapperPrimitive = (
      expression: ts.Expression,
      callback: ts.FunctionLikeDeclaration,
      callArguments: readonly ts.Expression[],
      seen: ReadonlySet<string>,
    ): string | number | boolean | null => {
      const current = unwrapExpression(expression);
      const projected = projectFunctionReturnExpression(
        current,
        callback,
        callArguments,
      );
      if (projected !== current) {
        return staticMapperPrimitive(projected, callback, callArguments, seen);
      }
      if (
        ts.isStringLiteral(current) ||
        ts.isNoSubstitutionTemplateLiteral(current)
      ) {
        return current.text;
      }
      if (ts.isNumericLiteral(current)) return Number(current.text);
      if (current.kind === ts.SyntaxKind.TrueKeyword) return true;
      if (current.kind === ts.SyntaxKind.FalseKeyword) return false;
      return resolveStaticString(current, seen);
    };
    const staticExpressionTruthiness = (
      expression: ts.Expression,
      seen: ReadonlySet<string>,
    ): boolean | null => {
      const dereferenced = dereferenceStaticExpression(expression, seen);
      if (!dereferenced) return null;
      const current = unwrapExpression(dereferenced);
      if (
        ts.isStringLiteral(current) ||
        ts.isNoSubstitutionTemplateLiteral(current)
      ) {
        return current.text.length > 0;
      }
      if (ts.isNumericLiteral(current)) return Number(current.text) !== 0;
      if (current.kind === ts.SyntaxKind.TrueKeyword) return true;
      if (
        current.kind === ts.SyntaxKind.FalseKeyword ||
        current.kind === ts.SyntaxKind.NullKeyword ||
        (ts.isIdentifier(current) && current.text === "undefined")
      ) {
        return false;
      }
      if (
        ts.isObjectLiteralExpression(current) ||
        ts.isArrayLiteralExpression(current) ||
        ts.isArrowFunction(current) ||
        ts.isFunctionExpression(current) ||
        ts.isNewExpression(current)
      ) {
        return true;
      }
      return null;
    };
    const staticMapperCondition = (
      expression: ts.Expression,
      callback: ts.FunctionLikeDeclaration,
      callArguments: readonly ts.Expression[],
      seen: ReadonlySet<string>,
    ): boolean | null => {
      const current = unwrapExpression(expression);
      if (
        ts.isPrefixUnaryExpression(current) &&
        current.operator === ts.SyntaxKind.ExclamationToken
      ) {
        const operand = staticMapperCondition(
          current.operand,
          callback,
          callArguments,
          seen,
        );
        return operand === null ? null : !operand;
      }
      if (!ts.isBinaryExpression(current)) {
        const primitive = staticMapperPrimitive(
          current,
          callback,
          callArguments,
          seen,
        );
        return typeof primitive === "boolean" ? primitive : null;
      }
      const equalityKinds = new Set([
        ts.SyntaxKind.EqualsEqualsToken,
        ts.SyntaxKind.EqualsEqualsEqualsToken,
        ts.SyntaxKind.ExclamationEqualsToken,
        ts.SyntaxKind.ExclamationEqualsEqualsToken,
      ]);
      const relationalKinds = new Set([
        ts.SyntaxKind.LessThanToken,
        ts.SyntaxKind.LessThanEqualsToken,
        ts.SyntaxKind.GreaterThanToken,
        ts.SyntaxKind.GreaterThanEqualsToken,
      ]);
      if (
        !equalityKinds.has(current.operatorToken.kind) &&
        !relationalKinds.has(current.operatorToken.kind)
      ) {
        return null;
      }
      const left = staticMapperPrimitive(
        current.left,
        callback,
        callArguments,
        seen,
      );
      const right = staticMapperPrimitive(
        current.right,
        callback,
        callArguments,
        seen,
      );
      if (left === null || right === null) return null;
      if (relationalKinds.has(current.operatorToken.kind)) {
        if (
          (typeof left !== "string" && typeof left !== "number") ||
          (typeof right !== "string" && typeof right !== "number")
        ) {
          return null;
        }
        if (current.operatorToken.kind === ts.SyntaxKind.LessThanToken) {
          return left < right;
        }
        if (current.operatorToken.kind === ts.SyntaxKind.LessThanEqualsToken) {
          return left <= right;
        }
        if (current.operatorToken.kind === ts.SyntaxKind.GreaterThanToken) {
          return left > right;
        }
        return left >= right;
      }
      const equal = left === right;
      return current.operatorToken.kind ===
        ts.SyntaxKind.ExclamationEqualsToken ||
        current.operatorToken.kind ===
          ts.SyntaxKind.ExclamationEqualsEqualsToken
        ? !equal
        : equal;
    };
    function staticEvaluatedFunctionReturnExpression(
      callback: ts.FunctionLikeDeclaration,
      callArguments: readonly ts.Expression[],
      seen: ReadonlySet<string>,
    ): ts.Expression | null {
      const mapReturnExpression = (
        returnExpression: ts.Expression,
      ): ts.Expression | null => {
        const current = unwrapExpression(returnExpression);
        if (ts.isConditionalExpression(current)) {
          const condition = staticMapperCondition(
            current.condition,
            callback,
            callArguments,
            seen,
          );
          if (condition === null) return null;
          return mapReturnExpression(
            condition ? current.whenTrue : current.whenFalse,
          );
        }
        return projectFunctionReturnExpression(
          returnExpression,
          callback,
          callArguments,
        );
      };
      if (ts.isArrowFunction(callback) && !ts.isBlock(callback.body)) {
        return mapReturnExpression(callback.body);
      }
      const body = callback.body;
      if (!body || !ts.isBlock(body)) return null;
      type Evaluation =
        | { readonly kind: "return"; readonly expression: ts.Expression }
        | { readonly kind: "fallthrough" }
        | { readonly kind: "unknown" };
      const evaluateStatement = (statement: ts.Statement): Evaluation => {
        if (ts.isReturnStatement(statement)) {
          return statement.expression
            ? (() => {
                const expression = mapReturnExpression(statement.expression);
                return expression
                  ? { kind: "return" as const, expression }
                  : { kind: "unknown" as const };
              })()
            : { kind: "unknown" };
        }
        if (ts.isBlock(statement))
          return evaluateStatements(statement.statements);
        if (ts.isIfStatement(statement)) {
          const condition = staticMapperCondition(
            statement.expression,
            callback,
            callArguments,
            seen,
          );
          if (condition === null) return { kind: "unknown" };
          if (condition) return evaluateStatement(statement.thenStatement);
          return statement.elseStatement
            ? evaluateStatement(statement.elseStatement)
            : { kind: "fallthrough" };
        }
        if (ts.isSwitchStatement(statement)) {
          const switchValue = staticMapperPrimitive(
            statement.expression,
            callback,
            callArguments,
            seen,
          );
          if (switchValue === null) return { kind: "unknown" };
          const matchingClause =
            statement.caseBlock.clauses.find(
              (clause) =>
                ts.isCaseClause(clause) &&
                staticMapperPrimitive(
                  clause.expression,
                  callback,
                  callArguments,
                  seen,
                ) === switchValue,
            ) ?? statement.caseBlock.clauses.find(ts.isDefaultClause);
          return matchingClause
            ? evaluateStatements(matchingClause.statements)
            : { kind: "fallthrough" };
        }
        return { kind: "fallthrough" };
      };
      const evaluateStatements = (
        statements: readonly ts.Statement[],
      ): Evaluation => {
        for (const statement of statements) {
          const result = evaluateStatement(statement);
          if (result.kind !== "fallthrough") return result;
        }
        return { kind: "fallthrough" };
      };
      const result = evaluateStatements(body.statements);
      return result.kind === "return" ? result.expression : null;
    }
    function staticMappedCallbackReturnExpression(
      expression: ts.Expression,
      sourceElement: ts.Expression,
      sourceIndex: number,
      seen: ReadonlySet<string>,
    ): ts.Expression | null {
      const callback = staticCallbackFunctionLike(expression, seen);
      return callback
        ? staticEvaluatedFunctionReturnExpression(
            callback,
            [sourceElement, ts.factory.createNumericLiteral(sourceIndex)],
            seen,
          )
        : null;
    }
    const staticCallableRootCache = new Map<
      ts.Expression,
      ts.FunctionLikeDeclaration | null
    >();
    function staticCallableForExpression(
      expression: ts.Expression,
      seenBindings: ReadonlySet<string> = new Set(),
    ): ts.FunctionLikeDeclaration | null {
      // Only context-free lookups are reusable. A recursive lookup carries
      // cycle-detection bindings, so its result must not poison other paths.
      if (seenBindings.size > 0) {
        return resolveStaticCallableForExpression(expression, seenBindings);
      }
      const current = unwrapExpression(expression);
      if (staticCallableRootCache.has(current)) {
        return staticCallableRootCache.get(current) ?? null;
      }
      const result = resolveStaticCallableForExpression(current, seenBindings);
      staticCallableRootCache.set(current, result);
      return result;
    }
    function resolveStaticCallableForExpression(
      expression: ts.Expression,
      seenBindings: ReadonlySet<string> = new Set(),
    ): ts.FunctionLikeDeclaration | null {
      const current = unwrapExpression(expression);
      if (ts.isIdentifier(current)) {
        const binding = staticBindingForIdentifier(current);
        if (!binding || seenBindings.has(binding.key)) return null;
        if (binding.callable) return binding.callable;
        if (binding.initializer) {
          return staticCallableForExpression(
            binding.initializer,
            new Set(seenBindings).add(binding.key),
          );
        }
        return null;
      }
      if (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) {
        return current;
      }
      if (ts.isCallExpression(current)) {
        const invocation = staticGlobalCallInvocation(current);
        if (
          invocation?.descriptor === "react.useCallback" &&
          invocation.arguments[0]
        ) {
          return staticCallableForExpression(
            invocation.arguments[0],
            seenBindings,
          );
        }
        const callee = unwrapExpression(current.expression);
        if (
          propertyAccessName(callee) === "bind" &&
          (ts.isPropertyAccessExpression(callee) ||
            ts.isElementAccessExpression(callee))
        ) {
          return staticCallableForExpression(callee.expression, seenBindings);
        }
        return null;
      }
      const propertyName = propertyAccessName(current);
      if (
        propertyName === null ||
        (!ts.isPropertyAccessExpression(current) &&
          !ts.isElementAccessExpression(current))
      ) {
        const dereferenced = dereferenceStaticExpression(current, seenBindings);
        const value = dereferenced ? unwrapExpression(dereferenced) : null;
        return value &&
          (ts.isArrowFunction(value) || ts.isFunctionExpression(value))
          ? value
          : null;
      }

      const receiver = current.expression;
      const receiverIdentifier = ts.isIdentifier(unwrapExpression(receiver))
        ? (unwrapExpression(receiver) as ts.Identifier)
        : null;
      const binding = receiverIdentifier
        ? staticBindingForIdentifier(receiverIdentifier)
        : null;
      const declaredClass = binding
        ? staticClassByBindingKey.get(binding.key)
        : null;
      if (declaredClass) {
        const member = declaredClass.members.find(
          (candidate) =>
            ts.isMethodDeclaration(candidate) &&
            (ts.getCombinedModifierFlags(candidate) &
              ts.ModifierFlags.Static) !==
              0 &&
            bindingPropertyName(candidate.name) === propertyName,
        );
        if (member && ts.isMethodDeclaration(member)) return member;
      }

      const receiverValue = dereferenceStaticExpression(receiver, seenBindings);
      const container = receiverValue
        ? unwrapExpression(receiverValue)
        : binding?.initializer
          ? unwrapExpression(binding.initializer)
          : null;
      if (container && ts.isObjectLiteralExpression(container)) {
        const member = [...container.properties]
          .reverse()
          .find(
            (property) =>
              (ts.isMethodDeclaration(property) ||
                ts.isPropertyAssignment(property)) &&
              bindingPropertyName(property.name) === propertyName,
          );
        if (member && ts.isMethodDeclaration(member)) return member;
        if (member && ts.isPropertyAssignment(member)) {
          return staticCallableForExpression(member.initializer, seenBindings);
        }
      }
      if (container && ts.isClassExpression(container)) {
        const member = container.members.find(
          (candidate) =>
            ts.isMethodDeclaration(candidate) &&
            (ts.getCombinedModifierFlags(candidate) &
              ts.ModifierFlags.Static) !==
              0 &&
            bindingPropertyName(candidate.name) === propertyName,
        );
        if (member && ts.isMethodDeclaration(member)) return member;
      }

      const dereferenced = dereferenceStaticExpression(current, seenBindings);
      const value = dereferenced ? unwrapExpression(dereferenced) : null;
      return value &&
        (ts.isArrowFunction(value) || ts.isFunctionExpression(value))
        ? value
        : null;
    }
    type StaticLocalCallInvocation = {
      readonly callable: ts.FunctionLikeDeclaration;
      readonly arguments: readonly ts.Expression[];
    };
    const staticBoundLocalCallableForExpression = (
      expression: ts.Expression,
      seenBindings: ReadonlySet<string> = new Set(),
    ): StaticLocalCallInvocation | null => {
      const current = unwrapExpression(expression);
      if (ts.isIdentifier(current)) {
        const binding = staticBindingForIdentifier(current);
        if (
          binding?.initializer &&
          binding.accessPath.length === 0 &&
          !seenBindings.has(binding.key)
        ) {
          const bound = staticBoundLocalCallableForExpression(
            binding.initializer,
            new Set(seenBindings).add(binding.key),
          );
          if (bound) return bound;
        }
      }
      if (ts.isCallExpression(current)) {
        const callee = unwrapExpression(current.expression);
        if (
          propertyAccessName(callee) === "bind" &&
          (ts.isPropertyAccessExpression(callee) ||
            ts.isElementAccessExpression(callee))
        ) {
          const target = staticBoundLocalCallableForExpression(
            callee.expression,
            seenBindings,
          );
          return target
            ? {
                callable: target.callable,
                arguments: [...target.arguments, ...current.arguments.slice(1)],
              }
            : null;
        }
      }
      const callable = staticCallableForExpression(current, seenBindings);
      return callable ? { callable, arguments: [] } : null;
    };
    const staticLocalInvocationForCall = (
      call: ts.CallExpression,
    ): StaticLocalCallInvocation | null => {
      if (
        staticGlobalReferenceDescriptor(call.expression) === "Reflect.apply" &&
        call.arguments.length >= 3
      ) {
        const target = staticBoundLocalCallableForExpression(call.arguments[0]);
        const appliedArguments = staticArrayElements(
          call.arguments[2],
          new Set(),
        );
        return target && appliedArguments
          ? {
              callable: target.callable,
              arguments: [...target.arguments, ...appliedArguments],
            }
          : null;
      }
      const callee = unwrapExpression(call.expression);
      const methodName = propertyAccessName(callee);
      if (
        (methodName === "call" || methodName === "apply") &&
        (ts.isPropertyAccessExpression(callee) ||
          ts.isElementAccessExpression(callee))
      ) {
        const target = staticBoundLocalCallableForExpression(callee.expression);
        if (!target) return null;
        const invocationArguments =
          methodName === "call"
            ? [...call.arguments.slice(1)]
            : call.arguments[1]
              ? staticArrayElements(call.arguments[1], new Set())
              : [];
        return invocationArguments
          ? {
              callable: target.callable,
              arguments: [...target.arguments, ...invocationArguments],
            }
          : null;
      }
      const target = staticBoundLocalCallableForExpression(call.expression);
      return target
        ? {
            callable: target.callable,
            arguments: [...target.arguments, ...call.arguments],
          }
        : null;
    };
    const staticSingleLocalReturn = (
      call: ts.CallExpression,
    ): {
      readonly callable: ts.FunctionLikeDeclaration;
      readonly arguments: readonly ts.Expression[];
      readonly expression: ts.Expression;
    } | null => {
      const invocation = staticLocalInvocationForCall(call);
      if (!invocation) return null;
      const returns = functionLikeReturnExpressions(invocation.callable);
      if (returns.length === 1) {
        return { ...invocation, expression: returns[0] };
      }
      const evaluated = staticEvaluatedFunctionReturnExpression(
        invocation.callable,
        invocation.arguments,
        new Set(),
      );
      return evaluated ? { ...invocation, expression: evaluated } : null;
    };
    function staticCallReturnExpressions(
      call: ts.CallExpression,
    ): ts.Expression[] {
      const result = staticSingleLocalReturn(call);
      if (!result) return [];
      const collectProjected = (expression: ts.Expression): ts.Expression[] => {
        const current = unwrapExpression(expression);
        const projected = projectFunctionReturnExpression(
          current,
          result.callable,
          result.arguments,
        );
        if (projected !== current) return [projected];
        const dereferenced = dereferenceStaticExpression(current);
        if (dereferenced && unwrapExpression(dereferenced) !== current) {
          return [dereferenced];
        }
        if (ts.isArrayLiteralExpression(current)) {
          return current.elements.flatMap((element) =>
            ts.isOmittedExpression(element)
              ? []
              : collectProjected(
                  ts.isSpreadElement(element) ? element.expression : element,
                ),
          );
        }
        if (ts.isObjectLiteralExpression(current)) {
          return current.properties.flatMap((property) => {
            if (ts.isPropertyAssignment(property)) {
              return collectProjected(property.initializer);
            }
            if (ts.isShorthandPropertyAssignment(property)) {
              return collectProjected(property.name);
            }
            if (ts.isSpreadAssignment(property)) {
              return collectProjected(property.expression);
            }
            return [];
          });
        }
        if (
          ts.isStringLiteral(current) ||
          ts.isNoSubstitutionTemplateLiteral(current) ||
          ts.isNumericLiteral(current) ||
          current.kind === ts.SyntaxKind.TrueKeyword ||
          current.kind === ts.SyntaxKind.FalseKeyword ||
          current.kind === ts.SyntaxKind.NullKeyword
        ) {
          return [current];
        }
        return [];
      };
      return collectProjected(result.expression);
    }
    const staticGeneratorElementsForCall = (
      call: ts.CallExpression,
    ): ts.Expression[] | null => {
      const invocation = staticLocalInvocationForCall(call);
      const callable = invocation?.callable;
      if (
        !invocation ||
        !callable ||
        !("asteriskToken" in callable) ||
        !callable.asteriskToken ||
        !callable.body ||
        !ts.isBlock(callable.body)
      ) {
        return null;
      }
      const yielded: ts.Expression[] = [];
      let unknown = false;
      const visitYield = (node: ts.Node) => {
        if (node !== callable && ts.isFunctionLike(node)) return;
        if (ts.isYieldExpression(node)) {
          if (!node.expression) {
            unknown = true;
            return;
          }
          const projected = projectFunctionReturnExpression(
            node.expression,
            callable,
            invocation.arguments,
          );
          if (node.asteriskToken) {
            const nested = staticArrayElements(projected, new Set());
            if (!nested) {
              unknown = true;
              return;
            }
            yielded.push(...nested);
          } else {
            yielded.push(projected);
          }
          return;
        }
        ts.forEachChild(node, visitYield);
      };
      visitYield(callable.body);
      return unknown ? null : yielded;
    };
    const staticCallbackValue = (
      expression: ts.Expression,
      callArguments: readonly ts.Expression[] = [],
    ): ts.Expression | null => {
      const callback = staticCallbackFunctionLike(expression);
      if (!callback) return null;
      const returns = functionLikeReturnExpressions(callback);
      if (returns.length === 1) {
        return projectFunctionReturnExpression(
          returns[0],
          callback,
          callArguments,
        );
      }
      return staticEvaluatedFunctionReturnExpression(
        callback,
        callArguments,
        new Set(),
      );
    };
    const staticTransparentCallResultExpression = (
      call: ts.CallExpression,
    ): ts.Expression | null => {
      const invocation = staticGlobalCallInvocation(call);
      if (invocation?.descriptor === "Promise.resolve") {
        return invocation.arguments[0] ?? null;
      }
      if (
        (invocation?.descriptor === "Promise.race" ||
          invocation?.descriptor === "Promise.any") &&
        invocation.arguments[0]
      ) {
        const candidates = staticArrayElements(
          invocation.arguments[0],
          new Set(),
        );
        if (!candidates) return null;
        for (const candidate of candidates) {
          const current = unwrapExpression(candidate);
          const candidateInvocation = ts.isCallExpression(current)
            ? staticGlobalCallInvocation(current)
            : null;
          if (
            invocation.descriptor === "Promise.any" &&
            candidateInvocation?.descriptor === "Promise.reject"
          ) {
            continue;
          }
          return candidateInvocation?.descriptor === "Promise.resolve"
            ? (candidateInvocation.arguments[0] ?? null)
            : candidate;
        }
        return null;
      }
      const callee = unwrapExpression(call.expression);
      const methodName = propertyAccessName(callee);
      if (
        !methodName ||
        (!ts.isPropertyAccessExpression(callee) &&
          !ts.isElementAccessExpression(callee))
      ) {
        return null;
      }
      if (methodName === "then") {
        const receiver = unwrapExpression(callee.expression);
        const receiverInvocation = ts.isCallExpression(receiver)
          ? staticGlobalCallInvocation(receiver)
          : null;
        const settled =
          receiverInvocation?.descriptor === "Promise.resolve"
            ? (receiverInvocation.arguments[0] ?? null)
            : receiverInvocation?.descriptor === "Promise.all"
              ? (receiverInvocation.arguments[0] ?? null)
              : ts.isCallExpression(receiver)
                ? staticTransparentCallResultExpression(receiver)
                : dereferenceStaticExpression(receiver);
        if (!settled) return null;
        const callback = call.arguments[0];
        return callback ? staticCallbackValue(callback, [settled]) : settled;
      }
      if (methodName === "get" && call.arguments[0]) {
        const requestedKey = resolveStaticString(call.arguments[0]);
        const entries = staticMapEntryElements(callee.expression, new Set());
        if (requestedKey === null || !entries) return null;
        for (const entry of [...entries].reverse()) {
          const tuple = staticArrayElements(entry, new Set());
          if (
            tuple?.[0] &&
            tuple[1] &&
            resolveStaticString(tuple[0]) === requestedKey
          ) {
            return tuple[1];
          }
        }
        return null;
      }
      // Only these methods can return a static array value here. Walking an
      // unrelated fluent API receiver repeatedly expands the same call chain.
      if (!["at", "pop", "shift", "find", "findLast", "reduce"].includes(methodName)) {
        return null;
      }
      const elements = staticArrayElements(callee.expression, new Set());
      if (!elements) return null;
      if (methodName === "at" && call.arguments[0]) {
        const indexExpression = unwrapExpression(call.arguments[0]);
        const rawIndex = ts.isNumericLiteral(indexExpression)
          ? indexExpression.text
          : ts.isPrefixUnaryExpression(indexExpression) &&
              (indexExpression.operator === ts.SyntaxKind.MinusToken ||
                indexExpression.operator === ts.SyntaxKind.PlusToken) &&
              ts.isNumericLiteral(unwrapExpression(indexExpression.operand))
            ? `${
                indexExpression.operator === ts.SyntaxKind.MinusToken ? "-" : ""
              }${unwrapExpression(indexExpression.operand).getText(source)}`
            : resolveStaticString(indexExpression);
        const index = rawIndex === null ? Number.NaN : Number(rawIndex);
        if (!Number.isInteger(index)) return null;
        return elements[index < 0 ? elements.length + index : index] ?? null;
      }
      if (methodName === "pop") return elements.at(-1) ?? null;
      if (methodName === "shift") return elements[0] ?? null;
      if (
        (methodName === "find" || methodName === "findLast") &&
        call.arguments[0]
      ) {
        const callback = staticCallbackFunctionLike(call.arguments[0]);
        const booleanPredicate =
          staticGlobalReferenceDescriptor(call.arguments[0]) === "Boolean";
        if (!callback && !booleanPredicate) return null;
        const candidates =
          methodName === "findLast" ? [...elements].reverse() : elements;
        for (const element of candidates) {
          const originalIndex = elements.indexOf(element);
          const callArguments = [
            element,
            ts.factory.createNumericLiteral(originalIndex),
          ];
          const returned = callback
            ? staticEvaluatedFunctionReturnExpression(
                callback,
                callArguments,
                new Set(),
              )
            : null;
          const matches = booleanPredicate
            ? staticExpressionTruthiness(element, new Set())
            : returned && callback
              ? staticMapperCondition(
                  returned,
                  callback,
                  callArguments,
                  new Set(),
                )
              : null;
          if (matches === null) return null;
          if (matches) return element;
        }
      }
      if (methodName === "reduce" && call.arguments[0]) {
        const reducer = staticCallbackFunctionLike(call.arguments[0]);
        if (!reducer) return null;
        const accumulatorParameter = reducer.parameters[0];
        const accumulatorName =
          accumulatorParameter && ts.isIdentifier(accumulatorParameter.name)
            ? accumulatorParameter.name.text
            : null;
        let mutatesAccumulator = false;
        const visitMutation = (node: ts.Node) => {
          if (node !== reducer && ts.isFunctionLike(node)) return;
          if (ts.isCallExpression(node)) {
            const target = unwrapExpression(node.expression);
            const receiver =
              ts.isPropertyAccessExpression(target) ||
              ts.isElementAccessExpression(target)
                ? unwrapExpression(target.expression)
                : null;
            if (
              propertyAccessName(target) === "push" &&
              receiver &&
              ts.isIdentifier(receiver) &&
              receiver.text === accumulatorName
            ) {
              mutatesAccumulator = true;
            }
          }
          ts.forEachChild(node, visitMutation);
        };
        visitMutation(reducer);
        if (mutatesAccumulator || elements.length === 0) return null;
        let accumulator = call.arguments[1] ?? elements[0];
        const startIndex = call.arguments[1] ? 0 : 1;
        for (let index = startIndex; index < elements.length; index += 1) {
          const reduced = staticEvaluatedFunctionReturnExpression(
            reducer,
            [
              accumulator,
              elements[index],
              ts.factory.createNumericLiteral(index),
            ],
            new Set(),
          );
          if (!reduced) return null;
          accumulator = reduced;
        }
        return accumulator;
      }
      return null;
    };
    const canonicalReactHookBinding = (
      expression: ts.Expression,
    ): {
      readonly binding: StaticBindingRecord;
      readonly path: readonly StaticAccessSegment[];
    } | null => {
      const access = staticAccessForExpression(expression);
      if (!access?.path) return null;
      let binding = staticBindingForIdentifier(access.identifier);
      if (!binding) return null;
      let path: readonly StaticAccessSegment[] = [...access.path];
      const seenBindings = new Set<string>();
      while (!seenBindings.has(binding.key)) {
        seenBindings.add(binding.key);
        path = [...binding.accessPath, ...path];
        if (!binding.initializer) break;
        const initializerAccess = staticAccessForExpression(
          binding.initializer,
        );
        if (!initializerAccess?.path) break;
        const nextBinding = staticBindingForIdentifier(
          initializerAccess.identifier,
        );
        if (!nextBinding) break;
        path = [...initializerAccess.path, ...path];
        binding = nextBinding;
      }
      return { binding, path };
    };
    const staticReactHookVisibleExpressions = (
      expression: ts.Expression,
    ): readonly ts.Expression[] => {
      const current = unwrapExpression(expression);
      if (ts.isCallExpression(current)) {
        const invocation = staticGlobalCallInvocation(current);
        if (invocation?.descriptor === "react.useMemo") {
          const value = invocation.arguments[0]
            ? staticCallbackValue(invocation.arguments[0])
            : null;
          return value ? [value] : [];
        }
        return [];
      }
      const hookBinding = canonicalReactHookBinding(current);
      const binding = hookBinding?.binding ?? null;
      const initializer = binding?.initializer
        ? unwrapExpression(binding.initializer)
        : null;
      if (!binding || !initializer || !ts.isCallExpression(initializer)) {
        return [];
      }
      const invocation = staticGlobalCallInvocation(initializer);
      if (!invocation) return [];
      const fullPath = hookBinding?.path ?? [];
      if (invocation.descriptor === "react.useState") {
        if (fullPath[0] !== 0 || !invocation.arguments[0]) return [];
        const initialValue = invocation.arguments[0];
        const value = staticCallbackValue(initialValue) ?? initialValue;
        const candidates: ts.Expression[] = [value];
        const visitSetters = (node: ts.Node) => {
          if (ts.isCallExpression(node)) {
            const callee = unwrapExpression(node.expression);
            const setterBinding = canonicalReactHookBinding(callee);
            if (
              setterBinding?.binding.initializer === binding.initializer &&
              setterBinding.path[0] === 1 &&
              node.arguments[0]
            ) {
              candidates.push(
                staticCallbackValue(node.arguments[0], [value]) ??
                  node.arguments[0],
              );
            }
          }
          ts.forEachChild(node, visitSetters);
        };
        visitSetters(source);
        return candidates.flatMap((candidate) => {
          const projected =
            fullPath.length === 1
              ? candidate
              : staticExpressionAtPath(candidate, fullPath.slice(1));
          return projected ? [projected] : [];
        });
      }
      if (invocation.descriptor === "react.useReducer") {
        if (fullPath[0] !== 0 || !invocation.arguments[1]) return [];
        const initialValue = invocation.arguments[2]
          ? staticCallbackValue(invocation.arguments[2], [
              invocation.arguments[1],
            ])
          : invocation.arguments[1];
        if (!initialValue) return [];
        const candidates: ts.Expression[] = [initialValue];
        const reducer = invocation.arguments[0]
          ? staticCallbackFunctionLike(invocation.arguments[0])
          : null;
        if (reducer) {
          const visitDispatches = (node: ts.Node) => {
            if (ts.isCallExpression(node)) {
              const dispatchBinding = canonicalReactHookBinding(
                unwrapExpression(node.expression),
              );
              if (
                dispatchBinding?.binding.initializer === binding.initializer &&
                dispatchBinding.path[0] === 1 &&
                node.arguments[0]
              ) {
                const reduced = staticEvaluatedFunctionReturnExpression(
                  reducer,
                  [initialValue, node.arguments[0]],
                  new Set(),
                );
                if (reduced) candidates.push(reduced);
              }
            }
            ts.forEachChild(node, visitDispatches);
          };
          visitDispatches(source);
        }
        return candidates.flatMap((candidate) => {
          const projected =
            fullPath.length === 1
              ? candidate
              : staticExpressionAtPath(candidate, fullPath.slice(1));
          return projected ? [projected] : [];
        });
      }
      if (invocation.descriptor === "react.useMemo") {
        if (!invocation.arguments[0]) return [];
        const value = staticCallbackValue(invocation.arguments[0]);
        if (!value) return [];
        const projected =
          fullPath.length === 0
            ? value
            : staticExpressionAtPath(value, fullPath);
        return projected ? [projected] : [];
      }
      if (invocation.descriptor === "react.useRef") {
        if (fullPath[0] !== "current" || !invocation.arguments[0]) return [];
        const value = invocation.arguments[0];
        const projected =
          fullPath.length === 1
            ? value
            : staticExpressionAtPath(value, fullPath.slice(1));
        return projected ? [projected] : [];
      }
      return [];
    };
    type StaticMutationRecord = {
      readonly accessPath: readonly StaticAccessSegment[] | null;
      readonly expression: ts.Expression;
      readonly mode: "assignment" | "binding-assignment" | "object-assign";
    };
    const staticMutationsByBindingKey = new Map<
      string,
      StaticMutationRecord[]
    >();
    type StaticShallowCopyRelation = {
      readonly sourcePath: readonly StaticAccessSegment[];
      readonly targetBinding: StaticBindingRecord;
      readonly targetPath: readonly StaticAccessSegment[];
      readonly minimumSharedDepth: number;
      readonly targetArrayIndexOffset: number;
    };
    const staticShallowCopiesByBindingKey = new Map<
      string,
      StaticShallowCopyRelation[]
    >();
    const rootStaticIdentifier = (
      expression: ts.Expression,
    ): ts.Identifier | null => {
      let current = unwrapExpression(expression);
      while (
        ts.isPropertyAccessExpression(current) ||
        ts.isElementAccessExpression(current)
      ) {
        current = unwrapExpression(current.expression);
      }
      return ts.isIdentifier(current) ? current : null;
    };
    const staticBindingForReference = (expression: ts.Expression) => {
      const identifier = rootStaticIdentifier(expression);
      return identifier ? staticBindingForIdentifier(identifier) : null;
    };
    const staticAccessForExpression = (
      expression: ts.Expression,
    ): {
      readonly identifier: ts.Identifier;
      readonly path: readonly StaticAccessSegment[] | null;
    } | null => {
      const current = unwrapExpression(expression);
      if (ts.isIdentifier(current)) {
        return { identifier: current, path: [] };
      }
      if (ts.isPropertyAccessExpression(current)) {
        const base = staticAccessForExpression(current.expression);
        if (!base) return null;
        return {
          identifier: base.identifier,
          path: base.path ? [...base.path, current.name.text] : null,
        };
      }
      if (ts.isElementAccessExpression(current)) {
        const base = staticAccessForExpression(current.expression);
        if (!base) return null;
        const argument = current.argumentExpression;
        const segment = ts.isStringLiteral(argument)
          ? argument.text
          : ts.isNumericLiteral(argument)
            ? Number(argument.text)
            : null;
        return {
          identifier: base.identifier,
          path: base.path && segment !== null ? [...base.path, segment] : null,
        };
      }
      return null;
    };
    const arrayRestOffsetForIdentifier = (identifier: ts.Identifier) => {
      let binding = staticBindingForIdentifier(identifier);
      let offset = 0;
      const seen = new Set<string>();
      while (binding && !seen.has(binding.key)) {
        seen.add(binding.key);
        offset += binding.arrayRestOffset ?? 0;
        if (!binding.initializer) break;
        const initializerAccess = staticAccessForExpression(
          binding.initializer,
        );
        if (
          !initializerAccess ||
          initializerAccess.path === null ||
          initializerAccess.path.length > 0
        ) {
          break;
        }
        binding = staticBindingForIdentifier(initializerAccess.identifier);
      }
      return offset;
    };
    const canonicalStaticAccessTarget = (
      access: NonNullable<ReturnType<typeof staticAccessForExpression>>,
    ): {
      readonly binding: StaticBindingRecord;
      readonly path: readonly StaticAccessSegment[] | null;
    } | null => {
      let binding = staticBindingForIdentifier(access.identifier);
      if (!binding) return null;
      let path = access.path;
      const seenBindings = new Set<string>();
      while (binding.initializer && !seenBindings.has(binding.key)) {
        if (binding.arrayRestOffset !== null) break;
        seenBindings.add(binding.key);
        const initializerAccess = staticAccessForExpression(
          binding.initializer,
        );
        if (!initializerAccess) break;
        const initializerValue = dereferenceStaticExpression(
          binding.initializer,
        );
        const isReferenceValue = Boolean(
          initializerValue &&
          (ts.isObjectLiteralExpression(initializerValue) ||
            ts.isArrayLiteralExpression(initializerValue) ||
            isUnshadowedObjectMethodCall(initializerValue, ["assign"])),
        );
        if (initializerAccess.path?.length && !isReferenceValue) break;
        const initializerBinding = staticBindingForIdentifier(
          initializerAccess.identifier,
        );
        if (!initializerBinding) break;
        path =
          path && initializerAccess.path
            ? [...initializerAccess.path, ...binding.accessPath, ...path]
            : null;
        binding = initializerBinding;
      }
      return { binding, path };
    };
    const assignmentOperatorKinds = new Set<ts.SyntaxKind>([
      ts.SyntaxKind.EqualsToken,
      ts.SyntaxKind.PlusEqualsToken,
      ts.SyntaxKind.MinusEqualsToken,
      ts.SyntaxKind.AsteriskEqualsToken,
      ts.SyntaxKind.AsteriskAsteriskEqualsToken,
      ts.SyntaxKind.SlashEqualsToken,
      ts.SyntaxKind.PercentEqualsToken,
      ts.SyntaxKind.LessThanLessThanEqualsToken,
      ts.SyntaxKind.GreaterThanGreaterThanEqualsToken,
      ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken,
      ts.SyntaxKind.AmpersandEqualsToken,
      ts.SyntaxKind.BarEqualsToken,
      ts.SyntaxKind.CaretEqualsToken,
      ts.SyntaxKind.BarBarEqualsToken,
      ts.SyntaxKind.AmpersandAmpersandEqualsToken,
      ts.SyntaxKind.QuestionQuestionEqualsToken,
    ]);
    const accessPathStartsWith = (
      value: readonly StaticAccessSegment[],
      prefix: readonly StaticAccessSegment[],
    ) =>
      prefix.length <= value.length &&
      prefix.every((segment, index) => value[index] === segment);
    const priorMutationsForStaticAccess = (
      access: NonNullable<ReturnType<typeof staticAccessForExpression>>,
    ): Array<{
      readonly relativePath: readonly StaticAccessSegment[] | null;
      readonly mutation: StaticMutationRecord;
    }> => {
      const target = canonicalStaticAccessTarget(access);
      if (!target) return [];
      const mutations = [
        ...(staticMutationsByBindingKey.get(target.binding.key) ?? []),
      ];
      const results: Array<{
        readonly relativePath: readonly StaticAccessSegment[] | null;
        readonly mutation: StaticMutationRecord;
      }> = [];
      mutations.forEach((mutation) => {
        if (!target.path || !mutation.accessPath) {
          results.push({ relativePath: null, mutation });
          return;
        }
        if (accessPathStartsWith(mutation.accessPath, target.path)) {
          results.push({
            relativePath: mutation.accessPath.slice(target.path.length),
            mutation,
          });
          return;
        }
        if (accessPathStartsWith(target.path, mutation.accessPath)) {
          results.push({ relativePath: [], mutation });
        }
      });
      return results;
    };
    const registerStaticShallowCopy = (
      sourceExpression: ts.Expression,
      targetBinding: StaticBindingRecord,
      targetPath: readonly StaticAccessSegment[],
      minimumSharedDepth: number,
      targetArrayIndexOffset = 0,
    ) => {
      const sourceAccess = staticAccessForExpression(sourceExpression);
      const sourceTarget = sourceAccess
        ? canonicalStaticAccessTarget(sourceAccess)
        : null;
      if (!sourceAccess || !sourceTarget?.path) return;
      const relations =
        staticShallowCopiesByBindingKey.get(sourceTarget.binding.key) ?? [];
      relations.push({
        sourcePath: sourceTarget.path,
        targetBinding,
        targetPath,
        minimumSharedDepth,
        targetArrayIndexOffset,
      });
      staticShallowCopiesByBindingKey.set(sourceTarget.binding.key, relations);

      const targetMutations =
        staticMutationsByBindingKey.get(targetBinding.key) ?? [];
      priorMutationsForStaticAccess(sourceAccess).forEach(
        ({ relativePath, mutation }) => {
          const mappedRelativePath =
            relativePath &&
            targetArrayIndexOffset !== 0 &&
            typeof relativePath[0] === "number"
              ? [
                  relativePath[0] + targetArrayIndexOffset,
                  ...relativePath.slice(1),
                ]
              : relativePath;
          targetMutations.push({
            accessPath: mappedRelativePath
              ? [...targetPath, ...mappedRelativePath]
              : null,
            expression: mutation.expression,
            mode: mutation.mode,
          });
        },
      );
      staticMutationsByBindingKey.set(targetBinding.key, targetMutations);
    };
    const registerStaticArrayCopy = (
      sourceExpression: ts.Expression,
      targetBinding: StaticBindingRecord,
      targetIndexOffset = 0,
    ): number | null => {
      registerStaticShallowCopy(
        sourceExpression,
        targetBinding,
        [],
        2,
        targetIndexOffset,
      );
      const elements = staticArrayElements(sourceExpression, new Set());
      if (!elements) return null;
      elements.forEach((element, index) => {
        registerStaticShallowCopy(
          element,
          targetBinding,
          [targetIndexOffset + index],
          1,
        );
      });
      return elements.length;
    };
    const callbackParameterProjectionPath = (
      expression: ts.Expression,
      callback: ts.FunctionLikeDeclaration,
      seenBindings: ReadonlySet<string> = new Set(),
    ): {
      readonly parameterIndex: number;
      readonly path: readonly StaticAccessSegment[];
    } | null => {
      const projectionForBindingName = (
        name: ts.BindingName,
        identifierName: string,
        path: readonly StaticAccessSegment[] = [],
      ): readonly StaticAccessSegment[] | null => {
        if (ts.isIdentifier(name)) {
          return name.text === identifierName ? path : null;
        }
        for (const [index, element] of [...name.elements].entries()) {
          if (!ts.isBindingElement(element)) continue;
          const segment = ts.isObjectBindingPattern(name)
            ? (bindingPropertyName(element.propertyName) ??
              (ts.isIdentifier(element.name) ? element.name.text : null))
            : index;
          if (segment === null) continue;
          const nested = projectionForBindingName(
            element.name,
            identifierName,
            element.dotDotDotToken ? path : [...path, segment],
          );
          if (nested) return nested;
        }
        return null;
      };
      const current = unwrapExpression(expression);
      if (ts.isIdentifier(current)) {
        for (const [parameterIndex, parameter] of [
          ...callback.parameters,
        ].entries()) {
          const path = projectionForBindingName(parameter.name, current.text);
          if (path) return { parameterIndex, path };
        }
        const binding = staticBindingForIdentifier(current);
        if (
          binding?.initializer &&
          !seenBindings.has(binding.key) &&
          binding.initializer.pos >= callback.pos &&
          binding.initializer.end <= callback.end
        ) {
          return callbackParameterProjectionPath(
            binding.initializer,
            callback,
            new Set(seenBindings).add(binding.key),
          );
        }
        return null;
      }
      if (
        ts.isPropertyAccessExpression(current) ||
        ts.isElementAccessExpression(current)
      ) {
        const access = staticAccessForExpression(current);
        if (!access?.path) return null;
        const base = callbackParameterProjectionPath(
          access.identifier,
          callback,
          seenBindings,
        );
        return base ? { ...base, path: [...base.path, ...access.path] } : null;
      }
      return null;
    };
    const registerStaticMappedArrayCopy = (
      sourceExpression: ts.Expression,
      mapperExpression: ts.Expression,
      targetBinding: StaticBindingRecord,
    ) => {
      const callback = staticCallbackFunctionLike(mapperExpression);
      const sourceAccess = staticAccessForExpression(sourceExpression);
      const sourceTarget = sourceAccess
        ? canonicalStaticAccessTarget(sourceAccess)
        : null;
      const sourceElements = staticArrayElements(sourceExpression, new Set());
      if (!callback || !sourceElements) return false;
      const callbackReturns = functionLikeReturnExpressions(callback);
      const sharedProjections = (
        expression: ts.Expression,
        targetPath: readonly StaticAccessSegment[] = [],
      ): Array<{
        readonly sourcePath: readonly StaticAccessSegment[];
        readonly targetPath: readonly StaticAccessSegment[];
      }> => {
        const raw = unwrapExpression(expression);
        if (ts.isPropertyAccessExpression(raw)) {
          const container = unwrapExpression(raw.expression);
          if (ts.isObjectLiteralExpression(container)) {
            const initializer = objectPropertyInitializer(
              container,
              raw.name.text,
              new Set(),
            );
            if (initializer) return sharedProjections(initializer, targetPath);
          }
        }
        const current = unwrapExpression(
          dereferenceStaticExpression(expression) ?? expression,
        );
        const direct = callbackParameterProjectionPath(current, callback);
        if (direct?.parameterIndex === 0) {
          return [{ sourcePath: direct.path, targetPath }];
        }
        if (ts.isObjectLiteralExpression(current)) {
          return current.properties.flatMap((property) => {
            if (ts.isPropertyAssignment(property)) {
              const name = bindingPropertyName(property.name);
              return name === null
                ? []
                : sharedProjections(property.initializer, [
                    ...targetPath,
                    name,
                  ]);
            }
            if (ts.isShorthandPropertyAssignment(property)) {
              return sharedProjections(property.name, [
                ...targetPath,
                property.name.text,
              ]);
            }
            if (ts.isSpreadAssignment(property)) {
              return sharedProjections(property.expression, targetPath);
            }
            return [];
          });
        }
        if (ts.isArrayLiteralExpression(current)) {
          return current.elements.flatMap((element, index) =>
            ts.isOmittedExpression(element)
              ? []
              : sharedProjections(
                  ts.isSpreadElement(element) ? element.expression : element,
                  [...targetPath, index],
                ),
          );
        }
        return [];
      };
      let registered = false;
      sourceElements.forEach((sourceElement, sourceIndex) => {
        const mapped =
          callbackReturns.length === 1
            ? callbackReturns[0]
            : staticMappedCallbackReturnExpression(
                mapperExpression,
                sourceElement,
                sourceIndex,
                new Set(),
              );
        if (!mapped) return;
        const projections = sharedProjections(mapped);
        for (const projection of projections) {
          const elementAccess = staticAccessForExpression(sourceElement);
          const elementTarget = elementAccess
            ? canonicalStaticAccessTarget(elementAccess)
            : null;
          const relationSource = sourceTarget?.path
            ? {
                binding: sourceTarget.binding,
                path: [
                  ...sourceTarget.path,
                  sourceIndex,
                  ...projection.sourcePath,
                ],
              }
            : elementTarget?.path
              ? {
                  binding: elementTarget.binding,
                  path: [...elementTarget.path, ...projection.sourcePath],
                }
              : null;
          if (!relationSource) continue;
          const targetPath = [sourceIndex, ...projection.targetPath];
          const relations =
            staticShallowCopiesByBindingKey.get(relationSource.binding.key) ??
            [];
          relations.push({
            sourcePath: relationSource.path,
            targetBinding,
            targetPath,
            minimumSharedDepth: 1,
            targetArrayIndexOffset: 0,
          });
          staticShallowCopiesByBindingKey.set(
            relationSource.binding.key,
            relations,
          );
          const targetMutations =
            staticMutationsByBindingKey.get(targetBinding.key) ?? [];
          for (const mutation of staticMutationsByBindingKey.get(
            relationSource.binding.key,
          ) ?? []) {
            if (
              mutation.accessPath &&
              accessPathStartsWith(mutation.accessPath, relationSource.path) &&
              mutation.accessPath.length > relationSource.path.length
            ) {
              targetMutations.push({
                ...mutation,
                accessPath: [
                  ...targetPath,
                  ...mutation.accessPath.slice(relationSource.path.length),
                ],
              });
            }
          }
          staticMutationsByBindingKey.set(targetBinding.key, targetMutations);
          registered = true;
        }
      });
      return registered;
    };
    const registerStaticProjectionRelation = (
      sourceExpression: ts.Expression,
      sourceSuffix: readonly StaticAccessSegment[],
      targetBinding: StaticBindingRecord,
      targetPath: readonly StaticAccessSegment[],
      minimumSharedDepth = 1,
    ) => {
      const sourceAccess = staticAccessForExpression(sourceExpression);
      const sourceTarget = sourceAccess
        ? canonicalStaticAccessTarget(sourceAccess)
        : null;
      if (!sourceTarget?.path) return false;
      const sourcePath = [...sourceTarget.path, ...sourceSuffix];
      const relations =
        staticShallowCopiesByBindingKey.get(sourceTarget.binding.key) ?? [];
      relations.push({
        sourcePath,
        targetBinding,
        targetPath,
        minimumSharedDepth,
        targetArrayIndexOffset: 0,
      });
      staticShallowCopiesByBindingKey.set(sourceTarget.binding.key, relations);
      const targetMutations =
        staticMutationsByBindingKey.get(targetBinding.key) ?? [];
      for (const mutation of staticMutationsByBindingKey.get(
        sourceTarget.binding.key,
      ) ?? []) {
        if (
          mutation.accessPath &&
          accessPathStartsWith(mutation.accessPath, sourcePath) &&
          mutation.accessPath.length > sourcePath.length
        ) {
          targetMutations.push({
            ...mutation,
            accessPath: [
              ...targetPath,
              ...mutation.accessPath.slice(sourcePath.length),
            ],
          });
        }
      }
      staticMutationsByBindingKey.set(targetBinding.key, targetMutations);
      return true;
    };
    const staticSharedReturnProjections = (
      expression: ts.Expression,
      callable: ts.FunctionLikeDeclaration,
      targetPath: readonly StaticAccessSegment[] = [],
    ): Array<{
      readonly parameterIndex: number;
      readonly sourcePath: readonly StaticAccessSegment[];
      readonly targetPath: readonly StaticAccessSegment[];
    }> => {
      const raw = unwrapExpression(expression);
      if (ts.isPropertyAccessExpression(raw)) {
        const container = unwrapExpression(raw.expression);
        if (ts.isObjectLiteralExpression(container)) {
          const initializer = objectPropertyInitializer(
            container,
            raw.name.text,
            new Set(),
          );
          if (initializer) {
            return staticSharedReturnProjections(
              initializer,
              callable,
              targetPath,
            );
          }
        }
      }
      const current = unwrapExpression(
        dereferenceStaticExpression(expression) ?? expression,
      );
      const direct = callbackParameterProjectionPath(current, callable);
      if (direct) {
        return [
          {
            parameterIndex: direct.parameterIndex,
            sourcePath: direct.path,
            targetPath,
          },
        ];
      }
      if (ts.isObjectLiteralExpression(current)) {
        return current.properties.flatMap((property) => {
          if (ts.isPropertyAssignment(property)) {
            const name = bindingPropertyName(property.name);
            return name === null
              ? []
              : staticSharedReturnProjections(property.initializer, callable, [
                  ...targetPath,
                  name,
                ]);
          }
          if (ts.isShorthandPropertyAssignment(property)) {
            return staticSharedReturnProjections(property.name, callable, [
              ...targetPath,
              property.name.text,
            ]);
          }
          if (ts.isSpreadAssignment(property)) {
            return staticSharedReturnProjections(
              property.expression,
              callable,
              targetPath,
            );
          }
          return [];
        });
      }
      if (ts.isArrayLiteralExpression(current)) {
        return current.elements.flatMap((element, index) =>
          ts.isOmittedExpression(element)
            ? []
            : staticSharedReturnProjections(
                ts.isSpreadElement(element) ? element.expression : element,
                callable,
                [...targetPath, index],
              ),
        );
      }
      return [];
    };
    const registerStaticLocalCallShallowCopy = (
      call: ts.CallExpression,
      targetBinding: StaticBindingRecord,
    ) => {
      const invocation = staticLocalInvocationForCall(call);
      if (!invocation) return false;
      const returns = functionLikeReturnExpressions(invocation.callable);
      if (returns.length !== 1) return false;
      let registered = false;
      for (const projection of staticSharedReturnProjections(
        returns[0],
        invocation.callable,
      )) {
        const argument = invocation.arguments[projection.parameterIndex];
        if (!argument) continue;
        registered =
          registerStaticProjectionRelation(
            argument,
            projection.sourcePath,
            targetBinding,
            projection.targetPath,
          ) || registered;
      }
      return registered;
    };
    const registerStaticLocalConstructorShallowCopy = (
      expression: ts.NewExpression,
      targetBinding: StaticBindingRecord,
    ) => {
      const constructorExpression = unwrapExpression(expression.expression);
      const binding = ts.isIdentifier(constructorExpression)
        ? staticBindingForIdentifier(constructorExpression)
        : null;
      let classDeclaration = binding
        ? (staticClassByBindingKey.get(binding.key) ?? null)
        : null;
      if (!classDeclaration && binding?.initializer) {
        const initializer = unwrapExpression(binding.initializer);
        if (ts.isClassExpression(initializer)) classDeclaration = initializer;
      }
      const constructor = classDeclaration?.members.find(
        ts.isConstructorDeclaration,
      );
      if (!constructor || !expression.arguments) return false;
      let registered = false;
      const thisAccessPath = (
        left: ts.Expression,
      ): readonly StaticAccessSegment[] | null => {
        const current = unwrapExpression(left);
        if (ts.isPropertyAccessExpression(current)) {
          const parent = thisAccessPath(current.expression);
          return parent ? [...parent, current.name.text] : null;
        }
        if (
          ts.isElementAccessExpression(current) &&
          current.argumentExpression
        ) {
          const parent = thisAccessPath(current.expression);
          const segment = ts.isNumericLiteral(current.argumentExpression)
            ? Number(current.argumentExpression.text)
            : resolveStaticString(current.argumentExpression);
          return parent && segment !== null ? [...parent, segment] : null;
        }
        return current.kind === ts.SyntaxKind.ThisKeyword ? [] : null;
      };
      const visitAssignment = (node: ts.Node) => {
        if (node !== constructor && ts.isFunctionLike(node)) return;
        if (
          ts.isBinaryExpression(node) &&
          node.operatorToken.kind === ts.SyntaxKind.EqualsToken
        ) {
          const targetPath = thisAccessPath(node.left);
          if (targetPath) {
            for (const projection of staticSharedReturnProjections(
              node.right,
              constructor,
              targetPath,
            )) {
              const argument =
                expression.arguments?.[projection.parameterIndex];
              if (!argument) continue;
              registered =
                registerStaticProjectionRelation(
                  argument,
                  projection.sourcePath,
                  targetBinding,
                  projection.targetPath,
                ) || registered;
            }
          }
        }
        if (
          ts.isCallExpression(node) &&
          isUnshadowedObjectMethodCall(node, ["assign"]) &&
          node.arguments.length >= 2
        ) {
          const targetPath = thisAccessPath(node.arguments[0]);
          if (targetPath) {
            for (const sourceExpression of node.arguments.slice(1)) {
              for (const projection of staticSharedReturnProjections(
                sourceExpression,
                constructor,
                targetPath,
              )) {
                const argument =
                  expression.arguments?.[projection.parameterIndex];
                if (!argument) continue;
                registered =
                  registerStaticProjectionRelation(
                    argument,
                    projection.sourcePath,
                    targetBinding,
                    projection.targetPath,
                    2,
                  ) || registered;
              }
            }
          }
        }
        ts.forEachChild(node, visitAssignment);
      };
      visitAssignment(constructor);
      return registered;
    };
    const propagateStaticMutationToShallowCopies = (
      sourceBinding: StaticBindingRecord,
      sourcePath: readonly StaticAccessSegment[] | null,
      expression: ts.Expression,
      mode: StaticMutationRecord["mode"],
      seenRelations: ReadonlySet<string> = new Set(),
    ) => {
      if (!sourcePath) return;
      const relations =
        staticShallowCopiesByBindingKey.get(sourceBinding.key) ?? [];
      relations.forEach((relation, index) => {
        if (!accessPathStartsWith(sourcePath, relation.sourcePath)) return;
        const relativePath = sourcePath.slice(relation.sourcePath.length);
        if (relativePath.length < relation.minimumSharedDepth) return;
        const mappedRelativePath =
          relation.targetArrayIndexOffset !== 0 &&
          typeof relativePath[0] === "number"
            ? [
                relativePath[0] + relation.targetArrayIndexOffset,
                ...relativePath.slice(1),
              ]
            : relativePath;
        const relationKey = `${sourceBinding.key}:${index}:${relation.targetBinding.key}`;
        if (seenRelations.has(relationKey)) return;
        const targetMutation = {
          accessPath: [...relation.targetPath, ...mappedRelativePath],
          expression,
          mode,
        } satisfies StaticMutationRecord;
        const targetMutations =
          staticMutationsByBindingKey.get(relation.targetBinding.key) ?? [];
        targetMutations.push(targetMutation);
        staticMutationsByBindingKey.set(
          relation.targetBinding.key,
          targetMutations,
        );
        propagateStaticMutationToShallowCopies(
          relation.targetBinding,
          targetMutation.accessPath,
          expression,
          mode,
          new Set(seenRelations).add(relationKey),
        );
      });
    };
    const collectStaticMutations = (node: ts.Node) => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isArrayBindingPattern(node.name) &&
        node.initializer
      ) {
        const initializer = node.initializer;
        node.name.elements.forEach((element, index) => {
          if (
            !ts.isBindingElement(element) ||
            !element.dotDotDotToken ||
            !ts.isIdentifier(element.name)
          ) {
            return;
          }
          const targetBinding = staticBindingForIdentifier(element.name);
          if (targetBinding) {
            staticArrayElements(initializer, new Set())
              ?.slice(index)
              .forEach((sourceElement, targetIndex) =>
                registerStaticShallowCopy(
                  sourceElement,
                  targetBinding,
                  [targetIndex],
                  1,
                ),
              );
          }
        });
      }
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer
      ) {
        const copySource = staticCopySourceExpression(node.initializer);
        const sourceAccess = copySource
          ? staticAccessForExpression(copySource)
          : null;
        const targetBinding = staticBindingForIdentifier(node.name);
        if (targetBinding) {
          const mutations =
            staticMutationsByBindingKey.get(targetBinding.key) ?? [];
          if (sourceAccess) {
            priorMutationsForStaticAccess(sourceAccess).forEach(
              ({ relativePath, mutation }) => {
                mutations.push({
                  accessPath: relativePath,
                  expression: mutation.expression,
                  mode: mutation.mode,
                });
              },
            );
          }
          const initializer = unwrapExpression(node.initializer);
          const initializerCopyInvocation = ts.isCallExpression(initializer)
            ? staticCopyInvocationForCall(initializer)
            : null;
          if (
            initializerCopyInvocation?.descriptor === "Array.from" &&
            initializerCopyInvocation.arguments.length >= 2 &&
            !staticArrayElements(initializer, new Set())
          ) {
            staticCallbackReturnExpressions(
              initializerCopyInvocation.arguments[1],
            ).forEach((expression) => {
              mutations.push({
                accessPath: null,
                expression,
                mode: "assignment",
              });
            });
          }
          staticMutationsByBindingKey.set(targetBinding.key, mutations);

          if (
            initializerCopyInvocation?.descriptor === "Array.from" &&
            initializerCopyInvocation.arguments.length >= 1
          ) {
            const mapper = initializerCopyInvocation.arguments[1];
            const mapperReturns = mapper
              ? staticCallbackReturnExpressions(mapper)
              : [];
            const mapperParameter = mapper
              ? staticCallbackFirstParameterName(mapper)
              : null;
            const preservesElementReferences =
              !mapper ||
              (mapperReturns.length === 1 &&
                mapperParameter &&
                ts.isIdentifier(unwrapExpression(mapperReturns[0])) &&
                unwrapExpression(mapperReturns[0]).getText(source) ===
                  mapperParameter);
            if (preservesElementReferences) {
              registerStaticArrayCopy(
                initializerCopyInvocation.arguments[0],
                targetBinding,
              );
            } else if (mapper) {
              registerStaticMappedArrayCopy(
                initializerCopyInvocation.arguments[0],
                mapper,
                targetBinding,
              );
            }
          } else if (initializerCopyInvocation?.descriptor === "Array.of") {
            let targetIndex = 0;
            for (const argument of initializerCopyInvocation.arguments) {
              if (ts.isSpreadElement(argument)) {
                const count = registerStaticArrayCopy(
                  argument.expression,
                  targetBinding,
                  targetIndex,
                );
                if (count === null) break;
                targetIndex += count;
              } else {
                registerStaticShallowCopy(
                  argument,
                  targetBinding,
                  [targetIndex],
                  1,
                );
                targetIndex += 1;
              }
            }
          } else if (
            initializerCopyInvocation?.descriptor === "Array" ||
            isUnshadowedGlobalConstructorCall(initializer, "Array")
          ) {
            const argumentsList = initializerCopyInvocation
              ? [...initializerCopyInvocation.arguments]
              : ts.isNewExpression(initializer)
                ? [...(initializer.arguments ?? [])]
                : [];
            if (!(
              argumentsList.length === 1 &&
              ts.isNumericLiteral(unwrapExpression(argumentsList[0]))
            )) {
              let targetIndex = 0;
              for (const argument of argumentsList) {
                if (ts.isSpreadElement(argument)) {
                  const count = registerStaticArrayCopy(
                    argument.expression,
                    targetBinding,
                    targetIndex,
                  );
                  if (count === null) break;
                  targetIndex += count;
                } else {
                  registerStaticShallowCopy(
                    argument,
                    targetBinding,
                    [targetIndex],
                    1,
                  );
                  targetIndex += 1;
                }
              }
            }
          } else if (
            initializerCopyInvocation?.descriptor === "Reflect.construct" &&
            initializerCopyInvocation.arguments.length >= 2 &&
            staticGlobalReferenceDescriptor(
              initializerCopyInvocation.arguments[0],
            ) === "Array"
          ) {
            registerStaticArrayCopy(
              initializerCopyInvocation.arguments[1],
              targetBinding,
            );
          } else if (
            initializerCopyInvocation?.descriptor === "Object.assign"
          ) {
            initializerCopyInvocation.arguments
              .slice(1)
              .forEach((argument) =>
                registerStaticShallowCopy(argument, targetBinding, [], 2),
              );
          } else if (
            initializerCopyInvocation?.descriptor === "Array.prototype.slice" &&
            initializerCopyInvocation.arguments.length >= 1
          ) {
            const startExpression = initializerCopyInvocation.arguments[1];
            const startsAtZero =
              !startExpression ||
              (ts.isNumericLiteral(unwrapExpression(startExpression)) &&
                Number(unwrapExpression(startExpression).getText(source)) ===
                  0);
            if (startsAtZero) {
              registerStaticArrayCopy(
                initializerCopyInvocation.arguments[0],
                targetBinding,
              );
            }
          } else if (
            initializerCopyInvocation?.descriptor ===
              "Array.prototype.concat" &&
            initializerCopyInvocation.arguments.length >= 1
          ) {
            const receiverCount = registerStaticArrayCopy(
              initializerCopyInvocation.arguments[0],
              targetBinding,
            );
            if (receiverCount !== null) {
              let targetIndex = receiverCount;
              for (const argument of initializerCopyInvocation.arguments.slice(
                1,
              )) {
                const elements = staticArrayElements(argument, new Set());
                if (elements) {
                  const count = registerStaticArrayCopy(
                    argument,
                    targetBinding,
                    targetIndex,
                  );
                  if (count === null) break;
                  targetIndex += count;
                } else {
                  registerStaticShallowCopy(
                    argument,
                    targetBinding,
                    [targetIndex],
                    1,
                  );
                  targetIndex += 1;
                }
              }
            }
          } else if (
            ts.isCallExpression(initializer) &&
            registerStaticLocalCallShallowCopy(initializer, targetBinding)
          ) {
            // The precise source/target relations are registered above.
          } else if (
            ts.isNewExpression(initializer) &&
            registerStaticLocalConstructorShallowCopy(
              initializer,
              targetBinding,
            )
          ) {
            // Constructor assignments preserve the registered nested aliases.
          } else if (ts.isArrayLiteralExpression(initializer)) {
            let targetIndex = 0;
            for (const element of initializer.elements) {
              if (ts.isOmittedExpression(element)) {
                targetIndex += 1;
              } else if (ts.isSpreadElement(element)) {
                const count = registerStaticArrayCopy(
                  element.expression,
                  targetBinding,
                  targetIndex,
                );
                if (count === null) break;
                targetIndex += count;
              } else {
                registerStaticShallowCopy(
                  element,
                  targetBinding,
                  [targetIndex],
                  1,
                );
                targetIndex += 1;
              }
            }
          } else if (ts.isObjectLiteralExpression(initializer)) {
            initializer.properties.forEach((property) => {
              if (ts.isSpreadAssignment(property)) {
                registerStaticShallowCopy(
                  property.expression,
                  targetBinding,
                  [],
                  2,
                );
              }
            });
          } else if (
            ts.isCallExpression(initializer) &&
            ts.isPropertyAccessExpression(initializer.expression)
          ) {
            const methodName = initializer.expression.name.text;
            const receiver = initializer.expression.expression;
            if (
              methodName === "slice" &&
              (initializer.arguments.length === 0 ||
                (initializer.arguments[0] &&
                  ts.isNumericLiteral(
                    unwrapExpression(initializer.arguments[0]),
                  ) &&
                  Number(
                    unwrapExpression(initializer.arguments[0]).getText(source),
                  ) === 0))
            ) {
              registerStaticArrayCopy(receiver, targetBinding);
            } else if (
              methodName === "filter" ||
              methodName === "flatMap" ||
              (methodName === "values" &&
                staticGlobalReferenceDescriptor(initializer.expression) ===
                  "Object.values")
            ) {
              const resultElements = staticArrayElements(
                initializer,
                new Set(),
              );
              resultElements?.forEach((element, index) =>
                registerStaticShallowCopy(element, targetBinding, [index], 1),
              );
            } else if (methodName === "map" && initializer.arguments[0]) {
              const mapper = initializer.arguments[0];
              const returns = staticCallbackReturnExpressions(mapper);
              const parameter = staticCallbackFirstParameterName(mapper);
              if (
                returns.length === 1 &&
                parameter &&
                ts.isIdentifier(unwrapExpression(returns[0])) &&
                unwrapExpression(returns[0]).getText(source) === parameter
              ) {
                registerStaticShallowCopy(receiver, targetBinding, [], 2);
              }
            } else if (methodName === "concat") {
              const receiverCount = registerStaticArrayCopy(
                receiver,
                targetBinding,
              );
              if (receiverCount !== null) {
                let targetIndex = receiverCount;
                for (const argument of initializer.arguments) {
                  const argumentElements = staticArrayElements(
                    argument,
                    new Set(),
                  );
                  if (argumentElements) {
                    const count = registerStaticArrayCopy(
                      argument,
                      targetBinding,
                      targetIndex,
                    );
                    if (count === null) break;
                    targetIndex += count;
                  } else {
                    registerStaticShallowCopy(
                      argument,
                      targetBinding,
                      [targetIndex],
                      1,
                    );
                    targetIndex += 1;
                  }
                }
              }
            }
          }
        }
      }
      if (
        ts.isBinaryExpression(node) &&
        assignmentOperatorKinds.has(node.operatorToken.kind)
      ) {
        const access = staticAccessForExpression(node.left);
        const identifier =
          access?.identifier ?? rootStaticIdentifier(node.left);
        const directBinding = identifier
          ? staticBindingForIdentifier(identifier)
          : null;
        const canonicalTarget =
          access && access.path?.length
            ? canonicalStaticAccessTarget(access)
            : null;
        const binding = canonicalTarget?.binding ?? directBinding;
        if (binding) {
          const mutations = staticMutationsByBindingKey.get(binding.key) ?? [];
          const targetPath = canonicalTarget?.path ?? access?.path ?? null;
          const mutationMode =
            access?.path?.length === 0 && ts.isIdentifier(node.left)
              ? "binding-assignment"
              : "assignment";
          mutations.push({
            accessPath: targetPath,
            expression: node.right,
            mode: mutationMode,
          });
          const sourceAccess = staticAccessForExpression(node.right);
          if (sourceAccess) {
            priorMutationsForStaticAccess(sourceAccess).forEach(
              ({ relativePath, mutation }) => {
                mutations.push({
                  accessPath:
                    targetPath && relativePath
                      ? [...targetPath, ...relativePath]
                      : null,
                  expression: mutation.expression,
                  mode: mutation.mode,
                });
              },
            );
          }
          staticMutationsByBindingKey.set(binding.key, mutations);
          propagateStaticMutationToShallowCopies(
            binding,
            targetPath,
            node.right,
            mutationMode,
          );
        }
      }
      if (
        ts.isCallExpression(node) &&
        isUnshadowedObjectMethodCall(node, ["assign"]) &&
        node.arguments.length >= 2
      ) {
        const targetAccess = staticAccessForExpression(node.arguments[0]);
        const target = targetAccess
          ? canonicalStaticAccessTarget(targetAccess)
          : null;
        if (target) {
          const mutations =
            staticMutationsByBindingKey.get(target.binding.key) ?? [];
          node.arguments.slice(1).forEach((expression) => {
            registerStaticShallowCopy(
              expression,
              target.binding,
              target.path ?? [],
              2,
            );
            mutations.push({
              accessPath: target.path,
              expression,
              mode: "object-assign",
            });
            const sourceAccess = staticAccessForExpression(expression);
            if (sourceAccess) {
              priorMutationsForStaticAccess(sourceAccess).forEach(
                ({ relativePath, mutation }) => {
                  mutations.push({
                    accessPath:
                      target.path && relativePath
                        ? [...target.path, ...relativePath]
                        : null,
                    expression: mutation.expression,
                    mode: mutation.mode,
                  });
                },
              );
            }
          });
          staticMutationsByBindingKey.set(target.binding.key, mutations);
        }
      }
      ts.forEachChild(node, collectStaticMutations);
    };
    const propertyNameText = (
      name: ts.PropertyName,
      seen: ReadonlySet<string>,
    ): string | null => {
      if (
        ts.isIdentifier(name) ||
        ts.isStringLiteral(name) ||
        ts.isNumericLiteral(name)
      ) {
        return name.text;
      }
      if (ts.isComputedPropertyName(name)) {
        return resolveStaticString(name.expression, seen);
      }
      return null;
    };
    const isStructuralObjectProperty = (
      property: ts.ObjectLiteralElementLike,
      object: ts.ObjectLiteralExpression,
    ) => {
      if (
        !ts.isPropertyAssignment(property) &&
        !ts.isShorthandPropertyAssignment(property)
      ) {
        return false;
      }
      const name = propertyNameText(property.name, new Set());
      if (name === "activeKey" || name === "key" || name === "kind") {
        return true;
      }
      if (name !== "value") return false;
      return object.properties.some((candidate) => {
        if (
          !ts.isPropertyAssignment(candidate) &&
          !ts.isShorthandPropertyAssignment(candidate)
        ) {
          return false;
        }
        const siblingName = propertyNameText(candidate.name, new Set());
        return ["description", "label", "text", "title"].includes(
          siblingName ?? "",
        );
      });
    };
    const structuralStringBindingNames = new Set([
      "activeItem",
      "activeKey",
      "primaryAction",
      "unauthenticatedPrimaryAction",
    ]);
    const isInsideStructuralObjectProperty = (node: ts.Node) => {
      let current = node;
      while (current.parent && !ts.isSourceFile(current.parent)) {
        const parent = current.parent;
        if (
          ts.isPropertyAssignment(parent) &&
          parent.initializer === current &&
          ts.isObjectLiteralExpression(parent.parent)
        ) {
          return isStructuralObjectProperty(parent, parent.parent);
        }
        if (
          ts.isShorthandPropertyAssignment(parent) &&
          parent.name === current &&
          ts.isObjectLiteralExpression(parent.parent)
        ) {
          return isStructuralObjectProperty(parent, parent.parent);
        }
        if (ts.isPropertyAssignment(parent)) return false;
        current = parent;
      }
      return false;
    };
    const isStructuralBindingDefault = (node: ts.Node) => {
      let current = node;
      while (
        current.parent &&
        (ts.isParenthesizedExpression(current.parent) ||
          ts.isAsExpression(current.parent) ||
          ts.isTypeAssertionExpression(current.parent) ||
          ts.isNonNullExpression(current.parent) ||
          ts.isSatisfiesExpression(current.parent))
      ) {
        current = current.parent;
      }
      const parent = current.parent;
      return Boolean(
        parent &&
        (ts.isParameter(parent) || ts.isBindingElement(parent)) &&
        parent.initializer === current &&
        ts.isIdentifier(parent.name) &&
        structuralStringBindingNames.has(parent.name.text),
      );
    };
    const isUnauditedStructuralValue = (
      node: ts.Node,
      translatorLocation: AuditedTranslatorLocation | null = null,
      translatorRelativePath: readonly TranslatorArgumentPathSegment[] = [],
    ) => {
      if (
        !isInsideStructuralObjectProperty(node) &&
        !isStructuralBindingDefault(node)
      ) {
        return false;
      }
      return translatorLocation
        ? isTranslatorControlPath(translatorLocation, translatorRelativePath)
        : translatorArgumentAuditDisposition(node) !== "audited";
    };
    const objectPropertyInitializer = (
      object: ts.ObjectLiteralExpression,
      propertyName: string,
      seen: ReadonlySet<string>,
    ): ts.Expression | null => {
      for (const property of [...object.properties].reverse()) {
        if (ts.isSpreadAssignment(property)) {
          const spread = dereferenceStaticExpression(property.expression, seen);
          if (spread && ts.isObjectLiteralExpression(spread)) {
            const nested = objectPropertyInitializer(
              spread,
              propertyName,
              seen,
            );
            if (nested) return nested;
          }
          continue;
        }
        if (
          ts.isPropertyAssignment(property) &&
          propertyNameText(property.name, seen) === propertyName
        ) {
          return property.initializer;
        }
        if (
          ts.isShorthandPropertyAssignment(property) &&
          property.name.text === propertyName
        ) {
          return property.name;
        }
        if (
          ts.isGetAccessorDeclaration(property) &&
          propertyNameText(property.name, seen) === propertyName
        ) {
          const returns = functionLikeReturnExpressions(property);
          if (returns.length === 1) return returns[0];
          return staticEvaluatedFunctionReturnExpression(property, [], seen);
        }
      }
      return null;
    };
    const objectAssignPropertyInitializer = (
      call: ts.CallExpression,
      propertyName: string,
      seen: ReadonlySet<string>,
    ): ts.Expression | null => {
      for (const sourceExpression of [...call.arguments].reverse()) {
        const sourceValue = dereferenceStaticExpression(sourceExpression, seen);
        if (!sourceValue) continue;
        if (ts.isObjectLiteralExpression(sourceValue)) {
          const initializer = objectPropertyInitializer(
            sourceValue,
            propertyName,
            seen,
          );
          if (initializer) return initializer;
          continue;
        }
        if (
          isUnshadowedObjectMethodCall(sourceValue, ["assign"]) &&
          sourceValue.arguments.length >= 1
        ) {
          const initializer = objectAssignPropertyInitializer(
            sourceValue,
            propertyName,
            seen,
          );
          if (initializer) return initializer;
        }
      }
      return null;
    };
    const flattenedArrayElements = (
      array: ts.ArrayLiteralExpression,
      seen: ReadonlySet<string>,
    ): ts.Expression[] | null => {
      const elements: ts.Expression[] = [];
      for (const element of array.elements) {
        if (ts.isOmittedExpression(element)) {
          return null;
        }
        if (ts.isSpreadElement(element)) {
          const nested = staticArrayElements(element.expression, seen);
          if (!nested) return null;
          elements.push(...nested);
        } else {
          elements.push(element);
        }
      }
      return elements;
    };
    const staticObjectValueElements = (
      expression: ts.Expression,
      seen: ReadonlySet<string>,
    ): ts.Expression[] | null => {
      const dereferenced = dereferenceStaticExpression(expression, seen);
      if (!dereferenced) return null;
      const current = unwrapExpression(dereferenced);
      if (!ts.isObjectLiteralExpression(current)) return null;
      const values: ts.Expression[] = [];
      for (const property of current.properties) {
        if (ts.isPropertyAssignment(property)) {
          values.push(property.initializer);
        } else if (ts.isShorthandPropertyAssignment(property)) {
          values.push(property.name);
        } else if (ts.isSpreadAssignment(property)) {
          const nested = staticObjectValueElements(property.expression, seen);
          if (!nested) return null;
          values.push(...nested);
        }
      }
      return values;
    };
    const staticObjectEntryElements = (
      expression: ts.Expression,
      seen: ReadonlySet<string>,
    ): ts.Expression[] | null => {
      const dereferenced = dereferenceStaticExpression(expression, seen);
      if (!dereferenced) return null;
      const current = unwrapExpression(dereferenced);
      if (!ts.isObjectLiteralExpression(current)) return null;
      const entries: ts.Expression[] = [];
      for (const property of current.properties) {
        if (
          ts.isPropertyAssignment(property) ||
          ts.isShorthandPropertyAssignment(property)
        ) {
          const name = propertyNameText(property.name, seen);
          if (name === null) return null;
          entries.push(
            ts.factory.createArrayLiteralExpression([
              ts.factory.createStringLiteral(name),
              ts.isPropertyAssignment(property)
                ? property.initializer
                : property.name,
            ]),
          );
        } else if (ts.isSpreadAssignment(property)) {
          const nested = staticObjectEntryElements(property.expression, seen);
          if (!nested) return null;
          entries.push(...nested);
        }
      }
      return entries;
    };
    const staticMapEntryElements = (
      expression: ts.Expression,
      seen: ReadonlySet<string>,
    ): ts.Expression[] | null => {
      const currentExpression = unwrapExpression(expression);
      if (ts.isCallExpression(currentExpression)) {
        const callee = unwrapExpression(currentExpression.expression);
        if (
          propertyAccessName(callee) === "set" &&
          (ts.isPropertyAccessExpression(callee) ||
            ts.isElementAccessExpression(callee)) &&
          currentExpression.arguments[0] &&
          currentExpression.arguments[1]
        ) {
          const receiver = staticMapEntryElements(callee.expression, seen);
          return receiver
            ? [
                ...receiver,
                ts.factory.createArrayLiteralExpression([
                  currentExpression.arguments[0],
                  currentExpression.arguments[1],
                ]),
              ]
            : null;
        }
      }

      const access = staticAccessForExpression(currentExpression);
      const binding =
        access?.path?.length === 0
          ? staticBindingForIdentifier(access.identifier)
          : null;
      if (binding?.initializer && !seen.has(binding.key)) {
        const nextSeen = new Set(seen).add(binding.key);
        const initial = staticMapEntryElements(binding.initializer, nextSeen);
        if (!initial) return null;
        const additions: ts.Expression[] = [];
        const visitSetters = (node: ts.Node) => {
          if (ts.isCallExpression(node)) {
            const callee = unwrapExpression(node.expression);
            if (
              propertyAccessName(callee) === "set" &&
              (ts.isPropertyAccessExpression(callee) ||
                ts.isElementAccessExpression(callee)) &&
              node.arguments[0] &&
              node.arguments[1] &&
              staticBindingForReference(callee.expression)?.key === binding.key
            ) {
              additions.push(
                ts.factory.createArrayLiteralExpression([
                  node.arguments[0],
                  node.arguments[1],
                ]),
              );
            }
          }
          ts.forEachChild(node, visitSetters);
        };
        visitSetters(source);
        return [...initial, ...additions];
      }

      const dereferenced = dereferenceStaticExpression(currentExpression, seen);
      if (!dereferenced) return null;
      const current = unwrapExpression(dereferenced);
      if (
        !ts.isNewExpression(current) ||
        staticGlobalReferenceDescriptor(current.expression) !== "Map"
      ) {
        return null;
      }
      const entriesExpression = current.arguments?.[0];
      return entriesExpression
        ? staticArrayElements(entriesExpression, seen)
        : [];
    };
    const staticMapValueElements = (
      expression: ts.Expression,
      seen: ReadonlySet<string>,
    ): ts.Expression[] | null => {
      const entries = staticMapEntryElements(expression, seen);
      if (!entries) return null;
      const valuesByKey = new Map<string, ts.Expression>();
      const unknownValues: ts.Expression[] = [];
      for (const entry of entries) {
        const tuple = staticArrayElements(entry, seen);
        if (!tuple || tuple.length < 2) return null;
        const key = resolveStaticString(tuple[0], seen);
        if (key === null) unknownValues.push(tuple[1]);
        else valuesByKey.set(key, tuple[1]);
      }
      return [...unknownValues, ...valuesByKey.values()];
    };
    const staticSetElements = (
      expression: ts.Expression,
      seen: ReadonlySet<string>,
    ): ts.Expression[] | null => {
      const currentExpression = unwrapExpression(expression);
      if (ts.isCallExpression(currentExpression)) {
        const callee = unwrapExpression(currentExpression.expression);
        if (
          propertyAccessName(callee) === "add" &&
          (ts.isPropertyAccessExpression(callee) ||
            ts.isElementAccessExpression(callee)) &&
          currentExpression.arguments[0]
        ) {
          const receiver = staticSetElements(callee.expression, seen);
          return receiver
            ? [...receiver, currentExpression.arguments[0]]
            : null;
        }
      }

      const access = staticAccessForExpression(currentExpression);
      const binding =
        access?.path?.length === 0
          ? staticBindingForIdentifier(access.identifier)
          : null;
      if (binding?.initializer && !seen.has(binding.key)) {
        const nextSeen = new Set(seen).add(binding.key);
        const initial = staticSetElements(binding.initializer, nextSeen);
        if (!initial) return null;
        const additions: ts.Expression[] = [];
        const visitAdditions = (node: ts.Node) => {
          if (ts.isCallExpression(node)) {
            const callee = unwrapExpression(node.expression);
            if (
              propertyAccessName(callee) === "add" &&
              (ts.isPropertyAccessExpression(callee) ||
                ts.isElementAccessExpression(callee)) &&
              node.arguments[0] &&
              staticBindingForReference(callee.expression)?.key === binding.key
            ) {
              additions.push(node.arguments[0]);
            }
          }
          ts.forEachChild(node, visitAdditions);
        };
        visitAdditions(source);
        return [...initial, ...additions];
      }

      const dereferenced = dereferenceStaticExpression(currentExpression, seen);
      if (!dereferenced) return null;
      const current = unwrapExpression(dereferenced);
      if (
        !ts.isNewExpression(current) ||
        staticGlobalReferenceDescriptor(current.expression) !== "Set"
      ) {
        return null;
      }
      const sourceExpression = current.arguments?.[0];
      return sourceExpression
        ? staticArrayElements(sourceExpression, seen)
        : [];
    };
    const staticReducedArrayElements = (
      sourceElements: readonly ts.Expression[],
      reducerExpression: ts.Expression,
      initialExpression: ts.Expression,
      seen: ReadonlySet<string>,
    ): ts.Expression[] | null => {
      const reducer = staticCallbackFunctionLike(reducerExpression, seen);
      const body = reducer?.body;
      if (
        !reducer ||
        !body ||
        !ts.isBlock(body) ||
        reducer.parameters.length < 2
      ) {
        return null;
      }
      const accumulatorParameter = reducer.parameters[0];
      if (!ts.isIdentifier(accumulatorParameter.name)) return null;
      const accumulatorName = accumulatorParameter.name.text;
      const initial = staticArrayElements(initialExpression, seen);
      if (!initial) return null;
      const accumulated = [...initial];

      const applyStatement = (
        statement: ts.Statement,
        callArguments: readonly ts.Expression[],
      ): boolean => {
        if (ts.isBlock(statement)) {
          return statement.statements.every((nested) =>
            applyStatement(nested, callArguments),
          );
        }
        if (ts.isIfStatement(statement)) {
          const condition = staticMapperCondition(
            statement.expression,
            reducer,
            callArguments,
            seen,
          );
          if (condition === null) return false;
          return condition
            ? applyStatement(statement.thenStatement, callArguments)
            : !statement.elseStatement ||
                applyStatement(statement.elseStatement, callArguments);
        }
        if (ts.isExpressionStatement(statement)) {
          const expression = unwrapExpression(statement.expression);
          if (ts.isCallExpression(expression)) {
            const callee = unwrapExpression(expression.expression);
            const receiver =
              ts.isPropertyAccessExpression(callee) ||
              ts.isElementAccessExpression(callee)
                ? unwrapExpression(callee.expression)
                : null;
            if (
              propertyAccessName(callee) === "push" &&
              receiver &&
              ts.isIdentifier(receiver) &&
              receiver.text === accumulatorName
            ) {
              expression.arguments.forEach((argument) =>
                accumulated.push(
                  projectFunctionReturnExpression(
                    argument,
                    reducer,
                    callArguments,
                  ),
                ),
              );
            }
          }
        }
        return true;
      };

      for (const [index, sourceElement] of sourceElements.entries()) {
        const callArguments = [
          initialExpression,
          sourceElement,
          ts.factory.createNumericLiteral(index),
        ];
        for (const statement of body.statements) {
          if (!applyStatement(statement, callArguments)) return null;
        }
      }
      return accumulated;
    };
    function staticArrayElements(
      expression: ts.Expression,
      seen: ReadonlySet<string>,
    ): ts.Expression[] | null {
      const setElements = staticSetElements(expression, seen);
      if (setElements) return setElements;
      const dereferenced = dereferenceStaticExpression(expression, seen);
      if (!dereferenced) return null;
      const current = unwrapExpression(dereferenced);
      if (ts.isArrayLiteralExpression(current)) {
        return flattenedArrayElements(current, seen);
      }
      if (ts.isCallExpression(current)) {
        const transparentInvocation = staticGlobalCallInvocation(current);
        if (transparentInvocation?.descriptor === "Promise.all") {
          return transparentInvocation.arguments[0]
            ? staticArrayElements(transparentInvocation.arguments[0], seen)
            : null;
        }
        if (
          transparentInvocation?.descriptor === "Promise.allSettled" &&
          transparentInvocation.arguments[0]
        ) {
          const candidates = staticArrayElements(
            transparentInvocation.arguments[0],
            seen,
          );
          if (!candidates) return null;
          return candidates.map((candidate) => {
            const currentCandidate = unwrapExpression(candidate);
            const candidateInvocation = ts.isCallExpression(currentCandidate)
              ? staticGlobalCallInvocation(currentCandidate)
              : null;
            const rejected =
              candidateInvocation?.descriptor === "Promise.reject";
            const value =
              candidateInvocation?.descriptor === "Promise.resolve" || rejected
                ? (candidateInvocation.arguments[0] ?? candidate)
                : candidate;
            return ts.factory.createObjectLiteralExpression([
              ts.factory.createPropertyAssignment(
                "status",
                ts.factory.createStringLiteral(
                  rejected ? "rejected" : "fulfilled",
                ),
              ),
              ts.factory.createPropertyAssignment(
                rejected ? "reason" : "value",
                value,
              ),
            ]);
          });
        }
        if (
          transparentInvocation?.descriptor === "Object.values" &&
          transparentInvocation.arguments[0]
        ) {
          return staticObjectValueElements(
            transparentInvocation.arguments[0],
            seen,
          );
        }
        if (
          transparentInvocation?.descriptor === "Object.entries" &&
          transparentInvocation.arguments[0]
        ) {
          return staticObjectEntryElements(
            transparentInvocation.arguments[0],
            seen,
          );
        }
        const callee = unwrapExpression(current.expression);
        const methodName = propertyAccessName(callee);
        if (
          methodName === "values" &&
          (ts.isPropertyAccessExpression(callee) ||
            ts.isElementAccessExpression(callee))
        ) {
          const mapValues = staticMapValueElements(callee.expression, seen);
          if (mapValues) return mapValues;
        }
        if (
          (methodName === "filter" ||
            methodName === "flatMap" ||
            methodName === "map") &&
          (ts.isPropertyAccessExpression(callee) ||
            ts.isElementAccessExpression(callee)) &&
          current.arguments[0]
        ) {
          const sourceElements = staticArrayElements(callee.expression, seen);
          const callback = staticCallbackFunctionLike(
            current.arguments[0],
            seen,
          );
          const booleanPredicate =
            staticGlobalReferenceDescriptor(current.arguments[0]) === "Boolean";
          if (!sourceElements || (!callback && !booleanPredicate)) return null;
          if (methodName === "filter") {
            const selected: ts.Expression[] = [];
            for (const [index, sourceElement] of sourceElements.entries()) {
              const callArguments = [
                sourceElement,
                ts.factory.createNumericLiteral(index),
              ];
              const returned = callback
                ? staticEvaluatedFunctionReturnExpression(
                    callback,
                    callArguments,
                    seen,
                  )
                : null;
              const include = booleanPredicate
                ? staticExpressionTruthiness(sourceElement, seen)
                : returned && callback
                  ? staticMapperCondition(
                      returned,
                      callback,
                      callArguments,
                      seen,
                    )
                  : null;
              if (include === null) return null;
              if (include) selected.push(sourceElement);
            }
            return selected;
          }
          if (!callback) return null;
          const flattened: ts.Expression[] = [];
          for (const [index, sourceElement] of sourceElements.entries()) {
            const callArguments = [
              sourceElement,
              ts.factory.createNumericLiteral(index),
            ];
            const mapped = staticEvaluatedFunctionReturnExpression(
              callback,
              callArguments,
              seen,
            );
            if (!mapped) return null;
            if (methodName === "map") {
              flattened.push(
                projectFunctionReturnExpression(
                  mapped,
                  callback,
                  callArguments,
                ),
              );
              continue;
            }
            const nested = staticArrayElements(mapped, seen);
            flattened.push(
              ...(nested ?? [mapped]).map((element) =>
                projectFunctionReturnExpression(
                  element,
                  callback,
                  callArguments,
                ),
              ),
            );
          }
          return flattened;
        }
        if (
          methodName === "reduce" &&
          (ts.isPropertyAccessExpression(callee) ||
            ts.isElementAccessExpression(callee)) &&
          current.arguments[0] &&
          current.arguments[1]
        ) {
          const sourceElements = staticArrayElements(callee.expression, seen);
          return sourceElements
            ? staticReducedArrayElements(
                sourceElements,
                current.arguments[0],
                current.arguments[1],
                seen,
              )
            : null;
        }
        if (
          methodName === "flat" &&
          (ts.isPropertyAccessExpression(callee) ||
            ts.isElementAccessExpression(callee))
        ) {
          const sourceElements = staticArrayElements(callee.expression, seen);
          if (!sourceElements) return null;
          const depthExpression = current.arguments[0]
            ? unwrapExpression(current.arguments[0])
            : null;
          const depth = !depthExpression
            ? 1
            : ts.isNumericLiteral(depthExpression)
              ? Number(depthExpression.text)
              : Number.NaN;
          if (!Number.isInteger(depth) || depth < 0) return null;
          let flattened = [...sourceElements];
          for (let level = 0; level < depth; level += 1) {
            const next: ts.Expression[] = [];
            let changed = false;
            for (const element of flattened) {
              const nested = staticArrayElements(element, seen);
              if (nested) {
                next.push(...nested);
                changed = true;
              } else {
                next.push(element);
              }
            }
            flattened = next;
            if (!changed) break;
          }
          return flattened;
        }
        if (
          ["reverse", "toReversed", "sort", "toSorted"].includes(
            methodName ?? "",
          ) &&
          (ts.isPropertyAccessExpression(callee) ||
            ts.isElementAccessExpression(callee))
        ) {
          const sourceElements = staticArrayElements(callee.expression, seen);
          if (!sourceElements || current.arguments.length > 0) return null;
          if (methodName === "reverse" || methodName === "toReversed") {
            return [...sourceElements].reverse();
          }
          const sortable = sourceElements.map((element) => ({
            element,
            value: resolveStaticString(element, seen),
          }));
          if (sortable.some(({ value }) => value === null)) return null;
          return sortable
            .sort((left, right) =>
              (left.value ?? "").localeCompare(right.value ?? ""),
            )
            .map(({ element }) => element);
        }
        const generatorElements = staticGeneratorElementsForCall(current);
        if (generatorElements) return generatorElements;
        const localReturn = staticSingleLocalReturn(current);
        if (localReturn) {
          const returnExpression = unwrapExpression(localReturn.expression);
          const projectedReturn = projectFunctionReturnExpression(
            returnExpression,
            localReturn.callable,
            localReturn.arguments,
          );
          if (projectedReturn !== returnExpression) {
            const projectedElements = staticArrayElements(
              projectedReturn,
              seen,
            );
            if (projectedElements) return projectedElements;
          } else if (ts.isArrayLiteralExpression(returnExpression)) {
            const elements = flattenedArrayElements(returnExpression, seen);
            if (elements) {
              return elements.map((element) =>
                projectFunctionReturnExpression(
                  element,
                  localReturn.callable,
                  localReturn.arguments,
                ),
              );
            }
          }
        }
      }
      const copyInvocation = ts.isCallExpression(current)
        ? staticCopyInvocationForCall(current)
        : null;
      if (
        copyInvocation?.descriptor === "Array.prototype.slice" &&
        copyInvocation.arguments.length >= 1
      ) {
        const sourceElements = staticArrayElements(
          copyInvocation.arguments[0],
          seen,
        );
        if (!sourceElements) return null;
        const resolveIndex = (
          value: ts.Expression | undefined,
          fallback: number,
        ) => {
          if (!value) return fallback;
          const currentValue = unwrapExpression(value);
          if (ts.isNumericLiteral(currentValue))
            return Number(currentValue.text);
          const resolvedValue = resolveStaticString(currentValue, seen);
          return resolvedValue === null ? Number.NaN : Number(resolvedValue);
        };
        const start = resolveIndex(copyInvocation.arguments[1], 0);
        const end = resolveIndex(
          copyInvocation.arguments[2],
          sourceElements.length,
        );
        return Number.isInteger(start) && Number.isInteger(end)
          ? sourceElements.slice(start, end)
          : null;
      }
      if (
        copyInvocation?.descriptor === "Array.prototype.concat" &&
        copyInvocation.arguments.length >= 1
      ) {
        const receiverElements = staticArrayElements(
          copyInvocation.arguments[0],
          seen,
        );
        if (!receiverElements) return null;
        const elements = [...receiverElements];
        for (const argument of copyInvocation.arguments.slice(1)) {
          const nested = staticArrayElements(argument, seen);
          elements.push(...(nested ?? [argument]));
        }
        return elements;
      }
      if (
        copyInvocation?.descriptor === "Array.from" &&
        copyInvocation.arguments.length >= 1
      ) {
        const sourceElements = staticArrayElements(
          copyInvocation.arguments[0],
          seen,
        );
        if (!sourceElements || copyInvocation.arguments.length === 1) {
          return sourceElements;
        }
        const mapper = copyInvocation.arguments[1];
        const returns = staticCallbackReturnExpressions(mapper, seen);
        const firstParameterName = staticCallbackFirstParameterName(
          mapper,
          seen,
        );
        if (
          returns.length === 1 &&
          firstParameterName &&
          !staticCallbackFunctionLike(mapper, seen)?.parameters[0]
            ?.initializer &&
          ts.isIdentifier(unwrapExpression(returns[0])) &&
          unwrapExpression(returns[0]).getText(source) === firstParameterName
        ) {
          return sourceElements;
        }
        if (returns.length === 0) return null;
        if (sourceElements.length === 0) return [];
        const mappedElements = sourceElements.map(
          (sourceElement, sourceIndex) =>
            staticMappedCallbackReturnExpression(
              mapper,
              sourceElement,
              sourceIndex,
              seen,
            ),
        );
        return mappedElements.every(
          (element): element is ts.Expression => element !== null,
        )
          ? mappedElements
          : null;
      }
      const reflectArrayArguments =
        copyInvocation?.descriptor === "Reflect.construct" &&
        copyInvocation.arguments.length >= 2 &&
        staticGlobalReferenceDescriptor(copyInvocation.arguments[0]) === "Array"
          ? staticArrayElements(copyInvocation.arguments[1], seen)
          : null;
      const constructorArguments = reflectArrayArguments
        ? reflectArrayArguments
        : copyInvocation?.descriptor === "Array.of"
          ? [...copyInvocation.arguments]
          : copyInvocation?.descriptor === "Array"
            ? [...copyInvocation.arguments]
            : isUnshadowedGlobalConstructorCall(current, "Array")
              ? [...(current.arguments ?? [])]
              : null;
      if (!constructorArguments) return null;
      const elements: ts.Expression[] = [];
      for (const argument of constructorArguments) {
        if (ts.isSpreadElement(argument)) {
          const nested = staticArrayElements(argument.expression, seen);
          if (!nested) return null;
          elements.push(...nested);
        } else {
          elements.push(argument);
        }
      }
      if (
        (copyInvocation?.descriptor === "Array" ||
          isUnshadowedGlobalConstructorCall(current, "Array") ||
          reflectArrayArguments) &&
        elements.length === 1 &&
        ts.isNumericLiteral(unwrapExpression(elements[0]))
      ) {
        return null;
      }
      return elements;
    }
    function dereferenceStaticBinding(
      binding: StaticBindingRecord,
      seen: ReadonlySet<string>,
    ): ts.Expression | null {
      if (seen.has(binding.key)) return null;
      const nextSeen = new Set(seen).add(binding.key);
      let current = binding.initializer
        ? dereferenceStaticExpression(binding.initializer, nextSeen)
        : null;

      for (const segment of binding.accessPath) {
        if (!current) break;
        if (typeof segment === "number") {
          const elements = staticArrayElements(current, nextSeen);
          const element = elements?.[segment];
          current = element
            ? dereferenceStaticExpression(element, nextSeen)
            : null;
          continue;
        }
        if (!ts.isObjectLiteralExpression(current)) {
          current = null;
          break;
        }
        const initializer = objectPropertyInitializer(
          current,
          segment,
          nextSeen,
        );
        current = initializer
          ? dereferenceStaticExpression(initializer, nextSeen)
          : null;
      }

      if (!current && binding.fallbackInitializer) {
        return dereferenceStaticExpression(
          binding.fallbackInitializer,
          nextSeen,
        );
      }
      return current;
    }

    function dereferenceStaticExpression(
      expression: ts.Expression,
      seen: ReadonlySet<string> = new Set(),
    ): ts.Expression | null {
      const current = unwrapExpression(expression);
      if (ts.isCallExpression(current)) {
        const transparent = staticTransparentCallResultExpression(current);
        if (transparent) {
          return dereferenceStaticExpression(transparent, seen) ?? transparent;
        }
      }
      if (
        isUnshadowedObjectMethodCall(current, [
          "freeze",
          "seal",
          "preventExtensions",
        ]) &&
        current.arguments.length === 1
      ) {
        return dereferenceStaticExpression(current.arguments[0], seen);
      }
      if (
        isUnshadowedGlobalFunctionCall(current, "structuredClone") &&
        current.arguments.length >= 1 &&
        current.arguments.length <= 2
      ) {
        return dereferenceStaticExpression(current.arguments[0], seen);
      }
      if (ts.isIdentifier(current)) {
        const binding = staticBindingForIdentifier(current);
        return binding ? dereferenceStaticBinding(binding, seen) : null;
      }
      if (ts.isPropertyAccessExpression(current)) {
        if (ts.isIdentifier(current.expression)) {
          const binding = staticBindingForIdentifier(current.expression);
          const member = binding?.staticMembers?.get(current.name.text);
          if (member && binding) {
            return dereferenceStaticExpression(
              member,
              new Set(seen).add(binding.key),
            );
          }
        }
        let container = dereferenceStaticExpression(current.expression, seen);
        if (!container) return null;
        if (ts.isCallExpression(unwrapExpression(container))) {
          const call = unwrapExpression(container) as ts.CallExpression;
          const localReturn = staticSingleLocalReturn(call);
          if (localReturn) {
            const returnExpression = unwrapExpression(localReturn.expression);
            const projected = projectFunctionReturnExpression(
              returnExpression,
              localReturn.callable,
              localReturn.arguments,
            );
            if (projected !== returnExpression) {
              container = dereferenceStaticExpression(projected, seen);
            } else if (ts.isObjectLiteralExpression(returnExpression)) {
              const initializer = objectPropertyInitializer(
                returnExpression,
                current.name.text,
                seen,
              );
              if (initializer) {
                return dereferenceStaticExpression(
                  projectFunctionReturnExpression(
                    initializer,
                    localReturn.callable,
                    localReturn.arguments,
                  ),
                  seen,
                );
              }
            }
          }
        }
        if (!container) return null;
        if (ts.isNewExpression(container)) {
          const constructor = unwrapExpression(container.expression);
          const binding = ts.isIdentifier(constructor)
            ? staticBindingForIdentifier(constructor)
            : null;
          let classDeclaration = binding
            ? (staticClassByBindingKey.get(binding.key) ?? null)
            : null;
          if (!classDeclaration && binding?.initializer) {
            const initializer = unwrapExpression(binding.initializer);
            if (ts.isClassExpression(initializer)) {
              classDeclaration = initializer;
            }
          }
          const property = classDeclaration?.members.find(
            (member) =>
              ts.isPropertyDeclaration(member) &&
              bindingPropertyName(member.name) === current.name.text &&
              member.initializer,
          );
          if (
            property &&
            ts.isPropertyDeclaration(property) &&
            property.initializer
          ) {
            return dereferenceStaticExpression(property.initializer, seen);
          }
        }
        const initializer = ts.isObjectLiteralExpression(container)
          ? objectPropertyInitializer(container, current.name.text, seen)
          : isUnshadowedObjectMethodCall(container, ["assign"])
            ? objectAssignPropertyInitializer(
                container,
                current.name.text,
                seen,
              )
            : null;
        if (!initializer) return null;
        return dereferenceStaticExpression(initializer, seen) ?? initializer;
      }
      if (ts.isElementAccessExpression(current) && current.argumentExpression) {
        const directContainer = unwrapExpression(current.expression);
        const directIndex = ts.isNumericLiteral(
          unwrapExpression(current.argumentExpression),
        )
          ? Number(unwrapExpression(current.argumentExpression).getText(source))
          : Number.NaN;
        if (ts.isCallExpression(directContainer) && directIndex === 0) {
          const hookInvocation = staticGlobalCallInvocation(directContainer);
          if (
            hookInvocation?.descriptor === "react.useState" &&
            hookInvocation.arguments[0]
          ) {
            const initial = hookInvocation.arguments[0];
            const value = staticCallbackValue(initial) ?? initial;
            return dereferenceStaticExpression(value, seen) ?? value;
          }
          if (
            hookInvocation?.descriptor === "react.useReducer" &&
            hookInvocation.arguments[1]
          ) {
            const initial = hookInvocation.arguments[2]
              ? staticCallbackValue(hookInvocation.arguments[2], [
                  hookInvocation.arguments[1],
                ])
              : hookInvocation.arguments[1];
            if (initial) {
              return dereferenceStaticExpression(initial, seen) ?? initial;
            }
          }
        }
        const container = dereferenceStaticExpression(current.expression, seen);
        if (!container) return null;
        const arrayElements = staticArrayElements(container, seen);
        if (arrayElements) {
          const indexValue = ts.isNumericLiteral(current.argumentExpression)
            ? current.argumentExpression.text
            : resolveStaticString(current.argumentExpression, seen);
          const index =
            (indexValue === null ? Number.NaN : Number(indexValue)) +
            (ts.isIdentifier(current.expression)
              ? arrayRestOffsetForIdentifier(current.expression)
              : 0);
          if (!Number.isInteger(index) || index < 0) return null;
          const element = arrayElements[index];
          return element ? dereferenceStaticExpression(element, seen) : null;
        }
        if (ts.isObjectLiteralExpression(container)) {
          const propertyName = resolveStaticString(
            current.argumentExpression,
            seen,
          );
          if (propertyName === null) return null;
          const initializer = objectPropertyInitializer(
            container,
            propertyName,
            seen,
          );
          if (!initializer) return null;
          return dereferenceStaticExpression(initializer, seen) ?? initializer;
        }
        if (isUnshadowedObjectMethodCall(container, ["assign"])) {
          const propertyName = resolveStaticString(
            current.argumentExpression,
            seen,
          );
          if (propertyName === null) return null;
          const initializer = objectAssignPropertyInitializer(
            container,
            propertyName,
            seen,
          );
          if (!initializer) return null;
          return dereferenceStaticExpression(initializer, seen) ?? initializer;
        }
        return null;
      }
      return current;
    }

    const staticExpressionAtPath = (
      expression: ts.Expression,
      accessPath: readonly StaticAccessSegment[],
    ): ts.Expression | null => {
      let current = dereferenceStaticExpression(expression);
      for (const segment of accessPath) {
        if (!current) return null;
        if (typeof segment === "number") {
          const element = staticArrayElements(current, new Set())?.[segment];
          current = element ? dereferenceStaticExpression(element) : null;
          continue;
        }
        const initializer = ts.isObjectLiteralExpression(current)
          ? objectPropertyInitializer(current, segment, new Set())
          : isUnshadowedObjectMethodCall(current, ["assign"])
            ? objectAssignPropertyInitializer(current, segment, new Set())
            : null;
        if (!initializer) return null;
        current = initializer ? dereferenceStaticExpression(initializer) : null;
      }
      return current;
    };
    function projectFunctionReturnExpression(
      expression: ts.Expression,
      callable: ts.FunctionLikeDeclaration,
      callArguments: readonly ts.Expression[],
      seenBindings: ReadonlySet<string> = new Set(),
    ): ts.Expression {
      const projectionForBindingName = (
        name: ts.BindingName,
        identifierName: string,
        path: readonly StaticAccessSegment[] = [],
      ): readonly StaticAccessSegment[] | null => {
        if (ts.isIdentifier(name)) {
          return name.text === identifierName ? path : null;
        }
        for (const [index, element] of [...name.elements].entries()) {
          if (!ts.isBindingElement(element)) continue;
          const segment = ts.isObjectBindingPattern(name)
            ? (bindingPropertyName(element.propertyName) ??
              (ts.isIdentifier(element.name) ? element.name.text : null))
            : index;
          if (segment === null) continue;
          const nested = projectionForBindingName(
            element.name,
            identifierName,
            element.dotDotDotToken ? path : [...path, segment],
          );
          if (nested) return nested;
        }
        return null;
      };
      const parameterProjection = (identifierName: string) => {
        for (const [index, parameter] of [...callable.parameters].entries()) {
          const path = projectionForBindingName(parameter.name, identifierName);
          if (path) return { index, path };
        }
        return null;
      };
      const current = unwrapExpression(expression);
      if (ts.isIdentifier(current)) {
        const parameter = parameterProjection(current.text);
        if (parameter) {
          const declaredParameter = callable.parameters[parameter.index];
          const suppliedArgument = callArguments[parameter.index];
          const suppliedValue = suppliedArgument
            ? unwrapExpression(suppliedArgument)
            : null;
          const usesDefault = Boolean(
            declaredParameter.initializer &&
            (!suppliedValue ||
              (ts.isIdentifier(suppliedValue) &&
                suppliedValue.text === "undefined" &&
                !staticBindingForIdentifier(suppliedValue)) ||
              (ts.isVoidExpression(suppliedValue) &&
                ts.isNumericLiteral(
                  unwrapExpression(suppliedValue.expression),
                ))),
          );
          const argument = usesDefault
            ? declaredParameter.initializer
            : suppliedArgument;
          if (argument) {
            return parameter.path.length === 0
              ? argument
              : (staticExpressionAtPath(argument, parameter.path) ??
                  expression);
          }
        }
        const binding = staticBindingForIdentifier(current);
        if (
          binding?.initializer &&
          !seenBindings.has(binding.key) &&
          binding.initializer.pos >= callable.pos &&
          binding.initializer.end <= callable.end
        ) {
          return projectFunctionReturnExpression(
            binding.initializer,
            callable,
            callArguments,
            new Set(seenBindings).add(binding.key),
          );
        }
        return expression;
      }
      if (
        ts.isPropertyAccessExpression(current) ||
        ts.isElementAccessExpression(current)
      ) {
        const access = staticAccessForExpression(current);
        const parameter = access
          ? parameterProjection(access.identifier.text)
          : null;
        const argument = parameter ? callArguments[parameter.index] : null;
        if (access?.path && parameter && argument) {
          return (
            staticExpressionAtPath(argument, [
              ...parameter.path,
              ...access.path,
            ]) ?? expression
          );
        }
      }
      if (ts.isObjectLiteralExpression(current) && callArguments[0]) {
        let preservesProjectedProperties = current.properties.length > 0;
        for (const property of current.properties) {
          if (!ts.isPropertyAssignment(property)) {
            preservesProjectedProperties = false;
            break;
          }
          const name = bindingPropertyName(property.name);
          if (name === null) {
            preservesProjectedProperties = false;
            break;
          }
          const projected = projectFunctionReturnExpression(
            property.initializer,
            callable,
            callArguments,
            seenBindings,
          );
          const sourceProperty = staticExpressionAtPath(callArguments[0], [
            name,
          ]);
          if (
            !sourceProperty ||
            projected.getText(source) !== sourceProperty.getText(source)
          ) {
            preservesProjectedProperties = false;
            break;
          }
        }
        if (preservesProjectedProperties) return callArguments[0];
      }
      return expression;
    }
    const mutationExpressionsForStaticReference = (
      expression: ts.Expression,
    ) => {
      const referenceAccess = staticAccessForExpression(expression);
      if (!referenceAccess) return [];
      const directBinding = staticBindingForReference(expression);
      const canonicalTarget = canonicalStaticAccessTarget(referenceAccess);
      const targets: Array<{
        binding: StaticBindingRecord;
        path: readonly StaticAccessSegment[] | null;
        throughAlias: boolean;
      }> = [];
      if (directBinding) {
        targets.push({
          binding: directBinding,
          path: referenceAccess.path,
          throughAlias: false,
        });
      }
      if (
        canonicalTarget &&
        !targets.some(
          (target) =>
            target.binding.key === canonicalTarget.binding.key &&
            JSON.stringify(target.path) ===
              JSON.stringify(canonicalTarget.path),
        )
      ) {
        targets.push({ ...canonicalTarget, throughAlias: true });
      }
      const expressions: ts.Expression[] = [];
      const seenExpressions = new Set<string>();
      targets.forEach((target) => {
        const mutations =
          staticMutationsByBindingKey.get(target.binding.key) ?? [];
        mutations.forEach((mutation) => {
          if (target.throughAlias && mutation.mode === "binding-assignment") {
            return;
          }
          let resolved: ts.Expression | null = null;
          if (!target.path || !mutation.accessPath) {
            resolved = mutation.expression;
          } else if (accessPathStartsWith(target.path, mutation.accessPath)) {
            const remainingPath = target.path.slice(mutation.accessPath.length);
            const nested = staticExpressionAtPath(
              mutation.expression,
              remainingPath,
            );
            resolved =
              nested ??
              (mutation.mode === "object-assign" && remainingPath.length > 0
                ? null
                : mutation.expression);
          } else if (accessPathStartsWith(mutation.accessPath, target.path)) {
            resolved = mutation.expression;
          }
          if (!resolved) return;
          const key = `${resolved.pos}:${resolved.end}`;
          if (seenExpressions.has(key)) return;
          seenExpressions.add(key);
          expressions.push(resolved);
        });
      });
      return expressions;
    };
    collectStaticStringDeclarations(source);
    // Declaration discovery may have queried a not-yet-complete scope.
    staticCallableRootCache.clear();
    staticGlobalDescriptorRootCache.clear();
    collectStaticMutations(source);

    function resolveStaticString(
      expression: ts.Expression,
      seen: ReadonlySet<string> = new Set(),
    ): string | null {
      const dereferenced = dereferenceStaticExpression(expression, seen);
      if (!dereferenced) return null;
      const current = unwrapExpression(dereferenced);
      if (
        ts.isStringLiteral(current) ||
        ts.isNoSubstitutionTemplateLiteral(current)
      ) {
        return current.text;
      }
      if (
        ts.isBinaryExpression(current) &&
        current.operatorToken.kind === ts.SyntaxKind.PlusToken
      ) {
        const left = resolveStaticString(current.left, seen);
        const right = resolveStaticString(current.right, seen);
        return left === null || right === null ? null : `${left}${right}`;
      }
      if (ts.isTemplateExpression(current)) {
        let value = current.head.text;
        for (const span of current.templateSpans) {
          const resolved = resolveStaticString(span.expression, seen);
          if (resolved === null) return null;
          value += `${resolved}${span.literal.text}`;
        }
        return value;
      }
      return null;
    }

    const isInsideTranslatorSelectionCondition = (node: ts.Node) => {
      let current = node;
      while (current.parent && !ts.isSourceFile(current.parent)) {
        const parent = current.parent;
        if (
          ts.isConditionalExpression(parent) &&
          parent.condition === current
        ) {
          return true;
        }
        if (ts.isCallExpression(parent)) return false;
        current = parent;
      }
      return false;
    };

    const collectStaticStringLeaves = (
      expression: ts.Expression,
      seen: ReadonlySet<string> = new Set(),
      seenExpressions: ReadonlySet<number> = new Set(),
      skipTupleControlValues = false,
      translatorLocation: AuditedTranslatorLocation | null = null,
      translatorRelativePath: readonly TranslatorArgumentPathSegment[] = [],
    ): Set<string> => {
      const leaves = new Set<string>();
      if (
        isUnauditedStructuralValue(
          expression,
          translatorLocation,
          translatorRelativePath,
        )
      ) {
        return leaves;
      }
      if (
        translatorLocation &&
        isTranslatorControlPath(translatorLocation, translatorRelativePath)
      ) {
        return leaves;
      }
      if (
        translatorLocation &&
        !isInsideTranslatorSelectionCondition(expression)
      ) {
        const hookValues = staticReactHookVisibleExpressions(expression).filter(
          (value) => value !== unwrapExpression(expression),
        );
        if (hookValues.length > 0) {
          hookValues.forEach((hookValue) =>
            collectStaticStringLeaves(
              hookValue,
              seen,
              seenExpressions,
              skipTupleControlValues,
              translatorLocation,
              translatorRelativePath,
            ).forEach((value) => leaves.add(value)),
          );
          return leaves;
        }
      }
      const resolved = resolveStaticString(expression, seen);
      if (resolved !== null) {
        leaves.add(resolved);
        return leaves;
      }
      const dereferenced = dereferenceStaticExpression(expression, seen);
      if (!dereferenced) {
        const unresolvedAccess = staticAccessForExpression(expression);
        const binding = staticBindingForReference(expression);
        const bindingInitializer = binding?.initializer
          ? unwrapExpression(binding.initializer)
          : null;
        const canInspectInitializer = Boolean(
          unresolvedAccess?.path &&
          (unresolvedAccess.path.length === 0 ||
            (bindingInitializer &&
              ((ts.isCallExpression(bindingInitializer) &&
                isStaticCopyLikeCall(bindingInitializer)) ||
                (ts.isNewExpression(bindingInitializer) &&
                  isStaticCopyLikeNew(bindingInitializer))))),
        );
        if (
          canInspectInitializer &&
          binding?.initializer &&
          !seen.has(binding.key)
        ) {
          collectStaticStringLeaves(
            binding.initializer,
            new Set(seen).add(binding.key),
            seenExpressions,
            skipTupleControlValues,
            translatorLocation,
            translatorRelativePath,
          ).forEach((value) => leaves.add(value));
        }
        return leaves;
      }
      const current = unwrapExpression(dereferenced);
      if (seenExpressions.has(current.pos)) return leaves;
      const nextSeenExpressions = new Set(seenExpressions).add(current.pos);
      if (isUnshadowedObjectMethodCall(current, ["assign"])) {
        current.arguments.forEach((argument) => {
          collectStaticStringLeaves(
            argument,
            seen,
            nextSeenExpressions,
            skipTupleControlValues,
            translatorLocation,
            translatorRelativePath,
          ).forEach((value) => leaves.add(value));
        });
        return leaves;
      }
      if (ts.isObjectLiteralExpression(current)) {
        for (const property of current.properties) {
          if (ts.isSpreadAssignment(property)) {
            collectStaticStringLeaves(
              property.expression,
              seen,
              nextSeenExpressions,
              skipTupleControlValues,
              translatorLocation,
              translatorRelativePath,
            ).forEach((value) => leaves.add(value));
            continue;
          }
          if (ts.isPropertyAssignment(property)) {
            const propertyName = propertyNameText(property.name, seen);
            const nextRelativePath =
              propertyName === null
                ? translatorRelativePath
                : [...translatorRelativePath, propertyName];
            if (
              isUnauditedStructuralValue(
                property.initializer,
                translatorLocation,
                nextRelativePath,
              )
            ) {
              continue;
            }
            collectStaticStringLeaves(
              property.initializer,
              seen,
              nextSeenExpressions,
              skipTupleControlValues,
              translatorLocation,
              nextRelativePath,
            ).forEach((value) => leaves.add(value));
            continue;
          }
          if (ts.isShorthandPropertyAssignment(property)) {
            const nextRelativePath = [
              ...translatorRelativePath,
              property.name.text,
            ];
            if (
              isUnauditedStructuralValue(
                property.name,
                translatorLocation,
                nextRelativePath,
              )
            ) {
              continue;
            }
            collectStaticStringLeaves(
              property.name,
              seen,
              nextSeenExpressions,
              skipTupleControlValues,
              translatorLocation,
              nextRelativePath,
            ).forEach((value) => leaves.add(value));
          }
        }
        return leaves;
      }
      const arrayElements = staticArrayElements(current, seen);
      if (arrayElements) {
        const elements = arrayElements;
        const visibleElements = skipTupleControlValues
          ? elements.flatMap((element) => {
              const tupleElements = staticArrayElements(element, seen);
              if (!tupleElements) {
                return [element];
              }
              return tupleElements.length >= 2
                ? tupleElements.slice(1)
                : [element];
            })
          : elements;
        visibleElements.forEach((element, index) =>
          collectStaticStringLeaves(
            element,
            seen,
            nextSeenExpressions,
            skipTupleControlValues,
            translatorLocation,
            [...translatorRelativePath, index],
          ).forEach((value) => leaves.add(value)),
        );
        return leaves;
      }
      if (ts.isCallExpression(current)) {
        const contract = reviewedTranslatorContractForCall(current);
        const copyInvocation = staticCopyInvocationForCall(current);
        const copyLikeCall = Boolean(copyInvocation);
        const trustedCopyDescriptor = copyInvocation?.descriptor ?? null;
        const localReturnExpressions = contract
          ? []
          : staticCallReturnExpressions(current);
        const returnExpressions =
          trustedCopyDescriptor === "Array.from" && copyInvocation?.arguments[1]
            ? staticCallbackReturnExpressions(copyInvocation.arguments[1])
            : localReturnExpressions;
        if (contract || copyLikeCall) {
          const auditedArguments = contract
            ? [...current.arguments]
            : [...(copyInvocation?.arguments ?? [])];
          auditedArguments.forEach((argument, argumentIndex) => {
            if (
              contract &&
              !contract.auditedArgumentIndexes.has(argumentIndex)
            ) {
              return;
            }
            if (!contract && !trustedCopyDescriptor) return;
            if (
              trustedCopyDescriptor === "Array.from" &&
              copyInvocation?.arguments[1] &&
              argumentIndex === 0
            ) {
              return;
            }
            collectStaticStringLeaves(
              argument,
              seen,
              nextSeenExpressions,
              skipTupleControlValues,
              contract
                ? { contract, argumentIndex, path: [] }
                : translatorLocation,
              contract ? [] : translatorRelativePath,
            ).forEach((value) => leaves.add(value));
          });
        }
        returnExpressions.forEach((returnExpression) => {
          collectStaticStringLeaves(
            returnExpression,
            seen,
            nextSeenExpressions,
            skipTupleControlValues,
            translatorLocation,
            translatorRelativePath,
          ).forEach((value) => leaves.add(value));
        });
        return leaves;
      }
      if (ts.isNewExpression(current)) {
        current.arguments?.forEach((argument) => {
          collectStaticStringLeaves(
            argument,
            seen,
            nextSeenExpressions,
            skipTupleControlValues,
            translatorLocation,
            translatorRelativePath,
          ).forEach((value) => leaves.add(value));
        });
        return leaves;
      }
      if (ts.isTemplateExpression(current)) {
        if (current.head.text) leaves.add(current.head.text);
        current.templateSpans.forEach((span) => {
          collectStaticStringLeaves(
            span.expression,
            seen,
            nextSeenExpressions,
            skipTupleControlValues,
            translatorLocation,
            translatorRelativePath,
          ).forEach((value) => leaves.add(value));
          if (span.literal.text) leaves.add(span.literal.text);
        });
        return leaves;
      }
      if (
        ts.isBinaryExpression(current) &&
        [
          ts.SyntaxKind.PlusToken,
          ts.SyntaxKind.AmpersandAmpersandToken,
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.QuestionQuestionToken,
        ].includes(current.operatorToken.kind)
      ) {
        collectStaticStringLeaves(
          current.left,
          seen,
          nextSeenExpressions,
          skipTupleControlValues,
          translatorLocation,
          translatorRelativePath,
        ).forEach((value) => leaves.add(value));
        collectStaticStringLeaves(
          current.right,
          seen,
          nextSeenExpressions,
          skipTupleControlValues,
          translatorLocation,
          translatorRelativePath,
        ).forEach((value) => leaves.add(value));
        return leaves;
      }
      if (ts.isConditionalExpression(current)) {
        collectStaticStringLeaves(
          current.whenTrue,
          seen,
          nextSeenExpressions,
          skipTupleControlValues,
          translatorLocation,
          translatorRelativePath,
        ).forEach((value) => leaves.add(value));
        collectStaticStringLeaves(
          current.whenFalse,
          seen,
          nextSeenExpressions,
          skipTupleControlValues,
          translatorLocation,
          translatorRelativePath,
        ).forEach((value) => leaves.add(value));
      }
      return leaves;
    };

    const collectStaticDynamicCompositions = (
      expression: ts.Expression,
      seen: ReadonlySet<string> = new Set(),
      compositions: ts.Expression[] = [],
      seenExpressions: ReadonlySet<number> = new Set(),
      translatorLocation: AuditedTranslatorLocation | null = null,
      translatorRelativePath: readonly TranslatorArgumentPathSegment[] = [],
    ): ts.Expression[] => {
      if (
        isUnauditedStructuralValue(
          expression,
          translatorLocation,
          translatorRelativePath,
        )
      ) {
        return compositions;
      }
      if (
        translatorLocation &&
        isTranslatorControlPath(translatorLocation, translatorRelativePath)
      ) {
        return compositions;
      }
      const dereferenced = dereferenceStaticExpression(expression, seen);
      if (!dereferenced) {
        const unresolvedAccess = staticAccessForExpression(expression);
        const binding = staticBindingForReference(expression);
        const bindingInitializer = binding?.initializer
          ? unwrapExpression(binding.initializer)
          : null;
        const canInspectInitializer = Boolean(
          unresolvedAccess?.path &&
          (unresolvedAccess.path.length === 0 ||
            (bindingInitializer &&
              ((ts.isCallExpression(bindingInitializer) &&
                isStaticCopyLikeCall(bindingInitializer)) ||
                (ts.isNewExpression(bindingInitializer) &&
                  isStaticCopyLikeNew(bindingInitializer))))),
        );
        if (
          canInspectInitializer &&
          binding?.initializer &&
          !seen.has(binding.key)
        ) {
          collectStaticDynamicCompositions(
            binding.initializer,
            new Set(seen).add(binding.key),
            compositions,
            seenExpressions,
            translatorLocation,
            translatorRelativePath,
          );
        }
        return compositions;
      }
      const current = unwrapExpression(dereferenced);
      if (seenExpressions.has(current.pos)) return compositions;
      const nextSeenExpressions = new Set(seenExpressions).add(current.pos);
      if (
        (ts.isTemplateExpression(current) ||
          (ts.isBinaryExpression(current) &&
            current.operatorToken.kind === ts.SyntaxKind.PlusToken &&
            hasStringSyntax(current))) &&
        resolveStaticString(current, seen) === null
      ) {
        compositions.push(current);
        return compositions;
      }
      if (
        ts.isBinaryExpression(current) &&
        [
          ts.SyntaxKind.AmpersandAmpersandToken,
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.QuestionQuestionToken,
        ].includes(current.operatorToken.kind)
      ) {
        collectStaticDynamicCompositions(
          current.left,
          seen,
          compositions,
          nextSeenExpressions,
          translatorLocation,
          translatorRelativePath,
        );
        collectStaticDynamicCompositions(
          current.right,
          seen,
          compositions,
          nextSeenExpressions,
          translatorLocation,
          translatorRelativePath,
        );
        return compositions;
      }
      if (ts.isObjectLiteralExpression(current)) {
        for (const property of current.properties) {
          if (ts.isSpreadAssignment(property)) {
            collectStaticDynamicCompositions(
              property.expression,
              seen,
              compositions,
              nextSeenExpressions,
              translatorLocation,
              translatorRelativePath,
            );
          } else if (ts.isPropertyAssignment(property)) {
            const propertyName = propertyNameText(property.name, seen);
            const nextRelativePath =
              propertyName === null
                ? translatorRelativePath
                : [...translatorRelativePath, propertyName];
            if (
              isUnauditedStructuralValue(
                property.initializer,
                translatorLocation,
                nextRelativePath,
              )
            )
              continue;
            collectStaticDynamicCompositions(
              property.initializer,
              seen,
              compositions,
              nextSeenExpressions,
              translatorLocation,
              nextRelativePath,
            );
          } else if (ts.isShorthandPropertyAssignment(property)) {
            const nextRelativePath = [
              ...translatorRelativePath,
              property.name.text,
            ];
            if (
              isUnauditedStructuralValue(
                property.name,
                translatorLocation,
                nextRelativePath,
              )
            )
              continue;
            collectStaticDynamicCompositions(
              property.name,
              seen,
              compositions,
              nextSeenExpressions,
              translatorLocation,
              nextRelativePath,
            );
          }
        }
      } else if (staticArrayElements(current, seen)) {
        const elements = staticArrayElements(current, seen) ?? [];
        elements.forEach((element, index) =>
          collectStaticDynamicCompositions(
            element,
            seen,
            compositions,
            nextSeenExpressions,
            translatorLocation,
            [...translatorRelativePath, index],
          ),
        );
      } else if (ts.isConditionalExpression(current)) {
        collectStaticDynamicCompositions(
          current.whenTrue,
          seen,
          compositions,
          nextSeenExpressions,
          translatorLocation,
          translatorRelativePath,
        );
        collectStaticDynamicCompositions(
          current.whenFalse,
          seen,
          compositions,
          nextSeenExpressions,
          translatorLocation,
          translatorRelativePath,
        );
      }
      return compositions;
    };

    auditedWrapperDefaultExpressions.forEach((expression) => {
      collectStaticStringLeaves(expression).forEach(remember);
    });
    const auditedWrapperDefaultDynamicCompositions =
      auditedWrapperDefaultExpressions.flatMap((expression) =>
        collectStaticDynamicCompositions(expression),
      );

    const metadataDeclaration = source.statements
      .filter(ts.isVariableStatement)
      .flatMap((statement) => [...statement.declarationList.declarations])
      .find(
        (declaration) =>
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === "metadata" &&
          declaration.initializer,
      );
    if (metadataDeclaration?.initializer) {
      const visitMetadata = (node: ts.Node) => {
        if (ts.isPropertyAssignment(node)) {
          const propertyName =
            ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)
              ? node.name.text
              : "";
          if (["title", "description", "alt"].includes(propertyName)) {
            const value = resolveStaticString(node.initializer);
            if (value) remember(value);
          }
        }
        if (ts.isShorthandPropertyAssignment(node)) {
          const value = resolveStaticString(node.name);
          if (value) remember(value);
        }
        ts.forEachChild(node, visitMetadata);
      };
      visitMetadata(metadataDeclaration.initializer);
    }

    const visibleStringProps = new Set([
      "aria-label",
      "description",
      "detail",
      "emptyText",
      "emptyTitle",
      "eyebrow",
      "formula",
      "label",
      "placeholder",
      "q",
      "a",
      "shortTitle",
      "text",
      "title",
      "unknownLabel",
    ]);
    const nonVisibleCustomStringProps = new Set([
      "accept",
      "action",
      "active",
      "activeKey",
      "activeItem",
      "activeView",
      "align",
      "appearance",
      "aria-current",
      "aria-describedby",
      "aria-hidden",
      "aria-labelledby",
      "aria-live",
      "aria-modal",
      "as",
      "autoComplete",
      "className",
      "code",
      "color",
      "download",
      "encType",
      "fetchPriority",
      "form",
      "height",
      "href",
      "id",
      "inputMode",
      "inputId",
      "key",
      "locale",
      "method",
      "name",
      "pattern",
      "primaryAction",
      "referrerPolicy",
      "rel",
      "role",
      "requestHref",
      "scope",
      "scopes",
      "senderRole",
      "side",
      "size",
      "src",
      "strategy",
      "target",
      "translate",
      "type",
      "tone",
      "unauthenticatedPrimaryAction",
      "variant",
      "width",
    ]);
    const visibleCollectionProps = new Set([
      "description",
      "eyebrow",
      "faq",
      "fitSignals",
      "heroTitle",
      "intentLabel",
      "intro",
      "items",
      "label",
      "lead",
      "metaTitle",
      "name",
      "options",
      "q",
      "a",
      "related",
      "requestChecks",
      "requiredInputs",
      "reviewChecks",
      "sections",
      "shortTitle",
      "text",
      "title",
      "workflow",
    ]);
    const visibleJsxCollectionProps = new Set([
      "faq",
      "fitSignals",
      "items",
      "options",
      "related",
      "requestChecks",
      "requiredInputs",
      "reviewChecks",
      "sections",
      "workflow",
    ]);

    const isFirstTupleControlValue = (node: ts.Node, boundary: ts.Node) => {
      let current = node;
      while (current.parent && current.parent !== boundary) {
        const parent = current.parent;
        if (
          ts.isArrayLiteralExpression(parent) &&
          parent.elements.length >= 2 &&
          parent.elements[0] === current
        ) {
          let container: ts.Node | undefined = parent.parent;
          while (container && container !== boundary) {
            if (ts.isArrayLiteralExpression(container)) return true;
            if (
              ts.isJsxAttribute(container) ||
              ts.isPropertyAssignment(container)
            ) {
              break;
            }
            container = container.parent;
          }
        }
        current = parent;
      }
      return false;
    };

    const isInsideVisibleCollection = (node: ts.Node) => {
      let current = node.parent;
      while (current && !ts.isSourceFile(current)) {
        if (ts.isPropertyAssignment(current)) {
          const propertyName =
            ts.isIdentifier(current.name) || ts.isStringLiteral(current.name)
              ? current.name.text
              : "";
          return (
            visibleCollectionProps.has(propertyName) &&
            !(
              propertyName === "options" &&
              isFirstTupleControlValue(node, current)
            )
          );
        }
        current = current.parent;
      }
      return false;
    };

    const jsxAttributeAncestor = (node: ts.Node) => {
      let current = node.parent;
      while (current && !ts.isSourceFile(current)) {
        if (ts.isJsxAttribute(current)) return current;
        current = current.parent;
      }
      return null;
    };

    const isDirectCustomAttributeValue = (
      node: ts.Node,
      attribute: ts.JsxAttribute,
    ) => {
      let current = node;
      while (current.parent && current.parent !== attribute) {
        const parent = current.parent;
        if (ts.isJsxExpression(parent)) return parent.expression === current;
        if (
          ts.isObjectLiteralExpression(parent) ||
          ts.isArrayLiteralExpression(parent) ||
          ts.isPropertyAssignment(parent) ||
          ts.isArrowFunction(parent) ||
          ts.isFunctionExpression(parent)
        ) {
          return false;
        }
        current = parent;
      }
      return current.parent === attribute && ts.isStringLiteral(current);
    };

    const isVisibleCustomJsxAttribute = (attribute: ts.JsxAttribute) => {
      if (!ts.isIdentifier(attribute.name)) return false;
      const propName = attribute.name.text;
      const siblingNames = new Set(
        attribute.parent.properties.flatMap((property) =>
          ts.isJsxAttribute(property) && ts.isIdentifier(property.name)
            ? [property.name.text]
            : [],
        ),
      );
      const isStructuralSelectionValue =
        propName === "value" &&
        siblingNames.has("activeView") &&
        siblingNames.has("label") &&
        (siblingNames.has("onView") || siblingNames.has("onValueChange"));
      if (
        isStructuralSelectionValue ||
        nonVisibleCustomStringProps.has(propName) ||
        propName.startsWith("data-") ||
        /^on[A-Z]/u.test(propName)
      ) {
        return false;
      }

      const attributes = attribute.parent;
      const element = attributes.parent;
      if (
        !ts.isJsxOpeningElement(element) &&
        !ts.isJsxSelfClosingElement(element)
      ) {
        return false;
      }

      const tagName = element.tagName;
      return (
        (ts.isIdentifier(tagName) && /^[A-Z]/u.test(tagName.text)) ||
        ts.isPropertyAccessExpression(tagName)
      );
    };

    const isInsideVisibleJsxAttribute = (node: ts.Node) => {
      const attribute = jsxAttributeAncestor(node);
      if (!attribute || !ts.isIdentifier(attribute.name)) return false;
      const propName = attribute.name.text;
      if (visibleStringProps.has(propName)) return true;
      if (visibleJsxCollectionProps.has(propName)) {
        return !(
          propName === "options" && isFirstTupleControlValue(node, attribute)
        );
      }
      return (
        isVisibleCustomJsxAttribute(attribute) &&
        isDirectCustomAttributeValue(node, attribute)
      );
    };

    const isTranslationKeyArgument = (node: ts.Node) => {
      let current: ts.Node | undefined = node.parent;
      while (current && !ts.isSourceFile(current)) {
        if (ts.isCallExpression(current)) {
          const contract = reviewedTranslatorContractForCall(current);
          if (
            contract &&
            isInsideSkippedTranslatorArgument(node, current, contract)
          ) {
            return true;
          }
        }
        current = current.parent;
      }
      return false;
    };

    const isVisibleSetterName = (name: string) =>
      name !== "setCopyStatus" &&
      /^set(?:[A-Z][A-Za-z0-9]*)?(?:Error|Feedback|Message|Notice|Status|Success)$/u.test(
        name,
      );

    const isInsideVisibleSetter = (node: ts.Node) => {
      let current = node.parent;
      while (current && !ts.isSourceFile(current)) {
        if (ts.isPropertyAssignment(current)) {
          const propertyName =
            ts.isIdentifier(current.name) || ts.isStringLiteral(current.name)
              ? current.name.text
              : "";
          if (
            !visibleStringProps.has(propertyName) &&
            !visibleCollectionProps.has(propertyName)
          ) {
            return false;
          }
        }
        if (ts.isCallExpression(current)) {
          const callee = current.expression;
          const name = ts.isIdentifier(callee)
            ? callee.text
            : ts.isPropertyAccessExpression(callee)
              ? callee.name.text
              : "";
          if (isVisibleSetterName(name)) return true;
        }
        current = current.parent;
      }
      return false;
    };

    const isAuditedTranslatorControlProperty = (node: ts.Node) => {
      if (translatorArgumentAuditDisposition(node) !== "audited") return false;
      const location = auditedTranslatorLocationForNode(node);
      return location ? isTranslatorControlPath(location) : false;
    };

    const isControlFlowLiteral = (node: ts.Node) => {
      if (isAuditedTranslatorControlProperty(node)) return true;
      let current = node.parent;
      while (current && !ts.isSourceFile(current)) {
        if (ts.isBinaryExpression(current)) {
          switch (current.operatorToken.kind) {
            case ts.SyntaxKind.EqualsEqualsToken:
            case ts.SyntaxKind.ExclamationEqualsToken:
            case ts.SyntaxKind.EqualsEqualsEqualsToken:
            case ts.SyntaxKind.ExclamationEqualsEqualsToken:
            case ts.SyntaxKind.LessThanToken:
            case ts.SyntaxKind.LessThanEqualsToken:
            case ts.SyntaxKind.GreaterThanToken:
            case ts.SyntaxKind.GreaterThanEqualsToken:
            case ts.SyntaxKind.InKeyword:
            case ts.SyntaxKind.InstanceOfKeyword:
              return true;
            default:
              // Logical operators render one of their operands. A string or
              // template inside `condition && <UI>` / `value || fallback`
              // remains customer-visible and must continue through the audit.
              break;
          }
        }
        if (ts.isCaseClause(current) && current.expression === node)
          return true;
        current = current.parent;
      }
      return false;
    };

    const isMappedTupleControlValue = (node: ts.Node) => {
      let current = node;
      while (current.parent && !ts.isSourceFile(current.parent)) {
        const parent = current.parent;
        if (
          ts.isArrayLiteralExpression(parent) &&
          parent.elements.length >= 2 &&
          parent.elements[0] === current &&
          ts.isArrayLiteralExpression(parent.parent)
        ) {
          let mappedSource: ts.Node = parent.parent;
          let access = mappedSource.parent;
          while (
            ts.isParenthesizedExpression(access) ||
            ts.isAsExpression(access) ||
            ts.isTypeAssertionExpression(access) ||
            ts.isNonNullExpression(access)
          ) {
            mappedSource = access;
            access = access.parent;
          }
          return (
            ts.isPropertyAccessExpression(access) &&
            access.expression === mappedSource &&
            access.name.text === "map" &&
            ts.isCallExpression(access.parent)
          );
        }
        if (ts.isJsxExpression(parent)) break;
        current = parent;
      }
      return false;
    };

    const isNonVisibleCallArgument = (node: ts.Node) => {
      let current = node;
      while (current.parent && !ts.isSourceFile(current.parent)) {
        const parent = current.parent;
        if (ts.isCallExpression(parent)) {
          const argumentIndex = parent.arguments.findIndex(
            (argument) => argument === current,
          );
          if (argumentIndex >= 0) {
            const callee = parent.expression;
            const callName = ts.isIdentifier(callee)
              ? callee.text
              : ts.isPropertyAccessExpression(callee)
                ? callee.name.text
                : "";
            if (
              ["endsWith", "get", "has", "includes", "startsWith"].includes(
                callName,
              ) ||
              ((callName === "replace" || callName === "replaceAll") &&
                argumentIndex === 0) ||
              (callName === "normalizeWidgetLanguage" && argumentIndex === 1) ||
              ([
                "formatCustomerMessageCount",
                "formatCustomerNewMessageCount",
              ].includes(callName) &&
                argumentIndex === 0) ||
              (["formatMessageDay", "formatMessageTime"].includes(callName) &&
                argumentIndex === 1) ||
              (file.replaceAll("\\", "/") ===
                "src/app/dashboard/credits/page.tsx" &&
                [
                  "creditPurchaseCaughtErrorMessage",
                  "creditPurchaseErrorMessage",
                ].includes(callName) &&
                argumentIndex === 0) ||
              callName === "buildNewRequestPath"
            ) {
              return true;
            }
          }
        }
        if (ts.isJsxExpression(parent) || ts.isJsxAttribute(parent)) break;
        current = parent;
      }
      return false;
    };

    const isMappedLiteralArray = (node: ts.Node) => {
      let current = node.parent;
      while (current && !ts.isSourceFile(current)) {
        if (ts.isArrayLiteralExpression(current)) {
          const access = current.parent;
          return (
            ts.isPropertyAccessExpression(access) &&
            access.expression === current &&
            access.name.text === "map" &&
            ts.isCallExpression(access.parent)
          );
        }
        if (ts.isJsxExpression(current)) break;
        current = current.parent;
      }
      return false;
    };

    const isVisibleJsxExpressionString = (node: ts.Node) => {
      if (jsxAttributeAncestor(node)) return false;
      const mappedLiteral = isMappedLiteralArray(node);
      let current = node.parent;
      while (current && !ts.isSourceFile(current)) {
        if (ts.isJsxExpression(current)) return true;
        if (ts.isBinaryExpression(current)) {
          if (
            current.operatorToken.kind !== ts.SyntaxKind.PlusToken &&
            current.operatorToken.kind !==
              ts.SyntaxKind.AmpersandAmpersandToken &&
            current.operatorToken.kind !== ts.SyntaxKind.BarBarToken &&
            current.operatorToken.kind !== ts.SyntaxKind.QuestionQuestionToken
          ) {
            return false;
          }
          current = current.parent;
          continue;
        }
        if (ts.isConditionalExpression(current)) {
          current = current.parent;
          continue;
        }
        if (ts.isCallExpression(current)) {
          const contract = reviewedTranslatorContractForCall(current);
          if (contract) {
            const argumentIndex = translatorArgumentIndexContaining(
              node,
              current,
            );
            if (
              argumentIndex >= 0 &&
              !contract.auditedArgumentIndexes.has(argumentIndex)
            ) {
              return false;
            }
          }
          current = current.parent;
          continue;
        }
        if (
          ts.isArrowFunction(current) ||
          ts.isFunctionExpression(current) ||
          ts.isPropertyAssignment(current)
        ) {
          return mappedLiteral;
        }
        current = current.parent;
      }
      return false;
    };

    const isNestedInStringConcatenation = (node: ts.Node) => {
      let current = node.parent;
      while (current && !ts.isSourceFile(current)) {
        if (
          ts.isBinaryExpression(current) &&
          current.operatorToken.kind === ts.SyntaxKind.PlusToken
        ) {
          return true;
        }
        if (
          ts.isJsxExpression(current) ||
          ts.isJsxAttribute(current) ||
          ts.isCallExpression(current)
        ) {
          return false;
        }
        current = current.parent;
      }
      return false;
    };

    const isVisibleDynamicComposition = (node: ts.Node) => {
      if (isUnauditedStructuralValue(node)) {
        return false;
      }
      const translatorDisposition = translatorArgumentAuditDisposition(node);
      if (isAuditedTranslatorControlProperty(node)) return false;
      if (translatorDisposition === "audited") return true;
      if (translatorDisposition === "ignored") return false;
      if (isControlFlowLiteral(node)) return false;
      if (jsxAttributeAncestor(node)) return isInsideVisibleJsxAttribute(node);
      if (isInsideVisibleSetter(node)) return true;

      let current = node.parent;
      while (current && !ts.isSourceFile(current)) {
        if (ts.isJsxExpression(current)) return true;
        if (
          ts.isCallExpression(current) ||
          ts.isBinaryExpression(current) ||
          ts.isConditionalExpression(current) ||
          ts.isParenthesizedExpression(current)
        ) {
          current = current.parent;
          continue;
        }
        if (
          ts.isArrowFunction(current) ||
          ts.isFunctionExpression(current) ||
          ts.isPropertyAssignment(current)
        ) {
          return false;
        }
        current = current.parent;
      }
      return false;
    };

    const rememberDynamicExpression = (
      node: ts.Expression,
      kind: DynamicVisibleExpression["kind"],
    ) => {
      const fingerprint = `${kind}:${node.pos}:${node.end}`;
      if (rememberedDynamicExpressions.has(fingerprint)) return;
      rememberedDynamicExpressions.add(fingerprint);
      const { line } = source.getLineAndCharacterOfPosition(
        node.getStart(source),
      );
      dynamicVisibleExpressions.push({
        file: file.replaceAll("\\", "/"),
        kind,
        line: line + 1,
        source: node.getText(source).replace(/\s+/gu, " ").trim(),
      });
    };

    const rememberedDynamicExpressions = new Set<string>();

    auditedWrapperDefaultDynamicCompositions.forEach((expression) => {
      rememberDynamicExpression(
        expression,
        ts.isTemplateExpression(expression) ? "template" : "concatenation",
      );
    });

    function hasStringSyntax(expression: ts.Expression): boolean {
      if (
        ts.isStringLiteral(expression) ||
        ts.isNoSubstitutionTemplateLiteral(expression) ||
        ts.isTemplateExpression(expression)
      ) {
        return true;
      }
      return (
        ts.isBinaryExpression(expression) &&
        expression.operatorToken.kind === ts.SyntaxKind.PlusToken &&
        (hasStringSyntax(expression.left) || hasStringSyntax(expression.right))
      );
    }

    const isObjectPropertyNameNode = (node: ts.Node) => {
      const parent = node.parent;
      if (
        (ts.isPropertyAssignment(parent) ||
          ts.isMethodDeclaration(parent) ||
          ts.isGetAccessorDeclaration(parent) ||
          ts.isSetAccessorDeclaration(parent)) &&
        parent.name === node
      ) {
        return true;
      }
      if (!ts.isComputedPropertyName(parent) || parent.expression !== node) {
        return false;
      }
      const declaration = parent.parent;
      return (
        (ts.isPropertyAssignment(declaration) ||
          ts.isMethodDeclaration(declaration) ||
          ts.isGetAccessorDeclaration(declaration) ||
          ts.isSetAccessorDeclaration(declaration)) &&
        declaration.name === parent
      );
    };

    const isInsideStaticAccessSelector = (node: ts.Node) => {
      let current = node;
      while (current.parent && !ts.isSourceFile(current.parent)) {
        const parent = current.parent;
        if (ts.isPropertyAccessExpression(parent)) {
          if (parent.name === current) return true;
          if (parent.expression === current) return false;
        }
        if (ts.isElementAccessExpression(parent)) {
          if (parent.argumentExpression === current) return true;
          if (parent.expression === current) return false;
        }
        if (
          ts.isCallExpression(parent) ||
          ts.isJsxExpression(parent) ||
          ts.isJsxAttribute(parent) ||
          ts.isPropertyAssignment(parent)
        ) {
          return false;
        }
        current = parent;
      }
      return false;
    };

    const isStaticReferenceNode = (
      node: ts.Node,
    ): node is
      | ts.Identifier
      | ts.PropertyAccessExpression
      | ts.ElementAccessExpression =>
      ts.isIdentifier(node) ||
      ts.isPropertyAccessExpression(node) ||
      ts.isElementAccessExpression(node);

    const isNestedStaticReferenceBase = (node: ts.Node) => {
      const parent = node.parent;
      return (
        (ts.isPropertyAccessExpression(parent) && parent.expression === node) ||
        (ts.isElementAccessExpression(parent) && parent.expression === node)
      );
    };

    const isJsxTagNameNode = (node: ts.Node) => {
      const parent = node.parent;
      return (
        ((ts.isJsxOpeningElement(parent) ||
          ts.isJsxClosingElement(parent) ||
          ts.isJsxSelfClosingElement(parent)) &&
          parent.tagName === node) ||
        (ts.isPropertyAccessExpression(parent) &&
          parent.name === node &&
          (ts.isJsxOpeningElement(parent.parent) ||
            ts.isJsxClosingElement(parent.parent) ||
            ts.isJsxSelfClosingElement(parent.parent)))
      );
    };

    const isCallConstructOrTagTarget = (node: ts.Node) => {
      const parent = node.parent;
      return (
        (ts.isCallExpression(parent) && parent.expression === node) ||
        (ts.isNewExpression(parent) && parent.expression === node) ||
        (ts.isTaggedTemplateExpression(parent) && parent.tag === node)
      );
    };

    const isInsideOptionsCollection = (node: ts.Node) => {
      let current = node.parent;
      while (current && !ts.isSourceFile(current)) {
        if (
          ts.isJsxAttribute(current) &&
          ts.isIdentifier(current.name) &&
          current.name.text === "options"
        ) {
          return true;
        }
        if (ts.isPropertyAssignment(current)) {
          const propertyName =
            ts.isIdentifier(current.name) || ts.isStringLiteral(current.name)
              ? current.name.text
              : "";
          if (propertyName === "options") return true;
        }
        current = current.parent;
      }
      return false;
    };

    const isVisibleStaticReference = (node: ts.Expression) => {
      if (isUnauditedStructuralValue(node)) {
        return false;
      }
      // A statically resolved enum/object member used only as a comparison or
      // switch selector is machine state, not rendered copy. Direct JSX use of
      // that same member does not satisfy this predicate and remains audited.
      if (isControlFlowLiteral(node)) return false;
      const translatorDisposition = translatorArgumentAuditDisposition(node);
      if (isAuditedTranslatorControlProperty(node)) return false;
      if (translatorDisposition === "audited") return true;
      if (translatorDisposition === "ignored") return false;
      if (isNonVisibleCallArgument(node)) return false;
      if (jsxAttributeAncestor(node)) {
        return isInsideVisibleJsxAttribute(node);
      }
      return (
        isVisibleJsxExpressionString(node) ||
        isInsideVisibleCollection(node) ||
        isInsideVisibleSetter(node)
      );
    };

    const isPortableNonCopyScalarInitializer = (expression: ts.Expression) => {
      const current = unwrapExpression(expression);
      if (
        ts.isNumericLiteral(current) ||
        current.kind === ts.SyntaxKind.TrueKeyword ||
        current.kind === ts.SyntaxKind.FalseKeyword ||
        current.kind === ts.SyntaxKind.NullKeyword
      ) {
        return true;
      }
      return (
        ts.isPrefixUnaryExpression(current) &&
        [ts.SyntaxKind.PlusToken, ts.SyntaxKind.MinusToken].includes(
          current.operator,
        ) &&
        ts.isNumericLiteral(unwrapExpression(current.operand))
      );
    };

    const visit = (node: ts.Node) => {
      if (isReviewedModelField(file.replaceAll("\\", "/"), node)) return;
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
        const declarations = catalogDeclarationsWithParityTests.get(
          file.replaceAll("\\", "/"),
        );
        if (declarations?.has(node.name.text)) return;
      }

      if (ts.isJsxText(node)) {
        remember(node.text);
      }

      if (
        isStaticReferenceNode(node) &&
        !isNestedStaticReferenceBase(node) &&
        !isInsideStaticAccessSelector(node) &&
        !isObjectPropertyNameNode(node) &&
        !isJsxTagNameNode(node) &&
        !isCallConstructOrTagTarget(node) &&
        isVisibleStaticReference(node)
      ) {
        const translatorLocation = auditedTranslatorLocationForNode(node);
        const staticLeaves = collectStaticStringLeaves(
          node,
          new Set(),
          new Set(),
          isInsideOptionsCollection(node),
          translatorLocation,
        );
        staticLeaves.forEach(remember);
        const staticBinding = staticBindingForReference(node);
        const importDescriptor = staticBinding?.importDescriptor;
        const resolvedPortableNonCopyScalar = Boolean(
          staticBinding?.initializer &&
          portableStaticExpression(staticBinding.initializer) &&
          isPortableNonCopyScalarInitializer(staticBinding.initializer),
        );
        const reviewedNonCopyImport = Boolean(
          importDescriptor &&
          reviewedNonCopyVisibleImportDescriptors.has(importDescriptor),
        );
        const reviewedLocalizedCatalogImport = Boolean(
          importDescriptor &&
          staticBinding?.initializer &&
          reviewedLocalizedCatalogImportDescriptors.has(importDescriptor),
        );
        if (
          staticLeaves.size === 0 &&
          importDescriptor &&
          !resolvedPortableNonCopyScalar &&
          !reviewedNonCopyImport &&
          !reviewedLocalizedCatalogImport
        ) {
          const { line } = source.getLineAndCharacterOfPosition(
            node.getStart(source),
          );
          unresolvedVisibleImports.add(
            `${file.replaceAll("\\", "/")}:${line + 1} ${importDescriptor}`,
          );
        }
        collectStaticDynamicCompositions(
          node,
          new Set(),
          [],
          new Set(),
          translatorLocation,
        ).forEach((expression) => {
          rememberDynamicExpression(
            expression,
            ts.isTemplateExpression(expression) ? "template" : "concatenation",
          );
        });
        mutationExpressionsForStaticReference(node).forEach((expression) => {
          collectStaticStringLeaves(
            expression,
            new Set(),
            new Set(),
            false,
            translatorLocation,
          ).forEach(remember);
          collectStaticDynamicCompositions(
            expression,
            new Set(),
            [],
            new Set(),
            translatorLocation,
          ).forEach((composition) => {
            rememberDynamicExpression(
              composition,
              ts.isTemplateExpression(composition)
                ? "template"
                : "concatenation",
            );
          });
        });
      }

      if (
        ts.isJsxAttribute(node) &&
        ts.isIdentifier(node.name) &&
        (visibleStringProps.has(node.name.text) ||
          visibleJsxCollectionProps.has(node.name.text) ||
          isVisibleCustomJsxAttribute(node))
      ) {
        const value = node.initializer;
        if (value && ts.isStringLiteral(value) && value.text.trim()) {
          remember(value.text);
        }
      }

      if (
        ts.isPropertyAssignment(node) &&
        ((ts.isIdentifier(node.name) &&
          visibleStringProps.has(node.name.text)) ||
          (ts.isStringLiteral(node.name) &&
            visibleStringProps.has(node.name.text))) &&
        (ts.isStringLiteral(node.initializer) ||
          ts.isNoSubstitutionTemplateLiteral(node.initializer))
      ) {
        remember(node.initializer.text);
      }

      if (
        (ts.isStringLiteral(node) ||
          ts.isNoSubstitutionTemplateLiteral(node)) &&
        !isTranslationKeyArgument(node) &&
        !isInsideStaticAccessSelector(node) &&
        !isObjectPropertyNameNode(node) &&
        !isUnauditedStructuralValue(node) &&
        translatorArgumentAuditDisposition(node) !== "ignored" &&
        !isControlFlowLiteral(node) &&
        !isMappedTupleControlValue(node) &&
        !isNonVisibleCallArgument(node) &&
        (translatorArgumentAuditDisposition(node) === "audited" ||
          isVisibleJsxExpressionString(node) ||
          isInsideVisibleJsxAttribute(node) ||
          isInsideVisibleCollection(node) ||
          isInsideVisibleSetter(node)) &&
        node.text.trim().length > 1
      ) {
        remember(node.text);
      }

      if (
        ts.isTemplateExpression(node) &&
        !isNestedInStringConcatenation(node) &&
        isVisibleDynamicComposition(node)
      ) {
        remember(node.head.text);
        node.templateSpans.forEach((span) => remember(span.literal.text));
        rememberDynamicExpression(node, "template");
      }

      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.PlusToken &&
        hasStringSyntax(node) &&
        !(
          ts.isBinaryExpression(node.parent) &&
          node.parent.operatorToken.kind === ts.SyntaxKind.PlusToken
        ) &&
        isVisibleDynamicComposition(node)
      ) {
        rememberDynamicExpression(node, "concatenation");
      }

      ts.forEachChild(node, visit);
    };

    visit(source);
  }

  const values = [...strings]
    .filter((value) => !/^[-+#.:/\d\s]+$/u.test(value))
    .sort((left, right) => left.localeCompare(right));

  return {
    broadNoTranslateFiles,
    dynamicVisibleExpressions,
    sourceFilesByValue,
    unresolvedVisibleImports,
    values,
  };
}

function isInvariant(value: string) {
  return (
    invariantValues.has(value) ||
    invariantPatterns.some((pattern) => pattern.test(value))
  );
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function summarizeValues(values: readonly string[], limit = 12) {
  const sample = values.slice(0, limit).join(" | ");
  const remaining = values.length - Math.min(values.length, limit);
  return remaining > 0 ? `${sample} | … ${remaining} more` : sample;
}

const homepageLocaleOrder = supportedLocales
  .map(({ code }) => code)
  .filter((code): code is Exclude<LocaleCode, "en"> => code !== "en");

const homepageCatalogs = Object.fromEntries(
  homepageLocaleOrder.map((locale) => [
    locale,
    buildHomepageTranslationCatalog(locale)?.exact ?? {},
  ]),
) as Record<Exclude<LocaleCode, "en">, Record<string, string>>;

const homepageCatalogSources = new Set(
  homepageLocaleOrder.flatMap((locale) =>
    Object.keys(homepageCatalogs[locale]),
  ),
);
const homepageScopedTranslations: Record<string, readonly string[]> =
  Object.fromEntries(
    [...homepageCatalogSources].map((source) => [
      source,
      homepageLocaleOrder.map(
        (locale) => homepageCatalogs[locale][source] ?? "",
      ),
    ]),
  );

const homepageVehicleTranslations: Record<string, readonly string[]> =
  Object.fromEntries(
    (
      Object.keys(publicVehicleCopy.en) as Array<
        keyof typeof publicVehicleCopy.en
      >
    ).map((field) => [
      publicVehicleCopy.en[field],
      homepageLocaleOrder.map((locale) => publicVehicleCopy[locale][field]),
    ]),
  );

const dtcAnalyzerFallbackLocaleOrder = dtcAnalyzerLocaleOrder.filter(
  (locale) => locale !== "en",
);
const dtcAnalyzerFallbackTranslations: Record<string, readonly string[]> =
  Object.fromEntries(
    dtcAnalyzerMessageRows.map(([, source, ...translations]) => [
      source,
      translations,
    ]),
  );

const emailLocaleOrder = supportedLocales
  .map(({ code }) => code)
  .filter((code): code is Exclude<LocaleCode, "en"> => code !== "en");

function collectEmailCopyLeaves(
  value: unknown,
  pathSegments: readonly string[] = [],
): Array<readonly [path: string, value: string]> {
  if (typeof value === "string") {
    return [[pathSegments.join("."), value]];
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value).flatMap(([key, nested]) =>
    collectEmailCopyLeaves(nested, [...pathSegments, key]),
  );
}

function emailCopyValueAtPath(locale: LocaleCode, copyPath: string) {
  let current: unknown = emailLocaleCopy[locale];
  for (const segment of copyPath.split(".")) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return "";
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === "string" ? current : "";
}

const emailLocaleTranslations: Record<string, readonly string[]> =
  Object.fromEntries(
    collectEmailCopyLeaves(emailLocaleCopy.en).map(([copyPath, source]) => [
      source,
      emailLocaleOrder.map((locale) => emailCopyValueAtPath(locale, copyPath)),
    ]),
  );

const supplementalCatalogs: ReadonlyArray<
  readonly [
    label: string,
    localeOrder: readonly string[],
    translations: Record<string, readonly string[]>,
  ]
> = [
  [
    "customer-workflow",
    customerWorkflowLocaleOrder,
    customerWorkflowExactTranslations,
  ],
  [
    "dtc-analyzer",
    dtcAnalyzerFallbackLocaleOrder,
    dtcAnalyzerFallbackTranslations,
  ],
  ["email", emailLocaleOrder, emailLocaleTranslations],
  ["homepage", homepageLocaleOrder, homepageScopedTranslations],
  ["homepage-vehicle", homepageLocaleOrder, homepageVehicleTranslations],
  ["log-studio", logStudioExactLocaleOrder, logStudioExactTranslations],
  ["public-core", publicSurfaceLocaleOrder, publicCoreTranslations],
  ["public-vehicle", publicSurfaceLocaleOrder, publicVehicleTranslations],
  ["public-services", publicSurfaceLocaleOrder, publicServicesTranslations],
  ["public-tools", publicSurfaceLocaleOrder, publicToolsTranslations],
  ["service-intent", serviceIntentLocaleOrder, serviceIntentExactTranslations],
  ["widget-site", widgetSiteLocaleOrder, widgetSiteExactTranslations],
  ["workshop-guides", workshopGuideLocaleOrder, workshopGuideExactTranslations],
];

function supplementalTranslationsFor(value: string, locale: LocaleCode) {
  if (locale === "en") return [];

  return supplementalCatalogs.flatMap(([label, localeOrder, translations]) => {
    if (!Object.prototype.hasOwnProperty.call(translations, value)) return [];
    const localeIndex = localeOrder.indexOf(locale);
    const translated =
      localeIndex >= 0 ? translations[value]?.[localeIndex]?.trim() : "";
    return translated ? [{ label, value: translated }] : [];
  });
}

function allowedSupplementalLabelsForFile(file: string) {
  const absoluteOrProjectPath = file.replaceAll("\\", "/");
  const embeddedProjectSource = absoluteOrProjectPath.lastIndexOf("/src/");
  const normalized =
    fixtureAuditMode && embeddedProjectSource >= 0
      ? absoluteOrProjectPath.slice(embeddedProjectSource + 1)
      : absoluteOrProjectPath;
  const labels = new Set<string>();
  const add = (...items: string[]) => items.forEach((item) => labels.add(item));

  if (/^src\/app\/(?:layout|opengraph-image|page)\.tsx$/u.test(normalized))
    add("homepage");
  if (/^src\/app\/(?:about|contact|download)(?:\/|$)/u.test(normalized))
    add("public-core");
  if (/^src\/app\/(?:brands|ecu-platforms)(?:\/|$)/u.test(normalized))
    add("public-core", "public-vehicle");
  if (/^src\/app\/services(?:\/|$)/u.test(normalized))
    add("public-core", "public-services", "service-intent");
  if (/^src\/app\/\[locale\]\/services(?:\/|$)/u.test(normalized))
    add("public-core", "public-services", "service-intent");
  if (/^src\/app\/tools(?:\/|$)/u.test(normalized))
    add("public-core", "public-tools", "log-studio");
  if (/^src\/app\/embed(?:\/|$)/u.test(normalized)) add("widget-site");
  if (/^src\/app\/widget(?:\/|$)/u.test(normalized))
    add("public-core", "widget-site");
  if (/^src\/app\/workshop-guides(?:\/|$)/u.test(normalized))
    add("public-core", "workshop-guides");
  if (
    customerWorkflowManifestSourceFileSet.has(normalized) ||
    (/^src\/app\/(?:auth|dashboard|desktop-auth|forgot-password|login|measurement|new-request|payment|register|reset-password)(?:\/|$)/u.test(
      normalized,
    ) &&
      !/\/page\.[jt]sx?$/u.test(normalized))
  )
    add("customer-workflow");
  if (normalized === "src/app/dashboard/orders/[id]/page.tsx")
    add("dtc-analyzer");
  if (/^src\/app\/dashboard\/widget(?:\/|$)/u.test(normalized))
    add("widget-site");
  if (/^src\/app\/dashboard\/log-analysis(?:\/|$)/u.test(normalized))
    add("log-studio");
  if (normalized === "src/lib/email/localeCopy.ts") add("email");

  if (/^src\/components\/widget\//u.test(normalized)) add("widget-site");
  if (normalized === "src/components/homepage/HomepageExperience.tsx")
    add("homepage", "public-core");
  if (normalized === "src/components/homepage/VehicleIntelligence.tsx")
    add("homepage-vehicle");
  if (/^src\/components\/tools\//u.test(normalized))
    add("public-core", "public-tools");
  if (/^src\/components\/(?:account|auth|dashboard)\//u.test(normalized))
    add("customer-workflow");
  if (normalized === "src/components/dashboard/LogAnalysisStudio.tsx")
    add("public-tools", "log-studio");
  if (normalized === "src/components/dashboard/WidgetDashboardClient.tsx")
    add("widget-site");
  if (
    /^src\/components\/(?:CustomerNotificationsRuntime|CustomerNotifications|CountrySelect|InternationalPhoneField|RequestChat)\.tsx$/u.test(
      normalized,
    )
  )
    add("customer-workflow");
  if (
    /^src\/components\/(?:FileServiceSearchNavigator|ServiceIntentPage|Stage1Authority|StageComparison)\.tsx$/u.test(
      normalized,
    )
  )
    add("public-core", "public-services", "service-intent");
  if (
    /^src\/components\/(?:Footer|PublicSeoHeader|RuntimePublicFooter)\.tsx$/u.test(
      normalized,
    )
  )
    add("public-core");
  if (normalized === "src/components/SeoGuidePage.tsx")
    add("public-core", "public-vehicle");
  if (normalized === "src/components/analytics/PublicAnalytics.tsx")
    add("public-core");
  if (
    /^src\/components\/(?:OnlineStatus|PlatformReliabilityMonitor)\.tsx$/u.test(
      normalized,
    )
  )
    add("public-core", "customer-workflow");
  if (
    /^src\/components\/(?:app-shell|ui\/efferd-dashboard-2)\.tsx$/u.test(
      normalized,
    )
  )
    add("customer-workflow");

  if (normalized === "src/lib/industry-content.ts") add("public-vehicle");
  if (normalized === "src/lib/serviceIntentGuides.ts") add("service-intent");
  if (normalized === "src/lib/workshopGuides.ts") add("workshop-guides");

  return labels;
}

type TranslationCandidate = {
  readonly label: string;
  readonly value: string;
};

function dictionaryTranslationCandidates(
  value: string,
  locale: NonEnglishLocaleCode,
  files?: Iterable<string>,
): TranslationCandidate[] {
  const candidates: TranslationCandidate[] = [];
  const sourceFiles = files ? [...files] : [];
  const baseExact = exactTranslations[locale][value]?.trim();
  if (baseExact) candidates.push({ label: "base-exact", value: baseExact });

  const baseTerm = termTranslations[locale][value]?.trim();
  if (baseTerm) candidates.push({ label: "base-term", value: baseTerm });

  for (const candidate of supplementalTranslationsFor(value, locale)) {
    if (
      sourceFiles.length === 0 ||
      sourceFiles.some((file) =>
        allowedSupplementalLabelsForFile(file).has(candidate.label),
      )
    ) {
      candidates.push(candidate);
    }
  }

  const brandedTitleSuffix = " | MG AutoTech";
  if (candidates.length === 0 && value.endsWith(brandedTitleSuffix)) {
    return dictionaryTranslationCandidates(
      value.slice(0, -brandedTitleSuffix.length),
      locale,
      files,
    ).map((candidate) => ({
      label: `${candidate.label}+brand-suffix`,
      value: `${candidate.value}${brandedTitleSuffix}`,
    }));
  }

  return candidates;
}

function dictionaryCovers(
  value: string,
  locale: NonEnglishLocaleCode,
  files?: Iterable<string>,
) {
  const sourceFiles = files ? [...files] : [];
  const hasAcceptableCandidate = (candidateFiles?: Iterable<string>) =>
    dictionaryTranslationCandidates(value, locale, candidateFiles).some(
      (candidate) =>
        candidate.value !== value ||
        isReviewedSourceIdenticalTarget(value, locale),
    );

  return sourceFiles.length === 0
    ? hasAcceptableCandidate()
    : sourceFiles.every((file) => hasAcceptableCandidate([file]));
}

function catalogHasSourceIdenticalTarget(
  source: string,
  locale: NonEnglishLocaleCode,
) {
  return (
    exactTranslations[locale][source]?.trim() === source ||
    termTranslations[locale][source]?.trim() === source ||
    supplementalTranslationsFor(source, locale).some(
      (candidate) => candidate.value === source,
    )
  );
}

function compactTermCovers(value: string, locale: NonEnglishLocaleCode) {
  const wordCount = value.match(/\p{L}+/gu)?.length ?? 0;
  if (wordCount > 6) return false;

  return Object.entries(termTranslations[locale]).some(([source, target]) => {
    if (!source.trim() || !target.trim()) return false;
    if (source === target && !isReviewedSourceIdenticalTarget(source, locale)) {
      return false;
    }
    const prefix = /^\w/u.test(source) ? "\\b" : "";
    const suffix = /\w$/u.test(source) ? "\\b" : "";
    return new RegExp(`${prefix}${escapeRegex(source)}${suffix}`, "iu").test(
      value,
    );
  });
}

const criticalExactValues = new Set([
  "Secure customer access",
  "Please log in to create a file request",
  "Vehicle details, selected services and private uploads must stay connected to your verified MG AutoTech account.",
  "Log in securely",
  "Create account",
  "Return to homepage",
  "Professional ECU file service starts here.",
  "Login to upload files, create tuning requests, manage credits and track your MG AutoTech orders in one secure dashboard.",
  "Continue with Google",
  "No account yet?",
  "Already have an account?",
  "Password",
]);

const {
  broadNoTranslateFiles,
  dynamicVisibleExpressions,
  sourceFilesByValue,
  unresolvedVisibleImports,
  values,
} = collectVisibleStrings();
const locales = supportedLocales
  .map(({ code }) => code)
  .filter((code): code is Exclude<LocaleCode, "en"> => code !== "en");
const failures: string[] = [];
const missingSourceValues = new Set<string>();
const observedSourceIdenticalTargets = new Map<string, Set<string>>();

if (!fixtureAuditMode) {
  for (const [file, expectedFingerprint] of frozenLegacyCustomerFiles) {
    if (!fs.existsSync(file)) {
      failures.push(`frozen legacy customer surface is missing: ${file}`);
      continue;
    }
    const audit = auditFrozenSource(
      fs.readFileSync(file, "utf8"),
      expectedFingerprint,
    );
    if (!audit.matches) {
      failures.push(
        `frozen legacy customer surface changed without shared localization migration: ${file}`,
      );
    }
  }

  const appRouteEntryFiles = new Set<string>();
  walkSourceFiles("src/app", appRouteEntryFiles);

  for (const file of customerWorkflowManifestSourceFileSet) {
    if (!fs.existsSync(file)) {
      failures.push(`customer workflow manifest source is missing: ${file}`);
    }
  }

  for (const [group, surface] of customerWorkflowClientSurfaceEntries) {
    for (const route of surface.exactRoutes) {
      if (customerWorkflowClientGroupForPath(route) !== group) {
        failures.push(
          `customer workflow manifest exact route resolves to the wrong catalog: ${route} -> ${group}`,
        );
      }
    }
    for (const prefix of surface.prefixRoutes) {
      if (!prefix.endsWith("/")) {
        failures.push(
          `customer workflow manifest prefix must end with a slash: ${group} -> ${prefix}`,
        );
      }
      if (!surface.routeSamples.some((sample) => sample.startsWith(prefix))) {
        failures.push(
          `customer workflow manifest prefix has no representative route sample: ${group} -> ${prefix}`,
        );
      }
    }
    for (const sample of surface.routeSamples) {
      if (customerWorkflowClientGroupForPath(sample) !== group) {
        failures.push(
          `customer workflow manifest route sample resolves to the wrong catalog: ${sample} -> ${group}`,
        );
      }
    }
  }

  for (const appFile of appRouteEntryFiles) {
    const normalized = appFile.replaceAll("\\", "/");
    const routeMatch = normalized.match(
      /^src\/app\/(.+)\/page\.(?:js|jsx|ts|tsx)$/u,
    );
    if (!routeMatch) continue;
    const routePath = `/${routeMatch[1]}`;
    const firstSegment = routePath.split("/").filter(Boolean)[0];
    if (
      !firstSegment ||
      !customerWorkflowManagedRouteSegmentSet.has(firstSegment)
    ) {
      continue;
    }

    const owners = customerWorkflowManifestSourceOwners.get(normalized) ?? [];
    if (owners.length !== 1) {
      failures.push(
        `customer workflow page must belong to exactly one client surface: ${normalized} (${owners.join(", ") || "unclaimed"})`,
      );
      continue;
    }

    const [owner] = owners;
    if (!routePath.includes("[")) {
      if (customerWorkflowClientGroupForPath(routePath) !== owner) {
        failures.push(
          `customer workflow page route and source ownership disagree: ${normalized} -> ${owner}`,
        );
      }
      continue;
    }

    const routePattern = new RegExp(
      `^${routePath
        .replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
        .replace(/\\\[\\\[\\\.\\\.\\\.(?:[^\]]+)\\\]\\\]/gu, ".*")
        .replace(/\\\[\\\.\\\.\\\.(?:[^\]]+)\\\]/gu, ".+")
        .replace(/\\\[(?:[^\]]+)\\\]/gu, "[^/]+")}$`,
      "u",
    );
    const matchingSamples = customerWorkflowClientSurfaceManifest[
      owner
    ].routeSamples.filter((sample) => routePattern.test(sample));
    if (
      matchingSamples.length === 0 ||
      matchingSamples.some(
        (sample) => customerWorkflowClientGroupForPath(sample) !== owner,
      )
    ) {
      failures.push(
        `customer workflow dynamic page has no valid owned route sample: ${normalized} -> ${owner}`,
      );
    }
  }

  const auditedAppRoots = customerSurfaceRoots.filter((root) =>
    root.startsWith("src/app/"),
  );
  const intentionallyAuthoredAppRoots = [
    "src/app/admin",
    ...intentionallyAuthoredAppFiles,
    ...frozenLegacyCustomerFiles.keys(),
  ];
  const unclassifiedAppPages = new Set([
    ...findUnclassifiedAppRouteFiles({
      files: appRouteEntryFiles,
      auditedRoots: auditedAppRoots,
      intentionallyAuthoredRoots: intentionallyAuthoredAppRoots,
    }),
    // Co-located React components can be imported by an exact legal/frozen page
    // without using an App Router convention filename. Inventory those files as
    // well so an allowed page cannot become a directory-wide escape hatch.
    ...findUnclassifiedFiles({
      files: [...appRouteEntryFiles].filter(isCoLocatedAppUiSourceFile),
      auditedRoots: auditedAppRoots,
      intentionallyAuthoredRoots: intentionallyAuthoredAppRoots,
    }),
  ]);

  const sharedLibFiles = new Set<string>();
  walkSourceFiles("src/lib", sharedLibFiles);
  const unclassifiedSharedJsxFiles = findUnclassifiedFiles({
    files: [...sharedLibFiles].filter(isPotentialSharedUiSourceFile),
    auditedRoots: customerSurfaceRoots.filter((root) =>
      root.startsWith("src/lib/"),
    ),
    intentionallyAuthoredRoots: [],
  });

  const componentFiles = new Set<string>();
  walkSourceFiles("src/components", componentFiles);
  const auditedComponentRoots = customerSurfaceRoots.filter((root) =>
    root.startsWith("src/components/"),
  );
  const unclassifiedComponentFiles = findUnclassifiedFiles({
    files: componentFiles,
    auditedRoots: auditedComponentRoots,
    intentionallyAuthoredRoots: intentionallyAuthoredComponentRoots,
  });

  if (unclassifiedAppPages.size > 0) {
    failures.push(
      `application pages or co-located UI escaped the localization inventory: ${[...unclassifiedAppPages].join(" | ")}`,
    );
  }

  if (unclassifiedComponentFiles.length > 0) {
    failures.push(
      `component files escaped the localization inventory: ${unclassifiedComponentFiles.join(" | ")}`,
    );
  }

  if (unclassifiedSharedJsxFiles.length > 0) {
    failures.push(
      `shared JSX files escaped the localization inventory: ${unclassifiedSharedJsxFiles.join(" | ")}`,
    );
  }
}

if (broadNoTranslateFiles.size > 0) {
  failures.push(
    `broad data-no-translate boundaries hide customer/public surfaces: ${[
      ...broadNoTranslateFiles,
    ].join(" | ")}`,
  );
}

if (unresolvedVisibleImports.size > 0) {
  failures.push(
    `customer-visible local imports could not be resolved to reviewed static copy: ${summarizeValues(
      [...unresolvedVisibleImports],
    )}`,
  );
}

const dynamicExpressionAudit = auditDynamicVisibleExpressions(
  dynamicVisibleExpressions,
);
if (dynamicExpressionAudit.unclassified.length > 0) {
  failures.push(
    `unclassified customer-visible dynamic/composed expression(s): ${summarizeValues(
      dynamicExpressionAudit.unclassified.map(
        ({ file, kind, line, source }) => `${file}:${line} [${kind}] ${source}`,
      ),
    )}`,
  );
}
if (!fixtureAuditMode && dynamicExpressionAudit.staleReviewed.length > 0) {
  failures.push(
    `stale reviewed dynamic-expression signature(s): ${summarizeValues(
      dynamicExpressionAudit.staleReviewed.map(
        ({ file, kind, source }) => `${file} [${kind}] ${source}`,
      ),
    )}`,
  );
}

for (const locale of locales) {
  const sourceIdenticalCandidates = values.flatMap((value) => {
    const candidates = dictionaryTranslationCandidates(
      value,
      locale,
      sourceFilesByValue.get(value),
    ).filter((candidate) => candidate.value === value);
    return candidates.map((candidate) => ({
      label: candidate.label,
      source: value,
    }));
  });
  for (const candidate of sourceIdenticalCandidates) {
    const key = sourceIdenticalPairKey(candidate.source, locale);
    const labels = observedSourceIdenticalTargets.get(key) ?? new Set<string>();
    labels.add(candidate.label);
    observedSourceIdenticalTargets.set(key, labels);
  }
  const unreviewedSourceIdenticalCandidates = sourceIdenticalCandidates.filter(
    ({ source }) => !isReviewedSourceIdenticalTarget(source, locale),
  );

  const exact = values.filter(
    (value) =>
      isInvariant(value) ||
      dictionaryCovers(value, locale, sourceFilesByValue.get(value)),
  );
  const compactMissing = values.filter((value) => {
    const wordCount = value.match(/\p{L}+/gu)?.length ?? 0;
    return (
      wordCount <= 6 &&
      !isInvariant(value) &&
      !dictionaryCovers(value, locale, sourceFilesByValue.get(value)) &&
      !compactTermCovers(value, locale)
    );
  });
  const criticalMissing = fixtureAuditMode
    ? []
    : [...criticalExactValues].filter(
        (value) =>
          !dictionaryCovers(value, locale, sourceFilesByValue.get(value)),
      );
  const reviewedEnglishFallbacks = values.length - exact.length;
  values
    .filter(
      (value) =>
        !isInvariant(value) &&
        !dictionaryCovers(value, locale, sourceFilesByValue.get(value)),
    )
    .forEach((value) => missingSourceValues.add(value));
  const exactRatio = exact.length / values.length;
  console.log(
    `${locale}: ${exact.length}/${values.length} exact or invariant; ${reviewedEnglishFallbacks} clean English fallbacks`,
  );

  if (process.env.I18N_REPORT_FALLBACKS === "1") {
    const fallbackValues = values.filter(
      (value) =>
        !isInvariant(value) &&
        !dictionaryCovers(value, locale, sourceFilesByValue.get(value)),
    );
    console.log(`${locale} fallbacks:\n- ${fallbackValues.join("\n- ")}`);
  }

  if (process.env.I18N_REPORT_QUALITY === "1") {
    const pattern = legacyTransliterationPatterns[locale];
    const qualityFindings = pattern
      ? values.flatMap((source) => {
          const translations = [
            exactTranslations[locale][source]
              ? {
                  label: "base-exact",
                  value: exactTranslations[locale][source],
                }
              : null,
            termTranslations[locale][source]
              ? { label: "base-term", value: termTranslations[locale][source] }
              : null,
            ...supplementalTranslationsFor(source, locale),
          ].filter((entry): entry is { label: string; value: string } =>
            Boolean(entry),
          );
          return translations.flatMap(({ label, value }) =>
            pattern.test(value) ? [`${label}: ${source} => ${value}`] : [],
          );
        })
      : [];
    if (qualityFindings.length > 0) {
      console.log(
        `${locale} legacy transliteration (${qualityFindings.length}):\n- ${qualityFindings.join("\n- ")}`,
      );
    }
  }

  if (exactRatio < 0.68)
    failures.push(`${locale}: exact coverage dropped below 68%`);
  if (reviewedEnglishFallbacks > 0) {
    failures.push(
      `${locale}: ${reviewedEnglishFallbacks} reviewed English fallback(s) remain`,
    );
  }
  if (unreviewedSourceIdenticalCandidates.length > 0) {
    failures.push(
      `${locale}: unreviewed source-identical target(s): ${summarizeValues(
        unreviewedSourceIdenticalCandidates.map(
          ({ label, source }) => `${label}: ${source}`,
        ),
      )}`,
    );
  }
  if (compactMissing.length > 0) {
    failures.push(
      `${locale} compact labels (${compactMissing.length}): ${summarizeValues(compactMissing)}`,
    );
  }
  if (criticalMissing.length > 0) {
    failures.push(
      `${locale} critical exact: ${summarizeValues(criticalMissing)}`,
    );
  }
}

if (process.env.I18N_REPORT_SOURCE_IDENTICAL === "1") {
  console.log("\nUnreviewed source-identical targets:");
  for (const [key, labels] of [...observedSourceIdenticalTargets].sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
    const [locale, source] = key.split("\u0000");
    if (
      isReviewedSourceIdenticalTarget(source, locale as NonEnglishLocaleCode)
    ) {
      continue;
    }
    console.log(`${locale}: ${source} <= ${[...labels].sort().join(", ")}`);
  }
}

if (process.env.I18N_REPORT_SPECIAL_STRINGS === "1") {
  console.log("\nVisible strings containing braces or angle brackets:");
  values
    .filter((value) => /[{}<>]/u.test(value))
    .forEach((value) => console.log(value));
}

if (!fixtureAuditMode) {
  const staleReviewedSourceIdenticalTargets = [
    ...reviewedSourceIdenticalTargets,
  ].flatMap(([source, reviewedLocales]) =>
    [...reviewedLocales].flatMap((locale) =>
      catalogHasSourceIdenticalTarget(source, locale)
        ? []
        : [`${locale}: ${source}`],
    ),
  );
  if (staleReviewedSourceIdenticalTargets.length > 0) {
    if (process.env.I18N_REPORT_STALE_SOURCE_IDENTICAL === "1") {
      console.log("\nStale reviewed source-identical targets:");
      staleReviewedSourceIdenticalTargets.forEach((target) =>
        console.log(target),
      );
    }
    failures.push(
      `stale reviewed source-identical target(s): ${summarizeValues(
        staleReviewedSourceIdenticalTargets,
      )}`,
    );
  }
}

if (process.env.I18N_REPORT_SOURCE_GAPS === "1") {
  console.log(
    `\nSource strings missing in at least one locale (${missingSourceValues.size}):\n- ${[
      ...missingSourceValues,
    ]
      .sort((left, right) => left.localeCompare(right))
      .map(
        (value) =>
          `${value} <= ${[...(sourceFilesByValue.get(value) ?? [])].join(", ")}`,
      )
      .join("\n- ")}`,
  );
}

if (process.env.I18N_REPORT_SOURCE_FILES === "1") {
  console.log("\nMissing source strings grouped by file:");
  const byFile = new Map<string, string[]>();
  for (const value of missingSourceValues) {
    for (const file of sourceFilesByValue.get(value) ?? []) {
      const entries = byFile.get(file) ?? [];
      entries.push(value);
      byFile.set(file, entries);
    }
  }

  for (const [file, entries] of [...byFile].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    console.log(
      `\n${file} (${entries.length})\n- ${entries.sort((left, right) => left.localeCompare(right)).join("\n- ")}`,
    );
  }
}

if (process.env.I18N_REPORT_IMPORTS === "1") {
  console.log(
    `\nUnresolved customer-visible local imports (${unresolvedVisibleImports.size}):\n- ${[
      ...unresolvedVisibleImports,
    ]
      .sort((left, right) => left.localeCompare(right))
      .join("\n- ")}`,
  );
}

if (process.env.I18N_REPORT_DYNAMIC === "1") {
  console.log(
    `\nVisible dynamic expressions (${dynamicVisibleExpressions.length}):`,
  );
  for (const expression of dynamicVisibleExpressions) {
    const classification = dynamicExpressionAudit.classificationFor(expression);
    console.log(
      `${expression.file}:${expression.line} [${expression.kind}] ${expression.source} => ${
        classification ? `reviewed:${classification}` : "UNCLASSIFIED"
      }`,
    );
  }
}

if (failures.length > 0) {
  console.error("\nCustomer i18n coverage failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

if (fixtureAuditMode) {
  console.log(
    `Fixture i18n audit passed for ${locales.length} non-English locales across ${values.length} reviewed source strings.`,
  );
  console.log(
    `Fixture dynamic visible-expression guard passed for ${dynamicVisibleExpressions.length} occurrence(s); production stale-signature reconciliation was intentionally deferred to the full audit.`,
  );
} else {
  console.log(
    `Customer i18n coverage passed for ${locales.length} non-English locales across ${values.length} reviewed source strings.`,
  );
  console.log(
    `Dynamic visible-expression guard passed for ${dynamicVisibleExpressions.length} occurrence(s) across ${reviewedDynamicVisibleExpressions.length} reviewed signature(s).`,
  );
}
