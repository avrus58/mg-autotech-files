import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";
import { BoundedRequestBodyError, readBoundedJsonBody } from "@/lib/boundedRequestBody";
import { checkAdaptiveRateLimit, rateLimitResponseHeaders } from "@/lib/abuseProtection";
import { saveServiceReportDetailsSchema, ServiceReportError } from "@/lib/serviceReports/model";
import { getAdminServiceReportDetails, saveAdminServiceReportDetails } from "@/lib/serviceReports/server";

const privateHeaders = { "Cache-Control": "private, no-store" };

function reportError(error: unknown) {
  return NextResponse.json({ code: error instanceof ServiceReportError ? error.code : "REPORT_UNAVAILABLE" }, { status: error instanceof ServiceReportError ? error.status : 503, headers: privateHeaders });
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffPermission(request, "orders.view");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status, headers: privateHeaders });
  try {
    return NextResponse.json(await getAdminServiceReportDetails((await context.params).id), { headers: privateHeaders });
  } catch (error) { return reportError(error); }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffPermission(request, "orders.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status, headers: privateHeaders });
  try {
    const { id } = await context.params;
    const rate = await checkAdaptiveRateLimit({ request, scope: "admin-service-report-save", suffix: auth.user.id, limit: 60, windowMs: 60 * 60 * 1000, includeClientIp: false });
    const blocked = !rate.allowed || (process.env.NODE_ENV === "production" && rate.source !== "distributed");
    if (blocked) return NextResponse.json({ code: "REPORT_SAVE_LIMIT" }, { status: rate.allowed ? 503 : 429, headers: { ...privateHeaders, ...rateLimitResponseHeaders({ result: rate, limit: 60, windowMs: 60 * 60 * 1000, blocked: true }) } });
    const parsed = saveServiceReportDetailsSchema.safeParse(await readBoundedJsonBody(request, 24 * 1024));
    if (!parsed.success) return NextResponse.json({ code: "REPORT_INVALID_DETAILS" }, { status: 400, headers: privateHeaders });
    return NextResponse.json(await saveAdminServiceReportDetails(id, auth.user.id, parsed.data.expectedRevision, parsed.data.details), { headers: privateHeaders });
  } catch (error) {
    if (error instanceof BoundedRequestBodyError) return NextResponse.json({ code: "REPORT_INVALID_DETAILS" }, { status: error.status, headers: privateHeaders });
    return reportError(error);
  }
}
