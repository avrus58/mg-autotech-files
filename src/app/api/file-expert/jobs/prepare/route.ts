import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  requireFileExpertUser,
  sanitizeFileExpertName,
  validateFileExpertDescriptor,
} from "@/lib/fileExpert/server";
import { fileExpertTextLimits } from "@/lib/fileExpert/limits";
import { checkFileExpertCreateRate } from "@/lib/fileExpert/requestSecurity";
import { BoundedRequestBodyError, readBoundedJsonBody } from "@/lib/boundedRequestBody";

const fileDescriptorSchema = z.object({
  name: z.string().min(1).max(255),
  size: z.number().int().positive(),
  type: z.string().max(150).optional().default("application/octet-stream"),
});

const prepareSchema = z.object({
  brand: z.string().max(fileExpertTextLimits.brand).optional().default(""),
  model: z.string().max(fileExpertTextLimits.model).optional().default(""),
  engine: z.string().max(fileExpertTextLimits.engine).optional().default(""),
  ecuType: z.string().max(fileExpertTextLimits.ecuType).optional().default(""),
  readMethod: z.enum(["OBD", "Bench", "Boot", "VR", "Unknown"]).default("Unknown"),
  customerNotes: z.string().max(fileExpertTextLimits.customerNotes).optional().default(""),
  oriFile: fileDescriptorSchema.nullable().optional(),
  modFile: fileDescriptorSchema.nullable().optional(),
});

export async function POST(request: Request) {
  const auth = await requireFileExpertUser(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const user = auth.user;
  if (!user.email_confirmed_at && !user.confirmed_at) {
    return NextResponse.json({ error: "Please verify your e-mail address first." }, { status: 403 });
  }
  const rate = await checkFileExpertCreateRate(request, user.id);
  if (rate.unavailable) {
    return NextResponse.json(
      { error: "Analysis capacity is temporarily unavailable." },
      { status: 503, headers: rate.headers }
    );
  }
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many analysis jobs. Please wait before trying again." },
      { status: 429, headers: rate.headers }
    );
  }
  let requestBody: unknown;
  try {
    requestBody = await readBoundedJsonBody(request, 64 * 1024);
  } catch (error) {
    const status = error instanceof BoundedRequestBodyError ? error.status : 400;
    return NextResponse.json({ error: "Analysis metadata is invalid or too large." }, { status });
  }
  const parsed = prepareSchema.safeParse(requestBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid analysis data." },
      { status: 400 }
    );
  }

  const { oriFile, modFile } = parsed.data;
  if (!oriFile && !modFile) {
    return NextResponse.json({ error: "Please select at least one ORI or MOD file." }, { status: 400 });
  }

  for (const file of [oriFile, modFile]) {
    if (!file) continue;
    const validation = validateFileExpertDescriptor(file);
    if (validation) return NextResponse.json({ error: validation }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: job, error: createError } = await supabaseAdmin
    .from("file_expert_jobs")
    .insert({
      user_id: user.id,
      status: "pending",
      brand: parsed.data.brand.trim() || null,
      model: parsed.data.model.trim() || null,
      engine: parsed.data.engine.trim() || null,
      ecu_type: parsed.data.ecuType.trim() || null,
      read_method: parsed.data.readMethod,
      customer_notes: parsed.data.customerNotes.trim() || null,
      ori_file_name: oriFile?.name ?? null,
      mod_file_name: modFile?.name ?? null,
      ori_file_size: oriFile?.size ?? null,
      mod_file_size: modFile?.size ?? null,
    })
    .select("id")
    .single();

  if (createError || !job) {
    return NextResponse.json({ error: "Analysis job could not be created." }, { status: 500 });
  }

  const basePath = `${user.id}/${job.id}`;
  const oriPath = oriFile ? `${basePath}/ori-${sanitizeFileExpertName(oriFile.name)}` : null;
  const modPath = modFile ? `${basePath}/mod-${sanitizeFileExpertName(modFile.name)}` : null;
  const { error: updateError } = await supabaseAdmin
    .from("file_expert_jobs")
    .update({ ori_file_path: oriPath, mod_file_path: modPath })
    .eq("id", job.id);

  if (updateError) {
    await supabaseAdmin.from("file_expert_jobs").delete().eq("id", job.id);
    return NextResponse.json({ error: "Analysis job could not be prepared." }, { status: 500 });
  }

  let oriToken: string | null = null;
  let modToken: string | null = null;
  if (oriPath) {
    const signed = await supabaseAdmin.storage
      .from("file-expert")
      .createSignedUploadUrl(oriPath, { upsert: false });
    if (signed.error || !signed.data?.token) {
      await supabaseAdmin.from("file_expert_jobs").delete().eq("id", job.id);
      return NextResponse.json({ error: "ORI upload could not be prepared securely." }, { status: 503 });
    }
    oriToken = signed.data.token;
  }
  if (modPath) {
    const signed = await supabaseAdmin.storage
      .from("file-expert")
      .createSignedUploadUrl(modPath, { upsert: false });
    if (signed.error || !signed.data?.token) {
      await supabaseAdmin.from("file_expert_jobs").delete().eq("id", job.id);
      return NextResponse.json({ error: "MOD upload could not be prepared securely." }, { status: 503 });
    }
    modToken = signed.data.token;
  }

  return NextResponse.json({
    jobId: job.id,
    uploads: {
      ori: oriFile ? { path: oriPath, token: oriToken, contentType: oriFile.type || "application/octet-stream" } : null,
      mod: modFile ? { path: modPath, token: modToken, contentType: modFile.type || "application/octet-stream" } : null,
    },
  });
}
