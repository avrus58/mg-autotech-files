import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import process from "node:process";
import ts from "typescript";
import {
  exactTranslations as baseExactTranslations,
  termTranslations as baseTermTranslations,
} from "../src/lib/i18n";
import {
  customerWorkflowExactTranslations as masterExactTranslations,
  customerWorkflowLocaleOrder,
  customerWorkflowTemplateRows as masterTemplateRows,
} from "../src/lib/i18n/customer-workflow-translations";
import {
  customerRuntimeLocaleOrder,
  customerRuntimeTranslations,
} from "../src/lib/i18n/customer-runtime-translations";
import {
  customerWorkflowClientSurfaceManifest,
  customerWorkflowExternallyLocalizedSharedSources,
  customerWorkflowExternalConventionBoundaries,
  customerWorkflowSharedSourceManifest,
  type CustomerWorkflowGeneratedClientGroup as GroupName,
} from "../src/lib/i18n/customer-workflow-surface-manifest";
import {
  customerWorkflowLegacyDomObserverCeiling,
  customerWorkflowLegacyDomObserverOccurrenceCeiling,
  customerWorkflowLegacyDomObserverReviewedTombstoneFloor,
  customerWorkflowLegacyDomObserverTombstones,
} from "../src/lib/i18n/customer-workflow-dom-observer-baseline";
import { logStudioT } from "../src/lib/i18n/log-analysis-studio-translations";
import { widgetSiteT } from "../src/lib/i18n/widget-site-translations";
import {
  auditCustomerWorkflowRouteClosure,
  customerWorkflowSourceImports,
  resolveCustomerWorkflowSourceImport,
} from "./lib/customer-workflow-route-closure";

type GeneratedGroupName = GroupName | "private-metadata";
type LegacyDomGroup = keyof typeof customerWorkflowLegacyDomObserverCeiling;

const reviewedLegacyDomBaselineDigests = {
  ceiling: "36d504fa1df5373a6c0671517050b36c951be9f1da4594583e56b728874fd8c2",
  occurrence:
    "17d67aedafc7f71ab7e8947aea3a84531b37fdf72ea879b932950310b188456d",
  tombstoneFloor:
    "79a8a068e1b8c1a09b80a76b27f99b3619c9165bf625948ef1729698a2bb54fd",
} as const;

type ManualExactSource = {
  source: string;
  provenanceFiles: readonly string[];
  runtimeBindings?: readonly string[];
  translations?: readonly string[];
  derivedBuilder?: {
    builderFile: string;
    builderFunction: string;
    targetField: "title" | "description";
    translationKey: string;
    translationModule: string;
    translatorExportName: string;
    translatorLocalName: string;
  };
};

type ManualTemplateKey = {
  key: string;
  provenanceFiles: readonly string[];
  runtimeBindings?: readonly string[];
  runtimeFunctions?: readonly string[];
};

type TypedTemplateDataParity = {
  dataFile: string;
  dataBinding: string;
  idField: string;
  sourceField: string;
  consumerFile: string;
  keyMapBinding: string;
};

type TypedExactFunctionParity = {
  providerFile: string;
  providerFunction: string;
  consumerFile: string;
  resultBinding: string;
  returnFields: readonly string[];
  collections?: readonly {
    returnField: string;
    providerBinding: string;
    consumerItemBinding: string;
    fields: readonly string[];
  }[];
};

type GroupConfig = {
  files: readonly string[];
  domFiles?: readonly string[];
  manualTemplateKeys?: readonly ManualTemplateKey[];
  manualExactSources?: readonly ManualExactSource[];
  typedTemplateDataParity?: readonly TypedTemplateDataParity[];
  typedExactFunctionParity?: readonly TypedExactFunctionParity[];
  includeMasterLiteralExact?: boolean;
  helper?: "password" | "notifications";
};

const authPasswordTemplateKeys = [
  "passwordMinimum",
  "passwordMaximum",
  "passwordNoSpaces",
  "passwordLowercase",
  "passwordUppercase",
  "passwordNumber",
  "passwordSymbol",
  "passwordPredictable",
] as const;

const notificationTemplateKeys = [
  "notificationTypeAdminMessage",
  "notificationTypeOrderStatus",
  "notificationTypeFileReady",
  "notificationTypeAdditionalUpload",
  "notificationTypeSystem",
  "statusNewRequest",
  "statusFileCheck",
  "statusCustomerInfoNeeded",
  "statusInProgress",
  "statusCompleted",
  "statusRevision",
  "statusCancelled",
  "notificationNewMessageTitle",
  "notificationFileReadyTitle",
  "notificationFileReadyBody",
  "notificationAdditionalUploadTitle",
  "notificationAdditionalUploadBody",
  "notificationOrderStatusTitle",
  "notificationNewStatus",
] as const;

const overviewTemplateKeys = [
  "creditsCountLower",
  "dashboardActiveRequests",
  "dashboardActiveRequestsMetric",
  "dashboardCompletedMetric",
  "dashboardCreditsAvailable",
  "dashboardNeedsResponse",
  "dashboardProfileDetails",
  "dashboardResponsesNeeded",
  "fallbackRequest",
  "fallbackVehicle",
  "notificationsWaiting",
  "openDeliveryAria",
  "respondToAria",
  "viewRequestAria",
] as const;

const requestTemplateKeys = [
  "accountStateActive",
  "accountStateBlocked",
  "accountStateDisabled",
  "accountStateRestricted",
  "accountStateSuspended",
  "accountStatusBlocked",
  "accountStatusDisabled",
  "allowedNegativeCredits",
  "creditsCount",
  "insufficientCredits",
  "insufficientCreditsWithLimit",
  "invalidServiceCombination",
  "selectedCount",
  "serviceNotSet",
  "serviceSelectionMatched",
  "serviceSelectionsMatched",
  "supportedCount",
  "vehicleNotSet",
] as const;

const creditsTemplateKeys = [
  "accountSpecificPricingActive",
  "bankInstructionsSent",
  "creditPackageDescription10",
  "creditPackageDescription100",
  "creditPackageDescription250",
  "creditPackageDescription50",
  "creditPackageDescription500",
  "payCustomVia",
  "payWith",
] as const;

const fileExpertTemplateKeys = [
  "fileExpertEmptyFile",
  "fileExpertFieldBrand",
  "fileExpertFieldEcu",
  "fileExpertFieldEngine",
  "fileExpertFieldModel",
  "fileExpertFieldNotes",
  "fileExpertFileTooLarge",
  "fileExpertRequirements",
  "fileExpertSelectFile",
  "fileExpertTextLimit",
  "fileExpertUnsupportedFile",
  "fileExpertUploadFile",
  "overLimit",
  "remaining",
] as const;

const ordersTemplateKeys = ["supportSummary", "vehicleNotSet"] as const;

function exactSourcesWithProvenance(
  sources: readonly string[],
  provenanceFiles: readonly string[],
  runtimeBindings: readonly string[] = [],
): ManualExactSource[] {
  return sources.map((source) => ({
    source,
    provenanceFiles,
    runtimeBindings,
  }));
}

function templateKeysWithProvenance(
  keys: readonly string[],
  provenanceFiles: readonly string[],
  runtimeBindings: readonly string[] = [],
  runtimeFunctions: readonly string[] = [],
): ManualTemplateKey[] {
  return keys.map((key) => ({
    key,
    provenanceFiles,
    runtimeBindings,
    runtimeFunctions,
  }));
}

function translatedExactSource(
  source: string,
  translate: (locale: (typeof customerWorkflowLocaleOrder)[number]) => string,
  derivedBuilder: NonNullable<ManualExactSource["derivedBuilder"]>,
): ManualExactSource {
  return {
    source,
    provenanceFiles: [derivedBuilder.builderFile],
    translations: customerWorkflowLocaleOrder.map(translate),
    derivedBuilder,
  };
}

function translatedCombinedExactSource(
  source: string,
  derivedBuilder: NonNullable<ManualExactSource["derivedBuilder"]>,
) {
  return translatedExactSource(
    source,
    (locale) => {
      const localeIndex = customerWorkflowLocaleOrder.indexOf(locale);
      return (
        masterExactTranslations[source]?.[localeIndex] ??
        baseExactTranslations[locale][source] ??
        baseTermTranslations[locale][source] ??
        source
      );
    },
    derivedBuilder,
  );
}

const dashboardMetadataSources = [
  {
    source: "Customer Dashboard",
    targetField: "title" as const,
  },
  {
    source:
      "Secure MG AutoTech customer dashboard for file requests, credits and deliveries.",
    targetField: "description" as const,
  },
].map(({ source, targetField }) =>
  translatedCombinedExactSource(source, {
    builderFile: "src/lib/privatePageMetadata.ts",
    builderFunction: "buildCustomerDashboardMetadata",
    targetField,
    translationKey: source,
    translationModule: "@/lib/i18n/customer-workflow-overview-translations",
    translatorExportName: "customerWorkflowExactT",
    translatorLocalName: "overviewExactT",
  }),
);

const ordersPrimaryExactSources = [
  "Connecting",
  "Customer",
  "Not available",
  "Order not found",
  "Reconnecting",
  "Secure and live",
  "This order could not be found or you do not have access.",
  "Unavailable",
  "You",
  "Today",
  "Yesterday",
  "Usually around 30 min",
  "Same day",
  "Manual review",
  "Estimate not set yet",
  "Order ID is missing.",
  "Order details could not be loaded.",
  "Completed file is not available yet.",
  "Secure download could not be prepared.",
  "Secure source download could not be prepared.",
  "Please describe what needs to be revised.",
  "Revision request could not be sent.",
  "Revision request sent. MG AutoTech will review your note.",
  "The additional file must be 32 MB or smaller.",
  "Additional file upload could not be prepared.",
  "Additional file upload could not be completed.",
  "Additional file uploaded. MG AutoTech can now review it inside this request.",
  "Support summary could not be copied. Please try again.",
  "Loading order details...",
  "Back to Dashboard",
] as const;

export const customerWorkflowClientGroups = {
  auth: {
    files: [
      ...customerWorkflowClientSurfaceManifest.auth.sourceFiles,
      "src/components/auth/DeviceVerificationPanel.tsx",
    ],
    domFiles: customerWorkflowClientSurfaceManifest.auth.sourceFiles,
    includeMasterLiteralExact: true,
    manualTemplateKeys: templateKeysWithProvenance(
      authPasswordTemplateKeys,
      ["src/lib/i18n/customer-workflow-client-runtime.ts"],
      ["keyBySource"],
      ["translateCustomerPasswordError"],
    ),
    helper: "password",
  },
  overview: {
    files: customerWorkflowClientSurfaceManifest.overview.sourceFiles,
    includeMasterLiteralExact: true,
    manualExactSources: dashboardMetadataSources,
    manualTemplateKeys: templateKeysWithProvenance(overviewTemplateKeys, [
      "src/components/dashboard/DashboardClient.tsx",
    ]),
  },
  request: {
    files: customerWorkflowClientSurfaceManifest.request.sourceFiles,
    includeMasterLiteralExact: true,
    manualTemplateKeys: templateKeysWithProvenance(
      requestTemplateKeys,
      ["src/app/new-request/page.tsx"],
      ["accountStateKeys", "creditAccessFailure"],
      ["accountStateTranslationKey", "validateCreditAccess"],
    ),
    typedExactFunctionParity: [
      {
        providerFile: "src/lib/requestIntelligence.ts",
        providerFunction: "evaluateRequestIntelligence",
        consumerFile: "src/app/new-request/page.tsx",
        resultBinding: "requestIntelligence",
        returnFields: ["label", "summary"],
        collections: [
          {
            returnField: "findings",
            providerBinding: "findings",
            consumerItemBinding: "finding",
            fields: ["label", "detail"],
          },
        ],
      },
    ],
  },
  credits: {
    files: customerWorkflowClientSurfaceManifest.credits.sourceFiles,
    includeMasterLiteralExact: true,
    manualExactSources: [
      translatedCombinedExactSource("Payment successful", {
        builderFile: "src/lib/privatePageMetadata.ts",
        builderFunction: "buildPaymentSuccessMetadata",
        targetField: "title",
        translationKey: "Payment successful",
        translationModule: "@/lib/i18n/customer-workflow-credits-translations",
        translatorExportName: "customerWorkflowExactT",
        translatorLocalName: "creditsExactT",
      }),
      ...exactSourcesWithProvenance(
        ["Confirming your payment..."],
        ["src/app/payment/success/page.tsx"],
        ["message"],
      ),
      ...exactSourcesWithProvenance(
        [
          "Confirming payment",
          "Payment needs review",
          "Added credits",
          "Buy More Credits",
          "Dashboard",
        ],
        ["src/app/payment/success/page.tsx", "src/app/payment/cancel/page.tsx"],
      ),
    ],
    manualTemplateKeys: templateKeysWithProvenance(
      creditsTemplateKeys,
      ["src/app/dashboard/credits/page.tsx"],
      ["creditPackageDescriptionKeys"],
    ),
    typedTemplateDataParity: [
      {
        dataFile: "src/lib/creditPackages.ts",
        dataBinding: "creditPackages",
        idField: "id",
        sourceField: "description",
        consumerFile: "src/app/dashboard/credits/page.tsx",
        keyMapBinding: "creditPackageDescriptionKeys",
      },
    ],
  },
  "file-expert": {
    files: customerWorkflowClientSurfaceManifest["file-expert"].sourceFiles,
    manualTemplateKeys: templateKeysWithProvenance(
      fileExpertTemplateKeys,
      [
        "src/app/dashboard/file-expert/page.tsx",
        "src/lib/fileExpert/validation.ts",
      ],
      [],
      ["localizeFileExpertValidation"],
    ),
  },
  orders: {
    files: customerWorkflowClientSurfaceManifest.orders.sourceFiles,
    // These state values are translated synchronously by the order runtime and
    // must not depend on the DOM observer. Exact-file provenance prevents a
    // deleted state from remaining pinned in the generated primary catalog.
    manualExactSources: exactSourcesWithProvenance(
      ordersPrimaryExactSources,
      customerWorkflowClientSurfaceManifest.orders.sourceFiles,
      ["deliveryEstimateLabels"],
    ),
    // The support summary is customer-visible clipboard output rather than DOM
    // copy. Keep its template rows only while the exact builder continues to
    // feed navigator.clipboard.writeText through the visible runtime flow.
    manualTemplateKeys: templateKeysWithProvenance(
      ordersTemplateKeys,
      ["src/app/dashboard/orders/[id]/page.tsx"],
      [],
      ["buildCustomerSupportSummary"],
    ),
  },
  notifications: {
    files: [
      ...customerWorkflowClientSurfaceManifest.notifications.sourceFiles,
      "src/components/CustomerNotifications.tsx",
    ],
    domFiles: customerWorkflowClientSurfaceManifest.notifications.sourceFiles,
    manualTemplateKeys: templateKeysWithProvenance(
      notificationTemplateKeys,
      ["src/lib/i18n/customer-workflow-client-runtime.ts"],
      [
        "notificationTypeKeys",
        "notificationStatusBodyKeys",
        "notificationStatusMetadataKeys",
      ],
      ["translateCustomerNotification"],
    ),
    helper: "notifications",
  },
  security: {
    files: customerWorkflowClientSurfaceManifest.security.sourceFiles,
    includeMasterLiteralExact: true,
  },
  widget: {
    files: customerWorkflowClientSurfaceManifest.widget.sourceFiles,
  },
} as const satisfies Record<GroupName, GroupConfig>;

export const customerWorkflowPortalCommonGeneratorFiles = [
  ...customerWorkflowSharedSourceManifest["portal-common"].sourceFiles,
  ...customerWorkflowSharedSourceManifest[
    "portal-common"
  ].typedUiBoundaries.map(({ file }) => file),
  ...Object.values(customerWorkflowClientSurfaceManifest).flatMap((surface) =>
    surface.generatesClientCatalog ? [] : [...surface.sourceFiles],
  ),
] as const;

const portalCommonConfig = {
  files: customerWorkflowPortalCommonGeneratorFiles,
} as const satisfies GroupConfig;

const privateMetadataConfig = {
  files: customerWorkflowSharedSourceManifest["private-metadata"].sourceFiles,
  manualExactSources: [
    ...dashboardMetadataSources,
    translatedExactSource(
      logStudioT("en", "studioTitle"),
      (locale) => logStudioT(locale, "studioTitle"),
      {
        builderFile: "src/lib/privatePageMetadata.ts",
        builderFunction: "buildLogAnalysisStudioMetadata",
        targetField: "title",
        translationKey: "studioTitle",
        translationModule: "@/lib/i18n/log-analysis-studio-translations",
        translatorExportName: "logStudioT",
        translatorLocalName: "logStudioT",
      },
    ),
    translatedExactSource(
      logStudioT("en", "studioMetaDescription"),
      (locale) => logStudioT(locale, "studioMetaDescription"),
      {
        builderFile: "src/lib/privatePageMetadata.ts",
        builderFunction: "buildLogAnalysisStudioMetadata",
        targetField: "description",
        translationKey: "studioMetaDescription",
        translationModule: "@/lib/i18n/log-analysis-studio-translations",
        translatorExportName: "logStudioT",
        translatorLocalName: "logStudioT",
      },
    ),
    translatedExactSource(
      widgetSiteT("en", "widgetDashboardMetaTitle"),
      (locale) => widgetSiteT(locale, "widgetDashboardMetaTitle"),
      {
        builderFile: "src/lib/privatePageMetadata.ts",
        builderFunction: "buildWidgetDashboardMetadata",
        targetField: "title",
        translationKey: "widgetDashboardMetaTitle",
        translationModule: "@/lib/i18n/widget-site-translations",
        translatorExportName: "widgetSiteT",
        translatorLocalName: "widgetSiteT",
      },
    ),
    translatedExactSource(
      widgetSiteT("en", "widgetDashboardMetaDescription"),
      (locale) => widgetSiteT(locale, "widgetDashboardMetaDescription"),
      {
        builderFile: "src/lib/privatePageMetadata.ts",
        builderFunction: "buildWidgetDashboardMetadata",
        targetField: "description",
        translationKey: "widgetDashboardMetaDescription",
        translationModule: "@/lib/i18n/widget-site-translations",
        translatorExportName: "widgetSiteT",
        translatorLocalName: "widgetSiteT",
      },
    ),
  ],
} as const satisfies GroupConfig;

const localeOrder = ["en", ...customerWorkflowLocaleOrder] as const;
const templateRowsByKey = new Map<string, (typeof masterTemplateRows)[number]>(
  masterTemplateRows.map((row) => [row[0], row] as const),
);

