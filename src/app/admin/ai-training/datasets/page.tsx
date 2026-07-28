"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, DatabaseZap, FileUp, Loader2, PlayCircle, RefreshCw, ShieldAlert } from "lucide-react";
import { authenticatedFetch } from "@/lib/authGuards";

type DryRunPair = {
  id: string;
  pair_confidence: number;
  pairing_reasons: string[];
  service_label_guess: string[];
  quality_score: number;
  learning_recommendation: string;
  review_status: string;
};

type DryRunResult = {
  batch: {
    total_files: number;
    candidate_pairs: number;
    duplicates: number;
    needs_review: number;
  };
  pairs: DryRunPair[];
  duplicate_files: Array<{ filename: string }>;
  unmatched_ori: Array<{ filename: string }>;
  unmatched_mod: Array<{ filename: string }>;
  unknown_files: Array<{ filename: string }>;
  warnings: string[];
  errors: string[];
  persisted: boolean;
  scanner_summary?: {
    total_files: number;
    total_size_gb: number;
    supported_files: number;
    unsupported_files: number;
    duplicate_files: number;
    archive_candidates: number;
  };
  rejected_lines?: Array<{ line: number; error: string }>;
};

type DatasetBatch = {
  id: string;
  source_name: string | null;
  source_type: string;
  status: string;
  total_files: number;
  candidate_pairs: number;
  duplicates: number;
  needs_review: number;
  created_at: string;
  scanner_summary?: DryRunResult["scanner_summary"] & {
    total_size_bytes?: number;
    guessed_ori?: number;
    guessed_mod?: number;
    unknown_role?: number;
    warnings?: number;
    errors?: number;
    service_label_distribution?: Record<string, number>;
  } | null;
  review_counts?: Record<string, number>;
};

const exampleFiles = [
  { folder: "BMW_EDC17C50_530d", filename: "BMW_530d_EDC17C50_ORI.bin", fileSize: 2097152, providerMetadata: { ecu_family: "EDC17", ecu_type: "Bosch EDC17C50", sw_number: "SW1037550001" } },
  { folder: "BMW_EDC17C50_530d", filename: "BMW_530d_EDC17C50_Stage1_MOD.bin", fileSize: 2097152, providerMetadata: { ecu_family: "EDC17", ecu_type: "Bosch EDC17C50", sw_number: "SW1037550001" } },
  { folder: "VW_EDC17_DPF", filename: "VW_Golf_2.0TDI_original.ori", fileSize: 4096 },
  { folder: "VW_EDC17_DPF", filename: "VW_Golf_2.0TDI_DPF_EGR_OFF.mod", fileSize: 4096 },
  { folder: "ambiguous", filename: "random_readme.txt", fileSize: 1200 },
];

