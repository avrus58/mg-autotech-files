"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Calculator,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Gauge,
  Info,
  Table2,
  TrendingUp,
  Upload,
} from "lucide-react";
import {
  analyzePerformanceLog,
  buildPerformanceReportSvg,
  calculatePowerFromTorque,
  parsePerformanceLog,
  type PerformanceLogAnalysis,
  type PerformanceLogPoint,
} from "@/lib/performanceReport";
import { LocalizedHomepageTree } from "@/lib/homepageLocalization";
import { PublicLogSnapshot } from "@/components/tools/PublicLogSnapshot";

export type PerformanceToolsMode = "combined" | "calculator" | "log";

export function PerformanceTools({
  mode = "combined",
}: {
  mode?: PerformanceToolsMode;
}) {
  if (mode === "combined") {
    return <PublicLogSnapshot />;
  }

  return <DetailedPerformanceTools mode={mode} />;
}

function DetailedPerformanceTools({
  mode,
}: {
  mode: Exclude<PerformanceToolsMode, "combined">;
}) {
  const [torqueNm, setTorqueNm] = useState(430);
  const [rpm, setRpm] = useState(3200);
  const [kwInput, setKwInput] = useState(140);
  const [logFileName, setLogFileName] = useState("");
  const [reportView, setReportView] = useState<"curve" | "data">("curve");
  const [logInput, setLogInput] = useState(
    "1800, 320\n2200, 390\n2600, 430\n3000, 420\n3400, 395\n3800, 360\n4200, 315"
  );

  const power = calculatePowerFromTorque(torqueNm, rpm);
  const hpFromKw = kwInput * 1.34102;
  const psFromKw = kwInput * 1.35962;

  const parsedLog = useMemo(() => parsePerformanceLog(logInput), [logInput]);
  const logAnalysis = useMemo(
    () => analyzePerformanceLog(parsedLog),
    [parsedLog]
  );
  const logPoints = parsedLog.points;
  const peakTorque = logAnalysis.peakTorque;
  const peakPower = logAnalysis.peakPower;
  const showCalculator = mode !== "log";
  const showLogAnalyzer = mode !== "calculator";
  const heading =
    mode === "calculator"
      ? "Convert torque and engine speed into estimated power."
      : mode === "log"
        ? "Turn AutoTuner torque logs into a readable power report."
        : "Torque, RPM and log-based power tools for quick workshop checks.";
  const description =
    mode === "calculator"
      ? "Enter torque and RPM for an instant kW and HP estimate, then convert kW into mechanical HP and metric PS."
      : mode === "log"
        ? "Upload an AutoTuner CSV or paste RPM and torque rows to find peak torque, peak power and a downloadable curve report."
        : "Estimate kW and HP from measured torque and engine speed, or inspect RPM and torque log rows for peak values.";

  const handleLogUpload = async (file: File | null) => {
    if (!file) return;

    const text = await file.text();
    setLogFileName(file.name);
    setLogInput(text);
  };

  const downloadDynoReport = () => {
    if (!logPoints.length) return;

    const svg = buildPerformanceReportSvg({
      fileName: logFileName,
      parsed: parsedLog,
      analysis: logAnalysis,
    });
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const baseName =
      logFileName.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]+/gi, "-") ||
      "mg-autotech-performance-report";

    link.href = url;
    link.download = `${baseName}-performance-analysis.svg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <LocalizedHomepageTree>
      <section id="tools" className="overflow-x-clip bg-[#050505] py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-sm font-black uppercase tracking-[0.25em] text-red-600">
              Performance Tools
            </div>
            <h2 className="mt-3 max-w-4xl text-4xl font-black md:text-5xl">
              {heading}
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-400">
              {description}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/tools"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:border-red-800/60"
            >
              Explore all tools
            </Link>
            <Link
              href="/new-request"
              className="inline-flex items-center justify-center rounded-xl border border-red-800/60 bg-red-950/30 px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-red-900/30"
            >
              Create File Request
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="mx-auto grid min-w-0 max-w-5xl items-start gap-6">
          {showCalculator && <div className="min-w-0 overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20 sm:rounded-[2rem] sm:p-6">
            <div className="mb-5 flex min-w-0 items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-red-800/50 bg-red-950/30 text-red-400">
                <Gauge className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-black uppercase tracking-[0.22em] text-red-400">
                  Manual input
                </div>
                <h3 className="mt-1 min-w-0 text-2xl font-black leading-tight">
                  Torque Power Calculator
                </h3>
                <p className="mt-2 text-xs font-bold leading-5 text-zinc-500">
                  Enter measured torque and RPM. Results update instantly.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                label="Enter torque"
                value={torqueNm}
                suffix="Nm"
                min={50}
                max={1200}
                step={5}
                onChange={setTorqueNm}
              />
              <NumberField
                label="Enter engine speed"
                value={rpm}
                suffix="RPM"
                min={800}
                max={9000}
                step={50}
                onChange={setRpm}
              />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <MetricPanel label="Estimated power" value={power.hp.toFixed(1)} unit="HP" />
              <MetricPanel label="Estimated power" value={power.kw.toFixed(1)} unit="kW" />
            </div>

            <div className="mt-6 min-w-0 rounded-2xl border border-white/10 bg-black/30 p-4 sm:p-5">
              <div className="mb-4 flex min-w-0 items-center gap-3">
                <Calculator className="h-5 w-5 shrink-0 text-red-500" />
                <h4 className="min-w-0 font-black">kW to HP quick convert</h4>
              </div>

              <NumberField
                label="Enter power"
                value={kwInput}
                suffix="kW"
                min={1}
                max={1000}
                step={1}
                onChange={setKwInput}
              />

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <MetricPanel label="Mechanical HP" value={hpFromKw.toFixed(1)} unit="HP" />
                <MetricPanel label="Metric power" value={psFromKw.toFixed(1)} unit="PS" />
              </div>
            </div>
          </div>}

          {showLogAnalyzer && (
            <div className="min-w-0 overflow-hidden rounded-[1.5rem] border border-red-900/50 bg-[#09090b] p-4 shadow-2xl shadow-black/30 sm:rounded-[2rem] sm:p-6">
              <div className="mb-5 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="text-xs font-black uppercase tracking-[0.22em] text-red-400">
                    Performance analysis workspace
                  </div>
                  <h3 className="mt-2 text-2xl font-black leading-tight">
                    RPM, torque and estimated power
                  </h3>
                  <p className="mt-2 max-w-2xl text-xs font-bold leading-5 text-zinc-500">
                    Validate log rows, inspect both curves and export a detailed
                    workshop report without uploading the source file.
                  </p>
                </div>
                <div className="inline-flex shrink-0 items-center gap-2 rounded-full border border-emerald-800/50 bg-emerald-950/25 px-3 py-2 text-xs font-black text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" />
                  Local browser analysis
                </div>
              </div>

              <label className="flex min-w-0 cursor-pointer flex-col gap-4 overflow-hidden rounded-2xl border border-dashed border-red-700/70 bg-red-950/15 p-4 transition hover:border-red-500 hover:bg-red-950/25 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex w-full min-w-0 items-start gap-3 sm:w-auto">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-red-800/50 bg-red-950/30 text-red-300">
                    <Upload className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-red-300">
                      Source log
                    </div>
                    <div className="mt-1 text-sm font-black text-white">
                      Select an AutoTuner CSV
                    </div>
                    <div className="mt-1 break-words text-xs font-bold leading-5 text-zinc-500">
                      {logFileName ||
                        "Engine Speed (rpm) and Engine Torque (Nm) are detected automatically"}
                    </div>
                  </div>
                </div>
                <span className="inline-flex w-full shrink-0 items-center justify-center rounded-xl bg-[#b1121b] px-4 py-3 text-xs font-black text-white shadow-lg shadow-red-950/30 sm:w-auto">
                  Choose CSV
                </span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) =>
                    handleLogUpload(event.target.files?.[0] ?? null)
                  }
                  className="sr-only"
                />
              </label>

              <label className="mt-4 block min-w-0 border-y border-white/10 py-4">
                <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
                      Manual data input
                    </div>
                    <div className="mt-1 text-sm font-black text-white">
                      Paste RPM and torque rows
                    </div>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-black text-zinc-400">
                    RPM, Nm
                  </span>
                </div>
                <textarea
                  value={logInput}
                  onChange={(event) => setLogInput(event.target.value)}
                  rows={5}
                  spellCheck={false}
                  className="w-full resize-y rounded-xl border border-white/10 bg-[#050505] p-4 font-mono text-sm font-bold leading-6 text-white outline-none transition placeholder:text-zinc-600 focus:border-red-600 focus:ring-2 focus:ring-red-900/50"
                  placeholder={"1800, 320\n2200, 390\n2600, 430"}
                />
              </label>

              <div className="grid border-b border-white/10 sm:grid-cols-4 sm:divide-x sm:divide-white/10">
                <LogStatusItem
                  label="Input format"
                  value={
                    parsedLog.format === "autotuner_csv"
                      ? "AutoTuner CSV"
                      : parsedLog.format === "rpm_torque_rows"
                        ? "RPM / Nm rows"
                        : "Not detected"
                  }
                />
                <LogStatusItem
                  label="Rows accepted"
                  value={`${logPoints.length} / ${parsedLog.sourceRowCount}`}
                />
                <LogStatusItem
                  label="RPM coverage"
                  value={
                    logPoints.length
                      ? `${logAnalysis.minRpm.toFixed(0)}–${logAnalysis.maxRpm.toFixed(0)}`
                      : "-"
                  }
                />
                <LogStatusItem
                  label="Data quality"
                  value={`${logAnalysis.qualityScore} / 100`}
                  tone={
                    logAnalysis.quality === "strong"
                      ? "good"
                      : logAnalysis.quality === "usable"
                        ? "review"
                        : "limited"
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-px overflow-hidden border-b border-white/10 bg-white/10 sm:grid-cols-4">
                <ReportMetric
                  label="Peak torque"
                  value={peakTorque ? peakTorque.torque.toFixed(0) : "-"}
                  unit="Nm"
                  detail={peakTorque ? `at ${peakTorque.rpm.toFixed(0)} rpm` : "No valid peak"}
                  accent="cyan"
                />
                <ReportMetric
                  label="Est. peak power"
                  value={peakPower ? peakPower.hp.toFixed(1) : "-"}
                  unit="HP"
                  detail={peakPower ? `at ${peakPower.rpm.toFixed(0)} rpm` : "No valid peak"}
                  accent="red"
                />
                <ReportMetric
                  label="Metric output"
                  value={peakPower ? (peakPower.kw * 1.35962).toFixed(1) : "-"}
                  unit="PS"
                  detail={peakPower ? `${peakPower.kw.toFixed(1)} kW` : "No valid peak"}
                />
                <ReportMetric
                  label="Average torque"
                  value={logPoints.length ? logAnalysis.averageTorque.toFixed(0) : "-"}
                  unit="Nm"
                  detail={logPoints.length ? `${logPoints.length} valid rows` : "Waiting for data"}
                />
              </div>

              <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-black/35">
                <div className="flex flex-col gap-4 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
                      Analysis output
                    </div>
                    <div className="mt-1 text-sm font-black text-white">
                      Torque and power across engine speed
                    </div>
                  </div>
                  <div
                    className="grid grid-cols-2 rounded-xl border border-white/10 bg-black/40 p-1"
                    aria-label="Analysis view"
                  >
                    <button
                      type="button"
                      onClick={() => setReportView("curve")}
                      aria-pressed={reportView === "curve"}
                      className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-lg px-3 text-xs font-black transition ${
                        reportView === "curve"
                          ? "bg-white text-black"
                          : "text-zinc-500 hover:text-white"
                      }`}
                    >
                      <Activity className="h-4 w-4" /> Curve
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportView("data")}
                      aria-pressed={reportView === "data"}
                      className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-lg px-3 text-xs font-black transition ${
                        reportView === "data"
                          ? "bg-white text-black"
                          : "text-zinc-500 hover:text-white"
                      }`}
                    >
                      <Table2 className="h-4 w-4" /> Data
                    </button>
                  </div>
                </div>

                {reportView === "curve" ? (
                  <PerformanceCurveChart analysis={logAnalysis} />
                ) : (
                  <PerformanceDataTable points={logAnalysis.sortedPoints} />
                )}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <AnalysisInsight
                  icon={<TrendingUp className="h-4 w-4" />}
                  label="Torque retention"
                  value={
                    logPoints.length
                      ? `${logAnalysis.torqueRetentionPercent.toFixed(0)}%`
                      : "-"
                  }
                  detail="at the final logged RPM"
                />
                <AnalysisInsight
                  icon={<Gauge className="h-4 w-4" />}
                  label="RPM span"
                  value={logPoints.length ? logAnalysis.rpmSpan.toFixed(0) : "-"}
                  detail="rpm between first and last point"
                />
                <AnalysisInsight
                  icon={<FileSpreadsheet className="h-4 w-4" />}
                  label="Rejected rows"
                  value={parsedLog.rejectedRowCount.toString()}
                  detail="excluded from every calculation"
                />
              </div>

              <div
                className={`mt-4 flex items-start gap-3 border-l-2 p-4 text-xs leading-6 ${
                  logAnalysis.warnings.length
                    ? "border-amber-500 bg-amber-950/15 text-amber-100"
                    : "border-emerald-500 bg-emerald-950/15 text-emerald-100"
                }`}
              >
                {logAnalysis.warnings.length ? (
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                )}
                <div>
                  <span className="font-black">
                    {logAnalysis.warnings.length
                      ? "Review recommended. "
                      : "Log structure looks consistent. "}
                  </span>
                  {logAnalysis.warnings[0] ||
                    "No rejected rows, duplicate RPM values or ordering conflicts were detected."}
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-4 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-black text-white">
                    Detailed MG AutoTech performance report
                  </div>
                  <p className="mt-1 max-w-xl text-xs leading-5 text-zinc-500">
                    Vector SVG with report ID, source summary, validity score,
                    dual curves, peak data, method notes and representative rows.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={downloadDynoReport}
                  disabled={!logPoints.length}
                  className="inline-flex min-h-12 w-full shrink-0 items-center justify-center rounded-xl bg-[#b1121b] px-5 text-sm font-black text-white shadow-xl shadow-red-950/30 transition hover:bg-[#c91824] disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500 sm:w-auto"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download detailed report
                </button>
              </div>

              <p className="mt-4 flex items-start gap-2 text-[0.7rem] leading-5 text-zinc-600">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Log-based power is estimated from ECU-reported torque and RPM.
                It is not a chassis-dyno certificate and may differ due to torque
                modeling, drivetrain loss, correction method and logging quality.
              </p>
            </div>
          )}
        </div>
      </div>
      </section>
    </LocalizedHomepageTree>
  );
}

function LogStatusItem({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "good" | "review" | "limited";
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-300"
      : tone === "review"
        ? "text-amber-300"
        : tone === "limited"
          ? "text-red-300"
          : "text-white";

  return (
    <div className="min-w-0 px-3 py-4 first:pl-0 last:pr-0 sm:first:pl-3 sm:last:pr-3">
      <div className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-zinc-600">
        {label}
      </div>
      <div className={`mt-1 truncate text-sm font-black ${toneClass}`} title={value}>
        {value}
      </div>
    </div>
  );
}

function ReportMetric({
  label,
  value,
  unit,
  detail,
  accent = "neutral",
}: {
  label: string;
  value: string;
  unit: string;
  detail: string;
  accent?: "neutral" | "red" | "cyan";
}) {
  const valueClass =
    accent === "cyan"
      ? "text-sky-300"
      : accent === "red"
        ? "text-red-300"
        : "text-white";

  return (
    <div className="min-w-0 bg-[#09090b] p-3 sm:p-4">
      <div className="text-[0.65rem] font-black uppercase tracking-[0.13em] text-zinc-600">
        {label}
      </div>
      <div className="mt-2 flex min-w-0 flex-wrap items-end gap-1.5">
        <span className={`text-2xl font-black leading-none sm:text-3xl ${valueClass}`}>
          {value}
        </span>
        <span className="pb-0.5 text-xs font-black text-zinc-400">{unit}</span>
      </div>
      <div className="mt-2 truncate text-[0.68rem] font-bold text-zinc-600" title={detail}>
        {detail}
      </div>
    </div>
  );
}

function AnalysisInsight({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="min-w-0 border-l border-white/10 pl-3 first:border-red-700 first:pl-3">
      <div className="flex items-center gap-2 text-zinc-500">
        {icon}
        <span className="text-[0.65rem] font-black uppercase tracking-[0.12em]">
          {label}
        </span>
      </div>
      <div className="mt-2 text-xl font-black text-white">{value}</div>
      <div className="mt-1 text-[0.68rem] leading-5 text-zinc-600">{detail}</div>
    </div>
  );
}

function PerformanceCurveChart({
  analysis,
}: {
  analysis: PerformanceLogAnalysis;
}) {
  if (!analysis.sortedPoints.length) {
    return (
      <div className="flex aspect-[16/9] min-h-64 flex-col items-center justify-center p-6 text-center">
        <BarChart3 className="h-8 w-8 text-zinc-700" />
        <div className="mt-4 text-sm font-black text-zinc-400">
          No valid curve data
        </div>
        <p className="mt-2 max-w-sm text-xs leading-5 text-zinc-600">
          Add RPM and torque rows to generate the performance curve.
        </p>
      </div>
    );
  }

  const width = 760;
  const height = 330;
  const chart = { x: 52, y: 28, width: 680, height: 252 };
  const maxHp = Math.max(...analysis.sortedPoints.map((point) => point.hp), 1);
  const maxNm = Math.max(...analysis.sortedPoints.map((point) => point.torque), 1);
  const maxScale = Math.ceil(Math.max(maxHp, maxNm) / 50) * 50;
  const xFor = (rpmValue: number) =>
    chart.x +
    ((rpmValue - analysis.minRpm) /
      Math.max(1, analysis.maxRpm - analysis.minRpm)) *
      chart.width;
  const yFor = (value: number) =>
    chart.y + chart.height - (value / maxScale) * chart.height;
  const torquePoints = analysis.sortedPoints
    .map((point) => `${xFor(point.rpm).toFixed(1)},${yFor(point.torque).toFixed(1)}`)
    .join(" ");
  const powerPoints = analysis.sortedPoints
    .map((point) => `${xFor(point.rpm).toFixed(1)},${yFor(point.hp).toFixed(1)}`)
    .join(" ");

  return (
    <div className="min-w-0 p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-[0.68rem] font-black text-zinc-400">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm bg-sky-400" /> Torque Nm
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm bg-red-500" /> Estimated HP
          </span>
        </div>
        <span className="text-[0.68rem] font-bold text-zinc-600">
          {analysis.sortedPoints.length} plotted points
        </span>
      </div>
      <div className="aspect-[16/9] min-h-64 w-full overflow-hidden">
        <svg
          role="img"
          aria-label="Torque and estimated power curve across engine speed"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="h-full w-full"
        >
          <rect width={width} height={height} fill="#070708" />
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = chart.y + chart.height * ratio;
            const label = Math.round(maxScale * (1 - ratio));
            return (
              <g key={`y-${ratio}`}>
                <line
                  x1={chart.x}
                  y1={y}
                  x2={chart.x + chart.width}
                  y2={y}
                  stroke="#27272a"
                  strokeWidth="1"
                />
                <text
                  x={chart.x - 10}
                  y={y + 4}
                  textAnchor="end"
                  fill="#71717a"
                  fontSize="11"
                  fontWeight="700"
                >
                  {label}
                </text>
              </g>
            );
          })}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const x = chart.x + chart.width * ratio;
            const rpmValue = analysis.minRpm + analysis.rpmSpan * ratio;
            return (
              <g key={`x-${ratio}`}>
                <line
                  x1={x}
                  y1={chart.y}
                  x2={x}
                  y2={chart.y + chart.height}
                  stroke="#18181b"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={chart.y + chart.height + 24}
                  textAnchor="middle"
                  fill="#71717a"
                  fontSize="11"
                  fontWeight="700"
                >
                  {Math.round(rpmValue)}
                </text>
              </g>
            );
          })}
          <polyline
            points={torquePoints}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            points={powerPoints}
            fill="none"
            stroke="#ef4444"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          {analysis.peakTorque && (
            <circle
              cx={xFor(analysis.peakTorque.rpm)}
              cy={yFor(analysis.peakTorque.torque)}
              r="6"
              fill="#38bdf8"
              stroke="#e0f2fe"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {analysis.peakPower && (
            <circle
              cx={xFor(analysis.peakPower.rpm)}
              cy={yFor(analysis.peakPower.hp)}
              r="6"
              fill="#ef4444"
              stroke="#fee2e2"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          )}
          <text
            x={chart.x + chart.width}
            y={height - 8}
            textAnchor="end"
            fill="#52525b"
            fontSize="10"
            fontWeight="800"
          >
            ENGINE SPEED (RPM)
          </text>
        </svg>
      </div>
    </div>
  );
}

function PerformanceDataTable({ points }: { points: PerformanceLogPoint[] }) {
  if (!points.length) {
    return (
      <div className="flex min-h-64 items-center justify-center p-6 text-sm font-bold text-zinc-600">
        No valid rows to display.
      </div>
    );
  }

  return (
    <div className="max-h-80 overflow-auto">
      <table className="w-full min-w-[32rem] border-collapse text-left text-xs">
        <thead className="sticky top-0 bg-[#111113] text-[0.65rem] uppercase tracking-[0.12em] text-zinc-500">
          <tr>
            <th className="px-4 py-3 font-black">Point</th>
            <th className="px-4 py-3 font-black">RPM</th>
            <th className="px-4 py-3 font-black">Torque</th>
            <th className="px-4 py-3 font-black">Power kW</th>
            <th className="px-4 py-3 font-black">Power HP</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {points.map((point, index) => (
            <tr key={`${point.rpm}-${point.torque}-${index}`} className="text-zinc-300">
              <td className="px-4 py-3 font-bold text-zinc-600">{index + 1}</td>
              <td className="px-4 py-3 font-black text-white">
                {point.rpm.toFixed(0)}
              </td>
              <td className="px-4 py-3 font-black text-sky-300">
                {point.torque.toFixed(1)} Nm
              </td>
              <td className="px-4 py-3 font-bold">{point.kw.toFixed(1)}</td>
              <td className="px-4 py-3 font-black text-red-300">
                {point.hp.toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NumberField({
  label,
  value,
  suffix,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  suffix: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block min-w-0">
      <div className="mb-2 flex min-w-0 items-center justify-between gap-3">
        <span className="min-w-0 text-sm font-black text-white">{label}</span>
        <span className="shrink-0 rounded-full border border-red-800/45 bg-red-950/20 px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.12em] text-red-200">
          Input
        </span>
      </div>
      <div className="relative min-w-0 rounded-2xl border border-red-900/55 bg-black/45 p-2 shadow-inner shadow-black/40 transition focus-within:border-red-600/70">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          inputMode="decimal"
          aria-label={label}
          onInput={(event) => onChange(Number(event.currentTarget.value))}
          onChange={(event) => onChange(Number(event.currentTarget.value))}
          className="h-14 w-full rounded-xl border border-white/10 bg-[#050505] px-4 pr-20 text-lg font-black text-white outline-none transition placeholder:text-zinc-700 focus:border-red-600 focus:ring-2 focus:ring-red-900/50"
        />
        <span className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-black text-red-200">
          {suffix}
        </span>
      </div>
      <div className="mt-2 flex justify-end">
        <span className="rounded-xl border border-white/10 bg-black/30 px-3 py-1 text-xs font-black text-red-300">
          {value} {suffix}
        </span>
      </div>
    </label>
  );
}

function MetricPanel({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </div>
      <div className="mt-2 flex min-w-0 flex-wrap items-end gap-x-2 gap-y-1">
        <span className="text-3xl font-black leading-none text-white">{value}</span>
        <span className="break-words pb-1 text-xs font-black text-red-300">{unit}</span>
      </div>
    </div>
  );
}
