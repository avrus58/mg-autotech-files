"use client";

import { Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import {
  flushPendingVerifiedConversions,
  googleMeasurementScriptLoadedEvent,
  isGoogleMeasurementScriptReady,
  pendingVerifiedConversionCount,
  sanitizeSensitiveMeasurementLocation,
} from "@/lib/publicAnalytics";
import {
  clearMeasurementCompletionDestination,
  readMeasurementCompletionDestination,
} from "@/lib/measurementCompletion";

const completionFailOpenMs = 8_000;
const completionRetryMs = 100;

export default function MeasurementCompletePage() {
  useEffect(() => {
    sanitizeSensitiveMeasurementLocation();
    const destination = readMeasurementCompletionDestination();
    let navigated = false;
    let flushing = false;
    let retryTimer: number | null = null;

    const navigate = () => {
      if (navigated) return;
      navigated = true;
      clearMeasurementCompletionDestination();
      window.location.replace(destination);
    };
    const flushAndNavigate = async () => {
      if (flushing || navigated) return;
      flushing = true;
      await flushPendingVerifiedConversions().catch(() => 0);
      flushing = false;
      if (pendingVerifiedConversionCount() === 0) {
        navigate();
        return;
      }
      retryTimer = window.setTimeout(
        () => void flushAndNavigate(),
        completionRetryMs
      );
    };
    const handleScriptLoaded = () => {
      void flushAndNavigate();
    };

    window.addEventListener(
      googleMeasurementScriptLoadedEvent,
      handleScriptLoaded
    );
    const failOpenTimer = window.setTimeout(navigate, completionFailOpenMs);
    if (pendingVerifiedConversionCount() === 0) navigate();
    else if (isGoogleMeasurementScriptReady()) void flushAndNavigate();

    return () => {
      window.clearTimeout(failOpenTimer);
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      window.removeEventListener(
        googleMeasurementScriptLoadedEvent,
        handleScriptLoaded
      );
    };
  }, []);

  const returnToDashboard = () => {
    clearMeasurementCompletionDestination();
    window.location.replace("/dashboard");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050505] px-4 text-white">
      <section
        aria-labelledby="measurement-complete-title"
        className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-7 text-center shadow-2xl shadow-black/40"
      >
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl border border-red-800/40 bg-red-950/25 text-red-300">
          <ShieldCheck className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 id="measurement-complete-title" className="mt-4 text-xl font-black">
          Finishing securely
        </h1>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Your verified action is complete. Returning you to the customer portal.
        </p>
        <Loader2
          className="mx-auto mt-5 h-5 w-5 animate-spin text-red-400"
          aria-label="Finishing"
        />
        <button
          type="button"
          onClick={returnToDashboard}
          className="mt-5 inline-flex min-h-10 items-center justify-center rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:border-red-500/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          Return to dashboard
        </button>
        <noscript>
          <p className="mt-4 text-sm leading-6 text-zinc-300">
            Automatic return requires JavaScript. You can safely continue to the{" "}
            <Link className="font-semibold text-white underline" href="/dashboard">
              customer dashboard
            </Link>
            .
          </p>
        </noscript>
      </section>
    </main>
  );
}
