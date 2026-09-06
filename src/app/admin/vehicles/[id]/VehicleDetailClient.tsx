"use client";

import { AdminMobileSectionJump } from "@/components/admin/AdminMobileSectionJump";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Cpu, Gauge, Loader2, RefreshCcw, RotateCcw, Save, ShieldAlert, Wrench } from "lucide-react";
import { authenticatedFetch } from "@/lib/authGuards";
import { calculatePerformanceGain, calculateTunedFromGain, isWholePerformanceInput } from "@/lib/vehicleControl/performance";
import type { VehicleControlRecord, VehiclePerformanceStage, VehicleServiceKey } from "@/lib/vehicleControl/types";
import type { PublicVehicleCatalogSyncResult } from "@/lib/vehicleControl/types";
import { vehiclePerformanceStages, vehicleServiceKeys, vehicleServiceLabels } from "@/lib/vehicleControl/types";

type DetailPayload = {
  record: VehicleControlRecord;
  audit: Array<Record<string, unknown>>;
  validations: Array<Record<string, unknown>>;
  publicCatalogSync?: PublicVehicleCatalogSyncResult;
};

type StageForm = { tunedHp: string; tunedNm: string; active: boolean };

type FormState = {
  brand: string;
  model: string;
  generation: string;
  engine: string;
  displayName: string;
  yearFrom: string;
  yearTo: string;
  fuelType: string;
  displacementCc: string;
  stockHp: string;
  stockNm: string;
  stageProfiles: Record<VehiclePerformanceStage, StageForm>;
  ecuVariantId: string;
  ecuFamily: string;
  ecuType: string;
  ecuHardware: string;
  ecuSoftware: string;
  ecuNotes: string;
  protectionNotes: string;
  unlockNotes: string;
  gearboxType: string;
  tcuType: string;
  tcuNotes: string;
  services: VehicleServiceKey[];
  customerSafeNotes: string;
  adminTechnicalNotes: string;
  confidenceScore: string;
  verificationStatus: VehicleControlRecord["verificationStatus"];
  published: boolean;
  active: boolean;
};

type Notice = { kind: "success" | "warning" | "error"; text: string } | null;

const stageLabels: Record<VehiclePerformanceStage, string> = { stage1: "Stage 1", stage2: "Stage 2", stage3: "Stage 3" };
const otherServiceKeys = vehicleServiceKeys.filter(
  (service): service is Exclude<VehicleServiceKey, VehiclePerformanceStage> => !vehiclePerformanceStages.includes(service as VehiclePerformanceStage),
);

function formFromRecord(record: VehicleControlRecord): FormState {
  const stageServices = new Set<VehicleServiceKey>(record.services);
  for (const profile of record.performanceProfiles ?? []) {
    if (profile.active) stageServices.add(profile.stage);
    else stageServices.delete(profile.stage);
  }

  function stage(stageKey: VehiclePerformanceStage): StageForm {
    const profile = record.performanceProfiles?.find((item) => item.stage === stageKey);
    return {
      tunedHp: profile?.tunedHp == null ? stageKey === "stage1" && record.tunedHp != null ? String(record.tunedHp) : "" : String(profile.tunedHp),
      tunedNm: profile?.tunedNm == null ? stageKey === "stage1" && record.tunedNm != null ? String(record.tunedNm) : "" : String(profile.tunedNm),
      active: stageServices.has(stageKey),
    };
  }
  return {
    brand: record.brand,
    model: record.model,
    generation: record.generation,
    engine: record.engine,
    displayName: record.displayName,
    yearFrom: record.yearFrom == null ? "" : String(record.yearFrom),
    yearTo: record.yearTo == null ? "" : String(record.yearTo),
    fuelType: record.fuelType ?? "",
    displacementCc: record.displacementCc == null ? "" : String(record.displacementCc),
    stockHp: record.stockHp == null ? "" : String(record.stockHp),
    stockNm: record.stockNm == null ? "" : String(record.stockNm),
    stageProfiles: { stage1: stage("stage1"), stage2: stage("stage2"), stage3: stage("stage3") },
    ecuVariantId: record.ecuVariantId ?? "",
    ecuFamily: record.ecuFamily ?? "",
    ecuType: record.ecuType ?? "",
    ecuHardware: record.ecuHardware ?? "",
    ecuSoftware: record.ecuSoftware ?? "",
    ecuNotes: record.ecuNotes ?? "",
    protectionNotes: record.protectionNotes ?? "",
    unlockNotes: record.unlockNotes ?? "",
    gearboxType: record.gearboxType ?? "",
    tcuType: record.tcuType ?? "",
    tcuNotes: record.tcuNotes ?? "",
    services: [...stageServices],
    customerSafeNotes: record.customerSafeNotes ?? "",
    adminTechnicalNotes: record.adminTechnicalNotes ?? "",
    confidenceScore: String(record.confidenceScore ?? 60),
    verificationStatus: record.verificationStatus,
    published: record.published,
    active: record.active,
  };
}

