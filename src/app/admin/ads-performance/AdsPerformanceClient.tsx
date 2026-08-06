"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  CircleGauge,
  ExternalLink,
  Flag,
  Globe2,
  Megaphone,
  RefreshCw,
  Route,
  ShieldCheck,
  Target,
  UserCheck,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/authGuards";
import type { AdsConfigurationStatus, AdsPerformanceReport } from "@/lib/googleAds/readiness";
import type { GrowthPerformanceRow, GrowthReportRange } from "@/lib/growth/types";

const ranges: GrowthReportRange[] = ["30d", "90d", "180d", "365d"];

function integer(value: number) {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(value);
}

function percent(value: number | null) {
  return value === null ? "-" : `${(value * 100).toFixed(1)}%`;
}

function formatCurrency(amountMinor: number, currency: string) {
  const safeCurrency = /^[A-Z]{3}$/.test(currency) ? currency : "EUR";
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: safeCurrency,
    }).format(amountMinor / 100);
  } catch {
    return `${(amountMinor / 100).toFixed(2)} ${safeCurrency}`;
  }
}

function revenueLabel(row: GrowthPerformanceRow) {
  if (!row.revenueByCurrency.length) return "No verified revenue";
  return row.revenueByCurrency
    .map((item) => formatCurrency(item.amountMinor, item.currency))
    .join(" + ");
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(date);
}

function readinessCount(configuration: AdsConfigurationStatus) {
  return [
    configuration.analyticsMeasurement,
    configuration.googleAdsTag,
    configuration.registrationConversion,
    configuration.requestConversion,
    configuration.purchaseConversion,
    configuration.consentModeV2,
    !configuration.personalizedAdvertising,
  ].filter(Boolean).length;
}

