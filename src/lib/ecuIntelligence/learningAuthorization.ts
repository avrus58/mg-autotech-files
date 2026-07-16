import { recordLearningAuditEvent } from "@/lib/ecuIntelligence/learningAudit";
import {
  getLearningAuthorizationPublicConfig,
  resolveLearningAuthorizationConfig,
} from "@/lib/ecuIntelligence/learningConfig";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type LearningAuthorizationChoice = "grant" | "deny";
export type LearningAuthorizationCaptureSource = "web" | "desktop" | "admin";

function normalizedSha256(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return /^[a-f0-9]{64}$/.test(normalized) ? normalized : null;
}

function candidateAuthorizationStatus(status: "granted" | "denied" | "revoked") {
  if (status === "granted") return "granted";
  if (status === "revoked") return "revoked";
  return "not_granted";
}

export async function captureLearningAuthorization(input: {
  requestId: string;
  actorUserId: string;
  captureSource: LearningAuthorizationCaptureSource;
  choice: LearningAuthorizationChoice;
  termsVersion: string;
  sourceSha256?: string | null;
}) {
  const config = resolveLearningAuthorizationConfig();
  if (!config.available || !config.termsVersion || !config.termsUrl) {
    throw new Error("Learning authorization capture is unavailable until approved terms are configured.");
  }
  if (input.termsVersion !== config.termsVersion) {
    throw new Error("Learning authorization terms version does not match the current configured version.");
  }

  const admin = getSupabaseAdmin();
  const order = await admin
    .from("orders")
    .select("id, customer_id")
    .eq("id", input.requestId)
    .maybeSingle();
  if (order.error) throw new Error(order.error.message);
  if (!order.data) throw new Error("Request not found.");
  if (input.captureSource !== "admin" && order.data.customer_id !== input.actorUserId) {
    throw new Error("Learning authorization can only be captured for the authenticated customer's request.");
  }

  const authorizationStatus = input.choice === "grant" ? "granted" : "denied";
  let sourceSha256 = normalizedSha256(input.sourceSha256);
  if (!sourceSha256) {
    const candidate = await admin
      .from("ai_learning_file_candidates")
      .select("sha256")
      .eq("request_id", input.requestId)
      .not("sha256", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!candidate.error) sourceSha256 = normalizedSha256(candidate.data?.sha256);
  }
  const idempotencyKey = [
    input.requestId,
    config.termsVersion,
    input.captureSource,
    sourceSha256 ?? "no-source-sha",
  ].join(":");
  const capturedAt = new Date().toISOString();
  const saved = await admin
    .from("ai_learning_authorization_records")
    .upsert({
      idempotency_key: idempotencyKey,
      request_id: input.requestId,
      customer_id: order.data.customer_id,
      actor_user_id: input.actorUserId,
      authorization_status: authorizationStatus,
      terms_version: config.termsVersion,
      terms_url: config.termsUrl,
      capture_source: input.captureSource,
      source_sha256: sourceSha256,
      captured_at: capturedAt,
    }, { onConflict: "idempotency_key" })
    .select("id, authorization_status, terms_version, captured_at")
    .single();
  if (saved.error || !saved.data) {
    throw new Error(saved.error?.message || "Learning authorization record could not be loaded.");
  }

  const candidateStatus = candidateAuthorizationStatus(authorizationStatus);
  const [files, pairs] = await Promise.all([
    admin
      .from("ai_learning_file_candidates")
      .update({
        learning_authorization_status: candidateStatus,
        learning_authorization_terms_version: config.termsVersion,
        updated_at: capturedAt,
      })
      .eq("request_id", input.requestId),
    admin
      .from("ai_learning_pair_candidates")
      .update({
        learning_authorization_status: candidateStatus,
        learning_authorization_terms_version: config.termsVersion,
        updated_at: capturedAt,
      })
      .eq("request_id", input.requestId),
  ]);
  const syncError = files.error || pairs.error;
  if (syncError) throw new Error(syncError.message);

  await recordLearningAuditEvent({
    requestId: input.requestId,
    action: authorizationStatus === "granted" ? "learning_authorization_granted" : "learning_authorization_denied",
    newValue: {
      authorization_status: authorizationStatus,
      terms_version: config.termsVersion,
      capture_source: input.captureSource,
      source_sha256_present: Boolean(sourceSha256),
    },
    actorUserId: input.actorUserId,
    notes: "Versioned learning authorization choice captured separately from core service purchase.",
  });

  return {
    status: authorizationStatus,
    termsVersion: config.termsVersion,
    captureSource: input.captureSource,
    capturedAt: saved.data?.captured_at ?? capturedAt,
    sourceSha256Stored: Boolean(sourceSha256),
  } as const;
}

export async function getCurrentLearningAuthorizationForRequest(requestId: string) {
  const config = resolveLearningAuthorizationConfig();
  if (!config.available || !config.termsVersion) {
    return { status: "not_granted" as const, termsVersion: null };
  }
  const result = await getSupabaseAdmin()
    .from("ai_learning_authorization_records")
    .select("authorization_status, terms_version, captured_at")
    .eq("request_id", requestId)
    .eq("terms_version", config.termsVersion)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (result.error || !result.data) {
    return { status: "not_granted" as const, termsVersion: null };
  }
  return {
    status: candidateAuthorizationStatus(result.data.authorization_status as "granted" | "denied" | "revoked"),
    termsVersion: result.data.terms_version as string,
  };
}

export { getLearningAuthorizationPublicConfig };
