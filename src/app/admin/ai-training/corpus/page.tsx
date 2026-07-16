"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BrainCircuit,
  CheckCircle2,
  Database,
  FileCode2,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/authGuards";
import { trainingFeatureKeys, type TrainingServiceLabels } from "@/lib/ecuIntelligence/types";

type FileCandidate = {
  id: string;
  request_id: string | null;
  source_type: string;
  file_role_candidate: string;
  file_name: string | null;
  file_size: number | string | null;
  supplier: string | null;
  ecu_family: string | null;
  ecu_type: string | null;
  hw_number: string | null;
  sw_number: string | null;
  calibration_id: string | null;
  representation_type: string | null;
  read_method: string | null;
  identity_confidence: number | string | null;
  review_status: string;
  analysis_status: string;
  quality_score: number;
  stock_or_modified_guess: string;
  learning_authorization_status: string;
  created_at: string;
};

type PairCandidate = {
  id: string;
  request_id: string | null;
  pair_type: string;
  pair_confidence: number;
  requested_service_labels: TrainingServiceLabels | null;
  performed_service_labels: TrainingServiceLabels | null;
  dtc_codes: string[] | null;
  quality_score: number;
  review_status: string;
  learning_use_status: string;
  learning_authorization_status: string;
  learning_authorization_terms_version: string | null;
  linked_training_sample_id: string | null;
  created_at: string;
};

type CoveragePayload = {
  coverage: {
    uploads: number;
    exactIdentities: number;
    pairCandidates: number;
    singleServicePairs: number;
    multiServicePairs: number;
    approvedPairs: number;
    approvedTrainingSamples: number;
    serviceCoverage: Record<string, number>;
    stageCoverage: { stage1: number; stage2: number; dtc: number };
    missingEvidence: Array<{ feature: string; reason: string }>;
  };
  observability: {
    fileCandidateAttempts: number;
    fileCandidateSuccesses: number;
    fileCandidateFailures: number;
    fileCandidateDuplicateHits: number;
    pairCandidateAttempts: number;
    pairCandidateSuccesses: number;
    pairCandidateFailures: number;
    pairCandidateDuplicateHits: number;
    pendingReviewCount: number;
    authorizationNotGrantedCount: number;
    authorizationGrantedCount: number;
    approvalBlockedCount: number;
    backfillRecoveryCount: number;
    oldestPendingCandidate: string | null;
    ingestionEngineVersion: string;
    configuration: {
      fileCandidatesEnabled: boolean;
      pairCandidatesEnabled: boolean;
      approvalEnabled: boolean;
      backfillEnabled: boolean;
    };
  };
  files: FileCandidate[];
  pairs: PairCandidate[];
  events: Array<{ id: string; action: string; notes: string | null; created_at: string }>;
  safety: {
    createsTrainingSamplesAutomatically: boolean;
    requiresHumanVerification: boolean;
    requiresApprovedForLearning: boolean;
    firmwareGenerated: boolean;
  };
};

const emptyLabels = Object.fromEntries(trainingFeatureKeys.map((key) => [key, false])) as TrainingServiceLabels;

function activeLabels(labels: Partial<TrainingServiceLabels> | null | undefined) {
  return trainingFeatureKeys.filter((feature) => labels?.[feature]);
}

