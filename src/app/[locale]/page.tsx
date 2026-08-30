import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HomepageExperience } from "@/components/homepage/HomepageExperience";
import { buildPublicLogSnapshotCopy } from "@/lib/i18n/tool-client-copy";
import { exactTranslations, termTranslations } from "@/lib/i18n";
import { getFileServiceCopy } from "@/lib/fileServiceI18n";
import { homepageHeroCopy } from "@/lib/homepageHeroI18n";
import { homepageExperienceExactTranslations } from "@/lib/homepageExperienceTranslations";
import { seoUiCopy } from "@/lib/seo-ui";
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
import { openGraphLocaleByCode, type LocaleCode } from "@/lib/i18nConfig";

const homepageHeroIntroSource =
  "Upload original ECU/TCU files, select your service, track your order and download the completed file directly through the secure MG AutoTech customer portal.";

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
      locale: openGraphLocaleByCode[locale],
      alternateLocale: seoLocales
        .filter((item) => item !== locale)
        .map((item) => openGraphLocaleByCode[item]),
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

export default async function LocalizedHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;

  if (!isSeoLocale(rawLocale)) notFound();

  const locale = rawLocale as LocaleCode;
  const jsonLd = buildLocalizedHomepageJsonLd(locale);
  const fileServiceCopy = getFileServiceCopy(locale);
  const heroCopy = homepageHeroCopy[locale];
  const uiCopy = seoUiCopy[locale];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomepageExperience
        locale={locale}
        publicLogSnapshotCopy={buildPublicLogSnapshotCopy(locale)}
        translationCatalog={{
          exact: {
            ...exactTranslations[locale],
            ...homepageExperienceExactTranslations[locale],
            [homepageHeroIntroSource]: homeSeo[locale].intro,
            "Custom ECU & TCU": heroCopy.customTitle,
            "Tuning Files": heroCopy.tuningFiles,
            "Secure Portal": heroCopy.securePortal,
            "Fast Handling": heroCopy.fastHandling,
            "Workshop Ready": heroCopy.workshopReady,
            "File Service": fileServiceCopy.nav.fileService,
            Online: uiCopy.online,
            Platform: uiCopy.platform,
            Legal: uiCopy.legal,
            Contact: uiCopy.contact,
            "Secure customer dashboard and private file workflow.":
              uiCopy.secureAccount,
            "Ready to upload a file?": uiCopy.readyTitle,
            "All rights reserved.": uiCopy.rights,
          },
          terms: termTranslations[locale],
        }}
        includeStructuredData={false}
      />
    </>
  );
}
