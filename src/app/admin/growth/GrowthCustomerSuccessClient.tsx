"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  BellRing,
  CheckCircle2,
  Globe2,
  HeartHandshake,
  MailCheck,
  MousePointerClick,
  RefreshCw,
  Repeat2,
  Search,
  Send,
  ShieldCheck,
  Target,
  UserPlus,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/authGuards";
import CustomerDataQualityPanel from "@/app/admin/growth/CustomerDataQualityPanel";
import {
  growthReportRanges,
  type GrowthActionItem,
  type GrowthCustomerSuccessReport,
  type GrowthPerformanceRow,
  type GrowthReportRange,
} from "@/lib/growth/types";

function integer(value: number) {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(value);
}

function decimal(value: number | null, digits = 1) {
  return value === null ? "-" : value.toFixed(digits);
}

function percent(value: number | null) {
  return value === null ? "-" : `${(value * 100).toFixed(1)}%`;
}

function dateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(date);
}

function money(amountMinor: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amountMinor / 100);
  } catch {
    return `${(amountMinor / 100).toFixed(2)} ${currency}`;
  }
}

function durationHours(value: number | null) {
  if (value === null) return "Not captured";
  if (value < 24) return `${value.toFixed(value < 10 ? 1 : 0)} hours`;
  return `${(value / 24).toFixed(value < 240 ? 1 : 0)} days`;
}

function Metric({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: ReactNode }) {
  return (
    <div className="min-w-0 border-b border-white/10 px-4 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <div className="flex items-center justify-between gap-3 text-zinc-500">
        <span className="text-[10px] font-black uppercase tracking-[0.16em]">{label}</span>
        <span className="text-red-400">{icon}</span>
      </div>
      <div className="mt-2 text-2xl font-black text-white">{value}</div>
      <p className="mt-1 text-xs leading-5 text-zinc-500">{detail}</p>
    </div>
  );
}

function ActionBadge({ priority }: { priority: GrowthActionItem["priority"] }) {
  const classes = priority === "high"
    ? "border-red-700/50 bg-red-950/35 text-red-200"
    : priority === "medium"
      ? "border-amber-700/45 bg-amber-950/25 text-amber-200"
      : "border-white/10 bg-white/[0.04] text-zinc-300";
  return <span className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${classes}`}>{priority}</span>;
}

function PerformanceTable({ rows, dimension }: { rows: GrowthPerformanceRow[]; dimension: string }) {
  if (!rows.length) return <EmptyState text={`No consented ${dimension.toLowerCase()} attribution is available for this range.`} />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[780px] text-left text-sm">
        <thead className="border-b border-white/10 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">
          <tr>
            <th className="px-4 py-3">{dimension}</th>
            <th className="px-4 py-3">Consented visits</th>
            <th className="px-4 py-3">Registrations</th>
            <th className="px-4 py-3">Customers</th>
            <th className="px-4 py-3">Orders</th>
            <th className="px-4 py-3">Repeat</th>
            <th className="px-4 py-3">Revenue</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.slice(0, 20).map((row) => (
            <tr key={row.key} className="transition hover:bg-white/[0.025]">
              <td className="max-w-[260px] break-words px-4 py-3 font-black text-white">{row.label}</td>
              <td className="px-4 py-3 text-zinc-300">{integer(row.consentedVisitors)}</td>
              <td className="px-4 py-3 text-zinc-300">{integer(row.registrations)}</td>
              <td className="px-4 py-3 text-zinc-300">{integer(row.customersWithRequests)}</td>
              <td className="px-4 py-3 text-zinc-300">{integer(row.orders)}</td>
              <td className="px-4 py-3 text-zinc-300">{integer(row.repeatCustomers)}</td>
              <td className="px-4 py-3 text-zinc-300">
                {row.revenueByCurrency.length
                  ? row.revenueByCurrency.map((item) => money(item.amountMinor, item.currency)).join(" / ")
                  : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="grid min-h-32 place-items-center px-5 py-8 text-center text-sm text-zinc-500">{text}</div>;
}

function SourceStatus({ label, status }: {
  label: string;
  status: GrowthCustomerSuccessReport["sources"][keyof GrowthCustomerSuccessReport["sources"]];
}) {
  const ready = status === "ready";
  const copy = status.replaceAll("_", " ");
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 px-4 py-3">
      <span className="truncate text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">{label}</span>
      <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase ${ready ? "text-emerald-300" : "text-amber-300"}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${ready ? "bg-emerald-400" : "bg-amber-400"}`} aria-hidden="true" />
        {copy}
      </span>
    </div>
  );
}