export default function DatasetWorkbenchPage() {
  const [payload, setPayload] = useState(JSON.stringify({ sourceType: "manual_upload", sourceName: "Local metadata dry-run", files: exampleFiles }, null, 2));
  const [scannerPayload, setScannerPayload] = useState("");
  const [result, setResult] = useState<DryRunResult | null>(null);
  const [importResult, setImportResult] = useState<{
    batch_id: string;
    created: { file_candidates: number; pair_candidates: number; training_samples: number; approved_learning_samples: number };
    scanner_summary: NonNullable<DryRunResult["scanner_summary"]>;
    message: string;
  } | null>(null);
  const [batches, setBatches] = useState<DatasetBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");

  const loadBatches = useCallback(async () => {
    const response = await authenticatedFetch("/api/admin/ai/datasets");
    const data = await response.json();
    if (response.ok) setBatches(Array.isArray(data.batches) ? data.batches : []);
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => void loadBatches(), 0);
    return () => window.clearTimeout(handle);
  }, [loadBatches]);

  const runDryRun = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await authenticatedFetch("/api/admin/ai/datasets/dry-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Dataset dry-run failed.");
      setResult(data as DryRunResult);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Dataset dry-run failed.");
    } finally {
      setLoading(false);
    }
  }, [payload]);

  const importScannerMetadata = useCallback(async () => {
    setImporting(true);
    setMessage("");
    setImportResult(null);
    try {
      const response = await authenticatedFetch("/api/admin/ai/datasets/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonl: scannerPayload,
          sourceType: "local_dev_archive",
          sourceName: "Local scanner JSONL metadata",
          sourceReference: "local-scanner-jsonl",
          persist: true,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Scanner metadata import failed.");
      setImportResult(data);
      await loadBatches();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Scanner metadata import failed.");
    } finally {
      setImporting(false);
    }
  }, [loadBatches, scannerPayload]);

  const summary = useMemo(() => result?.batch ?? null, [result]);

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
                <DatabaseZap className="h-6 w-6" />
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-red-500">Dataset workbench</div>
                <h1 className="text-2xl font-black sm:text-3xl">Bulk ORI/MOD dry-run importer</h1>
              </div>
            </div>
          </div>
          <button onClick={() => void runDryRun()} disabled={loading} className="inline-flex h-11 items-center justify-center rounded-lg bg-[#b1121b] px-4 text-sm font-black hover:bg-[#c91824] disabled:opacity-50">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
            Run dry-run
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-5 px-4 py-7 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="rounded-lg border border-white/10 bg-white/[0.025] p-4">
          <div className="mb-4 rounded-lg border border-amber-700/30 bg-amber-950/15 p-3 text-sm text-amber-100/80">
            <ShieldAlert className="mr-2 inline h-4 w-4" />
            Metadata dry-run only. No production files are read, no storage objects are created and no training samples are approved.
          </div>
          {message && <div className="mb-4 rounded-lg border border-red-800/40 bg-red-950/20 p-3 text-sm text-red-100">{message}</div>}
          <label className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Dry-run JSON</label>
          <textarea value={payload} onChange={(event) => setPayload(event.target.value)} className="mt-3 h-[560px] w-full rounded-lg border border-white/10 bg-black/50 p-4 font-mono text-xs leading-5 text-zinc-200 outline-none focus:border-red-700" />
        </section>

        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <Metric label="Files" value={summary?.total_files ?? 0} />
            <Metric label="Pairs" value={summary?.candidate_pairs ?? 0} />
            <Metric label="Duplicates" value={summary?.duplicates ?? 0} tone="amber" />
            <Metric label="Needs review" value={summary?.needs_review ?? 0} tone="amber" />
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.025] p-4">
            <h2 className="text-lg font-black">Pair candidates</h2>
            <div className="mt-4 space-y-3">
              {(result?.pairs ?? []).map((pair) => (
                <div key={pair.id} className="rounded-lg border border-white/10 bg-black/30 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-black">{pair.pair_confidence}/100 pair confidence</div>
                    <Badge value={pair.review_status} />
                  </div>
                  <div className="mt-2 text-xs text-zinc-500">Quality {pair.quality_score}/100 / {pair.learning_recommendation}</div>
                  <div className="mt-3 flex flex-wrap gap-2">{pair.service_label_guess.map((label) => <Badge key={label} value={label} tone="green" />)}</div>
                  <ul className="mt-3 space-y-1 text-xs text-zinc-400">{pair.pairing_reasons.map((reason) => <li key={reason}>- {reason}</li>)}</ul>
                </div>
              ))}
              {result && !result.pairs.length && <div className="text-sm text-zinc-500">No pair candidates found.</div>}
              {!result && <div className="text-sm text-zinc-500">Run a dry-run to preview candidate pairs.</div>}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.025] p-4">
            <h2 className="text-lg font-black">Warnings</h2>
            <ul className="mt-3 space-y-2 text-sm text-zinc-400">
              {(result?.warnings ?? []).slice(0, 20).map((warning) => <li key={warning}>- {warning}</li>)}
              {result && !result.warnings.length && <li>No warnings.</li>}
            </ul>
          </div>
        </section>
      </div>

      <div className="mx-auto grid max-w-[1500px] gap-5 px-4 pb-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="rounded-lg border border-white/10 bg-white/[0.025] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.16em] text-red-500">Scanner metadata import</div>
              <h2 className="mt-1 text-lg font-black">JSONL review-batch intake</h2>
            </div>
            <button onClick={() => void importScannerMetadata()} disabled={importing || scannerPayload.trim().length === 0} className="inline-flex h-10 items-center rounded-lg bg-[#b1121b] px-4 text-sm font-black hover:bg-[#c91824] disabled:opacity-50">
              {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
              Import metadata
            </button>
          </div>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Paste output from <code className="rounded bg-black/40 px-1">scripts/scan-ai-dataset.mjs</code>. Only metadata is stored in Supabase. Raw files stay local/offline.
          </p>
          <input
            type="file"
            accept=".jsonl,.txt,application/jsonl,text/plain"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void file.text().then(setScannerPayload);
            }}
            className="mt-4 block w-full rounded-lg border border-white/10 bg-black/50 p-3 text-sm text-zinc-300"
          />
          <textarea value={scannerPayload} onChange={(event) => setScannerPayload(event.target.value)} placeholder='{"relative_path":"BMW/ORI.bin","filename":"ORI.bin","file_size":2048,"sha256":"..."}' className="mt-3 h-[320px] w-full rounded-lg border border-white/10 bg-black/50 p-4 font-mono text-xs leading-5 text-zinc-200 outline-none focus:border-red-700" />
          {importResult && (
            <div className="mt-4 rounded-lg border border-emerald-800/30 bg-emerald-950/15 p-4 text-sm text-emerald-100">
              <div className="font-black">Batch created: {importResult.batch_id}</div>
              <div className="mt-2 grid gap-2 sm:grid-cols-4">
                <Metric label="Files" value={importResult.created.file_candidates} />
                <Metric label="Pairs" value={importResult.created.pair_candidates} />
                <Metric label="Training samples" value={importResult.created.training_samples} tone="amber" />
                <Metric label="Approved" value={importResult.created.approved_learning_samples} tone="amber" />
              </div>
              <p className="mt-3 text-emerald-100/80">{importResult.message}</p>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.025] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-black">Recent metadata batches</h2>
            <button onClick={() => void loadBatches()} className="inline-flex h-9 items-center rounded-lg border border-white/10 px-3 text-xs font-black text-zinc-300 hover:border-red-700/50 hover:text-white">
              <RefreshCw className="mr-2 h-3.5 w-3.5" /> Refresh
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {batches.map((batch) => (
              <Link key={batch.id} href={`/admin/ai-training/datasets/${batch.id}`} className="block rounded-lg border border-white/10 bg-black/30 p-3 hover:border-red-700/50">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-black">{batch.source_name || batch.source_type}</div>
                  <Badge value={batch.status} />
                </div>
                <div className="mt-2 grid gap-2 text-xs text-zinc-400 sm:grid-cols-4">
                  <span>{batch.total_files} files</span>
                  <span>{batch.scanner_summary?.total_size_gb ?? 0} GB</span>
                  <span>{batch.candidate_pairs} pairs</span>
                  <span>{batch.duplicates} duplicates</span>
                  <span>{batch.needs_review} review</span>
                  <span>{batch.scanner_summary?.supported_files ?? 0} supported</span>
                  <span>{batch.scanner_summary?.unsupported_files ?? 0} unsupported</span>
                  <span>{batch.scanner_summary?.archive_candidates ?? 0} archives</span>
                  <span>{batch.scanner_summary?.service_label_distribution?.stage1 ?? 0} Stage 1 hints</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge value={`approved ${batch.review_counts?.approved ?? 0}`} tone="green" />
                  <Badge value={`rejected ${batch.review_counts?.rejected ?? 0}`} />
                  <Badge value={`excluded ${batch.review_counts?.excluded ?? 0}`} />
                </div>
              </Link>
            ))}
            {!batches.length && <div className="text-sm text-zinc-500">No persisted metadata batches yet.</div>}
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, tone = "red" }: { label: string; value: number; tone?: "red" | "amber" }) {
  const color = tone === "amber" ? "text-amber-300" : "text-red-300";
  return <div className="rounded-lg border border-white/10 bg-white/[0.025] p-4"><div className={`text-3xl font-black ${color}`}>{value}</div><div className="mt-1 text-xs font-bold text-zinc-500">{label}</div></div>;
}

function Badge({ value, tone = "red" }: { value: string; tone?: "red" | "green" }) {
  const classes = tone === "green" ? "border-emerald-700/40 bg-emerald-950/25 text-emerald-300" : "border-red-700/40 bg-red-950/25 text-red-300";
  return <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-black uppercase ${classes}`}>{value.replaceAll("_", " ")}</span>;
}
