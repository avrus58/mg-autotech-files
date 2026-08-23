import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  checkFileExpertAnalysisRate,
  checkFileExpertCreateRate,
} from "../src/lib/fileExpert/requestSecurity";
import {
  acquireFileExpertAnalyzerAdmission,
  fileExpertAnalyzerLeaseSafetyMarginMs,
  fileExpertAnalyzerLeaseTtlMs,
  fileExpertAnalyzerRequestTimeoutMs,
  getFileExpertAnalyzerAdmissionConfig,
  releaseFileExpertAnalyzerAdmission,
  type FileExpertAnalyzerAdmissionConfig,
} from "../src/lib/fileExpert/admissionLease";
import {
  failedFileExpertAnalysisState,
  shouldPreserveCompletedFileExpertResult,
} from "../src/lib/fileExpert/analysisState";
import { getExternalAnalyzerConfiguration } from "../src/lib/fileExpert/server";
import {
  boundedFileExpertDeadline,
  FileExpertAnalysisDeadlineError,
  fileExpertCleanupTimeoutMs,
  fileExpertPostAnalyzerReserveMs,
  fileExpertRouteMaxDurationSeconds,
  fileExpertRouteOperationBudgetMs,
  settleFileExpertOperationBefore,
} from "../src/lib/fileExpert/executionBudget";

function source(...parts: string[]) {
  return readFileSync(resolve(process.cwd(), ...parts), "utf8");
}

function requestFrom(ip: string) {
  return new Request("https://file.mgautotech.de/api/file-expert/jobs", {
    headers: { "x-forwarded-for": ip },
  });
}

const mutableEnvironment = process.env as unknown as Record<string, string | undefined>;

