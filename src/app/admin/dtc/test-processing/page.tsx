"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  FileWarning,
  Loader2,
  PlayCircle,
  ShieldAlert,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/authGuards";
import type { DtcPhaseCProcessingReport } from "@/lib/dtcActive/phaseCTypes";

const authorizationStatement = "I understand this is synthetic internal test output only.";

export default function AdminDtcTestProcessingPage() {
  const [codes, setCodes] = useState("P0100, P0300");
  const [statementAccepted, setStatementAccepted] = useState(false);
  const [state, setState] = useState<{
    status: "idle" | "loading" | "ready" | "error";
    report: DtcPhaseCProcessingReport | null;
    message: string;
  }>({ status: "idle", report: null, message: "" });

  const requestedCodes = useMemo(() => codes.split(",").map((code) => code.trim().toUpperCase()).filter(Boolean), [codes]);

  async function generate() {
    setState({ status: "loading", report: null, message: "" });
    try {
      const response = await authenticatedFetch("/api/admin/dtc/test-processing/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requestedCodes,
          idempotencyKey: `admin-phase-c-${requestedCodes.join("-")}-${Date.now()}`,
          authorizationStatement: statementAccepted ? authorizationStatement : "",
        }),
      });
      const payload = await response.json();
      if (response.status === 401) {
        window.location.href = "/login?redirect=/admin/dtc/test-processing";
        return;
      }
      if (response.status === 403) throw new Error("Access denied.");
      if (!response.ok && !payload.report) throw new Error(payload.error || "Synthetic test output generation failed.");
      setState({ status: payload.report?.success ? "ready" : "error", report: payload.report, message: payload.error || "" });
    } catch (error) {
      setState({
        status: "error",
        report: null,
        message: error instanceof Error ? error.message : "Synthetic test output generation failed.",
      });
    }
  }

  return (
    <main className="mg-compact-ui min-h-screen bg-[#050505] px-4 py-6 text-white sm:px-6">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link href="/admin/dtc" className="inline-flex items-center text-sm font-bold text-zinc-500 hover:text-white">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to DTC foundation
            </Link>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-red-800/50 bg-red-950/25 text-red-300">
                <PlayCircle className="h-6 w-6" />
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-[0.22em] text-red-500">Phase C</div>
                <h1 className="text-2xl font-black sm:text-3xl">Generate Synthetic Test Output</h1>
                <p className="mt-1 max-w-3xl text-sm text-zinc-400">
                  Admin-only internal fixture generation. It creates source, pre-integrity and final synthetic artifacts in
                  test scope only. No customer file, real ECU checksum, native tool, delivery or A3/A4/A5 path is used.
                </p>
              </div>
            </div>
          </div>
        </header>

        <section className="rounded-lg border border-amber-500/25 bg-amber-950/10 p-5">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-1 h-5 w-5 text-amber-300" />
            <div>
              <h2 className="font-black text-amber-100">Synthetic fixture boundary</h2>
              <p className="mt-1 text-sm text-amber-50/75">
                This workflow is deliberately limited to MGDTCFX1. The response contains hashes, changed regions and audit
                metadata only; it never exposes raw bytes or a downloadable customer artifact.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[420px_1fr]">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
            <label className="block text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Requested synthetic codes</label>
            <input
              value={codes}
              onChange={(event) => setCodes(event.target.value)}
              className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-sm font-bold text-white outline-none focus:border-red-500"
            />
            <label className="mt-5 flex items-start gap-3 rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={statementAccepted}
                onChange={(event) => setStatementAccepted(event.target.checked)}
                className="mt-1"
              />
              <span>
                I confirm: <span className="font-bold text-white">{authorizationStatement}</span>
              </span>
            </label>
            <button
              onClick={() => void generate()}
              disabled={state.status === "loading" || !statementAccepted}
              className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-lg bg-red-600 px-4 text-sm font-black text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {state.status === "loading" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
              Generate Test Output
            </button>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
            {state.status === "idle" && (
              <div className="text-sm text-zinc-400">No synthetic output generated in this page session.</div>
            )}
            {state.status === "loading" && (
              <div className="flex items-center gap-3 text-sm font-bold text-zinc-300">
                <Loader2 className="h-5 w-5 animate-spin text-red-400" />
                Generating synthetic test output...
              </div>
            )}
            {state.status === "error" && (
              <div role="alert" className="rounded-lg border border-red-500/25 bg-red-950/20 p-4">
                <div className="flex items-start gap-3">
                  <FileWarning className="mt-1 h-5 w-5 text-red-300" />
                  <div>
                    <h2 className="font-black text-red-100">Generation blocked safely</h2>
                    <p className="mt-1 text-sm text-red-100/75">{state.message || state.report?.hardVetoes.join(", ") || "Hard veto active."}</p>
                  </div>
                </div>
              </div>
            )}
            {state.report && (
              <ReportPanel report={state.report} />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function ReportPanel({ report }: { report: DtcPhaseCProcessingReport }) {
  return (
    <div className="space-y-5">
      <div className={`rounded-lg border p-4 ${report.success ? "border-emerald-500/25 bg-emerald-950/10" : "border-red-500/25 bg-red-950/10"}`}>
        <div className="flex items-center gap-2 text-sm font-black">
          <CheckCircle2 className={`h-5 w-5 ${report.success ? "text-emerald-300" : "text-red-300"}`} />
          {report.success ? "Synthetic output generated" : "Synthetic output blocked"}
        </div>
        <div className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">{report.attemptId}</div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <HashBox label="Source" value={report.sourceSha256} />
        <HashBox label="Pre-integrity" value={report.preIntegritySha256 ?? "-"} />
        <HashBox label="Final" value={report.finalSha256 ?? "-"} />
      </div>
      <section>
        <h2 className="text-sm font-black uppercase tracking-[0.16em] text-zinc-300">Changed regions</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <RegionList title="Semantic" regions={report.semanticChangedRegions} />
          <RegionList title="Integrity" regions={report.integrityChangedRegions} />
        </div>
      </section>
      <section>
        <h2 className="text-sm font-black uppercase tracking-[0.16em] text-zinc-300">Internal validations</h2>
        <div className="mt-3 space-y-2">
          {report.validations.map((validation) => (
            <div key={validation.validationId} className="rounded-lg border border-white/10 bg-black/25 p-3 text-sm">
              <span className={validation.status === "pass" ? "font-black text-emerald-300" : "font-black text-red-300"}>{validation.status.toUpperCase()}</span>
              <span className="ml-2 text-zinc-300">{validation.stage}: {validation.message}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function HashBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/25 p-3">
      <div className="text-[11px] font-black uppercase tracking-[0.14em] text-zinc-500">{label}</div>
      <div className="mt-1 break-all font-mono text-xs text-zinc-200">{value}</div>
    </div>
  );
}

function RegionList({ title, regions }: { title: string; regions: DtcPhaseCProcessingReport["semanticChangedRegions"] }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/25 p-3">
      <div className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">{title}</div>
      <ul className="mt-2 space-y-1 text-sm text-zinc-300">
        {regions.length === 0 && <li>No changes</li>}
        {regions.map((region) => (
          <li key={`${region.kind}-${region.start}-${region.length}`}>
            offset {region.start}, length {region.length}
          </li>
        ))}
      </ul>
    </div>
  );
}
