"use client";

import dynamic from "next/dynamic";
import type { GoogleAdsPublicConfiguration } from "@/lib/publicAnalytics";

const PublicAnalytics = dynamic(
  () =>
    import("@/components/analytics/PublicAnalytics").then(
      (module) => module.PublicAnalytics
    ),
  { ssr: false }
);

export function PublicAnalyticsRuntime(props: GoogleAdsPublicConfiguration) {
  return <PublicAnalytics {...props} />;
}
