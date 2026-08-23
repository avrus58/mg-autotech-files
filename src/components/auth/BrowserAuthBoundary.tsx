"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Loader2, RefreshCcw } from "lucide-react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AuthRequired } from "@/components/auth/AuthRequired";
import { DeviceVerificationPanel } from "@/components/auth/DeviceVerificationPanel";
import { getDeviceVerificationStatus } from "@/lib/deviceVerificationClient";
import {
  AUTH_DEVICE_VERIFICATION_REQUIRED_EVENT,
  AUTH_SESSION_REQUIRED_EVENT,
  getStableSession,
  signOutLocalStable,
} from "@/lib/authGuards";

type AuthState =
  | "checking"
  | "authenticated"
  | "verification_required"
  | "recovering"
  | "unavailable"
  | "unauthenticated";

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
  const authStateRef = useRef<AuthState>("checking");
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

    const commitAuthState = (nextState: AuthState) => {
      if (!active) return;
      authStateRef.current = nextState;
      setAuthState(nextState);
    };

    const startWaitTimers = () => {
      if (slowCheckTimer === null) {
        slowCheckTimer = window.setTimeout(() => {
          commitAuthState("recovering");
        }, slowSessionCheckDelay);
      }

      if (unavailableTimer === null) {
        unavailableTimer = window.setTimeout(() => {
          commitAuthState("unavailable");
        }, unavailableSessionDelay);
      }
    };

    const resolveAuthState = (nextState: AuthState) => {
      if (!active) return;
      clearWaitTimers();
      commitAuthState(nextState);
    };

    const scheduleRecovery = () => {
      if (!active || retryTimer !== null) return;

      if (
        authStateRef.current !== "authenticated" &&
        authStateRef.current !== "verification_required"
      ) {
        startWaitTimers();
      }
      const delay = sessionRecoveryDelays[Math.min(recoveryAttempt, sessionRecoveryDelays.length - 1)];
      recoveryAttempt += 1;
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        verifySession();
      }, delay);
    };

    const verifySession = () => void (async () => {
      const { session, error } = await getStableSession();
      if (!session?.user) {
        if (!error) resolveAuthState("unauthenticated");
        else scheduleRecovery();
        return;
      }

      const assurance = await getDeviceVerificationStatus();
      recoveryAttempt = 0;
      if (assurance.status === "revoked") {
        await signOutLocalStable();
        resolveAuthState("unauthenticated");
        return;
      }
      resolveAuthState(
        assurance.status === "required"
          ? "verification_required"
          : "authenticated"
      );
    })().catch(() => {
      scheduleRecovery();
    });

    startWaitTimers();
    verifySession();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        window.setTimeout(verifySession, 0);
      } else if (event === "INITIAL_SESSION" || event === "SIGNED_OUT") {
        // Let the auth callback settle before making another Supabase call.
        window.setTimeout(verifySession, 0);
      }
    });

    const handleSessionRequired = () => resolveAuthState("unauthenticated");
    const handleDeviceVerificationRequired = () => resolveAuthState("verification_required");
    window.addEventListener(AUTH_SESSION_REQUIRED_EVENT, handleSessionRequired);
    window.addEventListener(
      AUTH_DEVICE_VERIFICATION_REQUIRED_EVENT,
      handleDeviceVerificationRequired
    );

    return () => {
      active = false;
      clearWaitTimers();
      listener.subscription.unsubscribe();
      window.removeEventListener(AUTH_SESSION_REQUIRED_EVENT, handleSessionRequired);
      window.removeEventListener(
        AUTH_DEVICE_VERIFICATION_REQUIRED_EVENT,
        handleDeviceVerificationRequired
      );
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

  if (authState === "verification_required") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] px-4 py-10 text-white">
        <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/[0.04] p-7 shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-9">
          <DeviceVerificationPanel
            nextPath={nextPath ?? pathname ?? "/dashboard"}
            onVerified={() => setAuthState("authenticated")}
          />
        </div>
      </main>
    );
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
              authStateRef.current = "checking";
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
