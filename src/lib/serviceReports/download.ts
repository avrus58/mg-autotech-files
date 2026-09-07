import type { ServiceReportTranslationKey } from "@/lib/i18n/service-report-translations";

export class ServiceReportDownloadError extends Error {
  constructor(readonly translationKey: ServiceReportTranslationKey) {
    super("service_report_download_failed");
    this.name = "ServiceReportDownloadError";
  }
}

export async function readServiceReportDownload(response: Response): Promise<Blob> {
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const code = payload && typeof payload === "object" && "error" in payload ? payload.error : null;
    if (response.status === 401 || response.status === 403 || response.status === 428 || code === "unauthorized") {
      throw new ServiceReportDownloadError("downloadUnauthorized");
    }
    if (response.status === 429 || code === "rate_limited") throw new ServiceReportDownloadError("downloadRateLimited");
    if (code === "report_unavailable" || code === "report_incomplete") throw new ServiceReportDownloadError("downloadUnavailable");
    throw new ServiceReportDownloadError("downloadError");
  }
  if (response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/pdf") {
    throw new ServiceReportDownloadError("downloadError");
  }
  const blob = await response.blob();
  if (blob.size < 5 || blob.size > 20 * 1024 * 1024 || await blob.slice(0, 5).text() !== "%PDF-") {
    throw new ServiceReportDownloadError("downloadError");
  }
  return blob;
}
