import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { createContext, runInContext } from "node:vm";
import { GoTrueClient } from "@supabase/auth-js";
import ts from "typescript";

type MutationQueue = <T>(operation: () => PromiseLike<T>) => Promise<T>;
type TestLocks = {
  request: <T>(name: string, options: { mode: string }, operation: () => Promise<T>) => Promise<T>;
};

function deferred<T>() {
  let resolvePromise!: (value: T) => void;
  const promise = new Promise<T>((resolve) => { resolvePromise = resolve; });
  return { promise, resolve: resolvePromise };
}

const compiledMutations = ts.transpileModule(
  readFileSync(resolve(process.cwd(), "src/lib/browserAuthMutations.ts"), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;

function createQueue(options: { browser?: boolean; locks?: TestLocks } = {}): MutationQueue {
  const context = createContext({
    exports: {},
    ...(options.browser === false ? {} : { window: {} }),
    ...(options.locks ? { navigator: { locks: options.locks } } : {}),
  });
  runInContext(compiledMutations, context);
  return context.exports.withBrowserAuthMutation as MutationQueue;
}

function sharedLocks() {
  const tails = new Map<string, Promise<void>>();
  const requests: Array<{ name: string; mode: string }> = [];
  const locks: TestLocks = {
    request(name, options, operation) {
      requests.push({ name, mode: options.mode });
      const result = (tails.get(name) ?? Promise.resolve()).then(operation);
      tails.set(name, result.then(() => undefined, () => undefined));
      return result;
    },
  };
  return { locks, requests };
}

test("the browser fallback keeps later mutations queued until the SDK operation settles", async () => {
  const queue = createQueue();
  const started = deferred<void>();
  const release = deferred<string>();
  const order: string[] = [];
  const first = queue(() => {
    order.push("first");
    started.resolve();
    return release.promise;
  });
  const second = queue(async () => { order.push("second"); return "second result"; });
  await started.promise;
  assert.deepEqual(order, ["first"]);

  release.resolve("first result");
  assert.deepEqual(await Promise.all([first, second]), ["first result", "second result"]);
  assert.deepEqual(order, ["first", "second"]);
});

test("a rejected browser mutation releases the queue without retrying the failed operation", async () => {
  const queue = createQueue();
  let executions = 0;
  const failed = queue(() => { executions += 1; throw new Error("synthetic failure"); });
  const failure = assert.rejects(failed, /synthetic failure/);
  const next = queue(async () => { executions += 1; return "recovered"; });

  await failure;
  assert.equal(await next, "recovered");
  assert.equal(executions, 2);
});

test("independent browser documents use the same exclusive navigator lock", async () => {
  const { locks, requests } = sharedLocks();
  const firstTab = createQueue({ locks });
  const secondTab = createQueue({ locks });
  const started = deferred<void>();
  const release = deferred<void>();
  const order: string[] = [];
  const first = firstTab(() => {
    order.push("first tab");
    started.resolve();
    return release.promise;
  });
  await started.promise;
  const second = secondTab(async () => { order.push("second tab"); });
  await Promise.resolve();
  assert.deepEqual(order, ["first tab"]);

  release.resolve();
  await Promise.all([first, second]);
  assert.deepEqual(order, ["first tab", "second tab"]);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].name, "mg-autotech:browser-auth-mutation");
  assert.equal(requests[0].name, requests[1].name);
  assert.equal(requests.every((request) => request.mode === "exclusive"), true);
});

test("server calls are not serialized through shared module state", async () => {
  const queue = createQueue({ browser: false });
  const started = deferred<void>();
  const release = deferred<void>();
  const first = queue(() => { started.resolve(); return release.promise; });
  await started.promise;

  const second = await queue(async () => "independent server request");
  assert.equal(second, "independent server request");
  release.resolve();
  await first;
});

