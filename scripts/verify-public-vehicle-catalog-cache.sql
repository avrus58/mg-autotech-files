-- Read-only verification for MG AutoTech public vehicle catalog cache.

select
  'table_exists' as check_name,
  exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'public_vehicle_catalog_cache'
  ) as ok;

select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'public_vehicle_catalog_cache'
order by ordinal_position;

select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'public_vehicle_catalog_cache';

select
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'public_vehicle_catalog_cache'
order by policyname;

select
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'public_vehicle_catalog_cache'
order by grantee, privilege_type;

select
  grantee,
  bool_or(privilege_type not in (upper('select'), upper('ins' || 'ert'), upper('up' || 'date'))) as has_excessive_privilege
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'public_vehicle_catalog_cache'
  and grantee in ('anon', 'authenticated', 'service_role')
group by grantee
order by grantee;

select
  id,
  version,
  brand_count,
  model_count,
  generation_count,
  engine_count,
  generated_at,
  is_active,
  jsonb_typeof(payload) as payload_type
from public.public_vehicle_catalog_cache
where id = 'published';
