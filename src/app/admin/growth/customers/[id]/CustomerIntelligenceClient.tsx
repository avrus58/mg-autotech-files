"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Database,
  FileCheck2,
  Gauge,
  Globe2,
  MessageSquareText,
  RefreshCw,
  Repeat2,
  ShieldCheck,
  Target,
  UserRound,
  WalletCards,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/authGuards";
import type {
  CustomerIntelligenceRecommendation,
  CustomerIntelligenceReport,
  CustomerIntelligenceTimelineItem,
  CustomerIntelligenceTouch,
} from "@/lib/growth/customerIntelligence";

function dateTime(value: string | null) {
  if (!value) return "Not captured";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not captured";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(parsed);
}

function money(amountMinor: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amountMinor / 100);
  } catch {
    return `${(amountMinor / 100).toFixed(2)} ${currency}`;
  }
}

function duration(value: number | null, unit: "hours" | "days") {
  if (value === null) return "Not captured";
  if (unit === "hours" && value >= 48) return `${(value / 24).toFixed(1)} days`;
  return `${value.toFixed(value < 10 ? 1 : 0)} ${unit}`;
}

function responseDuration(minutes: number | null) {
  if (minutes === null) return "Not captured";
  if (minutes < 60) return `${minutes.toFixed(minutes < 10 ? 1 : 0)} minutes`;
  if (minutes < 1_440) return `${(minutes / 60).toFixed(1)} hours`;
  return `${(minutes / 1_440).toFixed(1)} days`;
}

function label(value: string | null | undefined) {
  return value?.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Not captured";
}

function Panel({ title, eyebrow, icon, children, className = "" }: {
  title: string;
  eyebrow: string;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`min-w-0 border border-white/10 bg-[#0b0c0e] ${className}`}>
      <header className="flex items-start gap-3 border-b border-white/10 px-4 py-4 sm:px-5">
        <span className="grid h-9 w-9 shrink-0 place-items-center border border-red-800/40 bg-red-950/25 text-red-300">{icon}</span>
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-red-400">{eyebrow}</p>
          <h2 className="mt-1 text-lg font-black text-white">{title}</h2>
        </div>
      </header>
      {children}
    </section>
  );
}

function Metric({ label: metricLabel, value, detail, icon }: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <div className="min-w-0 border-b border-white/10 px-4 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-600">{metricLabel}</span>
        <span className="text-red-400">{icon}</span>
      </div>
      <div className="mt-2 truncate text-xl font-black text-white" title={value}>{value}</div>
      <p className="mt-1 text-[11px] leading-4 text-zinc-500">{detail}</p>
    </div>
  );
}

function Field({ name, value }: { name: string; value: string | null | undefined }) {
  return (
    <div className="border-b border-white/5 px-4 py-3 last:border-b-0">
      <div className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-600">{name}</div>
      <div className="mt-1 break-words text-sm font-bold text-zinc-200">{value || "Not captured"}</div>
    </div>
  );
}

function Touch({ title, touch }: { title: string; touch: CustomerIntelligenceTouch | null }) {
  if (!touch) {
    return <div className="border border-dashed border-white/10 px-4 py-5 text-sm text-zinc-500">{title}: no consented touch is linked.</div>;
  }
  return (
    <div className="border border-white/10 bg-black/20">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <span className="text-xs font-black text-white">{title}</span>
        <span className="text-[10px] text-zinc-500">{dateTime(touch.occurredAt)}</span>
      </div>
      <div className="grid sm:grid-cols-2">
        <Field name="Source / medium" value={`${touch.source || "Unknown"} / ${touch.medium || "unknown"}`} />
        <Field name="Landing page" value={touch.landingPath} />
        <Field name="Campaign / term" value={[touch.campaign, touch.term].filter(Boolean).join(" / ") || null} />
        <Field name="Country / locale" value={[touch.countryCode, touch.locale].filter(Boolean).join(" / ") || null} />
      </div>
    </div>
  );
}

