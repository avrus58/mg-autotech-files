export type StaffCreditAdjustmentAttempt = {
  idempotencyKey: string;
  payloadFingerprint: string;
  createdAt: number;
};

type SessionStorageLike = Pick<
  Storage,
  "length" | "key" | "getItem" | "setItem" | "removeItem"
>;

export type StaffCreditAdjustmentDurableRead =
  | { kind: "absent"; storedScopeCount: number }
  | { kind: "exact"; attempt: StaffCreditAdjustmentAttempt }
  | { kind: "conflict" }
  | { kind: "stale"; attempt: StaffCreditAdjustmentAttempt }
  | { kind: "legacy" }
  | { kind: "unavailable" };

export type StaffCreditAdjustmentPreparation =
  | {
      kind: "ready";
      attempt: StaffCreditAdjustmentAttempt;
      reused: boolean;
    }
  | {
      kind: "blocked";
      reason: "conflict" | "stale" | "legacy" | "unavailable" | "capacity";
    };

export type StaffCreditAdjustmentCompletion =
  | { kind: "cleared" }
  | { kind: "conflict" | "unavailable" };

export const staffCreditAdjustmentStoragePrefix = "mg:staff-credit-adjustment:v2:";
export const staffCreditAdjustmentMaxAgeMs = 24 * 60 * 60 * 1000;
export const staffCreditAdjustmentMaxStoredAttempts = 12;

const legacyStaffCreditAdjustmentStoragePrefix = "mg:staff-credit-adjustment:v1:";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sha256Pattern = /^[0-9a-f]{64}$/;

type ParsedAttempt =
  | { kind: "valid"; attempt: StaffCreditAdjustmentAttempt }
  | { kind: "stale"; attempt: StaffCreditAdjustmentAttempt }
  | { kind: "conflict" };

async function sha256Hex(value: string) {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle) throw new Error("Secure browser hashing is unavailable.");

  const digest = await cryptoApi.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function getStaffCreditAdjustmentSessionStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function createStaffCreditAdjustmentIdempotencyKey() {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.randomUUID) throw new Error("Secure browser UUID generation is unavailable.");
  return cryptoApi.randomUUID();
}

export function staffCreditAdjustmentStorageKey(scopeFingerprint: string) {
  return `${staffCreditAdjustmentStoragePrefix}${scopeFingerprint}`;
}

export function hashStaffCreditAdjustmentScope(actorId: string, customerId: string) {
  return sha256Hex(JSON.stringify([
    "staff-credit-adjustment-scope-v2",
    actorId,
    customerId,
  ]));
}

export function hashStaffCreditAdjustmentPayload(input: {
  actorId: string;
  customerId: string;
  amount: number;
  note: string;
}) {
  return sha256Hex(JSON.stringify([
    "staff-credit-adjustment-payload-v2",
    input.actorId,
    input.customerId,
    input.amount,
    input.note,
  ]));
}

function parseAttempt(raw: string, now: number): ParsedAttempt {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: "conflict" };
  }

  if (!parsed || typeof parsed !== "object") return { kind: "conflict" };
  const attempt = parsed as Partial<StaffCreditAdjustmentAttempt>;
  const storedFields = Object.keys(parsed).sort();
  if (
    storedFields.join(",") !== "createdAt,idempotencyKey,payloadFingerprint" ||
    typeof attempt.idempotencyKey !== "string" ||
    !uuidPattern.test(attempt.idempotencyKey) ||
    typeof attempt.payloadFingerprint !== "string" ||
    !sha256Pattern.test(attempt.payloadFingerprint) ||
    typeof attempt.createdAt !== "number" ||
    !Number.isFinite(attempt.createdAt)
  ) {
    return { kind: "conflict" };
  }

  const validAttempt = attempt as StaffCreditAdjustmentAttempt;
  if (Math.abs(now - validAttempt.createdAt) > staffCreditAdjustmentMaxAgeMs) {
    return { kind: "stale", attempt: validAttempt };
  }
  return { kind: "valid", attempt: validAttempt };
}

function countStoredScopes(storage: SessionStorageLike) {
  const keys = new Set<string>();
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(staffCreditAdjustmentStoragePrefix)) keys.add(key);
  }
  return keys.size;
}

