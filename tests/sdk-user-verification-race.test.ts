import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { AuthSessionMissingError, GoTrueClient, type Session, type UserResponse } from "@supabase/auth-js";
import ts from "typescript";
import { createBrowserAuthFetch } from "../src/lib/browserAuthFetch";

type ReadMode = "shared-session" | "shared-explicit-token" | "isolated-explicit-token";
type UserOutcome = "session-not-found" | "ordinary-unauthorized" | "success";
type AuthOptions = ConstructorParameters<typeof GoTrueClient>[0];

const compiledClient = ts.transpileModule(
  readFileSync(resolve(process.cwd(), "src/lib/supabaseClient.ts"), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve: (value: T) => resolve(value) };
}

function fixtureSession(userId: string, revision: string): Session {
  return {
    access_token: `synthetic-${revision}-access`,
    refresh_token: `synthetic-${revision}-refresh`,
    expires_at: Math.floor(Date.now() / 1_000) + 3_600,
    expires_in: 3_600,
    token_type: "bearer",
    user: {
      id: userId,
      aud: "authenticated",
      app_metadata: {},
      user_metadata: {},
      created_at: "2026-09-19T00:00:00Z",
      email_confirmed_at: "2026-09-19T00:00:00Z",
    },
  };
}

function productionVerifier(harness: ReturnType<typeof sdkHarness>) {
  const observers: GoTrueClient[] = [];
  const observerOptions: AuthOptions[] = [];
  const observerBoundaries: Array<{ hasBroadcastChannel: boolean; usesPrivateMemoryStorage: boolean }> = [];
  const exports: { verifyBrowserAccessToken?: (token: string) => Promise<UserResponse> } = {};
  runInNewContext(compiledClient, {
    exports,
    URL,
    // This is a synthetic process object, never the host's environment.
    process: { env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://synthetic.invalid",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-public-key",
    } },
    require(name: string) {
      if (name === "@/lib/browserAuthFetch") return { createBrowserAuthFetch };
      if (name === "@supabase/supabase-js") {
        return { createClient: () => ({ auth: harness.shared }) };
      }
      assert.equal(name, "@supabase/auth-js", "Unexpected browser-client dependency");
      return {
        AuthSessionMissingError,
        AuthClient: class extends GoTrueClient {
          constructor(options: AuthOptions) {
            super({ ...options, fetch: harness.syntheticFetch });
            observerOptions.push(options);
            observerBoundaries.push({
              hasBroadcastChannel: this.broadcastChannel !== null,
              usesPrivateMemoryStorage: Boolean(this.memoryStorage),
            });
            observers.push(this);
          }
        },
      };
    },
  });
  assert.equal(typeof exports.verifyBrowserAccessToken, "function");
  return {
    verify: exports.verifyBrowserAccessToken!,
    observerOptions,
    observerBoundaries,
    dispose() { for (const observer of observers) observer.dispose(); },
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Run the installed SDK rather than a replacement getUser mock. Every request
// is handled by this in-memory fetch; no app client, environment file, browser
// storage, network, credential or real account is used.
function sdkHarness(mode: ReadMode, sameAccount: boolean) {
  const storageKey = `synthetic-sdk-user-review-${mode}-${sameAccount}`;
  const oldSession = fixtureSession("00000000-0000-4000-8000-000000000001", "old");
  const freshSession = fixtureSession(
    sameAccount ? oldSession.user.id : "00000000-0000-4000-8000-000000000002",
    "fresh",
  );
  const storage = new Map([[storageKey, JSON.stringify(oldSession)]]);
  const started = deferred<void>();
  const userResponse = deferred<Response>();
  const events: string[] = [];
  const requests: string[] = [];
  const syntheticFetch: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://synthetic.invalid");
    requests.push(`${init?.method} ${url.pathname}${url.search}`);
    if (url.pathname === "/auth/v1/user" && init?.method === "GET") {
      assert.equal(new Headers(init.headers).get("Authorization"), `Bearer ${oldSession.access_token}`);
      started.resolve();
      return userResponse.promise;
    }
    if (url.pathname === "/auth/v1/token" && url.search === "?grant_type=password" && init?.method === "POST") {
      return jsonResponse(freshSession);
    }
    throw new Error("Unexpected synthetic SDK request");
  };
  const shared = new GoTrueClient({
    url: "https://synthetic.invalid/auth/v1",
    storageKey,
    persistSession: true,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => { storage.set(key, value); },
      removeItem: (key) => { storage.delete(key); },
    },
    fetch: syntheticFetch,
  });
  const reader = mode === "isolated-explicit-token" ? new GoTrueClient({
    url: "https://synthetic.invalid/auth/v1",
    storageKey: `${storageKey}-read-only`,
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    fetch: syntheticFetch,
  }) : shared;
  shared.onAuthStateChange((event) => { events.push(event); });

  return {
    shared,
    syntheticFetch,
    storageKey,
    events,
    requests,
    oldSession,
    freshSession,
    async initialize() {
      await shared.initialize();
      if (reader !== shared) await reader.initialize();
    },
    readUser() {
      return mode === "shared-session" ? reader.getUser() : reader.getUser(oldSession.access_token);
    },
    waitForUserRequest: () => started.promise,
    login: () => shared.signInWithPassword({
      email: "synthetic@example.invalid",
      password: "synthetic-test-only",
    }),
    completeUserRead(outcome: UserOutcome) {
      userResponse.resolve(outcome === "success"
        ? jsonResponse(oldSession.user)
        : jsonResponse({
          error_code: outcome === "session-not-found" ? "session_not_found" : "bad_jwt",
          message: "Synthetic rejected user verification",
        }, 401));
    },
    storedSession(): Session | null {
      const value = storage.get(storageKey);
      return value ? JSON.parse(value) as Session : null;
    },
    dispose() {
      shared.dispose();
      if (reader !== shared) reader.dispose();
    },
  };
}

