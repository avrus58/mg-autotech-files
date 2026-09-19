import assert from "node:assert/strict";
import test from "node:test";
import { createBrowserAuthFetch } from "../src/lib/browserAuthFetch";

const serverTime = Date.parse("2026-09-19T17:43:45Z");
const origin = "https://synthetic.invalid";
const url = `${origin}/auth/v1/token?grant_type=password`;
const session = {
  access_token: "synthetic-access-unchanged",
  refresh_token: "synthetic-refresh-unchanged",
  expires_in: 3600,
  expires_at: serverTime / 1000 + 3600,
  token_type: "bearer",
  user: { id: "synthetic-user" },
};

test("token clock correction changes scheduling metadata only and preserves response headers", async (t) => {
  t.mock.method(Date, "now", () => serverTime + 7200_000);
  const response = Response.json(session, { headers: { "cache-control": "no-store", "x-request-id": "synthetic", "content-length": "1" } });
  const wrapped = createBrowserAuthFetch(origin, async () => response);
  const corrected = await wrapped(url, { method: "POST" });
  assert.deepEqual(await corrected.json(), { ...session, expires_at: session.expires_at + 7200 });
  assert.equal(corrected.status, 200);
  assert.equal(corrected.headers.get("cache-control"), "no-store");
  assert.equal(corrected.headers.get("x-request-id"), "synthetic");
  assert.equal(corrected.headers.has("content-length"), false);
});

test("network delay is subtracted from the local lifetime, never added", async (t) => {
  let now = serverTime + 7200_000;
  t.mock.method(Date, "now", () => now);
  const wrapped = createBrowserAuthFetch(origin, async () => {
    now += 30_000;
    return Response.json(session);
  });
  const corrected = await wrapped(new Request(url, { method: "POST" }));
  assert.equal((await corrected.json()).expires_at - now / 1000, 3570);
});

test("normal clocks and non-token/error responses are passed through without consumption", async (t) => {
  for (const offset of [0, 60_000, -60_000]) {
    t.mock.method(Date, "now", () => serverTime + offset);
    const response = Response.json(session);
    assert.equal(await createBrowserAuthFetch(origin, async () => response)(url, { method: "POST" }), response);
    assert.equal(response.bodyUsed, false);
  }
  t.mock.method(Date, "now", () => serverTime + 7200_000);
  for (const [target, method, status] of [
    [url, "POST", 400], [url, "POST", 401], [url, "POST", 429], [url, "POST", 503],
    [url, "GET", 200], [`${origin}/auth/v1/user`, "POST", 200],
    ["https://different.invalid/auth/v1/token", "POST", 200], ["/relative", "POST", 200],
  ] as const) {
    const response = Response.json(session, { status });
    assert.equal(await createBrowserAuthFetch(origin, async () => response)(target, { method }), response);
    assert.equal(response.bodyUsed, false);
  }
});

test("invalid or absent session lifetimes are not repaired into valid sessions", async (t) => {
  t.mock.method(Date, "now", () => serverTime + 7200_000);
  for (const body of [
    null, [], {}, { error: "synthetic" },
    ...[0, -1, 1.5, "3600", 86401, undefined].map(expires_in => ({ ...session, expires_in })),
    ...[0, -1, "123", undefined].map(expires_at => ({ ...session, expires_at })),
    { ...session, access_token: "" }, { ...session, refresh_token: "" },
  ]) {
    const response = Response.json(body);
    assert.equal(await createBrowserAuthFetch(origin, async () => response)(url, { method: "POST" }), response);
    assert.equal(response.bodyUsed, false);
  }
  const malformed = new Response("not json");
  assert.equal(await createBrowserAuthFetch(origin, async () => malformed)(url, { method: "POST" }), malformed);
});

test("redirected responses outside the exact trusted token endpoint are untouched", async (t) => {
  t.mock.method(Date, "now", () => serverTime + 7200_000);
  for (const finalUrl of [`${origin}/auth/v1/user`, "https://different.invalid/auth/v1/token"]) {
    const response = Response.json(session);
    Object.defineProperty(response, "url", { value: finalUrl });
    assert.equal(await createBrowserAuthFetch(origin, async () => response)(url, { method: "POST" }), response);
  }
});

test("transport failures and abort signals retain their original semantics", async () => {
  const controller = new AbortController();
  const failure = new TypeError("synthetic transport failure");
  const wrapped = createBrowserAuthFetch(origin, async (input, init) => {
    assert.equal(input, url);
    assert.equal(init?.signal, controller.signal);
    throw failure;
  });
  await assert.rejects(wrapped(url, { method: "POST", signal: controller.signal }), error => error === failure);
});
