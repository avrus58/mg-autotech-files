import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Calculator,
  CheckCircle2,
  FileDown,
  Gauge,
  LockKeyhole,
} from "lucide-react";
import { Footer } from "@/components/Footer";
import { ToolsHeader } from "@/components/tools/ToolsHeader";
import { absoluteUrl, siteName } from "@/lib/seo";

const tools = [
  {
    href: "/tools/torque-power-calculator",
    eyebrow: "Instant calculation",
    title: "Torque & Power Calculator",
    description:
      "Calculate estimated kW and HP from torque and RPM, with an integrated kW to HP and PS converter.",
    features: ["Nm + RPM input", "kW, HP and PS output", "Formula explained"],
    icon: Gauge,
    action: "Open calculator",
  },
  {
    href: "/tools/autotuner-log-analyzer",
    eyebrow: "CSV analysis",
    title: "AutoTuner Log Analyzer",
    description:
      "Read engine-speed and engine-torque rows, identify peak values and download a clean dyno-style SVG report.",
    features: ["AutoTuner CSV support", "Peak torque and power", "Downloadable report"],
    icon: BarChart3,
    action: "Analyze a log",
  },
];

export const metadata: Metadata = {
  title: "Free ECU Workshop Tools",
  description:
    "Free automotive workshop tools from MG AutoTech: calculate torque-based power and analyze AutoTuner RPM and torque CSV logs in your browser.",
  alternates: { canonical: absoluteUrl("/tools") },
  openGraph: {
    title: "Free ECU Workshop Tools | MG AutoTech",
    description:
      "Torque and power calculations, AutoTuner log analysis and downloadable workshop reports.",
    url: absoluteUrl("/tools"),
    type: "website",
    siteName,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "MG AutoTech workshop tools" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Free ECU Workshop Tools | MG AutoTech",
    description: "Torque calculator and AutoTuner log analyzer for workshop checks.",
    images: ["/opengraph-image"],
  },
};

export default function ToolsHubPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: "MG AutoTech Workshop Tools",
        description:
          "Free browser-based calculation and log-analysis tools for automotive workshops.",
        url: absoluteUrl("/tools"),
        isPartOf: { "@id": `${absoluteUrl("/")}#website` },
      },
      {
        "@type": "ItemList",
        name: "Workshop performance tools",
        itemListElement: tools.map((tool, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: tool.title,
          url: absoluteUrl(tool.href),
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: "Tools", item: absoluteUrl("/tools") },
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
          <div className="mx-auto max-w-7xl px-4 py-14 sm:py-20">
            <div className="max-w-4xl">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-red-500">
                MG AutoTech Tools
              </div>
              <h1 className="mt-4 text-4xl font-black leading-tight sm:text-6xl">
                Practical performance tools for real workshop checks.
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-8 text-zinc-400 sm:text-lg">
                Calculate torque-based power, inspect AutoTuner log rows and create a readable report without creating an account. Your calculations stay inside your browser.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:py-20">
          <div className="grid gap-5 lg:grid-cols-2">
            {tools.map((tool) => {
              const Icon = tool.icon;

              return (
                <article key={tool.href} className="flex min-h-[360px] flex-col border border-white/10 bg-[#0b0b0c] p-6 sm:p-8">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-red-800/50 bg-red-950/25 text-red-400">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="mt-7 text-xs font-black uppercase tracking-[0.18em] text-red-400">
                    {tool.eyebrow}
                  </div>
                  <h2 className="mt-2 text-3xl font-black">{tool.title}</h2>
                  <p className="mt-4 max-w-xl leading-7 text-zinc-400">{tool.description}</p>
                  <ul className="mt-6 space-y-3 text-sm font-bold text-zinc-300">
                    {tool.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-3">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link href={tool.href} className="mt-auto inline-flex items-center pt-8 text-sm font-black text-white">
                    {tool.action}
                    <ArrowRight className="ml-2 h-4 w-4 text-red-500" />
                  </Link>
                </article>
              );
            })}
          </div>
        </section>

        <section className="border-y border-white/10 bg-[#0a0a0a]">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 lg:grid-cols-[0.8fr_1.2fr] lg:items-start sm:py-20">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-red-500">Built responsibly</div>
              <h2 className="mt-3 text-3xl font-black sm:text-4xl">Useful estimates, clearly explained.</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <TrustItem icon={<Calculator />} title="Transparent maths" text="The formulas and unit conversions are shown on the calculator page." />
              <TrustItem icon={<LockKeyhole />} title="Local processing" text="CSV files are read in the browser and are not uploaded to our server." />
              <TrustItem icon={<FileDown />} title="Portable output" text="The log analyzer creates a scalable SVG report you can retain with the job." />
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function TrustItem({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="border-l-2 border-red-800 pl-4">
      <div className="text-red-500">{icon}</div>
      <h3 className="mt-3 font-black">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-500">{text}</p>
    </div>
  );
}
