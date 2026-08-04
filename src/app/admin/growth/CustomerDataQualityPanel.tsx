"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  FlaskConical,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/authGuards";
import {
  growthCustomerClassifications,
  type GrowthCustomerClassification,
  type GrowthCustomerClassificationAdminResponse,
  type GrowthCustomerClassificationAdminRow,
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

type Draft = { classification: GrowthCustomerClassification; reason: string };

export default function CustomerDataQualityPanel({ onUpdated }: { onUpdated: () => void }) {
  const [data, setData] = useState<GrowthCustomerClassificationAdminResponse | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | GrowthCustomerClassification>("unreviewed");
  const [busy, setBusy] = useState("");
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
      setDrafts(Object.fromEntries(next.customers.map((row) => [row.userId, {
        classification: row.classification,
        reason: row.reason ?? "",
      }])));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Customer classification could not be loaded.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (data?.customers ?? []).filter((row) => {
      if (filter !== "all" && row.classification !== filter) return false;
      if (!needle) return true;
      return [row.customerReference, row.email, row.fullName]
        .some((value) => value?.toLowerCase().includes(needle));
    });
  }, [data, filter, query]);

  const updateDraft = (userId: string, next: Partial<Draft>) => {
    setDrafts((current) => ({
      ...current,
      [userId]: { ...(current[userId] ?? { classification: "unreviewed", reason: "" }), ...next },
    }));
  };

  const save = async (row: GrowthCustomerClassificationAdminRow) => {
    const draft = drafts[row.userId];
    if (!draft || busy) return;
    if (["internal_test", "staff_operated"].includes(draft.classification) && draft.reason.trim().length < 3) {
      setError("Add a short reason before excluding an internal or staff-operated account.");
      return;
    }
    setBusy(row.userId);
    setError("");
    setFeedback("");
    try {
      const response = await authenticatedFetch(`/api/admin/growth/customers/${row.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classification: draft.classification,
          reason: draft.reason.trim() || null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Classification could not be saved.");
      setFeedback(`${row.customerReference} classification saved with an audit event.`);
      await load();
      onUpdated();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Classification could not be saved.");
    } finally {
      setBusy("");
    }
  };

  if (!allowed) return null;

  return (
    <section className="border border-white/10 bg-[#0b0c0e]" aria-labelledby="customer-data-quality-title">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-400">Admin-only data quality</p>
          <h2 id="customer-data-quality-title" className="mt-1 text-lg font-black">Real customer classification</h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500">
            Verify accounts from known business evidence. Internal/test accounts leave login, requests and payments untouched, but are excluded from growth metrics and reminder candidates.
          </p>
        </div>
        <button type="button" onClick={() => void load()} className="inline-flex h-10 items-center gap-2 border border-white/10 bg-black/20 px-4 text-xs font-black hover:border-amber-700/50">
          <RefreshCw className="h-4 w-4" aria-hidden="true" />Refresh accounts
        </button>
      </div>

      {data && (
        <div className="grid border-b border-white/10 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "Customer accounts", value: data.summary.total, Icon: Users },
            { label: "Verified real", value: data.summary.verifiedReal, Icon: UserCheck },
            { label: "Needs review", value: data.summary.unreviewed, Icon: Search },
            { label: "Internal / test", value: data.summary.internalTest, Icon: FlaskConical },
            { label: "Excluded safely", value: data.summary.excluded, Icon: ShieldCheck },
          ].map(({ label, value, Icon }) => (
            <div key={label} className="border-b border-white/10 px-4 py-4 last:border-b-0 sm:border-r xl:border-b-0">
              <div className="flex items-center justify-between gap-3 text-zinc-500"><span className="text-[10px] font-black uppercase tracking-[0.14em]">{label}</span><Icon className="h-4 w-4 text-amber-300" /></div>
              <div className="mt-2 text-2xl font-black">{value}</div>
            </div>
          ))}
        </div>
      )}

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
        <div className="grid min-h-40 place-items-center text-sm text-zinc-500"><RefreshCw className="mr-2 inline h-4 w-4 animate-spin" />Loading classification workspace...</div>
      ) : rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="border-b border-white/10 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-600">
              <tr><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Business evidence</th><th className="px-4 py-3">Classification</th><th className="px-4 py-3">Reason / audit note</th><th className="px-4 py-3">Action</th></tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((row) => {
                const draft = drafts[row.userId] ?? { classification: row.classification, reason: row.reason ?? "" };
                const changed = draft.classification !== row.classification || draft.reason.trim() !== (row.reason ?? "");
                return (
                  <tr key={row.userId} className="align-top hover:bg-white/[0.02]">
                    <td className="px-4 py-4"><div className="font-black text-white">{row.customerReference}</div><div className="mt-1 max-w-[250px] break-all text-xs text-zinc-500">{row.email || "No email"}</div><div className="mt-1 text-[11px] text-zinc-600">Registered {date(row.createdAt)}</div></td>
                    <td className="px-4 py-4"><div className="font-black text-zinc-200">{row.orderCount} request{row.orderCount === 1 ? "" : "s"} / {row.paymentCount} payment{row.paymentCount === 1 ? "" : "s"}</div><div className="mt-1 text-xs text-zinc-500">{row.revenue.length ? row.revenue.map((item) => money(item.amountMinor, item.currency)).join(" / ") : "No recorded revenue"}</div><div className="mt-1 text-[11px] text-zinc-600">Last request {date(row.lastOrderAt)}</div></td>
                    <td className="px-4 py-4"><span className={`inline-flex border px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em] ${badgeClasses(row.classification)}`}>{labels[row.classification]}</span><select value={draft.classification} onChange={(event) => updateDraft(row.userId, { classification: event.target.value as GrowthCustomerClassification })} aria-label={`Classification for ${row.customerReference}`} className="mt-2 block h-10 min-w-[210px] border border-white/10 bg-[#111214] px-3 text-xs font-black outline-none focus:border-amber-700/60">{growthCustomerClassifications.map((value) => <option key={value} value={value}>{labels[value]}</option>)}</select></td>
                    <td className="px-4 py-4"><input value={draft.reason} onChange={(event) => updateDraft(row.userId, { reason: event.target.value })} maxLength={240} aria-label={`Classification reason for ${row.customerReference}`} placeholder={["internal_test", "staff_operated"].includes(draft.classification) ? "Required: known internal/test evidence" : "Optional verification note"} className="h-10 w-full min-w-[280px] border border-white/10 bg-black/30 px-3 text-xs outline-none focus:border-amber-700/60" /><div className="mt-1 text-[10px] text-zinc-600">No behavior-based or automatic classification.</div></td>
                    <td className="px-4 py-4"><button type="button" onClick={() => void save(row)} disabled={!changed || busy === row.userId} className="inline-flex h-10 min-w-24 items-center justify-center gap-2 border border-amber-700/50 bg-amber-950/20 px-3 text-xs font-black text-amber-100 disabled:cursor-not-allowed disabled:opacity-35"><Save className="h-4 w-4" />{busy === row.userId ? "Saving..." : "Save"}</button>{row.verifiedAt && <div className="mt-2 flex items-center gap-1 text-[10px] text-emerald-400"><CheckCircle2 className="h-3 w-3" />Verified {date(row.verifiedAt)}</div>}</td>
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
