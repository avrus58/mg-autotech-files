import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/apiAuth";
import { sendAdditionalFileUploadedNotifications } from "@/lib/email/events";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { recordWorkOrderEvent } from "@/lib/workOrders/server";

const schema = z.object({
  path: z.string().trim().min(1).max(700),
  fileName: z.string().trim().min(1).max(240),
  fileSize: z.number().int().positive().max(32 * 1024 * 1024),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid uploaded file." }, { status: 400 });

  const { id } = await context.params;
  const expectedPrefix = `${auth.user.id}/additional/${id}/`;
  if (!parsed.data.path.startsWith(expectedPrefix)) {
    return NextResponse.json({ error: "Invalid upload path." }, { status: 403 });
  }

  const admin = getSupabaseAdmin();
  const { data: order, error } = await admin
    .from("orders")
    .select("id, customer_id, customer_upload_enabled, customer_uploads")
    .eq("id", id)
    .eq("customer_id", auth.user.id)
    .maybeSingle();

  if (error || !order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (!order.customer_upload_enabled) {
    return NextResponse.json({ error: "The additional upload permission has expired." }, { status: 403 });
  }

  const pathParts = parsed.data.path.split("/");
  const storedFileName = pathParts.pop();
  const storedFolder = pathParts.join("/");
  const { data: storedObjects, error: storageError } = await admin.storage
    .from("customer-files")
    .list(storedFolder, { search: storedFileName, limit: 5 });
  if (storageError || !storedObjects?.some((item) => item.name === storedFileName)) {
    return NextResponse.json({ error: "Uploaded file could not be verified." }, { status: 400 });
  }

  const existing = Array.isArray(order.customer_uploads) ? order.customer_uploads : [];
  const uploaded = {
    id: crypto.randomUUID(),
    file_name: parsed.data.fileName,
    file_path: parsed.data.path,
    file_size: parsed.data.fileSize,
    uploaded_at: new Date().toISOString(),
  };

  const { error: updateError } = await admin
    .from("orders")
    .update({
      customer_uploads: [...existing, uploaded],
      customer_upload_enabled: false,
    })
    .eq("id", id)
    .eq("customer_id", auth.user.id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  await admin.from("request_messages").insert({
    request_id: id,
    sender_id: auth.user.id,
    sender_role: "customer",
    message: `Additional file uploaded: ${parsed.data.fileName}`,
  });

  await recordWorkOrderEvent({
    requestId: id,
    actorUserId: auth.user.id,
    eventType: "customer_additional_file_uploaded",
    message: `Customer uploaded additional file ${parsed.data.fileName}.`,
    customerVisible: true,
    newValue: { file_name: parsed.data.fileName, file_size: parsed.data.fileSize },
    mode: "best_effort",
  });
  await sendAdditionalFileUploadedNotifications({
    requestId: id,
    fileName: parsed.data.fileName,
    uploadId: uploaded.id,
  });

  return NextResponse.json({
    upload: {
      id: uploaded.id,
      file_name: uploaded.file_name,
      file_size: uploaded.file_size,
      uploaded_at: uploaded.uploaded_at,
    },
  });
}
