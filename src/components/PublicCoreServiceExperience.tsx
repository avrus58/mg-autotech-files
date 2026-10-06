import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight, BadgeCheck, Car, CheckCircle2, ChevronDown, CircleAlert,
  Clock3, FileCode2, Gauge, ShieldCheck, Upload, Wrench,
  type LucideIcon,
} from "lucide-react";
import { OnlineStatus } from "@/components/OnlineStatus";
import { PublicSeoHeader } from "@/components/PublicSeoHeader";
import { RuntimePublicFooter } from "@/components/RuntimePublicFooter";
import { RuntimePublicLocalization } from "@/components/RuntimePublicLocalization";
import { Stage1Authority, stage1BrandRoutes, stage1PlatformRoutes } from "@/components/Stage1Authority";
import { StageComparison } from "@/components/StageComparison";
import {
  absoluteUrl, hreflangByLocale, languageAlternates, localizedPath,
  localizedUrl, organizationJsonLd, publicServiceSlugs, seoLabels, seoLocales,
  siteName, websiteJsonLd, type PublicServiceSlug,
} from "@/lib/seo";
import { getServiceSeo, serviceJsonLd } from "@/lib/publicCoreServiceSeo";
import {
  localizeRuntimePublicJsonLd, runtimePublicInLanguage, runtimePublicOpenGraphLocale,
} from "@/lib/i18n/runtime-public";
import { intlLocaleByCode, type LocaleCode } from "@/lib/i18nConfig";
import { buildNewRequestPath, getPublicServiceRequestIntent } from "@/lib/requestIntent";
import { buildAuthEntryPath } from "@/lib/safeLocalRedirect";

const scopes = ["core", "services"] as const;

