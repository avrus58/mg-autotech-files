import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { exactTranslations, termTranslations } from "../src/lib/i18n";
import { supportedLocales, type LocaleCode } from "../src/lib/i18nConfig";

const customerSurfaceRoots = [
  "src/app/dashboard",
  "src/app/new-request",
  "src/app/login",
  "src/app/register",
  "src/app/forgot-password",
  "src/app/reset-password",
  "src/app/payment",
  "src/components/auth/AuthRequired.tsx",
  "src/components/auth/DeviceVerificationPanel.tsx",
  "src/components/account/TrustedDevicesCard.tsx",
  "src/components/dashboard/DashboardClient.tsx",
] as const;

const invariantValues = new Set([
  "MG",
  "MG AutoTech",
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
]);

const invariantPatterns = [
  /^MGA-\d+$/u,
  /^#[A-F0-9-]+$/u,
  /^P\d{4}$/u,
  /^\d+(?:[.,]\d+)?\s*(?:HP|PS|Nm|kW|MB|GB|KB)$/u,
  /^https?:\/\//u,
  /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/iu,
];

function walk(directory: string, files: string[]) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(filePath, files);
    else if (entry.name.endsWith(".tsx")) files.push(filePath);
  }
}

function collectVisibleStrings() {
  const files: string[] = [];
  const strings = new Set<string>();

  for (const root of customerSurfaceRoots) {
    if (!fs.existsSync(root)) continue;
    if (fs.statSync(root).isDirectory()) walk(root, files);
    else files.push(root);
  }

  for (const file of files) {
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );

    const visibleStringProps = new Set([
      "aria-label",
      "description",
      "emptyText",
      "emptyTitle",
      "eyebrow",
      "label",
      "placeholder",
      "text",
      "title",
    ]);

    const jsxAttributeAncestor = (node: ts.Node) => {
      let current = node.parent;
      while (current && !ts.isSourceFile(current)) {
        if (ts.isJsxAttribute(current)) return current;
        current = current.parent;
      }
      return null;
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
        if (
          ts.isBinaryExpression(current) ||
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

    const visit = (node: ts.Node) => {
      if (ts.isJsxText(node)) {
        const value = node.text.replace(/\s+/gu, " ").trim();
        if (value.length > 1) strings.add(value);
      }

      if (
        ts.isJsxAttribute(node) &&
        ts.isIdentifier(node.name) &&
        visibleStringProps.has(node.name.text)
      ) {
        const value = node.initializer;
        if (value && ts.isStringLiteral(value) && value.text.trim()) {
          strings.add(value.text.trim());
        }
      }

      if (
        ts.isStringLiteral(node) &&
        isVisibleJsxExpressionString(node) &&
        node.text.trim().length > 1
      ) {
        strings.add(node.text.trim());
      }

      ts.forEachChild(node, visit);
    };

    visit(source);
  }

  return [...strings]
    .filter((value) => !/[{}<>]/u.test(value))
    .filter((value) => !/^[-+#.:/\d\s]+$/u.test(value))
    .sort((left, right) => left.localeCompare(right));
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

function dictionaryCovers(value: string, locale: LocaleCode) {
  if (Object.prototype.hasOwnProperty.call(exactTranslations[locale], value)) {
    return Boolean(exactTranslations[locale][value]?.trim());
  }

  if (Object.prototype.hasOwnProperty.call(termTranslations[locale], value)) {
    return Boolean(termTranslations[locale][value]?.trim());
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

const values = collectVisibleStrings();
const locales = supportedLocales
  .map(({ code }) => code)
  .filter((code): code is Exclude<LocaleCode, "en"> => code !== "en");
const failures: string[] = [];

for (const locale of locales) {
  const exact = values.filter(
    (value) => isInvariant(value) || dictionaryCovers(value, locale)
  );
  const compactMissing = values.filter((value) => {
    const wordCount = value.match(/\p{L}+/gu)?.length ?? 0;
    return (
      wordCount <= 6 &&
      !isInvariant(value) &&
      !dictionaryCovers(value, locale) &&
      !compactTermCovers(value, locale)
    );
  });
  const criticalMissing = [...criticalExactValues].filter(
    (value) => !dictionaryCovers(value, locale)
  );
  const reviewedEnglishFallbacks = values.length - exact.length;
  const exactRatio = exact.length / values.length;
  console.log(
    `${locale}: ${exact.length}/${values.length} exact or invariant; ${reviewedEnglishFallbacks} clean English fallbacks`
  );

  if (process.env.I18N_REPORT_FALLBACKS === "1") {
    const fallbackValues = values.filter(
      (value) => !isInvariant(value) && !dictionaryCovers(value, locale)
    );
    console.log(`${locale} fallbacks:\n- ${fallbackValues.join("\n- ")}`);
  }

  if (exactRatio < 0.68) failures.push(`${locale}: exact coverage dropped below 68%`);
  if (reviewedEnglishFallbacks > 0) {
    failures.push(`${locale}: ${reviewedEnglishFallbacks} reviewed English fallback(s) remain`);
  }
  if (compactMissing.length > 0) failures.push(`${locale} compact labels: ${compactMissing.join(" | ")}`);
  if (criticalMissing.length > 0) failures.push(`${locale} critical exact: ${criticalMissing.join(" | ")}`);
}

if (failures.length > 0) {
  console.error("\nCustomer i18n coverage failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Customer i18n coverage passed for ${locales.length} non-English locales across ${values.length} reviewed source strings.`
);
