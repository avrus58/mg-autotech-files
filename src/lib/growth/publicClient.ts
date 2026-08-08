"use client";

import { hasAnalyticsConsent } from "@/lib/publicAnalytics";
import {
  buildGrowthAttributionTouch,
  growthConsentVersion,
  growthVisitorStorageKey,
  isGrowthVisitorId,
} from "@/lib/growth/attribution";

function analyticsAllowed() {
  return hasAnalyticsConsent();
}

export function getOrCreateGrowthVisitorId() {
  if (typeof window === "undefined" || !analyticsAllowed()) return null;
  try {
    const existing = window.localStorage.getItem(growthVisitorStorageKey) ?? "";
    if (isGrowthVisitorId(existing)) return existing;
    const created = window.crypto.randomUUID();
    window.localStorage.setItem(growthVisitorStorageKey, created);
    return created;
  } catch {
    return null;
  }
}

export function clearGrowthVisitorId() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(growthVisitorStorageKey);
  } catch {
    // Consent revocation must remain usable when storage is unavailable.
  }
}

export function captureGrowthAttributionTouch() {
  if (typeof window === "undefined") return null;
  return buildGrowthAttributionTouch({
    url: window.location.href,
    referrer: typeof document === "undefined" ? "" : document.referrer,
    locale: window.navigator?.language ?? null,
  });
}

export function recordGrowthAttributionTouch(
  capturedTouch = captureGrowthAttributionTouch()
) {
  if (typeof window === "undefined" || !analyticsAllowed()) return Promise.resolve(false);
  const visitorId = getOrCreateGrowthVisitorId();
  if (!visitorId || !capturedTouch) return Promise.resolve(false);

  return fetch("/api/growth/journey", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "attribution_touch",
      visitorId,
      consent: "granted",
      consentVersion: growthConsentVersion,
      ...capturedTouch,
    }),
    keepalive: true,
    cache: "no-store",
  }).then((response) => response.ok).catch(() => false);
}
