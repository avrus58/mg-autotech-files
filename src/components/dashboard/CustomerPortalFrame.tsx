"use client";

import { Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import {
  CustomerPortalMobileNav,
  CustomerPortalSidebar,
  type CustomerPortalActiveItem,
} from "@/components/dashboard/CustomerPortalSidebar";
import { getStableSession, isEmailVerified } from "@/lib/authGuards";
import { supabase } from "@/lib/supabaseClient";

function resolveActiveItem(pathname: string, view: string | null): CustomerPortalActiveItem {
  if (pathname === "/new-request") return "new-request";

  if (pathname === "/dashboard/orders") {
    if (view === "needs_response") return "needs-response";
    if (view === "completed" || view === "cancelled" || view === "all") {
      return "order-history";
    }
    return "orders";
  }

  if (pathname.startsWith("/dashboard/orders/")) return "orders";
  if (pathname.startsWith("/dashboard/file-expert")) return "file-expert";
  if (pathname.startsWith("/dashboard/log-analysis")) return "log-analysis";
  if (pathname.startsWith("/dashboard/widget")) return "widget";
  if (pathname.startsWith("/dashboard/credits/history")) return "credit-history";
  if (pathname.startsWith("/dashboard/credits")) return "credits";
  if (pathname.startsWith("/dashboard/notifications")) return "notifications";
  if (pathname.startsWith("/dashboard/settings")) return "settings";
  return "dashboard";
}

function CustomerPortalDesktopNavigation({
  pathname,
  credits,
}: {
  pathname: string;
  credits: number | null;
}) {
  const searchParams = useSearchParams();
  return (
    <CustomerPortalSidebar
      activeItem={resolveActiveItem(pathname, searchParams.get("view"))}
      credits={credits}
    />
  );
}

function CustomerPortalMobileNavigation({ pathname }: { pathname: string }) {
  const searchParams = useSearchParams();
  return (
    <CustomerPortalMobileNav
      activeItem={resolveActiveItem(pathname, searchParams.get("view"))}
    />
  );
}

export function CustomerPortalFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const fallbackActiveItem = resolveActiveItem(pathname, null);
  const routeOwnsDesktopScroll =
    pathname === "/dashboard" || pathname.startsWith("/dashboard/orders/");
  const [credits, setCredits] = useState<number | null>(null);

  const readCredits = useCallback(async (userId: string) => {
    const result = await supabase
      .from("profiles")
      .select("credit_balance")
      .eq("id", userId)
      .maybeSingle();

    if (result.error) return undefined;
    const nextCredits = Number(result.data?.credit_balance ?? 0);
    return Number.isFinite(nextCredits) ? nextCredits : null;
  }, []);

  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void getStableSession().then(async ({ session }) => {
      const user = session?.user;
      if (!active || !user) return;
      if (!isEmailVerified(user)) return;

      const userId = user.id;
      const syncCredits = () => {
        void readCredits(userId).then((nextCredits) => {
          if (active && nextCredits !== undefined) setCredits(nextCredits);
        });
      };

      syncCredits();
      channel = supabase
        .channel(`customer-portal-balance-${userId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
          syncCredits
        )
        .subscribe();
    }).catch(() => undefined);

    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [readCredits]);

  return (
    <AppShell>
      <div
        data-customer-portal-frame
        className="flex min-h-screen bg-[var(--mg-portal-canvas)] lg:h-screen lg:overflow-hidden"
      >
        <Suspense
          fallback={
            <CustomerPortalSidebar activeItem={fallbackActiveItem} credits={credits} />
          }
        >
          <CustomerPortalDesktopNavigation pathname={pathname} credits={credits} />
        </Suspense>

        <div
          className={`mg-customer-workspace-content flex min-h-0 min-w-0 flex-1 flex-col lg:h-screen ${
            routeOwnsDesktopScroll ? "lg:overflow-hidden" : "lg:overflow-y-auto"
          }`}
        >
          <Suspense fallback={<CustomerPortalMobileNav activeItem={fallbackActiveItem} />}>
            <CustomerPortalMobileNavigation pathname={pathname} />
          </Suspense>
          {children}
        </div>
      </div>
    </AppShell>
  );
}
