import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import * as destinations from "../src/lib/adminMobileNavigation";
import * as permissions from "../src/lib/staffPermissions";

// Execute the real route + client resolver with only the existing authenticated
// identity boundary replaced. No Supabase connection, secret or customer fixture.
function moduleWithMocks(file: string, mocks: Record<string, unknown>) {
  const code = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports: Record<string, unknown> = {};
  runInNewContext(code, { exports, require: (name: string) => {
    assert.ok(name in mocks, `Unmocked dependency: ${name}`);
    return mocks[name];
  }, Response, Request });
  return exports;
}

function loadNavigation(auth: unknown) {
  const route = moduleWithMocks("src/app/api/admin/navigation/route.ts", {
    "next/server": { NextResponse: { json: Response.json } },
    "@/lib/apiAuth": { requireApiUser: async () => auth },
    "@/lib/staffPermissions": permissions,
    "@/lib/adminMobileNavigation": destinations,
  });
  const GET = route.GET as (request: Request) => Promise<Response>;
  const client = moduleWithMocks("src/lib/adminMobileNavigationClient.ts", {
    "@/lib/authGuards": { authenticatedFetch: (url: string) => {
      assert.equal(url, "/api/admin/navigation");
      return GET(new Request(`http://localhost${url}`));
    } },
    "@/lib/adminMobileNavigation": destinations,
  });
  return { GET, resolve: client.resolveAdminNavigation as () => Promise<{ state: string; destinations?: typeof destinations.adminMobileDestinations }> };
}

for (const [permission, expected] of [
  ["credits.manage", ["/admin/payments", "/admin/commercial"]],
  ["vehicles.manage", ["/admin/vehicles"]],
] as const) {
  test(`real navigation route and resolver support ${permission} without orders.view`, async () => {
    const { GET, resolve } = loadNavigation({ ok: true, access: { role: "staff", staffRole: "manager", permissions: [permission] } });
    const response = await GET(new Request("http://localhost/api/admin/navigation"));
    assert.equal(response.status, 200);
    assert.match(response.headers.get("cache-control") ?? "", /private, no-store/);
    assert.equal(response.headers.get("vary"), "Authorization");
    assert.deepEqual(Object.keys(await response.json()), ["destinations"]);
    const resolved = await resolve();
    assert.equal(resolved.state, "authorized");
    assert.deepEqual(resolved.destinations?.map((item) => item.href), [...expected]);
  });
}

test("navigation denies customers and propagates expired/recovery sessions without returning menu data", async () => {
  for (const [auth, state, status] of [
    [{ ok: true, access: { role: "customer", staffRole: null, permissions: ["credits.manage"] } }, "denied", 403],
    [{ ok: false, status: 401, error: "Unauthorized" }, "unavailable", 401],
    [{ ok: false, status: 428, error: "Verify device" }, "unavailable", 428],
    [{ ok: false, status: 503, error: "Temporary outage" }, "unavailable", 503],
  ] as const) {
    const { GET, resolve } = loadNavigation(auth);
    const response = await GET(new Request("http://localhost/api/admin/navigation"));
    assert.equal(response.status, status);
    assert.equal((await response.json()).destinations, undefined);
    assert.equal((await resolve()).state, state);
  }
});

test("Customers navigation also honors the existing root dashboard orders.view gate", async () => {
  for (const [grants, visible] of [
    [["customers.view"], false],
    [["orders.view", "customers.view"], true],
  ] as const) {
    const { resolve } = loadNavigation({ ok: true, access: { role: "staff", staffRole: "support", permissions: [...grants] } });
    const result = await resolve();
    assert.equal(result.state, "authorized");
    assert.equal(result.destinations?.some((item) => item.href === "/admin#customers"), visible);
  }
});

test("navigation resolver rejects untrusted targets, duplicates and malformed payloads", async () => {
  for (const payload of [{ destinations: ["https://example.invalid"] }, { destinations: ["/admin/vehicles", "/admin/vehicles"] }, { destinations: [12] }, {}, null]) {
    const client = moduleWithMocks("src/lib/adminMobileNavigationClient.ts", {
      "@/lib/authGuards": { authenticatedFetch: async () => Response.json(payload) },
      "@/lib/adminMobileNavigation": destinations,
    });
    assert.equal((await (client.resolveAdminNavigation as () => Promise<{ state: string }>)()).state, "unavailable");
  }
});
