import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";

function readProjectFile(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

function filesBelow(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory() && ["node_modules", "release", "dist", ".next", ".local"].includes(entry.name)) {
      return [];
    }
    return entry.isDirectory() ? filesBelow(path) : [path];
  });
}

test("every admin API route declares a recognized server authorization guard", () => {
  const routes = filesBelow(resolve(process.cwd(), "src", "app", "api", "admin"))
    .filter((file) => file.endsWith("route.ts"));
  assert.ok(routes.length >= 40);
  for (const route of routes) {
    const source = readFileSync(route, "utf8");
    // Exact self-navigation contract: staff membership is sufficient only for
    // this read-only list of permitted hrefs. Operational routes below still
    // require their existing per-action permissions. Real route/client tests
    // additionally exercise customer denial and delegated staff permutations.
    if (route === resolve(process.cwd(), "src", "app", "api", "admin", "navigation", "route.ts")) {
      assert.match(source, /const auth = await requireApiUser\(request\)/);
      assert.match(source, /if \(!auth\.ok\) return NextResponse\.json/);
      assert.match(source, /if \(!isStaffMember\(auth\.access\)\)/);
      assert.match(source, /status: 403/);
      assert.match(source, /destinations: availableAdminDestinations\(auth\.access\)\.map\(\(item\) => item\.href\)/);
      assert.doesNotMatch(source, /export (?:async )?function (?:POST|PUT|PATCH|DELETE)|supabaseAdmin|\.from\(/);
      continue;
    }
    assert.match(
      source,
      /requireStaffPermission|requirePrimaryOwner|requireFileExpertAdmin/,
      route
    );
  }
});

test("client modules cannot import service-role, Stripe, or server email primitives", () => {
  const files = [
    ...filesBelow(resolve(process.cwd(), "src")),
    ...filesBelow(resolve(process.cwd(), "apps", "customer-uploader", "src")),
  ].filter((file) => /\.(?:ts|tsx)$/.test(file));
  const forbidden = /supabaseAdmin|SUPABASE_SERVICE_ROLE|STRIPE_SECRET|RESEND_API_KEY|@\/lib\/stripe|@\/lib\/email\/service/;
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    if (/^[\s\uFEFF]*["']use client["']/.test(source)) {
      assert.doesNotMatch(source, forbidden, file);
    }
  }
});

test("customer-owned high-risk routes authenticate before using the admin client", () => {
  for (const path of [
    ["src", "app", "api", "desktop", "upload-session", "route.ts"],
    ["src", "app", "api", "desktop", "requests", "finalize", "route.ts"],
    ["src", "app", "api", "requests", "[id]", "route.ts"],
    ["src", "app", "api", "requests", "[id]", "messages", "route.ts"],
    ["src", "app", "api", "requests", "[id]", "deliveries", "route.ts"],
    ["src", "app", "api", "requests", "[id]", "revision", "route.ts"],
  ]) {
    const source = readProjectFile(...path);
    assert.match(source, /requireApiUser\(request\)/, path.join("/"));
  }
});

test("File Expert rejects anonymous requests before initializing Supabase", () => {
  const source = readProjectFile("src", "lib", "fileExpert", "server.ts");
  assert.match(source, /requireFileExpertUser\(request: Request\)[\s\S]*requireApiUser\(request\)/);
  assert.doesNotMatch(source, /getSupabaseServer/);
  assert.match(source, /requireStaffPermission\(request, "file_expert\.manage"\)/);
});

test("desktop finalization enforces ownership, object existence, credits, and idempotency", () => {
  const source = readProjectFile("src", "app", "api", "desktop", "requests", "finalize", "route.ts");
  assert.match(source, /parsed\.data\.upload\.path !== expectedPath/);
  assert.match(source, /uploadSessionId !== desktopUploadSessionIdFor/);
  assert.match(source, /\.eq\("id", auth\.user\.id\)/);
  assert.match(source, /user_id: auth\.user\.id/);
  assert.match(source, /create_desktop_order_with_credit_deduction/);
  assert.match(source, /Uploaded file could not be verified in private storage/);
  assert.match(source, /validateDesktopCreditAccess/);
  assert.match(source, /const duplicatePrevented = rpcPayload\?\.duplicate === true/);
  assert.match(source, /if \(!duplicatePrevented\) \{[\s\S]*sendRequestCreatedNotifications/);
  assert.match(source, /approvedForLearning: false/);
});

test("Stripe webhooks verify signatures before any payment processing", () => {
  for (const path of [
    ["src", "app", "api", "stripe", "webhook", "route.ts"],
    ["src", "app", "api", "stripe", "widget-webhook", "route.ts"],
  ]) {
    const source = readProjectFile(...path);
    const signatureIndex = source.indexOf("stripe-signature");
    const constructIndex = source.indexOf("webhooks.constructEvent");
    assert.ok(signatureIndex >= 0 && constructIndex > signatureIndex, path.join("/"));
  }
});

test("login and auth callbacks reject external and protocol-relative redirects", () => {
  const login = readProjectFile("src", "app", "login", "page.tsx");
  const callback = readProjectFile("src", "app", "auth", "callback", "page.tsx");
  const redirectGuard = readProjectFile("src", "lib", "safeLocalRedirect.ts");
  assert.match(login, /getSafeLocalRedirectPath\(value\)/);
  assert.match(callback, /getSafeLocalRedirectPath\(params\.get\("next"\)\)/);
  assert.match(redirectGuard, /parsed\.origin !== LOCAL_REDIRECT_ORIGIN/);
  assert.match(redirectGuard, /UNSAFE_PERCENT_ESCAPE/);
});

test("local security smoke cannot target production or another remote host", () => {
  const source = readProjectFile("scripts", "security-smoke-local.mjs");
  assert.match(source, /isLocalSmokeUrl/);
  assert.match(source, /Security smoke is local-only/);
  assert.doesNotMatch(source, /ALLOW_NON_LOCAL_SMOKE/);
});

test("repository contains no committed live credential signatures", () => {
  const trackedSourceRoots = [
    resolve(process.cwd(), "src"),
    resolve(process.cwd(), "apps", "customer-uploader"),
    resolve(process.cwd(), "scripts"),
  ];
  const credentialPattern = /sk_live_[A-Za-z0-9]{12,}|rk_live_[A-Za-z0-9]{12,}|whsec_[A-Za-z0-9]{12,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|eyJhbGciOi[A-Za-z0-9._-]{40,}/;
  for (const root of trackedSourceRoots) {
    for (const file of filesBelow(root)) {
      if (!/\.(?:ts|tsx|js|mjs|json|md|sql|yml|yaml)$/.test(file)) continue;
      assert.doesNotMatch(readFileSync(file, "utf8"), credentialPattern, file);
    }
  }
});
