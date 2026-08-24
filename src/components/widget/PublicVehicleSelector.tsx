"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowRight, CarFront, CheckCircle2, Cpu, Gauge, Loader2, Mail, MessageCircle, Search, ShieldCheck, Wrench } from "lucide-react";
import { widgetEnquiryLabels, widgetResultLabels, widgetT, widgetVehicleTypeLabels } from "@/lib/i18n/widget-translations";
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
  stage3: StageData | null;
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
  email_enquiries_enabled?: boolean;
  whatsapp_enquiries_enabled?: boolean;
  whatsapp_number?: string | null;
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
  const [selectionError, setSelectionError] = useState("");
  const resultRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (!selectedVehicle) return;

    const timer = window.setTimeout(() => {
      const result = resultRef.current;
      if (!result) return;
      result.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "nearest",
      });
      result.focus({ preventScroll: true });
    }, 80);

    return () => window.clearTimeout(timer);
  }, [selectedVehicle]);

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
    setMake(value); setModel(""); setYear(""); setEngine(""); setSelectedName(""); setSelectedVehicle(null); setSelectionError("");
    setModels(demo ? (value ? demoModels : []) : []); setYears([]); setEngines([]);
    if (value && !demo) void load(`/api/widget/models?make=${encodeURIComponent(value)}`, setModels);
  }
  function selectModel(value: string) {
    setModel(value); setYear(""); setEngine(""); setSelectedName(""); setSelectedVehicle(null); setSelectionError("");
    setYears(demo ? (value ? demoYears : []) : []); setEngines([]);
    if (value && !demo) void load(`/api/widget/years?make=${encodeURIComponent(make)}&model=${encodeURIComponent(value)}`, setYears);
  }
  function selectYear(value: string) {
    setYear(value); setEngine(""); setSelectedName(""); setSelectedVehicle(null); setSelectionError("");
    setEngines(demo ? (value ? demoEngines : []) : []);
    if (value && !demo) void load(`/api/widget/engines?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&year=${encodeURIComponent(value)}`, setEngines);
  }

  async function completeSelection() {
    if (!make || !model || !year || !engine) return;
    setSelectionError("");
    if (demo) {
      const vehicleName = `${makes.find((item) => item.value === make)?.label} ${models.find((item) => item.value === model)?.label} ${engines.find((item) => item.value === engine)?.label}`;
      setSelectedName(vehicleName);
      setSelectedVehicle({ vehicleId: "demo", vehicleName, make: makes.find((item) => item.value === make)?.label ?? "BMW", model: models.find((item) => item.value === model)?.label ?? "3 Series", year: years.find((item) => item.value === year)?.label ?? "G20", engine: engines.find((item) => item.value === engine)?.label ?? "320d", fuelType: engines.find((item) => item.value === engine)?.fuelType ?? null, ecu: "Bosch MD1CP002", ecuFamilies: ["Bosch MD1CP002"], powerHp: 190, stage1: { stockHp: 190, tunedHp: 225, gainHp: 35, stockNm: 400, tunedNm: 460, gainNm: 60 }, stage2: { stockHp: 190, tunedHp: 250, gainHp: 60, stockNm: 400, tunedNm: 500, gainNm: 100 }, stage3: null, services: ["Stage 1", "Stage 2", "DPF OFF", "EGR OFF", "DTC OFF", "VMAX OFF"], readMethods: ["Autotuner OBD", "Autotuner Bench"] });
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
      setSelectedName("");
      setSelectedVehicle(null);
      setSelectionError(widgetT(language, "unavailable"));
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
          <div className="sm:col-span-2"><Selector label={widgetT(language, "selectEngine")} value={engine} options={engines} disabled={!year} className={input} onChange={(value) => { setEngine(value); setSelectedName(""); setSelectedVehicle(null); setSelectionError(""); }} /></div>
        </div>

        <button type="button" disabled={!engine || loading} onClick={completeSelection} className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-lg px-5 text-sm font-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45" style={{ background: config.main_color, color: config.button_text_color }}>
          <Search className="h-4 w-4" />{config.button_text || widgetT(language, "showTuningOptions")}
        </button>

        {selectionError && <div role="alert" className="mt-4 rounded-lg border p-4 text-sm font-bold" style={{ borderColor: `${config.difference_color}66`, background: `${config.difference_color}12`, color: config.difference_color }}>{selectionError}</div>}

        {selectedName && !selectedVehicle && <div className="mt-4 flex items-start gap-3 rounded-lg border p-4 text-sm font-bold" style={{ borderColor: `${config.difference_color}66`, background: `${config.difference_color}12` }}><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: config.difference_color }} /><span>{selectedName}</span></div>}
        {selectedVehicle && <div ref={resultRef} tabIndex={-1} className="scroll-mt-4 outline-none"><VehicleResultPanel key={selectedVehicle.vehicleId} vehicle={selectedVehicle} language={language} accent={config.difference_color} dark={dark} emailEnabled={config.email_enquiries_enabled ?? demo} whatsappEnabled={Boolean(config.whatsapp_enquiries_enabled && config.whatsapp_number)} whatsappNumber={config.whatsapp_number} publicKey={publicKey} sessionToken={sessionToken} apiBaseUrl={apiBaseUrl} selection={{ make, model, year, engine }} demo={demo} /></div>}
        {config.show_branding && <div className="mt-5 flex items-center justify-center gap-2 text-[11px] font-bold opacity-55"><ShieldCheck className="h-3.5 w-3.5" />{widgetT(language, "poweredBy")}</div>}
      </div>
    </div>
  );
}

