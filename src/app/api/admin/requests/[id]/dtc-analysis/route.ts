import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";
import {
  analyzeRequestDtc,
  requestDtcOrderSelect,
  type RequestDtcOrderContext,
} from "@/lib/dtcAnalyzer/requestIntegration";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { recordWorkOrderEvent } from "@/lib/workOrders/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffPermission(request, "orders.view");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await context.params;
  const admin = getSupabaseAdmin();
  const { data: order, error } = await admin
    .from("orders")
    .select(requestDtcOrderSelect)
    .eq("id", id)
    .maybeSingle();

  if (error || !order) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }

  const projection = await analyzeRequestDtc(order as RequestDtcOrderContext, "admin");

  await recordWorkOrderEvent({
    requestId: id,
    actorUserId: auth.user.id,
    eventType: "dtc_analysis_generated",
    message: "Admin DTC analysis generated from sanitized request fields.",
    customerVisible: false,
    metadata: projection.auditMetadata,
    mode: "best_effort",
  });

  return NextResponse.json({ analysis: projection.expert });
}
