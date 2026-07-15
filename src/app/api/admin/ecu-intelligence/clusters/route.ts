import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";
import { getEcuIntelligenceClusters } from "@/lib/ecuIntelligence/center/server";

export async function GET(request: Request) {
  const auth = await requireStaffPermission(request, "ai_training.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const url = new URL(request.url);
    return NextResponse.json(await getEcuIntelligenceClusters({
      limit: url.searchParams.get("limit"),
      page: url.searchParams.get("page"),
      search: url.searchParams.get("search"),
      service: url.searchParams.get("service"),
      readiness: url.searchParams.get("readiness"),
      includeSynthetic: url.searchParams.get("includeSynthetic") === "true",
    }));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ECU Intelligence clusters could not be loaded." },
      { status: 500 }
    );
  }
}
