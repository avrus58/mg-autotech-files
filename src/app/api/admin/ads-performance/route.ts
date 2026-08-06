import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";
import { buildGrowthCustomerSuccessReport, parseGrowthReportRange } from "@/lib/growth/report";
import { buildAdsPerformanceReport } from "@/lib/googleAds/readiness";

const privateNoStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
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
    const range = parseGrowthReportRange(new URL(request.url).searchParams.get("range"));
    const growth = await buildGrowthCustomerSuccessReport({ range });
    return NextResponse.json(buildAdsPerformanceReport(growth), {
      headers: privateNoStoreHeaders,
    });
  } catch {
    return NextResponse.json(
      { error: "Advertising readiness reporting is temporarily unavailable." },
      { status: 503, headers: privateNoStoreHeaders }
    );
  }
}
