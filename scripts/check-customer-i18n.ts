import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { exactTranslations, termTranslations } from "../src/lib/i18n";
import { supportedLocales, type LocaleCode } from "../src/lib/i18nConfig";
import {
  customerWorkflowExactTranslations,
  customerWorkflowLocaleOrder,
} from "../src/lib/i18n/customer-workflow-translations";
import {
  logStudioExactLocaleOrder,
  logStudioExactTranslations,
} from "../src/lib/i18n/log-analysis-studio-translations";
import {
  publicSurfaceLocaleOrder,
} from "../src/lib/i18n/public-surface-types";
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

const customerSurfaceRoots = [
  "src/app/error.tsx",
  "src/app/global-error.tsx",
  "src/app/not-found.tsx",
  "src/app/about",
  "src/app/auth",
  "src/app/brands",
  "src/app/contact",
  "src/app/dashboard",
  "src/app/desktop-auth",
  "src/app/download",
  "src/app/ecu-platforms",
  "src/app/new-request",
  "src/app/login",
  "src/app/measurement",
  "src/app/register",
  "src/app/forgot-password",
  "src/app/reset-password",
  "src/app/payment",
  "src/app/services",
  "src/app/tools",
  "src/app/widget",
  "src/app/workshop-guides",
  "src/components/account",
  "src/components/auth",
  "src/components/dashboard",
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
  "src/lib/industry-content.ts",
  "src/lib/serviceIntentGuides.ts",
  "src/lib/workshopGuides.ts",
] as const;

const separatelyAuditedAppSegments = new Set([
  "[locale]",
  "file-service",
  "how-it-works",
]);
const intentionallyAuthoredAppSegments = new Set([
  "admin",
  "agb",
  "av-vertrag",
  "datenschutz",
  "embed",
  "impressum",
  "privacy",
  "widerruf",
]);

const invariantValues = new Set([
  "MG",
  "MG AutoTech",
  "MG AutoTech • 404",
  "MG AutoTech - Melih Gokkaya",
  "MG AutoTech SaaS",
  "MG AUTOTECH",
  "AUTOTECH",
  "ECU",
  "ECU:",
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
  "Bench",
  "Boot",
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
  "AdBlue OFF",
  "DPF OFF",
  "DPF / EGR / SCR",
  "DTC OFF",
  "WhatsApp",
  "ETA:",
  "Max",
  "Read:",
  "Source #",
  "John Doe",
  "Stuttgart",
  "Böckinger Str. 32",
  "DE...",
  "e.g. 17",
  "e.g. 2.0 diesel",
  "e.g. 2016",
  "e.g. 320d",
  "e.g. BMW",
  "e.g. Bosch EDC17C46",
  "MG AutoTech AI File Expert",
  "AI File Expert",
  "OBD · Bench · Boot",
  "cr",
  "continue_with",
  "Alientech",
  "Audi",
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
  "P0401, P2002...",
  "example.com",
  "new-domain.com",
  // These are the canonical names of the authored German legal documents.
  "Datenschutz",
  "Impressum",
  "Widerruf",
  // Internal route, event, filter and option values. Their adjacent labels are
  // localized separately; these identifiers are never rendered as copy.
  "/login",
  "active",
  "all",
  "auth_login",
  "auth_recovery",
  "auth_register",
  "auth_register_google",
  "auto",
  "cancelled",
  "completed",
  "data",
  "dark",
  "files",
  "light",
  "needs_response",
  "overview",
  "purchase",
  "quote",
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
  /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/iu,
];

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

function walk(directory: string, files: Set<string>) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(filePath, files);
    else if (entry.name.endsWith(".tsx")) files.add(filePath);
  }
}

