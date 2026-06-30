"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Calculator,
  Download,
  Gauge,
  Upload,
} from "lucide-react";
type LogPoint = {
  rpm: number;
  torque: number;
  kw: number;
  hp: number;
};

function calculatePowerFromTorque(torqueNm: number, rpm: number) {
  const kw = (torqueNm * rpm) / 9549;
  const hp = kw * 1.34102;

  return { kw, hp };
}

function parseLogInput(input: string) {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const firstLine = lines[0].toLowerCase();

  if (firstLine.includes("engine speed") && firstLine.includes("engine torque")) {
    return parseAutotunerCsv(input);
  }

  return lines
    .map((line) => {
      const [rpmValue, torqueValue] = line
        .split(/[,;\t ]+/)
        .map((value) => Number(value.replace(",", ".")));

      if (
        !Number.isFinite(rpmValue) ||
        !Number.isFinite(torqueValue) ||
        rpmValue <= 0 ||
        torqueValue <= 0
      ) {
        return null;
      }

      const power = calculatePowerFromTorque(torqueValue, rpmValue);

      return {
        rpm: rpmValue,
        torque: torqueValue,
        kw: power.kw,
        hp: power.hp,
      };
    })
    .filter((point): point is LogPoint => Boolean(point));
}

function splitCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());

  return values;
}

function parseAutotunerCsv(input: string) {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]).map((header) =>
    header.toLowerCase().replaceAll(" ", "")
  );
  const rpmIndex = headers.findIndex((header) =>
    header.includes("enginespeed(rpm)")
  );
  const torqueIndex = headers.findIndex((header) =>
    header.includes("enginetorque(nm)")
  );

  if (rpmIndex === -1 || torqueIndex === -1) return [];

  return lines
    .slice(1)
    .map((line) => {
      const values = splitCsvLine(line);
      const rpmValue = Number(values[rpmIndex]?.replace(",", "."));
      const torqueValue = Number(values[torqueIndex]?.replace(",", "."));

      if (
        !Number.isFinite(rpmValue) ||
        !Number.isFinite(torqueValue) ||
        rpmValue <= 0 ||
        torqueValue <= 0
      ) {
        return null;
      }

      const power = calculatePowerFromTorque(torqueValue, rpmValue);

      return {
        rpm: rpmValue,
        torque: torqueValue,
        kw: power.kw,
        hp: power.hp,
      };
    })
    .filter((point): point is LogPoint => Boolean(point));
}

