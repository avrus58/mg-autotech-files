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
function panelHarness({ emitInitialSession = false } = {}) {
  let currentSession: Session | null = session("original");
  let locale = "en";
  let mounted = true;
  let updatesAfterUnmount = 0;
  let hookIndex = 0;
  let timerId = 0;
  let verified = 0;
  let conditionalLogouts = 0;
  let explicitLogouts = 0;
  let beforeLogout = () => {};
  let reportedFailures = 0;
  let authListener: ((event: string, next: Session | null) => void) | null = null;
  const hooks: unknown[] = [];
  const dependencies = new Map<number, unknown[]>();
  const effects = new Map<number, () => (() => void) | void>();
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
      effects.set(index, effect);
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
        // The installed Auth SDK asynchronously emits INITIAL_SESSION for each
        // subscription, including one recreated by a component effect.
        if (emitInitialSession) {
          void Promise.resolve().then(() => {
            if (authListener === callback) callback("INITIAL_SESSION", currentSession);
          });
        }
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
    "@/lib/i18nConfig": { intlLocaleByCode: { en: "en-GB", de: "de-DE" } },
    "@/lib/useActiveLocale": { useActiveLocale: () => locale },
    "@/components/PlatformReliabilityMonitor": { reportPlatformFailure() { reportedFailures += 1; } },
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
  let onVerified = () => { verified += 1; };
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
    const button = elements(render()).find(element => element.type === "button" && (
      element.props.children === label ||
      (Array.isArray(element.props.children) && element.props.children.includes(label))
    ));
    assert.ok(button, `Missing button: ${label}`);
    return (button.props.onClick as () => void)();
  };
  return {
    requests, calls, redirects, render,
    mount() { render(); },
    replayEffects() {
      for (const cleanup of cleanups.values()) cleanup();
      cleanups.clear();
      for (const [index, effect] of effects) {
        const cleanup = effect();
        if (cleanup) cleanups.set(index, cleanup);
      }
    },
    advance() { const pending = [...timers.values()]; timers.clear(); pending.forEach(callback => callback()); },
    unmount() { for (const cleanup of cleanups.values()) cleanup(); cleanups.clear(); mounted = false; },
    setCurrent(next: Session | null) { currentSession = next; },
    setLocale(next: string) { locale = next; },
    replaceOnVerified() { onVerified = () => { verified += 1; }; },
    authEvent(event: string, next: Session | null) { currentSession = next; authListener?.(event, next); },
    initialEventWithoutDiscardingStableSession() { authListener?.("INITIAL_SESSION", null); },
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
    get reportedFailures() { return reportedFailures; },
  };
}

async function settle() { for (let index = 0; index < 12; index += 1) await Promise.resolve(); }

test("an empty INITIAL_SESSION cannot cancel a newly primed login's device check", async (t) => {
  const harness = panelHarness();
  t.after(() => harness.unmount());
  harness.requests.start.push(Promise.resolve(assurance("not_required")));
  harness.mount();
  // authGuards retains a primed login when the SDK emits an empty initial
  // snapshot. The panel must consult that same stable session, not get stuck.
  harness.initialEventWithoutDiscardingStableSession();
  harness.advance();
  await settle();
  assert.deepEqual(harness.calls, ["start"]);
  assert.equal(harness.verified, 1);
  assert.equal(harness.conditionalLogouts, 0);
});

test("a genuinely absent INITIAL_SESSION never bypasses the device check", async (t) => {
  const harness = panelHarness();
  t.after(() => harness.unmount());
  harness.setCurrent(null);
  harness.mount();
  harness.initialEventWithoutDiscardingStableSession();
  harness.advance();
  await settle();
  assert.deepEqual(harness.calls, []);
  assert.equal(harness.verified, 0);
});

test("a failed security start is retryable without claiming an e-mail was sent or failed", async (t) => {
  const harness = panelHarness();
  t.after(() => harness.unmount());
  harness.requests.start.push(Promise.reject(new Error("Synthetic network failure")));
  harness.mount();
  harness.advance();
  await settle();
  const tree = elements(harness.render());
  assert.equal(tree.find(element => element.type === "h2")?.props.children, "Account verification");
  const message = tree.find(element => element.props["aria-live"] === "polite");
  assert.ok(message);
  assert.ok(JSON.stringify(message.props.children).includes("The security request could not be completed. Please try again."));
  assert.equal(JSON.stringify(tree).includes("The verification e-mail could not be sent."), false);
  assert.equal(harness.reportedFailures, 1);
  harness.click("Try again");
  await settle();
  assert.ok(elements(harness.render()).some(element => element.type === "form"));
  assert.equal(elements(harness.render()).find(element => element.type === "h2")?.props.children, "Check your e-mail");
});

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

