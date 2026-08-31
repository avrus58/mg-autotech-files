import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import test from "node:test";
import ts from "typescript";
import {
  exactTranslations as baseExactTranslations,
  termTranslations as baseTermTranslations,
} from "../src/lib/i18n";
import {
  customerPasswordErrorT as masterPasswordErrorT,
  customerWorkflowExactTranslations as masterExactTranslations,
  customerWorkflowLocaleOrder as masterLocaleOrder,
  customerWorkflowTemplateRows as masterTemplateRows,
  localizeCustomerNotification as masterLocalizeCustomerNotification,
} from "../src/lib/i18n/customer-workflow-translations";
import * as auth from "../src/lib/i18n/customer-workflow-auth-translations";
import * as authDom from "../src/lib/i18n/customer-workflow-auth-dom-translations";
import * as credits from "../src/lib/i18n/customer-workflow-credits-translations";
import * as creditsDom from "../src/lib/i18n/customer-workflow-credits-dom-translations";
import * as fileExpert from "../src/lib/i18n/customer-workflow-file-expert-translations";
import * as fileExpertDom from "../src/lib/i18n/customer-workflow-file-expert-dom-translations";
import * as notifications from "../src/lib/i18n/customer-workflow-notifications-translations";
import * as notificationsDom from "../src/lib/i18n/customer-workflow-notifications-dom-translations";
import * as orders from "../src/lib/i18n/customer-workflow-orders-translations";
import * as ordersDom from "../src/lib/i18n/customer-workflow-orders-dom-translations";
import * as overview from "../src/lib/i18n/customer-workflow-overview-translations";
import * as overviewDom from "../src/lib/i18n/customer-workflow-overview-dom-translations";
import * as portalCommon from "../src/lib/i18n/customer-workflow-portal-common-translations";
import * as privateMetadata from "../src/lib/i18n/customer-workflow-private-metadata-translations";
import * as request from "../src/lib/i18n/customer-workflow-request-translations";
import * as requestDom from "../src/lib/i18n/customer-workflow-request-dom-translations";
import * as security from "../src/lib/i18n/customer-workflow-security-translations";
import * as securityDom from "../src/lib/i18n/customer-workflow-security-dom-translations";
import * as widgetDom from "../src/lib/i18n/customer-workflow-widget-dom-translations";
import { customerWorkflowClientGroupForPath } from "../src/lib/i18n/customer-workflow-client-routes";
import {
  customerWorkflowClientGroups,
  generatedCustomerWorkflowClientFiles,
} from "../scripts/generate-customer-workflow-client-translations";
import {
  widgetSiteExactTranslations,
  widgetSiteLocaleOrder,
} from "../src/lib/i18n/widget-site-translations";
import type { LocaleCode } from "../src/lib/i18nConfig";

type CompactCatalog = {
  customerWorkflowLocaleOrder: readonly string[];
  customerWorkflowExactTranslations: Readonly<Record<string, readonly string[]>>;
  customerWorkflowTemplateRows?: readonly (readonly string[])[];
};

const compactCatalogs: Array<[string, CompactCatalog]> = [
  ["auth", auth],
  ["auth-dom", authDom],
  ["overview", overview],
  ["overview-dom", overviewDom],
  ["request", request],
  ["request-dom", requestDom],
  ["credits", credits],
  ["credits-dom", creditsDom],
  ["file-expert", fileExpert],
  ["file-expert-dom", fileExpertDom],
  ["orders", orders],
  ["orders-dom", ordersDom],
  ["notifications", notifications],
  ["notifications-dom", notificationsDom],
  ["security", security],
  ["security-dom", securityDom],
  ["widget-dom", widgetDom],
  ["portal-common", portalCommon],
  ["private-metadata", privateMetadata],
];

const masterTemplateRowsByKey = new Map<string, (typeof masterTemplateRows)[number]>(
  masterTemplateRows.map((row) => [row[0], row] as const),
);

function expectedExact(locale: Exclude<LocaleCode, "en">, source: string) {
  const localeIndex = masterLocaleOrder.indexOf(locale);
  return (
    masterExactTranslations[source]?.[localeIndex] ??
    baseExactTranslations[locale][source] ??
    baseTermTranslations[locale][source] ??
    source
  );
}

test("compact customer workflow catalogs preserve combined legacy runtime semantics", () => {
  for (const [name, catalog] of compactCatalogs) {
    assert.deepEqual(catalog.customerWorkflowLocaleOrder, masterLocaleOrder, name);
    for (const [source, translations] of Object.entries(
      catalog.customerWorkflowExactTranslations,
    )) {
      assert.equal(translations.length, masterLocaleOrder.length, `${name}: ${source}`);
      masterLocaleOrder.forEach((locale, localeIndex) => {
        assert.equal(
          translations[localeIndex],
          expectedExact(locale, source),
          `${name}/${locale}: ${source}`,
        );
      });
    }
    for (const row of catalog.customerWorkflowTemplateRows ?? []) {
      assert.deepEqual(row, masterTemplateRowsByKey.get(row[0]), `${name}: ${row[0]}`);
    }
  }
});

