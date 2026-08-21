import * as fs from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(appRoot, "../..");
const schemaOnlyFlag = "--schema-only";
const defaultEnvFilePaths = [
  resolve(repoRoot, ".env"),
  resolve(repoRoot, ".env.local"),
  resolve(appRoot, ".env"),
  resolve(appRoot, ".env.local"),
];

const desktopEnvContract = [
  {
    key: "VITE_SUPABASE_URL",
    fallbackKeys: ["NEXT_PUBLIC_SUPABASE_URL"],
  },
  {
    key: "VITE_SUPABASE_ANON_KEY",
    fallbackKeys: ["NEXT_PUBLIC_SUPABASE_ANON_KEY"],
  },
  {
    key: "VITE_API_BASE_URL",
    defaultValue: "https://file.mgautotech.de",
  },
  {
    key: "VITE_AUTH_CAPTCHA_MODE",
    fallbackKeys: ["NEXT_PUBLIC_AUTH_CAPTCHA_MODE"],
    defaultValue: "off",
  },
  {
    key: "VITE_AUTH_CAPTCHA_CHALLENGE_URL",
    defaultValue: "https://file.mgautotech.de/desktop-auth/turnstile",
  },
];

function parseEnvSource(source) {
  const output = {};

  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2] ?? "";
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    output[match[1]] = value;
  }

  return output;
}

function parseEnvFile(path, fsModule = fs) {
  if (!fsModule.existsSync(path)) return {};
  return parseEnvSource(fsModule.readFileSync(path, "utf8"));
}

function loadDesktopEnv({ envFilePaths = defaultEnvFilePaths, fsModule = fs, processEnv = process.env } = {}) {
  const env = {};

  for (const envFilePath of envFilePaths) {
    Object.assign(env, parseEnvFile(envFilePath, fsModule));
  }

  return {
    ...env,
    ...processEnv,
  };
}

function resolveDesktopEnv(env) {
  return {
    VITE_SUPABASE_URL: env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "",
    VITE_SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    VITE_API_BASE_URL: env.VITE_API_BASE_URL || "https://file.mgautotech.de",
    VITE_AUTH_CAPTCHA_MODE:
      env.VITE_AUTH_CAPTCHA_MODE || env.NEXT_PUBLIC_AUTH_CAPTCHA_MODE || "off",
    VITE_AUTH_CAPTCHA_CHALLENGE_URL:
      env.VITE_AUTH_CAPTCHA_CHALLENGE_URL ||
      "https://file.mgautotech.de/desktop-auth/turnstile",
  };
}

function getMissingDesktopEnv(resolved) {
  const missing = Object.entries(resolved)
    .filter(([, value]) => !String(value || "").trim())
    .map(([key]) => key);
  const captchaMode = String(resolved.VITE_AUTH_CAPTCHA_MODE || "")
    .trim()
    .toLowerCase();

  if (captchaMode !== "off" && captchaMode !== "required") {
    missing.push("VITE_AUTH_CAPTCHA_MODE");
  }

  if (captchaMode === "required") {
    try {
      const challengeUrl = new URL(resolved.VITE_AUTH_CAPTCHA_CHALLENGE_URL);
      if (
        challengeUrl.origin !== "https://file.mgautotech.de" ||
        challengeUrl.pathname !== "/desktop-auth/turnstile" ||
        challengeUrl.username ||
        challengeUrl.password ||
        challengeUrl.search ||
        challengeUrl.hash
      ) {
        missing.push("VITE_AUTH_CAPTCHA_CHALLENGE_URL");
      }
    } catch {
      missing.push("VITE_AUTH_CAPTCHA_CHALLENGE_URL");
    }
  }

  return [...new Set(missing)];
}

function printSchemaOnlyReport(log = console.log) {
  log("Desktop app environment schema-only contract");

  for (const item of desktopEnvContract) {
    if (item.defaultValue) {
      log(`DEFAULT ${item.key}=${item.defaultValue}`);
      continue;
    }

    const fallback = item.fallbackKeys?.length ? ` (fallback: ${item.fallbackKeys.join(", ")})` : "";
    log(`REQ  ${item.key}${fallback}`);
  }

  log("\nUse only public browser-safe values. Never put the service-role key or server secrets into the desktop app.");
  log("Schema-only check passed. No environment files were read.");
}

function main({
  argv = process.argv.slice(2),
  envFilePaths = defaultEnvFilePaths,
  fsModule = fs,
  processEnv = process.env,
  log = console.log,
  error = console.error,
} = {}) {
  if (argv.includes(schemaOnlyFlag)) {
    printSchemaOnlyReport(log);
    return 0;
  }

  const env = loadDesktopEnv({ envFilePaths, fsModule, processEnv });
  const resolved = resolveDesktopEnv(env);
  const missing = getMissingDesktopEnv(resolved);

  if (missing.length > 0) {
    error("Missing desktop app environment variables. Create apps/customer-uploader/.env.local based on .env.example.");
    error(`Missing: ${missing.join(", ")}`);
    error("Use only the public Supabase anon key. Never put the service-role key into the desktop app.");
    return 1;
  }

  log("Desktop app environment looks ready.");
  return 0;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const exitCode = main();

  if (exitCode > 0) {
    process.exit(exitCode);
  }
}

export {
  desktopEnvContract as DESKTOP_ENV_CONTRACT,
  getMissingDesktopEnv,
  loadDesktopEnv,
  main,
  parseEnvFile,
  parseEnvSource,
  printSchemaOnlyReport,
  resolveDesktopEnv,
};
