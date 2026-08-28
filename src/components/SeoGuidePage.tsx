import Link from "next/link";
import { ArrowRight, BadgeCheck, CheckCircle2, FileCheck2, ShieldCheck } from "lucide-react";
import { Footer } from "@/components/Footer";
import { PublicSeoHeader } from "@/components/PublicSeoHeader";

type GuideSection = { title: string; items: string[] };

export function SeoGuidePage({
  eyebrow,
  title,
  description,
  intro,
  sections,
  faq,
  related,
  jsonLd,
  breadcrumbs,
  requestHref = "/new-request",
}: {
  eyebrow: string;
  title: string;
  description: string;
  intro: string[];
  sections: GuideSection[];
  faq: { q: string; a: string }[];
  related: { label: string; href: string }[];
  jsonLd: object;
  breadcrumbs?: { label: string; href?: string }[];
  requestHref?: string;
}) {
  return (
    <main data-no-translate className="min-h-screen bg-[#050505] text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PublicSeoHeader />

      <section className="border-b border-white/10 bg-[radial-gradient(circle_at_80%_10%,rgba(177,18,27,0.24),transparent_30%),#050505]">
        <div className="mx-auto max-w-7xl px-4 py-16 lg:py-24">
          {breadcrumbs && (
            <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-2 text-xs font-bold text-zinc-500">
              {breadcrumbs.map((item, index) => (
                <span key={`${item.label}-${index}`} className="inline-flex items-center gap-2">
                  {index > 0 && <span aria-hidden="true">/</span>}
                  {item.href ? (
                    <Link href={item.href} className="transition hover:text-white">{item.label}</Link>
                  ) : (
                    <span aria-current="page" className="text-zinc-300">{item.label}</span>
                  )}
                </span>
              ))}
            </nav>
          )}
          <p className="inline-flex items-center gap-2 rounded-full border border-red-800/50 bg-red-950/20 px-4 py-2 text-sm font-black text-red-100">
            <BadgeCheck className="h-4 w-4 text-red-500" aria-hidden="true" />{eyebrow}
          </p>
          <h1 className="mt-7 max-w-5xl text-[clamp(2.7rem,8vw,5.2rem)] font-black leading-[0.96] tracking-normal [overflow-wrap:anywhere]">{title}</h1>
          <p className="mt-7 max-w-3xl text-lg leading-8 text-zinc-300">{description}</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href={requestHref} className="inline-flex items-center justify-center rounded-lg bg-[#b1121b] px-6 py-4 text-sm font-black hover:bg-[#c91824]">Create file request<ArrowRight className="ml-2 h-4 w-4" /></Link>
            <Link href="/contact" className="inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/[0.04] px-6 py-4 text-sm font-black hover:bg-white/10">Ask about compatibility</Link>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#08090b]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 lg:grid-cols-2 lg:py-20">
          {intro.map((paragraph, index) => (
            <div key={paragraph} className="flex gap-4">
              {index === 0 ? <FileCheck2 className="mt-1 h-6 w-6 shrink-0 text-red-500" /> : <ShieldCheck className="mt-1 h-6 w-6 shrink-0 text-emerald-400" />}
              <p className="text-base leading-8 text-zinc-300">{paragraph}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#050505]">
        <div className="mx-auto max-w-7xl px-4 py-16 lg:py-20">
          <div className="grid gap-5 lg:grid-cols-3">
            {sections.map((section) => (
              <article key={section.title} className="border border-white/10 bg-[#0b0c0e] p-6">
                <h2 className="text-2xl font-black">{section.title}</h2>
                <ul className="mt-6 space-y-4">
                  {section.items.map((item) => <li key={item} className="flex gap-3 text-sm leading-6 text-zinc-300"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />{item}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#090a0c]">
        <div className="mx-auto max-w-7xl px-4 py-16 lg:py-20">
          <h2 className="text-4xl font-black">Frequently asked questions</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {faq.map((item) => <article key={item.q} className="border border-white/10 bg-black/35 p-6"><h3 className="text-lg font-black">{item.q}</h3><p className="mt-3 text-sm leading-7 text-zinc-400">{item.a}</p></article>)}
          </div>
        </div>
      </section>

      <section className="bg-[#050505]">
        <div className="mx-auto max-w-7xl px-4 py-14">
          <h2 className="text-2xl font-black">Related technical pages</h2>
          <div className="mt-5 flex flex-wrap gap-3">{related.map((item) => <Link key={item.href} href={item.href} className="inline-flex items-center rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-zinc-200 hover:border-red-800/60 hover:text-white">{item.label}<ArrowRight className="ml-2 h-4 w-4 text-red-500" /></Link>)}</div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
