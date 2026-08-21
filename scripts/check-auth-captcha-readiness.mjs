import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const canonicalChallengeUrl =
  "https://file.mgautotech.de/desktop-auth/turnstile";
const captchaCapableDesktopVersion = "0.2.1";
const turnstileTestSiteKeys = new Set([
  "1x00000000000000000000AA",
  "2x00000000000000000000AB",
  "1x00000000000000000000BB",
  "2x00000000000000000000BB",
  "3x00000000000000000000FF",
]);

const sourceContracts = [
  {
    file: "src/app/login/page.tsx",
    markers: ["signInWithPassword", "captchaToken", "TurnstileChallenge"],
  },
  {
    file: "src/app/register/page.tsx",
    markers: ["signUp", "resend", "captchaToken", "TurnstileChallenge"],
  },
  {
    file: "src/app/forgot-password/page.tsx",
    markers: ["resetPasswordForEmail", "captchaToken", "TurnstileChallenge"],
  },
  {
    file: "src/app/desktop-auth/turnstile/page.tsx",
    markers: ["mgCaptcha", "auth_login", "TurnstileChallenge"],
  },
  {
    file: "apps/customer-uploader/src/App.tsx",
    markers: ["getDesktopAuthCaptchaToken", "signInWithPassword", "captchaToken"],
  },
  {
    file: "apps/customer-uploader/electron/main.ts",
    markers: [
      "randomBytes(32)",
      "event.senderFrame !== event.sender.mainFrame",
      "desktopCaptchaTimeoutMs = 270_000",
      "desktopCaptchaTokenMaxLength = 2_048",
    ],
  },
];

function isTrue(value) {
  return value === "1" || value?.toLowerCase() === "true";
}

function verifySourceContracts(rootDir = repoRoot) {
  const blocking = [];
  for (const contract of sourceContracts) {
    const path = resolve(rootDir, contract.file);
    if (!existsSync(path)) {
      blocking.push(`Missing CAPTCHA client source: ${contract.file}`);
      continue;
    }
    const source = readFileSync(path, "utf8");
    for (const marker of contract.markers) {
      if (!source.includes(marker)) {
        blocking.push(`Incomplete CAPTCHA client contract: ${contract.file}`);
        break;
      }
    }
  }
  return blocking;
}

function evaluateAuthCaptchaReadiness({
  env = process.env,
  rootDir = repoRoot,
  requireReady = false,
} = {}) {
  const activationRequested =
    requireReady || isTrue(env.SUPABASE_AUTH_CAPTCHA_ENABLE_REQUESTED);
  const blocking = verifySourceContracts(rootDir);

  if (!activationRequested) {
    return {
      activationRequested: false,
      ready: false,
      blocking,
      safeToKeepRemoteCaptchaDisabled: true,
    };
  }

  if (env.NEXT_PUBLIC_AUTH_CAPTCHA_MODE?.trim().toLowerCase() !== "required") {
    blocking.push("Web CAPTCHA mode is not required.");
  }

  const siteKey = env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";
  if (
    !/^0x[A-Za-z0-9_-]{20,100}$/.test(siteKey) ||
    turnstileTestSiteKeys.has(siteKey)
  ) {
    blocking.push("A non-test Turnstile site key is required for Production.");
  }
  if (isTrue(env.NEXT_PUBLIC_AUTH_CAPTCHA_ALLOW_TEST_KEY)) {
    blocking.push("Turnstile test-key allowance must be disabled for Production.");
  }

  if (env.VITE_AUTH_CAPTCHA_MODE?.trim().toLowerCase() !== "required") {
    blocking.push("Desktop CAPTCHA mode is not required.");
  }
  if (env.VITE_AUTH_CAPTCHA_CHALLENGE_URL?.trim() !== canonicalChallengeUrl) {
    blocking.push("Desktop CAPTCHA challenge URL is not canonical HTTPS.");
  }
  if (env.VITE_APP_VERSION?.trim() !== captchaCapableDesktopVersion) {
    blocking.push("CAPTCHA-capable desktop build version is not 0.2.1.");
  }
  if (env.DESKTOP_APP_LATEST_VERSION?.trim() !== captchaCapableDesktopVersion) {
    blocking.push("Server latest desktop version is not 0.2.1.");
  }
  if (env.DESKTOP_APP_MIN_VERSION?.trim() !== captchaCapableDesktopVersion) {
    blocking.push("Server minimum desktop version is not enforced at 0.2.1.");
  }

  const releaseReceipts = [
    ["AUTH_CAPTCHA_WEB_RELEASE_VERIFIED", "Web CAPTCHA release is not verified."],
    [
      "AUTH_CAPTCHA_DESKTOP_RELEASE_VERIFIED",
      "Desktop CAPTCHA release is not verified.",
    ],
    [
      "AUTH_CAPTCHA_DESKTOP_MINIMUM_VERSION_ENFORCED",
      "CAPTCHA-capable desktop minimum version is not enforced.",
    ],
    [
      "AUTH_CAPTCHA_TURNSTILE_HOSTNAME_VERIFIED",
      "Turnstile hostname configuration is not verified.",
    ],
  ];
  for (const [key, message] of releaseReceipts) {
    if (!isTrue(env[key])) blocking.push(message);
  }

  return {
    activationRequested: true,
    ready: blocking.length === 0,
    blocking,
    safeToKeepRemoteCaptchaDisabled: true,
  };
}

