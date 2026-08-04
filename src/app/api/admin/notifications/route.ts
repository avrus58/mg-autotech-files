import { NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/apiAuth";
import { getAdminRequestList } from "@/lib/workOrders/server";
import { listAdminEmailDeliveryIssues } from "@/lib/email/deliveryReliability";

export async function GET(request: Request) {
  const auth = await requireStaffPermission(request, "orders.view");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const [result, emailIssues] = await Promise.all([
      getAdminRequestList(),
      listAdminEmailDeliveryIssues(),
    ]);
    return NextResponse.json({
      items: result.items.map(({ order }) => ({
        id: order.id,
        status: order.status,
        vehicle_brand: order.vehicle_brand,
        vehicle_model: order.vehicle_model,
        created_at: order.created_at,
      })),
      emailIssues,
    });
  } catch {
    return NextResponse.json(
      { error: "Admin notification queue could not be loaded." },
      { status: 500 }
    );
  }
}
