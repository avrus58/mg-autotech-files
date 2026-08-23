import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import {
  authCaptchaBlocksSubmission,
  getAuthCaptchaToken,
  resolveAuthCaptchaConfig,
} from "../src/lib/authCaptcha";

const productionSiteKey = "0x4AAAAAAAcaptchaProductionPublicKey";

async function loadReadinessChecker() {
  const url = pathToFileURL(
    resolve(process.cwd(), "scripts/check-auth-captcha-readiness.mjs")
  );
  return import(`${url.href}?test=${Date.now()}-${Math.random()}`);
}

async function loadDesktopEnvChecker() {
  const url = pathToFileURL(
    resolve(process.cwd(), "apps/customer-uploader/scripts/check-env.mjs")
  );
  return import(`${url.href}?captcha-test=${Date.now()}-${Math.random()}`);
}

function readyReleaseEnvironment() {
  return {
    NEXT_PUBLIC_AUTH_CAPTCHA_MODE: "required",
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: productionSiteKey,
    VITE_AUTH_CAPTCHA_MODE: "required",
    VITE_AUTH_CAPTCHA_CHALLENGE_URL:
      "https://file.mgautotech.de/desktop-auth/turnstile",
    VITE_APP_VERSION: "0.2.1",
    DESKTOP_APP_LATEST_VERSION: "0.2.1",
    DESKTOP_APP_MIN_VERSION: "0.2.1",
    AUTH_CAPTCHA_WEB_RELEASE_VERIFIED: "true",
    AUTH_CAPTCHA_DESKTOP_RELEASE_VERIFIED: "true",
    AUTH_CAPTCHA_DESKTOP_MINIMUM_VERSION_ENFORCED: "true",
    AUTH_CAPTCHA_TURNSTILE_HOSTNAME_VERIFIED: "true",
  };
}

test("auth CAPTCHA stays off when public configuration is absent", () => {
  const config = resolveAuthCaptchaConfig({});
  assert.equal(config.status, "off");
  assert.equal(getAuthCaptchaToken(config, null), undefined);
  assert.equal(authCaptchaBlocksSubmission(config, null), false);
});

test("required auth CAPTCHA fails closed for missing, invalid and Production test keys", () => {
  const missingKey = resolveAuthCaptchaConfig({ mode: "required" });
  const invalidMode = resolveAuthCaptchaConfig({
    mode: "requiredd",
    siteKey: productionSiteKey,
  });
  const productionTestKey = resolveAuthCaptchaConfig({
    mode: "required",
    siteKey: "1x00000000000000000000AA",
    nodeEnv: "production",
  });

  assert.equal(missingKey.status, "misconfigured");
  assert.equal(invalidMode.status, "misconfigured");
  assert.equal(productionTestKey.status, "misconfigured");
  assert.equal(authCaptchaBlocksSubmission(missingKey, null), true);
  assert.throws(() => getAuthCaptchaToken(missingKey, null), /unavailable/i);
});

test("hosted web builds reject Turnstile test keys without a public bypass", () => {
  const hosted = resolveAuthCaptchaConfig({
    mode: "required",
    siteKey: "1x00000000000000000000AA",
    nodeEnv: "production",
  });
  assert.equal(hosted.status, "misconfigured");
  assert.equal(authCaptchaBlocksSubmission(hosted, "token"), true);
  assert.throws(() => getAuthCaptchaToken(hosted, "token"), /unavailable/i);
});

