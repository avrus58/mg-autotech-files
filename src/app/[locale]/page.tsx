import type { Metadata } from "next";
import { notFound } from "next/navigation";
import HomePage from "../page";
import {
  homeSeo,
  hreflangByLocale,
  isSeoLocale,
  languageAlternates,
  localizedUrl,
  organizationJsonLd,
  seoLocales,
  siteName,
  websiteJsonLd,
} from "@/lib/seo";
import type { LocaleCode } from "@/lib/i18n";

export function generateStaticParams() {
  return seoLocales.map((locale) => ({ locale }));
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
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [organizationJsonLd(), websiteJsonLd(locale)],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomePage />
    </>
  );
}
