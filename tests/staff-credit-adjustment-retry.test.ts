import assert from "node:assert/strict";
import test from "node:test";
import {
  completeStaffCreditAdjustmentAttempt,
  getStaffCreditAdjustmentSessionStorage,
  hashStaffCreditAdjustmentPayload,
  hashStaffCreditAdjustmentScope,
  prepareStaffCreditAdjustmentAttempt,
  readStaffCreditAdjustmentDurableState,
  StaffCreditAdjustmentOperationGuard,
  staffCreditAdjustmentMaxAgeMs,
  staffCreditAdjustmentMaxStoredAttempts,
  staffCreditAdjustmentStorageKey,
  staffCreditAdjustmentStoragePrefix,
  type StaffCreditAdjustmentAttempt,
} from "../src/lib/staffCreditAdjustmentRetry";

class MemorySessionStorage implements Storage {
  protected readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

class ThrowingReadStorage extends MemorySessionStorage {
  override getItem(key: string): string | null {
    void key;
    throw new DOMException("Storage denied", "SecurityError");
  }
}

class ThrowingSetStorage extends MemorySessionStorage {
  override setItem() {
    throw new DOMException("Storage full", "QuotaExceededError");
  }
}

class DroppingSetStorage extends MemorySessionStorage {
  override setItem() {
    // Simulates a browser accepting a write without retaining it.
  }
}

class ThrowingRemoveStorage extends MemorySessionStorage {
  override removeItem() {
    throw new DOMException("Storage denied", "SecurityError");
  }
}

class DroppingRemoveStorage extends MemorySessionStorage {
  override removeItem() {
    // Simulates cleanup that returns without removing the durable record.
  }
}

const actorOne = "11111111-1111-4111-8111-111111111111";
const actorTwo = "22222222-2222-4222-8222-222222222222";
const customerOne = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const customerTwo = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const now = 2_000_000_000_000;

function idempotencyKey(sequence: number) {
  return `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
}

function fingerprint(sequence: number) {
  return sequence.toString(16).padStart(64, "0");
}

function attempt(
  sequence: number,
  payloadFingerprint: string,
  createdAt = now,
): StaffCreditAdjustmentAttempt {
  return {
    idempotencyKey: idempotencyKey(sequence),
    payloadFingerprint,
    createdAt,
  };
}

function input(
  scopeFingerprint: string,
  payloadFingerprint: string,
  legacyCustomerId = customerOne,
) {
  return { scopeFingerprint, payloadFingerprint, legacyCustomerId };
}

test("staff credit fingerprints bind the exact actor, customer, amount and note", async () => {
  const exact = await hashStaffCreditAdjustmentPayload({
    actorId: actorOne,
    customerId: customerOne,
    amount: 25,
    note: "Reviewed workshop top-up",
  });
  const exactReplay = await hashStaffCreditAdjustmentPayload({
    actorId: actorOne,
    customerId: customerOne,
    amount: 25,
    note: "Reviewed workshop top-up",
  });
  assert.equal(exactReplay, exact);

  for (const changed of [
    { actorId: actorTwo, customerId: customerOne, amount: 25, note: "Reviewed workshop top-up" },
    { actorId: actorOne, customerId: customerTwo, amount: 25, note: "Reviewed workshop top-up" },
    { actorId: actorOne, customerId: customerOne, amount: 26, note: "Reviewed workshop top-up" },
    { actorId: actorOne, customerId: customerOne, amount: 25, note: "Different note" },
  ]) {
    assert.notEqual(await hashStaffCreditAdjustmentPayload(changed), exact);
  }

  assert.notEqual(
    await hashStaffCreditAdjustmentScope(actorOne, customerOne),
    await hashStaffCreditAdjustmentScope(actorTwo, customerOne),
  );
  assert.notEqual(
    await hashStaffCreditAdjustmentScope(actorOne, customerOne),
    await hashStaffCreditAdjustmentScope(actorOne, customerTwo),
  );
});

test("durable reads discriminate absent, exact, conflict, stale, legacy and unavailable without mutation", () => {
  const scope = fingerprint(1);
  const payload = fingerprint(101);
  const storage = new MemorySessionStorage();
  assert.deepEqual(
    readStaffCreditAdjustmentDurableState(storage, input(scope, payload), now),
    { kind: "absent", storedScopeCount: 0 },
  );

  const exactAttempt = attempt(1, payload);
  const storageKey = staffCreditAdjustmentStorageKey(scope);
  const exactRaw = JSON.stringify(exactAttempt);
  storage.setItem(storageKey, exactRaw);
  assert.deepEqual(
    readStaffCreditAdjustmentDurableState(storage, input(scope, payload), now),
    { kind: "exact", attempt: exactAttempt },
  );
  assert.deepEqual(
    readStaffCreditAdjustmentDurableState(storage, input(scope, fingerprint(102)), now),
    { kind: "conflict" },
  );
  assert.equal(storage.getItem(storageKey), exactRaw);

  assert.deepEqual(
    readStaffCreditAdjustmentDurableState(
      storage,
      input(scope, payload),
      now + staffCreditAdjustmentMaxAgeMs + 1,
    ),
    { kind: "stale", attempt: exactAttempt },
  );
  assert.equal(storage.getItem(storageKey), exactRaw);

  const legacyStorage = new MemorySessionStorage();
  const legacyKey = `mg:staff-credit-adjustment:v1:${customerOne}`;
  legacyStorage.setItem(legacyKey, "legacy-unresolved");
  assert.deepEqual(
    readStaffCreditAdjustmentDurableState(legacyStorage, input(scope, payload), now),
    { kind: "legacy" },
  );
  assert.equal(legacyStorage.getItem(legacyKey), "legacy-unresolved");
  assert.deepEqual(
    readStaffCreditAdjustmentDurableState(new ThrowingReadStorage(), input(scope, payload), now),
    { kind: "unavailable" },
  );
  assert.deepEqual(
    readStaffCreditAdjustmentDurableState(null, input(scope, payload), now),
    { kind: "unavailable" },
  );
});

test("double submit is locked synchronously while different customers can run concurrently", () => {
  const guard = new StaffCreditAdjustmentOperationGuard();
  assert.equal(guard.tryAcquire(customerOne), "acquired");
  assert.equal(guard.tryAcquire(customerOne), "in-flight");
  assert.equal(guard.tryAcquire(customerTwo), "acquired");
  assert.equal(guard.isInFlight(customerOne), true);
  assert.equal(guard.isInFlight(customerTwo), true);

  guard.release(customerOne);
  assert.equal(guard.tryAcquire(customerOne), "acquired");
  guard.release(customerOne);
  guard.release(customerTwo);
});

test("lost response reuses the exact key and a late success cannot clear a newer attempt", () => {
  const storage = new MemorySessionStorage();
  const guard = new StaffCreditAdjustmentOperationGuard();
  const scope = fingerprint(2);
  const originalPayload = fingerprint(201);
  const originalInput = input(scope, originalPayload);

  assert.equal(guard.tryAcquire(customerOne), "acquired");
  const first = prepareStaffCreditAdjustmentAttempt(
    storage,
    originalInput,
    now,
    () => idempotencyKey(2),
  );
  assert.equal(first.kind, "ready");
  if (first.kind !== "ready") return;
  guard.release(customerOne); // The RPC may have committed, but its response was lost.

  assert.equal(guard.tryAcquire(customerOne), "acquired");
  const retry = prepareStaffCreditAdjustmentAttempt(
    storage,
    originalInput,
    now + 1,
    () => idempotencyKey(99),
  );
  assert.equal(retry.kind, "ready");
  if (retry.kind !== "ready") return;
  assert.equal(retry.reused, true);
  assert.equal(retry.attempt.idempotencyKey, first.attempt.idempotencyKey);
  assert.deepEqual(
    completeStaffCreditAdjustmentAttempt(storage, scope, retry.attempt),
    { kind: "cleared" },
  );
  guard.release(customerOne);

  const newer = prepareStaffCreditAdjustmentAttempt(
    storage,
    input(scope, fingerprint(202)),
    now + 2,
    () => idempotencyKey(3),
  );
  assert.equal(newer.kind, "ready");
  if (newer.kind !== "ready") return;
  const newerRaw = storage.getItem(staffCreditAdjustmentStorageKey(scope));

  assert.deepEqual(
    completeStaffCreditAdjustmentAttempt(storage, scope, first.attempt),
    { kind: "conflict" },
  );
  assert.equal(storage.getItem(staffCreditAdjustmentStorageKey(scope)), newerRaw);
});

test("mismatch, expiry, legacy and read errors fail closed without deleting or rotating", () => {
  const scope = fingerprint(3);
  const payload = fingerprint(301);

  const mismatchStorage = new MemorySessionStorage();
  const pending = attempt(3, payload);
  mismatchStorage.setItem(staffCreditAdjustmentStorageKey(scope), JSON.stringify(pending));
  const mismatchRaw = mismatchStorage.getItem(staffCreditAdjustmentStorageKey(scope));
  assert.deepEqual(
    prepareStaffCreditAdjustmentAttempt(
      mismatchStorage,
      input(scope, fingerprint(302)),
      now + 1,
      () => idempotencyKey(4),
    ),
    { kind: "blocked", reason: "conflict" },
  );
  assert.equal(mismatchStorage.getItem(staffCreditAdjustmentStorageKey(scope)), mismatchRaw);

  assert.deepEqual(
    prepareStaffCreditAdjustmentAttempt(
      mismatchStorage,
      input(scope, payload),
      now + staffCreditAdjustmentMaxAgeMs + 1,
      () => idempotencyKey(4),
    ),
    { kind: "blocked", reason: "stale" },
  );
  assert.equal(mismatchStorage.getItem(staffCreditAdjustmentStorageKey(scope)), mismatchRaw);

  const legacyStorage = new MemorySessionStorage();
  const legacyKey = `mg:staff-credit-adjustment:v1:${customerOne}`;
  legacyStorage.setItem(legacyKey, "legacy-unresolved");
  assert.deepEqual(
    prepareStaffCreditAdjustmentAttempt(
      legacyStorage,
      input(scope, payload),
      now,
      () => idempotencyKey(4),
    ),
    { kind: "blocked", reason: "legacy" },
  );
  assert.equal(legacyStorage.getItem(legacyKey), "legacy-unresolved");

  assert.deepEqual(
    prepareStaffCreditAdjustmentAttempt(
      new ThrowingReadStorage(),
      input(scope, payload),
      now,
      () => idempotencyKey(4),
    ),
    { kind: "blocked", reason: "unavailable" },
  );
});

test("capacity rejects new scopes and never prunes unresolved attempts", () => {
  const storage = new MemorySessionStorage();
  const payload = fingerprint(401);
  for (let sequence = 1; sequence <= staffCreditAdjustmentMaxStoredAttempts; sequence += 1) {
    storage.setItem(
      staffCreditAdjustmentStorageKey(fingerprint(sequence)),
      JSON.stringify(attempt(sequence, payload, now + sequence)),
    );
  }
  const before = Array.from({ length: storage.length }, (_, index) => storage.key(index))
    .filter((key): key is string => Boolean(key?.startsWith(staffCreditAdjustmentStoragePrefix)))
    .map((key) => [key, storage.getItem(key)] as const);

  assert.deepEqual(
    prepareStaffCreditAdjustmentAttempt(
      storage,
      input(fingerprint(99), fingerprint(402), customerTwo),
      now + 100,
      () => idempotencyKey(99),
    ),
    { kind: "blocked", reason: "capacity" },
  );
  assert.equal(storage.length, staffCreditAdjustmentMaxStoredAttempts);
  for (const [key, value] of before) assert.equal(storage.getItem(key), value);

  const exactAtCapacity = prepareStaffCreditAdjustmentAttempt(
    storage,
    input(fingerprint(1), payload),
    now + 100,
    () => idempotencyKey(99),
  );
  assert.equal(exactAtCapacity.kind, "ready");
  if (exactAtCapacity.kind === "ready") assert.equal(exactAtCapacity.reused, true);
});

test("write and cleanup failures fail closed, and cleanup failure blocks the customer", () => {
  const scope = fingerprint(5);
  const payload = fingerprint(501);
  for (const storage of [new ThrowingSetStorage(), new DroppingSetStorage()]) {
    assert.deepEqual(
      prepareStaffCreditAdjustmentAttempt(
        storage,
        input(scope, payload),
        now,
        () => idempotencyKey(5),
      ),
      { kind: "blocked", reason: "unavailable" },
    );
  }

  for (const storage of [new ThrowingRemoveStorage(), new DroppingRemoveStorage()]) {
    const prepared = prepareStaffCreditAdjustmentAttempt(
      storage,
      input(scope, payload),
      now,
      () => idempotencyKey(5),
    );
    assert.equal(prepared.kind, "ready");
    if (prepared.kind !== "ready") continue;
    const raw = storage.getItem(staffCreditAdjustmentStorageKey(scope));
    assert.deepEqual(
      completeStaffCreditAdjustmentAttempt(storage, scope, prepared.attempt),
      { kind: "unavailable" },
    );
    assert.equal(storage.getItem(staffCreditAdjustmentStorageKey(scope)), raw);

    const guard = new StaffCreditAdjustmentOperationGuard();
    assert.equal(guard.tryAcquire(customerOne), "acquired");
    guard.block(customerOne);
    guard.release(customerOne);
    assert.equal(guard.tryAcquire(customerOne), "blocked");
    assert.equal(guard.tryAcquire(customerTwo), "acquired");
  }
});

test("new durable records contain no raw actor, customer, email or note", async () => {
  const storage = new MemorySessionStorage();
  const email = "private@example.test";
  const note = `Sensitive workshop correction for ${email}`;
  const scope = await hashStaffCreditAdjustmentScope(actorOne, customerOne);
  const payload = await hashStaffCreditAdjustmentPayload({
    actorId: actorOne,
    customerId: customerOne,
    amount: -10,
    note,
  });
  const prepared = prepareStaffCreditAdjustmentAttempt(
    storage,
    input(scope, payload),
    now,
    () => idempotencyKey(6),
  );
  assert.equal(prepared.kind, "ready");

  const serializedStorage = Array.from(
    { length: storage.length },
    (_, index) => {
      const key = storage.key(index) ?? "";
      return `${key}:${storage.getItem(key) ?? ""}`;
    },
  ).join("\n");
  for (const rawValue of [actorOne, customerOne, email, note]) {
    assert.doesNotMatch(serializedStorage, new RegExp(rawValue));
  }
  assert.deepEqual(
    Object.keys(JSON.parse(storage.getItem(staffCreditAdjustmentStorageKey(scope)) ?? "{}")).sort(),
    ["createdAt", "idempotencyKey", "payloadFingerprint"],
  );
});

test("staff credit retry storage access is SSR-safe", () => {
  assert.equal(getStaffCreditAdjustmentSessionStorage(), null);
});
