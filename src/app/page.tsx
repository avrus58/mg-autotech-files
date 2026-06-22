"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  Car,
  CheckCircle2,
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
  Wrench,
  Zap,
  Activity,
  BarChart3,
  Sparkles,
  Calculator,
  TrendingUp,
} from "lucide-react";
import { Footer } from "@/components/Footer";
import { OnlineStatus } from "@/components/OnlineStatus";
import {
  CREDIT_PROMOTION_PERCENT,
  creditPackages as sharedCreditPackages,
} from "@/lib/creditPackages";
import { supabase } from "@/lib/supabaseClient";

const services = [
  {
    title: "Stage 1",
    text: "Performance optimization for stock vehicles.",
    credits: "10 Credits",
  },
  {
    title: "DPF OFF",
    text: "Technical software solution for diesel vehicles.",
    credits: "6 Credits",
  },
  {
    title: "EGR / AGR OFF",
    text: "EGR related software solution and DTC support.",
    credits: "6 Credits",
  },
  {
    title: "AdBlue OFF",
    text: "SCR / AdBlue software solution for supported ECUs.",
    credits: "11 Credits",
  },
  {
    title: "DTC OFF",
    text: "Diagnostic trouble code removal by request.",
    credits: "4 Credits",
  },
  {
    title: "TCU Tuning",
    text: "Gearbox software optimization for supported TCUs.",
    credits: "Manual",
  },
];

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

const creditPackages = sharedCreditPackages
  .filter((pack) => pack.credits <= 250)
  .map((pack) => ({
    credits: String(pack.credits),
    price: pack.priceEuro,
    basePrice: pack.basePriceEuro,
    each: pack.priceEuro / pack.credits,
    popular: pack.highlight,
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
  { name: "BMW", note: "MD1, EDC17, MG1", initials: "BM" },
  { name: "Mercedes-Benz", note: "CDI, MED, VGS", initials: "MB" },
  { name: "Audi", note: "VAG ECU / TCU", initials: "AU" },
  { name: "Volkswagen", note: "EDC, Simos, DSG", initials: "VW" },
  { name: "Porsche", note: "Performance files", initials: "PO" },
  { name: "Opel", note: "Diesel & petrol", initials: "OP" },
  { name: "Renault", note: "ECU solutions", initials: "RE" },
  { name: "Peugeot", note: "BlueHDi support", initials: "PE" },
];

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
    extraCost: 10,
    conversion: 80,
  },
  {
    label: "Growing partner",
    files: 35,
    salePrice: 169,
    credits: 8,
    creditCost: 3.8,
    extraCost: 8,
    conversion: 85,
  },
  {
    label: "High-volume reseller",
    files: 80,
    salePrice: 189,
    credits: 9,
    creditCost: 3.5,
    extraCost: 7,
    conversion: 90,
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
    stockHp: number;
    tunedHp: number;
    gainHp: number;
    stockNm: number;
    tunedNm: number;
    gainNm: number;
  };
  stage2?: {
    stockHp: number;
    tunedHp: number;
    gainHp: number;
    stockNm: number;
    tunedNm: number;
    gainNm: number;
  };
  readMethods?: string[];
  services?: string[];
};


const heroSlides = [
  {
    index: "01",
    title: "BMW G20 320d",
    subtitle: "2.0 Diesel · Bosch MD1 · OBD / Bench",
    badge: "Stage 1 Ready",
    stockHp: "190 HP",
    tunedHp: "220 HP",
    gain: "+30 HP",
    torque: "+70 Nm",
    ecu: "Bosch MD1",
    service: "Stage 1",
    status: "Fast",
  },
  {
    index: "02",
    title: "BMW F30 320d",
    subtitle: "2.0 Diesel · Bosch EDC17 · OBD / Bench",
    badge: "Workshop Popular",
    stockHp: "184 HP",
    tunedHp: "220 HP",
    gain: "+36 HP",
    torque: "+80 Nm",
    ecu: "Bosch EDC17",
    service: "Stage 1 + EGR",
    status: "Popular",
  },
  {
    index: "03",
    title: "BMW G30 530d",
    subtitle: "3.0 Diesel · Bosch MD1CP002 · Bench",
    badge: "High Torque",
    stockHp: "265 HP",
    tunedHp: "320 HP",
    gain: "+55 HP",
    torque: "+120 Nm",
    ecu: "Bosch MD1CP002",
    service: "Stage 1",
    status: "Premium",
  },
  {
    index: "04",
    title: "BMW F10 530d",
    subtitle: "3.0 Diesel · Bosch EDC17CP45 · OBD / Bench",
    badge: "ECU Verified",
    stockHp: "258 HP",
    tunedHp: "310 HP",
    gain: "+52 HP",
    torque: "+110 Nm",
    ecu: "Bosch EDC17CP45",
    service: "Stage 1 + DTC",
    status: "Verified",
  },
];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 34 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.65,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

