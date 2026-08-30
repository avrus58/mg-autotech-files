import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import { exactTranslations } from "../src/lib/i18n";
import { supportedLocales, type LocaleCode } from "../src/lib/i18nConfig";
import { publicCoreTranslations } from "../src/lib/i18n/public-core-translations";
import { publicServicesTranslations } from "../src/lib/i18n/public-services-translations";
import {
  publicSurfaceLocaleOrder,
} from "../src/lib/i18n/public-surface-types";
import { publicToolsTranslations } from "../src/lib/i18n/public-tools-translations";
import { publicVehicleTranslations } from "../src/lib/i18n/public-vehicle-translations";

const publicSurfaceTranslations = {
  ...publicCoreTranslations,
  ...publicVehicleTranslations,
  ...publicServicesTranslations,
  ...publicToolsTranslations,
};

const publicSurfaceCatalogsByScope = {
  core: publicCoreTranslations,
  vehicles: publicVehicleTranslations,
  services: publicServicesTranslations,
  tools: publicToolsTranslations,
} as const;

const publicCoreRoots = [
  "src/app/about",
  "src/app/contact",
  "src/app/download/windows",
  "src/app/workshop-guides",
  "src/components/SeoGuidePage.tsx",
  "src/components/PublicSeoHeader.tsx",
  "src/components/Footer.tsx",
] as const;

const publicVehicleRoots = [
  "src/app/brands",
  "src/app/ecu-platforms",
  "src/lib/industry-content.ts",
] as const;

const publicServiceRoots = [
  "src/app/services",
  "src/components/Stage1Authority.tsx",
  "src/components/StageComparison.tsx",
  "src/lib/fileServiceSearchIntents.ts",
  "src/lib/stageTuning.ts",
] as const;

const publicToolRoots = [
  "src/app/tools",
  "src/components/tools",
] as const;

const publicSurfaceRoots = [
  ...publicCoreRoots,
  ...publicVehicleRoots,
  ...publicServiceRoots,
  ...publicToolRoots,
] as const;

const visibleAttributeNames = new Set([
  "alt",
  "aria-description",
  "aria-label",
  "placeholder",
  "title",
]);

const visibleComponentAttributeNames = new Set([
  "description",
  "decision",
  "eyebrow",
  "intro",
  "label",
  "text",
  "value",
]);

const visiblePropertyNames = new Set([
  "a",
  "answer",
  "body",
  "calibrationScope",
  "caption",
  "cardLabel",
  "copy",
  "description",
  "detail",
  "emptyText",
  "emptyTitle",
  "eyebrow",
  "faq",
  "fitSignals",
  "helper",
  "heroTitle",
  "hardwareCondition",
  "intro",
  "intentLabel",
  "intendedFor",
  "items",
  "label",
  "lead",
  "logging",
  "name",
  "note",
  "orderingMethod",
  "q",
  "question",
  "related",
  "requiredInputs",
  "requestChecks",
  "reviewRequirement",
  "reviewChecks",
  "sections",
  "shortTitle",
  "steps",
  "supportingModifications",
  "subtitle",
  "summary",
  "text",
  "title",
  "workflow",
]);

const invariantSources = new Set([
  "AdBlue",
  "Alientech",
  "Auto",
  "AutoTuner",
  "Autotuner",
  "Bench",
  "B57, OM654, EA888...",
  "BMW",
  "BMW 530d G30",
  "Boot",
  "CMD",
  "DPF",
  "DTC",
  "DTC OFF",
  "Datenschutz",
  "ECM Titanium",
  "EDC17, MD1, MG1...",
  "ECU",
  "EGR",
  "EGR OFF",
  "Flex",
  "HP",
  "HW",
  "HW / SW",
  "Impressum",
  "KESS / KTAG",
  "Magic Motorsport",
  "MG",
  "MG AutoTech",
  "MG AutoTech - Melih Gokkaya",
  "Nm",
  "OBD",
  "ORI",
  "P0401, P2002...",
  "Stage 1",
  "Stage 2",
  "Stage 3",
  "DPF OFF",
  "AdBlue OFF",
  "SW",
  "TCU",
  "WinOLS",
  "Widerruf",
  "_blank",
]);

