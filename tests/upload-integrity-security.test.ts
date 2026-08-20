import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { BoundedRequestBodyError, readBoundedJsonBody } from "../src/lib/boundedRequestBody";
import { desktopUploadPathFor } from "../src/lib/desktopUpload/contracts";
import {
  createUploadIntegrityContract,
  exactStoredObjectMetadata,
  isExpectedFileExpertStoragePath,
  normalizeUploadContentType,
  verifyUploadIntegrityContract,
} from "../src/lib/uploadIntegrity";

const testSecret = "upload-integrity-test-secret-32-characters-minimum";

function source(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

function contractFixture(expiresAt = 2_000_000_000) {
  return {
    kind: "desktop_request" as const,
    userId: "user-1",
    resourceId: "desktop-idempotency-1",
    path: `user-1/desktop/desktop-idempotency-1/${"a".repeat(64)}-test.bin`,
    fileName: "test.bin",
    fileSize: 4096,
    contentType: "application/octet-stream",
    sha256: "a".repeat(64),
    nonce: "nonce-1",
    expiresAt,
  };
}

test("upload prepare JSON is capped by declared and streamed bytes", async () => {
  const valid = await readBoundedJsonBody(new Request("https://example.test", {
    method: "POST",
    body: JSON.stringify({ ok: true }),
  }), 64);
  assert.deepEqual(valid, { ok: true });

  await assert.rejects(
    readBoundedJsonBody(new Request("https://example.test", {
      method: "POST",
      headers: { "content-length": "65" },
      body: "{}",
    }), 64),
    (error) => error instanceof BoundedRequestBodyError && error.status === 413,
  );

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(40));
      controller.enqueue(new Uint8Array(40));
      controller.close();
    },
  });
  await assert.rejects(
    readBoundedJsonBody(new Request("https://example.test", {
      method: "POST",
      body: stream,
      // Required by Node fetch for streamed request bodies.
      duplex: "half",
    } as RequestInit & { duplex: "half" }), 64),
    (error) => error instanceof BoundedRequestBodyError && error.status === 413,
  );
});

test("upload contracts reject tampering, mismatches, expiry, and weak secrets", () => {
  const fixture = contractFixture();
  const token = createUploadIntegrityContract(fixture, { secret: testSecret });
  const verified = verifyUploadIntegrityContract(token, {
    kind: fixture.kind,
    userId: fixture.userId,
    resourceId: fixture.resourceId,
    path: fixture.path,
    fileName: fixture.fileName,
    fileSize: fixture.fileSize,
    contentType: fixture.contentType,
    sha256: fixture.sha256,
  }, { secret: testSecret, nowSeconds: fixture.expiresAt - 1 });
  assert.equal(verified.path, fixture.path);

  const [payload, signature] = token.split(".");
  const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  decoded.fileSize += 1;
  const tampered = `${Buffer.from(JSON.stringify(decoded)).toString("base64url")}.${signature}`;
  assert.throws(() => verifyUploadIntegrityContract(tampered, {}, { secret: testSecret }));
  assert.throws(() => verifyUploadIntegrityContract(token, { userId: "user-2" }, { secret: testSecret }));
  assert.throws(() => verifyUploadIntegrityContract(token, {}, { secret: testSecret, nowSeconds: fixture.expiresAt + 1 }));
  assert.throws(() => createUploadIntegrityContract(fixture, { secret: "too-short" }));
});

