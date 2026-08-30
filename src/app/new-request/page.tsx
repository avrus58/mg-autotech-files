"use client";

import Link from "next/link";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authenticatedFetch, getStableSession, notifySessionRequired, signOutIfEmailUnverified } from "@/lib/authGuards";
import {
  getRequestFlowStepStates,
  isAdvancedRequestServiceCategory,
} from "@/lib/requestFlow";
import { supabase } from "@/lib/supabaseClient";
import { fetchVehicleOptions, preloadVehicleBrands } from "@/lib/vehicleControl/clientCatalog";
import {
  Activity,
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
  RefreshCcw,
  ShieldCheck,
  Upload,
  Wrench,
  Zap,
} from "lucide-react";
import { CustomerPortalPageHeader } from "@/components/dashboard/CustomerPortalPageHeader";
import { evaluateRequestIntelligence } from "@/lib/requestIntelligence";
import {
  flushPendingVerifiedConversions,
  isApprovedAnalyticsHost,
  isValidGoogleAdsId,
  isValidGoogleAnalyticsMeasurementId,
  measurementConsentChangedEvent,
  readMeasurementConsentSnapshot,
  replacePrivateMeasurementDocument,
  replaceWithPendingMeasurementCompletion,
  trackRequestSubmitted,
} from "@/lib/publicAnalytics";
import { createRequestCompletionConsentHandoff } from "@/lib/requestCompletionConsent";
import {
  createGrowthRequestStartDeliveryController,
  recordGrowthRequestCreated,
  updateGrowthReminderPreference,
} from "@/lib/growth/client";
import {
  buildRepeatRequestPrefill,
  isRepeatRequestId,
  type RepeatRequestOrder,
  type RepeatRequestPrefill,
} from "@/lib/repeatRequest";
import {
  getRequestIntentSelection,
  parseRequestIntent,
} from "@/lib/requestIntent";
import {
  customerWorkflowExactT,
  customerWorkflowT,
  type CustomerWorkflowTranslationKey,
} from "@/lib/i18n/customer-workflow-request-translations";
import { intlLocaleByCode, type LocaleCode } from "@/lib/i18nConfig";
import { useActiveLocale } from "@/lib/useActiveLocale";

type Option = {
  id: string;
  name: string;
  fuelType?: string | null;
};

const accountStateKeys: Record<string, CustomerWorkflowTranslationKey> = {
  active: "accountStateActive",
  suspended: "accountStateSuspended",
  blocked: "accountStateBlocked",
  disabled: "accountStateDisabled",
};

function localizeAccountState(locale: LocaleCode, value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return customerWorkflowT(
    locale,
    accountStateKeys[normalized] ?? "accountStateRestricted"
  );
}

function localizeServiceLabel(locale: LocaleCode, value: string) {
  if (locale === "en" && value === "Map Sensor Calibration") {
    return "MAP Sensor Calibration";
  }

  return customerWorkflowExactT(locale, value);
}

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
const requestCompletionConsentFailOpenMs = 15_000;

function requestCompletionConsentIsAvailable(hostname: string) {
  return isApprovedAnalyticsHost(hostname) && (
    isValidGoogleAnalyticsMeasurementId(
      process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID,
    ) || isValidGoogleAdsId(process.env.NEXT_PUBLIC_GOOGLE_ADS_ID)
  );
}

function CreditShortfallPanel({
  className = "",
  requiredCredits,
  availableCredits,
  refreshing,
  feedback,
  onRefresh,
}: {
  className?: string;
  requiredCredits: number;
  availableCredits: number;
  refreshing: boolean;
  feedback: string;
  onRefresh: () => void;
}) {
  const locale = useActiveLocale();
  return (
    <div
      role="alert"
      className={`rounded-xl border border-yellow-700/50 bg-yellow-950/25 p-3 text-xs text-yellow-100 ${className}`}
    >
      <p className="font-black">Not enough available credits for this request.</p>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 leading-5 text-yellow-100/75">
        <span><span>Credits</span>: {requiredCredits.toLocaleString(intlLocaleByCode[locale])}</span>
        <span><span>Available Credits</span>: {availableCredits.toLocaleString(intlLocaleByCode[locale])}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href="/dashboard/credits"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Buy Credits"
          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#b1121b] px-3 font-black text-white transition hover:bg-[#c91824]"
        >
          <CreditCard className="mr-2 h-4 w-4" />
          Buy Credits
        </Link>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-yellow-600/35 bg-black/30 px-3 font-black text-yellow-100 transition hover:bg-black/50 disabled:cursor-wait disabled:opacity-60"
        >
          <RefreshCcw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Loading..." : "Refresh"}
        </button>
      </div>
      {feedback ? (
        <p role="status" aria-live="polite" className="mt-2 font-bold text-yellow-100/80">
          {feedback}
        </p>
      ) : null}
    </div>
  );
}

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
    id: "tcu_stage_1",
    title: "TCU Stage 1",
    credits: 15,
    description: "Gearbox software optimization for standard transmission setups.",
  },
  {
    id: "tcu_stage_2",
    title: "TCU Stage 2",
    credits: 20,
    description: "Advanced gearbox calibration for performance-focused setups.",
  },
  {
    id: "tcu_stage_3",
    title: "TCU Stage 3",
    credits: 30,
    description: "Custom gearbox calibration for heavily modified setups.",
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
  protectOptions = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  required?: boolean;
  disabled?: boolean;
  loading?: boolean;
  protectOptions?: boolean;
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
            <option
              key={option.id}
              value={option.id}
              className="bg-[#111]"
              translate={protectOptions ? "no" : undefined}
              data-no-translate={protectOptions ? true : undefined}
            >
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
      <span translate="no" data-no-translate>{label}</span>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  rawValue = false,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  rawValue?: boolean;
}) {
  return (
    <div className="group rounded-2xl border border-white/10 bg-black/40 p-4 transition hover:-translate-y-0.5 hover:border-red-800/60">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-red-900/40 bg-red-950/25 text-red-500">
        {icon}
      </div>
      <div className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </div>
      <div
        className="mt-3 break-words text-lg font-black"
        translate={rawValue ? "no" : undefined}
        data-no-translate={rawValue ? true : undefined}
      >
        {value}
      </div>
    </div>
  );
}