function normalizeVisibleText(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

function auditedScriptKind(file: string) {
  if (file.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (file.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (file.endsWith(".js")) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function parseAuditedSource(file: string, sourceText: string) {
  const source = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    auditedScriptKind(file),
  );
  const diagnostics =
    (source as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] })
      .parseDiagnostics ?? [];
  if (diagnostics.length) {
    throw new Error(
      `${file}: localization source could not be parsed:\n${diagnostics
        .map((diagnostic) =>
          ts.flattenDiagnosticMessageText(diagnostic.messageText, " "),
        )
        .join("\n")}`,
    );
  }
  return source;
}

function createLexicalImportIdentityGuard(source: ts.SourceFile) {
  const bindingNames = (name: ts.BindingName): string[] =>
    ts.isIdentifier(name)
      ? [name.text]
      : name.elements.flatMap((element) =>
          ts.isOmittedExpression(element) ? [] : bindingNames(element.name),
        );
  const bindingsByScope = new Map<ts.Node, Set<string>>();
  const remember = (scope: ts.Node, name: ts.BindingName) => {
    const bindings = bindingsByScope.get(scope) ?? new Set<string>();
    bindingNames(name).forEach((binding) => bindings.add(binding));
    bindingsByScope.set(scope, bindings);
  };
  const nearestScope = (node: ts.Node) => {
    let current: ts.Node | undefined = node.parent;
    while (current) {
      if (
        ts.isBlock(current) ||
        ts.isFunctionLike(current) ||
        ts.isSourceFile(current) ||
        ts.isCatchClause(current)
      ) {
        return current;
      }
      current = current.parent;
    }
    return source;
  };
  const index = (node: ts.Node) => {
    if (ts.isParameter(node) && ts.isFunctionLike(node.parent)) {
      remember(node.parent, node.name);
    } else if (ts.isVariableDeclaration(node)) {
      remember(nearestScope(node), node.name);
    } else if (
      (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) &&
      node.name
    ) {
      remember(nearestScope(node), node.name);
    } else if (
      (ts.isFunctionExpression(node) || ts.isClassExpression(node)) &&
      node.name
    ) {
      remember(node, node.name);
    } else if (ts.isCatchClause(node) && node.variableDeclaration) {
      remember(node, node.variableDeclaration.name);
    }
    ts.forEachChild(node, index);
  };
  index(source);

  return (identifier: ts.Identifier) => {
    let current: ts.Node | undefined = identifier.parent;
    while (current && !ts.isSourceFile(current)) {
      if (bindingsByScope.get(current)?.has(identifier.text)) return false;
      current = current.parent;
    }
    return !(bindingsByScope.get(source)?.has(identifier.text) ?? false);
  };
}

function collectSourceLiterals(files: readonly string[]) {
  const all = new Set<string>();
  const visible = new Set<string>();
  const directExact = new Set<string>();
  const directTemplateKeys = new Set<string>();
  const authDomTransportSources = new Set<string>();
  const portalCommonDomTransportSources = new Set<string>();
  const exactTransportSources = new Set<string>();
  const unapprovedExactTransportSources = new Set<string>();
  const rawVisibleOccurrenceCounts = new Map<string, number>();
  const runtimeBindingLiterals = new Map<string, Set<string>>();
  const runtimeFunctionLiterals = new Map<string, Set<string>>();
  const visibleLocalRuntimeFunctionCalls = new Set<string>();
  const visibleImportedRuntimeFunctionCalls = new Set<string>();
  const runtimeUsedBindings = new Set<string>();
  const remember = (target: Set<string>, value: string) => {
    const trimmed = value.trim();
    if (trimmed) target.add(trimmed);
    const normalized = normalizeVisibleText(value);
    if (normalized) target.add(normalized);
  };

  const visibleProperties = new Set([
    "alt",
    "aria-description",
    "aria-label",
    "badge",
    "description",
    "detail",
    "emptyText",
    "emptyTitle",
    "eyebrow",
    "formula",
    "label",
    "message",
    "name",
    "notice",
    "placeholder",
    "shortTitle",
    "statusText",
    "subtitle",
    "text",
    "title",
    "unknownLabel",
    "value",
  ]);

  const propertyName = (node: ts.PropertyName) =>
    ts.isIdentifier(node) || ts.isStringLiteral(node) ? node.text : "";

  const hasVisibleAncestor = (node: ts.Node) => {
    let child: ts.Node = node;
    let current: ts.Node | undefined = node.parent;
    while (current && !ts.isSourceFile(current)) {
      if (ts.isConditionalExpression(current) && child === current.condition) {
        return false;
      }
      if (ts.isBinaryExpression(current)) {
        const operator = current.operatorToken.kind;
        if (
          (operator === ts.SyntaxKind.AmpersandAmpersandToken &&
            child === current.left) ||
          (operator !== ts.SyntaxKind.AmpersandAmpersandToken &&
            operator !== ts.SyntaxKind.BarBarToken &&
            operator !== ts.SyntaxKind.QuestionQuestionToken &&
            operator !== ts.SyntaxKind.PlusToken)
        ) {
          return false;
        }
      }
      if (ts.isJsxExpression(current)) {
        if (
          ts.isJsxAttribute(current.parent) &&
          ts.isIdentifier(current.parent.name)
        ) {
          return visibleProperties.has(current.parent.name.text);
        }
        return true;
      }
      if (
        ts.isJsxAttribute(current) &&
        ts.isIdentifier(current.name) &&
        visibleProperties.has(current.name.text)
      ) {
        return true;
      }
      if (ts.isPropertyAssignment(current)) {
        return visibleProperties.has(propertyName(current.name));
      }
      if (ts.isCallExpression(current)) {
        const callee = current.expression;
        const name = ts.isIdentifier(callee)
          ? callee.text
          : ts.isPropertyAccessExpression(callee)
            ? callee.name.text
            : "";
        if (
          /^set(?:[A-Z][A-Za-z0-9]*)?(?:Error|Feedback|Message|Notice|Status|Success)$/u.test(
            name,
          )
        ) {
          return true;
        }
        return false;
      }
      if (ts.isFunctionLike(current)) return false;
      child = current;
      current = current.parent;
    }
    return false;
  };

  for (const file of files) {
    const sourceText = readFileSync(resolve(process.cwd(), file), "utf8");
    const source = parseAuditedSource(file, sourceText);
    const bindingNames = (name: ts.BindingName): string[] =>
      ts.isIdentifier(name)
        ? [name.text]
        : name.elements.flatMap((element) =>
            ts.isOmittedExpression(element) ? [] : bindingNames(element.name),
          );
    const bindingNamesForNode = (node: ts.Node) => {
      let current: ts.Node | undefined = node;
      while (current && !ts.isSourceFile(current)) {
        if (ts.isVariableDeclaration(current) && current.initializer) {
          return bindingNames(current.name);
        }
        current = current.parent;
      }
      return [];
    };
    const functionNameForNode = (node: ts.Node) => {
      let current: ts.Node | undefined = node;
      while (current && !ts.isSourceFile(current)) {
        if (ts.isFunctionLike(current)) {
          return ts.isFunctionDeclaration(current) && current.name
            ? current.name.text
            : null;
        }
        current = current.parent;
      }
      return null;
    };
    const callName = (expression: ts.LeftHandSideExpression) =>
      ts.isIdentifier(expression)
        ? expression.text
        : ts.isPropertyAccessExpression(expression)
          ? expression.name.text
          : "";
    const literalValue = (node: ts.Node | undefined) =>
      node &&
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
        ? node.text
        : null;
    const rememberLiteralDescendants = (target: Set<string>, node: ts.Node) => {
      const value = literalValue(node);
      if (value !== null) remember(target, value);
      ts.forEachChild(node, (child) =>
        rememberLiteralDescendants(target, child),
      );
    };
    const rememberIdentifierDescendants = (node: ts.Node) => {
      if (ts.isIdentifier(node)) runtimeUsedBindings.add(node.text);
      ts.forEachChild(node, rememberIdentifierDescendants);
    };
    const stateBindingBySetter = new Map<string, string>();
    const runtimeFlowSourcesByTarget = new Map<string, Set<string>>();
    const runtimeValueLiteralsByTarget = new Map<string, Set<string>>();
    const runtimePropertyLiteralsByTarget = new Map<
      string,
      Map<string, Set<string>>
    >();
    const runtimePropertyFlowsByTarget = new Map<
      string,
      Map<string, Set<string>>
    >();
    const collectionSourceByItem = new Map<string, string>();
    const runtimeExactUsedBindings = new Set<string>();
    const runtimeExactUsedProperties = new Map<string, Set<string>>();
    const rawVisibleSinkExpressions: Array<{
      expression: ts.Expression;
      directDom: boolean;
    }> = [];
    const rawVisibleJsxTextNodes: ts.JsxText[] = [];
    const exactTranslatorCalls: ts.CallExpression[] = [];
    const templateTranslatorCalls: ts.CallExpression[] = [];
    type DomTransportProvider = "auth-dom" | "portal-common";
    type DomTransportCall = {
      call: ts.CallExpression;
      parameterIndex: number;
      provider: DomTransportProvider;
    };
    const domTransportCalls: DomTransportCall[] = [];
    const runtimeTransportCalls: ts.CallExpression[] = [];
    const authFeedbackCalls: ts.CallExpression[] = [];
    const exactWrapperParameterIndexes = new Map<string, number>();
    const ambiguousExactWrapperNames = new Set<string>();
    const domWrapperParameterIndexes = new Map<
      string,
      { parameterIndex: number; provider: DomTransportProvider }
    >();
    const ambiguousDomWrapperNames = new Set<string>();
    const exactTranslatorIdentifiers = new Set<string>();
    const templateTranslatorIdentifiers = new Set<string>();
    const domTranslatorIdentifiers = new Map<
      string,
      { parameterIndex: number; provider: DomTransportProvider }
    >();
    const namedImportOrigins = new Map<
      string,
      { importedName: string; moduleSpecifier: string }
    >();
    for (const statement of source.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier) ||
        !statement.importClause?.namedBindings ||
        !ts.isNamedImports(statement.importClause.namedBindings)
      ) {
        continue;
      }
      for (const imported of statement.importClause.namedBindings.elements) {
        const importedName = (imported.propertyName ?? imported.name).text;
        namedImportOrigins.set(imported.name.text, {
          importedName,
          moduleSpecifier: statement.moduleSpecifier.text,
        });
        if (
          statement.moduleSpecifier.text ===
            "@/lib/i18n/auth-page-first-paint" &&
          importedName === "authPageFirstPaintT"
        ) {
          domTranslatorIdentifiers.set(imported.name.text, {
            parameterIndex: 1,
            provider: "auth-dom",
          });
        } else if (
          statement.moduleSpecifier.text ===
            "@/lib/i18n/customer-portal-first-paint" &&
          importedName === "customerPortalFirstPaintT"
        ) {
          domTranslatorIdentifiers.set(imported.name.text, {
            parameterIndex: 1,
            provider: "portal-common",
          });
        }
        if (
          !/customer-workflow-.+-translations$/u.test(
            statement.moduleSpecifier.text,
          )
        ) {
          continue;
        }
        if (importedName === "customerWorkflowExactT") {
          exactTranslatorIdentifiers.add(imported.name.text);
        } else if (importedName === "customerWorkflowT") {
          templateTranslatorIdentifiers.add(imported.name.text);
        }
      }
    }

    const lexicalBindingsByScope = new Map<ts.Node, Set<string>>();
    const rememberLexicalBinding = (scope: ts.Node, name: ts.BindingName) => {
      const bindings = lexicalBindingsByScope.get(scope) ?? new Set<string>();
      bindingNames(name).forEach((binding) => bindings.add(binding));
      lexicalBindingsByScope.set(scope, bindings);
    };
    const nearestLexicalScope = (node: ts.Node) => {
      let current: ts.Node | undefined = node.parent;
      while (current) {
        if (
          ts.isBlock(current) ||
          ts.isFunctionLike(current) ||
          ts.isSourceFile(current) ||
          ts.isCatchClause(current)
        ) {
          return current;
        }
        current = current.parent;
      }
      return source;
    };
    const indexLexicalBindings = (node: ts.Node) => {
      if (ts.isParameter(node)) {
        const fn = node.parent;
        if (ts.isFunctionLike(fn)) rememberLexicalBinding(fn, node.name);
      } else if (ts.isVariableDeclaration(node)) {
        rememberLexicalBinding(nearestLexicalScope(node), node.name);
      } else if (
        (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) &&
        node.name
      ) {
        rememberLexicalBinding(nearestLexicalScope(node), node.name);
      } else if (ts.isCatchClause(node) && node.variableDeclaration) {
        rememberLexicalBinding(node, node.variableDeclaration.name);
      }
      ts.forEachChild(node, indexLexicalBindings);
    };
    indexLexicalBindings(source);
    const identifierIsLexicallyShadowed = (identifier: ts.Identifier) => {
      let current: ts.Node | undefined = identifier.parent;
      while (current && !ts.isSourceFile(current)) {
        if (lexicalBindingsByScope.get(current)?.has(identifier.text)) {
          return true;
        }
        current = current.parent;
      }
      return lexicalBindingsByScope.get(source)?.has(identifier.text) ?? false;
    };
    const isAuthenticImportedCall = (
      call: ts.CallExpression,
      imports: ReadonlySet<string>,
    ) =>
      ts.isIdentifier(call.expression) &&
      imports.has(call.expression.text) &&
      !identifierIsLexicallyShadowed(call.expression);

    const wrapperExpression = (body: ts.ConciseBody) => {
      if (!ts.isBlock(body)) return body;
      const returns = body.statements.filter(ts.isReturnStatement);
      return returns.length === 1 && returns[0].expression
        ? returns[0].expression
        : null;
    };
    const rememberExactWrapper = (
      name: string,
      parameters: readonly ts.ParameterDeclaration[],
      body: ts.ConciseBody,
    ) => {
      const expression = wrapperExpression(body);
      if (!expression) return;
      const candidate = expression;
      if (
        !ts.isCallExpression(candidate) ||
        !isAuthenticImportedCall(candidate, exactTranslatorIdentifiers) ||
        !candidate.arguments[1] ||
        !ts.isIdentifier(candidate.arguments[1])
      ) {
        return;
      }
      const wrapperSourceParameter = candidate.arguments[1];
      const parameterIndex = parameters.findIndex(
        (parameter) =>
          ts.isIdentifier(parameter.name) &&
          parameter.name.text === wrapperSourceParameter.text,
      );
      if (parameterIndex >= 0) {
        if (
          ambiguousExactWrapperNames.has(name) ||
          exactWrapperParameterIndexes.has(name)
        ) {
          exactWrapperParameterIndexes.delete(name);
          ambiguousExactWrapperNames.add(name);
          return;
        }
        exactWrapperParameterIndexes.set(name, parameterIndex);
      }
    };
    const rememberDomWrapper = (
      name: string,
      parameters: readonly ts.ParameterDeclaration[],
      body: ts.ConciseBody,
    ) => {
      const expression = wrapperExpression(body);
      if (!expression || !ts.isCallExpression(expression)) {
        return;
      }
      if (
        !ts.isIdentifier(expression.expression) ||
        identifierIsLexicallyShadowed(expression.expression)
      )
        return;
      const provider = domTranslatorIdentifiers.get(expression.expression.text);
      if (!provider) return;
      const sourceArgument = expression.arguments[provider.parameterIndex];
      if (!sourceArgument || !ts.isIdentifier(sourceArgument)) return;
      const parameterIndex = parameters.findIndex(
        (parameter) =>
          ts.isIdentifier(parameter.name) &&
          parameter.name.text === sourceArgument.text,
      );
      if (parameterIndex < 0) return;
      if (
        ambiguousDomWrapperNames.has(name) ||
        domWrapperParameterIndexes.has(name)
      ) {
        domWrapperParameterIndexes.delete(name);
        ambiguousDomWrapperNames.add(name);
        return;
      }
      domWrapperParameterIndexes.set(name, {
        parameterIndex,
        provider: provider.provider,
      });
    };
    const indexExactWrappers = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) && node.name && node.body) {
        rememberExactWrapper(node.name.text, node.parameters, node.body);
        rememberDomWrapper(node.name.text, node.parameters, node.body);
      }
      if (ts.isVariableDeclaration(node)) {
        const declaration = node;
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.initializer &&
          (ts.isArrowFunction(declaration.initializer) ||
            ts.isFunctionExpression(declaration.initializer))
        ) {
          rememberExactWrapper(
            declaration.name.text,
            declaration.initializer.parameters,
            declaration.initializer.body,
          );
          rememberDomWrapper(
            declaration.name.text,
            declaration.initializer.parameters,
            declaration.initializer.body,
          );
        }
      }
      ts.forEachChild(node, indexExactWrappers);
    };
    indexExactWrappers(source);

    const rememberPossibleValueLiterals = (
      target: Set<string>,
      node: ts.Node,
    ) => {
      if (
        ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node)
      ) {
        remember(target, node.text);
        return;
      }
      if (ts.isConditionalExpression(node)) {
        rememberPossibleValueLiterals(target, node.whenTrue);
        rememberPossibleValueLiterals(target, node.whenFalse);
        return;
      }
      if (ts.isBinaryExpression(node)) {
        if (node.operatorToken.kind === ts.SyntaxKind.CommaToken) {
          rememberPossibleValueLiterals(target, node.right);
        } else if (
          node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
          node.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
          node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
        ) {
          rememberPossibleValueLiterals(target, node.left);
          rememberPossibleValueLiterals(target, node.right);
        }
        return;
      }
      if (
        ts.isParenthesizedExpression(node) ||
        ts.isAsExpression(node) ||
        ts.isTypeAssertionExpression(node) ||
        ts.isNonNullExpression(node) ||
        ts.isSatisfiesExpression(node)
      ) {
        rememberPossibleValueLiterals(target, node.expression);
      }
    };

    const rememberPropertyLiterals = (target: string, node: ts.Node) => {
      let candidate = node;
      while (
        ts.isParenthesizedExpression(candidate) ||
        ts.isAsExpression(candidate) ||
        ts.isTypeAssertionExpression(candidate) ||
        ts.isNonNullExpression(candidate) ||
        ts.isSatisfiesExpression(candidate)
      ) {
        candidate = candidate.expression;
      }
      const objects = ts.isArrayLiteralExpression(candidate)
        ? candidate.elements
        : [candidate];
      for (const element of objects) {
        let objectCandidate: ts.Node = element;
        while (
          ts.isParenthesizedExpression(objectCandidate) ||
          ts.isAsExpression(objectCandidate) ||
          ts.isTypeAssertionExpression(objectCandidate) ||
          ts.isNonNullExpression(objectCandidate) ||
          ts.isSatisfiesExpression(objectCandidate)
        ) {
          objectCandidate = objectCandidate.expression;
        }
        if (!ts.isObjectLiteralExpression(objectCandidate)) continue;
        const properties =
          runtimePropertyLiteralsByTarget.get(target) ??
          new Map<string, Set<string>>();
        for (const property of objectCandidate.properties) {
          if (!ts.isPropertyAssignment(property)) continue;
          const name = propertyName(property.name);
          if (!name) continue;
          const values = properties.get(name) ?? new Set<string>();
          rememberPossibleValueLiterals(values, property.initializer);
          if (values.size) properties.set(name, values);
        }
        runtimePropertyLiteralsByTarget.set(target, properties);
      }
    };

    const rememberFlowSources = (target: string, node: ts.Expression) => {
      const sources =
        runtimeFlowSourcesByTarget.get(target) ?? new Set<string>();
      const visitSource = (candidateNode: ts.Expression) => {
        let candidate = candidateNode;
        while (
          ts.isParenthesizedExpression(candidate) ||
          ts.isAsExpression(candidate) ||
          ts.isTypeAssertionExpression(candidate) ||
          ts.isNonNullExpression(candidate) ||
          ts.isSatisfiesExpression(candidate)
        ) {
          candidate = candidate.expression;
        }
        if (ts.isIdentifier(candidate)) {
          sources.add(candidate.text);
          return;
        }
        if (ts.isCallExpression(candidate)) {
          const called = callName(candidate.expression);
          if (called) sources.add(called);
          return;
        }
        if (ts.isConditionalExpression(candidate)) {
          visitSource(candidate.whenTrue);
          visitSource(candidate.whenFalse);
          return;
        }
        if (ts.isBinaryExpression(candidate)) {
          if (candidate.operatorToken.kind === ts.SyntaxKind.CommaToken) {
            visitSource(candidate.right);
          } else if (
            candidate.operatorToken.kind ===
              ts.SyntaxKind.QuestionQuestionToken ||
            candidate.operatorToken.kind === ts.SyntaxKind.BarBarToken
          ) {
            visitSource(candidate.left);
            visitSource(candidate.right);
          } else if (
            candidate.operatorToken.kind ===
            ts.SyntaxKind.AmpersandAmpersandToken
          ) {
            visitSource(candidate.right);
          }
          return;
        }
        if (ts.isTemplateExpression(candidate)) {
          candidate.templateSpans.forEach((span) =>
            visitSource(span.expression),
          );
          return;
        }
        if (
          ts.isAwaitExpression(candidate) ||
          ts.isYieldExpression(candidate) ||
          ts.isSpreadElement(candidate)
        ) {
          if (candidate.expression) visitSource(candidate.expression);
          return;
        }
        if (
          ts.isPropertyAccessExpression(candidate) ||
          ts.isElementAccessExpression(candidate)
        ) {
          let owner: ts.Expression = candidate.expression;
          while (
            ts.isParenthesizedExpression(owner) ||
            ts.isAsExpression(owner) ||
            ts.isTypeAssertionExpression(owner) ||
            ts.isNonNullExpression(owner) ||
            ts.isSatisfiesExpression(owner)
          ) {
            owner = owner.expression;
          }
          const field = ts.isPropertyAccessExpression(candidate)
            ? candidate.name.text
            : candidate.argumentExpression &&
                (ts.isStringLiteral(candidate.argumentExpression) ||
                  ts.isNoSubstitutionTemplateLiteral(
                    candidate.argumentExpression,
                  ))
              ? candidate.argumentExpression.text
              : null;
          if (ts.isIdentifier(owner) && field) {
            const propertyFlows =
              runtimePropertyFlowsByTarget.get(target) ??
              new Map<string, Set<string>>();
            const fields = propertyFlows.get(owner.text) ?? new Set<string>();
            fields.add(field);
            propertyFlows.set(owner.text, fields);
            runtimePropertyFlowsByTarget.set(target, propertyFlows);
          }
          visitSource(candidate.expression);
          return;
        }
        if (ts.isObjectLiteralExpression(candidate)) {
          for (const property of candidate.properties) {
            if (ts.isPropertyAssignment(property)) {
              visitSource(property.initializer);
            } else if (ts.isShorthandPropertyAssignment(property)) {
              visitSource(property.name);
            } else if (ts.isSpreadAssignment(property)) {
              visitSource(property.expression);
            }
          }
          return;
        }
        if (ts.isArrayLiteralExpression(candidate)) {
          candidate.elements.forEach(visitSource);
          return;
        }
      };
      visitSource(node);
      runtimeFlowSourcesByTarget.set(target, sources);
      const values =
        runtimeValueLiteralsByTarget.get(target) ?? new Set<string>();
      rememberPossibleValueLiterals(values, node);
      if (values.size) runtimeValueLiteralsByTarget.set(target, values);
      rememberPropertyLiterals(target, node);
    };

    const rememberStateHook = (node: ts.Node) => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isArrayBindingPattern(node.name) &&
        node.name.elements.length >= 2 &&
        node.initializer &&
        ts.isCallExpression(node.initializer) &&
        callName(node.initializer.expression) === "useState"
      ) {
        const stateElement = node.name.elements[0];
        const setterElement = node.name.elements[1];
        if (
          stateElement &&
          setterElement &&
          !ts.isOmittedExpression(stateElement) &&
          !ts.isOmittedExpression(setterElement) &&
          ts.isIdentifier(stateElement.name) &&
          ts.isIdentifier(setterElement.name)
        ) {
          stateBindingBySetter.set(
            setterElement.name.text,
            stateElement.name.text,
          );
        }
      }
      ts.forEachChild(node, rememberStateHook);
    };
    rememberStateHook(source);

    const directFunctionReturnExpressions = (
      fn: ts.ArrowFunction | ts.FunctionExpression,
    ) => {
      if (!ts.isBlock(fn.body)) return [fn.body];
      const returns: ts.Expression[] = [];
      const collect = (node: ts.Node) => {
        if (node !== fn.body && ts.isFunctionLike(node)) return;
        if (ts.isReturnStatement(node) && node.expression) {
          returns.push(node.expression);
          return;
        }
        ts.forEachChild(node, collect);
      };
      collect(fn.body);
      return returns;
    };

    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && node.arguments.length) {
        const name = callName(node.expression);
        if (
          ts.isPropertyAccessExpression(node.expression) &&
          (node.expression.name.text === "map" ||
            node.expression.name.text === "flatMap") &&
          ts.isIdentifier(node.expression.expression) &&
          node.arguments[0] &&
          (ts.isArrowFunction(node.arguments[0]) ||
            ts.isFunctionExpression(node.arguments[0])) &&
          node.arguments[0].parameters[0] &&
          ts.isIdentifier(node.arguments[0].parameters[0].name)
        ) {
          const itemBinding = node.arguments[0].parameters[0].name.text;
          collectionSourceByItem.set(
            itemBinding,
            node.expression.expression.text,
          );
          const sources =
            runtimeFlowSourcesByTarget.get(itemBinding) ?? new Set<string>();
          sources.add(node.expression.expression.text);
          runtimeFlowSourcesByTarget.set(itemBinding, sources);
        }
        const stateBinding = stateBindingBySetter.get(name);
        if (stateBinding) {
          rememberFlowSources(stateBinding, node.arguments[0]);
        }
        // Record only the exact imported translator identifiers here. Whether
        // a call can pin a compact row is decided later from visible runtime
        // flow; a dead helper or a look-alike object method is not provenance.
        if (ts.isIdentifier(node.expression)) {
          if (isAuthenticImportedCall(node, exactTranslatorIdentifiers)) {
            exactTranslatorCalls.push(node);
          } else if (
            isAuthenticImportedCall(node, templateTranslatorIdentifiers)
          ) {
            templateTranslatorCalls.push(node);
          } else if (exactWrapperParameterIndexes.has(name)) {
            runtimeTransportCalls.push(node);
          } else if (domTranslatorIdentifiers.has(name)) {
            const provider = domTranslatorIdentifiers.get(name)!;
            domTransportCalls.push({
              call: node,
              parameterIndex: provider.parameterIndex,
              provider: provider.provider,
            });
          } else if (domWrapperParameterIndexes.has(name)) {
            const provider = domWrapperParameterIndexes.get(name)!;
            domTransportCalls.push({
              call: node,
              parameterIndex: provider.parameterIndex,
              provider: provider.provider,
            });
          } else if (name === "customerAuthFeedbackT") {
            authFeedbackCalls.push(node);
          }
        }
      }
      if (ts.isVariableDeclaration(node) && node.initializer) {
        for (const bindingName of bindingNames(node.name)) {
          rememberFlowSources(bindingName, node.initializer);
          if (
            ts.isIdentifier(node.name) &&
            (ts.isArrowFunction(node.initializer) ||
              ts.isFunctionExpression(node.initializer))
          ) {
            for (const returned of directFunctionReturnExpressions(
              node.initializer,
            )) {
              rememberFlowSources(bindingName, returned);
            }
          }
        }
      }
      if (ts.isReturnStatement(node) && node.expression) {
        const functionName = functionNameForNode(node);
        if (functionName) rememberFlowSources(functionName, node.expression);
      }
      if (
        ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node)
      ) {
        remember(all, node.text);
        if (hasVisibleAncestor(node)) remember(visible, node.text);
        const bindingNames = bindingNamesForNode(node);
        for (const bindingName of bindingNames) {
          const values =
            runtimeBindingLiterals.get(bindingName) ?? new Set<string>();
          remember(values, node.text);
          runtimeBindingLiterals.set(bindingName, values);
        }
      }
      if (ts.isJsxText(node)) {
        remember(all, node.text);
        remember(visible, node.text);
      }
      if (ts.isTemplateExpression(node)) {
        remember(all, node.head.text);
        node.templateSpans.forEach((span) => remember(all, span.literal.text));
        if (hasVisibleAncestor(node)) {
          remember(visible, node.head.text);
          node.templateSpans.forEach((span) =>
            remember(visible, span.literal.text),
          );
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);

    // A configured runtime helper may pin a template key only when that exact
    // key reaches a locale-aware translator whose result contributes to a
    // visible top-level return value. Merely placing a literal next to an
    // unrelated translator (or inside an uncalled nested function) is not
    // runtime provenance.
    const transparentExpression = (
      expression: ts.Expression,
    ): ts.Expression => {
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
      return current;
    };
    const rawVisibleBindings = new Set<string>();
    const rawVisibleProperties = new Map<string, Set<string>>();
    const isInsideRawValueBoundary = (node: ts.Node) => {
      let current: ts.Node | undefined = node.parent;
      while (current && !ts.isSourceFile(current)) {
        if (ts.isJsxElement(current) || ts.isJsxSelfClosingElement(current)) {
          const opening = ts.isJsxElement(current)
            ? current.openingElement
            : current;
          for (const attribute of opening.attributes.properties) {
            if (!ts.isJsxAttribute(attribute)) continue;
            const name = ts.isIdentifier(attribute.name)
              ? attribute.name.text
              : attribute.name.getText(source);
            if (name === "data-no-translate") return true;
            if (
              name === "translate" &&
              attribute.initializer &&
              ts.isStringLiteral(attribute.initializer) &&
              attribute.initializer.text === "no"
            ) {
              return true;
            }
          }
        }
        current = current.parent;
      }
      return false;
    };
    const rememberRawVisibleExpression = (expression: ts.Expression) => {
      const candidate = transparentExpression(expression);
      if (ts.isIdentifier(candidate)) {
        rawVisibleBindings.add(candidate.text);
        return;
      }
      if (
        ts.isCallExpression(candidate) &&
        ts.isIdentifier(candidate.expression) &&
        (runtimeFlowSourcesByTarget.has(candidate.expression.text) ||
          runtimeValueLiteralsByTarget.has(candidate.expression.text))
      ) {
        rawVisibleBindings.add(candidate.expression.text);
        return;
      }
      if (
        ts.isPropertyAccessExpression(candidate) ||
        (ts.isElementAccessExpression(candidate) &&
          candidate.argumentExpression &&
          (ts.isStringLiteral(candidate.argumentExpression) ||
            ts.isNoSubstitutionTemplateLiteral(candidate.argumentExpression)))
      ) {
        const owner = transparentExpression(candidate.expression);
        if (!ts.isIdentifier(owner)) return;
        const sourceBinding =
          collectionSourceByItem.get(owner.text) ?? owner.text;
        const field = ts.isPropertyAccessExpression(candidate)
          ? candidate.name.text
          : (candidate.argumentExpression as ts.StringLiteralLike).text;
        const fields = rawVisibleProperties.get(sourceBinding) ?? new Set();
        fields.add(field);
        rawVisibleProperties.set(sourceBinding, fields);
        return;
      }
      if (ts.isConditionalExpression(candidate)) {
        rememberRawVisibleExpression(candidate.whenTrue);
        rememberRawVisibleExpression(candidate.whenFalse);
        return;
      }
      if (ts.isBinaryExpression(candidate)) {
        if (candidate.operatorToken.kind === ts.SyntaxKind.CommaToken) {
          rememberRawVisibleExpression(candidate.right);
        } else if (
          candidate.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
        ) {
          // The left operand is a condition, not rendered customer copy.
          rememberRawVisibleExpression(candidate.right);
        } else if (
          candidate.operatorToken.kind ===
            ts.SyntaxKind.QuestionQuestionToken ||
          candidate.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
          candidate.operatorToken.kind === ts.SyntaxKind.PlusToken
        ) {
          rememberRawVisibleExpression(candidate.left);
          rememberRawVisibleExpression(candidate.right);
        }
        return;
      }
      if (ts.isTemplateExpression(candidate)) {
        candidate.templateSpans.forEach((span) =>
          rememberRawVisibleExpression(span.expression),
        );
      }
      // A call is not treated as raw merely because its result is visible.
      // Exact/template providers have their own provenance proof; arbitrary
      // helper arguments cannot make unrelated literals look customer-facing.
    };
    const collectRawVisibleSinks = (node: ts.Node) => {
      if (ts.isJsxText(node)) {
        if (normalizeVisibleText(node.text)) rawVisibleJsxTextNodes.push(node);
        return;
      }
      if (ts.isJsxExpression(node) && node.expression) {
        const attribute = ts.isJsxAttribute(node.parent) ? node.parent : null;
        const visibleAttribute =
          attribute &&
          ts.isIdentifier(attribute.name) &&
          visibleProperties.has(attribute.name.text);
        if (
          (!attribute || visibleAttribute) &&
          !isInsideRawValueBoundary(node)
        ) {
          rawVisibleSinkExpressions.push({
            expression: node.expression,
            directDom: true,
          });
          rememberRawVisibleExpression(node.expression);
        }
        if (attribute) return;
        ts.forEachChild(node, collectRawVisibleSinks);
        return;
      }
      if (
        ts.isJsxAttribute(node) &&
        ts.isIdentifier(node.name) &&
        visibleProperties.has(node.name.text) &&
        node.initializer &&
        ts.isJsxExpression(node.initializer) &&
        node.initializer.expression
      ) {
        rawVisibleSinkExpressions.push({
          expression: node.initializer.expression,
          directDom: true,
        });
        rememberRawVisibleExpression(node.initializer.expression);
        return;
      }
      if (
        ts.isPropertyAssignment(node) &&
        visibleProperties.has(propertyName(node.name))
      ) {
        rawVisibleSinkExpressions.push({
          expression: node.initializer,
          directDom: false,
        });
        rememberRawVisibleExpression(node.initializer);
        return;
      }
      ts.forEachChild(node, collectRawVisibleSinks);
    };
    collectRawVisibleSinks(source);
    let propagatedRawVisibleBinding = true;
    while (propagatedRawVisibleBinding) {
      propagatedRawVisibleBinding = false;
      for (const [
        targetBinding,
        sourceBindings,
      ] of runtimeFlowSourcesByTarget) {
        if (!rawVisibleBindings.has(targetBinding)) continue;
        for (const sourceBinding of sourceBindings) {
          if (rawVisibleBindings.has(sourceBinding)) continue;
          rawVisibleBindings.add(sourceBinding);
          propagatedRawVisibleBinding = true;
        }
      }
    }
    for (const binding of rawVisibleBindings) {
      for (const [owner, fields] of runtimePropertyFlowsByTarget.get(binding) ??
        []) {
        const sourceBinding = collectionSourceByItem.get(owner) ?? owner;
        const visibleFields =
          rawVisibleProperties.get(sourceBinding) ?? new Set<string>();
        fields.forEach((field) => visibleFields.add(field));
        rawVisibleProperties.set(sourceBinding, visibleFields);
      }
    }
    for (const binding of rawVisibleBindings) {
      for (const value of runtimeValueLiteralsByTarget.get(binding) ?? []) {
        remember(visible, value);
      }
    }
    for (const [binding, fields] of rawVisibleProperties) {
      const pending = [binding];
      const visited = new Set<string>();
      while (pending.length) {
        const current = pending.pop()!;
        if (visited.has(current)) continue;
        visited.add(current);
        const properties = runtimePropertyLiteralsByTarget.get(current);
        for (const field of fields) {
          for (const value of properties?.get(field) ?? []) {
            remember(visible, value);
          }
        }
        for (const sourceBinding of runtimeFlowSourcesByTarget.get(current) ??
          []) {
          pending.push(sourceBinding);
        }
      }
    }
    const topLevelInitializers = new Map<string, ts.Expression>();
    const rememberInitializer = (
      declaration: ts.VariableDeclaration,
      target: Map<string, ts.Expression>,
    ) => {
      if (ts.isIdentifier(declaration.name) && declaration.initializer) {
        target.set(declaration.name.text, declaration.initializer);
      }
    };
    for (const statement of source.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        rememberInitializer(declaration, topLevelInitializers);
      }
    }
    const returnedVisibleProperties = new Set([
      "body",
      "description",
      "detail",
      "emptyText",
      "emptyTitle",
      "label",
      "message",
      "subtitle",
      "text",
      "title",
      "typeLabel",
    ]);
    const returnedPropertyName = (name: ts.PropertyName) =>
      ts.isIdentifier(name) ||
      ts.isStringLiteral(name) ||
      ts.isNumericLiteral(name)
        ? name.text
        : "";
    const translatorCallName = (node: ts.CallExpression) =>
      callName(node.expression);
    const isTemplateTranslatorCall = (node: ts.CallExpression) =>
      /^(?:t|customerWorkflowT)$/u.test(translatorCallName(node));
    const topLevelRuntimeFunctionNames = new Set(
      source.statements.flatMap((statement) =>
        ts.isFunctionDeclaration(statement) && statement.name && statement.body
          ? [statement.name.text]
          : [],
      ),
    );
    const runtimeFunctionDependencies = new Map<string, Set<string>>();

    for (const statement of source.statements) {
      if (
        !ts.isFunctionDeclaration(statement) ||
        !statement.name ||
        !statement.body
      ) {
        continue;
      }
      const functionName = statement.name.text;
      const parameterNames = new Set(
        statement.parameters.flatMap((parameter) =>
          ts.isIdentifier(parameter.name) ? [parameter.name.text] : [],
        ),
      );
      if (!parameterNames.size) continue;

      const initializers = new Map(topLevelInitializers);
      const returns: ts.ReturnStatement[] = [];
      const collectFunctionStructure = (node: ts.Node) => {
        if (node !== statement.body && ts.isFunctionLike(node)) return;
        if (ts.isVariableDeclaration(node)) {
          rememberInitializer(node, initializers);
        }
        if (ts.isReturnStatement(node)) returns.push(node);
        ts.forEachChild(node, collectFunctionStructure);
      };
      collectFunctionStructure(statement.body);

      const visibleCalls = new Set<ts.CallExpression>();
      const visibleDependencies = new Set<string>();
      const collectVisibleFlow = (
        node: ts.Node,
        allowAllObjectFields = false,
      ) => {
        if (ts.isFunctionLike(node)) return;
        if (ts.isCallExpression(node)) {
          visibleCalls.add(node);
          node.arguments.forEach((argument) =>
            collectVisibleFlow(argument, true),
          );
          return;
        }
        if (ts.isObjectLiteralExpression(node) && !allowAllObjectFields) {
          for (const property of node.properties) {
            if (
              ts.isPropertyAssignment(property) &&
              returnedVisibleProperties.has(returnedPropertyName(property.name))
            ) {
              collectVisibleFlow(property.initializer);
            } else if (
              ts.isShorthandPropertyAssignment(property) &&
              returnedVisibleProperties.has(property.name.text)
            ) {
              visibleDependencies.add(property.name.text);
            }
          }
          return;
        }
        if (ts.isIdentifier(node)) visibleDependencies.add(node.text);
        ts.forEachChild(node, (child) =>
          collectVisibleFlow(child, allowAllObjectFields),
        );
      };
      for (const returnStatement of returns) {
        if (returnStatement.expression) {
          const returned = transparentExpression(returnStatement.expression);
          collectVisibleFlow(returned);
        }
      }
      const expandedVisibleDependencies = new Set<string>();
      let hasUnexpandedVisibleDependency = true;
      while (hasUnexpandedVisibleDependency) {
        hasUnexpandedVisibleDependency = false;
        for (const dependency of visibleDependencies) {
          if (expandedVisibleDependencies.has(dependency)) continue;
          expandedVisibleDependencies.add(dependency);
          const initializer = initializers.get(dependency);
          if (initializer) {
            const visibleInitializer = transparentExpression(initializer);
            collectVisibleFlow(visibleInitializer, false);
          }
          hasUnexpandedVisibleDependency = true;
        }
      }

      const collectKeyLiterals = (
        node: ts.Node,
        target: Set<string>,
        seenBindings: Set<string>,
      ) => {
        if (ts.isFunctionLike(node)) return;
        if (
          ts.isStringLiteral(node) ||
          ts.isNoSubstitutionTemplateLiteral(node)
        ) {
          remember(target, node.text);
          return;
        }
        if (ts.isIdentifier(node)) {
          if (seenBindings.has(node.text)) return;
          const initializer = initializers.get(node.text);
          if (!initializer) return;
          const nextSeen = new Set(seenBindings);
          nextSeen.add(node.text);
          collectKeyLiterals(
            transparentExpression(initializer),
            target,
            nextSeen,
          );
          return;
        }
        if (
          ts.isElementAccessExpression(node) ||
          ts.isPropertyAccessExpression(node)
        ) {
          collectKeyLiterals(node.expression, target, seenBindings);
          return;
        }
        if (ts.isObjectLiteralExpression(node)) {
          for (const property of node.properties) {
            if (ts.isPropertyAssignment(property)) {
              collectKeyLiterals(property.initializer, target, seenBindings);
            } else if (ts.isShorthandPropertyAssignment(property)) {
              collectKeyLiterals(property.name, target, seenBindings);
            } else if (ts.isSpreadAssignment(property)) {
              collectKeyLiterals(property.expression, target, seenBindings);
            }
          }
          return;
        }
        if (ts.isBinaryExpression(node)) {
          if (node.operatorToken.kind === ts.SyntaxKind.CommaToken) {
            collectKeyLiterals(node.right, target, seenBindings);
          } else {
            collectKeyLiterals(node.left, target, seenBindings);
            collectKeyLiterals(node.right, target, seenBindings);
          }
          return;
        }
        ts.forEachChild(node, (child) =>
          collectKeyLiterals(child, target, seenBindings),
        );
      };

      const provenKeys =
        runtimeFunctionLiterals.get(functionName) ?? new Set<string>();
      for (const call of visibleCalls) {
        if (
          ts.isIdentifier(call.expression) &&
          call.expression.text !== functionName &&
          topLevelRuntimeFunctionNames.has(call.expression.text)
        ) {
          const dependencies =
            runtimeFunctionDependencies.get(functionName) ?? new Set<string>();
          dependencies.add(call.expression.text);
          runtimeFunctionDependencies.set(functionName, dependencies);
        }
        if (
          !isTemplateTranslatorCall(call) ||
          call.arguments.length < 2 ||
          !ts.isIdentifier(call.arguments[0]) ||
          !parameterNames.has(call.arguments[0].text)
        ) {
          continue;
        }
        call.arguments.slice(1).forEach(rememberIdentifierDescendants);
        collectKeyLiterals(call.arguments[1], provenKeys, new Set());
      }
      if (provenKeys.size) {
        runtimeFunctionLiterals.set(functionName, provenKeys);
      }
    }

    let propagatedRuntimeFunctionKeys = true;
    while (propagatedRuntimeFunctionKeys) {
      propagatedRuntimeFunctionKeys = false;
      for (const [functionName, dependencies] of runtimeFunctionDependencies) {
        const target =
          runtimeFunctionLiterals.get(functionName) ?? new Set<string>();
        for (const dependency of dependencies) {
          for (const key of runtimeFunctionLiterals.get(dependency) ?? []) {
            if (target.has(key)) continue;
            target.add(key);
            propagatedRuntimeFunctionKeys = true;
          }
        }
        if (target.size) runtimeFunctionLiterals.set(functionName, target);
      }
    }

    // A selector may return a typed template key instead of translating it
    // itself. Retain those keys only when the selector result is the direct
    // key argument of a visible customerWorkflowT call in a module-level UI
    // function. This excludes literals in dead/nested helpers and calls whose
    // result is used for unrelated work.
    const visibleSelectorSinks = new Set<string>();
    const reachesVisibleTemplateSink = (call: ts.CallExpression) => {
      let current: ts.Node | undefined = call.parent;
      while (current && !ts.isSourceFile(current)) {
        if (ts.isJsxExpression(current)) return true;
        if (ts.isCallExpression(current)) {
          const name = callName(current.expression);
          if (
            isAuthenticImportedCall(current, templateTranslatorIdentifiers) ||
            (name === "trim" &&
              ts.isPropertyAccessExpression(current.expression) &&
              current.arguments.length === 0) ||
            stateBindingBySetter.has(name)
          ) {
            current = current.parent;
            continue;
          }
          return false;
        }
        if (ts.isFunctionLike(current)) return false;
        current = current.parent;
      }
      return false;
    };
    const collectVisibleSelectorSinks = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        isAuthenticImportedCall(node, templateTranslatorIdentifiers) &&
        node.arguments.length >= 2 &&
        reachesVisibleTemplateSink(node)
      ) {
        let boundary: ts.Node | undefined = node.parent;
        while (boundary && !ts.isFunctionLike(boundary)) {
          boundary = boundary.parent;
        }
        const keyExpression = transparentExpression(node.arguments[1]);
        if (
          ts.isFunctionDeclaration(boundary) &&
          ts.isSourceFile(boundary.parent) &&
          ts.isCallExpression(keyExpression) &&
          ts.isIdentifier(keyExpression.expression)
        ) {
          visibleSelectorSinks.add(keyExpression.expression.text);
        }
      }
      ts.forEachChild(node, collectVisibleSelectorSinks);
    };
    collectVisibleSelectorSinks(source);

    const selectorDeclarations = new Map<string, ts.FunctionDeclaration[]>();
    const indexSelectorDeclarations = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) && node.name && node.body) {
        const declarations = selectorDeclarations.get(node.name.text) ?? [];
        declarations.push(node);
        selectorDeclarations.set(node.name.text, declarations);
      }
      ts.forEachChild(node, indexSelectorDeclarations);
    };
    indexSelectorDeclarations(source);

    const isInModuleLevelUiFunction = (node: ts.Node) => {
      let current: ts.Node | undefined = node.parent;
      while (current && !ts.isSourceFile(current)) {
        if (ts.isFunctionLike(current)) {
          return (
            ts.isFunctionDeclaration(current) && ts.isSourceFile(current.parent)
          );
        }
        current = current.parent;
      }
      return false;
    };
    const visibleOutputBindings = new Set<string>();
    const rememberOutputIdentifiers = (node: ts.Node) => {
      if (ts.isIdentifier(node)) visibleOutputBindings.add(node.text);
      ts.forEachChild(node, rememberOutputIdentifiers);
    };
    const isClipboardWriteTextCall = (node: ts.Node) =>
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "writeText" &&
      ts.isPropertyAccessExpression(node.expression.expression) &&
      node.expression.expression.name.text === "clipboard" &&
      ts.isIdentifier(node.expression.expression.expression) &&
      node.expression.expression.expression.text === "navigator";
    const collectVisibleOutputBindings = (node: ts.Node) => {
      if (
        ts.isJsxExpression(node) &&
        node.expression &&
        isInModuleLevelUiFunction(node)
      ) {
        rememberOutputIdentifiers(node.expression);
      }
      if (isClipboardWriteTextCall(node)) {
        (node as ts.CallExpression).arguments.forEach(
          rememberOutputIdentifiers,
        );
      }
      ts.forEachChild(node, collectVisibleOutputBindings);
    };
    collectVisibleOutputBindings(source);
    let propagatedVisibleOutput = true;
    while (propagatedVisibleOutput) {
      propagatedVisibleOutput = false;
      for (const [target, sources] of runtimeFlowSourcesByTarget) {
        if (!visibleOutputBindings.has(target)) continue;
        for (const sourceBinding of sources) {
          if (visibleOutputBindings.has(sourceBinding)) continue;
          visibleOutputBindings.add(sourceBinding);
          propagatedVisibleOutput = true;
        }
      }
    }
    const translatorResultIsVisible = (call: ts.CallExpression) =>
      reachesVisibleTemplateSink(call) ||
      bindingNamesForNode(call).some((binding) =>
        visibleOutputBindings.has(binding),
      ) ||
      (() => {
        const functionName = functionNameForNode(call);
        if (functionName && visibleOutputBindings.has(functionName)) {
          return true;
        }
        let current: ts.Node | undefined = call.parent;
        while (current && !ts.isFunctionLike(current)) {
          if (ts.isCallExpression(current)) {
            const stateBinding = stateBindingBySetter.get(
              callName(current.expression),
            );
            if (stateBinding && visibleOutputBindings.has(stateBinding)) {
              return true;
            }
          }
          current = current.parent;
        }
        return false;
      })();
    const collectVisibleRuntimeFunctionCalls = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        translatorResultIsVisible(node)
      ) {
        const name = node.expression.text;
        const imported = namedImportOrigins.get(name);
        if (imported) {
          const resolvedImport = resolveCustomerWorkflowSourceImport(
            file,
            imported.moduleSpecifier,
          );
          if (resolvedImport) {
            visibleImportedRuntimeFunctionCalls.add(
              `${resolvedImport}#${imported.importedName}`,
            );
          }
        } else if (topLevelRuntimeFunctionNames.has(name)) {
          visibleLocalRuntimeFunctionCalls.add(`${file}#${name}`);
        }
      }
      ts.forEachChild(node, collectVisibleRuntimeFunctionCalls);
    };
    collectVisibleRuntimeFunctionCalls(source);

    const collectExactSourceCandidates = (
      expression: ts.Expression,
      target: Set<string>,
      seen = new Set<string>(),
    ) => {
      const candidate = transparentExpression(expression);
      if (
        ts.isStringLiteral(candidate) ||
        ts.isNoSubstitutionTemplateLiteral(candidate)
      ) {
        remember(target, candidate.text);
        return;
      }
      if (ts.isConditionalExpression(candidate)) {
        collectExactSourceCandidates(candidate.whenTrue, target, new Set(seen));
        collectExactSourceCandidates(
          candidate.whenFalse,
          target,
          new Set(seen),
        );
        return;
      }
      if (ts.isBinaryExpression(candidate)) {
        if (candidate.operatorToken.kind === ts.SyntaxKind.CommaToken) {
          collectExactSourceCandidates(candidate.right, target, seen);
        } else if (
          candidate.operatorToken.kind ===
            ts.SyntaxKind.QuestionQuestionToken ||
          candidate.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
          candidate.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
        ) {
          collectExactSourceCandidates(candidate.left, target, new Set(seen));
          collectExactSourceCandidates(candidate.right, target, new Set(seen));
        }
        return;
      }
      if (ts.isIdentifier(candidate)) {
        if (seen.has(candidate.text)) return;
        const nextSeen = new Set([...seen, candidate.text]);
        const directValues =
          runtimeValueLiteralsByTarget.get(candidate.text) ?? new Set<string>();
        for (const value of directValues) {
          remember(target, value);
        }
        for (const sourceBinding of runtimeFlowSourcesByTarget.get(
          candidate.text,
        ) ?? []) {
          collectExactSourceCandidates(
            ts.factory.createIdentifier(sourceBinding),
            target,
            nextSeen,
          );
        }
        return;
      }
      if (
        ts.isPropertyAccessExpression(candidate) ||
        (ts.isElementAccessExpression(candidate) &&
          candidate.argumentExpression &&
          (ts.isStringLiteral(candidate.argumentExpression) ||
            ts.isNoSubstitutionTemplateLiteral(candidate.argumentExpression)))
      ) {
        const owner = transparentExpression(candidate.expression);
        const field = ts.isPropertyAccessExpression(candidate)
          ? candidate.name.text
          : (candidate.argumentExpression as ts.StringLiteralLike).text;
        if (!ts.isIdentifier(owner)) return;
        const sourceBinding =
          collectionSourceByItem.get(owner.text) ?? owner.text;
        const pending = [sourceBinding];
        const visited = new Set<string>();
        while (pending.length) {
          const binding = pending.pop()!;
          if (visited.has(binding)) continue;
          visited.add(binding);
          for (const value of runtimePropertyLiteralsByTarget
            .get(binding)
            ?.get(field) ?? []) {
            remember(target, value);
          }
          for (const source of runtimeFlowSourcesByTarget.get(binding) ?? []) {
            pending.push(source);
          }
        }
      }
    };
    const rememberExactExpressionUse = (expression: ts.Expression) => {
      const candidate = transparentExpression(expression);
      if (ts.isIdentifier(candidate)) {
        runtimeExactUsedBindings.add(candidate.text);
        return;
      }
      if (
        ts.isPropertyAccessExpression(candidate) ||
        (ts.isElementAccessExpression(candidate) &&
          candidate.argumentExpression &&
          (ts.isStringLiteral(candidate.argumentExpression) ||
            ts.isNoSubstitutionTemplateLiteral(candidate.argumentExpression)))
      ) {
        const owner = transparentExpression(candidate.expression);
        if (ts.isIdentifier(owner)) {
          const sourceBinding =
            collectionSourceByItem.get(owner.text) ?? owner.text;
          const field = ts.isPropertyAccessExpression(candidate)
            ? candidate.name.text
            : (candidate.argumentExpression as ts.StringLiteralLike).text;
          const fields =
            runtimeExactUsedProperties.get(sourceBinding) ?? new Set<string>();
          fields.add(field);
          runtimeExactUsedProperties.set(sourceBinding, fields);
          runtimeExactUsedBindings.add(sourceBinding);
        }
        return;
      }
      if (ts.isConditionalExpression(candidate)) {
        rememberExactExpressionUse(candidate.whenTrue);
        rememberExactExpressionUse(candidate.whenFalse);
        return;
      }
      if (ts.isBinaryExpression(candidate)) {
        if (candidate.operatorToken.kind === ts.SyntaxKind.CommaToken) {
          rememberExactExpressionUse(candidate.right);
        } else if (
          candidate.operatorToken.kind ===
            ts.SyntaxKind.QuestionQuestionToken ||
          candidate.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
          candidate.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
        ) {
          rememberExactExpressionUse(candidate.left);
          rememberExactExpressionUse(candidate.right);
        }
      }
    };

    for (const call of exactTranslatorCalls) {
      if (!translatorResultIsVisible(call)) continue;
      call.arguments.slice(1).forEach(rememberIdentifierDescendants);
      if (call.arguments[1]) {
        const candidates = new Set<string>();
        collectExactSourceCandidates(call.arguments[1], candidates);
        candidates.forEach((value) => remember(directExact, value));
        if (
          !ts.isStringLiteral(transparentExpression(call.arguments[1])) &&
          !ts.isNoSubstitutionTemplateLiteral(
            transparentExpression(call.arguments[1]),
          )
        ) {
          candidates.forEach((value) => remember(exactTransportSources, value));
          rememberExactExpressionUse(call.arguments[1]);
        }
      }
    }
    for (const call of templateTranslatorCalls) {
      if (!translatorResultIsVisible(call) || !call.arguments[1]) continue;
      rememberLiteralDescendants(directTemplateKeys, call.arguments[1]);
      const candidates = new Set<string>();
      collectExactSourceCandidates(call.arguments[1], candidates);
      candidates.forEach((value) => remember(directTemplateKeys, value));
      call.arguments.slice(1).forEach(rememberIdentifierDescendants);
    }
    for (const { call, parameterIndex, provider } of domTransportCalls) {
      if (!translatorResultIsVisible(call)) continue;
      const sourceArgument = call.arguments[parameterIndex];
      if (!sourceArgument) continue;
      const candidates = new Set<string>();
      collectExactSourceCandidates(sourceArgument, candidates);
      const target =
        provider === "auth-dom"
          ? authDomTransportSources
          : portalCommonDomTransportSources;
      candidates.forEach((value) => remember(target, value));
    }
    for (const call of runtimeTransportCalls) {
      if (!translatorResultIsVisible(call)) continue;
      const sourceArgument = exactWrapperParameterIndexes.has(
        callName(call.expression),
      )
        ? call.arguments[
            exactWrapperParameterIndexes.get(callName(call.expression))!
          ]
        : call.arguments[1];
      if (sourceArgument) rememberIdentifierDescendants(sourceArgument);
      if (sourceArgument) {
        const candidates = new Set<string>();
        collectExactSourceCandidates(sourceArgument, candidates);
        candidates.forEach((value) => {
          remember(directExact, value);
          remember(exactTransportSources, value);
        });
        rememberExactExpressionUse(sourceArgument);
      }
    }
    for (const call of authFeedbackCalls) {
      if (!translatorResultIsVisible(call) || !call.arguments[1]) continue;
      const feedback = transparentExpression(call.arguments[1]);
      if (!ts.isIdentifier(feedback)) continue;
      const candidates =
        runtimePropertyLiteralsByTarget.get(feedback.text)?.get("source") ??
        new Set<string>();
      candidates.forEach((value) => {
        remember(directExact, value);
        remember(exactTransportSources, value);
      });
      const fields =
        runtimeExactUsedProperties.get(feedback.text) ?? new Set<string>();
      fields.add("source");
      runtimeExactUsedProperties.set(feedback.text, fields);
      runtimeExactUsedBindings.add(feedback.text);
      rememberIdentifierDescendants(feedback);
    }
    const visibleStateKeyBindings = new Set<string>();
    const collectVisibleStateKeyBindings = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        isAuthenticImportedCall(node, templateTranslatorIdentifiers) &&
        node.arguments.length >= 2 &&
        translatorResultIsVisible(node)
      ) {
        const keyExpression = transparentExpression(node.arguments[1]);
        if (
          ts.isPropertyAccessExpression(keyExpression) &&
          keyExpression.name.text === "key" &&
          ts.isIdentifier(keyExpression.expression)
        ) {
          visibleStateKeyBindings.add(keyExpression.expression.text);
        }
      }
      ts.forEachChild(node, collectVisibleStateKeyBindings);
    };
    collectVisibleStateKeyBindings(source);
    for (const stateBinding of visibleStateKeyBindings) {
      const pending = [stateBinding];
      const visited = new Set<string>();
      while (pending.length) {
        const binding = pending.pop()!;
        if (visited.has(binding)) continue;
        visited.add(binding);
        if (selectorDeclarations.has(binding)) {
          visibleSelectorSinks.add(binding);
        }
        for (const sourceBinding of runtimeFlowSourcesByTarget.get(binding) ??
          []) {
          pending.push(sourceBinding);
        }
      }
    }

    const collectSelectorKeyExpression = (
      expression: ts.Expression,
      initializers: Map<string, ts.Expression>,
      target: Set<string>,
      seen: Set<string>,
    ): boolean => {
      const candidate = transparentExpression(expression);
      if (
        ts.isStringLiteral(candidate) ||
        ts.isNoSubstitutionTemplateLiteral(candidate)
      ) {
        remember(target, candidate.text);
        return true;
      }
      if (ts.isIdentifier(candidate)) {
        if (candidate.text === "undefined") return true;
        if (seen.has(candidate.text)) return false;
        const initializer = initializers.get(candidate.text);
        if (!initializer) return false;
        const nextSeen = new Set(seen);
        nextSeen.add(candidate.text);
        return collectSelectorKeyExpression(
          initializer,
          initializers,
          target,
          nextSeen,
        );
      }
      if (
        ts.isElementAccessExpression(candidate) ||
        ts.isPropertyAccessExpression(candidate)
      ) {
        const owner = transparentExpression(candidate.expression);
        if (!ts.isIdentifier(owner) || seen.has(owner.text)) return false;
        const initializer = initializers.get(owner.text);
        if (!initializer) return false;
        const map = transparentExpression(initializer);
        if (!ts.isObjectLiteralExpression(map)) return false;
        const requestedProperty = ts.isPropertyAccessExpression(candidate)
          ? candidate.name.text
          : candidate.argumentExpression &&
              (ts.isStringLiteral(candidate.argumentExpression) ||
                ts.isNoSubstitutionTemplateLiteral(
                  candidate.argumentExpression,
                ))
            ? candidate.argumentExpression.text
            : null;
        const values = map.properties.flatMap((property) => {
          if (!ts.isPropertyAssignment(property)) return [];
          if (
            requestedProperty !== null &&
            returnedPropertyName(property.name) !== requestedProperty
          ) {
            return [];
          }
          return [property.initializer];
        });
        return (
          values.length > 0 &&
          values.every((value) =>
            collectSelectorKeyExpression(
              value,
              initializers,
              target,
              new Set([...seen, owner.text]),
            ),
          )
        );
      }
      if (ts.isConditionalExpression(candidate)) {
        return [candidate.whenTrue, candidate.whenFalse].every((branch) =>
          collectSelectorKeyExpression(
            branch,
            initializers,
            target,
            new Set(seen),
          ),
        );
      }
      if (ts.isBinaryExpression(candidate)) {
        if (candidate.operatorToken.kind === ts.SyntaxKind.CommaToken) {
          return collectSelectorKeyExpression(
            candidate.right,
            initializers,
            target,
            seen,
          );
        }
        if (
          candidate.operatorToken.kind !==
            ts.SyntaxKind.QuestionQuestionToken &&
          candidate.operatorToken.kind !== ts.SyntaxKind.BarBarToken &&
          candidate.operatorToken.kind !== ts.SyntaxKind.AmpersandAmpersandToken
        ) {
          return false;
        }
        return [candidate.left, candidate.right].every((branch) =>
          collectSelectorKeyExpression(
            branch,
            initializers,
            target,
            new Set(seen),
          ),
        );
      }
      return candidate.kind === ts.SyntaxKind.NullKeyword;
    };
    const collectSelectorReturnExpression = (
      expression: ts.Expression,
      initializers: Map<string, ts.Expression>,
      target: Set<string>,
      seen: Set<string>,
    ): boolean => {
      const candidate = transparentExpression(expression);
      if (candidate.kind === ts.SyntaxKind.NullKeyword) return true;
      if (ts.isIdentifier(candidate)) {
        if (seen.has(candidate.text)) return false;
        const initializer = initializers.get(candidate.text);
        if (!initializer) return false;
        const nextSeen = new Set(seen);
        nextSeen.add(candidate.text);
        return collectSelectorReturnExpression(
          initializer,
          initializers,
          target,
          nextSeen,
        );
      }
      if (ts.isConditionalExpression(candidate)) {
        return [candidate.whenTrue, candidate.whenFalse].every((branch) =>
          collectSelectorReturnExpression(
            branch,
            initializers,
            target,
            new Set(seen),
          ),
        );
      }
      if (ts.isObjectLiteralExpression(candidate)) {
        if (candidate.properties.some(ts.isSpreadAssignment)) return false;
        const keyProperties = candidate.properties.filter(
          (property): property is ts.PropertyAssignment =>
            ts.isPropertyAssignment(property) &&
            returnedPropertyName(property.name) === "key",
        );
        return (
          keyProperties.length === 1 &&
          collectSelectorKeyExpression(
            keyProperties[0].initializer,
            initializers,
            target,
            seen,
          )
        );
      }
      return collectSelectorKeyExpression(
        candidate,
        initializers,
        target,
        seen,
      );
    };

    for (const selectorName of visibleSelectorSinks) {
      const declarations = selectorDeclarations.get(selectorName) ?? [];
      if (declarations.length !== 1) continue;
      const selector = declarations[0];
      const initializers = new Map(topLevelInitializers);
      const returns: ts.Expression[] = [];
      const collectSelectorStructure = (node: ts.Node) => {
        if (node !== selector.body && ts.isFunctionLike(node)) return;
        if (ts.isVariableDeclaration(node)) {
          rememberInitializer(node, initializers);
        }
        if (ts.isReturnStatement(node) && node.expression) {
          returns.push(node.expression);
          return;
        }
        ts.forEachChild(node, collectSelectorStructure);
      };
      collectSelectorStructure(selector.body!);
      const selectorKeys = new Set<string>();
      if (
        returns.length > 0 &&
        returns.every((returned) =>
          collectSelectorReturnExpression(
            returned,
            initializers,
            selectorKeys,
            new Set(),
          ),
        ) &&
        selectorKeys.size > 0
      ) {
        runtimeFunctionLiterals.set(selectorName, selectorKeys);
        runtimeUsedBindings.add(selectorName);
      }
    }

    // Prove runtime provenance by walking backwards from typed translator
    // arguments through local assignments, helper returns and React state
    // setters. Arbitrary called functions and dead bindings are not sinks.
    let propagatedRuntimeBinding = true;
    while (propagatedRuntimeBinding) {
      propagatedRuntimeBinding = false;
      for (const [
        targetBinding,
        sourceBindings,
      ] of runtimeFlowSourcesByTarget) {
        if (!runtimeUsedBindings.has(targetBinding)) continue;
        for (const sourceBinding of sourceBindings) {
          if (runtimeUsedBindings.has(sourceBinding)) continue;
          runtimeUsedBindings.add(sourceBinding);
          propagatedRuntimeBinding = true;
        }
      }
    }

    let propagatedExactBinding = true;
    while (propagatedExactBinding) {
      propagatedExactBinding = false;
      for (const [
        targetBinding,
        sourceBindings,
      ] of runtimeFlowSourcesByTarget) {
        if (!runtimeExactUsedBindings.has(targetBinding)) continue;
        for (const sourceBinding of sourceBindings) {
          if (runtimeExactUsedBindings.has(sourceBinding)) continue;
          runtimeExactUsedBindings.add(sourceBinding);
          propagatedExactBinding = true;
        }
      }
    }

    const approvedRuntimeCall = new Set(
      runtimeTransportCalls.filter(translatorResultIsVisible),
    );
    const occurrenceIsApprovedTransport = (node: ts.Node) => {
      let current: ts.Node | undefined = node.parent;
      let property: string | null = null;
      while (current && !ts.isSourceFile(current)) {
        if (ts.isPropertyAssignment(current) && property === null) {
          property = propertyName(current.name) || null;
        }
        if (ts.isCallExpression(current)) {
          if (approvedRuntimeCall.has(current)) return true;
          const stateBinding = stateBindingBySetter.get(
            callName(current.expression),
          );
          if (stateBinding && runtimeExactUsedBindings.has(stateBinding)) {
            return true;
          }
        }
        if (
          ts.isVariableDeclaration(current) &&
          ts.isIdentifier(current.name)
        ) {
          if (
            property &&
            runtimeExactUsedProperties.get(current.name.text)?.has(property)
          ) {
            return true;
          }
          return runtimeExactUsedBindings.has(current.name.text);
        }
        current = current.parent;
      }
      return false;
    };
    const inspectTransportOccurrences = (node: ts.Node) => {
      if (
        ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isJsxText(node)
      ) {
        const value = normalizeVisibleText(node.text);
        if (
          value &&
          hasVisibleAncestor(node) &&
          !occurrenceIsApprovedTransport(node)
        ) {
          unapprovedExactTransportSources.add(value);
        }
      }
      ts.forEachChild(node, inspectTransportOccurrences);
    };
    inspectTransportOccurrences(source);

    const resolveRawPropertyValues = (
      binding: string,
      field: string,
      seen: Set<string>,
    ) => {
      const values = new Set<string>();
      for (const value of runtimePropertyLiteralsByTarget
        .get(binding)
        ?.get(field) ?? []) {
        remember(values, value);
      }
      if (seen.has(binding)) return values;
      const nextSeen = new Set(seen);
      nextSeen.add(binding);
      for (const sourceBinding of runtimeFlowSourcesByTarget.get(binding) ??
        []) {
        resolveRawPropertyValues(sourceBinding, field, nextSeen).forEach(
          (value) => remember(values, value),
        );
      }
      return values;
    };
    const resolveRawExpressionValues = (
      expression: ts.Expression,
      seen = new Set<string>(),
    ): Set<string> => {
      const candidate = transparentExpression(expression);
      const values = new Set<string>();
      if (
        ts.isStringLiteral(candidate) ||
        ts.isNoSubstitutionTemplateLiteral(candidate)
      ) {
        remember(values, candidate.text);
        return values;
      }
      if (ts.isIdentifier(candidate)) {
        if (seen.has(candidate.text)) return values;
        const nextSeen = new Set(seen);
        nextSeen.add(candidate.text);
        for (const value of runtimeValueLiteralsByTarget.get(candidate.text) ??
          []) {
          remember(values, value);
        }
        for (const [owner, fields] of runtimePropertyFlowsByTarget.get(
          candidate.text,
        ) ?? []) {
          for (const field of fields) {
            resolveRawPropertyValues(owner, field, nextSeen).forEach((value) =>
              remember(values, value),
            );
          }
        }
        for (const sourceBinding of runtimeFlowSourcesByTarget.get(
          candidate.text,
        ) ?? []) {
          resolveRawExpressionValues(
            ts.factory.createIdentifier(sourceBinding),
            nextSeen,
          ).forEach((value) => remember(values, value));
        }
        return values;
      }
      if (
        ts.isPropertyAccessExpression(candidate) ||
        (ts.isElementAccessExpression(candidate) &&
          candidate.argumentExpression &&
          (ts.isStringLiteral(candidate.argumentExpression) ||
            ts.isNoSubstitutionTemplateLiteral(candidate.argumentExpression)))
      ) {
        const owner = transparentExpression(candidate.expression);
        const field = ts.isPropertyAccessExpression(candidate)
          ? candidate.name.text
          : (candidate.argumentExpression as ts.StringLiteralLike).text;
        if (ts.isIdentifier(owner)) {
          resolveRawPropertyValues(owner.text, field, seen).forEach((value) =>
            remember(values, value),
          );
        }
        return values;
      }
      if (
        ts.isCallExpression(candidate) &&
        ts.isIdentifier(candidate.expression)
      ) {
        return resolveRawExpressionValues(candidate.expression, seen);
      }
      const branches = ts.isConditionalExpression(candidate)
        ? [candidate.whenTrue, candidate.whenFalse]
        : ts.isBinaryExpression(candidate) &&
            (candidate.operatorToken.kind ===
              ts.SyntaxKind.QuestionQuestionToken ||
              candidate.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
              candidate.operatorToken.kind ===
                ts.SyntaxKind.AmpersandAmpersandToken ||
              candidate.operatorToken.kind === ts.SyntaxKind.PlusToken ||
              candidate.operatorToken.kind === ts.SyntaxKind.CommaToken)
          ? candidate.operatorToken.kind === ts.SyntaxKind.CommaToken ||
            candidate.operatorToken.kind ===
              ts.SyntaxKind.AmpersandAmpersandToken
            ? [candidate.right]
            : [candidate.left, candidate.right]
          : null;
      for (const branch of branches ?? []) {
        resolveRawExpressionValues(branch, seen).forEach((value) =>
          remember(values, value),
        );
      }
      if (ts.isTemplateExpression(candidate)) {
        remember(values, candidate.head.text);
        candidate.templateSpans.forEach((span) => {
          resolveRawExpressionValues(span.expression, seen).forEach((value) =>
            remember(values, value),
          );
          remember(values, span.literal.text);
        });
      }
      return values;
    };
    const rememberRawOccurrence = (value: string) => {
      const normalized = normalizeVisibleText(value);
      if (!normalized) return;
      rawVisibleOccurrenceCounts.set(
        normalized,
        (rawVisibleOccurrenceCounts.get(normalized) ?? 0) + 1,
      );
    };
    for (const node of rawVisibleJsxTextNodes) {
      if (!occurrenceIsApprovedTransport(node))
        rememberRawOccurrence(node.text);
    }
    for (const { expression, directDom } of rawVisibleSinkExpressions) {
      if (!directDom) continue;
      if (occurrenceIsApprovedTransport(expression)) continue;
      resolveRawExpressionValues(expression).forEach((value) => {
        rememberRawOccurrence(value);
        remember(unapprovedExactTransportSources, value);
      });
    }
  }

  unapprovedExactTransportSources.forEach((value) =>
    exactTransportSources.delete(value),
  );

  return {
    all,
    authDomTransportSources,
    directExact,
    directTemplateKeys,
    exactTransportSources,
    unapprovedExactTransportSources,
    portalCommonDomTransportSources,
    runtimeBindingLiterals,
    runtimeFunctionLiterals,
    runtimeUsedBindings,
    rawVisibleOccurrenceCounts,
    visibleImportedRuntimeFunctionCalls,
    visibleLocalRuntimeFunctionCalls,
    visible,
  };
}

