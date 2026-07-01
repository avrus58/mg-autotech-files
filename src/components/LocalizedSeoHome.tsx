import Link from "next/link";
import { ArrowRight, BadgeCheck, CheckCircle2, Clock3, Cpu, FileCheck2, ShieldCheck, Upload } from "lucide-react";
import type { LocaleCode } from "@/lib/i18n";
import {
  getServiceSeo,
  homeSeo,
  localizedPath,
  publicServiceSlugs,
  seoLabels,
} from "@/lib/seo";
import { seoUiCopy } from "@/lib/seo-ui";
import { LocalizedSeoFooter } from "@/components/LocalizedSeoFooter";

const brands = [
  ["BMW", "MD1 · EDC17 · MG1"],
  ["Mercedes-Benz", "CDI · MED · VGS"],
  ["Audi", "EDC · MED · SIMOS"],
  ["Volkswagen", "EDC · SIMOS · DSG"],
  ["Porsche", "SDI · MED · PDK"],
  ["Opel", "EDC · DELCO · DCM"],
  ["Renault", "EDC · SID · EMS"],
  ["Peugeot", "EDC · SID · DCM"],
] as const;

export function LocalizedSeoHome({ locale }: { locale: LocaleCode }) {
  const copy = homeSeo[locale];
  const labels = seoLabels[locale];
  const ui = seoUiCopy[locale];
  const referenceService = getServiceSeo("stage-1", locale);

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <Link href={localizedPath(locale)} className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-red-800/50 bg-[#111]">
              <Cpu className="h-6 w-6 text-red-500" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-lg font-black">MG <span className="text-red-500">AUTOTECH</span></span>
              <span className="block text-[11px] text-zinc-400">ECU / TCU File Service</span>
            </span>
          </Link>
          <nav aria-label="Primary navigation" className="hidden items-center gap-6 text-sm font-bold text-zinc-300 md:flex">
            <Link href={localizedPath(locale)} className="text-red-500">{labels.navHome}</Link>
            <Link href={localizedPath(locale, "/#services")} className="hover:text-white">{labels.navServices}</Link>
            <Link href="/tools" className="hover:text-white">{ui.tools}</Link>
            <Link href="/dashboard/credits" className="hover:text-white">{labels.navPrices}</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden rounded-lg border border-white/10 px-4 py-2.5 text-sm font-bold hover:bg-white/10 sm:inline-flex">{labels.login}</Link>
            <Link href="/register" className="rounded-lg bg-[#b1121b] px-4 py-2.5 text-sm font-black hover:bg-[#c91824]">{labels.register}</Link>
          </div>
        </div>
      </header>

      <section className="border-b border-white/10 bg-[radial-gradient(circle_at_75%_20%,rgba(177,18,27,0.23),transparent_28%),#050505]">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 lg:grid-cols-[1.08fr_.92fr] lg:items-center lg:py-24">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full border border-red-800/50 bg-red-950/20 px-4 py-2 text-sm font-black text-red-100">
              <ShieldCheck className="h-4 w-4 text-red-500" aria-hidden="true" />{copy.eyebrow}
            </p>
            <h1 className="mt-7 max-w-4xl text-[clamp(2.7rem,8vw,5.4rem)] font-black leading-[0.96] tracking-normal [overflow-wrap:anywhere]">
              {copy.heroTitle}
            </h1>
            <p className="mt-7 max-w-3xl text-base leading-8 text-zinc-300 md:text-lg">{copy.intro}</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/new-request" className="inline-flex items-center justify-center rounded-lg bg-[#b1121b] px-6 py-4 text-sm font-black hover:bg-[#c91824]">
                {copy.primaryCta}<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href={localizedPath(locale, "/#services")} className="inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/[0.04] px-6 py-4 text-sm font-black hover:bg-white/10">
                {copy.secondaryCta}
              </Link>
            </div>
          </div>

          <div className="border border-red-900/50 bg-[#0b0b0d] p-5 shadow-2xl shadow-red-950/20 sm:p-7">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
              <div><p className="text-xs font-black uppercase tracking-[0.2em] text-red-400">MG AutoTech</p><h2 className="mt-2 text-2xl font-black">{ui.workflowTitle}</h2></div>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-700/50 bg-emerald-950/30 px-3 py-2 text-xs font-black text-emerald-300"><span className="h-2 w-2 rounded-full bg-emerald-400" />{ui.online}</span>
            </div>
            <p className="mt-5 text-sm leading-7 text-zinc-400">{ui.workflowText}</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {referenceService.process.map((step, index) => {
                const icons = [Upload, FileCheck2, Cpu, CheckCircle2] as const;
                const Icon = icons[index] ?? CheckCircle2;
                return <div key={step.title} className="border border-white/10 bg-black/40 p-4"><Icon className="h-5 w-5 text-red-500" /><h3 className="mt-4 text-sm font-black">{step.title}</h3><p className="mt-2 text-xs leading-6 text-zinc-500">{step.text}</p></div>;
              })}
            </div>
          </div>
        </div>
      </section>

      <section id="services" className="scroll-mt-24 border-b border-white/10 bg-[#08090b]">
        <div className="mx-auto max-w-7xl px-4 py-16 lg:py-20">
          <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr] lg:items-end">
            <div><p className="text-xs font-black uppercase tracking-[0.24em] text-red-500">{labels.navServices}</p><h2 className="mt-4 text-4xl font-black md:text-5xl">{copy.servicesTitle}</h2></div>
            <p className="max-w-2xl text-sm leading-7 text-zinc-400 lg:justify-self-end">{copy.servicesText}</p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {publicServiceSlugs.map((slug) => {
              const service = getServiceSeo(slug, locale);
              return <article key={slug} className="flex min-h-64 flex-col border border-white/10 bg-[#0d0e10] p-5"><BadgeCheck className="h-5 w-5 text-red-500" /><h3 className="mt-6 text-xl font-black">{service.name}</h3><p className="mt-3 line-clamp-4 text-sm leading-6 text-zinc-400">{service.description}</p><div className="mt-auto pt-5"><span className="mb-4 flex items-center gap-2 text-xs font-bold text-zinc-500"><Clock3 className="h-4 w-4" />{service.credits} {labels.credits}</span><Link href={localizedPath(locale, `/services/${slug}`)} className="inline-flex items-center text-sm font-black text-red-400 hover:text-red-300">{labels.viewService}<ArrowRight className="ml-2 h-4 w-4" /></Link></div></article>;
            })}
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#050505]">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 lg:grid-cols-[.85fr_1.15fr] lg:items-start lg:py-20">
          <div><p className="text-xs font-black uppercase tracking-[0.24em] text-red-500">{labels.why}</p><h2 className="mt-4 text-4xl font-black md:text-5xl">{copy.trustTitle}</h2><p className="mt-6 text-sm leading-7 text-zinc-400">{copy.trustText}</p></div>
          <div className="grid gap-4 sm:grid-cols-2">{referenceService.benefits.map((benefit) => <div key={benefit} className="flex min-h-32 gap-4 border border-white/10 bg-[#0b0c0e] p-5"><CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" /><p className="text-sm font-bold leading-6">{benefit}</p></div>)}</div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#0a0b0d]">
        <div className="mx-auto max-w-7xl px-4 py-16 lg:py-20">
          <div className="max-w-3xl"><p className="text-xs font-black uppercase tracking-[0.24em] text-red-500">ECU / TCU</p><h2 className="mt-4 text-4xl font-black md:text-5xl">{labels.supportedBrands}</h2><p className="mt-5 text-sm leading-7 text-zinc-400">{ui.brandsText}</p></div>
          <div className="mt-9 grid grid-cols-2 gap-3 md:grid-cols-4">{brands.map(([name, families]) => <div key={name} className="border border-white/10 bg-[#0e0f11] p-5"><h3 className="text-lg font-black">{name}</h3><p className="mt-2 text-xs text-zinc-500">{families}</p></div>)}</div>
        </div>
      </section>

      <section className="bg-[#050505]">
        <div className="mx-auto max-w-7xl px-4 py-16 lg:py-20">
          <h2 className="text-4xl font-black md:text-5xl">{labels.faq}</h2>
          <div className="mt-9 grid gap-4 md:grid-cols-2">{referenceService.faq.map((item) => <article key={item.q} className="border border-white/10 bg-[#0b0c0e] p-6"><h3 className="text-lg font-black">{item.q}</h3><p className="mt-3 text-sm leading-7 text-zinc-400">{item.a}</p></article>)}</div>
        </div>
      </section>

      <LocalizedSeoFooter locale={locale} />
    </main>
  );
}
