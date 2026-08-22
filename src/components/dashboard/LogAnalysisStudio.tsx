"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type DragEvent } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  Clipboard,
  Download,
  FileSpreadsheet,
  FileText,
  Gauge,
  Home,
  Info,
  LayoutDashboard,
  LockKeyhole,
  RotateCcw,
  Settings,
  ShieldCheck,
  Table2,
  Upload,
  Wrench,
} from "lucide-react";
import {
  analyzeLogStudio,
  maxLogStudioCharacters,
  maxLogStudioChannels,
  maxLogStudioRows,
  type LogStudioAnalysis,
  type LogStudioChannel,
  type LogStudioChannelKind,
  type LogStudioChannelSummary,
  type LogStudioRow,
  type LogStudioUnit,
} from "@/lib/logAnalysisStudio";
import {
  analyzePerformanceLog,
  buildPerformanceReportSvg,
  calculatePowerFromTorque,
  type ParsedPerformanceLog,
  type PerformanceLogAnalysis,
} from "@/lib/performanceReport";
import {
  buildDeterministicLogAnalyzerFallback,
  projectLogAnalyzerResponse,
} from "@/lib/logAnalyzer";

const emptyAnalysis = analyzeLogStudio("");
const maxSelectedChannels = 3;
const chartColors = ["#38bdf8", "#ef4444", "#a78bfa"];

type StudioState = "idle" | "reading" | "ready" | "error";
type StudioView = "overview" | "channels" | "data";

type VehicleContext = {
  brand: string;
  model: string;
  engine: string;
  ecuType: string;
};

const emptyVehicleContext: VehicleContext = {
  brand: "",
  model: "",
  engine: "",
  ecuType: "",
};

const channelKindLabels: Record<LogStudioChannelKind, string> = {
  sample: "Sample",
  time: "Time",
  rpm: "Engine speed",
  torque: "Torque",
  boost_actual: "Boost actual",
  boost_target: "Boost target",
  lambda: "Lambda",
  afr: "AFR",
  throttle: "Throttle",
  pedal: "Pedal",
  iat: "Intake air temperature",
  coolant: "Coolant temperature",
  egt: "Exhaust gas temperature",
  rail_actual: "Rail pressure actual",
  rail_target: "Rail pressure target",
  airflow: "Airflow",
  speed: "Vehicle speed",
  ignition: "Ignition timing",
  other: "Other numeric channel",
};

const preferredChannelKinds: LogStudioChannelKind[] = [
  "torque",
  "boost_actual",
  "boost_target",
  "lambda",
  "afr",
  "throttle",
  "pedal",
  "iat",
  "rail_actual",
  "rail_target",
  "airflow",
  "ignition",
  "rpm",
  "time",
  "other",
];

function buildDemoLog() {
  const header = [
    "Time (s)",
    "Engine Speed (rpm)",
    "Engine Torque (Nm)",
    "Boost Actual (bar)",
    "Boost Target (bar)",
    "Lambda",
    "Throttle (%)",
    "IAT (degC)",
    "Coolant (degC)",
    "Rail Pressure Actual (bar)",
    "Rail Pressure Target (bar)",
    "Airflow (g/s)",
    "Vehicle Speed (km/h)",
    "Ignition Timing (deg)",
  ].join(",");

  const rows = Array.from({ length: 34 }, (_, index) => {
    const progress = index / 33;
    const rpm = 1450 + index * 125;
    const torque = 255 + Math.sin(progress * Math.PI) * 205 - progress * 28;
    const boostTarget = 1.04 + Math.min(0.76, progress * 1.35);
    const boostActual = boostTarget - 0.08 + Math.sin(progress * Math.PI * 3) * 0.035;
    const lambda = 1.02 - Math.sin(progress * Math.PI) * 0.2;
    const throttle = Math.min(100, 38 + index * 2.25);
    const iat = 31 + progress * 17;
    const coolant = 86 + progress * 4;
    const railTarget = 455 + progress * 955;
    const railActual = railTarget - 28 + Math.sin(progress * Math.PI * 4) * 18;
    const airflow = 44 + progress * 218;
    const speed = 48 + progress * 96;
    const ignition = 8 + progress * 13;

    return [
      (index * 0.15).toFixed(2),
      rpm.toFixed(0),
      torque.toFixed(1),
      boostActual.toFixed(3),
      boostTarget.toFixed(3),
      lambda.toFixed(3),
      throttle.toFixed(1),
      iat.toFixed(1),
      coolant.toFixed(1),
      railActual.toFixed(1),
      railTarget.toFixed(1),
      airflow.toFixed(1),
      speed.toFixed(1),
      ignition.toFixed(1),
    ].join(",");
  });

  return [header, ...rows].join("\n");
}

function supportsLogFile(file: File) {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return (
    name.endsWith(".csv") ||
    name.endsWith(".txt") ||
    name.endsWith(".tsv") ||
    type === "text/csv" ||
    type === "text/plain" ||
    type === "text/tab-separated-values"
  );
}

function fileError(file: File) {
  if (!supportsLogFile(file)) return "Choose a CSV, TSV or plain-text log export.";
  if (!file.size) return "This file is empty. Choose a log with a header and numeric rows.";
  if (file.size > maxLogStudioCharacters) {
    return `This local studio accepts files up to ${formatBytes(maxLogStudioCharacters)}.`;
  }
  return "";
}

function formatBytes(bytes: number) {
  if (bytes < 1_000) return `${bytes} B`;
  return `${(bytes / 1_000).toFixed(0)} KB`;
}

function formatValue(value: number | null | undefined, decimals = 1) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: decimals,
  }).format(value);
}

function displayUnit(unit: LogStudioUnit) {
  return unit.symbol ?? unit.raw ?? "";
}

function valueWithUnit(value: number | null | undefined, unit: LogStudioUnit, decimals = 1) {
  const suffix = displayUnit(unit);
  return `${formatValue(value, decimals)}${suffix ? ` ${suffix}` : ""}`;
}

function canonicalValue(value: number | null, unit: LogStudioUnit) {
  if (value === null || unit.toCanonicalFactor === null) return null;
  return value * unit.toCanonicalFactor + (unit.toCanonicalOffset ?? 0);
}

function selectInitialChannels(analysis: LogStudioAnalysis) {
  const axisId = analysis.xAxis?.channelId;
  return [...analysis.channels]
    .filter((channel) => channel.id !== axisId)
    .sort((left, right) => {
      const leftRank = preferredChannelKinds.indexOf(left.kind);
      const rightRank = preferredChannelKinds.indexOf(right.kind);
      return (leftRank === -1 ? 99 : leftRank) - (rightRank === -1 ? 99 : rightRank);
    })
    .slice(0, maxSelectedChannels)
    .map((channel) => channel.id);
}

