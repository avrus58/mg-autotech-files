import type { Metadata } from "next";
import { WidgetSalesPageClient } from "@/components/widget/WidgetSalesPageClient";
import { getWidgetSettings } from "@/lib/widget/settings";
import { normalizeWidgetLanguage } from "@/lib/i18n/widget-translations";
import { absoluteUrl, organizationJsonLd, siteName, websiteJsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vehicle Selector Widget for Automotive Websites",
  description: "Embed a hosted, multilingual vehicle selector on your tuning or workshop website for €4.99 / month.",
  alternates: { canonical: absoluteUrl("/widget") },
  openGraph: {
    title: "Vehicle Selector Widget for Automotive Websites | MG AutoTech",
    description: "A hosted multilingual vehicle selector for tuning and workshop websites, available for €4.99 / month.",
    url: absoluteUrl("/widget"),
    siteName,
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "MG AutoTech Vehicle Selector Widget" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vehicle Selector Widget | MG AutoTech",
    description: "Hosted multilingual vehicle lookup for automotive websites.",
    images: ["/opengraph-image"],
  },
};

export default async function WidgetSalesPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const params = await searchParams;
  const result = await getWidgetSettings();
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      organizationJsonLd(),
      websiteJsonLd("en"),
      {
        "@type": "WebApplication",
        "@id": `${absoluteUrl("/widget")}#application`,
        name: "MG AutoTech Vehicle Selector Widget",
        description: "Hosted multilingual vehicle selector for automotive tuning and workshop websites.",
        url: absoluteUrl("/widget"),
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
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <WidgetSalesPageClient initialSettings={result.settings} databaseReady={result.databaseReady} initialLanguage={normalizeWidgetLanguage(params.lang, "en")} />
    </>
  );
}
