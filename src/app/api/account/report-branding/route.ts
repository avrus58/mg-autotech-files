import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { checkAdaptiveRateLimit, rateLimitResponseHeaders } from "@/lib/abuseProtection";
import {
  createReportBrandingStore, normalizeReportLogoContentType, readReportBranding,
  readReportLogoBody, removeReportBranding, ReportBrandingError, saveReportBranding,
} from "@/lib/serviceReports/branding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff", Vary: "Authorization" };

async function handle(request: Request, method: "GET" | "POST" | "DELETE") {
  const auth = await requireApiUser(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status, headers: privateHeaders });
  if (auth.access.role !== "customer" || request.headers.get("x-mg-expected-user-id") !== auth.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers: privateHeaders });
  }
  const admin = getSupabaseAdmin();
  const profile = await admin.from("profiles").select("account_status").eq("id", auth.user.id).maybeSingle();
  if (profile.error || !profile.data) return NextResponse.json({ error: "unavailable" }, { status: 503, headers: privateHeaders });
  if ((profile.data.account_status ?? "active") !== "active") return NextResponse.json({ error: "forbidden" }, { status: 403, headers: privateHeaders });
  const limit = method === "GET" ? 120 : 12;
  const windowMs = 60 * 60 * 1000;
  const rate = await checkAdaptiveRateLimit({ request, scope: method === "GET" ? "report-branding-read" : "report-branding-write", suffix: auth.user.id, limit, windowMs, includeClientIp: false });
  const blocked = !rate.allowed || (process.env.NODE_ENV === "production" && rate.source !== "distributed");
  const headers = { ...privateHeaders, ...rateLimitResponseHeaders({ result: rate, limit, windowMs, blocked }) };
  if (process.env.NODE_ENV === "production" && rate.source !== "distributed") return NextResponse.json({ error: "unavailable" }, { status: 503, headers });
  if (!rate.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers });
  try {
    const store = createReportBrandingStore(admin);
    if (method === "GET") return NextResponse.json(await readReportBranding(store, auth.user.id), { headers });
    if (method === "DELETE") return NextResponse.json(await removeReportBranding(store, auth.user.id), { headers });
    const contentType = normalizeReportLogoContentType(request.headers.get("content-type"));
    const bytes = await readReportLogoBody(request);
    return NextResponse.json(await saveReportBranding(store, auth.user.id, bytes, contentType), { headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof ReportBrandingError ? error.code : "unavailable" },
      { status: error instanceof ReportBrandingError ? error.status : 503, headers });
  }
}

export function GET(request: Request) { return handle(request, "GET"); }
export function POST(request: Request) { return handle(request, "POST"); }
export function DELETE(request: Request) { return handle(request, "DELETE"); }
