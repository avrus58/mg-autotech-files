"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Clock3,
  CopyPlus,
  CreditCard,
  Eye,
  FileText,
  Loader2,
  Search,
  Upload,
} from "lucide-react";
import { getStableSession, notifySessionRequired, signOutIfEmailUnverified } from "@/lib/authGuards";
import { supabase } from "@/lib/supabaseClient";
import { CustomerPortalPageHeader } from "@/components/dashboard/CustomerPortalPageHeader";
import { customerWorkflowExactT, customerWorkflowT } from "@/lib/i18n/customer-workflow-orders-translations";
import { customerOrderViewStatuses, isCustomerOrderView, type CustomerOrderView } from "@/lib/customerOrderViews";
import { localizeCustomerOrderStatus } from "@/lib/i18n/customer-runtime-translations";
import { intlLocaleByCode, type LocaleCode } from "@/lib/i18nConfig";
import { useActiveLocale } from "@/lib/useActiveLocale";

type Order = {
  id: string;
  vehicle_brand: string | null;
  vehicle_model: string | null;
  vehicle_generation: string | null;
  vehicle_engine: string | null;
  service_type: string | null;
  credits_required: number | string | null;
  status: string | null;
  created_at: string;
};

type View = CustomerOrderView;
const pageSize = 15;

function createViews(locale: LocaleCode): Array<{ value: View; label: string; description: string }> { return [
  { value: "active", label: customerWorkflowExactT(locale, "Active Orders"), description: "Requests still being worked on" },
  { value: "needs_response", label: "Needs Response", description: "Requests waiting for your information" },
  { value: "completed", label: "Completed", description: "Delivered file services" },
  { value: "cancelled", label: "Cancelled", description: "Cancelled requests" },
  { value: "all", label: "All Orders", description: "Complete order archive" },
]; }

const CUSTOMER_ORDERS_LOAD_ERROR_MESSAGE = "Order archive could not be synced. Please try again.";

