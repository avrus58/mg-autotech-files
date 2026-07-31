import type { Metadata } from "next";
import Link from "next/link";
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
import { Footer } from "@/components/Footer";
import { OnlineStatus } from "@/components/OnlineStatus";
import { PublicSeoHeader } from "@/components/PublicSeoHeader";
import { absoluteUrl, languageAlternates, organizationJsonLd, siteName, websiteJsonLd } from "@/lib/seo";

const pageTitle = "ECU & TCU File Service Hub";
const pageDescription =
  "Professional ECU and TCU file service workflow for workshops: secure request preparation, original file submission, service selection, order tracking and portal delivery.";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: {
    canonical: absoluteUrl("/file-service"),
    languages: languageAlternates("/file-service"),
  },
  openGraph: {
    title: `${pageTitle} | MG AutoTech`,
    description: pageDescription,
    url: absoluteUrl("/file-service"),
    siteName,
    type: "website",
    images: [
      {
        url: absoluteUrl("/opengraph-image"),
        width: 1200,
        height: 630,
        alt: "MG AutoTech ECU and TCU file service hub",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${pageTitle} | MG AutoTech`,
    description: pageDescription,
    images: [absoluteUrl("/opengraph-image")],
  },
};

type HubCard = {
  title: string;
  text: string;
  href: string;
  action: string;
  icon: LucideIcon;
  tag: string;
};

const fileServiceCategories: HubCard[] = [
  {
    title: "ECU File Service",
    text: "A structured request path for engine-control files with vehicle details, service choice and private dashboard status.",
    href: "/new-request",
    action: "Start ECU request",
    icon: Cpu,
    tag: "ECU",
  },
  {
    title: "TCU File Service",
    text: "Transmission-controller requests stay organized with gearbox context, controller notes and clear review status.",
    href: "/services/tcu-tuning",
    action: "View TCU service",
    icon: FileCode2,
    tag: "TCU",
  },
  {
    title: "Stage 1 File Service",
    text: "Performance requests can be prepared with engine, controller, read-method and original-file context before submission.",
    href: "/services/stage-1",
    action: "View Stage 1",
    icon: Gauge,
    tag: "Performance",
  },
  {
    title: "Diesel & Diagnostic File Requests",
    text: "DPF, EGR, AdBlue and DTC request types are separated so the selected service and notes stay easy to review.",
    href: "/services/dpf-off",
    action: "View request types",
    icon: Wrench,
    tag: "Request categories",
  },
];

const workflowSteps = [
  {
    title: "Prepare the request",
    text: "Confirm vehicle, engine, ECU or TCU context, read method and the requested service before opening the portal flow.",
    icon: Search,
  },
  {
    title: "Submit through the portal",
    text: "Customers create the request from their own account so access, credits, status and delivery stay attached to the order.",
    icon: Upload,
  },
  {
    title: "Technical review",
    text: "MG AutoTech can review the selected service, notes and file context before the request moves forward.",
    icon: ShieldCheck,
  },
  {
    title: "Track and download",
    text: "Customer-visible messages, status changes and completed file delivery stay inside the private dashboard.",
    icon: LayoutDashboard,
  },
];

const linkedResources: HubCard[] = [
  {
    title: "How It Works",
    text: "Understand the customer journey from account creation to delivery.",
    href: "/how-it-works",
    action: "See workflow",
    icon: BadgeCheck,
    tag: "Process",
  },
  {
    title: "File Readiness Check",
    text: "Check whether the basic request context is ready before submission.",
    href: "/tools/file-readiness-check",
    action: "Check readiness",
    icon: ShieldCheck,
    tag: "Tool",
  },
  {
    title: "Request Brief Builder",
    text: "Create a clean technical note for the customer request form.",
    href: "/tools/request-brief-builder",
    action: "Build brief",
    icon: FileCode2,
    tag: "Tool",
  },
  {
    title: "Vehicle Brands",
    text: "Browse brand-specific request preparation guides.",
    href: "/brands",
    action: "Open brands",
    icon: Cpu,
    tag: "Coverage",
  },
  {
    title: "ECU Platforms",
    text: "Review platform guides for common ECU and TCU families.",
    href: "/ecu-platforms",
    action: "Open platforms",
    icon: Gauge,
    tag: "Technical guide",
  },
  {
    title: "Stage 1 Service",
    text: "Read the dedicated public service page for performance requests.",
    href: "/services/stage-1",
    action: "View service",
    icon: Wrench,
    tag: "Service",
  },
  {
    title: "Stage 2 Service",
    text: "Prepare modified-vehicle requests with exact hardware, ECU and drivetrain context.",
    href: "/services/stage-2",
    action: "View Stage 2",
    icon: Gauge,
    tag: "Service",
  },
  {
    title: "ECU File Check",
    text: "Review source-file identity, read coverage and original-file context before the next step.",
    href: "/services/ecu-file-check",
    action: "View file check",
    icon: Search,
    tag: "Verification",
  },
];

const safetyBoundaries = [
  "This public hub does not read or inspect customer files.",
  "File submission starts only inside the authenticated customer request flow.",
  "Private order details remain inside the customer dashboard.",
  "Unclear or complex requests stay review-first before delivery.",
];

const fileServiceFaq = [
  {
    question: "What is an ECU file service?",
    answer:
      "An ECU file service is a structured workflow where the customer provides the vehicle context, selected service and original controller file through a secure request process. MG AutoTech keeps the request status and delivery inside the customer portal.",
  },
  {
    question: "What is a TCU file service?",
    answer:
      "A TCU file service focuses on transmission-controller requests. The request should include gearbox or controller context, vehicle information, selected service and clear technical notes for review.",
  },
  {
    question: "Does this public page upload or modify files?",
    answer:
      "No. This page is a public guide and resource hub. File submission is available only after login through the secure customer request flow.",
  },
  {
    question: "What should a workshop prepare before creating a request?",
    answer:
      "Prepare the vehicle brand, model, engine, ECU or TCU information when available, read method, desired service and a short technical note. The public preparation tools can help organize this information.",
  },
];

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "@id": absoluteUrl("/file-service#breadcrumb"),
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: absoluteUrl("/"),
    },
    {
      "@type": "ListItem",
      position: 2,
      name: pageTitle,
      item: absoluteUrl("/file-service"),
    },
  ],
};

const serviceJsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  "@id": absoluteUrl("/file-service#service"),
  name: "MG AutoTech ECU and TCU File Service",
  serviceType: [
    "ECU file service",
    "TCU file service",
    "Stage 1 file service",
    "DPF, EGR, AdBlue and DTC file requests",
  ],
  description: pageDescription,
  provider: { "@id": absoluteUrl("/#organization") },
  areaServed: {
    "@type": "Place",
    name: "Europe",
  },
  audience: {
    "@type": "Audience",
    audienceType: "Workshops, tuning professionals and vehicle owners",
  },
  url: absoluteUrl("/file-service"),
  mainEntityOfPage: { "@id": absoluteUrl("/file-service#page") },
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "MG AutoTech file service request categories",
    itemListElement: fileServiceCategories.map((category, index) => ({
      "@type": "Offer",
      position: index + 1,
      itemOffered: {
        "@type": "Service",
        name: category.title,
        serviceType: category.tag,
        description: category.text,
        url: absoluteUrl(category.href),
        provider: { "@id": absoluteUrl("/#organization") },
      },
    })),
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": absoluteUrl("/file-service#faq"),
  mainEntity: fileServiceFaq.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
};

const resourceItemListJsonLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  "@id": absoluteUrl("/file-service#resources"),
  name: "MG AutoTech file service resources",
  itemListElement: linkedResources.map((resource, index) => ({
    "@type": "ListItem",
    position: index + 1,
    item: {
      "@type": "WebPage",
      name: resource.title,
      description: resource.text,
      url: absoluteUrl(resource.href),
    },
  })),
};

const pageJsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "@id": absoluteUrl("/file-service#page"),
  name: pageTitle,
  description: pageDescription,
  url: absoluteUrl("/file-service"),
  inLanguage: "en",
  isPartOf: { "@id": absoluteUrl("/#website") },
  about: { "@id": absoluteUrl("/#organization") },
  mainEntity: { "@id": absoluteUrl("/file-service#service") },
  hasPart: [
    { "@id": absoluteUrl("/file-service#service") },
    { "@id": absoluteUrl("/file-service#faq") },
    { "@id": absoluteUrl("/file-service#resources") },
  ],
};

const jsonLd = [
  organizationJsonLd(),
  websiteJsonLd("en"),
  breadcrumbJsonLd,
  pageJsonLd,
  serviceJsonLd,
  faqJsonLd,
  resourceItemListJsonLd,
];

function ResourceCard({ item }: { item: HubCard }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className="group flex h-full flex-col rounded-3xl border border-white/10 bg-white/[0.045] p-6 transition duration-300 hover:-translate-y-1 hover:border-red-700/70 hover:bg-white/[0.075] focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700"
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-900/50 bg-red-950/25 text-red-300">
          <Icon className="h-6 w-6" />
        </div>
        <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-zinc-400">
          {item.tag}
        </span>
      </div>
      <h3 className="text-xl font-black text-white">{item.title}</h3>
      <p className="mt-3 flex-1 text-sm leading-7 text-zinc-400">{item.text}</p>
      <span className="mt-6 inline-flex items-center text-sm font-black text-red-300 transition group-hover:text-red-100">
        {item.action}
        <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-1" />
      </span>
    </Link>
  );
}

export default function FileServicePage() {
  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <PublicSeoHeader />

      <section className="relative overflow-hidden border-b border-white/10 bg-[linear-gradient(135deg,#050505,#101827_52%,#2b080d)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_10%,rgba(177,18,27,0.32),transparent_30%),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:auto,56px_56px,56px_56px]" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
          <div>
            <div className="inline-flex rounded-full border border-red-700/60 bg-red-950/35 px-4 py-2 text-sm font-black uppercase tracking-[0.18em] text-red-100">
              ECU / TCU File Service Hub
            </div>
            <h1 className="mt-6 max-w-4xl text-5xl font-black leading-tight md:text-7xl">
              Professional ECU & TCU file service workflow.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-zinc-300">
              A single customer-safe hub for file service requests: prepare the
              vehicle context, understand the service path, use public workshop
              tools and submit through the secure MG AutoTech portal.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/new-request"
                className="inline-flex items-center justify-center rounded-xl bg-[#b1121b] px-6 py-4 text-sm font-black text-white shadow-lg shadow-red-950/30 transition hover:-translate-y-0.5 hover:bg-[#c91824]"
              >
                Start secure request
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                href="/tools/request-brief-builder"
                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] px-6 py-4 text-sm font-black text-white transition hover:-translate-y-0.5 hover:border-red-800/60 hover:bg-red-950/20"
              >
                Prepare request brief
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-black/35 p-6 shadow-2xl shadow-black/40">
            <div className="mb-6 text-sm font-black uppercase tracking-[0.2em] text-red-300">
              Request foundation
            </div>
            <div className="space-y-3">
              {safetyBoundaries.map((item) => (
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
              Service categories
            </div>
            <h2 className="mt-3 text-4xl font-black md:text-5xl">
              File service requests stay structured from the first click.
            </h2>
            <p className="mt-4 text-sm leading-7 text-zinc-400">
              Customers can move from broad search intent to the correct MG
              AutoTech flow without mixing service pages, platform guides and
              secure request actions.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {fileServiceCategories.map((item) => (
              <ResourceCard key={item.title} item={item} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-[linear-gradient(135deg,#101827,#07090d)] py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-10 grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <div className="text-sm font-black uppercase tracking-[0.25em] text-red-500">
                Workflow
              </div>
              <h2 className="mt-3 text-4xl font-black md:text-5xl">
                From file-service search to dashboard delivery.
              </h2>
            </div>
            <p className="max-w-3xl text-sm leading-7 text-zinc-400">
              The public hub explains the path. The authenticated portal handles
              the actual request, account ownership, credit verification and
              delivery status.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            {workflowSteps.map((step, index) => {
              const Icon = step.icon;

              return (
                <article
                  key={step.title}
                  className="rounded-3xl border border-white/10 bg-white/[0.045] p-6"
                >
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
              Resource map
            </div>
            <h2 className="mt-3 text-4xl font-black md:text-5xl">
              The fastest path to the right MG AutoTech page.
            </h2>
            <p className="mt-4 text-sm leading-7 text-zinc-600">
              The hub connects public education, preparation tools, brand guides,
              controller-family context and the secure request action.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {linkedResources.map((resource) => {
              const Icon = resource.icon;

              return (
                <Link
                  key={resource.title}
                  href={resource.href}
                  className="group rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-black/5 transition duration-300 hover:-translate-y-1 hover:border-red-200 hover:shadow-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700"
                >
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-700">
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
                      {resource.tag}
                    </span>
                  </div>
                  <h3 className="text-xl font-black">{resource.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-zinc-600">
                    {resource.text}
                  </p>
                  <span className="mt-6 inline-flex items-center text-sm font-black text-red-700 transition group-hover:text-red-900">
                    {resource.action}
                    <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-1" />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-[#050505] py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-10 max-w-3xl">
            <div className="text-sm font-black uppercase tracking-[0.25em] text-red-500">
              FAQ
            </div>
            <h2 className="mt-3 text-4xl font-black md:text-5xl">
              ECU and TCU file service questions.
            </h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {fileServiceFaq.map((item) => (
              <article
                key={item.question}
                className="rounded-3xl border border-white/10 bg-white/[0.045] p-6"
              >
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
            <h2 className="text-4xl font-black">
              Ready to create a file-service request?
            </h2>
            <p className="mt-3 text-red-100">
              Use the secure customer portal when the vehicle context and service
              details are ready.
            </p>
          </div>
          <Link
            href="/new-request"
            className="inline-flex items-center rounded-xl bg-white px-7 py-4 font-black text-[#b1121b] transition duration-300 hover:-translate-y-1 hover:bg-zinc-100"
          >
            Start request
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      </section>

      <Footer />
      <OnlineStatus />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </main>
  );
}
