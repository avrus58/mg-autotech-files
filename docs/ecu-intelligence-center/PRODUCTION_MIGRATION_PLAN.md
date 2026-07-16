# Production Migration Plan

Status: reviewed dry-run plan only. No production migration was applied.

## Catalog comparison

Production metadata was read only from `pg_catalog`, `information_schema`, policy, grant, extension, trigger, function, and migration-history catalogs. No production application row, Auth user, Storage object, customer/order/payment record, firmware metadata, path, credential, or PII was read.

| Catalog fact | Production `jujaeyvyaeesmipihrrw` | Staging `vxdxdvtsopsjatukdbuq` | Expected conclusion |
| --- | ---: | ---: | --- |
| Public tables | 75 | 82 | 7 public release tables pending in production |
| Public RLS tables | 75 | 82 | Every public table RLS-enabled in both |
| `dtc_private` tables | 0 | 13 | DTC release schema pending in production |
| `dtc_private` RLS tables | 0 | 13 | All staging private DTC tables RLS-enabled |
| Public indexes | 208 | 239 | 31 release indexes added in staging |
| Public policies | 100 | 107 | 7 net release policies added in staging |
| Public functions | 30 | 30 | No public function drift |
| Public triggers | 21 | 21 | No public trigger drift |
| Storage policies | 11 | 11 | Managed overlay already represented in production |
| `bytea` columns in release schemas | 0 | 0 | No firmware bytes stored in release tables |
| Base public tables | 75 | 75 | Exact base count match after excluding release tables |
| Base public columns | 1,120 | 1,120 | Exact base count match |
| Base public column digest | `519517a0c008ccd5357376016588debe` | Same | Production baseline is represented, not pending |

Both projects have Postgres 17.6 and the same installed extension names: `pg_stat_statements`, `pgcrypto`, `plpgsql`, `supabase_vault`, and `uuid-ossp`. Required dependencies `public.orders`, `public.request_work_orders`, `public.ai_training_samples`, `public.has_staff_permission(text)`, and `pgcrypto` exist in production.

## Current migration ledgers

Production:

1. `20260710150453 add_public_vehicle_catalog_cache`
2. `20260710150541 harden_public_vehicle_catalog_cache_grants`
3. `20260711000500 add_transactional_email_system`

Isolated staging:

1. `20260715225909 schema_baseline_20260716`
2. `20260715225927 managed_schema_overlays_20260716`
3. `20260715225944 dtc_active_processing_phase_a_20260714204125`
4. `20260715225946 dtc_active_processing_phase_c_synthetic_20260714212824`
5. `20260715225947 dtc_phase_c1_durable_synthetic_artifacts_20260714220848`
6. `20260715225948 learning_flywheel_candidates_20260715195048`
7. `20260716002344 learning_flywheel_production_readiness_hardening`

Staging bootstrap versions are not production migration versions and must never be copied into production history.

## Exact classification

| Artifact | Production classification | Action |
| --- | --- | --- |
| `supabase/bootstrap/mg_autotech_schema_baseline.sql` | **Represented in production** | Never apply to production; it was generated from production metadata for isolated staging reconstruction |
| `supabase/bootstrap/managed_schema_overlays.sql` | **Represented in production** | Never apply to production; auth trigger and 11 storage policies already exist |
| `20260714132000_dtc_phase_a_test_baseline.sql` | **Local-test-only fake baseline** | Never remote; never include in a release bundle |
| `20260714204125_dtc_active_processing_phase_a.sql` | **Pending, additive, maintenance-window-safe** | Required as production migration 1 |
| `20260714212824_dtc_active_processing_phase_c_synthetic_test_output.sql` | **Staging-only for this release** | Blocked from initial production; no synthetic processing schema is required for the approved scope |
| `20260714220848_dtc_phase_c1_durable_synthetic_artifacts.sql` | **Staging-only for this release** | Blocked; depends on Phase C |
| `20260715195048_learning_flywheel_candidates.sql` | **Pending, additive, maintenance-window-safe** | Required as production migration 2 |
| `20260716005208_learning_flywheel_production_readiness_hardening.sql` | **Pending, additive hardening, maintenance-window-safe** | Required as production migration 3 |

