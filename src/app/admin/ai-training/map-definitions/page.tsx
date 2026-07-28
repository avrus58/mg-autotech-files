"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Database, FileCode2, Loader2, Plus, RefreshCcw, ShieldAlert } from "lucide-react";
import { authenticatedFetch } from "@/lib/authGuards";

type DefinitionSetRow = {
  id: string;
  name: string;
  ecu_family: string | null;
  ecu_type: string | null;
  sw_number: string | null;
  hw_number: string | null;
  source_type: string;
  confidence_score: number;
  human_verified: boolean;
  active: boolean;
  definition_count: number;
  updated_at: string;
};

type DefinitionRow = {
  id: string;
  definition_set_id: string;
  map_name: string;
  category: string;
  offset_start: number;
  offset_end: number;
  confidence_score: number;
  human_verified: boolean;
  active: boolean;
};

type Payload = {
  sets: DefinitionSetRow[];
  definitions: DefinitionRow[];
};

const emptyPayload: Payload = { sets: [], definitions: [] };

export default function MapDefinitionsPage() {
  const [payload, setPayload] = useState<Payload>(emptyPayload);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [setupRequired, setSetupRequired] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await authenticatedFetch("/api/admin/ai-training/map-definitions");
      const data = await response.json();
      if (!response.ok) {
        setSetupRequired(Boolean(data.setupRequired));
        throw new Error(data.error || "Map definitions could not be loaded.");
      }
      setSetupRequired(false);
      setPayload(data as Payload);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Map definitions could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const filteredSets = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return payload.sets;
    return payload.sets.filter((set) =>
      [set.name, set.ecu_family, set.ecu_type, set.sw_number, set.hw_number, set.source_type]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [payload.sets, search]);

  const counts = useMemo(() => ({
    sets: payload.sets.length,
    maps: payload.definitions.length,
    verified: payload.definitions.filter((definition) => definition.human_verified).length,
    active: payload.definitions.filter((definition) => definition.active).length,
  }), [payload]);

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
                <FileCode2 className="h-6 w-6" />
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-red-500">Level 3</div>
                <h1 className="text-2xl font-black sm:text-3xl">Map Definition Layer</h1>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => void load()} disabled={loading} className="inline-flex h-11 items-center justify-center rounded-lg border border-white/10 px-4 text-sm font-black hover:bg-white/5 disabled:opacity-50">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-4 py-7">
        <div className="mb-6 rounded-lg border border-amber-700/30 bg-amber-950/15 p-4 text-sm leading-6 text-amber-100/80">
          <ShieldAlert className="mr-2 inline h-4 w-4" />
          Map definitions are admin-only evidence. They do not generate files, byte patches or write-ready MOD output.
          Human tuner and checksum verification remain mandatory.
        </div>

        {message && (
          <div className="mb-6 rounded-lg border border-red-800/40 bg-red-950/20 p-4 text-sm text-red-100">
            {message}
            {setupRequired && (
              <div className="mt-2 font-black">
                Run <code>scripts/add-ai-level3-map-definitions.sql</code> in Supabase before using persistent map definitions.
              </div>
            )}
          </div>
        )}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Definition sets" value={counts.sets} />
          <Metric label="Map definitions" value={counts.maps} />
          <Metric label="Human verified" value={counts.verified} />
          <Metric label="Active maps" value={counts.active} />
        </section>

        <section className="mt-6 rounded-lg border border-white/10 bg-white/[0.025] p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.18em] text-red-400">Definition library</div>
              <h2 className="text-xl font-black">ECU map definition sets</h2>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search ECU, SW, source..."
                className="h-11 rounded-lg border border-white/10 bg-black/40 px-4 text-sm font-bold outline-none focus:border-red-700"
              />
              <button disabled className="inline-flex h-11 items-center justify-center rounded-lg border border-white/10 px-4 text-sm font-black text-zinc-500">
                <Plus className="mr-2 h-4 w-4" /> Create via API
              </button>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-lg border border-white/10">
            <div className="grid hidden bg-black/40 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-zinc-500 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_110px_110px_110px]">
              <div>Set</div><div>ECU context</div><div>Maps</div><div>Confidence</div><div>Status</div>
            </div>
            {filteredSets.map((set) => (
              <div key={set.id} className="grid gap-3 border-t border-white/10 px-4 py-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_110px_110px_110px] md:items-center">
                <div className="min-w-0">
                  <div className="break-words font-black">{set.name}</div>
                  <div className="mt-1 text-xs text-zinc-500">{set.source_type} / updated {formatDate(set.updated_at)}</div>
                </div>
                <div className="min-w-0 text-sm text-zinc-300">
                  <div className="break-words font-black">{set.ecu_type || set.ecu_family || "Generic ECU"}</div>
                  <div className="mt-1 break-all text-xs text-zinc-600">SW {set.sw_number || "-"} / HW {set.hw_number || "-"}</div>
                </div>
                <Badge value={String(set.definition_count)} />
                <Badge value={`${set.confidence_score}/100`} />
                <Badge value={set.human_verified ? "Verified" : set.active ? "Pending" : "Inactive"} tone={set.human_verified ? "green" : "amber"} />
              </div>
            ))}
            {!loading && !filteredSets.length && (
              <div className="p-10 text-center text-sm text-zinc-500">
                {setupRequired ? "Map definition tables are not installed yet." : "No map definition sets are available yet."}
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-white/10 bg-white/[0.025] p-4">
          <div className="mb-4 flex items-center gap-3">
            <Database className="h-5 w-5 text-red-400" />
            <h2 className="text-lg font-black">Recent map definitions</h2>
          </div>
          <div className="grid gap-2 lg:grid-cols-2">
            {payload.definitions.slice(0, 12).map((definition) => (
              <div key={definition.id} className="rounded-lg border border-white/10 bg-black/25 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-black">{definition.map_name}</div>
                  <Badge value={definition.category.replaceAll("_", " ")} tone={definition.human_verified ? "green" : "amber"} />
                </div>
                <div className="mt-2 text-xs text-zinc-500">
                  Offset range is admin-only and intentionally not customer-visible. Confidence {definition.confidence_score}/100.
                </div>
              </div>
            ))}
            {!payload.definitions.length && <div className="text-sm text-zinc-500">No map definitions yet.</div>}
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.025] p-4">
      <div className="text-3xl font-black">{value}</div>
      <div className="mt-1 text-xs font-bold text-zinc-500">{label}</div>
    </div>
  );
}

function Badge({ value, tone = "red" }: { value: string; tone?: "red" | "green" | "amber" }) {
  const classes = tone === "green"
    ? "border-emerald-700/40 bg-emerald-950/25 text-emerald-300"
    : tone === "amber"
      ? "border-amber-700/40 bg-amber-950/25 text-amber-300"
      : "border-red-700/40 bg-red-950/25 text-red-300";
  return <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-black uppercase ${classes}`}>{value}</span>;
}

function formatDate(value: string) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