for (const sameAccount of [true, false]) {
  const account = sameAccount ? "same-account" : "different-account";

  for (const mode of ["shared-session", "shared-explicit-token"] as const) {
    test(`SDK hazard control: a stale ${mode} rejection erases a fresh ${account} login`, { timeout: 5_000 }, async (t) => {
      const harness = sdkHarness(mode, sameAccount);
      t.after(() => harness.dispose());
      await harness.initialize();
      const oldRead = harness.readUser();
      await harness.waitForUserRequest();
      const login = await harness.login();
      assert.equal(login.error, null);
      assert.equal(harness.storedSession()?.access_token, harness.freshSession.access_token);

      harness.completeUserRead("session-not-found");
      const oldResult = await oldRead;
      assert.equal(oldResult.data.user, null);
      assert.equal(oldResult.error?.name, "AuthSessionMissingError");
      // This documents the SDK behavior that application generation checks
      // cannot prevent: removal happens before getUser returns its error.
      assert.equal(harness.storedSession(), null);
      assert.equal(harness.events.includes("SIGNED_OUT"), true);
      assert.equal(harness.requests.length, 2);
    });
  }

  test(`an isolated explicit-token verifier preserves a fresh ${account} login while denying the old session`, { timeout: 5_000 }, async (t) => {
    const harness = sdkHarness("isolated-explicit-token", sameAccount);
    t.after(() => harness.dispose());
    await harness.initialize();
    const oldRead = harness.readUser();
    await harness.waitForUserRequest();
    assert.equal((await harness.login()).error, null);
    harness.completeUserRead("session-not-found");
    const oldResult = await oldRead;

    assert.equal(oldResult.data.user, null);
    assert.equal(oldResult.error?.name, "AuthSessionMissingError");
    assert.equal(harness.storedSession()?.access_token, harness.freshSession.access_token);
    assert.equal(harness.events.includes("SIGNED_OUT"), false);
    assert.equal(harness.requests.length, 2);
  });
}

for (const outcome of ["ordinary-unauthorized", "success"] as const) {
  test(`SDK control: an old ${outcome} user response does not erase a newer login`, { timeout: 5_000 }, async (t) => {
    const harness = sdkHarness("shared-session", true);
    t.after(() => harness.dispose());
    await harness.initialize();
    const oldRead = harness.readUser();
    await harness.waitForUserRequest();
    assert.equal((await harness.login()).error, null);
    harness.completeUserRead(outcome);
    const oldResult = await oldRead;

    assert.equal(harness.storedSession()?.access_token, harness.freshSession.access_token);
    assert.equal(harness.events.includes("SIGNED_OUT"), false);
    if (outcome === "success") {
      assert.equal(oldResult.data.user?.id, harness.oldSession.user.id);
      assert.equal(oldResult.error, null);
    } else {
      assert.equal(oldResult.data.user, null);
      assert.equal(oldResult.error?.name, "AuthApiError");
    }
  });
}

