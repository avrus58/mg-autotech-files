import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { GoTrueClient, isAuthRetryableFetchError, type Session } from "@supabase/auth-js";
import { createBrowserAuthFetch } from "../src/lib/browserAuthFetch";

const serverNow = Date.parse("2026-09-19T17:43:45.000Z");
const hour = 60 * 60 * 1_000;
const successfulRefreshLimit = 30;

function sessionResponse(revision: number): Session {
  return {
    access_token: `synthetic-clock-access-${revision}`,
    refresh_token: `synthetic-clock-refresh-${revision}`,
    expires_at: Math.floor(serverNow / 1_000) + 3_600,
    expires_in: 3_600,
    token_type: "bearer",
    user: {
      id: "11111111-1111-4111-8111-111111111111",
      aud: "authenticated",
      app_metadata: {},
      user_metadata: {},
      created_at: "2026-01-01T00:00:00.000Z",
      email_confirmed_at: "2026-01-01T00:00:00.000Z",
    },
  };
}

// Exercise the installed SDK with a fixed independent server clock. Every
// request terminates in this in-memory transport; no application client, real
// credentials, environment files, browser storage or external network is used.
type HarnessOptions = {
  normalizeExpiry?: boolean;
  coldServerSession?: boolean;
  responseDelayMs?: number;
  passwordFailure?: { status: number; code: string };
  refreshFailure?: { status: number; code: string };
};

async function harness(t: TestContext, clockOffset: number, allowedRefreshes = successfulRefreshLimit, options: HarnessOptions = {}) {
  let localNow = serverNow + clockOffset;
  t.mock.method(Date, "now", () => localNow);
  const storageKey = `synthetic-clock-${clockOffset}-${allowedRefreshes}`;
  const storage = new Map<string, string>();
  if (options.coldServerSession) storage.set(storageKey, JSON.stringify(sessionResponse(-1)));
  const events: string[] = [];
  let passwordCalls = 0;
  let refreshCalls = 0;
  const failureResponse = (failure: { status: number; code: string }) => Response.json(
    { error_code: failure.code, message: "Synthetic auth rejection" },
    { status: failure.status },
  );
  const syntheticFetch: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://synthetic.invalid");
    assert.equal(url.pathname, "/auth/v1/token");
    assert.equal(init?.method, "POST");
    localNow += options.responseDelayMs ?? 0;
    const grant = url.searchParams.get("grant_type");
    if (grant === "password") {
      passwordCalls += 1;
      return options.passwordFailure ? failureResponse(options.passwordFailure) : Response.json(sessionResponse(0));
    }
    assert.equal(grant, "refresh_token");
    refreshCalls += 1;
    if (options.refreshFailure) return failureResponse(options.refreshFailure);
    return refreshCalls <= allowedRefreshes
      ? Response.json(sessionResponse(refreshCalls))
      : failureResponse({ status: 429, code: "over_request_rate_limit" });
  };
  const client = new GoTrueClient({
    url: "https://synthetic.invalid/auth/v1",
    storageKey,
    persistSession: true,
    // Explicit reads drive refresh deterministically, without waiting for the
    // SDK's 30-second background timer. This is not a claim about wall time.
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => { storage.set(key, value); },
      removeItem: (key) => { storage.delete(key); },
    },
    fetch: options.normalizeExpiry ? createBrowserAuthFetch("https://synthetic.invalid", syntheticFetch) : syntheticFetch,
  });
  t.after(() => client.dispose());
  client.onAuthStateChange((event) => { events.push(event); });
  await client.initialize();
  return {
    client,
    events,
    calls: () => ({ password: passwordCalls, refresh: refreshCalls }),
    hasStoredSession: () => storage.has(storageKey),
    advanceClock: (milliseconds: number) => { localNow += milliseconds; },
    login: () => client.signInWithPassword({ email: "synthetic@example.invalid", password: "synthetic-test-only" }),
  };
}

test("correct clock: repeated SDK session reads do not refresh a fresh one-hour session", { timeout: 5_000 }, async (t) => {
  const fixture = await harness(t, 0);
  assert.equal((await fixture.login()).error, null);
  for (let index = 0; index < 35; index += 1) {
    const result = await fixture.client.getSession();
    assert.equal(result.error, null);
    assert.ok(result.data.session);
  }
  assert.deepEqual(fixture.calls(), { password: 1, refresh: 0 });
  assert.equal(fixture.events.includes("SIGNED_OUT"), false);
  assert.equal(fixture.hasStoredSession(), true);
});

