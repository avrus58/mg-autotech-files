import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const sourceExtensions = [".js", ".jsx", ".ts", ".tsx"] as const;

const appUiConventionPattern =
  /^(?:(?:page|layout|template|default|loading|error|global-error|not-found|global-not-found|forbidden|unauthorized|manifest)\.(?:js|jsx|ts|tsx)|(?:icon|apple-icon|opengraph-image|twitter-image)(?:\d+)?\.(?:js|jsx|ts|tsx))$/u;

const inheritedConventionPattern =
  /^(?:layout|template|default|loading|error|global-error|not-found|global-not-found|forbidden|unauthorized)\.(?:js|jsx|ts|tsx)$/u;

export function isCustomerWorkflowAppUiConventionFile(file: string) {
  return appUiConventionPattern.test(path.posix.basename(normalizeFile(file)));
}

type CustomerWorkflowTypedBoundary = {
  file: string;
  localizationImport: string;
  additionalLocalizationImports?: readonly string[];
  catalogDependencies?: readonly string[];
};

export type CustomerWorkflowRouteSurface = {
  exactRoutes: readonly string[];
  prefixRoutes: readonly string[];
  routeSamples: readonly string[];
  sourceFiles: readonly string[];
  typedUiBoundaries: readonly CustomerWorkflowTypedBoundary[];
  runtimeCatalogs?: readonly string[];
  sharedCatalogs?: readonly string[];
  languageSwitcherCatalogs: readonly string[];
};

export type CustomerWorkflowSharedSurface = {
  sourceFiles: readonly string[];
  typedUiBoundaries: readonly CustomerWorkflowTypedBoundary[];
  runtimeCatalogs: readonly string[];
  catalogDependencies: readonly string[];
  catalogDependenciesBySource?: readonly {
    file: string;
    catalogs: readonly string[];
  }[];
};

export type CustomerWorkflowSourceImport = {
  dynamic: boolean;
  resolved: string | null;
  specifier: string;
};

export type CustomerWorkflowRouteClosure = {
  conventionOwners: ReadonlyMap<string, readonly string[]>;
  groupClosures: ReadonlyMap<string, ReadonlySet<string>>;
  importsByFile: ReadonlyMap<string, readonly CustomerWorkflowSourceImport[]>;
};

function normalizeFile(file: string) {
  return file.replaceAll("\\", "/");
}

