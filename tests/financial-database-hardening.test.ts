import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function source(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

const migrationPath = [
  "supabase",
  "migrations",
  "20260816002443_financial_authority_hardening.sql",
];
const cutoverMigration = source(
  "supabase",
  "migrations",
  "20260816002449_post_deploy_legacy_rpc_cutover.sql",
);
const postCutoverVerification = source(
  "scripts",
  "verify-post-deploy-legacy-rpc-cutover.sql",
);

test("request credits come from the existing shared service catalog", () => {
  const contracts = source("src", "lib", "desktopUpload", "contracts.ts");
  const browser = source("src", "app", "new-request", "page.tsx");
  const migration = source(...migrationPath);
  const servicePattern = /\{\s*id: "([^"]+)",\s*title: "([^"]+)",\s*credits: (\d+)/g;
  const services = [...contracts.matchAll(servicePattern)].map((match) => ({
    id: match[1],
    title: match[2],
    credits: Number(match[3]),
  }));
  const browserServices = [...browser.matchAll(servicePattern)].map((match) => ({
    id: match[1],
    title: match[2],
    credits: Number(match[3]),
  }));

  assert.equal(services.length, 63);
  assert.deepEqual(browserServices, services);
  assert.equal(new Set(services.map((service) => service.id)).size, 63);
  assert.equal(new Set(services.map((service) => service.title)).size, 63);
  for (const service of services) {
    assert.match(
      migration,
      new RegExp(
        `\\('${service.id}',\\s*'(?:primary|extra)',\\s*'${service.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}',\\s*${service.credits},\\s*true\\)`,
        "i"
      )
    );
  }

  assert.match(migration, /create table public\.request_service_catalog/i);
  assert.match(migration, /alter table public\.request_service_catalog enable row level security/i);
  assert.match(migration, /revoke all privileges on table public\.request_service_catalog from public, anon, authenticated/i);
  assert.match(migration, /create or replace function public\.resolve_request_service_credits/i);
  assert.match(migration, /set search_path = ''/i);

  const catalogRows = [...migration.matchAll(
    /\('([^']+)', '(primary|extra)', '([^']+)', (\d+), true\)/g
  )]
    .map((match) => [match[1], match[2], match[3], match[4]])
    .sort((left, right) => left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0);
  assert.equal(catalogRows.length, 63);
  assert.deepEqual(catalogRows[0], ["adblue_off", "extra", "AdBlue / SCR Removal", "11"]);
  assert.deepEqual(catalogRows.at(-1), ["water_pump", "extra", "Water Pump Removal", "5"]);
  const primaryIds = new Set([
    "only_options", "stage_1", "stage_2", "stage_3", "eco_tuning",
    "tcu_stage_1", "tcu_stage_2", "tcu_stage_3", "original_file",
  ]);
  const expectedCatalogRows = services
    .map((service) => [
      service.id,
      primaryIds.has(service.id) ? "primary" : "extra",
      service.title,
      String(service.credits),
    ])
    .sort((left, right) => left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0);
  assert.deepEqual(catalogRows, expectedCatalogRows);
  const catalogPayload = catalogRows.reduce(
    (payload, row, index) =>
      `${payload}${index === 0 ? "" : String.fromCharCode(10)}${row.join("|")}`,
    ""
  );
  const digest = createHash("md5")
    .update(catalogPayload)
    .digest("hex");
  assert.equal(digest, "2427f91d02b9e799d5055ab95486e47a");
  assert.match(
    source("scripts", "verify-financial-authority-hardening.sql"),
    new RegExp(digest)
  );
});

test("order creation is caller-bound, locked, bounded and server-priced", () => {
  const migration = source(...migrationPath);
  const browser = source("src", "app", "new-request", "page.tsx");

  assert.match(migration, /v_user_id uuid := auth\.uid\(\)/i);
  assert.match(migration, /p_credits_required\s+is null[\s\S]*p_credits_required <= 0[\s\S]*p_credits_required > 100000/i);
  assert.match(migration, /v_expected_credits := public\.resolve_request_service_credits\(p_service_type\)/i);
  assert.match(migration, /p_credits_required <> v_expected_credits/i);
  assert.match(migration, /left join auth\.users as auth_user on auth_user\.id = profile\.id/i);
  assert.match(migration, /where profile\.id = v_user_id[\s\S]*?profile\.role = 'customer'[\s\S]*?for update of profile/i);
  assert.match(migration, /v_balance not between -2147483648 and 2147483647/i);
  assert.match(migration, /v_negative_limit not between 0 and 100000/i);
  assert.match(migration, /p_original_file_path[\s\S]*v_user_id::text \|\| '\/'/i);
  assert.match(migration, /insert into public\.orders[\s\S]*v_expected_credits/i);
  assert.match(migration, /mg_autotech\.order_credit_debit/i);
  assert.match(migration, /v_financial_marker not in \('order_debit', 'staff_adjustment'\)/i);
  assert.doesNotMatch(migration, /on conflict \(source_type, source_id\) do nothing/i);
  assert.match(browser, /Number\.isInteger\(totalCredits\)[\s\S]*totalCredits > 0/);
  assert.match(browser, /select at least one service with a positive credit value/i);

  const createOrderGrant = migration.match(
    /grant execute on function public\.create_order_with_credit_deduction\([\s\S]*?;/i
  )?.[0] ?? "";
  assert.match(createOrderGrant, /\) to authenticated;$/i);
  assert.doesNotMatch(createOrderGrant, /\) to (?:anon|public|service_role);$/i);
});

test("financial RPCs use explicit least-privilege grants across the compatibility window", () => {
  const migration = source(...migrationPath);

  for (const functionName of [
    "add_credits_from_stripe",
    "admin_adjust_customer_credits",
    "admin_record_bank_payment",
    "admin_apply_payment_refund",
    "create_customer_order_notification",
    "handle_new_user",
    "is_admin",
    "staff_adjust_customer_credits",
  ]) {
    assert.match(
      migration,
      new RegExp(`create or replace function public\\.${functionName}[\\s\\S]*?security definer[\\s\\S]*?set search_path = ''`, "i")
    );
  }

  assert.match(migration, /revoke all privileges on function %s from public, anon, authenticated, service_role/i);
  assert.match(migration, /alter function %s owner to postgres/i);
  assert.match(migration, /alter policy %I on %I\.%I to authenticated/i);
  assert.match(migration, /0 = any\(policy\.polroles\)/i);
  assert.match(migration, /'%is_admin\(\)%'/i);
  assert.match(migration, /'%is_primary_owner\(\)%'/i);
  assert.match(migration, /coalesce\(auth\.jwt\(\) ->> 'role', ''\) <> 'service_role'/i);
  assert.match(migration, /public\.has_staff_permission\('credits\.manage'\)/i);
  assert.match(migration, /'mg_autotech\.profile_financial_write',[\s\S]*?'staff_adjustment'/i);
  assert.match(migration, /from public\.payment_records as payment[\s\S]*for update/i);
  assert.match(migration, /from public\.profiles as profile[\s\S]*for update/i);
  assert.match(migration, /from public\.profiles as actor[\s\S]*for share/i);
  assert.match(migration, /v_payment\.credits_applied_at is null/i);
  assert.match(migration, /stripe ledger row exists without its credit payment record/i);

  assert.doesNotMatch(migration, /grant execute on function public\.admin_add_credits/i);
  assert.doesNotMatch(migration, /grant execute on function public\.admin_adjust_customer_credits/i);
  assert.match(migration, /grant execute on function public\.add_credits_from_stripe\([\s\S]*?\) to service_role/i);
  assert.match(migration, /grant execute on function public\.admin_record_bank_payment\([\s\S]*?\) to service_role/i);
  assert.match(migration, /grant execute on function public\.admin_apply_payment_refund\([\s\S]*?\) to service_role/i);
  assert.match(
    migration,
    /grant execute on function public\.staff_adjust_customer_credits\(\s*uuid,\s*numeric,\s*text\s*\) to authenticated/i
  );
  assert.match(
    migration,
    /grant execute on function public\.staff_adjust_customer_credits\(\s*uuid,\s*numeric,\s*text,\s*uuid\s*\) to authenticated/i
  );
  assert.match(cutoverMigration, /revoke all privileges on function public\.staff_adjust_customer_credits\(\s*uuid,\s*numeric,\s*text\s*\)[\s\S]*from public, anon, authenticated, service_role/i);
  assert.match(migration, /create or replace function public\.handle_new_user[\s\S]*?credit_balance[\s\S]*?'customer'/i);
  const handleNewUser = migration.match(
    /create or replace function public\.handle_new_user\(\)[\s\S]*?\$\$;/i
  )?.[0] ?? "";
  assert.doesNotMatch(handleNewUser, /raw_user_meta_data\s*->>\s*'role'/i);
  assert.doesNotMatch(migration, /grant execute on function public\.handle_new_user/i);
  const isAdmin = migration.match(
    /create or replace function public\.is_admin\(\)[\s\S]*?\$\$;/i
  )?.[0] ?? "";
  assert.match(isAdmin, /profile\.staff_role = 'owner'/i);
});

test("staff credit adjustments are transactionally idempotent across retries", () => {
  const migration = source(...migrationPath);
  const page = source("src", "app", "admin", "page.tsx");
  const verification = source("scripts", "verify-financial-authority-hardening.sql");

  assert.match(migration, /create table public\.staff_credit_adjustment_idempotency/i);
  assert.match(migration, /idempotency_key uuid primary key/i);
  assert.match(migration, /actor_id uuid not null[\s\S]*customer_id uuid not null[\s\S]*amount numeric not null[\s\S]*note text/i);
  assert.match(migration, /alter table public\.staff_credit_adjustment_idempotency enable row level security/i);
  assert.match(
    migration,
    /revoke all privileges on table public\.staff_credit_adjustment_idempotency[\s\S]*?from public, anon, authenticated, service_role/i
  );
  assert.match(
    migration,
    /create or replace function public\.staff_adjust_customer_credits\(\s*p_customer_id uuid,\s*p_amount numeric,\s*p_note text,\s*p_idempotency_key uuid\s*\)/i
  );
  assert.match(migration, /insert into public\.staff_credit_adjustment_idempotency[\s\S]*on conflict \(idempotency_key\) do nothing[\s\S]*returning \* into v_claim/i);
  assert.match(migration, /from public\.staff_credit_adjustment_idempotency as claim[\s\S]*where claim\.idempotency_key = p_idempotency_key[\s\S]*for update/i);
  assert.match(migration, /v_claim\.actor_id is distinct from v_actor_id/i);
  assert.match(migration, /v_claim\.customer_id is distinct from p_customer_id/i);
  assert.match(migration, /v_claim\.amount is distinct from p_amount/i);
  assert.match(migration, /convert_to\(v_claim\.note, 'UTF8'\)[\s\S]*convert_to\(p_note, 'UTF8'\)/i);
  assert.match(migration, /return v_claim\.balance_after/i);
  assert.match(migration, /source_id,[\s\S]*v_transaction_id[\s\S]*'idempotency_key', p_idempotency_key/i);
  assert.match(migration, /update public\.staff_credit_adjustment_idempotency[\s\S]*completed_at = pg_catalog\.now\(\)/i);
  assert.match(migration, /not public\.has_staff_permission\('credits\.manage'\)/i);
  assert.match(migration, /pg_catalog\.gen_random_uuid\(\)/i);
  assert.match(cutoverMigration, /legacy credit adjustment RPC is disabled; an idempotency key is required/i);

  assert.match(page, /creditAdjustmentAttemptsRef = useRef<Map<string, CreditAdjustmentAttempt>>\(new Map\(\)\)/);
  assert.match(page, /const payloadFingerprint = await hashCreditAdjustmentPayload\(JSON\.stringify\(\[[\s\S]*customer\.id,[\s\S]*amount,[\s\S]*resolvedNote/);
  assert.match(page, /previousAttempt\?\.payloadFingerprint === payloadFingerprint[\s\S]*previousAttempt[\s\S]*window\.crypto\.randomUUID\(\)/);
  assert.match(page, /window\.sessionStorage\.setItem/);
  assert.match(page, /readCreditAdjustmentAttempt\(customer\.id, payloadFingerprint\)/);
  assert.match(page, /persistCreditAdjustmentAttempt\(customer\.id, null\)/);
  assert.match(page, /p_idempotency_key: attempt\.idempotencyKey/);
  assert.match(page, /creditAdjustmentAttemptsRef\.current\.delete\(customer\.id\)/);
  assert.match(page, /Retry the unchanged adjustment; it will use the same safety key/i);
  assert.match(page, /setCreditInput=\{\(value\) => \{[\s\S]*creditAdjustmentAttemptsRef\.current\.delete\(selectedCustomer\.id\)/);
  assert.match(page, /setCreditNote=\{\(value\) => \{[\s\S]*creditAdjustmentAttemptsRef\.current\.delete\(selectedCustomer\.id\)/);
  assert.match(page, /<input type="number" value=\{creditInput\}[\s\S]*?disabled=\{creditUpdating\}/);
  assert.match(page, /<textarea value=\{creditNote\}[\s\S]*?disabled=\{creditUpdating\}/);

  assert.match(verification, /staff credit adjustment idempotency claims are private and complete/i);
  assert.match(verification, /public\.staff_adjust_customer_credits\(uuid,numeric,text\)', false, true, false, true/i);
  assert.match(verification, /public\.staff_adjust_customer_credits\(uuid,numeric,text,uuid\)', false, true, false, false/i);
  assert.match(verification, /legacy RPC definitions match the release phase/i);
  assert.match(postCutoverVerification, /public\.staff_adjust_customer_credits\(uuid,numeric,text\)', false, false, false/i);
  assert.match(postCutoverVerification, /public\.staff_adjust_customer_credits\(uuid,numeric,text,uuid\)', false, true, false/i);
});

test("application owner authorization rejects legacy null staff roles", () => {
  const staffPermissions = source("src", "lib", "staffPermissions.ts");

  assert.match(
    staffPermissions,
    /return access\.role === "admin" && access\.staffRole === "owner";/
  );
  assert.doesNotMatch(
    staffPermissions,
    /access\.staffRole === "owner" \|\| !access\.staffRole/
  );
});

test("profile and order table grants remove direct authority mutations", () => {
  const migration = source(...migrationPath);

  assert.match(migration, /revoke all privileges on table public\.profiles from public, anon, authenticated/i);
  assert.match(migration, /grant update \([\s\S]*full_name[\s\S]*preferred_contact[\s\S]*\) on table public\.profiles to authenticated/i);
  for (const sensitiveColumn of [
    "credit_balance",
    "allow_negative_credits",
    "negative_credit_limit",
    "account_status",
    "customer_tags",
    "internal_admin_note",
    "role",
    "staff_role",
    "staff_permissions",
  ]) {
    const profileGrant = migration.match(
      /grant update \(([\s\S]*?)\) on table public\.profiles to authenticated/i
    )?.[1] ?? "";
    assert.doesNotMatch(profileGrant, new RegExp(`\\b${sensitiveColumn}\\b`, "i"));
  }
  assert.match(migration, /create trigger protect_profile_authority_fields_trigger/i);
  assert.match(migration, /create trigger protect_staff_security_fields_trigger/i);
  assert.match(migration, /create trigger protect_primary_owner_delete_trigger/i);
  assert.match(migration, /create trigger protect_order_upload_controls_trigger/i);
  assert.match(migration, /create trigger orders_credit_usage_ledger_trigger/i);
  assert.match(migration, /financial profile settings require credits\.manage/i);
  assert.match(migration, /staff authority fields require the primary owner/i);

  assert.match(migration, /revoke all privileges on table public\.orders from public, anon, authenticated/i);
  assert.match(migration, /grant select \([\s\S]*?created_at[\s\S]*?\) on table public\.orders to authenticated/i);
  assert.doesNotMatch(migration, /grant select on table public\.orders to authenticated/i);
  assert.doesNotMatch(migration, /grant (?:insert|update|delete|all privileges) on table public\.orders to authenticated/i);
  assert.match(migration, /where policy\.polrelid = 'public\.profiles'::pg_catalog\.regclass[\s\S]*?drop policy %I on public\.profiles/i);
  assert.match(migration, /create policy "Customers can read own profile"[\s\S]*?id = \(select auth\.uid\(\)\)/i);
  assert.match(migration, /create policy "Customers can update own profile settings"[\s\S]*?with check \(id = \(select auth\.uid\(\)\)\)/i);
  assert.match(migration, /where policy\.polrelid = 'public\.orders'::pg_catalog\.regclass[\s\S]*?drop policy %I on public\.orders/i);
  assert.match(migration, /create policy "Customers can read own orders"[\s\S]*?customer_id = \(select auth\.uid\(\)\)/i);
});

test("admin clients use permission-checked server mutation routes", () => {
  const page = source("src", "app", "admin", "page.tsx");
  const profileRoute = source(
    "src", "app", "api", "admin", "customers", "[id]", "profile", "route.ts"
  );
  const deliveryRoute = source(
    "src", "app", "api", "admin", "orders", "[id]", "delivery-estimate", "route.ts"
  );
  const paymentsRoute = source("src", "app", "api", "admin", "payments", "route.ts");

  assert.match(page, /\/api\/admin\/customers\/\$\{selectedCustomer\.id\}\/profile/);
  assert.match(page, /\/api\/admin\/orders\/\$\{orderId\}\/delivery-estimate/);
  assert.doesNotMatch(page, /from\("profiles"\)\.update/);
  assert.doesNotMatch(page, /from\("orders"\)[\s\S]{0,80}\.update/);

  assert.match(profileRoute, /requireStaffPermission\(request, "customers\.manage"\)/);
  assert.match(profileRoute, /hasStaffPermission\(auth\.access, "credits\.manage"\)/);
  assert.match(profileRoute, /const updatePayload = canManageCredits/);
  assert.match(profileRoute, /!canManageCredits && hasNegativeCreditInput/);
  assert.match(profileRoute, /const returnedColumns = canManageCredits/);
  assert.match(profileRoute, /\.eq\("role", "customer"\)/);
  assert.doesNotMatch(profileRoute, /credit_balance/);
  assert.doesNotMatch(profileRoute, /staff_permissions|staff_role|\brole:/);

  assert.match(deliveryRoute, /requireStaffPermission\(request, "orders\.manage"\)/);
  assert.match(deliveryRoute, /getSupabaseAdmin\(\)/);
  assert.match(paymentsRoute, /credits: z\.number\(\)\.int\(\)\.positive\(\)\.max\(100000\)/);
});

test("verification SQL is SELECT-only and covers live authorization state", () => {
  const verification = source("scripts", "verify-financial-authority-hardening.sql");
  for (const verifier of [verification, postCutoverVerification]) {
    const withoutCommentsOrStrings = verifier
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/--.*$/gm, " ")
      .replace(/'(?:''|[^'])*'/g, "''");

    assert.match(withoutCommentsOrStrings.trimStart(), /^with\b/i);
    assert.doesNotMatch(
      withoutCommentsOrStrings,
      /\b(insert|update|delete|alter|create|drop|grant|revoke|truncate|call|do)\b/i
    );
  }
  assert.match(verification, /critical functions have no PUBLIC EXECUTE/i);
  assert.match(verification, /critical function role matrix matches/i);
  assert.match(verification, /unexpected critical-function overloads have no Data API EXECUTE/i);
  assert.match(verification, /financial RPC bodies enforce authorization, locks and audit markers/i);
  assert.match(verification, /profiles authenticated table-wide UPDATE is absent/i);
  assert.match(verification, /profiles authenticated SELECT is column allowlisted/i);
  assert.match(verification, /orders authenticated access is column-SELECT-only/i);
  assert.match(verification, /order RPC is caller-bound, locked and server-priced/i);
  assert.match(postCutoverVerification, /obsolete overloads fail closed/i);
  assert.match(postCutoverVerification, /hardened order core is private but remains wrapper-callable/i);
});

test("migration PL/pgSQL blocks are balanced", () => {
  for (const migration of [source(...migrationPath), cutoverMigration]) {
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