function printSchemaOnlyReport(log = console.log) {
  log("Supabase Auth CAPTCHA release schema-only contract");
  log("PUBLIC NEXT_PUBLIC_AUTH_CAPTCHA_MODE=required");
  log("PUBLIC NEXT_PUBLIC_TURNSTILE_SITE_KEY=<Cloudflare public site key>");
  log("PUBLIC VITE_AUTH_CAPTCHA_MODE=required");
  log(`PUBLIC VITE_AUTH_CAPTCHA_CHALLENGE_URL=${canonicalChallengeUrl}`);
  log(`PUBLIC VITE_APP_VERSION=${captchaCapableDesktopVersion}`);
  log(`SERVER DESKTOP_APP_LATEST_VERSION=${captchaCapableDesktopVersion}`);
  log(`SERVER DESKTOP_APP_MIN_VERSION=${captchaCapableDesktopVersion}`);
  log("RECEIPT AUTH_CAPTCHA_WEB_RELEASE_VERIFIED=true");
  log("RECEIPT AUTH_CAPTCHA_DESKTOP_RELEASE_VERIFIED=true");
  log("RECEIPT AUTH_CAPTCHA_DESKTOP_MINIMUM_VERSION_ENFORCED=true");
  log("RECEIPT AUTH_CAPTCHA_TURNSTILE_HOSTNAME_VERIFIED=true");
  log("No environment files or secret values were read.");
  log("The Turnstile secret belongs only in Supabase/Cloudflare configuration.");
}

function main({
  argv = process.argv.slice(2),
  env = process.env,
  rootDir = repoRoot,
  log = console.log,
  error = console.error,
} = {}) {
  if (argv.includes("--schema-only")) {
    printSchemaOnlyReport(log);
    return 0;
  }

  const result = evaluateAuthCaptchaReadiness({
    env,
    rootDir,
    requireReady: argv.includes("--require-ready"),
  });

  if (!result.activationRequested) {
    if (result.blocking.length > 0) {
      error("CAPTCHA source readiness check failed. Keep Supabase Auth CAPTCHA disabled.");
      for (const item of result.blocking) error(`BLOCK ${item}`);
      return 1;
    }
    log("SAFE: Supabase Auth CAPTCHA activation was not requested; remote toggle must remain disabled.");
    return 0;
  }

  if (!result.ready) {
    error("BLOCKED: Supabase Auth CAPTCHA must not be enabled.");
    for (const item of result.blocking) error(`BLOCK ${item}`);
    return 1;
  }

  log("READY: all client/configuration receipts are present for a separately authorized remote CAPTCHA enablement.");
  return 0;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) process.exitCode = main();

export {
  canonicalChallengeUrl as CANONICAL_CHALLENGE_URL,
  evaluateAuthCaptchaReadiness,
  main,
  printSchemaOnlyReport,
  sourceContracts as SOURCE_CONTRACTS,
  verifySourceContracts,
};
