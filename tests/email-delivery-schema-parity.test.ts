import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function source(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8").replace(
    /\r\n?/g,
    "\n",
  );
}

const migration = source(
  "supabase",
  "migrations",
  "20260816002453_email_delivery_schema_parity.sql",
);
const verifier = source(
  "scripts",
  "verify-email-delivery-schema-parity.sql",
);

test("email delivery parity migration restores the canonical schema", () => {
  for (const column of [
    "delivery_status",
    "last_delivery_event_at",
    "delivered_at",
    "delayed_at",
    "bounced_at",
    "complained_at",
  ]) {
    assert.match(
      migration,
      new RegExp(`add column if not exists ${column}`, "i"),
    );
  }

  assert.match(
    migration,
    /add constraint email_events_delivery_status_check[\s\S]*?'pending'[\s\S]*?'delivered'[\s\S]*?'complained'[\s\S]*?'suppressed'[\s\S]*?'skipped'/i,
  );
  assert.match(migration, /create index if not exists email_events_provider_message_id_idx/i);
  assert.match(migration, /create index if not exists email_events_delivery_status_idx/i);

  assert.match(migration, /create table if not exists public\.email_delivery_events/i);
  assert.match(migration, /provider_event_id text primary key/i);
  assert.match(migration, /email_event_id uuid[\s\S]*?references public\.email_events\(id\)[\s\S]*?on delete set null/i);
  assert.match(migration, /provider_event_type text not null[\s\S]*?'email\.delivery_delayed'[\s\S]*?'email\.suppressed'/i);
  assert.match(migration, /payload_sha256 text not null[\s\S]*?'\^\[a-f0-9\]\{64\}\$'/i);

  assert.match(migration, /create table if not exists public\.email_suppressions/i);
  assert.match(migration, /recipient_email text primary key/i);
  assert.match(migration, /reason text not null[\s\S]*?'hard_bounce'[\s\S]*?'manual'/i);
  assert.match(migration, /source_event_id text[\s\S]*?references public\.email_delivery_events\(provider_event_id\)[\s\S]*?on delete set null/i);
  assert.match(migration, /resolved_by uuid[\s\S]*?references auth\.users\(id\)[\s\S]*?on delete set null/i);
  assert.match(migration, /create index if not exists email_suppressions_active_idx/i);

  assert.doesNotMatch(migration, /\bfile_fingerprints\b/i);
  assert.doesNotMatch(migration, /\bdrop\s+table\b|\btruncate\b|\bdelete\s+from\b/i);
});

test("email delivery tables remain service API only after parity", () => {
  for (const table of ["email_delivery_events", "email_suppressions"]) {
    assert.match(
      migration,
      new RegExp(`alter table public\\.${table} enable row level security`, "i"),
    );
    assert.match(
      migration,
      new RegExp(
        `revoke all privileges on table public\\.${table}\\s+from public, anon, authenticated, service_role`,
        "i",
      ),
    );
    assert.match(
      migration,
      new RegExp(`grant all privileges on table public\\.${table} to service_role`, "i"),
    );
  }

  assert.match(
    migration,
    /from pg_catalog\.pg_policies as policy[\s\S]*?drop policy %I on public\.%I/i,
  );
  assert.match(
    migration,
    /revoke select \(%1\$I\), insert \(%1\$I\), update \(%1\$I\), references \(%1\$I\)[\s\S]*?from public, anon, authenticated, service_role/i,
  );
  assert.doesNotMatch(migration, /\bcreate\s+policy\b/i);
  assert.doesNotMatch(
    migration,
    /grant\s+(?:select|insert|update|delete|all privileges)[\s\S]{0,120}\bto\s+(?:public|anon|authenticated)\b/i,
  );
});

test("focused parity verifier is SELECT-only and reads metadata only", () => {
  const withoutCommentsOrStrings = verifier
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--.*$/gm, " ")
    .replace(/'(?:''|[^'])*'/g, "''");

  assert.match(withoutCommentsOrStrings.trimStart(), /^with\b/i);
  assert.doesNotMatch(
    withoutCommentsOrStrings,
    /\b(insert|update|delete|merge|alter|create|drop|truncate|grant|revoke|call|do)\b/i,
  );
  assert.doesNotMatch(verifier, /from\s+public\.email_/i);
  assert.doesNotMatch(verifier, /recipient_email\s*,|provider_event_id\s*,/i);
  assert.match(verifier, /email event delivery projection is complete/i);
  assert.match(verifier, /email delivery event schema is exact/i);
  assert.match(verifier, /email suppression schema is exact/i);
  assert.match(verifier, /only service_role holds table or column authority/i);
  assert.match(verifier, /have no Data API policies/i);
  assert.equal((verifier.match(/\n\s*union all\n/gi) ?? []).length + 1, 7);
});

