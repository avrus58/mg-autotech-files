import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = await request.json();

  const supabase = await getSupabaseServer();
  const supabaseAdmin = getSupabaseAdmin();

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const revisionNote = String(body.revisionNote || "").trim();

  if (!revisionNote) {
    return NextResponse.json(
      { error: "Revision note is required." },
      { status: 400 }
    );
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select("id, customer_id, status, modified_file_path")
    .eq("id", id)
    .eq("customer_id", user.id)
    .single();

  if (orderError || !order) {
    return NextResponse.json(
      { error: "Order not found or access denied." },
      { status: 404 }
    );
  }

  if (!order.modified_file_path) {
    return NextResponse.json(
      { error: "Revision can only be requested after a modified file is delivered." },
      { status: 400 }
    );
  }

  const { error: updateError } = await supabaseAdmin
    .from("orders")
    .update({ status: "revision" })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const { error: messageError } = await supabaseAdmin
    .from("request_messages")
    .insert({
      request_id: id,
      sender_id: user.id,
      sender_role: "customer",
      message: `Revision request:\n\n${revisionNote}`,
    });

  if (messageError) {
    return NextResponse.json({ error: messageError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, status: "revision" });
}
