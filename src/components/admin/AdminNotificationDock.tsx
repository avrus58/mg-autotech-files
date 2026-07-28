"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { authenticatedFetch } from "@/lib/authGuards";
import type { AdminNotificationOrder } from "@/lib/adminNotificationCenter";
import { AdminNotificationCenter } from "@/components/admin/AdminNotificationCenter";

type NotificationPayload = {
  items?: AdminNotificationOrder[];
  error?: string;
};

export function AdminNotificationDock() {
  const pathname = usePathname();
  const router = useRouter();
  const [orders, setOrders] = useState<AdminNotificationOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const hiddenInMainWorkspace = pathname === "/admin";

  const loadNotifications = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);

    try {
      const response = await authenticatedFetch("/api/admin/notifications", {
        method: "GET",
        cache: "no-store",
      });
      const payload = (await response.json()) as NotificationPayload;
      if (!response.ok) throw new Error(payload.error || "Notification queue unavailable.");

      setOrders(Array.isArray(payload.items) ? payload.items : []);
      setError("");
      setLastSyncAt(new Date());
    } catch {
      setError((current) => current || "Notification queue unavailable.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (hiddenInMainWorkspace) return;

    const initialLoad = window.setTimeout(() => { void loadNotifications(); }, 0);
    const refresh = () => {
      if (document.visibilityState === "visible") void loadNotifications(true);
    };
    const interval = window.setInterval(refresh, 30000);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [hiddenInMainWorkspace, loadNotifications]);

  if (hiddenInMainWorkspace) return null;

  return (
    <div className="fixed right-4 top-20 z-[70]">
      <AdminNotificationCenter
        orders={orders}
        loading={loading}
        refreshing={refreshing}
        error={error}
        lastSyncAt={lastSyncAt}
        onRefresh={() => { void loadNotifications(true); }}
        onOpenOrder={(orderId) => router.push(`/admin/requests/${orderId}`)}
        onFilterQueue={() => router.push("/admin/requests")}
      />
    </div>
  );
}
