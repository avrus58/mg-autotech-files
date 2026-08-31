import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  FileCheck2,
  Layers3,
  ShieldCheck,
} from "lucide-react";
import { PublicSeoHeader } from "@/components/PublicSeoHeader";
import { RuntimePublicFooter } from "@/components/RuntimePublicFooter";
import { RuntimePublicLocalization } from "@/components/RuntimePublicLocalization";
import { StageComparison } from "@/components/StageComparison";
import {
  absoluteUrl,
  organizationJsonLd,
  websiteJsonLd,
} from "@/lib/seo";
import type { ServiceIntentGuide } from "@/lib/serviceIntentGuides";
import {
  localizeRuntimePublicJsonLd,
  runtimePublicInLanguage,
} from "@/lib/i18n/runtime-public";
import type { LocaleCode } from "@/lib/i18nConfig";
import {
  buildNewRequestPath,
  getPublicServiceRequestIntent,
} from "@/lib/requestIntent";

export function ServiceIntentPage({
  guide,
  locale = "en",
}: {
  guide: ServiceIntentGuide;
  locale?: LocaleCode;
}) {
  const pageUrl = absoluteUrl(`/services/${guide.slug}`);
  const requestHref = buildNewRequestPath(
    getPublicServiceRequestIntent(guide.slug)
  );
  const scopes = ["core", "services", "service-intent"] as const;
  const jsonLd = localizeRuntimePublicJsonLd({
    "@context": "https://schema.org",
    "@graph": [
      organizationJsonLd(locale),
      websiteJsonLd(locale),
      {
        "@type": "WebPage",
        "@id": `${pageUrl}#page`,
        name: guide.metaTitle,
        description: guide.description,
        url: pageUrl,
        inLanguage: runtimePublicInLanguage(locale),
        datePublished: guide.publishedAt,
        dateModified: guide.updatedAt,
        isPartOf: { "@id": `${absoluteUrl("/services")}#page` },
        about: { "@id": `${pageUrl}#service` },
        breadcrumb: { "@id": `${pageUrl}#breadcrumb` },
      },
      {
        "@type": "Service",
        "@id": `${pageUrl}#service`,
        name: guide.name,
        description: guide.description,
        serviceType: guide.name,
        provider: { "@id": `${absoluteUrl("/")}#organization` },
        audience: {
          "@type": "BusinessAudience",
          audienceType: "Automotive workshops and tuning professionals",
        },
        areaServed: ["Germany", "Europe"],
        url: pageUrl,
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${pageUrl}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: "Services", item: absoluteUrl("/services") },
          { "@type": "ListItem", position: 3, name: guide.name, item: pageUrl },
        ],
      },
      {
        "@type": "ItemList",
        "@id": `${pageUrl}#requirements`,
        name: `${guide.name} request requirements`,
        itemListElement: guide.requiredInputs.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item,
        })),
      },
      {
        "@type": "FAQPage",
        "@id": `${pageUrl}#faq`,
        mainEntity: guide.faq.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.a,
          },
        })),
      },
    ],
  }, locale, scopes);

  return (
    <RuntimePublicLocalization locale={locale} scopes={scopes}>
      <main className="min-h-screen overflow-x-hidden bg-[#050505] text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PublicSeoHeader locale={locale} />

      <section className="border-b border-white/10 bg-[radial-gradient(circle_at_78%_18%,rgba(177,18,27,0.22),transparent_28%),#050505]">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,.65fr)] lg:items-end lg:py-20">
          <div className="min-w-0">
            <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-2 text-xs font-bold text-zinc-500">
              <Link href="/" className="transition hover:text-white">Home</Link>
              <span aria-hidden="true">/</span>
              <Link href="/file-service" className="transition hover:text-white">ECU File Service</Link>
              <span aria-hidden="true">/</span>
              <span className="text-zinc-300" aria-current="page">{guide.name}</span>
            </nav>
            <p className="inline-flex items-center gap-2 rounded-full border border-red-800/50 bg-red-950/25 px-4 py-2 text-xs font-black uppercase tracking-normal text-red-100">
              <BadgeCheck className="h-4 w-4 text-red-400" aria-hidden="true" />
              {guide.eyebrow}
            </p>
            <h1 className="mt-6 max-w-5xl text-[clamp(2.5rem,7vw,5.4rem)] font-black leading-[0.98] [overflow-wrap:anywhere]">
              {guide.heroTitle}
            </h1>
            <p className="mt-6 max-w-3xl text-base leading-8 text-zinc-300 sm:text-lg">{guide.lead}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={requestHref} className="inline-flex items-center justify-center rounded-lg bg-[#b1121b] px-6 py-4 text-sm font-black transition hover:bg-[#c91824] focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500">
                Create file request<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/services" className="inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/[0.04] px-6 py-4 text-sm font-black transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500">
                Compare all services
              </Link>
            </div>
          </div>

          <aside className="border-l-2 border-red-700 bg-black/25 p-6" aria-label="Service review boundary">
            <CircleAlert className="h-6 w-6 text-amber-300" aria-hidden="true" />
            <p className="mt-4 text-xs font-black uppercase tracking-normal text-red-300">Review-first boundary</p>
            <h2 className="mt-2 text-2xl font-black">Compatibility is confirmed per request.</h2>
            <p className="mt-3 text-sm leading-7 text-zinc-400">
              This public page does not inspect, upload, modify or approve a controller file. Exact support depends on the submitted identity, source file and workshop context.
            </p>
          </aside>
        </div>
      </section>

      {(guide.slug === "stage-2" || guide.slug === "stage-3") && (
        <StageComparison compact locale={locale} />
      )}

      <section className="border-b border-white/10 bg-[#090a0c]">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 lg:grid-cols-2 lg:py-18">
          <div>
            <p className="text-xs font-black uppercase tracking-normal text-red-400">When this route fits</p>
            <h2 className="mt-3 text-3xl font-black">Start with evidence, not assumptions.</h2>
            <div className="mt-7 divide-y divide-white/10 border-y border-white/10">
              {guide.fitSignals.map((item) => (
                <div key={item} className="flex gap-3 py-4 text-sm leading-7 text-zinc-300">
                  <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-400" aria-hidden="true" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-normal text-red-400">Required request context</p>
            <h2 className="mt-3 text-3xl font-black">What the workshop should prepare.</h2>
            <ol className="mt-7 grid gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-2">
              {guide.requiredInputs.map((item, index) => (
                <li key={item} className="flex min-w-0 gap-3 bg-[#0b0c0e] p-4 text-sm leading-6 text-zinc-300">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-red-950/60 text-xs font-black text-red-200">{index + 1}</span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#050505]">
        <div className="mx-auto max-w-7xl px-4 py-14 lg:py-18">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-normal text-red-400">Technical review gates</p>
            <h2 className="mt-3 text-3xl font-black sm:text-4xl">Three checks keep the request precise.</h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {guide.reviewChecks.map((check, index) => (
              <article key={check.title} className="border-t-2 border-red-800 bg-[#0b0c0e] p-6">
                <div className="flex items-center justify-between gap-3">
                  <ShieldCheck className="h-6 w-6 text-red-400" aria-hidden="true" />
                  <span className="text-xs font-black text-zinc-700">0{index + 1}</span>
                </div>
                <h3 className="mt-6 text-xl font-black">{check.title}</h3>
                <p className="mt-3 text-sm leading-7 text-zinc-400">{check.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#090a0c]">
        <div className="mx-auto max-w-7xl px-4 py-14 lg:py-18">
          <div className="grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)]">
            <div>
              <Layers3 className="h-7 w-7 text-red-500" aria-hidden="true" />
              <p className="mt-5 text-xs font-black uppercase tracking-normal text-red-400">Secure workflow</p>
              <h2 className="mt-3 text-3xl font-black">From workshop brief to tracked request.</h2>
            </div>
            <ol className="grid gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-2">
              {guide.workflow.map((step, index) => (
                <li key={step.title} className="bg-[#0b0c0e] p-5">
                  <div className="text-xs font-black uppercase tracking-normal text-red-400">Step {index + 1}</div>
                  <h3 className="mt-3 text-lg font-black">{step.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-zinc-400">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#050505]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 lg:grid-cols-[300px_minmax(0,1fr)] lg:py-18">
          <div>
            <ClipboardCheck className="h-7 w-7 text-red-500" aria-hidden="true" />
            <p className="mt-5 text-xs font-black uppercase tracking-normal text-red-400">Questions before submission</p>
            <h2 className="mt-3 text-3xl font-black">Service-specific answers.</h2>
          </div>
          <div className="divide-y divide-white/10 border-y border-white/10">
            {guide.faq.map((item, index) => (
              <details key={item.q} className="group py-5" open={index === 0}>
                <summary className="flex cursor-pointer list-none items-start justify-between gap-5 font-black marker:content-none">
                  <span>{item.q}</span>
                  <span className="text-red-400 transition group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#090a0c]">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <div className="flex flex-col justify-between gap-6 border-b border-white/10 pb-8 md:flex-row md:items-end">
            <div>
              <FileCheck2 className="h-6 w-6 text-red-500" aria-hidden="true" />
              <p className="mt-4 text-xs font-black uppercase tracking-normal text-zinc-500">Published by MG AutoTech</p>
              <h2 className="mt-2 text-2xl font-black">Related workshop routes</h2>
              <p className="mt-2 text-sm text-zinc-500">
                <span>Updated</span>{" "}
                <time dateTime={guide.updatedAt} translate="no" data-no-translate>
                  {guide.updatedAt}
                </time>
                .{" "}
                <span>Public guidance only; secure handling remains account-based.</span>
              </p>
            </div>
            <Link href="/about" className="inline-flex items-center text-sm font-black text-red-300 hover:text-red-200">
              About MG AutoTech<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            {guide.related.map((item) => (
              <Link key={item.href} href={item.href} className="inline-flex items-center rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-zinc-200 transition hover:border-red-800/60 hover:text-white">
                {item.label}<ArrowRight className="ml-2 h-4 w-4 text-red-500" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <RuntimePublicFooter locale={locale} scopes={scopes} />
      </main>
    </RuntimePublicLocalization>
  );
}
