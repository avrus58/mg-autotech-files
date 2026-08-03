import { isIP } from "node:net";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: number;
};

type RateLimitStore = Map<string, RateLimitEntry>;

type RateLimitGlobal = typeof globalThis & {
  __mgAutotechRateLimitStore?: RateLimitStore;
};

function getStore() {
  const rateLimitGlobal = globalThis as RateLimitGlobal;
  if (!rateLimitGlobal.__mgAutotechRateLimitStore) {
    rateLimitGlobal.__mgAutotechRateLimitStore = new Map();
  }
  return rateLimitGlobal.__mgAutotechRateLimitStore;
}

function cleanupStore(store: RateLimitStore, now: number) {
  if (store.size < 5000) return;
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt <= now) store.delete(key);
  }
}

function normalizeIpCandidate(value: string | null) {
  const firstValue = value?.split(",")[0]?.trim();
  if (!firstValue || firstValue.length > 80) return null;

  let candidate = firstValue;
  const bracketedIpv6 = candidate.match(/^\[([^\]]+)\](?::\d{1,5})?$/);
  if (bracketedIpv6) {
    candidate = bracketedIpv6[1];
  } else {
    const ipv4WithPort = candidate.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/);
    if (ipv4WithPort) candidate = ipv4WithPort[1];
  }

  return isIP(candidate) ? candidate.toLowerCase() : null;
}

export function getClientIp(request: Request) {
  const candidates = [
    request.headers.get("x-vercel-forwarded-for"),
    request.headers.get("x-forwarded-for"),
    request.headers.get("x-real-ip"),
    request.headers.get("cf-connecting-ip"),
  ];

  for (const value of candidates) {
    const normalized = normalizeIpCandidate(value);
    if (normalized) return normalized;
  }

  return "unknown";
}

export function rateLimitKey(request: Request, scope: string, suffix?: string | null) {
  return [scope, getClientIp(request), suffix?.toLowerCase().trim()].filter(Boolean).join(":");
}

export function checkRateLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
}): RateLimitResult {
  const now = Date.now();
  const store = getStore();
  cleanupStore(store, now);

  const existing = store.get(input.key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + input.windowMs;
    store.set(input.key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: Math.max(input.limit - 1, 0),
      retryAfterSeconds: Math.ceil((resetAt - now) / 1000),
      resetAt,
    };
  }

  if (existing.count >= input.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
      resetAt: existing.resetAt,
    };
  }

  existing.count += 1;
  store.set(input.key, existing);
  return {
    allowed: true,
    remaining: Math.max(input.limit - existing.count, 0),
    retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    resetAt: existing.resetAt,
  };
}
