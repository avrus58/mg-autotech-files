"use client";

import type { HTMLAttributes, ReactNode } from "react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  Clock3,
  CreditCard,
  Cpu,
  Download,
  FileCode2,
  Gauge,
  LayoutDashboard,
  Lock,
  LogIn,
  LogOut,
  Mail,
  MessageCircle,
  Search,
  ShieldCheck,
  Star,
  Upload,
  UserPlus,
  Users,
  Wrench,
  Zap,
  Activity,
  Sparkles,
  Calculator,
  TrendingUp,
} from "lucide-react";
import { Footer } from "@/components/Footer";
import {
  fetchVehicleOptions,
  getInitialVehicleBrands,
} from "@/lib/vehicleControl/clientCatalog";
import { DeferredPerformanceTools } from "@/components/tools/DeferredPerformanceTools";
import {
  CREDIT_PROMOTION_PERCENT,
  creditPackages as sharedCreditPackages,
} from "@/lib/creditPackages";
import {
  homepageSessionEvent,
  type HomepageSessionDetail,
} from "@/lib/homepageSessionEvents";

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

type Variants = Record<string, unknown>;
type StaticMotionProps<T extends HTMLElement> = HTMLAttributes<T> & {
  animate?: unknown;
  initial?: unknown;
  transition?: unknown;
  variants?: unknown;
  viewport?: unknown;
  whileHover?: unknown;
  whileInView?: unknown;
};

function staticMotionProps<T extends HTMLElement>(
  source: StaticMotionProps<T>
): HTMLAttributes<T> {
  const props = { ...source };
  delete props.animate;
  delete props.initial;
  delete props.transition;
  delete props.variants;
  delete props.viewport;
  delete props.whileHover;
  delete props.whileInView;
  return props;
}

const StaticMotionDiv = forwardRef<HTMLDivElement, StaticMotionProps<HTMLDivElement>>(
  function StaticMotionDiv(props, ref) {
    return <div ref={ref} {...staticMotionProps(props)} />;
  }
);

const StaticMotionSection = forwardRef<
  HTMLElement,
  StaticMotionProps<HTMLElement>
>(function StaticMotionSection(
  props,
  ref
) {
  return <section ref={ref} {...staticMotionProps(props)} />;
});

const motion = {
  div: StaticMotionDiv,
  section: StaticMotionSection,
};

const services = [
  {
    title: "Stage 1",
    text: "Performance optimization for stock vehicles.",
    credits: "10 Credits",
    href: "/services/stage-1",
    action: "View Stage 1 service",
    searchIntent: "Performance calibration",
  },
  {
    title: "DPF OFF",
    text: "Technical software solution for diesel vehicles.",
    credits: "6 Credits",
    href: "/services/dpf-off",
    action: "View DPF service",
    searchIntent: "Diesel aftertreatment",
  },
  {
    title: "EGR / AGR OFF",
    text: "EGR related software solution and DTC support.",
    credits: "6 Credits",
    href: "/services/egr-off",
    action: "View EGR service",
    searchIntent: "EGR / AGR solution",
  },
  {
    title: "AdBlue OFF",
    text: "SCR / AdBlue software solution for supported ECUs.",
    credits: "11 Credits",
    href: "/services/adblue-off",
    action: "View AdBlue service",
    searchIntent: "SCR / AdBlue request",
  },
  {
    title: "DTC OFF",
    text: "Diagnostic trouble code removal by request.",
    credits: "4 Credits",
    href: "/services/dtc-off",
    action: "View DTC service",
    searchIntent: "Diagnostic code request",
  },
  {
    title: "TCU Tuning",
    text: "Gearbox software optimization for supported TCUs.",
    credits: "Manual",
    href: "/services/tcu-tuning",
    action: "View TCU service",
    searchIntent: "Gearbox calibration",
  },
];

const serviceLandingPageLinks = services.filter((service) =>
  service.href.startsWith("/services/")
);

const steps = [
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
];

const requestReadinessSteps = [
  {
    eyebrow: "01",
    title: "Check file readiness",
    text: "Confirm file type, basic details and missing preparation before opening a request.",
    href: "/tools/file-readiness-check",
    action: "Open readiness check",
    icon: ShieldCheck,
  },
  {
    eyebrow: "02",
    title: "Build request brief",
    text: "Turn vehicle, ECU, read method and customer notes into a copy-ready technical brief.",
    href: "/tools/request-brief-builder",
    action: "Build request brief",
    icon: MessageCircle,
  },
  {
    eyebrow: "03",
    title: "Plan read method",
    text: "Check whether bench, boot or OBD context should be clarified before upload.",
    href: "/tools/ecu-read-method-advisor",
    action: "Plan read method",
    icon: Search,
  },
  {
    eyebrow: "04",
    title: "Start secure request",
    text: "Submit the file only through the authenticated customer portal when the brief is ready.",
    href: "/new-request",
    action: "Start secure request",
    icon: Upload,
  },
];

const requestReadinessBoundaries = [
  "Tools do not upload or modify ECU files.",
  "Credits are verified during secure request creation.",
  "Delivered files stay inside the customer dashboard.",
  "Complex requests stay human-reviewed before delivery.",
];

const homepageSearchIntentFaq = [
  {
    intent: "Before upload",
    question: "What should I prepare before sending an ECU or TCU file request?",
    answer:
      "Prepare the vehicle brand, model, engine, ECU or TCU information when available, read method, selected service and a short technical note. The public preparation tools can help organize this before the secure request is created.",
    href: "/tools/file-readiness-check",
    action: "Check readiness",
  },
  {
    intent: "Safe preparation",
    question: "Do the public preparation tools upload or modify my ECU file?",
    answer:
      "No. The public preparation tools are browser guidance only. They do not read, upload, change, patch or generate ECU or TCU files. File upload starts only inside the authenticated request flow.",
    href: "/tools",
    action: "Open tools",
  },
  {
    intent: "Order tracking",
    question: "How is a completed file delivered?",
    answer:
      "Completed files are delivered through the private customer dashboard. Customers can track the request status, see customer-visible messages and download delivered files only from their own account.",
    href: "/how-it-works",
    action: "See workflow",
  },
  {
    intent: "Vehicle coverage",
    question: "Can I create a request if my vehicle is not in the public selector?",
    answer:
      "Yes. If the exact vehicle or engine is not available in the selector, customers can use the manual vehicle request path and provide the missing technical details for review.",
    href: "/new-request",
    action: "Start request",
  },
];

const fileServiceAnswerLibrary = [
  {
    intent: "File service meaning",
    question: "What is an online ECU file service?",
    answer:
      "It is a secure workflow for preparing an ECU or TCU request with vehicle context, controller details, service intent and a clear customer brief before account handling begins.",
    href: "/file-service",
    action: "Open file service hub",
    icon: FileCode2,
  },
  {
    intent: "ECU vs TCU",
    question: "What is the difference between ECU and TCU file service?",
    answer:
      "ECU requests focus on engine control context. TCU requests focus on gearbox control context and usually need transmission details, read method context and a separate service goal.",
    href: "/services/tcu-tuning",
    action: "View TCU service",
    icon: Cpu,
  },
  {
    intent: "Vehicle details",
    question: "Should I prepare vehicle details before opening a request?",
    answer:
      "Yes. Brand, model, generation, engine, fuel type, gearbox and controller notes help the review start with fewer clarification messages.",
    href: "/tools/request-brief-builder",
    action: "Build request brief",
    icon: BadgeCheck,
  },
  {
    intent: "Read method",
    question: "Can I start if my read method is unclear?",
    answer:
      "Start with the read method advisor. If the method is still unclear, describe the tool, vehicle and controller context in the customer notes before secure handling.",
    href: "/tools/ecu-read-method-advisor",
    action: "Plan read method",
    icon: Search,
  },
  {
    intent: "Service selection",
    question: "How do I choose between Stage 1, TCU and diesel technical requests?",
    answer:
      "Choose the route that matches the real job goal. Separate performance, gearbox and diesel technical goals so the request can be reviewed with a cleaner scope.",
    href: "/#file-service-decision-matrix",
    action: "Compare routes",
    icon: Gauge,
  },
  {
    intent: "DTC context",
    question: "Where should diagnostic code information go?",
    answer:
      "Use the request notes to list the code numbers, workshop symptom and related service goal. This keeps diagnostic context connected to the selected public service route.",
    href: "/services/dtc-off",
    action: "Prepare DTC context",
    icon: Wrench,
  },
  {
    intent: "Public safety",
    question: "Does the homepage analyze my file?",
    answer:
      "No. Homepage guidance and public tools are preparation pages only. Secure file handling starts only after the customer opens the authenticated request workflow.",
    href: "/tools/file-readiness-check",
    action: "Check readiness",
    icon: ShieldCheck,
  },
  {
    intent: "After submit",
    question: "What happens after I submit a request?",
    answer:
      "The request stays tied to the customer account, where status updates, customer-visible messages and completed delivery remain separated from public website content.",
    href: "/how-it-works",
    action: "See workflow",
    icon: LayoutDashboard,
  },
];

const fileServiceSearchRouteIndex = [
  {
    query: "ECU file service online",
    route: "Central file-service hub",
    prepare:
      "Use this when the customer needs the complete secure workflow overview before choosing a service category.",
    href: "/file-service",
    action: "Open hub",
    tag: "Core",
  },
  {
    query: "TCU file service or gearbox file service",
    route: "Transmission controller guide",
    prepare:
      "Use this when the request is about gearbox controller context, TCU details, read method and transmission notes.",
    href: "/services/tcu-tuning",
    action: "Open TCU service",
    tag: "TCU",
  },
  {
    query: "Stage 1 ECU file service",
    route: "Stage 1 service page",
    prepare:
      "Use this when the request goal is a performance-focused ECU or TCU review with vehicle and engine context.",
    href: "/services/stage-1",
    action: "View Stage 1",
    tag: "Performance",
  },
  {
    query: "DTC file service request",
    route: "Diagnostic code preparation",
    prepare:
      "Use this when the customer needs to organize code numbers, workshop symptoms and related service context.",
    href: "/services/dtc-off",
    action: "Prepare DTC notes",
    tag: "Diagnostic",
  },
  {
    query: "DPF EGR AdBlue file request",
    route: "Diesel technical service route",
    prepare:
      "Use this when the request should be separated from performance work and documented with diesel system context.",
    href: "/services/dpf-off",
    action: "View diesel route",
    tag: "Diesel",
  },
  {
    query: "ECU read method help",
    route: "Read method advisor",
    prepare:
      "Use this when OBD, bench, boot, virtual read or TCU read context needs clarification before secure handling.",
    href: "/tools/ecu-read-method-advisor",
    action: "Plan read method",
    tag: "Read",
  },
  {
    query: "ECU file readiness check",
    route: "File readiness tool",
    prepare:
      "Use this when the customer wants to confirm that the request context is organized before account handling.",
    href: "/tools/file-readiness-check",
    action: "Check readiness",
    tag: "Ready",
  },
  {
    query: "What information should I send for file service",
    route: "Request brief builder",
    prepare:
      "Use this when vehicle, controller, service intent and workshop notes need to be turned into a clearer brief.",
    href: "/tools/request-brief-builder",
    action: "Build brief",
    tag: "Brief",
  },
];

const fileServiceSnippetSummary = [
  {
    title: "What it is",
    text:
      "A secure online workflow for ECU and TCU file-service preparation, built around vehicle context, controller details, selected service intent and clear workshop notes.",
    href: "/file-service",
    action: "Open file-service hub",
    icon: Cpu,
  },
  {
    title: "Who it helps",
    text:
      "Workshops and customers who need a structured request path for performance, diesel technical, diagnostic-code or transmission controller work.",
    href: "/how-it-works",
    action: "See workflow",
    icon: Users,
  },
  {
    title: "What to prepare",
    text:
      "Vehicle identity, engine details, ECU or TCU context, read method, selected service category and notes from the workshop job.",
    href: "/tools/request-brief-builder",
    action: "Build a request brief",
    icon: FileCode2,
  },
  {
    title: "Where secure handling starts",
    text:
      "Public pages explain the process. Secure file handling starts only inside the authenticated request workflow after the customer chooses to proceed.",
    href: "/tools/file-readiness-check",
    action: "Check readiness",
    icon: ShieldCheck,
  },
  {
    title: "What public tools do",
    text:
      "They help clarify read method, service route and request context before submission. They do not inspect customer files or change account records.",
    href: "/tools/ecu-read-method-advisor",
    action: "Plan read method",
    icon: Search,
  },
  {
    title: "What happens after submission",
    text:
      "The customer follows status, customer-visible messages and final delivery from the account area while internal review details stay separate.",
    href: "/how-it-works",
    action: "Review next steps",
    icon: LayoutDashboard,
  },
];

const fileServiceTrustComparison = [
  {
    title: "Structured vehicle context",
    typical:
      "A generic file handoff can miss engine, controller, read-method or service-intent context.",
    text:
      "MG AutoTech guides the customer toward vehicle identity, ECU or TCU context, selected service category and workshop notes before secure handling begins.",
    href: "/tools/request-brief-builder",
    action: "Build context",
    icon: BadgeCheck,
  },
  {
    title: "Controller-specific route",
    typical:
      "A single generic route can mix ECU, TCU, diesel technical and diagnostic-code requests together.",
    text:
      "MG AutoTech separates performance, diesel technical, diagnostic-code and transmission controller intent into clearer public preparation routes.",
    href: "/ecu-platforms/transmission-control-units",
    action: "View TCU route",
    icon: Cpu,
  },
  {
    title: "Preparation before submission",
    typical:
      "Customers often submit before the read method, service goal or missing details are clear.",
    text:
      "MG AutoTech public tools help organize read method, request brief and readiness context before the customer chooses to proceed.",
    href: "/tools/file-readiness-check",
    action: "Check readiness",
    icon: ShieldCheck,
  },
  {
    title: "Account-tracked workflow",
    typical:
      "Unstructured communication can make status, customer messages and delivery expectations hard to follow.",
    text:
      "MG AutoTech keeps status updates, customer-visible messages and final delivery tied to the customer account workflow.",
    href: "/how-it-works",
    action: "See workflow",
    icon: LayoutDashboard,
  },
  {
    title: "Human review boundary",
    typical:
      "Public pages can create confusion when they look like automatic file processing tools.",
    text:
      "MG AutoTech keeps public pages educational. Technical handling remains separated from public website guidance and requires controlled review.",
    href: "/file-service",
    action: "Open hub",
    icon: Users,
  },
  {
    title: "Customer-safe public website",
    typical:
      "A public website should not reveal private account details or technical handling internals.",
    text:
      "MG AutoTech keeps the public website focused on service education, route selection and preparation guidance only.",
    href: "/how-it-works",
    action: "Review process",
    icon: Lock,
  },
];

const fileServiceVerificationCheckpoints = [
  {
    checkpoint: "01",
    title: "Public route is clear",
    text:
      "The customer can see whether the job belongs to ECU, TCU, Stage 1, diesel technical, diagnostic-code or preparation guidance before secure handling starts.",
    href: "/file-service",
    action: "Check file-service route",
    signal: "Route clarity",
    icon: Search,
  },
  {
    checkpoint: "02",
    title: "Vehicle context is prepared",
    text:
      "The request should be supported by brand, model, generation, engine, controller notes and read-method context instead of a bare file handoff.",
    href: "/tools/request-brief-builder",
    action: "Prepare context",
    signal: "Context quality",
    icon: BadgeCheck,
  },
  {
    checkpoint: "03",
    title: "Read method is understood",
    text:
      "OBD, bench, boot, virtual read and TCU paths should be clarified early so the customer knows what information belongs in the request notes.",
    href: "/tools/ecu-read-method-advisor",
    action: "Review read method",
    signal: "Read path",
    icon: Cpu,
  },
  {
    checkpoint: "04",
    title: "Preparation happens before submission",
    text:
      "Public tools should help organize the job before account handling begins, without pretending to analyze, change or deliver technical output from the homepage.",
    href: "/tools/file-readiness-check",
    action: "Check readiness",
    signal: "Safe preparation",
    icon: ShieldCheck,
  },
  {
    checkpoint: "05",
    title: "Status remains trackable",
    text:
      "After submission, a professional workflow should keep status and customer-visible communication tied to the account flow.",
    href: "/how-it-works",
    action: "See workflow",
    signal: "Tracked process",
    icon: Clock3,
  },
  {
    checkpoint: "06",
    title: "Human review boundary is visible",
    text:
      "The website should explain preparation and routing while keeping technical decisions separated from public guidance.",
    href: "/#professional-file-service-comparison",
    action: "Compare standards",
    signal: "Review boundary",
    icon: Users,
  },
];

const fileServiceMythChecks = [
  {
    myth: "It is just a file drop",
    fact:
      "A professional file service starts with vehicle context, service intent, read-method notes and account-tracked communication.",
    href: "/tools/request-brief-builder",
    action: "Prepare a better brief",
    icon: FileCode2,
  },
  {
    myth: "The homepage edits files",
    fact:
      "The public website is an education and preparation layer only. Technical handling stays separate from public pages.",
    href: "/tools/file-readiness-check",
    action: "Check readiness",
    icon: ShieldCheck,
  },
  {
    myth: "Every request uses one generic route",
    fact:
      "ECU, TCU, performance, diesel technical and diagnostic-code requests need different context before secure account handling.",
    href: "/file-service",
    action: "Open service hub",
    icon: Search,
  },
  {
    myth: "Read method does not matter",
    fact:
      "OBD, bench, boot, virtual read and TCU context can change what the customer should describe before submission.",
    href: "/tools/ecu-read-method-advisor",
    action: "Review read method",
    icon: Cpu,
  },
  {
    myth: "Status is just a support question",
    fact:
      "A serious workflow explains customer-visible status and communication flow so customers know where to look next.",
    href: "/how-it-works",
    action: "See status flow",
    icon: MessageCircle,
  },
  {
    myth: "Public pages should expose every detail",
    fact:
      "MG AutoTech keeps public pages focused on safe guidance while account workflow, review details and delivery stay separated.",
    href: "/#file-service-privacy-controls",
    action: "Review privacy controls",
    icon: Lock,
  },
];

