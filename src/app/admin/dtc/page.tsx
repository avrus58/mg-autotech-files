"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Database,
  FileWarning,
  Loader2,
  Lock,
  RefreshCcw,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/authGuards";
import type { DtcActiveFoundationStatus } from "@/lib/dtcActive/types";

type PageState =
  | { status: "loading"; data: null; message: "" }
  | { status: "ready"; data: DtcActiveFoundationStatus; message: "" }
  | { status: "error"; data: null; message: string };

export default function AdminDtcFoundationPage() {
  const [state, setState] = useState<PageState>({ status: "loading", data: null, message: "" });

  const load = useCallback(async () => {
    setState({ status: "loading", data: null, message: "" });
    try {
      const response = await authenticatedFetch("/api/admin/dtc/foundation");
      const payload = await response.json();
      if (response.status === 401) {
        window.location.href = "/login?redirect=/admin/dtc";
        return;
      }
      if (response.status === 403) {
        throw new Error("Access denied. Your staff role cannot review DTC active-processing foundations.");
      }
      if (!response.ok) throw new Error(payload.error || "DTC active foundation could not be loaded.");
      setState({ status: "ready", data: payload.foundation as DtcActiveFoundationStatus, message: "" });
    } catch (error) {
      if (error instanceof Error && error.message === "Unauthorized") {
        window.location.href = "/login?redirect=/admin/dtc";
        return;
      }
      setState({
        status: "error",
        data: null,
        message: error instanceof Error ? error.message : "DTC active foundation could not be loaded.",
      });
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const activeVetoCount = useMemo(() => {
    return state.data?.modes.reduce((sum, mode) => sum + mode.hardVetoes.length, 0) ?? 0;
  }, [state.data]);

  return (
    <main className="mg-compact-ui min-h-screen bg-[#050505] px-4 py-6 text-white sm:px-6">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link href="/admin" className="inline-flex items-center text-sm font-bold text-zinc-500 hover:text-white">
              <ArrowLeft className="mr-2 h-4 w-4" /> Admin operations
            </Link>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-red-800/50 bg-red-950/25 text-red-300">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-[0.22em] text-red-500">DTC Active Processing</div>
                <h1 className="text-2xl font-black sm:text-3xl">Phase A/B foundation control</h1>
                <p className="mt-1 max-w-3xl text-sm text-zinc-400">
                  Server-authoritative status, policy, synthetic dry-run evidence and customer-safe projection only. No binary
                  mutation, checksum adapter execution, customer delivery or A4/A5 automation is enabled.
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={() => void load()}
            disabled={state.status === "loading"}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-4 text-sm font-black text-white hover:bg-white/10 disabled:opacity-60"
          >
            {state.status === "loading" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
            Refresh status
          </button>
        </header>

        {state.status === "loading" && (
          <section className="rounded-lg border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-center gap-3 text-sm font-bold text-zinc-300">
              <Loader2 className="h-5 w-5 animate-spin text-red-400" />
              Loading DTC active-processing foundation state...
            </div>
          </section>
        )}

        {state.status === "error" && (
          <section role="alert" className="rounded-lg border border-red-500/30 bg-red-950/20 p-6">
            <div className="flex items-start gap-3">
              <FileWarning className="mt-1 h-5 w-5 text-red-300" />
              <div>
                <h2 className="font-black text-red-100">DTC foundation status unavailable</h2>
                <p className="mt-1 text-sm text-red-100/75">{state.message}</p>
              </div>
            </div>
          </section>
        )}

        {state.status === "ready" && state.data && (
          <div className="space-y-6">
            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <StatusCard title="Repository mode" value="Read-only foundation" detail={state.data.contractVersion} icon={<ShieldCheck className="h-5 w-5" />} />
              <StatusCard title="Policy version" value={state.data.policyVersion} detail="Runtime policy is most restrictive." icon={<Database className="h-5 w-5" />} />
              <StatusCard title="Hard vetoes active" value={String(activeVetoCount)} detail="Mutation paths remain blocked." icon={<Ban className="h-5 w-5" />} />
              <StatusCard title="Customer delivery" value="Disabled" detail="No publication grants or downloads." icon={<ShieldOff className="h-5 w-5" />} />
            </section>

            <section className="rounded-lg border border-amber-500/25 bg-amber-950/10 p-5">
              <div className="flex items-start gap-3">
                <Lock className="mt-1 h-5 w-5 text-amber-300" />
                <div>
                  <h2 className="font-black text-amber-100">Phase A/B safety boundary</h2>
                  <p className="mt-1 text-sm text-amber-50/75">
                    The workbench intentionally exposes no generate, process, publish, customer-delivery, checksum, rule-promotion
                    or A4/A5 automation action. Phase B is limited to synthetic document validation and dry-run reports.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-cyan-500/20 bg-cyan-950/10 p-5">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Phase B synthetic registry</div>
                  <h2 className="mt-2 text-xl font-black text-white">Rules, adapters and golden corpus are dry-run only</h2>
                  <p className="mt-2 max-w-4xl text-sm leading-6 text-cyan-50/70">
                    The registry validates exact synthetic rule documents, metadata-only integrity adapters and corpus cases.
                    Reports can describe intended operations, but they never mutate firmware bytes, execute adapters or create files.
                  </p>
                </div>
                <div className="grid min-w-[280px] gap-2 text-sm sm:grid-cols-2">
                  <MiniMetric label="Rules" value={String(state.data.phaseB.ruleCount)} />
                  <MiniMetric label="Adapters" value={String(state.data.phaseB.adapterCount)} />
                  <MiniMetric label="Corpus Cases" value={String(state.data.phaseB.corpusCaseCount)} />
                  <MiniMetric label="Output Files" value="0" />
                </div>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <SafetyPill label="Synthetic only" active={state.data.phaseB.syntheticOnly} />
                <SafetyPill label="No byte mutation" active={!state.data.phaseB.firmwareMutationEnabled} />
                <SafetyPill label="No output artifacts" active={!state.data.phaseB.outputArtifactGenerationEnabled} />
                <SafetyPill label="No adapter execution" active={!state.data.phaseB.integrityAdapterExecutionEnabled} />
              </div>
              <div className="mt-5 rounded-lg border border-white/10 bg-black/25 p-4">
                <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Sample dry-run report</div>
                <div className="mt-3 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-5">
                  <InfoLine label="Success" value={state.data.phaseB.sampleReport.success ? "Yes" : "No"} />
                  <InfoLine label="Codes" value={state.data.phaseB.sampleReport.requestedCodes.join(", ") || "-"} />
                  <InfoLine label="Operations" value={String(state.data.phaseB.sampleReport.operationCount)} />
                  <InfoLine label="Hard vetoes" value={state.data.phaseB.sampleReport.hardVetoes.join(", ") || "None"} />
                  <InfoLine label="Output created" value={state.data.phaseB.sampleReport.outputArtifactCreated ? "Yes" : "No"} />
                </div>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              {state.data.modes.map((mode) => (
                <article key={mode.mode} className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-black uppercase tracking-[0.16em] text-zinc-300">{mode.mode}</h2>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${mode.enabled ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}>
                      {mode.enabled ? "Enabled" : "Blocked"}
                    </span>
                  </div>
                  <dl className="mt-4 grid gap-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-zinc-500">Mutation</dt>
                      <dd className="font-bold text-zinc-200">{mode.mutationAllowed ? "Policy-capable later" : "No output"}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-zinc-500">Publication</dt>
                      <dd className="font-bold text-zinc-200">{mode.publicationAllowed ? "Requires future gates" : "Forbidden"}</dd>
                    </div>
                  </dl>
                  {mode.hardVetoes.length > 0 && (
                    <div className="mt-4 rounded-lg border border-red-500/20 bg-red-950/20 p-3 text-xs font-bold text-red-100/80">
                      {mode.hardVetoes.join(", ")}
                    </div>
                  )}
                  <ul className="mt-4 space-y-2 text-sm text-zinc-400">
                    {mode.notes.map((note) => <li key={note}>{note}</li>)}
                  </ul>
                </article>
              ))}
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <ListPanel title="Safe Phase A capabilities" items={state.data.safeCapabilities} tone="emerald" />
              <ListPanel title="Explicitly disabled capabilities" items={state.data.disabledCapabilities} tone="red" />
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function StatusCard({ title, value, detail, icon }: { title: string; value: string; detail: string; icon: React.ReactNode }) {
  return (
    <article className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">{title}</div>
        <div className="text-red-300">{icon}</div>
      </div>
      <div className="mt-3 text-xl font-black text-white">{value}</div>
      <div className="mt-1 text-sm text-zinc-500">{detail}</div>
    </article>
  );
}

function ListPanel({ title, items, tone }: { title: string; items: string[]; tone: "emerald" | "red" }) {
  const iconClass = tone === "emerald" ? "text-emerald-300" : "text-red-300";
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
      <h2 className="text-sm font-black uppercase tracking-[0.16em] text-zinc-300">{title}</h2>
      <ul className="mt-4 space-y-3 text-sm text-zinc-400">
        {items.map((item) => (
          <li key={item} className="flex gap-3">
            <CheckCircle2 className={`mt-0.5 h-4 w-4 flex-none ${iconClass}`} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/25 p-3">
      <div className="text-[11px] font-black uppercase tracking-[0.14em] text-zinc-500">{label}</div>
      <div className="mt-1 text-lg font-black text-white">{value}</div>
    </div>
  );
}

function SafetyPill({ label, active }: { label: string; active: boolean }) {
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm font-black ${
      active ? "border-emerald-700/30 bg-emerald-950/20 text-emerald-200" : "border-red-700/30 bg-red-950/20 text-red-200"
    }`}>
      {active ? "Locked: " : "Warning: "}{label}
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-black uppercase tracking-[0.14em] text-zinc-500">{label}</div>
      <div className="mt-1 break-words font-bold text-zinc-200">{value}</div>
    </div>
  );
}
