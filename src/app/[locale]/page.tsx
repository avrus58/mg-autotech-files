import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  Cpu,
  CreditCard,
  FileCode2,
  Gauge,
  ShieldCheck,
  Upload,
  Wrench,
} from "lucide-react";
import { Footer } from "@/components/Footer";
import { OnlineStatus } from "@/components/OnlineStatus";
import {
  getServiceSeo,
  homeSeo,
  hreflangByLocale,
  isSeoLocale,
  languageAlternates,
  localizedPath,
  localizedUrl,
  organizationJsonLd,
  publicServiceSlugs,
  seoLabels,
  seoLocales,
  siteName,
  websiteJsonLd,
  type PublicServiceSlug,
} from "@/lib/seo";
import type { LocaleCode } from "@/lib/i18n";

const serviceIcons: Record<PublicServiceSlug, typeof Gauge> = {
  "stage-1": Gauge,
  "dpf-off": Wrench,
  "egr-off": Cpu,
  "adblue-off": ShieldCheck,
  "dtc-off": FileCode2,
};

const trustIcons = [Upload, Clock3, CreditCard, CheckCircle2];

export function generateStaticParams() {
  return seoLocales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;

  if (!isSeoLocale(rawLocale)) return {};

  const locale = rawLocale as LocaleCode;
  const copy = homeSeo[locale];

  return {
    title: copy.title,
    description: copy.description,
    alternates: {
      canonical: localizedUrl(locale, "/"),
      languages: languageAlternates("/"),
    },
    openGraph: {
      title: `${copy.title} | MG AutoTech`,
      description: copy.description,
      url: localizedUrl(locale, "/"),
      siteName,
      locale: hreflangByLocale[locale],
      type: "website",
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: "MG AutoTech ECU and TCU File Service",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: copy.title,
      description: copy.description,
      images: ["/opengraph-image"],
    },
  };
}

export default async function LocalizedHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;

  if (!isSeoLocale(rawLocale)) notFound();

  const locale = rawLocale as LocaleCode;
  const copy = homeSeo[locale];
  const labels = seoLabels[locale];
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [organizationJsonLd(), websiteJsonLd(locale)],
  };

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_18%_0%,rgba(177,18,27,0.30),transparent_32%),linear-gradient(135deg,#050505,#0c0d10_48%,#160608)]" />

      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <Link href={localizedPath(locale)} className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-800/50 bg-[#111] shadow-lg shadow-red-950/40">
              <Cpu className="h-7 w-7 text-red-600" />
            </div>
            <div>
              <div className="text-xl font-black tracking-wide">
                MG <span className="text-red-600">AUTOTECH</span>
              </div>
              <div className="text-xs text-zinc-400">ECU / TCU File Service</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-bold text-zinc-300 md:flex">
            <Link className="text-red-500" href={localizedPath(locale)}>
              {labels.navHome}
            </Link>
            <a className="transition hover:text-white" href="#services">
              {labels.navServices}
            </a>
            <a className="transition hover:text-white" href="#trust">
              {labels.why}
            </a>
            <Link className="transition hover:text-white" href="/dashboard/credits">
              {labels.navPrices}
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-white transition hover:border-red-800/60 sm:inline-flex"
            >
              {labels.login}
            </Link>
            <Link
              href="/register"
              className="rounded-xl bg-[#b1121b] px-4 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40 transition hover:bg-[#c91824]"
            >
              {labels.register}
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-red-800/50 bg-red-950/25 px-4 py-2 text-sm font-black text-red-100">
            <BadgeCheck className="h-4 w-4 text-red-500" />
            {copy.eyebrow}
          </div>
          <h1 className="max-w-5xl text-5xl font-black leading-[0.95] tracking-normal md:text-7xl">
            {copy.heroTitle}
          </h1>
          <p className="mt-7 max-w-3xl text-lg leading-8 text-zinc-300">
            {copy.intro}
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/new-request"
              className="inline-flex items-center justify-center rounded-xl bg-[#b1121b] px-6 py-4 text-sm font-black text-white shadow-xl shadow-red-950/40 transition hover:bg-[#c91824]"
            >
              {copy.primaryCta}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <a
              href="#services"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-6 py-4 text-sm font-black text-white transition hover:bg-white/10"
            >
              {copy.secondaryCta}
            </a>
          </div>
        </div>

        <div className="rounded-[2rem] border border-red-900/40 bg-[linear-gradient(135deg,rgba(177,18,27,0.16),rgba(255,255,255,0.04))] p-5 shadow-2xl shadow-black/30">
          <div className="rounded-[1.5rem] border border-white/10 bg-black/45 p-5">
            <div className="mb-5 flex items-center justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <div className="text-sm font-black uppercase tracking-[0.28em] text-red-400">
                  MG AutoTech
                </div>
                <div className="mt-2 text-2xl font-black">ECU / TCU Workflow</div>
              </div>
              <div className="rounded-full border border-emerald-700/40 bg-emerald-950/40 px-3 py-1.5 text-xs font-black text-emerald-300">
                Online
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                "Secure upload",
                "File check",
                "Calibration",
                "Portal delivery",
              ].map((item, index) => {
                const Icon = trustIcons[index] ?? CheckCircle2;
                return (
                  <div
                    key={item}
                    className="rounded-2xl border border-white/10 bg-black/35 p-4"
                  >
                    <Icon className="mb-4 h-5 w-5 text-red-500" />
                    <div className="text-sm font-black">{item}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section id="services" className="mx-auto max-w-7xl px-4 py-16">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <div className="text-sm font-black uppercase tracking-[0.35em] text-red-500">
              {labels.navServices}
            </div>
            <h2 className="mt-4 text-4xl font-black leading-tight md:text-6xl">
              {copy.servicesTitle}
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-8 text-zinc-400">
            {copy.servicesText}
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {publicServiceSlugs.map((slug) => {
            const service = getServiceSeo(slug, locale);
            const Icon = serviceIcons[slug];

            return (
              <Link
                key={slug}
                href={localizedPath(locale, `/services/${slug}`)}
                className="group rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-red-800/60 hover:bg-red-950/20"
              >
                <Icon className="h-6 w-6 text-red-500" />
                <div className="mt-6 text-xl font-black leading-tight">
                  {service.name}
                </div>
                <div className="mt-4 text-sm leading-6 text-zinc-400">
                  {service.description}
                </div>
                <div className="mt-5 inline-flex items-center text-sm font-black text-red-300">
                  {labels.viewService}
                  <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section id="trust" className="mx-auto max-w-7xl px-4 py-16">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 md:p-10">
          <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div>
              <div className="text-sm font-black uppercase tracking-[0.35em] text-red-500">
                {labels.why}
              </div>
              <h2 className="mt-4 text-4xl font-black leading-tight md:text-6xl">
                {copy.trustTitle}
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-8 text-zinc-400">
                {copy.trustText}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { title: labels.securePortal, icon: ShieldCheck },
                { title: labels.credits, icon: CreditCard },
                { title: labels.process, icon: Gauge },
                { title: labels.delivery, icon: Upload },
              ].map(({ title, icon: Icon }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-white/10 bg-black/35 p-5"
                >
                  <Icon className="mb-5 h-6 w-6 text-red-500" />
                  <div className="text-lg font-black">{title}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Footer />
      <OnlineStatus />
    </main>
  );
}
