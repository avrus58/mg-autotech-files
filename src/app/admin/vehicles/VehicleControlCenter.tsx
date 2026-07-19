"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Database,
  Eye,
  FileClock,
  Filter,
  Gauge,
  GitBranch,
  Loader2,
  PlusCircle,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/authGuards";
import {
  vehicleAdminPageSizes,
  type VehicleAdminListResponse,
  type VehicleAdminPageSize,
  type VehicleAdminPublishFilter,
  type VehicleAdminVerificationFilter,
  type VehicleImportSummary,
} from "@/lib/vehicleControl/types";
import { parseVehicleAdminListQuery, vehicleAdminListQueryDefaults } from "@/lib/vehicleControl/schema";
import type { ExternalVehicleEntry, VehicleEnrichmentPlan } from "@/lib/vehicleEnrichment/types";
import { parseVehicleEnrichmentEntries } from "@/lib/vehicleEnrichment/parseInput";

type Section = "overview" | "brands" | "models" | "generations" | "engines" | "import" | "enrichment" | "coverage" | "validation" | "audit";

type OverviewPayload = {
  stats: {
    brandCount: number;
    modelCount: number;
    generationCount: number;
    engineCount: number;
    ecuVariantCount: number;
    publishedCount: number;
    draftCount: number;
    archivedCount: number;
    verifiedCount: number;
    needsReviewCount: number;
    validationWarningCount: number;
    duplicateWarningCount: number;
    duplicateScanRowCount: number;
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
  { id: "coverage", label: "Coverage", href: "/admin/vehicles/coverage" },
  { id: "validation", label: "Validation", href: "/admin/vehicles/validation" },
  { id: "audit", label: "Audit", href: "/admin/vehicles/audit" },
];

export default function VehicleControlCenter({ section = "overview" }: { section?: Section }) {
  const showsVehicleList = section !== "import" && section !== "enrichment" && section !== "coverage" && section !== "audit";
  const defaultVerificationStatus: VehicleAdminVerificationFilter = section === "validation" ? "needs_review" : "all";
  const [payload, setPayload] = useState<OverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [debouncedBrandFilter, setDebouncedBrandFilter] = useState("");
  const [modelFilter, setModelFilter] = useState("");
  const [debouncedModelFilter, setDebouncedModelFilter] = useState("");
  const [generationFilter, setGenerationFilter] = useState("");
  const [debouncedGenerationFilter, setDebouncedGenerationFilter] = useState("");
  const [ecuFamilyFilter, setEcuFamilyFilter] = useState("");
  const [debouncedEcuFamilyFilter, setDebouncedEcuFamilyFilter] = useState("");
  const [publishStatus, setPublishStatus] = useState<VehicleAdminPublishFilter>("all");
  const [verificationStatus, setVerificationStatus] = useState<VehicleAdminVerificationFilter>(defaultVerificationStatus);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<VehicleAdminPageSize>(vehicleAdminListQueryDefaults.pageSize);
  const [listPayload, setListPayload] = useState<VehicleAdminListResponse | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [listFiltersReady, setListFiltersReady] = useState(false);
  const [listRefreshToken, setListRefreshToken] = useState(0);
  const [importSummary, setImportSummary] = useState<VehicleImportSummary | null>(null);
  const [busyAction, setBusyAction] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState<CreateDraftState>(blankDraft);
  const [importConfirm, setImportConfirm] = useState("");

  const authFetch = authenticatedFetch;

  const load = useCallback(async (showInitialLoader = true) => {
    if (showInitialLoader) setLoading(true);
    setMessage("");
    try {
      const response = await authFetch("/api/admin/vehicles?includeRecords=false");
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
      if (showInitialLoader) setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  useEffect(() => {
    if (!showsVehicleList) return;
    const source = new URLSearchParams(window.location.search);
    const listParams = new URLSearchParams();
    for (const key of ["page", "pageSize", "q", "brand", "model", "generation", "ecuFamily", "publishStatus", "verificationStatus"]) {
      const value = source.get(key);
      if (value !== null) listParams.set(key, value);
    }
    const parsed = parseVehicleAdminListQuery(listParams);
    const initial = parsed.success ? parsed.data : {
      ...vehicleAdminListQueryDefaults,
      verificationStatus: defaultVerificationStatus,
    };
    const initialVerification = source.has("verificationStatus") ? initial.verificationStatus : defaultVerificationStatus;
    const timeout = window.setTimeout(() => {
      setQuery(initial.q);
      setDebouncedQuery(initial.q);
      setBrandFilter(initial.brand);
      setDebouncedBrandFilter(initial.brand);
      setModelFilter(initial.model);
      setDebouncedModelFilter(initial.model);
      setGenerationFilter(initial.generation);
      setDebouncedGenerationFilter(initial.generation);
      setEcuFamilyFilter(initial.ecuFamily);
      setDebouncedEcuFamilyFilter(initial.ecuFamily);
      setPublishStatus(initial.publishStatus);
      setVerificationStatus(initialVerification);
      setPage(initial.page);
      setPageSize(initial.pageSize);
      setListFiltersReady(true);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [defaultVerificationStatus, showsVehicleList]);

  useEffect(() => {
    if (!listFiltersReady) return;
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setDebouncedBrandFilter(brandFilter.trim());
      setDebouncedModelFilter(modelFilter.trim());
      setDebouncedGenerationFilter(generationFilter.trim());
      setDebouncedEcuFamilyFilter(ecuFamilyFilter.trim());
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [brandFilter, ecuFamilyFilter, generationFilter, listFiltersReady, modelFilter, query]);

  useEffect(() => {
    if (!listFiltersReady || !showsVehicleList) return;
    const params = new URLSearchParams(window.location.search);
    const setOrDelete = (key: string, value: string, defaultValue: string) => {
      if (value === defaultValue) params.delete(key);
      else params.set(key, value);
    };
    setOrDelete("q", debouncedQuery, "");
    setOrDelete("brand", debouncedBrandFilter, "");
    setOrDelete("model", debouncedModelFilter, "");
    setOrDelete("generation", debouncedGenerationFilter, "");
    setOrDelete("ecuFamily", debouncedEcuFamilyFilter, "");
    setOrDelete("publishStatus", publishStatus, "all");
    setOrDelete("verificationStatus", verificationStatus, defaultVerificationStatus);
    setOrDelete("page", String(page), "1");
    setOrDelete("pageSize", String(pageSize), String(vehicleAdminListQueryDefaults.pageSize));
    const next = params.toString();
    window.history.replaceState(null, "", next ? `${window.location.pathname}?${next}` : window.location.pathname);
  }, [debouncedBrandFilter, debouncedEcuFamilyFilter, debouncedGenerationFilter, debouncedModelFilter, debouncedQuery, defaultVerificationStatus, listFiltersReady, page, pageSize, publishStatus, showsVehicleList, verificationStatus]);

  useEffect(() => {
    if (!listFiltersReady || !showsVehicleList) return;
    const controller = new AbortController();

    async function loadList() {
      const requestedQuery = {
        page,
        pageSize,
        q: debouncedQuery,
        brand: debouncedBrandFilter,
        model: debouncedModelFilter,
        generation: debouncedGenerationFilter,
        ecuFamily: debouncedEcuFamilyFilter,
        publishStatus,
        verificationStatus,
      };
      setListPayload((current) => {
        if (!current) return null;
        const previous = current.query;
        const sameQuery = previous.page === requestedQuery.page &&
          previous.pageSize === requestedQuery.pageSize &&
          previous.q === requestedQuery.q &&
          previous.brand === requestedQuery.brand &&
          previous.model === requestedQuery.model &&
          previous.generation === requestedQuery.generation &&
          previous.ecuFamily === requestedQuery.ecuFamily &&
          previous.publishStatus === requestedQuery.publishStatus &&
          previous.verificationStatus === requestedQuery.verificationStatus;
        return sameQuery ? current : null;
      });
      setListLoading(true);
      setListError("");
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        q: debouncedQuery,
        brand: debouncedBrandFilter,
        model: debouncedModelFilter,
        generation: debouncedGenerationFilter,
        ecuFamily: debouncedEcuFamilyFilter,
        publishStatus,
        verificationStatus,
      });
      try {
        const response = await authFetch(`/api/admin/vehicles/search?${params}`, { signal: controller.signal });
        const data = await response.json();
        if (response.status === 401) {
          window.location.href = `/login?redirect=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`;
          return;
        }
        if (!response.ok) throw new Error(data.error || "Vehicle records could not be loaded.");
        const result = data as VehicleAdminListResponse;
        const normalizedPage = result.pagination.pageCount > 0 ? Math.min(result.pagination.page, result.pagination.pageCount) : 1;
        if (result.pagination.page !== normalizedPage) {
          setPage(normalizedPage);
          return;
        }
        if (!controller.signal.aborted) setListPayload(result);
      } catch (error) {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return;
        setListError(error instanceof Error ? error.message : "Vehicle records could not be loaded.");
      } finally {
        if (!controller.signal.aborted) setListLoading(false);
      }
    }

    void loadList();
    return () => controller.abort();
  }, [authFetch, debouncedBrandFilter, debouncedEcuFamilyFilter, debouncedGenerationFilter, debouncedModelFilter, debouncedQuery, listFiltersReady, listRefreshToken, page, pageSize, publishStatus, showsVehicleList, verificationStatus]);

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
      if (!dryRun) {
        setListRefreshToken((value) => value + 1);
        await load(false);
      }
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
      setListRefreshToken((value) => value + 1);
      await load(false);
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
      setListRefreshToken((value) => value + 1);
      await load(false);
      if (nextId) window.location.href = `/admin/vehicles/${nextId}`;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Vehicle draft could not be created.");
    } finally {
      setBusyAction("");
    }
  }

  function clearListFilters() {
    setQuery("");
    setDebouncedQuery("");
    setBrandFilter("");
    setDebouncedBrandFilter("");
    setModelFilter("");
    setDebouncedModelFilter("");
    setGenerationFilter("");
    setDebouncedGenerationFilter("");
    setEcuFamilyFilter("");
    setDebouncedEcuFamilyFilter("");
    setPublishStatus("all");
    setVerificationStatus(defaultVerificationStatus);
    setPage(1);
  }

  if (loading) {
    return <main role="status" aria-live="polite" className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
      <Loader2 aria-hidden="true" className="mr-3 h-5 w-5 animate-spin text-red-500 motion-reduce:animate-none" />Loading vehicle control center...
    </main>;
  }

  const stats = payload?.stats;
  const lastImport = payload?.importBatches?.[0];
  const records = listPayload?.records ?? [];
  const pagination = listPayload?.pagination;
  const hasActiveListFilters = Boolean(
    debouncedQuery ||
    debouncedBrandFilter ||
    debouncedModelFilter ||
    debouncedGenerationFilter ||
    debouncedEcuFamilyFilter
  ) || publishStatus !== "all" || verificationStatus !== defaultVerificationStatus;

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
          <button onClick={() => { setListRefreshToken((value) => value + 1); void load(false); }} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"><RefreshCcw className="mr-2 inline h-4 w-4" />Refresh</button>
          <button onClick={() => setShowCreate((value) => !value)} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black hover:bg-white/10"><PlusCircle className="mr-2 inline h-4 w-4" />Create draft</button>
          <button onClick={() => void runValidation()} disabled={busyAction === "validation"} className="rounded-xl border border-amber-800/40 bg-amber-950/20 px-4 py-3 text-sm font-black text-amber-200 disabled:opacity-50">{busyAction === "validation" ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 inline h-4 w-4" />}Run validation</button>
          <button onClick={() => void rebuildCatalogCache()} disabled={busyAction === "catalog-cache"} className="rounded-xl border border-sky-800/40 bg-sky-950/20 px-4 py-3 text-sm font-black text-sky-200 disabled:opacity-50">{busyAction === "catalog-cache" ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : <Database className="mr-2 inline h-4 w-4" />}Rebuild Public Catalog Cache</button>
          <Link href="/admin/vehicles/coverage" className="rounded-xl border border-violet-800/40 bg-violet-950/20 px-4 py-3 text-sm font-black text-violet-200 hover:bg-violet-900/30"><Sparkles className="mr-2 inline h-4 w-4" />Coverage</Link>
          <Link href="/admin/vehicles/enrichment" className="rounded-xl border border-emerald-800/40 bg-emerald-950/20 px-4 py-3 text-sm font-black text-emerald-200 hover:bg-emerald-900/30"><Sparkles className="mr-2 inline h-4 w-4" />Enrichment</Link>
          <Link href="/admin/vehicles/import" className="rounded-xl bg-[#b1121b] px-4 py-3 text-sm font-black text-white hover:bg-[#c91824]"><UploadCloud className="mr-2 inline h-4 w-4" />Import tools</Link>
        </div>
      </div>
    </header>

    <div className="mx-auto max-w-[1500px] px-4 py-6">
      {message && <div role="alert" className="mb-5 rounded-xl border border-red-800/40 bg-red-950/20 p-4 text-sm text-red-100">{message}</div>}
      {payload?.permissionWarnings?.map((warning) => <div key={warning} className="mb-5 rounded-xl border border-amber-800/40 bg-amber-950/20 p-4 text-sm leading-6 text-amber-100">
        <ShieldCheck className="mr-2 inline h-4 w-4 text-amber-300" />{warning}
      </div>)}
      <nav aria-label="Vehicle database sections" className="mb-6 flex gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03] p-2">
        {sectionLinks.map((item) => <Link key={item.id} href={item.href} aria-current={section === item.id ? "page" : undefined} className={`inline-flex min-h-11 shrink-0 items-center rounded-xl px-4 py-2 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${section === item.id ? "bg-[#b1121b] text-white" : "text-zinc-400 hover:bg-white/10 hover:text-white"}`}>{item.label}</Link>)}
      </nav>

      {stats && <section aria-labelledby="catalog-summary-title">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="catalog-summary-title" className="text-lg font-black">Catalogue operational summary</h2>
            <p className="mt-1 text-sm text-zinc-400">Exact hierarchy, controller, publish and review counts; duplicate-key screening is bounded.</p>
          </div>
          <span className="text-xs font-bold text-zinc-400">Customer-safe publishing remains explicit and validation-gated.</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <Metric icon={<GitBranch />} label="Canonical hierarchy" value={stats.engineCount} helper={`${stats.brandCount} brands · ${stats.modelCount} models · ${stats.generationCount} generations`} />
          <Metric icon={<Gauge />} label="ECU variants" value={stats.ecuVariantCount} helper="Controller metadata records linked to engines" />
          <Metric icon={<Eye />} label="Publish state" value={stats.publishedCount} helper={`${stats.draftCount} draft · ${stats.archivedCount} archived`} />
          <Metric icon={<ShieldCheck />} label="Verification" value={stats.verifiedCount} helper={`${stats.needsReviewCount} explicitly need review`} tone={stats.needsReviewCount > 0 ? "amber" : "green"} />
          <Metric icon={<AlertTriangle />} label="Open validation" value={stats.validationWarningCount} helper={`${stats.duplicateWarningCount} duplicate groups across ${stats.duplicateScanRowCount} screened keys`} tone={stats.validationWarningCount + stats.duplicateWarningCount > 0 ? "amber" : "green"} />
          <Metric icon={<CheckCircle2 />} label="Data health" value={`${stats.dataHealthScore}%`} helper="Publish coverage and open validation score" tone={stats.dataHealthScore >= 90 ? "green" : "default"} />
        </div>
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

      {(section === "enrichment" || section === "coverage") && <EnrichmentSection mode={section} authFetch={authFetch} setMessage={setMessage} />}

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

      {showsVehicleList && <section aria-labelledby="vehicle-records-title" aria-busy={listLoading} className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 id="vehicle-records-title" className="text-2xl font-black">{section === "validation" ? "Records needing review" : "Vehicle records"}</h2>
            <p className="mt-1 text-sm text-zinc-400">Server-filtered results. Customer selectors receive only active, published customer-safe fields.</p>
          </div>
          <p aria-live="polite" className="text-sm font-bold tabular-nums text-zinc-400">
            {listLoading ? (listPayload ? `Updating page ${page}...` : "Loading records...") : `${pagination?.total ?? 0} matching record${pagination?.total === 1 ? "" : "s"}${pagination?.pageCount ? `, page ${pagination.page} of ${pagination.pageCount}` : ""}`}
          </p>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
          <label className="block md:col-span-2 xl:col-span-2 2xl:col-span-1">
            <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-zinc-400">Search</span>
            <span className="flex h-11 items-center gap-3 rounded-xl border border-white/10 bg-black/40 px-3 focus-within:border-red-700 focus-within:ring-2 focus-within:ring-red-900/50">
              <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-zinc-500" />
              <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} maxLength={120} placeholder="Vehicle, engine, key or source" className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none placeholder:text-zinc-600" />
            </span>
          </label>
          <VehicleTextFilter label="Brand" value={brandFilter} placeholder="e.g. BMW" onChange={(value) => { setBrandFilter(value); setPage(1); }} />
          <VehicleTextFilter label="Model" value={modelFilter} placeholder="e.g. 5 Series" onChange={(value) => { setModelFilter(value); setPage(1); }} />
          <VehicleTextFilter label="Generation" value={generationFilter} placeholder="e.g. G30" onChange={(value) => { setGenerationFilter(value); setPage(1); }} />
          <VehicleTextFilter label="ECU family" value={ecuFamilyFilter} placeholder="e.g. MD1" onChange={(value) => { setEcuFamilyFilter(value); setPage(1); }} />
          <label className="block">
            <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-zinc-400">Publish state</span>
            <span className="flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 focus-within:border-red-700 focus-within:ring-2 focus-within:ring-red-900/50">
              <Filter aria-hidden="true" className="h-4 w-4 shrink-0 text-zinc-500" />
              <select value={publishStatus} onChange={(event) => { setPublishStatus(event.target.value as VehicleAdminPublishFilter); setPage(1); }} className="min-w-0 flex-1 bg-[#070707] text-sm font-bold outline-none">
                <option value="all">All states</option><option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option>
              </select>
            </span>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-zinc-400">Verification</span>
            <select value={verificationStatus} onChange={(event) => { setVerificationStatus(event.target.value as VehicleAdminVerificationFilter); setPage(1); }} className="h-11 w-full rounded-xl border border-white/10 bg-[#070707] px-3 text-sm font-bold outline-none focus-visible:border-red-700 focus-visible:ring-2 focus-visible:ring-red-900/50">
              <option value="all">All verification</option><option value="verified">Verified</option><option value="needs_review">Needs review</option><option value="unverified">Unverified</option><option value="imported">Imported</option><option value="rejected">Rejected</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-zinc-400">Page size</span>
            <select value={pageSize} onChange={(event) => { const next = Number(event.target.value); if (vehicleAdminPageSizes.includes(next as VehicleAdminPageSize)) setPageSize(next as VehicleAdminPageSize); setPage(1); }} className="h-11 w-full rounded-xl border border-white/10 bg-[#070707] px-3 text-sm font-bold outline-none focus-visible:border-red-700 focus-visible:ring-2 focus-visible:ring-red-900/50">
              {vehicleAdminPageSizes.map((size) => <option key={size} value={size}>{size} rows</option>)}
            </select>
          </label>
          <button type="button" onClick={clearListFilters} disabled={!hasActiveListFilters} className="h-11 self-end rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-black text-zinc-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-40">Clear filters</button>
        </div>

        {listError && <div role="alert" className="mt-4 flex flex-col gap-3 rounded-xl border border-amber-800/40 bg-amber-950/20 p-4 text-sm text-amber-100 sm:flex-row sm:items-center sm:justify-between">
          <span>{listError}{listPayload ? " Showing the last successful result." : ""}</span>
          <button type="button" onClick={() => setListRefreshToken((value) => value + 1)} className="h-11 shrink-0 rounded-xl border border-amber-700/50 px-4 font-black hover:bg-amber-900/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400">Retry</button>
        </div>}

        <div role="table" aria-label="Vehicle record search results" aria-colcount={6} className="mt-5 overflow-hidden rounded-2xl border border-white/10">
          <div role="row" className="sr-only grid-cols-[1.2fr_1fr_1fr_1.1fr_150px_120px] gap-3 border-b border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-zinc-400 xl:not-sr-only xl:grid">
            <div role="columnheader">Vehicle</div><div role="columnheader">Generation</div><div role="columnheader">ECU</div><div role="columnheader">Services</div><div role="columnheader">Status</div><div role="columnheader">Action</div>
          </div>
          <div role="rowgroup" className={`divide-y divide-white/10 transition-opacity ${listLoading && listPayload ? "opacity-60" : "opacity-100"}`}>
            {listLoading && !listPayload && Array.from({ length: 6 }, (_, index) => <div role="row" key={index} className="grid gap-3 px-4 py-4 xl:grid-cols-[1.2fr_1fr_1fr_1.1fr_150px_120px]">
              {Array.from({ length: 6 }, (__, cell) => <div role="cell" key={cell} className="h-11 animate-pulse rounded-lg bg-white/[0.06] motion-reduce:animate-none" />)}
            </div>)}
            {records.map((record) => {
              const publishTone = record.publishStatus === "published" ? "bg-emerald-950/30 text-emerald-300" : record.publishStatus === "archived" ? "bg-amber-950/30 text-amber-300" : "bg-zinc-900 text-zinc-400";
              return <div role="row" key={record.id ?? record.vehicleKey} className="grid min-w-0 gap-4 px-4 py-4 xl:grid-cols-[1.2fr_1fr_1fr_1.1fr_150px_120px] xl:items-center">
                <div role="cell" className="min-w-0"><div className="break-words text-lg font-black text-white">{record.brand} {record.model}</div><div className="mt-1 break-words text-sm font-bold text-zinc-300">{record.engine}</div><div className="mt-1 break-all text-xs text-zinc-400">{record.vehicleKey}</div></div>
                <div role="cell" className="min-w-0 break-words text-sm text-zinc-300"><span className="mb-1 block text-[11px] font-black uppercase tracking-[0.12em] text-zinc-400 xl:hidden">Generation</span>{record.generation}<div className="mt-1 text-xs text-zinc-400">{[record.yearFrom, record.yearTo ?? "open"].filter(Boolean).join(" - ")}</div></div>
                <div role="cell" className="min-w-0 break-words text-sm text-zinc-300"><span className="mb-1 block text-[11px] font-black uppercase tracking-[0.12em] text-zinc-400 xl:hidden">ECU</span>{record.ecuType || "Not recorded"}<div className="mt-1 break-all text-xs text-zinc-400">{record.ecuFamily || "Family unknown"}</div></div>
                <div role="cell" className="min-w-0"><span className="mb-2 block text-[11px] font-black uppercase tracking-[0.12em] text-zinc-400 xl:hidden">Services</span><div className="flex flex-wrap gap-1">{record.services.slice(0, 5).map((service) => <span key={service} className="rounded-full bg-red-950/30 px-2 py-1 text-[11px] font-black text-red-200">{service.replaceAll("_", " ").toUpperCase()}</span>)}{record.services.length > 5 && <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] font-black text-zinc-300">+{record.services.length - 5} more</span>}{record.services.length === 0 && <span className="text-xs text-zinc-400">None recorded</span>}</div></div>
                <div role="cell"><span className="mb-2 block text-[11px] font-black uppercase tracking-[0.12em] text-zinc-400 xl:hidden">Status</span><span className={`rounded-full px-3 py-1 text-xs font-black capitalize ${publishTone}`}>{record.publishStatus}</span><div className="mt-2 text-xs text-zinc-400">{record.verificationStatus.replaceAll("_", " ")} - {record.confidenceScore}%</div></div>
                <div role="cell"><Link href={`/admin/vehicles/${record.id}`} className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm font-black transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"><Eye className="mr-2 h-4 w-4" />Open</Link></div>
              </div>;
            })}
            {!listLoading && !listError && records.length === 0 && <div role="row"><div role="cell" aria-colspan={6} className="p-8 text-center">
              <div className="text-base font-black text-zinc-300">{hasActiveListFilters ? "No records match these filters." : "No vehicle records are available."}</div>
              <p className="mt-2 text-sm text-zinc-400">{hasActiveListFilters ? "Clear the filters or try a broader vehicle or engine term." : "Create or import a draft to start the catalogue."}</p>
              {hasActiveListFilters && <button type="button" onClick={clearListFilters} className="mt-4 h-11 rounded-xl border border-white/10 px-4 text-sm font-black hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">Clear filters</button>}
            </div></div>}
          </div>
        </div>

        {pagination && pagination.total > 0 && <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm tabular-nums text-zinc-400">Page <span className="font-black text-zinc-200">{pagination.page}</span> of <span className="font-black text-zinc-200">{pagination.pageCount}</span> - {pagination.total} total</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={!pagination.hasPreviousPage || listLoading} className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 px-4 text-sm font-black transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft className="mr-1 h-4 w-4" />Previous</button>
            <button type="button" onClick={() => setPage((value) => value + 1)} disabled={!pagination.hasNextPage || listLoading} className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 px-4 text-sm font-black transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-40">Next<ChevronRight className="ml-1 h-4 w-4" /></button>
          </div>
        </div>}
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

function Metric({ icon, label, value, helper, tone = "default" }: { icon: ReactNode; label: string; value: string | number; helper: string; tone?: "default" | "green" | "amber" }) {
  const iconTone = tone === "green" ? "bg-emerald-950/30 text-emerald-400" : tone === "amber" ? "bg-amber-950/30 text-amber-300" : "bg-red-950/30 text-red-400";
  return <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
    <div className="flex items-center justify-between gap-3"><div aria-hidden="true" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconTone}`}>{icon}</div><div className="text-right text-xs font-black uppercase tracking-[0.16em] text-zinc-400">{label}</div></div>
    <div className="mt-5 text-3xl font-black tabular-nums">{value}</div>
    <div className="mt-2 text-xs leading-5 text-zinc-400">{helper}</div>
  </div>;
}

function VehicleTextFilter({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  return <label className="block">
    <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-zinc-400">{label}</span>
    <input value={value} onChange={(event) => onChange(event.target.value)} maxLength={120} placeholder={placeholder} className="h-11 w-full rounded-xl border border-white/10 bg-[#070707] px-3 text-sm font-bold outline-none placeholder:text-zinc-500 focus-visible:border-red-700 focus-visible:ring-2 focus-visible:ring-red-900/50" />
  </label>;
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
