import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import test from "node:test";
import { buildSync } from "esbuild";
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
import {
  customerRuntimeLocaleOrder,
  customerRuntimeTranslations,
} from "../src/lib/i18n/customer-runtime-translations";
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
  customerWorkflowPortalCommonGeneratorFiles,
  customerWorkflowDomTransportSourceLiterals,
  customerWorkflowPrimaryTransportSourceLiterals,
  customerWorkflowVisibleSourceLiterals,
  externallyLocalizedSharedSourceExclusions,
  generateCustomerWorkflowClientModule,
  generatedCustomerWorkflowClientFiles,
  assertLegacyDomObserverBaselineIntegrity,
  assertLegacyDomObserverOccurrenceShrinkOnly,
  assertLegacyDomObserverTombstoneFloor,
  assertReviewedLegacyDomBaselineDigest,
  manualExactTransportSourceExclusions,
  assertLegacyDomObserverShrinkOnly,
  assertCustomerWorkflowGroupDomSourceOwnership,
  typedPrimaryTemplateSourceExclusions,
  typedPrimaryExactFunctionSources,
  validateLanguageSwitcherCompactImports,
} from "../scripts/generate-customer-workflow-client-translations";
import {
  auditCustomerWorkflowRouteClosure,
  customerWorkflowCatalogModuleName,
  customerWorkflowSourceLooksLikeUiHelper,
  customerWorkflowSourceImports,
  isCustomerWorkflowAppUiConventionFile,
} from "../scripts/lib/customer-workflow-route-closure";
import {
  customerWorkflowAuditRoots,
  customerWorkflowClientSurfaceManifest,
  customerWorkflowExternalConventionBoundaries,
  customerWorkflowExternallyLocalizedSharedSources,
  customerWorkflowManagedRouteSegments,
  customerWorkflowManifestSourceFiles,
  customerWorkflowSharedSourceManifest,
  type CustomerWorkflowClientGroup,
  type CustomerWorkflowClientSurfaceConfig,
} from "../src/lib/i18n/customer-workflow-surface-manifest";
import { customerWorkflowClientRouteManifest } from "../src/lib/i18n/customer-workflow-client-route-manifest";
import {
  customerWorkflowLegacyDomObserverCeiling,
  customerWorkflowLegacyDomObserverOccurrenceCeiling,
  customerWorkflowLegacyDomObserverReviewedTombstoneFloor,
  customerWorkflowLegacyDomObserverTombstones,
} from "../src/lib/i18n/customer-workflow-dom-observer-baseline";
import {
  widgetSiteExactTranslations,
  widgetSiteLocaleOrder,
} from "../src/lib/i18n/widget-site-translations";
import type { LocaleCode } from "../src/lib/i18nConfig";

type CompactCatalog = {
  customerWorkflowLocaleOrder: readonly string[];
  customerWorkflowExactTranslations: Readonly<
    Record<string, readonly string[]>
  >;
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
];

const masterTemplateRowsByKey = new Map<
  string,
  (typeof masterTemplateRows)[number]
>(masterTemplateRows.map((row) => [row[0], row] as const));
const customerRuntimeExactRows = customerRuntimeTranslations as Readonly<
  Record<string, readonly string[]>
>;

function expectedExact(locale: Exclude<LocaleCode, "en">, source: string) {
  const localeIndex = masterLocaleOrder.indexOf(locale);
  const runtimeLocaleIndex = customerRuntimeLocaleOrder.indexOf(locale);
  return (
    masterExactTranslations[source]?.[localeIndex] ??
    (runtimeLocaleIndex >= 0
      ? customerRuntimeExactRows[source]?.[runtimeLocaleIndex]
      : undefined) ??
    baseExactTranslations[locale][source] ??
    baseTermTranslations[locale][source] ??
    source
  );
}