const invariantPatterns = [
  /^[-+.:/\d\s%€]+$/u,
  /^https?:\/\//u,
  /^mailto:/u,
  /^tel:/u,
  /^#[\w-]+$/u,
  /^\/[\w\-./:[\]]+$/u,
  /^\d{4}-\d{2}-\d{2}(?:T.*)?$/u,
  /^(?:BMW|Mercedes-Benz|Audi|Volkswagen|Porsche|Opel|Renault|Peugeot|Bosch|Continental|Siemens|Delphi|Denso|ZF|DSG|VGS|DCT|PDK)(?:\s+[A-Z\d/&.+-]+)*$/u,
  /^(?:P\d{4}|[A-Z]{2,}\d[A-Z\d.-]*)$/u,
];

const equalTranslationAllowlist = new Set([
  "de\u0000AGB",
  "nl\u0000Contact",
  "fr\u0000Contact",
  "de\u0000FAQ",
  "de\u0000Services",
  "fr\u0000FAQ",
  "sq\u0000FAQ",
  "fr\u0000Identification",
  "nl\u0000Platform",
  "nl\u0000Services",
  "tr\u0000Platform",
  "fr\u0000Questions",
  "fr\u0000Services",
  "fr\u0000Transmission",
  ...publicSurfaceLocaleOrder.flatMap((locale) => [
    `${locale}\u0000AUTOTECH`,
    `${locale}\u0000WhatsApp`,
    `${locale}\u0000WhatsApp MG AutoTech`,
  ]),
]);

const legacyQualityPatterns: Partial<
  Record<(typeof publicSurfaceLocaleOrder)[number], readonly RegExp[]>
> = {
  de: [/\b(?:fuer|ueber|zurueck)\b/iu],
  tr: [/\b(?:musteri|guvenli|sifre|giris|kayit|ulke|iletisim)\b/iu],
  fr: [/\b(?:securise|verification|telecharger)\b/iu],
  es: [/\b(?:verificacion|informacion|preparacion|analisis)\b/iu],
  pt: [/\b(?:analise|verificacao|informacao|preparacao)\b/iu],
  sq: [/\b(?:te dhenat|kerkohet)\b/iu],
};

const preservedTechnicalTokens = [
  "MG AutoTech",
  "Mercedes-Benz",
  "Magic Motorsport",
  "ECM Titanium",
  "S tronic",
  "AutoTuner",
  "Alientech",
  "Volkswagen",
  "Continental",
  "Stellantis",
  "WhatsApp",
  "Windows",
  "Siemens",
  "Delphi",
  "Denso",
  "Bosch",
  "Porsche",
  "Renault",
  "Peugeot",
  "WinOLS",
  "Audi",
  "Opel",
  "Ford",
  "BMW",
  "KESS",
  "AdBlue",
  "Stage 1",
  "Stage 2",
  "Stage 3",
  "HW/SW",
  "HW / SW",
  "BlueHDi",
  "HDi",
  "TFSI",
  "TDI",
  "TSI",
  "CDI",
  "EDC16",
  "EDC17",
  "MED17",
  "SIMOS",
  "MD1",
  "MG1",
  "DCM",
  "CRD",
  "DSG",
  "VGS",
  "DCT",
  "PDK",
  "VAG",
  "PSA",
  "OEM",
  "OBD",
  "Bench",
  "Boot",
  "ECU",
  "TCU",
  "DPF",
  "EGR",
  "AGR",
  "SCR",
  "DTC",
  "RPM",
  "kW",
  "HP",
  "PS",
  "Nm",
  "CSV",
  "TSV",
  "TXT",
  "LOG",
  "ZF",
] as const;

function collectFiles(root: string, output: string[]) {
  if (statSync(root).isFile()) {
    output.push(root);
    return;
  }

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const candidate = path.join(root, entry.name);
    if (entry.isDirectory()) collectFiles(candidate, output);
    else if (/\.tsx?$/u.test(entry.name)) output.push(candidate);
  }
}

function propertyName(node: ts.PropertyAssignment) {
  return ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)
    ? node.name.text
    : null;
}

