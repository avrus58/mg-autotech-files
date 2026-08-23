"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type DragEvent } from "react";
import {
  ArrowRight,
  BarChart3,
  Calculator,
  CheckCircle2,
  FileSpreadsheet,
  Gauge,
  LockKeyhole,
  RotateCcw,
  Upload,
} from "lucide-react";
import {
  analyzePublicLogSnapshotInBrowser,
  type PublicLogSnapshotAnalysis,
} from "@/lib/analyzePublicLogSnapshotInBrowser";
import {
  publicLogSnapshotMaximumCharacters,
  publicLogSnapshotMaximumRows,
} from "@/lib/publicLogSnapshot";
import { LocalizedHomepageTree } from "@/lib/homepageLocalization";

export const publicLogSnapshotMaxFileBytes = publicLogSnapshotMaximumCharacters;

const exampleLog = [
  "Engine Speed (rpm), Engine Torque Actual (Nm)",
  "1800, 320",
  "2200, 390",
  "2600, 430",
  "3000, 420",
  "3400, 395",
  "3800, 360",
  "4200, 315",
].join("\n");

type SnapshotState = "idle" | "reading" | "ready" | "error";

type SnapshotResult = Extract<PublicLogSnapshotAnalysis, { status: "ready" }>;

function unavailableSnapshotMessage(status: Exclude<PublicLogSnapshotAnalysis["status"], "ready">) {
  if (status === "insufficient_data") {
    return "The public estimate needs at least 5 aligned RPM and torque rows across a 1,000 rpm window with usable capture quality.";
  }
  if (status === "unsupported_range") {
    return "The detected RPM, torque or estimated power is outside the supported public-check range. Review the selected channels, units and export before relying on it.";
  }
  return "No compatible engine-speed and actual torque channels were detected. Use a delimited text export with RPM and torque stated in Nm or lb-ft.";
}

function supportedLogFile(file: File) {
  const lowerName = file.name.toLowerCase();
  const lowerType = file.type.toLowerCase();
  return (
    lowerName.endsWith(".csv") ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".tsv") ||
    lowerName.endsWith(".log") ||
    lowerType === "text/csv" ||
    lowerType === "text/plain" ||
    lowerType === "text/tab-separated-values"
  );
}

function fileValidationMessage(file: File) {
  if (!supportedLogFile(file)) {
    return "Choose a CSV, TSV, TXT or LOG text export.";
  }
  if (file.size === 0) {
    return "This file is empty. Choose a log that contains RPM and torque rows.";
  }
  if (file.size > publicLogSnapshotMaxFileBytes) {
    return "This file is too large for the quick power check. Export a text log up to 5 MB, or shorten the capture window.";
  }
  return null;
}

