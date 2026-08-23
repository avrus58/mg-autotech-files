import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  assertProtectedInputMetadata,
  mergeProductionEnvironment,
  parseFullExport,
  parsePartialExport,
  quoteComposeEnvironmentValue,
  renderProductionEnvironmentFiles,
} from "../scripts/vps/render-production-env.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, "..");
const timestamp = "2026-08-23T12:00:00.000Z";

function fullVariables() {
  return {
    NEXT_PUBLIC_SITE_URL: "https://file.mgautotech.de",
    NEXT_PUBLIC_SUPABASE_URL: "https://jujaeyvyaeesmipihrrw.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-public-key-0000000000000001",
    SUPABASE_SERVICE_ROLE_KEY: "synthetic-service-role-0000000000000001",
    UPLOAD_INTEGRITY_SECRET: "full-upload-secret-00000000000000000001",
    SECURITY_RATE_LIMIT_SALT: "full-rate-salt-0000000000000000000001",
    WIDGET_SESSION_SECRET: "full-widget-secret-00000000000000000001",
    WIDGET_IP_HASH_SALT: "full-widget-ip-salt-000000000000000001",
    GROWTH_ATTRIBUTION_HMAC_SECRET: "full-growth-secret-00000000000000000001",
    SECURITY_DISTRIBUTED_RATE_LIMIT_ENABLED: "false",
    SECURITY_DISTRIBUTED_RATE_LIMIT_REQUIRED: "false",
    UPSTASH_REDIS_REST_URL: "https://redis.example.test",
    UPSTASH_REDIS_REST_TOKEN: "synthetic-redis-token-000000000000001",
    NEXT_PUBLIC_AUTH_CAPTCHA_MODE: "required",
    NEXT_PUBLIC_AUTH_CAPTCHA_ALLOW_TEST_KEY: "false",
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: "0xSyntheticTurnstileSiteKey00000001",
    EMAIL_DRY_RUN: "false",
    RESEND_API_KEY: "re_synthetic-resend-key-000000000000001",
    EMAIL_FROM: "MG AutoTech <noreply@file.mgautotech.de>",
    RESEND_WEBHOOK_SECRET: "whsec_synthetic-resend-webhook-000000000001",
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
      "pk_live_synthetic-publishable-key-0000000001",
    STRIPE_SECRET_KEY: "sk_live_synthetic-stripe-secret-000000000001",
    STRIPE_WEBHOOK_SECRET: "whsec_synthetic-credit-webhook-000000000001",
    STRIPE_WIDGET_WEBHOOK_SECRET:
      "whsec_synthetic-widget-webhook-000000000001",
    NEXT_PUBLIC_BANK_ACCOUNT_NAME: "MG AutoTech",
    NEXT_PUBLIC_BANK_NAME: "Synthetic Production Bank",
    NEXT_PUBLIC_BANK_IBAN: "DE00000000000000000000",
    NEXT_PUBLIC_BANK_BIC: "SYNTHDE0XXX",
    NEXT_PUBLIC_GOOGLE_CLIENT_ID:
      "123456789012-syntheticclientid123.apps.googleusercontent.com",
  };
}

function partialVariables() {
  return {
    NEXT_PUBLIC_SUPABASE_URL: "https://jujaeyvyaeesmipihrrw.supabase.co",
    UPLOAD_INTEGRITY_SECRET: "partial-upload-secret-000000000000000001",
    SECURITY_RATE_LIMIT_SALT: "partial-rate-salt-00000000000000000001",
    WIDGET_SESSION_SECRET: "partial-widget-secret-000000000000000001",
    WIDGET_IP_HASH_SALT: "partial-widget-ip-salt-0000000000000001",
    CUSTOMER_DEVICE_HMAC_SECRET:
      "partial-device-secret-000000000000000001",
    DESKTOP_APP_PUBLIC_DOWNLOAD_ENABLED: "false",
    DESKTOP_APP_UPLOAD_ENABLED: "false",
    FILE_EXPERT_ANALYZER_TOKEN:
      "partial-analyzer-token-00000000000000001",
    REQUEST_NETWORK_PROVIDER: "cloudflare-caddy",
    REQUEST_NETWORK_PROXY_SECRET:
      "partial-proxy-secret-0000000000000000001",
    SECURITY_DISTRIBUTED_RATE_LIMIT_ENABLED: "true",
    SECURITY_DISTRIBUTED_RATE_LIMIT_REQUIRED: "true",
    FILE_EXPERT_ANALYZER_DISTRIBUTED_ADMISSION_ENABLED: "true",
    FILE_EXPERT_ANALYZER_GLOBAL_CONCURRENCY: "1",
  };
}