function escapeSvgText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildDynoReportSvg({
  fileName,
  points,
  peakTorque,
  peakPower,
}: {
  fileName: string;
  points: LogPoint[];
  peakTorque: LogPoint | null;
  peakPower: LogPoint | null;
}) {
  const width = 1200;
  const height = 760;
  const chart = {
    x: 90,
    y: 190,
    width: 980,
    height: 430,
  };
  const rpmValues = points.map((point) => point.rpm);
  const minRpm = Math.min(...rpmValues);
  const maxRpm = Math.max(...rpmValues);
  const maxHp = Math.max(...points.map((point) => point.hp), 1);
  const maxNm = Math.max(...points.map((point) => point.torque), 1);
  const maxScale = Math.ceil(Math.max(maxHp, maxNm) / 50) * 50;

  const xFor = (rpmValue: number) =>
    chart.x +
    ((rpmValue - minRpm) / Math.max(1, maxRpm - minRpm)) * chart.width;
  const yFor = (value: number) =>
    chart.y + chart.height - (value / maxScale) * chart.height;

  const hpPolyline = points
    .map((point) => `${xFor(point.rpm).toFixed(1)},${yFor(point.hp).toFixed(1)}`)
    .join(" ");
  const torquePolyline = points
    .map((point) => `${xFor(point.rpm).toFixed(1)},${yFor(point.torque).toFixed(1)}`)
    .join(" ");
  const gridLines = [0, 0.25, 0.5, 0.75, 1]
    .map((ratio) => {
      const y = chart.y + chart.height * ratio;
      const label = Math.round(maxScale * (1 - ratio));

      return `
        <line x1="${chart.x}" y1="${y}" x2="${chart.x + chart.width}" y2="${y}" stroke="#27272a" stroke-width="1"/>
        <text x="${chart.x - 18}" y="${y + 5}" text-anchor="end" fill="#71717a" font-size="18">${label}</text>
      `;
    })
    .join("");
  const rpmLabels = [minRpm, minRpm + (maxRpm - minRpm) / 2, maxRpm]
    .map((rpmValue) => {
      const x = xFor(rpmValue);

      return `<text x="${x}" y="${chart.y + chart.height + 42}" text-anchor="middle" fill="#a1a1aa" font-size="18">${Math.round(rpmValue)} rpm</text>`;
    })
    .join("");
  const peakPs = peakPower ? peakPower.kw * 1.35962 : 0;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#050505"/>
  <rect x="32" y="32" width="${width - 64}" height="${height - 64}" rx="34" fill="#09090b" stroke="#27272a" stroke-width="2"/>
  <circle cx="1040" cy="95" r="150" fill="#7f1d1d" opacity="0.22"/>
  <text x="78" y="92" fill="#ef4444" font-size="22" font-weight="900" letter-spacing="5">MG AUTOTECH</text>
  <text x="78" y="135" fill="#ffffff" font-size="42" font-weight="900">Dyno Log Report</text>
  <text x="78" y="165" fill="#a1a1aa" font-size="18">${escapeSvgText(fileName || "Autotuner CSV log")}</text>

  <rect x="78" y="655" width="1044" height="58" rx="18" fill="#111113" stroke="#27272a"/>
  <text x="104" y="691" fill="#a1a1aa" font-size="18">Calculated from ECU log values. Power is estimated from torque and RPM.</text>

  <rect x="760" y="72" width="150" height="82" rx="18" fill="#111113" stroke="#27272a"/>
  <text x="785" y="105" fill="#a1a1aa" font-size="16">Peak PS</text>
  <text x="785" y="138" fill="#ffffff" font-size="30" font-weight="900">${peakPower ? peakPs.toFixed(1) : "-"}</text>

  <rect x="928" y="72" width="150" height="82" rx="18" fill="#111113" stroke="#27272a"/>
  <text x="953" y="105" fill="#a1a1aa" font-size="16">Peak Nm</text>
  <text x="953" y="138" fill="#ffffff" font-size="30" font-weight="900">${peakTorque ? peakTorque.torque.toFixed(0) : "-"}</text>

  <rect x="${chart.x}" y="${chart.y}" width="${chart.width}" height="${chart.height}" rx="18" fill="#0f0f12" stroke="#27272a" stroke-width="2"/>
  ${gridLines}
  ${rpmLabels}

  <polyline points="${torquePolyline}" fill="none" stroke="#38bdf8" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  <polyline points="${hpPolyline}" fill="none" stroke="#ef4444" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>

  ${
    peakTorque
      ? `<circle cx="${xFor(peakTorque.rpm)}" cy="${yFor(peakTorque.torque)}" r="8" fill="#38bdf8"/>
         <text x="${xFor(peakTorque.rpm) + 12}" y="${yFor(peakTorque.torque) - 12}" fill="#bae6fd" font-size="17" font-weight="900">${peakTorque.torque.toFixed(0)} Nm @ ${peakTorque.rpm.toFixed(0)} rpm</text>`
      : ""
  }
  ${
    peakPower
      ? `<circle cx="${xFor(peakPower.rpm)}" cy="${yFor(peakPower.hp)}" r="8" fill="#ef4444"/>
         <text x="${xFor(peakPower.rpm) + 12}" y="${yFor(peakPower.hp) + 28}" fill="#fecaca" font-size="17" font-weight="900">${peakPs.toFixed(1)} PS / ${peakPower.hp.toFixed(1)} HP @ ${peakPower.rpm.toFixed(0)} rpm</text>`
      : ""
  }

  <rect x="90" y="92" width="16" height="16" rx="4" fill="#ef4444"/>
  <text x="114" y="107" fill="#d4d4d8" font-size="18">Power</text>
  <rect x="205" y="92" width="16" height="16" rx="4" fill="#38bdf8"/>
  <text x="229" y="107" fill="#d4d4d8" font-size="18">Torque</text>
</svg>`;
}

export type PerformanceToolsMode = "combined" | "calculator" | "log";

export function PerformanceTools({
  mode = "combined",
}: {
  mode?: PerformanceToolsMode;
}) {
  const [torqueNm, setTorqueNm] = useState(430);
  const [rpm, setRpm] = useState(3200);
  const [kwInput, setKwInput] = useState(140);
  const [logFileName, setLogFileName] = useState("");
  const [logInput, setLogInput] = useState(
    "1800, 320\n2200, 390\n2600, 430\n3000, 420\n3400, 395\n3800, 360\n4200, 315"
  );

  const power = calculatePowerFromTorque(torqueNm, rpm);
  const hpFromKw = kwInput * 1.34102;
  const psFromKw = kwInput * 1.35962;

  const logPoints = useMemo(() => parseLogInput(logInput), [logInput]);
  const peakTorque = logPoints.reduce<LogPoint | null>(
    (best, point) => (!best || point.torque > best.torque ? point : best),
    null
  );
  const peakPower = logPoints.reduce<LogPoint | null>(
    (best, point) => (!best || point.hp > best.hp ? point : best),
    null
  );
  const averageTorque =
    logPoints.length > 0
      ? logPoints.reduce((total, point) => total + point.torque, 0) /
        logPoints.length
      : 0;
  const chartMaxHp = Math.max(...logPoints.map((point) => point.hp), 1);
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

    const svg = buildDynoReportSvg({
      fileName: logFileName,
      points: logPoints,
      peakTorque,
      peakPower,
    });
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const baseName =
      logFileName.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]+/gi, "-") ||
      "mg-autotech-dyno-report";

    link.href = url;
    link.download = `${baseName}-dyno-report.svg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section id="tools" className="overflow-x-hidden bg-[#050505] py-16 md:py-20">
      <div className="mx-auto max-w-7xl overflow-hidden px-4">
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

        <div className={`grid min-w-0 gap-6 ${mode === "combined" ? "lg:grid-cols-[0.9fr_1.1fr]" : "mx-auto max-w-5xl"}`}>
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

          {showLogAnalyzer && <div className="min-w-0 overflow-hidden rounded-[1.5rem] border border-red-900/50 bg-gradient-to-br from-red-950/25 via-white/[0.04] to-black p-4 shadow-2xl shadow-black/30 sm:rounded-[2rem] sm:p-6">
            <div className="mb-5 flex min-w-0 items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-black uppercase tracking-[0.22em] text-red-400">
                  Autotuner Log Checker
                </div>
                <h3 className="mt-2 text-2xl font-black leading-tight">RPM / torque rows</h3>
              </div>
              <BarChart3 className="h-8 w-8 shrink-0 text-red-500" />
            </div>

            <label className="mb-5 flex min-w-0 cursor-pointer flex-col gap-4 overflow-hidden rounded-2xl border-2 border-dashed border-red-800/60 bg-red-950/20 p-4 transition hover:border-red-500/70 hover:bg-red-950/30 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex w-full min-w-0 items-start gap-3 sm:w-auto">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-600/15 text-red-300 ring-1 ring-red-700/50">
                  <Upload className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-red-300">
                    CSV upload
                  </div>
                  <div className="mt-1 text-base font-black text-white">
                    Tap to upload Autotuner CSV
                  </div>
                  <div className="mt-1 text-xs font-bold leading-5 text-zinc-400">
                    {logFileName || "Engine speed + engine torque columns are detected automatically"}
                  </div>
                </div>
              </div>
              <span className="inline-flex w-full shrink-0 items-center justify-center rounded-xl bg-[#b1121b] px-4 py-3 text-xs font-black text-white shadow-lg shadow-red-950/30 sm:w-auto">
                Choose CSV
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => handleLogUpload(event.target.files?.[0] ?? null)}
                className="sr-only"
              />
            </label>

            <label className="block min-w-0 rounded-2xl border border-red-900/45 bg-black/45 p-4 ring-1 ring-white/5">
              <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-red-300">
                    Paste log rows
                  </div>
                  <div className="mt-1 text-sm font-black text-white">
                    RPM and torque values
                  </div>
                </div>
                <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-black text-zinc-400">
                  RPM, Nm
                </span>
              </div>
              <textarea
                value={logInput}
                onChange={(event) => setLogInput(event.target.value)}
                rows={7}
                spellCheck={false}
                className="w-full resize-none rounded-2xl border border-white/10 bg-[#050505] p-4 font-mono text-sm font-bold leading-6 text-white outline-none transition placeholder:text-zinc-600 focus:border-red-600 focus:ring-2 focus:ring-red-900/50"
                placeholder={"1800, 320\n2200, 390\n2600, 430"}
              />
            </label>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <MetricPanel
                label="Peak torque"
                value={peakTorque ? peakTorque.torque.toFixed(0) : "-"}
                unit={peakTorque ? `Nm @ ${peakTorque.rpm.toFixed(0)} rpm` : "Nm"}
              />
              <MetricPanel
                label="Peak power"
                value={peakPower ? peakPower.hp.toFixed(1) : "-"}
                unit={peakPower ? `HP @ ${peakPower.rpm.toFixed(0)} rpm` : "HP"}
              />
              <MetricPanel
                label="Average torque"
                value={logPoints.length ? averageTorque.toFixed(0) : "-"}
                unit="Nm"
              />
            </div>

            <button
              type="button"
              onClick={downloadDynoReport}
              disabled={!logPoints.length}
              className="mt-5 flex w-full items-center justify-center rounded-xl bg-[#b1121b] px-5 py-4 text-sm font-black text-white shadow-xl shadow-red-950/30 transition hover:bg-[#c91824] disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              <Download className="mr-2 h-4 w-4" />
              Download Dyno Report
            </button>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
                  Power curve preview
                </div>
                <div className="text-xs font-bold text-zinc-500">
                  {logPoints.length} valid rows
                </div>
              </div>

              <div className="min-w-0 space-y-3">
                {logPoints.slice(0, 8).map((point) => (
                  <div
                    key={`${point.rpm}-${point.torque}`}
                    className="grid min-w-0 grid-cols-[48px_minmax(0,1fr)_52px] items-center gap-2 text-xs sm:grid-cols-[74px_minmax(0,1fr)_74px] sm:gap-3"
                  >
                    <div className="font-black text-zinc-400">
                      {point.rpm.toFixed(0)}
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-red-700 to-red-400"
                        style={{
                          width: `${Math.max(6, (point.hp / chartMaxHp) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="text-right font-black text-white">
                      {point.hp.toFixed(0)} HP
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <p className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4 text-xs leading-6 text-zinc-500">
              This tool is an estimate for workshop checks. Real dyno output can
              vary with drivetrain loss, correction method, gear selection and
              logging quality.
            </p>
          </div>}
        </div>
      </div>
    </section>
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
