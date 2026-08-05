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
    'widget_resolve_domain_request'
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
    'widget_resolve_domain_request'
  )
order by p.proname;

select
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'widget_clients_one_live_domain_idx',
    'widget_api_keys_one_active_per_client_idx',
    'widget_domain_requests_one_pending_per_client_idx',
    'widget_audit_logs_client_idx',
    'widget_audit_logs_actor_user_idx'
  )
order by indexname;

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