export default function AdsPerformanceClient() {
  const [range, setRange] = useState<GrowthReportRange>("30d");
  const [report, setReport] = useState<AdsPerformanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (nextRange: GrowthReportRange, silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const response = await authenticatedFetch(`/api/admin/ads-performance?range=${nextRange}`, {
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Advertising readiness could not be loaded.");
      setReport(payload as AdsPerformanceReport);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Advertising readiness could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(range), 0);
    return () => window.clearTimeout(timer);
  }, [load, range]);

  const readiness = useMemo(
    () => report ? readinessCount(report.configuration) : 0,
    [report]
  );

  return (
    <main className="mg-compact-ui min-h-screen overflow-x-hidden bg-[#050505] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <Link href="/admin" className="inline-flex items-center gap-2 text-xs font-black text-zinc-500 transition hover:text-white">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />Admin Control Panel
            </Link>
            <div className="mt-2 flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-red-800/50 bg-red-950/30 text-red-300">
                <Megaphone className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-400">Paid acquisition governance</p>
                <h1 className="text-xl font-black sm:text-2xl">Google Ads Readiness & Conversion Center</h1>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-white/10 bg-[#0b0c0e] p-1" aria-label="Report date range">
              {ranges.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRange(value)}
                  aria-pressed={range === value}
                  className={`min-w-14 rounded-md px-3 py-2 text-xs font-black transition ${range === value ? "bg-red-700 text-white" : "text-zinc-500 hover:text-white"}`}
                >
                  {value}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void load(range, true)}
              disabled={refreshing}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-[#111214] px-4 text-xs font-black transition hover:border-red-800/50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] space-y-5 px-4 py-6 sm:px-6">
        {error ? (
          <div className="flex items-start gap-3 rounded-lg border border-red-800/50 bg-red-950/25 p-4 text-sm text-red-100">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div><strong>Advertising reporting needs attention.</strong><p className="mt-1 text-red-200/75">{error}</p></div>
          </div>
        ) : null}

        {loading && !report ? <LoadingState /> : null}
        {report ? (
          <>
            <section className="grid overflow-hidden rounded-lg border border-white/10 bg-[#0b0c0e] xl:grid-cols-[1fr_380px]">
              <div className="p-5 sm:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] ${report.configuration.readyForVerifiedMeasurement ? "border-emerald-700/40 bg-emerald-950/25 text-emerald-200" : "border-amber-700/40 bg-amber-950/25 text-amber-200"}`}>
                    {report.configuration.readyForVerifiedMeasurement ? "Measurement ready" : "Configuration required"}
                  </span>
                  <span className="text-[11px] text-zinc-600">Updated {formatDate(report.generatedAt)}</span>
                </div>
                <h2 className="mt-4 max-w-3xl text-2xl font-black leading-tight sm:text-3xl">Measure the business result, not just the click.</h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
                  Payment is the primary conversion, a successfully created file request is secondary, and verified registration is observation-only. Measurement failures never block registration, requests or payments.
                </p>
                <div className="mt-5 grid gap-2 sm:grid-cols-3">
                  <HierarchyItem icon={<CircleDollarSign />} label="Primary" title="Verified payment" />
                  <HierarchyItem icon={<Flag />} label="Secondary" title="Verified request" />
                  <HierarchyItem icon={<UserCheck />} label="Observe" title="Verified registration" />
                </div>
              </div>
              <div className="border-t border-white/10 bg-black/25 p-5 xl:border-l xl:border-t-0">
                <div className="flex items-end justify-between gap-4">
                  <div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Readiness controls</p><p className="mt-1 text-lg font-black">{readiness} of 7 verified</p></div>
                  <span className="text-3xl font-black text-red-400">{Math.round(readiness / 7 * 100)}%</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-red-600" style={{ width: `${readiness / 7 * 100}%` }} /></div>
                <div className="mt-4 grid gap-2">
                  <StatusLine label="GA4 measurement" ready={report.configuration.analyticsMeasurement} />
                  <StatusLine label="Google Ads tag" ready={report.configuration.googleAdsTag} />
                  <StatusLine label="Registration conversion" ready={report.configuration.registrationConversion} />
                  <StatusLine label="Request conversion" ready={report.configuration.requestConversion} />
                  <StatusLine label="Payment conversion" ready={report.configuration.purchaseConversion} />
                  <StatusLine label="Consent Mode v2" ready={report.configuration.consentModeV2} />
                  <StatusLine label="Personalized advertising off" ready={!report.configuration.personalizedAdvertising} />
                </div>
              </div>
            </section>

            {report.accountActions.length ? (
              <section className="rounded-lg border border-amber-700/40 bg-amber-950/15 p-5">
                <div className="flex items-center gap-2"><CircleGauge className="h-5 w-5 text-amber-300" /><h2 className="font-black">Account setup still required</h2></div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {report.accountActions.map((action) => <div key={action} className="rounded-lg border border-amber-800/25 bg-black/20 p-3 text-xs leading-5 text-amber-100/80">{action}</div>)}
                </div>
              </section>
            ) : null}

            <section className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
              <PerformanceTable title="Campaign outcomes" eyebrow="First-party verified results" rows={report.campaigns} empty="No consented campaign journeys are available for this range yet." />
              <PerformanceTable title="Paid source outcomes" eyebrow="Channel quality" rows={report.paidSources} empty="No consented paid-search source journeys are available for this range yet." />
            </section>

            <section className="overflow-hidden rounded-lg border border-white/10 bg-[#0b0c0e]">
              <div className="border-b border-white/10 p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-400">Campaign destination control</p>
                <h2 className="mt-1 text-xl font-black">Focused landing pages</h2>
                <p className="mt-1 text-xs leading-5 text-zinc-500">Existing canonical pages with a useful answer, clear navigation and a secure conversion route. Final ad copy still requires campaign review.</p>
              </div>
              <div className="grid gap-px bg-white/10 md:grid-cols-2 xl:grid-cols-4">
                {report.landingPages.map((page) => (
                  <Link key={page.path} href={page.path} target="_blank" className="group bg-[#0b0c0e] p-5 transition hover:bg-white/[0.035]">
                    <div className="flex items-center justify-between gap-3"><Route className="h-5 w-5 text-red-400" /><span className="rounded-full border border-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-500">{page.campaignRole}</span></div>
                    <h3 className="mt-4 text-base font-black leading-tight">{page.intent}</h3>
                    <p className="mt-2 break-all text-xs text-zinc-600">{page.path}</p>
                    <span className="mt-4 inline-flex items-center gap-1 text-xs font-black text-red-300">Review page <ArrowUpRight className="h-3.5 w-3.5" /></span>
                  </Link>
                ))}
              </div>
            </section>

            <section className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-lg border border-emerald-800/35 bg-emerald-950/10 p-5">
                <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-300" /><h2 className="font-black">Privacy boundary</h2></div>
                <ul className="mt-4 grid gap-2 text-sm leading-6 text-zinc-400">
                  <li>Raw ad click IDs are detected only to classify Google CPC traffic and are not stored.</li>
                  <li>No customer email, customer ID, order ID, filename, vehicle details or notes are exported.</li>
                  <li>Advertising measurement requires explicit consent; personalized advertising remains disabled.</li>
                  <li>Anonymous transaction hashes provide duplicate protection without exposing business identifiers.</li>
                </ul>
              </div>
              <div className="rounded-lg border border-white/10 bg-[#0b0c0e] p-5">
                <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Target className="h-5 w-5 text-red-400" /><h2 className="font-black">Launch discipline</h2></div><a href="https://ads.google.com/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-black text-zinc-500 hover:text-white">Google Ads <ExternalLink className="h-3.5 w-3.5" /></a></div>
                <ol className="mt-4 grid gap-2 text-sm leading-6 text-zinc-400">
                  <li>1. Create separate Search campaigns by language, country and exact service intent.</li>
                  <li>2. Begin with exact and phrase match; maintain negative keywords and search-term review.</li>
                  <li>3. Optimize toward verified payment only after enough clean volume exists.</li>
                  <li>4. Review policy-sensitive service campaigns before activation.</li>
                </ol>
              </div>
            </section>

            <section className="rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="flex items-center gap-2 text-xs font-black text-zinc-400"><Globe2 className="h-4 w-4" />Known measurement limits</div>
              <ul className="mt-2 grid gap-1 text-xs leading-5 text-zinc-600">
                {report.limitations.map((limitation) => <li key={limitation}>- {limitation}</li>)}
              </ul>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}

function HierarchyItem({ icon, label, title }: { icon: ReactNode; label: string; title: string }) {
  return <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/25 p-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-red-950/35 text-red-300 [&>svg]:h-4 [&>svg]:w-4">{icon}</span><span><span className="block text-[9px] font-black uppercase tracking-[0.15em] text-zinc-600">{label}</span><span className="text-sm font-black">{title}</span></span></div>;
}

function StatusLine({ label, ready }: { label: string; ready: boolean }) {
  return <div className="flex items-center justify-between gap-3 text-xs"><span className="text-zinc-400">{label}</span><span className={`inline-flex items-center gap-1 font-black ${ready ? "text-emerald-300" : "text-amber-300"}`}>{ready ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}{ready ? "Ready" : "Required"}</span></div>;
}

function PerformanceTable({ title, eyebrow, rows, empty }: { title: string; eyebrow: string; rows: GrowthPerformanceRow[]; empty: string }) {
  return (
    <section className="overflow-hidden rounded-lg border border-white/10 bg-[#0b0c0e]">
      <div className="border-b border-white/10 p-5"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-400">{eyebrow}</p><h2 className="mt-1 text-xl font-black">{title}</h2></div>
      {rows.length ? (
        <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-xs"><thead className="bg-black/25 uppercase tracking-[0.14em] text-zinc-600"><tr><th className="px-5 py-3">Source</th><th className="px-3 py-3">Visitors</th><th className="px-3 py-3">Registrations</th><th className="px-3 py-3">Requests</th><th className="px-3 py-3">Rate</th><th className="px-5 py-3">Verified revenue</th></tr></thead><tbody>{rows.slice(0, 12).map((row) => <tr key={row.key} className="border-t border-white/5"><td className="max-w-52 truncate px-5 py-3 font-black">{row.label}</td><td className="px-3 py-3 text-zinc-400">{integer(row.consentedVisitors)}</td><td className="px-3 py-3 text-zinc-400">{integer(row.registrations)}</td><td className="px-3 py-3 text-zinc-400">{integer(row.orders)}</td><td className="px-3 py-3 text-zinc-400">{percent(row.conversionRate)}</td><td className="px-5 py-3 font-black text-emerald-300">{revenueLabel(row)}</td></tr>)}</tbody></table></div>
      ) : <div className="grid min-h-48 place-items-center p-6 text-center"><div><BarChart3 className="mx-auto h-7 w-7 text-zinc-700" /><p className="mt-3 text-sm font-black">No measured rows yet</p><p className="mt-1 max-w-sm text-xs leading-5 text-zinc-600">{empty}</p></div></div>}
    </section>
  );
}

function LoadingState() {
  return <div className="grid min-h-[420px] place-items-center rounded-lg border border-white/10 bg-[#0b0c0e]"><div className="text-center"><RefreshCw className="mx-auto h-7 w-7 animate-spin text-red-400" /><p className="mt-3 text-sm font-black">Loading verified advertising readiness...</p></div></div>;
}
