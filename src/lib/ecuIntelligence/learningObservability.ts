import {
  getLearningFlywheelStaffState,
  learningFlywheelEngineVersion,
} from "@/lib/ecuIntelligence/learningConfig";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type CountResult = { count: number | null; error: { message: string } | null };

function countOf(result: CountResult) {
  if (result.error) throw new Error(result.error.message);
  return result.count ?? 0;
}

export async function getLearningFlywheelObservability() {
  const admin = getSupabaseAdmin();
  const eventCount = (action: string) => admin
    .from("ai_learning_review_events")
    .select("id", { count: "exact", head: true })
    .eq("action", action);
  const pairAuthorizationCount = (status: string) => admin
    .from("ai_learning_pair_candidates")
    .select("id", { count: "exact", head: true })
    .eq("learning_authorization_status", status);

  const [
    fileAttempts,
    fileSuccesses,
    fileFailures,
    fileDuplicates,
    pairAttempts,
    pairSuccesses,
    pairFailures,
    pairDuplicates,
    pendingReview,
    authorizationNotGranted,
    authorizationGranted,
    approvalBlocked,
    backfillRecovery,
    oldestPair,
    oldestFile,
  ] = await Promise.all([
    eventCount("file_candidate_attempted"),
    eventCount("file_candidate_succeeded"),
    eventCount("file_candidate_failed"),
    eventCount("file_candidate_duplicate"),
    eventCount("pair_candidate_attempted"),
    eventCount("pair_candidate_succeeded"),
    eventCount("pair_candidate_failed"),
    eventCount("pair_candidate_duplicate"),
    admin
      .from("ai_learning_pair_candidates")
      .select("id", { count: "exact", head: true })
      .in("review_status", ["pending_review", "needs_review"]),
    pairAuthorizationCount("not_granted"),
    pairAuthorizationCount("granted"),
    eventCount("approval_blocked"),
    eventCount("backfill_recovered"),
    admin
      .from("ai_learning_pair_candidates")
      .select("created_at")
      .in("review_status", ["pending_review", "needs_review"])
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    admin
      .from("ai_learning_file_candidates")
      .select("created_at")
      .in("review_status", ["pending_review", "needs_review"])
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  if (oldestPair.error) throw new Error(oldestPair.error.message);
  if (oldestFile.error) throw new Error(oldestFile.error.message);
  const oldestPendingCandidate = [oldestPair.data?.created_at, oldestFile.data?.created_at]
    .filter((value): value is string => Boolean(value))
    .sort()[0] ?? null;

  return {
    fileCandidateAttempts: countOf(fileAttempts),
    fileCandidateSuccesses: countOf(fileSuccesses),
    fileCandidateFailures: countOf(fileFailures),
    fileCandidateDuplicateHits: countOf(fileDuplicates),
    pairCandidateAttempts: countOf(pairAttempts),
    pairCandidateSuccesses: countOf(pairSuccesses),
    pairCandidateFailures: countOf(pairFailures),
    pairCandidateDuplicateHits: countOf(pairDuplicates),
    pendingReviewCount: countOf(pendingReview),
    authorizationNotGrantedCount: countOf(authorizationNotGranted),
    authorizationGrantedCount: countOf(authorizationGranted),
    approvalBlockedCount: countOf(approvalBlocked),
    backfillRecoveryCount: countOf(backfillRecovery),
    oldestPendingCandidate,
    ingestionEngineVersion: learningFlywheelEngineVersion,
    configuration: getLearningFlywheelStaffState(),
  };
}