test("compact customer workflow catalogs preserve combined legacy runtime semantics", () => {
  for (const [name, catalog] of compactCatalogs) {
    assert.deepEqual(
      catalog.customerWorkflowLocaleOrder,
      masterLocaleOrder,
      name,
    );
    for (const [source, translations] of Object.entries(
      catalog.customerWorkflowExactTranslations,
    )) {
      assert.equal(
        translations.length,
        masterLocaleOrder.length,
        `${name}: ${source}`,
      );
      masterLocaleOrder.forEach((locale, localeIndex) => {
        assert.equal(
          translations[localeIndex],
          expectedExact(locale, source),
          `${name}/${locale}: ${source}`,
        );
      });
    }
    for (const row of catalog.customerWorkflowTemplateRows ?? []) {
      assert.deepEqual(
        row,
        masterTemplateRowsByKey.get(row[0]),
        `${name}: ${row[0]}`,
      );
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
    // The lossless request payload alone is 31.7 KiB gzipped before any
    // TypeScript/runtime structure. Column-major serialization keeps the
    // checked-in, self-contained module at 32.6 KiB without dropping copy.
    request: 33,
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

test("manual catalog entries are source-provenanced and redundant route pins stay removed", () => {
  assert.equal(
    "manualExactSources" in customerWorkflowClientGroups.auth,
    false,
  );
  assert.equal(
    "manualExactSources" in customerWorkflowClientGroups.request,
    false,
  );
  assert.deepEqual(
    customerWorkflowClientGroups.request.manualTemplateKeys.map(
      (entry) => entry.key,
    ),
    [
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
    ],
  );
  assert.ok(
    customerWorkflowClientSurfaceManifest.credits.sourceFiles.includes(
      "src/lib/creditPurchaseErrorCodes.ts",
    ),
  );

  for (const [group, rawConfig] of Object.entries(
    customerWorkflowClientGroups,
  )) {
    const config = rawConfig as {
      manualExactSources?: readonly {
        source: string;
        provenanceFiles: readonly string[];
      }[];
      manualTemplateKeys?: readonly {
        key: string;
        provenanceFiles: readonly string[];
      }[];
    };
    for (const entry of config.manualExactSources ?? []) {
      assert.ok(entry.provenanceFiles.length > 0, `${group}: ${entry.source}`);
      entry.provenanceFiles.forEach((file) =>
        assert.doesNotThrow(
          () => readFileSync(file, "utf8"),
          `${group}: ${file}`,
        ),
      );
    }
    for (const entry of config.manualTemplateKeys ?? []) {
      assert.ok(entry.provenanceFiles.length > 0, `${group}: ${entry.key}`);
      entry.provenanceFiles.forEach((file) =>
        assert.doesNotThrow(
          () => readFileSync(file, "utf8"),
          `${group}: ${file}`,
        ),
      );
    }
  }
});

test("legacy DOM observer catalogs are shrink-only", () => {
  assert.doesNotThrow(() => assertLegacyDomObserverBaselineIntegrity());
  assert.throws(
    () =>
      assertReviewedLegacyDomBaselineDigest(
        "ceiling",
        {
          ...customerWorkflowLegacyDomObserverCeiling,
          auth: [
            ...customerWorkflowLegacyDomObserverCeiling.auth,
            "unreviewed growth",
          ],
        },
        "36d504fa1df5373a6c0671517050b36c951be9f1da4594583e56b728874fd8c2",
      ),
    /immutable reviewed digest/u,
  );
  assert.doesNotThrow(() =>
    assertLegacyDomObserverOccurrenceShrinkOnly(
      "fixture",
      new Map([["kept", 1]]),
      ["kept"],
      "1",
    ),
  );
  assert.throws(
    () =>
      assertLegacyDomObserverOccurrenceShrinkOnly(
        "fixture",
        new Map([["kept", 2]]),
        ["kept"],
        "1",
      ),
    /raw visible DOM occurrences cannot grow/u,
  );
  assert.throws(
    () => assertLegacyDomObserverTombstoneFloor("fixture", ["retired"], []),
    /reviewed DOM observer tombstones cannot be removed/u,
  );
  assert.doesNotThrow(() =>
    assertLegacyDomObserverShrinkOnly(
      "fixture",
      new Set(["kept"]),
      new Set(["kept", "removed"]),
      new Set(["removed"]),
    ),
  );
  assert.throws(
    () =>
      assertLegacyDomObserverShrinkOnly(
        "fixture",
        new Set(["kept"]),
        new Set(["kept", "removed"]),
      ),
    /removed legacy DOM copy must be recorded as a tombstone/u,
  );
  assert.throws(
    () =>
      assertLegacyDomObserverShrinkOnly(
        "fixture",
        new Set(["kept", "new raw copy"]),
        new Set(["kept"]),
      ),
    /new raw visible DOM copy cannot grow[\s\S]*typed primary translator/u,
  );
  for (const group of Object.keys(
    customerWorkflowLegacyDomObserverCeiling,
  ) as Array<keyof typeof customerWorkflowLegacyDomObserverCeiling>) {
    const ceiling = customerWorkflowLegacyDomObserverCeiling[group];
    const occurrenceCeiling =
      customerWorkflowLegacyDomObserverOccurrenceCeiling[group];
    const reviewedTombstoneFloor =
      customerWorkflowLegacyDomObserverReviewedTombstoneFloor[group];
    const tombstones = customerWorkflowLegacyDomObserverTombstones[group];
    assert.equal(
      occurrenceCeiling.length,
      ceiling.length,
      `${group}: positional occurrence ceiling mismatch`,
    );
    assert.equal(
      new Set(ceiling).size,
      ceiling.length,
      `${group}: duplicate ceiling row`,
    );
    assert.equal(
      new Set(tombstones).size,
      tombstones.length,
      `${group}: duplicate tombstone`,
    );
    reviewedTombstoneFloor.forEach((source) =>
      assert.ok(
        (tombstones as readonly string[]).includes(source),
        `${group}: removed reviewed tombstone ${source}`,
      ),
    );
    tombstones.forEach((source) =>
      assert.ok(
        (ceiling as readonly string[]).includes(source),
        `${group}: invalid tombstone ${source}`,
      ),
    );
  }
  for (const sharedBoundary of [
    "src/components/auth/DeviceVerificationPanel.tsx",
    "src/components/CountrySelect.tsx",
    "src/components/CustomerNotifications.tsx",
  ] as const) {
    assert.ok(
      customerWorkflowPortalCommonGeneratorFiles.includes(sharedBoundary),
      `${sharedBoundary} must remain in its exact shared DOM baseline`,
    );
  }
  assert.ok(
    customerWorkflowClientGroups.auth.files.includes(
      "src/components/auth/DeviceVerificationPanel.tsx",
    ),
    "the auth primary generator must retain shared typed auth calls",
  );
  assert.equal(
    customerWorkflowClientGroups.auth.domFiles.includes(
      "src/components/auth/DeviceVerificationPanel.tsx" as (typeof customerWorkflowClientGroups.auth.domFiles)[number],
    ),
    false,
    "shared DeviceVerificationPanel raw copy belongs to the portal-common baseline",
  );
  assert.ok(
    customerWorkflowClientGroups.notifications.files.includes(
      "src/components/CustomerNotifications.tsx",
    ),
    "the notifications primary generator must retain its shared typed helper",
  );
  assert.ok(
    customerWorkflowPortalCommonGeneratorFiles.includes(
      "src/components/dashboard/LogAnalysisStudioLoader.tsx",
    ),
    "a customer surface without its own compact catalog must stay in the shared DOM baseline",
  );
  assert.deepEqual(customerWorkflowExternallyLocalizedSharedSources, [
    {
      file: "src/lib/seo.ts",
      localeMatrixBindings: [
        "homeSeo",
        "seoLabels",
        "serviceNames",
        "serviceTemplates",
        "localizedServiceOperations",
      ],
    },
  ]);
  assert.ok(
    customerWorkflowSharedSourceManifest["portal-common"].sourceFiles.includes(
      "src/lib/seo.ts",
    ),
    "externally localized shared data must remain in route/catalog closure",
  );
  assert.equal(
    customerWorkflowPortalCommonGeneratorFiles.includes(
      "src/lib/seo.ts" as (typeof customerWorkflowPortalCommonGeneratorFiles)[number],
    ),
    true,
  );
  assert.throws(
    () =>
      assertCustomerWorkflowGroupDomSourceOwnership(
        "auth",
        {
          files: ["src/components/unclassified-shared-copy.tsx"],
          domFiles: [],
        },
        [],
      ),
    /may leave the group DOM inventory only as an exact shared typed boundary/u,
  );
});

test("typed template transport copy cannot conceal direct raw DOM copy", () => {
  const typedFixture =
    "tests/fixtures/customer-workflow-route-closure/typed-template-data.tsx";
  const rawFixture =
    "tests/fixtures/customer-workflow-route-closure/raw-template-duplicate.tsx";
  const mismatchedFixture =
    "tests/fixtures/customer-workflow-route-closure/mismatched-template-data.tsx";
  const destructuredFixture =
    "tests/fixtures/customer-workflow-route-closure/raw-template-destructured.tsx";
  const helperFixture =
    "tests/fixtures/customer-workflow-route-closure/raw-template-helper.tsx";
  const aliasFixture =
    "tests/fixtures/customer-workflow-route-closure/typed-template-alias.tsx";
  const shadowFixture =
    "tests/fixtures/customer-workflow-route-closure/typed-template-shadow.tsx";
  const lookalikeFixture =
    "tests/fixtures/customer-workflow-route-closure/typed-template-lookalike.tsx";
  const source = "10 credits for occasional file-service work.";
  const configFor = (fixture: string) => ({
    files: [fixture],
    manualTemplateKeys: [
      {
        key: "creditPackageDescription10",
        provenanceFiles: [fixture],
        runtimeBindings: ["packageDescriptionKeys"],
      },
    ],
    typedTemplateDataParity: [
      {
        dataFile: fixture,
        dataBinding: "packages",
        idField: "id",
        sourceField: "description",
        consumerFile: fixture,
        keyMapBinding: "packageDescriptionKeys",
      },
    ],
  });

  assert.ok(
    typedPrimaryTemplateSourceExclusions(
      "credits",
      configFor(typedFixture),
    ).has(source),
    "typed template output should retire matching transport/config copy from the observer",
  );
  assert.ok(
    typedPrimaryTemplateSourceExclusions(
      "credits",
      configFor(aliasFixture),
    ).has(source),
    "an aliased exact named import must retain typed template provenance",
  );
  for (const fixture of [shadowFixture, lookalikeFixture]) {
    assert.throws(
      () => typedPrimaryTemplateSourceExclusions("credits", configFor(fixture)),
      /(?:stale manual template key|does not reach a visible customerWorkflowT result)/u,
      `${fixture}: a shadow or lookalike function cannot impersonate the imported translator`,
    );
  }
  assert.equal(
    typedPrimaryTemplateSourceExclusions("credits", configFor(rawFixture)).has(
      source,
    ),
    false,
    "a direct raw JSX duplicate must remain subject to the shrink-only ceiling",
  );
  for (const fixture of [destructuredFixture, helperFixture]) {
    assert.equal(
      typedPrimaryTemplateSourceExclusions("credits", configFor(fixture)).has(
        source,
      ),
      false,
      `${fixture}: destructured/helper raw copy must stay observed`,
    );
  }
  assert.throws(
    () =>
      typedPrimaryTemplateSourceExclusions(
        "credits",
        configFor(mismatchedFixture),
      ),
    /does not match the English source/u,
    "package description and typed key English source must have exact parity",
  );
});

test("dead literals and generic call arguments cannot pin manual catalog rows", () => {
  const fixture =
    "tests/fixtures/customer-workflow-route-closure/dead-provenance.ts";
  assert.throws(
    () =>
      generateCustomerWorkflowClientModule("auth", {
        files: [fixture],
        manualExactSources: [{ source: "Back", provenanceFiles: [fixture] }],
      }),
    /stale manual exact source/u,
  );
  assert.throws(
    () =>
      generateCustomerWorkflowClientModule("request", {
        files: [fixture],
        manualTemplateKeys: [
          { key: "creditsCount", provenanceFiles: [fixture] },
        ],
      }),
    /stale manual template key/u,
  );
  assert.throws(
    () =>
      generateCustomerWorkflowClientModule("auth", {
        files: [fixture],
        manualExactSources: [
          {
            source: "Back",
            provenanceFiles: [fixture],
            runtimeBindings: ["deadBinding"],
          },
        ],
      }),
    /stale manual exact source/u,
  );
  assert.throws(
    () =>
      generateCustomerWorkflowClientModule("request", {
        files: [fixture],
        manualTemplateKeys: [
          {
            key: "creditsCount",
            provenanceFiles: [fixture],
            runtimeFunctions: ["deadFunction"],
          },
        ],
      }),
    /stale manual template key/u,
  );
});

test("dead callbacks and same-value raw copy cannot masquerade as exact transport", () => {
  const deadFixture =
    "tests/fixtures/customer-workflow-route-closure/dead-direct-translator.tsx";
  const typedFixture =
    "tests/fixtures/customer-workflow-route-closure/typed-only-exact.tsx";
  const duplicateFixture =
    "tests/fixtures/customer-workflow-route-closure/typed-and-raw-exact.tsx";

  assert.doesNotMatch(
    generateCustomerWorkflowClientModule("auth", { files: [deadFixture] }),
    /"Back"/u,
  );
  assert.equal(
    customerWorkflowVisibleSourceLiterals([typedFixture]).has("Back"),
    false,
  );
  assert.equal(
    customerWorkflowVisibleSourceLiterals([duplicateFixture]).has("Back"),
    true,
  );
});

test("manual exact transport cannot conceal a helper-derived raw duplicate", () => {
  const fixture =
    "tests/fixtures/customer-workflow-route-closure/manual-exact-derived-raw.tsx";
  const config = {
    files: [fixture],
    manualExactSources: [
      {
        source: "Back",
        provenanceFiles: [fixture],
        runtimeBindings: ["transportCopy"],
      },
    ],
  };

  assert.equal(
    manualExactTransportSourceExclusions("auth", config).has("Back"),
    false,
  );
  assert.equal(
    customerWorkflowVisibleSourceLiterals([fixture]).has("Back"),
    true,
  );
});

test("message, notice and statusText object copy stays in the visible AST inventory", () => {
  const visible = customerWorkflowVisibleSourceLiterals([
    "tests/fixtures/customer-workflow-route-closure/visible-properties.tsx",
  ]);
  for (const source of [
    "Visible message copy",
    "Visible notice copy",
    "Visible status copy",
  ]) {
    assert.ok(visible.has(source), source);
  }
  assert.equal(visible.has("Hidden semantic kind"), false);
});

test("raw React state copy is traced only when it reaches visible JSX", () => {
  const visible = customerWorkflowVisibleSourceLiterals([
    "tests/fixtures/customer-workflow-route-closure/raw-state-flow.tsx",
  ]);
  assert.equal(visible.has("Try again"), true);
  assert.equal(visible.has("Back"), false);
});

test("raw local helper returns are traced only when rendered in JSX", () => {
  const visible = customerWorkflowVisibleSourceLiterals([
    "tests/fixtures/customer-workflow-route-closure/raw-local-helper.tsx",
  ]);
  assert.equal(visible.has("Visible helper copy"), true);
  assert.equal(visible.has("Visible arrow copy"), true);
  assert.equal(visible.has("Dead helper copy"), false);
});

test("first-paint wrappers stay owned by their exact DOM provider", () => {
  const fixture =
    "tests/fixtures/customer-workflow-route-closure/first-paint-providers.tsx";
  const authSources = customerWorkflowDomTransportSourceLiterals(
    [fixture],
    "auth-dom",
  );
  const portalSources = customerWorkflowDomTransportSourceLiterals(
    [fixture],
    "portal-common",
  );
  const primarySources = customerWorkflowPrimaryTransportSourceLiterals([
    fixture,
  ]);

  assert.deepEqual([...authSources], ["Back"]);
  assert.deepEqual([...portalSources], ["Settings"]);
  assert.deepEqual([...primarySources], ["Try again"]);
});

test("typed exact function parity proves provider fields and rejects raw duplicates", () => {
  const provider =
    "tests/fixtures/customer-workflow-route-closure/typed-exact-provider.ts";
  const consumer =
    "tests/fixtures/customer-workflow-route-closure/typed-exact-consumer.tsx";
  const rawConsumer =
    "tests/fixtures/customer-workflow-route-closure/typed-exact-consumer-raw.tsx";
  const sameValueRawConsumer =
    "tests/fixtures/customer-workflow-route-closure/typed-exact-consumer-same-value.tsx";
  const shadowConsumer =
    "tests/fixtures/customer-workflow-route-closure/typed-exact-consumer-shadow.tsx";
  const shadowLiteralConsumer =
    "tests/fixtures/customer-workflow-route-closure/typed-exact-consumer-shadow-literal.tsx";
  const configFor = (consumerFile: string, providerFile = provider) => ({
    files: [providerFile, consumerFile],
    typedExactFunctionParity: [
      {
        providerFile,
        providerFunction: "buildTypedExactFixture",
        consumerFile,
        resultBinding: "fixture",
        returnFields: ["title"],
        collections: [
          {
            returnField: "rows",
            providerBinding: "rows",
            consumerItemBinding: "row",
            fields: ["label", "detail"],
          },
        ],
      },
    ],
  });

  assert.deepEqual(
    [
      ...typedPrimaryExactFunctionSources("security", configFor(consumer)),
    ].sort(),
    ["Back", "Customer Settings", "Try again"],
  );
  assert.equal(
    typedPrimaryExactFunctionSources(
      "security",
      configFor(sameValueRawConsumer),
    ).has("Back"),
    false,
    "a same-value raw literal outside approved provider/translator locations must stay in the DOM inventory",
  );
  assert.throws(
    () => typedPrimaryExactFunctionSources("security", configFor(rawConsumer)),
    /typed exact field row\.detail also has a raw runtime use/u,
  );
  assert.throws(
    () =>
      typedPrimaryExactFunctionSources("security", configFor(shadowConsumer)),
    /does not reach a visible exact translator/u,
    "a lexically shadowed translator import cannot prove protected fields",
  );
  assert.equal(
    typedPrimaryExactFunctionSources(
      "security",
      configFor(shadowLiteralConsumer),
    ).has("Back"),
    false,
    "a shadowed translator call cannot approve a same-value literal location",
  );
  for (const unsafeConsumer of [
    "tests/fixtures/customer-workflow-route-closure/typed-exact-consumer-alias.tsx",
    "tests/fixtures/customer-workflow-route-closure/typed-exact-consumer-destructure.tsx",
    "tests/fixtures/customer-workflow-route-closure/typed-exact-consumer-element.tsx",
  ]) {
    assert.throws(
      () =>
        typedPrimaryExactFunctionSources("security", configFor(unsafeConsumer)),
      /typed exact protected value uses an unauditable/u,
      unsafeConsumer,
    );
  }
  assert.throws(
    () =>
      typedPrimaryExactFunctionSources(
        "security",
        configFor(
          consumer,
          "tests/fixtures/customer-workflow-route-closure/typed-exact-provider-spread.ts",
        ),
      ),
    /return objects cannot contain spread overrides/u,
  );
  const collectionLeakProvider =
    "tests/fixtures/customer-workflow-route-closure/typed-exact-provider-collection-leaks.ts";
  for (const providerFunction of [
    "initialCollectionRows",
    "aliasedCollectionPush",
    "unshiftedCollectionRow",
    "assignedCollectionRow",
  ]) {
    assert.throws(
      () =>
        typedPrimaryExactFunctionSources("security", {
          files: [collectionLeakProvider, consumer],
          typedExactFunctionParity: [
            {
              providerFile: collectionLeakProvider,
              providerFunction,
              consumerFile: consumer,
              resultBinding: "fixture",
              returnFields: ["title"],
              collections: [
                {
                  returnField: "rows",
                  providerBinding: "rows",
                  consumerItemBinding: "row",
                  fields: ["label", "detail"],
                },
              ],
            },
          ],
        }),
      /must start as one direct empty array|has unauditable alias\/write/u,
      providerFunction,
    );
  }
});

test("derived metadata provenance must contribute locale-parity output", () => {
  const fixture =
    "tests/fixtures/customer-workflow-route-closure/dead-derived-builder.ts";
  for (const builderFunction of [
    "deadMetadataBuilder",
    "nestedDeadMetadataBuilder",
    "irrelevantFieldMetadataBuilder",
    "wrongHelperFieldMetadataBuilder",
    "spreadOverrideMetadataBuilder",
    "duplicateOverrideMetadataBuilder",
  ]) {
    assert.throws(
      () =>
        generateCustomerWorkflowClientModule("private-metadata", {
          files: [fixture],
          manualExactSources: [
            {
              source: "Datalog Analysis Studio",
              provenanceFiles: [fixture],
              translations: Array.from(
                { length: masterLocaleOrder.length },
                () => "translated",
              ),
              derivedBuilder: {
                builderFile: fixture,
                builderFunction,
                targetField: "title",
                translationKey: "studioTitle",
                translationModule:
                  "@/lib/i18n/log-analysis-studio-translations",
                translatorExportName: "logStudioT",
                translatorLocalName: "logStudioT",
              },
            },
          ],
        }),
      /derived metadata builder[\s\S]*does not supply[\s\S]*title/u,
      builderFunction,
    );
  }
  const wrongImportFixture =
    "tests/fixtures/customer-workflow-route-closure/wrong-derived-import.ts";
  assert.throws(
    () =>
      generateCustomerWorkflowClientModule("private-metadata", {
        files: [wrongImportFixture],
        manualExactSources: [
          {
            source: "Datalog Analysis Studio",
            provenanceFiles: [wrongImportFixture],
            translations: Array.from(
              { length: masterLocaleOrder.length },
              () => "translated",
            ),
            derivedBuilder: {
              builderFile: wrongImportFixture,
              builderFunction: "wrongImportedExport",
              targetField: "title",
              translationKey: "studioTitle",
              translationModule:
                "../../../src/lib/i18n/log-analysis-studio-translations",
              translatorExportName: "logStudioT",
              translatorLocalName: "logStudioT",
            },
          },
        ],
      }),
    /derived metadata source[\s\S]*is not bound/u,
  );
});

test("selector provenance rejects spread overrides", () => {
  const fixture =
    "tests/fixtures/customer-workflow-route-closure/selector-spread.tsx";
  assert.throws(
    () =>
      generateCustomerWorkflowClientModule("request", {
        files: [fixture],
        manualTemplateKeys: [
          {
            key: "creditsCount",
            provenanceFiles: [fixture],
            runtimeFunctions: ["selectKey"],
          },
        ],
      }),
    /stale manual template key/u,
  );
});

test("template provenance follows a visible translated state property", () => {
  const fixture =
    "tests/fixtures/customer-workflow-route-closure/state-template-provenance.tsx";
  const configFor = (key: "creditsCount" | "selectedCount") => ({
    files: [fixture],
    manualTemplateKeys: [{ key, provenanceFiles: [fixture] }],
  });

  assert.doesNotThrow(() =>
    generateCustomerWorkflowClientModule("request", configFor("creditsCount")),
  );
  assert.throws(
    () =>
      generateCustomerWorkflowClientModule(
        "request",
        configFor("selectedCount"),
      ),
    /stale manual template key/u,
  );
});

test("external SEO exclusions require complete structural locale matrices", () => {
  const entry = {
    file: "tests/fixtures/customer-workflow-route-closure/seo-matrix.ts",
    localeMatrixBindings: ["localized"],
  } as const;
  const exclusions = externallyLocalizedSharedSourceExclusions(entry);
  assert.ok(exclusions.has("localized English metadata"));
  assert.equal(exclusions.has("Outside raw metadata copy"), false);
  assert.throws(
    () =>
      externallyLocalizedSharedSourceExclusions({
        file: "tests/fixtures/customer-workflow-route-closure/seo-matrix-missing-locale.ts",
        localeMatrixBindings: ["localized"],
      }),
    /locale matrix keys must exactly match/u,
  );
  assert.throws(
    () =>
      externallyLocalizedSharedSourceExclusions({
        file: "tests/fixtures/customer-workflow-route-closure/seo-matrix-any.ts",
        localeMatrixBindings: ["localized"],
      }),
    /without any, unknown or Record<string/u,
  );
  assert.throws(
    () =>
      externallyLocalizedSharedSourceExclusions({
        file: "tests/fixtures/customer-workflow-route-closure/seo-matrix-english-fallback.ts",
        localeMatrixBindings: ["localized"],
      }),
    /unchanged English fallback/u,
  );
  assert.equal(
    externallyLocalizedSharedSourceExclusions({
      file: "tests/fixtures/customer-workflow-route-closure/seo-matrix-helper-duplicate.ts",
      localeMatrixBindings: ["localized"],
    }).has("English title"),
    false,
    "a helper-return duplicate outside the exact locale matrix must remain in the DOM inventory",
  );
});

test("runtime function provenance must flow to the visible translated return", () => {
  const fixture =
    "tests/fixtures/customer-workflow-route-closure/misleading-runtime-function.ts";
  const configFor = (key: string) => ({
    files: [fixture],
    helper: "password" as const,
    manualTemplateKeys: [
      {
        key,
        provenanceFiles: [fixture],
        runtimeFunctions: ["translateCustomerPasswordError"],
      },
    ],
  });

  for (const staleKey of ["passwordMinimum", "passwordLowercase"]) {
    assert.throws(
      () => generateCustomerWorkflowClientModule("auth", configFor(staleKey)),
      /stale manual template key/u,
      staleKey,
    );
  }
  assert.doesNotThrow(() =>
    generateCustomerWorkflowClientModule("auth", configFor("passwordMaximum")),
  );
});

test("runtime function provenance requires the exact imported provider", () => {
  const provider =
    "tests/fixtures/customer-workflow-route-closure/runtime-function-provider.ts";
  const consumer =
    "tests/fixtures/customer-workflow-route-closure/runtime-function-consumer.tsx";
  const spoof =
    "tests/fixtures/customer-workflow-route-closure/runtime-function-spoof.tsx";
  const configFor = (consumerFile: string) => ({
    files: [provider, consumerFile],
    manualTemplateKeys: [
      {
        key: "creditsCount",
        provenanceFiles: [provider, consumerFile],
        runtimeFunctions: ["localizeFixture"],
      },
    ],
  });

  assert.doesNotThrow(() =>
    generateCustomerWorkflowClientModule("request", configFor(consumer)),
  );
  assert.throws(
    () => generateCustomerWorkflowClientModule("request", configFor(spoof)),
    /stale manual template key/u,
  );
});

test("runtime function provenance accepts only exact customer clipboard output", () => {
  const fixture =
    "tests/fixtures/customer-workflow-route-closure/runtime-function-clipboard.tsx";
  const configFor = (key: "creditsCount" | "selectedCount") => ({
    files: [fixture],
    manualTemplateKeys: [
      {
        key,
        provenanceFiles: [fixture],
        runtimeFunctions: [
          key === "creditsCount"
            ? "buildClipboardSummary"
            : "deadClipboardSummary",
        ],
      },
    ],
  });

  assert.doesNotThrow(() =>
    generateCustomerWorkflowClientModule("request", configFor("creditsCount")),
  );
  assert.throws(
    () =>
      generateCustomerWorkflowClientModule(
        "request",
        configFor("selectedCount"),
      ),
    /stale manual template key/u,
  );
});

test("nested template translators survive only direct visible string transforms", () => {
  const generated = generateCustomerWorkflowClientModule("orders", {
    files: [
      "tests/fixtures/customer-workflow-route-closure/nested-template-transform.tsx",
    ],
  });

  assert.match(generated, /"createSimilarRequest"/u);
  assert.match(generated, /"thisVehicle"/u);
  assert.doesNotMatch(generated, /"selectedCount"/u);
});

test("route conventions and transitive UI imports are fail-closed", () => {
  const closure = auditCustomerWorkflowRouteClosure(
    customerWorkflowClientSurfaceManifest,
    customerWorkflowSharedSourceManifest,
    customerWorkflowExternalConventionBoundaries,
  );
  assert.deepEqual(closure.conventionOwners.get("src/app/login/layout.tsx"), [
    "auth",
  ]);
  assert.ok(
    closure.conventionOwners
      .get("src/app/dashboard/layout.tsx")
      ?.includes("orders"),
  );
  assert.ok(
    closure.groupClosures
      .get("file-expert")
      ?.has("src/lib/fileExpert/validation.ts"),
  );

  const brokenManifest = {
    ...customerWorkflowClientSurfaceManifest,
    auth: {
      ...customerWorkflowClientSurfaceManifest.auth,
      sourceFiles:
        customerWorkflowClientSurfaceManifest.auth.sourceFiles.filter(
          (file) => file !== "src/app/login/layout.tsx",
        ),
    },
  };
  assert.throws(
    () =>
      auditCustomerWorkflowRouteClosure(
        brokenManifest,
        customerWorkflowSharedSourceManifest,
        customerWorkflowExternalConventionBoundaries,
      ),
    /src\/app\/login\/layout\.tsx: customer route convention is absent\/misassigned/u,
  );

  const missingExactRouteSampleManifest = {
    ...customerWorkflowClientSurfaceManifest,
    auth: {
      ...customerWorkflowClientSurfaceManifest.auth,
      routeSamples:
        customerWorkflowClientSurfaceManifest.auth.routeSamples.filter(
          (route) => route !== "/login",
        ),
    },
  };
  assert.throws(
    () =>
      auditCustomerWorkflowRouteClosure(
        missingExactRouteSampleManifest,
        customerWorkflowSharedSourceManifest,
        customerWorkflowExternalConventionBoundaries,
      ),
    /auth: exact route \/login requires an identical convention route sample/u,
  );

  const missingPrefixRouteSampleManifest = {
    ...customerWorkflowClientSurfaceManifest,
    orders: {
      ...customerWorkflowClientSurfaceManifest.orders,
      routeSamples:
        customerWorkflowClientSurfaceManifest.orders.routeSamples.filter(
          (route) => !route.startsWith("/dashboard/orders/"),
        ),
    },
  };
  assert.throws(
    () =>
      auditCustomerWorkflowRouteClosure(
        missingPrefixRouteSampleManifest,
        customerWorkflowSharedSourceManifest,
        customerWorkflowExternalConventionBoundaries,
      ),
    /orders: prefix route \/dashboard\/orders\/ requires a descendant convention route sample/u,
  );

  const sharedCatalogBypassSources = {
    ...customerWorkflowSharedSourceManifest,
    "portal-common": {
      ...customerWorkflowSharedSourceManifest["portal-common"],
      sourceFiles: [
        ...customerWorkflowSharedSourceManifest["portal-common"].sourceFiles,
        "src/components/CustomerNotifications.tsx",
      ],
      typedUiBoundaries: customerWorkflowSharedSourceManifest[
        "portal-common"
      ].typedUiBoundaries.filter(
        ({ file }) => file !== "src/components/CustomerNotifications.tsx",
      ),
    },
  };
  assert.throws(
    () =>
      auditCustomerWorkflowRouteClosure(
        customerWorkflowClientSurfaceManifest,
        sharedCatalogBypassSources,
        customerWorkflowExternalConventionBoundaries,
      ),
    /CustomerNotifications\.tsx[\s\S]*shared:portal-common reaches group:notifications compact catalog/u,
  );

  const foreignTypedBoundaryManifest = {
    ...customerWorkflowClientSurfaceManifest,
    auth: {
      ...customerWorkflowClientSurfaceManifest.auth,
      typedUiBoundaries: [
        ...customerWorkflowClientSurfaceManifest.auth.typedUiBoundaries,
        {
          file: "src/components/CountrySelect.tsx",
          localizationImport: "@/lib/i18n/customer-runtime-translations",
        },
      ],
    },
  };
  const foreignTypedBoundarySharedSources = {
    ...customerWorkflowSharedSourceManifest,
    "portal-common": {
      ...customerWorkflowSharedSourceManifest["portal-common"],
      typedUiBoundaries: customerWorkflowSharedSourceManifest[
        "portal-common"
      ].typedUiBoundaries.filter(
        ({ file }) => file !== "src/components/CountrySelect.tsx",
      ),
    },
  };
  assert.throws(
    () =>
      auditCustomerWorkflowRouteClosure(
        foreignTypedBoundaryManifest,
        foreignTypedBoundarySharedSources,
        customerWorkflowExternalConventionBoundaries,
      ),
    /settings\/page\.tsx[\s\S]*cannot enter foreign typed boundary/u,
  );

  const foreignLoaderCatalogManifest = {
    ...customerWorkflowClientSurfaceManifest,
    auth: {
      ...customerWorkflowClientSurfaceManifest.auth,
      languageSwitcherCatalogs: [
        ...customerWorkflowClientSurfaceManifest.auth.languageSwitcherCatalogs,
        "customer-workflow-notifications-translations",
      ],
    },
  };
  assert.throws(
    () =>
      auditCustomerWorkflowRouteClosure(
        foreignLoaderCatalogManifest,
        customerWorkflowSharedSourceManifest,
        customerWorkflowExternalConventionBoundaries,
      ),
    /auth: LanguageSwitcher catalog customer-workflow-notifications-translations is not owned\/shared by this route group/u,
  );

  const nonCatalogBoundaryManifest = {
    ...customerWorkflowClientSurfaceManifest,
    auth: {
      ...customerWorkflowClientSurfaceManifest.auth,
      typedUiBoundaries: [
        ...customerWorkflowClientSurfaceManifest.auth.typedUiBoundaries,
        {
          file: "tests/fixtures/customer-workflow-route-closure/typed-noncatalog.ts",
          localizationImport: "./helper",
        },
      ],
    },
  };
  assert.throws(
    () =>
      auditCustomerWorkflowRouteClosure(
        nonCatalogBoundaryManifest,
        customerWorkflowSharedSourceManifest,
        customerWorkflowExternalConventionBoundaries,
      ),
    /typed localization import \.\/helper must resolve to an exact manifest-owned translation catalog/u,
  );

  const typedTransitiveRawManifest = {
    ...customerWorkflowClientSurfaceManifest,
    auth: {
      ...customerWorkflowClientSurfaceManifest.auth,
      typedUiBoundaries: [
        ...customerWorkflowClientSurfaceManifest.auth.typedUiBoundaries,
        {
          file: "tests/fixtures/customer-workflow-route-closure/typed-boundary-raw-helper.tsx",
          localizationImport: "@/lib/i18n/customer-workflow-auth-translations",
        },
      ],
    },
  };
  assert.throws(
    () =>
      auditCustomerWorkflowRouteClosure(
        typedTransitiveRawManifest,
        customerWorkflowSharedSourceManifest,
        customerWorkflowExternalConventionBoundaries,
      ),
    /typed-boundary-raw-helper\.tsx -> .*raw-exported-payload\.ts: imported raw customer copy reaches visible UI without an exact typed translator/u,
  );

  const transitiveRawManifest = {
    ...customerWorkflowClientSurfaceManifest,
    auth: {
      ...customerWorkflowClientSurfaceManifest.auth,
      typedUiBoundaries: [
        ...customerWorkflowClientSurfaceManifest.auth.typedUiBoundaries,
        {
          file: "tests/fixtures/customer-workflow-route-closure/raw-transitive-consumer.tsx",
          localizationImport:
            "../../../src/lib/i18n/customer-workflow-auth-translations",
        },
      ],
    },
  };
  assert.throws(
    () =>
      auditCustomerWorkflowRouteClosure(
        transitiveRawManifest,
        customerWorkflowSharedSourceManifest,
        customerWorkflowExternalConventionBoundaries,
      ),
    /raw-transitive-consumer\.tsx -> .*raw-transitive-bridge\.ts: imported raw customer copy reaches visible UI without an exact typed translator/u,
  );

  const spoofTranslatorManifest = {
    ...customerWorkflowClientSurfaceManifest,
    auth: {
      ...customerWorkflowClientSurfaceManifest.auth,
      typedUiBoundaries: [
        ...customerWorkflowClientSurfaceManifest.auth.typedUiBoundaries,
        {
          file: "tests/fixtures/customer-workflow-route-closure/spoof-translator-consumer.tsx",
          localizationImport:
            "../../../src/lib/i18n/customer-workflow-auth-translations",
        },
      ],
    },
  };
  assert.throws(
    () =>
      auditCustomerWorkflowRouteClosure(
        spoofTranslatorManifest,
        customerWorkflowSharedSourceManifest,
        customerWorkflowExternalConventionBoundaries,
      ),
    /spoof-translator-consumer\.tsx -> .*spoof-translator-provider\.ts: imported raw customer copy reaches visible UI without an exact typed translator/u,
    "a translator-like export name from an unowned module cannot suppress raw-copy detection",
  );

  for (const [consumer, provider] of [
    ["raw-formatter-consumer.tsx", "raw-transitive-provider.ts"],
    ["formatter-hidden-consumer.tsx", "formatter-hidden-provider.ts"],
    ["raw-property-consumer.tsx", "raw-property-bridge.ts"],
    ["raw-array-consumer.tsx", "raw-transitive-provider.ts"],
    ["raw-await-consumer.tsx", "raw-transitive-provider.ts"],
    ["raw-callback-consumer.tsx", "raw-transitive-provider.ts"],
    ["raw-spoof-method-consumer.tsx", "raw-transitive-provider.ts"],
    ["raw-default-parameter-consumer.tsx", "raw-transitive-provider.ts"],
    ["raw-undefined-default-consumer.tsx", "raw-transitive-provider.ts"],
    ["raw-wrapped-default-consumer.tsx", "raw-transitive-provider.ts"],
    ["default-hidden-consumer.tsx", "default-hidden-provider.ts"],
  ] as const) {
    const formatterLaunderingManifest = {
      ...customerWorkflowClientSurfaceManifest,
      auth: {
        ...customerWorkflowClientSurfaceManifest.auth,
        typedUiBoundaries: [
          ...customerWorkflowClientSurfaceManifest.auth.typedUiBoundaries,
          {
            file: `tests/fixtures/customer-workflow-route-closure/${consumer}`,
            localizationImport:
              "../../../src/lib/i18n/customer-workflow-auth-translations",
          },
        ],
      },
    };
    assert.throws(
      () =>
        auditCustomerWorkflowRouteClosure(
          formatterLaunderingManifest,
          customerWorkflowSharedSourceManifest,
          customerWorkflowExternalConventionBoundaries,
        ),
      new RegExp(
        `${consumer.replace(".", "\\.")} -> .*${provider.replace(".", "\\.")}: imported raw customer copy reaches visible UI without an exact typed translator`,
        "u",
      ),
      `a visible expression cannot launder raw copy from ${provider}`,
    );
  }

  for (const [label, fixture] of [
    [
      "direct baseline dependency",
      "tests/fixtures/customer-workflow-route-closure/baseline-direct.ts",
    ],
    [
      "transitive baseline dependency",
      "tests/fixtures/customer-workflow-route-closure/baseline-transitive-bridge.ts",
    ],
  ] as const) {
    const baselineBypassManifest = {
      ...customerWorkflowClientSurfaceManifest,
      auth: {
        ...customerWorkflowClientSurfaceManifest.auth,
        sourceFiles: [
          ...customerWorkflowClientSurfaceManifest.auth.sourceFiles,
          fixture,
        ],
      },
    };
    assert.throws(
      () =>
        auditCustomerWorkflowRouteClosure(
          baselineBypassManifest,
          customerWorkflowSharedSourceManifest,
          customerWorkflowExternalConventionBoundaries,
        ),
      /customer-workflow-dom-observer-baseline\.ts: compact customer routes cannot depend on the full\/audit catalog graph/u,
      label,
    );
  }
});

test("source closure parses JS, JSX, TS, TSX and literal dynamic imports", () => {
  const fixture = "tests/fixtures/customer-workflow-route-closure/entry.js";
  const imports = customerWorkflowSourceImports(fixture);
  assert.deepEqual(
    imports
      .map(({ dynamic, resolved }) => ({ dynamic, resolved }))
      .sort((left, right) =>
        String(left.resolved).localeCompare(String(right.resolved)),
      ),
    [
      {
        dynamic: false,
        resolved: "tests/fixtures/customer-workflow-route-closure/bridge.ts",
      },
      {
        dynamic: true,
        resolved: "tests/fixtures/customer-workflow-route-closure/dynamic.tsx",
      },
      {
        dynamic: false,
        resolved: "tests/fixtures/customer-workflow-route-closure/helper.jsx",
      },
    ],
  );
  assert.throws(
    () =>
      customerWorkflowSourceImports(
        "tests/fixtures/customer-workflow-route-closure/invalid.jsx",
      ),
    /source parse failed/u,
  );
  assert.throws(
    () =>
      generateCustomerWorkflowClientModule("widget", {
        files: ["tests/fixtures/customer-workflow-route-closure/invalid.jsx"],
      }),
    /localization source could not be parsed/u,
  );

  const requireFixture =
    "tests/fixtures/customer-workflow-route-closure/require-entry.js";
  assert.deepEqual(
    customerWorkflowSourceImports(requireFixture).map(
      ({ dynamic, resolved, specifier }) => ({ dynamic, resolved, specifier }),
    ),
    [
      {
        dynamic: false,
        resolved:
          "tests/fixtures/customer-workflow-route-closure/require-target.jsx",
        specifier: "./require-target.jsx",
      },
      { dynamic: true, resolved: null, specifier: "<dynamic>" },
    ],
  );
  const requireManifest = {
    ...customerWorkflowClientSurfaceManifest,
    auth: {
      ...customerWorkflowClientSurfaceManifest.auth,
      sourceFiles: [
        ...customerWorkflowClientSurfaceManifest.auth.sourceFiles,
        requireFixture,
      ],
    },
  };
  assert.throws(
    () =>
      auditCustomerWorkflowRouteClosure(
        requireManifest,
        customerWorkflowSharedSourceManifest,
        customerWorkflowExternalConventionBoundaries,
      ),
    /require-entry\.js: non-literal module load is not auditable/u,
  );

  const rogueCatalogManifest = {
    ...customerWorkflowClientSurfaceManifest,
    auth: {
      ...customerWorkflowClientSurfaceManifest.auth,
      sourceFiles: [
        ...customerWorkflowClientSurfaceManifest.auth.sourceFiles,
        "tests/fixtures/customer-workflow-route-closure/catalog-entry.ts",
      ],
    },
  };
  assert.throws(
    () =>
      auditCustomerWorkflowRouteClosure(
        rogueCatalogManifest,
        customerWorkflowSharedSourceManifest,
        customerWorkflowExternalConventionBoundaries,
      ),
    /rogue-translations\.jsx: translation catalog has no exact manifest owner/u,
  );

  for (const extension of ["js", "jsx", "ts", "tsx"]) {
    assert.equal(
      customerWorkflowCatalogModuleName(
        `src/lib/i18n/non-prefixed-translations.${extension}`,
      ),
      "non-prefixed-translations",
    );
  }
  assert.equal(
    customerWorkflowSourceLooksLikeUiHelper(
      "src/lib/raw-visible-helper.tsx",
      'export function RawVisible() { return <p>{"Visible copy"}</p>; }',
    ),
    true,
  );
  assert.equal(
    customerWorkflowSourceLooksLikeUiHelper(
      "src/lib/private-data.ts",
      'export const privateData = { name: "Customer supplied value" };',
    ),
    false,
  );
  assert.equal(
    customerWorkflowSourceLooksLikeUiHelper(
      "src/lib/copy.ts",
      'export const copy = () => "Visible English";',
    ),
    false,
  );
  assert.equal(
    customerWorkflowSourceLooksLikeUiHelper(
      "src/lib/neutral-producer.ts",
      'export function value() { return "Visible English"; }',
    ),
    false,
  );
  assert.equal(
    customerWorkflowSourceLooksLikeUiHelper(
      "src/lib/neutral-arrow.ts",
      'const value = () => "Visible English"; export { value };',
    ),
    false,
  );
  assert.equal(
    customerWorkflowSourceLooksLikeUiHelper(
      "src/lib/private-producer.ts",
      'function value() { return "Internal only"; }',
    ),
    false,
  );
  assert.equal(
    customerWorkflowSourceLooksLikeUiHelper(
      "src/lib/exported-payload.ts",
      'export const payload = "Visible English";',
    ),
    false,
  );
  assert.equal(
    customerWorkflowSourceLooksLikeUiHelper(
      "src/lib/exported-object.ts",
      'export const payload = { value: "Visible English" };',
    ),
    false,
  );

  assert.equal(
    isCustomerWorkflowAppUiConventionFile("src/app/x/page.tsx"),
    true,
  );
  assert.equal(
    isCustomerWorkflowAppUiConventionFile("src/app/x/page2.tsx"),
    false,
  );
  assert.equal(
    isCustomerWorkflowAppUiConventionFile("src/app/x/layout3.jsx"),
    false,
  );
  assert.equal(
    isCustomerWorkflowAppUiConventionFile("src/app/x/icon2.tsx"),
    true,
  );
  assert.equal(
    isCustomerWorkflowAppUiConventionFile("src/app/x/opengraph-image3.js"),
    true,
  );
});

test("LanguageSwitcher compact branches match the client-safe manifest", () => {
  assert.doesNotThrow(() => validateLanguageSwitcherCompactImports());
  const source = readFileSync("src/components/LanguageSwitcher.tsx", "utf8");
  const withExtraFullImport = source.replace(
    "  let metadataCatalog: CompactCustomerWorkflowCatalog | null = null;",
    '  await import("@/lib/i18n/customer-workflow-translations");\n  let metadataCatalog: CompactCustomerWorkflowCatalog | null = null;',
  );
  assert.throws(
    () => validateLanguageSwitcherCompactImports(withExtraFullImport),
    /forbidden full\/audit catalog load/u,
  );

  const injectAuthHelper = (declaration: string, statement: string) =>
    source
      .replace(
        "async function loadCompactCustomerWorkflowCatalog(pathname: string)",
        `${declaration}\n\nasync function loadCompactCustomerWorkflowCatalog(pathname: string)`,
      )
      .replace('    case "auth":', `    case "auth":\n      ${statement}`);
  const forbiddenHelper =
    'async function hiddenCatalogLoad() { return import("@/lib/i18n/customer-workflow-translations"); }';
  for (const [label, declaration, statement] of [
    ["direct", forbiddenHelper, "await hiddenCatalogLoad();"],
    [
      "alias",
      `${forbiddenHelper}\nconst hiddenCatalogAlias = hiddenCatalogLoad;`,
      "await hiddenCatalogAlias();",
    ],
    [
      "callback",
      `${forbiddenHelper}\nasync function withCatalogCallback(load: () => Promise<unknown>) { return load(); }`,
      "await withCatalogCallback(hiddenCatalogLoad);",
    ],
    [
      "object member",
      'const hiddenLoaders = { auth: async () => import("@/lib/i18n/customer-workflow-translations") };',
      "await hiddenLoaders.auth();",
    ],
    [
      "assigned callable",
      'let hiddenAssignedLoad; hiddenAssignedLoad = async () => import("@/lib/i18n/customer-workflow-translations");',
      "await hiddenAssignedLoad();",
    ],
    [
      "assigned object member",
      'const hiddenAssignedLoaders = {}; hiddenAssignedLoaders.auth = async () => import("@/lib/i18n/customer-workflow-translations");',
      "await hiddenAssignedLoaders.auth();",
    ],
    [
      "class static member",
      'class HiddenCatalogLoader { static load() { return import("@/lib/i18n/customer-workflow-translations"); } }',
      "await HiddenCatalogLoader.load();",
    ],
    [
      "nested callable factory",
      'function hiddenFactory() { return () => import("@/lib/i18n/customer-workflow-translations"); }',
      "await hiddenFactory()();",
    ],
    [
      "conditional callable alias",
      'const hiddenCatalogLoad = () => import("@/lib/i18n/customer-workflow-translations"); const safeCatalogLoad = () => import("@/lib/i18n/customer-workflow-auth-translations"); const selectedCatalogLoad = true ? hiddenCatalogLoad : safeCatalogLoad;',
      "await selectedCatalogLoad();",
    ],
  ] as const) {
    assert.throws(
      () =>
        validateLanguageSwitcherCompactImports(
          injectAuthHelper(declaration, statement),
        ),
      /(?:forbidden full\/audit catalog load|ambiguous local helper alias)/u,
      label,
    );
  }
  for (const [kind, load] of [
    ["import", "import(hiddenCatalogSpecifier)"],
    ["require", "require(hiddenCatalogSpecifier)"],
  ] as const) {
    const declaration =
      'const hiddenCatalogSpecifier = "@/lib/i18n/customer-workflow-auth-translations";\n' +
      `async function hiddenNonLiteralLoad() { return ${load}; }`;
    assert.throws(
      () =>
        validateLanguageSwitcherCompactImports(
          injectAuthHelper(declaration, "await hiddenNonLiteralLoad();"),
        ),
      new RegExp(`non-literal ${kind}\\(\\) expression`, "u"),
      kind,
    );
  }
  assert.throws(
    () =>
      validateLanguageSwitcherCompactImports(
        injectAuthHelper(
          'async function hiddenCompactLoad() { return import("@/lib/i18n/customer-workflow-notifications-translations"); }',
          "await hiddenCompactLoad();",
        ),
      ),
    /LanguageSwitcher\/auth: compact imports disagree with manifest[\s\S]*customer-workflow-notifications-translations/u,
  );
});

function localTypeScriptImport(fromFile: string, specifier: string) {
  const base = specifier.startsWith("@/")
    ? path.resolve("src", specifier.slice(2))
    : specifier.startsWith(".")
      ? path.resolve(path.dirname(fromFile), specifier)
      : null;
  if (!base) return null;
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ];
  const match = candidates.find(
    (candidate) => existsSync(candidate) && /\.tsx?$/u.test(candidate),
  );
  return match
    ? path.relative(process.cwd(), match).replaceAll("\\", "/")
    : null;
}

function staticRuntimeImports(file: string) {
  const sourceText = readFileSync(file, "utf8");
  const source = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const imports: string[] = [];
  source.statements.forEach((statement) => {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      return;
    }
    const clause = statement.importClause;
    const namedImports =
      clause?.namedBindings && ts.isNamedImports(clause.namedBindings)
        ? clause.namedBindings.elements
        : [];
    if (
      clause?.isTypeOnly ||
      (namedImports.length > 0 && namedImports.every((item) => item.isTypeOnly))
    ) {
      return;
    }
    const resolved = localTypeScriptImport(
      file,
      statement.moduleSpecifier.text,
    );
    if (resolved) imports.push(resolved);
  });
  return imports;
}

test("client dependency graphs exclude full workflow and audit manifests", () => {
  const pending = ["src"];
  const clientEntries: string[] = [];
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
      clientEntries.push(child);
    }
  }

  const forbidden = new Set([
    "src/lib/i18n/customer-workflow-dom-observer-baseline.ts",
    "src/lib/i18n/customer-workflow-surface-manifest.ts",
    "src/lib/i18n/customer-workflow-translations.ts",
  ]);
  const offenders: string[] = [];
  for (const entry of clientEntries) {
    const graphPending = [entry];
    const visited = new Set<string>();
    while (graphPending.length) {
      const current = graphPending.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      if (forbidden.has(current)) {
        offenders.push(`${entry} -> ${current}`);
        continue;
      }
      graphPending.push(...staticRuntimeImports(current));
    }
  }
  assert.deepEqual(offenders, []);
});