function createSdkFixture() {
  const logoutStarted = deferred<void>();
  const logoutResponse = deferred<void>();
  let passwordRequests = 0;
  const user = {
    id: "00000000-0000-4000-8000-000000000001",
    aud: "authenticated",
    created_at: "2026-09-19T00:00:00.000Z",
    app_metadata: {},
    user_metadata: {},
  };
  const client = new GoTrueClient({
    url: "https://auth-fixture.invalid/auth/v1",
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    fetch: async (input) => {
      const url = new URL(String(input));
      assert.equal(url.origin, "https://auth-fixture.invalid");
      if (url.pathname.endsWith("/token") && url.searchParams.get("grant_type") === "password") {
        passwordRequests += 1;
        return new Response(JSON.stringify({
          access_token: `synthetic-access-${passwordRequests}`,
          refresh_token: `synthetic-refresh-${passwordRequests}`,
          expires_in: 3_600,
          token_type: "bearer",
          user,
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.pathname.endsWith("/logout")) {
        assert.equal(url.searchParams.get("scope"), "local");
        logoutStarted.resolve();
        await logoutResponse.promise;
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected mocked SDK operation: ${url.pathname}`);
    },
  });
  const signIn = () => client.signInWithPassword({
    email: "synthetic@example.invalid",
    password: "synthetic-test-only-not-a-real-password",
  });
  return { client, signIn, logoutStarted, logoutResponse, passwordRequests: () => passwordRequests };
}

test("the installed SDK fixture reproduces late logout removal without application serialization", async () => {
  const fixture = createSdkFixture();
  try {
    assert.equal((await fixture.signIn()).error, null);
    const logout = fixture.client.signOut({ scope: "local" });
    await fixture.logoutStarted.promise;
    assert.equal((await fixture.signIn()).error, null);
    assert.ok((await fixture.client.getSession()).data.session);
    fixture.logoutResponse.resolve();
    assert.equal((await logout).error, null);
    assert.equal((await fixture.client.getSession()).data.session, null);
  } finally {
    fixture.logoutResponse.resolve();
    await fixture.client.stopAutoRefresh();
  }
});

test("application serialization preserves a new login after the installed SDK finishes an old logout", async () => {
  const fixture = createSdkFixture();
  const queue = createQueue();
  try {
    assert.equal((await queue(fixture.signIn)).error, null);
    const logout = queue(() => fixture.client.signOut({ scope: "local" }));
    await fixture.logoutStarted.promise;
    const nextLogin = queue(fixture.signIn);
    await Promise.resolve();
    assert.equal(fixture.passwordRequests(), 1);

    fixture.logoutResponse.resolve();
    assert.equal((await logout).error, null);
    const next = await nextLogin;
    assert.equal(next.error, null);
    assert.ok(next.data.session);
    assert.equal(fixture.passwordRequests(), 2);
    assert.equal(
      (await fixture.client.getSession()).data.session?.access_token,
      next.data.session.access_token,
    );
  } finally {
    fixture.logoutResponse.resolve();
    await fixture.client.stopAutoRefresh();
  }
});

test("every explicit login, signup and authorization-code exchange uses the shared mutation queue", () => {
  for (const [path, methods] of [
    ["src/app/login/page.tsx", ["signInWithPassword", "signInWithIdToken"]],
    ["src/app/register/page.tsx", ["signUp", "signInWithIdToken"]],
    ["src/app/auth/callback/page.tsx", ["exchangeCodeForSession"]],
  ] as const) {
    const source = readFileSync(resolve(process.cwd(), path), "utf8");
    const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const queued = new Set<string>();
    const visit = (node: ts.Node, insideMutation: boolean) => {
      const mutation = ts.isCallExpression(node) && ts.isIdentifier(node.expression)
        && node.expression.text === "withBrowserAuthMutation";
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const method = node.expression.name.text;
        if ((methods as readonly string[]).includes(method)) {
          assert.equal(insideMutation, true, `${path}: ${method} must run inside the mutation queue`);
          queued.add(method);
        }
      }
      ts.forEachChild(node, (child) => visit(child, insideMutation || mutation));
    };
    visit(file, false);
    assert.deepEqual([...queued].sort(), [...methods].sort());
  }
});
