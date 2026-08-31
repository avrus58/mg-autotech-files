import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SeoGuidePage } from "@/components/SeoGuidePage";
import {
  localizeRuntimePublicJsonLd,
  runtimePublicAlternates,
  runtimePublicInLanguage,
  runtimePublicMetadataCopy,
  runtimePublicOpenGraphLocale,
  runtimePublicT,
} from "@/lib/i18n/runtime-public";
import {
  absoluteUrl,
  organizationJsonLd,
  siteName,
  websiteJsonLd,
} from "@/lib/seo";
import {
  getWorkshopGuideArticle,
  workshopGuideArticles,
} from "@/lib/workshopGuides";
import { getServerLocale } from "@/lib/serverLocale";
import { relatedWorkshopResourcesName } from "@/lib/structuredDataI18n";

export function generateStaticParams() {
  return workshopGuideArticles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getWorkshopGuideArticle(slug);

  if (!article) return {};

  const locale = await getServerLocale();
  const copy = runtimePublicMetadataCopy(locale, article.title, article.description, ["core", "workshop-guides"]);
  const url = absoluteUrl(`/workshop-guides/${article.slug}`);

  return {
    title: copy.title,
    description: copy.description,
    alternates: runtimePublicAlternates(`/workshop-guides/${article.slug}`),
    openGraph: {
      title: `${copy.title} | MG AutoTech`,
      description: copy.description,
      url,
      siteName,
      type: "article",
      locale: runtimePublicOpenGraphLocale(locale),
      publishedTime: article.updatedAt,
      modifiedTime: article.updatedAt,
      images: [
        {
          url: absoluteUrl("/opengraph-image"),
          width: 1200,
          height: 630,
          alt: copy.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${copy.title} | MG AutoTech`,
      description: copy.description,
      images: [absoluteUrl("/opengraph-image")],
    },
  };
}

export default async function WorkshopGuideArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getWorkshopGuideArticle(slug);

  if (!article) notFound();

  const locale = await getServerLocale();
  const url = absoluteUrl(`/workshop-guides/${article.slug}`);
  const localizedShortTitle = runtimePublicT(
    locale,
    article.shortTitle,
    ["core", "workshop-guides"]
  );
  const jsonLd = localizeRuntimePublicJsonLd({
    "@context": "https://schema.org",
    "@graph": [
      organizationJsonLd(locale),
      websiteJsonLd(locale),
      {
        "@type": "TechArticle",
        "@id": `${url}#article`,
        headline: article.title,
        description: article.description,
        url,
        mainEntityOfPage: url,
        inLanguage: runtimePublicInLanguage(locale),
        datePublished: article.updatedAt,
        dateModified: article.updatedAt,
        author: { "@id": `${absoluteUrl("/")}#organization` },
        publisher: { "@id": `${absoluteUrl("/")}#organization` },
        isPartOf: {
          "@type": "CollectionPage",
          "@id": `${absoluteUrl("/workshop-guides")}#collection`,
          url: absoluteUrl("/workshop-guides"),
          name: "MG AutoTech Workshop Knowledge Center",
        },
        about: article.intentLabel,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: absoluteUrl("/"),
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Workshop Guides",
            item: absoluteUrl("/workshop-guides"),
          },
          {
            "@type": "ListItem",
            position: 3,
            name: article.shortTitle,
            item: url,
          },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: article.faq.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      },
      {
        "@type": "ItemList",
        name: relatedWorkshopResourcesName(locale, localizedShortTitle),
        itemListElement: article.related.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.label,
          url: absoluteUrl(item.href),
        })),
      },
    ],
  }, locale, ["core", "workshop-guides"]);

  return (
    <SeoGuidePage
      locale={locale}
      localizationScopes={["core", "workshop-guides"]}
      eyebrow={article.eyebrow}
      title={article.title}
      description={article.description}
      intro={article.intro}
      sections={article.sections}
      faq={article.faq}
      related={article.related}
      jsonLd={jsonLd}
    />
  );
}
