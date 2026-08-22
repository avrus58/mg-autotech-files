import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isFileExpertAdmin, requireFileExpertUser } from "@/lib/fileExpert/server";
import {
  redactBinaryPreviews,
  sanitizeFileExpertJobForCustomer,
} from "@/lib/fileExpert/publicResult";
import {
  buildPublicSimilarityEvidence,
  getStoredSimilarityResults,
} from "@/lib/ecuIntelligence/similarity";
import {
  buildPublicClusterEvidence,
  findClusterEvidenceForFileExpert,
} from "@/lib/ecuIntelligence/clustering";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const auth = await requireFileExpertUser(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const user = auth.user;

  const supabaseAdmin = getSupabaseAdmin();
  const isAdmin = await isFileExpertAdmin(user.id);

  const { data: job, error } = await supabaseAdmin
    .from("file_expert_jobs")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !job) {
    return NextResponse.json(
      { error: "File Expert job not found." },
      { status: 404 }
    );
  }

  if (!isAdmin && job.user_id !== user.id) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const [{ data: fingerprints }, { data: feedback }, similarityResult, clusterResult] = await Promise.all([
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
    getStoredSimilarityResults("file_expert_job", id).catch(() => null),
    job.result_json
      ? findClusterEvidenceForFileExpert(job, job.result_json).catch(() => null)
      : Promise.resolve(null),
  ]);

  const safeJob = isAdmin
    ? {
        ...job,
        result_json: redactBinaryPreviews(job.result_json),
      }
    : sanitizeFileExpertJobForCustomer(job as Record<string, unknown>);

  return NextResponse.json({
    job: safeJob,
    fingerprints: isAdmin ? fingerprints ?? [] : [],
    feedback: feedback ?? [],
    isAdmin,
    similarityEvidence: similarityResult
      ? isAdmin
        ? similarityResult
        : buildPublicSimilarityEvidence(similarityResult)
      : null,
    clusterEvidence: clusterResult
      ? isAdmin
        ? clusterResult
        : buildPublicClusterEvidence(clusterResult)
      : null,
  });
}
