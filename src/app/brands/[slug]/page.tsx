import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SeoGuidePage } from "@/components/SeoGuidePage";
import { brandGuides, getBrandGuide, platformGuides } from "@/lib/industry-content";
import {
  localizeRuntimePublicJsonLd,
  runtimePublicAlternates,
  runtimePublicMetadataCopy,
  runtimePublicInLanguage,
  runtimePublicOpenGraphLocale,
} from "@/lib/i18n/runtime-public";
import { absoluteUrl, organizationJsonLd, siteName, websiteJsonLd } from "@/lib/seo";
import { getServerLocale } from "@/lib/serverLocale";

export function generateStaticParams() {
  return brandGuides.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const guide = getBrandGuide(slug);
  if (!guide) return {};
  const locale = await getServerLocale();
  const copy = runtimePublicMetadataCopy(locale, guide.name, guide.description, ["core", "vehicle"]);
  const url = absoluteUrl(`/brands/${guide.slug}`);
  return { title: copy.title, description: copy.description, alternates: runtimePublicAlternates(`/brands/${guide.slug}`), openGraph: { title: `${copy.title} | MG AutoTech`, description: copy.description, url, siteName, type: "article", locale: runtimePublicOpenGraphLocale(locale), images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: copy.title }] }, twitter: { card: "summary_large_image", title: copy.title, description: copy.description, images: ["/opengraph-image"] } };
}

export default async function BrandGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getBrandGuide(slug);
  if (!guide) notFound();
  const locale = await getServerLocale();
  const url = absoluteUrl(`/brands/${guide.slug}`);
  const jsonLd = localizeRuntimePublicJsonLd({
    "@context": "https://schema.org",
    "@graph": [
      organizationJsonLd(), websiteJsonLd(locale),
      { "@type": "WebPage", "@id": `${url}#page`, name: guide.name, description: guide.description, url, inLanguage: runtimePublicInLanguage(locale), isPartOf: { "@id": `${absoluteUrl("/")}#website` }, about: { "@type": "Thing", name: guide.name } },
      { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") }, { "@type": "ListItem", position: 2, name: "Vehicle brands", item: absoluteUrl("/brands") }, { "@type": "ListItem", position: 3, name: guide.name, item: url }] },
      { "@type": "FAQPage", mainEntity: guide.faq.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })) },
    ],
  }, locale, ["core", "vehicle"]);
  const related = [
    { label: "ECU File Service", href: "/file-service" },
    { label: "Stage 1 ECU tuning files", href: "/services/stage-1" },
    { label: "Stage 2 ECU tuning files", href: "/services/stage-2" },
    { label: "Stage 3 custom calibration", href: "/services/stage-3" },
    ...platformGuides.slice(0, 3).map((item) => ({ label: item.name, href: `/ecu-platforms/${item.slug}` })),
    ...brandGuides.filter((item) => item.slug !== guide.slug).slice(0, 3).map((item) => ({ label: item.name, href: `/brands/${item.slug}` })),
  ];
  return <SeoGuidePage locale={locale} localizationScopes={["core", "vehicle"]} eyebrow="Vehicle-specific file service" title={guide.name} description={guide.description} intro={guide.intro} sections={[{ title: "Common ECU / TCU families", items: guide.ecuFamilies }, { title: "Typical vehicle ranges", items: guide.vehicleExamples }, { title: "What to submit", items: guide.requestChecks }]} faq={guide.faq} related={related} jsonLd={jsonLd} breadcrumbs={[{ label: "Home", href: "/" }, { label: "Vehicle brands", href: "/brands" }, { label: guide.name }]} />;
}
