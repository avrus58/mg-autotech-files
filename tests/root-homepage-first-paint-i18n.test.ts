import assert from "node:assert/strict";
import test from "node:test";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AppRouterContext,
  type AppRouterInstance,
} from "next/dist/shared/lib/app-router-context.shared-runtime.js";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime.js";
import LocalizedHomePage from "../src/app/[locale]/page";
import { buildHomepageTranslationCatalog } from "../src/lib/homepageTranslationCatalog";
import {
  intlLocaleByCode,
  supportedLocales,
} from "../src/lib/i18nConfig";
import { renderRootHomepage } from "../src/lib/renderRootHomepage";
import {
  buildNeutralSiteIdentityJsonLd,
  buildSiteIdentityJsonLd,
  getServiceSeo,
  homeSeo,
  hreflangByLocale,
  publicServiceSlugs,
  serviceJsonLd,
} from "../src/lib/seo";
import {
  businessAudienceTypeByLocale,
  organizationAreaServedJsonLd,
} from "../src/lib/structuredDataI18n";
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

function assertLocalizedOrganizationSchema(
  schema: Record<string, unknown>,
  locale: Exclude<(typeof supportedLocales)[number]["code"], "en">,
) {
  assert.deepEqual(schema["@type"], ["Organization", "AutomotiveBusiness"]);
  assert.equal(schema.description, homeSeo[locale].description);

  const contactPoint = schema.contactPoint as Array<Record<string, unknown>>;
  assert.equal(contactPoint.length, 1);
  assert.equal(typeof contactPoint[0].contactType, "string");
  assert.notEqual(contactPoint[0].contactType, "Customer support");
  assert.deepEqual(contactPoint[0].areaServed, ["DE", "EU"]);

  assert.deepEqual(schema.areaServed, [
    { "@type": "Country", identifier: "DE" },
    { "@type": "AdministrativeArea", identifier: "EU" },
    {
      "@type": "Place",
      identifier: {
        "@type": "PropertyValue",
        propertyID: "UN M49",
        value: "150",
      },
    },
  ]);

  const knowsAbout = schema.knowsAbout as Array<Record<string, unknown>>;
  assert.ok(knowsAbout.length > 0);
  assert.ok(
    knowsAbout.every(
      (item) =>
        item["@type"] === "DefinedTerm" &&
        typeof item.termCode === "string" &&
        !Object.hasOwn(item, "name"),
    ),
    `${locale}: organization expertise must use language-neutral term codes`,
  );

  const serialized = JSON.stringify(schema);
  for (const source of [
    "Professional ECU and TCU file service platform for workshops and automotive tuning partners.",
    "customer support",
    "Customer support",
    '"Germany"',
    '"European Union"',
    '"Europe"',
  ]) {
    assert.ok(
      !serialized.includes(source),
      `${locale}: organization JSON-LD leaked English copy: ${source}`,
    );
  }
}

test("static root identity is language-neutral so localized routes remain prerenderable", () => {
  const schema = buildNeutralSiteIdentityJsonLd();
  const graph = schema["@graph"] as Array<Record<string, unknown>>;
  const organization = graph[0];
  const website = graph[1];

  assert.equal(Array.isArray(organization["@type"]), true);
  assert.equal(Object.hasOwn(organization, "description"), false);
  assert.equal(Object.hasOwn(website, "inLanguage"), false);
  const contactPoints = organization.contactPoint as Array<Record<string, unknown>>;
  assert.equal(Object.hasOwn(contactPoints[0], "contactType"), false);
});

