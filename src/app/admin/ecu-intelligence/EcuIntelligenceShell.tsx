"use client";

import Link from "next/link";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  BrainCircuit,
  CheckCircle2,
  Database,
  FileCode2,
  Layers3,
  Loader2,
  RefreshCcw,
  Search,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/authGuards";

type ShellMode = "overview" | "clusters" | "services" | "patterns" | "similarity" | "review" | "insights" | "backfill";

type ShellProps = {
  mode: ShellMode;
  title: string;
  subtitle: string;
  endpoint: string;
};

const navItems = [
  { href: "/admin/ecu-intelligence", label: "Overview" },
  { href: "/admin/ecu-intelligence/clusters", label: "Clusters" },
  { href: "/admin/ecu-intelligence/services", label: "Services" },
  { href: "/admin/ecu-intelligence/patterns", label: "Patterns" },
  { href: "/admin/ecu-intelligence/similarity", label: "Similarity" },
  { href: "/admin/ecu-intelligence/review", label: "Review" },
  { href: "/admin/ecu-intelligence/insights", label: "Insights" },
  { href: "/admin/ecu-intelligence/backfill", label: "Backfill" },
];

function value(payload: unknown, path: string, fallback: unknown = 0) {
  return path.split(".").reduce<unknown>((current, key) =>
    current && typeof current === "object" ? (current as Record<string, unknown>)[key] : undefined,
  payload) ?? fallback;
}

function asArray<T = Record<string, unknown>>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function label(value: unknown) {
  return String(value ?? "-").replaceAll("_", " ");
}

export default function EcuIntelligenceShell({ mode, title, subtitle, endpoint }: ShellProps) {
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const url = mode === "clusters" && search.trim()
        ? `${endpoint}?search=${encodeURIComponent(search.trim())}`
        : endpoint;
      const response = await authenticatedFetch(url);
      const data = await response.json();
      if (response.status === 401) {
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      if (response.status === 403) throw new Error("Access denied. ECU Intelligence requires ai_training.manage.");
      if (!response.ok) throw new Error(data.error || "ECU Intelligence data could not be loaded.");
      setPayload(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ECU Intelligence data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [endpoint, mode, search]);

  useEffect(() => {
    const handle = window.setTimeout(() => { void load(); }, 120);
    return () => window.clearTimeout(handle);
  }, [load]);

  const warnings = asArray<string>(payload?.warnings);
  const safety = payload?.safety as Record<string, unknown> | undefined;

  return (
    <main className="mg-compact-ui min-h-screen bg-[#050505] text-white">
      <header className="border-b border-white/10 bg-black/80">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-5 px-4 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <Link href="/admin" className="inline-flex items-center text-sm font-bold text-zinc-500 hover:text-white">
                <ArrowLeft className="mr-2 h-4 w-4" /> Admin workspace
              </Link>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-red-800/50 bg-red-950/25 text-red-400">
                  <BrainCircuit className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.22em] text-red-500">ECU Intelligence Center</div>
                  <h1 className="text-2xl font-black sm:text-3xl">{title}</h1>
                  <p className="mt-1 max-w-4xl text-sm text-zinc-400">{subtitle}</p>
                </div>
              </div>
            </div>
            <button onClick={() => void load()} disabled={loading} className="inline-flex h-11 w-fit items-center rounded-lg border border-white/10 px-4 text-sm font-black hover:bg-white/5 disabled:opacity-50">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              Refresh
            </button>
          </div>
          <nav className="flex gap-2 overflow-x-auto pb-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-black uppercase tracking-[0.08em] ${
                  (mode === "overview" ? item.href === "/admin/ecu-intelligence" : item.href.endsWith(mode))
                    ? "border-red-700 bg-red-950/30 text-red-100"
                    : "border-white/10 bg-white/[0.03] text-zinc-500 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-4 py-7">
        <div className="mb-6 rounded-lg border border-emerald-700/30 bg-emerald-950/15 p-4 text-sm leading-6 text-emerald-100/80">
          Admin-only evidence center. It aggregates metadata from uploads, File Expert, learning candidates, dataset review, patterns, maps and readiness. It does not generate, modify or deliver firmware.
        </div>
        {message && <div className="mb-6 rounded-lg border border-red-800/40 bg-red-950/20 p-4 text-sm text-red-100">{message}</div>}
        {warnings.length > 0 && (
          <div className="mb-6 rounded-lg border border-amber-700/30 bg-amber-950/15 p-4 text-sm text-amber-100">
            <strong>Schema warnings:</strong> {warnings.slice(0, 3).join(" | ")}
          </div>
        )}

        {mode === "clusters" && (
          <label className="relative mb-5 block max-w-xl">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search supplier, ECU, HW, SW, calibration..." className="h-12 w-full rounded-lg border border-white/10 bg-white/[0.03] pl-11 pr-4 text-sm font-bold outline-none focus:border-red-700" />
          </label>
        )}

        {loading && <div className="rounded-lg border border-white/10 bg-white/[0.025] p-10 text-center text-sm text-zinc-500">Loading ECU Intelligence evidence...</div>}
        {!loading && payload && (
          <>
            {mode === "overview" && <Overview payload={payload} />}
            {mode === "clusters" && <Clusters payload={payload} />}
            {mode === "services" && <Services payload={payload} />}
            {mode === "patterns" && <Patterns payload={payload} />}
            {mode === "similarity" && <Similarity payload={payload} />}
            {mode === "review" && <Review payload={payload} />}
            {mode === "insights" && <Insights payload={payload} />}
            {mode === "backfill" && <Backfill payload={payload} />}
            <Safety safety={safety} />
          </>
        )}
      </div>
    </main>
  );
}

