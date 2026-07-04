"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Database, Loader2, RefreshCcw, ShieldAlert } from "lucide-react";
import { getStableSession } from "@/lib/authGuards";
import type { AiAccuracyMetric, AiClusterMember, AiPatternCluster, RepeatedRegionEvidence, TrainingServiceLabels } from "@/lib/ecuIntelligence/types";

type Sample = {
  id: string; request_id: string | null; brand: string | null; model: string | null; engine: string | null;
  ecu_family: string | null; ecu_type: string | null; sw_number: string | null; hw_number: string | null;
  performed_service_labels: TrainingServiceLabels | null; requested_service_labels: TrainingServiceLabels | null;
  data_quality_score: number | string | null; quality_rating: number | null; outcome: string | null;
  human_verification_status: string; learning_use_status: string; provider: string | null; source_type: string | null;
  revision_number: number; created_at: string;
};
type Payload = { cluster: AiPatternCluster; members: AiClusterMember[]; samples: Sample[]; accuracy: AiAccuracyMetric | null; warning: string };

export default function PatternClusterDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const authFetch = useCallback(async (url: string, init?: RequestInit) => {
    const { session } = await getStableSession();
    const token = session?.access_token;
    if (!token) throw new Error("Unauthorized");
    return fetch(url, { ...init, headers: { ...init?.headers, Authorization: `Bearer ${token}` } });
  }, []);
  const load = useCallback(async () => {
    setLoading(true); setMessage("");
    try {
      const response = await authFetch(`/api/admin/ai-training/clusters/${id}`);
      const payload = await response.json();
      if (response.status === 401) { window.location.href = `/login?redirect=/admin/ai-training/clusters/${id}`; return; }
      if (!response.ok) throw new Error(payload.error || "Cluster could not be loaded.");
      setData(payload as Payload);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Cluster could not be loaded."); }
    finally { setLoading(false); }
  }, [authFetch, id]);
  useEffect(() => { const timeout = window.setTimeout(() => { void load(); }, 100); return () => window.clearTimeout(timeout); }, [load]);

  const memberBySample = useMemo(() => new Map(data?.members.map((member) => [member.training_sample_id, member]) || []), [data?.members]);
  async function rebuild() {
    setRebuilding(true); setMessage("");
    try { const response = await authFetch(`/api/admin/ai-training/clusters/${id}/rebuild`, { method: "POST" }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Rebuild failed."); setMessage("Cluster rebuilt from current trusted samples."); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Rebuild failed."); }
    finally { setRebuilding(false); }
  }
  async function markNeedsReview(sampleId: string) {
    setMarkingId(sampleId); setMessage("");
    try { const response = await authFetch(`/api/admin/ai-training/${sampleId}/mark-outlier-review`, { method: "POST" }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Sample could not be marked."); setMessage("Outlier moved to needs review and removed from trusted eligibility."); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Sample could not be marked."); }
    finally { setMarkingId(null); }
  }

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-[#050505] text-white"><Loader2 className="h-9 w-9 animate-spin text-red-500" /></main>;
  if (!data) return <main className="flex min-h-screen items-center justify-center bg-[#050505] px-4 text-white"><div className="max-w-lg text-center"><AlertTriangle className="mx-auto h-10 w-10 text-red-400" /><h1 className="mt-4 text-2xl font-black">Cluster unavailable</h1><p className="mt-3 text-zinc-500">{message}</p></div></main>;
  const cluster = data.cluster;
  const repeated = cluster.repeated_regions || [];
  const outliers = data.members.filter((member) => member.is_outlier);

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <header className="border-b border-white/10 bg-black/80"><div className="mx-auto flex max-w-[1450px] flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between"><div><Link href="/admin/ai-training/clusters" className="inline-flex items-center text-sm font-bold text-zinc-500 hover:text-white"><ArrowLeft className="mr-2 h-4 w-4" />Pattern clusters</Link><div className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-red-400">{cluster.feature_type.replaceAll("_", " ")}</div><h1 className="mt-1 text-3xl font-black">{cluster.ecu_type || cluster.ecu_family || "Unknown ECU"}</h1><p className="mt-2 text-sm text-zinc-500">{cluster.ecu_family || "-"} / SW {cluster.sw_number || "general"} / HW {cluster.hw_number || "general"}</p></div><button onClick={() => void rebuild()} disabled={rebuilding} className="inline-flex h-11 items-center justify-center rounded-lg bg-[#b1121b] px-4 text-sm font-black disabled:opacity-50">{rebuilding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}Rebuild cluster</button></div></header>
      <div className="mx-auto max-w-[1450px] px-4 py-7">
        <div className="mb-6 border-l-2 border-amber-400 bg-amber-950/15 px-4 py-3 text-sm leading-6 text-amber-100/80">{data.warning}</div>
        {message && <div className="mb-5 rounded-lg border border-red-800/40 bg-red-950/20 p-4 text-sm text-red-100">{message}</div>}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <Metric label="Approved samples" value={cluster.approved_sample_count} /><Metric label="Average quality" value={`${Math.round(Number(cluster.average_quality_score))}/100`} /><Metric label="Confidence" value={`${Math.round(Number(cluster.cluster_confidence))}%`} /><Metric label="Status" value={cluster.cluster_status.toUpperCase()} /><Metric label="Repeated regions" value={repeated.length} /><Metric label="Outliers" value={outliers.length} /><Metric label="Auto precision" value={data.accuracy?.total_reviewed ? `${Math.round(Number(data.accuracy.precision_score))}%` : "N/A"} />
        </section>

        <div className="mt-7 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="min-w-0"><h2 className="text-xl font-black">Repeated changed-region buckets</h2><p className="mt-2 text-sm text-zinc-500">Buckets tolerate small offset variation. They do not prove map identity.</p><div className="mt-4 overflow-hidden rounded-lg border border-white/10">{repeated.map((region: RepeatedRegionEvidence) => <div key={region.bucket_start_hex} className="grid gap-3 border-b border-white/10 p-4 last:border-0 md:grid-cols-[150px_120px_100px_1fr]"><div className="font-mono text-sm text-red-300">{region.bucket_start_hex}<br />{region.bucket_end_hex}</div><Value label="Occurrence" value={`${region.occurrence_count} / ${cluster.sample_count}`} /><Value label="Rate" value={`${Math.round(region.occurrence_rate * 100)}%`} /><div className="text-xs leading-5 text-zinc-500"><div>{region.reason}</div><div className="mt-1">{region.notes}</div></div></div>)}{!repeated.length && <div className="p-8 text-center text-sm text-zinc-500">No region repeats meet the minimum support yet.</div>}</div></section>
          <aside className="space-y-5"><section className="rounded-lg border border-white/10 bg-white/[0.025] p-5"><h2 className="font-black">Confidence explanation</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><Value label="Sample support" value={String(cluster.sample_count)} /><Value label="Human verified" value={String(cluster.human_verified_sample_count)} /><Value label="Multi-label rate" value={`${Math.round(Number(cluster.feature_consistency_json?.multi_label_rate || 0) * 100)}%`} /><Value label="Auto feature support" value={`${Math.round(Number(cluster.feature_consistency_json?.automatic_feature_support_rate || 0) * 100)}%`} /></div></section><section className="rounded-lg border border-white/10 bg-white/[0.025] p-5"><h2 className="font-black">Common signature summary</h2><details className="mt-3"><summary className="cursor-pointer text-sm font-black text-red-300">View aggregate JSON</summary><pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-black/40 p-3 text-xs text-zinc-400">{JSON.stringify(cluster.common_pattern_signature, null, 2)}</pre></details></section></aside>
        </div>

        <section className="mt-8"><h2 className="text-xl font-black">Cluster members</h2><p className="mt-2 text-sm text-zinc-500">Outliers remain stored. Only an explicit admin action moves one to needs review.</p><div className="mt-4 space-y-3">{data.samples.map((sample) => { const member = memberBySample.get(sample.id); if (!member) return null; return <div key={sample.id} className={`grid gap-4 rounded-lg border p-4 lg:grid-cols-[1.3fr_1fr_120px_120px_auto] lg:items-center ${member.is_outlier ? "border-amber-700/40 bg-amber-950/10" : "border-white/10 bg-white/[0.025]"}`}><div><div className="flex flex-wrap items-center gap-2"><Link href={`/admin/ai-training/${sample.id}`} className="font-black text-white hover:text-red-300">{[sample.brand, sample.model, sample.engine].filter(Boolean).join(" ") || "Training sample"}</Link>{member.is_outlier && <span className="rounded-md border border-amber-700/40 bg-amber-950/25 px-2 py-1 text-xs font-black text-amber-300">OUTLIER</span>}</div><div className="mt-1 text-xs text-zinc-600">{sample.ecu_type || sample.ecu_family || "Unknown ECU"} / Rev. {sample.revision_number}</div></div><div className="text-xs leading-5 text-zinc-500">{(member.membership_reasons || []).slice(0, 3).join(" ")}</div><Value label="Membership" value={`${Math.round(Number(member.membership_score))}%`} /><Value label="Quality" value={`${Math.round(Number(sample.data_quality_score || 0))}/100`} />{member.is_outlier && sample.human_verification_status !== "needs_review" ? <button onClick={() => void markNeedsReview(sample.id)} disabled={markingId === sample.id} className="h-10 rounded-lg border border-amber-700/40 px-3 text-xs font-black text-amber-200 disabled:opacity-50">{markingId === sample.id ? "Updating..." : "Mark needs review"}</button> : <span className="text-xs font-black text-emerald-300"><CheckCircle2 className="mr-1 inline h-4 w-4" />Reviewed</span>}</div>; })}{!data.samples.length && <div className="rounded-lg border border-dashed border-white/15 p-8 text-center text-zinc-500">No trusted members.</div>}</div></section>
        {outliers.length > 0 && <div className="mt-6 flex items-start gap-3 rounded-lg border border-amber-700/30 bg-amber-950/10 p-4 text-sm text-amber-100/80"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />This cluster has {outliers.length} outlier sample{outliers.length === 1 ? "" : "s"}. Human review is recommended; no automatic exclusion was performed.</div>}
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) { return <div className="rounded-lg border border-white/10 bg-white/[0.025] p-4"><Database className="h-5 w-5 text-red-400" /><div className="mt-4 break-words text-2xl font-black">{value}</div><div className="mt-1 text-xs text-zinc-500">{label}</div></div>; }
function Value({ label, value }: { label: string; value: string }) { return <div><div className="text-[10px] font-black uppercase tracking-[0.1em] text-zinc-600">{label}</div><div className="mt-1 break-words font-black">{value}</div></div>; }