test("same-session initial event, token refresh and focus sign-in preserve the challenge without restarting", async () => {
  const { harness, pending } = await pendingOperation("start");
  for (const event of ["INITIAL_SESSION", "TOKEN_REFRESHED", "SIGNED_IN"]) {
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

test("SDK INITIAL_SESSION allows the first verification to start and complete", async () => {
  const harness = panelHarness({ emitInitialSession: true });
  harness.mount();
  await settle();
  harness.advance();
  await settle();
  assert.deepEqual(harness.calls, ["start"]);
  assert.ok(elements(harness.render()).some(element => element.type === "form"));
  harness.requests.verify.push(Promise.resolve(assurance("verified")));
  void harness.invoke("verify");
  await settle();
  assert.equal(harness.verified, 1);
  harness.unmount();
});

test("start not_required completes normally without a verification e-mail error", async (t) => {
  const { harness, pending } = await pendingOperation("start");
  t.after(() => harness.unmount());
  pending.resolve(assurance("not_required"));
  await settle();
  assert.equal(harness.verified, 1);
  assert.equal(harness.conditionalLogouts, 0);
  assert.deepEqual(harness.redirects, []);
  assert.equal(elements(harness.render()).some(element => element.props["aria-live"] === "polite"), false,
    "A session that does not require verification must not receive a fake e-mail error");
});

for (const change of ["locale", "onVerified"] as const) {
  for (const outcome of ["required", "not_required", "error"] as const) {
    test(`pending start ${outcome}: ${change} rerender plus SDK INITIAL_SESSION cannot strand the panel`, async (t) => {
      const harness = panelHarness({ emitInitialSession: true });
      t.after(() => harness.unmount());
      const pending = deferred<DeviceVerificationState>();
      harness.requests.start.push(pending.promise, pending.promise);
      harness.mount();
      await settle();
      harness.advance();
      await settle();
      assert.deepEqual(harness.calls, ["start"]);

      // A locale initialization/change or a newly allocated parent callback
      // changes begin's identity. Recreated SDK subscriptions emit before the
      // component's deferred startup timer, while the first request is pending.
      if (change === "locale") harness.setLocale("de");
      else harness.replaceOnVerified();
      harness.render();
      await settle();
      harness.advance();
      await settle();
      assert.deepEqual(harness.calls, ["start", "start"], "The invalidated attempt must have a current replacement");

      if (outcome === "error") pending.reject(new Error("synthetic delivery failure"));
      else pending.resolve(assurance(outcome));
      await settle();
      harness.advance();
      await settle();

      const tree = elements(harness.render());
      if (outcome === "not_required") {
        assert.equal(harness.verified, 1, "The current attempt must complete without demanding an e-mail code");
        assert.equal(tree.some(element => element.props["aria-live"] === "polite"), false,
          "An exempt session must not receive a fake e-mail error after effect recreation");
        assert.equal(harness.conditionalLogouts, 0);
        assert.deepEqual(harness.redirects, []);
        return;
      }
      if (outcome === "error") {
        const retry = tree.find(element => element.type === "button" &&
          Array.isArray(element.props.children) && element.props.children.includes("Try again"));
        assert.ok(retry, "A failed start must retain its retry action");
        assert.equal(retry.props.disabled, false, "A settled failed start must not leave Try again disabled");
        harness.click("Try again");
        await settle();
      }
      assert.ok(elements(harness.render()).some(element => element.type === "form"),
        "A settled or retried start must expose the actionable security-code form");
      harness.requests.verify.push(Promise.resolve(assurance("verified")));
      void harness.invoke("verify");
      await settle();
      assert.equal(harness.verified, 1, "The code form must not retain an orphaned working state");
      assert.equal(harness.conditionalLogouts, 0);
      assert.deepEqual(harness.redirects, []);
    });
  }
}

for (const timing of ["before startup", "during startup"] as const) {
  test(`StrictMode effect replay ${timing} leaves one current verification attempt`, async (t) => {
    const harness = panelHarness({ emitInitialSession: true });
    t.after(() => harness.unmount());
    const pending = deferred<DeviceVerificationState>();
    harness.requests.start.push(pending.promise, pending.promise);
    harness.mount();
    await settle();
    if (timing === "during startup") {
      harness.advance();
      await settle();
      assert.deepEqual(harness.calls, ["start"]);
    }
    harness.replayEffects();
    await settle();
    harness.advance();
    await settle();
    const expectedStarts = timing === "during startup" ? 2 : 1;
    assert.equal(harness.calls.length, expectedStarts);

    for (const event of ["INITIAL_SESSION", "TOKEN_REFRESHED", "SIGNED_IN"]) {
      harness.authEvent(event, session("original", event));
      harness.advance();
      await settle();
    }
    assert.equal(harness.calls.length, expectedStarts, "Same-session events must not restart current work");
    pending.resolve(assurance("required"));
    await settle();
    assert.ok(elements(harness.render()).some(element => element.type === "form"));
    harness.requests.verify.push(Promise.resolve(assurance("verified")));
    void harness.invoke("verify");
    await settle();
    assert.equal(harness.verified, 1);
    assert.equal(harness.conditionalLogouts, 0);
    assert.deepEqual(harness.redirects, []);
  });
}

test("a retired startup cannot revoke the current attempt after effect replacement", async (t) => {
  const harness = panelHarness({ emitInitialSession: true });
  t.after(() => harness.unmount());
  const retired = deferred<DeviceVerificationState>();
  const current = deferred<DeviceVerificationState>();
  harness.requests.start.push(retired.promise, current.promise);
  harness.mount();
  await settle();
  harness.advance();
  await settle();
  harness.setLocale("de");
  harness.render();
  await settle();
  harness.advance();
  await settle();
  assert.deepEqual(harness.calls, ["start", "start"]);
  retired.resolve(assurance("revoked"));
  await settle();
  assert.equal(harness.conditionalLogouts, 0);
  assert.deepEqual(harness.redirects, []);
  current.resolve(assurance("required"));
  await settle();
  assert.ok(elements(harness.render()).some(element => element.type === "form"));
  harness.requests.verify.push(Promise.resolve(assurance("verified")));
  void harness.invoke("verify");
  await settle();
  assert.equal(harness.verified, 1);
});
