import { randomUUID } from "node:crypto";

const acquireLeaseScript = [
  "local server_time = redis.call('TIME')",
  "local now_ms = (tonumber(server_time[1]) * 1000) + math.floor(tonumber(server_time[2]) / 1000)",
  "local expires_at = now_ms + tonumber(ARGV[1])",
  "redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now_ms)",
  "local count = redis.call('ZCARD', KEYS[1])",
  "if count >= tonumber(ARGV[2]) then",
  "  local earliest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')",
  "  return {0, earliest[2] or expires_at}",
  "end",
  "redis.call('ZADD', KEYS[1], expires_at, ARGV[3])",
  "redis.call('PEXPIRE', KEYS[1], ARGV[4])",
  "return {1, expires_at}",
].join("\n");

const releaseLeaseScript = [
  "local removed = redis.call('ZREM', KEYS[1], ARGV[1])",
  "if redis.call('ZCARD', KEYS[1]) == 0 then redis.call('DEL', KEYS[1]) end",
  "return removed",
].join("\n");

export const fileExpertAnalyzerRequestTimeoutMs = 40_000;
export const fileExpertAnalyzerLeaseSafetyMarginMs = 5_000;
export const fileExpertAnalyzerLeaseTtlMs = 80_000;

const providerTimeoutMs = 1_200;
const maximumProviderResponseBytes = 8 * 1024;
const minimumPlausibleRedisEpochMs = 1_577_836_800_000; // 2020-01-01
const maximumPlausibleRedisEpochMs = 4_102_444_800_000; // 2100-01-01

export type FileExpertAnalyzerAdmissionConfig = {
  url: string;
  token: string;
  capacity: number;
  namespace: string;
  timeoutMs?: number;
};

export type FileExpertAnalyzerAdmissionLease = {
  config: FileExpertAnalyzerAdmissionConfig;
  key: string;
  token: string;
};

export type FileExpertAnalyzerAdmission =
  | { status: "acquired"; lease: FileExpertAnalyzerAdmissionLease }
  | { status: "not-required"; lease: null }
  | { status: "busy" | "unavailable"; lease: null };

function safeProviderUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function boundedCapacity(value: string | undefined) {
  const capacity = Number(value ?? "1");
  // Production starts with one global CPU-heavy job. Raising this cap requires
  // a reviewed load test and a deliberate code change, not only an env edit.
  return Number.isInteger(capacity) && capacity === 1 ? capacity : 1;
}

function deploymentNamespace(environment: Readonly<Record<string, string | undefined>>) {
  const candidate = environment.VERCEL_ENV?.trim().toLowerCase();
  if (candidate && /^(production|preview|development)$/.test(candidate)) return candidate;
  return environment.NODE_ENV === "production" ? "production" : "local";
}

export function getFileExpertAnalyzerAdmissionConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env
): FileExpertAnalyzerAdmissionConfig | null {
  if (environment.FILE_EXPERT_ANALYZER_DISTRIBUTED_ADMISSION_ENABLED !== "true") {
    return null;
  }
  const url = safeProviderUrl(
    environment.UPSTASH_REDIS_REST_URL || environment.KV_REST_API_URL
  );
  const token =
    environment.UPSTASH_REDIS_REST_TOKEN || environment.KV_REST_API_TOKEN || "";
  if (!url || !token) return null;

  return {
    url,
    token,
    capacity: boundedCapacity(environment.FILE_EXPERT_ANALYZER_GLOBAL_CONCURRENCY),
    namespace: deploymentNamespace(environment),
  };
}

function parseAcquireResult(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("result" in payload)) return null;
  const result = (payload as { result?: unknown }).result;
  if (!Array.isArray(result) || result.length !== 2) return null;
  const acquired = Number(result[0]);
  const expiresAt = Number(result[1]);
  if (
    (acquired !== 0 && acquired !== 1) ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt < minimumPlausibleRedisEpochMs ||
    expiresAt > maximumPlausibleRedisEpochMs
  ) return null;
  return { acquired: acquired === 1, expiresAt };
}