test("reachable customer UI imports have an exact manifest classification", () => {
  const observerSources = new Set<string>();
  const typedBoundaries = new Map<string, readonly string[]>();
  for (const surface of Object.values(customerWorkflowClientSurfaceManifest)) {
    surface.sourceFiles.forEach((file) => observerSources.add(file));
    surface.typedUiBoundaries.forEach((boundary) =>
      typedBoundaries.set(boundary.file, [
        boundary.localizationImport,
        ...("additionalLocalizationImports" in boundary
          ? (boundary.additionalLocalizationImports as readonly string[])
          : []),
      ]),
    );
  }
  for (const surface of Object.values(customerWorkflowSharedSourceManifest)) {
    surface.sourceFiles.forEach((file) => observerSources.add(file));
    surface.typedUiBoundaries.forEach((boundary) =>
      typedBoundaries.set(boundary.file, [
        boundary.localizationImport,
        ...("additionalLocalizationImports" in boundary
          ? (boundary.additionalLocalizationImports as readonly string[])
          : []),
      ]),
    );
  }

  const classified = new Set([...observerSources, ...typedBoundaries.keys()]);
  const pending = [...observerSources].filter((file) => file.endsWith(".tsx"));
  const visited = new Set<string>();
  const missing: string[] = [];
  while (pending.length) {
    const current = pending.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const imported of staticRuntimeImports(current)) {
      if (
        !imported.endsWith(".tsx") ||
        (!imported.startsWith("src/app/") &&
          !imported.startsWith("src/components/"))
      ) {
        continue;
      }
      if (!classified.has(imported)) {
        missing.push(`${current} -> ${imported}`);
        continue;
      }
      if (!typedBoundaries.has(imported)) pending.push(imported);
    }
  }

  for (const [file, localizationImports] of typedBoundaries) {
    const source = readFileSync(file, "utf8");
    for (const localizationImport of localizationImports) {
      assert.ok(
        source.includes(`from "${localizationImport}"`) ||
          source.includes(`from '${localizationImport}'`),
        `${file}: typed boundary must import ${localizationImport}`,
      );
    }
  }
  assert.deepEqual([...new Set(missing)].sort(), []);
});