function hasVisibleProperty(node: ts.Node) {
  let current: ts.Node = node;

  while (current.parent && !ts.isSourceFile(current.parent)) {
    const parent = current.parent;

    if (ts.isPropertyAssignment(parent)) {
      const name = propertyName(parent);
      return Boolean(name && visiblePropertyNames.has(name));
    }

    if (
      ts.isParenthesizedExpression(parent) ||
      ts.isArrayLiteralExpression(parent)
    ) {
      current = parent;
      continue;
    }

    if (
      ts.isConditionalExpression(parent) &&
      (parent.whenTrue === current || parent.whenFalse === current)
    ) {
      current = parent;
      continue;
    }

    if (
      ts.isBinaryExpression(parent) &&
      (parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
        parent.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) &&
      parent.right === current
    ) {
      current = parent;
      continue;
    }

    return false;
  }

  return false;
}

function isVisibleJsxExpression(node: ts.Node) {
  let current: ts.Node = node;

  while (current.parent && !ts.isSourceFile(current.parent)) {
    const parent = current.parent;

    if (ts.isJsxExpression(parent)) {
      return !ts.isJsxAttribute(parent.parent);
    }

    if (ts.isParenthesizedExpression(parent)) {
      current = parent;
      continue;
    }

    if (
      ts.isConditionalExpression(parent) &&
      (parent.whenTrue === current || parent.whenFalse === current)
    ) {
      current = parent;
      continue;
    }

    if (
      ts.isBinaryExpression(parent) &&
      (parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
        parent.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) &&
      parent.right === current
    ) {
      current = parent;
      continue;
    }

    return false;
  }

  return false;
}

function isMappedLiteral(node: ts.Node) {
  let current: ts.Node | undefined = node.parent;
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
    current = current.parent;
  }
  return false;
}

function enclosingVariable(node: ts.Node) {
  let current: ts.Node | undefined = node.parent;
  while (current && !ts.isSourceFile(current)) {
    if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name)) {
      return current;
    }
    current = current.parent;
  }
  return null;
}

function enclosingFunctionName(node: ts.Node) {
  let current: ts.Node | undefined = node.parent;
  while (current && !ts.isSourceFile(current)) {
    if (ts.isFunctionDeclaration(current) && current.name) {
      return current.name.text;
    }
    if (
      (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) &&
      ts.isVariableDeclaration(current.parent) &&
      ts.isIdentifier(current.parent.name)
    ) {
      return current.parent.name.text;
    }
    current = current.parent;
  }
  return null;
}

function isRuntimeErrorLiteral(node: ts.Node) {
  const call = node.parent;
  return (
    ts.isCallExpression(call) &&
    ts.isIdentifier(call.expression) &&
    call.expression.text === "setError" &&
    call.arguments.includes(node as ts.Expression)
  );
}

function isVisibleHelperReturn(node: ts.Node) {
  const functionName = enclosingFunctionName(node);
  if (!functionName || !/(?:Message|Label)$|^line$/u.test(functionName)) {
    return false;
  }

  if (functionName === "line") return true;

  let current: ts.Node = node;
  while (current.parent && !ts.isSourceFile(current.parent)) {
    const parent = current.parent;
    if (ts.isReturnStatement(parent)) return parent.expression === current;
    if (ts.isParenthesizedExpression(parent)) {
      current = parent;
      continue;
    }
    if (
      ts.isConditionalExpression(parent) &&
      (parent.whenTrue === current || parent.whenFalse === current)
    ) {
      current = parent;
      continue;
    }
    return false;
  }
  return false;
}

function isVisibleCollectionPush(node: ts.Node) {
  const visibleCollections = new Set([
    "checklist",
    "missing",
    "nextSteps",
    "warnings",
  ]);
  const call = node.parent;
  return (
    ts.isCallExpression(call) &&
    ts.isPropertyAccessExpression(call.expression) &&
    call.expression.name.text === "push" &&
    ts.isIdentifier(call.expression.expression) &&
    visibleCollections.has(call.expression.expression.text) &&
    call.arguments.includes(node as ts.Expression)
  );
}

