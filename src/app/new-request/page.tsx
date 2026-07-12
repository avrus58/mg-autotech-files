"use client";

import Link from "next/link";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signOutIfEmailUnverified } from "@/lib/authGuards";
import {
  getRequestFlowStepStates,
  isAdvancedRequestServiceCategory,
} from "@/lib/requestFlow";
import { supabase } from "@/lib/supabaseClient";
import { fetchVehicleOptions, preloadVehicleBrands } from "@/lib/vehicleControl/clientCatalog";
import {
  Activity,
  ArrowLeft,
  BadgeCheck,
  Car,
  CarFront,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Cpu,
  Database,
  FileCode2,
  Gauge,
  Home,
  Loader2,
  ShieldCheck,
  Upload,
  Wrench,
  Zap,
} from "lucide-react";

type Option = {
  id: string;
  name: string;
  fuelType?: string | null;
};

type VehicleData = {
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
  imageUrl?: string;
};

type MainService = {
  id: string;
  title: string;
  credits: number;
  description: string;
};

type ExtraService = {
  id: string;
  title: string;
  credits: number;
  description?: string;
};

type ExtraServiceCategory = {
  id: string;
  title: string;
  description: string;
  services: ExtraService[];
};

type CustomerProfile = {
  id: string;
  email: string | null;
  customer_id: string | null;
  credit_balance: number | string | null;
  allow_negative_credits: boolean | null;
  negative_credit_limit: number | string | null;
  account_status: string | null;
};

const maxRequestFileSize = 32 * 1024 * 1024;
const allowedRequestFileExtensions = [".bin", ".ori", ".mod", ".frf", ".hex", ".zip", ".sgo"];

const mainServices: MainService[] = [
  {
    id: "only_options",
    title: "Only Options",
    credits: 0,
    description: "Only selected software options without stage tuning.",
  },
  {
    id: "stage_1",
    title: "Stage 1",
    credits: 10,
    description: "Safe performance optimization for stock vehicles.",
  },
  {
    id: "stage_2",
    title: "Stage 2",
    credits: 15,
    description: "For vehicles with hardware modifications.",
  },
  {
    id: "stage_3",
    title: "Stage 3",
    credits: 30,
    description: "For heavily modified setups, manual review recommended.",
  },
  {
    id: "eco_tuning",
    title: "ECO Tuning",
    credits: 8,
    description: "Fuel economy optimization with smooth drivability.",
  },
  {
    id: "tcu_tuning",
    title: "TCU Tuning",
    credits: 10,
    description: "Gearbox software optimization and torque limiter adjustment.",
  },
  {
    id: "original_file",
    title: "Original File",
    credits: 4,
    description: "Original / stock file request.",
  },
];

const extraServiceCategories: ExtraServiceCategory[] = [
  {
    id: "emissions",
    title: "Emission / Aftertreatment Solutions",
    description: "DPF, EGR, AdBlue, OPF/GPF, NOx and related emission system solutions.",
    services: [
      { id: "dpf_off", title: "DPF Removal", credits: 6, description: "Diesel particulate filter software solution." },
      { id: "egr_off", title: "EGR / AGR Removal", credits: 6, description: "EGR valve software solution." },
      { id: "adblue_off", title: "AdBlue / SCR Removal", credits: 11, description: "SCR / AdBlue system software solution." },
      { id: "dpf_egr_off", title: "DPF + EGR Removal", credits: 9 },
      { id: "dpf_adblue_off", title: "DPF + AdBlue Removal", credits: 14 },
      { id: "egr_adblue_off", title: "EGR + AdBlue Removal", credits: 11 },
      { id: "dpf_egr_adblue_off", title: "DPF + EGR + AdBlue Removal", credits: 15 },
      { id: "opf_gpf_off", title: "GPF / OPF Removal", credits: 12 },
      { id: "nox_off", title: "NOx Removal", credits: 4 },
      { id: "lambda_o2_off", title: "Lambda / O2 Removal", credits: 5 },
      { id: "lambda_o2_gpf_off", title: "Lambda / O2 + GPF / OPF Removal", credits: 12 },
      { id: "decat", title: "Decat / CAT Removal", credits: 6 },
      { id: "additive_off", title: "Additive Removal", credits: 6 },
    ],
  },
  {
    id: "performance",
    title: "Performance & Driving Features",
    description: "Performance features, speed limiter, launch control and driving behavior options.",
    services: [
      { id: "vmax_off", title: "Speed Limit Removal / VMAX OFF", credits: 5 },
      { id: "limited_vmax", title: "Limited VMAX to Specific Speed", credits: 6 },
      { id: "launch_control", title: "Launch Control", credits: 10 },
      { id: "hardcut_diesel", title: "Hard Cut Limiter (Diesel)", credits: 8 },
      { id: "pops_bangs", title: "Pop and Bangs", credits: 8 },
      { id: "pops_bangs_sport", title: "Pop and Bangs Sport Button", credits: 9 },
      { id: "pops_bangs_ac", title: "Pop and Bangs AC Button", credits: 9 },
      { id: "upshift_farts", title: "Upshift Farts", credits: 8 },
      { id: "performance_gauge", title: "Performance Gauge BMW / Mini / VAG", credits: 4 },
      { id: "map_switch", title: "Map Switch", credits: 60 },
      { id: "multi_map", title: "Multi Map Setup", credits: 12 },
      { id: "burble_map", title: "Burble Map", credits: 8 },
      { id: "flex_fuel", title: "Flex Fuel / Ethanol Setup", credits: 10 },
    ],
  },
  {
    id: "engine_functions",
    title: "Engine Function Solutions",
    description: "Engine behavior, cold start, flap systems, sensors and special function solutions.",
    services: [
      { id: "start_stop", title: "Start / Stop Removal", credits: 5 },
      { id: "cold_start", title: "Cold Start Removal", credits: 4 },
      { id: "hot_start_fix", title: "Hot Start Fix", credits: 8 },
      { id: "swirl_flaps", title: "Swirl Flaps Removal", credits: 5 },
      { id: "exhaust_flaps", title: "Exhaust Flaps Removal", credits: 4 },
      { id: "tva_off", title: "TVA Removal", credits: 5 },
      { id: "cylinder_on_demand", title: "Cylinder On Demand Removal", credits: 4 },
      { id: "maf_off", title: "MAF Removal", credits: 4 },
      { id: "map_sensor_calibration", title: "Map Sensor Calibration", credits: 5 },
      { id: "coolant_thermostat", title: "Coolant Temperature Control / Thermostat", credits: 6 },
      { id: "water_pump", title: "Water Pump Removal", credits: 5 },
    ],
  },
  {
    id: "diagnostics",
    title: "Diagnostics & File Services",
    description: "File checking, DTC solutions, checksum and technical verification.",
    services: [
      { id: "dtc_off", title: "DTC Removal", credits: 4 },
      { id: "file_check", title: "File Check", credits: 2 },
      { id: "checksum", title: "Checksum Correction", credits: 2 },
      { id: "file_expertise", title: "File Expertise", credits: 17 },
      { id: "readout_verification", title: "Readout Verification", credits: 2 },
      { id: "software_version_check", title: "Software Version Check", credits: 2 },
      { id: "ecu_recovery", title: "ECU Recovery Support", credits: 10 },
      { id: "original_backup_check", title: "Original Backup Check", credits: 4 },
    ],
  },
  {
    id: "support_addons",
    title: "Professional Support Add-ons",
    description: "Priority handling, log review and technical support add-ons for complex jobs.",
    services: [
      { id: "priority_processing", title: "Priority Processing", credits: 5 },
      { id: "same_day_processing", title: "Same Day Processing", credits: 10 },
      { id: "log_file_review", title: "Log File Review", credits: 5 },
      { id: "dyno_report_review", title: "Dyno Report Review", credits: 5 },
      { id: "smoke_limiter", title: "Smoke Limiter Optimization", credits: 6 },
      { id: "torque_monitoring", title: "Torque Monitoring", credits: 6 },
      { id: "gearbox_torque_limit", title: "Gearbox Torque Limit Adjustment", credits: 8 },
      { id: "remote_support", title: "Remote Support Session", credits: 8 },
      { id: "special_request", title: "Special Request / Other", credits: 0 },
    ],
  },
];

