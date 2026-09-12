import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { jsx, jsxs } from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import ts from "typescript";
import { supportedLocales } from "../src/lib/i18nConfig";
import { customerWorkflowExactT } from "../src/lib/i18n/customer-workflow-request-translations";

// Execute the real submission handler with isolated transport/storage doubles.
// No Supabase client, customer data, email or measurement endpoint is imported.
const source = readFileSync("src/app/new-request/page.tsx", "utf8");
const ast = ts.createSourceFile("page.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const page = ast.statements.find((node): node is ts.FunctionDeclaration =>
  ts.isFunctionDeclaration(node) && node.name?.text === "NewRequestPage");
assert.ok(page?.body);
const creditCheck = page.body.statements.find((node): node is ts.FunctionDeclaration =>
  ts.isFunctionDeclaration(node) && node.name?.text === "validateCreditAccess");
const submission = page.body.statements.flatMap((node) =>
  ts.isVariableStatement(node) ? [...node.declarationList.declarations] : []
).find((node) => node.name.getText(ast) === "handleSubmit");
assert.ok(creditCheck && submission?.initializer);
const compiled = ts.transpileModule(
  `${creditCheck.getText(ast)}\nglobalThis.handleSubmit = ${submission.initializer.getText(ast)};`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
).outputText;

const prepareError = "Secure upload could not be prepared.";
const syntheticKey = "22222222-2222-4222-8222-222222222222";
const syntheticOrderId = "33333333-3333-4333-8333-333333333333";
type Prepare = () => Promise<Response>;
type Submission = { idempotencyKey: string; fingerprint: string; filePath: string; signature: string };
type HarnessOptions = {
  email?: (init: RequestInit) => Promise<Response>;
  duplicate?: boolean;
  creation?: { data: { order_id?: string; duplicate?: boolean } | null; error: { message: string } | null };
};

function harness(prepare: Prepare, credits = 0, options: HarnessOptions = {}) {
  const user = { id: "11111111-1111-4111-8111-111111111111", email: "synthetic@example.invalid" };
  const profile = { ...user, credit_balance: 0, allow_negative_credits: false, negative_credit_limit: 0, account_status: "active" };
  const file = { name: "synthetic.bin", size: 4, type: "application/octet-stream", lastModified: 0, arrayBuffer: async () => new ArrayBuffer(4) };
  const ref: { current: Submission | null } = { current: null };
  const state = {
    submitting: false, awaitingConsent: false, message: "", creditFailure: null as unknown,
    prepares: [] as Record<string, unknown>[], uploads: [] as unknown[], orders: [] as Record<string, unknown>[],
    persisted: [] as string[], cleared: 0, emailCalls: 0, measurementCalls: 0, destinations: [] as string[], uuidCalls: 0,
    emailRequests: [] as RequestInit[], measurementSeeds: [] as string[], timerDelays: [] as number[],
    profileBalances: [] as number[],
  };
  const timers = new Map<number, () => void>();
  let timerSequence = 0;
  let nextPrepare = prepare;
  const context = {
    handleSubmit: undefined as undefined | (() => Promise<void>),
    setMessage: (value: string) => { state.message = value; },
    setSubmitting: (value: boolean) => { state.submitting = value; },
    setAwaitingConsentAfterSuccess: (value: boolean) => { state.awaitingConsent = value; },
    setCreditAccessFailure: (value: unknown) => { state.creditFailure = value; },
    setCustomerProfile: (value: { credit_balance: number }) => { state.profileBalances.push(value.credit_balance); },
    requestCompletionStartedRef: { current: false },
    AbortController,
    setTimeout: (callback: () => void, delay: number) => {
      state.timerDelays.push(delay);
      const id = ++timerSequence;
      timers.set(id, callback);
      return id;
    },
    clearTimeout: (id: number) => { timers.delete(id); },
    requestVehicleBrand: "Synthetic", requestVehicleModel: "Test", requestVehicleEngine: "Test Engine",
    requestVehicleGeneration: "Test", useManualVehicleDetails: true,
    selectedMainService: { id: "only_options", credits }, selectedFile: file,
    maxRequestFileSize: 32 * 1024 * 1024, allowedRequestFileExtensions: [".bin"],
    paymentAccepted: true, responsibilityAccepted: true,
    getStableSession: async () => ({ session: { user } }), signOutIfEmailUnverified: async () => false,
    sha256Hex: async () => "0".repeat(64), fingerprintWebRequest: async () => "1".repeat(64),
    requestSubmissionRef: ref, readPersistedWebRequest: () => null,
    persistWebRequest: (_id: string, value: Submission) => { state.persisted.push(value.idempotencyKey); },
    clearPersistedWebRequest: () => { state.cleared++; },
    window: {
      crypto: { randomUUID: () => { state.uuidCalls++; return syntheticKey; } },
      location: { hostname: "localhost", assign: (destination: string) => { state.destinations.push(destination); } },
    },
    getLatestCustomerProfile: async () => profile,
    notes: "Synthetic audit only", ecu: "", gearbox: "", year: "", readMethod: "", licensePlate: "", hwSw: "",
    masterSlave: "master", fileName: file.name, serviceSummary: "Only Options", totalCredits: credits,
    authenticatedFetch: async (url: string, init: RequestInit) => {
      if (url === "/api/account/request-upload/prepare") {
        state.prepares.push(JSON.parse(String(init.body)));
        return nextPrepare();
      }
      assert.equal(url, "/api/email/new-order");
      state.emailCalls++;
      state.emailRequests.push(init);
      return options.email ? options.email(init) : new Response("{}");
    },
    supabase: {
      storage: { from: (bucket: string) => {
        assert.equal(bucket, "customer-files");
        return { uploadToSignedUrl: async (_path: string, _token: string, value: unknown) => {
          state.uploads.push(value);
          return { error: null };
        } };
      } },
      rpc: async (name: string, parameters: Record<string, unknown>) => {
        assert.equal(name, "create_web_order_with_credit_deduction");
        state.orders.push(parameters);
        return options.creation ?? { data: { order_id: syntheticOrderId, duplicate: options.duplicate === true }, error: null };
      },
    },
    growthAttemptIdRef: { current: null }, pendingGrowthRequestCreatedRef: { current: null },
    trackRequestSubmitted: async (seed: string) => { state.measurementCalls++; state.measurementSeeds.push(seed); return false; },
    readMeasurementConsentSnapshot: () => ({ needsDecision: false, preferences: { analytics: false, advertising: false } }),
    requestCompletionConsentIsAvailable: () => false,
    replaceWithPendingMeasurementCompletion: () => false,
  };
  runInNewContext(compiled, context, { timeout: 1000 });
  assert.ok(context.handleSubmit);
  return {
    state, ref, file, context, timers, submit: context.handleSubmit,
    setPrepare: (value: Prepare) => { nextPrepare = value; },
    fireDeadlines: () => {
      for (const [id, callback] of [...timers]) {
        timers.delete(id);
        callback();
      }
    },
  };
}