const stagger: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

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
      className={className}
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
        className="absolute left-[8%] top-[18%] h-72 w-72 rounded-full bg-red-900/30 blur-3xl"
      />

      <motion.div
        animate={{
          x: [0, -35, 0],
          y: [0, 35, 0],
          opacity: [0.1, 0.22, 0.1],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute right-[8%] top-[28%] h-96 w-96 rounded-full bg-red-800/25 blur-3xl"
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

const technicalPreviewSteps = [
  {
    title: "Secure upload",
    text: "Original file and vehicle data enter a private request workflow.",
    icon: Upload,
  },
  {
    title: "ECU identification",
    text: "Read method, ECU/TCU type and HW/SW details are checked before work.",
    icon: Search,
  },
  {
    title: "Calibration",
    text: "Requested services are prepared against the submitted file details.",
    icon: Gauge,
  },
  {
    title: "Checksum & delivery",
    text: "Completed file versions are delivered through the customer portal.",
    icon: ShieldCheck,
  },
];

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
              className="relative flex h-56 w-56 items-center justify-center rounded-[2.5rem] border border-red-800/60 bg-black/80 shadow-2xl shadow-red-950/50"
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



function HeroShowcase() {
  const [activeSlide, setActiveSlide] = useState(0);
  const slide = heroSlides[activeSlide];

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % heroSlides.length);
    }, 6500);

    return () => window.clearInterval(interval);
  }, []);

  const nextSlide = () => {
    setActiveSlide((current) => (current + 1) % heroSlides.length);
  };

  const previousSlide = () => {
    setActiveSlide((current) =>
      current === 0 ? heroSlides.length - 1 : current - 1
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, x: 24 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      transition={{ duration: 0.75, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
      className="hidden h-[685px] lg:block"
    >
      <div className="relative h-[685px] overflow-hidden rounded-[2.25rem] border border-white/10 bg-[#08090c]/80 p-5 shadow-2xl shadow-black backdrop-blur-xl">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-red-700/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-red-950/30 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/70 to-transparent" />

        <div className="relative mb-5 flex items-center justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.22em] text-red-500">
              MG AutoTech Live Showcase
            </div>
            <div className="mt-1 text-2xl font-black">
              Vehicle Intelligence Preview
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={previousSlide}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] transition hover:bg-white/10"
              aria-label="Previous showcase"
            >
              <ChevronDown className="h-4 w-4 rotate-90" />
            </button>

            <button
              onClick={nextSlide}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-800/50 bg-red-950/25 transition hover:bg-red-900/30"
              aria-label="Next showcase"
            >
              <ChevronDown className="h-4 w-4 -rotate-90" />
            </button>
          </div>
        </div>

        <div className="relative h-[435px] overflow-hidden rounded-[1.8rem] border border-white/10 bg-black/45 p-5">
          <motion.div
            key={slide.index}
            initial={{ opacity: 0, x: 18, scale: 0.985 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
            className="grid h-[395px] gap-5 xl:grid-cols-[1fr_0.85fr]"
          >
            <div>
              <div className="mb-5 flex items-center gap-3">
                <span className="rounded-full border border-red-800/50 bg-red-950/35 px-3 py-1 text-xs font-black text-red-100">
                  {slide.index} / 04
                </span>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-300">
                  {slide.badge}
                </span>
              </div>

              <h3 className="text-3xl font-black leading-tight">
                {slide.title}
              </h3>

              <p className="mt-2 text-sm font-bold text-zinc-400">
                {slide.subtitle}
              </p>

              <div className="mt-5 grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <Gauge className="mb-3 h-5 w-5 text-red-500" />
                  <div className="text-xs text-zinc-500">Stock</div>
                  <div className="mt-1 font-black">{slide.stockHp}</div>
                </div>

                <div className="rounded-2xl border border-red-800/50 bg-red-950/25 p-4">
                  <BarChart3 className="mb-3 h-5 w-5 text-red-400" />
                  <div className="text-xs text-zinc-500">Tuned</div>
                  <div className="mt-1 font-black">{slide.tunedHp}</div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <Sparkles className="mb-3 h-5 w-5 text-red-500" />
                  <div className="text-xs text-zinc-500">Gain</div>
                  <div className="mt-1 font-black text-red-400">
                    {slide.gain}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                  <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
                    ECU
                  </div>
                  <div className="mt-2 font-black">{slide.ecu}</div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                  <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
                    Service
                  </div>
                  <div className="mt-2 font-black">{slide.service}</div>
                </div>
              </div>
            </div>

            <div className="relative flex h-[395px] items-center justify-center overflow-hidden rounded-[1.6rem] border border-white/10 bg-gradient-to-br from-red-950/25 via-black to-zinc-950 p-5">
              <div className="absolute h-64 w-64 rounded-full border-[22px] border-red-700/25" />
              <div className="absolute h-44 w-44 rounded-full bg-red-700/15 blur-3xl" />

              <motion.div
                key={`${slide.index}-chip`}
                animate={{ y: [0, -8, 0], rotate: [0, 1.5, 0] }}
                transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
                className="relative flex h-44 w-44 items-center justify-center rounded-[2.2rem] border border-red-800/50 bg-black/70 shadow-2xl shadow-red-950/40"
              >
                <div className="absolute inset-4 rounded-[1.7rem] border border-red-700/30" />
                <Cpu className="h-20 w-20 text-red-500" />
              </motion.div>

              <div className="absolute bottom-5 left-5 right-5 rounded-2xl border border-white/10 bg-black/50 p-4 backdrop-blur">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-zinc-500">Workflow</div>
                    <div className="mt-1 font-black">Secure File Service</div>
                  </div>

                  <div className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-300">
                    {slide.status}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="relative mt-5 grid grid-cols-4 gap-2">
          {heroSlides.map((item, index) => (
            <button
              key={item.index}
              onClick={() => setActiveSlide(index)}
              className={`h-2 rounded-full transition ${
                index === activeSlide
                  ? "bg-red-600"
                  : "bg-white/15 hover:bg-white/30"
              }`}
              aria-label={`Show slide ${item.index}`}
            />
          ))}
        </div>

        <div className="relative mt-5 grid h-[150px] gap-3 md:grid-cols-4">
          {[
            ["Fast Processing", "Quick turnaround", Zap],
            ["Secure Files", "Private workflow", ShieldCheck],
            ["BMW Ready", "Modern ECU support", Car],
            ["Expert Tuning", "Professional review", Wrench],
          ].map(([title, description, Icon]) => {
            const LucideIcon = Icon as typeof Zap;

            return (
              <div
                key={String(title)}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
              >
                <LucideIcon className="mb-3 h-5 w-5 text-red-500" />
                <div className="text-sm font-black">{String(title)}</div>
                <div className="mt-1 text-xs text-zinc-500">
                  {String(description)}
                </div>
              </div>
            );
          })}
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
}: {
  title: string;
  data?: PublicVehicleData["stage1"];
}) {
  if (!data) return null;

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
            {data.stockHp} → {data.tunedHp} HP
          </span>
        </div>

        <div className="flex justify-between rounded-xl bg-white/10 px-3 py-2">
          <span className="text-red-100/80">Torque</span>
          <span className="font-black">
            {data.stockNm} → {data.tunedNm} Nm
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="rounded-xl border border-white/15 bg-white/10 p-2 text-center">
            <div className="text-[10px] uppercase tracking-[0.12em] text-red-100/70">
              HP Gain
            </div>
            <div className="text-lg font-black">+{data.gainHp}</div>
          </div>

          <div className="rounded-xl border border-white/15 bg-white/10 p-2 text-center">
            <div className="text-[10px] uppercase tracking-[0.12em] text-red-100/70">
              Nm Gain
            </div>
            <div className="text-lg font-black">+{data.gainNm}</div>
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

type LogPoint = {
  rpm: number;
  torque: number;
  kw: number;
  hp: number;
};

function calculatePowerFromTorque(torqueNm: number, rpm: number) {
  const kw = (torqueNm * rpm) / 9549;
  const hp = kw * 1.34102;

  return { kw, hp };
}

function parseLogInput(input: string) {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const firstLine = lines[0].toLowerCase();

  if (firstLine.includes("engine speed") && firstLine.includes("engine torque")) {
    return parseAutotunerCsv(input);
  }

  return lines
    .map((line) => {
      const [rpmValue, torqueValue] = line
        .split(/[,;\t ]+/)
        .map((value) => Number(value.replace(",", ".")));

      if (
        !Number.isFinite(rpmValue) ||
        !Number.isFinite(torqueValue) ||
        rpmValue <= 0 ||
        torqueValue <= 0
      ) {
        return null;
      }

      const power = calculatePowerFromTorque(torqueValue, rpmValue);

      return {
        rpm: rpmValue,
        torque: torqueValue,
        kw: power.kw,
        hp: power.hp,
      };
    })
    .filter((point): point is LogPoint => Boolean(point));
}

function splitCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());

  return values;
}

function parseAutotunerCsv(input: string) {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]).map((header) =>
    header.toLowerCase().replaceAll(" ", "")
  );
  const rpmIndex = headers.findIndex((header) =>
    header.includes("enginespeed(rpm)")
  );
  const torqueIndex = headers.findIndex((header) =>
    header.includes("enginetorque(nm)")
  );

  if (rpmIndex === -1 || torqueIndex === -1) return [];

  return lines
    .slice(1)
    .map((line) => {
      const values = splitCsvLine(line);
      const rpmValue = Number(values[rpmIndex]?.replace(",", "."));
      const torqueValue = Number(values[torqueIndex]?.replace(",", "."));

      if (
        !Number.isFinite(rpmValue) ||
        !Number.isFinite(torqueValue) ||
        rpmValue <= 0 ||
        torqueValue <= 0
      ) {
        return null;
      }

      const power = calculatePowerFromTorque(torqueValue, rpmValue);

      return {
        rpm: rpmValue,
        torque: torqueValue,
        kw: power.kw,
        hp: power.hp,
      };
    })
    .filter((point): point is LogPoint => Boolean(point));
}

