import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import ts from "typescript";
import { creditPurchaseSafeMessages } from "../src/lib/creditPurchaseErrorCodes";
import {
  exactTranslations as baseExactTranslations,
  termTranslations as baseTermTranslations,
} from "../src/lib/i18n";
import {
  customerWorkflowExactTranslations as masterExactTranslations,
  customerWorkflowLocaleOrder,
  customerWorkflowTemplateRows as masterTemplateRows,
} from "../src/lib/i18n/customer-workflow-translations";

type GroupName =
  | "auth"
  | "overview"
  | "request"
  | "credits"
  | "file-expert"
  | "orders"
  | "notifications"
  | "security"
  | "widget";

type GeneratedGroupName = GroupName | "private-metadata";

type GroupConfig = {
  files: readonly string[];
  extraTemplateKeys?: readonly string[];
  extraExactSources?: readonly string[];
  includeMasterLiteralExact?: boolean;
  helper?: "password" | "notifications";
};

const portalCommonFiles = [
  "src/app/dashboard/layout.tsx",
  "src/components/auth/AuthRequired.tsx",
  "src/components/auth/BrowserAuthBoundary.tsx",
  "src/components/auth/DeviceVerificationPanel.tsx",
  "src/components/auth/RegistrationCountryBoundary.tsx",
  "src/components/dashboard/CustomerPortalFrame.tsx",
  "src/components/dashboard/CustomerPortalPageHeader.tsx",
  "src/components/dashboard/CustomerPortalSidebar.tsx",
  "src/components/dashboard/LogAnalysisStudioLoader.tsx",
  "src/components/CustomerNotifications.tsx",
] as const;

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

export const customerWorkflowClientGroups = {
  auth: {
    files: [
      "src/app/auth/callback/page.tsx",
      "src/app/auth/complete-profile/page.tsx",
      "src/app/desktop-auth/turnstile/page.tsx",
      "src/app/forgot-password/page.tsx",
      "src/app/login/page.tsx",
      "src/app/measurement/complete/page.tsx",
      "src/app/register/page.tsx",
      "src/app/reset-password/page.tsx",
      "src/components/CountrySelect.tsx",
      "src/components/InternationalPhoneField.tsx",
      "src/components/auth/AuthBackdrop.tsx",
      "src/components/auth/DeviceVerificationPanel.tsx",
      "src/components/auth/GoogleIdentityButton.tsx",
      "src/components/auth/TurnstileChallenge.tsx",
      "src/lib/googleIdentity.ts",
    ],
    includeMasterLiteralExact: true,
    extraExactSources: [
      "Google sign-in is temporarily unavailable. You can continue with e-mail.",
      "Detecting your country...",
      "Country selected automatically. You can change it.",
      "Select the country used for your customer profile.",
      "E-mail & password",
      "Invoice & address",
    ],
    extraTemplateKeys: authPasswordTemplateKeys,
    helper: "password",
  },
  overview: {
    files: [
      "src/app/dashboard/page.tsx",
      "src/components/dashboard/DashboardClient.tsx",
      "src/components/dashboard/index.tsx",
      "src/components/ui/efferd-dashboard-2.tsx",
    ],
    includeMasterLiteralExact: true,
    extraExactSources: [
      "Customer Dashboard",
      "Secure MG AutoTech customer dashboard for file requests, credits and deliveries.",
    ],
  },
  request: {
    files: ["src/app/new-request/page.tsx"],
    includeMasterLiteralExact: true,
  },
  credits: {
    files: [
      "src/app/dashboard/credits/page.tsx",
      "src/app/dashboard/credits/history/page.tsx",
      "src/app/payment/cancel/page.tsx",
      "src/app/payment/success/page.tsx",
    ],
    includeMasterLiteralExact: true,
    extraExactSources: [
      ...Object.values(creditPurchaseSafeMessages),
      "Credit Card",
      "Secure Stripe checkout",
      "Automatic",
      "Bank Transfer",
      "SEPA transfer",
      "Manual check",
      "No payment method available",
      "This legacy payment method is no longer supported. Please use card payment or bank transfer.",
      "Payment session id is missing.",
      "Payment is still being reconciled securely. Checking again...",
      "Payment could not be confirmed.",
      "Payment confirmed. Credits were added to your account.",
      "Confirming your payment...",
      "Confirming payment",
      "Payment successful",
      "Payment needs review",
      "Added credits",
      "Dashboard",
      "Buy More Credits",
    ],
  },
  "file-expert": {
    files: [
      "src/app/dashboard/file-expert/page.tsx",
      "src/app/dashboard/file-expert/[id]/page.tsx",
    ],
  },
  orders: {
    files: [
      "src/app/dashboard/orders/page.tsx",
      "src/app/dashboard/orders/[id]/page.tsx",
      "src/components/RequestChat.tsx",
    ],
  },
  notifications: {
    files: [
      "src/app/dashboard/notifications/page.tsx",
      "src/components/CustomerNotifications.tsx",
    ],
    extraTemplateKeys: notificationTemplateKeys,
    helper: "notifications",
  },
  security: {
    files: [
      "src/app/dashboard/settings/page.tsx",
      "src/components/account/TrustedDevicesCard.tsx",
    ],
    includeMasterLiteralExact: true,
  },
  widget: {
    files: [
      "src/app/dashboard/widget/page.tsx",
      "src/app/dashboard/widget/billing/page.tsx",
    ],
  },
} as const satisfies Record<GroupName, GroupConfig>;

