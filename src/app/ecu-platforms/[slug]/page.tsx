import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SeoGuidePage } from "@/components/SeoGuidePage";
import { brandGuides, getPlatformGuide, platformGuides } from "@/lib/industry-content";
import {
  localizeRuntimePublicJsonLd,
  runtimePublicAlternates,
  runtimePublicMetadataCopy,
  runtimePublicInLanguage,
  runtimePublicOpenGraphLocale,
} from "@/lib/i18n/runtime-public";
import { buildNewRequestPath } from "@/lib/requestIntent";
import { absoluteUrl, organizationJsonLd, siteName, websiteJsonLd } from "@/lib/seo";
import { getServerLocale } from "@/lib/serverLocale";

export function generateStaticParams() { return platformGuides.map((guide) => ({ slug: guide.slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params; const guide = getPlatformGuide(slug); if (!guide) return {};
  const locale = await getServerLocale();
  const copy = runtimePublicMetadataCopy(locale, guide.name, guide.description, ["core", "vehicle"]);
  const url = absoluteUrl(`/ecu-platforms/${guide.slug}`);
  return { title: copy.title, description: copy.description, alternates: runtimePublicAlternates(`/ecu-platforms/${guide.slug}`), openGraph: { title: `${copy.title} | MG AutoTech`, description: copy.description, url, siteName, type: "article", locale: runtimePublicOpenGraphLocale(locale), images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: copy.title }] }, twitter: { card: "summary_large_image", title: copy.title, description: copy.description, images: ["/opengraph-image"] } };
}

export default async function PlatformGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const guide = getPlatformGuide(slug); if (!guide) notFound(); const locale = await getServerLocale(); const url = absoluteUrl(`/ecu-platforms/${guide.slug}`);
  const jsonLd = localizeRuntimePublicJsonLd({ "@context": "https://schema.org", "@graph": [organizationJsonLd(locale), websiteJsonLd(locale), { "@type": "TechArticle", "@id": `${url}#article`, headline: guide.name, description: guide.description, url, author: { "@id": `${absoluteUrl("/")}#organization` }, publisher: { "@id": `${absoluteUrl("/")}#organization` }, inLanguage: runtimePublicInLanguage(locale) }, { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") }, { "@type": "ListItem", position: 2, name: "ECU platforms", item: absoluteUrl("/ecu-platforms") }, { "@type": "ListItem", position: 3, name: guide.name, item: url }] }, { "@type": "FAQPage", mainEntity: guide.faq.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })) }] }, locale, ["core", "vehicle"]);
  const related = [
    { label: "Stage 1 ECU tuning file service", href: "/services/stage-1" },
    ...platformGuides
      .filter((item) => item.slug !== guide.slug)
      .slice(0, 3)
      .map((item) => ({ label: item.name, href: `/ecu-platforms/${item.slug}` })),
    ...brandGuides
      .slice(0, 3)
      .map((item) => ({ label: item.name, href: `/brands/${item.slug}` })),
  ];
  return <SeoGuidePage locale={locale} localizationScopes={["core", "vehicle"]} eyebrow="ECU / TCU technical guide" title={guide.name} description={guide.description} intro={guide.intro} sections={[{ title: "Common applications", items: guide.commonApplications }, { title: "Identification data", items: guide.identification }, { title: "Workshop workflow notes", items: guide.workflowNotes }]} faq={guide.faq} related={related} jsonLd={jsonLd} requestHref={guide.slug === "transmission-control-units" ? buildNewRequestPath("tcu_stage_1") : undefined} />;
}
