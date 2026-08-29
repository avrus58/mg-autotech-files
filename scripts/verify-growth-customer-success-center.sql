-- SELECT-only verification for the canonical Growth attribution migration.
-- Every boolean must be true before the application or an Ads campaign may use
-- this schema as conversion evidence.

with expected(table_name) as (
  values
    ('growth_attribution_sessions'),
    ('growth_attribution_touch_receipts'),
    ('growth_journey_events'),
    ('growth_customer_preferences'),
    ('growth_reminder_actions')
)
select
  expected.table_name,
  tables.table_name is not null as table_exists,
  coalesce(classes.relrowsecurity, false) as rls_enabled
from expected
left join information_schema.tables as tables
  on tables.table_schema = 'public'
 and tables.table_name = expected.table_name
left join pg_catalog.pg_class as classes
  on classes.oid = pg_catalog.to_regclass('public.' || expected.table_name)
order by expected.table_name;

with private_tables(table_name, authenticated_select_expected) as (
  values
    ('growth_attribution_sessions', true),
    ('growth_attribution_touch_receipts', false),
    ('growth_journey_events', true),
    ('growth_customer_preferences', true),
    ('growth_reminder_actions', true)
)
select
  table_name,
  not exists (
    select 1
    from pg_catalog.pg_class as classes
    join pg_catalog.pg_namespace as namespaces on namespaces.oid = classes.relnamespace
    cross join lateral pg_catalog.aclexplode(
      coalesce(classes.relacl, pg_catalog.acldefault('r', classes.relowner))
    ) as access
    where namespaces.nspname = 'public'
      and classes.relname = table_name
      and access.grantee = 0
      and access.privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
  )
    as public_has_no_direct_dml,
  not pg_catalog.has_table_privilege('anon', 'public.' || table_name, 'SELECT')
    and not pg_catalog.has_table_privilege('anon', 'public.' || table_name, 'INSERT')
    and not pg_catalog.has_table_privilege('anon', 'public.' || table_name, 'UPDATE')
    and not pg_catalog.has_table_privilege('anon', 'public.' || table_name, 'DELETE')
    as anon_has_no_direct_dml,
  not pg_catalog.has_table_privilege('authenticated', 'public.' || table_name, 'INSERT')
    and not pg_catalog.has_table_privilege('authenticated', 'public.' || table_name, 'UPDATE')
    and not pg_catalog.has_table_privilege('authenticated', 'public.' || table_name, 'DELETE')
    as authenticated_has_no_write,
  pg_catalog.has_table_privilege('authenticated', 'public.' || table_name, 'SELECT')
    = authenticated_select_expected as authenticated_select_matches_contract,
  pg_catalog.has_table_privilege('service_role', 'public.' || table_name, 'SELECT')
    and pg_catalog.has_table_privilege('service_role', 'public.' || table_name, 'INSERT')
    and pg_catalog.has_table_privilege('service_role', 'public.' || table_name, 'UPDATE')
    and pg_catalog.has_table_privilege('service_role', 'public.' || table_name, 'DELETE')
    as service_role_has_server_dml
from private_tables
order by table_name;

select
  pg_catalog.to_regprocedure(
    'public.record_growth_attribution_touch(text,text,text,uuid,text,text,text,text,text,text,text,text,text)'
  ) is not null as receipt_rpc_exists,
  pg_catalog.to_regprocedure(
    'public.link_growth_visitor_identity(text,text,uuid,timestamptz)'
  ) is not null as identity_link_rpc_exists,
  pg_catalog.to_regprocedure(
    'public.reserve_growth_reminder_action(uuid,uuid,text,uuid)'
  ) is not null as reminder_reservation_rpc_exists;

select
  exists (
    select 1
    from pg_catalog.pg_proc as procedures
    where procedures.oid = pg_catalog.to_regprocedure(
      'public.record_growth_attribution_touch(text,text,text,uuid,text,text,text,text,text,text,text,text,text)'
    )
      and pg_catalog.strpos(procedures.prosrc, 'p_term') = 0
  ) as current_touch_rpc_discards_free_form_term;

