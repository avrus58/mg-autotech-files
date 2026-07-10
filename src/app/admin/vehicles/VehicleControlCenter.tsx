"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Database,
  Eye,
  FileClock,
  Filter,
  Gauge,
  Loader2,
  PlusCircle,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import type { VehicleControlRecord, VehicleImportSummary } from "@/lib/vehicleControl/types";
import type { ExternalVehicleEntry, VehicleEnrichmentPlan } from "@/lib/vehicleEnrichment/types";
import { parseVehicleEnrichmentEntries } from "@/lib/vehicleEnrichment/parseInput";

type Section = "overview" | "brands" | "models" | "generations" | "engines" | "import" | "enrichment" | "validation" | "audit";

type OverviewPayload = {
  stats: {
    brandCount: number;
    modelCount: number;
    generationCount: number;
    engineCount: number;
    publishedCount: number;
    draftCount: number;
    validationWarningCount: number;
    duplicateWarningCount: number;
    dataHealthScore: number;
  };
  records: VehicleControlRecord[];
  recentAudit: Array<Record<string, unknown>>;
  importBatches: Array<Record<string, unknown>>;
  permissionWarnings?: string[];
};

type CreateDraftState = {
  brand: string;
  model: string;
  generation: string;
  engine: string;
  yearFrom: string;
  yearTo: string;
  fuelType: string;
  stockHp: string;
  stockNm: string;
  tunedHp: string;
  tunedNm: string;
  ecuType: string;
};

const blankDraft: CreateDraftState = {
  brand: "",
  model: "",
  generation: "",
  engine: "",
  yearFrom: "",
  yearTo: "",
  fuelType: "",
  stockHp: "",
  stockNm: "",
  tunedHp: "",
  tunedNm: "",
  ecuType: "",
};

const sectionLinks: Array<{ id: Section; label: string; href: string }> = [
  { id: "overview", label: "Overview", href: "/admin/vehicles" },
  { id: "brands", label: "Brands", href: "/admin/vehicles/brands" },
  { id: "models", label: "Models", href: "/admin/vehicles/models" },
  { id: "generations", label: "Generations", href: "/admin/vehicles/generations" },
  { id: "engines", label: "Engines", href: "/admin/vehicles/engines" },
  { id: "import", label: "Import", href: "/admin/vehicles/import" },
  { id: "enrichment", label: "Enrichment", href: "/admin/vehicles/enrichment" },
  { id: "validation", label: "Validation", href: "/admin/vehicles/validation" },
  { id: "audit", label: "Audit", href: "/admin/vehicles/audit" },
];

