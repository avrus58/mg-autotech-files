-- Read-only verification for request chat Data API isolation.

select
  c.relrowsecurity as rls_enabled,
  not has_table_privilege('anon', 'public.request_messages', 'select') as anon_select_blocked,
  not has_table_privilege('authenticated', 'public.request_messages', 'select') as authenticated_select_blocked,
  not has_table_privilege('authenticated', 'public.request_messages', 'insert') as authenticated_insert_blocked,
  has_table_privilege('service_role', 'public.request_messages', 'select') as service_role_select_allowed,
  has_table_privilege('service_role', 'public.request_messages', 'insert') as service_role_insert_allowed
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'request_messages';

select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'request_messages'
order by policyname;
