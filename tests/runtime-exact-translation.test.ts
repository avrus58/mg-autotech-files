import assert from "node:assert/strict";
import test from "node:test";
import { supportedLocales, type LocaleCode } from "../src/lib/i18nConfig";
import {
  createCanonicalSourceAccumulator,
  registerCanonicalSource,
  registerCanonicalVariant,
  translateRuntimeExactText,
  type RuntimeTranslationCatalog,
} from "../src/lib/i18n/runtime-exact-translation";
import {
  customerWorkflowExactTranslations as privateMetadataExactTranslations,
  customerWorkflowLocaleOrder as privateMetadataLocaleOrder,
} from "../src/lib/i18n/customer-workflow-private-metadata-translations";
import * as credits from "../src/lib/i18n/customer-workflow-credits-translations";
import * as creditsDom from "../src/lib/i18n/customer-workflow-credits-dom-translations";
import * as portalCommon from "../src/lib/i18n/customer-workflow-portal-common-translations";
import * as security from "../src/lib/i18n/customer-workflow-security-translations";
import * as securityDom from "../src/lib/i18n/customer-workflow-security-dom-translations";
import * as widgetDom from "../src/lib/i18n/customer-workflow-widget-dom-translations";
import {
  widgetSiteExactTranslations,
  widgetSiteLocaleOrder,
} from "../src/lib/i18n/widget-site-translations";

type CompactCatalog = {
  customerWorkflowExactTranslations: Readonly<Record<string, readonly string[]>>;
  customerWorkflowLocaleOrder: readonly Exclude<LocaleCode, "en">[];
};

function emptyDictionaries() {
  return Object.fromEntries(
    supportedLocales.map(({ code }) => [code, {}]),
  ) as Record<LocaleCode, Record<string, string>>;
}

function registerCompactCatalog(
  accumulator: ReturnType<typeof createCanonicalSourceAccumulator>,
  catalog: CompactCatalog,
) {
  Object.entries(catalog.customerWorkflowExactTranslations).forEach(
    ([source, values]) => {
      registerCanonicalSource(accumulator, source);
      values.forEach((value) =>
        registerCanonicalVariant(accumulator, source, value),
      );
    },
  );
}

function applyTargetLocale(
  target: Record<LocaleCode, Record<string, string>>,
  catalog: CompactCatalog,
  locale: Exclude<LocaleCode, "en">,
) {
  const localeIndex = catalog.customerWorkflowLocaleOrder.indexOf(locale);
  assert.ok(localeIndex >= 0, `${locale}: compact locale index`);
  Object.entries(catalog.customerWorkflowExactTranslations).forEach(
    ([source, values]) => {
      target[locale][source] = values[localeIndex];
    },
  );
}

function dashboardCatalog(): RuntimeTranslationCatalog {
  const canonical = createCanonicalSourceAccumulator();
  const rows = [
    {
      source: "Customer Dashboard",
      de: "Kunden-Dashboard",
      fr: "Tableau de bord client",
    },
    {
      source:
        "Secure MG AutoTech customer dashboard for file requests, credits and deliveries.",
      de: "Sicheres MG AutoTech Kunden-Dashboard für Dateianfragen, Credits und Lieferungen.",
      fr: "Tableau de bord client MG AutoTech sécurisé pour les demandes de fichiers, les crédits et les livraisons.",
    },
  ] as const;

  rows.forEach((row) => {
    registerCanonicalSource(canonical, row.source);
    registerCanonicalVariant(canonical, row.source, row.de);
    registerCanonicalVariant(canonical, row.source, row.fr);
  });

  const supplementalExact = emptyDictionaries();
  rows.forEach((row) => {
    supplementalExact.de[row.source] = row.de;
    supplementalExact.fr[row.source] = row.fr;
  });

  return {
    exact: emptyDictionaries(),
    supplementalExact,
    terms: emptyDictionaries(),
    canonicalSources: canonical.lookup,
  };
}

test("sequential private-locale switches canonicalize the current SSR language", () => {
  const catalog = dashboardCatalog();

  assert.equal(
    translateRuntimeExactText(
      "Kunden-Dashboard | MG AutoTech",
      "fr",
      catalog,
    ),
    "Tableau de bord client | MG AutoTech",
  );
  assert.equal(
    translateRuntimeExactText(
      "Kunden-Dashboard | MG AutoTech",
      "en",
      catalog,
    ),
    "Customer Dashboard | MG AutoTech",
  );
  assert.equal(
    translateRuntimeExactText("  Kunden-Dashboard  ", "de", catalog),
    "  Kunden-Dashboard  ",
  );
  assert.equal(
    translateRuntimeExactText(
      "Sicheres MG AutoTech Kunden-Dashboard für Dateianfragen, Credits und Lieferungen.",
      "fr",
      catalog,
    ),
    "Tableau de bord client MG AutoTech sécurisé pour les demandes de fichiers, les crédits et les livraisons.",
  );
});

