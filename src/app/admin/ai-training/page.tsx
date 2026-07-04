"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Database,
  FileCode2,
  FileSearch,
  Gauge,
  Layers3,
  Loader2,
  PlayCircle,
  RefreshCcw,
  Search,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import type { AiEcuKnowledgeProfile, HumanVerificationStatus, LearningUseStatus, TrainingServiceLabels } from "@/lib/ecuIntelligence/types";
import { trainingFeatureKeys } from "@/lib/ecuIntelligence/types";
import { getKnowledgeLevelDefinition, knowledgeLevelDefinitions } from "@/lib/ecuIntelligence/readiness";

type SampleSummary = {
  id: string;
  request_id: string | null;
  brand: string | null;
  model: string | null;
  engine: string | null;
  ecu_type: string | null;
  ecu_family: string | null;
  sw_number: string | null;
  hw_number: string | null;
  service_labels: TrainingServiceLabels | null;
  requested_service_labels: TrainingServiceLabels | null;
  performed_service_labels: TrainingServiceLabels | null;
  provider: string | null;
  source_type: string | null;
  revision_label: string | null;
  revision_number: number;
  change_type_classification: string | null;
  learning_use_status: LearningUseStatus;
  auto_label_confidence: number | string | null;
  human_verification_status: HumanVerificationStatus;
  quality_rating: number | null;
  data_quality_score: number | string | null;
  data_quality_reasons: Array<{ code: string; message: string; impact: number }> | null;
  safety_rating: string | null;
  outcome: string | null;
  ori_file_name: string | null;
  mod_file_name: string | null;
  source_metadata: Record<string, unknown> | null;
  has_similarity_matches: boolean;
  created_at: string;
};

type EventSummary = {
  id: string;
  event_type: string;
  message: string | null;
  created_at: string;
};

type Payload = {
  demoEnabled: boolean;
  level2Available: boolean;
  samples: SampleSummary[];
  profiles: AiEcuKnowledgeProfile[];
  events: EventSummary[];
  accuracy: {
    total_reviewed: number;
    precision_score: number | string;
    review_coverage: number | string;
    confusion_json: Record<string, unknown> | null;
  } | null;
  stats: {
    total: number;
    oriModPairs: number;
    confirmed: number;
    unverified: number;
    needsReview: number;
    rejected: number;
    approvedForLearning: number;
    pendingLearning: number;
    excludedFromLearning: number;
    averageQualityScore: number;
    similarityReadyProfiles: number;
    profiles: number;
    level3Plus: number;
    patternClusters: number;
    weakClusters: number;
    usableClusters: number;
    strongClusters: number;
    outliersNeedingReview: number;
    autoLabelPrecision: number;
    reviewCoverage: number;
    featureCounts: Record<string, number>;
  };
};

const emptyPayload: Payload = {
  demoEnabled: false,
  level2Available: false,
  samples: [],
  profiles: [],
  events: [],
  accuracy: null,
  stats: { total: 0, oriModPairs: 0, confirmed: 0, unverified: 0, needsReview: 0, rejected: 0, approvedForLearning: 0, pendingLearning: 0, excludedFromLearning: 0, averageQualityScore: 0, similarityReadyProfiles: 0, profiles: 0, level3Plus: 0, patternClusters: 0, weakClusters: 0, usableClusters: 0, strongClusters: 0, outliersNeedingReview: 0, autoLabelPrecision: 0, reviewCoverage: 0, featureCounts: {} },
};

const statusOptions: Array<HumanVerificationStatus | "all"> = [
  "all",
  "unverified",
  "needs_review",
  "confirmed",
  "rejected",
];

