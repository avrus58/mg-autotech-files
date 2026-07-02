import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";
import { maybeCreateTrainingSampleForRequest } from "@/lib/ecuIntelligence/learning";

export const maxDuration = 60;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffPermission(request, "orders.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await context.params;

  try {
    const result = await maybeCreateTrainingSampleForRequest(id, {
      actorUserId: auth.user.id,
      provider: "internal",
    });
    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Training capture failed." },
      { status: 500 }
    );
  }
}
