import type { Metadata } from "next";
import type { LocaleCode } from "@/lib/i18nConfig";
import { openGraphLocaleByCode } from "@/lib/i18nConfig";
import {
  getServiceSeo,
  homeSeo,
  languageAlternates,
  localizedUrl,
  publicServiceSlugs,
  seoLocales,
  siteName,
} from "@/lib/seo";
import { buildPublicMetadataKeywords } from "@/lib/structuredDataI18n";

export function buildHomepageMetadata(locale: LocaleCode): Metadata {
  const copy = homeSeo[locale];
  const canonical = localizedUrl(locale, "/");

  return {
    title: copy.title,
    description: copy.description,
    keywords: buildPublicMetadataKeywords(
      copy.title,
      publicServiceSlugs.map((slug) => getServiceSeo(slug, locale).name),
    ),
    alternates: {
      canonical,
      languages: languageAlternates("/"),
    },
    openGraph: {
      title: `${copy.title} | MG AutoTech`,
      description: copy.description,
      url: canonical,
      siteName,
      locale: openGraphLocaleByCode[locale],
      alternateLocale: seoLocales
        .filter((candidate) => candidate !== locale)
        .map((candidate) => openGraphLocaleByCode[candidate]),
      type: "website",
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: copy.title,
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
