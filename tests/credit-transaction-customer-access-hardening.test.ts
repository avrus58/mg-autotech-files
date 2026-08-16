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
  "20260816002451_credit_transaction_customer_access_hardening.sql",
);
const cutover = source(
  "supabase",
  "migrations",
  "20260816002452_post_deploy_legacy_rpc_cutover.sql",
);
const verifier = source(
  "scripts",
  "verify-credit-transaction-customer-access-hardening.sql",
);

test("customer credit ledger has an exact read-only Data API projection", () => {
  assert.match(
    migration,
    /revoke all privileges on table public\.credit_transactions\s+from public, anon, authenticated, service_role/i,
  );
  assert.match(
    migration,
    /revoke select \(%1\$I\), insert \(%1\$I\), update \(%1\$I\), references \(%1\$I\)[\s\S]*?from public, anon, authenticated, service_role/i,
  );

  const customerGrant = migration.match(
    /grant select \(([\s\S]*?)\) on table public\.credit_transactions to authenticated/i,
  )?.[1] ?? "";
  const grantedColumns = customerGrant
    .split(",")
    .map((column) => column.trim())
    .filter(Boolean)
    .sort();
  assert.deepEqual(grantedColumns, [
    "amount_total",
    "balance_after",
    "created_at",
    "credits_delta",
    "currency",
    "description",
    "id",
    "source_id",
    "source_type",
    "type",
    "user_id",
  ]);
  assert.doesNotMatch(customerGrant, /\b(?:metadata|created_by)\b/i);
  assert.doesNotMatch(
    migration,
    /grant select on table public\.credit_transactions to authenticated/i,
  );
  assert.match(
    migration,
    /grant all privileges on table public\.credit_transactions to service_role/i,
  );
  assert.doesNotMatch(
    migration,
    /grant\s+(?:insert|update|delete|truncate|references|trigger)[\s\S]{0,120}\bto authenticated\b/i,
  );
});

test("credit ledger RLS is exactly one direct own-row SELECT policy", () => {
  assert.match(
    migration,
    /from pg_catalog\.pg_policies as policy[\s\S]*?tablename = 'credit_transactions'[\s\S]*?drop policy %I on public\.credit_transactions/i,
  );
  const createdPolicies = migration.match(/create policy /gi) ?? [];
  assert.equal(createdPolicies.length, 1);
  assert.match(
    migration,
    /create policy "Customers can read own credit transactions"[\s\S]*?as permissive[\s\S]*?for select[\s\S]*?to authenticated[\s\S]*?using \(\(select auth\.uid\(\)\) = user_id\)/i,
  );
  const newPolicy = migration.match(
    /create policy "Customers can read own credit transactions"[\s\S]*?;/i,
  )?.[0] ?? "";
  assert.doesNotMatch(newPolicy, /profiles|\bor\b|role|staff/i);
});

test("protected Storage cleanup retains only the 13 reviewed transitional policies", () => {
  const cleanup = migration.match(
    /do \$protected_storage_policy_cleanup\$[\s\S]*?\$protected_storage_policy_cleanup\$;/i,
  )?.[0] ?? "";
  const expectedNames = [
    "MG customer files select",
    "MG customer files insert",
    "MG customer files legacy owner insert",
    "MG file expert select",
    "MG file expert legacy owner insert",
    "MG protected buckets select boundary",
    "MG protected buckets insert boundary",
    "MG protected buckets update boundary",
    "MG protected buckets delete boundary",
    "MG protected buckets anon select boundary",
    "MG protected buckets anon insert boundary",
    "MG protected buckets anon update boundary",
    "MG protected buckets anon delete boundary",
  ];
  for (const policyName of expectedNames) {
    assert.match(cleanup, new RegExp(`'${policyName}'`, "i"));
  }
  assert.match(cleanup, /policy\.policyname not in \(/i);
  assert.match(cleanup, /~ '\(customer-files\|file-expert\)'/i);
  assert.match(cleanup, /drop policy %I on storage\.objects/i);
  assert.doesNotMatch(cleanup, /from\s+(?:public\.)?profiles\b/i);
  assert.doesNotMatch(cleanup, /delete\s+from|update\s+storage\.objects/i);
});

test("customer access verifier is SELECT-only and checks ACL, RLS, and Storage", () => {
  const withoutCommentsOrStrings = verifier
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--.*$/gm, " ")
    .replace(/'(?:''|[^'])*'/g, "''");

  assert.match(withoutCommentsOrStrings.trimStart(), /^with\b/i);
  assert.doesNotMatch(
    withoutCommentsOrStrings,
    /\b(insert|update|delete|merge|alter|create|drop|truncate|grant|revoke|call|do)\b/i,
  );
  assert.doesNotMatch(verifier, /from\s+public\.credit_transactions\b/i);
  assert.doesNotMatch(verifier, /from\s+storage\.objects\b/i);
  assert.match(verifier, /exact customer projection/i);
  assert.match(verifier, /exactly one customer-owned SELECT policy/i);
  assert.match(verifier, /pre-cutover canonical allowlist/i);
  assert.match(verifier, /metadata, created_by, and future columns remain private/i);
  assert.match(verifier, /13 transitional policies/i);
});

