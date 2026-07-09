-- MG AutoTech Vehicle Database Control Center verification
-- Read-only inspection queries. Run after scripts/add-vehicle-control-center.sql.

select
  expected.table_name,
  case when tables.table_name is null then false else true end as exists_in_public_schema,
  coalesce(classes.relrowsecurity, false) as rls_enabled
from (values
  ('vehicle_data_sources'),
  ('vehicle_import_batches'),
  ('vehicle_brands'),
  ('vehicle_models'),
  ('vehicle_generations'),
  ('vehicle_engines'),
  ('vehicle_ecu_variants'),
  ('vehicle_service_capabilities'),
  ('vehicle_performance_profiles'),
  ('vehicle_change_audit_log'),
  ('vehicle_validation_results')
) as expected(table_name)
left join information_schema.tables tables
  on tables.table_schema = 'public'
  and tables.table_name = expected.table_name
left join pg_class classes
  on classes.relname = expected.table_name
left join pg_namespace namespaces
  on namespaces.oid = classes.relnamespace
  and namespaces.nspname = 'public'
order by expected.table_name;

select
  expected.index_name,
  case when indexes.indexname is null then false else true end as exists_in_public_schema
from (values
  ('vehicle_models_brand_idx'),
  ('vehicle_generations_model_idx'),
  ('vehicle_engines_generation_idx'),
  ('vehicle_engines_published_idx'),
  ('vehicle_engines_vehicle_key_idx'),
  ('vehicle_ecu_variants_engine_idx'),
  ('vehicle_service_capabilities_engine_idx'),
  ('vehicle_service_capabilities_key_idx'),
  ('vehicle_performance_profiles_engine_idx'),
  ('vehicle_audit_entity_idx'),
  ('vehicle_validation_status_idx'),
  ('vehicle_import_batches_created_idx')
) as expected(index_name)
left join pg_indexes indexes
  on indexes.schemaname = 'public'
  and indexes.indexname = expected.index_name
order by expected.index_name;

select
  policies.tablename,
  policies.policyname,
  policies.cmd,
  policies.roles,
  policies.qual,
  policies.with_check,
  (
    coalesce(policies.qual, '') ilike '%has_staff_permission%'
    or coalesce(policies.with_check, '') ilike '%has_staff_permission%'
  ) as guarded_by_staff_permission
from pg_policies policies
where policies.schemaname = 'public'
  and policies.tablename in (
    'vehicle_data_sources',
    'vehicle_import_batches',
    'vehicle_brands',
    'vehicle_models',
    'vehicle_generations',
    'vehicle_engines',
    'vehicle_ecu_variants',
    'vehicle_service_capabilities',
    'vehicle_performance_profiles',
    'vehicle_change_audit_log',
    'vehicle_validation_results'
  )
order by policies.tablename, policies.policyname;

select
  policies.tablename,
  policies.policyname,
  policies.qual,
  policies.with_check
from pg_policies policies
where policies.schemaname = 'public'
  and policies.tablename in (
    'vehicle_data_sources',
    'vehicle_import_batches',
    'vehicle_brands',
    'vehicle_models',
    'vehicle_generations',
    'vehicle_engines',
    'vehicle_ecu_variants',
    'vehicle_service_capabilities',
    'vehicle_performance_profiles',
    'vehicle_change_audit_log',
    'vehicle_validation_results'
  )
  and not (
    coalesce(policies.qual, '') ilike '%has_staff_permission%'
    or coalesce(policies.with_check, '') ilike '%has_staff_permission%'
  )
order by policies.tablename, policies.policyname;

select
  exists (
    select 1
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'public'
      and pg_proc.proname = 'has_staff_permission'
  ) as has_staff_permission_function_exists;

select
  count(*) filter (where role = 'admin') as admin_profiles,
  count(*) filter (where role = 'admin' and staff_role = 'owner') as owner_admin_profiles,
  count(*) filter (where role = 'admin' and staff_role is null) as admin_profiles_without_staff_role,
  count(*) filter (where role = 'staff' and 'vehicles.manage' = any(staff_permissions)) as staff_profiles_with_vehicle_permission
from public.profiles;

select 'vehicle_data_sources' as table_name, count(*) as row_count from public.vehicle_data_sources
union all
select 'vehicle_import_batches', count(*) from public.vehicle_import_batches
union all
select 'vehicle_brands', count(*) from public.vehicle_brands
union all
select 'vehicle_models', count(*) from public.vehicle_models
union all
select 'vehicle_generations', count(*) from public.vehicle_generations
union all
select 'vehicle_engines', count(*) from public.vehicle_engines
union all
select 'vehicle_ecu_variants', count(*) from public.vehicle_ecu_variants
union all
select 'vehicle_service_capabilities', count(*) from public.vehicle_service_capabilities
union all
select 'vehicle_performance_profiles', count(*) from public.vehicle_performance_profiles
union all
select 'vehicle_change_audit_log', count(*) from public.vehicle_change_audit_log
union all
select 'vehicle_validation_results', count(*) from public.vehicle_validation_results
order by table_name;
