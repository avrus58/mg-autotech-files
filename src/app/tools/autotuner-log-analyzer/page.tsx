import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  FileDown,
  FileSpreadsheet,
  LockKeyhole,
  ScanLine,
} from "lucide-react";
import { Footer } from "@/components/Footer";
import { PerformanceTools } from "@/components/tools/PerformanceTools";
import { ToolsHeader } from "@/components/tools/ToolsHeader";
import { absoluteUrl, siteName } from "@/lib/seo";

const title = "AutoTuner CSV Log Analyzer";
const description =
  "Analyze AutoTuner engine speed and engine torque CSV logs in your browser. Find peak torque, estimated peak power and download an SVG dyno-style report.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: absoluteUrl("/tools/autotuner-log-analyzer") },
  openGraph: {
    title: `${title} | MG AutoTech`,
    description,
    url: absoluteUrl("/tools/autotuner-log-analyzer"),
    type: "website",
    siteName,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "AutoTuner CSV log analyzer" }],
  },
  twitter: { card: "summary_large_image", title: `${title} | MG AutoTech`, description, images: ["/opengraph-image"] },
};

const faqs = [
  {
    question: "Which CSV columns are detected?",
    answer: "The analyzer looks for Engine Speed (rpm) and Engine Torque (Nm) columns. You can also paste simple rows in RPM, Nm format.",
  },
  {
    question: "Is my CSV uploaded to MG AutoTech?",
    answer: "No. The selected file is read and processed locally by JavaScript in your browser. This tool does not send the CSV to our server.",
  },
  {
    question: "Does the report show measured wheel horsepower?",
    answer: "No. Power is estimated from the torque values present in the log. ECU-reported torque can be modeled or limited and should not be treated as a calibrated chassis-dyno measurement.",
  },
  {
    question: "What does the downloaded report contain?",
    answer: "The SVG report includes the source filename, torque and estimated-power curves, peak torque, peak power and their RPM points.",
  },
];

export default function AutotunerLogAnalyzerPage() {
  const pageUrl = absoluteUrl("/tools/autotuner-log-analyzer");
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: title,
        description,
        url: pageUrl,
        applicationCategory: "UtilitiesApplication",
        operatingSystem: "Any",
        browserRequirements: "Requires JavaScript and local file access selected by the user",
        offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
        provider: { "@id": `${absoluteUrl("/")}#organization` },
      },
      {
        "@type": "FAQPage",
        mainEntity: faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: "Tools", item: absoluteUrl("/tools") },
          { "@type": "ListItem", position: 3, name: title, item: pageUrl },
        ],
      },
    ],
  };

  return (
    <div data-no-translate className="min-h-screen overflow-x-hidden bg-[#050505] text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ToolsHeader />
      <main>
        <section className="border-b border-white/10 bg-[#090909]">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:py-16">
            <Link href="/tools" className="inline-flex items-center text-sm font-black text-zinc-500 transition hover:text-white">
              <ArrowLeft className="mr-2 h-4 w-4" /> All tools
            </Link>
            <div className="mt-8 flex max-w-5xl flex-col items-start gap-4 sm:flex-row">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-red-800/50 bg-red-950/25 text-red-400">
                <BarChart3 className="h-6 w-6" />
              </span>
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-red-500">Free browser-based analyzer</div>
                <h1 className="mt-3 text-4xl font-black leading-tight sm:text-6xl">AutoTuner CSV Log Analyzer</h1>
                <p className="mt-5 max-w-3xl text-base leading-8 text-zinc-400 sm:text-lg">Load an AutoTuner CSV or paste RPM and torque rows to identify useful peaks and generate a clean, downloadable SVG report. Processing stays in your browser.</p>
              </div>
            </div>
          </div>
        </section>

        <PerformanceTools mode="log" />

        <section className="border-y border-white/10 bg-[#0a0a0a]">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:py-20">
            <div className="max-w-3xl">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-red-500">Workflow</div>
              <h2 className="mt-3 text-3xl font-black sm:text-4xl">From raw rows to a readable workshop overview.</h2>
              <p className="mt-4 leading-7 text-zinc-400">The analyzer is designed for quick inspection, documentation and communication. It does not alter the source file and it is not a replacement for calibrated dyno testing.</p>
            </div>
            <div className="mt-10 grid gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
              <Step icon={<FileSpreadsheet />} number="01" title="Select or paste" text="Choose a CSV or paste RPM and Nm rows directly." />
              <Step icon={<ScanLine />} number="02" title="Detect values" text="Valid engine-speed and engine-torque rows are parsed." />
              <Step icon={<BarChart3 />} number="03" title="Review peaks" text="Peak torque, estimated power and average torque are shown." />
              <Step icon={<FileDown />} number="04" title="Download report" text="Export a scalable SVG curve report for the job record." />
            </div>
            <div className="mt-6 flex items-start gap-3 border-l-2 border-emerald-500 bg-emerald-950/10 p-4 text-sm leading-6 text-emerald-100">
              <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
              CSV processing is local to the browser. Selecting a file here does not create a file-service request or upload it to MG AutoTech.
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-14 sm:py-20">
          <div className="text-xs font-black uppercase tracking-[0.2em] text-red-500">Questions</div>
          <h2 className="mt-3 text-3xl font-black sm:text-4xl">AutoTuner log analysis FAQ</h2>
          <div className="mt-8 divide-y divide-white/10 border-y border-white/10">
            {faqs.map((faq) => (
              <article key={faq.question} className="py-6">
                <h3 className="text-lg font-black">{faq.question}</h3>
                <p className="mt-3 leading-7 text-zinc-400">{faq.answer}</p>
              </article>
            ))}
          </div>
          <p className="mt-8 text-xs leading-6 text-zinc-600">AutoTuner is a third-party product name. This independent utility is not presented as an official AutoTuner product or service.</p>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function Step({ icon, number, title, text }: { icon: ReactNode; number: string; title: string; text: string }) {
  return (
    <div className="bg-[#070707] p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="text-red-500">{icon}</div>
        <div className="text-xs font-black tracking-[0.18em] text-zinc-700">{number}</div>
      </div>
      <h3 className="mt-5 font-black">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-500">{text}</p>
    </div>
  );
}
