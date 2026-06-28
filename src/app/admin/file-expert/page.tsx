"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BrainCircuit,
  CheckCircle2,
  Database,
  FileCode2,
  Loader2,
  RefreshCcw,
  Save,
  Search,
  ShieldAlert,
  SlidersHorizontal,
} from "lucide-react";
import { signOutIfEmailUnverified } from "@/lib/authGuards";
import { getFileExpertAuthHeaders } from "@/lib/fileExpert/client";
import { supabase } from "@/lib/supabaseClient";
import type { FileExpertFeature, FileExpertJob } from "@/lib/fileExpert/types";
import { fileExpertFeatureLabels } from "@/lib/fileExpert/types";

type Feedback = {
  id: string;
  actual_features: Partial<Record<FileExpertFeature, boolean>> | null;
  ai_correct: boolean | null;
  quality_rating: number | null;
  safety_rating: string | null;
  admin_notes: string | null;
  created_at: string;
};

const featureKeys = Object.keys(fileExpertFeatureLabels) as FileExpertFeature[];
const statusFilters = ["all", "pending", "processing", "completed", "failed"];

function statusClass(status: string) {
  if (status === "completed") return "border-emerald-700/40 bg-emerald-950/30 text-emerald-300";
  if (status === "processing") return "border-blue-700/40 bg-blue-950/30 text-blue-300";
  if (status === "failed") return "border-red-700/40 bg-red-950/30 text-red-300";
  return "border-amber-700/40 bg-amber-950/30 text-amber-300";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function shortHash(value: string | null) {
  if (!value) return "-";
  return `${value.slice(0, 10)}...`;
}

export default function AdminFileExpertPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<FileExpertJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<FileExpertJob | null>(null);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [featureFilter, setFeatureFilter] = useState<FileExpertFeature | "all">("all");
  const [actualFeatures, setActualFeatures] = useState<Partial<Record<FileExpertFeature, boolean>>>({});
  const [aiCorrect, setAiCorrect] = useState("unknown");
  const [qualityRating, setQualityRating] = useState("5");
  const [safetyRating, setSafetyRating] = useState("unknown");
  const [adminNotes, setAdminNotes] = useState("");

  async function loadJobs(options?: { silent?: boolean }) {
    if (!options?.silent) setLoading(true);
    setMessage("");

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.push("/login");
      return;
    }

    if (await signOutIfEmailUnverified(userData.user)) {
      router.push("/login?verify_email=1");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single();

    if (profile?.role !== "admin") {
      setMessage("Admin access required.");
      setLoading(false);
      return;
    }

    const headers = await getFileExpertAuthHeaders();
    const response = await fetch("/api/file-expert/jobs?all=1", {
      cache: "no-store",
      headers,
    });
    const payload = await response.json();

    if (!response.ok) {
      setMessage(payload.error || "File Expert jobs could not be loaded.");
      setLoading(false);
      return;
    }

    const nextJobs = (payload.jobs ?? []) as FileExpertJob[];
    setJobs(nextJobs);
    setSelectedJob((current) => {
      if (!current) return nextJobs[0] ?? null;
      return nextJobs.find((job) => job.id === current.id) ?? current;
    });
    setLoading(false);

    if (!selectedJob && nextJobs[0]) {
      await openJob(nextJobs[0], { silent: true });
    }
  }

  async function openJob(job: FileExpertJob, options?: { silent?: boolean }) {
    if (!options?.silent) setMessage("");
    setSelectedJob(job);
    const headers = await getFileExpertAuthHeaders();
    const response = await fetch(`/api/file-expert/jobs/${job.id}`, {
      cache: "no-store",
      headers,
    });
    const payload = await response.json();

    if (!response.ok) {
      setMessage(payload.error || "File Expert job could not be opened.");
      return;
    }

    const detailJob = payload.job as FileExpertJob;
    setSelectedJob(detailJob);
    setFeedback(payload.feedback ?? []);
    setActualFeatures({});
    setAiCorrect("unknown");
    setQualityRating("5");
    setSafetyRating(detailJob.risk_level || "unknown");
    setAdminNotes("");
  }

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadJobs();
    }, 0);
    return () => window.clearTimeout(initialLoad);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredJobs = useMemo(() => {
    const term = search.trim().toLowerCase();
    return jobs.filter((job) => {
      if (statusFilter !== "all" && job.status !== statusFilter) return false;
      if (
        featureFilter !== "all" &&
        !job.detected_features?.some((feature) => feature.feature === featureFilter)
      ) {
        return false;
      }
      if (!term) return true;
      const text = [
        job.id,
        job.brand,
        job.model,
        job.engine,
        job.ecu_type,
        job.ori_file_name,
        job.mod_file_name,
        job.customer_notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return text.includes(term);
    });
  }, [jobs, search, statusFilter, featureFilter]);
  const selectedIdentity = selectedJob?.result_json?.ecu_identification;

  async function saveFeedback() {
    if (!selectedJob) return;
    setSaving(true);
    setMessage("");

    const response = await fetch(`/api/admin/file-expert/jobs/${selectedJob.id}/feedback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await getFileExpertAuthHeaders()),
      },
      body: JSON.stringify({
        actualFeatures,
        aiCorrect: aiCorrect === "yes" ? true : aiCorrect === "no" ? false : null,
        qualityRating: qualityRating ? Number(qualityRating) : null,
        safetyRating,
        adminNotes,
      }),
    });
    const payload = await response.json();
    setSaving(false);

    if (!response.ok) {
      setMessage(payload.error || "Feedback could not be saved.");
      return;
    }

    setMessage("Feedback saved. Confirmed features were stored for future learning.");
    await openJob(selectedJob, { silent: true });
  }

  async function reanalyzeSelected() {
    if (!selectedJob) return;
    setReanalyzing(true);
    setMessage("");
    const headers = await getFileExpertAuthHeaders();
    const response = await fetch(`/api/file-expert/jobs/${selectedJob.id}/analyze`, {
      method: "POST",
      headers,
    });
    const payload = await response.json();
    setReanalyzing(false);

    if (!response.ok) {
      setMessage(payload.error || "Analysis could not be triggered.");
      await openJob(selectedJob, { silent: true });
      return;
    }

    await loadJobs({ silent: true });
    await openJob(selectedJob, { silent: true });
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
        <div className="text-center">
          <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-red-600" />
          <p className="text-sm text-zinc-400">Loading admin File Expert...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#050505] text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_20%_0%,rgba(160,18,28,0.22),transparent_32%),linear-gradient(135deg,#050505,#0d0d0f_48%,#160608)]" />

      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <Link
              href="/admin"
              className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-zinc-400 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to admin
            </Link>
            <div className="text-xs font-black uppercase tracking-[0.28em] text-red-500">
              Admin File Expert
            </div>
            <h1 className="mt-2 break-words text-4xl font-black md:text-5xl">
              AI analysis control room
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
              Review uploaded files, inspect analyzer JSON and save human feedback for
              future learning-ready pattern data.
            </p>
          </div>

          <button
            onClick={() => loadJobs({ silent: true })}
            className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-white transition hover:bg-white/10"
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh jobs
          </button>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-red-800/40 bg-red-950/30 p-4 text-sm font-bold text-red-100">
            {message}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
          <section className="min-w-0 rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <SlidersHorizontal className="h-6 w-6 text-red-400" />
              <div>
                <div className="text-sm font-black uppercase tracking-[0.22em] text-red-400">
                  Queue
                </div>
                <h2 className="text-2xl font-black">{filteredJobs.length} analyses</h2>
              </div>
            </div>

            <label className="relative block">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-600" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search vehicle, ECU, file, notes..."
                className="h-14 w-full rounded-2xl border border-white/10 bg-black/40 pl-12 pr-4 text-sm font-bold text-white outline-none placeholder:text-zinc-600 focus:border-red-700"
              />
            </label>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-13 rounded-2xl border border-white/10 bg-black/40 px-4 text-sm font-black text-white outline-none focus:border-red-700"
              >
                {statusFilters.map((status) => (
                  <option key={status} value={status} className="bg-[#111]">
                    {status === "all" ? "All statuses" : status.toUpperCase()}
                  </option>
                ))}
              </select>
              <select
                value={featureFilter}
                onChange={(event) => setFeatureFilter(event.target.value as FileExpertFeature | "all")}
                className="h-13 rounded-2xl border border-white/10 bg-black/40 px-4 text-sm font-black text-white outline-none focus:border-red-700"
              >
                <option value="all" className="bg-[#111]">All features</option>
                {featureKeys.map((feature) => (
                  <option key={feature} value={feature} className="bg-[#111]">
                    {fileExpertFeatureLabels[feature]}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-5 space-y-3">
              {filteredJobs.map((job) => (
                <button
                  key={job.id}
                  onClick={() => openJob(job)}
                  className={`block w-full min-w-0 rounded-3xl border p-4 text-left transition ${
                    selectedJob?.id === job.id
                      ? "border-red-700/60 bg-red-950/25"
                      : "border-white/10 bg-black/25 hover:border-red-800/50 hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(job.status)}`}>
                          {job.status.toUpperCase()}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-zinc-500">
                          {formatDate(job.created_at)}
                        </span>
                      </div>
                      <div className="mt-3 break-words text-lg font-black">
                        {[job.brand, job.model, job.engine].filter(Boolean).join(" ") || "Unspecified vehicle"}
                      </div>
                      <div className="mt-2 break-words text-sm text-zinc-400">
                        {job.ecu_type || "ECU not set"} · {job.read_method || "Unknown read"}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-2xl font-black text-white">{job.confidence_score ?? "-"}</div>
                      <div className="text-xs text-zinc-500">confidence</div>
                    </div>
                  </div>
                </button>
              ))}

              {filteredJobs.length === 0 && (
                <div className="rounded-3xl border border-dashed border-white/15 bg-black/25 p-8 text-center text-sm text-zinc-400">
                  No File Expert jobs match this filter.
                </div>
              )}
            </div>
          </section>

          <section className="min-w-0 space-y-6">
            {selectedJob ? (
              <>
                <div className="rounded-[2rem] border border-red-900/45 bg-white/[0.04] p-4 sm:p-6">
                  <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-black uppercase tracking-[0.22em] text-red-400">
                        Selected analysis
                      </div>
                      <h2 className="mt-1 break-words text-3xl font-black">
                        {[selectedJob.brand, selectedJob.model, selectedJob.engine].filter(Boolean).join(" ") || "File Expert job"}
                      </h2>
                      <p className="mt-2 break-all text-sm text-zinc-500">#{selectedJob.id}</p>
                    </div>
                    <button
                      onClick={reanalyzeSelected}
                      disabled={reanalyzing}
                      className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-white transition hover:bg-white/10 disabled:opacity-50"
                    >
                      {reanalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                      Re-analyze
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <MiniDetail icon={<FileCode2 />} label="Status" value={selectedJob.status} />
                    <MiniDetail icon={<Database />} label="ECU / TCU" value={selectedIdentity?.display_name || selectedJob.ecu_type || "-"} />
                    <MiniDetail icon={<BrainCircuit />} label="Confidence" value={selectedJob.confidence_score ? `${selectedJob.confidence_score}%` : "-"} />
                    <MiniDetail icon={<ShieldAlert />} label="Risk" value={selectedJob.risk_level || "unknown"} />
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <FileLine label="ORI file" name={selectedJob.ori_file_name} hash={selectedJob.ori_sha256} />
                    <FileLine label="MOD file" name={selectedJob.mod_file_name} hash={selectedJob.mod_sha256} />
                  </div>

                  {selectedIdentity && (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                        <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Detected identity</div>
                        <div className="mt-2 font-black">{selectedIdentity.status} · {Math.round(selectedIdentity.confidence * 100)}%</div>
                        <div className="mt-2 text-sm text-zinc-400">{selectedIdentity.supplier || "Unknown supplier"} · {selectedIdentity.variant || selectedIdentity.family || "Unknown family"} · {selectedIdentity.processor || "Processor not found"}</div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                        <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">HW / SW identifiers</div>
                        <div className="mt-2 break-all text-sm font-bold leading-6 text-zinc-300">HW: {selectedIdentity.hardware_numbers.join(", ") || "-"}</div>
                        <div className="mt-1 break-all text-sm font-bold leading-6 text-zinc-300">SW: {selectedIdentity.software_numbers.join(", ") || "-"}</div>
                      </div>
                    </div>
                  )}

                  {selectedJob.customer_notes && (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
                      <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Customer notes</div>
                      <div className="whitespace-pre-wrap break-words text-sm leading-6 text-zinc-300">
                        {selectedJob.customer_notes}
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 sm:p-6">
                  <div className="mb-5 text-sm font-black uppercase tracking-[0.22em] text-red-400">
                    AI report
                  </div>
                  {selectedJob.ai_report ? (
                    <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap break-words rounded-3xl border border-white/10 bg-black/35 p-4 text-sm leading-7 text-zinc-200">
                      {selectedJob.ai_report}
                    </pre>
                  ) : (
                    <div className="rounded-3xl border border-dashed border-white/15 bg-black/25 p-8 text-center text-sm text-zinc-400">
                      Report not ready.
                    </div>
                  )}
                </div>

                <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 sm:p-6">
                  <div className="mb-5 flex items-center gap-3">
                    <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                    <div>
                      <div className="text-sm font-black uppercase tracking-[0.22em] text-red-400">
                        Admin feedback
                      </div>
                      <h2 className="text-2xl font-black">Human confirmation</h2>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {featureKeys.map((feature) => (
                      <label
                        key={feature}
                        className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border p-4 transition ${
                          actualFeatures[feature]
                            ? "border-emerald-700/40 bg-emerald-950/25"
                            : "border-white/10 bg-black/30 hover:bg-white/[0.04]"
                        }`}
                      >
                        <span className="font-black">{fileExpertFeatureLabels[feature]}</span>
                        <input
                          type="checkbox"
                          checked={Boolean(actualFeatures[feature])}
                          onChange={(event) =>
                            setActualFeatures((current) => ({
                              ...current,
                              [feature]: event.target.checked,
                            }))
                          }
                          className="h-5 w-5 accent-emerald-500"
                        />
                      </label>
                    ))}
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-3">
                    <label className="block">
                      <span className="text-sm font-black text-zinc-200">AI correctness</span>
                      <select
                        value={aiCorrect}
                        onChange={(event) => setAiCorrect(event.target.value)}
                        className="mt-2 h-13 w-full rounded-2xl border border-white/10 bg-black/40 px-4 text-sm font-black text-white outline-none focus:border-red-700"
                      >
                        <option value="unknown" className="bg-[#111]">Unknown</option>
                        <option value="yes" className="bg-[#111]">Correct</option>
                        <option value="no" className="bg-[#111]">Wrong</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-sm font-black text-zinc-200">Quality</span>
                      <select
                        value={qualityRating}
                        onChange={(event) => setQualityRating(event.target.value)}
                        className="mt-2 h-13 w-full rounded-2xl border border-white/10 bg-black/40 px-4 text-sm font-black text-white outline-none focus:border-red-700"
                      >
                        {[1, 2, 3, 4, 5].map((value) => (
                          <option key={value} value={value} className="bg-[#111]">{value}/5</option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-sm font-black text-zinc-200">Safety rating</span>
                      <select
                        value={safetyRating}
                        onChange={(event) => setSafetyRating(event.target.value)}
                        className="mt-2 h-13 w-full rounded-2xl border border-white/10 bg-black/40 px-4 text-sm font-black text-white outline-none focus:border-red-700"
                      >
                        {["safe", "aggressive", "risky", "unknown"].map((value) => (
                          <option key={value} value={value} className="bg-[#111]">{value}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <textarea
                    value={adminNotes}
                    onChange={(event) => setAdminNotes(event.target.value)}
                    placeholder="Admin notes for future learning data..."
                    className="mt-4 min-h-32 w-full resize-none rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold leading-6 text-white outline-none placeholder:text-zinc-600 focus:border-red-700"
                  />

                  <button
                    onClick={saveFeedback}
                    disabled={saving}
                    className="mt-4 flex h-14 w-full items-center justify-center rounded-2xl bg-[#b1121b] px-5 text-sm font-black text-white transition hover:bg-[#c91824] disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
                    Save feedback
                  </button>

                  {feedback.length > 0 && (
                    <div className="mt-5 space-y-3">
                      {feedback.map((item) => (
                        <div key={item.id} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="font-black">Feedback {formatDate(item.created_at)}</div>
                            <div className="text-xs text-zinc-500">
                              Quality {item.quality_rating ?? "-"} · {item.safety_rating || "unknown"}
                            </div>
                          </div>
                          <div className="mt-2 text-sm leading-6 text-zinc-400">
                            {item.admin_notes || "No notes."}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <details className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 sm:p-6">
                  <summary className="cursor-pointer text-lg font-black">Analyzer JSON</summary>
                  <pre className="mt-4 max-h-[520px] overflow-auto rounded-2xl border border-white/10 bg-black/40 p-4 text-xs leading-5 text-zinc-300">
                    {JSON.stringify(selectedJob.result_json, null, 2)}
                  </pre>
                </details>
              </>
            ) : (
              <div className="rounded-[2rem] border border-dashed border-white/15 bg-white/[0.04] p-10 text-center text-zinc-400">
                Select a File Expert job.
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function MiniDetail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-red-950/35 text-red-400">
        {icon}
      </div>
      <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">{label}</div>
      <div className="mt-1 break-words text-lg font-black">{value}</div>
    </div>
  );
}

function FileLine({ label, name, hash }: { label: string; name: string | null; hash: string | null }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">{label}</div>
      <div className="mt-2 break-all font-black">{name || "Not uploaded"}</div>
      <div className="mt-2 break-all text-xs text-zinc-500">SHA256 {shortHash(hash)}</div>
    </div>
  );
}
