"use client";

import { useEffect, useMemo, useState } from "react";
import { CarFront, CheckCircle2, Loader2, Search, ShieldCheck } from "lucide-react";
import { widgetT, widgetVehicleTypeLabels } from "@/lib/i18n/widget-translations";
import type { WidgetLanguage, WidgetTheme } from "@/lib/widget/types";

type Option = { value: string; label: string; fuelType?: string | null };
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
    setMake(value); setModel(""); setYear(""); setEngine(""); setSelectedName("");
    setModels(demo ? (value ? demoModels : []) : []); setYears([]); setEngines([]);
    if (value && !demo) void load(`/api/widget/models?make=${encodeURIComponent(value)}`, setModels);
  }
  function selectModel(value: string) {
    setModel(value); setYear(""); setEngine(""); setSelectedName("");
    setYears(demo ? (value ? demoYears : []) : []); setEngines([]);
    if (value && !demo) void load(`/api/widget/years?make=${encodeURIComponent(make)}&model=${encodeURIComponent(value)}`, setYears);
  }
  function selectYear(value: string) {
    setYear(value); setEngine(""); setSelectedName("");
    setEngines(demo ? (value ? demoEngines : []) : []);
    if (value && !demo) void load(`/api/widget/engines?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&year=${encodeURIComponent(value)}`, setEngines);
  }

  async function completeSelection() {
    if (!make || !model || !year || !engine) return;
    if (demo) {
      setSelectedName(`${makes.find((item) => item.value === make)?.label} ${models.find((item) => item.value === model)?.label} ${engines.find((item) => item.value === engine)?.label}`);
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
          <div className="sm:col-span-2"><Selector label={widgetT(language, "selectEngine")} value={engine} options={engines} disabled={!year} className={input} onChange={(value) => { setEngine(value); setSelectedName(""); }} /></div>
        </div>

        <button type="button" disabled={!engine || loading} onClick={completeSelection} className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-lg px-5 text-sm font-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45" style={{ background: config.main_color, color: config.button_text_color }}>
          <Search className="h-4 w-4" />{config.button_text || widgetT(language, "showTuningOptions")}
        </button>

        {selectedName && <div className="mt-4 flex items-start gap-3 rounded-lg border p-4 text-sm font-bold" style={{ borderColor: `${config.difference_color}66`, background: `${config.difference_color}12` }}><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: config.difference_color }} /><span>{selectedName}</span></div>}
        {config.show_branding && <div className="mt-5 flex items-center justify-center gap-2 text-[11px] font-bold opacity-55"><ShieldCheck className="h-3.5 w-3.5" />{widgetT(language, "poweredBy")}</div>}
      </div>
    </div>
  );
}

function Selector({ label, value, options, disabled, className, onChange }: { label: string; value: string; options: Option[]; disabled?: boolean; className: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-bold opacity-60">{label}</span><select aria-label={label} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className={`h-12 w-full rounded-lg border px-3 text-sm font-semibold outline-none disabled:cursor-not-allowed disabled:opacity-45 ${className}`}><option value="">{label}</option>{options.map((item) => <option key={item.value} value={item.value}>{item.label}{item.fuelType ? ` · ${item.fuelType}` : ""}</option>)}</select></label>;
}
