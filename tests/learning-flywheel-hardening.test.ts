import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  getLearningAuthorizationPublicConfig,
  resolveLearningAuthorizationConfig,
  resolveLearningFlywheelFlags,
} from "../src/lib/ecuIntelligence/learningConfig";

const root = process.cwd();

function file(path: string) {
  return readFileSync(join(root, path), "utf8");
}

test("learning flywheel feature flags fail closed and remain independent", () => {
  assert.deepEqual(resolveLearningFlywheelFlags({}), {
    fileCandidatesEnabled: false,
    pairCandidatesEnabled: false,
    approvalEnabled: false,
    backfillEnabled: false,
  });
  assert.deepEqual(resolveLearningFlywheelFlags({
    LEARNING_FLYWHEEL_FILE_CANDIDATES_ENABLED: "true",
    LEARNING_FLYWHEEL_PAIR_CANDIDATES_ENABLED: "TRUE",
    LEARNING_FLYWHEEL_APPROVAL_ENABLED: "1",
    LEARNING_FLYWHEEL_BACKFILL_ENABLED: "false",
  }), {
    fileCandidatesEnabled: true,
    pairCandidatesEnabled: false,
    approvalEnabled: false,
    backfillEnabled: false,
  });
});

test("learning authorization is unavailable without a complete approved configuration", () => {
  assert.equal(resolveLearningAuthorizationConfig({}).available, false);
  assert.equal(resolveLearningAuthorizationConfig({
    LEARNING_AUTHORIZATION_CAPTURE_ENABLED: "true",
    LEARNING_AUTHORIZATION_TERMS_URL: "https://example.test/terms",
  }).available, false);
  assert.equal(resolveLearningAuthorizationConfig({
    LEARNING_AUTHORIZATION_CAPTURE_ENABLED: "true",
    LEARNING_AUTHORIZATION_TERMS_VERSION: "owner-approved-v1",
    LEARNING_AUTHORIZATION_TERMS_URL: "http://example.test/terms",
  }).available, false);
  assert.equal(resolveLearningAuthorizationConfig({
    LEARNING_AUTHORIZATION_CAPTURE_ENABLED: "true",
    LEARNING_AUTHORIZATION_TERMS_VERSION: "owner-approved-v1",
    LEARNING_AUTHORIZATION_TERMS_URL: "https://example.test/terms",
  }).available, true);
  assert.deepEqual(getLearningAuthorizationPublicConfig({}), {
    available: false,
    termsVersion: null,
    termsUrl: null,
    choiceRequiredForPurchase: false,
    defaultChoice: null,
  });
});

test("hardening migration adds durable private state and preserves DTC OR semantics", () => {
  const sql = file("supabase/migrations/20260716005208_learning_flywheel_production_readiness_hardening.sql");
  assert.match(sql, /create table if not exists public\.ai_learning_authorization_records/i);
  assert.match(sql, /create table if not exists public\.ai_learning_ingestion_jobs/i);
  assert.match(sql, /idempotency_key text not null unique/i);
  assert.match(sql, /status in \('pending', 'running', 'succeeded', 'failed', 'timed_out'\)/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /Customers or staff can read DTC status projection/i);
  assert.match(sql, /\(select auth\.uid\(\)\) = user_id/i);
  assert.match(sql, /or \(select public\.has_staff_permission\('ai_training\.manage'\)\)/i);
  assert.match(sql, /revoke all on public\.dtc_request_status_public from authenticated/i);
  assert.match(sql, /grant select on public\.dtc_request_status_public to authenticated/i);
  assert.doesNotMatch(sql, /drop\s+(table|column)|truncate|delete\s+from|firmware_bytes|raw_hex/i);
});

test("candidate ingestion is server gated, bounded, durable and isolated from core flows", () => {
  const ingestion = file("src/lib/ecuIntelligence/learningIngestion.ts");
  const customerRoute = file("src/app/api/requests/[id]/learning-candidate/route.ts");
  const desktopRoute = file("src/app/api/desktop/requests/finalize/route.ts");
  const deliveryRoute = file("src/app/api/admin/orders/[id]/complete-delivery/route.ts");

  assert.match(ingestion, /resolveLearningFlywheelFlags/);
  assert.match(ingestion, /captureWithTimeout/);
  assert.match(ingestion, /ai_learning_ingestion_jobs/);
  assert.match(ingestion, /action:\s*`\$\{input\.jobType\}_failed`/);
  assert.match(ingestion, /backfill_recovered/);
  assert.match(customerRoute, /captureLearningFileCandidate/);
  assert.match(desktopRoute, /captureLearningFileCandidate/);
  assert.match(deliveryRoute, /captureLearningPairCandidate/);
  assert.match(deliveryRoute, /notificationStatus/);
  assert.match(deliveryRoute, /approvedForLearningAutomatically:\s*false/);
});