test("cross-catalog collisions and values equal to an English source stay ambiguous", () => {
  const canonical = createCanonicalSourceAccumulator();
  registerCanonicalSource(canonical, "First source");
  registerCanonicalVariant(canonical, "First source", "Gemeinsam");
  registerCanonicalSource(canonical, "Second source");
  registerCanonicalVariant(canonical, "Second source", "Gemeinsam");
  registerCanonicalSource(canonical, "Existing English source");
  registerCanonicalVariant(
    canonical,
    "First source",
    "Existing English source",
  );

  assert.equal(canonical.lookup.Gemeinsam, undefined);
  assert.equal(canonical.lookup["Existing English source"], undefined);

  const supplementalExact = emptyDictionaries();
  supplementalExact.fr["First source"] = "Première source";
  const catalog: RuntimeTranslationCatalog = {
    exact: emptyDictionaries(),
    supplementalExact,
    terms: emptyDictionaries(),
    canonicalSources: canonical.lookup,
  };
  assert.equal(
    translateRuntimeExactText("Gemeinsam", "fr", catalog),
    "Gemeinsam",
  );
});

test("customer-authored values that look like e-mail addresses are never translated", () => {
  const catalog = dashboardCatalog();
  catalog.canonicalSources["customer@example.com"] = "Customer Dashboard";
  assert.equal(
    translateRuntimeExactText("customer@example.com", "fr", catalog),
    "customer@example.com",
  );
});

test("every unique private metadata variant can switch directly to every locale", () => {
  const canonical = createCanonicalSourceAccumulator();
  Object.entries(privateMetadataExactTranslations).forEach(([source, values]) => {
    registerCanonicalSource(canonical, source);
    values.forEach((value) => registerCanonicalVariant(canonical, source, value));
  });

  for (const [source, values] of Object.entries(privateMetadataExactTranslations)) {
    values.forEach((currentValue) => {
      assert.equal(
        canonical.lookup[currentValue],
        source,
        `private metadata variant must resolve uniquely: ${currentValue}`,
      );

      for (const targetLocale of privateMetadataLocaleOrder) {
        const supplementalExact = emptyDictionaries();
        supplementalExact[targetLocale][source] =
          values[privateMetadataLocaleOrder.indexOf(targetLocale)];
        const catalog: RuntimeTranslationCatalog = {
          exact: emptyDictionaries(),
          supplementalExact,
          terms: emptyDictionaries(),
          canonicalSources: canonical.lookup,
        };
        assert.equal(
          translateRuntimeExactText(currentValue, targetLocale, catalog),
          supplementalExact[targetLocale][source],
          `${currentValue} -> ${targetLocale}`,
        );
        assert.equal(
          translateRuntimeExactText(currentValue, "en", catalog),
          source,
          `${currentValue} -> en`,
        );
      }
    });
  }
});

test("dashboard route-group collisions cannot block metadata language switches", () => {
  const metadataCatalog: CompactCatalog = {
    customerWorkflowExactTranslations: privateMetadataExactTranslations,
    customerWorkflowLocaleOrder: privateMetadataLocaleOrder,
  };
  const widgetSiteCatalog: CompactCatalog = {
    customerWorkflowExactTranslations: widgetSiteExactTranslations,
    customerWorkflowLocaleOrder: widgetSiteLocaleOrder,
  };
  const groups: Record<string, readonly CompactCatalog[]> = {
    portal: [portalCommon, metadataCatalog],
    credits: [credits, creditsDom, portalCommon, metadataCatalog],
    security: [security, securityDom, portalCommon, metadataCatalog],
    widget: [widgetDom, portalCommon, widgetSiteCatalog, metadataCatalog],
  };
  const metadataCanonical = createCanonicalSourceAccumulator();
  registerCompactCatalog(metadataCanonical, metadataCatalog);
  const titleSources = new Set([
    "Customer Dashboard",
    "Datalog Analysis Studio",
  ]);

  for (const [groupName, catalogs] of Object.entries(groups)) {
    const mergedCanonical = createCanonicalSourceAccumulator();
    catalogs.forEach((catalog) =>
      registerCompactCatalog(mergedCanonical, catalog),
    );

    for (const [source, variants] of Object.entries(
      privateMetadataExactTranslations,
    )) {
      for (const currentVariant of variants) {
        for (const targetLocale of privateMetadataLocaleOrder) {
          const supplementalExact = emptyDictionaries();
          catalogs.forEach((catalog) =>
            applyTargetLocale(supplementalExact, catalog, targetLocale),
          );
          const targetIndex = privateMetadataLocaleOrder.indexOf(targetLocale);
          const suffix = titleSources.has(source) ? " | MG AutoTech" : "";
          const catalog: RuntimeTranslationCatalog = {
            exact: emptyDictionaries(),
            supplementalExact,
            terms: emptyDictionaries(),
            canonicalSources: mergedCanonical.lookup,
            metadataCanonicalSources: metadataCanonical.lookup,
          };

          assert.equal(
            translateRuntimeExactText(
              `${currentVariant}${suffix}`,
              targetLocale,
              catalog,
              "metadata",
            ),
            `${variants[targetIndex]}${suffix}`,
            `${groupName}: ${source} -> ${targetLocale}`,
          );
          assert.equal(
            translateRuntimeExactText(
              `${currentVariant}${suffix}`,
              "en",
              catalog,
              "metadata",
            ),
            `${source}${suffix}`,
            `${groupName}: ${source} -> en`,
          );
        }
      }
    }
  }
});