function performanceFromAnalysis(analysis: LogStudioAnalysis) {
  if (analysis.warnings.some((warning) => warning.startsWith("No header was present"))) {
    return null;
  }
  const rpm = analysis.channels.find(
    (channel) => channel.kind === "rpm" && channel.unit.canonicalSymbol === "rpm"
  );
  const torque = analysis.channels.find(
    (channel) => channel.kind === "torque" && channel.unit.canonicalSymbol === "Nm"
  );
  if (!rpm || !torque) return null;

  const points = analysis.rows.flatMap((row) => {
    const rpmValue = canonicalValue(row.values[rpm.id] ?? null, rpm.unit);
    const torqueValue = canonicalValue(row.values[torque.id] ?? null, torque.unit);
    if (rpmValue === null || torqueValue === null || rpmValue <= 0 || torqueValue <= 0) return [];
    const power = calculatePowerFromTorque(torqueValue, rpmValue);
    return [{ rpm: rpmValue, torque: torqueValue, ...power }];
  });
  if (!points.length) return null;

  const parsed: ParsedPerformanceLog = {
    points,
    format: "autotuner_csv",
    sourceRowCount: analysis.source.sourceRowCount,
    rejectedRowCount: Math.max(0, analysis.source.sourceRowCount - points.length),
  };

  return { parsed, analysis: analyzePerformanceLog(parsed) };
}

function safeDownloadName(sourceName: string) {
  const base = sourceName.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "");
  return (base || "mg-autotech-log").slice(0, 70);
}

export function LogAnalysisStudio() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const analysisRequestRef = useRef(0);
  const [state, setState] = useState<StudioState>("idle");
  const [analysis, setAnalysis] = useState<LogStudioAnalysis>(emptyAnalysis);
  const [sourceName, setSourceName] = useState("");
  const [sourceSize, setSourceSize] = useState<number | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<StudioView>("overview");
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const [activeRowIndex, setActiveRowIndex] = useState(0);
  const [vehicle, setVehicle] = useState<VehicleContext>(emptyVehicleContext);
  const [copyStatus, setCopyStatus] = useState("");

  const performance = useMemo(() => performanceFromAnalysis(analysis), [analysis]);
  const customerReview = useMemo(() => {
    if (!performance) return null;
    const rows = performance.parsed.points.map((point) => ({
      rpm: point.rpm,
      torqueNm: point.torque,
    }));
    const response = buildDeterministicLogAnalyzerFallback({
      source: "browser_tool",
      rows,
      fileName: sourceName,
      vehicle,
    });
    return projectLogAnalyzerResponse(
      response,
      {
        id: "browser-local-log-studio",
        logRows: rows,
        fileName: sourceName,
        vehicle_brand: vehicle.brand,
        vehicle_model: vehicle.model,
        vehicle_engine: vehicle.engine,
        ecu: vehicle.ecuType,
      },
      "customer"
    ).customer;
  }, [performance, sourceName, vehicle]);

  const analyzeText = (text: string, name: string, size: number | null, demo: boolean) => {
    const next = analyzeLogStudio(text);
    setAnalysis(next);
    setSourceName(name);
    setSourceSize(size);
    setIsDemo(demo);
    setActiveRowIndex(0);
    setView("overview");
    setCopyStatus("");

    if (next.status !== "ready") {
      setSelectedChannelIds([]);
      setError(next.warnings[0] ?? "No usable numeric log channels were detected.");
      setState("error");
      return;
    }

    setSelectedChannelIds(selectInitialChannels(next));
    setError("");
    setState("ready");
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    const requestId = ++analysisRequestRef.current;
    const validationError = fileError(file);
    if (validationError) {
      setAnalysis(emptyAnalysis);
      setSourceName(file.name);
      setSourceSize(file.size);
      setIsDemo(false);
      setSelectedChannelIds([]);
      setError(validationError);
      setState("error");
      return;
    }

    setState("reading");
    setError("");
    setCopyStatus("");
    try {
      const text = await file.text();
      if (requestId !== analysisRequestRef.current) return;
      analyzeText(text, file.name, file.size, false);
    } catch {
      if (requestId !== analysisRequestRef.current) return;
      setAnalysis(emptyAnalysis);
      setError("The file could not be read in this browser. Export it again as CSV, TSV or TXT.");
      setState("error");
    }
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    void handleFile(event.dataTransfer.files?.[0] ?? null);
  };

  const loadDemo = () => {
    analysisRequestRef.current += 1;
    if (inputRef.current) inputRef.current.value = "";
    analyzeText(buildDemoLog(), "Synthetic multi-channel demo.csv", null, true);
  };

  const clearLocalData = () => {
    analysisRequestRef.current += 1;
    if (inputRef.current) inputRef.current.value = "";
    setState("idle");
    setAnalysis(emptyAnalysis);
    setSourceName("");
    setSourceSize(null);
    setIsDemo(false);
    setError("");
    setView("overview");
    setSelectedChannelIds([]);
    setActiveRowIndex(0);
    setVehicle(emptyVehicleContext);
    setCopyStatus("");
  };

  const toggleChannel = (channelId: string) => {
    setSelectedChannelIds((current) => {
      if (current.includes(channelId)) return current.filter((id) => id !== channelId);
      if (current.length >= maxSelectedChannels) return current;
      return [...current, channelId];
    });
  };

  const workshopSummary = useMemo(() => {
    if (analysis.status !== "ready") return "";
    const lines = [
      "MG AutoTech · Browser-local log summary",
      `Source: ${sourceName || "Local log"}${isDemo ? " (synthetic demonstration)" : ""}`,
      `Structure: ${analysis.quality.label} · ${analysis.quality.score}/100 · ${analysis.source.acceptedRowCount}/${analysis.source.processedRowCount} rows retained`,
      `Channels: ${analysis.channels.map((channel) => channel.label).join(", ")}`,
      ...analysis.insights.slice(0, 6).map((insight) => `- ${insight.title}: ${insight.text}`),
      ...(customerReview?.recommendations.slice(0, 3).map((item) => `- Review: ${item.text}`) ?? []),
      "Boundary: Descriptive log review only; not a dyno result, diagnosis, calibration approval, component limit or flash-safety decision.",
    ];
    return lines.join("\n");
  }, [analysis, customerReview, isDemo, sourceName]);

  const copyWorkshopSummary = async () => {
    if (!workshopSummary) return;
    try {
      await navigator.clipboard.writeText(workshopSummary);
      setCopyStatus("Workshop summary copied");
    } catch {
      setCopyStatus("Copy was blocked by this browser");
    }
  };

  const downloadPerformanceReport = () => {
    if (!performance) return;
    const svg = buildPerformanceReportSvg({
      fileName: sourceName || "Local log",
      parsed: performance.parsed,
      analysis: performance.analysis,
    });
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeDownloadName(sourceName)}-performance-analysis.svg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <main data-no-translate className="min-h-screen overflow-x-clip bg-[radial-gradient(circle_at_18%_0%,rgba(127,29,29,0.22),transparent_30%),radial-gradient(circle_at_90%_16%,rgba(8,47,73,0.16),transparent_28%),linear-gradient(135deg,#050505,#09090b_52%,#110607)] text-white">
      <div className="flex min-h-screen">
        <StudioSidebar />

        <section className="min-w-0 flex-1">
          <StudioHeader state={state} />
          <StudioMobileNav />

          <div className="mx-auto max-w-[1540px] px-4 py-6 sm:py-8 lg:px-7 xl:px-9">
            <section className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-red-950/30 via-[#0b0b0e] to-[#071018] p-5 shadow-2xl shadow-black/30 sm:p-7">
              <div aria-hidden="true" className="absolute -right-20 -top-28 h-64 w-64 rounded-full bg-red-700/15 blur-3xl" />
              <div className="relative grid gap-6 xl:grid-cols-[1fr_auto] xl:items-end">
                <div className="max-w-4xl">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-red-400">
                    <Activity className="h-4 w-4" /> Customer Log Analysis Studio
                  </div>
                  <h2 className="mt-3 text-3xl font-black leading-tight sm:text-4xl xl:text-5xl">
                    See the channels. Understand the pull.
                  </h2>
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-400 sm:text-base">
                    Review aligned ECU log channels, compare actual and target traces, inspect capture quality and prepare a clearer workshop summary—all inside this browser tab.
                  </p>
                </div>
                <div className="grid gap-2 text-xs text-zinc-400 sm:grid-cols-2 xl:w-[26rem] xl:grid-cols-1">
                  <div className="flex items-center gap-3 rounded-2xl border border-emerald-800/35 bg-emerald-950/15 px-4 py-3">
                    <LockKeyhole className="h-4 w-4 shrink-0 text-emerald-400" />
                    No upload, cloud storage or request is created.
                  </div>
                  <div className="flex items-center gap-3 rounded-2xl border border-amber-800/35 bg-amber-950/15 px-4 py-3">
                    <Gauge className="h-4 w-4 shrink-0 text-amber-400" />
                    Descriptive log review—not a dyno or diagnosis.
                  </div>
                </div>
              </div>
            </section>

            <div className="mt-5 grid min-w-0 gap-5 xl:grid-cols-[21rem_minmax(0,1fr)]">
              <div className="min-w-0 space-y-5">
                <SourcePanel
                  state={state}
                  sourceName={sourceName}
                  sourceSize={sourceSize}
                  isDemo={isDemo}
                  inputRef={inputRef}
                  error={error}
                  onFile={handleFile}
                  onDrop={handleDrop}
                  onDemo={loadDemo}
                  onClear={clearLocalData}
                />
                <VehicleContextPanel vehicle={vehicle} onChange={setVehicle} />
                <InputLimitsPanel />
              </div>

              <div className="min-w-0">
                {state === "ready" ? (
                  <StudioResults
                    analysis={analysis}
                    performance={performance}
                    customerReview={customerReview}
                    view={view}
                    selectedChannelIds={selectedChannelIds}
                    activeRowIndex={activeRowIndex}
                    copyStatus={copyStatus}
                    onView={setView}
                    onToggleChannel={toggleChannel}
                    onActiveRow={setActiveRowIndex}
                    onCopy={copyWorkshopSummary}
                    onDownload={downloadPerformanceReport}
                  />
                ) : state === "reading" ? (
                  <StudioLoading />
                ) : (
                  <StudioEmpty hasError={state === "error"} />
                )}
              </div>
            </div>

            <SafetyBoundary analysis={analysis} />
          </div>
        </section>
      </div>
    </main>
  );
}

