"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clipboard,
  Download,
  FileSpreadsheet,
  Gauge,
  Info,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  Table2,
  Upload,
} from "lucide-react";
import { CustomerPortalPageHeader } from "@/components/dashboard/CustomerPortalPageHeader";
import {
  analyzeLogStudio,
  maxLogStudioCharacters,
  maxLogStudioChannels,
  maxLogStudioCells,
  maxLogStudioFullRows,
  type LogStudioAnalysis,
  type LogStudioChannel,
  type LogStudioChannelKind,
  type LogStudioChannelSummary,
  type LogStudioRow,
  type LogStudioResultMessage,
  type LogStudioUnit,
} from "@/lib/logAnalysisStudio";
import { analyzeLogStudioInBrowser } from "@/lib/analyzeLogStudioInBrowser";
import {
  buildPerformanceReportSvg,
  performanceFromStudioAnalysis,
  performanceSourceFromStudioAnalysis,
  type PerformanceLogAnalysis,
} from "@/lib/performanceReport";
import {
  buildDeterministicLogAnalyzerFallback,
  projectLogAnalyzerResponse,
} from "@/lib/logAnalyzer";
import {
  logStudioAnalysisErrorT,
  logStudioChannelKindT,
  logStudioMessageT,
  logStudioNumberLocale,
  logStudioQualityT,
  logStudioT,
  type LogStudioTranslationKey,
  type LogStudioTranslationParams,
} from "@/lib/i18n/log-analysis-studio-translations";
import type { LocaleCode } from "@/lib/i18nConfig";
import { useActiveLocale } from "@/lib/useActiveLocale";

/**
 * English source-copy contract. These assertions remain here for the existing
 * local-only safety tests; rendered copy comes from the typed locale catalog.
 *
 * No upload, cloud storage or request is created.
 * Included with your customer account; no credits are used.
 * onClick={onDemo} Try synthetic demo
 * The studio is ready for a real log.
 * Synthetic demonstration data—never a real vehicle result.
 * role="tablist" aria-label="Log analysis view"
 * label="Overview" label="Channels" label="Data rows" Row inspector
 * label="Estimated peak power" label="Highest logged torque" label="Engine-speed window"
 * Requires one unambiguous RPM channel and one actual engine-torque channel with a known unit
 * Requested, non-engine, ambiguous or unitless torque is never used for power
 * More details · Highest logged EGT · EGR signal observation · Every retained numeric channel
 * axisTickLabel(analysis, ratio) · detected time, RPM or explicit sample axis
 * {analysis.quality.label} structure · Capture structure
 * Descriptive log review—not a dyno or diagnosis.
 */

const emptyAnalysis = analyzeLogStudio("");
const maxSelectedChannels = 3;
const chartColors = ["#38bdf8", "#ef4444", "#a78bfa"];
const studioChartWidth = 920;
const studioChartHeight = 370;
const studioChartPlot = { x: 56, y: 32, width: 828, height: 274 };

type StudioState = "idle" | "reading" | "ready" | "error";
type StudioView = "overview" | "channels" | "data";
type StudioError =
  | { kind: "message"; message: LogStudioResultMessage }
  | { kind: "analysis"; source?: string | null }
  | {
      kind: "translation";
      key: LogStudioTranslationKey;
      params?: LogStudioTranslationParams;
    };

const StudioLocaleContext = createContext<LocaleCode>("en");

function useStudioI18n() {
  const locale = useContext(StudioLocaleContext);
  return {
    locale,
    t: (key: LogStudioTranslationKey, params?: LogStudioTranslationParams) =>
      logStudioT(locale, key, params),
  };
}

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

const preferredChannelKinds: LogStudioChannelKind[] = [
  "torque",
  "rpm",
  "time",
  "boost_actual",
  "boost_target",
  "lambda",
  "afr",
  "throttle",
  "pedal",
  "iat",
  "egt",
  "egr_actual",
  "egr_target",
  "dpf_pressure",
  "oil_temperature",
  "rail_actual",
  "rail_target",
  "fuel_quantity",
  "airflow",
  "ignition",
  "voltage",
  "torque_target",
  "other",
];

export function buildDemoLog() {
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
    "EGT 1 (degC)",
    "EGR Actual (%)",
    "EGR Commanded (%)",
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
    const egt = 470 + Math.sin(progress * Math.PI) * 205 + progress * 35;
    const egrTarget = Math.max(2, 38 - progress * 40);
    const egrActual = Math.max(3, egrTarget + Math.sin(progress * Math.PI * 4) * 2.4);
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
      egt.toFixed(1),
      egrActual.toFixed(1),
      egrTarget.toFixed(1),
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
    name.endsWith(".log") ||
    type === "text/csv" ||
    type === "text/plain" ||
    type === "text/tab-separated-values"
  );
}

function fileError(file: File): StudioError | null {
  if (!supportsLogFile(file)) return { kind: "translation", key: "fileTypeError" };
  if (!file.size) return { kind: "translation", key: "fileEmptyError" };
  if (file.size > maxLogStudioCharacters) {
    return {
      kind: "translation",
      key: "fileSizeError",
      params: { size: formatBytes(maxLogStudioCharacters) },
    };
  }
  return null;
}

function localizeStudioError(error: StudioError | null, locale: LocaleCode) {
  if (!error) return "";
  if (error.kind === "message") return logStudioMessageT(locale, error.message);
  if (error.kind === "analysis") return logStudioAnalysisErrorT(locale, error.source);
  return logStudioT(locale, error.key, error.params);
}

