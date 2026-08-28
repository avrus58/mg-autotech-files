import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const registerPage = readFileSync(
  resolve(process.cwd(), "src", "app", "register", "page.tsx"),
  "utf8"
);
const loginPage = readFileSync(
  resolve(process.cwd(), "src", "app", "login", "page.tsx"),
  "utf8"
);

test("registration keeps safe requested intent through every authentication route", () => {
  assert.match(registerPage, /getSafeLocalRedirectPath\(value\)/);
  assert.match(registerPage, /getRegistrationCallbackPath\(\)/);
  assert.equal(
    registerPage.match(/getAuthRedirect\(getRegistrationCallbackPath\(\)\)/g)
      ?.length,
    2
  );
  assert.match(
    registerPage,
    /const callbackDestination = getRegistrationCallbackPath\(\);[\s\S]*if \(!replacePrivateMeasurementDocument\(callbackDestination\)\) \{[\s\S]*router\.replace\(callbackDestination\);/
  );
  assert.doesNotMatch(registerPage, /auth\/callback\?next=\/dashboard/);
  assert.match(
    registerPage,
    /href=\{buildAuthEntryPath\("\/login", requestedRedirectPath\)\}/
  );
  assert.match(
    loginPage,
    /href=\{buildAuthEntryPath\("\/register", requestedRedirectPath\)\}/
  );
});

test("registration auth bootstrap is bounded and fails soft to the form", () => {
  assert.match(registerPage, /REGISTER_AUTH_BOOTSTRAP_TIMEOUT_MS = 8_000/);
  assert.match(registerPage, /await getStableSession\(\)/);
  assert.doesNotMatch(registerPage, /supabase\.auth\.getUser\(\)/);
  assert.match(
    registerPage,
    /window\.setTimeout\([\s\S]*?setCheckingAuth\(false\)[\s\S]*?REGISTER_AUTH_BOOTSTRAP_TIMEOUT_MS/
  );
  assert.match(
    registerPage,
    /catch \{[\s\S]*?setCheckingAuth\(false\)[\s\S]*?\} finally \{[\s\S]*?clearTimeout\(failSoftTimeout\)/
  );
});

test("authentication pages fail safely when JavaScript is unavailable", () => {
  assert.match(
    loginPage,
    /<form[\s\S]*?action="\/login"[\s\S]*?method="post"[\s\S]*?onSubmit=\{handleLogin\}/
  );
  assert.doesNotMatch(loginPage, /<form[^>]*method="get"/i);
  assert.match(
    loginPage,
    /<noscript>[\s\S]*JavaScript is required for secure customer login\.[\s\S]*<\/noscript>/
  );
  assert.match(
    registerPage,
    /if \(checkingAuth\)[\s\S]*<noscript>[\s\S]*JavaScript is required for secure account registration\.[\s\S]*<\/noscript>/
  );
});
