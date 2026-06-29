"use client";

import { useEffect, useMemo, useState } from "react";
import { CarFront, CheckCircle2, Cpu, Gauge, Loader2, Search, ShieldCheck, Wrench } from "lucide-react";
import { widgetResultLabels, widgetT, widgetVehicleTypeLabels } from "@/lib/i18n/widget-translations";
import type { WidgetResultLabels } from "@/lib/i18n/widget-translations";
import type { WidgetLanguage, WidgetTheme } from "@/lib/widget/types";

type Option = { value: string; label: string; fuelType?: string | null };
type StageData = { stockHp: number | null; tunedHp: number | null; gainHp: number | null; stockNm: number | null; tunedNm: number | null; gainNm: number | null };
type VehicleResult = {
  vehicleId: string;
  vehicleName: string;
  make: string;
  model: string;
  year: string;
  engine: string;
  fuelType: string | null;
  ecu: string;
  ecuFamilies: string[];
  powerHp: number | null;
  stage1: StageData | null;
  stage2: StageData | null;
  services: string[];
  readMethods: string[];
};
type SelectorConfig = {
  widget_title: string;
  button_text: string;
  main_color: string;
  button_text_color: string;
  difference_color: string;
  theme_mode: WidgetTheme;
  show_branding: boolean;
  language: WidgetLanguage;
};

const demoMakes: Option[] = [
  { value: "bmw", label: "BMW" }, { value: "mercedes", label: "Mercedes-Benz" },
  { value: "audi", label: "Audi" }, { value: "volkswagen", label: "Volkswagen" },
];
const demoModels: Option[] = [{ value: "3-series", label: "3 Series" }, { value: "5-series", label: "5 Series" }];
const demoYears: Option[] = [{ value: "g20", label: "G20 / G21 · 2019 ->" }, { value: "f30", label: "F30 / F31 · 2011 - 2019" }];
const demoEngines: Option[] = [{ value: "320d", label: "320d 190 hp", fuelType: "Diesel" }, { value: "330i", label: "330i 258 hp", fuelType: "Petrol" }];

