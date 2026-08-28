"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  startRegistrationHandoffRecoveryForCurrentSession,
  type RegistrationHandoffRecoveryStartResult,
} from "@/lib/registrationHandoffClient";
import { isAccountRuntimePath } from "@/lib/accountRuntimeBoundary";
import { replaceWithPendingMeasurementCompletion } from "@/lib/publicAnalytics";
import {
  OAUTH_REGISTRATION_CONVERSION_ELIGIBLE_KEY,
  OAUTH_REGISTRATION_NOTIFICATION_PENDING_KEY,
} from "@/lib/registrationProfile";

const registrationHandoffKeys = {
  conversion: OAUTH_REGISTRATION_CONVERSION_ELIGIBLE_KEY,
  notification: OAUTH_REGISTRATION_NOTIFICATION_PENDING_KEY,
} as const;
const discoveryRetryMs = 15_000;
const discoveryLifetimeMs = 30 * 60 * 1_000;
// The inner recovery's bounded backoff can run for a little over nine minutes.
// Re-discover after it has gone quiet so still-valid markers get another owner
// without overlapping that first recovery attempt.
const recoveryRediscoveryMs = 10 * 60 * 1_000;

/**
 * A verified registration can leave its callback page before optional
 * measurement or the owner notification acknowledges delivery. sessionStorage
 * survives that document change; this root runtime reconnects the same-account
 * recovery without storing an account id, e-mail address or ad click id.
 */
export function RegistrationHandoffRecoveryRuntime() {
  const pathname = usePathname();
  const accountRuntimeAllowed = isAccountRuntimePath(pathname);

  useEffect(() => {
    if (!accountRuntimeAllowed) return;

    let active = true;
    let inFlight = false;
    let started = false;
    let completed = false;
    let measurementBridgeStarted = false;
    let rediscoveryTimer: number | null = null;

    const attempt = async () => {
      if (!active || inFlight || started || completed) return;
      inFlight = true;
      let result: RegistrationHandoffRecoveryStartResult = "session-pending";
      try {
        result = await startRegistrationHandoffRecoveryForCurrentSession({
          storage: window.sessionStorage,
          keys: registrationHandoffKeys,
          onConversionHandoffCompleted: () => {
            if (
              !active ||
              measurementBridgeStarted ||
              !(
                window.location.pathname === "/dashboard" ||
                window.location.pathname.startsWith("/dashboard/")
              )
            ) return;
            const destination = `${window.location.pathname}${window.location.search}`;
            measurementBridgeStarted =
              replaceWithPendingMeasurementCompletion(destination);
          },
        });
      } catch {
        result = "session-pending";
      } finally {
        inFlight = false;
      }
      if (result === "no-markers") {
        completed = true;
        return;
      }
      if (result === "started") {
        started = true;
        if (rediscoveryTimer !== null) window.clearTimeout(rediscoveryTimer);
        rediscoveryTimer = window.setTimeout(() => {
          rediscoveryTimer = null;
          started = false;
          void attempt();
        }, recoveryRediscoveryMs);
      }
    };

    const attemptWhenVisible = () => {
      if (document.visibilityState === "visible") void attempt();
    };
    window.addEventListener("online", attempt);
    document.addEventListener("visibilitychange", attemptWhenVisible);
    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      void attempt();
    });
    const retryTimer = window.setInterval(() => void attempt(), discoveryRetryMs);
    const expiryTimer = window.setTimeout(() => {
      active = false;
      window.clearInterval(retryTimer);
      if (rediscoveryTimer !== null) window.clearTimeout(rediscoveryTimer);
    }, discoveryLifetimeMs);
    void attempt();

    return () => {
      active = false;
      window.clearInterval(retryTimer);
      window.clearTimeout(expiryTimer);
      if (rediscoveryTimer !== null) window.clearTimeout(rediscoveryTimer);
      window.removeEventListener("online", attempt);
      document.removeEventListener("visibilitychange", attemptWhenVisible);
      authListener.subscription.unsubscribe();
    };
  }, [accountRuntimeAllowed]);

  return null;
}
