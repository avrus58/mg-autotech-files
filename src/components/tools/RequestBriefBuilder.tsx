"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Clipboard,
  ClipboardCheck,
  Copy,
  FileText,
  ShieldCheck,
} from "lucide-react";

const serviceGoals = [
  "Stage 1 performance",
  "Stage 2 / hardware changes",
  "TCU / gearbox support",
  "DTC request preparation",
  "Aftertreatment service request",
  "Diagnostic / custom file support",
];

const readMethods = [
  "AutoTuner",
  "Flex",
  "KESS / KTAG",
  "CMD",
  "Magic Motorsport",
  "Bench / boot mode",
  "Unknown",
];

function line(label: string, value: string) {
  return `${label}: ${value.trim() || "not provided"}`;
}

function completeness(values: string[]) {
  const filled = values.filter((value) => value.trim().length > 0).length;
  return Math.round((filled / values.length) * 100);
}

function copyStatusLabel(status: "idle" | "copied" | "failed") {
  if (status === "copied") return "Copied";
  if (status === "failed") return "Copy failed";
  return "Copy brief";
}

export function RequestBriefBuilder() {
  const [vehicle, setVehicle] = useState("");
  const [engine, setEngine] = useState("");
  const [year, setYear] = useState("");
  const [ecu, setEcu] = useState("");
  const [readTool, setReadTool] = useState(readMethods[0]);
  const [serviceGoal, setServiceGoal] = useState(serviceGoals[0]);
  const [hardware, setHardware] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [faultCodes, setFaultCodes] = useState("");
  const [notes, setNotes] = useState("");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");

  const result = useMemo(() => {
    const requiredValues = [vehicle, engine, year, readTool, serviceGoal, notes];
    const score = completeness(requiredValues);
    const missing: string[] = [];
    if (!vehicle.trim()) missing.push("vehicle brand/model");
    if (!engine.trim()) missing.push("engine or engine code");
    if (!year.trim()) missing.push("model year");
    if (!notes.trim()) missing.push("short customer goal or context");
    if (/dtc/i.test(serviceGoal) && !faultCodes.trim()) missing.push("fault codes");
    if (/hardware/i.test(serviceGoal) && !hardware.trim()) missing.push("hardware changes");

    const brief = [
      "MG AutoTech request brief",
      "-------------------------",
      line("Vehicle", vehicle),
      line("Engine / engine code", engine),
      line("Model year", year),
      line("ECU / TCU info", ecu),
      line("Read tool / method", readTool),
      line("Requested service", serviceGoal),
      line("Hardware changes", hardware),
      line("Fault codes / diagnostics", faultCodes),
      line("Symptoms / customer goal", symptoms),
      line("Additional notes", notes),
      "",
      "Safety note: original file will be uploaded only through the secure MG AutoTech request form.",
    ].join("\n");

    return { score, missing, brief };
  }, [ecu, engine, faultCodes, hardware, notes, readTool, serviceGoal, symptoms, vehicle, year]);

  async function copyBrief() {
    try {
      await navigator.clipboard.writeText(result.brief);
      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus("idle"), 1800);
    } catch {
      setCopyStatus("failed");
      window.setTimeout(() => setCopyStatus("idle"), 1800);
    }
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:py-20">
      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="border border-white/10 bg-[#0b0c0e] p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-red-900/50 bg-red-950/30 text-red-400">
              <Clipboard className="h-5 w-5" />
            </span>
            <div>
              <div className="text-xs font-black uppercase tracking-[0.16em] text-red-400">Brief input</div>
              <h2 className="text-2xl font-black">Build a clean request note</h2>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label="Vehicle" value={vehicle} onChange={setVehicle} placeholder="BMW 530d G30" />
            <Field label="Engine / engine code" value={engine} onChange={setEngine} placeholder="B57, OM654, EA888..." />
            <Field label="Model year" value={year} onChange={setYear} placeholder="2021" />
            <Field label="ECU / TCU info" value={ecu} onChange={setEcu} placeholder="EDC17, MD1, MG1..." />
            <SelectField label="Read tool / method" value={readTool} onChange={setReadTool} options={readMethods} />
            <SelectField label="Requested service" value={serviceGoal} onChange={setServiceGoal} options={serviceGoals} />
            <Field label="Hardware changes" value={hardware} onChange={setHardware} placeholder="stock, downpipe, intake..." />
            <Field label="Fault codes" value={faultCodes} onChange={setFaultCodes} placeholder="P0401, P2002..." />
          </div>
          <div className="mt-4 grid gap-4">
            <TextArea label="Symptoms / customer goal" value={symptoms} onChange={setSymptoms} placeholder="What should be improved or checked?" />
            <TextArea label="Additional notes" value={notes} onChange={setNotes} placeholder="Read method, previous tuning, file context, support notes..." />
          </div>
        </div>

        <div className="space-y-4">
          <div className="border border-white/10 bg-[#0b0c0e] p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Brief completeness</div>
                <div className="mt-2 text-5xl font-black text-white">{result.score}%</div>
              </div>
              <div className="h-4 w-full overflow-hidden rounded-full bg-black/50 sm:w-52">
                <div className="h-full bg-[#b1121b]" style={{ width: `${result.score}%` }} />
              </div>
            </div>
            {result.missing.length > 0 ? (
              <p className="mt-4 text-sm leading-6 text-amber-100">
                Add: {result.missing.join(", ")}.
              </p>
            ) : (
              <p className="mt-4 flex items-center gap-2 text-sm font-bold text-emerald-300">
                <ClipboardCheck className="h-4 w-4" />
                This brief has the key details MG AutoTech usually needs.
              </p>
            )}
          </div>

          <div className="border border-white/10 bg-[#070707] p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="flex items-center gap-3 text-xl font-black">
                <FileText className="h-5 w-5 text-red-400" />
                Generated request brief
              </h2>
              <button type="button" onClick={() => void copyBrief()} className="inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/[0.04] px-4 py-3 text-sm font-black hover:bg-white/10">
                <Copy className="mr-2 h-4 w-4" />
                {copyStatusLabel(copyStatus)}
              </button>
            </div>
            <pre className="mt-5 max-h-[460px] overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/45 p-4 text-xs leading-6 text-zinc-300">
              {result.brief}
            </pre>
          </div>

          <div className="border border-white/10 bg-[#070707] p-6">
            <div className="flex items-start gap-3 text-sm leading-6 text-zinc-400">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
              This tool does not upload files, inspect binary data, create a request or contact MG AutoTech automatically.
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="/new-request" className="inline-flex items-center justify-center rounded-lg bg-[#b1121b] px-5 py-3 text-sm font-black hover:bg-[#c91824]">
                Open Secure Request Form
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link href="/dashboard/orders" className="inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-black hover:bg-white/10">
                View Orders
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="block text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/40 px-4 text-sm normal-case text-white outline-none placeholder:text-zinc-700 focus:border-red-700" />
    </label>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label className="block text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/40 px-4 text-sm font-bold normal-case text-white outline-none focus:border-red-700">
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function TextArea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="block text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
      {label}
      <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 min-h-28 w-full rounded-lg border border-white/10 bg-black/40 p-4 text-sm normal-case leading-6 text-white outline-none placeholder:text-zinc-700 focus:border-red-700" />
    </label>
  );
}
