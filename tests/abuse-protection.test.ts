import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  buildRateLimitSubjectFingerprint,
  checkAdaptiveRateLimit,
  getDistributedRateLimitConfig,
  rateLimitResponseHeaders,
  type DistributedRateLimitConfig,
} from "../src/lib/abuseProtection";
import { getClientIp } from "../src/lib/rateLimit";

const distributedConfig: DistributedRateLimitConfig = {
  url: "https://rate-limit.example.test",
  token: "test-token-never-logged",
  subjectSalt: "0123456789abcdef0123456789abcdef",
  timeoutMs: 200,
};

function requestFrom(ip: string, extraHeaders?: Record<string, string>) {
  return new Request("https://file.mgautotech.de/api/vehicles?type=brands", {
    headers: {
      "x-vercel-forwarded-for": ip,
      "x-vercel-ip-country": "DE",
      ...extraHeaders,
    },
  });
}

test("client IP parsing trusts only the active provider contract", () => {
  const trusted = requestFrom("203.0.113.9", { "x-forwarded-for": "198.51.100.8" });
  assert.equal(getClientIp(trusted, { VERCEL: "1" }), "203.0.113.9");

  const spoofedFallback = new Request("https://file.mgautotech.de", {
    headers: {
      "x-vercel-forwarded-for": "not-an-ip",
      "x-forwarded-for": "198.51.100.10, 10.0.0.2",
    },
  });
  assert.equal(getClientIp(spoofedFallback, { VERCEL: "1" }), "unknown");

  const spoofedRealIp = new Request("https://file.mgautotech.de", {
    headers: { "x-real-ip": "[2001:db8::2]:443" },
  });
  assert.equal(getClientIp(spoofedRealIp), "unknown");
  assert.equal(getClientIp(new Request("https://file.mgautotech.de")), "unknown");
});

test("distributed configuration is fail-closed for missing secrets and non-HTTPS URLs", () => {
  assert.equal(getDistributedRateLimitConfig({}), null);
  assert.equal(getDistributedRateLimitConfig({
    SECURITY_DISTRIBUTED_RATE_LIMIT_ENABLED: "true",
    UPSTASH_REDIS_REST_URL: "http://unsafe.example.test",
    UPSTASH_REDIS_REST_TOKEN: "token",
    SECURITY_RATE_LIMIT_SALT: "0123456789abcdef",
  }), null);
  assert.deepEqual(getDistributedRateLimitConfig({
    SECURITY_DISTRIBUTED_RATE_LIMIT_ENABLED: "true",
    UPSTASH_REDIS_REST_URL: distributedConfig.url,
    UPSTASH_REDIS_REST_TOKEN: distributedConfig.token,
    SECURITY_RATE_LIMIT_SALT: distributedConfig.subjectSalt,
  }), {
    url: distributedConfig.url,
    token: distributedConfig.token,
    subjectSalt: distributedConfig.subjectSalt,
  });
});

test("shared counter receives only a salted fingerprint, never raw IP or user suffix", async () => {
  const rawIp = "203.0.113.44";
  const rawSuffix = "customer-private-id";
  let sentBody = "";
  let sentAuthorization = "";

  const result = await checkAdaptiveRateLimit({
    request: requestFrom(rawIp),
    scope: `test-shared-${crypto.randomUUID()}`,
    suffix: rawSuffix,
    limit: 10,
    windowMs: 60_000,
    config: distributedConfig,
    emitSignals: false,
    fetchImpl: async (_input, init) => {
      sentBody = String(init?.body ?? "");
      sentAuthorization = new Headers(init?.headers).get("authorization") ?? "";
      return Response.json({ result: [1, 59_500] });
    },
  });

  assert.equal(result.allowed, true);
  assert.equal(result.source, "distributed");
  assert.doesNotMatch(sentBody, new RegExp(rawIp.replaceAll(".", "\\.")));
  assert.doesNotMatch(sentBody, new RegExp(rawSuffix));
  assert.match(sentBody, /mg:rate-limit:v1:/);
  assert.equal(sentAuthorization, `Bearer ${distributedConfig.token}`);
});