const successfulPrepare = async () => Response.json({ upload: {
  path: "synthetic/original.bin", token: "synthetic-not-a-real-token", contentType: "application/octet-stream",
} });

async function flushSyntheticMicrotasks() {
  for (let turn = 0; turn < 60; turn++) await Promise.resolve();
}

test("a confirmed request completes after the email deadline even when transport ignores abort", async () => {
  const h = harness(successfulPrepare, 0, { email: async () => new Promise<Response>(() => undefined) });
  const completion = h.submit();
  await flushSyntheticMicrotasks();
  assert.equal(h.state.emailCalls, 1);
  assert.deepEqual(h.state.destinations, []);
  h.fireDeadlines();
  await flushSyntheticMicrotasks();
  assert.deepEqual(h.state.destinations, ["/dashboard"], "the accepted request must not wait forever for email");
  await completion;
  assert.equal(h.state.emailRequests[0].signal?.aborted, true);
  assert.equal(h.state.cleared, 1);
  assert.equal(h.ref.current, null);
  assert.equal(h.timers.size, 0);
  assert.deepEqual(h.state.timerDelays, [4_000]);
});

test("confirmed completion stays busy and repeated clicks cannot start another submission", async () => {
  const h = harness(successfulPrepare, 0, { email: async () => new Promise<Response>(() => undefined) });
  const completion = h.submit();
  await flushSyntheticMicrotasks();
  assert.equal(h.state.emailCalls, 1);
  assert.equal(h.state.submitting, true);
  await h.submit();
  assert.equal(h.state.orders.length, 1);
  assert.equal(h.state.uuidCalls, 1);
  assert.equal(h.state.emailCalls, 1);
  h.fireDeadlines();
  await completion;
  await h.submit();
  assert.equal(h.state.orders.length, 1);
  assert.equal(h.state.cleared, 1);
});