export default function LearningCorpusPage() {
  const [payload, setPayload] = useState<CoveragePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [backfillRunning, setBackfillRunning] = useState(false);
  const [selectedPair, setSelectedPair] = useState<PairCandidate | null>(null);
  const [performedLabels, setPerformedLabels] = useState<TrainingServiceLabels>(emptyLabels);
  const [reviewNotes, setReviewNotes] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await authenticatedFetch("/api/admin/ai/learning-corpus");
      const data = await response.json();
      if (response.status === 401) {
        window.location.href = "/login?redirect=/admin/ai-training/corpus";
        return;
      }
      if (!response.ok) throw new Error(data.error || "Learning corpus data could not be loaded.");
      setPayload(data as CoveragePayload);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Learning corpus data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(handle);
  }, [load]);

  const requestedCounts = useMemo(() => {
    const counts = Object.fromEntries(trainingFeatureKeys.map((key) => [key, 0])) as Record<string, number>;
    for (const pair of payload?.pairs ?? []) {
      for (const label of activeLabels(pair.requested_service_labels)) counts[label] += 1;
    }
    return counts;
  }, [payload?.pairs]);

  async function runBackfill(dryRun: boolean) {
    setBackfillRunning(true);
    setMessage("");
    try {
      const response = await authenticatedFetch("/api/admin/ai/learning-corpus/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun, limit: 25 }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Backfill failed.");
      setMessage(`${data.message} Inspected ${data.inspected}, created ${data.created}, skipped ${data.skipped}.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Backfill failed.");
    } finally {
      setBackfillRunning(false);
    }
  }

  async function updatePair(action: "human_verified" | "quarantine" | "approve_learning") {
    if (!selectedPair) return;
    setMessage("");
    const body: Record<string, unknown> = {
      adminNotes: reviewNotes || null,
      performedServiceLabels: performedLabels,
    };
    if (action === "human_verified") body.reviewStatus = "human_verified";
    if (action === "quarantine") {
      body.reviewStatus = "quarantined";
      body.learningUseStatus = "excluded";
      body.markUnrelatedChanges = true;
    }
    if (action === "approve_learning") {
      body.reviewStatus = "approved";
      body.learningUseStatus = "approved_for_learning";
    }
    const response = await authenticatedFetch(`/api/admin/ai/learning-corpus/pairs/${selectedPair.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "Pair review update failed.");
      return;
    }
    setMessage("Pair review updated. Trusted learning remains gated.");
    setSelectedPair(null);
    setPerformedLabels(emptyLabels);
    setReviewNotes("");
    await load();
  }

  return (
    <main className="mg-compact-ui min-h-screen bg-[#050505] text-white">
      <header className="border-b border-white/10 bg-black/80">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/admin/ai-training" className="inline-flex items-center text-sm font-bold text-zinc-500 hover:text-white">
              <ArrowLeft className="mr-2 h-4 w-4" /> Learning control room
            </Link>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-red-800/50 bg-red-950/25 text-red-400">
                <BrainCircuit className="h-6 w-6" />
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-red-500">Learning flywheel</div>
                <h1 className="text-2xl font-black sm:text-3xl">Customer job to learning corpus</h1>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => void runBackfill(true)} disabled={backfillRunning} className="inline-flex h-11 items-center justify-center rounded-lg border border-white/10 px-4 text-sm font-black hover:bg-white/5 disabled:opacity-50">
              {backfillRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
              Backfill dry-run
            </button>
            <button onClick={() => void runBackfill(false)} disabled={backfillRunning || payload?.observability.configuration.backfillEnabled === false} className="inline-flex h-11 items-center justify-center rounded-lg bg-[#b1121b] px-4 text-sm font-black hover:bg-[#c91824] disabled:opacity-50">
              Create candidates
            </button>
            <button onClick={() => void load()} disabled={loading} className="inline-flex h-11 items-center justify-center rounded-lg border border-white/10 px-4 text-sm font-black hover:bg-white/5 disabled:opacity-50">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-4 py-7">
        <div className="mb-6 border-l-2 border-emerald-400 bg-emerald-950/15 px-4 py-3 text-sm leading-6 text-emerald-100/80">
          Review-first metadata pipeline. Customer uploads and completed outputs create candidates only. No firmware generation, no automatic approved training sample, and no customer-visible learning metadata.
        </div>
        {message && <div className="mb-6 rounded-lg border border-red-800/40 bg-red-950/20 p-4 text-sm text-red-100">{message}</div>}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <Metric icon={<FileCode2 />} label="Uploads" value={payload?.coverage.uploads ?? 0} />
          <Metric icon={<Database />} label="Exact identities" value={payload?.coverage.exactIdentities ?? 0} />
          <Metric icon={<Sparkles />} label="Pair candidates" value={payload?.coverage.pairCandidates ?? 0} />
          <Metric icon={<CheckCircle2 />} label="Single-service" value={payload?.coverage.singleServicePairs ?? 0} tone="green" />
          <Metric icon={<FileCode2 />} label="Multi-service" value={payload?.coverage.multiServicePairs ?? 0} />
          <Metric icon={<ShieldCheck />} label="Approved pairs" value={payload?.coverage.approvedPairs ?? 0} tone="green" />
          <Metric icon={<Sparkles />} label="Stage 1 evidence" value={payload?.coverage.stageCoverage.stage1 ?? 0} />
          <Metric icon={<Sparkles />} label="DTC evidence" value={payload?.coverage.stageCoverage.dtc ?? 0} />
        </section>

        {payload?.observability && (
          <section className="mt-6 border-y border-white/10 py-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">Ingestion observability</h2>
                <p className="mt-1 font-mono text-xs text-zinc-500">{payload.observability.ingestionEngineVersion}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-bold text-zinc-400">
                <span>File {String(payload.observability.configuration.fileCandidatesEnabled)}</span>
                <span>Pair {String(payload.observability.configuration.pairCandidatesEnabled)}</span>
                <span>Approval {String(payload.observability.configuration.approvalEnabled)}</span>
                <span>Backfill {String(payload.observability.configuration.backfillEnabled)}</span>
              </div>
            </div>
            <dl className="mt-4 grid gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
              <Observation label="File attempts" value={payload.observability.fileCandidateAttempts} />
              <Observation label="File successes" value={payload.observability.fileCandidateSuccesses} />
              <Observation label="File failures" value={payload.observability.fileCandidateFailures} />
              <Observation label="File duplicates" value={payload.observability.fileCandidateDuplicateHits} />
              <Observation label="Pair attempts" value={payload.observability.pairCandidateAttempts} />
              <Observation label="Pair successes" value={payload.observability.pairCandidateSuccesses} />
              <Observation label="Pair failures" value={payload.observability.pairCandidateFailures} />
              <Observation label="Pair duplicates" value={payload.observability.pairCandidateDuplicateHits} />
              <Observation label="Pending review" value={payload.observability.pendingReviewCount} />
              <Observation label="Not granted" value={payload.observability.authorizationNotGrantedCount} />
              <Observation label="Granted" value={payload.observability.authorizationGrantedCount} />
              <Observation label="Approval blocked" value={payload.observability.approvalBlockedCount} />
              <Observation label="Recovered" value={payload.observability.backfillRecoveryCount} />
              <Observation label="Oldest pending" value={payload.observability.oldestPendingCandidate ? new Date(payload.observability.oldestPendingCandidate).toLocaleString() : "None"} />
            </dl>
          </section>
        )}

        <section className="mt-6 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-lg border border-white/10 bg-white/[0.025] p-4">
            <h2 className="text-lg font-black">Service coverage</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {trainingFeatureKeys.map((feature) => (
                <div key={feature} className="rounded-lg border border-white/10 bg-black/30 p-3">
                  <div className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">{feature.replaceAll("_", " ")}</div>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <div className="text-2xl font-black">{requestedCounts[feature] ?? 0}</div>
                    <div className="text-xs text-zinc-500">candidate labels</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.025] p-4">
            <h2 className="text-lg font-black">Missing evidence</h2>
            <div className="mt-4 space-y-2">
              {(payload?.coverage.missingEvidence ?? []).slice(0, 12).map((item) => (
                <div key={item.feature} className="rounded-lg border border-amber-700/30 bg-amber-950/15 p-3 text-sm text-amber-100">
                  <strong>{item.feature.replaceAll("_", " ")}</strong>: {item.reason}
                </div>
              ))}
              {payload && payload.coverage.missingEvidence.length === 0 && (
                <div className="rounded-lg border border-emerald-700/30 bg-emerald-950/15 p-3 text-sm text-emerald-100">
                  Every known service label has at least some approved cluster evidence.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-white/10 bg-white/[0.025] p-4">
          <h2 className="text-lg font-black">ORI/MOD pair candidates</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                <tr>
                  <th className="p-3">Request</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Labels</th>
                  <th className="p-3">Quality</th>
                  <th className="p-3">Review</th>
                  <th className="p-3">Learning</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {(payload?.pairs ?? []).map((pair) => (
                  <tr key={pair.id} className="border-t border-white/10">
                    <td className="p-3 font-mono text-xs text-zinc-400">{pair.request_id ?? "-"}</td>
                    <td className="p-3">{pair.pair_type.replaceAll("_", " ")}</td>
                    <td className="p-3">{activeLabels(pair.requested_service_labels).join(", ") || "none"}</td>
                    <td className="p-3">{pair.quality_score}/100</td>
                    <td className="p-3"><Badge value={pair.review_status} /></td>
                    <td className="p-3"><Badge value={pair.learning_use_status} tone={pair.learning_use_status === "approved_for_learning" ? "green" : "amber"} /></td>
                    <td className="p-3">
                      <button onClick={() => {
                        setSelectedPair(pair);
                        setPerformedLabels(pair.performed_service_labels || pair.requested_service_labels || emptyLabels);
                      }} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-black hover:bg-white/5">
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {payload && !payload.pairs.length && <div className="p-6 text-sm text-zinc-500">No pair candidates yet.</div>}
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-white/10 bg-white/[0.025] p-4">
          <h2 className="text-lg font-black">Recent upload candidates</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(payload?.files ?? []).slice(0, 18).map((file) => (
              <div key={file.id} className="rounded-lg border border-white/10 bg-black/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 truncate font-black">{file.file_name || "file"}</div>
                  <Badge value={file.file_role_candidate} />
                </div>
                <div className="mt-3 text-xs leading-5 text-zinc-500">
                  {[file.supplier, file.ecu_family, file.ecu_type, file.sw_number].filter(Boolean).join(" / ") || "Identity pending"}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge value={file.analysis_status} tone={file.analysis_status === "enriched" ? "green" : "amber"} />
                  <Badge value={`${file.quality_score}/100`} />
                  <Badge value={file.learning_authorization_status} tone="amber" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {selectedPair && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-3xl rounded-xl border border-white/10 bg-[#0b0b0d] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-red-400">Pair review</div>
                <h3 className="mt-1 text-xl font-black">{selectedPair.pair_type.replaceAll("_", " ")}</h3>
              </div>
              <button onClick={() => setSelectedPair(null)} className="rounded-lg border border-white/10 px-3 py-2 text-sm font-black">Close</button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {trainingFeatureKeys.map((feature) => (
                <label key={feature} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/30 p-3 text-sm">
                  <span className="font-bold">{feature.replaceAll("_", " ")}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(performedLabels[feature])}
                    onChange={(event) => setPerformedLabels((current) => ({ ...current, [feature]: event.target.checked }))}
                  />
                </label>
              ))}
            </div>
            <label className="mt-4 block">
              <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Admin notes</div>
              <textarea value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} className="h-24 w-full rounded-lg border border-white/10 bg-black/40 p-3 text-sm outline-none focus:border-red-700" />
            </label>
            <div className="mt-4 border-l-2 border-amber-600 px-3 text-sm text-amber-100">
              Authorization: {selectedPair.learning_authorization_status}
              {selectedPair.learning_authorization_terms_version ? ` (${selectedPair.learning_authorization_terms_version})` : ""}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button onClick={() => void updatePair("human_verified")} className="rounded-lg border border-white/10 px-4 py-3 text-sm font-black hover:bg-white/5">Mark human verified</button>
              <button onClick={() => void updatePair("approve_learning")} className="rounded-lg bg-[#b1121b] px-4 py-3 text-sm font-black hover:bg-[#c91824]">Approve for learning</button>
              <button onClick={() => void updatePair("quarantine")} className="rounded-lg border border-amber-700/50 bg-amber-950/20 px-4 py-3 text-sm font-black text-amber-100">Quarantine</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Metric({ icon, label, value, tone = "default" }: { icon: ReactNode; label: string; value: number | string; tone?: "default" | "green" | "amber" }) {
  const color = tone === "green" ? "text-emerald-300" : tone === "amber" ? "text-amber-300" : "text-white";
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.025] p-4">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-red-900/40 bg-red-950/25 text-red-400">{icon}</div>
      <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">{label}</div>
      <div className={`mt-2 text-2xl font-black ${color}`}>{value}</div>
    </div>
  );
}

function Observation({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-bold text-zinc-500">{label}</dt>
      <dd className="mt-1 break-words text-sm font-black text-zinc-100">{value}</dd>
    </div>
  );
}

function Badge({ value, tone = "default" }: { value: string; tone?: "default" | "green" | "amber" }) {
  const cls = tone === "green"
    ? "border-emerald-700/40 bg-emerald-950/25 text-emerald-200"
    : tone === "amber"
      ? "border-amber-700/40 bg-amber-950/25 text-amber-200"
      : "border-white/10 bg-white/[0.04] text-zinc-200";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${cls}`}>{value.replaceAll("_", " ")}</span>;
}
