"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, DatabaseZap, Loader2, ShieldAlert } from "lucide-react";
import { authenticatedFetch } from "@/lib/authGuards";

type BatchDetail = {
  batch: {
    id: string;
    source_name: string | null;
    source_type: string;
    status: string;
    total_files: number;
    candidate_pairs: number;
    duplicates: number;
    needs_review: number;
    warnings: string[];
    errors: string[];
    created_at: string;
  };
  files: Array<{
    id: string;
    filename: string;
    file_role_guess: string;
    file_extension: string;
    file_size: number;
    ecu_family_guess: string | null;
    ecu_type_guess: string | null;
    sw_number_guess: string | null;
    service_label_guess: string[];
    validation_status: string;
    privacy_status: string;
    warnings: string[];
    errors: string[];
  }>;
  pairs: Array<{
    id: string;
    pair_confidence: number;
    pairing_reasons: string[];
    file_size_relation: string;
    service_label_guess: string[];
    quality_score: number;
    quality_reasons: string[];
    learning_recommendation: string;
    review_status: string;
  }>;
  events: Array<{ id: string; action: string; notes: string | null; created_at: string }>;
  scanner_summary: {
    total_size_gb?: number;
    supported_files?: number;
    unsupported_files?: number;
    archive_candidates?: number;
    duplicate_files?: number;
    guessed_ori?: number;
    guessed_mod?: number;
    unknown_role?: number;
    warnings?: number;
    errors?: number;
  } | null;
  review_counts: Record<string, number>;
  stage1_readiness: Array<{
    group_key: string;
    readiness: string;
    confidence: number;
    stage1_evidence_count: number;
    high_quality_stage1_pair_count: number;
    missing_items: string[];
    next_recommended_action: string;
  }>;
  errors: string[];
};

