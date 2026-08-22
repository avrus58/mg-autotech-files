import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const loginPage = readFileSync(
  resolve(process.cwd(), "src", "app", "login", "page.tsx"),
  "utf8"
);
const registerPage = readFileSync(
  resolve(process.cwd(), "src", "app", "register", "page.tsx"),
  "utf8"
);
const authBackdrop = readFileSync(
  resolve(
    process.cwd(),
    "src",
    "components",
    "auth",
    "AuthBackdrop.tsx"
  ),
  "utf8"
);

test("login and registration share the same visible auth backdrop layer", () => {
  for (const page of [loginPage, registerPage]) {
    assert.match(page, /import \{ AuthBackdrop \} from "@\/components\/auth\/AuthBackdrop"/);
    assert.match(page, /<main className="[^"]*\bisolate\b[^"]*overflow-x-hidden[^"]*"/);
    assert.match(page, /<AuthBackdrop \/>/);
    assert.match(page, /className="relative z-10 w-full max-w-\[(?:560|760)px\]/);
    assert.doesNotMatch(page, /fixed inset-0 -z-10/);
    assert.doesNotMatch(page, /<main className="[^"]*\boverflow-hidden\b/);
  }
});

test("the auth backdrop is decorative, static and unable to intercept input", () => {
  assert.match(authBackdrop, /aria-hidden="true"/);
  assert.match(authBackdrop, /pointer-events-none absolute inset-0 z-0 overflow-hidden/);
  assert.match(authBackdrop, /radial-gradient/);
  assert.match(authBackdrop, /\[background-size:48px_48px\]/);
  assert.match(authBackdrop, /\[mask-image:radial-gradient/);
  assert.doesNotMatch(
    authBackdrop,
    /\b(?:animate-|transition-|duration-|blur-|backdrop-|filter|transform\b)/
  );
});