function Overview({ payload }: { payload: Record<string, unknown> }) {
  const metrics = payload.metrics as Record<string, unknown> | undefined;
  const clusters = asArray<Record<string, unknown>>(payload.clusters);
  const insights = asArray<Record<string, unknown>>(payload.insights);
  const reviewQueue = asArray<Record<string, unknown>>(payload.reviewQueue);
  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <Metric icon={<FileCode2 />} label="Uploads" value={metrics?.finalizedCustomerUploads} />
        <Metric icon={<Database />} label="File candidates" value={metrics?.learningFileCandidates} />
        <Metric icon={<Sparkles />} label="Pair candidates" value={metrics?.pairCandidates} />
        <Metric icon={<CheckCircle2 />} label="Approved pairs" value={metrics?.approvedLearningPairs} tone="green" />
        <Metric icon={<Layers3 />} label="Exact clusters" value={metrics?.exactClusterCount} />
        <Metric icon={<ShieldAlert />} label="Review queue" value={metrics?.reviewQueueCount} tone="amber" />
      </section>
      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Strongest exact clusters">
          <div className="space-y-2">
            {clusters.map((cluster) => <ClusterRow key={String(cluster.id)} cluster={cluster} />)}
            {!clusters.length && <Empty text="No exact ECU clusters yet. Customer upload candidates and File Expert metadata will appear here after enrichment." />}
          </div>
        </Panel>
        <Panel title="Deterministic insights">
          <div className="space-y-2">
            {insights.map((item) => <InsightRow key={String(item.id)} item={item} />)}
            {!insights.length && <Empty text="No deterministic insight needs attention right now." />}
          </div>
        </Panel>
      </section>
      <Panel title="Highest priority review">
        <div className="grid gap-2 md:grid-cols-2">
          {reviewQueue.map((item) => <ReviewRow key={String(item.id)} item={item} />)}
          {!reviewQueue.length && <Empty text="No review queue items. Candidates remain review-first when new jobs arrive." />}
        </div>
      </Panel>
    </div>
  );
}

function Clusters({ payload }: { payload: Record<string, unknown> }) {
  const clusters = asArray<Record<string, unknown>>(payload.clusters);
  const pagination = payload.pagination as Record<string, unknown> | undefined;
  return (
    <Panel title={`Exact cluster explorer (${pagination?.total ?? clusters.length})`}>
      <div className="space-y-2">
        {clusters.map((cluster) => <ClusterRow key={String(cluster.id)} cluster={cluster} detailed />)}
        {!clusters.length && <Empty text="No clusters match this filter." />}
      </div>
    </Panel>
  );
}

function Services({ payload }: { payload: Record<string, unknown> }) {
  const services = asArray<Record<string, unknown>>(payload.services);
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {services.map((service) => (
        <div key={String(service.category)} className="rounded-lg border border-white/10 bg-white/[0.025] p-4">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-red-300">{label(service.category)}</div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
            <Value label="Candidates" value={service.candidateCount} />
            <Value label="Approved" value={service.approvedCount} />
            <Value label="Review" value={service.reviewRequiredCount} />
          </div>
          <div className="mt-3 rounded-md border border-white/10 bg-black/30 px-3 py-2 text-xs font-bold text-zinc-300">{label(service.strongestReadiness)}</div>
        </div>
      ))}
    </section>
  );
}