test("every supported customer route uses a bounded compact catalog", () => {
  const manifestEntries = Object.entries(
    customerWorkflowClientSurfaceManifest,
  ) as Array<
    [CustomerWorkflowClientGroup, CustomerWorkflowClientSurfaceConfig]
  >;
  const generatedModules = new Set(
    generatedCustomerWorkflowClientFiles().map(
      ({ path }) =>
        path.replaceAll("\\", "/").split("/").at(-1)?.replace(/\.ts$/u, "") ??
        "",
    ),
  );
  const switcher = readFileSync("src/components/LanguageSwitcher.tsx", "utf8");
  const expectedManagedSegments = new Set(
    manifestEntries.flatMap(([, surface]) =>
      [...surface.exactRoutes, ...surface.prefixRoutes]
        .map((route) => route.split("/").filter(Boolean)[0])
        .filter(Boolean),
    ),
  );
  assert.deepEqual(
    new Set(customerWorkflowManagedRouteSegments),
    expectedManagedSegments,
  );
  assert.match(switcher, /new Set\(customerWorkflowManagedRouteSegments\)/u);
  assert.doesNotMatch(
    switcher,
    /const customerWorkflowSegments = new Set\(\s*\[/u,
  );
  for (const helperSource of [
    "src/lib/requestFlow.ts",
    "src/lib/requestIntelligence.ts",
  ]) {
    assert.ok(
      customerWorkflowClientSurfaceManifest.request.sourceFiles.some(
        (file) => file === helperSource,
      ),
      `request generator does not own ${helperSource}`,
    );
    assert.ok(
      customerWorkflowManifestSourceFiles.includes(helperSource),
      `checker audit closure does not own ${helperSource}`,
    );
    assert.ok(
      customerWorkflowAuditRoots(["src/app/page.tsx"]).includes(helperSource),
      `checker audit roots do not expand ${helperSource}`,
    );
  }

  const sourceOwners = new Map<string, CustomerWorkflowClientGroup[]>();
  for (const [group, surface] of manifestEntries) {
    for (const file of surface.sourceFiles) {
      const owners = sourceOwners.get(file) ?? [];
      owners.push(group);
      sourceOwners.set(file, owners);
    }
  }
  const pendingAppDirectories = ["src/app"];
  while (pendingAppDirectories.length > 0) {
    const directory = pendingAppDirectories.pop()!;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const child = `${directory}/${entry.name}`;
      if (entry.isDirectory()) {
        pendingAppDirectories.push(child);
        continue;
      }
      if (!/^page\.(?:js|jsx|ts|tsx)$/u.test(entry.name)) continue;
      const routePath = `/${child
        .replace(/^src\/app\//u, "")
        .replace(/\/page\.(?:js|jsx|ts|tsx)$/u, "")}`;
      const firstSegment = routePath.split("/").filter(Boolean)[0];
      if (!firstSegment || !expectedManagedSegments.has(firstSegment)) continue;
      const owners = sourceOwners.get(child) ?? [];
      assert.equal(
        owners.length,
        1,
        `customer route must have one manifest owner: ${child}`,
      );
      assert.equal(
        customerWorkflowClientGroupForPath(routePath),
        owners[0],
        `customer route and manifest owner disagree: ${child}`,
      );
    }
  }

  for (const [group, surface] of manifestEntries) {
    assert.deepEqual(
      {
        exactRoutes: surface.exactRoutes,
        prefixRoutes: surface.prefixRoutes,
        routeSamples: surface.routeSamples,
      },
      customerWorkflowClientRouteManifest[group],
      `${group}: audit metadata must use the client-safe canonical route table`,
    );
    for (const pathname of surface.exactRoutes) {
      assert.equal(
        customerWorkflowClientGroupForPath(pathname),
        group,
        pathname,
      );
    }
    for (const prefix of surface.prefixRoutes) {
      assert.ok(prefix.endsWith("/"), `${group}: ${prefix}`);
      assert.ok(
        surface.routeSamples.some((sample) => sample.startsWith(prefix)),
        `${group}: ${prefix}`,
      );
    }
    for (const pathname of surface.routeSamples) {
      assert.equal(
        customerWorkflowClientGroupForPath(pathname),
        group,
        pathname,
      );
    }
    for (const file of surface.sourceFiles) {
      assert.doesNotThrow(
        () => readFileSync(file, "utf8"),
        `${group}: ${file}`,
      );
    }
    for (const { file } of surface.typedUiBoundaries) {
      assert.doesNotThrow(
        () => readFileSync(file, "utf8"),
        `${group}: ${file}`,
      );
    }

    const caseStart = switcher.indexOf(`case "${group}":`);
    assert.ok(caseStart >= 0, `missing compact runtime case: ${group}`);
    const nextCase = switcher.indexOf("\n    case ", caseStart + 1);
    const switchEnd = switcher.indexOf("\n  }\n\n  // Dashboard", caseStart);
    const caseEnd = nextCase >= 0 ? nextCase : switchEnd;
    assert.ok(
      caseEnd > caseStart,
      `could not isolate compact runtime case: ${group}`,
    );
    const caseSource = switcher.slice(caseStart, caseEnd);
    for (const catalog of surface.languageSwitcherCatalogs) {
      assert.ok(
        caseSource.includes(catalog),
        `${group}: runtime omits ${catalog}`,
      );
      if (catalog !== "widget-site-translations") {
        assert.ok(
          generatedModules.has(catalog),
          `${group}: missing generated ${catalog}`,
        );
      }
    }
  }

  for (const [name, shared] of Object.entries(
    customerWorkflowSharedSourceManifest,
  )) {
    for (const file of shared.sourceFiles) {
      assert.doesNotThrow(() => readFileSync(file, "utf8"), `${name}: ${file}`);
    }
    for (const { file } of shared.typedUiBoundaries) {
      assert.doesNotThrow(() => readFileSync(file, "utf8"), `${name}: ${file}`);
    }
  }

  for (const pathname of ["/auth/provider-internal"]) {
    assert.equal(customerWorkflowClientGroupForPath(pathname), null, pathname);
  }

  assert.ok(
    customerWorkflowClientSurfaceManifest.credits.sourceFiles.some(
      (file) => file === "src/app/dashboard/credits/history/page.tsx",
    ),
  );
  assert.ok(
    customerWorkflowClientSurfaceManifest.security.sourceFiles.some(
      (file) => file === "src/app/dashboard/settings/page.tsx",
    ),
  );

  const compactBranch = switcher.indexOf("if (compactCustomerWorkflow)");
  const fullCatalogImport = switcher.indexOf('import("@/lib/i18n")');
  assert.ok(compactBranch >= 0 && fullCatalogImport > compactBranch);
  assert.match(switcher, /customer-workflow-request-dom-translations/u);
  assert.match(switcher, /customer-workflow-portal-common-translations/u);
  assert.match(switcher, /case "portal"/u);
  assert.match(switcher, /case "security"/u);
  assert.match(switcher, /case "widget"/u);
  assert.match(switcher, /customer-workflow-widget-dom-translations/u);
  assert.match(switcher, /customer-workflow-private-metadata-translations/u);
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
        assert.notEqual(
          values[index],
          source,
          `${name}/${locale}: fallback ${source}`,
        );
      });
    }
  };

  assertNative(
    "portal",
    masterLocaleOrder,
    portalCommon.customerWorkflowExactTranslations,
    ["Customer Panel", "Settings"],
  );
  for (const source of [
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
  ]) {
    assert.ok(
      (
        orders.customerWorkflowExactTranslations as Readonly<
          Record<string, readonly string[]>
        >
      )[source],
      `orders primary catalog omits ${source}`,
    );
  }
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
      "Your profile form is not shown until customer settings load successfully. This prevents default profile values or an incorrect bank-transfer reference from being displayed.",
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

