import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, CarFront } from "lucide-react";
import { PublicSeoHeader } from "@/components/PublicSeoHeader";
import { RuntimePublicLocalization } from "@/components/RuntimePublicLocalization";
import { RuntimePublicFooter } from "@/components/RuntimePublicFooter";
import { brandGuides } from "@/lib/industry-content";
import {
  localizeRuntimePublicJsonLd,
  runtimePublicAlternates,
  runtimePublicMetadataCopy,
  runtimePublicInLanguage,
  runtimePublicOpenGraphLocale,
} from "@/lib/i18n/runtime-public";
import { absoluteUrl, organizationJsonLd, siteName, websiteJsonLd } from "@/lib/seo";
import { getServerLocale } from "@/lib/serverLocale";

const title = "Vehicle ECU & TCU File Service by Brand";
const description = "Technical ECU and TCU file-service guides for BMW, Mercedes-Benz, Audi, Volkswagen, Porsche, Opel, Renault and Peugeot workshop requests.";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const copy = runtimePublicMetadataCopy(locale, title, description, ["core", "vehicle"]);
  return {
    title: copy.title,
    description: copy.description,
    alternates: runtimePublicAlternates("/brands"),
    openGraph: { title: `${copy.title} | MG AutoTech`, description: copy.description, url: absoluteUrl("/brands"), siteName, type: "website", locale: runtimePublicOpenGraphLocale(locale), images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: copy.title }] },
    twitter: { card: "summary_large_image", title: copy.title, description: copy.description, images: ["/opengraph-image"] },
  };
}

export default async function BrandsPage() {
  const locale = await getServerLocale();
  const jsonLd = localizeRuntimePublicJsonLd({
    "@context": "https://schema.org",
    "@graph": [
      organizationJsonLd(locale),
      websiteJsonLd(locale),
      { "@type": "CollectionPage", "@id": `${absoluteUrl("/brands")}#page`, name: title, description, url: absoluteUrl("/brands"), inLanguage: runtimePublicInLanguage(locale), isPartOf: { "@id": `${absoluteUrl("/")}#website` } },
      { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") }, { "@type": "ListItem", position: 2, name: "Vehicle brands", item: absoluteUrl("/brands") }] },
      { "@type": "ItemList", itemListElement: brandGuides.map((guide, index) => ({ "@type": "ListItem", position: index + 1, name: guide.name, url: absoluteUrl(`/brands/${guide.slug}`) })) },
    ],
  }, locale, ["core", "vehicle"]);

  return (
    <RuntimePublicLocalization locale={locale} scopes={["core", "vehicle"]}>
      <main className="min-h-screen bg-[#050505] text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PublicSeoHeader locale={locale} />
      <section className="border-b border-white/10 bg-[radial-gradient(circle_at_80%_10%,rgba(177,18,27,0.23),transparent_30%),#050505]">
        <div className="mx-auto max-w-7xl px-4 py-16 lg:py-24">
          <p className="inline-flex items-center gap-2 rounded-full border border-red-800/50 bg-red-950/20 px-4 py-2 text-sm font-black text-red-100"><BadgeCheck className="h-4 w-4 text-red-500" />Vehicle support</p>
          <h1 className="mt-7 max-w-5xl text-[clamp(2.7rem,8vw,5.2rem)] font-black leading-[0.96]">{title}</h1>
          <p className="mt-7 max-w-3xl text-lg leading-8 text-zinc-300">{description} Every request is confirmed from the actual ECU, software and read data rather than the badge alone.</p>
        </div>
      </section>
      <section className="bg-[#08090b]">
        <div className="mx-auto max-w-7xl px-4 py-16 lg:py-20">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {brandGuides.map((guide) => (
              <article key={guide.slug} className="flex min-h-72 flex-col border border-white/10 bg-[#0d0e10] p-6">
                <CarFront className="h-6 w-6 text-red-500" />
                <h2 className="mt-6 text-2xl font-black">{guide.name}</h2>
                <p className="mt-4 line-clamp-4 text-sm leading-7 text-zinc-400">{guide.description}</p>
                <Link href={`/brands/${guide.slug}`} className="mt-auto inline-flex items-center pt-6 text-sm font-black text-red-400 hover:text-red-300">View brand guide<ArrowRight className="ml-2 h-4 w-4" /></Link>
              </article>
            ))}
          </div>
          <aside className="mt-10 border border-amber-700/30 bg-amber-950/10 p-6 text-sm leading-7 text-amber-100/80">Brand pages describe common controller families, not guaranteed coverage. Support is confirmed only after checking the submitted file, ECU identification, read method and requested service.</aside>
        </div>
      </section>
      <RuntimePublicFooter locale={locale} scopes={["core", "vehicle"]} />
      </main>
    </RuntimePublicLocalization>
  );
}