test("an isolated verifier still rejects a genuinely invalid current session", { timeout: 5_000 }, async (t) => {
  const harness = sdkHarness("isolated-explicit-token", true);
  t.after(() => harness.dispose());
  await harness.initialize();
  const verification = harness.readUser();
  await harness.waitForUserRequest();
  harness.completeUserRead("session-not-found");
  const result = await verification;

  assert.equal(result.data.user, null);
  assert.equal(result.error?.name, "AuthSessionMissingError");
  // Read-only denial is not authorization and does not remove another
  // client's persisted session. The caller must handle the denied result.
  assert.equal(harness.storedSession()?.access_token, harness.oldSession.access_token);
  assert.equal(harness.events.includes("SIGNED_OUT"), false);
  assert.equal(harness.requests.length, 1);
});

for (const sameAccount of [true, false]) {
  const account = sameAccount ? "same-account" : "different-account";
  test(`the production token verifier denies a stale session without erasing a newer ${account} login`, { timeout: 5_000 }, async (t) => {
    const harness = sdkHarness("shared-session", sameAccount);
    const production = productionVerifier(harness);
    t.after(() => { production.dispose(); harness.dispose(); });
    await harness.initialize();
    const verification = production.verify(harness.oldSession.access_token);
    await harness.waitForUserRequest();
    assert.equal((await harness.login()).error, null);
    harness.completeUserRead("session-not-found");
    const result = await verification;

    assert.equal(result.data.user, null);
    assert.equal(result.error?.name, "AuthSessionMissingError");
    assert.equal(harness.storedSession()?.access_token, harness.freshSession.access_token);
    assert.equal(harness.events.includes("SIGNED_OUT"), false);
    assert.equal(harness.requests.length, 2);
    assert.equal(production.observerOptions.length, 1);
    const options = production.observerOptions[0];
    assert.equal(options.persistSession, false);
    assert.equal(options.autoRefreshToken, false);
    assert.equal(options.detectSessionInUrl, false);
    assert.ok(options.storageKey);
    assert.notEqual(options.storageKey, harness.storageKey);
    assert.deepEqual(production.observerBoundaries, [{ hasBroadcastChannel: false, usesPrivateMemoryStorage: true }]);
  });
}

test("the production verifier refuses empty tokens without falling back to the shared session", async (t) => {
  const harness = sdkHarness("shared-session", true);
  const production = productionVerifier(harness);
  t.after(() => { production.dispose(); harness.dispose(); });
  await harness.initialize();
  for (const token of ["", " ", "\t\n"]) {
    const result = await production.verify(token);
    assert.equal(result.data.user, null);
    assert.equal(result.error?.name, "AuthSessionMissingError");
  }
  assert.equal(harness.requests.length, 0);
  assert.equal(harness.storedSession()?.access_token, harness.oldSession.access_token);
  assert.equal(harness.events.includes("SIGNED_OUT"), false);
});

for (const outcome of ["session-not-found", "ordinary-unauthorized", "success"] as const) {
  test(`the production verifier preserves the SDK's ${outcome} result without auth mutation`, { timeout: 5_000 }, async (t) => {
    const harness = sdkHarness("shared-session", true);
    const production = productionVerifier(harness);
    t.after(() => { production.dispose(); harness.dispose(); });
    await harness.initialize();
    const verification = production.verify(harness.oldSession.access_token);
    await harness.waitForUserRequest();
    harness.completeUserRead(outcome);
    const result = await verification;

    assert.equal(harness.storedSession()?.access_token, harness.oldSession.access_token);
    assert.equal(harness.events.includes("SIGNED_OUT"), false);
    assert.equal(harness.requests.length, 1);
    if (outcome === "success") {
      assert.equal(result.data.user?.id, harness.oldSession.user.id);
      assert.equal(result.error, null);
    } else {
      assert.equal(result.data.user, null);
      assert.equal(result.error?.name, outcome === "session-not-found" ? "AuthSessionMissingError" : "AuthApiError");
    }
  });
}