Do not run `supabase db push` from the repository's normal `supabase/migrations` directory. That directory intentionally contains the fake local baseline and staging-only Phase C files.

## Production allowlist and digests

Apply exactly these files, in order:

| Order | Migration | SHA-256 |
| ---: | --- | --- |
| 1 | `20260714204125_dtc_active_processing_phase_a.sql` | `075B13F66DFF5DB8844C095A86606319E0F097967698E4E92C1049B833B50B76` |
| 2 | `20260715195048_learning_flywheel_candidates.sql` | `00BF5F856375891B47428C9B57FEC86610815D6A993D9BDB906ABF6D5899767F` |
| 3 | `20260716005208_learning_flywheel_production_readiness_hardening.sql` | `D0313527B6B0251FF552700D1E57C50B7A0450FEF87969F1883E7E8CD7494B0F` |

Dependencies:

- Migration 1 depends on existing `orders`, `request_work_orders`, `auth.users`, `has_staff_permission(text)`, and `pgcrypto`.
- Migration 2 depends on existing `orders`, `auth.users`, and `has_staff_permission(text)`.
- Migration 3 depends on migrations 1 and 2 plus existing `orders`, `auth.users`, and `has_staff_permission(text)`.
- Migration 3 intentionally replaces the two DTC projection policies created by migration 1 with one equivalent customer-or-staff policy.

## Exact production object end-state

Counts below come from the verified staging catalog after grouping only the 14 production-allowlisted tables. Index counts include primary-key and unique-constraint backing indexes.

| Migration group | Tables | Indexes | Constraints | User triggers | Final policies | Other objects |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| DTC Phase A | 8 | 21 | 35 | 4 | 1 | New private schema and one immutable-mutation guard function |
| Learning candidates | 4 | 20 | 35 | 0 | 4 | No function or trigger |
| Hardening | 2 | 8 | 17 | 0 | 2 | Replaces the two temporary Phase A projection policies with the one final policy counted above |
| **Final allowlist** | **14** | **49** | **87** | **4** | **7** | **1 private schema, 1 private function** |

The six staging-only Phase C tables, their 15 indexes, five immutable triggers, and related grants/comments are not part of this production end-state.

## Lock and availability impact

- All selected tables are new and empty at creation time. Their indexes are built on empty tables.
- Foreign keys require brief locks on referenced `orders`, `request_work_orders`, `auth.users`, and candidate tables. Apply during an owner-approved low-traffic maintenance window.
- Migration 3 drops/recreates policy metadata and narrows grants on the newly introduced DTC projection table. No existing production table policy is replaced.
- The SQL contains no application-row copy, seed, backfill, firmware bytes, `TRUNCATE`, or table drop.
- The files have no down migrations. Once real candidate metadata exists, database rollback by dropping tables would destroy records and is prohibited. Rollback is flags-first plus application rollback, with schema retained.

Stop if a release table already exists, a dependency is absent, lock contention is material, or the dry run lists any fourth migration.

## Owner-run dry run

Use a clean detached checkout of the fixed release SHA and a new disposable bundle directory. Do not reuse an old directory.

```powershell
$ReleaseSha = '04b899df85f4ef5bb279cb11083974c70b82a8c8'
$Checkout = Join-Path $env:TEMP 'mg-autotech-release-04b899d-checkout'
$Bundle = Join-Path $env:TEMP 'mg-autotech-release-04b899d-db'
if (Test-Path $Checkout) { throw "Checkout path already exists: $Checkout" }
if (Test-Path $Bundle) { throw "Bundle path already exists: $Bundle" }
git worktree add --detach $Checkout $ReleaseSha
New-Item -ItemType Directory -Path (Join-Path $Bundle 'supabase/migrations') | Out-Null
Copy-Item (Join-Path $Checkout 'supabase/config.toml') (Join-Path $Bundle 'supabase/config.toml')
Copy-Item (Join-Path $Checkout 'supabase/migrations/20260714204125_dtc_active_processing_phase_a.sql') (Join-Path $Bundle 'supabase/migrations/')
Copy-Item (Join-Path $Checkout 'supabase/migrations/20260715195048_learning_flywheel_candidates.sql') (Join-Path $Bundle 'supabase/migrations/')
Copy-Item (Join-Path $Checkout 'supabase/migrations/20260716005208_learning_flywheel_production_readiness_hardening.sql') (Join-Path $Bundle 'supabase/migrations/')
Get-ChildItem (Join-Path $Bundle 'supabase/migrations') -File | Select-Object Name
Get-FileHash -Algorithm SHA256 (Join-Path $Bundle 'supabase/migrations/*.sql') | Select-Object Path, Hash
npx supabase link --project-ref jujaeyvyaeesmipihrrw --workdir $Bundle
npx supabase db push --dry-run --linked --workdir $Bundle
```