test("VPS analyzer HTTP is limited to the exact private Docker endpoint and explicit opt-in", () => {
  const token = "private-analyzer-token-used-only-in-tests-123456";
  const privateDocker = {
    FILE_EXPERT_ANALYZER_URL: "http://file-expert-analyzer:8010",
    FILE_EXPERT_ANALYZER_TOKEN: token,
  };

  assert.equal(getExternalAnalyzerConfiguration(privateDocker), null);
  assert.deepEqual(getExternalAnalyzerConfiguration({
    ...privateDocker,
    FILE_EXPERT_ANALYZER_ALLOW_PRIVATE_DOCKER_HTTP: "true",
  }), {
    url: "http://file-expert-analyzer:8010",
    token,
  });

  for (const url of [
    "http://file-expert-analyzer:8011",
    "http://file-expert-analyzer:8010/private",
    "http://other-analyzer:8010",
    "http://file-expert-analyzer.:8010",
  ]) {
    assert.equal(getExternalAnalyzerConfiguration({
      FILE_EXPERT_ANALYZER_URL: url,
      FILE_EXPERT_ANALYZER_TOKEN: token,
      FILE_EXPERT_ANALYZER_ALLOW_PRIVATE_DOCKER_HTTP: "true",
    }), null);
  }
});

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
  const workerExecution = source("file-expert-analyzer", "execution.py");
  const workerReadme = source("file-expert-analyzer", "README.md");
  const workerDockerfile = source("file-expert-analyzer", "Dockerfile");

  assert.match(requestSecurity, /scope: "file-expert-job-create"[\s\S]*?includeClientIp: false/);
  assert.match(requestSecurity, /process\.env\.NODE_ENV === "production"/);
  assert.match(requestSecurity, /result\.source !== "distributed"/);
  assert.match(jobsRoute, /Legacy multipart uploads are disabled/);
  assert.match(jobsRoute, /status: 410/);
  assert.doesNotMatch(jobsRoute, /request\.formData\(\)|\.arrayBuffer\(\)/);
  assert.match(server, /!supportedExternalResult && process\.env\.NODE_ENV === "production"/);
  assert.match(server, /throw new FileExpertAnalyzerUnavailableError\(\)/);
  assert.match(server, /acquireFileExpertAnalyzerAdmission\(\)/);
  assert.match(server, /releaseFileExpertAnalyzerAdmission\(admission\.lease\)/);
  assert.match(server, /!requestDispatched \|\| requestSettled/);
  assert.match(worker, /analysis_slots = asyncio\.Semaphore\(1\)/);
  assert.match(worker, /require_single_concurrency_configuration/);
  assert.match(worker, /try_acquire_analyzer_lease/);
  assert.match(worker, /asyncio\.to_thread\([\s\S]*?run_in_terminated_process/);
  assert.match(worker, /return await asyncio\.shield\(analysis_task\)/);
  assert.match(worker, /asyncio\.wait_for\([\s\S]*?asyncio\.gather\(\*tasks\)/);
  assert.match(worker, /await asyncio\.gather\(\*tasks, return_exceptions=True\)/);
  assert.match(worker, /def __init__\(self, app: ASGIApp\)/);
  assert.ok(worker.indexOf("await analysis_task") < worker.lastIndexOf("analysis_slots.release()"));
  assert.match(worker, /FILE_EXPERT_ANALYZER_WALL_TIMEOUT_SECONDS", 30, 5, 30/);
  assert.match(workerExecution, /multiprocessing\.get_context\("spawn"\)/);
  assert.match(workerExecution, /fcntl\.LOCK_EX \| fcntl\.LOCK_NB/);
  assert.match(workerExecution, /process\.terminate\(\)/);
  assert.match(workerExecution, /process\.kill\(\)/);
  assert.match(workerExecution, /receiver\.poll\(timeout_seconds\)/);
  assert.match(workerReadme, /uvicorn main:app[\s\S]*?--workers 1[\s\S]*?--limit-concurrency 4/);
  assert.doesNotMatch(worker, /asyncio\.to_thread\(build_analysis_result/);
  assert.match(workerDockerfile, /^FROM python:3\.12-slim-bookworm/m);
  assert.match(workerDockerfile, /PYTHONDONTWRITEBYTECODE=1/);
  assert.match(workerDockerfile, /PYTHONUNBUFFERED=1/);
  assert.match(workerDockerfile, /USER 10001:10001/);
  assert.match(workerDockerfile, /EXPOSE 8010/);
  assert.match(workerDockerfile, /HEALTHCHECK[\s\S]*?127\.0\.0\.1:8010\/health/);
  assert.match(workerDockerfile, /"--workers", "1"/);
  assert.match(workerDockerfile, /"--limit-concurrency", "4"/);
  assert.doesNotMatch(workerDockerfile, /FILE_EXPERT_ANALYZER_TOKEN|SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_/);
  assert.doesNotMatch(workerDockerfile, /COPY\s+\.\s/);
  assert.ok(
    workerDockerfile.indexOf("COPY --chown=analyzer:analyzer requirements.txt") <
      workerDockerfile.indexOf("COPY --chown=analyzer:analyzer execution.py network_policy.py main.py")
  );

  const workerVercel = JSON.parse(source("file-expert-analyzer", "vercel.json"));
  assert.equal(workerVercel.framework, "fastapi");
  assert.equal(workerVercel.functions["main.py"].maxDuration, 35);
  assert.ok(fileExpertAnalyzerRequestTimeoutMs > workerVercel.functions["main.py"].maxDuration * 1000);
  assert.equal(
    fileExpertAnalyzerLeaseTtlMs,
    fileExpertAnalyzerRequestTimeoutMs +
      workerVercel.functions["main.py"].maxDuration * 1000 +
      fileExpertAnalyzerLeaseSafetyMarginMs
  );

  for (const route of [
    source("src", "app", "api", "file-expert", "jobs", "[id]", "analyze", "route.ts"),
    source("src", "app", "api", "file-expert", "jobs", "[id]", "finalize", "route.ts"),
  ]) {
    assert.match(route, /export const maxDuration = 60/);
  }
});

test("production analyzer admission requires a token-bound distributed lease", async () => {
  const config: FileExpertAnalyzerAdmissionConfig = {
    url: "https://lease.example.test",
    token: "provider-token-never-logged",
    capacity: 1,
    namespace: "preview",
    timeoutMs: 100,
  };
  const now = 2_000_000_000_000;
  const leaseToken = "lease-token-1";
  const requests: string[] = [];
  const fetchImpl: typeof fetch = async (_input, init) => {
    requests.push(String(init?.body ?? ""));
    return Response.json({
      result: requests.length === 1
        ? [1, now + fileExpertAnalyzerLeaseTtlMs + 333]
        : 1,
    });
  };

  const admission = await acquireFileExpertAnalyzerAdmission({
    environment: { NODE_ENV: "production" },
    config,
    fetchImpl,
    leaseToken,
  });
  assert.equal(admission.status, "acquired");
  if (admission.status !== "acquired") assert.fail("lease was not acquired");
  assert.match(requests[0], /redis\.call\('TIME'\)/);
  assert.match(requests[0], /ZREMRANGEBYSCORE/);
  assert.match(requests[0], /ZADD/);
  assert.match(requests[0], /mg:file-expert-analyzer:admission:v1:preview/);
  assert.match(requests[0], /lease-token-1/);
  assert.match(requests[0], new RegExp(String(fileExpertAnalyzerLeaseTtlMs)));
  assert.match(requests[0], new RegExp(String(fileExpertAnalyzerLeaseTtlMs + 1_000)));
  assert.doesNotMatch(requests[0], new RegExp(String(now)));

  assert.equal(await releaseFileExpertAnalyzerAdmission(admission.lease, fetchImpl), true);
  assert.match(requests[1], /ZREM/);
  assert.match(requests[1], /lease-token-1/);

  const missing = await acquireFileExpertAnalyzerAdmission({
    environment: { NODE_ENV: "production" },
    config: null,
    fetchImpl,
  });
  assert.equal(missing.status, "unavailable");

  const busy = await acquireFileExpertAnalyzerAdmission({
    environment: { NODE_ENV: "production" },
    config,
    fetchImpl: async () => Response.json({ result: [0, now + 1_000] }),
    leaseToken: "lease-token-2",
  });
  assert.equal(busy.status, "busy");

  const implausibleServerClock = await acquireFileExpertAnalyzerAdmission({
    environment: { NODE_ENV: "production" },
    config,
    fetchImpl: async () => Response.json({ result: [1, 123] }),
    leaseToken: "lease-token-3",
  });
  assert.equal(implausibleServerClock.status, "unavailable");
});

test("analyzer admission configuration is explicit, HTTPS-only and environment-isolated", () => {
  assert.equal(getFileExpertAnalyzerAdmissionConfig({}), null);
  assert.equal(getFileExpertAnalyzerAdmissionConfig({
    FILE_EXPERT_ANALYZER_DISTRIBUTED_ADMISSION_ENABLED: "true",
    UPSTASH_REDIS_REST_URL: "http://unsafe.example.test",
    UPSTASH_REDIS_REST_TOKEN: "token",
  }), null);
  assert.deepEqual(getFileExpertAnalyzerAdmissionConfig({
    NODE_ENV: "production",
    VERCEL_ENV: "preview",
    FILE_EXPERT_ANALYZER_DISTRIBUTED_ADMISSION_ENABLED: "true",
    FILE_EXPERT_ANALYZER_GLOBAL_CONCURRENCY: "3",
    KV_REST_API_URL: "https://lease.example.test/",
    KV_REST_API_TOKEN: "token",
  }), {
    url: "https://lease.example.test",
    token: "token",
    capacity: 1,
    namespace: "preview",
  });
});

test("analyzer admission timeout fails closed and leaves any unknown lease to its TTL", async () => {
  let requestCount = 0;
  const result = await acquireFileExpertAnalyzerAdmission({
    environment: { NODE_ENV: "production" },
    config: {
      url: "https://lease.example.test",
      token: "provider-token-never-logged",
      capacity: 1,
      namespace: "production",
      timeoutMs: 10,
    },
    fetchImpl: async (_input, init) => {
      requestCount += 1;
      return await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), {
          once: true,
        });
      });
    },
  });

  assert.equal(result.status, "unavailable");
  assert.equal(requestCount, 1);
});

