"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  BellRing,
  CheckCircle2,
  ChevronRight,
  Clock3,
  RefreshCcw,
  RotateCcw,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  getAdminNotificationSummary,
  getAdminOperationalAlerts,
  getAdminRecentOrderActivity,
  type AdminNotificationOrder,
  type AdminEmailDeliveryIssue,
  type AdminOperationalAlert,
} from "@/lib/adminNotificationCenter";

type AdminNotificationCenterProps = {
  orders: AdminNotificationOrder[];
  emailIssues?: AdminEmailDeliveryIssue[];
  loading: boolean;
  refreshing: boolean;
  error?: string;
  lastSyncAt: Date | null;
  onRefresh: () => void;
  onOpenOrder: (orderId: string) => void;
  onFilterQueue: (status: string) => void;
};

function shortOrderId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function formatReceivedAt(value: string | null) {
  if (!value) return "Time unavailable";
  return new Date(value).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function priorityClasses(priority: AdminOperationalAlert["priority"]) {
  if (priority === "urgent") return "border-red-700/40 bg-red-950/25 text-red-300";
  if (priority === "attention") return "border-amber-700/40 bg-amber-950/20 text-amber-300";
  return "border-sky-700/40 bg-sky-950/20 text-sky-300";
}

export function AdminNotificationCenter({
  orders,
  emailIssues = [],
  loading,
  refreshing,
  error,
  lastSyncAt,
  onRefresh,
  onOpenOrder,
  onFilterQueue,
}: AdminNotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const alerts = useMemo(() => getAdminOperationalAlerts(orders), [orders]);
  const recentActivity = useMemo(() => getAdminRecentOrderActivity(orders), [orders]);
  const summary = useMemo(
    () => getAdminNotificationSummary(orders, emailIssues),
    [orders, emailIssues]
  );
  const hasVerifiedSnapshot = Boolean(lastSyncAt);
  const notificationLabel = !hasVerifiedSnapshot && error
    ? "Admin notifications unavailable"
    : !hasVerifiedSnapshot
      ? "Admin notifications connecting"
      : `Admin notifications, ${summary.activeAlerts} active`;

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event: MouseEvent) {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function openOrder(orderId: string) {
    onOpenOrder(orderId);
    setOpen(false);
  }

  function filterQueue(status: string) {
    onFilterQueue(status);
    setOpen(false);
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={notificationLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`relative flex h-11 w-11 items-center justify-center rounded-xl border text-white shadow-lg transition sm:h-12 sm:w-12 ${
          open
            ? "border-red-600/60 bg-red-950/40 shadow-red-950/30"
            : "border-white/10 bg-white/[0.04] hover:border-red-700/50 hover:bg-white/10"
        }`}
      >
        <BellRing className="h-5 w-5" />
        {summary.activeAlerts > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex min-h-5 min-w-5 items-center justify-center rounded-full border-2 border-black bg-red-600 px-1 text-[10px] font-black leading-none text-white">
            {Math.min(summary.activeAlerts, 99)}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Admin notification center"
          className="fixed inset-x-3 top-[4.75rem] z-[80] max-h-[calc(100vh-6rem)] overflow-hidden rounded-2xl border border-white/10 bg-[#0a0b0e]/[0.99] shadow-2xl shadow-black/80 backdrop-blur-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-14 sm:w-[430px]"
        >
          <div className="border-b border-white/10 bg-[linear-gradient(135deg,rgba(127,29,29,0.22),rgba(10,11,14,0.98)_55%)] px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-red-400">Operations inbox</div>
                <h2 className="mt-1 text-lg font-black text-white">Admin notifications</h2>
                <p className="mt-1 text-xs leading-5 text-zinc-400">
                  Live priorities from the work queue and delivery systems.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={refreshing}
                  title="Refresh notification center"
                  aria-label="Refresh notification center"
                  className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
                >
                  <RefreshCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close notification center"
                  className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-red-800/30 bg-red-950/20 p-3">
                <div className="text-xl font-black text-white">{hasVerifiedSnapshot ? summary.activeAlerts : "—"}</div>
                <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-red-300">Active</div>
              </div>
              <div className="rounded-xl border border-amber-800/30 bg-amber-950/15 p-3">
                <div className="text-xl font-black text-white">{hasVerifiedSnapshot ? summary.urgentAlerts : "—"}</div>
                <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-300">Urgent</div>
              </div>
              <div className="rounded-xl border border-blue-800/30 bg-blue-950/15 p-3">
                <div className="text-xl font-black text-white">{hasVerifiedSnapshot ? summary.inProgress : "—"}</div>
                <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-blue-300">In work</div>
              </div>
            </div>
          </div>

          <div className="max-h-[calc(100vh-20rem)] overflow-y-auto overscroll-contain sm:max-h-[520px]">
            {loading && orders.length === 0 && emailIssues.length === 0 ? (
              <div role="status" aria-live="polite" className="flex min-h-52 flex-col items-center justify-center px-6 text-center">
                <RefreshCcw className="h-6 w-6 animate-spin text-red-400" />
                <div className="mt-4 font-black text-white">Loading operations</div>
                <div className="mt-1 text-sm text-zinc-500">The notification center will stay here while the queue loads.</div>
              </div>
            ) : error && orders.length === 0 && emailIssues.length === 0 ? (
              <div role="alert" className="flex min-h-52 flex-col items-center justify-center px-6 text-center">
                <TriangleAlert className="h-7 w-7 text-amber-400" />
                <div className="mt-4 font-black text-white">Queue connection unavailable</div>
                <div className="mt-1 text-sm leading-5 text-zinc-500">Existing admin access is unchanged. Retry the queue connection.</div>
                <button
                  type="button"
                  onClick={onRefresh}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-black text-white transition hover:bg-white/10"
                >
                  <RotateCcw className="h-4 w-4" />
                  Try again
                </button>
              </div>
            ) : (
              <>
                {emailIssues.length > 0 && (
                  <section className="border-b border-white/10 px-3 py-4">
                    <div className="flex items-center justify-between gap-3 px-1">
                      <div>
                        <h3 className="text-sm font-black text-white">Email delivery needs attention</h3>
                        <p className="mt-0.5 text-xs text-zinc-500">Signed provider events only; recipient details stay in Email Control Center.</p>
                      </div>
                      <Link href="/admin/email" onClick={() => setOpen(false)} className="shrink-0 text-xs font-black text-red-400 hover:text-red-300">
                        Review
                      </Link>
                    </div>
                    <div className="mt-3 space-y-2">
                      {emailIssues.slice(0, 4).map((issue) => (
                        <Link
                          key={issue.id}
                          href="/admin/email"
                          onClick={() => setOpen(false)}
                          className="flex items-center gap-3 rounded-xl border border-red-800/30 bg-red-950/15 p-3 transition hover:border-red-700/50"
                        >
                          <TriangleAlert className="h-4 w-4 shrink-0 text-red-400" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-black text-white">Email {issue.status.replaceAll("_", " ")}</span>
                            <span className="mt-0.5 block text-[11px] text-zinc-500">{formatReceivedAt(issue.occurredAt)}</span>
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600" />
                        </Link>
                      ))}
                    </div>
                  </section>
                )}

                <section className="border-b border-white/10 px-3 py-4">
                  <div className="flex items-center justify-between gap-3 px-1">
                    <div>
                      <h3 className="text-sm font-black text-white">Needs attention</h3>
                      <p className="mt-0.5 text-xs text-zinc-500">Open queue states that should remain visible.</p>
                    </div>
                    {alerts.length > 0 && (
                      <button type="button" onClick={() => filterQueue("all")} className="shrink-0 text-xs font-black text-red-400 hover:text-red-300">
                        View queue
                      </button>
                    )}
                  </div>

                  {alerts.length === 0 ? (
                    <div className="mt-3 flex items-center gap-3 rounded-xl border border-emerald-800/30 bg-emerald-950/15 p-4">
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                      <div>
                        <div className="text-sm font-black text-white">Operations are clear</div>
                        <div className="mt-0.5 text-xs text-zinc-500">No open queue alerts need attention right now.</div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {alerts.slice(0, 6).map((alert) => (
                        <button
                          type="button"
                          key={alert.key}
                          onClick={() => openOrder(alert.orderId)}
                          className="group flex w-full items-start gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3 text-left transition hover:border-red-700/40 hover:bg-red-950/15"
                        >
                          <span className={`mt-0.5 inline-flex rounded-lg border px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${priorityClasses(alert.priority)}`}>
                            {alert.priority}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-black text-white">{alert.title}</span>
                            <span className="mt-1 block truncate text-xs text-zinc-400">{alert.vehicleLabel} · #{shortOrderId(alert.orderId)}</span>
                            <span className="mt-1 block text-[11px] text-zinc-600">Received {formatReceivedAt(alert.receivedAt)}</span>
                          </span>
                          <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-red-400" />
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                <section className="px-3 py-4">
                  <div className="flex items-center justify-between gap-3 px-1">
                    <div>
                      <h3 className="text-sm font-black text-white">Recent order activity</h3>
                      <p className="mt-0.5 text-xs text-zinc-500">The five most recently received requests.</p>
                    </div>
                    <Clock3 className="h-4 w-4 text-zinc-600" />
                  </div>

                  {recentActivity.length === 0 ? (
                    <div className="mt-3 rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-zinc-500">
                      No order activity is available yet.
                    </div>
                  ) : (
                    <div className="mt-3 divide-y divide-white/5 rounded-xl border border-white/10 bg-black/20">
                      {recentActivity.map((item) => (
                        <button
                          type="button"
                          key={item.key}
                          onClick={() => openOrder(item.orderId)}
                          className="group flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-white/[0.04]"
                        >
                          <span className="h-2 w-2 shrink-0 rounded-full bg-red-500/80" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-black text-white">{item.title}</span>
                            <span className="mt-0.5 block truncate text-[11px] text-zinc-500">{item.vehicleLabel} · #{shortOrderId(item.orderId)}</span>
                          </span>
                          <span className="shrink-0 text-[10px] text-zinc-600">{formatReceivedAt(item.receivedAt)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-black/30 px-4 py-3 text-[10px] text-zinc-600">
            <span>{refreshing ? "Refreshing queue..." : lastSyncAt ? `Last sync ${lastSyncAt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}` : "Awaiting first sync"}</span>
            <span className="font-bold uppercase tracking-[0.12em]">Admin only</span>
          </div>
        </div>
      )}
    </div>
  );
}
