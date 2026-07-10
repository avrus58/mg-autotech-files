import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  analyzeFileExpertJob,
  getCurrentServerUser,
  isFileExpertAdmin,
} from "@/lib/fileExpert/server";
import {
  redactBinaryPreviews,
  redactFileExpertResultForCustomer,
} from "@/lib/fileExpert/publicResult";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const user = await getCurrentServerUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.email_confirmed_at && !user.confirmed_at) {
    return NextResponse.json({ error: "Please verify your e-mail address first." }, { status: 403 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const isAdmin = await isFileExpertAdmin(user.id);
  const { data: job, error } = await supabaseAdmin
    .from("file_expert_jobs")
    .select("id, user_id, ori_file_path, mod_file_path")
    .eq("id", id)
    .single();

  if (error || !job) {
    return NextResponse.json({ error: error?.message || "Analysis job not found." }, { status: 404 });
  }
  if (!isAdmin && job.user_id !== user.id) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }
  if (!job.ori_file_path && !job.mod_file_path) {
    return NextResponse.json({ error: "No uploaded file is attached to this job." }, { status: 400 });
  }
  if (
    !isAdmin &&
    [job.ori_file_path, job.mod_file_path]
      .filter(Boolean)
      .some((path) => !String(path).startsWith(`${user.id}/${id}/`))
  ) {
    return NextResponse.json({ error: "Invalid upload path." }, { status: 403 });
  }

  try {
    const result = await analyzeFileExpertJob(id);
    return NextResponse.json({
      status: "completed",
      result: isAdmin ? redactBinaryPreviews(result) : redactFileExpertResultForCustomer(result),
    });
  } catch (analysisError) {
    return NextResponse.json(
      {
        status: "failed",
        error: analysisError instanceof Error ? analysisError.message : "Analysis failed.",
      },
      { status: 500 }
    );
  }
}