const extraServices = extraServiceCategories.flatMap((category) => category.services);

const primaryExtraServiceCategories = extraServiceCategories.filter(
  (category) => !isAdvancedRequestServiceCategory(category.id)
);
const advancedExtraServiceCategories = extraServiceCategories.filter((category) =>
  isAdvancedRequestServiceCategory(category.id)
);

function SelectBox({
  label,
  value,
  onChange,
  options,
  required = false,
  disabled = false,
  loading = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  required?: boolean;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
        {required && <span className="text-red-600">*</span>} {label}
      </div>

      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className="h-12 w-full appearance-none rounded-xl border border-white/10 bg-black/35 px-4 text-sm font-bold text-white outline-none transition focus:border-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">{loading ? "Loading vehicles..." : "Select"}</option>
          {options.map((option) => (
            <option key={option.id} value={option.id} className="bg-[#111]">
              {option.name}
            </option>
          ))}
        </select>

        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
      </div>
    </label>
  );
}

function InputBox({
  label,
  value,
  onChange,
  placeholder,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
        {required && <span className="text-red-600">*</span>} {label}
      </div>

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-xl border border-white/10 bg-black/35 px-4 text-sm font-bold text-white outline-none transition placeholder:text-zinc-600 focus:border-red-700"
      />
    </label>
  );
}

