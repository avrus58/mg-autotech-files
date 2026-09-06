"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BellRing,
  CheckCircle2,
  ExternalLink,
  Gauge,
  Laptop2,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  Workflow,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/authGuards";

type OperationsTab = "overview" | "queue" | "search" | "customers" | "communications" | "security" | "desktop";

type OperationsData = {
  generatedAt: string;
  access: { role: string | null; staffRole: string | null; permissions: string[] };
  health: Array<{ key: string; label: string; status: "healthy" | "warning"; detail: string | null }>;
  queue: {
    total: number;
    active: number;
    completed: number;
    cancelled: number;
    needsAttention: number;
    waitingForCustomer: number;
    urgentOrHigh: number;
    unassigned: number;
    etaMissing: number;
    estimateElapsed: number;
    stateCounts: Record<string, number>;
  };
  latestOrders: Array<{
    id: string;
    reference: string;
    customer: string;
    customerId: string | null;
    vehicle: string;
    service: string;
    status: string;
    statusLabel: string;
    priority: string;
    etaLabel: string;
    createdAt: string | null;
    needsAttention: boolean;
  }>;
  customers: {
    available: boolean;
    warning: string | null;
    total: number;
    complete: number;
    incomplete: number;
    blocked: number;
    averageCompletion: number;
    incompleteProfiles: Array<{
      id: string;
      customerId: string | null;
      name: string;
      email: string | null;
      accountStatus: string;
      readiness: { percent: number; missing: string[] };
    }>;
  };
  communications: {
    email: {
      available: boolean;
      warning: string | null;
      provider: string;
      configured: boolean;
      dryRun: boolean;
      sendingEnabled: boolean;
      summary: { sent: number; skipped: number; failed: number; pending: number };
    };
    notifications: { available: boolean; warning: string | null; unread: number };
  };
  vehicleCache: {
    available: boolean;
    warning: string | null;
    snapshot: Record<string, unknown> | null;
  };
  desktop: {
    minimum_supported_version: string;
    latest_version: string;
    update_required: boolean;
    update_available: boolean;
    update_url: string | null;
    release_notes_url: string | null;
    maintenance_mode: boolean;
    desktop_upload_enabled: boolean;
    allowed_modules: string[];
  };
  security: {
    available: boolean;
    warning: string | null;
    recentEvents: Array<Record<string, unknown>>;
    accessContext: { role: string | null; staffRole: string | null; permissions: string[] };
  };
};

type SearchResult = {
  type: "order" | "customer";
  id: string;
  title: string;
  subtitle: string;
  reference: string;
  href: string;
  status: string;
};

const tabs: Array<{ id: OperationsTab; label: string; icon: ReactNode }> = [
  { id: "overview", label: "Health", icon: <Activity /> },
  { id: "queue", label: "Queue & SLA", icon: <Workflow /> },
  { id: "search", label: "Global Search", icon: <Search /> },
  { id: "customers", label: "Customers", icon: <Users /> },
  { id: "communications", label: "Communications", icon: <BellRing /> },
  { id: "security", label: "Security", icon: <ShieldCheck /> },
  { id: "desktop", label: "Desktop Beta", icon: <Laptop2 /> },
];

function formatBerlin(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(date);
}

function tokenLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function AdminOperationsPage() {
  const [activeTab, setActiveTab] = useState<OperationsTab>("overview");
  const [data, setData] = useState<OperationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const response = await authenticatedFetch("/api/admin/operations", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Operations snapshot could not be loaded.");
      setData(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Operations snapshot could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      const timeout = window.setTimeout(() => {
        setSearchResults([]);
        setSearching(false);
      }, 0);
      return () => window.clearTimeout(timeout);
    }
    let active = true;
    const timeout = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await authenticatedFetch(`/api/admin/operations/search?q=${encodeURIComponent(term)}`, { cache: "no-store" });
        const payload = await response.json();
        if (active) setSearchResults(response.ok ? payload.results ?? [] : []);
      } catch {
        if (active) setSearchResults([]);
      } finally {
        if (active) setSearching(false);
      }
    }, 280);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [query]);

  const attentionCount = useMemo(() => data?.health.filter((item) => item.status === "warning").length ?? 0, [data]);

  return (
    <main className="mg-compact-ui min-h-screen overflow-x-hidden bg-[#050505] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <Link href="/admin" className="inline-flex items-center gap-2 text-xs font-black text-zinc-500 hover:text-white">
              <ArrowLeft className="h-4 w-4" />Admin Control Panel
            </Link>
            <div className="mt-2 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-800/50 bg-red-950/30 text-red-400">
                <Gauge className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-red-500">Operations Intelligence</p>
                <h1 className="truncate text-xl font-black sm:text-2xl">Platform Control Center</h1>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {data && (
              <span className="hidden rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-500 md:block">
                Snapshot {formatBerlin(data.generatedAt)}
              </span>
            )}
            <button
              type="button"
              onClick={() => void load(Boolean(data))}
              disabled={refreshing}
              className="inline-flex items-center rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-black hover:bg-white/10 disabled:opacity-50"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
        <label className="admin-mobile-status-filter"><span>Operations section</span><select value={activeTab} onChange={(event) => setActiveTab(event.target.value as OperationsTab)}>{tabs.map((tab) => <option key={tab.id} value={tab.id}>{tab.label}</option>)}</select></label>
        <nav aria-label="Operations sections" className="mb-5 flex gap-2 overflow-x-auto border-b border-white/10 pb-3">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-black transition [&>svg]:h-4 [&>svg]:w-4 ${
                activeTab === tab.id ? "bg-[#b1121b] text-white" : "bg-white/[0.04] text-zinc-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              {tab.icon}{tab.label}
            </button>
          ))}
        </nav>

        {error && (
          <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-red-700/40 bg-red-950/25 p-4 text-sm text-red-200">
            <span>{error}</span>
            <button type="button" onClick={() => void load()} className="font-black underline">Try again</button>
          </div>
        )}
        {loading && !data && <LoadingState />}
        {data && activeTab === "overview" && <OverviewPanel data={data} attentionCount={attentionCount} onNavigate={setActiveTab} />}
        {data && activeTab === "queue" && <QueuePanel data={data} />}
        {data && activeTab === "search" && <SearchPanel query={query} setQuery={setQuery} searching={searching} results={searchResults} />}
        {data && activeTab === "customers" && <CustomerPanel data={data} />}
        {data && activeTab === "communications" && <CommunicationsPanel data={data} />}
        {data && activeTab === "security" && <SecurityPanel data={data} />}
        {data && activeTab === "desktop" && <DesktopPanel data={data} />}
      </div>
    </main>
  );
}

function LoadingState() {
  return (
    <div role="status" className="border-y border-white/10 py-16 text-center">
      <RefreshCw className="mx-auto h-6 w-6 animate-spin text-red-500" />
      <div className="mt-3 font-black">Building protected operations snapshot...</div>
      <p className="mt-1 text-sm text-zinc-500">Existing order, customer and system records remain unchanged.</p>
    </div>
  );
}