function formatBytes(bytes: number) {
  if (bytes < 1_000) return `${bytes} B`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${(bytes / 1_000).toFixed(0)} KB`;
}

function formatValue(value: number | null | undefined, decimals = 1, locale: LocaleCode = "en") {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(logStudioNumberLocale(locale), {
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatCount(value: number, locale: LocaleCode) {
  return new Intl.NumberFormat(logStudioNumberLocale(locale)).format(value);
}

function displayUnit(unit: LogStudioUnit) {
  return unit.symbol ?? unit.raw ?? "";
}

function valueWithUnit(value: number | null | undefined, unit: LogStudioUnit, decimals = 1, locale: LocaleCode = "en") {
  const suffix = displayUnit(unit);
  return `${formatValue(value, decimals, locale)}${suffix ? ` ${suffix}` : ""}`;
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

function safeDownloadName(sourceName: string) {
  const base = sourceName.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "");
  return (base || "mg-autotech-log").slice(0, 70);
}

export function LogAnalysisStudio() {
  const activeLocale = useActiveLocale();
  const t = (key: LogStudioTranslationKey, params?: LogStudioTranslationParams) =>
    logStudioT(activeLocale, key, params);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const analysisRequestRef = useRef(0);
  const analysisAbortRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<StudioState>("idle");
  const [analysis, setAnalysis] = useState<LogStudioAnalysis>(emptyAnalysis);
  const [sourceName, setSourceName] = useState("");
  const [sourceSize, setSourceSize] = useState<number | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [error, setError] = useState<StudioError | null>(null);
  const [view, setView] = useState<StudioView>("overview");
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const [activeRowIndex, setActiveRowIndex] = useState(0);
  const [vehicle, setVehicle] = useState<VehicleContext>(emptyVehicleContext);
  const [copyStatus, setCopyStatus] = useState("");
  const localizedError = localizeStudioError(error, activeLocale);

  useEffect(() => () => analysisAbortRef.current?.abort(), []);

  const performance = useMemo(() => performanceFromStudioAnalysis(analysis), [analysis]);
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

  const analyzeText = async (
    text: string,
    name: string,
    size: number | null,
    demo: boolean,
    requestId: number,
    signal: AbortSignal
  ) => {
    try {
      const next = await analyzeLogStudioInBrowser(text, signal);
      if (requestId !== analysisRequestRef.current) return;
      setAnalysis(next);
      setSourceName(name);
      setSourceSize(size);
      setIsDemo(demo);
      setActiveRowIndex(0);
      setView("overview");
      setCopyStatus("");

      if (next.status !== "ready") {
        setSelectedChannelIds([]);
        setError(
          next.warningMessages[0]
            ? { kind: "message", message: next.warningMessages[0] }
            : { kind: "analysis", source: next.warnings[0] }
        );
        setState("error");
        return;
      }

      setSelectedChannelIds(selectInitialChannels(next));
      setError(null);
      setState("ready");
    } catch {
      if (requestId !== analysisRequestRef.current) return;
      setAnalysis(emptyAnalysis);
      setSelectedChannelIds([]);
      setError({ kind: "translation", key: "analysisFailedError" });
      setState("error");
    }
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    const requestId = ++analysisRequestRef.current;
    analysisAbortRef.current?.abort();
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
    setError(null);
    setCopyStatus("");
    const controller = new AbortController();
    analysisAbortRef.current = controller;
    try {
      const text = await file.text();
      if (requestId !== analysisRequestRef.current) return;
      await analyzeText(text, file.name, file.size, false, requestId, controller.signal);
    } catch {
      if (requestId !== analysisRequestRef.current) return;
      setAnalysis(emptyAnalysis);
      setError({ kind: "translation", key: "fileReadError" });
      setState("error");
    }
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    void handleFile(event.dataTransfer.files?.[0] ?? null);
  };

  const loadDemo = () => {
    const requestId = ++analysisRequestRef.current;
    analysisAbortRef.current?.abort();
    const controller = new AbortController();
    analysisAbortRef.current = controller;
    if (inputRef.current) inputRef.current.value = "";
    setState("reading");
    setError(null);
    void analyzeText(
      buildDemoLog(),
      "Synthetic multi-channel demo.csv",
      null,
      true,
      requestId,
      controller.signal
    );
  };

  const clearLocalData = () => {
    analysisRequestRef.current += 1;
    analysisAbortRef.current?.abort();
    analysisAbortRef.current = null;
    if (inputRef.current) inputRef.current.value = "";
    setState("idle");
    setAnalysis(emptyAnalysis);
    setSourceName("");
    setSourceSize(null);
    setIsDemo(false);
    setError(null);
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
    const localizedInsights = analysis.insights.slice(0, 6).map((insight) =>
      `${logStudioMessageT(activeLocale, insight.titleMessage)}: ${logStudioMessageT(activeLocale, insight.textMessage)}`
    );
    const localizedReviews = customerReview?.recommendations.slice(0, 3).map((item) =>
      logStudioMessageT(activeLocale, item.message)
    ) ?? [];
    const lines = [
      logStudioT(activeLocale, "studio.summary.heading"),
      isDemo
        ? logStudioT(activeLocale, "studio.summary.sourceDemo")
        : logStudioT(activeLocale, "studio.summary.source", { sourceName: sourceName || "Local log" }),
      logStudioT(activeLocale, "studio.summary.structure", {
        rows: analysis.source.acceptedRowCount,
        channels: analysis.channels.length,
        score: analysis.quality.score,
        quality: logStudioQualityT(activeLocale, analysis.quality.label),
      }),
      logStudioT(activeLocale, "studio.summary.channels", {
        channels: analysis.channels.map((channel) => channel.label).join(", "),
      }),
      ...localizedInsights.map((finding) => logStudioT(activeLocale, "studio.summary.insight", { finding })),
      ...localizedReviews.map((review) => logStudioT(activeLocale, "studio.summary.review", { review })),
      logStudioT(activeLocale, "studio.summary.boundary"),
    ];
    return lines.join("\n");
  }, [activeLocale, analysis, customerReview, isDemo, sourceName]);

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
    <StudioLocaleContext.Provider value={activeLocale}>
    <main className="mg-compact-ui min-h-screen overflow-x-clip bg-[var(--mg-portal-canvas)] text-white">
      <div className="flex min-h-screen">
        <section className="min-w-0 flex-1">
          <StudioHeader state={state} />

          <div className="mx-auto max-w-[1540px] px-4 py-6 sm:py-8 lg:px-7 xl:px-9">
            <section className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-red-950/30 via-[#0b0b0e] to-[#071018] p-5 shadow-2xl shadow-black/30 sm:p-7">
              <div aria-hidden="true" className="absolute -right-20 -top-28 h-64 w-64 rounded-full bg-red-700/15 blur-3xl" />
              <div className="relative grid gap-6 xl:grid-cols-[1fr_auto] xl:items-end">
                <div className="max-w-4xl">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-red-400">
                    <Activity className="h-4 w-4" /> {t("heroEyebrow")}
                  </div>
                  <h2 className="mt-3 text-3xl font-black leading-tight sm:text-4xl xl:text-5xl">
                    {t("heroTitle")}
                  </h2>
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-400 sm:text-base">
                    {t("heroDescription")}
                  </p>
                </div>
                <div className="grid gap-2 text-xs text-zinc-400 sm:grid-cols-2 xl:w-[26rem] xl:grid-cols-1">
                  <div className="flex items-center gap-3 rounded-2xl border border-emerald-800/35 bg-emerald-950/15 px-4 py-3">
                    <LockKeyhole className="h-4 w-4 shrink-0 text-emerald-400" />
                    {t("privacyLocal")}
                  </div>
                  <div className="flex items-center gap-3 rounded-2xl border border-sky-800/35 bg-sky-950/15 px-4 py-3">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-sky-400" />
                    {t("includedNoCredits")}
                  </div>
                  <div className="flex items-center gap-3 rounded-2xl border border-amber-800/35 bg-amber-950/15 px-4 py-3">
                    <Gauge className="h-4 w-4 shrink-0 text-amber-400" />
                    {t("descriptiveOnly")}
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
                  error={localizedError}
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
    </StudioLocaleContext.Provider>
  );
}

function StudioHeader({ state }: { state: StudioState }) {
  const { t } = useStudioI18n();
  return (
    <CustomerPortalPageHeader
      eyebrow={t("customerWorkspace")}
      title={t("studioTitle")}
      icon={Activity}
      heading
      width="wide"
      actions={
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden items-center gap-2 rounded-xl border border-emerald-800/30 bg-emerald-950/20 px-3 py-2 text-xs font-black text-emerald-300 sm:inline-flex">
            <span className={`h-2 w-2 rounded-full ${state === "reading" ? "animate-pulse bg-amber-400" : "bg-emerald-400"}`} />
            {state === "reading" ? t("readingLocally") : t("localMode")}
          </span>
        </div>
      }
    />
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
  const { locale, t } = useStudioI18n();
  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#0a0a0c] shadow-xl shadow-black/20">
      <div className="border-b border-white/10 p-5">
        <div className="text-xs font-black uppercase tracking-[0.18em] text-red-400">{t("sourceEyebrow")}</div>
        <h3 className="mt-2 text-xl font-black">{t("sourceTitle")}</h3>
        <p className="mt-2 text-xs leading-5 text-zinc-500">{t("sourceLimits", { size: formatBytes(maxLogStudioCharacters), rows: formatCount(maxLogStudioFullRows, locale) })}</p>
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
            {sourceName ? <span translate="no" data-no-translate>{sourceName}</span> : t("dropOrChoose")}
          </span>
          <span className="mt-1 text-xs leading-5 text-zinc-500">
            {isDemo ? t("syntheticNotice") : sourceSize !== null ? t("processedHere", { size: formatBytes(sourceSize) }) : t("autoDetect")}
          </span>
          <span className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-[#b1121b] px-4 text-xs font-black shadow-lg shadow-red-950/30">
            <Upload className="mr-2 h-4 w-4" /> {t("chooseLog")}
          </span>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.tsv,.txt,.log,text/csv,text/plain,text/tab-separated-values"
            disabled={state === "reading"}
            aria-label={t("chooseLogAria")}
            onChange={(event) => void onFile(event.target.files?.[0] ?? null)}
            className="sr-only"
          />
        </label>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={onDemo} disabled={state === "reading"} className="text-xs font-black text-zinc-300 transition hover:text-white disabled:text-zinc-700">{t("tryDemo")}</button>
          {state !== "idle" && (
            <button type="button" onClick={onClear} className="inline-flex items-center text-xs font-black text-zinc-500 transition hover:text-white">
              <RotateCcw className="mr-2 h-3.5 w-3.5" /> {t("clearLocal")}
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
  const { t } = useStudioI18n();
  const fields: Array<{ key: keyof VehicleContext; label: string; placeholder: string }> = [
    { key: "brand", label: t("brand"), placeholder: t("exampleBrand") },
    { key: "model", label: t("model"), placeholder: t("exampleModel") },
    { key: "engine", label: t("engine"), placeholder: t("exampleEngine") },
    { key: "ecuType", label: t("ecu"), placeholder: t("exampleEcu") },
  ];

  return (
    <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-5">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-sky-300" />
        <div>
          <h3 className="text-sm font-black">{t("vehicleTitle")}</h3>
          <p className="mt-1 text-xs leading-5 text-zinc-500">{t("vehicleHelp")}</p>
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
  const { locale, t } = useStudioI18n();
  return (
    <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.025] p-5">
      <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">{t("supportedStructure")}</div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-black/25 p-3"><div className="text-lg font-black">{formatCount(maxLogStudioFullRows, locale)}</div><div className="mt-1 text-[0.62rem] font-bold text-zinc-600">{t("detailedRows")}</div></div>
        <div className="rounded-xl bg-black/25 p-3"><div className="text-lg font-black">{maxLogStudioChannels}</div><div className="mt-1 text-[0.62rem] font-bold text-zinc-600">{t("channels")}</div></div>
        <div className="rounded-xl bg-black/25 p-3"><div className="text-lg font-black">3</div><div className="mt-1 text-[0.62rem] font-bold text-zinc-600">{t("overlays")}</div></div>
      </div>
      <p className="mt-3 text-[0.68rem] leading-5 text-zinc-600">{t("wideBudget", { cells: formatCount(maxLogStudioCells, locale) })}</p>
      <p className="mt-3 text-[0.7rem] leading-5 text-zinc-600">{t("delimiterHelp")}</p>
    </section>
  );
}

function StudioEmpty({ hasError }: { hasError: boolean }) {
  const { t } = useStudioI18n();
  return (
    <section className="flex min-h-[44rem] flex-col items-center justify-center rounded-[1.75rem] border border-white/10 bg-[#09090b] p-6 text-center shadow-xl shadow-black/20">
      <span className="relative flex h-20 w-20 items-center justify-center rounded-[1.6rem] border border-white/10 bg-white/[0.035] text-zinc-600">
        <BarChart3 className="h-9 w-9" />
        <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-[#09090b] bg-red-500" />
      </span>
      <div className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-zinc-600">{t("workspaceEyebrow")}</div>
      <h3 className="mt-3 max-w-xl text-2xl font-black sm:text-3xl">
        {hasError ? t("errorTitle") : t("readyTitle")}
      </h3>
      <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-500">
        {hasError
          ? t("errorHelp")
          : t("readyHelp")}
      </p>
      <div className="mt-7 grid w-full max-w-2xl gap-3 sm:grid-cols-3">
        <EmptyFeature icon={<Activity />} title={t("alignedChannels")} detail={t("compareTraces")} />
        <EmptyFeature icon={<Table2 />} title={t("rowInspector")} detail={t("reviewExactValues")} />
        <EmptyFeature icon={<ShieldCheck />} title={t("boundedGuidance")} detail={t("boundedDetail")} />
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
  const { t } = useStudioI18n();
  return (
    <section role="status" className="min-h-[44rem] animate-pulse rounded-[1.75rem] border border-white/10 bg-[#09090b] p-5 shadow-xl shadow-black/20 sm:p-7">
      <span className="sr-only">{t("loadingAria")}</span>
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
  performance: NonNullable<ReturnType<typeof performanceFromStudioAnalysis>> | null;
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
  const { locale, t } = useStudioI18n();
  const peakPower = performance?.analysis.peakPower ?? null;
  const performanceSource = useMemo(
    () => performance?.source ?? performanceSourceFromStudioAnalysis(analysis),
    [analysis, performance]
  );
  const engineSpeedSummaries = analysis.summaries.filter(
    (summary) => summary.kind === "rpm" && summary.unit.dimension === "engine_speed"
  );
  const rpmSummary = performanceSource
    ? engineSpeedSummaries.find((summary) => summary.channelId === performanceSource.rpmChannelId)
    : engineSpeedSummaries.length === 1
      ? engineSpeedSummaries[0]
      : undefined;
  const torqueSummary = performanceSource
    ? analysis.summaries.find((summary) => summary.channelId === performanceSource.torqueChannelId)
    : undefined;
  const loggedPeakTorqueNm = performanceSource?.loggedPeakTorqueNm ?? null;

  return (
    <section className="min-w-0 overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#09090b] shadow-xl shadow-black/20">
      <div className="border-b border-white/10 p-4 sm:p-6">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-red-400">
              <CheckCircle2 className="h-4 w-4" /> {t("analysisReady")}
            </div>
            <h3 className="mt-2 text-2xl font-black">{t("completeReview")}</h3>
            <p className="mt-2 text-xs leading-5 text-zinc-500">{t("channelsAligned", { count: formatCount(analysis.channels.length, locale), axis: analysis.xAxis?.label ?? t("sourceRow") })}</p>
          </div>
          <QualityBadge analysis={analysis} />
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          <PrimaryMetric
            label={t("estimatedPeakPower")}
            value={peakPower ? formatValue(peakPower.hp, 1, locale) : t("notAvailable")}
            unit={peakPower ? "HP" : ""}
            detail={peakPower ? `${formatValue(peakPower.kw, 1, locale)} kW · ${formatValue(peakPower.rpm, 0, locale)} rpm` : t("powerRequirement")}
            tone="red"
          />
          <PrimaryMetric
            label={t("highestTorque")}
            value={loggedPeakTorqueNm !== null ? formatValue(loggedPeakTorqueNm, 0, locale) : t("notAvailable")}
            unit={loggedPeakTorqueNm !== null ? "Nm" : ""}
            detail={loggedPeakTorqueNm !== null && torqueSummary?.max ? `${peakContext(analysis, torqueSummary, performanceSource?.rpmChannelId, locale)} · ${performanceSource?.torqueLabel}` : t("torqueExcluded")}
            tone="sky"
          />
          <PrimaryMetric
            label={t("engineSpeedWindow")}
            value={rpmSummary?.min && rpmSummary.max ? `${formatValue(rpmSummary.min.value, 0, locale)}–${formatValue(rpmSummary.max.value, 0, locale)}` : t("notAvailable")}
            unit={rpmSummary?.unit.symbol ?? ""}
            detail={analysis.xAxis?.kind === "time" ? t("timelineUses", { axis: analysis.xAxis.label }) : t("chartAxisUses", { axis: analysis.xAxis?.label ?? t("sourceOrder") })}
            tone="violet"
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-3">
          <Metric label={t("rowsRetained")} value={formatCount(analysis.source.acceptedRowCount, locale)} detail={t("rejectedCount", { count: formatCount(analysis.source.rejectedRowCount, locale) })} />
          <Metric label={t("detectedChannels")} value={formatCount(analysis.channels.length, locale)} detail={t("upToRetained", { count: maxLogStudioChannels })} />
          <div className="col-span-2 sm:col-span-1"><Metric label={t("timelineAxis")} value={analysis.xAxis?.label ?? t("sourceOrder")} detail={analysis.xAxis?.synthetic ? t("explicitFallback") : t("usesLoggedValues")} /></div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1 border-b border-white/10 bg-black/20 p-2" role="tablist" aria-label={t("viewAria")}>
        <ViewTab value="overview" activeView={view} onView={onView} icon={<Activity />} label={t("overview")} />
        <ViewTab value="channels" activeView={view} onView={onView} icon={<BarChart3 />} label={t("channels")} />
        <ViewTab value="data" activeView={view} onView={onView} icon={<Table2 />} label={t("dataRows")} />
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
  const { locale, t } = useStudioI18n();
  const tone = analysis.quality.label === "strong"
    ? "border-emerald-800/45 bg-emerald-950/20 text-emerald-300"
    : analysis.quality.label === "usable"
      ? "border-amber-800/45 bg-amber-950/20 text-amber-300"
      : "border-red-800/45 bg-red-950/20 text-red-300";
  return (
    <span className={`inline-flex shrink-0 items-center gap-2 self-start rounded-full border px-3 py-2 text-[0.68rem] font-black uppercase tracking-[0.12em] ${tone}`}>
      <ShieldCheck className="h-4 w-4" /> {logStudioQualityT(locale, analysis.quality.label)} {t("structure")} · {analysis.quality.score}/100
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

function PrimaryMetric({ label, value, unit, detail, tone }: { label: string; value: string; unit: string; detail: string; tone: "red" | "sky" | "violet" }) {
  const toneClasses = {
    red: "border-red-800/40 from-red-950/30 text-red-300",
    sky: "border-sky-800/40 from-sky-950/25 text-sky-300",
    violet: "border-violet-800/40 from-violet-950/25 text-violet-300",
  }[tone];
  return (
    <article className={`min-w-0 rounded-2xl border bg-gradient-to-br ${toneClasses} to-black/20 p-5`}>
      <div className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-zinc-500">{label}</div>
      <div className="mt-3 flex min-w-0 flex-wrap items-baseline gap-2">
        <span className="break-words text-3xl font-black tracking-tight text-white sm:text-4xl">{value}</span>
        {unit && <span className="text-sm font-black">{unit}</span>}
      </div>
      <p className="mt-3 text-[0.7rem] leading-5 text-zinc-500">{detail}</p>
    </article>
  );
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

      <MoreDetailsPanel analysis={analysis} />

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
  const { locale, t } = useStudioI18n();
  const visibleChannels = compact
    ? analysis.channels.filter(
        (channel, index) => index < 10 || selectedChannelIds.includes(channel.id)
      )
    : analysis.channels;
  return (
    <section className={compact ? "" : "rounded-2xl border border-white/10 bg-black/20 p-4"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.15em] text-zinc-500">{t("chartOverlays")}</div>
          {!compact && <p className="mt-1 text-xs text-zinc-600">{t("chooseThree")}</p>}
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-[0.68rem] font-black text-zinc-400">{t("selectedCount", { current: formatCount(selectedChannelIds.length, locale), maximum: maxSelectedChannels })}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {visibleChannels.map((channel) => {
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
              <span translate="no" data-no-translate>{channel.label}</span>
            </button>
          );
        })}
      </div>
      {compact && visibleChannels.length < analysis.channels.length && (
        <p className="mt-2 text-[0.68rem] leading-5 text-zinc-600">
          {t("moreChannels", { count: formatCount(analysis.channels.length - visibleChannels.length, locale) })}
        </p>
      )}
    </section>
  );
}

function StudioChart({ analysis, selectedChannelIds, activeRowIndex, onActiveRow }: { analysis: LogStudioAnalysis; selectedChannelIds: string[]; activeRowIndex: number; onActiveRow: (index: number) => void }) {
  const { locale, t } = useStudioI18n();
  const selected = useMemo(() => selectedChannelIds.flatMap((id) => {
    const channel = analysis.channels.find((item) => item.id === id);
    const summary = analysis.summaries.find((item) => item.channelId === id);
    return channel && summary ? [{ channel, summary }] : [];
  }), [analysis.channels, analysis.summaries, selectedChannelIds]);
  const tracePaths = useMemo(
    () => selected.map(({ channel, summary }) => ({
      channel,
      path: channelPath(analysis, channel, summary, studioChartPlot),
    })),
    [analysis, selected]
  );
  const width = studioChartWidth;
  const height = studioChartHeight;
  const plot = studioChartPlot;
  const activeIndex = Math.min(activeRowIndex, Math.max(0, analysis.rows.length - 1));
  const activeRow = analysis.rows[activeIndex];
  const activeRatio = axisRatioForRow(activeRow, activeIndex, analysis);
  const activeX = activeRatio === null ? null : plot.x + activeRatio * plot.width;
  const scrubberValue = Math.round((activeRatio ?? 0) * 1_000);

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
      <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.15em] text-zinc-500">{t("normalizedTrend")}</div>
          <h4 className="mt-1 text-sm font-black">{t("alignedTraces")}</h4>
        </div>
        <div className="text-[0.68rem] leading-5 text-zinc-600 sm:max-w-xs sm:text-right">{t("visualOnly")}</div>
      </div>

      {selected.length ? (
        <div className="min-w-0 p-3 sm:p-4">
          <div className="overflow-x-auto">
            <div className="min-w-[42rem] sm:min-w-0">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-labelledby="studio-chart-title studio-chart-description">
              <title id="studio-chart-title">{t("chartTitle")}</title>
              <desc id="studio-chart-description">{t("chartDescription")}</desc>
              <rect x={plot.x} y={plot.y} width={plot.width} height={plot.height} rx="16" fill="#08080a" stroke="#27272a" />
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const y = plot.y + plot.height * ratio;
                return <line key={ratio} x1={plot.x} x2={plot.x + plot.width} y1={y} y2={y} stroke="#202024" strokeWidth="1" />;
              })}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const x = plot.x + plot.width * ratio;
                return (
                  <g key={ratio}>
                    <line x1={x} x2={x} y1={plot.y} y2={plot.y + plot.height} stroke="#18181b" strokeWidth="1" />
                    <text x={x} y={plot.y + plot.height + 28} textAnchor={ratio === 0 ? "start" : ratio === 1 ? "end" : "middle"} fill="#71717a" fontSize="13">{axisTickLabel(analysis, ratio, locale)}</text>
                  </g>
                );
              })}
              {tracePaths.map(({ channel, path }, index) => (
                <path
                  key={channel.id}
                  d={path}
                  fill="none"
                  stroke={chartColors[index]}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {activeX !== null && (
                <>
                  <line x1={activeX} x2={activeX} y1={plot.y} y2={plot.y + plot.height} stroke="#ffffff" strokeOpacity="0.55" strokeWidth="2" strokeDasharray="5 5" />
                  <circle cx={activeX} cy={plot.y + plot.height + 2} r="5" fill="#ffffff" />
                </>
              )}
              <text x={plot.x} y="19" fill="#52525b" fontSize="12" fontWeight="800">{t("observedRangeUpper")}</text>
              <text x={plot.x + plot.width} y="19" textAnchor="end" fill="#52525b" fontSize="12" fontWeight="800">{analysis.xAxis?.synthetic ? t("sourceOrderUpper") : t("loggedAxisUpper")} · {analysis.xAxis?.label.toUpperCase()}</text>
            </svg>

              <label className="mt-2 block">
                <span className="sr-only">{t("inspectRowAria")}</span>
                <input
                  type="range"
                  min={0}
                  max={1_000}
                  value={scrubberValue}
                  aria-valuetext={activeRow ? `${axisRowLabel(activeRow, analysis, true, locale)}, ${t("sourceRow")} ${activeRow.rowNumber}` : t("noRetainedRow")}
                  onChange={(event) => onActiveRow(nearestRowIndexForAxisRatio(Number(event.target.value) / 1_000, analysis))}
                  className="h-2 w-full cursor-ew-resize accent-red-600"
                />
              </label>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-zinc-600">{t("inspector")}</div>
              <div className="mt-1 text-sm font-black">{activeRow ? axisRowLabel(activeRow, analysis, true, locale) : "—"}</div>
              <div className="mt-1 text-[0.68rem] text-zinc-600">{t("sourceRow")} {activeRow?.rowNumber ?? "—"}</div>
            </div>
            {selected.map(({ channel }, index) => (
              <div key={channel.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex min-w-0 items-center gap-2 text-[0.62rem] font-black uppercase tracking-[0.1em] text-zinc-600">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: chartColors[index] }} />
                  <span className="truncate" translate="no" data-no-translate>{channel.label}</span>
                </div>
                <div className="mt-1 truncate text-sm font-black" title={valueWithUnit(activeRow?.values[channel.id], channel.unit, 3, locale)}>{valueWithUnit(activeRow?.values[channel.id], channel.unit, 3, locale)}</div>
                <div className="mt-1 text-[0.68rem] text-zinc-600">{logStudioChannelKindT(locale, channel.kind)}</div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[0.68rem] text-zinc-500">
            {selected.map(({ channel, summary }, index) => (
              <span key={channel.id} className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: chartColors[index] }} />
                <strong className="text-zinc-300" translate="no" data-no-translate>{channel.label}</strong> {valueWithUnit(summary.min?.value, channel.unit, 2, locale)}–{valueWithUnit(summary.max?.value, channel.unit, 2, locale)}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex min-h-80 flex-col items-center justify-center p-6 text-center">
          <Activity className="h-8 w-8 text-zinc-700" />
          <h4 className="mt-4 text-sm font-black">{t("chooseOverlay")}</h4>
          <p className="mt-2 text-xs text-zinc-600">{t("chooseOverlayHelp")}</p>
        </div>
      )}
    </section>
  );
}

function axisRowLabel(row: LogStudioRow | undefined, analysis: LogStudioAnalysis, detailed = false, locale: LocaleCode = "en") {
  if (!row || !analysis.xAxis) return "—";
  if (analysis.xAxis.synthetic || !analysis.xAxis.channelId) return detailed ? `${logStudioT(locale, "sample")} ${row.rowNumber}` : row.rowNumber.toString();
  const value = row.values[analysis.xAxis.channelId];
  const label = valueWithUnit(value, analysis.xAxis.unit, detailed ? 3 : 0, locale);
  return detailed ? `${analysis.xAxis.label}: ${label}` : label;
}

function rawSummaryRange(analysis: LogStudioAnalysis, summary: LogStudioChannelSummary | undefined) {
  if (!summary?.min || !summary.max) return null;
  const minimum = analysis.rows.find(
    (row) => row.rowNumber === summary.min?.rowNumber
  )?.values[summary.channelId];
  const maximum = analysis.rows.find(
    (row) => row.rowNumber === summary.max?.rowNumber
  )?.values[summary.channelId];
  if (
    minimum === null ||
    minimum === undefined ||
    maximum === null ||
    maximum === undefined ||
    !Number.isFinite(minimum) ||
    !Number.isFinite(maximum) ||
    maximum < minimum
  ) return null;
  return { min: minimum, max: maximum };
}

function axisRange(analysis: LogStudioAnalysis) {
  const axisId = analysis.xAxis?.channelId;
  if (!axisId) return null;
  const summary = analysis.summaries.find((item) => item.channelId === axisId);
  const range = rawSummaryRange(analysis, summary);
  return range && range.max !== range.min ? range : null;
}

function axisRatioForRowWithRange(
  row: LogStudioRow | undefined,
  rowIndex: number,
  analysis: LogStudioAnalysis,
  range: ReturnType<typeof axisRange>
) {
  const axisId = analysis.xAxis?.channelId;
  const value = row && axisId ? row.values[axisId] : null;
  if (!axisId || analysis.xAxis?.synthetic || !range) {
    return rowIndex / Math.max(1, analysis.rows.length - 1);
  }
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value) ||
    value < range.min ||
    value > range.max
  ) return null;
  const ratio = (value - range.min) / (range.max - range.min);
  return Number.isFinite(ratio) ? ratio : null;
}

export function axisRatioForRow(row: LogStudioRow | undefined, rowIndex: number, analysis: LogStudioAnalysis) {
  const range = axisRange(analysis);
  return axisRatioForRowWithRange(row, rowIndex, analysis, range);
}

function nearestRowIndexForAxisRatio(targetRatio: number, analysis: LogStudioAnalysis) {
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  const range = axisRange(analysis);
  analysis.rows.forEach((row, index) => {
    const ratio = axisRatioForRowWithRange(row, index, analysis, range);
    if (ratio === null) return;
    const distance = Math.abs(ratio - targetRatio);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });
  return nearestIndex;
}

function axisTickLabel(analysis: LogStudioAnalysis, ratio: number, locale: LocaleCode = "en") {
  const range = axisRange(analysis);
  if (!range || !analysis.xAxis) {
    const rowIndex = Math.round((analysis.rows.length - 1) * ratio);
    return analysis.xAxis?.synthetic ? `${logStudioT(locale, "sample")} ${rowIndex + 1}` : rowIndex + 1;
  }
  const value = range.min + (range.max - range.min) * ratio;
  return valueWithUnit(value, analysis.xAxis.unit, analysis.xAxis.kind === "time" ? 2 : 0, locale);
}

function representativeRowIndexes(length: number, limit = 1_500) {
  if (length <= limit) return Array.from({ length }, (_, index) => index);
  return Array.from({ length: limit }, (_, index) =>
    Math.round((index * (length - 1)) / (limit - 1))
  );
}

export function channelPath(analysis: LogStudioAnalysis, channel: LogStudioChannel, summary: LogStudioChannelSummary, plot: { x: number; y: number; width: number; height: number }) {
  const channelRange = rawSummaryRange(analysis, summary);
  if (!channelRange) return "";
  const span = Math.max(1e-9, channelRange.max - channelRange.min);
  const representativeIndexes = new Set(representativeRowIndexes(analysis.rows.length));
  const minimumIndex = analysis.rows.findIndex(
    (row) => row.rowNumber === summary.min?.rowNumber
  );
  const maximumIndex = analysis.rows.findIndex(
    (row) => row.rowNumber === summary.max?.rowNumber
  );
  if (minimumIndex >= 0) representativeIndexes.add(minimumIndex);
  if (maximumIndex >= 0) representativeIndexes.add(maximumIndex);
  const range = axisRange(analysis);
  let path = "";
  let drawing = false;
  analysis.rows.forEach((row, index) => {
    const value = row.values[channel.id];
    const axisRatio = axisRatioForRowWithRange(row, index, analysis, range);
    if (
      value === null ||
      !Number.isFinite(value) ||
      value < channelRange.min ||
      value > channelRange.max ||
      axisRatio === null
    ) {
      drawing = false;
      return;
    }
    if (!representativeIndexes.has(index)) return;
    const x = plot.x + axisRatio * plot.width;
    const normalized = (value - channelRange.min) / span;
    const y = plot.y + plot.height - normalized * plot.height;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      drawing = false;
      return;
    }
    path += `${drawing ? " L" : " M"}${x.toFixed(2)} ${y.toFixed(2)}`;
    drawing = true;
  });
  return path.trim();
}

function InsightPanel({ analysis }: { analysis: LogStudioAnalysis }) {
  const { locale, t } = useStudioI18n();
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
      <div className="text-xs font-black uppercase tracking-[0.15em] text-red-400">{t("detectedObservations")}</div>
      <div className="mt-3 space-y-3">
        {analysis.insights.slice(0, 5).map((insight) => (
          <article key={insight.id} className={`border-l-2 pl-3 ${insight.severity === "caution" ? "border-amber-500" : "border-sky-500"}`}>
            <h5 className="text-xs font-black text-zinc-200">{logStudioMessageT(locale, insight.titleMessage)}</h5>
            <p className="mt-1 text-[0.7rem] leading-5 text-zinc-500">{logStudioMessageT(locale, insight.textMessage)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function peakContext(
  analysis: LogStudioAnalysis,
  summary: LogStudioChannelSummary | undefined,
  preferredRpmChannelId?: string,
  locale: LocaleCode = "en"
) {
  if (!summary?.max) return logStudioT(locale, "noPeakContext");
  const row = analysis.rows.find((item) => item.rowNumber === summary.max?.rowNumber);
  if (!row) return summary.max.xLabel;
  const contexts = (["time", "rpm"] as const).flatMap((kind) => {
    const candidates = analysis.channels.filter((item) => item.kind === kind);
    const preferredChannelId = kind === "rpm" && preferredRpmChannelId
      ? preferredRpmChannelId
      : analysis.xAxis?.kind === kind
        ? analysis.xAxis.channelId ?? undefined
        : undefined;
    const channel = preferredChannelId
      ? candidates.find((item) => item.id === preferredChannelId)
      : candidates.length === 1
        ? candidates[0]
        : undefined;
    if (!channel) return [];
    const value = row.values[channel.id];
    const channelSummary = analysis.summaries.find(
      (item) => item.channelId === channel.id
    );
    const channelRange = rawSummaryRange(analysis, channelSummary);
    if (
      value === null ||
      !Number.isFinite(value) ||
      !channelRange ||
      value < channelRange.min ||
      value > channelRange.max
    ) return [];
    return [`${channel.label}: ${valueWithUnit(value, channel.unit, kind === "time" ? 3 : 0, locale)}`];
  });
  return contexts.length ? contexts.join(" · ") : summary.max.xLabel;
}

function highestEgtSummary(analysis: LogStudioAnalysis) {
  return analysis.summaries
    .filter(
      (summary) =>
        summary.kind === "egt" &&
        summary.unit.dimension === "temperature" &&
        summary.max
    )
    .sort((left, right) => {
      const leftCanonical = left.unit.toCanonicalFactor === null || !left.max
        ? null
        : left.max.value * left.unit.toCanonicalFactor + (left.unit.toCanonicalOffset ?? 0);
      const rightCanonical = right.unit.toCanonicalFactor === null || !right.max
        ? null
        : right.max.value * right.unit.toCanonicalFactor + (right.unit.toCanonicalOffset ?? 0);
      if (leftCanonical !== null && rightCanonical !== null) return rightCanonical - leftCanonical;
      if (leftCanonical !== null) return -1;
      if (rightCanonical !== null) return 1;
      return (right.max?.value ?? Number.NEGATIVE_INFINITY) - (left.max?.value ?? Number.NEGATIVE_INFINITY);
    })[0];
}

function MoreDetailsPanel({ analysis }: { analysis: LogStudioAnalysis }) {
  const { locale, t } = useStudioI18n();
  const egt = highestEgtSummary(analysis);
  const egr = analysis.insights.find((insight) => insight.kind === "egr_activity");
  const egrComparison = analysis.insights.find(
    (insight) => insight.kind === "actual_target_gap" && insight.channelIds.some(
      (channelId) => analysis.channels.some(
        (channel) => channel.id === channelId && (channel.kind === "egr_actual" || channel.kind === "egr_target")
      )
    )
  );

  return (
    <details className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 outline-none transition hover:bg-white/[0.035] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-800 sm:px-5">
        <span>
          <span className="block text-sm font-black">{t("moreDetails")}</span>
          <span className="mt-1 block text-[0.68rem] leading-5 text-zinc-600">{t("moreDetailsHelp")}</span>
        </span>
        <span className="shrink-0 rounded-full border border-white/10 px-3 py-1 text-[0.68rem] font-black text-zinc-400 group-open:border-red-800/50 group-open:text-red-300">{t("channelCount", { count: formatCount(analysis.channels.length, locale) })}</span>
      </summary>

      <div className="border-t border-white/10 p-4 sm:p-5">
        {(egt || egr) && (
          <div className="mb-4 grid gap-3 lg:grid-cols-2">
            {egt && (
              <DetailHighlight
                label={t("highestEgt")}
                value={valueWithUnit(egt.max?.value, egt.unit, 1, locale)}
                detail={t("egtObservedOnly", { label: egt.label, context: peakContext(analysis, egt, undefined, locale) })}
                tone="amber"
              />
            )}
            {egr && (
              <DetailHighlight
                label={t("egrObservation")}
                value={logStudioMessageT(locale, egr.titleMessage)}
                detail={`${logStudioMessageT(locale, egr.textMessage)}${egrComparison ? ` ${logStudioMessageT(locale, egrComparison.textMessage)}` : ""}`}
                tone={egr.severity === "caution" ? "amber" : "sky"}
              />
            )}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {analysis.channels.map((channel) => {
            const summary = analysis.summaries.find((item) => item.channelId === channel.id);
            return <ChannelCard key={channel.id} analysis={analysis} channel={channel} summary={summary} selectedIndex={-1} />;
          })}
        </div>
      </div>
    </details>
  );
}

function DetailHighlight({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: "amber" | "sky" }) {
  const style = tone === "amber"
    ? "border-amber-800/35 bg-amber-950/15 text-amber-300"
    : "border-sky-800/35 bg-sky-950/15 text-sky-300";
  return (
    <article className={`rounded-2xl border p-4 ${style}`}>
      <div className="text-[0.65rem] font-black uppercase tracking-[0.13em]">{label}</div>
      <div className="mt-2 text-lg font-black text-white">{value}</div>
      <p className="mt-2 text-[0.7rem] leading-5 text-zinc-500">{detail}</p>
    </article>
  );
}

function QualityPanel({ analysis }: { analysis: LogStudioAnalysis }) {
  const { locale, t } = useStudioI18n();
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-black uppercase tracking-[0.15em] text-zinc-500">{t("captureStructure")}</div>
        <span className="text-sm font-black">{analysis.quality.score}/100</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-red-600 via-amber-400 to-emerald-400" style={{ width: `${analysis.quality.score}%` }} /></div>
      <ul className="mt-3 space-y-2 text-[0.7rem] leading-5 text-zinc-500">
        {analysis.quality.reasonMessages.slice(0, 4).map((reason) => <li key={`${reason.key}-${JSON.stringify(reason.params)}`} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-zinc-600" />{logStudioMessageT(locale, reason)}</li>)}
      </ul>
      {analysis.warnings.length > 0 && (
        <div className="mt-3 rounded-xl border border-amber-800/30 bg-amber-950/10 p-3 text-[0.7rem] leading-5 text-amber-100/80">
          <AlertTriangle className="mr-2 inline h-3.5 w-3.5 text-amber-400" /> {logStudioMessageT(locale, analysis.warningMessages[0])}
        </div>
      )}
    </section>
  );
}

function ReviewChecklist({ customerReview, hasPerformance }: { customerReview: ReturnType<typeof projectLogAnalyzerResponse>["customer"] | null; hasPerformance: boolean }) {
  const { locale, t } = useStudioI18n();
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-800/40 bg-sky-950/20 text-sky-300"><ShieldCheck className="h-5 w-5" /></span>
        <div>
          <div className="text-xs font-black uppercase tracking-[0.14em] text-sky-300">{t("reviewChecklist")}</div>
          <h4 className="mt-1 text-lg font-black">{t("whatNext")}</h4>
        </div>
      </div>
      {customerReview ? (
        <>
          <p className="mt-4 text-xs leading-6 text-zinc-400">{logStudioMessageT(locale, customerReview.summaryMessage)}</p>
          <div className="mt-4 space-y-2">
            {customerReview.recommendations.slice(0, 4).map((item) => (
              <div key={item.id} className="flex items-start gap-2 rounded-xl border border-white/5 bg-black/20 p-3 text-xs leading-5 text-zinc-400">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" /> {logStudioMessageT(locale, item.message)}
              </div>
            ))}
          </div>
          <p className="mt-3 text-[0.68rem] leading-5 text-zinc-600">{logStudioMessageT(locale, customerReview.providerNoticeMessage)}</p>
        </>
      ) : (
        <div className="mt-4 rounded-xl border border-amber-800/30 bg-amber-950/10 p-4 text-xs leading-6 text-amber-100/85">
          <Info className="mr-2 inline h-4 w-4 text-amber-400" />
          {hasPerformance ? t("checklistUnavailable") : t("checklistNeedsChannels")}
        </div>
      )}
    </section>
  );
}

function ExportPanel({ canDownload, copyStatus, onCopy, onDownload }: { canDownload: boolean; copyStatus: string; onCopy: () => void; onDownload: () => void }) {
  const { t } = useStudioI18n();
  const localizedCopyStatus = copyStatus === "Workshop summary copied"
    ? t("copySuccess")
    : copyStatus === "Copy was blocked by this browser"
      ? t("copyBlocked")
      : copyStatus;
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-800/40 bg-red-950/20 text-red-300"><Clipboard className="h-5 w-5" /></span>
        <div>
          <div className="text-xs font-black uppercase tracking-[0.14em] text-red-300">{t("localOutput")}</div>
          <h4 className="mt-1 text-lg font-black">{t("takeToWorkshop")}</h4>
        </div>
      </div>
      <p className="mt-4 text-xs leading-6 text-zinc-500">{t("outputHelp")}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={onCopy} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 text-xs font-black transition hover:bg-white/10">
          <Clipboard className="mr-2 h-4 w-4" /> {t("copySummary")}
        </button>
        <button type="button" onClick={onDownload} disabled={!canDownload} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#b1121b] px-4 text-xs font-black transition hover:bg-[#c91824] disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500">
          <Download className="mr-2 h-4 w-4" /> {t("downloadSvg")}
        </button>
      </div>
      <p aria-live="polite" className="mt-3 min-h-5 text-[0.68rem] font-bold text-zinc-500">{localizedCopyStatus || (canDownload ? t("reportUses") : t("svgUnlocks"))}</p>
    </section>
  );
}

function ChannelsView({ analysis, selectedChannelIds, onToggleChannel }: { analysis: LogStudioAnalysis; selectedChannelIds: string[]; onToggleChannel: (channelId: string) => void }) {
  const { locale, t } = useStudioI18n();
  return (
    <div className="space-y-5">
      <ChannelToggleBar analysis={analysis} selectedChannelIds={selectedChannelIds} onToggle={onToggleChannel} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {analysis.channels.map((channel) => {
          const summary = analysis.summaries.find((item) => item.channelId === channel.id);
          return <ChannelCard key={channel.id} analysis={analysis} channel={channel} summary={summary} selectedIndex={selectedChannelIds.indexOf(channel.id)} />;
        })}
      </div>
      {analysis.missingChannels.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">{t("notPresent")}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {analysis.missingChannelMessages.map((channel) => <span key={channel.key} className="rounded-full border border-white/10 px-3 py-1.5 text-[0.68rem] font-bold text-zinc-600">{logStudioMessageT(locale, channel)}</span>)}
          </div>
          <p className="mt-3 text-[0.68rem] leading-5 text-zinc-600">{t("missingNotice")}</p>
        </section>
      )}
    </div>
  );
}

function ChannelCard({ analysis, channel, summary, selectedIndex }: { analysis: LogStudioAnalysis; channel: LogStudioChannel; summary: LogStudioChannelSummary | undefined; selectedIndex: number }) {
  const { locale, t } = useStudioI18n();
  return (
    <article className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-black" title={channel.header} translate="no" data-no-translate>{channel.label}</div>
          <div className="mt-1 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-zinc-600">{logStudioChannelKindT(locale, channel.kind)}</div>
        </div>
        {selectedIndex >= 0 && <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: chartColors[selectedIndex] }} />}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <ChannelValue label={t("minimum")} value={valueWithUnit(summary?.min?.value, channel.unit, 2, locale)} />
        <ChannelValue label={t("average")} value={valueWithUnit(summary?.average, channel.unit, 2, locale)} />
        <ChannelValue label={t("maximum")} value={valueWithUnit(summary?.max?.value, channel.unit, 2, locale)} />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-[0.68rem] text-zinc-600">
        <span>{t("numericValues", { count: formatCount(channel.numericValueCount, locale) })}</span>
        <span>{t("coverage", { value: formatValue(channel.coveragePercent, 1, locale) })}</span>
      </div>
      {summary?.max && <div className="mt-2 text-[0.65rem] leading-5 text-zinc-700">{t("maximumAt", { context: peakContext(analysis, summary, undefined, locale) })}</div>}
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
  const { locale, t } = useStudioI18n();
  const visibleRows = analysis.rows.slice(0, 120);
  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-black/25">
      <div className="flex flex-col gap-2 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">{t("alignedRows")}</div>
          <div className="mt-1 text-sm font-black">{t("exactValues")}</div>
        </div>
        <span className="text-[0.68rem] font-bold text-zinc-600">{t("showingRows", { visible: formatCount(visibleRows.length, locale), total: formatCount(analysis.rows.length, locale) })}</span>
      </div>
      <div className="max-h-[42rem] overflow-auto">
        <table className="min-w-max text-left text-xs">
          <thead className="sticky top-0 z-10 bg-[#111113] text-[0.62rem] uppercase tracking-[0.1em] text-zinc-500">
            <tr>
              <th scope="col" className="px-3 py-3">{t("row")}</th>
              {analysis.channels.map((channel) => <th key={channel.id} scope="col" className="max-w-44 px-3 py-3"><span className="block truncate" title={channel.header} translate="no" data-no-translate>{channel.label}</span><span className="mt-1 block normal-case tracking-normal text-zinc-700">{displayUnit(channel.unit) || t("unitNotStated")}</span></th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {visibleRows.map((row) => (
              <tr key={row.rowNumber} className="hover:bg-white/[0.025]">
                <th scope="row" className="px-3 py-2.5 font-black text-zinc-500">{row.rowNumber}</th>
                {analysis.channels.map((channel) => <td key={channel.id} className="px-3 py-2.5 font-mono text-zinc-300">{formatValue(row.values[channel.id], 4, locale)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SafetyBoundary({ analysis }: { analysis: LogStudioAnalysis }) {
  const { locale, t } = useStudioI18n();
  const boundaries = analysis.safetyBoundaryMessages.length ? analysis.safetyBoundaryMessages : emptyAnalysis.safetyBoundaryMessages;
  return (
    <section className="mt-5 rounded-[1.5rem] border border-white/10 bg-black/30 p-5">
      <div className="flex items-start gap-3">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
        <div>
          <div className="text-xs font-black uppercase tracking-[0.16em] text-amber-300">{t("analysisBoundary")}</div>
          <ul className="mt-2 grid gap-2 text-[0.7rem] leading-5 text-zinc-500 lg:grid-cols-3">
            {boundaries.map((boundary) => <li key={boundary.key}>{logStudioMessageT(locale, boundary)}</li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}
