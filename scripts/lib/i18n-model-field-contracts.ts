import ts from "typescript";

function propertyName(node: ts.PropertyName) {
  return ts.isIdentifier(node) || ts.isStringLiteral(node) ? node.text : null;
}

function enclosingNames(node: ts.Node) {
  let binding: string | null = null;
  let fn: string | null = null;
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (!binding && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
      binding = parent.name.text;
    }
    if (ts.isFunctionLike(parent)) {
      fn = ts.isFunctionDeclaration(parent) && parent.name ? parent.name.text : null;
      break;
    }
  }
  return { binding, fn };
}

// These are model fields, not UI copy. Only the exact literal declaration is
// structural: a reference rendered elsewhere still goes through sink analysis.
// Each contract has a consumer assertion in i18n-model-field-contracts.test.ts.
export function isReviewedModelField(file: string, node: ts.Node) {
  if (!ts.isPropertyAssignment(node) || !ts.isStringLiteral(node.initializer)) return false;
  const key = propertyName(node.name);
  const value = node.initializer.text;
  const { binding, fn } = enclosingNames(node);
  if (file === "src/lib/creditPackages.ts" && binding === "creditPackages" && !fn && key === "name") {
    const names: Record<string, string> = {
      credits_10: "Starter", credits_50: "Workshop", credits_100: "Professional",
      credits_250: "Partner", credits_500: "Enterprise",
    };
    const id = ts.isObjectLiteralExpression(node.parent)
      ? node.parent.properties.find((item): item is ts.PropertyAssignment =>
          ts.isPropertyAssignment(item) && propertyName(item.name) === "id")
      : undefined;
    return Boolean(id && ts.isStringLiteral(id.initializer) && names[id.initializer.text] === value);
  }
  if (file === "src/lib/seo.ts" && fn === "organizationJsonLd" && key === "name" && value === "Melih Gokkaya") {
    const founder = node.parent.parent;
    return ts.isPropertyAssignment(founder) && propertyName(founder.name) === "founder";
  }
  if (file !== "src/lib/logAnalysisStudio.ts") return false;
  if (!fn && binding === "emptyQuality" && key === "label" && value === "limited") return true;
  if (fn === "chooseAxis" && key === "label" && value === "Sample") {
    return ts.isObjectLiteralExpression(node.parent) && node.parent.properties.some((item) =>
      ts.isPropertyAssignment(item) && propertyName(item.name) === "synthetic" &&
      item.initializer.kind === ts.SyntaxKind.TrueKeyword);
  }
  const family = ["Boost pressure", "Rail pressure", "Engine torque", "EGR signal"].includes(value);
  return family && (
    (fn === "buildInsights" && binding === "actualTargetFamilies" && key === "title") ||
    (fn === "unitComparisonWarnings" && binding === "pairs" && key === "label")
  );
}

// The runtime deliberately receives a translator to avoid importing every
// client catalog. Trust this one declared parameter, never arbitrary functions
// named t, sibling files, shadowing bindings or interpolation arguments.
export function isReviewedNotificationTranslatorCall(file: string, call: ts.CallExpression) {
  if (file !== "src/lib/i18n/customer-workflow-client-runtime.ts" ||
      !ts.isIdentifier(call.expression) || call.expression.text !== "t") return false;
  let fn: ts.Node | undefined = call.parent;
  while (fn && !ts.isFunctionLike(fn)) fn = fn.parent;
  if (!fn || !ts.isFunctionDeclaration(fn) || fn.name?.text !== "translateCustomerNotification") return false;
  const parameter = fn.parameters[2];
  if (fn.parameters.length !== 3 || !parameter || !ts.isIdentifier(parameter.name) ||
      parameter.name.text !== "t" || !parameter.type ||
      !ts.isTypeReferenceNode(parameter.type) || !ts.isIdentifier(parameter.type.typeName) ||
      parameter.type.typeName.text !== "CustomerWorkflowTemplateTranslator") return false;
  let shadowed = false;
  const visit = (node: ts.Node) => {
    if (node === parameter) return;
    if ((ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isFunctionDeclaration(node) ||
         ts.isClassDeclaration(node) || ts.isBindingElement(node)) &&
        node.name && ts.isIdentifier(node.name) && node.name.text === "t") shadowed = true;
    ts.forEachChild(node, visit);
  };
  if (fn.body) visit(fn.body);
  return !shadowed;
}
