import assert from "node:assert/strict";
import test from "node:test";
import type { User } from "@supabase/supabase-js";
import type { AuthResult } from "../src/lib/apiAuth";
import { createServiceReportDownloadHandler, type ReportDownloadDependencies } from "../src/lib/serviceReports/downloadServer";
import { ServiceReportError } from "../src/lib/serviceReports/model";
import { CUSTOMER_DEVICE_VERIFICATION_REQUIRED_CODE, CUSTOMER_SESSION_REVOKED_CODE, CUSTOMER_SESSION_REVOKED_MESSAGE } from "../src/lib/customerDeviceContracts";
import { reportFixture } from "./helpers/service-report-fixture";

const auth: Extract<AuthResult, { ok: true }> = { ok: true, user: { id: reportFixture.customerId } as User, access: { role: "customer", staffRole: null, permissions: [] }, accessToken: "synthetic", sessionId: null };
function setup(overrides: Partial<ReportDownloadDependencies> = {}) {
  const calls: string[] = [];
  const dependencies: ReportDownloadDependencies = {
    async authorize() { calls.push("auth"); return auth; },
    async rateLimit() { calls.push("rate"); return { status: 200, headers: {} }; },
    async snapshot() { calls.push("snapshot"); return reportFixture; },
    async logo() { calls.push("logo"); return null; },
    async render() { calls.push("render"); return Buffer.from("%PDF-1.7\nsynthetic test"); },
    async assertAccessible() { calls.push("recheck"); },
    ...overrides,
  };
  return { handler: createServiceReportDownloadHandler(dependencies), calls };
}
const request = (body: unknown = { locale: "de" }) => new Request("http://localhost/api/requests/order/service-report", { method: "POST", body: JSON.stringify(body) });

test("report download returns a private attachment only after fresh authorization and order recheck", async () => {
  const { handler, calls } = setup();
  const response = await handler(request(), reportFixture.orderId);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.match(response.headers.get("content-disposition")!, /r1-de\.pdf/);
  assert.match(response.headers.get("cache-control")!, /private, no-store/);
  assert.deepEqual(calls, ["auth", "rate", "snapshot", "logo", "render", "auth", "recheck"]);
});
test("unauthenticated and revoked device requests do not touch report data", async () => {
  for (const status of [401, 403, 428]) {
    const { handler, calls } = setup({ authorize: async () => ({ ok: false, status, error: "private internal error" }) });
    const response = await handler(request(), reportFixture.orderId);
    assert.equal(response.status, status);
    assert.deepEqual(calls, []);
    assert.doesNotMatch(await response.text(), /private internal/);
  }
});
test("initial and post-render revoked sessions preserve only the public sign-out contract", async () => {
  for (const revokedAt of [1, 2]) {
    let authorizations = 0;
    const { handler, calls } = setup({ authorize: async () => ++authorizations === revokedAt
      ? { ok: false, status: 401, code: CUSTOMER_SESSION_REVOKED_CODE, error: "private provider error must not be forwarded" }
      : auth });
    const response = await handler(request(), reportFixture.orderId);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: CUSTOMER_SESSION_REVOKED_MESSAGE, code: CUSTOMER_SESSION_REVOKED_CODE });
    assert.match(response.headers.get("cache-control")!, /private, no-store/);
    assert.equal(calls.includes("render"), revokedAt === 2);
    assert.equal(calls.includes("recheck"), false);
  }
  const challenged = setup({ authorize: async () => ({ ok: false, status: 428, code: CUSTOMER_DEVICE_VERIFICATION_REQUIRED_CODE, error: "private challenge details" }) });
  const response = await challenged.handler(request(), reportFixture.orderId);
  assert.equal(response.status, 428);
  assert.deepEqual(await response.json(), { error: CUSTOMER_DEVICE_VERIFICATION_REQUIRED_CODE, code: CUSTOMER_DEVICE_VERIFICATION_REQUIRED_CODE });
  assert.deepEqual(challenged.calls, []);
});
test("bad identifiers, unsupported locales and oversized bodies are rejected", async () => {
  for (const [id, body, status] of [["bad", { locale: "de" }, 404], [reportFixture.orderId, { locale: "xx" }, 400], [reportFixture.orderId, { locale: "de", arbitrary: true }, 400], [reportFixture.orderId, { locale: "de", padding: "a".repeat(1500) }, 413]] as const) {
    const { handler, calls } = setup();
    assert.equal((await handler(request(body), id)).status, status);
    assert.ok(!calls.includes("snapshot"));
  }
});
test("other-customer and incomplete orders never render", async () => {
  for (const [code, status] of [["REPORT_NOT_FOUND", 404], ["REPORT_NOT_COMPLETED", 409]] as const) {
    const { handler, calls } = setup({ snapshot: async () => { throw new ServiceReportError(code, status); } });
    const response = await handler(request(), reportFixture.orderId);
    assert.equal(response.status, status);
    assert.ok(!calls.includes("render"));
  }
});
test("rate limit and unavailable distributed counter fail closed", async () => {
  for (const status of [429, 503] as const) {
    const { handler, calls } = setup({ rateLimit: async () => ({ status, headers: { "Retry-After": "60" } }) });
    const response = await handler(request(), reportFixture.orderId);
    assert.equal(response.status, status);
    assert.equal(response.headers.get("retry-after"), "60");
    assert.ok(!calls.includes("snapshot"));
  }
});
test("reopening, reassignment or authorization revocation during rendering prevents response", async () => {
  const reopened = setup({ assertAccessible: async () => { throw new ServiceReportError("REPORT_NOT_COMPLETED", 409); } });
  const response = await reopened.handler(request(), reportFixture.orderId);
  assert.equal(response.status, 409);
  assert.doesNotMatch(await response.text(), /%PDF/);
  let count = 0;
  const revoked = setup({ authorize: async () => ++count === 1 ? auth : ({ ok: false, status: 401, error: "revoked" }) });
  assert.equal((await revoked.handler(request(), reportFixture.orderId)).status, 401);
});
test("malformed renderer data and private provider errors never leak", async () => {
  for (const render of [async () => Buffer.from("not a pdf"), async () => { throw new Error("private-key/storage/user@example.com"); }]) {
    const { handler } = setup({ render });
    const response = await handler(request(), reportFixture.orderId);
    assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /private-key|storage|example.com/);
    assert.match(response.headers.get("cache-control")!, /no-store/);
  }
});
