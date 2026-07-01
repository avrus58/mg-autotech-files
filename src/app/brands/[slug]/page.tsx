import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SeoGuidePage } from "@/components/SeoGuidePage";
import { brandGuides, getBrandGuide, platformGuides } from "@/lib/industry-content";
import { absoluteUrl, organizationJsonLd, siteName, websiteJsonLd } from "@/lib/seo";

export function generateStaticParams() {
  return brandGuides.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const guide = getBrandGuide(slug);
  if (!guide) return {};
  const url = absoluteUrl(`/brands/${guide.slug}`);
  return { title: guide.name, description: guide.description, alternates: { canonical: url }, openGraph: { title: `${guide.name} | MG AutoTech`, description: guide.description, url, siteName, type: "article", images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: guide.name }] }, twitter: { card: "summary_large_image", title: guide.name, description: guide.description, images: ["/opengraph-image"] } };
}

export default async function BrandGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getBrandGuide(slug);
  if (!guide) notFound();
  const url = absoluteUrl(`/brands/${guide.slug}`);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      organizationJsonLd(), websiteJsonLd("en"),
      { "@type": "WebPage", "@id": `${url}#page`, name: guide.name, description: guide.description, url, isPartOf: { "@id": `${absoluteUrl("/")}#website` }, about: { "@type": "Thing", name: guide.name } },
      { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") }, { "@type": "ListItem", position: 2, name: "Vehicle brands", item: absoluteUrl("/brands") }, { "@type": "ListItem", position: 3, name: guide.name, item: url }] },
      { "@type": "FAQPage", mainEntity: guide.faq.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })) },
    ],
  };
  const related = [
    ...platformGuides.slice(0, 3).map((item) => ({ label: item.name, href: `/ecu-platforms/${item.slug}` })),
    ...brandGuides.filter((item) => item.slug !== guide.slug).slice(0, 3).map((item) => ({ label: item.name, href: `/brands/${item.slug}` })),
  ];
  return <SeoGuidePage eyebrow="Vehicle-specific file service" title={guide.name} description={guide.description} intro={guide.intro} sections={[{ title: "Common ECU / TCU families", items: guide.ecuFamilies }, { title: "Typical vehicle ranges", items: guide.vehicleExamples }, { title: "What to submit", items: guide.requestChecks }]} faq={guide.faq} related={related} jsonLd={jsonLd} />;
}