function StudioSidebar() {
  return (
    <aside className="hidden w-72 shrink-0 border-r border-white/10 bg-black/70 lg:block">
      <div className="sticky top-0 flex h-screen flex-col px-5 py-6">
        <Link href="/" className="mb-8 flex items-center gap-3">
          <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-red-800/50 bg-[#111] shadow-lg shadow-red-950/40">
            <span className="absolute -top-2 h-5 w-10 rounded-t-full border-t-2 border-red-700" />
            <Gauge className="h-7 w-7 text-red-600" />
          </span>
          <span>
            <span className="block text-xl font-black tracking-wide">MG <span className="text-red-600">AUTOTECH</span></span>
            <span className="block text-xs text-zinc-400">Customer Panel</span>
          </span>
        </Link>

        <nav className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 text-sm" aria-label="Customer dashboard">
          <SidebarLink href="/dashboard" icon={<LayoutDashboard />} label="Dashboard" />
          <SidebarLink href="/new-request" icon={<Upload />} label="New File Request" />
          <SidebarLink href="/dashboard/file-expert" icon={<BrainCircuit />} label="AI File Expert" />
          <SidebarLink href="/dashboard/log-analysis" icon={<Activity />} label="Log Analysis Studio" active />
          <SidebarLink href="/dashboard/orders" icon={<FileText />} label="Active Orders" />
          <SidebarLink href="/dashboard/credits" icon={<Gauge />} label="Buy Credits" />
          <SidebarLink href="/dashboard/settings" icon={<Settings />} label="Settings" />
          <a href="mailto:info@mgautotech.de" className="flex items-center gap-3 rounded-2xl px-4 py-3 font-bold text-zinc-400 transition hover:bg-white/[0.06] hover:text-white">
            <Wrench className="h-5 w-5" /> Support
          </a>
        </nav>

        <div className="mt-5 shrink-0 rounded-3xl border border-sky-900/40 bg-sky-950/15 p-5">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-sky-300">
            <LockKeyhole className="h-4 w-4" /> Browser local
          </div>
          <p className="mt-2 text-xs leading-5 text-zinc-500">Closing or clearing this page removes the current analysis.</p>
        </div>
      </div>
    </aside>
  );
}

function SidebarLink({ href, icon, label, active = false }: { href: string; icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-2xl px-4 py-3 font-bold transition ${active ? "border border-red-800/40 bg-red-950/35 text-white" : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"}`}
    >
      <span className={`[&>svg]:h-5 [&>svg]:w-5 ${active ? "text-red-400" : ""}`}>{icon}</span>
      {label}
    </Link>
  );
}

function StudioHeader({ state }: { state: StudioState }) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-black/80 backdrop-blur-xl">
      <div className="flex min-h-[4.75rem] items-center justify-between gap-4 px-4 py-3 lg:px-8">
        <div className="min-w-0">
          <div className="truncate text-xs font-black uppercase tracking-[0.2em] text-red-500">Customer workspace</div>
          <h1 className="mt-1 truncate text-xl font-black sm:text-2xl">Log Analysis Studio</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden items-center gap-2 rounded-xl border border-emerald-800/30 bg-emerald-950/20 px-3 py-2 text-xs font-black text-emerald-300 sm:inline-flex">
            <span className={`h-2 w-2 rounded-full ${state === "reading" ? "animate-pulse bg-amber-400" : "bg-emerald-400"}`} />
            {state === "reading" ? "Reading locally" : "Local mode"}
          </span>
          <Link href="/dashboard" className="inline-flex min-h-10 items-center rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-black transition hover:bg-white/10 sm:px-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Dashboard
          </Link>
        </div>
      </div>
    </header>
  );
}