test("all active Supabase CAPTCHA auth clients pass a fresh token", () => {
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
  const desktop = readFileSync(
    resolve("apps/customer-uploader/src/App.tsx"),
    "utf8"
  );

  assert.match(login, /signInWithPassword[\s\S]*captchaToken/);
  assert.match(login, /\.finally\(\(\) =>/);
  assert.match(login, /recordAuthLoginFailure/);
  assert.match(login, /isInvalidPasswordCredentialError/);
  assert.match(login, /clearAuthLoginFailures/);
  assert.match(login, /role="alert"[\s\S]*AUTH_CAPTCHA_REQUIRED_MESSAGE/);
  assert.match(login, /captchaEscalationNoticeRef\.current\?\.focus\(\)/);
  assert.match(login, /"always"[\s\S]*"interaction-only"/);
  assert.match(register, /signUp[\s\S]*captchaToken/);
  assert.match(register, /resend[\s\S]*captchaToken/);
  assert.match(register, /authRequestInFlightRef/);
  assert.match(register, /changeStep[\s\S]*setCaptchaToken\(null\)/);
  assert.match(recovery, /resetPasswordForEmail[\s\S]*captchaToken/);
  assert.match(desktop, /getDesktopAuthCaptchaToken/);
  assert.match(desktop, /signInWithPassword\([\s\S]*captchaToken/);
  assert.match(passwordUpdate, /updateUser\(\{ password \}\)/);
  assert.doesNotMatch(passwordUpdate, /captchaToken/);
});

test("web password login uses Cloudflare interaction-only mode before escalation", () => {
  const widget = readFileSync(
    resolve("src/components/auth/TurnstileChallenge.tsx"),
    "utf8"
  );
  const loginProtection = readFileSync(
    resolve("src/lib/authLoginProtection.ts"),
    "utf8"
  );

  assert.match(widget, /appearance:\s*TurnstileAppearance/);
  assert.match(widget, /"response-field":\s*false/);
  assert.match(widget, /"before-interactive-callback"/);
  assert.match(widget, /"after-interactive-callback"/);
  assert.match(loginProtection, /AUTH_LOGIN_FAILURE_THRESHOLD\s*=\s*5/);
  assert.match(loginProtection, /AUTH_LOGIN_FAILURE_WINDOW_MS\s*=\s*15\s*\*\s*60/);
  assert.match(loginProtection, /AUTH_LOGIN_FAILURE_STORAGE_KEY/);
  assert.doesNotMatch(loginProtection, /email|password\s*:/i);
});

test("Electron CAPTCHA handoff is one-shot, state-bound and restricted to canonical HTTPS", () => {
  const main = readFileSync(
    resolve("apps/customer-uploader/electron/main.ts"),
    "utf8"
  );
  const captchaPreload = readFileSync(
    resolve("apps/customer-uploader/electron/captcha-preload.ts"),
    "utf8"
  );
  const hostedPage = readFileSync(
    resolve("src/app/desktop-auth/turnstile/page.tsx"),
    "utf8"
  );

  assert.match(main, /randomBytes\(32\)\.toString\("hex"\)/);
  assert.match(main, /event\.senderFrame !== event\.sender\.mainFrame/);
  assert.match(main, /parentWindow !== primaryWindow/);
  assert.match(main, /url\.origin === "https:\/\/file\.mgautotech\.de"/);
  assert.match(main, /desktopCaptchaTokenMaxLength = 2_048/);
  assert.match(main, /desktopCaptchaTimeoutMs = 270_000/);
  assert.match(main, /setWindowOpenHandler\(\(\) => \(\{ action: "deny" \}\)\)/);
  assert.match(main, /setPermissionRequestHandler/);
  assert.match(main, /setPermissionCheckHandler/);
  assert.match(main, /pending\.cleanup\(\)/);
  assert.match(main, /removeListener\("destroyed", handleRequesterDestroyed\)/);
  assert.match(main, /partition: "mg-auth-captcha"/);
  assert.match(captchaPreload, /contextBridge\.exposeInMainWorld\("mgCaptcha"/);
  assert.match(hostedPage, /\^\[a-f0-9\]\{64\}\$/);
  assert.match(hostedPage, /window\.location\.hash/);
  assert.doesNotMatch(main, /searchParams\.set\([^\n]*token|hash[^\n]*token/i);
});

test("CAPTCHA clients never contain the Turnstile secret or call Siteverify", () => {
  const files = [
    "src/lib/authCaptcha.ts",
    "src/components/auth/TurnstileChallenge.tsx",
    "src/app/desktop-auth/turnstile/page.tsx",
    "apps/customer-uploader/electron/main.ts",
    "apps/customer-uploader/electron/captcha-preload.ts",
    "apps/customer-uploader/src/api.ts",
  ];
  const source = files.map((file) => readFileSync(resolve(file), "utf8")).join("\n");
  assert.doesNotMatch(source, /TURNSTILE_SECRET|siteverify/i);
});

test("remote CAPTCHA readiness stays safe-off by default and blocks partial activation", async () => {
  const checker = await loadReadinessChecker();
  const safeOff = checker.evaluateAuthCaptchaReadiness({
    env: {},
    rootDir: process.cwd(),
  });
  assert.equal(safeOff.activationRequested, false);
  assert.equal(safeOff.ready, false);
  assert.equal(safeOff.safeToKeepRemoteCaptchaDisabled, true);
  assert.deepEqual(safeOff.blocking, []);

  const partial = checker.evaluateAuthCaptchaReadiness({
    env: {
      NEXT_PUBLIC_AUTH_CAPTCHA_MODE: "required",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: productionSiteKey,
    },
    rootDir: process.cwd(),
    requireReady: true,
  });
  assert.equal(partial.ready, false);
  assert.match(partial.blocking.join("\n"), /Desktop CAPTCHA mode/);
  assert.match(partial.blocking.join("\n"), /minimum desktop version/i);
});

test("remote CAPTCHA readiness requires the unique 0.2.1 desktop adoption gate", async () => {
  const checker = await loadReadinessChecker();
  const ready = checker.evaluateAuthCaptchaReadiness({
    env: readyReleaseEnvironment(),
    rootDir: process.cwd(),
    requireReady: true,
  });
  assert.equal(ready.ready, true);

  const oldVersion = checker.evaluateAuthCaptchaReadiness({
    env: { ...readyReleaseEnvironment(), DESKTOP_APP_MIN_VERSION: "0.2.0" },
    rootDir: process.cwd(),
    requireReady: true,
  });
  assert.equal(oldVersion.ready, false);
  assert.match(oldVersion.blocking.join("\n"), /minimum desktop version/i);
});

test("desktop required mode rejects non-canonical ports and preserves off default", async () => {
  const checker = await loadDesktopEnvChecker();
  const off = checker.resolveDesktopEnv({
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-key",
  });
  assert.equal(off.VITE_AUTH_CAPTCHA_MODE, "off");
  assert.deepEqual(checker.getMissingDesktopEnv(off), []);

  const invalidPort = {
    ...off,
    VITE_AUTH_CAPTCHA_MODE: "required",
    VITE_AUTH_CAPTCHA_CHALLENGE_URL:
      "https://file.mgautotech.de:444/desktop-auth/turnstile",
  };
  assert.deepEqual(checker.getMissingDesktopEnv(invalidPort), [
    "VITE_AUTH_CAPTCHA_CHALLENGE_URL",
  ]);
});
