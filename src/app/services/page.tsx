import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  CircuitBoard,
  ClipboardCheck,
  FileCode2,
  Gauge,
  Layers3,
  Lock,
  Rocket,
  ScanSearch,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Footer } from "@/components/Footer";
import { FileServiceSearchNavigator } from "@/components/FileServiceSearchNavigator";
import { OnlineStatus } from "@/components/OnlineStatus";
import { PublicSeoHeader } from "@/components/PublicSeoHeader";
import { fileServiceSearchDestinations } from "@/lib/fileServiceSearchIntents";
import {
  absoluteUrl,
  getServiceSeo,
  organizationJsonLd,
  publicServiceSlugs,
  siteName,
  websiteJsonLd,
} from "@/lib/seo";
import { serviceIntentGuides } from "@/lib/serviceIntentGuides";

const pageTitle = "ECU & TCU File Service Catalog for Workshops";
const pageDescription =
  "Find the right ECU or TCU file service for Stage 1-3, gearbox tuning, DPF, EGR, AdBlue, DTC, file checks and workshop read-method guidance.";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: {
    canonical: absoluteUrl("/services"),
  },
  openGraph: {
    title: `${pageTitle} | MG AutoTech`,
    description: pageDescription,
    url: absoluteUrl("/services"),
    siteName,
    type: "website",
    images: [
      {
        url: absoluteUrl("/opengraph-image"),
        width: 1200,
        height: 630,
        alt: "MG AutoTech ECU and TCU solution catalog",
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

type SolutionCategory = {
  title: string;
  eyebrow: string;
  text: string;
  icon: LucideIcon;
  tone: "red" | "emerald" | "blue" | "amber";
  services: string[];
};

const coreServices = publicServiceSlugs.map((slug) => getServiceSeo(slug, "en"));
const coreServicePages = [
  ...coreServices.map((service) => ({
    slug: service.slug,
    name: service.name,
    description: service.description,
    badge: `${service.credits} credits`,
    detail: service.turnaround,
  })),
  ...serviceIntentGuides.map((service) => ({
    slug: service.slug,
    name: service.name,
    description: service.description,
    badge: service.cardLabel,
    detail: "Exact vehicle and controller review",
  })),
];

const requestPillars = [
  {
    title: "Performance",
    value: "Stage 1-3",
    text: "Stock and modified vehicle request paths with clear engine, hardware and read-method context.",
    icon: Gauge,
  },
  {
    title: "Diesel systems",
    value: "DPF / EGR / SCR",
    text: "Aftertreatment request categories stay grouped, visible and review-first.",
    icon: Wrench,
  },
  {
    title: "Diagnostics",
    value: "DTC / file checks",
    text: "Fault-code context, readout verification and file expertise are kept in the same order flow.",
    icon: ScanSearch,
  },
  {
    title: "Transmission",
    value: "TCU / torque",
    text: "Gearbox software requests can include controller details and torque-limiter notes.",
    icon: CircuitBoard,
  },
];

const solutionCategories: SolutionCategory[] = [
  {
    title: "Performance & drivability",
    eyebrow: "Power delivery",
    text: "Performance-oriented request paths for vehicles where the workshop needs clean notes, vehicle data and file context before review.",
    icon: Rocket,
    tone: "red",
    services: [
      "Stage 1",
      "Stage 2",
      "Stage 3 manual review",
      "ECO tuning",
      "VMAX OFF",
      "Limited VMAX",
      "Launch control",
      "Hard cut limiter",
      "Pop and Bang",
      "Burble map",
      "Map switch",
      "Flex fuel / ethanol setup",
    ],
  },
  {
    title: "Diesel & aftertreatment",
    eyebrow: "Technical request categories",
    text: "Diesel and aftertreatment jobs are separated into clear categories so the selected scope and diagnostic notes stay readable.",
    icon: Wrench,
    tone: "amber",
    services: [
      "DPF",
      "EGR / AGR",
      "AdBlue / SCR",
      "DPF + EGR",
      "DPF + AdBlue",
      "EGR + AdBlue",
      "DPF + EGR + AdBlue",
      "GPF / OPF",
      "NOx",
      "Lambda / O2",
      "Decat / CAT",
      "Additive system",
    ],
  },
  {
    title: "Engine function requests",
    eyebrow: "Behavior and sensor context",
    text: "Function-related requests can be documented with symptoms, ECU details and exact workshop notes instead of scattered messages.",
    icon: SlidersHorizontal,
    tone: "blue",
    services: [
      "Start / Stop",
      "Cold start",
      "Hot start fix",
      "Swirl flaps",
      "Exhaust flaps",
      "TVA",
      "Cylinder on demand",
      "MAF",
      "MAP sensor calibration",
      "Coolant temperature control",
      "Thermostat logic",
      "Water pump request",
    ],
  },
  {
    title: "TCU & gearbox",
    eyebrow: "Transmission workflow",
    text: "Transmission jobs get their own route so gearbox type, torque limits and read method do not get mixed with ECU notes.",
    icon: CircuitBoard,
    tone: "emerald",
    services: [
      "TCU tuning",
      "Gearbox torque limit",
      "DSG context",
      "ZF context",
      "VGS context",
      "DCT context",
      "PDK context",
      "Transmission read-method notes",
    ],
  },
  {
    title: "Diagnostics & file services",
    eyebrow: "Review and verification",
    text: "Focused technical requests for exact DTC lists, file quality, original backup context and safe review before work continues.",
    icon: ScanSearch,
    tone: "red",
    services: [
      "DTC",
      "File check",
      "Checksum correction request",
      "File expertise",
      "Readout verification",
      "Software version check",
      "ECU recovery support",
      "Original backup check",
    ],
  },
  {
    title: "Professional support add-ons",
    eyebrow: "Workshop support",
    text: "Add-on support for complex jobs where the workshop wants stronger review context, logs or priority handling.",
    icon: ClipboardCheck,
    tone: "blue",
    services: [
      "Priority processing",
      "Same day processing",
      "Log file review",
      "Dyno report review",
      "Smoke limiter optimization",
      "Torque monitoring",
      "Remote support session",
      "Special request / other",
    ],
  },
];

const workflow = [
  {
    title: "Choose service scope",
    text: "Select the closest ECU, TCU, diesel, diagnostic or support category before the secure upload flow starts.",
    icon: Layers3,
  },
  {
    title: "Prepare technical context",
    text: "Vehicle, engine, ECU or TCU details, read method, exact fault codes and workshop notes stay attached to the request.",
    icon: FileCode2,
  },
  {
    title: "Submit securely",
    text: "Files are submitted only through the authenticated customer portal, with credit and access checks on the server.",
    icon: Lock,
  },
  {
    title: "Track review and delivery",
    text: "Status, customer-visible messages, delivery and revisions remain in the private dashboard.",
    icon: ShieldCheck,
  },
];

const faq = [
  {
    question: "Is every listed option automatically available for every vehicle?",
    answer:
      "No. Availability depends on the vehicle, controller, read method, file quality, hardware state and submitted notes. Complex or unclear work stays review-first.",
  },
  {
    question: "Does this public service page upload or modify files?",
    answer:
      "No. This is a public service catalog. File upload, payment, request status and delivery happen only inside the authenticated customer portal.",
  },
  {
    question: "Why does MG AutoTech show more services than a basic ECU solutions page?",
    answer:
      "Workshops often need more than one simple category. MG AutoTech separates performance, aftertreatment, diagnostics, TCU, function requests and support add-ons so the request can be prepared clearly.",
  },
  {
    question: "What should I prepare before opening a request?",
    answer:
      "Prepare the original file, vehicle details, engine, ECU or TCU information, read method, exact DTCs if relevant and a short workshop note.",
  },
];

const catalogJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    organizationJsonLd(),
    websiteJsonLd("en"),
    {
      "@type": "CollectionPage",
      "@id": absoluteUrl("/services#page"),
      name: `${pageTitle} | MG AutoTech`,
      description: pageDescription,
      url: absoluteUrl("/services"),
      isPartOf: {
        "@id": `${absoluteUrl("/")}#website`,
      },
      about: {
        "@id": `${absoluteUrl("/")}#organization`,
      },
      mainEntity: {
        "@id": absoluteUrl("/services#solution-catalog"),
      },
      breadcrumb: {
        "@id": absoluteUrl("/services#breadcrumb"),
      },
    },
    {
      "@type": "BreadcrumbList",
      "@id": absoluteUrl("/services#breadcrumb"),
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
          item: absoluteUrl("/services"),
        },
      ],
    },
    {
      "@type": "Service",
      "@id": absoluteUrl("/services#service"),
      name: "MG AutoTech ECU and TCU solution catalog",
      description: pageDescription,
      serviceType: "ECU and TCU file service catalog",
      provider: {
        "@id": `${absoluteUrl("/")}#organization`,
      },
      areaServed: ["Germany", "Europe"],
      url: absoluteUrl("/services"),
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "MG AutoTech service categories",
        itemListElement: solutionCategories.map((category) => ({
          "@type": "OfferCatalog",
          name: category.title,
          itemListElement: category.services.map((service) => ({
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: service,
              serviceType: category.title,
            },
          })),
        })),
      },
    },
    {
      "@type": "ItemList",
      "@id": absoluteUrl("/services#solution-catalog"),
      name: "MG AutoTech visible service solution catalog",
      itemListElement: [
        ...coreServicePages.map((service, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: service.name,
          url: absoluteUrl(`/services/${service.slug}`),
        })),
        ...solutionCategories.flatMap((category, categoryIndex) =>
          category.services.map((service, serviceIndex) => ({
            "@type": "ListItem",
            position: coreServicePages.length + categoryIndex * 20 + serviceIndex + 1,
            name: service,
            url: absoluteUrl("/services"),
          }))
        ),
      ],
    },
    {
      "@type": "ItemList",
      "@id": absoluteUrl("/services#file-service-search-intent-map"),
      name: "MG AutoTech workshop file-service search routes",
      itemListElement: fileServiceSearchDestinations.map((destination, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: destination.title,
        description: destination.decision,
        url: absoluteUrl(destination.href),
      })),
    },
    {
      "@type": "FAQPage",
      "@id": absoluteUrl("/services#faq"),
      mainEntity: faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    },
  ],
};

