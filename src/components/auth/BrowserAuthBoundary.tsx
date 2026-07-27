"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { AuthRequired } from "@/components/auth/AuthRequired";
import { getStableSession } from "@/lib/authGuards";
import {
  browserAuthCheckRetryLimit,
  getBrowserAuthCheckRetryDelay,
  resolveBrowserAuthCheck,
  type BrowserAuthState,
} from "@/lib/authBoundaryState";

export function BrowserAuthBoundary({
  children,
  title,
  description,
  nextPath,
}: {
  children: ReactNode;
  title: string;
  description: string;
  nextPath: string;
}) {
  const [authState, setAuthState] = useState<BrowserAuthState>("checking");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    let authEventRevision = 0;
    let completedAttempts = 0;
    let retryTimer: number | null = null;

    const clearRetryTimer = () => {
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      retryTimer = null;
    };

    const resolveAuthState = (nextState: BrowserAuthState) => {
      if (!active) return;
      clearRetryTimer();
      setAuthState(nextState);
    };

    const scheduleRetry = () => {
      if (!active || retryTimer !== null) return;
      if (completedAttempts >= browserAuthCheckRetryLimit) {
        resolveAuthState("unavailable");
        return;
      }

      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        void checkSession();
      }, getBrowserAuthCheckRetryDelay(completedAttempts));
    };

    const checkSession = async () => {
      const revisionAtStart = authEventRevision;
      completedAttempts += 1;

      try {
        const result = await getStableSession({ maxAttempts: 1 });

        if (!active || revisionAtStart !== authEventRevision) return;
        const decision = resolveBrowserAuthCheck({
          hasUser: Boolean(result.session?.user),
          error: result.error,
        });
        if (decision === "retry") {
          scheduleRetry();
        } else {
          resolveAuthState(decision);
        }
      } catch {
        if (active && revisionAtStart === authEventRevision) scheduleRetry();
      }
    };

    void checkSession();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        authEventRevision += 1;
        resolveAuthState("authenticated");
      } else if (event === "SIGNED_OUT") {
        authEventRevision += 1;
        resolveAuthState("unauthenticated");
      }
    });

    return () => {
      active = false;
      clearRetryTimer();
      listener.subscription.unsubscribe();
    };
  }, [retryKey]);

  if (authState === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] px-4 text-white">
        <div className="flex items-center gap-3 text-sm font-bold text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin text-red-500" />
          Checking secure session...
        </div>
      </main>
    );
  }

  if (authState === "unauthenticated") {
    return <AuthRequired title={title} description={description} nextPath={nextPath} />;
  }

  if (authState === "unavailable") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] px-4 text-white">
        <div
          className="max-w-md rounded-2xl border border-amber-800/50 bg-amber-950/20 p-6 text-center"
          role="alert"
        >
          <h1 className="text-lg font-black">Session check is temporarily unavailable</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-300">
            Your session was not signed out. Check your connection and try the secure
            session check again.
          </p>
          <button
            className="mt-5 rounded-xl bg-white px-4 py-2 text-sm font-black text-black transition hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            type="button"
            onClick={() => {
              setAuthState("checking");
              setRetryKey((current) => current + 1);
            }}
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  return children;
}