export default function DatasetBatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [batchId, setBatchId] = useState("");
  const [detail, setDetail] = useState<BatchDetail | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void params.then((resolved) => setBatchId(resolved.id));
  }, [params]);

  const load = useCallback(async () => {
    if (!batchId) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await authenticatedFetch(`/api/admin/ai/datasets/${batchId}`);
      const data = await response.json();
      if (response.status === 401) {
        window.location.href = `/login?redirect=/admin/ai-training/datasets/${batchId}`;
        return;
      }
      if (!response.ok) throw new Error(data.error || "Dataset batch could not be loaded.");
      setDetail(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Dataset batch could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    const handle = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(handle);
  }, [load]);

  const updatePairStatus = useCallback(async (pairId: string, reviewStatus: "approved" | "needs_review" | "ready_for_human_label" | "rejected" | "excluded") => {
    const note = window.prompt("Review note:", `Marked ${reviewStatus.replaceAll("_", " ")}`);
    if (note === null) return;
    let actualLabels: Record<string, boolean> | undefined;
    if (reviewStatus === "approved") {
      const labels = window.prompt("Confirmed actual service labels, comma-separated (example: stage1,egr_off):", "");
      if (!labels) {
        setMessage("Actual service labels are required before approval.");
        return;
      }
      actualLabels = labels
        .split(",")
        .map((label) => label.trim())
        .filter(Boolean)
        .reduce<Record<string, boolean>>((record, label) => {
          record[label] = true;
          return record;
        }, {});
    }
    const response = await authenticatedFetch(`/api/admin/ai/datasets/pairs/${pairId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ review_status: reviewStatus, actual_service_labels: actualLabels, admin_notes: note }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "Pair review update failed.");
      return;
    }
    await load();
  }, [load]);

  return (
    <main className="mg-compact-ui min-h-screen bg-[#050505] text-white">
      <header className="border-b border-white/10 bg-black/80">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/admin/ai-training/datasets" className="inline-flex items-center text-sm font-bold text-zinc-500 hover:text-white">
              <ArrowLeft className="mr-2 h-4 w-4" /> Dataset workbench
            </Link>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-red-800/50 bg-red-950/25 text-red-400">
                <DatabaseZap className="h-6 w-6" />
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-red-500">Metadata batch</div>
                <h1 className="text-2xl font-black sm:text-3xl">{detail?.batch.source_name || batchId || "Loading"}</h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-7">
        <div className="rounded-lg border border-amber-700/30 bg-amber-950/15 p-3 text-sm text-amber-100/80">
          <ShieldAlert className="mr-2 inline h-4 w-4" />
          Admin-only metadata view. Raw binaries, hex previews, provider-private paths and customer-visible data are not returned here.
        </div>
        {message && <div className="rounded-lg border border-red-800/40 bg-red-950/20 p-3 text-sm text-red-100">{message}</div>}
        {loading && <div className="flex items-center gap-2 text-zinc-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading batch...</div>}
        {detail && (
          <>
            <div className="grid gap-3 sm:grid-cols-5">
              <Metric label="Files" value={detail.batch.total_files} />
              <Metric label="Pairs" value={detail.batch.candidate_pairs} />
              <Metric label="Duplicates" value={detail.batch.duplicates} tone="amber" />
              <Metric label="Needs review" value={detail.batch.needs_review} tone="amber" />
              <Metric label="Shown files" value={detail.files.length} />
            </div>
            <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-8">
              <Metric label="Total GB" value={detail.scanner_summary?.total_size_gb ?? 0} />
              <Metric label="Supported" value={detail.scanner_summary?.supported_files ?? 0} />
              <Metric label="Unsupported" value={detail.scanner_summary?.unsupported_files ?? 0} tone="amber" />
              <Metric label="Archives" value={detail.scanner_summary?.archive_candidates ?? 0} tone="amber" />
              <Metric label="Approved" value={detail.review_counts.approved ?? 0} />
              <Metric label="Rejected" value={detail.review_counts.rejected ?? 0} tone="amber" />
              <Metric label="Excluded" value={detail.review_counts.excluded ?? 0} tone="amber" />
              <Metric label="Unknown role" value={detail.scanner_summary?.unknown_role ?? 0} tone="amber" />
            </div>

            <section className="rounded-lg border border-white/10 bg-white/[0.025] p-4">
              <h2 className="text-lg font-black">Stage 1 readiness</h2>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {detail.stage1_readiness.map((item) => (
                  <div key={item.group_key} className="rounded-lg border border-white/10 bg-black/30 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-black">{item.group_key}</div>
                      <Badge value={item.readiness} />
                    </div>
                    <div className="mt-2 text-xs text-zinc-500">
                      Confidence {item.confidence}/100 / Evidence {item.stage1_evidence_count} / High quality {item.high_quality_stage1_pair_count}
                    </div>
                    <div className="mt-3 text-xs text-zinc-400">Missing: {item.missing_items.join(", ") || "none"}</div>
                    <div className="mt-2 text-sm text-zinc-300">{item.next_recommended_action}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-white/10 bg-white/[0.025] p-4">
              <h2 className="text-lg font-black">Pair candidates</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[880px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-[0.12em] text-zinc-500">
                    <tr><th className="py-2">Confidence</th><th>Quality</th><th>Status</th><th>Labels</th><th>Reasons</th><th>Review</th></tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {detail.pairs.map((pair) => (
                      <tr key={pair.id}>
                        <td className="py-3 font-black">{pair.pair_confidence}/100</td>
                        <td>{pair.quality_score}/100</td>
                        <td><Badge value={pair.review_status} /></td>
                        <td>{pair.service_label_guess.join(", ") || "-"}</td>
                        <td className="max-w-[420px] text-xs text-zinc-400">{pair.pairing_reasons.join(" / ")}</td>
                        <td>
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => void updatePairStatus(pair.id, "ready_for_human_label")} className="rounded-md border border-emerald-700/40 px-2 py-1 text-xs font-black text-emerald-300">Ready</button>
                            <button onClick={() => void updatePairStatus(pair.id, "approved")} className="rounded-md border border-emerald-700/40 bg-emerald-950/20 px-2 py-1 text-xs font-black text-emerald-200">Approve pair</button>
                            <button onClick={() => void updatePairStatus(pair.id, "needs_review")} className="rounded-md border border-amber-700/40 px-2 py-1 text-xs font-black text-amber-300">Review</button>
                            <button onClick={() => void updatePairStatus(pair.id, "rejected")} className="rounded-md border border-red-700/40 px-2 py-1 text-xs font-black text-red-300">Reject</button>
                            <button onClick={() => void updatePairStatus(pair.id, "excluded")} className="rounded-md border border-zinc-700 px-2 py-1 text-xs font-black text-zinc-300">Exclude</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!detail.pairs.length && <div className="py-6 text-sm text-zinc-500">No pair candidates in this batch.</div>}
              </div>
            </section>

            <section className="rounded-lg border border-white/10 bg-white/[0.025] p-4">
              <h2 className="text-lg font-black">File candidates</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-[0.12em] text-zinc-500">
                    <tr><th className="py-2">Filename</th><th>Role</th><th>Ext</th><th>Size</th><th>ECU</th><th>Labels</th><th>Status</th></tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {detail.files.map((file) => (
                      <tr key={file.id}>
                        <td className="max-w-[300px] truncate py-3 font-bold">{file.filename}</td>
                        <td>{file.file_role_guess}</td>
                        <td>{file.file_extension}</td>
                        <td>{file.file_size}</td>
                        <td>{file.ecu_type_guess || file.ecu_family_guess || "-"}</td>
                        <td>{file.service_label_guess.join(", ") || "-"}</td>
                        <td><Badge value={file.validation_status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-lg border border-white/10 bg-white/[0.025] p-4">
              <h2 className="text-lg font-black">Review events</h2>
              <div className="mt-4 space-y-3">
                {detail.events.map((event) => (
                  <div key={event.id} className="rounded-lg border border-white/10 bg-black/30 p-3">
                    <div className="font-black">{event.action}</div>
                    <div className="mt-1 text-xs text-zinc-500">{new Date(event.created_at).toLocaleString()}</div>
                    {event.notes && <p className="mt-2 text-sm text-zinc-300">{event.notes}</p>}
                  </div>
                ))}
                {!detail.events.length && <div className="text-sm text-zinc-500">No events yet.</div>}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Metric({ label, value, tone = "red" }: { label: string; value: number; tone?: "red" | "amber" }) {
  const color = tone === "amber" ? "text-amber-300" : "text-red-300";
  return <div className="rounded-lg border border-white/10 bg-white/[0.025] p-4"><div className={`text-3xl font-black ${color}`}>{value}</div><div className="mt-1 text-xs font-bold text-zinc-500">{label}</div></div>;
}

function Badge({ value }: { value: string }) {
  return <span className="inline-flex rounded-md border border-red-700/40 bg-red-950/25 px-2 py-1 text-xs font-black uppercase text-red-300">{value.replaceAll("_", " ")}</span>;
}
