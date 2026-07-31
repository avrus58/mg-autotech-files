import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";
import { parseSeoReportRange } from "@/lib/seoGrowth/config";
import { getCachedSeoGrowthReport } from "@/lib/seoGrowth/service";

const privateNoStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  Vary: "Authorization",
};

export async function GET(request: Request) {
  const auth = await requireStaffPermission(request, "orders.view");
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status, headers: privateNoStoreHeaders }
    );
  }

  try {
    const url = new URL(request.url);
    const range = parseSeoReportRange(url.searchParams.get("range"));
    const report = await getCachedSeoGrowthReport(range);
    return NextResponse.json(report, { headers: privateNoStoreHeaders });
  } catch {
    return NextResponse.json(
      { error: "SEO reporting is temporarily unavailable." },
      { status: 503, headers: privateNoStoreHeaders }
    );
  }
}
