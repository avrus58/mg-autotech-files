import { requireApiUser } from "@/lib/apiAuth";
import { checkAdaptiveRateLimit, rateLimitResponseHeaders } from "@/lib/abuseProtection";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { createReportBrandingStore, loadReportLogoDataUrl } from "@/lib/serviceReports/branding";
import { createServiceReportDownloadHandler } from "@/lib/serviceReports/downloadServer";
import { renderServiceReportPdf } from "@/lib/serviceReports/pdf";
import { assertOrderReportStillAccessible, getOrCreateServiceReport } from "@/lib/serviceReports/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const limit = 20;
const windowMs = 60 * 60 * 1000;

const download = createServiceReportDownloadHandler({
  authorize: requireApiUser,
  async rateLimit(request, userId) {
    const result = await checkAdaptiveRateLimit({ request, scope: "customer-service-report", suffix: userId, includeClientIp: false, limit, windowMs });
    const unavailable = process.env.NODE_ENV === "production" && result.source !== "distributed";
    return {
      status: unavailable ? 503 : result.allowed ? 200 : 429,
      headers: rateLimitResponseHeaders({ result, limit, windowMs, blocked: unavailable || !result.allowed }),
    };
  },
  snapshot: (orderId, auth) => getOrCreateServiceReport(orderId, auth.user.id, auth.access),
  async logo(snapshot) {
    const dataUrl = await loadReportLogoDataUrl(createReportBrandingStore(getSupabaseAdmin()), snapshot.customerId, snapshot.workshop.logoPath);
    return dataUrl === null ? null : Buffer.from(dataUrl.slice("data:image/png;base64,".length), "base64");
  },
  render: renderServiceReportPdf,
  assertAccessible: (snapshot, auth) => assertOrderReportStillAccessible(snapshot.orderId, snapshot.customerId, auth.user.id, auth.access),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return download(request, (await context.params).id);
}