export default function VehicleControlCenter({ section = "overview" }: { section?: Section }) {
  const [payload, setPayload] = useState<OverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [importSummary, setImportSummary] = useState<VehicleImportSummary | null>(null);
  const [busyAction, setBusyAction] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState<CreateDraftState>(blankDraft);
  const [importConfirm, setImportConfirm] = useState("");

  const authFetch = useCallback(async (url: string, init?: RequestInit) => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) throw new Error("Unauthorized");
    return fetch(url, { ...init, headers: { ...init?.headers, Authorization: `Bearer ${token}` } });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await authFetch("/api/admin/vehicles");
      const data = await response.json();
      if (response.status === 401) {
        window.location.href = "/login?redirect=/admin/vehicles";
        return;
      }
      if (!response.ok) throw new Error(data.error || "Vehicle database could not be loaded.");
      setPayload(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Vehicle database could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const records = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (payload?.records ?? []).filter((record) => {
      if (statusFilter === "published" && !record.published) return false;
      if (statusFilter === "draft" && record.published) return false;
      if (statusFilter === "verified" && record.verificationStatus !== "verified") return false;
      if (!term) return true;
      return [
        record.brand,
        record.model,
        record.generation,
        record.engine,
        record.ecuType,
        record.ecuFamily,
        record.vehicleKey,
        record.fuelType,
        record.services.join(" "),
      ].filter(Boolean).join(" ").toLowerCase().includes(term);
    });
  }, [payload, query, statusFilter]);

  async function runImport(dryRun: boolean) {
    if (!dryRun && importConfirm.trim() !== "IMPORT") {
      setMessage("Type IMPORT before running a real import. Dry-run is always safe.");
      return;
    }
    setBusyAction(dryRun ? "dry-run" : "import");
    setMessage("");
    try {
      const response = await authFetch("/api/admin/vehicles/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Import failed.");
      setImportSummary(data.summary);
      setMessage(dryRun ? "Dry-run completed. No production data was changed." : "Vehicle import completed.");
      if (!dryRun) setImportConfirm("");
      if (!dryRun) await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setBusyAction("");
    }
  }

  async function runValidation() {
    setBusyAction("validation");
    setMessage("");
    try {
      const response = await authFetch("/api/admin/vehicles/validation", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Validation failed.");
      setMessage(`Validation completed: ${data.count} issue(s) recorded.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Validation failed.");
    } finally {
      setBusyAction("");
    }
  }

  async function rebuildCatalogCache() {
    setBusyAction("catalog-cache");
    setMessage("");
    try {
      const response = await authFetch("/api/admin/vehicles/catalog-cache/rebuild", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Public catalog cache rebuild failed.");
      const result = data.result;
      setMessage(`Public catalog cache rebuilt: ${result.brandCount} brands, ${result.modelCount} models, ${result.generationCount} generations, ${result.engineCount} engines.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Public catalog cache rebuild failed.");
    } finally {
      setBusyAction("");
    }
  }

  function numberOrNull(value: string) {
    if (value.trim() === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  async function createDraft() {
    setBusyAction("create");
    setMessage("");
    try {
      const response = await authFetch("/api/admin/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: draft.brand,
          model: draft.model,
          generation: draft.generation,
          engine: draft.engine,
          yearFrom: numberOrNull(draft.yearFrom),
          yearTo: numberOrNull(draft.yearTo),
          fuelType: draft.fuelType || null,
          stockHp: numberOrNull(draft.stockHp),
          stockNm: numberOrNull(draft.stockNm),
          tunedHp: numberOrNull(draft.tunedHp),
          tunedNm: numberOrNull(draft.tunedNm),
          ecuType: draft.ecuType || null,
          services: [],
          confidenceScore: 60,
          verificationStatus: "unverified",
          published: false,
          active: true,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Vehicle draft could not be created.");
      const nextId = data?.record?.id;
      setMessage("Draft vehicle created.");
      setDraft(blankDraft);
      setShowCreate(false);
      await load();
      if (nextId) window.location.href = `/admin/vehicles/${nextId}`;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Vehicle draft could not be created.");
    } finally {
      setBusyAction("");
    }
  }

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
      <Loader2 className="mr-3 h-5 w-5 animate-spin text-red-500" />Loading vehicle control center...
    </main>;
  }

  const stats = payload?.stats;
  const lastImport = payload?.importBatches?.[0];

  return <main className="mg-compact-ui min-h-screen bg-[#050505] text-white">
    <header className="border-b border-white/10 bg-black/80">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-4 px-4 py-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Link href="/admin" className="text-sm font-bold text-zinc-500 hover:text-white"><ArrowLeft className="mr-2 inline h-4 w-4" />Admin operations</Link>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-red-800/40 bg-red-950/30 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-red-300">Vehicle Database</span>
            <span className="rounded-full border border-emerald-800/40 bg-emerald-950/20 px-3 py-1 text-xs font-black text-emerald-300">DB-first control center</span>
          </div>
          <h1 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">Vehicle Database Control Center</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">Manage published customer-safe vehicle data, imported source records, ECU metadata, service availability, validation and audit history without editing production JSON.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => void load()} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black hover:bg-white/10"><RefreshCcw className="mr-2 inline h-4 w-4" />Refresh</button>
          <button onClick={() => setShowCreate((value) => !value)} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black hover:bg-white/10"><PlusCircle className="mr-2 inline h-4 w-4" />Create draft</button>
          <button onClick={() => void runValidation()} disabled={busyAction === "validation"} className="rounded-xl border border-amber-800/40 bg-amber-950/20 px-4 py-3 text-sm font-black text-amber-200 disabled:opacity-50">{busyAction === "validation" ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 inline h-4 w-4" />}Run validation</button>
          <button onClick={() => void rebuildCatalogCache()} disabled={busyAction === "catalog-cache"} className="rounded-xl border border-sky-800/40 bg-sky-950/20 px-4 py-3 text-sm font-black text-sky-200 disabled:opacity-50">{busyAction === "catalog-cache" ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : <Database className="mr-2 inline h-4 w-4" />}Rebuild Public Catalog Cache</button>
          <Link href="/admin/vehicles/enrichment" className="rounded-xl border border-emerald-800/40 bg-emerald-950/20 px-4 py-3 text-sm font-black text-emerald-200 hover:bg-emerald-900/30"><Sparkles className="mr-2 inline h-4 w-4" />Enrichment</Link>
          <Link href="/admin/vehicles/import" className="rounded-xl bg-[#b1121b] px-4 py-3 text-sm font-black text-white hover:bg-[#c91824]"><UploadCloud className="mr-2 inline h-4 w-4" />Import tools</Link>
        </div>
      </div>
    </header>

    <div className="mx-auto max-w-[1500px] px-4 py-6">
      {message && <div className="mb-5 rounded-xl border border-red-800/40 bg-red-950/20 p-4 text-sm text-red-100">{message}</div>}
      {payload?.permissionWarnings?.map((warning) => <div key={warning} className="mb-5 rounded-xl border border-amber-800/40 bg-amber-950/20 p-4 text-sm leading-6 text-amber-100">
        <ShieldCheck className="mr-2 inline h-4 w-4 text-amber-300" />{warning}
      </div>)}
      <nav className="mb-6 flex gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03] p-2">
        {sectionLinks.map((item) => <Link key={item.id} href={item.href} className={`shrink-0 rounded-xl px-4 py-2 text-sm font-black transition ${section === item.id ? "bg-[#b1121b] text-white" : "text-zinc-400 hover:bg-white/10 hover:text-white"}`}>{item.label}</Link>)}
      </nav>

      {stats && <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<Database />} label="Brands / Models" value={`${stats.brandCount} / ${stats.modelCount}`} helper={`${stats.generationCount} generations`} />
        <Metric icon={<Gauge />} label="Engines" value={stats.engineCount} helper={`${stats.publishedCount} published / ${stats.draftCount} draft`} />
        <Metric icon={<AlertTriangle />} label="Warnings" value={stats.validationWarningCount + stats.duplicateWarningCount} helper={`${stats.duplicateWarningCount} duplicate keys`} />
        <Metric icon={<CheckCircle2 />} label="Data Health" value={`${stats.dataHealthScore}%`} helper="Validation, publish and duplicate score" />
      </section>}

      {lastImport && <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Last import batch</div>
            <h2 className="mt-2 text-2xl font-black">{String(lastImport.status ?? "unknown")} import</h2>
            <p className="mt-1 text-sm text-zinc-500">Created {String(lastImport.created_count ?? 0)}, updated {String(lastImport.updated_count ?? 0)}, skipped {String(lastImport.skipped_count ?? 0)}, errors {String(lastImport.error_count ?? 0)}.</p>
          </div>
          <span className="rounded-full border border-white/10 bg-black/40 px-4 py-2 text-xs font-black text-zinc-300">{String(lastImport.created_at ?? lastImport.started_at ?? "-")}</span>
        </div>
      </section>}

      {showCreate && <section className="mt-6 rounded-2xl border border-red-900/40 bg-red-950/10 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-red-300">Manual draft</div>
            <h2 className="mt-2 text-2xl font-black">Create a new vehicle record</h2>
            <p className="mt-1 text-sm text-zinc-500">Creates a safe unpublished draft. Publish only after ECU, services and customer-safe data are verified.</p>
          </div>
          <button onClick={() => void createDraft()} disabled={busyAction === "create"} className="rounded-xl bg-[#b1121b] px-5 py-3 text-sm font-black text-white hover:bg-[#c91824] disabled:opacity-50">{busyAction === "create" ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 inline h-4 w-4" />}Create draft</button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <DraftField label="Brand" value={draft.brand} onChange={(value) => setDraft((current) => ({ ...current, brand: value }))} />
          <DraftField label="Model" value={draft.model} onChange={(value) => setDraft((current) => ({ ...current, model: value }))} />
          <DraftField label="Generation" value={draft.generation} onChange={(value) => setDraft((current) => ({ ...current, generation: value }))} />
          <DraftField label="Engine" value={draft.engine} onChange={(value) => setDraft((current) => ({ ...current, engine: value }))} />
          <DraftField label="Year from" value={draft.yearFrom} onChange={(value) => setDraft((current) => ({ ...current, yearFrom: value }))} type="number" />
          <DraftField label="Year to" value={draft.yearTo} onChange={(value) => setDraft((current) => ({ ...current, yearTo: value }))} type="number" />
          <DraftField label="Fuel type" value={draft.fuelType} onChange={(value) => setDraft((current) => ({ ...current, fuelType: value }))} />
          <DraftField label="ECU type" value={draft.ecuType} onChange={(value) => setDraft((current) => ({ ...current, ecuType: value }))} />
          <DraftField label="Stock HP" value={draft.stockHp} onChange={(value) => setDraft((current) => ({ ...current, stockHp: value }))} type="number" />
          <DraftField label="Stock NM" value={draft.stockNm} onChange={(value) => setDraft((current) => ({ ...current, stockNm: value }))} type="number" />
          <DraftField label="Stage 1 HP" value={draft.tunedHp} onChange={(value) => setDraft((current) => ({ ...current, tunedHp: value }))} type="number" />
          <DraftField label="Stage 1 NM" value={draft.tunedNm} onChange={(value) => setDraft((current) => ({ ...current, tunedNm: value }))} type="number" />
        </div>
      </section>}

      {(section === "import" || section === "overview") && <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_420px]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <div className="flex items-center gap-3"><UploadCloud className="h-6 w-6 text-red-400" /><div><h2 className="text-2xl font-black">CareEcuFile Import</h2><p className="mt-1 text-sm text-zinc-500">Dry-run first. Real import is valid-only, additive and avoids overwriting verified manual data.</p></div></div>
          <div className="mt-5 rounded-xl border border-amber-800/30 bg-amber-950/10 p-4 text-sm leading-6 text-amber-100">
            Real import will import only valid unique records by default. Duplicate vehicleKey groups and blocking-invalid performance data are skipped. Run dry-run first, review warnings, then type <span className="font-black">IMPORT</span> to unlock the real import button.
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
            <input value={importConfirm} onChange={(event) => setImportConfirm(event.target.value)} placeholder="Type IMPORT for real import" className="h-12 rounded-xl border border-white/10 bg-black/40 px-4 text-sm font-bold text-white outline-none placeholder:text-zinc-600 focus:border-red-700" />
            <button onClick={() => void runImport(true)} disabled={Boolean(busyAction)} className="rounded-xl border border-white/10 bg-black/40 px-5 py-3 text-sm font-black hover:bg-white/10 disabled:opacity-50">{busyAction === "dry-run" ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : <FileClock className="mr-2 inline h-4 w-4" />}Dry-run import</button>
            <button onClick={() => void runImport(false)} disabled={Boolean(busyAction) || importConfirm.trim() !== "IMPORT"} className="rounded-xl bg-[#b1121b] px-5 py-3 text-sm font-black text-white hover:bg-[#c91824] disabled:opacity-50">{busyAction === "import" ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 inline h-4 w-4" />}Run real import</button>
          </div>
        </div>
        <div className="rounded-2xl border border-red-900/40 bg-red-950/10 p-5">
          <div className="text-xs font-black uppercase tracking-[0.18em] text-red-300">Latest import result</div>
          {importSummary ? <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <Mini label="Scanned" value={importSummary.totalRows} />
            <Mini label="Valid importable" value={importSummary.validImportableCount ?? "-"} />
            <Mini label={importSummary.dryRun ? "Would create" : "Created"} value={importSummary.created} />
            <Mini label={importSummary.dryRun ? "Would update" : "Updated"} value={importSummary.updated} />
            <Mini label="Would skip" value={importSummary.skipped} />
            <Mini label="Duplicate skips" value={importSummary.skippedDuplicate ?? "-"} />
            <Mini label="Invalid skips" value={importSummary.skippedInvalid ?? "-"} />
            <Mini label="Needs review" value={importSummary.needsReviewCount ?? "-"} />
            <Mini label="Warnings" value={importSummary.warningCount ?? importSummary.warnings.length} />
            <Mini label="Errors" value={importSummary.errors} />
            <Mini label="Protected manual" value={importSummary.protectedManualVerifiedCount ?? "-"} />
            <Mini label="Alias mappings" value={importSummary.aliasWarningCount ?? 0} />
            <Mini label="DB diff" value={importSummary.dbDiffCalculated ? "Yes" : "No"} />
          </div> : <p className="mt-4 text-sm leading-6 text-zinc-500">Run a dry-run to preview import counts and validation warnings.</p>}
          {importSummary && <p className="mt-4 rounded-xl border border-emerald-800/30 bg-emerald-950/10 p-3 text-xs leading-5 text-emerald-100">
            Mode: valid-only. Real import skips duplicate groups and blocking-invalid rows; missing ECU or incomplete Stage 1 performance is imported as needs-review/lower-confidence data.
          </p>}
          {importSummary?.warnings?.length ? <div className="mt-4 max-h-56 space-y-2 overflow-auto pr-1">
            {importSummary.warnings.slice(0, 8).map((warning, index) => <div key={`${warning.code}-${index}`} className="rounded-xl border border-amber-800/30 bg-black/30 p-3 text-xs leading-5 text-amber-100">
              <span className="font-black uppercase">{warning.severity}</span> {warning.message}
              {warning.vehicleKey && <div className="mt-1 break-all text-amber-200/70">{warning.vehicleKey}</div>}
            </div>)}
          </div> : null}
          {importSummary?.examples?.duplicates?.length ? <ImportExampleList title="Duplicate groups skipped" items={importSummary.examples.duplicates.map((item) => `${item.vehicleKey} (${item.count} rows)`)} /> : null}
          {importSummary?.aliasMappings?.length ? <ImportExampleList title="Alias resolution preview" items={importSummary.aliasMappings.map((item) => `${item.source.brand} / ${item.source.model} / ${item.source.generation} -> ${item.canonical.brand} / ${item.canonical.model} / ${item.canonical.generation} (${item.action})`)} /> : null}
          {importSummary?.examples?.invalid?.length ? <ImportExampleList title="Invalid rows skipped" items={importSummary.examples.invalid.map((item) => `${item.vehicleKey}: ${item.reason}`)} /> : null}
          {importSummary?.examples?.warnings?.length ? <ImportExampleList title="Needs review examples" items={importSummary.examples.warnings.map((item) => `${item.vehicleKey}: ${item.reason}`)} /> : null}
        </div>
      </section>}

      {section === "enrichment" && <EnrichmentSection authFetch={authFetch} setMessage={setMessage} />}

      {(section === "audit" || section === "overview") && <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-2xl font-black">Recent audit history</h2>
        <div className="mt-4 grid gap-2">
          {(payload?.recentAudit ?? []).slice(0, section === "audit" ? 50 : 6).map((row) => <div key={String(row.id)} className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm">
            <div className="font-black text-white">{String(row.action ?? "change")}</div>
            <div className="mt-1 text-xs text-zinc-500">{String(row.entity_type ?? "-")} - {String(row.created_at ?? "-")}</div>
          </div>)}
          {!payload?.recentAudit?.length && <div className="rounded-xl border border-white/10 bg-black/30 p-5 text-sm text-zinc-500">No audit events yet.</div>}
        </div>
      </section>}

      {(section !== "import" && section !== "enrichment" && section !== "audit") && <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-black">{section === "validation" ? "Records needing review" : "Vehicle records"}</h2>
            <p className="mt-1 text-sm text-zinc-500">Customer selector only receives active and published safe fields.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[260px_180px]">
            <label className="flex h-12 items-center gap-3 rounded-xl border border-white/10 bg-black/40 px-4"><Search className="h-4 w-4 text-zinc-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search vehicle, ECU, key..." className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none placeholder:text-zinc-600" /></label>
            <label className="flex h-12 items-center gap-3 rounded-xl border border-white/10 bg-black/40 px-4"><Filter className="h-4 w-4 text-zinc-500" /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none"><option value="all">All records</option><option value="published">Published</option><option value="draft">Draft</option><option value="verified">Verified</option></select></label>
          </div>
        </div>
        <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
          <div className="hidden grid-cols-[1.2fr_1fr_1fr_1.1fr_150px_120px] gap-3 border-b border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-zinc-500 xl:grid">
            <div>Vehicle</div><div>Generation</div><div>ECU</div><div>Services</div><div>Status</div><div>Action</div>
          </div>
          <div className="divide-y divide-white/10">
            {records.slice(0, 250).map((record) => <div key={record.id ?? record.vehicleKey} className="grid gap-3 px-4 py-4 xl:grid-cols-[1.2fr_1fr_1fr_1.1fr_150px_120px] xl:items-center">
              <div><div className="text-lg font-black text-white">{record.brand} {record.model}</div><div className="mt-1 text-sm font-bold text-zinc-400">{record.engine}</div><div className="mt-1 text-xs text-zinc-600">{record.vehicleKey}</div></div>
              <div className="text-sm text-zinc-300">{record.generation}<div className="mt-1 text-xs text-zinc-600">{[record.yearFrom, record.yearTo ?? "open"].filter(Boolean).join(" - ")}</div></div>
              <div className="text-sm text-zinc-300">{record.ecuType || "-"}<div className="mt-1 text-xs text-zinc-600">{record.ecuFamily || "family unknown"}</div></div>
              <div className="flex flex-wrap gap-1">{record.services.slice(0, 5).map((service) => <span key={service} className="rounded-full bg-red-950/30 px-2 py-1 text-[11px] font-black text-red-200">{service.replaceAll("_", " ").toUpperCase()}</span>)}</div>
              <div><span className={`rounded-full px-3 py-1 text-xs font-black ${record.published ? "bg-emerald-950/30 text-emerald-300" : "bg-zinc-900 text-zinc-400"}`}>{record.published ? "Published" : "Draft"}</span><div className="mt-2 text-xs text-zinc-500">{record.verificationStatus} - {record.confidenceScore}%</div></div>
              <Link href={`/admin/vehicles/${record.id}`} className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm font-black hover:bg-white/10"><Eye className="mr-2 h-4 w-4" />Open</Link>
            </div>)}
            {records.length === 0 && <div className="p-8 text-center text-sm text-zinc-500">No matching vehicle records.</div>}
          </div>
        </div>
      </section>}
    </div>
  </main>;
}

const enrichmentExample = JSON.stringify([
  {
    "brand": "Mercedes-Benz",
    "model": "E-Class",
    "rawTitle": "Mercedes-Benz E-class (W214), 2023-present",
    "rawBodyType": "Sedan",
    "rawYearRange": "2023-present",
    "engineDisplayName": "E 63 S 4MATIC+",
    "powerText": "Power: 612 HP",
    "torqueText": "Torque: 850 Nm",
    "engineCodeText": "Engine Model/Code: M177.980",
    "displacementText": "Engine displacement: 3982 cm3",
    "fuelType": "Petrol",
    "sourceUrl": "https://example.com/reference"
  },
  {
    "brand": "Mercedes-Benz",
    "model": "E-Class",
    "rawTitle": "Mercedes-Benz E-class T-Modell (S214), 2023-present",
    "rawBodyType": "Estate / T-Modell",
    "rawYearRange": "2023-present",
    "engineDisplayName": "E 300 e",
    "powerText": "Power: 204 HP",
    "torqueText": "Torque: 320 Nm",
    "fuelType": "Plug-in hybrid"
  }
], null, 2);

function EnrichmentSection({
  authFetch,
  setMessage,
}: {
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
  setMessage: (value: string) => void;
}) {
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceName, setSourceName] = useState("Manual reference");
  const [yearCutoff, setYearCutoff] = useState("2020");
  const [modernOnly, setModernOnly] = useState(true);
  const [text, setText] = useState(enrichmentExample);
  const [plan, setPlan] = useState<VehicleEnrichmentPlan | null>(null);
  const [busy, setBusy] = useState("");
  const [draftConfirm, setDraftConfirm] = useState("");

  function parseEntries(): ExternalVehicleEntry[] {
    return parseVehicleEnrichmentEntries(text);
  }

  async function runCompare() {
    setBusy("compare");
    setMessage("");
    try {
      const entries = parseEntries();
      const response = await authFetch("/api/admin/vehicles/enrichment/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: "auto_data_reference",
          sourceName,
          sourceUrl: sourceUrl || null,
          entries,
          modernOnly,
          yearCutoff: Number(yearCutoff) || 2020,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Enrichment compare failed.");
      setPlan(data.plan);
      setMessage("Enrichment dry-run completed. No data was changed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Enrichment compare failed.");
    } finally {
      setBusy("");
    }
  }

  async function createDraft(engineCandidateId: string) {
    if (draftConfirm !== "CREATE_DRAFT") {
      setMessage("Type CREATE_DRAFT before creating an unpublished enrichment draft.");
      return;
    }
    setBusy(engineCandidateId);
    setMessage("");
    try {
      const entries = parseEntries();
      const response = await authFetch("/api/admin/vehicles/enrichment/create-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: "auto_data_reference",
          sourceName,
          sourceUrl: sourceUrl || null,
          entries,
          modernOnly,
          yearCutoff: Number(yearCutoff) || 2020,
          engineCandidateId,
          confirm: "CREATE_DRAFT",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Draft creation failed.");
      setDraftConfirm("");
      setMessage("Unpublished needs_review draft created. Verify ECU, services and Stage 1 values before publishing.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Draft creation failed.");
    } finally {
      setBusy("");
    }
  }

  return <section className="mt-6 grid gap-4 xl:grid-cols-[420px_1fr]">
    <div className="rounded-2xl border border-emerald-900/40 bg-emerald-950/10 p-5">
      <div className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">Modern Vehicle Intelligence</div>
      <h2 className="mt-2 text-2xl font-black">Enrichment Center</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-400">
        Manual-assisted enrichment for missing modern vehicles. It does not crawl, auto-publish, overwrite verified records or expose source references to customers.
      </p>
      <div className="mt-5 space-y-3">
        <DraftField label="Source name" value={sourceName} onChange={setSourceName} />
        <DraftField label="Source URL / reference (admin-only)" value={sourceUrl} onChange={setSourceUrl} />
        <DraftField label="Modern year cutoff" value={yearCutoff} onChange={setYearCutoff} type="number" />
        <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/40 p-3 text-sm font-bold text-zinc-200">
          <input type="checkbox" checked={modernOnly} onChange={(event) => setModernOnly(event.target.checked)} />
          Modern/current only by default
        </label>
        <label className="block text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Structured paste JSON or CSV
          <textarea value={text} onChange={(event) => setText(event.target.value)} className="mt-2 min-h-72 w-full rounded-xl border border-white/10 bg-black/50 p-4 font-mono text-xs normal-case leading-5 text-zinc-200 outline-none focus:border-emerald-700" />
        </label>
        <button onClick={() => void runCompare()} disabled={Boolean(busy)} className="w-full rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white hover:bg-emerald-600 disabled:opacity-50">
          {busy === "compare" ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 inline h-4 w-4" />}Dry-run normalize + compare
        </button>
      </div>
    </div>

    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
        <div className="grid gap-3 md:grid-cols-4">
          <Mini label="Entries" value={plan?.totalEntries ?? "-"} />
          <Mini label="Accepted" value={plan?.acceptedEntries ?? "-"} />
          <Mini label="Groups" value={plan?.generationGroups.length ?? "-"} />
          <Mini label="Engines" value={plan?.engineCandidates.length ?? "-"} />
        </div>
        <p className="mt-4 rounded-xl border border-amber-800/30 bg-amber-950/10 p-3 text-xs leading-5 text-amber-100">
          Stage 1 values are auto-estimated at +15% only as an unverified helper. Stage 2, ECU type, unlock/protection and TCU data are never invented.
        </p>
      </div>

      {plan?.warnings.map((warning) => <div key={warning} className="rounded-xl border border-emerald-800/30 bg-emerald-950/10 p-3 text-sm text-emerald-100">{warning}</div>)}

      {plan?.generationGroups.map((group) => <div key={group.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-red-300">Normalized group</div>
            <h3 className="mt-2 text-2xl font-black">{group.brand} {group.model} - {group.customerDisplayLabel}</h3>
            <p className="mt-2 text-sm text-zinc-500">Confidence {group.confidenceScore}% - {group.reviewStatus}. Body variants stay metadata, not separate customer generations.</p>
          </div>
          <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs font-black text-zinc-300">{group.platformCodes.join(" / ") || "No code"}</span>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Included variants</div>
            <div className="mt-2 space-y-2">{group.bodyVariants.map((variant) => <div key={`${variant.label}-${variant.sourceUrl}`} className="text-sm text-zinc-300">{variant.label} <span className="text-zinc-600">{variant.yearFrom ?? "-"}-{variant.yearTo ?? "present"}</span></div>)}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Excluded / protected</div>
            <div className="mt-2 space-y-2">{group.excludedEntries.length ? group.excludedEntries.map((item) => <div key={`${item.entry.rawTitle}-${item.reason}`} className="text-sm text-amber-200">{item.entry.rawTitle ?? item.entry.rawGeneration} <span className="text-zinc-500">- {item.reason}</span></div>) : <div className="text-sm text-zinc-500">No excluded entries.</div>}</div>
          </div>
        </div>
      </div>)}

      {plan?.engineCandidates.map((engine) => {
        const gap = plan.gaps.find((item) => item.engineCandidateId === engine.id);
        return <div key={engine.id} className="rounded-2xl border border-red-900/30 bg-red-950/10 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.18em] text-red-300">Engine candidate</div>
              <h3 className="mt-2 text-2xl font-black">{engine.engineDisplayName}</h3>
              <p className="mt-2 text-sm text-zinc-500">{engine.engineCode || "No engine code"} - {engine.displacementCc ?? "-"}cc - {engine.fuelType || "fuel unknown"}</p>
            </div>
            <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs font-black text-zinc-300">{gap?.suggestedAction ?? "manual_review_required"}</span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <Mini label="Stock HP" value={engine.stockHp ?? "-"} />
            <Mini label="Stock NM" value={engine.stockNm ?? "-"} />
            <Mini label="Stage 1 draft HP" value={engine.stage1Estimate.stage1HpEstimate ?? "-"} />
            <Mini label="Stage 1 draft NM" value={engine.stage1Estimate.stage1NmEstimate ?? "-"} />
          </div>
          <div className="mt-4 rounded-xl border border-amber-800/30 bg-amber-950/10 p-3 text-xs leading-5 text-amber-100">
            Estimate source: {engine.stage1Estimate.estimateSource}. Confidence: low. Requires MG AutoTech verification before publishing.
          </div>
          {gap && <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4 text-sm leading-6 text-zinc-300">
            {gap.reasons.map((reason) => <div key={reason}>- {reason}</div>)}
            {gap.conflictingValues.map((diff) => <div key={`${diff.fieldName}-${diff.diffType}`} className="text-amber-200">Conflict: {diff.fieldName} existing {String(diff.existingValue)} vs candidate {String(diff.candidateValue)}</div>)}
          </div>}
          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
            <input value={draftConfirm} onChange={(event) => setDraftConfirm(event.target.value)} placeholder="Type CREATE_DRAFT to create unpublished draft" className="h-12 rounded-xl border border-white/10 bg-black/40 px-4 text-sm font-bold text-white outline-none placeholder:text-zinc-600 focus:border-red-700" />
            <button onClick={() => void createDraft(engine.id)} disabled={Boolean(busy) || draftConfirm !== "CREATE_DRAFT" || Boolean(gap?.matchedExistingEngine)} className="rounded-xl bg-[#b1121b] px-5 py-3 text-sm font-black text-white hover:bg-[#c91824] disabled:opacity-50">
              {busy === engine.id ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 inline h-4 w-4" />}Create draft
            </button>
          </div>
        </div>;
      })}
    </div>
  </section>;
}

function Metric({ icon, label, value, helper }: { icon: ReactNode; label: string; value: string | number; helper: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
    <div className="flex items-center justify-between"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-950/30 text-red-400">{icon}</div><div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">{label}</div></div>
    <div className="mt-5 text-3xl font-black">{value}</div>
    <div className="mt-2 text-xs text-zinc-500">{helper}</div>
  </div>;
}

function Mini({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-xl border border-white/10 bg-black/30 p-3"><div className="text-xs uppercase tracking-[0.12em] text-zinc-500">{label}</div><div className="mt-1 text-xl font-black">{value}</div></div>;
}

function ImportExampleList({ title, items }: { title: string; items: string[] }) {
  return <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3">
    <div className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">{title}</div>
    <div className="mt-2 space-y-2">
      {items.slice(0, 6).map((item) => <div key={item} className="break-all text-xs leading-5 text-zinc-300">{item}</div>)}
    </div>
  </div>;
}

function DraftField({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="block text-xs font-black uppercase tracking-[0.14em] text-zinc-500">{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm font-bold normal-case text-white outline-none focus:border-red-700" /></label>;
}
