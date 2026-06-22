import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  Cpu,
  FileCode2,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { Footer } from "@/components/Footer";
import { OnlineStatus } from "@/components/OnlineStatus";
import {
  getServiceSeo,
  homeSeo,
  hreflangByLocale,
  isPublicServiceSlug,
  isSeoLocale,
  languageAlternates,
  localizedPath,
  localizedUrl,
  organizationJsonLd,
  publicServiceSlugs,
  seoLabels,
  seoLocales,
  serviceJsonLd,
  siteName,
  websiteJsonLd,
  type PublicServiceSlug,
} from "@/lib/seo";
import type { LocaleCode } from "@/lib/i18n";

export function generateStaticParams() {
  return seoLocales.flatMap((locale) =>
    publicServiceSlugs.map((slug) => ({ locale, slug }))
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale, slug: rawSlug } = await params;

  if (!isSeoLocale(rawLocale) || !isPublicServiceSlug(rawSlug)) return {};

  const locale = rawLocale as LocaleCode;
  const slug = rawSlug as PublicServiceSlug;
  const service = getServiceSeo(slug, locale);
  const path = `/services/${slug}`;

  return {
    title: service.title,
    description: service.description,
    alternates: {
      canonical: localizedUrl(locale, path),
      languages: languageAlternates(path),
    },
    openGraph: {
      title: `${service.title} | MG AutoTech`,
      description: service.description,
      url: localizedUrl(locale, path),
      siteName,
      locale: hreflangByLocale[locale],
      type: "website",
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: service.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: service.title,
      description: service.description,
      images: ["/opengraph-image"],
    },
  };
}

export default async function LocalizedServicePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug: rawSlug } = await params;

  if (!isSeoLocale(rawLocale) || !isPublicServiceSlug(rawSlug)) notFound();

  const locale = rawLocale as LocaleCode;
  const slug = rawSlug as PublicServiceSlug;
  const labels = seoLabels[locale];
  const home = homeSeo[locale];
  const service = getServiceSeo(slug, locale);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      organizationJsonLd(),
      websiteJsonLd(locale),
      serviceJsonLd(slug, locale),
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: labels.navHome,
            item: localizedUrl(locale, "/"),
          },
          {
            "@type": "ListItem",
            position: 2,
            name: labels.navServices,
            item: localizedUrl(locale, "/#services"),
          },
          {
            "@type": "ListItem",
            position: 3,
            name: service.name,
            item: localizedUrl(locale, `/services/${slug}`),
          },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: service.faq.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.a,
          },
        })),
      },
    ],
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
            <Link className="transition hover:text-white" href={localizedPath(locale)}>
              {labels.navHome}
            </Link>
            <Link className="text-red-500" href={localizedPath(locale, "/#services")}>
              {labels.navServices}
            </Link>
            <Link className="transition hover:text-white" href="/dashboard/credits">
              {labels.navPrices}
            </Link>
          </nav>

          <Link
            href="/new-request"
            className="rounded-xl bg-[#b1121b] px-4 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40 transition hover:bg-[#c91824]"
          >
            {labels.startRequest}
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
        <div className="min-w-0">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-red-800/50 bg-red-950/25 px-4 py-2 text-sm font-black text-red-100">
            <BadgeCheck className="h-4 w-4 text-red-500" />
            {service.eyebrow}
          </div>
          <h1 className="max-w-5xl break-words text-[clamp(2.35rem,10vw,4.5rem)] font-black leading-[0.98] tracking-normal [overflow-wrap:anywhere] md:text-7xl md:leading-[0.95]">
            {service.title}
          </h1>
          <p className="mt-7 max-w-3xl text-lg leading-8 text-zinc-300">
            {service.hero}
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/new-request"
              className="inline-flex items-center justify-center rounded-xl bg-[#b1121b] px-6 py-4 text-sm font-black text-white shadow-xl shadow-red-950/40 transition hover:bg-[#c91824]"
            >
              {labels.startRequest}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link
              href={localizedPath(locale)}
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-6 py-4 text-sm font-black text-white transition hover:bg-white/10"
            >
              {home.primaryCta}
            </Link>
          </div>
        </div>

        <div className="min-w-0 rounded-[2rem] border border-red-900/40 bg-[linear-gradient(135deg,rgba(177,18,27,0.16),rgba(255,255,255,0.04))] p-5 shadow-2xl shadow-black/30">
          <div className="grid gap-4 sm:grid-cols-2">
            <InfoCard icon={Wrench} label={labels.credits} value={`${service.credits} credits`} />
            <InfoCard icon={Clock3} label={labels.turnaround} value={service.turnaround} />
            <InfoCard icon={ShieldCheck} label={labels.delivery} value={labels.securePortal} />
            <InfoCard icon={FileCode2} label="ECU / TCU" value="File workflow" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 md:p-8">
            <h2 className="text-3xl font-black">{labels.process}</h2>
            <div className="mt-8 space-y-4">
              {service.process.map((step, index) => (
                <div key={step.title} className="rounded-2xl border border-white/10 bg-black/35 p-5">
                  <div className="mb-3 flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-sm font-black">
                      {index + 1}
                    </span>
                    <div className="text-lg font-black">{step.title}</div>
                  </div>
                  <p className="text-sm leading-7 text-zinc-400">{step.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 md:p-8">
              <h2 className="text-3xl font-black">{labels.why}</h2>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {service.benefits.map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-black/35 p-5">
                    <CheckCircle2 className="mb-4 h-5 w-5 text-emerald-400" />
                    <div className="text-sm font-bold leading-6">{item}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <ListPanel title={labels.supportedBrands} items={service.supported} />
              <ListPanel title={labels.requiredInfo} items={service.required} />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 md:p-8">
          <h2 className="text-3xl font-black">{labels.faq}</h2>
          <div className="mt-7 grid gap-4 md:grid-cols-2">
            {service.faq.map((item) => (
              <div key={item.q} className="rounded-2xl border border-white/10 bg-black/35 p-5">
                <h3 className="text-lg font-black">{item.q}</h3>
                <p className="mt-3 text-sm leading-7 text-zinc-400">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
      <OnlineStatus />
    </main>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Wrench;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/35 p-5">
      <Icon className="mb-5 h-6 w-6 text-red-500" />
      <div className="text-xs font-black uppercase tracking-[0.22em] text-zinc-500">
        {label}
      </div>
      <div className="mt-3 text-2xl font-black">{value}</div>
    </div>
  );
}

function ListPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
      <h2 className="text-2xl font-black">{title}</h2>
      <div className="mt-5 flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item}
            className="rounded-full border border-white/10 bg-black/35 px-3 py-2 text-xs font-black text-zinc-200"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
