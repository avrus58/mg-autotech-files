const ga4ConversionClaimPrefix = "mg_verified_conversion_v1:ga4:claim";
const defaultLeaseMs = 5_000;
const defaultAcquireTimeoutMs = 300;
const defaultSettleMs = 24;
const defaultWebLockResponseTimeoutMs = 500;

type ClaimStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type ClaimLockManager = {
  request: (
    name: string,
    options: { mode: "exclusive"; ifAvailable: true },
    callback: (lock: unknown | null) => boolean | Promise<boolean>
  ) => Promise<boolean>;
};

type StoredClaim = {
  version: 1;
  owner: string;
  expiresAt: number;
};

export type Ga4ConversionClaimOptions = {
  storage?: ClaimStorage | null;
  lockManager?: ClaimLockManager | null;
  ownerId?: string;
  now?: () => number;
  wait?: (milliseconds: number) => Promise<void>;
  leaseMs?: number;
  acquireTimeoutMs?: number;
  settleMs?: number;
  webLockResponseTimeoutMs?: number;
};

function boundedDuration(value: number | undefined, fallback: number, maximum: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.min(Math.round(value), maximum)
    : fallback;
}
function randomOwnerId() {
  try {
    return globalThis.crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
}

function claimKey(name: string, transactionId: string) {
  if (!/^(registration|request|purchase)$/.test(name)) return null;
  if (!/^[a-f0-9]{64}$/.test(transactionId)) return null;
  return `${ga4ConversionClaimPrefix}:${name}:${transactionId}`;
}

function resolveStorage(options: Ga4ConversionClaimOptions) {
  if (Object.prototype.hasOwnProperty.call(options, "storage")) {
    return options.storage ?? null;
  }
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function resolveLockManager(options: Ga4ConversionClaimOptions) {
  if (Object.prototype.hasOwnProperty.call(options, "lockManager")) {
    return options.lockManager ?? null;
  }
  try {
    const locks = typeof navigator === "undefined" ? null : navigator.locks;
    return locks as unknown as ClaimLockManager | null;
  } catch {
    return null;
  }
}

function readClaim(
  storage: ClaimStorage,
  key: string,
  now: number,
  maximumFutureMs: number
) {
  try {
    const parsed = JSON.parse(storage.getItem(key) ?? "null") as
      | Partial<StoredClaim>
      | null;
    if (
      parsed?.version !== 1 ||
      typeof parsed.owner !== "string" ||
      parsed.owner.length < 8 ||
      parsed.owner.length > 128 ||
      typeof parsed.expiresAt !== "number" ||
      !Number.isFinite(parsed.expiresAt) ||
      parsed.expiresAt <= now ||
      parsed.expiresAt > now + maximumFutureMs
    ) {
      if (parsed !== null) storage.removeItem(key);
      return null;
    }
    return parsed as StoredClaim;
  } catch {
    return null;
  }
}

function removeOwnedClaim(storage: ClaimStorage, key: string, owner: string) {
  try {
    const parsed = JSON.parse(storage.getItem(key) ?? "null") as
      | Partial<StoredClaim>
      | null;
    if (parsed?.version === 1 && parsed.owner === owner) {
      storage.removeItem(key);
    }
  } catch {
    // A bounded lease expires even when app-owned storage becomes unavailable.
  }
}

async function runWithStorageClaim(input: {
  key: string;
  canDeliver: () => boolean;
  deliver: () => Promise<boolean>;
  options: Ga4ConversionClaimOptions;
}) {
  if (!input.canDeliver()) return false;
  const storage = resolveStorage(input.options);
  if (!storage) return input.deliver();

  const now = input.options.now ?? Date.now;
  const wait = input.options.wait ?? ((milliseconds: number) =>
    new Promise<void>((resolve) => globalThis.setTimeout(resolve, milliseconds)));
  const leaseMs = boundedDuration(input.options.leaseMs, defaultLeaseMs, 30_000);
  const acquireTimeoutMs = boundedDuration(
    input.options.acquireTimeoutMs,
    defaultAcquireTimeoutMs,
    5_000
  );
  const settleMs = boundedDuration(input.options.settleMs, defaultSettleMs, 250);
  const owner = input.options.ownerId?.slice(0, 128) || randomOwnerId();
  const deadline = now() + acquireTimeoutMs;
  const maximumFutureMs = Math.max(leaseMs * 2, 1_000);

  while (input.canDeliver()) {
    const checkedAt = now();
    const existing = readClaim(storage, input.key, checkedAt, maximumFutureMs);
    if (existing && existing.owner !== owner) {
      const remaining = deadline - checkedAt;
      if (remaining <= 0) return false;
      await wait(Math.max(1, Math.min(remaining, existing.expiresAt - checkedAt, 40)));
      continue;
    }

    const claim: StoredClaim = {
      version: 1,
      owner,
      expiresAt: checkedAt + leaseMs,
    };
    try {
      storage.setItem(input.key, JSON.stringify(claim));
    } catch {
      const competing = readClaim(storage, input.key, now(), maximumFutureMs);
      return competing && competing.owner !== owner
        ? false
        : input.canDeliver()
          ? input.deliver()
          : false;
    }

    if (settleMs > 0) await wait(settleMs);
    if (!input.canDeliver()) {
      removeOwnedClaim(storage, input.key, owner);
      return false;
    }
    const confirmed = readClaim(storage, input.key, now(), maximumFutureMs);
    if (!confirmed || confirmed.owner !== owner) {
      if (now() >= deadline) return false;
      continue;
    }

    let acknowledged = false;
    try {
      acknowledged = await input.deliver();
      return acknowledged;
    } finally {
      // Keep a failed handoff claimed only until its short lease expires. This
      // prevents an immediate second tab from duplicating a late GA4 callback,
      // while still allowing a future document to recover the pending event.
      if (acknowledged || !input.canDeliver()) {
        removeOwnedClaim(storage, input.key, owner);
      }
    }
  }
  return false;
}

/**
 * Serializes one anonymous GA4 conversion per browser profile. Web Locks are
 * authoritative when available. The localStorage lease is a bounded fallback
 * and crash-recovery guard; provider transaction IDs remain the final defense
 * outside this browser profile.
 */
export async function runWithGa4ConversionClaim(input: {
  name: string;
  transactionId: string;
  canDeliver: () => boolean;
  deliver: () => Promise<boolean>;
  options?: Ga4ConversionClaimOptions;
}) {
  const key = claimKey(input.name, input.transactionId);
  if (!key || !input.canDeliver()) return false;
  const options = input.options ?? {};
  const lockManager = resolveLockManager(options);
  const run = () => runWithStorageClaim({ ...input, key, options });
  if (!lockManager) return run();

  const responseTimeoutMs = boundedDuration(
    options.webLockResponseTimeoutMs,
    defaultWebLockResponseTimeoutMs,
    5_000
  );
  let entered = false;
  let expired = false;
  let timer: ReturnType<typeof globalThis.setTimeout> | undefined;
  const responseTimeout = new Promise<boolean>((resolve) => {
    timer = globalThis.setTimeout(() => {
      if (entered) return;
      expired = true;
      resolve(false);
    }, responseTimeoutMs);
  });

  try {
    const lockRequest = lockManager.request(
      `mg-ga4-v1:${input.name}:${input.transactionId}`,
      { mode: "exclusive", ifAvailable: true },
      async (lock) => {
        entered = true;
        if (timer !== undefined) globalThis.clearTimeout(timer);
        if (!lock || expired || !input.canDeliver()) return false;
        return run();
      }
    );
    return await Promise.race([lockRequest, responseTimeout]);
  } catch {
    // Never mix locking protocols after a browser exposed Web Locks: another
    // tab may still own the authoritative lock. The durable event stays pending.
    return false;
  } finally {
    if (timer !== undefined) globalThis.clearTimeout(timer);
  }
}