function TimelineItem({ item }: { item: CustomerIntelligenceTimelineItem }) {
  const tone = item.tone === "positive"
    ? "border-emerald-600 bg-emerald-400"
    : item.tone === "attention"
      ? "border-amber-600 bg-amber-400"
      : item.tone === "commercial"
        ? "border-cyan-600 bg-cyan-400"
        : "border-zinc-600 bg-zinc-400";
  return (
    <li className="relative grid grid-cols-[18px_minmax(0,1fr)] gap-3 pb-5 last:pb-0">
      <span className={`relative z-10 mt-1 h-3 w-3 rounded-full border-2 border-[#0b0c0e] ${tone}`} aria-hidden="true" />
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <span className="text-sm font-black text-zinc-100">{item.label}</span>
          <span className="text-[10px] text-zinc-600">{dateTime(item.occurredAt)}</span>
        </div>
        <p className="mt-1 text-xs leading-5 text-zinc-500">{item.detail}</p>
      </div>
    </li>
  );
}

function Recommendation({ item }: { item: CustomerIntelligenceRecommendation }) {
  const tone = item.priority === "high" ? "text-red-300" : item.priority === "medium" ? "text-amber-300" : "text-zinc-400";
  const content = (
    <div className="flex items-start gap-3 border-b border-white/5 px-4 py-4 last:border-b-0">
      <span className={`mt-0.5 text-[9px] font-black uppercase tracking-[0.12em] ${tone}`}>{item.priority}</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-black text-white">{item.title}</div>
        <p className="mt-1 text-xs leading-5 text-zinc-500">{item.detail}</p>
      </div>
      {item.href && <ArrowUpRight className="h-4 w-4 shrink-0 text-zinc-600" aria-hidden="true" />}
    </div>
  );
  return item.href ? <Link href={item.href} className="block hover:bg-white/[0.025]">{content}</Link> : content;
}

