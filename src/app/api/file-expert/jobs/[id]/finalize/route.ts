import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  analyzeFileExpertJob,
  getCurrentServerUser,
  isExpectedFileExpertStoragePath,
  isFileExpertAdmin,
  safeFileExpertAnalysisError,
} from "@/lib/fileExpert/server";
import {
  redactBinaryPreviews,
  redactFileExpertResultForCustomer,
} from "@/lib/fileExpert/publicResult";
import { checkFileExpertAnalysisRate } from "@/lib/fileExpert/requestSecurity";
import { fileExpertRouteOperationBudgetMs } from "@/lib/fileExpert/executionBudget";

export const maxDuration = 60;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const operationDeadlineAt = Date.now() + fileExpertRouteOperationBudgetMs;
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
    .select("id, user_id, status, ori_file_path, mod_file_path")
    .eq("id", id)
    .single();

  if (error || !job) {
    return NextResponse.json({ error: "Analysis job not found." }, { status: 404 });
  }
  if (!isAdmin && job.user_id !== user.id) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }
  const rate = await checkFileExpertAnalysisRate({
    request,
    userId: user.id,
    jobId: id,
    isAdmin,
  });
  if (rate.unavailable) {
    return NextResponse.json(
      { error: "Analysis capacity is temporarily unavailable." },
      { status: 503, headers: rate.headers }
    );
  }
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many analysis attempts. Please wait before trying again." },
      { status: 429, headers: rate.headers }
    );
  }
  if (!job.ori_file_path && !job.mod_file_path) {
    return NextResponse.json({ error: "No uploaded file is attached to this job." }, { status: 400 });
  }
  if (
    !job.user_id ||
    !isExpectedFileExpertStoragePath(job.ori_file_path, job.user_id, id) ||
    !isExpectedFileExpertStoragePath(job.mod_file_path, job.user_id, id)
  ) {
    return NextResponse.json({ error: "Invalid upload path." }, { status: 403 });
  }
  try {
    const result = await analyzeFileExpertJob(id, { operationDeadlineAt });
    return NextResponse.json({
      status: "completed",
      result: isAdmin ? redactBinaryPreviews(result) : redactFileExpertResultForCustomer(result),
    });
  } catch (analysisError) {
    const safeError = safeFileExpertAnalysisError(analysisError);
    return NextResponse.json(
      {
        status: safeError.status === 409 ? "processing" : "failed",
        error: safeError.message,
      },
      { status: safeError.status }
    );
  }
}
