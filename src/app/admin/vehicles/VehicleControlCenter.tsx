"use client";

import { AdminMobileOverview } from "@/components/admin/AdminMobileOverview";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Database,
  Eye,
  FileClock,
  Gauge,
  Loader2,
  PlusCircle,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/authGuards";
import { calculatePerformanceGain, calculateTunedFromGain, isWholePerformanceInput } from "@/lib/vehicleControl/performance";
import type {
  VehicleAdminListQuery,
  VehicleAdminListResponse,
  VehicleAdminPageSize,
  VehicleImportSummary,
  VehiclePerformanceStage,
} from "@/lib/vehicleControl/types";
import { vehicleAdminPageSizes, vehiclePerformanceStages } from "@/lib/vehicleControl/types";
import type { ExternalVehicleEntry, VehicleEnrichmentPlan } from "@/lib/vehicleEnrichment/types";
import { parseVehicleEnrichmentEntries } from "@/lib/vehicleEnrichment/parseInput";

type Section = "overview" | "brands" | "models" | "generations" | "engines" | "import" | "enrichment" | "coverage" | "validation" | "audit";

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
  stageProfiles: Record<VehiclePerformanceStage, { tunedHp: string; tunedNm: string; active: boolean }>;
  ecuFamily: string;
  ecuType: string;
  ecuHardware: string;
  ecuSoftware: string;
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
  stageProfiles: {
    stage1: { tunedHp: "", tunedNm: "", active: false },
    stage2: { tunedHp: "", tunedNm: "", active: false },
    stage3: { tunedHp: "", tunedNm: "", active: false },
  },
  ecuFamily: "",
  ecuType: "",
  ecuHardware: "",
  ecuSoftware: "",
};

const stageLabels: Record<VehiclePerformanceStage, string> = { stage1: "Stage 1", stage2: "Stage 2", stage3: "Stage 3" };

const sectionLinks: Array<{ id: Section; label: string; href: string }> = [
  { id: "overview", label: "Vehicle catalog", href: "/admin/vehicles" },
  { id: "validation", label: "Needs review", href: "/admin/vehicles/validation" },
];

const advancedLinks: Array<{ id: Section; label: string; href: string }> = [
  { id: "import", label: "Import", href: "/admin/vehicles/import" },
  { id: "enrichment", label: "Enrichment", href: "/admin/vehicles/enrichment" },
  { id: "coverage", label: "Coverage", href: "/admin/vehicles/coverage" },
  { id: "audit", label: "Audit history", href: "/admin/vehicles/audit" },
];

