"use client";

import { useEffect } from "react";
import { RefreshCcw } from "lucide-react";
import { reportPlatformFailure } from "@/components/PlatformReliabilityMonitor";
import { recoveryTranslations, useRecoveryLocale } from "@/lib/i18n/recovery-translations";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const locale = useRecoveryLocale();
  const copy = locale ? recoveryTranslations[locale] : null;
  useEffect(() => {
    reportPlatformFailure("fatal_render", error);
  }, [error]);

  if (!locale || !copy) {
    return (
      <main
        aria-busy="true"
        className="grid min-h-screen place-items-center bg-[#050505] px-4 text-white"
      >
        <span className="text-sm font-black tracking-[0.18em]">MG AUTOTECH</span>
      </main>
    );
  }

  return (
    <main lang={locale} className="grid min-h-screen place-items-center bg-[#050505] px-4 text-white">
      <section className="w-full max-w-lg border-y border-white/10 py-10 text-center">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-red-400">{copy.eyebrow}</p>
        <h1 className="mt-3 text-2xl font-black">{copy.title}</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-zinc-400">{copy.description}</p>
        <button type="button" onClick={reset} className="mt-6 inline-flex h-12 items-center rounded-lg bg-[#b1121b] px-5 text-sm font-black">
          <RefreshCcw className="mr-2 h-4 w-4" /> {copy.retry}
        </button>
      </section>
    </main>
  );
}
