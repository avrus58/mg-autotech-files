"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BellRing,
  CheckCheck,
  Circle,
  FileCheck2,
  Filter,
  MessageSquareText,
  RefreshCw,
} from "lucide-react";
import { CustomerPortalPageHeader } from "@/components/dashboard/CustomerPortalPageHeader";
import { getStableSession, notifySessionRequired, signOutIfEmailUnverified } from "@/lib/authGuards";
import { supabase } from "@/lib/supabaseClient";
import { customerWorkflowExactT, localizeCustomerNotification } from "@/lib/i18n/customer-workflow-notifications-translations";
import { notificationConnectionState, type NotificationConnectionState } from "@/lib/notificationConnection";
import { intlLocaleByCode, type LocaleCode } from "@/lib/i18nConfig";
import { useActiveLocale } from "@/lib/useActiveLocale";
import { customerNotificationProjection } from "@/lib/customerNotificationProjection";

type NotificationType = "admin_message" | "order_status" | "file_ready" | "additional_upload_enabled" | "system";
type NotificationRow = {
  id: string;
  user_id: string;
  order_id: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  status: string | null;
  read_at: string | null;
  created_at: string;
};
type NotificationFilter = "all" | "unread" | "messages" | "orders" | "files";

const filters: Array<{ value: NotificationFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "messages", label: "Messages" },
  { value: "orders", label: "Order updates" },
  { value: "files", label: "Files & uploads" },
];

