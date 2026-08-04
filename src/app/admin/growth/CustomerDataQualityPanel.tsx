"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
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
  classificationNeedsEvidenceNote,
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
    reason: row.reason ?? "",
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
    setDrafts((current) => ({
      ...current,
      [userId]: { ...(current[userId] ?? { classification: "unreviewed", reason: "" }), ...next },
    }));
    setError("");
    setFeedback("");
  };

  const discardChanges = () => {
    if (!data || !dirtyCount) return;
    setDrafts(draftsFrom(data));
    setError("");
    setFeedback("Pending changes discarded. No customer record was changed.");
  };

  const refreshAccounts = async () => {
    if (dirtyCount && !window.confirm("Discard pending customer reviews and reload the server data?")) return;
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
      if (!response.ok) throw new Error(payload.error || "Customer reviews could not be saved.");
      const savedCount = Number(payload.savedCount ?? changes.length);
      await load();
      onUpdated();
      setFeedback(`${savedCount} customer review${savedCount === 1 ? "" : "s"} saved in one audited batch.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Customer reviews could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  if (!allowed) return null;

  return (
    <section className="border border-white/10 bg-[#0b0c0e]" aria-labelledby="customer-data-quality-title">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 px-5 py-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-400">Admin-only review queue</p>
          <h2 id="customer-data-quality-title" className="mt-1 text-xl font-black">Customer truth review</h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500">
            Stage multiple decisions, add the evidence used, then save the complete batch once. Account access, orders, payments and credits are never changed here.
          </p>
        </div>
        <button type="button" onClick={() => void refreshAccounts()} disabled={busy} className="inline-flex h-10 items-center gap-2 border border-white/10 bg-black/20 px-4 text-xs font-black hover:border-amber-700/50 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} aria-hidden="true" />Refresh accounts
        </button>
      </div>

      {data && (
        <div className="grid border-b border-white/10 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "Customer accounts", value: data.summary.total, Icon: Users, tone: "text-zinc-300" },
            { label: "Needs review", value: data.summary.unreviewed, Icon: Search, tone: "text-amber-300" },
            { label: "Verified real", value: data.summary.verifiedReal, Icon: UserCheck, tone: "text-emerald-300" },
            { label: "Excluded safely", value: data.summary.excluded, Icon: ShieldCheck, tone: "text-violet-300" },
            { label: "Evidence gaps", value: data.summary.evidenceGaps, Icon: AlertTriangle, tone: data.summary.evidenceGaps ? "text-red-300" : "text-emerald-300" },
          ].map(({ label, value, Icon, tone }) => (
            <div key={label} className="border-b border-white/10 px-4 py-4 last:border-b-0 sm:border-r xl:border-b-0">
              <div className="flex items-center justify-between gap-3 text-zinc-500"><span className="text-[10px] font-black uppercase tracking-[0.14em]">{label}</span><Icon className={`h-4 w-4 ${tone}`} aria-hidden="true" /></div>
              <div className="mt-2 text-2xl font-black">{value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-amber-800/30 bg-[#11100b]/95 px-5 py-3 shadow-xl backdrop-blur">
        <div className="flex items-center gap-3">
          <span className={`grid h-9 w-9 place-items-center border ${dirtyCount ? "border-amber-600/50 bg-amber-950/40 text-amber-200" : "border-emerald-700/40 bg-emerald-950/20 text-emerald-300"}`}>
            {dirtyCount ? <Save className="h-4 w-4" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
          </span>
          <div>
            <p className="text-xs font-black text-zinc-100">{dirtyCount ? `${dirtyCount} pending review${dirtyCount === 1 ? "" : "s"}` : "All reviews saved"}</p>
            <p className="text-[10px] leading-4 text-zinc-500">Atomic save: every valid change is written together, or none are.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={discardChanges} disabled={!dirtyCount || busy} className="inline-flex h-10 items-center gap-2 border border-white/10 px-3 text-xs font-black text-zinc-300 hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-35">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />Discard
          </button>
          <button type="button" onClick={() => void saveAll()} disabled={!dirtyCount || busy} className="inline-flex h-10 items-center gap-2 bg-amber-400 px-4 text-xs font-black text-black hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500">
            <Save className="h-4 w-4" aria-hidden="true" />{busy ? "Saving batch..." : `Save all changes${dirtyCount ? ` (${dirtyCount})` : ""}`}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-5 py-3">
        <label className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" aria-hidden="true" />
          <span className="sr-only">Search customers</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customer ID, name or email" className="h-10 w-full border border-white/10 bg-black/30 pl-10 pr-3 text-sm outline-none focus:border-amber-700/60" />
        </label>
        <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} aria-label="Filter classifications" className="h-10 border border-white/10 bg-[#111214] px-3 text-xs font-black outline-none focus:border-amber-700/60">
          <option value="all">All accounts</option>
          {growthCustomerClassifications.map((value) => <option key={value} value={value}>{labels[value]}</option>)}
        </select>
      </div>

      {error && <div role="alert" className="border-b border-red-800/40 bg-red-950/20 px-5 py-3 text-sm text-red-100">{error}</div>}
      {feedback && <div role="status" className="border-b border-emerald-800/40 bg-emerald-950/20 px-5 py-3 text-sm text-emerald-100">{feedback}</div>}

      {!data && !error ? (
        <div className="grid min-h-40 place-items-center text-sm text-zinc-500"><span><RefreshCw className="mr-2 inline h-4 w-4 animate-spin" />Loading customer review queue...</span></div>
      ) : rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead className="border-b border-white/10 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-600">
              <tr><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Business evidence</th><th className="px-4 py-3">Review decision</th><th className="px-4 py-3">Evidence / audit note</th></tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((row) => {
                const draft = drafts[row.userId] ?? { classification: row.classification, reason: row.reason ?? "" };
                const changed = isGrowthClassificationDraftChanged(row, draft);
                const evidenceGap = row.classification !== "unreviewed" && !row.reason?.trim();
                return (
                  <tr key={row.userId} className={`align-top transition-colors ${changed ? "bg-amber-950/10 shadow-[inset_3px_0_0_#f59e0b]" : "hover:bg-white/[0.02]"}`}>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2"><span className="font-black text-white">{row.customerReference}</span>{changed && <span className="border border-amber-700/50 bg-amber-950/30 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-amber-200">Pending</span>}</div>
                      <div className="mt-1 max-w-[250px] break-all text-xs text-zinc-500">{row.email || "No email"}</div>
                      <div className="mt-1 text-[11px] text-zinc-600">Registered {date(row.createdAt)}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.08em]"><span className="border border-white/10 px-2 py-1 text-zinc-300">{row.orderCount} request{row.orderCount === 1 ? "" : "s"}</span><span className="border border-white/10 px-2 py-1 text-zinc-300">{row.paymentCount} payment{row.paymentCount === 1 ? "" : "s"}</span></div>
                      <div className="mt-2 text-xs font-black text-zinc-200">{row.revenue.length ? row.revenue.map((item) => money(item.amountMinor, item.currency)).join(" / ") : "No recorded revenue"}</div>
                      <div className="mt-1 text-[11px] text-zinc-600">Last request {date(row.lastOrderAt)}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2"><span className="text-[9px] font-black uppercase tracking-[0.1em] text-zinc-600">Current</span><span className={`inline-flex border px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em] ${badgeClasses(row.classification)}`}>{labels[row.classification]}</span></div>
                      <label className="mt-2 block"><span className="sr-only">Classification for {row.customerReference}</span><select value={draft.classification} onChange={(event) => updateDraft(row.userId, { classification: event.target.value as GrowthCustomerClassification })} aria-label={`Classification for ${row.customerReference}`} className="h-10 min-w-[230px] border border-white/10 bg-[#111214] px-3 text-xs font-black outline-none focus:border-amber-700/60">{growthCustomerClassifications.map((value) => <option key={value} value={value}>{labels[value]}</option>)}</select></label>
                    </td>
                    <td className="px-4 py-4">
                      <input value={draft.reason} onChange={(event) => updateDraft(row.userId, { reason: event.target.value })} maxLength={240} aria-label={`Classification reason for ${row.customerReference}`} placeholder={classificationNeedsEvidenceNote(draft.classification) ? "Required: evidence used for this decision" : "Optional note while unreviewed"} className={`h-10 w-full min-w-[300px] border bg-black/30 px-3 text-xs outline-none ${evidenceGap ? "border-red-700/60" : "border-white/10"} focus:border-amber-700/60`} />
                      {evidenceGap ? <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-red-300"><AlertTriangle className="h-3 w-3" aria-hidden="true" />Legacy review needs an evidence note before its next save.</div> : <div className="mt-2 text-[10px] text-zinc-600">Evidence is required for every completed review. No automatic classification.</div>}
                      {row.verifiedAt && <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-400"><CheckCircle2 className="h-3 w-3" aria-hidden="true" />Last reviewed {date(row.verifiedAt)}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-5 py-10 text-center text-sm text-zinc-500">No customer accounts match this filter.</div>
      )}
    </section>
  );
}
