import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffPermission } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const schema = z.object({ enabled: z.boolean() });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffPermission(request, "orders.manage");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid upload permission." }, { status: 400 });

  const { id } = await context.params;
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("orders")
    .update({ customer_upload_enabled: parsed.data.enabled })
    .eq("id", id)
    .select("id, customer_upload_enabled")
    .maybeSingle();

  if (error?.code === "42703") {
    return NextResponse.json({ error: "Additional file upload migration has not been installed." }, { status: 409 });
  }
  if (error || !data) return NextResponse.json({ error: error?.message || "Order not found." }, { status: 404 });
  return NextResponse.json({ order: data });
}
