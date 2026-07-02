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
  Layers3,
  Loader2,
  PlayCircle,
  RefreshCcw,
  Search,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import type { AiEcuKnowledgeProfile, HumanVerificationStatus, TrainingServiceLabels } from "@/lib/ecuIntelligence/types";
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
  provider: string | null;
  revision_label: string | null;
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
  samples: SampleSummary[];
  profiles: AiEcuKnowledgeProfile[];
  events: EventSummary[];
  stats: {
    total: number;
    oriModPairs: number;
    confirmed: number;
    unverified: number;
    needsReview: number;
    rejected: number;
    profiles: number;
    level3Plus: number;
    featureCounts: Record<string, number>;
  };
};

const emptyPayload: Payload = {
  demoEnabled: false,
  samples: [],
  profiles: [],
  events: [],
  stats: { total: 0, oriModPairs: 0, confirmed: 0, unverified: 0, needsReview: 0, rejected: 0, profiles: 0, level3Plus: 0, featureCounts: {} },
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
      const response = await authFetch(`/api/admin/ai-training?status=${status}`);
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
  }, [authFetch, status]);

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
    const timeout = window.setTimeout(() => { void load(); }, 0);
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

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <Metric icon={<Database />} label="Training samples" value={data.stats.total} />
          <Metric icon={<FileCode2 />} label="ORI / MOD pairs" value={data.stats.oriModPairs} />
          <Metric icon={<CheckCircle2 />} label="Human confirmed" value={data.stats.confirmed} tone="green" />
          <Metric icon={<FileSearch />} label="Unverified" value={data.stats.unverified} tone="amber" />
          <Metric icon={<FileSearch />} label="Needs review" value={data.stats.needsReview} tone="amber" />
          <Metric icon={<ShieldAlert />} label="Rejected" value={data.stats.rejected} />
          <Metric icon={<Layers3 />} label="ECU profiles" value={data.stats.profiles} />
          <Metric icon={<Sparkles />} label="Level 3+" value={data.stats.level3Plus} tone="green" />
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
            <div className="mb-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
              <label className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search vehicle, ECU, HW/SW or request..." className="h-12 w-full rounded-lg border border-white/10 bg-white/[0.03] pl-11 pr-4 text-sm font-bold outline-none focus:border-red-700" />
              </label>
              <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="h-12 rounded-lg border border-white/10 bg-[#0a0a0a] px-4 text-sm font-black outline-none focus:border-red-700">
                {statusOptions.map((item) => <option key={item} value={item}>{humanLabel(item)}</option>)}
              </select>
            </div>

            <div className="space-y-3">
              {filteredSamples.map((sample) => (
                <Link key={sample.id} href={`/admin/ai-training/${sample.id}`} className="grid min-w-0 gap-4 rounded-lg border border-white/10 bg-white/[0.025] p-4 transition hover:border-red-800/60 hover:bg-white/[0.045] md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_160px_36px] md:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Status value={sample.human_verification_status} />
                      {sample.revision_label && <span className="rounded-md border border-white/10 px-2 py-1 text-xs font-bold text-zinc-400">{sample.revision_label}</span>}
                    </div>
                    <div className="mt-3 break-words text-lg font-black">{[sample.brand, sample.model, sample.engine].filter(Boolean).join(" ") || "Vehicle metadata pending"}</div>
                    <div className="mt-1 break-all text-xs text-zinc-600">Request {sample.request_id || (sample.source_metadata?.demo ? "demo fixture" : "manual")} / {formatDate(sample.created_at)}</div>
                  </div>
                  <div className="min-w-0 text-sm">
                    <div className="break-words font-black text-zinc-200">{sample.ecu_type || sample.ecu_family || "ECU not identified"}</div>
                    <div className="mt-1 break-all text-xs text-zinc-500">HW {sample.hw_number || "-"} / SW {sample.sw_number || "-"}</div>
                    <div className="mt-2 text-xs text-red-300">{featureList(sample.service_labels)}</div>
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
                const averageQuality = Number(profile.profile_json?.average_data_quality || 0);
                return (
                  <div key={profile.id} className="grid gap-4 border-b border-white/10 px-4 py-5 last:border-0 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,1fr)_repeat(3,110px)] lg:items-center">
                    <div className="min-w-0"><div className="break-words font-black">{profile.ecu_type || profile.ecu_family || "Unknown ECU"}</div><div className="mt-1 break-all text-xs text-zinc-600">{profile.ecu_family || "-"} / SW {profile.sw_number || "-"}</div></div>
                    <div><div className="inline-flex rounded-md border border-red-700/40 bg-red-950/20 px-2 py-1 text-xs font-black text-red-200">{definition.label}</div><p className="mt-2 text-xs leading-5 text-zinc-500">{definition.explanation}</p></div>
                    <Small label="Samples" value={`${profile.total_samples} total / ${profile.human_verified_samples} verified`} />
                    <Small label="Data quality" value={`${Math.round(averageQuality)}/100 avg.`} />
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

function Small({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><div className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-600">{label}</div><div className="mt-1 break-words text-sm font-black text-zinc-200">{value}</div></div>;
}

function Empty({ text }: { text: string }) { return <div className="rounded-lg border border-dashed border-white/15 p-10 text-center text-sm text-zinc-500">{text}</div>; }
function humanLabel(value: string) { return value === "all" ? "All statuses" : value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatDate(value: string) { return new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }); }
function featureList(labels: TrainingServiceLabels | null) { const values = labels ? Object.entries(labels).filter(([, enabled]) => enabled).map(([key]) => key.replaceAll("_", " ").toUpperCase()) : []; return values.join(" / ") || "No requested feature label"; }