test("password and notification helpers are behaviorally identical to the master", () => {
  const passwordSources = [
    "Use at least 12 characters.",
    "Use no more than 128 characters.",
    "Do not use spaces.",
    "Add a lowercase letter.",
    "Add an uppercase letter.",
    "Add a number.",
    "Add a symbol.",
    "Choose a less predictable password.",
    "Unknown password service response",
  ];
  const notificationFixtures = [
    {
      type: "admin_message" as const,
      title: "Raw operator title",
      body: "Raw customer-specific body",
    },
    {
      type: "file_ready" as const,
      title: "Raw title",
      body: null,
    },
    {
      type: "additional_upload_enabled" as const,
      title: "Raw title",
      body: null,
    },
    {
      type: "order_status" as const,
      title: "Raw title",
      body: "New status: In Progress",
      status: null,
    },
    {
      type: "order_status" as const,
      title: "Raw title",
      body: "Server-owned unknown status",
      status: "server_owned_unknown",
    },
  ];

  for (const locale of ["en", ...masterLocaleOrder] as const) {
    for (const source of passwordSources) {
      assert.equal(
        auth.customerPasswordErrorT(locale, source),
        masterPasswordErrorT(locale, source),
        `${locale}: ${source}`,
      );
    }
    for (const fixture of notificationFixtures) {
      assert.deepEqual(
        notifications.localizeCustomerNotification(locale, fixture),
        masterLocalizeCustomerNotification(locale, fixture),
        `${locale}: ${fixture.type}`,
      );
    }
  }

  assert.equal(
    auth.customerWorkflowExactT("tr", "Raw customer filename.bin"),
    "Raw customer filename.bin",
  );
  const rawNotification = notifications.localizeCustomerNotification("de", {
    type: "admin_message",
    title: "Raw title",
    body: "Raw customer message",
  });
  assert.equal(rawNotification.body, "Raw customer message");
  assert.equal(rawNotification.rawBody, true);
});

test("generated client catalogs are checked in, fresh and within gzip budgets", () => {
  const primaryBudgetsKiB: Record<string, number> = {
    auth: 25,
    request: 30,
  };
  for (const generated of generatedCustomerWorkflowClientFiles()) {
    const current = readFileSync(generated.path, "utf8");
    assert.equal(current, generated.content, generated.groupName);
    const gzipKiB = gzipSync(Buffer.from(current)).byteLength / 1024;
    const budget = primaryBudgetsKiB[generated.groupName] ?? 35;
    assert.ok(
      gzipKiB <= budget,
      `${generated.groupName}: ${gzipKiB.toFixed(1)} KiB > ${budget} KiB`,
    );
  }
});

