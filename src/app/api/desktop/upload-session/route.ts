import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireApiUser } from "@/lib/apiAuth";
import { BoundedRequestBodyError, readBoundedJsonBody } from "@/lib/boundedRequestBody";
import { requireDesktopAppAllowed } from "@/lib/desktopUpload/appCheck";
import {
  calculateDesktopRequestCredits,
  desktopUploadPathFor,
  desktopUploadSessionIdFor,
  isValidSha256,
  normalizeDesktopIdempotencyKey,
  validateDesktopCreditAccess,
  validateDesktopUploadFile,
} from "@/lib/desktopUpload/contracts";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  createUploadIntegrityContract,
  isCompatibleFirmwareUpload,
  normalizeUploadContentType,
  UploadIntegrityError,
} from "@/lib/uploadIntegrity";
import { checkAdaptiveRateLimit, rateLimitResponseHeaders } from "@/lib/abuseProtection";

const uploadSessionSchema = z.object({
  idempotencyKey: z.string().trim().min(12).max(120),
  fileName: z.string().trim().min(1).max(240),
  fileSize: z.number().int().positive().max(32 * 1024 * 1024),
  sha256: z.string().trim().length(64),
  contentType: z.string().trim().max(150).optional().default("application/octet-stream"),
  service: z.object({
    primaryServiceId: z.string().trim().min(1).max(80),
    extraServiceIds: z.array(z.string().trim().min(1).max(80)).max(24).default([]),
  }).strict(),
}).strict();

export async function POST(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const app = requireDesktopAppAllowed(request);
  if (!app.ok) return app.response;

  const rate = await checkAdaptiveRateLimit({
    request,
    scope: "desktop-upload-prepare",
    suffix: auth.user.id,
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
      { error: "Too many upload preparations. Please wait before trying again." },
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
    requestBody = await readBoundedJsonBody(request, 32 * 1024);
  } catch (error) {
    const status = error instanceof BoundedRequestBodyError ? error.status : 400;
    return NextResponse.json({ error: "Upload session metadata is invalid or too large." }, { status });
  }
  const parsed = uploadSessionSchema.safeParse(requestBody);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid upload session request." }, { status: 400 });
  }

  const validation = validateDesktopUploadFile({
    fileName: parsed.data.fileName,
    fileSize: parsed.data.fileSize,
  });
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });
  if (!isValidSha256(parsed.data.sha256)) {
    return NextResponse.json({ error: "Invalid SHA-256 fingerprint." }, { status: 400 });
  }

  const safeKey = normalizeDesktopIdempotencyKey(parsed.data.idempotencyKey);
  if (safeKey.length < 12) return NextResponse.json({ error: "Invalid idempotency key." }, { status: 400 });

  let creditsRequired = 0;
  try {
    creditsRequired = calculateDesktopRequestCredits(parsed.data.service.primaryServiceId, parsed.data.service.extraServiceIds);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid service selection." }, { status: 400 });
  }
  if (!Number.isInteger(creditsRequired) || creditsRequired < 0) {
    return NextResponse.json(
      { error: "This service selection cannot be submitted through the desktop app." },
      { status: 400 }
    );
  }

  const admin = getSupabaseAdmin();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id,credit_balance,allow_negative_credits,negative_credit_limit,account_status")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profileError) return NextResponse.json({ error: "Customer access could not be verified." }, { status: 500 });

  const creditError = validateDesktopCreditAccess(profile ?? { credit_balance: null, account_status: "blocked" }, creditsRequired);
  if (creditError) return NextResponse.json({ error: creditError }, { status: 403 });

  let contentType: string;
  try {
    contentType = normalizeUploadContentType(parsed.data.contentType);
  } catch {
    return NextResponse.json({ error: "Invalid file content type." }, { status: 400 });
  }
  if (!isCompatibleFirmwareUpload(parsed.data.fileName, contentType)) {
    return NextResponse.json({ error: "Unsupported file content type." }, { status: 400 });
  }
  const path = desktopUploadPathFor({
    userId: auth.user.id,
    idempotencyKey: safeKey,
    fileName: parsed.data.fileName,
    sha256: parsed.data.sha256,
  });

  let uploadContract: string;
  try {
    uploadContract = createUploadIntegrityContract({
      kind: "desktop_request",
      userId: auth.user.id,
      resourceId: safeKey,
      path,
      fileName: parsed.data.fileName,
      fileSize: parsed.data.fileSize,
      contentType,
      sha256: parsed.data.sha256,
      nonce: randomUUID(),
    });
  } catch (error) {
    if (error instanceof UploadIntegrityError) {
      return NextResponse.json({ error: "Secure upload verification is unavailable." }, { status: 503 });
    }
    return NextResponse.json({ error: "Upload session could not be prepared." }, { status: 500 });
  }
  const signed = await admin.storage
    .from("customer-files")
    .createSignedUploadUrl(path, { upsert: false });
  if (signed.error || !signed.data?.signedUrl) {
    return NextResponse.json({ error: "Secure upload could not be prepared." }, { status: 503 });
  }

  return NextResponse.json({
    upload: {
      bucket: "customer-files",
      path,
      signedUploadUrl: signed.data.signedUrl,
      contentType,
      upsert: false,
    },
    uploadContract,
    uploadSessionId: desktopUploadSessionIdFor(safeKey),
    creditsRequired,
    idempotencyKey: safeKey,
    installationId: app.info.installationId,
    appVersion: app.info.appVersion,
    rawFileStoredByDesktop: false,
    note: "Upload this exact file once, then call finalize. The server verifies the signed metadata and downloaded SHA-256 before creating the request.",
  });
}
