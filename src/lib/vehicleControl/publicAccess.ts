import { checkAdaptiveRateLimit } from "@/lib/abuseProtection";
import { checkRateLimit, rateLimitKey, type RateLimitResult } from "@/lib/rateLimit";
import type { RequestNetworkEnvironment } from "@/lib/requestNetwork";

export const publicVehicleAccessPolicy = {
  windowMs: 10 * 60_000,
  totalRequests: 300,
  hierarchyRequests: 180,
  distinctRoutes: {
    models: 40,
    generations: 80,
    engines: 120,
    vehicle: 80,
  },
} as const;

export type PublicVehicleRequestType = "brands" | "models" | "generations" | "engines" | "vehicle";

export type PublicVehicleQuery = {
  type: PublicVehicleRequestType;
  brandId: string;
  modelId: string;
  generationId: string;
  engineId: string;
};

type DistinctEntry = {
  resetAt: number;
  values: Set<string>;
};

type DistinctStore = Map<string, DistinctEntry>;

type PublicVehicleAccessGlobal = typeof globalThis & {
  __mgAutotechPublicVehicleDistinctStore?: DistinctStore;
};

const queryRequirements: Record<PublicVehicleRequestType, Array<keyof Omit<PublicVehicleQuery, "type">>> = {
  brands: [],
  models: ["brandId"],
  generations: ["brandId", "modelId"],
  engines: ["brandId", "modelId", "generationId"],
  vehicle: ["brandId", "modelId", "generationId", "engineId"],
};

const publicVehicleRequestTypes = new Set<PublicVehicleRequestType>([
  "brands",
  "models",
  "generations",
  "engines",
  "vehicle",
]);

const safeIdentifier = /^[a-z0-9][a-z0-9._-]{0,159}$/i;

function getDistinctStore() {
  const accessGlobal = globalThis as PublicVehicleAccessGlobal;
  if (!accessGlobal.__mgAutotechPublicVehicleDistinctStore) {
    accessGlobal.__mgAutotechPublicVehicleDistinctStore = new Map();
  }
  return accessGlobal.__mgAutotechPublicVehicleDistinctStore;
}

function checkDistinctLimit(input: {
  key: string;
  value: string;
  limit: number;
  windowMs: number;
}) {
  const now = Date.now();
  const store = getDistinctStore();
  if (store.size >= 5000) {
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt <= now) store.delete(key);
    }
  }

  const existing = store.get(input.key);
  const entry = existing && existing.resetAt > now
    ? existing
    : { resetAt: now + input.windowMs, values: new Set<string>() };
  const normalizedValue = input.value.toLowerCase();

  if (!entry.values.has(normalizedValue) && entry.values.size >= input.limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }

  entry.values.add(normalizedValue);
  store.set(input.key, entry);
  return {
    allowed: true,
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
  };
}

export function parsePublicVehicleQuery(input: string | URL):
  | { ok: true; query: PublicVehicleQuery }
  | { ok: false; error: string } {
  const url = input instanceof URL ? input : new URL(input, "https://vehicle-catalog.local");
  const typeValues = url.searchParams.getAll("type");
  if (typeValues.length !== 1 || !publicVehicleRequestTypes.has(typeValues[0] as PublicVehicleRequestType)) {
    return { ok: false, error: "Invalid vehicle catalog request" };
  }

  const type = typeValues[0] as PublicVehicleRequestType;
  const required = queryRequirements[type];
  const allowedKeys = new Set<string>(["type", ...required]);
  const seenKeys = new Set<string>();
  url.searchParams.forEach((_value, key) => seenKeys.add(key));

  if ([...seenKeys].some((key) => !allowedKeys.has(key))) {
    return { ok: false, error: "Invalid vehicle catalog request" };
  }

  for (const key of allowedKeys) {
    if (url.searchParams.getAll(key).length !== 1) {
      return { ok: false, error: "Invalid vehicle catalog request" };
    }
  }

  const query: PublicVehicleQuery = {
    type,
    brandId: url.searchParams.get("brandId") ?? "",
    modelId: url.searchParams.get("modelId") ?? "",
    generationId: url.searchParams.get("generationId") ?? "",
    engineId: url.searchParams.get("engineId") ?? "",
  };

  if (required.some((key) => !safeIdentifier.test(query[key]))) {
    return { ok: false, error: "Invalid vehicle catalog request" };
  }

  return { ok: true, query };
}

function distinctRouteValue(query: PublicVehicleQuery) {
  if (query.type === "models") return query.brandId;
  if (query.type === "generations") return [query.brandId, query.modelId].join("::");
  if (query.type === "engines") return [query.brandId, query.modelId, query.generationId].join("::");
  if (query.type === "vehicle") {
    return [query.brandId, query.modelId, query.generationId, query.engineId].join("::");
  }
  return "brands";
}

type PublicVehicleAccessDenied = {
  allowed: false;
  retryAfterSeconds: number;
  limit: number;
  windowMs: number;
  result: RateLimitResult;
};

function deniedAccess(input: {
  result: RateLimitResult;
  limit: number;
}): PublicVehicleAccessDenied {
  return {
    allowed: false,
    retryAfterSeconds: input.result.retryAfterSeconds,
    limit: input.limit,
    windowMs: publicVehicleAccessPolicy.windowMs,
    result: input.result,
  };
}

export async function checkPublicVehicleAccess(
  request: Request,
  query: PublicVehicleQuery,
  networkEnvironment: RequestNetworkEnvironment = process.env
) {
  const total = await checkAdaptiveRateLimit({
    request,
    scope: "public-vehicle-catalog",
    limit: publicVehicleAccessPolicy.totalRequests,
    windowMs: publicVehicleAccessPolicy.windowMs,
    networkEnvironment,
  });
  if (!total.allowed) {
    return deniedAccess({ result: total, limit: publicVehicleAccessPolicy.totalRequests });
  }

  if (query.type === "brands") {
    return { allowed: true as const, retryAfterSeconds: 0 };
  }

  const hierarchy = checkRateLimit({
    key: rateLimitKey(
      request,
      "public-vehicle-catalog-hierarchy",
      undefined,
      networkEnvironment
    ),
    limit: publicVehicleAccessPolicy.hierarchyRequests,
    windowMs: publicVehicleAccessPolicy.windowMs,
  });
  if (!hierarchy.allowed) {
    return deniedAccess({
      result: hierarchy,
      limit: publicVehicleAccessPolicy.hierarchyRequests,
    });
  }

  const distinct = checkDistinctLimit({
    key: rateLimitKey(
      request,
      `public-vehicle-catalog-distinct-${query.type}`,
      undefined,
      networkEnvironment
    ),
    value: distinctRouteValue(query),
    limit: publicVehicleAccessPolicy.distinctRoutes[query.type],
    windowMs: publicVehicleAccessPolicy.windowMs,
  });
  if (distinct.allowed) return { allowed: true as const, retryAfterSeconds: 0 };

  const resetAt = Date.now() + distinct.retryAfterSeconds * 1000;
  return deniedAccess({
    result: {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: distinct.retryAfterSeconds,
      resetAt,
    },
    limit: publicVehicleAccessPolicy.distinctRoutes[query.type],
  });
}
