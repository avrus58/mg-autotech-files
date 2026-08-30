"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Check,
  ChevronDown,
  CircleDot,
  Cpu,
  CreditCard,
  Download,
  FileCheck2,
  FileCode2,
  Gauge,
  LayoutDashboard,
  LockKeyhole,
  LogIn,
  LogOut,
  Menu,
  MessageCircle,
  Search,
  ShieldCheck,
  Upload,
  UserPlus,
  Wrench,
} from "lucide-react";
import { Footer } from "@/components/Footer";
import { DeferredPerformanceTools } from "@/components/tools/DeferredPerformanceTools";
import { VehicleIntelligence } from "@/components/homepage/VehicleIntelligence";
import {
  homepageSessionEvent,
  type HomepageSessionDetail,
} from "@/lib/homepageSessionEvents";
import type { LocaleCode } from "@/lib/i18nConfig";
import {
  HomepageLocalizationProvider,
  LocalizedHomepageTree,
  translateHomepageText,
  type HomepageTranslationCatalog,
} from "@/lib/homepageLocalization";

const HomepageSessionBridge = dynamic(
  () =>
    import("@/components/HomepageSessionBridge").then(
      (module) => module.HomepageSessionBridge
    ),
  { ssr: false }
);

const OnlineStatus = dynamic(
  () =>
    import("@/components/OnlineStatus").then(
      (module) => module.OnlineStatus
    ),
  { ssr: false }
);

const services = [
  {
    title: "Stage 1",
    text: "Performance optimization for stock vehicles.",
    credits: "10 Credits",
    href: "/services/stage-1",
    tag: "Performance",
    icon: Gauge,
  },
  {
    title: "DPF OFF",
    text: "Technical software solution for diesel vehicles.",
    credits: "6 Credits",
    href: "/services/dpf-off",
    tag: "Diesel",
    icon: FileCode2,
  },
  {
    title: "EGR / AGR OFF",
    text: "EGR related software solution and DTC support.",
    credits: "6 Credits",
    href: "/services/egr-off",
    tag: "Airflow",
    icon: Wrench,
  },
  {
    title: "AdBlue OFF",
    text: "SCR / AdBlue software solution for supported ECUs.",
    credits: "11 Credits",
    href: "/services/adblue-off",
    tag: "SCR",
    icon: ShieldCheck,
  },
  {
    title: "DTC OFF",
    text: "Diagnostic trouble code removal by request.",
    credits: "4 Credits",
    href: "/services/dtc-off",
    tag: "Diagnostic",
    icon: FileCheck2,
  },
  {
    title: "TCU Tuning",
    text: "Gearbox software optimization for supported TCUs.",
    credits: "Manual",
    href: "/services/tcu-tuning",
    tag: "Gearbox",
    icon: Cpu,
  },
] as const;

const serviceDiscoveryLinks = [
  { label: "Compare Stage 1–3", href: "/file-service#stage-comparison" },
  { label: "Stage 2 File Service", href: "/services/stage-2" },
  { label: "Stage 3 Custom Calibration", href: "/services/stage-3" },
  { label: "ECU File Check", href: "/services/ecu-file-check" },
  { label: "File Service Hub", href: "/file-service" },
] as const;

const workflowSteps = [
  {
    icon: UserPlus,
    title: "Register",
    text: "Create your customer account inside the MG AutoTech portal.",
  },
  {
    icon: CreditCard,
    title: "Load Credits",
    text: "Buy credits and use them for file service requests.",
  },
  {
    icon: Upload,
    title: "Upload File",
    text: "Upload original ECU/TCU file and vehicle information.",
  },
  {
    icon: Download,
    title: "Download File",
    text: "Track the status and download the completed file.",
  },
] as const;

const preparationTools = [
  {
    title: "File readiness check",
    text: "Confirm the request details before you upload.",
    href: "/tools/file-readiness-check",
    action: "Check readiness",
    icon: FileCheck2,
  },
  {
    title: "Request brief builder",
    text: "Organize vehicle, ECU, read method and workshop notes.",
    href: "/tools/request-brief-builder",
    action: "Build a brief",
    icon: MessageCircle,
  },
  {
    title: "ECU read method advisor",
    text: "Clarify OBD, bench or boot context before submission.",
    href: "/tools/ecu-read-method-advisor",
    action: "Plan the read",
    icon: Search,
  },
] as const;

const trustHighlights = [
  {
    title: "Secure file handling",
    text: "Original and modified files stay connected to the customer account.",
    icon: ShieldCheck,
  },
  {
    title: "Human-reviewed workflow",
    text: "Vehicle, ECU, read method and request notes remain part of the review.",
    icon: BadgeCheck,
  },
  {
    title: "Order tracking",
    text: "Status, customer-visible messages and delivery stay in one private workspace.",
    icon: LayoutDashboard,
  },
  {
    title: "Workshop focused",
    text: "Built for repeat orders, technical notes and ECU/TCU file workflows.",
    icon: Wrench,
  },
] as const;

