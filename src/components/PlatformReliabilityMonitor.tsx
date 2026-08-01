"use client";

import { useEffect } from "react";
import { useReportWebVitals } from "next/web-vitals";
import {
  classifyPlatformFailure,
  normalizeReliabilityRoute,
  normalizeWebVitalValue,
  platformWebVitalNames,
  type PlatformReliabilityEventKind,
  type PlatformWebVitalName,
} from "@/lib/platformReliability";

type ReliabilityPayload = {
  kind: PlatformReliabilityEventKind;
  route: string;
  category?: ReturnType<typeof classifyPlatformFailure>;
  metricName?: PlatformWebVitalName;
  metricValue?: number;
  rating?: "good" | "needs-improvement" | "poor";
  navigationType?: string;
};

const reportedFailures = new Set<string>();

function sendReliabilityPayload(payload: ReliabilityPayload) {
  if (typeof window === "undefined") return;
  const body = JSON.stringify(payload);

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/observability/client-event",
        new Blob([body], { type: "application/json" })
      );
      return;
    }
  } catch {}

  void fetch("/api/observability/client-event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
    credentials: "omit",
  }).catch(() => undefined);
}

export function reportPlatformFailure(kind: Exclude<PlatformReliabilityEventKind, "web_vital">, value: unknown) {
  if (typeof window === "undefined") return;
  const route = normalizeReliabilityRoute(window.location.pathname);
  if (!route) return;
  const category = classifyPlatformFailure(value);
  const dedupeKey = `${kind}:${route}:${category}`;
  if (reportedFailures.has(dedupeKey)) return;
  reportedFailures.add(dedupeKey);
  sendReliabilityPayload({ kind, route, category });
}

function reportWebVital(metric: {
  name: string;
  value: number;
  rating?: string;
  navigationType?: string;
}) {
  if (typeof window === "undefined" || !platformWebVitalNames.includes(metric.name as PlatformWebVitalName)) return;
  const metricName = metric.name as PlatformWebVitalName;
  const metricValue = normalizeWebVitalValue(metricName, metric.value);
  const route = normalizeReliabilityRoute(window.location.pathname);
  if (metricValue === null || !route) return;
  const rating = metric.rating === "poor" || metric.rating === "needs-improvement" ? metric.rating : "good";

  sendReliabilityPayload({
    kind: "web_vital",
    route,
    metricName,
    metricValue,
    rating,
    navigationType: String(metric.navigationType ?? "unknown").slice(0, 40),
  });
}

export function PlatformReliabilityMonitor() {
  useReportWebVitals(reportWebVital);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      reportPlatformFailure("client_error", event.error ?? event.message);
    };
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      reportPlatformFailure("unhandled_rejection", event.reason);
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return null;
}
