"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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
  Database,
  FileCode2,
  Gauge,
  Loader2,
  Network,
  RefreshCcw,
  ScanSearch,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { CustomerPortalPageHeader } from "@/components/dashboard/CustomerPortalPageHeader";
import { authenticatedFetch, getStableSession, notifySessionRequired, signOutIfEmailUnverified } from "@/lib/authGuards";
import type {
  FileExpertAnalyzerResult,
  FileExpertFinding,
  FileExpertJob,
} from "@/lib/fileExpert/types";
import type {
  PublicSimilarityEvidence,
  SimilaritySearchResult,
} from "@/lib/ecuIntelligence/similarity";
import type {
  AdminClusterEvidence,
  PublicClusterEvidence,
} from "@/lib/ecuIntelligence/clustering";
import {
  localizeFileExpertDetection,
  localizeFileExpertReadiness,
  localizeFileExpertReview,
  localizeFileExpertStatus,
} from "@/lib/i18n/customer-runtime-translations";
import {
  fileExpertReportT,
  localizeFileExpertAnalyzerEvidence,
  localizeFileExpertChangeProfile,
  localizeFileExpertClusterMessage,
  localizeFileExpertConclusion,
  localizeFileExpertFeatureLabel,
  localizeFileExpertFeatureReason,
  localizeFileExpertFileProfile,
  localizeFileExpertFinding,
  localizeFileExpertIntegrityIssue,
  localizeFileExpertReadScope,
  localizeFileExpertSimilarityMessage,
  localizeFileExpertVehicleCandidateEvidence,
  localizeFileExpertVehicleSummary,
  type FileExpertReportTranslationKey,
} from "@/lib/i18n/file-expert-report-translations";
import { customerWorkflowExactT } from "@/lib/i18n/customer-workflow-file-expert-translations";
import { intlLocaleByCode, type LocaleCode } from "@/lib/i18nConfig";
import { useActiveLocale } from "@/lib/useActiveLocale";

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

