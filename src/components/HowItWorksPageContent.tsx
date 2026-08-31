import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  FileUp,
  LayoutDashboard,
  LockKeyhole,
  MessageSquareText,
  ShieldCheck,
  UploadCloud,
  UserPlus,
  Wrench,
} from "lucide-react";
import { Footer } from "@/components/Footer";
import {
  LocalizedSeoFooter,
  localizedSeoFooterCopy,
} from "@/components/LocalizedSeoFooter";
import type { LocaleCode } from "@/lib/i18nConfig";
import type { HowItWorksCopy } from "@/lib/howItWorksI18n";
import { localizedPath } from "@/lib/seo";

const processIcons = [
  UserPlus,
  LayoutDashboard,
  Wrench,
  FileUp,
  ShieldCheck,
  MessageSquareText,
  CheckCircle2,
] as const;

const benefitIcons = [
  LockKeyhole,
  LayoutDashboard,
  MessageSquareText,
  CreditCard,
  Wrench,
  UploadCloud,
] as const;

export function HowItWorksPageContent({
  copy,
  locale,
  localized = false,
}: {
  copy: HowItWorksCopy;
  locale: LocaleCode;
  localized?: boolean;
}) {
  const homeHref = localized ? localizedPath(locale) : "/";
  const servicesHref = localized ? localizedPath(locale, "/#services") : "/services/stage-1";
  const howItWorksHref = localized ? localizedPath(locale, "/how-it-works") : "/how-it-works";

  return (
    <main lang={locale} className="min-h-screen bg-[#050505] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4">
          <Link href={homeHref} className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-red-800/50 bg-[#111]">
              <Wrench className="h-6 w-6 text-red-500" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block whitespace-nowrap text-base font-black sm:text-lg">
                MG <span className="text-red-500">AUTOTECH</span>
              </span>
              <span className="hidden text-[11px] text-zinc-400 sm:block">
                {localizedSeoFooterCopy[locale].brandLine}
              </span>
            </span>
          </Link>
          <nav aria-label="Primary navigation" className="hidden items-center gap-6 text-sm font-bold text-zinc-300 md:flex">
            <Link href={homeHref} className="hover:text-white">{copy.nav.home}</Link>
            <Link href={servicesHref} className="hover:text-white">{copy.nav.services}</Link>
            <Link href={howItWorksHref} className="text-red-500">{copy.nav.howItWorks}</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden rounded-lg border border-white/10 px-4 py-2.5 text-sm font-bold hover:bg-white/10 sm:inline-flex">
              {copy.nav.login}
            </Link>
            <Link href="/new-request" className="rounded-lg bg-[#b1121b] px-3 py-2.5 text-xs font-black hover:bg-[#c91824] sm:px-4 sm:text-sm">
              {copy.nav.startRequest}
            </Link>
          </div>
        </div>
      </header>

      <section className="border-b border-white/10 bg-[radial-gradient(circle_at_80%_10%,rgba(177,18,27,0.22),transparent_30%),linear-gradient(135deg,#050505,#0d111a_58%,#050505)]">
        <div className="mx-auto max-w-7xl px-4 py-20 lg:py-28">
          <div className="max-w-4xl">
            <div className="inline-flex rounded-full border border-red-800/40 bg-red-950/25 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-red-300">
              {copy.eyebrow}
            </div>
            <h1 className="mt-7 text-[clamp(2.7rem,7vw,5.5rem)] font-black leading-[0.95] tracking-normal [overflow-wrap:anywhere]">
              {copy.hero}
            </h1>
            <p className="mt-7 max-w-3xl text-lg leading-8 text-zinc-300">{copy.intro}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/new-request" className="inline-flex items-center justify-center rounded-xl bg-[#b1121b] px-6 py-4 text-sm font-black text-white shadow-lg shadow-red-950/30 transition hover:-translate-y-0.5 hover:bg-[#c91824]">
                {copy.primaryCta}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link href="/dashboard" className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-6 py-4 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-white/[0.09]">
                {copy.secondaryCta}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#090b10] py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-12 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-sm font-black uppercase tracking-[0.22em] text-red-500">{copy.processKicker}</div>
              <h2 className="mt-3 max-w-3xl text-4xl font-black md:text-5xl">{copy.processTitle}</h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-zinc-400">{copy.processText}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {copy.processSteps.map((step, index) => {
              const Icon = processIcons[index] ?? CheckCircle2;
              return (
                <article key={step.title} className="rounded-2xl border border-white/10 bg-white/[0.035] p-6 transition hover:-translate-y-1 hover:border-red-800/50 hover:bg-white/[0.06]">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-red-900/50 bg-red-950/25 text-red-400">
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs font-black text-zinc-400">{index + 1}</span>
                  </div>
                  <h3 className="mt-5 text-xl font-black">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-zinc-400">{step.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-[#eef1f4] py-20 text-[#111827]">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-10">
            <div className="text-sm font-black uppercase tracking-[0.22em] text-red-700">{copy.dashboardKicker}</div>
            <h2 className="mt-3 max-w-3xl text-4xl font-black md:text-5xl">{copy.dashboardTitle}</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {copy.dashboardBenefits.map((item, index) => {
              const Icon = benefitIcons[index] ?? CheckCircle2;
              return (
                <article key={item.title} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl shadow-black/5">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-700">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-black">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-zinc-600">{item.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-[#050505] py-20">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div>
            <div className="text-sm font-black uppercase tracking-[0.22em] text-red-500">{copy.securityKicker}</div>
            <h2 className="mt-3 text-4xl font-black md:text-5xl">{copy.securityTitle}</h2>
            <p className="mt-5 text-sm leading-7 text-zinc-400">{copy.securityText}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {copy.securityItems.map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm leading-6 text-zinc-300">
                <ShieldCheck className="mb-4 h-6 w-6 text-red-500" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#0b1226] py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-8">
            <div className="text-sm font-black uppercase tracking-[0.22em] text-red-400">{copy.audienceKicker}</div>
            <h2 className="mt-3 max-w-3xl text-4xl font-black md:text-5xl">{copy.audienceTitle}</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-5">
            {copy.audiences.map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm font-black text-zinc-200">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#050505] py-20">
        <div className="mx-auto max-w-4xl px-4">
          <div className="mb-10 text-center">
            <div className="text-sm font-black uppercase tracking-[0.22em] text-red-500">{copy.faqKicker}</div>
            <h2 className="mt-3 text-4xl font-black md:text-5xl">{copy.faqTitle}</h2>
          </div>
          <div className="space-y-4">
            {copy.faq.map((item) => (
              <article key={item.q} className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
                <h3 className="text-lg font-black">{item.q}</h3>
                <p className="mt-3 text-sm leading-7 text-zinc-400">{item.a}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#b1121b] py-14">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-black">{copy.finalTitle}</h2>
            <p className="mt-2 text-sm leading-6 text-red-100">{copy.finalText}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/new-request" className="rounded-xl bg-white px-6 py-4 text-sm font-black text-[#b1121b] transition hover:-translate-y-0.5 hover:bg-zinc-100">{copy.primaryCta}</Link>
            <Link href="/dashboard" className="rounded-xl border border-white/30 px-6 py-4 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-white/10">{copy.secondaryCta}</Link>
          </div>
        </div>
      </section>

      {localized ? <LocalizedSeoFooter locale={locale} /> : <Footer />}
    </main>
  );
}
