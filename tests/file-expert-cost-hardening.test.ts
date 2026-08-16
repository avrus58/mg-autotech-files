import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  checkFileExpertAnalysisRate,
  checkFileExpertCreateRate,
} from "../src/lib/fileExpert/requestSecurity";

function source(...parts: string[]) {
  return readFileSync(resolve(process.cwd(), ...parts), "utf8");
}

function requestFrom(ip: string) {
  return new Request("https://file.mgautotech.de/api/file-expert/jobs", {
    headers: { "x-forwarded-for": ip },
  });
}

const mutableEnvironment = process.env as unknown as Record<string, string | undefined>;

test("File Expert account limits cannot be multiplied by rotating client IPs", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousDistributed = process.env.SECURITY_DISTRIBUTED_RATE_LIMIT_ENABLED;
  mutableEnvironment.NODE_ENV = "test";
  mutableEnvironment.SECURITY_DISTRIBUTED_RATE_LIMIT_ENABLED = "false";

  try {
    const createUser = `create-${crypto.randomUUID()}`;
    for (let index = 0; index < 10; index += 1) {
      const result = await checkFileExpertCreateRate(
        requestFrom(`198.51.100.${index + 1}`),
        createUser
      );
      assert.equal(result.allowed, true);
    }
    const blockedCreate = await checkFileExpertCreateRate(
      requestFrom("203.0.113.99"),
      createUser
    );
    assert.equal(blockedCreate.allowed, false);
    assert.equal(blockedCreate.unavailable, false);

    const analysisUser = `analysis-${crypto.randomUUID()}`;
    for (let index = 0; index < 10; index += 1) {
      const result = await checkFileExpertAnalysisRate({
        request: requestFrom(`192.0.2.${index + 1}`),
        userId: analysisUser,
        jobId: crypto.randomUUID(),
        isAdmin: false,
      });
      assert.equal(result.allowed, true);
    }
    const blockedAnalysis = await checkFileExpertAnalysisRate({
      request: requestFrom("203.0.113.100"),
      userId: analysisUser,
      jobId: crypto.randomUUID(),
      isAdmin: false,
    });
    assert.equal(blockedAnalysis.allowed, false);
  } finally {
    if (previousNodeEnv === undefined) delete mutableEnvironment.NODE_ENV;
    else mutableEnvironment.NODE_ENV = previousNodeEnv;
    if (previousDistributed === undefined) {
      delete mutableEnvironment.SECURITY_DISTRIBUTED_RATE_LIMIT_ENABLED;
    } else {
      mutableEnvironment.SECURITY_DISTRIBUTED_RATE_LIMIT_ENABLED = previousDistributed;
    }
  }
});

test("File Expert expensive production paths fail closed without a durable limiter", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousDistributed = process.env.SECURITY_DISTRIBUTED_RATE_LIMIT_ENABLED;
  mutableEnvironment.NODE_ENV = "production";
  mutableEnvironment.SECURITY_DISTRIBUTED_RATE_LIMIT_ENABLED = "false";

  try {
    const result = await checkFileExpertCreateRate(
      requestFrom("198.51.100.150"),
      `production-${crypto.randomUUID()}`
    );
    assert.equal(result.allowed, false);
    assert.equal(result.unavailable, true);
  } finally {
    if (previousNodeEnv === undefined) delete mutableEnvironment.NODE_ENV;
    else mutableEnvironment.NODE_ENV = previousNodeEnv;
    if (previousDistributed === undefined) {
      delete mutableEnvironment.SECURITY_DISTRIBUTED_RATE_LIMIT_ENABLED;
    } else {
      mutableEnvironment.SECURITY_DISTRIBUTED_RATE_LIMIT_ENABLED = previousDistributed;
    }
  }
});