function StudioMobileNav() {
  return (
    <nav className="flex gap-2 overflow-x-auto border-b border-white/10 bg-black/45 px-4 py-3 lg:hidden" aria-label="Customer dashboard">
      <Link href="/dashboard" className="shrink-0 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-black"><Home className="mr-2 inline h-4 w-4" />Dashboard</Link>
      <Link href="/new-request" className="shrink-0 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-black"><Upload className="mr-2 inline h-4 w-4" />New Request</Link>
      <Link href="/dashboard/log-analysis" aria-current="page" className="shrink-0 rounded-xl border border-red-800/50 bg-red-950/30 px-4 py-2.5 text-xs font-black"><Activity className="mr-2 inline h-4 w-4" />Log Studio</Link>
      <Link href="/dashboard/orders" className="shrink-0 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-black"><FileText className="mr-2 inline h-4 w-4" />Orders</Link>
    </nav>
  );
}

function SourcePanel({
  state,
  sourceName,
  sourceSize,
  isDemo,
  inputRef,
  error,
  onFile,
  onDrop,
  onDemo,
  onClear,
}: {
  state: StudioState;
  sourceName: string;
  sourceSize: number | null;
  isDemo: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  error: string;
  onFile: (file: File | null) => Promise<void>;
  onDrop: (event: DragEvent<HTMLLabelElement>) => void;
  onDemo: () => void;
  onClear: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#0a0a0c] shadow-xl shadow-black/20">
      <div className="border-b border-white/10 p-5">
        <div className="text-xs font-black uppercase tracking-[0.18em] text-red-400">01 · Source log</div>
        <h3 className="mt-2 text-xl font-black">Start with the actual export</h3>
        <p className="mt-2 text-xs leading-5 text-zinc-500">CSV, TSV or TXT · {formatBytes(maxLogStudioCharacters)} · up to {maxLogStudioRows.toLocaleString("en-US")} rows</p>
      </div>

      <div className="p-4">
        <label
          onDragOver={(event) => event.preventDefault()}
          onDrop={onDrop}
          className="flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-red-800/60 bg-red-950/10 p-5 text-center transition hover:border-red-500 hover:bg-red-950/20 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-900/60"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-800/40 bg-red-950/25 text-red-300">
            <FileSpreadsheet className="h-6 w-6" />
          </span>
          <span className="mt-4 max-w-full break-words text-sm font-black">
            {sourceName || "Drop a log here or choose a file"}
          </span>
          <span className="mt-1 text-xs leading-5 text-zinc-500">
            {isDemo ? "Synthetic demonstration data—never a real vehicle result." : sourceSize !== null ? `${formatBytes(sourceSize)} · processed in this tab` : "Headers and units are detected automatically."}
          </span>
          <span className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-[#b1121b] px-4 text-xs font-black shadow-lg shadow-red-950/30">
            <Upload className="mr-2 h-4 w-4" /> Choose log
          </span>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/plain,text/tab-separated-values"
            disabled={state === "reading"}
            aria-label="Choose a local ECU log file"
            onChange={(event) => void onFile(event.target.files?.[0] ?? null)}
            className="sr-only"
          />
        </label>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={onDemo} disabled={state === "reading"} className="text-xs font-black text-zinc-300 transition hover:text-white disabled:text-zinc-700">Try synthetic demo</button>
          {state !== "idle" && (
            <button type="button" onClick={onClear} className="inline-flex items-center text-xs font-black text-zinc-500 transition hover:text-white">
              <RotateCcw className="mr-2 h-3.5 w-3.5" /> Clear local data
            </button>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-amber-800/35 bg-amber-950/15 p-3 text-xs leading-5 text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" /> {error}
          </p>
        )}
      </div>
    </section>
  );
}

function VehicleContextPanel({ vehicle, onChange }: { vehicle: VehicleContext; onChange: (value: VehicleContext) => void }) {
  const fields: Array<{ key: keyof VehicleContext; label: string; placeholder: string }> = [
    { key: "brand", label: "Brand", placeholder: "e.g. BMW" },
    { key: "model", label: "Model", placeholder: "e.g. 330d" },
    { key: "engine", label: "Engine", placeholder: "e.g. B57" },
    { key: "ecuType", label: "ECU", placeholder: "e.g. MD1CS001" },
  ];

  return (
    <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-5">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-sky-300" />
        <div>
          <h3 className="text-sm font-black">Optional vehicle context</h3>
          <p className="mt-1 text-xs leading-5 text-zinc-500">Used only to make the local review checklist clearer. Nothing is submitted.</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {fields.map((field) => (
          <label key={field.key} className="min-w-0">
            <span className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-zinc-600">{field.label}</span>
            <input
              value={vehicle[field.key]}
              onChange={(event) => onChange({ ...vehicle, [field.key]: event.target.value.slice(0, 60) })}
              placeholder={field.placeholder}
              autoComplete="off"
              className="mt-1 h-10 w-full min-w-0 rounded-xl border border-white/10 bg-black/30 px-3 text-xs font-bold outline-none transition placeholder:text-zinc-700 focus:border-red-700"
            />
          </label>
        ))}
      </div>
    </section>
  );
}

function InputLimitsPanel() {
  return (
    <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.025] p-5">
      <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Supported structure</div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-black/25 p-3"><div className="text-lg font-black">{maxLogStudioRows.toLocaleString("en-US")}</div><div className="mt-1 text-[0.62rem] font-bold text-zinc-600">rows</div></div>
        <div className="rounded-xl bg-black/25 p-3"><div className="text-lg font-black">{maxLogStudioChannels}</div><div className="mt-1 text-[0.62rem] font-bold text-zinc-600">channels</div></div>
        <div className="rounded-xl bg-black/25 p-3"><div className="text-lg font-black">3</div><div className="mt-1 text-[0.62rem] font-bold text-zinc-600">overlays</div></div>
      </div>
      <p className="mt-3 text-[0.7rem] leading-5 text-zinc-600">Comma, semicolon and tab delimiters, quoted fields and decimal-comma values are supported.</p>
    </section>
  );
}

