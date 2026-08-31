import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import {
  customerPasswordErrorT,
  customerWorkflowExactT,
  customerWorkflowExactTranslations,
  customerWorkflowLocaleOrder,
  customerWorkflowSourceStrings,
  customerWorkflowT,
  customerWorkflowTemplateRows,
  localizeCustomerNotification,
} from "../src/lib/i18n/customer-workflow-translations";

const expectedLocales = ["nl", "de", "fr", "it", "ru", "es", "tr", "pt", "zh", "pl", "sq"] as const;

function placeholders(value: string) {
  return [...value.matchAll(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g)]
    .map((match) => match[1])
    .sort();
}

test("customer workflow catalog covers all eleven non-English locales", () => {
  assert.deepEqual(customerWorkflowLocaleOrder, expectedLocales);
  assert.ok(customerWorkflowSourceStrings.length >= 417);
  assert.equal(
    new Set(customerWorkflowSourceStrings).size,
    customerWorkflowSourceStrings.length,
  );
  assert.equal(customerWorkflowTemplateRows.length, 102);

  for (const [source, translations] of Object.entries(customerWorkflowExactTranslations)) {
    assert.equal(translations.length, expectedLocales.length, source);
    translations.forEach((translation, index) => {
      assert.ok(translation.trim(), `${expectedLocales[index]}: ${source}`);
      if (source.trim().split(/\s+/).length >= 4 && source !== "Hard Cut Limiter (Diesel)") {
        assert.notEqual(translation, source, `${expectedLocales[index]} prose fallback: ${source}`);
      }
    });
  }
});

test("every localized template preserves the exact English placeholder contract", () => {
  for (const row of customerWorkflowTemplateRows) {
    const [key, english, ...localized] = row;
    const expected = placeholders(english);
    assert.equal(localized.length, expectedLocales.length, key);
    localized.forEach((translation, index) => {
      assert.ok(translation.trim(), `${expectedLocales[index]}.${key}`);
      assert.deepEqual(
        placeholders(translation),
        expected,
        `${expectedLocales[index]}.${key} must preserve English placeholder names`,
      );
    });
  }

  assert.equal(customerWorkflowT("de", "payWith", { method: "Stripe" }), "Bezahlen mit Stripe");
  assert.equal(customerWorkflowT("tr", "openDeliveryAria", { vehicle: "BMW 320d" }), "BMW 320d teslimatını aç");
  assert.equal(customerWorkflowT("de", "supportedCount", { count: "12" }), "Unterstützte Optionen: 12");
  assert.equal(customerWorkflowT("tr", "unknownValue"), "Bilinmiyor");
  assert.doesNotMatch(customerWorkflowT("zh", "supportSummary", {
    requestId: "A-42",
    status: "已完成",
    vehicle: "BMW 320d",
    service: "Stage 1",
    created: "2026-08-30",
  }), /\{[^{}]+\}/);
});

test("native scripts and diacritics are present instead of shallow transliteration", () => {
  const localeText = (localeIndex: number) => Object.values(customerWorkflowExactTranslations)
    .map((translations) => translations[localeIndex])
    .join(" ");

  assert.match(localeText(1), /[äöüß]/i);
  assert.match(localeText(2), /[àâçéèêëîïôùûüÿœæ]/i);
  assert.match(localeText(4), /[А-Яа-яЁё]/);
  assert.match(localeText(5), /[áéíóúüñ¿¡]/i);
  assert.match(localeText(6), /[çğıöşüİ]/i);
  assert.match(localeText(7), /[áâãàçéêíóôõú]/i);
  assert.match(localeText(8), /[\u3400-\u9fff]/);
  assert.match(localeText(9), /[ąćęłńóśźż]/i);
  assert.match(localeText(10), /[ëç]/i);
  assert.doesNotMatch(localeText(6), /\b(?:musteri|guvenli|sifre|ulke|odeme|yukle|dogrula)\b/i);
  assert.doesNotMatch(localeText(10), /\b(?:eshte|zgjedhni|permbledhje|perpunuar)\b/i);
});

