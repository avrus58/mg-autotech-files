import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";
import { getEcuIntelligenceSimilarity } from "@/lib/ecuIntelligence/center/server";

export async function GET(request: Request) {
  const auth = await requireStaffPermission(request, "ai_training.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    return NextResponse.json(await getEcuIntelligenceSimilarity());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Similarity evidence could not be loaded." }, { status: 500 });
  }
}