export default function VehicleControlCenter({ section = "overview" }: { section?: Section }) {
  const [payload, setPayload] = useState<OverviewPayload | null>(null);
  const [listPayload, setListPayload] = useState<VehicleAdminListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [modelFilter, setModelFilter] = useState("");
  const [generationFilter, setGenerationFilter] = useState("");
  const [ecuFilter, setEcuFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<VehicleAdminListQuery["publishStatus"]>("all");
  const [verificationFilter, setVerificationFilter] = useState<VehicleAdminListQuery["verificationStatus"]>(section === "validation" ? "needs_review" : "all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<VehicleAdminPageSize>(25);
  const [importSummary, setImportSummary] = useState<VehicleImportSummary | null>(null);
  const [busyAction, setBusyAction] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState<CreateDraftState>(blankDraft);
  const [importConfirm, setImportConfirm] = useState("");

  const authFetch = useCallback(
    (url: string, init?: RequestInit) => authenticatedFetch(url, init),
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await authFetch("/api/admin/vehicles");
      const data = await response.json();
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

  const loadList = useCallback(async () => {
    setListLoading(true);
    setListError("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        q: query,
        brand: brandFilter,
        model: modelFilter,
        generation: generationFilter,
        ecuFamily: ecuFilter,
        publishStatus: statusFilter,
        verificationStatus: verificationFilter,
      });
      const response = await authFetch(`/api/admin/vehicles/search?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Vehicle records could not be loaded.");
      setListPayload(data);
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Vehicle records could not be loaded.");
    } finally {
      setListLoading(false);
    }
  }, [authFetch, brandFilter, ecuFilter, generationFilter, modelFilter, page, pageSize, query, statusFilter, verificationFilter]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadList(), 300);
    return () => window.clearTimeout(timeout);
  }, [loadList]);

  function resetFilters() {
    setQuery("");
    setBrandFilter("");
    setModelFilter("");
    setGenerationFilter("");
    setEcuFilter("");
    setStatusFilter("all");
    setVerificationFilter(section === "validation" ? "needs_review" : "all");
    setPage(1);
  }

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

  function updateDraftStage(stage: VehiclePerformanceStage, field: "tunedHp" | "tunedNm", value: string) {
    setDraft((current) => ({
      ...current,
      stageProfiles: {
        ...current.stageProfiles,
        [stage]: {
          ...current.stageProfiles[stage],
          [field]: value,
          active: current.stageProfiles[stage].active || value.trim() !== "",
        },
      },
    }));
  }

  function updateDraftStageGain(stage: VehiclePerformanceStage, output: "hp" | "nm", value: string) {
    if (!isWholePerformanceInput(value)) {
      setMessage("Stage gain must be a whole HP/Nm number.");
      return;
    }
    setMessage("");
    setDraft((current) => {
      const stock = numberOrNull(output === "hp" ? current.stockHp : current.stockNm);
      const requestedGain = numberOrNull(value);
      const tuned = value.trim() === "" ? "" : calculateTunedFromGain(stock, requestedGain);
      if (tuned === null) return current;
      const field = output === "hp" ? "tunedHp" : "tunedNm";
      return {
        ...current,
        stageProfiles: {
          ...current.stageProfiles,
          [stage]: {
            ...current.stageProfiles[stage],
            [field]: tuned === "" ? "" : String(tuned),
            active: current.stageProfiles[stage].active || value.trim() !== "",
          },
        },
      };
    });
  }

  function toggleDraftStage(stage: VehiclePerformanceStage) {
    setDraft((current) => ({
      ...current,
      stageProfiles: {
        ...current.stageProfiles,
        [stage]: { ...current.stageProfiles[stage], active: !current.stageProfiles[stage].active },
      },
    }));
  }

  async function createDraft() {
    setBusyAction("create");
    setMessage("");
    try {
      const performanceInputs = [
        draft.stockHp,
        draft.stockNm,
        ...vehiclePerformanceStages.flatMap((stage) => [draft.stageProfiles[stage].tunedHp, draft.stageProfiles[stage].tunedNm]),
      ];
      if (!performanceInputs.every(isWholePerformanceInput)) {
        throw new Error("Stock, Stage output and gain values must be whole HP/Nm numbers.");
      }
      const performanceProfiles = vehiclePerformanceStages
        .map((stage) => ({
          stage,
          tunedHp: numberOrNull(draft.stageProfiles[stage].tunedHp),
          tunedNm: numberOrNull(draft.stageProfiles[stage].tunedNm),
          active: draft.stageProfiles[stage].active,
        }))
        .filter((profile) => profile.active || profile.tunedHp != null || profile.tunedNm != null);
      const activeStageServices = vehiclePerformanceStages.filter((stage) => draft.stageProfiles[stage].active);
      const stage1 = draft.stageProfiles.stage1;
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
          tunedHp: numberOrNull(stage1.tunedHp),
          tunedNm: numberOrNull(stage1.tunedNm),
          performanceProfiles,
          ecuFamily: draft.ecuFamily || null,
          ecuType: draft.ecuType || null,
          ecuHardware: draft.ecuHardware || null,
          ecuSoftware: draft.ecuSoftware || null,
          services: activeStageServices,
          confidenceScore: 60,
          verificationStatus: "unverified",
          published: false,
          active: true,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        const firstIssue = Array.isArray(data.issues) ? data.issues[0]?.message : null;
        throw new Error(firstIssue || data.error || "Vehicle draft could not be created.");
      }
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
  const records = listPayload?.records ?? [];
  const pagination = listPayload?.pagination;
  const catalogSection = ["overview", "brands", "models", "generations", "engines"].includes(section);

  return <main className="mg-compact-ui min-h-screen bg-[#050505] text-white">
    <header className="border-b border-white/10 bg-black/80">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-4 px-4 py-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Link href="/admin" className="text-sm font-bold text-zinc-500 hover:text-white"><ArrowLeft className="mr-2 inline h-4 w-4" />Admin operations</Link>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-red-800/40 bg-red-950/30 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-red-300">Vehicle Database</span>
            <span className="rounded-full border border-emerald-800/40 bg-emerald-950/20 px-3 py-1 text-xs font-black text-emerald-300">DB-first control center</span>
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-tight md:text-4xl">Vehicle catalog</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">Find a brand, model, generation or engine; then manage its ECU, Stage 1–2–3 and service data from one simple editor.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => { void load(); void loadList(); }} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black hover:bg-white/10"><RefreshCcw className="mr-2 inline h-4 w-4" />Refresh</button>
          <button onClick={() => setShowCreate((value) => !value)} className="rounded-xl bg-[#b1121b] px-4 py-3 text-sm font-black hover:bg-[#c91824]"><PlusCircle className="mr-2 inline h-4 w-4" />New vehicle</button>
        </div>
      </div>
    </header>

    <div className="mx-auto max-w-[1500px] px-4 py-6">
      {message && <div role="status" aria-live="polite" className="mb-5 rounded-xl border border-red-800/40 bg-red-950/20 p-4 text-sm text-red-100">{message}</div>}
      {payload?.permissionWarnings?.map((warning) => <div key={warning} className="mb-5 rounded-xl border border-amber-800/40 bg-amber-950/20 p-4 text-sm leading-6 text-amber-100">
        <ShieldCheck className="mr-2 inline h-4 w-4 text-amber-300" />{warning}
      </div>)}
      <nav aria-label="Vehicle catalog navigation" className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-2">
        {sectionLinks.map((item) => {
          const active = item.id === "overview" ? catalogSection : section === item.id;
          return <Link key={item.id} aria-current={active ? "page" : undefined} href={item.href} className={`rounded-xl px-4 py-2 text-sm font-black transition ${active ? "bg-[#b1121b] text-white" : "text-zinc-400 hover:bg-white/10 hover:text-white"}`}>{item.label}</Link>;
        })}
        <details className="relative ml-auto">
          <summary className="cursor-pointer list-none rounded-xl px-4 py-2 text-sm font-black text-zinc-400 hover:bg-white/10 hover:text-white">Advanced tools</summary>
          <div className="absolute right-0 z-30 mt-2 grid min-w-56 gap-1 rounded-xl border border-white/10 bg-[#0a0a0a] p-2 shadow-2xl">
            {advancedLinks.map((item) => <Link key={item.id} href={item.href} className={`rounded-lg px-3 py-2 text-sm font-bold ${section === item.id ? "bg-red-950/40 text-red-200" : "text-zinc-400 hover:bg-white/10 hover:text-white"}`}>{item.label}</Link>)}
            <button onClick={() => void runValidation()} disabled={busyAction === "validation"} className="rounded-lg px-3 py-2 text-left text-sm font-bold text-zinc-400 hover:bg-white/10 hover:text-white disabled:opacity-50">Run validation</button>
            <button onClick={() => void rebuildCatalogCache()} disabled={busyAction === "catalog-cache"} className="rounded-lg px-3 py-2 text-left text-sm font-bold text-zinc-400 hover:bg-white/10 hover:text-white disabled:opacity-50">Rebuild public cache</button>
          </div>
        </details>
      </nav>

      {stats && catalogSection && <AdminMobileOverview label="Catalog totals, warnings & data health"><section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<Database />} label="Brands / Models" value={`${stats.brandCount} / ${stats.modelCount}`} helper={`${stats.generationCount} generations`} />
        <Metric icon={<Gauge />} label="Engines" value={stats.engineCount} helper={`${stats.publishedCount} published / ${stats.draftCount} draft`} />
        <Metric icon={<AlertTriangle />} label="Warnings" value={stats.validationWarningCount + stats.duplicateWarningCount} helper={`${stats.duplicateWarningCount} duplicate keys`} />
        <Metric icon={<CheckCircle2 />} label="Data Health" value={`${stats.dataHealthScore}%`} helper="Validation, publish and duplicate score" />
      </section></AdminMobileOverview>}

      {lastImport && section === "import" && <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
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
        <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
          <h3 className="text-sm font-black">Vehicle & primary ECU</h3>
          <p className="mt-1 text-xs leading-5 text-zinc-500">Enter the exact controller details you know now; the full record remains editable after creation.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <DraftField label="Brand" value={draft.brand} onChange={(value) => setDraft((current) => ({ ...current, brand: value }))} />
            <DraftField label="Model" value={draft.model} onChange={(value) => setDraft((current) => ({ ...current, model: value }))} />
            <DraftField label="Generation" value={draft.generation} onChange={(value) => setDraft((current) => ({ ...current, generation: value }))} />
            <DraftField label="Engine" value={draft.engine} onChange={(value) => setDraft((current) => ({ ...current, engine: value }))} />
            <DraftField label="Year from" value={draft.yearFrom} onChange={(value) => setDraft((current) => ({ ...current, yearFrom: value }))} type="number" min="0" />
            <DraftField label="Year to" value={draft.yearTo} onChange={(value) => setDraft((current) => ({ ...current, yearTo: value }))} type="number" min="0" />
            <DraftField label="Fuel type" value={draft.fuelType} onChange={(value) => setDraft((current) => ({ ...current, fuelType: value }))} />
            <DraftField label="ECU family" value={draft.ecuFamily} onChange={(value) => setDraft((current) => ({ ...current, ecuFamily: value }))} />
            <DraftField label="ECU type" value={draft.ecuType} onChange={(value) => setDraft((current) => ({ ...current, ecuType: value }))} />
            <DraftField label="ECU hardware" value={draft.ecuHardware} onChange={(value) => setDraft((current) => ({ ...current, ecuHardware: value }))} />
            <DraftField label="ECU software" value={draft.ecuSoftware} onChange={(value) => setDraft((current) => ({ ...current, ecuSoftware: value }))} />
            <DraftField label="Stock HP" value={draft.stockHp} onChange={(value) => setDraft((current) => ({ ...current, stockHp: value }))} type="number" min="1" />
            <DraftField label="Stock Nm" value={draft.stockNm} onChange={(value) => setDraft((current) => ({ ...current, stockNm: value }))} type="number" min="1" />
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
          <h3 className="text-sm font-black">Stage 1–2–3 performance</h3>
          <p className="mt-1 text-xs leading-5 text-zinc-500">Enter either the final HP/Nm or the gain. Editing gain calculates the final output from the stock value automatically.</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">{vehiclePerformanceStages.map((stage) => {
            const profile = draft.stageProfiles[stage];
            const hpGain = calculatePerformanceGain(numberOrNull(draft.stockHp), numberOrNull(profile.tunedHp));
            const nmGain = calculatePerformanceGain(numberOrNull(draft.stockNm), numberOrNull(profile.tunedNm));
            return <fieldset key={stage} className={`rounded-xl border p-4 ${profile.active ? "border-red-800/50 bg-red-950/15" : "border-white/10 bg-black/30"}`}><legend className="sr-only">{stageLabels[stage]} manual performance</legend><div className="flex items-center justify-between gap-3"><div><div className="font-black">{stageLabels[stage]}</div><div className="mt-1 text-xs text-zinc-600">{profile.active ? "Included in services" : "Not offered"}</div></div><button type="button" aria-pressed={profile.active} onClick={() => toggleDraftStage(stage)} className={`min-h-11 rounded-xl px-3 text-xs font-black ${profile.active ? "bg-[#b1121b] text-white" : "border border-white/10 text-zinc-400"}`}>{profile.active ? "Enabled" : "Enable"}</button></div><div className="mt-4 grid grid-cols-2 gap-3"><DraftField label="After tuning HP" value={profile.tunedHp} onChange={(value) => updateDraftStage(stage, "tunedHp", value)} type="number" min="1" disabled={!profile.active} /><DraftField label="After tuning Nm" value={profile.tunedNm} onChange={(value) => updateDraftStage(stage, "tunedNm", value)} type="number" min="1" disabled={!profile.active} /><DraftField label="Gain +HP" value={hpGain == null ? "" : String(hpGain)} onChange={(value) => updateDraftStageGain(stage, "hp", value)} type="number" min="0" disabled={!profile.active || !draft.stockHp} /><DraftField label="Gain +Nm" value={nmGain == null ? "" : String(nmGain)} onChange={(value) => updateDraftStageGain(stage, "nm", value)} type="number" min="0" disabled={!profile.active || !draft.stockNm} /></div></fieldset>;
          })}</div>
        </div>
      </section>}

      {section === "import" && <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_420px]">
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

      {(section === "enrichment" || section === "coverage") && <EnrichmentSection mode={section} authFetch={authFetch} setMessage={setMessage} />}

      {section === "audit" && <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-2xl font-black">Recent audit history</h2>
        <div className="mt-4 grid gap-2">
          {(payload?.recentAudit ?? []).slice(0, section === "audit" ? 50 : 6).map((row) => <div key={String(row.id)} className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm">
            <div className="font-black text-white">{String(row.action ?? "change")}</div>
            <div className="mt-1 text-xs text-zinc-500">{String(row.entity_type ?? "-")} - {String(row.created_at ?? "-")}</div>
          </div>)}
          {!payload?.recentAudit?.length && <div className="rounded-xl border border-white/10 bg-black/30 p-5 text-sm text-zinc-500">No audit events yet.</div>}
        </div>
      </section>}

      {(catalogSection || section === "validation") && <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-black">{section === "validation" ? "Vehicles needing review" : "Find a vehicle"}</h2>
            <p className="mt-1 text-sm text-zinc-500">Filter in order: brand → model → generation → engine or ECU.</p>
          </div>
          <button type="button" onClick={resetFilters} className="h-11 rounded-xl border border-white/10 px-4 text-sm font-black text-zinc-400 hover:bg-white/10 hover:text-white">Clear filters</button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <FilterField label="1. Brand" value={brandFilter} onChange={(value) => { setBrandFilter(value); setPage(1); }} placeholder="BMW, Mercedes-Benz..." />
          <FilterField label="2. Model" value={modelFilter} onChange={(value) => { setModelFilter(value); setPage(1); }} placeholder="3 Series, E-Class..." />
          <FilterField label="3. Generation" value={generationFilter} onChange={(value) => { setGenerationFilter(value); setPage(1); }} placeholder="G20, W213..." />
          <FilterField label="4. Engine / key" value={query} onChange={(value) => { setQuery(value); setPage(1); }} placeholder="2.0 TDI, B57, vehicle key..." icon={<Search className="h-4 w-4" />} />
          <FilterField label="ECU family" value={ecuFilter} onChange={(value) => { setEcuFilter(value); setPage(1); }} placeholder="Bosch EDC17..." />
          <label className="block text-xs font-black uppercase tracking-[0.12em] text-zinc-500">Publish status<select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as VehicleAdminListQuery["publishStatus"]); setPage(1); }} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm font-bold normal-case text-white outline-none focus:border-red-700"><option value="all">All records</option><option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option></select></label>
          <label className="block text-xs font-black uppercase tracking-[0.12em] text-zinc-500">Verification<select value={verificationFilter} onChange={(event) => { setVerificationFilter(event.target.value as VehicleAdminListQuery["verificationStatus"]); setPage(1); }} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm font-bold normal-case text-white outline-none focus:border-red-700"><option value="all">All verification states</option><option value="verified">Verified</option><option value="needs_review">Needs review</option><option value="unverified">Unverified</option><option value="imported">Imported</option><option value="rejected">Rejected</option></select></label>
          <label className="block text-xs font-black uppercase tracking-[0.12em] text-zinc-500">Rows per page<select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value) as VehicleAdminPageSize); setPage(1); }} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm font-bold normal-case text-white outline-none focus:border-red-700">{vehicleAdminPageSizes.map((size) => <option key={size} value={size}>{size} vehicles</option>)}</select></label>
        </div>

        {listError && <div role="alert" className="mt-5 flex flex-col gap-3 rounded-xl border border-red-800/50 bg-red-950/20 p-4 text-sm text-red-100 sm:flex-row sm:items-center sm:justify-between"><span>{listError}</span><button type="button" onClick={() => void loadList()} className="h-10 rounded-lg bg-[#b1121b] px-4 font-black">Try again</button></div>}
        <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
          <div className="hidden grid-cols-[1.25fr_1fr_1fr_1fr_150px_110px] gap-3 border-b border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-zinc-500 xl:grid">
            <div>Brand / model</div><div>Generation / engine</div><div>Primary ECU</div><div>Stage data</div><div>Status</div><div>Action</div>
          </div>
          <div className="divide-y divide-white/10">
            {listLoading && <div className="flex min-h-40 items-center justify-center p-8 text-sm font-bold text-zinc-400"><Loader2 className="mr-2 h-4 w-4 animate-spin text-red-400" />Loading matching vehicles...</div>}
            {!listLoading && records.map((record) => <div key={record.id ?? record.vehicleKey} className="grid gap-4 px-4 py-4 xl:grid-cols-[1.25fr_1fr_1fr_1fr_150px_110px] xl:items-center">
              <div><div className="text-base font-black text-white">{record.brand}</div><div className="mt-1 text-sm font-bold text-zinc-300">{record.model}</div><div className="mt-1 truncate text-xs text-zinc-600">{record.vehicleKey}</div></div>
              <div><div className="text-sm font-black text-zinc-200">{record.generation}</div><div className="mt-1 text-sm text-zinc-400">{record.engine}</div><div className="mt-1 text-xs text-zinc-600">{[record.yearFrom, record.yearTo ?? "present"].filter(Boolean).join(" – ")}</div></div>
              <div className="text-sm text-zinc-300"><span className="xl:hidden text-xs font-black uppercase text-zinc-600">ECU · </span>{record.ecuType || "Not set"}<div className="mt-1 text-xs text-zinc-600">{record.ecuFamily || "Family not set"}</div></div>
              <div className="flex flex-wrap gap-1">{(["stage1", "stage2", "stage3"] as const).map((stage, index) => <span key={stage} className={`rounded-full border px-2 py-1 text-[11px] font-black ${record.stages.includes(stage) ? "border-red-800/40 bg-red-950/30 text-red-200" : "border-white/10 text-zinc-700"}`}>S{index + 1}</span>)}</div>
              <div><span className={`rounded-full px-3 py-1 text-xs font-black ${record.publishStatus === "published" ? "bg-emerald-950/30 text-emerald-300" : record.publishStatus === "archived" ? "bg-red-950/30 text-red-300" : "bg-zinc-900 text-zinc-400"}`}>{record.publishStatus}</span><div className="mt-2 text-xs text-zinc-500">{record.verificationStatus} · {record.confidenceScore}%</div></div>
              <Link href={`/admin/vehicles/${record.id}`} className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm font-black hover:bg-white/10"><Eye className="mr-2 h-4 w-4" />Edit</Link>
            </div>)}
            {!listLoading && records.length === 0 && !listError && <div className="p-10 text-center"><div className="text-sm font-black text-zinc-300">No matching vehicles</div><p className="mt-2 text-sm text-zinc-600">Clear a filter or create a new draft vehicle.</p></div>}
          </div>
        </div>

        {pagination && <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="text-sm text-zinc-500">{pagination.total.toLocaleString()} vehicles · Page {pagination.page} of {Math.max(1, pagination.pageCount)}</div><div className="flex gap-2"><button type="button" disabled={!pagination.hasPreviousPage || listLoading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="h-11 rounded-xl border border-white/10 px-4 text-sm font-black disabled:opacity-40">Previous</button><button type="button" disabled={!pagination.hasNextPage || listLoading} onClick={() => setPage((value) => value + 1)} className="h-11 rounded-xl bg-[#b1121b] px-4 text-sm font-black disabled:opacity-40">Next</button></div></div>}
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
  },
  {
    "brand": "BMW",
    "model": "5 Series",
    "rawTitle": "BMW 5 Series Touring (G61), 2024-present",
    "rawBodyType": "Touring",
    "rawYearRange": "2024-present",
    "engineDisplayName": "530e xDrive",
    "powerText": "Power: 299 HP",
    "torqueText": "Torque: 450 Nm",
    "displacementText": "1998 cm3",
    "fuelType": "Plug-in hybrid"
  },
  {
    "brand": "VW",
    "model": "Golf",
    "rawTitle": "Volkswagen Golf 8.5, 2024-present",
    "rawBodyType": "Hatchback",
    "rawYearRange": "2024-present",
    "engineDisplayName": "2.0 TSI GTI",
    "powerText": "Power: 265 HP",
    "torqueText": "Torque: 370 Nm",
    "displacementText": "1984 cm3",
    "fuelType": "Petrol"
  },
  {
    "brand": "Audi",
    "model": "A5",
    "rawTitle": "Audi A5 (B10), 2024-present",
    "rawBodyType": "Sedan / Avant",
    "rawYearRange": "2024-present",
    "engineDisplayName": "2.0 TDI",
    "powerText": "Power: 204 HP",
    "torqueText": "Torque: 400 Nm",
    "displacementText": "1968 cm3",
    "fuelType": "Diesel"
  }
], null, 2);

type UrlSourceType = "auto" | "html" | "json" | "csv" | "text";
type EnrichmentInputMode = "paste" | "url";

type UrlFetchPreview = {
  title: string | null;
  sourceUrl: string;
  finalUrl: string;
  contentType: string | null;
  fetchedBytes: number;
  detectedRows: number;
  detectedItems: number;
  extractedCandidateCount: number;
  confidence: number;
  warnings: string[];
  errors: string[];
};

function EnrichmentSection({
  mode,
  authFetch,
  setMessage,
}: {
  mode: "enrichment" | "coverage";
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
  setMessage: (value: string) => void;
}) {
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceName, setSourceName] = useState("Manual reference");
  const [inputMode, setInputMode] = useState<EnrichmentInputMode>("paste");
  const [sourceType, setSourceType] = useState<UrlSourceType>("auto");
  const [yearCutoff, setYearCutoff] = useState("2020");
  const [modernOnly, setModernOnly] = useState(true);
  const [text, setText] = useState(enrichmentExample);
  const [plan, setPlan] = useState<VehicleEnrichmentPlan | null>(null);
  const [urlPreview, setUrlPreview] = useState<UrlFetchPreview | null>(null);
  const [busy, setBusy] = useState("");
  const [draftConfirm, setDraftConfirm] = useState("");
  const [coverageFilter, setCoverageFilter] = useState("all");

  function parseEntries(): ExternalVehicleEntry[] {
    return parseVehicleEnrichmentEntries(text);
  }

  async function fetchUrl() {
    setBusy("fetch-url");
    setMessage("");
    setUrlPreview(null);
    try {
      const response = await authFetch("/api/admin/vehicles/enrichment/fetch-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceName,
          sourceUrl,
          sourceType,
          modernOnly,
          modernYearCutoff: Number(yearCutoff) || 2020,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "URL vehicle extraction failed.");
      setText(JSON.stringify(data.entries ?? [], null, 2));
      setPlan(data.plan);
      setUrlPreview(data.fetch);
      setMessage("URL fetch extraction completed. Review candidates before creating drafts; no data was changed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "URL vehicle extraction failed.");
    } finally {
      setBusy("");
    }
  }

  async function runCompare() {
    setBusy("compare");
    setMessage("");
    try {
      const entries = parseEntries();
      const response = await authFetch(mode === "coverage" ? "/api/admin/vehicles/coverage" : "/api/admin/vehicles/enrichment/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: inputMode === "url" ? "url" : "auto_data_reference",
          sourceName,
          sourceUrl: sourceUrl || null,
          entries,
          modernOnly,
          yearCutoff: Number(yearCutoff) || 2020,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "External coverage compare failed.");
      setPlan(data.plan);
      setMessage(mode === "coverage" ? "External coverage dry-run completed. No data was changed." : "Enrichment dry-run completed. No data was changed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "External coverage compare failed.");
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
          sourceType: inputMode === "url" ? "url" : "auto_data_reference",
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

  const coverageIssues = (plan?.coverage.issues ?? []).filter((item) => coverageFilter === "all" || item.type === coverageFilter || item.severity === coverageFilter);
  const coverageStats = plan?.coverage.stats;

  return <section className="mt-6 grid gap-4 xl:grid-cols-[420px_1fr]">
    <div className="rounded-2xl border border-emerald-900/40 bg-emerald-950/10 p-5">
      <div className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">{mode === "coverage" ? "External Vehicle Coverage" : "Modern Vehicle Intelligence"}</div>
      <h2 className="mt-2 text-2xl font-black">{mode === "coverage" ? "Coverage & Gap Import" : "Enrichment Center"}</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-400">
        {mode === "coverage"
          ? "Source-agnostic coverage analysis for all brands, models, generations and engines. It stages external data for review and never auto-publishes."
          : "Manual-assisted enrichment for missing modern vehicles. It does not crawl, auto-publish, overwrite verified records or expose source references to customers."}
      </p>
      <div className="mt-5 space-y-3">
        <DraftField label="Source name" value={sourceName} onChange={setSourceName} />
        <label className="block text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Source mode
          <select value={inputMode} onChange={(event) => setInputMode(event.target.value as EnrichmentInputMode)} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm font-bold normal-case text-white outline-none focus:border-emerald-700">
            <option value="paste">Paste JSON/CSV</option>
            <option value="url">Fetch from URL</option>
          </select>
        </label>
        <DraftField label="Source URL / reference (admin-only)" value={sourceUrl} onChange={setSourceUrl} />
        {inputMode === "url" && <>
          <label className="block text-xs font-black uppercase tracking-[0.14em] text-zinc-500">URL source type
            <select value={sourceType} onChange={(event) => setSourceType(event.target.value as UrlSourceType)} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm font-bold normal-case text-white outline-none focus:border-emerald-700">
              <option value="auto">Auto-detect</option>
              <option value="html">Generic HTML table/list</option>
              <option value="json">JSON endpoint</option>
              <option value="csv">CSV endpoint</option>
              <option value="text">Plain text</option>
            </select>
          </label>
        </>}
        <DraftField label="Modern year cutoff" value={yearCutoff} onChange={setYearCutoff} type="number" />
        <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/40 p-3 text-sm font-bold text-zinc-200">
          <input type="checkbox" checked={modernOnly} onChange={(event) => setModernOnly(event.target.checked)} />
          Modern/current only by default
        </label>
        {inputMode === "url" && <>
          <div className="rounded-xl border border-amber-800/30 bg-amber-950/10 p-3 text-xs leading-5 text-amber-100">
            Only import data you are allowed to use. URL import performs a one-page extraction for admin review and does not auto-publish.
          </div>
          <button onClick={() => void fetchUrl()} disabled={Boolean(busy) || !sourceUrl.trim()} className="w-full rounded-xl border border-sky-700/50 bg-sky-950/30 px-5 py-3 text-sm font-black text-sky-100 hover:bg-sky-900/40 disabled:opacity-50">
            {busy === "fetch-url" ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 inline h-4 w-4" />}Fetch URL + Extract Vehicles
          </button>
          {urlPreview && <div className="rounded-xl border border-sky-800/30 bg-sky-950/10 p-3 text-xs leading-5 text-sky-100">
            <div className="font-black text-white">Fetched: {urlPreview.title || "Untitled source"}</div>
            <div>Rows/items detected: {urlPreview.detectedRows + urlPreview.detectedItems}. Candidates: {urlPreview.extractedCandidateCount}. Confidence: {urlPreview.confidence}%.</div>
            <div className="text-sky-200/80">Content: {urlPreview.contentType || "unknown"} - {Math.round(urlPreview.fetchedBytes / 1024)} KB</div>
            {urlPreview.warnings.map((warning) => <div key={warning} className="text-amber-200">Warning: {warning}</div>)}
            {urlPreview.errors.map((error) => <div key={error} className="text-red-200">Error: {error}</div>)}
          </div>}
        </>}
        <label className="block text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Structured paste JSON or CSV
          <textarea value={text} onChange={(event) => setText(event.target.value)} className="mt-2 min-h-72 w-full rounded-xl border border-white/10 bg-black/50 p-4 font-mono text-xs normal-case leading-5 text-zinc-200 outline-none focus:border-emerald-700" />
        </label>
        <button onClick={() => void runCompare()} disabled={Boolean(busy)} className="w-full rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white hover:bg-emerald-600 disabled:opacity-50">
          {busy === "compare" ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 inline h-4 w-4" />}{mode === "coverage" ? "Dry-run coverage gap analysis" : "Dry-run normalize + compare"}
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

      {coverageStats && <div className="rounded-2xl border border-violet-900/40 bg-violet-950/10 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">Coverage diff dashboard</div>
            <h3 className="mt-2 text-2xl font-black">Global external source comparison</h3>
            <p className="mt-1 text-sm text-zinc-500">These are review candidates only. Public selector/cache changes only after explicit admin approval, publish and cache rebuild.</p>
          </div>
          <select value={coverageFilter} onChange={(event) => setCoverageFilter(event.target.value)} className="h-11 rounded-xl border border-white/10 bg-black/50 px-3 text-sm font-bold text-white outline-none">
            <option value="all">All issues</option>
            <option value="missing_brand">Missing brand</option>
            <option value="missing_model">Missing model</option>
            <option value="missing_generation">Missing generation</option>
            <option value="missing_engine">Missing engine</option>
            <option value="warning">Warnings</option>
            <option value="error">Errors</option>
          </select>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Mini label="Missing brands" value={coverageStats.missingBrands} />
          <Mini label="Missing models" value={coverageStats.missingModels} />
          <Mini label="Missing generations" value={coverageStats.missingGenerations} />
          <Mini label="Missing engines" value={coverageStats.missingEngines} />
          <Mini label="Alias suggestions" value={coverageStats.aliasSuggestions} />
          <Mini label="Duplicate risks" value={coverageStats.duplicateRisks} />
          <Mini label="Conflicts" value={coverageStats.conflicts} />
          <Mini label="Needs review" value={coverageStats.needsReview} />
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Filtered issues</div>
            <div className="mt-3 max-h-72 space-y-2 overflow-auto pr-1">
              {coverageIssues.slice(0, 12).map((item) => <div key={`${item.type}-${item.candidateId}-${item.message}`} className="rounded-xl border border-white/10 bg-black/40 p-3 text-xs leading-5 text-zinc-300">
                <div className={`font-black uppercase ${item.severity === "error" ? "text-red-300" : item.severity === "warning" ? "text-amber-300" : "text-sky-300"}`}>{item.type.replaceAll("_", " ")}</div>
                <div className="mt-1 text-white">{item.brand} {item.model ?? ""} {item.generation ?? ""} {item.engine ?? ""}</div>
                <div className="mt-1 text-zinc-500">{item.message}</div>
              </div>)}
              {!coverageIssues.length && <div className="text-sm text-zinc-500">Run a coverage dry-run to see issues.</div>}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Review queue</div>
            <div className="mt-3 max-h-72 space-y-2 overflow-auto pr-1">
              {(plan?.coverage.reviewQueue ?? []).slice(0, 12).map((item) => <div key={item.id} className="rounded-xl border border-white/10 bg-black/40 p-3 text-xs leading-5 text-zinc-300">
                <div className="font-black text-white">{item.kind.toUpperCase()} - {item.suggestedAction}</div>
                <div className="mt-1">{item.brand} {item.model ?? ""} {item.generation ?? ""} {item.engine ?? ""}</div>
                {item.blockedByVerifiedData && <div className="mt-1 text-red-300">Blocked by verified internal data.</div>}
              </div>)}
            </div>
          </div>
        </div>
        {plan?.coverage.aliasSuggestions.length ? <ImportExampleList title="Alias suggestions" items={plan.coverage.aliasSuggestions.slice(0, 10).map((item) => `${item.entityType}: ${item.sourceName} -> ${item.canonicalName} (${item.reason})`)} /> : null}
        {plan?.coverage.sourceMappings.length ? <ImportExampleList title="Source -> canonical mapping preview" items={plan.coverage.sourceMappings.slice(0, 10).map((item) => `${item.source.brand} / ${item.source.model} / ${item.source.generation ?? "-"} / ${item.source.engine ?? "-"} -> ${item.canonical.brand} / ${item.canonical.model} / ${item.canonical.generation ?? "-"} / ${item.canonical.engine ?? "-"} (${item.action})`)} /> : null}
      </div>}

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

function DraftField({ label, value, onChange, type = "text", min, disabled = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; min?: string; disabled?: boolean }) {
  return <label className="block text-xs font-black uppercase tracking-[0.14em] text-zinc-500">{label}<input type={type} min={min} step={type === "number" ? "1" : undefined} disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm font-bold normal-case text-white outline-none focus:border-red-700 disabled:cursor-not-allowed disabled:opacity-40" /></label>;
}

function FilterField({ label, value, onChange, placeholder, icon }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; icon?: ReactNode }) {
  return <label className="block text-xs font-black uppercase tracking-[0.12em] text-zinc-500">{label}<span className="mt-2 flex h-12 items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-4 text-zinc-500 focus-within:border-red-700">{icon}<input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-w-0 flex-1 bg-transparent text-sm font-bold normal-case text-white outline-none placeholder:text-zinc-700" /></span></label>;
}
