import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";
import { rebuildPatternClusterById } from "@/lib/ecuIntelligence/clustering";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffPermission(request, "ai_training.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await context.params;
  try {
    const cluster = await rebuildPatternClusterById(id, { actorUserId: auth.user.id });
    return NextResponse.json({ cluster });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Pattern cluster could not be rebuilt." },
      { status: 500 }
    );
  }
}
