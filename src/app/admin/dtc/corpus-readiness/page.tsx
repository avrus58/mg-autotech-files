"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  AlertTriangle,
  Database,
  FileSearch,
  Loader2,
  Microscope,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/authGuards";
import type { DtcCorpusClusterReadiness, DtcCorpusReadinessReport } from "@/lib/dtcActive/corpusReadiness";

type Payload = {
  report: DtcCorpusReadinessReport;
  warnings: string[];
  sourceCounts: Record<string, number>;
  safety: {
    readOnly: true;
    firmwareBytesMutated: false;
    outputArtifactsCreated: false;
    customerDeliveryEnabled: false;
    phaseDCustomerProcessingStarted: false;
  };
};

type PageState =
  | { status: "loading"; data: null; message: "" }
  | { status: "ready"; data: Payload; message: "" }
  | { status: "error"; data: null; message: string };

const stateTone: Record<string, string> = {
  INSUFFICIENT_DATA: "border-zinc-700 bg-zinc-950/40 text-zinc-200",
  CORPUS_CLEANUP_REQUIRED: "border-amber-600/40 bg-amber-950/20 text-amber-100",
  CONTROLLED_PAIR_REQUIRED: "border-sky-600/40 bg-sky-950/20 text-sky-100",
  INTEGRITY_RESEARCH_REQUIRED: "border-violet-600/40 bg-violet-950/20 text-violet-100",
  BENCH_VALIDATION_REQUIRED: "border-cyan-600/40 bg-cyan-950/20 text-cyan-100",
  READY_FOR_INTERNAL_RULE_RESEARCH: "border-emerald-600/40 bg-emerald-950/20 text-emerald-100",
};

