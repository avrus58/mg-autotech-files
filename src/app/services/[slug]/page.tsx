import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Car,
  CheckCircle2,
  Clock3,
  Cpu,
  FileCode2,
  Gauge,
  ShieldCheck,
  Upload,
  Wrench,
} from "lucide-react";
import { Footer } from "@/components/Footer";
import { OnlineStatus } from "@/components/OnlineStatus";
import { languageAlternates } from "@/lib/seo";

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
};

const services: ServicePage[] = [
  {
    slug: "stage-1",
    title: "Stage 1 ECU File Service",
    eyebrow: "Performance Calibration",
    description:
      "Professional Stage 1 ECU file preparation for workshops and tuning partners using a secure credit-based workflow.",
    credits: "10 credits",
    turnaround: "Usually around 30 minutes for standard requests",
    hero:
      "A clean Stage 1 file service workflow for stock vehicles where drivability, torque delivery and safe calibration structure matter.",
    intro: [
      "Stage 1 is designed for vehicles with original hardware or light supporting modifications. The goal is a stronger, smoother calibration while keeping the request process clear for the workshop.",
      "MG AutoTech handles the file request through a controlled portal: the customer uploads the original ECU file, selects the vehicle and read method, adds technical notes, and receives the completed file through the dashboard.",
    ],
    benefits: [
      "Improved torque and power delivery for suitable stock hardware",
      "Workshop-friendly request flow with file versions and revision support",
      "Credit-based checkout with Stripe card payment and bank transfer options",
      "Secure customer portal for uploads, status tracking and completed file delivery",
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
        text: "The request is checked and prepared according to the selected Stage 1 service and submitted technical notes.",
      },
      {
        title: "Delivery and revision",
        text: "The completed modified file is delivered in the order detail view. If needed, the customer can request a revision.",
      },
    ],
    supported: ["BMW", "Mercedes-Benz", "Audi", "Volkswagen", "Porsche", "Opel", "Renault", "Peugeot"],
    requiredInfo: [
      "Original ECU file",
      "Vehicle model and engine",
      "ECU type or HW/SW where available",
      "Read method such as OBD, Bench or Boot",
      "Any hardware modifications or special notes",
    ],
    faq: [
      {
        q: "Is Stage 1 suitable for every vehicle?",
        a: "No. Suitability depends on ECU type, file quality, vehicle condition and hardware setup. A file check may be needed for unclear requests.",
      },
      {
        q: "How fast is delivery?",
        a: "Standard Stage 1 requests are usually handled quickly, often around 30 minutes, but complex files or busy workload can take longer.",
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
  },
];

function getService(slug: string) {
  return services.find((service) => service.slug === slug);
}

export function generateStaticParams() {
  return services.map((service) => ({ slug: service.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = getService(slug);

  if (!service) return {};

  return {
    title: service.title,
    description: service.description,
    alternates: {
      canonical: `/services/${service.slug}`,
      languages: languageAlternates(`/services/${service.slug}`),
    },
    openGraph: {
      title: service.title,
      description: service.description,
      url: `https://file.mgautotech.de/services/${service.slug}`,
      type: "website",
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: service.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: service.title,
      description: service.description,
      images: ["/opengraph-image"],
    },
  };
}

export default async function ServicePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = getService(slug);

  if (!service) notFound();

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_20%_0%,rgba(160,18,28,0.26),transparent_32%),linear-gradient(135deg,#050505,#0d0d0f_48%,#160608)]" />

      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-800/50 bg-[#111]">
              <Cpu className="h-7 w-7 text-red-600" />
            </div>
            <div>
              <div className="text-xl font-black tracking-wide">
                MG <span className="text-red-600">AUTOTECH</span>
              </div>
              <div className="text-xs text-zinc-400">ECU / TCU File Service</div>
            </div>
          </Link>

          <Link
            href="/register"
            className="rounded-xl bg-[#b1121b] px-5 py-3 text-sm font-black text-white transition hover:bg-[#c91824]"
          >
            Start Request
            <ArrowRight className="ml-2 inline h-4 w-4" />
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
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
                href="/register"
                className="inline-flex items-center justify-center rounded-xl bg-[#b1121b] px-6 py-4 text-sm font-black text-white shadow-xl shadow-red-950/40 transition hover:bg-[#c91824]"
              >
                Create Customer Account
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                href="/#tools"
                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-6 py-4 text-sm font-black text-white transition hover:bg-white/10"
              >
                Check Log Tools
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