function isVisibleOptionLiteral(node: ts.Node) {
  const variable = enclosingVariable(node);
  if (
    !variable ||
    !ts.isIdentifier(variable.name) ||
    !/(?:Options|Methods|Goals|Types)$/u.test(variable.name.text) ||
    !variable.initializer ||
    !ts.isArrayLiteralExpression(variable.initializer)
  ) {
    return false;
  }

  let nearestArray: ts.ArrayLiteralExpression | null = null;
  let current: ts.Node | undefined = node.parent;
  while (current && current !== variable) {
    if (ts.isArrayLiteralExpression(current)) {
      nearestArray = current;
      break;
    }
    current = current.parent;
  }

  if (!nearestArray) return false;
  if (nearestArray === variable.initializer) return true;
  if (nearestArray.parent !== variable.initializer) return false;
  return nearestArray.elements[1] === node;
}

function isVisibleNamedResultLiteral(node: ts.Node) {
  const variable = enclosingVariable(node);
  if (!variable || !ts.isIdentifier(variable.name) || !variable.initializer) {
    return false;
  }

  if (variable.name.text === "brief") return true;
  if (variable.name.text !== "primaryMethod") return false;

  let current: ts.Node = node;
  while (current.parent && current.parent !== variable) {
    const parent = current.parent;
    if (
      ts.isConditionalExpression(parent) &&
      (parent.whenTrue === current || parent.whenFalse === current)
    ) {
      current = parent;
      continue;
    }
    if (ts.isParenthesizedExpression(parent)) {
      current = parent;
      continue;
    }
    return false;
  }
  return current === variable.initializer;
}

function isVisibleRuntimeLiteral(node: ts.Node) {
  return (
    isRuntimeErrorLiteral(node) ||
    isVisibleHelperReturn(node) ||
    isVisibleCollectionPush(node) ||
    isVisibleOptionLiteral(node) ||
    isVisibleNamedResultLiteral(node)
  );
}

function normalize(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

function collectSources(roots: readonly string[]) {
  const files: string[] = [];
  roots.forEach((root) => collectFiles(root, files));
  const values = new Set<string>();

  for (const file of [...new Set(files)].sort()) {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );

    const visit = (node: ts.Node) => {
      if (ts.isJsxText(node)) {
        const value = normalize(node.text);
        if (value.length > 1) values.add(value);
      }

      if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name)) {
        if (
          (visibleAttributeNames.has(node.name.text) ||
            visibleComponentAttributeNames.has(node.name.text)) &&
          node.initializer &&
          ts.isStringLiteral(node.initializer)
        ) {
          const value = normalize(node.initializer.text);
          if (value.length > 1) values.add(value);
        }
      }

      if (ts.isStringLiteralLike(node)) {
        const value = normalize(node.text);
        if (
          value.length > 1 &&
          (hasVisibleProperty(node) ||
            isVisibleJsxExpression(node) ||
            isMappedLiteral(node) ||
            isVisibleRuntimeLiteral(node))
        ) {
          values.add(value);
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(source);
  }

  return [...values]
    .filter((value) => !/[{}<>]/u.test(value))
    .filter((value) => !invariantSources.has(value))
    .filter((value) => !invariantPatterns.some((pattern) => pattern.test(value)))
    .sort((left, right) => left.localeCompare(right));
}

export function collectPublicSurfaceSources() {
  return collectSources(publicSurfaceRoots);
}

export function collectPublicSurfaceSourcesByScope() {
  return {
    core: collectSources(publicCoreRoots),
    vehicles: collectSources(publicVehicleRoots),
    services: collectSources(publicServiceRoots),
    tools: collectSources(publicToolRoots),
  } as const;
}

if (process.env.PUBLIC_SURFACE_I18N_GENERATE !== "1") {
test("public-surface catalog uses the complete site locale set", () => {
  const expectedLocales = supportedLocales
    .map(({ code }) => code)
    .filter((code): code is Exclude<LocaleCode, "en"> => code !== "en")
    .sort();

  assert.deepEqual([...publicSurfaceLocaleOrder].sort(), expectedLocales);
});

test("each route scope is independently covered by its lazy-loadable catalog", () => {
  const sourceScopes = collectPublicSurfaceSourcesByScope();

  for (const [scope, sources] of Object.entries(sourceScopes)) {
    const catalog =
      publicSurfaceCatalogsByScope[
        scope as keyof typeof publicSurfaceCatalogsByScope
      ];
    const missing = sources.filter((source) => {
      if (catalog[source]) return false;
      return !publicSurfaceLocaleOrder.every((locale) => {
        const value = exactTranslations[locale][source];
        return Boolean(value?.trim() && value.trim() !== source);
      });
    });

    assert.deepEqual(
      missing,
      [],
      `${scope}: missing route-local copy:\n- ${missing.join("\n- ")}`
    );
  }
});

test("shared public copy has identical tuples across route catalogs", () => {
  const seen = new Map<string, readonly string[]>();
  for (const catalog of Object.values(publicSurfaceCatalogsByScope)) {
    for (const [source, translations] of Object.entries(catalog)) {
      const existing = seen.get(source);
      if (existing) assert.deepEqual(translations, existing, source);
      else seen.set(source, translations);
    }
  }
});

test("every public-surface tuple is complete and does not silently retain English prose", () => {
  for (const [source, translations] of Object.entries(publicSurfaceTranslations)) {
    assert.equal(translations.length, publicSurfaceLocaleOrder.length, source);
    translations.forEach((translation, index) => {
      const locale = publicSurfaceLocaleOrder[index];
      assert.ok(translation.trim(), `${locale}: blank translation for ${source}`);
      if (!equalTranslationAllowlist.has(`${locale}\u0000${source}`)) {
        assert.notEqual(
          translation.trim(),
          source.trim(),
          `${locale}: English fallback for ${source}`
        );
      }
    });
  }
});

test("sentence translations retain terminal punctuation", () => {
  const truncated: string[] = [];

  for (const [source, translations] of Object.entries(publicSurfaceTranslations)) {
    if (!/[.!?]$/u.test(source)) continue;

    translations.forEach((translation, index) => {
      if (!/[.!?。！？][)\]”»]*$/u.test(translation.trim())) {
        truncated.push(
          `${publicSurfaceLocaleOrder[index]}: ${JSON.stringify(source)}`
        );
      }
    });
  }

  assert.deepEqual(
    truncated,
    [],
    `Possibly truncated translations:\n- ${truncated.join("\n- ")}`
  );
});

