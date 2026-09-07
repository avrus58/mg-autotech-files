import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import sharp from "sharp";
import ts from "typescript";
import type { AuthResult } from "../src/lib/apiAuth";
import * as branding from "../src/lib/serviceReports/branding";
import {
  createReportLogoPath, isOwnedReportLogoPath, loadReportLogoDataUrl, normalizeReportLogo,
  normalizeReportLogoContentType, readReportBranding, readReportLogoBody, removeReportBranding,
  ReportBrandingError, REPORT_LOGO_INPUT_MAX_BYTES, REPORT_LOGO_MAX_EDGE, REPORT_LOGO_OUTPUT_MAX_BYTES,
  saveReportBranding, type ReportBrandingStore,
} from "../src/lib/serviceReports/branding";

const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const imageId = "33333333-3333-4333-8333-333333333333";
const validPath = createReportLogoPath(owner, imageId);

async function png(width = 32, height = 24) {
  return sharp({ create: { width, height, channels: 4, background: { r: 180, g: 20, b: 30, alpha: 0.8 } } }).png().toBuffer();
}
function storeFixture() {
  let path: string | null = null;
  const objects = new Map<string, Buffer>();
  const calls: string[] = [];
  const store: ReportBrandingStore = {
    async readPath(customerId) { calls.push(`read:${customerId}`); return path; },
    async writePath(customerId, next) { calls.push(`write:${customerId}`); path = next; },
    async upload(key, bytes) { calls.push(`upload:${key}`); assert.ok(!objects.has(key)); objects.set(key, bytes); },
    async download(key) { calls.push(`download:${key}`); const bytes = objects.get(key); assert.ok(bytes); return new Blob([new Uint8Array(bytes)], { type: "image/png" }); },
  };
  return { store, objects, calls, path: () => path };
}
function streamedBody(chunks: Uint8Array[], headers: Record<string, string> = {}, onCancel = () => undefined) {
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) { if (index < chunks.length) controller.enqueue(chunks[index++]); else controller.close(); },
    cancel() { onCancel(); },
  });
  return new Request("https://fixture.invalid/upload", { method: "POST", body, headers, ...{ duplex: "half" } });
}

test("report logo paths bind exact owner and immutable UUID, never URLs or arbitrary objects", () => {
  assert.equal(validPath, `${owner}/profile/report-logo/${imageId}.png`);
  assert.equal(isOwnedReportLogoPath(owner, validPath), true);
  for (const candidate of [
    createReportLogoPath(other, imageId), `https://example.com/${validPath}`, `data:image/png;base64,AAAA`,
    `${validPath}?x=1`, `${validPath}#x`, `${owner}/profile/report-logo/../${imageId}.png`,
    `${owner}/profile/report-logo/%2e%2e/${imageId}.png`, `${owner}/orders/${imageId}.png`,
    `${owner}/profile/report-logo/${imageId}.svg`, validPath.replaceAll("/", "\\"), null, {},
  ]) assert.equal(isOwnedReportLogoPath(owner, candidate), false);
  assert.throws(() => createReportLogoPath("../invalid", imageId), ReportBrandingError);
  assert.throws(() => createReportLogoPath(owner, "https://example.com"), ReportBrandingError);
});

test("PNG and JPEG are decoded, resized and stripped of embedded metadata", async () => {
  const jpeg = await sharp(await png(1200, 900)).withMetadata({ orientation: 6, density: 144 })
    .withExif({ IFD0: { Artist: "Synthetic test author", ImageDescription: "Must not survive" } }).jpeg().toBuffer();
  for (const [input, type] of [[await png(1200, 900), "image/png"], [jpeg, "image/jpeg"]] as const) {
    const output = await normalizeReportLogo(input, type);
    const metadata = await sharp(output).metadata();
    assert.equal(metadata.format, "png");
    assert.ok((metadata.width ?? Infinity) <= REPORT_LOGO_MAX_EDGE && (metadata.height ?? Infinity) <= REPORT_LOGO_MAX_EDGE);
    assert.ok(output.length <= REPORT_LOGO_OUTPUT_MAX_BYTES);
    assert.equal(metadata.exif, undefined);
    assert.equal(metadata.icc, undefined);
    assert.equal(metadata.xmp, undefined);
    assert.equal(metadata.orientation, undefined);
  }
});

