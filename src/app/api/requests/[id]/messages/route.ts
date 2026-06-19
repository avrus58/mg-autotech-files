import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from("request_messages")
    .select("*")
    .eq("request_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ messages: data ?? [] });
}

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

  if (!user.email_confirmed_at && !user.confirmed_at) {
    return NextResponse.json(
      { error: "Please verify your e-mail address first." },
      { status: 403 }
    );
  }

  const message = String(body.message || "").trim();
  const senderRole = body.senderRole === "admin" ? "admin" : "customer";

  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("request_messages")
    .insert({
      request_id: id,
      sender_id: user.id,
      sender_role: senderRole,
      message,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: data });
}
