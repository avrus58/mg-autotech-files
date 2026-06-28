import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const schema = z.object({
  fileName: z.string().trim().min(1).max(240),
  fileSize: z.number().int().positive().max(32 * 1024 * 1024),
  contentType: z.string().trim().max(150).optional().default("application/octet-stream"),
});

function safeName(value: string) {
  return value.replaceAll(" ", "_").replace(/[^a-zA-Z0-9._-]/g, "").slice(-160) || "additional-file.bin";
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Select a valid file up to 32 MB." }, { status: 400 });
  }

  const { id } = await context.params;
  const admin = getSupabaseAdmin();
  const { data: order, error } = await admin
    .from("orders")
    .select("id, customer_id, customer_upload_enabled")
    .eq("id", id)
    .eq("customer_id", auth.user.id)
    .maybeSingle();

  if (error?.code === "42703") {
    return NextResponse.json({ error: "Additional file upload is not installed yet." }, { status: 409 });
  }
  if (error || !order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (!order.customer_upload_enabled) {
    return NextResponse.json({ error: "MG AutoTech has not enabled another upload for this request." }, { status: 403 });
  }

  const path = `${auth.user.id}/additional/${id}/${Date.now()}-${safeName(parsed.data.fileName)}`;
  return NextResponse.json({
    upload: { path, contentType: parsed.data.contentType || "application/octet-stream" },
  });
}