export function PublicLogSnapshot() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const analysisRequestRef = useRef(0);
  const analysisAbortRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<SnapshotState>("idle");
  const [result, setResult] = useState<SnapshotResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => () => analysisAbortRef.current?.abort(), []);

  const analyzeText = async (text: string, requestId: number, signal: AbortSignal) => {
    const snapshot = await analyzePublicLogSnapshotInBrowser(text, signal);
    if (requestId !== analysisRequestRef.current) return;

    if (snapshot.status !== "ready") {
      setResult(null);
      setError(unavailableSnapshotMessage(snapshot.status));
      setState("error");
      return;
    }

    setResult(snapshot);
    setError("");
    setState("ready");
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    const requestId = ++analysisRequestRef.current;
    analysisAbortRef.current?.abort();

    const validationMessage = fileValidationMessage(file);
    if (validationMessage) {
      setResult(null);
      setError(validationMessage);
      setState("error");
      return;
    }

    setResult(null);
    setError("");
    setState("reading");
    const controller = new AbortController();
    analysisAbortRef.current = controller;

    try {
      const text = await file.text();
      if (requestId !== analysisRequestRef.current) return;
      await analyzeText(text, requestId, controller.signal);
    } catch {
      if (requestId !== analysisRequestRef.current) return;
      setError("The file could not be read or analyzed in this browser. Try exporting it again as CSV, TSV, TXT or LOG text.");
      setState("error");
    }
  };

  const reset = () => {
    analysisRequestRef.current += 1;
    analysisAbortRef.current?.abort();
    analysisAbortRef.current = null;
    setResult(null);
    setError("");
    setState("idle");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const loadExample = () => {
    const requestId = ++analysisRequestRef.current;
    analysisAbortRef.current?.abort();
    const controller = new AbortController();
    analysisAbortRef.current = controller;
    if (fileInputRef.current) fileInputRef.current.value = "";
    setResult(null);
    setError("");
    setState("reading");
    void analyzeText(exampleLog, requestId, controller.signal).catch(() => {
      if (requestId !== analysisRequestRef.current) return;
      setError("The example could not be analyzed in this browser.");
      setState("error");
    });
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    void handleFile(event.dataTransfer.files?.[0] ?? null);
  };

  return (
    <LocalizedHomepageTree>
      <section id="tools" className="overflow-x-clip border-y border-white/5 bg-[#050505] py-12 text-white sm:py-14">
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="max-w-4xl">
              <div className="text-xs font-black uppercase tracking-[0.24em] text-red-500">
                Quick power check
              </div>
              <h2 className="mt-3 text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">
                Check peak horsepower and torque from a datalog.
              </h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-400 sm:text-base">
                Try a compatible text export from any logging tool. The public result shows only peak torque and estimated peak power; detailed channels stay in the customer Studio.
              </p>
            </div>
            <Link
              href="/tools/torque-power-calculator"
              className="inline-flex items-center text-sm font-black text-zinc-400 transition hover:text-white"
            >
              <Calculator className="mr-2 h-4 w-4 text-red-500" />
              Need the torque calculator?
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>

          <div className="mt-8 grid min-w-0 overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#09090b] shadow-2xl shadow-black/30 lg:grid-cols-[0.78fr_1.22fr]">
            <div className="min-w-0 border-b border-white/10 p-5 sm:p-6 lg:border-b-0 lg:border-r">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-red-800/50 bg-red-950/30 text-red-300">
                  <Upload className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-red-400">
                    01 · Select a datalog
                  </div>
                  <h3 className="mt-1 text-xl font-black">Local power snapshot</h3>
                  <p id="public-log-file-requirements" className="mt-2 text-xs leading-5 text-zinc-500">
                    CSV, TSV, TXT or LOG · maximum 5 MB · up to {publicLogSnapshotMaximumRows.toLocaleString("en-US")} rows
                  </p>
                </div>
              </div>

              <label
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
                className="mt-5 flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-red-800/70 bg-red-950/10 p-5 text-center transition hover:border-red-500 hover:bg-red-950/20 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-900/60"
              >
                <FileSpreadsheet className="h-7 w-7 text-red-400" />
                <span className="mt-3 text-sm font-black text-white">
                  Drop a file here or choose from your device
                </span>
                <span id="public-log-unit-requirement" className="mt-1 text-xs leading-5 text-zinc-500">
                  RPM and actual engine torque in Nm or lb-ft are detected automatically.
                </span>
                <span className="mt-4 rounded-xl bg-[#b1121b] px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-red-950/30">
                  Choose a text datalog
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.tsv,.txt,.log,text/csv,text/plain,text/tab-separated-values"
                  disabled={state === "reading"}
                  aria-label="Choose a local datalog for the quick power check"
                  aria-describedby="public-log-file-requirements public-log-unit-requirement"
                  onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
                  className="sr-only"
                />
              </label>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={loadExample}
                  disabled={state === "reading"}
                  className="text-xs font-black text-zinc-300 transition hover:text-white disabled:cursor-not-allowed disabled:text-zinc-700"
                >
                  Try example data
                </button>
                {state !== "idle" && (
                  <button
                    type="button"
                    onClick={reset}
                    className="inline-flex items-center text-xs font-black text-zinc-500 transition hover:text-white"
                  >
                    <RotateCcw className="mr-2 h-3.5 w-3.5" /> Reset
                  </button>
                )}
              </div>

              {error && (
                <p role="alert" className="mt-4 border-l-2 border-amber-500 bg-amber-950/15 px-3 py-2 text-xs leading-5 text-amber-100">
                  {error}
                </p>
              )}
            </div>

            <div className="min-w-0 p-5 sm:p-6" aria-live="polite">
              {state === "ready" && result ? (
                <SnapshotResults result={result} />
              ) : state === "reading" ? (
                <SnapshotLoading />
              ) : (
                <SnapshotEmpty hasError={state === "error"} />
              )}
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="grid gap-3 text-xs leading-5 text-zinc-500 sm:grid-cols-2">
              <p className="flex items-start gap-2">
                <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                Your source file stays in this browser tab. This snapshot does not upload, store or create a request.
              </p>
              <p className="flex items-start gap-2">
                <Gauge className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                Power is estimated from logged torque and RPM. It is not a dyno measurement, diagnosis or tuning approval.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link
                href="/login?redirect=%2Fdashboard%2Flog-analysis"
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#b1121b] px-4 text-xs font-black text-white transition hover:bg-[#c91824]"
              >
                Log in for full datalog analysis
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </LocalizedHomepageTree>
  );
}