export default function ServicesPage() {
  return (
    <main className="min-h-screen bg-[#050607] text-white">
      <PublicSeoHeader />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(catalogJsonLd) }}
      />

      <section className="relative overflow-hidden border-b border-white/10 bg-[#050607]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(177,18,27,0.28),transparent_30%),radial-gradient(circle_at_80%_25%,rgba(55,90,160,0.16),transparent_28%),linear-gradient(135deg,#050607,#090b10_48%,#120507)]" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-red-800/50 bg-red-950/25 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-red-100">
              <Sparkles className="h-4 w-4 text-red-400" />
              Professional file-service catalog
            </div>
            <h1 className="mt-6 max-w-4xl text-[clamp(2.4rem,7vw,5.8rem)] font-black leading-[0.96] tracking-normal">
              ECU & TCU file services, organized for serious workshops.
            </h1>
            <p className="mt-6 max-w-3xl text-base leading-8 text-zinc-300 md:text-lg">
              Find the correct route for custom tuning files, performance,
              diesel aftertreatment, diagnostics, gearbox software and technical
              verification. Choose the real job context first, then submit
              through the secure customer portal.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/new-request"
                className="inline-flex items-center justify-center rounded-xl bg-[#b1121b] px-6 py-4 text-sm font-black text-white shadow-xl shadow-red-950/40 transition hover:bg-[#c91824] focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700"
              >
                Create file request
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                href="/file-service"
                className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/[0.05] px-6 py-4 text-sm font-black text-white transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700"
              >
                Open file-service hub
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/30">
            <div className="grid gap-3 sm:grid-cols-2">
              {requestPillars.map((item) => {
                const Icon = item.icon;

                return (
                  <div key={item.title} className="rounded-2xl border border-white/10 bg-black/30 p-5">
                    <Icon className="h-6 w-6 text-red-400" />
                    <div className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
                      {item.title}
                    </div>
                    <div className="mt-2 text-xl font-black">{item.value}</div>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">{item.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-red-400">
              Main service pages
            </p>
            <h2 className="mt-3 text-3xl font-black md:text-5xl">
              Core file-service routes
            </h2>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-zinc-400">
            These are the dedicated public landing pages for the most common
            workshop service searches. Each path remains review-first and
            portal-based.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {coreServicePages.map((service) => (
            <Link
              key={service.slug}
              href={`/services/${service.slug}`}
              className="group flex min-h-72 flex-col rounded-[1.35rem] border border-white/10 bg-gradient-to-br from-white/[0.065] via-white/[0.035] to-black p-5 transition hover:-translate-y-1 hover:border-red-500/45 hover:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full border border-red-500/25 bg-red-950/25 px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.16em] text-red-100">
                  {service.badge}
                </span>
                <ArrowRight className="h-4 w-4 text-red-300 transition group-hover:translate-x-1" />
              </div>
              <h3 className="mt-6 text-xl font-black leading-tight">{service.name}</h3>
              <p className="mt-3 line-clamp-5 text-sm leading-6 text-zinc-400">
                {service.description}
              </p>
              <div className="mt-auto pt-5 text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
                {service.detail}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <FileServiceSearchNavigator />

      <section className="border-y border-white/10 bg-[#090b10] py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr] lg:items-start">
            <div className="lg:sticky lg:top-28">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-red-400">
                Extended MG AutoTech coverage
              </p>
              <h2 className="mt-3 text-3xl font-black md:text-5xl">
                More than a basic ECU solutions grid.
              </h2>
              <p className="mt-5 text-sm leading-7 text-zinc-400">
                Public competitors usually show a short list. MG AutoTech keeps
                a broader workshop request matrix so complex files can be
                routed with less confusion.
              </p>
              <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-950/15 p-4 text-sm leading-6 text-emerald-100">
                <span className="font-black">Safety boundary:</span> this page
                does not upload, inspect, edit, patch or generate customer
                files.
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {solutionCategories.map((category) => (
                <SolutionCategoryCard key={category.title} category={category} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-[2rem] border border-red-950/55 bg-gradient-to-br from-red-950/25 via-zinc-950 to-black p-6">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-red-300">
              Professional workflow
            </p>
            <h2 className="mt-3 text-3xl font-black">
              The catalog is only the start.
            </h2>
            <p className="mt-4 text-sm leading-7 text-zinc-400">
              Real request quality comes from the intake flow: vehicle context,
              original file, service scope, notes, review status and delivery
              all stay connected to the same customer order.
            </p>
            <div className="mt-6 grid gap-3">
              {workflow.map((step, index) => {
                const Icon = step.icon;

                return (
                  <div key={step.title} className="flex gap-4 rounded-2xl border border-white/10 bg-black/30 p-4">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-red-950/45 text-red-100">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
                        Step {index + 1}
                      </div>
                      <h3 className="mt-1 font-black text-white">{step.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-zinc-400">{step.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-red-300">
              Request readiness
            </p>
            <h2 className="mt-3 text-3xl font-black">
              What to prepare before ordering
            </h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                "Original ECU or TCU file",
                "Vehicle brand, model, engine and year",
                "ECU family, HW/SW or calibration data if available",
                "Read method such as OBD, Bench, Boot or Virtual",
                "Exact DTC codes for diagnostic requests",
                "Hardware modifications and workshop notes",
                "Desired main service and extra options",
                "Customer-visible delivery or revision notes",
              ].map((item) => (
                <div key={item} className="flex gap-3 rounded-2xl border border-white/10 bg-black/30 p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                  <span className="text-sm font-bold leading-6 text-zinc-200">{item}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/tools/request-brief-builder"
                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.045] px-5 py-4 text-sm font-black text-white transition hover:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700"
              >
                Build request brief
              </Link>
              <Link
                href="/tools/file-readiness-check"
                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.045] px-5 py-4 text-sm font-black text-white transition hover:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700"
              >
                Check readiness
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-black py-16">
        <div className="mx-auto max-w-5xl px-4">
          <div className="text-center">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-red-400">
              FAQ
            </p>
            <h2 className="mt-3 text-3xl font-black md:text-5xl">
              Service catalog questions
            </h2>
          </div>
          <div className="mt-8 grid gap-4">
            {faq.map((item) => (
              <div key={item.question} className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
                <h3 className="text-lg font-black">{item.question}</h3>
                <p className="mt-3 text-sm leading-7 text-zinc-400">{item.answer}</p>
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

function SolutionCategoryCard({ category }: { category: SolutionCategory }) {
  const Icon = category.icon;
  const toneClass =
    category.tone === "emerald"
      ? "border-emerald-500/25 bg-emerald-950/10 text-emerald-100"
      : category.tone === "blue"
        ? "border-blue-500/25 bg-blue-950/10 text-blue-100"
        : category.tone === "amber"
          ? "border-amber-500/25 bg-amber-950/10 text-amber-100"
          : "border-red-500/25 bg-red-950/10 text-red-100";

  return (
    <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-5 shadow-xl shadow-black/15">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.18em] text-red-300">
            {category.eyebrow}
          </div>
          <h3 className="mt-2 text-2xl font-black">{category.title}</h3>
        </div>
        <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl border ${toneClass}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
      <p className="mt-4 min-h-20 text-sm leading-7 text-zinc-400">
        {category.text}
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        {category.services.map((service) => (
          <span
            key={service}
            className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs font-bold text-zinc-300"
          >
            {service}
          </span>
        ))}
      </div>
    </article>
  );
}
