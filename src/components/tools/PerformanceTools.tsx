"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Calculator, Gauge } from "lucide-react";
import { PublicLogSnapshot } from "@/components/tools/PublicLogSnapshot";
import { LocalizedHomepageTree } from "@/lib/homepageLocalization";
import { calculatePowerFromTorque } from "@/lib/performanceReport";

export type PerformanceToolsMode = "combined" | "calculator";

export function PerformanceTools({
  mode = "combined",
}: {
  mode?: PerformanceToolsMode;
}) {
  if (mode === "combined") {
    return <PublicLogSnapshot />;
  }

  return <TorquePowerCalculator />;
}

function TorquePowerCalculator() {
  const [torqueNm, setTorqueNm] = useState(430);
  const [rpm, setRpm] = useState(3200);
  const [kwInput, setKwInput] = useState(140);
  const power = calculatePowerFromTorque(torqueNm, rpm);
  const hpFromKw = kwInput * 1.34102;
  const psFromKw = kwInput * 1.35962;

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
                Convert torque and engine speed into estimated power.
              </h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-400">
                Enter torque and RPM for an instant kW and HP estimate, then
                convert kW into mechanical HP and metric PS.
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

          <div className="mx-auto max-w-5xl overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20 sm:rounded-[2rem] sm:p-6">
            <div className="mb-5 flex min-w-0 items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-red-800/50 bg-red-950/30 text-red-400">
                <Gauge className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-black uppercase tracking-[0.22em] text-red-400">
                  Manual input
                </div>
                <h3 className="mt-1 text-2xl font-black leading-tight">
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
          </div>
        </div>
      </section>
    </LocalizedHomepageTree>
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