const provenanceLiteralCache = new Map<
  string,
  ReturnType<typeof collectSourceLiterals>
>();

function provenanceLiterals(file: string) {
  const cached = provenanceLiteralCache.get(file);
  if (cached) return cached;
  const literals = collectSourceLiterals([file]);
  provenanceLiteralCache.set(file, literals);
  return literals;
}

function hasRuntimeProvenanceLiteral(value: string, files: readonly string[]) {
  const normalized = normalizeVisibleText(value);
  return files.some((file) => {
    const literals = provenanceLiterals(file);
    return [
      literals.directExact,
      literals.directTemplateKeys,
      literals.visible,
    ].some((values) => values.has(value) || values.has(normalized));
  });
}

function hasRuntimeBindingLiteral(
  value: string,
  files: readonly string[],
  bindings: readonly string[],
) {
  const normalized = normalizeVisibleText(value);
  return files.some((file) => {
    const literals = provenanceLiterals(file).runtimeBindingLiterals;
    const usedBindings = provenanceLiterals(file).runtimeUsedBindings;
    return bindings.some((binding) => {
      if (!usedBindings.has(binding)) return false;
      const values = literals.get(binding);
      return values?.has(value) || values?.has(normalized);
    });
  });
}

function hasRuntimeFunctionLiteral(
  value: string,
  files: readonly string[],
  functions: readonly string[],
  helper: GroupConfig["helper"],
) {
  const normalized = normalizeVisibleText(value);
  const helperRuntimeFunction =
    helper === "password"
      ? "translateCustomerPasswordError"
      : helper === "notifications"
        ? "translateCustomerNotification"
        : null;
  return functions.some((functionName) => {
    const providers = files.filter((file) => {
      const values =
        provenanceLiterals(file).runtimeFunctionLiterals.get(functionName);
      return values?.has(value) || values?.has(normalized);
    });
    if (!providers.length) return false;
    if (functionName === helperRuntimeFunction) return true;
    return providers.some((providerFile) => {
      const exactTarget = `${providerFile}#${functionName}`;
      return files.some((consumerFile) => {
        const consumer = provenanceLiterals(consumerFile);
        return (
          consumer.visibleLocalRuntimeFunctionCalls.has(exactTarget) ||
          consumer.visibleImportedRuntimeFunctionCalls.has(exactTarget)
        );
      });
    });
  });
}

