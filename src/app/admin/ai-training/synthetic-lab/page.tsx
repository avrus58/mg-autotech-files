"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, FlaskConical, Loader2, RefreshCcw, ShieldCheck } from "lucide-react";
import { authenticatedFetch } from "@/lib/authGuards";

type SyntheticCase = {
  fixture_id: string;
  fixture_type: string;
  not_flashable: boolean;
  ecu_type: string;
  sw_number: string;
  service_labels: string[];
  changed_region_count: number;
  expected_categories: string[];
  attribution_status: string;
  attributed_region_count: number;
  unknown_region_count: number;
  average_attribution_confidence: number;
  evidence_trust_level: string;
  evidence_score: number;
  learning_usable: boolean;
  generation_readiness_status: string;
  generation_export_allowed: boolean;
  generation_blocked_reasons: string[];
};

type Payload = {
  total_cases: number;
  attribution_ready_cases: number;
  learning_usable_cases: number;
  export_allowed_cases: number;
  cases: SyntheticCase[];
  warnings: string[];
};

const emptyPayload: Payload = {
  total_cases: 0,
  attribution_ready_cases: 0,
  learning_usable_cases: 0,
  export_allowed_cases: 0,
  cases: [],
  warnings: [],
};

export default function SyntheticLabPage() {
  const [payload, setPayload] = useState<Payload>(emptyPayload);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await authenticatedFetch("/api/admin/ai-training/synthetic-lab");
      const data = await response.json();
      if (response.status === 401) {
        window.location.href = "/login?redirect=/admin/ai-training/synthetic-lab";
        return;
      }
      if (!response.ok) throw new Error(data.error || "Synthetic lab could not be loaded.");
      setPayload(data as Payload);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Synthetic lab could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void load(); }, 100);
    return () => window.clearTimeout(timeout);
  }, [load]);

  return (
    <main className="mg-compact-ui min-h-screen bg-[#050505] text-white">
      <header className="border-b border-white/10 bg-black/80">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/admin/ai-training" className="inline-flex items-center text-sm font-bold text-zinc-500 hover:text-white">
              <ArrowLeft className="mr-2 h-4 w-4" /> Learning control room
            </Link>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-emerald-800/50 bg-emerald-950/25 text-emerald-300">
                <FlaskConical className="h-6 w-6" />
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">Training accelerator</div>
                <h1 className="text-2xl font-black sm:text-3xl">Synthetic File Lab</h1>
              </div>
            </div>
          </div>
          <button onClick={() => void load()} disabled={loading} className="inline-flex h-11 items-center justify-center rounded-lg border border-white/10 px-4 text-sm font-black hover:bg-white/5 disabled:opacity-50">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
            Refresh benchmark
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-4 py-7">
        <div className="mb-6 rounded-lg border border-emerald-700/30 bg-emerald-950/15 p-4 text-sm leading-6 text-emerald-100/80">
          <ShieldCheck className="mr-2 inline h-4 w-4" />
          This lab uses deterministic fake binaries only. They are marked safe_fake_binary and not_flashable. No storage write,
          no trusted production sample approval and no customer file generation happens here.
        </div>
        {message && <div className="mb-6 rounded-lg border border-red-800/40 bg-red-950/20 p-4 text-sm text-red-100">{message}</div>}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Synthetic cases" value={payload.total_cases} />
          <Metric label="Attribution ready" value={payload.attribution_ready_cases} tone="green" />
          <Metric label="Learning usable" value={payload.learning_usable_cases} tone="green" />
          <Metric label="Export allowed" value={payload.export_allowed_cases} tone="red" />
        </section>

        <section className="mt-6 grid gap-3 lg:grid-cols-2">
          {payload.cases.map((item) => (
            <article key={item.fixture_id} className="rounded-lg border border-white/10 bg-white/[0.025] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.16em] text-emerald-400">{item.fixture_type.replaceAll("_", " ")}</div>
                  <h2 className="mt-2 text-xl font-black">{item.ecu_type}</h2>
                  <div className="mt-1 text-xs text-zinc-500">SW {item.sw_number} / {item.not_flashable ? "not flashable" : "blocked"}</div>
                </div>
                <Badge value={item.generation_readiness_status} tone="amber" />
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <Small label="Services" value={item.service_labels.join(" / ") || "metadata"} />
                <Small label="Changed regions" value={String(item.changed_region_count)} />
                <Small label="Attribution" value={`${item.attributed_region_count}/${item.changed_region_count}`} />
                <Small label="Evidence" value={`${item.evidence_trust_level} ${item.evidence_score}/100`} />
                <Small label="Map confidence" value={`${item.average_attribution_confidence}/100`} />
                <Small label="Export" value={item.generation_export_allowed ? "allowed" : "locked"} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {item.expected_categories.map((category) => <Badge key={category} value={category.replaceAll("_", " ")} tone="green" />)}
              </div>
              <p className="mt-4 text-xs leading-5 text-zinc-500">
                Blocked gates: {item.generation_blocked_reasons.join(", ") || "export locked"}.
              </p>
            </article>
          ))}
        </section>

        <section className="mt-6 rounded-lg border border-white/10 bg-white/[0.025] p-4">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Safety warnings</div>
          <ul className="mt-3 space-y-2 text-sm text-zinc-400">
            {payload.warnings.map((warning) => <li key={warning}>- {warning}</li>)}
          </ul>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, tone = "red" }: { label: string; value: number; tone?: "red" | "green" }) {
  const color = tone === "green" ? "text-emerald-300" : "text-red-300";
  return <div className="rounded-lg border border-white/10 bg-white/[0.025] p-4"><div className={`text-3xl font-black ${color}`}>{value}</div><div className="mt-1 text-xs font-bold text-zinc-500">{label}</div></div>;
}

function Small({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-600">{label}</div><div className="mt-1 break-words text-sm font-black text-zinc-200">{value}</div></div>;
}

function Badge({ value, tone = "red" }: { value: string; tone?: "red" | "green" | "amber" }) {
  const classes = tone === "green"
    ? "border-emerald-700/40 bg-emerald-950/25 text-emerald-300"
    : tone === "amber"
      ? "border-amber-700/40 bg-amber-950/25 text-amber-300"
      : "border-red-700/40 bg-red-950/25 text-red-300";
  return <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-black uppercase ${classes}`}>{value}</span>;
}