test("canonical homepage first paint follows the server-resolved locale", async () => {
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
    assert.equal(schemas.length, 5, `${locale}: expected identity plus four page JSON-LD blocks`);
    const identityGraph = schemas[0]["@graph"] as Array<Record<string, unknown>>;
    assert.equal(identityGraph.length, 2, `${locale}: incomplete site identity graph`);
    assertLocalizedOrganizationSchema(identityGraph[0], locale);
    assert.equal(identityGraph[1].inLanguage, hreflangByLocale[locale]);
    const homepageSchemas = schemas.slice(1);
    assert.deepEqual(
      homepageSchemas.map((schema) => schema["@type"]),
      ["WebPage", "Service", "FAQPage", "HowTo"],
      `${locale}: unexpected homepage JSON-LD types`,
    );

    for (const schema of homepageSchemas) {
      assert.equal(
        schema.inLanguage,
        intlLocaleByCode[locale],
        `${locale}: ${String(schema["@type"])} schema language mismatch`,
      );
    }

    const pageSchema = homepageSchemas[0];
    assert.equal(
      pageSchema.name,
      catalog.exact["MG AutoTech ECU & TCU File Service"],
      `${locale}: WebPage name was not localized from its canonical source`,
    );
    assert.equal(
      pageSchema.description,
      catalog.exact[
        "Secure online ECU and TCU file service with vehicle data, workshop tools, credit pricing and private order delivery."
      ],
      `${locale}: WebPage description was not localized from its canonical source`,
    );

    const serviceSchema = homepageSchemas[1] as {
      name?: unknown;
      areaServed?: unknown;
      hasOfferCatalog?: {
        name?: unknown;
        itemListElement?: Array<{
          itemOffered?: { description?: unknown };
        }>;
      };
    };
    assert.equal(
      serviceSchema.name,
      catalog.exact["MG AutoTech ECU and TCU file service"],
      `${locale}: Service name was not localized`,
    );
    assert.deepEqual(serviceSchema.areaServed, {
      "@type": "Place",
      identifier: {
        "@type": "PropertyValue",
        propertyID: "UN M49",
        value: "150",
      },
    });
    assert.equal(
      serviceSchema.hasOfferCatalog?.name,
      catalog.exact["Visible file service categories"],
      `${locale}: offer catalog name was not localized`,
    );
    assert.equal(
      serviceSchema.hasOfferCatalog?.itemListElement?.[0]?.itemOffered
        ?.description,
      catalog.exact["Performance optimization for stock vehicles."],
      `${locale}: service description was not localized`,
    );

    const faqSchema = homepageSchemas[2] as {
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

    const howToSchema = homepageSchemas[3] as {
      name?: unknown;
      step?: Array<{ name?: unknown; text?: unknown }>;
    };
    assert.equal(
      howToSchema.name,
      catalog.exact["How to use the MG AutoTech file service"],
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

    const localizedSchemaJson = JSON.stringify(homepageSchemas);
    for (const source of [
      "MG AutoTech ECU & TCU File Service",
      "Secure online ECU and TCU file service with vehicle data, workshop tools, credit pricing and private order delivery.",
      "MG AutoTech ECU and TCU file service",
      "Visible file service categories",
      "How to use the MG AutoTech file service",
      "Professional online file service platform",
      "Upload original ECU/TCU files, select your service, track your order and download the completed file directly through the secure MG AutoTech customer portal.",
      "The core workshop services, without the clutter.",
      "Performance optimization for stock vehicles.",
      "What should I prepare before sending an ECU or TCU file request?",
      "Create your customer account inside the MG AutoTech portal.",
      "From original file to secure delivery in four clear steps.",
      "Technical software solution for diesel vehicles.",
      "EGR related software solution and DTC support.",
      "SCR / AdBlue software solution for supported ECUs.",
      "Diagnostic trouble code removal by request.",
      "Gearbox software optimization for supported TCUs.",
      "Do the public preparation tools upload or modify my ECU file?",
      "No. A file-based public check reads only the compatible text datalog you explicitly choose and processes it locally in this browser. Original-file submission starts only inside the authenticated request flow.",
      "How is a completed file delivered?",
      "Completed files are delivered through the private customer dashboard. Customers can track the request status, see customer-visible messages and download delivered files only from their own account.",
      "Can I create a request if my vehicle is not in the public selector?",
      "Yes. If the exact vehicle or engine is not available in the selector, customers can use the manual vehicle request path and provide the missing technical details for review.",
      "Buy credits and use them for file service requests.",
      "Upload original ECU/TCU file and vehicle information.",
      "Track the status and download the completed file.",
      '"Europe"',
    ]) {
      assert.ok(
        !localizedSchemaJson.includes(source),
        `${locale}: JSON-LD leaked English copy: ${source}`,
      );
    }

    const layoutJsonLd = buildSiteIdentityJsonLd(locale);
    const layoutGraph = layoutJsonLd["@graph"] as Array<Record<string, unknown>>;
    assert.equal(layoutGraph.length, 2);
    assertLocalizedOrganizationSchema(layoutGraph[0], locale);
    assert.equal(layoutGraph[1]["@type"], "WebSite");
    assert.equal(layoutGraph[1].inLanguage, hreflangByLocale[locale]);

    const localizedPage = await LocalizedHomePage({
      params: Promise.resolve({ locale }),
    });
    const localizedHtml = renderToStaticMarkup(
      createElement(
        AppRouterContext.Provider,
        { value: router },
        createElement(
          PathnameContext.Provider,
          { value: `/${locale}` },
          createElement(
            ActiveLocaleProvider,
            {
              initialLocale: locale,
            } as ComponentProps<typeof ActiveLocaleProvider>,
            localizedPage,
          ),
        ),
      ),
    );
    const localizedSchemas = parseJsonLdBlocks(localizedHtml);
    assert.equal(
      localizedSchemas.length,
      1,
      `${locale}: localized route must emit one page JSON-LD graph`,
    );
    const localizedGraph = localizedSchemas[0]["@graph"] as Array<
      Record<string, unknown>
    >;
    assert.equal(localizedGraph.length, 4);
    assertLocalizedOrganizationSchema(localizedGraph[0], locale);
    assert.equal(localizedGraph[1]["@type"], "WebSite");
    assert.equal(localizedGraph[1].inLanguage, hreflangByLocale[locale]);
    assert.equal(localizedGraph[2]["@type"], "WebPage");
    assert.equal(localizedGraph[2].name, homeSeo[locale].title);
    assert.equal(localizedGraph[2].description, homeSeo[locale].description);
    assert.equal(localizedGraph[2].inLanguage, hreflangByLocale[locale]);

    const serviceList = localizedGraph[3] as {
      "@type"?: unknown;
      name?: unknown;
      itemListElement?: Array<{
        item?: { name?: unknown; description?: unknown };
      }>;
    };
    assert.equal(serviceList["@type"], "ItemList");
    assert.equal(serviceList.name, homeSeo[locale].servicesTitle);
    assert.equal(serviceList.itemListElement?.length, publicServiceSlugs.length);
    publicServiceSlugs.forEach((slug, index) => {
      const expected = getServiceSeo(slug, locale);
      assert.equal(serviceList.itemListElement?.[index]?.item?.name, expected.name);
      assert.equal(
        serviceList.itemListElement?.[index]?.item?.description,
        expected.description,
      );

      const serviceSchema = serviceJsonLd(slug, locale);
      assert.equal(serviceSchema.name, expected.name);
      assert.equal(serviceSchema.description, expected.description);
      assert.equal(serviceSchema.serviceType, expected.name);
      assert.equal(serviceSchema.category, expected.name);
      assert.equal(serviceSchema.inLanguage, hreflangByLocale[locale]);
      assert.equal(
        serviceSchema.audience.audienceType,
        businessAudienceTypeByLocale[locale],
      );
      assert.deepEqual(serviceSchema.areaServed, organizationAreaServedJsonLd);

      const serializedService = JSON.stringify(serviceSchema);
      for (const source of [
        "Automotive ECU and TCU file service",
        "Automotive workshops and tuning professionals",
        '"Germany"',
        '"Europe"',
      ]) {
        assert.ok(
          !serializedService.includes(source),
          `${locale}/${slug}: Service JSON-LD leaked English copy: ${source}`,
        );
      }
    });

    const fullLocalizedJson = JSON.stringify({
      layout: layoutJsonLd,
      page: localizedSchemas[0],
    });
    for (const source of [
      "Professional ECU and TCU file service platform for workshops and automotive tuning partners.",
      "customer support",
      "Customer support",
      '"Germany"',
      '"European Union"',
      '"Europe"',
    ]) {
      assert.ok(
        !fullLocalizedJson.includes(source),
        `${locale}: full localized graph leaked English copy: ${source}`,
      );
    }
  }
});
