"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Loader2, RefreshCcw } from "lucide-react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AuthRequired } from "@/components/auth/AuthRequired";
import { AUTH_SESSION_REQUIRED_EVENT, getStableSession } from "@/lib/authGuards";

type AuthState = "checking" | "authenticated" | "recovering" | "unauthenticated";

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
    const fallback = window.setTimeout(() => {
      if (active) setAuthState("recovering");
    }, 8000);

    const resolveAuthState = (nextState: AuthState) => {
      if (!active) return;
      window.clearTimeout(fallback);
      setAuthState(nextState);
    };

    const verifySession = () => void getStableSession().then(({ session, error }) => {
      resolveAuthState(session?.user ? "authenticated" : error ? "recovering" : "unauthenticated");
    }).catch(() => {
      resolveAuthState("recovering");
    });

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
      window.clearTimeout(fallback);
      listener.subscription.unsubscribe();
      window.removeEventListener(AUTH_SESSION_REQUIRED_EVENT, handleSessionRequired);
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
    return <AuthRequired title={title} description={description} nextPath={nextPath ?? pathname ?? "/"} />;
  }

  if (authState === "recovering") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] px-4 text-white">
        <section className="w-full max-w-lg border-y border-white/10 py-10 text-center">
          <RefreshCcw className="mx-auto h-8 w-8 text-red-500" />
          <h1 className="mt-5 text-2xl font-black">Secure session connection interrupted</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-zinc-400">
            Your account was not signed out. Check the connection and retry the secure session check.
          </p>
          <button
            type="button"
            onClick={() => {
              setAuthState("checking");
              setRetryKey((current) => current + 1);
            }}
            className="mt-6 inline-flex h-12 items-center justify-center rounded-lg bg-[#b1121b] px-5 text-sm font-black"
          >
            <RefreshCcw className="mr-2 h-4 w-4" /> Retry secure connection
          </button>
        </section>
      </main>
    );
  }

  return children;
}