const fileServicePlatformStack = [
  {
    title: "Public service hub",
    text:
      "Customers can understand ECU, TCU, performance, diesel technical and diagnostic-code routes before the secure account flow.",
    href: "/file-service",
    action: "Open service hub",
    signal: "Route map",
    icon: LayoutDashboard,
  },
  {
    title: "Preparation tools",
    text:
      "Readiness, request brief and read-method tools help organize the job before submission.",
    href: "/tools",
    action: "View tools",
    signal: "Preparation",
    icon: Search,
  },
  {
    title: "Vehicle context path",
    text:
      "Brand, model, engine, controller and read-method context are treated as request context, not an afterthought.",
    href: "/tools/request-brief-builder",
    action: "Build context",
    signal: "Vehicle data",
    icon: BadgeCheck,
  },
  {
    title: "Private account workflow",
    text:
      "After submission, customer-visible status and messages stay tied to the account flow.",
    href: "/how-it-works",
    action: "See workflow",
    signal: "Tracked flow",
    icon: ShieldCheck,
  },
  {
    title: "Human review boundary",
    text:
      "Public pages explain the process while technical handling remains separated from public guidance.",
    href: "/#professional-file-service-comparison",
    action: "Compare standards",
    signal: "Review",
    icon: Users,
  },
  {
    title: "Customer-safe information design",
    text:
      "Public pages focus on education and preparation instead of private account or technical handling details.",
    href: "/#file-service-privacy-controls",
    action: "Review privacy",
    signal: "Safety",
    icon: Lock,
  },
];

const homepageSearchIntentJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": "https://file.mgautotech.de/#homepage-search-faq",
  mainEntity: homepageSearchIntentFaq.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
};

const fileServiceAnswerLibraryJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": "https://file.mgautotech.de/#file-service-answer-library",
  name: "MG AutoTech file service answer library",
  mainEntity: fileServiceAnswerLibrary.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
};

const workshopUseCases = [
  {
    title: "Performance File Preparation",
    text: "Stage 1 and Stage 2 requests with vehicle data, ECU details and original file upload.",
    meta: "ECU / TCU tuning",
    icon: Gauge,
  },
  {
    title: "Emission System Solutions",
    text: "Structured requests for DPF, EGR, AdBlue, OPF/GPF and related diagnostic requirements.",
    meta: "Technical options",
    icon: Wrench,
  },
  {
    title: "Diagnostic DTC Workflow",
    text: "Customers can add notes, fault codes and readout details so the file check stays clear.",
    meta: "DTC support",
    icon: FileCode2,
  },
  {
    title: "Completed File Delivery",
    text: "Modified files can be uploaded by admin and downloaded securely from the customer dashboard.",
    meta: "Secure delivery",
    icon: Download,
  },
];

const homepageCreditPackages = sharedCreditPackages.map((pack) => ({
  ...pack,
  unitPriceEuro: pack.priceEuro / pack.credits,
}));

const securityItems = [
  { title: "Private Dashboard", icon: Lock },
  { title: "Database Credits", icon: CreditCard },
  { title: "Order Tracking", icon: Gauge },
  { title: "Workshop Ready", icon: Wrench },
  { title: "Secure Login", icon: ShieldCheck },
  { title: "File Workflow", icon: Upload },
];

const supportedBrands = [
  {
    name: "BMW",
    note: "MD1, EDC17, MG1",
    initials: "BM",
    href: "/brands/bmw",
    action: "View BMW files",
  },
  {
    name: "Mercedes-Benz",
    note: "CDI, MED, VGS",
    initials: "MB",
    href: "/brands/mercedes-benz",
    action: "View Mercedes files",
  },
  {
    name: "Audi",
    note: "VAG ECU / TCU",
    initials: "AU",
    href: "/brands/audi",
    action: "View Audi files",
  },
  {
    name: "Volkswagen",
    note: "EDC, Simos, DSG",
    initials: "VW",
    href: "/brands/volkswagen",
    action: "View Volkswagen files",
  },
  {
    name: "Porsche",
    note: "Performance files",
    initials: "PO",
    href: "/brands/porsche",
    action: "View Porsche files",
  },
  {
    name: "Opel",
    note: "Diesel & petrol",
    initials: "OP",
    href: "/brands/opel",
    action: "View Opel files",
  },
  {
    name: "Renault",
    note: "ECU solutions",
    initials: "RE",
    href: "/brands/renault",
    action: "View Renault files",
  },
  {
    name: "Peugeot",
    note: "BlueHDi support",
    initials: "PE",
    href: "/brands/peugeot",
    action: "View Peugeot files",
  },
];

const ecuPlatformLinks = [
  {
    name: "Bosch EDC17",
    tag: "Diesel ECU",
    note: "Read-method, HW/SW and diesel request context for established European platforms.",
    href: "/ecu-platforms/bosch-edc17",
    action: "Open EDC17 guide",
  },
  {
    name: "Bosch MD1",
    tag: "Modern diesel",
    note: "Modern diesel ECU identification notes for newer protected controller families.",
    href: "/ecu-platforms/bosch-md1",
    action: "Open MD1 guide",
  },
  {
    name: "Bosch MG1",
    tag: "Petrol ECU",
    note: "Petrol and hybrid-era request context for MG1 vehicle and fuel details.",
    href: "/ecu-platforms/bosch-mg1",
    action: "Open MG1 guide",
  },
  {
    name: "Continental SIMOS",
    tag: "VAG petrol",
    note: "SIMOS generation, engine-code and read-protocol context for TSI/TFSI requests.",
    href: "/ecu-platforms/continental-simos",
    action: "Open SIMOS guide",
  },
  {
    name: "Continental SID",
    tag: "Diesel ECU",
    note: "SID family identification notes for diesel requests across supported workshops.",
    href: "/ecu-platforms/continental-sid",
    action: "Open SID guide",
  },
  {
    name: "Delphi DCM",
    tag: "Diesel ECU",
    note: "DCM generation, read coverage and diagnostic context before file submission.",
    href: "/ecu-platforms/delphi-dcm",
    action: "Open DCM guide",
  },
  {
    name: "Denso",
    tag: "ECU family",
    note: "Denso request preparation based on exact ECU and file identification.",
    href: "/ecu-platforms/denso",
    action: "Open Denso guide",
  },
  {
    name: "TCU & Gearbox",
    tag: "Transmission",
    note: "Gearbox controller context for DSG, ZF, VGS, DCT and PDK requests.",
    href: "/ecu-platforms/transmission-control-units",
    action: "Open TCU guide",
  },
];

const fileServiceSearchPillars = [
  {
    title: "ECU",
    text: "Engine-control files with vehicle context and workshop notes.",
    href: "/file-service",
    action: "Open hub",
    icon: Cpu,
    intent: "Original ECU file route",
  },
  {
    title: "TCU",
    text: "Gearbox controller context, read method and request notes.",
    href: "/ecu-platforms/transmission-control-units",
    action: "Open TCU guide",
    icon: FileCode2,
    intent: "Transmission file route",
  },
  {
    title: "Stage 1",
    text: "Performance request preparation before secure submission.",
    href: "/services/stage-1",
    action: "View Stage 1",
    icon: Gauge,
    intent: "Performance request route",
  },
  {
    title: "DTC / Diesel",
    text: "Diagnostic and aftertreatment context for human review.",
    href: "/services/dpf-off",
    action: "View route",
    icon: Wrench,
    intent: "Technical request route",
  },
];

const homepageFileServiceNavigator = [
  {
    title: "Torque and power tools",
    text: "Estimate power from torque and RPM or inspect workshop log rows before choosing the next route.",
    href: "/#tools",
    tag: "Tools",
    icon: Gauge,
  },
  {
    title: "Route decision matrix",
    text: "Compare common file-service search intents and move to the most useful public route.",
    href: "/#file-service-decision-matrix",
    tag: "Choose",
    icon: BadgeCheck,
  },
  {
    title: "Workshop use cases",
    text: "Match Stage 1, gearbox, diesel, diagnostic and unclear-read situations to the next step.",
    href: "/#file-service-use-cases",
    tag: "Use cases",
    icon: Wrench,
  },
  {
    title: "Workshop profiles",
    text: "Pick the entry point for performance shops, diesel diagnostics, transmission specialists or first-time customers.",
    href: "/#file-service-workshop-profiles",
    tag: "Audience",
    icon: Users,
  },
  {
    title: "Read method routes",
    text: "Find public guidance for OBD, bench, boot, virtual read, TCU and unknown read-method contexts.",
    href: "/#file-service-read-methods",
    tag: "Read",
    icon: FileCode2,
  },
  {
    title: "Brief requirements",
    text: "Check the vehicle, controller, service, file context, notes and delivery details needed before request creation.",
    href: "/#file-service-brief-requirements",
    tag: "Brief",
    icon: MessageCircle,
  },
  {
    title: "Privacy controls",
    text: "Understand the public/private boundary before moving from preparation pages into account-based request handling.",
    href: "/#file-service-privacy-controls",
    tag: "Trust",
    icon: ShieldCheck,
  },
  {
    title: "Terminology glossary",
    text: "Review customer-safe definitions for ECU file service, TCU file service, ORI, MOD, read method and delivery.",
    href: "/#file-service-glossary",
    tag: "Terms",
    icon: FileCode2,
  },
];

const fileServiceReadMethodRoutes = [
  {
    title: "OBD read available",
    text: "Use the read method advisor to confirm tool details, vehicle context and controller notes before opening a secure ECU file request.",
    href: "/tools/ecu-read-method-advisor",
    action: "Check OBD details",
    tag: "OBD",
  },
  {
    title: "Bench read available",
    text: "Prepare ECU family, HW/SW numbers, tool information and read context before submitting a file-service brief.",
    href: "/tools/request-brief-builder",
    action: "Build bench brief",
    tag: "Bench",
  },
  {
    title: "Boot mode context",
    text: "Keep controller family, read method and technical notes together so human review starts with the right context.",
    href: "/tools/ecu-read-method-advisor",
    action: "Review boot context",
    tag: "Boot",
  },
  {
    title: "Virtual read or stock file",
    text: "Confirm vehicle, engine and source context before continuing from the public file-service hub into the secure portal.",
    href: "/file-service",
    action: "Open file-service hub",
    tag: "Virtual",
  },
  {
    title: "TCU or gearbox read",
    text: "Use the transmission controller guide when the request is for DSG, ZF, VGS, DCT, PDK or another gearbox control unit.",
    href: "/ecu-platforms/transmission-control-units",
    action: "Open TCU guide",
    tag: "TCU",
  },
  {
    title: "Read method unknown",
    text: "Use readiness tools first so missing vehicle, controller and service details are clear before secure request submission.",
    href: "/tools/file-readiness-check",
    action: "Check readiness",
    tag: "Unknown",
  },
];

const fileServiceBriefRequirements = [
  {
    title: "Vehicle identity",
    text: "Brand, model, generation, engine, year, fuel type and gearbox context help the file-service request start from the right vehicle profile.",
    href: "/tools/request-brief-builder",
    action: "Prepare vehicle details",
    tag: "Vehicle",
  },
  {
    title: "Controller identity",
    text: "ECU or TCU family, HW/SW numbers, read tool and read method reduce back-and-forth before human review.",
    href: "/tools/ecu-read-method-advisor",
    action: "Check controller context",
    tag: "ECU / TCU",
  },
  {
    title: "Service intent",
    text: "Stage 1, TCU, diesel support, diagnostic request and selected options should be described before secure submission.",
    href: "/file-service",
    action: "Choose service route",
    tag: "Service",
  },
  {
    title: "File context",
    text: "Original file source, read date, previous file history if known and important notes help the review stay traceable.",
    href: "/tools/file-readiness-check",
    action: "Check file readiness",
    tag: "Context",
  },
  {
    title: "Customer notes",
    text: "Symptoms, diagnostic codes, workshop observations and special instructions should be written as customer-visible request notes.",
    href: "/tools/request-brief-builder",
    action: "Build note template",
    tag: "Notes",
  },
  {
    title: "Delivery path",
    text: "Completed work belongs in the authenticated dashboard flow, with status tracking and private delivery instead of public file exchange.",
    href: "/how-it-works",
    action: "See workflow",
    tag: "Delivery",
  },
];

const fileServiceFitChecks = [
  {
    title: "I know the vehicle and service",
    text: "You have the vehicle, engine, controller context and service objective ready.",
    outcome: "Start from the file-service hub and continue into the secure portal when ready.",
    href: "/file-service",
    action: "Open file-service hub",
    tag: "Ready",
  },
  {
    title: "I am missing ECU or TCU details",
    text: "You know the vehicle but need to organize controller, HW/SW, tool or read-method information.",
    outcome: "Use the request brief builder before opening a customer request.",
    href: "/tools/request-brief-builder",
    action: "Build request brief",
    tag: "Missing data",
  },
  {
    title: "The read method is unclear",
    text: "You are not sure whether the context is OBD, bench, boot, virtual stock file or gearbox read.",
    outcome: "Use the read method advisor first so the technical context is clear.",
    href: "/tools/ecu-read-method-advisor",
    action: "Plan read method",
    tag: "Read method",
  },
  {
    title: "This is a gearbox request",
    text: "The request is about DSG, ZF, VGS, DCT, PDK or another transmission controller.",
    outcome: "Open the TCU platform guide before preparing request notes.",
    href: "/ecu-platforms/transmission-control-units",
    action: "Open TCU guide",
    tag: "TCU",
  },
  {
    title: "The service category is unclear",
    text: "You need to separate performance, diesel support, diagnostic context or general file-service preparation.",
    outcome: "Use the readiness checker to see which information is still missing.",
    href: "/tools/file-readiness-check",
    action: "Check readiness",
    tag: "Unsure",
  },
  {
    title: "I want the full workflow first",
    text: "You want to understand account setup, request review, order tracking and private delivery.",
    outcome: "Read the workflow page before opening a customer request.",
    href: "/how-it-works",
    action: "See how it works",
    tag: "Workflow",
  },
];

const fileServiceOutcomePreview = [
  {
    title: "Request received",
    text: "The secure portal keeps the selected vehicle, service and customer notes attached to the request.",
    href: "/how-it-works",
    action: "See intake workflow",
    tag: "Intake",
    icon: BadgeCheck,
  },
  {
    title: "Human review",
    text: "Complex file-service requests stay review-led so unclear vehicle, controller or service context can be checked before delivery.",
    href: "/file-service",
    action: "Review file-service model",
    tag: "Review",
    icon: ShieldCheck,
  },
  {
    title: "Status tracking",
    text: "Customers follow the request state from the authenticated dashboard instead of guessing by email or public file exchange.",
    href: "/how-it-works",
    action: "See tracking workflow",
    tag: "Tracking",
    icon: Clock3,
  },
  {
    title: "Customer messages",
    text: "Customer-visible notes and additional information stay separated from internal workshop review notes.",
    href: "/how-it-works",
    action: "See communication flow",
    tag: "Messages",
    icon: MessageCircle,
  },
  {
    title: "Private delivery",
    text: "Completed work is delivered through the private customer area, with public pages staying educational only.",
    href: "/file-service",
    action: "Open service hub",
    tag: "Delivery",
    icon: Download,
  },
  {
    title: "Support context",
    text: "A prepared brief gives support the vehicle, controller and service context needed to answer faster.",
    href: "/tools/request-brief-builder",
    action: "Build support brief",
    tag: "Support",
    icon: MessageCircle,
  },
];

const fileServiceStatusGuide = [
  {
    title: "Received",
    text: "The request context has reached the secure portal and the customer can keep one reference point for the job.",
    href: "/how-it-works",
    action: "See request workflow",
    tag: "Received",
    icon: BadgeCheck,
  },
  {
    title: "Access verified",
    text: "The customer account and portal access are checked inside the authenticated workflow before the job continues.",
    href: "/how-it-works",
    action: "Understand portal access",
    tag: "Access",
    icon: Lock,
  },
  {
    title: "In review",
    text: "Vehicle, controller, service intent and customer notes are reviewed before technical work moves forward.",
    href: "/tools/request-brief-builder",
    action: "Prepare better notes",
    tag: "Review",
    icon: ShieldCheck,
  },
  {
    title: "Waiting for customer",
    text: "If details are missing, customer-visible messages can ask for the next piece of information without exposing workshop-only notes.",
    href: "/how-it-works",
    action: "See message flow",
    tag: "Action needed",
    icon: MessageCircle,
  },
  {
    title: "In progress",
    text: "The request is active in the private workflow while public pages remain educational and preparation-focused.",
    href: "/file-service",
    action: "Review service model",
    tag: "Active",
    icon: Activity,
  },
  {
    title: "Completed / delivered",
    text: "Finished work is handled through the private customer area, with public content staying separate from delivery.",
    href: "/how-it-works",
    action: "See delivery path",
    tag: "Delivered",
    icon: Download,
  },
];

const fileServicePrivacyControls = [
  {
    title: "Authenticated portal first",
    text: "File-service requests, tracking and delivery belong to the signed-in customer area, not public page interactions.",
    href: "/how-it-works",
    action: "See secure workflow",
    tag: "Portal",
    icon: Lock,
  },
  {
    title: "Public pages stay educational",
    text: "Homepage guides explain the workflow, preparation and service categories without exposing customer order information.",
    href: "/file-service",
    action: "Open service hub",
    tag: "Public safe",
    icon: ShieldCheck,
  },
  {
    title: "Customer-visible notes are separated",
    text: "Customer-facing messages are treated differently from internal workshop notes so communication stays clear.",
    href: "/how-it-works",
    action: "Review message flow",
    tag: "Messages",
    icon: MessageCircle,
  },
  {
    title: "Technical context is prepared first",
    text: "Vehicle, controller, read-method and service notes can be organized before secure request submission.",
    href: "/tools/request-brief-builder",
    action: "Prepare request brief",
    tag: "Brief",
    icon: FileCode2,
  },
  {
    title: "Private delivery path",
    text: "Completed work is handled in the customer area, with public content kept separate from delivery actions.",
    href: "/how-it-works",
    action: "See delivery workflow",
    tag: "Delivery",
    icon: Download,
  },
  {
    title: "Support-safe explanation",
    text: "Public content can explain the process while sensitive operational details remain out of the public page surface.",
    href: "/file-service",
    action: "Review boundaries",
    tag: "Support",
    icon: BadgeCheck,
  },
];