test("analyzer admission deadline includes a stalled or oversized response body", async () => {
  const config: FileExpertAnalyzerAdmissionConfig = {
    url: "https://lease.example.test",
    token: "provider-token-never-logged",
    capacity: 1,
    namespace: "production",
    timeoutMs: 15,
  };
  const startedAt = Date.now();
  const stalled = await acquireFileExpertAnalyzerAdmission({
    environment: { NODE_ENV: "production" },
    config,
    fetchImpl: async (_input, init) => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"result":[1,'));
          init?.signal?.addEventListener(
            "abort",
            () => controller.error(new Error("aborted")),
            { once: true }
          );
        },
      });
      return new Response(body, { status: 200 });
    },
  });
  assert.equal(stalled.status, "unavailable");
  assert.ok(Date.now() - startedAt < 250);

  const oversized = await acquireFileExpertAnalyzerAdmission({
    environment: { NODE_ENV: "production" },
    config,
    fetchImpl: async () => new Response("{}", {
      status: 200,
      headers: { "content-length": String(8 * 1024 + 1) },
    }),
  });
  assert.equal(oversized.status, "unavailable");
  assert.equal(await releaseFileExpertAnalyzerAdmission({
    config,
    key: "mg:file-expert-analyzer:admission:v1:production",
    token: "lease-token-with-unknown-release",
  }, async () => new Response("{}", {
    status: 200,
    headers: { "content-length": String(8 * 1024 + 1) },
  })), false);
});

