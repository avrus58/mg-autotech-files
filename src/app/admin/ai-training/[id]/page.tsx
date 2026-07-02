"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Database, FileCode2, Gauge, Loader2, Save, ShieldAlert } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import {
  emptyTrainingServiceLabels,
  trainingFeatureKeys,
  type AiTrainingSample,
  type HumanVerificationStatus,
  type LearningUseStatus,
  type TrainingSourceType,
  type TrainingSafetyRating,
  type TrainingServiceLabels,
} from "@/lib/ecuIntelligence/types";

type DetailPayload = {
  sample: AiTrainingSample;
  events: Array<{ id: string; event_type: string; message: string | null; created_at: string }>;
  signatures: Array<{ id: string; feature_type: string; confidence: number | string; human_confirmed: boolean }>;
  modelRuns: Array<{ id: string; provider: string; model_name: string | null; latency_ms: number | null; error_message: string | null; created_at: string }>;
};

const outcomes = ["unknown", "customer_ok", "issue_reported", "limp", "smoke", "knock", "dyno_confirmed", "needs_revision"];
const safetyRatings: TrainingSafetyRating[] = ["unknown", "safe", "aggressive", "risky", "bad"];
const changeTypes = ["identical", "focused_calibration", "distributed_calibration", "broad_rework", "structural_mismatch", "single_file", "unknown"] as const;
const sourceTypes: TrainingSourceType[] = ["completed_request", "demo_fixture", "manual_capture", "file_expert"];

