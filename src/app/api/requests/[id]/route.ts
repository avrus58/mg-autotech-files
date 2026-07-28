import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/apiAuth";
import {
  CUSTOMER_FILE_DOWNLOAD_EVENT,
  customerOrderDetailSelect,
  projectCustomerDeliveryHistory,
  projectCustomerOrder,
  type CustomerDownloadEventRow,
  type CustomerOrderRecord,
} from "@/lib/customerOrderDelivery";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  const admin = getSupabaseAdmin();
  const orderResult = await admin
    .from("orders")
    .select(customerOrderDetailSelect)
    .eq("id", id)
    .eq("customer_id", auth.user.id)
    .maybeSingle();

  if (orderResult.error || !orderResult.data) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const eventResult = await admin
    .from("request_work_order_events")
    .select("event_type, new_value, created_at")
    .eq("request_id", id)
    .eq("event_type", CUSTOMER_FILE_DOWNLOAD_EVENT)
    .order("created_at", { ascending: true });

  if (eventResult.error) {
    return NextResponse.json(
      { error: "Delivery history is temporarily unavailable." },
      { status: 503 }
    );
  }

  const order = orderResult.data as unknown as CustomerOrderRecord;
  return NextResponse.json(
    {
      order: projectCustomerOrder(order),
      delivery: projectCustomerDeliveryHistory(
        order,
        (eventResult.data ?? []) as CustomerDownloadEventRow[]
      ),
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    }
  );
}
