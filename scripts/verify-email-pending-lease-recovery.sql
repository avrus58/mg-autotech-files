-- SELECT-only verification for
-- 20260828000001_email_pending_lease_recovery.sql.
-- Every boolean must be true before the application may rely on reclaiming a
-- stale pending transactional-email lease.

with function_contract as (
  select pg_catalog.to_regprocedure(
    'public.touch_email_events_updated_at()'
  ) as signature
),
checks(sort_order, check_name, ok, details) as (
  select
    10,
    'email updated_at lease column is canonical',
    exists (
      select 1
      from information_schema.columns as column_info
      where column_info.table_schema = 'public'
        and column_info.table_name = 'email_events'
        and column_info.column_name = 'updated_at'
        and column_info.udt_name = 'timestamptz'
        and column_info.is_nullable = 'NO'
        and column_info.column_default like '%now()%'
    ),
    'updated_at must be timestamptz, NOT NULL, and default to now()'

  union all

  select
    20,
    'email updated_at backfill is complete',
    not exists (
      select 1
      from public.email_events as email_event
      where email_event.updated_at is null
    ),
    'No email_events row may have a null lease version'

  union all

  select
    30,
    'email lease trigger is canonical',
    exists (
      select 1
      from pg_catalog.pg_trigger as trigger_info
      where trigger_info.tgname = 'email_events_touch_updated_at'
        and trigger_info.tgrelid =
          pg_catalog.to_regclass('public.email_events')
        and trigger_info.tgfoid = (
          select signature from function_contract
        )
        and not trigger_info.tgisinternal
        and trigger_info.tgenabled <> 'D'
        and trigger_info.tgtype = 19
    ),
    'The enabled BEFORE UPDATE row trigger must call the canonical function'

  union all

  select
    40,
    'email lease trigger function is bounded',
    exists (
      select 1
      from pg_catalog.pg_proc as procedure_info
      where procedure_info.oid = (
        select signature from function_contract
      )
        and not procedure_info.prosecdef
        and procedure_info.prorettype = 'pg_catalog.trigger'::pg_catalog.regtype
        and procedure_info.prosrc ~*
          'new\.updated_at[[:space:]]*:?[=][[:space:]]*pg_catalog\.clock_timestamp\(\)'
        and exists (
          select 1
          from unnest(procedure_info.proconfig) as setting
          where setting = 'search_path=' or setting = 'search_path=""'
        )
    ),
    'Function must be SECURITY INVOKER, return trigger, and use an empty search_path'

  union all

  select
    50,
    'email lease trigger function authority is service-only',
    (
      select signature is not null
        and not exists (
          select 1
          from pg_catalog.pg_proc as procedure_info
          cross join lateral pg_catalog.aclexplode(
            coalesce(
              procedure_info.proacl,
              pg_catalog.acldefault('f', procedure_info.proowner)
            )
          ) as access
          where procedure_info.oid = signature
            and access.grantee = 0
            and access.privilege_type = 'EXECUTE'
        )
        and not pg_catalog.has_function_privilege(
          'anon', signature, 'EXECUTE'
        )
        and not pg_catalog.has_function_privilege(
          'authenticated', signature, 'EXECUTE'
        )
        and pg_catalog.has_function_privilege(
          'service_role', signature, 'EXECUTE'
        )
      from function_contract
    ),
    'Only service_role may execute the trigger function directly'

  union all

  select
    60,
    'pending lease recovery index is canonical',
    exists (
      select 1
      from pg_catalog.pg_class as index_relation
      join pg_catalog.pg_index as index_info
        on index_info.indexrelid = index_relation.oid
      where index_relation.oid = pg_catalog.to_regclass(
        'public.email_events_pending_lease_idx'
      )
        and index_info.indrelid = pg_catalog.to_regclass(
          'public.email_events'
        )
        and index_info.indisvalid
        and index_info.indisready
        and index_info.indnatts = 1
        and index_info.indnkeyatts = 1
        and pg_catalog.pg_get_indexdef(
          index_relation.oid, 1, true
        ) = 'updated_at'
        and pg_catalog.pg_get_expr(
          index_info.indpred, index_info.indrelid
        ) ~* 'status = ''pending''::text'
    ),
    'A valid partial updated_at index must cover only pending rows'
)
select check_name, ok, details
from checks
order by sort_order;
