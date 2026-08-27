"use client";

import { authenticatedFetch } from "@/lib/authGuards";
import { getOrCreateGrowthVisitorId } from "@/lib/growth/publicClient";

export { clearGrowthVisitorId, recordGrowthAttributionTouch } from "@/lib/growth/publicClient";

async function postAuthenticatedGrowthEvent(
  body: Record<string, unknown>,
  signal?: AbortSignal
) {
  try {
    let requestSignal = signal;
    if (!requestSignal) {
      try {
        requestSignal = AbortSignal.timeout(4_000);
      } catch {
        // Callers remain fail-soft when AbortSignal.timeout is unavailable.
      }
    }
    const response = await authenticatedFetch("/api/growth/journey", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      ...(requestSignal ? { signal: requestSignal } : {}),
    });
    if (!response.ok) return null;
    return await response.json().catch(() => null) as unknown;
  } catch {
    return null;
  }
}

export async function recordGrowthAccountCreated() {
  try {
    const visitorId = typeof window !== "undefined" ? getOrCreateGrowthVisitorId() : null;
    let controller: AbortController | null = null;
    try {
      controller = new AbortController();
    } catch {
      // Promise.race below still bounds the callback without AbortController.
    }

    let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined;
    const timeout = new Promise<null>((resolve) => {
      timeoutId = globalThis.setTimeout(() => {
        controller?.abort();
        resolve(null);
      }, 3_500);
    });
    const attempts = async () => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const result = await postAuthenticatedGrowthEvent({
          action: "account_created",
          visitorId,
        }, controller?.signal);
        if (result && typeof result === "object") {
          const seed = (result as { conversionSeed?: unknown }).conversionSeed;
          if (
            typeof seed === "string" &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(seed)
          ) {
            return seed;
          }
        }
      }
      return null;
    };

    try {
      return await Promise.race([attempts(), timeout]);
    } finally {
      if (timeoutId !== undefined) globalThis.clearTimeout(timeoutId);
    }
  } catch {
    return null;
  }
}

export function recordGrowthRequestStarted(attemptId: string) {
  const visitorId = typeof window !== "undefined" ? getOrCreateGrowthVisitorId() : null;
  return postAuthenticatedGrowthEvent({
    action: "request_started",
    attemptId,
    visitorId,
  });
}

export function recordGrowthRequestCreated(orderId: string, attemptId: string) {
  const visitorId = typeof window !== "undefined" ? getOrCreateGrowthVisitorId() : null;
  return postAuthenticatedGrowthEvent({
    action: "request_created",
    orderId,
    attemptId,
    visitorId,
  });
}

export function updateGrowthReminderPreference(enabled: boolean) {
  return postAuthenticatedGrowthEvent({
    action: "reminder_preference",
    enabled,
    consentVersion: "abandoned-request-v1",
  });
}
