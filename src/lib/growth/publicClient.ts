"use client";

import { analyticsConsentStorageKey } from "@/lib/publicAnalytics";
import {
  buildGrowthAttributionTouch,
  growthConsentVersion,
  growthVisitorStorageKey,
  isGrowthVisitorId,
} from "@/lib/growth/attribution";

function analyticsAllowed() {
  try {
    return window.localStorage.getItem(analyticsConsentStorageKey) === "granted";
  } catch {
    return false;
  }
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

export function recordGrowthAttributionTouch() {
  if (typeof window === "undefined" || !analyticsAllowed()) return Promise.resolve(false);
  const visitorId = getOrCreateGrowthVisitorId();
  const touch = buildGrowthAttributionTouch({
    url: window.location.href,
    referrer: document.referrer,
    locale: window.navigator.language,
  });
  if (!visitorId || !touch) return Promise.resolve(false);

  return fetch("/api/growth/journey", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "attribution_touch",
      visitorId,
      consent: "granted",
      consentVersion: growthConsentVersion,
      ...touch,
    }),
    keepalive: true,
    cache: "no-store",
  }).then((response) => response.ok).catch(() => false);
}
