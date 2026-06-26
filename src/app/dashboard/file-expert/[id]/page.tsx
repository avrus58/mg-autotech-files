"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  BrainCircuit,
  Database,
  Download,
  FileCode2,
  Gauge,
  Loader2,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";
import { signOutIfEmailUnverified } from "@/lib/authGuards";
import { supabase } from "@/lib/supabaseClient";
import type {
  FileExpertAnalyzerResult,
  FileExpertJob,
  FileExpertPossibleFeature,
} from "@/lib/fileExpert/types";
import { fileExpertFeatureLabels } from "@/lib/fileExpert/types";

type Fingerprint = {
  id: string;
  file_role: string;
  sha256: string;
  file_size: number;
  entropy: number | null;
  ff_ratio: number | null;
  zero_ratio: number | null;
  created_at: string;
};

function statusClass(status: string) {
  if (status === "completed") return "border-emerald-700/40 bg-emerald-950/30 text-emerald-300";
  if (status === "processing") return "border-blue-700/40 bg-blue-950/30 text-blue-300";
  if (status === "failed") return "border-red-700/40 bg-red-950/30 text-red-300";
  return "border-amber-700/40 bg-amber-950/30 text-amber-300";
}

function riskClass(risk: string | null) {
  if (risk === "low") return "border-emerald-700/40 bg-emerald-950/30 text-emerald-300";
  if (risk === "medium") return "border-amber-700/40 bg-amber-950/30 text-amber-300";
  if (risk === "high") return "border-red-700/40 bg-red-950/30 text-red-300";
  return "border-zinc-700/40 bg-zinc-900/50 text-zinc-300";
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

function formatBytes(value: number | string | null) {
  if (!value) return "-";
  const bytes = Number(value);
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function shortHash(value: string | null | undefined) {
  if (!value) return "-";
  return `${value.slice(0, 12)}...${value.slice(-6)}`;
}

function featureConfidence(feature: FileExpertPossibleFeature) {
  return `${Math.round(feature.confidence * 100)}%`;
}

export default function FileExpertReportPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const jobId = params.id;
  const [job, setJob] = useState<FileExpertJob | null>(null);
  const [fingerprints, setFingerprints] = useState<Fingerprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [message, setMessage] = useState("");

  async function loadJob(options?: { silent?: boolean }) {
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

    const response = await fetch(`/api/file-expert/jobs/${jobId}`, { cache: "no-store" });
    const payload = await response.json();

    if (!response.ok) {
      setMessage(payload.error || "File Expert report could not be loaded.");
      setLoading(false);
      return;
    }

    setJob(payload.job);
    setFingerprints(payload.fingerprints ?? []);
    setLoading(false);
  }

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadJob();
    }, 0);
    const interval = window.setInterval(() => loadJob({ silent: true }), 15000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const result = job?.result_json as FileExpertAnalyzerResult | null | undefined;

  const fileCards = useMemo(
    () => [
      {
        label: "ORI",
        name: job?.ori_file_name,
        size: job?.ori_file_size,
        hash: job?.ori_sha256,
      },
      {
        label: "MOD",
        name: job?.mod_file_name,
        size: job?.mod_file_size,
        hash: job?.mod_sha256,
      },
    ],
    [job]
  );

  async function reanalyze() {
    setReanalyzing(true);
    setMessage("");
    const response = await fetch(`/api/file-expert/jobs/${jobId}/analyze`, { method: "POST" });
    const payload = await response.json();
    setReanalyzing(false);

    if (!response.ok) {
      setMessage(payload.error || "Analysis could not be triggered.");
      await loadJob({ silent: true });
      return;
    }

    await loadJob({ silent: true });
  }

  function downloadJson() {
    if (!job?.result_json) return;
    const blob = new Blob([JSON.stringify(job.result_json, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mg-file-expert-${job.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
        <div className="text-center">
          <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-red-600" />
          <p className="text-sm text-zinc-400">Loading File Expert report...</p>
        </div>
      </main>
    );
  }

  if (!job) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] px-4 text-white">
        <div className="max-w-md rounded-3xl border border-red-800/40 bg-red-950/20 p-6 text-center">
          <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-red-400" />
          <h1 className="text-2xl font-black">Report not found</h1>
          <p className="mt-3 text-sm text-zinc-400">{message || "This report is not available."}</p>
          <Link href="/dashboard/file-expert" className="mt-6 inline-flex rounded-xl bg-[#b1121b] px-5 py-3 font-black text-white">
            Back to File Expert
          </Link>
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
              href="/dashboard/file-expert"
              className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-zinc-400 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to analyses
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(job.status)}`}>
                {job.status.toUpperCase()}
              </span>
              <span className={`rounded-full border px-3 py-1 text-xs font-black ${riskClass(job.risk_level)}`}>
                RISK: {(job.risk_level || "unknown").toUpperCase()}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-zinc-400">
                {formatDate(job.created_at)}
              </span>
            </div>
            <h1 className="mt-3 break-words text-4xl font-black md:text-5xl">
              {[job.brand, job.model, job.engine].filter(Boolean).join(" ") || "File Expert Report"}
            </h1>
            <p className="mt-3 max-w-4xl text-sm leading-7 text-zinc-400">
              {job.executive_summary || "The analysis report is being prepared."}
            </p>
          </div>

          <div className="grid gap-2 sm:flex sm:flex-wrap">
            <button
              onClick={reanalyze}
              disabled={reanalyzing}
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-white transition hover:bg-white/10 disabled:opacity-50"
            >
              {reanalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              Re-analyze
            </button>
            <button
              onClick={downloadJson}
              disabled={!job.result_json}
              className="inline-flex items-center justify-center rounded-2xl bg-[#b1121b] px-5 py-3 text-sm font-black text-white transition hover:bg-[#c91824] disabled:opacity-50"
            >
              <Download className="mr-2 h-4 w-4" />
              Download JSON
            </button>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-red-800/40 bg-red-950/30 p-4 text-sm font-bold text-red-200">
            {message}
          </div>
        )}

        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <InfoCard title="Confidence" value={job.confidence_score ? `${job.confidence_score}%` : "-"} icon={<Gauge />} />
          <InfoCard title="Mode" value={result?.mode?.replaceAll("_", " ") || "-"} icon={<BrainCircuit />} />
          <InfoCard title="ECU / TCU" value={job.ecu_type || "-"} icon={<Database />} />
          <InfoCard title="Read method" value={job.read_method || "-"} icon={<FileCode2 />} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="min-w-0 space-y-6">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 sm:p-6">
              <div className="mb-5 text-sm font-black uppercase tracking-[0.22em] text-red-400">
                Uploaded files
              </div>
              <div className="grid gap-3">
                {fileCards.map((file) => (
                  <div key={file.label} className="min-w-0 rounded-3xl border border-white/10 bg-black/30 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="font-black text-red-300">{file.label}</div>
                      <div className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-black text-zinc-400">
                        {formatBytes(file.size ?? null)}
                      </div>
                    </div>
                    <div className="break-all text-sm font-bold text-white">{file.name || "Not uploaded"}</div>
                    <div className="mt-2 break-all text-xs text-zinc-500">SHA256 {shortHash(file.hash)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 sm:p-6">
              <div className="mb-5 text-sm font-black uppercase tracking-[0.22em] text-red-400">
                Detected possible features
              </div>
              {result?.possible_features?.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {result.possible_features.map((feature) => (
                    <div key={feature.feature} className="rounded-2xl border border-red-900/35 bg-red-950/20 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-black">
                          {fileExpertFeatureLabels[feature.feature] ?? feature.feature}
                        </div>
                        <div className="rounded-full bg-black/35 px-3 py-1 text-xs font-black text-red-200">
                          {featureConfidence(feature)}
                        </div>
                      </div>
                      <div className="mt-3 text-xs leading-5 text-zinc-400">
                        {feature.reasons.join(" ") || "Heuristic candidate. Requires human confirmation."}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/15 bg-black/25 p-5 text-sm text-zinc-400">
                  No specific feature pattern has been detected yet.
                </div>
              )}
            </div>

            <div className="rounded-[2rem] border border-amber-700/30 bg-amber-950/15 p-4 sm:p-6">
              <div className="mb-3 flex items-center gap-3">
                <ShieldCheck className="h-6 w-6 text-amber-300" />
                <h2 className="text-xl font-black">Safety note</h2>
              </div>
              <p className="text-sm leading-7 text-amber-100/80">
                This is an automated report for analysis and quality control. It does
                not guarantee file safety and does not replace checksum verification
                or an experienced calibrator review before writing.
              </p>
            </div>
          </section>

          <section className="min-w-0 space-y-6">
            <div className="rounded-[2rem] border border-red-900/45 bg-white/[0.04] p-4 sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <BrainCircuit className="h-7 w-7 text-red-400" />
                <div>
                  <div className="text-sm font-black uppercase tracking-[0.22em] text-red-400">
                    AI report
                  </div>
                  <h2 className="text-2xl font-black">Professional file analysis</h2>
                </div>
              </div>
              {job.ai_report ? (
                <pre className="whitespace-pre-wrap break-words rounded-3xl border border-white/10 bg-black/35 p-4 text-sm leading-7 text-zinc-200 sm:p-5">
                  {job.ai_report}
                </pre>
              ) : (
                <div className="rounded-3xl border border-dashed border-white/15 bg-black/25 p-8 text-center text-sm text-zinc-400">
                  Report is not ready yet.
                </div>
              )}
            </div>

            {result?.comparison && (
              <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 sm:p-6">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-black uppercase tracking-[0.22em] text-red-400">
                      ORI / MOD comparison
                    </div>
                    <h2 className="mt-1 text-2xl font-black">Changed regions</h2>
                  </div>
                  <div className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-xs font-black text-zinc-300">
                    {result.comparison.changed_bytes.toLocaleString()} bytes changed
                  </div>
                </div>
                <div className="overflow-x-auto rounded-2xl border border-white/10">
                  <table className="min-w-[680px] w-full text-left text-sm">
                    <thead className="bg-black/40 text-xs uppercase tracking-[0.16em] text-zinc-500">
                      <tr>
                        <th className="px-4 py-3">Offset</th>
                        <th className="px-4 py-3">Length</th>
                        <th className="px-4 py-3">Changed</th>
                        <th className="px-4 py-3">Delta preview</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {result.comparison.changed_blocks.slice(0, 18).map((block) => (
                        <tr key={`${block.start_offset_hex}-${block.end_offset_hex}`} className="bg-black/20">
                          <td className="px-4 py-3 font-mono text-red-200">{block.start_offset_hex}</td>
                          <td className="px-4 py-3">{block.length}</td>
                          <td className="px-4 py-3">{block.changed_byte_count}</td>
                          <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                            {block.delta_preview.slice(0, 8).join(", ") || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 sm:p-6">
              <div className="mb-5 text-sm font-black uppercase tracking-[0.22em] text-red-400">
                Map candidates
              </div>
              {result?.map_candidates?.length ? (
                <div className="grid gap-3">
                  {result.map_candidates.slice(0, 10).map((candidate) => (
                    <div key={`${candidate.offset_hex}-${candidate.length}`} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="font-mono font-black text-red-200">{candidate.offset_hex}</div>
                        <div className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-black text-zinc-300">
                          {Math.round(candidate.confidence * 100)}%
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-zinc-300">{candidate.reason}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/15 bg-black/25 p-5 text-sm text-zinc-400">
                  No map candidates available.
                </div>
              )}
            </div>

            <details className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 sm:p-6">
              <summary className="cursor-pointer text-lg font-black">Technical JSON</summary>
              <pre className="mt-4 max-h-[520px] overflow-auto rounded-2xl border border-white/10 bg-black/40 p-4 text-xs leading-5 text-zinc-300">
                {JSON.stringify(job.result_json, null, 2)}
              </pre>
            </details>

            {fingerprints.length > 0 && (
              <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 sm:p-6">
                <div className="mb-5 text-sm font-black uppercase tracking-[0.22em] text-red-400">
                  Binary fingerprints
                </div>
                <div className="grid gap-3">
                  {fingerprints.map((fingerprint) => (
                    <div key={fingerprint.id} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="font-black uppercase text-red-200">{fingerprint.file_role}</div>
                        <div className="text-xs font-bold text-zinc-500">{formatBytes(fingerprint.file_size)}</div>
                      </div>
                      <div className="mt-2 break-all text-xs text-zinc-400">SHA256 {shortHash(fingerprint.sha256)}</div>
                      <div className="mt-3 grid gap-2 text-xs text-zinc-400 sm:grid-cols-3">
                        <span>Entropy: {fingerprint.entropy ?? "-"}</span>
                        <span>FF: {fingerprint.ff_ratio ?? "-"}</span>
                        <span>00: {fingerprint.zero_ratio ?? "-"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function InfoCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-red-950/35 text-red-400">
        {icon}
      </div>
      <div className="text-sm text-zinc-400">{title}</div>
      <div className="mt-1 break-words text-2xl font-black">{value}</div>
    </div>
  );
}
