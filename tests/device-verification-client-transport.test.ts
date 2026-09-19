import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import type { DeviceVerificationState } from "../src/lib/deviceVerificationClient";

type DeviceClient = Pick<typeof import("../src/lib/deviceVerificationClient"),
  "getDeviceVerificationStatus" | "startDeviceVerification" |
  "startPasswordChangeVerification" | "verifyDeviceCode" | "resendDeviceCode"
>;

type RequestHandler = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const compiledClient = ts.transpileModule(
  readFileSync(resolve(process.cwd(), "src/lib/deviceVerificationClient.ts"), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;

function response(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function deferred<T>() {
  let resolvePromise!: (value: T) => void;
  const promise = new Promise<T>((resolveValue) => { resolvePromise = resolveValue; });
  return { promise, resolve: resolvePromise };
}

async function flushPromises() {
  for (let index = 0; index < 12; index += 1) await Promise.resolve();
}

// Execute the production transport in a separate realm, with deterministic
// timers and an injected auth-fetch boundary. No Supabase client, environment,
// credentials, live browser, request service or real clock delay is involved.
function transportHarness({ supportsTimeout = true } = {}) {
  let now = 0;
  let timerId = 0;
  const timers = new Map<number, { at: number; callback: () => void }>();
  const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  let handler: RequestHandler = async () => {
    throw new Error("Unexpected unmocked authenticated request");
  };

  const schedule = (callback: () => void, delay = 0) => {
    const id = ++timerId;
    timers.set(id, { at: now + delay, callback });
    return id;
  };
  const clear = (id: number) => { timers.delete(id); };
  const timeout = (delay: number) => {
    const controller = new AbortController();
    schedule(() => controller.abort(new DOMException("Timed out", "TimeoutError")), delay);
    return controller.signal;
  };
  const exports: Partial<DeviceClient> = {};
  runInNewContext(compiledClient, {
    exports,
    AbortController,
    AbortSignal: supportsTimeout ? { timeout } : {},
    DOMException,
    Headers,
    Response,
    setTimeout: schedule,
    clearTimeout: clear,
    window: { setTimeout: schedule, clearTimeout: clear },
    require(name: string) {
      assert.equal(name, "@/lib/authGuards", "Unexpected production dependency");
      return {
        authenticatedFetch(input: RequestInfo | URL, init?: RequestInit) {
          requests.push({ input, init });
          return handler(input, init);
        },
      };
    },
  });

  return {
    client: exports as DeviceClient,
    requests,
    pendingTimers: () => timers.size,
    setHandler(next: RequestHandler) { handler = next; },
    advance(milliseconds: number) {
      now += milliseconds;
      for (;;) {
        const due = [...timers.entries()].find(([, timer]) => timer.at <= now);
        if (!due) break;
        timers.delete(due[0]);
        due[1].callback();
      }
    },
  };
}

function clientMethods(client: DeviceClient) {
  const challengeId = "00000000-0000-4000-8000-000000000001";
  const verification = { challengeId, code: "000000", rememberDevice: false };
  return [
    { run: () => client.getDeviceVerificationStatus(), path: "status", method: "GET" },
    { run: () => client.startDeviceVerification(), path: "start", method: "POST" },
    { run: () => client.startPasswordChangeVerification(), path: "password-change/start", method: "POST" },
    { run: () => client.verifyDeviceCode(verification), path: "verify", method: "POST", body: verification },
    { run: () => client.resendDeviceCode(challengeId), path: "resend", method: "POST", body: { challengeId } },
  ];
}

test("all five device methods preserve their request contract without AbortSignal.timeout", async () => {
  const harness = transportHarness({ supportsTimeout: false });
  harness.setHandler(async () => response({ status: "verified", maskedEmail: "synthetic" }));
  for (const entry of clientMethods(harness.client)) {
    const result = await entry.run();
    const request = harness.requests.at(-1)!;
    assert.equal(result.status, "verified");
    assert.equal(request.input, `/api/auth/device-verification/${entry.path}`);
    assert.equal(request.init?.method ?? "GET", entry.method);
    assert.ok(request.init?.signal);
    assert.equal(harness.pendingTimers(), 0);
    if (entry.body) {
      assert.equal(new Headers(request.init?.headers).get("Content-Type"), "application/json");
      assert.deepEqual(JSON.parse(String(request.init?.body)), entry.body);
    } else {
      assert.equal(request.init?.cache, "no-store");
    }
  }
  assert.equal(harness.requests.length, 5);
  assert.equal(new Set(harness.requests.map((request) => request.init?.signal)).size, 5);
});

test("device transport preserves each explicit assurance status", async () => {
  for (const status of ["not_required", "verified", "required", "revoked"] as const) {
    const harness = transportHarness();
    const state = { status, maskedEmail: "synthetic@example.invalid" };
    harness.setHandler(async () => response(state));
    assert.deepEqual(await harness.client.getDeviceVerificationStatus(), state);
    assert.equal(harness.requests.length, 1);
    assert.equal(harness.requests[0].init?.signal?.aborted, false);
  }
});

test("device transport preserves explicit recoverable challenge responses", async () => {
  for (const status of [202, 400, 409, 410, 423, 429]) {
    const harness = transportHarness();
    const state = {
      status: "required",
      maskedEmail: "synthetic@example.invalid",
      error: "Synthetic challenge retry required",
      canVerify: false,
    };
    harness.setHandler(async () => response(state, status));
    assert.deepEqual(await harness.client.startDeviceVerification(), state);
  }
});

test("device transport does not accept authentication or service errors as assurance", async () => {
  for (const status of [401, 403, 500, 503]) {
    const harness = transportHarness();
    harness.setHandler(async () => response({ error: "Synthetic service unavailable" }, status));
    await assert.rejects(harness.client.startDeviceVerification());
  }
});

test("device transport works without the optional AbortSignal.timeout helper", async () => {
  const harness = transportHarness({ supportsTimeout: false });
  const state = { status: "not_required", maskedEmail: "synthetic@example.invalid" };
  harness.setHandler(async () => response(state));
  assert.deepEqual(await harness.client.startDeviceVerification(), state);
  assert.equal(harness.requests.length, 1);
  assert.ok(harness.requests[0].init?.signal, "a compatible abort deadline is still required");
});

test("device transport rejects non-JSON success instead of returning an empty assurance", async () => {
  const harness = transportHarness();
  harness.setHandler(async () => new Response("<html>synthetic intermediary page</html>", {
    status: 200,
    headers: { "Content-Type": "text/html" },
  }));
  await assert.rejects(harness.client.startDeviceVerification());
});

test("device transport requires a known explicit assurance status", async () => {
  for (const payload of [
    {}, [], null,
    { status: "unknown", maskedEmail: "synthetic" },
    { status: ["verified"], maskedEmail: "synthetic" },
  ]) {
    const harness = transportHarness();
    harness.setHandler(async () => response(payload));
    await assert.rejects(harness.client.startDeviceVerification());
  }
});

test("device transport rejects statusless recoverable HTTP errors", async () => {
  const harness = transportHarness();
  harness.setHandler(async () => response({ error: "Synthetic invalid request" }, 400));
  await assert.rejects(harness.client.startDeviceVerification());
});

test("error HTTP responses cannot promote verified or not-required states", async () => {
  for (const status of [202, 400, 409, 410, 423, 429, 500, 503]) {
    for (const assurance of ["verified", "not_required"]) {
      const harness = transportHarness();
      harness.setHandler(async () => response({ status: assurance, maskedEmail: "synthetic" }, status));
      await assert.rejects(harness.client.startDeviceVerification());
    }
  }
});

test("HTTP 400 revoked verification remains an explicit denial", async () => {
  const harness = transportHarness();
  const state = { status: "revoked", maskedEmail: "synthetic" };
  harness.setHandler(async () => response(state, 400));
  assert.deepEqual(await harness.client.verifyDeviceCode({
    challengeId: "00000000-0000-4000-8000-000000000001", code: "000000", rememberDevice: false,
  }), state);
});

test("device transport rejects malformed fields and conflicting successful states", async () => {
  const base = { status: "required", maskedEmail: "synthetic" };
  for (const payload of [
    { status: "not_required" },
    { ...base, maskedEmail: null },
    { ...base, maskedEmail: 42 },
    { ...base, challengeId: false },
    { ...base, expiresAt: [] },
    { ...base, error: { message: "synthetic" } },
    { ...base, canVerify: "true" },
    { ...base, sentNewCode: 1 },
    { ...base, rateLimited: "false" },
    { ...base, retryAfterSeconds: -1 },
    { ...base, retryAfterSeconds: 1.5 },
    { ...base, attemptsRemaining: "3" },
    { ...base, outcome: ["new_code_sent"] },
    { ...base, outcome: "unknown" },
    { status: "verified", maskedEmail: "synthetic", error: "Synthetic failure" },
  ]) {
    const harness = transportHarness();
    harness.setHandler(async () => response(payload));
    await assert.rejects(harness.client.startDeviceVerification());
    assert.equal(harness.pendingTimers(), 0);
  }
});

test("settled requests clear timers without later aborting successful or failed operations", async () => {
  for (const mode of ["success", "network-error", "invalid-body"] as const) {
    const harness = transportHarness();
    harness.setHandler(async () => {
      if (mode === "network-error") throw new TypeError("Synthetic failed fetch");
      return response(mode === "success" ? { status: "not_required", maskedEmail: "synthetic" } : {});
    });
    if (mode === "success") await harness.client.startDeviceVerification();
    else await assert.rejects(harness.client.startDeviceVerification());
    assert.equal(harness.pendingTimers(), 0);
    harness.advance(60_000);
    assert.equal(harness.requests[0].init?.signal?.aborted, false);
  }
});

test("all five device methods time out while their JSON body is stuck", async () => {
  for (let index = 0; index < 5; index += 1) {
    const harness = transportHarness();
    const body = deferred<DeviceVerificationState>();
    let readingBody = false;
    harness.setHandler(async () => ({
      status: 200,
      async json() { readingBody = true; return body.promise; },
    }) as Response);
    const operation = clientMethods(harness.client)[index].run();
    const rejection = assert.rejects(operation, { name: "TimeoutError" });
    await flushPromises();
    assert.equal(readingBody, true);
    harness.advance(12_001);
    await rejection;
    assert.equal(harness.requests[0].init?.signal?.aborted, true);
    assert.equal(harness.pendingTimers(), 0);
    body.resolve({ status: "verified", maskedEmail: "synthetic" });
    await flushPromises();
  }
});

test("the device deadline settles the caller while auth preflight is still pending", async () => {
  const harness = transportHarness();
  const pending = deferred<Response>();
  harness.setHandler(() => pending.promise);
  let outcome: "pending" | "resolved" | "rejected" = "pending";
  const operation = harness.client.startDeviceVerification().then(
    () => { outcome = "resolved"; },
    () => { outcome = "rejected"; },
  );

  harness.advance(12_001);
  await flushPromises();
  const outcomeAtDeadline = String(outcome);
  const signalWasAborted = harness.requests[0].init?.signal?.aborted;
  // Always release the synthetic preflight, including on the red baseline.
  // No never-settling promise or timer escapes this test.
  pending.resolve(response({ status: "not_required", maskedEmail: "synthetic" }));
  await operation;

  assert.equal(signalWasAborted, true);
  assert.equal(outcomeAtDeadline, "rejected", "the signal alone does not bound auth preflight");
});

test("a preflight that resumes after the deadline cannot send an HTTP request", async () => {
  const harness = transportHarness();
  const preflight = deferred<void>();
  let networkCalls = 0;
  harness.setHandler(async (_input, init) => {
    await preflight.promise;
    if (init?.signal?.aborted) throw init.signal.reason;
    networkCalls += 1;
    return response({ status: "not_required", maskedEmail: "synthetic" });
  });
  const operation = harness.client.startDeviceVerification();
  const rejection = assert.rejects(operation);
  harness.advance(12_001);
  preflight.resolve();
  await rejection;
  assert.equal(networkCalls, 0);
});