function SnapshotEmpty({ hasError }: { hasError: boolean }) {
  return (
    <div className="flex min-h-[22rem] flex-col items-center justify-center rounded-2xl border border-white/5 bg-black/25 p-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-zinc-500">
        <BarChart3 className="h-7 w-7" />
      </span>
      <div className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-zinc-600">
        02 · Review the snapshot
      </div>
      <h3 className="mt-2 text-xl font-black text-white">
        {hasError ? "The snapshot is waiting for a supported log." : "Your two results will appear here."}
      </h3>
      <p className="mt-3 max-w-md text-sm leading-6 text-zinc-500">
        {hasError
          ? "Choose another CSV, TSV, TXT or LOG export, or try the example to confirm the required RPM and torque structure."
          : "Nothing is calculated until you choose a file or explicitly load the example dataset."}
      </p>
    </div>
  );
}

function SnapshotLoading() {
  return (
    <div role="status" className="min-h-[22rem] animate-pulse rounded-2xl border border-white/5 bg-black/25 p-5">
      <span className="sr-only">Reading and analyzing the selected log</span>
      <div className="h-3 w-32 rounded bg-red-950/70" />
      <div className="mt-4 grid grid-cols-2 gap-2">
        {[0, 1].map((item) => (
          <div key={item} className="h-20 rounded-xl bg-white/[0.05]" />
        ))}
      </div>
      <div className="mt-4 h-48 rounded-xl bg-white/[0.035]" />
    </div>
  );
}

function SnapshotResults({ result }: { result: SnapshotResult }) {
  return (
    <div className="min-w-0">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-800/45 bg-emerald-950/20 text-emerald-300">
          <CheckCircle2 className="h-5 w-5" />
        </span>
        <div>
          <div className="text-xs font-black uppercase tracking-[0.18em] text-red-400">02 · Snapshot ready</div>
          <h3 className="mt-1 text-xl font-black">Your public power result</h3>
          <p className="mt-1 text-xs leading-5 text-zinc-500">Detailed curves, channels and row data are reserved for signed-in customers.</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <SnapshotMetric
          label="Peak torque"
          value={result.peakTorqueNm.toFixed(0)}
          unit="Nm"
        />
        <SnapshotMetric
          label="Est. peak power"
          value={result.peakPowerHp.toFixed(1)}
          unit="HP"
        />
      </div>

      {result.truncated && (
        <p className="mt-3 border-l-2 border-amber-500 bg-amber-950/15 px-3 py-2 text-xs leading-5 text-amber-100">
          The local safety limit was reached. These two peaks use the retained capture window; sign in to review the processing scope.
        </p>
      )}

      <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
        <div className="flex items-start gap-3">
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <div>
            <div className="text-xs font-black uppercase tracking-[0.14em] text-zinc-400">Customer details</div>
            <p className="mt-1 text-xs leading-5 text-zinc-600">Timeline, RPM curve, EGT and EGR observations, every detected numeric channel and downloadable workshop output unlock after login.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SnapshotMetric({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.055] to-white/[0.02] p-5 sm:p-6">
      <div className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-zinc-600">
        {label}
      </div>
      <div className="mt-3 min-w-0 break-words text-4xl font-black tracking-tight text-white sm:text-5xl" title={`${value} ${unit}`}>
        {value}
      </div>
      <div className="mt-2 text-sm font-black text-red-300">{unit}</div>
    </div>
  );
}
