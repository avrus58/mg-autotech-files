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

test("the paid-traffic request entry preserves route choice and protects authenticated request access", () => {
  const hub = source("src", "app", "file-service", "page.tsx");
  const layout = source("src", "app", "new-request", "layout.tsx");
  const requestAccess = source("src", "app", "new-request", "NewRequestAccessBoundary.tsx");
  const authBoundary = source("src", "components", "auth", "BrowserAuthBoundary.tsx");
  const authRequired = source("src", "components", "auth", "AuthRequired.tsx");

  assert.match(
    hub,
    /href="\/new-request"[\s\S]*data-acquisition-primary-cta[\s\S]*Create account &amp; start request/
  );
  assert.match(hub, /href="#request-route"[\s\S]*Choose service first/);
  assert.match(layout, /<NewRequestAccessBoundary>\{children\}<\/NewRequestAccessBoundary>/);
  assert.match(requestAccess, /unauthenticatedPrimaryAction="register"/);
  assert.match(requestAccess, /buildNewRequestPath\(parseRequestIntent\(searchParams\.get\("intent"\)\)\)/);
  assert.match(requestAccess, /nextPath=\{nextPath\}/);
  assert.match(authRequired, /buildAuthEntryPath\("\/register", nextPath\)/);
  assert.match(authRequired, /Create account and continue/);
  assert.match(authRequired, /Log in securely/);
  assert.doesNotMatch(authBoundary, /window\.location\.search|appendSafeQuery/);
  assert.doesNotMatch(hub, /gclid|gbraid|wbraid/);
});

test("registration outcomes replace the long form and move focus to a visible status panel", () => {
  const register = source("src", "app", "register", "page.tsx");

  assert.match(register, /const statusPanelRef = useRef<HTMLDivElement>\(null\)/);
  assert.match(
    register,
    /statusPanelRef\.current\?\.focus\(\{ preventScroll: true \}\)[\s\S]*statusPanelRef\.current\?\.scrollIntoView/
  );
  assert.match(register, /ref=\{statusPanelRef\}[\s\S]*Verify your e-mail to continue/);
  assert.match(register, /hidden=\{success\}[\s\S]*<StepProgress/);
  assert.match(register, /hidden=\{success\}[\s\S]*aria-labelledby="register-step-heading"/);
});