function OverviewPanel({ data, attentionCount, onNavigate }: { data: OperationsData; attentionCount: number; onNavigate: (tab: OperationsTab) => void }) {
  return (
    <div className="space-y-5">
      <section className="grid gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Active work" value={data.queue.active} detail={`${data.queue.needsAttention} require attention`} tone="text-red-300" />
        <Metric label="Customer profiles" value={`${data.customers.averageCompletion}%`} detail={`${data.customers.incomplete} incomplete`} tone="text-sky-300" />
        <Metric label="Unread notifications" value={data.communications.notifications.unread} detail="Customer notification queue" tone="text-violet-300" />
        <Metric label="System warnings" value={attentionCount} detail={attentionCount ? "Review the health checks below" : "All available checks are clear"} tone={attentionCount ? "text-amber-300" : "text-emerald-300"} />
      </section>

      <section className="border-y border-white/10 py-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-red-400">Production Health Center</p>
            <h2 className="mt-1 text-2xl font-black">One operational view, no hidden mutations</h2>
            <p className="mt-1 max-w-3xl text-sm text-zinc-500">Read-only checks summarize the existing protected systems. A warning never clears or changes customer data.</p>
          </div>
          <button type="button" onClick={() => onNavigate("security")} className="text-sm font-black text-red-300 hover:text-red-200">Open security context</button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.health.map((item) => (
            <div key={item.key} className="flex min-w-0 items-start gap-3 rounded-lg border border-white/10 bg-white/[0.025] p-4">
              {item.status === "healthy" ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" /> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />}
              <div className="min-w-0">
                <div className="font-black">{item.label}</div>
                <div className="mt-1 break-words text-xs leading-5 text-zinc-500">{item.detail || "No status detail available."}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-4">
          <div><p className="text-xs font-black uppercase tracking-[0.18em] text-red-400">Live order desk</p><h2 className="mt-1 text-xl font-black">Latest five requests</h2></div>
          <Link href="/admin/requests" className="text-sm font-black text-red-300 hover:text-red-200">Open work orders</Link>
        </div>
        <OrderTable orders={data.latestOrders} />
      </section>
    </div>
  );
}

function QueuePanel({ data }: { data: OperationsData }) {
  const metrics = [
    ["Active", data.queue.active, "All non-terminal requests"],
    ["Needs attention", data.queue.needsAttention, "Blocked, expert review or quality review"],
    ["Waiting customer", data.queue.waitingForCustomer, "Customer input required"],
    ["Urgent / high", data.queue.urgentOrHigh, "Priority set by staff"],
    ["Unassigned", data.queue.unassigned, "No admin or tuner assigned"],
    ["ETA missing", data.queue.etaMissing, "Active queue estimate not set"],
    ["Estimate elapsed", data.queue.estimateElapsed, "Explicit estimate window has passed"],
    ["Completed", data.queue.completed, "Delivered or completed"],
  ] as const;
  return (
    <div className="space-y-5">
      <section className="grid gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value, detail]) => <Metric key={label} label={label} value={value} detail={detail} tone={label === "Needs attention" || label === "Estimate elapsed" ? "text-amber-300" : "text-white"} />)}
      </section>
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0"><h2 className="mb-3 text-xl font-black">Current workload</h2><OrderTable orders={data.latestOrders} /></div>
        <aside className="min-w-0 border-l border-white/10 pl-5 max-xl:border-l-0 max-xl:border-t max-xl:pl-0 max-xl:pt-5">
          <h2 className="text-lg font-black">State distribution</h2>
          <div className="mt-3 divide-y divide-white/10 border-y border-white/10">
            {Object.entries(data.queue.stateCounts).sort((a, b) => b[1] - a[1]).map(([state, count]) => (
              <div key={state} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="text-zinc-400">{tokenLabel(state)}</span><span className="font-black">{count}</span></div>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-zinc-500">&quot;Estimate elapsed&quot; is an internal review signal based only on an explicit admin turnaround value. It is not a customer promise or guaranteed SLA.</p>
        </aside>
      </section>
    </div>
  );
}

function SearchPanel({ query, setQuery, searching, results }: { query: string; setQuery: (value: string) => void; searching: boolean; results: SearchResult[] }) {
  return (
    <section className="mx-auto max-w-5xl">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-red-400">Admin Global Search</p>
      <h2 className="mt-1 text-2xl font-black">Find a request or customer without changing workspaces</h2>
      <p className="mt-2 text-sm text-zinc-500">Search by order ID, customer ID, email, vehicle, ECU, service or uploaded filename. Results contain only allowlisted admin summary fields.</p>
      <label className="mt-5 flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 focus-within:border-red-700/70">
        <Search className="h-5 w-5 text-zinc-500" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} autoFocus placeholder="Search order, customer, vehicle, ECU or service..." className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-zinc-600" />
        {searching && <RefreshCw className="h-4 w-4 animate-spin text-red-400" />}
      </label>
      <div className="mt-5 divide-y divide-white/10 border-y border-white/10">
        {query.trim().length < 2 && <div className="py-10 text-center text-sm text-zinc-500">Enter at least two characters.</div>}
        {query.trim().length >= 2 && !searching && results.length === 0 && <div className="py-10 text-center text-sm text-zinc-500">No matching request or customer was found.</div>}
        {results.map((result) => (
          <Link key={`${result.type}:${result.id}`} href={result.href} className="flex min-w-0 items-center justify-between gap-4 py-4 transition hover:bg-white/[0.03] sm:px-3">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-black">{result.title}</span><span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-black uppercase text-zinc-500">{result.type}</span></div><div className="mt-1 truncate text-sm text-zinc-500">{result.subtitle}</div></div>
            <div className="shrink-0 text-right"><div className="text-sm font-black text-red-300">{result.reference}</div><div className="mt-1 text-[11px] text-zinc-600">{tokenLabel(result.status)}</div></div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function CustomerPanel({ data }: { data: OperationsData }) {
  if (!data.customers.available) return <Unavailable title="Customer readiness is unavailable" detail={data.customers.warning} />;
  return (
    <div className="space-y-5">
      <section className="grid gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Customers" value={data.customers.total} detail="Protected customer profiles" tone="text-white" />
        <Metric label="Average profile" value={`${data.customers.averageCompletion}%`} detail="Operational contact and billing readiness" tone="text-sky-300" />
        <Metric label="Complete" value={data.customers.complete} detail="All readiness fields available" tone="text-emerald-300" />
        <Metric label="Needs completion" value={data.customers.incomplete} detail={`${data.customers.blocked} blocked accounts`} tone="text-amber-300" />
      </section>
      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-red-400">Customer ID & Profile</p><h2 className="mt-1 text-xl font-black">Profiles needing operational details</h2></div><Link href="/admin" className="text-sm font-black text-red-300">Open customer management</Link></div>
        <div className="divide-y divide-white/10 border-y border-white/10">
          {data.customers.incompleteProfiles.length === 0 && <div className="py-10 text-center text-sm text-zinc-500">All available customer profiles are complete.</div>}
          {data.customers.incompleteProfiles.map((item) => (
            <div key={item.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_160px_minmax(0,1fr)] sm:items-center">
              <div className="min-w-0"><div className="font-black">{item.name}</div><div className="mt-1 truncate text-xs text-zinc-500">{item.customerId || "Customer ID pending"} - {item.email || "No email"}</div></div>
              <div><div className="flex items-center justify-between text-xs"><span className="text-zinc-500">Profile</span><span className="font-black">{item.readiness.percent}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-red-500" style={{ width: `${item.readiness.percent}%` }} /></div></div>
              <div className="text-xs leading-5 text-zinc-500">Missing: {item.readiness.missing.join(", ")}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function CommunicationsPanel({ data }: { data: OperationsData }) {
  const email = data.communications.email;
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="border-y border-white/10 py-5">
        <div className="flex items-center gap-3"><Mail className="h-5 w-5 text-red-400" /><h2 className="text-xl font-black">Transactional Email Readiness</h2></div>
        <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10">
          <Metric label="Sent" value={email.summary.sent} detail="Latest event window" tone="text-emerald-300" />
          <Metric label="Dry-run / skipped" value={email.summary.skipped} detail="Safely not delivered" tone="text-sky-300" />
          <Metric label="Pending" value={email.summary.pending} detail="Awaiting processing" tone="text-amber-300" />
          <Metric label="Failed" value={email.summary.failed} detail="Requires review" tone="text-red-300" />
        </div>
        <div className="mt-4 divide-y divide-white/10 border-y border-white/10 text-sm">
          <InfoRow label="Provider" value={email.provider} />
          <InfoRow label="Configured" value={email.configured ? "Yes" : "No"} />
          <InfoRow label="Dry-run" value={email.dryRun ? "Enabled" : "Disabled"} />
          <InfoRow label="Real sending" value={email.sendingEnabled ? "Enabled" : "Safely disabled"} />
        </div>
        <Link href="/admin/email" className="mt-4 inline-flex items-center text-sm font-black text-red-300">Open Email Control Center <ExternalLink className="ml-2 h-4 w-4" /></Link>
      </section>
      <section className="border-y border-white/10 py-5">
        <div className="flex items-center gap-3"><BellRing className="h-5 w-5 text-violet-300" /><h2 className="text-xl font-black">Customer Notification Center</h2></div>
        <div className="mt-5 text-5xl font-black">{data.communications.notifications.unread}</div>
        <div className="mt-1 text-sm text-zinc-500">Unread customer notifications across protected accounts</div>
        <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-zinc-400">Order status, completed files, customer-visible messages and additional upload access use the existing customer-owned notification records. Internal notes never enter this channel.</div>
        {!data.communications.notifications.available && <p className="mt-3 text-sm text-amber-300">{data.communications.notifications.warning}</p>}
      </section>
    </div>
  );
}

function SecurityPanel({ data }: { data: OperationsData }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="border-y border-white/10 py-5">
        <div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-emerald-300" /><h2 className="text-xl font-black">Access context</h2></div>
        <div className="mt-4 divide-y divide-white/10 border-y border-white/10"><InfoRow label="Role" value={data.security.accessContext.role || "-"} /><InfoRow label="Staff role" value={data.security.accessContext.staffRole || "owner / legacy"} /><InfoRow label="Permissions" value={String(data.security.accessContext.permissions.length)} /></div>
        <p className="mt-4 text-xs leading-5 text-zinc-500">This page is protected by the same server-side `orders.view` permission used by the work-order control center. Owner-only audit entries are omitted for staff without `staff.manage`.</p>
      </aside>
      <section className="min-w-0 border-y border-white/10 py-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-red-400">Audit & Security Center</p>
        <h2 className="mt-1 text-xl font-black">Recent staff access events</h2>
        {!data.security.available ? <Unavailable title="Owner audit view is unavailable" detail={data.security.warning} /> : (
          <div className="mt-4 divide-y divide-white/10 border-y border-white/10">
            {data.security.recentEvents.length === 0 && <div className="py-10 text-center text-sm text-zinc-500">No recent staff access events.</div>}
            {data.security.recentEvents.map((event) => (
              <div key={String(event.id)} className="grid gap-2 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_220px_180px] sm:items-center">
                <div className="font-black">{tokenLabel(String(event.action || "staff event"))}</div>
                <div className="truncate text-xs text-zinc-500">Target {String(event.target_user_id || "system")}</div>
                <div className="text-xs text-zinc-600 sm:text-right">{formatBerlin(String(event.created_at || ""))}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function DesktopPanel({ data }: { data: OperationsData }) {
  const desktop = data.desktop;
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="border-y border-white/10 py-5">
        <div className="flex items-center gap-3"><Laptop2 className="h-5 w-5 text-sky-300" /><div><p className="text-xs font-black uppercase tracking-[0.18em] text-red-400">Internal beta program</p><h2 className="mt-1 text-xl font-black">Desktop Uploader Release Readiness</h2></div></div>
        <div className="mt-5 grid gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-2">
          <Metric label="Minimum version" value={desktop.minimum_supported_version} detail="Older builds are blocked" tone="text-white" />
          <Metric label="Latest version" value={desktop.latest_version} detail={desktop.update_available ? "Update is available" : "Current channel version"} tone="text-sky-300" />
          <Metric label="Upload API" value={desktop.desktop_upload_enabled ? "Enabled" : "Disabled"} detail="Server-side gate" tone={desktop.desktop_upload_enabled ? "text-emerald-300" : "text-amber-300"} />
          <Metric label="Maintenance" value={desktop.maintenance_mode ? "Active" : "Off"} detail="Request creation gate" tone={desktop.maintenance_mode ? "text-amber-300" : "text-emerald-300"} />
        </div>
        <div className="mt-5"><div className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Allowed modules</div><div className="mt-2 flex flex-wrap gap-2">{desktop.allowed_modules.map((module) => <span key={module} className="rounded-full border border-white/10 px-3 py-1 text-xs font-black text-zinc-300">{tokenLabel(module)}</span>)}</div></div>
      </section>
      <aside className="border-y border-white/10 py-5">
        <h2 className="text-lg font-black">Release boundary</h2>
        <ul className="mt-4 space-y-3 text-sm leading-6 text-zinc-400">
          <li>Installer remains outside the public web deployment.</li>
          <li>Download URL must be MG-controlled HTTPS.</li>
          <li>Code signing and clean Windows Defender testing are still public-release gates.</li>
          <li>Desktop credit and request authorization remain server-side.</li>
        </ul>
        <Link href="/download/windows" className="mt-5 inline-flex items-center text-sm font-black text-red-300">View public beta gate <ExternalLink className="ml-2 h-4 w-4" /></Link>
        <Link href="/admin/desktop-app" className="mt-3 flex items-center text-sm font-black text-sky-300">Open release controls <ExternalLink className="ml-2 h-4 w-4" /></Link>
      </aside>
    </div>
  );
}

function OrderTable({ orders }: { orders: OperationsData["latestOrders"] }) {
  return (
    <div className="max-w-full overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="bg-white/[0.03] text-[10px] uppercase tracking-[0.16em] text-zinc-500"><tr><th className="px-4 py-3">Request</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Vehicle</th><th className="px-4 py-3">Service</th><th className="px-4 py-3">Queue</th><th className="px-4 py-3">Created</th></tr></thead>
        <tbody>
          {orders.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-zinc-500">No requests are available.</td></tr>}
          {orders.map((order) => (
            <tr key={order.id} className="border-t border-white/10 hover:bg-white/[0.025]">
              <td className="px-4 py-4"><Link href={`/admin/requests/${order.id}`} className="font-black text-red-300 hover:text-red-200">{order.reference}</Link><div className="mt-1 text-[10px] uppercase text-zinc-600">{order.priority}</div></td>
              <td className="max-w-[190px] px-4 py-4"><div className="truncate font-bold">{order.customer}</div><div className="mt-1 text-xs text-zinc-600">{order.customerId || "No customer ID"}</div></td>
              <td className="max-w-[250px] px-4 py-4"><div className="truncate text-zinc-300">{order.vehicle}</div></td>
              <td className="max-w-[260px] px-4 py-4"><div className="truncate text-zinc-400">{order.service}</div></td>
              <td className="px-4 py-4"><span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-black uppercase ${order.needsAttention ? "border-amber-700/40 bg-amber-950/25 text-amber-300" : "border-white/10 text-zinc-300"}`}>{order.statusLabel}</span><div className="mt-1 max-w-[180px] truncate text-[10px] text-zinc-600">{order.etaLabel}</div></td>
              <td className="whitespace-nowrap px-4 py-4 text-xs text-zinc-500">{formatBerlin(order.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Metric({ label, value, detail, tone }: { label: string; value: string | number; detail: string; tone: string }) {
  return <div className="min-w-0 bg-[#0b0b0c] p-4"><div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">{label}</div><div className={`mt-2 break-words text-2xl font-black ${tone}`}>{value}</div><div className="mt-1 break-words text-xs leading-5 text-zinc-600">{detail}</div></div>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4 py-3"><span className="text-zinc-500">{label}</span><span className="min-w-0 break-words text-right font-black">{value}</span></div>;
}

function Unavailable({ title, detail }: { title: string; detail: string | null }) {
  return <div className="rounded-lg border border-amber-700/30 bg-amber-950/15 p-5"><div className="flex items-center gap-2 font-black text-amber-200"><AlertTriangle className="h-4 w-4" />{title}</div><p className="mt-2 text-sm text-zinc-500">{detail || "This optional data source is not available."}</p></div>;
}
