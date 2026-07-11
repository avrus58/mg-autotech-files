"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Cable,
  CheckCircle2,
  ClipboardList,
  Info,
  ShieldCheck,
} from "lucide-react";

type VehicleType = "diesel" | "gasoline" | "hybrid" | "tcu" | "unknown";
type ReadAccess = "obd_known" | "bench_required" | "boot_required" | "locked" | "unknown";
type ToolStatus = "professional" | "customer_file" | "unknown";
type FileStatus = "ori_ready" | "virtual_read" | "modified_only" | "not_ready";

const vehicleTypes: Array<[VehicleType, string]> = [
  ["diesel", "Turbo diesel ECU"],
  ["gasoline", "Turbo gasoline ECU"],
  ["hybrid", "Hybrid / mild-hybrid ECU"],
  ["tcu", "TCU / gearbox file"],
  ["unknown", "Unknown control unit"],
];

const readAccessOptions: Array<[ReadAccess, string]> = [
  ["obd_known", "OBD read is known to be supported"],
  ["bench_required", "Bench read may be required"],
  ["boot_required", "Boot mode may be required"],
  ["locked", "ECU may be locked or protected"],
  ["unknown", "Read method is unknown"],
];

const toolOptions: Array<[ToolStatus, string]> = [
  ["professional", "Professional tool and account available"],
  ["customer_file", "Customer already has a file"],
  ["unknown", "Tool or file source is unknown"],
];

const fileOptions: Array<[FileStatus, string]> = [
  ["ori_ready", "Original read file is available"],
  ["virtual_read", "Virtual read / stock file may be needed"],
  ["modified_only", "Only a modified file is available"],
  ["not_ready", "No file is ready yet"],
];

function advisorTone(score: number) {
  if (score >= 78) return { label: "Good read preparation", tone: "text-emerald-300", border: "border-emerald-600/50", bg: "bg-emerald-950/20" };
  if (score >= 52) return { label: "Needs confirmation", tone: "text-amber-200", border: "border-amber-600/50", bg: "bg-amber-950/20" };
  return { label: "High review needed", tone: "text-red-200", border: "border-red-700/50", bg: "bg-red-950/20" };
}

