-- SELECT-only verification for explicit final credit-price authority.
-- This script does not mutate pricing, customer, payment, or audit data.

with expected_global_columns(column_name) as (
  values
    ('pricing_model_version'),
    ('explicit_pricing_writes_enabled'),
    ('explicit_pricing_bridge_release'),
    ('credit_package_10_total_eur'),
    ('credit_package_50_total_eur'),
    ('credit_package_100_total_eur'),
    ('credit_package_250_total_eur'),
    ('credit_package_500_total_eur'),
    ('custom_credit_unit_price_eur')
), expected_customer_columns(column_name) as (
  values
    ('pricing_model_version'),
    ('credit_package_10_total_override_eur'),
    ('credit_package_50_total_override_eur'),
    ('credit_package_100_total_override_eur'),
    ('credit_package_250_total_override_eur'),
    ('credit_package_500_total_override_eur'),
    ('custom_credit_unit_price_override_eur')
), column_state as (
  select
    (
      select count(*) = (select count(*) from expected_global_columns)
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'commerce_settings'
        and column_name in (select column_name from expected_global_columns)
    ) as global_columns_present,
    (
      select count(*) = (select count(*) from expected_customer_columns)
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'customer_commercial_policies'
        and column_name in (select column_name from expected_customer_columns)
    ) as customer_columns_present
), data_state as (
  select
    exists (
      select 1
      from public.commerce_settings
      where id = 'default'
        and pricing_model_version = 2
        and credit_package_10_total_eur between 0.10 and 2000000.00
        and credit_package_50_total_eur between 0.50 and 2000000.00
        and credit_package_100_total_eur between 1.00 and 2000000.00
        and credit_package_250_total_eur between 2.50 and 2000000.00
        and credit_package_500_total_eur between 5.00 and 2000000.00
        and custom_credit_unit_price_eur between 0.01 and 4000
    ) as global_v2_ready,
    not exists (
      select 1
      from public.customer_commercial_policies
      where pricing_model_version <> 2
    ) as customer_rows_v2_ready,
    exists (
      select 1
      from public.commerce_settings
      where id = 'default'
        and (
          explicit_pricing_bridge_release is null
          or explicit_pricing_bridge_release ~ '^[A-Za-z0-9._:-]{8,180}$'
        )
        and (not explicit_pricing_writes_enabled or explicit_pricing_bridge_release is not null)
        and (not explicit_pricing_writes_enabled or pricing_model_version = 2)
    ) as write_gate_consistent,
    coalesce((
      select explicit_pricing_writes_enabled
      from public.commerce_settings
      where id = 'default'
    ), false) as writes_activated
), constraint_state as (
  select
    count(*) filter (
      where constraint_record.conname in (
        'commerce_settings_explicit_credit_prices_chk',
        'customer_commercial_policy_explicit_credit_prices_chk'
      )
        and constraint_record.convalidated
    ) = 2 as explicit_constraints_validated
  from pg_catalog.pg_constraint as constraint_record
  where constraint_record.conrelid in (
    'public.commerce_settings'::regclass,
    'public.customer_commercial_policies'::regclass
  )
), function_state as (
  select
    not pg_catalog.has_function_privilege(
      'anon',
      'public.save_commerce_settings_v2(timestamptz,numeric,numeric,numeric,numeric,numeric,numeric,text,boolean,boolean,uuid)',
      'EXECUTE'
    )
    and not pg_catalog.has_function_privilege(
      'authenticated',
      'public.save_commerce_settings_v2(timestamptz,numeric,numeric,numeric,numeric,numeric,numeric,text,boolean,boolean,uuid)',
      'EXECUTE'
    )
    and pg_catalog.has_function_privilege(
      'service_role',
      'public.save_commerce_settings_v2(timestamptz,numeric,numeric,numeric,numeric,numeric,numeric,text,boolean,boolean,uuid)',
      'EXECUTE'
    ) as global_rpc_service_only,
    not pg_catalog.has_function_privilege(
      'anon',
      'public.save_customer_commercial_policy_v2(uuid,timestamptz,numeric,numeric,numeric,numeric,numeric,numeric,boolean,boolean,text,uuid)',
      'EXECUTE'
    )
    and not pg_catalog.has_function_privilege(
      'authenticated',
      'public.save_customer_commercial_policy_v2(uuid,timestamptz,numeric,numeric,numeric,numeric,numeric,numeric,boolean,boolean,text,uuid)',
      'EXECUTE'
    )
    and pg_catalog.has_function_privilege(
      'service_role',
      'public.save_customer_commercial_policy_v2(uuid,timestamptz,numeric,numeric,numeric,numeric,numeric,numeric,boolean,boolean,text,uuid)',
      'EXECUTE'
    ) as customer_rpc_service_only,
    not pg_catalog.has_function_privilege(
      'anon',
      'public.activate_explicit_pricing_v2(timestamptz,text,uuid)',
      'EXECUTE'
    )
    and not pg_catalog.has_function_privilege(
      'authenticated',
      'public.activate_explicit_pricing_v2(timestamptz,text,uuid)',
      'EXECUTE'
    )
    and pg_catalog.has_function_privilege(
      'service_role',
      'public.activate_explicit_pricing_v2(timestamptz,text,uuid)',
      'EXECUTE'
    ) as activation_rpc_service_only
), table_security_state as (
  select
    pg_catalog.bool_and(table_record.relrowsecurity) as rls_enabled,
    not pg_catalog.has_table_privilege('authenticated', 'public.commerce_settings', 'INSERT')
      and not pg_catalog.has_table_privilege('authenticated', 'public.commerce_settings', 'UPDATE')
      and not pg_catalog.has_table_privilege('authenticated', 'public.commerce_settings', 'DELETE')
      and not pg_catalog.has_table_privilege('authenticated', 'public.customer_commercial_policies', 'INSERT')
      and not pg_catalog.has_table_privilege('authenticated', 'public.customer_commercial_policies', 'UPDATE')
      and not pg_catalog.has_table_privilege('authenticated', 'public.customer_commercial_policies', 'DELETE')
      and not pg_catalog.has_table_privilege('anon', 'public.commerce_settings', 'INSERT')
      and not pg_catalog.has_table_privilege('anon', 'public.commerce_settings', 'UPDATE')
      and not pg_catalog.has_table_privilege('anon', 'public.commerce_settings', 'DELETE')
      and not pg_catalog.has_table_privilege('anon', 'public.customer_commercial_policies', 'INSERT')
      and not pg_catalog.has_table_privilege('anon', 'public.customer_commercial_policies', 'UPDATE')
      and not pg_catalog.has_table_privilege('anon', 'public.customer_commercial_policies', 'DELETE')
      as browser_direct_writes_revoked,
    not exists (
      select 1
      from pg_catalog.pg_policies as policy
      where policy.schemaname = 'public'
        and policy.tablename in ('commerce_settings', 'customer_commercial_policies')
        and policy.cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
        and ('authenticated' = any(policy.roles) or 'anon' = any(policy.roles))
    ) as no_browser_write_policies
  from pg_catalog.pg_class as table_record
  where table_record.oid in (
    'public.commerce_settings'::regclass,
    'public.customer_commercial_policies'::regclass
  )
), trigger_state as (
  select
    exists (
      select 1 from pg_catalog.pg_trigger as trigger_record
      where trigger_record.tgname = 'mark_legacy_commerce_price_write'
        and trigger_record.tgrelid = 'public.commerce_settings'::regclass
        and trigger_record.tgfoid = 'public.mark_legacy_commerce_price_write()'::regprocedure
        and (trigger_record.tgtype & 19) = 19
        and trigger_record.tgenabled in ('O', 'A')
        and not trigger_record.tgisinternal
    )
    and exists (
      select 1 from pg_catalog.pg_trigger as trigger_record
      where trigger_record.tgname = 'mark_legacy_customer_price_write'
        and trigger_record.tgrelid = 'public.customer_commercial_policies'::regclass
        and trigger_record.tgfoid = 'public.mark_legacy_customer_price_write()'::regprocedure
        and (trigger_record.tgtype & 23) = 23
        and trigger_record.tgenabled in ('O', 'A')
        and not trigger_record.tgisinternal
    ) as legacy_write_guards_present
)
select
  column_state.global_columns_present,
  column_state.customer_columns_present,
  data_state.global_v2_ready,
  data_state.customer_rows_v2_ready,
  data_state.write_gate_consistent,
  data_state.writes_activated,
  constraint_state.explicit_constraints_validated,
  function_state.global_rpc_service_only,
  function_state.customer_rpc_service_only,
  function_state.activation_rpc_service_only,
  table_security_state.rls_enabled,
  table_security_state.browser_direct_writes_revoked,
  table_security_state.no_browser_write_policies,
  trigger_state.legacy_write_guards_present
from column_state
cross join data_state
cross join constraint_state
cross join function_state
cross join table_security_state
cross join trigger_state;
