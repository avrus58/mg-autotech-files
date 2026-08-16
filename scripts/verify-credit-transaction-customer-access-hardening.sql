-- SELECT-only verification for
-- 20260816002451_credit_transaction_customer_access_hardening.sql.
-- Results contain aggregate authority state only; no ledger or Storage rows
-- are read or returned.

with
expected_ledger_columns(column_name) as (
  values
    ('id'),
    ('user_id'),
    ('type'),
    ('source_type'),
    ('source_id'),
    ('credits_delta'),
    ('balance_after'),
    ('description'),
    ('amount_total'),
    ('currency'),
    ('created_at')
),
expected_storage_policies(policy_name, command_name, role_name, policy_mode) as (
  values
    ('MG customer files select', 'SELECT', 'authenticated', 'PERMISSIVE'),
    ('MG customer files insert', 'INSERT', 'authenticated', 'PERMISSIVE'),
    ('MG customer files legacy owner insert', 'INSERT', 'authenticated', 'PERMISSIVE'),
    ('MG file expert select', 'SELECT', 'authenticated', 'PERMISSIVE'),
    ('MG file expert legacy owner insert', 'INSERT', 'authenticated', 'PERMISSIVE'),
    ('MG protected buckets select boundary', 'SELECT', 'authenticated', 'RESTRICTIVE'),
    ('MG protected buckets insert boundary', 'INSERT', 'authenticated', 'RESTRICTIVE'),
    ('MG protected buckets update boundary', 'UPDATE', 'authenticated', 'RESTRICTIVE'),
    ('MG protected buckets delete boundary', 'DELETE', 'authenticated', 'RESTRICTIVE'),
    ('MG protected buckets anon select boundary', 'SELECT', 'anon', 'RESTRICTIVE'),
    ('MG protected buckets anon insert boundary', 'INSERT', 'anon', 'RESTRICTIVE'),
    ('MG protected buckets anon update boundary', 'UPDATE', 'anon', 'RESTRICTIVE'),
    ('MG protected buckets anon delete boundary', 'DELETE', 'anon', 'RESTRICTIVE')
),
ledger_columns as (
  select column_info.column_name
  from information_schema.columns as column_info
  where column_info.table_schema = 'public'
    and column_info.table_name = 'credit_transactions'
),
protected_storage_policies as (
  select
    policy.policyname,
    policy.cmd,
    policy.roles,
    policy.permissive,
    pg_catalog.lower(
      coalesce(policy.qual, '') || ' ' || coalesce(policy.with_check, '')
    ) as expression
  from pg_catalog.pg_policies as policy
  where policy.schemaname = 'storage'
    and policy.tablename = 'objects'
    and pg_catalog.lower(
      coalesce(policy.qual, '') || ' ' || coalesce(policy.with_check, '')
    ) ~ '(customer-files|file-expert)'
),
checks(sort_order, check_name, ok, details) as (
  select
    10,
    'credit ledger exists with RLS enabled',
    exists (
      select 1
      from pg_catalog.pg_class as relation
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = 'credit_transactions'
        and relation.relkind in ('r', 'p')
        and relation.relrowsecurity
    ),
    'public.credit_transactions is an RLS-protected table'

  union all

  select
    20,
    'authenticated ledger SELECT is the exact customer projection',
    not pg_catalog.has_table_privilege(
      'authenticated', 'public.credit_transactions', 'SELECT'
    )
      and (
        select pg_catalog.count(*) = 11
          and pg_catalog.bool_and(
            pg_catalog.has_column_privilege(
              'authenticated',
              'public.credit_transactions',
              expected.column_name,
              'SELECT'
            )
          )
        from expected_ledger_columns as expected
      )
      and not exists (
        select 1
        from ledger_columns as live
        where not exists (
          select 1
          from expected_ledger_columns as expected
          where expected.column_name = live.column_name
        )
          and pg_catalog.has_column_privilege(
            'authenticated',
            'public.credit_transactions',
            live.column_name,
            'SELECT'
          )
      ),
    '11 customer-safe columns; metadata, created_by, and future columns remain private'

  union all

  select
    30,
    'authenticated and anon ledger mutations are denied',
    not exists (
      select 1
      from (values
        ('authenticated'),
        ('anon')
      ) as api_role(role_name)
      cross join (values
        ('INSERT'),
        ('UPDATE'),
        ('DELETE'),
        ('TRUNCATE'),
        ('REFERENCES'),
        ('TRIGGER')
      ) as privilege(privilege_name)
      where pg_catalog.has_table_privilege(
        api_role.role_name,
        'public.credit_transactions',
        privilege.privilege_name
      )
    )
      and not exists (
        select 1
        from (values
          ('authenticated'),
          ('anon')
        ) as api_role(role_name)
        cross join ledger_columns as live
        cross join (values
          ('SELECT'),
          ('INSERT'),
          ('UPDATE'),
          ('REFERENCES')
        ) as privilege(privilege_name)
        where api_role.role_name = 'anon'
          and pg_catalog.has_column_privilege(
            api_role.role_name,
            'public.credit_transactions',
            live.column_name,
            privilege.privilege_name
          )
          or api_role.role_name = 'authenticated'
          and privilege.privilege_name <> 'SELECT'
          and pg_catalog.has_column_privilege(
            api_role.role_name,
            'public.credit_transactions',
            live.column_name,
            privilege.privilege_name
          )
      ),
    'Only authenticated customer-safe SELECT columns are exposed'

  union all

  select
    40,
    'service role retains full credit-ledger table authority',
    pg_catalog.bool_and(
      pg_catalog.has_table_privilege(
        'service_role',
        'public.credit_transactions',
        privilege.privilege_name
      )
    ),
    pg_catalog.count(*)::text || ' service-role privileges checked'
  from (values
    ('SELECT'),
    ('INSERT'),
    ('UPDATE'),
    ('DELETE'),
    ('TRUNCATE'),
    ('REFERENCES'),
    ('TRIGGER')
  ) as privilege(privilege_name)

  union all

  select
    50,
    'credit ledger has exactly one customer-owned SELECT policy',
    pg_catalog.count(*) = 1
      and pg_catalog.bool_and(
        policy.policyname = 'Customers can read own credit transactions'
        and policy.permissive = 'PERMISSIVE'
        and policy.cmd = 'SELECT'
        and policy.roles = array['authenticated']::name[]
        and pg_catalog.lower(coalesce(policy.qual, '')) like '%auth.uid()%'
        and pg_catalog.lower(coalesce(policy.qual, '')) like '%user_id%'
        and pg_catalog.lower(coalesce(policy.qual, '')) not like '%profiles%'
        and pg_catalog.lower(coalesce(policy.qual, '')) not like '% or %'
        and policy.with_check is null
      ),
    pg_catalog.count(*)::text || ' ledger policies found'
  from pg_catalog.pg_policies as policy
  where policy.schemaname = 'public'
    and policy.tablename = 'credit_transactions'

  union all

  select
    60,
    'protected Storage policies match the pre-cutover canonical allowlist',
    (select pg_catalog.count(*) = 13 from protected_storage_policies)
      and not exists (
        select 1
        from expected_storage_policies as expected
        left join protected_storage_policies as live
          on live.policyname = expected.policy_name
          and live.cmd = expected.command_name
          and live.roles = array[expected.role_name]::name[]
          and live.permissive = expected.policy_mode
        where live.policyname is null
      )
      and not exists (
        select 1
        from protected_storage_policies as live
        where not exists (
          select 1
          from expected_storage_policies as expected
          where expected.policy_name = live.policyname
        )
          or live.expression ~ '(profiles|staff_role|staff_permissions)'
      ),
    '13 transitional policies; no profiles.role dependency or noncanonical protected-bucket policy'
)
select check_name, ok, details
from checks
order by sort_order;
