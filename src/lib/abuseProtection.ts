import { createHmac } from "node:crypto";
import {
  checkRateLimit,
  getClientIp,
  rateLimitKey,
  type RateLimitResult,
} from "@/lib/rateLimit";

const distributedCounterScript = [
  "local count = redis.call('INCR', KEYS[1])",
  "if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end",
  "local ttl = redis.call('PTTL', KEYS[1])",
  "return {count, ttl}",
].join("\n");

const signalCooldownMs = 5 * 60_000;

export type DistributedRateLimitConfig = {
  url: string;
  token: string;
  subjectSalt: string;
  timeoutMs?: number;
};

export type AdaptiveRateLimitResult = RateLimitResult & {
  source: "memory" | "distributed" | "memory-fallback";
};

type AdaptiveRateLimitInput = {
  request: Request;
  scope: string;
  limit: number;
  windowMs: number;
  suffix?: string | null;
  includeClientIp?: boolean;
  config?: DistributedRateLimitConfig | null;
  fetchImpl?: typeof fetch;
  emitSignals?: boolean;
};

type SecuritySignalKind =
  | "rate_limit_blocked"
  | "distributed_rate_limit_unavailable";

type SecuritySignalGlobal = typeof globalThis & {
  __mgAutotechSecuritySignalCooldown?: Map<string, number>;
};

function normalizeScope(scope: string) {
  const normalized = scope.toLowerCase().trim().replace(/[^a-z0-9:_-]+/g, "-").slice(0, 80);
  return normalized || "unknown";
}

function signalCountry(request: Request) {
  const country = request.headers.get("x-vercel-ip-country")?.trim().toUpperCase() ?? "";
  return /^[A-Z]{2}$/.test(country) ? country : "unknown";
}

function signalCooldownStore() {
  const securityGlobal = globalThis as SecuritySignalGlobal;
  if (!securityGlobal.__mgAutotechSecuritySignalCooldown) {
    securityGlobal.__mgAutotechSecuritySignalCooldown = new Map();
  }
  return securityGlobal.__mgAutotechSecuritySignalCooldown;
}

function emitSecuritySignal(input: {
  request: Request;
  kind: SecuritySignalKind;
  scope: string;
  source: AdaptiveRateLimitResult["source"];
  subjectFingerprint?: string | null;
}) {
  const scope = normalizeScope(input.scope);
  const cooldownKey = `${input.kind}:${scope}:${input.source}`;
  const now = Date.now();
  const cooldowns = signalCooldownStore();
  const lastEmittedAt = cooldowns.get(cooldownKey) ?? 0;
  if (now - lastEmittedAt < signalCooldownMs) return;

  cooldowns.set(cooldownKey, now);
  console.warn("[security-signal]", JSON.stringify({
    kind: input.kind,
    scope,
    source: input.source,
    country: signalCountry(input.request),
    subject: input.subjectFingerprint?.slice(0, 16) ?? null,
    occurred_at: new Date(now).toISOString(),
  }));
}

function safeDistributedUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString().replace(/\/$/, "") : null;
  } catch {
    return null;
  }
}

export function getDistributedRateLimitConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env
): DistributedRateLimitConfig | null {
  if (environment.SECURITY_DISTRIBUTED_RATE_LIMIT_ENABLED !== "true") return null;
  const url = safeDistributedUrl(
    environment.UPSTASH_REDIS_REST_URL || environment.KV_REST_API_URL
  );
  const token =
    environment.UPSTASH_REDIS_REST_TOKEN || environment.KV_REST_API_TOKEN || "";
  const subjectSalt = environment.SECURITY_RATE_LIMIT_SALT || "";

  if (!url || !token || subjectSalt.length < 16) return null;
  return { url, token, subjectSalt };
}

export function buildRateLimitSubjectFingerprint(input: {
  request: Request;
  scope: string;
  subjectSalt: string;
  suffix?: string | null;
  includeClientIp?: boolean;
}) {
  const subject = [
    normalizeScope(input.scope),
    input.includeClientIp === false ? "" : getClientIp(input.request),
    input.suffix?.trim().toLowerCase() ?? "",
  ].join("\u0000");

  return createHmac("sha256", input.subjectSalt).update(subject).digest("hex");
}

