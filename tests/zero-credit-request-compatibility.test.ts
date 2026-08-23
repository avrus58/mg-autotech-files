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

const migrationName = "20260816002454_zero_credit_request_compatibility.sql";
const migration = source("supabase", "migrations", migrationName);
const verifier = source("scripts", "verify-zero-credit-request-compatibility.sql");

test("02454 restores only the catalog-authoritative zero-credit order branch", () => {
  const resolver = migration.match(
    /create or replace function public\.resolve_request_service_credits\([\s\S]*?\n\$\$;/i,
  )?.[0] ?? "";
  const orderCore = migration.match(
    /create or replace function public\.create_order_with_credit_deduction\([\s\S]*?\n\$\$;/i,
  )?.[0] ?? "";

  assert.match(resolver, /if v_total < 0 then/i);
  assert.doesNotMatch(resolver, /if v_total <= 0 then/i);
  assert.match(resolver, /Duplicate extra services are not allowed/i);
  assert.match(orderCore, /p_credits_required\s+is null[\s\S]*?p_credits_required < 0[\s\S]*?p_credits_required > 100000/i);
  assert.match(orderCore, /v_expected_credits := public\.resolve_request_service_credits\(p_service_type\)/i);
  assert.match(orderCore, /p_credits_required <> v_expected_credits/i);
  assert.match(orderCore, /where profile\.id = v_user_id[\s\S]*?profile\.role = 'customer'[\s\S]*?for update of profile/i);
  assert.match(orderCore, /if v_expected_credits > 0 then[\s\S]*?update public\.profiles[\s\S]*?set credit_balance = v_new_balance[\s\S]*?mg_autotech\.order_credit_debit[\s\S]*?end if;/i);
  assert.equal((orderCore.match(/if v_expected_credits > 0 then/gi) ?? []).length, 2);
  assert.match(orderCore, /insert into public\.orders[\s\S]*?v_expected_credits/i);
  assert.doesNotMatch(migration, /create or replace function public\.create_(?:web|desktop)_order_with_credit_deduction/i);
});

test("zero orders skip the usage ledger while positive orders stay marker-bound", () => {
  const trigger = migration.match(
    /create or replace function public\.log_order_credit_usage\(\)[\s\S]*?\n\$\$;/i,
  )?.[0] ?? "";

  assert.match(trigger, /mg_autotech\.order_credit_debit/i);
  assert.match(trigger, /new\.credits_required < 0/i);
  assert.match(trigger, /if new\.credits_required = 0 then\s+return new;\s+end if;/i);
  assert.ok(
    trigger.indexOf("if new.credits_required = 0 then")
      < trigger.indexOf("insert into public.credit_transactions"),
  );
  assert.match(trigger, /-new\.credits_required::integer/i);
  assert.match(migration, /revoke all privileges on function public\.log_order_credit_usage\(\)[\s\S]*?from public, anon, authenticated, service_role/i);
  assert.match(migration, /Deliberately do not change the core function ACL/i);
  assert.doesNotMatch(migration, /revoke all privileges on function public\.create_order_with_credit_deduction/i);
});

test("web and desktop accept zero but reject negative credit totals", () => {
  const browser = source("src", "app", "new-request", "page.tsx");
  const contracts = source("src", "lib", "desktopUpload", "contracts.ts");
  const uploadSession = source("src", "app", "api", "desktop", "upload-session", "route.ts");
  const finalize = source("src", "app", "api", "desktop", "requests", "finalize", "route.ts");

  assert.match(browser, /isZeroCreditRequest = Boolean\(selectedMainService\) && totalCredits === 0/);
  assert.match(browser, /Boolean\(selectedMainService\)[\s\S]*?Number\.isInteger\(totalCredits\)[\s\S]*?totalCredits >= 0[\s\S]*?totalCredits <= availableCredits/);
  assert.match(browser, /!Number\.isInteger\(requiredCredits\) \|\| requiredCredits < 0/);
  assert.match(browser, /isZeroCreditRequest[\s\S]*?I confirm this zero-credit request\./);
  assert.match(contracts, /!Number\.isInteger\(requiredCredits\) \|\| requiredCredits < 0 \|\| requiredCredits > 100000/);
  for (const route of [uploadSession, finalize]) {
    assert.match(route, /!Number\.isInteger\(creditsRequired\) \|\| creditsRequired < 0/);
    assert.doesNotMatch(route, /creditsRequired <= 0/);
  }
});

test("focused verifier is SELECT-only and checks metadata plus catalog rows", () => {
  const withoutCommentsOrStrings = verifier
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--.*$/gm, " ")
    .replace(/'(?:''|[^'])*'/g, "''");

  assert.match(withoutCommentsOrStrings.trimStart(), /^with\b/i);
  assert.doesNotMatch(
    withoutCommentsOrStrings,
    /\b(insert|update|delete|merge|alter|create|drop|truncate|grant|revoke|call|do)\b/i,
  );
  assert.doesNotMatch(verifier, /from\s+public\.(?:profiles|orders|credit_transactions)\b/i);
  assert.match(verifier, /from public\.request_service_catalog as catalog/i);
  assert.match(
    verifier,
    /resolved_order_contract as \([\s\S]*?coalesce\(contract\.renamed_core_oid, contract\.wrapper_oid\) as core_oid/i,
  );
  assert.match(verifier, /create_order_with_credit_deduction_without_assurance/i);
  assert.match(verifier, /where function_kind = 'order_core'/i);
  assert.match(verifier, /zero-credit catalog contract is exact/i);
  assert.match(verifier, /order core skips financial writes only for exact zero/i);
  assert.match(verifier, /usage ledger ignores zero and rejects negative marked orders/i);
  assert.match(verifier, /order core authenticated access matches the cutover phase/i);
  assert.match(verifier, /device assurance wrapper calls the exact renamed order core/i);
  const checksBody = verifier.slice(
    verifier.indexOf("checks(sort_order, check_name, ok, details) as ("),
    verifier.lastIndexOf("\nselect check_name")
  );
  assert.equal((checksBody.match(/\n\s*union all\n/gi) ?? []).length + 1, 8);
});

test("release metadata places 02454 before app cutover and freezes its hash", () => {
  const runbook = source("docs", "integrated-security-release-runbook.md");
  const preflight = source("scripts", "preflight-integrated-security-release.sql");
  const digest = createHash("sha256").update(migration).digest("hex").toUpperCase();

  assert.ok(
    runbook.indexOf("20260816002451_credit_transaction_customer_access_hardening.sql")
      < runbook.indexOf(migrationName),
  );
  assert.ok(
    runbook.indexOf(migrationName)
      < runbook.indexOf("Deploy the frozen cutover-compatible predecessor application"),
  );
  assert.ok(
    runbook.indexOf("Deploy the frozen cutover-compatible predecessor application")
      < runbook.indexOf("20260816002452_post_deploy_legacy_rpc_cutover.sql"),
  );
  assert.ok(
    runbook.indexOf("20260816002452_post_deploy_legacy_rpc_cutover.sql")
      < runbook.indexOf("20260816002453_email_delivery_schema_parity.sql"),
  );
  assert.ok(
    runbook.indexOf("20260816002453_email_delivery_schema_parity.sql")
      < runbook.indexOf("20260823000000_customer_device_verification.sql"),
  );
  assert.ok(
    runbook.indexOf("20260823000000_customer_device_verification.sql")
      < runbook.indexOf("20260823000001_customer_device_verification_catalog_reconciliation.sql"),
  );
  assert.ok(
    runbook.indexOf("20260823000001_customer_device_verification_catalog_reconciliation.sql")
      < runbook.indexOf("deploy the frozen\n    device-aware application"),
  );
  assert.match(runbook, new RegExp(digest));
  assert.match(runbook, /verify-zero-credit-request-compatibility\.sql/i);
  assert.match(preflight, /20260816002454/);
  assert.match(preflight, /zero_credit_request_compatibility/);

  const frozenScope = new Map([
    ["20260816002443_financial_authority_hardening.sql", "61FC3D7B0B0D515ABE69DDA57BA4C0A3B07C1E12E24109A1E2F06DCC6410A5EA"],
    ["20260816002444_security_state_hardening.sql", "62E7B08FDE1DFD3566AB997DC3E9896350DB753E2BC2FCFE9CA4E74D51C15FB3"],
    ["20260816002445_widget_final_hardening.sql", "59CAF2338C85F3114D8D80E46792AC227EEA00B0ACEE870A6B05F1EA45B76728"],
    ["20260816002446_stripe_recovery_hardening.sql", "CBE9E0938CC1A72B007F175D484DF00F7D6A064A0D7C0A6E81F78118BD10EC5D"],
    ["20260816002447_file_expert_atomic_completion.sql", "4B202715C9E96D475FD9578E8A18B6D3E4A3047DD84575B1D1D0F2AAD3D0CE4F"],
    ["20260816002448_widget_checkout_atomic_claim.sql", "B581019DF5C08AC0529E260FD7DF41ED86B322801DEC57EFB33E5451727111B4"],
    ["20260816002450_auth_customer_id_generator_hardening.sql", "8131E02E582D5E16C18F6262515E402AEC2A4DBAFAA1E3029362E80EA8F8C792"],
    ["20260816002451_credit_transaction_customer_access_hardening.sql", "6DE1F340791C17D54621DFB9DDB3E6FBB39B0B5F322565B421B34D24EF15FFD9"],
    ["20260816002452_post_deploy_legacy_rpc_cutover.sql", "5084DFD95DBD878FD1037F7CE497C1362E900ED5D3F931A2626CD448719C84CC"],
    ["20260816002453_email_delivery_schema_parity.sql", "E88D700B4ACB0D051C6D563C3D52F1958074983D9127D413BB28901374DE4353"],
    [migrationName, "958ED96EF6607397EA8839432D53FE64776FAA853FDB5994E02DD67B5046A6F0"],
  ]);
  for (const [fileName, expectedDigest] of frozenScope) {
    assert.equal(
      createHash("sha256")
        .update(source("supabase", "migrations", fileName))
        .digest("hex")
        .toUpperCase(),
      expectedDigest,
      fileName,
    );
    assert.match(runbook, new RegExp(expectedDigest), fileName);
  }
});

test("02454 is additive, transactional and leaves frozen 02443 unchanged", () => {
  assert.doesNotMatch(migration, /\b(drop\s+(?:table|column)|truncate|delete\s+from)\b/i);
  assert.equal((migration.match(/\$\$/g) ?? []).length % 2, 0);
  assert.equal(
    (migration.match(/\(/g) ?? []).length,
    (migration.match(/\)/g) ?? []).length,
  );
  assert.match(migration.trimEnd(), /commit;$/i);
  assert.equal(
    createHash("sha256")
      .update(source("supabase", "migrations", "20260816002443_financial_authority_hardening.sql"))
      .digest("hex"),
    "61fc3d7b0b0d515abe69dda57ba4c0a3b07c1e12e24109a1e2f06dcc6410a5ea",
  );
});