test("storage metadata and File Expert paths are exact rather than prefix-only", () => {
  assert.equal(normalizeUploadContentType("Application/Octet-Stream; charset=binary"), "application/octet-stream");
  assert.deepEqual(
    exactStoredObjectMetadata([
      { name: "test.bin.bak", metadata: { size: 1, mimetype: "application/octet-stream" } },
      { name: "test.bin", metadata: { size: 4096, mimetype: "application/octet-stream" } },
    ], "test.bin"),
    { size: 4096, contentType: "application/octet-stream" }
  );
  assert.equal(exactStoredObjectMetadata([{ name: "test.bin", metadata: { size: 4096 } }], "test.bin"), null);

  assert.equal(isExpectedFileExpertStoragePath("user-1/job-1/ori-test.bin", "user-1", "job-1"), true);
  assert.equal(isExpectedFileExpertStoragePath("user-1/job-1/nested/ori.bin", "user-1", "job-1"), false);
  assert.equal(isExpectedFileExpertStoragePath("user-1/job-2/ori.bin", "user-1", "job-1"), false);
  assert.equal(isExpectedFileExpertStoragePath("user-2/job-1/ori.bin", "user-1", "job-1"), false);
  assert.equal(isExpectedFileExpertStoragePath("user-1/job-1/../other.bin", "user-1", "job-1"), false);
});