function validateDerivedBuilder(
  groupName: GeneratedGroupName,
  entry: ManualExactSource,
) {
  const derived = entry.derivedBuilder;
  if (!derived) return false;
  if (!entry.translations) {
    throw new Error(
      `${groupName}: derived source ${JSON.stringify(entry.source)} has no explicit locale parity`,
    );
  }
  const sourceText = readFileSync(derived.builderFile, "utf8");
  const source = parseAuditedSource(derived.builderFile, sourceText);
  let hasTranslatorImport = false;
  const topLevelFunctions = new Map<string, ts.FunctionDeclaration>();
  for (const statement of source.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === derived.translationModule &&
      statement.importClause?.namedBindings &&
      ts.isNamedImports(statement.importClause.namedBindings)
    ) {
      hasTranslatorImport = statement.importClause.namedBindings.elements.some(
        (element) =>
          element.name.text === derived.translatorLocalName &&
          (element.propertyName ?? element.name).text ===
            derived.translatorExportName,
      );
    }
    if (
      ts.isFunctionDeclaration(statement) &&
      statement.name &&
      statement.body
    ) {
      topLevelFunctions.set(statement.name.text, statement);
    }
  }
  const builder = topLevelFunctions.get(derived.builderFunction) ?? null;
  const builderBody = builder?.body;
  const localeParameter = builder?.parameters[0]?.name;
  if (
    !hasTranslatorImport ||
    !builder ||
    !builderBody ||
    !localeParameter ||
    !ts.isIdentifier(localeParameter)
  ) {
    throw new Error(
      `${groupName}: derived metadata source ${JSON.stringify(entry.source)} is not bound to ` +
        `${derived.builderFunction} -> ${derived.translationModule}`,
    );
  }

  const transparentExpression = (expression: ts.Expression): ts.Expression => {
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
    return current;
  };
  const returnedPropertyName = (name: ts.PropertyName) =>
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name)
      ? name.text
      : "";
  const returnedFieldExpression = (
    object: ts.ObjectLiteralExpression,
    field: string,
  ): ts.Expression | null => {
    if (object.properties.some(ts.isSpreadAssignment)) return null;
    const matches: ts.Expression[] = [];
    for (const property of object.properties) {
      if (
        ts.isPropertyAssignment(property) &&
        returnedPropertyName(property.name) === field
      ) {
        matches.push(property.initializer);
      }
      if (
        ts.isShorthandPropertyAssignment(property) &&
        property.name.text === field
      ) {
        matches.push(property.name);
      }
      if (
        (ts.isMethodDeclaration(property) ||
          ts.isGetAccessorDeclaration(property) ||
          ts.isSetAccessorDeclaration(property)) &&
        returnedPropertyName(property.name) === field
      ) {
        return null;
      }
    }
    return matches.length === 1 ? matches[0] : null;
  };
  const directReturnExpressions = (
    declaration: ts.FunctionDeclaration,
  ): ts.Expression[] => {
    const expressions: ts.Expression[] = [];
    const visit = (node: ts.Node) => {
      if (node !== declaration.body && ts.isFunctionLike(node)) return;
      if (ts.isReturnStatement(node) && node.expression) {
        expressions.push(transparentExpression(node.expression));
        return;
      }
      ts.forEachChild(node, visit);
    };
    if (declaration.body) visit(declaration.body);
    return expressions;
  };
  const matchesConfiguredTranslator = (expression: ts.Expression) => {
    const candidate = transparentExpression(expression);
    return (
      ts.isCallExpression(candidate) &&
      ts.isIdentifier(candidate.expression) &&
      candidate.expression.text === derived.translatorLocalName &&
      candidate.arguments.length >= 2 &&
      ts.isIdentifier(candidate.arguments[0]) &&
      candidate.arguments[0].text === localeParameter.text &&
      (ts.isStringLiteral(candidate.arguments[1]) ||
        ts.isNoSubstitutionTemplateLiteral(candidate.arguments[1])) &&
      candidate.arguments[1].text === derived.translationKey
    );
  };
  const helperArgumentForField = (
    helper: ts.FunctionDeclaration,
    field: string,
  ): number | null => {
    const returns = directReturnExpressions(helper);
    if (!returns.length) return null;
    let parameterIndex: number | null = null;
    for (const returnExpression of returns) {
      if (!ts.isObjectLiteralExpression(returnExpression)) return null;
      const fieldExpression = returnedFieldExpression(returnExpression, field);
      if (!fieldExpression) return null;
      const candidate = transparentExpression(fieldExpression);
      if (!ts.isIdentifier(candidate)) return null;
      const index = helper.parameters.findIndex(
        (parameter) =>
          ts.isIdentifier(parameter.name) &&
          parameter.name.text === candidate.text,
      );
      if (index < 0) return null;
      if (parameterIndex !== null && parameterIndex !== index) return null;
      parameterIndex = index;
    }
    return parameterIndex;
  };
  const returnSuppliesConfiguredField = (expression: ts.Expression) => {
    const returned = transparentExpression(expression);
    if (ts.isObjectLiteralExpression(returned)) {
      const fieldExpression = returnedFieldExpression(
        returned,
        derived.targetField,
      );
      return Boolean(
        fieldExpression && matchesConfiguredTranslator(fieldExpression),
      );
    }
    if (
      !ts.isCallExpression(returned) ||
      !ts.isIdentifier(returned.expression)
    ) {
      return false;
    }
    const helper = topLevelFunctions.get(returned.expression.text);
    if (!helper || helper === builder) return false;
    const argumentIndex = helperArgumentForField(helper, derived.targetField);
    return (
      argumentIndex !== null &&
      Boolean(returned.arguments[argumentIndex]) &&
      matchesConfiguredTranslator(returned.arguments[argumentIndex])
    );
  };

  const builderReturns = directReturnExpressions(builder);
  if (
    !builderReturns.length ||
    !builderReturns.every(returnSuppliesConfiguredField)
  ) {
    throw new Error(
      `${groupName}: derived metadata builder ${derived.builderFunction} does not supply ` +
        `${derived.targetField} from ${derived.translatorLocalName}(` +
        `locale, ${JSON.stringify(derived.translationKey)}) on every top-level return path`,
    );
  }
  return true;
}

function validatedManualExactSources(
  groupName: GeneratedGroupName,
  config: GroupConfig,
) {
  const entries = new Map<string, ManualExactSource>();
  for (const entry of config.manualExactSources ?? []) {
    if (!entry.provenanceFiles.length) {
      throw new Error(
        `${groupName}: manual exact source has no provenance: ${entry.source}`,
      );
    }
    if (
      !validateDerivedBuilder(groupName, entry) &&
      !hasRuntimeProvenanceLiteral(entry.source, entry.provenanceFiles) &&
      !hasRuntimeBindingLiteral(
        entry.source,
        entry.provenanceFiles,
        entry.runtimeBindings ?? [],
      )
    ) {
      throw new Error(
        `${groupName}: stale manual exact source ${JSON.stringify(entry.source)}; ` +
          `not found in visible/direct runtime use in ${entry.provenanceFiles.join(", ")}`,
      );
    }
    if (
      entry.translations &&
      entry.translations.length !== customerWorkflowLocaleOrder.length
    ) {
      throw new Error(
        `${groupName}: manual exact source ${JSON.stringify(entry.source)} has ` +
          `${entry.translations.length} translations; expected ${customerWorkflowLocaleOrder.length}`,
      );
    }
    if (entries.has(entry.source)) {
      throw new Error(
        `${groupName}: duplicate manual exact source ${JSON.stringify(entry.source)}`,
      );
    }
    entries.set(entry.source, entry);
  }
  return entries;
}