The owner must compare the three names and hashes to the allowlist above and confirm the dry run lists exactly three migrations. Authentication remains interactive/private; do not paste credentials into the change record.

Only after final owner approval, the database operator may run:

```powershell
npx supabase db push --linked --workdir $Bundle --yes
```

This command is part of the future owner-run change window. It was not run while preparing this package.

## Catalog-only post-migration verification

Migration history:

```sql
select version, name
from supabase_migrations.schema_migrations
where version in ('20260714204125', '20260715195048', '20260716005208')
order by version;
```

All 14 production-allowlisted release tables present and RLS-enabled:

```sql
with expected(schema_name, table_name) as (
  values
    ('public','dtc_request_status_public'),
    ('public','ai_learning_authorization_terms'),
    ('public','ai_learning_file_candidates'),
    ('public','ai_learning_pair_candidates'),
    ('public','ai_learning_review_events'),
    ('public','ai_learning_authorization_records'),
    ('public','ai_learning_ingestion_jobs'),
    ('dtc_private','dtc_active_policy_snapshots'),
    ('dtc_private','dtc_processing_rule_documents'),
    ('dtc_private','dtc_integrity_adapter_documents'),
    ('dtc_private','dtc_golden_corpus_versions'),
    ('dtc_private','dtc_processing_attempts'),
    ('dtc_private','dtc_processing_state_events'),
    ('dtc_private','dtc_processing_controls')
)
select count(*) as expected_count,
       count(c.oid) as present_count,
       count(*) filter (where c.relrowsecurity) as rls_count
from expected e
left join pg_catalog.pg_namespace n on n.nspname = e.schema_name
left join pg_catalog.pg_class c
  on c.relnamespace = n.oid
 and c.relname = e.table_name
 and c.relkind in ('r','p');
```

The query contains 14 production-allowlisted tables. The six Phase C tables are intentionally absent in production.

Fail-closed defaults and DTC policy shape:

```sql
select n.nspname as schema_name, c.relname as table_name, a.attname as column_name,
       pg_catalog.pg_get_expr(d.adbin, d.adrelid) as default_expression
from pg_catalog.pg_attribute a
join pg_catalog.pg_class c on c.oid = a.attrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
join pg_catalog.pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
where (n.nspname, c.relname, a.attname) in (
  ('public','ai_learning_file_candidates','learning_authorization_status'),
  ('public','ai_learning_pair_candidates','learning_authorization_status'),
  ('dtc_private','dtc_active_policy_snapshots','global_kill_switch_engaged'),
  ('dtc_private','dtc_active_policy_snapshots','customer_delivery_enabled'),
  ('dtc_private','dtc_active_policy_snapshots','real_ecu_rules_enabled'),
  ('dtc_private','dtc_active_policy_snapshots','checksum_adapters_enabled'),
  ('dtc_private','dtc_active_policy_snapshots','production_automation_enabled')
)
order by 1,2,3;

select policyname, cmd, roles, qual, with_check
from pg_catalog.pg_policies
where schemaname = 'public' and tablename = 'dtc_request_status_public';
```

Expected: both candidate defaults are `'not_granted'`; kill switch default is `true`; the four DTC processing/delivery defaults are `false`; and exactly one authenticated `SELECT` policy implements customer ownership OR staff permission with init-plan-safe subselects.
