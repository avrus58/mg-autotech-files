import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const productionRef = "jujaeyvyaeesmipihrrw";
const stagingRef = "vxdxdvtsopsjatukdbuq";

function read(path: string) {
  return readFileSync(path, "utf8");
}

function stripDollarQuotedBodies(sql: string) {
  return sql.replace(/\$([A-Za-z0-9_]*)\$[\s\S]*?\$\1\$/g, "$DOLLAR_BODY$");
}

test("schema baseline is DDL-only and contains no sensitive export payload", () => {
  const sql = read("supabase/bootstrap/mg_autotech_schema_baseline.sql");
  const outsideBodies = stripDollarQuotedBodies(sql);

  assert.match(sql, new RegExp(`Source project ref: ${productionRef}`));
  assert.equal((sql.match(/\bCREATE TABLE public\./g) || []).length, 75);
  assert.equal((sql.match(/\bCREATE POLICY\b/g) || []).length, 100);
  assert.doesNotMatch(sql, /\bCOPY\s+\S+[\s\S]*?FROM\s+stdin\b/i);
  assert.doesNotMatch(outsideBodies, /\bINSERT\s+INTO\b/i);
  assert.doesNotMatch(sql, /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
  assert.doesNotMatch(sql, /\b(?:sk_live_|sk_test_|sb_secret_|sb_publishable_|eyJ[A-Za-z0-9_-]{20,}\.)/i);
  assert.doesNotMatch(sql, /https?:\/\/[^\s'"]+(?:token|signature|signed|expires)/i);
  assert.doesNotMatch(sql, /\b(?:first_64_bytes_hex|raw_hex|firmware_bytes)\b/i);
});

test("managed overlays contain only the application auth trigger and storage policies", () => {
  const sql = read("supabase/bootstrap/managed_schema_overlays.sql");

  assert.equal((sql.match(/\bCREATE TRIGGER on_auth_user_created\b/g) || []).length, 1);
  assert.equal((sql.match(/\bCREATE POLICY\b/g) || []).length, 11);
  assert.doesNotMatch(sql, /\bCREATE\s+(?:TABLE|SCHEMA)\s+(?:auth|storage)\b/i);
  assert.doesNotMatch(sql, /\bCOPY\b|\bINSERT\s+INTO\b/i);
});

test("staging bootstrap guard is ref-locked and excludes the local fake baseline", () => {
  const script = read("scripts/bootstrap-isolated-staging.mjs");
  const vercelIgnore = read(".vercelignore");

  assert.match(script, new RegExp(`PRODUCTION_REF = "${productionRef}"`));
  assert.match(script, new RegExp(`STAGING_REF = "${stagingRef}"`));
  assert.match(script, /Production project ref is forbidden/);
  assert.match(script, /Local-only fake baseline must never be applied remotely/);
  assert.match(script, /20260714132000_dtc_phase_a_test_baseline\.sql/);
  assert.doesNotMatch(script.match(/const STAGING_MIGRATIONS = \[[\s\S]*?\];/)?.[0] || "", /20260714132000/);
  assert.match(script, /MG_BOOTSTRAP_SAFE=true/);
  assert.match(script, /MG_BOOTSTRAP_VERIFY=true/);
  assert.match(script, /credentialsPersisted: false/);
  assert.doesNotMatch(script, /dotenv|\.env\.local|\.env"|\.env'/);
  assert.match(vercelIgnore, /^\/\.local\/$/m);
});

test("staging migrations keep learning authorization and DTC runtime defaults closed", () => {
  const learning = read("supabase/migrations/20260715195048_learning_flywheel_candidates.sql");
  const dtcPhaseA = read("supabase/migrations/20260714204125_dtc_active_processing_phase_a.sql");

  assert.match(learning, /learning_authorization_status text not null default 'not_granted'/);
  assert.doesNotMatch(learning, /\binsert\s+into\b|\bcopy\b/i);
  assert.match(dtcPhaseA, /global_kill_switch_engaged boolean not null default true/);
  assert.match(dtcPhaseA, /customer_delivery_enabled boolean not null default false/);
  assert.match(dtcPhaseA, /production_automation_enabled boolean not null default false/);
});