function AnimatedBar({
  label,
  stock,
  tuned,
  unit,
}: {
  label: string;
  stock: number;
  tuned: number;
  unit: string;
}) {
  const max = Math.max(stock, tuned, 1);
  const stockPercent = Math.min((stock / max) * 100, 100);
  const tunedPercent = Math.min((tuned / max) * 100, 100);

  return (
    <div className="space-y-3">
      <div className="flex justify-between gap-4 text-sm">
        <span className="font-bold text-zinc-400">{label}</span>
        <span className="text-right font-black text-white">
          {stock} → <span className="text-red-400">{tuned}</span> {unit}
        </span>
      </div>

      <div className="space-y-2">
        <div className="h-3 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-zinc-500 transition-all duration-700"
            style={{ width: `${stockPercent}%` }}
          />
        </div>

        <div className="h-4 overflow-hidden rounded-full bg-red-950/50 shadow-inner shadow-red-950">
          <div
            className="h-full rounded-full bg-gradient-to-r from-red-900 via-red-700 to-red-500 transition-all duration-1000"
            style={{ width: `${tunedPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function PowerBox({
  title,
  data,
}: {
  title: string;
  data?: VehicleData["stage1"];
}) {
  if (!data) return null;

  return (
    <div className="group relative overflow-hidden rounded-[1.7rem] border border-red-900/40 bg-gradient-to-br from-black/85 via-[#140507] to-black p-6 shadow-2xl shadow-black/40 transition duration-300 hover:-translate-y-1 hover:border-red-700/70">
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-red-700/20 blur-3xl transition group-hover:bg-red-600/30" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />

      <div className="relative mb-6 flex items-center justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.2em] text-red-400">
            Performance Map
          </div>
          <div className="mt-1 text-2xl font-black text-white">{title}</div>
        </div>

        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-800/50 bg-red-950/40 shadow-lg shadow-red-950/30">
          <Zap className="h-6 w-6 text-red-500" />
        </div>
      </div>

      <div className="relative space-y-4">
        <AnimatedBar
          label="Power"
          stock={data.stockHp}
          tuned={data.tunedHp}
          unit="HP"
        />

        <AnimatedBar
          label="Torque"
          stock={data.stockNm}
          tuned={data.tunedNm}
          unit="Nm"
        />

        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="rounded-2xl border border-red-900/50 bg-red-950/25 p-4 text-center">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
              HP Gain
            </div>
            <div className="mt-1 text-3xl font-black text-red-400">
              +{data.gainHp}
            </div>
          </div>

          <div className="rounded-2xl border border-red-900/50 bg-red-950/25 p-4 text-center">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
              Nm Gain
            </div>
            <div className="mt-1 text-3xl font-black text-red-400">
              +{data.gainNm}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoChip({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-xs font-bold text-zinc-200 shadow-lg shadow-black/20">
      <span className="text-red-500">{icon}</span>
      {label}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="group rounded-2xl border border-white/10 bg-black/40 p-4 transition hover:-translate-y-0.5 hover:border-red-800/60">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-red-900/40 bg-red-950/25 text-red-500">
        {icon}
      </div>
      <div className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </div>
      <div className="mt-3 break-words text-lg font-black">{value}</div>
    </div>
  );
}

function ServiceCategoryPanel({
  category,
  selectedExtras,
  openServiceCategories,
  toggleServiceCategory,
  toggleExtra,
}: {
  category: ExtraServiceCategory;
  selectedExtras: string[];
  openServiceCategories: string[];
  toggleServiceCategory: (id: string) => void;
  toggleExtra: (id: string) => void;
}) {
  const selectedCount = category.services.filter((service) =>
    selectedExtras.includes(service.id)
  ).length;
  const open = openServiceCategories.includes(category.id);

  return (
    <div
      className={`overflow-hidden rounded-[1.25rem] border bg-black/25 transition ${
        selectedCount > 0 ? "border-red-800/50" : "border-white/10"
      }`}
    >
      <button
        type="button"
        onClick={() => toggleServiceCategory(category.id)}
        className="flex w-full items-center justify-between gap-4 p-4 text-left transition hover:bg-white/[0.04]"
        aria-expanded={open}
      >
        <span className="min-w-0">
          <span className="block text-base font-black text-white">
            {category.title}
          </span>
          <span className="mt-1 block text-xs leading-5 text-zinc-500">
            {category.description}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-3">
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-black text-zinc-300">
            {selectedCount} selected
          </span>
          <ChevronDown
            className={`h-5 w-5 text-zinc-400 transition ${
              open ? "rotate-180" : ""
            }`}
          />
        </span>
      </button>

      {open && (
        <div className="grid gap-3 border-t border-white/10 p-4 md:grid-cols-2 xl:grid-cols-3">
          {category.services.map((service) => {
            const active = selectedExtras.includes(service.id);

            return (
              <button
                key={service.id}
                onClick={() => toggleExtra(service.id)}
                className={`group flex items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm font-bold transition hover:-translate-y-0.5 ${
                  active
                    ? "border-red-700 bg-red-950/35 text-white shadow-lg shadow-red-950/20"
                    : "border-white/10 bg-black/30 text-zinc-400 hover:border-red-800/60 hover:text-white"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
                    active
                      ? "border-red-500 bg-red-600"
                      : "border-zinc-600 group-hover:border-red-700"
                  }`}
                >
                  {active && <CheckCircle2 className="h-4 w-4" />}
                </span>

                <span className="min-w-0">
                  <span className="block">{service.title}</span>
                  {service.description && (
                    <span className="mt-1 block text-xs font-medium leading-5 text-zinc-500">
                      {service.description}
                    </span>
                  )}
                  <span className="mt-2 inline-flex rounded-full bg-cyan-500/90 px-2 py-0.5 text-xs font-black text-white">
                    {service.credits} Credit{service.credits === 1 ? "" : "s"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}


function VehicleHeroCard({
  brand,
  model,
  generation,
  engine,
}: {
  brand: string;
  model: string;
  generation: string;
  engine: string;
}) {
  const gradients: Record<string, string> = {
    BMW: "from-sky-950/40 via-black to-blue-950/30",
    Audi: "from-red-950/45 via-black to-zinc-950",
    "Mercedes-Benz": "from-zinc-700/35 via-black to-zinc-950",
    Volkswagen: "from-blue-950/40 via-black to-zinc-950",
    Porsche: "from-yellow-900/25 via-black to-red-950/25",
    Mini: "from-emerald-950/25 via-black to-zinc-950",
    Opel: "from-yellow-950/25 via-black to-zinc-950",
    Peugeot: "from-blue-950/25 via-black to-zinc-950",
    Renault: "from-yellow-950/20 via-black to-red-950/20",
    Volvo: "from-sky-950/25 via-black to-zinc-950",
    Toyota: "from-red-950/25 via-black to-zinc-950",
  };

  const gradient =
    gradients[brand] || "from-red-950/30 via-black to-zinc-950";

  return (
    <div
      className={`relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br ${gradient} p-7 shadow-2xl shadow-black/50`}
    >
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-red-600/10 blur-3xl" />
      <div className="absolute -left-20 bottom-0 h-52 w-52 rounded-full bg-white/5 blur-3xl" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/70 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-black/80 to-transparent" />

      <div className="relative grid gap-7 lg:grid-cols-[1fr_220px] lg:items-center">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-red-800/50 bg-red-950/30 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-red-100">
            <Zap className="h-4 w-4 text-red-500" />
            MG AutoTech Vehicle Intelligence
          </div>

          <h2 className="text-4xl font-black leading-tight md:text-5xl">
            {brand} <span className="text-red-500">{model}</span>
          </h2>

          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-zinc-200">
              {generation || "Generation not specified"}
            </span>

            <span className="rounded-full border border-red-800/40 bg-red-950/30 px-3 py-1.5 text-xs font-bold text-red-100">
              {engine}
            </span>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/35 p-4 backdrop-blur-xl">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                Platform
              </div>
              <div className="mt-2 text-lg font-black">ECU Tuning</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/35 p-4 backdrop-blur-xl">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                Workflow
              </div>
              <div className="mt-2 text-lg font-black">File Service</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/35 p-4 backdrop-blur-xl">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                Methods
              </div>
              <div className="mt-2 text-lg font-black">OBD · Bench · Boot</div>
            </div>
          </div>
        </div>

        <div className="hidden lg:flex lg:justify-end">
          <div className="relative flex h-52 w-52 items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-red-600/10 blur-3xl" />
            <div className="absolute h-44 w-44 rounded-full border border-red-800/20" />
            <div className="absolute h-32 w-32 rounded-full border border-white/10" />

            <div className="relative flex h-40 w-40 items-center justify-center rounded-[2rem] border border-white/10 bg-black/45 shadow-2xl shadow-black/40 backdrop-blur-xl">
              <CarFront className="h-24 w-24 text-white/90" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


export default function NewRequestPage() {
  const router = useRouter();

  const [brands, setBrands] = useState<Option[]>([]);
  const [models, setModels] = useState<Option[]>([]);
  const [generations, setGenerations] = useState<Option[]>([]);
  const [engines, setEngines] = useState<Option[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(true);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingGenerations, setLoadingGenerations] = useState(false);
  const [loadingEngines, setLoadingEngines] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleData | null>(
    null
  );

  const [vehicleBrandId, setVehicleBrandId] = useState("");
  const [vehicleModelId, setVehicleModelId] = useState("");
  const [vehicleGenerationId, setVehicleGenerationId] = useState("");
  const [vehicleEngineId, setVehicleEngineId] = useState("");
  const [useManualVehicleDetails, setUseManualVehicleDetails] = useState(false);
  const [manualVehicleBrand, setManualVehicleBrand] = useState("");
  const [manualVehicleModel, setManualVehicleModel] = useState("");
  const [manualVehicleGeneration, setManualVehicleGeneration] = useState("");
  const [manualVehicleEngine, setManualVehicleEngine] = useState("");

  const [ecu, setEcu] = useState("");
  const [gearbox, setGearbox] = useState("");
  const [year, setYear] = useState("");
  const [readMethod, setReadMethod] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [hwSw, setHwSw] = useState("");
  const [mainService, setMainService] = useState("stage_1");
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [openServiceCategories, setOpenServiceCategories] = useState<string[]>([
    "emissions",
  ]);
  const [masterSlave, setMasterSlave] = useState<"master" | "slave">("master");
  const [notes, setNotes] = useState("");
  const [fileName, setFileName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [paymentAccepted, setPaymentAccepted] = useState(false);
  const [responsibilityAccepted, setResponsibilityAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const selectedBrandName =
    brands.find((item) => item.id === vehicleBrandId)?.name ?? "";
  const selectedModelName =
    models.find((item) => item.id === vehicleModelId)?.name ?? "";
  const selectedGenerationName =
    generations.find((item) => item.id === vehicleGenerationId)?.name ?? "";
  const selectedEngineName =
    engines.find((item) => item.id === vehicleEngineId)?.name ?? "";
  const requestVehicleBrand = useManualVehicleDetails
    ? manualVehicleBrand.trim()
    : selectedBrandName;
  const requestVehicleModel = useManualVehicleDetails
    ? manualVehicleModel.trim()
    : selectedModelName;
  const requestVehicleGeneration = useManualVehicleDetails
    ? manualVehicleGeneration.trim()
    : selectedGenerationName;
  const requestVehicleEngine = useManualVehicleDetails
    ? manualVehicleEngine.trim()
    : selectedEngineName;

  async function loadCustomerProfile() {
    setProfileLoading(true);

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      router.push("/login");
      return;
    }

    if (await signOutIfEmailUnverified(userData.user)) {
      router.push("/login?verify_email=1");
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, email, customer_id, credit_balance, allow_negative_credits, negative_credit_limit, account_status"
      )
      .eq("id", userData.user.id)
      .single();

    if (error) {
      setMessage(error.message);
      setProfileLoading(false);
      return;
    }

    setCustomerProfile(data as CustomerProfile);
    setProfileLoading(false);
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => { void loadCustomerProfile(); }, 0);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    preloadVehicleBrands();
    fetchVehicleOptions("/api/vehicles?type=brands", controller.signal)
      .then((options) => {
        setBrands(options);
        if (options.length === 0) {
          setUseManualVehicleDetails(true);
        }
      })
      .catch(() => {
        setUseManualVehicleDetails(true);
        setMessage("Vehicle catalog could not be loaded. You can still submit the request with manual vehicle details.");
      })
      .finally(() => setLoadingBrands(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setVehicleModelId("");
      setVehicleGenerationId("");
      setVehicleEngineId("");
      setModels([]);
      setGenerations([]);
      setEngines([]);
      setSelectedVehicle(null);

      if (!vehicleBrandId) {
        setLoadingModels(false);
        return;
      }

      setLoadingModels(true);
      fetchVehicleOptions(`/api/vehicles?type=models&brandId=${vehicleBrandId}`)
        .then(setModels)
        .catch(() => setMessage("Vehicle models could not be loaded. Please try again."))
        .finally(() => setLoadingModels(false));
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [vehicleBrandId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setVehicleGenerationId("");
      setVehicleEngineId("");
      setGenerations([]);
      setEngines([]);
      setSelectedVehicle(null);

      if (!vehicleBrandId || !vehicleModelId) {
        setLoadingGenerations(false);
        return;
      }

      setLoadingGenerations(true);
      fetchVehicleOptions(
        `/api/vehicles?type=generations&brandId=${vehicleBrandId}&modelId=${vehicleModelId}`
      )
        .then(setGenerations)
        .catch(() => setMessage("Vehicle generations could not be loaded. Please try again."))
        .finally(() => setLoadingGenerations(false));
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [vehicleBrandId, vehicleModelId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setVehicleEngineId("");
      setEngines([]);
      setSelectedVehicle(null);

      if (!vehicleBrandId || !vehicleModelId || !vehicleGenerationId) {
        setLoadingEngines(false);
        return;
      }

      setLoadingEngines(true);
      fetchVehicleOptions(
        `/api/vehicles?type=engines&brandId=${vehicleBrandId}&modelId=${vehicleModelId}&generationId=${vehicleGenerationId}`
      )
        .then(setEngines)
        .catch(() => setMessage("Vehicle engines could not be loaded. Please try again."))
        .finally(() => setLoadingEngines(false));
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [vehicleBrandId, vehicleModelId, vehicleGenerationId]);

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      setSelectedVehicle(null);

      if (useManualVehicleDetails) {
        return;
      }

      if (
        !vehicleBrandId ||
        !vehicleModelId ||
        !vehicleGenerationId ||
        !vehicleEngineId
      ) {
        return;
      }

      fetch(
        `/api/vehicles?type=vehicle&brandId=${vehicleBrandId}&modelId=${vehicleModelId}&generationId=${vehicleGenerationId}&engineId=${vehicleEngineId}`
      )
        .then((res) => res.json())
        .then((vehicle: VehicleData | null) => {
          if (cancelled) {
            return;
          }

          setSelectedVehicle(vehicle);

          if (vehicle?.ecu?.length) {
            setEcu(vehicle.ecu.join(", "));
          }

          if (vehicle?.readMethods?.length) {
            setReadMethod(vehicle.readMethods[0]);
          }
        })
        .catch((error) => {
          if (!cancelled) {
            console.error(error);
          }
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [useManualVehicleDetails, vehicleBrandId, vehicleModelId, vehicleGenerationId, vehicleEngineId]);

  const selectedMainService = mainServices.find(
    (service) => service.id === mainService
  );

  const totalCredits = useMemo(() => {
    const mainCredits = selectedMainService?.credits ?? 0;

    const extrasCredits = selectedExtras.reduce((sum, id) => {
      const service = extraServices.find((item) => item.id === id);
      return sum + (service?.credits ?? 0);
    }, 0);

    return mainCredits + extrasCredits;
  }, [selectedExtras, selectedMainService]);

  const creditBalance = Number(customerProfile?.credit_balance ?? 0);
  const negativeCreditLimit = Number(customerProfile?.negative_credit_limit ?? 0);
  const allowNegativeCredits = Boolean(customerProfile?.allow_negative_credits);
  const accountStatus = customerProfile?.account_status ?? "active";
  const availableCredits = allowNegativeCredits
    ? creditBalance + Math.max(negativeCreditLimit, 0)
    : creditBalance;
  const balanceAfterRequest = creditBalance - totalCredits;
  const canCreateByCredits = totalCredits <= availableCredits;
  const accountBlocked = accountStatus !== "active";

  const serviceSummary = useMemo(() => {
    const main = selectedMainService?.title ?? "Service";
    const extras = selectedExtras
      .map((id) => extraServices.find((item) => item.id === id)?.title)
      .filter(Boolean);

    return [main, ...extras].join(" + ");
  }, [selectedExtras, selectedMainService]);

  const selectedAdvancedExtraCount = advancedExtraServiceCategories.reduce(
    (sum, category) =>
      sum + category.services.filter((service) => selectedExtras.includes(service.id)).length,
    0
  );

  const requestStepStates = getRequestFlowStepStates({
    hasVehicle: Boolean(requestVehicleBrand && requestVehicleModel && requestVehicleEngine),
    hasService: Boolean(selectedMainService),
    hasUpload: Boolean(selectedFile),
    hasNotes: Boolean(notes.trim()),
    hasPaymentAcceptance: paymentAccepted,
    hasFinalAcceptance: responsibilityAccepted,
  });

  const switchToCatalogVehicleDetails = () => {
    setUseManualVehicleDetails(false);
  };

  const switchToManualVehicleDetails = () => {
    setUseManualVehicleDetails(true);
    setSelectedVehicle(null);
    if (selectedVehicle) {
      setEcu("");
      setReadMethod("");
    }
  };

  const toggleExtra = (id: string) => {
    setSelectedExtras((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  };

  const toggleServiceCategory = (id: string) => {
    setOpenServiceCategories((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  };

  async function getLatestCustomerProfile(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, email, customer_id, credit_balance, allow_negative_credits, negative_credit_limit, account_status"
      )
      .eq("id", userId)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data as CustomerProfile;
  }

  function validateCreditAccess(profile: CustomerProfile, requiredCredits: number) {
    const status = profile.account_status ?? "active";

    if (status !== "active") {
      return `Your account is currently ${status}. Please contact MG AutoTech support.`;
    }

    const balance = Number(profile.credit_balance ?? 0);
    const negativeLimit = Number(profile.negative_credit_limit ?? 0);
    const negativeEnabled = Boolean(profile.allow_negative_credits);
    const available = negativeEnabled ? balance + Math.max(negativeLimit, 0) : balance;

    if (requiredCredits > available) {
      if (negativeEnabled) {
        return `Not enough credits. Balance: ${balance}, negative limit: ${negativeLimit}, available total: ${available}, required: ${requiredCredits}.`;
      }

      return `Not enough credits. Balance: ${balance}, required: ${requiredCredits}.`;
    }

    return null;
  }

  const handleSubmit = async () => {
    setMessage("");

    if (!requestVehicleBrand || !requestVehicleModel || !requestVehicleEngine) {
      setMessage(
        useManualVehicleDetails
          ? "Please fill in manual brand, model and engine."
          : "Please fill in brand, model and engine."
      );
      return;
    }

    if (!selectedFile) {
      setMessage("Please upload your original ECU / TCU file.");
      return;
    }

    if (selectedFile.size > maxRequestFileSize) {
      setMessage("The original file must be 32 MB or smaller.");
      return;
    }

    const selectedFileName = selectedFile.name.toLowerCase();
    if (!allowedRequestFileExtensions.some((extension) => selectedFileName.endsWith(extension))) {
      setMessage("Unsupported file type. Please upload .bin, .ori, .mod, .frf, .hex, .zip or .sgo.");
      return;
    }

    if (!paymentAccepted || !responsibilityAccepted) {
      setMessage("Please accept payment and responsibility confirmation.");
      return;
    }

    setSubmitting(true);

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      router.push("/login");
      return;
    }

    if (await signOutIfEmailUnverified(userData.user)) {
      router.push("/login?verify_email=1");
      return;
    }

    const customerEmail = userData.user.email ?? "";

    let latestProfile: CustomerProfile;

    try {
      latestProfile = await getLatestCustomerProfile(userData.user.id);
    } catch (error) {
      setSubmitting(false);
      setMessage(
        error instanceof Error
          ? error.message
          : "Customer profile could not be loaded."
      );
      return;
    }

    const creditValidationError = validateCreditAccess(latestProfile, totalCredits);

    if (creditValidationError) {
      setSubmitting(false);
      setCustomerProfile(latestProfile);
      setMessage(creditValidationError);
      return;
    }

    let originalFilePath: string | null = null;

    if (selectedFile) {
      const safeFileName = selectedFile.name
        .replaceAll(" ", "_")
        .replace(/[^a-zA-Z0-9._-]/g, "");

      const filePath = `${userData.user.id}/${Date.now()}-${safeFileName}`;

      const { error: uploadError } = await supabase.storage
        .from("customer-files")
        .upload(filePath, selectedFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        setSubmitting(false);
        setMessage(uploadError.message);
        return;
      }

      originalFilePath = filePath;
    }

    const { data: createdOrderId, error } = await supabase.rpc(
      "create_order_with_credit_deduction",
      {
        p_customer_email: customerEmail,
        p_vehicle_brand: requestVehicleBrand,
        p_vehicle_model: requestVehicleModel,
        p_vehicle_generation: requestVehicleGeneration,
        p_vehicle_engine: requestVehicleEngine,
        p_service_type: serviceSummary,
        p_credits_required: totalCredits,
        p_notes: notes || "-",
        p_ecu: ecu || null,
        p_gearbox: gearbox || null,
        p_vehicle_year: year || null,
        p_read_method: readMethod || null,
        p_license_plate: licensePlate || null,
        p_hw_sw: hwSw || null,
        p_master_slave: masterSlave,
        p_uploaded_file_name: fileName || null,
        p_original_file_path: originalFilePath,
      }
    );

    setSubmitting(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setCustomerProfile((current) =>
      current
        ? {
            ...current,
            credit_balance: Number(current.credit_balance ?? 0) - totalCredits,
          }
        : current
    );

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      await fetch("/api/email/new-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(sessionData.session?.access_token
            ? { Authorization: `Bearer ${sessionData.session.access_token}` }
            : {}),
        },
        body: JSON.stringify({
          orderId: String(createdOrderId || ""),
        }),
      });
    } catch {
      // Email notification failure must not block the customer request.
    }

    router.push("/dashboard");
  };

  return (
    <main className="mg-compact-ui min-h-screen bg-[#050505] text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_20%_0%,rgba(160,18,28,0.24),transparent_32%),linear-gradient(135deg,#050505,#0d0d0f_48%,#160608)]" />

      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-red-800/50 bg-[#111] shadow-lg shadow-red-950/40">
              <div className="absolute -top-2 h-5 w-10 rounded-t-full border-t-2 border-red-700" />
              <Upload className="h-7 w-7 text-red-600" />
            </div>

            <div>
              <div className="text-xl font-black tracking-wide">
                MG <span className="text-red-600">AUTOTECH</span>
              </div>
              <div className="text-xs text-zinc-400">New File Request</div>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
            >
              <ArrowLeft className="mr-2 inline h-4 w-4" />
              Dashboard
            </Link>

            <Link
              href="/"
              className="hidden rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10 md:inline-block"
            >
              <Home className="mr-2 inline h-4 w-4" />
              Home
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-7">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-red-800/50 bg-red-950/25 px-4 py-2 text-sm font-semibold text-red-100">
              <BadgeCheck className="h-4 w-4 text-red-500" />
              Professional ECU / TCU request form
            </div>

            <h1 className="text-4xl font-black md:text-5xl">
              Create New
              <span className="block text-red-600">File Service Request</span>
            </h1>

            <p className="mt-5 max-w-3xl leading-8 text-zinc-400">
              Select vehicle information, choose the required software solution,
              upload your original file and submit the request to MG AutoTech.
            </p>
          </div>

          <div className="rounded-[2rem] border border-red-900/40 bg-red-950/20 p-7">
            <CreditCard className="mb-5 h-9 w-9 text-red-500" />
            <div className="text-sm text-zinc-400">Estimated Total</div>
            <div className="mt-2 text-5xl font-black">{totalCredits}</div>
            <div className="mt-1 text-sm font-bold text-red-300">Credits</div>

            <div className="mt-5 rounded-2xl bg-black/30 p-4 text-sm leading-6 text-zinc-300">
              {serviceSummary || "Select service"}
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
          <div className="mg-step-rail">
            {requestStepStates.map((step, index) => (
              <div
                key={step.id}
                className={`rounded-xl border px-3 py-2 ${
                  step.completed
                    ? "border-emerald-700/35 bg-emerald-950/20 text-emerald-200"
                    : step.active
                      ? "border-red-700/50 bg-red-950/25 text-white"
                      : "border-white/10 bg-black/25 text-zinc-500"
                }`}
              >
                <div className="text-[10px] font-black uppercase tracking-[0.16em] opacity-70">
                  Step {index + 1}
                </div>
                <div className="mt-1 flex items-center gap-2 text-sm font-black">
                  {step.completed ? <CheckCircle2 className="h-4 w-4" /> : null}
                  {step.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-8">
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
              <div className="mb-6 flex items-center gap-3">
                <Car className="h-6 w-6 text-red-600" />
                <h2 className="text-2xl font-black">Vehicle Information</h2>
              </div>

              <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/25 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-black text-white">
                    {useManualVehicleDetails
                      ? "Manual vehicle details"
                      : "Vehicle catalog"}
                  </div>
                  <div className="mt-1 text-xs font-bold text-zinc-500">
                    {useManualVehicleDetails
                      ? "Customer-provided, unverified catalog match."
                      : "Catalog selection keeps vehicle intelligence available when matched."}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:w-auto">
                  <button
                    type="button"
                    onClick={switchToCatalogVehicleDetails}
                    disabled={loadingBrands || brands.length === 0}
                    aria-pressed={!useManualVehicleDetails}
                    className={`rounded-xl border px-3 py-2 text-xs font-black uppercase tracking-[0.12em] transition disabled:cursor-not-allowed disabled:opacity-40 ${
                      !useManualVehicleDetails
                        ? "border-red-700 bg-red-950/35 text-white"
                        : "border-white/10 bg-white/[0.04] text-zinc-400 hover:text-white"
                    }`}
                  >
                    Catalog
                  </button>
                  <button
                    type="button"
                    onClick={switchToManualVehicleDetails}
                    aria-pressed={useManualVehicleDetails}
                    className={`rounded-xl border px-3 py-2 text-xs font-black uppercase tracking-[0.12em] transition ${
                      useManualVehicleDetails
                        ? "border-red-700 bg-red-950/35 text-white"
                        : "border-white/10 bg-white/[0.04] text-zinc-400 hover:text-white"
                    }`}
                  >
                    Manual
                  </button>
                </div>
              </div>

              {useManualVehicleDetails ? (
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  <InputBox
                    label="Manual Brand"
                    value={manualVehicleBrand}
                    onChange={setManualVehicleBrand}
                    placeholder="e.g. BMW"
                    required
                  />

                  <InputBox
                    label="Manual Model"
                    value={manualVehicleModel}
                    onChange={setManualVehicleModel}
                    placeholder="e.g. 320d"
                    required
                  />

                  <InputBox
                    label="Manual Generation / Variant"
                    value={manualVehicleGeneration}
                    onChange={setManualVehicleGeneration}
                    placeholder="Optional"
                  />

                  <InputBox
                    label="Manual Engine"
                    value={manualVehicleEngine}
                    onChange={setManualVehicleEngine}
                    placeholder="e.g. 2.0 diesel"
                    required
                  />

                  <InputBox
                    label="Year"
                    value={year}
                    onChange={setYear}
                    placeholder="e.g. 2016"
                  />

                  <InputBox
                    label="License Plate"
                    value={licensePlate}
                    onChange={setLicensePlate}
                    placeholder="Optional"
                  />
                </div>
              ) : (
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  <SelectBox
                    label="Brand"
                    value={vehicleBrandId}
                    onChange={setVehicleBrandId}
                    required
                    options={brands}
                    loading={loadingBrands}
                    disabled={loadingBrands && brands.length === 0}
                  />

                  <SelectBox
                    label="Model"
                    value={vehicleModelId}
                    onChange={setVehicleModelId}
                    required
                    options={models}
                    loading={loadingModels}
                    disabled={!vehicleBrandId || loadingModels}
                  />

                  <SelectBox
                    label="Generation"
                    value={vehicleGenerationId}
                    onChange={setVehicleGenerationId}
                    options={generations}
                    loading={loadingGenerations}
                    disabled={!vehicleModelId || loadingGenerations}
                  />

                  <SelectBox
                    label="Engine"
                    value={vehicleEngineId}
                    onChange={setVehicleEngineId}
                    required
                    options={engines}
                    loading={loadingEngines}
                    disabled={!vehicleGenerationId || loadingEngines}
                  />

                  <InputBox
                    label="Year"
                    value={year}
                    onChange={setYear}
                    placeholder="e.g. 2016"
                  />

                  <InputBox
                    label="License Plate"
                    value={licensePlate}
                    onChange={setLicensePlate}
                    placeholder="Optional"
                  />
                </div>
              )}
            </section>

            {!useManualVehicleDetails && selectedVehicle && (
              <section className="relative overflow-hidden rounded-[2rem] border border-red-900/50 bg-gradient-to-br from-red-950/20 via-white/[0.04] to-black p-5 shadow-2xl shadow-black/40">
                <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-red-700/20 blur-3xl" />
                <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-red-950/30 blur-3xl" />
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/60 to-transparent" />

                <div className="relative mb-6">
                  <VehicleHeroCard
                    brand={selectedBrandName}
                    model={selectedModelName}
                    generation={selectedGenerationName}
                    engine={selectedEngineName}
                  />
                </div>

                <div className="relative mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-red-800/50 bg-red-950/30 px-3 py-1.5 text-xs font-bold text-red-100">
                      <Activity className="h-4 w-4 text-red-500" />
                      Live Vehicle Intelligence
                    </div>

                    <h2 className="text-3xl font-black md:text-4xl">
                      {selectedBrandName} {selectedModelName}
                    </h2>

                    <p className="mt-2 text-sm font-bold text-zinc-400">
                      {selectedGenerationName || "Generation not specified"} ·{" "}
                      {selectedEngineName}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {selectedVehicle.ecu?.map((item) => (
                      <InfoChip
                        key={item}
                        icon={<Cpu className="h-4 w-4" />}
                        label={item}
                      />
                    ))}

                    {selectedVehicle.readMethods?.map((item) => (
                      <InfoChip
                        key={item}
                        icon={<Database className="h-4 w-4" />}
                        label={item}
                      />
                    ))}
                  </div>
                </div>

                <div className="relative mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <StatCard
                    label="ECU / TCU"
                    icon={<Cpu className="h-5 w-5" />}
                    value={
                      selectedVehicle.ecu?.length
                        ? selectedVehicle.ecu.join(", ")
                        : "Not available"
                    }
                  />

                  <StatCard
                    label="Fuel Type"
                    icon={<Gauge className="h-5 w-5" />}
                    value={selectedVehicle.fuelType || "Not available"}
                  />

                  <StatCard
                    label="Read Method"
                    icon={<Database className="h-5 w-5" />}
                    value={
                      selectedVehicle.readMethods?.length
                        ? selectedVehicle.readMethods.join(", ")
                        : "Not available"
                    }
                  />

                  <StatCard
                    label="Services"
                    icon={<Wrench className="h-5 w-5" />}
                    value={
                      selectedVehicle.services?.length
                        ? `${selectedVehicle.services.length} supported`
                        : "Not available"
                    }
                  />
                </div>

                <div className="relative grid gap-4 lg:grid-cols-2">
                  <PowerBox title="Stage 1" data={selectedVehicle.stage1} />
                  <PowerBox title="Stage 2" data={selectedVehicle.stage2} />
                </div>

                {selectedVehicle.services?.length ? (
                  <div className="relative mt-6">
                    <div className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
                      Supported Software Options
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {selectedVehicle.services.map((service) => (
                        <span
                          key={service}
                          className="rounded-full border border-red-800/50 bg-red-950/30 px-3 py-1.5 text-xs font-bold text-red-100"
                        >
                          {service}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </section>
            )}

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
              <div className="mb-6 flex items-center gap-3">
                <Gauge className="h-6 w-6 text-red-600" />
                <h2 className="text-2xl font-black">ECU / Read Information</h2>
              </div>

              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                <InputBox
                  label="ECU / TCU"
                  value={ecu}
                  onChange={setEcu}
                  placeholder="e.g. Bosch EDC17C46"
                />

                <SelectBox
                  label="Gearbox"
                  value={gearbox}
                  onChange={setGearbox}
                  options={[
                    { id: "Manual", name: "Manual" },
                    { id: "Automatic", name: "Automatic" },
                    { id: "DSG", name: "DSG" },
                    { id: "ZF 8HP", name: "ZF 8HP" },
                    { id: "Mercedes 7G", name: "Mercedes 7G" },
                    { id: "Mercedes 9G", name: "Mercedes 9G" },
                    { id: "Other", name: "Other" },
                  ]}
                />

                <InputBox
                  label="HW / SW Number"
                  value={hwSw}
                  onChange={setHwSw}
                  placeholder="Optional"
                />

                <SelectBox
                  label="Read Method"
                  value={readMethod}
                  onChange={setReadMethod}
                  options={[
                    { id: "OBD", name: "OBD" },
                    { id: "Bench", name: "Bench" },
                    { id: "Boot", name: "Boot" },
                    { id: "Virtual Read", name: "Virtual Read" },
                    { id: "Other", name: "Other" },
                  ]}
                />
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
              <div className="mb-6 flex items-center gap-3">
                <FileCode2 className="h-6 w-6 text-red-600" />
                <h2 className="text-2xl font-black">Main Service</h2>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                {mainServices.map((service) => (
                  <button
                    key={service.id}
                    onClick={() => setMainService(service.id)}
                    className={`rounded-2xl border p-5 text-left transition hover:-translate-y-1 ${
                      mainService === service.id
                        ? "border-red-700 bg-red-950/35"
                        : "border-white/10 bg-black/30 hover:border-red-800/60"
                    }`}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="font-black">{service.title}</span>
                      {mainService === service.id && (
                        <CheckCircle2 className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                    <div className="text-sm font-black text-red-400">
                      {service.credits} Credits
                    </div>
                    <p className="mt-3 text-xs leading-5 text-zinc-500">
                      {service.description}
                    </p>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
              <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="mb-3 flex items-center gap-3">
                    <Wrench className="h-6 w-6 text-red-600" />
                    <h2 className="text-2xl font-black">Professional Service Catalog</h2>
                  </div>
                  <p className="max-w-3xl text-sm leading-6 text-zinc-500">
                    Select every required software solution for this file. Services are grouped by workflow so complex ECU / TCU requests stay clear and professional.
                  </p>
                </div>

                <div className="rounded-2xl border border-red-900/40 bg-red-950/25 px-4 py-3 text-sm font-black text-red-300">
                  {selectedExtras.length} selected
                </div>
              </div>

              <div className="space-y-4">
                {primaryExtraServiceCategories.map((category) => (
                  <ServiceCategoryPanel
                    key={category.id}
                    category={category}
                    selectedExtras={selectedExtras}
                    openServiceCategories={openServiceCategories}
                    toggleServiceCategory={toggleServiceCategory}
                    toggleExtra={toggleExtra}
                  />
                ))}

                <details className="rounded-[1.25rem] border border-white/10 bg-black/25 p-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                    <span>
                      <span className="block text-base font-black">Advanced services</span>
                      <span className="mt-1 block text-xs leading-5 text-zinc-500">
                        Performance add-ons, special functions and support options stay available without overwhelming standard requests.
                      </span>
                    </span>
                    <span className="rounded-full border border-red-800/40 bg-red-950/25 px-3 py-1 text-xs font-black text-red-200">
                      {selectedAdvancedExtraCount} selected
                    </span>
                  </summary>
                  <div className="mt-4 space-y-4">
                    {advancedExtraServiceCategories.map((category) => (
                      <ServiceCategoryPanel
                        key={category.id}
                        category={category}
                        selectedExtras={selectedExtras}
                        openServiceCategories={openServiceCategories}
                        toggleServiceCategory={toggleServiceCategory}
                        toggleExtra={toggleExtra}
                      />
                    ))}
                  </div>
                </details>
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
              <div className="mb-6 flex items-center gap-3">
                <Upload className="h-6 w-6 text-red-600" />
                <h2 className="text-2xl font-black">Your File</h2>
              </div>

              <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-white/20 bg-black/30 p-8 text-center transition hover:border-red-700 hover:bg-red-950/20">
                <Upload className="mb-4 h-10 w-10 text-red-600" />
                <div className="font-black">
                  {fileName || "Drag and drop a file here or click"}
                </div>
                <p className="mt-2 text-sm text-zinc-500">
                  Supported later: .bin, .ori, .zip, .frf, .sgo, diagnostic
                  reports and screenshots.
                </p>

                <input
                  type="file"
                  accept=".bin,.ori,.mod,.frf,.hex,.zip,.sgo"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    if (file && file.size > maxRequestFileSize) {
                      setMessage("The original file must be 32 MB or smaller.");
                      event.currentTarget.value = "";
                      setSelectedFile(null);
                      setFileName("");
                      return;
                    }
                    if (
                      file &&
                      !allowedRequestFileExtensions.some((extension) =>
                        file.name.toLowerCase().endsWith(extension)
                      )
                    ) {
                      setMessage("Unsupported file type. Please upload .bin, .ori, .mod, .frf, .hex, .zip or .sgo.");
                      event.currentTarget.value = "";
                      setSelectedFile(null);
                      setFileName("");
                      return;
                    }
                    setMessage("");
                    setSelectedFile(file);
                    setFileName(file?.name ?? "");
                  }}
                />
              </label>

              <div className="mt-5">
                <div className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
                  If you have a note / DTC code
                </div>

                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={6}
                  placeholder="Example: Please clear code P0420. Customer wants Stage 1 + EGR OFF..."
                  className="w-full rounded-2xl border border-white/10 bg-black/35 p-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-red-700"
                />
              </div>

              <div className="mt-5 flex gap-2">
                <button
                  onClick={() => setMasterSlave("master")}
                  className={`rounded-xl px-5 py-3 text-sm font-black ${
                    masterSlave === "master"
                      ? "bg-[#b1121b] text-white"
                      : "bg-white/10 text-zinc-400"
                  }`}
                >
                  Master File
                </button>

                <button
                  onClick={() => setMasterSlave("slave")}
                  className={`rounded-xl px-5 py-3 text-sm font-black ${
                    masterSlave === "slave"
                      ? "bg-[#b1121b] text-white"
                      : "bg-white/10 text-zinc-400"
                  }`}
                >
                  Slave File
                </button>
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <div className="sticky top-28 rounded-[2rem] border border-white/10 bg-black/55 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
              <ShieldCheck className="mb-5 h-9 w-9 text-red-500" />
              <h3 className="text-2xl font-black">Request Summary</h3>

              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm">
                <div className="mb-3 flex items-center justify-between gap-4">
                  <span className="text-zinc-400">Credit Balance</span>
                  <span className="font-black text-white">
                    {profileLoading ? "Loading..." : `${creditBalance} Credits`}
                  </span>
                </div>

                <div className="mb-3 flex items-center justify-between gap-4">
                  <span className="text-zinc-400">Negative Credit</span>
                  <span
                    className={`font-black ${
                      allowNegativeCredits ? "text-emerald-300" : "text-zinc-500"
                    }`}
                  >
                    {allowNegativeCredits
                      ? `Allowed up to -${negativeCreditLimit}`
                      : "Disabled"}
                  </span>
                </div>

                <div className="mb-3 flex items-center justify-between gap-4">
                  <span className="text-zinc-400">Available</span>
                  <span className="font-black text-red-300">
                    {availableCredits} Credits
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-zinc-400">After Request</span>
                  <span
                    className={`font-black ${
                      balanceAfterRequest < 0 ? "text-yellow-300" : "text-emerald-300"
                    }`}
                  >
                    {balanceAfterRequest} Credits
                  </span>
                </div>

                {accountBlocked ? (
                  <div className="mt-4 rounded-xl border border-red-800/50 bg-red-950/30 p-3 text-xs font-bold text-red-200">
                    Account status: {accountStatus}. New requests are disabled.
                  </div>
                ) : !canCreateByCredits ? (
                  <div className="mt-4 rounded-xl border border-yellow-700/50 bg-yellow-950/25 p-3 text-xs font-bold text-yellow-200">
                    Not enough available credits for this request.
                  </div>
                ) : null}
              </div>

              <div className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between gap-4 rounded-2xl bg-white/[0.04] p-4">
                  <span className="text-zinc-400">Vehicle</span>
                  <span className="text-right font-bold">
                    {requestVehicleBrand || "-"} {requestVehicleModel || ""}
                    {useManualVehicleDetails ? (
                      <span className="mt-1 block text-[11px] font-black uppercase tracking-[0.12em] text-yellow-300">
                        Customer-provided
                      </span>
                    ) : null}
                  </span>
                </div>

                <div className="flex justify-between gap-4 rounded-2xl bg-white/[0.04] p-4">
                  <span className="text-zinc-400">Engine</span>
                  <span className="text-right font-bold">
                    {requestVehicleEngine || "-"}
                  </span>
                </div>

                <div className="flex justify-between gap-4 rounded-2xl bg-white/[0.04] p-4">
                  <span className="text-zinc-400">Service</span>
                  <span className="text-right font-bold">
                    {selectedMainService?.title}
                  </span>
                </div>

                <div className="flex justify-between gap-4 rounded-2xl bg-white/[0.04] p-4">
                  <span className="text-zinc-400">Extra Options</span>
                  <span className="text-right font-bold">
                    {selectedExtras.length}
                  </span>
                </div>

                <div className="flex justify-between gap-4 rounded-2xl border border-red-900/40 bg-red-950/25 p-4">
                  <span className="text-zinc-400">Total</span>
                  <span className="text-right text-xl font-black text-red-400">
                    {totalCredits} Credits
                  </span>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <label className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={paymentAccepted}
                    onChange={(event) =>
                      setPaymentAccepted(event.target.checked)
                    }
                    className="mt-1"
                  />
                  <span>I accept that the required credits will be used.</span>
                </label>

                <label className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={responsibilityAccepted}
                    onChange={(event) =>
                      setResponsibilityAccepted(event.target.checked)
                    }
                    className="mt-1"
                  />
                  <span>
                    I confirm that I am responsible for legal use of the file.
                  </span>
                </label>
              </div>

              {message && (
                <div className="mt-5 rounded-2xl border border-red-800/50 bg-red-950/30 p-4 text-sm text-red-200">
                  {message}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={submitting || profileLoading || accountBlocked || !canCreateByCredits}
                className="mt-6 flex w-full items-center justify-center rounded-xl bg-[#b1121b] px-6 py-4 font-black text-white shadow-xl shadow-red-950/40 transition hover:bg-[#c91824] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Creating Request...
                  </>
                ) : profileLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Loading Credits...
                  </>
                ) : accountBlocked ? (
                  <>
                    <ShieldCheck className="mr-2 h-5 w-5" />
                    Account Disabled
                  </>
                ) : !canCreateByCredits ? (
                  <>
                    <CreditCard className="mr-2 h-5 w-5" />
                    Not Enough Credits
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-5 w-5" />
                    Create Request
                  </>
                )}
              </button>

              <p className="mt-4 text-center text-xs leading-5 text-zinc-500">
                Your original file will be uploaded privately and connected to
                this order.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
