import assert from "node:assert/strict";
import test from "node:test";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AppRouterContext,
  type AppRouterInstance,
} from "next/dist/shared/lib/app-router-context.shared-runtime.js";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime.js";
import { buildHomepageTranslationCatalog } from "../src/lib/homepageTranslationCatalog";
import {
  intlLocaleByCode,
  supportedLocales,
} from "../src/lib/i18nConfig";
import { renderRootHomepage } from "../src/lib/renderRootHomepage";
import { ActiveLocaleProvider } from "../src/lib/useActiveLocale";

const router: AppRouterInstance = {
  back: () => undefined,
  forward: () => undefined,
  refresh: () => undefined,
  push: () => undefined,
  replace: () => undefined,
  prefetch: () => undefined,
};

function escapeRenderedText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;");
}

function parseJsonLdBlocks(html: string) {
  return Array.from(
    html.matchAll(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gu,
    ),
    (match) => JSON.parse(match[1]) as Record<string, unknown>,
  );
}

test("canonical homepage first paint follows the server-resolved locale", () => {
  const criticalSources = [
    "Professional online file service platform",
    "The core workshop services, without the clutter.",
    "TCU & Gearbox",
    "From original file to secure delivery in four clear steps.",
    "Ready to upload a file?",
  ] as const;

  for (const { code: locale } of supportedLocales) {
    if (locale === "en") continue;

    const catalog = buildHomepageTranslationCatalog(locale);
    assert.ok(catalog, locale);

    const html = renderToStaticMarkup(
      createElement(
        AppRouterContext.Provider,
        { value: router },
        createElement(
          PathnameContext.Provider,
          { value: "/" },
          createElement(
            ActiveLocaleProvider,
            {
              initialLocale: locale,
            } as ComponentProps<typeof ActiveLocaleProvider>,
            renderRootHomepage(locale),
          ),
        ),
      ),
    );

    assert.match(html, new RegExp(`data-unified-localized-homepage="${locale}"`, "u"));
    for (const source of criticalSources) {
      const translated = catalog.exact[source];
      assert.ok(translated, `${locale}: missing ${source}`);
      assert.notEqual(translated, source, `${locale}: untranslated ${source}`);
      assert.ok(
        html.includes(escapeRenderedText(translated)),
        `${locale}: SSR omitted ${translated}`,
      );
      assert.ok(!html.includes(`>${source}<`), `${locale}: SSR leaked ${source}`);
    }

    const schemas = parseJsonLdBlocks(html);
    assert.equal(schemas.length, 4, `${locale}: expected four JSON-LD blocks`);
    assert.deepEqual(
      schemas.map((schema) => schema["@type"]),
      ["WebPage", "Service", "FAQPage", "HowTo"],
      `${locale}: unexpected homepage JSON-LD types`,
    );

    for (const schema of schemas) {
      assert.equal(
        schema.inLanguage,
        intlLocaleByCode[locale],
        `${locale}: ${String(schema["@type"])} schema language mismatch`,
      );
    }

    const pageSchema = schemas[0];
    assert.equal(
      pageSchema.name,
      `MG AutoTech — ${catalog.exact["Professional online file service platform"]}`,
      `${locale}: WebPage name did not use visible localized copy`,
    );
    assert.equal(
      pageSchema.description,
      catalog.exact[
        "Upload original ECU/TCU files, select your service, track your order and download the completed file directly through the secure MG AutoTech customer portal."
      ],
      `${locale}: WebPage description did not use localized hero copy`,
    );

    const serviceSchema = schemas[1] as {
      name?: unknown;
      hasOfferCatalog?: {
        name?: unknown;
        itemListElement?: Array<{
          itemOffered?: { description?: unknown };
        }>;
      };
    };
    assert.equal(
      serviceSchema.name,
      `MG AutoTech ${catalog.exact["File Service"]}`,
      `${locale}: Service name was not localized`,
    );
    assert.equal(
      serviceSchema.hasOfferCatalog?.name,
      catalog.exact["The core workshop services, without the clutter."],
      `${locale}: offer catalog name was not localized`,
    );
    assert.equal(
      serviceSchema.hasOfferCatalog?.itemListElement?.[0]?.itemOffered
        ?.description,
      catalog.exact["Performance optimization for stock vehicles."],
      `${locale}: service description was not localized`,
    );

    const faqSchema = schemas[2] as {
      mainEntity?: Array<{
        name?: unknown;
        acceptedAnswer?: { text?: unknown };
      }>;
    };
    assert.equal(
      faqSchema.mainEntity?.[0]?.name,
      catalog.exact[
        "What should I prepare before sending an ECU or TCU file request?"
      ],
      `${locale}: FAQ question was not localized`,
    );
    assert.equal(
      faqSchema.mainEntity?.[0]?.acceptedAnswer?.text,
      catalog.exact[
        "Prepare the vehicle brand, model, engine, ECU or TCU information when available, read method, selected service and a short technical note. The public preparation tools can help organize this before the secure request is created."
      ],
      `${locale}: FAQ answer was not localized`,
    );

    const howToSchema = schemas[3] as {
      name?: unknown;
      step?: Array<{ name?: unknown; text?: unknown }>;
    };
    assert.equal(
      howToSchema.name,
      catalog.exact[
        "From original file to secure delivery in four clear steps."
      ],
      `${locale}: HowTo name was not localized`,
    );
    assert.equal(
      howToSchema.step?.[0]?.name,
      catalog.exact.Register,
      `${locale}: HowTo step name was not localized`,
    );
    assert.equal(
      howToSchema.step?.[0]?.text,
      catalog.exact[
        "Create your customer account inside the MG AutoTech portal."
      ],
      `${locale}: HowTo step text was not localized`,
    );

    const localizedSchemaJson = JSON.stringify(schemas);
    for (const source of [
      "Professional online file service platform",
      "Upload original ECU/TCU files, select your service, track your order and download the completed file directly through the secure MG AutoTech customer portal.",
      "The core workshop services, without the clutter.",
      "Performance optimization for stock vehicles.",
      "What should I prepare before sending an ECU or TCU file request?",
      "Create your customer account inside the MG AutoTech portal.",
      "From original file to secure delivery in four clear steps.",
    ]) {
      assert.ok(
        !localizedSchemaJson.includes(source),
        `${locale}: JSON-LD leaked English copy: ${source}`,
      );
    }
  }
});
