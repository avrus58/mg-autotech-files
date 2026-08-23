import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";
import { getAdminRequestList } from "@/lib/workOrders/server";
import { buildAdminRequestAccess } from "@/lib/workOrders/access";

export async function GET(request: Request) {
  const auth = await requireStaffPermission(request, "orders.view");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const result = await getAdminRequestList(buildAdminRequestAccess(auth.access));
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Admin requests could not be loaded." },
      { status: 500 }
    );
  }
}