test("no use-client source statically imports the full workflow catalog", () => {
  const pending = ["src"];
  const offenders: string[] = [];
  while (pending.length) {
    const current = pending.pop()!;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const child = `${current}/${entry.name}`;
      if (entry.isDirectory()) {
        pending.push(child);
        continue;
      }
      if (!/\.tsx?$/u.test(entry.name)) continue;
      const sourceText = readFileSync(child, "utf8");
      if (!/^\s*["']use client["'];/u.test(sourceText)) continue;
      const source = ts.createSourceFile(
        child,
        sourceText,
        ts.ScriptTarget.Latest,
        true,
        entry.name.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );
      source.statements.forEach((statement) => {
        if (
          ts.isImportDeclaration(statement) &&
          ts.isStringLiteral(statement.moduleSpecifier) &&
          statement.moduleSpecifier.text ===
            "@/lib/i18n/customer-workflow-translations"
        ) {
          offenders.push(child);
        }
      });
    }
  }
  assert.deepEqual(offenders, []);
});

test("every supported customer route uses a bounded compact catalog", () => {
  const expected = new Map<string, string>([
    ["/login", "auth"],
    ["/register", "auth"],
    ["/forgot-password", "auth"],
    ["/reset-password", "auth"],
    ["/auth/callback", "auth"],
    ["/auth/complete-profile", "auth"],
    ["/desktop-auth/turnstile", "auth"],
    ["/measurement/complete", "auth"],
    ["/new-request", "request"],
    ["/dashboard", "overview"],
    ["/dashboard/credits", "credits"],
    ["/dashboard/credits/history", "credits"],
    ["/payment/cancel", "credits"],
    ["/payment/success", "credits"],
    ["/dashboard/file-expert", "file-expert"],
    ["/dashboard/file-expert/report-id", "file-expert"],
    ["/dashboard/orders", "orders"],
    ["/dashboard/orders/order-id", "orders"],
    ["/dashboard/notifications", "notifications"],
    ["/dashboard/settings", "security"],
    ["/dashboard/log-analysis", "portal"],
    ["/dashboard/widget", "widget"],
    ["/dashboard/widget/billing", "widget"],
  ]);
  expected.forEach((group, pathname) => {
    assert.equal(customerWorkflowClientGroupForPath(pathname), group, pathname);
  });
  for (const pathname of ["/auth/provider-internal"]) {
    assert.equal(customerWorkflowClientGroupForPath(pathname), null, pathname);
  }

  assert.ok(
    customerWorkflowClientGroups.credits.files.some(
      (file) => file === "src/app/dashboard/credits/history/page.tsx",
    ),
  );
  assert.ok(
    customerWorkflowClientGroups.security.files.some(
      (file) => file === "src/app/dashboard/settings/page.tsx",
    ),
  );

  const switcher = readFileSync("src/components/LanguageSwitcher.tsx", "utf8");
  const compactBranch = switcher.indexOf("if (compactCustomerWorkflow)");
  const fullCatalogImport = switcher.indexOf('import("@/lib/i18n")');
  assert.ok(compactBranch >= 0 && fullCatalogImport > compactBranch);
  assert.match(
    switcher,
    /customer-workflow-request-dom-translations/u,
  );
  assert.match(
    switcher,
    /customer-workflow-portal-common-translations/u,
  );
  assert.match(switcher, /case "portal"/u);
  assert.match(switcher, /case "security"/u);
  assert.match(switcher, /case "widget"/u);
  assert.match(switcher, /customer-workflow-widget-dom-translations/u);
  assert.match(
    switcher,
    /customer-workflow-private-metadata-translations/u,
  );
  assert.match(switcher, /widgetSite\.widgetSiteLocaleOrder/u);
  assert.match(switcher, /widgetSite\.widgetSiteExactTranslations/u);
});

test("new compact route groups contain native representative copy", () => {
  const assertNative = (
    name: string,
    localeOrder: readonly string[],
    catalog: Readonly<Record<string, readonly string[]>>,
    sources: readonly string[],
  ) => {
    for (const source of sources) {
      const values = catalog[source];
      assert.ok(values, `${name}: missing ${source}`);
      localeOrder.forEach((locale, index) => {
        assert.ok(values[index]?.trim(), `${name}/${locale}: empty ${source}`);
        assert.notEqual(values[index], source, `${name}/${locale}: fallback ${source}`);
      });
    }
  };

  assertNative(
    "portal",
    masterLocaleOrder,
    portalCommon.customerWorkflowExactTranslations,
    ["Customer Panel", "Settings"],
  );
  assertNative(
    "private-metadata",
    masterLocaleOrder,
    privateMetadata.customerWorkflowExactTranslations,
    [
      "Customer Dashboard",
      "Secure MG AutoTech customer dashboard for file requests, credits and deliveries.",
      "Datalog Analysis Studio",
      "Private browser-local multi-channel datalog review for MG AutoTech customers.",
    ],
  );
  assertNative(
    "credits-history",
    masterLocaleOrder,
    {
      ...credits.customerWorkflowExactTranslations,
      ...creditsDom.customerWorkflowExactTranslations,
    },
    [
      "Credit History",
      "We couldn't load your current balance or ledger movements. Try again before treating this history as empty.",
    ],
  );
  assertNative(
    "settings",
    masterLocaleOrder,
    {
      ...security.customerWorkflowExactTranslations,
      ...securityDom.customerWorkflowExactTranslations,
    },
    [
      "Customer Settings",
      "Customer profile could not be synced. Please try again.",
    ],
  );
  assertNative(
    "widget",
    masterLocaleOrder,
    widgetDom.customerWorkflowExactTranslations,
    [
      "Widget billing",
      "Subscription and payments",
      "Review the linked subscription, latest payment, next renewal and remaining period before opening the Stripe Customer Portal.",
      "Secure billing managed by Stripe",
      "Open billing portal",
    ],
  );
  assertNative(
    "widget-state",
    widgetSiteLocaleOrder,
    widgetSiteExactTranslations,
    ["Widget subscription summary could not be loaded."],
  );
});

test("new compact route groups stay below their combined source gzip budgets", () => {
  const groups = {
    portal: {
      files: [
        "src/lib/i18n/customer-workflow-portal-common-translations.ts",
        "src/lib/i18n/customer-workflow-private-metadata-translations.ts",
      ],
      budgetKiB: 18,
    },
    credits: {
      files: [
        "src/lib/i18n/customer-workflow-credits-translations.ts",
        "src/lib/i18n/customer-workflow-credits-dom-translations.ts",
        "src/lib/i18n/customer-workflow-portal-common-translations.ts",
        "src/lib/i18n/customer-workflow-private-metadata-translations.ts",
      ],
      budgetKiB: 42,
    },
    security: {
      files: [
        "src/lib/i18n/customer-workflow-security-translations.ts",
        "src/lib/i18n/customer-workflow-security-dom-translations.ts",
        "src/lib/i18n/customer-workflow-portal-common-translations.ts",
        "src/lib/i18n/customer-workflow-private-metadata-translations.ts",
      ],
      budgetKiB: 35,
    },
    widget: {
      files: [
        "src/lib/i18n/customer-workflow-portal-common-translations.ts",
        "src/lib/i18n/customer-workflow-widget-dom-translations.ts",
        "src/lib/i18n/customer-workflow-private-metadata-translations.ts",
        "src/lib/i18n/widget-site-translations.ts",
      ],
      budgetKiB: 55,
    },
  } as const;

  for (const [name, group] of Object.entries(groups)) {
    const source = group.files.map((file) => readFileSync(file, "utf8")).join("\n");
    const gzipKiB = gzipSync(Buffer.from(source)).byteLength / 1024;
    assert.ok(
      gzipKiB <= group.budgetKiB,
      `${name}: ${gzipKiB.toFixed(1)} KiB > ${group.budgetKiB} KiB`,
    );
  }
});

test("forgot-password and profile-completion copy is complete in the compact auth bundle", () => {
  const translatedSources = new Set([
    ...Object.keys(auth.customerWorkflowExactTranslations),
    ...Object.keys(authDom.customerWorkflowExactTranslations),
  ]);
  const reviewedVisibleSources = [
    "Password Recovery",
    "Secure reset",
    "Forgot password?",
    "Enter your account e-mail and we will send a secure password reset link.",
    "E-mail",
    "Security verification failed.",
    "Password reset request could not be completed. Please try again.",
    "Password reset link sent. Please check your e-mail inbox.",
    "Sending link...",
    "Send reset link",
    "Back to login",
    "Checking account",
    "Customer Account",
    "Confirm your country",
    "Your country is required to finish creating your customer account.",
    "Detecting your country...",
    "Country selected automatically. You can change it.",
    "Select the country used for your customer profile.",
    "Your session could not be verified. Please log in again.",
    "Please select your country.",
    "Your country could not be saved. Please try again.",
    "Your updated account could not be verified. Please log in again.",
    "Saving country...",
    "Finish account setup",
  ];

  for (const source of reviewedVisibleSources) {
    assert.ok(translatedSources.has(source), `missing compact auth copy: ${source}`);
  }

  assert.equal(translatedSources.has("you@example.com"), false);
  assert.equal(auth.customerWorkflowExactT("tr", "you@example.com"), "you@example.com");
});

test("shared portal navigation has translated copy or an explicit product-name invariant", () => {
  const reviewedInvariants = new Set(["AI File Expert"]);
  const reviewedEqualSourcePairs = new Set([
    "nl:Account",
    "it:Account",
    "fr:Notifications",
    "de:Support",
  ]);
  const labels = [
    "File Service",
    "Dashboard",
    "New File Request",
    "Active Orders",
    "Needs Response",
    "Order History",
    "Tools",
    "AI File Expert",
    "Datalog Analysis Studio",
    "Vehicle Widget",
    "Account",
    "Buy Credits",
    "Credit History",
    "Notifications",
    "Settings",
    "Support",
    "Current Balance",
    "Available Credits",
    "Customer Panel",
    "Primary navigation",
    "Mobile navigation",
  ];
  for (const source of labels) {
    if (reviewedInvariants.has(source)) continue;
    const values = (
      portalCommon.customerWorkflowExactTranslations as Readonly<
        Record<string, readonly string[]>
      >
    )[source];
    assert.ok(values, `missing shared portal label: ${source}`);
    masterLocaleOrder.forEach((locale, localeIndex) => {
      assert.ok(values[localeIndex]?.trim(), `${locale}: ${source}`);
      if (!reviewedEqualSourcePairs.has(`${locale}:${source}`)) {
        assert.notEqual(values[localeIndex], source, `${locale}: ${source}`);
      }
    });
  }
  assert.equal(
    portalCommon.customerWorkflowExactTranslations.Settings[1],
    "Einstellungen",
  );
  assert.equal(
    portalCommon.customerWorkflowExactTranslations.Settings[6],
    "Ayarlar",
  );
});
