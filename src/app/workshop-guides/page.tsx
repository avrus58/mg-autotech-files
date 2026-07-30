import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  Cable,
  CarFront,
  CircuitBoard,
  ClipboardCheck,
  Gauge,
  SearchCheck,
  ShieldCheck,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Footer } from "@/components/Footer";
import { PublicSeoHeader } from "@/components/PublicSeoHeader";
import { absoluteUrl, siteName } from "@/lib/seo";

const title = "ECU & TCU Workshop Knowledge Center";
const description = "A practical MG AutoTech knowledge center for ECU and TCU file-service preparation, vehicle and controller identification, read methods, service selection and workshop tools.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: absoluteUrl("/workshop-guides") },
  openGraph: {
    title: `${title} | MG AutoTech`,
    description,
    url: absoluteUrl("/workshop-guides"),
    siteName,
    type: "website",
    images: [{ url: absoluteUrl("/opengraph-image"), width: 1200, height: 630, alt: title }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${title} | MG AutoTech`,
    description,
    images: [absoluteUrl("/opengraph-image")],
  },
};

type GuideGroup = {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  links: Array<{ href: string; label: string; detail: string }>;
};

const guideGroups: GuideGroup[] = [
  {
    eyebrow: "Start here",
    title: "Prepare a cleaner file-service request",
    description: "Use the existing preparation tools before the secure upload so vehicle, service and workshop context arrive together.",
    icon: ClipboardCheck,
    links: [
      { href: "/how-it-works", label: "How the file-service workflow works", detail: "Intake, review, status, communication and delivery." },
      { href: "/tools/file-readiness-check", label: "File readiness check", detail: "Check request inputs without uploading a file." },
      { href: "/tools/request-brief-builder", label: "Request brief builder", detail: "Create a structured workshop note for the order." },
      { href: "/tools/ecu-read-method-advisor", label: "ECU read-method advisor", detail: "Prepare OBD, bench, boot or unknown read situations." },
    ],
  },
  {
    eyebrow: "Service scope",
    title: "Choose the correct ECU or TCU request route",
    description: "Understand the available public request categories before entering the authenticated customer workflow.",
    icon: Wrench,
    links: [
      { href: "/services", label: "Complete solution catalog", detail: "Performance, diesel, diagnostics, transmission and support categories." },
      { href: "/services/stage-1", label: "Stage 1 file service", detail: "Vehicle context, original-file preparation and review workflow." },
      { href: "/services/dpf-off", label: "DPF request guidance", detail: "Required diagnostic and workshop context for a DPF request." },
      { href: "/services/egr-off", label: "EGR / AGR request guidance", detail: "Prepare the relevant vehicle, ECU and diagnostic details." },
      { href: "/services/adblue-off", label: "AdBlue / SCR request guidance", detail: "Structure the request with exact symptoms and controller context." },
      { href: "/services/dtc-off", label: "DTC request guidance", detail: "Provide exact diagnostic codes without exposing private file data." },
    ],
  },
  {
    eyebrow: "Identification",
    title: "Match the vehicle and controller context",
    description: "Vehicle badges alone are not enough. Use brand, platform, ECU or TCU and read-method context before submission.",
    icon: CircuitBoard,
    links: [
      { href: "/brands", label: "Vehicle brand guides", detail: "Workshop-oriented identification notes for supported brand families." },
      { href: "/ecu-platforms", label: "ECU platform guides", detail: "Controller-family identification and request preparation context." },
      { href: "/widget", label: "Vehicle service widget", detail: "Browse the public vehicle and engine context without private metadata." },
      { href: "/file-service", label: "Central file-service hub", detail: "Review the secure request boundary and available public routes." },
    ],
  },
  {
    eyebrow: "Workshop tools",
    title: "Run local calculations and log checks",
    description: "Use transparent browser-based tools for preparation and estimates. These tools do not modify or upload ECU files.",
    icon: Gauge,
    links: [
      { href: "/tools", label: "All workshop tools", detail: "Open the complete preparation and calculation toolkit." },
      { href: "/tools/torque-power-calculator", label: "Torque and power calculator", detail: "Estimate kW, HP and PS from measured torque and RPM." },
      { href: "/tools/autotuner-log-analyzer", label: "AutoTuner log analyzer", detail: "Inspect RPM and torque rows and create a local report." },
    ],
  },
];

const quickAnswers = [
  { question: "Where should a new workshop start?", answer: "Start with the readiness check, build a structured request brief and confirm the read method before opening the secure request." },
  { question: "Does this knowledge center upload or process ECU files?", answer: "No. These are public preparation routes. Private upload, credits, messages and delivery remain inside the authenticated portal." },
  { question: "Can a service be confirmed from a vehicle model alone?", answer: "No. ECU or TCU identity, software context, read method, file quality and workshop notes can all affect support and review." },
  { question: "Where are status and completed files shown?", answer: "Customers track request status, messages and available downloads inside their protected dashboard." },
];

export default function WorkshopGuidesPage() {
  const itemLinks = guideGroups.flatMap((group) => group.links);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: title,
        description,
        url: absoluteUrl("/workshop-guides"),
        isPartOf: { "@id": `${absoluteUrl("/")}#website` },
      },
      {
        "@type": "ItemList",
        name: "MG AutoTech workshop guide routes",
        itemListElement: itemLinks.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.label, url: absoluteUrl(item.href) })),
      },
      {
        "@type": "FAQPage",
        mainEntity: quickAnswers.map((item) => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: "Workshop Guides", item: absoluteUrl("/workshop-guides") },
        ],
      },
    ],
  };

  return (
    <div data-no-translate className="min-h-screen overflow-x-hidden bg-[#050505] text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PublicSeoHeader />
      <main>
        <section className="border-b border-white/10 bg-[#080808]">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end sm:py-20">
            <div><p className="text-xs font-black uppercase tracking-[0.22em] text-red-500">MG AutoTech Workshop Library</p><h1 className="mt-4 max-w-4xl text-4xl font-black leading-tight sm:text-6xl">Find the right file-service answer before you upload.</h1><p className="mt-5 max-w-3xl text-base leading-8 text-zinc-400 sm:text-lg">A compact index for request preparation, service selection, vehicle and controller identification, read methods and practical workshop tools.</p></div>
            <aside className="border-l-2 border-red-700 pl-5"><ShieldCheck className="h-6 w-6 text-emerald-400" /><h2 className="mt-3 text-lg font-black">Public guidance boundary</h2><p className="mt-2 text-sm leading-6 text-zinc-500">This page does not read, upload, inspect, modify or generate customer files. Secure actions remain inside the authenticated portal.</p></aside>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:py-18">
          <div className="space-y-5">
            {guideGroups.map(({ icon: Icon, ...group }, index) => (
              <section key={group.title} className="grid gap-6 border-t border-white/10 py-8 lg:grid-cols-[320px_minmax(0,1fr)]">
                <div><div className="flex h-11 w-11 items-center justify-center rounded-lg border border-red-800/50 bg-red-950/20 text-red-400"><Icon className="h-5 w-5" /></div><p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-red-400">{String(index + 1).padStart(2, "0")} - {group.eyebrow}</p><h2 className="mt-2 text-2xl font-black">{group.title}</h2><p className="mt-3 text-sm leading-6 text-zinc-500">{group.description}</p></div>
                <div className="grid gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-2">
                  {group.links.map((item) => <Link key={item.href} href={item.href} className="group min-w-0 bg-[#0b0b0c] p-5 transition hover:bg-red-950/15"><div className="flex items-start justify-between gap-3"><h3 className="font-black">{item.label}</h3><ArrowRight className="h-4 w-4 shrink-0 text-zinc-700 transition group-hover:text-red-400" /></div><p className="mt-2 text-sm leading-6 text-zinc-500">{item.detail}</p></Link>)}
                </div>
              </section>
            ))}
          </div>
        </section>

        <section className="border-y border-white/10 bg-[#080808]">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div><BookOpenCheck className="h-7 w-7 text-red-500" /><p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-red-400">Quick answers</p><h2 className="mt-2 text-3xl font-black">Common workshop questions</h2></div>
            <div className="divide-y divide-white/10 border-y border-white/10">{quickAnswers.map((item) => <article key={item.question} className="py-5"><h3 className="font-black">{item.question}</h3><p className="mt-2 text-sm leading-6 text-zinc-500">{item.answer}</p></article>)}</div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-4 px-4 py-14 sm:grid-cols-3">
          <Callout icon={CarFront} title="Identify the vehicle" text="Use the public brand and platform guidance before the secure request." href="/brands" action="Browse brands" />
          <Callout icon={Cable} title="Prepare the read" text="Review the read-method checklist when OBD, bench or boot context is unclear." href="/tools/ecu-read-method-advisor" action="Plan read method" />
          <Callout icon={SearchCheck} title="Check the request" text="Run a customer-safe readiness check before uploading the original file." href="/tools/file-readiness-check" action="Check readiness" />
        </section>
      </main>
      <Footer />
    </div>
  );
}

function Callout({ icon: Icon, title: calloutTitle, text, href, action }: { icon: LucideIcon; title: string; text: string; href: string; action: string }) {
  return <article className="border border-white/10 bg-[#0b0b0c] p-5"><Icon className="h-5 w-5 text-red-500" /><h2 className="mt-4 text-xl font-black">{calloutTitle}</h2><p className="mt-2 text-sm leading-6 text-zinc-500">{text}</p><Link href={href} className="mt-5 inline-flex items-center text-sm font-black text-red-300">{action}<ArrowRight className="ml-2 h-4 w-4" /></Link></article>;
}