export default function AdminDtcCorpusReadinessPage() {
  const [state, setState] = useState<PageState>({ status: "loading", data: null, message: "" });

  const load = useCallback(async () => {
    setState({ status: "loading", data: null, message: "" });
    try {
      const response = await authenticatedFetch("/api/admin/dtc/corpus-readiness");
      const payload = await response.json();
      if (response.status === 401) {
        window.location.href = "/login?redirect=/admin/dtc/corpus-readiness";
        return;
      }
      if (response.status === 403) throw new Error("Access denied. Your staff role cannot review DTC corpus readiness.");
      if (!response.ok) throw new Error(payload.error || "DTC corpus readiness could not be loaded.");
      setState({ status: "ready", data: payload as Payload, message: "" });
    } catch (error) {
      setState({
        status: "error",
        data: null,
        message: error instanceof Error ? error.message : "DTC corpus readiness could not be loaded.",
      });
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const readyCount = useMemo(() =>
    state.data?.report.clusters.filter((cluster) => cluster.readinessState === "READY_FOR_INTERNAL_RULE_RESEARCH").length ?? 0,
  [state.data]);

  return (
    <main className="mg-compact-ui min-h-screen bg-[#050505] px-4 py-6 text-white sm:px-6">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link href="/admin/dtc" className="inline-flex items-center text-sm font-bold text-zinc-500 hover:text-white">
              <ArrowLeft className="mr-2 h-4 w-4" /> DTC foundation
            </Link>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-red-800/50 bg-red-950/25 text-red-300">
                <Microscope className="h-6 w-6" />
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-[0.22em] text-red-500">Phase D Readiness</div>
                <h1 className="text-2xl font-black sm:text-3xl">First Real Lab Target Qualification</h1>
                <p className="mt-1 max-w-4xl text-sm text-zinc-400">
                  Evidence-only qualification for Bosch ME7.5, EDC15P/EDC15VM+ and EDC16U34. This page ranks exact compound
                  identities only; it does not process firmware, generate output, execute checksums or start customer delivery.
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
            Refresh evidence
          </button>
        </header>

        {state.status === "loading" && (
          <section className="rounded-lg border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-center gap-3 text-sm font-bold text-zinc-300">
              <Loader2 className="h-5 w-5 animate-spin text-red-400" />
              Loading read-only DTC corpus evidence...
            </div>
          </section>
        )}

        {state.status === "error" && (
          <section role="alert" className="rounded-lg border border-red-500/30 bg-red-950/20 p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-1 h-5 w-5 text-red-300" />
              <div>
                <h2 className="font-black text-red-100">Corpus readiness unavailable</h2>
                <p className="mt-1 text-sm text-red-100/75">{state.message}</p>
              </div>
            </div>
          </section>
        )}

        {state.status === "ready" && state.data && (
          <div className="space-y-6">
            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <Metric title="Exact clusters" value={String(state.data.report.clusters.length)} />
              <Metric title="Ready clusters" value={String(readyCount)} />
              <Metric title="Training samples" value={String(state.data.sourceCounts.training_samples ?? 0)} />
              <Metric title="Dataset pairs" value={String(state.data.sourceCounts.dataset_pairs ?? 0)} />
              <Metric title="Evidence items" value={String(state.data.sourceCounts.evidence_items ?? 0)} />
            </section>

            <section className="rounded-lg border border-amber-500/25 bg-amber-950/10 p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-1 h-5 w-5 text-amber-300" />
                <div>
                  <h2 className="font-black text-amber-100">Evidence-only boundary</h2>
                  <p className="mt-1 text-sm text-amber-50/75">
                    No firmware bytes are read, modified or generated here. The dashboard uses existing metadata, hashes,
                    review labels and validation signals to recommend the next internal lab experiment.
                  </p>
                </div>
              </div>
            </section>

            {state.data.warnings.length > 0 && (
              <section className="rounded-lg border border-zinc-700 bg-zinc-950/50 p-4">
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-zinc-300">Read-only source warnings</h2>
                <ul className="mt-3 space-y-2 text-sm text-zinc-500">
                  {state.data.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                </ul>
              </section>
            )}

            <RecommendedCluster cluster={state.data.report.firstRecommendedLabCluster} />

            <section className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-red-300" />
                <h2 className="text-lg font-black">Exact corpus clusters</h2>
              </div>
              <div className="mt-5 space-y-4">
                {state.data.report.clusters.map((cluster) => <ClusterCard key={cluster.clusterKey} cluster={cluster} />)}
                {state.data.report.clusters.length === 0 && (
                  <div className="rounded-lg border border-dashed border-white/15 p-8 text-center text-zinc-500">
                    No exact target cluster evidence found for Bosch ME7.5, EDC15P/EDC15VM+ or EDC16U34.
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function RecommendedCluster({ cluster }: { cluster: DtcCorpusClusterReadiness | null }) {
  if (!cluster) {
    return (
      <section className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
        <h2 className="font-black">First recommended lab cluster</h2>
        <p className="mt-2 text-sm text-zinc-500">No exact eligible cluster exists yet. Import or review metadata first.</p>
      </section>
    );
  }
  return (
    <section className={`rounded-lg border p-5 ${stateTone[cluster.readinessState]}`}>
      <div className="text-xs font-black uppercase tracking-[0.18em] opacity-80">First recommended lab cluster</div>
      <h2 className="mt-2 text-2xl font-black">{cluster.targetLabel}</h2>
      <p className="mt-2 break-words text-sm opacity-80">
        {cluster.identity.ecuType} / HW {cluster.identity.hwNumber} / SW {cluster.identity.swNumber} / CAL {cluster.identity.calibrationId}
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <Metric title="State" value={cluster.readinessState.replaceAll("_", " ")} compact />
        <Metric title="Controlled DTC pairs" value={String(cluster.controlledOneDtcPairCount)} compact />
        <Metric title="Distinct ORI hashes" value={String(cluster.distinctSourceHashes)} compact />
        <Metric title="Score" value={`${cluster.readinessScore}/100`} compact />
      </div>
    </section>
  );
}

function ClusterCard({ cluster }: { cluster: DtcCorpusClusterReadiness }) {
  return (
    <article className="rounded-lg border border-white/10 bg-black/25 p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="text-xs font-black uppercase tracking-[0.18em] text-red-300">{cluster.targetLabel}</div>
          <h3 className="mt-1 break-words text-lg font-black text-white">{cluster.identity.ecuType}</h3>
          <p className="mt-1 break-words text-xs text-zinc-500">
            {cluster.identity.ecuSupplier} / {cluster.identity.ecuFamily} / HW {cluster.identity.hwNumber} / SW {cluster.identity.swNumber} /
            CAL {cluster.identity.calibrationId} / {cluster.identity.representationType} / {cluster.identity.fileRole} / {cluster.identity.readMethod}
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-black ${stateTone[cluster.readinessState]}`}>
          {cluster.readinessState.replaceAll("_", " ")}
        </span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Metric title="Verified ORI" value={String(cluster.verifiedOriginalCount)} compact />
        <Metric title="ORI hashes" value={String(cluster.distinctSourceHashes)} compact />
        <Metric title="Pairs" value={String(cluster.matchedOriModPairCount)} compact />
        <Metric title="1-DTC pairs" value={String(cluster.controlledOneDtcPairCount)} compact />
        <Metric title="Integrity" value={String(cluster.integrityEvidenceCount)} compact />
        <Metric title="Bench" value={String(cluster.benchVerificationCount)} compact />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <InfoList title="DTC labels" items={cluster.exactDtcLabels.length ? cluster.exactDtcLabels : ["No exact labels"]} />
        <InfoList title="Missing evidence" items={cluster.missingEvidence.length ? cluster.missingEvidence : ["None"]} />
        <InfoList title="Conflicts" items={cluster.conflicts.length ? cluster.conflicts : ["None"]} />
      </div>
      <InfoList title="Required controlled experiments" items={cluster.requiredControlledExperiments.length ? cluster.requiredControlledExperiments : ["No additional experiment required before internal rule research."]} wide />
    </article>
  );
}

function Metric({ title, value, compact = false }: { title: string; value: string; compact?: boolean }) {
  return (
    <div className={`rounded-lg border border-white/10 bg-black/25 ${compact ? "p-3" : "p-4"}`}>
      <div className="text-[11px] font-black uppercase tracking-[0.14em] text-zinc-500">{title}</div>
      <div className={`mt-1 break-words font-black text-white ${compact ? "text-sm" : "text-xl"}`}>{value}</div>
    </div>
  );
}

function InfoList({ title, items, wide = false }: { title: string; items: string[]; wide?: boolean }) {
  return (
    <div className={`mt-4 rounded-lg border border-white/10 bg-black/20 p-3 ${wide ? "lg:col-span-3" : ""}`}>
      <div className="text-[11px] font-black uppercase tracking-[0.14em] text-zinc-500">{title}</div>
      <ul className="mt-2 space-y-1 text-sm text-zinc-400">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <FileSearch className="mt-0.5 h-3.5 w-3.5 flex-none text-zinc-600" />
            <span className="break-words">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
