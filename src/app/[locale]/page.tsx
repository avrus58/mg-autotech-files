import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LocalizedSeoHome } from "@/components/LocalizedSeoHome";
import {
  getServiceSeo,
  homeSeo,
  hreflangByLocale,
  isSeoLocale,
  languageAlternates,
  localizedSeoLocales,
  localizedUrl,
  organizationJsonLd,
  publicServiceSlugs,
  seoLocales,
  siteName,
  siteUrl,
  websiteJsonLd,
} from "@/lib/seo";
import type { LocaleCode } from "@/lib/i18nConfig";

export function generateStaticParams() {
  return localizedSeoLocales.map((locale) => ({ locale }));
}

function buildLocalizedHomepageJsonLd(locale: LocaleCode) {
  const copy = homeSeo[locale];
  const pageUrl = localizedUrl(locale, "/");

  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationJsonLd(),
      websiteJsonLd(locale),
      {
        "@type": "WebPage",
        "@id": `${pageUrl}#page`,
        name: copy.title,
        description: copy.description,
        url: pageUrl,
        inLanguage: hreflangByLocale[locale],
        isPartOf: { "@id": `${siteUrl}/#website` },
        about: { "@id": `${siteUrl}/#organization` },
        primaryImageOfPage: {
          "@type": "ImageObject",
          url: `${siteUrl}/opengraph-image`,
        },
        hasPart: { "@id": `${pageUrl}#service-list` },
      },
      {
        "@type": "ItemList",
        "@id": `${pageUrl}#service-list`,
        name: copy.servicesTitle,
        itemListElement: publicServiceSlugs.map((slug, index) => {
          const service = getServiceSeo(slug, locale);

          return {
            "@type": "ListItem",
            position: index + 1,
            item: {
              "@type": "WebPage",
              name: service.name,
              description: service.description,
              url: localizedUrl(locale, `/services/${slug}`),
            },
          };
        }),
      },
    ],
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;

  if (!isSeoLocale(rawLocale)) return {};

  const locale = rawLocale as LocaleCode;
  const copy = homeSeo[locale];

  return {
    title: copy.title,
    description: copy.description,
    alternates: {
      canonical: localizedUrl(locale, "/"),
      languages: languageAlternates("/"),
    },
    openGraph: {
      title: `${copy.title} | MG AutoTech`,
      description: copy.description,
      url: localizedUrl(locale, "/"),
      siteName,
      locale: hreflangByLocale[locale],
      alternateLocale: seoLocales
        .filter((item) => item !== locale)
        .map((item) => hreflangByLocale[item]),
      type: "website",
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: "MG AutoTech ECU and TCU File Service",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: copy.title,
      description: copy.description,
      images: ["/opengraph-image"],
    },
  };
}

export default async function LocalizedHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;

  if (!isSeoLocale(rawLocale)) notFound();

  const locale = rawLocale as LocaleCode;
  const jsonLd = buildLocalizedHomepageJsonLd(locale);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LocalizedSeoHome locale={locale} />
    </>
  );
}
