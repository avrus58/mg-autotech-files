"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getStableSession } from "@/lib/authGuards";
import { recordGrowthIdentityLinked } from "@/lib/growth/client";
import { readExistingGrowthVisitorId } from "@/lib/growth/publicClient";
import { isAccountRuntimePath } from "@/lib/accountRuntimeBoundary";
import { measurementConsentChangedEvent } from "@/lib/publicAnalytics";
import { supabase } from "@/lib/supabaseClient";

const identityLinkRetryDelaysMs = [2_000, 15_000, 60_000] as const;

/**
 * Reconnects a consented public attribution touch after any successful auth
 * path (password, Google, e-mail confirmation, or restored session). The API
 * binds the request to the current verified account; this runtime is fail-soft
 * and never emits a provider/Google event or stores an account identifier.
 */
export function GrowthIdentityLinkRuntime() {
  const pathname = usePathname();
  const accountRuntimeAllowed = isAccountRuntimePath(pathname);

  useEffect(() => {
    if (!accountRuntimeAllowed) return;

    let active = true;
    let inFlight = false;
    let rerunRequested = false;
    let linkedVisitorId = "";
    let retryIndex = 0;
    let retryTimer: number | null = null;

    const clearRetry = () => {
      if (retryTimer === null) return;
      window.clearTimeout(retryTimer);
      retryTimer = null;
    };

    const scheduleRetry = (attempt: () => void) => {
      if (!active || retryTimer !== null) return;
      const delay = identityLinkRetryDelaysMs[retryIndex];
      if (delay === undefined) return;
      retryIndex += 1;
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        attempt();
      }, delay);
    };

    const attempt = async () => {
      if (!active) return;
      if (inFlight) {
        // Auth can complete while the restored-session probe is still running.
        // Preserve that signal so the successful auth boundary is never lost.
        rerunRequested = true;
        return;
      }
      const visitorId = readExistingGrowthVisitorId();
      if (!visitorId) {
        clearRetry();
        retryIndex = 0;
        return;
      }
      if (visitorId === linkedVisitorId) return;

      inFlight = true;
      try {
        const { session } = await getStableSession();
        const expectedUserId = session?.user?.id ?? "";
        if (!active || !expectedUserId) return;
        const linked = await recordGrowthIdentityLinked(expectedUserId);
        if (!active) return;
        if (linked) {
          linkedVisitorId = visitorId;
          retryIndex = 0;
          clearRetry();
        } else {
          scheduleRetry(() => void attempt());
        }
      } catch {
        scheduleRetry(() => void attempt());
      } finally {
        inFlight = false;
        if (active && rerunRequested) {
          rerunRequested = false;
          void attempt();
        }
      }
    };

    const attemptWhenVisible = () => {
      if (document.visibilityState === "visible") void attempt();
    };
    const requestAttempt = () => void attempt();

    window.addEventListener("online", requestAttempt);
    window.addEventListener(measurementConsentChangedEvent, requestAttempt);
    document.addEventListener("visibilitychange", attemptWhenVisible);
    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      void attempt();
    });
    void attempt();

    return () => {
      active = false;
      clearRetry();
      window.removeEventListener("online", requestAttempt);
      window.removeEventListener(measurementConsentChangedEvent, requestAttempt);
      document.removeEventListener("visibilitychange", attemptWhenVisible);
      authListener.subscription.unsubscribe();
    };
  }, [accountRuntimeAllowed]);

  return null;
}