function validatedManualTemplateKeys(
  groupName: GeneratedGroupName,
  config: GroupConfig,
) {
  const keys = new Set<string>();
  for (const entry of config.manualTemplateKeys ?? []) {
    if (!entry.provenanceFiles.length) {
      throw new Error(
        `${groupName}: manual template key has no provenance: ${entry.key}`,
      );
    }
    if (
      !hasRuntimeProvenanceLiteral(entry.key, entry.provenanceFiles) &&
      !hasRuntimeBindingLiteral(
        entry.key,
        entry.provenanceFiles,
        entry.runtimeBindings ?? [],
      ) &&
      !hasRuntimeFunctionLiteral(
        entry.key,
        entry.provenanceFiles,
        entry.runtimeFunctions ?? [],
        config.helper,
      )
    ) {
      throw new Error(
        `${groupName}: stale manual template key ${JSON.stringify(entry.key)}; ` +
          `not found in visible/direct runtime use in ${entry.provenanceFiles.join(", ")}`,
      );
    }
    if (keys.has(entry.key)) {
      throw new Error(
        `${groupName}: duplicate manual template key ${JSON.stringify(entry.key)}`,
      );
    }
    keys.add(entry.key);
  }
  return keys;
}

function buildCombinedExactRows() {
  const rows = new Map<string, readonly string[]>();
  const baseSources = new Set<string>();
  for (const locale of localeOrder) {
    Object.keys(baseExactTranslations[locale]).forEach((source) =>
      baseSources.add(source),
    );
    Object.keys(baseTermTranslations[locale]).forEach((source) =>
      baseSources.add(source),
    );
  }
  for (const source of baseSources) {
    rows.set(
      source,
      customerWorkflowLocaleOrder.map(
        (locale) =>
          baseExactTranslations[locale][source] ??
          baseTermTranslations[locale][source] ??
          source,
      ),
    );
  }
  for (const [source, translations] of Object.entries(
    customerRuntimeTranslations,
  )) {
    rows.set(
      source,
      customerWorkflowLocaleOrder.map((locale) => {
        const localeIndex = customerRuntimeLocaleOrder.indexOf(locale);
        return localeIndex >= 0 ? translations[localeIndex] : source;
      }),
    );
  }
  for (const [source, translations] of Object.entries(
    masterExactTranslations,
  )) {
    rows.set(source, translations);
  }
  return rows;
}

const combinedExactRows = buildCombinedExactRows();

function isReviewedPrimaryInvariant(source: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(source);
}

function addDirectExactSources(
  groupName: GeneratedGroupName,
  target: Set<string>,
  sources: ReadonlySet<string>,
) {
  for (const source of sources) {
    if (combinedExactRows.has(source)) {
      target.add(source);
    } else if (!isReviewedPrimaryInvariant(source)) {
      throw new Error(
        `${groupName}: typed primary source has no reviewed translation: ${JSON.stringify(source)}`,
      );
    }
  }
}

function validatedTypedExactFunctionSources(
  groupName: GeneratedGroupName,
  config: GroupConfig,
) {
  const sources = new Set<string>();
  const approvedLocationsBySource = new Map<string, Set<string>>();
  const rememberApprovedLocation = (
    file: string,
    sourceFile: ts.SourceFile,
    node: ts.Node,
    value: string,
  ) => {
    const locations = approvedLocationsBySource.get(value) ?? new Set<string>();
    locations.add(`${file}:${node.getStart(sourceFile)}:${node.end}`);
    approvedLocationsBySource.set(value, locations);
  };
  const transparent = (expression: ts.Expression): ts.Expression => {
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
    return current;
  };
  const staticName = (name: ts.PropertyName) =>
    ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : null;
  const directReturns = (fn: ts.FunctionLikeDeclaration) => {
    const returns: ts.Expression[] = [];
    if (!fn.body) return returns;
    const visit = (node: ts.Node) => {
      if (node !== fn.body && ts.isFunctionLike(node)) return;
      if (ts.isReturnStatement(node) && node.expression) {
        returns.push(node.expression);
        return;
      }
      ts.forEachChild(node, visit);
    };
    visit(fn.body);
    return returns;
  };

  for (const parity of config.typedExactFunctionParity ?? []) {
    for (const file of [parity.providerFile, parity.consumerFile]) {
      if (!config.files.includes(file)) {
        throw new Error(
          `${groupName}: typed exact function parity file is outside the exact source inventory: ${file}`,
        );
      }
    }
    const providerText = readFileSync(
      resolve(process.cwd(), parity.providerFile),
      "utf8",
    );
    const providerSource = parseAuditedSource(
      parity.providerFile,
      providerText,
    );
    const providers = providerSource.statements.filter(
      (statement): statement is ts.FunctionDeclaration =>
        ts.isFunctionDeclaration(statement) &&
        statement.name?.text === parity.providerFunction &&
        Boolean(statement.body),
    );
    if (providers.length !== 1) {
      throw new Error(
        `${groupName}: typed exact provider ${parity.providerFunction} must have one top-level implementation`,
      );
    }
    const provider = providers[0];
    const providerInitializers = new Map<string, ts.Expression>();
    const indexProvider = (node: ts.Node) => {
      if (node !== provider.body && ts.isFunctionLike(node)) return;
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer
      ) {
        providerInitializers.set(node.name.text, node.initializer);
      }
      ts.forEachChild(node, indexProvider);
    };
    indexProvider(provider.body!);
    const resolveSources = (
      expression: ts.Expression,
      seen = new Set<string>(),
    ): Set<string> | null => {
      const candidate = transparent(expression);
      if (
        ts.isStringLiteral(candidate) ||
        ts.isNoSubstitutionTemplateLiteral(candidate)
      ) {
        rememberApprovedLocation(
          parity.providerFile,
          providerSource,
          candidate,
          candidate.text,
        );
        return new Set([candidate.text]);
      }
      if (ts.isIdentifier(candidate)) {
        if (seen.has(candidate.text)) return null;
        const initializer = providerInitializers.get(candidate.text);
        return initializer
          ? resolveSources(initializer, new Set([...seen, candidate.text]))
          : null;
      }
      const branches = ts.isConditionalExpression(candidate)
        ? [candidate.whenTrue, candidate.whenFalse]
        : ts.isBinaryExpression(candidate) &&
            (candidate.operatorToken.kind ===
              ts.SyntaxKind.QuestionQuestionToken ||
              candidate.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
              candidate.operatorToken.kind ===
                ts.SyntaxKind.AmpersandAmpersandToken)
          ? [candidate.left, candidate.right]
          : null;
      if (!branches) return null;
      const resolved = branches.map((branch) =>
        resolveSources(branch, new Set(seen)),
      );
      if (resolved.some((value) => !value)) return null;
      return new Set(resolved.flatMap((value) => [...value!]));
    };
    const returns = directReturns(provider).map(transparent);
    if (
      !returns.length ||
      returns.some((returned) => !ts.isObjectLiteralExpression(returned))
    ) {
      throw new Error(
        `${groupName}: typed exact provider ${parity.providerFunction} must return direct object literals`,
      );
    }
    if (
      (returns as ts.ObjectLiteralExpression[]).some((returned) =>
        returned.properties.some(ts.isSpreadAssignment),
      )
    ) {
      throw new Error(
        `${groupName}: typed exact provider ${parity.providerFunction} return objects cannot contain spread overrides`,
      );
    }
    for (const field of parity.returnFields) {
      for (const returned of returns as ts.ObjectLiteralExpression[]) {
        const properties = returned.properties.filter(
          (property): property is ts.PropertyAssignment =>
            ts.isPropertyAssignment(property) &&
            staticName(property.name) === field,
        );
        const resolved =
          properties.length === 1
            ? resolveSources(properties[0].initializer)
            : null;
        if (!resolved?.size) {
          throw new Error(
            `${groupName}: ${parity.providerFunction}.${field} is not a closed literal source set`,
          );
        }
        resolved.forEach((source) => sources.add(source));
      }
    }
    for (const collection of parity.collections ?? []) {
      const collectionDeclarations: ts.VariableDeclaration[] = [];
      const collectCollectionDeclarations = (node: ts.Node) => {
        if (node !== provider.body && ts.isFunctionLike(node)) return;
        if (
          ts.isVariableDeclaration(node) &&
          ts.isIdentifier(node.name) &&
          node.name.text === collection.providerBinding
        ) {
          collectionDeclarations.push(node);
        }
        ts.forEachChild(node, collectCollectionDeclarations);
      };
      collectCollectionDeclarations(provider.body!);
      if (
        collectionDeclarations.length !== 1 ||
        !collectionDeclarations[0].initializer ||
        !ts.isArrayLiteralExpression(
          transparent(collectionDeclarations[0].initializer),
        ) ||
        (
          transparent(
            collectionDeclarations[0].initializer,
          ) as ts.ArrayLiteralExpression
        ).elements.length !== 0
      ) {
        throw new Error(
          `${groupName}: collection ${collection.providerBinding} must start as one direct empty array`,
        );
      }
      for (const returned of returns as ts.ObjectLiteralExpression[]) {
        const matching = returned.properties.filter((property) => {
          const name = ts.isShorthandPropertyAssignment(property)
            ? property.name.text
            : ts.isPropertyAssignment(property)
              ? staticName(property.name)
              : null;
          if (name !== collection.returnField) return false;
          if (ts.isShorthandPropertyAssignment(property)) {
            return property.name.text === collection.providerBinding;
          }
          if (!ts.isPropertyAssignment(property)) return false;
          const initializer = transparent(property.initializer);
          return (
            ts.isIdentifier(initializer) &&
            initializer.text === collection.providerBinding
          );
        });
        if (matching.length !== 1) {
          throw new Error(
            `${groupName}: ${parity.providerFunction}.${collection.returnField} must return ${collection.providerBinding} directly`,
          );
        }
      }
      let pushedRows = 0;
      let unsafeCollectionUse: string | null = null;
      const allowedCollectionReadMethods = new Set(["some"]);
      const inspectPushes = (node: ts.Node) => {
        if (unsafeCollectionUse) return;
        if (ts.isIdentifier(node) && node.text === collection.providerBinding) {
          const parent = node.parent;
          if (ts.isVariableDeclaration(parent) && parent.name === node) {
            return;
          }
          if (
            ts.isShorthandPropertyAssignment(parent) &&
            parent.name === node &&
            parent.name.text === collection.returnField
          ) {
            return;
          }
          if (
            ts.isPropertyAssignment(parent) &&
            parent.initializer === node &&
            staticName(parent.name) === collection.returnField
          ) {
            return;
          }
          if (
            ts.isPropertyAccessExpression(parent) &&
            parent.expression === node
          ) {
            const member = parent.name.text;
            const call = parent.parent;
            if (
              member === "push" &&
              ts.isCallExpression(call) &&
              call.expression === parent
            ) {
              // Validated below as the only permitted mutation.
            } else if (
              member === "length" ||
              (allowedCollectionReadMethods.has(member) &&
                ts.isCallExpression(call) &&
                call.expression === parent)
            ) {
              return;
            } else {
              unsafeCollectionUse = `${collection.providerBinding}.${member}`;
              return;
            }
          } else {
            unsafeCollectionUse = node.getText(providerSource);
            return;
          }
        }
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          ts.isIdentifier(node.expression.expression) &&
          node.expression.expression.text === collection.providerBinding &&
          node.expression.name.text === "push"
        ) {
          for (const argument of node.arguments) {
            const row = transparent(argument);
            if (
              !ts.isObjectLiteralExpression(row) ||
              row.properties.some(ts.isSpreadAssignment)
            ) {
              throw new Error(
                `${groupName}: ${collection.providerBinding}.push rows must be direct objects`,
              );
            }
            for (const field of collection.fields) {
              const properties = row.properties.filter(
                (property): property is ts.PropertyAssignment =>
                  ts.isPropertyAssignment(property) &&
                  staticName(property.name) === field,
              );
              const resolved =
                properties.length === 1
                  ? resolveSources(properties[0].initializer)
                  : null;
              if (!resolved?.size) {
                throw new Error(
                  `${groupName}: ${collection.providerBinding}.${field} is not a closed literal source set`,
                );
              }
              resolved.forEach((source) => sources.add(source));
            }
            pushedRows += 1;
          }
        }
        ts.forEachChild(node, inspectPushes);
      };
      inspectPushes(provider.body!);
      if (unsafeCollectionUse) {
        throw new Error(
          `${groupName}: collection ${collection.providerBinding} has unauditable alias/write ${unsafeCollectionUse}`,
        );
      }
      if (!pushedRows) {
        throw new Error(
          `${groupName}: ${collection.providerBinding} has no direct pushed rows`,
        );
      }
    }

    const consumerText = readFileSync(
      resolve(process.cwd(), parity.consumerFile),
      "utf8",
    );
    const consumerSource = parseAuditedSource(
      parity.consumerFile,
      consumerText,
    );
    const isUnshadowedConsumerImport =
      createLexicalImportIdentityGuard(consumerSource);
    let providerLocalName: string | null = null;
    const exactTranslatorNames = new Set<string>();
    for (const statement of consumerSource.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier) ||
        !statement.importClause?.namedBindings ||
        !ts.isNamedImports(statement.importClause.namedBindings)
      ) {
        continue;
      }
      const resolved = resolveCustomerWorkflowSourceImport(
        parity.consumerFile,
        statement.moduleSpecifier.text,
      );
      for (const imported of statement.importClause.namedBindings.elements) {
        if (statement.importClause.isTypeOnly || imported.isTypeOnly) continue;
        const importedName = (imported.propertyName ?? imported.name).text;
        if (
          resolved === parity.providerFile &&
          importedName === parity.providerFunction
        ) {
          providerLocalName = imported.name.text;
        }
        if (
          /customer-workflow-.+-translations$/u.test(
            statement.moduleSpecifier.text,
          ) &&
          importedName === "customerWorkflowExactT"
        ) {
          exactTranslatorNames.add(imported.name.text);
        }
      }
    }
    if (!providerLocalName || !exactTranslatorNames.size) {
      throw new Error(
        `${groupName}: typed exact consumer lacks the exact provider/translator imports`,
      );
    }
    const resultDeclarations: ts.VariableDeclaration[] = [];
    const findResult = (node: ts.Node) => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.name.text === parity.resultBinding &&
        node.initializer
      ) {
        const initializer = transparent(node.initializer);
        if (
          ts.isCallExpression(initializer) &&
          ts.isIdentifier(initializer.expression) &&
          initializer.expression.text === providerLocalName &&
          isUnshadowedConsumerImport(initializer.expression)
        ) {
          resultDeclarations.push(node);
        }
      }
      ts.forEachChild(node, findResult);
    };
    findResult(consumerSource);
    if (resultDeclarations.length !== 1) {
      throw new Error(
        `${groupName}: ${parity.resultBinding} must be assigned once from ${parity.providerFunction}`,
      );
    }
    const protectedOwnerFields = new Map<string, readonly string[]>([
      [parity.resultBinding, parity.returnFields],
      ...(parity.collections ?? []).map(
        (collection) =>
          [collection.consumerItemBinding, collection.fields] as const,
      ),
    ]);
    const protectedAccess = (expression: ts.Expression) => {
      const candidate = transparent(expression);
      if (
        !ts.isPropertyAccessExpression(candidate) &&
        !ts.isElementAccessExpression(candidate)
      ) {
        return null;
      }
      const owner = transparent(candidate.expression);
      if (!ts.isIdentifier(owner)) return null;
      const field = ts.isPropertyAccessExpression(candidate)
        ? candidate.name.text
        : candidate.argumentExpression &&
            (ts.isStringLiteral(candidate.argumentExpression) ||
              ts.isNoSubstitutionTemplateLiteral(candidate.argumentExpression))
          ? candidate.argumentExpression.text
          : null;
      return field && protectedOwnerFields.get(owner.text)?.includes(field)
        ? `${owner.text}.${field}`
        : null;
    };
    let unsafeProtectedAlias: string | null = null;
    const inspectProtectedAliases = (node: ts.Node) => {
      if (unsafeProtectedAlias) return;
      if (ts.isElementAccessExpression(node) && protectedAccess(node)) {
        unsafeProtectedAlias = `${protectedAccess(node)} element access`;
        return;
      }
      if (ts.isVariableDeclaration(node) && node.initializer) {
        const initializer = transparent(node.initializer);
        if (
          ts.isIdentifier(initializer) &&
          protectedOwnerFields.has(initializer.text) &&
          (ts.isIdentifier(node.name)
            ? node.name.text !== initializer.text
            : ts.isObjectBindingPattern(node.name))
        ) {
          unsafeProtectedAlias = `${initializer.text} alias/destructure`;
          return;
        }
        const field = protectedAccess(initializer);
        if (field) {
          unsafeProtectedAlias = `${field} alias`;
          return;
        }
      }
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      ) {
        const right = transparent(node.right);
        if (
          (ts.isIdentifier(right) && protectedOwnerFields.has(right.text)) ||
          protectedAccess(right)
        ) {
          unsafeProtectedAlias = `${right.getText(consumerSource)} assignment alias`;
          return;
        }
      }
      ts.forEachChild(node, inspectProtectedAliases);
    };
    inspectProtectedAliases(consumerSource);
    if (unsafeProtectedAlias) {
      throw new Error(
        `${groupName}: typed exact protected value uses an unauditable ${unsafeProtectedAlias}`,
      );
    }
    const provenDirect = new Set<string>();
    const provenCollection = new Map<string, Set<string>>();
    const visibleExactCalls = new Set<ts.CallExpression>();
    const callIsVisible = (call: ts.CallExpression) => {
      let current: ts.Node | undefined = call.parent;
      while (current && !ts.isSourceFile(current)) {
        if (ts.isJsxExpression(current)) return true;
        if (ts.isFunctionLike(current)) return false;
        current = current.parent;
      }
      return false;
    };
    const inspectConsumer = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        exactTranslatorNames.has(node.expression.text) &&
        isUnshadowedConsumerImport(node.expression) &&
        node.arguments[1] &&
        callIsVisible(node)
      ) {
        const source = transparent(node.arguments[1]);
        if (
          ts.isPropertyAccessExpression(source) &&
          ts.isIdentifier(source.expression)
        ) {
          if (source.expression.text === parity.resultBinding) {
            provenDirect.add(source.name.text);
            visibleExactCalls.add(node);
          }
          for (const collection of parity.collections ?? []) {
            if (source.expression.text === collection.consumerItemBinding) {
              let callback: ts.Node | undefined = node.parent;
              while (callback && !ts.isFunctionLike(callback)) {
                callback = callback.parent;
              }
              const mapCall = callback?.parent;
              let mapTarget =
                mapCall &&
                ts.isCallExpression(mapCall) &&
                ts.isPropertyAccessExpression(mapCall.expression) &&
                mapCall.expression.name.text === "map"
                  ? transparent(mapCall.expression.expression)
                  : null;
              while (
                mapTarget &&
                ts.isCallExpression(mapTarget) &&
                ts.isPropertyAccessExpression(mapTarget.expression)
              ) {
                mapTarget = transparent(mapTarget.expression.expression);
              }
              if (
                callback &&
                ts.isFunctionLike(callback) &&
                callback.parameters[0] &&
                ts.isIdentifier(callback.parameters[0].name) &&
                callback.parameters[0].name.text ===
                  collection.consumerItemBinding &&
                mapTarget &&
                ts.isPropertyAccessExpression(mapTarget) &&
                ts.isIdentifier(mapTarget.expression) &&
                mapTarget.expression.text === parity.resultBinding &&
                mapTarget.name.text === collection.returnField
              ) {
                const fields =
                  provenCollection.get(collection.returnField) ?? new Set();
                fields.add(source.name.text);
                provenCollection.set(collection.returnField, fields);
                visibleExactCalls.add(node);
              }
            }
          }
        }
      }
      ts.forEachChild(node, inspectConsumer);
    };
    inspectConsumer(consumerSource);
    for (const field of parity.returnFields) {
      if (!provenDirect.has(field)) {
        throw new Error(
          `${groupName}: ${parity.resultBinding}.${field} does not reach a visible exact translator`,
        );
      }
    }
    for (const collection of parity.collections ?? []) {
      const fields = provenCollection.get(collection.returnField) ?? new Set();
      for (const field of collection.fields) {
        if (!fields.has(field)) {
          throw new Error(
            `${groupName}: ${collection.consumerItemBinding}.${field} does not reach a visible exact translator`,
          );
        }
      }
    }
    let rawFieldUse: string | null = null;
    const propertyIsVisibleRaw = (property: ts.PropertyAccessExpression) => {
      let current: ts.Node | undefined = property.parent;
      while (current && !ts.isSourceFile(current)) {
        if (ts.isCallExpression(current)) {
          return !visibleExactCalls.has(current) && callIsVisible(current);
        }
        if (ts.isJsxExpression(current)) {
          if (
            ts.isJsxAttribute(current.parent) &&
            ts.isIdentifier(current.parent.name)
          ) {
            return new Set([
              "alt",
              "aria-description",
              "aria-label",
              "placeholder",
              "title",
            ]).has(current.parent.name.text);
          }
          return true;
        }
        if (ts.isFunctionLike(current)) return false;
        current = current.parent;
      }
      return false;
    };
    const inspectRawFields = (node: ts.Node) => {
      if (rawFieldUse) return;
      if (ts.isPropertyAccessExpression(node)) {
        const owner = ts.isIdentifier(node.expression)
          ? node.expression.text
          : null;
        const direct =
          owner === parity.resultBinding &&
          parity.returnFields.includes(node.name.text);
        const collection = (parity.collections ?? []).some(
          (entry) =>
            owner === entry.consumerItemBinding &&
            entry.fields.includes(node.name.text),
        );
        if ((direct || collection) && propertyIsVisibleRaw(node)) {
          let current: ts.Node | undefined = node.parent;
          let approved = false;
          while (current && !ts.isSourceFile(current)) {
            if (ts.isCallExpression(current)) {
              approved = visibleExactCalls.has(current);
              break;
            }
            if (ts.isJsxExpression(current)) break;
            current = current.parent;
          }
          if (!approved) rawFieldUse = `${owner}.${node.name.text}`;
        }
      }
      ts.forEachChild(node, inspectRawFields);
    };
    inspectRawFields(consumerSource);
    if (rawFieldUse) {
      throw new Error(
        `${groupName}: typed exact field ${rawFieldUse} also has a raw runtime use`,
      );
    }
  }
  const disqualifiedSources = new Set<string>();
  for (const file of config.files) {
    const sourceText = readFileSync(resolve(process.cwd(), file), "utf8");
    const sourceFile = parseAuditedSource(file, sourceText);
    const isUnshadowedImport = createLexicalImportIdentityGuard(sourceFile);
    const exactTranslatorNames = new Set<string>();
    for (const statement of sourceFile.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier) ||
        !/customer-workflow-.+-translations$/u.test(
          statement.moduleSpecifier.text,
        ) ||
        !statement.importClause?.namedBindings ||
        !ts.isNamedImports(statement.importClause.namedBindings)
      ) {
        continue;
      }
      for (const element of statement.importClause.namedBindings.elements) {
        if (
          !element.isTypeOnly &&
          (element.propertyName ?? element.name).text ===
            "customerWorkflowExactT"
        ) {
          exactTranslatorNames.add(element.name.text);
        }
      }
    }
    const exactTranslatorLiteralLocations = new Set<string>();
    const collectTranslatorLocations = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        exactTranslatorNames.has(node.expression.text) &&
        isUnshadowedImport(node.expression) &&
        node.arguments[1]
      ) {
        const argument = transparent(node.arguments[1]);
        if (
          ts.isStringLiteral(argument) ||
          ts.isNoSubstitutionTemplateLiteral(argument)
        ) {
          exactTranslatorLiteralLocations.add(
            `${file}:${argument.getStart(sourceFile)}:${argument.end}`,
          );
        }
      }
      ts.forEachChild(node, collectTranslatorLocations);
    };
    collectTranslatorLocations(sourceFile);
    const inspectOccurrences = (node: ts.Node) => {
      const value =
        ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isJsxText(node)
          ? normalizeVisibleText(node.text)
          : "";
      if (value && sources.has(value)) {
        const location = `${file}:${node.getStart(sourceFile)}:${node.end}`;
        const approvedProvider = approvedLocationsBySource
          .get(value)
          ?.has(location);
        if (
          !approvedProvider &&
          !exactTranslatorLiteralLocations.has(location)
        ) {
          disqualifiedSources.add(value);
        }
      }
      ts.forEachChild(node, inspectOccurrences);
    };
    inspectOccurrences(sourceFile);
  }
  disqualifiedSources.forEach((source) => sources.delete(source));
  return sources;
}

