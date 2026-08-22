"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/authGuards";
import {
  buildGrowthClassificationChange,
  isGrowthClassificationDraftChanged,
  type GrowthCustomerClassificationDraft,
  validateGrowthClassificationChanges,
} from "@/lib/growth/customerClassificationReview";
import {
  growthCustomerClassifications,
  type GrowthCustomerClassification,
  type GrowthCustomerClassificationAdminResponse,
} from "@/lib/growth/types";

const labels: Record<GrowthCustomerClassification, string> = {
  unreviewed: "Unreviewed",
  real_customer: "Verified real customer",
  internal_test: "Internal / test account",
  staff_operated: "Staff-operated account",
};

function money(amountMinor: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amountMinor / 100);
  } catch {
    return `${(amountMinor / 100).toFixed(2)} ${currency}`;
  }
}

function date(value: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: "Europe/Berlin",
  }).format(parsed);
}

function badgeClasses(classification: GrowthCustomerClassification) {
  if (classification === "real_customer") return "border-emerald-700/50 bg-emerald-950/30 text-emerald-200";
  if (classification === "internal_test") return "border-amber-700/50 bg-amber-950/30 text-amber-200";
  if (classification === "staff_operated") return "border-violet-700/50 bg-violet-950/30 text-violet-200";
  return "border-white/10 bg-white/[0.04] text-zinc-400";
}

function draftsFrom(data: GrowthCustomerClassificationAdminResponse) {
  return Object.fromEntries(data.customers.map((row) => [row.userId, {
    classification: row.classification,
  } satisfies GrowthCustomerClassificationDraft]));
}

