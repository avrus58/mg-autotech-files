#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import {
  chmod,
  link,
  lstat,
  open,
  unlink,
} from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const INPUT_MAX_BYTES = 256 * 1024;
const ENV_FILE_MAX_BYTES = 256 * 1024;
const ENV_VALUE_MAX_BYTES = 16 * 1024;
const ENV_VARIABLE_MAX_COUNT = 128;
const PRODUCTION_SUPABASE_URL =
  "https://jujaeyvyaeesmipihrrw.supabase.co";
const PRODUCTION_SUPABASE_HOST = "jujaeyvyaeesmipihrrw.supabase.co";
const PARTIAL_EXPORT_KIND = "mg-file-service-partial-env";

export const PRODUCTION_APP_ENV_ALLOWLIST = Object.freeze([
  "ADMIN_NOTIFICATION_EMAIL",
  "AI_PROVIDER",
  "BAIDU_SITE_VERIFICATION",
  "BASE_URL",
  "BING_SITE_VERIFICATION",
  "CUSTOMER_DEVICE_HMAC_SECRET",
  "DESKTOP_APP_ALLOWED_MODULES",
  "DESKTOP_APP_LATEST_VERSION",
  "DESKTOP_APP_MAINTENANCE_MODE",
  "DESKTOP_APP_MESSAGE_EN",
  "DESKTOP_APP_MIN_VERSION",
  "DESKTOP_APP_RELEASE_CHANNEL",
  "DESKTOP_APP_RELEASE_NOTES_URL",
  "DESKTOP_APP_SIGNING_STATUS",
  "DESKTOP_APP_UPDATE_URL",
  "DESKTOP_APP_UPLOAD_ENABLED",
  "DESKTOP_UPLOAD_ENABLED",
  "EMAIL_DRY_RUN",
  "EMAIL_FROM",
  "EMAIL_TO",
  "FILE_EXPERT_ANALYZER_DISTRIBUTED_ADMISSION_ENABLED",
  "FILE_EXPERT_ANALYZER_GLOBAL_CONCURRENCY",
  "FILE_EXPERT_ANALYZER_TOKEN",
  "GOOGLE_ANALYTICS_PROPERTY_ID",
  "GOOGLE_SEARCH_CONSOLE_SITE_URL",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
  "GROWTH_ATTRIBUTION_HMAC_SECRET",
  "KV_REST_API_TOKEN",
  "KV_REST_API_URL",
  "LOCAL_AI_API_KEY",
  "LOCAL_AI_BASE_URL",
  "LOCAL_AI_MODEL",
  "NAVER_SITE_VERIFICATION",
  "NEXT_PUBLIC_AUTH_CAPTCHA_ALLOW_TEST_KEY",
  "NEXT_PUBLIC_AUTH_CAPTCHA_MODE",
  "NEXT_PUBLIC_BANK_ACCOUNT_NAME",
  "NEXT_PUBLIC_BANK_BIC",
  "NEXT_PUBLIC_BANK_IBAN",
  "NEXT_PUBLIC_BANK_NAME",
  "NEXT_PUBLIC_GOOGLE_ADS_ID",
  "NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL",
  "NEXT_PUBLIC_GOOGLE_ADS_REGISTRATION_LABEL",
  "NEXT_PUBLIC_GOOGLE_ADS_REQUEST_LABEL",
  "NEXT_PUBLIC_GOOGLE_ANALYTICS_ID",
  "NEXT_PUBLIC_GOOGLE_CLIENT_ID",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "NEXT_PUBLIC_WHATSAPP_NUMBER",
  "OLLAMA_BASE_URL",
  "OLLAMA_MODEL",
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "OPENAI_MODEL",
  "REQUEST_NETWORK_PROVIDER",
  "REQUEST_NETWORK_PROXY_SECRET",
  "RESEND_API_KEY",
  "RESEND_WEBHOOK_SECRET",
  "SECURITY_DISTRIBUTED_RATE_LIMIT_ENABLED",
  "SECURITY_DISTRIBUTED_RATE_LIMIT_REQUIRED",
  "SECURITY_RATE_LIMIT_SALT",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_WIDGET_WEBHOOK_SECRET",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPPORT_EMAIL",
  "UPSTASH_REDIS_REST_TOKEN",
  "UPSTASH_REDIS_REST_URL",
  "UPLOAD_INTEGRITY_SECRET",
  "VLLM_API_KEY",
  "VLLM_BASE_URL",
  "VLLM_MODEL",
  "WIDGET_IP_HASH_SALT",
  "WIDGET_SESSION_SECRET",
  "YANDEX_SITE_VERIFICATION",
]);

