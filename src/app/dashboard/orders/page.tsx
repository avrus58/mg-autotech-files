"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  CreditCard,
  Eye,
  FileText,
  Gauge,
  History,
  Loader2,
  Search,
  Settings,
  Upload,
} from "lucide-react";
import { signOutIfEmailUnverified } from "@/lib/authGuards";
import { supabase } from "@/lib/supabaseClient";

type Order = {
  id: string;
  vehicle_brand: string | null;
  vehicle_model: string | null;
  vehicle_generation: string | null;
  vehicle_engine: string | null;
  service_type: string | null;
  credits_required: number | string | null;
  status: string | null;
  modified_file_path: string | null;
  created_at: string;
};

type View = "active" | "needs_response" | "completed" | "cancelled" | "all";
const pageSize = 15;

const views: Array<{ value: View; label: string; description: string }> = [
  { value: "active", label: "Active Orders", description: "Requests still being worked on" },
  { value: "needs_response", label: "Needs Response", description: "Requests waiting for your information" },
  { value: "completed", label: "Completed", description: "Delivered file services" },
  { value: "cancelled", label: "Cancelled", description: "Cancelled requests" },
  { value: "all", label: "All Orders", description: "Complete order archive" },
];

function statusLabel(status: string | null) {
  return (status || "new_request").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusClass(status: string | null) {
  if (status === "completed") return "border-emerald-700/40 bg-emerald-950/30 text-emerald-300";
  if (status === "in_progress") return "border-blue-700/40 bg-blue-950/30 text-blue-300";
  if (status === "file_check") return "border-amber-700/40 bg-amber-950/30 text-amber-300";
  if (status === "customer_info_needed") return "border-orange-700/40 bg-orange-950/30 text-orange-300";
  if (status === "revision") return "border-purple-700/40 bg-purple-950/30 text-purple-300";
  if (status === "cancelled") return "border-zinc-700/40 bg-zinc-900/50 text-zinc-400";
  return "border-red-800/40 bg-red-950/25 text-red-300";
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function CustomerOrdersPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [view, setView] = useState<View>("active");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("view");
    if (initial && views.some((item) => item.value === initial)) {
      void Promise.resolve().then(() => setView(initial as View));
    }
  }, []);

  const selectView = useCallback((selectedView: View) => {
    setView(selectedView);
    setPage(1);

    const params = new URLSearchParams(window.location.search);
    if (selectedView === "active") params.delete("view");
    else params.set("view", selectedView);

    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      query ? `${window.location.pathname}?${query}` : window.location.pathname
    );
  }, []);

  const buildQuery = useCallback(async (uid: string, selectedView: View, term: string, rangeEnd: number) => {
    let query = supabase
      .from("orders")
      .select("id, vehicle_brand, vehicle_model, vehicle_generation, vehicle_engine, service_type, credits_required, status, modified_file_path, created_at", { count: "exact" })
      .eq("customer_id", uid)
      .order("created_at", { ascending: false })
      .range(0, rangeEnd);

    if (selectedView === "active") {
      query = query.in("status", [
        "new_request",
        "file_check",
        "in_progress",
        "customer_info_needed",
        "revision",
      ]);
    }
    if (selectedView === "needs_response") query = query.eq("status", "customer_info_needed");
    if (selectedView === "completed") query = query.eq("status", "completed");
    if (selectedView === "cancelled") query = query.eq("status", "cancelled");

    const cleanTerm = term.trim().replace(/[,%()]/g, " ");
    if (cleanTerm) {
      query = query.or(
        `vehicle_brand.ilike.%${cleanTerm}%,vehicle_model.ilike.%${cleanTerm}%,vehicle_engine.ilike.%${cleanTerm}%,service_type.ilike.%${cleanTerm}%`
      );
    }
    return query;
  }, []);

  const loadOrders = useCallback(async (options?: { targetPage?: number; uid?: string }) => {
    const uid = options?.uid || userId;
    if (!uid) return;
    const nextPage = options?.targetPage ?? 1;
    if (nextPage > 1) setLoadingMore(true);
    else setLoading(true);
    setMessage("");
    const { data, error, count } = await buildQuery(uid, view, search, nextPage * pageSize - 1);
    if (error) setMessage(error.message);
    else {
      setOrders((data ?? []) as Order[]);
      setTotal(count ?? 0);
      setPage(nextPage);
    }
    setLoading(false);
    setLoadingMore(false);
  }, [buildQuery, search, userId, view]);

  useEffect(() => {
    async function initialize() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/login");
        return;
      }
      if (await signOutIfEmailUnverified(data.user)) {
        router.push("/login?verify_email=1");
        return;
      }
      setUserId(data.user.id);
    }
    initialize();
  }, [router]);

  useEffect(() => {
    if (!userId) return;
    const timeout = window.setTimeout(() => loadOrders({ uid: userId }), 250);
    return () => window.clearTimeout(timeout);
  }, [loadOrders, userId]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel(`customer-order-archive-${userId}`).on(
      "postgres_changes",
      { event: "*", schema: "public", table: "orders", filter: `customer_id=eq.${userId}` },
      () => loadOrders({ uid: userId })
    ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadOrders, userId]);

  const currentView = useMemo(() => views.find((item) => item.value === view) ?? views[0], [view]);

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-white/10 bg-black/70 lg:block">
          <div className="sticky top-0 flex h-screen flex-col px-5 py-6">
            <Link href="/dashboard" className="mb-8 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-red-800/50 bg-[#111]"><Gauge className="h-7 w-7 text-red-600" /></div>
              <div><div className="text-xl font-black">MG <span className="text-red-600">AUTOTECH</span></div><div className="text-xs text-zinc-400">Customer Panel</div></div>
            </Link>
            <nav className="space-y-2 text-sm">
              <PortalLink href="/dashboard" icon={<ArrowLeft />} label="Dashboard" />
              <PortalLink href="/new-request" icon={<Upload />} label="New File Request" />
              <PortalLink href="/dashboard/orders" icon={<FileText />} label="Active Orders" active={view === "active"} />
              <PortalLink href="/dashboard/orders?view=needs_response" icon={<Clock3 />} label="Needs Response" active={view === "needs_response"} />
              <PortalLink href="/dashboard/orders?view=completed" icon={<History />} label="Order History" active={["completed", "cancelled", "all"].includes(view)} />
              <PortalLink href="/dashboard/file-expert" icon={<BrainCircuit />} label="AI File Expert" />
              <PortalLink href="/dashboard/credits" icon={<CreditCard />} label="Buy Credits" />
              <PortalLink href="/dashboard/settings" icon={<Settings />} label="Settings" />
            </nav>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="sticky top-0 z-40 border-b border-white/10 bg-black/80 px-4 py-4 backdrop-blur-xl lg:px-8">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
              <div><div className="text-xs font-black uppercase tracking-[0.2em] text-red-500">File Service Archive</div><h1 className="mt-1 text-2xl font-black">{currentView.label}</h1></div>
              <Link href="/new-request" className="rounded-xl bg-[#b1121b] px-4 py-3 text-sm font-black"><Upload className="mr-2 inline h-4 w-4" />New Request</Link>
            </div>
          </header>

          <div className="mx-auto max-w-7xl px-4 py-7 lg:px-8">
            <div className="mb-5 flex gap-2 overflow-x-auto pb-2 lg:hidden">
              {views.map((item) => <button key={item.value} onClick={() => selectView(item.value)} className={`shrink-0 rounded-xl border px-4 py-3 text-sm font-black ${view === item.value ? "border-red-700 bg-red-950/35" : "border-white/10 bg-white/[0.04] text-zinc-400"}`}>{item.label}</button>)}
            </div>

            <div className="mb-6 grid gap-3 md:grid-cols-5">
              {views.map((item) => (
                <button key={item.value} onClick={() => selectView(item.value)} className={`hidden rounded-xl border p-4 text-left transition md:block ${view === item.value ? "border-red-700 bg-red-950/30" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}>
                  <div className="font-black">{item.label}</div><div className="mt-1 text-xs text-zinc-500">{item.description}</div>
                </button>
              ))}
            </div>

            <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
              <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div><h2 className="text-2xl font-black">{currentView.label}</h2><p className="mt-1 text-sm text-zinc-500">{total} requests in this view. Only {pageSize} are loaded at a time.</p></div>
                <div className="relative w-full sm:w-96"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search vehicle, engine or service..." className="h-12 w-full rounded-xl border border-white/10 bg-black/35 pl-11 pr-4 text-sm font-bold outline-none focus:border-red-700" /></div>
              </div>

              {message && <div className="mb-4 rounded-xl border border-red-800/40 bg-red-950/25 p-4 text-sm text-red-200">{message}</div>}
              {loading ? (
                <div className="flex min-h-64 items-center justify-center text-zinc-500"><Loader2 className="mr-3 h-5 w-5 animate-spin" />Loading orders...</div>
              ) : orders.length === 0 ? (
                <div className="min-h-64 rounded-xl border border-dashed border-white/15 p-10 text-center text-zinc-500"><Clock3 className="mx-auto mb-4 h-9 w-9" />No orders found in this view.</div>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => (
                    <article key={order.id} className="grid min-w-0 gap-4 rounded-xl border border-white/10 bg-black/25 p-4 transition hover:border-red-800/50 md:grid-cols-[1.4fr_.7fr_.5fr_auto] md:items-center">
                      <div className="min-w-0"><div className="break-words text-lg font-black">{order.vehicle_brand || "Vehicle"} {order.vehicle_model || ""}</div><div className="mt-1 break-words text-sm text-zinc-500">{order.vehicle_generation || "Generation not set"} · {order.vehicle_engine || "Engine not set"}</div><div className="mt-2 line-clamp-2 text-sm font-bold text-red-300">{order.service_type || "Service not set"}</div></div>
                      <div><span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusClass(order.status)}`}>{statusLabel(order.status)}</span>{order.status === "customer_info_needed" && <div className="mt-2 break-words text-xs font-black text-orange-300">Needs your response</div>}{order.status === "revision" && <div className="mt-2 break-words text-xs font-black text-purple-300">Revision review in progress</div>}{order.modified_file_path && <div className="mt-2 text-xs font-black text-emerald-400"><CheckCircle2 className="mr-1 inline h-3 w-3" />File delivered</div>}</div>
                      <div><div className="font-black">{Number(order.credits_required ?? 0)} credits</div><div className="mt-1 text-xs text-zinc-500">{formatDate(order.created_at)}</div></div>
                      <Link href={`/dashboard/orders/${order.id}`} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-sm font-black hover:bg-white/10"><Eye className="mr-2 inline h-4 w-4" />Details</Link>
                    </article>
                  ))}
                </div>
              )}

              {orders.length < total && (
                <button onClick={() => loadOrders({ targetPage: page + 1 })} disabled={loadingMore} className="mt-5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-5 py-4 text-sm font-black hover:bg-white/10 disabled:opacity-50">
                  {loadingMore && <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />}Load next {Math.min(pageSize, total - orders.length)} orders
                </button>
              )}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function PortalLink({ href, icon, label, active = false }: { href: string; icon: React.ReactNode; label: string; active?: boolean }) {
  return <Link href={href} className={`flex items-center gap-3 rounded-xl px-4 py-3 font-bold transition ${active ? "bg-red-950/35 text-white" : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"}`}><span className="[&>svg]:h-5 [&>svg]:w-5">{icon}</span>{label}</Link>;
}
