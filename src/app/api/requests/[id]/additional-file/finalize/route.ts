import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/apiAuth";
import { sendAdditionalFileUploadedNotifications } from "@/lib/email/events";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { recordWorkOrderEvent } from "@/lib/workOrders/server";
import { checkAdaptiveRateLimit, rateLimitResponseHeaders } from "@/lib/abuseProtection";
import {
  exactStoredObjectMetadata,
  splitStoragePath,
  UploadIntegrityError,
  verifyUploadIntegrityContract,
} from "@/lib/uploadIntegrity";

const schema = z.object({
  uploadContract: z.string().trim().min(80).max(4096),
  path: z.string().trim().min(1).max(700),
  fileName: z.string().trim().min(1).max(240),
  fileSize: z.number().int().positive().max(32 * 1024 * 1024),
}).strict();

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await context.params;
  const rate = await checkAdaptiveRateLimit({
    request,
    scope: "additional-file-upload",
    suffix: `${auth.user.id}:${id}`,
    limit: 12,
    windowMs: 60 * 60 * 1000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many additional upload attempts. Please wait before trying again." },
      {
        status: 429,
        headers: rateLimitResponseHeaders({
          result: rate,
          limit: 12,
          windowMs: 60 * 60 * 1000,
          blocked: true,
        }),
      }
    );
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid uploaded file." }, { status: 400 });

  const expectedPrefix = `${auth.user.id}/additional/${id}/`;
  if (!parsed.data.path.startsWith(expectedPrefix)) {
    return NextResponse.json({ error: "Invalid upload path." }, { status: 403 });
  }
  let uploadContract: ReturnType<typeof verifyUploadIntegrityContract>;
  try {
    uploadContract = verifyUploadIntegrityContract(parsed.data.uploadContract, {
      kind: "additional_file",
      userId: auth.user.id,
      resourceId: id,
      path: parsed.data.path,
      fileName: parsed.data.fileName,
      fileSize: parsed.data.fileSize,
      sha256: null,
    });
  } catch (error) {
    const unavailable = error instanceof UploadIntegrityError && error.message.includes("not configured");
    return NextResponse.json(
      { error: unavailable ? "Secure upload verification is unavailable." : "The upload session is invalid or expired." },
      { status: unavailable ? 503 : 403 }
    );
  }

  const admin = getSupabaseAdmin();
  const { data: order, error } = await admin
    .from("orders")
    .select("id, customer_id, customer_upload_enabled, customer_upload_grant_nonce, customer_uploads")
    .eq("id", id)
    .eq("customer_id", auth.user.id)
    .maybeSingle();

  if (error || !order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (!order.customer_upload_enabled) {
    return NextResponse.json({ error: "The additional upload permission has expired." }, { status: 403 });
  }
  if (!order.customer_upload_grant_nonce || order.customer_upload_grant_nonce !== uploadContract.nonce) {
    return NextResponse.json({ error: "The additional upload grant has expired." }, { status: 403 });
  }

  let storedFolder: string;
  let storedFileName: string;
  try {
    ({ folder: storedFolder, name: storedFileName } = splitStoragePath(parsed.data.path));
  } catch {
    return NextResponse.json({ error: "Invalid upload path." }, { status: 403 });
  }
  const { data: storedObjects, error: storageError } = await admin.storage
    .from("customer-files")
    .list(storedFolder, { search: storedFileName, limit: 5 });
  const storedMetadata = exactStoredObjectMetadata(storedObjects, storedFileName);
  if (
    storageError ||
    !storedMetadata ||
    storedMetadata.size !== uploadContract.fileSize ||
    storedMetadata.contentType !== uploadContract.contentType
  ) {
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

  const { data: consumedOrder, error: updateError } = await admin
    .from("orders")
    .update({
      customer_uploads: [...existing, uploaded],
      customer_upload_enabled: false,
      customer_upload_grant_nonce: null,
    })
    .eq("id", id)
    .eq("customer_id", auth.user.id)
    .eq("customer_upload_enabled", true)
    .eq("customer_upload_grant_nonce", uploadContract.nonce)
    .select("id")
    .maybeSingle();

  if (updateError) return NextResponse.json({ error: "The additional upload could not be saved." }, { status: 500 });
  if (!consumedOrder) {
    return NextResponse.json({ error: "The additional upload permission was already used." }, { status: 409 });
  }

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