function VehicleResultPanel({ vehicle, language, accent, dark, emailEnabled, whatsappEnabled, whatsappNumber, publicKey, sessionToken, apiBaseUrl, selection, demo }: { vehicle: VehicleResult; language: WidgetLanguage; accent: string; dark: boolean; emailEnabled: boolean; whatsappEnabled: boolean; whatsappNumber?: string | null; publicKey: string; sessionToken: string; apiBaseUrl: string; selection: { make: string; model: string; year: string; engine: string }; demo: boolean }) {
  const labels = widgetResultLabels[language];
  const enquiry = widgetEnquiryLabels[language];
  const availableStages = ([
    { key: "stage1", label: "Stage 1", data: vehicle.stage1 },
    { key: "stage2", label: "Stage 2", data: vehicle.stage2 },
    { key: "stage3", label: "Stage 3", data: vehicle.stage3 },
  ] as const).filter((stage) => stage.data && (stage.data.tunedHp !== null || stage.data.tunedNm !== null));
  const initialStage = availableStages[0]?.key ?? "stage1";
  const [activeStage, setActiveStage] = useState<"stage1" | "stage2" | "stage3">(initialStage);
  const selectedStage = availableStages.find((stage) => stage.key === activeStage) ?? availableStages[0];
  const extraServices = vehicle.services.filter((service) => !/^stage\s*[123]$/i.test(service.trim()));
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [contactMode, setContactMode] = useState<"closed" | "choose" | "email" | "success">("closed");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", location: "", registration: "", message: "", website: "" });
  const contactEnabled = emailEnabled || whatsappEnabled;

  function toggleService(service: string) {
    setSelectedServices((current) => current.includes(service) ? current.filter((item) => item !== service) : [...current, service]);
  }

  function openWhatsApp() {
    if (!whatsappNumber) return;
    const stage = selectedStage?.label ?? "Stage 1";
    const performance = selectedStage?.data;
    const lines = [
      vehicle.vehicleName,
      stage,
      performance ? `${enquiryLabelsLine(labels.power, performance.stockHp, performance.tunedHp, "HP")}` : "",
      performance ? `${enquiryLabelsLine(labels.torque, performance.stockNm, performance.tunedNm, "Nm")}` : "",
      selectedServices.length ? `${labels.supportedServices}: ${selectedServices.join(", ")}` : "",
    ].filter(Boolean);
    const detail = { dataType: "mga-vehicle-enquiry", ...vehicle, stage, selectedServices };
    window.dispatchEvent(new CustomEvent("mga-vehicle-enquiry", { detail }));
    const number = whatsappNumber.replace(/\D/g, "");
    if (number) window.open(`https://wa.me/${number}?text=${encodeURIComponent(lines.join("\n"))}`, "_blank", "noopener,noreferrer");
  }

  function requestOffer() {
    if (emailEnabled && whatsappEnabled) setContactMode("choose");
    else if (emailEnabled) setContactMode("email");
    else if (whatsappEnabled) openWhatsApp();
  }

  async function submitEnquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedStage) return;
    setSubmitting(true); setFormError("");
    if (demo) {
      setContactMode("success"); setSubmitting(false); return;
    }
    try {
      const response = await fetch(`${apiBaseUrl}/api/widget/enquiry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: publicKey, session: sessionToken, lang: language, ...selection, stage: selectedStage.label, selectedServices, ...form }),
      });
      if (!response.ok) throw new Error("delivery_failed");
      setContactMode("success");
    } catch {
      setFormError(enquiry.enquiryFailed);
    } finally {
      setSubmitting(false);
    }
  }

  return <section className="mt-5 overflow-hidden rounded-lg border" style={{ borderColor: `${accent}66`, background: `${accent}0d` }}>
    <div className="flex items-start gap-3 border-b p-4" style={{ borderColor: `${accent}44` }}><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: accent }} /><div className="min-w-0"><div className="break-words text-base font-black">{vehicle.vehicleName}</div>{vehicle.fuelType && <div className="mt-1 text-xs opacity-60">{vehicle.fuelType}</div>}</div></div>
    {selectedStage?.data && <div className="p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] opacity-60"><Gauge className="h-4 w-4" />{labels.performance}</div>
      <div className="mb-3 flex flex-wrap gap-2">{availableStages.map((stage) => <button type="button" key={stage.key} onClick={() => setActiveStage(stage.key)} className="rounded-md border px-3 py-2 text-xs font-black transition" style={stage.key === selectedStage.key ? { background: accent, borderColor: accent, color: dark ? "#071006" : "#ffffff" } : { borderColor: `${accent}55`, color: accent }}>{stage.label}</button>)}</div>
      <div className={`overflow-hidden rounded-lg border ${dark ? "border-white/10 bg-black/25" : "border-zinc-200 bg-white/75"}`}>
        <PerformanceRow label={labels.power} unit="HP" stock={selectedStage.data.stockHp} tuned={selectedStage.data.tunedHp} gain={selectedStage.data.gainHp} accent={accent} />
        <PerformanceRow label={labels.torque} unit="Nm" stock={selectedStage.data.stockNm} tuned={selectedStage.data.tunedNm} gain={selectedStage.data.gainNm} accent={accent} bordered />
      </div>
    </div>}
    {!selectedStage && <div className="p-4"><div className={`rounded-lg border p-4 ${dark ? "border-white/10 bg-black/25" : "border-zinc-200 bg-white/75"}`}><div className="text-sm font-black">{labels.performanceReview}</div><p className="mt-2 text-xs leading-5 opacity-60">{labels.performanceReviewText}</p></div></div>}
    {extraServices.length > 0 && <div className="border-t p-4" style={{ borderColor: `${accent}33` }}><div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] opacity-60"><Wrench className="h-4 w-4" />{labels.supportedServices}</div><div className="grid gap-2">{extraServices.map((service) => <label key={service} className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm font-bold ${selectedServices.includes(service) ? "bg-white/[0.04]" : ""}`} style={{ borderColor: selectedServices.includes(service) ? `${accent}88` : `${accent}25` }}><input type="checkbox" checked={selectedServices.includes(service)} onChange={() => toggleService(service)} className="h-4 w-4 shrink-0" style={{ accentColor: accent }} /><span>{service}</span></label>)}</div></div>}
    {vehicle.ecuFamilies.length > 0 && <div className="border-t p-4" style={{ borderColor: `${accent}33` }}><div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] opacity-60"><Cpu className="h-4 w-4" />{labels.compatibleEcu}</div><div className="text-sm font-bold leading-6 opacity-80">{vehicle.ecuFamilies.join(" · ")}</div></div>}
    {contactEnabled && contactMode === "closed" && <div className="border-t p-4" style={{ borderColor: `${accent}33` }}><button type="button" onClick={requestOffer} className="flex h-12 w-full items-center justify-center gap-2 rounded-lg text-sm font-black transition hover:brightness-110" style={{ background: accent, color: dark ? "#071006" : "#ffffff" }}><MessageCircle className="h-4 w-4" />{labels.requestOffer}</button></div>}
    {contactMode === "choose" && <div className="border-t p-4" style={{ borderColor: `${accent}33` }}><div className="mb-3 text-sm font-black">{enquiry.chooseContact}</div><div className="grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => setContactMode("email")} className="flex h-12 items-center justify-center gap-2 rounded-lg border text-sm font-black" style={{ borderColor: `${accent}66` }}><Mail className="h-4 w-4" />{enquiry.continueByEmail}</button><button type="button" onClick={openWhatsApp} className="flex h-12 items-center justify-center gap-2 rounded-lg text-sm font-black" style={{ background: accent, color: dark ? "#071006" : "#ffffff" }}><MessageCircle className="h-4 w-4" />{enquiry.continueByWhatsapp}</button></div></div>}
    {contactMode === "email" && <form onSubmit={submitEnquiry} className="relative space-y-3 border-t p-4" style={{ borderColor: `${accent}33` }}><div className="flex items-center justify-between gap-3"><div><div className="text-sm font-black">{labels.requestOffer}</div><div className="mt-1 text-[11px] opacity-50">{enquiry.requiredNote}</div></div><button type="button" onClick={() => setContactMode("closed")} className="h-9 w-9 rounded-md border text-lg" style={{ borderColor: `${accent}44` }} aria-label="Close">×</button></div><div className="grid gap-3 sm:grid-cols-2"><EnquiryInput label={enquiry.name} value={form.name} maxLength={120} onChange={(value) => setForm((current) => ({ ...current, name: value }))} required /><EnquiryInput label={enquiry.emailAddress} value={form.email} maxLength={250} onChange={(value) => setForm((current) => ({ ...current, email: value }))} type="email" required /><EnquiryInput label={enquiry.phone} value={form.phone} maxLength={40} onChange={(value) => setForm((current) => ({ ...current, phone: value }))} /><EnquiryInput label={enquiry.location} value={form.location} maxLength={160} onChange={(value) => setForm((current) => ({ ...current, location: value }))} /><div className="sm:col-span-2"><EnquiryInput label={enquiry.vehicleRegistration} value={form.registration} maxLength={80} onChange={(value) => setForm((current) => ({ ...current, registration: value }))} /></div></div><label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.1em] opacity-50">{enquiry.additionalInformation}</span><textarea value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} rows={4} maxLength={2000} className={`w-full resize-y rounded-lg border p-3 text-sm outline-none ${dark ? "border-white/10 bg-black/30" : "border-zinc-200 bg-white"}`} /></label><input tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website} onChange={(event) => setForm((current) => ({ ...current, website: event.target.value }))} className="absolute h-0 w-0 overflow-hidden opacity-0" />{formError && <div className="text-xs font-bold text-red-400">{formError}</div>}<button type="submit" disabled={submitting} className="flex h-12 w-full items-center justify-center gap-2 rounded-lg text-sm font-black disabled:opacity-50" style={{ background: accent, color: dark ? "#071006" : "#ffffff" }}>{submitting ? <><Loader2 className="h-4 w-4 animate-spin" />{enquiry.sending}</> : <><Mail className="h-4 w-4" />{enquiry.sendEnquiry}</>}</button></form>}
    {contactMode === "success" && <div className="border-t p-5 text-center" style={{ borderColor: `${accent}33` }}><CheckCircle2 className="mx-auto h-8 w-8" style={{ color: accent }} /><div className="mt-3 text-sm font-black">{enquiry.enquirySent}</div></div>}
    <p className="border-t p-4 text-[11px] leading-5 opacity-50" style={{ borderColor: `${accent}33` }}>{labels.technicalDataNotice}</p>
  </section>;
}

