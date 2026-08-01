import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Cpu,
  FileCode2,
  Gauge,
  LayoutDashboard,
  Search,
  ShieldCheck,
  Upload,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { LocalizedSeoFooter } from "@/components/LocalizedSeoFooter";
import { OnlineStatus } from "@/components/OnlineStatus";
import { getFileServiceCopy, fileServiceJsonLd } from "@/lib/fileServiceI18n";
import type { FileServiceHubCard } from "@/lib/fileServiceI18n";
import type { LocaleCode } from "@/lib/i18nConfig";
import {
  absoluteUrl,
  hreflangByLocale,
  isPublicServiceSlug,
  isSeoLocale,
  languageAlternates,
  localizedPath,
  localizedUrl,
  organizationJsonLd,
  seoLocales,
  siteName,
  websiteJsonLd,
} from "@/lib/seo";

const categoryIcons: LucideIcon[] = [Gauge, Wrench, FileCode2];
const resourceIcons: LucideIcon[] = [BadgeCheck, Cpu, Gauge, ShieldCheck];
const workflowIcons: LucideIcon[] = [Search, BadgeCheck, Upload, LayoutDashboard];

export function generateStaticParams() {
  return seoLocales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: inputLocale } = await params;

  if (!isSeoLocale(inputLocale)) return {};

  const locale = inputLocale as LocaleCode;
  const copy = getFileServiceCopy(locale);
  const pageUrl = localizedUrl(locale, "/file-service");

  return {
    title: `${copy.pageTitle} | MG AutoTech`,
    description: copy.description,
    alternates: {
      canonical: pageUrl,
      languages: languageAlternates("/file-service"),
    },
    openGraph: {
      title: `${copy.pageTitle} | MG AutoTech`,
      description: copy.description,
      url: pageUrl,
      siteName,
      locale: hreflangByLocale[locale],
      alternateLocale: seoLocales
        .filter((item) => item !== locale)
        .map((item) => hreflangByLocale[item]),
      type: "website",
      images: [
        {
          url: absoluteUrl("/opengraph-image"),
          width: 1200,
          height: 630,
          alt: `${copy.pageTitle} - MG AutoTech`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${copy.pageTitle} | MG AutoTech`,
      description: copy.description,
      images: [absoluteUrl("/opengraph-image")],
    },
  };
}

function resolvePublicHref(locale: LocaleCode, href: string) {
  const [segment, slug] = href.split("/").filter(Boolean);

  if (href === "/file-service" || href === "/how-it-works") {
    return localizedPath(locale, href);
  }

  if (segment === "services" && slug && isPublicServiceSlug(slug)) {
    return localizedPath(locale, href);
  }

  return href;
}

function HubLinkCard({
  item,
  icon: Icon,
  locale,
  light = false,
}: {
  item: FileServiceHubCard;
  icon: LucideIcon;
  locale: LocaleCode;
  light?: boolean;
}) {
  return (
    <Link
      href={resolvePublicHref(locale, item.href)}
      className={
        light
          ? "group flex h-full flex-col rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-black/5 transition duration-300 hover:-translate-y-1 hover:border-red-200 hover:shadow-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700"
          : "group flex h-full flex-col rounded-3xl border border-white/10 bg-white/[0.045] p-6 transition duration-300 hover:-translate-y-1 hover:border-red-700/70 hover:bg-white/[0.075] focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700"
      }
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div
          className={
            light
              ? "flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-700"
              : "flex h-12 w-12 items-center justify-center rounded-2xl border border-red-900/50 bg-red-950/25 text-red-300"
          }
        >
          <Icon className="h-6 w-6" />
        </div>
        <span
          className={
            light
              ? "rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-zinc-500"
              : "rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-zinc-400"
          }
        >
          {item.tag}
        </span>
      </div>
      <h3 className={light ? "text-xl font-black text-[#111827]" : "text-xl font-black text-white"}>
        {item.title}
      </h3>
      <p className={light ? "mt-3 flex-1 text-sm leading-7 text-zinc-600" : "mt-3 flex-1 text-sm leading-7 text-zinc-400"}>
        {item.text}
      </p>
      <span
        className={
          light
            ? "mt-6 inline-flex items-center text-sm font-black text-red-700 transition group-hover:text-red-900"
            : "mt-6 inline-flex items-center text-sm font-black text-red-300 transition group-hover:text-red-100"
        }
      >
        {item.action}
        <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-1" />
      </span>
    </Link>
  );
}

export default async function LocalizedFileServicePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: inputLocale } = await params;

  if (!isSeoLocale(inputLocale)) notFound();

  const locale = inputLocale as LocaleCode;
  const copy = getFileServiceCopy(locale);
  const pageUrl = localizedUrl(locale, "/file-service");
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [organizationJsonLd(), websiteJsonLd(locale), ...fileServiceJsonLd(locale, pageUrl)],
  };

  return (
    <main className="min-h-screen bg-[#050505] text-white" lang={hreflangByLocale[locale]}>
      <header className="border-b border-white/10 bg-[#050505]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <Link href={localizedPath(locale, "/")} className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#b1121b] text-sm font-black text-white">
              MG
            </div>
            <div>
              <div className="text-sm font-black uppercase tracking-[0.22em] text-white">
                MG AutoTech
              </div>
              <div className="text-xs font-semibold text-zinc-400">
                {copy.nav.fileService}
              </div>
            </div>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-bold text-zinc-300 md:flex">
            <Link href={localizedPath(locale, "/file-service")} className="text-white">
              {copy.nav.fileService}
            </Link>
            <Link href={localizedPath(locale, "/services/stage-1")} className="transition hover:text-white">
              {copy.nav.services}
            </Link>
            <Link href={localizedPath(locale, "/how-it-works")} className="transition hover:text-white">
              {copy.nav.howItWorks}
            </Link>
            <Link href="/login" className="transition hover:text-white">
              {copy.nav.login}
            </Link>
          </nav>
          <Link
            href="/new-request"
            className="inline-flex items-center justify-center rounded-xl bg-[#b1121b] px-4 py-3 text-sm font-black text-white shadow-lg shadow-red-950/25 transition hover:bg-[#c91824]"
          >
            {copy.nav.startRequest}
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-white/10 bg-[linear-gradient(135deg,#050505,#101827_52%,#2b080d)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_10%,rgba(177,18,27,0.32),transparent_30%),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:auto,56px_56px,56px_56px]" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
          <div>
            <div className="inline-flex rounded-full border border-red-700/60 bg-red-950/35 px-4 py-2 text-sm font-black uppercase tracking-[0.18em] text-red-100">
              {copy.eyebrow}
            </div>
            <h1 className="mt-6 max-w-5xl text-5xl font-black leading-tight md:text-7xl">
              {copy.title}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-zinc-300">
              {copy.intro}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/new-request"
                className="inline-flex items-center justify-center rounded-xl bg-[#b1121b] px-6 py-4 text-sm font-black text-white shadow-lg shadow-red-950/30 transition hover:-translate-y-0.5 hover:bg-[#c91824]"
              >
                {copy.primaryCta}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                href={localizedPath(locale, "/how-it-works")}
                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] px-6 py-4 text-sm font-black text-white transition hover:-translate-y-0.5 hover:border-red-800/60 hover:bg-red-950/20"
              >
                {copy.secondaryCta}
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-black/35 p-6 shadow-2xl shadow-black/40">
            <div className="mb-6 text-sm font-black uppercase tracking-[0.2em] text-red-300">
              {copy.safetyKicker}
            </div>
            <div className="space-y-3">
              {copy.safetyBoundaries.map((item) => (
                <div
                  key={item}
                  className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-sm leading-6 text-zinc-300"
                >
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#080b10] py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-10 max-w-3xl">
            <div className="text-sm font-black uppercase tracking-[0.25em] text-red-500">
              {copy.categoriesKicker}
            </div>
            <h2 className="mt-3 text-4xl font-black md:text-5xl">
              {copy.categoriesTitle}
            </h2>
            <p className="mt-4 text-sm leading-7 text-zinc-400">
              {copy.categoriesText}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {copy.serviceCategories.map((item, index) => (
              <HubLinkCard
                key={item.title}
                item={item}
                icon={categoryIcons[index] ?? FileCode2}
                locale={locale}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-[linear-gradient(135deg,#101827,#07090d)] py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-10 grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <div className="text-sm font-black uppercase tracking-[0.25em] text-red-500">
                {copy.workflowKicker}
              </div>
              <h2 className="mt-3 text-4xl font-black md:text-5xl">
                {copy.workflowTitle}
              </h2>
            </div>
            <p className="max-w-3xl text-sm leading-7 text-zinc-400">
              {copy.workflowText}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            {copy.workflowSteps.map((step, index) => {
              const Icon = workflowIcons[index] ?? BadgeCheck;

              return (
                <article key={step.title} className="rounded-3xl border border-white/10 bg-white/[0.045] p-6">
                  <div className="mb-5 flex items-center justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-900/50 bg-red-950/25 text-red-300">
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="text-sm font-black text-zinc-500">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="text-xl font-black">{step.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-zinc-400">
                    {step.text}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-[#eef1f4] py-20 text-[#111827]">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-10 max-w-3xl">
            <div className="text-sm font-black uppercase tracking-[0.25em] text-red-700">
              {copy.resourcesKicker}
            </div>
            <h2 className="mt-3 text-4xl font-black md:text-5xl">
              {copy.resourcesTitle}
            </h2>
            <p className="mt-4 text-sm leading-7 text-zinc-600">
              {copy.resourcesText}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {copy.linkedResources.map((resource, index) => (
              <HubLinkCard
                key={resource.title}
                item={resource}
                icon={resourceIcons[index] ?? ShieldCheck}
                locale={locale}
                light
              />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#050505] py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-10 max-w-3xl">
            <div className="text-sm font-black uppercase tracking-[0.25em] text-red-500">
              {copy.faqKicker}
            </div>
            <h2 className="mt-3 text-4xl font-black md:text-5xl">
              {copy.faqTitle}
            </h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {copy.faq.map((item) => (
              <article key={item.question} className="rounded-3xl border border-white/10 bg-white/[0.045] p-6">
                <h3 className="text-xl font-black">{item.question}</h3>
                <p className="mt-4 text-sm leading-7 text-zinc-400">
                  {item.answer}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#b1121b] py-16">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-4xl font-black">{copy.finalTitle}</h2>
            <p className="mt-3 max-w-2xl text-red-100">{copy.finalText}</p>
          </div>
          <Link
            href="/new-request"
            className="inline-flex items-center rounded-xl bg-white px-7 py-4 font-black text-[#b1121b] transition duration-300 hover:-translate-y-1 hover:bg-zinc-100"
          >
            {copy.primaryCta}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      </section>

      <LocalizedSeoFooter locale={locale} />
      <OnlineStatus />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </main>
  );
}
