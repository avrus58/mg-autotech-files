import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Cable, ClipboardList, ShieldCheck } from "lucide-react";
import { RuntimePublicFooter } from "@/components/RuntimePublicFooter";
import { RuntimePublicLocalization } from "@/components/RuntimePublicLocalization";
import { EcuReadMethodAdvisor } from "@/components/tools/EcuReadMethodAdvisor";
import { ToolsHeader } from "@/components/tools/ToolsHeader";
import { absoluteUrl, siteName } from "@/lib/seo";
import {
  localizeRuntimePublicJsonLd,
  runtimePublicAlternates,
  runtimePublicInLanguage,
  runtimePublicMetadataCopy,
  runtimePublicOpenGraphLocale,
} from "@/lib/i18n/runtime-public";
import { getServerLocale } from "@/lib/serverLocale";
import { buildEcuReadAdvisorCopy } from "@/lib/i18n/tool-client-copy";
import { javascriptBrowserRequirementJsonLd } from "@/lib/structuredDataI18n";

const title = "ECU Read Method Advisor";
const description =
  "Plan safer ECU or TCU read preparation before upload. Get a customer-safe OBD, bench, boot or unknown-read checklist without opening or uploading a file.";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const copy = runtimePublicMetadataCopy(locale, title, description, ["core", "tools"]);
  return {
    title: copy.title,
    description: copy.description,
    alternates: runtimePublicAlternates("/tools/ecu-read-method-advisor"),
    openGraph: { title: `${copy.title} | MG AutoTech`, description: copy.description, url: absoluteUrl("/tools/ecu-read-method-advisor"), type: "website", siteName, locale: runtimePublicOpenGraphLocale(locale), images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: copy.title }] },
    twitter: { card: "summary_large_image", title: `${copy.title} | MG AutoTech`, description: copy.description, images: ["/opengraph-image"] },
  };
}

const faqs = [
  {
    question: "Does this advisor tell me how to bypass ECU protection?",
    answer: "No. It gives customer-safe preparation guidance only and tells you when MG AutoTech should confirm the read path.",
  },
  {
    question: "Does it upload or inspect my file?",
    answer: "No. The page has no file input, no upload session and no binary inspection.",
  },
  {
    question: "Can it guarantee that OBD, bench or boot will work?",
    answer: "No. ECU read support depends on the exact ECU, software and tool. This advisor helps prepare the information needed for review.",
  },
];

export default async function EcuReadMethodAdvisorPage() {
  const locale = await getServerLocale();
  const clientCopy = buildEcuReadAdvisorCopy(locale);
  const pageUrl = absoluteUrl("/tools/ecu-read-method-advisor");
  const jsonLd = localizeRuntimePublicJsonLd({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: title,
        description,
        url: pageUrl,
        applicationCategory: "UtilitiesApplication",
        operatingSystem: "Any",
        browserRequirements: javascriptBrowserRequirementJsonLd,
        inLanguage: runtimePublicInLanguage(locale),
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
          { "@type": "ListItem", position: 2, name: "Workshop tools", item: absoluteUrl("/tools") },
          { "@type": "ListItem", position: 3, name: title, item: pageUrl },
        ],
      },
    ],
  }, locale, ["core", "tools"]);

  return (
    <RuntimePublicLocalization locale={locale} scopes={["core", "tools"]}>
    <div className="min-h-screen overflow-x-hidden bg-[#050505] text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ToolsHeader locale={locale} />
      <main>
        <section className="border-b border-white/10 bg-[radial-gradient(circle_at_78%_12%,rgba(177,18,27,0.24),transparent_34%),#090909]">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:py-16">
            <Link href="/tools" className="inline-flex items-center text-sm font-black text-zinc-500 transition hover:text-white">
              <ArrowLeft className="mr-2 h-4 w-4" /> All tools
            </Link>
            <div className="mt-8 flex max-w-5xl flex-col items-start gap-4 sm:flex-row">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-red-800/50 bg-red-950/25 text-red-400">
                <Cable className="h-6 w-6" />
              </span>
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-red-500">Free read preparation tool</div>
                <h1 className="mt-3 text-4xl font-black leading-tight sm:text-6xl">ECU Read Method Advisor</h1>
                <p className="mt-5 max-w-3xl text-base leading-8 text-zinc-400 sm:text-lg">
                  Plan safer ECU or TCU read preparation before submitting a request. Get a practical checklist for OBD, bench, boot or unknown read situations without opening or uploading a file.
                </p>
              </div>
            </div>
          </div>
        </section>

        <EcuReadMethodAdvisor copy={clientCopy} />

        <section className="border-y border-white/10 bg-[#0a0a0a]">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:py-20">
            <div className="grid gap-4 md:grid-cols-3">
              <SafePoint icon={<Cable />} title="Read planning" text="Helps customers understand what information is needed before upload." />
              <SafePoint icon={<ClipboardList />} title="Checklist output" text="Turns tool, ECU and file status into clear next preparation steps." />
              <SafePoint icon={<ShieldCheck />} title="No file action" text="No upload, binary analysis, checksum or file generation happens here." />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-14 sm:py-20">
          <div className="text-xs font-black uppercase tracking-[0.2em] text-red-500">Questions</div>
          <h2 className="mt-3 text-3xl font-black sm:text-4xl">Read method FAQ</h2>
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
      <RuntimePublicFooter locale={locale} scopes={["core", "tools"]} />
    </div>
    </RuntimePublicLocalization>
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
