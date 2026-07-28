"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Save, ShieldAlert } from "lucide-react";
import { authenticatedFetch } from "@/lib/authGuards";
import type { VehicleControlRecord, VehicleServiceKey } from "@/lib/vehicleControl/types";
import { vehicleServiceKeys, vehicleServiceLabels } from "@/lib/vehicleControl/types";

type DetailPayload = {
  record: VehicleControlRecord;
  audit: Array<Record<string, unknown>>;
  validations: Array<Record<string, unknown>>;
};

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
  tunedHp: string;
  tunedNm: string;
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

function formFromRecord(record: VehicleControlRecord): FormState {
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
    tunedHp: record.tunedHp == null ? "" : String(record.tunedHp),
    tunedNm: record.tunedNm == null ? "" : String(record.tunedNm),
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
    services: record.services,
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const authFetch = useCallback(
    (url: string, init?: RequestInit) => authenticatedFetch(url, init),
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await authFetch(`/api/admin/vehicles/${id}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Vehicle could not be loaded.");
      setPayload(data);
      setForm(formFromRecord(data.record));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Vehicle could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, id]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => current ? { ...current, [key]: value } : current);
  }

  function toggleService(service: VehicleServiceKey) {
    if (!form) return;
    update("services", form.services.includes(service)
      ? form.services.filter((item) => item !== service)
      : [...form.services, service]
    );
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    setMessage("");
    try {
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
          tunedHp: numberOrNull(form.tunedHp),
          tunedNm: numberOrNull(form.tunedNm),
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
      if (!response.ok) throw new Error(data.error || "Vehicle could not be saved.");
      setPayload(data);
      setForm(formFromRecord(data.record));
      setMessage("Vehicle record saved and audit log updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Vehicle could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-[#050505] text-white"><Loader2 className="mr-3 h-5 w-5 animate-spin text-red-500" />Loading vehicle record...</main>;
  if (!form || !payload) return <main className="min-h-screen bg-[#050505] p-8 text-white"><Link href="/admin/vehicles">Back</Link><div className="mt-6 text-red-200">{message}</div></main>;

  return <main className="min-h-screen bg-[#050505] text-white">
    <header className="border-b border-white/10 bg-black/80">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-4 py-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Link href="/admin/vehicles" className="text-sm font-bold text-zinc-500 hover:text-white"><ArrowLeft className="mr-2 inline h-4 w-4" />Vehicle control center</Link>
          <h1 className="mt-4 text-4xl font-black">{payload.record.displayName}</h1>
          <p className="mt-2 text-sm text-zinc-500">{payload.record.vehicleKey}</p>
        </div>
        <button onClick={() => void save()} disabled={saving} className="h-12 rounded-xl bg-[#b1121b] px-5 text-sm font-black hover:bg-[#c91824] disabled:opacity-50">{saving ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : <Save className="mr-2 inline h-4 w-4" />}Save vehicle</button>
      </div>
    </header>

    <div className="mx-auto grid max-w-[1400px] gap-6 px-4 py-6 xl:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        {message && <div className="rounded-xl border border-red-800/40 bg-red-950/20 p-4 text-sm text-red-100">{message}</div>}
        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <h2 className="text-2xl font-black">Vehicle identity</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Brand" value={form.brand} onChange={(value) => update("brand", value)} />
            <Field label="Model" value={form.model} onChange={(value) => update("model", value)} />
            <Field label="Generation" value={form.generation} onChange={(value) => update("generation", value)} />
            <Field label="Engine" value={form.engine} onChange={(value) => update("engine", value)} />
            <Field label="Display name" value={form.displayName} onChange={(value) => update("displayName", value)} />
            <Field label="Fuel type" value={form.fuelType} onChange={(value) => update("fuelType", value)} />
            <Field label="Year from" value={form.yearFrom} onChange={(value) => update("yearFrom", value)} type="number" />
            <Field label="Year to" value={form.yearTo} onChange={(value) => update("yearTo", value)} type="number" />
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <h2 className="text-2xl font-black">Performance and ECU data</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <Field label="Displacement CC" value={form.displacementCc} onChange={(value) => update("displacementCc", value)} type="number" />
            <Field label="Stock HP" value={form.stockHp} onChange={(value) => update("stockHp", value)} type="number" />
            <Field label="Stock NM" value={form.stockNm} onChange={(value) => update("stockNm", value)} type="number" />
            <Field label="Tuned HP" value={form.tunedHp} onChange={(value) => update("tunedHp", value)} type="number" />
            <Field label="Tuned NM" value={form.tunedNm} onChange={(value) => update("tunedNm", value)} type="number" />
            <Field label="ECU family" value={form.ecuFamily} onChange={(value) => update("ecuFamily", value)} />
            <Field label="ECU type" value={form.ecuType} onChange={(value) => update("ecuType", value)} />
            <Field label="ECU hardware" value={form.ecuHardware} onChange={(value) => update("ecuHardware", value)} />
            <Field label="ECU software" value={form.ecuSoftware} onChange={(value) => update("ecuSoftware", value)} />
            <Field label="Gearbox" value={form.gearboxType} onChange={(value) => update("gearboxType", value)} />
            <Field label="TCU type" value={form.tcuType} onChange={(value) => update("tcuType", value)} />
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <TextArea label="ECU notes" value={form.ecuNotes} onChange={(value) => update("ecuNotes", value)} />
            <TextArea label="Unlock notes" value={form.unlockNotes} onChange={(value) => update("unlockNotes", value)} />
            <TextArea label="Protection notes" value={form.protectionNotes} onChange={(value) => update("protectionNotes", value)} />
            <TextArea label="TCU notes" value={form.tcuNotes} onChange={(value) => update("tcuNotes", value)} />
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <h2 className="text-2xl font-black">Supported services</h2>
          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {vehicleServiceKeys.map((service) => <button key={service} type="button" onClick={() => toggleService(service)} className={`rounded-xl border px-4 py-3 text-left text-sm font-black transition ${form.services.includes(service) ? "border-emerald-700/40 bg-emerald-950/20 text-emerald-200" : "border-white/10 bg-black/30 text-zinc-400 hover:bg-white/10"}`}>
              {form.services.includes(service) && <CheckCircle2 className="mr-2 inline h-4 w-4" />}{vehicleServiceLabels[service]}
            </button>)}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <h2 className="text-2xl font-black">Notes</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <TextArea label="Customer-safe notes" value={form.customerSafeNotes} onChange={(value) => update("customerSafeNotes", value)} />
            <TextArea label="Admin-only technical notes" value={form.adminTechnicalNotes} onChange={(value) => update("adminTechnicalNotes", value)} />
          </div>
        </section>
      </div>

      <aside className="space-y-5">
        <section className="rounded-2xl border border-red-900/40 bg-red-950/10 p-5">
          <h2 className="text-xl font-black">Publishing control</h2>
          <label className="mt-5 flex items-center justify-between rounded-xl border border-white/10 bg-black/30 p-4 text-sm font-black">Published<input type="checkbox" checked={form.published} onChange={(event) => update("published", event.target.checked)} /></label>
          <label className="mt-3 flex items-center justify-between rounded-xl border border-white/10 bg-black/30 p-4 text-sm font-black">Active<input type="checkbox" checked={form.active} onChange={(event) => update("active", event.target.checked)} /></label>
          <label className="mt-4 block text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Verification status<select value={form.verificationStatus} onChange={(event) => update("verificationStatus", event.target.value as FormState["verificationStatus"])} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-sm normal-case text-white"><option value="imported">Imported</option><option value="unverified">Unverified</option><option value="needs_review">Needs review</option><option value="verified">Verified</option><option value="rejected">Rejected</option></select></label>
          <Field label="Confidence score" value={form.confidenceScore} onChange={(value) => update("confidenceScore", value)} type="number" />
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <h2 className="flex items-center gap-2 text-xl font-black"><ShieldAlert className="h-5 w-5 text-amber-400" />Validation</h2>
          <div className="mt-4 space-y-2">
            {payload.validations.slice(0, 8).map((item, index) => <div key={String(item.id ?? index)} className="rounded-xl border border-amber-800/30 bg-amber-950/10 p-3 text-sm text-amber-100">{String(item.message ?? item.code ?? "Validation note")}</div>)}
            {!payload.validations.length && <div className="rounded-xl border border-emerald-800/30 bg-emerald-950/10 p-3 text-sm text-emerald-200">No validation entries for this record.</div>}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <h2 className="text-xl font-black">Audit history</h2>
          <div className="mt-4 space-y-2">
            {payload.audit.slice(0, 8).map((item, index) => <div key={String(item.id ?? index)} className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm"><div className="font-black">{String(item.action ?? "change")}</div><div className="mt-1 text-xs text-zinc-500">{String(item.created_at ?? "-")}</div></div>)}
            {!payload.audit.length && <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-zinc-500">No audit entries yet.</div>}
          </div>
        </section>
      </aside>
    </div>
  </main>;
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="block text-xs font-black uppercase tracking-[0.14em] text-zinc-500">{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm font-bold normal-case text-white outline-none focus:border-red-700" /></label>;
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-xs font-black uppercase tracking-[0.14em] text-zinc-500">{label}<textarea value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-32 w-full resize-y rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold normal-case text-white outline-none focus:border-red-700" /></label>;
}
