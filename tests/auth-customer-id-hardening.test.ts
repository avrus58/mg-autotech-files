import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function source(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

const migration = source(
  "supabase",
  "migrations",
  "20260816002450_auth_customer_id_generator_hardening.sql",
);
const verifier = source("scripts", "verify-auth-customer-id-hardening.sql");

test("customer ID allocation uses a private fixed-path trigger chain", () => {
  assert.match(
    migration,
    /create or replace function public\.generate_customer_id\(\)[\s\S]*?security definer[\s\S]*?set search_path = ''/i,
  );
  assert.match(
    migration,
    /pg_catalog\.nextval\(\s*'public\.customer_id_seq'::pg_catalog\.regclass\s*\)/i,
  );
  assert.match(
    migration,
    /create or replace function public\.set_customer_id\(\)[\s\S]*?security definer[\s\S]*?set search_path = ''[\s\S]*?new\.customer_id := public\.generate_customer_id\(\)/i,
  );
  const setCustomerId = migration.match(
    /create or replace function public\.set_customer_id\(\)[\s\S]*?\$\$;/i,
  )?.[0] ?? "";
  assert.doesNotMatch(setCustomerId, /:=\s*generate_customer_id\(\)/i);

  for (const functionName of [
    "generate_customer_id",
    "set_customer_id",
    "handle_new_user",
  ]) {
    assert.match(
      migration,
      new RegExp(
        `alter function public\\.${functionName}\\(\\) owner to postgres`,
        "i",
      ),
    );
    assert.match(
      migration,
      new RegExp(
        `revoke all privileges on function public\\.${functionName}\\(\\)[\\s\\S]*?from public, anon, authenticated, service_role`,
        "i",
      ),
    );
  }

  assert.match(migration, /alter function public\.handle_new_user\(\) security definer/i);
  assert.match(migration, /alter function public\.handle_new_user\(\) set search_path = ''/i);

  assert.match(migration, /alter sequence public\.customer_id_seq owner to postgres/i);
  assert.match(
    migration,
    /revoke all privileges on sequence public\.customer_id_seq[\s\S]*?from public, anon, authenticated, service_role/i,
  );
});

test("customer ID and Auth trigger boundaries are exact single-event triggers", () => {
  assert.match(
    migration,
    /create trigger profiles_customer_id_trigger\s+before insert on public\.profiles\s+for each row execute function public\.set_customer_id\(\)/i,
  );
  assert.match(migration, /trigger_info\.tgtype::integer = 5/i);
  assert.match(migration, /trigger_info\.tgenabled = 'O'/i);
  assert.doesNotMatch(migration, /trigger_info\.tgenabled <> 'D'/i);
  assert.doesNotMatch(migration, /create trigger on_auth_user_created/i);
  assert.doesNotMatch(migration, /drop trigger[^;]*on auth\.users/i);
  assert.equal((migration.match(/\$\$/g) ?? []).length % 2, 0);
  assert.equal(
    (migration.match(/\(/g) ?? []).length,
    (migration.match(/\)/g) ?? []).length,
  );
  assert.match(migration.trimEnd(), /commit;$/i);

  assert.match(verifier, /tgtype::integer = 7/i);
  assert.match(verifier, /tgtype::integer = 5/i);
  assert.match(verifier, /customer ID sequence is postgres-owned and private/i);
  assert.match(verifier, /customer ID helpers use only schema-qualified dependencies/i);
  assert.match(verifier, /no Data API or PUBLIC EXECUTE/i);
  assert.match(verifier, /pg_catalog\.strpos\(/i);
  assert.doesNotMatch(verifier, /pg_catalog\.(?:position|substring)\(/i);
});

test("customer ID verifier is SELECT-only and returns aggregate catalog state", () => {
  const withoutCommentsOrStrings = verifier
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--.*$/gm, " ")
    .replace(/\$\$[\s\S]*?\$\$/g, "''")
    .replace(/'(?:''|[^'])*'/g, "''");

  assert.match(withoutCommentsOrStrings.trimStart(), /^with\b/i);
  assert.doesNotMatch(
    withoutCommentsOrStrings,
    /\b(insert|update|delete|merge|alter|create|drop|truncate|grant|revoke|call|do)\b/i,
  );
  assert.doesNotMatch(verifier, /from\s+public\.profiles\b/i);
  assert.doesNotMatch(verifier, /from\s+auth\.users\b/i);
});

test("release order fixes Auth before the byte-identical 02451 cutover", () => {
  const preflight = source("scripts", "preflight-integrated-security-release.sql");
  const runbook = source("docs", "integrated-security-release-runbook.md");
  const cutover = source(
    "supabase",
    "migrations",
    "20260816002451_post_deploy_legacy_rpc_cutover.sql",
  );
  const targetVersions = preflight.match(
    /target_versions\(version\) as \([\s\S]*?\n\)/i,
  )?.[0] ?? "";

  assert.match(targetVersions, /20260816002450/);
  assert.match(targetVersions, /20260816002451/);
  assert.doesNotMatch(targetVersions, /20260816002449/);
  assert.equal(
    createHash("sha256").update(migration).digest("hex"),
    "8131e02e582d5e16c18f6262515e402aec2a4dbafaa1e3029362e80ea8f8c792",
  );
  assert.match(runbook, /8131E02E582D5E16C18F6262515E402AEC2A4DBAFAA1E3029362E80EA8F8C792/);
  assert.ok(
    runbook.indexOf("20260816002450_auth_customer_id_generator_hardening.sql")
      < runbook.indexOf("Deploy the matching application"),
  );
  assert.ok(
    runbook.indexOf("Deploy the matching application")
      < runbook.indexOf("20260816002451_post_deploy_legacy_rpc_cutover.sql"),
  );
  assert.equal(
    createHash("sha256").update(cutover).digest("hex"),
    "5084dfd95dbd878fd1037f7ce497c1362e900ed5d3f931a2626cd448719c84cc",
  );
  assert.equal(
    existsSync(
      resolve(
        process.cwd(),
        "supabase",
        "migrations",
        "20260816002449_post_deploy_legacy_rpc_cutover.sql",
      ),
    ),
    false,
  );
});
