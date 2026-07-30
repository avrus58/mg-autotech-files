"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BellRing,
  CheckCheck,
  Circle,
  FileCheck2,
  Filter,
  MessageSquareText,
  RefreshCw,
} from "lucide-react";
import { getStableSession, notifySessionRequired } from "@/lib/authGuards";
import { supabase } from "@/lib/supabaseClient";

type NotificationType = "admin_message" | "order_status" | "file_ready" | "additional_upload_enabled" | "system";
type NotificationRow = {
  id: string;
  user_id: string;
  order_id: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
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

function formatBerlin(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(new Date(value));
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
  const [userId, setUserId] = useState("");
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (customerId: string, silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");
    const result = await supabase
      .from("notifications")
      .select("id,user_id,order_id,type,title,body,read_at,created_at")
      .eq("user_id", customerId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (result.error) setError("Notifications could not be loaded. Please try again.");
    else setItems((result.data ?? []) as NotificationRow[]);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    void getStableSession().then(({ session }) => {
      if (!active) return;
      const id = session?.user?.id;
      if (!id) {
        notifySessionRequired();
        setLoading(false);
        return;
      }
      setUserId(id);
      void load(id);
      channel = supabase
        .channel(`notification-center-${id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${id}` }, () => void load(id, true))
        .subscribe();
    });
    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [load]);

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
      <header className="border-b border-white/10 bg-black/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div>
            <Link href="/dashboard" className="inline-flex items-center gap-2 text-xs font-black text-zinc-500 hover:text-white"><ArrowLeft className="h-4 w-4" />Dashboard</Link>
            <div className="mt-2 flex items-center gap-3"><BellRing className="h-7 w-7 text-red-500" /><div><p className="text-xs font-black uppercase tracking-[0.18em] text-red-500">Customer Notification Center</p><h1 className="text-xl font-black sm:text-2xl">Updates that need your attention</h1></div></div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => userId && void load(userId, true)} disabled={refreshing} className="inline-flex items-center rounded-lg border border-white/10 px-3 py-2 text-sm font-black hover:bg-white/10 disabled:opacity-50"><RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />Refresh</button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="grid gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-3">
          <Summary label="All notifications" value={items.length} detail="Latest 100 customer-safe events" />
          <Summary label="Unread" value={unread} detail="Not yet opened" />
          <Summary label="Live updates" value="On" detail="Customer-owned realtime channel" />
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-y border-white/10 py-3">
          <div className="flex items-center gap-2 overflow-x-auto"><Filter className="h-4 w-4 shrink-0 text-zinc-600" />{filters.map((item) => <button key={item.value} type="button" onClick={() => setFilter(item.value)} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-black ${filter === item.value ? "bg-[#b1121b] text-white" : "bg-white/[0.04] text-zinc-400 hover:bg-white/10"}`}>{item.label}</button>)}</div>
          <button type="button" onClick={() => void markRead(items.filter((item) => !item.read_at).map((item) => item.id))} disabled={unread === 0} className="inline-flex items-center text-xs font-black text-red-300 disabled:text-zinc-700"><CheckCheck className="mr-2 h-4 w-4" />Mark all as read</button>
        </div>

        {error && <div role="alert" className="mt-5 rounded-lg border border-red-700/40 bg-red-950/20 p-4 text-sm text-red-200">{error}</div>}
        {loading ? <div role="status" className="py-16 text-center text-sm text-zinc-500">Loading notifications...</div> : (
          <div className="divide-y divide-white/10 border-b border-white/10">
            {visible.length === 0 && <div className="py-16 text-center"><BellRing className="mx-auto h-6 w-6 text-zinc-700" /><div className="mt-3 font-black">No notifications in this view</div><p className="mt-1 text-sm text-zinc-500">New customer-safe order and message events will appear here.</p></div>}
            {visible.map((item) => {
              const href = item.order_id ? `/dashboard/orders/${item.order_id}` : "/dashboard";
              return (
                <div key={item.id} className={`grid gap-3 py-4 sm:grid-cols-[44px_minmax(0,1fr)_180px] sm:items-center ${item.read_at ? "opacity-60" : ""}`}>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${item.read_at ? "border-white/10 text-zinc-500" : "border-red-800/40 bg-red-950/20 text-red-300"}`}>{notificationIcon(item.type)}</div>
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Link href={href} onClick={() => void markRead([item.id])} className="font-black hover:text-red-300">{item.title}</Link>{!item.read_at && <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-red-400"><Circle className="h-2 w-2 fill-current" />New</span>}</div>{item.body && <p className="mt-1 break-words text-sm leading-5 text-zinc-500">{item.body}</p>}<div className="mt-2 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-700">{item.type.replaceAll("_", " ")}</div></div>
                  <div className="text-xs text-zinc-600 sm:text-right"><div>{formatBerlin(item.created_at)}</div>{item.order_id && <Link href={href} onClick={() => void markRead([item.id])} className="mt-2 inline-flex font-black text-red-300">Open request</Link>}</div>
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-5 text-xs leading-5 text-zinc-600">This center shows customer-visible notifications only. Internal notes, staff audit events, storage paths and private file metadata are never included.</p>
      </section>
    </main>
  );
}

function Summary({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return <div className="bg-[#0b0b0c] p-4"><div className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-500">{label}</div><div className="mt-2 text-2xl font-black">{value}</div><div className="mt-1 text-xs text-zinc-600">{detail}</div></div>;
}
