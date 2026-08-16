import { NextResponse } from "next/server";
import { z } from "zod";
import { checkAdaptiveRateLimit, rateLimitResponseHeaders } from "@/lib/abuseProtection";
import { requireApiUser } from "@/lib/apiAuth";
import { BoundedRequestBodyError, readBoundedJsonBody } from "@/lib/boundedRequestBody";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  isCompatibleFirmwareUpload,
  normalizeUploadContentType,
} from "@/lib/uploadIntegrity";

const requestUploadSchema = z.object({
  idempotencyKey: z.string().trim().min(12).max(96).regex(/^[A-Za-z0-9._-]+$/),
  fileName: z.string().trim().min(1).max(240),
  fileSize: z.number().int().positive().max(32 * 1024 * 1024),
  sha256: z.string().trim().regex(/^[a-f0-9]{64}$/),
  contentType: z.string().trim().max(150).optional().default("application/octet-stream"),
}).strict();

function safeName(value: string) {
  return value
    .replaceAll(" ", "_")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(-180) || "original.bin";
}

export async function POST(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!auth.user.email_confirmed_at && !auth.user.confirmed_at) {
    return NextResponse.json({ error: "Please verify your e-mail address first." }, { status: 403 });
  }

  const rate = await checkAdaptiveRateLimit({
    request,
    scope: "web-request-upload-prepare",
    suffix: auth.user.id,
    limit: 12,
    windowMs: 60 * 60 * 1000,
    includeClientIp: false,
  });
  const headers = rateLimitResponseHeaders({
    result: rate,
    limit: 12,
    windowMs: 60 * 60 * 1000,
    blocked: !rate.allowed || (process.env.NODE_ENV === "production" && rate.source !== "distributed"),
  });
  if (process.env.NODE_ENV === "production" && rate.source !== "distributed") {
    return NextResponse.json(
      { error: "Secure upload capacity is temporarily unavailable." },
      { status: 503, headers },
    );
  }
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many upload preparations. Please wait before trying again." },
      { status: 429, headers },
    );
  }

  let requestBody: unknown;
  try {
    requestBody = await readBoundedJsonBody(request, 16 * 1024);
  } catch (error) {
    const status = error instanceof BoundedRequestBodyError ? error.status : 400;
    return NextResponse.json({ error: "Upload metadata is invalid or too large." }, { status, headers });
  }
  const parsed = requestUploadSchema.safeParse(requestBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "Select a valid firmware file up to 32 MB." }, { status: 400, headers });
  }

  let contentType: string;
  try {
    contentType = normalizeUploadContentType(parsed.data.contentType);
  } catch {
    return NextResponse.json({ error: "Invalid file content type." }, { status: 400, headers });
  }
  if (!isCompatibleFirmwareUpload(parsed.data.fileName, contentType)) {
    return NextResponse.json({ error: "Unsupported file content type." }, { status: 400, headers });
  }

  const admin = getSupabaseAdmin();
  const profile = await admin
    .from("profiles")
    .select("role,account_status")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profile.error) {
    return NextResponse.json({ error: "Customer access could not be verified." }, { status: 503, headers });
  }
  if (profile.data?.role !== "customer" || (profile.data.account_status ?? "active") !== "active") {
    return NextResponse.json({ error: "This customer account cannot prepare uploads." }, { status: 403, headers });
  }

  const path = `${auth.user.id}/${parsed.data.idempotencyKey}/${parsed.data.sha256}-original-${safeName(parsed.data.fileName)}`;
  const { data, error } = await admin.storage
    .from("customer-files")
    .createSignedUploadUrl(path, { upsert: false });
  if (error || !data?.token) {
    return NextResponse.json(
      { error: "Secure upload could not be prepared." },
      { status: 503, headers },
    );
  }

  return NextResponse.json(
    { upload: { path, token: data.token, contentType } },
    { headers },
  );
}
