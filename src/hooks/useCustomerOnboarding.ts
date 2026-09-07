"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import {
  createCustomerOnboardingController,
  HIDDEN_CUSTOMER_GUIDE,
} from "@/lib/customerOnboarding";
import { authenticatedFetchForUser, getStableSession, isEmailVerified } from "@/lib/authGuards";
import { supabase } from "@/lib/supabaseClient";

const tabGuideDismissals = new Map<string, string>();

export function useCustomerOnboarding() {
  const controller = useMemo(() => createCustomerOnboardingController({
    sessionStorage: {
      getItem: (key) => {
        if (typeof window === "undefined") return null;
        try { return window.sessionStorage.getItem(key) ?? tabGuideDismissals.get(key) ?? null; }
        catch { return tabGuideDismissals.get(key) ?? null; }
      },
      setItem: (key, value) => {
        if (typeof window === "undefined") return;
        tabGuideDismissals.set(key, value);
        try { window.sessionStorage.setItem(key, value); } catch { /* Tab memory remains available. */ }
      },
    },
    readUser: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user && isEmailVerified(data.user) ? data.user : null;
    },
    persist: async (expectedUserId, status) => {
      const response = await authenticatedFetchForUser(expectedUserId, "/api/customer/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedUserId, status }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) return null;
      const data: unknown = await response.json();
      if (!data || typeof data !== "object" || !("status" in data)) return null;
      return data.status === "completed" || data.status === "skipped" ? data.status : null;
    },
  }), []);
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, () => HIDDEN_CUSTOMER_GUIDE);

  useEffect(() => {
    let active = true;
    let receivedAuthEvent = false;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const refreshLater = () => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (active) void controller.refresh();
      }, 0);
      timers.add(timer);
    };
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      receivedAuthEvent = true;
      controller.setAccount(session?.user && isEmailVerified(session.user) ? session.user.id : null);
      // Never await another Auth SDK method inside its event callback.
      refreshLater();
    });
    void getStableSession().then(({ session }) => {
      if (!active || receivedAuthEvent) return;
      controller.setAccount(session?.user && isEmailVerified(session.user) ? session.user.id : null);
      refreshLater();
    }).catch(() => undefined);
    const onFocus = () => { if (document.visibilityState === "visible") refreshLater(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      active = false;
      timers.forEach(clearTimeout);
      subscription.subscription.unsubscribe();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      controller.setAccount(null);
    };
  }, [controller]);

  return {
    ...snapshot,
    dismiss: controller.dismiss,
    retryDismiss: controller.retryDismiss,
    hideForSession: controller.hideForSession,
    moveToStep: controller.moveToStep,
  };
}
