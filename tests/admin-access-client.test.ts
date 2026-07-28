import assert from "node:assert/strict";
import test from "node:test";
import { classifyAdminAccessApiResponse } from "../src/lib/adminAccess";

test("admin access API classification authorizes valid owner and staff payloads", () => {
  const owner = classifyAdminAccessApiResponse(200, {
    access: { role: "admin", staffRole: "owner", permissions: [] },
  });
  const support = classifyAdminAccessApiResponse(200, {
    access: { role: "staff", staffRole: "support", permissions: ["orders.view"] },
  });

  assert.equal(owner.state, "authorized");
  assert.equal(support.state, "authorized");
});

test("only an explicit server 403 becomes an admin access denial", () => {
  assert.deepEqual(classifyAdminAccessApiResponse(403, { error: "Forbidden" }), {
    state: "denied",
    reason: "server_forbidden",
  });

  for (const status of [0, 401, 408, 429, 500, 502, 503, 504]) {
    assert.deepEqual(classifyAdminAccessApiResponse(status, null), {
      state: "unavailable",
    });
  }
});

test("zero-row and malformed successful responses never create a false denial", () => {
  for (const payload of [
    null,
    {},
    { access: null },
    { access: { role: "customer" } },
    { access: { role: "admin", staffRole: "unexpected", permissions: [] } },
    { access: { role: "admin", staffRole: null, permissions: [123] } },
  ]) {
    assert.deepEqual(classifyAdminAccessApiResponse(200, payload), {
      state: "unavailable",
    });
  }
});

test("admin access API rejects anonymous requests without exposing access data", async () => {
  const { GET } = await import("../src/app/api/admin/access/route");
  const response = await GET(new Request("http://localhost/api/admin/access"));
  const payload = await response.json();

  assert.equal(response.status, 401);
  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
  assert.deepEqual(payload, { error: "Unauthorized" });
  assert.equal("access" in payload, false);
});