function transitiveRuntimeSourceFiles(entryFiles: readonly string[]) {
  const pending = [...entryFiles];
  const visited = new Set<string>();
  while (pending.length) {
    const current = pending.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const imported of customerWorkflowSourceImports(current)) {
      if (imported.specifier === "<dynamic>") {
        throw new Error(
          `${current}: non-literal dynamic import bypasses budget graph`,
        );
      }
      if (imported.resolved?.startsWith("src/")) {
        pending.push(imported.resolved);
        continue;
      }
      const sourceExtension = path.posix.extname(imported.specifier);
      if (
        !imported.resolved &&
        (imported.specifier.startsWith("@/") ||
          imported.specifier.startsWith(".")) &&
        (!sourceExtension || /\.(?:js|jsx|ts|tsx)$/u.test(sourceExtension))
      ) {
        throw new Error(
          `${current}: unresolved local module bypasses budget graph: ${imported.specifier}`,
        );
      }
    }
  }
  return [...visited].sort();
}

function freshEmittedLayoutChunk(sourceFiles: readonly string[]) {
  const appChunkDirectory = ".next/static/chunks/app";
  if (!existsSync(".next/BUILD_ID") || !existsSync(appChunkDirectory))
    return null;
  const candidates = readdirSync(appChunkDirectory)
    .filter((file) => /^layout-[a-f0-9]+\.js$/u.test(file))
    .map((file) => path.join(appChunkDirectory, file));
  if (candidates.length !== 1) return null;
  const layoutChunk = candidates[0];
  const newestSourceMtime = Math.max(
    ...sourceFiles.map((file) => statSync(file).mtimeMs),
  );
  return statSync(layoutChunk).mtimeMs >= newestSourceMtime
    ? { layoutChunk, newestSourceMtime }
    : null;
}

