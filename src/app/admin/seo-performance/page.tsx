import { isValidGoogleAnalyticsMeasurementId } from "@/lib/publicAnalytics";
import SeoPerformanceClient from "@/app/admin/seo-performance/SeoPerformanceClient";
import { getSearchEngineVerificationReadiness } from "@/lib/searchEngineIndexing";

export default function SeoPerformancePage() {
  const measurementConfigured = isValidGoogleAnalyticsMeasurementId(
    process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID
  );
  return (
    <SeoPerformanceClient
      measurementConfigured={measurementConfigured}
      searchEngineVerification={getSearchEngineVerificationReadiness()}
    />
  );
}
