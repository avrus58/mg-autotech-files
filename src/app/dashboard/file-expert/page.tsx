"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  FileCode2,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { signOutIfEmailUnverified } from "@/lib/authGuards";
import { getFileExpertAuthHeaders } from "@/lib/fileExpert/client";
import { supabase } from "@/lib/supabaseClient";
import type { FileExpertJob, FileExpertReadMethod } from "@/lib/fileExpert/types";

const readMethods: FileExpertReadMethod[] = ["OBD", "Bench", "Boot", "VR", "Unknown"];

function statusClass(status: string) {
  if (status === "completed") return "border-emerald-700/40 bg-emerald-950/30 text-emerald-300";
  if (status === "processing") return "border-blue-700/40 bg-blue-950/30 text-blue-300";
  if (status === "failed") return "border-red-700/40 bg-red-950/30 text-red-300";
  return "border-amber-700/40 bg-amber-950/30 text-amber-300";
}

function statusLabel(status: string) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
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

export default function FileExpertDashboardPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<FileExpertJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [oriFile, setOriFile] = useState<File | null>(null);
  const [modFile, setModFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    brand: "",
    model: "",
    engine: "",
    ecuType: "",
    readMethod: "Unknown" as FileExpertReadMethod,
    customerNotes: "",
  });

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

    const headers = await getFileExpertAuthHeaders();
    const response = await fetch("/api/file-expert/jobs", {
      cache: "no-store",
      headers,
    });
    const payload = await response.json();

    if (!response.ok) {
      setMessage(payload.error || "File Expert analyses could not be loaded.");
      setLoading(false);
      return;
    }

    setJobs(payload.jobs ?? []);
    setLoading(false);
  }

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadJobs();
    }, 0);
    const interval = window.setInterval(() => loadJobs({ silent: true }), 15000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    return {
      total: jobs.length,
      completed: jobs.filter((job) => job.status === "completed").length,
      processing: jobs.filter((job) => job.status === "processing" || job.status === "pending").length,
      failed: jobs.filter((job) => job.status === "failed").length,
    };
  }, [jobs]);

  async function submitAnalysis(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!oriFile && !modFile) {
      setMessage("Please upload at least one ORI or MOD file.");
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    if (oriFile) formData.append("oriFile", oriFile);
    if (modFile) formData.append("modFile", modFile);
    formData.append("brand", form.brand);
    formData.append("model", form.model);
    formData.append("engine", form.engine);
    formData.append("ecuType", form.ecuType);
    formData.append("readMethod", form.readMethod);
    formData.append("customerNotes", form.customerNotes);

    const headers = await getFileExpertAuthHeaders();
    const response = await fetch("/api/file-expert/jobs", {
      method: "POST",
      headers,
      body: formData,
    });
    const payload = await response.json();
    setSubmitting(false);

    if (!response.ok && response.status !== 202) {
      setMessage(payload.error || "Analysis could not be created.");
      return;
    }

    setOriFile(null);
    setModFile(null);
    setForm({
      brand: "",
      model: "",
      engine: "",
      ecuType: "",
      readMethod: "Unknown",
      customerNotes: "",
    });
    await loadJobs({ silent: true });
    router.push(`/dashboard/file-expert/${payload.jobId}`);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
        <div className="text-center">
          <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-red-600" />
          <p className="text-sm text-zinc-400">Loading File Expert...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#050505] text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_20%_0%,rgba(160,18,28,0.22),transparent_32%),linear-gradient(135deg,#050505,#0d0d0f_48%,#160608)]" />

      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <Link
              href="/dashboard"
              className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-zinc-400 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to dashboard
            </Link>
            <div className="text-xs font-black uppercase tracking-[0.28em] text-red-500">
              MG AutoTech AI File Expert
            </div>
            <h1 className="mt-2 break-words text-4xl font-black md:text-5xl">
              ECU / TCU file analysis
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
              Upload ORI and MOD files for a technical comparison report. This is an
              analysis tool only; it does not create ready-to-write tuning files.
            </p>
          </div>

          <button
            onClick={() => loadJobs({ silent: true })}
            className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-white transition hover:bg-white/10"
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </button>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-red-800/40 bg-red-950/30 p-4 text-sm font-bold text-red-200">
            {message}
          </div>
        )}

        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <Metric title="Total analyses" value={stats.total} icon={<BrainCircuit />} />
          <Metric title="In review" value={stats.processing} icon={<Clock3 />} />
          <Metric title="Completed" value={stats.completed} icon={<CheckCircle2 />} />
          <Metric title="Failed" value={stats.failed} icon={<AlertTriangle />} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <form
            onSubmit={submitAnalysis}
            className="min-w-0 rounded-[2rem] border border-red-900/45 bg-white/[0.04] p-4 shadow-2xl shadow-black/30 sm:p-6"
          >
            <div className="mb-6 flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-red-800/40 bg-red-950/35 text-red-400">
                <Upload className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-black uppercase tracking-[0.22em] text-red-400">
                  New analysis
                </div>
                <h2 className="mt-1 text-2xl font-black">Upload file pair</h2>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FileDrop
                title="ORI file"
                description="Original ECU/TCU file"
                file={oriFile}
                onChange={setOriFile}
              />
              <FileDrop
                title="MOD file"
                description="Modified file or optional single-file check"
                file={modFile}
                onChange={setModFile}
              />
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <TextInput label="Vehicle brand" value={form.brand} onChange={(brand) => setForm((current) => ({ ...current, brand }))} placeholder="BMW, Audi, Mercedes..." />
              <TextInput label="Model" value={form.model} onChange={(model) => setForm((current) => ({ ...current, model }))} placeholder="320d, A6, E-Class..." />
              <TextInput label="Engine" value={form.engine} onChange={(engine) => setForm((current) => ({ ...current, engine }))} placeholder="3.0 TDI, N57, 2.0 TDI..." />
              <TextInput label="ECU / TCU type" value={form.ecuType} onChange={(ecuType) => setForm((current) => ({ ...current, ecuType }))} placeholder="EDC17, MD1, MG1, ZF 8HP..." />
            </div>

            <label className="mt-4 block">
              <span className="text-sm font-black text-zinc-200">Read method</span>
              <select
                value={form.readMethod}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    readMethod: event.target.value as FileExpertReadMethod,
                  }))
                }
                className="mt-2 h-14 w-full rounded-2xl border border-white/10 bg-black/40 px-4 text-sm font-bold text-white outline-none focus:border-red-700"
              >
                {readMethods.map((method) => (
                  <option key={method} value={method} className="bg-[#111]">
                    {method}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-4 block">
              <span className="text-sm font-black text-zinc-200">Customer notes</span>
              <textarea
                value={form.customerNotes}
                onChange={(event) =>
                  setForm((current) => ({ ...current, customerNotes: event.target.value }))
                }
                placeholder="What should be checked? Example: compare Stage 1 file, DTC area, suspected DPF/EGR changes..."
                className="mt-2 min-h-32 w-full resize-none rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold leading-6 text-white outline-none placeholder:text-zinc-600 focus:border-red-700"
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="mt-6 flex h-14 w-full items-center justify-center rounded-2xl bg-[#b1121b] px-5 text-sm font-black text-white shadow-xl shadow-red-950/30 transition hover:bg-[#c91824] disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <BrainCircuit className="mr-2 h-5 w-5" />
              )}
              Start AI File Expert Analysis
            </button>

            <div className="mt-5 rounded-2xl border border-amber-700/30 bg-amber-950/15 p-4 text-xs leading-6 text-amber-100/80">
              <ShieldCheck className="mr-2 inline h-4 w-4 text-amber-300" />
              Automated output is for analysis and quality control. Human tuner
              confirmation and checksum verification are still required.
            </div>
          </form>

          <section className="min-w-0 rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 sm:p-6">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-black uppercase tracking-[0.22em] text-red-400">
                  Recent analyses
                </div>
                <h2 className="mt-1 text-2xl font-black">File Expert jobs</h2>
              </div>
              <div className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-xs font-black text-zinc-400">
                {jobs.length} job{jobs.length === 1 ? "" : "s"}
              </div>
            </div>

            {jobs.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/15 bg-black/25 p-8 text-center">
                <FileCode2 className="mx-auto mb-4 h-10 w-10 text-red-500" />
                <h3 className="text-xl font-black">No analysis yet</h3>
                <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-zinc-400">
                  Upload an ORI/MOD pair and your completed reports will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {jobs.map((job) => (
                  <Link
                    key={job.id}
                    href={`/dashboard/file-expert/${job.id}`}
                    className="block min-w-0 rounded-3xl border border-white/10 bg-black/25 p-4 transition hover:border-red-800/60 hover:bg-white/[0.05]"
                  >
                    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(job.status)}`}>
                            {statusLabel(job.status)}
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-zinc-500">
                            {formatDate(job.created_at)}
                          </span>
                        </div>
                        <h3 className="mt-3 break-words text-xl font-black">
                          {[job.brand, job.model, job.engine].filter(Boolean).join(" ") || "Unspecified vehicle"}
                        </h3>
                        <div className="mt-2 grid gap-2 text-sm text-zinc-400 sm:grid-cols-2">
                          <span className="min-w-0 break-words">ECU: {job.ecu_type || "-"}</span>
                          <span className="min-w-0 break-words">Read: {job.read_method || "-"}</span>
                          <span className="min-w-0 break-all">ORI: {job.ori_file_name || shortHash(job.ori_sha256)}</span>
                          <span className="min-w-0 break-all">MOD: {job.mod_file_name || shortHash(job.mod_sha256)}</span>
                        </div>
                      </div>
                      <div className="inline-flex shrink-0 items-center justify-center rounded-2xl border border-red-800/40 bg-red-950/25 px-4 py-3 text-sm font-black text-red-100">
                        View report
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function Metric({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-red-950/35 text-red-400">
        {icon}
      </div>
      <div className="text-sm text-zinc-400">{title}</div>
      <div className="mt-1 text-4xl font-black">{value}</div>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-sm font-black text-zinc-200">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 h-14 w-full rounded-2xl border border-white/10 bg-black/40 px-4 text-sm font-bold text-white outline-none placeholder:text-zinc-600 focus:border-red-700"
      />
    </label>
  );
}

function FileDrop({
  title,
  description,
  file,
  onChange,
}: {
  title: string;
  description: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  return (
    <label className="block min-w-0 cursor-pointer rounded-3xl border border-white/10 bg-black/30 p-4 transition hover:border-red-800/60 hover:bg-white/[0.04]">
      <input
        type="file"
        accept=".bin,.ori,.mod,.frf,.hex,.zip"
        className="hidden"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-950/35 text-red-400">
          <FileCode2 className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="font-black">{title}</div>
          <div className="mt-1 text-xs leading-5 text-zinc-500">{description}</div>
          <div className="mt-3 break-all rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-zinc-300">
            {file ? `${file.name} (${Math.round(file.size / 1024)} KB)` : "Choose file"}
          </div>
        </div>
      </div>
    </label>
  );
}
