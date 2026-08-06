import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Car,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileCode2,
  Gauge,
  ShieldCheck,
  Upload,
  Wrench,
} from "lucide-react";
import { Footer } from "@/components/Footer";
import { OnlineStatus } from "@/components/OnlineStatus";
import { PublicSeoHeader } from "@/components/PublicSeoHeader";
import { ServiceIntentPage } from "@/components/ServiceIntentPage";
import {
  Stage1Authority,
  stage1BrandRoutes,
  stage1PlatformRoutes,
} from "@/components/Stage1Authority";
import { StageComparison } from "@/components/StageComparison";
import {
  absoluteUrl,
  languageAlternates,
  organizationJsonLd,
  siteName,
  websiteJsonLd,
} from "@/lib/seo";
import {
  getServiceIntentGuide,
  serviceIntentGuideSlugs,
} from "@/lib/serviceIntentGuides";

type ServicePage = {
  slug: string;
  title: string;
  eyebrow: string;
  description: string;
  credits: string;
  turnaround: string;
  hero: string;
  intro: string[];
  benefits: string[];
  process: { title: string; text: string }[];
  supported: string[];
  requiredInfo: string[];
  faq: { q: string; a: string }[];
  notice?: { title: string; text: string; kind: "legal" | "diagnostic" };
};

