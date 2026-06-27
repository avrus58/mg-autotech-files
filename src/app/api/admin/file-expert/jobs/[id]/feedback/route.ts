import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireFileExpertAdmin, storeConfirmedPatterns } from "@/lib/fileExpert/server";
import type { FileExpertJob } from "@/lib/fileExpert/types";

const actualFeaturesSchema = z.object({
  stock_or_modified: z.boolean().optional(),
  stage1: z.boolean().optional(),
  stage2: z.boolean().optional(),
  dpf_off: z.boolean().optional(),
  egr_off: z.boolean().optional(),
  adblue_off: z.boolean().optional(),
  dtc_off: z.boolean().optional(),
  vmax_off: z.boolean().optional(),
  pop_bangs: z.boolean().optional(),
  tcu_tune: z.boolean().optional(),
  tcu_shift: z.boolean().optional(),
  tcu_lockup: z.boolean().optional(),
});

const feedbackSchema = z.object({
  actualFeatures: actualFeaturesSchema.default({}),
  aiCorrect: z.boolean().nullable().optional(),
  qualityRating: z.number().int().min(1).max(5).nullable().optional(),
  safetyRating: z.enum(["safe", "aggressive", "risky", "unknown"]).nullable().optional(),
  adminNotes: z.string().max(4000).optional().default(""),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const admin = await requireFileExpertAdmin(request);

  if (admin.status !== 200) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const parsed = feedbackSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid feedback." },
      { status: 400 }
    );
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data: job, error: jobError } = await supabaseAdmin
    .from("file_expert_jobs")
    .select("*")
    .eq("id", id)
    .single();

  if (jobError || !job) {
    return NextResponse.json(
      { error: jobError?.message || "File Expert job not found." },
      { status: 404 }
    );
  }

  const { data: feedback, error } = await supabaseAdmin
    .from("file_expert_feedback")
    .insert({
      job_id: id,
      admin_user_id: admin.user.id,
      actual_features: parsed.data.actualFeatures,
      ai_correct: parsed.data.aiCorrect ?? null,
      quality_rating: parsed.data.qualityRating ?? null,
      safety_rating: parsed.data.safetyRating ?? "unknown",
      admin_notes: parsed.data.adminNotes.trim() || null,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await storeConfirmedPatterns({
    job: job as FileExpertJob,
    adminNotes: parsed.data.adminNotes,
    actualFeatures: parsed.data.actualFeatures,
  });

  return NextResponse.json({ feedback });
}