export function getPublicCoreServiceMetadata(slug: PublicServiceSlug, locale: LocaleCode): Metadata {
  const service = getServiceSeo(slug, locale);
  const path = `/services/${slug}`;
  const canonical = localizedUrl(locale, path);
  const socialTitle = `${service.title} | MG AutoTech`;
  return {
    title: service.title,
    description: service.description,
    alternates: { canonical, languages: languageAlternates(path) },
    openGraph: {
      title: socialTitle,
      description: service.description,
      url: canonical,
      siteName,
      locale: runtimePublicOpenGraphLocale(locale),
      alternateLocale: seoLocales.filter((item) => item !== locale).map(runtimePublicOpenGraphLocale),
      type: "website",
      images: [{ url: absoluteUrl("/opengraph-image"), width: 1200, height: 630, alt: service.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description: service.description,
      images: [absoluteUrl("/opengraph-image")],
    },
  };
}

export function PublicCoreServiceExperience({ slug, locale }: { slug: PublicServiceSlug; locale: LocaleCode }) {
  const service = getServiceSeo(slug, locale);
  const labels = seoLabels[locale];
  const requestHref = buildNewRequestPath(getPublicServiceRequestIntent(slug));
  const registrationHref = buildAuthEntryPath("/register", requestHref);
  const pageUrl = localizedUrl(locale, `/services/${slug}`);
  const number = new Intl.NumberFormat(intlLocaleByCode[locale]);
  const stepNumber = new Intl.NumberFormat(intlLocaleByCode[locale], { minimumIntegerDigits: 2 });
  const jsonLd = localizeRuntimePublicJsonLd({
    "@context": "https://schema.org",
    "@graph": [
      organizationJsonLd(locale),
      websiteJsonLd(locale),
      {
        "@type": "WebPage",
        "@id": `${pageUrl}#page`,
        name: service.title,
        description: service.description,
        url: pageUrl,
        inLanguage: runtimePublicInLanguage(locale),
        isPartOf: { "@id": `${absoluteUrl("/")}#website` },
        mainEntity: { "@id": `${pageUrl}#service` },
        breadcrumb: { "@id": `${pageUrl}#breadcrumb` },
      },
      {
        ...serviceJsonLd(slug, locale),
        "@id": `${pageUrl}#service`,
        name: service.title,
        serviceType: service.title,
        category: service.title,
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${pageUrl}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: localizedUrl(locale, "/") },
          { "@type": "ListItem", position: 2, name: "ECU File Service", item: localizedUrl(locale, "/file-service") },
          { "@type": "ListItem", position: 3, name: service.title, item: pageUrl },
        ],
      },
      {
        "@type": "FAQPage",
        "@id": `${pageUrl}#faq`,
        mainEntity: service.faq.map((item) => ({
          "@type": "Question", name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      },
      ...(slug === "stage-1" ? [{
        "@type": "ItemList",
        "@id": `${pageUrl}#stage-1-technical-routes`,
        name: "Stage 1 vehicle and ECU technical guides",
        itemListElement: [...stage1BrandRoutes, ...stage1PlatformRoutes].map((item, index) => ({
          "@type": "ListItem", position: index + 1, name: item.label, url: absoluteUrl(item.href),
        })),
      }] : []),
    ],
  }, locale, scopes);

  return (
    <RuntimePublicLocalization locale={locale} scopes={scopes}>
      <main lang={hreflangByLocale[locale]} data-public-core-service={slug} className="min-h-screen bg-[#050505] text-white">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <PublicSeoHeader locale={locale} />

        <section className="border-b border-white/10 bg-[radial-gradient(ellipse_at_top_left,rgba(177,18,27,0.14),transparent_65%)]">
          <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-9 lg:px-8 lg:py-10">
            <nav aria-label="Breadcrumb" className="mb-5 flex min-w-0 flex-wrap items-center gap-2 text-xs font-bold text-zinc-400">
              <Link href={localizedPath(locale, "/")} className="hover:text-white focus-visible:outline-2 focus-visible:outline-red-400">Home</Link>
              <span aria-hidden="true">/</span>
              <Link href={localizedPath(locale, "/file-service")} className="hover:text-white focus-visible:outline-2 focus-visible:outline-red-400">ECU File Service</Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page" className="min-w-0 break-words text-zinc-300">{service.title}</span>
            </nav>
            <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)] lg:items-center">
              <div className="min-w-0">
                <div className="mb-3 inline-flex max-w-full items-center gap-2 rounded-full border border-red-800/50 bg-red-950/25 px-3 py-1.5 text-xs font-bold text-red-100">
                  <BadgeCheck className="h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
                  <span className="break-words">{service.eyebrow}</span>
                </div>
                <h1 className="max-w-3xl break-words text-[clamp(1.875rem,4vw,3.25rem)] font-black leading-[1.08] tracking-tight [overflow-wrap:anywhere]">{service.title}</h1>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-300 sm:text-base">{service.hero}</p>
                <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Link href={requestHref} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#b1121b] px-4 py-2.5 text-sm font-black text-white transition hover:bg-[#c91824] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400">
                    {slug === "stage-1" ? "Start Stage 1 Request" : "Create File Request"}
                    <ArrowRight className="ml-2 h-4 w-4 shrink-0" aria-hidden="true" />
                  </Link>
                  <Link href={registrationHref} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm font-black transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400">Create Customer Account</Link>
                </div>
              </div>
              <div className="grid min-w-0 grid-cols-2 gap-2 rounded-xl border border-white/10 bg-[#0c0c0c] p-3 sm:p-4">
                <InfoCard icon={Wrench} label="Credit price" value={<>{number.format(Number(service.credits))} {labels.credits}</>} />
                <InfoCard icon={Clock3} label="Delivery estimate" value={service.turnaround} />
                <InfoCard icon={ShieldCheck} label="File delivery" value="Secure portal" />
                <InfoCard icon={Gauge} label="Workflow" value="Tracked status" />
                <Link href={localizedPath(locale, "/#prices")} className="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-bold text-zinc-300 hover:border-red-800/60 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400">
                  {labels.navPrices}<ArrowRight className="h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {service.notice && (
          <section aria-label={service.notice.title} className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 lg:px-8">
            <div className={`flex min-w-0 items-start gap-3 rounded-lg border p-4 ${service.notice.kind === "legal" ? "border-amber-700/50 bg-amber-950/15" : "border-sky-800/50 bg-sky-950/15"}`}>
              <CircleAlert className={`mt-0.5 h-5 w-5 shrink-0 ${service.notice.kind === "legal" ? "text-amber-300" : "text-sky-300"}`} aria-hidden="true" />
              <div className="min-w-0"><h2 className="text-base font-black">{service.notice.title}</h2><p className="mt-1.5 text-sm leading-6 text-zinc-300">{service.notice.text}</p></div>
            </div>
          </section>
        )}

        <section className="mx-auto grid max-w-7xl gap-4 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[minmax(0,.95fr)_minmax(0,1.05fr)] lg:px-8">
          <div className="min-w-0 rounded-xl border border-white/10 bg-[#0c0c0c] p-4 sm:p-5">
            <h2 className="text-xl font-black">What this service is for</h2>
            <div className="mt-3 space-y-3">{service.intro.map((text) => <p key={text} className="text-sm leading-6 text-zinc-300">{text}</p>)}</div>
            <ul className="mt-4 space-y-2 border-t border-white/10 pt-4">
              {service.benefits.map((item) => <li key={item} className="flex min-w-0 gap-2.5 text-sm leading-6 text-zinc-200"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" /><span>{item}</span></li>)}
            </ul>
          </div>
          <div className="min-w-0 rounded-xl border border-red-900/40 bg-[#0c0909] p-4 sm:p-5">
            <h2 className="text-xl font-black">Professional file workflow</h2>
            <ol className="mt-4 grid gap-3 sm:grid-cols-2">
              {service.process.map((step, index) => <li key={step.title} className="min-w-0 rounded-lg border border-white/10 bg-black/30 p-3"><span className="mb-2 inline-flex h-7 min-w-7 items-center justify-center rounded-md bg-red-950/50 px-1 text-xs font-black text-red-300">{stepNumber.format(index + 1)}</span><h3 className="text-sm font-black">{step.title}</h3><p className="mt-1.5 text-sm leading-6 text-zinc-400">{step.text}</p></li>)}
            </ol>
          </div>
        </section>

        {slug === "stage-1" && <Stage1Authority locale={locale} />}
        {slug === "stage-1" && <StageComparison compact locale={locale} />}

        <section className="border-y border-white/10 bg-[#090909]">
          <div className="mx-auto grid max-w-7xl gap-4 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)_minmax(0,.9fr)] lg:px-8">
            <ListPanel title="Supported vehicle focus" items={service.supported} icon={Car} locale={locale} />
            <ListPanel title="Information needed" items={service.required} icon={FileCode2} locale={locale} />
            <div className="min-w-0 rounded-xl border border-red-900/40 bg-red-950/10 p-4 sm:p-5">
              <Upload className="mb-3 h-5 w-5 text-red-400" aria-hidden="true" /><h2 className="text-xl font-black">Ready to submit?</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-300">Create an account, buy credits and submit the original file with vehicle details. The request can then be tracked from the customer dashboard.</p>
              <Link href={requestHref} className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[#b1121b] px-3 py-2.5 text-sm font-black transition hover:bg-[#c91824] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400">Start Secure Request<ArrowRight className="ml-2 h-4 w-4 shrink-0" aria-hidden="true" /></Link>
            </div>
          </div>
        </section>

        <section aria-labelledby="core-service-faq-heading" className="mx-auto max-w-5xl px-4 py-7 sm:px-6 sm:py-9">
          <div className="mb-4 flex flex-wrap items-baseline gap-3"><span className="text-xs font-black uppercase tracking-wider text-red-400">FAQ</span><h2 id="core-service-faq-heading" className="text-2xl font-black">Common questions</h2></div>
          <div className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-[#0c0c0c]">
            {service.faq.map((item, index) => <details key={item.q} open={index === 0} className="group"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-zinc-100 transition hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-red-400 [&::-webkit-details-marker]:hidden"><span className="min-w-0">{item.q}</span><ChevronDown className="h-4 w-4 shrink-0 text-red-400 transition group-open:rotate-180" aria-hidden="true" /></summary><p className="px-4 pb-4 text-sm leading-6 text-zinc-300">{item.a}</p></details>)}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-7 sm:px-6 sm:pb-9 lg:px-8">
          <h2 className="text-lg font-black">{labels.navServices}</h2>
          <nav aria-label="Services" className="mt-3 flex flex-wrap gap-2">
            {publicServiceSlugs.filter((item) => item !== slug).map((relatedSlug) => <Link key={relatedSlug} href={localizedPath(locale, `/services/${relatedSlug}`)} className="inline-flex min-h-11 max-w-full items-center rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-bold text-zinc-300 hover:border-red-800/60 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"><span className="min-w-0 break-words">{getServiceSeo(relatedSlug, locale).name}</span><ArrowRight className="ml-2 h-4 w-4 shrink-0 text-red-400" aria-hidden="true" /></Link>)}
          </nav>
        </section>
        <RuntimePublicFooter locale={locale} scopes={scopes} />
        <OnlineStatus />
      </main>
    </RuntimePublicLocalization>
  );
}

function InfoCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: ReactNode }) {
  return <div className="min-w-0 rounded-lg border border-white/10 bg-black/25 p-3"><div className="flex items-center gap-2"><Icon className="h-4 w-4 shrink-0 text-red-400" aria-hidden="true" /><span className="min-w-0 text-xs font-bold text-zinc-400">{label}</span></div><div className="mt-2 break-words text-sm font-bold leading-6 text-white [overflow-wrap:anywhere]">{value}</div></div>;
}

function ListPanel({ title, items, icon: Icon, locale }: { title: string; items: string[]; icon: LucideIcon; locale: LocaleCode }) {
  return <RuntimePublicLocalization locale={locale} scopes={scopes}><div className="min-w-0 rounded-xl border border-white/10 bg-[#0c0c0c] p-4 sm:p-5"><div className="flex items-center gap-2.5"><Icon className="h-5 w-5 shrink-0 text-red-400" aria-hidden="true" /><h2 className="text-lg font-black">{title}</h2></div><ul className="mt-3 space-y-2">{items.map((item) => <li key={item} className="flex min-w-0 gap-2 text-sm leading-6 text-zinc-300"><CheckCircle2 className="mt-1 h-3.5 w-3.5 shrink-0 text-red-400" aria-hidden="true" /><span className="break-words">{item}</span></li>)}</ul></div></RuntimePublicLocalization>;
}