function ServiceCategoryPanel({
  category,
  locale,
  selectedExtras,
  openServiceCategories,
  toggleServiceCategory,
  toggleExtra,
}: {
  category: ExtraServiceCategory;
  locale: LocaleCode;
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
            {customerWorkflowT(locale, "selectedCount", {
              count: selectedCount.toLocaleString(intlLocaleByCode[locale]),
            })}
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
                  <span className="block">
                    {localizeServiceLabel(locale, service.title)}
                  </span>
                  {service.description && (
                    <span className="mt-1 block text-xs font-medium leading-5 text-zinc-500">
                      {service.description}
                    </span>
                  )}
                  <span className="mt-2 inline-flex rounded-full bg-cyan-500/90 px-2 py-0.5 text-xs font-black text-white">
                    {customerWorkflowT(locale, "creditsCount", {
                      count: service.credits.toLocaleString(intlLocaleByCode[locale]),
                    })}
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
            <span translate="no" data-no-translate>{brand}</span>{" "}
            <span className="text-red-500" translate="no" data-no-translate>{model}</span>
          </h2>

          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-zinc-200">
              {generation ? <span translate="no" data-no-translate>{generation}</span> : "Generation not specified"}
            </span>

            <span className="rounded-full border border-red-800/40 bg-red-950/30 px-3 py-1.5 text-xs font-bold text-red-100">
              <span translate="no" data-no-translate>{engine}</span>
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


const webRequestSubmissionStoragePrefix = "mg:web-request-submission:v1:";
const webRequestSubmissionMaxAgeMs = 24 * 60 * 60 * 1000;

type WebRequestSubmission = {
  signature: string;
  fingerprint: string;
  idempotencyKey: string;
  filePath: string;
  createdAt: number;
};

async function sha256Hex(value: BufferSource) {
  const digest = await window.crypto.subtle.digest("SHA-256", value);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fingerprintWebRequest(value: string) {
  return sha256Hex(new TextEncoder().encode(value));
}

function readPersistedWebRequest(userId: string, fingerprint: string): WebRequestSubmission | null {
  try {
    const raw = window.sessionStorage.getItem(`${webRequestSubmissionStoragePrefix}${userId}`);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<WebRequestSubmission>;
    if (
      value.fingerprint !== fingerprint ||
      typeof value.idempotencyKey !== "string" ||
      !/^[A-Za-z0-9._-]{12,96}$/.test(value.idempotencyKey) ||
      typeof value.filePath !== "string" ||
      typeof value.createdAt !== "number" ||
      !Number.isFinite(value.createdAt) ||
      Date.now() - value.createdAt > webRequestSubmissionMaxAgeMs ||
      (value.filePath !== "" && !value.filePath.startsWith(`${userId}/${value.idempotencyKey}/`))
    ) {
      window.sessionStorage.removeItem(`${webRequestSubmissionStoragePrefix}${userId}`);
      return null;
    }
    return {
      signature: "",
      fingerprint,
      idempotencyKey: value.idempotencyKey,
      filePath: value.filePath,
      createdAt: value.createdAt,
    };
  } catch {
    return null;
  }
}

function persistWebRequest(userId: string, submission: WebRequestSubmission) {
  try {
    // Persist only a digest and opaque identifiers; request notes and customer
    // data never enter browser storage.
    window.sessionStorage.setItem(
      `${webRequestSubmissionStoragePrefix}${userId}`,
      JSON.stringify({
        fingerprint: submission.fingerprint,
        idempotencyKey: submission.idempotencyKey,
        filePath: submission.filePath,
        createdAt: submission.createdAt,
      }),
    );
  } catch {
    // The in-memory key still protects ordinary retries when storage is denied.
  }
}

function clearPersistedWebRequest(userId: string) {
  try {
    window.sessionStorage.removeItem(`${webRequestSubmissionStoragePrefix}${userId}`);
  } catch {
    // Navigation can continue after a confirmed server response.
  }
}

export default function NewRequestPage() {
  const router = useRouter();
  const locale = useActiveLocale();
  const searchParams = useSearchParams();
  const initialRequestIntent = parseRequestIntent(searchParams.get("intent"));
  const initialRequestSelection = initialRequestIntent
    ? getRequestIntentSelection(initialRequestIntent)
    : null;
  const requestStartTrackedRef = useRef(false);
  const growthAttemptIdRef = useRef("");
  const growthExpectedUserIdRef = useRef("");
  const [growthStartDelivery] = useState(
    () => createGrowthRequestStartDeliveryController()
  );
  const requestSubmissionRef = useRef<WebRequestSubmission | null>(null);
  const pendingGrowthRequestCreatedRef = useRef<{
    orderId: string;
    attemptId: string;
    expectedUserId: string;
  } | null>(null);
  const requestCompletionContinueRef = useRef<(() => void) | null>(null);
  const repeatPrefillStartedRef = useRef(false);

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
  const [mainService, setMainService] = useState<string>(
    initialRequestSelection?.mainServiceId ?? "stage_1"
  );
  const [selectedExtras, setSelectedExtras] = useState<string[]>(() =>
    initialRequestSelection ? [...initialRequestSelection.extraServiceIds] : []
  );
  const [openServiceCategories, setOpenServiceCategories] = useState<string[]>(() => [
    ...new Set([
      "emissions",
      ...(initialRequestSelection ? initialRequestSelection.openCategoryIds : []),
    ]),
  ]);
  const [masterSlave, setMasterSlave] = useState<"master" | "slave">("master");
  const [notes, setNotes] = useState("");
  const [fileName, setFileName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [paymentAccepted, setPaymentAccepted] = useState(false);
  const [responsibilityAccepted, setResponsibilityAccepted] = useState(false);
  const [abandonedReminderEnabled, setAbandonedReminderEnabled] = useState(false);
  const [reminderPreferenceSaving, setReminderPreferenceSaving] = useState(false);
  const [reminderPreferenceError, setReminderPreferenceError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [awaitingConsentAfterSuccess, setAwaitingConsentAfterSuccess] = useState(false);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [balanceRefreshing, setBalanceRefreshing] = useState(false);
  const [balanceRefreshMessage, setBalanceRefreshMessage] = useState("");
  const [repeatPrefill, setRepeatPrefill] = useState<RepeatRequestPrefill | null>(null);
  const [repeatPrefillLoading, setRepeatPrefillLoading] = useState(false);
  const [repeatPrefillError, setRepeatPrefillError] = useState("");
  const [repeatPrefillDismissed, setRepeatPrefillDismissed] = useState(false);

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

  const queueGrowthRequestStart = (reminderOptIn: boolean): void => {
    const attemptId = growthAttemptIdRef.current;
    if (!attemptId) return;
    void growthStartDelivery.begin(
      attemptId,
      reminderOptIn,
      growthExpectedUserIdRef.current
    );
  };

  const markRequestStarted = () => {
    if (requestStartTrackedRef.current) return;

    requestStartTrackedRef.current = true;
    const attemptId = window.crypto.randomUUID();
    growthAttemptIdRef.current = attemptId;
    void growthStartDelivery.begin(
      attemptId,
      abandonedReminderEnabled,
      growthExpectedUserIdRef.current
    );
  };

  async function loadCustomerProfile() {
    setProfileLoading(true);

    const user = (await getStableSession()).session?.user;

    if (!user) {
      notifySessionRequired();
      setProfileLoading(false);
      return;
    }

    if (
      growthExpectedUserIdRef.current &&
      growthExpectedUserIdRef.current !== user.id
    ) {
      notifySessionRequired();
      setProfileLoading(false);
      return;
    }
    growthExpectedUserIdRef.current = user.id;
    if (growthAttemptIdRef.current) {
      void growthStartDelivery.begin(
        growthAttemptIdRef.current,
        abandonedReminderEnabled,
        user.id
      );
    }

    if (await signOutIfEmailUnverified(user)) {
      if (!replacePrivateMeasurementDocument("/login?verify_email=1")) {
        router.push("/login?verify_email=1");
      }
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, email, customer_id, credit_balance, allow_negative_credits, negative_credit_limit, account_status"
      )
      .eq("id", user.id)
      .single();

    if (error) {
      setMessage("Customer profile could not be loaded.");
      setProfileLoading(false);
      return;
    }

    setCustomerProfile(data as CustomerProfile);
    const preference = await supabase
      .from("growth_customer_preferences")
      .select("abandoned_request_reminders")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!preference.error && preference.data) {
      const reminderEnabled = preference.data.abandoned_request_reminders === true;
      setAbandonedReminderEnabled(reminderEnabled);
      if (reminderEnabled) queueGrowthRequestStart(true);
    }
    setProfileLoading(false);
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => { void loadCustomerProfile(); }, 0);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const retryStartedJourneyAfterConsent = () => {
      if (!requestStartTrackedRef.current) return;
      const attemptId = growthAttemptIdRef.current;
      if (!attemptId) return;
      void growthStartDelivery.begin(
        attemptId,
        false,
        growthExpectedUserIdRef.current
      );
    };
    window.addEventListener(
      measurementConsentChangedEvent,
      retryStartedJourneyAfterConsent
    );
    return () => {
      window.removeEventListener(
        measurementConsentChangedEvent,
        retryStartedJourneyAfterConsent
      );
    };
  }, [growthStartDelivery]);

  useEffect(() => {
    if (!awaitingConsentAfterSuccess) return;

    const continueAfterConsent = createRequestCompletionConsentHandoff({
      readConsent: readMeasurementConsentSnapshot,
      flushConsentedFirstParty: async () => {
        const pending = pendingGrowthRequestCreatedRef.current;
        if (!pending) return;
        const recorded = await recordGrowthRequestCreated(
          pending.orderId,
          pending.attemptId,
          pending.expectedUserId
        ).catch(() => false);
        if (recorded && pendingGrowthRequestCreatedRef.current === pending) {
          pendingGrowthRequestCreatedRef.current = null;
        }
      },
      flushVerifiedConversions: flushPendingVerifiedConversions,
      navigate: () => {
        pendingGrowthRequestCreatedRef.current = null;
        if (!replaceWithPendingMeasurementCompletion("/dashboard")) {
          window.location.assign("/dashboard");
        }
      },
    });
    const handleConsentChoice = () => {
      void continueAfterConsent(true);
    };
    requestCompletionContinueRef.current = handleConsentChoice;
    const failOpenTimer = window.setTimeout(() => {
      void continueAfterConsent(true);
    }, requestCompletionConsentFailOpenMs);

    void continueAfterConsent(false);
    window.addEventListener(measurementConsentChangedEvent, handleConsentChoice);
    return () => {
      window.clearTimeout(failOpenTimer);
      if (requestCompletionContinueRef.current === handleConsentChoice) {
        requestCompletionContinueRef.current = null;
      }
      window.removeEventListener(measurementConsentChangedEvent, handleConsentChoice);
    };
  }, [awaitingConsentAfterSuccess]);

  useEffect(() => () => {
    pendingGrowthRequestCreatedRef.current = null;
  }, []);

  const handleReminderPreference = async (enabled: boolean) => {
    const previous = abandonedReminderEnabled;
    setAbandonedReminderEnabled(enabled);
    setReminderPreferenceSaving(true);
    setReminderPreferenceError("");
    const saved = await updateGrowthReminderPreference(
      enabled,
      customerProfile?.id
    );
    setReminderPreferenceSaving(false);
    if (!saved) {
      setAbandonedReminderEnabled(previous);
      setReminderPreferenceError("Reminder preference could not be saved. Your request can still be submitted normally.");
      return;
    }
    if (enabled && growthAttemptIdRef.current) {
      queueGrowthRequestStart(true);
    }
  };

  useEffect(() => {
    const repeatId = new URLSearchParams(window.location.search).get("repeat")?.trim() ?? "";
    if (!repeatId || repeatPrefillStartedRef.current) return;

    repeatPrefillStartedRef.current = true;

    if (!isRepeatRequestId(repeatId)) {
      const timeout = window.setTimeout(() => {
        setRepeatPrefillError("The previous request reference is invalid. Start a blank request instead.");
      }, 0);
      return () => window.clearTimeout(timeout);
    }

    let cancelled = false;

    async function loadRepeatPrefill() {
      setRepeatPrefillLoading(true);
      setRepeatPrefillError("");

      try {
        const response = await authenticatedFetch(`/api/requests/${encodeURIComponent(repeatId)}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as {
          order?: RepeatRequestOrder;
          error?: string;
        };

        if (!response.ok || !payload.order) {
          throw new Error(payload.error || "Previous request could not be loaded.");
        }

        const prefill = buildRepeatRequestPrefill(payload.order, {
          mainServices,
          extraServices,
        });

        if (cancelled) return;

        setUseManualVehicleDetails(true);
        setManualVehicleBrand(prefill.vehicle.brand);
        setManualVehicleModel(prefill.vehicle.model);
        setManualVehicleGeneration(prefill.vehicle.generation);
        setManualVehicleEngine(prefill.vehicle.engine);
        setEcu(prefill.technical.ecu);
        setGearbox(prefill.technical.gearbox);
        setYear(prefill.technical.year);
        setReadMethod(prefill.technical.readMethod);
        setHwSw(prefill.technical.hwSw);
        setMasterSlave(prefill.technical.masterSlave);

        if (prefill.services.fullyResolved && prefill.services.mainServiceId) {
          setMainService(prefill.services.mainServiceId);
          setSelectedExtras(prefill.services.extraServiceIds);
          setOpenServiceCategories((current) => [
            ...new Set([
              ...current,
              ...extraServiceCategories
                .filter((category) =>
                  category.services.some((service) =>
                    prefill.services.extraServiceIds.includes(service.id)
                  )
                )
                .map((category) => category.id),
            ]),
          ]);
        } else {
          setMainService("");
          setSelectedExtras([]);
        }

        // A repeated request still requires a new file, notes, vehicle-specific identifiers and approvals.
        setLicensePlate("");
        setNotes("");
        setFileName("");
        setSelectedFile(null);
        setPaymentAccepted(false);
        setResponsibilityAccepted(false);
        setRepeatPrefill(prefill);
      } catch {
        if (!cancelled) {
          setRepeatPrefillError(
            "The previous request could not be loaded securely. The blank request form is still available."
          );
        }
      } finally {
        if (!cancelled) setRepeatPrefillLoading(false);
      }
    }

    void loadRepeatPrefill();
    return () => {
      cancelled = true;
    };
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

  const selectedExtraServices = useMemo(
    () =>
      selectedExtras
        .map((id) => extraServices.find((service) => service.id === id))
        .filter((service): service is ExtraService => Boolean(service)),
    [selectedExtras]
  );

  const totalCredits = useMemo(() => {
    const mainCredits = selectedMainService?.credits ?? 0;

    const extrasCredits = selectedExtraServices.reduce(
      (sum, service) => sum + service.credits,
      0
    );

    return mainCredits + extrasCredits;
  }, [selectedExtraServices, selectedMainService]);

  const creditBalance = Number(customerProfile?.credit_balance ?? 0);
  const negativeCreditLimit = Number(customerProfile?.negative_credit_limit ?? 0);
  const allowNegativeCredits = Boolean(customerProfile?.allow_negative_credits);
  const accountStatus = customerProfile?.account_status ?? "active";
  const availableCredits = allowNegativeCredits
    ? creditBalance + Math.max(negativeCreditLimit, 0)
    : creditBalance;
  const balanceAfterRequest = creditBalance - totalCredits;
  const isZeroCreditRequest = Boolean(selectedMainService) && totalCredits === 0;
  const canCreateByCredits =
    Boolean(selectedMainService) &&
    Number.isInteger(totalCredits) &&
    totalCredits >= 0 &&
    totalCredits <= availableCredits;
  const accountBlocked = accountStatus !== "active";
  const showCreditShortfall = Boolean(
    !profileLoading && selectedMainService && !accountBlocked && !canCreateByCredits
  );

  const serviceSummary = useMemo(() => {
    const main = selectedMainService?.title ?? "Service";
    const extras = selectedExtraServices.map((service) => service.title);

    return [main, ...extras].join(" + ");
  }, [selectedExtraServices, selectedMainService]);

  const selectedAdvancedExtraCount = advancedExtraServiceCategories.reduce(
    (sum, category) =>
      sum + category.services.filter((service) => selectedExtras.includes(service.id)).length,
    0
  );

  const hasRequestVehicle = Boolean(
    requestVehicleBrand && requestVehicleModel && requestVehicleEngine
  );
  const selectedFileName = selectedFile?.name.toLowerCase() ?? "";
  const hasValidSelectedFile = Boolean(
    selectedFile &&
      selectedFile.size <= maxRequestFileSize &&
      allowedRequestFileExtensions.some((extension) =>
        selectedFileName.endsWith(extension)
      )
  );

  const requestStepStates = getRequestFlowStepStates({
    hasVehicle: hasRequestVehicle,
    hasService: Boolean(selectedMainService),
    hasUpload: hasValidSelectedFile,
    hasNotes: Boolean(notes.trim()),
    hasPaymentAcceptance: paymentAccepted,
    hasFinalAcceptance: responsibilityAccepted,
  });

  const submissionChecklist = [
    {
      id: "vehicle",
      label: "Vehicle and engine selected",
      complete: hasRequestVehicle,
    },
    {
      id: "service",
      label: "Service selected",
      complete: Boolean(selectedMainService),
    },
    {
      id: "file",
      label: "Original file attached",
      complete: hasValidSelectedFile,
    },
    {
      id: "credits",
      label: isZeroCreditRequest ? "Zero-credit request verified" : "Credits verified",
      complete: !profileLoading && !accountBlocked && canCreateByCredits,
    },
    {
      id: "payment",
      label: isZeroCreditRequest ? "Zero-credit request confirmed" : "Credit use accepted",
      complete: paymentAccepted,
    },
    {
      id: "responsibility",
      label: "Responsibility confirmed",
      complete: responsibilityAccepted,
    },
  ];
  const completedSubmissionChecklistItems = submissionChecklist.filter(
    (item) => item.complete
  ).length;
  const isRequestReadyForSubmit = submissionChecklist.every((item) => item.complete);
  const requestIntelligence = evaluateRequestIntelligence({
    hasVehicle: hasRequestVehicle,
    manualVehicle: useManualVehicleDetails,
    hasService: Boolean(selectedMainService),
    selectedServiceIds: [mainService, ...selectedExtras].filter(Boolean),
    selectedServiceTitles: [
      selectedMainService?.title ?? "",
      ...selectedExtraServices.map((service) => service.title),
    ].filter(Boolean),
    hasValidFile: hasValidSelectedFile,
    fileName: selectedFile?.name ?? null,
    ecu,
    readMethod,
    notes,
    accountVerified: !profileLoading && !accountBlocked,
    creditsVerified: !profileLoading && !accountBlocked && canCreateByCredits,
  });

  const switchToCatalogVehicleDetails = () => {
    markRequestStarted();
    setUseManualVehicleDetails(false);
  };

  const switchToManualVehicleDetails = () => {
    markRequestStarted();
    setUseManualVehicleDetails(true);
    setSelectedVehicle(null);
    if (selectedVehicle) {
      setEcu("");
      setReadMethod("");
    }
  };

  const clearRepeatPrefill = () => {
    markRequestStarted();
    setUseManualVehicleDetails(false);
    setVehicleBrandId("");
    setVehicleModelId("");
    setVehicleGenerationId("");
    setVehicleEngineId("");
    setManualVehicleBrand("");
    setManualVehicleModel("");
    setManualVehicleGeneration("");
    setManualVehicleEngine("");
    setSelectedVehicle(null);
    setEcu("");
    setGearbox("");
    setYear("");
    setReadMethod("");
    setLicensePlate("");
    setHwSw("");
    setMasterSlave("master");
    setMainService("stage_1");
    setSelectedExtras([]);
    setOpenServiceCategories(["emissions"]);
    setNotes("");
    setFileName("");
    setSelectedFile(null);
    setPaymentAccepted(false);
    setResponsibilityAccepted(false);
    setRepeatPrefill(null);
    setRepeatPrefillError("");
    setRepeatPrefillDismissed(false);
    window.history.replaceState(null, "", window.location.pathname);
  };

  const toggleExtra = (id: string) => {
    markRequestStarted();
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

  async function refreshCreditBalance() {
    if (balanceRefreshing) return;

    setBalanceRefreshing(true);
    setBalanceRefreshMessage("");

    try {
      const user = (await getStableSession()).session?.user;
      if (!user) {
        notifySessionRequired();
        setBalanceRefreshMessage("Your secure session must be restored before refreshing the balance.");
        return;
      }

      const latestProfile = await getLatestCustomerProfile(user.id);
      setCustomerProfile(latestProfile);
      setBalanceRefreshMessage("Credit balance refreshed.");
    } catch {
      setBalanceRefreshMessage("Credit balance could not be refreshed. Please try again.");
    } finally {
      setBalanceRefreshing(false);
    }
  }

  function validateCreditAccess(profile: CustomerProfile, requiredCredits: number) {
    const status = profile.account_status ?? "active";

    if (!Number.isInteger(requiredCredits) || requiredCredits < 0) {
      return "Please select a valid service combination.";
    }

    if (status !== "active") {
      return customerWorkflowT(locale, "accountStatusBlocked", {
        status: localizeAccountState(locale, status),
      });
    }

    const balance = Number(profile.credit_balance ?? 0);
    const negativeLimit = Number(profile.negative_credit_limit ?? 0);
    const negativeEnabled = Boolean(profile.allow_negative_credits);
    const available = negativeEnabled ? balance + Math.max(negativeLimit, 0) : balance;

    if (requiredCredits > available) {
      if (negativeEnabled) {
        return customerWorkflowT(locale, "insufficientCreditsWithLimit", {
          balance: balance.toLocaleString(intlLocaleByCode[locale]),
          negativeLimit: negativeLimit.toLocaleString(intlLocaleByCode[locale]),
          available: available.toLocaleString(intlLocaleByCode[locale]),
          required: requiredCredits.toLocaleString(intlLocaleByCode[locale]),
        });
      }

      return customerWorkflowT(locale, "insufficientCredits", {
        balance: balance.toLocaleString(intlLocaleByCode[locale]),
        required: requiredCredits.toLocaleString(intlLocaleByCode[locale]),
      });
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

    if (!selectedMainService) {
      setMessage("Please select the service required for this new request.");
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

    const user = (await getStableSession()).session?.user;

    if (!user) {
      setSubmitting(false);
      notifySessionRequired();
      return;
    }

    if (await signOutIfEmailUnverified(user)) {
      if (!replacePrivateMeasurementDocument("/login?verify_email=1")) {
        router.push("/login?verify_email=1");
      }
      return;
    }

    const customerEmail = user.email ?? "";
    let selectedFileSha256: string;
    try {
      selectedFileSha256 = await sha256Hex(await selectedFile.arrayBuffer());
    } catch {
      setSubmitting(false);
      setMessage("The selected file fingerprint could not be calculated.");
      return;
    }

    const submissionSignature = JSON.stringify({
      userId: user.id,
      customerEmail,
      vehicleBrand: requestVehicleBrand,
      vehicleModel: requestVehicleModel,
      vehicleGeneration: requestVehicleGeneration,
      vehicleEngine: requestVehicleEngine,
      serviceType: serviceSummary,
      creditsRequired: totalCredits,
      notes: notes || "-",
      ecu: ecu || null,
      gearbox: gearbox || null,
      vehicleYear: year || null,
      readMethod: readMethod || null,
      licensePlate: licensePlate || null,
      hwSw: hwSw || null,
      masterSlave,
      uploadedFileName: fileName || null,
      file: {
        name: selectedFile.name,
        size: selectedFile.size,
        type: selectedFile.type,
        lastModified: selectedFile.lastModified,
        sha256: selectedFileSha256,
      },
    });
    const submissionFingerprint = await fingerprintWebRequest(submissionSignature);
    const inMemorySubmission = requestSubmissionRef.current?.fingerprint === submissionFingerprint
      ? requestSubmissionRef.current
      : null;
    const persistedSubmission = inMemorySubmission
      ? null
      : readPersistedWebRequest(user.id, submissionFingerprint);
    const existingSubmission = inMemorySubmission ?? persistedSubmission;
    const submission = existingSubmission ?? {
      signature: submissionSignature,
      fingerprint: submissionFingerprint,
      idempotencyKey: window.crypto.randomUUID(),
      filePath: "",
      createdAt: Date.now(),
    };
    submission.signature = submissionSignature;
    requestSubmissionRef.current = submission;
    persistWebRequest(user.id, submission);

    let latestProfile: CustomerProfile;

    try {
      latestProfile = await getLatestCustomerProfile(user.id);
    } catch {
      setSubmitting(false);
      setMessage("Customer profile could not be loaded.");
      return;
    }

    const creditValidationError = existingSubmission
      ? null
      : validateCreditAccess(latestProfile, totalCredits);

    if (creditValidationError) {
      setSubmitting(false);
      setCustomerProfile(latestProfile);
      setMessage(creditValidationError);
      return;
    }

    const prepareResponse = await authenticatedFetch("/api/account/request-upload/prepare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idempotencyKey: submission.idempotencyKey,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        contentType: selectedFile.type || "application/octet-stream",
        sha256: selectedFileSha256,
      }),
    });
    const prepared = await prepareResponse.json().catch(() => null) as {
      error?: string;
      upload?: { path?: string; token?: string; contentType?: string };
    } | null;
    if (
      !prepareResponse.ok ||
      typeof prepared?.upload?.path !== "string" ||
      typeof prepared.upload.token !== "string" ||
      typeof prepared.upload.contentType !== "string"
    ) {
      setSubmitting(false);
      setMessage("Secure upload could not be prepared.");
      return;
    }
    if (submission.filePath && submission.filePath !== prepared.upload.path) {
      setSubmitting(false);
      setMessage("The saved request upload does not match this submission. Change the form and try again.");
      return;
    }
    submission.filePath = prepared.upload.path;
    requestSubmissionRef.current = submission;
    persistWebRequest(user.id, submission);

    const originalFilePath = prepared.upload.path;

    const { error: uploadError } = await supabase.storage
      .from("customer-files")
      .uploadToSignedUrl(originalFilePath, prepared.upload.token, selectedFile, {
        contentType: prepared.upload.contentType,
        cacheControl: "3600",
        upsert: false,
      });

    const storageError = uploadError as {
      status?: string | number;
      statusCode?: string | number;
    } | null;
    const duplicateUpload = Boolean(
      storageError && (
        Number(storageError.status) === 409
        || Number(storageError.statusCode) === 409
        || String(storageError.statusCode ?? "").toLowerCase().includes("duplicate")
      )
    );
    if (uploadError && !duplicateUpload) {
      setSubmitting(false);
      setMessage("The original file could not be uploaded securely. Please try again.");
      return;
    }

    const { data: creationResult, error } = await supabase.rpc(
      "create_web_order_with_credit_deduction",
      {
        p_idempotency_key: submission.idempotencyKey,
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
      setMessage("The request could not be created securely. Please try again.");
      return;
    }

    const creation = creationResult as {
      order_id?: unknown;
      duplicate?: unknown;
    } | null;
    const createdOrderId = typeof creation?.order_id === "string"
      ? creation.order_id
      : "";
    const duplicate = creation?.duplicate === true;

    if (!createdOrderId) {
      setMessage("The request was accepted but its confirmation could not be verified. Please retry safely.");
      return;
    }

    setCustomerProfile(
      duplicate
        ? latestProfile
        : {
            ...latestProfile,
            credit_balance: Number(latestProfile.credit_balance ?? 0) - totalCredits,
          }
    );

    const conversionSeed = String(createdOrderId || growthAttemptIdRef.current || window.crypto.randomUUID());
    const [, initialRequestJourneyRecorded] = await Promise.all([
      trackRequestSubmitted(conversionSeed).catch(() => false),
      createdOrderId && growthAttemptIdRef.current
          ? recordGrowthRequestCreated(
            String(createdOrderId),
            growthAttemptIdRef.current,
            user.id
          ).catch(() => false)
        : Promise.resolve(false),
    ]);

    try {
      await authenticatedFetch("/api/email/new-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId: String(createdOrderId || ""),
        }),
      });
    } catch {
      // Email notification failure must not block the customer request.
    }

    requestSubmissionRef.current = null;
    clearPersistedWebRequest(user.id);
    const completionConsent = readMeasurementConsentSnapshot();
    const consentChoiceAvailable = requestCompletionConsentIsAvailable(
      window.location.hostname
    );
    let requestJourneyRecorded = initialRequestJourneyRecorded;
    if (
      !requestJourneyRecorded &&
      !completionConsent.needsDecision &&
      completionConsent.preferences.analytics &&
      createdOrderId &&
      growthAttemptIdRef.current
    ) {
      requestJourneyRecorded = await recordGrowthRequestCreated(
        createdOrderId,
        growthAttemptIdRef.current,
        user.id
      ).catch(() => false);
    }
    if (
      !requestJourneyRecorded &&
      completionConsent.needsDecision &&
      consentChoiceAvailable &&
      createdOrderId &&
      growthAttemptIdRef.current
    ) {
      pendingGrowthRequestCreatedRef.current = {
        orderId: createdOrderId,
        attemptId: growthAttemptIdRef.current,
        expectedUserId: user.id,
      };
    }
    if (
      completionConsent.needsDecision &&
      consentChoiceAvailable
    ) {
      setAwaitingConsentAfterSuccess(true);
      return;
    }
    pendingGrowthRequestCreatedRef.current = null;
    if (!replaceWithPendingMeasurementCompletion("/dashboard")) {
      window.location.assign("/dashboard");
    }
  };

  return (
    <main
      className="mg-compact-ui min-h-screen bg-[#050505] text-white"
      onChangeCapture={markRequestStarted}
    >
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_20%_0%,rgba(160,18,28,0.24),transparent_32%),linear-gradient(135deg,#050505,#0d0d0f_48%,#160608)]" />

      <CustomerPortalPageHeader
        eyebrow="File Service"
        title="New File Request"
        icon={Upload}
        heading
        actions={(
          <Link
            href="/"
            aria-label="Return to homepage"
            className="inline-flex h-11 items-center rounded-lg border border-white/10 px-3 text-sm font-black text-zinc-300 transition hover:bg-white/10 hover:text-white lg:h-9"
          >
            <Home className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Home</span>
          </Link>
        )}
      />

      <section className="mx-auto max-w-7xl px-4 py-5 lg:py-4">
        {(repeatPrefillLoading || repeatPrefillError || (repeatPrefill && !repeatPrefillDismissed)) && (
          <section
            aria-labelledby="repeat-request-title"
            aria-live="polite"
            className="mb-6 overflow-hidden rounded-2xl border border-red-800/45 bg-[linear-gradient(135deg,rgba(127,29,29,0.24),rgba(10,10,10,0.96)_58%)] shadow-xl shadow-black/25"
          >
            {repeatPrefillLoading ? (
              <div className="flex min-h-24 items-center gap-3 px-5 py-4 text-sm font-bold text-zinc-300">
                <span id="repeat-request-title" className="sr-only">Repeat request preparation</span>
                <Loader2 className="h-5 w-5 animate-spin text-red-400" />
                Securely preparing details from your previous request...
              </div>
            ) : repeatPrefillError ? (
              <div role="alert" className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 id="repeat-request-title" className="font-black text-white">Previous request not applied</h2>
                  <p className="mt-1 text-sm leading-6 text-zinc-400">{repeatPrefillError}</p>
                </div>
                <button
                  type="button"
                  onClick={clearRepeatPrefill}
                    className="min-h-11 shrink-0 rounded-xl border border-white/10 bg-white/[0.05] px-4 text-sm font-black text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
                >
                  Start blank
                </button>
              </div>
            ) : repeatPrefill ? (
              <div className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full border border-red-700/45 bg-red-950/35 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-red-100">
                      <RefreshCcw className="h-3.5 w-3.5" />
                      Repeat request
                    </span>
                    <span className="text-xs font-bold text-zinc-500">
                      Source <span translate="no" data-no-translate>#{repeatPrefill.sourceOrderId.slice(0, 8).toUpperCase()}</span>
                    </span>
                  </div>

                  <h2 id="repeat-request-title" className="mt-3 text-xl font-black text-white">
                    Previous workshop context is ready for review
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-zinc-400">
                    Vehicle, technical details and recognized services were prepared as editable values. Verify them before submitting this new job.
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
                    <span className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-zinc-200">
                      {[repeatPrefill.vehicle.brand, repeatPrefill.vehicle.model, repeatPrefill.vehicle.engine]
                        .filter(Boolean)
                        .join(" ") ? (
                          <span translate="no" data-no-translate>{[repeatPrefill.vehicle.brand, repeatPrefill.vehicle.model, repeatPrefill.vehicle.engine].filter(Boolean).join(" ")}</span>
                        ) : "Vehicle details incomplete"}
                    </span>
                    <span className={`rounded-lg border px-3 py-2 ${
                      repeatPrefill.services.fullyResolved
                        ? "border-emerald-700/35 bg-emerald-950/20 text-emerald-200"
                        : "border-amber-700/35 bg-amber-950/20 text-amber-200"
                    }`}>
                      {repeatPrefill.services.fullyResolved
                        ? customerWorkflowT(
                            locale,
                            repeatPrefill.services.extraServiceIds.length
                              ? "serviceSelectionsMatched"
                              : "serviceSelectionMatched",
                            { count: (1 + repeatPrefill.services.extraServiceIds.length).toLocaleString(intlLocaleByCode[locale]) },
                          )
                        : "Select the current service again"}
                    </span>
                  </div>

                  {(repeatPrefill.missingVehicleFields.length > 0 || !repeatPrefill.services.fullyResolved) && (
                    <p className="mt-3 text-xs font-bold leading-5 text-amber-200">
                      Some previous values could not be matched exactly. Review the highlighted vehicle and service fields before continuing.
                    </p>
                  )}

                  <div className="mt-4 flex items-start gap-2 border-t border-white/10 pt-4 text-xs leading-5 text-zinc-500">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    A new original file is required. Files, notes, number plates, messages, credits, approvals and delivery data were not copied.
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 lg:w-52 lg:grid-cols-1">
                  <button
                    type="button"
                    onClick={() => setRepeatPrefillDismissed(true)}
                    className="min-h-11 rounded-xl border border-white/10 bg-white/[0.05] px-4 text-sm font-black text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
                  >
                    Hide summary
                  </button>
                  <button
                    type="button"
                    onClick={clearRepeatPrefill}
                    className="min-h-11 rounded-xl border border-red-800/45 bg-red-950/25 px-4 text-sm font-black text-red-100 transition hover:bg-red-950/45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
                  >
                    Start blank
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        )}

        {showCreditShortfall ? (
          <CreditShortfallPanel
            className="mb-4 lg:hidden"
            requiredCredits={totalCredits}
            availableCredits={availableCredits}
            refreshing={balanceRefreshing}
            feedback={balanceRefreshMessage}
            onRefresh={() => void refreshCreditBalance()}
          />
        ) : null}

        <div className="mb-4 grid gap-3 xl:grid-cols-[1fr_300px]">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-red-800/50 bg-red-950/25 px-3 py-1.5 text-xs font-semibold text-red-100">
              <BadgeCheck className="h-4 w-4 text-red-500" />
              Professional ECU / TCU request form
            </div>

            <h2 className="text-xl font-black sm:text-2xl">
              Create New
              <span className="ml-1 text-red-600">File Service Request</span>
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              Select vehicle information, choose the required software solution,
              upload your original file and submit the request to MG AutoTech.
            </p>
          </div>

          <div className="rounded-xl border border-red-900/40 bg-red-950/20 p-4">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-red-500" />
              <div>
                <div className="text-xs text-zinc-400">Estimated Total</div>
                <div className="text-2xl font-black">{totalCredits} <span className="text-xs font-bold text-red-300">Credits</span></div>
              </div>
            </div>

            <div className="mt-3 rounded-xl bg-black/30 p-3 text-xs leading-5 text-zinc-300">
              {serviceSummary || "Select service"}
            </div>
          </div>
        </div>

        <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
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

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
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
                    protectOptions
                  />

                  <SelectBox
                    label="Model"
                    value={vehicleModelId}
                    onChange={setVehicleModelId}
                    required
                    options={models}
                    loading={loadingModels}
                    disabled={!vehicleBrandId || loadingModels}
                    protectOptions
                  />

                  <SelectBox
                    label="Generation"
                    value={vehicleGenerationId}
                    onChange={setVehicleGenerationId}
                    options={generations}
                    loading={loadingGenerations}
                    disabled={!vehicleModelId || loadingGenerations}
                    protectOptions
                  />

                  <SelectBox
                    label="Engine"
                    value={vehicleEngineId}
                    onChange={setVehicleEngineId}
                    required
                    options={engines}
                    loading={loadingEngines}
                    disabled={!vehicleGenerationId || loadingEngines}
                    protectOptions
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

                    <h2 className="text-3xl font-black md:text-4xl" translate="no" data-no-translate>
                      {selectedBrandName} {selectedModelName}
                    </h2>

                    <p className="mt-2 text-sm font-bold text-zinc-400">
                      {selectedGenerationName ? (
                        <span translate="no" data-no-translate>{selectedGenerationName}</span>
                      ) : "Generation not specified"}{" "}·{" "}
                      <span translate="no" data-no-translate>{selectedEngineName}</span>
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
                    rawValue={Boolean(selectedVehicle.ecu?.length)}
                  />

                  <StatCard
                    label="Fuel Type"
                    icon={<Gauge className="h-5 w-5" />}
                    value={selectedVehicle.fuelType || "Not available"}
                    rawValue={Boolean(selectedVehicle.fuelType)}
                  />

                  <StatCard
                    label="Read Method"
                    icon={<Database className="h-5 w-5" />}
                    value={
                      selectedVehicle.readMethods?.length
                        ? selectedVehicle.readMethods.join(", ")
                        : "Not available"
                    }
                    rawValue={Boolean(selectedVehicle.readMethods?.length)}
                  />

                  <StatCard
                    label="Services"
                    icon={<Wrench className="h-5 w-5" />}
                    value={
                      selectedVehicle.services?.length
                        ? customerWorkflowT(locale, "supportedCount", {
                            count: selectedVehicle.services.length.toLocaleString(intlLocaleByCode[locale]),
                          })
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
                          translate="no"
                          data-no-translate
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
                    type="button"
                    onClick={() => {
                      markRequestStarted();
                      setMainService(service.id);
                    }}
                    className={`rounded-2xl border p-5 text-left transition hover:-translate-y-1 ${
                      mainService === service.id
                        ? "border-red-700 bg-red-950/35"
                        : "border-white/10 bg-black/30 hover:border-red-800/60"
                    }`}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="font-black">
                        {localizeServiceLabel(locale, service.title)}
                      </span>
                      {mainService === service.id && (
                        <CheckCircle2 className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                    <div className="text-sm font-black text-red-400">
                      {customerWorkflowT(locale, "creditsCount", { count: service.credits.toLocaleString(intlLocaleByCode[locale]) })}
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
                  {customerWorkflowT(locale, "selectedCount", { count: selectedExtras.length.toLocaleString(intlLocaleByCode[locale]) })}
                </div>
              </div>

              <div className="space-y-4">
                {primaryExtraServiceCategories.map((category) => (
                  <ServiceCategoryPanel
                    key={category.id}
                    category={category}
                    locale={locale}
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
                        locale={locale}
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
                  {fileName ? (
                    <span translate="no" data-no-translate>{fileName}</span>
                  ) : "Drag and drop a file here or click"}
                </div>
                <p className="mt-2 text-sm text-zinc-500">
                  <span translate="no" data-no-translate>{allowedRequestFileExtensions.join(", ")}</span>{" "}· <span className="font-bold text-zinc-400">Max</span> 32 MB
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
                  type="button"
                  onClick={() => {
                    markRequestStarted();
                    setMasterSlave("master");
                  }}
                  className={`rounded-xl px-5 py-3 text-sm font-black ${
                    masterSlave === "master"
                      ? "bg-[#b1121b] text-white"
                      : "bg-white/10 text-zinc-400"
                  }`}
                >
                  Master File
                </button>

                <button
                  type="button"
                  onClick={() => {
                    markRequestStarted();
                    setMasterSlave("slave");
                  }}
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
            <div className="sticky top-20 rounded-[2rem] border border-white/10 bg-black/55 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
              <ShieldCheck className="mb-5 h-9 w-9 text-red-500" />
              <h3 className="text-2xl font-black">Request Summary</h3>

              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm">
                <div className="mb-3 flex items-center justify-between gap-4">
                  <span className="text-zinc-400">Credit Balance</span>
                  <span className="font-black text-white">
                    {profileLoading ? "Loading..." : customerWorkflowT(locale, "creditsCount", { count: creditBalance.toLocaleString(intlLocaleByCode[locale]) })}
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
                      ? customerWorkflowT(locale, "allowedNegativeCredits", { limit: negativeCreditLimit.toLocaleString(intlLocaleByCode[locale]) })
                      : "Disabled"}
                  </span>
                </div>

                <div className="mb-3 flex items-center justify-between gap-4">
                  <span className="text-zinc-400">Available</span>
                  <span className="font-black text-red-300">
                    {customerWorkflowT(locale, "creditsCount", { count: availableCredits.toLocaleString(intlLocaleByCode[locale]) })}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-zinc-400">After Request</span>
                  <span
                    className={`font-black ${
                      balanceAfterRequest < 0 ? "text-yellow-300" : "text-emerald-300"
                    }`}
                  >
                    {customerWorkflowT(locale, "creditsCount", { count: balanceAfterRequest.toLocaleString(intlLocaleByCode[locale]) })}
                  </span>
                </div>

                {accountBlocked ? (
                  <div className="mt-4 rounded-xl border border-red-800/50 bg-red-950/30 p-3 text-xs font-bold text-red-200">
                    {customerWorkflowT(locale, "accountStatusDisabled", {
                      status: localizeAccountState(locale, accountStatus),
                    })}
                  </div>
                ) : showCreditShortfall ? (
                  <CreditShortfallPanel
                    className="mt-4 hidden lg:block"
                    requiredCredits={totalCredits}
                    availableCredits={availableCredits}
                    refreshing={balanceRefreshing}
                    feedback={balanceRefreshMessage}
                    onRefresh={() => void refreshCreditBalance()}
                  />
                ) : null}
              </div>

              <div className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between gap-4 rounded-2xl bg-white/[0.04] p-4">
                  <span className="text-zinc-400">Vehicle</span>
                  <span className="text-right font-bold">
                    <span translate="no" data-no-translate>{requestVehicleBrand || "-"} {requestVehicleModel || ""}</span>
                    {useManualVehicleDetails ? (
                      <span className="mt-1 block text-[11px] font-black uppercase tracking-[0.12em] text-yellow-300">
                        Customer-provided
                      </span>
                    ) : null}
                  </span>
                </div>

                <div className="flex justify-between gap-4 rounded-2xl bg-white/[0.04] p-4">
                  <span className="text-zinc-400">Engine</span>
                  <span className="text-right font-bold" translate="no" data-no-translate>
                    {requestVehicleEngine || "-"}
                  </span>
                </div>

                <div className="flex justify-between gap-4 rounded-2xl bg-white/[0.04] p-4">
                  <span className="text-zinc-400">Service</span>
                  <span className="text-right font-bold">
                    {selectedMainService?.title}
                  </span>
                </div>

                <div className="rounded-2xl bg-white/[0.04] p-4">
                  <div className="flex justify-between gap-4">
                    <span className="text-zinc-400">Extra Options</span>
                    <span className="text-right font-bold">
                      {selectedExtras.length}
                    </span>
                  </div>

                  <div className="mt-3 space-y-2">
                    {selectedExtraServices.length > 0 ? (
                      selectedExtraServices.map((service) => (
                        <div
                          key={service.id}
                          className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs"
                        >
                          <span className="min-w-0 break-words font-bold text-zinc-200">
                            {localizeServiceLabel(locale, service.title)}
                          </span>
                          <span className="shrink-0 font-black text-red-300">
                            {service.credits} cr
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs font-bold text-zinc-500">
                        None selected
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex justify-between gap-4 rounded-2xl border border-red-900/40 bg-red-950/25 p-4">
                  <span className="text-zinc-400">Total</span>
                  <span className="text-right text-xl font-black text-red-400">
                    {customerWorkflowT(locale, "creditsCount", { count: totalCredits.toLocaleString(intlLocaleByCode[locale]) })}
                  </span>
                </div>

                <div className={`rounded-2xl border p-4 ${
                  requestIntelligence.status === "ready"
                    ? "border-emerald-700/35 bg-emerald-950/15"
                    : requestIntelligence.status === "needs_attention"
                      ? "border-amber-700/35 bg-amber-950/15"
                      : "border-red-800/40 bg-red-950/15"
                }`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-black uppercase tracking-[0.15em] text-zinc-500">Request Preflight Advisor</div>
                      <div className="mt-1 font-black text-white">{requestIntelligence.label}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-2xl font-black text-white">{requestIntelligence.score}</div>
                      <div className="text-[10px] font-black uppercase text-zinc-600">quality score</div>
                    </div>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-zinc-400">{requestIntelligence.summary}</p>
                  {requestIntelligence.findings.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {requestIntelligence.findings.slice(0, 4).map((finding) => (
                        <div key={finding.key} className="flex items-start gap-2 text-xs">
                          <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${finding.severity === "required" ? "bg-red-400" : finding.severity === "review" ? "bg-amber-300" : "bg-sky-300"}`} />
                          <div className="min-w-0"><span className="font-black text-zinc-200">{finding.label}.</span> <span className="text-zinc-500">{finding.detail}</span></div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-zinc-400">Submit Readiness</span>
                    <span className="text-xs font-black text-red-300">
                      {completedSubmissionChecklistItems}/{submissionChecklist.length}
                    </span>
                  </div>

                  <div className="mt-3 space-y-2">
                    {submissionChecklist.map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-start gap-2 text-xs font-bold ${
                          item.complete ? "text-emerald-200" : "text-zinc-500"
                        }`}
                      >
                        <CheckCircle2
                          className={`mt-0.5 h-4 w-4 shrink-0 ${
                            item.complete ? "text-emerald-300" : "text-zinc-700"
                          }`}
                        />
                        <span className="min-w-0 break-words">{item.label}</span>
                      </div>
                    ))}
                  </div>
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
                  <span>
                    {isZeroCreditRequest
                      ? "I confirm this zero-credit request."
                      : "I accept that the required credits will be used."}
                  </span>
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

                <label className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={abandonedReminderEnabled}
                    disabled={reminderPreferenceSaving}
                    onChange={(event) => void handleReminderPreference(event.target.checked)}
                    className="mt-1"
                  />
                  <span>
                    <strong className="block text-white">Optional request reminder</strong>
                    Send one reminder if I leave this request unfinished. This can be turned off here before submitting.
                  </span>
                </label>
                {reminderPreferenceError && (
                  <p role="status" className="text-xs font-bold leading-5 text-amber-300">
                    {reminderPreferenceError}
                  </p>
                )}
              </div>

              {awaitingConsentAfterSuccess ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="mt-5 rounded-2xl border border-emerald-700/45 bg-emerald-950/25 p-4 text-sm text-emerald-100"
                >
                  <strong className="block text-white">Request created</strong>
                  <button
                    type="button"
                    onClick={() => {
                      if (requestCompletionContinueRef.current) {
                        requestCompletionContinueRef.current();
                        return;
                      }
                      if (!replaceWithPendingMeasurementCompletion("/dashboard")) {
                        window.location.assign("/dashboard");
                      }
                    }}
                    className="mt-3 inline-flex min-h-10 items-center justify-center rounded-lg border border-emerald-600/40 bg-black/25 px-3 font-black text-white transition hover:bg-black/45"
                  >
                    Back to dashboard
                  </button>
                </div>
              ) : message ? (
                <div className="mt-5 rounded-2xl border border-red-800/50 bg-red-950/30 p-4 text-sm text-red-200">
                  {message}
                </div>
              ) : null}

              <button
                onClick={handleSubmit}
                disabled={awaitingConsentAfterSuccess || submitting || !isRequestReadyForSubmit}
                className="mt-6 flex w-full items-center justify-center rounded-xl bg-[#b1121b] px-6 py-4 font-black text-white shadow-xl shadow-red-950/40 transition hover:bg-[#c91824] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {awaitingConsentAfterSuccess ? (
                  <>
                    <CheckCircle2 className="mr-2 h-5 w-5" />
                    Request created
                  </>
                ) : submitting ? (
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
                ) : !isRequestReadyForSubmit ? (
                  <>
                    <CheckCircle2 className="mr-2 h-5 w-5" />
                    Complete Required Steps
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