test("desktop paths are content-addressed and finalization verifies real bytes", () => {
  const first = desktopUploadPathFor({
    userId: "user-1",
    idempotencyKey: "desktop-request-1",
    fileName: "original.bin",
    sha256: "a".repeat(64),
  });
  const second = desktopUploadPathFor({
    userId: "user-1",
    idempotencyKey: "desktop-request-1",
    fileName: "original.bin",
    sha256: "b".repeat(64),
  });
  assert.notEqual(first, second);
  assert.match(first, new RegExp(`/${"a".repeat(64)}-original\\.bin$`));

  const prepare = source("src", "app", "api", "desktop", "upload-session", "route.ts");
  const finalize = source("src", "app", "api", "desktop", "requests", "finalize", "route.ts");
  const stateMigration = source(
    "supabase",
    "migrations",
    "20260816002444_security_state_hardening.sql",
  );
  const app = source("apps", "customer-uploader", "src", "App.tsx");
  assert.match(prepare, /createUploadIntegrityContract/);
  assert.match(prepare, /desktopUploadPathFor/);
  assert.match(prepare, /readBoundedJsonBody\(request, 32 \* 1024\)/);
  assert.match(prepare, /createSignedUploadUrl\(path, \{ upsert: false \}\)/);
  assert.match(prepare, /rate\.source !== "distributed"/);
  assert.match(prepare, /!Number\.isInteger\(creditsRequired\) \|\| creditsRequired < 0/);
  assert.match(finalize, /verifyUploadIntegrityContract/);
  assert.match(finalize, /exactStoredObjectMetadata/);
  assert.match(finalize, /createHash\("sha256"\)/);
  assert.match(finalize, /storedBuffer\.length !== storedMetadata\.size/);
  assert.match(finalize, /from\("desktop_request_approvals"\)\.insert/);
  assert.match(finalize, /p_approval_token: approvalToken/);
  assert.doesNotMatch(finalize, /\.like\("original_file_path"/);
  assert.match(finalize, /!Number\.isInteger\(creditsRequired\) \|\| creditsRequired < 0/);
  assert.ok(finalize.indexOf("creditsRequired < 0") < finalize.indexOf('const admin = getSupabaseAdmin()'));
  assert.match(app, /uploadContract: uploadSession\.uploadContract/);
  assert.match(app, /signedUploadUrl: uploadSession\.upload\.signedUploadUrl/);
  assert.match(stateMigration, /create table public\.desktop_request_approvals/);
  assert.match(stateMigration, /v_approval\.request_payload is distinct from v_payload/);
  assert.match(stateMigration, /v_approval\.expires_at <= pg_catalog\.now\(\)/);
  assert.match(stateMigration, /set consumed_at = pg_catalog\.now\(\)/);
});

test("additional upload finalization binds metadata and atomically consumes permission", () => {
  const prepare = source("src", "app", "api", "requests", "[id]", "additional-file", "prepare", "route.ts");
  const finalize = source("src", "app", "api", "requests", "[id]", "additional-file", "finalize", "route.ts");
  const page = source("src", "app", "dashboard", "orders", "[id]", "page.tsx");
  assert.match(prepare, /randomUUID\(\).*safeName/);
  assert.match(prepare, /createUploadIntegrityContract/);
  assert.match(prepare, /readBoundedJsonBody\(request, 16 \* 1024\)/);
  assert.match(prepare, /createSignedUploadUrl\(path, \{ upsert: false \}\)/);
  assert.match(prepare, /rate\.source !== "distributed"/);
  assert.match(finalize, /verifyUploadIntegrityContract/);
  assert.match(finalize, /storedMetadata\.size !== uploadContract\.fileSize/);
  assert.match(finalize, /storedMetadata\.contentType !== uploadContract\.contentType/);
  assert.match(finalize, /\.eq\("customer_upload_enabled", true\)[\s\S]*\.maybeSingle\(\)/);
  assert.match(finalize, /status: 409/);
  assert.match(page, /uploadContract: prepared\.uploadContract/);
  assert.match(page, /uploadToSignedUrl\(prepared\.upload\.path, prepared\.upload\.token/);
});

test("File Expert analyzer and caller fail closed around auth, SSRF, limits, and concurrency", () => {
  const analyzer = source("file-expert-analyzer", "main.py");
  const server = source("src", "lib", "fileExpert", "server.ts");
  const analyzeRoute = source("src", "app", "api", "file-expert", "jobs", "[id]", "analyze", "route.ts");
  const finalizeRoute = source("src", "app", "api", "file-expert", "jobs", "[id]", "finalize", "route.ts");
  const prepareRoute = source("src", "app", "api", "file-expert", "jobs", "prepare", "route.ts");

  assert.match(analyzer, /FILE_EXPERT_ANALYZER_TOKEN/);
  assert.match(analyzer, /hmac\.compare_digest/);
  assert.match(analyzer, /FILE_EXPERT_ANALYZER_ALLOWED_HOSTS/);
  assert.match(analyzer, /ipaddress\.ip_address\(address\)\.is_global/);
  assert.match(analyzer, /follow_redirects=False/);
  assert.match(analyzer, /trust_env=False/);
  assert.match(analyzer, /client\.stream\("GET"/);
  assert.match(analyzer, /HARD_MAX_SOURCE_BYTES = 32 \* 1024 \* 1024/);
  assert.match(analyzer, /FILE_EXPERT_ANALYZER_LOCAL_ROOT/);
  assert.match(analyzer, /resolve\(strict=True\)/);
  assert.doesNotMatch(analyzer, /response\.content|Path\(path\)\.read_bytes/);

  assert.match(server, /FILE_EXPERT_ANALYZER_TOKEN/);
  assert.match(server, /url\.protocol !== "https:"/);
  assert.match(server, /url\.protocol === "http:" && isLoopback/);
  assert.match(server, /Authorization: `Bearer \$\{configuration\.token\}`/);
  assert.match(server, /redirect: "error"/);
  assert.match(server, /fileExpertAnalyzerRequestTimeoutMs/);
  assert.match(server, /createSignedUrl\(path, 60\)/);
  assert.match(server, /isExpectedFileExpertStoragePath\(job\.ori_file_path, job\.user_id, job\.id\)/);
  assert.match(server, /completedResultMustSurviveFailure/);
  assert.match(server, /\.eq\("status", currentStatus\)/);
  assert.match(server, /\.in\("status", \["pending", "failed"\]\)/);
  assert.match(server, /analysis_claim_token: claimToken/);
  assert.match(server, /analysis_started_at\.is\.null,analysis_started_at\.lt/);
  assert.match(server, /\.eq\("analysis_claim_token", claimToken\)/);
  assert.match(
    analyzeRoute,
    /analyzeFileExpertJob\(id, \{[\s\S]*?allowCompleted: isAdmin,[\s\S]*?operationDeadlineAt/
  );
  assert.match(server, /\.eq\("status", "processing"\)/);
  assert.match(server, /exactStoredObjectMetadata/);
  const outboundPayload = server.slice(
    server.indexOf("body: JSON.stringify({"),
    server.indexOf("if (!response.ok)")
  );
  assert.doesNotMatch(outboundPayload, /ori_file_path:|mod_file_path:/);

  for (const route of [analyzeRoute, finalizeRoute]) {
    assert.match(route, /checkFileExpertAnalysisRate/);
    assert.match(route, /isExpectedFileExpertStoragePath/);
    assert.match(route, /status: safeError\.status/);
    assert.match(route, /safeFileExpertAnalysisError/);
  }
  assert.match(prepareRoute, /checkFileExpertCreateRate/);
  assert.match(prepareRoute, /readBoundedJsonBody\(request, 64 \* 1024\)/);
  assert.match(prepareRoute, /createSignedUploadUrl\(oriPath, \{ upsert: false \}\)/);
});

test("signed-upload boundary documents prepared migration controls and the remaining hash proof", () => {
  const hardening = source("docs", "upload-integrity-hardening.md");
  const authorityMigration = source(
    "supabase",
    "migrations",
    "20260816002443_financial_authority_hardening.sql",
  );
  const cutoverMigration = source(
    "supabase",
    "migrations",
    "20260816002452_post_deploy_legacy_rpc_cutover.sql",
  );
  const verification = source("scripts", "verify-security-state-hardening.sql");
  assert.match(hardening, /file_size_limit = 33554432/);
  assert.match(hardening, /allowed_mime_types/);
  assert.match(hardening, /signed upload/i);
  assert.match(hardening, /Customer `UPDATE` must remain absent/);
  assert.match(hardening, /database idempotency claim/i);
  assert.match(hardening, /20260816002443_financial_authority_hardening\.sql/);
  assert.match(hardening, /prepared, not deployed/i);
  assert.match(hardening, /browser-declared content hash is not independently proven/i);
  assert.match(authorityMigration, /create policy "MG customer files select"/);
  assert.doesNotMatch(authorityMigration, /create policy "MG file expert insert"/);
  assert.doesNotMatch(
    authorityMigration,
    /revoke\s+(?:update\s*,\s*delete|delete\s*,\s*update)[\s\S]{0,120}\bstorage\.objects\b/i,
  );
  assert.match(
    authorityMigration,
    /create policy "MG customer files insert"[\s\S]*?public\.has_staff_permission\('files\.upload'\)/,
  );
  const customerInsertPolicy = authorityMigration.match(
    /create policy "MG customer files insert"[\s\S]*?;\s*/,
  )?.[0] ?? "";
  assert.doesNotMatch(customerInsertPolicy, /auth\.uid/);
  assert.match(authorityMigration, /as restrictive for select to authenticated/);
  assert.match(authorityMigration, /as restrictive for insert to anon/);
  for (const policyName of [
    "MG protected buckets update boundary",
    "MG protected buckets delete boundary",
    "MG protected buckets anon update boundary",
    "MG protected buckets anon delete boundary",
  ]) {
    const policy = authorityMigration.match(
      new RegExp(`create policy "${policyName}"[\\s\\S]*?;`, "i"),
    )?.[0] ?? "";
    assert.match(policy, /as restrictive/);
    assert.match(policy, /customer-files/);
    assert.match(policy, /file-expert/);
    assert.doesNotMatch(policy, /auth\.uid|has_staff_permission/);
  }
  assert.match(
    authorityMigration,
    /create policy "MG customer files legacy owner insert"[\s\S]*?bucket_id = 'customer-files'[\s\S]*?auth\.uid\(\)/,
  );
  assert.match(
    authorityMigration,
    /create policy "MG file expert legacy owner insert"[\s\S]*?bucket_id = 'file-expert'[\s\S]*?auth\.uid\(\)/,
  );
  assert.match(cutoverMigration, /drop policy if exists "MG customer files legacy owner insert"/);
  assert.match(cutoverMigration, /drop policy if exists "MG file expert legacy owner insert"/);
  assert.match(authorityMigration, /public\.has_staff_permission\('files\.download'\)/);
  assert.match(verification, /private Storage bucket policies are canonical and restrictive/i);
  assert.match(verification, /exact restrictive command matrix prevents permissive OR-policies/i);
  assert.doesNotMatch(
    verification,
    /has_table_privilege\('(?:anon|authenticated)',\s*'storage\.objects',\s*'(?:UPDATE|DELETE)'\)/i,
  );
});
