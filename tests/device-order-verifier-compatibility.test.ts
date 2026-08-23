import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function source(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8").replace(
    /\r\n?/g,
    "\n"
  );
}

const deviceMigration = source(
  "supabase",
  "migrations",
  "20260823000000_customer_device_verification.sql"
);
const cutoverVerifier = source(
  "scripts",
  "verify-post-deploy-legacy-rpc-cutover.sql"
);
const zeroCreditVerifier = source(
  "scripts",
  "verify-zero-credit-request-compatibility.sql"
);
const integratedRunbook = source("docs", "integrated-security-release-runbook.md");

test("device migration preserves the legacy signature as a private assurance wrapper", () => {
  const renameAt = deviceMigration.indexOf(
    ") rename to create_order_with_credit_deduction_without_assurance;"
  );
  const wrapperAt = deviceMigration.indexOf(
    "create function public.create_order_with_credit_deduction("
  );
  const exactCoreCallAt = deviceMigration.indexOf(
    "return public.create_order_with_credit_deduction_without_assurance("
  );

  assert.ok(renameAt >= 0 && renameAt < wrapperAt && wrapperAt < exactCoreCallAt);
  assert.match(
    deviceMigration.slice(wrapperAt, exactCoreCallAt),
    /current_customer_session_assured\(\)[\s\S]*device verification is required\./i
  );
  assert.match(
    deviceMigration,
    /revoke all privileges on function public\.create_order_with_credit_deduction\([\s\S]*?from public, anon, authenticated, service_role;[\s\S]*?revoke all privileges on function public\.create_order_with_credit_deduction_without_assurance\([\s\S]*?from public, anon, authenticated, service_role;/i
  );
});

test("both legacy verifiers resolve the renamed core and retain the pre-rename branch", () => {
  for (const verifier of [cutoverVerifier, zeroCreditVerifier]) {
    assert.match(
      verifier,
      /to_regprocedure\([\s\S]*create_order_with_credit_deduction_without_assurance/i
    );
    assert.match(
      verifier,
      /coalesce\(contract\.renamed_core_oid, contract\.wrapper_oid\) as core_oid/i
    );
    assert.match(verifier, /contract\.renamed_core_oid is not null as device_assurance_installed/i);
    assert.match(verifier, /current_customer_session_assured/i);
    assert.match(verifier, /public\.create_order_with_credit_deduction_without_assurance\(/i);
    assert.match(verifier, /not pg_catalog\.has_function_privilege\('anon', wrapper_oid, 'EXECUTE'\)/i);
    assert.match(verifier, /not pg_catalog\.has_function_privilege\('authenticated', wrapper_oid, 'EXECUTE'\)/i);
    assert.match(verifier, /not pg_catalog\.has_function_privilege\('service_role', wrapper_oid, 'EXECUTE'\)/i);
  }

  assert.match(
    cutoverVerifier,
    /when device_assurance_installed[\s\S]*renamed ungated core is private[\s\S]*else 'legacy post-cutover core is private/i
  );
  assert.match(
    zeroCreditVerifier,
    /not phase\.post_cutover\s+and not contract\.device_assurance_installed/i
  );
  assert.match(
    zeroCreditVerifier,
    /when contract\.device_assurance_installed[\s\S]*renamed core must remain private[\s\S]*when phase\.post_cutover/i
  );
});

test("post-device verifier checks core and wrapper metadata rather than wrapper text as core", () => {
  assert.match(cutoverVerifier, /core_security_definer[\s\S]*core_fixed_path[\s\S]*core_owner = 'postgres'/i);
  assert.match(zeroCreditVerifier, /where function_kind = 'order_core'/i);
  assert.match(zeroCreditVerifier, /wrapper_oid <> core_oid[\s\S]*security_definer[\s\S]*fixed_path[\s\S]*owner_role = 'postgres'/i);
  assert.doesNotMatch(
    zeroCreditVerifier,
    /where signature = 'public\.create_order_with_credit_deduction\(text,text,text,text,text,text,integer/i
  );
});

test("combined runbook orders cutover, shadow migrations and device-aware deploy coherently", () => {
  const orderedMarkers = [
    "20260816002454_zero_credit_request_compatibility.sql",
    "Deploy the frozen cutover-compatible predecessor application",
    "20260816002452_post_deploy_legacy_rpc_cutover.sql",
    "20260816002453_email_delivery_schema_parity.sql",
    "20260823000000_customer_device_verification.sql",
    "20260823000001_customer_device_verification_catalog_reconciliation.sql",
    "deploy the frozen\n    device-aware application",
  ];
  const positions = orderedMarkers.map((marker) => integratedRunbook.indexOf(marker));

  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual([...positions].sort((left, right) => left - right), positions);
  assert.match(integratedRunbook, /confirm device mode is still `shadow`/i);
  assert.match(integratedRunbook, /8F09E9B7E7A90FDA8696C0B7A6CBCC6454D08E4600AA835C1420CFD8C8E52262/);
  assert.match(integratedRunbook, /958B34C5E19CFD7FA2C7124100C2A29AEC465539228660B2AC82A462924A9668/);
  assert.match(
    integratedRunbook,
    /rerun both[\s\S]*verify-post-deploy-legacy-rpc-cutover\.sql[\s\S]*verify-zero-credit-request-compatibility\.sql/i
  );
});