function exactBudgetCatalogSourceFile(catalog: string) {
  const base = `src/lib/i18n/${catalog}`;
  const candidates = [".js", ".jsx", ".ts", ".tsx"]
    .map((extension) => `${base}${extension}`)
    .filter((candidate) => existsSync(candidate));
  assert.equal(
    candidates.length,
    1,
    `${catalog}: budget graph requires one exact JS/JSX/TS/TSX catalog source`,
  );
  return candidates[0];
}

function emittedCompactCatalogFiles(
  group: CustomerWorkflowClientGroup,
  layoutChunk: string,
  dashboardRoute: boolean,
) {
  const source = readFileSync(layoutChunk, "utf8");
  const escapedGroup = group.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const branch = source.match(
    new RegExp(
      `case["']${escapedGroup}["']:(.*?)(?=break;case["']|case["']|}}let\\s|}let\\s)`,
      "u",
    ),
  )?.[1];
  assert.ok(branch, `${group}: emitted compact switch branch is missing`);
  const chunkIds = new Set(
    [...branch.matchAll(/\.e\((\d+)\)/gu)].map((match) => match[1]),
  );
  if (dashboardRoute) {
    const metadataChunk = source.match(
      /startsWith\(["']\/dashboard["']\).*?\.e\((\d+)\)/u,
    )?.[1];
    assert.ok(
      metadataChunk,
      `${group}: emitted private metadata chunk is missing`,
    );
    chunkIds.add(metadataChunk);
  }
  assert.ok(chunkIds.size > 0, `${group}: no emitted compact chunks found`);

  const emittedFiles: string[] = [];
  const pending = [".next/static/chunks"];
  while (pending.length) {
    const directory = pending.pop()!;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const child = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        pending.push(child);
      } else if (
        [...chunkIds].some((id) =>
          new RegExp(`^${id}(?:-|\\.).*\\.js$`, "u").test(entry.name),
        )
      ) {
        emittedFiles.push(child);
      }
    }
  }
  for (const chunkId of chunkIds) {
    assert.ok(
      emittedFiles.some((file) =>
        new RegExp(`^${chunkId}(?:-|\\.)`, "u").test(path.basename(file)),
      ),
      `${group}: emitted chunk ${chunkId} is missing`,
    );
  }
  return [...new Set(emittedFiles)].sort();
}