function StudioEmpty({ hasError }: { hasError: boolean }) {
  return (
    <section className="flex min-h-[44rem] flex-col items-center justify-center rounded-[1.75rem] border border-white/10 bg-[#09090b] p-6 text-center shadow-xl shadow-black/20">
      <span className="relative flex h-20 w-20 items-center justify-center rounded-[1.6rem] border border-white/10 bg-white/[0.035] text-zinc-600">
        <BarChart3 className="h-9 w-9" />
        <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-[#09090b] bg-red-500" />
      </span>
      <div className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-zinc-600">02 · Analysis workspace</div>
      <h3 className="mt-3 max-w-xl text-2xl font-black sm:text-3xl">
        {hasError ? "This export needs another look." : "The studio is ready for a real log."}
      </h3>
      <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-500">
        {hasError
          ? "Choose another delimited export or use the synthetic demo to confirm the supported layout. Nothing from the failed file was uploaded."
          : "Select a file to unlock channel detection, normalized overlays, row inspection, structural quality notes and a workshop-ready summary."}
      </p>
      <div className="mt-7 grid w-full max-w-2xl gap-3 sm:grid-cols-3">
        <EmptyFeature icon={<Activity />} title="Aligned channels" detail="Compare up to three logged traces." />
        <EmptyFeature icon={<Table2 />} title="Row inspector" detail="Review the exact captured values." />
        <EmptyFeature icon={<ShieldCheck />} title="Bounded guidance" detail="Descriptive notes with clear limits." />
      </div>
    </section>
  );
}

function EmptyFeature({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-black/25 p-4 text-left">
      <span className="text-red-400 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      <div className="mt-3 text-sm font-black">{title}</div>
      <div className="mt-1 text-xs leading-5 text-zinc-600">{detail}</div>
    </div>
  );
}

function StudioLoading() {
  return (
    <section role="status" className="min-h-[44rem] animate-pulse rounded-[1.75rem] border border-white/10 bg-[#09090b] p-5 shadow-xl shadow-black/20 sm:p-7">
      <span className="sr-only">Reading and analyzing the selected log locally</span>
      <div className="h-3 w-40 rounded bg-red-950/80" />
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => <div key={item} className="h-24 rounded-2xl bg-white/[0.045]" />)}
      </div>
      <div className="mt-5 h-12 rounded-xl bg-white/[0.035]" />
      <div className="mt-5 h-80 rounded-2xl bg-white/[0.03]" />
    </section>
  );
}

function StudioResults({
  analysis,
  performance,
  customerReview,
  view,
  selectedChannelIds,
  activeRowIndex,
  copyStatus,
  onView,
  onToggleChannel,
  onActiveRow,
  onCopy,
  onDownload,
}: {
  analysis: LogStudioAnalysis;
  performance: { parsed: ParsedPerformanceLog; analysis: PerformanceLogAnalysis } | null;
  customerReview: ReturnType<typeof projectLogAnalyzerResponse>["customer"] | null;
  view: StudioView;
  selectedChannelIds: string[];
  activeRowIndex: number;
  copyStatus: string;
  onView: (view: StudioView) => void;
  onToggleChannel: (channelId: string) => void;
  onActiveRow: (index: number) => void;
  onCopy: () => void;
  onDownload: () => void;
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#09090b] shadow-xl shadow-black/20">
      <div className="border-b border-white/10 p-4 sm:p-6">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-red-400">
              <CheckCircle2 className="h-4 w-4" /> Analysis ready
            </div>
            <h3 className="mt-2 text-2xl font-black">Multi-channel capture review</h3>
            <p className="mt-2 text-xs leading-5 text-zinc-500">{analysis.channels.length} numeric channels aligned against {analysis.xAxis?.label ?? "source row"}.</p>
          </div>
          <QualityBadge analysis={analysis} />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-4">
          <Metric label="Rows retained" value={analysis.source.acceptedRowCount.toLocaleString("en-US")} detail={`${analysis.source.rejectedRowCount} rejected`} />
          <Metric label="Detected channels" value={analysis.channels.length.toString()} detail={`up to ${maxLogStudioChannels} retained`} />
          <PerformanceMetric performance={performance} kind="torque" />
          <PerformanceMetric performance={performance} kind="power" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1 border-b border-white/10 bg-black/20 p-2" role="tablist" aria-label="Log analysis view">
        <ViewTab value="overview" activeView={view} onView={onView} icon={<Activity />} label="Overview" />
        <ViewTab value="channels" activeView={view} onView={onView} icon={<BarChart3 />} label="Channels" />
        <ViewTab value="data" activeView={view} onView={onView} icon={<Table2 />} label="Data rows" />
      </div>

      <div
        id={`studio-panel-${view}`}
        role="tabpanel"
        aria-labelledby={`studio-tab-${view}`}
        tabIndex={0}
        className="min-w-0 p-4 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-800 sm:p-6"
      >
        {view === "overview" ? (
          <OverviewView
            analysis={analysis}
            performance={performance}
            customerReview={customerReview}
            selectedChannelIds={selectedChannelIds}
            activeRowIndex={activeRowIndex}
            copyStatus={copyStatus}
            onToggleChannel={onToggleChannel}
            onActiveRow={onActiveRow}
            onCopy={onCopy}
            onDownload={onDownload}
          />
        ) : view === "channels" ? (
          <ChannelsView analysis={analysis} selectedChannelIds={selectedChannelIds} onToggleChannel={onToggleChannel} />
        ) : (
          <DataView analysis={analysis} />
        )}
      </div>
    </section>
  );
}

function QualityBadge({ analysis }: { analysis: LogStudioAnalysis }) {
  const tone = analysis.quality.label === "strong"
    ? "border-emerald-800/45 bg-emerald-950/20 text-emerald-300"
    : analysis.quality.label === "usable"
      ? "border-amber-800/45 bg-amber-950/20 text-amber-300"
      : "border-red-800/45 bg-red-950/20 text-red-300";
  return (
    <span className={`inline-flex shrink-0 items-center gap-2 self-start rounded-full border px-3 py-2 text-[0.68rem] font-black uppercase tracking-[0.12em] ${tone}`}>
      <ShieldCheck className="h-4 w-4" /> {analysis.quality.label} structure · {analysis.quality.score}/100
    </span>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="min-w-0 bg-[#0b0b0e] p-3 sm:p-4">
      <div className="text-[0.62rem] font-black uppercase tracking-[0.13em] text-zinc-600">{label}</div>
      <div className="mt-2 truncate text-2xl font-black" title={value}>{value}</div>
      <div className="mt-1 truncate text-[0.68rem] font-bold text-zinc-600" title={detail}>{detail}</div>
    </div>
  );
}

function PerformanceMetric({ performance, kind }: { performance: { analysis: PerformanceLogAnalysis } | null; kind: "torque" | "power" }) {
  if (kind === "torque") {
    const peak = performance?.analysis.peakTorque;
    return <Metric label="Highest logged torque" value={peak ? `${formatValue(peak.torque, 0)} Nm` : "Not available"} detail={peak ? `at ${formatValue(peak.rpm, 0)} rpm` : "Needs RPM + torque with known units"} />;
  }
  const peak = performance?.analysis.peakPower;
  return <Metric label="Estimated peak power" value={peak ? `${formatValue(peak.hp, 1)} HP` : "Not available"} detail={peak ? `${formatValue(peak.kw, 1)} kW · torque-derived` : "No power claim without valid inputs"} />;
}

