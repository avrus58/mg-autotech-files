import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Cable,
  Calculator,
  Clipboard,
  CheckCircle2,
  ClipboardCheck,
  FileDown,
  Gauge,
  LockKeyhole,
} from "lucide-react";
import { RuntimePublicLocalization } from "@/components/RuntimePublicLocalization";
import { RuntimePublicFooter } from "@/components/RuntimePublicFooter";
import { ToolsHeader } from "@/components/tools/ToolsHeader";
import {
  localizeRuntimePublicJsonLd,
  runtimePublicAlternates,
  runtimePublicInLanguage,
  runtimePublicMetadataCopy,
  runtimePublicOpenGraphLocale,
  runtimePublicT,
} from "@/lib/i18n/runtime-public";
import { absoluteUrl, siteName, websiteJsonLd } from "@/lib/seo";
import { getServerLocale } from "@/lib/serverLocale";

const tools = [
  {
    href: "/tools/file-readiness-check",
    eyebrow: "Request prep",
    title: "ECU File Readiness Check",
    description:
      "Check whether your file-service request is ready before upload, with a preparation score and customer-safe next steps.",
    features: ["No file upload", "Readiness score", "Practical next actions"],
    icon: ClipboardCheck,
    action: "Check readiness",
  },
  {
    href: "/tools/request-brief-builder",
    eyebrow: "Cleaner intake",
    title: "ECU Request Brief Builder",
    description:
      "Create a structured customer request note with vehicle, service, read method and diagnostic context before upload.",
    features: ["Copy-ready brief", "Completeness score", "No file upload"],
    icon: Clipboard,
    action: "Build a brief",
  },
  {
    href: "/tools/ecu-read-method-advisor",
    eyebrow: "Read planning",
    title: "ECU Read Method Advisor",
    description:
      "Plan safer ECU or TCU read preparation for OBD, bench, boot or unknown read situations before upload.",
    features: ["Read checklist", "Preparation score", "No file upload"],
    icon: Cable,
    action: "Plan read method",
  },
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
    href: "/dashboard/log-analysis",
    eyebrow: "Customer workspace",
    title: "Datalog Analysis Studio",
    description:
      "Signed-in customers can review compatible multi-channel text datalogs, calculated power, timelines and every retained numeric channel.",
    features: ["General text datalogs", "Multi-channel detail", "Browser-local processing"],
    icon: BarChart3,
    action: "Open customer Studio",
  },
];

const workflowSteps = [
  {
    href: "/tools/file-readiness-check",
    step: "01",
    title: "Check readiness",
    description:
      "Confirm that your vehicle details, file type and request context are ready before you start an upload.",
    action: "Run readiness check",
  },
  {
    href: "/tools/request-brief-builder",
    step: "02",
    title: "Build a clean brief",
    description:
      "Turn vehicle, service and diagnostic notes into a structured message that MG AutoTech can review faster.",
    action: "Build request brief",
  },
  {
    href: "/tools/ecu-read-method-advisor",
    step: "03",
    title: "Plan the read method",
    description:
      "Prepare OBD, bench, boot or unknown read situations with a practical checklist before submitting.",
    action: "Plan read method",
  },
  {
    href: "/new-request",
    step: "04",
    title: "Submit the request",
    description:
      "Create the file-service request only when your information, file and credit confirmation are ready.",
    action: "Start new request",
  },
];

const metadataTitle = "Free ECU Workshop Tools";
const metadataDescription =
  "Free automotive workshop tools from MG AutoTech: check file readiness, build request briefs, plan ECU read methods and run safe browser-based calculations.";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const scopes = ["core", "tools"] as const;
  const copy = runtimePublicMetadataCopy(locale, metadataTitle, metadataDescription, scopes);
  return {
    title: copy.title,
    description: copy.description,
    alternates: runtimePublicAlternates("/tools"),
    openGraph: {
      title: runtimePublicT(locale, "Free ECU Workshop Tools | MG AutoTech", scopes),
      description: runtimePublicT(locale, "File-service readiness checks, request brief preparation, ECU read planning and browser-based workshop calculations.", scopes),
      url: absoluteUrl("/tools"),
      type: "website",
      siteName,
      locale: runtimePublicOpenGraphLocale(locale),
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: runtimePublicT(locale, "MG AutoTech workshop tools", scopes) }],
    },
    twitter: {
      card: "summary_large_image",
      title: runtimePublicT(locale, "Free ECU Workshop Tools | MG AutoTech", scopes),
      description: runtimePublicT(locale, "Readiness checks, request brief preparation and workshop calculators for ECU file-service requests.", scopes),
      images: ["/opengraph-image"],
    },
  };
}

export default async function ToolsHubPage() {
  const locale = await getServerLocale();
  const scopes = ["core", "tools"] as const;
  const jsonLd = localizeRuntimePublicJsonLd({
    "@context": "https://schema.org",
    "@graph": [
      websiteJsonLd(locale),
      {
        "@type": "CollectionPage",
        name: "MG AutoTech Workshop Tools",
        description:
          "Free browser-based preparation, calculation and log-analysis tools for automotive workshops.",
        url: absoluteUrl("/tools"),
        inLanguage: runtimePublicInLanguage(locale),
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
          { "@type": "ListItem", position: 2, name: "Workshop tools", item: absoluteUrl("/tools") },
        ],
      },
    ],
  }, locale, scopes);

  return (
    <RuntimePublicLocalization locale={locale} scopes={scopes}>
      <div className="min-h-screen overflow-x-hidden bg-[#050505] text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ToolsHeader locale={locale} />

      <main>
        <section className="border-b border-white/10 bg-[#090909]">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:py-20">
            <div className="max-w-4xl">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-red-500">
                MG AutoTech Tools
              </div>
              <h1 className="mt-4 text-4xl font-black leading-tight sm:text-6xl">
                Practical ECU file-service tools for cleaner requests.
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-8 text-zinc-400 sm:text-lg">
                Check request readiness, build a cleaner brief, plan the read method and use browser-based workshop calculators before creating a file-service request.
              </p>
            </div>
          </div>
        </section>

        <section className="border-b border-white/10 bg-[#070707]">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:py-16">
            <div className="mb-8 max-w-3xl">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-red-500">
                Recommended workflow
              </div>
              <h2 className="mt-3 text-3xl font-black sm:text-4xl">
                Go from unsure to upload-ready without guessing.
              </h2>
              <p className="mt-4 leading-7 text-zinc-400">
                Use these tools before submitting a request so the order starts
                with clearer vehicle context, a cleaner brief and fewer support
                loops.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-4">
              {workflowSteps.map((step) => (
                <Link
                  key={step.href}
                  href={step.href}
                  className="group flex min-h-[260px] flex-col border border-white/10 bg-[#0b0b0c] p-6 transition hover:border-red-800/50 hover:bg-red-950/10"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-black uppercase tracking-[0.18em] text-red-400">
                      {step.step}
                    </span>
                    <ArrowRight className="h-4 w-4 text-zinc-600 transition group-hover:text-red-400" />
                  </div>
                  <h3 className="mt-7 text-2xl font-black">{step.title}</h3>
                  <p className="mt-4 flex-1 text-sm leading-6 text-zinc-400">
                    {step.description}
                  </p>
                  <span className="mt-6 text-sm font-black text-white">
                    {step.action}
                  </span>
                </Link>
              ))}
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

      <RuntimePublicFooter locale={locale} scopes={scopes} />
      </div>
    </RuntimePublicLocalization>
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