const APP_ENV_ALLOWLIST = new Set(PRODUCTION_APP_ENV_ALLOWLIST);
const PARTIAL_OVERRIDE_KEYS = Object.freeze([
  "CUSTOMER_DEVICE_HMAC_SECRET",
  "FILE_EXPERT_ANALYZER_TOKEN",
  "REQUEST_NETWORK_PROVIDER",
  "REQUEST_NETWORK_PROXY_SECRET",
  "SECURITY_DISTRIBUTED_RATE_LIMIT_ENABLED",
  "SECURITY_DISTRIBUTED_RATE_LIMIT_REQUIRED",
  "FILE_EXPERT_ANALYZER_DISTRIBUTED_ADMISSION_ENABLED",
  "FILE_EXPERT_ANALYZER_GLOBAL_CONCURRENCY",
]);
const FIXED_PARTIAL_VALUES = Object.freeze({
  REQUEST_NETWORK_PROVIDER: "cloudflare-caddy",
  SECURITY_DISTRIBUTED_RATE_LIMIT_ENABLED: "true",
  SECURITY_DISTRIBUTED_RATE_LIMIT_REQUIRED: "true",
  FILE_EXPERT_ANALYZER_DISTRIBUTED_ADMISSION_ENABLED: "true",
  FILE_EXPERT_ANALYZER_GLOBAL_CONCURRENCY: "1",
});
const TURNSTILE_TEST_KEYS = new Set([
  "1x00000000000000000000AA",
  "2x00000000000000000000AB",
  "1x00000000000000000000BB",
  "2x00000000000000000000BB",
  "3x00000000000000000000FF",
]);

