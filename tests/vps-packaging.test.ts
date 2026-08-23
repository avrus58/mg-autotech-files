import assert from "node:assert/strict";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

function readProjectFile(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

function findBash() {
  const candidates = process.platform === "win32"
    ? [
        "C:\\Program Files\\Git\\bin\\bash.exe",
        "C:\\Program Files\\Git\\usr\\bin\\bash.exe",
      ]
    : ["/bin/bash", "/usr/bin/bash"];
  return candidates.find(existsSync) ?? null;
}

function shellPath(path: string) {
  if (process.platform !== "win32") return path;
  return path.replace(/^([A-Za-z]):\\/, (_, drive: string) => `/${drive.toLowerCase()}/`)
    .replaceAll("\\", "/");
}

const publicBuildVariables = [
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
] as const;

test("Next standalone image admits only allowlisted browser-public build values", () => {
  const config = readProjectFile("next.config.ts");
  const dockerfile = readProjectFile("Dockerfile");
  const ignore = readProjectFile(".dockerignore");

  assert.match(config, /output: "standalone"/);
  assert.match(dockerfile, /FROM \$\{NODE_IMAGE\} AS base/);
  assert.match(dockerfile, /FROM base AS dependencies/);
  assert.match(dockerfile, /FROM base AS builder/);
  assert.match(dockerfile, /FROM base AS runner/);
  assert.match(dockerfile, /\/app\/\.next\/standalone/);
  assert.match(dockerfile, /USER nextjs/);
  assert.match(dockerfile, /Production image build refuses the CAPTCHA test-key bypass/);
  for (const variable of publicBuildVariables) {
    assert.match(dockerfile, new RegExp(`ARG ${variable}=`), variable);
  }
  for (const secret of [
    "SUPABASE_SERVICE_ROLE_KEY",
    "STRIPE_SECRET_KEY",
    "RESEND_API_KEY",
    "REQUEST_NETWORK_PROXY_SECRET",
    "FILE_EXPERT_ANALYZER_TOKEN",
  ]) {
    assert.doesNotMatch(dockerfile, new RegExp(`ARG ${secret}`), secret);
  }
  assert.match(ignore, /^\.env\*$/m);
  assert.match(ignore, /^file-expert-analyzer$/m);
  assert.match(ignore, /^node_modules$/m);
});

test("Production compose keeps ports private and enforces the edge/backend contract", () => {
  const compose = readProjectFile("compose.vps.yml");
  const preview = readProjectFile("compose.vps.preview.yml");

  assert.match(compose, /^name: mgautotech-file-service$/m);
  assert.doesNotMatch(compose, /^\s+ports:/m);
  assert.match(compose, /name: mgautotech_file_service_edge/);
  assert.match(compose, /name: mgautotech_file_service_backend/);
  assert.doesNotMatch(compose, /internal: true/);
  assert.match(compose, /aliases:\s*\n\s*- file-service/);
  assert.match(compose, /aliases:\s*\n\s*- file-expert-analyzer/);
  assert.match(compose, /FILE_EXPERT_ANALYZER_ALLOW_PRIVATE_DOCKER_HTTP: "true"/);
  assert.match(compose, /FILE_EXPERT_ANALYZER_URL: http:\/\/file-expert-analyzer:8010/);
  assert.doesNotMatch(compose, /depends_on:/);
  assert.match(preview, /127\.0\.0\.1:\$\{FILE_SERVICE_PREVIEW_PORT:-3100\}:3000/);
  assert.doesNotMatch(preview, /0\.0\.0\.0/);

  for (const variable of publicBuildVariables) {
    assert.match(compose, new RegExp(`${variable}: \\\${${variable}:-}`), variable);
  }
});

test("Compose applies non-root writable boundaries and conservative host limits", () => {
  const compose = readProjectFile("compose.vps.yml");
  assert.match(compose, /static-assets:\/app\/\.next\/static/);
  assert.match(compose, /static-state:\/app\/static-state/);
  assert.match(compose, /\/app\/\.next\/cache:rw,noexec,nosuid,nodev,size=128m/);
  assert.match(compose, /read_only: true/g);
  assert.match(compose, /cap_drop:\s*\n\s*- ALL/g);
  assert.match(compose, /no-new-privileges:true/g);
  assert.match(compose, /cpu_shares: 384/);
  assert.match(compose, /cpus: "0\.85"/);
  assert.match(compose, /mem_limit: 1024m/);
  assert.match(compose, /pids_limit: 256/);
  assert.match(compose, /cpu_shares: 192/);
  assert.match(compose, /cpus: "0\.90"/);
  assert.match(compose, /mem_limit: 768m/);
  assert.match(compose, /pids_limit: 128/);
});

test("Analyzer is least-privilege, private, single-concurrency and independently healthy", () => {
  const compose = readProjectFile("compose.vps.yml");
  const analyzerDockerfile = readProjectFile("file-expert-analyzer", "Dockerfile");
  assert.match(compose, /context: \.\/file-expert-analyzer/);
  assert.match(compose, /FILE_EXPERT_ANALYZER_ENV_FILE:-\/etc\/mgautotech\/file-expert-analyzer\.env/);
  assert.match(compose, /FILE_EXPERT_ANALYZER_MAX_CONCURRENT: "1"/);
  assert.match(compose, /FILE_EXPERT_ANALYZER_WALL_TIMEOUT_SECONDS: "30"/);
  assert.match(compose, /FILE_EXPERT_ANALYZER_LOCK_FILE: \/tmp\/mg-autotech-file-expert\.lock/);
  assert.match(compose, /http:\/\/127\.0\.0\.1:8010\/health/);
  assert.match(analyzerDockerfile, /USER 10001:10001/);
  assert.match(analyzerDockerfile, /--workers", "1"/);
  assert.match(analyzerDockerfile, /--limit-concurrency", "4"/);
});

test("Public readiness is process-local, minimal and non-cacheable", () => {
  const route = readProjectFile("src", "app", "api", "health", "ready", "route.ts");
  assert.match(route, /\{ status: "ok" \}/);
  assert.match(route, /no-store, max-age=0/);
  assert.match(route, /X-Robots-Tag/);
  assert.match(route, /export function HEAD/);
  assert.doesNotMatch(route, /process\.env|supabase|stripe|resend|analyzer|redis/i);
});

test("Static release preparation retains a bounded three-build asset union", () => {
  const root = mkdtempSync(join(tmpdir(), "mg-static-assets-"));
  const source = join(root, "source");
  const target = join(root, "target");
  const state = join(root, "state");
  const manifest = join(root, "manifest.json");
  const buildIdFile = join(root, "BUILD_ID");
  const script = resolve(process.cwd(), "scripts", "vps", "prepare-static-assets.mjs");

  function activate(buildId: string, uniqueFile: string) {
    rmSync(source, { recursive: true, force: true });
    mkdirSync(join(source, "chunks"), { recursive: true });
    writeFileSync(join(source, "chunks", "shared.js"), buildId);
    writeFileSync(join(source, "chunks", uniqueFile), buildId);
    writeFileSync(buildIdFile, `${buildId}\n`);
    writeFileSync(
      manifest,
      JSON.stringify({
        schemaVersion: 1,
        buildId,
        files: ["chunks/shared.js", `chunks/${uniqueFile}`],
      })
    );
    const result = spawnSync(process.execPath, [script], {
      encoding: "utf8",
      env: {
        ...process.env,
        FILE_SERVICE_STATIC_SOURCE: source,
        FILE_SERVICE_STATIC_TARGET: target,
        FILE_SERVICE_STATIC_STATE: state,
        FILE_SERVICE_STATIC_MANIFEST: manifest,
        FILE_SERVICE_BUILD_ID_FILE: buildIdFile,
        FILE_SERVICE_STATIC_RELEASES_TO_KEEP: "3",
      },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }

  try {
    activate("release-a", "a.js");
    activate("release-b", "b.js");
    activate("release-c", "c.js");
    activate("release-d", "d.js");
    assert.equal(existsSync(join(target, "chunks", "a.js")), false);
    assert.equal(existsSync(join(target, "chunks", "b.js")), true);
    assert.equal(existsSync(join(target, "chunks", "c.js")), true);
    assert.equal(existsSync(join(target, "chunks", "d.js")), true);
    assert.equal(readFileSync(join(target, "chunks", "shared.js"), "utf8"), "release-d");
    assert.deepEqual(readdirSync(state).sort(), [
      "release-b.json",
      "release-c.json",
      "release-d.json",
    ]);

    activate("release-b", "b.js");
    assert.equal(readFileSync(join(target, "chunks", "shared.js"), "utf8"), "release-b");
    assert.equal(existsSync(join(target, "chunks", "b.js")), true);
    assert.equal(existsSync(join(target, ".next", "cache")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Static manifest generator emits only normalized build assets", () => {
  const root = mkdtempSync(join(tmpdir(), "mg-static-manifest-"));
  const next = join(root, ".next");
  const script = resolve(process.cwd(), "scripts", "vps", "create-static-manifest.mjs");
  try {
    mkdirSync(join(next, "static", "chunks"), { recursive: true });
    writeFileSync(join(next, "BUILD_ID"), "build-123\n");
    writeFileSync(join(next, "static", "chunks", "app.js"), "asset");
    const result = spawnSync(process.execPath, [script], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const generated = JSON.parse(
      readFileSync(join(next, "static-release-manifest.json"), "utf8")
    );
    assert.deepEqual(generated, {
      schemaVersion: 1,
      buildId: "build-123",
      files: ["chunks/app.js"],
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Release scripts validate contracts, switch services in order and rollback idempotently", () => {
  const checker = readProjectFile("scripts", "vps", "check-env-contract.sh");
  const common = readProjectFile("scripts", "vps", "common.sh");
  const deploy = readProjectFile("scripts", "vps", "deploy.sh");
  const rollback = readProjectFile("scripts", "vps", "rollback.sh");
  const combined = [checker, common, deploy, rollback].join("\n");

  assert.match(checker, /REQUEST_NETWORK_PROVIDER cloudflare-caddy/);
  assert.match(checker, /REQUEST_NETWORK_PROXY_SECRET 32 512/);
  assert.match(checker, /FILE_EXPERT_ANALYZER_TOKEN: app and analyzer values do not match/);
  assert.match(checker, /values were not printed/);
  assert.match(common, /docker network inspect "\$EDGE_NETWORK"/);
  assert.match(common, /--project-name mgautotech-file-service/);
  assert.match(common, /-u COMPOSE_PROJECT_NAME/);
  for (const variable of publicBuildVariables) {
    assert.match(common, new RegExp(`-u ${variable}`), variable);
  }
  assert.match(common, /--env-file "\$APP_ENV_FILE"/);
  assert.match(deploy, /build file-service file-expert-analyzer/);
  assert.match(deploy, /explicit release IDs are allowed only for non-Git source archives/);
  assert.match(deploy, /repository must be clean before deriving a release ID/);
  assert.match(deploy, /a non-Git source archive requires an explicit release ID/);
  assert.ok(
    deploy.indexOf("file-expert-analyzer") < deploy.indexOf("Starting File Service release")
  );
  assert.match(common, /up -d --no-build --no-deps/);
  assert.match(common, /up -d --no-build --no-deps "\$service" \|\| return 1/);
  assert.match(common, /\{\{\.Config\.Image\}\}\|/);
  assert.match(deploy, /resolve_deploy_baseline "\$state_service" "\$state_analyzer"/);
  assert.doesNotMatch(deploy, /old_service=\$\{running_service:-\$state_service\}/);
  assert.match(rollback, /Rollback is already applied and healthy; no services were changed/);
  assert.match(rollback, /runtime_pair_is_healthy "\$current_service" "\$current_analyzer"/);
  assert.match(rollback, /Recorded current release pair was restored and is healthy; release history was unchanged/);
  assert.match(rollback, /target analyzer did not become healthy; File Service was not switched/);
  assert.doesNotMatch(combined, /source ["']?\$APP_ENV_FILE|\. ["']?\$APP_ENV_FILE/);
  assert.doesNotMatch(combined, /docker compose down|docker volume rm|docker system prune/);
});

test("Explicit current rollback repairs runtime drift without rewriting release history", (context) => {
  const bash = findBash();
  if (!bash) {
    context.skip("Bash is unavailable in this local runtime.");
    return;
  }

  const root = mkdtempSync(join(tmpdir(), "mg-vps-rollback-repair-"));
  const rollback = join(root, "rollback.sh");
  const common = join(root, "common.sh");
  const log = join(root, "release.log");
  try {
    writeFileSync(rollback, readProjectFile("scripts", "vps", "rollback.sh"));
    writeFileSync(common, [
      "#!/usr/bin/env bash",
      "set -Eeuo pipefail",
      "SERVICE_IMAGE_REPOSITORY=mgautotech-file-service",
      "ANALYZER_IMAGE_REPOSITORY=mgautotech-file-expert-analyzer",
      "release_preflight() { :; }",
      "acquire_release_lock() { :; }",
      "die() { printf 'mock error: %s\\n' \"$1\" >&2; exit 1; }",
      "state_value() {",
      "  case \"$1\" in",
      "    current_service) printf 'mgautotech-file-service:a\\n' ;;",
      "    current_analyzer) printf 'mgautotech-file-expert-analyzer:a\\n' ;;",
      "    previous_service) printf 'mgautotech-file-service:b\\n' ;;",
      "    previous_analyzer) printf 'mgautotech-file-expert-analyzer:b\\n' ;;",
      "    last_action) printf 'deploy\\n' ;;",
      "  esac",
      "}",
      "validate_image_reference() { :; }",
      "validate_release_id() { :; }",
      "runtime_pair_is_healthy() { return 1; }",
      "image_is_available() { return 0; }",
      "start_service() { printf '%s|%s|%s\\n' \"$1\" \"$2\" \"$4\" >> \"$MOCK_RELEASE_LOG\"; }",
      "write_release_state() { printf 'write-state\\n' >> \"$MOCK_RELEASE_LOG\"; }",
      "",
    ].join("\n"));

    const result = spawnSync(bash, [shellPath(rollback), "a"], {
      encoding: "utf8",
      env: {
        ...process.env,
        MOCK_RELEASE_LOG: shellPath(log),
      },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.deepEqual(readFileSync(log, "utf8").trim().split(/\r?\n/), [
      "mgautotech-file-service:a|mgautotech-file-expert-analyzer:a|file-expert-analyzer",
      "mgautotech-file-service:a|mgautotech-file-expert-analyzer:a|file-service",
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Completed state tolerates stopped services but rejects a present mixed runtime pair", (context) => {
  const bash = findBash();
  if (!bash) {
    context.skip("Bash is unavailable in this local runtime.");
    return;
  }

  const root = mkdtempSync(join(tmpdir(), "mg-vps-runtime-pair-"));
  const bin = join(root, "bin");
  const docker = join(bin, "docker");
  const common = resolve(process.cwd(), "scripts", "vps", "common.sh");
  try {
    mkdirSync(bin, { recursive: true });
    writeFileSync(docker, [
      "#!/usr/bin/env bash",
      "set -Eeuo pipefail",
      "if [[ \" $* \" == *\" ps -q file-service \"* ]]; then",
      "  [[ ${MOCK_APP_PRESENT:-true} == true ]] && printf 'app-container\\n'",
      "  exit 0",
      "fi",
      "if [[ \" $* \" == *\" ps -q file-expert-analyzer \"* ]]; then",
      "  [[ ${MOCK_ANALYZER_PRESENT:-true} == true ]] && printf 'analyzer-container\\n'",
      "  exit 0",
      "fi",
      "if [[ ${1:-} == inspect ]]; then",
      "  container=${!#}",
      "  if [[ $container == app-container ]]; then",
      "    printf '%s|%s\\n' \"${MOCK_APP_IMAGE:-recorded-file-service:a}\" \"${MOCK_APP_STATUS:-healthy}\"",
      "  else",
      "    printf '%s|%s\\n' \"${MOCK_ANALYZER_IMAGE:-drift-analyzer:b}\" \"${MOCK_ANALYZER_STATUS:-healthy}\"",
      "  fi",
      "  exit 0",
      "fi",
      "exit 0",
      "",
    ].join("\n"));
    chmodSync(docker, 0o755);

    const command = [
      `PATH='${shellPath(bin)}':\"$PATH\"`,
      "export PATH",
      `source '${shellPath(common)}'`,
      "if (resolve_deploy_baseline recorded-file-service:a recorded-analyzer:a next-file-service:c next-analyzer:c); then exit 91; fi",
      "export MOCK_ANALYZER_IMAGE=recorded-analyzer:a",
      "resolve_deploy_baseline recorded-file-service:a recorded-analyzer:a next-file-service:c next-analyzer:c",
      "[[ $DEPLOY_BASELINE_SERVICE == recorded-file-service:a ]]",
      "[[ $DEPLOY_BASELINE_ANALYZER == recorded-analyzer:a ]]",
      "export MOCK_ANALYZER_PRESENT=false",
      "resolve_deploy_baseline recorded-file-service:a recorded-analyzer:a next-file-service:c next-analyzer:c",
      "[[ $DEPLOY_BASELINE_SERVICE == recorded-file-service:a ]]",
      "[[ $DEPLOY_BASELINE_ANALYZER == recorded-analyzer:a ]]",
      "export MOCK_ANALYZER_PRESENT=true MOCK_ANALYZER_STATUS=unhealthy",
      "resolve_deploy_baseline recorded-file-service:a recorded-analyzer:a next-file-service:c next-analyzer:c",
      "[[ $DEPLOY_BASELINE_SERVICE == recorded-file-service:a ]]",
      "[[ $DEPLOY_BASELINE_ANALYZER == recorded-analyzer:a ]]",
    ].join("\n");
    const result = spawnSync(bash, ["-c", command], {
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("No-state adoption accepts only a healthy same-tag pair from the configured repositories", (context) => {
  const bash = findBash();
  if (!bash) {
    context.skip("Bash is unavailable in this local runtime.");
    return;
  }

  const root = mkdtempSync(join(tmpdir(), "mg-vps-runtime-adoption-"));
  const bin = join(root, "bin");
  const docker = join(bin, "docker");
  const common = resolve(process.cwd(), "scripts", "vps", "common.sh");
  try {
    mkdirSync(bin, { recursive: true });
    writeFileSync(docker, [
      "#!/usr/bin/env bash",
      "set -Eeuo pipefail",
      "if [[ \" $* \" == *\" ps -q file-service \"* ]]; then",
      "  [[ ${MOCK_APP_PRESENT:-true} == true ]] && printf 'app-container\\n'",
      "  exit 0",
      "fi",
      "if [[ \" $* \" == *\" ps -q file-expert-analyzer \"* ]]; then",
      "  [[ ${MOCK_ANALYZER_PRESENT:-true} == true ]] && printf 'analyzer-container\\n'",
      "  exit 0",
      "fi",
      "if [[ ${1:-} == inspect ]]; then",
      "  container=${!#}",
      "  if [[ $container == app-container ]]; then",
      "    printf '%s|healthy\\n' \"${MOCK_APP_IMAGE:-unmanaged-app:a}\"",
      "  else",
      "    printf '%s|healthy\\n' \"${MOCK_ANALYZER_IMAGE:-unmanaged-analyzer:a}\"",
      "  fi",
      "  exit 0",
      "fi",
      "exit 0",
      "",
    ].join("\n"));
    chmodSync(docker, 0o755);

    const command = [
      `PATH='${shellPath(bin)}':\"$PATH\"`,
      "export PATH",
      `source '${shellPath(common)}'`,
      "if (resolve_deploy_baseline '' '' next-file-service:c next-analyzer:c); then exit 91; fi",
      "export MOCK_APP_IMAGE=mgautotech-file-service:abc123",
      "export MOCK_ANALYZER_IMAGE=mgautotech-file-expert-analyzer:abc123",
      "resolve_deploy_baseline '' '' next-file-service:c next-analyzer:c",
      "[[ $DEPLOY_BASELINE_SERVICE == mgautotech-file-service:abc123 ]]",
      "[[ $DEPLOY_BASELINE_ANALYZER == mgautotech-file-expert-analyzer:abc123 ]]",
      "export MOCK_ANALYZER_IMAGE=mgautotech-file-expert-analyzer:different",
      "if (resolve_deploy_baseline '' '' next-file-service:c next-analyzer:c); then exit 92; fi",
      "export MOCK_APP_PRESENT=false MOCK_ANALYZER_PRESENT=false",
      "resolve_deploy_baseline '' '' next-file-service:c next-analyzer:c",
      "[[ -z $DEPLOY_BASELINE_SERVICE && -z $DEPLOY_BASELINE_ANALYZER ]]",
    ].join("\n");
    const result = spawnSync(bash, ["-c", command], {
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Service activation cannot hide a failed compose up or accept a stale healthy image", (context) => {
  const bash = findBash();
  if (!bash) {
    context.skip("Bash is unavailable in this local runtime.");
    return;
  }

  const root = mkdtempSync(join(tmpdir(), "mg-vps-compose-mock-"));
  const bin = join(root, "bin");
  const docker = join(bin, "docker");
  const common = resolve(process.cwd(), "scripts", "vps", "common.sh");
  try {
    mkdirSync(bin, { recursive: true });
    writeFileSync(docker, [
      "#!/usr/bin/env bash",
      "set -Eeuo pipefail",
      "if [[ \" $* \" == *\" up \"* ]]; then",
      "  [[ ${MOCK_UP_MODE:-fail} == fail ]] && exit 23",
      "  exit 0",
      "fi",
      "if [[ \" $* \" == *\" ps -q file-service \"* ]]; then",
      "  printf 'stale-container\\n'",
      "  exit 0",
      "fi",
      "if [[ ${1:-} == inspect ]]; then",
      "  if [[ \" $* \" == *\".Config.Image\"* ]]; then",
      "    printf 'old-file-service:old|healthy\\n'",
      "  else",
      "    printf 'healthy\\n'",
      "  fi",
      "  exit 0",
      "fi",
      "exit 0",
      "",
    ].join("\n"));
    chmodSync(docker, 0o755);

    const command = [
      `PATH='${shellPath(bin)}':\"$PATH\"`,
      "export PATH",
      `source '${shellPath(common)}'`,
      "HEALTH_TIMEOUT_SECONDS=1",
      "export MOCK_UP_MODE=fail",
      "if start_service new-file-service:new new-analyzer:new test file-service; then exit 91; fi",
      "export MOCK_UP_MODE=ok",
      "if start_service new-file-service:new new-analyzer:new test file-service; then exit 92; fi",
    ].join("\n");
    const result = spawnSync(bash, ["-c", command], {
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Env preflight accepts the split least-privilege contract without echoing values", (context) => {
  const bash = findBash();
  if (!bash) {
    context.skip("Bash is unavailable in this local runtime.");
    return;
  }
  const root = mkdtempSync(join(tmpdir(), "mg-vps-env-"));
  const app = join(root, "app.env");
  const analyzer = join(root, "analyzer.env");
  const checker = resolve(process.cwd(), "scripts", "vps", "check-env-contract.sh");
  const sharedToken = "synthetic-analyzer-token-0000000000000001";
  const proxySecret = "synthetic-proxy-secret-000000000000000001";
  const serviceSecret = "synthetic-service-role-0000000000000001";
  const resendKey = "re_synthetic-resend-key-000000000000001";
  const resendWebhookSecret = "whsec_synthetic-resend-webhook-000000000001";
  const stripeSecret = "sk_live_synthetic-stripe-secret-000000000001";
  const stripeWebhookSecret = "whsec_synthetic-credit-webhook-000000000001";
  const widgetWebhookSecret = "whsec_synthetic-widget-webhook-000000000001";
  try {
    const validAppEnvironment = [
      "NEXT_PUBLIC_SITE_URL=https://file.mgautotech.de",
      "NEXT_PUBLIC_SUPABASE_URL=https://jujaeyvyaeesmipihrrw.supabase.co",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY=synthetic-public-key-0000000000000001",
      `SUPABASE_SERVICE_ROLE_KEY=${serviceSecret}`,
      "UPLOAD_INTEGRITY_SECRET=synthetic-upload-secret-000000000000001",
      "CUSTOMER_DEVICE_HMAC_SECRET=synthetic-device-secret-000000000000001",
      `FILE_EXPERT_ANALYZER_TOKEN=${sharedToken}`,
      "REQUEST_NETWORK_PROVIDER=cloudflare-caddy",
      `REQUEST_NETWORK_PROXY_SECRET=${proxySecret}`,
      "SECURITY_DISTRIBUTED_RATE_LIMIT_ENABLED=true",
      "SECURITY_RATE_LIMIT_SALT=synthetic-rate-limit-salt-000000000001",
      "FILE_EXPERT_ANALYZER_DISTRIBUTED_ADMISSION_ENABLED=true",
      "FILE_EXPERT_ANALYZER_GLOBAL_CONCURRENCY=1",
      "WIDGET_SESSION_SECRET=synthetic-widget-secret-000000000000001",
      "WIDGET_IP_HASH_SALT=synthetic-widget-ip-salt-00000000000001",
      "UPSTASH_REDIS_REST_URL=https://redis.example.test",
      "UPSTASH_REDIS_REST_TOKEN=synthetic-redis-token-000000000000001",
      "NEXT_PUBLIC_AUTH_CAPTCHA_MODE=required",
      "NEXT_PUBLIC_TURNSTILE_SITE_KEY=0xSyntheticTurnstileSiteKey00000001",
      "NEXT_PUBLIC_AUTH_CAPTCHA_ALLOW_TEST_KEY=false",
      "EMAIL_DRY_RUN=false",
      `RESEND_API_KEY=${resendKey}`,
      "EMAIL_FROM=MG AutoTech <noreply@file.mgautotech.de>",
      `RESEND_WEBHOOK_SECRET=${resendWebhookSecret}`,
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_synthetic-publishable-key-0000000001",
      `STRIPE_SECRET_KEY=${stripeSecret}`,
      `STRIPE_WEBHOOK_SECRET=${stripeWebhookSecret}`,
      `STRIPE_WIDGET_WEBHOOK_SECRET=${widgetWebhookSecret}`,
      "NEXT_PUBLIC_BANK_ACCOUNT_NAME=MG AutoTech",
      "NEXT_PUBLIC_BANK_NAME=Synthetic Production Bank",
      "NEXT_PUBLIC_BANK_IBAN=DE00000000000000000000",
      "NEXT_PUBLIC_BANK_BIC=SYNTHDE0XXX",
      "NEXT_PUBLIC_GOOGLE_CLIENT_ID=123456789012-syntheticclientid123.apps.googleusercontent.com",
      "",
    ].join("\n");
    const validAnalyzerEnvironment = [
      `FILE_EXPERT_ANALYZER_TOKEN=${sharedToken}`,
      "FILE_EXPERT_ANALYZER_ALLOWED_HOSTS=jujaeyvyaeesmipihrrw.supabase.co",
      "",
    ].join("\n");
    writeFileSync(app, validAppEnvironment);
    writeFileSync(analyzer, validAnalyzerEnvironment);
    const valid = spawnSync(bash, [shellPath(checker), shellPath(app), shellPath(analyzer)], {
      encoding: "utf8",
    });
    assert.equal(valid.status, 0, valid.stderr || valid.stdout);
    const validOutput = `${valid.stdout}${valid.stderr}`;
    assert.match(validOutput, /values were not printed/);
    assert.doesNotMatch(validOutput, new RegExp(sharedToken));
    assert.doesNotMatch(validOutput, new RegExp(proxySecret));
    assert.doesNotMatch(validOutput, new RegExp(serviceSecret));
    assert.doesNotMatch(validOutput, new RegExp(resendKey));
    assert.doesNotMatch(validOutput, new RegExp(stripeSecret));

    writeFileSync(analyzer, `${validAnalyzerEnvironment}STRIPE_SECRET_KEY=synthetic-forbidden\n`);
    const invalid = spawnSync(bash, [shellPath(checker), shellPath(app), shellPath(analyzer)], {
      encoding: "utf8",
    });
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stderr, /STRIPE_SECRET_KEY: not allowed/);
    assert.doesNotMatch(invalid.stderr, /synthetic-forbidden/);

    writeFileSync(analyzer, validAnalyzerEnvironment);
    const invalidAppContracts = [
      {
        name: "canonical site",
        source: validAppEnvironment.replace("https://file.mgautotech.de", "https://preview.example.test"),
        expected: /NEXT_PUBLIC_SITE_URL/,
      },
      {
        name: "Production Supabase",
        source: validAppEnvironment.replace(
          "https://jujaeyvyaeesmipihrrw.supabase.co",
          "https://vxdxdvtsopsjatukdbuq.supabase.co"
        ),
        expected: /NEXT_PUBLIC_SUPABASE_URL/,
      },
      {
        name: "required CAPTCHA mode",
        source: validAppEnvironment.replace("NEXT_PUBLIC_AUTH_CAPTCHA_MODE=required", "NEXT_PUBLIC_AUTH_CAPTCHA_MODE=off"),
        expected: /NEXT_PUBLIC_AUTH_CAPTCHA_MODE/,
      },
      {
        name: "real Turnstile key",
        source: validAppEnvironment.replace(
          "NEXT_PUBLIC_TURNSTILE_SITE_KEY=0xSyntheticTurnstileSiteKey00000001",
          "NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA"
        ),
        expected: /NEXT_PUBLIC_TURNSTILE_SITE_KEY/,
      },
      {
        name: "live e-mail sending",
        source: validAppEnvironment.replace("EMAIL_DRY_RUN=false", "EMAIL_DRY_RUN=true"),
        expected: /EMAIL_DRY_RUN/,
      },
      {
        name: "Resend key",
        source: validAppEnvironment.replace(`RESEND_API_KEY=${resendKey}`, "RESEND_API_KEY="),
        expected: /RESEND_API_KEY/,
      },
      {
        name: "Resend webhook",
        source: validAppEnvironment.replace(`RESEND_WEBHOOK_SECRET=${resendWebhookSecret}`, "RESEND_WEBHOOK_SECRET="),
        expected: /RESEND_WEBHOOK_SECRET/,
      },
      {
        name: "live Stripe secret",
        source: validAppEnvironment.replace(`STRIPE_SECRET_KEY=${stripeSecret}`, "STRIPE_SECRET_KEY=sk_test_synthetic-key-000000000001"),
        expected: /STRIPE_SECRET_KEY/,
      },
      {
        name: "credit Stripe webhook",
        source: validAppEnvironment.replace(`STRIPE_WEBHOOK_SECRET=${stripeWebhookSecret}`, "STRIPE_WEBHOOK_SECRET="),
        expected: /STRIPE_WEBHOOK_SECRET/,
      },
      {
        name: "widget Stripe webhook",
        source: validAppEnvironment.replace(`STRIPE_WIDGET_WEBHOOK_SECRET=${widgetWebhookSecret}`, "STRIPE_WIDGET_WEBHOOK_SECRET="),
        expected: /STRIPE_WIDGET_WEBHOOK_SECRET/,
      },
      {
        name: "bank transfer",
        source: validAppEnvironment.replace("NEXT_PUBLIC_BANK_IBAN=DE00000000000000000000", "NEXT_PUBLIC_BANK_IBAN="),
        expected: /NEXT_PUBLIC_BANK_IBAN/,
      },
      {
        name: "Google OAuth",
        source: validAppEnvironment.replace(
          "NEXT_PUBLIC_GOOGLE_CLIENT_ID=123456789012-syntheticclientid123.apps.googleusercontent.com",
          "NEXT_PUBLIC_GOOGLE_CLIENT_ID=invalid"
        ),
        expected: /NEXT_PUBLIC_GOOGLE_CLIENT_ID/,
      },
    ];
    for (const contract of invalidAppContracts) {
      writeFileSync(app, contract.source);
      const result = spawnSync(bash, [shellPath(checker), shellPath(app), shellPath(analyzer)], {
        encoding: "utf8",
      });
      assert.notEqual(result.status, 0, `${contract.name} unexpectedly passed`);
      assert.match(result.stderr, contract.expected, contract.name);
      assert.doesNotMatch(result.stderr, new RegExp(resendKey));
      assert.doesNotMatch(result.stderr, new RegExp(stripeSecret));
    }

    writeFileSync(app, validAppEnvironment);
    writeFileSync(
      analyzer,
      validAnalyzerEnvironment.replace(
        "jujaeyvyaeesmipihrrw.supabase.co",
        "jujaeyvyaeesmipihrrw.supabase.co,files.example.test"
      )
    );
    const expandedHosts = spawnSync(
      bash,
      [shellPath(checker), shellPath(app), shellPath(analyzer)],
      { encoding: "utf8" }
    );
    assert.notEqual(expandedHosts.status, 0);
    assert.match(expandedHosts.stderr, /exactly one normalized Production Supabase host/);
    assert.doesNotMatch(expandedHosts.stderr, /files\.example\.test/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Runbook fixes the Caddy contract and separates static assets from data cache", () => {
  const runbook = readProjectFile("docs", "vps-file-service-runbook.md");
  assert.match(runbook, /\/opt\/mgautotech\/file-service/);
  assert.match(runbook, /mgautotech_file_service_edge/);
  assert.match(runbook, /file-service:3000/);
  assert.match(runbook, /file-expert-analyzer:8010/);
  assert.match(runbook, /FILE_EXPERT_ANALYZER_ALLOW_PRIVATE_DOCKER_HTTP=true/);
  assert.match(runbook, /FILE_SERVICE_IMAGE=mgautotech-file-service:<release-id>/);
  assert.match(runbook, /FILE_EXPERT_ANALYZER_IMAGE=mgautotech-file-expert-analyzer:<release-id>/);
  assert.match(runbook, /current plus two[\s\S]*previous release manifests/);
  assert.match(runbook, /\.next\/cache[\s\S]*fresh 128 MiB[\s\S]*tmpfs/);
  assert.match(runbook, /never be changed[\s\S]*0\.0\.0\.0/);
  assert.match(runbook, /Database backup, migration, verification,[\s\S]*separate[\s\S]*release gates/);
});
