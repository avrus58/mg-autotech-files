"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const PerformanceTools = dynamic(
  () =>
    import("@/components/tools/PerformanceTools").then(
      (module) => module.PerformanceTools
    ),
  { ssr: false }
);

export function DeferredPerformanceTools() {
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
    <div ref={boundaryRef}>
      {ready ? (
        <PerformanceTools />
      ) : (
        <section
          aria-busy="true"
          aria-label="Workshop performance tools loading"
          className="min-h-[32rem] border-y border-white/5 bg-[#050505] px-4 py-14"
        >
          <div className="mx-auto max-w-7xl animate-pulse">
            <div className="h-3 w-32 rounded bg-red-950/70" />
            <div className="mt-5 h-10 max-w-xl rounded bg-white/[0.07]" />
            <div className="mt-3 h-4 max-w-2xl rounded bg-white/[0.04]" />
            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              <div className="h-72 rounded-2xl border border-white/5 bg-white/[0.025]" />
              <div className="h-72 rounded-2xl border border-white/5 bg-white/[0.025]" />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
