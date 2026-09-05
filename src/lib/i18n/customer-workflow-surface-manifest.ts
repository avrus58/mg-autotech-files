import {
  customerWorkflowClientRouteManifest,
  customerWorkflowManagedRouteSegments,
  type CustomerWorkflowClientGroup,
  type CustomerWorkflowClientRouteConfig,
} from "@/lib/i18n/customer-workflow-client-route-manifest";

export type CustomerWorkflowTypedUiBoundary = {
  file: string;
  localizationImport: string;
  additionalLocalizationImports?: readonly string[];
  catalogDependencies?: readonly string[];
};

export type CustomerWorkflowClientSurfaceConfig =
  CustomerWorkflowClientRouteConfig & {
    sourceFiles: readonly string[];
    typedUiBoundaries: readonly CustomerWorkflowTypedUiBoundary[];
    runtimeCatalogs: readonly string[];
    sharedCatalogs: readonly string[];
    languageSwitcherCatalogs: readonly string[];
    generatesClientCatalog: boolean;
  };

export const customerWorkflowClientSurfaceManifest = {
  auth: {
    ...customerWorkflowClientRouteManifest.auth,
    sourceFiles: [
      "src/app/auth/layout.tsx",
      "src/app/auth/callback/page.tsx",
      "src/app/auth/complete-profile/page.tsx",
      "src/app/desktop-auth/turnstile/layout.tsx",
      "src/app/desktop-auth/turnstile/page.tsx",
      "src/app/forgot-password/layout.tsx",
      "src/app/forgot-password/page.tsx",
      "src/app/login/layout.tsx",
      "src/app/login/page.tsx",
      "src/app/measurement/complete/layout.tsx",
      "src/app/measurement/complete/page.tsx",
      "src/app/register/layout.tsx",
      "src/app/register/page.tsx",
      "src/app/reset-password/layout.tsx",
      "src/app/reset-password/page.tsx",
      "src/components/InternationalPhoneField.tsx",
      "src/components/auth/AuthBackdrop.tsx",
      "src/components/auth/GoogleIdentityButton.tsx",
      "src/components/auth/TurnstileChallenge.tsx",
      "src/lib/googleIdentity.ts",
      "src/lib/oauthRegistrationFinalizeErrors.ts",
      "src/lib/phoneCountries.ts",
    ],
    typedUiBoundaries: [
      {
        file: "src/lib/i18n/customer-auth-feedback.ts",
        localizationImport: "@/lib/i18n/customer-workflow-auth-translations",
      },
    ],
    runtimeCatalogs: [
      "customer-workflow-auth-translations",
      "customer-workflow-auth-dom-translations",
    ],
    sharedCatalogs: ["customer-runtime-translations"],
    languageSwitcherCatalogs: [
      "customer-workflow-auth-translations",
      "customer-workflow-auth-dom-translations",
    ],
    generatesClientCatalog: true,
  },
  overview: {
    ...customerWorkflowClientRouteManifest.overview,
    sourceFiles: [
      "src/app/dashboard/page.tsx",
      "src/components/dashboard/DashboardClient.tsx",
      "src/components/dashboard/index.tsx",
      "src/components/ui/efferd-dashboard-2.tsx",
    ],
    typedUiBoundaries: [],
    runtimeCatalogs: [
      "customer-workflow-overview-translations",
      "customer-workflow-overview-dom-translations",
    ],
    sharedCatalogs: [
      "customer-workflow-portal-common-translations",
      "customer-runtime-translations",
    ],
    languageSwitcherCatalogs: [
      "customer-workflow-overview-translations",
      "customer-workflow-overview-dom-translations",
      "customer-workflow-portal-common-translations",
    ],
    generatesClientCatalog: true,
  },
  request: {
    ...customerWorkflowClientRouteManifest.request,
    sourceFiles: [
      "src/app/new-request/layout.tsx",
      "src/app/new-request/NewRequestAccessBoundary.tsx",
      "src/app/new-request/page.tsx",
      "src/components/auth/NewRequestAccessFallback.tsx",
      "src/lib/requestFlow.ts",
      "src/lib/requestIntelligence.ts",
    ],
    typedUiBoundaries: [],
    runtimeCatalogs: [
      "customer-workflow-request-translations",
      "customer-workflow-request-dom-translations",
    ],
    sharedCatalogs: ["customer-workflow-portal-common-translations"],
    languageSwitcherCatalogs: [
      "customer-workflow-request-translations",
      "customer-workflow-request-dom-translations",
      "customer-workflow-portal-common-translations",
    ],
    generatesClientCatalog: true,
  },
  credits: {
    ...customerWorkflowClientRouteManifest.credits,
    sourceFiles: [
      "src/app/dashboard/credits/page.tsx",
      "src/app/dashboard/credits/history/page.tsx",
      "src/app/payment/layout.tsx",
      "src/app/payment/cancel/layout.tsx",
      "src/app/payment/cancel/page.tsx",
      "src/app/payment/success/layout.tsx",
      "src/app/payment/success/page.tsx",
      "src/lib/commercialPricing.ts",
      "src/lib/creditPurchaseErrorCodes.ts",
      "src/lib/creditPackages.ts",
    ],
    typedUiBoundaries: [],
    runtimeCatalogs: [
      "customer-workflow-credits-translations",
      "customer-workflow-credits-dom-translations",
      "commercial-translations",
    ],
    sharedCatalogs: [
      "customer-workflow-portal-common-translations",
      "customer-runtime-translations",
    ],
    languageSwitcherCatalogs: [
      "customer-workflow-credits-translations",
      "customer-workflow-credits-dom-translations",
      "customer-workflow-portal-common-translations",
    ],
    generatesClientCatalog: true,
  },
  "file-expert": {
    ...customerWorkflowClientRouteManifest["file-expert"],
    sourceFiles: [
      "src/app/dashboard/file-expert/page.tsx",
      "src/app/dashboard/file-expert/[id]/page.tsx",
      "src/lib/fileExpert/validation.ts",
    ],
    typedUiBoundaries: [],
    runtimeCatalogs: [
      "customer-workflow-file-expert-translations",
      "customer-workflow-file-expert-dom-translations",
      "file-expert-report-translations",
    ],
    sharedCatalogs: [
      "customer-workflow-portal-common-translations",
      "customer-runtime-translations",
    ],
    languageSwitcherCatalogs: [
      "customer-workflow-file-expert-translations",
      "customer-workflow-file-expert-dom-translations",
      "customer-workflow-portal-common-translations",
    ],
    generatesClientCatalog: true,
  },
  orders: {
    ...customerWorkflowClientRouteManifest.orders,
    sourceFiles: [
      "src/app/dashboard/orders/page.tsx",
      "src/lib/fileVersionLabels.ts",
      "src/app/dashboard/orders/[id]/page.tsx",
      "src/components/RequestChat.tsx",
    ],
    typedUiBoundaries: [],
    runtimeCatalogs: [
      "customer-workflow-orders-translations",
      "customer-workflow-orders-dom-translations",
      "dtc-analyzer-translations",
    ],
    sharedCatalogs: [
      "customer-workflow-portal-common-translations",
      "customer-runtime-translations",
    ],
    languageSwitcherCatalogs: [
      "customer-workflow-orders-translations",
      "customer-workflow-orders-dom-translations",
      "customer-workflow-portal-common-translations",
    ],
    generatesClientCatalog: true,
  },
  notifications: {
    ...customerWorkflowClientRouteManifest.notifications,
    sourceFiles: ["src/app/dashboard/notifications/page.tsx"],
    typedUiBoundaries: [],
    runtimeCatalogs: [
      "customer-workflow-notifications-translations",
      "customer-workflow-notifications-dom-translations",
    ],
    sharedCatalogs: ["customer-workflow-portal-common-translations"],
    languageSwitcherCatalogs: [
      "customer-workflow-notifications-translations",
      "customer-workflow-notifications-dom-translations",
      "customer-workflow-portal-common-translations",
    ],
    generatesClientCatalog: true,
  },
  portal: {
    ...customerWorkflowClientRouteManifest.portal,
    sourceFiles: [
      "src/app/dashboard/log-analysis/page.tsx",
      "src/components/dashboard/LogAnalysisStudioLoader.tsx",
      "src/lib/logAnalysisStudio.ts",
      "src/lib/performanceReport.ts",
    ],
    typedUiBoundaries: [
      {
        file: "src/components/dashboard/LogAnalysisStudio.tsx",
        localizationImport: "@/lib/i18n/log-analysis-studio-translations",
      },
    ],
    runtimeCatalogs: ["log-analysis-studio-translations"],
    sharedCatalogs: ["customer-workflow-portal-common-translations"],
    languageSwitcherCatalogs: ["customer-workflow-portal-common-translations"],
    generatesClientCatalog: false,
  },
  security: {
    ...customerWorkflowClientRouteManifest.security,
    sourceFiles: [
      "src/app/dashboard/settings/page.tsx",
      "src/components/account/TrustedDevicesCard.tsx",
    ],
    typedUiBoundaries: [],
    runtimeCatalogs: [
      "customer-workflow-security-translations",
      "customer-workflow-security-dom-translations",
    ],
    sharedCatalogs: ["customer-workflow-portal-common-translations"],
    languageSwitcherCatalogs: [
      "customer-workflow-security-translations",
      "customer-workflow-security-dom-translations",
      "customer-workflow-portal-common-translations",
    ],
    generatesClientCatalog: true,
  },
  widget: {
    ...customerWorkflowClientRouteManifest.widget,
    sourceFiles: [
      "src/app/dashboard/widget/page.tsx",
      "src/app/dashboard/widget/billing/page.tsx",
      "src/components/widget/VehicleLookupPreview.tsx",
      "src/lib/widget/types.ts",
    ],
    typedUiBoundaries: [
      {
        file: "src/components/dashboard/WidgetDashboardClient.tsx",
        localizationImport: "@/lib/i18n/widget-site-translations",
        catalogDependencies: ["widget-translations"],
      },
      {
        file: "src/components/widget/SubscriptionSummaryPanel.tsx",
        localizationImport: "@/lib/i18n/widget-site-translations",
      },
      {
        file: "src/components/widget/EmbedCodeBox.tsx",
        localizationImport: "@/lib/i18n/widget-site-translations",
      },
      {
        file: "src/components/widget/SubscriptionNotice.tsx",
        localizationImport: "@/lib/i18n/widget-site-translations",
      },
      {
        file: "src/components/widget/PublicVehicleSelector.tsx",
        localizationImport: "@/lib/i18n/widget-translations",
      },
    ],
    runtimeCatalogs: [
      "customer-workflow-widget-dom-translations",
      "widget-site-translations",
      "widget-translations",
    ],
    sharedCatalogs: ["customer-workflow-portal-common-translations"],
    languageSwitcherCatalogs: [
      "customer-workflow-widget-dom-translations",
      "customer-workflow-portal-common-translations",
      "widget-site-translations",
    ],
    generatesClientCatalog: true,
  },
} as const satisfies Record<
  CustomerWorkflowClientGroup,
  CustomerWorkflowClientSurfaceConfig