test("authorization APIs and clients support explicit unselected grant or denial without corpus leakage", () => {
  const web = file("src/app/new-request/page.tsx");
  const desktop = file("apps/customer-uploader/src/App.tsx");
  const captureRoute = file("src/app/api/requests/[id]/learning-authorization/route.ts");
  const pairRoute = file("src/app/api/admin/ai/learning-corpus/pairs/[pairId]/route.ts");
  const corpusPage = file("src/app/admin/ai-training/corpus/page.tsx");

  assert.match(web, /setLearningAuthorizationChoice[\s\S]*"grant"/);
  assert.match(web, /setLearningAuthorizationChoice[\s\S]*"deny"/);
  assert.match(web, /useState<"grant" \| "deny" \| null>\(null\)/);
  assert.match(desktop, /useState<"grant" \| "deny" \| null>\(null\)/);
  assert.match(captureRoute, /requireApiUser/);
  assert.match(captureRoute, /captureSource:\s*"web"/);
  assert.doesNotMatch(captureRoute, /sha256|storage_path|quality_score|pair_candidate/i);
  assert.doesNotMatch(pairRoute, /learningAuthorizationStatus|learningAuthorizationTermsVersion/);
  assert.doesNotMatch(corpusPage, /customer-learning-terms-v1|setAuthorizationGranted/);
});

test("approval and backfill have independent server-side fail-closed gates", () => {
  const flywheel = file("src/lib/ecuIntelligence/learningFlywheel.ts");
  const backfill = file("src/app/api/admin/ai/learning-corpus/backfill/route.ts");
  assert.match(flywheel, /approval_feature_disabled/);
  assert.match(flywheel, /Learning approval is disabled/);
  assert.match(flywheel, /backfill_feature_disabled/);
  assert.match(flywheel, /Learning backfill is disabled/);
  assert.match(backfill, /requireStaffPermission\(request,\s*"ai_training\.manage"\)/);
  assert.match(backfill, /recoverFailedLearningIngestionJobs/);
});

test("staff observability is aggregate-only and not exposed from customer APIs", () => {
  const observability = file("src/lib/ecuIntelligence/learningObservability.ts");
  const staffRoute = file("src/app/api/admin/ai/learning-corpus/route.ts");
  const customerRoute = file("src/app/api/requests/[id]/learning-candidate/route.ts");
  for (const field of [
    "fileCandidateAttempts",
    "fileCandidateSuccesses",
    "fileCandidateFailures",
    "fileCandidateDuplicateHits",
    "pairCandidateAttempts",
    "pairCandidateSuccesses",
    "pairCandidateFailures",
    "pendingReviewCount",
    "authorizationNotGrantedCount",
    "authorizationGrantedCount",
    "approvalBlockedCount",
    "backfillRecoveryCount",
    "oldestPendingCandidate",
    "ingestionEngineVersion",
  ]) assert.match(observability, new RegExp(field));
  assert.match(staffRoute, /requireStaffPermission\(request,\s*"ai_training\.manage"\)/);
  assert.doesNotMatch(customerRoute, /observability|qualityScore|authorizationGrantedCount/);
});

test("email dry-run has a deterministic failure path and service credentials stay server-only", () => {
  const emailService = file("src/lib/email/service.ts");
  const browserSources = [
    file("src/app/new-request/page.tsx"),
    file("apps/customer-uploader/src/App.tsx"),
    file("apps/customer-uploader/src/api.ts"),
  ].join("\n");
  assert.match(emailService, /EMAIL_DRY_RUN_FORCE_FAILURE/);
  assert.doesNotMatch(browserSources, /SUPABASE_SERVICE_ROLE_KEY|service_role/i);
});

test("versioned release policy keeps production automation disabled and legal wording owner-controlled", () => {
  const policy = file("docs/production-release-policy-v1.0.md");
  assert.match(policy, /Policy version: 1\.0/);
  assert.match(policy, /DTC_GLOBAL_KILL_SWITCH_ENGAGED=true/);
  assert.match(policy, /OWNER\/LEGAL PLACEHOLDER/);
  assert.match(policy, /automatic historical backfill/i);
  assert.match(policy, /A3, A4, and A5 automation/i);
  assert.match(policy, /does not authorize a production deployment/i);
});
