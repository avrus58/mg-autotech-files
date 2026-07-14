import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";
import { buildDtcActiveFoundationStatus } from "@/lib/dtcActive";

export async function GET(request: Request) {
  const auth = await requireStaffPermission(request, "ai_training.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  return NextResponse.json({
    foundation: buildDtcActiveFoundationStatus(),
  });
}
