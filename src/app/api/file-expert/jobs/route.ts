import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  analyzeFileExpertJob,
  fileExpertBucket,
  getCurrentServerUser,
  getFileHashes,
  isFileExpertAdmin,
  sanitizeFileExpertName,
  validateFileExpertFile,
} from "@/lib/fileExpert/server";

const createJobSchema = z.object({
  brand: z.string().max(100).optional().default(""),
  model: z.string().max(100).optional().default(""),
  engine: z.string().max(100).optional().default(""),
  ecuType: z.string().max(120).optional().default(""),
  readMethod: z.enum(["OBD", "Bench", "Boot", "VR", "Unknown"]).default("Unknown"),
  customerNotes: z.string().max(2000).optional().default(""),
});

function getOptionalFile(formData: FormData, key: string) {
  const value = formData.get(key);
  return value instanceof File && value.size > 0 ? value : null;
}

async function fileToBuffer(file: File | null) {
  if (!file) return null;
  return Buffer.from(await file.arrayBuffer());
}

export async function GET(request: Request) {
  const user = await getCurrentServerUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const includeAll = url.searchParams.get("all") === "1";
  const supabaseAdmin = getSupabaseAdmin();
  const isAdmin = await isFileExpertAdmin(user.id);

  let query = supabaseAdmin
    .from("file_expert_jobs")
    .select("*")
    .order("created_at", { ascending: false });

  if (!includeAll || !isAdmin) query = query.eq("user_id", user.id);

  const { data, error } = await query.limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ jobs: data ?? [] });
}

export async function POST(request: Request) {
  const user = await getCurrentServerUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.email_confirmed_at && !user.confirmed_at) {
    return NextResponse.json({ error: "Please verify your e-mail address first." }, { status: 403 });
  }

  const formData = await request.formData();
  const parsed = createJobSchema.safeParse({
    brand: formData.get("brand")?.toString() || "",
    model: formData.get("model")?.toString() || "",
    engine: formData.get("engine")?.toString() || "",
    ecuType: formData.get("ecuType")?.toString() || "",
    readMethod: formData.get("readMethod")?.toString() || "Unknown",
    customerNotes: formData.get("customerNotes")?.toString() || "",
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid form data." }, { status: 400 });
  }

  const oriFile = getOptionalFile(formData, "oriFile");
  const modFile = getOptionalFile(formData, "modFile");

  if (!oriFile && !modFile) {
    return NextResponse.json({ error: "Please upload at least one ORI or MOD file." }, { status: 400 });
  }

  for (const file of [oriFile, modFile]) {
    const validation = validateFileExpertFile(file);
    if (file && validation) return NextResponse.json({ error: validation }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const oriBuffer = await fileToBuffer(oriFile);
  const modBuffer = await fileToBuffer(modFile);
  const hashes = await getFileHashes({ ori: oriBuffer, mod: modBuffer });

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
      ...hashes,
    })
    .select("*")
    .single();

  if (createError || !job) {
    return NextResponse.json({ error: createError?.message || "Job could not be created." }, { status: 500 });
  }

  const userFolder = user.id || "anonymous";
  const basePath = `${userFolder}/${job.id}`;
  const oriPath = oriFile ? `${basePath}/ori-${sanitizeFileExpertName(oriFile.name)}` : null;
  const modPath = modFile ? `${basePath}/mod-${sanitizeFileExpertName(modFile.name)}` : null;

  try {
    if (oriFile && oriBuffer && oriPath) {
      const { error } = await supabaseAdmin.storage
        .from(fileExpertBucket)
        .upload(oriPath, oriBuffer, { contentType: oriFile.type || "application/octet-stream", upsert: false });
      if (error) throw error;
    }

    if (modFile && modBuffer && modPath) {
      const { error } = await supabaseAdmin.storage
        .from(fileExpertBucket)
        .upload(modPath, modBuffer, { contentType: modFile.type || "application/octet-stream", upsert: false });
      if (error) throw error;
    }

    const { error: updateError } = await supabaseAdmin
      .from("file_expert_jobs")
      .update({ ori_file_path: oriPath, mod_file_path: modPath })
      .eq("id", job.id);

    if (updateError) throw updateError;

    try {
      await analyzeFileExpertJob(job.id);
      return NextResponse.json({ jobId: job.id, status: "completed" });
    } catch (analysisError) {
      return NextResponse.json(
        {
          jobId: job.id,
          status: "failed",
          error: analysisError instanceof Error ? analysisError.message : "Analysis failed.",
        },
        { status: 202 }
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    await supabaseAdmin
      .from("file_expert_jobs")
      .update({ status: "failed", error_message: message })
      .eq("id", job.id);
    return NextResponse.json({ jobId: job.id, error: message }, { status: 500 });
  }
}