function formatDate(value: string, locale: LocaleCode) {
  return new Intl.DateTimeFormat(intlLocaleByCode[locale], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatBytes(value: number | string | null | undefined, locale: LocaleCode) {
  if (!value) return "-";
  const bytes = Number(value);
  if (bytes >= 1024 * 1024) return `${new Intl.NumberFormat(intlLocaleByCode[locale], { maximumFractionDigits: 2 }).format(bytes / 1024 / 1024)} MB`;
  return `${new Intl.NumberFormat(intlLocaleByCode[locale], { maximumFractionDigits: 1 }).format(bytes / 1024)} KB`;
}

function idValue(values: string[] | undefined, locale: LocaleCode) {
  return values?.length ? values.join(", ") : fileExpertReportT(locale, "notDetected");
}

const reportMessageKeys = {
  loadError: "reportLoadError",
  analysisError: "analysisTriggerError",
} as const satisfies Record<string, FileExpertReportTranslationKey>;

export default function FileExpertReportPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const locale = useActiveLocale();
  const jobId = params.id;
  const [job, setJob] = useState<FileExpertJob | null>(null);
  const [similarityEvidence, setSimilarityEvidence] = useState<PublicSimilarityEvidence | SimilaritySearchResult | null>(null);
  const [clusterEvidence, setClusterEvidence] = useState<PublicClusterEvidence | AdminClusterEvidence | null>(null);
  const [loading, setLoading] = useState(true);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [messageKey, setMessageKey] = useState<FileExpertReportTranslationKey | "">("");
  const hasLoadedJobRef = useRef(false);

  async function loadJob(options?: { silent?: boolean }) {
    if (!options?.silent) setLoading(true);
    if (!options?.silent) setMessageKey("");

    const user = (await getStableSession()).session?.user;
    if (!user) {
      if (!options?.silent) notifySessionRequired();
      setLoading(false);
      return;
    }
    if (await signOutIfEmailUnverified(user)) {
      router.push("/login?verify_email=1");
      return;
    }

    const response = await authenticatedFetch(`/api/file-expert/jobs/${jobId}`, {
      cache: "no-store",
    });
    const payload = await response.json();

    if (!response.ok) {
      if (!options?.silent || !hasLoadedJobRef.current) {
        setMessageKey(reportMessageKeys.loadError);
      }
      setLoading(false);
      return;
    }

    setJob(payload.job);
    setSimilarityEvidence(payload.similarityEvidence ?? null);
    setClusterEvidence(payload.clusterEvidence ?? null);
    hasLoadedJobRef.current = true;
    setMessageKey("");
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
  const reportTitle = submittedVehicle || identity?.display_name || fileExpertReportT(locale, "notIdentified");
  const visibleMarkerIds = identity?.engine_codes ?? [];
  const vehicleTarget = identity?.variant || identity?.family;
  const localizedChangeProfile = localizeFileExpertChangeProfile(locale, changeProfile);
  const similaritySummary = similarityEvidence && "summary" in similarityEvidence
    ? {
        matchesFound: similarityEvidence.summary.matches_found,
        bestScore: similarityEvidence.summary.best_score,
        confidence: similarityEvidence.summary.confidence,
      }
    : similarityEvidence;
  const similarityMessage = localizeFileExpertSimilarityMessage(locale, similaritySummary);

  const fileCards = useMemo(
    () => [
      { label: "ORI", name: job?.ori_file_name, size: job?.ori_file_size, profile: result?.files.ori },
      { label: "MOD", name: job?.mod_file_name, size: job?.mod_file_size, profile: result?.files.mod },
    ],
    [job, result]
  );

  async function reanalyze() {
    setReanalyzing(true);
    setMessageKey("");
    const response = await authenticatedFetch(`/api/file-expert/jobs/${jobId}/analyze`, {
      method: "POST",
    });
    setReanalyzing(false);
    if (!response.ok) {
      setMessageKey(reportMessageKeys.analysisError);
      await loadJob({ silent: true });
      return;
    }
    await loadJob({ silent: true });
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
        <div className="text-center">
          <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-red-600" />
          <p className="text-sm text-zinc-400" translate="no" data-no-translate>{fileExpertReportT(locale, "loadingReport")}</p>
        </div>
      </main>
    );
  }

  if (!job) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] px-4 text-white">
        <div className="max-w-md rounded-3xl border border-red-800/40 bg-red-950/20 p-6 text-center">
          <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-red-400" />
          <h1 className="text-2xl font-black" translate="no" data-no-translate>{fileExpertReportT(locale, "reportNotFound")}</h1>
          <p className="mt-3 text-sm text-zinc-400" translate="no" data-no-translate>
            {messageKey ? fileExpertReportT(locale, messageKey) : fileExpertReportT(locale, "reportUnavailable")}
          </p>
          <Link href="/dashboard/file-expert" className="mt-6 inline-flex rounded-xl bg-[#b1121b] px-5 py-3 font-black text-white">
            Back to File Expert
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mg-compact-ui min-h-screen overflow-x-hidden bg-[#050505] text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_20%_0%,rgba(160,18,28,0.22),transparent_32%),linear-gradient(135deg,#050505,#0d0d0f_48%,#160608)]" />

      <CustomerPortalPageHeader
        eyebrow="AI File Expert"
        title="Analysis report"
        icon={BrainCircuit}
        actions={
          <Link
            href="/dashboard/file-expert"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-white/10 px-3 text-xs font-black text-white transition hover:bg-white/[0.06] sm:px-4 sm:text-sm"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Analyses
          </Link>
        }
      />

      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="mb-6 flex flex-col gap-5 border-b border-white/10 pb-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(job.status)}`}>{localizeFileExpertStatus(locale, job.status)}</span>
              <span className={`rounded-full border px-3 py-1 text-xs font-black ${riskClass(job.risk_level)}`}>{localizeFileExpertReview(locale, job.risk_level)}</span>
              {identity && (
              <span className="rounded-full border border-red-800/40 bg-red-950/25 px-3 py-1 text-xs font-black text-red-200">
                  ECU: {localizeFileExpertDetection(locale, identity.status)}
              </span>
              )}
            </div>
            <h1 className="mt-3 break-words text-4xl font-black md:text-5xl"><span translate="no" data-no-translate>{reportTitle}</span></h1>
            <p className="mt-3 max-w-4xl text-sm leading-7 text-zinc-400" translate="no" data-no-translate>
              {localizeFileExpertConclusion(locale, result)}
            </p>
            <p className="mt-2 text-xs font-bold text-zinc-600">Analysis <span translate="no" data-no-translate>{result?.analysis_version || fileExpertReportT(locale, "versionLegacy")}</span> / {formatDate(job.created_at, locale)}</p>
          </div>
          <div className="grid gap-2 sm:flex sm:flex-wrap">
            <button onClick={reanalyze} disabled={reanalyzing} className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black transition hover:bg-white/10 disabled:opacity-50">
              {reanalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />} Re-analyze
            </button>
          </div>
        </section>

        {messageKey && <div className="mb-6 rounded-2xl border border-red-800/40 bg-red-950/30 p-4 text-sm font-bold text-red-200" translate="no" data-no-translate>{fileExpertReportT(locale, messageKey)}</div>}

        {job.status === "failed" && (
          <div className="mb-6 rounded-2xl border border-red-700/40 bg-red-950/20 p-5">
            <div className="flex items-center gap-3 font-black text-red-200"><AlertTriangle className="h-5 w-5" />Analysis failed</div>
            <p className="mt-2 text-sm leading-6 text-zinc-400" translate="no" data-no-translate>{fileExpertReportT(locale, "reportUnavailable")}</p>
            <button onClick={reanalyze} disabled={reanalyzing} className="mt-4 inline-flex h-10 items-center rounded-xl border border-red-700/40 px-4 text-sm font-black text-red-100 disabled:opacity-50">Try analysis again</button>
          </div>
        )}

        <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm leading-6 text-zinc-300">
          <strong className="text-white">{result?.mode === "ori_mod_compare" ? "ORI + MOD comparison" : "Single-file inspection"}</strong>
          <span className="text-zinc-500"> - </span>
          {result?.mode === "ori_mod_compare"
            ? "Both files were compared and summarized for technician review. Detailed binary internals stay inside the protected admin workflow."
            : "Only one file is available. The system can inspect structure and ECU markers, but it cannot confirm modifications without a matching ORI/MOD pair."}
        </div>

        {!identity && result && (
          <div className="mb-6 rounded-2xl border border-amber-700/30 bg-amber-950/15 p-4 text-sm leading-6 text-amber-100/80">
            This is a legacy report. Select <strong>Re-analyze</strong> to generate automatic ECU identification and the V2 workshop report.
          </div>
        )}

        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <InfoCard title="Control unit" value={identity?.display_name || job.ecu_type || fileExpertReportT(locale, "notIdentified")} icon={<Cpu />} rawValue={Boolean(identity?.display_name || job.ecu_type)} />
          <InfoCard title="Module / supplier" value={[identity?.module_type, identity?.supplier].filter(Boolean).join(" / ") || fileExpertReportT(locale, "unknown")} icon={<Database />} rawValue={Boolean(identity?.module_type || identity?.supplier)} />
          <InfoCard title="File profile" value={localizeFileExpertFileProfile(locale, primaryFile?.file_format, primaryFile?.read_scope)} icon={<FileCode2 />} protectedValue />
          <InfoCard title="Report state" value={localizeFileExpertStatus(locale, job.status)} icon={<Gauge />} />
        </div>

        <section className="mb-6 grid gap-6 rounded-[2rem] border border-red-900/45 bg-white/[0.04] p-4 sm:p-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.22em] text-red-400">Automatic identification</div>
                <h2 className="mt-2 break-words text-3xl font-black">
                  {identity?.display_name
                    ? <span translate="no" data-no-translate>{identity.display_name}</span>
                    : fileExpertReportT(locale, "notIdentified")}
                </h2>
              </div>
              <span className={`rounded-full border px-3 py-1.5 text-xs font-black ${identity?.status === "detected" ? statusClass("completed") : statusClass("pending")}`}>
                {localizeFileExpertDetection(locale, identity?.status)}
              </span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <IdentityField label="Supplier" value={identity?.supplier} locale={locale} />
              <IdentityField label="Family" value={identity?.family} locale={locale} />
              <IdentityField label="Variant" value={identity?.variant} locale={locale} />
              <IdentityField label="Module" value={identity?.module_type} locale={locale} />
              <IdentityField label="Processor" value={identity?.processor} locale={locale} />
              <IdentityField label="Read scope" value={localizeFileExpertReadScope(locale, primaryFile?.read_scope)} locale={locale} />
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Detection evidence</div>
              <div className="mt-3 space-y-2 text-sm leading-6 text-zinc-300">
                {identity?.evidence.length ? identity.evidence.map((item) => (
                  <div key={item} translate="no" data-no-translate>- {localizeFileExpertAnalyzerEvidence(locale, item)}</div>
                )) : <div translate="no" data-no-translate>{fileExpertReportT(locale, "findingIdentityMissing")}</div>}
              </div>
            </div>
          </div>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <IdentifierBox label="Hardware numbers" value={idValue(identity?.hardware_numbers, locale)} />
            <IdentifierBox label="Software numbers" value={idValue(identity?.software_numbers, locale)} />
            <IdentifierBox label="Calibration IDs" value={idValue(identity?.calibration_ids, locale)} />
            {visibleMarkerIds.length ? <IdentifierBox label="Vehicle markers" value={visibleMarkerIds.join(" / ")} /> : null}
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <section className="min-w-0 space-y-6">
            <Panel eyebrow="Workshop findings" title="What the analysis found" icon={<ScanSearch />}>
              <div className="space-y-3">
                {findings.length ? findings.map((finding) => {
                  const localizedFinding = localizeFileExpertFinding(locale, finding, {
                    fileFormat: primaryFile?.file_format,
                    readScope: primaryFile?.read_scope,
                    changeProfile,
                    identificationStatus: identity?.status,
                    identificationModule: identity?.module_type,
                    mapCandidateCount: result?.map_candidates.length,
                    integrity,
                    vehicleMatch,
                    vehicleTarget,
                  });
                  return (
                    <div key={finding.id} className={`rounded-2xl border p-4 ${findingClass(finding.severity)}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="font-black" translate="no" data-no-translate>{localizedFinding.title}</div>
                        <span className="rounded-full bg-black/35 px-3 py-1 text-xs font-black text-zinc-300">
                          {customerWorkflowExactT(locale, "Review required")}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-zinc-300" translate="no" data-no-translate>{localizedFinding.summary}</p>
                    </div>
                  );
                }) : (
                  <p className="rounded-2xl border border-dashed border-white/15 bg-black/25 p-5 text-sm leading-6 text-zinc-400">
                    Re-analyze this report to generate workshop-friendly V2 findings.
                  </p>
                )}
              </div>
            </Panel>

            <Panel eyebrow="Vehicle application" title="Possible vehicle matches" icon={<CarFront />}>
              <p className="mb-4 text-sm leading-6 text-zinc-400" translate="no" data-no-translate>
                {localizeFileExpertVehicleSummary(locale, vehicleMatch, vehicleTarget)}
              </p>
              {vehicleMatch?.candidates.length ? (
                <div className="space-y-3">
                  {vehicleMatch.candidates.map((candidate) => (
                    <div key={`${candidate.brand}-${candidate.model}-${candidate.generation}-${candidate.engine}`} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-black"><span translate="no" data-no-translate>{candidate.brand}</span>{" "}<span translate="no" data-no-translate>{candidate.model}</span></div>
                          <div className="mt-1 text-sm text-zinc-400"><span translate="no" data-no-translate>{candidate.generation}</span> / <span translate="no" data-no-translate>{candidate.engine}</span></div>
                          <div className="mt-2 text-xs font-bold text-red-200" translate="no" data-no-translate>{candidate.ecu}</div>
                          <div className="mt-2 text-xs leading-5 text-zinc-500">
                            {localizeFileExpertVehicleCandidateEvidence(locale, candidate)}
                          </div>
                        </div>
                        <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-black">Possible</span>
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
                      <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-black text-zinc-400">{formatBytes(file.size, locale)}</span>
                    </div>
                    <div className="mt-3 break-all text-sm font-bold">{file.name ? <span translate="no" data-no-translate>{file.name}</span> : <span translate="no" data-no-translate>{fileExpertReportT(locale, "notUploaded")}</span>}</div>
                    <div className="mt-2 text-xs text-zinc-500" translate="no" data-no-translate>{localizeFileExpertFileProfile(locale, file.profile?.file_format, file.profile?.read_scope)}</div>
                  </div>
                ))}
              </div>
            </Panel>
          </section>

          <section className="min-w-0 space-y-6">
            <Panel eyebrow="ORI / MOD assessment" title={localizedChangeProfile.label} icon={<BrainCircuit />} accent>
              <p className="text-sm leading-7 text-zinc-300" translate="no" data-no-translate>{localizedChangeProfile.summary}</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <MetricValue label="Changed bytes" value={result?.comparison?.changed_bytes.toLocaleString(intlLocaleByCode[locale]) || "-"} />
                <MetricValue label="Affected area" value={result?.comparison ? `${result.comparison.changed_percent}%` : "-"} />
                <MetricValue label="Change groups" value={result?.comparison?.merged_changed_blocks.toLocaleString(intlLocaleByCode[locale]) || "-"} />
              </div>
            </Panel>

            <Panel eyebrow="Operation indicators" title="Possible modifications" icon={<Wrench />}>
              {result?.possible_features?.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {result.possible_features.map((feature) => (
                    <div key={feature.feature} className="rounded-2xl border border-red-900/35 bg-red-950/15 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-black" translate="no" data-no-translate>{localizeFileExpertFeatureLabel(locale, feature.feature)}</div>
                        <span className="rounded-full bg-black/35 px-3 py-1 text-xs font-black text-red-200">Possible</span>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-zinc-400" translate="no" data-no-translate>{localizeFileExpertFeatureReason(locale, feature)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/15 bg-black/25 p-5 text-sm leading-6 text-zinc-400">
                  No specific operation can be named safely from this file. This does not mean the file is stock.
                </div>
              )}
            </Panel>

            <Panel eyebrow="Approved evidence" title="Similar learning patterns" icon={<Network />}>
              {similaritySummary ? (
                <div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <MetricValue label="Approved matches" value={String(similaritySummary.matchesFound)} />
                    <MetricValue label="Evidence status" value={similaritySummary.matchesFound ? "Available" : "Limited"} />
                    <MetricValue label="Review state" value="Human required" />
                  </div>
                  <p className="mt-4 text-sm leading-7 text-zinc-400" translate="no" data-no-translate>{similarityMessage}</p>
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-white/15 bg-black/25 p-5 text-sm leading-6 text-zinc-400" translate="no" data-no-translate>{localizeFileExpertSimilarityMessage(locale, null)}</p>
              )}
            </Panel>

            <Panel eyebrow="Level 2 evidence" title="Pattern cluster confidence" icon={<Database />}>
              {clusterEvidence ? (
                <div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <MetricValue label="Matching clusters" value={String(clusterEvidence.matchingClusters)} />
                    <MetricValue label="Best readiness" value={localizeFileExpertReadiness(locale, clusterEvidence.bestStatus)} />
                    <MetricValue label="Verification" value="Required" />
                  </div>
                  <p className="mt-4 text-sm leading-7 text-zinc-400" translate="no" data-no-translate>{localizeFileExpertClusterMessage(locale, clusterEvidence)}</p>
                  <div className="mt-3 rounded-2xl border border-amber-700/30 bg-amber-950/10 p-4 text-xs leading-6 text-amber-100/75">This is evidence only. Human tuner verification and checksum verification are required before any real write.</div>
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-white/15 bg-black/25 p-5 text-sm leading-6 text-zinc-400" translate="no" data-no-translate>{localizeFileExpertClusterMessage(locale, null)}</p>
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
                <div className="mt-4 rounded-2xl border border-red-800/40 bg-red-950/20 p-4 text-sm leading-6 text-red-100" translate="no" data-no-translate>{integrity.issues.map((issue) => localizeFileExpertIntegrityIssue(locale, issue)).join(" ")}</div>
              ) : null}
            </Panel>

            <details className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 sm:p-6">
              <summary className="flex cursor-pointer list-none items-center gap-3 text-lg font-black">
                <ShieldCheck className="h-5 w-5 text-red-400" /> Technical details
              </summary>
              <div className="mt-5 space-y-5">
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm leading-6 text-zinc-400">
                  Technical coordinate data, private file fingerprints and binary internals are hidden on customer reports. MG AutoTech keeps those details inside the protected admin review workflow.
                </div>
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

function InfoCard({ title, value, icon, rawValue = false, protectedValue = false }: { title: string; value: string; icon: React.ReactNode; rawValue?: boolean; protectedValue?: boolean }) {
  const protect = rawValue || protectedValue;
  return <div className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.04] p-5"><div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-red-950/35 text-red-400">{icon}</div><div className="text-sm text-zinc-400">{title}</div><div className="mt-1 break-words text-xl font-black" translate={protect ? "no" : undefined} data-no-translate={protect ? true : undefined}>{value}</div></div>;
}

function IdentityField({ label, value, locale }: { label: string; value: string | null | undefined; locale: LocaleCode }) {
  return <div className="rounded-2xl border border-white/10 bg-black/25 p-4"><div className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">{label}</div><div className="mt-2 break-words font-black"><span translate="no" data-no-translate>{value || fileExpertReportT(locale, "notDetected")}</span></div></div>;
}

function IdentifierBox({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-2xl border border-white/10 bg-black/30 p-4"><div className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">{label}</div><div className="mt-2 break-all text-sm font-bold leading-6 text-zinc-200" translate="no" data-no-translate>{value}</div></div>;
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