export default function CustomerIntelligenceClient({ customerId }: { customerId: string }) {
  const [report, setReport] = useState<CustomerIntelligenceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const response = await authenticatedFetch(`/api/admin/growth/customers/${customerId}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Customer intelligence could not be loaded.");
      setReport(payload as CustomerIntelligenceReport);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Customer intelligence could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [customerId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const revenue = useMemo(() => report?.commercial.revenue.map((item) => money(item.amountMinor, item.currency)).join(" / ") || "No verified revenue", [report]);

  if (loading) {
    return <main className="grid min-h-screen place-items-center bg-black text-zinc-400"><span className="inline-flex items-center gap-3 text-sm font-bold"><RefreshCw className="h-5 w-5 animate-spin text-red-400" />Building verified customer view...</span></main>;
  }

  if (!report || error) {
    return (
      <main className="grid min-h-screen place-items-center bg-black px-5 text-white">
        <div className="w-full max-w-lg border border-red-800/40 bg-red-950/15 p-6 text-center">
          <AlertTriangle className="mx-auto h-7 w-7 text-red-400" />
          <h1 className="mt-4 text-xl font-black">Customer intelligence unavailable</h1>
          <p className="mt-2 text-sm text-zinc-400">{error || "The customer report could not be loaded."}</p>
          <button type="button" onClick={() => void load()} className="mt-5 inline-flex h-10 items-center gap-2 bg-red-700 px-4 text-xs font-black hover:bg-red-600"><RefreshCw className="h-4 w-4" />Try again</button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto w-full max-w-[1540px] px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
          <div className="min-w-0">
            <Link href="/admin/growth" className="inline-flex items-center gap-2 text-xs font-bold text-zinc-500 hover:text-white"><ArrowLeft className="h-4 w-4" />Growth & Customer Success</Link>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="border border-red-800/50 bg-red-950/25 px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-red-300">Customer Intelligence 360</span>
              <span className="border border-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-400">{report.customer.customerReference}</span>
              {report.classification.analyticsExcluded && <span className="border border-violet-700/50 bg-violet-950/25 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-violet-200">Analytics excluded</span>}
            </div>
            <h1 className="mt-3 break-words text-2xl font-black sm:text-3xl">{report.customer.companyName || report.customer.fullName || report.customer.email || report.customer.customerReference}</h1>
            <p className="mt-1 text-sm text-zinc-500">Verified operational evidence, consented acquisition and transparent customer-success signals.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex h-10 items-center gap-2 border border-white/10 px-4 text-xs font-black hover:border-white/25 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />Refresh</button>
            <Link href="/admin" className="inline-flex h-10 items-center gap-2 border border-white/10 px-4 text-xs font-black hover:border-white/25">Admin panel</Link>
          </div>
        </header>

        {report.dataQuality.warnings.length > 0 && (
          <div role="status" className="mt-4 border border-amber-800/40 bg-amber-950/15 px-4 py-3 text-xs leading-5 text-amber-100">
            <span className="font-black">Partial evidence:</span> {report.dataQuality.warnings.join(" ")}
          </div>
        )}

        <section className="mt-5 grid border border-white/10 bg-[#0b0c0e] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6" aria-label="Customer summary">
          <Metric label="Relationship" value={label(report.lifecycle.relationshipState)} detail={report.lifecycle.relationshipExplanation} icon={<Repeat2 className="h-4 w-4" />} />
          <Metric label="Requests" value={String(report.requests.total)} detail={`${report.requests.completed} completed, ${report.requests.open} open`} icon={<FileCheck2 className="h-4 w-4" />} />
          <Metric label="Verified revenue" value={revenue} detail={`${report.commercial.purchaseCount} purchase records`} icon={<CircleDollarSign className="h-4 w-4" />} />
          <Metric label="Credit balance" value={String(report.customer.creditBalance)} detail={`${report.commercial.creditsRequested} credits requested`} icon={<WalletCards className="h-4 w-4" />} />
          <Metric label="Last activity" value={dateTime(report.lifecycle.lastRequestAt)} detail={duration(report.lifecycle.daysSinceLastRequest, "days") + " since last request"} icon={<Clock3 className="h-4 w-4" />} />
          <Metric label="Data coverage" value={`${report.dataQuality.operationalCoveragePercent}%`} detail={`${label(report.dataQuality.confidence)} confidence`} icon={<Gauge className="h-4 w-4" />} />
        </section>

        <div className="mt-5 grid gap-5 xl:grid-cols-12">
          <Panel title="Acquisition evidence" eyebrow="Privacy-safe first-party attribution" icon={<Target className="h-4 w-4" />} className="xl:col-span-8">
            <div className="border-b border-white/10 px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`border px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${report.acquisition.status === "captured" ? "border-emerald-700/50 bg-emerald-950/25 text-emerald-200" : "border-amber-700/50 bg-amber-950/20 text-amber-200"}`}>{label(report.acquisition.status)}</span>
                <span className="text-xs text-zinc-500">{report.acquisition.touchCount} consented touch{report.acquisition.touchCount === 1 ? "" : "es"}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-400">{report.acquisition.explanation}</p>
              <p className="mt-2 text-xs leading-5 text-zinc-600">Login provider ({report.customer.authProviders.join(", ") || "not captured"}) is account authentication evidence only and never treated as traffic source.</p>
            </div>
            <div className="grid gap-3 p-4 lg:grid-cols-2 sm:p-5"><Touch title="First touch" touch={report.acquisition.firstTouch} /><Touch title="Last touch" touch={report.acquisition.lastTouch} /></div>
          </Panel>

          <Panel title="Customer identity" eyebrow="Operational profile" icon={<UserRound className="h-4 w-4" />} className="xl:col-span-4">
            <div className="grid sm:grid-cols-2 xl:grid-cols-1">
              <Field name="Customer / account" value={[report.customer.fullName, report.customer.email].filter(Boolean).join(" | ") || null} />
              <Field name="Company / account type" value={[report.customer.companyName, label(report.customer.accountType)].filter((value) => value && value !== "Not captured").join(" | ") || null} />
              <Field name="Phone / preferred contact" value={[report.customer.phone, report.customer.preferredContact].filter(Boolean).join(" | ") || null} />
              <Field name="Location" value={[report.customer.city, report.customer.country].filter(Boolean).join(", ") || null} />
              <Field name="Registered / last sign-in" value={`${dateTime(report.customer.registeredAt)} | ${dateTime(report.customer.lastSignInAt)}`} />
              <Field name="Profile completeness" value={`${report.customer.profileCompleteness}%${report.customer.missingProfileFields.length ? ` | Missing: ${report.customer.missingProfileFields.join(", ")}` : " | Complete"}`} />
            </div>
          </Panel>

          <Panel title="Commercial relationship" eyebrow="Verified ledger view" icon={<CircleDollarSign className="h-4 w-4" />} className="xl:col-span-5">
            <div className="grid sm:grid-cols-2">
              <Field name="Net verified revenue" value={revenue} />
              <Field name="Purchases / refunds" value={`${report.commercial.purchaseCount} / ${report.commercial.refundCount}`} />
              <Field name="Credits purchased" value={String(report.commercial.creditsPurchased)} />
              <Field name="First / last payment" value={`${dateTime(report.lifecycle.firstPaymentAt)} | ${dateTime(report.lifecycle.lastPaymentAt)}`} />
              <Field name="Registration to first payment" value={duration(report.lifecycle.hoursRegistrationToFirstPayment, "hours")} />
              <Field name="Payment states" value={report.commercial.paymentStatusCounts.map((item) => `${label(item.status)} ${item.count}`).join(" | ") || null} />
            </div>
          </Panel>

          <Panel title="Service and vehicle profile" eyebrow="Observed demand" icon={<Activity className="h-4 w-4" />} className="xl:col-span-7">
            <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-2">
              <div><p className="text-[9px] font-black uppercase tracking-[0.15em] text-zinc-600">Services used</p><div className="mt-3 flex flex-wrap gap-2">{report.requests.services.length ? report.requests.services.map((item) => <span key={item.label} className="border border-red-900/40 bg-red-950/15 px-2 py-1 text-xs font-bold text-zinc-200">{item.label} <b className="ml-1 text-red-300">{item.count}</b></span>) : <span className="text-sm text-zinc-500">No service evidence yet.</span>}</div></div>
              <div><p className="text-[9px] font-black uppercase tracking-[0.15em] text-zinc-600">Vehicle brands</p><div className="mt-3 flex flex-wrap gap-2">{report.requests.brands.length ? report.requests.brands.map((item) => <span key={item.label} className="border border-white/10 px-2 py-1 text-xs font-bold text-zinc-300">{item.label} <b className="ml-1 text-white">{item.count}</b></span>) : <span className="text-sm text-zinc-500">No vehicle evidence yet.</span>}</div></div>
            </div>
            <div className="grid border-t border-white/10 sm:grid-cols-3"><Field name="First service" value={report.cohort.firstService} /><Field name="Top service" value={report.cohort.topService} /><Field name="Top brand" value={report.cohort.topBrand} /></div>
          </Panel>

          <Panel title="Request portfolio" eyebrow="Full customer work history" icon={<FileCheck2 className="h-4 w-4" />} className="xl:col-span-12">
            {report.requests.orders.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="border-b border-white/10 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-600"><tr><th className="px-4 py-3">Request</th><th className="px-4 py-3">Vehicle</th><th className="px-4 py-3">Service</th><th className="px-4 py-3">ECU / read</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Created</th><th className="px-4 py-3">Action</th></tr></thead>
                  <tbody className="divide-y divide-white/5">{report.requests.orders.map((order) => <tr key={order.id} className="hover:bg-white/[0.025]"><td className="px-4 py-3 font-black text-white">{order.reference}<div className="mt-1 text-[10px] font-normal text-zinc-600">{order.hasCustomerFile ? "Customer file attached" : "No file recorded"}</div></td><td className="max-w-[260px] px-4 py-3 text-zinc-300">{order.vehicle}<div className="mt-1 text-[10px] text-zinc-600">{order.engine || "Engine not captured"}</div></td><td className="max-w-[240px] px-4 py-3 font-bold text-zinc-200">{order.service}<div className="mt-1 text-[10px] text-zinc-600">{order.creditsRequired} credits</div></td><td className="px-4 py-3 text-zinc-400">{order.ecuOrGearbox || "-"}<div className="mt-1 text-[10px] text-zinc-600">{order.readMethod || "Read method unknown"}</div></td><td className="px-4 py-3"><span className="border border-white/10 px-2 py-1 text-[9px] font-black uppercase text-zinc-300">{label(order.status)}</span></td><td className="px-4 py-3 text-xs text-zinc-500">{dateTime(order.createdAt)}</td><td className="px-4 py-3"><Link href={`/admin/requests/${order.id}`} aria-label={`Open ${order.reference}`} className="inline-flex h-9 items-center gap-2 border border-white/10 px-3 text-xs font-black hover:border-red-700/60">Open <ArrowUpRight className="h-3.5 w-3.5" /></Link></td></tr>)}</tbody>
                </table>
              </div>
            ) : <div className="grid min-h-32 place-items-center px-5 py-8 text-sm text-zinc-500">No customer requests are recorded.</div>}
          </Panel>

          <Panel title="Communication health" eyebrow="Customer-safe interaction signals" icon={<MessageSquareText className="h-4 w-4" />} className="xl:col-span-5">
            <div className="grid sm:grid-cols-2">
              <Field name="Customer / staff messages" value={`${report.communication.customerMessageCount} / ${report.communication.staffMessageCount}`} />
              <Field name="Median first response" value={responseDuration(report.communication.medianFirstResponseMinutes)} />
              <Field name="Latest message" value={dateTime(report.communication.latestMessageAt)} />
              <Field name="Reminder preference" value={label(report.communication.reminderPreference)} />
              <Field name="Email attempts / health" value={`${report.communication.emailAttemptCount} / ${label(report.communication.emailHealth)}`} />
              <Field name="Email delivery states" value={report.communication.emailStatusCounts.map((item) => `${label(item.status)} ${item.count}`).join(" | ") || null} />
            </div>
            <p className="border-t border-white/10 px-4 py-3 text-[11px] leading-5 text-zinc-600">Message bodies, hidden messages and internal notes are deliberately excluded. Only safe counts and response timings are used.</p>
          </Panel>

          <Panel title="Customer timeline" eyebrow="Chronological evidence" icon={<CalendarDays className="h-4 w-4" />} className="xl:col-span-7">
            {report.timeline.length ? <ol className="relative max-h-[520px] overflow-y-auto p-4 before:absolute before:bottom-5 before:left-[21px] before:top-5 before:w-px before:bg-white/10 sm:p-5 sm:before:left-[25px]">{report.timeline.map((item) => <TimelineItem key={item.id} item={item} />)}</ol> : <div className="grid min-h-32 place-items-center text-sm text-zinc-500">No timeline evidence is available.</div>}
          </Panel>

          <Panel title="Next best actions" eyebrow="Transparent customer-success guidance" icon={<BadgeCheck className="h-4 w-4" />} className="xl:col-span-6">
            {report.recommendations.length ? report.recommendations.map((item) => <Recommendation key={item.id} item={item} />) : <div className="flex min-h-32 items-center justify-center gap-2 p-5 text-sm text-emerald-300"><CheckCircle2 className="h-4 w-4" />No immediate data-quality or customer-success action.</div>}
          </Panel>

          <Panel title="Evidence controls" eyebrow="Data provenance and privacy boundary" icon={<ShieldCheck className="h-4 w-4" />} className="xl:col-span-6">
            <div className="grid sm:grid-cols-2">
              {report.dataQuality.sources.map((source) => <div key={source.source} className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3 sm:odd:border-r"><span className="text-xs font-bold text-zinc-300">{label(source.source)}</span><span className={`inline-flex items-center gap-1.5 text-[9px] font-black uppercase ${source.state === "ready" ? "text-emerald-300" : source.state === "partial" ? "text-amber-300" : "text-red-300"}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{source.state}</span></div>)}
            </div>
            <details className="border-t border-white/10 px-4 py-3"><summary className="cursor-pointer text-xs font-black text-zinc-300">Data deliberately excluded from this view</summary><ul className="mt-3 grid gap-2 text-[11px] leading-5 text-zinc-600 sm:grid-cols-2">{report.dataQuality.excludedFromProjection.map((item) => <li key={item} className="flex gap-2"><Database className="mt-0.5 h-3.5 w-3.5 shrink-0" />{item}</li>)}</ul></details>
          </Panel>
        </div>

        <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 py-4 text-[10px] text-zinc-600">
          <span>Generated {dateTime(report.generatedAt)}. Read-only admin projection.</span>
          <span className="inline-flex items-center gap-2"><Globe2 className="h-3.5 w-3.5" />Historical source remains unknown when consented tracking evidence does not exist.</span>
        </footer>
      </div>
    </main>
  );
}