function Patterns({ payload }: { payload: Record<string, unknown> }) {
  const clusters = asArray<Record<string, unknown>>(payload.clusters);
  const signatures = asArray<Record<string, unknown>>(payload.signatures);
  return (
    <section className="grid gap-5 xl:grid-cols-2">
      <Panel title="Pattern clusters">{clusters.map((item) => <MiniRow key={String(item.id)} title={`${label(item.feature_type)} / ${item.ecu_type || item.ecu_family || "Unknown ECU"}`} detail={`Samples ${item.sample_count ?? 0} / status ${item.cluster_status ?? "-"}`} />)}{!clusters.length && <Empty text="No pattern clusters available." />}</Panel>
      <Panel title="Pattern signatures">{signatures.map((item) => <MiniRow key={String(item.id)} title={`${label(item.feature_type)} / ${item.ecu_type || item.ecu_family || "Unknown ECU"}`} detail={`Confidence ${item.confidence ?? 0} / confirmed ${String(item.human_confirmed)}`} />)}{!signatures.length && <Empty text="No pattern signatures available." />}</Panel>
    </section>
  );
}

function Similarity({ payload }: { payload: Record<string, unknown> }) {
  const results = asArray<Record<string, unknown>>(payload.results);
  return <Panel title="Similarity explorer">{results.map((item) => <MiniRow key={String(item.id)} title={`${item.source_type} ${String(item.source_id).slice(0, 8)} -> ${String(item.compared_sample_id).slice(0, 8)}`} detail={`Overall ${item.overall_similarity_score ?? 0} / ECU ${item.ecu_match_score ?? 0} / evidence retrieval only`} />)}{!results.length && <Empty text="No similarity records available." />}</Panel>;
}

function Review({ payload }: { payload: Record<string, unknown> }) {
  const items = asArray<Record<string, unknown>>(payload.items);
  return <Panel title="Unified review queue"><div className="grid gap-2 md:grid-cols-2">{items.map((item) => <ReviewRow key={String(item.id)} item={item} />)}{!items.length && <Empty text="No prioritized review items." />}</div></Panel>;
}

function Insights({ payload }: { payload: Record<string, unknown> }) {
  const insights = asArray<Record<string, unknown>>(payload.insights);
  return <Panel title="Evidence-backed insights">{insights.map((item) => <InsightRow key={String(item.id)} item={item} />)}{!insights.length && <Empty text="No deterministic insights are currently raised." />}</Panel>;
}

function Backfill({ payload }: { payload: Record<string, unknown> }) {
  const status = payload.status as Record<string, unknown> | undefined;
  const events = asArray<Record<string, unknown>>(status?.lastEvents);
  return (
    <Panel title="Backfill control and status">
      <div className="grid gap-3 md:grid-cols-3">
        <Metric icon={<Database />} label="Candidates visible" value={status?.candidateCount} />
        <Metric icon={<ShieldAlert />} label="Approved samples created" value={status?.createsApprovedSamples ? "Yes" : "No"} tone="amber" />
        <Link href="/admin/ai-training/corpus" className="flex min-h-24 items-center justify-center rounded-lg border border-red-800/40 bg-red-950/20 px-4 text-sm font-black text-red-100 hover:bg-red-900/30">Open existing backfill workflow</Link>
      </div>
      <div className="mt-5 space-y-2">
        {events.map((event) => <MiniRow key={String(event.id)} title={String(event.action)} detail={`${event.created_at ?? ""} ${event.notes ?? ""}`} />)}
        {!events.length && <Empty text="No recorded backfill events found. Use the existing learning corpus backfill dry-run first." />}
      </div>
    </Panel>
  );
}