export default function AiTrainingDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [data, setData] = useState<DetailPayload | null>(null);
  const [status, setStatus] = useState<HumanVerificationStatus>("unverified");
  const [aiCorrect, setAiCorrect] = useState<"unknown" | "yes" | "no">("unknown");
  const [requestedLabels, setRequestedLabels] = useState<TrainingServiceLabels>(emptyTrainingServiceLabels());
  const [performedLabels, setPerformedLabels] = useState<TrainingServiceLabels>(emptyTrainingServiceLabels());
  const [learningUseStatus, setLearningUseStatus] = useState<LearningUseStatus>("pending");
  const [changeType, setChangeType] = useState<(typeof changeTypes)[number]>("unknown");
  const [revisionNumber, setRevisionNumber] = useState(1);
  const [provider, setProvider] = useState("internal");
  const [sourceType, setSourceType] = useState<TrainingSourceType>("manual_capture");
  const [quality, setQuality] = useState<number | null>(null);
  const [safety, setSafety] = useState<TrainingSafetyRating>("unknown");
  const [outcome, setOutcome] = useState("unknown");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const authFetch = useCallback(async (url: string, init?: RequestInit) => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) throw new Error("Unauthorized");
    return fetch(url, { ...init, headers: { ...init?.headers, Authorization: `Bearer ${token}` } });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await authFetch(`/api/admin/ai-training/${id}`);
      const payload = await response.json();
      if (response.status === 401) { window.location.href = `/login?redirect=/admin/ai-training/${id}`; return; }
      if (response.status === 403) throw new Error("Access denied. Your staff role cannot review ECU learning data.");
      if (!response.ok) throw new Error(payload.error || "Training sample could not be loaded.");
      const next = payload as DetailPayload;
      setData(next);
      setStatus(next.sample.human_verification_status);
      setAiCorrect(next.sample.auto_labels_correct === true ? "yes" : next.sample.auto_labels_correct === false ? "no" : "unknown");
      setRequestedLabels({ ...emptyTrainingServiceLabels(), ...(next.sample.requested_service_labels || next.sample.service_labels || {}) });
      setPerformedLabels({ ...emptyTrainingServiceLabels(), ...(next.sample.performed_service_labels || {}) });
      setLearningUseStatus(next.sample.learning_use_status || "pending");
      setChangeType(next.sample.change_type_classification || next.sample.diff_json?.change_profile?.classification || "unknown");
      setRevisionNumber(Math.max(1, Number(next.sample.revision_number || 1)));
      setProvider(next.sample.provider || "internal");
      setSourceType(next.sample.source_type || "manual_capture");
      setQuality(next.sample.quality_rating);
      setSafety(next.sample.safety_rating || "unknown");
      setOutcome(next.sample.outcome || "unknown");
      setNotes(next.sample.admin_notes || "");
    } catch (error) {
      if (error instanceof Error && error.message === "Unauthorized") {
        window.location.href = `/login?redirect=/admin/ai-training/${id}`;
        return;
      }
      setMessage(error instanceof Error ? error.message : "Training sample could not be loaded.");
    }
    finally { setLoading(false); }
  }, [authFetch, id]);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const analyzer = data?.sample.diff_json;
  const changed = analyzer?.comparison;
  const identity = analyzer?.ecu_identification;
  const activeRequestedFeatures = useMemo(() => trainingFeatureKeys.filter((key) => requestedLabels[key]), [requestedLabels]);
  const activePerformedFeatures = useMemo(() => trainingFeatureKeys.filter((key) => performedLabels[key]), [performedLabels]);

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const response = await authFetch(`/api/admin/ai-training/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          aiCorrect: aiCorrect === "unknown" ? null : aiCorrect === "yes",
          requestedServiceLabels: requestedLabels,
          performedServiceLabels: performedLabels,
          learningUseStatus,
          changeTypeClassification: changeType,
          revisionNumber,
          provider,
          sourceType,
          qualityRating: quality,
          safetyRating: safety,
          outcome,
          adminNotes: notes,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Verification could not be saved.");
      setMessage("Human verification saved and the ECU knowledge profile was recalculated.");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Verification could not be saved."); }
    finally { setSaving(false); }
  }

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-[#050505] text-white"><Loader2 className="mr-3 h-5 w-5 animate-spin text-red-500" />Loading training sample...</main>;
  if (!data) return <main className="min-h-screen bg-[#050505] p-8 text-white"><Link href="/admin/ai-training">Back</Link><div className="mt-8 text-red-300">{message || "Training sample not found."}</div></main>;

  const sample = data.sample;
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#050505] text-white">
      <header className="border-b border-white/10 bg-black/80">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0"><Link href="/admin/ai-training" className="text-sm font-bold text-zinc-500 hover:text-white"><ArrowLeft className="mr-2 inline h-4 w-4" />Learning control room</Link><h1 className="mt-3 break-words text-2xl font-black sm:text-3xl">{[sample.brand, sample.model, sample.engine].filter(Boolean).join(" ") || "Training sample"}</h1><div className="mt-1 break-all text-xs text-zinc-600">#{sample.id}</div></div>
          <button onClick={() => void save()} disabled={saving} className="inline-flex h-12 items-center justify-center rounded-lg bg-[#b1121b] px-5 text-sm font-black hover:bg-[#c91824] disabled:opacity-50">{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save verification</button>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-6 px-4 py-7 xl:grid-cols-[minmax(0,1.2fr)_420px]">
        <div className="min-w-0 space-y-6">
          {message && <div className="rounded-lg border border-red-800/40 bg-red-950/20 p-4 text-sm text-red-100">{message}</div>}
          <section className="rounded-lg border border-white/10 bg-white/[0.025] p-5">
            <div className="flex items-center gap-3"><Database className="h-6 w-6 text-red-400" /><div><div className="text-xs font-black uppercase tracking-[0.18em] text-red-400">Binary identity</div><h2 className="text-xl font-black">{identity?.display_name || sample.ecu_type || "ECU not identified"}</h2></div></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Info label="Family" value={sample.ecu_family || identity?.family} /><Info label="Hardware" value={sample.hw_number || identity?.hardware_numbers[0]} /><Info label="Software" value={sample.sw_number || identity?.software_numbers[0]} /><Info label="Read method" value={sample.read_method} /></div>
          </section>

          <section className="rounded-lg border border-white/10 bg-white/[0.025] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3"><Gauge className="h-6 w-6 text-red-400" /><div><div className="text-xs font-black uppercase tracking-[0.18em] text-red-400">Learning evidence</div><h2 className="text-xl font-black">Data quality</h2></div></div>
              <div className="text-3xl font-black text-white">{Math.round(Number(sample.data_quality_score || 0))}<span className="text-sm text-zinc-500"> / 100</span></div>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {(sample.data_quality_reasons || []).map((reason) => (
                <div key={reason.code} className={`rounded-lg border px-3 py-3 text-xs leading-5 ${reason.impact < 0 ? "border-red-800/30 bg-red-950/10 text-red-200/80" : reason.impact > 0 ? "border-emerald-800/30 bg-emerald-950/10 text-emerald-100/75" : "border-white/10 text-zinc-500"}`}>
                  <div className="font-black">{reason.impact > 0 ? `+${reason.impact}` : reason.impact} points</div>
                  <div>{reason.message}</div>
                </div>
              ))}
              {!sample.data_quality_reasons?.length && <div className="text-sm text-zinc-500">Quality reasons will appear after the hardening migration and recalculation.</div>}
            </div>
          </section>

          <section className="rounded-lg border border-white/10 bg-white/[0.025] p-5">
            <div className="flex items-center gap-3"><FileCode2 className="h-6 w-6 text-red-400" /><h2 className="text-xl font-black">ORI / MOD evidence</h2></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2"><FileInfo label="Original" name={sample.ori_file_name} hash={sample.ori_sha256} size={sample.ori_file_size} /><FileInfo label="Modified" name={sample.mod_file_name} hash={sample.mod_sha256} size={sample.mod_file_size} /></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-4"><Info label="Changed bytes" value={changed?.changed_bytes?.toLocaleString()} /><Info label="Changed area" value={changed ? `${changed.changed_percent.toFixed(4)}%` : null} /><Info label="Grouped regions" value={changed?.merged_changed_blocks?.toString()} /><Info label="Map candidates" value={analyzer?.map_candidates.length.toString()} /></div>
            <div className="mt-3 grid gap-3 sm:grid-cols-4"><Info label="Change type" value={sample.change_type_classification} /><Info label="Revision" value={`#${sample.revision_number || 1} ${sample.revision_label || ""}`.trim()} /><Info label="Provider" value={sample.provider} /><Info label="Source" value={sample.source_type} /></div>
          </section>

          <section className="rounded-lg border border-white/10 bg-white/[0.025] p-5">
            <h2 className="text-xl font-black">Analyzer findings</h2>
            <div className="mt-4 space-y-3">{(analyzer?.findings || []).map((finding) => <div key={finding.id} className="border-l-2 border-red-700 bg-black/25 px-4 py-3"><div className="font-black">{finding.title}</div><p className="mt-1 text-sm leading-6 text-zinc-400">{finding.summary}</p><div className="mt-2 text-xs text-zinc-600">Confidence {Math.round(finding.confidence * 100)}%</div></div>)}{!analyzer?.findings?.length && <div className="text-sm text-zinc-500">No structured findings are available.</div>}</div>
          </section>

          <details className="rounded-lg border border-white/10 bg-white/[0.025] p-5"><summary className="cursor-pointer font-black">Analyzer JSON and pattern signature</summary><pre className="mt-4 max-h-[620px] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/50 p-4 text-xs leading-5 text-zinc-400">{JSON.stringify({ analyzer, pattern_signature: sample.pattern_signature }, null, 2)}</pre></details>
        </div>

        <aside className="min-w-0 space-y-6 xl:sticky xl:top-6 xl:h-fit">
          <section className="rounded-lg border border-red-900/50 bg-red-950/10 p-5">
            <div className="flex items-center gap-3"><CheckCircle2 className="h-6 w-6 text-emerald-400" /><div><div className="text-xs font-black uppercase tracking-[0.18em] text-red-400">Human gate</div><h2 className="text-xl font-black">Training data integrity</h2></div></div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <label className="text-xs font-black uppercase text-zinc-500">Review decision<select value={status} onChange={(event) => setStatus(event.target.value as HumanVerificationStatus)} className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/50 px-3 text-sm text-white">{["unverified", "needs_review", "confirmed", "rejected"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
              <label className="text-xs font-black uppercase text-zinc-500">Learning use<select value={learningUseStatus} onChange={(event) => setLearningUseStatus(event.target.value as LearningUseStatus)} className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/50 px-3 text-sm text-white"><option value="pending">Pending</option><option value="approved_for_learning">Approved for learning</option><option value="excluded">Excluded</option></select></label>
            </div>
            <label className="mt-4 block text-xs font-black uppercase tracking-[0.12em] text-zinc-500">Automatic labels correct?<select value={aiCorrect} onChange={(event) => setAiCorrect(event.target.value as "unknown" | "yes" | "no")} className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/50 px-3 text-sm font-black text-white"><option value="unknown">Not reviewed</option><option value="yes">Yes</option><option value="no">No, corrected below</option></select></label>

            <FeatureEditor title="Requested services" subtitle="What the customer asked for" labels={requestedLabels} setLabels={setRequestedLabels} tone="amber" />
            <div className="mt-2 text-xs text-zinc-500">Requested: {activeRequestedFeatures.length}</div>
            <FeatureEditor title="Actual performed services" subtitle="What is truly present in this MOD" labels={performedLabels} setLabels={setPerformedLabels} tone="green" />
            <div className="mt-2 text-xs text-zinc-500">Performed: {activePerformedFeatures.length}</div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <label className="text-xs font-black uppercase text-zinc-500">Change type<select value={changeType} onChange={(event) => setChangeType(event.target.value as typeof changeType)} className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/50 px-3 text-sm text-white">{changeTypes.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label className="text-xs font-black uppercase text-zinc-500">Revision number<input type="number" min={1} value={revisionNumber} onChange={(event) => setRevisionNumber(Math.max(1, Number(event.target.value) || 1))} className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/50 px-3 text-sm text-white" /></label>
              <label className="text-xs font-black uppercase text-zinc-500">Provider<input value={provider} onChange={(event) => setProvider(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/50 px-3 text-sm normal-case text-white" /></label>
              <label className="text-xs font-black uppercase text-zinc-500">Source<select value={sourceType} onChange={(event) => setSourceType(event.target.value as TrainingSourceType)} className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/50 px-3 text-sm text-white">{sourceTypes.map((value) => <option key={value}>{value}</option>)}</select></label>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3"><label className="text-xs font-black uppercase text-zinc-500">Quality<select value={quality || ""} onChange={(event) => setQuality(event.target.value ? Number(event.target.value) : null)} className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/50 px-3 text-sm text-white"><option value="">Not rated</option>{[1,2,3,4,5].map((value) => <option key={value} value={value}>{value}/5</option>)}</select></label><label className="text-xs font-black uppercase text-zinc-500">Safety<select value={safety} onChange={(event) => setSafety(event.target.value as TrainingSafetyRating)} className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/50 px-3 text-sm text-white">{safetyRatings.map((value) => <option key={value}>{value}</option>)}</select></label></div>
            <label className="mt-4 block text-xs font-black uppercase text-zinc-500">Outcome<select value={outcome} onChange={(event) => setOutcome(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/50 px-3 text-sm text-white">{outcomes.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label className="mt-4 block text-xs font-black uppercase text-zinc-500">Admin notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-2 min-h-28 w-full resize-none rounded-lg border border-white/10 bg-black/50 p-3 text-sm normal-case text-white outline-none focus:border-red-700" placeholder="Evidence, correction reason, outcome or revision context..." /></label>
          </section>

          <section className="rounded-lg border border-amber-700/30 bg-amber-950/10 p-5 text-sm leading-6 text-amber-100/75"><ShieldAlert className="mb-3 h-6 w-6 text-amber-400" />Only records marked <strong>confirmed</strong> and <strong>approved for learning</strong> influence ECU knowledge. Requested services alone are never treated as proof of performed work. This does not approve a file for flashing.</section>

          <section className="rounded-lg border border-white/10 bg-white/[0.025] p-5"><h2 className="font-black">Event timeline</h2><div className="mt-4 space-y-4">{data.events.map((event) => <div key={event.id} className="relative border-l border-white/15 pb-1 pl-4"><span className="absolute -left-1.5 top-1 h-3 w-3 rounded-full border border-red-500 bg-[#090909]" /><div className="text-xs font-black uppercase text-red-300">{event.event_type.replaceAll("_", " ")}</div><div className="mt-1 text-xs leading-5 text-zinc-500">{event.message || "Recorded automatically."}</div><div className="mt-1 text-[10px] text-zinc-700">{formatDate(event.created_at)}</div></div>)}{!data.events.length && <div className="text-xs text-zinc-600">No audit events recorded.</div>}</div></section>
        </aside>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) { return <div className="min-w-0 rounded-lg border border-white/10 bg-black/30 p-3"><div className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-600">{label}</div><div className="mt-1 break-all text-sm font-black">{value || "-"}</div></div>; }
function FileInfo({ label, name, hash, size }: { label: string; name: string | null; hash: string | null; size: string | number | null }) { return <div className="min-w-0 rounded-lg border border-white/10 bg-black/30 p-4"><div className="text-xs font-black uppercase text-red-400">{label}</div><div className="mt-2 break-all font-black">{name || "-"}</div><div className="mt-2 break-all text-xs text-zinc-600">SHA256 {hash || "-"}</div><div className="mt-1 text-xs text-zinc-600">{size ? `${Number(size).toLocaleString()} bytes` : "Size unknown"}</div></div>; }
function FeatureEditor({ title, subtitle, labels, setLabels, tone }: { title: string; subtitle: string; labels: TrainingServiceLabels; setLabels: React.Dispatch<React.SetStateAction<TrainingServiceLabels>>; tone: "amber" | "green" }) {
  return <div className="mt-5 rounded-lg border border-white/10 bg-black/25 p-3"><div className="font-black">{title}</div><div className="mt-1 text-xs text-zinc-500">{subtitle}</div><div className="mt-3 grid grid-cols-2 gap-2">{trainingFeatureKeys.map((feature) => { const active = labels[feature]; const activeClass = tone === "green" ? "border-emerald-700/50 bg-emerald-950/20 text-emerald-200" : "border-amber-700/50 bg-amber-950/20 text-amber-200"; return <label key={feature} className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 text-xs font-black uppercase ${active ? activeClass : "border-white/10 text-zinc-500"}`}><span>{feature.replaceAll("_", " ")}</span><input type="checkbox" checked={active} onChange={(event) => setLabels((current) => ({ ...current, [feature]: event.target.checked }))} className="h-4 w-4 accent-emerald-500" /></label>; })}</div></div>;
}
function formatDate(value: string) { return new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }); }