export default function GrowthCustomerSuccessClient() {
  const [range, setRange] = useState<GrowthReportRange>("30d");
  const [report, setReport] = useState<GrowthCustomerSuccessReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [attributionView, setAttributionView] = useState<"source" | "country" | "language" | "page">("source");
  const [demandView, setDemandView] = useState<"service" | "brand">("service");
  const [actionBusy, setActionBusy] = useState("");
  const [feedback, setFeedback] = useState("");

  const load = useCallback(async (nextRange: GrowthReportRange, silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const response = await authenticatedFetch(`/api/admin/growth?range=${nextRange}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Growth reporting could not be loaded.");
      setReport(payload as GrowthCustomerSuccessReport);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Growth reporting could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(range), 0);
    return () => window.clearTimeout(timer);
  }, [load, range]);

  const sendReminder = async (item: GrowthActionItem) => {
    if (!item.sourceEventId || actionBusy) return;
    if (!window.confirm(`Send one consented request reminder to ${item.customerReference || "this customer"}?`)) return;
    setActionBusy(item.id);
    setFeedback("");
    try {
      const response = await authenticatedFetch("/api/admin/growth/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceEventId: item.sourceEventId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || payload.reason || "Reminder could not be processed.");
      setFeedback(payload.status === "dry_run" ? "Dry-run reminder logged; no real email was sent." : "Reminder processed successfully.");
      await load(range, true);
    } catch (actionError) {
      setFeedback(actionError instanceof Error ? actionError.message : "Reminder could not be processed.");
    } finally {
      setActionBusy("");
    }
  };

  const attributionRows = useMemo(() => {
    if (!report) return [];
    if (attributionView === "country") return report.byCountry;
    if (attributionView === "language") return report.byLocale;
    if (attributionView === "page") return report.byLandingPage;
    return report.bySource;
  }, [attributionView, report]);

  return (
    <main className="mg-compact-ui min-h-screen overflow-x-hidden bg-[#050505] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1660px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <Link href="/admin" className="inline-flex items-center gap-2 text-xs font-black text-zinc-500 transition hover:text-white">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />Admin Control Panel
            </Link>
            <div className="mt-2 flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-emerald-800/45 bg-emerald-950/25 text-emerald-300">
                <HeartHandshake className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">Acquisition to retention</p>
                <h1 className="max-w-[18rem] break-words text-lg font-black leading-tight sm:max-w-none sm:text-2xl">Growth & Customer Success Center</h1>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-white/10 bg-[#0b0c0e] p-1" aria-label="Report date range">
              {growthReportRanges.map((value) => (
                <button key={value} type="button" onClick={() => setRange(value)} aria-pressed={range === value}
                  className={`min-w-14 rounded-md px-3 py-2 text-xs font-black transition ${range === value ? "bg-red-700 text-white" : "text-zinc-500 hover:text-white"}`}>
                  {value}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => void load(range, true)} disabled={refreshing}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-[#111214] px-4 text-xs font-black transition hover:border-red-800/50 disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1660px] space-y-5 px-4 py-6 sm:px-6">
        {error && (
          <div role="alert" className="flex items-start gap-3 border border-red-800/45 bg-red-950/25 px-4 py-3 text-sm text-red-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div><strong>Report unavailable.</strong> {error}</div>
          </div>
        )}
        {feedback && <div role="status" className="border border-sky-800/40 bg-sky-950/20 px-4 py-3 text-sm text-sky-100">{feedback}</div>}
        {loading && !report ? (
          <div className="grid min-h-[55vh] place-items-center text-center">
            <div><RefreshCw className="mx-auto h-7 w-7 animate-spin text-red-400" /><p className="mt-3 text-sm font-bold text-zinc-500">Building the verified growth report...</p></div>
          </div>
        ) : report ? (
          <>
            {!report.migrationReady && (
              <div className="flex items-start gap-3 border border-amber-700/40 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div><strong>Attribution migration required.</strong> Core request, revenue, retention, SEO and email metrics remain available. No attribution or reminder data is fabricated.</div>
              </div>
            )}

            {!report.realGrowth.classificationReady && (
              <div className="flex items-start gap-3 border border-amber-700/40 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div><strong>Customer classification migration required.</strong> No account has been guessed or promoted. Existing totals remain available, but verified-real and internal/test separation stays disabled until the additive migration is applied.</div>
              </div>
            )}

            <section className="grid border border-emerald-800/35 bg-[#080d0b] xl:grid-cols-[1.15fr_0.85fr]" aria-labelledby="real-growth-title">
              <div className="min-w-0 border-b border-emerald-900/35 xl:border-b-0 xl:border-r">
                <div className="border-b border-emerald-900/35 px-5 py-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">Audited customer truth</p>
                  <h2 id="real-growth-title" className="mt-1 text-lg font-black">Real Growth Snapshot</h2>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">Only explicitly verified real customers appear in this snapshot. The report range is {report.range}.</p>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4">
                  <Metric label="Verified real" value={integer(report.realGrowth.verifiedRealCustomers)} detail={`${integer(report.realGrowth.unreviewedCustomers)} accounts still need review`} icon={<UserPlus className="h-4 w-4" />} />
                  <Metric label="Real requesters" value={integer(report.realGrowth.customersWithRequests)} detail={`${integer(report.realGrowth.orders)} requests in range`} icon={<Target className="h-4 w-4" />} />
                  <Metric label="Real payers" value={integer(report.realGrowth.payingCustomers)} detail={`${integer(report.realGrowth.repeatCustomers)} repeat customers all-time`} icon={<Activity className="h-4 w-4" />} />
                  <Metric label="Excluded internal" value={integer(report.realGrowth.excludedInternalAccounts)} detail="Login, orders and payments remain untouched" icon={<ShieldCheck className="h-4 w-4" />} />
                </div>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-emerald-900/35 px-5 py-4 text-xs text-zinc-500">
                  <span><strong className="text-zinc-200">Real registrations:</strong> {integer(report.realGrowth.registrations)}</span>
                  <span><strong className="text-zinc-200">Completed:</strong> {integer(report.realGrowth.completedOrders)}</span>
                  <span><strong className="text-zinc-200">Revenue:</strong> {report.realGrowth.revenue.length ? report.realGrowth.revenue.map((row) => money(row.amountMinor, row.currency)).join(" / ") : "No verified revenue in range"}</span>
                </div>
              </div>

              <div className="min-w-0">
                <div className="border-b border-emerald-900/35 px-5 py-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">First verified revenue evidence</p>
                  <h2 className="mt-1 text-lg font-black">Registration to payment journey</h2>
                </div>
                {report.firstRevenueJourney.status === "available" ? (
                  <div className="px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div><div className="text-xs font-black text-zinc-500">Customer reference</div><div className="mt-1 text-xl font-black">{report.firstRevenueJourney.customerReference}</div></div>
                      <div className="border border-emerald-700/40 bg-emerald-950/25 px-3 py-2 text-right"><div className="text-[9px] font-black uppercase tracking-[0.14em] text-emerald-400">First payment</div><div className="mt-1 font-black text-emerald-100">{report.firstRevenueJourney.paymentAmountMinor !== null && report.firstRevenueJourney.paymentCurrency ? money(report.firstRevenueJourney.paymentAmountMinor, report.firstRevenueJourney.paymentCurrency) : "Recorded"}</div></div>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      <div className="border border-white/10 bg-black/20 px-3 py-3"><div className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-600">Registered</div><div className="mt-1 text-xs font-black">{dateTime(report.firstRevenueJourney.registeredAt)}</div></div>
                      <div className="border border-white/10 bg-black/20 px-3 py-3"><div className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-600">First request</div><div className="mt-1 text-xs font-black">{dateTime(report.firstRevenueJourney.firstRequestAt)}</div><div className="mt-1 text-[10px] text-zinc-600">{durationHours(report.firstRevenueJourney.hoursRegistrationToRequest)} after registration</div></div>
                      <div className="border border-white/10 bg-black/20 px-3 py-3"><div className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-600">First payment</div><div className="mt-1 text-xs font-black">{dateTime(report.firstRevenueJourney.firstPaymentAt)}</div><div className="mt-1 text-[10px] text-zinc-600">{durationHours(report.firstRevenueJourney.hoursRegistrationToPayment)} after registration</div></div>
                    </div>
                    <div className="mt-3 border border-sky-900/40 bg-sky-950/15 px-3 py-3 text-xs leading-5 text-zinc-400">
                      {report.firstRevenueJourney.attributionStatus === "consented_first_touch" ? (
                        <>Consented first touch: <strong className="text-sky-200">{report.firstRevenueJourney.source} / {report.firstRevenueJourney.medium}</strong>{report.firstRevenueJourney.countryCode ? `, ${report.firstRevenueJourney.countryCode}` : ""}{report.firstRevenueJourney.landingPath ? ` on ${report.firstRevenueJourney.landingPath}` : ""}.</>
                      ) : (
                        <>Acquisition source was not captured with consent. It remains unknown and is not inferred from the account or payment.</>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="px-5 py-10 text-center"><ShieldCheck className="mx-auto h-6 w-6 text-emerald-400" /><p className="mt-3 text-sm font-black">No verified-real payment journey yet</p><p className="mx-auto mt-1 max-w-md text-xs leading-5 text-zinc-500">Classify the known genuine paying customer as verified real. The system will then show the earliest recorded purchase without inventing missing source history.</p></div>
                )}
              </div>
            </section>

            <CustomerDataQualityPanel onUpdated={() => void load(range, true)} />

            <section className="border border-white/10 bg-[#0b0c0e]" aria-labelledby="growth-overview-title">
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 px-5 py-4">
                <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-400">Verified operating picture</p><h2 id="growth-overview-title" className="mt-1 text-lg font-black">Customer journey overview</h2></div>
                <p className="text-xs text-zinc-500">Generated {dateTime(report.generatedAt)} | Europe/Berlin</p>
              </div>
              <div className="grid sm:grid-cols-2 xl:grid-cols-6">
                <Metric label="Consented visits" value={integer(report.funnel.consentedVisitors)} detail="Privacy-safe first-touch records" icon={<Globe2 className="h-4 w-4" />} />
                <Metric label="Registrations" value={integer(report.funnel.registrations)} detail={`${percent(report.funnel.visitorToRegistrationRate)} of consented visits`} icon={<UserPlus className="h-4 w-4" />} />
                <Metric label="First request customers" value={integer(report.funnel.firstRequestCustomers)} detail={`${integer(report.funnel.customersWithRequests)} active request customers`} icon={<Target className="h-4 w-4" />} />
                <Metric label="Repeat customers" value={integer(report.funnel.repeatCustomers)} detail={`${percent(report.retention.repeatCustomerRate)} all-time repeat rate`} icon={<Repeat2 className="h-4 w-4" />} />
                <Metric label="Paying customers" value={integer(report.funnel.payingCustomers)} detail={`${percent(report.funnel.registrationToRequestRate)} registration to request`} icon={<Activity className="h-4 w-4" />} />
                <Metric label="Completed requests" value={integer(report.funnel.completedOrders)} detail={`${percent(report.funnel.completionRate)} period completion`} icon={<CheckCircle2 className="h-4 w-4" />} />
              </div>
              <div className="grid border-t border-white/10 sm:grid-cols-2 xl:grid-cols-5">
                <SourceStatus label="Business records" status={report.sources.coreBusiness} />
                <SourceStatus label="Attribution" status={report.sources.attribution} />
                <SourceStatus label="Customer classification" status={report.sources.customerClassification} />
                <SourceStatus label="SEO reporting" status={report.sources.seo} />
                <SourceStatus label="Email delivery" status={report.sources.emailDelivery} />
              </div>
            </section>

            <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="border border-white/10 bg-[#0b0c0e]">
                <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
                  <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-400">Daily command list</p><h2 className="mt-1 text-lg font-black">Actions requiring attention</h2></div>
                  <BellRing className="h-5 w-5 text-amber-300" />
                </div>
                {report.actions.length ? (
                  <div className="divide-y divide-white/5">
                    {report.actions.slice(0, 10).map((item) => (
                      <div key={item.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2"><ActionBadge priority={item.priority} />{item.customerReference && <span className="text-xs font-black text-zinc-500">{item.customerReference}</span>}</div>
                          <h3 className="mt-2 font-black text-white">{item.title}</h3>
                          <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500">{item.detail}</p>
                        </div>
                        {item.action === "send_reminder" ? (
                          <button type="button" onClick={() => void sendReminder(item)} disabled={Boolean(actionBusy)}
                            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-red-700 px-4 text-xs font-black transition hover:bg-red-600 disabled:opacity-50">
                            <Send className="h-4 w-4" />{actionBusy === item.id ? "Processing..." : "Send one reminder"}
                          </button>
                        ) : (
                          <Link href={item.href} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-white/10 px-4 text-xs font-black transition hover:border-red-800/50">
                            Review <ArrowUpRight className="h-4 w-4" />
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                ) : <EmptyState text="No verified action needs attention in this report range." />}
              </div>

              <div className="border border-white/10 bg-[#0b0c0e]">
                <div className="border-b border-white/10 px-5 py-4"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">Commercial health</p><h2 className="mt-1 text-lg font-black">Revenue & retention</h2></div>
                <div className="grid grid-cols-2 border-b border-white/10">
                  <Metric label="Repeat rate" value={percent(report.retention.repeatCustomerRate)} detail={`${integer(report.retention.repeatCustomers)} repeat customers`} icon={<Repeat2 className="h-4 w-4" />} />
                  <Metric label="Avg. orders" value={decimal(report.retention.averageOrdersPerCustomer, 2)} detail="Per ordering customer" icon={<Activity className="h-4 w-4" />} />
                </div>
                <div className="grid grid-cols-2 border-b border-white/10">
                  <Metric label="Time to first request" value={report.retention.medianDaysToFirstRequest === null ? "-" : `${decimal(report.retention.medianDaysToFirstRequest)} d`} detail="Median from registration" icon={<Target className="h-4 w-4" />} />
                  <Metric label="No request after 7d" value={integer(report.retention.newCustomersWithoutRequest)} detail="Onboarding review cohort" icon={<UserPlus className="h-4 w-4" />} />
                  <Metric label="One-time inactive" value={integer(report.retention.oneTimeCustomersInactive60d)} detail="No repeat request for 60+ days" icon={<Activity className="h-4 w-4" />} />
                  <Metric label="Repeat inactive" value={integer(report.retention.repeatCustomersInactive90d)} detail="Previously repeat, inactive 90+ days" icon={<Repeat2 className="h-4 w-4" />} />
                </div>
                <div className="divide-y divide-white/5 px-5">
                  {report.revenue.length ? report.revenue.map((item) => (
                    <div key={item.currency} className="flex items-center justify-between gap-4 py-4">
                      <div><div className="text-xs font-black uppercase text-zinc-500">{item.currency} net revenue</div><div className="mt-1 text-xl font-black">{money(item.amountMinor, item.currency)}</div><div className="mt-1 text-[11px] text-zinc-600">Gross {money(item.grossAmountMinor, item.currency)} / refunds {money(item.refundedAmountMinor, item.currency)}</div></div>
                      <div className="text-right text-xs leading-5 text-zinc-500"><strong className="block text-zinc-200">{integer(item.payingCustomers)} customers</strong>{item.revenuePerPayingCustomerMinor !== null ? `${money(item.revenuePerPayingCustomerMinor, item.currency)} / customer` : "-"}<span className="block text-zinc-600">{integer(item.successfulPayments)} payments / {integer(item.refunds)} refunds</span></div>
                    </div>
                  )) : <EmptyState text="No successful payment revenue is recorded in this range." />}
                </div>
              </div>
            </section>

            <section className="border border-white/10 bg-[#0b0c0e]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">Consented first-touch attribution</p><h2 className="mt-1 text-lg font-black">What brings customers to MG AutoTech?</h2></div>
                <div className="inline-flex rounded-lg border border-white/10 bg-black/20 p-1">
                  {(["source", "country", "language", "page"] as const).map((value) => <button key={value} type="button" onClick={() => setAttributionView(value)} aria-pressed={attributionView === value} className={`rounded-md px-3 py-2 text-xs font-black capitalize ${attributionView === value ? "bg-sky-900/60 text-sky-100" : "text-zinc-500 hover:text-white"}`}>{value}</button>)}
                </div>
              </div>
              <PerformanceTable rows={attributionRows} dimension={attributionView === "source" ? "Source / medium" : attributionView === "country" ? "Country" : attributionView === "language" ? "Language" : "Landing page"} />
              <div className="border-t border-white/10 px-5 py-3 text-xs leading-5 text-zinc-500"><ShieldCheck className="mr-2 inline h-4 w-4 text-emerald-400" />Only consented, pseudonymous first-touch data. No raw IP, full referrer URL, email, notes or file data.</div>
            </section>

            <section className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
              <div className="border border-white/10 bg-[#0b0c0e]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                  <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-400">Real order demand</p><h2 className="mt-1 text-lg font-black">Service & vehicle performance</h2></div>
                  <div className="inline-flex rounded-lg border border-white/10 bg-black/20 p-1">{(["service", "brand"] as const).map((value) => <button key={value} type="button" onClick={() => setDemandView(value)} aria-pressed={demandView === value} className={`rounded-md px-3 py-2 text-xs font-black capitalize ${demandView === value ? "bg-violet-900/60 text-violet-100" : "text-zinc-500 hover:text-white"}`}>{value}</button>)}</div>
                </div>
                {(demandView === "service" ? report.byService : report.byBrand).length ? (
                  <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="border-b border-white/10 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600"><tr><th className="px-4 py-3">{demandView}</th><th className="px-4 py-3">Orders</th><th className="px-4 py-3">Customers</th><th className="px-4 py-3">Repeat</th><th className="px-4 py-3">Completed</th><th className="px-4 py-3">Credits</th></tr></thead><tbody className="divide-y divide-white/5">{(demandView === "service" ? report.byService : report.byBrand).slice(0, 20).map((row) => <tr key={row.key}><td className="px-4 py-3 font-black">{row.label}</td><td className="px-4 py-3 text-zinc-400">{integer(row.orders)}</td><td className="px-4 py-3 text-zinc-400">{integer(row.customers)}</td><td className="px-4 py-3 text-zinc-400">{percent(row.repeatRate)}</td><td className="px-4 py-3 text-zinc-400">{integer(row.completedOrders)}</td><td className="px-4 py-3 text-zinc-400">{integer(row.creditsRequested)}</td></tr>)}</tbody></table></div>
                ) : <EmptyState text={`No ${demandView} demand is available for this range.`} />}
              </div>

              <div className="border border-white/10 bg-[#0b0c0e]">
                <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-400">Delivery reliability</p><h2 className="mt-1 text-lg font-black">Email & reminder outcomes</h2></div><MailCheck className="h-5 w-5 text-cyan-300" /></div>
                <div className="grid grid-cols-2 sm:grid-cols-3">
                  <Metric label="Delivered" value={integer(report.email.delivered)} detail={`${percent(report.email.deliveryRate)} delivery rate`} icon={<CheckCircle2 className="h-4 w-4" />} />
                  <Metric label="Delayed" value={integer(report.email.delayed)} detail="Provider-delayed messages" icon={<Activity className="h-4 w-4" />} />
                  <Metric label="Bounced" value={integer(report.email.bounced)} detail={`${integer(report.email.complained)} complaints`} icon={<AlertTriangle className="h-4 w-4" />} />
                  <Metric label="Failed" value={integer(report.email.failed)} detail={`${integer(report.email.suppressed)} suppressed`} icon={<MailCheck className="h-4 w-4" />} />
                  <Metric label="Reminders" value={integer(report.email.reminderAttempts)} detail="Consented attempts only" icon={<Send className="h-4 w-4" />} />
                  <Metric label="Reminder follow-through" value={percent(report.email.reminderConversionRate)} detail={`${integer(report.email.reminderConversions)} requests within 7 days`} icon={<MousePointerClick className="h-4 w-4" />} />
                </div>
              </div>
            </section>

            <section className="border border-white/10 bg-[#0b0c0e]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-400">Aggregate search demand / {report.searchQueryWindow} window</p><h2 className="mt-1 text-lg font-black">Queries that create visibility</h2></div><Link href="/admin/seo-performance" className="inline-flex items-center gap-2 text-xs font-black text-red-300 hover:text-red-200">Open SEO Center <ArrowUpRight className="h-4 w-4" /></Link></div>
              {report.searchQueries.length ? <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="border-b border-white/10 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600"><tr><th className="px-4 py-3">Query</th><th className="px-4 py-3">Page</th><th className="px-4 py-3">Clicks</th><th className="px-4 py-3">Impressions</th><th className="px-4 py-3">CTR</th><th className="px-4 py-3">Position</th></tr></thead><tbody className="divide-y divide-white/5">{report.searchQueries.map((row) => <tr key={`${row.query}:${row.pagePath}`}><td className="px-4 py-3 font-black">{row.query}</td><td className="max-w-[320px] break-words px-4 py-3 text-zinc-400">{row.pagePath}</td><td className="px-4 py-3 text-zinc-400">{integer(row.clicks)}</td><td className="px-4 py-3 text-zinc-400">{integer(row.impressions)}</td><td className="px-4 py-3 text-zinc-400">{percent(row.ctr)}</td><td className="px-4 py-3 text-zinc-400">{decimal(row.position)}</td></tr>)}</tbody></table></div> : <EmptyState text="Search Console query data is not configured or has no rows for this period." />}
              <div className="border-t border-white/10 px-5 py-3 text-xs leading-5 text-amber-200/80"><Search className="mr-2 inline h-4 w-4" />Queries are aggregate Search Console evidence. They are deliberately not attributed to a named or pseudonymous customer.</div>
            </section>

            {(report.warnings.length > 0 || report.limitations.length > 0) && (
              <section className="grid gap-5 lg:grid-cols-2">
                <div className="border border-amber-800/30 bg-amber-950/10 px-5 py-4"><h2 className="flex items-center gap-2 font-black text-amber-100"><AlertTriangle className="h-4 w-4" />Data notices</h2><ul className="mt-3 space-y-2 text-xs leading-5 text-zinc-400">{report.warnings.length ? report.warnings.map((item) => <li key={item}>- {item}</li>) : <li>- All configured reporting sources responded.</li>}</ul></div>
                <div className="border border-emerald-800/30 bg-emerald-950/10 px-5 py-4"><h2 className="flex items-center gap-2 font-black text-emerald-100"><ShieldCheck className="h-4 w-4" />Interpretation boundaries</h2><ul className="mt-3 space-y-2 text-xs leading-5 text-zinc-400">{report.limitations.map((item) => <li key={item}>- {item}</li>)}</ul></div>
              </section>
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}