const services: ServicePage[] = [
  {
    slug: "stage-1",
    title: "Stage 1 Tuning File Service for Workshops",
    eyebrow: "Vehicle-specific performance calibration",
    description:
      "Online Stage 1 ECU tuning file service for workshops. Submit the original read, vehicle and ECU details for reviewed calibration and secure portal delivery.",
    credits: "10 credits",
    turnaround: "Usually around 30 minutes for standard requests",
    hero:
      "A professional Stage 1 file service starts with the exact vehicle, controller software and original ECU read rather than a generic one-file-fits-all calibration.",
    intro: [
      "Stage 1 is generally intended for a standard or near-standard engine setup. The review considers the vehicle condition, engine and ECU identity, source-file history, fuel, gearbox context and any existing hardware changes before suitability is confirmed.",
      "Petrol and diesel engines use different control strategies, operating limits and diagnostic evidence. For that reason, the requested response and torque delivery are considered within the submitted platform instead of being described with universal power figures.",
      "MG AutoTech keeps the complete workflow in the customer portal: submit the untouched original ECU file, record the read method and technical notes, follow customer-visible status, download delivered versions and request a revision when testing or logging provides useful evidence.",
    ],
    benefits: [
      "Vehicle- and ECU-specific review for standard or near-standard hardware",
      "Torque delivery, response and drivetrain context considered together",
      "Petrol, diesel, fuel-quality and transmission constraints kept visible",
      "Private request history, delivered versions and evidence-led revision support",
    ],
    process: [
      {
        title: "Vehicle and ECU details",
        text: "Brand, model, generation, engine, read method and HW/SW information are collected before file work starts.",
      },
      {
        title: "Original file upload",
        text: "The customer uploads the original ECU file through the secure portal so the request stays connected to the correct account.",
      },
      {
        title: "File preparation",
        text: "The source-file context, ECU identity, vehicle condition, fuel and drivetrain constraints are reviewed before suitability is confirmed.",
      },
      {
        title: "Delivery and revision",
        text: "The completed modified file is delivered in the order detail view. If needed, the customer can request a revision.",
      },
    ],
    supported: ["BMW", "Mercedes-Benz", "Audi", "Volkswagen", "Porsche", "Opel", "Renault", "Peugeot"],
    requiredInfo: [
      "Original ECU file",
      "Vehicle make, model, engine, model year and transmission",
      "ECU supplier, type and HW/SW identifiers where available",
      "Read method such as OBD, bench, boot or virtual read",
      "Fuel type or octane and every existing hardware modification",
      "Current fault codes, workshop observations and logs when available",
    ],
    faq: [
      {
        q: "What is a Stage 1 tuning file service?",
        a: "It is an online workshop workflow for preparing a vehicle-specific ECU calibration from the submitted original read, exact controller identity, fuel, drivetrain and vehicle context. It is not a universal file selected only by model name.",
      },
      {
        q: "What file do I need for a Stage 1 request?",
        a: "Submit the untouched original ECU read and identify whether it was read by OBD, bench, boot or a supported virtual-read method. Include ECU HW/SW data where available so file coverage can be reviewed.",
      },
      {
        q: "Is Stage 1 suitable for every vehicle?",
        a: "No. Suitability depends on ECU type, file quality, vehicle condition and hardware setup. A file check may be needed for unclear requests.",
      },
      {
        q: "What is the difference between Stage 1 and Stage 2?",
        a: "Stage 1 is generally reviewed for standard or near-standard hardware. Stage 2 depends on documented supporting modifications and may require additional logs or drivetrain context.",
      },
      {
        q: "Can both petrol and diesel vehicles use this request route?",
        a: "Supported petrol and diesel applications can be reviewed, but they do not share one generic calibration strategy. Exact ECU software, fuel, engine and vehicle condition remain decisive.",
      },
      {
        q: "Why do transmission torque limits matter?",
        a: "Engine torque delivery and gearbox protection strategies can interact. Include the gearbox type and any TCU work so the request is reviewed with the correct drivetrain context.",
      },
      {
        q: "Can a file read by AutoTuner, KESS, Flex or another tool be submitted?",
        a: "Use the secure request flow and state the tool and OBD, bench, boot or virtual-read method. Tool name alone does not prove read coverage or originality, so the file context is still reviewed.",
      },
      {
        q: "Is a Stage 1 tuning file generic?",
        a: "No. Vehicle model, ECU family, HW/SW identifiers, original-file history, fuel, gearbox and installed hardware can change the correct review context. Similar vehicle descriptions do not make files interchangeable.",
      },
      {
        q: "Do I need logs for a Stage 1 file request?",
        a: "Not every standard request needs a log before review, but current fault codes and useful workshop observations should be supplied. Logs are important when measured behaviour or a revision needs evidence.",
      },
    ],
  },
  {
    slug: "dpf-off",
    title: "DPF OFF File Service",
    eyebrow: "Diesel Aftertreatment Solution",
    description:
      "DPF-related ECU file service for supported diesel vehicles, handled through a secure workshop-focused request workflow.",
    credits: "6 credits",
    turnaround: "Usually around 30 minutes for standard supported files",
    hero:
      "A focused DPF software request flow for workshops that need clear notes, correct vehicle data and controlled file delivery.",
    intro: [
      "DPF-related work requires accurate vehicle and ECU information. The request should include the original file, read method and any diagnostic context so the file can be reviewed properly.",
      "The MG AutoTech portal keeps the process structured: request created, file check, in progress and completed. Customers can follow the status without chasing updates manually.",
    ],
    benefits: [
      "Clear request structure for diesel aftertreatment-related jobs",
      "DTC notes and diagnostic context can be included in the same order",
      "Completed file delivery through the customer dashboard",
      "Revision request support for completed files",
    ],
    process: [
      {
        title: "Submit diagnostic context",
        text: "Add fault codes, previous repairs, sensor information or workshop notes where relevant.",
      },
      {
        title: "Upload original file",
        text: "The original ECU read is attached to the customer request and stored in the portal.",
      },
      {
        title: "Technical review",
        text: "MG AutoTech checks whether the submitted data is sufficient and may request extra information if needed.",
      },
      {
        title: "Modified file delivery",
        text: "The completed file is uploaded back to the order with status and version visibility for the customer.",
      },
    ],
    supported: ["BMW Diesel", "Mercedes CDI", "VAG TDI", "Opel Diesel", "Renault Diesel", "Peugeot HDI"],
    requiredInfo: [
      "Original ECU file",
      "DPF-related fault codes where available",
      "Read method and ECU details",
      "Vehicle model, engine and year",
      "Workshop notes about hardware condition",
    ],
    faq: [
      {
        q: "Can DPF work be combined with EGR or AdBlue requests?",
        a: "Yes, combined requests can be selected in the file request workflow where supported.",
      },
      {
        q: "Is this for road use?",
        a: "Customers are responsible for legal use in their market. Certain solutions may be limited to motorsport, export, diagnostic or off-road contexts.",
      },
    ],
    notice: {
      title: "Legal use depends on the vehicle and jurisdiction",
      text: "Emissions-related software changes may be restricted or prohibited on public roads. Requirements vary by jurisdiction. The customer is responsible for lawful use and for determining whether a request is limited to motorsport, export, off-road, development or diagnostic applications.",
      kind: "legal",
    },
  },
  {
    slug: "egr-off",
    title: "EGR OFF File Service",
    eyebrow: "EGR / AGR Software Solution",
    description:
      "EGR and AGR file service requests for supported ECUs with diagnostic notes, DTC context and secure file delivery.",
    credits: "6 credits",
    turnaround: "Usually around 30 minutes for standard supported files",
    hero:
      "A structured EGR file request workflow that helps workshops submit the correct technical information the first time.",
    intro: [
      "EGR-related requests often benefit from clear diagnostic notes. The portal lets the customer include DTCs, vehicle data, ECU information and the original file in one place.",
      "The service is designed for repeat workshop use: submit, track status, receive file versions and request revision when required.",
    ],
    benefits: [
      "Supports EGR / AGR-related file requests for many diesel ECU families",
      "DTC and workshop notes can be submitted together",
      "Customer can monitor file status in real time",
      "Secure dashboard delivery keeps files out of email threads",
    ],
    process: [
      {
        title: "Vehicle identification",
        text: "Customer selects the vehicle and adds ECU/HW/SW details where possible.",
      },
      {
        title: "Fault context",
        text: "Any EGR-related DTCs, symptoms or workshop findings can be added to the request notes.",
      },
      {
        title: "File check and preparation",
        text: "The original file and request details are reviewed before the modified file is prepared.",
      },
      {
        title: "Download completed file",
        text: "The final file is delivered in the order detail page with version history when applicable.",
      },
    ],
    supported: ["BMW", "Mercedes-Benz", "Audi", "VW", "Skoda", "Seat", "Opel", "Renault", "Peugeot"],
    requiredInfo: [
      "Original ECU file",
      "EGR-related DTCs if present",
      "Read method",
      "ECU family or HW/SW details",
      "Vehicle engine and model year",
    ],
    faq: [
      {
        q: "Can EGR OFF be ordered alone?",
        a: "Yes. It can also be combined with other supported services depending on the vehicle and ECU.",
      },
      {
        q: "What happens if information is missing?",
        a: "The order can be marked as customer info needed so the workshop knows exactly what to provide.",
      },
    ],
    notice: {
      title: "Confirm lawful use before submission",
      text: "EGR or AGR-related software changes may be restricted or prohibited for public-road vehicles. Legal requirements vary by jurisdiction, and the customer is responsible for confirming an allowed motorsport, export, off-road, development or diagnostic context.",
      kind: "legal",
    },
  },
  {
    slug: "adblue-off",
    title: "AdBlue OFF File Service",
    eyebrow: "SCR / AdBlue Request Workflow",
    description:
      "AdBlue and SCR-related file service workflow for supported vehicles with clear status tracking and secure delivery.",
    credits: "11 credits",
    turnaround: "Usually around 30 minutes when file and vehicle data are clear",
    hero:
      "A professional AdBlue request process for workshops that need controlled communication, technical notes and file delivery in one portal.",
    intro: [
      "AdBlue and SCR-related requests can be sensitive to vehicle details, diagnostic state and ECU type. The portal makes those details part of the request instead of scattered across messages.",
      "Customers can upload the original file, choose the service, add notes and then follow the order timeline until delivery.",
    ],
    benefits: [
      "Dedicated workflow for SCR / AdBlue-related service requests",
      "Status timeline reduces repeated follow-up messages",
      "Credits and payment history stay connected to the customer account",
      "Completed file versions remain visible in the order detail",
    ],
    process: [
      {
        title: "Request created",
        text: "Customer submits vehicle details, selected service and original file.",
      },
      {
        title: "File check",
        text: "The file and notes are reviewed to confirm the request can continue.",
      },
      {
        title: "In progress",
        text: "The selected AdBlue / SCR service request is prepared for the submitted file.",
      },
      {
        title: "Completed",
        text: "Customer downloads the modified file and can request revision if required.",
      },
    ],
    supported: ["Mercedes CDI", "BMW Diesel", "VAG TDI", "Opel Diesel", "Renault Diesel", "Peugeot HDI"],
    requiredInfo: [
      "Original ECU file",
      "AdBlue / SCR fault codes where available",
      "Vehicle model, engine and year",
      "Read method",
      "Notes about warning countdowns or system condition",
    ],
    faq: [
      {
        q: "Can AdBlue be combined with DPF or EGR services?",
        a: "Yes, combined service selections are available for supported requests.",
      },
      {
        q: "Why does this use more credits?",
        a: "SCR / AdBlue-related requests can require more review depending on vehicle platform, ECU and diagnostic context.",
      },
    ],
    notice: {
      title: "SCR and AdBlue requirements vary by jurisdiction",
      text: "SCR or AdBlue deactivation may be restricted or prohibited for public-road use. The customer must confirm the lawful application and remains responsible for any motorsport, export, off-road, development or diagnostic use declared in the request.",
      kind: "legal",
    },
  },
  {
    slug: "dtc-off",
    title: "DTC OFF File Service",
    eyebrow: "Diagnostic Trouble Code Solution",
    description:
      "DTC-related ECU file requests with structured fault code notes, file check support and secure customer delivery.",
    credits: "4 credits",
    turnaround: "Usually fast when codes and file details are clear",
    hero:
      "A clean DTC request workflow for workshops that need specific diagnostic trouble code handling and clear file communication.",
    intro: [
      "DTC OFF requests depend heavily on exact fault code information. The customer can submit the fault codes and workshop notes directly inside the file request.",
      "This helps keep the job focused: which code, which ECU, which vehicle, what file and what context. The result is easier review and cleaner communication.",
    ],
    benefits: [
      "Designed for specific diagnostic trouble code requests",
      "Low-credit service option for focused file work",
      "Works well as an add-on to other file services",
      "Request notes stay attached to the order for admin review",
    ],
    process: [
      {
        title: "Add exact DTCs",
        text: "Customer adds the exact fault code list and related notes before submitting.",
      },
      {
        title: "Attach original file",
        text: "The original ECU file is uploaded to the request for review.",
      },
      {
        title: "Technical handling",
        text: "The request is prepared according to the submitted DTC scope.",
      },
      {
        title: "Secure delivery",
        text: "The completed file is delivered in the dashboard, not through uncontrolled email attachments.",
      },
    ],
    supported: ["BMW", "Mercedes-Benz", "Audi", "VW", "Porsche", "Opel", "Renault", "Peugeot"],
    requiredInfo: [
      "Exact DTC code list",
      "Original ECU file",
      "Vehicle and ECU details",
      "Read method",
      "Short note about fault context",
    ],
    faq: [
      {
        q: "Can DTC OFF be added to another service?",
        a: "Yes. DTC-related requests are often combined with performance or aftertreatment services where supported.",
      },
      {
        q: "Do you need exact fault codes?",
        a: "Yes. Exact DTCs help avoid unclear requests and make the file review more efficient.",
      },
    ],
    notice: {
      title: "Diagnose the underlying fault first",
      text: "A DTC software change does not repair a mechanical, electrical or emissions-system fault. Exact codes and diagnostic context must be supplied, and unresolved root causes should be investigated before a DTC request is considered.",
      kind: "diagnostic",
    },
  },
];