const supportedBrands = [
  { name: "BMW", code: "BM", note: "MD1 · EDC17 · MG1", href: "/brands/bmw" },
  { name: "Mercedes-Benz", code: "MB", note: "CDI · MED · VGS", href: "/brands/mercedes-benz" },
  { name: "Audi", code: "AU", note: "VAG ECU · TCU", href: "/brands/audi" },
  { name: "Volkswagen", code: "VW", note: "EDC · Simos · DSG", href: "/brands/volkswagen" },
  { name: "Porsche", code: "PO", note: "ECU · PDK", href: "/brands/porsche" },
  { name: "Opel", code: "OP", note: "Diesel · Petrol", href: "/brands/opel" },
  { name: "Renault", code: "RE", note: "ECU solutions", href: "/brands/renault" },
  { name: "Peugeot", code: "PE", note: "BlueHDi support", href: "/brands/peugeot" },
] as const;

const ecuPlatforms = [
  { name: "Bosch EDC17", tag: "Diesel ECU", href: "/ecu-platforms/bosch-edc17" },
  { name: "Bosch MD1", tag: "Modern diesel", href: "/ecu-platforms/bosch-md1" },
  { name: "Bosch MG1", tag: "Petrol ECU", href: "/ecu-platforms/bosch-mg1" },
  { name: "Continental SIMOS", tag: "VAG petrol", href: "/ecu-platforms/continental-simos" },
  { name: "Continental SID", tag: "Diesel ECU", href: "/ecu-platforms/continental-sid" },
  { name: "Delphi DCM", tag: "Diesel ECU", href: "/ecu-platforms/delphi-dcm" },
  { name: "Denso", tag: "ECU family", href: "/ecu-platforms/denso" },
  { name: "TCU & Gearbox", tag: "Transmission", href: "/ecu-platforms/transmission-control-units" },
] as const;

const faqs = [
  {
    question: "What should I prepare before sending an ECU or TCU file request?",
    answer:
      "Prepare the vehicle brand, model, engine, ECU or TCU information when available, read method, selected service and a short technical note. The public preparation tools can help organize this before the secure request is created.",
  },
  {
    question: "Do the public preparation tools upload or modify my ECU file?",
    answer:
      "No. A file-based public check reads only the compatible text datalog you explicitly choose and processes it locally in this browser. Original-file submission starts only inside the authenticated request flow.",
  },
  {
    question: "How is a completed file delivered?",
    answer:
      "Completed files are delivered through the private customer dashboard. Customers can track the request status, see customer-visible messages and download delivered files only from their own account.",
  },
  {
    question: "Can I create a request if my vehicle is not in the public selector?",
    answer:
      "Yes. If the exact vehicle or engine is not available in the selector, customers can use the manual vehicle request path and provide the missing technical details for review.",
  },
] as const;

const resourceLinks = [
  {
    title: "Workshop Tools",
    text: "Calculators and request-preparation utilities.",
    href: "/tools",
    icon: Gauge,
  },
  {
    title: "Workshop Guides",
    text: "Practical ECU, TCU and request guidance.",
    href: "/workshop-guides",
    icon: BookOpen,
  },
  {
    title: "Vehicle Widget",
    text: "Bring the published vehicle catalog into your site.",
    href: "/widget",
    icon: Cpu,
  },
] as const;

type PublicCreditPackage = {
  id: string;
  name: string;
  credits: number;
  priceEuro: number;
  unitPriceEuro: number;
  description: string;
  highlight: boolean;
};

type PublicCreditQuote = {
  currency: "EUR";
  promotionLabel: string | null;
  customUnitPriceEuro: number;
  packages: PublicCreditPackage[];
};

type PublicCreditQuoteState =
  | { status: "loading"; quote: null; message: "" }
  | { status: "ready"; quote: PublicCreditQuote; message: "" }
  | { status: "error"; quote: null; message: string };

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function parsePublicCreditQuote(value: unknown): PublicCreditQuote | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const quote = value as Partial<PublicCreditQuote>;
  if (
    quote.currency !== "EUR" ||
    !isPositiveFiniteNumber(quote.customUnitPriceEuro) ||
    (quote.promotionLabel !== null && typeof quote.promotionLabel !== "string") ||
    !Array.isArray(quote.packages) ||
    quote.packages.length === 0
  ) {
    return null;
  }

  const packages = quote.packages.filter(
    (item): item is PublicCreditPackage =>
      Boolean(item) &&
      typeof item.id === "string" &&
      typeof item.name === "string" &&
      typeof item.description === "string" &&
      typeof item.highlight === "boolean" &&
      Number.isInteger(item.credits) &&
      item.credits > 0 &&
      isPositiveFiniteNumber(item.priceEuro) &&
      isPositiveFiniteNumber(item.unitPriceEuro)
  );

  if (packages.length !== quote.packages.length) return null;
  return {
    currency: "EUR",
    promotionLabel: quote.promotionLabel,
    customUnitPriceEuro: quote.customUnitPriceEuro,
    packages,
  };
}

const publicResourceUrl = (href: string) => `https://file.mgautotech.de${href}`;