test("release order keeps 02451 before cutover and 02453 parity last", () => {
  const finalVerifier = source("scripts", "verify-security-state-hardening.sql");
  const preflight = source("scripts", "preflight-integrated-security-release.sql");
  const runbook = source("docs", "integrated-security-release-runbook.md");

  assert.match(finalVerifier, /customer credit ledger is own-row and projection-only/i);
  assert.match(finalVerifier, /Customers can read own credit transactions/i);
  assert.match(finalVerifier, /expected_ledger_columns/i);
  assert.match(finalVerifier, /not like '%profiles%'/i);
  assert.match(finalVerifier, /'service_role',[\s\S]*?'public\.credit_transactions'/i);
  assert.match(finalVerifier, /api_role\.role_name = 'anon'/i);
  assert.match(finalVerifier, /expected_storage_policies as expected/i);
  assert.match(finalVerifier, /~ '\(profiles\|staff_role\|staff_permissions\)'/i);

  const targetVersions = preflight.match(
    /target_versions\(version\) as \([\s\S]*?\n\)/i,
  )?.[0] ?? "";
  assert.match(targetVersions, /20260816002450/);
  assert.match(targetVersions, /20260816002451/);
  assert.match(targetVersions, /20260816002452/);
  assert.match(targetVersions, /20260816002453/);
  assert.doesNotMatch(targetVersions, /20260816002449/);
  assert.match(preflight, /credit_transaction_customer_access_hardening/);

  assert.ok(
    runbook.indexOf("20260816002450_auth_customer_id_generator_hardening.sql")
      < runbook.indexOf("20260816002451_credit_transaction_customer_access_hardening.sql"),
  );
  assert.ok(
    runbook.indexOf("20260816002451_credit_transaction_customer_access_hardening.sql")
      < runbook.indexOf("Deploy the matching application"),
  );
  assert.ok(
    runbook.indexOf("Deploy the matching application")
      < runbook.indexOf("20260816002452_post_deploy_legacy_rpc_cutover.sql"),
  );
  assert.ok(
    runbook.indexOf("20260816002452_post_deploy_legacy_rpc_cutover.sql")
      < runbook.indexOf("20260816002453_email_delivery_schema_parity.sql"),
  );

  assert.equal(
    createHash("sha256").update(migration).digest("hex"),
    "6de1f340791c17d54621dfb9ddb3e6fbb39b0b5f322565b421b34d24ef15ffd9",
  );
  assert.equal(
    createHash("sha256").update(cutover).digest("hex"),
    "5084dfd95dbd878fd1037f7ce497c1362e900ed5d3f931a2626cd448719c84cc",
  );
  assert.equal(
    existsSync(resolve(
      process.cwd(),
      "supabase",
      "migrations",
      "20260816002451_post_deploy_legacy_rpc_cutover.sql",
    )),
    false,
  );
});

test("migration SQL blocks are structurally balanced", () => {
  assert.equal((migration.match(/\$/g) ?? []).length % 2, 0);
  assert.equal(
    (migration.match(/\(/g) ?? []).length,
    (migration.match(/\)/g) ?? []).length,
  );
  assert.match(migration.trimEnd(), /commit;$/i);
});