function ViewTab({ value, activeView, onView, icon, label }: { value: StudioView; activeView: StudioView; onView: (view: StudioView) => void; icon: React.ReactNode; label: string }) {
  const order: StudioView[] = ["overview", "channels", "data"];
  const active = value === activeView;
  const moveFocus = (next: StudioView) => {
    onView(next);
    window.requestAnimationFrame(() => document.getElementById(`studio-tab-${next}`)?.focus());
  };
  return (
    <button
      type="button"
      role="tab"
      id={`studio-tab-${value}`}
      aria-controls={`studio-panel-${value}`}
      aria-selected={active}
      tabIndex={active ? 0 : -1}
      onClick={() => onView(value)}
      onKeyDown={(event) => {
        const current = order.indexOf(value);
        if (event.key === "ArrowRight") {
          event.preventDefault();
          moveFocus(order[(current + 1) % order.length]);
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          moveFocus(order[(current - 1 + order.length) % order.length]);
        } else if (event.key === "Home") {
          event.preventDefault();
          moveFocus(order[0]);
        } else if (event.key === "End") {
          event.preventDefault();
          moveFocus(order.at(-1)!);
        }
      }}
      className={`inline-flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 text-[0.68rem] font-black transition sm:gap-2 sm:px-4 sm:text-xs ${active ? "bg-white text-black" : "text-zinc-500 hover:bg-white/[0.04] hover:text-white"}`}
    >
      <span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span> {label}
    </button>
  );
}

function OverviewView({
  analysis,
  performance,
  customerReview,
  selectedChannelIds,
  activeRowIndex,
  copyStatus,
  onToggleChannel,
  onActiveRow,
  onCopy,
  onDownload,
}: {
  analysis: LogStudioAnalysis;
  performance: { analysis: PerformanceLogAnalysis } | null;
  customerReview: ReturnType<typeof projectLogAnalyzerResponse>["customer"] | null;
  selectedChannelIds: string[];
  activeRowIndex: number;
  copyStatus: string;
  onToggleChannel: (channelId: string) => void;
  onActiveRow: (index: number) => void;
  onCopy: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="min-w-0 space-y-5">
      <ChannelToggleBar analysis={analysis} selectedChannelIds={selectedChannelIds} onToggle={onToggleChannel} compact />

      <div className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,1.45fr)_minmax(19rem,0.55fr)]">
        <div className="min-w-0">
          <StudioChart analysis={analysis} selectedChannelIds={selectedChannelIds} activeRowIndex={activeRowIndex} onActiveRow={onActiveRow} />
        </div>
        <div className="min-w-0 space-y-4">
          <InsightPanel analysis={analysis} />
          <QualityPanel analysis={analysis} />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ReviewChecklist customerReview={customerReview} hasPerformance={Boolean(performance)} />
        <ExportPanel
          canDownload={Boolean(performance)}
          copyStatus={copyStatus}
          onCopy={onCopy}
          onDownload={onDownload}
        />
      </div>
    </div>
  );
}