export const homepagePageJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "@id": publicResourceUrl("/#page"),
  name: "MG AutoTech ECU & TCU File Service",
  description:
    "Secure online ECU and TCU file service with vehicle data, workshop tools, credit pricing and private order delivery.",
  url: publicResourceUrl("/"),
  inLanguage: "en",
  isPartOf: { "@id": publicResourceUrl("/#website") },
  about: { "@id": publicResourceUrl("/#organization") },
  hasPart: [
    { "@id": publicResourceUrl("/#services") },
    { "@id": publicResourceUrl("/#workflow") },
    { "@id": publicResourceUrl("/#homepage-search-faq") },
  ],
};

export const homepageFileServiceJsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  "@id": publicResourceUrl("/#services"),
  name: "MG AutoTech ECU and TCU file service",
  provider: { "@id": publicResourceUrl("/#organization") },
  areaServed: { "@type": "Place", name: "Europe" },
  url: publicResourceUrl("/"),
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Visible file service categories",
    itemListElement: services.map((service, index) => ({
      "@type": "Offer",
      position: index + 1,
      itemOffered: {
        "@type": "Service",
        name: service.title,
        description: service.text,
        url: publicResourceUrl(service.href),
      },
    })),
  },
};

export const homepageFaqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": publicResourceUrl("/#homepage-search-faq"),
  mainEntity: faqs.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
};

export const homepageRequestPreparationHowToJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  "@id": publicResourceUrl("/#workflow"),
  name: "How to use the MG AutoTech file service",
  step: workflowSteps.map((step, index) => ({
    "@type": "HowToStep",
    position: index + 1,
    name: step.title,
    text: step.text,
  })),
};

function formatEuro(value: number, locale: LocaleCode) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCreditUnitEuro(value: number, locale: LocaleCode) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

export type HomepageExperienceProps = {
  locale?: LocaleCode;
  translationCatalog?: HomepageTranslationCatalog;
  includeStructuredData?: boolean;
};