test("public-surface translations reject known legacy transliterations", () => {
  for (const [source, translations] of Object.entries(publicSurfaceTranslations)) {
    translations.forEach((translation, index) => {
      const locale = publicSurfaceLocaleOrder[index];
      for (const pattern of legacyQualityPatterns[locale] ?? []) {
        assert.doesNotMatch(
          translation,
          pattern,
          `${locale}: legacy transliteration in ${source}`
        );
      }
    });
  }
});

test("shared navigation and workshop language avoids literal false friends", () => {
  assert.deepEqual(publicCoreTranslations.About, [
    "Über uns",
    "Hakkımızda",
    "Over ons",
    "À propos",
    "Chi siamo",
    "Quiénes somos",
    "Sobre nós",
    "O nas",
    "О нас",
    "关于我们",
    "Rreth nesh",
  ]);
  assert.deepEqual(publicCoreTranslations["Workshop tools"], [
    "Werkstatt-Tools",
    "Atölye araçları",
    "Werkplaatstools",
    "Outils d’atelier",
    "Strumenti per officina",
    "Herramientas de taller",
    "Ferramentas de oficina",
    "Narzędzia warsztatowe",
    "Инструменты для мастерской",
    "维修厂工具",
    "Mjete për servis",
  ]);

  const creditWorkflow = publicCoreTranslations[
    "Credits, timelines, messages, versions and revision requests remain visible in one operational workflow."
  ];
  for (const falseFriend of ["Twórcy", "Авторы", "制作人员名单"]) {
    assert.ok(
      creditWorkflow.every((translation) => !translation.includes(falseFriend)),
      falseFriend
    );
  }
});

