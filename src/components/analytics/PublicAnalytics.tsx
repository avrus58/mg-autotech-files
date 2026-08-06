"use client";

import Script from "next/script";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Megaphone, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  analyticsPreferencesEvent,
  buildPublicNavigationEvent,
  buildPublicPageView,
  denyGoogleMeasurement,
  dispatchPublicAnalyticsEvent,
  initializeGoogleMeasurement,
  isApprovedAnalyticsHost,
  isConversionMeasurementPath,
  isPublicAnalyticsPath,
  isValidGoogleAdsId,
  isValidGoogleAnalyticsMeasurementId,
  readMeasurementConsentSnapshot,
  writeMeasurementConsent,
  type GoogleAdsPublicConfiguration,
  type MeasurementConsentPreferences,
  type MeasurementConsentSnapshot,
} from "@/lib/publicAnalytics";
import { clearGrowthVisitorId, recordGrowthAttributionTouch } from "@/lib/growth/publicClient";
import { getAnalyticsConsentCopy } from "@/lib/analyticsConsentI18n";

type ConsentState = MeasurementConsentSnapshot | "loading";

type PublicAnalyticsProps = GoogleAdsPublicConfiguration;

function savedSnapshot(preferences: MeasurementConsentPreferences): MeasurementConsentSnapshot {
  return { preferences, source: "v2", needsDecision: false };
}

