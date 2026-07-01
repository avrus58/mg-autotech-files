import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SeoGuidePage } from "@/components/SeoGuidePage";
import { brandGuides, getPlatformGuide, platformGuides } from "@/lib/industry-content";
import { absoluteUrl, organizationJsonLd, siteName, websiteJsonLd } from "@/lib/seo";

export function generateStaticParams() { return platformGuides.map((guide) => ({ slug: guide.slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params; const guide = getPlatformGuide(slug); if (!guide) return {};
  const url = absoluteUrl(`/ecu-platforms/${guide.slug}`);
  return { title: guide.name, description: guide.description, alternates: { canonical: url }, openGraph: { title: `${guide.name} | MG AutoTech`, description: guide.description, url, siteName, type: "article", images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: guide.name }] }, twitter: { card: "summary_large_image", title: guide.name, description: guide.description, images: ["/opengraph-image"] } };
}

export default async function PlatformGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const guide = getPlatformGuide(slug); if (!guide) notFound(); const url = absoluteUrl(`/ecu-platforms/${guide.slug}`);
  const jsonLd = { "@context": "https://schema.org", "@graph": [organizationJsonLd(), websiteJsonLd("en"), { "@type": "TechArticle", "@id": `${url}#article`, headline: guide.name, description: guide.description, url, author: { "@id": `${absoluteUrl("/")}#organization` }, publisher: { "@id": `${absoluteUrl("/")}#organization` }, inLanguage: "en" }, { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") }, { "@type": "ListItem", position: 2, name: "ECU platforms", item: absoluteUrl("/ecu-platforms") }, { "@type": "ListItem", position: 3, name: guide.name, item: url }] }, { "@type": "FAQPage", mainEntity: guide.faq.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })) }] };
  const related = [...platformGuides.filter((item) => item.slug !== guide.slug).slice(0, 3).map((item) => ({ label: item.name, href: `/ecu-platforms/${item.slug}` })), ...brandGuides.slice(0, 3).map((item) => ({ label: item.name, href: `/brands/${item.slug}` }))];
  return <SeoGuidePage eyebrow="ECU / TCU technical guide" title={guide.name} description={guide.description} intro={guide.intro} sections={[{ title: "Common applications", items: guide.commonApplications }, { title: "Identification data", items: guide.identification }, { title: "Workshop workflow notes", items: guide.workflowNotes }]} faq={guide.faq} related={related} jsonLd={jsonLd} />;
}
