-- Read-only verification for MG AutoTech Growth & Customer Success Center.

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'growth_attribution_sessions',
    'growth_journey_events',
    'growth_customer_preferences',
    'growth_reminder_actions'
  )
order by table_name;

select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'growth_attribution_sessions',
    'growth_journey_events',
    'growth_customer_preferences',
    'growth_reminder_actions'
  )
order by c.relname;

select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'growth_attribution_sessions',
    'growth_journey_events',
    'growth_customer_preferences',
    'growth_reminder_actions'
  )
order by tablename, policyname;

select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'growth_attribution_sessions',
    'growth_journey_events',
    'growth_customer_preferences',
    'growth_reminder_actions'
  )
order by table_name, grantee, privilege_type;

select routine_name, security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'record_growth_attribution_touch',
    'reserve_growth_reminder_action'
  )
order by routine_name;

select
  count(*) as attribution_rows,
  count(*) filter (where visitor_hash !~ '^[a-f0-9]{64}$') as invalid_hash_rows,
  count(*) filter (where first_landing_path !~ '^/') as invalid_path_rows
from public.growth_attribution_sessions;

select event_type, count(*)
from public.growth_journey_events
group by event_type
order by event_type;

select abandoned_request_reminders, count(*)
from public.growth_customer_preferences
group by abandoned_request_reminders
order by abandoned_request_reminders;
