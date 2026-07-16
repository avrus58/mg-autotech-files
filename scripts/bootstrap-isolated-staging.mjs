import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const PRODUCTION_REF = "jujaeyvyaeesmipihrrw";
const STAGING_REF = "vxdxdvtsopsjatukdbuq";
const LOCAL_ONLY_MIGRATION = "20260714132000_dtc_phase_a_test_baseline.sql";
const STAGING_MIGRATIONS = [
  "20260714204125_dtc_active_processing_phase_a.sql",
  "20260714212824_dtc_active_processing_phase_c_synthetic_test_output.sql",
  "20260714220848_dtc_phase_c1_durable_synthetic_artifacts.sql",
  "20260715195048_learning_flywheel_candidates.sql",
  "20260716005208_learning_flywheel_production_readiness_hardening.sql",
];

const root = process.cwd();
const runtimeRoot = path.join(root, ".autopilot", "runtime", "staging-bootstrap-workdir");
const runtimeSupabaseDir = path.join(runtimeRoot, "supabase");
const auditPath = path.join(root, ".autopilot", "runtime", "staging-bootstrap-audit.json");
const baselinePath = path.join(root, "supabase", "bootstrap", "mg_autotech_schema_baseline.sql");
const overlaysPath = path.join(root, "supabase", "bootstrap", "managed_schema_overlays.sql");
const preflightPath = path.join(root, "supabase", "bootstrap", "staging_preflight.sql");
const verifyPath = path.join(root, "supabase", "bootstrap", "staging_verify.sql");

function parseArgs(argv) {
  const targetIndex = argv.indexOf("--target-ref");
  return {
    apply: argv.includes("--apply"),
    targetRef: targetIndex >= 0 ? argv[targetIndex + 1] : "",
  };
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function assertTarget(targetRef) {
  if (!targetRef) throw new Error("--target-ref is required");
  if (targetRef === PRODUCTION_REF) throw new Error("Production project ref is forbidden");
  if (targetRef !== STAGING_REF) throw new Error("Target ref is not the authorized isolated staging project");
}

function cliPath() {
  if (process.env.SUPABASE_CLI_PATH) return path.resolve(process.env.SUPABASE_CLI_PATH);
  return path.join(root, "node_modules", ".bin", process.platform === "win32" ? "supabase.cmd" : "supabase");
}

function runCli(cli, args, label, audit) {
  const result = spawnSync(cli, ["--workdir", runtimeRoot, ...args], {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    shell: process.platform === "win32",
    windowsHide: true,
  });
  audit.commands.push({ label, exitCode: result.status ?? 1 });
  if (result.status !== 0) throw new Error(`Supabase CLI step failed: ${label}`);
  return `${result.stdout || ""}\n${result.stderr || ""}`;
}

async function writeAudit(audit) {
  await mkdir(path.dirname(auditPath), { recursive: true });
  await writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`, { encoding: "utf8" });
}

async function prepareRuntimeConfig() {
  await mkdir(runtimeSupabaseDir, { recursive: true });
  const config = await readFile(path.join(root, "supabase", "config.toml"), "utf8");
  await writeFile(
    path.join(runtimeSupabaseDir, "config.toml"),
    config.replace('project_id = "mg-autotech-files"', 'project_id = "mg-autotech-staging-bootstrap"'),
    "utf8",
  );
}

async function main() {
  const { apply, targetRef } = parseArgs(process.argv.slice(2));
  assertTarget(targetRef);

  if (!process.env.SUPABASE_ACCESS_TOKEN || !process.env.SUPABASE_DB_PASSWORD) {
    throw new Error("Staging-only Supabase credentials must be supplied in process memory");
  }

  const cli = cliPath();
  if (!existsSync(cli)) throw new Error("Supabase CLI is unavailable; package installation is not permitted");

  const files = [baselinePath, overlaysPath, ...STAGING_MIGRATIONS.map((name) => path.join(root, "supabase", "migrations", name))];
  for (const file of [...files, preflightPath, verifyPath]) {
    if (!existsSync(file)) throw new Error(`Required bootstrap file is missing: ${path.relative(root, file)}`);
  }
  if (files.some((file) => path.basename(file) === LOCAL_ONLY_MIGRATION)) {
    throw new Error("Local-only fake baseline must never be applied remotely");
  }

  const audit = {
    startedAt: new Date().toISOString(),
    targetRef,
    productionRef: PRODUCTION_REF,
    refsDiffer: targetRef !== PRODUCTION_REF,
    mode: apply ? "apply" : "preflight",
    credentialsPersisted: false,
    files: [],
    commands: [],
    result: "in_progress",
  };

  for (const file of files) {
    const content = await readFile(file);
    audit.files.push({ path: path.relative(root, file).replaceAll("\\", "/"), sha256: sha256(content) });
  }

  await prepareRuntimeConfig();
  let linked = false;
  try {
    runCli(cli, ["link", "--project-ref", targetRef, "--yes"], "link-staging", audit);
    linked = true;
    const linkedRef = (await readFile(path.join(runtimeSupabaseDir, ".temp", "project-ref"), "utf8")).trim();
    if (linkedRef !== STAGING_REF || linkedRef === PRODUCTION_REF) throw new Error("Linked project identity check failed");
    audit.linkedRef = linkedRef;

    const preflight = runCli(cli, ["db", "query", "--linked", "--file", preflightPath], "bootstrap-preflight", audit);
    if (!preflight.includes("MG_BOOTSTRAP_SAFE=true")) throw new Error("Staging target is not empty or bootstrap-safe");
    audit.bootstrapSafe = true;

    if (apply) {
      runCli(cli, ["db", "query", "--linked", "--file", baselinePath], "apply-schema-baseline", audit);
      runCli(cli, ["db", "query", "--linked", "--file", overlaysPath], "apply-managed-overlays", audit);
      for (const name of STAGING_MIGRATIONS) {
        runCli(cli, ["db", "query", "--linked", "--file", path.join(root, "supabase", "migrations", name)], `apply-${name}`, audit);
      }
      const verification = runCli(cli, ["db", "query", "--linked", "--file", verifyPath], "bootstrap-verification", audit);
      if (!verification.includes("MG_BOOTSTRAP_VERIFY=true")) throw new Error("Staging bootstrap verification failed");
      audit.verified = true;
    }

    audit.result = apply ? "applied_and_verified" : "preflight_passed";
    audit.finishedAt = new Date().toISOString();
    await writeAudit(audit);
    console.log(`Staging bootstrap ${audit.result}. Audit: ${path.relative(root, auditPath)}`);
  } catch (error) {
    audit.result = "failed";
    audit.error = error instanceof Error ? error.message : "Unknown bootstrap error";
    audit.finishedAt = new Date().toISOString();
    await writeAudit(audit);
    throw error;
  } finally {
    if (linked) {
      const unlink = spawnSync(cli, ["--workdir", runtimeRoot, "unlink", "--yes"], {
        cwd: root,
        encoding: "utf8",
        env: process.env,
        shell: process.platform === "win32",
        windowsHide: true,
      });
      audit.commands.push({ label: "unlink-staging", exitCode: unlink.status ?? 1 });
      audit.credentialsPersisted = false;
      await writeAudit(audit);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Staging bootstrap failed");
  process.exitCode = 1;
});
