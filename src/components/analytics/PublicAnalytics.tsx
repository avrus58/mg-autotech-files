"use client";

import Script from "next/script";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Megaphone, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  applyStoredMeasurementConsent,
  applyExternalMeasurementConsentChange,
  analyticsPreferencesEvent,
  buildPublicNavigationEvent,
  buildPublicPageView,
  denyGoogleMeasurement,
  dispatchPublicAnalyticsEvent,
  dispatchPublicAnalyticsEventWithAck,
  flushGoogleAdsConversionOutbox,
  flushPendingVerifiedConversions,
  getPrivateDocumentNavigation,
  googleAdsLinkerSettleMs,
  hasSensitiveMeasurementLocation,
  initializeGoogleMeasurement,
  isGoogleAdsLinkerConfigurationReady,
  isGoogleMeasurementScriptPath,
  isApprovedAnalyticsHost,
  isConversionMeasurementPath,
  isFirstPartyAttributionPublicPath,
  isMeasurementConsentPath,
  isPublicAnalyticsPath,
  isValidGoogleAdsId,
  isValidGoogleAnalyticsMeasurementId,
  measurementConsentStorageKey,
  measurementLocationSanitizedEvent,
  notifyMeasurementConsentChanged,
  notifyGoogleMeasurementScriptFailed,
  notifyGoogleMeasurementScriptLoaded,
  readMeasurementConsentSnapshot,
  reconcileRestoredMeasurementConsent,
  replaceGoogleMeasurementDocumentAfterConsentWithdrawal,
  sanitizeGoogleMeasurementBrowserLocation,
  writeMeasurementConsent,
  type GoogleAdsPublicConfiguration,
  type MeasurementConsentPreferences,
  type MeasurementConsentSnapshot,
} from "@/lib/publicAnalytics";
import {
  createAdClickConsentGateController,
  consumePreHydrationAdClickNavigation,
  getAdClickConsentNavigation,
  hasGoogleAdsLinkerState,
  isAdClickConsentLanding,
  isUnmodifiedSelfNavigation,
  waitForGoogleAdsLinkerReady,
  type AdClickConsentChoice,
} from "@/lib/adClickConsentGate";
import {
  captureGrowthAttributionTouch,
  clearGrowthVisitorId,
  flushGrowthAttributionOutbox,
  recordGrowthAttributionTouch,
} from "@/lib/growth/publicClient";
import {
  growthAttributionTouchKey,
  selectGrowthAttributionTouchesForRoute,
} from "@/lib/growth/attribution";
import type { GrowthAttributionTouch } from "@/lib/growth/types";
import { subscribeGrowthConsentInvalidation } from "@/lib/growth/consentLifecycle";
import { getAnalyticsConsentCopy } from "@/lib/analyticsConsentI18n";
import { reportMeasurementHandoffFailure } from "@/components/PlatformReliabilityMonitor";

type ConsentState = MeasurementConsentSnapshot | "loading";

