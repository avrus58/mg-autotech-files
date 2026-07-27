"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { getStableUser, signOutIfEmailUnverified } from "@/lib/authGuards";
import { checkBrowserAuthUserWithRetry } from "@/lib/authBoundaryState";
import {
  retryCustomerOrdersQueryAfterAuthCheck,
  type CustomerOrdersQueryResult,
} from "@/lib/customerOrdersAuthRecovery";
import { shouldRevalidateDashboardSession } from "@/lib/dashboardSync";
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

const CUSTOMER_ORDERS_LOAD_ERROR_MESSAGE = "Order archive could not be synced. Please try again.";
const CUSTOMER_ORDERS_SYNC_ERROR_MESSAGE = "Order archive sync needs retry. Your last loaded order list is still shown.";

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
  const [loadError, setLoadError] = useState("");
  const [ordersReady, setOrdersReady] = useState(false);
  const hasLoadedOrdersRef = useRef(false);
  const authRevisionRef = useRef(0);
  const ordersLoadRevisionRef = useRef(0);
  const ordersUserIdRef = useRef<string | null>(null);

  const clearOrdersForLogout = useCallback(() => {
    authRevisionRef.current += 1;
    ordersLoadRevisionRef.current += 1;
    ordersUserIdRef.current = null;
    setUserId("");
    setOrders([]);
    setTotal(0);
    setPage(1);
    setLoadError("");
    setOrdersReady(false);
    setLoadingMore(false);
    setLoading(true);
    hasLoadedOrdersRef.current = false;
  }, []);

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

  const initializeAuth = useCallback(async () => {
    const expectedAuthRevision = authRevisionRef.current;
    setLoading(true);
    setLoadError("");

    const authCheck = await checkBrowserAuthUserWithRetry(getStableUser);
    if (authRevisionRef.current !== expectedAuthRevision) return;
    if (authCheck.state === "unauthenticated") {
      clearOrdersForLogout();
      router.replace("/login");
      return;
    }
    if (authCheck.state === "unavailable") {
      setLoadError(CUSTOMER_ORDERS_LOAD_ERROR_MESSAGE);
      setLoading(false);
      return;
    }
    const user = authCheck.user;

    try {
      if (await signOutIfEmailUnverified(user)) {
        router.replace("/login?verify_email=1");
        return;
      }
    } catch {
      setLoadError(CUSTOMER_ORDERS_LOAD_ERROR_MESSAGE);
      setLoading(false);
      return;
    }

    if (authRevisionRef.current !== expectedAuthRevision) return;
    ordersUserIdRef.current = user.id;
    setUserId(user.id);
  }, [clearOrdersForLogout, router]);

  const loadOrders = useCallback(async (options?: { targetPage?: number; uid?: string }) => {
    const expectedLoadRevision = ++ordersLoadRevisionRef.current;
    const expectedAuthRevision = authRevisionRef.current;
    const uid = options?.uid || userId;
    if (!uid) {
      await initializeAuth();
      return;
    }
    const nextPage = options?.targetPage ?? 1;
    if (nextPage > 1) setLoadingMore(true);
    else setLoading(true);
    setLoadError("");
    let queryResult: CustomerOrdersQueryResult<unknown>;
    try {
      const result = await buildQuery(uid, view, search, nextPage * pageSize - 1);
      queryResult = {
        data: result.data,
        error: result.error,
        count: result.count,
      };
    } catch (error) {
      queryResult = { data: null, error, count: null };
    }
    if (
      ordersLoadRevisionRef.current !== expectedLoadRevision ||
      authRevisionRef.current !== expectedAuthRevision
    ) {
      return;
    }

    if (
      queryResult.error &&
      shouldRevalidateDashboardSession(queryResult.error)
    ) {
      const recovery = await retryCustomerOrdersQueryAfterAuthCheck(
        () => checkBrowserAuthUserWithRetry(getStableUser),
        async () => {
          const result = await buildQuery(
            uid,
            view,
            search,
            nextPage * pageSize - 1
          );
          return {
            data: result.data,
            error: result.error,
            count: result.count,
          };
        },
        () =>
          ordersLoadRevisionRef.current === expectedLoadRevision &&
          authRevisionRef.current === expectedAuthRevision
      );
      if (
        ordersLoadRevisionRef.current !== expectedLoadRevision ||
        authRevisionRef.current !== expectedAuthRevision
      ) {
        return;
      }
      if (recovery.authCheck.state === "unauthenticated") {
        clearOrdersForLogout();
        router.replace("/login");
        return;
      }
      if (recovery.queryResult) queryResult = recovery.queryResult;
    }

    const { data, error: queryError, count } = queryResult;
    if (queryError) {
      setLoadError(hasLoadedOrdersRef.current ? CUSTOMER_ORDERS_SYNC_ERROR_MESSAGE : CUSTOMER_ORDERS_LOAD_ERROR_MESSAGE);
    } else {
      setOrders((data ?? []) as Order[]);
      setTotal(count ?? 0);
      setPage(nextPage);
      setOrdersReady(true);
      hasLoadedOrdersRef.current = true;
    }
    setLoading(false);
    setLoadingMore(false);
  }, [buildQuery, clearOrdersForLogout, initializeAuth, router, search, userId, view]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void initializeAuth();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [initializeAuth]);

  useEffect(() => {
    if (!userId) return;
    const timeout = window.setTimeout(() => loadOrders({ uid: userId }), 250);
    return () => {
      window.clearTimeout(timeout);
      ordersLoadRevisionRef.current += 1;
    };
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

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        const currentUserId = ordersUserIdRef.current;
        if (currentUserId && currentUserId !== session.user.id) {
          clearOrdersForLogout();
          void initializeAuth();
        }
        return;
      }

      if (event === "SIGNED_OUT") {
        clearOrdersForLogout();
        router.replace("/login");
      }
    });

    return () => {
      authRevisionRef.current += 1;
      ordersLoadRevisionRef.current += 1;
      listener.subscription.unsubscribe();
    };
  }, [clearOrdersForLogout, initializeAuth, router]);

  const currentView = useMemo(() => views.find((item) => item.value === view) ?? views[0], [view]);
  const loadedOrdersSummary = useMemo(() => {
    return {
      loaded: orders.length,
      needsResponse: orders.filter((order) => order.status === "customer_info_needed").length,
      delivered: orders.filter((order) => Boolean(order.modified_file_path)).length,
      creditsShown: orders.reduce(
        (sum, order) => sum + Number(order.credits_required ?? 0),
        0
      ),
    };
  }, [orders]);
  const showInitialLoadError = Boolean(loadError && !ordersReady);

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
                <div><h2 className="text-2xl font-black">{currentView.label}</h2><p className="mt-1 text-sm text-zinc-500">{ordersReady ? `${total} requests in this view. Only ${pageSize} are loaded at a time.` : "Order archive sync is pending."}</p></div>
                <div className="relative w-full sm:w-96"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search vehicle, engine or service..." className="h-12 w-full rounded-xl border border-white/10 bg-black/35 pl-11 pr-4 text-sm font-bold outline-none focus:border-red-700" /></div>
              </div>

              {ordersReady && (
                <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
                      <FileText className="h-4 w-4" />
                      Loaded page
                    </div>
                    <div className="mt-2 text-2xl font-black">
                      {loadedOrdersSummary.loaded} / {total}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">Shown from this filtered view</div>
                  </div>

                  <div className="rounded-2xl border border-orange-700/35 bg-orange-950/15 p-4">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-orange-200">
                      <Clock3 className="h-4 w-4" />
                      Action needed
                    </div>
                    <div className="mt-2 text-2xl font-black text-orange-100">
                      {loadedOrdersSummary.needsResponse}
                    </div>
                    <div className="mt-1 text-xs text-orange-100/70">Visible orders waiting for your info</div>
                  </div>

                  <div className="rounded-2xl border border-emerald-700/35 bg-emerald-950/15 p-4">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-emerald-200">
                      <CheckCircle2 className="h-4 w-4" />
                      Delivered files
                    </div>
                    <div className="mt-2 text-2xl font-black text-emerald-100">
                      {loadedOrdersSummary.delivered}
                    </div>
                    <div className="mt-1 text-xs text-emerald-100/70">Completed files visible on this page</div>
                  </div>

                  <div className="rounded-2xl border border-red-800/35 bg-red-950/15 p-4">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-red-200">
                      <CreditCard className="h-4 w-4" />
                      Credits shown
                    </div>
                    <div className="mt-2 text-2xl font-black text-red-100">
                      {loadedOrdersSummary.creditsShown}
                    </div>
                    <div className="mt-1 text-xs text-red-100/70">Credit value across loaded orders</div>
                  </div>
                </div>
              )}

              {loadError && ordersReady ? (
                <div role="alert" className="mb-4 rounded-xl border border-amber-800/40 bg-amber-950/20 p-4 text-sm text-amber-100">
                  <div className="font-black">Order archive sync needs retry</div>
                  <div className="mt-1 text-amber-100/80">Your last loaded order list is still shown. Retry sync before treating the archive as fully up to date.</div>
                  <button type="button" onClick={() => void loadOrders()} className="mt-3 rounded-lg border border-amber-600/40 bg-black/20 px-4 py-2 text-xs font-black text-amber-100 hover:bg-amber-950/35">
                    Retry sync
                  </button>
                </div>
              ) : null}
              {showInitialLoadError ? (
                <OrdersLoadErrorState onRetry={() => void loadOrders()} />
              ) : loading && !ordersReady ? (
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

function OrdersLoadErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="min-h-64 rounded-xl border border-red-800/40 bg-red-950/20 p-8 text-center">
      <Clock3 className="mx-auto mb-4 h-10 w-10 text-red-300" />
      <h3 className="text-xl font-black text-white">Order archive sync failed</h3>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-red-100/80">
        Your orders are not shown until the archive loads successfully. This is a connection or sync issue, not an empty order history.
      </p>
      <button type="button" onClick={onRetry} className="mt-6 rounded-xl bg-[#b1121b] px-5 py-3 text-sm font-black text-white hover:bg-[#c91824]">
        Try again
      </button>
    </div>
  );
}

function PortalLink({ href, icon, label, active = false }: { href: string; icon: React.ReactNode; label: string; active?: boolean }) {
  return <Link href={href} className={`flex items-center gap-3 rounded-xl px-4 py-3 font-bold transition ${active ? "bg-red-950/35 text-white" : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"}`}><span className="[&>svg]:h-5 [&>svg]:w-5">{icon}</span>{label}</Link>;
}