export default function CustomerDataQualityPanel({ onUpdated }: { onUpdated: () => void }) {
  const [data, setData] = useState<GrowthCustomerClassificationAdminResponse | null>(null);
  const [drafts, setDrafts] = useState<Record<string, GrowthCustomerClassificationDraft>>({});
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | GrowthCustomerClassification>("unreviewed");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [allowed, setAllowed] = useState(true);

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await authenticatedFetch("/api/admin/growth/customers", { cache: "no-store" });
      if (response.status === 403) {
        setAllowed(false);
        return;
      }
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Customer classification could not be loaded.");
      const next = payload as GrowthCustomerClassificationAdminResponse;
      setData(next);
      setDrafts(draftsFrom(next));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Customer classification could not be loaded.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const dirtyRows = useMemo(() => (data?.customers ?? []).filter((row) => {
    const draft = drafts[row.userId];
    return draft ? isGrowthClassificationDraftChanged(row, draft) : false;
  }), [data, drafts]);
  const dirtyCount = dirtyRows.length;

  useEffect(() => {
    if (!dirtyCount) return;
    const protectDrafts = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", protectDrafts);
    return () => window.removeEventListener("beforeunload", protectDrafts);
  }, [dirtyCount]);

  useEffect(() => {
    if (!dirtyCount) return;
    const protectClientNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const nextUrl = new URL(anchor.href, window.location.href);
      if (nextUrl.origin !== window.location.origin || nextUrl.href === window.location.href) return;
      if (window.confirm("Discard unsaved customer type changes and leave this page?")) return;
      event.preventDefault();
      event.stopPropagation();
    };
    document.addEventListener("click", protectClientNavigation, true);
    return () => document.removeEventListener("click", protectClientNavigation, true);
  }, [dirtyCount]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (data?.customers ?? []).filter((row) => {
      if (filter !== "all" && row.classification !== filter) return false;
      if (!needle) return true;
      return [row.customerReference, row.email, row.fullName]
        .some((value) => value?.toLowerCase().includes(needle));
    });
  }, [data, filter, query]);

  const updateDraft = (userId: string, next: Partial<GrowthCustomerClassificationDraft>) => {
    if (busy) return;
    setDrafts((current) => ({
      ...current,
      [userId]: { ...(current[userId] ?? { classification: "unreviewed" }), ...next },
    }));
    setError("");
    setFeedback("");
  };

  const discardChanges = () => {
    if (!data || !dirtyCount) return;
    setDrafts(draftsFrom(data));
    setError("");
    setFeedback("Unsaved customer type changes discarded.");
  };

  const refreshAccounts = async () => {
    if (dirtyCount && !window.confirm("Discard unsaved customer type changes and reload?")) return;
    await load();
  };

  const saveAll = async () => {
    if (!data || !dirtyCount || busy) return;
    const changes = dirtyRows.map((row) => buildGrowthClassificationChange(row, drafts[row.userId]));
    const validationError = validateGrowthClassificationChanges(changes);
    if (validationError) {
      setError(validationError);
      return;
    }

    setBusy(true);
    setError("");
    setFeedback("");
    try {
      const response = await authenticatedFetch("/api/admin/growth/customers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Customer types could not be saved.");
      const savedCount = Number(payload.savedCount ?? changes.length);
      await load();
      onUpdated();
      setFeedback(`${savedCount} customer type${savedCount === 1 ? "" : "s"} saved.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Customer types could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  if (!allowed) return null;

  return (
    <section className={`border border-white/10 bg-[#0b0c0e] ${dirtyCount ? "pb-24" : ""}`} aria-labelledby="customer-data-quality-title">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 px-5 py-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-400">Customer management</p>
          <h2 id="customer-data-quality-title" className="mt-1 text-xl font-black">Customer types</h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500">
            Choose the right customer type and save your changes. Account access, orders, payments and credits are never changed here.
          </p>
        </div>
        <button type="button" onClick={() => void refreshAccounts()} disabled={busy} className="inline-flex h-10 items-center gap-2 border border-white/10 bg-black/20 px-4 text-xs font-black hover:border-amber-700/50 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} aria-hidden="true" />Refresh accounts
        </button>
      </div>

      {data && (
        <div className="grid border-b border-white/10 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Customer accounts", value: data.summary.total, Icon: Users, tone: "text-zinc-300" },
            { label: "Needs review", value: data.summary.unreviewed, Icon: Search, tone: "text-amber-300" },
            { label: "Verified real", value: data.summary.verifiedReal, Icon: UserCheck, tone: "text-emerald-300" },
            { label: "Excluded safely", value: data.summary.excluded, Icon: ShieldCheck, tone: "text-violet-300" },
          ].map(({ label, value, Icon, tone }) => (
            <div key={label} className="border-b border-white/10 px-4 py-4 last:border-b-0 sm:border-r xl:border-b-0">
              <div className="flex items-center justify-between gap-3 text-zinc-500"><span className="text-[10px] font-black uppercase tracking-[0.14em]">{label}</span><Icon className={`h-4 w-4 ${tone}`} aria-hidden="true" /></div>
              <div className="mt-2 text-2xl font-black">{value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-800/30 bg-[#11100b]/95 px-5 py-3 shadow-xl backdrop-blur">
        <div className="flex items-center gap-3">
          <span className={`grid h-9 w-9 place-items-center border ${dirtyCount ? "border-amber-600/50 bg-amber-950/40 text-amber-200" : "border-emerald-700/40 bg-emerald-950/20 text-emerald-300"}`}>
            {dirtyCount ? <Save className="h-4 w-4" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
          </span>
          <div>
            <p className="text-xs font-black text-zinc-100">{dirtyCount ? `${dirtyCount} unsaved change${dirtyCount === 1 ? "" : "s"}` : "All changes saved"}</p>
            <p className="text-[10px] leading-4 text-zinc-500">Choose customer types, then save once.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={discardChanges} disabled={!dirtyCount || busy} className="inline-flex h-10 items-center gap-2 border border-white/10 px-3 text-xs font-black text-zinc-300 hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-35">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />Discard
          </button>
          <button type="button" onClick={() => void saveAll()} disabled={!dirtyCount || busy} className="inline-flex h-10 items-center gap-2 bg-amber-400 px-4 text-xs font-black text-black hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500">
            <Save className="h-4 w-4" aria-hidden="true" />{busy ? "Saving..." : `Save changes${dirtyCount ? ` (${dirtyCount})` : ""}`}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-5 py-3">
        <label className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" aria-hidden="true" />
          <span className="sr-only">Search customers</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customer ID, name or email" className="h-10 w-full border border-white/10 bg-black/30 pl-10 pr-3 text-sm outline-none focus:border-amber-700/60" />
        </label>
        <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} aria-label="Filter customer types" className="h-10 border border-white/10 bg-[#111214] px-3 text-xs font-black outline-none focus:border-amber-700/60">
          <option value="all">All accounts</option>
          {growthCustomerClassifications.map((value) => <option key={value} value={value}>{labels[value]}</option>)}
        </select>
      </div>

      {error && <div role="alert" className="border-b border-red-800/40 bg-red-950/20 px-5 py-3 text-sm text-red-100">{error}</div>}
      {feedback && <div role="status" className="border-b border-emerald-800/40 bg-emerald-950/20 px-5 py-3 text-sm text-emerald-100">{feedback}</div>}

      {!data && !error ? (
        <div className="grid min-h-40 place-items-center text-sm text-zinc-500"><span><RefreshCw className="mr-2 inline h-4 w-4 animate-spin" />Loading customers...</span></div>
      ) : rows.length ? (
        <div>
          <div className="hidden border-b border-white/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-600 lg:grid lg:grid-cols-[minmax(220px,1.15fr)_minmax(220px,1fr)_minmax(240px,0.9fr)] lg:gap-4" aria-hidden="true">
            <span>Customer</span><span>Activity</span><span>Customer type</span>
          </div>
          <div className="divide-y divide-white/5">
            {rows.map((row) => {
              const draft = drafts[row.userId] ?? { classification: row.classification };
              const changed = isGrowthClassificationDraftChanged(row, draft);
              return (
                <article key={row.userId} aria-label={`Customer ${row.customerReference}`} className={`grid gap-4 px-4 py-4 transition-colors lg:grid-cols-[minmax(220px,1.15fr)_minmax(220px,1fr)_minmax(240px,0.9fr)] ${changed ? "bg-amber-950/10 shadow-[inset_3px_0_0_#f59e0b]" : "hover:bg-white/[0.02]"}`}>
                  <div className="min-w-0">
                    <div className="mb-2 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-600 lg:hidden">Customer</div>
                    <div className="flex flex-wrap items-center gap-2"><span className="font-black text-white">{row.customerReference}</span>{changed && <span className="border border-amber-700/50 bg-amber-950/30 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-amber-200">Pending</span>}</div>
                    <div className="mt-1 max-w-[250px] break-all text-xs text-zinc-500">{row.email || "No email"}</div>
                    <div className="mt-1 text-[11px] text-zinc-600">Registered {date(row.createdAt)}</div>
                    <Link href={`/admin/growth/customers/${row.userId}`} className="mt-3 inline-flex items-center gap-1.5 border border-white/10 px-2.5 py-1.5 text-[10px] font-black text-zinc-300 hover:border-red-700/50 hover:text-white">
                      View Customer 360 <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                    </Link>
                  </div>
                  <div className="order-3 min-w-0 lg:order-2">
                    <div className="mb-2 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-600 lg:hidden">Activity</div>
                    <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.08em]"><span className="border border-white/10 px-2 py-1 text-zinc-300">{row.orderCount} request{row.orderCount === 1 ? "" : "s"}</span><span className="border border-white/10 px-2 py-1 text-zinc-300">{row.paymentCount} payment{row.paymentCount === 1 ? "" : "s"}</span></div>
                    <div className="mt-2 text-xs font-black text-zinc-200">{row.revenue.length ? row.revenue.map((item) => money(item.amountMinor, item.currency)).join(" / ") : "No recorded revenue"}</div>
                    <div className="mt-1 text-[11px] text-zinc-600">Last request {date(row.lastOrderAt)}</div>
                  </div>
                  <div className="order-2 min-w-0 lg:order-3">
                    <div className="mb-2 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-600 lg:hidden">Customer type</div>
                    <div className="flex flex-wrap items-center gap-2"><span className="text-[9px] font-black uppercase tracking-[0.1em] text-zinc-600">Current</span><span className={`inline-flex border px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em] ${badgeClasses(row.classification)}`}>{labels[row.classification]}</span></div>
                    <label className="mt-2 block"><span className="sr-only">Customer type for {row.customerReference}</span><select value={draft.classification} onChange={(event) => updateDraft(row.userId, { classification: event.target.value as GrowthCustomerClassification })} disabled={busy} aria-label={`Customer type for ${row.customerReference}`} className="h-11 w-full border border-white/10 bg-[#111214] px-3 text-xs font-black outline-none focus:border-amber-700/60 disabled:cursor-wait disabled:opacity-60 lg:min-w-[230px]">{growthCustomerClassifications.map((value) => <option key={value} value={value}>{labels[value]}</option>)}</select></label>
                    {row.verifiedAt && <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-400"><CheckCircle2 className="h-3 w-3" aria-hidden="true" />Last reviewed {date(row.verifiedAt)}</div>}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="px-5 py-10 text-center text-sm text-zinc-500">No customer accounts match this filter.</div>
      )}

      {dirtyCount > 0 && (
        <div className="fixed bottom-3 left-3 right-3 z-50 flex items-center justify-between gap-3 border border-amber-600/45 bg-[#171208]/95 p-3 shadow-2xl backdrop-blur sm:left-auto sm:right-6 sm:w-auto">
          <span className="text-xs font-black text-amber-100" aria-live="polite">{dirtyCount} unsaved change{dirtyCount === 1 ? "" : "s"}</span>
          <button type="button" onClick={() => void saveAll()} disabled={busy} className="inline-flex h-11 items-center gap-2 bg-amber-400 px-4 text-xs font-black text-black hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500">
            <Save className="h-4 w-4" aria-hidden="true" />{busy ? "Saving..." : "Save changes"}
          </button>
        </div>
      )}
    </section>
  );
}
