"use client";

import Link from "next/link";
import { useRef, useState, type DragEvent } from "react";
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
  analyzePerformanceLog,
  parsePerformanceLog,
  type ParsedPerformanceLog,
  type PerformanceLogAnalysis,
  type PerformanceLogPoint,
} from "@/lib/performanceReport";
import { LocalizedHomepageTree } from "@/lib/homepageLocalization";

export const publicLogSnapshotMaxFileBytes = 1_000_000;
export const publicLogSnapshotMaxRows = 2_000;

const exampleLog = [
  "1800, 320",
  "2200, 390",
  "2600, 430",
  "3000, 420",
  "3400, 395",
  "3800, 360",
  "4200, 315",
].join("\n");

type SnapshotState = "idle" | "reading" | "ready" | "error";

type SnapshotResult = {
  sourceLabel: string;
  parsed: ParsedPerformanceLog;
  analysis: PerformanceLogAnalysis;
};

function supportedLogFile(file: File) {
  const lowerName = file.name.toLowerCase();
  const lowerType = file.type.toLowerCase();
  return (
    lowerName.endsWith(".csv") ||
    lowerName.endsWith(".txt") ||
    lowerType === "text/csv" ||
    lowerType === "text/plain"
  );
}

function fileValidationMessage(file: File) {
  if (!supportedLogFile(file)) {
    return "Choose a CSV or plain-text log file.";
  }
  if (file.size === 0) {
    return "This file is empty. Choose a log that contains RPM and torque rows.";
  }
  if (file.size > publicLogSnapshotMaxFileBytes) {
    return "This file is too large for the quick snapshot. Use a CSV or TXT file up to 1 MB.";
  }
  return null;
}

function formatLabel(parsed: ParsedPerformanceLog) {
  if (parsed.format === "autotuner_csv") return "AutoTuner CSV";
  if (parsed.format === "rpm_torque_rows") return "RPM / Nm rows";
  return "Unknown format";
}

export function PublicLogSnapshot() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const analysisRequestRef = useRef(0);
  const [state, setState] = useState<SnapshotState>("idle");
  const [result, setResult] = useState<SnapshotResult | null>(null);
  const [error, setError] = useState("");

  const analyzeText = (text: string, sourceLabel: string) => {
    const parsed = parsePerformanceLog(text);

    if (parsed.sourceRowCount > publicLogSnapshotMaxRows) {
      setResult(null);
      setError(
        "This quick snapshot supports up to 2,000 data rows. Use the full analyzer with a shorter export."
      );
      setState("error");
      return;
    }

    if (!parsed.points.length) {
      setResult(null);
      setError(
        "No valid RPM and torque rows were detected. Look for Engine Speed (rpm) and Engine Torque (Nm) columns."
      );
      setState("error");
      return;
    }

    setResult({
      sourceLabel,
      parsed,
      analysis: analyzePerformanceLog(parsed),
    });
    setError("");
    setState("ready");
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    const requestId = ++analysisRequestRef.current;

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

    try {
      const text = await file.text();
      if (requestId !== analysisRequestRef.current) return;
      analyzeText(text, file.name);
    } catch {
      if (requestId !== analysisRequestRef.current) return;
      setError("The file could not be read in this browser. Try exporting it as a CSV or TXT file.");
      setState("error");
    }
  };

  const reset = () => {
    analysisRequestRef.current += 1;
    setResult(null);
    setError("");
    setState("idle");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const loadExample = () => {
    analysisRequestRef.current += 1;
    if (fileInputRef.current) fileInputRef.current.value = "";
    analyzeText(exampleLog, "MG AutoTech example pull");
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
                Free log snapshot
              </div>
              <h2 className="mt-3 text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">
                Turn an RPM and torque log into a clear first look.
              </h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-400 sm:text-base">
                Select a local CSV or text export to see the useful peaks and curve shape without creating an account or uploading the source file.
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
                    01 · Select a log
                  </div>
                  <h3 className="mt-1 text-xl font-black">Quick browser analysis</h3>
                  <p className="mt-2 text-xs leading-5 text-zinc-500">
                    CSV or TXT · maximum 1 MB · up to 2,000 data rows
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
                <span className="mt-1 text-xs leading-5 text-zinc-500">
                  Engine Speed (rpm) and Engine Torque (Nm) are detected automatically.
                </span>
                <span className="mt-4 rounded-xl bg-[#b1121b] px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-red-950/30">
                  Choose CSV or TXT
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  disabled={state === "reading"}
                  aria-label="Choose an RPM and torque log"
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
                href="/tools/autotuner-log-analyzer"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 text-xs font-black text-white transition hover:border-red-800/60"
              >
                Open full free analyzer
              </Link>
              <Link
                href="/dashboard/log-analysis"
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#b1121b] px-4 text-xs font-black text-white transition hover:bg-[#c91824]"
              >
                Customer analysis studio
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
        {hasError ? "The curve is waiting for a valid log." : "Your curve will appear here."}
      </h3>
      <p className="mt-3 max-w-md text-sm leading-6 text-zinc-500">
        {hasError
          ? "Choose another CSV or TXT export, or try the example to confirm how the quick analysis works."
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
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-20 rounded-xl bg-white/[0.05]" />
        ))}
      </div>
      <div className="mt-4 h-48 rounded-xl bg-white/[0.035]" />
    </div>
  );
}

