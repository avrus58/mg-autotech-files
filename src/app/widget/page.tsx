import type { Metadata } from "next";
import { WidgetSalesPageClient } from "@/components/widget/WidgetSalesPageClient";
import { getWidgetSettings } from "@/lib/widget/settings";
import { normalizeWidgetLanguage } from "@/lib/i18n/widget-translations";
import { widgetSiteT } from "@/lib/i18n/widget-site-translations";
import {
  localizeRuntimePublicJsonLd,
  runtimePublicAlternates,
  runtimePublicInLanguage,
  runtimePublicOpenGraphLocale,
} from "@/lib/i18n/runtime-public";
import { absoluteUrl, organizationJsonLd, siteName, websiteJsonLd } from "@/lib/seo";
import { getServerLocale } from "@/lib/serverLocale";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  return {
    title: widgetSiteT(locale, "widgetMetaTitle"),
    description: widgetSiteT(locale, "widgetMetaEmbed"),
    alternates: runtimePublicAlternates("/widget"),
    openGraph: {
      title: widgetSiteT(locale, "widgetMetaTitleBrand"),
      description: widgetSiteT(locale, "widgetMetaOffer"),
      url: absoluteUrl("/widget"),
      siteName,
      type: "website",
      locale: runtimePublicOpenGraphLocale(locale),
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: widgetSiteT(locale, "vehicleSelectorFooter") }],
    },
    twitter: {
      card: "summary_large_image",
      title: widgetSiteT(locale, "widgetMetaTitleShort"),
      description: widgetSiteT(locale, "widgetMetaLookup"),
      images: ["/opengraph-image"],
    },
  };
}

export default async function WidgetSalesPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const locale = await getServerLocale();
  const params = await searchParams;
  const result = await getWidgetSettings();
  const jsonLd = localizeRuntimePublicJsonLd({
    "@context": "https://schema.org",
    "@graph": [
      organizationJsonLd(),
      websiteJsonLd(locale),
      {
        "@type": "WebApplication",
        "@id": `${absoluteUrl("/widget")}#application`,
        name: "MG AutoTech Vehicle Selector Widget",
        description: "Hosted multilingual vehicle selector for automotive tuning and workshop websites.",
        url: absoluteUrl("/widget"),
        inLanguage: runtimePublicInLanguage(locale),
        applicationCategory: "BusinessApplication",
        operatingSystem: "Any",
        browserRequirements: "Modern browser with JavaScript and iframe support",
        provider: { "@id": `${absoluteUrl("/")}#organization` },
        offers: {
          "@type": "Offer",
          price: "4.99",
          priceCurrency: "EUR",
          availability: "https://schema.org/InStock",
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            price: "4.99",
            priceCurrency: "EUR",
            billingDuration: "P1M",
          },
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: "Vehicle Selector Widget", item: absoluteUrl("/widget") },
        ],
      },
    ],
  }, locale, ["core", "widget"]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <WidgetSalesPageClient
        initialSettings={result.settings}
        databaseReady={result.databaseReady}
        initialLanguage={normalizeWidgetLanguage(
          params.lang,
          normalizeWidgetLanguage(locale, "en")
        )}
      />
    </>
  );
}