test("image allowlist rejects forged MIME, SVG, GIF, corrupt bytes and input/pixel bombs", async () => {
  const valid = await png();
  assert.equal(normalizeReportLogoContentType("IMAGE/PNG; charset=binary"), "image/png");
  for (const type of ["image/svg+xml", "image/gif", "image/webp", "text/html", null]) assert.throws(() => normalizeReportLogoContentType(type), ReportBrandingError);
  for (const [bytes, type] of [
    [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), "image/png"],
    [Buffer.from("GIF89a"), "image/png"], [valid, "image/jpeg"],
    [valid.subarray(0, 20), "image/png"], [Buffer.alloc(REPORT_LOGO_INPUT_MAX_BYTES + 1), "image/png"],
    [await png(2001, 2000), "image/png"], [await png(4097, 1), "image/png"],
  ] as const) await assert.rejects(normalizeReportLogo(bytes, type), ReportBrandingError);
});

test("raw upload reader bounds chunked actual bytes, declared length and empty bodies", async () => {
  assert.equal((await readReportLogoBody(streamedBody([new Uint8Array([1, 2]), new Uint8Array([3])]), { maxBytes: 4 })).length, 3);
  let cancelled = false;
  await assert.rejects(readReportLogoBody(streamedBody([new Uint8Array(3), new Uint8Array(3), new Uint8Array(1)], {}, () => { cancelled = true; }), { maxBytes: 4 }),
    (error: unknown) => error instanceof ReportBrandingError && error.status === 413);
  assert.equal(cancelled, true);
  for (const length of ["5000000", "-1", "not-a-number"]) await assert.rejects(readReportLogoBody(streamedBody([new Uint8Array([1])], { "content-length": length })), ReportBrandingError);
  await assert.rejects(readReportLogoBody(streamedBody([new Uint8Array([1, 2])], { "content-length": "1" })), ReportBrandingError);
  await assert.rejects(readReportLogoBody(streamedBody([])), ReportBrandingError);
  await assert.rejects(readReportLogoBody(new Request("https://fixture.invalid/upload", { method: "POST" })), ReportBrandingError);
});

test("slow or interrupted raw bodies fail closed, even after a partial chunk", async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array([1, 2])); }, cancel() { cancelled = true; } });
  const request = new Request("https://fixture.invalid/upload", { method: "POST", body, ...{ duplex: "half" } });
  await assert.rejects(readReportLogoBody(request, { timeoutMs: 10 }), ReportBrandingError);
  assert.equal(cancelled, true);
  const broken = new ReadableStream<Uint8Array>({ start(controller) { controller.error(new Error("synthetic transport failure")); } });
  await assert.rejects(readReportLogoBody(new Request("https://fixture.invalid/upload", { method: "POST", body: broken, ...{ duplex: "half" } })));
});

test("upload replacement and logical removal retain immutable images for issued snapshots", async () => {
  const fixture = storeFixture();
  assert.deepEqual(await readReportBranding(fixture.store, owner), { logoDataUrl: null });
  const first = await saveReportBranding(fixture.store, owner, await png(), "image/png");
  const firstPath = fixture.path();
  assert.ok(firstPath && isOwnedReportLogoPath(owner, firstPath));
  assert.match(first.logoDataUrl, /^data:image\/png;base64,/);
  await saveReportBranding(fixture.store, owner, await png(40, 40), "image/png");
  assert.notEqual(fixture.path(), firstPath);
  assert.equal(fixture.objects.size, 2);
  assert.deepEqual(await removeReportBranding(fixture.store, owner), { logoDataUrl: null });
  assert.equal(fixture.path(), null);
  assert.equal(fixture.objects.size, 2);
  assert.equal(await loadReportLogoDataUrl(fixture.store, owner, firstPath), first.logoDataUrl);
});

test("foreign or invalid stored paths are rejected before storage access", async () => {
  const fixture = storeFixture();
  for (const path of [createReportLogoPath(other, imageId), "https://example.com/logo.png", `${validPath}/../other.png`]) {
    await assert.rejects(loadReportLogoDataUrl(fixture.store, owner, path), ReportBrandingError);
  }
  assert.equal(fixture.calls.length, 0);
  assert.equal(await loadReportLogoDataUrl(fixture.store, owner, null), null);
  const invalidStore = { ...fixture.store, readPath: async () => "https://example.com/logo.png" };
  await assert.rejects(readReportBranding(invalidStore, owner), ReportBrandingError);
});