function sourceKind(file: string) {
  if (file.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (file.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (file.endsWith(".js")) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function parseSourceFile(file: string, sourceText: string) {
  const source = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    sourceKind(file),
  );
  const diagnostics = (
    source as ts.SourceFile & {
      parseDiagnostics: readonly ts.DiagnosticWithLocation[];
    }
  ).parseDiagnostics;
  if (diagnostics.length) {
    const diagnostic = diagnostics[0];
    const location = source.getLineAndCharacterOfPosition(
      diagnostic.start ?? 0,
    );
    throw new Error(
      `${normalizeFile(file)}:${location.line + 1}:${location.character + 1}: ` +
        `source parse failed: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`,
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

function sourceCandidates(base: string) {
  return [
    base,
    ...sourceExtensions.map((extension) => `${base}${extension}`),
    ...sourceExtensions.map((extension) =>
      path.join(base, `index${extension}`),
    ),
  ];
}

export function resolveCustomerWorkflowSourceImport(
  fromFile: string,
  specifier: string,
) {
  const absoluteBase = specifier.startsWith("@/")
    ? path.resolve(process.cwd(), "src", specifier.slice(2))
    : specifier.startsWith(".")
      ? path.resolve(process.cwd(), path.dirname(fromFile), specifier)
      : null;
  if (!absoluteBase) return null;

  const match = sourceCandidates(absoluteBase).find(
    (candidate) =>
      existsSync(candidate) &&
      sourceExtensions.some((extension) => candidate.endsWith(extension)),
  );
  return match ? normalizeFile(path.relative(process.cwd(), match)) : null;
}

export function customerWorkflowSourceImports(file: string) {
  const sourceText = readFileSync(file, "utf8");
  const source = parseSourceFile(file, sourceText);
  const imports: CustomerWorkflowSourceImport[] = [];
  const remember = (specifier: string, dynamic: boolean) => {
    imports.push({
      dynamic,
      resolved: resolveCustomerWorkflowSourceImport(file, specifier),
      specifier,
    });
  };

  source.statements.forEach((statement) => {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      const clause = statement.importClause;
      const namedImports =
        clause?.namedBindings && ts.isNamedImports(clause.namedBindings)
          ? clause.namedBindings.elements
          : [];
      if (
        clause?.isTypeOnly ||
        (!clause?.name &&
          namedImports.length > 0 &&
          namedImports.every((item) => item.isTypeOnly))
      ) {
        return;
      }
      remember(statement.moduleSpecifier.text, false);
      return;
    }
    if (
      ts.isExportDeclaration(statement) &&
      !statement.isTypeOnly &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      const namedExports =
        statement.exportClause && ts.isNamedExports(statement.exportClause)
          ? statement.exportClause.elements
          : [];
      if (
        namedExports.length > 0 &&
        namedExports.every((item) => item.isTypeOnly)
      ) {
        return;
      }
      remember(statement.moduleSpecifier.text, false);
      return;
    }
    if (
      ts.isImportEqualsDeclaration(statement) &&
      !statement.isTypeOnly &&
      ts.isExternalModuleReference(statement.moduleReference) &&
      statement.moduleReference.expression &&
      ts.isStringLiteral(statement.moduleReference.expression)
    ) {
      remember(statement.moduleReference.expression.text, false);
    }
  });

  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      const argument = node.arguments[0];
      if (
        argument &&
        (ts.isStringLiteral(argument) ||
          ts.isNoSubstitutionTemplateLiteral(argument))
      ) {
        remember(argument.text, true);
      } else {
        imports.push({ dynamic: true, resolved: null, specifier: "<dynamic>" });
      }
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "require"
    ) {
      const argument = node.arguments[0];
      if (
        argument &&
        (ts.isStringLiteral(argument) ||
          ts.isNoSubstitutionTemplateLiteral(argument))
      ) {
        remember(argument.text, false);
      } else {
        imports.push({ dynamic: true, resolved: null, specifier: "<dynamic>" });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  return imports;
}

function walkSourceFiles(root: string) {
  if (!existsSync(root)) return [];
  const pending = [root];
  const files: string[] = [];
  while (pending.length) {
    const current = pending.pop()!;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const child = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(child);
      } else if (
        sourceExtensions.some((extension) => entry.name.endsWith(extension))
      ) {
        files.push(normalizeFile(path.relative(process.cwd(), child)));
      }
    }
  }
  return files.sort();
}

function appRouteForFile(file: string) {
  const relative = normalizeFile(file).replace(/^src\/app\/?/u, "");
  const segments = path.posix.dirname(relative).split("/").filter(Boolean);
  const routeSegments = segments.filter(
    (segment) => !/^\(.+\)$/u.test(segment) && !segment.startsWith("@"),
  );
  return routeSegments.length ? `/${routeSegments.join("/")}` : "/";
}

function routeBelongsToSurface(
  route: string,
  surface: Pick<CustomerWorkflowRouteSurface, "exactRoutes" | "prefixRoutes">,
) {
  return (
    surface.exactRoutes.includes(route) ||
    surface.prefixRoutes.some(
      (prefix) => route === prefix.slice(0, -1) || route.startsWith(prefix),
    )
  );
}

function isRouteAncestor(ancestor: string, candidate: string) {
  return (
    ancestor === "/" ||
    candidate === ancestor ||
    candidate.startsWith(`${ancestor}/`)
  );
}

export function customerWorkflowCatalogModuleName(file: string) {
  return (
    path.posix
      .basename(normalizeFile(file))
      .match(/^(.+-translations)\.(?:js|jsx|ts|tsx)$/u)?.[1] ?? null
  );
}

const visibleUiPropertyNames = new Set([
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
  "subtitle",
  "text",
  "title",
  "statusText",
  "unknownLabel",
]);

const customerTranslatorExportNames = new Set([
  "authPageFirstPaintT",
  "customerPortalFirstPaintT",
  "customerAuthFeedbackT",
  "customerPasswordErrorT",
  "customerRuntimeExactT",
  "customerRuntimeT",
  "customerWorkflowExactT",
  "customerWorkflowT",
  "firstPaintT",
  "fileExpertReportT",
  "formatCustomerMessageCount",
  "formatCustomerNewMessageCount",
  "formatFileExpertJobCount",
  "localizeCreditPromotionLabel",
  "localizeCreditTransactionType",
  "localizeCustomerNotification",
  "localizeCustomerOrderStatus",
  "localizeDtcAnalyzerMessage",
  "localizeDtcConfidence",
  "localizeFileExpertAnalyzerEvidence",
  "localizeFileExpertChangeProfile",
  "localizeFileExpertClusterMessage",
  "localizeFileExpertConclusion",
  "localizeFileExpertDetection",
  "localizeFileExpertFeatureLabel",
  "localizeFileExpertFeatureReason",
  "localizeFileExpertFileFormat",
  "localizeFileExpertFileProfile",
  "localizeFileExpertFinding",
  "localizeFileExpertIntegrityIssue",
  "localizeFileExpertReadiness",
  "localizeFileExpertReadScope",
  "localizeFileExpertReview",
  "localizeFileExpertRisk",
  "localizeFileExpertSimilarityMessage",
  "localizeFileExpertStatus",
  "localizeFileExpertVehicleCandidateEvidence",
  "localizeFileExpertVehicleSummary",
  "logStudioAnalysisErrorT",
  "logStudioChannelKindT",
  "logStudioMessageT",
  "logStudioQualityT",
  "logStudioT",
  "performanceReportT",
  "t",
  "translateWidgetSiteExact",
  "widgetSiteT",
  "widgetSitePlanLabel",
  "widgetSiteStatusLabel",
  "widgetT",
]);

function staticPropertyName(name: ts.PropertyName | ts.JsxAttributeName) {
  return ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : "";
}

function hasVisibleLiteral(node: ts.Node): boolean {
  if (
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    ts.isJsxText(node)
  ) {
    return Boolean(node.text.trim());
  }
  if (ts.isTemplateExpression(node)) {
    return Boolean(
      node.head.text.trim() ||
      node.templateSpans.some((span) => span.literal.text.trim()),
    );
  }
  if (ts.isJsxExpression(node) && node.expression) {
    return hasVisibleLiteral(node.expression);
  }
  if (ts.isParenthesizedExpression(node)) {
    return hasVisibleLiteral(node.expression);
  }
  if (ts.isConditionalExpression(node)) {
    return (
      hasVisibleLiteral(node.whenTrue) || hasVisibleLiteral(node.whenFalse)
    );
  }
  return false;
}

export function customerWorkflowSourceLooksLikeUiHelper(
  file: string,
  sourceText: string,
) {
  if (/^src\/(?:app|components)\//u.test(file)) return true;
  if (!file.startsWith("src/lib/")) return false;
  if (
    file === "src/lib/i18nConfig.ts" ||
    customerWorkflowCatalogModuleName(file)
  ) {
    return false;
  }
  const source = parseSourceFile(file, sourceText);
  let visible = false;
  const visit = (node: ts.Node) => {
    if (visible) return;
    if (ts.isJsxText(node) && node.text.trim()) {
      visible = true;
      return;
    }
    if (
      ts.isJsxExpression(node) &&
      node.parent &&
      (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent)) &&
      node.expression &&
      hasVisibleLiteral(node.expression)
    ) {
      visible = true;
      return;
    }
    if (
      ts.isJsxAttribute(node) &&
      visibleUiPropertyNames.has(staticPropertyName(node.name)) &&
      node.initializer &&
      hasVisibleLiteral(node.initializer)
    ) {
      visible = true;
      return;
    }
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const name = ts.isIdentifier(callee)
        ? callee.text
        : ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : "";
      if (customerTranslatorExportNames.has(name)) {
        visible = true;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return visible;
}

const rawExportCache = new Map<string, ReadonlySet<string>>();

// Exact control-data producers. These values select locale behavior but are not
// customer copy. The exemption is export-scoped, so a new sibling export or
// helper file receives no trust automatically.
const reviewedNonCopyProducerExports = new Map<string, ReadonlySet<string>>([
  ["src/lib/i18nConfig.ts", new Set(["intlLocaleByCode"])],
  [
    "src/lib/countries.ts",
    new Set(["getCountryOptions", "normalizeCountryName"]),
  ],
  ["src/lib/useActiveLocale.ts", new Set(["useActiveLocale"])],
]);

const reviewedTypedCollectionSinkDigests = new Map<string, ReadonlySet<string>>(
  [
    [
      "src/components/dashboard/LogAnalysisStudio.tsx->src/lib/logAnalyzer/index.ts",
      new Set([
        "a8c7ee655bcdc27d68129dab5cf5415b8fa202e5d804cf6f79ce08f948e4921b",
      ]),
    ],
  ],
);

function customerWorkflowExpressionDigest(
  expression: ts.Expression,
  source: ts.SourceFile,
) {
  return createHash("sha256")
    .update(expression.getText(source).replace(/\s+/gu, " ").trim())
    .digest("hex");
}

function exportedRawProducerNames(
  file: string,
  trustedTranslatorFiles: ReadonlySet<string>,
  traversal = new Set<string>(),
) {
  const normalizedFile = normalizeFile(file);
  const cached = rawExportCache.get(normalizedFile);
  if (cached) return cached;
  if (traversal.has(normalizedFile)) return new Set<string>();
  const nextTraversal = new Set(traversal);
  nextTraversal.add(normalizedFile);
  const sourceText = readFileSync(normalizedFile, "utf8");
  const source = parseSourceFile(normalizedFile, sourceText);
  const isUnshadowedImport = createLexicalImportIdentityGuard(source);
  const initializers = new Map<string, ts.Expression>();
  const functions = new Map<string, ts.FunctionLikeDeclaration>();
  const exportedNamesByLocal = new Map<string, Set<string>>();
  const translatorNames = new Set<string>();
  const importedRawBindings = new Set<string>();
  const importedRawNamespaces = new Map<string, ReadonlySet<string>>();
  const reexportedRawNames = new Set<string>();
  const rememberExport = (local: string, exported = local) => {
    const names = exportedNamesByLocal.get(local) ?? new Set<string>();
    names.add(exported);
    exportedNamesByLocal.set(local, names);
  };
  const hasModifier = (node: ts.Node, kind: ts.SyntaxKind) =>
    Boolean(
      ts.canHaveModifiers(node) &&
      ts.getModifiers(node)?.some((modifier) => modifier.kind === kind),
    );
  for (const statement of source.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.importClause &&
      !statement.importClause.isTypeOnly
    ) {
      const providerFile = resolveCustomerWorkflowSourceImport(
        normalizedFile,
        statement.moduleSpecifier.text,
      );
      const providerRawExports = providerFile
        ? exportedRawProducerNames(
            providerFile,
            trustedTranslatorFiles,
            nextTraversal,
          )
        : new Set<string>();
      if (statement.importClause.name && providerRawExports.has("default")) {
        importedRawBindings.add(statement.importClause.name.text);
      }
      const bindings = statement.importClause.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings)) {
        if (providerRawExports.size) {
          importedRawNamespaces.set(bindings.name.text, providerRawExports);
        }
      } else if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          if (element.isTypeOnly) continue;
          const imported = (element.propertyName ?? element.name).text;
          if (
            providerFile &&
            trustedTranslatorFiles.has(providerFile) &&
            customerTranslatorExportNames.has(imported)
          ) {
            translatorNames.add(element.name.text);
          }
          if (providerRawExports.has(imported)) {
            importedRawBindings.add(element.name.text);
          }
        }
      }
    }
    if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      const providerFile = resolveCustomerWorkflowSourceImport(
        normalizedFile,
        statement.moduleSpecifier.text,
      );
      const providerRawExports = providerFile
        ? exportedRawProducerNames(
            providerFile,
            trustedTranslatorFiles,
            nextTraversal,
          )
        : new Set<string>();
      if (!statement.exportClause) {
        providerRawExports.forEach((name) => reexportedRawNames.add(name));
      } else if (ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          if (element.isTypeOnly) continue;
          const imported = (element.propertyName ?? element.name).text;
          if (providerRawExports.has(imported)) {
            reexportedRawNames.add(element.name.text);
          }
        }
      }
    }
    if (ts.isFunctionDeclaration(statement) && statement.name) {
      functions.set(statement.name.text, statement);
      if (hasModifier(statement, ts.SyntaxKind.ExportKeyword)) {
        rememberExport(
          statement.name.text,
          hasModifier(statement, ts.SyntaxKind.DefaultKeyword)
            ? "default"
            : statement.name.text,
        );
      }
    }
    if (ts.isVariableStatement(statement)) {
      const exported = hasModifier(statement, ts.SyntaxKind.ExportKeyword);
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer) {
          continue;
        }
        initializers.set(declaration.name.text, declaration.initializer);
        if (
          ts.isArrowFunction(declaration.initializer) ||
          ts.isFunctionExpression(declaration.initializer)
        ) {
          functions.set(declaration.name.text, declaration.initializer);
        }
        if (exported) rememberExport(declaration.name.text);
      }
    }
    if (
      ts.isExportDeclaration(statement) &&
      !statement.moduleSpecifier &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const element of statement.exportClause.elements) {
        rememberExport(
          (element.propertyName ?? element.name).text,
          element.name.text,
        );
      }
    }
  }
  const transparent = (expression: ts.Expression): ts.Expression => {
    let current = expression;
    while (
      ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isTypeAssertionExpression(current) ||
      ts.isNonNullExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isAwaitExpression(current)
    ) {
      current = current.expression;
    }
    return current;
  };
  const functionReturns = (fn: ts.FunctionLikeDeclaration) => {
    if (!fn.body) return [];
    if (!ts.isBlock(fn.body)) return [fn.body];
    const returned: ts.Expression[] = [];
    const visit = (node: ts.Node) => {
      if (node !== fn.body && ts.isFunctionLike(node)) return;
      if (ts.isReturnStatement(node) && node.expression) {
        returned.push(node.expression);
        return;
      }
      ts.forEachChild(node, visit);
    };
    visit(fn.body);
    return returned;
  };
  const addBindingNames = (target: Set<string>, name: ts.BindingName) => {
    if (ts.isIdentifier(name)) {
      target.add(name.text);
      return;
    }
    name.elements.forEach((element) => {
      if (!ts.isOmittedExpression(element))
        addBindingNames(target, element.name);
    });
  };
  const expressionHasRawOutput = (
    expression: ts.Expression,
    seen = new Set<string>(),
    taintedBindings = new Set<string>(),
  ): boolean => {
    const candidate = transparent(expression);
    if (
      ts.isStringLiteral(candidate) ||
      ts.isNoSubstitutionTemplateLiteral(candidate)
    ) {
      return Boolean(candidate.text.trim());
    }
    if (ts.isTemplateExpression(candidate)) {
      return Boolean(
        candidate.head.text.trim() ||
        candidate.templateSpans.some(
          (span) =>
            span.literal.text.trim() ||
            expressionHasRawOutput(
              span.expression,
              new Set(seen),
              taintedBindings,
            ),
        ),
      );
    }
    if (ts.isIdentifier(candidate)) {
      if (taintedBindings.has(candidate.text)) return true;
      if (
        importedRawBindings.has(candidate.text) &&
        isUnshadowedImport(candidate)
      ) {
        return true;
      }
      if (seen.has(candidate.text)) return false;
      const initializer = initializers.get(candidate.text);
      return initializer
        ? expressionHasRawOutput(
            initializer,
            new Set([...seen, candidate.text]),
            taintedBindings,
          )
        : false;
    }
    if (ts.isConditionalExpression(candidate)) {
      return (
        expressionHasRawOutput(
          candidate.whenTrue,
          new Set(seen),
          taintedBindings,
        ) ||
        expressionHasRawOutput(
          candidate.whenFalse,
          new Set(seen),
          taintedBindings,
        )
      );
    }
    if (ts.isBinaryExpression(candidate)) {
      return (
        expressionHasRawOutput(
          candidate.left,
          new Set(seen),
          taintedBindings,
        ) ||
        expressionHasRawOutput(candidate.right, new Set(seen), taintedBindings)
      );
    }
    if (ts.isArrayLiteralExpression(candidate)) {
      return candidate.elements.some((element) =>
        ts.isSpreadElement(element)
          ? expressionHasRawOutput(
              element.expression,
              new Set(seen),
              taintedBindings,
            )
          : expressionHasRawOutput(element, new Set(seen), taintedBindings),
      );
    }
    if (ts.isObjectLiteralExpression(candidate)) {
      return candidate.properties.some((property) =>
        ts.isPropertyAssignment(property)
          ? expressionHasRawOutput(
              property.initializer,
              new Set(seen),
              taintedBindings,
            )
          : ts.isSpreadAssignment(property)
            ? expressionHasRawOutput(
                property.expression,
                new Set(seen),
                taintedBindings,
              )
            : false,
      );
    }
    if (
      ts.isPropertyAccessExpression(candidate) ||
      ts.isElementAccessExpression(candidate)
    ) {
      const owner = transparent(candidate.expression);
      if (ts.isIdentifier(owner) && isUnshadowedImport(owner)) {
        const namespaceExports = importedRawNamespaces.get(owner.text);
        const member = ts.isPropertyAccessExpression(candidate)
          ? candidate.name.text
          : candidate.argumentExpression &&
              (ts.isStringLiteral(candidate.argumentExpression) ||
                ts.isNoSubstitutionTemplateLiteral(
                  candidate.argumentExpression,
                ))
            ? candidate.argumentExpression.text
            : null;
        if (namespaceExports && member && namespaceExports.has(member)) {
          return true;
        }
      }
      return expressionHasRawOutput(owner, new Set(seen), taintedBindings);
    }
    if (ts.isArrowFunction(candidate) || ts.isFunctionExpression(candidate)) {
      return functionReturns(candidate).some((returned) =>
        expressionHasRawOutput(returned, new Set(seen), taintedBindings),
      );
    }
    if (ts.isCallExpression(candidate)) {
      if (
        ts.isIdentifier(candidate.expression) &&
        importedRawBindings.has(candidate.expression.text) &&
        isUnshadowedImport(candidate.expression)
      ) {
        return true;
      }
      if (
        ts.isIdentifier(candidate.expression) &&
        translatorNames.has(candidate.expression.text) &&
        isUnshadowedImport(candidate.expression)
      ) {
        return false;
      }
      if (
        expressionHasRawOutput(
          candidate.expression,
          new Set(seen),
          taintedBindings,
        )
      ) {
        return true;
      }
      if (ts.isIdentifier(candidate.expression)) {
        const name = candidate.expression.text;
        if (!seen.has(name)) {
          const fn = functions.get(name);
          if (fn) {
            const callTaint = new Set(taintedBindings);
            fn.parameters.forEach((parameter, index) => {
              const suppliedArgument = candidate.arguments[index]
                ? transparent(candidate.arguments[index])
                : undefined;
              const argument =
                !suppliedArgument ||
                ts.isVoidExpression(suppliedArgument) ||
                (ts.isIdentifier(suppliedArgument) &&
                  suppliedArgument.text === "undefined" &&
                  isUnshadowedImport(suppliedArgument))
                  ? parameter.initializer
                  : suppliedArgument;
              if (
                argument &&
                expressionHasRawOutput(argument, new Set(seen), callTaint)
              ) {
                addBindingNames(callTaint, parameter.name);
              }
            });
            if (
              functionReturns(fn).some((returned) =>
                expressionHasRawOutput(
                  returned,
                  new Set([...seen, name]),
                  callTaint,
                ),
              )
            ) {
              return true;
            }
          }
        }
      }
      return candidate.arguments.some((argument) =>
        expressionHasRawOutput(argument, new Set(seen), taintedBindings),
      );
    }
    if (ts.isNewExpression(candidate)) {
      const isUnshadowedStringConversion =
        ts.isIdentifier(candidate.expression) &&
        candidate.expression.text === "String" &&
        isUnshadowedImport(candidate.expression);
      return Boolean(
        isUnshadowedStringConversion &&
        candidate.arguments?.some((argument) =>
          expressionHasRawOutput(argument, new Set(seen), taintedBindings),
        ),
      );
    }
    if (
      ts.isJsxElement(candidate) ||
      ts.isJsxFragment(candidate) ||
      ts.isJsxSelfClosingElement(candidate)
    ) {
      let raw = false;
      const visit = (node: ts.Node) => {
        if (raw) return;
        if (ts.isJsxText(node) && node.text.trim()) {
          raw = true;
          return;
        }
        if (
          ts.isJsxExpression(node) &&
          node.expression &&
          expressionHasRawOutput(
            node.expression,
            new Set(seen),
            taintedBindings,
          )
        ) {
          raw = true;
          return;
        }
        ts.forEachChild(node, visit);
      };
      visit(candidate);
      return raw;
    }
    return false;
  };
  const rawExports = new Set<string>(reexportedRawNames);
  for (const [local, exportedNames] of exportedNamesByLocal) {
    const fn = functions.get(local);
    const raw = fn
      ? functionReturns(fn).some((returned) =>
          expressionHasRawOutput(returned, new Set([local])),
        )
      : Boolean(
          initializers.get(local) &&
          expressionHasRawOutput(initializers.get(local)!, new Set([local])),
        );
    if (raw) exportedNames.forEach((name) => rawExports.add(name));
  }
  reviewedNonCopyProducerExports
    .get(normalizedFile)
    ?.forEach((name) => rawExports.delete(name));
  rawExportCache.set(normalizedFile, rawExports);
  return rawExports;
}

