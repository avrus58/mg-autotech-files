import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/apiAuth";
import { requireDesktopAppAllowed } from "@/lib/desktopUpload/appCheck";
import {
  buildDesktopServiceSummary,
  calculateDesktopRequestCredits,
  desktopUploadSessionIdFor,
  isValidSha256,
  normalizeDesktopIdempotencyKey,
  safeDesktopFileName,
  validateDesktopCreditAccess,
  validateDesktopUploadFile,
} from "@/lib/desktopUpload/contracts";
import { createLearningFileCandidateForOrderUpload } from "@/lib/ecuIntelligence/learningFlywheel";
import { sendRequestCreatedNotifications } from "@/lib/email/events";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const finalizeSchema = z.object({
  idempotencyKey: z.string().trim().min(12).max(120),
  uploadSessionId: z.string().trim().min(12).max(140),
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

function storageFolder(path: string) {
  const parts = path.split("/");
  const name = parts.pop() || "";
  return { folder: parts.join("/"), name };
}

function uploadPathFor(userId: string, idempotencyKey: string, fileName: string) {
  return `${userId}/desktop/${normalizeDesktopIdempotencyKey(idempotencyKey)}/${safeDesktopFileName(fileName)}`;
}

export async function POST(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const app = requireDesktopAppAllowed(request);
  if (!app.ok) return app.response;

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

  const expectedPath = uploadPathFor(auth.user.id, parsed.data.idempotencyKey, parsed.data.upload.fileName);
  if (parsed.data.upload.path !== expectedPath) {
    return NextResponse.json({ error: "Upload path does not match the authenticated customer session." }, { status: 403 });
  }
  if (parsed.data.uploadSessionId !== desktopUploadSessionIdFor(parsed.data.idempotencyKey)) {
    return NextResponse.json({ error: "Upload session does not match the authenticated desktop request." }, { status: 403 });
  }

  let creditsRequired = 0;
  let serviceSummary = "";
  try {
    creditsRequired = calculateDesktopRequestCredits(parsed.data.service.primaryServiceId, parsed.data.service.extraServiceIds);
    serviceSummary = buildDesktopServiceSummary(parsed.data.service.primaryServiceId, parsed.data.service.extraServiceIds);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid service selection." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: existingOrder, error: existingError } = await admin
    .from("orders")
    .select("id, customer_id, original_file_path, uploaded_file_name, status, created_at")
    .eq("customer_id", auth.user.id)
    .eq("original_file_path", parsed.data.upload.path)
    .maybeSingle();
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
  if (existingOrder?.id) {
    return NextResponse.json({
      request: existingOrder,
      duplicatePrevented: true,
      idempotencyKey: normalizeDesktopIdempotencyKey(parsed.data.idempotencyKey),
      approvedForLearning: false,
      message: "Request already exists for this desktop upload session.",
    });
  }

  const { folder, name } = storageFolder(parsed.data.upload.path);
  const { data: objects, error: storageError } = await admin.storage
    .from("customer-files")
    .list(folder, { search: name, limit: 5 });
  if (storageError || !objects?.some((item) => item.name === name)) {
    return NextResponse.json({ error: "Uploaded file could not be verified in private storage." }, { status: 400 });
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id,email,customer_id,credit_balance,allow_negative_credits,negative_credit_limit,account_status")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
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

  const { data: createdOrderId, error: rpcError } = await userClient.rpc(
    "create_order_with_credit_deduction",
    {
      p_customer_email: auth.user.email ?? profile?.email ?? "",
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

  if (rpcError) return NextResponse.json({ error: rpcError.message }, { status: 400 });

  const orderId = String(createdOrderId || "");
  if (orderId) {
    await sendRequestCreatedNotifications({
      requestId: orderId,
      customerEmail: auth.user.email,
      vehicle: `${parsed.data.vehicle.brand} ${parsed.data.vehicle.model} ${parsed.data.vehicle.engine}`.trim(),
      service: serviceSummary,
      credits: creditsRequired,
    });
  }

  let learningCandidateStatus: string | null = null;
  if (orderId) {
    try {
      const learningCandidate = await createLearningFileCandidateForOrderUpload({
        requestId: orderId,
        actorUserId: auth.user.id,
        sourceType: "desktop_upload",
      });
      learningCandidateStatus = learningCandidate.status;
    } catch {
      learningCandidateStatus = "queued_failed";
    }
  }

  return NextResponse.json({
    request: {
      id: orderId,
      uploaded_file_name: parsed.data.upload.fileName,
      credits_required: creditsRequired,
      service_type: serviceSummary,
    },
    duplicatePrevented: false,
    uploadSessionId: parsed.data.uploadSessionId,
    submittedVia: "desktop_app",
    appVersion: app.info.appVersion,
    approvedForLearning: false,
    learningCandidateStatus,
    rawHexReturned: false,
    privateMetadataReturned: false,
  });
}
