import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ClipboardCheck, FileCheck2, LockKeyhole, ShieldCheck } from "lucide-react";
import { Footer } from "@/components/Footer";
import { FileReadinessAssistant } from "@/components/tools/FileReadinessAssistant";
import { ToolsHeader } from "@/components/tools/ToolsHeader";
import { absoluteUrl, siteName } from "@/lib/seo";

const title = "ECU File Readiness Check";
const description =
  "Check whether your ECU or TCU file-service request is ready before upload. Get a safe preparation score, next steps and warnings without uploading a file.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: absoluteUrl("/tools/file-readiness-check") },
  openGraph: {
    title: `${title} | MG AutoTech`,
    description,
    url: absoluteUrl("/tools/file-readiness-check"),
    type: "website",
    siteName,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: title }],
  },
  twitter: { card: "summary_large_image", title: `${title} | MG AutoTech`, description, images: ["/opengraph-image"] },
};

const faqs = [
  {
    question: "Does this tool upload my ECU file?",
    answer: "No. The readiness check has no file picker and does not upload anything. It only evaluates the information you select on the page.",
  },
  {
    question: "Can the score approve a file-service request automatically?",
    answer: "No. It is a preparation helper only. MG AutoTech still reviews submitted requests through the secure customer workflow.",
  },
  {
    question: "What should I prepare before submitting?",
    answer: "Prepare full vehicle details, the original read file, a clear service description, notes about hardware or symptoms, and payment or credits if required.",
  },
];

export default function FileReadinessCheckPage() {
  const pageUrl = absoluteUrl("/tools/file-readiness-check");
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
        browserRequirements: "Requires JavaScript",
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
        <section className="border-b border-white/10 bg-[radial-gradient(circle_at_78%_12%,rgba(177,18,27,0.24),transparent_34%),#090909]">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:py-16">
            <Link href="/tools" className="inline-flex items-center text-sm font-black text-zinc-500 transition hover:text-white">
              <ArrowLeft className="mr-2 h-4 w-4" /> All tools
            </Link>
            <div className="mt-8 flex max-w-5xl flex-col items-start gap-4 sm:flex-row">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-red-800/50 bg-red-950/25 text-red-400">
                <ClipboardCheck className="h-6 w-6" />
              </span>
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-red-500">Free request preparation tool</div>
                <h1 className="mt-3 text-4xl font-black leading-tight sm:text-6xl">ECU File Readiness Check</h1>
                <p className="mt-5 max-w-3xl text-base leading-8 text-zinc-400 sm:text-lg">
                  Check whether your file-service request is ready before upload. The tool gives a preparation score and practical next steps without reading, uploading or modifying any file.
                </p>
              </div>
            </div>
          </div>
        </section>

        <FileReadinessAssistant />

        <section className="border-y border-white/10 bg-[#0a0a0a]">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:py-20">
            <div className="grid gap-4 md:grid-cols-3">
              <SafePoint icon={<LockKeyhole />} title="No file upload" text="This checker has no file input and creates no upload session." />
              <SafePoint icon={<FileCheck2 />} title="Preparation only" text="The score helps you prepare; it does not approve, reject or automate a request." />
              <SafePoint icon={<ShieldCheck />} title="Secure next step" text="When ready, submit through the normal authenticated MG AutoTech request flow." />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-14 sm:py-20">
          <div className="text-xs font-black uppercase tracking-[0.2em] text-red-500">Questions</div>
          <h2 className="mt-3 text-3xl font-black sm:text-4xl">File readiness FAQ</h2>
          <div className="mt-8 divide-y divide-white/10 border-y border-white/10">
            {faqs.map((faq) => (
              <article key={faq.question} className="py-6">
                <h3 className="text-lg font-black">{faq.question}</h3>
                <p className="mt-3 leading-7 text-zinc-400">{faq.answer}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function SafePoint({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="border border-white/10 bg-[#070707] p-6">
      <div className="text-red-500">{icon}</div>
      <h3 className="mt-5 text-xl font-black">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-zinc-400">{text}</p>
    </div>
  );
}
