import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Calculator, Gauge, Info, Sigma } from "lucide-react";
import { RuntimePublicFooter } from "@/components/RuntimePublicFooter";
import { RuntimePublicLocalization } from "@/components/RuntimePublicLocalization";
import { PerformanceTools } from "@/components/tools/PerformanceTools";
import { ToolsHeader } from "@/components/tools/ToolsHeader";
import { absoluteUrl, siteName } from "@/lib/seo";
import {
  localizeRuntimePublicJsonLd,
  runtimePublicAlternates,
  runtimePublicInLanguage,
  runtimePublicMetadataCopy,
  runtimePublicOpenGraphLocale,
  runtimePublicT,
} from "@/lib/i18n/runtime-public";
import { getServerLocale } from "@/lib/serverLocale";
import { buildPerformanceCalculatorCopy } from "@/lib/i18n/tool-client-copy";

const title = "Torque to HP & kW Calculator";
const description =
  "Calculate estimated engine power from torque and RPM. Convert Nm and engine speed into kW, mechanical HP and metric PS with transparent formulas.";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const scopes = ["core", "tools"] as const;
  const copy = runtimePublicMetadataCopy(locale, title, description, scopes);
  return {
    title: copy.title,
    description: copy.description,
    alternates: runtimePublicAlternates("/tools/torque-power-calculator"),
    openGraph: { title: `${copy.title} | MG AutoTech`, description: copy.description, url: absoluteUrl("/tools/torque-power-calculator"), type: "website", siteName, locale: runtimePublicOpenGraphLocale(locale), images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: runtimePublicT(locale, "Torque to horsepower calculator", scopes) }] },
    twitter: { card: "summary_large_image", title: `${copy.title} | MG AutoTech`, description: copy.description, images: ["/opengraph-image"] },
  };
}

const faqs = [
  {
    question: "How is power calculated from torque and RPM?",
    answer: "Power in kilowatts is calculated as torque in newton-metres multiplied by RPM, divided by 9549. Mechanical horsepower is then calculated from kW using a factor of 1.34102.",
  },
  {
    question: "Is the result the same as a chassis dyno measurement?",
    answer: "No. The calculator estimates power at the point represented by the torque input. A chassis dyno also reflects drivetrain loss, measurement method, correction standard, gear selection and environmental conditions.",
  },
  {
    question: "What is the difference between HP and PS?",
    answer: "HP here means mechanical horsepower. PS is metric horsepower. One kW equals approximately 1.34102 HP or 1.35962 PS.",
  },
];

export default async function TorquePowerCalculatorPage() {
  const locale = await getServerLocale();
  const clientCopy = buildPerformanceCalculatorCopy(locale);
  const pageUrl = absoluteUrl("/tools/torque-power-calculator");
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
        browserRequirements: "Requires JavaScript",
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
          { "@type": "ListItem", position: 2, name: "Tools", item: absoluteUrl("/tools") },
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
        <section className="border-b border-white/10 bg-[#090909]">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:py-16">
            <Link href="/tools" className="inline-flex items-center text-sm font-black text-zinc-500 transition hover:text-white">
              <ArrowLeft className="mr-2 h-4 w-4" /> All tools
            </Link>
            <div className="mt-8 flex max-w-5xl flex-col items-start gap-4 sm:flex-row">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-red-800/50 bg-red-950/25 text-red-400">
                <Gauge className="h-6 w-6" />
              </span>
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-red-500">Free workshop calculator</div>
                <h1 className="mt-3 text-4xl font-black leading-tight sm:text-6xl">Torque to HP & kW Calculator</h1>
                <p className="mt-5 max-w-3xl text-base leading-8 text-zinc-400 sm:text-lg">Enter torque and engine speed to estimate power instantly. The calculation runs locally and shows kW, mechanical HP and metric PS without registration.</p>
              </div>
            </div>
          </div>
        </section>

        <PerformanceTools copy={clientCopy} />

        <section className="border-y border-white/10 bg-[#0a0a0a]">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:py-20">
            <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr]">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-red-500">Calculation method</div>
                <h2 className="mt-3 text-3xl font-black sm:text-4xl">The formula behind the result.</h2>
                <p className="mt-4 leading-7 text-zinc-400">The calculator does not guess from engine size or vehicle type. It uses the entered torque value at the entered engine speed.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Formula icon={<Sigma />} label="Power in kilowatts" formula="kW = Nm × RPM ÷ 9549" />
                <Formula icon={<Calculator />} label="Mechanical horsepower" formula="HP = kW × 1.34102" />
                <Formula icon={<Gauge />} label="Metric horsepower" formula="PS = kW × 1.35962" />
                <Formula
                  icon={<Info />}
                  label="Important limitation"
                  formula={runtimePublicT(
                    locale,
                    "An estimate, not a dyno certificate",
                    ["tools"],
                  )}
                  prose
                />
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-14 sm:py-20">
          <div className="text-xs font-black uppercase tracking-[0.2em] text-red-500">Questions</div>
          <h2 className="mt-3 text-3xl font-black sm:text-4xl">Torque and power calculation FAQ</h2>
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

function Formula({ icon, label, formula, prose = false }: { icon: ReactNode; label: string; formula: string; prose?: boolean }) {
  return (
    <div className="border border-white/10 bg-[#070707] p-5">
      <div className="text-red-500">{icon}</div>
      <div className="mt-4 text-xs font-black uppercase tracking-[0.14em] text-zinc-500">{label}</div>
      {prose ? (
        <p className="mt-2 break-words text-lg font-black text-white">{formula}</p>
      ) : (
        <code className="mt-2 block break-words text-lg font-black text-white">{formula}</code>
      )}
    </div>
  );
}