function formatBerlin(value: string, locale: LocaleCode) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(intlLocaleByCode[locale], {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(date);
}

function matchesFilter(item: NotificationRow, filter: NotificationFilter) {
  if (filter === "unread") return !item.read_at;
  if (filter === "messages") return item.type === "admin_message";
  if (filter === "orders") return item.type === "order_status";
  if (filter === "files") return item.type === "file_ready" || item.type === "additional_upload_enabled";
  return true;
}

function notificationIcon(type: NotificationType) {
  if (type === "admin_message") return <MessageSquareText className="h-5 w-5" />;
  if (type === "file_ready" || type === "additional_upload_enabled") return <FileCheck2 className="h-5 w-5" />;
  return <BellRing className="h-5 w-5" />;
}

export default function CustomerNotificationCenterPage() {
  const router = useRouter();
  const locale = useActiveLocale();
  const [userId, setUserId] = useState("");
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [connectionState, setConnectionState] = useState<NotificationConnectionState>("connecting");
  const loadSequence = useRef(0);

  const load = useCallback(async (customerId: string, silent = false) => {
    const requestId = ++loadSequence.current;
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");
    const result = await supabase
      .from("notifications")
      .select(customerNotificationProjection)
      .eq("user_id", customerId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (requestId !== loadSequence.current) return;
    if (result.error) setError("Notifications could not be loaded. Please try again.");
    else setItems((result.data ?? []) as NotificationRow[]);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    let active = true;
    let lastSubscriptionStatus = "JOINING";
    const onOffline = () => setConnectionState(notificationConnectionState(lastSubscriptionStatus, false));
    const onOnline = () => setConnectionState(notificationConnectionState(lastSubscriptionStatus, true));
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    let channel: ReturnType<typeof supabase.channel> | null = null;
    void getStableSession().then(async ({ session }) => {
      if (!active) return;
      const user = session?.user;
      if (!user) {
        notifySessionRequired();
        setLoading(false);
        return;
      }
      if (await signOutIfEmailUnverified(user)) {
        if (active) router.push("/login?verify_email=1");
        return;
      }
      if (!active) return;
      const id = user.id;
      setUserId(id);
      if (!navigator.onLine) setConnectionState("disconnected");
      void load(id);
      channel = supabase
        .channel(`notification-center-${id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${id}` }, () => void load(id, true))
        .subscribe((status) => {
          if (!active) return;
          lastSubscriptionStatus = status;
          setConnectionState(notificationConnectionState(status, navigator.onLine));
          // Catch changes missed while the channel was disconnected.
          if (status === "SUBSCRIBED") void load(id, true);
        });
    });
    return () => {
      active = false;
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [load, router]);

  const unread = useMemo(() => items.filter((item) => !item.read_at).length, [items]);
  const visible = useMemo(() => items.filter((item) => matchesFilter(item, filter)), [filter, items]);

  async function markRead(ids: string[]) {
    if (!userId || ids.length === 0) return;
    const readAt = new Date().toISOString();
    setItems((current) => current.map((item) => ids.includes(item.id) ? { ...item, read_at: readAt } : item));
    const result = await supabase.from("notifications").update({ read_at: readAt }).in("id", ids).eq("user_id", userId);
    if (result.error) {
      setError("The read state could not be saved. Refresh to retry.");
      await load(userId, true);
    }
  }

  return (
    <main className="mg-compact-ui min-h-screen bg-[#050505] text-white">
      <CustomerPortalPageHeader
        eyebrow="Customer Notification Center"
        title="Updates that need your attention"
        icon={BellRing}
        heading
        width="6xl"
        actions={(
            <button type="button" onClick={() => userId && void load(userId, true)} disabled={refreshing} className="inline-flex items-center rounded-lg border border-white/10 px-3 py-2 text-sm font-black hover:bg-white/10 disabled:opacity-50"><RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />Refresh</button>
        )}
      />

      <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="grid gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-3">
          <Summary label="All notifications" value={items.length} detail={customerWorkflowExactT(locale, "Latest 100 notifications")} />
          <Summary label="Unread" value={unread} detail="Not yet opened" />
          <div role="status" aria-live="polite"><Summary label="Live updates" value={connectionState === "connected" ? customerWorkflowExactT(locale, "Connected") : connectionState === "disconnected" ? customerWorkflowExactT(locale, "Disconnected") : customerWorkflowExactT(locale, "Connecting")} detail={customerWorkflowExactT(locale, "Use Refresh if updates are delayed.")} /></div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-y border-white/10 py-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2"><Filter className="h-4 w-4 shrink-0 text-zinc-600" />{filters.map((item) => <button key={item.value} type="button" aria-pressed={filter === item.value} onClick={() => setFilter(item.value)} className={`max-w-full break-words rounded-lg px-3 py-2 text-xs font-black ${filter === item.value ? "bg-[#b1121b] text-white" : "bg-white/[0.04] text-zinc-400 hover:bg-white/10"}`}>{item.label}</button>)}</div>
          <button type="button" onClick={() => void markRead(items.filter((item) => !item.read_at).map((item) => item.id))} disabled={unread === 0} className="inline-flex items-center text-xs font-black text-red-300 disabled:text-zinc-700"><CheckCheck className="mr-2 h-4 w-4" />Mark all as read</button>
        </div>

        {error && <div role="alert" className="mt-5 rounded-lg border border-red-700/40 bg-red-950/20 p-4 text-sm text-red-200">{error}</div>}
        {loading ? <div role="status" aria-live="polite" className="py-16 text-center text-sm text-zinc-500">Loading notifications...</div> : (!error || visible.length > 0) && (
          <div className="divide-y divide-white/10 border-b border-white/10">
            {visible.length === 0 && <div className="py-16 text-center"><BellRing className="mx-auto h-6 w-6 text-zinc-700" /><div className="mt-3 font-black">No notifications in this view</div><p className="mt-1 text-sm text-zinc-500">{customerWorkflowExactT(locale, "New order updates and messages will appear here.")}</p></div>}
            {visible.map((item) => {
              const href = item.order_id ? `/dashboard/orders/${item.order_id}` : "/dashboard";
              const copy = localizeCustomerNotification(locale, item);
              return (
                <div key={item.id} className={`grid gap-3 py-4 sm:grid-cols-[44px_minmax(0,1fr)_180px] sm:items-center ${item.read_at ? "opacity-60" : ""}`}>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${item.read_at ? "border-white/10 text-zinc-500" : "border-red-800/40 bg-red-950/20 text-red-300"}`}>{notificationIcon(item.type)}</div>
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Link href={href} onClick={() => void markRead([item.id])} className="font-black hover:text-red-300" translate={copy.rawTitle ? "no" : undefined} data-no-translate={copy.rawTitle ? true : undefined}>{copy.title}</Link>{!item.read_at && <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-red-400"><Circle className="h-2 w-2 fill-current" />New</span>}</div>{copy.body && <p className="mt-1 break-words text-sm leading-5 text-zinc-500" translate={copy.rawBody ? "no" : undefined} data-no-translate={copy.rawBody ? true : undefined}>{copy.body}</p>}<div className="mt-2 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-700">{copy.typeLabel}</div></div>
                  <div className="text-xs text-zinc-600 sm:text-right"><div>{formatBerlin(item.created_at, locale)}</div>{item.order_id && <Link href={href} onClick={() => void markRead([item.id])} className="mt-2 inline-flex font-black text-red-300">Open request</Link>}</div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function Summary({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return <div className="bg-[#0b0b0c] p-4"><div className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-500">{label}</div><div className="mt-2 text-2xl font-black">{value}</div><div className="mt-1 text-xs text-zinc-600">{detail}</div></div>;
}
