"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, ExternalLink, Laptop2, LockKeyhole, RefreshCw, ShieldAlert } from "lucide-react";
import { authenticatedFetch } from "@/lib/authGuards";

type ReleaseData = {
  release: {
    app: {
      minimum_supported_version: string;
      latest_version: string;
      update_required: boolean;
      update_available: boolean;
      update_url: string | null;
      release_notes_url: string | null;
      maintenance_mode: boolean;
      desktop_upload_enabled: boolean;
      allowed_modules: string[];
    };
    channel: string;
    signingStatus: string;
    publicDownloadEnabled: boolean;
    internalBeta: boolean;
    releaseReady: boolean;
    checks: Array<{ key: string; label: string; complete: boolean }>;
  };
  environment: Record<string, boolean>;
};

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function AdminDesktopAppPage() {
  const [data, setData] = useState<ReleaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await authenticatedFetch("/api/admin/desktop-app", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Desktop release status could not be loaded.");
      setData(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Desktop release status could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <main className="mg-compact-ui min-h-screen bg-[#050505] text-white">
      <header className="border-b border-white/10 bg-black/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div><Link href="/admin/operations" className="inline-flex items-center gap-2 text-xs font-black text-zinc-500 hover:text-white"><ArrowLeft className="h-4 w-4" />Operations Intelligence</Link><div className="mt-2 flex items-center gap-3"><Laptop2 className="h-7 w-7 text-red-500" /><div><p className="text-xs font-black uppercase tracking-[0.18em] text-red-500">Internal Beta</p><h1 className="text-xl font-black sm:text-2xl">Desktop App Release Center</h1></div></div></div>
          <button type="button" onClick={() => void load()} className="inline-flex items-center rounded-lg border border-white/10 px-3 py-2 text-sm font-black hover:bg-white/10"><RefreshCw className="mr-2 h-4 w-4" />Refresh</button>
        </div>
      </header>
      <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {loading && !data && <div className="py-16 text-center text-sm text-zinc-500">Loading release controls...</div>}
        {error && <div role="alert" className="rounded-lg border border-red-700/40 bg-red-950/20 p-4 text-sm text-red-200">{error}</div>}
        {data && (
          <div className="space-y-5">
            <section className="grid gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Latest version" value={data.release.app.latest_version} detail={`Minimum ${data.release.app.minimum_supported_version}`} />
              <Metric label="Channel" value={label(data.release.channel)} detail="Admin-controlled release channel" />
              <Metric label="Signing" value={label(data.release.signingStatus)} detail="No certificate values are exposed" />
              <Metric label="Public download" value={data.release.publicDownloadEnabled ? "Enabled" : "Disabled"} detail="Selected beta only by default" />
            </section>
            <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="border-y border-white/10 py-5"><p className="text-xs font-black uppercase tracking-[0.18em] text-red-400">Release checklist</p><h2 className="mt-1 text-xl font-black">Public-release gates</h2><div className="mt-4 divide-y divide-white/10 border-y border-white/10">{data.release.checks.map((check) => <div key={check.key} className="flex items-center justify-between gap-4 py-3"><span className="font-bold">{check.label}</span>{check.complete ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <ShieldAlert className="h-5 w-5 text-amber-300" />}</div>)}</div></div>
              <aside className="border-y border-white/10 py-5"><div className="flex items-center gap-2"><LockKeyhole className="h-5 w-5 text-sky-300" /><h2 className="text-lg font-black">Controlled distribution</h2></div><p className="mt-3 text-sm leading-6 text-zinc-400">The web deployment contains no installer artifact and the public download page exposes no direct binary URL until every release gate is satisfied.</p><Link href="/download/windows" className="mt-4 inline-flex items-center text-sm font-black text-red-300">Open beta gate <ExternalLink className="ml-2 h-4 w-4" /></Link></aside>
            </section>
            <section className="border-y border-white/10 py-5"><h2 className="text-xl font-black">Production environment presence</h2><p className="mt-1 text-sm text-zinc-500">Only configured/not-configured state is shown. Values and secrets are never returned.</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{Object.entries(data.environment).map(([key, present]) => <div key={key} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 p-3 text-xs"><span className="break-all font-mono text-zinc-400">{key}</span><span className={`shrink-0 font-black ${present ? "text-emerald-300" : "text-zinc-600"}`}>{present ? "Configured" : "Default"}</span></div>)}</div></section>
          </div>
        )}
      </section>
    </main>
  );
}

function Metric({ label: metricLabel, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="bg-[#0b0b0c] p-4"><div className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-500">{metricLabel}</div><div className="mt-2 break-words text-xl font-black">{value}</div><div className="mt-1 text-xs text-zinc-600">{detail}</div></div>;
}