test("failed pointer writes preserve the previous logo, and oversized stored blobs are not decoded", async () => {
  const fixture = storeFixture();
  await saveReportBranding(fixture.store, owner, await png(), "image/png");
  const prior = fixture.path();
  const failing = { ...fixture.store, writePath: async () => { throw new ReportBrandingError("unavailable", 503); } };
  await assert.rejects(saveReportBranding(failing, owner, await png(), "image/png"), ReportBrandingError);
  assert.equal(fixture.path(), prior);
  let decoded = false;
  class OversizedBlob extends Blob {
    override async arrayBuffer() { decoded = true; return new ArrayBuffer(0); }
  }
  const oversized = { ...fixture.store, download: async () => new OversizedBlob([new Uint8Array(REPORT_LOGO_OUTPUT_MAX_BYTES + 1)]) };
  await assert.rejects(loadReportLogoDataUrl(oversized, owner, validPath), ReportBrandingError);
  assert.equal(decoded, false);
});

test("branding API keeps verified auth, exact account, active customer, no-store and distributed limits", () => {
  const route = readFileSync("src/app/api/account/report-branding/route.ts", "utf8");
  assert.match(route, /await requireApiUser\(request\)/);
  assert.match(route, /error: auth\.error, code: auth\.code/);
  assert.match(route, /auth\.access\.role !== "customer"/);
  assert.match(route, /request\.headers\.get\("x-mg-expected-user-id"\) !== auth\.user\.id/);
  assert.match(route, /\.eq\("id", auth\.user\.id\)/);
  assert.match(route, /account_status \?\? "active"\) !== "active"/);
  assert.match(route, /rate\.source !== "distributed"/);
  assert.match(route, /"Cache-Control": "private, no-store, max-age=0"/);
  assert.match(route, /readReportLogoBody\(request\)/);
  assert.match(route, /saveReportBranding\(store, auth\.user\.id, bytes, contentType\)/);
  assert.doesNotMatch(route, /request\.json\(|request\.formData\(|request\.arrayBuffer\(|request\.text\(/);
  const library = readFileSync("src/lib/serviceReports/branding.ts", "utf8");
  assert.match(library, /upsert: false/);
  assert.doesNotMatch(library, /fetch\(|getPublicUrl\(|createSignedUrl\(|\.remove\(/);
});

type ApiMethod = "GET" | "POST" | "DELETE";
const routeSource = readFileSync("src/app/api/account/report-branding/route.ts", "utf8");
const routeCompiled = ts.transpileModule(routeSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function apiFixture(options: { denied?: Extract<AuthResult, { ok: false }>; role?: string; status?: string; profileError?: boolean; allowed?: boolean; distributed?: boolean } = {}) {
  const fixture = storeFixture();
  const calls: string[] = [];
  const exports: Record<string, unknown> = {};
  const admin = {
    from(table: string) {
      calls.push(`table:${table}`);
      assert.equal(table, "profiles");
      return { select(columns: string) {
        assert.equal(columns, "account_status");
        return { eq(column: string, id: string) {
          assert.equal(column, "id");
          assert.equal(id, owner);
          return { async maybeSingle() { return { data: { account_status: options.status ?? "active" }, error: options.profileError ? {} : null }; } };
        } };
      } };
    },
  };
  const modules: Record<string, unknown> = {
    "next/server": { NextResponse: { json: Response.json } },
    "@/lib/apiAuth": { requireApiUser: async () => {
      calls.push("auth");
      return options.denied ?? { ok: true, user: { id: owner }, access: { role: options.role ?? "customer" } };
    } },
    "@/lib/supabaseAdmin": { getSupabaseAdmin: () => { calls.push("admin"); return admin; } },
    "@/lib/abuseProtection": {
      checkAdaptiveRateLimit: async (config: { suffix: string; includeClientIp: boolean; limit: number }) => {
        assert.equal(config.suffix, owner);
        assert.equal(config.includeClientIp, false);
        assert.ok(config.limit === 12 || config.limit === 120);
        calls.push("rate");
        return { allowed: options.allowed ?? true, source: options.distributed === false ? "memory" : "distributed" };
      },
      rateLimitResponseHeaders: () => ({ "X-RateLimit-Limit": "synthetic" }),
    },
    "@/lib/serviceReports/branding": { ...branding, createReportBrandingStore: (receivedAdmin: unknown) => {
      assert.equal(receivedAdmin, admin);
      calls.push("store");
      return fixture.store;
    } },
  };
  runInNewContext(routeCompiled, { exports, process: { env: { NODE_ENV: "production" } }, require: (name: string) => {
    if (name in modules) return modules[name];
    throw new Error(`Unexpected route import: ${name}`);
  } });
  return { ...fixture, routeCalls: calls, routes: exports as unknown as Record<ApiMethod, (request: Request) => Promise<Response>> };
}
function apiRequest(method: ApiMethod, options: { expected?: string | null; body?: Uint8Array; contentType?: string; length?: string } = {}) {
  const headers = new Headers();
  if (options.expected !== null) headers.set("X-MG-Expected-User-Id", options.expected ?? owner);
  if (options.contentType) headers.set("Content-Type", options.contentType);
  if (options.length) headers.set("Content-Length", options.length);
  return new Request("http://localhost/api/account/report-branding", { method, headers, ...(options.body ? { body: new Uint8Array(options.body) } : {}) });
}

test("executed branding routes reject missing auth, device challenge, mismatched identity and staff before data access", async () => {
  for (const method of ["GET", "POST", "DELETE"] as const) {
    for (const status of [401, 428]) {
      const fixture = apiFixture({ denied: { ok: false, status, error: "session verification required", code: "SYNTHETIC_AUTH_CODE" } });
      const response = await fixture.routes[method](apiRequest(method));
      assert.equal(response.status, status);
      assert.deepEqual(await response.json(), { error: "session verification required", code: "SYNTHETIC_AUTH_CODE" });
      assert.deepEqual(fixture.routeCalls, ["auth"]);
      assert.match(response.headers.get("cache-control")!, /private, no-store/);
    }
    for (const expected of [null, other]) {
      const fixture = apiFixture();
      assert.equal((await fixture.routes[method](apiRequest(method, { expected }))).status, 403);
      assert.deepEqual(fixture.routeCalls, ["auth"]);
    }
    const staff = apiFixture({ role: "admin" });
    assert.equal((await staff.routes[method](apiRequest(method))).status, 403);
    assert.deepEqual(staff.routeCalls, ["auth"]);
  }
});

test("executed branding routes fail closed for inactive accounts and unavailable distributed limits", async () => {
  for (const method of ["GET", "POST", "DELETE"] as const) {
    for (const [options, expectedStatus] of [
      [{ status: "suspended" }, 403], [{ profileError: true }, 503],
      [{ distributed: false }, 503], [{ allowed: false }, 429],
    ] as const) {
      const fixture = apiFixture(options);
      const response = await fixture.routes[method](apiRequest(method));
      assert.equal(response.status, expectedStatus);
      assert.equal(fixture.routeCalls.includes("store"), false);
      assert.equal(fixture.calls.length, 0);
    }
  }
});

test("executed branding routes perform private own-account raw upload, preview and logical remove", async () => {
  const fixture = apiFixture();
  const uploaded = await fixture.routes.POST(apiRequest("POST", { body: await png(), contentType: "image/png" }));
  assert.equal(uploaded.status, 200);
  const first = await uploaded.json();
  assert.match(first.logoDataUrl, /^data:image\/png;base64,/);
  assert.ok(fixture.path() && isOwnedReportLogoPath(owner, fixture.path()));
  const preview = await fixture.routes.GET(apiRequest("GET"));
  assert.equal(preview.status, 200);
  assert.deepEqual(await preview.json(), first);
  assert.equal(preview.headers.get("x-content-type-options"), "nosniff");
  const removed = await fixture.routes.DELETE(apiRequest("DELETE"));
  assert.equal(removed.status, 200);
  assert.deepEqual(await removed.json(), { logoDataUrl: null });
  assert.equal(fixture.path(), null);
  assert.equal(fixture.objects.size, 1);
});

test("executed branding POST rejects malicious image payloads and oversized transport without storing objects", async () => {
  for (const [options, status] of [
    [{ body: Buffer.from("<svg/>"), contentType: "image/svg+xml" }, 400],
    [{ body: Buffer.from("<svg/>"), contentType: "image/png" }, 400],
    [{ body: await png(), contentType: "image/png", length: "9999999" }, 413],
  ] as const) {
    const fixture = apiFixture();
    const response = await fixture.routes.POST(apiRequest("POST", options));
    assert.equal(response.status, status);
    assert.equal(fixture.calls.length, 0);
    assert.equal(fixture.objects.size, 0);
    assert.match(response.headers.get("cache-control")!, /no-store/);
  }
});
