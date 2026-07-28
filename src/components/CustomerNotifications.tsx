"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, CheckCheck, MessageSquareText, RefreshCw, Volume2, VolumeX, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getStableSession } from "@/lib/authGuards";

type CustomerNotification = {
  id: string;
  user_id: string;
  order_id: string | null;
  type: "admin_message" | "order_status" | "file_ready" | "additional_upload_enabled" | "system";
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
};

const soundStorageKey = "mg_notification_sound";
type AudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

function playNotificationSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as AudioWindow).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(820, context.currentTime);
    oscillator.frequency.setValueAtTime(1040, context.currentTime + 0.11);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.32);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.34);
  } catch {
    // Browsers may require a user gesture before audio can start.
  }
}

function timeLabel(value: string) {
  const date = new Date(value);
  const diffMinutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 1) return "Now";
  if (diffMinutes < 60) return `${diffMinutes} min`;
  if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} h`;
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

export function CustomerNotifications() {
  const pathname = usePathname();
  const [userId, setUserId] = useState("");
  const [items, setItems] = useState<CustomerNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<CustomerNotification | null>(null);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationLoadError, setNotificationLoadError] = useState<string | null>(null);
  const [notificationRefreshKey, setNotificationRefreshKey] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(() =>
    typeof window === "undefined" || window.localStorage.getItem(soundStorageKey) !== "off"
  );
  const knownIds = useRef(new Set<string>());
  const initialized = useRef(false);

  const unread = useMemo(() => items.filter((item) => !item.read_at).length, [items]);

  useEffect(() => {
    async function resolveCustomer(id?: string) {
      if (!id) {
        setUserId("");
        return;
      }
      const { data } = await supabase.from("profiles").select("role").eq("id", id).maybeSingle();
      setUserId(data?.role === "admin" || data?.role === "staff" ? "" : id);
    }

    void getStableSession().then(({ session }) => resolveCustomer(session?.user?.id));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => { void resolveCustomer(session?.user?.id); }, 0);
      if (!session?.user) {
        setItems([]);
        setOpen(false);
        setNotificationLoading(false);
        setNotificationLoadError(null);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) return;
    let active = true;

    async function loadNotifications(notify = false) {
      if (!initialized.current) {
        setNotificationLoading(true);
        setNotificationLoadError(null);
      }

      const { data, error } = await supabase
        .from("notifications")
        .select("id, user_id, order_id, type, title, body, read_at, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (!active) return;
      if (error) {
        setNotificationLoading(false);
        if (!initialized.current) {
          setNotificationLoadError("Notifications could not be loaded. Please try again.");
        }
        return;
      }
      const next = (data ?? []) as CustomerNotification[];
      const incoming = next.filter((item) => !knownIds.current.has(item.id));
      setItems(next);
      setNotificationLoading(false);
      setNotificationLoadError(null);
      knownIds.current = new Set(next.map((item) => item.id));

      if (initialized.current && notify && incoming.length > 0) {
        setToast(incoming[0]);
        if (soundEnabled) playNotificationSound();
        window.setTimeout(() => setToast(null), 8000);
      }
      initialized.current = true;
    }

    loadNotifications();
    const interval = window.setInterval(() => loadNotifications(true), 20000);
    const channel = supabase
      .channel(`customer-notifications-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => loadNotifications(true)
      )
      .subscribe();

    return () => {
      active = false;
      window.clearInterval(interval);
      supabase.removeChannel(channel);
      knownIds.current = new Set();
      initialized.current = false;
    };
  }, [notificationRefreshKey, soundEnabled, userId]);

  async function markRead(ids: string[]) {
    if (!ids.length) return;
    const readAt = new Date().toISOString();
    setItems((current) => current.map((item) => ids.includes(item.id) ? { ...item, read_at: readAt } : item));
    await supabase.from("notifications").update({ read_at: readAt }).in("id", ids).eq("user_id", userId);
  }

  function toggleSound() {
    setSoundEnabled((current) => {
      const next = !current;
      window.localStorage.setItem(soundStorageKey, next ? "on" : "off");
      if (next) playNotificationSound();
      return next;
    });
  }

  function retryNotificationLoad() {
    setNotificationLoading(true);
    setNotificationLoadError(null);
    setNotificationRefreshKey((current) => current + 1);
  }

  if (!userId || pathname.startsWith("/embed/")) return null;

  return (
    <div className="fixed right-4 top-20 z-[95] flex flex-col items-end gap-3">
      {toast && (
        <div className="w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-red-700/40 bg-[#101114]/95 shadow-2xl shadow-black/60 backdrop-blur-xl">
          <div className="flex items-start gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-950/50 text-red-400">
              <MessageSquareText className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-red-400">New notification</div>
              <div className="mt-1 break-words font-black text-white">{toast.title}</div>
              {toast.body && <div className="mt-1 line-clamp-2 break-words text-sm leading-5 text-zinc-400">{toast.body}</div>}
              {toast.order_id && (
                <Link href={`/dashboard/orders/${toast.order_id}`} onClick={() => { markRead([toast.id]); setToast(null); }} className="mt-3 inline-flex text-sm font-black text-red-400 hover:text-red-300">
                  Open request
                </Link>
              )}
            </div>
            <button onClick={() => setToast(null)} aria-label="Close notification" className="rounded-lg p-1 text-zinc-500 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
          </div>
        </div>
      )}

      <div className="relative">
        <button type="button" onClick={() => setOpen((current) => !current)} aria-label="Notifications" className="relative flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#111720]/95 text-white shadow-2xl shadow-black/50 backdrop-blur-xl hover:border-red-700/60">
          <Bell className="h-5 w-5" />
          {unread > 0 && <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black">{Math.min(unread, 99)}</span>}
        </button>

        {open && (
          <div className="absolute right-0 top-14 w-[min(390px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/10 bg-[#0c0e12]/98 shadow-2xl shadow-black/70 backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
              <div><div className="font-black text-white">Notifications</div><div className="mt-0.5 text-xs text-zinc-500">{unread} unread</div></div>
              <div className="flex items-center gap-1">
                <button onClick={toggleSound} title={soundEnabled ? "Disable notification sound" : "Enable notification sound"} className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white">{soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</button>
                <button onClick={() => markRead(items.filter((item) => !item.read_at).map((item) => item.id))} title="Mark all as read" className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white"><CheckCheck className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {notificationLoading && items.length === 0 ? (
                <div role="status" aria-live="polite" className="p-8 text-center text-sm text-zinc-500">
                  Loading notifications...
                </div>
              ) : notificationLoadError && items.length === 0 ? (
                <div role="alert" className="space-y-4 p-6 text-center">
                  <div>
                    <div className="font-black text-white">Notification sync failed</div>
                    <div className="mt-2 break-words text-sm leading-5 text-zinc-400">{notificationLoadError}</div>
                  </div>
                  <button
                    type="button"
                    onClick={retryNotificationLoad}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-700/40 px-4 py-2 text-sm font-black text-red-300 hover:bg-red-950/30 hover:text-red-200"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Try again
                  </button>
                </div>
              ) : items.length === 0 ? (
                <div className="p-8 text-center text-sm text-zinc-500">No notifications yet.</div>
              ) : items.map((item) => (
                <Link key={item.id} href={item.order_id ? `/dashboard/orders/${item.order_id}` : "/dashboard"} onClick={() => markRead([item.id])} className={`block border-b border-white/5 px-4 py-4 transition hover:bg-white/[0.05] ${item.read_at ? "opacity-60" : "bg-red-950/10"}`}>
                  <div className="flex items-start gap-3">
                    <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${item.read_at ? "bg-zinc-700" : "bg-red-500"}`} />
                    <div className="min-w-0 flex-1"><div className="break-words font-black text-white">{item.title}</div>{item.body && <div className="mt-1 line-clamp-2 break-words text-sm leading-5 text-zinc-400">{item.body}</div>}<div className="mt-2 text-xs text-zinc-600">{timeLabel(item.created_at)}</div></div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
