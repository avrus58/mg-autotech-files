import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, FileCheck2, ShieldCheck, Wrench } from "lucide-react";
import { PublicSeoHeader } from "@/components/PublicSeoHeader";
import { RuntimePublicLocalization } from "@/components/RuntimePublicLocalization";
import { RuntimePublicFooter } from "@/components/RuntimePublicFooter";
import {
  localizeRuntimePublicJsonLd,
  runtimePublicAlternates,
  runtimePublicMetadataCopy,
  runtimePublicInLanguage,
  runtimePublicOpenGraphLocale,
} from "@/lib/i18n/runtime-public";
import { absoluteUrl, organizationJsonLd, siteName, websiteJsonLd } from "@/lib/seo";
import { getServerLocale } from "@/lib/serverLocale";

const title = "About MG AutoTech File Service";
const description = "Learn how MG AutoTech structures ECU and TCU file requests, technical checks, secure delivery, file versions and workshop support.";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const copy = runtimePublicMetadataCopy(locale, title, description, ["core"]);
  return {
    title: copy.title,
    description: copy.description,
    alternates: runtimePublicAlternates("/about"),
    openGraph: { title: `${copy.title} | MG AutoTech`, description: copy.description, url: absoluteUrl("/about"), siteName, type: "website", locale: runtimePublicOpenGraphLocale(locale), images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: copy.title }] },
    twitter: { card: "summary_large_image", title: copy.title, description: copy.description, images: ["/opengraph-image"] },
  };
}

const principles = [
  { icon: FileCheck2, title: "Technical context first", text: "Vehicle, ECU, HW/SW, read method and workshop notes stay connected to the original file." },
  { icon: ShieldCheck, title: "Private portal delivery", text: "Original and completed files are delivered through authenticated customer order pages, not public links." },
  { icon: Wrench, title: "Built for repeat workshop use", text: "Credits, timelines, messages, versions and revision requests remain visible in one operational workflow." },
];

export default async function AboutPage() {
  const locale = await getServerLocale();
  const jsonLd = localizeRuntimePublicJsonLd({ "@context": "https://schema.org", "@graph": [organizationJsonLd(), websiteJsonLd(locale), { "@type": "AboutPage", "@id": `${absoluteUrl("/about")}#page`, name: title, description, url: absoluteUrl("/about"), inLanguage: runtimePublicInLanguage(locale), mainEntity: { "@id": `${absoluteUrl("/")}#organization` } }, { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") }, { "@type": "ListItem", position: 2, name: "About", item: absoluteUrl("/about") }] }] }, locale, ["core"]);
  return (
    <RuntimePublicLocalization locale={locale} scopes={["core"]}>
      <main className="min-h-screen bg-[#050505] text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PublicSeoHeader locale={locale} />
      <section className="border-b border-white/10 bg-[radial-gradient(circle_at_80%_10%,rgba(177,18,27,0.23),transparent_30%),#050505]"><div className="mx-auto max-w-7xl px-4 py-16 lg:py-24"><p className="text-xs font-black uppercase tracking-[0.24em] text-red-500">MG AutoTech</p><h1 className="mt-6 max-w-5xl text-[clamp(2.7rem,8vw,5.2rem)] font-black leading-[0.96]">A clearer way to handle workshop file-service work.</h1><p className="mt-7 max-w-3xl text-lg leading-8 text-zinc-300">MG AutoTech is operated by Melih Gokkaya in Stuttgart, Germany. The platform is designed to keep ECU and TCU requests technically clear, private and traceable from original upload to final delivery.</p></div></section>
      <section className="border-b border-white/10 bg-[#08090b]"><div className="mx-auto max-w-7xl px-4 py-16 lg:py-20"><div className="grid gap-5 lg:grid-cols-3">{principles.map(({ icon: Icon, title: itemTitle, text }) => <article key={itemTitle} className="border border-white/10 bg-[#0d0e10] p-6"><Icon className="h-6 w-6 text-red-500" /><h2 className="mt-6 text-2xl font-black">{itemTitle}</h2><p className="mt-4 text-sm leading-7 text-zinc-400">{text}</p></article>)}</div></div></section>
      <section className="bg-[#050505]"><div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 lg:grid-cols-[.9fr_1.1fr] lg:py-20"><div><p className="text-xs font-black uppercase tracking-[0.24em] text-red-500">How we work</p><h2 className="mt-4 text-4xl font-black">File-by-file verification, not blanket promises.</h2><p className="mt-6 text-sm leading-7 text-zinc-400">Vehicle badges and generic ECU family names are not enough to confirm support. The submitted file, controller identification, read method and requested service are reviewed together. If information is missing, the order can be moved to customer-info-needed instead of being processed on assumptions.</p></div><div className="space-y-4">{["Original file and identification are attached to one request.", "Order status and estimated delivery remain visible to the customer.", "Completed file versions and revisions retain a clear history.", "Customers can message the team inside the order detail view."].map((item) => <div key={item} className="flex gap-3 border border-white/10 bg-[#0b0c0e] p-5 text-sm font-bold"><CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />{item}</div>)}</div></div></section>
      <section className="border-y border-red-900/40 bg-red-950/15"><div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-12 md:flex-row md:items-center md:justify-between"><div><h2 className="text-3xl font-black">Need a file checked?</h2><p className="mt-2 text-sm text-zinc-400">Create an account, submit the original read and keep the full job in one secure place.</p></div><Link href="/new-request" className="inline-flex items-center justify-center rounded-lg bg-[#b1121b] px-6 py-4 text-sm font-black hover:bg-[#c91824]">Start request<ArrowRight className="ml-2 h-4 w-4" /></Link></div></section>
      <RuntimePublicFooter locale={locale} />
      </main>
    </RuntimePublicLocalization>
  );
}
