-- Catalog-only bootstrap safety check for the isolated staging project.
-- This query reads no application, auth-user, or storage-object rows.

with inventory as (
  select
    count(*) filter (where n.nspname = 'public' and c.relkind in ('r', 'p')) as public_tables,
    count(*) filter (where n.nspname = 'public' and c.relkind = 'S') as public_sequences
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
),
function_inventory as (
  select count(*) as public_functions
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
),
overlay_inventory as (
  select
    (
      select count(*)
      from pg_catalog.pg_trigger t
      join pg_catalog.pg_class c on c.oid = t.tgrelid
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'auth'
        and c.relname = 'users'
        and t.tgname = 'on_auth_user_created'
        and not t.tgisinternal
    ) as auth_trigger_count,
    (
      select count(*)
      from pg_catalog.pg_policies
      where schemaname = 'storage'
        and tablename = 'objects'
        and policyname in (
          'Admins can read all customer files',
          'Admins can update modified customer files',
          'Admins can upload modified customer files',
          'Customers can read own file expert objects',
          'Customers can upload own file expert objects',
          'Staff can read customer files',
          'Staff can read file expert objects',
          'Staff can upload customer files',
          'Users can read own completed modified files',
          'Users can read own customer files',
          'Users can upload own customer files'
        )
    ) as storage_policy_count
)
select
  'MG_BOOTSTRAP_SAFE=' ||
  (
    inventory.public_tables = 0
    and inventory.public_sequences = 0
    and function_inventory.public_functions = 0
    and overlay_inventory.auth_trigger_count = 0
    and overlay_inventory.storage_policy_count = 0
    and to_regclass('auth.users') is not null
    and to_regclass('storage.objects') is not null
  )::text ||
  ';public_tables=' || inventory.public_tables::text ||
  ';public_sequences=' || inventory.public_sequences::text ||
  ';public_functions=' || function_inventory.public_functions::text ||
  ';auth_trigger_count=' || overlay_inventory.auth_trigger_count::text ||
  ';storage_policy_count=' || overlay_inventory.storage_policy_count::text
  as bootstrap_preflight
from inventory, function_inventory, overlay_inventory;
