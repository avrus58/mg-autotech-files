type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
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

export function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const firstForwarded = forwarded?.split(",")[0]?.trim();
  return (
    firstForwarded ||
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
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