function collectVisibleStrings() {
  const files = new Set<string>();
  const strings = new Set<string>();
  const sourceFilesByValue = new Map<string, Set<string>>();
  const broadNoTranslateFiles = new Set<string>();
  const dynamicVisibleExpressions: DynamicVisibleExpression[] = [];

  const extraAuditRoot = process.env.I18N_AUDIT_EXTRA_ROOT?.trim();
  const auditRoots = extraAuditRoot
    ? [...customerSurfaceRoots, extraAuditRoot]
    : customerSurfaceRoots;

  for (const root of auditRoots) {
    if (!fs.existsSync(root)) continue;
    if (fs.statSync(root).isDirectory()) walk(root, files);
    else files.add(path.normalize(root));
  }

  for (const file of files) {
    const sourceText = fs.readFileSync(file, "utf8");
    if (/<(?:main|section|article)\b[^>]*\bdata-no-translate\b/iu.test(sourceText)) {
      broadNoTranslateFiles.add(file.replaceAll("\\", "/"));
    }
    const source = ts.createSourceFile(
      file,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );

    const remember = (value: string) => {
      const normalized = value.replace(/\s+/gu, " ").trim();
      if (normalized.length <= 1) return;
      strings.add(normalized);
      const sources = sourceFilesByValue.get(normalized) ?? new Set<string>();
      sources.add(file.replaceAll("\\", "/"));
      sourceFilesByValue.set(normalized, sources);
    };

    const staticStrings = new Map<string, string>();
    for (const statement of source.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
        if (
          ts.isStringLiteral(declaration.initializer) ||
          ts.isNoSubstitutionTemplateLiteral(declaration.initializer)
        ) {
          staticStrings.set(declaration.name.text, declaration.initializer.text);
        }
      }
    }

    const resolveStaticString = (expression: ts.Expression): string | null => {
      if (
        ts.isStringLiteral(expression) ||
        ts.isNoSubstitutionTemplateLiteral(expression)
      ) {
        return expression.text;
      }
      if (ts.isIdentifier(expression)) {
        return staticStrings.get(expression.text) ?? null;
      }
      if (
        ts.isBinaryExpression(expression) &&
        expression.operatorToken.kind === ts.SyntaxKind.PlusToken
      ) {
        const left = resolveStaticString(expression.left);
        const right = resolveStaticString(expression.right);
        return left === null || right === null ? null : `${left}${right}`;
      }
      if (ts.isTemplateExpression(expression)) {
        let value = expression.head.text;
        for (const span of expression.templateSpans) {
          const resolved = resolveStaticString(span.expression);
          if (resolved === null) return null;
          value += `${resolved}${span.literal.text}`;
        }
        return value;
      }
      return null;
    };

    const metadataDeclaration = source.statements
      .filter(ts.isVariableStatement)
      .flatMap((statement) => [...statement.declarationList.declarations])
      .find(
        (declaration) =>
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === "metadata" &&
          declaration.initializer
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
          const value = staticStrings.get(node.name.text);
          if (value) remember(value);
        }
        ts.forEachChild(node, visitMetadata);
      };
      visitMetadata(metadataDeclaration.initializer);
    }

    const visibleStringProps = new Set([
      "aria-label",
      "action",
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
      "value",
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

    const isInsideVisibleCollection = (node: ts.Node) => {
      let current = node.parent;
      while (current && !ts.isSourceFile(current)) {
        if (ts.isPropertyAssignment(current)) {
          const propertyName = ts.isIdentifier(current.name) || ts.isStringLiteral(current.name)
            ? current.name.text
            : "";
          return visibleCollectionProps.has(propertyName);
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

    const isInsideVisibleJsxAttribute = (node: ts.Node) => {
      const attribute = jsxAttributeAncestor(node);
      return Boolean(
        attribute &&
          ts.isIdentifier(attribute.name) &&
          visibleStringProps.has(attribute.name.text)
      );
    };

    const isTranslationKeyArgument = (node: ts.Node) => {
      let current: ts.Node | undefined = node.parent;
      while (current && !ts.isSourceFile(current)) {
        if (ts.isCallExpression(current)) {
          const callee = current.expression;
          const name = ts.isIdentifier(callee)
            ? callee.text
            : ts.isPropertyAccessExpression(callee)
              ? callee.name.text
              : "";
          return /(?:^t$|T$|^translate)/u.test(name);
        }
        current = current.parent;
      }
      return false;
    };

    const isVisibleSetterName = (name: string) =>
      name !== "setCopyStatus" &&
      /^set(?:[A-Z][A-Za-z0-9]*)?(?:Error|Feedback|Message|Notice|Status|Success)$/u.test(name);

    const isInsideVisibleSetter = (node: ts.Node) => {
      let current = node.parent;
      while (current && !ts.isSourceFile(current)) {
        if (ts.isPropertyAssignment(current)) {
          const propertyName = ts.isIdentifier(current.name) || ts.isStringLiteral(current.name)
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

    const isControlFlowLiteral = (node: ts.Node) => {
      let current = node.parent;
      while (current && !ts.isSourceFile(current)) {
        if (
          ts.isBinaryExpression(current) &&
          current.operatorToken.kind !== ts.SyntaxKind.PlusToken
        ) {
          return true;
        }
        if (ts.isCaseClause(current) && current.expression === node) return true;
        current = current.parent;
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
          if (current.operatorToken.kind !== ts.SyntaxKind.PlusToken) return false;
          current = current.parent;
          continue;
        }
        if (ts.isConditionalExpression(current)) {
          current = current.parent;
          continue;
        }
        if (
          ts.isCallExpression(current) ||
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
      kind: DynamicVisibleExpression["kind"]
    ) => {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
      dynamicVisibleExpressions.push({
        file: file.replaceAll("\\", "/"),
        kind,
        line: line + 1,
        source: node.getText(source).replace(/\s+/gu, " ").trim(),
      });
    };

    const hasStringSyntax = (expression: ts.Expression): boolean => {
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
    };

    const visit = (node: ts.Node) => {
      if (ts.isJsxText(node)) {
        remember(node.text);
      }

      if (
        ts.isJsxAttribute(node) &&
        ts.isIdentifier(node.name) &&
        visibleStringProps.has(node.name.text)
      ) {
        const value = node.initializer;
        if (value && ts.isStringLiteral(value) && value.text.trim()) {
          remember(value.text);
        }
      }

      if (
        ts.isPropertyAssignment(node) &&
        ((ts.isIdentifier(node.name) && visibleStringProps.has(node.name.text)) ||
          (ts.isStringLiteral(node.name) && visibleStringProps.has(node.name.text))) &&
        (ts.isStringLiteral(node.initializer) ||
          ts.isNoSubstitutionTemplateLiteral(node.initializer))
      ) {
        remember(node.initializer.text);
      }

      if (
        ts.isStringLiteral(node) &&
        !isTranslationKeyArgument(node) &&
        !isControlFlowLiteral(node) &&
        (isVisibleJsxExpressionString(node) ||
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
    .filter((value) => !/[{}<>]/u.test(value))
    .filter((value) => !/^[-+#.:/\d\s]+$/u.test(value))
    .sort((left, right) => left.localeCompare(right));

  return {
    broadNoTranslateFiles,
    dynamicVisibleExpressions,
    sourceFilesByValue,
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

const supplementalCatalogs: ReadonlyArray<
  readonly [
    label: string,
    localeOrder: readonly string[],
    translations: Record<string, readonly string[]>,
  ]
> = [
  ["customer-workflow", customerWorkflowLocaleOrder, customerWorkflowExactTranslations],
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
    const translated = localeIndex >= 0 ? translations[value]?.[localeIndex]?.trim() : "";
    return translated ? [{ label, value: translated }] : [];
  });
}

function allowedSupplementalLabelsForFile(file: string) {
  const normalized = file.replaceAll("\\", "/");
  const labels = new Set<string>();
  const add = (...items: string[]) => items.forEach((item) => labels.add(item));

  if (/^src\/app\/(?:about|contact|download)(?:\/|$)/u.test(normalized)) add("public-core");
  if (/^src\/app\/(?:brands|ecu-platforms)(?:\/|$)/u.test(normalized)) add("public-core", "public-vehicle");
  if (/^src\/app\/services(?:\/|$)/u.test(normalized)) add("public-core", "public-services", "service-intent");
  if (/^src\/app\/tools(?:\/|$)/u.test(normalized)) add("public-core", "public-tools", "log-studio");
  if (/^src\/app\/widget(?:\/|$)/u.test(normalized)) add("public-core", "widget-site");
  if (/^src\/app\/workshop-guides(?:\/|$)/u.test(normalized)) add("public-core", "workshop-guides");
  if (/^src\/app\/(?:auth|dashboard|desktop-auth|forgot-password|login|measurement|new-request|payment|register|reset-password)(?:\/|$)/u.test(normalized)) add("customer-workflow");
  if (/^src\/app\/dashboard\/widget(?:\/|$)/u.test(normalized)) add("widget-site");
  if (/^src\/app\/dashboard\/log-analysis(?:\/|$)/u.test(normalized)) add("log-studio");

  if (/^src\/components\/widget\//u.test(normalized)) add("widget-site");
  if (/^src\/components\/tools\//u.test(normalized)) add("public-core", "public-tools");
  if (/^src\/components\/(?:account|auth|dashboard)\//u.test(normalized)) add("customer-workflow");
  if (normalized === "src/components/dashboard/LogAnalysisStudio.tsx") add("public-tools", "log-studio");
  if (normalized === "src/components/dashboard/WidgetDashboardClient.tsx") add("widget-site");
  if (/^src\/components\/(?:CustomerNotificationsRuntime|CustomerNotifications|CountrySelect|InternationalPhoneField|RequestChat)\.tsx$/u.test(normalized)) add("customer-workflow");
  if (/^src\/components\/(?:FileServiceSearchNavigator|ServiceIntentPage|Stage1Authority|StageComparison)\.tsx$/u.test(normalized)) add("public-core", "public-services", "service-intent");
  if (/^src\/components\/(?:Footer|PublicSeoHeader)\.tsx$/u.test(normalized)) add("public-core");
  if (normalized === "src/components/SeoGuidePage.tsx") add("public-core", "public-vehicle");
  if (normalized === "src/components/analytics/PublicAnalytics.tsx") add("public-core");
  if (/^src\/components\/(?:OnlineStatus|PlatformReliabilityMonitor)\.tsx$/u.test(normalized)) add("public-core", "customer-workflow");
  if (/^src\/components\/(?:app-shell|ui\/efferd-dashboard-2)\.tsx$/u.test(normalized)) add("customer-workflow");

  if (normalized === "src/lib/industry-content.ts") add("public-vehicle");
  if (normalized === "src/lib/serviceIntentGuides.ts") add("service-intent");
  if (normalized === "src/lib/workshopGuides.ts") add("workshop-guides");

  return labels;
}

function supplementalCoversForFiles(
  value: string,
  locale: LocaleCode,
  files?: Iterable<string>
) {
  const candidates = supplementalTranslationsFor(value, locale);
  if (candidates.length === 0) return false;
  if (!files) return true;

  return [...files].every((file) => {
    const allowedLabels = allowedSupplementalLabelsForFile(file);
    return candidates.some(({ label }) => allowedLabels.has(label));
  });
}

function dictionaryCovers(
  value: string,
  locale: LocaleCode,
  files?: Iterable<string>
) {
  if (Object.prototype.hasOwnProperty.call(exactTranslations[locale], value)) {
    return Boolean(exactTranslations[locale][value]?.trim());
  }

  if (Object.prototype.hasOwnProperty.call(termTranslations[locale], value)) {
    return Boolean(termTranslations[locale][value]?.trim());
  }

  if (supplementalCoversForFiles(value, locale, files)) return true;

  const brandedTitleSuffix = " | MG AutoTech";
  if (value.endsWith(brandedTitleSuffix)) {
    return dictionaryCovers(
      value.slice(0, -brandedTitleSuffix.length),
      locale,
      files
    );
  }

  return false;
}

function compactTermCovers(value: string, locale: LocaleCode) {
  const wordCount = value.match(/\p{L}+/gu)?.length ?? 0;
  if (wordCount > 6) return false;

  return Object.entries(termTranslations[locale]).some(([source, target]) => {
    if (!source.trim() || !target.trim()) return false;
    const prefix = /^\w/u.test(source) ? "\\b" : "";
    const suffix = /\w$/u.test(source) ? "\\b" : "";
    return new RegExp(`${prefix}${escapeRegex(source)}${suffix}`, "iu").test(value);
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
  values,
} = collectVisibleStrings();
const locales = supportedLocales
  .map(({ code }) => code)
  .filter((code): code is Exclude<LocaleCode, "en"> => code !== "en");
const failures: string[] = [];
const missingSourceValues = new Set<string>();

const appRouteEntryFiles = new Set<string>();
walk("src/app", appRouteEntryFiles);
const routeEntryFileNames = new Set([
  "error.tsx",
  "global-error.tsx",
  "loading.tsx",
  "not-found.tsx",
  "page.tsx",
  "template.tsx",
]);
const unclassifiedAppPages = [...appRouteEntryFiles]
  .filter((file) => routeEntryFileNames.has(path.basename(file)))
  .filter((file) => {
    const relative = path.relative("src/app", file).replaceAll("\\", "/");
    if (relative === "page.tsx" || relative === "not-found.tsx") return false;
    const firstSegment = relative.split("/")[0] ?? "";
    if (
      separatelyAuditedAppSegments.has(firstSegment) ||
      intentionallyAuthoredAppSegments.has(firstSegment)
    ) {
      return false;
    }
    return !customerSurfaceRoots.some((root) => {
      const normalizedRoot = path.normalize(root);
      return file === normalizedRoot || file.startsWith(`${normalizedRoot}${path.sep}`);
    });
  })
  .map((file) => file.replaceAll("\\", "/"));

if (unclassifiedAppPages.length > 0) {
  failures.push(
    `application pages escaped the localization inventory: ${unclassifiedAppPages.join(" | ")}`
  );
}

if (broadNoTranslateFiles.size > 0) {
  failures.push(
    `broad data-no-translate boundaries hide customer/public surfaces: ${[
      ...broadNoTranslateFiles,
    ].join(" | ")}`
  );
}

const dynamicExpressionAudit = auditDynamicVisibleExpressions(
  dynamicVisibleExpressions
);
if (dynamicExpressionAudit.unclassified.length > 0) {
  failures.push(
    `unclassified customer-visible dynamic/composed expression(s): ${summarizeValues(
      dynamicExpressionAudit.unclassified.map(
        ({ file, kind, line, source }) => `${file}:${line} [${kind}] ${source}`
      )
    )}`
  );
}
if (dynamicExpressionAudit.staleReviewed.length > 0) {
  failures.push(
    `stale reviewed dynamic-expression signature(s): ${summarizeValues(
      dynamicExpressionAudit.staleReviewed.map(
        ({ file, kind, source }) => `${file} [${kind}] ${source}`
      )
    )}`
  );
}

for (const locale of locales) {
  const exact = values.filter(
    (value) => isInvariant(value) || dictionaryCovers(value, locale, sourceFilesByValue.get(value))
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
  const criticalMissing = [...criticalExactValues].filter(
    (value) => !dictionaryCovers(value, locale, sourceFilesByValue.get(value))
  );
  const reviewedEnglishFallbacks = values.length - exact.length;
  values
    .filter((value) => !isInvariant(value) && !dictionaryCovers(value, locale, sourceFilesByValue.get(value)))
    .forEach((value) => missingSourceValues.add(value));
  const exactRatio = exact.length / values.length;
  console.log(
    `${locale}: ${exact.length}/${values.length} exact or invariant; ${reviewedEnglishFallbacks} clean English fallbacks`
  );

  if (process.env.I18N_REPORT_FALLBACKS === "1") {
    const fallbackValues = values.filter(
      (value) => !isInvariant(value) && !dictionaryCovers(value, locale, sourceFilesByValue.get(value))
    );
    console.log(`${locale} fallbacks:\n- ${fallbackValues.join("\n- ")}`);
  }

  if (process.env.I18N_REPORT_QUALITY === "1") {
    const pattern = legacyTransliterationPatterns[locale];
    const qualityFindings = pattern
      ? values.flatMap((source) => {
          const translations = [
            exactTranslations[locale][source]
              ? { label: "base-exact", value: exactTranslations[locale][source] }
              : null,
            termTranslations[locale][source]
              ? { label: "base-term", value: termTranslations[locale][source] }
              : null,
            ...supplementalTranslationsFor(source, locale),
          ].filter((entry): entry is { label: string; value: string } => Boolean(entry));
          return translations.flatMap(({ label, value }) =>
            pattern.test(value) ? [`${label}: ${source} => ${value}`] : []
          );
        })
      : [];
    if (qualityFindings.length > 0) {
      console.log(`${locale} legacy transliteration (${qualityFindings.length}):\n- ${qualityFindings.join("\n- ")}`);
    }
  }

  if (exactRatio < 0.68) failures.push(`${locale}: exact coverage dropped below 68%`);
  if (reviewedEnglishFallbacks > 0) {
    failures.push(`${locale}: ${reviewedEnglishFallbacks} reviewed English fallback(s) remain`);
  }
  if (compactMissing.length > 0) {
    failures.push(`${locale} compact labels (${compactMissing.length}): ${summarizeValues(compactMissing)}`);
  }
  if (criticalMissing.length > 0) {
    failures.push(`${locale} critical exact: ${summarizeValues(criticalMissing)}`);
  }
}

if (process.env.I18N_REPORT_SOURCE_GAPS === "1") {
  console.log(
    `\nSource strings missing in at least one locale (${missingSourceValues.size}):\n- ${[
      ...missingSourceValues,
    ].sort((left, right) => left.localeCompare(right)).join("\n- ")}`
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

  for (const [file, entries] of [...byFile].sort(([left], [right]) => left.localeCompare(right))) {
    console.log(`\n${file} (${entries.length})\n- ${entries.sort((left, right) => left.localeCompare(right)).join("\n- ")}`);
  }
}

if (process.env.I18N_REPORT_DYNAMIC === "1") {
  console.log(`\nVisible dynamic expressions (${dynamicVisibleExpressions.length}):`);
  for (const expression of dynamicVisibleExpressions) {
    const classification = dynamicExpressionAudit.classificationFor(expression);
    console.log(
      `${expression.file}:${expression.line} [${expression.kind}] ${expression.source} => ${
        classification ? `reviewed:${classification}` : "UNCLASSIFIED"
      }`
    );
  }
}

if (failures.length > 0) {
  console.error("\nCustomer i18n coverage failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Customer i18n coverage passed for ${locales.length} non-English locales across ${values.length} reviewed source strings.`
);
console.log(
  `Dynamic visible-expression guard passed for ${dynamicVisibleExpressions.length} occurrence(s) across ${reviewedDynamicVisibleExpressions.length} reviewed signature(s).`
);