test("typed password and notification runtime copy localizes while raw messages remain raw", () => {
  assert.equal(customerPasswordErrorT("tr", "Use at least 12 characters."), "En az 12 karakter kullanın.");
  assert.equal(customerPasswordErrorT("de", "Add an uppercase letter."), "Fügen Sie einen Großbuchstaben hinzu.");

  const adminMessage = localizeCustomerNotification("de", {
    type: "admin_message",
    title: "New message from MG AutoTech",
    body: "Bitte senden Sie die originale Datei erneut.",
    status: null,
  });
  assert.equal(adminMessage.title, "Neue Nachricht von MG AutoTech");
  assert.equal(adminMessage.body, "Bitte senden Sie die originale Datei erneut.");
  assert.equal(adminMessage.rawTitle, false);
  assert.equal(adminMessage.rawBody, true);

  const status = localizeCustomerNotification("tr", {
    type: "order_status",
    title: "Order status updated",
    body: "Legacy server-owned status body",
    status: "Customer Info Needed",
  });
  assert.equal(status.title, "Sipariş durumu güncellendi");
  assert.equal(status.body, "Yeni durum: Müşteri bilgisi gerekli");
  assert.equal(status.rawBody, false);

  const unknown = localizeCustomerNotification("zh", {
    type: "system",
    title: "Server-owned title",
    body: "Server-owned body",
    status: null,
  });
  assert.equal(unknown.title, "Server-owned title");
  assert.equal(unknown.body, "Server-owned body");
  assert.equal(unknown.rawTitle, true);
  assert.equal(unknown.rawBody, true);
});

function collectTsFiles(entry: string, results: string[] = []) {
  if (!statSync(entry).isDirectory()) {
    if (/\.(?:ts|tsx)$/.test(entry)) results.push(entry);
    return results;
  }
  for (const name of readdirSync(entry)) {
    const child = path.join(entry, name);
    if (child.includes(`${path.sep}dashboard${path.sep}widget${path.sep}`)) continue;
    collectTsFiles(child, results);
  }
  return results;
}

