import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import {
  creditPurchaseCaughtErrorMessage,
  creditPurchaseErrorCodes,
  creditPurchaseErrorMessage,
  creditPurchaseSafeMessages,
} from "../src/lib/creditPurchaseErrorCodes";
import {
  oauthRegistrationFinalizeErrorCodes,
  registrationFinalizeErrorMessage,
} from "../src/lib/oauthRegistrationFinalizeErrors";
import {
  customerWorkflowExactT,
  customerWorkflowExactTranslations,
  customerWorkflowLocaleOrder,
} from "../src/lib/i18n/customer-workflow-translations";
import { customerWorkflowExactT as authWorkflowExactT } from "../src/lib/i18n/customer-workflow-auth-translations";
import { customerWorkflowExactT as creditsWorkflowExactT } from "../src/lib/i18n/customer-workflow-credits-translations";

const oauthFinalizeRoutePath =
  "src/app/api/auth/oauth-registration/finalize/route.ts";
const creditApiRoutePaths = [
  "src/app/api/credits/quote/route.ts",
  "src/app/api/email/bank-transfer/route.ts",
  "src/app/api/stripe/create-checkout-session/route.ts",
] as const;
const callbackPagePath = "src/app/auth/callback/page.tsx";
const creditsPagePath = "src/app/dashboard/credits/page.tsx";

const knownCustomerErrorSources = [
  "We could not verify your access. Please return to login and try again.",
  "Account security verification is temporarily unavailable.",
  "Registration profile could not be finalized. Please try again.",
  "Your updated account could not be verified. Please log in again.",
  ...Object.values(creditPurchaseSafeMessages),
] as const;

function source(path: string) {
  return readFileSync(path, "utf8");
}