async function postRedisCommand(input: {
  config: FileExpertAnalyzerAdmissionConfig;
  body: readonly string[];
  fetchImpl: typeof fetch;
}) {
  const controller = new AbortController();
  const timeoutMs = Math.max(1, input.config.timeoutMs ?? providerTimeoutMs);
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const deadline = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new Error("Redis admission provider timed out."));
    }, timeoutMs);
  });

  const request = async () => {
    const response = await input.fetchImpl(input.config.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input.body),
      cache: "no-store",
      signal: controller.signal,
    });

    const declaredLengthValue = response.headers.get("content-length");
    if (declaredLengthValue) {
      const declaredLength = Number(declaredLengthValue);
      if (
        !Number.isSafeInteger(declaredLength) ||
        declaredLength < 0 ||
        declaredLength > maximumProviderResponseBytes
      ) {
        await response.body?.cancel().catch(() => undefined);
        throw new Error("Redis admission provider response is too large.");
      }
    }
    if (!response.body) throw new Error("Redis admission provider returned no body.");

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maximumProviderResponseBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error("Redis admission provider response is too large.");
      }
      chunks.push(value);
    }

    const body = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
    return { ok: response.ok, payload: JSON.parse(body) as unknown };
  };

  try {
    // The same absolute timeout covers connection, headers, the bounded body
    // and JSON parsing. A provider that executes EVAL but loses or stalls its
    // response therefore remains an unknown acquire and fails closed to TTL.
    return await Promise.race([request(), deadline]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function acquireFileExpertAnalyzerAdmission(input: {
  environment?: Readonly<Record<string, string | undefined>>;
  config?: FileExpertAnalyzerAdmissionConfig | null;
  fetchImpl?: typeof fetch;
  leaseToken?: string;
} = {}): Promise<FileExpertAnalyzerAdmission> {
  const environment = input.environment ?? process.env;
  const required = environment.NODE_ENV === "production";
  const config = input.config === undefined
    ? getFileExpertAnalyzerAdmissionConfig(environment)
    : input.config;

  if (!config) {
    return required
      ? { status: "unavailable", lease: null }
      : { status: "not-required", lease: null };
  }

  const leaseToken = input.leaseToken ?? randomUUID();
  const key = `mg:file-expert-analyzer:admission:v1:${config.namespace}`;

  try {
    const response = await postRedisCommand({
      config,
      fetchImpl: input.fetchImpl ?? fetch,
      body: [
        "EVAL",
        acquireLeaseScript,
        "1",
        key,
        String(fileExpertAnalyzerLeaseTtlMs),
        String(config.capacity),
        leaseToken,
        String(fileExpertAnalyzerLeaseTtlMs + 1_000),
      ],
    });
    if (!response.ok) return { status: "unavailable", lease: null };
    const parsed = parseAcquireResult(response.payload);
    if (!parsed) return { status: "unavailable", lease: null };
    if (!parsed.acquired) return { status: "busy", lease: null };
    return {
      status: "acquired",
      lease: { config, key, token: leaseToken },
    };
  } catch {
    // The provider may have executed a timed-out acquire. Never call the
    // analyzer in this state; any unknown lease expires automatically.
    return { status: "unavailable", lease: null };
  }
}

export async function releaseFileExpertAnalyzerAdmission(
  lease: FileExpertAnalyzerAdmissionLease,
  fetchImpl: typeof fetch = fetch
) {
  try {
    const response = await postRedisCommand({
      config: lease.config,
      fetchImpl,
      body: ["EVAL", releaseLeaseScript, "1", lease.key, lease.token],
    });
    if (!response.ok) return false;
    if (!response.payload || typeof response.payload !== "object") return false;
    const result = (response.payload as { result?: unknown }).result;
    return result === 0 || result === 1;
  } catch {
    // Release is best-effort. The short server-side TTL remains the authority
    // when the provider is unavailable or the caller loses the response.
    return false;
  }
}
