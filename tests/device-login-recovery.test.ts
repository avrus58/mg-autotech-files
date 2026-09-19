import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { createContext, runInContext } from "node:vm";
import type { Session, User } from "@supabase/supabase-js";
import ts from "typescript";

type Element = { type: unknown; props: Record<string, unknown> };
type AuthListener = (event: string, session: Session | null) => void;
type Guards = {
  primeStableSession: (session: Session | null) => void;
  getStableSessionSnapshot: () => Session | null;
  isCurrentBrowserSession: (session: Session) => boolean;
};

function compile(path: string) {
  return ts.transpileModule(readFileSync(resolve(process.cwd(), path), "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
}

const compiledLogin = compile("src/app/login/page.tsx");
const compiledGuards = compile("src/lib/authGuards.ts");
const compiledMutations = compile("src/lib/browserAuthMutations.ts");

function fixtureSession(id: string, verified: boolean, revision: string): Session {
  return {
    access_token: `synthetic-${id}-${revision}`,
    user: {
      id,
      ...(verified ? { email_confirmed_at: "2026-09-19T00:00:00Z" } : {}),
    },
  } as Session;
}

function elements(tree: unknown): Element[] {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
  const element = tree as Element;
  return [element, ...elements(element.props.children)];
}

async function settle() {
  for (let index = 0; index < 30; index += 1) await Promise.resolve();
}

// Actual LoginPage TSX, authGuards and browser mutation queue, with an isolated
// browser/SDK and synthetic users. No environment, network or real account data.
function loginHarness(oldSession: Session | null, freshSession: Session, { googleReady = false } = {}) {
  let currentSession: Session | null = oldSession;
  let resolveBootstrap!: (value: { data: { user: User | null }; error: null }) => void;
  const bootstrap = new Promise<{ data: { user: User | null }; error: null }>(resolvePromise => {
    resolveBootstrap = resolvePromise;
  });
  const listeners = new Set<AuthListener>();
  const signOutScopes: Array<string | undefined> = [];
  const redirects: string[] = [];
  const signIn = () => {
    currentSession = freshSession;
    for (const listener of listeners) listener("SIGNED_IN", freshSession);
    return { data: { session: freshSession, user: freshSession.user }, error: null };
  };
  const auth = {
    getUser: () => bootstrap,
    getSession: async () => ({ data: { session: currentSession }, error: null }),
    refreshSession: async () => ({ data: { session: currentSession }, error: null }),
    onAuthStateChange(listener: AuthListener) {
      listeners.add(listener);
      return { data: { subscription: { unsubscribe: () => listeners.delete(listener) } } };
    },
    async signInWithPassword() {
      return signIn();
    },
    async signInWithIdToken() { return signIn(); },
    async signOut(options?: { scope?: string }) {
      signOutScopes.push(options?.scope);
      currentSession = null;
      for (const listener of listeners) listener("SIGNED_OUT", null);
      return { error: null };
    },
  };
  const browser = {
    location: { search: "", origin: "https://example.invalid" },
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
    setTimeout, clearTimeout,
    requestAnimationFrame() { return 1; }, cancelAnimationFrame() {},
  };
  const mutationContext = createContext({ exports: {}, window: browser });
  runInContext(compiledMutations, mutationContext);
  const guardImports: Record<string, unknown> = {
    "@/lib/supabaseClient": { supabase: { auth } },
    "@/lib/browserAuthMutations": mutationContext.exports,
    "@/lib/growth/publicClient": { clearGrowthVisitorId() {} },
    "@/lib/customerDeviceContracts": { CUSTOMER_SESSION_REVOKED_MESSAGE: "synthetic revoked" },
  };
  const guardContext = createContext({
    exports: {}, window: browser, setTimeout, clearTimeout, Headers, Response, Event, AbortSignal, atob,
    require(name: string) {
      assert.ok(name in guardImports, `Unexpected guard dependency: ${name}`);
      return guardImports[name];
    },
    async fetch(input: string) {
      assert.equal(input, "/api/account/context", "Unexpected synthetic request");
      return new Response(JSON.stringify({ home: "/dashboard" }), { status: 200 });
    },
  });
  runInContext(compiledGuards, guardContext);
  const guards = guardContext.exports as Guards;

  let hookIndex = 0;
  const hooks: unknown[] = [];
  const dependencies = new Map<number, unknown[]>();
  const pendingEffects = new Map<number, () => (() => void) | void>();
  const cleanups = new Map<number, () => void>();
  const react = {
    useState(initial: unknown) {
      const index = hookIndex++;
      if (!(index in hooks)) hooks[index] = initial;
      return [hooks[index], (value: unknown) => {
        hooks[index] = typeof value === "function" ? (value as (old: unknown) => unknown)(hooks[index]) : value;
      }];
    },
    useRef(initial: unknown) {
      const index = hookIndex++;
      return hooks[index] ?? (hooks[index] = { current: initial });
    },
    useEffect(effect: () => (() => void) | void, next: unknown[]) {
      const index = hookIndex++;
      const previous = dependencies.get(index);
      dependencies.set(index, next);
      if (!previous || next.some((value, i) => value !== previous[i])) pendingEffects.set(index, effect);
    },
  };
  let router = { replace(path: string) { redirects.push(path); }, refresh() {} };
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const emptyFailures = { failures: 0, windowStartedAt: null };
  const imports: Record<string, unknown> = {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "next/link": "Link",
    "next/navigation": { useRouter: () => router },
    "lucide-react": {},
    "@/lib/authGuards": guardContext.exports,
    "@/lib/supabaseClient": { supabase: { auth } },
    "@/lib/browserAuthMutations": mutationContext.exports,
    "@/lib/authCaptcha": {
      getPublicAuthCaptchaConfig: () => ({ status: "off" }),
      getAuthCaptchaToken: () => undefined,
      authCaptchaBlocksSubmission: () => false,
    },
    "@/lib/authLoginProtection": {
      EMPTY_AUTH_LOGIN_FAILURE_STATE: emptyFailures,
      getBrowserAuthLoginFailureStorage: () => null,
      readAuthLoginFailureState: () => emptyFailures,
      getAuthLoginFailureWindowRemaining: () => null,
      authLoginNeedsVisibleChallenge: () => false,
      clearAuthLoginFailures() {},
    },
    "@/lib/googleIdentity": {
      getPublicGoogleIdentityConfig: () => googleReady
        ? { status: "ready", clientId: "synthetic-google-client" }
        : { status: "off" },
    },
    "@/lib/publicAnalytics": { replacePrivateMeasurementDocument: () => false },
    "@/lib/safeLocalRedirect": { getSafeLocalRedirectPath: () => null, buildAuthEntryPath: (path: string) => path },
    "@/lib/useActiveLocale": { useActiveLocale: () => "en" },
    "@/lib/i18n/customer-runtime-translations": { customerRuntimeExactT: (_locale: string, source: string) => source },
    "@/lib/i18n/customer-workflow-auth-translations": { customerWorkflowExactT: (_locale: string, source: string) => source },
    "@/lib/i18n/auth-page-first-paint": { authPageFirstPaintT: (_locale: string, source: string) => source },
  };
  for (const name of ["TurnstileChallenge", "DeviceVerificationPanel", "GoogleIdentityButton", "AuthBackdrop"]) {
    imports[`@/components/auth/${name}`] = { [name]: name };
  }
  const pageContext = createContext({
    exports: {}, window: browser, URLSearchParams,
    require(name: string) {
      assert.ok(name in imports, `Unexpected login dependency: ${name}`);
      return imports[name];
    },
  });
  runInContext(compiledLogin, pageContext);
  const render = () => {
    hookIndex = 0;
    const tree = (pageContext.exports as { default: () => Element }).default();
    for (const [index, effect] of pendingEffects) {
      cleanups.get(index)?.();
      const cleanup = effect();
      if (cleanup) cleanups.set(index, cleanup);
    }
    pendingEffects.clear();
    return tree;
  };
  return {
    guards, signOutScopes, redirects, render,
    get sdkSession() { return currentSession; },
    completeBootstrap() { resolveBootstrap({ data: { user: oldSession?.user ?? null }, error: null }); },
    restartBootstrap() { router = { ...router }; render(); },
    async login() {
      const form = elements(render()).find(element => element.type === "form");
      assert.ok(form);
      await settle();
      await (form.props.onSubmit as (event: object) => Promise<void>)({ preventDefault() {} });
    },
    async googleLogin() {
      const button = elements(render()).find(element => element.type === "GoogleIdentityButton");
      assert.ok(button);
      await settle();
      (button.props.onCredential as (credential: string, nonce: string) => void)("synthetic-google-credential", "synthetic-nonce");
      await settle();
    },
    startQueuedLogin() {
      let release!: () => void;
      const delay = new Promise<void>(resolvePromise => { release = resolvePromise; });
      const queued = (mutationContext.exports as {
        withBrowserAuthMutation: (operation: () => Promise<void>) => Promise<void>;
      }).withBrowserAuthMutation(async () => {
        await delay;
        await auth.signInWithPassword();
        guards.primeStableSession(freshSession);
      });
      return { release, queued };
    },
    unmount() { for (const cleanup of cleanups.values()) cleanup(); },
  };
}

for (const account of ["same account", "different account"] as const) {
  test(`a delayed old unverified login bootstrap must not sign out a fresh verified ${account} session`, async (t) => {
    const old = fixtureSession("old-user", false, "old");
    const fresh = fixtureSession(account === "same account" ? "old-user" : "new-user", true, "new");
    const harness = loginHarness(old, fresh);
    t.after(() => harness.unmount());
    await harness.login();
    assert.equal(harness.guards.isCurrentBrowserSession(fresh), true);
    assert.ok(elements(harness.render()).some(element => element.type === "DeviceVerificationPanel"));
    harness.completeBootstrap();
    await settle();
    assert.deepEqual(harness.signOutScopes, [], "The obsolete bootstrap must not log out the current browser session");
    assert.equal(harness.guards.isCurrentBrowserSession(fresh), true);
  });
}

test("a delayed verified bootstrap preserves successful password login", async (t) => {
  const old = fixtureSession("old-user", true, "old");
  const fresh = fixtureSession("new-user", true, "new");
  const harness = loginHarness(old, fresh);
  t.after(() => harness.unmount());
  await harness.login();
  harness.completeBootstrap();
  await settle();
  assert.deepEqual(harness.signOutScopes, []);
  assert.equal(harness.guards.isCurrentBrowserSession(fresh), true);
  assert.ok(elements(harness.render()).some(element => element.type === "DeviceVerificationPanel"));
});

test("an old unverified bootstrap queued behind a new login cannot log out its replacement session", async (t) => {
  const old = fixtureSession("old-user", false, "old");
  const fresh = fixtureSession("new-user", true, "new");
  const harness = loginHarness(old, fresh);
  t.after(() => harness.unmount());
  harness.render();
  await settle();
  const login = harness.startQueuedLogin();
  await settle();
  harness.completeBootstrap();
  await settle();
  assert.deepEqual(harness.signOutScopes, [], "The bootstrap must wait behind the queued login");
  login.release();
  await login.queued;
  await settle();
  assert.deepEqual(harness.signOutScopes, [], "Logout must recheck session identity after acquiring the mutation queue");
  assert.equal(harness.guards.isCurrentBrowserSession(fresh), true);
});

test("a genuinely current unverified bootstrap still signs out locally", async (t) => {
  const old = fixtureSession("old-user", false, "old");
  const harness = loginHarness(old, fixtureSession("new-user", true, "new"));
  t.after(() => harness.unmount());
  harness.render();
  await settle();
  harness.completeBootstrap();
  await settle();
  assert.deepEqual(harness.signOutScopes, ["local"]);
  assert.equal(harness.guards.getStableSessionSnapshot(), null);
  assert.equal(elements(harness.render()).some(element => element.type === "DeviceVerificationPanel"), false);
});

test("a delayed old unverified bootstrap cannot replace a successful Google login", async (t) => {
  const old = fixtureSession("old-user", false, "old");
  const fresh = fixtureSession("new-user", true, "new");
  const harness = loginHarness(old, fresh, { googleReady: true });
  t.after(() => harness.unmount());
  await harness.googleLogin();
  assert.equal(harness.guards.isCurrentBrowserSession(fresh), true);
  assert.deepEqual(harness.redirects, ["/auth/callback?next=%2Fdashboard"]);
  harness.completeBootstrap();
  await settle();
  assert.deepEqual(harness.signOutScopes, []);
  assert.equal(harness.guards.isCurrentBrowserSession(fresh), true);
});

test("a genuinely unverified password response remains outside the device panel", async (t) => {
  const old = fixtureSession("old-user", true, "old");
  const fresh = fixtureSession("new-user", false, "new");
  const harness = loginHarness(old, fresh);
  t.after(() => harness.unmount());
  await harness.login();
  harness.completeBootstrap();
  await settle();
  assert.deepEqual(harness.signOutScopes, ["local"]);
  assert.equal(harness.guards.getStableSessionSnapshot(), null);
  assert.equal(elements(harness.render()).some(element => element.type === "DeviceVerificationPanel"), false);
});

test("unmount invalidates a pending unverified bootstrap without signing out", async () => {
  const old = fixtureSession("old-user", false, "old");
  const harness = loginHarness(old, fixtureSession("new-user", true, "new"));
  harness.render();
  await settle();
  harness.unmount();
  harness.completeBootstrap();
  await settle();
  assert.deepEqual(harness.signOutScopes, []);
  assert.equal(harness.sdkSession, old);
});

test("bootstrap effect recreation only lets its current unverified check sign out", async (t) => {
  const old = fixtureSession("old-user", false, "old");
  const harness = loginHarness(old, fixtureSession("new-user", true, "new"));
  t.after(() => harness.unmount());
  harness.render();
  await settle();
  harness.restartBootstrap();
  await settle();
  harness.completeBootstrap();
  await settle();
  assert.deepEqual(harness.signOutScopes, ["local"]);
  assert.equal(harness.guards.getStableSessionSnapshot(), null);
});

test("a fresh browser without a previous session can still complete password login", async (t) => {
  const fresh = fixtureSession("new-user", true, "new");
  const harness = loginHarness(null, fresh);
  t.after(() => harness.unmount());
  await harness.login();
  harness.completeBootstrap();
  await settle();
  assert.deepEqual(harness.signOutScopes, []);
  assert.equal(harness.guards.isCurrentBrowserSession(fresh), true);
  assert.ok(elements(harness.render()).some(element => element.type === "DeviceVerificationPanel"));
});