with function_contract(signature) as (
  values
    ('public.record_growth_attribution_touch(text,text,text,uuid,text,text,text,text,text,text,text,text,text)'),
    ('public.link_growth_visitor_identity(text,text,uuid,timestamptz)'),
    ('public.reserve_growth_reminder_action(uuid,uuid,text,uuid)')
)
select
  signature,
  pg_catalog.to_regprocedure(signature) is not null as function_exists,
  coalesce((
    select not procedures.prosecdef
    from pg_catalog.pg_proc as procedures
    where procedures.oid = pg_catalog.to_regprocedure(signature)
  ), false) as security_invoker,
  coalesce((
    select 'search_path=public' = any(procedures.proconfig)
    from pg_catalog.pg_proc as procedures
    where procedures.oid = pg_catalog.to_regprocedure(signature)
  ), false) as bounded_search_path,
  coalesce((
    select pg_catalog.strpos(procedures.prosrc, 'pg_advisory_xact_lock') > 0
    from pg_catalog.pg_proc as procedures
    where procedures.oid = pg_catalog.to_regprocedure(signature)
  ), false) as transaction_serialization_present,
  not exists (
    select 1
    from pg_catalog.pg_proc as procedures
    cross join lateral pg_catalog.aclexplode(
      coalesce(procedures.proacl, pg_catalog.acldefault('f', procedures.proowner))
    ) as access
    where procedures.oid = pg_catalog.to_regprocedure(signature)
      and access.grantee = 0
      and access.privilege_type = 'EXECUTE'
  )
    and not coalesce(pg_catalog.has_function_privilege('anon', pg_catalog.to_regprocedure(signature), 'EXECUTE'), false)
    and not coalesce(pg_catalog.has_function_privilege('authenticated', pg_catalog.to_regprocedure(signature), 'EXECUTE'), false)
    as browser_execute_revoked,
  coalesce(pg_catalog.has_function_privilege('service_role', pg_catalog.to_regprocedure(signature), 'EXECUTE'), false)
    as service_role_execute_present
from function_contract;

-- Existing installations can retain the former signature for one rollback
-- window. A clean install legitimately has no former function, so both states
-- are valid provided browser roles can never execute the bridge.
with legacy_bridge as (
  select pg_catalog.to_regprocedure(
    'public.record_growth_attribution_touch(text,uuid,text,text,text,text,text,text,text,text,text)'
  ) as signature
)
select
  signature is null or (
    not exists (
      select 1
      from pg_catalog.pg_proc as procedures
      cross join lateral pg_catalog.aclexplode(
        coalesce(procedures.proacl, pg_catalog.acldefault('f', procedures.proowner))
      ) as access
      where procedures.oid = signature
        and access.grantee = 0
        and access.privilege_type = 'EXECUTE'
    )
    and not coalesce(pg_catalog.has_function_privilege('anon', signature, 'EXECUTE'), false)
    and not coalesce(pg_catalog.has_function_privilege('authenticated', signature, 'EXECUTE'), false)
    and coalesce(pg_catalog.has_function_privilege('service_role', signature, 'EXECUTE'), false)
  ) as legacy_rollback_bridge_safe
from legacy_bridge;

with trigger_function as (
  select pg_catalog.to_regprocedure(
    'public.touch_growth_customer_success_updated_at()'
  ) as signature
)
select
  signature is not null as trigger_function_exists,
  not exists (
    select 1
    from pg_catalog.pg_proc as procedures
    cross join lateral pg_catalog.aclexplode(
      coalesce(procedures.proacl, pg_catalog.acldefault('f', procedures.proowner))
    ) as access
    where procedures.oid = signature
      and access.grantee = 0
      and access.privilege_type = 'EXECUTE'
  )
    and not coalesce(pg_catalog.has_function_privilege('anon', signature, 'EXECUTE'), false)
    and not coalesce(pg_catalog.has_function_privilege('authenticated', signature, 'EXECUTE'), false)
    as trigger_function_browser_execute_revoked
from trigger_function;

with trigger_contract(trigger_name, table_name) as (
  values
    ('growth_attribution_touch_updated_at', 'growth_attribution_sessions'),
    ('growth_preferences_touch_updated_at', 'growth_customer_preferences')
),
trigger_function as (
  select pg_catalog.to_regprocedure(
    'public.touch_growth_customer_success_updated_at()'
  ) as signature
)
select
  trigger_name,
  exists (
    select 1
    from pg_catalog.pg_trigger as trigger_info
    where trigger_info.tgname = trigger_contract.trigger_name
      and trigger_info.tgrelid = pg_catalog.to_regclass(
        'public.' || trigger_contract.table_name
      )
      and trigger_info.tgfoid = trigger_function.signature
      and trigger_info.tgtype = 19
      and trigger_info.tgenabled <> 'D'
      and not trigger_info.tgisinternal
  ) as trigger_attachment_matches_contract
from trigger_contract
cross join trigger_function
order by trigger_name;

