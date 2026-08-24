"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  shouldReloadAdminAfterHistoryReturn,
  shouldReloadAdminFromPageCache,
} from "@/lib/adminNavigationRecovery";

export function AdminWorkspaceRestoreGuard() {
  const pathname = usePathname();
  const previousPathnameRef = useRef(pathname);
  const historyTargetPathnameRef = useRef<string | null>(null);
  const reloadRequestedRef = useRef(false);

  const requestFreshWorkspace = useCallback(() => {
    if (reloadRequestedRef.current) return;
    reloadRequestedRef.current = true;
    window.location.reload();
  }, []);

  useEffect(() => {
    const readNavigationEntry = () => {
      const [entry] = window.performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
      return {
        navigationType: entry?.type ?? null,
        navigationEntryPathname: entry?.name ? new URL(entry.name).pathname : null,
      };
    };
    const handleHistoryTraversal = () => {
      historyTargetPathnameRef.current = window.location.pathname;
    };
    const handlePageShow = (event: PageTransitionEvent) => {
      if (shouldReloadAdminFromPageCache({
        persisted: event.persisted,
        ...readNavigationEntry(),
        currentPathname: window.location.pathname,
      })) {
        requestFreshWorkspace();
      }
    };

    if (shouldReloadAdminFromPageCache({
      persisted: false,
      ...readNavigationEntry(),
      currentPathname: window.location.pathname,
    })) {
      requestFreshWorkspace();
    }

    window.addEventListener("popstate", handleHistoryTraversal);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.removeEventListener("popstate", handleHistoryTraversal);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [requestFreshWorkspace]);

  useEffect(() => {
    const previousPathname = previousPathnameRef.current;
    const historyTargetPathname = historyTargetPathnameRef.current;

    if (shouldReloadAdminAfterHistoryReturn({
      previousPathname,
      currentPathname: pathname,
      historyTargetPathname,
    })) {
      requestFreshWorkspace();
      return;
    }

    previousPathnameRef.current = pathname;
    historyTargetPathnameRef.current = null;
  }, [pathname, requestFreshWorkspace]);

  return null;
}
