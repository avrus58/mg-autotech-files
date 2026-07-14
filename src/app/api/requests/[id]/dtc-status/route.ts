import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/apiAuth";
import {
  assertCustomerDtcActiveProjectionSafe,
  buildCustomerDtcActiveStatus,
  normalizeActiveDtcCodes,
} from "@/lib/dtcActive";
import { requestDtcInputText, requestDtcOrderSelect, type RequestDtcOrderContext } from "@/lib/dtcAnalyzer/requestIntegration";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await context.params;
  const admin = getSupabaseAdmin();
  const { data: order, error } = await admin
    .from("orders")
    .select(requestDtcOrderSelect)
    .eq("id", id)
    .eq("customer_id", auth.user.id)
    .maybeSingle();

  if (error || !order) {
    return NextResponse.json({ error: "Order not found or access denied." }, { status: 404 });
  }

  const text = requestDtcInputText(order as RequestDtcOrderContext);
  const normalized = normalizeActiveDtcCodes(text);
  const projection = buildCustomerDtcActiveStatus({
    requestId: id,
    requestedCodes: normalized.codes.map((code) => code.code),
    status: normalized.codes.length ? "expert_review" : "action_required",
  });

  assertCustomerDtcActiveProjectionSafe(projection);
  return NextResponse.json({ dtcStatus: projection });
}