export function typedPrimaryExactFunctionSources(
  groupName: GeneratedGroupName,
  config: GroupConfig,
) {
  return validatedTypedExactFunctionSources(groupName, config);
}

function addManualExactTransportSourceExclusions(
  groupName: GeneratedGroupName,
  target: Set<string>,
  config: GroupConfig,
) {
  const rawDomTransportConflicts = collectSourceLiterals(
    config.domFiles ?? config.files,
  ).unapprovedExactTransportSources;
  const visibleProperties = new Set([
    "alt",
    "aria-description",
    "aria-label",
    "badge",
    "description",
    "detail",
    "emptyText",
    "emptyTitle",
    "eyebrow",
    "formula",
    "label",
    "message",
    "name",
    "notice",
    "placeholder",
    "shortTitle",
    "statusText",
    "subtitle",
    "text",
    "title",
    "unknownLabel",
    "value",
  ]);
  const staticName = (name: ts.PropertyName) =>
    ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : "";
  const bindingNames = (name: ts.BindingName): string[] =>
    ts.isIdentifier(name)
      ? [name.text]
      : name.elements.flatMap((element) =>
          ts.isOmittedExpression(element) ? [] : bindingNames(element.name),
        );
  const bindingNamesForNode = (node: ts.Node) => {
    let current: ts.Node | undefined = node.parent;
    while (current && !ts.isSourceFile(current)) {
      if (ts.isVariableDeclaration(current)) return bindingNames(current.name);
      current = current.parent;
    }
    return [];
  };
  const hasVisibleAncestor = (node: ts.Node) => {
    let current: ts.Node | undefined = node.parent;
    while (current && !ts.isSourceFile(current)) {
      if (ts.isJsxExpression(current) || ts.isJsxText(node)) return true;
      if (
        ts.isJsxAttribute(current) &&
        ts.isIdentifier(current.name) &&
        visibleProperties.has(current.name.text)
      ) {
        return true;
      }
      if (ts.isPropertyAssignment(current)) {
        return visibleProperties.has(staticName(current.name));
      }
      if (ts.isCallExpression(current)) {
        const name = ts.isIdentifier(current.expression)
          ? current.expression.text
          : ts.isPropertyAccessExpression(current.expression)
            ? current.expression.name.text
            : "";
        return /^set(?:[A-Z][A-Za-z0-9]*)?(?:Error|Feedback|Message|Notice|Status|Success)$/u.test(
          name,
        );
      }
      if (ts.isFunctionLike(current)) return false;
      current = current.parent;
    }
    return false;
  };

  for (const entry of config.manualExactSources ?? []) {
    const runtimeBindings = new Set(entry.runtimeBindings ?? []);
    if (!runtimeBindings.size || rawDomTransportConflicts.has(entry.source)) {
      continue;
    }
    if (
      !hasRuntimeBindingLiteral(entry.source, entry.provenanceFiles, [
        ...runtimeBindings,
      ])
    ) {
      continue;
    }
    let hasUntranslatedVisibleOccurrence = false;
    for (const file of config.domFiles ?? config.files) {
      const sourceText = readFileSync(resolve(process.cwd(), file), "utf8");
      const source = parseAuditedSource(file, sourceText);
      const visit = (node: ts.Node) => {
        if (hasUntranslatedVisibleOccurrence) return;
        const literal =
          ts.isStringLiteral(node) ||
          ts.isNoSubstitutionTemplateLiteral(node) ||
          ts.isJsxText(node)
            ? normalizeVisibleText(node.text)
            : null;
        if (
          literal === normalizeVisibleText(entry.source) &&
          hasVisibleAncestor(node) &&
          !bindingNamesForNode(node).some((binding) =>
            runtimeBindings.has(binding),
          )
        ) {
          hasUntranslatedVisibleOccurrence = true;
          return;
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
      if (hasUntranslatedVisibleOccurrence) break;
    }
    if (!hasUntranslatedVisibleOccurrence) target.add(entry.source);
  }
}

export function manualExactTransportSourceExclusions(
  groupName: GeneratedGroupName,
  config: GroupConfig,
) {
  const sources = new Set<string>();
  addManualExactTransportSourceExclusions(groupName, sources, config);
  return sources;
}

function addTypedTemplateSourceExclusions(
  groupName: GeneratedGroupName,
  target: Set<string>,
  config: GroupConfig,
  literals: ReturnType<typeof collectSourceLiterals>,
) {
  const transparent = (expression: ts.Expression): ts.Expression => {
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
    return current;
  };
  const staticName = (name: ts.PropertyName) =>
    ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : null;
  const findTopLevelBinding = (source: ts.SourceFile, binding: string) => {
    for (const statement of source.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === binding &&
          declaration.initializer
        ) {
          return transparent(declaration.initializer);
        }
      }
    }
    return null;
  };
  const visibleProperties = new Set([
    "alt",
    "aria-description",
    "aria-label",
    "badge",
    "description",
    "detail",
    "emptyText",
    "emptyTitle",
    "eyebrow",
    "label",
    "message",
    "notice",
    "placeholder",
    "shortTitle",
    "statusText",
    "subtitle",
    "text",
    "title",
  ]);
  const callName = (expression: ts.LeftHandSideExpression) =>
    ts.isIdentifier(expression)
      ? expression.text
      : ts.isPropertyAccessExpression(expression)
        ? expression.name.text
        : "";
  const isVisibleCall = (call: ts.CallExpression) => {
    let current: ts.Node | undefined = call.parent;
    while (current && !ts.isSourceFile(current)) {
      if (ts.isJsxExpression(current)) return true;
      if (ts.isPropertyAssignment(current)) {
        return visibleProperties.has(staticName(current.name) ?? "");
      }
      if (ts.isCallExpression(current)) {
        if (
          /^set(?:[A-Z][A-Za-z0-9]*)?(?:Error|Feedback|Message|Notice|Status|Success)$/u.test(
            callName(current.expression),
          )
        ) {
          return true;
        }
      }
      if (ts.isFunctionLike(current)) return false;
      current = current.parent;
    }
    return false;
  };
  type ScopeAnalysis = {
    destructuredFields: Map<string, string>;
    initializers: Map<string, ts.Expression>;
  };
  const scopeInitializers = new Map<ts.Node, ScopeAnalysis>();
  const initializersForScope = (scope: ts.Node) => {
    const cached = scopeInitializers.get(scope);
    if (cached) return cached;
    const initializers = new Map<string, ts.Expression>();
    const destructuredFields = new Map<string, string>();
    const rememberDestructuredFields = (
      name: ts.BindingName,
      inheritedField: string | null = null,
    ) => {
      if (ts.isIdentifier(name)) {
        if (inheritedField) destructuredFields.set(name.text, inheritedField);
        return;
      }
      if (!ts.isObjectBindingPattern(name)) return;
      for (const element of name.elements) {
        if (ts.isOmittedExpression(element)) continue;
        const property = element.propertyName
          ? staticName(element.propertyName)
          : ts.isIdentifier(element.name)
            ? element.name.text
            : null;
        rememberDestructuredFields(element.name, property ?? inheritedField);
      }
    };
    const visit = (node: ts.Node) => {
      if (node !== scope && ts.isFunctionLike(node)) return;
      if (ts.isVariableDeclaration(node)) {
        if (ts.isIdentifier(node.name) && node.initializer) {
          initializers.set(node.name.text, node.initializer);
        } else {
          rememberDestructuredFields(node.name);
        }
      }
      ts.forEachChild(node, visit);
    };
    if (ts.isFunctionLike(scope)) {
      scope.parameters.forEach((parameter) =>
        rememberDestructuredFields(parameter.name),
      );
    }
    visit(scope);
    const analysis = { destructuredFields, initializers };
    scopeInitializers.set(scope, analysis);
    return analysis;
  };
  const nearestScope = (node: ts.Node) => {
    let current: ts.Node | undefined = node.parent;
    while (current && !ts.isSourceFile(current)) {
      if (ts.isFunctionLike(current)) return current;
      current = current.parent;
    }
    return current ?? node.getSourceFile();
  };
  const expressionReadsField = (
    node: ts.Node,
    field: string,
    analysis: ScopeAnalysis,
    helpers: ReadonlyMap<string, ts.FunctionLikeDeclaration>,
    seen = new Set<string>(),
    seenHelpers = new Set<string>(),
  ): boolean => {
    if (ts.isPropertyAccessExpression(node) && node.name.text === field) {
      return true;
    }
    if (
      ts.isElementAccessExpression(node) &&
      node.argumentExpression &&
      (ts.isStringLiteral(node.argumentExpression) ||
        ts.isNoSubstitutionTemplateLiteral(node.argumentExpression)) &&
      node.argumentExpression.text === field
    ) {
      return true;
    }
    if (ts.isIdentifier(node)) {
      if (analysis.destructuredFields.get(node.text) === field) return true;
      if (seen.has(node.text)) return false;
      const initializer = analysis.initializers.get(node.text);
      if (initializer) {
        return expressionReadsField(
          initializer,
          field,
          analysis,
          helpers,
          new Set([...seen, node.text]),
          seenHelpers,
        );
      }
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      !seenHelpers.has(node.expression.text)
    ) {
      const helper = helpers.get(node.expression.text);
      if (helper?.body) {
        const helperAnalysis = initializersForScope(helper);
        const nextHelpers = new Set([...seenHelpers, node.expression.text]);
        const returns: ts.Expression[] = [];
        if (ts.isBlock(helper.body)) {
          const collectReturns = (candidate: ts.Node) => {
            if (candidate !== helper.body && ts.isFunctionLike(candidate)) {
              return;
            }
            if (ts.isReturnStatement(candidate) && candidate.expression) {
              returns.push(candidate.expression);
              return;
            }
            ts.forEachChild(candidate, collectReturns);
          };
          collectReturns(helper.body);
        } else {
          returns.push(helper.body);
        }
        if (
          returns.some((returned) =>
            expressionReadsField(
              returned,
              field,
              helperAnalysis,
              helpers,
              new Set(),
              nextHelpers,
            ),
          )
        ) {
          return true;
        }
      }
    }
    if (ts.isFunctionLike(node)) return false;
    let found = false;
    ts.forEachChild(node, (child) => {
      if (
        !found &&
        expressionReadsField(child, field, analysis, helpers, seen, seenHelpers)
      ) {
        found = true;
      }
    });
    return found;
  };
  const helpersForSource = (source: ts.SourceFile) => {
    const helperCandidates = new Map<string, ts.FunctionLikeDeclaration[]>();
    const indexHelpers = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) && node.name && node.body) {
        const declarations = helperCandidates.get(node.name.text) ?? [];
        declarations.push(node);
        helperCandidates.set(node.name.text, declarations);
      }
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer &&
        (ts.isArrowFunction(node.initializer) ||
          ts.isFunctionExpression(node.initializer))
      ) {
        const declarations = helperCandidates.get(node.name.text) ?? [];
        declarations.push(node.initializer);
        helperCandidates.set(node.name.text, declarations);
      }
      ts.forEachChild(node, indexHelpers);
    };
    indexHelpers(source);
    return new Map(
      [...helperCandidates]
        .filter(([, declarations]) => declarations.length === 1)
        .map(([name, declarations]) => [name, declarations[0]] as const),
    );
  };
  const consumerHasVisibleRawField = (source: ts.SourceFile, field: string) => {
    let raw = false;
    const helpers = helpersForSource(source);
    const inspect = (node: ts.Node) => {
      if (raw) return;
      const scope = nearestScope(node);
      const analysis = initializersForScope(scope);
      if (
        ts.isJsxExpression(node) &&
        node.expression &&
        expressionReadsField(node.expression, field, analysis, helpers)
      ) {
        raw = true;
        return;
      }
      if (
        ts.isPropertyAssignment(node) &&
        visibleProperties.has(staticName(node.name) ?? "") &&
        expressionReadsField(node.initializer, field, analysis, helpers)
      ) {
        raw = true;
        return;
      }
      if (
        ts.isCallExpression(node) &&
        /^set(?:[A-Z][A-Za-z0-9]*)?(?:Error|Feedback|Message|Notice|Status|Success)$/u.test(
          callName(node.expression),
        ) &&
        node.arguments.some((argument) =>
          expressionReadsField(argument, field, analysis, helpers),
        )
      ) {
        raw = true;
        return;
      }
      ts.forEachChild(node, inspect);
    };
    inspect(source);
    return raw;
  };

  const validatedKeys = validatedManualTemplateKeys(groupName, config);
  literals.directTemplateKeys.forEach((key) => validatedKeys.add(key));
  for (const parity of config.typedTemplateDataParity ?? []) {
    if (!config.files.includes(parity.dataFile)) {
      throw new Error(
        `${groupName}: typed template data file is outside the exact source inventory: ${parity.dataFile}`,
      );
    }
    if (!config.files.includes(parity.consumerFile)) {
      throw new Error(
        `${groupName}: typed template consumer is outside the exact source inventory: ${parity.consumerFile}`,
      );
    }
    const dataText = readFileSync(
      resolve(process.cwd(), parity.dataFile),
      "utf8",
    );
    const dataSource = parseAuditedSource(parity.dataFile, dataText);
    const dataBinding = findTopLevelBinding(dataSource, parity.dataBinding);
    if (!dataBinding || !ts.isArrayLiteralExpression(dataBinding)) {
      throw new Error(
        `${groupName}: ${parity.dataBinding} must be a direct object-array for typed template parity`,
      );
    }
    const dataRows = new Map<
      string,
      { source: string; sourceNode: ts.StringLiteralLike }
    >();
    for (const element of dataBinding.elements) {
      const row = transparent(element);
      if (!ts.isObjectLiteralExpression(row)) {
        throw new Error(
          `${groupName}: ${parity.dataBinding} contains a non-object row`,
        );
      }
      let idNode: ts.StringLiteralLike | null = null;
      let sourceNode: ts.StringLiteralLike | null = null;
      for (const property of row.properties) {
        if (!ts.isPropertyAssignment(property)) {
          throw new Error(
            `${groupName}: ${parity.dataBinding} rows cannot use spread, shorthand or dynamic properties`,
          );
        }
        const name = staticName(property.name);
        const value = transparent(property.initializer);
        if (name === parity.idField) {
          if (
            !ts.isStringLiteral(value) &&
            !ts.isNoSubstitutionTemplateLiteral(value)
          ) {
            throw new Error(
              `${groupName}: ${parity.dataBinding}.${parity.idField} must be literal`,
            );
          }
          idNode = value;
        }
        if (name === parity.sourceField) {
          if (
            !ts.isStringLiteral(value) &&
            !ts.isNoSubstitutionTemplateLiteral(value)
          ) {
            throw new Error(
              `${groupName}: ${parity.dataBinding}.${parity.sourceField} must be literal`,
            );
          }
          sourceNode = value;
        }
      }
      if (!idNode || !sourceNode || dataRows.has(idNode.text)) {
        throw new Error(
          `${groupName}: ${parity.dataBinding} requires unique literal ${parity.idField}/${parity.sourceField} rows`,
        );
      }
      dataRows.set(idNode.text, { source: sourceNode.text, sourceNode });
    }

    const consumerText = readFileSync(
      resolve(process.cwd(), parity.consumerFile),
      "utf8",
    );
    const consumerSource = parseAuditedSource(
      parity.consumerFile,
      consumerText,
    );
    const consumerHelpers = helpersForSource(consumerSource);
    const templateTranslatorNames = new Set<string>();
    for (const statement of consumerSource.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier) ||
        !/customer-workflow-.+-translations$/u.test(
          statement.moduleSpecifier.text,
        ) ||
        statement.importClause?.isTypeOnly ||
        !statement.importClause?.namedBindings ||
        !ts.isNamedImports(statement.importClause.namedBindings)
      ) {
        continue;
      }
      for (const element of statement.importClause.namedBindings.elements) {
        if (
          !element.isTypeOnly &&
          (element.propertyName ?? element.name).text === "customerWorkflowT"
        ) {
          templateTranslatorNames.add(element.name.text);
        }
      }
    }
    const consumerLexicalBindings = new Map<ts.Node, Set<string>>();
    const consumerBindingNames = (name: ts.BindingName): string[] =>
      ts.isIdentifier(name)
        ? [name.text]
        : name.elements.flatMap((element) =>
            ts.isOmittedExpression(element)
              ? []
              : consumerBindingNames(element.name),
          );
    const consumerScope = (node: ts.Node) => {
      let current: ts.Node | undefined = node.parent;
      while (current) {
        if (
          ts.isBlock(current) ||
          ts.isFunctionLike(current) ||
          ts.isSourceFile(current) ||
          ts.isCatchClause(current)
        ) {
          return current;
        }
        current = current.parent;
      }
      return consumerSource;
    };
    const rememberConsumerBinding = (scope: ts.Node, name: ts.BindingName) => {
      const bindings = consumerLexicalBindings.get(scope) ?? new Set<string>();
      consumerBindingNames(name).forEach((binding) => bindings.add(binding));
      consumerLexicalBindings.set(scope, bindings);
    };
    const indexConsumerBindings = (node: ts.Node) => {
      if (ts.isParameter(node) && ts.isFunctionLike(node.parent)) {
        rememberConsumerBinding(node.parent, node.name);
      } else if (ts.isVariableDeclaration(node)) {
        rememberConsumerBinding(consumerScope(node), node.name);
      } else if (
        (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) &&
        node.name
      ) {
        rememberConsumerBinding(consumerScope(node), node.name);
      }
      ts.forEachChild(node, indexConsumerBindings);
    };
    indexConsumerBindings(consumerSource);
    const isAuthenticTemplateCall = (call: ts.CallExpression) => {
      if (
        !ts.isIdentifier(call.expression) ||
        !templateTranslatorNames.has(call.expression.text)
      ) {
        return false;
      }
      let current: ts.Node | undefined = call.expression.parent;
      while (current && !ts.isSourceFile(current)) {
        if (consumerLexicalBindings.get(current)?.has(call.expression.text)) {
          return false;
        }
        current = current.parent;
      }
      return !consumerLexicalBindings
        .get(consumerSource)
        ?.has(call.expression.text);
    };
    const keyMapBinding = findTopLevelBinding(
      consumerSource,
      parity.keyMapBinding,
    );
    if (!keyMapBinding || !ts.isObjectLiteralExpression(keyMapBinding)) {
      throw new Error(
        `${groupName}: ${parity.keyMapBinding} must be a direct object map for typed template parity`,
      );
    }
    const keyRows = new Map<string, string>();
    for (const property of keyMapBinding.properties) {
      if (!ts.isPropertyAssignment(property)) {
        throw new Error(
          `${groupName}: ${parity.keyMapBinding} cannot use spread, shorthand or dynamic properties`,
        );
      }
      const id = staticName(property.name);
      const key = transparent(property.initializer);
      if (
        !id ||
        (!ts.isStringLiteral(key) &&
          !ts.isNoSubstitutionTemplateLiteral(key)) ||
        keyRows.has(id)
      ) {
        throw new Error(
          `${groupName}: ${parity.keyMapBinding} requires unique literal id/key rows`,
        );
      }
      keyRows.set(id, key.text);
    }
    if (
      dataRows.size !== keyRows.size ||
      [...dataRows.keys()].some((id) => !keyRows.has(id))
    ) {
      throw new Error(
        `${groupName}: ${parity.dataBinding} and ${parity.keyMapBinding} id sets differ`,
      );
    }
    for (const [id, dataRow] of dataRows) {
      const key = keyRows.get(id)!;
      const templateRow = templateRowsByKey.get(key);
      if (!validatedKeys.has(key) || !templateRow) {
        throw new Error(
          `${groupName}: ${parity.keyMapBinding}.${id} is not a validated template key`,
        );
      }
      if (templateRow[1] !== dataRow.source) {
        throw new Error(
          `${groupName}: ${parity.dataBinding}.${id}.${parity.sourceField} does not match the English source for ${key}`,
        );
      }
    }

    let visibleTypedMapUse = false;
    const findTypedMapUse = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        isAuthenticTemplateCall(node) &&
        node.arguments.length >= 2 &&
        ts.isIdentifier(node.arguments[0]) &&
        node.arguments[0].text === "locale" &&
        isVisibleCall(node)
      ) {
        const keyExpression = transparent(node.arguments[1]);
        if (
          ts.isElementAccessExpression(keyExpression) &&
          ts.isIdentifier(keyExpression.expression) &&
          keyExpression.expression.text === parity.keyMapBinding &&
          keyExpression.argumentExpression
        ) {
          const idExpression = transparent(keyExpression.argumentExpression);
          if (
            expressionReadsField(
              idExpression,
              parity.idField,
              initializersForScope(nearestScope(node)),
              consumerHelpers,
            )
          ) {
            visibleTypedMapUse = true;
          }
        }
      }
      ts.forEachChild(node, findTypedMapUse);
    };
    findTypedMapUse(consumerSource);
    if (!visibleTypedMapUse) {
      throw new Error(
        `${groupName}: ${parity.keyMapBinding} does not reach a visible customerWorkflowT result`,
      );
    }

    if (consumerHasVisibleRawField(consumerSource, parity.sourceField)) {
      continue;
    }
    const allowedLocations = new Set(
      [...dataRows.values()].map(
        ({ sourceNode }) =>
          `${sourceNode.getStart(dataSource)}:${sourceNode.end}`,
      ),
    );
    const hasOtherOccurrence = (sourceValue: string) =>
      config.files.some((file) => {
        const sourceText = readFileSync(resolve(process.cwd(), file), "utf8");
        const sourceFile = parseAuditedSource(file, sourceText);
        let other = false;
        const visit = (node: ts.Node) => {
          if (other) return;
          if (
            (ts.isStringLiteral(node) ||
              ts.isNoSubstitutionTemplateLiteral(node)) &&
            node.text === sourceValue
          ) {
            const allowed =
              file === parity.dataFile &&
              allowedLocations.has(`${node.getStart(sourceFile)}:${node.end}`);
            if (!allowed) {
              other = true;
              return;
            }
          }
          if (ts.isJsxText(node) && node.text.trim() === sourceValue) {
            other = true;
            return;
          }
          ts.forEachChild(node, visit);
        };
        visit(sourceFile);
        return other;
      });
    for (const { source } of dataRows.values()) {
      if (!hasOtherOccurrence(source)) target.add(source);
    }
  }
}

export function typedPrimaryTemplateSourceExclusions(
  groupName: GeneratedGroupName,
  config: GroupConfig,
) {
  const literals = collectSourceLiterals(config.files);
  const sources = new Set<string>();
  addTypedTemplateSourceExclusions(groupName, sources, config, literals);
  return sources;
}

export function customerWorkflowVisibleSourceLiterals(
  files: readonly string[],
) {
  return collectSourceLiterals(files).visible;
}

export function customerWorkflowRawVisibleOccurrenceCounts(
  files: readonly string[],
) {
  return collectSourceLiterals(files).rawVisibleOccurrenceCounts;
}

export function customerWorkflowDomTransportSourceLiterals(
  files: readonly string[],
  provider?: "auth-dom" | "portal-common",
) {
  const literals = collectSourceLiterals(files);
  if (provider === "auth-dom") return literals.authDomTransportSources;
  if (provider === "portal-common") {
    return literals.portalCommonDomTransportSources;
  }
  return new Set([
    ...literals.authDomTransportSources,
    ...literals.portalCommonDomTransportSources,
  ]);
}

export function customerWorkflowPrimaryTransportSourceLiterals(
  files: readonly string[],
) {
  return collectSourceLiterals(files).exactTransportSources;
}

