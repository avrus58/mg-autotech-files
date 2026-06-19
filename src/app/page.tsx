"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
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
  Lock,
  LogIn,
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
} from "lucide-react";
import { Footer } from "@/components/Footer";
import { OnlineStatus } from "@/components/OnlineStatus";

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

const creditPackages = [
  { credits: "10", price: "€45", each: "€4.50 / Credit" },
  { credits: "50", price: "€225", each: "€4.50 / Credit" },
  { credits: "100", price: "€400", each: "€4.00 / Credit", popular: true },
  { credits: "250", price: "€875", each: "€3.50 / Credit" },
];

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
    fetch("/api/vehicles?type=brands")
      .then((res) => res.json())
      .then(setBrands)
      .catch(console.error);
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

    fetch(`/api/vehicles?type=models&brandId=${brandId}`)
      .then((res) => res.json())
      .then(setModels)
      .catch(console.error);
  }, [brandId]);

  useEffect(() => {
    setGenerationId("");
    setEngineId("");
    setGenerations([]);
    setEngines([]);
    setVehicle(null);

    if (!brandId || !modelId) return;

    fetch(`/api/vehicles?type=generations&brandId=${brandId}&modelId=${modelId}`)
      .then((res) => res.json())
      .then(setGenerations)
      .catch(console.error);
  }, [brandId, modelId]);

  useEffect(() => {
    setEngineId("");
    setEngines([]);
    setVehicle(null);

    if (!brandId || !modelId || !generationId) return;

    fetch(
      `/api/vehicles?type=engines&brandId=${brandId}&modelId=${modelId}&generationId=${generationId}`
    )
      .then((res) => res.json())
      .then(setEngines)
      .catch(console.error);
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
    } catch (error) {
      console.error(error);
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
  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <FloatingTechBackground />

      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2 text-xs text-zinc-300">
          <div className="hidden items-center gap-3 md:flex">
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
            <Link href="/login" className="hover:text-white">
              Login
            </Link>
          </div>
        </div>

        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5">
          <Link href="/" className="flex items-center gap-3">
            <motion.div
              whileHover={{ scale: 1.05, rotate: -1 }}
              className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-red-800/50 bg-[#111] shadow-lg shadow-red-950/40"
            >
              <div className="absolute -top-2 h-5 w-10 rounded-t-full border-t-2 border-red-700" />
              <Cpu className="h-7 w-7 text-red-600" />
            </motion.div>

            <div>
              <div className="text-xl font-black tracking-wide">
                MG <span className="text-red-600">AUTOTECH</span>
              </div>
              <div className="text-xs text-zinc-400">
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
              className="rounded-xl bg-[#b1121b] px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40 transition duration-300 hover:-translate-y-0.5 hover:bg-[#c91824]"
            >
              Register
            </Link>
          </div>
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

        <div className="mx-auto grid h-[825px] max-w-7xl gap-12 px-4 py-20 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
          <motion.div
            className="lg:min-h-[520px]"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-red-800/50 bg-red-950/25 px-4 py-2 text-sm font-semibold text-red-100">
              <BadgeCheck className="h-4 w-4 text-red-500" />
              Professional online file service platform
            </div>

            <h1 className="max-w-4xl text-5xl font-black uppercase leading-[1.05] tracking-[0.08em] md:text-7xl">
              Custom ECU & TCU
              <span className="block text-red-600">Tuning Files</span>
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
              Upload original ECU/TCU files, select your service, track your
              order and download the completed file directly through the secure
              MG AutoTech customer portal.
            </p>

            <div className="mt-9 flex flex-wrap gap-4">
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
            </div>
          </motion.div>

          <HeroShowcase />
        </div>

        <PublicVehicleChecker />
      </section>

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
              href="/register"
              className="inline-flex items-center justify-center rounded-xl bg-[#b1121b] px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-950/20 transition hover:-translate-y-0.5 hover:bg-[#c91824]"
            >
              Create Account
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
                <div className="mt-4 text-4xl font-black">{pack.price}</div>
                <div className="mt-3 text-sm text-zinc-400">{pack.each}</div>
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
              Register, login and create your first MG AutoTech file request.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
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
