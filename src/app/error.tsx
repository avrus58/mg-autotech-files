"use client";

import { useEffect } from "react";
import { RefreshCcw } from "lucide-react";
import { reportPlatformFailure } from "@/components/PlatformReliabilityMonitor";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportPlatformFailure("fatal_render", error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#050505] px-4 text-white">
      <section className="w-full max-w-lg border-y border-white/10 py-10 text-center">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-red-400">Workspace recovery</p>
        <h1 className="mt-3 text-2xl font-black">This view needs a clean reload</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-zinc-400">
          Your request data was not changed. Retry the view; persistent failures are recorded without file or account details.
        </p>
        <button type="button" onClick={reset} className="mt-6 inline-flex h-12 items-center rounded-lg bg-[#b1121b] px-5 text-sm font-black">
          <RefreshCcw className="mr-2 h-4 w-4" /> Retry view
        </button>
      </section>
    </main>
  );
}
