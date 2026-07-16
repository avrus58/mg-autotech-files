import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/apiAuth";
import { captureLearningFileCandidate } from "@/lib/ecuIntelligence/learningIngestion";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await context.params;
  const admin = getSupabaseAdmin();
  const order = await admin
    .from("orders")
    .select("id, customer_id")
    .eq("id", id)
    .maybeSingle();
  if (order.error) return NextResponse.json({ error: order.error.message }, { status: 500 });
  if (!order.data) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  if (order.data.customer_id !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await captureLearningFileCandidate({
      requestId: id,
      actorUserId: auth.user.id,
      sourceType: "customer_upload",
    });
    return NextResponse.json({
      learningCandidateCreated: ["created", "updated", "duplicate"].includes(result.status),
      status: result.status,
      retryable: result.retryable,
      approvedForLearning: false,
      customerSafe: true,
    });
  } catch {
    return NextResponse.json({
      learningCandidateCreated: false,
      approvedForLearning: false,
      customerSafe: true,
      warning: "Learning candidate could not be queued.",
    });
  }
}