export function HomepageExperience({
  locale = "en",
  translationCatalog,
  includeStructuredData = true,
}: HomepageExperienceProps = {}) {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [sessionRuntimeReady, setSessionRuntimeReady] = useState(false);
  const [publicCreditQuote, setPublicCreditQuote] = useState<PublicCreditQuoteState>({
    status: "loading",
    quote: null,
    message: "",
  });
  const publicCreditQuoteRequest = useRef(0);

  const loadPublicCreditQuote = useCallback(async () => {
    const requestId = publicCreditQuoteRequest.current + 1;
    publicCreditQuoteRequest.current = requestId;
    setPublicCreditQuote({ status: "loading", quote: null, message: "" });

    try {
      const response = await fetch("/api/credits/public-quote", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          payload && typeof payload.error === "string"
            ? payload.error
            : "Live credit pricing is temporarily unavailable."
        );
      }
      const quote = parsePublicCreditQuote(payload?.quote);
      if (!quote) throw new Error("Live credit pricing could not be verified.");
      if (requestId === publicCreditQuoteRequest.current) {
        setPublicCreditQuote({ status: "ready", quote, message: "" });
      }
    } catch (error) {
      if (requestId === publicCreditQuoteRequest.current) {
        setPublicCreditQuote({
          status: "error",
          quote: null,
          message:
            error instanceof Error
              ? error.message
              : "Live credit pricing is temporarily unavailable.",
        });
      }
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadPublicCreditQuote(), 0);
    return () => {
      window.clearTimeout(timeout);
      publicCreditQuoteRequest.current += 1;
    };
  }, [loadPublicCreditQuote]);

  useEffect(() => {
    const handleSession = (event: Event) => {
      const detail = (event as CustomEvent<HomepageSessionDetail>).detail;
      setUserEmail(detail.email);
    };
    window.addEventListener(homepageSessionEvent, handleSession);

    const idleWindow = window as typeof window & {
      requestIdleCallback?: (
        callback: () => void,
        options?: { timeout: number }
      ) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    let cancelRuntime: () => void;
    if (idleWindow.requestIdleCallback) {
      const handle = idleWindow.requestIdleCallback(
        () => setSessionRuntimeReady(true),
        { timeout: 1600 }
      );
      cancelRuntime = () => idleWindow.cancelIdleCallback?.(handle);
    } else {
      const timer = window.setTimeout(() => setSessionRuntimeReady(true), 700);
      cancelRuntime = () => window.clearTimeout(timer);
    }

    return () => {
      cancelRuntime();
      window.removeEventListener(homepageSessionEvent, handleSession);
    };
  }, []);

  const handleLogout = async () => {
    const { signOutStable } = await import("@/lib/authGuards");
    await signOutStable();
    setUserEmail(null);
  };

  const isLoggedIn = Boolean(userEmail);
  const localizedText = (value: string) =>
    locale === "en" ? value : translateHomepageText(value, translationCatalog);

  return (
    <HomepageLocalizationProvider locale={locale} catalog={translationCatalog}>
      <LocalizedHomepageTree>
        <div
          data-unified-localized-homepage={locale === "en" ? undefined : locale}
          className="min-h-screen overflow-x-hidden bg-[#050506] text-white [color-scheme:dark]"
        >
          {sessionRuntimeReady && <HomepageSessionBridge />}
          <HomepageHeader
            isLoggedIn={isLoggedIn}
            userEmail={userEmail}
            onLogout={handleLogout}
          />

          <main>
          <section className="relative isolate overflow-hidden border-b border-white/[0.07]">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_72%_14%,rgba(177,18,27,0.24),transparent_26rem),radial-gradient(circle_at_8%_28%,rgba(59,130,246,0.07),transparent_23rem),linear-gradient(180deg,#08080a,#050506)]" />
            <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.18] [background-image:linear-gradient(rgba(255,255,255,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.06)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:linear-gradient(to_bottom,black,transparent_92%)]" />

            <div className="mx-auto grid max-w-[86rem] gap-10 px-4 pb-12 pt-14 sm:px-6 sm:pb-16 sm:pt-20 lg:grid-cols-[1.02fr_.98fr] lg:items-center lg:pb-20 lg:pt-24">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-red-500/25 bg-red-500/[0.08] px-3 py-1.5 text-[0.68rem] font-black uppercase tracking-[0.18em] text-red-200">
                  <CircleDot className="h-3.5 w-3.5 text-red-500" /> Professional online file service platform
                </div>
                <h1 className="mt-6 text-[clamp(2.8rem,7vw,6.5rem)] font-black leading-[0.87] tracking-[-0.065em]">
                  <span className="block">Custom ECU &amp; TCU</span>
                  <span className="block bg-gradient-to-r from-white via-zinc-200 to-red-500 bg-clip-text text-transparent">Tuning Files</span>
                </h1>
                <p className="mt-6 max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">
                  Upload original ECU/TCU files, select your service, track your order and download the completed file directly through the secure MG AutoTech customer portal.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link href="/new-request" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#b1121b] px-6 text-sm font-black text-white shadow-[0_18px_55px_rgba(177,18,27,.22)] transition hover:-translate-y-0.5 hover:bg-[#ce1722] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400">
                    {isLoggedIn ? "Create File Request" : "Start File Request"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                  <Link href="#vehicle-data" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/12 bg-white/[0.035] px-6 text-sm font-black text-white transition hover:border-white/25 hover:bg-white/[0.07]">
                    <Search className="mr-2 h-4 w-4 text-red-400" /> Check vehicle data
                  </Link>
                </div>
                <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs font-bold text-zinc-400">
                  {[
                    "Private customer portal",
                    "Published vehicle data",
                    "Browser-local datalog check",
                  ].map((item) => (
                    <span key={item} className="inline-flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-400" /> {item}
                    </span>
                  ))}
                </div>
              </div>

              <HeroProductPreview />
            </div>

            <div className="mx-auto max-w-[86rem] border-t border-white/[0.07] px-4 sm:px-6">
              <div className="grid divide-y divide-white/[0.07] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                <HeroProof icon={ShieldCheck} label="File access" value="Private account workflow" />
                <HeroProof icon={Gauge} label="Vehicle data" value="Performance and ECU context" />
                <HeroProof icon={LayoutDashboard} label="After submission" value="Track, message and download" />
              </div>
            </div>
          </section>

          <VehicleIntelligence locale={locale} />
          <DeferredPerformanceTools />

          <section id="services" className="scroll-mt-24 bg-[#070709] py-16 sm:py-20">
            <div className="mx-auto max-w-[86rem] px-4 sm:px-6">
              <SectionHeading
                eyebrow="ECU / TCU file service"
                title="The core workshop services, without the clutter."
                text="Choose the closest service route, then provide the exact vehicle and controller context inside the secure request."
                action={{ label: "Services Overview", href: "/services" }}
              />

              <div className="mt-9 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
                {services.map((service) => {
                  const Icon = service.icon;
                  return (
                    <Link key={service.title} href={service.href} className="group relative min-h-48 bg-[#0a0a0c] p-5 transition hover:bg-[#101013] sm:p-6">
                      <div className="flex items-start justify-between gap-4">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/[0.08] text-red-400">
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="rounded-full border border-white/10 px-2.5 py-1 text-[0.62rem] font-black uppercase tracking-[0.14em] text-zinc-400">{service.tag}</span>
                      </div>
                      <h3 className="mt-5 text-xl font-black tracking-tight">{service.title}</h3>
                      <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-400">{service.text}</p>
                      <div className="mt-5 flex items-center justify-between gap-3 text-xs font-black">
                        <span className="text-zinc-400">{service.credits}</span>
                        <span className="inline-flex items-center text-red-400 transition group-hover:translate-x-1">View service <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></span>
                      </div>
                    </Link>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="mr-1 text-xs font-bold text-zinc-400">More routes</span>
                {serviceDiscoveryLinks.map((item) => (
                  <Link key={item.href} href={item.href} className="rounded-full border border-white/10 bg-white/[0.025] px-3 py-2 text-xs font-bold text-zinc-400 transition hover:border-red-500/30 hover:text-white">
                    {item.label}
                  </Link>
                ))}
              </div>

              <div className="mt-10 grid gap-3 lg:grid-cols-3">
                {preparationTools.map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <Link key={tool.href} href={tool.href} className="group flex min-w-0 items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4 transition hover:border-red-500/25 hover:bg-white/[0.04]">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-red-400"><Icon className="h-5 w-5" /></span>
                      <span className="min-w-0">
                        <span className="block text-sm font-black text-white">{tool.title}</span>
                        <span className="mt-1 block text-xs leading-5 text-zinc-400">{tool.text}</span>
                        <span className="mt-2 inline-flex items-center text-xs font-black text-zinc-400 group-hover:text-red-300">{tool.action}<ArrowRight className="ml-1.5 h-3.5 w-3.5" /></span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>

          <section id="workflow" className="scroll-mt-24 border-y border-white/[0.07] bg-[#050506] py-16 sm:py-20">
            <div className="mx-auto grid max-w-[86rem] gap-10 px-4 sm:px-6 xl:grid-cols-[1.06fr_.94fr]">
              <div>
                <SectionHeading
                  eyebrow="How It Works"
                  title="From original file to secure delivery in four clear steps."
                  text="One request keeps the vehicle context, selected service, updates and delivered file together."
                />
                <ol className="mt-9 grid gap-3 sm:grid-cols-2">
                  {workflowSteps.map((step, index) => {
                    const Icon = step.icon;
                    return (
                      <li key={step.title} className="relative rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                        <div className="flex items-center justify-between">
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/[0.1] text-red-400"><Icon className="h-4 w-4" /></span>
                          <span className="text-xs font-black text-zinc-700">0{index + 1}</span>
                        </div>
                        <h3 className="mt-4 text-base font-black">{step.title}</h3>
                        <p className="mt-2 text-xs leading-5 text-zinc-400">{step.text}</p>
                      </li>
                    );
                  })}
                </ol>
              </div>

              <div id="security" className="scroll-mt-24 rounded-[1.75rem] border border-red-500/20 bg-[radial-gradient(circle_at_100%_0%,rgba(177,18,27,.16),transparent_19rem),rgba(255,255,255,.025)] p-5 sm:p-7">
                <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-red-300">
                  <LockKeyhole className="h-4 w-4" /> Why MG AutoTech?
                </div>
                <h2 className="mt-4 text-3xl font-black leading-tight tracking-tight sm:text-4xl">A file service workflow built for serious workshop operations.</h2>
                <div className="mt-7 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2">
                  {trustHighlights.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.title} className="bg-[#0a0a0c] p-4 sm:p-5">
                        <Icon className="h-5 w-5 text-red-400" />
                        <h3 className="mt-3 text-sm font-black">{item.title}</h3>
                        <p className="mt-1.5 text-xs leading-5 text-zinc-400">{item.text}</p>
                      </div>
                    );
                  })}
                </div>
                <Link href="/how-it-works" className="mt-5 inline-flex min-h-11 items-center text-sm font-black text-zinc-300 transition hover:text-white">
                  See the complete workflow <ArrowRight className="ml-2 h-4 w-4 text-red-400" />
                </Link>
              </div>
            </div>
          </section>

          <section className="bg-[#08080a] py-16 sm:py-20">
            <div className="mx-auto max-w-[86rem] px-4 sm:px-6">
              <SectionHeading
                eyebrow="Vehicle coverage"
                title="Brands and controller families in one compact library."
                text="Start with the vehicle selector for exact published data, or browse the public brand and ECU guides."
              />
              <div className="mt-9 grid gap-5 xl:grid-cols-2">
                <CoveragePanel
                  title="Supported Brands"
                  action={{ label: "View all brands", href: "/brands" }}
                >
                  {supportedBrands.map((brand) => (
                    <Link key={brand.name} href={brand.href} className="group flex items-center gap-3 rounded-xl border border-white/8 bg-black/20 p-3 transition hover:border-red-500/25 hover:bg-white/[0.035]">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-[0.65rem] font-black text-red-300">{brand.code}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-black text-zinc-200 group-hover:text-white">{brand.name}</span>
                        <span className="mt-0.5 block truncate text-[0.65rem] text-zinc-400">{brand.note}</span>
                      </span>
                    </Link>
                  ))}
                </CoveragePanel>

                <CoveragePanel
                  title="ECU Platform Library"
                  action={{ label: "View all platforms", href: "/ecu-platforms" }}
                >
                  {ecuPlatforms.map((platform) => (
                    <Link key={platform.name} href={platform.href} className="group flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-black/20 p-3 transition hover:border-red-500/25 hover:bg-white/[0.035]">
                      <span className="min-w-0 truncate text-xs font-black text-zinc-200 group-hover:text-white">{platform.name}</span>
                      <span className="shrink-0 rounded-full bg-white/[0.04] px-2 py-1 text-[0.58rem] font-black uppercase tracking-[0.1em] text-zinc-400">{platform.tag}</span>
                    </Link>
                  ))}
                </CoveragePanel>
              </div>
            </div>
          </section>

          <section id="prices" className="scroll-mt-24 border-y border-white/[0.07] bg-[#050506] py-16 sm:py-20">
            <div className="mx-auto max-w-[86rem] px-4 sm:px-6">
              <SectionHeading
                eyebrow="Credit Prices"
                title="Choose a package. Use credits when you need them."
                text="Prices below are loaded from the live public tariff. Customer-specific pricing, when assigned, is shown after login."
                action={{ label: isLoggedIn ? "Buy Credits" : "Login to buy", href: isLoggedIn ? "/dashboard/credits" : "/login?redirect=%2Fdashboard%2Fcredits" }}
              />

              {publicCreditQuote.status === "loading" && <PricingSkeleton />}

              {publicCreditQuote.status === "error" && (
                <div role="alert" className="mt-8 flex flex-col gap-4 rounded-2xl border border-amber-500/25 bg-amber-500/[0.05] p-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-amber-100">{publicCreditQuote.message} No outdated price is being shown.</p>
                  <button type="button" onClick={() => void loadPublicCreditQuote()} className="min-h-11 rounded-xl border border-amber-300/25 px-4 text-sm font-black text-amber-50 transition hover:bg-amber-300/10">Try again</button>
                </div>
              )}

              {publicCreditQuote.status === "ready" && (
                <>
                  {publicCreditQuote.quote.promotionLabel && (
                    <div className="mt-7 inline-flex rounded-full border border-emerald-500/25 bg-emerald-500/[0.08] px-3 py-1.5 text-xs font-black text-emerald-300">
                      {publicCreditQuote.quote.promotionLabel}
                    </div>
                  )}
                  <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    {publicCreditQuote.quote.packages.map((pack) => (
                      <article key={pack.id} className={`relative flex min-h-56 flex-col rounded-2xl border p-5 ${pack.highlight ? "border-red-500/45 bg-red-500/[0.08]" : "border-white/10 bg-white/[0.025]"}`}>
                        {pack.highlight && <span className="absolute right-3 top-3 rounded-full bg-red-500 px-2 py-1 text-[0.58rem] font-black uppercase tracking-[0.12em]">Popular</span>}
                        <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">{pack.name}</div>
                        <div className="mt-4 text-3xl font-black tracking-tight">{pack.credits}<span className="ml-1 text-sm text-zinc-400">credits</span></div>
                        <div className="mt-2 text-lg font-black text-red-300">{formatEuro(pack.priceEuro, locale)}</div>
                        <p className="mt-2 text-xs leading-5 text-zinc-400">{formatCreditUnitEuro(pack.unitPriceEuro, locale)} per credit</p>
                        <p className="mt-2 line-clamp-2 text-[0.68rem] leading-5 text-zinc-400">{pack.description}</p>
                        <Link aria-label={`${localizedText("Select package")}: ${pack.name}, ${pack.credits} ${localizedText("credits")}`} href={isLoggedIn ? "/dashboard/credits" : "/login?redirect=%2Fdashboard%2Fcredits"} className="mt-auto inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-black transition hover:border-red-500/30 hover:bg-white/[0.07]">
                          Select package <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                        </Link>
                      </article>
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>

          <section className="bg-[#08080a] py-16 sm:py-20">
            <div className="mx-auto grid max-w-[86rem] gap-10 px-4 sm:px-6 xl:grid-cols-[.72fr_1.28fr]">
              <div>
                <SectionHeading
                  eyebrow="Workshop resources"
                  title="Go deeper only when you need to."
                  text="The homepage stays focused; detailed guides and specialist tools now live in their own clear routes."
                />
                <div className="mt-7 grid gap-3">
                  {resourceLinks.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link key={item.href} href={item.href} className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4 transition hover:border-red-500/25 hover:bg-white/[0.04]">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/[0.08] text-red-400"><Icon className="h-5 w-5" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-black">{item.title}</span>
                          <span className="mt-0.5 block text-xs leading-5 text-zinc-400">{item.text}</span>
                        </span>
                        <ArrowRight className="h-4 w-4 shrink-0 text-zinc-700 transition group-hover:translate-x-1 group-hover:text-red-400" />
                      </Link>
                    );
                  })}
                </div>
              </div>

              <div id="homepage-search-faq" className="scroll-mt-24">
                <div className="text-xs font-black uppercase tracking-[0.22em] text-red-400">Frequently asked questions</div>
                <h2 className="mt-3 text-3xl font-black leading-tight tracking-tight sm:text-4xl">The important answers, without another wall of cards.</h2>
                <div className="mt-7 divide-y divide-white/10 rounded-2xl border border-white/10 bg-[#0a0a0c]">
                  {faqs.map((item, index) => (
                    <details key={item.question} className="group p-5 open:bg-white/[0.02]" open={index === 0}>
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-5 text-sm font-black text-zinc-200 marker:hidden">
                        {item.question}
                        <ChevronDown className="h-4 w-4 shrink-0 text-zinc-600 transition group-open:rotate-180 group-open:text-red-400" />
                      </summary>
                      <p className="mt-3 max-w-3xl pr-8 text-sm leading-6 text-zinc-400">{item.answer}</p>
                    </details>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="relative overflow-hidden border-t border-red-500/20 bg-[#090506]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_10%,rgba(239,68,68,.22),transparent_24rem)]" />
            <div className="relative mx-auto flex max-w-[86rem] flex-col gap-7 px-4 py-14 sm:px-6 sm:py-16 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-3xl">
                <div className="text-xs font-black uppercase tracking-[0.2em] text-red-400">Ready to upload a file?</div>
                <h2 className="mt-3 text-3xl font-black leading-tight tracking-tight sm:text-5xl">Put the next request into one clear workflow.</h2>
                <p className="mt-3 text-sm leading-6 text-zinc-400">Select the service, add the vehicle and controller context, then track everything from your dashboard.</p>
              </div>
              <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
                <Link href="/new-request" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#b1121b] px-6 text-sm font-black transition hover:bg-[#ce1722]">Create File Request <ArrowRight className="ml-2 h-4 w-4" /></Link>
                {!isLoggedIn && <Link href="/register" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/15 bg-white/[0.035] px-6 text-sm font-black transition hover:bg-white/[0.07]">Create Account</Link>}
              </div>
            </div>
          </section>
          </main>

          <Footer variant="homepage" />
          <OnlineStatus />

          {includeStructuredData && (
            <>
              {[homepagePageJsonLd, homepageFileServiceJsonLd, homepageFaqJsonLd, homepageRequestPreparationHowToJsonLd].map((schema, index) => (
                <script
                  key={index}
                  type="application/ld+json"
                  dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
                />
              ))}
            </>
          )}
        </div>
      </LocalizedHomepageTree>
    </HomepageLocalizationProvider>
  );
}

function HomepageHeader({
  isLoggedIn,
  userEmail,
  onLogout,
}: {
  isLoggedIn: boolean;
  userEmail: string | null;
  onLogout: () => Promise<void>;
}) {
  const closeMobileMenu = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    const menu = event.currentTarget.closest("details");
    window.setTimeout(() => menu?.removeAttribute("open"), 0);
  };

  const nav = [
    { label: "Services", href: "#services" },
    { label: "Vehicle Data", href: "#vehicle-data" },
    { label: "Datalog", href: "#tools" },
    { label: "Prices", href: "#prices" },
    { label: "How It Works", href: "#workflow" },
  ];

  return (
    <LocalizedHomepageTree>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#050506]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[4.25rem] max-w-[86rem] items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="MG AutoTech home">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10"><Cpu className="h-5 w-5 text-red-500" /></span>
          <span className="min-w-0 leading-none">
            <span className="block truncate text-sm font-black tracking-[0.06em]">MG <span className="text-red-500">AUTOTECH</span></span>
            <span className="mt-1 block truncate text-[0.58rem] font-bold uppercase tracking-[0.12em] text-zinc-400">ECU / TCU File Service</span>
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-lg px-3 py-2 text-xs font-bold text-zinc-400 transition hover:bg-white/[0.05] hover:text-white">{item.label}</Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 sm:flex">
          {isLoggedIn ? (
            <details className="group relative">
              <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 text-xs font-black marker:hidden">
                <LayoutDashboard className="h-4 w-4 text-red-400" /> My Account <ChevronDown className="h-3.5 w-3.5 text-zinc-600 transition group-open:rotate-180" />
              </summary>
              <div className="absolute right-0 top-[calc(100%+.5rem)] w-64 rounded-xl border border-white/10 bg-[#0b0b0d] p-2 shadow-2xl">
                <div className="truncate px-3 py-2 text-[0.68rem] text-zinc-400">{userEmail}</div>
                <Link href="/dashboard" className="flex min-h-10 items-center rounded-lg px-3 text-xs font-black hover:bg-white/[0.05]"><LayoutDashboard className="mr-2 h-4 w-4 text-red-400" /> Customer Dashboard</Link>
                <button type="button" onClick={() => void onLogout()} className="flex min-h-10 w-full items-center rounded-lg px-3 text-left text-xs font-black text-zinc-400 hover:bg-white/[0.05] hover:text-white"><LogOut className="mr-2 h-4 w-4" /> Logout</button>
              </div>
            </details>
          ) : (
            <Link href="/login" className="inline-flex min-h-10 items-center rounded-xl px-3 text-xs font-black text-zinc-300 transition hover:bg-white/[0.05]"><LogIn className="mr-2 h-4 w-4" /> Login</Link>
          )}
          <Link href="/new-request" className="inline-flex min-h-10 items-center rounded-xl bg-[#b1121b] px-4 text-xs font-black transition hover:bg-[#ce1722]">{isLoggedIn ? "New Request" : "Start Request"}<ArrowRight className="ml-2 h-3.5 w-3.5" /></Link>
        </div>

        <details className="group relative lg:hidden">
          <summary aria-label="Open navigation" className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] marker:hidden"><Menu className="h-5 w-5" /></summary>
          <div className="absolute right-0 top-[calc(100%+.55rem)] w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-white/10 bg-[#0b0b0d] p-2 shadow-2xl">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} onClick={closeMobileMenu} className="flex min-h-11 items-center rounded-xl px-3 text-sm font-black text-zinc-300 hover:bg-white/[0.05]">{item.label}</Link>
            ))}
            <div className="my-2 border-t border-white/10" />
            <Link href={isLoggedIn ? "/dashboard" : "/login"} onClick={closeMobileMenu} className="flex min-h-11 items-center rounded-xl px-3 text-sm font-black text-zinc-300 hover:bg-white/[0.05]">{isLoggedIn ? "Customer Dashboard" : "Login"}</Link>
            <Link href="/new-request" onClick={closeMobileMenu} className="mt-1 flex min-h-11 items-center justify-center rounded-xl bg-[#b1121b] px-3 text-sm font-black">Create File Request</Link>
          </div>
        </details>
      </div>
      </header>
    </LocalizedHomepageTree>
  );
}

function HeroProductPreview() {
  const previewSteps = [
    { label: "Vehicle & ECU", meta: "Request context", state: "Ready", icon: Cpu },
    { label: "Original file", meta: "Private upload", state: "Secure", icon: Upload },
    { label: "Status & messages", meta: "Customer workspace", state: "Tracked", icon: MessageCircle },
    { label: "Completed file", meta: "Account delivery", state: "Download", icon: Download },
  ];

  return (
    <LocalizedHomepageTree>
      <div className="relative mx-auto w-full max-w-[39rem] lg:mx-0 lg:ml-auto">
      <div className="absolute -inset-8 -z-10 rounded-full bg-red-600/10 blur-3xl" />
      <div className="overflow-hidden rounded-[1.75rem] border border-white/12 bg-[#0b0b0e]/95 shadow-[0_34px_100px_rgba(0,0,0,.55)]">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <div className="text-xs font-black">Secure request workspace</div>
            <div className="mt-1 text-[0.65rem] text-zinc-400">One workflow from upload to delivery</div>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] px-2.5 py-1 text-[0.6rem] font-black uppercase tracking-[0.12em] text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Portal online</span>
        </div>
        <div className="p-4 sm:p-5">
          <div className="grid gap-2 sm:grid-cols-2">
            {previewSteps.map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-xl border border-white/8 bg-white/[0.025] p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/[0.08] text-red-400"><Icon className="h-4 w-4" /></span>
                    <span className="text-[0.58rem] font-black text-zinc-700">0{index + 1}</span>
                  </div>
                  <div className="mt-3 text-xs font-black">{item.label}</div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-[0.62rem]">
                    <span className="text-zinc-400">{item.meta}</span>
                    <span className="font-black text-emerald-400">{item.state}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3">
            <span className="min-w-0">
              <span className="block truncate text-xs font-black">Files stay with the customer request</span>
              <span className="mt-0.5 block text-[0.62rem] text-zinc-400">Status, messages, revisions and delivery</span>
            </span>
            <LockKeyhole className="h-4 w-4 shrink-0 text-red-400" />
          </div>
        </div>
      </div>
      </div>
    </LocalizedHomepageTree>
  );
}

function HeroProof({ icon: Icon, label, value }: { icon: typeof ShieldCheck; label: string; value: string }) {
  return (
    <LocalizedHomepageTree>
      <div className="flex items-center gap-3 py-4 sm:px-5 sm:first:pl-0">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-red-400"><Icon className="h-4 w-4" /></span>
      <span>
        <span className="block text-[0.6rem] font-black uppercase tracking-[0.14em] text-zinc-400">{label}</span>
        <span className="mt-0.5 block text-xs font-black text-zinc-300">{value}</span>
      </span>
      </div>
    </LocalizedHomepageTree>
  );
}

function SectionHeading({
  eyebrow,
  title,
  text,
  action,
}: {
  eyebrow: string;
  title: string;
  text: string;
  action?: { label: string; href: string };
}) {
  return (
    <LocalizedHomepageTree>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl">
        <div className="text-xs font-black uppercase tracking-[0.22em] text-red-400">{eyebrow}</div>
        <h2 className="mt-3 text-3xl font-black leading-[1.05] tracking-tight sm:text-4xl lg:text-5xl">{title}</h2>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">{text}</p>
      </div>
      {action && (
        <Link href={action.href} className="inline-flex min-h-11 w-fit items-center text-sm font-black text-zinc-300 transition hover:text-white">
          {action.label}<ArrowRight className="ml-2 h-4 w-4 text-red-400" />
        </Link>
      )}
      </div>
    </LocalizedHomepageTree>
  );
}

function CoveragePanel({
  title,
  action,
  children,
}: {
  title: string;
  action: { label: string; href: string };
  children: React.ReactNode;
}) {
  return (
    <LocalizedHomepageTree>
      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h3 className="text-sm font-black">{title}</h3>
        <Link href={action.href} className="inline-flex items-center text-xs font-black text-zinc-400 transition hover:text-white">{action.label}<ArrowRight className="ml-1.5 h-3.5 w-3.5 text-red-400" /></Link>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">{children}</div>
      </div>
    </LocalizedHomepageTree>
  );
}

function PricingSkeleton() {
  return (
    <LocalizedHomepageTree>
      <div role="status" aria-busy="true" aria-label="Loading current credit prices" className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="h-56 animate-pulse rounded-2xl border border-white/8 bg-white/[0.025]" />
      ))}
      </div>
    </LocalizedHomepageTree>
  );
}
