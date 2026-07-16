import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const stagingProjectRef = "vxdxdvtsopsjatukdbuq";
const productionProjectRef = "jujaeyvyaeesmipihrrw";
const baseUrl = process.env.E2E_BASE_URL;
const supabaseUrl = process.env.E2E_SUPABASE_URL;
const anonKey = process.env.E2E_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
const expectBackfillEnabled = process.env.E2E_EXPECT_BACKFILL_ENABLED === "true";

for (const [name, value] of Object.entries({ baseUrl, supabaseUrl, anonKey, serviceRoleKey })) {
  if (!value) throw new Error(`Missing required E2E configuration: ${name}`);
}

const appOrigin = new URL(baseUrl).origin;
const databaseOrigin = new URL(supabaseUrl).origin;
const localRun = ["localhost", "127.0.0.1"].includes(new URL(databaseOrigin).hostname);
if (databaseOrigin.includes(productionProjectRef)) {
  throw new Error("Refusing complete-delivery E2E against the production Supabase project.");
}
if (!localRun) {
  if (!databaseOrigin.includes(stagingProjectRef)) throw new Error("Supabase target is not the authorized isolated staging project.");
  if (process.env.ALLOW_NON_LOCAL_STAGING_E2E !== "1") throw new Error("Non-local staging E2E requires ALLOW_NON_LOCAL_STAGING_E2E=1.");
  if (!new URL(appOrigin).hostname.endsWith(".vercel.app")) throw new Error("Application target is not a Vercel Preview deployment.");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const runId = randomUUID();
const password = `E2e-${randomUUID()}-Aa1!`;
const staffEmail = `learning-staff-${runId}@example.test`;
const customerEmail = `learning-customer-${runId}@example.test`;
const orderId = randomUUID();
const missingSourceOrderId = randomUUID();
const createdUserIds = [];
const storagePaths = [];
let createdLocalBucket = false;
let assertions = 0;

function check(condition, message) {
  assertions += 1;
  if (!condition) throw new Error(`E2E assertion failed: ${message}`);
}

function requireData(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

async function createUser(email) {
  const result = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (result.error || !result.data.user) throw new Error(result.error?.message || `Could not create ${email}`);
  createdUserIds.push(result.data.user.id);
  return result.data.user.id;
}

async function signIn(email) {
  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const result = await client.auth.signInWithPassword({ email, password });
  if (result.error || !result.data.session) throw new Error(result.error?.message || `Could not sign in ${email}`);
  return result.data.session.access_token;
}

async function api(path, { token, body, method = "POST" } = {}) {
  const response = await fetch(`${appOrigin}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, payload };
}

async function upload(path, bytes) {
  const result = await admin.storage.from("customer-files").upload(path, bytes, {
    contentType: "application/octet-stream",
    upsert: false,
  });
  if (result.error) throw new Error(`Fixture upload failed: ${result.error.message}`);
  storagePaths.push(path);
}

const sourceBytes = Buffer.from("MG_AUTOTECH_INTERNAL_SYNTHETIC_SOURCE_FIXTURE_V1\nNO_REAL_FIRMWARE\n", "utf8");
const completedBytes = Buffer.from("MG_AUTOTECH_INTERNAL_SYNTHETIC_COMPLETED_FIXTURE_V1\nNO_REAL_FIRMWARE\n", "utf8");

async function cleanup() {
  await admin.from("email_events").delete().in("related_order_id", [orderId, missingSourceOrderId]);
  await admin.from("orders").delete().in("id", [orderId, missingSourceOrderId]);
  if (storagePaths.length) await admin.storage.from("customer-files").remove(storagePaths);
  if (createdLocalBucket) await admin.storage.deleteBucket("customer-files");
  for (const userId of createdUserIds.reverse()) await admin.auth.admin.deleteUser(userId);
}

let failure;
try {
  const bucket = await admin.storage.getBucket("customer-files");
  if (bucket.error) {
    if (!localRun) throw new Error("The isolated staging customer-files bucket is unavailable.");
    const createdBucket = await admin.storage.createBucket("customer-files", {
      public: false,
      fileSizeLimit: 50 * 1024 * 1024,
    });
    if (createdBucket.error) throw new Error(`Local fixture bucket could not be created: ${createdBucket.error.message}`);
    createdLocalBucket = true;
  }
  const staffId = await createUser(staffEmail);
  const customerId = await createUser(customerEmail);
  requireData(await admin.from("profiles").upsert({
    id: staffId,
    email: staffEmail,
    role: "staff",
    staff_role: "calibrator",
    staff_permissions: ["files.upload", "ai_training.manage"],
    account_status: "active",
  }), "staff profile");
  requireData(await admin.from("profiles").upsert({
    id: customerId,
    email: customerEmail,
    role: "customer",
    staff_role: null,
    staff_permissions: [],
    account_status: "active",
  }), "customer profile");

  const sourcePath = `${customerId}/e2e/${runId}/source.synthetic.bin`;
  const completedPath = `${customerId}/modified/${orderId}/completed.synthetic.bin`;
  const missingSourcePath = `${customerId}/e2e/${runId}/missing-source.synthetic.bin`;
  const missingSourceCompletedPath = `${customerId}/modified/${missingSourceOrderId}/completed.synthetic.bin`;
  await upload(sourcePath, sourceBytes);
  await upload(completedPath, completedBytes);
  await upload(missingSourceCompletedPath, completedBytes);

  requireData(await admin.from("orders").insert([
    {
      id: orderId,
      customer_id: customerId,
      customer_email: customerEmail,
      vehicle_brand: "INTERNAL_TEST_ONLY",
      vehicle_model: "SYNTHETIC_FIXTURE",
      vehicle_engine: "NONE",
      service_type: "INTERNAL_TEST_ONLY",
      status: "in_progress",
      uploaded_file_name: "source.synthetic.bin",
      original_file_path: sourcePath,
    },
    {
      id: missingSourceOrderId,
      customer_id: customerId,
      customer_email: customerEmail,
      vehicle_brand: "INTERNAL_TEST_ONLY",
      vehicle_model: "MISSING_SOURCE_FIXTURE",
      vehicle_engine: "NONE",
      service_type: "INTERNAL_TEST_ONLY",
      status: "in_progress",
      uploaded_file_name: "missing-source.synthetic.bin",
      original_file_path: missingSourcePath,
    },
  ]), "orders fixture");

  const staffToken = await signIn(staffEmail);
  const customerToken = await signIn(customerEmail);
  const completedBody = {
    filePath: completedPath,
    fileName: "completed.synthetic.bin",
    label: "final",
    versionId: `e2e-${runId}`,
    uploadedAt: new Date().toISOString(),
  };

  const anonymous = await api(`/api/admin/orders/${orderId}/complete-delivery`, { body: completedBody });
  check(anonymous.status === 401, "anonymous completion must be denied");

  const customerAttempt = await api(`/api/admin/orders/${orderId}/complete-delivery`, { token: customerToken, body: completedBody });
  check(customerAttempt.status === 403, "ordinary customer completion must be denied");

  const mismatched = await api(`/api/admin/orders/${orderId}/complete-delivery`, {
    token: staffToken,
    body: { ...completedBody, filePath: `${staffId}/modified/${orderId}/completed.synthetic.bin` },
  });
  check(mismatched.status === 400, "mismatched order path must be rejected");

  const missingArtifact = await api(`/api/admin/orders/${orderId}/complete-delivery`, {
    token: staffToken,
    body: { ...completedBody, filePath: `${customerId}/modified/${orderId}/missing.synthetic.bin` },
  });
  check(missingArtifact.status === 400, "missing completed artifact must be rejected");

  const completed = await api(`/api/admin/orders/${orderId}/complete-delivery`, { token: staffToken, body: completedBody });
  check(completed.status === 200, "authorized completion must succeed");
  check(completed.payload.order?.status === "completed", "order must remain completed");
  check(["created", "updated"].includes(completed.payload.learningPair?.status), "first pair capture must succeed");
  check(completed.payload.notificationStatus !== "sent", "E2E must not send a production email");
  check(!localRun || completed.payload.notificationStatus === "failed", "local mocked notification failure must be observed");
  check(completed.payload.createsTrainingSampleAutomatically === false, "delivery must not create training samples automatically");
  check(completed.payload.approvedForLearningAutomatically === false, "delivery must not approve learning automatically");

  const repeated = await api(`/api/admin/orders/${orderId}/complete-delivery`, { token: staffToken, body: completedBody });
  check(repeated.status === 200, "repeated completion must remain successful");
  check(repeated.payload.learningPair?.status === "duplicate", "repeated completion must hit idempotency");
  check(repeated.payload.notificationStatus !== "sent", "repeated completion must not send a production email");

  const pairs = requireData(await admin
    .from("ai_learning_pair_candidates")
    .select("id,review_status,learning_use_status,learning_authorization_status,linked_training_sample_id")
    .eq("request_id", orderId), "pair verification");
  check(pairs.length === 1, "exactly one ORI/completed pair candidate must exist");
  check(["pending_review", "needs_review"].includes(pairs[0].review_status), "pair must remain pending human review");
  check(pairs[0].learning_use_status === "pending", "pair learning use must remain pending");
  check(pairs[0].learning_authorization_status === "not_granted", "authorization must default to not_granted");
  check(pairs[0].linked_training_sample_id === null, "pair must not link an automatic training sample");
  const sampleCount = await admin
    .from("ai_training_samples")
    .select("id", { count: "exact", head: true })
    .eq("request_id", orderId);
  if (sampleCount.error) throw new Error(`training sample verification: ${sampleCount.error.message}`);
  check((sampleCount.count ?? 0) === 0, "zero training samples must be created");

  const approval = await api(`/api/admin/ai/learning-corpus/pairs/${pairs[0].id}`, {
    token: staffToken,
    method: "PATCH",
    body: {
      reviewStatus: "approved",
      learningUseStatus: "approved_for_learning",
      performedServiceLabels: {
        stage1: true,
        stage2: false,
        stage3: false,
        dpf_off: false,
        egr_off: false,
        adblue_off: false,
        dtc_off: false,
        vmax_off: false,
        pop_bangs: false,
        tcu_tune: false,
        tcu_shift: false,
        tcu_lockup: false,
      },
    },
  });
  check(approval.status === 400, "approval-disabled gate must block promotion");

  const authorization = await api(`/api/requests/${orderId}/learning-authorization`, {
    token: customerToken,
    body: { choice: "grant", termsVersion: "unconfigured-e2e-version" },
  });
  check(authorization.status === 400, "missing configured terms version must block capture");

  const missingSourceBody = {
    ...completedBody,
    filePath: missingSourceCompletedPath,
    versionId: `e2e-missing-source-${runId}`,
  };
  const missingSource = await api(`/api/admin/orders/${missingSourceOrderId}/complete-delivery`, {
    token: staffToken,
    body: missingSourceBody,
  });
  check(missingSource.status === 200, "missing source candidate failure must not break delivery");
  check(missingSource.payload.order?.status === "completed", "missing source order must still complete");
  check(missingSource.payload.learningPair?.status === "failed", "missing source must create a retryable failed job");
  check(missingSource.payload.learningPair?.retryable === true, "missing source failure must be retryable");
  const failedJobs = requireData(await admin
    .from("ai_learning_ingestion_jobs")
    .select("id,status,attempt_count,next_attempt_at")
    .eq("request_id", missingSourceOrderId)
    .eq("job_type", "pair_candidate"), "failed job verification");
  check(failedJobs.length === 1 && failedJobs[0].status === "failed", "candidate failure must be durably recorded");
  check(Boolean(failedJobs[0].next_attempt_at), "failed candidate must retain a retry schedule");

  await upload(missingSourcePath, sourceBytes);
  const recovery = await api("/api/admin/ai/learning-corpus/backfill", {
    token: staffToken,
    body: { dryRun: false, mode: "recovery_only", limit: 25 },
  });
  if (expectBackfillEnabled) {
    check(recovery.status === 200, "enabled recovery-only backfill must succeed");
    check((recovery.payload.recovery?.recovered ?? 0) >= 1, "failed pair candidate must recover");
    const recoveredPairs = requireData(await admin
      .from("ai_learning_pair_candidates")
      .select("id")
      .eq("request_id", missingSourceOrderId), "recovered pair verification");
    check(recoveredPairs.length === 1, "recovery must create exactly one pair candidate");
  } else {
    check(recovery.status === 403, "disabled backfill must block recovery execution");
  }

  console.log(`Complete-delivery hardening E2E passed: ${assertions} assertions; target=${localRun ? "local" : "isolated-staging"}.`);
} catch (error) {
  failure = error;
} finally {
  await cleanup();
}

if (failure) throw failure;
