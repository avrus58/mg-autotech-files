import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { createContext, runInContext } from "node:vm";
import type { Session } from "@supabase/supabase-js";
import ts from "typescript";

const firstUserId = "00000000-0000-4000-8000-000000000001";
const secondUserId = "00000000-0000-4000-8000-000000000002";
const firstSessionId = "10000000-0000-4000-8000-000000000001";
const secondSessionId = "10000000-0000-4000-8000-000000000002";
const revokedMessage = "This secure session was revoked. Sign in again.";

type SessionResult = { session: Session | null; error: unknown };
type SdkSessionResult = { data: { session: Session | null }; error: unknown };
type AuthListener = (event: string, session: Session | null) => void;
type Guards = {
  primeStableSession: (session: Session | null) => void;
  getStableSessionSnapshot: () => Session | null;
  getStableSession: () => Promise<SessionResult>;
  isCurrentBrowserSession: (session: Session) => boolean;
  signOutLocalIfSessionMatches: (session: Session) => Promise<boolean>;
  signOutStable: () => Promise<void>;
  signOutAllSessionsStable: () => Promise<void>;
  signOutLocalStable: () => Promise<void>;
  authenticatedFetch: (input: string) => Promise<Response>;
  authenticatedFetchForUser: (userId: string, input: string) => Promise<Response>;
};

function deferred<T>() {
  let resolvePromise!: (value: T) => void;
  const promise = new Promise<T>((resolve) => { resolvePromise = resolve; });
  return { promise, resolve: resolvePromise };
}

function fixtureSession(
  sessionId = firstSessionId,
  userId = firstUserId,
  rotation = 0,
): Session {
  const payload = Buffer.from(JSON.stringify({
    sub: userId,
    session_id: sessionId,
    iat: 1_000 + rotation,
  })).toString("base64url");
  return {
    // Entirely synthetic unsigned fixtures; never sent to a real service.
    access_token: `synthetic.${payload}.not-a-signature`,
    refresh_token: `synthetic-refresh-${sessionId}-${rotation}`,
    expires_in: 3_600,
    expires_at: Math.floor(Date.now() / 1_000) + 3_600,
    token_type: "bearer",
    user: {
      id: userId,
      aud: "authenticated",
      created_at: "2026-09-19T00:00:00.000Z",
      app_metadata: {},
      user_metadata: {},
    },
  };
}

function unauthorizedResponse(revoked = false) {
  return new Response(JSON.stringify({
    error: revoked ? revokedMessage : "Unauthorized",
  }), { status: 401, headers: { "Content-Type": "application/json" } });
}