const fileServiceUseCases = [
  {
    title: "Stage 1 ECU request",
    text: "For performance-oriented ECU file service, start with the vehicle, engine, ECU family, read method and clear customer notes.",
    href: "/services/stage-1",
    action: "Open Stage 1 path",
    tag: "Performance",
    icon: Gauge,
    searchIntent: "Stage 1 ECU file service",
  },
  {
    title: "TCU and gearbox request",
    text: "Transmission controller work needs gearbox context, TCU type, read method and vehicle details before review.",
    href: "/ecu-platforms/transmission-control-units",
    action: "Open TCU guide",
    tag: "TCU",
    icon: FileCode2,
    searchIntent: "TCU file service",
  },
  {
    title: "Diesel technical request",
    text: "DPF, EGR and AdBlue requests stay easier to review when the service category and workshop note are separated from the start.",
    href: "/services/dpf-off",
    action: "Open diesel path",
    tag: "Diesel",
    icon: Wrench,
    searchIntent: "diesel ECU file service",
  },
  {
    title: "Diagnostic code request",
    text: "DTC-related requests should include the code list, vehicle context and a short explanation of the workshop symptom.",
    href: "/services/dtc-off",
    action: "Open DTC path",
    tag: "DTC",
    icon: MessageCircle,
    searchIntent: "DTC file service",
  },
  {
    title: "Unknown read method",
    text: "If the read method is unclear, use the public advisor first so the request starts with better technical context.",
    href: "/tools/ecu-read-method-advisor",
    action: "Use read advisor",
    tag: "Read method",
    icon: Search,
    searchIntent: "OBD bench boot virtual read",
  },
  {
    title: "Incomplete vehicle context",
    text: "When the vehicle, engine or controller details are incomplete, prepare a structured brief before using the secure portal.",
    href: "/tools/request-brief-builder",
    action: "Build request brief",
    tag: "Brief",
    icon: BadgeCheck,
    searchIntent: "ECU file service request preparation",
  },
];

const fileServiceQualitySignals = [
  {
    title: "Vehicle identity is complete",
    text: "Brand, model, generation, engine and fuel context make the file-service request easier to route and review.",
    href: "/tools/request-brief-builder",
    action: "Prepare vehicle details",
    tag: "Vehicle",
    icon: BadgeCheck,
    searchIntent: "ECU file service vehicle details",
  },
  {
    title: "Controller context is clear",
    text: "ECU or TCU family, read method and software context help avoid vague requests before secure submission.",
    href: "/tools/ecu-read-method-advisor",
    action: "Check read context",
    tag: "Controller",
    icon: Cpu,
    searchIntent: "ECU TCU read method",
  },
  {
    title: "Service intent is separated",
    text: "Performance, diesel technical and diagnostic-code requests should be described as separate service goals.",
    href: "/file-service",
    action: "Review service model",
    tag: "Intent",
    icon: Sparkles,
    searchIntent: "ECU file service request type",
  },
  {
    title: "File readiness is known",
    text: "Customers can check extension, size and preparation expectations before moving to the authenticated portal.",
    href: "/tools/file-readiness-check",
    action: "Open readiness check",
    tag: "Readiness",
    icon: ShieldCheck,
    searchIntent: "ECU file readiness check",
  },
  {
    title: "Workshop notes are usable",
    text: "Short notes about symptoms, goals or diagnostic context reduce back-and-forth during human review.",
    href: "/tools/request-brief-builder",
    action: "Build workshop note",
    tag: "Notes",
    icon: MessageCircle,
    searchIntent: "file service workshop notes",
  },
  {
    title: "Human review boundary is clear",
    text: "Complex ECU and TCU work stays review-led; public pages explain preparation without promising automatic output.",
    href: "/how-it-works",
    action: "See review workflow",
    tag: "Review",
    icon: Lock,
    searchIntent: "human reviewed ECU file service",
  },
];

const fileServiceWorkshopProfiles = [
  {
    title: "Performance workshop",
    text: "Stage 1 and performance-oriented work starts best with clear vehicle, engine, controller and service notes.",
    href: "/services/stage-1",
    action: "Open performance path",
    tag: "Performance",
    icon: Gauge,
    searchIntent: "performance workshop file service",
  },
  {
    title: "Diesel diagnostics workshop",
    text: "DPF, EGR and AdBlue contexts benefit from separated service goals and workshop notes before review.",
    href: "/services/dpf-off",
    action: "Open diesel path",
    tag: "Diesel",
    icon: Wrench,
    searchIntent: "diesel workshop ECU file service",
  },
  {
    title: "Transmission specialist",
    text: "TCU and gearbox requests need controller context, vehicle pairing and read-method information from the start.",
    href: "/ecu-platforms/transmission-control-units",
    action: "Open TCU path",
    tag: "TCU",
    icon: FileCode2,
    searchIntent: "TCU gearbox file service",
  },
  {
    title: "Mobile technician",
    text: "When the read method or file context is unclear, public tools help prepare the request before the secure portal.",
    href: "/tools/ecu-read-method-advisor",
    action: "Check read method",
    tag: "Mobile",
    icon: Search,
    searchIntent: "mobile technician ECU file service",
  },
  {
    title: "Multi-brand workshop",
    text: "Multi-brand teams can start from supported brand and platform guides before building a structured request brief.",
    href: "/brands",
    action: "Open brand guides",
    tag: "Multi-brand",
    icon: Cpu,
    searchIntent: "multi brand ECU file service",
  },
  {
    title: "First-time customer",
    text: "New customers can review the workflow, privacy boundaries and next steps before creating a secure request.",
    href: "/how-it-works",
    action: "See workflow",
    tag: "New customer",
    icon: ShieldCheck,
    searchIntent: "online file service workflow",
  },
];

const fileServiceKnowledgeMap = [
  {
    title: "ECU file service workflow",
    text: "Start with vehicle identification, ECU family, read method and the selected service so the request reaches the right review path.",
    href: "/file-service",
    action: "Open ECU workflow",
    tag: "ECU file service",
    icon: Cpu,
    searchIntent: "ECU file service",
  },
  {
    title: "TCU file service workflow",
    text: "Transmission controller requests are routed through gearbox context, TCU notes and supported platform guidance.",
    href: "/ecu-platforms/transmission-control-units",
    action: "Open TCU guide",
    tag: "TCU file service",
    icon: FileCode2,
    searchIntent: "TCU file service",
  },
  {
    title: "Stage 1 file preparation",
    text: "Performance requests work best when the vehicle, engine, controller and service objective are clear before submission.",
    href: "/services/stage-1",
    action: "Open Stage 1",
    tag: "Stage 1",
    icon: Gauge,
    searchIntent: "Stage 1 tuning file service",
  },
  {
    title: "Diesel support request path",
    text: "DPF, EGR and AdBlue requests stay easier to review when the service type and diagnostic context are separated from the start.",
    href: "/services/dpf-off",
    action: "Open diesel services",
    tag: "DPF / EGR / AdBlue",
    icon: Wrench,
    searchIntent: "diesel ECU file service",
  },
  {
    title: "DTC request preparation",
    text: "Diagnostic code requests should include the code list, vehicle context and a short workshop note for review.",
    href: "/services/dtc-off",
    action: "Open DTC service",
    tag: "DTC request",
    icon: FileCode2,
    searchIntent: "DTC file service",
  },
  {
    title: "Request readiness tools",
    text: "Use the public preparation tools to organize vehicle details and request notes before opening the secure portal flow.",
    href: "/tools/file-readiness-check",
    action: "Check readiness",
    tag: "Preparation",
    icon: ShieldCheck,
    searchIntent: "ECU file request checklist",
  },
];

const fileServiceDecisionMatrix = [
  {
    title: "ECU file service",
    customerNeed: "You have an original ECU read and need a structured file request.",
    bestPath: "Start with the ECU file-service hub.",
    requiredContext: "Vehicle, engine, ECU family, HW/SW if available, read method and selected service.",
    href: "/file-service",
    action: "Open ECU file service",
    searchIntent: "online ECU file service",
  },
  {
    title: "TCU file service",
    customerNeed: "You need gearbox or transmission-controller support.",
    bestPath: "Use the TCU and gearbox platform guide.",
    requiredContext: "Gearbox type, TCU family, vehicle details, read method and technical notes.",
    href: "/ecu-platforms/transmission-control-units",
    action: "Open TCU guide",
    searchIntent: "TCU file service",
  },
  {
    title: "Stage 1 file service",
    customerNeed: "You want a performance request for a stock vehicle.",
    bestPath: "Open the Stage 1 service page before submitting.",
    requiredContext: "Vehicle, engine, ECU/TCU file, fuel type and realistic service objective.",
    href: "/services/stage-1",
    action: "View Stage 1",
    searchIntent: "Stage 1 ECU file service",
  },
  {
    title: "Diesel technical request",
    customerNeed: "You need DPF, EGR or AdBlue related technical support.",
    bestPath: "Choose the exact diesel service category.",
    requiredContext: "Fault context, vehicle details, selected system and customer notes.",
    href: "/services/dpf-off",
    action: "Open diesel services",
    searchIntent: "diesel ECU file service",
  },
  {
    title: "DTC request",
    customerNeed: "You have diagnostic trouble codes that should be reviewed with the file request.",
    bestPath: "Prepare the DTC list and open the DTC service page.",
    requiredContext: "DTC codes, symptom notes, vehicle data and the original file context.",
    href: "/services/dtc-off",
    action: "View DTC service",
    searchIntent: "DTC file service",
  },
  {
    title: "Not sure yet",
    customerNeed: "You are missing ECU, read method or vehicle details.",
    bestPath: "Use the public readiness tools before opening a request.",
    requiredContext: "Basic vehicle information, available read details and a short workshop note.",
    href: "/tools/file-readiness-check",
    action: "Check readiness",
    searchIntent: "ECU file request preparation",
  },
];

const fileServiceOperatingStandard = [
  {
    title: "Secure request intake",
    text: "Online ECU file service requests start inside the authenticated portal with vehicle context, selected service and customer notes attached.",
    href: "/file-service",
    action: "Review intake workflow",
    tag: "Portal first",
    icon: Lock,
  },
  {
    title: "Vehicle context before file review",
    text: "Brand, model, engine, ECU or TCU family, read method and available HW/SW details make the request easier to review correctly.",
    href: "/tools/request-brief-builder",
    action: "Build request brief",
    tag: "Better intake",
    icon: MessageCircle,
  },
  {
    title: "Human review boundary",
    text: "Complex ECU and TCU file requests stay review-first. Public pages explain the workflow without promising automatic file output.",
    href: "/how-it-works",
    action: "See workflow",
    tag: "Review first",
    icon: ShieldCheck,
  },
  {
    title: "Private dashboard delivery",
    text: "Customers track status, receive customer-visible updates and access completed deliveries only through their own account dashboard.",
    href: "/how-it-works",
    action: "See delivery workflow",
    tag: "Private delivery",
    icon: LayoutDashboard,
  },
];

const fileServiceGlossaryTerms = [
  {
    title: "ECU file service",
    text: "An online workflow for ECU file requests with vehicle context, selected service, customer notes and dashboard tracking.",
    href: "/file-service",
    tag: "Workflow",
  },
  {
    title: "TCU file service",
    text: "Transmission-controller and gearbox file requests prepared with gearbox type, vehicle details, read method and technical notes.",
    href: "/ecu-platforms/transmission-control-units",
    tag: "Gearbox",
  },
  {
    title: "ORI file",
    text: "The original vehicle control-unit file submitted as the reference for review. It should remain unchanged before secure submission.",
    href: "/tools/file-readiness-check",
    tag: "Original",
  },
  {
    title: "MOD file",
    text: "A completed delivery file is handled through the private customer dashboard after the request has been reviewed and processed.",
    href: "/how-it-works",
    tag: "Delivery",
  },
  {
    title: "Read method",
    text: "The way a control-unit file was read, such as OBD, bench or boot, when that information is available from the tool or workshop.",
    href: "/tools/ecu-read-method-advisor",
    tag: "Context",
  },
  {
    title: "DTC request",
    text: "A diagnostic-code request should include the code list, symptoms, vehicle details and a short workshop note for review.",
    href: "/services/dtc-off",
    tag: "Diagnostics",
  },
  {
    title: "Secure upload",
    text: "File submission starts only inside the authenticated customer request flow after the vehicle and service context are prepared.",
    href: "/file-service",
    tag: "Portal",
  },
  {
    title: "Private delivery",
    text: "Customer-visible updates and completed delivery access stay inside the customer's own dashboard and account history.",
    href: "/how-it-works",
    tag: "Account",
  },
];

type HomepageCompactResourceItem = {
  title: string;
  text: string;
  tag?: string;
  href?: string;
  action?: string;
};

type HomepageCompactResourceGroup = {
  id: string;
  eyebrow: string;
  title: string;
  summary: string;
  boundary: string;
  items: HomepageCompactResourceItem[];
};

const homepageCompactResourceGroups: HomepageCompactResourceGroup[] = [
  {
    id: "file-service-answer-library",
    eyebrow: "Answer Library",
    title: "File Service Answer Library",
    summary: "Answers that match real workshop search intent with customer-safe answers for ECU, TCU, read method, Stage 1, DTC context and request tracking.",
    boundary: "Public guidance only. This does not inspect files, open private account records, change account balances or create delivery assets.",
    items: fileServiceAnswerLibrary.map((item) => ({
      title: item.question,
      text: item.answer,
      tag: item.intent,
      href: item.href,
      action: item.action,
    })),
  },
  {
    id: "file-service-search-index",
    eyebrow: "Search Index",
    title: "File Service Search Index",
    summary: "Match common file-service searches to the right public route. Instead of creating duplicate landing pages, this compact index keeps the Search phrase, Best route and What to prepare together.",
    boundary: "Index boundary. Route index only. This does not create requests, inspect files, open customer accounts or generate deliverable files.",
    items: fileServiceSearchRouteIndex.map((item) => ({
      title: item.query,
      text: `${item.route}: ${item.prepare}`,
      tag: item.tag,
      href: item.href,
      action: item.action,
    })),
  },
  {
    id: "file-service-snippet-summary",
    eyebrow: "At A Glance",
    title: "File Service At A Glance",
    summary: "A snippet-ready summary for ECU and TCU file service with a short, direct answer first.",
    boundary: "Public summary boundary. Informational only. It does not inspect files, change customer accounts, create requests or generate deliverable files.",
    items: fileServiceSnippetSummary.map((item) => ({
      title: item.title,
      text: item.text,
      href: item.href,
      action: item.action,
    })),
  },
  {
    id: "professional-file-service-comparison",
    eyebrow: "Professional Standard",
    title: "Professional File Service Standard",
    summary: "More than a basic file handoff: compare Without structure against the MG AutoTech workflow. SEO purpose is one useful resource instead of duplicate doorway pages.",
    boundary: "Comparison boundary. Workflow standards only. It does not open account data, inspect customer files, make technical changes or create deliverable files.",
    items: fileServiceTrustComparison.map((item) => ({
      title: item.title,
      text: `${item.text} Typical weak point: ${item.typical}`,
      href: item.href,
      action: item.action,
    })),
  },
  {
    id: "file-service-verification-checkpoints",
    eyebrow: "Verification",
    title: "File Service Verification Checkpoints",
    summary: "How to verify the workflow before you submit anything: route, request context, read method, status flow and review boundary.",
    boundary: "Verification boundary. Verification guidance only. It does not inspect files, open account data, start request handling or create deliverable files.",
    items: fileServiceVerificationCheckpoints.map((item) => ({
      title: item.title,
      text: item.text,
      tag: item.signal,
      href: item.href,
      action: item.action,
    })),
  },
  {
    id: "file-service-myth-checks",
    eyebrow: "Reality Check",
    title: "File Service Reality Check",
    summary: "Clear answers before the wrong expectation starts, turning common misunderstandings into practical next steps.",
    boundary: "Reality-check boundary. Expectation correction only. It does not inspect files, start account handling, change orders or create deliverable files.",
    items: fileServiceMythChecks.map((item) => ({
      title: item.myth,
      text: item.fact,
      href: item.href,
      action: item.action,
    })),
  },
  {
    id: "file-service-platform-stack",
    eyebrow: "Platform Stack",
    title: "File Service Platform Stack",
    summary: "The public website is connected to a real request workflow: public guidance, preparation tools, vehicle context and account-based follow-up.",
    boundary: "Platform-stack boundary. Capability description only. It does not inspect files, open account data, change requests or create deliverable files.",
    items: fileServicePlatformStack.map((item) => ({
      title: item.title,
      text: item.text,
      tag: item.signal,
      href: item.href,
      action: item.action,
    })),
  },
  {
    id: "file-service-read-methods",
    eyebrow: "Read Methods",
    title: "Read Method Route Finder",
    summary: "Route OBD, bench, boot, virtual and TCU file-service requests correctly.",
    boundary: "Safety boundary. This is informational only and does not inspect, upload, edit or create ECU/TCU files.",
    items: fileServiceReadMethodRoutes,
  },
  {
    id: "file-service-brief-requirements",
    eyebrow: "Brief Requirements",
    title: "File Service Brief Requirements",
    summary: "A stronger ECU or TCU file-service result starts with a stronger request brief, not a blind file drop.",
    boundary: "Customer-safe boundary. This does not request a file on the homepage, inspect file contents, expose private storage data or create ECU/TCU outputs.",
    items: fileServiceBriefRequirements,
  },
  {
    id: "file-service-fit-checker",
    eyebrow: "Fit Checker",
    title: "File Service Fit Checker",
    summary: "Pick your current file-service situation and move to the right next step.",
    boundary: "Safe public guidance only routes users to public preparation pages. It does not access files, create requests, open storage, run analysis or make delivery decisions.",
    items: fileServiceFitChecks.map((item) => ({
      title: item.title,
      text: `${item.text} Next step: ${item.outcome}`,
      tag: item.tag,
      href: item.href,
      action: item.action,
    })),
  },
  {
    id: "file-service-outcome-preview",
    eyebrow: "Outcome Preview",
    title: "File Service Outcome Preview",
    summary: "Customers should always know what happens after a secure ECU or TCU file-service request, not a public upload area.",
    boundary: "Customer-visible boundary. Outcome explanation only. It does not expose order records, internal notes, file paths, binary data, private review metadata or generated ECU/TCU outputs.",
    items: fileServiceOutcomePreview,
  },
  {
    id: "file-service-status-guide",
    eyebrow: "Status Guide",
    title: "File Service Status Guide",
    summary: "Clear status language keeps ECU and TCU file-service tracking understandable with the public meaning of common request states while private order data stays inside the authenticated portal.",
    boundary: "Status privacy boundary. Status explanation only. It does not expose live order state, customer messages, internal workflow notes, file paths, binary data or delivery assets.",
    items: fileServiceStatusGuide,
  },
  {
    id: "file-service-privacy-controls",
    eyebrow: "Privacy Controls",
    title: "Secure File Service Privacy Controls",
    summary: "Secure ECU and TCU file service needs clear public/private boundaries and separates public preparation guidance from authenticated request handling.",
    boundary: "Public privacy boundary. Privacy explanation only. It does not expose customer identity, order records, internal notes, file paths, binary data, private review metadata or delivery assets.",
    items: fileServicePrivacyControls,
  },
  {
    id: "file-service-use-cases",
    eyebrow: "Use Cases",
    title: "File Service Use Case Library",
    summary: "Match the workshop situation to the right file-service route and the real search intent behind each request type.",
    boundary: "Use-case boundary. Use-case routing only. It does not inspect customer files, create requests, start upload actions or modify files.",
    items: fileServiceUseCases,
  },
  {
    id: "file-service-quality-signals",
    eyebrow: "Quality Signals",
    title: "File Service Quality Signals",
    summary: "Better request quality means faster, clearer file-service review and shows what improves review clarity before secure submission.",
    boundary: "Quality-signal boundary. Preparation guidance only. It does not score customer files, inspect uploaded content, approve learning evidence, generate files or change file integrity data.",
    items: fileServiceQualitySignals,
  },
  {
    id: "file-service-workshop-profiles",
    eyebrow: "Workshop Profiles",
    title: "Workshop File Service Profiles",
    summary: "Different workshop teams need different file-service entry points and route each customer type to the safest preparation page.",
    boundary: "Workshop-profile boundary. Audience routing only. It does not create requests, inspect customer files, expose customer records, change payments or deliver files.",
    items: fileServiceWorkshopProfiles,
  },
  {
    id: "file-service-knowledge-map",
    eyebrow: "Knowledge Map",
    title: "File Service Knowledge Map",
    summary: "Broad search term, precise request path. ECU, TCU, Stage 1, diesel, DTC and readiness routes stay in one compact resource map.",
    boundary: "Public map only. Actual files, request ownership and delivery stay inside the authenticated dashboard.",
    items: fileServiceKnowledgeMap,
  },
  {
    id: "file-service-decision-matrix",
    eyebrow: "Decision Matrix",
    title: "File Service Decision Matrix",
    summary: "Choose the right file-service route in seconds with Search intent and Prepare before upload context.",
    boundary: "informational only. It does not inspect, upload, edit, checksum or generate ECU/TCU files.",
    items: fileServiceDecisionMatrix.map((item) => ({
      title: item.title,
      text: `${item.customerNeed} Best path: ${item.bestPath} Prepare: ${item.requiredContext}`,
      tag: item.searchIntent,
      href: item.href,
      action: item.action,
    })),
  },
  {
    id: "file-service-operating-standard",
    eyebrow: "Operating Standard",
    title: "Online File Service Standard",
    summary: "A professional file-service workflow is more than a file upload form: secure intake, vehicle context, human review boundaries and private dashboard delivery.",
    boundary: "Customer-safe operating boundary. Operating standard only. It does not read files, open storage paths, expose private metadata or create customer-ready ECU/TCU outputs.",
    items: fileServiceOperatingStandard,
  },
  {
    id: "file-service-glossary",
    eyebrow: "Glossary",
    title: "File Service Glossary",
    summary: "Understand the file-service terms before opening an ECU or TCU request. This glossary is educational and customer-safe.",
    boundary: "Educational and customer-safe. It does not inspect, upload, edit or create ECU/TCU files.",
    items: fileServiceGlossaryTerms.map((item) => ({
      title: item.title,
      text: item.text,
      tag: item.tag,
      href: item.href,
      action: "Learn more",
    })),
  },
];