export default function AiTrainingPage() {
  const [data, setData] = useState<Payload>(emptyPayload);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [setupRequired, setSetupRequired] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof statusOptions)[number]>("all");
  const [learningFilter, setLearningFilter] = useState<LearningUseStatus | "all">("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [ecuFamilyFilter, setEcuFamilyFilter] = useState("");
  const [ecuTypeFilter, setEcuTypeFilter] = useState("");
  const [minimumQuality, setMinimumQuality] = useState("0");
  const [hasSimilarity, setHasSimilarity] = useState(false);
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false);
  const [view, setView] = useState<"samples" | "profiles" | "events">("samples");
  const [demoRunning, setDemoRunning] = useState(false);

  const authFetch = useCallback(async (url: string, init?: RequestInit) => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) throw new Error("Unauthorized");
    return fetch(url, {
      ...init,
      headers: { ...init?.headers, Authorization: `Bearer ${token}` },
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const query = new URLSearchParams({
        status,
        learningUseStatus: learningFilter,
        serviceLabel: serviceFilter,
        minQuality: minimumQuality,
        hasSimilarity: String(hasSimilarity),
        needsReview: String(needsReviewOnly),
      });
      if (ecuFamilyFilter.trim()) query.set("ecuFamily", ecuFamilyFilter.trim());
      if (ecuTypeFilter.trim()) query.set("ecuType", ecuTypeFilter.trim());
      const response = await authFetch(`/api/admin/ai-training?${query.toString()}`);
      const payload = await response.json();
      if (response.status === 401) {
        window.location.href = "/login?redirect=/admin/ai-training";
        return;
      }
      if (response.status === 403) {
        setData(emptyPayload);
        throw new Error("Access denied. Your staff role cannot review ECU learning data.");
      }
      if (!response.ok) {
        setSetupRequired(Boolean(payload.setupRequired));
        throw new Error(payload.error || "ECU learning data could not be loaded.");
      }
      setSetupRequired(false);
      setData(payload as Payload);
    } catch (error) {
      if (error instanceof Error && error.message === "Unauthorized") {
        window.location.href = "/login?redirect=/admin/ai-training";
        return;
      }
      setMessage(error instanceof Error ? error.message : "ECU learning data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, ecuFamilyFilter, ecuTypeFilter, hasSimilarity, learningFilter, minimumQuality, needsReviewOnly, serviceFilter, status]);

  async function runDemo() {
    setDemoRunning(true);
    setMessage("");
    try {
      const response = await authFetch("/api/admin/ai-training/demo", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Demo training sample could not be created.");
      setMessage(payload.message || "Level 0 demo completed.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Level 0 demo failed.");
    } finally {
      setDemoRunning(false);
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => { void load(); }, 250);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const filteredSamples = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return data.samples;
    return data.samples.filter((sample) =>
      [sample.id, sample.request_id, sample.brand, sample.model, sample.engine, sample.ecu_type, sample.ecu_family, sample.sw_number, sample.hw_number]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [data.samples, search]);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#050505] text-white">
      <header className="border-b border-white/10 bg-black/80">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <Link href="/admin" className="inline-flex items-center text-sm font-bold text-zinc-500 hover:text-white">
              <ArrowLeft className="mr-2 h-4 w-4" /> Admin operations
            </Link>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-red-800/50 bg-red-950/25 text-red-400">
                <BrainCircuit className="h-6 w-6" />
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-red-500">ECU Intelligence</div>
                <h1 className="text-2xl font-black sm:text-3xl">Learning control room</h1>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.demoEnabled && (
              <button onClick={() => void runDemo()} disabled={demoRunning || loading} className="inline-flex h-11 items-center justify-center rounded-lg bg-[#b1121b] px-4 text-sm font-black hover:bg-[#c91824] disabled:opacity-50">
                {demoRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
                Run safe demo
              </button>
            )}
            <button onClick={() => void load()} disabled={loading} className="inline-flex h-11 items-center justify-center rounded-lg border border-white/10 px-4 text-sm font-black hover:bg-white/5 disabled:opacity-50">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-4 py-7">
        <div className="mb-6 border-l-2 border-amber-400 bg-amber-950/15 px-4 py-3 text-sm leading-6 text-amber-100/80">
          Analysis and labels support expert review only. No file generation or automatic flash approval is enabled.
        </div>

        {data.demoEnabled && (
          <div className="mb-6 rounded-lg border border-sky-700/40 bg-sky-950/15 px-4 py-3 text-sm leading-6 text-sky-100/80">
            <strong className="text-sky-200">Demo mode enabled.</strong> This action uses deterministic, harmless files in the private <code>ai-training</code> bucket. It never creates a customer order, and hash checks prevent duplicates.
          </div>
        )}

        {message && (
          <div className="mb-6 rounded-lg border border-red-800/40 bg-red-950/20 p-4 text-sm text-red-100">
            {message}
            {setupRequired && <div className="mt-2 font-black">Run `scripts/add-ecu-intelligence-learning.sql` and `scripts/add-ai-training-quality.sql` in Supabase.</div>}
          </div>
        )}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 xl:grid-cols-10">
          <Metric icon={<Database />} label="Training samples" value={data.stats.total} />
          <Metric icon={<FileCode2 />} label="ORI / MOD pairs" value={data.stats.oriModPairs} />
          <Metric icon={<CheckCircle2 />} label="Human confirmed" value={data.stats.confirmed} tone="green" />
          <Metric icon={<FileSearch />} label="Unverified" value={data.stats.unverified} tone="amber" />
          <Metric icon={<FileSearch />} label="Needs review" value={data.stats.needsReview} tone="amber" />
          <Metric icon={<ShieldAlert />} label="Rejected" value={data.stats.rejected} />
          <Metric icon={<CheckCircle2 />} label="Learning approved" value={data.stats.approvedForLearning} tone="green" />
          <Metric icon={<FileSearch />} label="Learning pending" value={data.stats.pendingLearning} tone="amber" />
          <Metric icon={<ShieldAlert />} label="Learning excluded" value={data.stats.excludedFromLearning} />
          <Metric icon={<Gauge />} label="Average quality" value={data.stats.averageQualityScore} tone="green" />
          <Metric icon={<Sparkles />} label="Similarity-ready" value={data.stats.similarityReadyProfiles} tone="green" />
          <Metric icon={<Layers3 />} label="ECU profiles" value={data.stats.profiles} />
          <Metric icon={<Sparkles />} label="Level 3+" value={data.stats.level3Plus} tone="green" />
        </section>

        <section className="mt-4 rounded-lg border border-red-900/45 bg-red-950/10 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.18em] text-red-400">Level 2 pattern intelligence</div>
              <h2 className="mt-1 text-xl font-black">Cluster evidence and measured label accuracy</h2>
              <p className="mt-2 text-xs leading-5 text-zinc-500">Evidence only. Cluster output never creates, edits or approves a tuning file.</p>
            </div>
            <Link href="/admin/ai-training/clusters" className="inline-flex h-11 items-center justify-center rounded-lg border border-red-700/50 bg-red-950/25 px-4 text-sm font-black text-red-100 hover:bg-red-900/30">
              <Layers3 className="mr-2 h-4 w-4" /> Open clusters
            </Link>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            <Metric icon={<Layers3 />} label="Pattern clusters" value={data.stats.patternClusters} />
            <Metric icon={<CheckCircle2 />} label="Strong clusters" value={data.stats.strongClusters} tone="green" />
            <Metric icon={<Sparkles />} label="Usable clusters" value={data.stats.usableClusters} tone="green" />
            <Metric icon={<ShieldAlert />} label="Weak clusters" value={data.stats.weakClusters} tone="amber" />
            <Metric icon={<FileSearch />} label="Outliers" value={data.stats.outliersNeedingReview} tone="amber" />
            <Metric icon={<Gauge />} label="Auto precision %" value={Math.round(data.stats.autoLabelPrecision)} tone="green" />
            <Metric icon={<Activity />} label="Review coverage %" value={Math.round(data.stats.reviewCoverage)} />
          </div>
          {!data.level2Available && !loading && (
            <div className="mt-4 rounded-lg border border-amber-700/30 bg-amber-950/15 px-4 py-3 text-sm text-amber-100/80">
              Level 2 database migration is not installed yet. Existing Level 0/1 workflows remain available.
            </div>
          )}
        </section>

        <section className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-4 xl:grid-cols-6">
          {trainingFeatureKeys.map((feature) => (
            <div key={feature} className="bg-[#090909] px-3 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.1em] text-zinc-600">{feature.replaceAll("_", " ")}</div>
              <div className="mt-1 text-lg font-black text-zinc-200">{data.stats.featureCounts[feature] || 0}</div>
            </div>
          ))}
        </section>

        <div className="mt-7 flex flex-wrap gap-2 border-b border-white/10 pb-4">
          <ViewButton active={view === "samples"} onClick={() => setView("samples")} icon={<Database />} label="Samples" />
          <ViewButton active={view === "profiles"} onClick={() => setView("profiles")} icon={<Layers3 />} label="Knowledge profiles" />
          <ViewButton active={view === "events"} onClick={() => setView("events")} icon={<Activity />} label="Audit events" />
        </div>

        {view === "samples" && (
          <section className="mt-6">
            <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search vehicle, ECU, HW/SW or request..." className="h-12 w-full rounded-lg border border-white/10 bg-white/[0.03] pl-11 pr-4 text-sm font-bold outline-none focus:border-red-700" />
              </label>
              <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="h-12 rounded-lg border border-white/10 bg-[#0a0a0a] px-4 text-sm font-black outline-none focus:border-red-700">
                {statusOptions.map((item) => <option key={item} value={item}>{humanLabel(item)}</option>)}
              </select>
              <select value={learningFilter} onChange={(event) => setLearningFilter(event.target.value as LearningUseStatus | "all")} className="h-12 rounded-lg border border-white/10 bg-[#0a0a0a] px-4 text-sm font-black outline-none focus:border-red-700">
                <option value="all">All learning states</option><option value="pending">Pending</option><option value="approved_for_learning">Approved for learning</option><option value="excluded">Excluded</option>
              </select>
              <select value={serviceFilter} onChange={(event) => setServiceFilter(event.target.value)} className="h-12 rounded-lg border border-white/10 bg-[#0a0a0a] px-4 text-sm font-black outline-none focus:border-red-700">
                <option value="all">All actual services</option>{trainingFeatureKeys.map((feature) => <option key={feature} value={feature}>{humanLabel(feature)}</option>)}
              </select>
              <input value={ecuFamilyFilter} onChange={(event) => setEcuFamilyFilter(event.target.value)} placeholder="ECU family" className="h-12 rounded-lg border border-white/10 bg-[#0a0a0a] px-4 text-sm font-bold outline-none focus:border-red-700" />
              <input value={ecuTypeFilter} onChange={(event) => setEcuTypeFilter(event.target.value)} placeholder="ECU type" className="h-12 rounded-lg border border-white/10 bg-[#0a0a0a] px-4 text-sm font-bold outline-none focus:border-red-700" />
              <select value={minimumQuality} onChange={(event) => setMinimumQuality(event.target.value)} className="h-12 rounded-lg border border-white/10 bg-[#0a0a0a] px-4 text-sm font-black outline-none focus:border-red-700">
                <option value="0">Any quality score</option><option value="60">Quality 60+</option><option value="80">Quality 80+</option><option value="90">Quality 90+</option>
              </select>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex h-12 cursor-pointer items-center gap-3 rounded-lg border border-white/10 bg-[#0a0a0a] px-3 text-xs font-black text-zinc-300"><input type="checkbox" checked={hasSimilarity} onChange={(event) => setHasSimilarity(event.target.checked)} className="h-4 w-4 accent-red-600" />Has matches</label>
                <label className="flex h-12 cursor-pointer items-center gap-3 rounded-lg border border-white/10 bg-[#0a0a0a] px-3 text-xs font-black text-zinc-300"><input type="checkbox" checked={needsReviewOnly} onChange={(event) => setNeedsReviewOnly(event.target.checked)} className="h-4 w-4 accent-amber-500" />Needs review</label>
              </div>
            </div>

            <div className="space-y-3">
              {filteredSamples.map((sample) => (
                <Link key={sample.id} href={`/admin/ai-training/${sample.id}`} className="grid min-w-0 gap-4 rounded-lg border border-white/10 bg-white/[0.025] p-4 transition hover:border-red-800/60 hover:bg-white/[0.045] md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_160px_36px] md:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Status value={sample.human_verification_status} />
                      <LearningStatus value={sample.learning_use_status || "pending"} />
                      <span className="rounded-md border border-white/10 px-2 py-1 text-xs font-bold text-zinc-400">Rev. {sample.revision_number || 1}{sample.revision_label ? ` / ${sample.revision_label}` : ""}</span>
                      {sample.has_similarity_matches && <span className="rounded-md border border-sky-700/40 bg-sky-950/20 px-2 py-1 text-xs font-black text-sky-200">Similarity evidence</span>}
                    </div>
                    <div className="mt-3 break-words text-lg font-black">{[sample.brand, sample.model, sample.engine].filter(Boolean).join(" ") || "Vehicle metadata pending"}</div>
                    <div className="mt-1 break-all text-xs text-zinc-600">Request {sample.request_id || (sample.source_metadata?.demo ? "demo fixture" : "manual")} / {formatDate(sample.created_at)}</div>
                    <div className="mt-2 text-xs text-zinc-500">{sample.provider || "unknown provider"} / {sample.source_type || "unknown source"} / {sample.change_type_classification || "unclassified"}</div>
                  </div>
                  <div className="min-w-0 text-sm">
                    <div className="break-words font-black text-zinc-200">{sample.ecu_type || sample.ecu_family || "ECU not identified"}</div>
                    <div className="mt-1 break-all text-xs text-zinc-500">HW {sample.hw_number || "-"} / SW {sample.sw_number || "-"}</div>
                    <div className="mt-2 text-xs text-amber-300">Requested: {featureList(sample.requested_service_labels || sample.service_labels)}</div>
                    <div className="mt-1 text-xs text-emerald-300">Performed: {featureList(sample.performed_service_labels)}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center md:grid-cols-1 md:text-left">
                    <Small label="Auto confidence" value={`${Math.round(Number(sample.auto_label_confidence || 0) * 100)}%`} />
                    <Small label="Data quality" value={`${Math.round(Number(sample.data_quality_score || 0))}/100`} />
                    <Small label="Human rating" value={sample.quality_rating ? `${sample.quality_rating}/5` : "Not rated"} />
                  </div>
                  <ChevronRight className="hidden h-5 w-5 text-zinc-600 md:block" />
                </Link>
              ))}
              {!loading && !filteredSamples.length && <Empty text="No training samples match this view." />}
            </div>
          </section>
        )}

        {view === "profiles" && (
          <section className="mt-6 space-y-5">
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {knowledgeLevelDefinitions.map((definition) => (
                <div key={definition.level} className={`rounded-lg border p-4 ${definition.level === 5 ? "border-white/10 bg-white/[0.02] opacity-65" : "border-white/10 bg-white/[0.035]"}`}>
                  <div className="text-sm font-black text-red-300">{definition.label}</div>
                  <p className="mt-2 text-xs leading-5 text-zinc-500">{definition.explanation}</p>
                </div>
              ))}
            </div>
            <div className="overflow-hidden rounded-lg border border-white/10">
              {(data.profiles ?? []).map((profile) => {
                const definition = getKnowledgeLevelDefinition(profile.learning_level);
                const averageQuality = Number(profile.average_quality_score || profile.profile_json?.average_data_quality || 0);
                const readiness = profile.similarity_readiness || "no_data";
                return (
                  <div key={profile.id} className="grid gap-4 border-b border-white/10 px-4 py-5 last:border-0 lg:grid-cols-[minmax(0,1.3fr)_minmax(220px,1fr)_repeat(7,95px)] lg:items-center">
                    <div className="min-w-0"><div className="break-words font-black">{profile.ecu_type || profile.ecu_family || "Unknown ECU"}</div><div className="mt-1 break-all text-xs text-zinc-600">{profile.ecu_family || "-"} / SW {profile.sw_number || "-"}</div></div>
                    <div><div className="inline-flex rounded-md border border-red-700/40 bg-red-950/20 px-2 py-1 text-xs font-black text-red-200">{definition.label}</div><p className="mt-2 text-xs leading-5 text-zinc-500">{definition.explanation}</p></div>
                    <Small label="Learning samples" value={`${profile.approved_samples || 0} approved / ${profile.pending_samples || 0} pending / ${profile.excluded_samples || 0} excluded`} />
                    <Small label="Data quality" value={`${Math.round(averageQuality)}/100 avg.`} />
                    <Small label="Similarity" value={humanLabel(readiness)} />
                    <Small label="Clusters" value={`${profile.cluster_count || 0} total / ${profile.strong_cluster_count || 0} strong`} />
                    <Small label="Outliers" value={String(profile.outlier_count || 0)} />
                    <Small label="Pattern readiness" value={humanLabel(profile.pattern_clustering_readiness || "no_data")} />
                    <Small label="Detection" value={`${Math.round(Number(profile.detection_confidence) * 100)}%`} />
                  </div>
                );
              })}
              {!data.profiles.length && <Empty text="Knowledge profiles will appear after the first quality-scored sample." />}
            </div>
          </section>
        )}

        {view === "events" && (
          <section className="mt-6 space-y-2">
            {data.events.map((event) => (
              <div key={event.id} className="grid gap-2 rounded-lg border border-white/10 bg-white/[0.025] px-4 py-3 sm:grid-cols-[220px_1fr_160px] sm:items-center">
                <div className="font-black text-red-300">{event.event_type.replaceAll("_", " ")}</div>
                <div className="text-sm text-zinc-400">{event.message || "Recorded automatically."}</div>
                <div className="text-xs text-zinc-600 sm:text-right">{formatDate(event.created_at)}</div>
              </div>
            ))}
            {!data.events.length && <Empty text="No learning audit events yet." />}
          </section>
        )}
      </div>
    </main>
  );
}

function Metric({ icon, label, value, tone = "red" }: { icon: React.ReactNode; label: string; value: number; tone?: "red" | "green" | "amber" }) {
  const color = tone === "green" ? "text-emerald-400" : tone === "amber" ? "text-amber-400" : "text-red-400";
  return <div className="rounded-lg border border-white/10 bg-white/[0.025] p-4"><div className={color}>{icon}</div><div className="mt-5 text-3xl font-black">{value}</div><div className="mt-1 text-xs font-bold text-zinc-500">{label}</div></div>;
}

function ViewButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button onClick={onClick} className={`inline-flex h-10 items-center rounded-lg border px-4 text-sm font-black ${active ? "border-red-700 bg-red-950/25 text-white" : "border-white/10 text-zinc-500 hover:text-white"}`}><span className="mr-2 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>{label}</button>;
}

function Status({ value }: { value: HumanVerificationStatus }) {
  const classes = value === "confirmed" ? "border-emerald-700/40 bg-emerald-950/25 text-emerald-300" : value === "rejected" ? "border-red-700/40 bg-red-950/25 text-red-300" : value === "needs_review" ? "border-amber-700/40 bg-amber-950/25 text-amber-300" : "border-white/10 bg-white/[0.04] text-zinc-400";
  return <span className={`rounded-md border px-2 py-1 text-xs font-black uppercase ${classes}`}>{humanLabel(value)}</span>;
}

function LearningStatus({ value }: { value: LearningUseStatus }) {
  const classes = value === "approved_for_learning" ? "border-emerald-700/40 bg-emerald-950/25 text-emerald-300" : value === "excluded" ? "border-red-700/40 bg-red-950/25 text-red-300" : "border-amber-700/40 bg-amber-950/25 text-amber-300";
  return <span className={`rounded-md border px-2 py-1 text-xs font-black uppercase ${classes}`}>{humanLabel(value)}</span>;
}

function Small({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><div className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-600">{label}</div><div className="mt-1 break-words text-sm font-black text-zinc-200">{value}</div></div>;
}

function Empty({ text }: { text: string }) { return <div className="rounded-lg border border-dashed border-white/15 p-10 text-center text-sm text-zinc-500">{text}</div>; }
function humanLabel(value: string) { return value === "all" ? "All statuses" : value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatDate(value: string) { return new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }); }
function featureList(labels: TrainingServiceLabels | null) { const values = labels ? Object.entries(labels).filter(([, enabled]) => enabled).map(([key]) => key.replaceAll("_", " ").toUpperCase()) : []; return values.join(" / ") || "None"; }
