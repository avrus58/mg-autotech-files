-- Read-only verification for MG AutoTech Growth Customer Classification.

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'growth_customer_classifications',
    'growth_customer_classification_events'
  )
order by table_name;

select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'growth_customer_classifications',
    'growth_customer_classification_events'
  )
order by c.relname;

select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'growth_customer_classifications',
    'growth_customer_classification_events'
  )
order by table_name, grantee, privilege_type;

select routine_name, security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'set_growth_customer_classification';

select classification, analytics_excluded, count(*)
from public.growth_customer_classifications
group by classification, analytics_excluded
order by classification;

select count(*) as invalid_state_rows
from public.growth_customer_classifications
where analytics_excluded is distinct from
  (classification in ('internal_test', 'staff_operated'));
