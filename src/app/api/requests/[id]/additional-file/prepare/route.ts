import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireApiUser } from "@/lib/apiAuth";
import { BoundedRequestBodyError, readBoundedJsonBody } from "@/lib/boundedRequestBody";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { checkAdaptiveRateLimit, rateLimitResponseHeaders } from "@/lib/abuseProtection";
import {
  createUploadIntegrityContract,
  isSafeSupportingUpload,
  normalizeUploadContentType,
  UploadIntegrityError,
} from "@/lib/uploadIntegrity";

const schema = z.object({
  fileName: z.string().trim().min(1).max(240),
  fileSize: z.number().int().positive().max(32 * 1024 * 1024),
  contentType: z.string().trim().max(150).optional().default("application/octet-stream"),
}).strict();

function safeName(value: string) {
  return value.replaceAll(" ", "_").replace(/[^a-zA-Z0-9._-]/g, "").slice(-160) || "additional-file.bin";
}

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
    includeClientIp: false,
  });
  if (process.env.NODE_ENV === "production" && rate.source !== "distributed") {
    return NextResponse.json(
      { error: "Secure upload capacity is temporarily unavailable." },
      {
        status: 503,
        headers: rateLimitResponseHeaders({
          result: rate,
          limit: 12,
          windowMs: 60 * 60 * 1000,
          blocked: true,
        }),
      }
    );
  }
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

  let requestBody: unknown;
  try {
    requestBody = await readBoundedJsonBody(request, 16 * 1024);
  } catch (error) {
    const status = error instanceof BoundedRequestBodyError ? error.status : 400;
    return NextResponse.json({ error: "Upload metadata is invalid or too large." }, { status });
  }
  const parsed = schema.safeParse(requestBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "Select a valid file up to 32 MB." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: order, error } = await admin
    .from("orders")
    .select("id, customer_id, customer_upload_enabled, customer_upload_grant_nonce")
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
  if (!order.customer_upload_grant_nonce) {
    return NextResponse.json({ error: "The additional upload grant is not ready. Ask MG AutoTech to enable it again." }, { status: 409 });
  }

  let contentType: string;
  try {
    contentType = normalizeUploadContentType(parsed.data.contentType);
  } catch {
    return NextResponse.json({ error: "Invalid file content type." }, { status: 400 });
  }
  if (!isSafeSupportingUpload(parsed.data.fileName, contentType)) {
    return NextResponse.json({ error: "This active web file type is not accepted." }, { status: 400 });
  }
  const path = `${auth.user.id}/additional/${id}/${randomUUID()}-${safeName(parsed.data.fileName)}`;
  let uploadContract: string;
  try {
    uploadContract = createUploadIntegrityContract({
      kind: "additional_file",
      userId: auth.user.id,
      resourceId: id,
      path,
      fileName: parsed.data.fileName,
      fileSize: parsed.data.fileSize,
      contentType,
      sha256: null,
      nonce: order.customer_upload_grant_nonce,
    });
  } catch (error) {
    if (error instanceof UploadIntegrityError) {
      return NextResponse.json({ error: "Secure upload verification is unavailable." }, { status: 503 });
    }
    return NextResponse.json({ error: "Additional upload could not be prepared." }, { status: 500 });
  }
  const signed = await admin.storage
    .from("customer-files")
    .createSignedUploadUrl(path, { upsert: false });
  if (signed.error || !signed.data?.token) {
    return NextResponse.json({ error: "Secure upload could not be prepared." }, { status: 503 });
  }
  return NextResponse.json({
    upload: { path, token: signed.data.token, contentType },
    uploadContract,
  });
}