for (const [name, email] of [
  ["successful", async () => new Response("{}")],
  ["rejected", async () => { throw new Error("Synthetic notification failure"); }],
  ["non-success HTTP", async () => new Response("{}", { status: 503 })],
] as const) {
  test(`${name} email settles once and clears the notification deadline`, async () => {
    const h = harness(successfulPrepare, 0, { email });
    await h.submit();
    assert.equal(h.state.orders.length, 1);
    assert.equal(h.state.emailCalls, 1);
    assert.deepEqual(JSON.parse(String(h.state.emailRequests[0].body)), { orderId: syntheticOrderId });
    assert.equal(h.state.emailRequests[0].method, "POST");
    assert.deepEqual(h.state.measurementSeeds, [syntheticOrderId]);
    assert.equal(h.state.cleared, 1);
    assert.equal(h.ref.current, null);
    assert.deepEqual(h.state.destinations, ["/dashboard"]);
    assert.equal(h.timers.size, 0);
    assert.deepEqual(h.state.timerDelays, [4_000]);
    h.fireDeadlines();
    assert.equal(h.state.emailRequests[0].signal?.aborted, false);
  });
}

test("same-ID order replay keeps its original key and conversion seed when email times out", async () => {
  const h = harness(successfulPrepare, 10, { duplicate: true, email: async () => new Promise<Response>(() => undefined) });
  h.ref.current = { idempotencyKey: syntheticKey, fingerprint: "1".repeat(64), filePath: "synthetic/original.bin", signature: "previous synthetic submission" };
  const completion = h.submit();
  await flushSyntheticMicrotasks();
  assert.equal(h.state.emailCalls, 1);
  h.fireDeadlines();
  await flushSyntheticMicrotasks();
  assert.deepEqual(h.state.destinations, ["/dashboard"]);
  await completion;
  assert.equal(h.state.uuidCalls, 0);
  assert.equal(h.state.orders[0].p_idempotency_key, syntheticKey);
  assert.deepEqual(h.state.measurementSeeds, [syntheticOrderId]);
  assert.deepEqual(h.state.profileBalances, [0], "a replay must not deduct the local credit balance twice");
  assert.equal(h.state.emailCalls, 1);
  assert.equal(h.state.cleared, 1);
});

test("late notification rejection after the deadline cannot replay completion", async () => {
  let rejectEmail: (reason: Error) => void = () => { throw new Error("email was not started"); };
  const h = harness(successfulPrepare, 0, { email: () => new Promise<Response>((_resolve, reject) => { rejectEmail = reject; }) });
  const completion = h.submit();
  await flushSyntheticMicrotasks();
  h.fireDeadlines();
  await flushSyntheticMicrotasks();
  assert.deepEqual(h.state.destinations, ["/dashboard"]);
  await completion;
  rejectEmail(new Error("Synthetic late failure"));
  await flushSyntheticMicrotasks();
  assert.equal(h.state.cleared, 1);
  assert.equal(h.state.emailCalls, 1);
  assert.deepEqual(h.state.destinations, ["/dashboard"]);
  assert.equal(h.timers.size, 0);
});

test("the notification deadline still releases completion if AbortController is unavailable", async () => {
  const h = harness(successfulPrepare, 0, { email: async () => new Promise<Response>(() => undefined) });
  h.context.AbortController = class {
    constructor() { throw new Error("Synthetic unsupported abort"); }
  } as typeof AbortController;
  const completion = h.submit();
  await flushSyntheticMicrotasks();
  h.fireDeadlines();
  await flushSyntheticMicrotasks();
  assert.deepEqual(h.state.destinations, ["/dashboard"]);
  await completion;
  assert.equal(h.state.emailRequests[0].signal, undefined);
  assert.equal(h.timers.size, 0);
});

test("a notification timeout preserves the existing undecided-consent handoff", async () => {
  const h = harness(successfulPrepare, 0, { email: async () => new Promise<Response>(() => undefined) });
  h.context.readMeasurementConsentSnapshot = () => ({ needsDecision: true, preferences: { analytics: false, advertising: false } });
  h.context.requestCompletionConsentIsAvailable = () => true;
  const completion = h.submit();
  await flushSyntheticMicrotasks();
  h.fireDeadlines();
  await flushSyntheticMicrotasks();
  assert.equal(h.state.awaitingConsent, true);
  await completion;
  assert.equal(h.state.cleared, 1);
  assert.deepEqual(h.state.destinations, []);
  await h.submit();
  assert.equal(h.state.orders.length, 1);
  assert.equal(h.state.emailCalls, 1);
  assert.equal(h.timers.size, 0);
});