function fail() {
  throw new Error("Invalid Production environment input.");
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value, expectedKeys) {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function assertCanonicalTimestamp(value) {
  if (typeof value !== "string") fail();
  let normalized;
  try {
    normalized = new Date(value).toISOString();
  } catch {
    fail();
  }
  if (normalized !== value) fail();
}

function validateEnvironmentRecord(value) {
  if (!isRecord(value)) fail();
  const entries = Object.entries(value);
  if (entries.length === 0 || entries.length > ENV_VARIABLE_MAX_COUNT) fail();

  const result = Object.create(null);
  for (const [key, variableValue] of entries) {
    if (
      !/^[A-Z][A-Z0-9_]{0,127}$/.test(key) ||
      !APP_ENV_ALLOWLIST.has(key) ||
      typeof variableValue !== "string" ||
      variableValue.length === 0 ||
      variableValue.trim().length === 0 ||
      Buffer.byteLength(variableValue, "utf8") > ENV_VALUE_MAX_BYTES ||
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(variableValue)
    ) {
      fail();
    }
    result[key] = variableValue;
  }
  return result;
}

export function parseFullExport(source) {
  if (
    typeof source !== "string" ||
    Buffer.byteLength(source, "utf8") <= 0 ||
    Buffer.byteLength(source, "utf8") > INPUT_MAX_BYTES
  ) {
    fail();
  }
  let payload;
  try {
    payload = JSON.parse(source);
  } catch {
    fail();
  }
  if (
    !hasExactKeys(payload, ["version", "generatedAt", "variables"]) ||
    payload.version !== 1
  ) {
    fail();
  }
  assertCanonicalTimestamp(payload.generatedAt);
  return validateEnvironmentRecord(payload.variables);
}

export function parsePartialExport(source) {
  if (
    typeof source !== "string" ||
    Buffer.byteLength(source, "utf8") <= 0 ||
    Buffer.byteLength(source, "utf8") > INPUT_MAX_BYTES
  ) {
    fail();
  }
  let payload;
  try {
    payload = JSON.parse(source);
  } catch {
    fail();
  }

  if (hasExactKeys(payload, ["variables"])) {
    return validateEnvironmentRecord(payload.variables);
  }
  if (hasExactKeys(payload, ["kind", "createdAt", "values"])) {
    if (payload.kind !== PARTIAL_EXPORT_KIND) fail();
    assertCanonicalTimestamp(payload.createdAt);
    return validateEnvironmentRecord(payload.values);
  }
  return validateEnvironmentRecord(payload);
}

function assertNoTestConfiguration(environment) {
  if (
    environment.NEXT_PUBLIC_AUTH_CAPTCHA_ALLOW_TEST_KEY !== undefined &&
    environment.NEXT_PUBLIC_AUTH_CAPTCHA_ALLOW_TEST_KEY !== "false"
  ) {
    fail();
  }
  if (TURNSTILE_TEST_KEYS.has(environment.NEXT_PUBLIC_TURNSTILE_SITE_KEY)) {
    fail();
  }
  if (
    environment.STRIPE_SECRET_KEY?.startsWith("sk_test_") ||
    environment.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith("pk_test_")
  ) {
    fail();
  }
}

export function mergeProductionEnvironment(fullEnvironment, partialEnvironment) {
  const full = validateEnvironmentRecord(fullEnvironment);
  const partial = validateEnvironmentRecord(partialEnvironment);
  const merged = Object.assign(Object.create(null), partial, full);

  for (const key of PARTIAL_OVERRIDE_KEYS) {
    if (partial[key] === undefined) fail();
    merged[key] = partial[key];
  }
  for (const [key, expectedValue] of Object.entries(FIXED_PARTIAL_VALUES)) {
    if (partial[key] !== expectedValue) fail();
  }
  if (merged.NEXT_PUBLIC_SUPABASE_URL !== PRODUCTION_SUPABASE_URL) fail();

  assertNoTestConfiguration(merged);
  return merged;
}

export function quoteComposeEnvironmentValue(value) {
  if (typeof value !== "string" || value.length === 0) fail();
  return `"${value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\$/g, "$$$$")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")}"`;
}

function renderEnvironmentRecord(environment) {
  const entries = Object.entries(environment).sort(([left], [right]) =>
    left.localeCompare(right, "en")
  );
  const content = `${entries
    .map(([key, value]) => `${key}=${quoteComposeEnvironmentValue(value)}`)
    .join("\n")}\n`;
  if (Buffer.byteLength(content, "utf8") > ENV_FILE_MAX_BYTES) fail();
  return content;
}

export function renderProductionEnvironmentFiles(fullSource, partialSource) {
  const environment = mergeProductionEnvironment(
    parseFullExport(fullSource),
    parsePartialExport(partialSource)
  );
  const analyzerEnvironment = {
    FILE_EXPERT_ANALYZER_ALLOWED_HOSTS: PRODUCTION_SUPABASE_HOST,
    FILE_EXPERT_ANALYZER_MAX_SOURCE_BYTES: "33554432",
    FILE_EXPERT_ANALYZER_TIMEOUT_SECONDS: "20",
    FILE_EXPERT_ANALYZER_TOKEN: environment.FILE_EXPERT_ANALYZER_TOKEN,
  };
  return {
    appContent: renderEnvironmentRecord(environment),
    appKeyCount: Object.keys(environment).length,
    analyzerContent: renderEnvironmentRecord(analyzerEnvironment),
    analyzerKeyCount: Object.keys(analyzerEnvironment).length,
  };
}

export function assertProtectedInputMetadata(metadata) {
  if (
    !metadata.isFile() ||
    metadata.size <= 0 ||
    metadata.size > INPUT_MAX_BYTES ||
    metadata.uid !== 0 ||
    metadata.gid !== 0 ||
    (metadata.mode & 0o7777) !== 0o600
  ) {
    fail();
  }
}

async function readProtectedInput(path) {
  if (
    process.platform !== "linux" ||
    typeof process.getuid !== "function" ||
    process.getuid() !== 0 ||
    !fsConstants.O_NOFOLLOW
  ) {
    fail();
  }
  const handle = await open(path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  try {
    const metadata = await handle.stat();
    assertProtectedInputMetadata(metadata);
    const content = await handle.readFile();
    if (content.byteLength <= 0 || content.byteLength > INPUT_MAX_BYTES) {
      content.fill(0);
      fail();
    }
    return { content, metadata };
  } finally {
    await handle.close();
  }
}

async function assertProtectedOutputParent(outputPath) {
  const parent = dirname(outputPath);
  const metadata = await lstat(parent);
  if (
    !metadata.isDirectory() ||
    metadata.uid !== 0 ||
    metadata.gid !== 0 ||
    (metadata.mode & 0o022) !== 0
  ) {
    fail();
  }
  try {
    await lstat(outputPath);
    fail();
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

async function createProtectedTemporaryFile(outputPath, content) {
  const temporaryPath = resolve(
    dirname(outputPath),
    `.${basename(outputPath)}.${process.pid}.${randomBytes(12).toString("hex")}.tmp`
  );
  const handle = await open(
    temporaryPath,
    fsConstants.O_CREAT |
      fsConstants.O_EXCL |
      fsConstants.O_WRONLY |
      fsConstants.O_NOFOLLOW,
    0o600
  );
  try {
    await handle.writeFile(content);
    await handle.sync();
    await handle.chmod(0o600);
  } finally {
    await handle.close();
  }
  return temporaryPath;
}

async function syncParent(path) {
  const handle = await open(
    dirname(path),
    fsConstants.O_RDONLY | (fsConstants.O_DIRECTORY ?? 0)
  );
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function writeProtectedEnvironmentPair(
  appOutputPathInput,
  analyzerOutputPathInput,
  appContent,
  analyzerContent
) {
  const appOutputPath = resolve(appOutputPathInput);
  const analyzerOutputPath = resolve(analyzerOutputPathInput);
  if (appOutputPath === analyzerOutputPath) fail();
  await assertProtectedOutputParent(appOutputPath);
  await assertProtectedOutputParent(analyzerOutputPath);

  let appTemporaryPath;
  let analyzerTemporaryPath;
  let appLinked = false;
  let analyzerLinked = false;
  try {
    appTemporaryPath = await createProtectedTemporaryFile(
      appOutputPath,
      appContent
    );
    analyzerTemporaryPath = await createProtectedTemporaryFile(
      analyzerOutputPath,
      analyzerContent
    );
    await link(appTemporaryPath, appOutputPath);
    appLinked = true;
    await link(analyzerTemporaryPath, analyzerOutputPath);
    analyzerLinked = true;
    await chmod(appOutputPath, 0o600);
    await chmod(analyzerOutputPath, 0o600);
    await syncParent(appOutputPath);
    if (dirname(analyzerOutputPath) !== dirname(appOutputPath)) {
      await syncParent(analyzerOutputPath);
    }
  } catch (error) {
    if (analyzerLinked) await unlink(analyzerOutputPath).catch(() => undefined);
    if (appLinked) await unlink(appOutputPath).catch(() => undefined);
    throw error;
  } finally {
    if (appTemporaryPath) await unlink(appTemporaryPath).catch(() => undefined);
    if (analyzerTemporaryPath) {
      await unlink(analyzerTemporaryPath).catch(() => undefined);
    }
  }
}

export async function renderProductionEnvironmentFromFiles(
  fullInputPathInput,
  partialInputPathInput,
  appOutputPathInput,
  analyzerOutputPathInput
) {
  const fullInputPath = resolve(fullInputPathInput);
  const partialInputPath = resolve(partialInputPathInput);
  const appOutputPath = resolve(appOutputPathInput);
  const analyzerOutputPath = resolve(analyzerOutputPathInput);
  if (
    new Set([
      fullInputPath,
      partialInputPath,
      appOutputPath,
      analyzerOutputPath,
    ]).size !== 4
  ) {
    fail();
  }

  const fullInput = await readProtectedInput(fullInputPath);
  const partialInput = await readProtectedInput(partialInputPath);
  let appBuffer;
  let analyzerBuffer;
  try {
    if (
      fullInput.metadata.dev === partialInput.metadata.dev &&
      fullInput.metadata.ino === partialInput.metadata.ino
    ) {
      fail();
    }
    const rendered = renderProductionEnvironmentFiles(
      fullInput.content.toString("utf8"),
      partialInput.content.toString("utf8")
    );
    appBuffer = Buffer.from(rendered.appContent, "utf8");
    analyzerBuffer = Buffer.from(rendered.analyzerContent, "utf8");
    await writeProtectedEnvironmentPair(
      appOutputPath,
      analyzerOutputPath,
      appBuffer,
      analyzerBuffer
    );
    return {
      appKeyCount: rendered.appKeyCount,
      analyzerKeyCount: rendered.analyzerKeyCount,
    };
  } finally {
    fullInput.content.fill(0);
    partialInput.content.fill(0);
    appBuffer?.fill(0);
    analyzerBuffer?.fill(0);
  }
}

async function main() {
  if (process.argv.length !== 6) {
    process.stderr.write(
      "Usage: node render-production-env.mjs FULL_JSON PARTIAL_JSON APP_ENV ANALYZER_ENV\n"
    );
    process.exitCode = 64;
    return;
  }
  try {
    const result = await renderProductionEnvironmentFromFiles(
      process.argv[2],
      process.argv[3],
      process.argv[4],
      process.argv[5]
    );
    process.stdout.write(
      `Rendered ${result.appKeyCount} app keys and ${result.analyzerKeyCount} analyzer keys.\n`
    );
  } catch {
    process.stderr.write("Production environment rendering failed.\n");
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  void main();
}