function fullSource(variables: Record<string, string> = fullVariables()) {
  return JSON.stringify({ version: 1, generatedAt: timestamp, variables });
}

function partialSource(values = partialVariables()) {
  return JSON.stringify({
    kind: "mg-file-service-partial-env",
    createdAt: timestamp,
    values,
  });
}

function findBash() {
  const candidates = [
    process.env.BASH_PATH,
    "bash",
    "C:\\Program Files\\Git\\bin\\bash.exe",
    "C:\\Program Files\\Git\\usr\\bin\\bash.exe",
  ].filter((value): value is string => Boolean(value));
  for (const candidate of candidates) {
    const result = spawnSync(candidate, ["--version"], { encoding: "utf8" });
    if (!result.error && result.status === 0) return candidate;
  }
  return null;
}

function shellPath(path: string) {
  return path.replace(/\\/g, "/").replace(/^([A-Za-z]):/, (_, drive) =>
    `/${String(drive).toLowerCase()}`
  );
}

test("Production renderer preserves continuity values and overrides only VPS contracts", () => {
  const merged = mergeProductionEnvironment(fullVariables(), partialVariables());
  assert.equal(
    merged.UPLOAD_INTEGRITY_SECRET,
    fullVariables().UPLOAD_INTEGRITY_SECRET
  );
  assert.equal(
    merged.WIDGET_SESSION_SECRET,
    fullVariables().WIDGET_SESSION_SECRET
  );
  assert.equal(
    merged.SECURITY_RATE_LIMIT_SALT,
    fullVariables().SECURITY_RATE_LIMIT_SALT
  );
  assert.equal(
    merged.GROWTH_ATTRIBUTION_HMAC_SECRET,
    fullVariables().GROWTH_ATTRIBUTION_HMAC_SECRET
  );
  assert.equal(
    merged.FILE_EXPERT_ANALYZER_TOKEN,
    partialVariables().FILE_EXPERT_ANALYZER_TOKEN
  );
  assert.equal(merged.DESKTOP_APP_PUBLIC_DOWNLOAD_ENABLED, "false");
  assert.equal(merged.DESKTOP_APP_UPLOAD_ENABLED, "false");
  assert.equal(merged.REQUEST_NETWORK_PROVIDER, "cloudflare-caddy");
  assert.equal(merged.SECURITY_DISTRIBUTED_RATE_LIMIT_ENABLED, "true");
  assert.equal(merged.SECURITY_DISTRIBUTED_RATE_LIMIT_REQUIRED, "true");
});

test("Full and partial JSON schemas are exact, bounded string records", () => {
  assert.deepEqual(
    { ...parseFullExport(fullSource()) },
    fullVariables()
  );
  assert.deepEqual(
    { ...parsePartialExport(JSON.stringify({ variables: partialVariables() })) },
    partialVariables()
  );
  assert.deepEqual(
    { ...parsePartialExport(JSON.stringify(partialVariables())) },
    partialVariables()
  );
  assert.deepEqual(
    { ...parsePartialExport(partialSource()) },
    partialVariables()
  );

  assert.throws(
    () =>
      parseFullExport(fullSource({ ...fullVariables(), VERCEL: "1" })),
    /Invalid Production environment input/
  );
  assert.throws(
    () =>
      parsePartialExport(
        JSON.stringify({
          kind: "wrong-kind",
          createdAt: timestamp,
          values: partialVariables(),
        })
      ),
    /Invalid Production environment input/
  );
  assert.throws(
    () => parsePartialExport(JSON.stringify({ variables: { EMAIL_FROM: "" } })),
    /Invalid Production environment input/
  );
  assert.throws(
    () =>
      parsePartialExport(
        JSON.stringify({ variables: { EMAIL_FROM: "x".repeat(16 * 1024 + 1) } })
      ),
    /Invalid Production environment input/
  );
});

test("Test credentials and missing VPS overrides fail closed", () => {
  assert.throws(
    () =>
      mergeProductionEnvironment(
        {
          ...fullVariables(),
          NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
        },
        partialVariables()
      ),
    /Invalid Production environment input/
  );
  assert.throws(
    () =>
      mergeProductionEnvironment(
        { ...fullVariables(), STRIPE_SECRET_KEY: "sk_test_synthetic" },
        partialVariables()
      ),
    /Invalid Production environment input/
  );
  const partial = partialVariables();
  delete (partial as Partial<ReturnType<typeof partialVariables>>)
    .REQUEST_NETWORK_PROXY_SECRET;
  assert.throws(
    () => mergeProductionEnvironment(fullVariables(), partial),
    /Invalid Production environment input/
  );
});