select
  exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.growth_journey_events'::pg_catalog.regclass
      and conname = 'growth_journey_events_event_type_check'
      and pg_catalog.pg_get_constraintdef(oid) like '%identity_linked%'
  ) as identity_linked_event_allowed,
  exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.growth_attribution_sessions'::pg_catalog.regclass
      and conname = 'growth_attribution_sessions_hash_version_check'
      and pg_catalog.pg_get_constraintdef(oid) like '%pre-v2-key-unknown%'
      and pg_catalog.pg_get_constraintdef(oid) like '%legacy-service-role-v1%'
      and pg_catalog.pg_get_constraintdef(oid) like '%dedicated-v2%'
  ) as attribution_hash_versions_constrained,
  exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.growth_journey_events'::pg_catalog.regclass
      and conname = 'growth_journey_events_hash_version_check'
      and pg_catalog.pg_get_constraintdef(oid) like '%pre-v2-key-unknown%'
      and pg_catalog.pg_get_constraintdef(oid) like '%legacy-service-role-v1%'
      and pg_catalog.pg_get_constraintdef(oid) like '%dedicated-v2%'
      and pg_catalog.pg_get_constraintdef(oid) ilike '%visitor_hash is null%'
  ) as journey_hash_versions_constrained,
  exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.growth_attribution_touch_receipts'::pg_catalog.regclass
      and conname = 'growth_attribution_touch_receipts_hash_version_check'
      and pg_catalog.pg_get_constraintdef(oid) like '%pre-v2-key-unknown%'
      and pg_catalog.pg_get_constraintdef(oid) like '%legacy-service-role-v1%'
      and pg_catalog.pg_get_constraintdef(oid) like '%dedicated-v2%'
  ) as receipt_hash_versions_constrained;

with expected_staff_policy(table_name, policy_name) as (
  values
    ('growth_attribution_sessions', 'Growth staff can read attribution'),
    ('growth_journey_events', 'Growth staff can read journey events'),
    ('growth_reminder_actions', 'Growth staff can read reminder actions'),
    ('growth_customer_preferences', 'Growth staff can read reminder preferences')
)
select
  table_name,
  exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = expected_staff_policy.table_name
      and policyname = expected_staff_policy.policy_name
      and cmd = 'SELECT'
      and roles @> array['authenticated'::name]
      and qual like '%has_staff_permission%'
      and qual like '%orders.view%'
  ) as staff_read_policy_matches_contract
from expected_staff_policy
order by table_name;

select
  exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'growth_attribution_sessions'
      and policyname = 'Growth staff can read attribution'
      and cmd = 'SELECT'
      and roles @> array['authenticated'::name]
  ) as attribution_staff_read_policy,
  exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'growth_customer_preferences'
      and policyname = 'Customers can read own growth preferences'
      and cmd = 'SELECT'
      and qual like '%auth.uid()%'
  ) as customer_owns_preference_policy,
  exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'growth_customer_preferences'
      and policyname = 'MG assured customer growth_customer_preferences select boundary'
      and permissive = 'RESTRICTIVE'
      and cmd = 'SELECT'
      and qual like '%current_customer_session_assured%'
  ) as preference_assurance_boundary;

select
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'growth_customer_preferences'
      and column_name = 'abandoned_request_reminders'
      and is_nullable = 'NO'
      and column_default in ('false', 'false::boolean')
  ) as reminder_preference_defaults_off,
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name in (
        'growth_attribution_sessions',
        'growth_attribution_touch_receipts',
        'growth_journey_events'
      )
      and column_name in (
        'visitor_id', 'raw_visitor_id', 'raw_click_id',
        'gclid', 'dclid', 'wbraid', 'gbraid'
      )
  ) as no_raw_visitor_or_click_id_columns;

select
  count(*) as attribution_rows,
  count(*) filter (where visitor_hash !~ '^[a-f0-9]{64}$') as invalid_hash_rows,
  count(*) filter (where first_landing_path !~ '^/') as invalid_path_rows,
  count(*) filter (
    where visitor_hash_version not in ('pre-v2-key-unknown', 'legacy-service-role-v1', 'dedicated-v2')
  ) as invalid_hash_version_rows
from public.growth_attribution_sessions;

select
  count(*) as touch_receipts,
  count(*) filter (where receipt_hash !~ '^[a-f0-9]{64}$') as invalid_receipt_hash_rows,
  count(*) filter (
    where visitor_hash_version not in ('pre-v2-key-unknown', 'legacy-service-role-v1', 'dedicated-v2')
  ) as invalid_receipt_version_rows,
  count(*) filter (where outcome = 'pending') as unexpectedly_pending_receipts
from public.growth_attribution_touch_receipts;

select event_type, count(*)
from public.growth_journey_events
group by event_type
order by event_type;

select abandoned_request_reminders, count(*)
from public.growth_customer_preferences
group by abandoned_request_reminders
order by abandoned_request_reminders;