function nextResponseJsonObjectKeys(filePath: string) {
  const fileSource = source(filePath);
  const sourceFile = ts.createSourceFile(
    filePath,
    fileSource,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const keys: string[] = [];

  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === "NextResponse" &&
      node.expression.name.text === "json"
    ) {
      const payload = node.arguments[0];
      if (payload && ts.isObjectLiteralExpression(payload)) {
        for (const property of payload.properties) {
          if (ts.isShorthandPropertyAssignment(property)) {
            keys.push(property.name.text);
            continue;
          }
          if (
            (ts.isPropertyAssignment(property) ||
              ts.isMethodDeclaration(property) ||
              ts.isGetAccessorDeclaration(property) ||
              ts.isSetAccessorDeclaration(property)) &&
            property.name
          ) {
            if (
              ts.isIdentifier(property.name) ||
              ts.isStringLiteral(property.name) ||
              ts.isNumericLiteral(property.name)
            ) {
              keys.push(property.name.text);
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return keys;
}

test("stable customer error messages are cataloged in every supported locale", () => {
  for (const english of knownCustomerErrorSources) {
    const translations = customerWorkflowExactTranslations[english];
    assert.ok(translations, `missing exact error catalog row: ${english}`);
    assert.equal(
      translations.length,
      customerWorkflowLocaleOrder.length,
      `incomplete exact error catalog row: ${english}`,
    );

    customerWorkflowLocaleOrder.forEach((locale, localeIndex) => {
      const localized = customerWorkflowExactT(locale, english);
      assert.equal(localized, translations[localeIndex], `${locale}: ${english}`);
      assert.ok(localized.trim(), `${locale}: empty localization for ${english}`);
      assert.notEqual(localized, english, `${locale}: English fallback for ${english}`);
    });
  }
});

test("every OAuth finalization code resolves only to a localized safe source", () => {
  const allowedSources = new Set([
    "Registration profile could not be finalized. Please try again.",
    "Your updated account could not be verified. Please log in again.",
  ]);

  for (const errorCode of oauthRegistrationFinalizeErrorCodes) {
    const english = registrationFinalizeErrorMessage(errorCode);
    assert.ok(allowedSources.has(english), `${errorCode}: unexpected source message`);
    for (const locale of customerWorkflowLocaleOrder) {
      assert.notEqual(
        authWorkflowExactT(locale, english),
        english,
        `${locale}.${errorCode}: unsafe English fallback`,
      );
    }
  }

  assert.equal(
    registrationFinalizeErrorMessage("provider supplied secret detail"),
    "Registration profile could not be finalized. Please try again.",
  );
});

test("every credit-purchase code resolves only to localized safe sources", () => {
  const allowedSources = new Set(Object.values(creditPurchaseSafeMessages));

  for (const errorCode of Object.values(creditPurchaseErrorCodes)) {
    for (const operation of ["quote", "purchase"] as const) {
      const english = creditPurchaseErrorMessage(operation, errorCode);
      assert.ok(
        allowedSources.has(english),
        `${operation}.${errorCode}: unexpected source message`,
      );
      for (const locale of customerWorkflowLocaleOrder) {
        assert.notEqual(
          creditsWorkflowExactT(locale, english),
          english,
          `${locale}.${operation}.${errorCode}: unsafe English fallback`,
        );
      }
    }
  }

  assert.equal(
    creditPurchaseErrorMessage("purchase", "provider supplied secret detail"),
    "Credit purchase could not be started.",
  );
  assert.equal(
    creditPurchaseErrorMessage(
      "purchase",
      creditPurchaseErrorCodes.checkoutUnavailable,
      "bank",
    ),
    creditPurchaseSafeMessages.bankDeliveryFailed,
  );
  assert.equal(
    creditPurchaseErrorMessage(
      "purchase",
      creditPurchaseErrorCodes.checkoutUnavailable,
      "stripe",
    ),
    creditPurchaseSafeMessages.checkoutUnavailable,
  );
  assert.equal(
    creditPurchaseCaughtErrorMessage(
      "purchase",
      new Error(creditPurchaseSafeMessages.stripeAmountUnsupported),
    ),
    creditPurchaseSafeMessages.stripeAmountUnsupported,
  );
  assert.equal(
    creditPurchaseCaughtErrorMessage(
      "purchase",
      new Error("provider supplied secret detail"),
    ),
    creditPurchaseSafeMessages.purchaseFallback,
  );
});

test("customer error API responses expose stable codes, never raw error prose", () => {
  const routePaths = [oauthFinalizeRoutePath, ...creditApiRoutePaths];
  for (const routePath of routePaths) {
    const routeSource = source(routePath);
    const responseKeys = nextResponseJsonObjectKeys(routePath);
    assert.ok(responseKeys.length > 0, `${routePath}: no JSON responses inspected`);
    assert.doesNotMatch(
      responseKeys.join(" "),
      /^(?:error|message)$|\s(?:error|message)(?:\s|$)/u,
      `${routePath}: response payload must not expose raw prose fields`,
    );
    assert.doesNotMatch(
      routeSource,
      /(?:error|exception|cause)\.message|String\((?:error|exception|cause)\)/u,
      `${routePath}: provider/backend exception prose must not enter a response`,
    );
  }

  const oauthRoute = source(oauthFinalizeRoutePath);
  assert.match(oauthRoute, /NextResponse\.json\(\s*\{ errorCode \}/u);
  for (const errorCode of oauthRegistrationFinalizeErrorCodes) {
    assert.match(oauthRoute, new RegExp(`errorResponse\\("${errorCode}"`, "u"));
  }

  const combinedCreditRoutes = creditApiRoutePaths.map(source).join("\n");
  for (const key of Object.keys(creditPurchaseErrorCodes)) {
    assert.match(
      combinedCreditRoutes,
      new RegExp(`creditPurchaseErrorCodes\\.${key}\\b`, "u"),
      `unused stable credit-purchase code: ${key}`,
    );
  }
});

test("auth callback and credit purchase UI never render raw provider error text", () => {
  const callback = source(callbackPagePath);
  assert.match(
    callback,
    /registrationFinalizeErrorMessage\(payload\.errorCode\)/u,
  );
  assert.doesNotMatch(callback, /\b(?:rawMessage|setRawMessage)\b/u);
  assert.doesNotMatch(callback, /\b(?:payload|error)\.error\b/u);
  assert.doesNotMatch(callback, /\b(?:error|exception|cause)\.message\b/u);

  const credits = source(creditsPagePath);
  assert.match(
    credits,
    /creditPurchaseErrorMessage\("quote", payload\.code\)/u,
  );
  assert.match(
    credits,
    /creditPurchaseErrorMessage\("purchase", data\.code, "(?:bank|stripe)"\)/u,
  );
  assert.match(credits, /creditPurchaseCaughtErrorMessage\("quote", error\)/u);
  assert.match(credits, /creditPurchaseCaughtErrorMessage\("purchase", error\)/u);
  assert.match(credits, /customerWorkflowExactT\(\s*locale,\s*quoteError/u);
  assert.match(credits, /customerWorkflowExactT\(locale, notice\.text\)/u);
  assert.doesNotMatch(credits, /\b(?:payload|data|response)\.error\b/u);
  assert.doesNotMatch(credits, /\b(?:error|exception|cause)\.message\b/u);
  assert.doesNotMatch(credits, /\bresponseError\b/u);
});
