import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getCurrentServerUser,
  sanitizeFileExpertName,
  validateFileExpertDescriptor,
} from "@/lib/fileExpert/server";

const fileDescriptorSchema = z.object({
  name: z.string().min(1).max(255),
  size: z.number().int().positive(),
  type: z.string().max(150).optional().default("application/octet-stream"),
});

const prepareSchema = z.object({
  brand: z.string().max(100).optional().default(""),
  model: z.string().max(100).optional().default(""),
  engine: z.string().max(100).optional().default(""),
  ecuType: z.string().max(120).optional().default(""),
  readMethod: z.enum(["OBD", "Bench", "Boot", "VR", "Unknown"]).default("Unknown"),
  customerNotes: z.string().max(2000).optional().default(""),
  oriFile: fileDescriptorSchema.nullable().optional(),
  modFile: fileDescriptorSchema.nullable().optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentServerUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.email_confirmed_at && !user.confirmed_at) {
    return NextResponse.json({ error: "Please verify your e-mail address first." }, { status: 403 });
  }

  const parsed = prepareSchema.safeParse(await request.json().catch(() => null));
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
    return NextResponse.json({ error: createError?.message || "Analysis job could not be created." }, { status: 500 });
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
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    jobId: job.id,
    uploads: {
      ori: oriFile ? { path: oriPath, contentType: oriFile.type || "application/octet-stream" } : null,
      mod: modFile ? { path: modPath, contentType: modFile.type || "application/octet-stream" } : null,
    },
  });
}
