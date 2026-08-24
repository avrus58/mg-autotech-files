-- SELECT-only verification for commercial pricing write authority hardening.

with expected_tables(table_name) as (
  values
    ('commerce_settings'),
    ('customer_commercial_policies'),
    ('commerce_policy_events')
), table_privileges as (
  select
    expected.table_name,
    pg_catalog.has_table_privilege(
      'authenticated',
      'public.' || expected.table_name,
      'SELECT'
    ) as authenticated_select,
    pg_catalog.has_table_privilege(
      'authenticated',
      'public.' || expected.table_name,
      'INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'
    ) as authenticated_write,
    pg_catalog.has_table_privilege(
      'anon',
      'public.' || expected.table_name,
      'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'
    ) as anon_access,
    pg_catalog.has_table_privilege(
      'service_role', 'public.' || expected.table_name, 'SELECT'
    )
    and pg_catalog.has_table_privilege(
      'service_role', 'public.' || expected.table_name, 'INSERT'
    )
    and pg_catalog.has_table_privilege(
      'service_role', 'public.' || expected.table_name, 'UPDATE'
    )
    and pg_catalog.has_table_privilege(
      'service_role', 'public.' || expected.table_name, 'DELETE'
    ) as service_write
  from expected_tables as expected
), policy_state as (
  select
    expected.table_name,
    count(*) filter (
      where policy.cmd = 'SELECT'
        and policy.roles = array['authenticated']::name[]
        and pg_catalog.strpos(
          pg_catalog.lower(coalesce(policy.qual, '')),
          'has_staff_permission(''credits.manage'')'
        ) > 0
    ) as staff_select_policies,
    count(*) filter (
      where policy.cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
        and 'authenticated' = any(policy.roles)
    ) as authenticated_write_policies
  from expected_tables as expected
  left join pg_catalog.pg_policies as policy
    on policy.schemaname = 'public'
    and policy.tablename = expected.table_name
  group by expected.table_name
), constraint_state as (
  select
    pg_catalog.count(*) filter (
      where constraint_name = 'commerce_settings_authoritative_values_chk'
        and validated
    ) as valid_global_constraints,
    pg_catalog.count(*) filter (
      where constraint_name = 'customer_commercial_policy_authoritative_values_chk'
        and validated
    ) as valid_customer_constraints
  from (
    select constraint_record.conname as constraint_name,
      constraint_record.convalidated as validated
    from pg_catalog.pg_constraint as constraint_record
    where constraint_record.conrelid in (
      'public.commerce_settings'::regclass,
      'public.customer_commercial_policies'::regclass
    )
  ) as constraints
), data_state as (
  select pg_catalog.count(*) as inactive_adjustment_rows
  from public.customer_commercial_policies
  where adjustment_type = 'none'
    and adjustment_value <> 0
)
select
  privileges.table_name,
  privileges.authenticated_select,
  not privileges.authenticated_write as authenticated_write_revoked,
  not privileges.anon_access as anon_access_revoked,
  privileges.service_write,
  policies.staff_select_policies = 1 as one_staff_select_policy,
  policies.authenticated_write_policies = 0 as no_authenticated_write_policy,
  constraints.valid_global_constraints = 1 as global_constraint_valid,
  constraints.valid_customer_constraints = 1 as customer_constraint_valid,
  data_state.inactive_adjustment_rows = 0 as inactive_adjustments_canonical
from table_privileges as privileges
join policy_state as policies using (table_name)
cross join constraint_state as constraints
cross join data_state
order by privileges.table_name;
