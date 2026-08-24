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
import { StageComparison } from "@/components/StageComparison";
import { brandGuides } from "@/lib/industry-content";
import { absoluteUrl, languageAlternates, organizationJsonLd, siteName, websiteJsonLd } from "@/lib/seo";

const pageTitle = "Online ECU File Service for Custom ECU & TCU Tuning Files";
const pageDescription =
  "Online ECU and TCU file service for workshops: vehicle-specific Stage 1-3 and gearbox tuning files, secure original-file upload and tracked portal delivery.";

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
    title: "Custom ECU Calibration",
    text: "Vehicle-specific ECU software requests built from the submitted controller identity, original file, vehicle setup and technical target.",
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
    title: "ECU File Check",
    text: "A verification-first route when source-file originality, identity, read coverage or software context needs review.",
    href: "/services/ecu-file-check",
    action: "Prepare file check",
    icon: Search,
    tag: "Verification",
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
    title: "Stage 3 Calibration",
    text: "Prepare an extensively modified build for engineering-led feasibility, logging and revision review.",
    href: "/services/stage-3",
    action: "View Stage 3",
    icon: Gauge,
    tag: "Advanced",
  },
  {
    title: "Audi ECU Software",
    text: "Audi-specific ECU and TCU request guidance for supported TDI, TFSI and controller families.",
    href: "/brands/audi",
    action: "View Audi guide",
    icon: Cpu,
    tag: "Brand guide",
  },
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

const availableSolutions = [
  { title: "Stage 1 ECU files", text: "Standard or near-standard vehicle calibration", href: "/services/stage-1" },
  { title: "Stage 2 ECU files", text: "Hardware-aware modified-vehicle requests", href: "/services/stage-2" },
  { title: "Stage 3 calibration", text: "Engineering review for extensively modified builds", href: "/services/stage-3" },
  { title: "TCU tuning files", text: "Separate gearbox-controller identity and torque context", href: "/services/tcu-tuning" },
  { title: "DPF-related requests", text: "Jurisdiction-sensitive diesel aftertreatment workflow", href: "/services/dpf-off" },
  { title: "AdBlue / SCR requests", text: "Review-first SCR software request route", href: "/services/adblue-off" },
  { title: "EGR / AGR requests", text: "Diagnostic context and lawful-use review", href: "/services/egr-off" },
  { title: "DTC solutions", text: "Exact-code requests after root-cause diagnosis", href: "/services/dtc-off" },
  { title: "VMAX and start-stop", text: "Supported applications confirmed per ECU and vehicle", href: "/services" },
  { title: "Lambda / O2 solutions", text: "Application-specific review through the service catalog", href: "/services" },
];

const requestInformation = [
  "Vehicle make, model, generation, engine and model year",
  "Transmission and TCU context when torque coordination matters",
  "ECU supplier, family, hardware and software identifiers when available",
  "Untouched original ECU or TCU file and the explicit read method",
  "Fuel type or octane, installed hardware and intended operating context",
  "Requested services, exact fault codes, workshop observations and available logs",
];

const qualityChecks = [
  "Source-file and controller identity are reviewed together instead of trusting a filename alone.",
  "Compatibility is considered against the exact ECU software, read method and vehicle setup.",
  "Requested calibration scope stays tied to declared hardware, fuel and drivetrain constraints.",
  "Delivered versions, customer-visible messages and revision context remain attached to the private order.",
];