function enquiryLabelsLine(label: string, stock: number | null, tuned: number | null, unit: string) {
  return `${label}: ${stock ?? "-"} -> ${tuned ?? "-"} ${unit}`;
}

function EnquiryInput({ label, value, onChange, type = "text", required = false, maxLength = 250 }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; maxLength?: number }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.1em] opacity-50">{label}{required ? " *" : ""}</span><input type={type} value={value} required={required} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-lg border bg-black/[0.04] px-3 text-sm outline-none" style={{ borderColor: "rgba(127,127,127,.25)" }} /></label>;
}

function PerformanceRow({ label, unit, stock, tuned, gain, accent, bordered = false }: { label: string; unit: string; stock: number | null; tuned: number | null; gain: number | null; accent: string; bordered?: boolean }) {
  return <div className={`grid grid-cols-[minmax(72px,0.7fr)_minmax(0,1.8fr)] items-center gap-3 p-4 ${bordered ? "border-t border-inherit" : ""}`}>
    <div className="text-[10px] font-black uppercase tracking-[0.1em] opacity-50">{label}</div>
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-right"><span className="text-lg font-bold opacity-60">{stock ?? "-"}</span><ArrowRight className="h-4 w-4 opacity-35" /><span className="text-xl font-black">{tuned ?? "-"} <small className="text-[10px] font-black opacity-55">{unit}</small></span><span className="col-start-3 text-xs font-black" style={{ color: accent }}>{gain !== null ? `+${gain}` : "-"}</span></div>
  </div>;
}

function Selector({ label, value, options, disabled, className, onChange }: { label: string; value: string; options: Option[]; disabled?: boolean; className: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-bold opacity-60">{label}</span><select aria-label={label} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className={`h-12 w-full rounded-lg border px-3 text-sm font-semibold outline-none disabled:cursor-not-allowed disabled:opacity-45 ${className}`}><option value="">{label}</option>{options.map((item) => <option key={item.value} value={item.value}>{item.label}{item.fuelType ? ` · ${item.fuelType}` : ""}</option>)}</select></label>;
}
