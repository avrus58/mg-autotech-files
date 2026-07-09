import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/apiAuth";
import { sendOrderReceivedEmail } from "@/lib/email";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { checkRateLimit, rateLimitKey } from "@/lib/rateLimit";

const newOrderEmailSchema = z.object({
  orderId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser(request);
    if (!auth.ok) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

    const limit = checkRateLimit({
      key: rateLimitKey(request, "new-order-email", auth.user.id),
      limit: 12,
      windowMs: 60 * 60 * 1000,
    });

    if (!limit.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many order notification attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
      );
    }

    const parsed = newOrderEmailSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Valid order id is required." },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();
    const { data: order, error } = await admin
      .from("orders")
      .select("id, customer_id, customer_email, vehicle_brand, vehicle_model, vehicle_engine, service_type, credits_required")
      .eq("id", parsed.data.orderId)
      .eq("customer_id", auth.user.id)
      .maybeSingle();

    if (error || !order) {
      return NextResponse.json(
        { success: false, error: "Order not found." },
        { status: 404 }
      );
    }

    const vehicle = [order.vehicle_brand, order.vehicle_model, order.vehicle_engine]
      .filter(Boolean)
      .join(" ")
      .trim();

    await sendOrderReceivedEmail({
      orderId: order.id,
      customerEmail: order.customer_email || auth.user.email || "",
      vehicle,
      service: order.service_type || "",
      credits: Number(order.credits_required || 0),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Email could not be sent",
      },
      { status: 500 }
    );
  }
}
