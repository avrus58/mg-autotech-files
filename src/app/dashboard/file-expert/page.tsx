"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { authenticatedFetch, getStableSession, notifySessionRequired, signOutIfEmailUnverified } from "@/lib/authGuards";
import {
  fileExpertAllowedExtensions,
  fileExpertAllowedExtensionsLabel,
  fileExpertMaxFileSize,
  fileExpertMaxFileSizeLabel,
  fileExpertTextLimits,
} from "@/lib/fileExpert/limits";
import { supabase } from "@/lib/supabaseClient";
import type { FileExpertJob, FileExpertReadMethod } from "@/lib/fileExpert/types";

const readMethods: FileExpertReadMethod[] = ["OBD", "Bench", "Boot", "VR", "Unknown"];
const fileExpertFileRequirements = `Allowed files: ${fileExpertAllowedExtensionsLabel}. Maximum ${fileExpertMaxFileSizeLabel} per file.`;
const fileExpertAccept = fileExpertAllowedExtensions.join(",");
const FILE_EXPERT_JOBS_LOAD_ERROR_MESSAGE = "File Expert analysis history could not be loaded. Please try again.";

type FileExpertFormState = {
  brand: string;
  model: string;
  engine: string;
  ecuType: string;
  readMethod: FileExpertReadMethod;
  customerNotes: string;
};

type FileExpertTextField = keyof typeof fileExpertTextLimits;
type FileSlot = "ori" | "mod";

const initialFileExpertForm: FileExpertFormState = {
  brand: "",
  model: "",
  engine: "",
  ecuType: "",
  readMethod: "Unknown",
  customerNotes: "",
};

const fileExpertTextFieldLabels: Record<FileExpertTextField, string> = {
  brand: "Vehicle brand",
  model: "Model",
  engine: "Engine",
  ecuType: "ECU / TCU hint",
  customerNotes: "Customer notes",
};

const emptyFileSelectionErrors: Record<FileSlot, string> = {
  ori: "",
  mod: "",
};

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

function validateFileExpertSelection(file: File | null) {
  if (!file) return "";
  if (file.size === 0) return "File is empty.";
  if (file.size > fileExpertMaxFileSize) return `File is too large. Maximum size is ${fileExpertMaxFileSizeLabel}.`;

  const lowerName = file.name.toLowerCase();
  const hasAllowedExtension = fileExpertAllowedExtensions.some((extension) => lowerName.endsWith(extension));
  if (!hasAllowedExtension) {
    return `Unsupported file type. Please upload ${fileExpertAllowedExtensionsLabel}.`;
  }

  return "";
}

function getFileExpertTextLimitError(form: FileExpertFormState) {
  for (const field of Object.keys(fileExpertTextLimits) as FileExpertTextField[]) {
    const limit = fileExpertTextLimits[field];
    if (form[field].length > limit) {
      return `${fileExpertTextFieldLabels[field]} must be ${limit} characters or fewer.`;
    }
  }

  return "";
}