test("integrated verifier requires canonical relations and treats only the legacy fingerprint as optional", () => {
  const integrated = source("scripts", "verify-security-state-hardening.sql");
  const relationBlock = integrated.match(
    /api_only_relations\(relation_name, required\) as \([\s\S]*?\n\),\nexpected_storage_policies/i,
  )?.[0] ?? "";
  const relationEntries = [...relationBlock.matchAll(
    /\('([^']+)',\s*(true|false)\)/g,
  )].map((match) => ({ name: match[1], required: match[2] === "true" }));

  assert.equal(relationEntries.filter((entry) => entry.required).length, 22);
  assert.deepEqual(
    relationEntries.filter((entry) => !entry.required),
    [{ name: "file_fingerprints", required: false }],
  );
  assert.deepEqual(
    relationEntries
      .filter((entry) => [
        "email_delivery_events",
        "email_suppressions",
        "file_expert_binary_fingerprints",
      ].includes(entry.name))
      .map((entry) => entry.required),
    [true, true, true],
  );
  assert.match(
    integrated,
    /not required and pg_catalog\.to_regclass\('public\.' \|\| relation_name\) is null/i,
  );
  assert.match(integrated, /canonical relations plus optional legacy relations checked/i);
});

test("release metadata orders and freezes 02453 after the unchanged cutover", () => {
  const runbook = source("docs", "integrated-security-release-runbook.md");
  const preflight = source("scripts", "preflight-integrated-security-release.sql");
  const digest = createHash("sha256").update(migration).digest("hex").toUpperCase();

  assert.ok(
    runbook.indexOf("20260816002452_post_deploy_legacy_rpc_cutover.sql")
      < runbook.indexOf("20260816002453_email_delivery_schema_parity.sql"),
  );
  assert.match(runbook, new RegExp(digest));
  assert.match(runbook, /verify-email-delivery-schema-parity\.sql/i);
  assert.match(preflight, /20260816002453/);
  assert.match(preflight, /email_delivery_schema_parity/);

  const frozenHashes = new Map([
    ["20260816002443_financial_authority_hardening.sql", "61fc3d7b0b0d515abe69dda57ba4c0a3b07c1e12e24109a1e2f06dcc6410a5ea"],
    ["20260816002444_security_state_hardening.sql", "62e7b08fde1dfd3566ab997dc3e9896350db753e2bc2fcfe9ca4e74d51c15fb3"],
    ["20260816002445_widget_final_hardening.sql", "59caf2338c85f3114d8d80e46792ac227eea00b0acee870a6b05f1ea45b76728"],
    ["20260816002446_stripe_recovery_hardening.sql", "cbe9e0938cc1a72b007f175d484df00f7d6a064a0d7c0a6e81f78118bd10ec5d"],
    ["20260816002447_file_expert_atomic_completion.sql", "4b202715c9e96d475fd9578e8a18b6d3e4a3047dd84575b1d1d0f2aad3d0ce4f"],
    ["20260816002448_widget_checkout_atomic_claim.sql", "b581019df5c08ac0529e260fd7df41ed86b322801dec57efb33e5451727111b4"],
    ["20260816002450_auth_customer_id_generator_hardening.sql", "8131e02e582d5e16c18f6262515e402aec2a4dbafaa1e3029362e80ea8f8c792"],
    ["20260816002451_credit_transaction_customer_access_hardening.sql", "6de1f340791c17d54621dfb9ddb3e6fbb39b0b5f322565b421b34d24ef15ffd9"],
    ["20260816002452_post_deploy_legacy_rpc_cutover.sql", "5084dfd95dbd878fd1037f7ce497c1362e900ed5d3f931a2626cd448719c84cc"],
  ]);
  for (const [fileName, expected] of frozenHashes) {
    assert.equal(
      createHash("sha256")
        .update(source("supabase", "migrations", fileName))
        .digest("hex"),
      expected,
      fileName,
    );
  }
});

test("02453 SQL blocks are structurally balanced and transactional", () => {
  assert.equal((migration.match(/\$/g) ?? []).length % 2, 0);
  assert.equal(
    (migration.match(/\(/g) ?? []).length,
    (migration.match(/\)/g) ?? []).length,
  );
  assert.match(migration.trimEnd(), /commit;$/i);
});
