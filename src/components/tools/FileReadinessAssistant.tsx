"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  Info,
  ShieldCheck,
} from "lucide-react";
import type { FileReadinessCopy } from "@/lib/i18n/tool-client-copy-keys";

type VehicleStatus = "complete" | "partial" | "unknown";
type ServiceStatus = "clear" | "needs_help" | "unclear";
type FileStatus = "ori" | "unsure" | "missing";
type CreditStatus = "ready" | "not_ready" | "unknown";

const serviceOptions = [
  "Stage 1",
  "Stage 2 / hardware changes",
  "TCU service",
  "DTC request",
  "EGR / DPF / AdBlue request",
  "Custom diagnostic support",
];

const toolOptions = [
  "AutoTuner",
  "Flex",
  "KESS / KTAG",
  "CMD",
  "Magic Motorsport",
  "Bench/boot read",
  "Unknown / customer supplied file",
];

function scoreChoice(value: string, scores: Record<string, number>) {
  return scores[value] ?? 0;
}

function toolT(copy: FileReadinessCopy, source: string) {
  return (copy as Readonly<Record<string, string>>)[source] ?? source;
}

function readinessLabel(copy: FileReadinessCopy, score: number) {
  if (score >= 82) return { title: toolT(copy, "Ready to submit"), tone: "text-emerald-300", border: "border-emerald-600/50", bg: "bg-emerald-950/20" };
  if (score >= 58) return { title: toolT(copy, "Almost ready"), tone: "text-amber-200", border: "border-amber-600/50", bg: "bg-amber-950/20" };
  return { title: toolT(copy, "Needs preparation"), tone: "text-red-200", border: "border-red-700/50", bg: "bg-red-950/20" };
}

