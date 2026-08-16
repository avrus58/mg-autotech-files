import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/apiAuth";
import { requireDesktopAppAllowed } from "@/lib/desktopUpload/appCheck";
import {
  buildDesktopServiceSummary,
  calculateDesktopRequestCredits,
  desktopUploadPathFor,
  desktopUploadSessionIdFor,
  isValidSha256,
  normalizeDesktopIdempotencyKey,
  validateDesktopCreditAccess,
  validateDesktopUploadFile,
} from "@/lib/desktopUpload/contracts";
import { sendRequestCreatedNotifications } from "@/lib/email/events";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  exactStoredObjectMetadata,
  isCompatibleFirmwareUpload,
  splitStoragePath,
  UploadIntegrityError,
  verifyUploadIntegrityContract,
} from "@/lib/uploadIntegrity";
import { checkAdaptiveRateLimit, rateLimitResponseHeaders } from "@/lib/abuseProtection";

const finalizeSchema = z.object({
  idempotencyKey: z.string().trim().min(12).max(120),
  uploadSessionId: z.string().trim().min(12).max(140),
  uploadContract: z.string().trim().min(80).max(4096),
  upload: z.object({
    path: z.string().trim().min(1).max(700),
    fileName: z.string().trim().min(1).max(240),
    fileSize: z.number().int().positive().max(32 * 1024 * 1024),
    sha256: z.string().trim().length(64),
  }).strict(),
  vehicle: z.object({
    brand: z.string().trim().min(1).max(120),
    model: z.string().trim().min(1).max(160),
    generation: z.string().trim().max(180).nullable().optional(),
    engine: z.string().trim().min(1).max(220),
    year: z.string().trim().max(20).nullable().optional(),
  }).strict(),
  service: z.object({
    primaryServiceId: z.string().trim().min(1).max(80),
    extraServiceIds: z.array(z.string().trim().min(1).max(80)).max(24).default([]),
  }).strict(),
  notes: z.string().trim().max(4000).nullable().optional(),
  ecu: z.string().trim().max(200).nullable().optional(),
  gearbox: z.string().trim().max(200).nullable().optional(),
  readMethod: z.string().trim().max(120).nullable().optional(),
  hwSw: z.string().trim().max(200).nullable().optional(),
  masterSlave: z.enum(["master", "slave"]).default("master"),
}).strict();

function bearerToken(request: Request) {
  const value = request.headers.get("authorization") ?? "";
  return value.toLowerCase().startsWith("bearer ") ? value.slice(7).trim() : "";
}

