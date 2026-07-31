"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Loader2, RefreshCcw } from "lucide-react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AuthRequired } from "@/components/auth/AuthRequired";
import {
  AUTH_SESSION_REQUIRED_EVENT,
  getStableSession,
  getStableSessionSnapshot,
} from "@/lib/authGuards";

type AuthState = "checking" | "authenticated" | "recovering" | "unavailable" | "unauthenticated";

const sessionRecoveryDelays = [350, 800, 1600, 3200, 5000] as const;
const slowSessionCheckDelay = 2500;
const unavailableSessionDelay = 30000;

export function BrowserAuthBoundary({
  children,
  title,
  description,
  nextPath,
}: {
  children: ReactNode;
  title: string;
  description: string;
  nextPath?: string;
}) {
  const pathname = usePathname();
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    let recoveryAttempt = 0;
    let retryTimer: number | null = null;
    let slowCheckTimer: number | null = null;
    let unavailableTimer: number | null = null;

    const clearTimer = (timer: number | null) => {
      if (timer !== null) window.clearTimeout(timer);
    };

    const clearWaitTimers = () => {
      clearTimer(retryTimer);
      clearTimer(slowCheckTimer);
      clearTimer(unavailableTimer);
      retryTimer = null;
      slowCheckTimer = null;
      unavailableTimer = null;
    };

    const preserveAuthenticatedView = (nextState: AuthState) => {
      if (!active) return;
      setAuthState((current) => current === "authenticated" ? current : nextState);
    };

    const startWaitTimers = () => {
      if (slowCheckTimer === null) {
        slowCheckTimer = window.setTimeout(() => {
          preserveAuthenticatedView("recovering");
        }, slowSessionCheckDelay);
      }

      if (unavailableTimer === null) {
        unavailableTimer = window.setTimeout(() => {
          preserveAuthenticatedView("unavailable");
        }, unavailableSessionDelay);
      }
    };

    const resolveAuthState = (nextState: AuthState) => {
      if (!active) return;
      clearWaitTimers();
      setAuthState(nextState);
    };

    const scheduleRecovery = () => {
      if (!active || retryTimer !== null) return;

      startWaitTimers();
      const delay = sessionRecoveryDelays[Math.min(recoveryAttempt, sessionRecoveryDelays.length - 1)];
      recoveryAttempt += 1;
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        verifySession();
      }, delay);
    };

    const verifySession = () => void getStableSession().then(({ session, error }) => {
      if (session?.user) {
        recoveryAttempt = 0;
        resolveAuthState("authenticated");
        return;
      }

      if (!error) {
        resolveAuthState("unauthenticated");
        return;
      }

      scheduleRecovery();
    }).catch(() => {
      scheduleRecovery();
    });

    const hasCachedSession = Boolean(getStableSessionSnapshot()?.user);
    if (!hasCachedSession) startWaitTimers();

    verifySession();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        resolveAuthState("authenticated");
      } else if (event === "INITIAL_SESSION" || event === "SIGNED_OUT") {
        // Let the auth callback settle before making another Supabase call.
        window.setTimeout(verifySession, 0);
      }
    });

    const handleSessionRequired = () => resolveAuthState("unauthenticated");
    window.addEventListener(AUTH_SESSION_REQUIRED_EVENT, handleSessionRequired);

    return () => {
      active = false;
      clearWaitTimers();
      listener.subscription.unsubscribe();
      window.removeEventListener(AUTH_SESSION_REQUIRED_EVENT, handleSessionRequired);
    };
  }, [retryKey]);

  if (authState === "checking" || authState === "recovering") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] px-4 text-white">
        <div role="status" aria-live="polite" className="flex items-center gap-3 text-sm font-bold text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin text-red-500" />
          {authState === "recovering" ? "Restoring secure session..." : "Checking secure session..."}
        </div>
      </main>
    );
  }

  if (authState === "unauthenticated") {
    return <AuthRequired title={title} description={description} nextPath={nextPath ?? pathname ?? "/"} />;
  }

  if (authState === "unavailable") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] px-4 text-white">
        <section className="w-full max-w-lg border-y border-white/10 py-10 text-center">
          <RefreshCcw className="mx-auto h-8 w-8 text-red-500" />
          <h1 className="mt-5 text-2xl font-black">MG AutoTech is taking longer to respond</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-zinc-400">
            Your account remains protected. Check your connection and try the secure session check again.
          </p>
          <button
            type="button"
            onClick={() => {
              setAuthState("checking");
              setRetryKey((current) => current + 1);
            }}
            className="mt-6 inline-flex h-12 items-center justify-center rounded-lg bg-[#b1121b] px-5 text-sm font-black"
          >
            <RefreshCcw className="mr-2 h-4 w-4" /> Try again
          </button>
        </section>
      </main>
    );
  }

  return children;
}