function serialize(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function serializeCompact(value: unknown) {
  return JSON.stringify(value);
}

function helperExports(helper: GroupConfig["helper"]) {
  if (helper === "password") {
    return `\nexport function customerPasswordErrorT(locale: LocaleCode, source: string) {\n  return translateCustomerPasswordError(\n    locale,\n    source,\n    customerWorkflowExactT,\n    customerWorkflowT as CustomerWorkflowTemplateTranslator,\n  );\n}\n`;
  }
  if (helper === "notifications") {
    return `\nexport type { CustomerNotificationI18nInput };\n\nexport function localizeCustomerNotification(\n  locale: LocaleCode,\n  item: CustomerNotificationI18nInput,\n) {\n  return translateCustomerNotification(\n    locale,\n    item,\n    customerWorkflowT as CustomerWorkflowTemplateTranslator,\n  );\n}\n`;
  }
  return "";
}

function runtimeImports(
  helper: GroupConfig["helper"],
  compactExactTranslations: boolean,
) {
  const imports = ["createCustomerWorkflowClientTranslators"];
  if (compactExactTranslations) {
    imports.push("inflateCustomerWorkflowExactTranslations");
  }
  if (helper === "password") {
    imports.push("translateCustomerPasswordError");
  }
  if (helper === "notifications") {
    imports.push("translateCustomerNotification");
  }
  return imports;
}

export function generateCustomerWorkflowClientModule(
  groupName: GeneratedGroupName,
  config: GroupConfig,
) {
  const compactExactTranslations =
    groupName === "request" ||
    groupName === "auth" ||
    groupName === "overview" ||
    groupName === "credits";
  const literals = collectSourceLiterals(config.files);
  const manualExactSources = validatedManualExactSources(groupName, config);
  const directExactSources = new Set(manualExactSources.keys());
  addDirectExactSources(groupName, directExactSources, literals.directExact);
  addDirectExactSources(
    groupName,
    directExactSources,
    validatedTypedExactFunctionSources(groupName, config),
  );
  if (config.includeMasterLiteralExact) {
    const reviewedPrimaryBaseline = readGeneratedExactSourceBaseline(
      generatedPrimaryPath(groupName),
    );
    for (const source of reviewedPrimaryBaseline) {
      if (
        Object.prototype.hasOwnProperty.call(masterExactTranslations, source) &&
        (literals.directExact.has(source) ||
          literals.directExact.has(normalizeVisibleText(source)))
      ) {
        directExactSources.add(source);
      }
    }
  }
  const exactEntries = [...directExactSources]
    .map((source) => {
      const manual = manualExactSources.get(source);
      const translations =
        manual?.translations ?? combinedExactRows.get(source);
      if (!translations) {
        throw new Error(
          `${groupName}: unknown exact source ${JSON.stringify(source)}`,
        );
      }
      return [source, translations] as const;
    })
    .sort(([left], [right]) => left.localeCompare(right, "en"));
  const templateKeys = validatedManualTemplateKeys(groupName, config);
  literals.directTemplateKeys.forEach((key) => templateKeys.add(key));
  const templateRows = [...templateKeys]
    .sort((left, right) => left.localeCompare(right, "en"))
    .map((key) => {
      const row = templateRowsByKey.get(key);
      if (!row) throw new Error(`${groupName}: unknown template key ${key}`);
      return row;
    });
  const exactObject = Object.fromEntries(exactEntries);
  const imports = runtimeImports(config.helper, compactExactTranslations);
  if (groupName === "auth") imports.push("customerWorkflowClientLocaleOrder");
  const typeImports = [
    ...(config.helper === "notifications"
      ? ["CustomerNotificationI18nInput"]
      : []),
    ...(config.helper ? ["CustomerWorkflowTemplateTranslator"] : []),
  ];
  const exportsSourceStrings =
    groupName === "request" ||
    groupName === "orders" ||
    groupName === "private-metadata";

  const groupSerialize = compactExactTranslations
    ? serializeCompact
    : serialize;
  const exactDeclaration = compactExactTranslations
    ? `const customerWorkflowExactSources = ${serializeCompact(
        exactEntries.map(([source]) => source),
      )} as const;
const customerWorkflowExactTranslationColumns = ${serializeCompact(
        customerWorkflowLocaleOrder.map((_, localeIndex) =>
          exactEntries.map(([, translations]) => translations[localeIndex]),
        ),
      )} as const;

export const customerWorkflowExactTranslations = inflateCustomerWorkflowExactTranslations(
  customerWorkflowExactSources,
  customerWorkflowExactTranslationColumns,
);`
    : `export const customerWorkflowExactTranslations = ${serialize(exactObject)} as const satisfies Readonly<Record<string, readonly string[]>>;`;

  return `// This file is generated by scripts/generate-customer-workflow-client-translations.ts.\n// Edit the master catalog or group source inventory, then regenerate it.\n\nimport type { LocaleCode } from "@/lib/i18nConfig";\nimport {\n  ${imports.join(",\n  ")},\n} from "@/lib/i18n/customer-workflow-client-runtime";${
    typeImports.length
      ? `\nimport type {\n  ${typeImports.join(",\n  ")},\n} from "@/lib/i18n/customer-workflow-client-runtime";`
      : ""
  }\n\nexport const customerWorkflowLocaleOrder = ${groupName === "auth" ? "customerWorkflowClientLocaleOrder" : `${groupSerialize(customerWorkflowLocaleOrder)} as const`} satisfies readonly Exclude<LocaleCode, "en">[];\n\n${exactDeclaration}${
    exportsSourceStrings
      ? "\n\nexport const customerWorkflowSourceStrings = Object.keys(customerWorkflowExactTranslations);"
      : ""
  }\n\nexport const customerWorkflowTemplateRows = ${groupSerialize(templateRows)} as const;\n\nexport type CustomerWorkflowTranslationKey = (typeof customerWorkflowTemplateRows)[number][0];\n\nconst translators = createCustomerWorkflowClientTranslators(\n  customerWorkflowExactTranslations,\n  customerWorkflowTemplateRows,\n);\n\nexport function customerWorkflowExactT(locale: LocaleCode, source: string) {\n  return translators.exactT(locale, source);\n}\n\nexport function customerWorkflowT(\n  locale: LocaleCode,\n  key: CustomerWorkflowTranslationKey,\n  values: Record<string, string | number> = {},\n) {\n  return translators.t(locale, key, values);\n}\n${helperExports(config.helper)}`;
}

function generateCustomerWorkflowDomModule(
  label: string,
  config: GroupConfig,
  baselineGroup: LegacyDomGroup,
  excludedSources: ReadonlySet<string> = new Set(),
  primaryContent?: string,
) {
  const literals = collectSourceLiterals(config.domFiles ?? config.files);
  const typedDomTransportSources =
    baselineGroup === "auth"
      ? literals.authDomTransportSources
      : baselineGroup === "portal-common"
        ? literals.portalCommonDomTransportSources
        : new Set<string>();
  const exactEntries = [...combinedExactRows.entries()]
    .filter(
      ([source]) =>
        !excludedSources.has(source) &&
        (literals.visible.has(source) ||
          typedDomTransportSources.has(source) ||
          literals.visible.has(normalizeVisibleText(source))),
    )
    .sort(([left], [right]) => left.localeCompare(right, "en"));
  assertLegacyDomObserverShrinkOnly(
    label,
    new Set(exactEntries.map(([source]) => source)),
    new Set(customerWorkflowLegacyDomObserverCeiling[baselineGroup]),
    new Set(customerWorkflowLegacyDomObserverTombstones[baselineGroup]),
  );
  const reviewedOccurrenceSources = new Set(
    customerWorkflowLegacyDomObserverCeiling[
      baselineGroup
    ] as readonly string[],
  );
  assertLegacyDomObserverOccurrenceShrinkOnly(
    label,
    new Map(
      [...literals.rawVisibleOccurrenceCounts].filter(([source]) =>
        reviewedOccurrenceSources.has(source),
      ),
    ),
    customerWorkflowLegacyDomObserverCeiling[baselineGroup],
    customerWorkflowLegacyDomObserverOccurrenceCeiling[baselineGroup],
  );
  const exactObject = Object.fromEntries(exactEntries);
  // Preserve every observer key, but do not download identical primary auth
  // translations twice. Only share rows with exactly equal values in all locales.
  const primarySources =
    label === "auth" && primaryContent
      ? generatedExactSourceKeys("auth-primary.ts", primaryContent)
      : new Set<string>();
  const primaryManualRows =
    label === "auth"
      ? validatedManualExactSources("auth", config)
      : new Map<string, { translations: readonly string[] }>();
  const sharedEntries = exactEntries.filter(([source, translations]) => {
    if (!primarySources.has(source)) return false;
    const primaryValues =
      primaryManualRows.get(source)?.translations ?? combinedExactRows.get(source);
    return (
      primaryValues?.length === translations.length &&
      translations.every((value, index) => primaryValues[index] === value)
    );
  });
  const sharedSources = new Set(sharedEntries.map(([source]) => source));
  const storedEntries = exactEntries.filter(
    ([source]) => !sharedSources.has(source),
  );
  const compactExactTranslations = label === "auth" || label === "request";
  const exactDeclaration = compactExactTranslations
    ? `const customerWorkflowExactSources = ${serializeCompact(
        storedEntries.map(([source]) => source),
      )} as const;
const customerWorkflowExactTranslationColumns = ${serializeCompact(
        customerWorkflowLocaleOrder.map((_, localeIndex) =>
          storedEntries.map(([, translations]) => translations[localeIndex]),
        ),
      )} as const;

export const customerWorkflowExactTranslations${sharedEntries.length ? ": Readonly<Record<string, readonly string[]>>" : ""} = ${sharedEntries.length ? "{ ..." : ""}inflateCustomerWorkflowExactTranslations(
  customerWorkflowExactSources,
  customerWorkflowExactTranslationColumns,
)${sharedEntries.length ? `,\n${sharedEntries.map(([source]) => `${JSON.stringify(source)}: primaryExactTranslations[${JSON.stringify(source)}]`).join(",\n")}\n}` : ""};`
    : `export const customerWorkflowExactTranslations = ${serialize(exactObject)} as const satisfies Readonly<Record<string, readonly string[]>>;`;
  return `// This file is generated by scripts/generate-customer-workflow-client-translations.ts.\n// It contains only DOM-observer copy for the ${label} surface.\n\nimport type { LocaleCode } from "@/lib/i18nConfig";${
    compactExactTranslations
      ? `\nimport { inflateCustomerWorkflowExactTranslations } from "@/lib/i18n/customer-workflow-client-runtime";${sharedEntries.length ? '\nimport { customerWorkflowExactTranslations as primaryExactTranslations } from "@/lib/i18n/customer-workflow-auth-translations";' : ""}`
      : ""
  }\n\nexport const customerWorkflowLocaleOrder = ${compactExactTranslations ? serializeCompact(customerWorkflowLocaleOrder) : serialize(customerWorkflowLocaleOrder)} as const satisfies readonly Exclude<LocaleCode, "en">[];\n\n${exactDeclaration}\n`;
}

function generatedPrimaryPath(groupName: GeneratedGroupName) {
  return resolve(
    process.cwd(),
    "src/lib/i18n",
    `customer-workflow-${groupName}-translations.ts`,
  );
}

function readGeneratedExactSourceBaseline(file: string) {
  if (!existsSync(file)) return new Set<string>();
  const sourceText = readFileSync(file, "utf8");
  return generatedExactSourceKeys(file, sourceText);
}

function generatedExactSourceKeys(file: string, sourceText: string) {
  const source = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const keys = new Set<string>();
  source.statements.forEach((statement) => {
    if (!ts.isVariableStatement(statement)) return;
    statement.declarationList.declarations.forEach((declaration) => {
      if (
        !ts.isIdentifier(declaration.name) ||
        (declaration.name.text !== "customerWorkflowExactTranslations" &&
          declaration.name.text !== "customerWorkflowExactSources")
      ) {
        return;
      }
      let initializer = declaration.initializer;
      while (
        initializer &&
        (ts.isAsExpression(initializer) ||
          ts.isSatisfiesExpression(initializer) ||
          ts.isParenthesizedExpression(initializer))
      ) {
        initializer = initializer.expression;
      }
      if (!initializer) return;
      if (ts.isObjectLiteralExpression(initializer)) {
        initializer.properties.forEach((property) => {
          if (!ts.isPropertyAssignment(property)) return;
          if (
            ts.isStringLiteral(property.name) ||
            ts.isNoSubstitutionTemplateLiteral(property.name) ||
            ts.isIdentifier(property.name)
          ) {
            keys.add(property.name.text);
          }
        });
      } else if (ts.isArrayLiteralExpression(initializer)) {
        initializer.elements.forEach((element) => {
          if (
            ts.isStringLiteral(element) ||
            ts.isNoSubstitutionTemplateLiteral(element)
          ) {
            keys.add(element.text);
          }
        });
      }
    });
  });
  return keys;
}

export function assertLegacyDomObserverShrinkOnly(
  label: string,
  nextSources: ReadonlySet<string>,
  reviewedCeiling: ReadonlySet<string>,
  tombstones: ReadonlySet<string> = new Set(),
) {
  const invalidTombstones = [...tombstones].filter(
    (source) => !reviewedCeiling.has(source),
  );
  if (invalidTombstones.length) {
    throw new Error(
      `${label}: DOM observer tombstones are outside the reviewed ceiling:\n` +
        invalidTombstones
          .map((source) => `- ${JSON.stringify(source)}`)
          .join("\n"),
    );
  }
  const additions = [...nextSources]
    .filter((source) => !reviewedCeiling.has(source) || tombstones.has(source))
    .sort((left, right) => left.localeCompare(right, "en"));
  if (additions.length) {
    throw new Error(
      `${label}: new raw visible DOM copy cannot grow the legacy observer baseline:\n` +
        `${additions.map((source) => `- ${JSON.stringify(source)}`).join("\n")}\n` +
        "Render new copy through the route's typed primary translator instead.",
    );
  }
  const stale = [...reviewedCeiling]
    .filter((source) => !tombstones.has(source) && !nextSources.has(source))
    .sort((left, right) => left.localeCompare(right, "en"));
  if (stale.length) {
    throw new Error(
      `${label}: removed legacy DOM copy must be recorded as a tombstone:\n` +
        `${stale.map((source) => `- ${JSON.stringify(source)}`).join("\n")}\n` +
        "Add only these removed sources to the tombstone list; never grow the ceiling.",
    );
  }
}

function stableBaselineDigest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function assertReviewedLegacyDomBaselineDigest(
  label: string,
  value: unknown,
  expectedDigest: string,
) {
  if (stableBaselineDigest(value) !== expectedDigest) {
    throw new Error(
      `legacy DOM observer ${label} baseline does not match its immutable reviewed digest`,
    );
  }
}

export function assertLegacyDomObserverTombstoneFloor(
  label: string,
  reviewedFloor: readonly string[],
  tombstones: readonly string[],
) {
  const current = new Set(tombstones);
  const removedFloor = reviewedFloor.filter((source) => !current.has(source));
  if (removedFloor.length) {
    throw new Error(
      `${label}: reviewed DOM observer tombstones cannot be removed:\n${removedFloor
        .map((source) => `- ${JSON.stringify(source)}`)
        .join("\n")}`,
    );
  }
}

export function assertLegacyDomObserverBaselineIntegrity() {
  for (const key of Object.keys(reviewedLegacyDomBaselineDigests) as Array<
    keyof typeof reviewedLegacyDomBaselineDigests
  >) {
    assertReviewedLegacyDomBaselineDigest(
      key,
      key === "ceiling"
        ? customerWorkflowLegacyDomObserverCeiling
        : key === "occurrence"
          ? customerWorkflowLegacyDomObserverOccurrenceCeiling
          : customerWorkflowLegacyDomObserverReviewedTombstoneFloor,
      reviewedLegacyDomBaselineDigests[key],
    );
  }

  for (const group of Object.keys(
    customerWorkflowLegacyDomObserverCeiling,
  ) as LegacyDomGroup[]) {
    const ceiling = customerWorkflowLegacyDomObserverCeiling[group];
    const encodedOccurrences =
      customerWorkflowLegacyDomObserverOccurrenceCeiling[group];
    if (encodedOccurrences.length !== ceiling.length) {
      throw new Error(
        `${group}: raw DOM occurrence ceiling must align one-to-one with the reviewed source ceiling`,
      );
    }
    assertLegacyDomObserverTombstoneFloor(
      group,
      customerWorkflowLegacyDomObserverReviewedTombstoneFloor[
        group
      ] as readonly string[],
      customerWorkflowLegacyDomObserverTombstones[group] as readonly string[],
    );
  }
}

export function assertLegacyDomObserverOccurrenceShrinkOnly(
  label: string,
  nextOccurrences: ReadonlyMap<string, number>,
  reviewedCeiling: readonly string[],
  encodedOccurrenceCeiling: string,
) {
  if (encodedOccurrenceCeiling.length !== reviewedCeiling.length) {
    throw new Error(
      `${label}: raw DOM occurrence ceiling is not aligned with its reviewed sources`,
    );
  }
  const allowed = new Map(
    reviewedCeiling.map((source, index) => {
      const count = Number.parseInt(encodedOccurrenceCeiling[index], 36);
      if (!Number.isSafeInteger(count) || count < 0) {
        throw new Error(
          `${label}: raw DOM occurrence ceiling contains an invalid count`,
        );
      }
      return [source, count] as const;
    }),
  );
  const growth = [...nextOccurrences]
    .filter(([source, count]) => count > (allowed.get(source) ?? 0))
    .sort(([left], [right]) => left.localeCompare(right, "en"));
  if (growth.length) {
    throw new Error(
      `${label}: raw visible DOM occurrences cannot grow the reviewed legacy baseline:\n${growth
        .map(
          ([source, count]) =>
            `- ${JSON.stringify(source)}: ${count} > ${allowed.get(source) ?? 0}`,
        )
        .join(
          "\n",
        )}\nRender new copy through the route's typed primary translator instead.`,
    );
  }
}

function createReachableModuleLoadCollector(source: ts.SourceFile) {
  type LocalCallable = {
    body: ts.ConciseBody;
    name: string;
  };

  const callables = new Map<string, LocalCallable[]>();
  const aliases = new Map<string, Set<string>>();
  const localObjects = new Set<string>();
  const localBindings = new Set<string>();
  const rememberCallable = (name: string, body: ts.ConciseBody) => {
    const declarations = callables.get(name) ?? [];
    declarations.push({ body, name });
    callables.set(name, declarations);
  };
  const rememberAlias = (name: string, target: string) => {
    const targets = aliases.get(name) ?? new Set<string>();
    targets.add(target);
    aliases.set(name, targets);
  };
  const staticMemberName = (expression: ts.Expression): string | null => {
    const candidate = expression;
    if (ts.isIdentifier(candidate)) return candidate.text;
    if (ts.isPropertyAccessExpression(candidate)) {
      const owner = staticMemberName(candidate.expression);
      return owner ? `${owner}.${candidate.name.text}` : null;
    }
    if (
      ts.isElementAccessExpression(candidate) &&
      candidate.argumentExpression &&
      (ts.isStringLiteral(candidate.argumentExpression) ||
        ts.isNoSubstitutionTemplateLiteral(candidate.argumentExpression))
    ) {
      const owner = staticMemberName(candidate.expression);
      return owner ? `${owner}.${candidate.argumentExpression.text}` : null;
    }
    return null;
  };
  const staticPropertyName = (name: ts.PropertyName) =>
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNoSubstitutionTemplateLiteral(name) ||
    ts.isNumericLiteral(name)
      ? name.text
      : null;
  const transparentInitializer = (expression: ts.Expression): ts.Expression => {
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
    return current;
  };
  const indexAssignedValue = (name: string, value: ts.Expression) => {
    const candidate = transparentInitializer(value);
    if (ts.isArrowFunction(candidate) || ts.isFunctionExpression(candidate)) {
      rememberCallable(name, candidate.body);
      return;
    }
    if (ts.isConditionalExpression(candidate)) {
      indexAssignedValue(name, candidate.whenTrue);
      indexAssignedValue(name, candidate.whenFalse);
      return;
    }
    if (
      ts.isBinaryExpression(candidate) &&
      (candidate.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
        candidate.operatorToken.kind ===
          ts.SyntaxKind.AmpersandAmpersandToken ||
        candidate.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)
    ) {
      indexAssignedValue(name, candidate.left);
      indexAssignedValue(name, candidate.right);
      return;
    }
    const aliasTarget = staticMemberName(candidate);
    if (aliasTarget) rememberAlias(name, aliasTarget);
    if (!ts.isObjectLiteralExpression(candidate)) return;
    localObjects.add(name);
    for (const property of candidate.properties) {
      if (ts.isSpreadAssignment(property)) continue;
      const propertyName = staticPropertyName(property.name);
      if (!propertyName) continue;
      const memberName = `${name}.${propertyName}`;
      if (ts.isMethodDeclaration(property) && property.body) {
        rememberCallable(memberName, property.body);
      } else if (ts.isPropertyAssignment(property)) {
        indexAssignedValue(memberName, property.initializer);
      } else if (ts.isShorthandPropertyAssignment(property)) {
        rememberAlias(memberName, property.name.text);
      }
    }
  };
  const indexLocalCallables = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      localBindings.add(node.name.text);
      rememberCallable(node.name.text, node.body);
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      localBindings.add(node.name.text);
      if (node.initializer)
        indexAssignedValue(node.name.text, node.initializer);
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken
    ) {
      const assignedName = staticMemberName(node.left);
      if (assignedName) {
        const rootName = assignedName.split(".", 1)[0];
        if (localBindings.has(rootName)) {
          if (assignedName.includes(".")) localObjects.add(rootName);
          indexAssignedValue(assignedName, node.right);
        }
      }
    }
    if (ts.isClassDeclaration(node) && node.name) {
      localBindings.add(node.name.text);
      localObjects.add(node.name.text);
      for (const member of node.members) {
        if (!ts.isMethodDeclaration(member) || !member.body) continue;
        const memberName = staticPropertyName(member.name);
        if (memberName) {
          rememberCallable(`${node.name.text}.${memberName}`, member.body);
        }
      }
    }
    ts.forEachChild(node, indexLocalCallables);
  };
  indexLocalCallables(source);

  const forbiddenModuleNames = new Set([
    "customer-workflow-dom-observer-baseline",
    "customer-workflow-surface-manifest",
    "customer-workflow-translations",
  ]);
  const moduleStem = (specifier: string) => {
    const normalized = specifier.replace(/\\/gu, "/");
    const lastSegment = normalized.split("/").at(-1) ?? normalized;
    return lastSegment.replace(/\.(?:c|m)?(?:js|jsx|ts|tsx)$/u, "");
  };
  const literalModuleSpecifier = (node: ts.Node | undefined) =>
    node &&
    (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
      ? node.text
      : null;
  const transparentCallee = (expression: ts.Expression): ts.Expression => {
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
    return current;
  };

  const resolveCallable = (
    name: string,
    errors: string[],
    seen = new Set<string>(),
  ): LocalCallable | null => {
    if (seen.has(name)) {
      errors.push(`cyclic local helper alias ${JSON.stringify(name)}`);
      return null;
    }
    const declarations = callables.get(name) ?? [];
    if (declarations.length > 1) {
      errors.push(`ambiguous local helper ${JSON.stringify(name)}`);
      return null;
    }
    if (declarations.length === 1) return declarations[0];
    const targets = aliases.get(name);
    if (!targets) return null;
    if (targets.size !== 1) {
      errors.push(`ambiguous local helper alias ${JSON.stringify(name)}`);
      return null;
    }
    const nextSeen = new Set(seen);
    nextSeen.add(name);
    return resolveCallable([...targets][0], errors, nextSeen);
  };

  return (root: ts.Node, label: string) => {
    const specifiers: string[] = [];
    const errors: string[] = [];
    const visitedCallables = new Set<ts.ConciseBody>();

    const rememberModuleLoad = (
      kind: "import()" | "require()",
      argument: ts.Node | undefined,
    ) => {
      const specifier = literalModuleSpecifier(argument);
      if (specifier === null) {
        errors.push(`${label}: non-literal ${kind} expression`);
        return;
      }
      specifiers.push(specifier);
      if (forbiddenModuleNames.has(moduleStem(specifier))) {
        errors.push(
          `${label}: forbidden full/audit catalog load ${JSON.stringify(specifier)}`,
        );
      }
    };

    const visitCallable = (callable: LocalCallable) => {
      if (visitedCallables.has(callable.body)) return;
      visitedCallables.add(callable.body);
      visit(callable.body);
    };
    const visitCallableReference = (expression: ts.Expression) => {
      const candidate = transparentCallee(expression);
      const callableName = staticMemberName(candidate);
      if (!callableName) return;
      const callable = resolveCallable(callableName, errors);
      if (callable) visitCallable(callable);
    };
    const visit = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node)) return;
      if (
        ts.isVariableDeclaration(node) &&
        node.initializer &&
        (ts.isArrowFunction(node.initializer) ||
          ts.isFunctionExpression(node.initializer))
      ) {
        return;
      }
      if (ts.isCallExpression(node)) {
        const callee = transparentCallee(node.expression);
        if (callee.kind === ts.SyntaxKind.ImportKeyword) {
          rememberModuleLoad("import()", node.arguments[0]);
          node.arguments.slice(1).forEach(visit);
          return;
        }
        if (ts.isIdentifier(callee) && callee.text === "require") {
          rememberModuleLoad("require()", node.arguments[0]);
          node.arguments.slice(1).forEach(visit);
          return;
        }
        const callableName = staticMemberName(callee);
        if (callableName) {
          const callable = resolveCallable(callableName, errors);
          if (callable) visitCallable(callable);
          else {
            const rootName = callableName.split(".", 1)[0];
            if (localObjects.has(rootName)) {
              errors.push(
                `${label}: unresolved local callable ${JSON.stringify(callableName)}`,
              );
            }
          }
        } else if (
          ts.isArrowFunction(callee) ||
          ts.isFunctionExpression(callee)
        ) {
          visit(callee.body);
        } else if (
          ts.isElementAccessExpression(callee) &&
          ts.isIdentifier(callee.expression) &&
          localObjects.has(callee.expression.text)
        ) {
          errors.push(
            `${label}: non-literal local callable member on ${JSON.stringify(callee.expression.text)}`,
          );
        } else if (ts.isCallExpression(callee)) {
          // A callable factory is itself reachable from this branch. Traverse
          // the nested callee so a returned closure cannot hide import().
          visit(callee);
        }
        node.arguments.forEach((argument) => {
          if (
            ts.isArrowFunction(argument) ||
            ts.isFunctionExpression(argument)
          ) {
            visit(argument.body);
          } else {
            visitCallableReference(argument);
            visit(argument);
          }
        });
        return;
      }
      ts.forEachChild(node, visit);
    };

    visit(root);
    return { errors, specifiers };
  };
}