>;

export const customerWorkflowSharedSourceManifest = {
  "portal-common": {
    sourceFiles: [
      "src/app/dashboard/layout.tsx",
      "src/components/auth/AuthRequired.tsx",
      "src/components/auth/BrowserAuthBoundary.tsx",
      "src/components/auth/RegistrationCountryBoundary.tsx",
      "src/components/dashboard/CustomerPortalFrame.tsx",
      "src/components/dashboard/CustomerPortalPageHeader.tsx",
      "src/components/dashboard/CustomerPortalSidebar.tsx",
      "src/components/RequestLocaleBoundary.tsx",
      "src/components/ServerLocaleBoundary.tsx",
      "src/components/app-shell.tsx",
      "src/lib/i18n/customer-workflow-client-runtime.ts",
      "src/lib/seo.ts",
    ],
    typedUiBoundaries: [
      {
        file: "src/components/CountrySelect.tsx",
        localizationImport: "@/lib/i18n/customer-runtime-translations",
      },
      {
        file: "src/components/auth/DeviceVerificationPanel.tsx",
        localizationImport: "@/lib/i18n/customer-workflow-auth-translations",
      },
      {
        file: "src/components/CustomerNotifications.tsx",
        localizationImport:
          "@/lib/i18n/customer-workflow-notifications-translations",
      },
      {
        file: "src/lib/i18n/customer-portal-first-paint.ts",
        localizationImport:
          "@/lib/i18n/customer-workflow-portal-common-translations",
      },
    ],
    runtimeCatalogs: [
      "customer-workflow-portal-common-translations",
      "customer-runtime-translations",
    ],
    catalogDependencies: [
      "customer-workflow-auth-translations",
      "customer-workflow-notifications-translations",
    ],
  },
  "private-metadata": {
    sourceFiles: ["src/lib/privatePageMetadata.ts"],
    typedUiBoundaries: [
      {
        file: "src/lib/i18n/auth-page-first-paint.ts",
        localizationImport:
          "@/lib/i18n/customer-workflow-auth-dom-translations",
        additionalLocalizationImports: [
          "@/lib/i18n/customer-workflow-auth-translations",
        ],
      },
    ],
    runtimeCatalogs: ["customer-workflow-private-metadata-translations"],
    catalogDependencies: [
      "customer-workflow-auth-dom-translations",
      "customer-workflow-auth-translations",
      "customer-workflow-credits-translations",
      "customer-workflow-overview-translations",
      "customer-workflow-portal-common-translations",
      "customer-workflow-request-dom-translations",
      "log-analysis-studio-translations",
      "widget-site-translations",
    ],
    catalogDependenciesBySource: [
      {
        file: "src/lib/privatePageMetadata.ts",
        catalogs: [
          "customer-workflow-auth-translations",
          "customer-workflow-credits-translations",
          "customer-workflow-overview-translations",
          "customer-workflow-portal-common-translations",
          "customer-workflow-request-dom-translations",
          "log-analysis-studio-translations",
          "widget-site-translations",
        ],
      },
    ],
  },
} as const;