test("two-hour fast clock: every SDK read refreshes, then HTTP 429 removes the session", { timeout: 5_000 }, async (t) => {
  const fixture = await harness(t, 2 * hour);
  const login = await fixture.login();
  assert.equal(login.error, null);
  assert.equal(login.data.session?.expires_at, Math.floor(serverNow / 1_000) + 3_600);
  assert.ok(login.data.session!.expires_at! * 1_000 < Date.now());

  for (let index = 0; index < successfulRefreshLimit; index += 1) {
    const result = await fixture.client.getSession();
    assert.equal(result.error, null);
    assert.ok(result.data.session);
  }
  assert.equal(fixture.calls().refresh, successfulRefreshLimit);
  assert.equal(fixture.events.filter((event) => event === "TOKEN_REFRESHED").length, successfulRefreshLimit);
  assert.equal(fixture.events.includes("SIGNED_OUT"), false);

  const limited = await fixture.client.getSession();
  assert.equal(limited.error?.name, "AuthApiError");
  assert.equal(limited.error?.status, 429);
  assert.equal(limited.error?.code, "over_request_rate_limit");
  assert.equal(isAuthRetryableFetchError(limited.error), false);
  assert.equal(limited.data.session, null);
  assert.equal(fixture.hasStoredSession(), false);
  assert.equal(fixture.events.filter((event) => event === "SIGNED_OUT").length, 1);
  const missing = await fixture.client.getSession();
  assert.equal(missing.data.session, null);
  assert.equal(missing.error, null);
  assert.deepEqual(fixture.calls(), { password: 1, refresh: successfulRefreshLimit + 1 });
});

test("correct clock: explicit refresh HTTP 429 preserves a still-valid stored session", { timeout: 5_000 }, async (t) => {
  const fixture = await harness(t, 0, 0);
  assert.equal((await fixture.login()).error, null);
  const limited = await fixture.client.refreshSession();
  assert.equal(limited.error?.status, 429);
  assert.equal(isAuthRetryableFetchError(limited.error), false);
  assert.equal(fixture.hasStoredSession(), true);
  assert.equal(fixture.events.includes("SIGNED_OUT"), false);
  const current = await fixture.client.getSession();
  assert.equal(current.error, null);
  assert.ok(current.data.session);
  assert.deepEqual(fixture.calls(), { password: 1, refresh: 1 });
});

for (const clockOffset of [0, 2 * hour]) {
  test(`SDK session-notification feedback with ${clockOffset === 0 ? "correct" : "two-hour fast"} clock`, { timeout: 5_000 }, async (t) => {
    const fixture = await harness(t, clockOffset);
    let queuedReads = 0;
    let completedReads = 0;
    // This models the boundary's deferred session recheck on auth events; it
    // does not call async SDK methods inside the auth-state callback. Unlike
    // the fixed-count test, a successful refresh itself requests the next
    // read. The source boundary is not substituted into this focused SDK test.
    fixture.client.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "SIGNED_OUT") queuedReads += 1;
    });
    assert.equal((await fixture.login()).error, null);
    while (queuedReads > 0) {
      assert.ok(completedReads < 40, "Synthetic feedback must remain bounded");
      queuedReads -= 1;
      await fixture.client.getSession();
      completedReads += 1;
    }
    if (clockOffset === 0) {
      assert.equal(completedReads, 1);
      assert.deepEqual(fixture.calls(), { password: 1, refresh: 0 });
      assert.equal(fixture.hasStoredSession(), true);
    } else {
      assert.equal(completedReads, successfulRefreshLimit + 2);
      assert.deepEqual(fixture.calls(), { password: 1, refresh: successfulRefreshLimit + 1 });
      assert.equal(fixture.hasStoredSession(), false);
      assert.equal(fixture.events.filter((event) => event === "SIGNED_OUT").length, 1);
    }
  });
}

