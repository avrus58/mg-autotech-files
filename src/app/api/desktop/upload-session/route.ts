import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/apiAuth";
import { requireDesktopAppAllowed } from "@/lib/desktopUpload/appCheck";
import {
  calculateDesktopRequestCredits,
  desktopUploadSessionIdFor,
  isValidSha256,
  normalizeDesktopIdempotencyKey,
  safeDesktopFileName,
  validateDesktopCreditAccess,
  validateDesktopUploadFile,
} from "@/lib/desktopUpload/contracts";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

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

  const parsed = uploadSessionSchema.safeParse(await request.json().catch(() => null));
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

  const admin = getSupabaseAdmin();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id,credit_balance,allow_negative_credits,negative_credit_limit,account_status")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

  const creditError = validateDesktopCreditAccess(profile ?? { credit_balance: null, account_status: "blocked" }, creditsRequired);
  if (creditError) return NextResponse.json({ error: creditError }, { status: 403 });

  const path = `${auth.user.id}/desktop/${safeKey}/${safeDesktopFileName(parsed.data.fileName)}`;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return NextResponse.json({ error: "Supabase URL is not configured." }, { status: 500 });

  return NextResponse.json({
    upload: {
      bucket: "customer-files",
      path,
      storageObjectUrl: `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/customer-files/${path.split("/").map(encodeURIComponent).join("/")}`,
      contentType: parsed.data.contentType || "application/octet-stream",
      upsert: false,
    },
    uploadSessionId: desktopUploadSessionIdFor(safeKey),
    creditsRequired,
    idempotencyKey: safeKey,
    installationId: app.info.installationId,
    appVersion: app.info.appVersion,
    rawFileStoredByDesktop: false,
    note: "Upload this exact file once, then call finalize. The server verifies ownership and object existence before creating the request.",
  });
}