function bundledCompactCatalogFallback(entryFiles: readonly string[]) {
  const imports: string[] = [];
  const catalogs: string[] = [];
  entryFiles.forEach((file, index) => {
    imports.push(
      `import * as catalog${index} from ${JSON.stringify(`./${file}`)};`,
    );
    catalogs.push(`catalog${index}`);
  });
  const result = buildSync({
    absWorkingDir: process.cwd(),
    alias: { "@": path.resolve("src") },
    bundle: true,
    format: "esm",
    logLevel: "silent",
    minify: true,
    platform: "browser",
    stdin: {
      contents: `${imports.join("\n")}\nexport const catalogs = [${catalogs.join(",")}];`,
      loader: "ts",
      resolveDir: process.cwd(),
      sourcefile: "customer-workflow-budget-entry.ts",
    },
    target: "es2020",
    treeShaking: true,
    write: false,
  });
  assert.equal(
    result.outputFiles.length,
    1,
    "source fallback emitted extra chunks",
  );
  return result.outputFiles[0].contents;
}

test("every compact route group stays below its transitive or emitted gzip budget", () => {
  const budgetsKiB: Record<CustomerWorkflowClientGroup, number> = {
    auth: 34,
    overview: 34,
    request: 63,
    credits: 42,
    "file-expert": 39,
    orders: 50,
    notifications: 22,
    portal: 18,
    security: 35,
    widget: 55,
  };

  const budgetCatalogSourceFiles = [
    ...Object.values(customerWorkflowClientSurfaceManifest).flatMap((surface) =>
      surface.languageSwitcherCatalogs.map((catalog) =>
        exactBudgetCatalogSourceFile(catalog),
      ),
    ),
    exactBudgetCatalogSourceFile(
      "customer-workflow-private-metadata-translations",
    ),
  ];
  const allBudgetSourceFiles = transitiveRuntimeSourceFiles([
    "src/components/LanguageSwitcher.tsx",
    ...budgetCatalogSourceFiles,
  ]);
  const emittedBuild = freshEmittedLayoutChunk(allBudgetSourceFiles);

  for (const [name, surface] of Object.entries(
    customerWorkflowClientSurfaceManifest,
  ) as Array<
    [CustomerWorkflowClientGroup, CustomerWorkflowClientSurfaceConfig]
  >) {
    const catalogs = new Set([
      ...surface.languageSwitcherCatalogs,
      ...(surface.routeSamples.some((route) => route.startsWith("/dashboard"))
        ? ["customer-workflow-private-metadata-translations"]
        : []),
    ]);
    const entryFiles = [...catalogs].map(exactBudgetCatalogSourceFile);
    assert.ok(entryFiles.length > 0, `${name}: no runtime catalogs`);
    const sourceGraph = transitiveRuntimeSourceFiles(entryFiles);
    const emittedFiles = emittedBuild
      ? emittedCompactCatalogFiles(
          name,
          emittedBuild.layoutChunk,
          surface.routeSamples.some((route) => route.startsWith("/dashboard")),
        )
      : null;
    const freshEmittedFiles = emittedFiles?.every(
      (file) => statSync(file).mtimeMs >= emittedBuild!.newestSourceMtime,
    )
      ? emittedFiles
      : null;
    const measuredFiles = freshEmittedFiles ?? sourceGraph;
    const gzipKiB = freshEmittedFiles
      ? freshEmittedFiles.reduce(
          (total, file) => total + gzipSync(readFileSync(file)).byteLength,
          0,
        ) / 1024
      : gzipSync(bundledCompactCatalogFallback(entryFiles)).byteLength / 1024;
    assert.ok(
      gzipKiB <= budgetsKiB[name],
      `${name}: ${gzipKiB.toFixed(1)} KiB > ${budgetsKiB[name]} KiB ` +
        `(${freshEmittedFiles ? "emitted" : "source graph"}: ${measuredFiles.join(", ")})`,
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
    assert.ok(
      translatedSources.has(source),
      `missing compact auth copy: ${source}`,
    );
  }

  assert.equal(translatedSources.has("you@example.com"), false);
  assert.equal(
    auth.customerWorkflowExactT("tr", "you@example.com"),
    "you@example.com",
  );
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