for (const [name, creation] of [
  ["RPC error", { data: null, error: { message: "Synthetic RPC failure" } }],
  ["missing order confirmation", { data: {}, error: null }],
] as const) {
  test(`${name} remains retryable with the same key and no premature completion latch`, async () => {
    const options: HarnessOptions = { creation };
    const h = harness(successfulPrepare, 0, options);
    await h.submit();
    assert.equal(h.state.submitting, false);
    assert.equal(h.context.requestCompletionStartedRef.current, false);
    assert.equal(h.state.emailCalls + h.state.measurementCalls + h.state.cleared, 0);
    assert.deepEqual(h.state.destinations, []);
    options.creation = undefined;
    await h.submit();
    assert.equal(h.state.uuidCalls, 1);
    assert.deepEqual(h.state.orders.map((order) => order.p_idempotency_key), [syntheticKey, syntheticKey]);
    assert.deepEqual(h.state.destinations, ["/dashboard"]);
    assert.equal(h.state.cleared, 1);
  });
}

function acceptedRequestRestoreHarness(bridgeAvailable: boolean) {
  const effect = page?.body?.statements.find((node): node is ts.ExpressionStatement =>
    ts.isExpressionStatement(node) && ts.isCallExpression(node.expression) &&
    node.expression.expression.getText(ast) === "useEffect" &&
    node.getText(ast).includes('"pageshow"') &&
    node.getText(ast).includes("requestCompletionStartedRef"));
  assert.ok(effect && ts.isCallExpression(effect.expression));
  const effectCode = ts.transpileModule(
    `globalThis.mount = ${effect.expression.arguments[0].getText(ast)};`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const listeners = new Map<string, (event: { persisted: boolean }) => void>();
  const completionRef = { current: false };
  const bridgeCalls: string[] = [];
  const destinations: string[] = [];
  const context = {
    mount: undefined as undefined | (() => () => void),
    requestCompletionStartedRef: completionRef,
    replaceWithPendingMeasurementCompletion: (destination: string) => {
      bridgeCalls.push(destination);
      return bridgeAvailable;
    },
    window: {
      addEventListener: (name: string, listener: (event: { persisted: boolean }) => void) => { listeners.set(name, listener); },
      removeEventListener: (name: string, listener: (event: { persisted: boolean }) => void) => {
        assert.equal(listeners.get(name), listener);
        listeners.delete(name);
      },
      location: { replace: (destination: string) => { destinations.push(destination); } },
    },
  };
  runInNewContext(effectCode, context, { timeout: 1000 });
  assert.ok(context.mount);
  const cleanup = context.mount();
  return { completionRef, bridgeCalls, destinations, listeners, cleanup,
    show: (persisted: boolean) => { listeners.get("pageshow")?.({ persisted }); },
  };
}

for (const bridgeAvailable of [true, false]) {
  test(`restored accepted form resumes ${bridgeAvailable ? "pending measurement" : "the dashboard"} without reopening submission`, () => {
    const h = acceptedRequestRestoreHarness(bridgeAvailable);
    // The listener must see a completion accepted after the effect mounted.
    h.completionRef.current = true;
    h.show(true);
    assert.deepEqual(h.bridgeCalls, ["/dashboard"]);
    assert.deepEqual(h.destinations, bridgeAvailable ? [] : ["/dashboard"]);
    assert.equal(h.completionRef.current, true);
    h.cleanup();
  });
}

test("restoring an incomplete request leaves the form and submission state untouched", () => {
  const h = acceptedRequestRestoreHarness(true);
  h.show(true);
  assert.deepEqual(h.bridgeCalls, []);
  assert.deepEqual(h.destinations, []);
  assert.equal(h.completionRef.current, false);
  h.cleanup();
});

test("ordinary pageshow does not navigate an accepted form", () => {
  const h = acceptedRequestRestoreHarness(true);
  h.completionRef.current = true;
  h.show(false);
  assert.deepEqual(h.bridgeCalls, []);
  assert.deepEqual(h.destinations, []);
  h.cleanup();
});

test("unmount removes the exact accepted-request restore listener", () => {
  const h = acceptedRequestRestoreHarness(true);
  h.completionRef.current = true;
  assert.equal(h.listeners.size, 1);
  h.cleanup();
  assert.equal(h.listeners.size, 0);
  h.show(true);
  assert.deepEqual(h.bridgeCalls, []);
  assert.deepEqual(h.destinations, []);
});

test("a rejected upload preparation releases the submit button without losing retry state or invoking downstream actions", async () => {
  const h = harness(async () => { throw new TypeError("Synthetic network failure"); });
  await assert.doesNotReject(h.submit);
  assert.equal(h.state.submitting, false);
  assert.equal(h.state.message, prepareError);
  assert.equal(h.state.prepares.length, 1);
  assert.equal(h.ref.current?.idempotencyKey, syntheticKey);
  assert.equal(h.ref.current?.filePath, "");
  assert.equal(h.context.selectedFile, h.file);
  assert.equal(h.context.notes, "Synthetic audit only");
  assert.equal(h.state.cleared, 0);
  assert.equal(h.state.uploads.length + h.state.orders.length + h.state.emailCalls + h.state.measurementCalls, 0);
  assert.deepEqual(h.state.destinations, []);
});

test("customer retry uses the same file and idempotency key and only clears state after a confirmed order", async () => {
  const h = harness(async () => { throw new TypeError("Synthetic network failure"); });
  await h.submit();
  const retainedSubmission = h.ref.current;
  h.setPrepare(successfulPrepare);
  await h.submit();
  assert.equal(h.state.submitting, true, "accepted completion stays locked until navigation");
  assert.equal(h.state.message, "");
  assert.equal(h.state.uuidCalls, 1);
  assert.deepEqual(h.state.prepares.map((body) => body.idempotencyKey), [syntheticKey, syntheticKey]);
  assert.equal(retainedSubmission?.idempotencyKey, syntheticKey);
  assert.equal(h.state.uploads.length, 1);
  assert.equal(h.state.uploads[0], h.file);
  assert.equal(h.state.orders.length, 1);
  assert.equal(h.state.orders[0].p_idempotency_key, syntheticKey);
  assert.equal(h.state.orders[0].p_credits_required, 0);
  assert.equal(h.state.orders[0].p_notes, "Synthetic audit only");
  assert.equal(h.ref.current, null);
  assert.equal(h.state.cleared, 1);
  assert.equal(h.state.emailCalls, 1);
  assert.equal(h.state.measurementCalls, 1);
  assert.deepEqual(h.state.destinations, ["/dashboard"]);
});

for (const [name, prepare] of [
  ["non-success HTTP response", async () => new Response("{}", { status: 503 })],
  ["invalid JSON", async () => new Response("not JSON")],
  ["missing signed-upload fields", async () => Response.json({ upload: { path: "synthetic/original.bin" } })],
] as const) {
  test(`${name} retains the existing recoverable error behavior`, async () => {
    const h = harness(prepare);
    await h.submit();
    assert.equal(h.state.submitting, false);
    assert.equal(h.state.message, prepareError);
    assert.equal(h.ref.current?.idempotencyKey, syntheticKey);
    assert.equal(h.state.cleared + h.state.uploads.length + h.state.orders.length, 0);
  });
}

test("paid requests still enforce the existing credit check before preparation", async () => {
  const h = harness(successfulPrepare, 10);
  await h.submit();
  assert.equal(h.state.submitting, false);
  assert.equal((h.state.creditFailure as { key: string }).key, "insufficientCredits");
  assert.equal(h.state.prepares.length + h.state.uploads.length + h.state.orders.length, 0);
});

test("the reused preparation error is translated in every supported locale", () => {
  for (const { code } of supportedLocales) {
    const translated = customerWorkflowExactT(code, prepareError);
    assert.ok(translated.trim(), `${code}: nonempty error`);
    if (code !== "en") assert.notEqual(translated, prepareError, `${code}: no English fallback`);
  }
  assert.match(source, /customerWorkflowExactT\(locale, message\)/);
});

test("the actual error element announces localized recovery feedback without changing its responsive styling", () => {
  let errorElement: ts.JsxElement | undefined;
  function visit(node: ts.Node) {
    if (ts.isJsxElement(node) && node.children.some((child) =>
      ts.isJsxExpression(child) && child.expression?.getText(ast) === "localizedMessage")) {
      errorElement = node;
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(errorElement);
  const elementCode = ts.transpileModule(`exports.element = (${errorElement.getText(ast)});`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  for (const { code } of supportedLocales) {
    const exports: { element?: ReactNode } = {};
    const localizedMessage = customerWorkflowExactT(code, prepareError);
    runInNewContext(elementCode, {
      exports, localizedMessage,
      require: (name: string) => { assert.equal(name, "react/jsx-runtime"); return { jsx, jsxs }; },
    }, { timeout: 1000 });
    const html = renderToStaticMarkup(exports.element);
    assert.match(html, /role="alert"/);
    assert.match(html, /aria-atomic="true"/);
    assert.match(html, /class="mt-5 rounded-2xl border border-red-800\/50 bg-red-950\/30 p-4 text-sm text-red-200"/);
    assert.ok(html.includes(renderToStaticMarkup(localizedMessage)), `${code}: localized rendered feedback`);
  }
});
