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

function harness(prepare: Prepare, credits = 0) {
  const user = { id: "11111111-1111-4111-8111-111111111111", email: "synthetic@example.invalid" };
  const profile = { ...user, credit_balance: 0, allow_negative_credits: false, negative_credit_limit: 0, account_status: "active" };
  const file = { name: "synthetic.bin", size: 4, type: "application/octet-stream", lastModified: 0, arrayBuffer: async () => new ArrayBuffer(4) };
  const ref: { current: Submission | null } = { current: null };
  const state = {
    submitting: false, message: "", creditFailure: null as unknown,
    prepares: [] as Record<string, unknown>[], uploads: [] as unknown[], orders: [] as Record<string, unknown>[],
    persisted: [] as string[], cleared: 0, emailCalls: 0, measurementCalls: 0, destinations: [] as string[], uuidCalls: 0,
  };
  let nextPrepare = prepare;
  const context = {
    handleSubmit: undefined as undefined | (() => Promise<void>),
    setMessage: (value: string) => { state.message = value; },
    setSubmitting: (value: boolean) => { state.submitting = value; },
    setCreditAccessFailure: (value: unknown) => { state.creditFailure = value; },
    setCustomerProfile: () => undefined,
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
      return new Response("{}");
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
        return { data: { order_id: syntheticOrderId }, error: null };
      },
    },
    growthAttemptIdRef: { current: null }, pendingGrowthRequestCreatedRef: { current: null },
    trackRequestSubmitted: async () => { state.measurementCalls++; return false; },
    readMeasurementConsentSnapshot: () => ({ needsDecision: false, preferences: { analytics: false, advertising: false } }),
    requestCompletionConsentIsAvailable: () => false,
    replaceWithPendingMeasurementCompletion: () => false,
  };
  runInNewContext(compiled, context, { timeout: 1000 });
  assert.ok(context.handleSubmit);
  return { state, ref, file, context, submit: context.handleSubmit, setPrepare: (value: Prepare) => { nextPrepare = value; } };
}

const successfulPrepare = async () => Response.json({ upload: {
  path: "synthetic/original.bin", token: "synthetic-not-a-real-token", contentType: "application/octet-stream",
} });

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
  assert.equal(h.state.submitting, false);
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
