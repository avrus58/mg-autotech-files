import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Cpu } from "lucide-react";
import { Footer } from "@/components/Footer";
import { PublicSeoHeader } from "@/components/PublicSeoHeader";
import { platformGuides } from "@/lib/industry-content";
import { absoluteUrl, organizationJsonLd, siteName, websiteJsonLd } from "@/lib/seo";

const title = "ECU & TCU Platform File-Service Guides";
const description = "Technical workshop guides for Bosch EDC17, MD1, MG1, Continental SIMOS and SID, Delphi DCM, Denso and transmission controllers.";

export const metadata: Metadata = {
  title, description, alternates: { canonical: absoluteUrl("/ecu-platforms") },
  openGraph: { title: `${title} | MG AutoTech`, description, url: absoluteUrl("/ecu-platforms"), siteName, type: "website", images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: title }] },
  twitter: { card: "summary_large_image", title, description, images: ["/opengraph-image"] },
};

export default function EcuPlatformsPage() {
  const jsonLd = { "@context": "https://schema.org", "@graph": [organizationJsonLd(), websiteJsonLd("en"), { "@type": "CollectionPage", "@id": `${absoluteUrl("/ecu-platforms")}#page`, name: title, description, url: absoluteUrl("/ecu-platforms") }, { "@type": "ItemList", itemListElement: platformGuides.map((guide, index) => ({ "@type": "ListItem", position: index + 1, name: guide.name, url: absoluteUrl(`/ecu-platforms/${guide.slug}`) })) }] };
  return (
    <main data-no-translate className="min-h-screen bg-[#050505] text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PublicSeoHeader />
      <section className="border-b border-white/10 bg-[radial-gradient(circle_at_80%_10%,rgba(177,18,27,0.23),transparent_30%),#050505]"><div className="mx-auto max-w-7xl px-4 py-16 lg:py-24"><p className="inline-flex items-center gap-2 rounded-full border border-red-800/50 bg-red-950/20 px-4 py-2 text-sm font-black text-red-100"><BadgeCheck className="h-4 w-4 text-red-500" />Technical knowledge base</p><h1 className="mt-7 max-w-5xl text-[clamp(2.7rem,8vw,5.2rem)] font-black leading-[0.96]">{title}</h1><p className="mt-7 max-w-3xl text-lg leading-8 text-zinc-300">{description} Each guide explains what must be identified before a file request is accepted.</p></div></section>
      <section className="bg-[#08090b]"><div className="mx-auto max-w-7xl px-4 py-16 lg:py-20"><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">{platformGuides.map((guide) => <article key={guide.slug} className="flex min-h-72 flex-col border border-white/10 bg-[#0d0e10] p-6"><Cpu className="h-6 w-6 text-red-500" /><h2 className="mt-6 text-2xl font-black">{guide.name}</h2><p className="mt-4 line-clamp-4 text-sm leading-7 text-zinc-400">{guide.description}</p><Link href={`/ecu-platforms/${guide.slug}`} className="mt-auto inline-flex items-center pt-6 text-sm font-black text-red-400 hover:text-red-300">Open platform guide<ArrowRight className="ml-2 h-4 w-4" /></Link></article>)}</div></div></section>
      <Footer />
    </main>
  );
}