export async function POST(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const app = requireDesktopAppAllowed(request);
  if (!app.ok) return app.response;

  const rate = await checkAdaptiveRateLimit({
    request,
    scope: "desktop-upload-finalize",
    suffix: auth.user.id,
    limit: 12,
    windowMs: 60 * 60 * 1000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many upload finalization attempts. Please wait before trying again." },
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

  const parsed = finalizeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid desktop request payload." }, { status: 400 });
  }

  const fileValidation = validateDesktopUploadFile({
    fileName: parsed.data.upload.fileName,
    fileSize: parsed.data.upload.fileSize,
  });
  if (!fileValidation.ok) return NextResponse.json({ error: fileValidation.error }, { status: 400 });
  if (!isValidSha256(parsed.data.upload.sha256)) {
    return NextResponse.json({ error: "Invalid SHA-256 fingerprint." }, { status: 400 });
  }

  const safeKey = normalizeDesktopIdempotencyKey(parsed.data.idempotencyKey);
  if (safeKey.length < 12) {
    return NextResponse.json({ error: "Invalid idempotency key." }, { status: 400 });
  }
  const expectedPath = desktopUploadPathFor({
    userId: auth.user.id,
    idempotencyKey: safeKey,
    fileName: parsed.data.upload.fileName,
    sha256: parsed.data.upload.sha256,
  });
  if (parsed.data.upload.path !== expectedPath) {
    return NextResponse.json({ error: "Upload path does not match the authenticated customer session." }, { status: 403 });
  }
  if (parsed.data.uploadSessionId !== desktopUploadSessionIdFor(parsed.data.idempotencyKey)) {
    return NextResponse.json({ error: "Upload session does not match the authenticated desktop request." }, { status: 403 });
  }

  let uploadContract: ReturnType<typeof verifyUploadIntegrityContract>;
  try {
    uploadContract = verifyUploadIntegrityContract(parsed.data.uploadContract, {
      kind: "desktop_request",
      userId: auth.user.id,
      resourceId: safeKey,
      path: expectedPath,
      fileName: parsed.data.upload.fileName,
      fileSize: parsed.data.upload.fileSize,
      sha256: parsed.data.upload.sha256,
    });
  } catch (error) {
    const unavailable = error instanceof UploadIntegrityError && error.message.includes("not configured");
    return NextResponse.json(
      { error: unavailable ? "Secure upload verification is unavailable." : "The upload session is invalid or expired." },
      { status: unavailable ? 503 : 403 }
    );
  }
  if (!isCompatibleFirmwareUpload(uploadContract.fileName, uploadContract.contentType)) {
    return NextResponse.json({ error: "Unsupported file content type." }, { status: 400 });
  }

  let creditsRequired = 0;
  let serviceSummary = "";
  try {
    creditsRequired = calculateDesktopRequestCredits(parsed.data.service.primaryServiceId, parsed.data.service.extraServiceIds);
    serviceSummary = buildDesktopServiceSummary(parsed.data.service.primaryServiceId, parsed.data.service.extraServiceIds);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid service selection." }, { status: 400 });
  }
  if (!Number.isInteger(creditsRequired) || creditsRequired <= 0) {
    return NextResponse.json(
      { error: "This service selection cannot be submitted through the desktop app." },
      { status: 400 }
    );
  }

  const admin = getSupabaseAdmin();
  const { folder, name } = splitStoragePath(parsed.data.upload.path);
  const { data: objects, error: storageError } = await admin.storage
    .from("customer-files")
    .list(folder, { search: name, limit: 5 });
  const storedMetadata = exactStoredObjectMetadata(objects, name);
  if (
    storageError ||
    !storedMetadata ||
    storedMetadata.size !== uploadContract.fileSize ||
    storedMetadata.contentType !== uploadContract.contentType
  ) {
    return NextResponse.json({ error: "Uploaded file could not be verified in private storage." }, { status: 400 });
  }

  const { data: storedFile, error: downloadError } = await admin.storage
    .from("customer-files")
    .download(parsed.data.upload.path);
  if (downloadError || !storedFile) {
    return NextResponse.json({ error: "Uploaded file could not be verified in private storage." }, { status: 400 });
  }
  const storedBuffer = Buffer.from(await storedFile.arrayBuffer());
  const storedSha256 = createHash("sha256").update(storedBuffer).digest("hex");
  if (
    storedBuffer.length !== storedMetadata.size ||
    storedSha256 !== uploadContract.sha256
  ) {
    return NextResponse.json({ error: "Uploaded file content does not match the prepared session." }, { status: 400 });
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id,email,customer_id,credit_balance,allow_negative_credits,negative_credit_limit,account_status")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profileError) return NextResponse.json({ error: "Customer access could not be verified." }, { status: 500 });
  const creditError = validateDesktopCreditAccess(profile ?? { credit_balance: null, account_status: "blocked" }, creditsRequired);
  if (creditError) return NextResponse.json({ error: creditError }, { status: 403 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = bearerToken(request);
  if (!supabaseUrl || !supabaseAnonKey || !token) {
    return NextResponse.json({ error: "Authenticated request creation is not configured." }, { status: 500 });
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const approvalToken = randomUUID();
  const customerEmail = auth.user.email ?? profile?.email ?? "";
  const requestPayload = {
    upload_session_id: parsed.data.uploadSessionId,
    customer_email: customerEmail,
    vehicle_brand: parsed.data.vehicle.brand,
    vehicle_model: parsed.data.vehicle.model,
    vehicle_generation: parsed.data.vehicle.generation || null,
    vehicle_engine: parsed.data.vehicle.engine,
    service_type: serviceSummary,
    credits_required: creditsRequired,
    notes: parsed.data.notes || "-",
    ecu: parsed.data.ecu || null,
    gearbox: parsed.data.gearbox || null,
    vehicle_year: parsed.data.vehicle.year || null,
    read_method: parsed.data.readMethod || null,
    license_plate: null,
    hw_sw: parsed.data.hwSw || null,
    master_slave: parsed.data.masterSlave,
    uploaded_file_name: parsed.data.upload.fileName,
    original_file_path: parsed.data.upload.path,
  };
  const approval = await admin.from("desktop_request_approvals").insert({
    approval_token: approvalToken,
    user_id: auth.user.id,
    idempotency_key: safeKey,
    request_payload: requestPayload,
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  });
  if (approval.error) {
    return NextResponse.json(
      { error: "The verified desktop request could not be approved." },
      { status: 503 }
    );
  }

  const { data: createResult, error: rpcError } = await userClient.rpc(
    "create_desktop_order_with_credit_deduction",
    {
      p_idempotency_key: safeKey,
      p_approval_token: approvalToken,
      p_upload_session_id: parsed.data.uploadSessionId,
      p_customer_email: customerEmail,
      p_vehicle_brand: parsed.data.vehicle.brand,
      p_vehicle_model: parsed.data.vehicle.model,
      p_vehicle_generation: parsed.data.vehicle.generation || null,
      p_vehicle_engine: parsed.data.vehicle.engine,
      p_service_type: serviceSummary,
      p_credits_required: creditsRequired,
      p_notes: parsed.data.notes || "-",
      p_ecu: parsed.data.ecu || null,
      p_gearbox: parsed.data.gearbox || null,
      p_vehicle_year: parsed.data.vehicle.year || null,
      p_read_method: parsed.data.readMethod || null,
      p_license_plate: null,
      p_hw_sw: parsed.data.hwSw || null,
      p_master_slave: parsed.data.masterSlave,
      p_uploaded_file_name: parsed.data.upload.fileName,
      p_original_file_path: parsed.data.upload.path,
    }
  );

  if (rpcError) return NextResponse.json({ error: "The request could not be created." }, { status: 400 });

  const rpcPayload = createResult && typeof createResult === "object" && !Array.isArray(createResult)
    ? createResult as { order_id?: unknown; duplicate?: unknown }
    : null;
  const orderId = typeof rpcPayload?.order_id === "string" ? rpcPayload.order_id : "";
  const duplicatePrevented = rpcPayload?.duplicate === true;
  if (!orderId) {
    return NextResponse.json({ error: "The request result could not be verified." }, { status: 500 });
  }
  if (!duplicatePrevented) {
    await sendRequestCreatedNotifications({
      requestId: orderId,
      customerEmail: auth.user.email,
      vehicle: `${parsed.data.vehicle.brand} ${parsed.data.vehicle.model} ${parsed.data.vehicle.engine}`.trim(),
      service: serviceSummary,
      credits: creditsRequired,
    });
  }

  return NextResponse.json({
    request: {
      id: orderId,
      uploaded_file_name: parsed.data.upload.fileName,
      credits_required: creditsRequired,
      service_type: serviceSummary,
    },
    duplicatePrevented,
    uploadSessionId: parsed.data.uploadSessionId,
    submittedVia: "desktop_app",
    appVersion: app.info.appVersion,
    approvedForLearning: false,
    rawHexReturned: false,
    privateMetadataReturned: false,
  });
}
