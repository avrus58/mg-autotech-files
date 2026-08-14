"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  ChevronRight,
  CircleGauge,
  ExternalLink,
  Flag,
  Globe2,
  Info,
  Lightbulb,
  ListChecks,
  MousePointerClick,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/authGuards";
import type {
  ContentCoverageRow,
  SeoGrowthReport,
  SeoOpportunity,
  SeoReportRange,
} from "@/lib/seoGrowth/types";
import type { SearchEngineVerificationReadiness } from "@/lib/searchEngineIndexing";

const searchConsolePerformanceUrl =
  "https://search.google.com/search-console/performance/search-analytics?resource_id=sc-domain%3Amgautotech.de";
const googleAnalyticsUrl = "https://analytics.google.com/analytics/web/";

function integer(value: number) {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(value);
}

function decimal(value: number | null, digits = 1) {
  return value === null ? "-" : value.toFixed(digits);
}

function percent(value: number | null, digits = 1) {
  return value === null ? "-" : `${(value * 100).toFixed(digits)}%`;
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

function priorityClass(priority: "high" | "medium" | "low") {
  if (priority === "high") return "border-red-700/60 bg-red-950/35 text-red-200";
  if (priority === "medium") return "border-amber-700/50 bg-amber-950/25 text-amber-200";
  return "border-white/10 bg-white/[0.03] text-zinc-300";
}

function sourceClass(state: SeoGrowthReport["sources"]["analytics"]["state"]) {
  if (state === "ready") return "border-emerald-700/40 bg-emerald-950/25 text-emerald-200";
  if (state === "error") return "border-red-700/40 bg-red-950/25 text-red-200";
  return "border-amber-700/40 bg-amber-950/25 text-amber-200";
}

export default function SeoPerformanceClient({
  measurementConfigured,
  searchEngineVerification,
}: {
  measurementConfigured: boolean;
  searchEngineVerification: SearchEngineVerificationReadiness;
}) {
  const [range, setRange] = useState<SeoReportRange>("28d");
  const [data, setData] = useState<SeoGrowthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [indexing, setIndexing] = useState(false);
  const [indexingMessage, setIndexingMessage] = useState("");
  const [indexingError, setIndexingError] = useState("");
  const [opportunityFilter, setOpportunityFilter] = useState<"all" | SeoOpportunity["priority"]>("all");

  const load = useCallback(async (nextRange: SeoReportRange, silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const response = await authenticatedFetch(`/api/admin/seo-performance?range=${nextRange}`, {
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "SEO performance could not be loaded.");
      setData(payload as SeoGrowthReport);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "SEO performance could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(range), 0);
    return () => window.clearTimeout(timer);
  }, [load, range]);

  const filteredOpportunities = useMemo(() => {
    const opportunities = data?.opportunities ?? [];
    return opportunityFilter === "all"
      ? opportunities
      : opportunities.filter((item) => item.priority === opportunityFilter);
  }, [data, opportunityFilter]);

  const notifySearchEngines = useCallback(async () => {
    setIndexing(true);
    setIndexingMessage("");
    setIndexingError("");
    try {
      const response = await authenticatedFetch("/api/admin/seo-performance/indexnow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Search engines could not be notified.");
      setIndexingMessage(`${payload.submittedUrlCount} canonical public URLs were accepted for discovery.`);
    } catch (notificationError) {
      setIndexingError(
        notificationError instanceof Error
          ? notificationError.message
          : "Search engines could not be notified."
      );
    } finally {
      setIndexing(false);
    }
  }, []);

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
                <BarChart3 className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-400">Search demand to request</p>
                <h1 className="truncate text-xl font-black sm:text-2xl">SEO Opportunity & Conversion Center</h1>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-white/10 bg-[#0b0c0e] p-1" aria-label="Report date range">
              {(["28d", "90d"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRange(value)}
                  className={`min-w-16 rounded-md px-3 py-2 text-xs font-black transition ${range === value ? "bg-red-700 text-white" : "text-zinc-500 hover:text-white"}`}
                  aria-pressed={range === value}
                >
                  {value === "28d" ? "28 days" : "90 days"}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void load(range, true)}
              disabled={refreshing}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-[#111214] px-4 text-xs font-black transition hover:border-red-800/50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] space-y-5 px-4 py-6 sm:px-6">
        {error ? (
          <div className="flex items-start gap-3 rounded-lg border border-red-800/50 bg-red-950/25 p-4 text-sm text-red-100">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div><strong>Reporting needs attention.</strong><p className="mt-1 text-red-200/75">{error}</p></div>
          </div>
        ) : null}

        {loading && !data ? <DashboardSkeleton /> : null}
        {data ? (
          <>
            <section className="grid gap-3 xl:grid-cols-[1fr_auto]">
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-[#0b0c0e] p-3">
                <SourceBadge label="Search Console" state={data.sources.searchConsole.state} />
                <SourceBadge label="GA4 Data API" state={data.sources.analytics.state} />
                <span className={`rounded-full border px-3 py-2 text-[11px] font-black ${measurementConfigured ? "border-emerald-700/40 bg-emerald-950/25 text-emerald-200" : "border-amber-700/40 bg-amber-950/25 text-amber-200"}`}>
                  Browser measurement {measurementConfigured ? "active" : "not configured"}
                </span>
                <span className="ml-auto text-[11px] text-zinc-600">Updated {formatDate(data.generatedAt)}</span>
              </div>
              <div className="flex items-center gap-2">
                <ExternalButton href={searchConsolePerformanceUrl} label="Search Console" />
                <ExternalButton href={googleAnalyticsUrl} label="GA4" />
              </div>
            </section>

            <SearchEngineCoveragePanel
              verification={searchEngineVerification}
              indexing={indexing}
              message={indexingMessage}
              error={indexingError}
              onNotify={() => void notifySearchEngines()}
            />

            {data.sources.searchConsole.state === "not_configured" || data.sources.analytics.state === "not_configured" ? (
              <ConfigurationNotice data={data} />
            ) : null}

            <section className="grid gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-2 xl:grid-cols-6">
              <Metric label="Search clicks" value={integer(data.summary.clicks)} detail={`${integer(data.summary.impressions)} impressions`} icon={<MousePointerClick />} />
              <Metric label="Organic CTR" value={percent(data.summary.ctr)} detail={`Position ${decimal(data.summary.averagePosition)}`} icon={<TrendingUp />} />
              <Metric label="Consented sessions" value={integer(data.summary.sessions)} detail={`${integer(data.eventTotals.pageViews)} page views`} icon={<Activity />} />
              <Metric label="Request CTA" value={integer(data.summary.requestCtaClicks)} detail={`${integer(data.summary.requestStarts)} request starts`} icon={<Target />} />
              <Metric label="Completed requests" value={integer(data.summary.leads)} detail={`${percent(data.summary.leadRate)} session rate`} icon={<Flag />} />
              <Metric label="Growth opportunities" value={integer(data.summary.opportunityCount)} detail={`+${integer(data.summary.projectedAdditionalClicks)} directional clicks`} icon={<Sparkles />} />
            </section>

            <section className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
              <FunnelPanel data={data} />
              <WeeklyActions data={data} />
            </section>

            <section className="overflow-hidden rounded-lg border border-white/10 bg-[#0b0c0e]">
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 p-5">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-400">Organic opportunity engine</p>
                  <h2 className="mt-1 text-xl font-black">Queries positioned 4-20</h2>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">Prioritized by real impressions, rank, CTR gap and aggregate request-intent context.</p>
                </div>
                <div className="flex flex-wrap gap-2" aria-label="Opportunity priority filter">
                  {(["all", "high", "medium", "low"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setOpportunityFilter(value)}
                      className={`rounded-md border px-3 py-2 text-[11px] font-black capitalize ${opportunityFilter === value ? "border-red-700 bg-red-950/40 text-red-100" : "border-white/10 text-zinc-500 hover:text-white"}`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
              {filteredOpportunities.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1080px] text-left text-xs">
                    <thead className="bg-black/30 uppercase tracking-[0.14em] text-zinc-600">
                      <tr><th className="px-5 py-3">Opportunity</th><th className="px-4 py-3">Page</th><th className="px-4 py-3">Position</th><th className="px-4 py-3">Impressions</th><th className="px-4 py-3">CTR / benchmark</th><th className="px-4 py-3">Request intent</th><th className="px-5 py-3">Action</th></tr>
                    </thead>
                    <tbody>
                      {filteredOpportunities.slice(0, 40).map((item) => <OpportunityRow key={item.id} item={item} />)}
                    </tbody>
                  </table>
                </div>
              ) : <EmptyState icon={<Search />} title="No qualified opportunities in this view" detail="The engine needs Search Console rows with at least eight impressions and an average position between 4 and 20." />}
            </section>

            <section className="grid gap-5 xl:grid-cols-2">
              <CountryPanel data={data} />
              <LandingPagePanel data={data} />
            </section>

            <ContentCoveragePanel rows={data.contentCoverage} />

            <section className="grid gap-4 lg:grid-cols-3">
              <BoundaryCard icon={<ShieldCheck />} title="Privacy boundary" tone="green">
                No email, account ID, order ID, vehicle, selected service, file data, payment value, admin state or request content enters this report.
              </BoundaryCard>
              <BoundaryCard icon={<Info />} title="Attribution boundary" tone="blue">
                Search queries are never joined to completed requests. Page opportunities use aggregate sessions and request CTA clicks only.
              </BoundaryCard>
              <BoundaryCard icon={<CircleGauge />} title="Decision boundary" tone="red">
                Recommendations are a review queue. Nothing is edited, published, indexed or submitted to Google automatically.
              </BoundaryCard>
            </section>

            <details className="rounded-lg border border-white/10 bg-[#0b0c0e] p-5">
              <summary className="cursor-pointer text-sm font-black">Data limitations and interpretation notes</summary>
              <ul className="mt-4 grid gap-2 text-xs leading-6 text-zinc-500 lg:grid-cols-2">
                {data.limitations.map((item) => <li key={item} className="flex gap-2"><ChevronRight className="mt-1 h-4 w-4 shrink-0 text-red-400" />{item}</li>)}
              </ul>
            </details>
          </>
        ) : null}
      </div>
    </main>
  );
}

function SourceBadge({ label, state }: { label: string; state: SeoGrowthReport["sources"]["analytics"]["state"] }) {
  return <span className={`rounded-full border px-3 py-2 text-[11px] font-black ${sourceClass(state)}`}>{label}: {state.replaceAll("_", " ")}</span>;
}

function SearchEngineCoveragePanel({
  verification,
  indexing,
  message,
  error,
  onNotify,
}: {
  verification: SearchEngineVerificationReadiness;
  indexing: boolean;
  message: string;
  error: string;
  onNotify: () => void;
}) {
  const engines = [
    { label: "Bing", ready: verification.bing, detail: "Bing Webmaster verification" },
    { label: "Yandex", ready: verification.yandex, detail: "Yandex Webmaster verification" },
    { label: "Baidu", ready: verification.baidu, detail: "Optional regional verification" },
    { label: "Naver", ready: verification.naver, detail: "Optional regional verification" },
  ];

  return (
    <section className="overflow-hidden rounded-lg border border-cyan-900/40 bg-[linear-gradient(135deg,rgba(8,31,40,.5),rgba(11,12,14,1)_60%)]">
      <div className="grid gap-5 p-5 xl:grid-cols-[1fr_auto] xl:items-center">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Multi-engine discovery</p>
          <h2 className="mt-1 text-xl font-black">Bing, partner engines and regional search</h2>
          <p className="mt-1 max-w-4xl text-xs leading-6 text-zinc-400">
            IndexNow sends only canonical public sitemap URLs. Admin, account, API, payment and customer routes are always excluded.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-emerald-700/40 bg-emerald-950/25 px-3 py-1.5 text-[10px] font-black text-emerald-200">IndexNow key active</span>
            {engines.map((engine) => (
              <span
                key={engine.label}
                title={engine.detail}
                className={`rounded-full border px-3 py-1.5 text-[10px] font-black ${engine.ready ? "border-emerald-700/40 bg-emerald-950/25 text-emerald-200" : "border-white/10 bg-white/[0.03] text-zinc-500"}`}
              >
                {engine.label}: {engine.ready ? "verified" : "verification pending"}
              </span>
            ))}
          </div>
          {message ? <p className="mt-3 text-xs font-bold text-emerald-300" role="status">{message}</p> : null}
          {error ? <p className="mt-3 text-xs font-bold text-red-300" role="alert">{error}</p> : null}
        </div>
        <button
          type="button"
          onClick={onNotify}
          disabled={indexing}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-cyan-700/50 bg-cyan-950/30 px-4 text-xs font-black text-cyan-100 transition hover:border-cyan-500 disabled:cursor-wait disabled:opacity-60"
        >
          <Send className={`h-4 w-4 ${indexing ? "animate-pulse" : ""}`} aria-hidden="true" />
          {indexing ? "Notifying search engines..." : "Notify search engines"}
        </button>
      </div>
    </section>
  );
}

function ExternalButton({ href, label }: { href: string; label: string }) {
  return <a href={href} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-[#111214] px-3 text-[11px] font-black text-zinc-300 transition hover:border-red-800/50 hover:text-white">{label}<ExternalLink className="h-3.5 w-3.5" /></a>;
}

function ConfigurationNotice({ data }: { data: SeoGrowthReport }) {
  return (
    <section className="grid gap-4 rounded-lg border border-amber-700/35 bg-amber-950/15 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
        <div>
          <h2 className="font-black text-amber-100">Server reporting connection is incomplete</h2>
          <p className="mt-1 max-w-4xl text-xs leading-6 text-zinc-400">The dashboard remains safe and operational, but live aggregate rows need a read-only Google service account shared with Search Console and GA4. Secrets stay server-side and are never returned by this API.</p>
        </div>
      </div>
      <div className="flex gap-2 text-[11px] font-black">
        <span className={`rounded-md border px-3 py-2 ${data.configuration.searchConsoleConfigured ? "border-emerald-700/40 text-emerald-200" : "border-amber-700/40 text-amber-200"}`}>Search {data.configuration.searchConsoleConfigured ? "ready" : "pending"}</span>
        <span className={`rounded-md border px-3 py-2 ${data.configuration.analyticsConfigured ? "border-emerald-700/40 text-emerald-200" : "border-amber-700/40 text-amber-200"}`}>GA4 {data.configuration.analyticsConfigured ? "ready" : "pending"}</span>
      </div>
    </section>
  );
}

function Metric({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: ReactNode }) {
  return (
    <div className="min-h-32 bg-[#0b0c0e] p-4">
      <div className="flex items-center justify-between text-zinc-600"><span className="text-[10px] font-black uppercase tracking-[0.16em]">{label}</span><span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span></div>
      <div className="mt-4 text-2xl font-black">{value}</div>
      <div className="mt-2 text-[11px] text-zinc-500">{detail}</div>
    </div>
  );
}

function FunnelPanel({ data }: { data: SeoGrowthReport }) {
  const steps = [
    { label: "Google impressions", value: data.summary.impressions, tone: "bg-zinc-600" },
    { label: "Search clicks", value: data.summary.clicks, tone: "bg-red-700" },
    { label: "Consented sessions", value: data.summary.sessions, tone: "bg-cyan-700" },
    { label: "Request starts", value: data.summary.requestStarts, tone: "bg-amber-600" },
    { label: "Completed requests", value: data.summary.leads, tone: "bg-emerald-600" },
  ];
  const max = Math.max(1, ...steps.map((step) => step.value));
  return (
    <section className="rounded-lg border border-white/10 bg-[#0b0c0e] p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-400">Aggregate acquisition funnel</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-xl font-black">Search visibility to secure request</h2><p className="mt-1 text-xs text-zinc-500">Separate aggregate systems, shown together without identity stitching.</p></div>
        <span className="rounded-full border border-white/10 px-3 py-1.5 text-[10px] font-black text-zinc-500">{data.dateRange.startDate} - {data.dateRange.endDate}</span>
      </div>
      <div className="mt-6 space-y-4">
        {steps.map((step) => (
          <div key={step.label} className="grid grid-cols-[130px_1fr_64px] items-center gap-3 text-xs sm:grid-cols-[170px_1fr_80px]">
            <span className="font-bold text-zinc-300">{step.label}</span>
            <div className="h-2 overflow-hidden rounded-full bg-white/5"><div className={`h-full rounded-full ${step.tone}`} style={{ width: `${Math.max(step.value ? 3 : 0, (step.value / max) * 100)}%` }} /></div>
            <span className="text-right font-black">{integer(step.value)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function WeeklyActions({ data }: { data: SeoGrowthReport }) {
  return (
    <section className="rounded-lg border border-red-900/40 bg-[linear-gradient(145deg,rgba(45,8,10,.55),rgba(11,12,14,1)_55%)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-400">This week&apos;s focus</p><h2 className="mt-1 text-xl font-black">Evidence-backed action queue</h2></div>
        <ListChecks className="h-5 w-5 text-red-300" />
      </div>
      <div className="mt-4 space-y-2">
        {data.weeklyActions.length ? data.weeklyActions.slice(0, 5).map((item, index) => (
          <div key={item.id} className="grid grid-cols-[30px_1fr] gap-3 rounded-lg border border-white/10 bg-black/25 p-3">
            <span className="grid h-7 w-7 place-items-center rounded-md border border-red-800/40 bg-red-950/30 text-[11px] font-black text-red-200">{index + 1}</span>
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-black">{item.title}</h3><span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase ${priorityClass(item.priority)}`}>{item.priority}</span></div><p className="mt-1 text-[11px] leading-5 text-zinc-500">{item.action}</p></div>
          </div>
        )) : <EmptyState icon={<Lightbulb />} title="Waiting for aggregate reporting data" detail="Actions appear only when Search Console or GA4 supplies enough evidence." compact />}
      </div>
    </section>
  );
}

function OpportunityRow({ item }: { item: SeoOpportunity }) {
  return (
    <tr className="border-t border-white/10 align-top transition hover:bg-white/[0.02]">
      <td className="max-w-[300px] px-5 py-4"><div className="flex items-center gap-2"><span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase ${priorityClass(item.priority)}`}>{item.score}</span><span className="font-black text-white">{item.query}</span></div><div className="mt-2 text-[10px] uppercase tracking-[0.12em] text-zinc-600">{item.type.replaceAll("_", " ")}</div></td>
      <td className="max-w-[230px] px-4 py-4 font-mono text-[11px] text-zinc-400"><span className="line-clamp-2 break-all">{item.pagePath}</span></td>
      <td className="px-4 py-4 font-black">{decimal(item.position)}</td>
      <td className="px-4 py-4"><strong>{integer(item.impressions)}</strong><div className="mt-1 text-zinc-600">{integer(item.clicks)} clicks</div></td>
      <td className="px-4 py-4"><strong>{percent(item.ctr)}</strong><div className="mt-1 text-zinc-600">guide {percent(item.expectedCtr)}</div></td>
      <td className="px-4 py-4"><strong>{item.pageRequestCtaClicks === null ? "-" : integer(item.pageRequestCtaClicks)}</strong><div className="mt-1 text-zinc-600">{percent(item.pageIntentRate)} CTA / session</div></td>
      <td className="max-w-[330px] px-5 py-4 leading-5 text-zinc-400">{item.recommendation}{item.attribution === "page_level_inference" ? <span className="mt-2 block text-[10px] font-black uppercase tracking-[0.12em] text-amber-300">Page-level inference</span> : null}</td>
    </tr>
  );
}

function CountryPanel({ data }: { data: SeoGrowthReport }) {
  return (
    <section className="overflow-hidden rounded-lg border border-white/10 bg-[#0b0c0e]">
      <div className="border-b border-white/10 p-5"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-400">Global demand</p><h2 className="mt-1 text-xl font-black">Country performance</h2><p className="mt-1 text-xs text-zinc-500">Search demand and consented request events remain separate aggregate views.</p></div>
      <div className="border-b border-white/10 px-5 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-600">Search Console demand</div>
      <div className="divide-y divide-white/10">
        {data.searchCountries.slice(0, 8).map((country) => (
          <div key={country.countryCode} className="grid grid-cols-[1fr_repeat(3,minmax(70px,auto))] items-center gap-3 px-5 py-3 text-xs">
            <span className="inline-flex items-center gap-2 font-black"><Globe2 className="h-4 w-4 text-zinc-600" />{country.countryCode.toUpperCase()}</span><span><strong>{integer(country.clicks)}</strong><small className="block text-zinc-600">clicks</small></span><span><strong>{integer(country.impressions)}</strong><small className="block text-zinc-600">impressions</small></span><span><strong>{percent(country.ctr)}</strong><small className="block text-zinc-600">CTR</small></span>
          </div>
        ))}
        {!data.searchCountries.length ? <EmptyState icon={<Globe2 />} title="No country rows yet" detail="Aggregate country demand appears after Search Console reporting is connected." compact /> : null}
      </div>
      <div className="border-y border-white/10 px-5 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-600">GA4 consented request funnel</div>
      <div className="divide-y divide-white/10">
        {data.analyticsCountries.slice(0, 6).map((country) => (
          <div key={country.country} className="grid grid-cols-[1fr_repeat(3,minmax(58px,auto))] items-center gap-3 px-5 py-3 text-xs">
            <span className="min-w-0 truncate font-black">{country.country}</span><span><strong>{integer(country.sessions)}</strong><small className="block text-zinc-600">sessions</small></span><span><strong>{integer(country.requestStarts)}</strong><small className="block text-zinc-600">starts</small></span><span><strong>{integer(country.leads)}</strong><small className="block text-zinc-600">completed</small></span>
          </div>
        ))}
        {!data.analyticsCountries.length ? <EmptyState icon={<Activity />} title="No consented country funnel yet" detail="GA4 country totals appear here without customer identity." compact /> : null}
      </div>
    </section>
  );
}

function LandingPagePanel({ data }: { data: SeoGrowthReport }) {
  return (
    <section className="overflow-hidden rounded-lg border border-white/10 bg-[#0b0c0e]">
      <div className="border-b border-white/10 p-5"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-400">Conversion surfaces</p><h2 className="mt-1 text-xl font-black">Top landing pages</h2></div>
      <div className="divide-y divide-white/10">
        {data.landingPages.slice(0, 8).map((page) => (
          <div key={page.pagePath} className="grid grid-cols-[1fr_repeat(3,minmax(58px,auto))] items-center gap-3 px-5 py-3 text-xs">
            <span className="min-w-0 truncate font-mono text-[11px] font-bold text-zinc-300">{page.pagePath}</span><span><strong>{integer(page.sessions)}</strong><small className="block text-zinc-600">sessions</small></span><span><strong>{integer(page.requestCtaClicks)}</strong><small className="block text-zinc-600">CTA clicks</small></span><span><strong>{percent(page.sessions > 0 ? page.requestCtaClicks / page.sessions : null)}</strong><small className="block text-zinc-600">intent rate</small></span>
          </div>
        ))}
        {!data.landingPages.length ? <EmptyState icon={<MousePointerClick />} title="No landing-page rows yet" detail="Only consented public measurement is included." compact /> : null}
      </div>
    </section>
  );
}

function ContentCoveragePanel({ rows }: { rows: ContentCoverageRow[] }) {
  const meaningful = rows.filter((row) => row.state !== "no_reported_data").slice(0, 24);
  return (
    <section className="overflow-hidden rounded-lg border border-white/10 bg-[#0b0c0e]">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 p-5">
        <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-400">Canonical content inventory</p><h2 className="mt-1 text-xl font-black">Services, brands, platforms and guides</h2><p className="mt-1 text-xs text-zinc-500">Existing routes only. This report does not create doorway pages.</p></div>
        <span className="rounded-full border border-white/10 px-3 py-1.5 text-[10px] font-black text-zinc-500">{rows.length} indexed routes monitored</span>
      </div>
      {meaningful.length ? <div className="grid gap-px bg-white/10 sm:grid-cols-2 xl:grid-cols-3">{meaningful.map((row) => (
        <div key={row.path} className="bg-[#0b0c0e] p-4">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className="text-[9px] font-black uppercase tracking-[0.14em] text-red-400">{row.group.replaceAll("_", " ")}</span><h3 className="mt-1 truncate text-sm font-black">{row.label}</h3></div><CoverageState state={row.state} /></div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] text-zinc-500"><span><strong className="block text-sm text-white">{integer(row.searchImpressions)}</strong>Impressions</span><span><strong className="block text-sm text-white">{integer(row.sessions)}</strong>Sessions</span><span><strong className="block text-sm text-white">{integer(row.requestCtaClicks)}</strong>CTA clicks</span></div>
          <Link href={row.path} target="_blank" className="mt-3 inline-flex max-w-full items-center gap-1 truncate font-mono text-[10px] text-zinc-600 hover:text-red-300">{row.path}<ArrowUpRight className="h-3 w-3 shrink-0" /></Link>
        </div>
      ))}</div> : <EmptyState icon={<BarChart3 />} title="Inventory ready, performance rows pending" detail="The route inventory is complete. Live coverage appears once the aggregate reporting sources return data." />}
    </section>
  );
}

function CoverageState({ state }: { state: ContentCoverageRow["state"] }) {
  const styles = state === "driving_request_intent" ? "border-emerald-700/40 text-emerald-300" : state === "visible_no_request_intent" ? "border-amber-700/40 text-amber-300" : "border-white/10 text-zinc-500";
  const label = state === "driving_request_intent" ? "driving intent" : state === "visible_no_request_intent" ? "intent gap" : state.replaceAll("_", " ");
  return <span className={`shrink-0 rounded-full border px-2 py-1 text-[8px] font-black uppercase ${styles}`}>{label}</span>;
}

function BoundaryCard({ icon, title, tone, children }: { icon: ReactNode; title: string; tone: "green" | "blue" | "red"; children: ReactNode }) {
  const colors = tone === "green" ? "border-emerald-800/30 bg-emerald-950/10 text-emerald-300" : tone === "blue" ? "border-cyan-800/30 bg-cyan-950/10 text-cyan-300" : "border-red-800/30 bg-red-950/10 text-red-300";
  return <div className={`rounded-lg border p-5 ${colors}`}><div className="flex items-center gap-2 [&>svg]:h-5 [&>svg]:w-5">{icon}<h2 className="font-black text-white">{title}</h2></div><p className="mt-3 text-xs leading-6 text-zinc-400">{children}</p></div>;
}

function EmptyState({ icon, title, detail, compact = false }: { icon: ReactNode; title: string; detail: string; compact?: boolean }) {
  return <div className={`grid place-items-center text-center ${compact ? "p-5" : "min-h-48 p-8"}`}><div><span className="mx-auto grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-zinc-600 [&>svg]:h-4 [&>svg]:w-4">{icon}</span><h3 className="mt-3 text-sm font-black text-zinc-300">{title}</h3><p className="mx-auto mt-1 max-w-lg text-[11px] leading-5 text-zinc-600">{detail}</p></div></div>;
}

function DashboardSkeleton() {
  return <div className="space-y-5" aria-label="Loading SEO performance"><div className="h-14 animate-pulse rounded-lg bg-white/[0.04]" /><div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-6">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-32 animate-pulse rounded-lg bg-white/[0.04]" />)}</div><div className="grid gap-5 xl:grid-cols-2"><div className="h-80 animate-pulse rounded-lg bg-white/[0.04]" /><div className="h-80 animate-pulse rounded-lg bg-white/[0.04]" /></div></div>;
}
