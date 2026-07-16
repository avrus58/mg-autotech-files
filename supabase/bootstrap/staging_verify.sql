-- Catalog-only post-bootstrap verification for the isolated staging project.
-- Exact empty-data checks are executed separately against staging only.

with public_inventory as (
  select
    count(*) filter (where c.relkind in ('r', 'p')) as table_count,
    count(*) filter (where c.relkind in ('r', 'p') and c.relrowsecurity) as rls_count,
    count(*) filter (where c.relkind in ('r', 'p') and c.relforcerowsecurity) as forced_rls_count
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
),
dtc_inventory as (
  select
    count(*) filter (where c.relkind in ('r', 'p')) as table_count,
    count(*) filter (where c.relkind in ('r', 'p') and c.relrowsecurity) as rls_count
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'dtc_private'
),
policy_inventory as (
  select
    count(*) filter (where schemaname = 'public') as public_policy_count,
    count(*) filter (where schemaname = 'storage' and tablename = 'objects') as storage_policy_count
  from pg_catalog.pg_policies
),
learning_defaults as (
  select count(*) as not_granted_defaults
  from pg_catalog.pg_attribute a
  join pg_catalog.pg_class c on c.oid = a.attrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  join pg_catalog.pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
  where n.nspname = 'public'
    and c.relname in ('ai_learning_file_candidates', 'ai_learning_pair_candidates')
    and a.attname = 'learning_authorization_status'
    and pg_catalog.pg_get_expr(d.adbin, d.adrelid) = '''not_granted''::text'
),
dtc_defaults as (
  select count(*) as closed_defaults
  from pg_catalog.pg_attribute a
  join pg_catalog.pg_class c on c.oid = a.attrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  join pg_catalog.pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
  where n.nspname = 'dtc_private'
    and c.relname = 'dtc_active_policy_snapshots'
    and (
      (a.attname = 'global_kill_switch_engaged' and pg_catalog.pg_get_expr(d.adbin, d.adrelid) = 'true')
      or (a.attname in ('customer_delivery_enabled', 'real_ecu_rules_enabled', 'checksum_adapters_enabled', 'production_automation_enabled') and pg_catalog.pg_get_expr(d.adbin, d.adrelid) = 'false')
    )
),
binary_columns as (
  select count(*) as bytea_count
  from pg_catalog.pg_attribute a
  join pg_catalog.pg_class c on c.oid = a.attrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'dtc_private')
    and c.relkind in ('r', 'p')
    and a.attnum > 0
    and not a.attisdropped
    and a.atttypid = 'bytea'::regtype
),
auth_overlay as (
  select count(*) as trigger_count
  from pg_catalog.pg_trigger t
  join pg_catalog.pg_class c on c.oid = t.tgrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'auth'
    and c.relname = 'users'
    and t.tgname = 'on_auth_user_created'
    and not t.tgisinternal
)
select
  'MG_BOOTSTRAP_VERIFY=' ||
  (
    public_inventory.table_count = 80
    and public_inventory.rls_count = 80
    and dtc_inventory.table_count = 13
    and dtc_inventory.rls_count = 13
    and policy_inventory.public_policy_count = 106
    and policy_inventory.storage_policy_count = 11
    and learning_defaults.not_granted_defaults = 2
    and dtc_defaults.closed_defaults = 5
    and binary_columns.bytea_count = 0
    and auth_overlay.trigger_count = 1
  )::text ||
  ';public_tables=' || public_inventory.table_count::text ||
  ';public_rls=' || public_inventory.rls_count::text ||
  ';dtc_tables=' || dtc_inventory.table_count::text ||
  ';dtc_rls=' || dtc_inventory.rls_count::text ||
  ';public_policies=' || policy_inventory.public_policy_count::text ||
  ';storage_policies=' || policy_inventory.storage_policy_count::text ||
  ';learning_not_granted_defaults=' || learning_defaults.not_granted_defaults::text ||
  ';dtc_closed_defaults=' || dtc_defaults.closed_defaults::text ||
  ';bytea_columns=' || binary_columns.bytea_count::text ||
  ';auth_trigger_count=' || auth_overlay.trigger_count::text
  as bootstrap_verification
from public_inventory, dtc_inventory, policy_inventory, learning_defaults, dtc_defaults, binary_columns, auth_overlay;
