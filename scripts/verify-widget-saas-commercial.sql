-- Read-only verification for scripts/harden-widget-saas-commercial.sql.

select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'widget_settings', 'widget_plans', 'widget_clients', 'widget_api_keys',
    'widget_access_logs', 'widget_domain_change_requests', 'widget_webhook_events',
    'widget_audit_logs', 'widget_enquiries', 'widget_rate_limit_buckets'
  )
order by c.relname;

select
  routine_name,
  security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'widget_admin_commercial_metrics',
    'widget_consume_rate_limit',
    'cleanup_widget_operational_data',
    'touch_widget_updated_at',
    'widget_audit_client_security_change',
    'widget_audit_key_lifecycle',
    'widget_audit_domain_request_lifecycle',
    'widget_audit_settings_change',
    'widget_rotate_installation_key',
    'widget_resolve_domain_request',
    'claim_widget_checkout_attempt',
    'bind_widget_checkout_session',
    'release_widget_checkout_attempt'
  )
order by routine_name;

select
  p.proname as function_name,
  has_function_privilege('anon', p.oid, 'execute') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'execute') as service_role_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'widget_admin_commercial_metrics',
    'widget_consume_rate_limit',
    'cleanup_widget_operational_data',
    'touch_widget_updated_at',
    'widget_audit_client_security_change',
    'widget_audit_key_lifecycle',
    'widget_audit_domain_request_lifecycle',
    'widget_audit_settings_change',
    'widget_rotate_installation_key',
    'widget_resolve_domain_request',
    'claim_widget_checkout_attempt',
    'bind_widget_checkout_session',
    'release_widget_checkout_attempt'
  )
order by p.proname;

select
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'widget_clients_one_live_domain_idx',
    'widget_clients_one_live_canonical_domain_idx',
    'widget_clients_checkout_claim_token_idx',
    'widget_clients_checkout_claim_recovery_idx',
    'widget_api_keys_one_active_per_client_idx',
    'widget_domain_requests_one_pending_per_client_idx',
    'widget_audit_logs_client_idx',
    'widget_audit_logs_actor_user_idx'
  )
order by indexname;

select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'widget_clients'
  and column_name in (
    'canonical_domain',
    'stripe_checkout_session_id',
    'checkout_pending_until',
    'checkout_claim_token',
    'checkout_claimed_at'
  )
order by column_name;

select
  con.conname as constraint_name,
  con.convalidated as is_validated,
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
where con.conrelid = 'public.widget_clients'::regclass
  and con.conname = 'widget_clients_checkout_claim_state_check';

with expected_rpc(signature) as (
  values
    ('public.claim_widget_checkout_attempt(uuid,uuid,text,text,text,text,text,numeric,text,text,jsonb,integer,uuid,timestamptz)'),
    ('public.bind_widget_checkout_session(uuid,uuid,uuid,text,timestamptz)'),
    ('public.release_widget_checkout_attempt(uuid,uuid,uuid,text)')
)
select
  expected_rpc.signature,
  p.oid is not null as function_exists,
  coalesce(not p.prosecdef, false) as security_invoker,
  coalesce(
    exists (
      select 1
      from unnest(p.proconfig) as config(value)
      where config.value in ('search_path=', 'search_path=""')
    ),
    false
  ) as fixed_empty_search_path,
  coalesce(has_function_privilege('anon', p.oid, 'execute'), false) as anon_can_execute,
  coalesce(has_function_privilege('authenticated', p.oid, 'execute'), false) as authenticated_can_execute,
  coalesce(has_function_privilege('service_role', p.oid, 'execute'), false) as service_role_can_execute
from expected_rpc
left join pg_proc p on p.oid = to_regprocedure(expected_rpc.signature)
order by expected_rpc.signature;

select
  tablename,
  policyname,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and policyname in (
    'widget_clients_own_select',
    'widget_domain_requests_own_select',
    'widget_domain_requests_own_insert'
  )
order by tablename, policyname;

select
  table_name,
  has_table_privilege('anon', format('public.%I', table_name), 'select') as anon_can_select,
  has_table_privilege('authenticated', format('public.%I', table_name), 'select') as authenticated_can_select,
  has_table_privilege('service_role', format('public.%I', table_name), 'select') as service_role_can_select
from information_schema.tables
where table_schema = 'public'
  and table_name like 'widget_%'
order by table_name;

select *
from public.widget_admin_commercial_metrics(date_trunc('month', now()))
order by client_id
limit 25;
