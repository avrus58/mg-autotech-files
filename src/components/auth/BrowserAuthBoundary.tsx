"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { AuthRequired } from "@/components/auth/AuthRequired";
import { getStableSession } from "@/lib/authGuards";

type AuthState = "checking" | "authenticated" | "unauthenticated";

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
  const [authState, setAuthState] = useState<AuthState>("checking");

  useEffect(() => {
    let active = true;
    const resolveAuthState = (nextState: AuthState) => {
      if (!active) return;
      setAuthState(nextState);
    };

    const checkSession = () => {
      void getStableSession().then(({ session, error }) => {
        if (session?.user) {
          resolveAuthState("authenticated");
        } else if (!error) {
          resolveAuthState("unauthenticated");
        }
      }).catch(() => {
        // A transient session-check failure is not proof of logout.
      });
    };

    checkSession();
    const fallback = window.setTimeout(checkSession, 8000);

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        resolveAuthState("authenticated");
      } else if (event === "SIGNED_OUT") {
        resolveAuthState("unauthenticated");
      }
    });

    return () => {
      active = false;
      window.clearTimeout(fallback);
      listener.subscription.unsubscribe();
    };
  }, []);

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

  return children;
}