export function PublicAnalytics({
  googleAnalyticsMeasurementId,
  googleAdsId,
  registrationLabel,
  requestLabel,
  purchaseLabel,
}: PublicAnalyticsProps) {
  const pathname = usePathname();
  const configuration = useMemo<GoogleAdsPublicConfiguration>(() => ({
    googleAnalyticsMeasurementId,
    googleAdsId,
    registrationLabel,
    requestLabel,
    purchaseLabel,
  }), [googleAdsId, googleAnalyticsMeasurementId, purchaseLabel, registrationLabel, requestLabel]);
  const configured =
    isValidGoogleAnalyticsMeasurementId(googleAnalyticsMeasurementId) ||
    isValidGoogleAdsId(googleAdsId);
  const [hostApproved, setHostApproved] = useState(false);
  const publicRoute = isPublicAnalyticsPath(pathname);
  const analyticsRouteAllowed = publicRoute || isConversionMeasurementPath(pathname);
  const consentCopy = getAnalyticsConsentCopy(pathname);
  const [consent, setConsent] = useState<ConsentState>("loading");
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [draft, setDraft] = useState({ analytics: false, advertising: false });
  const lastPageViewRef = useRef("");
  const lastAttributionPathRef = useRef("");
  const preferences = consent === "loading" ? null : consent.preferences;

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setHostApproved(isApprovedAnalyticsHost(window.location.hostname));
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!configured || !hostApproved) return;
    const timeout = window.setTimeout(() => {
      const snapshot = readMeasurementConsentSnapshot();
      setConsent(snapshot);
      setDraft({
        analytics: snapshot.preferences.analytics,
        advertising: snapshot.preferences.advertising,
      });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [configured, hostApproved]);

  useEffect(() => {
    const openPreferences = () => {
      const snapshot = readMeasurementConsentSnapshot();
      setConsent(snapshot);
      setDraft({
        analytics: snapshot.preferences.analytics,
        advertising: snapshot.preferences.advertising,
      });
      setCustomizing(true);
      setPreferencesOpen(true);
    };
    window.addEventListener(analyticsPreferencesEvent, openPreferences);
    return () => window.removeEventListener(analyticsPreferencesEvent, openPreferences);
  }, []);

  useEffect(() => {
    if (!configured || !hostApproved || !preferences) return;
    if (analyticsRouteAllowed && (preferences.analytics || preferences.advertising)) {
      initializeGoogleMeasurement(configuration);
      return;
    }
    denyGoogleMeasurement();
  }, [analyticsRouteAllowed, configuration, configured, hostApproved, preferences]);

  useEffect(() => {
    if (!configured || !hostApproved || !preferences?.analytics) return;
    const event = buildPublicPageView(pathname);
    if (!event || lastPageViewRef.current === event.params.page_path) return;
    lastPageViewRef.current = event.params.page_path;
    dispatchPublicAnalyticsEvent(event);
  }, [configured, hostApproved, pathname, preferences?.analytics]);

  useEffect(() => {
    if (!configured || !hostApproved || !preferences?.analytics || !publicRoute) return;
    if (lastAttributionPathRef.current === pathname) return;
    lastAttributionPathRef.current = pathname;
    void recordGrowthAttributionTouch();
  }, [configured, hostApproved, pathname, preferences?.analytics, publicRoute]);

  useEffect(() => {
    if (!configured || !hostApproved || !preferences?.analytics || !publicRoute) return;

    const trackClick = (click: MouseEvent) => {
      if (click.defaultPrevented || click.button !== 0) return;
      const target = click.target instanceof Element ? click.target.closest("a[href]") : null;
      if (!(target instanceof HTMLAnchorElement)) return;
      dispatchPublicAnalyticsEvent(buildPublicNavigationEvent(pathname, target.href));
    };

    document.addEventListener("click", trackClick, { capture: true });
    return () => document.removeEventListener("click", trackClick, { capture: true });
  }, [configured, hostApproved, pathname, preferences?.analytics, publicRoute]);

  if (!configured || !hostApproved) return null;

  const updateConsent = (next: { analytics: boolean; advertising: boolean }) => {
    writeMeasurementConsent(next);
    const stored = readMeasurementConsentSnapshot().preferences;
    setConsent(savedSnapshot(stored));
    setDraft(next);
    setPreferencesOpen(false);
    setCustomizing(false);
    if (!next.analytics) clearGrowthVisitorId();
    if (!next.analytics && !next.advertising) denyGoogleMeasurement();
  };

  const showConsentPanel = publicRoute && (
    preferencesOpen || (consent !== "loading" && consent.needsDecision)
  );
  const scriptId = preferences?.analytics && isValidGoogleAnalyticsMeasurementId(googleAnalyticsMeasurementId)
    ? googleAnalyticsMeasurementId
    : preferences?.advertising && isValidGoogleAdsId(googleAdsId)
      ? googleAdsId
      : "";

  return (
    <>
      {scriptId && analyticsRouteAllowed ? (
        <Script
          id="mg-google-measurement"
          src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(scriptId)}`}
          strategy="afterInteractive"
        />
      ) : null}

      {showConsentPanel ? (
        <aside
          role="dialog"
          aria-modal="false"
          aria-labelledby="analytics-consent-title"
          className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-3xl rounded-lg border border-white/15 bg-[#0a0b0d]/[0.98] p-4 text-white shadow-2xl shadow-black/60 backdrop-blur-xl sm:p-5"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-red-800/40 bg-red-950/30 text-red-300">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="analytics-consent-title" className="text-base font-black">{consentCopy.title}</h2>
              <p className="mt-1 text-sm leading-6 text-zinc-400">{consentCopy.description}</p>

              {customizing ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <input
                      type="checkbox"
                      checked={draft.analytics}
                      onChange={(event) => setDraft((current) => ({ ...current, analytics: event.target.checked }))}
                      className="mt-1 h-4 w-4 accent-red-600"
                    />
                    <span>
                      <span className="flex items-center gap-2 text-sm font-black"><BarChart3 className="h-4 w-4 text-red-400" />{consentCopy.analyticsLabel}</span>
                      <span className="mt-1 block text-xs leading-5 text-zinc-500">{consentCopy.analyticsDescription}</span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <input
                      type="checkbox"
                      checked={draft.advertising}
                      onChange={(event) => setDraft((current) => ({ ...current, advertising: event.target.checked }))}
                      className="mt-1 h-4 w-4 accent-red-600"
                    />
                    <span>
                      <span className="flex items-center gap-2 text-sm font-black"><Megaphone className="h-4 w-4 text-red-400" />{consentCopy.advertisingLabel}</span>
                      <span className="mt-1 block text-xs leading-5 text-zinc-500">{consentCopy.advertisingDescription}</span>
                    </span>
                  </label>
                  <p className="text-xs font-bold text-emerald-300 sm:col-span-2">{consentCopy.personalizationDisabled}</p>
                </div>
              ) : null}

              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {customizing ? (
                  <button
                    type="button"
                    onClick={() => updateConsent(draft)}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#b1121b] px-4 text-sm font-black transition hover:bg-[#c91824] focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                  >
                    {consentCopy.savePreferences}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => updateConsent({ analytics: true, advertising: true })}
                      className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#b1121b] px-4 text-sm font-black transition hover:bg-[#c91824] focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                    >
                      {consentCopy.acceptAll}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateConsent({ analytics: true, advertising: false })}
                      className="inline-flex min-h-11 items-center justify-center rounded-lg border border-red-800/50 bg-red-950/20 px-4 text-sm font-black transition hover:bg-red-950/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                    >
                      {consentCopy.analyticsOnly}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => updateConsent({ analytics: false, advertising: false })}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/15 bg-white/[0.04] px-4 text-sm font-black transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  {consentCopy.necessaryOnly}
                </button>
                {!customizing ? (
                  <button
                    type="button"
                    onClick={() => setCustomizing(true)}
                    className="inline-flex min-h-11 items-center justify-center px-3 text-sm font-bold text-zinc-400 hover:text-white"
                  >
                    {consentCopy.customize}
                  </button>
                ) : null}
                <Link href="/datenschutz" className="inline-flex min-h-11 items-center justify-center px-3 text-sm font-bold text-zinc-400 hover:text-white">
                  {consentCopy.privacyInformation}
                </Link>
              </div>
            </div>
          </div>
        </aside>
      ) : null}

      {publicRoute && consent !== "loading" && !consent.needsDecision && !preferencesOpen ? (
        <button
          type="button"
          onClick={() => {
            setCustomizing(true);
            setPreferencesOpen(true);
          }}
          aria-label={consentCopy.openPreferences}
          title={consentCopy.preferencesTitle}
          className="fixed bottom-4 right-20 z-40 grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-[#11151c]/95 text-zinc-400 shadow-lg transition hover:border-red-800/50 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}

      <span className="sr-only" aria-live="polite">
        {preferences?.analytics || preferences?.advertising
          ? consentCopy.enabledAnnouncement
          : consent === "loading" || consent.needsDecision
            ? ""
            : consentCopy.disabledAnnouncement}
      </span>
    </>
  );
}