test("Compose quoting contains interpolation and control characters", () => {
  const quoted = quoteComposeEnvironmentValue('value $HOME "quoted" \\\n\r\t');
  assert.ok(quoted.startsWith('"') && quoted.endsWith('"'));
  assert.match(quoted, /\$\$HOME/);
  assert.match(quoted, /\\"quoted\\"/);
  assert.match(quoted, /\\\\/);
  assert.match(quoted, /\\n/);
  assert.match(quoted, /\\r/);
  assert.match(quoted, /\\t/);
  assert.doesNotMatch(quoted, /\n/);
});

test("Analyzer env is least privilege, token-matched and Production-host bounded", () => {
  const rendered = renderProductionEnvironmentFiles(
    fullSource(),
    partialSource()
  );
  assert.match(
    rendered.analyzerContent,
    /FILE_EXPERT_ANALYZER_ALLOWED_HOSTS="jujaeyvyaeesmipihrrw\.supabase\.co"/
  );
  assert.match(
    rendered.analyzerContent,
    /FILE_EXPERT_ANALYZER_MAX_SOURCE_BYTES="33554432"/
  );
  assert.match(
    rendered.analyzerContent,
    /FILE_EXPERT_ANALYZER_TIMEOUT_SECONDS="20"/
  );
  assert.match(
    rendered.analyzerContent,
    new RegExp(partialVariables().FILE_EXPERT_ANALYZER_TOKEN)
  );
  assert.doesNotMatch(
    rendered.analyzerContent,
    /SUPABASE_SERVICE_ROLE_KEY|STRIPE_|RESEND_|REQUEST_NETWORK_PROXY_SECRET/
  );
  assert.equal(rendered.analyzerKeyCount, 4);
});

test("Rendered files pass the existing VPS environment contract", (context) => {
  const bash = findBash();
  if (!bash) {
    context.skip("Bash is unavailable in this local runtime.");
    return;
  }
  const root = mkdtempSync(join(tmpdir(), "mg-vps-rendered-env-"));
  try {
    const app = join(root, "app.env");
    const analyzer = join(root, "analyzer.env");
    const rendered = renderProductionEnvironmentFiles(
      fullSource(),
      partialSource()
    );
    writeFileSync(app, rendered.appContent);
    writeFileSync(analyzer, rendered.analyzerContent);
    const checker = resolve(projectRoot, "scripts", "vps", "check-env-contract.sh");
    const result = spawnSync(
      bash,
      [shellPath(checker), shellPath(app), shellPath(analyzer)],
      { encoding: "utf8" }
    );
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /values were not printed/);
    assert.doesNotMatch(
      `${result.stdout}${result.stderr}`,
      new RegExp(partialVariables().FILE_EXPERT_ANALYZER_TOKEN)
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Private input metadata is root-owned regular 0600 only", () => {
  const valid = {
    isFile: () => true,
    size: 128,
    uid: 0,
    gid: 0,
    mode: 0o100600,
  };
  assert.doesNotThrow(() => assertProtectedInputMetadata(valid));
  assert.throws(
    () => assertProtectedInputMetadata({ ...valid, uid: 1000 }),
    /Invalid Production environment input/
  );
  assert.throws(
    () => assertProtectedInputMetadata({ ...valid, mode: 0o100640 }),
    /Invalid Production environment input/
  );
  assert.throws(
    () => assertProtectedInputMetadata({ ...valid, isFile: () => false }),
    /Invalid Production environment input/
  );
});

test("CLI uses no-follow reads and no-clobber links without secret output", () => {
  const scriptPath = resolve(
    projectRoot,
    "scripts",
    "vps",
    "render-production-env.mjs"
  );
  assert.ok(existsSync(scriptPath));
  const script = readFileSync(scriptPath, "utf8");
  assert.match(script, /O_NOFOLLOW/);
  assert.match(script, /metadata\.uid !== 0/);
  assert.match(script, /metadata\.gid !== 0/);
  assert.match(script, /metadata\.mode & 0o7777/);
  assert.match(script, /await link\(appTemporaryPath, appOutputPath\)/);
  assert.match(script, /await link\(analyzerTemporaryPath, analyzerOutputPath\)/);
  assert.match(script, /Rendered \$\{result\.appKeyCount\} app keys/);
  assert.doesNotMatch(script, /console\.log|JSON\.stringify\(environment\)/);
});