for (const clockOffset of [-2 * hour, 2 * hour]) {
  const clockLabel = clockOffset < 0 ? "two-hour slow" : "two-hour fast";

  test(`production expiry helper + SDK: ${clockLabel} login and notification rechecks stay bounded`, { timeout: 5_000 }, async (t) => {
    const fixture = await harness(t, clockOffset, 0, { normalizeExpiry: true });
    let queuedReads = 0;
    let completedReads = 0;
    fixture.client.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "SIGNED_OUT") queuedReads += 1;
    });
    const login = await fixture.login();
    assert.equal(login.error, null);
    assert.ok(login.data.session);
    assert.equal(login.data.session.expires_at, Math.floor(Date.now() / 1_000) + 3_600);
    assert.equal(login.data.session.access_token === sessionResponse(0).access_token, true);
    assert.equal(login.data.session.refresh_token === sessionResponse(0).refresh_token, true);
    while (queuedReads > 0) {
      assert.ok(completedReads < 4, "Corrected auth notifications must not cause a refresh loop");
      queuedReads -= 1;
      const current = await fixture.client.getSession();
      assert.equal(current.error, null);
      assert.ok(current.data.session);
      completedReads += 1;
    }
    assert.equal(completedReads, 1);
    for (let index = 0; index < 35; index += 1) {
      const current = await fixture.client.getSession();
      assert.equal(current.error, null);
      assert.ok(current.data.session);
    }
    assert.deepEqual(fixture.calls(), { password: 1, refresh: 0 });
    assert.equal(fixture.events.includes("SIGNED_OUT"), false);
    assert.equal(fixture.hasStoredSession(), true);
  });

  test(`production expiry helper + SDK: ${clockLabel} cold server-expiry session recovers on refresh`, { timeout: 5_000 }, async (t) => {
    const fixture = await harness(t, clockOffset, 1, { normalizeExpiry: true, coldServerSession: true });
    // A fast clock immediately sees the old absolute expiry as elapsed. A slow
    // clock sees that old metadata as valid: exercise the explicit refresh
    // used after an API rejects the real expired JWT, rather than claiming a
    // backward-clock cold load alone necessarily detects its own skew.
    const recovered = clockOffset > 0
      ? await fixture.client.getSession()
      : await fixture.client.refreshSession();
    assert.equal(recovered.error, null);
    assert.ok(recovered.data.session);
    assert.equal(recovered.data.session.expires_at, Math.floor(Date.now() / 1_000) + 3_600);
    for (let index = 0; index < 35; index += 1) {
      const current = await fixture.client.getSession();
      assert.equal(current.error, null);
      assert.ok(current.data.session);
    }
    assert.deepEqual(fixture.calls(), { password: 0, refresh: 1 });
    assert.equal(fixture.events.includes("SIGNED_OUT"), false);
    assert.equal(fixture.hasStoredSession(), true);
  });

  test(`production expiry helper + SDK: ${clockLabel} delayed response receives no extra lifetime`, { timeout: 5_000 }, async (t) => {
    const responseDelayMs = 15 * 60 * 1_000;
    const fixture = await harness(t, clockOffset, 0, { normalizeExpiry: true, responseDelayMs });
    const requestStartedAt = Date.now();
    const login = await fixture.login();
    assert.equal(login.error, null);
    assert.ok(login.data.session);
    assert.equal(login.data.session.expires_at, Math.floor(requestStartedAt / 1_000) + 3_600);
    assert.equal(login.data.session.expires_at * 1_000 - Date.now(), hour - responseDelayMs);
    assert.equal((await fixture.client.getSession()).error, null);
    assert.deepEqual(fixture.calls(), { password: 1, refresh: 0 });
  });

  test(`production expiry helper + SDK: ${clockLabel} rejected password remains denied`, { timeout: 5_000 }, async (t) => {
    const fixture = await harness(t, clockOffset, 0, {
      normalizeExpiry: true,
      passwordFailure: { status: 401, code: "invalid_credentials" },
    });
    const login = await fixture.login();
    assert.equal(login.error?.status, 401);
    assert.equal(login.error?.code, "invalid_credentials");
    assert.equal(login.data.session, null);
    assert.equal(fixture.hasStoredSession(), false);
    assert.equal((await fixture.client.getSession()).data.session, null);
    assert.deepEqual(fixture.calls(), { password: 1, refresh: 0 });
  });

  for (const failure of [
    { status: 400, code: "refresh_token_not_found" },
    { status: 401, code: "bad_jwt" },
    { status: 401, code: "session_not_found" },
  ]) {
    test(`production expiry helper + SDK: ${clockLabel} expired session ${failure.code} still fails closed`, { timeout: 5_000 }, async (t) => {
      const fixture = await harness(t, clockOffset, 0, { normalizeExpiry: true, refreshFailure: failure });
      assert.equal((await fixture.login()).error, null);
      fixture.advanceClock(hour + 1_000);
      const rejected = await fixture.client.getSession();
      assert.ok(rejected.error);
      if (failure.code === "session_not_found") {
        assert.equal(rejected.error.name, "AuthSessionMissingError");
      } else {
        assert.equal(rejected.error.status, failure.status);
        assert.equal(rejected.error.code, failure.code);
      }
      assert.equal(rejected.data.session, null);
      assert.equal(fixture.hasStoredSession(), false);
      assert.equal(fixture.events.filter((event) => event === "SIGNED_OUT").length, 1);
      assert.equal((await fixture.client.getSession()).data.session, null);
      assert.deepEqual(fixture.calls(), { password: 1, refresh: 1 });
    });
  }
}