export function readStaffCreditAdjustmentDurableState(
  storage: SessionStorageLike | null,
  input: {
    scopeFingerprint: string;
    payloadFingerprint: string;
    legacyCustomerId: string;
  },
  now = Date.now(),
): StaffCreditAdjustmentDurableRead {
  if (
    !storage ||
    !sha256Pattern.test(input.scopeFingerprint) ||
    !sha256Pattern.test(input.payloadFingerprint) ||
    !input.legacyCustomerId
  ) {
    return { kind: "unavailable" };
  }

  try {
    const legacyKey = `${legacyStaffCreditAdjustmentStoragePrefix}${input.legacyCustomerId}`;
    if (storage.getItem(legacyKey) !== null) return { kind: "legacy" };

    const storageKey = staffCreditAdjustmentStorageKey(input.scopeFingerprint);
    const raw = storage.getItem(storageKey);
    if (raw === null) {
      return { kind: "absent", storedScopeCount: countStoredScopes(storage) };
    }

    const parsed = parseAttempt(raw, now);
    if (parsed.kind === "conflict") return parsed;
    if (parsed.kind === "stale") return parsed;
    if (parsed.attempt.payloadFingerprint !== input.payloadFingerprint) {
      return { kind: "conflict" };
    }
    return { kind: "exact", attempt: parsed.attempt };
  } catch {
    return { kind: "unavailable" };
  }
}

export function prepareStaffCreditAdjustmentAttempt(
  storage: SessionStorageLike | null,
  input: {
    scopeFingerprint: string;
    payloadFingerprint: string;
    legacyCustomerId: string;
  },
  now = Date.now(),
  createIdempotencyKey = createStaffCreditAdjustmentIdempotencyKey,
): StaffCreditAdjustmentPreparation {
  const durableState = readStaffCreditAdjustmentDurableState(storage, input, now);
  if (durableState.kind === "exact") {
    return { kind: "ready", attempt: durableState.attempt, reused: true };
  }
  if (durableState.kind !== "absent") {
    return { kind: "blocked", reason: durableState.kind };
  }
  if (durableState.storedScopeCount >= staffCreditAdjustmentMaxStoredAttempts) {
    return { kind: "blocked", reason: "capacity" };
  }

  let idempotencyKey: string;
  try {
    idempotencyKey = createIdempotencyKey();
  } catch {
    return { kind: "blocked", reason: "unavailable" };
  }
  const attempt: StaffCreditAdjustmentAttempt = {
    idempotencyKey,
    payloadFingerprint: input.payloadFingerprint,
    createdAt: now,
  };
  if (!uuidPattern.test(idempotencyKey)) {
    return { kind: "blocked", reason: "unavailable" };
  }

  try {
    const storageKey = staffCreditAdjustmentStorageKey(input.scopeFingerprint);
    if (storage?.getItem(storageKey) !== null) {
      return { kind: "blocked", reason: "conflict" };
    }
    storage.setItem(storageKey, JSON.stringify(attempt));
  } catch {
    return { kind: "blocked", reason: "unavailable" };
  }

  const persistedState = readStaffCreditAdjustmentDurableState(storage, input, now);
  if (
    persistedState.kind !== "exact" ||
    persistedState.attempt.idempotencyKey !== attempt.idempotencyKey ||
    persistedState.attempt.createdAt !== attempt.createdAt
  ) {
    return {
      kind: "blocked",
      reason: persistedState.kind === "conflict" ? "conflict" : "unavailable",
    };
  }
  return { kind: "ready", attempt, reused: false };
}

export function completeStaffCreditAdjustmentAttempt(
  storage: SessionStorageLike | null,
  scopeFingerprint: string,
  expectedAttempt: StaffCreditAdjustmentAttempt,
): StaffCreditAdjustmentCompletion {
  if (!storage || !sha256Pattern.test(scopeFingerprint)) return { kind: "unavailable" };

  try {
    const storageKey = staffCreditAdjustmentStorageKey(scopeFingerprint);
    const raw = storage.getItem(storageKey);
    if (raw === null) return { kind: "conflict" };
    const parsed = parseAttempt(raw, expectedAttempt.createdAt);
    if (
      parsed.kind === "conflict" ||
      parsed.attempt.idempotencyKey !== expectedAttempt.idempotencyKey ||
      parsed.attempt.payloadFingerprint !== expectedAttempt.payloadFingerprint ||
      parsed.attempt.createdAt !== expectedAttempt.createdAt
    ) {
      return { kind: "conflict" };
    }

    storage.removeItem(storageKey);
    return storage.getItem(storageKey) === null
      ? { kind: "cleared" }
      : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}

export class StaffCreditAdjustmentOperationGuard {
  private readonly inFlightCustomers = new Set<string>();
  private readonly blockedCustomers = new Set<string>();

  tryAcquire(customerId: string): "acquired" | "in-flight" | "blocked" {
    if (this.blockedCustomers.has(customerId)) return "blocked";
    if (this.inFlightCustomers.has(customerId)) return "in-flight";
    this.inFlightCustomers.add(customerId);
    return "acquired";
  }

  release(customerId: string) {
    this.inFlightCustomers.delete(customerId);
  }

  block(customerId: string) {
    this.blockedCustomers.add(customerId);
  }

  isInFlight(customerId: string) {
    return this.inFlightCustomers.has(customerId);
  }
}
