import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getCurrentServerUser, isFileExpertAdmin } from "@/lib/fileExpert/server";
import { redactBinaryPreviews } from "@/lib/fileExpert/publicResult";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const user = await getCurrentServerUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const isAdmin = await isFileExpertAdmin(user.id);

  const { data: job, error } = await supabaseAdmin
    .from("file_expert_jobs")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !job) {
    return NextResponse.json(
      { error: error?.message || "File Expert job not found." },
      { status: 404 }
    );
  }

  if (!isAdmin && job.user_id !== user.id) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const [{ data: fingerprints }, { data: feedback }] = await Promise.all([
    supabaseAdmin
      .from("file_expert_binary_fingerprints")
      .select("*")
      .eq("job_id", id)
      .order("created_at", { ascending: false }),
    isAdmin
      ? supabaseAdmin
          .from("file_expert_feedback")
          .select("*")
          .eq("job_id", id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  return NextResponse.json({
    job: {
      ...job,
      result_json: redactBinaryPreviews(job.result_json),
    },
    fingerprints: fingerprints ?? [],
    feedback: feedback ?? [],
    isAdmin,
  });
}
