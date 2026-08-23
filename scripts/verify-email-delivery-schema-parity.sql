-- SELECT-only verification for
-- 20260816002453_email_delivery_schema_parity.sql.
-- This inspects schema and authority metadata only; no email or customer rows
-- are read or returned.

with
expected_email_event_columns(column_name, udt_name, is_nullable) as (
  values
    ('delivery_status', 'text', 'YES'),
    ('last_delivery_event_at', 'timestamptz', 'YES'),
    ('delivered_at', 'timestamptz', 'YES'),
    ('delayed_at', 'timestamptz', 'YES'),
    ('bounced_at', 'timestamptz', 'YES'),
    ('complained_at', 'timestamptz', 'YES')
),
expected_delivery_columns(column_name, udt_name, is_nullable) as (
  values
    ('provider_event_id', 'text', 'NO'),
    ('email_event_id', 'uuid', 'YES'),
    ('provider_message_id', 'text', 'NO'),
    ('provider_event_type', 'text', 'NO'),
    ('delivery_status', 'text', 'NO'),
    ('recipient_email', 'text', 'NO'),
    ('occurred_at', 'timestamptz', 'NO'),
    ('reason_code', 'text', 'YES'),
    ('reason_message', 'text', 'YES'),
    ('payload_sha256', 'text', 'NO'),
    ('created_at', 'timestamptz', 'NO')
),
expected_suppression_columns(column_name, udt_name, is_nullable) as (
  values
    ('recipient_email', 'text', 'NO'),
    ('reason', 'text', 'NO'),
    ('source_event_id', 'text', 'YES'),
    ('active', 'bool', 'NO'),
    ('last_event_at', 'timestamptz', 'NO'),
    ('created_at', 'timestamptz', 'NO'),
    ('updated_at', 'timestamptz', 'NO'),
    ('resolved_at', 'timestamptz', 'YES'),
    ('resolved_by', 'uuid', 'YES')
),
operational_tables(table_name) as (
  values
    ('email_delivery_events'),
    ('email_suppressions')
),
operational_columns(table_name, column_name) as (
  select column_info.table_name, column_info.column_name
  from information_schema.columns as column_info
  where column_info.table_schema = 'public'
    and column_info.table_name in (
      'email_delivery_events',
      'email_suppressions'
    )
),
checks(sort_order, check_name, ok, details) as (
  select
    10,
    'email event delivery projection is complete',
    pg_catalog.count(*) = 6
      and pg_catalog.bool_and(
        live.column_name is not null
        and live.udt_name = expected.udt_name
        and live.is_nullable = expected.is_nullable
      ),
    pg_catalog.count(*)::text || ' of 6 delivery columns found'
  from expected_email_event_columns as expected
  left join information_schema.columns as live
    on live.table_schema = 'public'
    and live.table_name = 'email_events'
    and live.column_name = expected.column_name

  union all

  select
    20,
    'email event delivery constraint and indexes are canonical',
    exists (
      select 1
      from pg_catalog.pg_constraint as constraint_info
      where constraint_info.conrelid =
        'public.email_events'::pg_catalog.regclass
        and constraint_info.conname = 'email_events_delivery_status_check'
        and constraint_info.convalidated
        and pg_catalog.lower(
          pg_catalog.pg_get_constraintdef(constraint_info.oid)
        ) like '%delivery_status%pending%delivered%complained%suppressed%skipped%'
    )
      and exists (
        select 1
        from pg_catalog.pg_class as index_relation
        where index_relation.oid = pg_catalog.to_regclass(
          'public.email_events_provider_message_id_idx'
        )
      )
      and exists (
        select 1
        from pg_catalog.pg_class as index_relation
        where index_relation.oid = pg_catalog.to_regclass(
          'public.email_events_delivery_status_idx'
        )
      ),
    'Status allowlist and both delivery lookup indexes must exist'

  union all

  select
    30,
    'email delivery event schema is exact',
    pg_catalog.count(*) = 11
      and pg_catalog.bool_and(
        live.column_name is not null
        and live.udt_name = expected.udt_name
        and live.is_nullable = expected.is_nullable
      )
      and (
        select pg_catalog.count(*) = 11
        from information_schema.columns as column_info
        where column_info.table_schema = 'public'
          and column_info.table_name = 'email_delivery_events'
      ),
    pg_catalog.count(*)::text || ' of 11 canonical columns found'
  from expected_delivery_columns as expected
  left join information_schema.columns as live
    on live.table_schema = 'public'
    and live.table_name = 'email_delivery_events'
    and live.column_name = expected.column_name

  union all

  select
    40,
    'email suppression schema is exact',
    pg_catalog.count(*) = 9
      and pg_catalog.bool_and(
        live.column_name is not null
        and live.udt_name = expected.udt_name
        and live.is_nullable = expected.is_nullable
      )
      and (
        select pg_catalog.count(*) = 9
        from information_schema.columns as column_info
        where column_info.table_schema = 'public'
          and column_info.table_name = 'email_suppressions'
      ),
    pg_catalog.count(*)::text || ' of 9 canonical columns found'
  from expected_suppression_columns as expected
  left join information_schema.columns as live
    on live.table_schema = 'public'
    and live.table_name = 'email_suppressions'
    and live.column_name = expected.column_name

  union all

  select
    50,
    'email delivery constraints and indexes are canonical',
    (
      select pg_catalog.count(*) = 11
      from pg_catalog.pg_constraint as constraint_info
      where constraint_info.conrelid in (
        'public.email_delivery_events'::pg_catalog.regclass,
        'public.email_suppressions'::pg_catalog.regclass
      )
        and constraint_info.conname in (
          'email_delivery_events_pkey',
          'email_delivery_events_email_event_id_fkey',
          'email_delivery_events_provider_event_type_check',
          'email_delivery_events_delivery_status_check',
          'email_delivery_events_recipient_email_check',
          'email_delivery_events_payload_sha256_check',
          'email_suppressions_pkey',
          'email_suppressions_recipient_email_check',
          'email_suppressions_reason_check',
          'email_suppressions_source_event_id_fkey',
          'email_suppressions_resolved_by_fkey'
        )
        and constraint_info.convalidated
    )
      and (
        select pg_catalog.count(*) = 6
        from pg_catalog.pg_class as index_relation
        where index_relation.oid in (
          pg_catalog.to_regclass('public.email_delivery_events_pkey'),
          pg_catalog.to_regclass('public.email_delivery_events_message_idx'),
          pg_catalog.to_regclass('public.email_delivery_events_status_idx'),
          pg_catalog.to_regclass('public.email_delivery_events_email_event_idx'),
          pg_catalog.to_regclass('public.email_suppressions_pkey'),
          pg_catalog.to_regclass('public.email_suppressions_active_idx')
        )
      ),
    'Canonical PK, FK, allowlist, digest and lookup structures are present'

  union all

  select
    60,
    'email delivery operational tables are service API only',
    pg_catalog.count(*) = 2
      and pg_catalog.bool_and(
        pg_catalog.to_regclass('public.' || target.table_name) is not null
        and exists (
          select 1
          from pg_catalog.pg_class as relation
          where relation.oid =
            pg_catalog.to_regclass('public.' || target.table_name)
            and relation.relrowsecurity
        )
        and not exists (
          select 1
          from (values
            ('public'),
            ('anon'),
            ('authenticated')
          ) as api_role(role_name)
          cross join (values
            ('SELECT'),
            ('INSERT'),
            ('UPDATE'),
            ('DELETE'),
            ('TRUNCATE'),
            ('REFERENCES'),
            ('TRIGGER')
          ) as privilege(privilege_name)
          where pg_catalog.has_table_privilege(
            api_role.role_name,
            pg_catalog.to_regclass('public.' || target.table_name),
            privilege.privilege_name
          )
        )
        and not exists (
          select 1
          from operational_columns as target_column
          cross join (values
            ('public'),
            ('anon'),
            ('authenticated')
          ) as api_role(role_name)
          cross join (values
            ('SELECT'),
            ('INSERT'),
            ('UPDATE'),
            ('REFERENCES')
          ) as privilege(privilege_name)
          where target_column.table_name = target.table_name
            and pg_catalog.has_column_privilege(
              api_role.role_name,
              pg_catalog.to_regclass('public.' || target.table_name),
              target_column.column_name,
              privilege.privilege_name
            )
        )
        and (
          select pg_catalog.bool_and(
            pg_catalog.has_table_privilege(
              'service_role',
              pg_catalog.to_regclass('public.' || target.table_name),
              privilege.privilege_name
            )
          )
          from (values
            ('SELECT'),
            ('INSERT'),
            ('UPDATE'),
            ('DELETE'),
            ('TRUNCATE'),
            ('REFERENCES'),
            ('TRIGGER')
          ) as privilege(privilege_name)
        )
      ),
    'RLS is enabled; only service_role holds table or column authority'
  from operational_tables as target

  union all

  select
    70,
    'email delivery operational tables have no Data API policies',
    pg_catalog.count(*) = 0,
    pg_catalog.count(*)::text || ' policies found'
  from pg_catalog.pg_policies as policy
  where policy.schemaname = 'public'
    and policy.tablename in (
      'email_delivery_events',
      'email_suppressions'
    )
)
select check_name, ok, details
from checks
order by sort_order;
