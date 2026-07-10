import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  const auth = await requireStaffPermission(request, "vehicles.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("vehicle_external_import_batches")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({
      batches: [],
      migrationRequired: error.code === "42P01",
      policy: "Manual-assisted only. No broad crawling, no auto-publish, no overwrite of verified records.",
    });
  }

  return NextResponse.json({
    batches: data ?? [],
    migrationRequired: false,
    policy: "Manual-assisted only. No broad crawling, no auto-publish, no overwrite of verified records.",
  });
}
