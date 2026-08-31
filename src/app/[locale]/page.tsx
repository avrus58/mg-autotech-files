import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HomepageExperience } from "@/components/homepage/HomepageExperience";
import { buildPublicLogSnapshotCopy } from "@/lib/i18n/tool-client-copy";
import { buildHomepageTranslationCatalog } from "@/lib/homepageTranslationCatalog";
import { buildHomepageMetadata } from "@/lib/homepageMetadata";
import { notFoundMetadata } from "@/lib/notFoundMetadata";
import {
  getServiceSeo,
  homeSeo,
  hreflangByLocale,
  isSeoLocale,
  localizedSeoLocales,
  localizedUrl,
  organizationJsonLd,
  publicServiceSlugs,
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
      organizationJsonLd(locale),
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

  if (!isSeoLocale(rawLocale)) return notFoundMetadata;

  return buildHomepageMetadata(rawLocale as LocaleCode);
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
      <HomepageExperience
        locale={locale}
        publicLogSnapshotCopy={buildPublicLogSnapshotCopy(locale)}
        translationCatalog={buildHomepageTranslationCatalog(locale)}
        includeStructuredData={false}
      />
    </>
  );
}
