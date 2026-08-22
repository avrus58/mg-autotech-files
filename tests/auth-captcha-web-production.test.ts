import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  authCaptchaBlocksSubmission,
  getAuthCaptchaToken,
  resolveAuthCaptchaConfig,
} from "../src/lib/authCaptcha";

const productionSiteKey = "0x4AAAAAAAcaptchaProductionPublicKey";

test("web auth CAPTCHA remains safely off without public configuration", () => {
  const config = resolveAuthCaptchaConfig({});

  assert.equal(config.status, "off");
  assert.equal(getAuthCaptchaToken(config, null), undefined);
  assert.equal(authCaptchaBlocksSubmission(config, null), false);
});

test("required Production CAPTCHA fails closed for missing or test site keys", () => {
  const missingKey = resolveAuthCaptchaConfig({ mode: "required" });
  const productionTestKey = resolveAuthCaptchaConfig({
    mode: "required",
    siteKey: "1x00000000000000000000AA",
    nodeEnv: "production",
  });

  assert.equal(missingKey.status, "misconfigured");
  assert.equal(productionTestKey.status, "misconfigured");
  assert.equal(authCaptchaBlocksSubmission(missingKey, null), true);
  assert.throws(() => getAuthCaptchaToken(missingKey, null), /unavailable/i);
});

test("a valid Production site key requires and normalizes a fresh token", () => {
  const config = resolveAuthCaptchaConfig({
    mode: "required",
    siteKey: productionSiteKey,
    nodeEnv: "production",
  });

  assert.equal(config.status, "ready");
  assert.equal(authCaptchaBlocksSubmission(config, null), true);
  assert.equal(getAuthCaptchaToken(config, " token "), "token");
});

test("all Production web password entry points pass CAPTCHA tokens", () => {
  const login = readFileSync(resolve("src/app/login/page.tsx"), "utf8");
  const register = readFileSync(resolve("src/app/register/page.tsx"), "utf8");
  const recovery = readFileSync(
    resolve("src/app/forgot-password/page.tsx"),
    "utf8"
  );
  const passwordUpdate = readFileSync(
    resolve("src/app/reset-password/page.tsx"),
    "utf8"
  );

  assert.match(login, /signInWithPassword[\s\S]*captchaToken/);
  assert.match(login, /recordAuthLoginFailure/);
  assert.match(login, /isInvalidPasswordCredentialError/);
  assert.match(login, /clearAuthLoginFailures/);
  assert.match(login, /"always"[\s\S]*"interaction-only"/);
  assert.match(register, /signUp[\s\S]*captchaToken/);
  assert.match(register, /resend[\s\S]*captchaToken/);
  assert.match(register, /authRequestInFlightRef/);
  assert.match(recovery, /resetPasswordForEmail[\s\S]*captchaToken/);
  assert.match(passwordUpdate, /updateUser\(\{ password \}\)/);
  assert.doesNotMatch(passwordUpdate, /captchaToken/);
});

test("the browser widget uses Cloudflare Managed appearance without a secret", () => {
  const files = [
    "src/app/login/page.tsx",
    "src/app/register/page.tsx",
    "src/app/forgot-password/page.tsx",
    "src/components/auth/TurnstileChallenge.tsx",
    "src/lib/authCaptcha.ts",
    "src/lib/authLoginProtection.ts",
  ];
  const source = files
    .map((file) => readFileSync(resolve(file), "utf8"))
    .join("\n");

  assert.match(source, /challenges\.cloudflare\.com\/turnstile\/v0\/api\.js/);
  assert.match(source, /appearance={visibleCaptchaRequired \? "always" : "interaction-only"}/);
  assert.match(source, /"response-field": false/);
  assert.doesNotMatch(source, /siteverify/i);
  assert.doesNotMatch(source, /TURNSTILE_(SECRET|PRIVATE)/i);
});
