-- Read-only verification for Growth customer bulk review.

select
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'growth_customer_classification_events'
      and column_name = 'batch_id'
  ) as batch_id_exists,
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.growth_customer_classifications'::regclass
      and conname = 'growth_customer_classification_evidence_note_chk'
  ) as evidence_note_constraint_exists;

select
  p.proname,
  p.prosecdef as security_definer,
  p.proconfig as function_config,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as customer_can_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'set_growth_customer_classification',
    'set_growth_customer_classifications_batch'
  )
order by p.proname;

select
  classification,
  count(*) as record_count,
  count(*) filter (where nullif(trim(reason), '') is null) as missing_evidence_note_count
from public.growth_customer_classifications
group by classification
order by classification;

select count(*) as classification_event_count
from public.growth_customer_classification_events;