export function EcuReadMethodAdvisor() {
  const [vehicleType, setVehicleType] = useState<VehicleType>("diesel");
  const [readAccess, setReadAccess] = useState<ReadAccess>("unknown");
  const [toolStatus, setToolStatus] = useState<ToolStatus>("professional");
  const [fileStatus, setFileStatus] = useState<FileStatus>("ori_ready");
  const [hasEcuLabel, setHasEcuLabel] = useState(false);
  const [hasBatterySupport, setHasBatterySupport] = useState(false);
  const [hasFaultCodes, setHasFaultCodes] = useState(false);

  const result = useMemo(() => {
    let score = 18;
    score += vehicleType === "unknown" ? 3 : 12;
    score += readAccess === "obd_known" ? 26 : readAccess === "bench_required" ? 18 : readAccess === "boot_required" ? 14 : readAccess === "locked" ? 7 : 6;
    score += toolStatus === "professional" ? 16 : toolStatus === "customer_file" ? 10 : 4;
    score += fileStatus === "ori_ready" ? 20 : fileStatus === "virtual_read" ? 11 : fileStatus === "modified_only" ? 4 : 0;
    score += hasEcuLabel ? 5 : 0;
    score += hasBatterySupport ? 3 : 0;
    score += hasFaultCodes ? 2 : 0;
    score = Math.min(100, Math.max(0, score));

    const primaryMethod =
      readAccess === "obd_known"
        ? "Start with an OBD read if your tool confirms support for this exact ECU/SW."
        : readAccess === "bench_required"
          ? "Prepare for a bench read and keep ECU identification photos ready."
          : readAccess === "boot_required"
            ? "Treat this as a specialist read. Confirm the method with MG AutoTech before attempting it."
            : readAccess === "locked"
              ? "Do not assume the file can be read normally. Ask MG AutoTech to confirm the safest path."
              : "Identify the ECU, software number and read tool first, then confirm the read method.";

    const checklist = [
      "Confirm vehicle brand, model, generation, engine and year.",
      "Prepare the original file, not only a modified file.",
      "Keep the read tool name and read mode available.",
      "Use stable battery support during read/write operations.",
    ];

    if (!hasEcuLabel) checklist.push("Add ECU/TCU label details or clear photos where possible.");
    if (vehicleType === "tcu") checklist.push("Include gearbox type and transmission software details if available.");
    if (vehicleType === "hybrid") checklist.push("Mention hybrid, mild-hybrid or plug-in-hybrid system context.");
    if (fileStatus === "virtual_read") checklist.push("Tell MG AutoTech if the tool produced a virtual read instead of a full read.");
    if (hasFaultCodes) checklist.push("Include diagnostic codes and symptoms in the request notes.");

    const warnings: string[] = [];
    if (fileStatus === "modified_only") warnings.push("A modified-only file is not ideal. An original file is usually required for a clean workflow.");
    if (fileStatus === "not_ready") warnings.push("No upload should be started until a valid file or verified read plan exists.");
    if (readAccess === "locked") warnings.push("Locked or protected ECUs require human confirmation before any work is promised.");
    if (readAccess === "boot_required") warnings.push("Boot-mode work should only be handled with the correct professional procedure and equipment.");
    if (toolStatus === "unknown") warnings.push("Unknown file sources increase review time and may require extra verification.");

    return { score, tone: advisorTone(score), primaryMethod, checklist, warnings };
  }, [fileStatus, hasBatterySupport, hasEcuLabel, hasFaultCodes, readAccess, toolStatus, vehicleType]);

  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:py-20">
      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="border border-white/10 bg-[#0b0c0e] p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-red-900/50 bg-red-950/30 text-red-400">
              <Cable className="h-5 w-5" />
            </span>
            <div>
              <div className="text-xs font-black uppercase tracking-[0.16em] text-red-400">Read planning</div>
              <h2 className="text-2xl font-black">Choose the safest read preparation path</h2>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            <SelectField label="Control unit type" value={vehicleType} onChange={(value) => setVehicleType(value as VehicleType)} options={vehicleTypes} />
            <SelectField label="Known read access" value={readAccess} onChange={(value) => setReadAccess(value as ReadAccess)} options={readAccessOptions} />
            <SelectField label="Tool / file source" value={toolStatus} onChange={(value) => setToolStatus(value as ToolStatus)} options={toolOptions} />
            <SelectField label="Original file status" value={fileStatus} onChange={(value) => setFileStatus(value as FileStatus)} options={fileOptions} />

            <label className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/30 p-3 text-sm font-bold text-zinc-200">
              <input type="checkbox" checked={hasEcuLabel} onChange={(event) => setHasEcuLabel(event.target.checked)} />
              ECU/TCU label or software details are available.
            </label>
            <label className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/30 p-3 text-sm font-bold text-zinc-200">
              <input type="checkbox" checked={hasBatterySupport} onChange={(event) => setHasBatterySupport(event.target.checked)} />
              Stable battery support is available during the read.
            </label>
            <label className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/30 p-3 text-sm font-bold text-zinc-200">
              <input type="checkbox" checked={hasFaultCodes} onChange={(event) => setHasFaultCodes(event.target.checked)} />
              Fault codes or diagnostic symptoms are known.
            </label>
          </div>
        </div>

        <div className="space-y-4">
          <div className={`border ${result.tone.border} ${result.tone.bg} p-6`}>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">Preparation score</div>
                <div className={`mt-2 text-5xl font-black ${result.tone.tone}`}>{result.score}%</div>
                <div className="mt-2 text-2xl font-black">{result.tone.label}</div>
              </div>
              <div className="h-4 w-full overflow-hidden rounded-full bg-black/50 sm:w-52">
                <div className="h-full bg-[#b1121b]" style={{ width: `${result.score}%` }} />
              </div>
            </div>
            <p className="mt-5 text-sm leading-7 text-zinc-300">{result.primaryMethod}</p>
          </div>

          <div className="border border-white/10 bg-[#0b0c0e] p-6">
            <div className="flex items-center gap-3">
              <ClipboardList className="h-5 w-5 text-emerald-400" />
              <h2 className="text-xl font-black">Read preparation checklist</h2>
            </div>
            <div className="mt-5 space-y-3">
              {result.checklist.map((item) => (
                <div key={item} className="flex gap-3 text-sm leading-6 text-zinc-300">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {result.warnings.length > 0 && (
            <div className="border border-amber-800/40 bg-amber-950/15 p-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-300" />
                <h2 className="text-xl font-black">Review before upload</h2>
              </div>
              <div className="mt-5 space-y-3">
                {result.warnings.map((warning) => (
                  <p key={warning} className="text-sm leading-6 text-amber-100">{warning}</p>
                ))}
              </div>
            </div>
          )}

          <div className="border border-white/10 bg-[#070707] p-6">
            <div className="flex items-start gap-3 text-sm leading-6 text-zinc-400">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
              This advisor does not read files, open a file picker, modify binaries or create a request. It only helps you prepare safer information before using the secure MG AutoTech workflow.
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="/tools/request-brief-builder" className="inline-flex items-center justify-center rounded-lg bg-[#b1121b] px-5 py-3 text-sm font-black hover:bg-[#c91824]">
                Build Request Brief
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link href="/new-request" className="inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-black hover:bg-white/10">
                Start Secure Request
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-start gap-3 border-l-2 border-emerald-500 bg-emerald-950/10 p-4 text-sm leading-6 text-emerald-100">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
        Customer safety: no file picker, no upload session, no binary analysis, no checksum, no file generation.
      </div>
    </section>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="block text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/40 px-4 text-sm font-bold normal-case text-white outline-none focus:border-red-700">
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  );
}