export function FileReadinessAssistant({ copy }: { copy: FileReadinessCopy }) {
  const t = (source: string) => toolT(copy, source);
  const [vehicleStatus, setVehicleStatus] = useState<VehicleStatus>("partial");
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>("clear");
  const [fileStatus, setFileStatus] = useState<FileStatus>("ori");
  const [creditStatus, setCreditStatus] = useState<CreditStatus>("unknown");
  const [service, setService] = useState(serviceOptions[0]);
  const [tool, setTool] = useState(toolOptions[0]);
  const [hasNotes, setHasNotes] = useState(false);
  const [hasFaultCodes, setHasFaultCodes] = useState(false);

  const result = useMemo(() => {
    const score = Math.min(100, Math.max(0,
      12 +
      scoreChoice(vehicleStatus, { complete: 26, partial: 16, unknown: 4 }) +
      scoreChoice(serviceStatus, { clear: 22, needs_help: 12, unclear: 3 }) +
      scoreChoice(fileStatus, { ori: 22, unsure: 10, missing: 0 }) +
      scoreChoice(creditStatus, { ready: 12, unknown: 5, not_ready: 0 }) +
      (hasNotes ? 4 : 0) +
      (hasFaultCodes ? 2 : 0)
    ));

    const nextSteps: string[] = [];
    if (vehicleStatus !== "complete") nextSteps.push("Add full vehicle details: brand, model, generation, engine and production year.");
    if (serviceStatus !== "clear") nextSteps.push("Describe the requested service in plain language so MG AutoTech can confirm the right workflow.");
    if (fileStatus !== "ori") nextSteps.push("Prepare the original read file before submitting a file-service request.");
    if (creditStatus !== "ready") nextSteps.push("Check your credit balance or payment method before final submission.");
    if (!hasNotes) nextSteps.push("Add short notes about hardware changes, previous tuning, symptoms or customer goal.");
    if (/dtc/i.test(service) && !hasFaultCodes) nextSteps.push("For DTC requests, include the fault codes and the diagnostic context.");
    if (!nextSteps.length) nextSteps.push("Open the secure request form and upload the original file through your account.");

    const warnings: string[] = [];
    if (fileStatus === "missing") warnings.push("No request should be submitted without the original file.");
    if (tool.includes("Unknown")) warnings.push("Unknown read tools may require extra verification.");
    if (/hardware/i.test(service)) warnings.push("Hardware-change requests need clear parts information and human review.");

    return { score, nextSteps, warnings, label: readinessLabel(copy, score) };
  }, [copy, creditStatus, fileStatus, hasFaultCodes, hasNotes, service, serviceStatus, tool, vehicleStatus]);

  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:py-20">
      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="border border-white/10 bg-[#0b0c0e] p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-red-900/50 bg-red-950/30 text-red-400">
              <ClipboardCheck className="h-5 w-5" />
            </span>
            <div>
              <div className="text-xs font-black uppercase tracking-[0.16em] text-red-400">{t("Readiness input")}</div>
              <h2 className="text-2xl font-black">{t("Pre-check your request")}</h2>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            <SelectBlock copy={copy} label="Vehicle information" value={vehicleStatus} onChange={(value) => setVehicleStatus(value as VehicleStatus)} options={[
              ["complete", "Complete vehicle data"],
              ["partial", "Some vehicle data missing"],
              ["unknown", "Vehicle identification unclear"],
            ]} />
            <SelectBlock copy={copy} label="Requested service clarity" value={serviceStatus} onChange={(value) => setServiceStatus(value as ServiceStatus)} options={[
              ["clear", "Service is clear"],
              ["needs_help", "Need MG AutoTech confirmation"],
              ["unclear", "Not sure what is needed"],
            ]} />
            <label className="block text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
              {t("Main service")}
              <select value={service} onChange={(event) => setService(event.target.value)} className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/40 px-4 text-sm font-bold normal-case text-white outline-none focus:border-red-700">
                {serviceOptions.map((option) => <option key={option} value={option}>{t(option)}</option>)}
              </select>
            </label>
            <label className="block text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
              {t("Read tool / file source")}
              <select value={tool} onChange={(event) => setTool(event.target.value)} className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/40 px-4 text-sm font-bold normal-case text-white outline-none focus:border-red-700">
                {toolOptions.map((option) => <option key={option} value={option}>{t(option)}</option>)}
              </select>
            </label>
            <SelectBlock copy={copy} label="Original file status" value={fileStatus} onChange={(value) => setFileStatus(value as FileStatus)} options={[
              ["ori", "Original read file is ready"],
              ["unsure", "File exists but status is unclear"],
              ["missing", "Original file not ready"],
            ]} />
            <SelectBlock copy={copy} label="Credits / payment" value={creditStatus} onChange={(value) => setCreditStatus(value as CreditStatus)} options={[
              ["ready", "Credits or payment are ready"],
              ["unknown", "Need to check balance"],
              ["not_ready", "Not ready yet"],
            ]} />
            <label className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/30 p-3 text-sm font-bold text-zinc-200">
              <input type="checkbox" checked={hasNotes} onChange={(event) => setHasNotes(event.target.checked)} />
              {t("I can add useful notes about the vehicle or goal.")}
            </label>
            <label className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/30 p-3 text-sm font-bold text-zinc-200">
              <input type="checkbox" checked={hasFaultCodes} onChange={(event) => setHasFaultCodes(event.target.checked)} />
              {t("I have fault codes or diagnostic context where relevant.")}
            </label>
          </div>
        </div>

        <div className="space-y-4">
          <div className={`border ${result.label.border} ${result.label.bg} p-6`}>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">{t("Readiness score")}</div>
                <div className={`mt-2 text-5xl font-black ${result.label.tone}`}>{result.score}%</div>
                <div className="mt-2 text-2xl font-black">{result.label.title}</div>
              </div>
              <div className="h-4 w-full overflow-hidden rounded-full bg-black/50 sm:w-52">
                <div className="h-full bg-[#b1121b]" style={{ width: `${result.score}%` }} />
              </div>
            </div>
          </div>

          <div className="border border-white/10 bg-[#0b0c0e] p-6">
            <div className="flex items-center gap-3">
              <FileCheck2 className="h-5 w-5 text-emerald-400" />
              <h2 className="text-xl font-black">{t("Next best actions")}</h2>
            </div>
            <div className="mt-5 space-y-3">
              {result.nextSteps.map((step) => (
                <div key={step} className="flex gap-3 text-sm leading-6 text-zinc-300">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <span>{t(step)}</span>
                </div>
              ))}
            </div>
          </div>

          {result.warnings.length > 0 && (
            <div className="border border-amber-800/40 bg-amber-950/15 p-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-300" />
                <h2 className="text-xl font-black">{t("Review warnings")}</h2>
              </div>
              <div className="mt-5 space-y-3">
                {result.warnings.map((warning) => (
                  <p key={warning} className="text-sm leading-6 text-amber-100">{t(warning)}</p>
                ))}
              </div>
            </div>
          )}

          <div className="border border-white/10 bg-[#070707] p-6">
            <div className="flex items-start gap-3 text-sm leading-6 text-zinc-400">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
              {t("This tool does not upload files, inspect binaries or create a request. It only helps you prepare before using the secure MG AutoTech request form.")}
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="/new-request" className="inline-flex items-center justify-center rounded-lg bg-[#b1121b] px-5 py-3 text-sm font-black hover:bg-[#c91824]">
                {t("Start Secure Request")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link href="/contact" className="inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-black hover:bg-white/10">
                {t("Ask Support")}
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-start gap-3 border-l-2 border-emerald-500 bg-emerald-950/10 p-4 text-sm leading-6 text-emerald-100">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
        {t("Customer safety: no file picker, no upload session, no raw data, no checksum, no MOD generation.")}
      </div>
    </section>
  );
}

function SelectBlock({
  copy,
  label,
  value,
  onChange,
  options,
}: {
  copy: FileReadinessCopy;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="block text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
      {toolT(copy, label)}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/40 px-4 text-sm font-bold normal-case text-white outline-none focus:border-red-700">
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{toolT(copy, optionLabel)}</option>
        ))}
      </select>
    </label>
  );
}
