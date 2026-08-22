"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCcw } from "lucide-react";
import { AuthRequired } from "@/components/auth/AuthRequired";
import { supabase } from "@/lib/supabaseClient";

const LogAnalysisStudio = dynamic(
  () => import("@/components/dashboard/LogAnalysisStudio").then(
    (module) => module.LogAnalysisStudio
  ),
  {
    ssr: false,
    loading: () => (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] px-4 text-white">
        <div role="status" aria-live="polite" className="flex items-center gap-3 text-sm font-bold text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin text-red-500" />
          Opening your private datalog workspace...
        </div>
      </main>
    ),
  }
);

type StudioAccessState = "checking" | "verified" | "unauthenticated" | "unavailable";

async function resolveCustomerAccess(): Promise<StudioAccessState> {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (data.user && !error) {
      return "verified";
    }

    const rejectedSession =
      !error ||
      error.status === 401 ||
      error.status === 403 ||
      error.name === "AuthSessionMissingError";
    return rejectedSession ? "unauthenticated" : "unavailable";
  } catch {
    return "unavailable";
  }
}

export function LogAnalysisStudioLoader() {
  const [accessState, setAccessState] = useState<StudioAccessState>("checking");

  const verifyCustomer = useCallback(async () => {
    setAccessState(await resolveCustomerAccess());
  }, []);

  useEffect(() => {
    let active = true;
    void resolveCustomerAccess().then((nextState) => {
      if (active) {
        setAccessState(nextState);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  if (accessState === "unauthenticated") {
    return (
      <AuthRequired
        title="Please log in to open Datalog Analysis Studio"
        description="The detailed local analysis workspace is included for verified MG AutoTech customers."
        nextPath="/dashboard/log-analysis"
      />
    );
  }

  if (accessState === "unavailable") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] px-4 text-white">
        <section className="w-full max-w-lg border-y border-white/10 py-10 text-center">
          <RefreshCcw className="mx-auto h-8 w-8 text-red-500" />
          <h1 className="mt-5 text-2xl font-black">Customer verification is taking longer</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-zinc-400">
            The private Studio stays closed until your account can be verified securely.
          </p>
          <button
            type="button"
            onClick={() => {
              setAccessState("checking");
              void verifyCustomer();
            }}
            className="mt-6 inline-flex h-12 items-center justify-center rounded-lg bg-[#b1121b] px-5 text-sm font-black"
          >
            <RefreshCcw className="mr-2 h-4 w-4" /> Try again
          </button>
        </section>
      </main>
    );
  }

  if (accessState !== "verified") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] px-4 text-white">
        <div role="status" aria-live="polite" className="flex items-center gap-3 text-sm font-bold text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin text-red-500" />
          Verifying customer access...
        </div>
      </main>
    );
  }

  return <LogAnalysisStudio />;
}