function getService(slug: string) {
  return services.find((service) => service.slug === slug);
}

export function generateStaticParams() {
  return [
    ...services.map((service) => ({ slug: service.slug })),
    ...serviceIntentGuideSlugs.map((slug) => ({ slug })),
  ];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const intentGuide = getServiceIntentGuide(slug);

  if (intentGuide) {
    const canonical = absoluteUrl(`/services/${intentGuide.slug}`);
    const socialTitle = `${intentGuide.metaTitle} | MG AutoTech`;

    return {
      title: intentGuide.metaTitle,
      description: intentGuide.description,
      alternates: { canonical },
      openGraph: {
        title: socialTitle,
        description: intentGuide.description,
        url: canonical,
        siteName,
        type: "website",
        images: [
          {
            url: absoluteUrl("/opengraph-image"),
            width: 1200,
            height: 630,
            alt: intentGuide.name,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: socialTitle,
        description: intentGuide.description,
        images: [absoluteUrl("/opengraph-image")],
      },
    };
  }

  const service = getService(slug);

  if (!service) return {};

  const canonical = absoluteUrl(`/services/${service.slug}`);
  const socialTitle = `${service.title} | MG AutoTech`;

  return {
    title: service.title,
    description: service.description,
    alternates: {
      canonical,
      languages: languageAlternates(`/services/${service.slug}`),
    },
    openGraph: {
      title: socialTitle,
      description: service.description,
      url: canonical,
      siteName,
      type: "website",
      images: [
        {
          url: absoluteUrl("/opengraph-image"),
          width: 1200,
          height: 630,
          alt: service.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description: service.description,
      images: [absoluteUrl("/opengraph-image")],
    },
  };
}

export default async function ServicePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const intentGuide = getServiceIntentGuide(slug);

  if (intentGuide) return <ServiceIntentPage guide={intentGuide} />;

  const service = getService(slug);

  if (!service) notFound();

  const pageUrl = absoluteUrl(`/services/${service.slug}`);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      organizationJsonLd(),
      websiteJsonLd("en"),
      {
        "@type": "WebPage",
        "@id": `${pageUrl}#page`,
        name: service.title,
        description: service.description,
        url: pageUrl,
        inLanguage: "en",
        isPartOf: { "@id": `${absoluteUrl("/")}#website` },
        mainEntity: { "@id": `${pageUrl}#service` },
        breadcrumb: { "@id": `${pageUrl}#breadcrumb` },
      },
      {
        "@type": "Service",
        "@id": `${pageUrl}#service`,
        name: service.title,
        description: service.description,
        serviceType: service.title,
        category: service.slug === "stage-1" ? "Stage 1 ECU tuning file service" : service.title,
        audience: service.slug === "stage-1"
          ? { "@type": "Audience", audienceType: "Automotive workshops and tuning professionals" }
          : undefined,
        provider: { "@id": `${absoluteUrl("/")}#organization` },
        url: pageUrl,
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${pageUrl}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: "ECU File Service", item: absoluteUrl("/file-service") },
          { "@type": "ListItem", position: 3, name: service.title, item: pageUrl },
        ],
      },
      {
        "@type": "FAQPage",
        "@id": `${pageUrl}#faq`,
        mainEntity: service.faq.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      },
      ...(service.slug === "stage-1"
        ? [
            {
              "@type": "ItemList",
              "@id": `${pageUrl}#stage-1-technical-routes`,
              name: "Stage 1 vehicle and ECU technical guides",
              itemListElement: [...stage1BrandRoutes, ...stage1PlatformRoutes].map((item, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: item.label,
                url: absoluteUrl(item.href),
              })),
            },
          ]
        : []),
    ],
  };

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_20%_0%,rgba(160,18,28,0.26),transparent_32%),linear-gradient(135deg,#050505,#0d0d0f_48%,#160608)]" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PublicSeoHeader />

      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-2 text-xs font-bold text-zinc-500">
              <Link href="/" className="transition hover:text-white">Home</Link>
              <span aria-hidden="true">/</span>
              <Link href="/file-service" className="transition hover:text-white">ECU File Service</Link>
              <span aria-hidden="true">/</span>
              <span className="text-zinc-300" aria-current="page">{service.title}</span>
            </nav>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-red-800/50 bg-red-950/25 px-4 py-2 text-sm font-black text-red-100">
              <BadgeCheck className="h-4 w-4 text-red-500" />
              {service.eyebrow}
            </div>
            <h1 className="max-w-4xl text-5xl font-black leading-tight md:text-7xl">
              {service.title}
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-300">
              {service.hero}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/new-request"
                className="inline-flex items-center justify-center rounded-xl bg-[#b1121b] px-6 py-4 text-sm font-black text-white shadow-xl shadow-red-950/40 transition hover:bg-[#c91824]"
              >
                {service.slug === "stage-1" ? "Start Stage 1 Request" : "Create File Request"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-6 py-4 text-sm font-black text-white transition hover:bg-white/10"
              >
                Create Customer Account
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30">
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoCard icon={Wrench} label="Credit price" value={service.credits} />
              <InfoCard icon={Clock3} label="Delivery estimate" value={service.turnaround} />
              <InfoCard icon={ShieldCheck} label="File delivery" value="Secure portal" />
              <InfoCard icon={Gauge} label="Workflow" value="Tracked status" />
            </div>
          </div>
        </div>
      </section>

      {service.notice && (
        <section className="mx-auto max-w-7xl px-4 pb-12" aria-label={service.notice.title}>
          <div className={`flex items-start gap-4 rounded-lg border p-5 ${service.notice.kind === "legal" ? "border-amber-700/50 bg-amber-950/20" : "border-sky-800/50 bg-sky-950/20"}`}>
            <CircleAlert className={`mt-0.5 h-6 w-6 shrink-0 ${service.notice.kind === "legal" ? "text-amber-300" : "text-sky-300"}`} aria-hidden="true" />
            <div>
              <h2 className="text-lg font-black">{service.notice.title}</h2>
              <p className="mt-2 max-w-5xl text-sm leading-7 text-zinc-300">{service.notice.text}</p>
            </div>
          </div>
        </section>
      )}

      {service.slug === "stage-1" && <Stage1Authority />}

      {service.slug === "stage-1" && <StageComparison compact />}

      <section className="mx-auto grid max-w-7xl gap-6 px-4 pb-20 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-3xl font-black">What this service is for</h2>
          <div className="mt-5 space-y-4">
            {service.intro.map((text) => (
              <p key={text} className="text-sm leading-7 text-zinc-400">
                {text}
              </p>
            ))}
          </div>

          <div className="mt-8 grid gap-3">
            {service.benefits.map((item) => (
              <div key={item} className="flex gap-3 rounded-2xl border border-white/10 bg-black/30 p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                <div className="text-sm font-bold leading-6 text-zinc-200">{item}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-red-900/50 bg-gradient-to-br from-red-950/25 via-white/[0.04] to-black p-6">
          <h2 className="text-3xl font-black">Professional file workflow</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {service.process.map((step, index) => (
              <div key={step.title} className="rounded-2xl border border-white/10 bg-black/30 p-5">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-red-950/50 text-sm font-black text-red-300">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <h3 className="text-lg font-black">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#0b1226] py-18">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 lg:grid-cols-3">
          <DetailPanel title="Supported vehicle focus" items={service.supported} icon={Car} />
          <DetailPanel title="Information needed" items={service.requiredInfo} icon={FileCode2} />
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
            <Upload className="mb-5 h-8 w-8 text-red-500" />
            <h2 className="text-2xl font-black">Ready to submit?</h2>
            <p className="mt-3 text-sm leading-7 text-zinc-400">
              Create an account, buy credits and submit the original file with vehicle details. The request can then be tracked from the customer dashboard.
            </p>
            <Link
              href="/register"
              className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-[#b1121b] px-5 py-4 text-sm font-black text-white transition hover:bg-[#c91824]"
            >
              Start Secure Request
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-20">
        <div className="mb-8 text-center">
          <div className="text-sm font-black uppercase tracking-[0.25em] text-red-600">
            FAQ
          </div>
          <h2 className="mt-3 text-4xl font-black">Common questions</h2>
        </div>
        <div className="grid gap-4">
          {service.faq.map((item) => (
            <div key={item.q} className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <h3 className="text-lg font-black">{item.q}</h3>
              <p className="mt-2 text-sm leading-7 text-zinc-400">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <Footer />
      <OnlineStatus />
    </main>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Wrench;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
      <Icon className="mb-4 h-7 w-7 text-red-500" />
      <div className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </div>
      <div className="mt-2 text-lg font-black text-white">{value}</div>
    </div>
  );
}

function DetailPanel({
  title,
  items,
  icon: Icon,
}: {
  title: string;
  items: string[];
  icon: typeof Wrench;
}) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
      <Icon className="mb-5 h-8 w-8 text-red-500" />
      <h2 className="text-2xl font-black">{title}</h2>
      <div className="mt-5 grid gap-3">
        {items.map((item) => (
          <div key={item} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-bold text-zinc-300">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
