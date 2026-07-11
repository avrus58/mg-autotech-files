"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Gauge, ShieldAlert } from "lucide-react";
import { createLowDataStage1Plan } from "@/lib/aiCalibration/lowDataStage1Plan";
import type { CalibrationVehicleContext } from "@/lib/aiCalibration/calibrationRules";

export default function CalibrationAssistantPage() {
  const [context, setContext] = useState<CalibrationVehicleContext>({
    ecuFamily: "",
    ecuType: "",
    swNumber: "",
    fuelType: "unknown",
    induction: "unknown",
    isTcu: false,
    evidenceCount: 0,
    highQualityEvidenceCount: 0,
    mapDefinitionsAvailable: false,
  });
  const plan = useMemo(() => createLowDataStage1Plan(context), [context]);

  function update<K extends keyof CalibrationVehicleContext>(key: K, value: CalibrationVehicleContext[K]) {
    setContext((current) => ({ ...current, [key]: value }));
  }

  return (
    <main className="mg-compact-ui min-h-screen bg-[#050505] text-white">
      <header className="border-b border-white/10 bg-black/80">
        <div className="mx-auto max-w-[1400px] px-4 py-5">
          <Link href="/admin/ai-training" className="inline-flex items-center text-sm font-bold text-zinc-500 hover:text-white">
            <ArrowLeft className="mr-2 h-4 w-4" /> AI training
          </Link>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-red-800/50 bg-red-950/25 text-red-400">
              <Gauge className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-red-500">Advisory only</div>
              <h1 className="text-2xl font-black sm:text-3xl">Low-Data Stage 1 Calibration Assistant</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1400px] gap-5 px-4 py-7 lg:grid-cols-[360px_1fr]">
        <section className="rounded-lg border border-white/10 bg-white/[0.025] p-4">
          <div className="mb-4 rounded-lg border border-amber-700/30 bg-amber-950/15 p-3 text-sm text-amber-100/80">
            <ShieldAlert className="mr-2 inline h-4 w-4" />
            No byte patches, no checksum correction and no customer-deliverable MOD files.
          </div>
          <Field label="ECU family" value={context.ecuFamily || ""} onChange={(value) => update("ecuFamily", value)} />
          <Field label="ECU type" value={context.ecuType || ""} onChange={(value) => update("ecuType", value)} />
          <Field label="SW number" value={context.swNumber || ""} onChange={(value) => update("swNumber", value)} />
          <Select label="Fuel type" value={context.fuelType || "unknown"} values={["unknown", "diesel", "gasoline", "petrol", "hybrid"]} onChange={(value) => update("fuelType", value as CalibrationVehicleContext["fuelType"])} />
          <Select label="Induction" value={context.induction || "unknown"} values={["unknown", "turbo", "naturally_aspirated", "supercharged"]} onChange={(value) => update("induction", value as CalibrationVehicleContext["induction"])} />
          <Field label="Evidence count" type="number" value={String(context.evidenceCount || 0)} onChange={(value) => update("evidenceCount", Number(value || 0))} />
          <Field label="High quality evidence" type="number" value={String(context.highQualityEvidenceCount || 0)} onChange={(value) => update("highQualityEvidenceCount", Number(value || 0))} />
          <label className="mt-3 flex items-center gap-2 text-sm font-bold text-zinc-300">
            <input type="checkbox" checked={Boolean(context.mapDefinitionsAvailable)} onChange={(event) => update("mapDefinitionsAvailable", event.target.checked)} />
            Map definitions available
          </label>
          <label className="mt-3 flex items-center gap-2 text-sm font-bold text-zinc-300">
            <input type="checkbox" checked={Boolean(context.isTcu)} onChange={(event) => update("isTcu", event.target.checked)} />
            TCU workflow
          </label>
        </section>

        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Readiness" value={plan.readiness.replaceAll("_", " ")} />
            <Metric label="Confidence" value={`${plan.confidence}/100`} />
            <Metric label="Export" value={plan.mod_generation ? "unlocked" : "locked"} />
          </div>
          <Panel title="Likely Areas To Inspect" items={plan.likely_calibration_areas} />
          <Panel title="Missing Evidence" items={plan.missing_evidence} />
          <Panel title="Required Human Checks" items={plan.required_human_checks} />
          <Panel title="Risk Warnings" items={plan.risk_warnings} tone="amber" />
          <div className="rounded-lg border border-white/10 bg-white/[0.025] p-4">
            <h2 className="text-sm font-black uppercase tracking-[0.12em] text-zinc-500">Next best action</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-200">{plan.next_best_action}</p>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="mb-3 block text-sm font-bold text-zinc-300">
      {label}
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white outline-none focus:border-red-700" />
    </label>
  );
}

function Select({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return (
    <label className="mb-3 block text-sm font-bold text-zinc-300">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white outline-none focus:border-red-700">
        {values.map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}
      </select>
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-white/10 bg-white/[0.025] p-4"><div className="text-2xl font-black text-red-300">{value}</div><div className="mt-1 text-xs font-bold text-zinc-500">{label}</div></div>;
}

function Panel({ title, items, tone = "red" }: { title: string; items: string[]; tone?: "red" | "amber" }) {
  const color = tone === "amber" ? "text-amber-200" : "text-zinc-200";
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.025] p-4">
      <h2 className="text-sm font-black uppercase tracking-[0.12em] text-zinc-500">{title}</h2>
      <ul className={`mt-3 space-y-2 text-sm ${color}`}>
        {items.length ? items.map((item) => <li key={item}>- {item}</li>) : <li>- None</li>}
      </ul>
    </div>
  );
}
