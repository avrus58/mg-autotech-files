import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HowItWorksPageContent } from "@/components/HowItWorksPageContent";
import { getHowItWorksCopy, howItWorksJsonLd } from "@/lib/howItWorksI18n";
import type { LocaleCode } from "@/lib/i18nConfig";
import {
  hreflangByLocale,
  isSeoLocale,
  languageAlternates,
  localizedUrl,
  organizationJsonLd,
  seoLocales,
  siteName,
  websiteJsonLd,
} from "@/lib/seo";

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
  const copy = getHowItWorksCopy(locale);
  const pageUrl = localizedUrl(locale, "/how-it-works");

  return {
    title: { absolute: copy.pageTitle },
    description: copy.description,
    alternates: {
      canonical: pageUrl,
      languages: languageAlternates("/how-it-works"),
    },
    openGraph: {
      title: copy.pageTitle,
      description: copy.description,
      url: pageUrl,
      siteName,
      locale: hreflangByLocale[locale],
      alternateLocale: seoLocales
        .filter((item) => item !== locale)
        .map((item) => hreflangByLocale[item]),
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: copy.pageTitle,
      description: copy.description,
    },
  };
}

export default async function LocalizedHowItWorksPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;

  if (!isSeoLocale(rawLocale)) notFound();

  const locale = rawLocale as LocaleCode;
  const copy = getHowItWorksCopy(locale);
  const pageUrl = localizedUrl(locale, "/how-it-works");
  const pageJsonLd = howItWorksJsonLd(locale, pageUrl);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      organizationJsonLd(),
      websiteJsonLd(locale),
      {
        ...pageJsonLd.page,
        isPartOf: { "@id": `${localizedUrl(locale, "/")}#website` },
        about: { "@id": `${localizedUrl(locale, "/")}#organization` },
      },
      pageJsonLd.faq,
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <HowItWorksPageContent copy={copy} locale={locale} localized />
    </>
  );
}
