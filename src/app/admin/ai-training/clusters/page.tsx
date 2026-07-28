"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, ArrowLeft, CheckCircle2, ChevronRight, Layers3, Loader2, RefreshCcw, Search, ShieldAlert } from "lucide-react";
import { authenticatedFetch } from "@/lib/authGuards";
import { patternClusterStatuses, trainingFeatureKeys, type AiAccuracyMetric, type AiPatternCluster, type PatternClusterStatus } from "@/lib/ecuIntelligence/types";

type Payload = {
  clusters: AiPatternCluster[];
  accuracy: AiAccuracyMetric | null;
  stats: { total: number; weak: number; usable: number; strong: number; mature: number; outliers: number };
};

const emptyPayload: Payload = { clusters: [], accuracy: null, stats: { total: 0, weak: 0, usable: 0, strong: 0, mature: 0, outliers: 0 } };

export default function PatternClustersPage() {
  const [data, setData] = useState<Payload>(emptyPayload);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<PatternClusterStatus | "all">("all");
  const [feature, setFeature] = useState("all");
  const [search, setSearch] = useState("");
  const authFetch = useCallback(
    (url: string, init?: RequestInit) => authenticatedFetch(url, init),
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const query = new URLSearchParams({ status, feature, limit: "500" });
      const response = await authFetch(`/api/admin/ai-training/clusters?${query.toString()}`);
      const payload = await response.json();
      if (response.status === 403) throw new Error("Access denied. ECU learning permission is required.");
      if (!response.ok) throw new Error(payload.error || "Pattern clusters could not be loaded.");
      setData(payload as Payload);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Pattern clusters could not be loaded.");
    } finally { setLoading(false); }
  }, [authFetch, feature, status]);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void load(); }, 100);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return data.clusters;
    return data.clusters.filter((cluster) =>
      [cluster.ecu_family, cluster.ecu_type, cluster.sw_number, cluster.hw_number, cluster.feature_type]
        .filter(Boolean).some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [data.clusters, search]);

  async function rebuildAll() {
    setRebuilding(true);
    setMessage("");
    try {
      const response = await authFetch("/api/admin/ai-training/clusters/rebuild", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Cluster rebuild failed.");
      setMessage(`${payload.clusterCount} clusters rebuilt from ${payload.eligibleSampleCount} trusted samples.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Cluster rebuild failed.");
    } finally { setRebuilding(false); }
  }

  return (
    <main className="mg-compact-ui min-h-screen bg-[#050505] text-white">
      <header className="border-b border-white/10 bg-black/80">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/admin/ai-training" className="inline-flex items-center text-sm font-bold text-zinc-500 hover:text-white"><ArrowLeft className="mr-2 h-4 w-4" />Learning control room</Link>
            <div className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-red-500">Level 2</div>
            <h1 className="mt-1 text-3xl font-black">Pattern clusters</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => void load()} disabled={loading} className="inline-flex h-11 items-center rounded-lg border border-white/10 px-4 text-sm font-black disabled:opacity-50"><RefreshCcw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</button>
            <button onClick={() => void rebuildAll()} disabled={rebuilding} className="inline-flex h-11 items-center rounded-lg bg-[#b1121b] px-4 text-sm font-black disabled:opacity-50">{rebuilding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Layers3 className="mr-2 h-4 w-4" />}Rebuild all</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-4 py-7">
        <div className="mb-6 border-l-2 border-amber-400 bg-amber-950/15 px-4 py-3 text-sm leading-6 text-amber-100/80">
          Evidence only. Clusters do not identify verified maps, generate files or approve a calibration. Human tuner and checksum verification remain mandatory.
        </div>
        {message && <div className="mb-5 rounded-lg border border-red-800/40 bg-red-950/20 p-4 text-sm text-red-100">{message}</div>}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <Metric label="All clusters" value={data.stats.total} icon={<Layers3 />} />
          <Metric label="Strong" value={data.stats.strong} icon={<CheckCircle2 />} tone="green" />
          <Metric label="Usable" value={data.stats.usable} icon={<Activity />} tone="green" />
          <Metric label="Weak" value={data.stats.weak} icon={<ShieldAlert />} tone="amber" />
          <Metric label="Mature" value={data.stats.mature} icon={<CheckCircle2 />} tone="green" />
          <Metric label="Outliers" value={data.stats.outliers} icon={<ShieldAlert />} tone="amber" />
          <Metric label="Auto precision" value={data.accuracy?.total_reviewed ? `${Math.round(Number(data.accuracy.precision_score))}%` : "N/A"} icon={<Activity />} />
        </section>

        <section className="mt-6 grid gap-3 md:grid-cols-3">
          <label className="relative"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search ECU, SW or feature..." className="h-12 w-full rounded-lg border border-white/10 bg-white/[0.03] pl-11 pr-4 text-sm font-bold outline-none focus:border-red-700" /></label>
          <select value={status} onChange={(event) => setStatus(event.target.value as PatternClusterStatus | "all")} className="h-12 rounded-lg border border-white/10 bg-[#0a0a0a] px-4 text-sm font-black"><option value="all">All cluster statuses</option>{patternClusterStatuses.map((value) => <option key={value}>{value}</option>)}</select>
          <select value={feature} onChange={(event) => setFeature(event.target.value)} className="h-12 rounded-lg border border-white/10 bg-[#0a0a0a] px-4 text-sm font-black"><option value="all">All actual services</option>{trainingFeatureKeys.map((value) => <option key={value}>{value}</option>)}</select>
        </section>

        <section className="mt-5 overflow-hidden rounded-lg border border-white/10">
          <div className="hidden grid-cols-[1.4fr_1fr_120px_repeat(4,110px)_36px] gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-600 lg:grid">
            <div>ECU</div><div>Feature / SW</div><div>Samples</div><div>Quality</div><div>Confidence</div><div>Status</div><div>Outliers</div><div />
          </div>
          {visible.map((cluster) => (
            <Link key={cluster.id} href={`/admin/ai-training/clusters/${cluster.id}`} className="grid gap-3 border-b border-white/10 px-4 py-4 last:border-0 hover:bg-white/[0.035] lg:grid-cols-[1.4fr_1fr_120px_repeat(4,110px)_36px] lg:items-center">
              <div><div className="font-black">{cluster.ecu_type || cluster.ecu_family || "Unknown ECU"}</div><div className="mt-1 text-xs text-zinc-600">{cluster.ecu_family || "-"} / HW {cluster.hw_number || "-"}</div></div>
              <div><div className="font-black uppercase text-red-300">{cluster.feature_type.replaceAll("_", " ")}</div><div className="mt-1 break-all text-xs text-zinc-600">SW {cluster.sw_number || "General ECU-type cluster"}</div></div>
              <Value label="Samples" value={String(cluster.approved_sample_count)} />
              <Value label="Quality" value={`${Math.round(Number(cluster.average_quality_score))}/100`} />
              <Value label="Confidence" value={`${Math.round(Number(cluster.cluster_confidence))}%`} />
              <Status value={cluster.cluster_status} />
              <Value label="Outliers" value={String(cluster.outlier_sample_ids?.length || 0)} />
              <ChevronRight className="hidden h-5 w-5 text-zinc-600 lg:block" />
            </Link>
          ))}
          {!loading && !visible.length && <div className="p-10 text-center text-sm text-zinc-500">No clusters yet. Approve quality samples, then rebuild Level 2 evidence.</div>}
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, icon, tone = "red" }: { label: string; value: string | number; icon: React.ReactNode; tone?: "red" | "green" | "amber" }) { const color = tone === "green" ? "text-emerald-400" : tone === "amber" ? "text-amber-400" : "text-red-400"; return <div className="rounded-lg border border-white/10 bg-white/[0.025] p-4"><div className={color}>{icon}</div><div className="mt-4 text-3xl font-black">{value}</div><div className="mt-1 text-xs text-zinc-500">{label}</div></div>; }
function Value({ label, value }: { label: string; value: string }) { return <div><div className="text-[10px] font-black uppercase text-zinc-600 lg:hidden">{label}</div><div className="font-black">{value}</div></div>; }
function Status({ value }: { value: PatternClusterStatus }) { const color = value === "strong" || value === "mature" ? "border-emerald-700/40 bg-emerald-950/20 text-emerald-300" : value === "usable" ? "border-sky-700/40 bg-sky-950/20 text-sky-300" : "border-amber-700/40 bg-amber-950/20 text-amber-300"; return <span className={`w-fit rounded-md border px-2 py-1 text-xs font-black uppercase ${color}`}>{value}</span>; }