type HomepageResourceLink = {
  title?: string;
  name?: string;
  query?: string;
  route?: string;
  prepare?: string;
  text?: string;
  note?: string;
  searchIntent?: string;
  tag?: string;
  href: string;
};

const publicResourceUrl = (href: string) => `https://file.mgautotech.de${href}`;

const buildHomepageItemList = (name: string, items: HomepageResourceLink[], id: string) => ({
  "@type": "ItemList",
  "@id": publicResourceUrl(id),
  name,
  itemListElement: items.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    item: {
      "@type": "WebPage",
      name: item.title ?? item.name ?? item.query ?? `MG AutoTech resource ${index + 1}`,
      description: item.text ?? item.note ?? item.searchIntent ?? item.prepare ?? item.route ?? item.tag,
      url: publicResourceUrl(item.href),
    },
  })),
});

const homepageResourceJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "ItemList",
      "@id": publicResourceUrl("/#file-service-resource-center-data"),
      name: "MG AutoTech file service resource source index",
      itemListElement: homepageCompactResourceGroups.map((group, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "WebPage",
          name: group.title,
          description: group.summary,
          url: publicResourceUrl(`/#${group.id}`),
        },
      })),
    },
    buildHomepageItemList("MG AutoTech file service homepage navigator", homepageFileServiceNavigator, "/#file-service-navigator"),
    buildHomepageItemList("MG AutoTech file service answer library", fileServiceAnswerLibrary, "/#file-service-answer-library"),
    buildHomepageItemList("MG AutoTech file service search route index", fileServiceSearchRouteIndex, "/#file-service-search-index"),
    buildHomepageItemList("MG AutoTech file service snippet summary", fileServiceSnippetSummary, "/#file-service-snippet-summary"),
    buildHomepageItemList("MG AutoTech professional file service comparison", fileServiceTrustComparison, "/#professional-file-service-comparison"),
    buildHomepageItemList("MG AutoTech file service verification checkpoints", fileServiceVerificationCheckpoints, "/#file-service-verification-checkpoints"),
    buildHomepageItemList("MG AutoTech file service myth checks", fileServiceMythChecks, "/#file-service-myth-checks"),
    buildHomepageItemList("MG AutoTech file service platform stack", fileServicePlatformStack, "/#file-service-platform-stack"),
    buildHomepageItemList("MG AutoTech file service read method routes", fileServiceReadMethodRoutes, "/#file-service-read-methods"),
    buildHomepageItemList("MG AutoTech file service brief requirements", fileServiceBriefRequirements, "/#file-service-brief-requirements"),
    buildHomepageItemList("MG AutoTech file service fit checker", fileServiceFitChecks, "/#file-service-fit-checker"),
    buildHomepageItemList("MG AutoTech file service outcome preview", fileServiceOutcomePreview, "/#file-service-outcome-preview"),
    buildHomepageItemList("MG AutoTech file service status guide", fileServiceStatusGuide, "/#file-service-status-guide"),
    buildHomepageItemList("MG AutoTech secure file service privacy controls", fileServicePrivacyControls, "/#file-service-privacy-controls"),
    buildHomepageItemList("MG AutoTech file service use case library", fileServiceUseCases, "/#file-service-use-cases"),
    buildHomepageItemList("MG AutoTech file service quality signals", fileServiceQualitySignals, "/#file-service-quality-signals"),
    buildHomepageItemList("MG AutoTech workshop file service profiles", fileServiceWorkshopProfiles, "/#file-service-workshop-profiles"),
    buildHomepageItemList("MG AutoTech service landing pages", serviceLandingPageLinks, "/#service-landing-pages"),
    buildHomepageItemList("MG AutoTech file service knowledge map", fileServiceKnowledgeMap, "/#file-service-knowledge-map"),
    buildHomepageItemList("MG AutoTech file service decision matrix", fileServiceDecisionMatrix, "/#file-service-decision-matrix"),
    buildHomepageItemList("MG AutoTech online file service operating standard", fileServiceOperatingStandard, "/#file-service-operating-standard"),
    buildHomepageItemList("MG AutoTech file service glossary", fileServiceGlossaryTerms, "/#file-service-glossary"),
    buildHomepageItemList("MG AutoTech supported brand guides", supportedBrands, "/#supported-brand-guides"),
    buildHomepageItemList("MG AutoTech ECU and TCU platform guides", ecuPlatformLinks, "/#ecu-platform-guides"),
  ],
};

const homepageFileServiceGlossaryJsonLd = {
  "@context": "https://schema.org",
  "@type": "DefinedTermSet",
  "@id": publicResourceUrl("/#file-service-glossary"),
  name: "MG AutoTech file service terminology",
  description: "Customer-safe glossary for online ECU and TCU file-service preparation terms.",
  hasDefinedTerm: fileServiceGlossaryTerms.map((term) => ({
    "@type": "DefinedTerm",
    name: term.title,
    description: term.text,
    inDefinedTermSet: publicResourceUrl("/#file-service-glossary"),
    url: publicResourceUrl(term.href),
  })),
};

const homepagePageJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "@id": publicResourceUrl("/#page"),
  name: "MG AutoTech ECU & TCU File Service",
  description:
    "Professional ECU and TCU file service for workshops with secure upload, tracked orders, public preparation tools and portal delivery.",
  url: publicResourceUrl("/"),
  inLanguage: "en",
  isPartOf: { "@id": publicResourceUrl("/#website") },
  about: { "@id": publicResourceUrl("/#organization") },
  primaryImageOfPage: {
    "@type": "ImageObject",
    url: publicResourceUrl("/opengraph-image"),
  },
  hasPart: [
    { "@id": publicResourceUrl("/#homepage-search-faq") },
    { "@id": publicResourceUrl("/#tools") },
    { "@id": publicResourceUrl("/#file-service-navigator") },
    { "@id": publicResourceUrl("/#file-service-answer-library") },
    { "@id": publicResourceUrl("/#file-service-search-index") },
    { "@id": publicResourceUrl("/#file-service-snippet-summary") },
    { "@id": publicResourceUrl("/#professional-file-service-comparison") },
    { "@id": publicResourceUrl("/#file-service-verification-checkpoints") },
    { "@id": publicResourceUrl("/#file-service-myth-checks") },
    { "@id": publicResourceUrl("/#file-service-platform-stack") },
    { "@id": publicResourceUrl("/#ecu-tcu-file-service") },
    { "@id": publicResourceUrl("/#file-service-read-methods") },
    { "@id": publicResourceUrl("/#file-service-brief-requirements") },
    { "@id": publicResourceUrl("/#file-service-fit-checker") },
    { "@id": publicResourceUrl("/#file-service-outcome-preview") },
    { "@id": publicResourceUrl("/#file-service-status-guide") },
    { "@id": publicResourceUrl("/#file-service-privacy-controls") },
    { "@id": publicResourceUrl("/#file-service-use-cases") },
    { "@id": publicResourceUrl("/#file-service-quality-signals") },
    { "@id": publicResourceUrl("/#file-service-workshop-profiles") },
    { "@id": publicResourceUrl("/#request-readiness-howto") },
    { "@id": publicResourceUrl("/#service-landing-pages") },
    { "@id": publicResourceUrl("/#file-service-knowledge-map") },
    { "@id": publicResourceUrl("/#file-service-decision-matrix") },
    { "@id": publicResourceUrl("/#file-service-operating-standard") },
    { "@id": publicResourceUrl("/#file-service-glossary") },
    { "@id": publicResourceUrl("/#supported-brand-guides") },
    { "@id": publicResourceUrl("/#ecu-platform-guides") },
  ],
};

const homepageFileServiceJsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  "@id": publicResourceUrl("/#ecu-tcu-file-service"),
  name: "MG AutoTech ECU and TCU File Service",
  serviceType: [
    "ECU file service",
    "TCU file service",
    "Stage 1 file service",
    "DPF, EGR, AdBlue and DTC file requests",
  ],
  description:
    "Professional ECU and TCU file service workflow with secure request intake, tracked order status, customer dashboard delivery and human review for complex files.",
  provider: { "@id": publicResourceUrl("/#organization") },
  areaServed: {
    "@type": "Place",
    name: "Europe",
  },
  audience: {
    "@type": "Audience",
    audienceType: "Workshops, tuning professionals and vehicle owners",
  },
  url: publicResourceUrl("/"),
  mainEntityOfPage: { "@id": publicResourceUrl("/#page") },
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "MG AutoTech file service request categories",
    itemListElement: serviceLandingPageLinks.map((service, index) => ({
      "@type": "Offer",
      position: index + 1,
      itemOffered: {
        "@type": "Service",
        name: service.title,
        serviceType: service.searchIntent,
        description: service.text,
        url: publicResourceUrl(service.href),
        provider: { "@id": publicResourceUrl("/#organization") },
      },
    })),
  },
  termsOfService: publicResourceUrl("/agb"),
};

const homepageRequestPreparationHowToJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  "@id": publicResourceUrl("/#request-readiness-howto"),
  name: "How to prepare an ECU or TCU file request",
  description:
    "A safe workshop preparation workflow for MG AutoTech file requests: check readiness, prepare a technical brief, confirm the read method and submit through the secure customer portal.",
  inLanguage: "en",
  mainEntityOfPage: { "@id": publicResourceUrl("/#page") },
  tool: [
    {
      "@type": "HowToTool",
      name: "MG AutoTech public preparation tools",
    },
  ],
  supply: [
    {
      "@type": "HowToSupply",
      name: "Vehicle, engine and ECU or TCU identification details",
    },
    {
      "@type": "HowToSupply",
      name: "Original file prepared for authenticated portal submission",
    },
  ],
  step: requestReadinessSteps.map((step, index) => ({
    "@type": "HowToStep",
    position: index + 1,
    name: step.title,
    text: step.text,
    url: publicResourceUrl(step.href),
  })),
};

const trustHighlights = [
  {
    title: "Secure file handling",
    text: "Original and modified files stay connected to the customer account.",
    icon: ShieldCheck,
  },
  {
    title: "Fast turnaround",
    text: "Clear request details help reduce back-and-forth before processing.",
    icon: Zap,
  },
  {
    title: "Workshop focused",
    text: "Built for repeat orders, technical notes and ECU/TCU file workflows.",
    icon: Wrench,
  },
  {
    title: "Credit based workflow",
    text: "Customers can buy credits once and use them across file requests.",
    icon: CreditCard,
  },
];

const calibrationKnowledgeItems = [
  {
    title: "WinOLS based file analysis",
    text: "Original files are reviewed with a calibration-focused workflow before service work starts.",
    icon: FileCode2,
    highlight: true,
  },
  {
    title: "DAMOS / A2L assisted checks",
    text: "Map structure knowledge can support deeper review when suitable data is available.",
    icon: Search,
  },
  {
    title: "ECU / TCU map structure experience",
    text: "Requests are checked against the vehicle, ECU family, read method and selected service.",
    icon: Cpu,
  },
  {
    title: "Bosch EDC / MD1 / MG1 support",
    text: "Common modern diesel and petrol control units are handled with platform-specific care.",
    icon: Gauge,
  },
  {
    title: "Siemens, Delphi and VAG knowledge",
    text: "The workflow is built around real workshop file-service cases, not generic upload handling.",
    icon: Wrench,
  },
  {
    title: "Manual calibration review",
    text: "Vehicle-specific checks help keep service requests clear before delivery or revision.",
    icon: ShieldCheck,
  },
];

const commandDeskStages = [
  {
    title: "File intake",
    detail: "Original file, vehicle data and read method are grouped into one request.",
    status: "Queued",
    icon: Upload,
  },
  {
    title: "Technical check",
    detail: "ECU/TCU details, notes and selected service are reviewed before processing.",
    status: "Review",
    icon: Search,
  },
  {
    title: "Calibration work",
    detail: "The file is prepared according to the requested service and vehicle context.",
    status: "Active",
    icon: Cpu,
  },
  {
    title: "Delivery control",
    detail: "Completed versions, revisions and customer downloads stay inside the portal.",
    status: "Ready",
    icon: Download,
  },
];

const commandDeskSignals = [
  { label: "Secure upload", value: "Portal only", icon: ShieldCheck },
  { label: "Payment flow", value: "Credits tracked", icon: CreditCard },
  { label: "Order status", value: "Live timeline", icon: Activity },
  { label: "File versions", value: "Revision ready", icon: FileCode2 },
];

const calculatorPresets = [
  {
    label: "Starter workshop",
    files: 12,
    salePrice: 149,
    credits: 8,
    creditCost: 4,
  },
  {
    label: "Growing partner",
    files: 35,
    salePrice: 169,
    credits: 8,
    creditCost: 3.8,
  },
  {
    label: "High-volume reseller",
    files: 80,
    salePrice: 189,
    credits: 9,
    creditCost: 3.5,
  },
];

function getGermanyNow() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Berlin" })
  );
}

function getWorkloadSnapshot(date: Date) {
  const day = date.getDay();
  const hour = date.getHours();
  const minute = date.getMinutes();
  const minutes = hour * 60 + minute;
  const open = 6 * 60;
  const nightPause = 2 * 60;
  const online = minutes >= open || minutes < nightPause;
  const sunday = day === 0;

  if (!online) {
    return {
      support: "Offline",
      queue: "Night pause",
      response: "From 06:00",
      note: "Requests can still be submitted and will be reviewed when the morning support window opens.",
    };
  }

  if (sunday) {
    if (minutes >= 22 * 60 || minutes < nightPause) {
      return {
        support: "Online",
        queue: "Limited Sunday",
        response: "~60-90 min",
        note: "Sunday support stays online with a smaller team, so complex files can take longer.",
      };
    }

    return {
      support: "Online",
      queue: "Sunday support",
      response: "~35-60 min",
      note: "Sunday requests are accepted, but response times can be slower because fewer staff are online.",
    };
  }

  if (minutes < 8 * 60) {
    return {
      support: "Online",
      queue: "Early support",
      response: "~10-20 min",
      note: "Early queue is usually light for standard file checks.",
    };
  }

  if (minutes < 12 * 60) {
    return {
      support: "Online",
      queue: "Normal",
      response: "~15-25 min",
      note: "Good time for standard ECU/TCU requests.",
    };
  }

  if (minutes < 14 * 60) {
    return {
      support: "Online",
      queue: "Lunch traffic",
      response: "~25-35 min",
      note: "Response time can move slightly during midday traffic.",
    };
  }

  if (minutes < 18 * 60) {
    return {
      support: "Online",
      queue: "Normal",
      response: "~15-30 min",
      note: "Most standard files are handled quickly during normal workload.",
    };
  }

  if (minutes < 22 * 60) {
    return {
      support: "Online",
      queue: "Busy",
      response: "~30-45 min",
      note: "After-work traffic can be busier, especially for complex files.",
    };
  }

  return {
    support: "Online",
    queue: "Late support",
    response: "~45-75 min",
    note: "Late evening requests are accepted, but complex checks may take longer during the reduced night team.",
  };
}

type WorkloadSnapshot = ReturnType<typeof getWorkloadSnapshot>;

const initialWorkloadSnapshot: WorkloadSnapshot = {
  support: "Checking",
  queue: "Synchronizing",
  response: "Checking",
  note: "Current workshop availability is synchronizing.",
};

type VehicleOption = {
  id: string;
  name: string;
  fuelType?: string | null;
};

type PublicVehicleData = {
  brand: string;
  brandId: string;
  model: string;
  modelId: string;
  generation: string;
  generationId: string;
  engine: string;
  engineId: string;
  fuelType?: string | null;
  ecu?: string[];
  stage1?: {
    stockHp: number | null;
    tunedHp: number | null;
    gainHp: number | null;
    stockNm: number | null;
    tunedNm: number | null;
    gainNm: number | null;
  } | null;
  stage2?: {
    stockHp: number | null;
    tunedHp: number | null;
    gainHp: number | null;
    stockNm: number | null;
    tunedNm: number | null;
    gainNm: number | null;
  } | null;
  readMethods?: string[];
  services?: string[];
};