const portalCommonConfig = {
  files: portalCommonFiles,
} as const satisfies GroupConfig;

const privateMetadataConfig = {
  files: [],
  extraExactSources: [
    "Customer Dashboard",
    "Secure MG AutoTech customer dashboard for file requests, credits and deliveries.",
    "Datalog Analysis Studio",
    "Private browser-local multi-channel datalog review for MG AutoTech customers.",
  ],
} as const satisfies GroupConfig;

const localeOrder = ["en", ...customerWorkflowLocaleOrder] as const;
const templateRowsByKey = new Map<string, (typeof masterTemplateRows)[number]>(
  masterTemplateRows.map((row) => [row[0], row] as const),
);

function normalizeVisibleText(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

function collectSourceLiterals(files: readonly string[]) {
  const all = new Set<string>();
  const visible = new Set<string>();
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
    "name",
    "placeholder",
    "shortTitle",
    "subtitle",
    "text",
    "title",
    "unknownLabel",
    "value",
  ]);

  const propertyName = (node: ts.PropertyName) =>
    ts.isIdentifier(node) || ts.isStringLiteral(node) ? node.text : "";

  const hasVisibleAncestor = (node: ts.Node) => {
    let current: ts.Node | undefined = node.parent;
    while (current && !ts.isSourceFile(current)) {
      if (ts.isJsxExpression(current)) return true;
      if (
        ts.isJsxAttribute(current) &&
        ts.isIdentifier(current.name) &&
        visibleProperties.has(current.name.text)
      ) {
        return true;
      }
      if (
        ts.isPropertyAssignment(current) &&
        visibleProperties.has(propertyName(current.name))
      ) {
        return true;
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
        if (
          name === "firstPaintT" ||
          name === "authPageFirstPaintT" ||
          name === "customerPortalFirstPaintT"
        ) {
          return true;
        }
        return false;
      }
      if (ts.isFunctionLike(current)) return false;
      current = current.parent;
    }
    return false;
  };

  for (const file of files) {
    const sourceText = readFileSync(resolve(process.cwd(), file), "utf8");
    const source = ts.createSourceFile(
      file,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const visit = (node: ts.Node) => {
      if (
        ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node)
      ) {
        remember(all, node.text);
        if (hasVisibleAncestor(node)) remember(visible, node.text);
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
          node.templateSpans.forEach((span) => remember(visible, span.literal.text));
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }

  return { all, visible };
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
  for (const [source, translations] of Object.entries(masterExactTranslations)) {
    rows.set(source, translations);
  }
  return rows;
}

const combinedExactRows = buildCombinedExactRows();

function serialize(value: unknown) {
  return JSON.stringify(value, null, 2);
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

function runtimeImports(helper: GroupConfig["helper"]) {
  const imports = ["createCustomerWorkflowClientTranslators"];
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
  const literals = collectSourceLiterals(config.files);
  const directExactSources = new Set(config.extraExactSources ?? []);
  if (config.includeMasterLiteralExact) {
    for (const source of Object.keys(masterExactTranslations)) {
      if (
        literals.all.has(source) ||
        literals.all.has(normalizeVisibleText(source))
      ) {
        directExactSources.add(source);
      }
    }
  }
  const exactEntries = [...combinedExactRows.entries()]
    .filter(([source]) => directExactSources.has(source))
    .sort(([left], [right]) => left.localeCompare(right, "en"));
  const templateKeys = new Set<string>(config.extraTemplateKeys ?? []);
  for (const key of templateRowsByKey.keys()) {
    if (literals.all.has(key)) templateKeys.add(key);
  }
  const templateRows = [...templateKeys]
    .sort((left, right) => left.localeCompare(right, "en"))
    .map((key) => {
      const row = templateRowsByKey.get(key);
      if (!row) throw new Error(`${groupName}: unknown template key ${key}`);
      return row;
    });
  const exactObject = Object.fromEntries(exactEntries);
  const imports = runtimeImports(config.helper);
  const typeImports = [
    ...(config.helper === "notifications"
      ? ["CustomerNotificationI18nInput"]
      : []),
    ...(config.helper ? ["CustomerWorkflowTemplateTranslator"] : []),
  ];

  return `// This file is generated by scripts/generate-customer-workflow-client-translations.ts.\n// Edit the master catalog or group source inventory, then regenerate it.\n\nimport type { LocaleCode } from "@/lib/i18nConfig";\nimport {\n  ${imports.join(",\n  ")},\n} from "@/lib/i18n/customer-workflow-client-runtime";${
    typeImports.length
      ? `\nimport type {\n  ${typeImports.join(",\n  ")},\n} from "@/lib/i18n/customer-workflow-client-runtime";`
      : ""
  }\n\nexport const customerWorkflowLocaleOrder = ${serialize(customerWorkflowLocaleOrder)} as const satisfies readonly Exclude<LocaleCode, "en">[];\n\nexport const customerWorkflowExactTranslations = ${serialize(exactObject)} as const satisfies Readonly<Record<string, readonly string[]>>;\n\nexport const customerWorkflowSourceStrings = Object.keys(customerWorkflowExactTranslations);\n\nexport const customerWorkflowTemplateRows = ${serialize(templateRows)} as const;\n\nexport type CustomerWorkflowTranslationKey = (typeof customerWorkflowTemplateRows)[number][0];\n\nconst translators = createCustomerWorkflowClientTranslators(\n  customerWorkflowExactTranslations,\n  customerWorkflowTemplateRows,\n);\n\nexport function customerWorkflowExactT(locale: LocaleCode, source: string) {\n  return translators.exactT(locale, source);\n}\n\nexport function customerWorkflowT(\n  locale: LocaleCode,\n  key: CustomerWorkflowTranslationKey,\n  values: Record<string, string | number> = {},\n) {\n  return translators.t(locale, key, values);\n}\n${helperExports(config.helper)}`;
}

function generateCustomerWorkflowDomModule(
  label: string,
  config: GroupConfig,
  excludedSources: ReadonlySet<string> = new Set(),
) {
  const literals = collectSourceLiterals(config.files);
  const exactObject = Object.fromEntries(
    [...combinedExactRows.entries()]
      .filter(
        ([source]) =>
          !excludedSources.has(source) &&
          (literals.visible.has(source) ||
            literals.visible.has(normalizeVisibleText(source))),
      )
      .sort(([left], [right]) => left.localeCompare(right, "en")),
  );
  return `// This file is generated by scripts/generate-customer-workflow-client-translations.ts.\n// It contains only DOM-observer copy for the ${label} surface.\n\nimport type { LocaleCode } from "@/lib/i18nConfig";\n\nexport const customerWorkflowLocaleOrder = ${serialize(customerWorkflowLocaleOrder)} as const satisfies readonly Exclude<LocaleCode, "en">[];\n\nexport const customerWorkflowExactTranslations = ${serialize(exactObject)} as const satisfies Readonly<Record<string, readonly string[]>>;\n`;
}

export function generatedCustomerWorkflowClientFiles() {
  const generated = Object.entries(customerWorkflowClientGroups).flatMap(
    ([groupName, config]) => {
      const primaryContent = generateCustomerWorkflowClientModule(
        groupName as GroupName,
        config,
      );
      const marker = "export const customerWorkflowExactTranslations = ";
      const start = primaryContent.indexOf(marker) + marker.length;
      const end = primaryContent.indexOf(" as const satisfies", start);
      const directSources = new Set(
        Object.keys(JSON.parse(primaryContent.slice(start, end)) as object),
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
            config,
            directSources,
          ),
        },
      ];
    },
  );
  generated.push({
    groupName: "portal-common",
    path: resolve(
      process.cwd(),
      "src/lib/i18n/customer-workflow-portal-common-translations.ts",
    ),
    content: generateCustomerWorkflowDomModule(
      "shared customer portal",
      portalCommonConfig,
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

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  run();
}
