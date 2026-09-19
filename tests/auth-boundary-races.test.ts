import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import type { Session } from "@supabase/supabase-js";

type SessionResult = { session: Session | null; error: unknown };
type Assurance = { status: "not_required" | "verified" | "required" | "revoked" };
type AuthListener = (event: string, session: Session | null) => void;

function deferred<T>() {
  let resolvePromise!: (value: T) => void;
  let rejectPromise!: (reason: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

function session(id: string): Session {
  return { access_token: `synthetic-${id}`, user: { id } } as Session;
}

// Execute the actual TSX lifecycle with deterministic hooks, requests and browser
// timers. This is not a DOM/browser E2E test and never accesses a real session.
function boundaryHarness(initialSession: Session | null) {
  let currentSession = initialSession;
  let mounted = true;
  let time = 0;
  let timerId = 0;
  let listener: AuthListener | null = null;
  let cleanup: (() => void) | undefined;
  let effect: (() => (() => void)) | undefined;
  const states: unknown[] = [];
  let stateIndex = 0;
  const commits: string[] = [];
  let updatesAfterUnmount = 0;
  let statusCalls = 0;
  let logoutCalls = 0;
  let beforeConditionalLogout = () => {};
  const refs: Array<{ current: unknown }> = [];
  let refIndex = 0;
  const callbacks: Array<{ callback: () => void; dependencies: readonly unknown[] }> = [];
  let callbackIndex = 0;
  const sessionReads: Promise<SessionResult>[] = [];
  const statusReads: Promise<Assurance>[] = [];
  const timers = new Map<number, { due: number; callback: () => void }>();
  const listeners = new Map<string, () => void>();
  const react = {
    useState(initial: unknown) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (next: unknown) => {
        if (!mounted) updatesAfterUnmount += 1;
        states[index] = typeof next === "function"
          ? (next as (previous: unknown) => unknown)(states[index])
          : next;
        if (index === 0) commits.push(String(states[index]));
      }];
    },
    useRef(value: unknown) {
      const index = refIndex++;
      return refs[index] ?? (refs[index] = { current: value });
    },
    useCallback(callback: () => void, dependencies: readonly unknown[]) {
      const index = callbackIndex++;
      const previous = callbacks[index];
      if (previous && previous.dependencies.length === dependencies.length &&
        dependencies.every((value, dependencyIndex) => Object.is(value, previous.dependencies[dependencyIndex]))) {
        return previous.callback;
      }
      callbacks[index] = { callback, dependencies };
      return callback;
    },
    useEffect(next: () => (() => void)) { effect = next; },
  };
  const browser = {
    setTimeout(callback: () => void, delay: number) {
      const id = ++timerId;
      timers.set(id, { due: time + delay, callback });
      return id;
    },
    clearTimeout(id: number) { timers.delete(id); },
    addEventListener(name: string, callback: () => void) { listeners.set(name, callback); },
    removeEventListener(name: string, callback: () => void) {
      if (listeners.get(name) === callback) listeners.delete(name);
    },
  };
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const imports: Record<string, unknown> = {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "lucide-react": { Loader2: "loader", RefreshCcw: "retry" },
    "next/navigation": { usePathname: () => "/admin" },
    "@/lib/supabaseClient": {
      supabase: { auth: { onAuthStateChange(callback: AuthListener) {
        listener = callback;
        return { data: { subscription: { unsubscribe() { listener = null; } } } };
      } } },
    },
    "@/components/auth/AuthRequired": { AuthRequired: "login" },
    "@/components/auth/DeviceVerificationPanel": { DeviceVerificationPanel: "verification" },
    "@/lib/deviceVerificationClient": {
      getDeviceVerificationStatus() {
        statusCalls += 1;
        return statusReads.shift() ?? Promise.resolve({ status: "not_required" });
      },
    },
    "@/lib/authGuards": {
      AUTH_SESSION_REQUIRED_EVENT: "session-required",
      AUTH_DEVICE_VERIFICATION_REQUIRED_EVENT: "device-required",
      getStableSession() {
        return sessionReads.shift() ?? Promise.resolve({ session: currentSession, error: null });
      },
      isCurrentBrowserSession(expected: Session) {
        return currentSession?.access_token === expected.access_token;
      },
      async signOutLocalIfSessionMatches(expected: Session) {
        logoutCalls += 1;
        beforeConditionalLogout();
        if (currentSession?.access_token !== expected.access_token) return false;
        currentSession = null;
        return true;
      },
    },
    "@/lib/i18n/customer-portal-first-paint": {
      customerPortalFirstPaintT: (_locale: string, source: string) => source,
    },
    "@/lib/useActiveLocale": { useActiveLocale: () => "en" },
  };
  const source = readFileSync(resolve(process.cwd(), "src/components/auth/BrowserAuthBoundary.tsx"), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports: { BrowserAuthBoundary?: (props: object) => unknown } = {};
  runInNewContext(compiled, {
    exports,
    window: browser,
    require(name: string) {
      assert.ok(name in imports, `Unexpected dependency: ${name}`);
      return imports[name];
    },
  });
  assert.ok(exports.BrowserAuthBoundary);
  const render = () => {
    stateIndex = 0;
    refIndex = 0;
    callbackIndex = 0;
    return exports.BrowserAuthBoundary!({ children: "private", title: "Login", description: "Private" });
  };
  render();
  assert.ok(effect);

  return {
    sessionReads,
    statusReads,
    commits,
    mount() { cleanup = effect!(); },
    render,
    restartEffect() { cleanup?.(); render(); cleanup = effect!(); },
    unmount() { cleanup?.(); mounted = false; },
    onConditionalLogout(callback: () => void) { beforeConditionalLogout = callback; },
    authEvent(event: string, next: Session | null) { currentSession = next; listener?.(event, next); },
    setCurrent(next: Session | null) { currentSession = next; },
    event(name: "session-required" | "device-required") { listeners.get(name)?.(); },
    advance(milliseconds: number) {
      const until = time + milliseconds;
      for (let remaining = 100; remaining > 0; remaining -= 1) {
        const next = [...timers.entries()].filter(([, task]) => task.due <= until)
          .sort((a, b) => a[1].due - b[1].due)[0];
        if (!next) break;
        timers.delete(next[0]);
        time = next[1].due;
        next[1].callback();
      }
      time = until;
    },
    get state() { return states[0]; },
    get retryKey() { return states[1]; },
    get statusCalls() { return statusCalls; },
    get logoutCalls() { return logoutCalls; },
    get updatesAfterUnmount() { return updatesAfterUnmount; },
    get pendingTimers() { return timers.size; },
  };
}

async function settle() {
  for (let index = 0; index < 12; index += 1) await Promise.resolve();
}

test("a late empty bootstrap cannot replace a newer sign-in, even before its deferred check", async () => {
  const harness = boundaryHarness(null);
  const oldRead = deferred<SessionResult>();
  harness.sessionReads.push(oldRead.promise);
  harness.mount();
  harness.authEvent("SIGNED_IN", session("new"));
  oldRead.resolve({ session: null, error: null });
  await settle();
  assert.equal(harness.state, "checking");
  assert.equal(harness.commits.includes("unauthenticated"), false);
  harness.advance(0);
  await settle();
  assert.equal(harness.state, "authenticated");
  harness.unmount();
});

test("overlapping revoked and required responses cannot overwrite the newer verified login", async () => {
  for (const status of ["revoked", "required"] as const) {
    const harness = boundaryHarness(session("old"));
    const oldStatus = deferred<Assurance>();
    harness.statusReads.push(oldStatus.promise);
    harness.mount();
    await settle();
    harness.authEvent("SIGNED_IN", session("new"));
    harness.advance(0);
    await settle();
    assert.equal(harness.state, "authenticated");
    oldStatus.resolve({ status });
    await settle();
    assert.equal(harness.state, "authenticated");
    assert.equal(harness.logoutCalls, 0);
    harness.advance(30000);
    assert.equal(harness.state, "authenticated");
    harness.unmount();
  }
});

test("a changed browser session also rejects stale assurance without relying on an auth event", async () => {
  const harness = boundaryHarness(session("old"));
  const oldStatus = deferred<Assurance>();
  harness.statusReads.push(oldStatus.promise);
  harness.mount();
  await settle();
  harness.setCurrent(session("new"));
  oldStatus.resolve({ status: "revoked" });
  await settle();
  assert.equal(harness.logoutCalls, 0);
  harness.advance(350);
  await settle();
  assert.equal(harness.state, "authenticated");
  harness.unmount();
});

test("a refused conditional logout never commits unauthenticated over the replacement session", async () => {
  const harness = boundaryHarness(session("old"));
  harness.statusReads.push(Promise.resolve({ status: "revoked" }));
  harness.onConditionalLogout(() => harness.setCurrent(session("new")));
  harness.mount();
  await settle();
  assert.equal(harness.logoutCalls, 1);
  assert.equal(harness.commits.includes("unauthenticated"), false);
  harness.advance(350);
  await settle();
  assert.equal(harness.state, "authenticated");
  harness.unmount();
});

test("verification completion rechecks current authority instead of directly unlocking private content", async () => {
  const harness = boundaryHarness(session("current"));
  harness.statusReads.push(Promise.resolve({ status: "required" }));
  harness.mount();
  await settle();
  type Element = { type: unknown; props: { children?: Element; onVerified?: () => void } };
  const view = harness.render() as Element;
  const panel = view.props.children!.props.children!;
  assert.equal(panel.type, "verification");
  panel.props.onVerified!();
  assert.equal(harness.state, "verification_required");
  harness.setCurrent(null);
  harness.restartEffect();
  await settle();
  assert.equal(harness.state, "unauthenticated");
  assert.equal(harness.commits.includes("authenticated"), false);
  harness.unmount();
});

test("verification callback identity stays stable through retry renders while authority is rechecked", async () => {
  const harness = boundaryHarness(session("current"));
  harness.statusReads.push(Promise.resolve({ status: "required" }));
  harness.mount();
  await settle();
  type Element = { props: { children?: Element; onVerified?: () => void } };
  const verificationCallback = () => {
    const view = harness.render() as Element;
    return view.props.children!.props.children!.props.onVerified!;
  };
  const callback = verificationCallback();
  callback();
  assert.equal(harness.retryKey, 1);
  assert.equal(verificationCallback(), callback);

  const pendingRecheck = deferred<Assurance>();
  harness.statusReads.push(pendingRecheck.promise);
  harness.restartEffect();
  await settle();
  assert.equal(harness.state, "verification_required");
  assert.equal(verificationCallback(), callback);
  callback();
  assert.equal(harness.retryKey, 2, "stable callback must still use the latest retry value");
  assert.equal(verificationCallback(), callback);
  pendingRecheck.resolve({ status: "verified" });
  await settle();
  assert.equal(harness.state, "authenticated");
  harness.unmount();
});

test("late session-required and device-required events recheck rather than force logout", async () => {
  const harness = boundaryHarness(session("current"));
  harness.mount();
  await settle();
  for (const event of ["session-required", "device-required"] as const) {
    harness.event(event);
    assert.equal(harness.state, "authenticated");
    harness.advance(0);
    await settle();
    assert.equal(harness.state, "authenticated");
  }
  assert.equal(harness.logoutCalls, 0);
  assert.equal(harness.statusCalls, 3);
  harness.unmount();
});

test("real sign-out, required verification and current-session revocation remain fail-closed", async () => {
  const signedOut = boundaryHarness(null);
  signedOut.mount();
  await settle();
  assert.equal(signedOut.state, "unauthenticated");
  signedOut.unmount();

  for (const status of ["required", "revoked"] as const) {
    const harness = boundaryHarness(session("current"));
    harness.statusReads.push(Promise.resolve({ status }));
    harness.mount();
    await settle();
    assert.equal(harness.state, status === "required" ? "verification_required" : "unauthenticated");
    assert.equal(harness.logoutCalls, status === "revoked" ? 1 : 0);
    harness.unmount();
  }
});

test("unmount cancels deferred auth checks and ignores late revocation without sign-out", async () => {
  const harness = boundaryHarness(session("old"));
  const oldStatus = deferred<Assurance>();
  harness.statusReads.push(oldStatus.promise);
  harness.mount();
  await settle();
  harness.authEvent("SIGNED_IN", session("new"));
  harness.unmount();
  oldStatus.resolve({ status: "revoked" });
  harness.advance(30000);
  await settle();
  assert.equal(harness.logoutCalls, 0);
  assert.equal(harness.statusCalls, 1);
  assert.equal(harness.updatesAfterUnmount, 0);
  assert.equal(harness.pendingTimers, 0);
});

test("a failed obsolete request cannot schedule retries over an authenticated result", async () => {
  const harness = boundaryHarness(session("old"));
  const oldStatus = deferred<Assurance>();
  harness.statusReads.push(oldStatus.promise);
  harness.mount();
  await settle();
  harness.authEvent("SIGNED_IN", session("new"));
  harness.advance(0);
  await settle();
  oldStatus.reject(new Error("synthetic network failure"));
  await settle();
  assert.equal(harness.state, "authenticated");
  assert.equal(harness.pendingTimers, 0);
  harness.unmount();
});

test("current verification errors stay protected and recover using a bounded retry", async () => {
  const harness = boundaryHarness(session("current"));
  const status = deferred<Assurance>();
  harness.statusReads.push(status.promise);
  harness.mount();
  await settle();
  status.reject(new Error("synthetic provider failure"));
  await settle();
  assert.equal(harness.state, "checking");
  harness.advance(350);
  await settle();
  assert.equal(harness.state, "authenticated");
  assert.equal(harness.logoutCalls, 0);
  harness.unmount();
});