function numberOrNull(value: string) {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function VehicleDetailClient({ id }: { id: string }) {
  const [payload, setPayload] = useState<DetailPayload | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [savedForm, setSavedForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingCatalog, setSyncingCatalog] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const authFetch = useCallback((url: string, init?: RequestInit) => authenticatedFetch(url, init), []);

  const load = useCallback(async () => {
    setLoading(true);
    setNotice(null);
    try {
      const response = await authFetch(`/api/admin/vehicles/${id}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Vehicle could not be loaded.");
      const nextForm = formFromRecord(data.record);
      setPayload(data);
      setForm(nextForm);
      setSavedForm(nextForm);
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Vehicle could not be loaded." });
    } finally {
      setLoading(false);
    }
  }, [authFetch, id]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const dirty = useMemo(() => Boolean(form && savedForm && JSON.stringify(form) !== JSON.stringify(savedForm)), [form, savedForm]);
  useEffect(() => {
    function protectUnsavedChanges(event: BeforeUnloadEvent) {
      if (!dirty) return;
      event.preventDefault();
    }
    window.addEventListener("beforeunload", protectUnsavedChanges);
    return () => window.removeEventListener("beforeunload", protectUnsavedChanges);
  }, [dirty]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => current ? { ...current, [key]: value } : current);
  }

  function updateStage(stage: VehiclePerformanceStage, field: keyof StageForm, value: string | boolean) {
    setForm((current) => current ? {
      ...current,
      stageProfiles: { ...current.stageProfiles, [stage]: { ...current.stageProfiles[stage], [field]: value } },
    } : current);
  }

  function updateStageGain(stage: VehiclePerformanceStage, output: "hp" | "nm", value: string) {
    if (!isWholePerformanceInput(value)) {
      setNotice({ kind: "error", text: "Stage gain must be a whole HP/Nm number." });
      return;
    }
    setNotice(null);
    setForm((current) => {
      if (!current) return current;
      const stock = numberOrNull(output === "hp" ? current.stockHp : current.stockNm);
      const requestedGain = numberOrNull(value);
      const tuned = value.trim() === "" ? "" : calculateTunedFromGain(stock, requestedGain);
      if (tuned === null) return current;
      const field = output === "hp" ? "tunedHp" : "tunedNm";
      return {
        ...current,
        stageProfiles: {
          ...current.stageProfiles,
          [stage]: { ...current.stageProfiles[stage], [field]: tuned === "" ? "" : String(tuned) },
        },
      };
    });
  }

  function toggleStage(stage: VehiclePerformanceStage) {
    setForm((current) => {
      if (!current) return current;
      const active = !current.stageProfiles[stage].active;
      return {
        ...current,
        stageProfiles: { ...current.stageProfiles, [stage]: { ...current.stageProfiles[stage], active } },
        services: active ? [...new Set([...current.services, stage])] : current.services.filter((item) => item !== stage),
      };
    });
  }

  function toggleService(service: VehicleServiceKey) {
    if (!form) return;
    update("services", form.services.includes(service) ? form.services.filter((item) => item !== service) : [...form.services, service]);
  }

  function reset() {
    if (!savedForm) return;
    setForm(savedForm);
    setNotice(null);
  }

  async function save() {
    if (!form || saving || syncingCatalog) return;
    setSaving(true);
    setNotice(null);
    try {
      const performanceInputs = [
        form.stockHp,
        form.stockNm,
        ...vehiclePerformanceStages.flatMap((stage) => [form.stageProfiles[stage].tunedHp, form.stageProfiles[stage].tunedNm]),
      ];
      if (!performanceInputs.every(isWholePerformanceInput)) {
        throw new Error("Stock, Stage output and gain values must be whole HP/Nm numbers.");
      }
      const stage1 = form.stageProfiles.stage1;
      const response = await authFetch(`/api/admin/vehicles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: form.brand,
          model: form.model,
          generation: form.generation,
          engine: form.engine,
          displayName: form.displayName || null,
          yearFrom: numberOrNull(form.yearFrom),
          yearTo: numberOrNull(form.yearTo),
          fuelType: form.fuelType || null,
          displacementCc: numberOrNull(form.displacementCc),
          stockHp: numberOrNull(form.stockHp),
          stockNm: numberOrNull(form.stockNm),
          tunedHp: numberOrNull(stage1.tunedHp),
          tunedNm: numberOrNull(stage1.tunedNm),
          performanceProfiles: vehiclePerformanceStages.map((stage) => ({
            stage,
            tunedHp: numberOrNull(form.stageProfiles[stage].tunedHp),
            tunedNm: numberOrNull(form.stageProfiles[stage].tunedNm),
            active: form.stageProfiles[stage].active,
          })),
          ecuVariantId: form.ecuVariantId || null,
          ecuFamily: form.ecuFamily || null,
          ecuType: form.ecuType || null,
          ecuHardware: form.ecuHardware || null,
          ecuSoftware: form.ecuSoftware || null,
          ecuNotes: form.ecuNotes || null,
          protectionNotes: form.protectionNotes || null,
          unlockNotes: form.unlockNotes || null,
          gearboxType: form.gearboxType || null,
          tcuType: form.tcuType || null,
          tcuNotes: form.tcuNotes || null,
          services: form.services,
          customerSafeNotes: form.customerSafeNotes || null,
          adminTechnicalNotes: form.adminTechnicalNotes || null,
          confidenceScore: Number(form.confidenceScore || 0),
          verificationStatus: form.verificationStatus,
          published: form.published,
          active: form.active,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        const firstIssue = Array.isArray(data.issues) ? data.issues[0]?.message : null;
        throw new Error(firstIssue || data.error || "Vehicle could not be saved.");
      }
      const nextForm = formFromRecord(data.record);
      setPayload(data);
      setForm(nextForm);
      setSavedForm(nextForm);
      if (data.publicCatalogSync?.ok === false) {
        setNotice({
          kind: "warning",
          text: `Vehicle, ECU and Stage data were saved, but the customer catalog could not be synchronized: ${data.publicCatalogSync.error}`,
        });
      } else {
        setNotice({
          kind: "success",
          text: form.published
            ? "Vehicle, ECU and Stage data saved and synchronized to customers."
            : "Vehicle, ECU and Stage data saved; the customer catalog was synchronized.",
        });
      }
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Vehicle could not be saved." });
    } finally {
      setSaving(false);
    }
  }

  async function retryCatalogSync() {
    if (syncingCatalog || saving) return;
    setSyncingCatalog(true);
    try {
      const response = await authFetch("/api/admin/vehicles/catalog-cache/rebuild", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Customer catalog could not be synchronized.");
      setNotice({ kind: "success", text: "Customer catalog synchronized successfully." });
    } catch (error) {
      setNotice({
        kind: "warning",
        text: `Vehicle data is saved, but customer catalog sync still failed: ${error instanceof Error ? error.message : "Please try again."}`,
      });
    } finally {
      setSyncingCatalog(false);
    }
  }

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-[#050505] text-white"><Loader2 className="mr-3 h-5 w-5 animate-spin text-red-500" />Loading vehicle record...</main>;

  if (!form || !payload) return <main className="flex min-h-screen items-center justify-center bg-[#050505] p-6 text-white">
    <div className="w-full max-w-lg rounded-2xl border border-red-900/50 bg-red-950/15 p-6 text-center" role="alert">
      <ShieldAlert className="mx-auto h-8 w-8 text-red-400" />
      <h1 className="mt-4 text-xl font-black">Vehicle record could not be opened</h1>
      <p className="mt-2 text-sm text-red-100">{notice?.text || "Please try again."}</p>
      <div className="mt-5 flex justify-center gap-2"><Link href="/admin/vehicles" className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black">Back</Link><button onClick={() => void load()} className="rounded-xl bg-[#b1121b] px-4 py-3 text-sm font-black">Try again</button></div>
    </div>
  </main>;

  return <main className="mg-compact-ui min-h-screen bg-[#050505] pb-40 text-white sm:pb-24">
    <header className="border-b border-white/10 bg-black/90">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <Link href="/admin/vehicles" className="text-sm font-bold text-zinc-500 hover:text-white"><ArrowLeft className="mr-2 inline h-4 w-4" />Vehicle catalog</Link>
          <div className="mt-3 flex flex-wrap items-center gap-2"><h1 className="min-w-0 break-words text-xl font-black md:text-2xl">{payload.record.displayName}</h1><StatusBadge status={form.published ? "Published" : form.active ? "Draft" : "Archived"} positive={form.published} /></div>
          <p className="mt-1 break-all text-xs text-zinc-600">{payload.record.vehicleKey}</p>
        </div>
        <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">{dirty && <span className="text-xs font-black text-amber-300">Unsaved changes</span>}<button onClick={reset} disabled={!dirty || saving || syncingCatalog} className="h-11 rounded-xl border border-white/10 px-4 text-sm font-black text-zinc-300 disabled:opacity-40"><RotateCcw className="mr-2 inline h-4 w-4" />Reset</button><button onClick={() => void save()} disabled={!dirty || saving || syncingCatalog} className="h-11 rounded-xl bg-[#b1121b] px-5 text-sm font-black hover:bg-[#c91824] disabled:opacity-40">{saving ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : <Save className="mr-2 inline h-4 w-4" />}Save</button></div>
      </div>
    </header>

    <AdminMobileSectionJump sections={[{ id: "vehicle", label: "Vehicle" }, { id: "stages", label: "Stage 1–2–3" }, { id: "ecu", label: "ECU & gearbox" }, { id: "services", label: "Services" }, { id: "notes", label: "Notes" }, { id: "publish", label: "Publish & quality" }]} />
    <nav aria-label="Vehicle editor sections" className="sticky top-0 z-20 border-b border-white/10 bg-[#080808]/95 backdrop-blur"><div className="mx-auto flex max-w-[1440px] gap-2 overflow-x-auto px-4 py-2 text-sm font-black"><a href="#vehicle" className="shrink-0 rounded-lg px-3 py-2 text-zinc-300 hover:bg-white/10">Vehicle</a><a href="#stages" className="shrink-0 rounded-lg px-3 py-2 text-zinc-300 hover:bg-white/10">Stage 1–2–3</a><a href="#ecu" className="shrink-0 rounded-lg px-3 py-2 text-zinc-300 hover:bg-white/10">ECU & gearbox</a><a href="#services" className="shrink-0 rounded-lg px-3 py-2 text-zinc-300 hover:bg-white/10">Services</a><a href="#publish" className="shrink-0 rounded-lg px-3 py-2 text-zinc-300 hover:bg-white/10">Publish</a></div></nav>

    <div className="mx-auto grid max-w-[1440px] gap-5 px-4 py-5 xl:grid-cols-[minmax(0,1fr)_330px]">
      <div className="min-w-0 space-y-5">
        {notice && <div role={notice.kind === "error" ? "alert" : "status"} aria-live="polite" className={`rounded-xl border p-4 text-sm font-bold ${notice.kind === "error" ? "border-red-800/50 bg-red-950/20 text-red-100" : notice.kind === "warning" ? "border-amber-800/50 bg-amber-950/20 text-amber-100" : "border-emerald-800/50 bg-emerald-950/20 text-emerald-200"}`}>{notice.text}</div>}

        <EditorSection id="vehicle" icon={<Gauge />} title="Vehicle" description="Brand, model, generation and stock engine data.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Brand" value={form.brand} onChange={(value) => update("brand", value)} required /><Field label="Model" value={form.model} onChange={(value) => update("model", value)} required /><Field label="Generation" value={form.generation} onChange={(value) => update("generation", value)} required /><Field label="Engine" value={form.engine} onChange={(value) => update("engine", value)} required />
            <div className="sm:col-span-2"><Field label="Display name" value={form.displayName} onChange={(value) => update("displayName", value)} /></div><Field label="Fuel type" value={form.fuelType} onChange={(value) => update("fuelType", value)} /><Field label="Displacement (cc)" value={form.displacementCc} onChange={(value) => update("displacementCc", value)} type="number" />
            <Field label="Year from" value={form.yearFrom} onChange={(value) => update("yearFrom", value)} type="number" /><Field label="Year to" value={form.yearTo} onChange={(value) => update("yearTo", value)} type="number" /><Field label="Stock HP" value={form.stockHp} onChange={(value) => update("stockHp", value)} type="number" /><Field label="Stock Nm" value={form.stockNm} onChange={(value) => update("stockNm", value)} type="number" />
          </div>
        </EditorSection>

        <EditorSection id="stages" icon={<Gauge />} title="Stage performance" description="Enter the after-tuning output or edit the gain directly. Both stay synchronized and the server verifies the final values.">
          <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-md"><ValueCard label="Stock power" value={form.stockHp ? `${form.stockHp} HP` : "Not set"} /><ValueCard label="Stock torque" value={form.stockNm ? `${form.stockNm} Nm` : "Not set"} /></div>
          <div className="grid gap-4 lg:grid-cols-3">{vehiclePerformanceStages.map((stage) => {
            const profile = form.stageProfiles[stage];
            const hpGain = calculatePerformanceGain(numberOrNull(form.stockHp), numberOrNull(profile.tunedHp));
            const nmGain = calculatePerformanceGain(numberOrNull(form.stockNm), numberOrNull(profile.tunedNm));
            return <fieldset key={stage} className={`rounded-2xl border p-4 ${profile.active ? "border-red-800/50 bg-red-950/15" : "border-white/10 bg-black/25"}`}><legend className="sr-only">{stageLabels[stage]} performance</legend><div className="flex items-center justify-between gap-3"><div><div className="text-lg font-black">{stageLabels[stage]}</div><div className="mt-1 text-xs text-zinc-500">{profile.active ? "Available" : "Not offered"}</div></div><button type="button" aria-pressed={profile.active} onClick={() => toggleStage(stage)} className={`min-h-11 rounded-xl px-3 text-xs font-black ${profile.active ? "bg-[#b1121b] text-white" : "border border-white/10 text-zinc-400"}`}>{profile.active ? "Enabled" : "Enable"}</button></div><div className="mt-4 grid grid-cols-2 gap-3"><StageField label="After tuning HP" value={profile.tunedHp} onChange={(value) => updateStage(stage, "tunedHp", value)} disabled={!profile.active} min="1" /><StageField label="After tuning Nm" value={profile.tunedNm} onChange={(value) => updateStage(stage, "tunedNm", value)} disabled={!profile.active} min="1" /><StageField label="Gain +HP" value={hpGain == null ? "" : String(hpGain)} onChange={(value) => updateStageGain(stage, "hp", value)} disabled={!profile.active || !form.stockHp} min="0" /><StageField label="Gain +Nm" value={nmGain == null ? "" : String(nmGain)} onChange={(value) => updateStageGain(stage, "nm", value)} disabled={!profile.active || !form.stockNm} min="0" /></div><p className="mt-3 text-[11px] leading-5 text-zinc-500">Enter either the final output or the gain. Gain entry needs the stock value above and updates the final output immediately.</p></fieldset>;
          })}</div>
        </EditorSection>

        <EditorSection id="ecu" icon={<Cpu />} title="Primary ECU & gearbox" description="The main ECU variant for this engine. Existing additional ECU variants remain preserved.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Field label="ECU family" value={form.ecuFamily} onChange={(value) => update("ecuFamily", value)} /><Field label="ECU type" value={form.ecuType} onChange={(value) => update("ecuType", value)} /><Field label="ECU hardware" value={form.ecuHardware} onChange={(value) => update("ecuHardware", value)} /><Field label="ECU software" value={form.ecuSoftware} onChange={(value) => update("ecuSoftware", value)} /><Field label="Gearbox" value={form.gearboxType} onChange={(value) => update("gearboxType", value)} /><Field label="TCU type" value={form.tcuType} onChange={(value) => update("tcuType", value)} /></div>
          <details className="mt-4 rounded-xl border border-white/10 bg-black/25 p-4"><summary className="cursor-pointer text-sm font-black text-zinc-300">Technical notes</summary><div className="mt-4 grid gap-4 md:grid-cols-2"><TextArea label="ECU notes" value={form.ecuNotes} onChange={(value) => update("ecuNotes", value)} /><TextArea label="Unlock notes" value={form.unlockNotes} onChange={(value) => update("unlockNotes", value)} /><TextArea label="Protection notes" value={form.protectionNotes} onChange={(value) => update("protectionNotes", value)} /><TextArea label="TCU notes" value={form.tcuNotes} onChange={(value) => update("tcuNotes", value)} /></div></details>
        </EditorSection>

        <EditorSection id="services" icon={<Wrench />} title="Other services" description="Stage availability is managed in the Stage cards above.">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{otherServiceKeys.map((service) => { const selected = form.services.includes(service); return <button key={service} type="button" aria-pressed={selected} onClick={() => toggleService(service)} className={`min-h-12 rounded-xl border px-4 py-3 text-left text-sm font-black transition ${selected ? "border-emerald-700/40 bg-emerald-950/20 text-emerald-200" : "border-white/10 bg-black/30 text-zinc-400 hover:bg-white/10"}`}>{selected && <CheckCircle2 className="mr-2 inline h-4 w-4" />}{vehicleServiceLabels[service]}</button>; })}</div>
        </EditorSection>

        <EditorSection id="notes" icon={<ShieldAlert />} title="Notes" description="Customer notes are public-safe; technical notes stay admin-only."><div className="grid gap-4 md:grid-cols-2"><TextArea label="Customer-safe notes" value={form.customerSafeNotes} onChange={(value) => update("customerSafeNotes", value)} /><TextArea label="Admin-only technical notes" value={form.adminTechnicalNotes} onChange={(value) => update("adminTechnicalNotes", value)} /></div></EditorSection>
      </div>

      <aside id="publish" className="space-y-4 xl:sticky xl:top-16 xl:self-start">
        <section className="rounded-2xl border border-red-900/40 bg-red-950/10 p-5"><h2 className="text-lg font-black">Publish & quality</h2><p className="mt-1 text-xs leading-5 text-zinc-500">Keep unverified records as drafts until the values are checked.</p><Toggle label="Active record" checked={form.active} onChange={(value) => update("active", value)} /><Toggle label="Published to customers" checked={form.published} onChange={(value) => update("published", value)} /><label className="mt-4 block text-xs font-black uppercase tracking-[0.12em] text-zinc-500">Verification<select value={form.verificationStatus} onChange={(event) => update("verificationStatus", event.target.value as FormState["verificationStatus"])} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-black/50 px-3 text-sm font-bold normal-case text-white outline-none focus:border-red-700"><option value="imported">Imported</option><option value="unverified">Unverified</option><option value="needs_review">Needs review</option><option value="verified">Verified</option><option value="rejected">Rejected</option></select></label><div className="mt-4"><Field label="Confidence score (0–100)" value={form.confidenceScore} onChange={(value) => update("confidenceScore", value)} type="number" /></div></section>
        <ReviewList title="Validation" rows={payload.validations} empty="No validation entries for this record." warning /><ReviewList title="Audit history" rows={payload.audit} empty="No audit entries yet." />
      </aside>
    </div>

    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-black/95 px-4 py-3 backdrop-blur"><div className="mx-auto flex max-w-[1440px] flex-col items-stretch justify-between gap-2 sm:flex-row sm:items-center sm:gap-3"><div className={`text-sm font-black ${dirty || notice?.kind === "warning" ? "text-amber-300" : "text-zinc-500"}`}>{dirty ? "Unsaved changes" : notice?.kind === "warning" ? "Saved — customer sync failed" : "All changes saved"}</div><div className="flex flex-wrap justify-end gap-2">{notice?.kind === "warning" && <button onClick={() => void retryCatalogSync()} disabled={syncingCatalog || saving} className="h-10 rounded-xl border border-amber-700/50 bg-amber-950/20 px-3 text-xs font-black text-amber-100 disabled:opacity-40 sm:h-11 sm:px-4 sm:text-sm">{syncingCatalog ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 inline h-4 w-4" />}Retry customer sync</button>}<button onClick={reset} disabled={!dirty || saving || syncingCatalog} className="h-10 rounded-xl border border-white/10 px-3 text-xs font-black disabled:opacity-40 sm:h-11 sm:px-4 sm:text-sm">Reset</button><button onClick={() => void save()} disabled={!dirty || saving || syncingCatalog} className="h-10 rounded-xl bg-[#b1121b] px-4 text-xs font-black disabled:opacity-40 sm:h-11 sm:px-5 sm:text-sm">{saving ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : <Save className="mr-2 inline h-4 w-4" />}Save vehicle</button></div></div></div>
  </main>;
}

function EditorSection({ id, icon, title, description, children }: { id: string; icon: ReactNode; title: string; description: string; children: ReactNode }) {
  return <section id={id} className="scroll-mt-20 rounded-2xl border border-white/10 bg-white/[0.03] p-5"><div className="flex items-start gap-3"><span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-950/30 text-red-400">{icon}</span><div><h2 className="text-xl font-black">{title}</h2><p className="mt-1 text-sm text-zinc-500">{description}</p></div></div><div className="mt-5">{children}</div></section>;
}

function Field({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return <label className="block text-xs font-black uppercase tracking-[0.12em] text-zinc-500">{label}<input required={required} type={type} min={type === "number" ? 0 : undefined} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-black/45 px-4 text-sm font-bold normal-case text-white outline-none focus:border-red-700" /></label>;
}

function StageField({ label, value, onChange, disabled, min }: { label: string; value: string; onChange: (value: string) => void; disabled: boolean; min: string }) {
  return <label className="block text-[11px] font-black uppercase tracking-[0.1em] text-zinc-500">{label}<input type="number" min={min} step="1" disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-black/45 px-3 text-sm font-bold normal-case text-white outline-none focus:border-red-700 disabled:opacity-40" /></label>;
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-xs font-black uppercase tracking-[0.12em] text-zinc-500">{label}<textarea value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-28 w-full resize-y rounded-xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold normal-case text-white outline-none focus:border-red-700" /></label>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="mt-3 flex min-h-12 items-center justify-between rounded-xl border border-white/10 bg-black/35 px-4 text-sm font-black"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 accent-red-700" /></label>;
}

function ValueCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/10 bg-black/30 p-3"><div className="text-[11px] font-black uppercase tracking-[0.12em] text-zinc-500">{label}</div><div className="mt-1 text-lg font-black">{value}</div></div>;
}

function StatusBadge({ status, positive }: { status: string; positive: boolean }) {
  return <span className={`rounded-full px-3 py-1 text-xs font-black ${positive ? "bg-emerald-950/30 text-emerald-300" : "bg-zinc-900 text-zinc-400"}`}>{status}</span>;
}

function ReviewList({ title, rows, empty, warning = false }: { title: string; rows: Array<Record<string, unknown>>; empty: string; warning?: boolean }) {
  return <details className="rounded-2xl border border-white/10 bg-white/[0.03] p-5" open={warning && rows.length > 0}><summary className="cursor-pointer text-lg font-black">{title} <span className="ml-1 text-xs text-zinc-500">({rows.length})</span></summary><div className="mt-4 space-y-2">{rows.slice(0, 8).map((item, index) => <div key={String(item.id ?? index)} className={`rounded-xl border p-3 text-sm ${warning ? "border-amber-800/30 bg-amber-950/10 text-amber-100" : "border-white/10 bg-black/30 text-zinc-300"}`}><div className="font-black">{String(item.message ?? item.action ?? item.code ?? "Change")}</div>{item.created_at ? <div className="mt-1 text-xs text-zinc-600">{String(item.created_at)}</div> : null}</div>)}{!rows.length && <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-zinc-500">{empty}</div>}</div></details>;
}