test("all customer-facing setter literals are inventoried in the exact or typed catalog", () => {
  const roots = [
    "src/app/auth",
    "src/app/dashboard",
    "src/app/desktop-auth",
    "src/app/forgot-password",
    "src/app/login",
    "src/app/measurement",
    "src/app/new-request",
    "src/app/payment",
    "src/app/register",
    "src/app/reset-password",
    "src/components/account",
    "src/components/auth",
  ];
  const files = roots.flatMap((root) => collectTsFiles(root));
  const exact = new Set<string>(customerWorkflowSourceStrings);
  const templateKeys = new Set<string>(customerWorkflowTemplateRows.map(([key]) => key));
  const reviewedInternalSetterLiterals = new Set([
    "purchase",
    "quote",
    "validation",
    "password-validation",
    "exact",
    "safe-raw",
    "raw",
  ]);
  const setterName = /^set(?:Message|GoogleMessage|NotificationLoadError|QuoteError|Notice|LoadError|SendError|Error|DtcError|JobsLoadError|SubmissionStage|SummaryError|ReminderPreferenceError|RepeatPrefillError|BalanceRefreshMessage|Status)$/;
  const missing: string[] = [];

  for (const file of files) {
    if (file.endsWith("LogAnalysisStudio.tsx") || file.endsWith("WidgetDashboardClient.tsx")) continue;
    const source = readFileSync(file, "utf8");
    const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        setterName.test(node.expression.text)
      ) {
        const collect = (child: ts.Node) => {
          if (ts.isStringLiteral(child) || ts.isNoSubstitutionTemplateLiteral(child)) {
            const value = child.text.trim();
            if (
              value &&
              !reviewedInternalSetterLiterals.has(value) &&
              !exact.has(value) &&
              !templateKeys.has(value)
            ) missing.push(`${file}: ${value}`);
          }
          ts.forEachChild(child, collect);
        };
        node.arguments.forEach(collect);
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  assert.deepEqual([...new Set(missing)], []);
});

test("hidden auth flows localize directly without exposing provider or API errors", () => {
  const callback = readFileSync("src/app/auth/callback/page.tsx", "utf8");
  const measurement = readFileSync("src/app/measurement/complete/page.tsx", "utf8");
  const desktop = readFileSync("src/app/desktop-auth/turnstile/page.tsx", "utf8");
  const turnstile = readFileSync("src/components/auth/TurnstileChallenge.tsx", "utf8");
  const notifications = readFileSync("src/components/CustomerNotifications.tsx", "utf8");
  const notificationCenter = readFileSync("src/app/dashboard/notifications/page.tsx", "utf8");
  const dashboard = readFileSync("src/components/dashboard/DashboardClient.tsx", "utf8");
  const orderDetail = readFileSync("src/app/dashboard/orders/[id]/page.tsx", "utf8");

  for (const source of [callback, measurement, desktop, turnstile]) {
    assert.match(source, /useActiveLocale/u);
    assert.match(source, /customerWorkflowExactT/u);
  }
  assert.doesNotMatch(callback, /rawMessage|error\.message|payload\.error\b/u);
  assert.match(
    callback,
    /registrationFinalizeErrorMessage\(payload\.errorCode\)/u,
  );
  assert.match(
    callback,
    /We could not verify your access\. Please return to login and try again\./u,
  );
  for (const source of ["Secure Auth", "Account verification", "Back to login"]) {
    assert.match(callback, new RegExp(`customerWorkflowExactT\\(locale, "${source}"\\)`, "u"));
  }
  assert.match(turnstile, /customerWorkflowExactT\(locale, status\)/u);
  assert.match(notifications, /Intl\.RelativeTimeFormat\(intlLocaleByCode\[locale\]/u);
  assert.match(notifications, /select\(customerNotificationProjection\)/u);
  assert.match(notificationCenter, /copy\.typeLabel/u);
  assert.match(dashboard, /item\.description \? \([\s\S]{0,160}translate="no" data-no-translate/u);
  assert.match(dashboard, /customerWorkflowT\(locale, "dashboardNeedsResponse"/u);
  assert.match(dashboard, /customerWorkflowT\(locale, "dashboardProfileDetails"/u);
  assert.match(dashboard, /customerWorkflowT\(locale, "dashboardCreditsAvailable"/u);
  assert.match(dashboard, /translate="no" data-no-translate>\{customerName\}<\/span>/u);
  assert.match(orderDetail, /title=\{delivery\?\.original\.fileName \|\| undefined\}[\s\S]{0,180}translate=\{delivery\?\.original\.fileName \? "no" : undefined\}/u);
  assert.match(orderDetail, /status: localizeCustomerOrderStatus\(locale, order\.status\)/u);
  assert.doesNotMatch(dashboard, /<main[^>]*data-no-translate/u);
  assert.doesNotMatch(orderDetail, /<main[^>]*data-no-translate/u);
});

test("runtime-only customer workflow copy uses typed locale keys and raw leaves stay isolated", () => {
  const fileExpert = readFileSync("src/app/dashboard/file-expert/page.tsx", "utf8");
  const fileExpertValidation = readFileSync(
    "src/lib/fileExpert/validation.ts",
    "utf8",
  );
  const credits = readFileSync("src/app/dashboard/credits/page.tsx", "utf8");
  const newRequest = readFileSync("src/app/new-request/page.tsx", "utf8");
  const trustedDevices = readFileSync("src/components/account/TrustedDevicesCard.tsx", "utf8");
  const settings = readFileSync("src/app/dashboard/settings/page.tsx", "utf8");
  const creditHistory = readFileSync("src/app/dashboard/credits/history/page.tsx", "utf8");

  assert.match(
    fileExpert,
    /customerWorkflowT\(locale, "fileExpertRequirements"/u,
  );
  for (const key of [
    "fileExpertEmptyFile",
    "fileExpertFileTooLarge",
    "fileExpertUnsupportedFile",
    "fileExpertTextLimit",
    "fileExpertUploadFile",
  ]) {
    assert.match(
      fileExpertValidation,
      new RegExp(`(?:key:|case) "${key}"`, "u"),
    );
  }
  assert.match(
    fileExpert,
    /localizeFileExpertPageMessage\(locale, message\)/u,
  );
  assert.match(credits, /creditPackageDescriptionKeys\[item\.id\]/u);
  assert.match(newRequest, /customerWorkflowT\(locale, "supportedCount"/u);
  assert.match(newRequest, /translate=\{protectOptions \? "no" : undefined\}/u);
  assert.match(newRequest, /fileName \? \([\s\S]{0,120}translate="no" data-no-translate/u);
  assert.match(trustedDevices, /customerWorkflowT\(locale, "stopTrustingOtherDevices"\)/u);
  assert.match(trustedDevices, /customerWorkflowT\(locale, "unknownValue"\)/u);
  assert.match(settings, /translate="no" data-no-translate>\{customerReference\}<\/span>/u);
  assert.match(creditHistory, /translate="no" data-no-translate>\{email\}<\/span>/u);

  assert.doesNotMatch(fileExpert, /return `Unsupported file type/u);
  assert.doesNotMatch(newRequest, /\$\{selectedVehicle\.services\.length\} supported/u);
  assert.doesNotMatch(trustedDevices, /window\.confirm\("Stop trusting every other saved device\?"\)/u);
});

test("customer dates and numbers use the active locale without fixed German or British formats", () => {
  const files = [
    "src/app/dashboard/credits/page.tsx",
    "src/app/dashboard/credits/history/page.tsx",
    "src/app/dashboard/file-expert/page.tsx",
    "src/app/dashboard/file-expert/[id]/page.tsx",
    "src/app/dashboard/notifications/page.tsx",
    "src/app/dashboard/orders/page.tsx",
    "src/app/dashboard/orders/[id]/page.tsx",
    "src/components/CustomerNotifications.tsx",
    "src/components/RequestChat.tsx",
    "src/components/account/TrustedDevicesCard.tsx",
    "src/components/dashboard/DashboardClient.tsx",
  ];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /["'](?:de-DE|en-GB)["']/u, file);
    assert.doesNotMatch(source, /\.toLocale(?:String|DateString|TimeString)\(\s*\)/u, file);
  }
});

test("exact helper falls back safely only for unknown source data", () => {
  assert.equal(customerWorkflowExactT("de", "Secure Auth"), "Sichere Authentifizierung");
  assert.equal(customerWorkflowExactT("sq", "Secure Auth"), "Autentikim i sigurt");
  assert.equal(customerWorkflowExactT("zh", "customer dashboard"), "客户面板");
  assert.equal(customerWorkflowExactT("tr", "Unknown server-owned value"), "Unknown server-owned value");
});

test("notification localization consumes only the projected status leaf", () => {
  const workflow = readFileSync("src/lib/i18n/customer-workflow-translations.ts", "utf8");
  const projection = readFileSync("src/lib/customerNotificationProjection.ts", "utf8");
  const notificationSurfaces = [
    readFileSync("src/components/CustomerNotifications.tsx", "utf8"),
    readFileSync("src/app/dashboard/notifications/page.tsx", "utf8"),
  ].join("\n");

  assert.match(projection, /status:metadata->>status/u);
  assert.doesNotMatch(projection, /(?:^|,)metadata(?:,|$)/u);
  assert.match(workflow, /status\?: string \| null/u);
  assert.doesNotMatch(workflow, /item\.metadata/u);
  assert.match(notificationSurfaces, /select\(customerNotificationProjection\)/u);
});

test("account restriction messages never interpolate raw status enums", () => {
  const newRequest = readFileSync("src/app/new-request/page.tsx", "utf8");

  assert.match(newRequest, /const accountStateKeys: Record<string, CustomerWorkflowTranslationKey>/u);
  assert.match(newRequest, /accountStateKeys\[normalized\] \?\? "accountStateRestricted"/u);
  assert.match(
    newRequest,
    /status: localizeAccountState\(locale, creditAccessFailure\.status\)/u,
  );
  assert.match(newRequest, /status: localizeAccountState\(locale, accountStatus\)/u);
  assert.doesNotMatch(newRequest, /accountStatus(?:Blocked|Disabled)", \{ status(?:: accountStatus)? \}/u);
});

test("new-request credit failures retain semantic values across locale switches", () => {
  const newRequest = readFileSync("src/app/new-request/page.tsx", "utf8");
  const validateStart = newRequest.indexOf("function validateCreditAccess");
  const validateEnd = newRequest.indexOf("const handleSubmit", validateStart);
  const validate = newRequest.slice(validateStart, validateEnd);

  assert.match(newRequest, /type CreditAccessFailure =/u);
  assert.match(validate, /key: "accountStatusBlocked",[\s\S]*?status,/u);
  assert.match(
    validate,
    /key: "insufficientCreditsWithLimit",[\s\S]*?balance,[\s\S]*?negativeLimit,[\s\S]*?available,[\s\S]*?required: requiredCredits/u,
  );
  assert.match(
    validate,
    /key: "insufficientCredits",[\s\S]*?balance,[\s\S]*?required: requiredCredits/u,
  );
  assert.doesNotMatch(validate, /customerWorkflowT\(locale/u);
  assert.match(
    newRequest,
    /const localizedCreditAccessFailure = \(\(\) => \{[\s\S]*?customerWorkflowT\(locale, creditAccessFailure\.key/u,
  );
  assert.match(
    newRequest,
    /value\.toLocaleString\(intlLocaleByCode\[locale\]\)/u,
  );
  assert.match(newRequest, /\{localizedMessage\}/u);
  assert.match(
    newRequest,
    /if \(typeof creditValidationError === "string"\) \{[\s\S]*?setMessage\(creditValidationError\)[\s\S]*?\} else \{[\s\S]*?setCreditAccessFailure\(creditValidationError\)/u,
  );
});

test("credit checkout interpolates localized payment method labels", () => {
  const credits = readFileSync("src/app/dashboard/credits/page.tsx", "utf8");

  assert.match(credits, /const selectedPaymentTitle = selectedPayment/u);
  assert.match(credits, /customerWorkflowExactT\(locale, selectedPayment\.title\)/u);
  assert.match(credits, /customerWorkflowExactT\(locale, method\.title\)/u);
  assert.match(credits, /method: selectedPaymentTitle/u);
  assert.doesNotMatch(credits, /method: selectedPayment\?\.title \?\? ""/u);
  assert.match(
    credits,
    /template: "bankInstructionsSent"/u,
  );
  assert.match(
    credits,
    /amountEuro: data\.amountEuro,[\s\S]*?credits: Number\(data\.credits\),[\s\S]*?reference,[\s\S]*?template: "bankInstructionsSent"/u,
  );
  assert.match(
    credits,
    /customerWorkflowT\(locale, notice\.template,[\s\S]*?formatEuro\(notice\.amountEuro, locale\)[\s\S]*?notice\.credits\.toLocaleString\(intlLocaleByCode\[locale\]\)/u,
  );
  assert.match(credits, /\{localizedNoticeText\}/u);
  assert.doesNotMatch(
    credits,
    /text: customerWorkflowT\(locale, "bankInstructionsSent"/u,
  );
});
