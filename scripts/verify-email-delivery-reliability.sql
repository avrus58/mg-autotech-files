-- Read-only verification for MG AutoTech Email Delivery Reliability.

select
  table_name,
  is_insertable_into
from information_schema.tables
where table_schema = 'public'
  and table_name in ('email_events', 'email_delivery_events', 'email_suppressions')
order by table_name;

select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('email_events', 'email_delivery_events', 'email_suppressions')
order by c.relname;

select
  tablename,
  policyname,
  roles,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('email_events', 'email_delivery_events', 'email_suppressions')
order by tablename, policyname;

select
  table_name,
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('email_events', 'email_delivery_events', 'email_suppressions')
order by table_name, ordinal_position;