test("technical brands, controller identifiers and units remain exact", () => {
  const changedTokens: string[] = [];

  for (const [source, translations] of Object.entries(publicSurfaceTranslations)) {
    const requiredTokens = preservedTechnicalTokens.filter((token) =>
      source.includes(token)
    );

    translations.forEach((translation, index) => {
      const locale = publicSurfaceLocaleOrder[index];
      for (const token of requiredTokens) {
        if (!translation.includes(token)) {
          changedTokens.push(`${locale}: ${JSON.stringify(token)} in ${source}`);
        }
      }
    });
  }

  assert.deepEqual(
    changedTokens,
    [],
    `Changed technical tokens:\n- ${changedTokens.join("\n- ")}`
  );
});

test("all visible public-route prose has reviewed exact coverage", () => {
  const sources = collectPublicSurfaceSources();
  const missing = sources.filter((source) => {
    const owned = publicSurfaceTranslations[source];
    if (owned) return false;

    return !publicSurfaceLocaleOrder.every((locale) => {
      const value = exactTranslations[locale][source];
      return Boolean(value?.trim() && value.trim() !== source);
    });
  });

  assert.deepEqual(
    missing,
    [],
    `Missing ${missing.length}/${sources.length} public-surface copy entries:\n- ${missing.join("\n- ")}`
  );
});

test("localized service metrics and metadata never compose English-only fragments", () => {
  const localizedService = readFileSync(
    "src/app/[locale]/services/[slug]/page.tsx",
    "utf8"
  );
  const servicesIndex = readFileSync("src/app/services/page.tsx", "utf8");
  const localizedHome = readFileSync("src/app/[locale]/page.tsx", "utf8");

  assert.match(localizedService, /publicSurfaceExactT/u);
  assert.match(localizedService, /"ECU \/ TCU File Service"/u);
  assert.match(localizedService, /value=\{`\$\{service\.credits\} \$\{labels\.credits\}`\}/u);
  assert.doesNotMatch(localizedService, /\$\{service\.credits\} credits/u);
  assert.match(servicesIndex, /creditCount: service\.credits/u);
  assert.match(servicesIndex, /\{service\.creditCount\} <span>Credits<\/span>/u);
  assert.doesNotMatch(servicesIndex, /badge: `\$\{service\.credits\} credits`/u);
  assert.match(localizedHome, /alt: copy\.title/u);
});

test("request brief output and clipboard are generated in the active locale while raw inputs stay intact", () => {
  const builder = readFileSync(
    "src/components/tools/RequestBriefBuilder.tsx",
    "utf8"
  );

  assert.match(builder, /copy: RequestBriefCopy/u);
  assert.match(builder, /locale: LocaleCode/u);
  assert.match(builder, /\[source\] \?\? source/u);
  assert.doesNotMatch(builder, /public-tools-translations/u);
  assert.match(builder, /line\(copy, "Vehicle", vehicle\)/u);
  assert.match(builder, /line\(copy, "Requested service", t\(serviceGoal\)\)/u);
  assert.match(builder, /t\("Safety note:/u);
  assert.match(builder, /result\.missing\.map\(\(item\) => t\(item\)\)/u);
  assert.match(builder, /navigator\.clipboard\.writeText\(result\.brief\)/u);
  assert.match(builder, /<pre translate="no" data-no-translate/u);
  assert.doesNotMatch(builder, /line\("Vehicle", vehicle\)/u);
  assert.doesNotMatch(builder, /const locale = copy/u);
});

test("public datalog snapshot localizes runtime states and locale-sensitive numbers directly", () => {
  const snapshot = readFileSync(
    "src/components/tools/PublicLogSnapshot.tsx",
    "utf8"
  );

  assert.match(snapshot, /copy: PublicLogSnapshotCopy/u);
  assert.match(snapshot, /locale: LocaleCode/u);
  assert.match(snapshot, /\[source\] \?\? source/u);
  assert.doesNotMatch(snapshot, /public-tools-translations/u);
  assert.match(snapshot, /\{t\(error\)\}/u);
  assert.match(snapshot, /<SnapshotResults result=\{result\} copy=\{copy\} locale=\{locale\} \/>/u);
  assert.match(snapshot, /toLocaleString\(intlLocaleByCode\[locale\]/u);
  assert.match(snapshot, /publicLogT\(copy, "Reading and analyzing the selected log"\)/u);
  assert.doesNotMatch(snapshot, /toLocaleString\("en-US"\)/u);
});
}