type PublicAnalyticsProps = GoogleAdsPublicConfiguration;
const googleMeasurementScriptRetryDelays = [2_500, 10_000] as const;
const immediateConsentChoiceClassName =
  "inline-flex min-h-11 items-center justify-center rounded-lg border border-white/15 bg-white/[0.04] px-4 text-sm font-black text-white transition hover:border-red-700/60 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500";

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
  const [paidClickLanding, setPaidClickLanding] = useState(false);
  const publicRoute = isPublicAnalyticsPath(pathname);
  const attributionPublicRoute = isFirstPartyAttributionPublicPath(pathname);
  const analyticsRouteAllowed = isMeasurementConsentPath(pathname);
  const googleMeasurementRouteAllowed = isGoogleMeasurementScriptPath(pathname);
  const attributionRouteAllowed =
    attributionPublicRoute || isConversionMeasurementPath(pathname);
  const consentCopy = getAnalyticsConsentCopy(pathname);
  const [consent, setConsent] = useState<ConsentState>("loading");
  const [measurementReady, setMeasurementReady] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [pendingAdClickDestination, setPendingAdClickDestination] = useState<
    string | null
  >(null);
  const [customizing, setCustomizing] = useState(false);
  const [draft, setDraft] = useState({ analytics: false, advertising: false });
  const lastAppliedPreferencesRef = useRef<Pick<
    MeasurementConsentPreferences,
    "analytics" | "advertising"
  >>({ analytics: false, advertising: false });
  const lastPageViewRef = useRef("");
  const lastAttributionPathRef = useRef("");
  const initialAttributionTouchRef = useRef<GrowthAttributionTouch | null>(null);
  const sentAttributionTouchesRef = useRef(new Set<string>());
  const measurementScriptStateRef = useRef<"idle" | "loading" | "loaded" | "failed">("idle");
  const measurementScriptRetryCountRef = useRef(0);
  const measurementScriptRetryTimerRef = useRef<number | null>(null);
  const adClickGateControllerRef = useRef<ReturnType<
    typeof createAdClickConsentGateController
  > | null>(null);
  const adClickGateDialogRef = useRef<HTMLElement | null>(null);
  const [measurementScriptAttempt, setMeasurementScriptAttempt] = useState(0);
  const preferences = consent === "loading" ? null : consent.preferences;
  const scriptId = preferences?.analytics && isValidGoogleAnalyticsMeasurementId(googleAnalyticsMeasurementId)
    ? googleAnalyticsMeasurementId
    : preferences?.advertising && isValidGoogleAdsId(googleAdsId)
      ? googleAdsId
      : "";

  useEffect(() => subscribeGrowthConsentInvalidation(() => {
    lastPageViewRef.current = "";
    lastAttributionPathRef.current = "";
    initialAttributionTouchRef.current = null;
    sentAttributionTouchesRef.current = new Set<string>();

    const snapshot = readMeasurementConsentSnapshot();
    if (
      !snapshot.preferences.analytics ||
      !isApprovedAnalyticsHost(window.location.hostname) ||
      hasSensitiveMeasurementLocation(window.location.href) ||
      !isFirstPartyAttributionPublicPath(window.location.pathname)
    ) return;

    const nextInitialTouch = captureGrowthAttributionTouch();
    if (
      nextInitialTouch &&
      isFirstPartyAttributionPublicPath(nextInitialTouch.landingPath)
    ) {
      initialAttributionTouchRef.current = nextInitialTouch;
    }
  }), []);

  useEffect(() => {
    if (
      isApprovedAnalyticsHost(window.location.hostname) &&
      !hasSensitiveMeasurementLocation(window.location.href)
    ) {
      const initialTouch = captureGrowthAttributionTouch();
      if (
        initialTouch &&
        isFirstPartyAttributionPublicPath(initialTouch.landingPath)
      ) {
        initialAttributionTouchRef.current = initialTouch;
      }
    }
    const refreshApproval = () => {
      const approved =
        isApprovedAnalyticsHost(window.location.hostname) &&
        !hasSensitiveMeasurementLocation(window.location.href);
      setPaidClickLanding(
        approved &&
          isGoogleMeasurementScriptPath(window.location.pathname) &&
          isAdClickConsentLanding(window.location.href)
      );
      setHostApproved(approved);
    };
    const timeout = window.setTimeout(refreshApproval, 0);
    window.addEventListener(measurementLocationSanitizedEvent, refreshApproval);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener(measurementLocationSanitizedEvent, refreshApproval);
    };
  }, []);

  useEffect(() => {
    const reconcileRestoredDocument = () => {
      const previous = lastAppliedPreferencesRef.current;
      const snapshot = reconcileRestoredMeasurementConsent();
      if (!snapshot.preferences.analytics) clearGrowthVisitorId();
      if (
        replaceGoogleMeasurementDocumentAfterConsentWithdrawal(
          previous,
          snapshot.preferences
        )
      ) return;
      lastAppliedPreferencesRef.current = snapshot.preferences;
      setConsent(snapshot);
      setDraft({
        analytics: snapshot.preferences.analytics,
        advertising: snapshot.preferences.advertising,
      });
    };
    const reconcileVisibleDocument = () => {
      if (document.visibilityState === "visible") reconcileRestoredDocument();
    };

    window.addEventListener("pageshow", reconcileRestoredDocument);
    document.addEventListener("visibilitychange", reconcileVisibleDocument);
    return () => {
      window.removeEventListener("pageshow", reconcileRestoredDocument);
      document.removeEventListener("visibilitychange", reconcileVisibleDocument);
    };
  }, []);

  useEffect(() => {
    if (!configured || !hostApproved) return;
    const timeout = window.setTimeout(() => {
      const snapshot = readMeasurementConsentSnapshot();
      lastAppliedPreferencesRef.current = snapshot.preferences;
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
      lastAppliedPreferencesRef.current = snapshot.preferences;
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
    const synchronizeCrossTabConsent = (event: StorageEvent) => {
      if (event.key !== null && event.key !== measurementConsentStorageKey) return;
      const previous = lastAppliedPreferencesRef.current;
      const snapshot = applyExternalMeasurementConsentChange(event.newValue);
      applyStoredMeasurementConsent(snapshot.preferences);
      notifyMeasurementConsentChanged();
      if (!snapshot.preferences.analytics) clearGrowthVisitorId();
      if (
        replaceGoogleMeasurementDocumentAfterConsentWithdrawal(
          previous,
          snapshot.preferences
        )
      ) return;
      lastAppliedPreferencesRef.current = snapshot.preferences;
      setConsent(snapshot);
      setDraft({
        analytics: snapshot.preferences.analytics,
        advertising: snapshot.preferences.advertising,
      });
    };
    window.addEventListener("storage", synchronizeCrossTabConsent);
    return () => window.removeEventListener("storage", synchronizeCrossTabConsent);
  }, []);

  useEffect(() => {
    if (
      !configured ||
      !isValidGoogleAdsId(googleAdsId) ||
      !publicRoute ||
      !googleMeasurementRouteAllowed ||
      !paidClickLanding
    ) {
      if (hostApproved && paidClickLanding) {
        const guardedWindow = window as Window & {
          __mgReleasePaidClickHydrationGuard?: () => void;
          __mgPendingPaidClickDestination?: string;
        };
        const pendingDestination = guardedWindow.__mgPendingPaidClickDestination;
        delete guardedWindow.__mgPendingPaidClickDestination;
        guardedWindow.__mgReleasePaidClickHydrationGuard?.();
        if (pendingDestination) {
          consumePreHydrationAdClickNavigation({
            pendingDestination,
            currentHref: window.location.href,
            begin: () => false,
            navigate: (destination) => window.location.assign(destination),
          });
        }
      }
      return;
    }

    const controller = createAdClickConsentGateController({
      readConsent: () => {
        const snapshot = readMeasurementConsentSnapshot();
        lastAppliedPreferencesRef.current = snapshot.preferences;
        setConsent(snapshot);
        setDraft({
          analytics: snapshot.preferences.analytics,
          advertising: snapshot.preferences.advertising,
        });
        return snapshot;
      },
      persistConsent: (next) => {
        const previous = lastAppliedPreferencesRef.current;
        const applied = writeMeasurementConsent(next);
        if (!next.analytics) clearGrowthVisitorId();
        if (
          applied &&
          replaceGoogleMeasurementDocumentAfterConsentWithdrawal(
            previous,
            applied
          )
        ) return;
        if (applied) {
          lastAppliedPreferencesRef.current = applied;
          setConsent(savedSnapshot(applied));
        }
        setDraft(next);
        setPreferencesOpen(false);
        setCustomizing(false);
        if (!next.analytics && !next.advertising) denyGoogleMeasurement();
      },
      configureMeasurement: () => {
        initializeGoogleMeasurement(configuration);
      },
      prepareConsentedNavigation: async (destination, _preferences, signal) => {
        const event = buildPublicNavigationEvent(pathname, destination);
        const touches = selectGrowthAttributionTouchesForRoute({
          pathname,
          initialTouch: initialAttributionTouchRef.current,
          currentTouch: attributionPublicRoute
            ? captureGrowthAttributionTouch()
            : null,
        });
        const touchAcks = touches.map(async (touch) => {
          const acknowledged = await recordGrowthAttributionTouch(touch, {
            timeoutMs: 1_800,
          });
          if (acknowledged) {
            sentAttributionTouchesRef.current.add(growthAttributionTouchKey(touch));
          } else {
            reportMeasurementHandoffFailure("attribution_handoff");
          }
          return acknowledged;
        });
        await Promise.allSettled([
          dispatchPublicAnalyticsEventWithAck(event, { signal, timeoutMs: 2_000 }),
          ...touchAcks,
        ]);
      },
      waitForAdsReady: async (signal) => {
        const result = await waitForGoogleAdsLinkerReady({
          signal,
          isReady: () =>
            isGoogleAdsLinkerConfigurationReady(googleAdsId) &&
            hasGoogleAdsLinkerState(),
        });
        if (result === "timeout") {
          reportMeasurementHandoffFailure("ads_linker");
        }
        return result;
      },
      navigate: (destination) => window.location.assign(destination),
      onPendingChange: (destination) => {
        setPendingAdClickDestination(destination);
        if (destination) {
          setPreferencesOpen(false);
          setCustomizing(false);
        }
      },
    });
    adClickGateControllerRef.current = controller;

    const interceptAdClickNavigation = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.getAttribute("aria-disabled") === "true") return;
      if (!isUnmodifiedSelfNavigation({
        button: event.button,
        defaultPrevented: event.defaultPrevented,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        target: anchor.getAttribute("target"),
        download: anchor.hasAttribute("download"),
      })) return;
      const navigation = getAdClickConsentNavigation(
        anchor.href,
        window.location.href
      );
      if (!navigation) return;
      if (navigation.opensPrivacyInNewTab) {
        anchor.setAttribute("target", "_blank");
        anchor.setAttribute("rel", "noopener noreferrer");
        return;
      }
      // The first same-origin navigation from a paid landing stays behind the
      // same bounded choice gate. This lets Ads initialize from the current
      // click signal without persisting or copying that signal to another URL.
      if (!controller.begin(navigation.destination)) return;
      event.preventDefault();
      event.stopPropagation();
    };

    document.addEventListener("click", interceptAdClickNavigation, true);
    const guardedWindow = window as Window & {
      __mgReleasePaidClickHydrationGuard?: () => void;
      __mgPendingPaidClickDestination?: string;
    };
    const pendingPreHydrationDestination =
      guardedWindow.__mgPendingPaidClickDestination;
    delete guardedWindow.__mgPendingPaidClickDestination;
    if (pendingPreHydrationDestination) {
      consumePreHydrationAdClickNavigation({
        pendingDestination: pendingPreHydrationDestination,
        currentHref: window.location.href,
        begin: controller.begin,
        navigate: (destination) => window.location.assign(destination),
      });
    }
    const releasePreHydrationGuard = guardedWindow.__mgReleasePaidClickHydrationGuard;
    releasePreHydrationGuard?.();
    return () => {
      document.removeEventListener("click", interceptAdClickNavigation, true);
      controller.dispose();
      if (adClickGateControllerRef.current === controller) {
        adClickGateControllerRef.current = null;
      }
    };
  }, [
    configuration,
    configured,
    googleAdsId,
    googleMeasurementRouteAllowed,
    hostApproved,
    paidClickLanding,
    pathname,
    attributionPublicRoute,
    publicRoute,
  ]);

  useEffect(() => {
    if (!configured || !hostApproved || !preferences?.analytics || !publicRoute) return;

    // Register the synchronous, sanitized CTA observation before the document
    // boundary guard. The guard prevents the SPA transition immediately after
    // this listener, so Google still never survives into a private document.
    const trackClick = (click: MouseEvent) => {
      if (click.defaultPrevented || click.button !== 0) return;
      const target = click.target instanceof Element ? click.target.closest("a[href]") : null;
      if (!(target instanceof HTMLAnchorElement)) return;
      dispatchPublicAnalyticsEvent(buildPublicNavigationEvent(pathname, target.href));
    };

    document.addEventListener("click", trackClick, { capture: true });
    return () => document.removeEventListener("click", trackClick, { capture: true });
  }, [configured, hostApproved, pathname, preferences?.analytics, publicRoute]);

  useEffect(() => {
    if (!hostApproved) return;
    const forcePrivateDocumentNavigation = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (!isUnmodifiedSelfNavigation({
        button: event.button,
        defaultPrevented: event.defaultPrevented,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        target: anchor.getAttribute("target"),
        download: anchor.hasAttribute("download"),
      })) return;
      const destination = getPrivateDocumentNavigation(
        anchor.href,
        window.location.href
      );
      if (!destination) return;
      event.preventDefault();
      event.stopPropagation();
      window.location.assign(destination);
    };
    document.addEventListener("click", forcePrivateDocumentNavigation, true);
    return () => {
      document.removeEventListener("click", forcePrivateDocumentNavigation, true);
    };
  }, [hostApproved]);

  useEffect(() => {
    if (!pendingAdClickDestination) return;
    const dialog = adClickGateDialogRef.current;
    const backgroundElements = [...document.body.children].filter(
      (element): element is HTMLElement =>
        element instanceof HTMLElement &&
        Boolean(dialog) &&
        !element.contains(dialog)
    );
    const backgroundState = backgroundElements.map((element) => ({
      element,
      ariaHidden: element.getAttribute("aria-hidden"),
      inert: element.inert,
    }));
    for (const { element } of backgroundState) {
      element.inert = true;
      element.setAttribute("aria-hidden", "true");
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const focusable = () =>
      [...(dialog?.querySelectorAll<HTMLElement>(
        "button:not([disabled]), a[href]"
      ) ?? [])];
    const focusFrame = window.requestAnimationFrame(() => {
      focusable()[0]?.focus();
    });
    const keepDialogAccessible = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        adClickGateControllerRef.current?.cancel();
        return;
      }
      if (event.key !== "Tab") return;
      const candidates = focusable();
      if (candidates.length === 0) return;
      const first = candidates[0];
      const last = candidates[candidates.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keepDialogAccessible);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", keepDialogAccessible);
      document.body.style.overflow = previousOverflow;
      for (const { element, ariaHidden, inert } of backgroundState) {
        element.inert = inert;
        if (ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", ariaHidden);
      }
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [pendingAdClickDestination]);

  useEffect(() => {
    let active = true;
    const updateMeasurementReady = (ready: boolean) => {
      queueMicrotask(() => {
        if (active) setMeasurementReady(ready);
      });
    };

    if (!configured || !hostApproved || !preferences) {
      updateMeasurementReady(false);
      return () => {
        active = false;
      };
    }
    if (
      googleMeasurementRouteAllowed &&
      (preferences.analytics || preferences.advertising)
    ) {
      const initialized = initializeGoogleMeasurement(configuration);
      updateMeasurementReady(
        initialized &&
          sanitizeGoogleMeasurementBrowserLocation({
            advertising: preferences.advertising,
          })
      );
      return () => {
        active = false;
      };
    }
    denyGoogleMeasurement();
    updateMeasurementReady(false);
    return () => {
      active = false;
    };
  }, [configuration, configured, googleMeasurementRouteAllowed, hostApproved, preferences]);

  useEffect(() => {
    if (!configured || !hostApproved || !preferences?.analytics) return;
    const event = buildPublicPageView(pathname);
    if (!event || lastPageViewRef.current === event.params.page_path) return;
    lastPageViewRef.current = event.params.page_path;
    dispatchPublicAnalyticsEvent(event);
  }, [configured, hostApproved, pathname, preferences?.analytics]);

  useEffect(() => {
    if (!configured || !hostApproved || !preferences?.analytics || !attributionRouteAllowed) return;
    if (lastAttributionPathRef.current === pathname) return;

    let cancelled = false;
    let inFlight = false;
    let attempts = 0;
    let retryTimer: number | null = null;

    const sendTouches = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;
      const recoveredTouchKeys = await flushGrowthAttributionOutbox({
        timeoutMs: 1_800,
      });
      for (const key of recoveredTouchKeys) {
        sentAttributionTouchesRef.current.add(key);
      }
      if (cancelled) return;
      // Conversion routes may persist only the public first touch held in memory.
      // Never derive a current touch from a private account, request or payment path.
      const currentTouch = attributionPublicRoute
        ? captureGrowthAttributionTouch()
        : null;
      const touches = selectGrowthAttributionTouchesForRoute({
        pathname,
        initialTouch: initialAttributionTouchRef.current,
        currentTouch,
      });
      let completed = true;

      for (const touch of touches) {
        const key = growthAttributionTouchKey(touch);
        if (sentAttributionTouchesRef.current.has(key)) continue;
        const acknowledged = await recordGrowthAttributionTouch(touch);
        if (cancelled) return;
        if (!acknowledged) {
          completed = false;
          break;
        }
        // Only an explicit persistence acknowledgement may suppress retries.
        sentAttributionTouchesRef.current.add(key);
      }

      inFlight = false;
      if (completed) {
        lastAttributionPathRef.current = pathname;
        return;
      }
      attempts += 1;
      if (attempts <= 3) {
        retryTimer = window.setTimeout(
          () => void sendTouches(),
          Math.min(8_000, 1_500 * 2 ** (attempts - 1))
        );
      }
    };

    const retryWhenOnline = () => {
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      retryTimer = null;
      attempts = 0;
      void sendTouches();
    };

    void sendTouches();
    window.addEventListener("online", retryWhenOnline);
    return () => {
      cancelled = true;
      window.removeEventListener("online", retryWhenOnline);
      if (retryTimer !== null) window.clearTimeout(retryTimer);
    };
  }, [
    attributionPublicRoute,
    attributionRouteAllowed,
    configured,
    hostApproved,
    pathname,
    preferences?.analytics,
  ]);

  useEffect(() => {
    if (!measurementReady || !scriptId || !googleMeasurementRouteAllowed) {
      if (measurementScriptRetryTimerRef.current !== null) {
        window.clearTimeout(measurementScriptRetryTimerRef.current);
        measurementScriptRetryTimerRef.current = null;
      }
      return;
    }
    if (measurementScriptStateRef.current === "failed") {
      measurementScriptRetryCountRef.current = 0;
      measurementScriptStateRef.current = "loading";
      setMeasurementScriptAttempt((current) => current + 1);
    } else if (measurementScriptStateRef.current === "idle") {
      measurementScriptStateRef.current = "loading";
    }
  }, [googleMeasurementRouteAllowed, measurementReady, scriptId]);

  useEffect(() => {
    if (
      !configured ||
      !hostApproved ||
      (!preferences?.analytics && !preferences?.advertising)
    ) return;
    const retryPendingConversions = () => {
      if (
        measurementScriptStateRef.current === "failed" &&
        googleMeasurementRouteAllowed
      ) {
        if (measurementScriptRetryTimerRef.current !== null) {
          window.clearTimeout(measurementScriptRetryTimerRef.current);
          measurementScriptRetryTimerRef.current = null;
        }
        measurementScriptRetryCountRef.current = 0;
        measurementScriptStateRef.current = "loading";
        setMeasurementScriptAttempt((current) => current + 1);
        return;
      }
      if (preferences.advertising) {
        void flushGoogleAdsConversionOutbox().catch(() => 0);
      }
      if (googleMeasurementRouteAllowed) {
        void flushPendingVerifiedConversions().catch(() => 0);
      }
    };
    window.addEventListener("online", retryPendingConversions);
    return () => window.removeEventListener("online", retryPendingConversions);
  }, [
    configured,
    googleMeasurementRouteAllowed,
    hostApproved,
    preferences?.advertising,
    preferences?.analytics,
  ]);

  useEffect(() => () => {
    if (measurementScriptRetryTimerRef.current !== null) {
      window.clearTimeout(measurementScriptRetryTimerRef.current);
    }
  }, []);

  if (!configured || !hostApproved) return null;

  const updateConsent = (next: { analytics: boolean; advertising: boolean }) => {
    const previous = lastAppliedPreferencesRef.current;
    const applied = writeMeasurementConsent(next);
    if (!next.analytics) clearGrowthVisitorId();
    if (
      applied &&
      replaceGoogleMeasurementDocumentAfterConsentWithdrawal(
        previous,
        applied
      )
    ) return;
    if (applied) {
      lastAppliedPreferencesRef.current = applied;
      setConsent(savedSnapshot(applied));
    }
    setDraft(next);
    setPreferencesOpen(false);
    setCustomizing(false);
    if (!next.analytics && !next.advertising) denyGoogleMeasurement();
  };

  const showAdClickConsentGate = Boolean(pendingAdClickDestination);
  const showConsentPanel = !showAdClickConsentGate && (
    preferencesOpen ||
    (analyticsRouteAllowed && consent !== "loading" && consent.needsDecision)
  );
  const chooseAdClickConsent = (choice: AdClickConsentChoice) => {
    adClickGateControllerRef.current?.choose(choice);
  };
  return (
    <>
      {measurementReady && scriptId && googleMeasurementRouteAllowed ? (
        <Script
          key={`${scriptId}-${measurementScriptAttempt}`}
          id={`mg-google-measurement-${measurementScriptAttempt}`}
          src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(scriptId)}&mg_retry_attempt=${measurementScriptAttempt}`}
          strategy="afterInteractive"
          onLoad={() => {
            measurementScriptStateRef.current = "loaded";
            measurementScriptRetryCountRef.current = 0;
            if (measurementScriptRetryTimerRef.current !== null) {
              window.clearTimeout(measurementScriptRetryTimerRef.current);
              measurementScriptRetryTimerRef.current = null;
            }
            void notifyGoogleMeasurementScriptLoaded().catch(() => 0);
            window.setTimeout(() => {
              void flushGoogleAdsConversionOutbox().catch(() => 0);
              void flushPendingVerifiedConversions().catch(() => 0);
            }, googleAdsLinkerSettleMs);
          }}
          onError={() => {
            measurementScriptStateRef.current = "failed";
            notifyGoogleMeasurementScriptFailed();
            const retryIndex = measurementScriptRetryCountRef.current;
            const retryDelay = googleMeasurementScriptRetryDelays[retryIndex];
            if (retryDelay === undefined || measurementScriptRetryTimerRef.current !== null) return;
            measurementScriptRetryCountRef.current = retryIndex + 1;
            measurementScriptRetryTimerRef.current = window.setTimeout(() => {
              measurementScriptRetryTimerRef.current = null;
              if (
                !isGoogleMeasurementScriptPath(window.location.pathname)
              ) {
                return;
              }
              measurementScriptStateRef.current = "loading";
              setMeasurementScriptAttempt((current) => current + 1);
            }, retryDelay);
          }}
        />
      ) : null}

      {showAdClickConsentGate ? (
        <aside
          ref={adClickGateDialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="ad-click-consent-title"
          aria-describedby="ad-click-consent-description"
          className="fixed inset-0 z-[110] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
        >
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-lg border border-white/15 bg-[#0a0b0d] p-5 text-white shadow-2xl shadow-black/70 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-red-800/40 bg-red-950/30 text-red-300">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="ad-click-consent-title" className="text-base font-black">
                  {consentCopy.title}
                </h2>
                <p
                  id="ad-click-consent-description"
                  className="mt-1 text-sm leading-6 text-zinc-400"
                >
                  {consentCopy.description}
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              {([
                ["necessary", consentCopy.necessaryOnly],
                ["analytics", consentCopy.analyticsOnly],
                ["advertising", consentCopy.acceptAll],
              ] as const).map(([choice, label]) => (
                <button
                  key={choice}
                  type="button"
                  data-ad-click-consent-choice={choice}
                  onClick={() => chooseAdClickConsent(choice)}
                  className="inline-flex min-h-12 items-center justify-center rounded-lg border border-white/15 bg-white/[0.04] px-4 text-sm font-black text-white transition hover:border-red-700/60 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                >
                  {label}
                </button>
              ))}
            </div>
            <Link
                  href="/datenschutz"
                  target="_blank"
                  rel="noopener noreferrer"
                  referrerPolicy="no-referrer"
                  aria-label={`${consentCopy.privacyInformation} (${consentCopy.opensInNewTab})`}
              className="mt-3 inline-flex min-h-11 items-center text-sm font-bold text-zinc-400 hover:text-white"
            >
              {consentCopy.privacyInformation}
            </Link>
          </div>
        </aside>
      ) : null}

      {showConsentPanel ? (
        <aside
          role="dialog"
          aria-modal="false"
          aria-labelledby="analytics-consent-title"
          className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-h-[calc(100dvh-1.5rem)] max-w-3xl overflow-y-auto overscroll-contain rounded-lg border border-white/15 bg-[#0a0b0d]/[0.98] p-4 text-white shadow-2xl shadow-black/60 backdrop-blur-xl sm:p-5"
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
                      className={immediateConsentChoiceClassName}
                    >
                      {consentCopy.acceptAll}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateConsent({ analytics: true, advertising: false })}
                      className={immediateConsentChoiceClassName}
                    >
                      {consentCopy.analyticsOnly}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => updateConsent({ analytics: false, advertising: false })}
                  className={immediateConsentChoiceClassName}
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
                <Link
                href="/datenschutz"
                target={paidClickLanding ? "_blank" : undefined}
                rel={paidClickLanding ? "noopener noreferrer" : undefined}
                referrerPolicy={paidClickLanding ? "no-referrer" : undefined}
                aria-label={paidClickLanding
                  ? `${consentCopy.privacyInformation} (${consentCopy.opensInNewTab})`
                  : consentCopy.privacyInformation}
                  className="inline-flex min-h-11 items-center justify-center px-3 text-sm font-bold text-zinc-400 hover:text-white"
                >
                  {consentCopy.privacyInformation}
                </Link>
              </div>
            </div>
          </div>
        </aside>
      ) : null}

      {consent !== "loading" &&
      !consent.needsDecision &&
      !preferencesOpen &&
      !showAdClickConsentGate &&
      (!googleMeasurementRouteAllowed || publicRoute) ? (
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