test("legacy multipart intake is disabled and production CPU uses the isolated worker", () => {
  const jobsRoute = source("src", "app", "api", "file-expert", "jobs", "route.ts");
  const requestSecurity = source("src", "lib", "fileExpert", "requestSecurity.ts");
  const server = source("src", "lib", "fileExpert", "server.ts");
  const worker = source("file-expert-analyzer", "main.py");

  assert.match(requestSecurity, /scope: "file-expert-job-create"[\s\S]*?includeClientIp: false/);
  assert.match(requestSecurity, /process\.env\.NODE_ENV === "production"/);
  assert.match(requestSecurity, /result\.source !== "distributed"/);
  assert.match(jobsRoute, /Legacy multipart uploads are disabled/);
  assert.match(jobsRoute, /status: 410/);
  assert.doesNotMatch(jobsRoute, /request\.formData\(\)|\.arrayBuffer\(\)/);
  assert.match(server, /!supportedExternalResult && process\.env\.NODE_ENV === "production"/);
  assert.match(server, /throw new FileExpertAnalyzerUnavailableError\(\)/);
  assert.match(worker, /asyncio\.to_thread\(build_analysis_result/);
  assert.match(worker, /return await asyncio\.shield\(analysis_task\)/);
  assert.match(worker, /def __init__\(self, app: ASGIApp\)/);
  assert.ok(worker.indexOf("await analysis_task") < worker.lastIndexOf("analysis_slots.release()"));
});

test("external integrity and completion side effects use one token-bound transaction", () => {
  const server = source("src", "lib", "fileExpert", "server.ts");
  const analysis = server.slice(server.indexOf("export async function analyzeFileExpertJob"));
  const migration = source(
    "supabase",
    "migrations",
    "20260816002447_file_expert_atomic_completion.sql"
  );
  const verifier = source("scripts", "verify-file-expert-atomic-completion.sql");
  const externalCall = analysis.indexOf("const externalResult = await callExternalAnalyzer");
  const localDownload = analysis.indexOf("const ori = await downloadFile");

  assert.match(server, /\^2\\\.\\d\+\\\.\\d\+\$/);
  assert.match(server, /isSupportedAnalyzerInspection/);
  assert.match(server, /size === Number\(expectedSize\)/);
  assert.match(server, /sha256 === expectedSha256\.toLowerCase\(\)/);
  assert.ok(externalCall >= 0 && localDownload > externalCall);
  assert.match(analysis, /\.rpc\(\s*"complete_file_expert_analysis_atomic"/);
  assert.doesNotMatch(analysis, /\.from\("file_expert_binary_fingerprints"\)/);
  assert.doesNotMatch(analysis, /storeSimilarityResults/);

  assert.match(migration, /where id = p_job_id\s+for update/);
  assert.match(migration, /analysis_claim_token is distinct from p_claim_token/);
  assert.match(migration, /analysis_started_at < clock_timestamp\(\) - interval '10 minutes'/);
  assert.match(migration, /split_part\(v_job\.ori_file_path, '\/', 1\) <> v_job\.user_id::text/);
  assert.match(migration, /delete from public\.file_expert_binary_fingerprints/);
  assert.match(migration, /insert into public\.file_expert_binary_fingerprints/);
  assert.match(migration, /delete from public\.ai_similarity_results/);
  assert.match(migration, /status = 'completed'/);
  assert.match(migration, /revoke all on function public\.complete_file_expert_analysis_atomic/);
  assert.match(migration, /to service_role/);
  assert.match(verifier, /derived rows and completion share the function transaction/);
});

test("File Expert admin view authority stays server-side", () => {
  const jobsRoute = source("src", "app", "api", "file-expert", "jobs", "route.ts");
  const adminPage = source("src", "app", "admin", "file-expert", "page.tsx");

  assert.match(jobsRoute, /adminView: includeAll && isAdmin/);
  assert.match(adminPage, /payload\.adminView !== true/);
  assert.doesNotMatch(adminPage, /from\("profiles"\)|staff_permissions|staff_role/);
});
