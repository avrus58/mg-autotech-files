import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { AuthSessionMissingError, GoTrueClient, type Session } from "@supabase/auth-js";
import ts from "typescript";

type Element = { type: unknown; props: Record<string, unknown> };
type Assurance = "not_required" | "verified" | "required" | "revoked";

function deferred<T>() {
  let finish!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => { finish = resolvePromise; });
  return { promise, resolve: finish };
}

function fixtureSession(revision: string, userId = "11111111-1111-4111-8111-111111111111"): Session {
  return {
    access_token: `synthetic-${revision}-access`,
    refresh_token: `synthetic-${revision}-refresh`,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: userId,
      aud: "authenticated",
      app_metadata: {},
      user_metadata: {},
      created_at: "2026-01-01T00:00:00.000Z",
      email_confirmed_at: "2026-01-01T00:00:00.000Z",
    },
  };
}

async function settle() {
  for (let index = 0; index < 80; index += 1) await Promise.resolve();
  await new Promise<void>((done) => setImmediate(done));
}

// Execute the installed SDK plus the actual client, guard, device-status and
// admin-boundary sources. Only transport, browser timers and React hooks are
// synthetic; no environment files, remote endpoint or customer data are used.
async function harness(initialSession: Session | null, assurance: Assurance = "verified") {
  const storageKey = "synthetic-admin-fresh-login";
  const storage = new Map<string, string>();
  if (initialSession) storage.set(storageKey, JSON.stringify(initialSession));
  let nextLoginSession = fixtureSession("fresh");
  const userRequest = deferred<Response>();
  const userRequestStarted = deferred<void>();
  const events: string[] = [];
  const clients: GoTrueClient[] = [];
  let logoutCalls = 0;
  let statusCalls = 0;
  const sdkFetch: typeof fetch = async (input) => {
    const url = String(input);
    if (url === "https://synthetic.invalid/auth/v1/user") {
      userRequestStarted.resolve();
      return userRequest.promise;
    }
    if (url === "https://synthetic.invalid/auth/v1/token?grant_type=password") {
      return Response.json(nextLoginSession);
    }
    if (url === "https://synthetic.invalid/auth/v1/logout?scope=local") {
      logoutCalls += 1;
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected SDK request: ${url}`);
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
    fetch: sdkFetch,
  });
  clients.push(shared);
  shared.onAuthStateChange((event) => { events.push(event); });
  await shared.initialize();

  let time = 0;
  let timerId = 0;
  const timers = new Map<number, { due: number; callback: () => void }>();
  const listeners = new Map<string, Set<() => void>>();
  const browser = {
    setTimeout(callback: () => void, delay = 0) {
      const id = ++timerId;
      timers.set(id, { due: time + delay, callback });
      return id;
    },
    clearTimeout(id: number) { timers.delete(id); },
    addEventListener(name: string, callback: () => void) {
      const callbacks = listeners.get(name) ?? new Set<() => void>();
      callbacks.add(callback);
      listeners.set(name, callbacks);
    },
    removeEventListener(name: string, callback: () => void) { listeners.get(name)?.delete(callback); },
    dispatchEvent(event: Event) { listeners.get(event.type)?.forEach((callback) => callback()); },
  };
  const imports: Record<string, unknown> = {
    "@supabase/supabase-js": { createClient: () => ({ auth: shared }) },
    "@supabase/auth-js": {
      AuthSessionMissingError,
      AuthClient: class extends GoTrueClient {
        constructor(options: ConstructorParameters<typeof GoTrueClient>[0]) {
          super({ ...options, fetch: sdkFetch });
          clients.push(this);
        }
      },
    },
    "@/lib/growth/publicClient": { clearGrowthVisitorId() {} },
    "@/lib/customerDeviceContracts": { CUSTOMER_SESSION_REVOKED_MESSAGE: "Synthetic revoked session" },
  };
  const evaluate = (file: string) => {
    const compiled = ts.transpileModule(readFileSync(resolve(process.cwd(), file), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const exports: Record<string, unknown> = {};
    runInNewContext(compiled, {
      exports,
      process: { env: {
        NEXT_PUBLIC_SUPABASE_URL: "https://synthetic.invalid",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-anon-key",
      } },
      window: browser,
      setTimeout: browser.setTimeout,
      clearTimeout: browser.clearTimeout,
      Headers, Response, AbortController, AbortSignal, Event, URL, atob,
      fetch: async (input: RequestInfo | URL) => {
        assert.equal(input, "/api/auth/device-verification/status");
        statusCalls += 1;
        return Response.json({ status: assurance, maskedEmail: "synthetic@example.invalid" });
      },
      require(name: string) {
        assert.ok(name in imports, `Unexpected dependency: ${name}`);
        return imports[name];
      },
    });
    return exports;
  };
  imports["@/lib/supabaseClient"] = evaluate("src/lib/supabaseClient.ts");
  imports["@/lib/browserAuthMutations"] = evaluate("src/lib/browserAuthMutations.ts");
  const guards = evaluate("src/lib/authGuards.ts") as typeof import("../src/lib/authGuards");
  imports["@/lib/authGuards"] = guards;
  imports["@/lib/deviceVerificationClient"] = evaluate("src/lib/deviceVerificationClient.ts");
  guards.primeStableSession(initialSession);

  const states: unknown[] = [];
  const refs: { current: unknown }[] = [];
  let stateIndex = 0;
  let refIndex = 0;
  let effect: (() => () => void) | undefined;
  let cleanup: (() => void) | undefined;
  const commits: string[] = [];
  imports.react = {
    useState(initial: unknown) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (next: unknown) => {
        states[index] = typeof next === "function"
          ? (next as (previous: unknown) => unknown)(states[index]) : next;
        if (index === 0) commits.push(String(states[index]));
      }];
    },
    useRef(value: unknown) {
      const index = refIndex++;
      return refs[index] ?? (refs[index] = { current: value });
    },
    useCallback: (callback: unknown) => callback,
    useEffect(next: () => () => void) { effect = next; },
  };
  const jsx = (type: unknown, props: Record<string, unknown>): Element => ({ type, props });
  imports["react/jsx-runtime"] = { jsx, jsxs: jsx, Fragment: "fragment" };
  imports["lucide-react"] = { Loader2: "loader", RefreshCcw: "retry" };
  imports["next/navigation"] = { usePathname: () => "/admin" };
  imports["@/components/auth/AuthRequired"] = { AuthRequired: "login" };
  imports["@/components/auth/DeviceVerificationPanel"] = { DeviceVerificationPanel: "verification" };
  imports["@/lib/i18n/customer-portal-first-paint"] = {
    customerPortalFirstPaintT: (_locale: string, source: string) => source,
  };
  imports["@/lib/useActiveLocale"] = { useActiveLocale: () => "en" };
  const boundary = evaluate("src/components/auth/BrowserAuthBoundary.tsx").BrowserAuthBoundary as
    (props: Record<string, unknown>) => Element;
  imports["@/components/auth/BrowserAuthBoundary"] = { BrowserAuthBoundary: "boundary" };
  for (const name of ["AdminNotificationDock", "AdminWorkspaceRestoreGuard", "AdminMobileNavigation"]) {
    imports[`@/components/admin/${name}`] = { [name]: name };
  }
  imports["./mobile.css"] = {};
  const layout = evaluate("src/app/admin/layout.tsx").default as (props: object) => Element;
  const layoutChildren = layout({ children: "private" }).props.children as Element[];
  const boundaryProps = layoutChildren.find((child) => child.type === "boundary")?.props;
  assert.ok(boundaryProps);
  assert.equal(boundaryProps.title, "Please log in to access the admin workspace");
  const render = () => {
    stateIndex = 0;
    refIndex = 0;
    return boundary(boundaryProps);
  };
  const advance = async (milliseconds: number) => {
    const until = time + milliseconds;
    await settle();
    for (let remaining = 100; remaining > 0; remaining -= 1) {
      const next = [...timers.entries()].filter(([, task]) => task.due <= until)
        .sort((a, b) => a[1].due - b[1].due)[0];
      if (!next) break;
      timers.delete(next[0]);
      time = next[1].due;
      next[1].callback();
      await settle();
    }
    time = until;
  };
  await Promise.all(clients.map((client) => client.initialize()));
  await settle();
  return {
    shared, guards, userRequest, userRequestStarted, events, commits, render, advance,
    mount() { render(); assert.ok(effect); cleanup = effect(); },
    async loginFresh(session = fixtureSession("fresh")) {
      nextLoginSession = session;
      const result = await shared.signInWithPassword({ email: "synthetic@example.invalid", password: "synthetic-only" });
      assert.equal(result.error, null);
      assert.equal(result.data.session?.access_token, session.access_token);
      guards.primeStableSession(result.data.session);
    },
    dispose() { cleanup?.(); clients.forEach((client) => client.dispose()); },
    get state() { return states[0]; },
    get logoutCalls() { return logoutCalls; },
    get statusCalls() { return statusCalls; },
  };
}

function rejectOldUserRequest() {
  return Response.json({
    error_code: "session_not_found", message: "Synthetic rejected user verification",
  }, { status: 401 });
}

test("hazard control: a late shared-SDK getUser rejection removes a fresh login and shows the actual admin warning", async (t) => {
  const subject = await harness(fixtureSession("old"));
  t.after(() => subject.dispose());
  const oldRead = subject.shared.getUser();
  await subject.userRequestStarted.promise;
  await subject.loginFresh();
  subject.mount();
  await subject.advance(0);
  assert.equal(subject.state, "authenticated");

  subject.userRequest.resolve(rejectOldUserRequest());
  assert.equal((await oldRead).error?.name, "AuthSessionMissingError");
  assert.equal((await subject.shared.getSession()).data.session, null);
  assert.equal(subject.events.includes("SIGNED_OUT"), true);
  await subject.advance(1200);
  assert.equal(subject.state, "unauthenticated");
  const output = subject.render();
  assert.equal(output.type, "login");
  assert.equal(output.props.title, "Please log in to access the admin workspace");
});

test("actual isolated getStableUser rejects stale verification without dropping a fresh verified admin session", async (t) => {
  const subject = await harness(fixtureSession("old"));
  t.after(() => subject.dispose());
  const oldRead = subject.guards.getStableUser();
  await subject.userRequestStarted.promise;
  await subject.loginFresh();
  subject.mount();
  await subject.advance(0);
  assert.equal(subject.state, "authenticated");

  subject.userRequest.resolve(rejectOldUserRequest());
  const result = await oldRead;
  assert.equal(result.data.user, null);
  assert.equal(result.error?.name, "AuthSessionRecoveryPendingError");
  assert.equal((await subject.shared.getSession()).data.session?.access_token, "synthetic-fresh-access");
  assert.equal(subject.guards.getStableSessionSnapshot()?.access_token, "synthetic-fresh-access");
  assert.equal(subject.events.includes("SIGNED_OUT"), false);
  await subject.advance(30000);
  assert.equal(subject.state, "authenticated");
  assert.equal(subject.commits.includes("unauthenticated"), false);
  assert.equal(subject.logoutCalls, 0);
});

test("genuinely empty browser storage still shows the actual admin login warning", async (t) => {
  const subject = await harness(null);
  t.after(() => subject.dispose());
  subject.mount();
  await subject.advance(1200);
  assert.equal(subject.state, "unauthenticated");
  assert.equal(subject.render().props.title, "Please log in to access the admin workspace");
  assert.equal(subject.statusCalls, 0);
  assert.equal(subject.logoutCalls, 0);
});

test("a genuinely revoked current session still signs out locally and blocks the admin workspace", async (t) => {
  const subject = await harness(fixtureSession("current"), "revoked");
  t.after(() => subject.dispose());
  subject.mount();
  await subject.advance(1200);
  assert.equal(subject.state, "unauthenticated");
  assert.equal(subject.render().props.title, "Please log in to access the admin workspace");
  assert.equal((await subject.shared.getSession()).data.session, null);
  assert.equal(subject.guards.getStableSessionSnapshot(), null);
  assert.equal(subject.logoutCalls, 1);
  assert.equal(subject.events.includes("SIGNED_OUT"), true);
});

test("getStableUser discards late successful old-account data after another account signs in", async (t) => {
  const oldSession = fixtureSession("old");
  const replacement = fixtureSession("replacement", "22222222-2222-4222-8222-222222222222");
  const subject = await harness(oldSession);
  t.after(() => subject.dispose());
  const oldRead = subject.guards.getStableUser();
  await subject.userRequestStarted.promise;
  await subject.loginFresh(replacement);
  subject.userRequest.resolve(Response.json(oldSession.user));
  const result = await oldRead;
  assert.equal(result.data.user, null);
  assert.equal(result.error?.name, "AuthSessionRecoveryPendingError");
  assert.equal((await subject.shared.getSession()).data.session?.user.id, replacement.user.id);
  assert.equal(subject.guards.getStableSessionSnapshot()?.user.id, replacement.user.id);
  assert.equal(subject.events.includes("SIGNED_OUT"), false);
  assert.equal(subject.logoutCalls, 0);
});

test("getStableUser also discards old data after token rotation within the same session identity", async (t) => {
  const oldSession = fixtureSession("old");
  const rotatedSession = fixtureSession("rotated");
  const claims = Buffer.from(JSON.stringify({ session_id: "synthetic-shared-session" })).toString("base64url");
  oldSession.access_token = `synthetic.${claims}.old`;
  rotatedSession.access_token = `synthetic.${claims}.rotated`;
  const subject = await harness(oldSession);
  t.after(() => subject.dispose());
  const oldRead = subject.guards.getStableUser();
  await subject.userRequestStarted.promise;
  await subject.loginFresh(rotatedSession);
  assert.equal(subject.guards.isCurrentBrowserSession(oldSession), true);
  subject.userRequest.resolve(Response.json(oldSession.user));
  const result = await oldRead;
  assert.equal(result.data.user, null);
  assert.equal(result.error?.name, "AuthSessionRecoveryPendingError");
  assert.equal((await subject.shared.getSession()).data.session?.access_token, rotatedSession.access_token);
  assert.equal(subject.events.includes("SIGNED_OUT"), false);
  assert.equal(subject.logoutCalls, 0);
});

test("getStableUser returns the server-verified user when the captured session is still current", async (t) => {
  const current = fixtureSession("current");
  const serverUser = { ...current.user, user_metadata: { syntheticSource: "server-verified" } };
  const subject = await harness(current);
  t.after(() => subject.dispose());
  const read = subject.guards.getStableUser();
  await subject.userRequestStarted.promise;
  subject.userRequest.resolve(Response.json(serverUser));
  const result = await read;
  assert.equal(result.error, null);
  assert.deepEqual(result.data.user, serverUser);
  assert.equal((await subject.shared.getSession()).data.session?.access_token, current.access_token);
  assert.equal(subject.events.includes("SIGNED_OUT"), false);
  assert.equal(subject.logoutCalls, 0);
});

test("getStableUser never returns cached verified data on a current session_not_found denial", async (t) => {
  const current = fixtureSession("current");
  const subject = await harness(current, "revoked");
  t.after(() => subject.dispose());
  const read = subject.guards.getStableUser();
  await subject.userRequestStarted.promise;
  subject.userRequest.resolve(rejectOldUserRequest());
  const result = await read;
  assert.equal(result.data.user, null);
  assert.equal(result.error?.name, "AuthSessionMissingError");
  assert.equal((await subject.shared.getSession()).data.session?.access_token, current.access_token);
  assert.equal(subject.events.includes("SIGNED_OUT"), false);
  assert.equal(subject.logoutCalls, 0);

  // The isolated read does not itself delete browser storage; authoritative
  // device-status revocation still denies this same session at the boundary.
  subject.mount();
  await subject.advance(1200);
  assert.equal(subject.state, "unauthenticated");
  assert.equal(subject.logoutCalls, 1);
  assert.equal((await subject.shared.getSession()).data.session, null);
});