const publicVehicleCopy = {
  en: {
    title: "View tuning data and create your file request online.",
    brandPlaceholder: "Select Vehicle Brand",
    modelPlaceholder: "Choose Model",
    generationPlaceholder: "Select Generation",
    enginePlaceholder: "Select Engine",
    search: "Search",
    reviewTitle: "Performance data under review",
    reviewText: "Exact values for this variant are confirmed after ECU and original-file identification.",
    checking: "Checking the selected vehicle record...",
    notFound: "No matching vehicle record was found. Please reselect the vehicle or create a manual request.",
    loadError: "Vehicle data could not be loaded. Please try again or create a manual request.",
    manualRequest: "Create a manual request",
  },
  de: {
    title: "Tuningdaten ansehen und Dateianfrage online erstellen.",
    brandPlaceholder: "Fahrzeugmarke wählen",
    modelPlaceholder: "Modell wählen",
    generationPlaceholder: "Generation wählen",
    enginePlaceholder: "Motor wählen",
    search: "Suchen",
    reviewTitle: "Leistungsdaten werden geprüft",
    reviewText: "Die genauen Werte dieser Variante werden nach Identifikation von Steuergerät und Originaldatei bestätigt.",
    checking: "Der ausgewählte Fahrzeugdatensatz wird geprüft...",
    notFound: "Kein passender Fahrzeugdatensatz gefunden. Bitte Fahrzeug erneut auswählen oder eine manuelle Anfrage erstellen.",
    loadError: "Die Fahrzeugdaten konnten nicht geladen werden. Bitte erneut versuchen oder eine manuelle Anfrage erstellen.",
    manualRequest: "Manuelle Anfrage erstellen",
  },
  tr: {
    title: "Tuning verilerini görüntüleyin ve dosya talebinizi oluşturun.",
    brandPlaceholder: "Araç markası seçin",
    modelPlaceholder: "Model seçin",
    generationPlaceholder: "Nesil seçin",
    enginePlaceholder: "Motor seçin",
    search: "Ara",
    reviewTitle: "Performans verileri kontrol ediliyor",
    reviewText: "Bu varyantın kesin değerleri ECU ve orijinal dosya tanımlamasından sonra doğrulanır.",
    checking: "Seçilen araç kaydı kontrol ediliyor...",
    notFound: "Eşleşen araç kaydı bulunamadı. Aracı yeniden seçin veya manuel talep oluşturun.",
    loadError: "Araç verileri yüklenemedi. Tekrar deneyin veya manuel talep oluşturun.",
    manualRequest: "Manuel talep oluştur",
  },
  nl: {
    title: "Bekijk tuninggegevens en maak uw bestandsaanvraag online.",
    brandPlaceholder: "Kies voertuigmerk",
    modelPlaceholder: "Kies model",
    generationPlaceholder: "Kies generatie",
    enginePlaceholder: "Kies motor",
    search: "Zoeken",
    reviewTitle: "Prestatiegegevens worden gecontroleerd",
    reviewText: "De exacte waarden voor deze variant worden bevestigd na identificatie van de ECU en het originele bestand.",
    checking: "Het geselecteerde voertuigrecord wordt gecontroleerd...",
    notFound: "Geen passend voertuigrecord gevonden. Selecteer het voertuig opnieuw of maak een handmatige aanvraag.",
    loadError: "De voertuiggegevens konden niet worden geladen. Probeer opnieuw of maak een handmatige aanvraag.",
    manualRequest: "Handmatige aanvraag maken",
  },
  fr: {
    title: "Consultez les données de préparation et créez votre demande en ligne.",
    brandPlaceholder: "Sélectionner la marque",
    modelPlaceholder: "Sélectionner le modèle",
    generationPlaceholder: "Sélectionner la génération",
    enginePlaceholder: "Sélectionner le moteur",
    search: "Rechercher",
    reviewTitle: "Données de performance en cours de vérification",
    reviewText: "Les valeurs exactes de cette variante sont confirmées après identification de l'ECU et du fichier d'origine.",
    checking: "Vérification du véhicule sélectionné...",
    notFound: "Aucun véhicule correspondant n'a été trouvé. Sélectionnez à nouveau le véhicule ou créez une demande manuelle.",
    loadError: "Les données du véhicule n'ont pas pu être chargées. Réessayez ou créez une demande manuelle.",
    manualRequest: "Créer une demande manuelle",
  },
  it: {
    title: "Consulta i dati di tuning e crea online la tua richiesta.",
    brandPlaceholder: "Seleziona la marca",
    modelPlaceholder: "Seleziona il modello",
    generationPlaceholder: "Seleziona la generazione",
    enginePlaceholder: "Seleziona il motore",
    search: "Cerca",
    reviewTitle: "Dati prestazionali in verifica",
    reviewText: "I valori esatti di questa variante vengono confermati dopo l'identificazione della ECU e del file originale.",
    checking: "Verifica del veicolo selezionato...",
    notFound: "Nessun veicolo corrispondente trovato. Seleziona nuovamente il veicolo o crea una richiesta manuale.",
    loadError: "Impossibile caricare i dati del veicolo. Riprova o crea una richiesta manuale.",
    manualRequest: "Crea richiesta manuale",
  },
  ru: {
    title: "Просмотрите данные тюнинга и создайте заявку на файл онлайн.",
    brandPlaceholder: "Выберите марку",
    modelPlaceholder: "Выберите модель",
    generationPlaceholder: "Выберите поколение",
    enginePlaceholder: "Выберите двигатель",
    search: "Найти",
    reviewTitle: "Данные мощности проверяются",
    reviewText: "Точные значения для этой версии подтверждаются после идентификации ECU и исходного файла.",
    checking: "Проверяем выбранную запись автомобиля...",
    notFound: "Подходящая запись автомобиля не найдена. Выберите автомобиль ещё раз или создайте ручную заявку.",
    loadError: "Не удалось загрузить данные автомобиля. Повторите попытку или создайте ручную заявку.",
    manualRequest: "Создать ручную заявку",
  },
  es: {
    title: "Consulta los datos de tuning y crea tu solicitud online.",
    brandPlaceholder: "Seleccionar marca",
    modelPlaceholder: "Seleccionar modelo",
    generationPlaceholder: "Seleccionar generación",
    enginePlaceholder: "Seleccionar motor",
    search: "Buscar",
    reviewTitle: "Datos de rendimiento en revisión",
    reviewText: "Los valores exactos de esta variante se confirman tras identificar la ECU y el archivo original.",
    checking: "Comprobando el vehículo seleccionado...",
    notFound: "No se encontró un vehículo coincidente. Vuelve a seleccionarlo o crea una solicitud manual.",
    loadError: "No se pudieron cargar los datos del vehículo. Inténtalo de nuevo o crea una solicitud manual.",
    manualRequest: "Crear solicitud manual",
  },
  pt: {
    title: "Consulte os dados de tuning e crie o seu pedido online.",
    brandPlaceholder: "Selecionar marca",
    modelPlaceholder: "Selecionar modelo",
    generationPlaceholder: "Selecionar geração",
    enginePlaceholder: "Selecionar motor",
    search: "Pesquisar",
    reviewTitle: "Dados de desempenho em verificação",
    reviewText: "Os valores exatos desta variante são confirmados após a identificação da ECU e do ficheiro original.",
    checking: "A verificar o veículo selecionado...",
    notFound: "Não foi encontrado um veículo correspondente. Selecione novamente ou crie um pedido manual.",
    loadError: "Não foi possível carregar os dados do veículo. Tente novamente ou crie um pedido manual.",
    manualRequest: "Criar pedido manual",
  },
  zh: {
    title: "查看调校数据并在线创建文件请求。",
    brandPlaceholder: "选择车辆品牌",
    modelPlaceholder: "选择车型",
    generationPlaceholder: "选择代系",
    enginePlaceholder: "选择发动机",
    search: "搜索",
    reviewTitle: "性能数据正在审核",
    reviewText: "该车型的准确数值将在识别 ECU 和原始文件后确认。",
    checking: "正在检查所选车辆记录...",
    notFound: "未找到匹配的车辆记录。请重新选择车辆或创建手动请求。",
    loadError: "无法加载车辆数据。请重试或创建手动请求。",
    manualRequest: "创建手动请求",
  },
  pl: {
    title: "Sprawdź dane tuningu i utwórz zlecenie pliku online.",
    brandPlaceholder: "Wybierz markę pojazdu",
    modelPlaceholder: "Wybierz model",
    generationPlaceholder: "Wybierz generację",
    enginePlaceholder: "Wybierz silnik",
    search: "Szukaj",
    reviewTitle: "Dane osiągów są weryfikowane",
    reviewText: "Dokładne wartości dla tej wersji są potwierdzane po identyfikacji ECU i oryginalnego pliku.",
    checking: "Sprawdzanie wybranego pojazdu...",
    notFound: "Nie znaleziono pasującego pojazdu. Wybierz pojazd ponownie lub utwórz zgłoszenie ręczne.",
    loadError: "Nie udało się wczytać danych pojazdu. Spróbuj ponownie lub utwórz zgłoszenie ręczne.",
    manualRequest: "Utwórz zgłoszenie ręczne",
  },
  sq: {
    title: "Shikoni të dhënat e tuningut dhe krijoni kërkesën online.",
    brandPlaceholder: "Zgjidhni markën",
    modelPlaceholder: "Zgjidhni modelin",
    generationPlaceholder: "Zgjidhni gjeneratën",
    enginePlaceholder: "Zgjidhni motorin",
    search: "Kërko",
    reviewTitle: "Të dhënat e performancës po verifikohen",
    reviewText: "Vlerat e sakta për këtë variant konfirmohen pas identifikimit të ECU-së dhe skedarit origjinal.",
    checking: "Po kontrollohet automjeti i zgjedhur...",
    notFound: "Nuk u gjet një automjet që përputhet. Zgjidheni përsëri ose krijoni një kërkesë manuale.",
    loadError: "Të dhënat e automjetit nuk u ngarkuan. Provoni përsëri ose krijoni një kërkesë manuale.",
    manualRequest: "Krijo kërkesë manuale",
  },
} as const;

type PublicVehicleCopy = (typeof publicVehicleCopy)[keyof typeof publicVehicleCopy];

function normalizePublicVehicleLocale(value?: string | null) {
  const locale = value?.toLowerCase().split("-")[0] ?? "en";
  return locale in publicVehicleCopy
    ? (locale as keyof typeof publicVehicleCopy)
    : "en";
}

function usePublicVehicleCopy() {
  const [copy, setCopy] = useState<PublicVehicleCopy>(publicVehicleCopy.en);

  useEffect(() => {
    const syncLocale = (value?: string | null) => {
      const stored = window.localStorage.getItem("mg_locale");
      const locale = normalizePublicVehicleLocale(
        value ?? stored ?? document.documentElement.lang
      );
      setCopy(publicVehicleCopy[locale]);
    };

    const handleLocaleChange = (event: Event) => {
      const detail = (event as CustomEvent<{ locale?: string }>).detail;
      syncLocale(detail?.locale);
    };

    syncLocale();
    window.addEventListener("mg-locale-change", handleLocaleChange);

    return () => window.removeEventListener("mg-locale-change", handleLocaleChange);
  }, []);

  return copy;
}


const fadeUp: Variants = {};
const stagger: Variants = {};

function AnimatedSection({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <motion.section
      id={id}
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.16 }}
      className={`homepage-deferred-section ${className}`}
    >
      {children}
    </motion.section>
  );
}

function FloatingTechBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(160,18,28,0.28),transparent_32%),linear-gradient(135deg,#050505,#0d0d0f_48%,#160608)]" />

      <motion.div
        animate={{
          x: [0, 45, 0],
          y: [0, -25, 0],
          opacity: [0.16, 0.3, 0.16],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute left-[8%] top-[18%] h-72 w-72 rounded-full bg-red-900/30 blur-3xl motion-safe:animate-pulse"
      />

      <motion.div
        animate={{
          x: [0, -35, 0],
          y: [0, 35, 0],
          opacity: [0.1, 0.22, 0.1],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute right-[8%] top-[28%] h-96 w-96 rounded-full bg-red-800/25 blur-3xl motion-safe:animate-pulse"
      />

      <motion.div
        animate={{ x: ["-20%", "120%"] }}
        transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
        className="absolute top-[42%] h-px w-[260px] bg-gradient-to-r from-transparent via-red-700/60 to-transparent"
      />

      <motion.div
        animate={{ x: ["120%", "-20%"] }}
        transition={{ duration: 13, repeat: Infinity, ease: "linear" }}
        className="absolute top-[62%] h-px w-[340px] bg-gradient-to-r from-transparent via-white/20 to-transparent"
      />
    </div>
  );
}

function RatingStars() {
  return (
    <div className="flex items-center gap-1 text-red-500">
      {[1, 2, 3, 4, 5].map((item) => (
        <Star key={item} className="h-3 w-3 fill-current" />
      ))}
    </div>
  );
}

function TechnicalHeroPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, x: 24 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      transition={{ duration: 0.75, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
      className="hidden h-[685px] lg:block"
    >
      <div className="relative h-[685px] overflow-hidden rounded-[2.25rem] border border-white/10 bg-[#07080b]/90 p-6 shadow-2xl shadow-black backdrop-blur-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_36%,rgba(177,18,27,0.25),transparent_36%),linear-gradient(145deg,rgba(255,255,255,0.06),transparent_38%)]" />
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-red-700/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-red-950/35 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/70 to-transparent" />

        <div className="relative flex h-full flex-col">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.28em] text-red-500">
                MG AutoTech
              </div>
              <div className="mt-2 text-4xl font-black tracking-wide">
                File Service
              </div>
            </div>

            <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-black text-emerald-300">
              Online
            </div>
          </div>

          <div className="relative mt-8 flex flex-1 items-center justify-center overflow-hidden rounded-[2rem] border border-white/10 bg-black/35">
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:42px_42px] opacity-25" />
            <div className="absolute left-8 top-8 rounded-full border border-red-800/50 bg-red-950/25 px-4 py-2 text-sm font-black text-red-100">
              ECU / TCU
            </div>
            <div className="absolute bottom-8 right-8 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-black text-zinc-200">
              OBD · Bench · Boot
            </div>

            <div className="absolute h-[420px] w-[420px] rounded-full border-[34px] border-red-700/20" />
            <div className="absolute h-[300px] w-[300px] rounded-full border border-red-600/30" />
            <div className="absolute h-[220px] w-[220px] rounded-full bg-red-700/15 blur-3xl" />

            <motion.div
              animate={{ y: [0, -10, 0], rotate: [0, 1, 0] }}
              transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
              className="relative flex h-56 w-56 items-center justify-center rounded-[2.5rem] border border-red-800/60 bg-black/80 shadow-2xl shadow-red-950/50 motion-safe:animate-pulse"
            >
              <div className="absolute inset-5 rounded-[1.8rem] border border-red-700/35" />
              <div className="absolute -left-10 top-14 h-px w-10 bg-red-700/70" />
              <div className="absolute -right-10 bottom-14 h-px w-10 bg-red-700/70" />
              <div className="absolute -top-10 left-1/2 h-10 w-px -translate-x-1/2 bg-red-700/70" />
              <div className="absolute -bottom-10 left-1/2 h-10 w-px -translate-x-1/2 bg-red-700/70" />
              <Cpu className="h-24 w-24 text-red-500" />
            </motion.div>
          </div>

          <div className="relative mt-5 grid h-[92px] grid-cols-3 gap-3">
            {[
              [ShieldCheck, "Secure Portal"],
              [Zap, "Fast Handling"],
              [Wrench, "Workshop Ready"],
            ].map(([Icon, label]) => {
              const LucideIcon = Icon as typeof ShieldCheck;

              return (
              <div
                key={String(label)}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-950/40 text-red-500">
                  <LucideIcon className="h-5 w-5" />
                </div>
                <div className="text-sm font-black leading-tight text-white">
                  {String(label)}
                </div>
              </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}



function PublicVehicleSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: VehicleOption[];
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <select
        aria-label={placeholder}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-14 w-full appearance-none rounded-xl border border-white/15 bg-white/10 px-4 pr-10 text-sm font-black text-white outline-none backdrop-blur transition hover:bg-white/15 focus:border-white/40 disabled:cursor-not-allowed disabled:opacity-45"
      >
        <option value="" className="bg-[#111]">
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option.id} value={option.id} className="bg-[#111]">
            {option.name}
          </option>
        ))}
      </select>

      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/80" />
    </div>
  );
}