function consumerRendersImportedRawProducer(
  consumerFile: string,
  providerFile: string,
  trustedTranslatorFiles: ReadonlySet<string>,
  translatorProviderIsCompatible: (file: string) => boolean,
) {
  const reviewedNonCopyExports =
    reviewedNonCopyProducerExports.get(providerFile) ?? new Set<string>();
  const rawExports = new Set(
    [...exportedRawProducerNames(providerFile, trustedTranslatorFiles)].filter(
      (name) => !reviewedNonCopyExports.has(name),
    ),
  );
  if (!rawExports.size) return false;
  const sourceText = readFileSync(consumerFile, "utf8");
  const source = parseSourceFile(consumerFile, sourceText);
  const isUnshadowedImport = createLexicalImportIdentityGuard(source);
  const producerBindings = new Set<string>();
  const namespaceBindings = new Set<string>();
  const translatorBindings = new Set<string>();
  for (const statement of source.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      resolveCustomerWorkflowSourceImport(
        consumerFile,
        statement.moduleSpecifier.text,
      ) !== providerFile ||
      !statement.importClause
    ) {
      continue;
    }
    if (statement.importClause.name && rawExports.has("default")) {
      producerBindings.add(statement.importClause.name.text);
    }
    const bindings = statement.importClause.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings)) {
      namespaceBindings.add(bindings.name.text);
    } else if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        const imported = (element.propertyName ?? element.name).text;
        if (rawExports.has(imported)) producerBindings.add(element.name.text);
      }
    }
  }
  if (!producerBindings.size && !namespaceBindings.size) return false;
  for (const statement of source.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      !statement.importClause?.namedBindings ||
      !ts.isNamedImports(statement.importClause.namedBindings)
    ) {
      continue;
    }
    const translatorProvider = resolveCustomerWorkflowSourceImport(
      consumerFile,
      statement.moduleSpecifier.text,
    );
    if (
      !translatorProvider ||
      !trustedTranslatorFiles.has(translatorProvider) ||
      !translatorProviderIsCompatible(translatorProvider)
    ) {
      continue;
    }
    for (const element of statement.importClause.namedBindings.elements) {
      const imported = (element.propertyName ?? element.name).text;
      if (customerTranslatorExportNames.has(imported)) {
        translatorBindings.add(element.name.text);
      }
    }
  }
  const localInitializers = new Map<string, ts.Expression>();
  const localFunctions = new Map<string, ts.FunctionLikeDeclaration>();
  const index = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    ) {
      localInitializers.set(node.name.text, node.initializer);
      if (
        ts.isArrowFunction(node.initializer) ||
        ts.isFunctionExpression(node.initializer)
      ) {
        localFunctions.set(node.name.text, node.initializer);
      }
    }
    if (ts.isFunctionDeclaration(node) && node.name) {
      localFunctions.set(node.name.text, node);
    }
    ts.forEachChild(node, index);
  };
  index(source);
  const transparent = (expression: ts.Expression): ts.Expression => {
    let current = expression;
    while (
      ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isTypeAssertionExpression(current) ||
      ts.isNonNullExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isAwaitExpression(current)
    ) {
      current = current.expression;
    }
    return current;
  };
  const functionReturns = (fn: ts.FunctionLikeDeclaration) => {
    if (!fn.body) return [];
    if (!ts.isBlock(fn.body)) return [fn.body];
    const returned: ts.Expression[] = [];
    const visit = (node: ts.Node) => {
      if (node !== fn.body && ts.isFunctionLike(node)) return;
      if (ts.isReturnStatement(node) && node.expression) {
        returned.push(node.expression);
        return;
      }
      ts.forEachChild(node, visit);
    };
    visit(fn.body);
    return returned;
  };
  const addBindingNames = (target: Set<string>, name: ts.BindingName) => {
    if (ts.isIdentifier(name)) {
      target.add(name.text);
      return;
    }
    name.elements.forEach((element) => {
      if (!ts.isOmittedExpression(element))
        addBindingNames(target, element.name);
    });
  };
  const dependsOnProducer = (
    expression: ts.Expression,
    seen = new Set<string>(),
    taintedBindings = new Set<string>(),
  ): boolean => {
    const candidate = transparent(expression);
    if (ts.isIdentifier(candidate)) {
      if (taintedBindings.has(candidate.text)) return true;
      if (
        producerBindings.has(candidate.text) &&
        isUnshadowedImport(candidate)
      ) {
        return true;
      }
      if (seen.has(candidate.text)) return false;
      const initializer = localInitializers.get(candidate.text);
      return initializer
        ? dependsOnProducer(
            initializer,
            new Set([...seen, candidate.text]),
            taintedBindings,
          )
        : false;
    }
    if (
      ts.isPropertyAccessExpression(candidate) ||
      ts.isElementAccessExpression(candidate)
    ) {
      const owner = transparent(candidate.expression);
      if (
        ts.isIdentifier(owner) &&
        namespaceBindings.has(owner.text) &&
        isUnshadowedImport(owner)
      ) {
        const member = ts.isPropertyAccessExpression(candidate)
          ? candidate.name.text
          : candidate.argumentExpression &&
              (ts.isStringLiteral(candidate.argumentExpression) ||
                ts.isNoSubstitutionTemplateLiteral(
                  candidate.argumentExpression,
                ))
            ? candidate.argumentExpression.text
            : null;
        return Boolean(member && rawExports.has(member));
      }
      return dependsOnProducer(
        candidate.expression,
        new Set(seen),
        taintedBindings,
      );
    }
    if (ts.isCallExpression(candidate)) {
      if (
        ts.isIdentifier(candidate.expression) &&
        producerBindings.has(candidate.expression.text) &&
        isUnshadowedImport(candidate.expression)
      ) {
        return true;
      }
      if (
        ts.isIdentifier(candidate.expression) &&
        translatorBindings.has(candidate.expression.text) &&
        isUnshadowedImport(candidate.expression)
      ) {
        return false;
      }
      const memberName =
        ts.isPropertyAccessExpression(candidate.expression) ||
        ts.isElementAccessExpression(candidate.expression)
          ? ts.isPropertyAccessExpression(candidate.expression)
            ? candidate.expression.name.text
            : candidate.expression.argumentExpression &&
                (ts.isStringLiteral(candidate.expression.argumentExpression) ||
                  ts.isNoSubstitutionTemplateLiteral(
                    candidate.expression.argumentExpression,
                  ))
              ? candidate.expression.argumentExpression.text
              : null
          : null;
      if (
        (memberName === "map" || memberName === "flatMap") &&
        (ts.isPropertyAccessExpression(candidate.expression) ||
          ts.isElementAccessExpression(candidate.expression))
      ) {
        const callback = candidate.arguments[0];
        if (
          callback &&
          (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))
        ) {
          const callbackTaint = new Set(taintedBindings);
          const receiverIsRaw = dependsOnProducer(
            candidate.expression.expression,
            new Set(seen),
            taintedBindings,
          );
          if (receiverIsRaw && callback.parameters[0]) {
            addBindingNames(callbackTaint, callback.parameters[0].name);
          }
          const callbackReturnsRaw = functionReturns(callback).some(
            (returned) =>
              dependsOnProducer(returned, new Set(seen), callbackTaint),
          );
          if (callbackReturnsRaw) return true;
          const receiver = transparent(candidate.expression.expression);
          const reviewedSinkKey = `${consumerFile}->${providerFile}`;
          const digest = customerWorkflowExpressionDigest(candidate, source);
          if (
            ts.isArrayLiteralExpression(receiver) ||
            reviewedTypedCollectionSinkDigests.get(reviewedSinkKey)?.has(digest)
          ) {
            return false;
          }
        }
      }
      if (
        dependsOnProducer(candidate.expression, new Set(seen), taintedBindings)
      ) {
        return true;
      }
      if (ts.isIdentifier(candidate.expression)) {
        const name = candidate.expression.text;
        if (!seen.has(name)) {
          const fn = localFunctions.get(name);
          if (fn) {
            const callTaint = new Set(taintedBindings);
            fn.parameters.forEach((parameter, index) => {
              const suppliedArgument = candidate.arguments[index]
                ? transparent(candidate.arguments[index])
                : undefined;
              const argument =
                !suppliedArgument ||
                ts.isVoidExpression(suppliedArgument) ||
                (ts.isIdentifier(suppliedArgument) &&
                  suppliedArgument.text === "undefined" &&
                  isUnshadowedImport(suppliedArgument))
                  ? parameter.initializer
                  : suppliedArgument;
              if (
                argument &&
                dependsOnProducer(argument, new Set(seen), callTaint)
              ) {
                addBindingNames(callTaint, parameter.name);
              }
            });
            if (
              functionReturns(fn).some((returned) =>
                dependsOnProducer(
                  returned,
                  new Set([...seen, name]),
                  callTaint,
                ),
              )
            ) {
              return true;
            }
          }
        }
      }
      return candidate.arguments.some((argument) =>
        dependsOnProducer(argument, new Set(seen), taintedBindings),
      );
    }
    if (ts.isNewExpression(candidate)) {
      const isUnshadowedStringConversion =
        ts.isIdentifier(candidate.expression) &&
        candidate.expression.text === "String" &&
        isUnshadowedImport(candidate.expression);
      return Boolean(
        isUnshadowedStringConversion &&
        candidate.arguments?.some((argument) =>
          dependsOnProducer(argument, new Set(seen), taintedBindings),
        ),
      );
    }
    if (ts.isConditionalExpression(candidate)) {
      return (
        dependsOnProducer(candidate.whenTrue, new Set(seen), taintedBindings) ||
        dependsOnProducer(candidate.whenFalse, new Set(seen), taintedBindings)
      );
    }
    if (ts.isBinaryExpression(candidate)) {
      const operator = candidate.operatorToken.kind;
      if (operator === ts.SyntaxKind.AmpersandAmpersandToken) {
        // The left operand is a render guard; React receives only the right
        // operand when it is truthy.
        return dependsOnProducer(
          candidate.right,
          new Set(seen),
          taintedBindings,
        );
      }
      if (
        operator === ts.SyntaxKind.BarBarToken ||
        operator === ts.SyntaxKind.QuestionQuestionToken ||
        operator === ts.SyntaxKind.PlusToken
      ) {
        return (
          dependsOnProducer(candidate.left, new Set(seen), taintedBindings) ||
          dependsOnProducer(candidate.right, new Set(seen), taintedBindings)
        );
      }
      // Comparisons and boolean/arithmetic guards may depend on a provider,
      // but their result is not the provider's customer-visible copy.
      return false;
    }
    if (ts.isTemplateExpression(candidate)) {
      return candidate.templateSpans.some((span) =>
        dependsOnProducer(span.expression, new Set(seen), taintedBindings),
      );
    }
    if (ts.isArrayLiteralExpression(candidate)) {
      return candidate.elements.some((element) =>
        ts.isSpreadElement(element)
          ? dependsOnProducer(
              element.expression,
              new Set(seen),
              taintedBindings,
            )
          : dependsOnProducer(element, new Set(seen), taintedBindings),
      );
    }
    if (ts.isObjectLiteralExpression(candidate)) {
      return candidate.properties.some((property) =>
        ts.isPropertyAssignment(property)
          ? dependsOnProducer(
              property.initializer,
              new Set(seen),
              taintedBindings,
            )
          : ts.isSpreadAssignment(property)
            ? dependsOnProducer(
                property.expression,
                new Set(seen),
                taintedBindings,
              )
            : false,
      );
    }
    if (ts.isArrowFunction(candidate) || ts.isFunctionExpression(candidate)) {
      return functionReturns(candidate).some((returned) =>
        dependsOnProducer(returned, new Set(seen), taintedBindings),
      );
    }
    if (
      ts.isJsxElement(candidate) ||
      ts.isJsxFragment(candidate) ||
      ts.isJsxSelfClosingElement(candidate)
    ) {
      let raw = false;
      const visitJsx = (node: ts.Node) => {
        if (raw) return;
        if (ts.isJsxExpression(node) && node.expression) {
          const attribute = ts.isJsxAttribute(node.parent) ? node.parent : null;
          if (
            (!attribute ||
              visibleUiPropertyNames.has(staticPropertyName(attribute.name))) &&
            dependsOnProducer(node.expression, new Set(seen), taintedBindings)
          ) {
            raw = true;
            return;
          }
        }
        ts.forEachChild(node, visitJsx);
      };
      visitJsx(candidate);
      return raw;
    }
    return false;
  };
  let visible = false;
  const visit = (node: ts.Node) => {
    if (visible) return;
    if (ts.isJsxExpression(node) && node.expression) {
      const attribute = ts.isJsxAttribute(node.parent) ? node.parent : null;
      if (
        (!attribute ||
          visibleUiPropertyNames.has(staticPropertyName(attribute.name))) &&
        dependsOnProducer(node.expression)
      ) {
        visible = true;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return visible;
}

function isAuditableSourceSpecifier(specifier: string) {
  if (!specifier.startsWith("@/") && !specifier.startsWith(".")) return false;
  const extension = path.posix.extname(specifier);
  return (
    !extension ||
    sourceExtensions.includes(extension as (typeof sourceExtensions)[number])
  );
}

export function auditCustomerWorkflowRouteClosure(
  surfaces: Readonly<Record<string, CustomerWorkflowRouteSurface>>,
  sharedSurfaces: Readonly<Record<string, CustomerWorkflowSharedSurface>>,
  externalConventionBoundaries: readonly string[],
): CustomerWorkflowRouteClosure {
  // The raw-export cache is manifest-sensitive because only exact manifest-owned
  // localization modules may suppress raw-copy propagation.
  rawExportCache.clear();
  const groups = Object.keys(surfaces);
  const explicitGroupOwners = new Map<string, string[]>();
  const sharedFileOwners = new Map<string, string>();
  const typedBoundaries = new Map<
    string,
    {
      groups: Set<string>;
      catalogDependencies: Set<string>;
      localizationImports: Set<string>;
      sharedSurfaces: Set<string>;
    }
  >();
  const groupCatalogs = new Map<string, Set<string>>();
  const sharedSurfaceCatalogs = new Map<string, Set<string>>();
  const sharedSurfaceDependencies = new Map<string, Set<string>>();
  const sharedSourceCatalogDependencies = new Map<string, Set<string>>();
  const sharedCatalogs = new Set<string>();
  const sharedCatalogReferences: Array<{ catalog: string; group: string }> = [];
  const catalogOwners = new Map<string, Set<string>>();
  const catalogByFile = new Map<string, string>();
  const externalBoundaries = new Set(externalConventionBoundaries);
  const errors: string[] = [];

  const rememberTypedBoundary = (
    file: string,
    localizationImports: readonly string[],
    catalogDependencies: readonly string[],
    owner: { kind: "group" | "shared"; name: string },
  ) => {
    const existing = typedBoundaries.get(file);
    const importSet = new Set(localizationImports);
    const dependencySet = new Set(catalogDependencies);
    if (
      existing &&
      (existing.localizationImports.size !== importSet.size ||
        [...existing.localizationImports].some(
          (item) => !importSet.has(item),
        ) ||
        existing.catalogDependencies.size !== dependencySet.size ||
        [...existing.catalogDependencies].some(
          (item) => !dependencySet.has(item),
        ))
    ) {
      errors.push(`${file}: conflicting typed localization import allowlists`);
      return;
    }
    const boundary = existing ?? {
      groups: new Set<string>(),
      catalogDependencies: dependencySet,
      localizationImports: importSet,
      sharedSurfaces: new Set<string>(),
    };
    if (owner.kind === "group") {
      if (
        boundary.sharedSurfaces.size ||
        (boundary.groups.size && !boundary.groups.has(owner.name))
      ) {
        errors.push(
          `${file}: typed localization boundary must be exactly group-owned or shared`,
        );
      }
      boundary.groups.add(owner.name);
    } else {
      if (boundary.groups.size) {
        errors.push(
          `${file}: typed localization boundary cannot be both group-owned and shared`,
        );
      }
      if (
        boundary.sharedSurfaces.size &&
        !boundary.sharedSurfaces.has(owner.name)
      ) {
        errors.push(`${file}: typed boundary must have one exact shared owner`);
      }
      boundary.sharedSurfaces.add(owner.name);
    }
    typedBoundaries.set(file, boundary);
  };

  const resolveCatalogFile = (catalog: string) => {
    const base = path.resolve(process.cwd(), "src/lib/i18n", catalog);
    const matches = sourceCandidates(base).filter(
      (candidate) =>
        existsSync(candidate) &&
        sourceExtensions.some((extension) => candidate.endsWith(extension)),
    );
    if (matches.length !== 1) {
      errors.push(
        `${catalog}: catalog manifest entry must resolve to exactly one JS/JSX/TS/TSX source (found ${matches.length})`,
      );
      return null;
    }
    return normalizeFile(path.relative(process.cwd(), matches[0]));
  };

  const rememberOwnedCatalog = (catalog: string, owner: string) => {
    const sourceFile = resolveCatalogFile(catalog);
    if (sourceFile) {
      const moduleName = customerWorkflowCatalogModuleName(sourceFile);
      if (moduleName !== catalog) {
        errors.push(
          `${catalog}: exact catalog source ${sourceFile} has module name ${moduleName ?? "<not-a-catalog>"}`,
        );
      }
      const existing = catalogByFile.get(sourceFile);
      if (existing && existing !== catalog) {
        errors.push(
          `${sourceFile}: conflicting catalog manifest names ${existing}, ${catalog}`,
        );
      }
      catalogByFile.set(sourceFile, catalog);
    }
    const owners = catalogOwners.get(catalog) ?? new Set<string>();
    owners.add(owner);
    catalogOwners.set(catalog, owners);
  };

  const rememberGroupCatalog = (group: string, catalog: string) => {
    const allowed = groupCatalogs.get(group) ?? new Set<string>();
    allowed.add(catalog);
    groupCatalogs.set(group, allowed);
    rememberOwnedCatalog(catalog, `group:${group}`);
  };

  for (const [group, surface] of Object.entries(surfaces)) {
    const routeSamples = new Set(surface.routeSamples);
    if (routeSamples.size !== surface.routeSamples.length) {
      errors.push(`${group}: duplicate route sample`);
    }
    for (const route of surface.exactRoutes) {
      if (!routeSamples.has(route)) {
        errors.push(
          `${group}: exact route ${route} requires an identical convention route sample`,
        );
      }
    }
    for (const prefix of surface.prefixRoutes) {
      if (!surface.routeSamples.some((sample) => sample.startsWith(prefix))) {
        errors.push(
          `${group}: prefix route ${prefix} requires a descendant convention route sample`,
        );
      }
    }
    for (const sample of surface.routeSamples) {
      if (!routeBelongsToSurface(sample, surface)) {
        errors.push(
          `${group}: route sample ${sample} is not covered by its exact/prefix routes`,
        );
      }
    }
    for (const file of surface.sourceFiles) {
      const owners = explicitGroupOwners.get(file) ?? [];
      owners.push(group);
      explicitGroupOwners.set(file, owners);
    }
    for (const boundary of surface.typedUiBoundaries) {
      rememberTypedBoundary(
        boundary.file,
        [
          boundary.localizationImport,
          ...(boundary.additionalLocalizationImports ?? []),
        ],
        boundary.catalogDependencies ?? [],
        { kind: "group", name: group },
      );
    }
    for (const catalog of surface.runtimeCatalogs ?? []) {
      rememberGroupCatalog(group, catalog);
    }
    for (const catalog of surface.sharedCatalogs ?? []) {
      sharedCatalogReferences.push({ catalog, group });
      const allowed = groupCatalogs.get(group) ?? new Set<string>();
      allowed.add(catalog);
      groupCatalogs.set(group, allowed);
    }
  }
  for (const [sharedName, surface] of Object.entries(sharedSurfaces)) {
    surface.sourceFiles.forEach((file) => {
      const existing = sharedFileOwners.get(file);
      if (existing && existing !== sharedName) {
        errors.push(`${file}: shared source must have one exact shared owner`);
      }
      sharedFileOwners.set(file, sharedName);
    });
    surface.typedUiBoundaries.forEach((boundary) =>
      rememberTypedBoundary(
        boundary.file,
        [
          boundary.localizationImport,
          ...(boundary.additionalLocalizationImports ?? []),
        ],
        boundary.catalogDependencies ?? [],
        { kind: "shared", name: sharedName },
      ),
    );
    const ownedCatalogs = new Set(surface.runtimeCatalogs);
    sharedSurfaceCatalogs.set(sharedName, ownedCatalogs);
    const dependencies = new Set(surface.catalogDependencies);
    sharedSurfaceDependencies.set(sharedName, dependencies);
    for (const entry of surface.catalogDependenciesBySource ?? []) {
      const key = `${sharedName}:${entry.file}`;
      if (!surface.sourceFiles.includes(entry.file)) {
        errors.push(
          `${entry.file}: shared catalog dependency allowlist must name an exact ${sharedName} source`,
        );
      }
      if (sharedSourceCatalogDependencies.has(key)) {
        errors.push(
          `${entry.file}: duplicate shared catalog dependency allowlist`,
        );
      }
      const catalogs = new Set(entry.catalogs);
      if (catalogs.size !== entry.catalogs.length) {
        errors.push(`${entry.file}: duplicate shared catalog dependency`);
      }
      for (const catalog of catalogs) {
        if (!dependencies.has(catalog)) {
          errors.push(
            `${entry.file}: shared source catalog ${catalog} is not declared by ${sharedName}`,
          );
        }
      }
      sharedSourceCatalogDependencies.set(key, catalogs);
    }
    for (const catalog of ownedCatalogs) {
      sharedCatalogs.add(catalog);
      rememberOwnedCatalog(catalog, `shared:${sharedName}`);
    }
  }

  for (const { catalog, group } of sharedCatalogReferences) {
    if (!sharedCatalogs.has(catalog)) {
      errors.push(
        `${catalog}: ${group} declares a compact shared catalog without an exact shared-manifest owner`,
      );
    }
  }

  for (const [group, surface] of Object.entries(surfaces)) {
    const loaderCatalogs = new Set(surface.languageSwitcherCatalogs);
    if (loaderCatalogs.size !== surface.languageSwitcherCatalogs.length) {
      errors.push(`${group}: duplicate LanguageSwitcher compact catalog`);
    }
    const allowed = groupCatalogs.get(group) ?? new Set<string>();
    for (const catalog of loaderCatalogs) {
      if (!allowed.has(catalog)) {
        errors.push(
          `${group}: LanguageSwitcher catalog ${catalog} is not owned/shared by this route group`,
        );
      }
    }
  }

  for (const [sharedName, dependencies] of sharedSurfaceDependencies) {
    for (const catalog of dependencies) {
      if (!catalogOwners.has(catalog)) {
        errors.push(
          `${catalog}: ${sharedName} declares a catalog dependency without an exact manifest owner`,
        );
      }
    }
  }
  for (const [file, boundary] of typedBoundaries) {
    for (const catalog of boundary.catalogDependencies) {
      if (!catalogOwners.has(catalog)) {
        errors.push(
          `${file}: typed boundary dependency ${catalog} has no exact manifest owner`,
        );
      }
    }
  }

  for (const [file, boundary] of typedBoundaries) {
    const sourceOwners = explicitGroupOwners.get(file) ?? [];
    if (boundary.sharedSurfaces.size) {
      if (sourceOwners.length) {
        errors.push(
          `${file}: shared typed boundary cannot also be group-owned by ${sourceOwners.join(", ")}`,
        );
      }
      continue;
    }
    const conflictingOwners = sourceOwners.filter(
      (owner) => !boundary.groups.has(owner),
    );
    if (conflictingOwners.length) {
      errors.push(
        `${file}: typed boundary owner disagrees with source owner ${conflictingOwners.join(", ")}`,
      );
    }
    if (sharedFileOwners.has(file)) {
      errors.push(`${file}: group-owned typed boundary cannot also be shared`);
    }
  }

  for (const [catalog, owners] of catalogOwners) {
    if (owners.size !== 1) {
      errors.push(
        `${catalog}: catalog must have one exact group/shared owner (found ${[...owners].join(", ")})`,
      );
    }
  }

  for (const [file, owners] of explicitGroupOwners) {
    if (owners.length !== 1) {
      errors.push(
        `${file}: expected one compact catalog owner, found ${owners.join(", ")}`,
      );
    }
    if (sharedFileOwners.has(file)) {
      errors.push(`${file}: cannot be both group-owned and shared`);
    }
  }

  const conventionOwners = new Map<string, readonly string[]>();
  const conventionFiles = walkSourceFiles(
    path.resolve(process.cwd(), "src/app"),
  ).filter((file) => appUiConventionPattern.test(path.posix.basename(file)));

  for (const file of conventionFiles) {
    const route = appRouteForFile(file);
    const inherited = inheritedConventionPattern.test(
      path.posix.basename(file),
    );
    const owners = inherited
      ? groups.filter(
          (group) =>
            routeBelongsToSurface(route, surfaces[group]) ||
            surfaces[group].routeSamples.some((sample) =>
              isRouteAncestor(route, sample),
            ),
        )
      : groups.filter((group) => routeBelongsToSurface(route, surfaces[group]));
    if (!owners.length) continue;
    conventionOwners.set(file, owners);

    if (route === "/" && externalBoundaries.has(file)) continue;
    if (owners.length > 1) {
      const typedBoundary = typedBoundaries.get(file);
      const isGenuinelySharedTypedBoundary = Boolean(
        typedBoundary &&
        typedBoundary.sharedSurfaces.size > 0 &&
        typedBoundary.groups.size === 0,
      );
      if (!sharedFileOwners.has(file) && !isGenuinelySharedTypedBoundary) {
        errors.push(
          `${file}: inherited customer convention must be explicitly shared across ${owners.join(", ")}`,
        );
      }
      continue;
    }
    const explicitOwners = explicitGroupOwners.get(file) ?? [];
    if (!explicitOwners.includes(owners[0])) {
      errors.push(
        `${file}: customer route convention is absent/misassigned; expected ${owners[0]}`,
      );
    }
  }

  for (const file of externalBoundaries) {
    if (!conventionFiles.includes(file)) {
      errors.push(`${file}: stale external convention boundary`);
    }
  }

  const importsByFile = new Map<
    string,
    readonly CustomerWorkflowSourceImport[]
  >();
  const readImports = (file: string) => {
    const cached = importsByFile.get(file);
    if (cached) return cached;
    const imports = customerWorkflowSourceImports(file);
    importsByFile.set(file, imports);
    return imports;
  };
  const groupClosures = new Map<string, ReadonlySet<string>>();
  const forbiddenDependencies = new Set([
    "src/lib/i18n.ts",
    "src/lib/i18n/customer-workflow-dom-observer-baseline.ts",
    "src/lib/i18n/customer-workflow-surface-manifest.ts",
    "src/lib/i18n/customer-workflow-translations.ts",
  ]);
  type TraversalScope =
    | { kind: "group"; group: string }
    | { kind: "shared"; surface: string }
    | { boundary: string; kind: "typed" };
  type PendingSource = { file: string; scope: TraversalScope };
  const scopeKey = (scope: TraversalScope) => {
    if (scope.kind === "shared") return `shared:${scope.surface}`;
    if (scope.kind === "group") return `group:${scope.group}`;
    return `${scope.kind}:${scope.boundary}`;
  };
  const allowedCatalogsForScope = (scope: TraversalScope, file: string) => {
    if (scope.kind === "shared") {
      return new Set([
        ...(sharedSurfaceCatalogs.get(scope.surface) ?? []),
        ...(sharedSourceCatalogDependencies.get(`${scope.surface}:${file}`) ??
          []),
      ]);
    }
    if (scope.kind === "group") {
      return groupCatalogs.get(scope.group) ?? new Set<string>();
    }
    const boundary = typedBoundaries.get(scope.boundary);
    const allowed = new Set<string>();
    boundary?.localizationImports.forEach((specifier) => {
      const resolved = resolveCustomerWorkflowSourceImport(
        scope.boundary,
        specifier,
      );
      const catalog = resolved ? catalogByFile.get(resolved) : null;
      if (catalog) allowed.add(catalog);
    });
    boundary?.catalogDependencies.forEach((catalog) => allowed.add(catalog));
    return allowed;
  };
  const typedScopeFor = (file: string): TraversalScope => ({
    boundary: file,
    kind: "typed",
  });
  const boundaryAcceptsCaller = (
    boundaryFile: string,
    callerScope: TraversalScope,
  ) => {
    const boundary = typedBoundaries.get(boundaryFile);
    if (!boundary) return false;
    if (boundary.sharedSurfaces.size) return true;
    if (callerScope.kind === "group") {
      return boundary.groups.has(callerScope.group);
    }
    if (callerScope.kind === "shared") return false;
    const callerBoundary = typedBoundaries.get(callerScope.boundary);
    return [...boundary.groups].some((group) =>
      callerBoundary?.groups.has(group),
    );
  };
  const trustedTranslatorFiles = new Set([
    ...catalogByFile.keys(),
    ...[...typedBoundaries.keys()].filter((file) =>
      file.startsWith("src/lib/i18n/"),
    ),
  ]);
  const translatorProviderIsCompatible = (
    providerFile: string,
    callerScope: TraversalScope,
    callerFile: string,
  ) => {
    const catalog = catalogByFile.get(providerFile);
    if (catalog) {
      return allowedCatalogsForScope(callerScope, callerFile).has(catalog);
    }
    return Boolean(
      providerFile.startsWith("src/lib/i18n/") &&
      typedBoundaries.has(providerFile) &&
      boundaryAcceptsCaller(providerFile, callerScope),
    );
  };

  const walkClosure = (label: string, roots: readonly PendingSource[]) => {
    const pending = [...roots];
    const visitedScopes = new Set<string>();
    const visitedFiles = new Set<string>();
    while (pending.length) {
      const { file: current, scope } = pending.pop()!;
      const visitKey = `${scopeKey(scope)}:${current}`;
      if (visitedScopes.has(visitKey)) continue;
      visitedScopes.add(visitKey);
      visitedFiles.add(current);
      if (!existsSync(current)) {
        errors.push(`${label}: missing route source ${current}`);
        continue;
      }

      for (const imported of readImports(current)) {
        if (imported.specifier === "<dynamic>") {
          errors.push(`${current}: non-literal module load is not auditable`);
          continue;
        }
        const child = imported.resolved;
        if (!child) {
          if (isAuditableSourceSpecifier(imported.specifier)) {
            errors.push(
              `${current}: unresolved customer UI source import ${imported.specifier}`,
            );
          }
          continue;
        }
        if (forbiddenDependencies.has(child)) {
          errors.push(
            `${current} -> ${child}: compact customer routes cannot depend on the full/audit catalog graph`,
          );
          continue;
        }

        const catalogModule = customerWorkflowCatalogModuleName(child);
        if (catalogModule) {
          const catalog = catalogByFile.get(child);
          if (!catalog) {
            errors.push(
              `${current} -> ${child}: translation catalog has no exact manifest owner`,
            );
            continue;
          }
          const owners = catalogOwners.get(catalog);
          const sharedCatalog = sharedCatalogs.has(catalog);
          if (!owners?.size && !sharedCatalog) {
            errors.push(
              `${current} -> ${child}: generated compact catalog has no exact manifest owner`,
            );
            continue;
          }
          const allowed = allowedCatalogsForScope(scope, current);
          if (!allowed.has(catalog)) {
            const ownerLabel = sharedCatalog
              ? "shared"
              : [...(owners ?? [])].sort().join(", ");
            errors.push(
              `${current} -> ${child}: ${scopeKey(scope)} reaches ${ownerLabel || "unassigned"} compact catalog`,
            );
            continue;
          }
          const sharedOwner = [...(owners ?? [])]
            .find((owner) => owner.startsWith("shared:"))
            ?.slice("shared:".length);
          const groupOwner = [...(owners ?? [])]
            .find((owner) => owner.startsWith("group:"))
            ?.slice("group:".length);
          pending.push({
            file: child,
            scope:
              sharedCatalog && sharedOwner
                ? { kind: "shared", surface: sharedOwner }
                : groupOwner
                  ? { kind: "group", group: groupOwner }
                  : scope,
          });
          continue;
        }

        const otherOwners = explicitGroupOwners.get(child) ?? [];
        const boundary = typedBoundaries.get(child);
        let childScope = scope;
        const sharedOwner = sharedFileOwners.get(child);
        if (
          !otherOwners.length &&
          !boundary &&
          !sharedOwner &&
          consumerRendersImportedRawProducer(
            current,
            child,
            trustedTranslatorFiles,
            (providerFile) =>
              translatorProviderIsCompatible(providerFile, scope, current),
          )
        ) {
          errors.push(
            `${current} -> ${child}: imported raw customer copy reaches visible UI without an exact typed translator`,
          );
          continue;
        }
        if (sharedOwner) {
          childScope = { kind: "shared", surface: sharedOwner };
        } else if (boundary) {
          if (!boundaryAcceptsCaller(child, scope)) {
            errors.push(
              `${current} -> ${child}: ${scopeKey(scope)} cannot enter foreign typed boundary`,
            );
            continue;
          }
          childScope = typedScopeFor(child);
        } else if (otherOwners.length) {
          const ownedByCurrentScope =
            (scope.kind === "group" &&
              otherOwners.length === 1 &&
              otherOwners[0] === scope.group) ||
            (scope.kind === "typed" &&
              otherOwners.length === 1 &&
              Boolean(
                typedBoundaries.get(scope.boundary)?.groups.has(otherOwners[0]),
              ));
          if (!ownedByCurrentScope) {
            errors.push(
              `${current} -> ${child}: ${scopeKey(scope)} reaches ${otherOwners.join(", ")} catalog source`,
            );
            continue;
          }
        } else {
          const sourceText = readFileSync(child, "utf8");
          if (customerWorkflowSourceLooksLikeUiHelper(child, sourceText)) {
            errors.push(
              `${current} -> ${child}: reachable customer UI helper has no exact group/shared/typed classification`,
            );
            continue;
          }
        }
        pending.push({ file: child, scope: childScope });
      }
    }
    return visitedFiles;
  };

  for (const [group, surface] of Object.entries(surfaces)) {
    const typedRoots = [...typedBoundaries]
      .filter(([, boundary]) => boundary.groups.has(group))
      .map(([file]) => file);
    const roots = [...new Set([...surface.sourceFiles, ...typedRoots])].map(
      (file): PendingSource => ({
        file,
        scope: typedBoundaries.has(file)
          ? typedScopeFor(file)
          : { kind: "group", group },
      }),
    );
    groupClosures.set(group, walkClosure(group, roots));
  }

  const sharedRoots = [
    ...[...sharedFileOwners].map(([file, surface]) => ({ file, surface })),
    ...[...typedBoundaries].flatMap(([file, boundary]) =>
      [...boundary.sharedSurfaces].map((surface) => ({ file, surface })),
    ),
  ].map(({ file, surface }): PendingSource => ({
    file,
    scope: typedBoundaries.has(file)
      ? typedScopeFor(file)
      : { kind: "shared", surface },
  }));
  walkClosure("shared customer workflow", sharedRoots);

  for (const [file, boundary] of typedBoundaries) {
    if (!existsSync(file)) {
      errors.push(`${file}: missing typed UI boundary`);
      continue;
    }
    const imports = readImports(file);
    const ownerCatalogs = new Set<string>();
    boundary.groups.forEach((group) =>
      groupCatalogs
        .get(group)
        ?.forEach((catalog) => ownerCatalogs.add(catalog)),
    );
    boundary.sharedSurfaces.forEach((surface) => {
      sharedSurfaceCatalogs
        .get(surface)
        ?.forEach((catalog) => ownerCatalogs.add(catalog));
      sharedSurfaceDependencies
        .get(surface)
        ?.forEach((catalog) => ownerCatalogs.add(catalog));
    });
    for (const localizationImport of boundary.localizationImports) {
      const exactImports = imports.filter(
        (item) => !item.dynamic && item.specifier === localizationImport,
      );
      if (!exactImports.length) {
        errors.push(
          `${file}: typed boundary must statically import ${localizationImport}`,
        );
        continue;
      }
      const resolved = new Set(
        exactImports.map((item) => item.resolved).filter(Boolean),
      );
      if (resolved.size !== 1) {
        errors.push(
          `${file}: typed localization import ${localizationImport} must resolve to exactly one source`,
        );
        continue;
      }
      const catalogFile = [...resolved][0]!;
      const catalog = catalogByFile.get(catalogFile);
      if (!catalog) {
        errors.push(
          `${file}: typed localization import ${localizationImport} must resolve to an exact manifest-owned translation catalog`,
        );
        continue;
      }
      if (!ownerCatalogs.has(catalog)) {
        errors.push(
          `${file}: typed localization import ${localizationImport} resolves to catalog ${catalog} outside its exact owner scope`,
        );
      }
    }
  }

  if (errors.length) {
    throw new Error(
      `Customer workflow route/catalog closure failed:\n${[...new Set(errors)].sort().join("\n")}`,
    );
  }

  return { conventionOwners, groupClosures, importsByFile };
}
