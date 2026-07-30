import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SeoGuidePage } from "@/components/SeoGuidePage";
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

  const url = absoluteUrl(`/workshop-guides/${article.slug}`);

  return {
    title: article.title,
    description: article.description,
    alternates: { canonical: url },
    openGraph: {
      title: `${article.title} | MG AutoTech`,
      description: article.description,
      url,
      siteName,
      type: "article",
      publishedTime: article.updatedAt,
      modifiedTime: article.updatedAt,
      images: [
        {
          url: absoluteUrl("/opengraph-image"),
          width: 1200,
          height: 630,
          alt: article.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${article.title} | MG AutoTech`,
      description: article.description,
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

  const url = absoluteUrl(`/workshop-guides/${article.slug}`);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      organizationJsonLd(),
      websiteJsonLd("en"),
      {
        "@type": "TechArticle",
        "@id": `${url}#article`,
        headline: article.title,
        description: article.description,
        url,
        mainEntityOfPage: url,
        inLanguage: "en",
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
        name: `${article.shortTitle} related workshop resources`,
        itemListElement: article.related.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.label,
          url: absoluteUrl(item.href),
        })),
      },
    ],
  };

  return (
    <SeoGuidePage
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
