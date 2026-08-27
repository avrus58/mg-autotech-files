import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { buildAuthEntryPath } from "../src/lib/safeLocalRedirect";

function source(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

test("the secure request entry never forwards public query data into auth URLs", () => {
  assert.equal(
    buildAuthEntryPath("/register", "/new-request"),
    "/register?redirect=%2Fnew-request",
  );
  assert.equal(
    buildAuthEntryPath("/register", "https://evil.example/?email=customer@example.com&gclid=click_123"),
    "/register",
  );
});

test("the paid-traffic request entry prioritizes registration while preserving existing customer access", () => {
  const hub = source("src", "app", "file-service", "page.tsx");
  const layout = source("src", "app", "new-request", "layout.tsx");
  const authBoundary = source("src", "components", "auth", "BrowserAuthBoundary.tsx");
  const authRequired = source("src", "components", "auth", "AuthRequired.tsx");

  assert.match(hub, /href="\/new-request"/);
  assert.match(hub, /Start secure file request/);
  assert.match(layout, /unauthenticatedPrimaryAction="register"/);
  assert.match(layout, /nextPath="\/new-request"/);
  assert.match(authRequired, /buildAuthEntryPath\("\/register", nextPath\)/);
  assert.match(authRequired, /Create account and continue/);
  assert.match(authRequired, /Log in securely/);
  assert.doesNotMatch(authBoundary, /window\.location\.search|appendSafeQuery/);
  assert.doesNotMatch(hub, /gclid|gbraid|wbraid/);
});