test("provider outage preserves the local guard without blocking a normal customer", async () => {
  const result = await checkAdaptiveRateLimit({
    request: requestFrom("203.0.113.45"),
    scope: `test-fallback-${crypto.randomUUID()}`,
    limit: 20,
    windowMs: 60_000,
    config: distributedConfig,
    emitSignals: false,
    fetchImpl: async () => {
      throw new Error("provider unavailable");
    },
  });

  assert.equal(result.allowed, true);
  assert.equal(result.source, "memory-fallback");
  assert.equal(result.remaining, 19);
});

test("distributed and local counters both stop abuse with standards-based retry headers", async () => {
  const distributed = await checkAdaptiveRateLimit({
    request: requestFrom("203.0.113.46"),
    scope: `test-distributed-block-${crypto.randomUUID()}`,
    limit: 2,
    windowMs: 60_000,
    config: distributedConfig,
    emitSignals: false,
    fetchImpl: async () => Response.json({ result: [3, 30_000] }),
  });
  assert.equal(distributed.allowed, false);
  assert.equal(distributed.source, "distributed");

  const scope = `test-local-block-${crypto.randomUUID()}`;
  const first = await checkAdaptiveRateLimit({
    request: requestFrom("203.0.113.47"),
    scope,
    limit: 1,
    windowMs: 60_000,
    config: null,
    emitSignals: false,
  });
  const second = await checkAdaptiveRateLimit({
    request: requestFrom("203.0.113.47"),
    scope,
    limit: 1,
    windowMs: 60_000,
    config: null,
    emitSignals: false,
  });
  assert.equal(first.allowed, true);
  assert.equal(second.allowed, false);

  const headers = rateLimitResponseHeaders({
    result: distributed,
    limit: 2,
    windowMs: 60_000,
    blocked: true,
  });
  assert.equal(headers["RateLimit-Limit"], "2");
  assert.equal(headers["RateLimit-Remaining"], "0");
  assert.equal(headers["RateLimit-Policy"], "2;w=60");
  assert.equal(headers["Retry-After"], "30");
});

test("fingerprints are stable per subject and isolated across scopes", () => {
  const request = requestFrom("203.0.113.48");
  const first = buildRateLimitSubjectFingerprint({
    request,
    scope: "vehicle-catalog",
    subjectSalt: distributedConfig.subjectSalt,
  });
  const repeated = buildRateLimitSubjectFingerprint({
    request,
    scope: "vehicle-catalog",
    subjectSalt: distributedConfig.subjectSalt,
  });
  const isolated = buildRateLimitSubjectFingerprint({
    request,
    scope: "client-observability",
    subjectSalt: distributedConfig.subjectSalt,
  });
  assert.equal(first, repeated);
  assert.notEqual(first, isolated);
  assert.equal(first.length, 64);
});

test("protected routes use the common guard without exposing provider credentials", () => {
  const files = [
    "src/app/api/vehicles/route.ts",
    "src/app/api/observability/client-event/route.ts",
    "src/app/api/email/new-customer/route.ts",
    "src/app/api/email/new-order/route.ts",
    "src/app/api/email/bank-transfer/route.ts",
  ];
  const combined = files
    .map((file) => readFileSync(resolve(process.cwd(), file), "utf8"))
    .join("\n");

  assert.match(combined, /checkAdaptiveRateLimit|checkPublicVehicleAccess/);
  assert.match(combined, /rateLimitResponseHeaders/);
  assert.doesNotMatch(combined, /UPSTASH_REDIS_REST_TOKEN|KV_REST_API_TOKEN|SECURITY_RATE_LIMIT_SALT/);

  const helper = readFileSync(resolve(process.cwd(), "src/lib/abuseProtection.ts"), "utf8");
  assert.doesNotMatch(helper, /request\.url|user-agent|rawBody|storagePath|filename|customerId|orderId/);

  const newOrderEmail = readFileSync(
    resolve(process.cwd(), "src/app/api/email/new-order/route.ts"),
    "utf8"
  );
  assert.doesNotMatch(newOrderEmail, /error instanceof Error \? error\.message/);
});
