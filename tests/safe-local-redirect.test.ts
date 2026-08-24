import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  buildAuthCallbackPath,
  buildAuthEntryPath,
  getSafeLocalRedirectPath,
} from "../src/lib/safeLocalRedirect";

function readProjectFile(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

test("local redirect paths are canonicalized without leaving the current origin", () => {
  assert.equal(getSafeLocalRedirectPath("/dashboard"), "/dashboard");
  assert.equal(
    getSafeLocalRedirectPath("/dashboard/orders?id=42#files"),
    "/dashboard/orders?id=42#files"
  );
  assert.equal(getSafeLocalRedirectPath("/dashboard/../new-request"), "/new-request");
  assert.equal(getSafeLocalRedirectPath("/müşteri"), "/m%C3%BC%C5%9Fteri");
});

test("external, encoded-separator, backslash and control redirects fail closed", () => {
  const unsafeValues: unknown[] = [
    null,
    undefined,
    "",
    "dashboard",
    "https://evil.example",
    "javascript:alert(1)",
    "//evil.example",
    "///evil.example",
    "/\\evil.example",
    "/%5Cevil.example",
    "/%5cevil.example",
    "/%2Fevil.example",
    "/%2fevil.example",
    "/%255Cevil.example",
    "/%252Fevil.example",
    "/%2e%2e//evil.example",
    "/dashboard\nevil",
    "/dashboard\revil",
    "/dashboard\tevil",
    "/dashboard%0Aevil",
    "/dashboard%0devil",
    "/dashboard%00evil",
    "/dashboard%7fevil",
    "/dashboard%zz",
    "/dash‮board",
    `/${"a".repeat(2_048)}`,
  ];

  for (const value of unsafeValues) {
    assert.equal(getSafeLocalRedirectPath(value), null, String(value));
  }
});

test("auth entry and callback builders preserve only canonical local intent", () => {
  assert.equal(
    buildAuthEntryPath("/register", "/new-request"),
    "/register?redirect=%2Fnew-request"
  );
  assert.equal(
    buildAuthEntryPath("/login", "/dashboard/orders?id=42#files", {
      verify_email: "1",
    }),
    "/login?verify_email=1&redirect=%2Fdashboard%2Forders%3Fid%3D42%23files"
  );
  assert.equal(
    buildAuthEntryPath("/register", "https://evil.example"),
    "/register"
  );
  assert.equal(
    buildAuthCallbackPath("/new-request"),
    "/auth/callback?next=%2Fnew-request"
  );
  assert.equal(
    buildAuthCallbackPath("//evil.example"),
    "/auth/callback?next=%2Fdashboard"
  );
});

test("all query-controlled auth redirects use the shared fail-closed helper", () => {
  const sources = [
    readProjectFile("src", "app", "login", "page.tsx"),
    readProjectFile("src", "app", "register", "page.tsx"),
    readProjectFile("src", "app", "auth", "callback", "page.tsx"),
    readProjectFile("src", "app", "auth", "complete-profile", "page.tsx"),
    readProjectFile("src", "components", "auth", "DeviceVerificationPanel.tsx"),
  ];

  for (const source of sources) {
    assert.match(source, /getSafeLocalRedirectPath/);
    assert.doesNotMatch(
      source,
      /value\?\.startsWith\("\/"\)\s*&&\s*!value\.startsWith\("\/\/"\)/
    );
  }
});