/**
 * Exact shared dependencies whose visible copy is already a locale-complete,
 * typed public data matrix rather than legacy observer input. `src/lib/seo.ts`
 * is still traversed by route/catalog closure; only its duplicate customer DOM
 * extraction is suppressed. This exact-file list never applies to siblings.
 */
export const customerWorkflowExternallyLocalizedSharedSources = [
  {
    file: "src/lib/seo.ts",
    localeMatrixBindings: [
      "homeSeo",
      "seoLabels",
      "serviceNames",
      "serviceTemplates",
      "localizedServiceOperations",
    ],
  },
] as const;

/**
 * Exact root conventions inherited by customer routes but localized and
 * audited by the site-wide/public surface gate rather than a compact customer
 * catalog. This is deliberately an exact-file boundary: a new root convention
 * is not inherited automatically and must be classified by review.
 */
export const customerWorkflowExternalConventionBoundaries = [
  "src/app/error.tsx",
  "src/app/global-error.tsx",
  "src/app/layout.tsx",
  "src/app/manifest.ts",
  "src/app/not-found.tsx",
  "src/app/opengraph-image.tsx",
] as const;

export const customerWorkflowManifestSourceFiles = [
  ...new Set([
    ...Object.values(customerWorkflowClientSurfaceManifest).flatMap(
      ({ sourceFiles, typedUiBoundaries }) => [
        ...sourceFiles,
        ...typedUiBoundaries.map(({ file }) => file),
      ],
    ),
    ...Object.values(customerWorkflowSharedSourceManifest).flatMap(
      ({ sourceFiles, typedUiBoundaries }) => [
        ...sourceFiles,
        ...typedUiBoundaries.map(({ file }) => file),
      ],
    ),
  ]),
] as readonly string[];

export function customerWorkflowAuditRoots(
  baseRoots: readonly string[],
  extraRoot?: string,
) {
  return [
    ...new Set([
      ...baseRoots,
      ...customerWorkflowManifestSourceFiles,
      ...(extraRoot ? [extraRoot] : []),
    ]),
  ];
}

export type { CustomerWorkflowClientGroup } from "@/lib/i18n/customer-workflow-client-route-manifest";

export type CustomerWorkflowGeneratedClientGroup = {
  [
    Group in CustomerWorkflowClientGroup
  ]: (typeof customerWorkflowClientSurfaceManifest)[Group]["generatesClientCatalog"] extends true
    ? Group
    : never;
}[CustomerWorkflowClientGroup];

export { customerWorkflowManagedRouteSegments };
