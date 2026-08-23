import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

function source(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

const migration = source(
  "supabase",
  "migrations",
  "20260816002442_current_production_authority_emergency_hardening.sql",
);
const verifier = source(
  "scripts",
  "verify-production-authority-emergency-hardening.sql",
);
const dataPreflight = source(
  "scripts",
  "preflight-production-authority-emergency-data.sql",
);
const fileExpertServer = source("src", "lib", "fileExpert", "server.ts");
const appHotfixPatch = source(
  "patches",
  "20260816002442_current_production_authority_app_hotfix.patch",
);
const vehicleAdminRoute = source(
  "src", "app", "api", "admin", "vehicles", "route.ts",
);

test("emergency signup hardening ignores customer-controlled authority metadata", () => {
  const signup = migration.match(
    /create or replace function public\.handle_new_user\(\)[\s\S]*?\$\$;/i,
  )?.[0] ?? "";

  assert.match(signup, /security definer[\s\S]*?set search_path = ''/i);
  assert.match(signup, /'customer',\s*0\s*\)/i);
  assert.doesNotMatch(signup, /raw_user_meta_data\s*->>\s*'role'/i);
  assert.doesNotMatch(signup, /raw_user_meta_data\s*->>\s*'credit_balance'/i);
  assert.match(migration, /create trigger on_auth_user_created\s+after insert on auth\.users/i);
  assert.match(
    migration,
    /revoke all privileges on function public\.handle_new_user\(\)[\s\S]*?from public, anon, authenticated, service_role/i,
  );
});

test("profile self-update stays compatible but protected fields require authority", () => {
  const profileGuard = migration.match(
    /create or replace function public\.protect_profile_authority_fields\(\)[\s\S]*?\$\$;/i,
  )?.[0] ?? "";

  for (const protectedField of [
    "credit_balance",
    "allow_negative_credits",
    "negative_credit_limit",
    "account_status",
    "internal_admin_note",
    "role",
    "staff_role",
    "staff_permissions",
  ]) {
    assert.match(profileGuard, new RegExp(`'${protectedField}'`, "i"));
  }
  assert.match(profileGuard, /mg_autotech\.profile_financial_write/i);
  assert.match(profileGuard, /public\.has_staff_permission\('credits\.manage'\)/i);
  assert.match(profileGuard, /public\.has_staff_permission\('customers\.manage'\)/i);
  assert.match(profileGuard, /public\.has_staff_permission\('staff\.manage'\)/i);
  assert.match(profileGuard, /profile authority fields are not a coherent authority tuple/i);
  assert.match(profileGuard, /staff_role in \('manager', 'calibrator', 'support'\)/i);
  assert.match(profileGuard, /cardinality\(new\.staff_permissions\)/i);
  assert.match(migration, /create trigger protect_profile_authority_fields_trigger/i);
  assert.match(migration, /profiles_emergency_authority_tuple_check/i);
  assert.match(migration, /\) not valid;/i);
  assert.match(migration, /revoke all privileges on table public\.profiles from public, anon/i);
  assert.match(
    migration,
    /revoke insert, delete, truncate, references, trigger\s+on table public\.profiles from authenticated/i,
  );
  assert.doesNotMatch(
    migration,
    /revoke all privileges on table public\.profiles from public, anon, authenticated/i,
  );
});

test("database and server app guards require coherent staff authority tuples", async () => {
  const {
    hasStaffPermission,
    isPrimaryOwner,
    isStaffMember,
  } = await import(pathToFileURL(
    resolve(process.cwd(), "src", "lib", "staffPermissions.ts"),
  ).href);
  const owner = {
    role: "admin",
    staffRole: "owner",
    permissions: [],
  };
  const delegated = {
    role: "staff",
    staffRole: "manager",
    permissions: ["credits.manage"],
  };
  const malformed = [
    { role: "admin", staffRole: null, permissions: ["credits.manage"] },
    { role: "staff", staffRole: null, permissions: ["credits.manage"] },
    { role: "staff", staffRole: "owner", permissions: ["credits.manage"] },
    { role: "staff", staffRole: "invalid", permissions: ["credits.manage"] },
  ];

  assert.equal(isPrimaryOwner(owner), true);
  assert.equal(isStaffMember(owner), true);
  assert.equal(hasStaffPermission(owner, "staff.manage"), true);
  assert.equal(isStaffMember(delegated), true);
  assert.equal(hasStaffPermission(delegated, "credits.manage"), true);
  for (const access of malformed) {
    assert.equal(isPrimaryOwner(access), false);
    assert.equal(isStaffMember(access), false);
    assert.equal(hasStaffPermission(access, "credits.manage"), false);
  }

  assert.match(fileExpertServer, /legacy role value alone cannot prove Primary Owner/i);
  assert.match(fileExpertServer, /if \(current\.error\?\.code === "42703"\)[\s\S]*?return false;/i);
  assert.doesNotMatch(vehicleAdminRoute, /Primary admin access is allowed by the app guard/i);
  assert.match(appHotfixPatch, /access\.role === "admin" && access\.staffRole === "owner"/i);
  assert.match(appHotfixPatch, /function isDelegatedStaff/i);
  assert.match(appHotfixPatch, /legacy role value alone cannot prove Primary Owner/i);
  assert.doesNotMatch(appHotfixPatch, /^\+.*return legacy\.data\?\.role === "admin"/im);
});