const supportedBrandLinks = brandGuides.slice(0, 12).map((brand) => ({
  name: brand.name.replace(/ ECU.*$/, ""),
  href: `/brands/${brand.slug}`,
}));

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
    question: "What is the difference between Stage 1, Stage 2 and Stage 3?",
    answer:
      "Stage 1 is generally reviewed for standard or near-standard hardware. Stage 2 is tied to documented supporting modifications. Stage 3 is an advanced custom project requiring a complete build specification, technical review and a credible logging or revision path.",
  },
  {
    question: "Are ECU tuning files vehicle-specific?",
    answer:
      "Yes. The request is reviewed against the submitted vehicle, engine, ECU software, original-file context, fuel, gearbox and hardware setup. A stage name alone is not enough.",
  },
  {
    question: "Can I submit a file read by AutoTuner, KESS, Flex or another tool?",
    answer:
      "State the tool and the OBD, bench, boot or virtual-read method when submitting. Tool name alone does not prove file coverage or originality, so the controller identity and source context are still reviewed.",
  },
  {
    question: "What information is needed for a tuning file?",
    answer:
      "Provide vehicle and engine data, transmission, ECU HW/SW where available, original file, read method, fuel, installed hardware, requested services and relevant fault or log context.",
  },
  {
    question: "How do I receive and download the tuned ECU file?",
    answer:
      "Delivered versions appear inside the authenticated order page. The customer can track status, read customer-visible messages and download the completed file from the private portal.",
  },
  {
    question: "Can a file be revised after testing or data logging?",
    answer:
      "Where a revision is appropriate, the request and supporting observations or logs remain attached to the same order so the delivered-version history stays traceable.",
  },
  {
    question: "What happens if the uploaded file is not original?",
    answer:
      "Do not hide uncertain file history. Mention previous work and use the ECU file-check route when originality, identity or read coverage needs verification before another service is considered.",
  },
  {
    question: "Do you support petrol and diesel engines?",
    answer:
      "Supported petrol and diesel applications can be reviewed, but controller families, operating strategies and evidence requirements differ. Exact support is confirmed from the submitted identity and file context.",
  },
  {
    question: "Do you offer TCU tuning files?",
    answer:
      "Selected TCU and gearbox-controller requests are supported. Submit a separate original TCU file, exact controller identity and engine torque context where ECU and TCU behavior must be coordinated.",
  },
  {
    question: "Can workshops and professional tuners use the service?",
    answer:
      "Yes. The workflow is designed to keep repeat file requests, technical notes, status, customer-visible communication, delivered versions and revisions connected to the correct account and order.",
  },
  {
    question: "Is this an ECU file-management software product?",
    answer:
      "MG AutoTech provides a secure customer portal for file submission, order status, request history, messages, revisions and downloads. It is a service workflow, not a standalone ECU editing application.",
  },
  {
    question: "Does this public page upload, inspect or modify files?",
    answer:
      "No. The public page explains the service. File submission and private technical handling begin only inside the authenticated customer request flow.",
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
    "Stage 2 file service",
    "Stage 3 custom calibration",
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
    itemListElement: availableSolutions.map((category, index) => ({
      "@type": "Offer",
      position: index + 1,
      itemOffered: {
        "@type": "Service",
        name: category.title,
        serviceType: category.title,
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
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 pb-16 pt-6 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
          <div className="min-w-0">
            <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-2 text-xs font-bold text-zinc-400 sm:mb-6">
              <Link href="/" className="transition hover:text-white">Home</Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page" className="text-zinc-200">ECU File Service</span>
            </nav>
            <div className="inline-block max-w-full rounded-full border border-red-700/60 bg-red-950/35 px-3 py-1.5 text-center text-[11px] font-black uppercase leading-5 tracking-[0.06em] text-red-100 sm:px-4 sm:py-2 sm:text-sm sm:tracking-[0.18em]">
              For workshops &amp; professional tuners
            </div>
            <h1 className="mt-5 max-w-4xl text-[2.5rem] font-black leading-[1.04] sm:mt-6 sm:text-5xl sm:leading-tight md:text-7xl">
              Professional ECU file service for custom tuning files.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-zinc-300 sm:mt-6 sm:text-base sm:leading-8">
              Built for workshops and professional tuners: submit the original
              ECU or TCU file with exact vehicle, controller, fuel and hardware
              context. MG AutoTech reviews Stage 1, Stage 2, Stage 3 and supported
              software requests through one secure, vehicle-specific workflow.
            </p>
            <div
              data-file-service-hero-actions
              className="mb-[calc(5.5rem+env(safe-area-inset-bottom))] mt-6 flex flex-col gap-3 sm:mb-0 sm:mt-8 sm:flex-row sm:flex-wrap"
            >
              <Link
                href="/new-request"
                className="inline-flex scroll-mb-[calc(5.5rem+env(safe-area-inset-bottom))] items-center justify-center rounded-xl bg-[#b1121b] px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-red-950/30 transition hover:-translate-y-0.5 hover:bg-[#c91824] sm:py-4"
              >
                Submit your original file
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                href="#stage-comparison"
                className="inline-flex scroll-mb-[calc(5.5rem+env(safe-area-inset-bottom))] items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] px-6 py-3.5 text-sm font-black text-white transition hover:-translate-y-0.5 hover:border-red-800/60 hover:bg-red-950/20 sm:py-4"
              >
                Compare Stage 1, 2 and 3
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-black/35 p-6 shadow-2xl shadow-black/40">
            <div className="mb-6 text-sm font-black uppercase tracking-[0.2em] text-red-300">
              Vehicle-specific by design
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

      <StageComparison />

      <section className="bg-[#080b10] py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-10 max-w-3xl">
            <div className="text-sm font-black uppercase tracking-[0.25em] text-red-500">
              File-service routes
            </div>
            <h2 className="mt-3 text-4xl font-black md:text-5xl">
              Choose the route that matches the real controller and job.
            </h2>
            <p className="mt-4 text-sm leading-7 text-zinc-400">
              ECU calibration, transmission work, source-file verification and
              diagnostic requests keep separate technical context while sharing
              the same private order workflow.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {fileServiceCategories.map((item) => (
              <ResourceCard key={item.title} item={item} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-[#050505] py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-normal text-red-400">Available request types</p>
              <h2 className="mt-3 text-3xl font-black sm:text-4xl">ECU and TCU file solutions, clearly separated.</h2>
            </div>
            <p className="max-w-3xl text-sm leading-7 text-zinc-400">
              These are review routes, not universal compatibility claims. Exact support is confirmed from the vehicle,
              ECU or TCU software, source file, read method and requested scope.
            </p>
          </div>
          <div className="mt-8 grid gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-5">
            {availableSolutions.map((solution) => (
              <Link key={solution.title} href={solution.href} className="group min-w-0 bg-[#0b0d10] p-5 transition hover:bg-[#12151a] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500">
                <h3 className="text-base font-black text-white">{solution.title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-500">{solution.text}</p>
                <span className="mt-4 inline-flex items-center text-xs font-black text-red-300">
                  Review route<ArrowRight className="ml-2 h-3.5 w-3.5 transition group-hover:translate-x-1" aria-hidden="true" />
                </span>
              </Link>
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

      <section className="border-b border-white/10 bg-[#090a0c] py-16">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 lg:grid-cols-2">
          <article className="border-t-2 border-red-700 bg-[#0b0d10] p-6 sm:p-8">
            <p className="text-xs font-black uppercase tracking-normal text-red-400">Request requirements</p>
            <h2 className="mt-3 text-3xl font-black">Information that makes an ECU file request usable.</h2>
            <ul className="mt-6 divide-y divide-white/10 border-y border-white/10">
              {requestInformation.map((item) => (
                <li key={item} className="flex gap-3 py-4 text-sm leading-7 text-zinc-300">
                  <BadgeCheck className="mt-1 h-5 w-5 shrink-0 text-emerald-400" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </article>
          <article className="border-t-2 border-zinc-700 bg-[#0b0d10] p-6 sm:p-8">
            <p className="text-xs font-black uppercase tracking-normal text-red-400">Quality and traceability</p>
            <h2 className="mt-3 text-3xl font-black">Checks stay attached to the vehicle-specific workflow.</h2>
            <ul className="mt-6 divide-y divide-white/10 border-y border-white/10">
              {qualityChecks.map((item) => (
                <li key={item} className="flex gap-3 py-4 text-sm leading-7 text-zinc-300">
                  <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-red-400" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#050505] py-14">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-normal text-red-400">Supported-brand guidance</p>
              <h2 className="mt-3 text-3xl font-black">Start with the vehicle, then confirm the exact ECU.</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-400">Brand guides provide request context only. Controller and software identification remain necessary for support confirmation.</p>
            </div>
            <Link href="/brands" className="inline-flex items-center text-sm font-black text-red-300 hover:text-red-100">
              Browse all brand guides<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-7 flex flex-wrap gap-2">
            {supportedBrandLinks.map((brand) => (
              <Link key={brand.href} href={brand.href} className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-zinc-300 transition hover:border-red-800/60 hover:text-white">
                {brand.name}
              </Link>
            ))}
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
