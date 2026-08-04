"use client";

import Script from "next/script";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  analyticsPreferencesEvent,
  buildPublicNavigationEvent,
  buildPublicPageView,
  denyGoogleAnalytics,
  dispatchPublicAnalyticsEvent,
  initializeGoogleAnalytics,
  isApprovedAnalyticsHost,
  isPublicAnalyticsPath,
  isValidGoogleAnalyticsMeasurementId,
  readAnalyticsConsent,
  writeAnalyticsConsent,
  type AnalyticsConsent,
} from "@/lib/publicAnalytics";
import { clearGrowthVisitorId, recordGrowthAttributionTouch } from "@/lib/growth/publicClient";

type ConsentState = AnalyticsConsent | "unknown" | "loading";

export function PublicAnalytics({ measurementId }: { measurementId: string }) {
  const pathname = usePathname();
  const configured = isValidGoogleAnalyticsMeasurementId(measurementId);
  const [hostApproved, setHostApproved] = useState(false);
  const publicRoute = isPublicAnalyticsPath(pathname);
  const requestFlowRoute = pathname === "/new-request";
  const analyticsRouteAllowed = publicRoute || requestFlowRoute;
  const [consent, setConsent] = useState<ConsentState>("loading");
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const lastPageViewRef = useRef("");
  const lastAttributionPathRef = useRef("");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setHostApproved(isApprovedAnalyticsHost(window.location.hostname));
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!configured || !hostApproved) return;
    const timeout = window.setTimeout(() => {
      setConsent(readAnalyticsConsent() ?? "unknown");
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [configured, hostApproved]);

  useEffect(() => {
    const openPreferences = () => setPreferencesOpen(true);
    window.addEventListener(analyticsPreferencesEvent, openPreferences);
    return () => window.removeEventListener(analyticsPreferencesEvent, openPreferences);
  }, []);

  useEffect(() => {
    if (!configured || !hostApproved || consent !== "granted") return;
    if (analyticsRouteAllowed) {
      initializeGoogleAnalytics(measurementId);
      return;
    }
    denyGoogleAnalytics();
  }, [analyticsRouteAllowed, configured, consent, hostApproved, measurementId]);

  useEffect(() => {
    if (!configured || !hostApproved || consent !== "granted") return;
    const event = buildPublicPageView(pathname);
    if (!event || lastPageViewRef.current === event.params.page_path) return;
    lastPageViewRef.current = event.params.page_path;
    dispatchPublicAnalyticsEvent(event);
  }, [configured, consent, hostApproved, pathname]);

  useEffect(() => {
    if (!configured || !hostApproved || consent !== "granted" || !publicRoute) return;
    if (lastAttributionPathRef.current === pathname) return;
    lastAttributionPathRef.current = pathname;
    void recordGrowthAttributionTouch();
  }, [configured, consent, hostApproved, pathname, publicRoute]);

  useEffect(() => {
    if (!configured || !hostApproved || consent !== "granted" || !publicRoute) return;

    const trackClick = (click: MouseEvent) => {
      if (click.defaultPrevented || click.button !== 0) return;
      const target = click.target instanceof Element ? click.target.closest("a[href]") : null;
      if (!(target instanceof HTMLAnchorElement)) return;
      dispatchPublicAnalyticsEvent(buildPublicNavigationEvent(pathname, target.href));
    };

    document.addEventListener("click", trackClick, { capture: true });
    return () => document.removeEventListener("click", trackClick, { capture: true });
  }, [configured, consent, hostApproved, pathname, publicRoute]);

  if (!configured || !hostApproved) return null;

  const updateConsent = (next: AnalyticsConsent) => {
    writeAnalyticsConsent(next);
    setConsent(next);
    setPreferencesOpen(false);
    if (next === "denied") {
      clearGrowthVisitorId();
      denyGoogleAnalytics();
    }
  };

  const showConsentPanel = publicRoute && (consent === "unknown" || preferencesOpen);

  return (
    <>
      {consent === "granted" && analyticsRouteAllowed && (
        <Script
          id="mg-google-analytics"
          src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`}
          strategy="afterInteractive"
        />
      )}

      {showConsentPanel && (
        <aside
          role="dialog"
          aria-modal="false"
          aria-labelledby="analytics-consent-title"
          className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-3xl rounded-lg border border-white/15 bg-[#0a0b0d]/[0.98] p-4 text-white shadow-2xl shadow-black/60 backdrop-blur-xl sm:p-5"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-red-800/40 bg-red-950/30 text-red-300">
              <BarChart3 className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="analytics-consent-title" className="text-base font-black">Optional analytics</h2>
              <p className="mt-1 text-sm leading-6 text-zinc-400">
                Analytics helps MG AutoTech understand public search traffic and improve the request flow. File names, vehicle details, account data and order IDs are never included.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => updateConsent("granted")}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#b1121b] px-4 text-sm font-black transition hover:bg-[#c91824] focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                >
                  Allow analytics
                </button>
                <button
                  type="button"
                  onClick={() => updateConsent("denied")}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/15 bg-white/[0.04] px-4 text-sm font-black transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  Necessary only
                </button>
                <Link href="/datenschutz" className="inline-flex min-h-11 items-center justify-center px-3 text-sm font-bold text-zinc-400 hover:text-white">
                  Privacy information
                </Link>
              </div>
            </div>
          </div>
        </aside>
      )}

      {publicRoute && consent !== "loading" && consent !== "unknown" && !preferencesOpen && (
        <button
          type="button"
          onClick={() => setPreferencesOpen(true)}
          aria-label="Open analytics preferences"
          title="Analytics preferences"
          className="fixed bottom-4 right-20 z-40 grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-[#11151c]/95 text-zinc-400 shadow-lg transition hover:border-red-800/50 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        </button>
      )}

      <span className="sr-only" aria-live="polite">
        {consent === "granted" ? "Optional analytics enabled." : consent === "denied" ? "Optional analytics disabled." : ""}
      </span>
    </>
  );
}