export function PublicVehicleSelector({
  config,
  publicKey = "",
  sessionToken = "",
  apiBaseUrl = "",
  targetOrigin = "",
  demo = false,
}: {
  config: SelectorConfig;
  publicKey?: string;
  sessionToken?: string;
  apiBaseUrl?: string;
  targetOrigin?: string;
  demo?: boolean;
}) {
  const { language } = config;
  const [makes, setMakes] = useState<Option[]>(demo ? demoMakes : []);
  const [models, setModels] = useState<Option[]>([]);
  const [years, setYears] = useState<Option[]>([]);
  const [engines, setEngines] = useState<Option[]>([]);
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [engine, setEngine] = useState("");
  const [loading, setLoading] = useState(!demo);
  const [unavailable, setUnavailable] = useState(false);
  const [selectedName, setSelectedName] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleResult | null>(null);

  const dark = config.theme_mode === "dark" || config.theme_mode === "auto";
  const queryBase = useMemo(() => {
    const params = new URLSearchParams({ key: publicKey, session: sessionToken, lang: language });
    return params.toString();
  }, [language, publicKey, sessionToken]);

  useEffect(() => {
    if (demo) return;
    const controller = new AbortController();
    fetch(`${apiBaseUrl}/api/widget/makes?${queryBase}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("unavailable");
        return response.json();
      })
      .then((payload) => setMakes(payload.items ?? []))
      .catch((error) => { if (error?.name !== "AbortError") setUnavailable(true); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [apiBaseUrl, demo, queryBase]);

  async function load(path: string, onData: (items: Option[]) => void) {
    if (demo) return;
    setLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}${path}${path.includes("?") ? "&" : "?"}${queryBase}`);
      if (!response.ok) throw new Error("unavailable");
      const payload = await response.json();
      onData(payload.items ?? []);
    } catch {
      setUnavailable(true);
    } finally {
      setLoading(false);
    }
  }

  function selectMake(value: string) {
    setMake(value); setModel(""); setYear(""); setEngine(""); setSelectedName(""); setSelectedVehicle(null);
    setModels(demo ? (value ? demoModels : []) : []); setYears([]); setEngines([]);
    if (value && !demo) void load(`/api/widget/models?make=${encodeURIComponent(value)}`, setModels);
  }
  function selectModel(value: string) {
    setModel(value); setYear(""); setEngine(""); setSelectedName(""); setSelectedVehicle(null);
    setYears(demo ? (value ? demoYears : []) : []); setEngines([]);
    if (value && !demo) void load(`/api/widget/years?make=${encodeURIComponent(make)}&model=${encodeURIComponent(value)}`, setYears);
  }
  function selectYear(value: string) {
    setYear(value); setEngine(""); setSelectedName(""); setSelectedVehicle(null);
    setEngines(demo ? (value ? demoEngines : []) : []);
    if (value && !demo) void load(`/api/widget/engines?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&year=${encodeURIComponent(value)}`, setEngines);
  }

  async function completeSelection() {
    if (!make || !model || !year || !engine) return;
    if (demo) {
      const vehicleName = `${makes.find((item) => item.value === make)?.label} ${models.find((item) => item.value === model)?.label} ${engines.find((item) => item.value === engine)?.label}`;
      setSelectedName(vehicleName);
      setSelectedVehicle({ vehicleId: "demo", vehicleName, make: makes.find((item) => item.value === make)?.label ?? "BMW", model: models.find((item) => item.value === model)?.label ?? "3 Series", year: years.find((item) => item.value === year)?.label ?? "G20", engine: engines.find((item) => item.value === engine)?.label ?? "320d", fuelType: engines.find((item) => item.value === engine)?.fuelType ?? null, ecu: "Bosch MD1CP002", ecuFamilies: ["Bosch MD1CP002"], powerHp: 190, stage1: { stockHp: 190, tunedHp: 225, gainHp: 35, stockNm: 400, tunedNm: 460, gainNm: 60 }, stage2: { stockHp: 190, tunedHp: 250, gainHp: 60, stockNm: 400, tunedNm: 500, gainNm: 100 }, services: ["Stage 1", "Stage 2", "DPF OFF", "EGR OFF", "DTC OFF", "VMAX OFF"], readMethods: ["Autotuner OBD", "Autotuner Bench"] });
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/widget/vehicle-selected`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: publicKey, session: sessionToken, lang: language, make, model, year, engine }),
      });
      if (!response.ok) throw new Error("unavailable");
      const payload = await response.json();
      if (!payload.vehicle) throw new Error("unavailable");
      setSelectedName(payload.vehicle.vehicleName);
      setSelectedVehicle(payload.vehicle as VehicleResult);
      const safeOrigin = targetOrigin || payload.targetOrigin;
      if (safeOrigin && window.parent !== window) window.parent.postMessage({ dataType: "mga-vehicle-data", ...payload.vehicle }, safeOrigin);
      window.dispatchEvent(new CustomEvent("mga-vehicle-data", { detail: payload.vehicle }));
    } catch {
      setUnavailable(true);
    } finally {
      setLoading(false);
    }
  }

  if (unavailable) {
    return <div dir={language === "ar" ? "rtl" : "ltr"} className="flex min-h-56 items-center justify-center rounded-xl border border-zinc-300 bg-white p-8 text-center font-semibold text-zinc-700">{widgetT(language, "unavailable")}</div>;
  }

  const surface = dark ? "bg-[#111317] text-white border-white/10" : "bg-white text-[#15171b] border-zinc-200";
  const input = dark ? "border-white/10 bg-black/35 text-white" : "border-zinc-200 bg-[#f7f8fa] text-zinc-900";
  return (
    <div dir={language === "ar" ? "rtl" : "ltr"} className={`w-full overflow-hidden rounded-xl border shadow-2xl ${surface}`} style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div className="h-1.5 w-full" style={{ background: config.main_color }} />
      <div className="p-5 sm:p-7">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em]" style={{ color: config.difference_color }}><CarFront className="h-4 w-4" />MG AutoTech</div>
            <h2 className="text-2xl font-black">{config.widget_title || widgetT(language, "selectVehicle")}</h2>
          </div>
          {loading && <Loader2 className="h-5 w-5 animate-spin" style={{ color: config.main_color }} />}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Selector label={widgetT(language, "selectVehicleType")} value="car" disabled options={[{ value: "car", label: widgetVehicleTypeLabels[language] }]} className={input} onChange={() => undefined} />
          <Selector label={widgetT(language, "selectMake")} value={make} options={makes} className={input} onChange={selectMake} />
          <Selector label={widgetT(language, "selectModel")} value={model} options={models} disabled={!make} className={input} onChange={selectModel} />
          <Selector label={widgetT(language, "selectYear")} value={year} options={years} disabled={!model} className={input} onChange={selectYear} />
          <div className="sm:col-span-2"><Selector label={widgetT(language, "selectEngine")} value={engine} options={engines} disabled={!year} className={input} onChange={(value) => { setEngine(value); setSelectedName(""); setSelectedVehicle(null); }} /></div>
        </div>

        <button type="button" disabled={!engine || loading} onClick={completeSelection} className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-lg px-5 text-sm font-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45" style={{ background: config.main_color, color: config.button_text_color }}>
          <Search className="h-4 w-4" />{config.button_text || widgetT(language, "showTuningOptions")}
        </button>

        {selectedName && !selectedVehicle && <div className="mt-4 flex items-start gap-3 rounded-lg border p-4 text-sm font-bold" style={{ borderColor: `${config.difference_color}66`, background: `${config.difference_color}12` }}><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: config.difference_color }} /><span>{selectedName}</span></div>}
        {selectedVehicle && <VehicleResultPanel vehicle={selectedVehicle} language={language} accent={config.difference_color} dark={dark} />}
        {config.show_branding && <div className="mt-5 flex items-center justify-center gap-2 text-[11px] font-bold opacity-55"><ShieldCheck className="h-3.5 w-3.5" />{widgetT(language, "poweredBy")}</div>}
      </div>
    </div>
  );
}

function VehicleResultPanel({ vehicle, language, accent, dark }: { vehicle: VehicleResult; language: WidgetLanguage; accent: string; dark: boolean }) {
  const labels = widgetResultLabels[language];
  const stages = [["Stage 1", vehicle.stage1], ["Stage 2", vehicle.stage2]] as const;
  return <section className="mt-5 overflow-hidden rounded-lg border" style={{ borderColor: `${accent}66`, background: `${accent}0d` }}>
    <div className="flex items-start gap-3 border-b p-4" style={{ borderColor: `${accent}44` }}><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: accent }} /><div className="min-w-0"><div className="break-words text-base font-black">{vehicle.vehicleName}</div>{vehicle.fuelType && <div className="mt-1 text-xs opacity-60">{vehicle.fuelType}</div>}</div></div>
    {stages.some(([, data]) => data?.tunedHp || data?.tunedNm) && <div className="p-4"><div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] opacity-60"><Gauge className="h-4 w-4" />{labels.performance}</div><div className="grid gap-3 sm:grid-cols-2">{stages.map(([name, data]) => data && (data.tunedHp || data.tunedNm) ? <StageCard key={name} name={name} data={data} labels={labels} accent={accent} dark={dark} /> : null)}</div></div>}
    {vehicle.services.length > 0 && <div className="border-t p-4" style={{ borderColor: `${accent}33` }}><div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] opacity-60"><Wrench className="h-4 w-4" />{labels.supportedServices}</div><div className="flex flex-wrap gap-2">{vehicle.services.map((service) => <span key={service} className="rounded-md border px-2.5 py-2 text-xs font-black" style={{ borderColor: `${accent}66`, color: accent }}>{service}</span>)}</div></div>}
    {vehicle.ecuFamilies.length > 0 && <div className="border-t p-4" style={{ borderColor: `${accent}33` }}><div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] opacity-60"><Cpu className="h-4 w-4" />{labels.compatibleEcu}</div><div className="text-sm font-bold leading-6 opacity-80">{vehicle.ecuFamilies.join(" · ")}</div></div>}
    <p className="border-t p-4 text-[11px] leading-5 opacity-50" style={{ borderColor: `${accent}33` }}>{labels.technicalDataNotice}</p>
  </section>;
}

function StageCard({ name, data, labels, accent, dark }: { name: string; data: StageData; labels: WidgetResultLabels; accent: string; dark: boolean }) {
  return <div className={`rounded-lg border p-4 ${dark ? "border-white/10 bg-black/25" : "border-zinc-200 bg-white/70"}`}><div className="mb-3 flex items-center justify-between gap-3"><span className="font-black">{name}</span>{data.gainHp !== null && <span className="text-xs font-black" style={{ color: accent }}>+{data.gainHp} HP</span>}</div><div className="grid grid-cols-2 gap-3 text-sm"><PerformanceLine label="HP" stock={data.stockHp} tuned={data.tunedHp} gain={data.gainHp} labels={labels} /><PerformanceLine label="Nm" stock={data.stockNm} tuned={data.tunedNm} gain={data.gainNm} labels={labels} /></div></div>;
}

function PerformanceLine({ label, stock, tuned, gain, labels }: { label: string; stock: number | null; tuned: number | null; gain: number | null; labels: WidgetResultLabels }) {
  return <div><div className="text-[10px] font-black uppercase opacity-45">{label}</div><div className="mt-1 font-black"><span className="opacity-55">{stock ?? "-"}</span><span className="mx-1 opacity-35">→</span><span>{tuned ?? "-"}</span></div><div className="mt-1 text-[10px] opacity-50">{labels.gain}: {gain !== null ? `+${gain}` : "-"}</div></div>;
}

function Selector({ label, value, options, disabled, className, onChange }: { label: string; value: string; options: Option[]; disabled?: boolean; className: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-bold opacity-60">{label}</span><select aria-label={label} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className={`h-12 w-full rounded-lg border px-3 text-sm font-semibold outline-none disabled:cursor-not-allowed disabled:opacity-45 ${className}`}><option value="">{label}</option>{options.map((item) => <option key={item.value} value={item.value}>{item.label}{item.fuelType ? ` · ${item.fuelType}` : ""}</option>)}</select></label>;
}
