"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Binary,
  BrainCircuit,
  CarFront,
  CheckCircle2,
  Cpu,
  Copy,
  Database,
  Download,
  FileCode2,
  Fingerprint,
  Gauge,
  Loader2,
  RefreshCcw,
  ScanSearch,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { signOutIfEmailUnverified } from "@/lib/authGuards";
import { getFileExpertAuthHeaders } from "@/lib/fileExpert/client";
import { supabase } from "@/lib/supabaseClient";
import type {
  FileExpertAnalyzerResult,
  FileExpertFinding,
  FileExpertJob,
  FileExpertPossibleFeature,
} from "@/lib/fileExpert/types";
import { fileExpertFeatureLabels } from "@/lib/fileExpert/types";

type FingerprintRow = {
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

function findingClass(severity: FileExpertFinding["severity"]) {
  if (severity === "positive") return "border-emerald-800/35 bg-emerald-950/15";
  if (severity === "critical") return "border-red-700/45 bg-red-950/25";
  if (severity === "warning") return "border-amber-700/35 bg-amber-950/15";
  return "border-white/10 bg-black/25";
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

function formatBytes(value: number | string | null | undefined) {
  if (!value) return "-";
  const bytes = Number(value);
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function shortHash(value: string | null | undefined) {
  if (!value) return "-";
  return `${value.slice(0, 12)}...${value.slice(-6)}`;
}

function featureConfidence(feature: FileExpertPossibleFeature) {
  return `${Math.round(feature.confidence * 100)}%`;
}

function formatLabel(value: string | null | undefined) {
  if (!value) return "Not detected";
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function idValue(values: string[] | undefined) {
  return values?.length ? values.join(", ") : "Not detected";
}

export default function FileExpertReportPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const jobId = params.id;
  const [job, setJob] = useState<FileExpertJob | null>(null);
  const [fingerprints, setFingerprints] = useState<FingerprintRow[]>([]);
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

    const response = await fetch(`/api/file-expert/jobs/${jobId}`, {
      cache: "no-store",
      headers: await getFileExpertAuthHeaders(),
    });
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
    const initialLoad = window.setTimeout(() => void loadJob(), 0);
    const interval = window.setInterval(() => loadJob({ silent: true }), 15000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const result = job?.result_json as FileExpertAnalyzerResult | null | undefined;
  const identity = result?.ecu_identification;
  const changeProfile = result?.change_profile;
  const integrity = result?.integrity_assessment;
  const vehicleMatch = result?.vehicle_match;
  const primaryFile = result?.files.mod ?? result?.files.ori ?? result?.files.single;
  const findings = result?.findings ?? [];
  const submittedVehicle = [job?.brand, job?.model, job?.engine].filter(Boolean).join(" ");
  const reportTitle = submittedVehicle || identity?.display_name || "File Expert Report";

  const fileCards = useMemo(
    () => [
      { label: "ORI", name: job?.ori_file_name, size: job?.ori_file_size, hash: job?.ori_sha256, profile: result?.files.ori },
      { label: "MOD", name: job?.mod_file_name, size: job?.mod_file_size, hash: job?.mod_sha256, profile: result?.files.mod },
    ],
    [job, result]
  );

  async function reanalyze() {
    setReanalyzing(true);
    setMessage("");
    const response = await fetch(`/api/file-expert/jobs/${jobId}/analyze`, {
      method: "POST",
      headers: await getFileExpertAuthHeaders(),
    });
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
    const blob = new Blob([JSON.stringify(job.result_json, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mg-file-expert-${job.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function copyJson() {
    if (!job?.result_json) return;
    await navigator.clipboard.writeText(JSON.stringify(job.result_json, null, 2));
    setMessage("Analyzer JSON copied to the clipboard.");
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
        <header className="mb-6 flex flex-col gap-5 border-b border-white/10 pb-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <Link href="/dashboard/file-expert" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-zinc-400 transition hover:text-white">
              <ArrowLeft className="h-4 w-4" /> Back to analyses
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(job.status)}`}>{job.status.toUpperCase()}</span>
              <span className={`rounded-full border px-3 py-1 text-xs font-black ${riskClass(job.risk_level)}`}>RISK: {(job.risk_level || "unknown").toUpperCase()}</span>
              {identity && (
                <span className="rounded-full border border-red-800/40 bg-red-950/25 px-3 py-1 text-xs font-black text-red-200">
                  ECU {identity.status.toUpperCase()} / {Math.round(identity.confidence * 100)}%
                </span>
              )}
            </div>
            <h1 className="mt-3 break-words text-4xl font-black md:text-5xl">{reportTitle}</h1>
            <p className="mt-3 max-w-4xl text-sm leading-7 text-zinc-400">{job.executive_summary || "The analysis report is being prepared."}</p>
            <p className="mt-2 text-xs font-bold text-zinc-600">Analysis {result?.analysis_version || "legacy"} / {formatDate(job.created_at)}</p>
          </div>
          <div className="grid gap-2 sm:flex sm:flex-wrap">
            <button onClick={reanalyze} disabled={reanalyzing} className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black transition hover:bg-white/10 disabled:opacity-50">
              {reanalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />} Re-analyze
            </button>
            <button onClick={() => void copyJson()} disabled={!job.result_json} className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black transition hover:bg-white/10 disabled:opacity-50">
              <Copy className="mr-2 h-4 w-4" /> Copy JSON
            </button>
            <button onClick={downloadJson} disabled={!job.result_json} className="inline-flex items-center justify-center rounded-2xl bg-[#b1121b] px-5 py-3 text-sm font-black transition hover:bg-[#c91824] disabled:opacity-50">
              <Download className="mr-2 h-4 w-4" /> Download report data
            </button>
          </div>
        </header>

        {message && <div className="mb-6 rounded-2xl border border-red-800/40 bg-red-950/30 p-4 text-sm font-bold text-red-200">{message}</div>}

        {job.status === "failed" && (
          <div className="mb-6 rounded-2xl border border-red-700/40 bg-red-950/20 p-5">
            <div className="flex items-center gap-3 font-black text-red-200"><AlertTriangle className="h-5 w-5" />Analysis failed</div>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{job.error_message || "The analyzer could not complete this job. Your uploaded files remain private and unchanged."}</p>
            <button onClick={reanalyze} disabled={reanalyzing} className="mt-4 inline-flex h-10 items-center rounded-xl border border-red-700/40 px-4 text-sm font-black text-red-100 disabled:opacity-50">Try analysis again</button>
          </div>
        )}

        <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm leading-6 text-zinc-300">
          <strong className="text-white">{result?.mode === "ori_mod_compare" ? "ORI + MOD comparison" : "Single-file inspection"}</strong>
          <span className="text-zinc-500"> - </span>
          {result?.mode === "ori_mod_compare"
            ? "Both files were compared byte by byte. Changed regions and possible feature indicators are shown with confidence values."
            : "Only one file is available. The system can inspect structure and ECU markers, but it cannot confirm modifications without a matching ORI/MOD pair."}
        </div>

        {!identity && result && (
          <div className="mb-6 rounded-2xl border border-amber-700/30 bg-amber-950/15 p-4 text-sm leading-6 text-amber-100/80">
            This is a legacy report. Select <strong>Re-analyze</strong> to generate automatic ECU identification and the V2 workshop report.
          </div>
        )}

        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <InfoCard title="Control unit" value={identity?.display_name || job.ecu_type || "Not identified"} icon={<Cpu />} />
          <InfoCard title="Module / supplier" value={[identity?.module_type, identity?.supplier].filter(Boolean).join(" / ") || "Unknown"} icon={<Database />} />
          <InfoCard title="File profile" value={`${formatLabel(primaryFile?.file_format)} / ${formatLabel(primaryFile?.read_scope)}`} icon={<FileCode2 />} />
          <InfoCard title="Analysis confidence" value={job.confidence_score ? `${job.confidence_score}%` : "-"} icon={<Gauge />} />
        </div>

        <section className="mb-6 grid gap-6 rounded-[2rem] border border-red-900/45 bg-white/[0.04] p-4 sm:p-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.22em] text-red-400">Automatic identification</div>
                <h2 className="mt-2 break-words text-3xl font-black">{identity?.display_name || "Control unit not identified"}</h2>
              </div>
              <span className={`rounded-full border px-3 py-1.5 text-xs font-black ${identity?.status === "detected" ? statusClass("completed") : statusClass("pending")}`}>
                {formatLabel(identity?.status)}
              </span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <IdentityField label="Supplier" value={identity?.supplier} />
              <IdentityField label="Family" value={identity?.family} />
              <IdentityField label="Variant" value={identity?.variant} />
              <IdentityField label="Module" value={identity?.module_type} />
              <IdentityField label="Processor" value={identity?.processor} />
              <IdentityField label="Read scope" value={formatLabel(primaryFile?.read_scope)} />
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Detection evidence</div>
              <div className="mt-3 space-y-2 text-sm leading-6 text-zinc-300">
                {identity?.evidence.length ? identity.evidence.map((item) => <div key={item}>- {item}</div>) : <div>No reliable identity marker was found.</div>}
              </div>
            </div>
          </div>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <IdentifierBox label="Hardware numbers" value={idValue(identity?.hardware_numbers)} />
            <IdentifierBox label="Software numbers" value={idValue(identity?.software_numbers)} />
            <IdentifierBox label="Calibration IDs" value={idValue(identity?.calibration_ids)} />
            <IdentifierBox label="VIN / engine markers" value={[idValue(identity?.vins), idValue(identity?.engine_codes)].filter((value) => value !== "Not detected").join(" / ") || "Not detected"} />
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <section className="min-w-0 space-y-6">
            <Panel eyebrow="Workshop findings" title="What the analysis found" icon={<ScanSearch />}>
              <div className="space-y-3">
                {findings.length ? findings.map((finding) => (
                  <div key={finding.id} className={`rounded-2xl border p-4 ${findingClass(finding.severity)}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="font-black">{finding.title}</div>
                      <span className="rounded-full bg-black/35 px-3 py-1 text-xs font-black text-zinc-300">{Math.round(finding.confidence * 100)}%</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-zinc-300">{finding.summary}</p>
                  </div>
                )) : (
                  <p className="rounded-2xl border border-dashed border-white/15 bg-black/25 p-5 text-sm leading-6 text-zinc-400">
                    Re-analyze this report to generate workshop-friendly V2 findings.
                  </p>
                )}
              </div>
            </Panel>

            <Panel eyebrow="Vehicle application" title="Possible vehicle matches" icon={<CarFront />}>
              <p className="mb-4 text-sm leading-6 text-zinc-400">{vehicleMatch?.summary || "No automatic vehicle application match is available."}</p>
              {vehicleMatch?.candidates.length ? (
                <div className="space-y-3">
                  {vehicleMatch.candidates.map((candidate) => (
                    <div key={`${candidate.brand}-${candidate.model}-${candidate.generation}-${candidate.engine}`} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-black">{candidate.brand} {candidate.model}</div>
                          <div className="mt-1 text-sm text-zinc-400">{candidate.generation} / {candidate.engine}</div>
                          <div className="mt-2 text-xs font-bold text-red-200">{candidate.ecu}</div>
                        </div>
                        <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-black">{Math.round(candidate.confidence * 100)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </Panel>

            <Panel eyebrow="Source files" title="Uploaded files" icon={<Binary />}>
              <div className="grid gap-3">
                {fileCards.map((file) => (
                  <div key={file.label} className="min-w-0 rounded-2xl border border-white/10 bg-black/25 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="font-black text-red-300">{file.label}</span>
                      <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-black text-zinc-400">{formatBytes(file.size)}</span>
                    </div>
                    <div className="mt-3 break-all text-sm font-bold">{file.name || "Not uploaded"}</div>
                    <div className="mt-2 text-xs text-zinc-500">{formatLabel(file.profile?.file_format)} / {formatLabel(file.profile?.read_scope)}</div>
                    <div className="mt-2 break-all text-xs text-zinc-600">SHA256 {shortHash(file.hash)}</div>
                  </div>
                ))}
              </div>
            </Panel>
          </section>

          <section className="min-w-0 space-y-6">
            <Panel eyebrow="ORI / MOD assessment" title={changeProfile?.label || "Modification assessment"} icon={<BrainCircuit />} accent>
              <p className="text-sm leading-7 text-zinc-300">{changeProfile?.summary || result?.summary.main_conclusion || "Analysis is not ready."}</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <MetricValue label="Changed bytes" value={result?.comparison?.changed_bytes.toLocaleString() || "-"} />
                <MetricValue label="Affected area" value={result?.comparison ? `${result.comparison.changed_percent}%` : "-"} />
                <MetricValue label="Change groups" value={result?.comparison?.merged_changed_blocks.toLocaleString() || "-"} />
              </div>
            </Panel>

            <Panel eyebrow="Operation indicators" title="Possible modifications" icon={<Wrench />}>
              {result?.possible_features?.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {result.possible_features.map((feature) => (
                    <div key={feature.feature} className="rounded-2xl border border-red-900/35 bg-red-950/15 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-black">{fileExpertFeatureLabels[feature.feature] ?? feature.feature}</div>
                        <span className="rounded-full bg-black/35 px-3 py-1 text-xs font-black text-red-200">{featureConfidence(feature)}</span>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-zinc-400">{feature.reasons.join(" ")}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/15 bg-black/25 p-5 text-sm leading-6 text-zinc-400">
                  No specific operation can be named safely from this file. This does not mean the file is stock.
                </div>
              )}
            </Panel>

            <Panel eyebrow="Compatibility" title="File integrity checks" icon={<BadgeCheck />}>
              <div className="space-y-3">
                <CheckRow label="File size match" value={integrity?.file_size_match} />
                <CheckRow label="ECU identity match" value={integrity?.ecu_identity_match} />
                <CheckRow label="VIN match" value={integrity?.vin_match} />
                <CheckRow label="Checksum" value={null} unknownLabel="Not checked" />
              </div>
              {integrity?.issues.length ? (
                <div className="mt-4 rounded-2xl border border-red-800/40 bg-red-950/20 p-4 text-sm leading-6 text-red-100">{integrity.issues.join(" ")}</div>
              ) : null}
            </Panel>

            <details className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 sm:p-6">
              <summary className="flex cursor-pointer list-none items-center gap-3 text-lg font-black">
                <Fingerprint className="h-5 w-5 text-red-400" /> Technical details
              </summary>
              <div className="mt-5 space-y-5">
                {result?.comparison?.changed_blocks.length ? (
                  <div className="overflow-x-auto rounded-2xl border border-white/10">
                    <table className="w-full min-w-[620px] text-left text-sm">
                      <thead className="bg-black/40 text-xs uppercase tracking-[0.14em] text-zinc-500"><tr><th className="px-4 py-3">Offset</th><th className="px-4 py-3">Length</th><th className="px-4 py-3">Changed bytes</th></tr></thead>
                      <tbody className="divide-y divide-white/10">{result.comparison.changed_blocks.slice(0, 18).map((block) => (
                        <tr key={`${block.start_offset_hex}-${block.end_offset_hex}`} className="bg-black/20"><td className="px-4 py-3 font-mono text-red-200">{block.start_offset_hex}</td><td className="px-4 py-3">{block.length}</td><td className="px-4 py-3">{block.changed_byte_count}</td></tr>
                      ))}</tbody>
                    </table>
                  </div>
                ) : null}
                {result?.map_candidates.length ? (
                  <div className="overflow-x-auto rounded-2xl border border-white/10">
                    <table className="w-full min-w-[620px] text-left text-sm">
                      <thead className="bg-black/40 text-xs uppercase tracking-[0.14em] text-zinc-500"><tr><th className="px-4 py-3">Candidate offset</th><th className="px-4 py-3">Length</th><th className="px-4 py-3">Possible type</th><th className="px-4 py-3">Confidence</th></tr></thead>
                      <tbody className="divide-y divide-white/10">{result.map_candidates.slice(0, 18).map((candidate, index) => <tr key={`${candidate.offset_hex}-${index}`} className="bg-black/20"><td className="px-4 py-3 font-mono text-red-200">{candidate.offset_hex}</td><td className="px-4 py-3">{candidate.length}</td><td className="px-4 py-3">{candidate.possible_type}</td><td className="px-4 py-3">{Math.round(candidate.confidence * 100)}%</td></tr>)}</tbody>
                    </table>
                    <div className="border-t border-white/10 px-4 py-3 text-xs text-amber-100/70">Structural candidates only. Exact map purpose requires ECU-specific definitions and human calibration review.</div>
                  </div>
                ) : null}
                {result?.repeated_patterns.length ? (
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <div className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Repeated binary patterns</div>
                    <div className="mt-3 space-y-2">{result.repeated_patterns.slice(0, 12).map((pattern) => <div key={pattern.signature} className="grid gap-2 border-t border-white/10 pt-2 text-xs sm:grid-cols-[120px_80px_1fr]"><span className="font-mono text-red-200">{pattern.signature}</span><span>{pattern.count} matches</span><span className="break-all text-zinc-500">{pattern.offsets.join(", ")}</span></div>)}</div>
                  </div>
                ) : null}
                {fingerprints.map((fingerprint) => (
                  <div key={fingerprint.id} className="rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-zinc-400">
                    <div className="font-black uppercase text-red-200">{fingerprint.file_role} fingerprint</div>
                    <div className="mt-2 break-all">SHA256 {shortHash(fingerprint.sha256)}</div>
                    <div className="mt-2">Entropy {fingerprint.entropy ?? "-"} / FF {fingerprint.ff_ratio ?? "-"} / 00 {fingerprint.zero_ratio ?? "-"}</div>
                  </div>
                ))}
                {job.ai_report && <details className="rounded-2xl border border-white/10 bg-black/25 p-4"><summary className="cursor-pointer font-black">Text report</summary><pre className="mt-4 whitespace-pre-wrap break-words text-xs leading-6 text-zinc-300">{job.ai_report}</pre></details>}
                <details className="rounded-2xl border border-white/10 bg-black/25 p-4"><summary className="cursor-pointer font-black">Analyzer JSON</summary><pre className="mt-4 max-h-[520px] overflow-auto text-xs leading-5 text-zinc-300">{JSON.stringify(job.result_json, null, 2)}</pre></details>
              </div>
            </details>

            <div className="rounded-[2rem] border border-amber-700/30 bg-amber-950/15 p-4 sm:p-6">
              <div className="mb-3 flex items-center gap-3"><ShieldCheck className="h-6 w-6 text-amber-300" /><h2 className="text-xl font-black">Verification required</h2></div>
              <p className="text-sm leading-7 text-amber-100/80">Automatic identification is evidence-based but not a flashing approval. Verify HW/SW compatibility, checksum and the calibration in professional software before writing the file. Validate suspected modifications with controlled logging and/or dyno testing where relevant.</p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function InfoCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return <div className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.04] p-5"><div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-red-950/35 text-red-400">{icon}</div><div className="text-sm text-zinc-400">{title}</div><div className="mt-1 break-words text-xl font-black">{value}</div></div>;
}

function IdentityField({ label, value }: { label: string; value: string | null | undefined }) {
  return <div className="rounded-2xl border border-white/10 bg-black/25 p-4"><div className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">{label}</div><div className="mt-2 break-words font-black">{value || "Not detected"}</div></div>;
}

function IdentifierBox({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-2xl border border-white/10 bg-black/30 p-4"><div className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">{label}</div><div className="mt-2 break-all text-sm font-bold leading-6 text-zinc-200">{value}</div></div>;
}

function Panel({ eyebrow, title, icon, accent, children }: { eyebrow: string; title: string; icon: React.ReactNode; accent?: boolean; children: React.ReactNode }) {
  return <div className={`rounded-[2rem] border bg-white/[0.04] p-4 sm:p-6 ${accent ? "border-red-900/45" : "border-white/10"}`}><div className="mb-5 flex items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-950/35 text-red-400">{icon}</div><div className="min-w-0"><div className="text-xs font-black uppercase tracking-[0.2em] text-red-400">{eyebrow}</div><h2 className="mt-1 break-words text-2xl font-black">{title}</h2></div></div>{children}</div>;
}

function MetricValue({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-black/30 p-4"><div className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">{label}</div><div className="mt-2 text-2xl font-black">{value}</div></div>;
}

function CheckRow({ label, value, unknownLabel = "Not available" }: { label: string; value: boolean | null | undefined; unknownLabel?: string }) {
  const positive = value === true;
  const negative = value === false;
  return <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/25 px-4 py-3"><span className="font-bold text-zinc-300">{label}</span><span className={`inline-flex items-center gap-2 text-sm font-black ${positive ? "text-emerald-300" : negative ? "text-red-300" : "text-zinc-500"}`}>{positive ? <CheckCircle2 className="h-4 w-4" /> : negative ? <AlertTriangle className="h-4 w-4" /> : null}{positive ? "Passed" : negative ? "Conflict" : unknownLabel}</span></div>;
}