function escapeSvgText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildDynoReportSvg({
  fileName,
  points,
  peakTorque,
  peakPower,
}: {
  fileName: string;
  points: LogPoint[];
  peakTorque: LogPoint | null;
  peakPower: LogPoint | null;
}) {
  const width = 1200;
  const height = 760;
  const chart = {
    x: 90,
    y: 190,
    width: 980,
    height: 430,
  };
  const rpmValues = points.map((point) => point.rpm);
  const minRpm = Math.min(...rpmValues);
  const maxRpm = Math.max(...rpmValues);
  const maxHp = Math.max(...points.map((point) => point.hp), 1);
  const maxNm = Math.max(...points.map((point) => point.torque), 1);
  const maxScale = Math.ceil(Math.max(maxHp, maxNm) / 50) * 50;

  const xFor = (rpmValue: number) =>
    chart.x +
    ((rpmValue - minRpm) / Math.max(1, maxRpm - minRpm)) * chart.width;
  const yFor = (value: number) =>
    chart.y + chart.height - (value / maxScale) * chart.height;

  const hpPolyline = points
    .map((point) => `${xFor(point.rpm).toFixed(1)},${yFor(point.hp).toFixed(1)}`)
    .join(" ");
  const torquePolyline = points
    .map((point) => `${xFor(point.rpm).toFixed(1)},${yFor(point.torque).toFixed(1)}`)
    .join(" ");
  const gridLines = [0, 0.25, 0.5, 0.75, 1]
    .map((ratio) => {
      const y = chart.y + chart.height * ratio;
      const label = Math.round(maxScale * (1 - ratio));

      return `
        <line x1="${chart.x}" y1="${y}" x2="${chart.x + chart.width}" y2="${y}" stroke="#27272a" stroke-width="1"/>
        <text x="${chart.x - 18}" y="${y + 5}" text-anchor="end" fill="#71717a" font-size="18">${label}</text>
      `;
    })
    .join("");
  const rpmLabels = [minRpm, minRpm + (maxRpm - minRpm) / 2, maxRpm]
    .map((rpmValue) => {
      const x = xFor(rpmValue);

      return `<text x="${x}" y="${chart.y + chart.height + 42}" text-anchor="middle" fill="#a1a1aa" font-size="18">${Math.round(rpmValue)} rpm</text>`;
    })
    .join("");
  const peakPs = peakPower ? peakPower.kw * 1.35962 : 0;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#050505"/>
  <rect x="32" y="32" width="${width - 64}" height="${height - 64}" rx="34" fill="#09090b" stroke="#27272a" stroke-width="2"/>
  <circle cx="1040" cy="95" r="150" fill="#7f1d1d" opacity="0.22"/>
  <text x="78" y="92" fill="#ef4444" font-size="22" font-weight="900" letter-spacing="5">MG AUTOTECH</text>
  <text x="78" y="135" fill="#ffffff" font-size="42" font-weight="900">Dyno Log Report</text>
  <text x="78" y="165" fill="#a1a1aa" font-size="18">${escapeSvgText(fileName || "Autotuner CSV log")}</text>

  <rect x="78" y="655" width="1044" height="58" rx="18" fill="#111113" stroke="#27272a"/>
  <text x="104" y="691" fill="#a1a1aa" font-size="18">Calculated from ECU log values. Power is estimated from torque and RPM.</text>

  <rect x="760" y="72" width="150" height="82" rx="18" fill="#111113" stroke="#27272a"/>
  <text x="785" y="105" fill="#a1a1aa" font-size="16">Peak PS</text>
  <text x="785" y="138" fill="#ffffff" font-size="30" font-weight="900">${peakPower ? peakPs.toFixed(1) : "-"}</text>

  <rect x="928" y="72" width="150" height="82" rx="18" fill="#111113" stroke="#27272a"/>
  <text x="953" y="105" fill="#a1a1aa" font-size="16">Peak Nm</text>
  <text x="953" y="138" fill="#ffffff" font-size="30" font-weight="900">${peakTorque ? peakTorque.torque.toFixed(0) : "-"}</text>

  <rect x="${chart.x}" y="${chart.y}" width="${chart.width}" height="${chart.height}" rx="18" fill="#0f0f12" stroke="#27272a" stroke-width="2"/>
  ${gridLines}
  ${rpmLabels}

  <polyline points="${torquePolyline}" fill="none" stroke="#38bdf8" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  <polyline points="${hpPolyline}" fill="none" stroke="#ef4444" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>

  ${
    peakTorque
      ? `<circle cx="${xFor(peakTorque.rpm)}" cy="${yFor(peakTorque.torque)}" r="8" fill="#38bdf8"/>
         <text x="${xFor(peakTorque.rpm) + 12}" y="${yFor(peakTorque.torque) - 12}" fill="#bae6fd" font-size="17" font-weight="900">${peakTorque.torque.toFixed(0)} Nm @ ${peakTorque.rpm.toFixed(0)} rpm</text>`
      : ""
  }
  ${
    peakPower
      ? `<circle cx="${xFor(peakPower.rpm)}" cy="${yFor(peakPower.hp)}" r="8" fill="#ef4444"/>
         <text x="${xFor(peakPower.rpm) + 12}" y="${yFor(peakPower.hp) + 28}" fill="#fecaca" font-size="17" font-weight="900">${peakPs.toFixed(1)} PS / ${peakPower.hp.toFixed(1)} HP @ ${peakPower.rpm.toFixed(0)} rpm</text>`
      : ""
  }

  <rect x="90" y="92" width="16" height="16" rx="4" fill="#ef4444"/>
  <text x="114" y="107" fill="#d4d4d8" font-size="18">Power</text>
  <rect x="205" y="92" width="16" height="16" rx="4" fill="#38bdf8"/>
  <text x="229" y="107" fill="#d4d4d8" font-size="18">Torque</text>
</svg>`;
}

function PerformanceLogChecker() {
  const [torqueNm, setTorqueNm] = useState(430);
  const [rpm, setRpm] = useState(3200);
  const [kwInput, setKwInput] = useState(140);
  const [logFileName, setLogFileName] = useState("");
  const [logInput, setLogInput] = useState(
    "1800, 320\n2200, 390\n2600, 430\n3000, 420\n3400, 395\n3800, 360\n4200, 315"
  );

  const power = calculatePowerFromTorque(torqueNm, rpm);
  const hpFromKw = kwInput * 1.34102;
  const psFromKw = kwInput * 1.35962;

  const logPoints = useMemo(() => parseLogInput(logInput), [logInput]);
  const peakTorque = logPoints.reduce<LogPoint | null>(
    (best, point) => (!best || point.torque > best.torque ? point : best),
    null
  );
  const peakPower = logPoints.reduce<LogPoint | null>(
    (best, point) => (!best || point.hp > best.hp ? point : best),
    null
  );
  const averageTorque =
    logPoints.length > 0
      ? logPoints.reduce((total, point) => total + point.torque, 0) /
        logPoints.length
      : 0;
  const chartMaxHp = Math.max(...logPoints.map((point) => point.hp), 1);

  const handleLogUpload = async (file: File | null) => {
    if (!file) return;

    const text = await file.text();
    setLogFileName(file.name);
    setLogInput(text);
  };

  const downloadDynoReport = () => {
    if (!logPoints.length) return;

    const svg = buildDynoReportSvg({
      fileName: logFileName,
      points: logPoints,
      peakTorque,
      peakPower,
    });
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const baseName =
      logFileName.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]+/gi, "-") ||
      "mg-autotech-dyno-report";

    link.href = url;
    link.download = `${baseName}-dyno-report.svg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <AnimatedSection id="tools" className="overflow-x-hidden bg-[#050505] py-16 md:py-20">
      <div className="mx-auto max-w-7xl overflow-hidden px-4">
        <div className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-sm font-black uppercase tracking-[0.25em] text-red-600">
              Performance Tools
            </div>
            <h2 className="mt-3 max-w-4xl text-4xl font-black md:text-5xl">
              Torque, RPM and log-based power checker for quick workshop checks.
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-400">
              Estimate kW and HP from measured torque and engine speed. Paste
              simple log rows to identify peak torque and peak power points.
            </p>
          </div>

          <Link
            href="/new-request"
            className="inline-flex items-center justify-center rounded-xl border border-red-800/60 bg-red-950/30 px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-red-900/30"
          >
            Create File Request
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>

        <div className="grid min-w-0 gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="min-w-0 overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20 sm:rounded-[2rem] sm:p-6">
            <div className="mb-5 flex min-w-0 items-center gap-3">
              <Gauge className="h-7 w-7 shrink-0 text-red-500" />
              <h3 className="min-w-0 text-2xl font-black leading-tight">Torque Power Calculator</h3>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                label="Torque"
                value={torqueNm}
                suffix="Nm"
                min={50}
                max={1200}
                step={5}
                onChange={setTorqueNm}
              />
              <NumberField
                label="Engine speed"
                value={rpm}
                suffix="RPM"
                min={800}
                max={9000}
                step={50}
                onChange={setRpm}
              />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <MetricPanel label="Estimated power" value={power.hp.toFixed(1)} unit="HP" />
              <MetricPanel label="Estimated power" value={power.kw.toFixed(1)} unit="kW" />
            </div>

            <div className="mt-6 min-w-0 rounded-2xl border border-white/10 bg-black/30 p-4 sm:p-5">
              <div className="mb-4 flex min-w-0 items-center gap-3">
                <Calculator className="h-5 w-5 shrink-0 text-red-500" />
                <h4 className="min-w-0 font-black">kW to HP quick convert</h4>
              </div>

              <NumberField
                label="Power"
                value={kwInput}
                suffix="kW"
                min={1}
                max={1000}
                step={1}
                onChange={setKwInput}
              />

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <MetricPanel label="Mechanical HP" value={hpFromKw.toFixed(1)} unit="HP" />
                <MetricPanel label="Metric power" value={psFromKw.toFixed(1)} unit="PS" />
              </div>
            </div>
          </div>

          <div className="min-w-0 overflow-hidden rounded-[1.5rem] border border-red-900/50 bg-gradient-to-br from-red-950/25 via-white/[0.04] to-black p-4 shadow-2xl shadow-black/30 sm:rounded-[2rem] sm:p-6">
            <div className="mb-5 flex min-w-0 items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-black uppercase tracking-[0.22em] text-red-400">
                  Autotuner Log Checker
                </div>
                <h3 className="mt-2 text-2xl font-black leading-tight">RPM / torque rows</h3>
              </div>
              <BarChart3 className="h-8 w-8 shrink-0 text-red-500" />
            </div>

            <label className="mb-5 flex min-w-0 cursor-pointer flex-col items-start gap-4 overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-4 transition hover:border-red-800/60 hover:bg-red-950/20 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex w-full min-w-0 items-center gap-3 sm:w-auto">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-950/40 text-red-500">
                  <Upload className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-black text-white">
                    Upload Autotuner CSV
                  </div>
                  <div className="mt-1 truncate text-xs font-bold text-zinc-500">
                    {logFileName || "Engine speed + engine torque columns are detected automatically"}
                  </div>
                </div>
              </div>
              <span className="shrink-0 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-zinc-300">
                CSV
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => handleLogUpload(event.target.files?.[0] ?? null)}
                className="sr-only"
              />
            </label>

            <textarea
              value={logInput}
              onChange={(event) => setLogInput(event.target.value)}
              rows={7}
              spellCheck={false}
              className="w-full resize-none rounded-2xl border border-white/10 bg-black/45 p-4 font-mono text-sm font-bold leading-6 text-white outline-none transition placeholder:text-zinc-600 focus:border-red-700"
              placeholder={"RPM, Nm\n2200, 390\n2600, 430"}
            />

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <MetricPanel
                label="Peak torque"
                value={peakTorque ? peakTorque.torque.toFixed(0) : "-"}
                unit={peakTorque ? `Nm @ ${peakTorque.rpm.toFixed(0)} rpm` : "Nm"}
              />
              <MetricPanel
                label="Peak power"
                value={peakPower ? peakPower.hp.toFixed(1) : "-"}
                unit={peakPower ? `HP @ ${peakPower.rpm.toFixed(0)} rpm` : "HP"}
              />
              <MetricPanel
                label="Average torque"
                value={logPoints.length ? averageTorque.toFixed(0) : "-"}
                unit="Nm"
              />
            </div>

            <button
              type="button"
              onClick={downloadDynoReport}
              disabled={!logPoints.length}
              className="mt-5 flex w-full items-center justify-center rounded-xl bg-[#b1121b] px-5 py-4 text-sm font-black text-white shadow-xl shadow-red-950/30 transition hover:bg-[#c91824] disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              <Download className="mr-2 h-4 w-4" />
              Download Dyno Report
            </button>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
                  Power curve preview
                </div>
                <div className="text-xs font-bold text-zinc-500">
                  {logPoints.length} valid rows
                </div>
              </div>

              <div className="min-w-0 space-y-3">
                {logPoints.slice(0, 8).map((point) => (
                  <div
                    key={`${point.rpm}-${point.torque}`}
                    className="grid min-w-0 grid-cols-[48px_minmax(0,1fr)_52px] items-center gap-2 text-xs sm:grid-cols-[74px_minmax(0,1fr)_74px] sm:gap-3"
                  >
                    <div className="font-black text-zinc-400">
                      {point.rpm.toFixed(0)}
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-red-700 to-red-400"
                        style={{
                          width: `${Math.max(6, (point.hp / chartMaxHp) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="text-right font-black text-white">
                      {point.hp.toFixed(0)} HP
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <p className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4 text-xs leading-6 text-zinc-500">
              This tool is an estimate for workshop checks. Real dyno output can
              vary with drivetrain loss, correction method, gear selection and
              logging quality.
            </p>
          </div>
        </div>
      </div>
    </AnimatedSection>
  );
}

function NumberField({
  label,
  value,
  suffix,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  suffix: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block min-w-0">
      <div className="mb-2 flex min-w-0 items-center justify-between gap-3">
        <span className="min-w-0 text-sm font-black text-white">{label}</span>
        <span className="shrink-0 rounded-xl border border-white/10 bg-black/30 px-3 py-1 text-xs font-black text-red-300">
          {value} {suffix}
        </span>
      </div>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-14 w-full rounded-2xl border border-white/10 bg-black/35 px-4 text-sm font-black text-white outline-none transition focus:border-red-700"
      />
    </label>
  );
}

function MetricPanel({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </div>
      <div className="mt-2 flex min-w-0 flex-wrap items-end gap-x-2 gap-y-1">
        <span className="text-3xl font-black leading-none text-white">{value}</span>
        <span className="break-words pb-1 text-xs font-black text-red-300">{unit}</span>
      </div>
    </div>
  );
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
  const [internalCost, setInternalCost] = useState(8);
  const [conversionRate, setConversionRate] = useState(85);

  const paidFiles = Math.round(monthlyFiles * (conversionRate / 100));
  const revenue = paidFiles * averageSalePrice;
  const fileServiceCost = paidFiles * averageCredits * creditCost;
  const operationsCost = paidFiles * internalCost;
  const totalCost = fileServiceCost + operationsCost;
  const grossProfit = revenue - totalCost;
  const profitMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const costPerFile = paidFiles > 0 ? totalCost / paidFiles : 0;
  const profitPerFile = paidFiles > 0 ? grossProfit / paidFiles : 0;

  const applyPreset = (preset: (typeof calculatorPresets)[number]) => {
    setMonthlyFiles(preset.files);
    setAverageSalePrice(preset.salePrice);
    setAverageCredits(preset.credits);
    setCreditCost(preset.creditCost);
    setInternalCost(preset.extraCost);
    setConversionRate(preset.conversion);
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
              Estimate monthly file-service margin before scaling volume.
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-400">
              Model realistic workshop numbers with credit cost, conversion rate
              and internal handling cost. Results are estimates, not financial
              advice.
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
              <h3 className="text-2xl font-black">Workshop Inputs</h3>
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
                label="Monthly file opportunities"
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
              <CalculatorInput
                label="Average credit cost"
                value={creditCost}
                min={3.5}
                max={4.5}
                step={0.1}
                prefix="€"
                onChange={setCreditCost}
              />
              <CalculatorInput
                label="Internal handling cost"
                value={internalCost}
                min={0}
                max={50}
                step={1}
                prefix="€"
                onChange={setInternalCost}
              />
              <CalculatorInput
                label="Conversion to paid jobs"
                value={conversionRate}
                min={40}
                max={100}
                step={5}
                suffix="%"
                onChange={setConversionRate}
              />
            </div>
          </div>

          <div className="rounded-[2rem] border border-red-900/50 bg-gradient-to-br from-red-950/30 via-white/[0.04] to-black p-6 shadow-2xl shadow-black/30">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-black uppercase tracking-[0.22em] text-red-400">
                  Estimated Outcome
                </div>
                <h3 className="mt-2 text-3xl font-black">Monthly partner model</h3>
              </div>
              <TrendingUp className="h-9 w-9 text-emerald-400" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <ResultCard label="Paid jobs" value={`${paidFiles}`} detail={`${monthlyFiles} opportunities at ${conversionRate}%`} />
              <ResultCard label="Revenue" value={formatEuro(revenue)} detail={`${formatEuro(averageSalePrice)} average sale`} />
              <ResultCard label="Service cost" value={formatEuro(fileServiceCost)} detail={`${averageCredits} credits × ${formatEuro(creditCost)}`} />
              <ResultCard label="Total cost" value={formatEuro(totalCost)} detail={`${formatEuro(operationsCost)} internal handling`} />
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-emerald-700/30 bg-emerald-950/20 p-5">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300/80">
                    Gross profit
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

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
                  Cost per delivered file
                </div>
                <div className="mt-2 text-2xl font-black">{formatEuro(costPerFile)}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
                  Break-even jobs
                </div>
                <div className="mt-2 text-2xl font-black">
                  {averageSalePrice > costPerFile ? "1+" : "Review pricing"}
                </div>
              </div>
            </div>

            <p className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4 text-xs leading-6 text-zinc-500">
              This calculator uses simplified gross-margin logic. Taxes, refunds,
              dyno time, local labor and customer-specific pricing should be
              reviewed separately.
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
  const [brands, setBrands] = useState<VehicleOption[]>([]);
  const [models, setModels] = useState<VehicleOption[]>([]);
  const [generations, setGenerations] = useState<VehicleOption[]>([]);
  const [engines, setEngines] = useState<VehicleOption[]>([]);

  const [brandId, setBrandId] = useState("");
  const [modelId, setModelId] = useState("");
  const [generationId, setGenerationId] = useState("");
  const [engineId, setEngineId] = useState("");

  const [vehicle, setVehicle] = useState<PublicVehicleData | null>(null);
  const [loadingVehicle, setLoadingVehicle] = useState(false);

  const selectedBrandName =
    brands.find((item) => item.id === brandId)?.name ?? "";
  const selectedModelName =
    models.find((item) => item.id === modelId)?.name ?? "";
  const selectedGenerationName =
    generations.find((item) => item.id === generationId)?.name ?? "";
  const selectedEngineName =
    engines.find((item) => item.id === engineId)?.name ?? "";

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/vehicles?type=brands", { signal: controller.signal })
      .then((res) => res.json())
      .then(setBrands)
      .catch(ignoreVehicleFetchError);

    return () => controller.abort();
  }, []);

  useEffect(() => {
    setModelId("");
    setGenerationId("");
    setEngineId("");
    setModels([]);
    setGenerations([]);
    setEngines([]);
    setVehicle(null);

    if (!brandId) return;

    const controller = new AbortController();

    fetch(`/api/vehicles?type=models&brandId=${brandId}`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then(setModels)
      .catch(ignoreVehicleFetchError);

    return () => controller.abort();
  }, [brandId]);

  useEffect(() => {
    setGenerationId("");
    setEngineId("");
    setGenerations([]);
    setEngines([]);
    setVehicle(null);

    if (!brandId || !modelId) return;

    const controller = new AbortController();

    fetch(`/api/vehicles?type=generations&brandId=${brandId}&modelId=${modelId}`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then(setGenerations)
      .catch(ignoreVehicleFetchError);

    return () => controller.abort();
  }, [brandId, modelId]);

  useEffect(() => {
    setEngineId("");
    setEngines([]);
    setVehicle(null);

    if (!brandId || !modelId || !generationId) return;

    const controller = new AbortController();

    fetch(
      `/api/vehicles?type=engines&brandId=${brandId}&modelId=${modelId}&generationId=${generationId}`,
      { signal: controller.signal }
    )
      .then((res) => res.json())
      .then(setEngines)
      .catch(ignoreVehicleFetchError);

    return () => controller.abort();
  }, [brandId, modelId, generationId]);

  const handleSearch = async () => {
    if (!brandId || !modelId || !generationId || !engineId) return;

    setLoadingVehicle(true);

    try {
      const res = await fetch(
        `/api/vehicles?type=vehicle&brandId=${brandId}&modelId=${modelId}&generationId=${generationId}&engineId=${engineId}`
      );

      const data = (await res.json()) as PublicVehicleData | null;

      setVehicle(data);
    } catch {
      setVehicle(null);
    } finally {
      setLoadingVehicle(false);
    }
  };

  useEffect(() => {
    if (!brandId || !modelId || !generationId || !engineId) return;

    handleSearch();
  }, [brandId, modelId, generationId, engineId]);

  const requestUrl =
    brandId && modelId && generationId && engineId
      ? `/login?redirect=${encodeURIComponent(
          `/new-request?brandId=${brandId}&modelId=${modelId}&generationId=${generationId}&engineId=${engineId}`
        )}`
      : "/login";

  return (
    <div className="relative border-t border-red-500/20 bg-[#b1121b] py-10">
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_70%_0%,white,transparent_28%)]" />
      <div className="mx-auto max-w-7xl px-4">
        <h2 className="text-2xl font-black md:text-3xl">
          View tuning data and create your file request online.
        </h2>

        <div className="mt-7 grid gap-4 md:grid-cols-5">
          <PublicVehicleSelect
            value={brandId}
            onChange={setBrandId}
            options={brands}
            placeholder="Select Vehicle Brand"
          />

          <PublicVehicleSelect
            value={modelId}
            onChange={setModelId}
            options={models}
            placeholder="Choose Model"
            disabled={!brandId}
          />

          <PublicVehicleSelect
            value={generationId}
            onChange={setGenerationId}
            options={generations}
            placeholder="Select Generation"
            disabled={!modelId}
          />

          <PublicVehicleSelect
            value={engineId}
            onChange={setEngineId}
            options={engines}
            placeholder="Select Engine"
            disabled={!generationId}
          />

          <button
            onClick={handleSearch}
            disabled={!brandId || !modelId || !generationId || !engineId || loadingVehicle}
            className="flex h-14 items-center justify-center rounded-xl bg-white px-4 text-sm font-black text-[#b1121b] transition duration-300 hover:-translate-y-1 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Search className="mr-2 h-4 w-4" />
            {loadingVehicle ? "Checking..." : "Search"}
          </button>
        </div>

        {vehicle && (
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="mt-8 overflow-hidden rounded-[2rem] border border-white/20 bg-black/35 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl"
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
                <PublicStageCard title="Stage 1" data={vehicle.stage1} />
                <PublicStageCard title="Stage 2" data={vehicle.stage2} />
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

export default function HomePage() {
  const [workloadSnapshot, setWorkloadSnapshot] = useState(() =>
    getWorkloadSnapshot(getGermanyNow())
  );
  const [authReady, setAuthReady] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const updateWorkload = () => {
      setWorkloadSnapshot(getWorkloadSnapshot(getGermanyNow()));
    };

    updateWorkload();
    const interval = window.setInterval(updateWorkload, 60_000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let active = true;

    const loadAuthState = async () => {
      const { data } = await supabase.auth.getSession();

      if (!active) return;

      setUserEmail(data.session?.user.email ?? null);
      setAuthReady(true);
    };

    loadAuthState();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user.email ?? null);
      setAuthReady(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
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
          : "Customer requests are monitored during the 06:00-02:00 operation window.",
      icon: Activity,
      tone: workloadSnapshot.support === "Offline" ? "red" : "emerald",
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
            <a href="#services" className="hover:text-white">
              Services
            </a>
            <a href="#brands" className="hover:text-white">
              Brands
            </a>
            <a href="#prices" className="hover:text-white">
              Prices
            </a>
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
              className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-red-800/50 bg-[#111] shadow-lg shadow-red-950/40 sm:h-12 sm:w-12"
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
            <a href="#workflow" className="hover:text-white">
              How It Works
            </a>
            <a href="#services" className="hover:text-white">
              Services
            </a>
            <a href="#brands" className="hover:text-white">
              Brands
            </a>
            <a href="#prices" className="hover:text-white">
              Credit Prices
            </a>
            <a href="#security" className="hover:text-white">
              Security
            </a>
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
          className="absolute right-[-140px] top-14 -z-10 hidden h-[520px] w-[900px] rounded-full border-[32px] border-red-800/50 opacity-70 lg:block"
        />
        <div className="absolute right-[-20px] top-36 -z-10 hidden h-[280px] w-[650px] rounded-[4rem] bg-[linear-gradient(135deg,#111,#050505)] opacity-80 shadow-2xl shadow-black lg:block" />
        <motion.div
          animate={{ opacity: [0.55, 1, 0.55], width: ["420px", "540px", "420px"] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute right-20 top-52 -z-10 hidden h-3 rounded-full bg-red-700 blur-sm lg:block"
        />
        <motion.div
          animate={{ opacity: [0.55, 1, 0.55] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute right-32 top-52 -z-10 hidden h-1 w-[480px] rounded-full bg-red-500 lg:block"
        />

        <div className="mx-auto grid min-h-[720px] max-w-7xl gap-12 px-4 py-14 sm:py-20 lg:h-[825px] lg:grid-cols-[1.05fr_.95fr] lg:items-center">
          <motion.div
            className="min-w-0 lg:min-h-[520px]"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-red-800/50 bg-red-950/25 px-4 py-2 text-sm font-semibold text-red-100">
              <BadgeCheck className="h-4 w-4 text-red-500" />
              Professional online file service platform
            </div>

            <h1 className="max-w-full break-words text-[clamp(2.65rem,12vw,4.6rem)] font-black uppercase leading-[1.05] tracking-[0.04em] md:text-7xl md:tracking-[0.08em]">
              Custom ECU & TCU{" "}
              <span className="block text-red-600">Tuning Files</span>
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
              Upload original ECU/TCU files, select your service, track your
              order and download the completed file directly through the secure
              MG AutoTech customer portal.
            </p>

            <div className="mt-9 flex flex-wrap gap-4">
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
                    className="rounded-xl bg-[#b1121b] px-10 py-4 font-black text-white shadow-xl shadow-red-950/40 transition duration-300 hover:-translate-y-1 hover:bg-[#c91824]"
                  >
                    My Account
                  </Link>

                  <Link
                    href="/new-request"
                    className="rounded-xl border border-red-800/50 px-10 py-4 font-black text-white transition duration-300 hover:-translate-y-1 hover:bg-red-950/25"
                  >
                    New Request
                  </Link>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="rounded-xl border border-white/10 bg-white/10 px-10 py-4 font-black text-white transition duration-300 hover:-translate-y-1 hover:bg-white/15"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="rounded-xl border border-white/10 bg-white/10 px-10 py-4 font-black text-white transition duration-300 hover:-translate-y-1 hover:bg-white/15"
                  >
                    Login
                  </Link>

                  <Link
                    href="/register"
                    className="rounded-xl bg-[#b1121b] px-10 py-4 font-black text-white shadow-xl shadow-red-950/40 transition duration-300 hover:-translate-y-1 hover:bg-[#c91824]"
                  >
                    Register
                  </Link>

                  <Link
                    href="/new-request"
                    className="rounded-xl border border-red-800/50 px-10 py-4 font-black text-white transition duration-300 hover:-translate-y-1 hover:bg-red-950/25"
                  >
                    Upload File
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

      <AnimatedSection className="bg-[#0b1226] py-12">
        <div className="mx-auto max-w-7xl px-4">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20">
            <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div>
                <div
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] ${
                    workloadSnapshot.support === "Offline"
                      ? "border-red-500/30 bg-red-500/10 text-red-300"
                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full shadow-lg ${
                      workloadSnapshot.support === "Offline"
                        ? "bg-red-400 shadow-red-400/40"
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

      <WorkshopCommandDesk />

      <PerformanceLogChecker />

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
                className="group rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition duration-300 hover:-translate-y-1 hover:border-red-800/60 hover:bg-white/[0.07]"
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

      <AnimatedSection className="bg-[#eef1f4] py-20 text-[#111827]">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-sm font-black uppercase tracking-[0.25em] text-red-700">
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
                  className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl shadow-black/5 transition duration-300 hover:-translate-y-1 hover:shadow-2xl"
                >
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-700">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-black">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-zinc-600">
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

      <AnimatedSection id="services" className="bg-[#eef1f4] py-20 text-[#111827]">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-12">
            <div className="text-sm font-black uppercase tracking-[0.25em] text-red-700">
              Our Services
            </div>
            <h2 className="mt-3 max-w-3xl text-4xl font-black md:text-5xl">
              Professional ECU and TCU software solutions.
            </h2>
          </div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.18 }}
            className="grid gap-5 md:grid-cols-3"
          >
            {services.map((service) => (
              <motion.div
                variants={fadeUp}
                key={service.title}
                className="rounded-3xl bg-white p-6 shadow-xl shadow-black/5 transition duration-300 hover:-translate-y-2 hover:shadow-2xl"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-700">
                  <FileCode2 />
                </div>
                <h3 className="text-xl font-black">{service.title}</h3>
                <p className="mt-3 text-sm leading-6 text-zinc-600">
                  {service.text}
                </p>
                <div className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-black text-red-700">
                  {service.credits}
                </div>
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

          <div className="grid gap-5 md:grid-cols-4">
            {creditPackages.map((pack) => (
              <div
                key={pack.credits}
                className={`relative rounded-3xl border p-7 transition duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-red-950/30 ${
                  pack.popular
                    ? "border-red-700 bg-white/[0.08]"
                    : "border-white/10 bg-white/[0.04]"
                }`}
              >
                {pack.popular && (
                  <div className="absolute right-5 top-5 rounded-full bg-[#b1121b] px-3 py-1 text-xs font-black">
                    Popular
                  </div>
                )}
                <div className="text-sm text-zinc-400">
                  {pack.credits} Credits
                </div>
                <div className="mt-4 text-sm font-bold text-zinc-500 line-through">
                  {formatEuro(pack.basePrice)}
                </div>
                <div className="mt-1 text-4xl font-black">
                  {formatEuro(pack.price)}
                </div>
                <div className="mt-3 text-sm text-zinc-400">
                  {formatEuro(pack.each)} / Credit
                </div>
                <Link
                  href="/dashboard/credits"
                  className="mt-7 block rounded-xl border border-red-800/70 px-5 py-3 text-center font-black text-white transition duration-300 hover:bg-red-950/30"
                >
                  Buy
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
    </main>
  );
}
