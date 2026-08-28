import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { runWithGa4ConversionClaim } from "../src/lib/ga4ConversionClaim";

class MemoryStorage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

class AvailableOnlyLockManager {
  private readonly held = new Set<string>();
  readonly names: string[] = [];

  async request(
    name: string,
    _options: { mode: "exclusive"; ifAvailable: true },
    callback: (lock: unknown | null) => boolean | Promise<boolean>
  ) {
    this.names.push(name);
    if (this.held.has(name)) return callback(null);
    this.held.add(name);
    try {
      return await callback({ name });
    } finally {
      this.held.delete(name);
    }
  }
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

async function waitUntil(predicate: () => boolean, timeoutMs = 250) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) assert.fail("condition was not met before timeout");
    await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
  }
}

test("one Web Lock holder dispatches a same-browser GA4 transaction", async () => {
  const storage = new MemoryStorage();
  const locks = new AvailableOnlyLockManager();
  const transactionId = "a".repeat(64);
  const receipt = `receipt:${transactionId}`;
  const release = deferred();
  let sends = 0;
  let started = false;
  const deliver = async () => {
    if (storage.getItem(receipt) === "1") return true;
    sends += 1;
    started = true;
    await release.promise;
    storage.setItem(receipt, "1");
    return true;
  };

  const first = runWithGa4ConversionClaim({
    name: "registration",
    transactionId,
    canDeliver: () => true,
    deliver,
    options: { storage, lockManager: locks, ownerId: "first-owner", settleMs: 0 },
  });
  await waitUntil(() => started);
  const concurrent = await runWithGa4ConversionClaim({
    name: "registration",
    transactionId,
    canDeliver: () => true,
    deliver,
    options: { storage, lockManager: locks, ownerId: "second-owner", settleMs: 0 },
  });
  assert.equal(concurrent, false);
  assert.equal(sends, 1);

  release.resolve();
  assert.equal(await first, true);
  assert.equal(await runWithGa4ConversionClaim({
    name: "registration",
    transactionId,
    canDeliver: () => true,
    deliver,
    options: { storage, lockManager: locks, ownerId: "third-owner", settleMs: 0 },
  }), true);
  assert.equal(sends, 1);
  assert.ok(locks.names.every((name) => name.endsWith(transactionId)));
});
test("the localStorage fallback elects one owner for concurrent same-ID work", async () => {
  const storage = new MemoryStorage();
  const transactionId = "b".repeat(64);
  const receipt = `receipt:${transactionId}`;
  let sends = 0;
  const deliver = async () => {
    if (storage.getItem(receipt) === "1") return true;
    sends += 1;
    storage.setItem(receipt, "1");
    return true;
  };
  const options = (ownerId: string) => ({
    storage,
    lockManager: null,
    ownerId,
    settleMs: 2,
    acquireTimeoutMs: 100,
  });

  const results = await Promise.all([
    runWithGa4ConversionClaim({
      name: "request",
      transactionId,
      canDeliver: () => true,
      deliver,
      options: options("fallback-owner-one"),
    }),
    runWithGa4ConversionClaim({
      name: "request",
      transactionId,
      canDeliver: () => true,
      deliver,
      options: options("fallback-owner-two"),
    }),
  ]);
  assert.deepEqual(results, [true, true]);
  assert.equal(sends, 1);
});

test("a failed delivery lease is bounded and a later caller can recover", async () => {
  const storage = new MemoryStorage();
  const transactionId = "c".repeat(64);
  let clock = 1_000;
  let sends = 0;
  const common = {
    storage,
    lockManager: null,
    now: () => clock,
    wait: async (milliseconds: number) => { clock += milliseconds; },
    leaseMs: 50,
    acquireTimeoutMs: 10,
    settleMs: 0,
  };

  assert.equal(await runWithGa4ConversionClaim({
    name: "request",
    transactionId,
    canDeliver: () => true,
    deliver: async () => { sends += 1; return false; },
    options: { ...common, ownerId: "timeout-owner-one" },
  }), false);
  assert.equal(await runWithGa4ConversionClaim({
    name: "request",
    transactionId,
    canDeliver: () => true,
    deliver: async () => { sends += 1; return true; },
    options: { ...common, ownerId: "timeout-owner-two" },
  }), false);
  assert.equal(sends, 1);

  clock += 60;
  assert.equal(await runWithGa4ConversionClaim({
    name: "request",
    transactionId,
    canDeliver: () => true,
    deliver: async () => { sends += 1; return true; },
    options: { ...common, ownerId: "timeout-owner-three" },
  }), true);
  assert.equal(sends, 2);
  assert.equal(storage.length, 0);
});

test("revocation while claiming prevents dispatch and releases the owned lease", async () => {
  const storage = new MemoryStorage();
  let consented = true;
  let sends = 0;
  assert.equal(await runWithGa4ConversionClaim({
    name: "purchase",
    transactionId: "d".repeat(64),
    canDeliver: () => consented,
    deliver: async () => { sends += 1; return true; },
    options: {
      storage,
      lockManager: null,
      ownerId: "revoked-owner",
      settleMs: 1,
      wait: async () => { consented = false; },
    },
  }), false);
  assert.equal(sends, 0);
  assert.equal(storage.length, 0);
});

test("different transaction hashes remain independently dispatchable", async () => {
  const storage = new MemoryStorage();
  const locks = new AvailableOnlyLockManager();
  const release = deferred();
  let started = 0;
  const run = (transactionId: string, ownerId: string) =>
    runWithGa4ConversionClaim({
      name: "request",
      transactionId,
      canDeliver: () => true,
      deliver: async () => {
        started += 1;
        await release.promise;
        return true;
      },
      options: { storage, lockManager: locks, ownerId, settleMs: 0 },
    });

  const first = run("e".repeat(64), "different-owner-one");
  const second = run("f".repeat(64), "different-owner-two");
  await waitUntil(() => started === 2);
  release.resolve();
  assert.deepEqual(await Promise.all([first, second]), [true, true]);
});

test("an unresponsive Web Locks implementation fails closed within a bound", async () => {
  let sends = 0;
  const hangingLocks = {
    request: () => new Promise<boolean>(() => undefined),
  };
  const startedAt = Date.now();
  assert.equal(await runWithGa4ConversionClaim({
    name: "request",
    transactionId: "1".repeat(64),
    canDeliver: () => true,
    deliver: async () => { sends += 1; return true; },
    options: {
      storage: new MemoryStorage(),
      lockManager: hangingLocks,
      webLockResponseTimeoutMs: 5,
    },
  }), false);
  assert.equal(sends, 0);
  assert.ok(Date.now() - startedAt < 100);
});

test("the verified conversion dispatch rechecks the receipt inside the claim", () => {
  const source = readFileSync(
    path.join(process.cwd(), "src", "lib", "publicAnalytics.ts"),
    "utf8"
  );
  assert.match(
    source,
    /runWithGa4ConversionClaim\(\{[\s\S]*?deliver: async \(\) => \{[\s\S]*?conversionWasQueued\("ga4"[\s\S]*?target\.gtag\?\.\("event"/
  );
});