function SnapshotResults({ result }: { result: SnapshotResult }) {
  const { parsed, analysis } = result;
  const qualityTone =
    analysis.quality === "strong"
      ? "border-emerald-800/50 bg-emerald-950/25 text-emerald-300"
      : analysis.quality === "usable"
        ? "border-amber-800/50 bg-amber-950/25 text-amber-300"
        : "border-red-800/50 bg-red-950/25 text-red-300";

  return (
    <div className="min-w-0">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-xs font-black uppercase tracking-[0.18em] text-red-400">
            02 · Snapshot ready
          </div>
          <h3 className="mt-1 truncate text-xl font-black" title={result.sourceLabel}>
            {result.sourceLabel}
          </h3>
          <p className="mt-1 text-xs text-zinc-500">{formatLabel(parsed)} · local browser result</p>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-2 self-start rounded-full border px-3 py-1.5 text-[0.68rem] font-black uppercase tracking-[0.12em] ${qualityTone}`}>
          <CheckCircle2 className="h-3.5 w-3.5" />
          {analysis.quality} structure · {analysis.qualityScore}/100
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SnapshotMetric
          label="Peak torque"
          value={analysis.peakTorque ? analysis.peakTorque.torque.toFixed(0) : "-"}
          unit="Nm"
        />
        <SnapshotMetric
          label="Est. peak power"
          value={analysis.peakPower ? analysis.peakPower.hp.toFixed(1) : "-"}
          unit="HP"
        />
        <SnapshotMetric
          label="RPM window"
          value={`${analysis.minRpm.toFixed(0)}–${analysis.maxRpm.toFixed(0)}`}
          unit="rpm"
        />
        <SnapshotMetric
          label="Accepted rows"
          value={`${parsed.points.length}/${parsed.sourceRowCount}`}
          unit="rows"
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/35">
        <CompactPerformanceCurve analysis={analysis} />
      </div>

      <p className={`mt-3 flex items-start gap-2 border-l-2 px-3 py-2 text-xs leading-5 ${analysis.warnings.length ? "border-amber-500 bg-amber-950/15 text-amber-100" : "border-emerald-500 bg-emerald-950/15 text-emerald-100"}`}>
        {analysis.warnings.length ? (
          <Gauge className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
        ) : (
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
        )}
        {analysis.warnings[0] || "The row structure is suitable for a quick estimate. Expert interpretation still depends on the vehicle and logging conditions."}
      </p>
    </div>
  );
}

function SnapshotMetric({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.035] p-3">
      <div className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-zinc-600">
        {label}
      </div>
      <div className="mt-2 min-w-0 truncate text-lg font-black text-white" title={`${value} ${unit}`}>
        {value}
      </div>
      <div className="mt-1 text-[0.65rem] font-bold text-red-300">{unit}</div>
    </div>
  );
}

function representativeCurvePoints(points: PerformanceLogPoint[], limit = 160) {
  if (points.length <= limit) return points;
  return Array.from({ length: limit }, (_, index) =>
    points[Math.round((index * (points.length - 1)) / (limit - 1))]
  );
}

function CompactPerformanceCurve({ analysis }: { analysis: PerformanceLogAnalysis }) {
  const points = representativeCurvePoints(analysis.sortedPoints);
  const width = 680;
  const height = 210;
  const chart = { x: 42, y: 20, width: 614, height: 154 };
  const maxHp = Math.max(...points.map((point) => point.hp), 1);
  const maxNm = Math.max(...points.map((point) => point.torque), 1);
  const maxScale = Math.ceil(Math.max(maxHp, maxNm) / 50) * 50;
  const xFor = (rpmValue: number) =>
    chart.x +
    ((rpmValue - analysis.minRpm) / Math.max(1, analysis.maxRpm - analysis.minRpm)) *
      chart.width;
  const yFor = (value: number) =>
    chart.y + chart.height - (value / maxScale) * chart.height;
  const torquePoints = points
    .map((point) => `${xFor(point.rpm).toFixed(1)},${yFor(point.torque).toFixed(1)}`)
    .join(" ");
  const powerPoints = points
    .map((point) => `${xFor(point.rpm).toFixed(1)},${yFor(point.hp).toFixed(1)}`)
    .join(" ");

  return (
    <div className="min-w-0 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[0.65rem] font-black">
        <div className="flex items-center gap-4 text-zinc-400">
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-sm bg-sky-400" /> Torque Nm
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-sm bg-red-500" /> Estimated HP
          </span>
        </div>
        <span className="text-zinc-600">{points.length} plotted points</span>
      </div>
      <svg
        role="img"
        aria-label="Quick torque and estimated power curve across engine speed"
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
      >
        <rect width={width} height={height} fill="#070708" />
        {[0, 0.5, 1].map((ratio) => {
          const y = chart.y + chart.height * ratio;
          const label = Math.round(maxScale * (1 - ratio));
          return (
            <g key={ratio}>
              <line x1={chart.x} y1={y} x2={chart.x + chart.width} y2={y} stroke="#27272a" />
              <text x={chart.x - 8} y={y + 4} textAnchor="end" fill="#71717a" fontSize="10">
                {label}
              </text>
            </g>
          );
        })}
        <polyline
          points={torquePoints}
          fill="none"
          stroke="#38bdf8"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          points={powerPoints}
          fill="none"
          stroke="#ef4444"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <text x={chart.x} y={height - 12} fill="#71717a" fontSize="10">
          {analysis.minRpm.toFixed(0)} rpm
        </text>
        <text x={chart.x + chart.width} y={height - 12} textAnchor="end" fill="#71717a" fontSize="10">
          {analysis.maxRpm.toFixed(0)} rpm
        </text>
      </svg>
    </div>
  );
}