test("File Expert operation budget expires before the route hard cap", async () => {
  assert.equal(fileExpertRouteMaxDurationSeconds * 1_000 - fileExpertRouteOperationBudgetMs, 12_000);
  const now = 2_000_000_000_000;
  assert.equal(boundedFileExpertDeadline({
    absoluteDeadlineAt: now + fileExpertRouteOperationBudgetMs,
    maximumDurationMs: fileExpertAnalyzerRequestTimeoutMs,
    reserveMs: fileExpertPostAnalyzerReserveMs,
    now,
  }), now + fileExpertAnalyzerRequestTimeoutMs);
  assert.equal(fileExpertCleanupTimeoutMs(now + fileExpertRouteOperationBudgetMs, now), 8_000);
  assert.equal(
    fileExpertCleanupTimeoutMs(
      now + fileExpertRouteOperationBudgetMs,
      now + fileExpertRouteOperationBudgetMs + 7_500
    ),
    500
  );

  const startedAt = Date.now();
  await assert.rejects(
    settleFileExpertOperationBefore(
      new Promise<never>(() => undefined),
      startedAt + 15
    ),
    FileExpertAnalysisDeadlineError
  );
  assert.ok(Date.now() - startedAt < 250);

  for (const route of [
    source("src", "app", "api", "file-expert", "jobs", "[id]", "analyze", "route.ts"),
    source("src", "app", "api", "file-expert", "jobs", "[id]", "finalize", "route.ts"),
  ]) {
    assert.match(route, /Date\.now\(\) \+ fileExpertRouteOperationBudgetMs/);
    assert.match(route, /operationDeadlineAt/);
  }
  const server = source("src", "lib", "fileExpert", "server.ts");
  assert.match(server, /reserveMs: fileExpertPostAnalyzerReserveMs/);
  assert.match(server, /generateAiFileExpertReport\([\s\S]*?deadlineAt: aiReportDeadlineAt/);
  assert.match(server, /settleFileExpertOperationBefore\([\s\S]*?complete_file_expert_analysis_atomic/);
  assert.match(server, /abortSignal\(cleanupSignal\)/);
  assert.match(server, /abortSignal\(cleanupSignal\)[\s\S]*?catch\(\(\) => undefined\)[\s\S]*?throw error/);
});

test("failed re-analysis preserves the last completed result state", () => {
  assert.equal(shouldPreserveCompletedFileExpertResult({
    claimedFromStatus: "completed",
  }), true);
  assert.equal(shouldPreserveCompletedFileExpertResult({
    claimedFromStatus: "processing",
    existingResult: { analysis_version: "2.0.0" },
  }), true);
  assert.equal(shouldPreserveCompletedFileExpertResult({
    claimedFromStatus: "pending",
    existingResult: null,
  }), false);
  assert.deepEqual(failedFileExpertAnalysisState({
    preserveCompletedResult: true,
    message: "retryable failure",
  }), { status: "completed", error_message: null });

  const server = source("src", "lib", "fileExpert", "server.ts");
  const analysis = server.slice(server.indexOf("export async function analyzeFileExpertJob"));
  assert.match(analysis, /\.eq\("status", currentStatus\)/);
  assert.match(analysis, /existingResult: job\.result_json/);
  assert.match(analysis, /preserveCompletedResult: completedResultMustSurviveFailure/);
  assert.match(analysis, /\.eq\("analysis_claim_token", claimToken\)/);
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