function ChannelToggleBar({ analysis, selectedChannelIds, onToggle, compact = false }: { analysis: LogStudioAnalysis; selectedChannelIds: string[]; onToggle: (channelId: string) => void; compact?: boolean }) {
  return (
    <section className={compact ? "" : "rounded-2xl border border-white/10 bg-black/20 p-4"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.15em] text-zinc-500">Chart overlays</div>
          {!compact && <p className="mt-1 text-xs text-zinc-600">Choose up to three channels. Each trace uses its own observed range.</p>}
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-[0.68rem] font-black text-zinc-400">{selectedChannelIds.length}/{maxSelectedChannels} selected</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {analysis.channels.map((channel) => {
          const selectedIndex = selectedChannelIds.indexOf(channel.id);
          const selected = selectedIndex !== -1;
          const disabled = !selected && selectedChannelIds.length >= maxSelectedChannels;
          return (
            <button
              key={channel.id}
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => onToggle(channel.id)}
              className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-[0.68rem] font-black transition disabled:cursor-not-allowed disabled:opacity-35 ${selected ? "border-white/20 bg-white/10 text-white" : "border-white/10 bg-black/20 text-zinc-500 hover:text-white"}`}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: selected ? chartColors[selectedIndex] : "#52525b" }} />
              {channel.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function StudioChart({ analysis, selectedChannelIds, activeRowIndex, onActiveRow }: { analysis: LogStudioAnalysis; selectedChannelIds: string[]; activeRowIndex: number; onActiveRow: (index: number) => void }) {
  const selected = selectedChannelIds.flatMap((id) => {
    const channel = analysis.channels.find((item) => item.id === id);
    const summary = analysis.summaries.find((item) => item.channelId === id);
    return channel && summary ? [{ channel, summary }] : [];
  });
  const width = 920;
  const height = 370;
  const plot = { x: 56, y: 32, width: 828, height: 274 };
  const activeIndex = Math.min(activeRowIndex, Math.max(0, analysis.rows.length - 1));
  const activeRow = analysis.rows[activeIndex];
  const activeX = plot.x + (activeIndex / Math.max(1, analysis.rows.length - 1)) * plot.width;

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
      <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.15em] text-zinc-500">Normalized trend view</div>
          <h4 className="mt-1 text-sm font-black">Aligned source-order traces</h4>
        </div>
        <div className="text-[0.68rem] leading-5 text-zinc-600 sm:max-w-xs sm:text-right">Visual comparison only. Every selected channel uses its own minimum and maximum scale.</div>
      </div>

      {selected.length ? (
        <div className="min-w-0 p-3 sm:p-4">
          <div className="overflow-x-auto">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[42rem]" role="img" aria-labelledby="studio-chart-title studio-chart-description">
              <title id="studio-chart-title">Normalized multi-channel log chart</title>
              <desc id="studio-chart-description">Up to three selected log channels plotted in source row order, each normalized to its own observed range.</desc>
              <rect x={plot.x} y={plot.y} width={plot.width} height={plot.height} rx="16" fill="#08080a" stroke="#27272a" />
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const y = plot.y + plot.height * ratio;
                return <line key={ratio} x1={plot.x} x2={plot.x + plot.width} y1={y} y2={y} stroke="#202024" strokeWidth="1" />;
              })}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const x = plot.x + plot.width * ratio;
                const rowIndex = Math.round((analysis.rows.length - 1) * ratio);
                const row = analysis.rows[rowIndex];
                return (
                  <g key={ratio}>
                    <line x1={x} x2={x} y1={plot.y} y2={plot.y + plot.height} stroke="#18181b" strokeWidth="1" />
                    <text x={x} y={plot.y + plot.height + 28} textAnchor={ratio === 0 ? "start" : ratio === 1 ? "end" : "middle"} fill="#71717a" fontSize="13">{axisRowLabel(row, analysis)}</text>
                  </g>
                );
              })}
              {selected.map(({ channel, summary }, index) => (
                <path
                  key={channel.id}
                  d={channelPath(analysis.rows, channel, summary, plot)}
                  fill="none"
                  stroke={chartColors[index]}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              <line x1={activeX} x2={activeX} y1={plot.y} y2={plot.y + plot.height} stroke="#ffffff" strokeOpacity="0.55" strokeWidth="2" strokeDasharray="5 5" />
              <circle cx={activeX} cy={plot.y + plot.height + 2} r="5" fill="#ffffff" />
              <text x={plot.x} y="19" fill="#52525b" fontSize="12" fontWeight="800">100% OF EACH OBSERVED RANGE</text>
              <text x={plot.x + plot.width} y="19" textAnchor="end" fill="#52525b" fontSize="12" fontWeight="800">SOURCE ORDER · {analysis.xAxis?.label.toUpperCase()}</text>
            </svg>
          </div>

          <label className="mt-2 block">
            <span className="sr-only">Inspect a retained log row</span>
            <input
              type="range"
              min={0}
              max={Math.max(0, analysis.rows.length - 1)}
              value={activeIndex}
              onChange={(event) => onActiveRow(Number(event.target.value))}
              className="h-2 w-full cursor-ew-resize accent-red-600"
            />
          </label>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-zinc-600">Inspector</div>
              <div className="mt-1 text-sm font-black">{activeRow ? axisRowLabel(activeRow, analysis, true) : "—"}</div>
              <div className="mt-1 text-[0.68rem] text-zinc-600">source row {activeRow?.rowNumber ?? "—"}</div>
            </div>
            {selected.map(({ channel }, index) => (
              <div key={channel.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex min-w-0 items-center gap-2 text-[0.62rem] font-black uppercase tracking-[0.1em] text-zinc-600">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: chartColors[index] }} />
                  <span className="truncate">{channel.label}</span>
                </div>
                <div className="mt-1 truncate text-sm font-black" title={valueWithUnit(activeRow?.values[channel.id], channel.unit, 3)}>{valueWithUnit(activeRow?.values[channel.id], channel.unit, 3)}</div>
                <div className="mt-1 text-[0.68rem] text-zinc-600">{channelKindLabels[channel.kind]}</div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[0.68rem] text-zinc-500">
            {selected.map(({ channel, summary }, index) => (
              <span key={channel.id} className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: chartColors[index] }} />
                <strong className="text-zinc-300">{channel.label}</strong> {valueWithUnit(summary.min?.value, channel.unit, 2)}–{valueWithUnit(summary.max?.value, channel.unit, 2)}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex min-h-80 flex-col items-center justify-center p-6 text-center">
          <Activity className="h-8 w-8 text-zinc-700" />
          <h4 className="mt-4 text-sm font-black">Choose at least one chart overlay</h4>
          <p className="mt-2 text-xs text-zinc-600">Use the channel buttons above to add up to three traces.</p>
        </div>
      )}
    </section>
  );
}

function axisRowLabel(row: LogStudioRow | undefined, analysis: LogStudioAnalysis, detailed = false) {
  if (!row || !analysis.xAxis) return "—";
  if (analysis.xAxis.synthetic || !analysis.xAxis.channelId) return detailed ? `Sample ${row.rowNumber}` : row.rowNumber.toString();
  const value = row.values[analysis.xAxis.channelId];
  const label = valueWithUnit(value, analysis.xAxis.unit, detailed ? 3 : 0);
  return detailed ? `${analysis.xAxis.label}: ${label}` : label;
}

function channelPath(rows: LogStudioRow[], channel: LogStudioChannel, summary: LogStudioChannelSummary, plot: { x: number; y: number; width: number; height: number }) {
  if (!summary.min || !summary.max) return "";
  const span = Math.max(1e-9, summary.max.value - summary.min.value);
  let path = "";
  let drawing = false;
  rows.forEach((row, index) => {
    const value = row.values[channel.id];
    if (value === null) {
      drawing = false;
      return;
    }
    const x = plot.x + (index / Math.max(1, rows.length - 1)) * plot.width;
    const normalized = (value - summary.min!.value) / span;
    const y = plot.y + plot.height - normalized * plot.height;
    path += `${drawing ? " L" : " M"}${x.toFixed(2)} ${y.toFixed(2)}`;
    drawing = true;
  });
  return path.trim();
}

function InsightPanel({ analysis }: { analysis: LogStudioAnalysis }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
      <div className="text-xs font-black uppercase tracking-[0.15em] text-red-400">Detected observations</div>
      <div className="mt-3 space-y-3">
        {analysis.insights.slice(0, 5).map((insight) => (
          <article key={insight.id} className={`border-l-2 pl-3 ${insight.severity === "caution" ? "border-amber-500" : "border-sky-500"}`}>
            <h5 className="text-xs font-black text-zinc-200">{insight.title}</h5>
            <p className="mt-1 text-[0.7rem] leading-5 text-zinc-500">{insight.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function QualityPanel({ analysis }: { analysis: LogStudioAnalysis }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-black uppercase tracking-[0.15em] text-zinc-500">Capture structure</div>
        <span className="text-sm font-black">{analysis.quality.score}/100</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-red-600 via-amber-400 to-emerald-400" style={{ width: `${analysis.quality.score}%` }} /></div>
      <ul className="mt-3 space-y-2 text-[0.7rem] leading-5 text-zinc-500">
        {analysis.quality.reasons.slice(0, 4).map((reason) => <li key={reason} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-zinc-600" />{reason}</li>)}
      </ul>
      {analysis.warnings.length > 0 && (
        <div className="mt-3 rounded-xl border border-amber-800/30 bg-amber-950/10 p-3 text-[0.7rem] leading-5 text-amber-100/80">
          <AlertTriangle className="mr-2 inline h-3.5 w-3.5 text-amber-400" /> {analysis.warnings[0]}
        </div>
      )}
    </section>
  );
}

function ReviewChecklist({ customerReview, hasPerformance }: { customerReview: ReturnType<typeof projectLogAnalyzerResponse>["customer"] | null; hasPerformance: boolean }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-800/40 bg-sky-950/20 text-sky-300"><ShieldCheck className="h-5 w-5" /></span>
        <div>
          <div className="text-xs font-black uppercase tracking-[0.14em] text-sky-300">Rule-based review checklist</div>
          <h4 className="mt-1 text-lg font-black">What to review next</h4>
        </div>
      </div>
      {customerReview ? (
        <>
          <p className="mt-4 text-xs leading-6 text-zinc-400">{customerReview.summary}</p>
          <div className="mt-4 space-y-2">
            {customerReview.recommendations.slice(0, 4).map((item) => (
              <div key={item.id} className="flex items-start gap-2 rounded-xl border border-white/5 bg-black/20 p-3 text-xs leading-5 text-zinc-400">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" /> {item.text}
              </div>
            ))}
          </div>
          <p className="mt-3 text-[0.68rem] leading-5 text-zinc-600">{customerReview.providerNotice}</p>
        </>
      ) : (
        <div className="mt-4 rounded-xl border border-amber-800/30 bg-amber-950/10 p-4 text-xs leading-6 text-amber-100/85">
          <Info className="mr-2 inline h-4 w-4 text-amber-400" />
          {hasPerformance ? "The local checklist is not available for this structure." : "RPM and torque channels with recognized units are needed for the performance-specific checklist. Multi-channel observations above remain available."}
        </div>
      )}
    </section>
  );
}

function ExportPanel({ canDownload, copyStatus, onCopy, onDownload }: { canDownload: boolean; copyStatus: string; onCopy: () => void; onDownload: () => void }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-800/40 bg-red-950/20 text-red-300"><Clipboard className="h-5 w-5" /></span>
        <div>
          <div className="text-xs font-black uppercase tracking-[0.14em] text-red-300">Local output</div>
          <h4 className="mt-1 text-lg font-black">Take the review to the workshop</h4>
        </div>
      </div>
      <p className="mt-4 text-xs leading-6 text-zinc-500">Copy the bounded findings, or download the RPM/torque SVG when the required channels and units are available.</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={onCopy} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 text-xs font-black transition hover:bg-white/10">
          <Clipboard className="mr-2 h-4 w-4" /> Copy summary
        </button>
        <button type="button" onClick={onDownload} disabled={!canDownload} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#b1121b] px-4 text-xs font-black transition hover:bg-[#c91824] disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500">
          <Download className="mr-2 h-4 w-4" /> Download SVG
        </button>
      </div>
      <p aria-live="polite" className="mt-3 min-h-5 text-[0.68rem] font-bold text-zinc-500">{copyStatus || (canDownload ? "Report uses logged RPM and torque-derived power." : "SVG unlocks only with recognized RPM and Nm channels.")}</p>
    </section>
  );
}

function ChannelsView({ analysis, selectedChannelIds, onToggleChannel }: { analysis: LogStudioAnalysis; selectedChannelIds: string[]; onToggleChannel: (channelId: string) => void }) {
  return (
    <div className="space-y-5">
      <ChannelToggleBar analysis={analysis} selectedChannelIds={selectedChannelIds} onToggle={onToggleChannel} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {analysis.channels.map((channel) => {
          const summary = analysis.summaries.find((item) => item.channelId === channel.id);
          return <ChannelCard key={channel.id} channel={channel} summary={summary} selectedIndex={selectedChannelIds.indexOf(channel.id)} />;
        })}
      </div>
      {analysis.missingChannels.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Not present in this export</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {analysis.missingChannels.map((channel) => <span key={channel} className="rounded-full border border-white/10 px-3 py-1.5 text-[0.68rem] font-bold text-zinc-600">{channel}</span>)}
          </div>
          <p className="mt-3 text-[0.68rem] leading-5 text-zinc-600">Missing does not mean faulty; it only means the channel was not recognized in this source file.</p>
        </section>
      )}
    </div>
  );
}

function ChannelCard({ channel, summary, selectedIndex }: { channel: LogStudioChannel; summary: LogStudioChannelSummary | undefined; selectedIndex: number }) {
  return (
    <article className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-black" title={channel.header}>{channel.label}</div>
          <div className="mt-1 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-zinc-600">{channelKindLabels[channel.kind]}</div>
        </div>
        {selectedIndex >= 0 && <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: chartColors[selectedIndex] }} />}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <ChannelValue label="Minimum" value={valueWithUnit(summary?.min?.value, channel.unit, 2)} />
        <ChannelValue label="Average" value={valueWithUnit(summary?.average, channel.unit, 2)} />
        <ChannelValue label="Maximum" value={valueWithUnit(summary?.max?.value, channel.unit, 2)} />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-[0.68rem] text-zinc-600">
        <span>{channel.numericValueCount} numeric values</span>
        <span>{formatValue(channel.coveragePercent, 1)}% coverage</span>
      </div>
    </article>
  );
}

function ChannelValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-black/25 p-2.5">
      <div className="text-[0.58rem] font-black uppercase tracking-[0.08em] text-zinc-700">{label}</div>
      <div className="mt-1 truncate text-xs font-black" title={value}>{value}</div>
    </div>
  );
}

function DataView({ analysis }: { analysis: LogStudioAnalysis }) {
  const visibleRows = analysis.rows.slice(0, 120);
  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-black/25">
      <div className="flex flex-col gap-2 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Aligned numeric rows</div>
          <div className="mt-1 text-sm font-black">Exact retained values</div>
        </div>
        <span className="text-[0.68rem] font-bold text-zinc-600">Showing {visibleRows.length} of {analysis.rows.length} rows · display capped for browser performance</span>
      </div>
      <div className="max-h-[42rem] overflow-auto">
        <table className="min-w-max text-left text-xs">
          <thead className="sticky top-0 z-10 bg-[#111113] text-[0.62rem] uppercase tracking-[0.1em] text-zinc-500">
            <tr>
              <th scope="col" className="px-3 py-3">Row</th>
              {analysis.channels.map((channel) => <th key={channel.id} scope="col" className="max-w-44 px-3 py-3"><span className="block truncate" title={channel.header}>{channel.label}</span><span className="mt-1 block normal-case tracking-normal text-zinc-700">{displayUnit(channel.unit) || "unit not stated"}</span></th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {visibleRows.map((row) => (
              <tr key={row.rowNumber} className="hover:bg-white/[0.025]">
                <th scope="row" className="px-3 py-2.5 font-black text-zinc-500">{row.rowNumber}</th>
                {analysis.channels.map((channel) => <td key={channel.id} className="px-3 py-2.5 font-mono text-zinc-300">{formatValue(row.values[channel.id], 4)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SafetyBoundary({ analysis }: { analysis: LogStudioAnalysis }) {
  const boundaries = analysis.safetyBoundaries.length ? analysis.safetyBoundaries : emptyAnalysis.safetyBoundaries;
  return (
    <section className="mt-5 rounded-[1.5rem] border border-white/10 bg-black/30 p-5">
      <div className="flex items-start gap-3">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
        <div>
          <div className="text-xs font-black uppercase tracking-[0.16em] text-amber-300">Analysis boundary</div>
          <ul className="mt-2 grid gap-2 text-[0.7rem] leading-5 text-zinc-500 lg:grid-cols-3">
            {boundaries.map((boundary) => <li key={boundary}>{boundary}</li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}