test("is_admin and all catalog-confirmed legacy admin policies become owner-only", () => {
  const isAdmin = migration.match(
    /create or replace function public\.is_admin\(\)[\s\S]*?\$\$;/i,
  )?.[0] ?? "";
  const policyNames = [
    "Admins can view all credit payments",
    "Admins can update all profiles",
    "Admins can view all profiles",
    "Admins can manage AI knowledge profiles",
    "Admins can read AI model runs",
    "Admins can manage AI pattern signatures",
    "Admins can read AI training events",
    "Admins can manage AI training samples",
    "Admins can manage file expert fingerprints",
    "Admins can manage file expert feedback",
    "Admins can manage file expert jobs",
    "Admins can manage known file patterns",
    "Admins can insert credit transactions",
    "Admins can view all credit transactions",
    "Admins can update all orders",
    "Admins can view all orders",
    "Admins can read all customer files",
    "Admins can update modified customer files",
    "Admins can upload modified customer files",
  ];

  assert.match(isAdmin, /security definer[\s\S]*?set search_path = ''/i);
  assert.match(isAdmin, /profile\.role = 'admin'/i);
  assert.match(isAdmin, /profile\.staff_role = 'owner'/i);
  assert.match(
    migration,
    /revoke all privileges on function public\.is_admin\(\)[\s\S]*?from public, anon, authenticated, service_role/i,
  );
  assert.match(migration, /grant execute on function public\.is_admin\(\) to authenticated/i);
  for (const name of policyNames) {
    assert.equal(migration.split(`'${name}'`).length - 1, 1, name);
  }
  assert.match(migration, /alter policy %I on %I\.%I to authenticated/i);
  assert.match(migration, /bucket_id = ''customer-files'' and public\.is_admin\(\)/i);
  assert.doesNotMatch(migration, /create policy "Admins can /i);
});

test("legacy order creation keeps its signature but binds caller, storage and price", () => {
  const orderCore = migration.match(
    /create or replace function public\.create_order_with_credit_deduction\([\s\S]*?\n\$\$;/i,
  )?.[0] ?? "";

  assert.match(orderCore, /v_user_id uuid := auth\.uid\(\)/i);
  assert.match(orderCore, /for update of profile/i);
  assert.match(orderCore, /profile\.role = 'customer'/i);
  assert.match(orderCore, /auth_user\.email_confirmed_at/i);
  assert.match(orderCore, /emergency_resolve_request_service_credits/i);
  assert.match(orderCore, /p_credits_required <> v_expected_credits/i);
  assert.match(orderCore, /p_credits_required < 0/i);
  assert.doesNotMatch(orderCore, /p_credits_required <= 0/i);
  assert.match(orderCore, /if v_expected_credits > 0 then/i);
  assert.match(orderCore, /storage\.objects/i);
  assert.match(orderCore, /v_user_id::text \|\| '\/'/i);
  assert.match(orderCore, /mg_autotech\.profile_financial_write/i);
  assert.match(orderCore, /mg_autotech\.order_credit_debit/i);
  assert.match(migration, /create trigger orders_credit_usage_ledger_trigger/i);
  assert.match(migration, /if v_total < 0 then/i);
  assert.doesNotMatch(migration, /if v_total <= 0 then/i);
  assert.match(migration, /revoke all privileges on table public\.orders from public, anon/i);
  assert.match(
    migration,
    /revoke insert, delete, truncate, references, trigger\s+on table public\.orders from authenticated/i,
  );
  assert.match(
    migration,
    /policy\.polrelid = 'public\.orders'::pg_catalog\.regclass[\s\S]*?policy\.polcmd::text in \('a', 'd', '\*'\)/i,
  );

  assert.doesNotMatch(
    migration,
    /create table(?: if not exists)? public\.request_service_catalog\b/i,
  );
  assert.match(migration, /create table if not exists public\.emergency_request_service_catalog/i);
});

test("current admin credit adjustment remains permission-checked and ledger-backed", () => {
  const emergencyCore = migration.match(
    /create or replace function public\.emergency_staff_adjust_customer_credits\([\s\S]*?\n\$\$;/i,
  )?.[0] ?? "";
  const compatibilityWrapper = migration.match(
    /create or replace function public\.staff_adjust_customer_credits\(\s*p_customer_id uuid,[\s\S]*?\n\$\$;/i,
  )?.[0] ?? "";

  assert.match(emergencyCore, /'credits\.manage' = any\(actor\.staff_permissions\)/i);
  assert.match(emergencyCore, /for update/i);
  assert.match(emergencyCore, /mg_autotech\.profile_financial_write/i);
  assert.match(emergencyCore, /insert into public\.credit_transactions/i);
  assert.match(emergencyCore, /created_by/i);
  assert.match(compatibilityWrapper, /not public\.has_staff_permission\('credits\.manage'\)/i);
  assert.match(compatibilityWrapper, /emergency_staff_adjust_customer_credits/i);
  assert.match(compatibilityWrapper, /legacy credit adjustment rpc is disabled/i);
  assert.match(
    compatibilityWrapper,
    /to_regprocedure\(\s*'public\.staff_adjust_customer_credits\(uuid,numeric,text,uuid\)'/i,
  );
});

test("all six production finance entry points lose PUBLIC, anon and unreviewed authenticated access", () => {
  const signatures = [
    String.raw`public\.add_credits_from_stripe\(\s*uuid, text, text, text, text, numeric, numeric, text\s*\)`,
    String.raw`public\.admin_adjust_customer_credits\(uuid, integer, text\)`,
    String.raw`public\.admin_add_credits\(uuid, integer, text\)`,
    String.raw`public\.admin_apply_payment_refund\(uuid, uuid, text, text\)`,
    String.raw`public\.admin_record_bank_payment\(\s*uuid, uuid, text, numeric, bigint, text, text\s*\)`,
    String.raw`public\.create_order_with_credit_deduction\(\s*text, text, text, text, text, text, integer, text, text,\s*text, text, text, text, text, text, text, text\s*\)`,
  ];

  for (const signature of signatures) {
    assert.match(
      migration,
      new RegExp(
        `revoke all privileges on function\\s+${signature}\\s+from public, anon, authenticated, service_role`,
        "i",
      ),
    );
  }

  assert.doesNotMatch(
    migration,
    /grant execute on function public\.admin_(?:add_credits|adjust_customer_credits)/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.admin_record_bank_payment\([\s\S]*?\) to service_role/i,
  );
});

test("canonical-schema rehearsal cannot reopen post-02452 legacy RPC access", () => {
  assert.match(migration, /v_modern_contract_count not in \(0, 4\)/i);
  assert.match(migration, /partial modern financial contract state/i);
  assert.match(
    migration,
    /to_regprocedure\(\s*'public\.create_web_order_with_credit_deduction\(/i,
  );
  assert.match(
    migration,
    /to_regprocedure\(\s*'public\.add_credits_from_stripe\(uuid,text,text,text,text,numeric,numeric,text,uuid\)'/i,
  );
  assert.match(
    migration,
    /to_regprocedure\(\s*'public\.admin_apply_payment_refund\(uuid,uuid,text,text,uuid\)'/i,
  );
  assert.match(
    migration,
    /if pg_catalog\.to_regprocedure\([\s\S]*?\) is null then[\s\S]*?execute[\s\S]*?grant execute/i,
  );
  assert.doesNotMatch(
    migration,
    /grant execute on function public\.create_order_with_credit_deduction\([\s\S]*?\) to authenticated;/i,
  );
  assert.doesNotMatch(
    migration,
    /grant execute on function public\.add_credits_from_stripe\([\s\S]*?\) to service_role;/i,
  );
});

test("emergency verifier is SELECT-only and never reads customer relations", () => {
  const withoutCommentsOrStrings = verifier
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--.*$/gm, " ")
    .replace(/'(?:''|[^'])*'/g, "''");

  assert.match(withoutCommentsOrStrings.trimStart(), /^with\b/i);
  assert.doesNotMatch(
    withoutCommentsOrStrings,
    /\b(insert|update|delete|merge|alter|create|drop|truncate|grant|revoke|call|do)\b/i,
  );
  assert.doesNotMatch(verifier, /from\s+(?:public\.)?profiles\b/i);
  assert.doesNotMatch(verifier, /from\s+auth\.users\b/i);
  assert.doesNotMatch(verifier, /from\s+(?:public\.)?orders\b/i);
  assert.doesNotMatch(verifier, /from\s+(?:public\.)?(?:payment_records|credit_transactions)\b/i);
  assert.match(verifier, /legacy finance functions have no PUBLIC EXECUTE/i);
  assert.match(verifier, /legacy order RPC is caller-bound, locked and server-priced/i);
  assert.match(verifier, /profile trigger guards finance, account and authority fields/i);
  assert.match(verifier, /all 19 legacy admin policies are owner-only or absent after canonical cutover/i);
  assert.match(verifier, /is_admin is exact owner-only fixed-path authority/i);
  assert.match(verifier, /no public or storage policy retains a raw profiles role-admin check/i);
  assert.match(verifier, /authority functions have exact owner, path and definer mode/i);
  assert.match(verifier, /authority helper and trigger functions have exact ACLs/i);
  assert.match(verifier, /order credit ledger trigger is one exact enabled AFTER INSERT trigger/i);
  assert.match(verifier, /profiles Data API retains only authenticated read\/update compatibility/i);
  assert.match(verifier, /orders Data API cannot bypass the caller-bound creation RPC/i);
  assert.match(
    verifier,
    /has_any_column_privilege\(\s*'authenticated', relation\.oid, 'SELECT'\s*\)/i,
  );
  assert.match(
    verifier,
    /has_any_column_privilege\(\s*'authenticated', relation\.oid, 'UPDATE'\s*\)\s*= not state\.modern_web_order/i,
  );
  assert.match(verifier, /schema phase is fully legacy or fully canonical/i);
  assert.match(verifier, /relation_owner\.rolname = 'postgres'/i);

  const checksBody = verifier.slice(
    verifier.indexOf("checks(check_name, ok, details) as ("),
    verifier.lastIndexOf("\nselect\n  check_name"),
  );
  assert.equal(
    (checksBody.match(/\n  select\r?\n    '[^']+',/g) ?? []).length,
    21,
    "verifier must emit every deterministic check row",
  );
});

test("Production data preflight emits aggregate anomaly counts only", () => {
  const withoutCommentsOrStrings = dataPreflight
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--.*$/gm, " ")
    .replace(/'(?:''|[^'])*'/g, "''");

  assert.match(withoutCommentsOrStrings.trimStart(), /^with\b/i);
  assert.doesNotMatch(
    withoutCommentsOrStrings,
    /\b(insert|update|delete|merge|alter|create|drop|truncate|grant|revoke|call|do)\b/i,
  );
  assert.match(dataPreflight, /from public\.profiles as profile/i);
  assert.match(dataPreflight, /fractional_credit_balance_count/i);
  assert.match(dataPreflight, /out_of_range_negative_limit_count/i);
  assert.match(dataPreflight, /customer_authority_anomaly_count/i);
  assert.match(dataPreflight, /malformed_staff_authority_count/i);
  assert.match(dataPreflight, /modern_contract_count/i);
  assert.match(dataPreflight, /legacy_contract_phase_ready/i);
  assert.match(dataPreflight, /schema_contract_phase_coherent/i);
  assert.match(dataPreflight, /true as data_containment_apply_required/i);
  assert.match(dataPreflight, /finance_functional_go_ready/i);
  assert.match(dataPreflight, /authority_incident_close_ready/i);
  assert.match(dataPreflight, /normal_operation_ready/i);
  assert.doesNotMatch(dataPreflight, /profile\.(?:id|email|customer_id|full_name|phone)\b/i);
  assert.doesNotMatch(dataPreflight, /\blimit\b|\border by\b/i);
});

test("emergency SQL transaction and PL/pgSQL delimiters are balanced", () => {
  assert.match(migration.trimStart(), /^--[\s\S]*?\nbegin;/i);
  assert.match(migration, /set local lock_timeout = '5s'/i);
  assert.match(migration, /set local statement_timeout = '120s'/i);
  assert.match(migration.trimEnd(), /commit;$/i);
  assert.equal((migration.match(/\$\$/g) ?? []).length % 2, 0);
  assert.equal(
    (migration.match(/\(/g) ?? []).length,
    (migration.match(/\)/g) ?? []).length,
  );
});
