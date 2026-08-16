import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function source(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

const authorityMigration = source(
  "supabase",
  "migrations",
  "20260816002443_financial_authority_hardening.sql"
);
const stateMigration = source(
  "supabase",
  "migrations",
  "20260816002444_security_state_hardening.sql"
);
const cutoverMigration = source(
  "supabase",
  "migrations",
  "20260816002449_post_deploy_legacy_rpc_cutover.sql",
);

test("customer Data API grants expose only reviewed profile and order columns", () => {
  const profileGrant = authorityMigration.match(
    /grant select \(([\s\S]*?)\) on table public\.profiles to authenticated/i
  )?.[1] ?? "";
  const orderGrant = authorityMigration.match(
    /grant select \(([\s\S]*?)\) on table public\.orders to authenticated/i
  )?.[1] ?? "";

  for (const column of [
    "internal_admin_note",
    "customer_tags",
    "role",
    "staff_role",
    "staff_permissions",
  ]) {
    assert.doesNotMatch(profileGrant, new RegExp(`\\b${column}\\b`, "i"));
  }
  for (const column of [
    "original_file_path",
    "modified_file_path",
    "modified_files",
    "customer_upload_grant_nonce",
  ]) {
    assert.doesNotMatch(orderGrant, new RegExp(`\\b${column}\\b`, "i"));
  }

  assert.match(profileGrant, /\bcredit_balance\b/i);
  assert.match(orderGrant, /\bid\b/i);
  assert.match(orderGrant, /\bstatus\b/i);
  assert.doesNotMatch(authorityMigration, /grant select on table public\.(?:profiles|orders) to authenticated/i);
});

test("browser authority and delivery UI no longer require raw protected columns", () => {
  const authGuards = source("src", "lib", "authGuards.ts");
  const contextRoute = source("src", "app", "api", "account", "context", "route.ts");
  const notifications = source("src", "components", "CustomerNotifications.tsx");
  const dashboard = source("src", "components", "dashboard", "DashboardClient.tsx");
  const orders = source("src", "app", "dashboard", "orders", "page.tsx");

  assert.match(authGuards, /authenticatedFetch\("\/api\/account\/context"/);
  assert.doesNotMatch(authGuards, /\.from\("profiles"\)[\s\S]{0,100}\.select\("role"\)/);
  assert.match(contextRoute, /requireApiUser\(request\)/);
  assert.match(contextRoute, /isStaffMember\(auth\.access\)/);
  assert.match(notifications, /authenticatedFetch\("\/api\/account\/context"/);
  assert.doesNotMatch(notifications, /\.from\("profiles"\)[\s\S]{0,100}\.select\("role"\)/);

  assert.doesNotMatch(dashboard, /modified_file_path/);
  assert.doesNotMatch(dashboard, /select\("\*",\s*\{ count:/);
  assert.doesNotMatch(dashboard, /createSignedUrl/);
  assert.doesNotMatch(orders, /modified_file_path/);
});

test("web request creation claims an immutable payload atomically", () => {
  const page = source("src", "app", "new-request", "page.tsx");
  const prepare = source("src", "app", "api", "account", "request-upload", "prepare", "route.ts");

  assert.match(stateMigration, /create table public\.web_request_idempotency/i);
  assert.match(stateMigration, /alter table public\.web_request_idempotency enable row level security/i);
  assert.match(stateMigration, /revoke all privileges on table public\.web_request_idempotency[\s\S]*from public, anon, authenticated/i);
  assert.match(stateMigration, /create or replace function public\.create_web_order_with_credit_deduction/i);
  assert.match(stateMigration, /security definer[\s\S]*set search_path = ''/i);
  assert.match(stateMigration, /on conflict \(user_id, idempotency_key\) do nothing/i);
  assert.match(stateMigration, /v_claim\.request_payload is distinct from v_payload/i);
  assert.match(stateMigration, /public\.create_order_with_credit_deduction\(/i);
  assert.match(stateMigration, /'duplicate', true/i);
  assert.match(stateMigration, /grant execute on function public\.create_web_order_with_credit_deduction[\s\S]*to authenticated/i);
  assert.match(
    stateMigration,
    /revoke all privileges on function public\.create_order_with_credit_deduction\([\s\S]*?from public, anon, service_role[\s\S]*?grant execute on function public\.create_order_with_credit_deduction\([\s\S]*?to authenticated/i,
  );
  assert.match(
    cutoverMigration,
    /revoke all privileges on function public\.create_order_with_credit_deduction\([\s\S]*?from public, anon, authenticated, service_role/i,
  );
  assert.match(cutoverMigration, /Private hardened order core\. Direct Data API execution was removed after wrapper deployment/i);

  assert.match(page, /requestSubmissionRef/);
  assert.match(page, /window\.crypto\.randomUUID\(\)/);
  assert.match(page, /window\.sessionStorage\.setItem/);
  assert.match(page, /fingerprintWebRequest/);
  assert.match(page, /selectedFileSha256 = await sha256Hex\(await selectedFile\.arrayBuffer\(\)\)/);
  assert.match(page, /clearPersistedWebRequest\(user\.id\)/);
  assert.match(page, /\/api\/account\/request-upload\/prepare/);
  assert.match(page, /uploadToSignedUrl\(originalFilePath, prepared\.upload\.token/);
  assert.match(page, /create_web_order_with_credit_deduction/);
  assert.match(page, /p_idempotency_key: submission\.idempotencyKey/);
  assert.match(page, /duplicateUpload/);
  assert.match(page, /Number\(storageError\.status\) === 409/);
  assert.match(page, /duplicate\s*\?\s*latestProfile/);
  assert.doesNotMatch(page, /"create_order_with_credit_deduction"/);

  assert.match(prepare, /includeClientIp: false/);
  assert.match(prepare, /readBoundedJsonBody\(request, 16 \* 1024\)/);
  assert.match(prepare, /rate\.source !== "distributed"/);
  assert.match(prepare, /profile\.data\?\.role !== "customer"/);
  assert.match(prepare, /createSignedUploadUrl\(path, \{ upsert: false \}\)/);
  assert.match(prepare, /idempotencyKey: z\.string\(\).*max\(96\)/);
  assert.match(prepare, /sha256: z\.string\(\).*\^\[a-f0-9\]\{64\}\$/);
  assert.match(prepare, /\$\{parsed\.data\.sha256\}-original-/);
});

test("order and owner inputs have database-side bounds and delete protection", () => {
  for (const field of [
    "p_vehicle_generation",
    "p_ecu",
    "p_gearbox",
    "p_vehicle_year",
    "p_read_method",
    "p_license_plate",
    "p_hw_sw",
    "p_master_slave",
  ]) {
    assert.match(
      authorityMigration,
      new RegExp(`length\\(coalesce\\(${field}, ''\\)\\) >`, "i")
    );
  }
  assert.match(authorityMigration, /p_master_slave[\s\S]*not in \('master', 'slave'\)/i);
  assert.match(authorityMigration, /create trigger protect_primary_owner_delete_trigger[\s\S]*before delete on public\.profiles/i);
});

test("integrated state migration blocks are structurally balanced", () => {
  for (const migration of [stateMigration, cutoverMigration]) {
    const dollarQuotes = migration.match(/\$\$/g) ?? [];
    assert.ok(dollarQuotes.length > 0);
    assert.equal(dollarQuotes.length % 2, 0);
    assert.equal(
      (migration.match(/\(/g) ?? []).length,
      (migration.match(/\)/g) ?? []).length
    );
    assert.match(migration.trimEnd(), /commit;$/i);
  }
});