function statusClass(status: string | null) {
  if (status === "completed") return "border-emerald-700/40 bg-emerald-950/30 text-emerald-300";
  if (status === "in_progress") return "border-blue-700/40 bg-blue-950/30 text-blue-300";
  if (status === "file_check") return "border-amber-700/40 bg-amber-950/30 text-amber-300";
  if (status === "customer_info_needed") return "border-orange-700/40 bg-orange-950/30 text-orange-300";
  if (status === "revision") return "border-purple-700/40 bg-purple-950/30 text-purple-300";
  if (status === "cancelled") return "border-zinc-700/40 bg-zinc-900/50 text-zinc-400";
  return "border-red-800/40 bg-red-950/25 text-red-300";
}
function formatDate(value: string, locale: LocaleCode) {
  return new Date(value).toLocaleString(intlLocaleByCode[locale], {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function CustomerOrdersPage() {
  const locale = useActiveLocale();
  return <Suspense fallback={<div role="status" className="p-6">{customerWorkflowExactT(locale, "Loading orders...")}</div>}><CustomerOrdersContent /></Suspense>;
}

function CustomerOrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useActiveLocale();
  const views = useMemo(() => createViews(locale), [locale]);
  const [userId, setUserId] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const requestedView = searchParams.get("view");
  const view: View = isCustomerOrderView(requestedView) ? requestedView : "active";
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState("");
  const scope = `${view}\u0000${search}`;
  const [loadedScope, setLoadedScope] = useState("");
  const [errorScope, setErrorScope] = useState("");
  const ordersReady = loadedScope === scope;
  const loadedScopeRef = useRef("");
  const requestSequence = useRef(0);
  const invalidateRequests = useCallback(() => { requestSequence.current++; }, []);

  const selectView = useCallback((selectedView: View) => {
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
      .select("id, vehicle_brand, vehicle_model, vehicle_generation, vehicle_engine, service_type, credits_required, status, created_at", { count: "exact" })
      .eq("customer_id", uid)
      .order("created_at", { ascending: false })
      .range(0, rangeEnd);

    const statuses = customerOrderViewStatuses[selectedView];
    if (statuses.length > 0) query = query.in("status", [...statuses]);

    const cleanTerm = term.trim().replace(/[,%()]/g, " ");
    if (cleanTerm) {
      query = query.or(
        `vehicle_brand.ilike.%${cleanTerm}%,vehicle_model.ilike.%${cleanTerm}%,vehicle_engine.ilike.%${cleanTerm}%,service_type.ilike.%${cleanTerm}%`
      );
    }
    return query;
  }, []);

  const loadOrders = useCallback(async (options?: { targetPage?: number; uid?: string; silent?: boolean }) => {
    const uid = options?.uid || userId;
    if (!uid) return;
    const requestId = ++requestSequence.current;
    const nextPage = options?.targetPage ?? 1;
    if (nextPage > 1) setLoadingMore(true);
    if (!options?.silent) setLoadError("");
    const { data, error, count } = await buildQuery(uid, view, search, nextPage * pageSize - 1);
    if (requestId !== requestSequence.current) return;
    if (error) {
      if (!options?.silent || loadedScopeRef.current !== scope) {
        setLoadError(CUSTOMER_ORDERS_LOAD_ERROR_MESSAGE);
        setErrorScope(scope);
      }
    } else {
      setLoadError("");
      setOrders((data ?? []) as Order[]);
      setTotal(count ?? 0);
      setPage(nextPage);
      setLoadedScope(scope);
      loadedScopeRef.current = scope;
    }
    setLoadingMore(false);
  }, [buildQuery, scope, search, userId, view]);

  useEffect(() => {
    async function initialize() {
      const user = (await getStableSession()).session?.user;
      if (!user) {
        notifySessionRequired();
        return;
      }
      if (await signOutIfEmailUnverified(user)) {
        router.push("/login?verify_email=1");
        return;
      }
      setUserId(user.id);
    }
    initialize();
  }, [router]);

  useEffect(() => {
    if (!userId) return;
    const timeout = window.setTimeout(() => loadOrders({ uid: userId }), 250);
    return () => { window.clearTimeout(timeout); invalidateRequests(); };
  }, [invalidateRequests, loadOrders, userId]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel(`customer-order-archive-${userId}`).on(
      "postgres_changes",
      { event: "*", schema: "public", table: "orders", filter: `customer_id=eq.${userId}` },
      () => loadOrders({ uid: userId, silent: true })
    ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadOrders, userId]);

  const currentView = useMemo(() => views.find((item) => item.value === view) ?? views[0], [view, views]);
  const activeView = view === "active" || view === "pending" || view === "in_progress";
  const viewTitle = view === "pending" ? customerWorkflowExactT(locale, "Pending Requests")
    : view === "in_progress" ? customerWorkflowExactT(locale, "In Progress") : currentView.label;
  const loadedOrdersSummary = useMemo(() => {
    return {
      loaded: orders.length,
      needsResponse: orders.filter((order) => order.status === "customer_info_needed").length,
      delivered: orders.filter((order) => order.status === "completed").length,
      creditsShown: orders.reduce(
        (sum, order) => sum + Number(order.credits_required ?? 0),
        0
      ),
    };
  }, [orders]);
  const showInitialLoadError = Boolean(loadError && errorScope === scope && !ordersReady);

  return (
    <main className="mg-compact-ui min-h-screen bg-[var(--mg-portal-canvas)] text-white">
      <div className="flex min-h-screen">
        <section className="min-w-0 flex-1">
          <CustomerPortalPageHeader
            eyebrow="File Service Archive"
            title={viewTitle}
            icon={FileText}
            heading
            actions={(
              <Link href="/new-request" className="rounded-lg bg-[#b1121b] px-4 py-3 text-sm font-black hover:bg-[#c91824]"><Upload className="mr-2 inline h-4 w-4" />New Request</Link>
            )}
          />

          <div className="mx-auto max-w-7xl px-4 py-7 lg:px-8">
            <div className="mb-5 grid grid-cols-2 gap-2 md:hidden">
              {views.map((item) => <button key={item.value} type="button" aria-pressed={currentView.value === item.value} onClick={() => selectView(item.value)} className={`min-w-0 rounded-xl border px-3 py-3 text-sm font-black last:col-span-2 ${currentView.value === item.value ? "border-red-700 bg-red-950/35" : "border-white/10 bg-white/[0.04] text-zinc-400"}`}>{item.label}</button>)}
            </div>

            <div className="mb-6 grid gap-3 md:grid-cols-5">
              {views.map((item) => (
                <button key={item.value} type="button" aria-pressed={currentView.value === item.value} onClick={() => selectView(item.value)} className={`hidden min-w-0 rounded-xl border p-4 text-left [overflow-wrap:anywhere] transition md:block ${currentView.value === item.value ? "border-red-700 bg-red-950/30" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}>
                  <div className="font-black">{item.label}</div><div className="mt-1 text-xs text-zinc-500">{item.description}</div>
                </button>
              ))}
            </div>

            <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
              {activeView && <label className="mb-4 flex flex-wrap items-center gap-2 text-sm font-bold">
                {customerWorkflowT(locale, "notificationTypeOrderStatus")}
                <select aria-label={customerWorkflowT(locale, "notificationTypeOrderStatus")} value={view} onChange={(event) => { if (isCustomerOrderView(event.target.value)) selectView(event.target.value); }} className="min-h-11 max-w-full rounded-lg border border-white/10 bg-[#0b0b0b] px-3 py-2">
                  <option value="active">{customerWorkflowExactT(locale, "Active Orders")}</option>
                  <option value="pending">{customerWorkflowExactT(locale, "Pending Requests")}</option>
                  <option value="in_progress">{customerWorkflowExactT(locale, "In Progress")}</option>
                </select>
              </label>}
              <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div><h2 className="text-2xl font-black">{viewTitle}</h2><p className="mt-1 text-sm text-zinc-500">{ordersReady ? customerWorkflowT(locale, "requestCount", { total: total.toLocaleString(intlLocaleByCode[locale]), pageSize: pageSize.toLocaleString(intlLocaleByCode[locale]) }) : "Order archive sync is pending."}</p></div>
                <label className="relative w-full sm:w-96"><span className="sr-only">Search</span><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search vehicle, engine or service..." className="h-12 w-full rounded-xl border border-white/10 bg-black/35 pl-11 pr-4 text-sm font-bold outline-none focus:border-red-700" /></label>
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
              ) : !ordersReady ? (
                <div role="status" aria-live="polite" className="flex min-h-64 items-center justify-center text-zinc-500"><Loader2 className="mr-3 h-5 w-5 animate-spin" />{customerWorkflowExactT(locale, "Loading orders...")}</div>
              ) : orders.length === 0 ? (
                <div className="min-h-64 rounded-xl border border-dashed border-white/15 p-10 text-center text-zinc-500"><Clock3 className="mx-auto mb-4 h-9 w-9" />No orders found in this view.</div>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => (
                    <article key={order.id} className="grid min-w-0 gap-4 rounded-xl border border-white/10 bg-black/25 p-4 transition hover:border-red-800/50 md:grid-cols-[1.4fr_.7fr_.5fr_auto] md:items-center">
                      <div className="min-w-0"><div className="break-words text-lg font-black">{order.vehicle_brand ? <span translate="no" data-no-translate>{order.vehicle_brand}</span> : customerWorkflowT(locale, "fallbackVehicle")}{order.vehicle_model ? <> {" "}<span translate="no" data-no-translate>{order.vehicle_model}</span></> : null}</div><div className="mt-1 break-words text-sm text-zinc-500"><span translate="no" data-no-translate>{order.vehicle_generation}</span>{order.vehicle_generation ? null : "Generation not set"} · <span translate="no" data-no-translate>{order.vehicle_engine}</span>{order.vehicle_engine ? null : "Engine not set"}</div><div className="mt-2 line-clamp-2 text-sm font-bold text-red-300"><span translate="no" data-no-translate>{order.service_type}</span>{order.service_type ? null : "Service not set"}</div></div>
                      <div><span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusClass(order.status)}`}>{localizeCustomerOrderStatus(locale, order.status)}</span>{order.status === "customer_info_needed" && <div className="mt-2 break-words text-xs font-black text-orange-300">Needs your response</div>}{order.status === "revision" && <div className="mt-2 break-words text-xs font-black text-purple-300">Revision review in progress</div>}{order.status === "completed" && <div className="mt-2 text-xs font-black text-emerald-400"><CheckCircle2 className="mr-1 inline h-3 w-3" />File delivered</div>}</div>
                      <div><div className="font-black">{customerWorkflowT(locale, "creditsCountLower", { count: Number(order.credits_required ?? 0).toLocaleString(intlLocaleByCode[locale]) })}</div><div className="mt-1 text-xs text-zinc-500">{formatDate(order.created_at, locale)}</div></div>
                      <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
                        <Link
                          href={`/new-request?repeat=${order.id}`}
                          aria-label={customerWorkflowT(locale, "createSimilarRequest", {
                            vehicle: `${order.vehicle_brand || customerWorkflowT(locale, "thisVehicle", {})} ${order.vehicle_model || ""}`.trim(),
                          })}
                          className="min-h-11 rounded-xl border border-red-800/45 bg-red-950/25 px-3 py-3 text-center text-xs font-black text-red-100 transition hover:bg-red-950/45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
                        >
                          <CopyPlus className="mr-1.5 inline h-4 w-4" />Repeat
                        </Link>
                        <Link href={`/dashboard/orders/${order.id}`} className="min-h-11 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-sm font-black hover:bg-white/10"><Eye className="mr-2 inline h-4 w-4" />Details</Link>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {ordersReady && orders.length < total && (
                <button onClick={() => loadOrders({ targetPage: page + 1 })} disabled={loadingMore} className="mt-5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-5 py-4 text-sm font-black hover:bg-white/10 disabled:opacity-50">
                  {loadingMore && <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />}{customerWorkflowT(locale, "loadNextOrders", { count: Math.min(pageSize, total - orders.length).toLocaleString(intlLocaleByCode[locale]) })}
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
