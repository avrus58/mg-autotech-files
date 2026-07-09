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
  UploadCloud,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import type { VehicleControlRecord, VehicleImportSummary } from "@/lib/vehicleControl/types";

type Section = "overview" | "brands" | "models" | "generations" | "engines" | "import" | "validation" | "audit";

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

  return <main className="min-h-screen bg-[#050505] text-white">
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
          <div className="flex items-center gap-3"><UploadCloud className="h-6 w-6 text-red-400" /><div><h2 className="text-2xl font-black">CareEcuFile Import</h2><p className="mt-1 text-sm text-zinc-500">Dry-run first. Real import is additive and avoids overwriting verified manual data.</p></div></div>
          <div className="mt-5 rounded-xl border border-amber-800/30 bg-amber-950/10 p-4 text-sm leading-6 text-amber-100">
            Real import writes database rows, import batch records and audit logs. Run dry-run first, review warnings, then type <span className="font-black">IMPORT</span> to unlock the real import button.
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
            <Mini label="Rows" value={importSummary.totalRows} />
            <Mini label="Created" value={importSummary.created} />
            <Mini label="Updated" value={importSummary.updated} />
            <Mini label="Skipped" value={importSummary.skipped} />
            <Mini label="Errors" value={importSummary.errors} />
            <Mini label="Warnings" value={importSummary.warnings.length} />
          </div> : <p className="mt-4 text-sm leading-6 text-zinc-500">Run a dry-run to preview import counts and validation warnings.</p>}
          {importSummary?.warnings?.length ? <div className="mt-4 max-h-56 space-y-2 overflow-auto pr-1">
            {importSummary.warnings.slice(0, 8).map((warning, index) => <div key={`${warning.code}-${index}`} className="rounded-xl border border-amber-800/30 bg-black/30 p-3 text-xs leading-5 text-amber-100">
              <span className="font-black uppercase">{warning.severity}</span> {warning.message}
            </div>)}
          </div> : null}
        </div>
      </section>}

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

      {(section !== "import" && section !== "audit") && <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
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

function DraftField({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="block text-xs font-black uppercase tracking-[0.14em] text-zinc-500">{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm font-bold normal-case text-white outline-none focus:border-red-700" /></label>;
}