function ClusterRow({ cluster, detailed = false }: { cluster: Record<string, unknown>; detailed?: boolean }) {
  const identity = cluster.identity as Record<string, unknown> | undefined;
  const score = value(cluster, "knowledgeScore.score");
  return (
    <Link href={`/admin/ecu-intelligence/clusters/${encodeURIComponent(String(cluster.id))}`} className="grid gap-3 rounded-lg border border-white/10 bg-black/30 p-4 hover:bg-white/[0.035] lg:grid-cols-[1.2fr_repeat(5,110px)_80px] lg:items-center">
      <div>
        <div className="font-black">{String(identity?.displayLabel ?? "Unknown ECU identity")}</div>
        <div className="mt-1 break-all text-xs text-zinc-500">{String(identity?.clusterKey ?? cluster.id ?? "")}</div>
      </div>
      <Value label="Sources" value={cluster.uniqueSourceCount} />
      <Value label="Pairs" value={cluster.pairCandidateCount} />
      <Value label="Approved" value={cluster.approvedPairCount} />
      <Value label="Patterns" value={cluster.patternClusterCount} />
      <Value label="Score" value={`${score}/100`} />
      <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-xs font-black uppercase text-zinc-300">{label(cluster.readiness)}</span>
      {detailed && <div className="lg:col-span-7 text-xs text-zinc-500">Missing evidence: {String(cluster.missingEvidenceCount ?? 0)} / conflicts: {String(cluster.conflictCount ?? 0)} / synthetic: {String(cluster.syntheticEvidenceCount ?? 0)}</div>}
    </Link>
  );
}

function ReviewRow({ item }: { item: Record<string, unknown> }) {
  return (
    <Link href={String(item.adminHref || "/admin/ecu-intelligence/review")} className="rounded-lg border border-white/10 bg-black/30 p-4 hover:bg-white/[0.035]">
      <div className="text-xs font-black uppercase tracking-[0.14em] text-amber-300">{String(item.sourceType).replaceAll("_", " ")}</div>
      <div className="mt-2 font-black">{item.title as string}</div>
      <div className="mt-1 text-xs text-zinc-500">{item.scope as string}</div>
      <div className="mt-3 text-sm font-black text-white">Priority {String(item.priorityScore ?? 0)}/100</div>
      <div className="mt-1 text-xs text-zinc-500">{item.recommendedAction as string}</div>
    </Link>
  );
}

function InsightRow({ item }: { item: Record<string, unknown> }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${item.severity === "critical" ? "bg-red-950 text-red-200" : item.severity === "warning" ? "bg-amber-950 text-amber-200" : "bg-zinc-900 text-zinc-300"}`}>{item.severity as string}</span>
        <span className="text-xs font-bold text-zinc-500">{item.scope as string}</span>
      </div>
      <div className="mt-2 font-black">{item.title as string}</div>
      <p className="mt-1 text-sm leading-6 text-zinc-400">{item.explanation as string}</p>
      <div className="mt-3 text-xs font-bold text-red-200">{item.recommendedAction as string}</div>
    </div>
  );
}

function Safety({ safety }: { safety: Record<string, unknown> | undefined }) {
  if (!safety) return null;
  return (
    <div className="mt-6 grid gap-2 rounded-lg border border-emerald-700/30 bg-emerald-950/10 p-4 text-xs text-emerald-100/80 md:grid-cols-4">
      <span>Raw bytes: {String(safety.rawFirmwareBytesReturned ?? false)}</span>
      <span>Storage paths: {String(safety.storagePathsReturned ?? false)}</span>
      <span>MOD generated: {String(safety.modGenerated ?? false)}</span>
      <span>Automation: {String(safety.automationEnabled ?? false)}</span>
    </div>
  );
}

function Metric({ label, value, icon, tone = "red" }: { label: string; value: unknown; icon: React.ReactNode; tone?: "red" | "green" | "amber" }) {
  const color = tone === "green" ? "text-emerald-400" : tone === "amber" ? "text-amber-400" : "text-red-400";
  return <div className="rounded-lg border border-white/10 bg-white/[0.025] p-4"><div className={color}>{icon}</div><div className="mt-4 text-3xl font-black">{String(value ?? 0)}</div><div className="mt-1 text-xs text-zinc-500">{label}</div></div>;
}

function Value({ label, value }: { label: string; value: unknown }) {
  return <div><div className="text-[10px] font-black uppercase text-zinc-600 lg:hidden">{label}</div><div className="font-black">{String(value ?? 0)}</div></div>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-lg border border-white/10 bg-white/[0.025] p-4"><h2 className="mb-4 text-lg font-black">{title}</h2>{children}</section>;
}

function MiniRow({ title, detail }: { title: string; detail: string }) {
  return <div className="rounded-lg border border-white/10 bg-black/30 p-3"><div className="font-black">{title}</div><div className="mt-1 text-xs text-zinc-500">{detail}</div></div>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-white/10 p-6 text-center text-sm text-zinc-500">{text}</div>;
}
