"use client";

import Link from "next/link";
import type React from "react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, BrainCircuit, CheckCircle2, GitBranch, Loader2, RefreshCcw, ShieldAlert } from "lucide-react";
import { authenticatedFetch } from "@/lib/authGuards";

function asArray<T = Record<string, unknown>>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function label(value: unknown) {
  return String(value ?? "-").replaceAll("_", " ");
}

const fallbackDeepLinks = {
  learningCorpus: "/admin/ai-training/corpus",
  patternClusters: "/admin/ai-training/clusters",
  mapDefinitions: "/admin/ai-training/map-definitions",
  dtcReadiness: "/admin/dtc/corpus-readiness",
  datasetWorkbench: "/admin/ai-training/datasets",
};

export default function EcuIntelligenceClusterDetailPage() {
  const params = useParams<{ clusterId: string }>();
  const clusterId = params.clusterId;
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!clusterId) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await authenticatedFetch(`/api/admin/ecu-intelligence/clusters/${encodeURIComponent(clusterId)}`);
      const data = await response.json();
      if (response.status === 401) {
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      if (response.status === 403) throw new Error("Access denied. ECU Intelligence requires ai_training.manage.");
      if (!response.ok) throw new Error(data.error || "Cluster detail could not be loaded.");
      setPayload(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Cluster detail could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [clusterId]);

  useEffect(() => {
    const handle = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(handle);
  }, [load]);

  const cluster = payload?.cluster as Record<string, unknown> | undefined;
  const identity = cluster?.identity as Record<string, unknown> | undefined;
  const score = cluster?.knowledgeScore as Record<string, unknown> | undefined;
  const components = score?.components as Record<string, unknown> | undefined;
  const graph = payload?.graph as Record<string, unknown> | null | undefined;
  const graphNodes = asArray<Record<string, unknown>>(graph?.nodes);
  const graphEdges = asArray<Record<string, unknown>>(graph?.edges);
  const services = asArray<Record<string, unknown>>(cluster?.serviceCoverage);
  const timeline = asArray<Record<string, unknown>>(payload?.evidenceTimeline);
  const missingEvidence = asArray<Record<string, unknown>>(payload?.missingEvidence);
  const deepLinks = (payload?.deepLinks as Record<string, unknown> | undefined) ?? fallbackDeepLinks;

  return (
    <main className="mg-compact-ui min-h-screen bg-[#050505] text-white">
      <header className="border-b border-white/10 bg-black/80">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/admin/ecu-intelligence/clusters" className="inline-flex items-center text-sm font-bold text-zinc-500 hover:text-white">
              <ArrowLeft className="mr-2 h-4 w-4" /> Exact clusters
            </Link>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-red-800/50 bg-red-950/25 text-red-400">
                <BrainCircuit className="h-6 w-6" />
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-[0.22em] text-red-500">Exact cluster detail</div>
                <h1 className="break-all text-2xl font-black sm:text-3xl">{String(identity?.displayLabel ?? "Loading cluster...")}</h1>
              </div>
            </div>
          </div>
          <button onClick={() => void load()} disabled={loading} className="inline-flex h-11 w-fit items-center rounded-lg border border-white/10 px-4 text-sm font-black hover:bg-white/5 disabled:opacity-50">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
            Refresh
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-4 py-7">
        <div className="mb-6 rounded-lg border border-emerald-700/30 bg-emerald-950/15 p-4 text-sm leading-6 text-emerald-100/80">
          Exact evidence view only. Similarity, map attribution and pattern support never imply automatic modification compatibility.
        </div>
        {message && <div className="mb-6 rounded-lg border border-red-800/40 bg-red-950/20 p-4 text-sm text-red-100">{message}</div>}
        {loading && <div className="rounded-lg border border-white/10 bg-white/[0.025] p-10 text-center text-sm text-zinc-500">Loading exact cluster...</div>}

        {!loading && cluster && (
          <div className="space-y-6">
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
              <Metric label="Knowledge score" value={`${score?.score ?? 0}/100`} />
              <Metric label="Readiness" value={label(cluster.readiness)} tone={cluster.readiness === "BLOCKED" ? "amber" : "green"} />
              <Metric label="Unique sources" value={cluster.uniqueSourceCount} />
              <Metric label="Pair candidates" value={cluster.pairCandidateCount} />
              <Metric label="Approved pairs" value={cluster.approvedPairCount} tone="green" />
              <Metric label="Missing gates" value={cluster.missingEvidenceCount} tone="amber" />
            </section>

            <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
              <Panel title="Canonical identity">
                <div className="grid gap-2 sm:grid-cols-2">
                  {["supplier", "ecuFamily", "ecuType", "hwNumber", "swNumber", "calibrationId", "representationType", "fileRole", "fileSize", "readMethod"].map((key) => (
                    <div key={key} className="rounded-lg border border-white/10 bg-black/30 p-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-600">{label(key)}</div>
                      <div className="mt-1 break-all font-black">{String(identity?.[key] ?? "-")}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 break-all rounded-lg border border-white/10 bg-black/30 p-3 text-xs text-zinc-500">{String(identity?.clusterKey ?? "")}</div>
              </Panel>

              <Panel title="Knowledge score decomposition">
                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(components ?? {}).map(([key, value]) => (
                    <div key={key} className="rounded-lg border border-white/10 bg-black/30 p-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-600">{label(key)}</div>
                      <div className="mt-1 text-xl font-black">{String(value)}</div>
                    </div>
                  ))}
                </div>
                {asArray<string>(score?.hardBlockers).length > 0 && (
                  <div className="mt-3 rounded-lg border border-amber-700/30 bg-amber-950/15 p-3 text-sm text-amber-100">
                    <ShieldAlert className="mr-2 inline h-4 w-4" /> {asArray<string>(score?.hardBlockers).map(label).join(", ")}
                  </div>
                )}
              </Panel>
            </section>

            <section className="grid gap-5 xl:grid-cols-2">
              <Panel title="Service coverage">
                <div className="space-y-2">
                  {services.map((service) => (
                    <div key={String(service.category)} className="rounded-lg border border-white/10 bg-black/30 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-black">{label(service.category)}</div>
                        <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-xs font-black uppercase">{label(service.readiness)}</span>
                      </div>
                      <div className="mt-2 grid grid-cols-4 gap-2 text-xs text-zinc-400">
                        <span>Candidates {String(service.candidateCount ?? 0)}</span>
                        <span>Approved {String(service.approvedCount ?? 0)}</span>
                        <span>Single {String(service.singleServiceCount ?? 0)}</span>
                        <span>DTC codes {asArray(service.exactDtcCodes).length}</span>
                      </div>
                    </div>
                  ))}
                  {!services.length && <Empty text="No service coverage for this cluster yet." />}
                </div>
              </Panel>

              <Panel title="Knowledge graph table">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-sm font-black"><GitBranch className="h-4 w-4" /> Nodes</div>
                    <div className="space-y-2">{graphNodes.map((node) => <MiniRow key={String(node.id)} title={`${node.type}: ${node.label}`} detail={`Evidence ${node.evidenceCount ?? "-"}`} />)}</div>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-sm font-black"><CheckCircle2 className="h-4 w-4" /> Edges</div>
                    <div className="space-y-2">{graphEdges.map((edge) => <MiniRow key={String(edge.id)} title={`${edge.type}: ${edge.label}`} detail={`${edge.source} -> ${edge.target}`} />)}</div>
                  </div>
                </div>
              </Panel>
            </section>

            <section className="grid gap-5 xl:grid-cols-2">
              <Panel title="Evidence timeline">
                <div className="space-y-2">{timeline.map((item, index) => <MiniRow key={`${item.type}-${index}`} title={String(item.label)} detail={`${item.created_at ?? ""} / ${item.status ?? ""}`} />)}{!timeline.length && <Empty text="No timeline records for this cluster." />}</div>
              </Panel>
              <Panel title="Missing evidence checklist">
                <div className="space-y-2">{missingEvidence.map((item, index) => <MiniRow key={`${item.service}-${index}`} title={label(item.service)} detail={label(item.reason)} />)}{!missingEvidence.length && <Empty text="No missing service evidence reported by the v1 model." />}</div>
              </Panel>
            </section>

            <Panel title="Existing evidence systems">
              <div className="grid gap-2 md:grid-cols-3">
                {Object.entries(deepLinks ?? {}).map(([key, href]) => (
                  <Link key={key} href={String(href)} className="rounded-lg border border-white/10 bg-black/30 p-3 font-black hover:bg-white/[0.035]">
                    {label(key)}
                    <div className="mt-1 text-xs font-normal text-zinc-500">{String(href)}</div>
                  </Link>
                ))}
              </div>
            </Panel>
          </div>
        )}
      </div>
    </main>
  );
}

function Metric({ label, value, tone = "red" }: { label: string; value: unknown; tone?: "red" | "green" | "amber" }) {
  const color = tone === "green" ? "text-emerald-400" : tone === "amber" ? "text-amber-400" : "text-red-400";
  return <div className="rounded-lg border border-white/10 bg-white/[0.025] p-4"><div className={`text-3xl font-black ${color}`}>{String(value ?? 0)}</div><div className="mt-1 text-xs text-zinc-500">{label}</div></div>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-lg border border-white/10 bg-white/[0.025] p-4"><h2 className="mb-4 text-lg font-black">{title}</h2>{children}</section>;
}

function MiniRow({ title, detail }: { title: string; detail: string }) {
  return <div className="rounded-lg border border-white/10 bg-black/30 p-3"><div className="break-all font-black">{title}</div><div className="mt-1 break-all text-xs text-zinc-500">{detail}</div></div>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-white/10 p-6 text-center text-sm text-zinc-500">{text}</div>;
}
