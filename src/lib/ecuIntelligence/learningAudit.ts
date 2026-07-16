import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function recordLearningAuditEvent(input: {
  requestId?: string | null;
  fileCandidateId?: string | null;
  pairCandidateId?: string | null;
  action: string;
  oldValue?: unknown;
  newValue?: unknown;
  actorUserId?: string | null;
  notes?: string | null;
}) {
  try {
    const result = await getSupabaseAdmin().from("ai_learning_review_events").insert({
      request_id: input.requestId ?? null,
      file_candidate_id: input.fileCandidateId ?? null,
      pair_candidate_id: input.pairCandidateId ?? null,
      action: input.action,
      old_value: input.oldValue ?? {},
      new_value: input.newValue ?? {},
      actor_id: input.actorUserId ?? null,
      notes: input.notes ?? null,
    });
    return { ok: !result.error, error: result.error?.message ?? null };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Learning audit event could not be recorded.",
    };
  }
}