function parseDistributedCounterResult(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("result" in payload)) return null;
  const result = (payload as { result?: unknown }).result;
  if (!Array.isArray(result) || result.length !== 2) return null;
  const count = Number(result[0]);
  const ttlMs = Number(result[1]);
  if (!Number.isInteger(count) || count < 1 || !Number.isFinite(ttlMs) || ttlMs < 0) return null;
  return { count, ttlMs };
}

async function consumeDistributedRateLimit(input: {
  config: DistributedRateLimitConfig;
  fingerprint: string;
  scope: string;
  limit: number;
  windowMs: number;
  fetchImpl: typeof fetch;
}): Promise<AdaptiveRateLimitResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.config.timeoutMs ?? 1_200);
  const now = Date.now();

  try {
    const response = await input.fetchImpl(input.config.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        "EVAL",
        distributedCounterScript,
        "1",
        `mg:rate-limit:v1:${normalizeScope(input.scope)}:${input.fingerprint}`,
        String(input.windowMs),
      ]),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("Distributed rate-limit provider rejected the request.");

    const parsed = parseDistributedCounterResult(await response.json());
    if (!parsed) throw new Error("Distributed rate-limit provider returned an invalid response.");

    const retryAfterSeconds = Math.max(1, Math.ceil(parsed.ttlMs / 1000));
    return {
      allowed: parsed.count <= input.limit,
      remaining: Math.max(input.limit - parsed.count, 0),
      retryAfterSeconds,
      resetAt: now + parsed.ttlMs,
      source: "distributed",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkAdaptiveRateLimit(
  input: AdaptiveRateLimitInput
): Promise<AdaptiveRateLimitResult> {
  const local = checkRateLimit({
    key: input.includeClientIp === false
      ? [normalizeScope(input.scope), input.suffix?.toLowerCase().trim()]
          .filter(Boolean)
          .join(":")
      : rateLimitKey(input.request, input.scope, input.suffix),
    limit: input.limit,
    windowMs: input.windowMs,
  });
  const emitSignals = input.emitSignals !== false;

  if (!local.allowed) {
    const result = { ...local, source: "memory" as const };
    if (emitSignals) {
      emitSecuritySignal({
        request: input.request,
        kind: "rate_limit_blocked",
        scope: input.scope,
        source: result.source,
      });
    }
    return result;
  }

  const config = input.config === undefined
    ? getDistributedRateLimitConfig()
    : input.config;
  if (!config) return { ...local, source: "memory" };

  const fingerprint = buildRateLimitSubjectFingerprint({
    request: input.request,
    scope: input.scope,
    subjectSalt: config.subjectSalt,
    suffix: input.suffix,
    includeClientIp: input.includeClientIp,
  });

  try {
    const distributed = await consumeDistributedRateLimit({
      config,
      fingerprint,
      scope: input.scope,
      limit: input.limit,
      windowMs: input.windowMs,
      fetchImpl: input.fetchImpl ?? fetch,
    });
    if (!distributed.allowed && emitSignals) {
      emitSecuritySignal({
        request: input.request,
        kind: "rate_limit_blocked",
        scope: input.scope,
        source: distributed.source,
        subjectFingerprint: fingerprint,
      });
    }
    return distributed;
  } catch {
    const fallback = { ...local, source: "memory-fallback" as const };
    if (emitSignals) {
      emitSecuritySignal({
        request: input.request,
        kind: "distributed_rate_limit_unavailable",
        scope: input.scope,
        source: fallback.source,
        subjectFingerprint: fingerprint,
      });
    }
    return fallback;
  }
}

export function rateLimitResponseHeaders(input: {
  result: Pick<RateLimitResult, "remaining" | "retryAfterSeconds" | "resetAt">;
  limit: number;
  windowMs: number;
  blocked?: boolean;
}) {
  const headers: Record<string, string> = {
    "RateLimit-Limit": String(input.limit),
    "RateLimit-Remaining": String(Math.max(input.result.remaining, 0)),
    "RateLimit-Reset": String(Math.max(1, Math.ceil((input.result.resetAt - Date.now()) / 1000))),
    "RateLimit-Policy": `${input.limit};w=${Math.max(1, Math.ceil(input.windowMs / 1000))}`,
  };
  if (input.blocked) headers["Retry-After"] = String(Math.max(1, input.result.retryAfterSeconds));
  return headers;
}
