import { isGoogleMeasurementPath } from "@/lib/measurementCompletion";

/**
 * Customer notifications can contain account and order context. Keep them on
 * the Google-free private customer workspace rather than sharing a document
 * with public measurement scripts.
 */
export function isCustomerNotificationRuntimePath(pathname: string) {
  if (isGoogleMeasurementPath(pathname)) return false;
  return (
    pathname === "/new-request" ||
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname.startsWith("/payment/")
  );
}
