"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Braces,
  CheckCircle2,
  CircleDollarSign,
  Globe2,
  Inbox,
  Loader2,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/authGuards";
import type {
  AdminWidgetClientListItem,
  WidgetAdminClientListPayload,
} from "@/lib/widget/adminTypes";
import type { WidgetCommercialStage } from "@/lib/widget/commercial";

type Segment = "all" | "attention" | "onboarding" | "live" | "paused" | "churned";

const segmentDefinitions: Array<{ id: Segment; label: string }> = [
  { id: "all", label: "All clients" },
  { id: "attention", label: "Needs attention" },
  { id: "onboarding", label: "Onboarding" },
  { id: "live", label: "Live" },
  { id: "paused", label: "Paused" },
  { id: "churned", label: "Churned" },
];

function isSegmentMatch(stage: WidgetCommercialStage, segment: Segment) {
  if (segment === "all") return true;
  if (segment === "onboarding") return ["prospect", "onboarding", "ready"].includes(stage);
  return stage === segment;
}

function formatMoney(value: number, currency: string | null) {
  if (!currency) return "Mixed currencies";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "No activity yet";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function AdminWidgetClientsPage() {
  const [payload, setPayload] = useState<WidgetAdminClientListPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<Segment>("all");

  const authFetch = useCallback(
    (url: string, init?: RequestInit) => authenticatedFetch(url, { ...init, cache: "no-store" }),
    [],
  );

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const response = await authFetch("/api/admin/widget-clients");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Widget clients could not be loaded.");
      setPayload(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Widget clients could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authFetch]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const clients = useMemo(() => payload?.clients ?? [], [payload]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return clients.filter((client) => {
      if (!isSegmentMatch(client.commercial.stage, segment)) return false;
      if (!term) return true;
      return [
        client.company_name,
        client.email,
        client.allowed_domain,
        client.website_domain,
        client.plan,
        client.commercial.stage,
        client.commercial.next_action?.title ?? "",
        client.metrics.latest_requested_domain ?? "",
      ].join(" ").toLowerCase().includes(term);
    });
  }, [clients, search, segment]);

  const actionQueue = useMemo(() => clients
    .filter((client) => client.commercial.next_action)
    .sort((left, right) => {
      const severity = { critical: 0, warning: 1, info: 2 } as const;
      const difference = severity[left.commercial.next_action!.severity] - severity[right.commercial.next_action!.severity];
      return difference || left.commercial.score - right.commercial.score;
    })
    .slice(0, 5), [clients]);

  if (loading && !payload) return <WidgetAdminLoading />;

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <header className="border-b border-white/10 bg-black/80">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-red-800/50 bg-red-950/25">
              <Braces className="h-5 w-5 text-red-500" />
            </span>
            <div className="min-w-0">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-red-500">Commercial operations</div>
              <h1 className="truncate text-2xl font-black">Widget SaaS Control Center</h1>
              <p className="mt-1 text-sm text-zinc-500">Subscriptions, installations, usage and lead delivery in one workspace.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex h-11 items-center rounded-lg border border-white/10 px-4 text-sm font-black disabled:opacity-50">
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />Refresh
            </button>
            <Link href="/admin/widget-settings" className="inline-flex h-11 items-center rounded-lg border border-white/10 px-4 text-sm font-black"><Settings className="mr-2 h-4 w-4" />Global controls</Link>
            <Link href="/admin" className="inline-flex h-11 items-center rounded-lg border border-white/10 px-4 text-sm font-black"><ArrowLeft className="mr-2 h-4 w-4" />Admin</Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1600px] space-y-7 px-4 py-7 lg:px-6">
        {error && (
          <div role="alert" className="flex flex-col gap-3 border-l-2 border-red-600 bg-red-950/15 p-4 text-sm text-red-100 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <button type="button" onClick={() => void load()} className="h-10 rounded-lg border border-red-700/40 px-4 text-xs font-black">Try again</button>
          </div>
        )}

        {payload && (
          <>
            <div className="grid gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-2 xl:grid-cols-6">
              <SummaryMetric icon={<Users />} label="Clients" value={payload.overview.total_clients.toString()} detail={`${payload.overview.active_clients} active`} />
              <SummaryMetric icon={<Activity />} label="Live installs" value={payload.overview.live_clients.toString()} detail={`${payload.overview.onboarding_clients} onboarding`} tone="success" />
              <SummaryMetric icon={<AlertTriangle />} label="Needs attention" value={payload.overview.attention_clients.toString()} detail={`${payload.overview.pending_domain_requests} domain reviews`} tone={payload.overview.attention_clients ? "danger" : "default"} />
              <SummaryMetric icon={<Inbox />} label="Leads this month" value={payload.overview.enquiries_this_month.toString()} detail={`${payload.overview.failed_enquiries_this_month} delivery failures`} tone={payload.overview.failed_enquiries_this_month ? "danger" : "default"} />
              <SummaryMetric icon={<Globe2 />} label="Blocked requests" value={payload.overview.blocked_this_month.toString()} detail="Current calendar month" />
              <SummaryMetric icon={<CircleDollarSign />} label="Active plan value" value={formatMoney(payload.overview.active_plan_value, payload.overview.currency)} detail="Local monthly catalogue value" />
            </div>

            <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="border-t border-red-800/50 pt-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.16em] text-red-500">Priority desk</div>
                    <h2 className="mt-2 text-2xl font-black">Commercial action queue</h2>
                    <p className="mt-1 text-sm text-zinc-500">Critical access, billing and lead issues are ordered first.</p>
                  </div>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-black text-zinc-400">{actionQueue.length} shown</span>
                </div>
                <div className="mt-5 divide-y divide-white/10 border-y border-white/10">
                  {actionQueue.map((client) => (
                    <Link key={client.id} href={`/admin/widget-clients/${client.id}`} className="group grid gap-3 py-4 transition-colors hover:bg-white/[0.02] sm:grid-cols-[1fr_1.2fr_auto] sm:items-center sm:px-3">
                      <div className="min-w-0"><div className="truncate font-black">{client.company_name}</div><div className="mt-1 truncate text-xs text-zinc-500">{client.allowed_domain}</div></div>
                      <div className="min-w-0"><div className={`text-sm font-black ${client.commercial.next_action?.severity === "critical" ? "text-red-300" : "text-amber-200"}`}>{client.commercial.next_action?.title}</div><div className="mt-1 truncate text-xs text-zinc-500">{client.commercial.next_action?.detail}</div></div>
                      <ArrowUpRight className="h-4 w-4 text-zinc-600 transition-colors group-hover:text-white" />
                    </Link>
                  ))}
                  {!actionQueue.length && <div className="flex items-center gap-3 py-8 text-sm text-emerald-300"><CheckCircle2 className="h-5 w-5" />No widget account currently needs intervention.</div>}
                </div>
              </div>

              <div className="border-t border-white/10 pt-5">
                <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Operational definition</div>
                <h2 className="mt-2 text-2xl font-black">What “live” means</h2>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <Definition icon={<ShieldCheck />} title="Commercially active" detail="Subscription and local access are both active." />
                  <Definition icon={<Globe2 />} title="Origin verified" detail="A successful request has arrived from the approved domain." />
                  <Definition icon={<Activity />} title="Installation observed" detail="At least one live widget load has been recorded this month." />
                </div>
                <p className="mt-4 text-xs leading-5 text-zinc-600">Metrics source: {payload.metrics_source === "database_aggregate" ? "commercial aggregate" : "compatibility mode until hardening SQL is applied"}.</p>
              </div>
            </section>

            <section>
              <div className="flex flex-col gap-4 border-b border-white/10 pb-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.16em] text-red-500">Client portfolio</div>
                  <h2 className="mt-2 text-2xl font-black">Widget clients</h2>
                  <p className="mt-1 text-sm text-zinc-500">{filtered.length} of {clients.length} clients shown.</p>
                </div>
                <div className="flex w-full flex-col gap-3 lg:w-auto lg:items-end">
                  <div className="relative w-full lg:w-[390px]"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search company, email, domain or plan" className="h-11 w-full rounded-lg border border-white/10 bg-black/30 pl-11 pr-4 text-sm font-bold outline-none focus:border-red-700" /></div>
                  <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
                    {segmentDefinitions.map((item) => (
                      <button key={item.id} type="button" onClick={() => setSegment(item.id)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-black ${segment === item.id ? "border-red-700 bg-red-950/30 text-white" : "border-white/10 text-zinc-500"}`}>{item.label}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[1180px] text-left text-sm">
                  <thead className="text-[11px] font-black uppercase tracking-[0.13em] text-zinc-600"><tr><th className="px-3 py-4">Client</th><th className="px-3 py-4">Commercial state</th><th className="px-3 py-4">Onboarding</th><th className="px-3 py-4">Usage</th><th className="px-3 py-4">Leads</th><th className="px-3 py-4">Last activity</th><th className="px-3 py-4">Plan</th><th className="px-3 py-4 text-right">Action</th></tr></thead>
                  <tbody className="divide-y divide-white/10">
                    {filtered.map((client) => <ClientTableRow key={client.id} client={client} />)}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 pt-4 lg:hidden">
                {filtered.map((client) => <ClientMobileRow key={client.id} client={client} />)}
              </div>

              {!filtered.length && <div className="border-b border-white/10 py-16 text-center"><Search className="mx-auto h-7 w-7 text-zinc-700" /><div className="mt-3 font-black">No matching widget clients</div><p className="mt-1 text-sm text-zinc-600">Change the search or portfolio filter.</p></div>}
            </section>
          </>
        )}
      </section>
    </main>
  );
}

function WidgetAdminLoading() {
  return <main className="flex min-h-screen items-center justify-center bg-[#050505] text-white"><div className="text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-red-500" /><div className="mt-4 font-black">Loading commercial widget portfolio...</div><p className="mt-1 text-sm text-zinc-600">Subscriptions and live usage are being reconciled.</p></div></main>;
}

function SummaryMetric({ icon, label, value, detail, tone = "default" }: { icon: React.ReactNode; label: string; value: string; detail: string; tone?: "default" | "success" | "danger" }) {
  const toneClass = tone === "success" ? "text-emerald-400" : tone === "danger" ? "text-red-400" : "text-zinc-400";
  return <div className="min-w-0 bg-[#090909] p-4"><div className={`flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] ${toneClass}`}>{icon}{label}</div><div className="mt-3 truncate text-2xl font-black">{value}</div><div className="mt-1 truncate text-xs text-zinc-600">{detail}</div></div>;
}

function Definition({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return <div className="flex gap-3 border-l border-white/10 py-1 pl-4"><span className="mt-0.5 text-red-400">{icon}</span><div><div className="text-sm font-black">{title}</div><p className="mt-1 text-xs leading-5 text-zinc-500">{detail}</p></div></div>;
}

function ClientTableRow({ client }: { client: AdminWidgetClientListItem }) {
  return (
    <tr className="group transition-colors hover:bg-white/[0.02]">
      <td className="px-3 py-4"><div className="max-w-[220px] truncate font-black">{client.company_name}</div><div className="mt-1 max-w-[220px] truncate text-xs text-zinc-500">{client.allowed_domain}</div></td>
      <td className="px-3 py-4"><HealthBadge client={client} /><div className="mt-2 max-w-[190px] truncate text-xs text-zinc-500">{client.commercial.next_action?.title ?? "No action required"}</div></td>
      <td className="px-3 py-4"><div className="flex items-center gap-2"><div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-red-600" style={{ width: `${Math.round((client.commercial.onboarding_completed / client.commercial.onboarding_total) * 100)}%` }} /></div><span className="text-xs font-black">{client.commercial.onboarding_completed}/{client.commercial.onboarding_total}</span></div>{client.metrics.pending_domain_request_count > 0 && <div className="mt-2 text-xs font-black text-amber-300">{client.metrics.pending_domain_request_count} domain review</div>}</td>
      <td className="px-3 py-4"><div className="font-black">{client.metrics.usage_this_month.toLocaleString()} <span className="text-xs text-zinc-600">/ {client.monthly_usage_limit.toLocaleString()}</span></div><div className="mt-2 h-1.5 w-24 overflow-hidden rounded-full bg-white/10"><div className={`h-full ${client.commercial.usage_percent >= 85 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${client.commercial.usage_percent}%` }} /></div></td>
      <td className="px-3 py-4"><div className="font-black">{client.metrics.enquiries_this_month}</div><div className={`mt-1 text-xs ${client.metrics.failed_enquiries_this_month ? "text-red-300" : "text-zinc-600"}`}>{client.metrics.failed_enquiries_this_month} failed</div></td>
      <td className="px-3 py-4 text-xs text-zinc-500">{formatDate(client.metrics.last_allowed_at ?? client.metrics.last_enquiry_at)}</td>
      <td className="px-3 py-4"><div className="font-black uppercase">{client.plan}</div><div className="mt-1 text-xs text-zinc-500">{client.monthly_price.toFixed(2)} {client.currency.toUpperCase()} / mo</div></td>
      <td className="px-3 py-4 text-right"><Link href={`/admin/widget-clients/${client.id}`} aria-label={`Open ${client.company_name}`} className="inline-flex h-10 items-center rounded-lg border border-white/10 px-3 text-xs font-black transition-colors group-hover:border-red-700/60">Manage<ArrowUpRight className="ml-2 h-4 w-4" /></Link></td>
    </tr>
  );
}

function ClientMobileRow({ client }: { client: AdminWidgetClientListItem }) {
  return <Link href={`/admin/widget-clients/${client.id}`} className="rounded-lg border border-white/10 bg-white/[0.02] p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate text-lg font-black">{client.company_name}</div><div className="mt-1 truncate text-sm text-zinc-500">{client.allowed_domain}</div></div><HealthBadge client={client} /></div><div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-lg bg-white/10"><MobileMetric label="Setup" value={`${client.commercial.onboarding_completed}/${client.commercial.onboarding_total}`} /><MobileMetric label="Usage" value={`${client.commercial.usage_percent}%`} /><MobileMetric label="Leads" value={client.metrics.enquiries_this_month.toString()} /></div>{client.commercial.next_action && <div className={`mt-4 flex items-start gap-2 text-xs ${client.commercial.next_action.severity === "critical" ? "text-red-300" : "text-amber-200"}`}><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span><strong>{client.commercial.next_action.title}:</strong> {client.commercial.next_action.detail}</span></div>}</Link>;
}

function MobileMetric({ label, value }: { label: string; value: string }) {
  return <div className="bg-[#090909] p-3"><div className="text-[10px] font-black uppercase tracking-[0.1em] text-zinc-600">{label}</div><div className="mt-1 font-black">{value}</div></div>;
}

function HealthBadge({ client }: { client: AdminWidgetClientListItem }) {
  const styles = client.commercial.level === "healthy"
    ? "border-emerald-700/40 bg-emerald-950/25 text-emerald-300"
    : client.commercial.level === "watch"
      ? "border-amber-700/40 bg-amber-950/25 text-amber-200"
      : client.commercial.level === "inactive"
        ? "border-white/10 bg-white/[0.03] text-zinc-500"
        : "border-red-800/40 bg-red-950/25 text-red-300";
  return <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${styles}`}>{client.commercial.stage.replace("_", " ")} · {client.commercial.score}</span>;
}
