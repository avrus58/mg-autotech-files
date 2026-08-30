"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { LocaleCode } from "@/lib/i18nConfig";
import type { PublicLogSnapshotCopy } from "@/lib/i18n/tool-client-copy-keys";

const PublicLogSnapshot = dynamic(
  () =>
    import("@/components/tools/PublicLogSnapshot").then(
      (module) => module.PublicLogSnapshot
    ),
  { ssr: false }
);

export function DeferredPerformanceTools({
  copy,
  locale,
}: {
  copy: PublicLogSnapshotCopy;
  locale: LocaleCode;
}) {
  const boundaryRef = useRef<HTMLDivElement | null>(null);
  const [nearViewport, setNearViewport] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const boundary = boundaryRef.current;
    if (!boundary) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setNearViewport(true);
        observer.disconnect();
      },
      { rootMargin: "320px 0px" }
    );

    observer.observe(boundary);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!nearViewport) return;

    const idleWindow = window as typeof window & {
      requestIdleCallback?: (
        callback: () => void,
        options?: { timeout: number }
      ) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (idleWindow.requestIdleCallback) {
      const handle = idleWindow.requestIdleCallback(() => setReady(true), {
        timeout: 1000,
      });
      return () => idleWindow.cancelIdleCallback?.(handle);
    }

    const timer = window.setTimeout(() => setReady(true), 180);
    return () => window.clearTimeout(timer);
  }, [nearViewport]);

  return (
    <div id="tools" ref={boundaryRef} className="scroll-mt-24">
      {ready ? (
        <PublicLogSnapshot copy={copy} locale={locale} />
      ) : (
        <section
          aria-busy="true"
          aria-label={copy["Free log snapshot loading"]}
          className="min-h-[32rem] border-y border-white/[0.07] bg-[#050506] px-4 py-14 sm:py-16"
        >
          <div className="mx-auto max-w-7xl animate-pulse">
            <div className="h-3 w-32 rounded bg-red-950/70" />
            <div className="mt-5 h-10 max-w-2xl rounded bg-white/[0.07]" />
            <div className="mt-3 h-4 max-w-2xl rounded bg-white/[0.04]" />
            <div className="mt-8 grid overflow-hidden rounded-[1.5rem] border border-white/5 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="h-64 border-b border-white/5 bg-white/[0.025] lg:border-b-0 lg:border-r" />
              <div className="h-64 bg-white/[0.018]" />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