function PublicStageCard({
  title,
  data,
  copy,
}: {
  title: string;
  data?: PublicVehicleData["stage1"];
  copy: PublicVehicleCopy;
}) {
  const hasPerformanceData = Boolean(
    data && (data.tunedHp !== null || data.tunedNm !== null)
  );

  if (!data || !hasPerformanceData) {
    return (
      <div data-no-translate className="rounded-2xl border border-white/15 bg-black/35 p-4 backdrop-blur">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-black">{title}</div>
          <Zap className="h-4 w-4 text-red-300" />
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.06] p-4">
          <div className="text-sm font-black">{copy.reviewTitle}</div>
          <p className="mt-2 text-xs leading-5 text-red-100/70">
            {copy.reviewText}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/15 bg-black/35 p-4 backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-black">{title}</div>
        <Zap className="h-4 w-4 text-red-300" />
      </div>

      <div className="grid gap-2 text-xs">
        <div className="flex justify-between rounded-xl bg-white/10 px-3 py-2">
          <span className="text-red-100/80">Power</span>
          <span className="font-black">
            {data.stockHp ?? "-"} {"\u2192"} {data.tunedHp ?? "-"} HP
          </span>
        </div>

        <div className="flex justify-between rounded-xl bg-white/10 px-3 py-2">
          <span className="text-red-100/80">Torque</span>
          <span className="font-black">
            {data.stockNm ?? "-"} {"\u2192"} {data.tunedNm ?? "-"} Nm
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="rounded-xl border border-white/15 bg-white/10 p-2 text-center">
            <div className="text-[10px] uppercase tracking-[0.12em] text-red-100/70">
              HP Gain
            </div>
            <div className="text-lg font-black">
              {data.gainHp !== null ? `+${data.gainHp}` : "-"}
            </div>
          </div>

          <div className="rounded-xl border border-white/15 bg-white/10 p-2 text-center">
            <div className="text-[10px] uppercase tracking-[0.12em] text-red-100/70">
              Nm Gain
            </div>
            <div className="text-lg font-black">
              {data.gainNm !== null ? `+${data.gainNm}` : "-"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatEuro(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCreditUnitEuro(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function WorkshopCommandDesk() {
  return (
    <AnimatedSection className="bg-[#07090d] py-20">
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-stretch">
          <div className="flex flex-col justify-between rounded-[2rem] border border-white/10 bg-white/[0.04] p-7 shadow-2xl shadow-black/30">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-red-800/50 bg-red-950/25 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-red-200">
                <Sparkles className="h-4 w-4 text-red-400" />
                Workshop command desk
              </div>
              <h2 className="mt-5 max-w-xl text-4xl font-black leading-tight [overflow-wrap:anywhere] md:text-5xl">
                One clear view for serious file-service work.
              </h2>
              <p className="mt-5 max-w-xl text-sm leading-7 text-zinc-400">
                A public preview of how requests are handled inside MG AutoTech:
                intake, checking, calibration, delivery and revision control.
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {commandDeskSignals.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-white/10 bg-black/35 p-4"
                  >
                    <Icon className="mb-3 h-5 w-5 text-red-400" />
                    <div className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
                      {item.label}
                    </div>
                    <div className="mt-1 text-sm font-black text-white">
                      {item.value}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-[2rem] border border-red-900/40 bg-[linear-gradient(135deg,rgba(177,18,27,0.18),rgba(255,255,255,0.04)_45%,rgba(0,0,0,0.5))] p-5 shadow-2xl shadow-red-950/20">
            <div className="mb-5 flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-black text-white">
                  Live operation preview
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  Structured workflow without exposing private order data
                </div>
              </div>
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-black text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/40" />
                System online
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {commandDeskStages.map((stage, index) => {
                const Icon = stage.icon;

                return (
                  <div
                    key={stage.title}
                    className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/35 p-5"
                  >
                    <div className="absolute right-4 top-4 text-5xl font-black text-white/[0.04]">
                      {String(index + 1).padStart(2, "0")}
                    </div>
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-red-800/40 bg-red-950/25 text-red-300">
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-black text-zinc-300">
                        {stage.status}
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-white">
                      {stage.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">
                      {stage.detail}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 grid gap-4 rounded-2xl border border-white/10 bg-black/30 p-4 md:grid-cols-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
                  Standard response
                </div>
                <div className="mt-1 text-xl font-black">~30 min</div>
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
                  Request types
                </div>
                <div className="mt-1 text-xl font-black">ECU / TCU</div>
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
                  Delivery
                </div>
                <div className="mt-1 text-xl font-black">Dashboard</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AnimatedSection>
  );
}

function BusinessMarginCalculator() {
  const [monthlyFiles, setMonthlyFiles] = useState(35);
  const [averageSalePrice, setAverageSalePrice] = useState(169);
  const [averageCredits, setAverageCredits] = useState(8);
  const [creditCost, setCreditCost] = useState(3.8);

  const revenue = monthlyFiles * averageSalePrice;
  const fileServiceCost = monthlyFiles * averageCredits * creditCost;
  const grossProfit = revenue - fileServiceCost;
  const profitMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const profitPerFile = monthlyFiles > 0 ? grossProfit / monthlyFiles : 0;

  const applyPreset = (preset: (typeof calculatorPresets)[number]) => {
    setMonthlyFiles(preset.files);
    setAverageSalePrice(preset.salePrice);
    setAverageCredits(preset.credits);
    setCreditCost(preset.creditCost);
  };

  return (
    <AnimatedSection className="bg-[#050505] py-20">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-sm font-black uppercase tracking-[0.25em] text-red-600">
              Business Calculator
            </div>
            <h2 className="mt-3 max-w-4xl text-4xl font-black md:text-5xl">
              See what file-service volume could mean for your workshop.
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-400">
              Choose a simple workshop profile or adjust the key numbers. The
              result gives a quick partner revenue estimate before opening an
              account.
            </p>
          </div>

          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-xl bg-[#b1121b] px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-[#c91824]"
          >
            Start as Partner
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20">
            <div className="mb-5 flex items-center gap-3">
              <Calculator className="h-7 w-7 text-red-500" />
              <h3 className="text-2xl font-black">Your numbers</h3>
            </div>

            <div className="mb-6 grid gap-3 md:grid-cols-3">
              {calculatorPresets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-left text-xs font-black text-zinc-300 transition hover:border-red-800/60 hover:bg-red-950/20 hover:text-white"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="space-y-5">
              <CalculatorInput
                label="Monthly completed files"
                value={monthlyFiles}
                min={1}
                max={150}
                step={1}
                suffix="files"
                onChange={setMonthlyFiles}
              />
              <CalculatorInput
                label="Average customer sale price"
                value={averageSalePrice}
                min={49}
                max={399}
                step={5}
                prefix="€"
                onChange={setAverageSalePrice}
              />
              <CalculatorInput
                label="Average credits per file"
                value={averageCredits}
                min={2}
                max={20}
                step={1}
                suffix="credits"
                onChange={setAverageCredits}
              />
            </div>

          </div>

          <div className="rounded-[2rem] border border-red-900/50 bg-gradient-to-br from-red-950/30 via-white/[0.04] to-black p-6 shadow-2xl shadow-black/30">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-black uppercase tracking-[0.22em] text-red-400">
                  Estimated Outcome
                </div>
                <h3 className="mt-2 text-3xl font-black">Simple monthly estimate</h3>
              </div>
              <TrendingUp className="h-9 w-9 text-emerald-400" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <ResultCard label="Completed files" value={`${monthlyFiles}`} detail="Estimated monthly file volume" />
              <ResultCard label="Customer revenue" value={formatEuro(revenue)} detail={`${formatEuro(averageSalePrice)} average sale`} />
              <ResultCard label="Credit usage" value={`${monthlyFiles * averageCredits}`} detail={`${averageCredits} credits per file`} />
              <ResultCard label="Credit cost" value={formatEuro(fileServiceCost)} detail={`${formatEuro(creditCost)} estimated credit rate`} />
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-emerald-700/30 bg-emerald-950/20 p-5">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300/80">
                    Estimated profit
                  </div>
                  <div className="mt-2 text-4xl font-black text-emerald-300">
                    {formatEuro(grossProfit)}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
                    Margin
                  </div>
                  <div className="mt-2 text-3xl font-black">
                    {profitMargin.toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
                    Profit / file
                  </div>
                  <div className="mt-2 text-3xl font-black">
                    {formatEuro(profitPerFile)}
                  </div>
                </div>
              </div>
            </div>

            <p className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4 text-xs leading-6 text-zinc-500">
              A quick estimate for workshops comparing monthly file volume,
              customer pricing and MG AutoTech credit usage.
            </p>
          </div>
        </div>
      </div>
    </AnimatedSection>
  );
}

function CalculatorInput({
  label,
  value,
  min,
  max,
  step,
  prefix,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  prefix?: string;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between gap-4">
        <span className="text-sm font-black text-white">{label}</span>
        <span className="rounded-xl border border-white/10 bg-black/30 px-3 py-1 text-xs font-black text-red-300">
          {prefix}
          {value}
          {suffix ? ` ${suffix}` : ""}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-red-600"
      />
    </label>
  );
}

function ResultCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-black text-white">{value}</div>
      <div className="mt-1 text-xs leading-5 text-zinc-500">{detail}</div>
    </div>
  );
}

function ignoreVehicleFetchError() {
  // Page navigation can abort the public vehicle checker requests.
}

function PublicVehicleChecker() {
  const copy = usePublicVehicleCopy();
  const [brands, setBrands] = useState<VehicleOption[]>(getInitialVehicleBrands);
  const [models, setModels] = useState<VehicleOption[]>([]);
  const [generations, setGenerations] = useState<VehicleOption[]>([]);
  const [engines, setEngines] = useState<VehicleOption[]>([]);

  const [brandId, setBrandId] = useState("");
  const [modelId, setModelId] = useState("");
  const [generationId, setGenerationId] = useState("");
  const [engineId, setEngineId] = useState("");

  const [vehicle, setVehicle] = useState<PublicVehicleData | null>(null);
  const [loadingVehicle, setLoadingVehicle] = useState(false);
  const [vehicleError, setVehicleError] = useState("");
  const vehicleResultRef = useRef<HTMLDivElement | null>(null);
  const vehicleLookupIdRef = useRef(0);
  const lastAutoLookupKeyRef = useRef("");

  const selectedBrandName =
    brands.find((item) => item.id === brandId)?.name ?? "";
  const selectedModelName =
    models.find((item) => item.id === modelId)?.name ?? "";
  const selectedGenerationName =
    generations.find((item) => item.id === generationId)?.name ?? "";
  const selectedEngineName =
    engines.find((item) => item.id === engineId)?.name ?? "";

  const clearVehicleResult = () => {
    vehicleLookupIdRef.current += 1;
    setLoadingVehicle(false);
    setVehicle(null);
    setVehicleError("");
  };

  const handleBrandChange = (value: string) => {
    setBrandId(value);
    setModelId("");
    setGenerationId("");
    setEngineId("");
    setModels([]);
    setGenerations([]);
    setEngines([]);
    clearVehicleResult();
  };

  const handleModelChange = (value: string) => {
    setModelId(value);
    setGenerationId("");
    setEngineId("");
    setGenerations([]);
    setEngines([]);
    clearVehicleResult();
  };

  const handleGenerationChange = (value: string) => {
    setGenerationId(value);
    setEngineId("");
    setEngines([]);
    clearVehicleResult();
  };

  const handleEngineChange = (value: string) => {
    lastAutoLookupKeyRef.current = "";
    setEngineId(value);
    clearVehicleResult();
  };

  useEffect(() => {
    if (!vehicle) return;

    const timer = window.setTimeout(() => {
      const result = vehicleResultRef.current;
      if (!result) return;

      result.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
      result.focus({ preventScroll: true });
    }, 80);

    return () => window.clearTimeout(timer);
  }, [vehicle]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    fetchVehicleOptions("/api/vehicles?type=brands", controller.signal)
      .then((options) => {
        if (active && options.length) setBrands(options);
      })
      .catch(ignoreVehicleFetchError);

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!brandId) return;

    const controller = new AbortController();

    fetchVehicleOptions(`/api/vehicles?type=models&brandId=${brandId}`, controller.signal)
      .then(setModels)
      .catch(ignoreVehicleFetchError);

    return () => controller.abort();
  }, [brandId]);

  useEffect(() => {
    if (!brandId || !modelId) return;

    const controller = new AbortController();

    fetchVehicleOptions(`/api/vehicles?type=generations&brandId=${brandId}&modelId=${modelId}`, controller.signal)
      .then(setGenerations)
      .catch(ignoreVehicleFetchError);

    return () => controller.abort();
  }, [brandId, modelId]);

  useEffect(() => {
    if (!brandId || !modelId || !generationId) return;

    const controller = new AbortController();

    fetchVehicleOptions(
      `/api/vehicles?type=engines&brandId=${brandId}&modelId=${modelId}&generationId=${generationId}`,
      controller.signal
    )
      .then(setEngines)
      .catch(ignoreVehicleFetchError);

    return () => controller.abort();
  }, [brandId, modelId, generationId]);

  const handleSearch = useCallback(async () => {
    if (!brandId || !modelId || !generationId || !engineId) return;

    const lookupId = vehicleLookupIdRef.current + 1;
    vehicleLookupIdRef.current = lookupId;
    setLoadingVehicle(true);
    setVehicle(null);
    setVehicleError("");

    try {
      const params = new URLSearchParams({
        type: "vehicle",
        brandId,
        modelId,
        generationId,
        engineId,
      });
      const res = await fetch(`/api/vehicles?${params.toString()}`, {
        cache: "no-store",
      });

      if (!res.ok) throw new Error(`Vehicle lookup failed with ${res.status}`);

      const data = (await res.json()) as PublicVehicleData | null;
      if (lookupId !== vehicleLookupIdRef.current) return;

      if (!data) {
        setVehicleError(copy.notFound);
        return;
      }

      setVehicle(data);
    } catch {
      if (lookupId !== vehicleLookupIdRef.current) return;
      setVehicle(null);
      setVehicleError(copy.loadError);
    } finally {
      if (lookupId === vehicleLookupIdRef.current) {
        setLoadingVehicle(false);
      }
    }
  }, [brandId, copy.loadError, copy.notFound, engineId, generationId, modelId]);

  useEffect(() => {
    if (!brandId || !modelId || !generationId || !engineId) return;

    const lookupKey = `${brandId}:${modelId}:${generationId}:${engineId}`;
    if (lastAutoLookupKeyRef.current === lookupKey) return;

    lastAutoLookupKeyRef.current = lookupKey;
    void handleSearch();
  }, [brandId, engineId, generationId, handleSearch, modelId]);

  const requestUrl =
    brandId && modelId && generationId && engineId
      ? `/login?redirect=${encodeURIComponent(
          `/new-request?brandId=${brandId}&modelId=${modelId}&generationId=${generationId}&engineId=${engineId}`
        )}`
      : "/login";

  return (
    <div data-no-translate className="relative border-t border-red-500/20 bg-[#b1121b] py-10">
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_70%_0%,white,transparent_28%)]" />
      <div className="mx-auto max-w-7xl px-4">
        <h2 className="text-2xl font-black md:text-3xl">
          {copy.title}
        </h2>

        <div data-no-translate className="mt-7 grid gap-4 md:grid-cols-5">
          <PublicVehicleSelect
            value={brandId}
            onChange={handleBrandChange}
            options={brands}
            placeholder={copy.brandPlaceholder}
          />

          <PublicVehicleSelect
            value={modelId}
            onChange={handleModelChange}
            options={models}
            placeholder={copy.modelPlaceholder}
            disabled={!brandId}
          />

          <PublicVehicleSelect
            value={generationId}
            onChange={handleGenerationChange}
            options={generations}
            placeholder={copy.generationPlaceholder}
            disabled={!modelId}
          />

          <PublicVehicleSelect
            value={engineId}
            onChange={handleEngineChange}
            options={engines}
            placeholder={copy.enginePlaceholder}
            disabled={!generationId}
          />

          <button
            onClick={handleSearch}
            disabled={!brandId || !modelId || !generationId || !engineId || loadingVehicle}
            className="flex h-14 items-center justify-center rounded-xl bg-white px-4 text-sm font-black text-[#b1121b] transition duration-300 hover:-translate-y-1 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Search className="mr-2 h-4 w-4" />
            {loadingVehicle ? copy.checking : copy.search}
          </button>
        </div>

        <div data-no-translate aria-live="polite" aria-atomic="true">
          {loadingVehicle && (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/20 bg-black/20 px-4 py-3 text-sm font-bold text-white">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              {copy.checking}
            </div>
          )}

          {vehicleError && (
            <div role="alert" className="mt-4 rounded-xl border border-white/25 bg-black/30 px-4 py-4 text-sm font-bold text-white">
              {vehicleError}
              <Link href="/new-request" className="ml-2 underline decoration-white/50 underline-offset-4 hover:decoration-white">
                {copy.manualRequest}
              </Link>
            </div>
          )}
        </div>

        {vehicle && (
          <motion.div
            ref={vehicleResultRef}
            tabIndex={-1}
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="mt-8 scroll-mt-24 overflow-hidden rounded-[2rem] border border-white/20 bg-black/35 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-[1.5rem] border border-white/15 bg-gradient-to-br from-black/60 via-red-950/20 to-black/60 p-6">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-red-50">
                  <Cpu className="h-4 w-4" />
                  Public Vehicle Intelligence
                </div>

                <h3 className="text-3xl font-black">
                  {selectedBrandName}{" "}
                  <span className="text-white/80">{selectedModelName}</span>
                </h3>

                <p className="mt-2 text-sm font-bold text-red-100/80">
                  {selectedGenerationName} · {selectedEngineName}
                </p>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                    <div className="text-xs font-black uppercase tracking-[0.16em] text-red-100/60">
                      ECU / TCU
                    </div>
                    <div className="mt-2 text-sm font-black">
                      {vehicle.ecu?.length ? vehicle.ecu.join(", ") : "Not available"}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                    <div className="text-xs font-black uppercase tracking-[0.16em] text-red-100/60">
                      Read Method
                    </div>
                    <div className="mt-2 text-sm font-black">
                      {vehicle.readMethods?.length
                        ? vehicle.readMethods.slice(0, 4).join(", ")
                        : "Not available"}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {vehicle.services?.slice(0, 8).map((service) => (
                    <span
                      key={service}
                      className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-black"
                    >
                      {service}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <PublicStageCard title="Stage 1" data={vehicle.stage1} copy={copy} />
                <PublicStageCard title="Stage 2" data={vehicle.stage2} copy={copy} />
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-black">Ready to request a custom file?</div>
                <p className="mt-1 text-sm text-red-100/80">
                  Login or register to upload your original file and create a real order.
                </p>
              </div>

              <Link
                href={requestUrl}
                className="flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-black text-[#b1121b] transition hover:-translate-y-0.5 hover:bg-zinc-100"
              >
                Create File Request
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function HomepageFileServiceCorePanel() {
  return (
    <AnimatedSection id="file-service" className="bg-[#050607] py-8 text-white">
      <div className="mx-auto max-w-7xl px-4">
        <div className="rounded-[1.35rem] border border-white/10 bg-gradient-to-br from-red-950/20 via-zinc-950 to-black p-5 shadow-2xl shadow-black/25">
          <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <div className="text-[0.72rem] font-black uppercase tracking-[0.22em] text-red-200">
                File-service routes
              </div>
              <h2 className="mt-2 text-2xl font-black leading-tight md:text-3xl">
                Choose the right request path.
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-300">
                Start with the closest route, then continue in the secure
                portal with vehicle details, notes and upload.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {fileServiceSearchPillars.map((pillar) => {
                const Icon = pillar.icon;

                return (
                  <Link
                    key={pillar.title}
                    href={pillar.href}
                    className="group rounded-2xl border border-white/10 bg-white/[0.035] p-3 transition hover:border-red-500/35 hover:bg-white/[0.07] focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700"
                  >
                    <div className="flex items-center gap-2">
                      <span className="grid h-8 w-8 place-items-center rounded-xl bg-red-950/45 text-red-200">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="text-sm font-black text-white">
                        {pillar.title}
                      </span>
                    </div>
                    <p className="mt-2 min-h-10 text-xs leading-5 text-zinc-400">
                      {pillar.text}
                    </p>
                    <span className="mt-2 inline-flex items-center text-xs font-black text-red-200">
                      {pillar.action}
                      <ArrowRight className="ml-1 h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
            <Link
              href="/new-request"
              className="inline-flex items-center rounded-xl bg-red-700 px-4 py-3 text-sm font-black text-white transition hover:bg-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700"
            >
              New request
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link
              href="/file-service"
              className="inline-flex items-center rounded-xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm font-black text-white transition hover:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700"
            >
              Open file service hub
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-950/15 px-4 py-3 text-xs leading-5 text-emerald-100">
              <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-300" />
              <span>
                <span className="font-black">Secure request boundary:</span>{" "}
                uploads, credits and delivery stay inside the customer portal.
              </span>
            </div>
            <Link
              href="/tools/request-brief-builder"
              className="inline-flex rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm font-black text-white transition hover:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700"
            >
              Prepare a request brief
            </Link>
          </div>
        </div>
      </div>
    </AnimatedSection>
  );
}

export default function HomePage() {
  const [workloadSnapshot, setWorkloadSnapshot] = useState<WorkloadSnapshot>(
    initialWorkloadSnapshot
  );
  const [authReady, setAuthReady] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [sessionRuntimeReady, setSessionRuntimeReady] = useState(false);

  useEffect(() => {
    const updateWorkload = () => {
      setWorkloadSnapshot(getWorkloadSnapshot(getGermanyNow()));
    };

    updateWorkload();
    const interval = window.setInterval(updateWorkload, 60_000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleSession = (event: Event) => {
      const detail = (event as CustomEvent<HomepageSessionDetail>).detail;
      setUserEmail(detail.email);
      setAuthReady(true);
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
    setAuthReady(true);
  };

  const isLoggedIn = authReady && Boolean(userEmail);

  const liveWorkloadItems = [
    {
      title: "Online status",
      value: workloadSnapshot.support,
      text:
        workloadSnapshot.support === "Offline"
          ? "Requests are accepted and reviewed from the 06:00 support window."
          : workloadSnapshot.support === "Checking"
          ? "Live support status is synchronizing."
          : "Customer requests are monitored during the 06:00-02:00 operation window.",
      icon: Activity,
      tone:
        workloadSnapshot.support === "Offline"
          ? "red"
          : workloadSnapshot.support === "Checking"
          ? "blue"
          : "emerald",
    },
    {
      title: "Standard file queue",
      value: workloadSnapshot.queue,
      text: "Queue level changes during busy workshop traffic hours.",
      icon: Gauge,
      tone:
        workloadSnapshot.queue === "Busy" ||
        workloadSnapshot.queue === "Late support" ||
        workloadSnapshot.queue === "Limited Sunday"
          ? "red"
          : "blue",
    },
    {
      title: "Average response",
      value: workloadSnapshot.response,
      text: workloadSnapshot.note,
      icon: Clock3,
      tone: "blue",
    },
  ];

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#050505] text-white">
      {sessionRuntimeReady && <HomepageSessionBridge />}
      <FloatingTechBackground />

      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto hidden max-w-7xl items-center justify-between px-4 py-2 text-xs text-zinc-300 lg:flex">
          <div className="flex items-center gap-3">
            <RatingStars />
            <span className="rounded-md bg-[#b1121b] px-2 py-0.5 font-bold text-white">
              9.9/10
            </span>
            <span className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              Email Support
            </span>
          </div>

          <div className="ml-auto flex items-center gap-5">
            <Link href="/services" className="hover:text-white">
              Services
            </Link>
            <a href="#brands" className="hover:text-white">
              Brands
            </a>
            <a href="#prices" className="hover:text-white">
              Prices
            </a>
            <Link href="/tools" className="hover:text-white">
              Tools
            </Link>
            <Link href="/widget" className="hover:text-white">
              Vehicle Widget
            </Link>
            <a href="#contact" className="hover:text-white">
              Contact
            </a>
            {!authReady ? null : isLoggedIn ? (
              <>
                <Link href="/dashboard" className="hover:text-white">
                  My Account
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="hover:text-white"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link href="/login" className="hover:text-white">
                Login
              </Link>
            )}
          </div>
        </div>

        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:py-5">
          <Link href="/" className="flex min-w-0 items-center gap-2 sm:gap-3">
            <motion.div
              whileHover={{ scale: 1.05, rotate: -1 }}
              className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-red-800/50 bg-[#111] shadow-lg shadow-red-950/40 transition duration-300 hover:scale-105 sm:h-12 sm:w-12"
            >
              <div className="absolute -top-2 h-5 w-10 rounded-t-full border-t-2 border-red-700" />
              <Cpu className="h-6 w-6 text-red-600 sm:h-7 sm:w-7" />
            </motion.div>

            <div className="min-w-0">
              <div className="truncate text-lg font-black tracking-wide sm:text-xl">
                MG <span className="text-red-600">AUTOTECH</span>
              </div>
              <div className="truncate text-[11px] text-zinc-400 sm:text-xs">
                ECU / TCU File Service
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-semibold text-zinc-300 lg:flex">
            <a href="#home" className="text-red-500">
              Home
            </a>
            <Link href="/how-it-works" className="hover:text-white">
              How It Works
            </Link>
            <Link href="/services" className="hover:text-white">
              Services
            </Link>
            <a href="#brands" className="hover:text-white">
              Brands
            </a>
            <a href="#prices" className="hover:text-white">
              Credit Prices
            </a>
            <a href="#security" className="hover:text-white">
              Security
            </a>
            <Link href="/tools" className="hover:text-white">
              Tools
            </Link>
            <Link href="/widget" className="hover:text-white">
              Vehicle Widget
            </Link>
          </nav>

          {!authReady ? (
            <div
              className="flex items-center gap-2"
              aria-hidden="true"
            >
              <div className="hidden h-11 w-28 rounded-xl border border-white/10 bg-white/[0.04] md:block" />
              <div className="h-11 w-28 rounded-xl bg-red-950/40" />
            </div>
          ) : isLoggedIn ? (
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard"
                className="rounded-xl bg-[#b1121b] px-3 py-3 text-xs font-black text-white shadow-lg shadow-red-950/40 transition duration-300 hover:-translate-y-0.5 hover:bg-[#c91824] sm:px-5 sm:text-sm"
              >
                <LayoutDashboard className="mr-2 inline h-4 w-4" />
                My Account
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className="hidden rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition duration-300 hover:bg-white/10 md:flex"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="hidden rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition duration-300 hover:bg-white/10 md:flex"
              >
                <LogIn className="mr-2 h-4 w-4" />
                Login
              </Link>

              <Link
                href="/register"
                className="rounded-xl bg-[#b1121b] px-3 py-3 text-xs font-black text-white shadow-lg shadow-red-950/40 transition duration-300 hover:-translate-y-0.5 hover:bg-[#c91824] sm:px-5 sm:text-sm"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </header>

      <section id="home" className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(0,0,0,0.94),rgba(0,0,0,0.68),rgba(0,0,0,0.94))]" />
        <motion.div
          animate={{ rotate: [0, 2, 0], scale: [1, 1.02, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute right-[-140px] top-14 -z-10 hidden h-[520px] w-[900px] rounded-full border-[32px] border-red-800/50 opacity-70 motion-safe:animate-pulse lg:block"
        />
        <div className="absolute right-[-20px] top-36 -z-10 hidden h-[280px] w-[650px] rounded-[4rem] bg-[linear-gradient(135deg,#111,#050505)] opacity-80 shadow-2xl shadow-black lg:block" />
        <motion.div
          animate={{ opacity: [0.55, 1, 0.55], width: ["420px", "540px", "420px"] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute right-20 top-52 -z-10 hidden h-3 w-[480px] rounded-full bg-red-700 blur-sm motion-safe:animate-pulse lg:block"
        />
        <motion.div
          animate={{ opacity: [0.55, 1, 0.55] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute right-32 top-52 -z-10 hidden h-1 w-[480px] rounded-full bg-red-500 lg:block"
        />

        <div className="mx-auto grid min-h-[720px] max-w-[88rem] gap-10 px-4 py-14 sm:py-20 lg:min-h-[825px] lg:grid-cols-[minmax(0,1fr)_minmax(400px,0.88fr)] lg:items-center">
          <motion.div
            className="min-w-0 lg:min-h-[520px] lg:max-w-[44rem]"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-red-800/50 bg-red-950/25 px-4 py-2 text-sm font-semibold text-red-100">
              <BadgeCheck className="h-4 w-4 text-red-500" />
              Professional online file service platform
            </div>

            <h1 className="max-w-[42rem] text-balance break-words text-[clamp(2.85rem,5.7vw,5.35rem)] font-black uppercase leading-[0.96] tracking-[0.035em] sm:tracking-[0.055em]">
              Custom ECU & TCU{" "}
              <span className="block text-red-600">Tuning Files</span>
            </h1>

            <p className="mt-6 max-w-[38rem] text-pretty text-base leading-8 text-zinc-300 sm:text-lg">
              Upload original ECU/TCU files, select your service, track your
              order and download the completed file directly through the secure
              MG AutoTech customer portal.
            </p>

            <div className="mt-9 grid w-full max-w-[42rem] grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {!authReady ? (
                <>
                  <div className="h-14 w-36 rounded-xl border border-white/10 bg-white/[0.08]" />
                  <div className="h-14 w-40 rounded-xl bg-red-950/40" />
                  <div className="h-14 w-36 rounded-xl border border-red-800/30 bg-red-950/10" />
                </>
              ) : isLoggedIn ? (
                <>
                  <Link
                    href="/dashboard"
                    className="flex min-h-14 items-center justify-center rounded-xl bg-[#b1121b] px-5 py-4 text-center font-black text-white shadow-xl shadow-red-950/40 transition duration-300 hover:-translate-y-1 hover:bg-[#c91824]"
                  >
                    My Account
                  </Link>

                  <Link
                    href="/new-request"
                    className="flex min-h-14 items-center justify-center rounded-xl border border-red-800/50 px-5 py-4 text-center font-black text-white transition duration-300 hover:-translate-y-1 hover:bg-red-950/25"
                  >
                    New Request
                  </Link>

                  <Link
                    href="/dashboard/widget"
                    className="flex min-h-14 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-center font-black text-white transition duration-300 hover:-translate-y-1 hover:bg-white/10"
                  >
                    Vehicle Widget
                  </Link>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex min-h-14 items-center justify-center rounded-xl border border-white/10 bg-white/10 px-5 py-4 text-center font-black text-white transition duration-300 hover:-translate-y-1 hover:bg-white/15"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="flex min-h-14 items-center justify-center rounded-xl border border-white/10 bg-white/10 px-5 py-4 text-center font-black text-white transition duration-300 hover:-translate-y-1 hover:bg-white/15"
                  >
                    Login
                  </Link>

                  <Link
                    href="/register"
                    className="flex min-h-14 items-center justify-center rounded-xl bg-[#b1121b] px-5 py-4 text-center font-black text-white shadow-xl shadow-red-950/40 transition duration-300 hover:-translate-y-1 hover:bg-[#c91824]"
                  >
                    Register
                  </Link>

                  <Link
                    href="/new-request"
                    className="flex min-h-14 items-center justify-center rounded-xl border border-red-800/50 px-5 py-4 text-center font-black text-white transition duration-300 hover:-translate-y-1 hover:bg-red-950/25"
                  >
                    Upload File
                  </Link>

                  <Link
                    href="/widget"
                    className="flex min-h-14 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-center font-black text-white transition duration-300 hover:-translate-y-1 hover:bg-white/10"
                  >
                    Vehicle Widget €4.99
                  </Link>
                </>
              )}
            </div>

          </motion.div>

          <div className="hidden min-w-0 lg:block">
            <TechnicalHeroPreview />
          </div>
        </div>

        <PublicVehicleChecker />
      </section>

      <DeferredPerformanceTools />

      <AnimatedSection id="file-service-navigator" className="bg-[#050607] py-16 text-white">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-8 grid gap-5 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-red-900/50 bg-red-950/30 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-red-200 shadow-sm shadow-red-950/20">
                <Search className="h-4 w-4" />
                File Service Navigator
              </div>
              <h2 className="mt-5 max-w-3xl text-4xl font-black leading-tight md:text-5xl">
                Jump straight to the file-service answer you need.
              </h2>
            </div>
            <p className="max-w-3xl text-sm leading-7 text-zinc-300 lg:justify-self-end">
              The homepage now works like a guided file-service index: start
              with a service path, compare request routes, check read method
              context, prepare the brief or review privacy and delivery
              boundaries before secure account handling.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {homepageFileServiceNavigator.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.title}
                  href={item.href}
                  className="group flex min-h-56 flex-col rounded-3xl border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/20 transition duration-300 hover:-translate-y-1 hover:border-red-700/60 hover:bg-white/[0.075] focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700"
                >
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-red-900/45 bg-red-950/35 text-red-200">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-zinc-300">
                      {item.tag}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-white">
                    {item.title}
                  </h3>
                  <p className="mt-3 flex-1 text-sm leading-7 text-zinc-300">
                    {item.text}
                  </p>
                  <div className="mt-5 inline-flex items-center text-sm font-black text-red-300 transition group-hover:text-red-100">
                    Open section
                    <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-1" />
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.045] p-5 text-sm leading-7 text-zinc-300 shadow-2xl shadow-black/20">
            <span className="font-black text-white">Navigator boundary:</span>{" "}
            this is public on-page navigation only. It does not create
            requests, inspect customer files, open account data, change
            payments or deliver files.
          </div>
        </div>
      </AnimatedSection>

      <AnimatedSection className="bg-[#0b1226] py-12">
        <div className="mx-auto max-w-7xl px-4">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20">
            <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div>
                <div
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] ${
                    workloadSnapshot.support === "Offline"
                      ? "border-red-500/30 bg-red-500/10 text-red-300"
                      : workloadSnapshot.support === "Checking"
                      ? "border-blue-500/30 bg-blue-500/10 text-blue-300"
                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full shadow-lg ${
                      workloadSnapshot.support === "Offline"
                        ? "bg-red-400 shadow-red-400/40"
                        : workloadSnapshot.support === "Checking"
                        ? "bg-blue-400 shadow-blue-400/40"
                        : "bg-emerald-400 shadow-emerald-400/40"
                    }`}
                  />
                  Live Workload
                </div>
                <h2 className="mt-4 text-3xl font-black md:text-4xl">
                  Current file service availability
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-7 text-zinc-400">
                  A quick operational snapshot for workshops before sending a
                  new file request.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {liveWorkloadItems.map((item) => {
                  const Icon = item.icon;
                  const toneClass =
                    item.tone === "emerald"
                      ? "border-emerald-700/30 bg-emerald-950/20 text-emerald-300"
                      : item.tone === "blue"
                      ? "border-blue-700/30 bg-blue-950/20 text-blue-300"
                      : "border-red-800/40 bg-red-950/25 text-red-300";

                  return (
                    <div
                      key={item.title}
                      className="rounded-2xl border border-white/10 bg-black/30 p-4"
                    >
                      <div
                        className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border ${toneClass}`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
                        {item.title}
                      </div>
                      <div className="mt-2 text-2xl font-black text-white">
                        {item.value}
                      </div>
                      <p className="mt-2 text-xs leading-5 text-zinc-500">
                        {item.text}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </AnimatedSection>

      <HomepageFileServiceCorePanel />
      <AnimatedSection className="bg-[#050505] py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-sm font-black uppercase tracking-[0.25em] text-red-600">
                Request preparation
              </div>
              <h2 className="mt-3 max-w-3xl text-4xl font-black md:text-5xl">
                Request Readiness Cockpit
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-400">
                Give every file request a cleaner start: check the basic
                readiness, prepare a precise brief, confirm the read method and
                then submit through the secure portal.
              </p>
            </div>

            <Link
              href="/tools"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:border-red-800/60 hover:bg-red-950/25"
            >
              Open all tools
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.18 }}
              className="grid gap-4 md:grid-cols-2"
            >
              {requestReadinessSteps.map((step) => {
                const Icon = step.icon;

                return (
                  <motion.div variants={fadeUp} key={step.title}>
                    <Link
                      href={step.href}
                      className="group flex h-full flex-col rounded-3xl border border-white/10 bg-white/[0.04] p-6 transition duration-300 hover:-translate-y-1 hover:border-red-800/60 hover:bg-white/[0.07]"
                    >
                      <div className="mb-6 flex items-start justify-between gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-900/50 bg-red-950/25 text-red-400">
                          <Icon className="h-6 w-6" />
                        </div>
                        <div className="rounded-full border border-white/10 bg-black/35 px-3 py-1 text-xs font-black text-zinc-400">
                          {step.eyebrow}
                        </div>
                      </div>
                      <h3 className="text-xl font-black text-white">
                        {step.title}
                      </h3>
                      <p className="mt-3 flex-1 text-sm leading-6 text-zinc-400">
                        {step.text}
                      </p>
                      <div className="mt-6 inline-flex items-center text-sm font-black text-red-300 transition group-hover:text-red-100">
                        {step.action}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </motion.div>

            <div className="rounded-[2rem] border border-red-900/50 bg-[linear-gradient(145deg,rgba(177,18,27,0.18),rgba(255,255,255,0.04))] p-7 shadow-2xl shadow-black/25">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-emerald-300">
                <ShieldCheck className="h-4 w-4" />
                Safe by design
              </div>
              <h3 className="mt-5 text-2xl font-black">
                Prepare better requests without hidden file actions.
              </h3>
              <p className="mt-3 text-sm leading-7 text-zinc-400">
                The preparation cockpit is guidance only. It helps customers
                arrive with the right vehicle context, but file upload and
                processing stay inside the authenticated request workflow.
              </p>

              <div className="mt-6 space-y-3">
                {requestReadinessBoundaries.map((item) => (
                  <div
                    key={item}
                    className="flex gap-3 rounded-2xl border border-white/10 bg-black/25 p-3 text-sm text-zinc-300"
                  >
                    <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </AnimatedSection>

      <WorkshopCommandDesk />

      <AnimatedSection id="brands" className="bg-[#050505] py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-sm font-black uppercase tracking-[0.25em] text-red-600">
                Supported Brands
              </div>
              <h2 className="mt-3 max-w-3xl text-4xl font-black md:text-5xl">
                Popular ECU and TCU platforms for modern workshops.
              </h2>
            </div>

            <p className="max-w-xl text-sm leading-7 text-zinc-400">
              MG AutoTech supports a broad range of European diesel and petrol
              vehicles, with vehicle-specific checks before every file service.
            </p>
          </div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.18 }}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            {supportedBrands.map((brand) => (
              <motion.div
                variants={fadeUp}
                key={brand.name}
              >
                <Link
                  href={brand.href}
                  className="group block h-full rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition duration-300 hover:-translate-y-1 hover:border-red-800/60 hover:bg-white/[0.07] focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700"
                >
                  <div className="mb-5 flex items-center justify-between gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-900/50 bg-red-950/25 text-lg font-black text-red-200 shadow-lg shadow-red-950/20">
                      {brand.initials}
                    </div>

                    <BadgeCheck className="h-5 w-5 text-emerald-400 opacity-80 transition group-hover:opacity-100" />
                  </div>

                  <h3 className="text-xl font-black">{brand.name}</h3>
                  <p className="mt-2 text-sm font-bold text-zinc-500">
                    {brand.note}
                  </p>
                  <div className="mt-5 inline-flex items-center text-sm font-black text-red-300 transition group-hover:text-red-100">
                    {brand.action}
                    <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-1" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>

          <div className="mt-8 rounded-2xl border border-red-900/40 bg-red-950/20 p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-black text-white">
                  Need another brand?
                </div>
                <p className="mt-1 text-sm leading-6 text-zinc-400">
                  Customers can select from the vehicle database or submit a
                  manual request with ECU, read method and file details.
                </p>
              </div>

              <Link
                href="/new-request"
                className="inline-flex items-center justify-center rounded-xl bg-[#b1121b] px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-[#c91824]"
              >
                Check Vehicle
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </AnimatedSection>

      <AnimatedSection id="ecu-platforms" className="bg-[#0b0b0d] py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-sm font-black uppercase tracking-[0.25em] text-red-600">
                ECU Platform Library
              </div>
              <h2 className="mt-3 max-w-3xl text-4xl font-black md:text-5xl">
                Technical ECU and TCU guides for cleaner file requests.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-400">
                Model names are not enough for a professional file-service
                request. These guides help workshops prepare controller family,
                read method and identification details before submitting a file.
              </p>
            </div>

            <Link
              href="/ecu-platforms"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:border-red-800/60 hover:bg-red-950/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700"
            >
              Open platform hub
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.18 }}
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
          >
            {ecuPlatformLinks.map((platform) => (
              <motion.div variants={fadeUp} key={platform.name}>
                <Link
                  href={platform.href}
                  className="group flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition duration-300 hover:-translate-y-1 hover:border-red-800/60 hover:bg-white/[0.07] focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700"
                >
                  <div className="mb-5 flex items-center justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-900/50 bg-red-950/25 text-red-300">
                      <Cpu className="h-6 w-6" />
                    </div>
                    <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs font-black text-zinc-400">
                      {platform.tag}
                    </span>
                  </div>

                  <h3 className="text-lg font-black text-white">
                    {platform.name}
                  </h3>
                  <p className="mt-3 flex-1 text-sm leading-6 text-zinc-400">
                    {platform.note}
                  </p>
                  <div className="mt-5 inline-flex items-center text-sm font-black text-red-300 transition group-hover:text-red-100">
                    {platform.action}
                    <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-1" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              "Identify the ECU or TCU family before assuming support.",
              "Submit original files only through the authenticated request workflow.",
              "No public guide edits, generates or checksum-corrects customer files.",
            ].map((item) => (
              <div
                key={item}
                className="flex gap-3 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm leading-6 text-zinc-300"
              >
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </AnimatedSection>

      <AnimatedSection className="bg-[#07090d] py-20 text-white">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-sm font-black uppercase tracking-[0.25em] text-red-300">
                Why MG AutoTech?
              </div>
              <h2 className="mt-3 max-w-3xl text-4xl font-black md:text-5xl">
                A file service workflow built for serious workshop operations.
              </h2>
            </div>

            <Link
              href={isLoggedIn ? "/dashboard" : "/register"}
              className="inline-flex items-center justify-center rounded-xl bg-[#b1121b] px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-950/20 transition hover:-translate-y-0.5 hover:bg-[#c91824]"
            >
              {isLoggedIn ? "My Account" : "Create Account"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            className="grid gap-5 md:grid-cols-2 xl:grid-cols-4"
          >
            {trustHighlights.map((item) => {
              const Icon = item.icon;

              return (
                <motion.div
                  variants={fadeUp}
                  key={item.title}
                  className="rounded-2xl border border-white/10 bg-white/[0.045] p-6 shadow-2xl shadow-black/20 transition duration-300 hover:-translate-y-1 hover:border-red-700/60 hover:bg-white/[0.075]"
                >
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-red-900/45 bg-red-950/35 text-red-200">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-black">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-zinc-300">
                    {item.text}
                  </p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </AnimatedSection>

      <AnimatedSection className="bg-[#050505] py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <div className="text-sm font-black uppercase tracking-[0.25em] text-red-600">
              Calibration Knowledge Base
            </div>
            <h2 className="mt-3 text-4xl font-black md:text-5xl">
              WinOLS based analysis with vehicle-specific file review.
            </h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-zinc-400">
              MG AutoTech focuses on structured calibration review: ECU/TCU
              family, read method, selected service, fault notes and available
              map data are checked before the file workflow continues.
            </p>
            <div className="mt-6 rounded-2xl border border-red-900/50 bg-red-950/20 p-5">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-red-300">
                Professional approach
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-300">
                No exaggerated database numbers. Just a clean technical
                workflow built around WinOLS, DAMOS/A2L support and manual
                calibration checks where they matter.
              </p>
            </div>
          </div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            className="grid gap-4 sm:grid-cols-2"
          >
            {calibrationKnowledgeItems.map((item) => {
              const Icon = item.icon;

              return (
                <motion.div
                  variants={fadeUp}
                  key={item.title}
                  className={`rounded-2xl border p-5 transition duration-300 hover:-translate-y-1 ${
                    item.highlight
                      ? "border-red-700 bg-[#b1121b] text-white shadow-2xl shadow-red-950/40"
                      : "border-white/10 bg-white/[0.04] hover:border-red-800/60 hover:bg-white/[0.07]"
                  }`}
                >
                  <div
                    className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ${
                      item.highlight
                        ? "bg-white/15 text-white"
                        : "border border-red-900/50 bg-red-950/30 text-red-500"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-black">{item.title}</h3>
                  <p
                    className={`mt-3 text-sm leading-6 ${
                      item.highlight ? "text-red-50" : "text-zinc-400"
                    }`}
                  >
                    {item.text}
                  </p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </AnimatedSection>

      <BusinessMarginCalculator />

      <AnimatedSection className="border-y border-white/10 bg-[linear-gradient(135deg,#07090d,#111827_55%,#050505)] py-16">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <div className="text-sm font-black uppercase tracking-[0.25em] text-red-500">
              Customer workflow
            </div>
            <h2 className="mt-3 text-4xl font-black md:text-5xl">
              A Clear File-Service Workflow
            </h2>
            <p className="mt-4 text-sm leading-7 text-zinc-400">
              From vehicle selection to secure file upload, request tracking and
              final delivery, MG AutoTech gives customers a structured way to
              manage ECU/TCU file requests.
            </p>
          </div>
          <Link
            href="/how-it-works"
            className="inline-flex items-center justify-center rounded-xl bg-[#b1121b] px-6 py-4 text-sm font-black text-white shadow-lg shadow-red-950/30 transition hover:-translate-y-0.5 hover:bg-[#c91824]"
          >
            See How It Works
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      </AnimatedSection>

      <AnimatedSection id="workflow" className="bg-[#0b1226] py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-12 flex items-end justify-between gap-6">
            <div>
              <div className="text-sm font-black uppercase tracking-[0.25em] text-red-500">
                Workflow
              </div>
              <h2 className="mt-3 text-4xl font-black uppercase tracking-wide md:text-5xl">
                Get your files in 4 simple steps
              </h2>
              <p className="mt-3 text-zinc-400">
                A clean process for customers, workshops and partners.
              </p>
            </div>

            <Link
              href="/register"
              aria-label="Create account"
              className="hidden rounded-xl bg-[#b1121b] p-4 text-white transition duration-300 hover:-translate-y-1 hover:bg-[#c91824] md:block"
            >
              <ArrowRight />
            </Link>
          </div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            className="grid gap-5 md:grid-cols-4"
          >
            {steps.map((step, index) => {
              const Icon = step.icon;

              return (
                <motion.div
                  variants={fadeUp}
                  key={step.title}
                  className={`relative rounded-3xl border border-white/10 bg-white/[0.04] p-7 text-center transition duration-300 hover:-translate-y-2 hover:border-red-800/60 hover:bg-white/[0.07] ${
                    index === 1 || index === 3 ? "md:mt-10" : ""
                  }`}
                >
                  <Icon className="mx-auto mb-5 h-10 w-10 text-red-500" />
                  <h3 className="text-xl font-black">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-zinc-400">
                    {step.text}
                  </p>
                  <div className="absolute -bottom-5 left-1/2 flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full bg-[#b1121b] text-lg font-black shadow-lg shadow-red-950/40">
                    {index + 1}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </AnimatedSection>

      <AnimatedSection id="services" className="bg-[#050607] py-20 text-white">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-12 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <div className="text-sm font-black uppercase tracking-[0.25em] text-red-300">
                Our Services
              </div>
              <h2 className="mt-3 max-w-3xl text-4xl font-black md:text-5xl">
                Professional ECU and TCU software solutions.
              </h2>
            </div>
            <div className="flex flex-wrap gap-2" aria-label="Performance calibration pages">
              <Link href="/services/stage-1" className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-zinc-200 hover:border-red-800/60 hover:text-white">Stage 1</Link>
              <Link href="/services/stage-2" className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-zinc-200 hover:border-red-800/60 hover:text-white">Stage 2</Link>
              <Link href="/services/stage-3" className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-zinc-200 hover:border-red-800/60 hover:text-white">Stage 3</Link>
              <Link href="/file-service#stage-comparison" className="rounded-lg border border-red-800/60 bg-red-950/25 px-4 py-3 text-sm font-black text-red-200 hover:bg-red-950/40">Compare stages</Link>
            </div>
          </div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.18 }}
            className="grid gap-5 md:grid-cols-3"
          >
            {services.map((service) => (
              <motion.div variants={fadeUp} key={service.title}>
                <Link
                  href={service.href}
                  className="group flex h-full flex-col rounded-3xl border border-white/10 bg-white/[0.045] p-6 shadow-2xl shadow-black/20 transition duration-300 hover:-translate-y-2 hover:border-red-700/60 hover:bg-white/[0.075] focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700"
                >
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-900/45 bg-red-950/35 text-red-200">
                      <FileCode2 />
                    </div>
                    <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-zinc-300">
                      {service.searchIntent}
                    </span>
                  </div>
                  <h3 className="text-xl font-black">{service.title}</h3>
                  <p className="mt-3 flex-1 text-sm leading-6 text-zinc-300">
                    {service.text}
                  </p>
                  <div className="mt-5 rounded-xl border border-red-900/45 bg-red-950/25 px-4 py-3 text-sm font-black text-red-100">
                    {service.credits}
                  </div>
                  <div className="mt-5 inline-flex items-center text-sm font-black text-red-300 transition group-hover:text-red-100">
                    {service.action}
                    <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-1" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </AnimatedSection>

      <AnimatedSection className="bg-[#050505] py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-10">
            <div className="text-sm font-black uppercase tracking-[0.25em] text-red-600">
              Workshop Use Cases
            </div>
            <h2 className="mt-3 text-4xl font-black md:text-5xl">
              Built around real file service operations.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400">
              A cleaner workflow for workshops that need repeatable requests,
              clear technical details and secure file delivery.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-4">
            {workshopUseCases.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.title}
                  className="rounded-2xl border border-red-900/50 bg-white/[0.03] p-6 transition duration-300 hover:-translate-y-1 hover:border-red-700 hover:bg-white/[0.06]"
                >
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-red-900/50 bg-red-950/25 text-red-500">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-black">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-zinc-400">
                    {item.text}
                  </p>
                  <div className="mt-5 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-black text-red-300">
                    {item.meta}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </AnimatedSection>

      <AnimatedSection id="prices" className="bg-[#0b1226] py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-10">
            <div className="text-sm font-black uppercase tracking-[0.25em] text-red-500">
              Credit Prices
            </div>
            <h2 className="mt-3 text-4xl font-black md:text-5xl">
              Flexible credit packages
            </h2>
            <p className="mt-3 text-zinc-400">
              Volume based pricing for customers, workshops and partners.
            </p>
            <div className="mt-4 inline-flex rounded-full border border-red-700/60 bg-red-950/40 px-4 py-2 text-sm font-black text-red-100">
              Limited time -{CREDIT_PROMOTION_PERCENT}% on all credit packages
            </div>
          </div>

          <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 xl:mx-0 xl:grid xl:grid-cols-5 xl:overflow-visible xl:px-0">
            {homepageCreditPackages.map((pack) => (
              <div
                key={pack.id}
                className={`relative flex min-h-[320px] min-w-[min(82vw,20rem)] snap-start flex-col rounded-3xl border p-6 transition duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-red-950/30 xl:min-w-0 ${
                  pack.highlight
                    ? "border-red-700 bg-gradient-to-b from-red-950/35 to-white/[0.06]"
                    : "border-white/10 bg-white/[0.04]"
                }`}
              >
                <div className="flex min-h-7 items-start justify-between gap-2">
                  <div className="min-w-0 text-[11px] font-black uppercase tracking-[0.12em] text-red-300">
                    {pack.name}
                  </div>
                  {pack.highlight && (
                    <div className="shrink-0 rounded-full bg-[#b1121b] px-2.5 py-1 text-[10px] font-black">
                      Popular
                    </div>
                  )}
                </div>
                <div className="mt-2 text-lg font-black text-white">
                  {pack.credits} Credits
                </div>

                <div className="mt-6 text-sm font-bold text-zinc-500 line-through">
                  {formatEuro(pack.basePriceEuro)}
                </div>
                <div className="mt-1 text-4xl font-black">
                  {formatEuro(pack.priceEuro)}
                </div>
                <div className="mt-2 text-sm font-bold text-red-300">
                  {formatCreditUnitEuro(pack.unitPriceEuro)} per credit
                </div>

                <p className="mt-5 flex-1 text-sm leading-6 text-zinc-400">
                  {pack.description}
                </p>

                <Link
                  href="/dashboard/credits"
                  className="mt-6 flex min-h-12 items-center justify-center rounded-xl border border-red-800/70 px-5 py-3 text-center font-black text-white transition duration-300 hover:border-red-600 hover:bg-red-950/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                  aria-label={`Select the ${pack.name} ${pack.credits} credit package`}
                >
                  Select package
                </Link>
              </div>
            ))}
          </div>
        </div>
      </AnimatedSection>

      <AnimatedSection id="security" className="bg-[#050505] py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <div className="text-sm font-black uppercase tracking-[0.25em] text-red-600">
              Security
            </div>
            <h2 className="mt-3 text-4xl font-black md:text-5xl">
              Secure customer portal with controlled file workflow.
            </h2>
            <p className="mt-5 leading-8 text-zinc-400">
              Customers can only access their own dashboard, credits and orders.
              Critical actions like credits, files and order status stay
              controlled by backend logic and database rules.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {securityItems.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.title}
                  className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 transition duration-300 hover:-translate-y-2 hover:border-red-800/60 hover:bg-white/[0.07]"
                >
                  <Icon className="mb-4 h-7 w-7 text-red-600" />
                  <div className="font-black">{item.title}</div>
                </div>
              );
            })}
          </div>
        </div>
      </AnimatedSection>

      <AnimatedSection className="bg-[#07090d] py-20 text-white">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-10 grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <div className="text-sm font-black uppercase tracking-[0.25em] text-red-300">
                Workshop Search Guide
              </div>
              <h2 className="mt-3 text-4xl font-black md:text-5xl">
                ECU file service questions answered before upload.
              </h2>
            </div>

            <p className="max-w-3xl text-sm leading-7 text-zinc-300">
              Workshops often search for the same answers before opening a file
              request: what information is needed, when upload starts, how
              delivery works and what to do when the exact vehicle is not yet in
              the selector. This guide keeps those answers clear on the homepage.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {homepageSearchIntentFaq.map((item) => (
              <article
                key={item.question}
                className="rounded-3xl border border-white/10 bg-white/[0.045] p-6 shadow-2xl shadow-black/20"
              >
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <span className="rounded-full border border-red-900/45 bg-red-950/30 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-red-200">
                    {item.intent}
                  </span>
                  <Link
                    href={item.href}
                    className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-black text-zinc-200 transition hover:border-red-700/60 hover:text-red-100"
                  >
                    {item.action}
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </div>
                <h3 className="text-xl font-black leading-tight">
                  {item.question}
                </h3>
                <p className="mt-4 text-sm leading-7 text-zinc-300">
                  {item.answer}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-5 text-sm leading-7 text-emerald-100">
            <div className="flex gap-3">
              <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-emerald-700" />
              <p>
                FAQ structured data is generated from the same customer-visible
                answers. It does not include private file paths, customer data,
                admin notes, source metadata or generation internals.
              </p>
            </div>
          </div>
        </div>
      </AnimatedSection>

      <section id="contact" className="bg-[#b1121b] py-16">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-4xl font-black">
              Start your next file request.
            </h2>
            <p className="mt-3 text-red-100">
              {isLoggedIn
                ? "Open your dashboard or create a new MG AutoTech file request."
                : "Register, login and create your first MG AutoTech file request."}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {isLoggedIn ? (
              <>
                <Link
                  href="/dashboard"
                  className="rounded-xl bg-white px-7 py-4 font-black text-[#b1121b] transition duration-300 hover:-translate-y-1 hover:bg-zinc-100"
                >
                  My Account
                </Link>
                <Link
                  href="/new-request"
                  className="rounded-xl border border-white/30 px-7 py-4 font-black text-white transition duration-300 hover:-translate-y-1 hover:bg-white/10"
                >
                  New Request
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-xl border border-white/30 px-7 py-4 font-black text-white transition duration-300 hover:-translate-y-1 hover:bg-white/10"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/register"
                  className="rounded-xl bg-white px-7 py-4 font-black text-[#b1121b] transition duration-300 hover:-translate-y-1 hover:bg-zinc-100"
                >
                  Create Account
                </Link>
                <Link
                  href="/login"
                  className="rounded-xl border border-white/30 px-7 py-4 font-black text-white transition duration-300 hover:-translate-y-1 hover:bg-white/10"
                >
                  Login
                </Link>
              </>
            )}
            <a
              href="mailto:info@mgautotech.de"
              className="rounded-xl border border-white/30 px-7 py-4 font-black text-white transition duration-300 hover:-translate-y-1 hover:bg-white/10"
            >
              <MessageCircle className="mr-2 inline h-5 w-5" />
              Contact
            </a>
          </div>
        </div>
      </section>

      <Footer />
      <OnlineStatus />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(homepageSearchIntentJsonLd),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(fileServiceAnswerLibraryJsonLd),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(homepageResourceJsonLd),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(homepageFileServiceGlossaryJsonLd),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(homepagePageJsonLd),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(homepageFileServiceJsonLd),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(homepageRequestPreparationHowToJsonLd),
        }}
      />
    </main>
  );
}
