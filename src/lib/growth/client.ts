"use client";

import { authenticatedFetch } from "@/lib/authGuards";
import { getOrCreateGrowthVisitorId } from "@/lib/growth/publicClient";

export { clearGrowthVisitorId, recordGrowthAttributionTouch } from "@/lib/growth/publicClient";

async function postAuthenticatedGrowthEvent(body: Record<string, unknown>) {
  try {
    const response = await authenticatedFetch("/api/growth/journey", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function recordGrowthAccountCreated() {
  const visitorId = typeof window !== "undefined" ? getOrCreateGrowthVisitorId() : null;
  return postAuthenticatedGrowthEvent({
    action: "account_created",
    visitorId,
  });
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
