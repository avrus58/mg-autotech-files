import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getCurrentServerUser,
  isFileExpertAdmin,
} from "@/lib/fileExpert/server";
import { sanitizeFileExpertJobsForCustomer } from "@/lib/fileExpert/publicResult";

const jobListColumns = [
  "id",
  "user_id",
  "status",
  "brand",
  "model",
  "engine",
  "ecu_type",
  "read_method",
  "customer_notes",
  "ori_file_name",
  "mod_file_name",
  "ori_sha256",
  "mod_sha256",
  "ori_file_size",
  "mod_file_size",
  "executive_summary",
  "detected_features",
  "confidence_score",
  "risk_level",
  "error_message",
  "created_at",
  "updated_at",
].join(",");

export async function GET(request: Request) {
  const user = await getCurrentServerUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const includeAll = url.searchParams.get("all") === "1";
  const supabaseAdmin = getSupabaseAdmin();
  const isAdmin = await isFileExpertAdmin(user.id);

  let query = supabaseAdmin
    .from("file_expert_jobs")
    .select(jobListColumns)
    .order("created_at", { ascending: false });

  if (!includeAll || !isAdmin) query = query.eq("user_id", user.id);

  const { data, error } = await query.limit(100);
  if (error) return NextResponse.json({ error: "File Expert jobs could not be loaded." }, { status: 500 });

  const jobs = data ?? [];
  return NextResponse.json({
    adminView: includeAll && isAdmin,
    jobs: includeAll && isAdmin ? jobs : sanitizeFileExpertJobsForCustomer(jobs as unknown as Array<Record<string, unknown>>),
  });
}

export async function POST() {
  return NextResponse.json(
    {
      error: "Legacy multipart uploads are disabled. Use the secure prepare and finalize flow.",
    },
    { status: 410, headers: { Allow: "GET" } },
  );
}