function assertClientDependencyGraphIsCompact(entryFiles: readonly string[]) {
  const forbidden = new Set([
    "src/lib/i18n/customer-workflow-dom-observer-baseline.ts",
    "src/lib/i18n/customer-workflow-surface-manifest.ts",
    "src/lib/i18n/customer-workflow-translations.ts",
  ]);
  const pending = [...entryFiles];
  const visited = new Set<string>();
  const errors: string[] = [];
  while (pending.length) {
    const current = pending.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);
    if (forbidden.has(current)) {
      errors.push(`${entryFiles.join(", ")} -> ${current}`);
      continue;
    }
    for (const imported of customerWorkflowSourceImports(current)) {
      if (imported.specifier === "<dynamic>") {
        errors.push(`${current}: non-literal dynamic import`);
      } else if (imported.resolved?.startsWith("src/")) {
        pending.push(imported.resolved);
      }
    }
  }
  if (errors.length) {
    throw new Error(
      `Compact customer workflow dependency graph is not isolated:\n${errors.join("\n")}`,
    );
  }
}

export function validateLanguageSwitcherCompactImports(
  sourceTextOverride?: string,
) {
  const switcherFile = "src/components/LanguageSwitcher.tsx";
  const sourceText = sourceTextOverride ?? readFileSync(switcherFile, "utf8");
  const source = parseAuditedSource(switcherFile, sourceText);
  const reachableModuleLoads = createReachableModuleLoadCollector(source);
  let loader: ts.FunctionDeclaration | null = null;
  for (const statement of source.statements) {
    if (
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === "loadCompactCustomerWorkflowCatalog"
    ) {
      loader = statement;
    }
  }
  const loaderBody = loader?.body;
  if (!loaderBody) {
    throw new Error(
      "LanguageSwitcher: loadCompactCustomerWorkflowCatalog is missing",
    );
  }
  const groupSwitches: ts.SwitchStatement[] = [];
  const findSwitches = (node: ts.Node) => {
    if (
      ts.isSwitchStatement(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "group"
    ) {
      groupSwitches.push(node);
    }
    ts.forEachChild(node, findSwitches);
  };
  findSwitches(loaderBody);
  if (groupSwitches.length !== 1) {
    throw new Error(
      `LanguageSwitcher: expected exactly one compact switch on group; found ${groupSwitches.length}`,
    );
  }
  const groupSwitch = groupSwitches[0];

  const seenGroups = new Set<string>();
  const branchEntries: string[] = [];
  const expectedLoaderImports: string[] = [];
  for (const clause of groupSwitch.caseBlock.clauses) {
    if (!ts.isCaseClause(clause) || !ts.isStringLiteral(clause.expression)) {
      throw new Error(
        "LanguageSwitcher: compact switch requires literal case labels",
      );
    }
    const group = clause.expression.text;
    const surface =
      customerWorkflowClientSurfaceManifest[
        group as keyof typeof customerWorkflowClientSurfaceManifest
      ];
    if (!surface) {
      throw new Error(
        `LanguageSwitcher: unknown compact catalog case ${group}`,
      );
    }
    if (seenGroups.has(group)) {
      throw new Error(
        `LanguageSwitcher: duplicate compact catalog case ${group}`,
      );
    }
    seenGroups.add(group);
    const imports = reachableModuleLoads(clause, `LanguageSwitcher/${group}`);
    if (imports.errors.length) {
      throw new Error(imports.errors.join("\n"));
    }
    const actual = [...imports.specifiers].sort();
    const expected = [...surface.languageSwitcherCatalogs]
      .map((catalog) => `@/lib/i18n/${catalog}`)
      .sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(
        `LanguageSwitcher/${group}: compact imports disagree with manifest\n` +
          `expected ${expected.join(", ")}\nactual ${actual.join(", ")}`,
      );
    }
    expectedLoaderImports.push(...expected);
    for (const specifier of actual) {
      const resolved = customerWorkflowSourceImports(switcherFile).find(
        (item) => item.dynamic && item.specifier === specifier,
      )?.resolved;
      if (!resolved) {
        throw new Error(
          `LanguageSwitcher/${group}: compact import does not resolve: ${specifier}`,
        );
      }
      branchEntries.push(resolved);
    }
  }
  const expectedGroups = Object.keys(customerWorkflowClientSurfaceManifest);
  const missingGroups = expectedGroups.filter(
    (group) => !seenGroups.has(group),
  );
  if (missingGroups.length) {
    throw new Error(
      `LanguageSwitcher: compact switch omits ${missingGroups.join(", ")}`,
    );
  }

  const loaderImports = reachableModuleLoads(loaderBody, "LanguageSwitcher");
  if (loaderImports.errors.length) {
    throw new Error(loaderImports.errors.join("\n"));
  }
  const metadataSpecifier =
    "@/lib/i18n/customer-workflow-private-metadata-translations";
  if (
    loaderImports.specifiers.filter((item) => item === metadataSpecifier)
      .length !== 1
  ) {
    throw new Error(
      "LanguageSwitcher: dashboard private metadata catalog must be imported exactly once",
    );
  }
  expectedLoaderImports.push(metadataSpecifier);
  const actualLoaderImports = [...loaderImports.specifiers].sort();
  const exactLoaderImports = [...expectedLoaderImports].sort();
  if (
    JSON.stringify(actualLoaderImports) !== JSON.stringify(exactLoaderImports)
  ) {
    throw new Error(
      "LanguageSwitcher: loader-wide dynamic imports disagree with the compact manifest\n" +
        `expected ${exactLoaderImports.join(", ")}\n` +
        `actual ${actualLoaderImports.join(", ")}`,
    );
  }
  let metadataGuarded = false;
  const findMetadataGuard = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length > 0 &&
      (ts.isStringLiteral(node.arguments[0]) ||
        ts.isNoSubstitutionTemplateLiteral(node.arguments[0])) &&
      node.arguments[0].text === metadataSpecifier
    ) {
      let current: ts.Node | undefined = node.parent;
      while (current && current !== loaderBody) {
        if (ts.isIfStatement(current)) {
          const guard = current.expression.getText(source);
          if (
            /^pathname\.startsWith\((?:"|')\/dashboard(?:"|')\)$/u.test(guard)
          ) {
            metadataGuarded = true;
          }
        }
        current = current.parent;
      }
    }
    ts.forEachChild(node, findMetadataGuard);
  };
  findMetadataGuard(loaderBody);
  if (!metadataGuarded) {
    throw new Error(
      "LanguageSwitcher: private metadata import must stay guarded by pathname.startsWith('/dashboard')",
    );
  }
  const metadataEntry = customerWorkflowSourceImports(switcherFile).find(
    (item) => item.dynamic && item.specifier === metadataSpecifier,
  )?.resolved;
  if (!metadataEntry) {
    throw new Error(
      "LanguageSwitcher: private metadata import does not resolve",
    );
  }

  const staticEntries = customerWorkflowSourceImports(switcherFile)
    .filter((item) => !item.dynamic && item.resolved?.startsWith("src/"))
    .map((item) => item.resolved!);
  assertClientDependencyGraphIsCompact([
    ...staticEntries,
    ...branchEntries,
    metadataEntry,
  ]);
}

export function assertCustomerWorkflowGroupDomSourceOwnership(
  groupName: string,
  config: GroupConfig,
  sharedTypedBoundaries: readonly {
    file: string;
    localizationImport: string;
  }[],
) {
  if (!config.domFiles) return;
  const primaryFiles = new Set(config.files);
  const domFiles = new Set(config.domFiles);
  if (
    primaryFiles.size !== config.files.length ||
    domFiles.size !== config.domFiles.length ||
    [...domFiles].some((file) => !primaryFiles.has(file))
  ) {
    throw new Error(
      `${groupName}: primary/DOM source inventories must be duplicate-free and DOM files must be a subset`,
    );
  }
  const expectedImport = `@/lib/i18n/customer-workflow-${groupName}-translations`;
  for (const omittedFile of [...primaryFiles].filter(
    (file) => !domFiles.has(file),
  )) {
    const boundary = sharedTypedBoundaries.find(
      ({ file }) => file === omittedFile,
    );
    if (!boundary || boundary.localizationImport !== expectedImport) {
      throw new Error(
        `${groupName}: ${omittedFile} may leave the group DOM inventory only as an exact shared typed boundary importing ${expectedImport}`,
      );
    }
  }
}

export function externallyLocalizedSharedSourceExclusions(entry: {
  file: string;
  localeMatrixBindings: readonly string[];
}) {
  const sourceText = readFileSync(resolve(process.cwd(), entry.file), "utf8");
  const source = parseAuditedSource(entry.file, sourceText);
  const transparent = (expression: ts.Expression): ts.Expression => {
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
    return current;
  };
  const declarations = new Map<string, ts.VariableDeclaration>();
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name)) {
        if (declarations.has(declaration.name.text)) {
          throw new Error(
            `${entry.file}: duplicate top-level binding ${declaration.name.text}`,
          );
        }
        declarations.set(declaration.name.text, declaration);
      }
    }
  }
  const configured = new Set(entry.localeMatrixBindings);
  if (configured.size !== entry.localeMatrixBindings.length) {
    throw new Error(`${entry.file}: duplicate locale-matrix binding`);
  }
  const typeHasUnsafeEscape = (type: ts.TypeNode) => {
    let unsafe = false;
    const visit = (node: ts.Node) => {
      if (
        node.kind === ts.SyntaxKind.AnyKeyword ||
        node.kind === ts.SyntaxKind.UnknownKeyword
      ) {
        unsafe = true;
        return;
      }
      if (
        ts.isTypeReferenceNode(node) &&
        node.typeName.getText(source) === "Record" &&
        node.typeArguments?.[0] &&
        (node.typeArguments[0].kind === ts.SyntaxKind.StringKeyword ||
          node.typeArguments[0].getText(source) === "string")
      ) {
        unsafe = true;
        return;
      }
      ts.forEachChild(node, visit);
    };
    visit(type);
    return unsafe;
  };
  const localeRecordDepth = (type: ts.TypeNode): 0 | 1 | 2 => {
    const candidate = ts.isParenthesizedTypeNode(type) ? type.type : type;
    if (
      !ts.isTypeReferenceNode(candidate) ||
      candidate.typeName.getText(source) !== "Record" ||
      candidate.typeArguments?.length !== 2
    ) {
      return 0;
    }
    if (candidate.typeArguments[0].getText(source) === "LocaleCode") return 1;
    return localeRecordDepth(candidate.typeArguments[1]) === 1 ? 2 : 0;
  };
  const staticProperty = (name: ts.PropertyName) =>
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNoSubstitutionTemplateLiteral(name) ||
    ts.isNumericLiteral(name)
      ? name.text
      : null;
  const expressionShape = (expression: ts.Expression): string | null => {
    const candidate = transparent(expression);
    if (
      ts.isStringLiteral(candidate) ||
      ts.isNoSubstitutionTemplateLiteral(candidate) ||
      ts.isTemplateExpression(candidate)
    ) {
      return "text";
    }
    if (
      ts.isNumericLiteral(candidate) ||
      candidate.kind === ts.SyntaxKind.TrueKeyword ||
      candidate.kind === ts.SyntaxKind.FalseKeyword ||
      candidate.kind === ts.SyntaxKind.NullKeyword
    ) {
      return "scalar";
    }
    if (ts.isArrayLiteralExpression(candidate)) {
      const elements = candidate.elements.map((element) =>
        ts.isSpreadElement(element) ? null : expressionShape(element),
      );
      return elements.some((shape) => shape === null)
        ? null
        : `array:[${elements.join(",")}]`;
    }
    if (ts.isObjectLiteralExpression(candidate)) {
      const fields: string[] = [];
      for (const property of candidate.properties) {
        if (!ts.isPropertyAssignment(property)) return null;
        const name = staticProperty(property.name);
        const shape = expressionShape(property.initializer);
        if (!name || !shape) return null;
        fields.push(`${name}:${shape}`);
      }
      return `object:{${fields.join(",")}}`;
    }
    if (ts.isArrowFunction(candidate) || ts.isFunctionExpression(candidate)) {
      const returns: ts.Expression[] = [];
      if (ts.isBlock(candidate.body)) {
        const collectReturns = (node: ts.Node) => {
          if (node !== candidate.body && ts.isFunctionLike(node)) return;
          if (ts.isReturnStatement(node) && node.expression) {
            returns.push(node.expression);
            return;
          }
          ts.forEachChild(node, collectReturns);
        };
        collectReturns(candidate.body);
      } else {
        returns.push(candidate.body);
      }
      const returnShapes = returns.map(expressionShape);
      return !returnShapes.length || returnShapes.some((shape) => !shape)
        ? null
        : `function:${candidate.parameters.length}->${returnShapes.join("|")}`;
    }
    return null;
  };
  const textSignature = (expression: ts.Expression) => {
    const values: string[] = [];
    const visit = (node: ts.Node) => {
      if (
        ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node)
      ) {
        const value = normalizeVisibleText(node.text);
        if (value) values.push(value);
      } else if (ts.isTemplateExpression(node)) {
        const head = normalizeVisibleText(node.head.text);
        if (head) values.push(head);
        node.templateSpans.forEach((span) => {
          const value = normalizeVisibleText(span.literal.text);
          if (value) values.push(value);
        });
      }
      ts.forEachChild(node, visit);
    };
    visit(expression);
    return values.join("\u0000");
  };
  for (const binding of configured) {
    const declaration = declarations.get(binding);
    const initializer = declaration?.initializer
      ? transparent(declaration.initializer)
      : null;
    const matrixDepth = declaration?.type
      ? localeRecordDepth(declaration.type)
      : 0;
    if (
      !initializer ||
      !ts.isObjectLiteralExpression(initializer) ||
      !declaration?.type ||
      !matrixDepth ||
      typeHasUnsafeEscape(declaration.type)
    ) {
      throw new Error(
        `${entry.file}: ${binding} must be a concrete Record<LocaleCode, T> or Record<K, Record<LocaleCode, T>> without any, unknown or Record<string, ...> before its copy can leave the DOM observer`,
      );
    }
    const expectedLocaleKeys = [...localeOrder].sort();
    const objectKeys = (object: ts.ObjectLiteralExpression) => {
      const keys: string[] = [];
      for (const property of object.properties) {
        if (
          !ts.isPropertyAssignment(property) ||
          (!ts.isIdentifier(property.name) &&
            !ts.isStringLiteral(property.name))
        ) {
          return null;
        }
        keys.push(property.name.text);
      }
      return keys;
    };
    const hasExactLocaleKeys = (keys: readonly string[] | null) =>
      Boolean(
        keys &&
        new Set(keys).size === keys.length &&
        JSON.stringify([...keys].sort()) === JSON.stringify(expectedLocaleKeys),
      );
    const validateLocaleBranches = (
      matrix: ts.ObjectLiteralExpression,
      matrixLabel: string,
    ) => {
      const branches = new Map<string, ts.Expression>();
      for (const property of matrix.properties) {
        if (!ts.isPropertyAssignment(property)) {
          throw new Error(
            `${entry.file}: ${matrixLabel} locale matrix must contain only direct static properties`,
          );
        }
        const name = staticProperty(property.name);
        if (!name || branches.has(name)) {
          throw new Error(
            `${entry.file}: ${matrixLabel} locale matrix contains a duplicate or dynamic key`,
          );
        }
        branches.set(name, property.initializer);
      }
      const english = branches.get("en");
      if (!english) {
        throw new Error(`${entry.file}: ${matrixLabel} has no English branch`);
      }
      const englishShape = expressionShape(english);
      if (!englishShape) {
        throw new Error(
          `${entry.file}: ${matrixLabel}.en must have a direct auditable static shape`,
        );
      }
      const englishSignature = textSignature(english);
      for (const locale of localeOrder) {
        const branch = branches.get(locale);
        if (!branch || expressionShape(branch) !== englishShape) {
          throw new Error(
            `${entry.file}: ${matrixLabel}.${locale} must match the exact English static shape`,
          );
        }
        if (
          locale !== "en" &&
          englishSignature &&
          textSignature(branch) === englishSignature
        ) {
          throw new Error(
            `${entry.file}: ${matrixLabel}.${locale} is an unchanged English fallback`,
          );
        }
      }
    };
    const topLevelKeys = objectKeys(initializer);
    if (matrixDepth === 1) {
      if (!hasExactLocaleKeys(topLevelKeys)) {
        throw new Error(
          `${entry.file}: ${binding} locale matrix keys must exactly match ${expectedLocaleKeys.join(", ")}`,
        );
      }
      validateLocaleBranches(initializer, binding);
    } else {
      if (hasExactLocaleKeys(topLevelKeys)) {
        throw new Error(
          `${entry.file}: ${binding} type declares a nested locale matrix but its value is direct`,
        );
      }
      let nestedLocaleMatrices = 0;
      for (const property of initializer.properties) {
        if (
          !ts.isPropertyAssignment(property) ||
          (!ts.isIdentifier(property.name) &&
            !ts.isStringLiteral(property.name))
        ) {
          throw new Error(
            `${entry.file}: ${binding} locale matrix must contain only direct static properties`,
          );
        }
        const value = transparent(property.initializer);
        if (
          !ts.isObjectLiteralExpression(value) ||
          !hasExactLocaleKeys(objectKeys(value))
        ) {
          throw new Error(
            `${entry.file}: ${binding}.${property.name.text} locale matrix keys must exactly match ${expectedLocaleKeys.join(", ")}`,
          );
        }
        validateLocaleBranches(value, `${binding}.${property.name.text}`);
        nestedLocaleMatrices += 1;
      }
      if (!nestedLocaleMatrices) {
        throw new Error(
          `${entry.file}: ${binding} must contain a direct or nested exact locale matrix`,
        );
      }
    }
  }

  const topLevelBindingForNode = (node: ts.Node) => {
    let current: ts.Node | undefined = node.parent;
    while (current && !ts.isSourceFile(current)) {
      if (
        ts.isVariableDeclaration(current) &&
        ts.isIdentifier(current.name) &&
        current.parent.parent.parent === source
      ) {
        return current.name.text;
      }
      current = current.parent;
    }
    return null;
  };
  const occurrenceState = new Map<
    string,
    { insideMatrix: boolean; outsideMatrix: boolean }
  >();
  const rememberOccurrence = (node: ts.Node, value: string) => {
    const binding = topLevelBindingForNode(node);
    const isPropertyName =
      (ts.isPropertyAssignment(node.parent) ||
        ts.isMethodDeclaration(node.parent) ||
        ts.isGetAccessorDeclaration(node.parent) ||
        ts.isSetAccessorDeclaration(node.parent)) &&
      node.parent.name === node;
    if (isPropertyName) return;
    const normalized = normalizeVisibleText(value);
    if (!normalized) return;
    const state = occurrenceState.get(normalized) ?? {
      insideMatrix: false,
      outsideMatrix: false,
    };
    if (binding && configured.has(binding)) state.insideMatrix = true;
    else state.outsideMatrix = true;
    occurrenceState.set(normalized, state);
  };
  const visit = (node: ts.Node) => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isJsxText(node)
    ) {
      rememberOccurrence(node, node.text);
    }
    if (ts.isTemplateExpression(node)) {
      rememberOccurrence(node, node.head.text);
      node.templateSpans.forEach((span) =>
        rememberOccurrence(span.literal, span.literal.text),
      );
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return new Set(
    [...occurrenceState]
      .filter(([, state]) => state.insideMatrix && !state.outsideMatrix)
      .map(([value]) => value),
  );
}

function validateCustomerWorkflowRouteCatalogClosure() {
  assertLegacyDomObserverBaselineIntegrity();
  const sharedTypedBoundaries: Array<{
    file: string;
    localizationImport: string;
  }> = Object.values(customerWorkflowSharedSourceManifest).flatMap(
    ({ typedUiBoundaries }) =>
      [...typedUiBoundaries].map(({ file, localizationImport }) => ({
        file,
        localizationImport,
      })),
  );
  for (const [groupName, config] of Object.entries(
    customerWorkflowClientGroups,
  )) {
    assertCustomerWorkflowGroupDomSourceOwnership(
      groupName,
      config as GroupConfig,
      sharedTypedBoundaries,
    );
  }
  for (const entry of customerWorkflowExternallyLocalizedSharedSources) {
    const file = entry.file;
    if (
      !customerWorkflowSharedSourceManifest[
        "portal-common"
      ].sourceFiles.includes(file) ||
      !customerWorkflowPortalCommonGeneratorFiles.includes(file)
    ) {
      throw new Error(
        `${file}: externally localized shared source must remain exact, route-owned and inside occurrence-level DOM extraction`,
      );
    }
    externallyLocalizedSharedSourceExclusions(entry);
  }
  auditCustomerWorkflowRouteClosure(
    customerWorkflowClientSurfaceManifest,
    customerWorkflowSharedSourceManifest,
    customerWorkflowExternalConventionBoundaries,
  );
  validateLanguageSwitcherCompactImports();
}

export function generatedCustomerWorkflowClientFiles() {
  validateCustomerWorkflowRouteCatalogClosure();
  const generated = Object.entries(customerWorkflowClientGroups).flatMap(
    ([groupName, config]) => {
      const groupConfig = config as GroupConfig;
      const primaryContent = generateCustomerWorkflowClientModule(
        groupName as GroupName,
        groupConfig,
      );
      const literals = collectSourceLiterals(groupConfig.files);
      const transportSources = new Set<string>();
      // Exact translator literals are already absent from `literals.visible`.
      // Excluding them by source value would hide a second raw occurrence of
      // the same copy. Only structurally proven transport/config occurrences
      // may be removed from the legacy observer inventory.
      addManualExactTransportSourceExclusions(
        groupName as GroupName,
        transportSources,
        groupConfig,
      );
      literals.exactTransportSources.forEach((source) =>
        transportSources.add(source),
      );
      validatedTypedExactFunctionSources(
        groupName as GroupName,
        groupConfig,
      ).forEach((source) => transportSources.add(source));
      addTypedTemplateSourceExclusions(
        groupName as GroupName,
        transportSources,
        groupConfig,
        literals,
      );
      return [
        {
          groupName: groupName as GroupName,
          path: resolve(
            process.cwd(),
            "src/lib/i18n",
            `customer-workflow-${groupName}-translations.ts`,
          ),
          content: primaryContent,
        },
        {
          groupName: `${groupName}-dom`,
          path: resolve(
            process.cwd(),
            "src/lib/i18n",
            `customer-workflow-${groupName}-dom-translations.ts`,
          ),
          content: generateCustomerWorkflowDomModule(
            groupName,
            groupConfig,
            groupName as LegacyDomGroup,
            transportSources,
            primaryContent,
          ),
        },
      ];
    },
  );
  const externalSourceFiles = new Set<string>(
    customerWorkflowExternallyLocalizedSharedSources.map((entry) => entry.file),
  );
  const externallyLocalizedExclusions = new Set(
    customerWorkflowExternallyLocalizedSharedSources.flatMap((entry) => [
      ...externallyLocalizedSharedSourceExclusions(entry),
    ]),
  );
  const otherPortalVisible = collectSourceLiterals(
    portalCommonConfig.files.filter((file) => !externalSourceFiles.has(file)),
  ).visible;
  for (const source of otherPortalVisible) {
    externallyLocalizedExclusions.delete(source);
    externallyLocalizedExclusions.delete(normalizeVisibleText(source));
  }
  generated.push({
    groupName: "portal-common",
    path: resolve(
      process.cwd(),
      "src/lib/i18n/customer-workflow-portal-common-translations.ts",
    ),
    content: generateCustomerWorkflowDomModule(
      "shared customer portal",
      portalCommonConfig,
      "portal-common",
      externallyLocalizedExclusions,
    ),
  });
  generated.push({
    groupName: "private-metadata",
    path: resolve(
      process.cwd(),
      "src/lib/i18n/customer-workflow-private-metadata-translations.ts",
    ),
    content: generateCustomerWorkflowClientModule(
      "private-metadata",
      privateMetadataConfig,
    ),
  });
  return generated;
}

function run() {
  const check = process.argv.includes("--check");
  const stale: string[] = [];
  for (const file of generatedCustomerWorkflowClientFiles()) {
    if (check) {
      let current = "";
      try {
        current = readFileSync(file.path, "utf8");
      } catch {
        // Missing generated output is stale by definition.
      }
      if (current !== file.content) stale.push(file.path);
      continue;
    }
    writeFileSync(file.path, file.content, "utf8");
    process.stdout.write(
      `Generated ${file.groupName}: ${file.content.length.toLocaleString("en")} bytes\n`,
    );
  }
  if (stale.length) {
    throw new Error(
      `Customer workflow client translations are stale:\n${stale.join("\n")}`,
    );
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(import.meta.filename)
) {
  run();
}
