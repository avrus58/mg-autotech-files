import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import type { Session } from "@supabase/supabase-js";
import type { DeviceVerificationState } from "../src/lib/deviceVerificationClient";

type Operation = "start" | "verify" | "resend";
type Element = { type: unknown; props: Record<string, unknown> };
const session = (id: string, revision = "initial") => ({ access_token: `synthetic-${id}.${revision}`, user: { id } }) as Session;
const identity = (value: Session | null) => value?.access_token.split(".")[0];
const assurance = (status: DeviceVerificationState["status"]): DeviceVerificationState => ({
  status, maskedEmail: "test@example.invalid", challengeId: "synthetic-challenge", retryAfterSeconds: 0,
});

function deferred<T>() {
  let resolvePromise!: (value: T) => void;
  let rejectPromise!: (reason: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

function elements(tree: unknown): Element[] {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
  const element = tree as Element;
  return [element, ...elements(element.props.children)];
}

// Actual TSX, synthetic sessions, deterministic hooks and promises. No browser,
// Supabase project, real verification code or network service is used.
function panelHarness() {
  let currentSession: Session | null = session("original");
  let mounted = true;
  let updatesAfterUnmount = 0;
  let hookIndex = 0;
  let timerId = 0;
  let verified = 0;
  let conditionalLogouts = 0;
  let explicitLogouts = 0;
  let beforeLogout = () => {};
  let authListener: ((event: string, next: Session | null) => void) | null = null;
  const hooks: unknown[] = [];
  const dependencies = new Map<number, unknown[]>();
  const cleanups = new Map<number, () => void>();
  const pendingEffects = new Map<number, () => (() => void) | void>();
  const timers = new Map<number, () => void>();
  const redirects: string[] = [];
  const calls: Operation[] = [];
  const requests: Record<Operation, Promise<DeviceVerificationState>[]> = { start: [], verify: [], resend: [] };
  const changed = (index: number, next: unknown[]) => {
    const previous = dependencies.get(index);
    dependencies.set(index, next);
    return !previous || previous.length !== next.length || next.some((value, i) => value !== previous[i]);
  };
  const react = {
    useState(initial: unknown) {
      const index = hookIndex++;
      if (!(index in hooks)) hooks[index] = initial;
      return [hooks[index], (value: unknown) => {
        if (!mounted) updatesAfterUnmount += 1;
        hooks[index] = typeof value === "function" ? (value as (old: unknown) => unknown)(hooks[index]) : value;
      }];
    },
    useRef(initial: unknown) {
      const index = hookIndex++;
      return hooks[index] ?? (hooks[index] = { current: initial });
    },
    useCallback(callback: unknown, deps: unknown[]) {
      const index = hookIndex++;
      if (changed(index, deps)) hooks[index] = callback;
      return hooks[index];
    },
    useEffect(effect: () => (() => void) | void, deps: unknown[]) {
      const index = hookIndex++;
      if (changed(index, deps)) pendingEffects.set(index, effect);
    },
  };
  const router = { replace(path: string) { redirects.push(path); }, refresh() {} };
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const request = (operation: Operation) => {
    calls.push(operation);
    return requests[operation].shift() ?? Promise.resolve(assurance("required"));
  };
  const imports: Record<string, unknown> = {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "next/navigation": { useRouter: () => router },
    "lucide-react": Object.fromEntries(["KeyRound", "Loader2", "MailCheck", "RefreshCcw", "ShieldCheck"].map(name => [name, name])),
    "@/lib/deviceVerificationClient": {
      startDeviceVerification: () => request("start"),
      verifyDeviceCode: () => request("verify"),
      resendDeviceCode: () => request("resend"),
    },
    "@/lib/supabaseClient": {
      supabase: { auth: { onAuthStateChange(callback: (event: string, next: Session | null) => void) {
        authListener = callback;
        return { data: { subscription: { unsubscribe() { authListener = null; } } } };
      } } },
    },
    "@/lib/authGuards": {
      getStableSession: async () => ({ session: currentSession, error: null }),
      getStableSessionSnapshot: () => currentSession,
      isCurrentBrowserSession: (expected: Session) => identity(currentSession) === identity(expected),
      async signOutLocalIfSessionMatches(expected: Session) {
        conditionalLogouts += 1;
        beforeLogout();
        if (identity(currentSession) !== identity(expected)) return false;
        currentSession = null;
        return true;
      },
      async signOutLocalStable() { explicitLogouts += 1; currentSession = null; },
    },
    "@/lib/safeLocalRedirect": { getSafeLocalRedirectPath: (path: string) => path },
    "@/lib/publicAnalytics": { replacePrivateMeasurementDocument: () => false },
    "@/lib/i18n/customer-workflow-auth-translations": {
      customerWorkflowExactT: (_locale: string, source: string) => source,
      customerWorkflowT: (_locale: string, key: string) => key,
    },
    "@/lib/i18nConfig": { intlLocaleByCode: { en: "en-GB" } },
    "@/lib/useActiveLocale": { useActiveLocale: () => "en" },
  };
  const source = readFileSync(resolve(process.cwd(), "src/components/auth/DeviceVerificationPanel.tsx"), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports: { DeviceVerificationPanel?: (props: object) => Element } = {};
  runInNewContext(compiled, {
    exports,
    window: {
      setTimeout(callback: () => void) { const id = ++timerId; timers.set(id, callback); return id; },
      clearTimeout(id: number) { timers.delete(id); },
      setInterval() { return ++timerId; }, clearInterval() {},
    },
    require(name: string) { assert.ok(name in imports, `Unexpected dependency: ${name}`); return imports[name]; },
  });
  const onVerified = () => { verified += 1; };
  const render = () => {
    hookIndex = 0;
    const tree = exports.DeviceVerificationPanel!({ onVerified });
    for (const [index, effect] of pendingEffects) {
      cleanups.get(index)?.();
      const cleanup = effect();
      if (cleanup) cleanups.set(index, cleanup); else cleanups.delete(index);
    }
    pendingEffects.clear();
    return tree;
  };
  const click = (label: string) => {
    const button = elements(render()).find(element => element.type === "button" && element.props.children === label);
    assert.ok(button, `Missing button: ${label}`);
    return (button.props.onClick as () => void)();
  };
  return {
    requests, calls, redirects, render,
    mount() { render(); },
    advance() { const pending = [...timers.values()]; timers.clear(); pending.forEach(callback => callback()); },
    unmount() { for (const cleanup of cleanups.values()) cleanup(); cleanups.clear(); mounted = false; },
    setCurrent(next: Session | null) { currentSession = next; },
    authEvent(event: string, next: Session | null) { currentSession = next; authListener?.(event, next); },
    onConditionalLogout(callback: () => void) { beforeLogout = callback; },
    click,
    invoke(operation: Operation) {
      if (operation === "start") return click("Try again");
      if (operation === "resend") {
        const button = elements(render()).find(element => element.type === "button" && Array.isArray(element.props.children) && element.props.children.includes("Resend code"));
        assert.ok(button);
        return (button.props.onClick as () => void)();
      }
      const input = elements(render()).find(element => element.type === "input" && element.props.inputMode === "numeric");
      assert.ok(input);
      (input.props.onChange as (event: object) => void)({ target: { value: "123456" } });
      const form = elements(render()).find(element => element.type === "form");
      assert.ok(form);
      return (form.props.onSubmit as (event: object) => Promise<void>)({ preventDefault() {} });
    },
    get verified() { return verified; },
    get conditionalLogouts() { return conditionalLogouts; },
    get explicitLogouts() { return explicitLogouts; },
    get updatesAfterUnmount() { return updatesAfterUnmount; },
  };
}

async function settle() { for (let index = 0; index < 12; index += 1) await Promise.resolve(); }

async function pendingOperation(operation: Operation) {
  const harness = panelHarness();
  const pending = deferred<DeviceVerificationState>();
  harness.requests[operation].push(pending.promise);
  harness.mount();
  harness.advance();
  await settle();
  if (operation !== "start") { void harness.invoke(operation); await settle(); }
  assert.ok(harness.calls.includes(operation));
  return { harness, pending };
}

for (const operation of ["start", "verify", "resend"] as const) {
  test(`${operation}: a late revocation cannot log out a replacement session`, async () => {
    const { harness, pending } = await pendingOperation(operation);
    harness.setCurrent(session("replacement"));
    pending.resolve(assurance("revoked"));
    await settle();
    assert.equal(harness.conditionalLogouts, 0);
    assert.equal(harness.explicitLogouts, 0);
    assert.deepEqual(harness.redirects, []);
    assert.equal(harness.verified, 0);
    harness.unmount();
  });

  test(`${operation}: unmount ignores late success, revocation and errors`, async () => {
    for (const outcome of ["verified", "revoked", "error"] as const) {
      const { harness, pending } = await pendingOperation(operation);
      harness.unmount();
      if (outcome === "error") pending.reject(new Error("synthetic network failure"));
      else pending.resolve(assurance(outcome));
      await settle();
      harness.advance();
      assert.equal(harness.conditionalLogouts, 0);
      assert.equal(harness.verified, 0);
      assert.equal(harness.updatesAfterUnmount, 0);
      assert.deepEqual(harness.redirects, []);
    }
  });

  test(`${operation}: a genuinely revoked current session still signs out locally`, async () => {
    const { harness, pending } = await pendingOperation(operation);
    pending.resolve(assurance("revoked"));
    await settle();
    assert.equal(harness.conditionalLogouts, 1);
    assert.equal(harness.explicitLogouts, 0);
    assert.deepEqual(harness.redirects, ["/login"]);
    assert.equal(harness.verified, 0);
    harness.unmount();
  });
}

test("a replacement between revocation check and conditional logout prevents login redirection", async () => {
  const { harness, pending } = await pendingOperation("start");
  harness.onConditionalLogout(() => harness.setCurrent(session("replacement")));
  pending.resolve(assurance("revoked"));
  await settle();
  assert.equal(harness.conditionalLogouts, 1);
  assert.deepEqual(harness.redirects, []);
  harness.unmount();
});

test("current successful start and code verification still complete the panel", async () => {
  for (const operation of ["start", "verify"] as const) {
    const { harness, pending } = await pendingOperation(operation);
    pending.resolve(assurance("verified"));
    await settle();
    assert.equal(harness.verified, 1);
    assert.equal(harness.conditionalLogouts, 0);
    harness.unmount();
  }
});

test("choosing a different account invalidates a pending success before local sign-out", async () => {
  const { harness, pending } = await pendingOperation("start");
  harness.click("Use a different account");
  await settle();
  pending.resolve(assurance("verified"));
  await settle();
  assert.equal(harness.explicitLogouts, 1);
  assert.equal(harness.verified, 0);
  assert.deepEqual(harness.redirects, ["/login"]);
  harness.unmount();
});

for (const operation of ["start", "verify", "resend"] as const) {
  test(`${operation}: a replacement login restarts verification and can complete in the mounted panel`, async () => {
    const { harness, pending } = await pendingOperation(operation);
    harness.requests.start.push(Promise.resolve({ ...assurance("required"), challengeId: "replacement-challenge" }));
    harness.authEvent("SIGNED_IN", session("replacement"));
    harness.advance();
    await settle();
    pending.resolve(assurance("revoked"));
    await settle();
    assert.equal(harness.conditionalLogouts, 0);
    assert.equal(harness.calls.filter(call => call === "start").length, 2);
    const form = elements(harness.render()).find(element => element.type === "form");
    assert.ok(form, "Replacement login must have an actionable code form");
    harness.requests.verify.push(Promise.resolve(assurance("verified")));
    void harness.invoke("verify");
    await settle();
    assert.equal(harness.verified, 1);
    assert.deepEqual(harness.redirects, []);
    harness.unmount();
  });
}

test("same-session token refresh and focus sign-in preserve the challenge without restarting", async () => {
  const { harness, pending } = await pendingOperation("start");
  for (const event of ["TOKEN_REFRESHED", "SIGNED_IN"]) {
    harness.authEvent(event, session("original", event));
    harness.advance();
    await settle();
  }
  pending.resolve(assurance("required"));
  await settle();
  assert.deepEqual(harness.calls, ["start"]);
  harness.requests.verify.push(Promise.resolve(assurance("verified")));
  void harness.invoke("verify");
  await settle();
  assert.equal(harness.verified, 1);
  harness.unmount();
});

test("unmount cancels a queued replacement-session verification restart", async () => {
  const { harness, pending } = await pendingOperation("start");
  harness.authEvent("SIGNED_IN", session("replacement"));
  harness.unmount();
  harness.advance();
  pending.resolve(assurance("revoked"));
  await settle();
  assert.deepEqual(harness.calls, ["start"]);
  assert.equal(harness.updatesAfterUnmount, 0);
  assert.equal(harness.conditionalLogouts, 0);
});