function formatFileExpertSize(size: number) {
  if (size >= 1024 * 1024) {
    const megabytes = size / (1024 * 1024);
    return `${Number.isInteger(megabytes) ? megabytes.toFixed(0) : megabytes.toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

export default function FileExpertDashboardPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<FileExpertJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [jobsLoadError, setJobsLoadError] = useState("");
  const [jobsReady, setJobsReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submissionStage, setSubmissionStage] = useState("");
  const [message, setMessage] = useState("");
  const [oriFile, setOriFile] = useState<File | null>(null);
  const [modFile, setModFile] = useState<File | null>(null);
  const [fileSelectionErrors, setFileSelectionErrors] = useState(emptyFileSelectionErrors);
  const [form, setForm] = useState<FileExpertFormState>(initialFileExpertForm);
  const hasLoadedJobsRef = useRef(false);

  async function loadJobs(options?: { silent?: boolean }) {
    if (!options?.silent) setLoading(true);
    setMessage("");

    const user = (await getStableSession()).session?.user;

    if (!user) {
      notifySessionRequired();
      setLoading(false);
      return;
    }

    if (await signOutIfEmailUnverified(user)) {
      router.push("/login?verify_email=1");
      return;
    }

    try {
      const response = await authenticatedFetch("/api/file-expert/jobs", {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => ({}))) as { jobs?: FileExpertJob[] };

      if (!response.ok) {
        throw new Error(FILE_EXPERT_JOBS_LOAD_ERROR_MESSAGE);
      }

      setJobs(payload.jobs ?? []);
      setJobsLoadError("");
      setJobsReady(true);
      hasLoadedJobsRef.current = true;
    } catch {
      if (!options?.silent || !hasLoadedJobsRef.current) {
        setJobsLoadError(FILE_EXPERT_JOBS_LOAD_ERROR_MESSAGE);
      }
    } finally {
      setLoading(false);
    }
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
  const textLimitError = getFileExpertTextLimitError(form);
  const selectedFileError = validateFileExpertSelection(oriFile) || validateFileExpertSelection(modFile);
  const hasSelectedFile = Boolean(oriFile || modFile);
  const canSubmitAnalysis = !submitting && hasSelectedFile && !selectedFileError && !textLimitError;
  const submitGuidance = !hasSelectedFile
    ? "Select at least one valid ORI or MOD file before starting analysis."
    : selectedFileError || textLimitError;
  const showInitialJobsLoadError = Boolean(jobsLoadError && !jobsReady);

  function handleFileSelection(slot: FileSlot, file: File | null) {
    const validationError = validateFileExpertSelection(file);
    setFileSelectionErrors((current) => ({ ...current, [slot]: validationError }));

    if (slot === "ori") setOriFile(validationError ? null : file);
    if (slot === "mod") setModFile(validationError ? null : file);

    if (validationError) {
      setMessage(validationError);
      return;
    }

    if (file) setMessage("");
  }

  async function submitAnalysis(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!oriFile && !modFile) {
      setMessage("Please upload at least one valid ORI or MOD file.");
      return;
    }

    if (selectedFileError) {
      setMessage(selectedFileError);
      return;
    }

    if (textLimitError) {
      setMessage(textLimitError);
      return;
    }

    setSubmitting(true);
    setSubmissionStage("Preparing secure upload...");
    const prepareResponse = await authenticatedFetch("/api/file-expert/jobs/prepare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        oriFile: oriFile ? { name: oriFile.name, size: oriFile.size, type: oriFile.type } : null,
        modFile: modFile ? { name: modFile.name, size: modFile.size, type: modFile.type } : null,
      }),
    });
    const prepared = await prepareResponse.json();

    if (!prepareResponse.ok) {
      setMessage(prepared.error || "Analysis could not be prepared.");
      setSubmissionStage("");
      setSubmitting(false);
      return;
    }

    setSubmissionStage("Uploading files securely...");
    const uploadResults = await Promise.all([
      oriFile && prepared.uploads?.ori
        ? supabase.storage.from("file-expert").upload(prepared.uploads.ori.path, oriFile, {
            contentType: prepared.uploads.ori.contentType,
            upsert: false,
          })
        : Promise.resolve({ error: null }),
      modFile && prepared.uploads?.mod
        ? supabase.storage.from("file-expert").upload(prepared.uploads.mod.path, modFile, {
            contentType: prepared.uploads.mod.contentType,
            upsert: false,
          })
        : Promise.resolve({ error: null }),
    ]);
    const uploadError = uploadResults.find((result) => result.error)?.error;

    if (uploadError) {
      await authenticatedFetch(`/api/file-expert/jobs/${prepared.jobId}/finalize`, {
        method: "POST",
      });
      setMessage(uploadError.message || "File upload failed.");
      setSubmissionStage("");
      setSubmitting(false);
      await loadJobs({ silent: true });
      return;
    }

    setSubmissionStage("Identifying control unit...");
    const finalizeResponse = await authenticatedFetch(`/api/file-expert/jobs/${prepared.jobId}/finalize`, {
      method: "POST",
    });
    const finalized = await finalizeResponse.json();
    setSubmissionStage("");
    setSubmitting(false);

    if (!finalizeResponse.ok) {
      setMessage(finalized.error || "Analysis could not be completed.");
      await loadJobs({ silent: true });
      return;
    }

    setOriFile(null);
    setModFile(null);
    setFileSelectionErrors(emptyFileSelectionErrors);
    setForm(initialFileExpertForm);
    await loadJobs({ silent: true });
    router.push(`/dashboard/file-expert/${prepared.jobId}`);
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
    <main className="mg-compact-ui min-h-screen overflow-x-hidden bg-[#050505] text-white">
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
              Automatic ECU / TCU identification
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
              Upload one file to identify the control unit, HW/SW information and file
              profile. Add the matching ORI and MOD pair for a professional modification comparison.
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

        {!showInitialJobsLoadError && (
          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <Metric title="Total analyses" value={stats.total} icon={<BrainCircuit />} />
            <Metric title="In review" value={stats.processing} icon={<Clock3 />} />
            <Metric title="Completed" value={stats.completed} icon={<CheckCircle2 />} />
            <Metric title="Failed" value={stats.failed} icon={<AlertTriangle />} />
          </div>
        )}

        {jobsLoadError && jobsReady ? (
          <div role="alert" className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-700/30 bg-amber-950/20 p-4 text-amber-100 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
              <div className="min-w-0">
                <div className="font-black">File Expert history sync needs retry</div>
                <p className="mt-1 text-sm leading-6 text-amber-100/75">
                  Your last loaded analysis history is still shown.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void loadJobs({ silent: true })}
              className="inline-flex shrink-0 items-center justify-center rounded-2xl border border-amber-500/30 bg-black/20 px-4 py-2 text-xs font-black text-amber-100 transition hover:bg-amber-950/40"
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Retry sync
            </button>
          </div>
        ) : null}

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
                <h2 className="mt-1 text-2xl font-black">Upload control-unit files</h2>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FileDrop
                inputId="file-expert-ori-file"
                title="ORI file"
                description="Original read or single file for identification"
                file={oriFile}
                error={fileSelectionErrors.ori}
                onChange={(file) => handleFileSelection("ori", file)}
              />
              <FileDrop
                inputId="file-expert-mod-file"
                title="MOD file"
                description="Optional modified file for ORI/MOD comparison"
                file={modFile}
                error={fileSelectionErrors.mod}
                onChange={(file) => handleFileSelection("mod", file)}
              />
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <TextInput
                id="file-expert-brand"
                label="Vehicle brand (optional)"
                value={form.brand}
                maxLength={fileExpertTextLimits.brand}
                onChange={(brand) => setForm((current) => ({ ...current, brand }))}
                placeholder="Auto-detected where evidence is available"
              />
              <TextInput
                id="file-expert-model"
                label="Model (optional)"
                value={form.model}
                maxLength={fileExpertTextLimits.model}
                onChange={(model) => setForm((current) => ({ ...current, model }))}
                placeholder="Optional workshop reference"
              />
              <TextInput
                id="file-expert-engine"
                label="Engine (optional)"
                value={form.engine}
                maxLength={fileExpertTextLimits.engine}
                onChange={(engine) => setForm((current) => ({ ...current, engine }))}
                placeholder="Engine code or capacity if known"
              />
              <TextInput
                id="file-expert-ecu-type"
                label="ECU / TCU hint (optional)"
                value={form.ecuType}
                maxLength={fileExpertTextLimits.ecuType}
                onChange={(ecuType) => setForm((current) => ({ ...current, ecuType }))}
                placeholder="Leave empty for automatic identification"
              />
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
                maxLength={fileExpertTextLimits.customerNotes}
                aria-describedby="file-expert-customer-notes-limit"
                aria-invalid={form.customerNotes.length > fileExpertTextLimits.customerNotes || undefined}
                onChange={(event) =>
                  setForm((current) => ({ ...current, customerNotes: event.target.value }))
                }
                placeholder="What should be checked? Example: compare Stage 1 file, DTC area, suspected DPF/EGR changes..."
                className="mt-2 min-h-32 w-full resize-none rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold leading-6 text-white outline-none placeholder:text-zinc-600 focus:border-red-700"
              />
              <CharacterLimitHint
                id="file-expert-customer-notes-limit"
                value={form.customerNotes}
                maxLength={fileExpertTextLimits.customerNotes}
              />
            </label>

            {submitGuidance ? (
              <p
                role={selectedFileError || textLimitError ? "alert" : undefined}
                className="mt-4 rounded-2xl border border-amber-700/30 bg-amber-950/15 px-4 py-3 text-xs font-bold leading-5 text-amber-100"
              >
                {submitGuidance}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={!canSubmitAnalysis}
              className="mt-6 flex h-14 w-full items-center justify-center rounded-2xl bg-[#b1121b] px-5 text-sm font-black text-white shadow-xl shadow-red-950/30 transition hover:bg-[#c91824] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <BrainCircuit className="mr-2 h-5 w-5" />
              )}
              {submissionStage || "Identify and analyze files"}
            </button>

            <div className="mt-5 rounded-2xl border border-amber-700/30 bg-amber-950/15 p-4 text-xs leading-6 text-amber-100/80">
              <ShieldCheck className="mr-2 inline h-4 w-4 text-amber-300" />
              The system separates file evidence from probable matches. Exact vehicle,
              map purpose and checksum status are never invented when evidence is missing.
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

            {showInitialJobsLoadError ? (
              <FileExpertJobsLoadErrorState onRetry={() => void loadJobs()} />
            ) : jobs.length === 0 ? (
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
                          {[job.brand, job.model, job.engine].filter(Boolean).join(" ") || job.ecu_type || "Automatic ECU analysis"}
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

function FileExpertJobsLoadErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-3xl border border-red-800/40 bg-red-950/25 p-8 text-center">
      <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-red-300" />
      <h3 className="text-xl font-black">File Expert history sync failed</h3>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-zinc-300">
        Analysis history is not shown until it loads successfully. Your files and reports have not been changed.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex items-center justify-center rounded-2xl bg-[#b1121b] px-5 py-3 text-sm font-black text-white transition hover:bg-[#c91824]"
      >
        <RefreshCcw className="mr-2 h-4 w-4" />
        Try again
      </button>
    </div>
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
  id,
  label,
  value,
  maxLength,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  maxLength: number;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const hintId = `${id}-limit`;

  return (
    <label htmlFor={id} className="block min-w-0">
      <span className="text-sm font-black text-zinc-200">{label}</span>
      <input
        id={id}
        value={value}
        maxLength={maxLength}
        aria-describedby={hintId}
        aria-invalid={value.length > maxLength || undefined}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 h-14 w-full rounded-2xl border border-white/10 bg-black/40 px-4 text-sm font-bold text-white outline-none placeholder:text-zinc-600 focus:border-red-700"
      />
      <CharacterLimitHint id={hintId} value={value} maxLength={maxLength} />
    </label>
  );
}

function CharacterLimitHint({
  id,
  value,
  maxLength,
}: {
  id: string;
  value: string;
  maxLength: number;
}) {
  const remaining = maxLength - value.length;

  return (
    <div
      id={id}
      className={`mt-2 text-xs font-bold ${
        remaining < 0 ? "text-red-300" : "text-zinc-500"
      }`}
    >
      Max {maxLength} characters.{" "}
      {remaining >= 0 ? `${remaining} remaining.` : `${Math.abs(remaining)} over limit.`}
    </div>
  );
}

function FileDrop({
  inputId,
  title,
  description,
  file,
  error,
  onChange,
}: {
  inputId: string;
  title: string;
  description: string;
  file: File | null;
  error: string;
  onChange: (file: File | null) => void;
}) {
  const requirementsId = `${inputId}-requirements`;
  const errorId = `${inputId}-error`;

  return (
    <label
      htmlFor={inputId}
      className={`block min-w-0 cursor-pointer rounded-3xl border bg-black/30 p-4 transition hover:border-red-800/60 hover:bg-white/[0.04] ${
        error ? "border-red-800/60" : "border-white/10"
      }`}
    >
      <input
        id={inputId}
        type="file"
        accept={fileExpertAccept}
        aria-describedby={error ? `${requirementsId} ${errorId}` : requirementsId}
        className="hidden"
        onChange={(event) => {
          onChange(event.target.files?.[0] ?? null);
          event.currentTarget.value = "";
        }}
      />
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-950/35 text-red-400">
          <FileCode2 className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="font-black">{title}</div>
          <div className="mt-1 text-xs leading-5 text-zinc-500">{description}</div>
          <div id={requirementsId} className="mt-2 text-xs font-bold leading-5 text-zinc-500">
            {fileExpertFileRequirements}
          </div>
          <div className="mt-3 break-all rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-zinc-300">
            {file ? `${file.name} (${formatFileExpertSize(file.size)})` : "Choose file"}
          </div>
          {error ? (
            <div id={errorId} role="alert" className="mt-2 text-xs font-bold leading-5 text-red-300">
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </label>
  );
}