// Exercise the production implementation in an isolated VM. Imports, browser
// state, SDK operations and fetch are mocked here; no environment or real SDK
// client is loaded, and an unexpected import/network operation fails closed.
const compiledGuards = ts.transpileModule(
  readFileSync(resolve(process.cwd(), "src/lib/authGuards.ts"), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;
const compiledMutations = ts.transpileModule(
  readFileSync(resolve(process.cwd(), "src/lib/browserAuthMutations.ts"), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;

function createHarness(initialSession: Session | null = null) {
  let currentSession = initialSession;
  const listeners = new Set<AuthListener>();
  const signOutScopes: Array<string | undefined> = [];
  const events: string[] = [];
  let fetchCalls = 0;
  let refreshCalls = 0;
  let sessionRead: () => Promise<SdkSessionResult> = async () => ({
    data: { session: currentSession }, error: null,
  });
  let sessionRefresh: () => Promise<SdkSessionResult> = async () => ({
    data: { session: currentSession }, error: null,
  });
  let fetchResponse: () => Promise<Response> = async () => {
    throw new Error("Unexpected unmocked fetch");
  };

  const emit = (event: string, session: Session | null) => {
    for (const listener of listeners) listener(event, session);
  };
  const auth = {
    onAuthStateChange(listener: AuthListener) {
      listeners.add(listener);
      return { data: { subscription: { unsubscribe: () => listeners.delete(listener) } } };
    },
    getSession: () => sessionRead(),
    async refreshSession() {
      refreshCalls += 1;
      return sessionRefresh();
    },
    async signOut(options?: { scope?: string }) {
      signOutScopes.push(options?.scope);
      currentSession = null;
      emit("SIGNED_OUT", null);
      return { error: null };
    },
  };
  const browser = {
    dispatchEvent(event: Event) { events.push(event.type); return true; },
    setTimeout,
    clearTimeout,
    atob,
  };
  const mutationContext = createContext({ exports: {}, window: browser });
  runInContext(compiledMutations, mutationContext);
  const context = createContext({
    exports: {},
    require(name: string) {
      if (name === "@/lib/supabaseClient") return { supabase: { auth } };
      if (name === "@/lib/browserAuthMutations") return mutationContext.exports;
      if (name === "@/lib/growth/publicClient") return { clearGrowthVisitorId() {} };
      if (name === "@/lib/customerDeviceContracts") {
        return { CUSTOMER_SESSION_REVOKED_MESSAGE: revokedMessage };
      }
      throw new Error(`Unexpected auth guard import: ${name}`);
    },
    window: browser,
    setTimeout,
    clearTimeout,
    Headers,
    Response,
    Event,
    AbortSignal,
    atob,
    fetch() { fetchCalls += 1; return fetchResponse(); },
  });
  runInContext(compiledGuards, context, { filename: "authGuards.test-vm.js" });
  const guards = context.exports as Guards;
  return {
    guards,
    signOutScopes,
    events,
    fetchCalls: () => fetchCalls,
    refreshCalls: () => refreshCalls,
    setSessionRead(read: () => Promise<SdkSessionResult>) { sessionRead = read; },
    setSessionRefresh(read: () => Promise<SdkSessionResult>) { sessionRefresh = read; },
    setFetchResponse(read: () => Promise<Response>) { fetchResponse = read; },
    persistSessionWithoutEvent(session: Session) { currentSession = session; },
    signIn(session: Session) {
      currentSession = session;
      emit("SIGNED_IN", session);
      guards.primeStableSession(session);
    },
    rotate(session: Session) {
      currentSession = session;
      emit("TOKEN_REFRESHED", session);
    },
  };
}

test("a late revoked response cannot log out a fresh session for the same account", async () => {
  const harness = createHarness();
  const first = fixtureSession();
  const second = fixtureSession(secondSessionId);
  const requestStarted = deferred<void>();
  const pendingResponse = deferred<Response>();
  harness.signIn(first);
  harness.setFetchResponse(() => {
    requestStarted.resolve();
    return pendingResponse.promise;
  });

  const request = harness.guards.authenticatedFetch("/synthetic-only")
    .then((response) => ({ response }), (error: unknown) => ({ error }));
  await requestStarted.promise;
  harness.signIn(second);
  pendingResponse.resolve(unauthorizedResponse(true));
  const outcome = await request;

  assert.deepEqual(harness.signOutScopes, []);
  assert.equal(harness.guards.getStableSessionSnapshot(), second);
  assert.equal(harness.events.includes("mg-autotech:auth-session-required"), false);
  if ("response" in outcome) assert.equal(outcome.response.status, 401);
});

test("a late revoked response for another account cannot log out the current account", async () => {
  const harness = createHarness();
  const first = fixtureSession();
  const second = fixtureSession(secondSessionId, secondUserId);
  const requestStarted = deferred<void>();
  const pendingResponse = deferred<Response>();
  harness.signIn(first);
  harness.setFetchResponse(() => {
    requestStarted.resolve();
    return pendingResponse.promise;
  });

  const request = harness.guards.authenticatedFetchForUser(firstUserId, "/synthetic-only")
    .then((response) => ({ response }), (error: unknown) => ({ error }));
  await requestStarted.promise;
  harness.signIn(second);
  pendingResponse.resolve(unauthorizedResponse(true));
  const outcome = await request;

  assert.deepEqual(harness.signOutScopes, []);
  assert.equal(harness.guards.getStableSessionSnapshot(), second);
  if ("response" in outcome) assert.equal(outcome.response.status, 401);
});

test("a confirmed revocation still signs out its current session and announces login is needed", async () => {
  const harness = createHarness();
  harness.signIn(fixtureSession());
  harness.setFetchResponse(async () => unauthorizedResponse(true));

  const response = await harness.guards.authenticatedFetch("/synthetic-only");

  assert.equal(response.status, 401);
  assert.deepEqual(harness.signOutScopes, ["local"]);
  assert.equal(harness.guards.getStableSessionSnapshot(), null);
  assert.equal(harness.events.includes("mg-autotech:auth-session-required"), true);
});

test("a rotated token still belongs to the same revoked session", async () => {
  const harness = createHarness();
  const first = fixtureSession();
  const rotated = fixtureSession(firstSessionId, firstUserId, 1);
  const requestStarted = deferred<void>();
  const pendingResponse = deferred<Response>();
  harness.signIn(first);
  harness.setFetchResponse(() => {
    requestStarted.resolve();
    return pendingResponse.promise;
  });

  const request = harness.guards.authenticatedFetch("/synthetic-only");
  await requestStarted.promise;
  harness.rotate(rotated);
  pendingResponse.resolve(unauthorizedResponse(true));
  assert.equal((await request).status, 401);
  assert.deepEqual(harness.signOutScopes, ["local"]);
  assert.equal(harness.guards.getStableSessionSnapshot(), null);
});

test("ordinary transient 401 responses preserve the session and retain bounded recovery", async () => {
  const harness = createHarness();
  const session = fixtureSession();
  harness.signIn(session);
  harness.setFetchResponse(async () => unauthorizedResponse());

  await assert.rejects(
    harness.guards.authenticatedFetch("/synthetic-only"),
    /secure session could not be synchronized/i,
  );

  assert.equal(harness.fetchCalls(), 3);
  assert.equal(harness.refreshCalls(), 2);
  assert.deepEqual(harness.signOutScopes, []);
  assert.equal(harness.guards.getStableSessionSnapshot(), session);
  assert.equal(harness.events.includes("mg-autotech:auth-session-required"), false);
});

test("normal explicit logout affects this browser session only", async () => {
  const harness = createHarness();
  harness.signIn(fixtureSession());

  await harness.guards.signOutStable();

  assert.deepEqual(harness.signOutScopes, ["local"]);
  assert.equal(harness.guards.getStableSessionSnapshot(), null);
});

test("explicit security-wide logout still revokes every provider session", async () => {
  const harness = createHarness();
  harness.signIn(fixtureSession());

  await harness.guards.signOutAllSessionsStable();

  assert.deepEqual(harness.signOutScopes, ["global"]);
  assert.equal(harness.guards.getStableSessionSnapshot(), null);
});

test("successful password reset uses security-wide logout before returning to login", () => {
  const source = readFileSync(
    resolve(process.cwd(), "src/app/reset-password/page.tsx"), "utf8",
  );

  assert.match(source, /import\s*\{[^}]*\bsignOutAllSessionsStable\b[^}]*\}\s*from\s*"@\/lib\/authGuards"/);
  assert.match(source, /await signOutAllSessionsStable\(\);\s*router\.replace\("\/login\?reset=success"\)/);
  assert.doesNotMatch(source, /await signOut(?:Local)?Stable\(\);\s*router\.replace\("\/login\?reset=success"\)/);
});

test("session identity distinguishes a new login but not ordinary token rotation", async () => {
  const harness = createHarness();
  const first = fixtureSession();
  const rotated = fixtureSession(firstSessionId, firstUserId, 1);
  harness.signIn(first);
  harness.rotate(rotated);

  assert.equal(harness.guards.isCurrentBrowserSession(first), true);
  assert.equal(harness.guards.isCurrentBrowserSession(fixtureSession(secondSessionId)), false);
  assert.equal(harness.guards.isCurrentBrowserSession(fixtureSession(firstSessionId, secondUserId)), false);
});

test("conditional signout ignores a stale session and still revokes a matching rotated session", async () => {
  const harness = createHarness();
  const first = fixtureSession();
  const second = fixtureSession(secondSessionId);
  harness.signIn(second);

  assert.equal(await harness.guards.signOutLocalIfSessionMatches(first), false);
  assert.equal(harness.guards.getStableSessionSnapshot(), second);
  assert.deepEqual(harness.signOutScopes, []);

  harness.rotate(fixtureSession(secondSessionId, firstUserId, 1));
  assert.equal(await harness.guards.signOutLocalIfSessionMatches(second), true);
  assert.deepEqual(harness.signOutScopes, ["local"]);
  assert.equal(harness.guards.getStableSessionSnapshot(), null);
});

test("a late successful SDK read cannot resurrect a session after explicit logout", async () => {
  const first = fixtureSession();
  const harness = createHarness(first);
  const readStarted = deferred<void>();
  const pendingRead = deferred<SdkSessionResult>();
  harness.setSessionRead(() => {
    readStarted.resolve();
    return pendingRead.promise;
  });

  const read = harness.guards.getStableSession();
  await readStarted.promise;
  await harness.guards.signOutLocalStable();
  pendingRead.resolve({ data: { session: first }, error: null });

  assert.equal((await read).session, null);
  assert.equal(harness.guards.getStableSessionSnapshot(), null);
  assert.deepEqual(harness.signOutScopes, ["local"]);
});

test("a late successful SDK read cannot overwrite a fresh account session", async () => {
  const first = fixtureSession();
  const second = fixtureSession(secondSessionId, secondUserId);
  const harness = createHarness(first);
  const readStarted = deferred<void>();
  const pendingRead = deferred<SdkSessionResult>();
  harness.setSessionRead(() => {
    readStarted.resolve();
    return pendingRead.promise;
  });

  const read = harness.guards.getStableSession();
  await readStarted.promise;
  harness.signIn(second);
  pendingRead.resolve({ data: { session: first }, error: null });

  assert.equal((await read).session, second);
  assert.equal(harness.guards.getStableSessionSnapshot(), second);
  assert.deepEqual(harness.signOutScopes, []);
});

test("a stale successful refresh cannot overwrite a more recent login", async () => {
  const first = fixtureSession();
  const second = fixtureSession(secondSessionId);
  const harness = createHarness();
  const refreshStarted = deferred<void>();
  const pendingRefresh = deferred<SdkSessionResult>();
  harness.signIn(first);
  harness.setFetchResponse(async () => harness.fetchCalls() === 1
    ? unauthorizedResponse()
    : new Response("{}", { status: 200 }));
  harness.setSessionRefresh(() => {
    refreshStarted.resolve();
    return pendingRefresh.promise;
  });

  const request = harness.guards.authenticatedFetch("/synthetic-only");
  const rejected = assert.rejects(request, /secure session could not be synchronized/i);
  await refreshStarted.promise;
  harness.signIn(second);
  pendingRefresh.resolve({ data: { session: first }, error: null });
  await rejected;
  assert.equal(harness.fetchCalls(), 1);
  assert.equal(harness.guards.getStableSessionSnapshot(), second);
  assert.deepEqual(harness.signOutScopes, []);
});

for (const status of [200, 428]) {
  test(`a late ${status} response cannot authorize or challenge a different current session`, async () => {
    const harness = createHarness();
    const first = fixtureSession();
    const second = fixtureSession(secondSessionId, secondUserId);
    const requestStarted = deferred<void>();
    const pendingResponse = deferred<Response>();
    harness.signIn(first);
    harness.setFetchResponse(() => {
      requestStarted.resolve();
      return pendingResponse.promise;
    });

    const request = harness.guards.authenticatedFetch("/synthetic-only");
    const rejected = assert.rejects(request, /secure session could not be synchronized/i);
    await requestStarted.promise;
    harness.signIn(second);
    pendingResponse.resolve(new Response("{}", { status }));
    await rejected;

    assert.equal(harness.guards.getStableSessionSnapshot(), second);
    assert.deepEqual(harness.signOutScopes, []);
    assert.equal(harness.events.includes("mg-autotech:device-verification-required"), false);
  });
}

test("opaque token fallback requires both the same user and exact token", async () => {
  const harness = createHarness();
  const session = { ...fixtureSession(), access_token: "synthetic-opaque-token" };
  harness.signIn(session);

  assert.equal(harness.guards.isCurrentBrowserSession({ ...session }), true);
  assert.equal(harness.guards.isCurrentBrowserSession({
    ...session, access_token: "synthetic-other-opaque-token",
  }), false);
  assert.equal(harness.guards.isCurrentBrowserSession({
    ...session, user: { ...session.user, id: secondUserId },
  }), false);
});

test("conditional logout preserves a newer persisted session before its broadcast arrives", async () => {
  const harness = createHarness();
  const first = fixtureSession();
  const second = fixtureSession(secondSessionId);
  harness.signIn(first);
  harness.persistSessionWithoutEvent(second);
  assert.equal(harness.guards.getStableSessionSnapshot(), first);

  assert.equal(await harness.guards.signOutLocalIfSessionMatches(first), false);

  assert.deepEqual(harness.signOutScopes, []);
  assert.equal(harness.guards.getStableSessionSnapshot(), second);
});
