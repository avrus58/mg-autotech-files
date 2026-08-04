import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";
import {
  isGrowthCustomerClassificationMigrationMissing,
  loadGrowthCustomerClassificationAdminData,
} from "@/lib/growth/customerClassificationServer";

const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  Vary: "Authorization",
};

export async function GET(request: Request) {
  const auth = await requireStaffPermission(request, "customers.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status, headers });

  try {
    return NextResponse.json(await loadGrowthCustomerClassificationAdminData(), { headers });
  } catch (error) {
    return NextResponse.json({
      error: isGrowthCustomerClassificationMigrationMissing(error)
        ? "Customer classification migration is required."
        : "Customer classification data is temporarily unavailable.",
    }, { status: 503, headers });
  }
}
